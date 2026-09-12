import { execFileSync } from "node:child_process";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

// P2/P3 3단계 — 제품 오너 피드백 1·2·5.
//   (1) 예약 없이 회차를 준비하고, 수업이 잡히면 그 준비를 연결한다.
//   (2) 준비 저장으로는 고정되지 않고, 수업 시작에서만 고정된다.
//   (5) 준비 초안 공개는 복사본이고 두 번 눌러도 한 번만 들어간다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const OTHER_TEACHER_ID = "dddddddd-0000-0000-0000-000000000002";
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001";
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";

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
// 통합 테스트 파일마다 예약 시각이 겹치지 않도록 서로 다른 '날짜 구간'을 쓴다.
// 같은 선생님 소유 예약은 시간대가 겹칠 수 없고(reservations_no_overlap), 파일들이
// 모두 '지금 시각 + N일'로 심기 때문에 구간이 겹치면 실행 순서에 따라 깨진다.
let reservationOffsetDays = 3000 + Math.floor(Math.random() * 300) * 2;

beforeAll(() => {
  baseUnitId = psql(
    `select id from subject_template_units where subject_id = '${SUBJECT_ID}' order by position limit 1;`
  );
});

afterEach(() => {
  // 고정된 수업은 지울 수 없으므로(pin-lock) 여기서는 계약만 정리 대상으로
  // 모으고, 고정을 만든 케이스는 excludeFromCleanup으로 빼둔다 — 파일 간 정리는
  // CLAUDE.md 관례대로 `supabase db reset --local`이 담당한다.
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

function excludeFromCleanup(contractId: string): void {
  const idx = cleanupContractIds.indexOf(contractId);
  if (idx !== -1) cleanupContractIds.splice(idx, 1);
}

/** 예약도 수업도 없는 상태의 회차 하나 — 1번 요구사항의 출발점. */
function makeUnitWithoutReservation(): {
  overlayUnitId: string;
  keywordId: string;
  enrollmentId: string;
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
  const overlayId = asUser(
    TEACHER_ID,
    `insert into student_curriculum_overlays (subject_enrollment_id) values ('${enrollmentId}') returning id;`
  );
  const overlayUnitId = asUser(
    TEACHER_ID,
    `insert into curriculum_overlay_units (overlay_id, source_unit_id, position, unit_title)
     values ('${overlayId}', '${baseUnitId}', 1, '예약 없는 회차') returning id;`
  );
  const keywordId = psql(
    `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', '회차준비 ${Date.now()}_${Math.random()}') returning id;`
  );
  asUser(
    TEACHER_ID,
    `insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id) values ('${overlayUnitId}', '${keywordId}');`
  );
  return { overlayUnitId, keywordId, enrollmentId, contractId };
}

/** 나중에 예약이 잡혔을 때의 수업 하나. */
function addSessionFor(enrollmentId: string): string {
  reservationOffsetDays += 2;
  const reservationId = psql(
    `insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
     values ('lesson', '${enrollmentId}', '${TEACHER_ID}', now() + interval '${reservationOffsetDays} days', now() + interval '${reservationOffsetDays} days 1 hour', 'confirmed') returning id;`
  );
  return psql(
    `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes)
     values ('${reservationId}', '${enrollmentId}', '${TEACHER_ID}', (select id from lesson_types where code = 'regular'), 60)
     returning id;`
  );
}

function makeSelectableSection(keywordId: string): string {
  const docId = psql(
    `insert into curriculum_docs (title, subject_id, owner_type, status)
     values ('회차준비 교재 ${Date.now()}_${Math.random()}', '${SUBJECT_ID}', 'admin', 'published') returning id;`
  );
  const sectionId = psql(
    `insert into curriculum_doc_sections (curriculum_doc_id, position, title, body)
     values ('${docId}', 1, '섹션', '<p>본문</p>') returning id;`
  );
  psql(`insert into curriculum_doc_section_keywords (section_id, keyword_id) values ('${sectionId}', '${keywordId}');`);
  return sectionId;
}

function makeSelectableProblem(keywordId: string): string {
  const problemId = psql(
    `insert into problems (format, passage, subject_id, status, created_by)
     values ('mc', '회차준비 문제 ${Date.now()}_${Math.random()}', '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}') returning id;`
  );
  psql(`insert into problem_keywords (problem_id, keyword_id) values ('${problemId}', '${keywordId}');`);
  return problemId;
}

describe("1. 예약 없이 회차를 준비한다", () => {
  it("예약도 수업도 없는 회차에 목표와 교재·문제를 담을 수 있다", () => {
    const { overlayUnitId, keywordId, enrollmentId } = makeUnitWithoutReservation();
    expect(psql(`select count(*) from sessions where subject_enrollment_id = '${enrollmentId}';`)).toBe("0");

    const prepId = asUser(
      TEACHER_ID,
      `insert into curriculum_unit_preps (overlay_unit_id, goal, created_by)
       values ('${overlayUnitId}', '이차함수 그래프의 평행이동을 설명한다', '${TEACHER_ID}') returning id;`
    );
    const sectionId = makeSelectableSection(keywordId);
    const problemId = makeSelectableProblem(keywordId);
    asUser(
      TEACHER_ID,
      `insert into curriculum_unit_prep_items (prep_id, content_type, content_id, position) values
       ('${prepId}', 'material_section', '${sectionId}', 1),
       ('${prepId}', 'problem', '${problemId}', 2);`
    );

    expect(asUser(TEACHER_ID, `select goal from curriculum_unit_preps where id = '${prepId}';`)).toBe(
      "이차함수 그래프의 평행이동을 설명한다"
    );
    expect(asUser(TEACHER_ID, `select count(*) from curriculum_unit_prep_items where prep_id = '${prepId}';`)).toBe("2");
  });

  it("회차 준비는 담당 교사·관리자만 다룰 수 있고 학생에게는 보이지 않는다", () => {
    const { overlayUnitId } = makeUnitWithoutReservation();
    const prepId = asUser(
      TEACHER_ID,
      `insert into curriculum_unit_preps (overlay_unit_id, created_by) values ('${overlayUnitId}', '${TEACHER_ID}') returning id;`
    );

    expect(asUser(STUDENT_ID, `select count(*) from curriculum_unit_preps where id = '${prepId}';`)).toBe("0");
    expect(
      asUserExpectError(
        OTHER_TEACHER_ID,
        `insert into curriculum_unit_preps (overlay_unit_id, created_by) values ('${overlayUnitId}', '${OTHER_TEACHER_ID}');`
      )
    ).toMatch(/row-level security|policy/i);
    // 관리자는 커리큘럼 운영 정책대로 접근할 수 있다(피드백 6 — 전면 금지 철회).
    expect(asUser(ADMIN_ID, `select count(*) from curriculum_unit_preps where id = '${prepId}';`)).toBe("1");
  });

  it("나중에 수업이 잡히면 그 회차 준비를 수업에 연결할 수 있다", () => {
    const { overlayUnitId, keywordId, enrollmentId } = makeUnitWithoutReservation();
    const prepId = asUser(
      TEACHER_ID,
      `insert into curriculum_unit_preps (overlay_unit_id, created_by) values ('${overlayUnitId}', '${TEACHER_ID}') returning id;`
    );
    const sectionId = makeSelectableSection(keywordId);
    asUser(
      TEACHER_ID,
      `insert into curriculum_unit_prep_items (prep_id, content_type, content_id, position)
       values ('${prepId}', 'material_section', '${sectionId}', 1);`
    );

    const sessionId = addSessionFor(enrollmentId);
    const selectionId = psql(`select link_unit_prep_to_session('${overlayUnitId}', '${sessionId}', '${TEACHER_ID}');`);

    expect(psql(`select status from session_prepared_selections where id = '${selectionId}';`)).toBe("staged");
    expect(
      psql(`select count(*) from session_prepared_selection_content_items where prepared_selection_id = '${selectionId}';`)
    ).toBe("1");
    // 중복 클릭·재시도로 선택이 두 벌 생기지 않는다.
    expect(psql(`select link_unit_prep_to_session('${overlayUnitId}', '${sessionId}', '${TEACHER_ID}');`)).toBe(selectionId);
  });

  it("다른 학생·과목의 회차는 연결할 수 없고, 담당이 아닌 교사도 연결할 수 없다", () => {
    const { overlayUnitId, enrollmentId } = makeUnitWithoutReservation();
    asUser(
      TEACHER_ID,
      `insert into curriculum_unit_preps (overlay_unit_id, created_by) values ('${overlayUnitId}', '${TEACHER_ID}');`
    );
    const sessionId = addSessionFor(enrollmentId);
    expect(
      psqlExpectError(`select link_unit_prep_to_session('${overlayUnitId}', '${sessionId}', '${OTHER_TEACHER_ID}');`)
    ).toMatch(/담당 수업에만/);

    const other = makeUnitWithoutReservation();
    asUser(
      TEACHER_ID,
      `insert into curriculum_unit_preps (overlay_unit_id, created_by) values ('${other.overlayUnitId}', '${TEACHER_ID}');`
    );
    expect(
      psqlExpectError(`select link_unit_prep_to_session('${other.overlayUnitId}', '${sessionId}', '${TEACHER_ID}');`)
    ).toMatch(/다른 학생·과목/);
  });
});

describe("2. 준비 저장과 수업 시작 시점의 고정은 다르다", () => {
  function preparedSession(): { sessionId: string; overlayUnitId: string; contractId: string; problemId: string } {
    const { overlayUnitId, keywordId, enrollmentId, contractId } = makeUnitWithoutReservation();
    const prepId = asUser(
      TEACHER_ID,
      `insert into curriculum_unit_preps (overlay_unit_id, created_by) values ('${overlayUnitId}', '${TEACHER_ID}') returning id;`
    );
    const problemId = makeSelectableProblem(keywordId);
    asUser(
      TEACHER_ID,
      `insert into curriculum_unit_prep_items (prep_id, content_type, content_id, position)
       values ('${prepId}', 'problem', '${problemId}', 1);`
    );
    const sessionId = addSessionFor(enrollmentId);
    psql(`select link_unit_prep_to_session('${overlayUnitId}', '${sessionId}', '${TEACHER_ID}');`);
    return { sessionId, overlayUnitId, contractId, problemId };
  }

  it("준비를 저장하고 연결해도 수업 시작 전에는 스냅샷이 만들어지지 않는다", () => {
    const { sessionId } = preparedSession();
    expect(psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`)).toBe("0");
    expect(psql(`select status from session_prepared_selections where session_id = '${sessionId}';`)).toBe("staged");
  });

  it("수업을 시작하면 그 시점에 고정된다", () => {
    const { sessionId, contractId } = preparedSession();
    excludeFromCleanup(contractId);
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);

    expect(psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`)).toBe("1");
    expect(psql(`select status from session_prepared_selections where session_id = '${sessionId}';`)).toBe("pinned");
    expect(psql(`select final_status from sessions where id = '${sessionId}';`)).toBe("live");
  });

  it("시작한 뒤에는 콘텐츠를 고쳐도 재호출해도 스냅샷이 바뀌지 않는다", () => {
    const { sessionId, contractId, problemId } = preparedSession();
    excludeFromCleanup(contractId);
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    const snapshot = psql(
      `select content_id || '/' || coalesce(problem_version_id::text, '-') from session_content_manifest where session_id = '${sessionId}';`
    );

    // 문제 원본을 고치고 새 버전을 공개한다.
    const newVersionId = psql(
      `select create_problem_draft_version('${problemId}', '완전히 새 지문', null, null, null, null, '${ADMIN_ID}');`
    );
    psql(`select submit_problem_version_for_review('${newVersionId}', '${ADMIN_ID}');`);
    psql(`select publish_problem_version('${newVersionId}', '${ADMIN_ID}');`);

    // 재시작·재고정 시도는 전부 거부된다.
    expect(psqlExpectError(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`)).toMatch(
      /이미 시작됐거나 종료된/
    );
    expect(asUserExpectError(TEACHER_ID, `select pin_session_selection('${sessionId}');`)).toMatch(
      /staged 준비된 선택을 찾을 수 없습니다/
    );

    expect(
      psql(
        `select content_id || '/' || coalesce(problem_version_id::text, '-') from session_content_manifest where session_id = '${sessionId}';`
      )
    ).toBe(snapshot);
  });

  it("준비가 없는 수업도 시작할 수 있다(준비 없음은 오류가 아니다)", () => {
    const { enrollmentId, contractId } = makeUnitWithoutReservation();
    excludeFromCleanup(contractId);
    const sessionId = addSessionFor(enrollmentId);
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    expect(psql(`select final_status from sessions where id = '${sessionId}';`)).toBe("live");
    expect(psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`)).toBe("0");
  });

  it("이미 시작한 수업에는 회차 준비를 새로 연결할 수 없다", () => {
    const { sessionId, overlayUnitId, contractId } = preparedSession();
    excludeFromCleanup(contractId);
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    expect(
      psqlExpectError(`select link_unit_prep_to_session('${overlayUnitId}', '${sessionId}', '${TEACHER_ID}');`)
    ).toMatch(/이미 시작했거나 종료한/);
  });
});

describe("3·4. 시작 시점의 최신 준비가 고정되고, 시작과 고정은 함께 성공한다", () => {
  function linkedSession(): {
    sessionId: string;
    overlayUnitId: string;
    prepId: string;
    keywordId: string;
    enrollmentId: string;
    contractId: string;
  } {
    const { overlayUnitId, keywordId, enrollmentId, contractId } = makeUnitWithoutReservation();
    const prepId = asUser(
      TEACHER_ID,
      `insert into curriculum_unit_preps (overlay_unit_id, created_by) values ('${overlayUnitId}', '${TEACHER_ID}') returning id;`
    );
    const first = makeSelectableProblem(keywordId);
    asUser(
      TEACHER_ID,
      `insert into curriculum_unit_prep_items (prep_id, content_type, content_id, position)
       values ('${prepId}', 'problem', '${first}', 1);`
    );
    const sessionId = addSessionFor(enrollmentId);
    psql(`select link_unit_prep_to_session('${overlayUnitId}', '${sessionId}', '${TEACHER_ID}');`);
    return { sessionId, overlayUnitId, prepId, keywordId, enrollmentId, contractId };
  }

  it("연결한 뒤 준비를 고치면, 시작 시점의 최신 구성이 고정된다", () => {
    const { sessionId, prepId, keywordId, contractId } = linkedSession();
    excludeFromCleanup(contractId);

    // 연결 이후에 자료를 하나 더 담는다.
    const added = makeSelectableProblem(keywordId);
    asUser(
      TEACHER_ID,
      `insert into curriculum_unit_prep_items (prep_id, content_type, content_id, position)
       values ('${prepId}', 'problem', '${added}', 2);`
    );

    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    expect(psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`)).toBe("2");
    expect(
      psql(`select count(*) from session_content_manifest where session_id = '${sessionId}' and content_id = '${added}';`)
    ).toBe("1");
  });

  it("연결 뒤 준비에서 뺀 자료는 고정되지 않는다", () => {
    const { sessionId, prepId, contractId } = linkedSession();
    excludeFromCleanup(contractId);
    psql(`delete from curriculum_unit_prep_items where prep_id = '${prepId}';`);

    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    expect(psql(`select final_status from sessions where id = '${sessionId}';`)).toBe("live");
    expect(psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`)).toBe("0");
  });

  it("같은 회차를 두 수업에 연결하면 각각의 시작 시점 구성이 따로 고정된다", () => {
    const { sessionId, overlayUnitId, prepId, keywordId, enrollmentId, contractId } = linkedSession();
    excludeFromCleanup(contractId);

    const secondSessionId = addSessionFor(enrollmentId);
    psql(`select link_unit_prep_to_session('${overlayUnitId}', '${secondSessionId}', '${TEACHER_ID}');`);

    // 첫 수업을 먼저 시작한다(자료 1개 시점).
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    expect(psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`)).toBe("1");

    // 그 뒤 준비에 자료를 더하고 두 번째 수업을 시작한다.
    const added = makeSelectableProblem(keywordId);
    asUser(
      TEACHER_ID,
      `insert into curriculum_unit_prep_items (prep_id, content_type, content_id, position)
       values ('${prepId}', 'problem', '${added}', 2);`
    );
    psql(`select mark_lesson_session_started('${secondSessionId}', '${TEACHER_ID}');`);

    expect(psql(`select count(*) from session_content_manifest where session_id = '${secondSessionId}';`)).toBe("2");
    // 이미 시작한 첫 수업은 그대로다.
    expect(psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`)).toBe("1");
  });

  it("준비 구성을 불러오지 못하면 빈 구성으로 시작하지 않고 시작 자체가 실패한다", () => {
    const { sessionId, prepId, contractId } = linkedSession();
    excludeFromCleanup(contractId);
    // 준비 원본이 사라진 상황(조회 실패와 같은 결과)을 만든다.
    psql(`delete from curriculum_unit_preps where id = '${prepId}';`);

    expect(psqlExpectError(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`)).toMatch(
      /준비 구성을 불러오지 못했습니다/
    );
    // 시작과 고정이 함께 롤백된다 — 반쯤 시작된 상태가 남지 않는다.
    expect(psql(`select final_status from sessions where id = '${sessionId}';`)).toBe("scheduled");
    expect(psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`)).toBe("0");
  });

  it("중복 시작 요청으로 스냅샷·회차 연결이 중복되지 않는다", () => {
    const { sessionId, overlayUnitId, contractId } = linkedSession();
    excludeFromCleanup(contractId);
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    expect(psqlExpectError(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`)).toMatch(
      /이미 시작됐거나 종료된/
    );

    expect(psql(`select count(*) from session_content_manifest where session_id = '${sessionId}';`)).toBe("1");
    expect(
      psql(`select count(*) from session_curriculum_units where session_id = '${sessionId}' and overlay_unit_id = '${overlayUnitId}';`)
    ).toBe("1");
  });
});

describe("5. 교사 준비 초안 공개는 복사본이고 한 번만 들어간다", () => {
  // 공개한 필기는 append-only라 지울 수 없고, 그 필기를 참조하는 세션도 지울 수
  // 없다. 그래서 이 describe의 케이스는 정리 대상에서 빼고 파일 간 `db reset`에
  // 맡긴다(위 afterEach 주석과 같은 관례).
  function draftAndSession(): { draftId: string; sessionId: string; docId: string } {
    const { overlayUnitId, keywordId, enrollmentId, contractId } = makeUnitWithoutReservation();
    excludeFromCleanup(contractId);
    const sectionId = makeSelectableSection(keywordId);
    const docId = psql(`select curriculum_doc_id from curriculum_doc_sections where id = '${sectionId}';`);
    const draftId = psql(
      `insert into curriculum_unit_annotation_drafts (overlay_unit_id, curriculum_doc_id, author_id, strokes)
       values ('${overlayUnitId}', '${docId}', '${TEACHER_ID}', '[{"p":[1,2]},{"p":[3,4]}]'::jsonb) returning id;`
    );
    return { draftId, sessionId: addSessionFor(enrollmentId), docId };
  }

  it("공개는 교사의 명시적 호출로만 일어나고, 두 번 눌러도 필기가 중복되지 않는다", () => {
    const { draftId, sessionId } = draftAndSession();
    expect(psql(`select count(*) from session_annotation_events where session_id = '${sessionId}';`)).toBe("0");

    expect(psql(`select publish_teacher_draft_to_session('${draftId}', '${sessionId}', '${TEACHER_ID}');`)).toBe("2");
    expect(psql(`select publish_teacher_draft_to_session('${draftId}', '${sessionId}', '${TEACHER_ID}');`)).toBe("0");
    expect(psql(`select count(*) from session_annotation_events where session_id = '${sessionId}';`)).toBe("2");
  });

  it("공개한 뒤 원본 초안을 고쳐도 이미 공개된 수업 필기는 바뀌지 않는다", () => {
    const { draftId, sessionId } = draftAndSession();
    psql(`select publish_teacher_draft_to_session('${draftId}', '${sessionId}', '${TEACHER_ID}');`);
    const before = psql(
      `select string_agg(payload::text, '|' order by created_at) from session_annotation_events where session_id = '${sessionId}';`
    );

    psql(`update curriculum_unit_annotation_drafts set strokes = '[{"p":[9,9]}]'::jsonb where id = '${draftId}';`);

    expect(
      psql(
        `select string_agg(payload::text, '|' order by created_at) from session_annotation_events where session_id = '${sessionId}';`
      )
    ).toBe(before);
  });

  it("본인 초안이 아니거나 담당 수업이 아니면 공개할 수 없다", () => {
    const { draftId, sessionId } = draftAndSession();
    expect(
      psqlExpectError(`select publish_teacher_draft_to_session('${draftId}', '${sessionId}', '${OTHER_TEACHER_ID}');`)
    ).toMatch(/본인이 만든 준비 초안만/);
    expect(psql(`select count(*) from session_annotation_events where session_id = '${sessionId}';`)).toBe("0");
  });
});
