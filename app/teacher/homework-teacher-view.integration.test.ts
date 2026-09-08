import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

// Gap 2 (2026-09-08, 제품 오너 리뷰) — 교사/관리자 읽기전용 과제 제출 현황 뷰가
// 실제로 의존하는 RLS(20261245000000 problems 정책 + 기존 20261235000000/
// 20261240000000 session_homework_items/session_homework_attempts 정책)를 psql
// 직접 검증으로 확인한다. app/teacher/homework-composition-data.ts의
// loadSessionHomeworkStatus()는 여기서 검증하는 것과 똑같은 세 테이블을,
// service-role이 아니라 호출자의(요청 사용자로 스코프된) supabase 클라이언트로
// 그대로 조회한다 — 즉 이 psql 검증 결과가 곧 그 로더가 실제로 보게 될 결과다.

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

function asUser(userId: string, sql: string): string {
  return psql(`
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

let reservationOffsetDays = 7000;
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

// 이 문제는 일부러 published 교재 section에 속하지 않는 confirmed 문제로 만든다
// — 기존 "문제 조회"(20260828060000) 정책만으로는 담당 아닌 사용자(그리고
// created_by가 아닌 담당 선생님도!)에게 안 보이는 케이스를 재현해, 이번에 추가한
// 20261245000000 정책이 실제로 그 공백을 메우는지 검증하기 위함이다.
function makeInvisibleConfirmedProblem(format: "mc" | "essay", createdBy = ADMIN_ID): string {
  const options = format === "mc" ? `'["A","B","C"]'::jsonb` : "null";
  return psql(
    `insert into problems (format, passage, options, subject_id, status, created_by)
     values ('${format}', 'Gap2 테스트 문제 ${Date.now()}_${Math.random()}', ${options}, '${SUBJECT_ID}', 'confirmed', '${createdBy}') returning id;`
  );
}

function makeHomeworkItem(sessionId: string, problemId: string, studentId = STUDENT_ID): string {
  return asUser(
    ADMIN_ID,
    `insert into session_homework_items (session_id, problem_id, student_id, position, composed_by)
     values ('${sessionId}', '${problemId}', '${studentId}', 1, '${ADMIN_ID}') returning id;`
  );
}

describe("Gap 2 — 담당 선생님/관리자는 발급한 과제의 문제 내용을 다시 읽을 수 있다(20261245000000)", () => {
  it("담당 선생님은 (created_by도 아니고 published 교재 소속도 아닌) MC 문제를 읽을 수 있다", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession();
    const problemId = makeInvisibleConfirmedProblem("mc");
    makeHomeworkItem(sessionId, problemId);

    const count = asUser(TEACHER_ID, `select count(*) from problems where id = '${problemId}';`);
    expect(count).toBe("1");
    void contractId;
  });

  it("관리자는 (누가 발급했든) 문제를 읽을 수 있다(기존 is_admin() 경로와 중복이지만 회귀 확인)", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession();
    const problemId = makeInvisibleConfirmedProblem("essay");
    makeHomeworkItem(sessionId, problemId);

    const count = asUser(ADMIN_ID, `select count(*) from problems where id = '${problemId}';`);
    expect(count).toBe("1");
    void contractId;
  });

  it("담당이 아닌 다른 선생님은 발급되지 않은 문제를 읽을 수 없다(RLS 그대로 유지)", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession();
    const problemId = makeInvisibleConfirmedProblem("mc");
    makeHomeworkItem(sessionId, problemId);

    const count = asUser(OTHER_TEACHER_ID, `select count(*) from problems where id = '${problemId}';`);
    expect(count).toBe("0");
    void contractId;
  });
});

describe("Gap 2 — 담당 선생님/관리자가 학생 제출 답안을 조회한다(요구사항 4)", () => {
  it("MC 제출 답안을 세 테이블 join과 동일한 접근으로 읽을 수 있다", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession();
    const problemId = makeInvisibleConfirmedProblem("mc");
    const itemId = makeHomeworkItem(sessionId, problemId);
    asUser(
      STUDENT_ID,
      `insert into session_homework_attempts (homework_item_id, student_id, response, submitted)
       values ('${itemId}', '${STUDENT_ID}', '{"type":"mc","selected":1}'::jsonb, true);`
    );

    const itemCount = asUser(TEACHER_ID, `select count(*) from session_homework_items where id = '${itemId}';`);
    expect(itemCount).toBe("1");
    const problemCount = asUser(TEACHER_ID, `select count(*) from problems where id = '${problemId}';`);
    expect(problemCount).toBe("1");
    const response = asUser(
      TEACHER_ID,
      `select response from session_homework_attempts where homework_item_id = '${itemId}';`
    );
    expect(JSON.parse(response)).toEqual({ type: "mc", selected: 1 });
    void contractId;
  });

  it("서술형 제출 답안도 동일하게 읽을 수 있다", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession();
    const problemId = makeInvisibleConfirmedProblem("essay");
    const itemId = makeHomeworkItem(sessionId, problemId);
    asUser(
      STUDENT_ID,
      `insert into session_homework_attempts (homework_item_id, student_id, response, submitted)
       values ('${itemId}', '${STUDENT_ID}', '{"type":"text","text":"제 서술형 답안입니다"}'::jsonb, true);`
    );

    const response = asUser(
      ADMIN_ID,
      `select response from session_homework_attempts where homework_item_id = '${itemId}';`
    );
    expect(JSON.parse(response)).toEqual({ type: "text", text: "제 서술형 답안입니다" });
    void contractId;
  });
});

describe("Gap 2 — 무관한 다른 선생님은 조회할 수 없다(요구사항 5, 데이터 유출 없음 증명)", () => {
  it("session_homework_items, problems, session_homework_attempts 세 테이블 모두 0행 — '거부'와 '제출 없음'을 구분", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession();
    const problemId = makeInvisibleConfirmedProblem("mc");
    const itemId = makeHomeworkItem(sessionId, problemId);
    asUser(
      STUDENT_ID,
      `insert into session_homework_attempts (homework_item_id, student_id, response, submitted)
       values ('${itemId}', '${STUDENT_ID}', '{"type":"mc","selected":0}'::jsonb, true);`
    );

    // 실제로 제출물이 존재함(admin 관점)을 먼저 확인 — 그래야 아래 0행이
    // "제출이 없어서"가 아니라 "권한이 없어서"임이 명확해진다.
    const existsForAdmin = asUser(
      ADMIN_ID,
      `select count(*) from session_homework_attempts where homework_item_id = '${itemId}';`
    );
    expect(existsForAdmin).toBe("1");

    const itemsForOther = asUser(
      OTHER_TEACHER_ID,
      `select count(*) from session_homework_items where id = '${itemId}';`
    );
    expect(itemsForOther).toBe("0");

    const problemsForOther = asUser(
      OTHER_TEACHER_ID,
      `select count(*) from problems where id = '${problemId}';`
    );
    expect(problemsForOther).toBe("0");

    const attemptsForOther = asUser(
      OTHER_TEACHER_ID,
      `select count(*) from session_homework_attempts where homework_item_id = '${itemId}';`
    );
    expect(attemptsForOther).toBe("0");
    void contractId;
  });
});

describe("Gap 2 — 다른 학생은 여전히 배정되지 않은 과제를 읽거나 답할 수 없다(요구사항 6, 회귀)", () => {
  it("다른 학생은 session_homework_items를 조회할 수 없다", () => {
    const { sessionId, contractId } = makeEnrollmentWithSession(STUDENT_ID);
    const problemId = makeInvisibleConfirmedProblem("mc");
    const itemId = makeHomeworkItem(sessionId, problemId, STUDENT_ID);

    const count = asUser(
      OTHER_STUDENT_ID,
      `select count(*) from session_homework_items where id = '${itemId}';`
    );
    expect(count).toBe("0");
    void contractId;
  });
});
