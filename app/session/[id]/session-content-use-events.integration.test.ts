import { execFileSync } from "node:child_process";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

// R9(레슨 준비 Task 3) — session_content_use_events(append-only 이벤트 로그,
// supabase/migrations/20261234000000_r9_session_content_use_events.sql)를
// session-content-manifest.integration.test.ts와 동일한 psql 직접 검증 패턴으로
// 테스트한다. 매니페스트를 실제로 pin해야 "사용 처리"할 대상 행이 생기므로,
// Task 2 테스트의 셋업 헬퍼(오버레이 단원+키워드→선택 가능한 섹션/문제→staged
// 선택→pin)를 그대로 재사용한다.

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

// session-content-manifest.integration.test.ts와 동일한 이유: pin된
// session_prepared_selections 행은(20261236000000_r9_corrective_remove_pin_lock_
// bypass.sql 이후) 어떤 bypass도 없이 세션 삭제조차 막는다(session_id를 null로
// 되돌리는 시도까지 pin-lock 트리거가 거부). 이 테스트 스위트는 매니페스트를
// pin해야만 대상 행이 생기므로, pin한 fixture는 afterEach 자동 정리 대상에서
// 뺀다(전체 스위트 사이의 supabase db reset --local이 최종적으로 청소한다).
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
      set app.bypass_content_use_event_lock = 'true';
      delete from session_content_use_events where session_id in (select id from sessions where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}'));
      delete from sessions where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from reservations where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from subject_threads where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from teacher_assignments where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from subject_enrollments where contract_id = '${id}';
      delete from contracts where id = '${id}';
    `);
  }
});

// 큰 임의 베이스에서 시작해, 이전 실행에서 excludeFromCleanup으로 남겨진(정리되지
// 않은) pinned fixture의 예약 슬롯과 겹치지 않게 한다(reservations_no_overlap
// 배타 제약).
let reservationOffsetDays = 5000 + Math.floor(Math.random() * 50000);
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
     values ('${overlayId}', '${baseUnitId}', 1, 'Task3 테스트 단원') returning id;`
  );
  const keywordId = psql(
    `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', 'Task3키워드 ${Date.now()}_${Math.random()}') returning id;`
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
     values ('Task3 테스트 교재 ${Date.now()}_${Math.random()}', '${SUBJECT_ID}', 'admin', 'published') returning id;`
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
     values ('mc', 'Task3 테스트 문제 ${Date.now()}_${Math.random()}', '${SUBJECT_ID}', 'confirmed', '${TEACHER_ID}') returning id;`
  );
  psql(`insert into problem_keywords (problem_id, keyword_id) values ('${problemId}', '${keywordId}');`);
  return problemId;
}

// staged 선택을 만들고 pick+pin까지 끝낸 뒤, "매니페스트에 실제로 들어있는"
// sectionId/problemId를 돌려준다. Task 3의 대상은 항상 이 pin된 매니페스트다.
function makePinnedSessionWithManifest(): {
  sessionId: string;
  contractId: string;
  sectionId: string;
  problemId: string;
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
  excludeFromCleanup(contractId);
  return { sessionId, contractId, sectionId, problemId };
}

function countEvents(sessionId: string): number {
  return Number(psql(`select count(*) from session_content_use_events where session_id = '${sessionId}';`));
}

describe("session_content_use_events — 명시적 사용 처리 이벤트 (실제 DB)", () => {
  it("(1) 교사가 교재 섹션/문제를 사용 처리하면 정확히 한 행씩, 올바른 content_type/content_id/recorded_by로 기록된다", () => {
    const { sessionId, sectionId, problemId } = makePinnedSessionWithManifest();

    asUser(
      TEACHER_ID,
      `insert into session_content_use_events (session_id, content_type, content_id, recorded_by)
       values ('${sessionId}', 'material_section', '${sectionId}', '${TEACHER_ID}');`
    );
    asUser(
      TEACHER_ID,
      `insert into session_content_use_events (session_id, content_type, content_id, recorded_by)
       values ('${sessionId}', 'problem', '${problemId}', '${TEACHER_ID}');`
    );

    expect(countEvents(sessionId)).toBe(2);

    const rows = psql(
      `select content_type, content_id, recorded_by from session_content_use_events
       where session_id = '${sessionId}' order by recorded_at asc;`
    )
      .split("\n")
      .map((l) => l.split("|"));
    expect(rows).toEqual([
      ["material_section", sectionId, TEACHER_ID],
      ["problem", problemId, TEACHER_ID],
    ]);
  });

  it("(2) 기존 이벤트는 UPDATE도 DELETE도 불가능하다(append-only 트리거가 거부)", () => {
    const { sessionId, sectionId } = makePinnedSessionWithManifest();
    asUser(
      TEACHER_ID,
      `insert into session_content_use_events (session_id, content_type, content_id, recorded_by)
       values ('${sessionId}', 'material_section', '${sectionId}', '${TEACHER_ID}');`
    );

    expect(
      psqlExpectError(
        `update session_content_use_events set content_id = gen_random_uuid() where session_id = '${sessionId}';`
      )
    ).toMatch(/append-only/);

    expect(
      psqlExpectError(`delete from session_content_use_events where session_id = '${sessionId}';`)
    ).toMatch(/append-only/);

    // 트리거는 role과 무관하게 차단한다 — superuser(psql 기본 role) 직접 호출로도
    // 막힌다는 것을 위에서 이미 증명했다. 여전히 정확히 1행 남아 있어야 한다.
    expect(countEvents(sessionId)).toBe(1);
  });

  it("(3) 학생은 이 테이블에 쓰지도 읽지도 못한다(RLS가 양방향 모두 거부)", () => {
    const { sessionId, sectionId } = makePinnedSessionWithManifest();
    asUser(
      TEACHER_ID,
      `insert into session_content_use_events (session_id, content_type, content_id, recorded_by)
       values ('${sessionId}', 'material_section', '${sectionId}', '${TEACHER_ID}');`
    );

    expect(() =>
      asUser(
        STUDENT_ID,
        `insert into session_content_use_events (session_id, content_type, content_id, recorded_by)
         values ('${sessionId}', 'material_section', '${sectionId}', '${STUDENT_ID}');`
      )
    ).toThrow(/row-level security|policy/i);

    // 읽기: 학생 role로는 SELECT 정책이 없으므로 0행이 나온다(에러가 아니라
    // "안 보인다" — RLS select 정책 부재는 기본적으로 조용히 0행을 반환한다).
    const seenByStudent = asUser(
      STUDENT_ID,
      `select count(*) from session_content_use_events where session_id = '${sessionId}';`
    );
    expect(seenByStudent).toBe("0");
  });

  it("(4) 교재/문제 탭을 여는 것만으로는(명시적 사용 처리 없이) 이벤트가 전혀 생기지 않는다 — '봤다 ≠ 사용했다' 회귀 증명", () => {
    const { sessionId } = makePinnedSessionWithManifest();
    // 탭을 여는 행위는 session-content-data.ts의 loadSessionContentManifest()
    // (순수 SELECT)만 호출한다 — INSERT 경로가 전혀 없으므로, 여러 번 읽어도
    // 이벤트 테이블은 계속 0행이어야 한다.
    asUser(
      TEACHER_ID,
      `select id, content_type, content_id from session_content_manifest where session_id = '${sessionId}' order by display_position;`
    );
    asUser(
      TEACHER_ID,
      `select id, content_type, content_id from session_content_manifest where session_id = '${sessionId}' order by display_position;`
    );
    expect(countEvents(sessionId)).toBe(0);
  });

  it("(5) 이 세션의 매니페스트에 없는 콘텐츠를 사용 처리하려 하면 거부되고 0행이다(복합 FK)", () => {
    const { sessionId } = makePinnedSessionWithManifest();
    // 실제로 존재하는 유효한 문제이지만, 이 세션의 매니페스트에는 절대 pin되지
    // 않은(다른 키워드로 만든, 이 selection과 무관한) 문제를 대상으로 삼는다.
    const otherKeywordId = psql(
      `insert into subject_keywords (subject_id, label) values ('${SUBJECT_ID}', 'Task3무관키워드 ${Date.now()}_${Math.random()}') returning id;`
    );
    const foreignProblemId = makeSelectableProblem(otherKeywordId);

    const stderr = asUserExpectError(
      TEACHER_ID,
      `insert into session_content_use_events (session_id, content_type, content_id, recorded_by)
       values ('${sessionId}', 'problem', '${foreignProblemId}', '${TEACHER_ID}');`
    );
    expect(stderr).toMatch(/foreign key|violates/i);
    expect(countEvents(sessionId)).toBe(0);
  });

  it("(6) 매니페스트에 있는 콘텐츠는 관리자도(교사뿐 아니라) 사용 처리할 수 있다", () => {
    const { sessionId, sectionId } = makePinnedSessionWithManifest();
    expect(() =>
      asUser(
        ADMIN_ID,
        `insert into session_content_use_events (session_id, content_type, content_id, recorded_by)
         values ('${sessionId}', 'material_section', '${sectionId}', '${ADMIN_ID}');`
      )
    ).not.toThrow();
    expect(countEvents(sessionId)).toBe(1);
  });

  it("세션과 무관한 제3자 선생님은 이 세션 콘텐츠를 사용 처리할 수 없다", () => {
    const { sessionId, sectionId } = makePinnedSessionWithManifest();
    expect(() =>
      asUser(
        OTHER_TEACHER_ID,
        `insert into session_content_use_events (session_id, content_type, content_id, recorded_by)
         values ('${sessionId}', 'material_section', '${sectionId}', '${OTHER_TEACHER_ID}');`
      )
    ).toThrow(/row-level security|policy/i);
  });

  it("recorded_by를 자기 자신이 아닌 값으로 위조해 기록할 수 없다", () => {
    const { sessionId, sectionId } = makePinnedSessionWithManifest();
    expect(() =>
      asUser(
        TEACHER_ID,
        `insert into session_content_use_events (session_id, content_type, content_id, recorded_by)
         values ('${sessionId}', 'material_section', '${sectionId}', '${OTHER_TEACHER_ID}');`
      )
    ).toThrow(/row-level security|policy/i);
  });
});
