import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

// R9(레슨 준비 Task 1) — session_prepared_selections/_units/_unit_keywords/
// _content_items(supabase/migrations/20261232000000_r9_session_prepared_selection.sql)를
// 로컬 Postgres에 직접 psql로 검증한다(student-curriculum-overlay.integration.test.ts
// 등과 동일한 패턴 — RLS/트리거/RPC 원자성/동시성은 mocked 클라이언트로는 검증할
// 수 없다).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const DB_URL_API = "http://127.0.0.1:54421";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001"; // 관리자 (seed)
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001"; // 박서연 선생님 (seed, 지훈 담당)
const OTHER_TEACHER_ID = "dddddddd-0000-0000-0000-000000000002"; // 이도현 선생님 (seed, 무관한 제3자)
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001"; // 지훈 (seed)
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001"; // 지훈 household (seed)
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math (seed)

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
    const stderr = (err as { stderr?: Buffer })?.stderr?.toString() ?? String(err);
    return stderr;
  }
}

function asUser(userId: string, sql: string): string {
  return psql(`
    set role authenticated;
    do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$;
    ${sql}
    reset role;
  `);
}

function asUserExpectError(userId: string, sql: string): string {
  return psqlExpectError(`
    set role authenticated;
    do $$ begin perform set_config('request.jwt.claim.sub', '${userId}', false); end $$;
    ${sql}
    reset role;
  `);
}

let baseUnitId: string;
const cleanupContractIds: string[] = [];

// pin된 session_prepared_selections 행은(20261236000000_r9_corrective_remove_pin_lock_bypass.sql
// 이후) 어떤 세션에서도 더 이상 지울 수 없다 — bypass GUC가 완전히 제거됐기
// 때문이다(그게 바로 이 corrective가 고치는 취약점). 따라서 이 테스트 파일은
// 더 이상 per-test 정리에서 pinned 행을 지우려 하지 않는다: 그런 테스트가 만든
// contract는 cleanupContractIds에서 미리 빼서 afterEach가 건드리지 않게 하고,
// 실제 정리는 CLAUDE.md의 UAT 정리 관례대로 파일 전체 실행 사이 `supabase db
// reset --local`에 맡긴다. 각 테스트가 고유한 이름/난수를 쓰므로(이미 기존
// makeOverlayUnitWithKeyword/makeSelectableSection 등이 Date.now()+Math.random()으로
// 그렇게 하고 있다) 남겨진 행들이 다른 테스트와 충돌하지도 않는다.
function excludeFromCleanup(contractId: string): void {
  const idx = cleanupContractIds.indexOf(contractId);
  if (idx !== -1) cleanupContractIds.splice(idx, 1);
}

beforeAll(() => {
  baseUnitId = psql(
    `select id from subject_template_units where subject_id = '${SUBJECT_ID}' order by position limit 1;`
  );
});

afterEach(() => {
  // 각 테스트가 만든 계약/등록/세션/오버레이를 정리한다. sessions/reservations는
  // subject_enrollments를 RESTRICT로 참조하므로(cascade 아님), 자식→부모 순으로
  // 명시적으로 지운 뒤 contracts를 지운다(그 외 오버레이/준비된 선택 등은
  // subject_enrollments cascade로 함께 정리됨). pin-lock에는 이제 어떤 bypass도
  // 없으므로(위 참고), 여기서 지우는 contract는 전부 pinned 행을 만들지 않았거나
  // excludeFromCleanup으로 이미 제외된 것들뿐이다 — 그래서 bypass 없이도 항상
  // 성공해야 정상이다.
  for (const id of cleanupContractIds.splice(0)) {
    psql(`
      delete from sessions where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from reservations where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from subject_threads where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from teacher_assignments where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from subject_enrollments where contract_id = '${id}';
      delete from contracts where id = '${id}';
    `);
  }
});

// 예약 시간대가 서로 겹치지 않도록 호출마다 증가하는 오프셋을 쓴다(같은 선생님
// 소유자 배타 제약 reservations_no_overlap 회피).
let reservationOffsetDays = 300;
function nextReservationOffsetDays(): number {
  reservationOffsetDays += 2;
  return reservationOffsetDays;
}

// 준비된 선택은 subject_enrollment/세션 단위로 만들어지므로, 테스트마다 독립된
// enrollment(+세션)를 새로 만들어 서로 간섭하지 않게 한다.
function makeEnrollmentWithSession(): {
  enrollmentId: string;
  sessionId: string;
  reservationId: string;
  contractId: string;
} {
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${HOUSEHOLD_ID}', '${STUDENT_ID}', 'draft') returning id;`
  );
  cleanupContractIds.push(contractId);
  const enrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${STUDENT_ID}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
  );
  psql(
    `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from)
     values ('${enrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day');`
  );
  const offset = nextReservationOffsetDays();
  const reservationId = psql(
    `insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
     values ('lesson', '${enrollmentId}', '${TEACHER_ID}', now() + interval '${offset} days', now() + interval '${offset} days 1 hour', 'confirmed') returning id;`
  );
  const sessionId = psql(
    `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes)
     values ('${reservationId}', '${enrollmentId}', '${TEACHER_ID}', (select id from lesson_types where code = 'regular'), 60)
     returning id;`
  );
  return { enrollmentId, sessionId, reservationId, contractId };
}

function makeOverlayUnitWithKeyword(): {
  overlayUnitId: string;
  keywordId: string;
  enrollmentId: string;
  sessionId: string;
  contractId: string;
} {
  const { enrollmentId, sessionId, contractId } = makeEnrollmentWithSession();
  const overlayId = asUser(
    TEACHER_ID,
    `insert into student_curriculum_overlays (subject_enrollment_id) values ('${enrollmentId}') returning id;`
  );
  const overlayUnitId = asUser(
    TEACHER_ID,
    `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title)
     values ('${overlayId}', '${baseUnitId}', 1, '레슨준비 테스트 단원') returning id;`
  );
  const keywordId = psql(
    `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '레슨준비키워드 ${Date.now()}_${Math.random()}') returning id;`
  );
  asUser(
    TEACHER_ID,
    `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id) values ('${overlayUnitId}', '${keywordId}');`
  );
  return { overlayUnitId, keywordId, enrollmentId, sessionId, contractId };
}

// 공개(published)된 교재 조각 하나를 새로 만들어 keywordId로 태깅한다(=selectable).
function makeSelectableSection(keywordId: string): string {
  const docId = psql(
    `insert into curriculum_docs (title, subject_id, owner_type, status)
     values ('레슨준비 테스트 교재 ${Date.now()}_${Math.random()}', '${SUBJECT_ID}', 'admin', 'published') returning id;`
  );
  const sectionId = psql(
    `insert into curriculum_doc_sections (curriculum_doc_id, position, title, body)
     values ('${docId}', 1, '테스트 섹션', '<p>본문</p>') returning id;`
  );
  psql(
    `insert into curriculum_doc_section_keywords (section_id, keyword_id) values ('${sectionId}', '${keywordId}');`
  );
  return sectionId;
}

function makeUnselectableSection(keywordId: string): string {
  const docId = psql(
    `insert into curriculum_docs (title, subject_id, owner_type, status)
     values ('레슨준비 미공개 교재 ${Date.now()}_${Math.random()}', '${SUBJECT_ID}', 'admin', 'draft') returning id;`
  );
  const sectionId = psql(
    `insert into curriculum_doc_sections (curriculum_doc_id, position, title, body)
     values ('${docId}', 1, '미공개 섹션', '<p>본문</p>') returning id;`
  );
  psql(
    `insert into curriculum_doc_section_keywords (section_id, keyword_id) values ('${sectionId}', '${keywordId}');`
  );
  return sectionId;
}

// confirmed 문제 하나를 새로 만들어 keywordId로 태깅한다(=selectable).
function makeSelectableProblem(keywordId: string): string {
  const problemId = psql(
    `insert into problems (format, passage, subject_id, status, created_by)
     values ('mc', '레슨준비 테스트 문제 ${Date.now()}_${Math.random()}', '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}') returning id;`
  );
  psql(`insert into problem_keywords (problem_id, keyword_id) values ('${problemId}', '${keywordId}');`);
  return problemId;
}

function createStagedSelectionWithUnit(): {
  selectionId: string;
  unitRowId: string;
  overlayUnitId: string;
  keywordId: string;
  enrollmentId: string;
  sessionId: string;
  contractId: string;
} {
  const { overlayUnitId, keywordId, enrollmentId, sessionId, contractId } = makeOverlayUnitWithKeyword();
  const selectionId = asUser(
    TEACHER_ID,
    `insert into session_prepared_selections (subject_enrollment_id) values ('${enrollmentId}') returning id;`
  );
  const unitRowId = asUser(
    TEACHER_ID,
    `insert into session_prepared_selection_units (prepared_selection_id, overlay_unit_id, position)
     values ('${selectionId}', '${overlayUnitId}', 1) returning id;`
  );
  asUser(
    TEACHER_ID,
    `insert into session_prepared_selection_unit_keywords (prepared_selection_unit_id, keyword_id)
     values ('${unitRowId}', '${keywordId}');`
  );
  return { selectionId, unitRowId, overlayUnitId, keywordId, enrollmentId, sessionId, contractId };
}

describe("생성/편집 — 미부착(임시보관함) 또는 부착-미핀 상태에서 다중 단원 + 단원별 키워드 부분집합", () => {
  it("담당 선생님은 여러 단원과 단원별 키워드 부분집합을 가진 staged 선택을 만들고 편집할 수 있다(미부착)", () => {
    const { overlayUnitId: unit1, keywordId: kw1, enrollmentId } = makeOverlayUnitWithKeyword();

    const selectionId = asUser(
      TEACHER_ID,
      `insert into session_prepared_selections (subject_enrollment_id) values ('${enrollmentId}') returning id;`
    );
    expect(
      psql(`select session_id, status from session_prepared_selections where id = '${selectionId}';`)
    ).toBe("|staged");

    const unitRowId = asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_units (prepared_selection_id, overlay_unit_id, position)
       values ('${selectionId}', '${unit1}', 1) returning id;`
    );
    asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_unit_keywords (prepared_selection_unit_id, keyword_id)
       values ('${unitRowId}', '${kw1}');`
    );

    const keywordCount = psql(
      `select count(*) from session_prepared_selection_unit_keywords where prepared_selection_unit_id = '${unitRowId}';`
    );
    expect(keywordCount).toBe("1");
  });

  it("attached-but-unpinned 상태에서도 단원/키워드 편집이 가능하다", () => {
    const { selectionId, sessionId, enrollmentId } = createStagedSelectionWithUnit();
    asUser(TEACHER_ID, `update session_prepared_selections set session_id = '${sessionId}' where id = '${selectionId}';`);

    // 같은 오버레이 안에 두 번째 단원 인스턴스를 추가해 이 준비된 선택에
    // "복수 단원" 편집이 attached-but-unpinned 상태에서도 되는지 확인한다.
    const overlayIdRow = psql(
      `select o.id from student_curriculum_overlays o where o.subject_enrollment_id = '${enrollmentId}' and o.status = 'active';`
    );
    const secondOverlayUnitId = asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title)
       values ('${overlayIdRow}', '${baseUnitId}', 2, '레슨준비 테스트 단원2') returning id;`
    );

    const secondUnitRowId = asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_units (prepared_selection_id, overlay_unit_id, position)
       values ('${selectionId}', '${secondOverlayUnitId}', 999) returning id;`
    );
    expect(secondUnitRowId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("단원의 키워드가 아닌 것을 활성 키워드로 넣으려 하면 거부된다(부분집합 위반)", () => {
    const { selectionId, unitRowId } = createStagedSelectionWithUnit();
    const otherKeywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '범위밖키워드 ${Date.now()}') returning id;`
    );
    const err = asUserExpectError(
      TEACHER_ID,
      `insert into session_prepared_selection_unit_keywords (prepared_selection_unit_id, keyword_id)
       values ('${unitRowId}', '${otherKeywordId}');`
    );
    expect(err).toMatch(/부분집합/);
    void selectionId;
  });
});

describe("스테이징 콘텐츠 pick/exclude/재포함/재정렬", () => {
  it("키워드-적격 콘텐츠를 pick하고, 소프트 제외했다가 재포함하고, 원자적으로 재정렬할 수 있다", () => {
    const { selectionId, unitRowId, keywordId } = createStagedSelectionWithUnit();
    const sectionId = makeSelectableSection(keywordId);
    const problemId = makeSelectableProblem(keywordId);

    const item1 = asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'material_section', '${sectionId}', 1) returning id;`
    );
    const item2 = asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'problem', '${problemId}', 2) returning id;`
    );

    // 소프트 제외 — 행은 유지된다.
    asUser(TEACHER_ID, `update session_prepared_selection_content_items set included = false where id = '${item1}';`);
    let row = psql(`select included from session_prepared_selection_content_items where id = '${item1}';`);
    expect(row).toBe("f");

    // 재포함
    asUser(TEACHER_ID, `update session_prepared_selection_content_items set included = true where id = '${item1}';`);
    row = psql(`select included from session_prepared_selection_content_items where id = '${item1}';`);
    expect(row).toBe("t");

    // 원자적 재정렬(RPC)
    asUser(
      TEACHER_ID,
      `select reorder_prepared_selection_content_items('${selectionId}', array['${item2}','${item1}']::uuid[]);`
    );
    const ordered = psql(
      `select id, position from session_prepared_selection_content_items
       where prepared_selection_id = '${selectionId}' order by position;`
    )
      .split("\n")
      .map((l) => l.split("|"));
    expect(ordered.map((r) => r[0])).toEqual([item2, item1]);
    expect(ordered.map((r) => r[1])).toEqual(["1", "2"]);
  });

  it("selectable하지 않은(draft) 콘텐츠는 INSERT 시점에 거부된다", () => {
    const { selectionId, unitRowId, keywordId } = createStagedSelectionWithUnit();
    const unselectableSectionId = makeUnselectableSection(keywordId);
    const err = asUserExpectError(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'material_section', '${unselectableSectionId}', 1);`
    );
    expect(err).toMatch(/선택 가능\(published\/confirmed\)하지 않거나/);
  });

  it("이 선택의 단원/키워드 범위 밖인 콘텐츠(다른 키워드로만 태깅됨)는 INSERT 시점에 거부된다", () => {
    const { selectionId, unitRowId } = createStagedSelectionWithUnit();
    const unrelatedKeywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '무관키워드 ${Date.now()}') returning id;`
    );
    const outOfScopeSectionId = makeSelectableSection(unrelatedKeywordId);
    const err = asUserExpectError(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'material_section', '${outOfScopeSectionId}', 1);`
    );
    expect(err).toMatch(/선택 가능\(published\/confirmed\)하지 않거나/);
  });
});

describe("attach/detach — 임시보관함 ↔ 세션", () => {
  it("attach하면 session_id가 설정되고, detach하면 다시 null로 돌아가며 콘텐츠가 유지된다(임시보관함 재등장)", () => {
    const { selectionId, unitRowId, sessionId, keywordId } = createStagedSelectionWithUnit();
    const sectionId = makeSelectableSection(keywordId);
    const itemId = asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'material_section', '${sectionId}', 1) returning id;`
    );

    asUser(TEACHER_ID, `update session_prepared_selections set session_id = '${sessionId}' where id = '${selectionId}';`);
    expect(psql(`select session_id from session_prepared_selections where id = '${selectionId}';`)).toBe(sessionId);

    asUser(TEACHER_ID, `update session_prepared_selections set session_id = null where id = '${selectionId}';`);
    const row = psql(
      `select session_id, status from session_prepared_selections where id = '${selectionId}';`
    );
    expect(row).toBe("|staged");

    // 행이 삭제되지 않았고, 콘텐츠 항목도 그대로다.
    const stillThere = psql(
      `select included from session_prepared_selection_content_items where id = '${itemId}';`
    );
    expect(stillThere).toBe("t");
  });

  it("다른 학생/과목 세션에는 attach할 수 없다(subject_enrollment_id 불일치)", () => {
    const { selectionId } = createStagedSelectionWithUnit();
    const { sessionId: otherSessionId } = makeEnrollmentWithSession();
    const err = asUserExpectError(
      TEACHER_ID,
      `update session_prepared_selections set session_id = '${otherSessionId}' where id = '${selectionId}';`
    );
    expect(err).toMatch(/다른 학생\/과목의 세션/);
  });

  it("두 개의 준비된 선택을 같은 세션에 동시에 attach하면 하나만 성공한다(동시성, 유니크 인덱스)", async () => {
    const { selectionId: sel1, sessionId, enrollmentId } = createStagedSelectionWithUnit();
    const sel2 = asUser(
      TEACHER_ID,
      `insert into session_prepared_selections (subject_enrollment_id) values ('${enrollmentId}') returning id;`
    );

    const adminClient = createClient(DB_URL_API, SERVICE_ROLE_KEY);
    const results = await Promise.all([
      adminClient
        .from("session_prepared_selections")
        .update({ session_id: sessionId })
        .eq("id", sel1),
      adminClient
        .from("session_prepared_selections")
        .update({ session_id: sessionId })
        .eq("id", sel2),
    ]);

    const errors = results.filter((r) => r.error !== null);
    const successes = results.filter((r) => r.error === null);
    expect(successes.length).toBe(1);
    expect(errors.length).toBe(1);

    const attachedCount = psql(
      `select count(*) from session_prepared_selections where session_id = '${sessionId}' and status <> 'archived';`
    );
    expect(attachedCount).toBe("1");
  });
});

describe("pin 이후 잠금 — 트리거가 모든 하위 테이블의 추가 변경을 거부한다", () => {
  it("status='pinned'로 전이한 뒤에는 단원/키워드/콘텐츠 추가·제거·재정렬·detach가 전부 거부된다", () => {
    const { selectionId, unitRowId, keywordId, overlayUnitId, sessionId, contractId } = createStagedSelectionWithUnit();
    const sectionId = makeSelectableSection(keywordId);
    const itemId = asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'material_section', '${sectionId}', 1) returning id;`
    );

    // pin_session_selection()(Task 2)을 통해 실제로 pin한다 — 더 이상 status를
    // 직접 UPDATE로 전이시키지 않는다(Task 2가 그 직접 경로를 RLS WITH CHECK로
    // 막았으므로, 이제 이 방법 자체가 pin-lock이 실전에서 어떻게 걸리는지
    // 증명하는 셈이다).
    asUser(TEACHER_ID, `update session_prepared_selections set session_id = '${sessionId}' where id = '${selectionId}';`);
    asUser(TEACHER_ID, `select pin_session_selection('${sessionId}');`);

    expect(
      asUserExpectError(
        TEACHER_ID,
        `insert into session_prepared_selection_units (prepared_selection_id, overlay_unit_id, position)
         values ('${selectionId}', '${overlayUnitId}', 42);`
      )
    ).toMatch(/핀 완료된/);

    expect(
      asUserExpectError(TEACHER_ID, `delete from session_prepared_selection_units where id = '${unitRowId}';`)
    ).toMatch(/핀 완료된/);

    expect(
      asUserExpectError(
        TEACHER_ID,
        `insert into session_prepared_selection_unit_keywords (prepared_selection_unit_id, keyword_id)
         values ('${unitRowId}', '${keywordId}');`
      )
    ).toMatch(/핀 완료된|존재하지 않는/);

    expect(
      asUserExpectError(
        TEACHER_ID,
        `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
         values ('${selectionId}', '${unitRowId}', 'material_section', '${sectionId}', 55);`
      )
    ).toMatch(/핀 완료된/);

    expect(
      asUserExpectError(
        TEACHER_ID,
        `update session_prepared_selection_content_items set included = false where id = '${itemId}';`
      )
    ).toMatch(/핀 완료된/);

    expect(
      asUserExpectError(
        TEACHER_ID,
        `select reorder_prepared_selection_content_items('${selectionId}', array['${itemId}']::uuid[]);`
      )
    ).toMatch(/핀 완료된/);

    expect(
      asUserExpectError(
        TEACHER_ID,
        `update session_prepared_selections set session_id = null where id = '${selectionId}';`
      )
    ).toMatch(/핀 완료된/);

    // 이 selection은 이제 진짜로 pin되어 있어서 어떤 세션에서도 지울 수 없다
    // (20261236000000_r9_corrective_remove_pin_lock_bypass.sql 이후 bypass가
    // 없으므로). 그래서 이 테스트가 만든 contract는 afterEach의 일반 정리에서
    // 제외하고 db reset에 맡긴다.
    excludeFromCleanup(contractId);
  });

  it("app.bypass_prepared_selection_lock GUC를 설정해도 pin-lock을 더 이상 우회할 수 없다(우회 경로 완전 제거 확인)", () => {
    const { selectionId, unitRowId, keywordId, overlayUnitId, sessionId, contractId } = createStagedSelectionWithUnit();
    const sectionId = makeSelectableSection(keywordId);
    const itemId = asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'material_section', '${sectionId}', 1) returning id;`
    );

    // 실제(un-bypassed) pin 전이 — pin_session_selection()(Task 2)을 통해 진짜로
    // pin한다(더 이상 status를 직접 UPDATE로 시뮬레이션하지 않는다 — Task 2가
    // 그 직접 경로 자체를 RLS WITH CHECK로 막았다).
    asUser(TEACHER_ID, `update session_prepared_selections set session_id = '${sessionId}' where id = '${selectionId}';`);
    asUser(TEACHER_ID, `select pin_session_selection('${sessionId}');`);

    // 20261232000000_r9_session_prepared_selection.sql이 원래 두고 있던 bypass
    // GUC를 명시적으로 설정한 뒤 pinned 행/자식 행을 변경/삭제해본다 — 이 GUC는
    // 어떤 역할에게도 그랜트가 필요 없는 커스텀 GUC라서 authenticated 세션에서도
    // 그냥 SET할 수 있었다(이게 바로 이 corrective가 고친 보안 결함이다).
    // 20261236000000_r9_corrective_remove_pin_lock_bypass.sql 적용 이후에는 이
    // GUC를 설정해도 트리거 함수 본문에 그 분기 자체가 없으므로 아무 효과가
    // 없어야 한다 — 즉 여전히 거부되어야 한다.
    expect(
      asUserExpectError(
        TEACHER_ID,
        `set app.bypass_prepared_selection_lock = 'true';
         update session_prepared_selections set session_id = null where id = '${selectionId}';`
      )
    ).toMatch(/핀 완료된/);

    expect(
      asUserExpectError(
        TEACHER_ID,
        `set app.bypass_prepared_selection_lock = 'true';
         delete from session_prepared_selections where id = '${selectionId}';`
      )
    ).toMatch(/핀 완료된/);

    expect(
      asUserExpectError(
        TEACHER_ID,
        `set app.bypass_prepared_selection_lock = 'true';
         delete from session_prepared_selection_units where id = '${unitRowId}';`
      )
    ).toMatch(/핀 완료된/);

    expect(
      asUserExpectError(
        TEACHER_ID,
        `set app.bypass_prepared_selection_lock = 'true';
         insert into session_prepared_selection_units (prepared_selection_id, overlay_unit_id, position)
         values ('${selectionId}', '${overlayUnitId}', 4242);`
      )
    ).toMatch(/핀 완료된/);

    expect(
      asUserExpectError(
        TEACHER_ID,
        `set app.bypass_prepared_selection_lock = 'true';
         update session_prepared_selection_content_items set included = false where id = '${itemId}';`
      )
    ).toMatch(/핀 완료된/);

    expect(
      asUserExpectError(
        TEACHER_ID,
        `set app.bypass_prepared_selection_lock = 'true';
         delete from session_prepared_selection_content_items where id = '${itemId}';`
      )
    ).toMatch(/핀 완료된/);

    // 이 테스트도 진짜로 pin된 행을 만들었으므로 db reset에 정리를 맡긴다.
    excludeFromCleanup(contractId);
  });
});

describe("인가 — 담당이 아닌 선생님/무관한 역할은 조작할 수 없다", () => {
  it("담당이 아닌 제3자 선생님은 생성/편집/attach/pick-content를 할 수 없다(RLS 거부)", () => {
    const { enrollmentId } = makeEnrollmentWithSession();

    expect(
      asUserExpectError(
        OTHER_TEACHER_ID,
        `insert into session_prepared_selections (subject_enrollment_id) values ('${enrollmentId}');`
      )
    ).toMatch(/row-level security|policy/i);

    const { selectionId, overlayUnitId } = createStagedSelectionWithUnit();
    expect(
      asUserExpectError(
        OTHER_TEACHER_ID,
        `insert into session_prepared_selection_units (prepared_selection_id, overlay_unit_id, position)
         values ('${selectionId}', '${overlayUnitId}', 77);`
      )
    ).toMatch(/row-level security|policy/i);
  });

  it("학생은 준비된 선택을 조회조차 할 수 없다(빈 결과)", () => {
    const { selectionId } = createStagedSelectionWithUnit();
    const readBack = asUser(
      STUDENT_ID,
      `select id from session_prepared_selections where id = '${selectionId}';`
    );
    expect(readBack).toBe("");
  });
});

// P2/P3 2단계 — pin이 "이 수업이 어떤 회차를 다뤘는지"와 "고정 시점의 문제
// 버전"까지 같은 트랜잭션에서 기록하는지 확인한다
// (supabase/migrations/20261295000000_p2_p3_pin_records_units_and_problem_version.sql).
describe("pin 시점 기록 — 회차 연결과 문제 버전 고정", () => {
  it("pin하면 고른 회차가 이 수업에 연결되고, 첫 회차가 기본 회차가 된다", () => {
    const { selectionId, unitRowId, keywordId, overlayUnitId, sessionId, contractId } =
      createStagedSelectionWithUnit();
    excludeFromCleanup(contractId);

    // 두 번째 회차를 더해서 기본/보강 구분을 확인한다.
    const secondOverlayUnitId = asUser(
      TEACHER_ID,
      `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title)
       values ((select overlay_id from curriculum_overlay_units where id = '${overlayUnitId}'), '${baseUnitId}', 2, '보강 회차') returning id;`
    );
    const secondUnitRowId = asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_units (prepared_selection_id, overlay_unit_id, position)
       values ('${selectionId}', '${secondOverlayUnitId}', 2) returning id;`
    );
    void secondUnitRowId;

    const sectionId = makeSelectableSection(keywordId);
    asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'material_section', '${sectionId}', 1);`
    );
    asUser(TEACHER_ID, `update session_prepared_selections set session_id = '${sessionId}' where id = '${selectionId}';`);
    asUser(TEACHER_ID, `select pin_session_selection('${sessionId}');`);

    expect(
      psql(
        `select overlay_unit_id || ':' || role from session_curriculum_units
         where session_id = '${sessionId}' order by role, overlay_unit_id;`
      ).split("\n").sort()
    ).toEqual([`${overlayUnitId}:primary`, `${secondOverlayUnitId}:supplement`].sort());
  });

  it("같은 회차가 여러 수업에 연결될 수 있다(재수업·보강)", () => {
    const { selectionId, unitRowId, keywordId, overlayUnitId, enrollmentId, sessionId, contractId } =
      createStagedSelectionWithUnit();
    excludeFromCleanup(contractId);
    const sectionId = makeSelectableSection(keywordId);
    asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'material_section', '${sectionId}', 1);`
    );
    asUser(TEACHER_ID, `update session_prepared_selections set session_id = '${sessionId}' where id = '${selectionId}';`);
    asUser(TEACHER_ID, `select pin_session_selection('${sessionId}');`);

    // 같은 등록의 두 번째 수업에서 같은 회차를 다시 다룬다.
    const offset = nextReservationOffsetDays();
    const secondReservationId = psql(
      `insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
       values ('lesson', '${enrollmentId}', '${TEACHER_ID}', now() + interval '${offset} days', now() + interval '${offset} days 1 hour', 'confirmed') returning id;`
    );
    const secondSessionId = psql(
      `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes)
       values ('${secondReservationId}', '${enrollmentId}', '${TEACHER_ID}', (select id from lesson_types where code = 'regular'), 60)
       returning id;`
    );
    const secondSelectionId = asUser(
      TEACHER_ID,
      `insert into session_prepared_selections (subject_enrollment_id) values ('${enrollmentId}') returning id;`
    );
    const secondUnitRowId = asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_units (prepared_selection_id, overlay_unit_id, position)
       values ('${secondSelectionId}', '${overlayUnitId}', 1) returning id;`
    );
    asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_unit_keywords (prepared_selection_unit_id, keyword_id)
       values ('${secondUnitRowId}', '${keywordId}');`
    );
    asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${secondSelectionId}', '${secondUnitRowId}', 'material_section', '${sectionId}', 1);`
    );
    asUser(TEACHER_ID, `update session_prepared_selections set session_id = '${secondSessionId}' where id = '${secondSelectionId}';`);
    asUser(TEACHER_ID, `select pin_session_selection('${secondSessionId}');`);

    expect(
      psql(`select count(*) from session_curriculum_units where overlay_unit_id = '${overlayUnitId}';`)
    ).toBe("2");
    // 각 수업의 기본 회차는 여전히 하나씩이다.
    expect(
      psql(
        `select count(*) from session_curriculum_units
         where session_id in ('${sessionId}', '${secondSessionId}') and role = 'primary';`
      )
    ).toBe("2");
  });

  it("문제를 고정하면 그 시점의 공개 버전이 함께 박히고, 이후 새 버전이 공개돼도 바뀌지 않는다", () => {
    const { selectionId, unitRowId, keywordId, sessionId, contractId } = createStagedSelectionWithUnit();
    excludeFromCleanup(contractId);
    const problemId = makeSelectableProblem(keywordId);
    const versionAtPin = psql(`select published_version_id from problems where id = '${problemId}';`);
    expect(versionAtPin).not.toBe("");

    asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'problem', '${problemId}', 1);`
    );
    asUser(TEACHER_ID, `update session_prepared_selections set session_id = '${sessionId}' where id = '${selectionId}';`);
    asUser(TEACHER_ID, `select pin_session_selection('${sessionId}');`);

    expect(
      psql(
        `select problem_version_id from session_content_manifest
         where session_id = '${sessionId}' and content_type = 'problem';`
      )
    ).toBe(versionAtPin);

    // 새 버전을 만들어 공개한다 — 이미 고정된 수업은 그대로여야 한다.
    const newVersionId = psql(
      `select create_problem_draft_version('${problemId}', '고쳐 쓴 지문', null, null, null, null, '${ADMIN_ID}');`
    );
    psql(`select submit_problem_version_for_review('${newVersionId}', '${ADMIN_ID}');`);
    psql(`select publish_problem_version('${newVersionId}', '${ADMIN_ID}');`);
    expect(psql(`select published_version_id from problems where id = '${problemId}';`)).toBe(newVersionId);

    expect(
      psql(
        `select problem_version_id from session_content_manifest
         where session_id = '${sessionId}' and content_type = 'problem';`
      )
    ).toBe(versionAtPin);
  });
});

// Acceptance-adjacent — vocab_words 무관 확인(계획서 §Acceptance gate 항목 7).
describe("vocab_words — 완전히 무관하다", () => {
  it("이 마이그레이션의 어떤 테이블도 vocab_words를 참조하는 FK/트리거를 갖지 않는다", () => {
    const fkCount = psql(`
      select count(*) from information_schema.table_constraints tc
      join information_schema.constraint_column_usage ccu
        on tc.constraint_name = ccu.constraint_name and tc.constraint_schema = ccu.constraint_schema
      where tc.constraint_type = 'FOREIGN KEY' and ccu.table_name = 'vocab_words'
        and tc.table_name in (
          'session_prepared_selections','session_prepared_selection_units',
          'session_prepared_selection_unit_keywords','session_prepared_selection_content_items'
        );
    `);
    expect(fkCount).toBe("0");
  });
});

void ADMIN_ID;
