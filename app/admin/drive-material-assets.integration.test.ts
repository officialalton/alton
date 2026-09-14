import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

// P2 13차 — Drive 기반 PDF·영상 자료의 DB 규칙(20261348000000).
//   키워드 → 단원 하나 / 폴더 큐 / 파일 자료 공개는 고정 사본이 있어야 / 페이지 필기 검증

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const OTHER_TEACHER_ID = "dddddddd-0000-0000-0000-000000000002";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const OTHER_SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000002";

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

const uniq = () => `${Date.now()}_${Math.random()}`;

const cleanupDocIds: string[] = [];
const cleanupKeywordIds: string[] = [];
const cleanupUnitIds: string[] = [];
const cleanupContractIds: string[] = [];
// 필기를 남긴 수업은 정리되지 않고 남으므로(위 관례), 실행마다 다른 날짜 대역을 쓴다 —
// 같은 대역을 다시 쓰면 reservations_no_overlap 에 걸린다.
let reservationOffsetDays = 9000 + Math.floor(Math.random() * 40000);

afterEach(() => {
  // session_annotation_events 는 어떤 역할로도 지울 수 없다(append-only, 20261239000000).
  // 필기를 남긴 수업·자료는 여기서 정리하지 않고 `supabase db reset --local` 에 맡긴다
  // (session-annotation-events.integration.test.ts 와 같은 관례). 그런 픽스처는
  // keep 으로 만들어 정리 목록에 넣지 않는다.
  for (const id of cleanupContractIds.splice(0)) {
    psql(`
      delete from session_content_manifest where session_id in (select id from sessions where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}'));
      delete from session_curriculum_units where session_id in (select id from sessions where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}'));
      delete from sessions where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from reservations where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from subject_threads where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from teacher_assignments where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from subject_enrollments where contract_id = '${id}';
      delete from contracts where id = '${id}';
    `);
  }
  for (const id of cleanupDocIds.splice(0)) psql(`delete from curriculum_docs where id = '${id}';`);
  for (const id of cleanupKeywordIds.splice(0)) psql(`delete from subject_keywords where id = '${id}';`);
  for (const id of cleanupUnitIds.splice(0)) psql(`delete from subject_template_units where id = '${id}';`);
});

function makeUnit(subjectId = SUBJECT_ID): string {
  const id = psql(
    `insert into subject_template_units (subject_id, position, unit_title)
     values ('${subjectId}', ${500 + Math.floor(Math.random() * 400)}, '단원 ${uniq()}') returning id;`
  );
  cleanupUnitIds.push(id);
  return id;
}

function makeAssetDoc(kind: "pdf" | "video", driveFileId = `drive_${uniq()}`, keep = false): string {
  const id = asUser(
    ADMIN_ID,
    `insert into curriculum_docs (title, subject_id, owner_type, status, kind, source_drive_file_id, source_mime_type)
     values ('자료 ${uniq()}', '${SUBJECT_ID}', 'admin', 'draft', '${kind}', '${driveFileId}',
             '${kind === "pdf" ? "application/pdf" : "video/mp4"}') returning id;`
  );
  if (!keep) cleanupDocIds.push(id);
  return id;
}

const asset = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    bucket: "curriculum-assets",
    path: "x/y.pdf",
    bytes: 1234,
    sha256: "a".repeat(64),
    mimeType: "application/pdf",
    pageCount: 2,
    ...over,
  }).replace(/'/g, "''");

// ------------------------------------------------------------ 폴더 큐 (과목 → 키워드)
describe("Drive 폴더 큐 — 과목 → 키워드, 단원은 폴더를 만들지 않는다", () => {
  it("키워드가 생기면 pending, 이름을 바꾸면 만든 폴더만 rename_pending", () => {
    const kw = psql(`insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', 'kw ${uniq()}') returning id;`);
    cleanupKeywordIds.push(kw);
    expect(psql(`select sync_status from curriculum_drive_folders where scope = 'keyword' and ref_id = '${kw}';`)).toBe("pending");

    psql(`update curriculum_drive_folders set drive_folder_id = 'f_${uniq()}', sync_status = 'created', applied_name = desired_name where scope = 'keyword' and ref_id = '${kw}';`);
    psql(`update subject_keywords set label = '새 이름 ${uniq()}' where id = '${kw}';`);
    expect(psql(`select sync_status from curriculum_drive_folders where scope = 'keyword' and ref_id = '${kw}';`)).toBe("rename_pending");
  });

  it("단원을 만들어도 폴더 큐에 들지 않고, 예전 단원 행은 retired 로 남아 있다", () => {
    const unitId = makeUnit();
    expect(psql(`select count(*) from curriculum_drive_folders where scope = 'unit' and ref_id = '${unitId}';`)).toBe("0");
    expect(psql(`select count(*) from curriculum_drive_folders where scope = 'unit' and sync_status <> 'retired';`)).toBe("0");
  });

  it("키워드는 같은 과목의 여러 단원에 연결될 수 있다(N:M 그대로)", () => {
    const kw = psql(`insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', 'kw ${uniq()}') returning id;`);
    cleanupKeywordIds.push(kw);
    const u1 = makeUnit(); const u2 = makeUnit();
    psql(`insert into subject_template_unit_keywords (unit_id, keyword_id) values ('${u1}', '${kw}'), ('${u2}', '${kw}');`);
    expect(psql(`select count(*) from subject_template_unit_keywords where keyword_id = '${kw}';`)).toBe("2");
  });

  it("선생님은 큐를 볼 수 없다(관리자 전용)", () => {
    expect(asUser(TEACHER_ID, `select count(*) from curriculum_drive_folders;`)).toBe("0");
  });
});

// ------------------------------------------------------------ 공개
describe("파일 자료의 공개는 고정 사본이 있어야 한다", () => {
  it("HTML 공개 경로로는 공개되지 않는다", () => {
    const doc = makeAssetDoc("pdf");
    const err = asUserExpectError(ADMIN_ID, `select publish_curriculum_doc('${doc}', true);`);
    expect(err).toMatch(/고정 사본/);
    expect(psql(`select status from curriculum_docs where id = '${doc}';`)).toBe("draft");
  });

  it("사본 참조가 온전하면 버전 행과 공개 상태가 함께 생기고, 같은 내용은 새 버전을 만들지 않는다", () => {
    const doc = makeAssetDoc("pdf");
    const v1 = asUser(ADMIN_ID, `select publish_curriculum_asset_doc('${doc}', '${asset()}'::jsonb);`);
    expect(psql(`select status from curriculum_docs where id = '${doc}';`)).toBe("published");
    expect(
      psql(`select snapshot->>'kind' || ':' || (snapshot->'asset'->>'pageCount') from curriculum_doc_versions where id = '${v1}';`)
    ).toBe("pdf:2");

    const again = asUser(ADMIN_ID, `select publish_curriculum_asset_doc('${doc}', '${asset()}'::jsonb);`);
    expect(again).toBe(v1);

    const v2 = asUser(
      ADMIN_ID,
      `select publish_curriculum_asset_doc('${doc}', '${asset({ sha256: "b".repeat(64), pageCount: 3 })}'::jsonb);`
    );
    expect(v2).not.toBe(v1);
    expect(psql(`select count(*) from curriculum_doc_versions where curriculum_doc_id = '${doc}';`)).toBe("2");
    // 과거 버전은 그대로다.
    expect(psql(`select snapshot->'asset'->>'pageCount' from curriculum_doc_versions where id = '${v1}';`)).toBe("2");
  });

  it("참조가 비었거나 PDF 페이지 수가 없으면 공개되지 않는다", () => {
    const doc = makeAssetDoc("pdf");
    expect(asUserExpectError(ADMIN_ID, `select publish_curriculum_asset_doc('${doc}', '${asset({ sha256: "" })}'::jsonb);`)).toMatch(/온전하지/);
    expect(asUserExpectError(ADMIN_ID, `select publish_curriculum_asset_doc('${doc}', '${asset({ pageCount: 0 })}'::jsonb);`)).toMatch(/페이지 수/);
    expect(psql(`select status from curriculum_docs where id = '${doc}';`)).toBe("draft");
    expect(psql(`select count(*) from curriculum_doc_versions where curriculum_doc_id = '${doc}';`)).toBe("0");
  });

  it("선생님은 공개할 수 없다", () => {
    const doc = makeAssetDoc("pdf");
    expect(asUserExpectError(TEACHER_ID, `select publish_curriculum_asset_doc('${doc}', '${asset()}'::jsonb);`)).toMatch(/관리자|row-level|policy/);
  });

  it("같은 Drive 파일은 두 번 등록되지 않는다", () => {
    const fileId = `drive_${uniq()}`;
    makeAssetDoc("pdf", fileId);
    const err = psqlExpectError(
      `insert into curriculum_docs (title, subject_id, owner_type, status, kind, source_drive_file_id)
       values ('중복', '${SUBJECT_ID}', 'admin', 'draft', 'pdf', '${fileId}');`
    );
    expect(err).toMatch(/duplicate key|unique/i);
  });
});

// ------------------------------------------------------------ 페이지 필기
function makeSessionWithPlannedDoc(docId: string, keep = false) {
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${HOUSEHOLD_ID}', '${STUDENT_ID}', 'draft') returning id;`
  );
  if (!keep) cleanupContractIds.push(contractId);
  const enrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${STUDENT_ID}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
  );
  psql(
    `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from)
     values ('${enrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day');`
  );
  reservationOffsetDays += 2;
  const reservationId = psql(
    `insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
     values ('lesson', '${enrollmentId}', '${TEACHER_ID}', now() + interval '${reservationOffsetDays} days', now() + interval '${reservationOffsetDays} days 1 hour', 'confirmed') returning id;`
  );
  const sessionId = psql(
    `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes)
     values ('${reservationId}', '${enrollmentId}', '${TEACHER_ID}', (select id from lesson_types where code = 'regular'), 60) returning id;`
  );
  const overlayId = psql(
    `insert into student_curriculum_overlays (subject_enrollment_id) values ('${enrollmentId}') returning id;`
  );
  const unitId = psql(
    `insert into curriculum_overlay_units (overlay_id, position, unit_title) values ('${overlayId}', 1, '회차') returning id;`
  );
  psql(`insert into curriculum_overlay_unit_materials (overlay_unit_id, curriculum_doc_id, position, source) values ('${unitId}', '${docId}', 1, 'manual');`);
  psql(`insert into session_curriculum_units (session_id, overlay_unit_id, role) values ('${sessionId}', '${unitId}', 'primary');`);
  return { sessionId };
}

const seg = (eventId?: string) =>
  JSON.stringify([{ x0: 1, y0: 2, x1: 3, y1: 4, color: "#000", tool: "pen", ...(eventId ? { eventId } : {}) }]);

describe("PDF 페이지 필기 — 서버가 대상을 검증한다", () => {
  it("범위 안 페이지에 저장되고, 같은 eventId 는 두 번 저장되지 않는다", () => {
    const doc = makeAssetDoc("pdf", undefined, true);
    const v = asUser(ADMIN_ID, `select publish_curriculum_asset_doc('${doc}', '${asset()}'::jsonb);`);
    const { sessionId } = makeSessionWithPlannedDoc(doc, true);
    const eventId = psql(`select gen_random_uuid();`);

    const first = asUser(
      TEACHER_ID,
      `select count(*) from append_page_stroke_events('${sessionId}', '${seg(eventId)}'::jsonb, 'teacher_shared', '${doc}', '${v}', 2);`
    );
    expect(first).toBe("1");
    const retry = asUser(
      TEACHER_ID,
      `select count(*) from append_page_stroke_events('${sessionId}', '${seg(eventId)}'::jsonb, 'teacher_shared', '${doc}', '${v}', 2);`
    );
    expect(retry).toBe("0");
    expect(
      psql(`select count(*) || ':' || min(page_number) || ':' || bool_and(payload ? 'eventId' = false)
            from session_annotation_events where session_id = '${sessionId}';`)
    ).toBe("1:2:true");
  });

  it("없는 페이지·다른 자료의 버전·HTML 자료는 거절한다", () => {
    const doc = makeAssetDoc("pdf", undefined, true);
    const v = asUser(ADMIN_ID, `select publish_curriculum_asset_doc('${doc}', '${asset()}'::jsonb);`);
    const { sessionId } = makeSessionWithPlannedDoc(doc, true);

    expect(
      asUserExpectError(TEACHER_ID, `select append_page_stroke_events('${sessionId}', '${seg()}'::jsonb, 'teacher_shared', '${doc}', '${v}', 3);`)
    ).toMatch(/페이지 3/);

    const other = makeAssetDoc("pdf", undefined, true);
    expect(
      asUserExpectError(TEACHER_ID, `select append_page_stroke_events('${sessionId}', '${seg()}'::jsonb, 'teacher_shared', '${other}', '${v}', 1);`)
    ).toMatch(/공개 버전이 아닙니다/);
  });

  it("이 수업의 자료가 아니면 거절하고, 담당 아닌 선생님은 정책에서 막힌다", () => {
    const doc = makeAssetDoc("pdf", undefined, true);
    const v = asUser(ADMIN_ID, `select publish_curriculum_asset_doc('${doc}', '${asset()}'::jsonb);`);
    const stray = makeAssetDoc("pdf", undefined, true);
    const v2 = asUser(ADMIN_ID, `select publish_curriculum_asset_doc('${stray}', '${asset({ sha256: "c".repeat(64) })}'::jsonb);`);
    const { sessionId } = makeSessionWithPlannedDoc(doc, true);

    expect(
      asUserExpectError(TEACHER_ID, `select append_page_stroke_events('${sessionId}', '${seg()}'::jsonb, 'teacher_shared', '${stray}', '${v2}', 1);`)
    ).toMatch(/이 수업의 자료가 아닙니다/);
    expect(
      asUserExpectError(OTHER_TEACHER_ID, `select append_page_stroke_events('${sessionId}', '${seg()}'::jsonb, 'teacher_shared', '${doc}', '${v}', 1);`)
    ).toMatch(/row-level security|policy|자료가 아닙니다|공개 버전이 아닙니다/);
  });

  it("학생 필기의 주인은 서버가 정하고, 학생은 교사 범위에 쓰지 못한다", () => {
    const doc = makeAssetDoc("pdf", undefined, true);
    const v = asUser(ADMIN_ID, `select publish_curriculum_asset_doc('${doc}', '${asset()}'::jsonb);`);
    const { sessionId } = makeSessionWithPlannedDoc(doc, true);

    asUser(STUDENT_ID, `select append_page_stroke_events('${sessionId}', '${seg()}'::jsonb, 'student_shared', '${doc}', '${v}', 1);`);
    expect(
      psql(`select owner_student_id from session_annotation_events where session_id = '${sessionId}' and scope = 'student_shared';`)
    ).toBe(STUDENT_ID);
    expect(
      asUserExpectError(STUDENT_ID, `select append_page_stroke_events('${sessionId}', '${seg()}'::jsonb, 'teacher_shared', '${doc}', '${v}', 1);`)
    ).toMatch(/row-level security|policy/);
  });
});

// ------------------------------------------------------------ 미리보기
describe("미리보기가 파일 자료를 구분해 안다", () => {
  it("kind·pageCount 가 함께 내려온다", () => {
    const doc = makeAssetDoc("pdf");
    const v = asUser(ADMIN_ID, `select publish_curriculum_asset_doc('${doc}', '${asset()}'::jsonb);`);
    const { sessionId } = makeSessionWithPlannedDoc(doc);
    const unitId = psql(`select overlay_unit_id from session_curriculum_units where session_id = '${sessionId}';`);
    psql(`update curriculum_overlay_unit_materials set curriculum_doc_version_id = '${v}' where overlay_unit_id = '${unitId}';`);

    const out = asUser(STUDENT_ID, `select unit_preview_for_viewer('${unitId}')->'materials'->0;`);
    const m = JSON.parse(out);
    expect(m.kind).toBe("pdf");
    expect(m.pageCount).toBe(2);
    expect(m.sections).toEqual([]);
  });
});
