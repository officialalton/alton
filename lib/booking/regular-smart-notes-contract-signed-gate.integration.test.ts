import { execFileSync } from "node:child_process";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

// 2026-09-28 — 정규 수업 AI 기록(Smart Notes)은 가족계약 서명(contracts.status=
// 'active') 완료 후에만 적용된다(docs/2026-09-28-post-signature-smart-notes-transcription-plan.md,
// 20261900000031_p0_regular_smart_notes_contract_signed_gate.sql). 이 파일은 그
// 게이트를 confirm_lesson_booking() 레벨에서 직접 고정한다. psql shell-out 패턴은
// lib/booking/trial-entitlement-and-cancellation.integration.test.ts와 동일.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001"; // 박서연
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

let regularLessonTypeId: string;
let lessonPackProductId: string;

// 같은 시드 선생님(박서연)을 다른 통합 테스트도 같은 날짜 17~18시 UTC 부근에 예약하므로
// 무작위 분만으로는 teacher_buffer_violation을 피하지 못한다. 후보 시간 중
// violates_teacher_buffer()가 false인 첫 슬롯을 고른다(검증 대상과 무관한 충돌만 제거).
const CANDIDATE_HOURS_UTC = [18, 15, 16, 19, 20, 21, 22];
function futureSlot(daysFromNow: number, durationMinutes = 60): { startsAt: string; endsAt: string } {
  for (const hour of CANDIDATE_HOURS_UTC) {
    const startsAtDate = new Date();
    startsAtDate.setUTCDate(startsAtDate.getUTCDate() + daysFromNow);
    startsAtDate.setUTCHours(hour, Math.floor(Math.random() * 50), 0, 0);
    const startsAt = startsAtDate.toISOString();
    const endsAt = new Date(startsAtDate.getTime() + durationMinutes * 60000).toISOString();
    const busy = psql(`select violates_teacher_buffer('${TEACHER_ID}', '${startsAt}', '${endsAt}');`);
    if (busy === "f") return { startsAt, endsAt };
  }
  throw new Error(`futureSlot: ${daysFromNow}일 뒤 선생님 빈 슬롯을 찾지 못함`);
}


function makeChildWithEnrollment(contractStatus: "draft" | "active"): {
  childId: string;
  subjectEnrollmentId: string;
} {
  const now = Date.now() + Math.floor(Math.random() * 100000);
  const authEmail = `m4-smart-notes-gate-${now}@example.com`;
  const childId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${authEmail}', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`
    insert into profiles (id, role, name, date_of_birth) values ('${childId}', 'student', 'Smart Notes 게이트 테스트 학생', now() - interval '17 years');
    insert into students (id, grade, status) values ('${childId}', '10학년', 'active');
  `);
  const householdId = psql(`insert into households (primary_guardian_id) values (null) returning id;`);
  psql(
    `insert into household_members (household_id, profile_id, role, is_primary)
     values ('${householdId}', '${childId}', 'child', true);`
  );
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', '${contractStatus}') returning id;`
  );
  const subjectEnrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${childId}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
  );
  psql(
    `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, source)
     values ('${subjectEnrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day', 'app');`
  );
  const grantId = psql(
    `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
     values ('${childId}', '${lessonPackProductId}', null, 10, now() + interval '180 days', true) returning id;`
  );
  psql(
    `insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'grant', 10, 'smart-notes-gate-${now}');`
  );
  return { childId, subjectEnrollmentId };
}

beforeAll(() => {
  regularLessonTypeId = psql(`select id from lesson_types where code = 'regular';`);
  lessonPackProductId = psql(`select id from entitlement_products where code = 'lesson_pack_10';`);
  psql(
    `insert into teacher_availability_rules (teacher_id, day_of_week, start_time_local, end_time_local, timezone, created_by)
     select '${TEACHER_ID}', d, '00:00', '23:59', 'America/Los_Angeles', '${ADMIN_ID}'
     from generate_series(0,6) d
     where not exists (
       select 1 from teacher_availability_rules where teacher_id = '${TEACHER_ID}' and day_of_week = d
     );`
  );
});

afterAll(() => {
  psql(`delete from teacher_availability_rules where teacher_id = '${TEACHER_ID}' and created_by = '${ADMIN_ID}';`);
});

describe("정규 수업 Smart Notes — 계약 서명 여부에 따른 게이트", () => {
  it("계약이 서명(active) 전이면 정규 수업도 smart_notes_status='not_applicable'로 시작한다", () => {
    const { childId, subjectEnrollmentId } = makeChildWithEnrollment("draft");
    const { startsAt, endsAt } = futureSlot(2);
    const sessionId = psql(
      `select session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${regularLessonTypeId}', '${startsAt}', '${endsAt}', 'smart-notes-gate-unsigned-${Date.now()}');`
    );
    const status = psql(`select smart_notes_status from sessions where id = '${sessionId}';`);
    expect(status).toBe("not_applicable");
  });

  it("계약이 서명(active) 완료면 정규 수업은 smart_notes_status='pending'으로 시작한다", () => {
    const { childId, subjectEnrollmentId } = makeChildWithEnrollment("active");
    const { startsAt, endsAt } = futureSlot(3);
    const sessionId = psql(
      `select session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${regularLessonTypeId}', '${startsAt}', '${endsAt}', 'smart-notes-gate-signed-${Date.now()}');`
    );
    const status = psql(`select smart_notes_status from sessions where id = '${sessionId}';`);
    expect(status).toBe("pending");
  });

  it("체험 예약은 계약 서명 여부와 무관하게 항상 smart_notes_status='not_applicable'이다(회귀 방지)", () => {
    const trialLessonTypeId = psql(`select id from lesson_types where code = 'trial';`);
    const trialProductId = psql(`select id from entitlement_products where code = 'trial_lesson_grant';`);
    const { childId, subjectEnrollmentId } = makeChildWithEnrollment("active");
    const grantId = psql(
      `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
       values ('${childId}', '${trialProductId}', null, 1, now() + interval '90 days', false) returning id;`
    );
    psql(
      `insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'grant', 1, 'smart-notes-gate-trial-${Date.now()}');`
    );
    const { startsAt, endsAt } = futureSlot(4);
    const sessionId = psql(
      `select session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${trialLessonTypeId}', '${startsAt}', '${endsAt}', 'smart-notes-gate-trial-booking-${Date.now()}');`
    );
    const status = psql(`select smart_notes_status from sessions where id = '${sessionId}';`);
    expect(status).toBe("not_applicable");
  });
});
