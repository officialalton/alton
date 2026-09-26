import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

// R9 corrective(20261240000000) — Task 4가 놓친 학생 read/write 접근을 psql
// 직접 검증으로 확인한다. app/teacher/homework-composition.integration.test.ts와
// 동일한 패턴(실제 RLS/트리거를 앱 코드 없이 직접 SQL로 우회 시도).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001"; // 박서연 (seed, 지훈 담당)
const OTHER_TEACHER_ID = "dddddddd-0000-0000-0000-000000000002"; // 이도현 (무관)
const STUDENT_ID = "cccccccc-0000-0000-0000-000000000001"; // 지훈 (seed)
const OTHER_STUDENT_ID = "cccccccc-0000-0000-0000-000000000002"; // 이서아 (seed, 무관)
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
      delete from session_homework_attempts where homework_item_id in (
        select id from session_homework_items where session_id in (
          select id from sessions where subject_enrollment_id in (
            select id from subject_enrollments where contract_id = '${id}')));
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

let reservationOffsetDays = 5000;
function nextReservationOffsetDays(): number {
  reservationOffsetDays += 2;
  return reservationOffsetDays;
}

function makeEnrollmentWithSession(
  studentId = STUDENT_ID,
  teacherId = TEACHER_ID
): { enrollmentId: string; sessionId: string; contractId: string } {
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${HOUSEHOLD_ID}', '${studentId}', 'draft') returning id;`
  );
  cleanupContractIds.push(contractId);
  const enrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${studentId}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
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

// problems 정책상(20260828060000) confirmed 단독으로는 담당 아닌 사용자에게
// 안 보일 수 있으니, homework-composition.integration.test.ts와 동일하게
// published 교재의 section에 속한 confirmed 문제를 만들어 problems RLS
// 가시성 자체는 별도 이슈로 남기지 않는다. 20261240000000의 새 정책
// ("본인에게 과제로 배정된 문제는 학생도 조회")이 진짜 검증 대상이므로,
// section 유무와 무관하게 항상 통과해야 한다 — 여기서는 굳이 published 교재를
// 거치지 않고 순수 confirmed 문제로 만들어 그 새 정책 하나만 검증한다.
function makeConfirmedProblem(status: "confirmed" | "draft" = "confirmed"): string {
  return psql(
    `insert into problems (format, passage, subject_id, status, created_by)
     values ('mc', '과제 테스트 문제 ${Date.now()}_${Math.random()}', '${SUBJECT_ID}', '${status}', '${TEACHER_ID}') returning id;`
  );
}

function makeHomeworkItem(sessionId: string, problemId: string, studentId = STUDENT_ID): string {
  return asUser(
    TEACHER_ID,
    `insert into session_homework_items (session_id, problem_id, student_id, position, composed_by)
     values ('${sessionId}', '${problemId}', '${studentId}', 1, '${TEACHER_ID}') returning id;`
  );
}

describe("session_homework_items — 학생 본인 조회(corrective)", () => {
  it("학생은 본인에게 배정된 과제 항목을 조회할 수 있다", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession();
    const problemId = makeConfirmedProblem();
    const itemId = makeHomeworkItem(sessionId, problemId);

    const count = asUser(
      STUDENT_ID,
      `select count(*) from session_homework_items where id = '${itemId}';`
    );
    expect(count).toBe("1");
    void contractId;
  });

  it("다른 학생에게 배정된 과제 항목은 조회할 수 없다", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession();
    const problemId = makeConfirmedProblem();
    const itemId = makeHomeworkItem(sessionId, problemId, STUDENT_ID);

    const count = asUser(
      OTHER_STUDENT_ID,
      `select count(*) from session_homework_items where id = '${itemId}';`
    );
    expect(count).toBe("0");
    void contractId;
  });
});

describe("problems — 본인에게 배정된 문제만 학생 조회 가능(corrective)", () => {
  it("배정된 문제는 학생이 조회할 수 있다", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession();
    const problemId = makeConfirmedProblem();
    makeHomeworkItem(sessionId, problemId);

    const count = asUser(STUDENT_ID, `select count(*) from problems where id = '${problemId}';`);
    expect(count).toBe("1");
    void contractId;
  });

  it("배정되지 않은 다른 학생은 그 문제를 조회할 수 없다", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession();
    const problemId = makeConfirmedProblem();
    makeHomeworkItem(sessionId, problemId);

    const count = asUser(OTHER_STUDENT_ID, `select count(*) from problems where id = '${problemId}';`);
    expect(count).toBe("0");
    void contractId;
  });
});

describe("session_homework_attempts — 본인 답안 초안/제출(corrective)", () => {
  it("본인 학생은 배정된 과제에 초안을 저장하고 제출할 수 있다", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession();
    const problemId = makeConfirmedProblem();
    const itemId = makeHomeworkItem(sessionId, problemId);

    const attemptId = asUser(
      STUDENT_ID,
      `insert into session_homework_attempts (homework_item_id, student_id, response, submitted)
       values ('${itemId}', '${STUDENT_ID}', '"초안"'::jsonb, false) returning id;`
    );
    expect(attemptId).toMatch(/^[0-9a-f-]{36}$/);

    asUser(
      STUDENT_ID,
      `update session_homework_attempts set response = '"수정된 답"'::jsonb where id = '${attemptId}';`
    );
    const draftResponse = asUser(
      STUDENT_ID,
      `select response from session_homework_attempts where id = '${attemptId}';`
    );
    expect(draftResponse).toBe('"수정된 답"');

    asUser(
      STUDENT_ID,
      `update session_homework_attempts set submitted = true where id = '${attemptId}';`
    );
    const submittedFlag = asUser(
      STUDENT_ID,
      `select submitted from session_homework_attempts where id = '${attemptId}';`
    );
    expect(submittedFlag).toBe("t");
    void contractId;
  });

  it("제출 후에는 더 이상 수정할 수 없다(트리거가 명시적으로 거부)", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession();
    const problemId = makeConfirmedProblem();
    const itemId = makeHomeworkItem(sessionId, problemId);
    const attemptId = asUser(
      STUDENT_ID,
      `insert into session_homework_attempts (homework_item_id, student_id, response, submitted)
       values ('${itemId}', '${STUDENT_ID}', '"최종 답"'::jsonb, true) returning id;`
    );

    // RLS의 UPDATE USING절(student_id = auth.uid() and submitted = false)이
    // 이미 이 행을 "수정 대상에서 안 보이는" 상태로 걸러내므로, 이 UPDATE는
    // 에러 없이 0행에 적용된다(트리거 자체가 실행될 기회가 없음 — RLS가 더
    // 앞선 방어선). 그래서 "거부"는 명시적 에러가 아니라 "값이 절대 바뀌지
    // 않는다"로 검증한다 — 두 방어선(RLS USING + 트리거) 중 RLS가 먼저 막혔을
    // 뿐, 결과적으로 수정이 절대 반영되지 않는다는 요구사항은 동일하게 충족.
    asUser(
      STUDENT_ID,
      `update session_homework_attempts set response = '"재수정 시도"'::jsonb where id = '${attemptId}';`
    );

    const stillResponse = asUser(
      STUDENT_ID,
      `select response from session_homework_attempts where id = '${attemptId}';`
    );
    expect(stillResponse).toBe('"최종 답"');

    // 트리거 자체가 우회 불가능함은 RLS를 건너뛰는 admin/superuser 경로로
    // 직접 증명한다(psql 기본 연결은 postgres 슈퍼유저라 RLS를 아예 적용받지
    // 않으므로, 여기서의 UPDATE 실패는 오직 트리거 때문이다).
    const stderr = psqlExpectError(
      `update session_homework_attempts set response = '"슈퍼유저도 못 고침"'::jsonb where id = '${attemptId}';`
    );
    expect(stderr).toMatch(/제출된 과제 답안은 더 이상 수정할 수 없습니다/);
    void contractId;
  });

  it("본인에게 배정되지 않은 과제 항목에는 답안을 쓸 수 없다", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession(STUDENT_ID);
    const problemId = makeConfirmedProblem();
    const itemId = makeHomeworkItem(sessionId, problemId, STUDENT_ID);

    const stderr = asUserExpectError(
      OTHER_STUDENT_ID,
      `insert into session_homework_attempts (homework_item_id, student_id, response, submitted)
       values ('${itemId}', '${OTHER_STUDENT_ID}', '"몰래 답안"'::jsonb, false);`
    );
    expect(stderr).toMatch(/본인에게 배정되지 않은 과제에는 답안을 작성할 수 없습니다|row-level security|policy/i);

    const count = psql(`select count(*) from session_homework_attempts where homework_item_id = '${itemId}';`);
    expect(count).toBe("0");
    void contractId;
  });

  it("다른 학생인 척 student_id를 위조해 INSERT해도 트리거가 거부한다", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession(STUDENT_ID);
    const problemId = makeConfirmedProblem();
    const itemId = makeHomeworkItem(sessionId, problemId, STUDENT_ID);

    // BEFORE INSERT 트리거(check_homework_attempt_assigned_to_student)가 RLS
    // WITH CHECK보다 먼저 실행되므로 트리거의 명시적 에러가 먼저 뜬다 — RLS
    // WITH CHECK(student_id = auth.uid())도 독립적으로 같은 시도를 막는
    // 이중 방어선이지만, 실행 순서상 이 케이스에서 관찰되는 에러는 트리거
    // 쪽이다.
    const stderr = asUserExpectError(
      STUDENT_ID,
      `insert into session_homework_attempts (homework_item_id, student_id, response, submitted)
       values ('${itemId}', '${OTHER_STUDENT_ID}', '"위조 시도"'::jsonb, false);`
    );
    expect(stderr).toMatch(/본인에게 배정되지 않은 과제에는 답안을 작성할 수 없습니다|row-level security|policy/i);
    void contractId;
  });

  it("담당 선생님은 학생 제출 답안을 조회할 수 있다", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession();
    const problemId = makeConfirmedProblem();
    const itemId = makeHomeworkItem(sessionId, problemId);
    const attemptId = asUser(
      STUDENT_ID,
      `insert into session_homework_attempts (homework_item_id, student_id, response, submitted)
       values ('${itemId}', '${STUDENT_ID}', '"제출된 답"'::jsonb, true) returning id;`
    );

    const teacherCount = asUser(
      TEACHER_ID,
      `select count(*) from session_homework_attempts where id = '${attemptId}';`
    );
    expect(teacherCount).toBe("1");

    const adminCount = asUser(
      ADMIN_ID,
      `select count(*) from session_homework_attempts where id = '${attemptId}';`
    );
    expect(adminCount).toBe("1");

    const otherTeacherCount = asUser(
      OTHER_TEACHER_ID,
      `select count(*) from session_homework_attempts where id = '${attemptId}';`
    );
    expect(otherTeacherCount).toBe("0");
    void contractId;
  });

  it("담당 선생님은 학생 답안을 쓸 수 없다(위조 방지 — RLS insert 정책이 학생 본인만 허용)", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession();
    const problemId = makeConfirmedProblem();
    const itemId = makeHomeworkItem(sessionId, problemId);

    const stderr = asUserExpectError(
      TEACHER_ID,
      `insert into session_homework_attempts (homework_item_id, student_id, response, submitted)
       values ('${itemId}', '${STUDENT_ID}', '"선생님이 위조"'::jsonb, false);`
    );
    expect(stderr).toMatch(/row-level security|policy/i);
    void contractId;
  });
});

describe("과제 발급 후 unconfirmed가 된 문제 — 항목은 유지, 콘텐츠 접근은 앱 레이어가 재검증(corrective)", () => {
  it("problems.status가 나중에 draft로 바뀌어도 session_homework_items 행은 그대로 남는다(DB는 삭제하지 않음)", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession();
    const problemId = makeConfirmedProblem("confirmed");
    const itemId = makeHomeworkItem(sessionId, problemId);

    psql(`update problems set status = 'draft' where id = '${problemId}';`);

    const count = asUser(
      STUDENT_ID,
      `select count(*) from session_homework_items where id = '${itemId}';`
    );
    expect(count).toBe("1");

    const status = psql(`select status from problems where id = '${problemId}';`);
    expect(status).toBe("draft");
    void contractId;
  });
});
