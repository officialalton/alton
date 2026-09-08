import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

// R9(레슨 준비 Task 4) — session_homework_items/check_homework_item_problem_confirmed
// (supabase/migrations/20261235000000_r9_homework_composition.sql)의 DB 레벨
// 강제(confirmed 게이트, RLS)를 session-content-manifest.integration.test.ts와
// 동일한 psql 직접 검증 패턴으로 확인한다. composeHomeworkFromSession() 자체
// (후보 풀 계산/토글 필터링)는 app/teacher/homework-composition-toggles.test.ts가
// 가짜 supabase 클라이언트로 이미 검증했다 — 이 파일은 "앱 코드를 우회해도
// DB가 막는가"만 겨냥한다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001"; // 박서연 (seed, 지훈 담당)
const OTHER_TEACHER_ID = "dddddddd-0000-0000-0000-000000000002"; // 이도현 (seed, 무관한 제3자)
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001"; // 지훈 (seed)
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math

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

const cleanupContractIds: string[] = [];

afterEach(() => {
  for (const id of cleanupContractIds.splice(0)) {
    psql(`
      delete from session_homework_items where session_id in (select id from sessions where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}'));
      delete from sessions where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from reservations where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from subject_threads where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from teacher_assignments where subject_enrollment_id in (select id from subject_enrollments where contract_id = '${id}');
      delete from subject_enrollments where contract_id = '${id}';
      delete from contracts where id = '${id}';
    `);
  }
});

let reservationOffsetDays = 3000;
function nextReservationOffsetDays(): number {
  reservationOffsetDays += 2;
  return reservationOffsetDays;
}

function makeEnrollmentWithSession(teacherId = TEACHER_ID): { enrollmentId: string; sessionId: string; contractId: string } {
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
     values ('${enrollmentId}', '${teacherId}', 'active', now() - interval '1 day');`
  );
  const offset = nextReservationOffsetDays();
  const reservationId = psql(
    `insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
     values ('lesson', '${enrollmentId}', '${teacherId}', now() + interval '${offset} days', now() + interval '${offset} days 1 hour', 'confirmed') returning id;`
  );
  const sessionId = psql(
    `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes)
     values ('${reservationId}', '${enrollmentId}', '${teacherId}', (select id from lesson_types where code = 'regular'), 60)
     returning id;`
  );
  return { enrollmentId, sessionId, contractId };
}

function makeProblem(status: "confirmed" | "draft"): string {
  return psql(
    `insert into problems (format, passage, subject_id, status, created_by)
     values ('mc', 'Task4 테스트 문제 ${Date.now()}_${Math.random()}', '${SUBJECT_ID}', '${status}', '${TEACHER_ID}') returning id;`
  );
}

// RLS 테스트 전용: problems의 "문제 조회" 정책(20260828060000)상 created_by가
// 아닌 다른 선생님에게는 confirmed 단독으로는 보이지 않는다(section이 published
// 교재에 속해야 누구에게나 보인다) — session_homework_items 자체의 RLS(담당
// 선생님/관리자만)를 순수하게 겨냥하려면 problems 쪽 가시성부터 확보해야 한다.
function makeVisibleConfirmedProblem(): string {
  const docId = psql(
    `insert into curriculum_docs (title, subject_id, owner_type, status)
     values ('Task4 테스트 교재 ${Date.now()}_${Math.random()}', '${SUBJECT_ID}', 'admin', 'published') returning id;`
  );
  const sectionId = psql(
    `insert into curriculum_doc_sections (curriculum_doc_id, position, title, body)
     values ('${docId}', 1, '테스트 섹션', '<p>본문</p>') returning id;`
  );
  return psql(
    `insert into problems (format, passage, subject_id, section_id, status, created_by)
     values ('mc', 'Task4 테스트 문제(공개) ${Date.now()}_${Math.random()}', '${SUBJECT_ID}', '${sectionId}', 'confirmed', '${ADMIN_ID}') returning id;`
  );
}

describe("session_homework_items — confirmed 게이트(DB 레벨, 앱 코드 우회해도 막힘)", () => {
  it("confirmed 문제는 정상적으로 insert된다", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession();
    const problemId = makeProblem("confirmed");

    const id = asUser(
      TEACHER_ID,
      `insert into session_homework_items (session_id, problem_id, student_id, position, composed_by)
       values ('${sessionId}', '${problemId}', '${STUDENT_ID}', 1, '${TEACHER_ID}') returning id;`
    );
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    void contractId;
  });

  it("confirmed가 아닌 문제를 담당 선생님이 직접 SQL로 insert 시도해도 트리거가 거부한다", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession();
    const draftProblemId = makeProblem("draft");

    const stderr = asUserExpectError(
      TEACHER_ID,
      `insert into session_homework_items (session_id, problem_id, student_id, position, composed_by)
       values ('${sessionId}', '${draftProblemId}', '${STUDENT_ID}', 1, '${TEACHER_ID}');`
    );
    expect(stderr).toMatch(/confirmed 상태가 아닌 문제는 과제로 발급할 수 없습니다/);

    const count = psql(`select count(*) from session_homework_items where session_id = '${sessionId}';`);
    expect(count).toBe("0");
    void contractId;
  });

  it("존재하지 않는 문제 id는 거부한다", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession();
    const stderr = asUserExpectError(
      TEACHER_ID,
      `insert into session_homework_items (session_id, problem_id, student_id, position, composed_by)
       values ('${sessionId}', gen_random_uuid(), '${STUDENT_ID}', 1, '${TEACHER_ID}');`
    );
    expect(stderr).toMatch(/존재하지 않는 문제입니다/);
    void contractId;
  });
});

describe("session_homework_items — RLS(세션 담당 선생님/관리자만 쓰기·읽기)", () => {
  it("담당이 아닌 다른 선생님은 insert할 수 없다(RLS)", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession(TEACHER_ID);
    const problemId = makeVisibleConfirmedProblem();

    const stderr = asUserExpectError(
      OTHER_TEACHER_ID,
      `insert into session_homework_items (session_id, problem_id, student_id, position, composed_by)
       values ('${sessionId}', '${problemId}', '${STUDENT_ID}', 1, '${OTHER_TEACHER_ID}');`
    );
    expect(stderr).toMatch(/row-level security|policy/i);
    void contractId;
  });

  it("담당이 아닌 다른 선생님은 조회할 수도 없다(RLS)", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession(TEACHER_ID);
    const problemId = makeVisibleConfirmedProblem();
    asUser(
      TEACHER_ID,
      `insert into session_homework_items (session_id, problem_id, student_id, position, composed_by)
       values ('${sessionId}', '${problemId}', '${STUDENT_ID}', 1, '${TEACHER_ID}');`
    );

    const rows = asUser(OTHER_TEACHER_ID, `select count(*) from session_homework_items where session_id = '${sessionId}';`);
    expect(rows).toBe("0");
    void contractId;
  });

  it("관리자는 조회·쓰기 모두 가능하다", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession(TEACHER_ID);
    const problemId = makeProblem("confirmed");

    const id = asUser(
      ADMIN_ID,
      `insert into session_homework_items (session_id, problem_id, student_id, position, composed_by)
       values ('${sessionId}', '${problemId}', '${STUDENT_ID}', 1, '${ADMIN_ID}') returning id;`
    );
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const rows = asUser(ADMIN_ID, `select count(*) from session_homework_items where session_id = '${sessionId}';`);
    expect(rows).toBe("1");
    void contractId;
  });

  it("담당 선생님은 조회·쓰기 모두 가능하다", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession(TEACHER_ID);
    const problemId = makeProblem("confirmed");

    asUser(
      TEACHER_ID,
      `insert into session_homework_items (session_id, problem_id, student_id, position, composed_by)
       values ('${sessionId}', '${problemId}', '${STUDENT_ID}', 1, '${TEACHER_ID}');`
    );
    const rows = asUser(TEACHER_ID, `select count(*) from session_homework_items where session_id = '${sessionId}';`);
    expect(rows).toBe("1");
    void contractId;
  });
});

