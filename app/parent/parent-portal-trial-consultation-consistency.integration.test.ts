import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { loadChildren } from "./children-data";
import { loadPendingRegularIntentChoices, getProgressedTrialEnrollmentIds } from "./regular-intent-data";

// (2026-09-06 제품 오너 지시 2건) 실제 앱 코드(app/parent/children-data.ts,
// app/parent/regular-intent-data.ts)를 로컬 Postgres에 대고 그대로 호출해
// 확인한다(app/consult/student-kanban-cards.integration.test.ts와 같은 로컬 DB
// 대상이지만, DB 함수 재현이 아니라 앱 레이어 함수 자체를 호출한다는 점이 다르다
// — service_role 키로 RLS를 우회해 애그리게이션 로직만 검증한다. RLS 자체는
// 기존 정책 스펙이 이미 커버한다).
//
// 1) 홈 배너(loadPendingRegularIntentChoices)가 "체험 리뷰 확정" 요건 없이
//    "체험 세션 진행/종료" 요건만으로 뜨는지, 수강 과목 탭이 쓰는 동일 기준 함수
//    (getProgressedTrialEnrollmentIds)가 정확히 같은 subject_enrollment 집합을
//    돌려주는지 확인한다.
// 2) 상담이 "체험 없이 종료"/"체험 후 종료(미전환)"로 끝난 자녀는 active
//    subject_enrollments가 없는 한 loadChildren이 숨겨야 하고, active가 있으면
//    숨기면 안 된다. 자녀가 1명뿐이고 그 자녀가 숨김 대상인 극단 케이스도 확인한다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

const supabase = createClient(
  "http://127.0.0.1:54421",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
);

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

function createAuthProfile(role: "parent" | "student", label: string): string {
  const id = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${id}', '${role}', '${label}');`);
  if (role === "student") {
    psql(`insert into students (id, grade, status) values ('${id}', '10학년', 'active');`);
  } else {
    psql(`insert into parents (id) values ('${id}');`);
  }
  return id;
}

function createHouseholdWithChild(guardianId: string, childId: string): string {
  const householdId = psql(`insert into households (primary_guardian_id) values ('${guardianId}') returning id;`);
  psql(
    `insert into household_members (household_id, profile_id, role, is_primary) values
       ('${householdId}', '${guardianId}', 'guardian', true),
       ('${householdId}', '${childId}', 'child', true);`
  );
  return householdId;
}

function createSubjectEnrollment(householdId: string, childId: string, status: string): string {
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', 'draft') returning id;`
  );
  return psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${childId}', '${SUBJECT_ID}', '${contractId}', '${status}') returning id;`
  );
}

// 예약/체험 세션을 confirm_lesson_booking 없이 직접 SQL로 만든다(entitlement grant
// 등 예약 흐름 전체 배선은 이 테스트의 관심사가 아님 — final_status/lesson_type만
// 통제된 값으로 필요).
// 매 호출마다 겹치지 않는 랜덤 시각을 쓴다(reservations_no_overlap exclusion
// 제약 — 같은 선생님·겹치는 시간대 예약을 막는다). final_status는 직접 원하는
// 값으로 insert한다(sessions의 "완료 후 직접 UPDATE 차단" 트리거는 UPDATE에만
// 걸리므로 INSERT 시점에 최종값을 넣는 건 문제없다 — finalize_lesson_session()은
// live 상태 전이가 선행돼야 하는 등 이 테스트의 관심사가 아닌 제약이 있어 우회).
function createTrialSession(subjectEnrollmentId: string, finalStatus: string): string {
  const trialLessonTypeId = psql(`select id from lesson_types where code = 'trial';`);
  const randomDaysOut = 400 + Math.floor(Math.random() * 100000);
  const startsAt = new Date(Date.now() + randomDaysOut * 60 * 60 * 1000).toISOString();
  const endsAt = new Date(new Date(startsAt).getTime() + 60 * 60000).toISOString();
  const reservationId = psql(
    `insert into reservations (kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status)
     values ('lesson', '${subjectEnrollmentId}', '${TEACHER_ID}', '${startsAt}', '${endsAt}', 'confirmed') returning id;`
  );
  return psql(
    `insert into sessions (reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes, final_status, actual_start_at, actual_end_at, finalized_at, final_actor_id)
     values ('${reservationId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${trialLessonTypeId}', 60,
       '${finalStatus}',
       case when '${finalStatus}' = 'scheduled' then null else '${startsAt}'::timestamptz end,
       case when '${finalStatus}' not in ('scheduled', 'live') then '${endsAt}'::timestamptz else null end,
       case when '${finalStatus}' not in ('scheduled', 'live') then now() else null end,
       case when '${finalStatus}' not in ('scheduled', 'live') then '${ADMIN_ID}'::uuid else null end
     ) returning id;`
  );
}

describe("홈 배너와 수강 과목 탭의 '정규 진행 희망 선택 필요' 판정 통일(실제 함수 호출)", () => {
  it("체험 리뷰가 확정되지 않았어도 체험 세션이 끝났으면 홈 배너 대상에 포함되고, 탭이 쓰는 기준 함수도 같은 과목을 반환한다", async () => {
    const guardianId = createAuthProfile("parent", "홈배너보호자1");
    const childId = createAuthProfile("student", "홈배너자녀1");
    const householdId = createHouseholdWithChild(guardianId, childId);
    const enrollmentId = createSubjectEnrollment(householdId, childId, "planned");
    createTrialSession(enrollmentId, "completed");

    const reviewCount = psql(
      `select count(*) from lesson_reviews where subject_enrollment_id = '${enrollmentId}';`
    );
    expect(reviewCount).toBe("0"); // 리뷰 미확정 케이스임을 못박음

    const pending = await loadPendingRegularIntentChoices(supabase, guardianId);
    expect(pending.map((p) => p.subjectEnrollmentId)).toEqual([enrollmentId]);

    // 수강 과목 탭이 쓰는 것과 정확히 같은 기준 함수 — 같은 과목이 나와야 두 화면의
    // "선택 필요" 판정이 통일된 것이다.
    const progressed = await getProgressedTrialEnrollmentIds(supabase, [enrollmentId]);
    expect(Array.from(progressed)).toEqual([enrollmentId]);
  });

  it("체험 세션이 아직 'scheduled'(예약만 됨)면 홈 배너/탭 기준 함수 모두 대상에서 제외한다", async () => {
    const guardianId = createAuthProfile("parent", "홈배너보호자2");
    const childId = createAuthProfile("student", "홈배너자녀2");
    const householdId = createHouseholdWithChild(guardianId, childId);
    const enrollmentId = createSubjectEnrollment(householdId, childId, "planned");
    createTrialSession(enrollmentId, "scheduled");

    const pending = await loadPendingRegularIntentChoices(supabase, guardianId);
    expect(pending.map((p) => p.subjectEnrollmentId)).not.toContain(enrollmentId);

    const progressed = await getProgressedTrialEnrollmentIds(supabase, [enrollmentId]);
    expect(Array.from(progressed)).toEqual([]);
  });

  it("이미 정규 진행 희망 선택을 마친 과목은 홈 배너 대상(pending)에서 빠지지만, 탭의 universe(progressed)에는 여전히 남는다", async () => {
    const guardianId = createAuthProfile("parent", "홈배너보호자3");
    const childId = createAuthProfile("student", "홈배너자녀3");
    const householdId = createHouseholdWithChild(guardianId, childId);
    const enrollmentId = createSubjectEnrollment(householdId, childId, "planned");
    createTrialSession(enrollmentId, "completed");
    psql(
      `insert into trial_regular_progress_selections (subject_enrollment_id, guardian_id) values ('${enrollmentId}', '${guardianId}');`
    );

    const pending = await loadPendingRegularIntentChoices(supabase, guardianId);
    expect(pending.map((p) => p.subjectEnrollmentId)).not.toContain(enrollmentId);

    const progressed = await getProgressedTrialEnrollmentIds(supabase, [enrollmentId]);
    expect(Array.from(progressed)).toEqual([enrollmentId]);
  });
});

describe("상담 중도 종료된 자녀는 보호자 포털 탭에서 숨긴다(실제 loadChildren 호출)", () => {
  it("체험 없이 종료(no_trial)되고 active 수강이 없으면 loadChildren 결과에서 빠진다", async () => {
    const guardianId = createAuthProfile("parent", "탭보호자1");
    const keptChildId = createAuthProfile("student", "탭자녀1유지");
    const hiddenChildId = createAuthProfile("student", "탭자녀1숨김");
    const householdId = psql(`insert into households (primary_guardian_id) values ('${guardianId}') returning id;`);
    psql(
      `insert into household_members (household_id, profile_id, role, is_primary) values
         ('${householdId}', '${guardianId}', 'guardian', true),
         ('${householdId}', '${keptChildId}', 'child', true),
         ('${householdId}', '${hiddenChildId}', 'child', false);`
    );

    psql(
      `insert into consultations (source, status, contact_name, contact_email, child_id, household_id, closure_type, closed_at, closure_review_text)
       values ('homepage', 'requested', '탭자녀1숨김 보호자', 'tab1-${Date.now()}@example.com', '${hiddenChildId}', '${householdId}', 'no_trial', now(), '체험 전 종료(통합테스트)');`
    );

    const children = await loadChildren(supabase, guardianId);
    expect(children.map((c) => c.studentId)).toEqual([keptChildId]);
  });

  it("체험 후 미전환(trial_no_convert)으로 종료돼도 active subject_enrollments가 있으면 숨기지 않는다", async () => {
    const guardianId = createAuthProfile("parent", "탭보호자2");
    const childId = createAuthProfile("student", "탭자녀2");
    const householdId = createHouseholdWithChild(guardianId, childId);
    createSubjectEnrollment(householdId, childId, "active");

    psql(
      `insert into consultations (source, status, contact_name, contact_email, child_id, household_id, closure_type, closed_at, closure_review_text)
       values ('homepage', 'requested', '탭자녀2 보호자', 'tab2-${Date.now()}@example.com', '${childId}', '${householdId}', 'trial_no_convert', now(), '체험 후 종료(통합테스트)');`
    );

    const children = await loadChildren(supabase, guardianId);
    expect(children.map((c) => c.studentId)).toEqual([childId]);
  });

  it("정규 계약 날인(contract_signed) 등 진행 중 종료 유형은 숨김 대상이 아니다", async () => {
    const guardianId = createAuthProfile("parent", "탭보호자3");
    const childId = createAuthProfile("student", "탭자녀3");
    const householdId = createHouseholdWithChild(guardianId, childId);

    psql(
      `insert into consultations (source, status, contact_name, contact_email, child_id, household_id, closure_type, closed_at, closure_review_text)
       values ('homepage', 'requested', '탭자녀3 보호자', 'tab3-${Date.now()}@example.com', '${childId}', '${householdId}', 'contract_signed', now(), '계약 체결(통합테스트)');`
    );

    const children = await loadChildren(supabase, guardianId);
    expect(children.map((c) => c.studentId)).toEqual([childId]);
  });

  it("자녀가 1명뿐이고 그 자녀가 중도 종료된 극단 케이스 — loadChildren이 빈 배열을 반환하며 에러 없이 완료된다", async () => {
    const guardianId = createAuthProfile("parent", "탭보호자4단독");
    const childId = createAuthProfile("student", "탭자녀4단독");
    const householdId = createHouseholdWithChild(guardianId, childId);

    psql(
      `insert into consultations (source, status, contact_name, contact_email, child_id, household_id, closure_type, closed_at, closure_review_text)
       values ('homepage', 'requested', '탭자녀4단독 보호자', 'tab4-${Date.now()}@example.com', '${childId}', '${householdId}', 'no_trial', now(), '체험 전 종료(통합테스트)');`
    );

    const children = await loadChildren(supabase, guardianId);
    expect(children).toEqual([]);
  });
});
