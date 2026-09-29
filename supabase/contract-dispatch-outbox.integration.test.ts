import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import { insertReservationInBand } from "@/test/reservation-slots";

// 2026-09-28 — 초기 고객 절차 단순화 4단계: contract_dispatch_jobs outbox.
// (docs/2026-09-26-consent-contract-simplification-implementation-plan.md)
// DB 트리거/함수 2개 지점을 직접 검증한다:
//   1) 체험 세션이 completed로 처음 전이될 때만 큐잉되고, 취소·노쇼·재전이는
//      큐잉하지 않는다(자녀당 정확히 1개, 중복 없음).
//   2) 직접생성 경로(grant_trial_entitlement_for_student)가 체험수업권을
//      지급하는 순간 direct_account_created 작업이 큐잉된다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function createChildAuthProfile(label: string): string {
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${id}', 'student', '${label}');`);
  psql(`insert into students (id, grade, status) values ('${id}', '10학년', 'active');`);
  return id;
}

function createHousehold(childId: string): string {
  const guardianId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'outbox-guardian-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${guardianId}', 'parent', '아웃박스보호자');`);
  psql(`insert into parents (id) values ('${guardianId}');`);
  const householdId = psql(`insert into households (primary_guardian_id) values ('${guardianId}') returning id;`);
  psql(
    `insert into household_members (household_id, profile_id, role, is_primary) values
       ('${householdId}', '${guardianId}', 'guardian', true),
       ('${householdId}', '${childId}', 'child', true);`
  );
  return householdId;
}

function createSubjectEnrollment(householdId: string, childId: string): string {
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', 'draft') returning id;`
  );
  return psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${childId}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
  );
}

function createSession(subjectEnrollmentId: string, lessonTypeCode: "trial" | "regular", finalStatus: string): string {
  const lessonTypeId = psql(`select id from lesson_types where code = '${lessonTypeCode}';`);
  // 재실행 안전: 공용 seed 선생님이므로 파일 전용 날짜 구간의 빈 슬롯에 넣는다.
  const reservationId = insertReservationInBand(psql, {
    band: "contract-dispatch-outbox",
    enrollmentId: subjectEnrollmentId,
    teacherId: TEACHER_ID,
  });
  const [startsAt, endsAt] = psql(
    `select starts_at::text || '|' || ends_at::text from reservations where id = '${reservationId}';`
  ).split("|");
  return psql(
    `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes, final_status, actual_start_at, actual_end_at, finalized_at, final_actor_id)
     values ('${reservationId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${lessonTypeId}', 60,
       '${finalStatus}',
       case when '${finalStatus}' = 'scheduled' then null else '${startsAt}'::timestamptz end,
       case when '${finalStatus}' not in ('scheduled', 'live') then '${endsAt}'::timestamptz else null end,
       case when '${finalStatus}' not in ('scheduled', 'live') then now() else null end,
       case when '${finalStatus}' not in ('scheduled', 'live') then '${ADMIN_ID}'::uuid else null end
     ) returning id;`
  );
}

beforeAll(() => {
  // regular_lesson_type이 seed에 있는지만 확인(테스트 전용 셋업 아님).
  const regularId = psql(`select id from lesson_types where code = 'regular';`);
  expect(regularId).toMatch(/^[0-9a-f-]{36}$/);
});

describe("contract_dispatch_jobs — 체험 세션 completed 전이 큐잉", () => {
  it("체험 세션이 completed로 끝나면 completed_trial 작업이 큐잉된다", () => {
    const childId = createChildAuthProfile("outbox-trial-완료");
    const householdId = createHousehold(childId);
    const enrollmentId = createSubjectEnrollment(householdId, childId);
    const sessionId = createSession(enrollmentId, "trial", "completed");

    const [status, triggerType] = psql(
      `select status, trigger_type from contract_dispatch_jobs where child_id = '${childId}';`
    ).split("|");
    expect(status).toBe("queued");
    expect(triggerType).toBe("completed_trial");

    void sessionId;
  });

  it("체험 세션이 취소·노쇼로 끝나면 작업을 큐잉하지 않는다", () => {
    const childId = createChildAuthProfile("outbox-trial-취소");
    const householdId = createHousehold(childId);
    const enrollmentId1 = createSubjectEnrollment(householdId, childId);
    const enrollmentId2 = createSubjectEnrollment(householdId, childId);
    createSession(enrollmentId1, "trial", "student_cancelled");
    createSession(enrollmentId2, "trial", "student_no_show");

    const jobCount = psql(`select count(*) from contract_dispatch_jobs where child_id = '${childId}';`);
    expect(jobCount).toBe("0");
  });

  it("체험 세션이 아직 scheduled면 작업을 큐잉하지 않는다", () => {
    const childId = createChildAuthProfile("outbox-trial-예정");
    const householdId = createHousehold(childId);
    const enrollmentId = createSubjectEnrollment(householdId, childId);
    createSession(enrollmentId, "trial", "scheduled");

    const jobCount = psql(`select count(*) from contract_dispatch_jobs where child_id = '${childId}';`);
    expect(jobCount).toBe("0");
  });

  it("정규(regular) 세션이 completed로 끝나도 작업을 큐잉하지 않는다", () => {
    const childId = createChildAuthProfile("outbox-정규-완료");
    const householdId = createHousehold(childId);
    const enrollmentId = createSubjectEnrollment(householdId, childId);
    createSession(enrollmentId, "regular", "completed");

    const jobCount = psql(`select count(*) from contract_dispatch_jobs where child_id = '${childId}';`);
    expect(jobCount).toBe("0");
  });

  it("같은 자녀의 체험 세션 여러 개가 completed여도 작업은 1개만 생긴다(멱등)", () => {
    const childId = createChildAuthProfile("outbox-트리얼-복수");
    const householdId = createHousehold(childId);
    const enrollmentId1 = createSubjectEnrollment(householdId, childId);
    const enrollmentId2 = createSubjectEnrollment(householdId, childId);
    createSession(enrollmentId1, "trial", "completed");
    createSession(enrollmentId2, "trial", "completed");

    const jobCount = psql(`select count(*) from contract_dispatch_jobs where child_id = '${childId}';`);
    expect(jobCount).toBe("1");
  });

});

describe("contract_dispatch_jobs — 직접생성 경로 체험수업권 지급 시 큐잉", () => {
  it("grant_trial_entitlement_for_student() 성공 시 direct_account_created 작업이 큐잉된다", () => {
    const childId = createChildAuthProfile("outbox-직접생성");
    psql(`select grant_trial_entitlement_for_student('${childId}');`);

    const [status, triggerType] = psql(
      `select status, trigger_type from contract_dispatch_jobs where child_id = '${childId}';`
    ).split("|");
    expect(status).toBe("queued");
    expect(triggerType).toBe("direct_account_created");
  });

  it("같은 자녀에게 지급 함수를 두 번 호출해도(멱등 지급) 작업은 1개만 유지된다", () => {
    const childId = createChildAuthProfile("outbox-직접생성-멱등");
    psql(`select grant_trial_entitlement_for_student('${childId}');`);
    psql(`select grant_trial_entitlement_for_student('${childId}');`);

    const jobCount = psql(
      `select count(*) from contract_dispatch_jobs where child_id = '${childId}' and trigger_type = 'direct_account_created';`
    );
    expect(jobCount).toBe("1");
  });
});
