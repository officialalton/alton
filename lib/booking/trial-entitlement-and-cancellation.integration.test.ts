import { execFileSync } from "node:child_process";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

// M4 인수 기준 13번 — 아직 전용 테스트로 확인되지 않았던 3가지를 로컬 Postgres에
// 직접 psql로 명시적으로 못박는다(새 기능 구현 아님, 기존 R6/M2 메커니즘 고정):
//  1) 90일 만료 이후 시작하는 체험 예약 차단(entitlement_grants.expires_at 기준,
//     hold_entitlement()이 이미 구현).
//  2) 24시간 기준 취소 처리 — 학생 취소가 24시간 미만이면 소진(consume),
//     24시간 이상이면 해제(release)(cancel_lesson_booking()이 이미 구현).
// 이 파일은 app/admin/trial-sessions-guardian-consent.integration.test.ts와
// 동일한 psql shell-out 패턴을 그대로 재사용한다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const TEACHER_ID = "dddddddd-0000-0000-0000-000000000001"; // 박서연
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

let childId: string;
let subjectEnrollmentId: string;
let trialLessonTypeId: string;
let trialProductId: string;

beforeAll(() => {
  trialLessonTypeId = psql(`select id from lesson_types where code = 'trial';`);
  trialProductId = psql(`select id from entitlement_products where code = 'trial_lesson_grant';`);

  const now = Date.now();
  const authEmail = `m4-integration-${now}@example.com`;
  childId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${authEmail}', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`
    insert into profiles (id, role, name) values ('${childId}', 'student', 'M4 통합테스트 학생');
    insert into students (id, grade, status) values ('${childId}', '10학년', 'active');
  `);

  const householdId = psql(
    `insert into households (primary_guardian_id) values (null) returning id;`
  );
  psql(
    `insert into household_members (household_id, profile_id, role, is_primary)
     values ('${householdId}', '${childId}', 'child', true);`
  );
  const contractId = psql(
    `insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', 'draft') returning id;`
  );
  subjectEnrollmentId = psql(
    `insert into subject_enrollments (child_id, subject_id, contract_id, status)
     values ('${childId}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`
  );
  psql(
    `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, source)
     values ('${subjectEnrollmentId}', '${TEACHER_ID}', 'active', now() - interval '1 day', 'app');`
  );
  psql(
    `insert into teacher_availability_rules (teacher_id, day_of_week, start_time_local, end_time_local, timezone, created_by)
     select '${TEACHER_ID}', d, '00:00', '23:59', 'America/Los_Angeles', '${ADMIN_ID}' from generate_series(0,6) d;`
  );
});

afterAll(() => {
  // entitlement_ledger는 INSERT-only(불변) 트리거로 보호되고, 그 FK가 grant_id/
  // reservation_id 양쪽 다 ON DELETE NO ACTION이라 이 스펙이 만든 entitlement_
  // grants/reservations/sessions는 정리할 수 없다 — 다른 R6/M2 통합 테스트와
  // 동일하게 그 부분은 다음 `npx supabase db reset --local`로 정리되는 것을
  // 전제로 하고, 여기서는 선생님 가능시간 규칙만 정리한다(다른 스펙의 예약
  // 슬롯과 충돌하지 않도록).
  psql(`delete from teacher_availability_rules where teacher_id = '${TEACHER_ID}' and created_by = '${ADMIN_ID}';`);
});

describe("90일 체험수업권 만료 이후 예약 차단", () => {
  it("이미 만료된 grant만 있으면 체험 예약(hold_entitlement)을 거부한다", () => {
    const grantId = psql(
      `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
       values ('${childId}', '${trialProductId}', null, 1, now() - interval '1 day', false) returning id;`
    );
    psql(`insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'grant', 1, 'integration-expired-${Date.now()}');`);

    const startsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const endsAt = new Date(new Date(startsAt).getTime() + 60 * 60000).toISOString();

    expect(() =>
      psql(
        `select confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${trialLessonTypeId}', '${startsAt}', '${endsAt}', 'integration-expired-booking-${Date.now()}');`
      )
    ).toThrow(/사용 가능한 수업권이 없습니다/);
    void grantId; // entitlement_ledger/entitlement_grants는 INSERT-only 정리 대상이 아님 — db reset으로 정리.
  });

  it("만료 전(90일 이내) grant가 있으면 같은 조건의 예약이 성공한다", () => {
    const grantId = psql(
      `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
       values ('${childId}', '${trialProductId}', null, 1, now() + interval '90 days', false) returning id;`
    );
    psql(`insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'grant', 1, 'integration-valid-${Date.now()}');`);

    const startsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const endsAt = new Date(new Date(startsAt).getTime() + 60 * 60000).toISOString();
    const sessionId = psql(
      `select session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${trialLessonTypeId}', '${startsAt}', '${endsAt}', 'integration-valid-booking-${Date.now()}');`
    );
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);

    const holdCount = psql(`select count(*) from entitlement_ledger where grant_id = '${grantId}' and event_type = 'hold';`);
    expect(holdCount).toBe("1");
  });
});

describe("24시간 기준 취소 처리(release vs 소진)", () => {
  function grantFreshTrialEntitlement(): string {
    const grantId = psql(
      `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
       values ('${childId}', '${trialProductId}', null, 1, now() + interval '90 days', false) returning id;`
    );
    psql(`insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'grant', 1, 'integration-cancel-${Date.now()}-${grantId}');`);
    return grantId;
  }

  it("학생이 수업 시작 24시간 이상 전에 취소하면 수업권을 소진하지 않고 해제(release)한다", () => {
    const grantId = grantFreshTrialEntitlement();
    const startsAt = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(); // 6일 뒤 — 24시간 이상 여유
    const endsAt = new Date(new Date(startsAt).getTime() + 60 * 60000).toISOString();
    const reservationSessionRow = psql(
      `select reservation_id, session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${trialLessonTypeId}', '${startsAt}', '${endsAt}', 'integration-release-${Date.now()}');`
    );
    const reservationId = reservationSessionRow.split("|")[0];

    psql(`select cancel_lesson_booking('${reservationId}', 'student', '${childId}', '통합테스트 — 24시간 이상 전 취소');`);

    const eventType = psql(`select event_type from entitlement_ledger where grant_id = '${grantId}' and reservation_id = '${reservationId}' and event_type in ('consume','release');`);
    expect(eventType).toBe("release");

    // 소진되지 않았으므로 같은 grant로 재예약이 가능해야 한다(요구사항: 24시간
    // 이상 전 취소는 release + 90일 내 재예약 가능).
    const rebookStartsAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
    const rebookEndsAt = new Date(new Date(rebookStartsAt).getTime() + 60 * 60000).toISOString();
    const rebookSessionId = psql(
      `select session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${trialLessonTypeId}', '${rebookStartsAt}', '${rebookEndsAt}', 'integration-rebook-${Date.now()}');`
    );
    expect(rebookSessionId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("학생이 수업 시작 24시간 미만 전에 취소하면 수업권을 소진(consume)한다", () => {
    grantFreshTrialEntitlement();
    // 예약 자체는 24시간 이상 전에만 만들 수 있으므로(booking window), 일단
    // 정상적으로 예약을 만든 뒤 starts_at을 24시간 미만 시점으로 직접 당겨
    // "지금 취소하면 24시간 미만"인 상황을 재현한다 — cancel_lesson_booking()은
    // 취소 시점의 reservations.starts_at만 보고 시간을 계산하므로 이 방법으로
    // 정확히 같은 분기를 검증할 수 있다.
    const startsAt = new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString();
    const endsAt = new Date(new Date(startsAt).getTime() + 60 * 60000).toISOString();
    const reservationSessionRow = psql(
      `select reservation_id, session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${trialLessonTypeId}', '${startsAt}', '${endsAt}', 'integration-consume-${Date.now()}');`
    );
    const reservationId = reservationSessionRow.split("|")[0];

    const nearStartsAt = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(); // 10시간 뒤
    const nearEndsAt = new Date(new Date(nearStartsAt).getTime() + 60 * 60000).toISOString();
    psql(`update reservations set starts_at = '${nearStartsAt}', ends_at = '${nearEndsAt}' where id = '${reservationId}';`);

    psql(`select cancel_lesson_booking('${reservationId}', 'student', '${childId}', '통합테스트 — 24시간 미만 전 취소');`);

    const eventType = psql(`select event_type from entitlement_ledger where reservation_id = '${reservationId}' and event_type in ('consume','release');`);
    expect(eventType).toBe("consume");
  });

  it("선생님·회사가 취소하면 시점과 무관하게 항상 해제(release)한다", () => {
    const grantId = grantFreshTrialEntitlement();
    const startsAt = new Date(Date.now() + 11 * 24 * 60 * 60 * 1000).toISOString();
    const endsAt = new Date(new Date(startsAt).getTime() + 60 * 60000).toISOString();
    const reservationSessionRow = psql(
      `select reservation_id, session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${trialLessonTypeId}', '${startsAt}', '${endsAt}', 'integration-teacher-cancel-${Date.now()}');`
    );
    const reservationId = reservationSessionRow.split("|")[0];

    const nearStartsAt = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(); // 5시간 뒤(24시간 미만)
    const nearEndsAt = new Date(new Date(nearStartsAt).getTime() + 60 * 60000).toISOString();
    psql(`update reservations set starts_at = '${nearStartsAt}', ends_at = '${nearEndsAt}' where id = '${reservationId}';`);

    psql(`select cancel_lesson_booking('${reservationId}', 'teacher', '${TEACHER_ID}', '통합테스트 — 선생님 취소는 시점 무관 release');`);

    const eventType = psql(`select event_type from entitlement_ledger where grant_id = '${grantId}' and reservation_id = '${reservationId}' and event_type in ('consume','release');`);
    expect(eventType).toBe("release");
  });
});
