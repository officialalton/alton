import { execFileSync } from "node:child_process";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

// M5-a(R7 판정 규칙 코어) — finalize_lesson_session()/cancel_lesson_booking() 확장/
// mark_lesson_session_started()/recomplete_session() 확장을 로컬 Postgres에 직접
// psql로 검증한다. app/admin/trial-sessions-guardian-consent.integration.test.ts,
// lib/booking/trial-entitlement-and-cancellation.integration.test.ts와 동일한 psql
// shell-out 패턴 재사용.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
// 다른 통합 테스트 파일(lib/booking/trial-entitlement-and-cancellation.integration.test.ts 등)이
// TEACHER_ID=dddddddd-...-001을 공유하고, 같은 selector(teacher_id+created_by)로
// teacher_availability_rules를 afterAll에서 지운다 — vitest가 파일을 병렬 워커로 실행하면
// 서로의 가용시간 규칙을 지워 teacher_slot_not_open 레이스가 난다(실측 확인). 이 파일은
// 어떤 기존 통합/E2E 테스트도 쓰지 않는 전용 선생님(정하나, 77777777-...-001)을 써서
// 그 레이스 자체를 원천 차단한다.
const TEACHER_ID = "77777777-0000-0000-0000-000000000001"; // 정하나 — 이 파일 전용
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

let childId: string;
let subjectEnrollmentId: string;
let regularLessonTypeId: string;
let trialLessonTypeId: string;
let regularProductId: string;
let trialProductId: string;

function grantRegularEntitlement(): string {
  const grantId = psql(
    `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
     values ('${childId}', '${regularProductId}', null, 1, now() + interval '90 days', true) returning id;`
  );
  psql(
    `insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'grant', 1, 'm5a-grant-${Date.now()}-${grantId}');`
  );
  return grantId;
}

function grantTrialEntitlement(): string {
  const grantId = psql(
    `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
     values ('${childId}', '${trialProductId}', null, 1, now() + interval '90 days', false) returning id;`
  );
  psql(
    `insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'grant', 1, 'm5a-trial-grant-${Date.now()}-${grantId}');`
  );
  return grantId;
}

function bookSession(lessonTypeId: string, daysFromNow: number, durationMinutes: number): { reservationId: string; sessionId: string } {
  const startsAt = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();
  const endsAt = new Date(new Date(startsAt).getTime() + durationMinutes * 60000).toISOString();
  const row = psql(
    `select reservation_id, session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${lessonTypeId}', '${startsAt}', '${endsAt}', 'm5a-book-${Date.now()}-${Math.random()}');`
  );
  const [reservationId, sessionId] = row.split("|");
  return { reservationId, sessionId };
}

beforeAll(() => {
  regularLessonTypeId = psql(`select id from lesson_types where code = 'regular';`);
  trialLessonTypeId = psql(`select id from lesson_types where code = 'trial';`);
  regularProductId = psql(`select id from entitlement_products where code = 'lesson_pack_10';`);
  trialProductId = psql(`select id from entitlement_products where code = 'trial_lesson_grant';`);

  const now = Date.now();
  const authEmail = `m5a-integration-${now}@example.com`;
  childId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${authEmail}', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`
    insert into profiles (id, role, name) values ('${childId}', 'student', 'M5a 통합테스트 학생');
    insert into students (id, grade, status) values ('${childId}', '10학년', 'active');
  `);

  const householdId = psql(`insert into households (primary_guardian_id) values (null) returning id;`);
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
  // 이 선생님(정하나)은 seed 데이터에 시급 이력이 없다 — teacher_assignments insert
  // 트리거(enforce_teacher_assignment_requires_rate)와 sessions insert 트리거
  // (enforce_and_snapshot_teacher_rate) 둘 다 이를 요구하므로 배정 전에 먼저 만든다.
  psql(`select set_teacher_rate('${TEACHER_ID}', 3000000, 'KRW', now() - interval '1 day');`);
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
  // entitlement_ledger/session_status_events/payout_items 등은 INSERT-only이거나
  // FK로 참조돼 정리할 수 없다 — 다음 `supabase db reset --local`로 정리되는 것을
  // 전제로 한다(기존 통합 테스트와 동일 원칙). 다른 스펙과 충돌하지 않도록 이
  // 스펙이 만든 가용시간 규칙만 정리한다.
  psql(`delete from teacher_availability_rules where teacher_id = '${TEACHER_ID}' and created_by = '${ADMIN_ID}';`);
});

describe("finalize_lesson_session() — 정상 완료/노쇼 최종판정", () => {
  it("completed: 1장 소진 + payable_minutes=예약 시간(120분, 정규) + payout_item 생성", () => {
    grantRegularEntitlement();
    const { reservationId, sessionId } = bookSession(regularLessonTypeId, 40, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '정상 완료');`);

    const [finalStatus, payableMinutes, actualStart] = psql(
      `select final_status, payable_minutes, (actual_start_at is not null) from sessions where id = '${sessionId}';`
    ).split("|");
    expect(finalStatus).toBe("completed");
    expect(payableMinutes).toBe("120");
    expect(actualStart).toBe("t");

    const eventType = psql(
      `select event_type from entitlement_ledger where reservation_id = '${reservationId}' and event_type in ('consume','release');`
    );
    expect(eventType).toBe("consume");

    const [itemType, amountMinor, payoutMinutes] = psql(
      `select item_type, amount_minor, payable_minutes from payout_items where session_id = '${sessionId}';`
    ).split("|");
    expect(itemType).toBe("regular");
    expect(payoutMinutes).toBe("120");
    expect(Number(amountMinor)).toBeGreaterThan(0);
  });

  it("student_no_show: 15분 미접속 최종 확정도 1장 소진 + 지급(보충시간 없음)", () => {
    grantRegularEntitlement();
    const { reservationId, sessionId } = bookSession(regularLessonTypeId, 41, 120);
    psql(`select finalize_lesson_session('${sessionId}', 'student_no_show', '${TEACHER_ID}', '15분 미접속 최종 확정');`);

    const finalStatus = psql(`select final_status from sessions where id = '${sessionId}';`);
    expect(finalStatus).toBe("student_no_show");
    const eventType = psql(
      `select event_type from entitlement_ledger where reservation_id = '${reservationId}' and event_type in ('consume','release');`
    );
    expect(eventType).toBe("consume");
    const payoutExists = psql(`select count(*) from payout_items where session_id = '${sessionId}';`);
    expect(payoutExists).toBe("1");
  });

  it("teacher_no_show: 학생 귀책 없음 — release + 지급 없음(정산 항목 없음)", () => {
    grantRegularEntitlement();
    const { reservationId, sessionId } = bookSession(regularLessonTypeId, 42, 120);
    psql(`select finalize_lesson_session('${sessionId}', 'teacher_no_show', '${ADMIN_ID}', '선생님 노쇼 관리자 확정');`);

    const [finalStatus, payableMinutes] = psql(`select final_status, payable_minutes from sessions where id = '${sessionId}';`).split("|");
    expect(finalStatus).toBe("teacher_no_show");
    expect(payableMinutes).toBe("0");
    const eventType = psql(
      `select event_type from entitlement_ledger where reservation_id = '${reservationId}' and event_type in ('consume','release');`
    );
    expect(eventType).toBe("release");
    const payoutCount = psql(`select count(*) from payout_items where session_id = '${sessionId}';`);
    expect(payoutCount).toBe("0");
  });

  it("Meet 실접속시간(session_access_events)은 payable_minutes 계산에 전혀 영향을 주지 않는다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(regularLessonTypeId, 43, 120);
    // 실제 Meet 체류시간이 훨씬 짧게(5분) 기록돼도 정산은 예약 시간(120분) 기준.
    psql(
      `insert into session_access_events (session_id, source, event_type, occurred_at) values
       ('${sessionId}', 'google_meet_api', 'meet_join', now()),
       ('${sessionId}', 'google_meet_api', 'meet_leave', now() + interval '5 minutes');`
    );
    psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '완료');`);
    const payableMinutes = psql(`select payable_minutes from sessions where id = '${sessionId}';`);
    expect(payableMinutes).toBe("120");
  });

  it("이미 확정된 세션은 재판정을 거부한다(reopen_session()/recomplete_session()으로만 가능)", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(regularLessonTypeId, 44, 120);
    psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '완료');`);
    expect(() => psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '재시도');`)).toThrow(
      /이미 확정된 세션입니다/
    );
  });
});

describe("cancel_lesson_booking() 확장 — 취소 시 연결된 세션도 함께 최종판정", () => {
  it("24시간 이상 전 학생 취소: release, payable_minutes=0, 정산 항목 없음", () => {
    grantTrialEntitlement();
    const { reservationId, sessionId } = bookSession(trialLessonTypeId, 45, 60);
    psql(`select cancel_lesson_booking('${reservationId}', 'student', '${childId}', '24시간 이상 전 취소');`);

    const [finalStatus, payableMinutes] = psql(`select final_status, payable_minutes from sessions where id = '${sessionId}';`).split(
      "|"
    );
    expect(finalStatus).toBe("student_cancelled");
    expect(payableMinutes).toBe("0");
    const payoutCount = psql(`select count(*) from payout_items where session_id = '${sessionId}';`);
    expect(payoutCount).toBe("0");
  });

  it("24시간 미만 학생 취소: consume, payable_minutes=예약 시간(60분, 체험), 정산 항목 생성", () => {
    grantTrialEntitlement();
    const { reservationId, sessionId } = bookSession(trialLessonTypeId, 46, 60);
    const nearStartsAt = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString();
    const nearEndsAt = new Date(new Date(nearStartsAt).getTime() + 60 * 60000).toISOString();
    psql(`update reservations set starts_at = '${nearStartsAt}', ends_at = '${nearEndsAt}' where id = '${reservationId}';`);

    psql(`select cancel_lesson_booking('${reservationId}', 'student', '${childId}', '24시간 미만 전 취소');`);

    const [finalStatus, payableMinutes] = psql(`select final_status, payable_minutes from sessions where id = '${sessionId}';`).split(
      "|"
    );
    expect(finalStatus).toBe("student_cancelled");
    expect(payableMinutes).toBe("60");
    const [itemType, payoutMinutes] = psql(`select item_type, payable_minutes from payout_items where session_id = '${sessionId}';`).split(
      "|"
    );
    expect(itemType).toBe("trial");
    expect(payoutMinutes).toBe("60");
  });

  it("선생님 취소: 시점 무관 release, payable_minutes=0, 정산 항목 없음", () => {
    grantTrialEntitlement();
    const { reservationId, sessionId } = bookSession(trialLessonTypeId, 47, 60);
    psql(`select cancel_lesson_booking('${reservationId}', 'teacher', '${TEACHER_ID}', '선생님 취소');`);

    const [finalStatus, payableMinutes] = psql(`select final_status, payable_minutes from sessions where id = '${sessionId}';`).split(
      "|"
    );
    expect(finalStatus).toBe("teacher_cancelled");
    expect(payableMinutes).toBe("0");
  });
});

describe("recomplete_session() 확장 — 재판정 시 payable_minutes/정산 항목 재계산", () => {
  it("잘못 completed 처리된 세션을 teacher_no_show로 재판정하면 payable_minutes가 0으로 재계산되고 정산 항목이 사라진다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(regularLessonTypeId, 48, 120);
    psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '완료(오판정)');`);
    let payoutCount = psql(`select count(*) from payout_items where session_id = '${sessionId}';`);
    expect(payoutCount).toBe("1");

    psql(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      select reopen_session('${sessionId}', '재검토 필요');
      select recomplete_session('${sessionId}', 'teacher_no_show', '실제로는 선생님 노쇼였음');
      reset role;
    `);

    const [finalStatus, payableMinutes] = psql(`select final_status, payable_minutes from sessions where id = '${sessionId}';`).split(
      "|"
    );
    expect(finalStatus).toBe("teacher_no_show");
    expect(payableMinutes).toBe("0");
    payoutCount = psql(`select count(*) from payout_items where session_id = '${sessionId}';`);
    expect(payoutCount).toBe("0");

    const events = psql(
      `select string_agg(event_type::text, ',' order by occurred_at) from session_status_events where session_id = '${sessionId}';`
    );
    expect(events).toBe("completed,reopened,recompleted");
  });
});
