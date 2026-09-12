import { execFileSync } from "node:child_process";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

// R9(레슨 준비 Task 2) — session_content_manifest/pin_session_selection()
// (supabase/migrations/20261233000000_r9_session_content_manifest.sql)을
// session-prepared-selection.integration.test.ts와 동일한 psql 직접 검증
// 패턴으로 테스트한다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

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

let reservationOffsetDays = 2000;
function nextReservationOffsetDays(): number {
  reservationOffsetDays += 2;
  return reservationOffsetDays;
}

function makeEnrollmentWithSession(): {
  enrollmentId: string;
  sessionId: string;
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
  return { enrollmentId, sessionId, contractId };
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
     values ('${overlayId}', '${baseUnitId}', 1, 'Task2 테스트 단원') returning id;`
  );
  const keywordId = psql(
    `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', 'Task2키워드 ${Date.now()}_${Math.random()}') returning id;`
  );
  asUser(
    TEACHER_ID,
    `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id) values ('${overlayUnitId}', '${keywordId}');`
  );
  return { overlayUnitId, keywordId, enrollmentId, sessionId, contractId };
}

function makeSelectableSection(keywordId: string): string {
  const docId = psql(
    `insert into curriculum_docs (title, subject_id, owner_type, status)
     values ('Task2 테스트 교재 ${Date.now()}_${Math.random()}', '${SUBJECT_ID}', 'admin', 'published') returning id;`
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

function makeSelectableProblem(keywordId: string): string {
  const problemId = psql(
    `insert into problems (format, passage, subject_id, status, created_by)
     values ('mc', 'Task2 테스트 문제 ${Date.now()}_${Math.random()}', '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}') returning id;`
  );
  psql(`insert into problem_keywords (problem_id, keyword_id) values ('${problemId}', '${keywordId}');`);
  return problemId;
}

// staged 선택을 만들고, sessionId에 attach한 뒤(단 pin은 하지 않음) 반환한다.
function createAttachedStagedSelection(): {
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
    `insert into session_prepared_selections (subject_enrollment_id, session_id) values ('${enrollmentId}', '${sessionId}') returning id;`
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

// R9 corrective(20261237000000_r9_corrective_content_item_unit_provenance.sql)
// — 두 번째 오버레이 단원을 같은 오버레이 안에 추가하고, 같은 keywordId를 그
// 단원의 활성 키워드 부분집합에도 넣는다(두 단원의 키워드 범위가 같은
// keywordId에서 겹치게 만든다) — "여러 단원의 범위에 동시에 매칭되는 콘텐츠"
// 시나리오를 구성하기 위한 헬퍼.
function addSecondUnitSharingKeyword(
  selectionId: string,
  enrollmentId: string,
  keywordId: string
): { secondUnitRowId: string; secondOverlayUnitId: string } {
  const overlayId = psql(
    `select o.id from student_curriculum_overlays o where o.subject_enrollment_id = '${enrollmentId}' and o.status = 'active';`
  );
  const secondOverlayUnitId = asUser(
    TEACHER_ID,
    `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title)
     values ('${overlayId}', '${baseUnitId}', 2, 'Task2 corrective 두번째 단원') returning id;`
  );
  asUser(
    TEACHER_ID,
    `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id) values ('${secondOverlayUnitId}', '${keywordId}');`
  );
  const secondUnitRowId = asUser(
    TEACHER_ID,
    `insert into session_prepared_selection_units (prepared_selection_id, overlay_unit_id, position)
     values ('${selectionId}', '${secondOverlayUnitId}', 2) returning id;`
  );
  asUser(
    TEACHER_ID,
    `insert into session_prepared_selection_unit_keywords (prepared_selection_unit_id, keyword_id)
     values ('${secondUnitRowId}', '${keywordId}');`
  );
  return { secondUnitRowId, secondOverlayUnitId };
}

describe("pin_session_selection() — 정확히 staged+included 목록만 매니페스트로 얼린다", () => {
  it("(a) pin은 staged+included 콘텐츠 목록을 정확히 매니페스트로 얼린다", () => {
    const { selectionId, unitRowId, keywordId, sessionId, contractId } = createAttachedStagedSelection();
    const sectionId = makeSelectableSection(keywordId);
    const problemId = makeSelectableProblem(keywordId);
    asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'material_section', '${sectionId}', 1);`
    );
    asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'problem', '${problemId}', 2);`
    );

    asUser(TEACHER_ID, `select pin_session_selection('${sessionId}');`);

    const rows = psql(
      `select content_type, content_id, display_position from session_content_manifest
       where session_id = '${sessionId}' order by display_position;`
    )
      .split("\n")
      .map((l) => l.split("|"));
    expect(rows).toEqual([
      ["material_section", sectionId, "1"],
      ["problem", problemId, "2"],
    ]);

    const status = psql(`select status from session_prepared_selections where id = '${selectionId}';`);
    expect(status).toBe("pinned");
    excludeFromCleanup(contractId);
  });

  it("(h) 키워드 범위에는 매칭되지만 staged로 pick되지 않은(또는 excluded) 후보는 매니페스트에 없다", () => {
    const { selectionId, unitRowId, keywordId, sessionId, contractId } = createAttachedStagedSelection();
    const pickedSectionId = makeSelectableSection(keywordId);
    const neverPickedSectionId = makeSelectableSection(keywordId);
    const excludedProblemId = makeSelectableProblem(keywordId);

    asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'material_section', '${pickedSectionId}', 1);`
    );
    const excludedItemId = asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'problem', '${excludedProblemId}', 2) returning id;`
    );
    asUser(TEACHER_ID, `update session_prepared_selection_content_items set included = false where id = '${excludedItemId}';`);

    asUser(TEACHER_ID, `select pin_session_selection('${sessionId}');`);

    const manifestContentIds = psql(
      `select content_id from session_content_manifest where session_id = '${sessionId}';`
    ).split("\n");
    expect(manifestContentIds).toEqual([pickedSectionId]);
    expect(manifestContentIds).not.toContain(neverPickedSectionId);
    expect(manifestContentIds).not.toContain(excludedProblemId);
    excludeFromCleanup(contractId);
  });

  it("(i) pin_session_selection()은 staged+included 목록 밖의 콘텐츠에 대해서는 매니페스트 행을 절대 쓰지 않는다", () => {
    const { selectionId, unitRowId, keywordId, sessionId, contractId } = createAttachedStagedSelection();
    const pickedSectionId = makeSelectableSection(keywordId);
    const outOfPickScopeProblemId = makeSelectableProblem(keywordId); // 같은 범위지만 pick 안 함

    asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'material_section', '${pickedSectionId}', 1);`
    );

    asUser(TEACHER_ID, `select pin_session_selection('${sessionId}');`);

    const exists = psql(
      `select exists(select 1 from session_content_manifest where session_id = '${sessionId}' and content_id = '${outOfPickScopeProblemId}');`
    );
    expect(exists).toBe("f");
    excludeFromCleanup(contractId);
  });

  it("(b) pin 이후 같은 키워드로 새로 발행된 콘텐츠는 매니페스트에 추가되지 않는다", () => {
    const { selectionId, unitRowId, keywordId, sessionId, contractId } = createAttachedStagedSelection();
    const sectionId = makeSelectableSection(keywordId);
    asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'material_section', '${sectionId}', 1);`
    );
    asUser(TEACHER_ID, `select pin_session_selection('${sessionId}');`);

    const beforeCount = psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`);

    // pin 이후 같은 키워드로 새 콘텐츠를 발행한다.
    const newSectionId = makeSelectableSection(keywordId);

    const afterCount = psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`);
    expect(afterCount).toBe(beforeCount);
    const exists = psql(
      `select exists(select 1 from session_content_manifest where session_id = '${sessionId}' and content_id = '${newSectionId}');`
    );
    expect(exists).toBe("f");
    excludeFromCleanup(contractId);
  });

  it("(c) pin 이후 단원의 정규 키워드 관계를 바꿔도 매니페스트는 변하지 않는다", () => {
    const { selectionId, unitRowId, keywordId, overlayUnitId, sessionId, contractId } = createAttachedStagedSelection();
    const sectionId = makeSelectableSection(keywordId);
    asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'material_section', '${sectionId}', 1);`
    );
    asUser(TEACHER_ID, `select pin_session_selection('${sessionId}');`);

    const before = psql(
      `select content_id, display_position from session_content_manifest where session_id = '${sessionId}' order by display_position;`
    );

    // 단원의 키워드 관계를 편집한다(관리자가 새 키워드를 추가) — 매니페스트가
    // 단원/키워드 파생 쿼리가 아니라는 것을 증명한다.
    const newKeywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', 'Task2 새키워드 ${Date.now()}') returning id;`
    );
    psql(`insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id) values ('${overlayUnitId}', '${newKeywordId}');`);

    const after = psql(
      `select content_id, display_position from session_content_manifest where session_id = '${sessionId}' order by display_position;`
    );
    expect(after).toBe(before);
    excludeFromCleanup(contractId);
  });

  it("(f) pick 이후 pin 이전에 unpublish된 항목은 pin 전체를 실패시키고 매니페스트를 0행으로 남긴다", () => {
    const { selectionId, unitRowId, keywordId, sessionId } = createAttachedStagedSelection();
    const goodSectionId = makeSelectableSection(keywordId);
    const toBeUnpublishedSectionId = makeSelectableSection(keywordId);
    asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'material_section', '${goodSectionId}', 1);`
    );
    asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'material_section', '${toBeUnpublishedSectionId}', 2);`
    );

    // pick된 뒤 pin 전에 draft로 되돌린다(관리자 조작).
    psql(
      `update curriculum_docs set status = 'draft'
       where id = (select curriculum_doc_id from curriculum_doc_sections where id = '${toBeUnpublishedSectionId}');`
    );

    const err = asUserExpectError(TEACHER_ID, `select pin_session_selection('${sessionId}');`);
    expect(err).toMatch(/pin 시점 재검증 실패/);
    expect(err).toContain(toBeUnpublishedSectionId);

    const count = psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`);
    expect(count).toBe("0");
    const status = psql(`select status from session_prepared_selections where id = '${selectionId}';`);
    expect(status).toBe("staged");
  });

  it("(g) 세션의 final_status가 scheduled에서 벗어나면 pin이 거부된다", () => {
    const { selectionId, unitRowId, keywordId, sessionId } = createAttachedStagedSelection();
    const sectionId = makeSelectableSection(keywordId);
    asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'material_section', '${sectionId}', 1);`
    );
    psql(`update sessions set final_status = 'completed' where id = '${sessionId}';`);

    const err = asUserExpectError(TEACHER_ID, `select pin_session_selection('${sessionId}');`);
    expect(err).toMatch(/이미 시작\/종료된 세션은 pin할 수 없습니다/);
    const count = psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`);
    expect(count).toBe("0");
  });
});

describe("pin_session_selection() 권한 매트릭스", () => {
  function setupPinnable(): {
    selectionId: string;
    sessionId: string;
    enrollmentId: string;
    contractId: string;
  } {
    const { selectionId, unitRowId, keywordId, sessionId, enrollmentId, contractId } = createAttachedStagedSelection();
    const sectionId = makeSelectableSection(keywordId);
    asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'material_section', '${sectionId}', 1);`
    );
    return { selectionId, sessionId, enrollmentId, contractId };
  }

  it("담당 선생님은 성공한다", () => {
    const { sessionId, contractId } = setupPinnable();
    asUser(TEACHER_ID, `select pin_session_selection('${sessionId}');`);
    const count = psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`);
    expect(count).toBe("1");
    excludeFromCleanup(contractId);
  });

  it("관리자는 별도 허용 경로로 성공한다", () => {
    const { sessionId, contractId } = setupPinnable();
    asUser(ADMIN_ID, `select pin_session_selection('${sessionId}');`);
    const count = psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`);
    expect(count).toBe("1");
    excludeFromCleanup(contractId);
  });

  it("이 학생/과목에 배정된 적 없는 무관한 선생님은 실패하고 매니페스트는 0행이다", () => {
    const { sessionId } = setupPinnable();
    const err = asUserExpectError(OTHER_TEACHER_ID, `select pin_session_selection('${sessionId}');`);
    expect(err).toMatch(/권한이 없습니다/);
    const count = psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`);
    expect(count).toBe("0");
  });

  it("같은 학생에 배정됐었지만 현재는 활성이 아닌(다른 시점) 선생님은 실패한다", () => {
    const { sessionId, enrollmentId } = setupPinnable();
    // OTHER_TEACHER를 이 enrollment에 ended 상태로 배정한다(과거에는 담당,
    // 지금은 아님) — is_active_teacher_for_enrollment는 planned/active만 인정한다.
    psql(
      `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, effective_until)
       values ('${enrollmentId}', '${OTHER_TEACHER_ID}', 'ended', now() - interval '30 days', now() - interval '10 days');`
    );
    const err = asUserExpectError(OTHER_TEACHER_ID, `select pin_session_selection('${sessionId}');`);
    expect(err).toMatch(/권한이 없습니다/);
    const count = psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`);
    expect(count).toBe("0");
  });

  it("학생은 실패하고 매니페스트는 0행이다", () => {
    const { sessionId } = setupPinnable();
    const err = asUserExpectError(STUDENT_ID, `select pin_session_selection('${sessionId}');`);
    expect(err).toMatch(/권한이 없습니다|찾을 수 없습니다/);
    const count = psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`);
    expect(count).toBe("0");
  });

  it("올바른 담당 선생님이라도 이 staged 선택에 attach되지 않은 sessionId를 넘기면 실패한다(0c 증명)", () => {
    const { selectionId } = setupPinnable();
    void selectionId;
    const { sessionId: unattachedSessionId } = makeEnrollmentWithSession();
    const err = asUserExpectError(TEACHER_ID, `select pin_session_selection('${unattachedSessionId}');`);
    expect(err).toMatch(/찾을 수 없습니다/);
    const count = psql(`select count(*) from session_content_manifest where session_id = '${unattachedSessionId}';`);
    expect(count).toBe("0");
  });

  it("세션과 선택의 subject_enrollment_id가 어긋난 상태를 구성하면 실패한다(0d 증명)", () => {
    const { selectionId, sessionId, enrollmentId: originalEnrollmentId } = setupPinnable();
    void selectionId;
    const { enrollmentId: otherEnrollmentId } = makeEnrollmentWithSession();
    // 정상 흐름에서는 절대 나오지 않는 상태 — 선택(및 그 teacher_id/is_active_teacher
    // 검사, 즉 0b)은 그대로 통과하게 두고, 세션 쪽의 subject_enrollment_id만
    // superuser로 직접 조작해 어긋나게 만든다(0b를 통과시켜야 0d 자체를
    // 증명할 수 있다 — 0b가 먼저 걸리면 0d를 가렸다는 오해를 줄 수 있다).
    psql(`update sessions set subject_enrollment_id = '${otherEnrollmentId}' where id = '${sessionId}';`);

    try {
      const err = asUserExpectError(TEACHER_ID, `select pin_session_selection('${sessionId}');`);
      expect(err).toMatch(/일치하지 않습니다/);
      const count = psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`);
      expect(count).toBe("0");
    } finally {
      // afterEach 정리가 계약별 cascade로 세션/예약을 지우므로, 이 세션이
      // otherEnrollmentId에 붙은 채로 남아있으면(원래 계약 쪽 정리 쿼리가
      // 더 이상 이 세션을 찾지 못해) 예약 삭제가 FK로 막힌다 — 정리 전에
      // 원래 subject_enrollment_id로 되돌린다.
      psql(`update sessions set subject_enrollment_id = '${originalEnrollmentId}' where id = '${sessionId}';`);
    }
  });
});

describe("(d) pin 이후 표시 시점 가시성 — 매니페스트 행 자체는 절대 건드리지 않는다", () => {
  it("pin된 매니페스트 항목의 콘텐츠가 이후 unpublish/unconfirm돼도, 매니페스트 행 자체는 원본 그대로 남아있다", () => {
    const { selectionId, unitRowId, keywordId, sessionId, contractId } = createAttachedStagedSelection();
    const sectionId = makeSelectableSection(keywordId);
    const problemId = makeSelectableProblem(keywordId);
    asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'material_section', '${sectionId}', 1);`
    );
    asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'problem', '${problemId}', 2);`
    );
    asUser(TEACHER_ID, `select pin_session_selection('${sessionId}');`);

    const before = psql(
      `select content_type, content_id, display_position from session_content_manifest
       where session_id = '${sessionId}' order by display_position;`
    );

    // pin 이후 섹션의 상위 교재를 draft로, 문제를 draft로 되돌린다(관리자 조작).
    psql(
      `update curriculum_docs set status = 'draft'
       where id = (select curriculum_doc_id from curriculum_doc_sections where id = '${sectionId}');`
    );
    psql(`update problems set status = 'draft' where id = '${problemId}';`);

    // 매니페스트 테이블 자체(직접 조회)는 원본 그대로다 — 숨김은 이 테이블을
    // 건드리지 않는, session-content-data.ts 리더 쪽의 표시 시점 필터일 뿐이다.
    const after = psql(
      `select content_type, content_id, display_position from session_content_manifest
       where session_id = '${sessionId}' order by display_position;`
    );
    expect(after).toBe(before);

    // 반면 "지금도 여전히 선택 가능한가" 게이트(session-content-data.ts가 쓰는
    // 뷰)는 둘 다 더 이상 보이지 않는다 — 표시 시점에는 숨겨져야 한다는 것의
    // DB 레벨 증거.
    const sectionStillSelectable = psql(
      `select exists(select 1 from curriculum_doc_section_keywords_selectable where section_id = '${sectionId}');`
    );
    expect(sectionStillSelectable).toBe("f");
    const problemStillSelectable = psql(
      `select exists(select 1 from problem_keywords_selectable where problem_id = '${problemId}');`
    );
    expect(problemStillSelectable).toBe("f");

    excludeFromCleanup(contractId);
  });
});

describe("함수 하드닝 — search_path 고정, PUBLIC EXECUTE 없음", () => {
  it("(k) pin_session_selection의 EXECUTE는 authenticated에게만 있고 PUBLIC에는 없으며, search_path가 고정돼있다", () => {
    const grantees = psql(
      `select grantee from information_schema.role_routine_grants
       where routine_name = 'pin_session_selection' and privilege_type = 'EXECUTE' order by grantee;`
    ).split("\n");
    expect(grantees).toContain("authenticated");
    expect(grantees).not.toContain("PUBLIC");

    const proconfig = psql(
      `select array_to_string(proconfig, ',') from pg_proc where proname = 'pin_session_selection';`
    );
    expect(proconfig).toMatch(/search_path=public, ?pg_temp/);
  });
});

describe("session_content_manifest — ordinary role은 어떤 쓰기도 할 수 없다", () => {
  it("(e) staged 상태에서도 teacher-role 직접 INSERT/UPDATE/DELETE는 전부 거부된다", () => {
    const { selectionId, unitRowId, keywordId, sessionId, contractId } = createAttachedStagedSelection();
    const sectionId = makeSelectableSection(keywordId);
    asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'material_section', '${sectionId}', 1);`
    );
    // 아직 staged 상태(pin 안 함) — v3가 고친 건 "잠금 트리거"가 아니라 "그랜트
    // 자체가 없음"이므로, staged 상태에서도 거부되어야 한다.
    expect(
      asUserExpectError(
        TEACHER_ID,
        `insert into session_content_manifest (session_id, content_type, content_id, display_position)
         values ('${sessionId}', 'material_section', '${sectionId}', 1);`
      )
    ).toMatch(/permission denied/);

    // pin까지 마친 뒤에도(= 매니페스트에 실제 행이 생긴 뒤에도) 마찬가지다.
    asUser(TEACHER_ID, `select pin_session_selection('${sessionId}');`);
    const manifestRowId = psql(`select id from session_content_manifest where session_id = '${sessionId}' limit 1;`);

    expect(
      asUserExpectError(
        TEACHER_ID,
        `update session_content_manifest set display_position = 999 where id = '${manifestRowId}';`
      )
    ).toMatch(/permission denied/);

    expect(
      asUserExpectError(TEACHER_ID, `delete from session_content_manifest where id = '${manifestRowId}';`)
    ).toMatch(/permission denied/);

    expect(
      asUserExpectError(
        ADMIN_ID,
        `insert into session_content_manifest (session_id, content_type, content_id, display_position)
         values ('${sessionId}', 'material_section', '${sectionId}', 999);`
      )
    ).toMatch(/permission denied/);
    excludeFromCleanup(contractId);
  });
});

describe("(l) session_prepared_selections.status를 pin_session_selection() 없이 직접 UPDATE로 'pinned'로 바꿀 수 없다", () => {
  it("담당 선생님의 직접 SQL UPDATE는 거부되고, 매니페스트도 0행으로 남는다", () => {
    const { selectionId, unitRowId, keywordId, sessionId } = createAttachedStagedSelection();
    const sectionId = makeSelectableSection(keywordId);
    asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'material_section', '${sectionId}', 1);`
    );

    // 이게 바로 제품 오너가 지목한 핵심 구멍이다: pin_session_selection()을
    // 전혀 거치지 않고 담당 선생님이 직접 status='pinned'로 UPDATE를 시도한다.
    // Task 1의 "담당 선생님/관리자만 쓰기" 정책은 블랭킷 ALL 정책이라 이걸
    // 막지 못했다 — Task 2가 WITH CHECK를 좁혀서 이 UPDATE 자체가 RLS
    // 위반으로 거부되게 한다(0 rows updated → PostgREST/RLS 관점에서는
        // affected-rows 0, 여기서는 psql 직접 UPDATE이므로 RLS가 조용히 아무 행도
    // 갱신하지 않는다 — WITH CHECK 위반 시 UPDATE는 에러 없이 0 rows가 되는
    // 경우도 있고, new-row-violates-row-level-security 에러가 나는 경우도
    // 있다: 둘 다 "실제로 pinned로 바뀌지 않았다"로 수렴하므로 결과 상태로
    // 검증한다).
    try {
      asUser(
        TEACHER_ID,
        `update session_prepared_selections set status = 'pinned', pinned_at = now() where id = '${selectionId}';`
      );
    } catch {
      // RLS WITH CHECK 위반으로 에러가 나는 것도 허용된 결과다.
    }

    const status = psql(`select status from session_prepared_selections where id = '${selectionId}';`);
    expect(status).toBe("staged");

    const manifestCount = psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`);
    expect(manifestCount).toBe("0");
  });
});

// R9 corrective(20261237000000_r9_corrective_content_item_unit_provenance.sql)
// — 이 세 describe 블록이 제품 오너가 지목한 구멍(다중 단원 범위가 겹칠 때
// source_overlay_unit_id가 임의로 도출되던 문제)에 대한 직접적인 증거다.
describe("corrective — prepared_selection_unit_id가 source_overlay_unit_id의 유일한 출처다", () => {
  it("두 단원의 활성 키워드 범위가 겹치는 콘텐츠를 단원2를 편성하며 pick하면, 매니페스트의 source_overlay_unit_id는 정확히 단원2의 overlay_unit_id다(단원1이 아니다)", () => {
    const { selectionId, unitRowId: firstUnitRowId, overlayUnitId: firstOverlayUnitId, keywordId, enrollmentId, sessionId, contractId } =
      createAttachedStagedSelection();
    const { secondUnitRowId, secondOverlayUnitId } = addSecondUnitSharingKeyword(selectionId, enrollmentId, keywordId);
    void firstUnitRowId;

    // 같은 keywordId로 태깅된 콘텐츠 하나 — 단원1/단원2 둘 다의 활성 키워드
    // 범위에 동시에 매칭된다(겹침을 실제로 구성).
    const sharedSectionId = makeSelectableSection(keywordId);
    const sectionSelectableForBothUnits = psql(
      `select count(*) from session_prepared_selection_unit_keywords k
       where k.keyword_id = '${keywordId}' and k.prepared_selection_unit_id in ('${firstUnitRowId}', '${secondUnitRowId}');`
    );
    expect(sectionSelectableForBothUnits).toBe("2"); // 사전 조건: 정말로 두 단원 다 이 키워드를 갖는다.

    // 선생님이 이 콘텐츠를 "단원2를 편성하며" pick한다 — prepared_selection_unit_id가
    // secondUnitRowId를 명시적으로 지목한다(단원1이 position 순서상 먼저더라도).
    asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${secondUnitRowId}', 'material_section', '${sharedSectionId}', 1);`
    );

    asUser(TEACHER_ID, `select pin_session_selection('${sessionId}');`);

    const sourceOverlayUnitId = psql(
      `select source_overlay_unit_id from session_content_manifest where session_id = '${sessionId}' and content_id = '${sharedSectionId}';`
    );
    expect(sourceOverlayUnitId).toBe(secondOverlayUnitId);
    expect(sourceOverlayUnitId).not.toBe(firstOverlayUnitId);
    excludeFromCleanup(contractId);
  });

  it("pin 전 단원 position을 바꿔도(재정렬) 매니페스트의 source_overlay_unit_id는 단원의 정체성(overlay_unit_id)을 그대로 따르고 position에 영향받지 않는다", () => {
    const { selectionId, unitRowId: firstUnitRowId, overlayUnitId: firstOverlayUnitId, keywordId, enrollmentId, sessionId, contractId } =
      createAttachedStagedSelection();
    const { secondUnitRowId, secondOverlayUnitId } = addSecondUnitSharingKeyword(selectionId, enrollmentId, keywordId);

    const sharedSectionId = makeSelectableSection(keywordId);
    asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${secondUnitRowId}', 'material_section', '${sharedSectionId}', 1);`
    );

    // pin 전에 단원 position을 맞바꾼다(단원2를 1번, 단원1을 2번으로) — 이제
    // "position 순서상 먼저"인 단원이 뒤바뀐다. 예전 휴리스틱
    // (order by position limit 1)이었다면 이 재정렬 하나만으로 source_overlay_unit_id가
    // 바뀌었을 것이다 — corrective 이후에는 prepared_selection_unit_id를 직접
    // 따라가므로 영향이 없어야 한다.
    asUser(
      TEACHER_ID,
      `update session_prepared_selection_units set position = -1 where id = '${secondUnitRowId}';`
    );
    asUser(
      TEACHER_ID,
      `update session_prepared_selection_units set position = -2 where id = '${firstUnitRowId}';`
    );
    const positionsAfterSwap = psql(
      `select id, position from session_prepared_selection_units where prepared_selection_id = '${selectionId}' order by position;`
    );
    expect(positionsAfterSwap).toContain(secondUnitRowId); // 사전 조건: 재정렬이 실제로 반영됐다.

    asUser(TEACHER_ID, `select pin_session_selection('${sessionId}');`);

    const sourceOverlayUnitId = psql(
      `select source_overlay_unit_id from session_content_manifest where session_id = '${sessionId}' and content_id = '${sharedSectionId}';`
    );
    expect(sourceOverlayUnitId).toBe(secondOverlayUnitId);
    expect(sourceOverlayUnitId).not.toBe(firstOverlayUnitId);
    excludeFromCleanup(contractId);
  });
});

// R9 corrective(2차, 20261238000000_r9_corrective_content_item_unit_update_guard.sql)
// — 제품 오너가 지목한 실제 구멍(UPDATE 시점에는 prepared_selection_unit_id의
// 소속 선택이 전혀 재검증되지 않던 문제)에 대한 직접 증거.
describe("corrective(2차) — prepared_selection_unit_id는 UPDATE로도 다른 선택의 단원을 가리킬 수 없다", () => {
  it("담당 선생님이 자신의 스테이징 항목의 prepared_selection_unit_id를 다른(무관한) 선택의 단원으로 UPDATE하면 복합 FK 위반으로 거부된다", () => {
    const { selectionId, unitRowId, keywordId, sessionId, contractId } = createAttachedStagedSelection();
    const sectionId = makeSelectableSection(keywordId);
    const itemId = asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'material_section', '${sectionId}', 1) returning id;`
    );

    // 완전히 별개의 선택(다른 학생/enrollment)을 하나 더 만들고, 그 안의 단원
    // 행 id를 얻는다.
    const other = createAttachedStagedSelection();

    const err = asUserExpectError(
      TEACHER_ID,
      `update session_prepared_selection_content_items set prepared_selection_unit_id = '${other.unitRowId}' where id = '${itemId}';`
    );
    // BEFORE 트리거(check_prepared_content_item_selectable(), 이번 corrective로
    // UPDATE OF prepared_selection_unit_id에도 확장됨)가 Postgres의 복합 FK
    // 제약 검사보다 먼저 실행되므로, 이 조합에서는 트리거의 명시적 한국어
    // 에러가 먼저 표면화된다("이 단원은 다른 준비된 선택에 속해 있어..."). 복합
    // FK는 이 트리거를 우회하는 어떤 경로(예: 트리거 없는 하위 레벨 접근)에도
    // 대비하는 두 번째 방어선이다 — 아래 두 번째 테스트가 그 방어선 자체를
    // 별도로 증명한다.
    expect(err).toMatch(/이 단원은 다른 준비된 선택에 속해 있어 출처로 지목할 수 없습니다/);

    // 실제로 값이 바뀌지 않았는지 확인한다.
    const stillPointsAtOriginal = psql(
      `select prepared_selection_unit_id from session_prepared_selection_content_items where id = '${itemId}';`
    );
    expect(stillPointsAtOriginal).toBe(unitRowId);

    excludeFromCleanup(contractId);
    excludeFromCleanup(other.contractId);
  });

  it("트리거를 우회해도(superuser가 selectable 트리거를 일시적으로 disable) 복합 FK 자체가 독립적인 방어선으로 여전히 거부한다", () => {
    const { selectionId, unitRowId, keywordId, sessionId, contractId } = createAttachedStagedSelection();
    const sectionId = makeSelectableSection(keywordId);
    const itemId = asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'material_section', '${sectionId}', 1) returning id;`
    );
    const other = createAttachedStagedSelection();

    // 위 테스트는 BEFORE 트리거가 먼저 막는다는 것을 보였다 — 이 테스트는 그
    // 트리거를 superuser 권한으로 일시적으로 disable해서(정상 앱 코드 경로에는
    // 없는 하위 레벨 접근을 흉내낸다) 트리거가 없어도 복합 FK 자체가 독립적으로
    // 이 상태를 막는지 확인한다. 이것이 요구된 "복합 FK가 SQL 레벨에서 이
    // 시도 자체를 제약 위반으로 실패시킨다"의 직접 증거다.
    psql(
      `alter table session_prepared_selection_content_items disable trigger session_prepared_selection_content_items_check_selectable;`
    );
    let err: string;
    try {
      err = psqlExpectError(
        `update session_prepared_selection_content_items set prepared_selection_unit_id = '${other.unitRowId}' where id = '${itemId}';`
      );
    } finally {
      psql(
        `alter table session_prepared_selection_content_items enable trigger session_prepared_selection_content_items_check_selectable;`
      );
    }
    expect(err).toMatch(/violates foreign key constraint/);
    expect(err).toContain("session_prepared_selection_content_items_unit_selection_fk");

    // 값이 실제로 바뀌지 않았는지, 그리고 정상적인 pin은 여전히 성공하는지도
    // 확인한다(트리거를 되살렸으므로 정상 경로는 영향받지 않는다).
    const stillPointsAtOriginal = psql(
      `select prepared_selection_unit_id from session_prepared_selection_content_items where id = '${itemId}';`
    );
    expect(stillPointsAtOriginal).toBe(unitRowId);

    asUser(TEACHER_ID, `select pin_session_selection('${sessionId}');`);
    const manifestCount = psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`);
    expect(manifestCount).toBe("1");
    const status = psql(`select status from session_prepared_selections where id = '${selectionId}';`);
    expect(status).toBe("pinned");

    excludeFromCleanup(contractId);
    excludeFromCleanup(other.contractId);
  });

  it("content_type/content_id를 바꾸는 UPDATE도(단원은 그대로 두고) selectable 트리거의 재검증을 다시 받는다 — 범위 밖 콘텐츠로 바꾸면 거부된다", () => {
    const { selectionId, unitRowId, keywordId, sessionId, contractId } = createAttachedStagedSelection();
    const sectionId = makeSelectableSection(keywordId);
    const itemId = asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'material_section', '${sectionId}', 1) returning id;`
    );

    // 이 단원의 키워드 범위 밖의(다른 키워드로 태깅된) 섹션으로 content_id를
    // 바꾼다 — INSERT 시점 트리거가 확장 전이었다면 이 UPDATE는 아무 검증도
    // 받지 않고 통과했을 것이다.
    const otherKeywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '무관한키워드 ${Date.now()}_${Math.random()}') returning id;`
    );
    const outOfScopeSectionId = makeSelectableSection(otherKeywordId);

    const err = asUserExpectError(
      TEACHER_ID,
      `update session_prepared_selection_content_items set content_id = '${outOfScopeSectionId}' where id = '${itemId}';`
    );
    expect(err).toMatch(/선택 가능\(published\/confirmed\)하지 않거나 이 단원의 키워드 범위 밖인 콘텐츠는 담을 수 없습니다/);

    excludeFromCleanup(contractId);
  });
});

describe("corrective — 빈 pin 방지(포함된 콘텐츠 0개인 채로 pin할 수 없다)", () => {
  it("staged+included 콘텐츠가 0개인 준비된 선택은 pin_session_selection()이 거부하고, status는 staged로 남으며 매니페스트는 0행이다", () => {
    const { selectionId, sessionId } = createAttachedStagedSelection();
    // 콘텐츠 항목을 하나도 만들지 않은 채(또는 만들었어도 전부 excluded인 채)
    // pin을 시도한다.

    const err = asUserExpectError(TEACHER_ID, `select pin_session_selection('${sessionId}');`);
    expect(err).toMatch(/포함된\(included\) 콘텐츠가 하나도 없는/);

    const status = psql(`select status from session_prepared_selections where id = '${selectionId}';`);
    expect(status).toBe("staged");
    const manifestCount = psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`);
    expect(manifestCount).toBe("0");
  });

  it("모든 콘텐츠 항목이 excluded인 준비된 선택도 마찬가지로 pin이 거부된다", () => {
    const { selectionId, keywordId, sessionId, unitRowId } = createAttachedStagedSelection();
    const sectionId = makeSelectableSection(keywordId);
    const itemId = asUser(
      TEACHER_ID,
      `insert into session_prepared_selection_content_items (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
       values ('${selectionId}', '${unitRowId}', 'material_section', '${sectionId}', 1) returning id;`
    );
    asUser(TEACHER_ID, `update session_prepared_selection_content_items set included = false where id = '${itemId}';`);

    const err = asUserExpectError(TEACHER_ID, `select pin_session_selection('${sessionId}');`);
    expect(err).toMatch(/포함된\(included\) 콘텐츠가 하나도 없는/);

    const status = psql(`select status from session_prepared_selections where id = '${selectionId}';`);
    expect(status).toBe("staged");
    const manifestCount = psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`);
    expect(manifestCount).toBe("0");
  });
});
