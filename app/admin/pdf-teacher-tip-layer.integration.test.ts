import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import { createPerRunTeacher } from "@/test/per-run-teacher";
import { insertReservationInBand } from "@/test/reservation-slots";

// PDF 교사용 팁 레이어(20261980000000) — 권한 매트릭스·eventId 중복·버전 가져오기,
// 그리고 교재가 바뀔 때(새 공개 버전·보관·시작 전 pin)의 팁·필기 동작 확인.
//
// 대상 DB: SUPABASE_TEST_DB_URL (격리 스택) 없으면 공유 로컬(54422). 모든 데이터는 실행 ID(RUN)가
// 붙은 전용 자료·수업이고, append-only 이벤트 때문에 정리하지 않는다 — 재실행해도 서로 간섭하지
// 않는다(자료·세션·선생님이 실행마다 새로 만들어진다).

const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const OTHER_TEACHER_ID = "dddddddd-0000-0000-0000-000000000002";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const PARENT_ID = "bbbbbbbb-0000-0000-0000-000000000001"; // 지훈 보호자(seed)
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const RUN = `tipuat_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

let TEACHER_ID: string;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}
function psqlExpectError(sql: string): string {
  try {
    execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    throw new Error("expected psql to fail, but it succeeded");
  } catch (err) {
    return (err as { stderr?: Buffer })?.stderr?.toString() ?? String(err);
  }
}
const asUser = (id: string, sql: string) =>
  psql(`set role authenticated;
    do $$ begin perform set_config('request.jwt.claim.sub', '${id}', false); end $$;
    ${sql}
    reset role;`);
const asUserExpectError = (id: string, sql: string) =>
  psqlExpectError(`set role authenticated;
    do $$ begin perform set_config('request.jwt.claim.sub', '${id}', false); end $$;
    ${sql}
    reset role;`);
const asAnonExpectError = (sql: string) => psqlExpectError(`set role anon; ${sql} reset role;`);

const uuid = () => psql("select gen_random_uuid();");
const uniq = () => `${Date.now()}_${Math.floor(Math.random() * 1e9)}`;

const asset = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    bucket: "curriculum-assets",
    path: `${RUN}/${uniq()}.pdf`,
    bytes: 1234,
    sha256: uniq().padEnd(64, "a"),
    mimeType: "application/pdf",
    pageCount: 3,
    ...over,
  }).replace(/'/g, "''");

function makeDoc(): string {
  return asUser(
    ADMIN_ID,
    `insert into curriculum_docs (title, subject_id, owner_type, status, kind, source_drive_file_id, source_mime_type)
     values ('${RUN} 자료', '${SUBJECT_ID}', 'admin', 'draft', 'pdf', 'drive_${uniq()}', 'application/pdf') returning id;`
  );
}
const publish = (doc: string, over: Record<string, unknown> = {}) =>
  asUser(ADMIN_ID, `select publish_curriculum_asset_doc('${doc}', '${asset(over)}'::jsonb);`);

const seg = (eventId: string, x = 1) =>
  JSON.stringify([{ x0: x, y0: 2, x1: 3, y1: 4, color: "#C8102E", tool: "pen", w: 800, eventId }]);
const textSeg = (eventId: string) =>
  JSON.stringify([{ x0: 5, y0: 6, x1: 5, y1: 6, color: "#1A1A1A", tool: "text", text: "팁 글", size: 18, w: 800, eventId }]);
const clearSeg = (eventId: string) =>
  JSON.stringify([{ x0: 0, y0: 0, x1: 0, y1: 0, color: "#000", tool: "clear", eventId }]);

const addTip = (version: string, page: number, segments: string, by = ADMIN_ID) =>
  asUser(by, `select count(*) from append_pdf_tip_events('${version}', ${page}, '${segments}'::jsonb);`);
const tipCount = (version: string, page?: number) =>
  `select count(*) from pdf_tip_events where curriculum_doc_version_id = '${version}'${page ? ` and page_number = ${page}` : ""};`;

// 수업: 시작 전(planned) / 시작 후(pinned). 자료는 회차 구성에 담긴다.
function makeSession(docId: string) {
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${HOUSEHOLD_ID}', '${STUDENT_ID}', 'draft') returning id;`
  );
  const enrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${STUDENT_ID}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
  );
  psql(
    `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from)
     values ('${enrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day');`
  );
  const reservationId = insertReservationInBand(psql, {
    band: "pdf-teacher-tip-layer",
    enrollmentId,
    teacherId: TEACHER_ID,
  });
  const sessionId = psql(
    `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes)
     values ('${reservationId}', '${enrollmentId}', '${TEACHER_ID}', (select id from lesson_types where code = 'regular'), 60) returning id;`
  );
  const overlayId = psql(`insert into student_curriculum_overlays (subject_enrollment_id) values ('${enrollmentId}') returning id;`);
  const unitId = psql(
    `insert into curriculum_overlay_units (overlay_id, position, unit_title) values ('${overlayId}', 1, '${RUN} 회차') returning id;`
  );
  psql(
    `insert into curriculum_overlay_unit_materials (overlay_unit_id, curriculum_doc_id, position, source)
     values ('${unitId}', '${docId}', 1, 'manual');`
  );
  psql(`insert into session_curriculum_units (session_id, overlay_unit_id, role) values ('${sessionId}', '${unitId}', 'primary');`);
  return { sessionId, unitId };
}
function startSession(sessionId: string, unitId: string) {
  psql(`insert into curriculum_unit_preps (overlay_unit_id) values ('${unitId}') on conflict do nothing;`);
  psql(`select link_unit_prep_to_session('${unitId}', '${sessionId}', '${TEACHER_ID}');`);
  psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
}
const manifestVersion = (sessionId: string) =>
  psql(`select coalesce(curriculum_doc_version_id::text, 'null') from session_content_manifest where session_id = '${sessionId}' and content_type = 'material_doc';`);
const pageStroke = (sessionId: string, docId: string, version: string, page: number, scope: "teacher_shared" | "student_shared", by: string) =>
  asUser(
    by,
    `select count(*) from append_page_stroke_events('${sessionId}', '${seg(uuid())}'::jsonb, '${scope}', '${docId}', '${version}', ${page});`
  );

beforeAll(() => {
  TEACHER_ID = createPerRunTeacher(psql, { emailPrefix: "pdf-tip-layer" });
});

// ------------------------------------------------------------ 권한 매트릭스
describe("팁 권한 매트릭스", () => {
  it("관리자만 쓰고, 관리자·담당 선생님만 읽는다. 학생·보호자·타 선생님·익명은 읽기/쓰기 모두 거절", () => {
    const doc = makeDoc();
    const v1 = publish(doc);
    const { sessionId } = makeSession(doc);
    void sessionId;

    // 관리자 쓰기 성공(eventId 필수).
    expect(addTip(v1, 1, seg(uuid()))).toBe("1");

    // 선생님 쓰기 거절, 읽기 성공(이 버전을 쓰는 수업의 담당).
    expect(asUserExpectError(TEACHER_ID, `select * from append_pdf_tip_events('${v1}', 1, '${seg(uuid())}'::jsonb);`)).toMatch(/관리자만/);
    expect(asUser(TEACHER_ID, tipCount(v1))).toBe("1");
    expect(asUser(ADMIN_ID, tipCount(v1))).toBe("1");

    // 학생·보호자·타 선생님: 읽기는 0행(RLS), 쓰기·가져오기는 거절.
    for (const who of [STUDENT_ID, PARENT_ID, OTHER_TEACHER_ID]) {
      expect(asUser(who, tipCount(v1))).toBe("0");
      expect(asUser(who, `select count(*) from pdf_tip_page_copies;`)).toBe("0");
      expect(asUserExpectError(who, `select * from append_pdf_tip_events('${v1}', 1, '${seg(uuid())}'::jsonb);`)).toMatch(/관리자만/);
      expect(asUserExpectError(who, `select copy_pdf_tips_from_version('${v1}', '${v1}', false);`)).toMatch(/관리자만/);
      expect(asUserExpectError(who, `insert into pdf_tip_events (curriculum_doc_version_id, page_number, event_type, payload, client_event_id, author_id)
        values ('${v1}', 1, 'stroke', '{}'::jsonb, gen_random_uuid(), '${who}');`)).toMatch(/permission denied|row-level/);
      expect(asUserExpectError(who, `delete from pdf_tip_events;`)).toMatch(/permission denied/);
    }
    // 선생님도 직접 insert/update/delete 불가.
    expect(asUserExpectError(TEACHER_ID, `delete from pdf_tip_events where curriculum_doc_version_id = '${v1}';`)).toMatch(/permission denied/);
    expect(asUserExpectError(TEACHER_ID, `update pdf_tip_events set payload = '{}'::jsonb where curriculum_doc_version_id = '${v1}';`)).toMatch(/permission denied/);
    // 익명.
    expect(asAnonExpectError(`select count(*) from pdf_tip_events;`)).toMatch(/permission denied/);
    expect(asAnonExpectError(`select * from append_pdf_tip_events('${v1}', 1, '${seg(uuid())}'::jsonb);`)).toMatch(/permission denied/);
    expect(asAnonExpectError(`select can_read_pdf_tips('${v1}');`)).toMatch(/permission denied/);
    // 정의자 내부 함수는 직접 부를 수 없다.
    expect(asUserExpectError(STUDENT_ID, `select pdf_tip_page_has_tips('${v1}', 1);`)).toMatch(/permission denied/);
  });

  it("이 버전을 쓰는 수업이 없는 선생님(담당이 아닌 자료)은 읽지 못한다", () => {
    const doc = makeDoc();
    const v1 = publish(doc);
    addTip(v1, 1, seg(uuid()));
    // 이 자료를 회차에 담은 수업이 없다.
    expect(asUser(TEACHER_ID, tipCount(v1))).toBe("0");
    makeSession(doc);
    expect(asUser(TEACHER_ID, tipCount(v1))).toBe("1");
  });
});

// ------------------------------------------------------------ 저장·중복
describe("팁 저장 — eventId 중복 방지와 검증", () => {
  it("같은 eventId 는 두 번 저장되지 않고, 없는 페이지·HTML 자료·eventId 없음은 거절한다", () => {
    const doc = makeDoc();
    const v1 = publish(doc);
    const id = uuid();
    expect(addTip(v1, 2, seg(id))).toBe("1");
    expect(addTip(v1, 2, seg(id))).toBe("0"); // 재시도
    expect(psql(tipCount(v1, 2))).toBe("1");
    expect(psql(`select payload ? 'eventId' from pdf_tip_events where curriculum_doc_version_id = '${v1}' limit 1;`)).toBe("f");

    expect(asUserExpectError(ADMIN_ID, `select * from append_pdf_tip_events('${v1}', 4, '${seg(uuid())}'::jsonb);`)).toMatch(/페이지 4/);
    expect(asUserExpectError(ADMIN_ID, `select * from append_pdf_tip_events('${v1}', 1, '[{"x0":1,"y0":2,"x1":3,"y1":4,"color":"#000","tool":"pen"}]'::jsonb);`)).toMatch(/eventId/);
    expect(asUserExpectError(ADMIN_ID, `select * from append_pdf_tip_events('${v1}', 1, '${textSeg(uuid()).replace('"팁 글"', '""')}'::jsonb);`)).toMatch(/글이 없습니다/);

    // 텍스트·전체 지우기도 같은 경로.
    expect(addTip(v1, 3, textSeg(uuid()))).toBe("1");
    expect(addTip(v1, 3, clearSeg(uuid()))).toBe("1");
    expect(psql(`select event_type from pdf_tip_events where curriculum_doc_version_id = '${v1}' and page_number = 3 order by seq desc limit 1;`)).toBe("clear_all");
    expect(psql(`select pdf_tip_page_has_tips('${v1}', 3);`)).toBe("f");
  });
});

// ------------------------------------------------------------ 버전 가져오기
describe("이전 버전에서 팁 가져오기 — 검토 전 상태", () => {
  const pending = (v: string) =>
    asUser(ADMIN_ID, `select coalesce(string_agg(page_number::text, ',' order by page_number), '') from pdf_tip_page_copies where curriculum_doc_version_id = '${v}' and needs_review;`);

  it("같은 쪽수에 복사하고, 재실행해도 중복·되돌림이 없다(멱등). 새 버전은 빈 채로 시작한다", () => {
    const doc = makeDoc();
    const v1 = publish(doc, { pageCount: 3 });
    addTip(v1, 1, seg(uuid()));
    addTip(v1, 1, seg(uuid(), 9));
    addTip(v1, 3, textSeg(uuid()));
    const v2 = publish(doc, { pageCount: 3 });
    expect(v2).not.toBe(v1);
    expect(psql(tipCount(v2))).toBe("0"); // 자동 이전 없음

    const r1 = JSON.parse(asUser(ADMIN_ID, `select copy_pdf_tips_from_version('${v1}', '${v2}', false);`));
    expect(r1).toMatchObject({ status: "done", copied: [1, 3], skipped: [], conflicts: [], dropped: [], pageCountChanged: false });
    expect(psql(tipCount(v2, 1))).toBe("2");
    expect(psql(tipCount(v2, 3))).toBe("1");
    expect(pending(v2)).toBe("1,3");

    const r2 = JSON.parse(asUser(ADMIN_ID, `select copy_pdf_tips_from_version('${v1}', '${v2}', false);`));
    expect(r2).toMatchObject({ status: "done", copied: [], skipped: [1, 3] });
    const r3 = JSON.parse(asUser(ADMIN_ID, `select copy_pdf_tips_from_version('${v1}', '${v2}', true);`));
    expect(r3).toMatchObject({ copied: [], skipped: [1, 3] });
    expect(psql(tipCount(v2))).toBe("3");
    expect(psql(tipCount(v1))).toBe("3"); // 원본 그대로
  });

  it("불러온 팁은 확인 전에는 선생님 읽기에서 제외되고, 쪽별 확인·전체 확인 뒤에 보인다(관리자는 항상 본다)", () => {
    const doc = makeDoc();
    const v1 = publish(doc, { pageCount: 3 });
    addTip(v1, 1, seg(uuid()));
    addTip(v1, 2, seg(uuid()));
    addTip(v1, 3, seg(uuid()));
    const v2 = publish(doc, { pageCount: 3 });
    makeSession(doc); // 담당 선생님이 v2 를 쓰는 수업이 있다(구성은 담을 때의 공개본).
    // 위 makeSession 은 v2(최신 공개본)를 구성에 담는다.
    asUser(ADMIN_ID, `select copy_pdf_tips_from_version('${v1}', '${v2}', false);`);

    // 선생님: 검토 전 쪽 제외(0). 관리자: 전부(3). 직접 나열도 마찬가지.
    expect(asUser(TEACHER_ID, tipCount(v2))).toBe("0");
    expect(asUser(ADMIN_ID, tipCount(v2))).toBe("3");
    // 원본(v1) 팁은 v2 만 쓰는 선생님에게 애초에 보이지 않는다.
    expect(asUser(TEACHER_ID, tipCount(v1))).toBe("0");

    // 쪽별 확인 → 그 쪽만 공개.
    asUser(ADMIN_ID, `select mark_pdf_tip_page_reviewed('${v2}', 1);`);
    expect(asUser(TEACHER_ID, tipCount(v2, 1))).toBe("1");
    expect(asUser(TEACHER_ID, tipCount(v2))).toBe("1");
    expect(pending(v2)).toBe("2,3");

    // 고치면 확인 처리: 2쪽에 관리자가 새로 쓰면 그 쪽이 공개된다.
    addTip(v2, 2, seg(uuid(), 55));
    expect(pending(v2)).toBe("3");
    expect(asUser(TEACHER_ID, tipCount(v2, 2))).toBe("2");

    // 전체 확인 → 남은 쪽 전부 공개, 반환값은 확인한 쪽 수.
    expect(asUser(ADMIN_ID, `select mark_pdf_tip_version_reviewed('${v2}');`)).toBe("1");
    expect(asUser(TEACHER_ID, tipCount(v2))).toBe("4");
    expect(asUser(ADMIN_ID, `select mark_pdf_tip_version_reviewed('${v2}');`)).toBe("0"); // 멱등
    expect(pending(v2)).toBe("");

    // 권한: 선생님·학생은 확인 처리할 수 없다.
    for (const who of [TEACHER_ID, STUDENT_ID, PARENT_ID]) {
      expect(asUserExpectError(who, `select mark_pdf_tip_version_reviewed('${v2}');`)).toMatch(/관리자만/);
      expect(asUserExpectError(who, `select pdf_tip_review_state('${v2}');`)).toMatch(/관리자만/);
    }
  });

  it("대상에 이미 팁이 있는 쪽은 확인 전에는 아무것도 바꾸지 않고, 확인하면 덮어쓴다(덮어쓴 쪽도 검토 전)", () => {
    const doc = makeDoc();
    const v1 = publish(doc, { pageCount: 3 });
    addTip(v1, 1, seg(uuid()));
    addTip(v1, 2, seg(uuid()));
    const v2 = publish(doc, { pageCount: 3 });
    addTip(v2, 2, seg(uuid(), 77)); // 대상 2쪽에 이미 팁

    const need = JSON.parse(asUser(ADMIN_ID, `select copy_pdf_tips_from_version('${v1}', '${v2}', false);`));
    expect(need).toMatchObject({ status: "needs_confirmation", conflicts: [2], copied: [] });
    expect(psql(tipCount(v2))).toBe("1"); // 1쪽도 복사하지 않았다(전부 또는 없음)
    expect(pending(v2)).toBe("");

    const done = JSON.parse(asUser(ADMIN_ID, `select copy_pdf_tips_from_version('${v1}', '${v2}', true);`));
    expect(done).toMatchObject({ status: "done", copied: [1, 2], conflicts: [2] });
    expect(pending(v2)).toBe("1,2");
    expect(psql(`select pdf_tip_page_has_tips('${v2}', 2);`)).toBe("t");
    expect(
      psql(`select count(*) from pdf_tip_events e where curriculum_doc_version_id = '${v2}' and page_number = 2 and event_type = 'stroke'
            and seq > (select max(seq) from pdf_tip_events where curriculum_doc_version_id = '${v2}' and page_number = 2 and event_type = 'clear_all');`)
    ).toBe("1");
    const again = JSON.parse(asUser(ADMIN_ID, `select copy_pdf_tips_from_version('${v1}', '${v2}', true);`));
    expect(again.copied).toEqual([]);
  });

  it("쪽수가 달라지면 경고 플래그·쪽수를 돌려주고, 새 버전에 없는 쪽은 버린다", () => {
    const doc = makeDoc();
    const v1 = publish(doc, { pageCount: 4 });
    addTip(v1, 1, seg(uuid()));
    addTip(v1, 4, seg(uuid()));
    const v2 = publish(doc, { pageCount: 3 });

    const r = JSON.parse(asUser(ADMIN_ID, `select copy_pdf_tips_from_version('${v1}', '${v2}', false);`));
    expect(r).toMatchObject({ copied: [1], dropped: [4], pageCountChanged: true, fromPageCount: 4, toPageCount: 3 });
    const state = JSON.parse(asUser(ADMIN_ID, `select pdf_tip_review_state('${v2}');`));
    expect(state).toMatchObject({ pendingPages: [1], tipPages: [1], copiedFromVersionId: v1, fromPageCount: 4, toPageCount: 3 });
    // 쪽수가 같은 경우의 상태도 그대로 읽힌다.
    const same = publish(makeDoc(), { pageCount: 2 });
    expect(JSON.parse(asUser(ADMIN_ID, `select pdf_tip_review_state('${same}');`))).toMatchObject({ pendingPages: [], tipPages: [], copiedFromVersionId: null, fromPageCount: null, toPageCount: 2 });
  });

  it("다른 자료의 버전끼리는 가져오지 못한다", () => {
    const a = publish(makeDoc());
    const b = publish(makeDoc());
    expect(asUserExpectError(ADMIN_ID, `select copy_pdf_tips_from_version('${a}', '${b}', false);`)).toMatch(/같은 자료/);
  });
});

// ------------------------------------------------------------ 쪽 매핑·같은 버전 안 복사/이동
describe("팁 가져오기 — 쪽 매핑 수동 조정", () => {
  const map = (from: string, to: string, mapping: unknown, overwrite = false) =>
    JSON.parse(asUser(ADMIN_ID, `select copy_pdf_tips_mapped('${from}', '${to}', '${JSON.stringify(mapping)}'::jsonb, ${overwrite});`));
  const strokeXs = (v: string, page: number) =>
    psql(`select coalesce(string_agg(payload->>'x0', ',' order by seq), '') from pdf_tip_events e where curriculum_doc_version_id = '${v}' and page_number = ${page}
          and event_type = 'stroke' and seq > coalesce((select max(seq) from pdf_tip_events where curriculum_doc_version_id = '${v}' and page_number = ${page} and event_type = 'clear_all'), 0);`);
  const setup = (fromPages = 4, toPages = 5) => {
    const doc = makeDoc();
    const v1 = publish(doc, { pageCount: fromPages });
    for (let p = 1; p <= fromPages; p++) addTip(v1, p, seg(uuid(), p * 10)); // x0 = 10,20,30,40
    const v2 = publish(doc, { pageCount: toPages });
    return { doc, v1, v2 };
  };

  it("+1 밀기(삽입 반영): 2쪽 뒤가 한 쪽씩 밀려 들어간다", () => {
    const { v1, v2 } = setup();
    const r = map(v1, v2, [{ from: 1, to: 1 }, { from: 2, to: 3 }, { from: 3, to: 4 }, { from: 4, to: 5 }]);
    expect(r).toMatchObject({ status: "done", copied: [1, 3, 4, 5], skipped: [], conflicts: [], pageCountChanged: true, fromPageCount: 4, toPageCount: 5 });
    expect([1, 2, 3, 4, 5].map((p) => strokeXs(v2, p))).toEqual(["10", "", "20", "30", "40"]);
    // 모두 검토 전 — 선생님에게 숨겨진다(관리자만 본다).
    expect(asUser(ADMIN_ID, `select pdf_tip_review_state('${v2}')->'pendingPages';`)).toBe("[1, 3, 4, 5]");
  });

  it("-1 밀기(삭제 반영)와 건너뛰기(to=null)", () => {
    const { v1, v2 } = setup(4, 3);
    const r = map(v1, v2, [{ from: 1, to: 1 }, { from: 2, to: null }, { from: 3, to: 2 }, { from: 4, to: 3 }]);
    expect(r).toMatchObject({ copied: [1, 2, 3], pageCountChanged: true });
    expect([1, 2, 3].map((p) => strokeXs(v2, p))).toEqual(["10", "30", "40"]);
  });

  it("두 페이지 맞바꾸기와 순서가 바뀐 매핑", () => {
    const { v1, v2 } = setup(3, 3);
    map(v1, v2, [{ from: 1, to: 3 }, { from: 2, to: 2 }, { from: 3, to: 1 }]);
    expect([1, 2, 3].map((p) => strokeXs(v2, p))).toEqual(["30", "20", "10"]);
  });

  it("같은 대상 쪽으로 중복 매핑하면 아무것도 쓰기 전에 막는다. 범위 밖·같은 옛 쪽 중복도 막는다", () => {
    const { v1, v2 } = setup(3, 3);
    expect(asUserExpectError(ADMIN_ID, `select copy_pdf_tips_mapped('${v1}', '${v2}', '[{"from":1,"to":2},{"from":2,"to":2}]'::jsonb, false);`)).toMatch(/같은 대상 쪽\(2쪽\)/);
    expect(asUserExpectError(ADMIN_ID, `select copy_pdf_tips_mapped('${v1}', '${v2}', '[{"from":1,"to":9}]'::jsonb, false);`)).toMatch(/새 버전\(3쪽\)에 없는/);
    expect(asUserExpectError(ADMIN_ID, `select copy_pdf_tips_mapped('${v1}', '${v2}', '[{"from":7,"to":1}]'::jsonb, false);`)).toMatch(/옛 버전\(3쪽\)에 없는/);
    expect(asUserExpectError(ADMIN_ID, `select copy_pdf_tips_mapped('${v1}', '${v2}', '[{"from":1,"to":1},{"from":1,"to":2}]'::jsonb, false);`)).toMatch(/같은 옛 쪽/);
    expect(psql(tipCount(v2))).toBe("0");
  });

  it("대상에 팁이 있으면 확인 전에는 전혀 쓰지 않고(다른 쪽도), 확인하면 덮어쓴다. 재실행은 멱등", () => {
    const { v1, v2 } = setup(3, 3);
    addTip(v2, 2, seg(uuid(), 99));
    const mapping = [{ from: 1, to: 1 }, { from: 3, to: 2 }];
    const need = map(v1, v2, mapping);
    expect(need).toMatchObject({ status: "needs_confirmation", conflicts: [2], copied: [] });
    expect(psql(tipCount(v2))).toBe("1");

    const done = map(v1, v2, mapping, true);
    expect(done).toMatchObject({ status: "done", copied: [1, 2], conflicts: [2] });
    expect(strokeXs(v2, 2)).toBe("30"); // 99 는 지워지고 옛 3쪽이 들어왔다
    const total = psql(tipCount(v2));
    // 재실행(확인 여부 무관)은 같은 (원본 쪽 → 대상 쪽)을 건너뛰고 아무것도 더하지 않는다.
    expect(map(v1, v2, mapping, true)).toMatchObject({ copied: [], skipped: [1, 2] });
    expect(map(v1, v2, mapping, false)).toMatchObject({ status: "done", copied: [], skipped: [1, 2] });
    expect(psql(tipCount(v2))).toBe(total);
    // 매핑을 바꿔 다시 실행하면(옛 2쪽 → 대상 3쪽) 그것만 더해진다.
    expect(map(v1, v2, [...mapping, { from: 2, to: 3 }])).toMatchObject({ copied: [3], skipped: [1, 2] });
  });

  it("옛 쪽에 팁이 없으면 그 행은 무시하고, 관리자만 실행할 수 있다", () => {
    const { doc, v1 } = setup(3, 3);
    const empty = publish(doc, { pageCount: 3 });
    const v3 = publish(doc, { pageCount: 3 });
    expect(map(empty, v3, [{ from: 1, to: 1 }])).toMatchObject({ status: "done", copied: [] });
    for (const who of [TEACHER_ID, STUDENT_ID, PARENT_ID, OTHER_TEACHER_ID]) {
      expect(asUserExpectError(who, `select copy_pdf_tips_mapped('${v1}', '${v3}', '[{"from":1,"to":1}]'::jsonb, false);`)).toMatch(/관리자만/);
    }
    expect(asAnonExpectError(`select copy_pdf_tips_mapped('${v1}', '${v3}', '[]'::jsonb, false);`)).toMatch(/permission denied/);
  });
});

describe("같은 버전 안에서 팁 복사·이동", () => {
  const moveRpc = (v: string, from: number, to: number, move: boolean, overwrite = false) =>
    JSON.parse(asUser(ADMIN_ID, `select copy_pdf_tip_page('${v}', ${from}, ${to}, ${move}, ${overwrite});`));
  const xs = (v: string, page: number) =>
    psql(`select coalesce(string_agg(payload->>'x0', ',' order by seq), '') from pdf_tip_events where curriculum_doc_version_id = '${v}' and page_number = ${page}
          and event_type = 'stroke' and seq > coalesce((select max(seq) from pdf_tip_events where curriculum_doc_version_id = '${v}' and page_number = ${page} and event_type = 'clear_all'), 0);`);

  it("복사는 원본을 남기고, 이동은 원본을 지운다. 충돌 시 확인 후 덮어쓴다", () => {
    const v = publish(makeDoc(), { pageCount: 3 });
    addTip(v, 1, seg(uuid(), 11));
    addTip(v, 3, seg(uuid(), 33));

    expect(moveRpc(v, 1, 2, false)).toMatchObject({ status: "done", moved: false });
    expect([xs(v, 1), xs(v, 2)]).toEqual(["11", "11"]);

    expect(moveRpc(v, 3, 2, true)).toMatchObject({ status: "needs_confirmation", conflicts: [2] });
    expect([xs(v, 2), xs(v, 3)]).toEqual(["11", "33"]); // 확인 전에는 그대로
    expect(moveRpc(v, 3, 2, true, true)).toMatchObject({ status: "done", moved: true });
    expect([xs(v, 2), xs(v, 3)]).toEqual(["33", ""]);
    expect(moveRpc(v, 3, 1, false)).toMatchObject({ status: "empty" }); // 원본에 팁이 없다
  });

  it("범위 밖·같은 쪽은 거절하고, 관리자만 할 수 있다. 검토 전 쪽을 옮기면 확인 처리된다", () => {
    const doc = makeDoc();
    const v1 = publish(doc, { pageCount: 3 });
    addTip(v1, 1, seg(uuid(), 5));
    const v2 = publish(doc, { pageCount: 3 });
    asUser(ADMIN_ID, `select copy_pdf_tips_from_version('${v1}', '${v2}', false);`);
    expect(asUser(ADMIN_ID, `select pdf_tip_review_state('${v2}')->'pendingPages';`)).toBe("[1]");
    expect(moveRpc(v2, 1, 2, true)).toMatchObject({ status: "done" });
    expect(asUser(ADMIN_ID, `select pdf_tip_review_state('${v2}')->'pendingPages';`)).toBe("[]");

    expect(asUserExpectError(ADMIN_ID, `select copy_pdf_tip_page('${v2}', 1, 9, false, false);`)).toMatch(/없는 쪽/);
    expect(asUserExpectError(ADMIN_ID, `select copy_pdf_tip_page('${v2}', 2, 2, false, false);`)).toMatch(/같은 쪽/);
    for (const who of [TEACHER_ID, STUDENT_ID, PARENT_ID, OTHER_TEACHER_ID]) {
      expect(asUserExpectError(who, `select copy_pdf_tip_page('${v2}', 2, 1, false, false);`)).toMatch(/관리자만/);
    }
  });
});

// ------------------------------------------------------------ 교재가 바뀔 때 (총괄 확인 요청 1~4)
describe("교재 변경 시 동작 — 새 공개 버전·보관·시작 전 pin·팁 비동결", () => {
  it("(1) 새 공개 버전이 생겨도 시작한 과거 수업은 옛 버전·옛 필기·옛 팁을 그대로 연다, 새 버전은 빈 채로 시작한다", () => {
    const doc = makeDoc();
    const v1 = publish(doc);
    const { sessionId, unitId } = makeSession(doc);
    expect(psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`)).toBe("0"); // 시작 전에는 고정 없음
    startSession(sessionId, unitId);
    expect(manifestVersion(sessionId)).toBe(v1);

    pageStroke(sessionId, doc, v1, 1, "teacher_shared", TEACHER_ID);
    pageStroke(sessionId, doc, v1, 1, "student_shared", STUDENT_ID);
    addTip(v1, 1, seg(uuid()));

    const v2 = publish(doc, { path: `${RUN}/v2-${uniq()}.pdf` });
    expect(v2).not.toBe(v1);

    // 고정은 v1 그대로, v1 의 사본 참조도 그대로(서명 URL 의 근거).
    expect(manifestVersion(sessionId)).toBe(v1);
    expect(psql(`select snapshot->'asset'->>'path' from curriculum_doc_versions where id = '${v1}';`)).toMatch(new RegExp(`^${RUN}/`));
    // 교사·학생 필기(v1)는 그대로 읽힌다.
    const annotations = (who: string, version: string) =>
      asUser(who, `select count(*) from session_annotation_events where session_id = '${sessionId}' and curriculum_doc_version_id = '${version}' and page_number = 1;`);
    expect(annotations(TEACHER_ID, v1)).toBe("2");
    expect(annotations(STUDENT_ID, v1)).toBe("2");
    // 새 버전에는 필기도 팁도 없다.
    expect(annotations(TEACHER_ID, v2)).toBe("0");
    expect(psql(tipCount(v2))).toBe("0");
    // 옛 버전 팁: 선생님은 읽고, 학생은 못 읽는다.
    expect(asUser(TEACHER_ID, tipCount(v1))).toBe("1");
    expect(asUser(STUDENT_ID, tipCount(v1))).toBe("0");
    // 수업이 쓰지 않는 새 버전의 팁은 이 선생님에게 보이지 않는다(자동 이전 없음).
    addTip(v2, 1, seg(uuid()));
    expect(asUser(TEACHER_ID, tipCount(v2))).toBe("0");
  });

  it("(2) 자료를 보관해도 과거 수업은 옛 고정 사본을 열 수 있고 팁·필기도 조회된다", () => {
    const doc = makeDoc();
    const v1 = publish(doc);
    const { sessionId, unitId } = makeSession(doc);
    startSession(sessionId, unitId);
    pageStroke(sessionId, doc, v1, 2, "teacher_shared", TEACHER_ID);
    addTip(v1, 2, seg(uuid()));

    psql(`update curriculum_docs set archived_at = now(), archived_reason = '${RUN}' where id = '${doc}';`);

    expect(manifestVersion(sessionId)).toBe(v1);
    // 화면(getAssetVersionUrlAction)이 읽는 것과 같은 조회: 학생·선생님 권한으로 버전 행(사본 참조)이 읽힌다.
    for (const who of [STUDENT_ID, TEACHER_ID]) {
      expect(asUser(who, `select snapshot->'asset'->>'bucket' from curriculum_doc_versions where id = '${v1}';`)).toBe("curriculum-assets");
    }
    expect(asUser(TEACHER_ID, `select count(*) from session_annotation_events where session_id = '${sessionId}' and curriculum_doc_version_id = '${v1}';`)).toBe("1");
    expect(asUser(TEACHER_ID, tipCount(v1))).toBe("1");
    expect(asUser(STUDENT_ID, tipCount(v1))).toBe("0");
    // 보관 해제 후에도 그대로.
    psql(`update curriculum_docs set archived_at = null, archived_reason = null where id = '${doc}';`);
    expect(asUser(TEACHER_ID, tipCount(v1))).toBe("1");
  });

  it("(3) 시작 전 수업은 회차 구성에 담을 때의 버전을 들고 있고, 그 뒤 새 버전이 공개돼도 바뀌지 않으며, 시작할 때 그 버전이 고정된다", () => {
    const doc = makeDoc();
    const v1 = publish(doc);
    const { sessionId, unitId } = makeSession(doc);
    // 담을 때(insert) 그 시점 공개본이 채워진다.
    expect(psql(`select curriculum_doc_version_id from curriculum_overlay_unit_materials where overlay_unit_id = '${unitId}';`)).toBe(v1);
    addTip(v1, 1, seg(uuid()));

    const v2 = publish(doc, { path: `${RUN}/v2-${uniq()}.pdf` });
    addTip(v2, 1, seg(uuid()));
    // 새 버전이 공개돼도 구성은 v1 그대로 — 준비 화면이 보던 것이 바뀌지 않는다.
    expect(psql(`select curriculum_doc_version_id from curriculum_overlay_unit_materials where overlay_unit_id = '${unitId}';`)).toBe(v1);
    expect(asUser(TEACHER_ID, tipCount(v1))).toBe("1");
    expect(asUser(TEACHER_ID, tipCount(v2))).toBe("0");
    // 고정(매니페스트)은 시작 때 만들어지고, 그 버전은 구성이 들고 있던 v1 이다.
    expect(psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`)).toBe("0");
    startSession(sessionId, unitId);
    expect(manifestVersion(sessionId)).toBe(v1);
    // 시작 뒤에 또 새 버전이 공개돼도 그대로.
    publish(doc, { path: `${RUN}/v3-${uniq()}.pdf` });
    expect(manifestVersion(sessionId)).toBe(v1);
  });

  it("(4) 팁은 수업별로 얼리지 않는다 — 관리자가 옛 버전 팁을 고치면 과거 수업에도 고쳐진 팁이 보인다", () => {
    const doc = makeDoc();
    const v1 = publish(doc);
    const { sessionId, unitId } = makeSession(doc);
    startSession(sessionId, unitId);
    addTip(v1, 1, textSeg(uuid()));
    expect(asUser(TEACHER_ID, `select count(*) from pdf_tip_events where curriculum_doc_version_id = '${v1}' and event_type = 'stroke';`)).toBe("1");

    publish(doc, { path: `${RUN}/v2-${uniq()}.pdf` });
    // 나중에 관리자가 옛 버전 팁을 고친다(전체 지우기 + 새 획).
    addTip(v1, 1, clearSeg(uuid()));
    addTip(v1, 1, seg(uuid(), 42));
    // 과거 수업의 선생님은 고쳐진 팁을 본다(마지막 지우기 이후의 획).
    expect(
      asUser(
        TEACHER_ID,
        `select payload->>'x0' from pdf_tip_events where curriculum_doc_version_id = '${v1}' and page_number = 1 and event_type = 'stroke'
         and seq > (select max(seq) from pdf_tip_events where curriculum_doc_version_id = '${v1}' and page_number = 1 and event_type = 'clear_all') order by seq;`
      )
    ).toBe("42");
    // 필기(수업 귀속)와 달리 팁에는 수업 id 가 없다.
    expect(psql(`select count(*) from information_schema.columns where table_name = 'pdf_tip_events' and column_name = 'session_id';`)).toBe("0");
  });
});
