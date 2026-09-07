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

// 2026-09-06: session-late-and-disruption.integration.test.ts와 동일한 이유로 예약
// 시각의 "시:분"을 실행 시점 실제 시계 시각에서 분리해 17:00 UTC(America/Los_Angeles
// 기준 업무시간대, 서머타임 무관)로 고정한다 — 날짜만 미래로 이동.
const FIXED_BOOKING_HOUR_UTC = 17;

function bookSession(lessonTypeId: string, daysFromNow: number, durationMinutes: number): { reservationId: string; sessionId: string } {
  const startsAtDate = new Date();
  startsAtDate.setUTCDate(startsAtDate.getUTCDate() + daysFromNow);
  startsAtDate.setUTCHours(FIXED_BOOKING_HOUR_UTC, 0, 0, 0);
  const startsAt = startsAtDate.toISOString();
  const endsAt = new Date(startsAtDate.getTime() + durationMinutes * 60000).toISOString();
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
    psql(`update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days' where id = (select reservation_id from sessions where id = '${sessionId}');`);
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
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    psql(`update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days' where id = (select reservation_id from sessions where id = '${sessionId}');`);
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
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    psql(`update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days' where id = (select reservation_id from sessions where id = '${sessionId}');`);
    psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '완료');`);
    const payableMinutes = psql(`select payable_minutes from sessions where id = '${sessionId}';`);
    expect(payableMinutes).toBe("120");
  });

  it("이미 확정된 세션은 재판정을 거부한다(reopen_session()/recomplete_session()으로만 가능)", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(regularLessonTypeId, 44, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    psql(`update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days' where id = (select reservation_id from sessions where id = '${sessionId}');`);
    psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '완료');`);
    expect(() => psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '재시도');`)).toThrow(
      /이미 확정된 세션입니다/
    );
  });
});

describe("2026-09-06 — 수업 종료 기준 보완(체험/정규 동일 로직)", () => {
  it("시작하지 않은 세션(scheduled)은 정상 완료를 거부한다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(regularLessonTypeId, 22, 120);
    expect(() => psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '시작 없이 완료 시도');`)).toThrow(
      /수업이 아직 시작되지 않았습니다/
    );
  });

  it("예약 종료시각 전 조기 완료는 사유 없이는 거부된다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(regularLessonTypeId, 23, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    // 예약 종료시각(미래)이 그대로이므로 지금 완료를 시도하면 "조기 종료"에 해당한다.
    expect(() => psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '사유 없이 조기 완료 시도');`)).toThrow(
      /조기 종료 사유가 필요합니다/
    );
  });

  it("학생 사유 조기종료는 p_early_end_reason='student_reason'과 함께면 허용되고 기존 학생 귀책 정책(전액 지급)이 그대로 적용된다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(regularLessonTypeId, 24, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    psql(
      `select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '학생이 두통으로 일찍 종료 요청', null, 'student_reason');`
    );
    const [finalStatus, payableMinutes, finalReason] = psql(
      `select final_status, payable_minutes, final_reason from sessions where id = '${sessionId}';`
    ).split("|");
    expect(finalStatus).toBe("completed");
    expect(payableMinutes).toBe("120"); // 조기 종료여도 기존 학생 귀책 정책과 동일하게 예약 시간 전액 지급.
    expect(finalReason).toContain("학생 사유 조기종료");
  });

  it("예약 시작 15분 이내에는 학생 노쇼를 확정할 수 없다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(regularLessonTypeId, 25, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    expect(() =>
      psql(`select finalize_lesson_session('${sessionId}', 'student_no_show', '${TEACHER_ID}', '15분도 안 지났는데 노쇼 시도');`)
    ).toThrow(/15분이 지나야 학생 노쇼를 확정할 수 있습니다/);
  });

  it("학생의 접속 기록이 있으면 선생님이 직접 노쇼를 확정할 수 없고, 세션은 확정되지 않은 채 남는다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(regularLessonTypeId, 26, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    psql(`update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days' where id = (select reservation_id from sessions where id = '${sessionId}');`);
    const childId2 = psql(`select child_id from subject_enrollments where id = '${subjectEnrollmentId}';`);
    psql(
      `insert into session_access_events (session_id, actor_id, source, event_type, occurred_at)
       values ('${sessionId}', '${childId2}', 'alton_client', 'alton_page_open', now());`
    );
    expect(() =>
      psql(`select finalize_lesson_session('${sessionId}', 'student_no_show', '${TEACHER_ID}', '접속기록 무시 노쇼 시도');`)
    ).toThrow(/학생의 접속 기록이 있어/);

    // 확정되지 않았으므로 세션은 여전히 live 상태로 남아 관리자 미확정 목록에 노출된다.
    const finalStatus = psql(`select final_status from sessions where id = '${sessionId}';`);
    expect(finalStatus).toBe("live");
  });

  it("이미 시작된 세션(live)에서는 선생님 노쇼를 확정할 수 없다(부분중단/장애 판정 경로를 사용해야 함)", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(regularLessonTypeId, 27, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    expect(() =>
      psql(`select finalize_lesson_session('${sessionId}', 'teacher_no_show', '${ADMIN_ID}', '이미 시작된 세션에 노쇼 시도');`)
    ).toThrow(/선생님 노쇼는 수업이 시작되지 않은 경우에만/);
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
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    psql(`update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days' where id = (select reservation_id from sessions where id = '${sessionId}');`);
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

describe("2026-09-05 후속 — 재판정 시 entitlement 대사(reconciliation) 작업 자동 생성", () => {
  it("completed→teacher_no_show 재판정: consume→release 필요분(+1)을 대사 작업으로 적재하고, 반영하면 실제 조정된다", () => {
    grantRegularEntitlement();
    const { sessionId, reservationId } = bookSession(regularLessonTypeId, 55, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    psql(`update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days' where id = (select reservation_id from sessions where id = '${sessionId}');`);
    psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '완료(오판정)');`);

    const grantId = psql(`select grant_id from entitlement_ledger where reservation_id = '${reservationId}' and event_type = 'hold';`);
    const balanceBefore = psql(`select coalesce(sum(amount),0) from entitlement_ledger where grant_id = '${grantId}';`);

    psql(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      select reopen_session('${sessionId}', '재검토 필요');
      select recomplete_session('${sessionId}', 'teacher_no_show', '실제로는 선생님 노쇼였음');
      reset role;
    `);

    const taskRow = psql(
      `select prior_final_status, new_final_status, current_entitlement_disposition, expected_entitlement_disposition,
              required_entitlement_adjustment_amount, status
       from session_judgment_reconciliation_tasks where session_id = '${sessionId}';`
    );
    const [priorStatus, newStatus, currentDisposition, expectedDisposition, requiredAmount, status] = taskRow.split("|");
    expect(priorStatus).toBe("completed");
    expect(newStatus).toBe("teacher_no_show");
    expect(currentDisposition).toBe("consume");
    expect(expectedDisposition).toBe("release");
    expect(requiredAmount).toBe("1");
    expect(status).toBe("pending");

    const taskId = psql(`select id from session_judgment_reconciliation_tasks where session_id = '${sessionId}';`);
    psql(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      select resolve_session_reconciliation_task('${taskId}', '수동 확인 후 반영');
      reset role;
    `);

    const balanceAfter = psql(`select coalesce(sum(amount),0) from entitlement_ledger where grant_id = '${grantId}';`);
    expect(Number(balanceAfter)).toBe(Number(balanceBefore) + 1);

    const resolvedStatus = psql(`select status from session_judgment_reconciliation_tasks where id = '${taskId}';`);
    expect(resolvedStatus).toBe("resolved");

    // 같은 작업을 다시 반영하려 하면 멱등 가드가 막는다(중복 반영 방지).
    expect(() =>
      psql(`
        set role authenticated;
        select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
        select resolve_session_reconciliation_task('${taskId}', '다시 반영 시도');
        reset role;
      `)
    ).toThrow(/이미 반영된 대사 작업입니다/);

    // adjust_entitlement()가 한 번만 적용됐는지(멱등성) 잔액으로 다시 확인.
    const balanceStillSame = psql(`select coalesce(sum(amount),0) from entitlement_ledger where grant_id = '${grantId}';`);
    expect(balanceStillSame).toBe(balanceAfter);
  });

  it("payout_items가 이미 paid였으면 금액은 바뀌지 않고 superseded_by_reconciliation_task_id로만 표시된다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(regularLessonTypeId, 30, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    psql(`update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days' where id = (select reservation_id from sessions where id = '${sessionId}');`);
    psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '완료(오판정)');`);
    const payoutItemId = psql(`select id from payout_items where session_id = '${sessionId}';`);
    // R10 corrective(요구사항 1, 2026-09-07): paid는 payout_items_paid_requires_confirmation
    // CHECK 제약 때문에 provider_transaction_id/provider_confirmed_at도 함께 있어야 한다.
    // 이 테스트는 상태머신 함수를 거치지 않고 직접 paid로 만드는 시나리오(오판정 이후
    // 이미 지급된 상태를 재현)이므로 확인 컬럼도 같은 UPDATE에서 채운다.
    psql(
      `update payout_items set status = 'paid', provider_transaction_id = 'test-tx-${payoutItemId}', provider_confirmed_at = now() where id = '${payoutItemId}';`
    );
    const amountBefore = psql(`select amount_minor from payout_items where id = '${payoutItemId}';`);

    psql(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      select reopen_session('${sessionId}', '재검토 필요');
      select recomplete_session('${sessionId}', 'teacher_no_show', '실제로는 선생님 노쇼였음');
      reset role;
    `);

    const [amountAfter, supersededTaskId] = psql(
      `select amount_minor, coalesce(superseded_by_reconciliation_task_id::text, '') from payout_items where id = '${payoutItemId}';`
    ).split("|");
    expect(amountAfter).toBe(amountBefore); // paid 항목 금액은 그대로 — 즉시 덮어쓰지 않는다.
    expect(supersededTaskId).not.toBe(""); // 대신 역분개 대상으로 표시만 남는다.

    const taskId = psql(`select id from session_judgment_reconciliation_tasks where session_id = '${sessionId}';`);
    expect(supersededTaskId).toBe(taskId);
  });

  it("2026-09-06: 같은 세션에 재판정이 두 번 일어나면 첫 대사 작업은 superseded로 전환되고 반영이 거부된다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(regularLessonTypeId, 49, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    psql(`update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days' where id = (select reservation_id from sessions where id = '${sessionId}');`);
    psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '완료(오판정1)');`);

    psql(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      select reopen_session('${sessionId}', '재검토1');
      select recomplete_session('${sessionId}', 'teacher_no_show', '1차 재판정');
      reset role;
    `);
    const firstTaskId = psql(
      `select id from session_judgment_reconciliation_tasks where session_id = '${sessionId}' order by created_at limit 1;`
    );

    // 같은 세션이 또 재판정된다(관리자가 실수를 다시 정정) — 첫 작업은 이제 오래된 전제를 담고
    // 있으므로 superseded로 전환돼야 한다.
    psql(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      select reopen_session('${sessionId}', '재검토2');
      select recomplete_session('${sessionId}', 'student_no_show', '2차 재판정 — 실제로는 학생 노쇼');
      reset role;
    `);

    const firstTaskStatus = psql(`select status from session_judgment_reconciliation_tasks where id = '${firstTaskId}';`);
    expect(firstTaskStatus).toBe("superseded");

    const secondTaskId = psql(
      `select id from session_judgment_reconciliation_tasks where session_id = '${sessionId}' and status = 'pending';`
    );
    expect(secondTaskId).not.toBe(firstTaskId);

    // 오래된(superseded) 첫 작업은 뒤늦게라도 반영할 수 없다.
    expect(() =>
      psql(`
        set role authenticated;
        select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
        select resolve_session_reconciliation_task('${firstTaskId}', '뒤늦은 반영 시도');
        reset role;
      `)
    ).toThrow(/superseded/);
  });

  it("2026-09-06: 반영 직전 세션 상태가 작업 생성 시점과 달라졌으면 반영을 거부하고 needs_review로 전환한다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(regularLessonTypeId, 50, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    psql(`update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days' where id = (select reservation_id from sessions where id = '${sessionId}');`);
    psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '완료(오판정)');`);

    psql(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      select reopen_session('${sessionId}', '재검토 필요');
      select recomplete_session('${sessionId}', 'teacher_no_show', '실제로는 선생님 노쇼였음');
      reset role;
    `);
    const taskId = psql(`select id from session_judgment_reconciliation_tasks where session_id = '${sessionId}';`);

    // 정상 흐름을 우회해 세션 payable_minutes를 작업 생성 시점의 전제와 다르게 직접 바꿔둔다
    // (실무에서는 recomplete_session()이 항상 이 작업을 superseded로 전환하지만, 이 테스트는
    // "전제가 깨졌는데 어떤 이유로든 여전히 pending인" 방어적 상황을 재현한다).
    psql(`update sessions set payable_minutes = 999 where id = '${sessionId}';`);

    // 예외를 던지지 않는다(예외를 던지면 트랜잭션과 함께 아래 UPDATE도 롤백돼 상태 전환 자체가
    // 저장되지 않는다) — 대신 반환값으로 결과를 알린다.
    const resolveOutput = psql(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      select resolve_session_reconciliation_task('${taskId}', '반영 시도');
      reset role;
    `);
    const resolveResultLines = resolveOutput.split("\n").filter((l) => l.length > 0);
    expect(resolveResultLines[resolveResultLines.length - 1]).toBe("needs_review");

    const taskStatus = psql(`select status from session_judgment_reconciliation_tasks where id = '${taskId}';`);
    expect(taskStatus).toBe("needs_review");

    // needs_review 상태가 된 뒤에는 다시 반영을 시도해도 거부된다.
    expect(() =>
      psql(`
        set role authenticated;
        select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
        select resolve_session_reconciliation_task('${taskId}', '재시도');
        reset role;
      `)
    ).toThrow(/needs_review/);
  });

  it("2026-09-06(최종 보완): 작업 생성 이후 같은 grant에 다른 adjust가 이미 적용됐으면 저장된 조정량을 그대로 적용하지 않고 needs_review로 전환한다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(regularLessonTypeId, 54, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    psql(`update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days' where id = (select reservation_id from sessions where id = '${sessionId}');`);
    psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '완료(오판정)');`);

    psql(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      select reopen_session('${sessionId}', '재검토 필요');
      select recomplete_session('${sessionId}', 'teacher_no_show', '실제로는 선생님 노쇼였음');
      reset role;
    `);
    const taskId = psql(`select id from session_judgment_reconciliation_tasks where session_id = '${sessionId}';`);
    const grantId = psql(`select entitlement_grant_id from session_judgment_reconciliation_tasks where id = '${taskId}';`);

    // 작업 생성 이후 같은 grant에 이미 다른 조정(예: 다른 경로의 수동 조정)이 적용된 상황을
    // 재현한다 — 저장된 required_entitlement_adjustment_amount를 그대로 적용하면 이 조정과
    // 중복 보정이 될 수 있으므로 반영을 거부해야 한다.
    psql(
      `insert into entitlement_ledger (grant_id, event_type, amount, business_event_id)
       values ('${grantId}', 'adjust', 1, 'manual-adjust-test-${Date.now()}');`
    );

    const resolveOutput = psql(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      select resolve_session_reconciliation_task('${taskId}', '반영 시도');
      reset role;
    `);
    const lines = resolveOutput.split("\n").filter((l) => l.length > 0);
    expect(lines[lines.length - 1]).toBe("needs_review");

    const taskStatus = psql(`select status from session_judgment_reconciliation_tasks where id = '${taskId}';`);
    expect(taskStatus).toBe("needs_review");
  });
});

describe("2026-09-06 후속 — student_cancelled 재판정의 entitlement disposition 자동 판정", () => {
  it("취소 기록이 시작 24시간 이상 전이면 release로 자동 판정된다", () => {
    grantRegularEntitlement();
    const { sessionId, reservationId } = bookSession(regularLessonTypeId, 51, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    psql(`update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days' where id = (select reservation_id from sessions where id = '${sessionId}');`);
    psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '완료(오판정)');`);
    // 시작 3일 전에 취소된 것으로 취소 기록을 남긴다(24시간 이상 전 — release 기대).
    psql(
      `insert into reservation_cancellations (reservation_id, cancelled_by_role, cancelled_by_id, reason, entitlement_disposition)
       values ('${reservationId}', 'student', '${childId}', '테스트용 취소 기록(24h+)', 'consumed');`
    );
    psql(
      `update reservation_cancellations set cancelled_at = (select starts_at from reservations where id = '${reservationId}') - interval '3 days'
       where reservation_id = '${reservationId}';`
    );

    psql(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      select reopen_session('${sessionId}', '재검토 필요');
      select recomplete_session('${sessionId}', 'student_cancelled', '실제로는 학생이 미리 취소했음');
      reset role;
    `);

    const [expectedDisposition, requiredAmount, status] = psql(
      `select expected_entitlement_disposition, required_entitlement_adjustment_amount, status
       from session_judgment_reconciliation_tasks where session_id = '${sessionId}';`
    ).split("|");
    expect(expectedDisposition).toBe("release");
    expect(requiredAmount).toBe("1"); // consume→release, 수업권 복원 필요.
    expect(status).toBe("pending");

    const taskId = psql(`select id from session_judgment_reconciliation_tasks where session_id = '${sessionId}';`);
    const resolveOutput = psql(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      select resolve_session_reconciliation_task('${taskId}', '자동 판정 그대로 반영');
      reset role;
    `);
    const lines = resolveOutput.split("\n").filter((l) => l.length > 0);
    expect(lines[lines.length - 1]).toBe("resolved");
  });

  it("취소 기록이 시작 24시간 미만 전이면 consume으로 자동 판정된다", () => {
    grantRegularEntitlement();
    const { sessionId, reservationId } = bookSession(regularLessonTypeId, 52, 120);
    psql(`select finalize_lesson_session('${sessionId}', 'teacher_no_show', '${TEACHER_ID}', '오판정(원래 학생 취소)');`);
    psql(
      `insert into reservation_cancellations (reservation_id, cancelled_by_role, cancelled_by_id, reason, entitlement_disposition)
       values ('${reservationId}', 'student', '${childId}', '테스트용 취소 기록(24h 미만)', 'released');`
    );
    psql(
      `update reservation_cancellations set cancelled_at = (select starts_at from reservations where id = '${reservationId}') - interval '3 hours'
       where reservation_id = '${reservationId}';`
    );

    psql(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      select reopen_session('${sessionId}', '재검토 필요');
      select recomplete_session('${sessionId}', 'student_cancelled', '실제로는 학생이 임박 취소했음');
      reset role;
    `);

    const expectedDisposition = psql(
      `select expected_entitlement_disposition from session_judgment_reconciliation_tasks where session_id = '${sessionId}';`
    );
    expect(expectedDisposition).toBe("consume");
  });

  it("취소 기록이 없으면 자동 판정이 불가능해 반영이 거부되고, 관리자가 직접 선택한 뒤에야 반영된다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(regularLessonTypeId, 53, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
    psql(`update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days' where id = (select reservation_id from sessions where id = '${sessionId}');`);
    psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '완료(오판정)');`);

    psql(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      select reopen_session('${sessionId}', '재검토 필요');
      select recomplete_session('${sessionId}', 'student_cancelled', '실제로는 학생 취소였음(취소 기록 없음)');
      reset role;
    `);

    const expectedDisposition = psql(
      `select coalesce(expected_entitlement_disposition, 'null') from session_judgment_reconciliation_tasks where session_id = '${sessionId}';`
    );
    expect(expectedDisposition).toBe("null");

    const taskId = psql(`select id from session_judgment_reconciliation_tasks where session_id = '${sessionId}';`);

    // 관리자가 선택하기 전에는 반영이 거부된다.
    expect(() =>
      psql(`
        set role authenticated;
        select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
        select resolve_session_reconciliation_task('${taskId}', '선택 없이 반영 시도');
        reset role;
      `)
    ).toThrow(/관리자가 소진\/해제 여부를 먼저 선택해야 합니다/);

    // 사유 없이 선택하는 것도 거부된다.
    expect(() =>
      psql(`
        set role authenticated;
        select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
        select set_reconciliation_task_student_cancelled_disposition('${taskId}', 'release', '');
        reset role;
      `)
    ).toThrow(/사유를 반드시 입력해야 합니다/);

    // 관리자가 사유와 함께 명시적으로 선택한다.
    psql(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      select set_reconciliation_task_student_cancelled_disposition('${taskId}', 'release', '학부모 요청 이메일로 사전 취소 확인됨');
      reset role;
    `);

    const [expectedAfter, adminReason] = psql(
      `select expected_entitlement_disposition, admin_disposition_reason from session_judgment_reconciliation_tasks where id = '${taskId}';`
    ).split("|");
    expect(expectedAfter).toBe("release");
    expect(adminReason).toBe("학부모 요청 이메일로 사전 취소 확인됨");

    // 이제 반영할 수 있다.
    const resolveOutput = psql(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      select resolve_session_reconciliation_task('${taskId}', '관리자 선택 반영');
      reset role;
    `);
    const lines = resolveOutput.split("\n").filter((l) => l.length > 0);
    expect(lines[lines.length - 1]).toBe("resolved");

    const finalStatus = psql(`select status from session_judgment_reconciliation_tasks where id = '${taskId}';`);
    expect(finalStatus).toBe("resolved");
  });

  it("2026-09-06(최종 보완): 같은 grant에 예약이 여러 건이어도 hold 금액 조회를 이 세션의 reservation_id로 한정한다", () => {
    // 같은 grant(수업권 묶음)로 두 건을 예약해, 다른 예약의 hold와 섞이지 않는지 확인한다.
    const grantId = psql(
      `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
       values ('${childId}', '${regularProductId}', null, 2, now() + interval '1 day', true) returning id;`
    );
    psql(
      `insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'grant', 2, 'm5c-multi-res-grant-${Date.now()}');`
    );

    const { sessionId: sessionA } = bookSession(regularLessonTypeId, 20, 120);
    const { sessionId: sessionB } = bookSession(regularLessonTypeId, 21, 120);

    // sessionA만 취소 기록 없는 student_cancelled로 재판정해 관리자 수동 선택 경로를 태운다.
    // sessionB는 그대로 hold 상태로 남아 같은 grant 안에 다른 예약이 있는 상태를 만든다.
    psql(`select mark_lesson_session_started('${sessionA}', '${TEACHER_ID}');`);
    psql(`update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days' where id = (select reservation_id from sessions where id = '${sessionA}');`);
    psql(`select finalize_lesson_session('${sessionA}', 'completed', '${TEACHER_ID}', '완료(오판정)');`);
    psql(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      select reopen_session('${sessionA}', '재검토 필요');
      select recomplete_session('${sessionA}', 'student_cancelled', '실제로는 학생 취소(취소 기록 없음)');
      reset role;
    `);

    const taskId = psql(`select id from session_judgment_reconciliation_tasks where session_id = '${sessionA}';`);
    psql(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${ADMIN_ID}', false);
      select set_reconciliation_task_student_cancelled_disposition('${taskId}', 'release', '같은 grant 내 다른 예약과 분리 검증');
      reset role;
    `);

    // sessionA 자신의 reservation_id에 걸린 hold(1장)만 조회돼야 하므로 조정량은 정확히
    // 1이어야 한다(grant 전체 hold 합계나 다른 예약의 hold와 섞이면 안 됨).
    const requiredAmount = psql(
      `select required_entitlement_adjustment_amount from session_judgment_reconciliation_tasks where id = '${taskId}';`
    );
    expect(requiredAmount).toBe("1");

    // sessionB의 hold는 이 작업의 영향을 받지 않고 그대로 남아 있어야 한다(같은 grant지만
    // 다른 예약).
    const sessionBHoldRow = psql(
      `select r.id from reservations r join sessions s on s.reservation_id = r.id
       where s.id = '${sessionB}';`
    );
    const sessionBHoldCount = psql(
      `select count(*) from entitlement_ledger where reservation_id = '${sessionBHoldRow}' and event_type = 'hold';`
    );
    expect(sessionBHoldCount).toBe("1");
  });
});
