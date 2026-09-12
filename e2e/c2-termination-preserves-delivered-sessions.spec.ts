import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";

// C-2(2026-09-11, Preview UAT 결함 수정) — DB 레벨 검증: "이미 consume된 예약은
// release할 수 없습니다" 실패의 원인이었던 preview_teacher_assignment_
// termination_impact()/assert_teacher_assignment_ready_for_closure()가 연결
// 세션의 최종 판정 상태(session_final_status)를 실제로 반영하는지 psql로 직접
// 검증한다(r5-subject-enrollment-teacher-assignment.spec.ts와 동일 패턴 —
// 브라우저 없이 마이그레이션의 함수만 검증).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}
function psqlExpectError(sql: string): string {
  try {
    execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql], {
      encoding: "utf-8",
      stdio: ["ignore", "ignore", "pipe"],
    });
    throw new Error("expected psql to fail but it succeeded");
  } catch (e) {
    const err = e as { stderr?: Buffer; message: string };
    return err.stderr ? err.stderr.toString() : err.message;
  }
}

const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001"; // 박서연 (seed, rate set)
const CHILD_ID = "cccccccc-0000-0000-0000-000000000001"; // 지훈 (seed)
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math (seed)
const HOUSEHOLD_ID = "aabbccdd-0000-0000-0000-000000000001"; // 지훈 household (seed)

let lessonTypeId: string;
let createdEnrollmentIds: string[] = [];

test.beforeAll(() => {
  lessonTypeId = psql(`select id from lesson_types limit 1;`);
});

test.afterEach(() => {
  // subject_enrollments_one_live_per_subject 배타 제약 때문에 같은 학생·과목의
  // "살아있는"(planned/active/paused) 수강은 동시에 하나만 존재할 수 있다 —
  // 다음 테스트가 새로 만들기 전에 이번 테스트가 만든 픽스처를 정리한다.
  for (const id of createdEnrollmentIds) {
    psql(`delete from sessions where subject_enrollment_id = '${id}';`);
    psql(`delete from reservations where subject_enrollment_id = '${id}';`);
    psql(`delete from subject_thread_messages where thread_id in (select id from subject_threads where subject_enrollment_id = '${id}');`);
    psql(`delete from subject_threads where subject_enrollment_id = '${id}';`);
    psql(`delete from teacher_assignments where subject_enrollment_id = '${id}';`);
    const contractId = psql(`select contract_id from subject_enrollments where id = '${id}';`);
    psql(`delete from subject_enrollments where id = '${id}';`);
    psql(`delete from contracts where id = '${contractId}';`);
  }
  createdEnrollmentIds = [];
});

// 매번 독립된 enrollment+assignment+reservation+session을 만들어 테스트끼리
// 간섭하지 않게 한다(reservations_no_overlap 배타 제약 때문에도 필요).
function makeFixture(sessionFinalStatus: string, hourFromNow: number) {
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${HOUSEHOLD_ID}', '${CHILD_ID}', 'draft') returning id;`
  );
  const enrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${CHILD_ID}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
  );
  const assignmentId = psql(
    `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from)
     values ('${enrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day') returning id;`
  );
  const reservationId = psql(
    `insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
     values ('lesson', '${enrollmentId}', '${TEACHER_ID}',
       now() + interval '${hourFromNow} hours', now() + interval '${hourFromNow + 1} hours', 'confirmed')
     returning id;`
  );
  psql(
    `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes, final_status)
     values ('${reservationId}', '${enrollmentId}', '${TEACHER_ID}', '${lessonTypeId}', 60, '${sessionFinalStatus}');`
  );
  createdEnrollmentIds.push(enrollmentId);
  return { enrollmentId, assignmentId, reservationId, contractId };
}

test.describe.configure({ mode: "serial" });

test.describe("C-2 — 종료 처리가 최종 판정 끝난(이미 완료/취소 등) 예약을 손대지 않는다", () => {
  test("preview_teacher_assignment_termination_impact()가 session_final_status를 정확히 반환한다", () => {
    const { assignmentId, reservationId } = makeFixture("completed", 500);
    const row = psql(
      `select reservation_id, session_final_status from preview_teacher_assignment_termination_impact('${assignmentId}');`
    );
    expect(row).toBe(`${reservationId}|completed`);
  });

  test("assert_teacher_assignment_ready_for_closure()는 이미 완료(completed)된 세션만 남아있으면 통과한다", () => {
    const { assignmentId } = makeFixture("completed", 510);
    // psql은 procedure 호출 성공 시 별도 출력이 없다 — 예외 없이 끝나면 통과.
    expect(() => psql(`select assert_teacher_assignment_ready_for_closure('${assignmentId}');`)).not.toThrow();
  });

  test("assert_teacher_assignment_ready_for_closure()는 아직 scheduled인 세션이 남아있으면 거부한다(기존 동작 유지)", () => {
    const { assignmentId } = makeFixture("scheduled", 520);
    const err = psqlExpectError(`select assert_teacher_assignment_ready_for_closure('${assignmentId}');`);
    expect(err).toMatch(/아직 정리되지 않은 미래 예약이 1건/);
  });

  test("assert_teacher_assignment_ready_for_closure()는 진행 중(live)인 세션이 있으면 거부한다", () => {
    const { assignmentId } = makeFixture("live", 530);
    const err = psqlExpectError(`select assert_teacher_assignment_ready_for_closure('${assignmentId}');`);
    expect(err).toMatch(/아직 정리되지 않은 미래 예약이 1건/);
  });

  test("student_cancelled/teacher_no_show 등 다른 최종 판정 상태도 마찬가지로 게이트를 막지 않는다", () => {
    const { assignmentId: a1 } = makeFixture("student_cancelled", 540);
    expect(() => psql(`select assert_teacher_assignment_ready_for_closure('${a1}');`)).not.toThrow();
    const { assignmentId: a2 } = makeFixture("teacher_no_show", 550);
    expect(() => psql(`select assert_teacher_assignment_ready_for_closure('${a2}');`)).not.toThrow();
  });
});
