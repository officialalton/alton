import { execFileSync } from "node:child_process";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

// M5-b(R7) — resolve_teacher_lateness()/finalize_session_as_infra_incident()/
// finalize_lesson_session() 확장(QC)/apply_makeup_time_to_booking()을 로컬 Postgres에
// 직접 psql로 검증한다. lib/booking/session-final-judgment.integration.test.ts(M5-a)와
// 동일한 psql shell-out 패턴 재사용.
//
// M5-a 파일의 주석대로 teacher_availability_rules를 공유 선생님(dddddddd-.../77777777-...)에
// 걸어두면 병렬 vitest 워커끼리 레이스가 난다 — 이 파일은 beforeAll에서 매번 새 선생님을
// 만들어 그 레이스 자체를 원천 차단한다(다른 어떤 기존 스펙도 이 선생님을 참조하지 않음).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

let teacherId: string;
let childId: string;
let subjectEnrollmentId: string;
let regularLessonTypeId: string;
let regularProductId: string;

function grantRegularEntitlement(): string {
  const grantId = psql(
    `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
     values ('${childId}', '${regularProductId}', null, 1, now() + interval '90 days', true) returning id;`
  );
  psql(
    `insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'grant', 1, 'm5b-grant-${Date.now()}-${grantId}');`
  );
  return grantId;
}

function bookSession(daysFromNow: number, durationMinutes: number): { reservationId: string; sessionId: string } {
  const startsAt = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();
  const endsAt = new Date(new Date(startsAt).getTime() + durationMinutes * 60000).toISOString();
  const row = psql(
    `select reservation_id, session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${teacherId}', '${regularLessonTypeId}', '${startsAt}', '${endsAt}', 'm5b-book-${Date.now()}-${Math.random()}');`
  );
  const [reservationId, sessionId] = row.split("|");
  return { reservationId, sessionId };
}

beforeAll(() => {
  regularLessonTypeId = psql(`select id from lesson_types where code = 'regular';`);
  regularProductId = psql(`select id from entitlement_products where code = 'lesson_pack_10';`);

  const now = Date.now();
  teacherId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'm5b-teacher-${now}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${teacherId}', 'teacher', 'M5b 통합테스트 선생님');`);
  psql(`select set_teacher_rate('${teacherId}', 3000000, 'KRW', now() - interval '1 day');`);
  psql(`insert into teachers (id, status) values ('${teacherId}', 'active');`);
  psql(
    `insert into teacher_availability_rules (teacher_id, day_of_week, start_time_local, end_time_local, timezone, created_by)
     select '${teacherId}', d, '00:00', '23:59', 'America/Los_Angeles', '${ADMIN_ID}' from generate_series(0,6) d;`
  );

  const authEmail = `m5b-integration-${now}@example.com`;
  childId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${authEmail}', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`
    insert into profiles (id, role, name) values ('${childId}', 'student', 'M5b 통합테스트 학생');
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
  psql(
    `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, source)
     values ('${subjectEnrollmentId}', '${teacherId}', 'active', now() - interval '1 day', 'app');`
  );
});

afterAll(() => {
  // 전용 선생님/학생을 새로 만들었으므로 다른 스펙과 정리 충돌이 없다. FK로 참조되는
  // 대부분의 테이블(entitlement_ledger 등)은 INSERT-only라 다음 `db reset --local`로
  // 정리되는 것을 전제로 한다(기존 통합 테스트와 동일 원칙) — 여기서는 아무것도 지우지 않는다.
});

describe("resolve_teacher_lateness() — 당일 상호 합의 연장 + 미이행분 보충시간", () => {
  it("지각분을 전부 합의 연장하면 makeup_obligations가 생기지 않는다", () => {
    grantRegularEntitlement();
    const { sessionId, reservationId } = bookSession(40, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${teacherId}');`);
    psql(`select resolve_teacher_lateness('${sessionId}', 10, 10, '${teacherId}', '10분 지각, 10분 연장 합의');`);

    const [duration, lateMinutes, makeupGenerated] = psql(
      `select scheduled_duration_minutes, late_start_minutes, makeup_minutes_generated from sessions where id = '${sessionId}';`
    ).split("|");
    expect(duration).toBe("130");
    expect(lateMinutes).toBe("10");
    expect(makeupGenerated).toBe("0");

    const newEnds = psql(`select ends_at from reservations where id = '${reservationId}';`);
    expect(newEnds).toBeTruthy();

    const obligationCount = psql(`select count(*) from makeup_obligations where triggering_session_id = '${sessionId}';`);
    expect(obligationCount).toBe("0");

    const auditRow = psql(
      `select late_minutes, agreed_extend_minutes, makeup_owed_minutes from session_late_extensions where session_id = '${sessionId}';`
    );
    expect(auditRow).toBe("10|10|0");
  });

  it("일부만 연장하면 나머지가 makeup_obligations(teacher_late)로 이관된다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(41, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${teacherId}');`);
    psql(`select resolve_teacher_lateness('${sessionId}', 20, 5, '${teacherId}', '20분 지각, 5분만 연장 가능');`);

    const duration = psql(`select scheduled_duration_minutes from sessions where id = '${sessionId}';`);
    expect(duration).toBe("125");

    const [owedMinutes, reason] = psql(
      `select owed_minutes, reason from makeup_obligations where triggering_session_id = '${sessionId}';`
    ).split("|");
    expect(owedMinutes).toBe("15");
    expect(reason).toBe("teacher_late");
  });

  it("진행 중(live)이 아닌 세션은 당일 연장을 거부한다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(42, 120);
    expect(() => psql(`select resolve_teacher_lateness('${sessionId}', 10, 10, '${teacherId}', '아직 시작 전');`)).toThrow(
      /진행 중\(live\)인 세션만/
    );
  });

  it("2026-09-06: 지각분이 원 수업시간을 초과하면 거부한다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(33, 60);
    psql(`select mark_lesson_session_started('${sessionId}', '${teacherId}');`);
    expect(() => psql(`select resolve_teacher_lateness('${sessionId}', 90, 0, '${teacherId}', '60분 세션에 90분 지각 입력 시도');`)).toThrow(
      /원 수업시간.*초과할 수 없습니다/
    );
  });

  it("2026-09-06: 연장분이 음수면 거부한다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(34, 60);
    psql(`select mark_lesson_session_started('${sessionId}', '${teacherId}');`);
    expect(() => psql(`select resolve_teacher_lateness('${sessionId}', 10, -1, '${teacherId}', '음수 연장 시도');`)).toThrow(
      /합의 연장분은 0 이상/
    );
  });

  it("2026-09-06: 연장분이 지각분을 초과하면 거부한다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(35, 60);
    psql(`select mark_lesson_session_started('${sessionId}', '${teacherId}');`);
    expect(() => psql(`select resolve_teacher_lateness('${sessionId}', 10, 20, '${teacherId}', '지각분보다 큰 연장 시도');`)).toThrow(
      /지각분 이하여야 합니다/
    );
  });

  it("2026-09-06: sessions.payable_minutes에는 음수를 직접 넣을 수 없다(CHECK 제약)", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(36, 60);
    expect(() => psql(`update sessions set payable_minutes = -1 where id = '${sessionId}';`)).toThrow(
      /sessions_payable_minutes_non_negative/
    );
  });
});

describe("finalize_lesson_session() 확장 — 선생님 사유 90분 미만 자동 QC", () => {
  it("선생님 사유로 제공 시간이 90분 미만이면 teacher_qc_warnings가 생성된다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(43, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${teacherId}');`);
    psql(`select finalize_lesson_session('${sessionId}', 'completed', '${teacherId}', '선생님이 늦게 시작해 80분만 제공', 80);`);

    const payableMinutes = psql(`select payable_minutes from sessions where id = '${sessionId}';`);
    expect(payableMinutes).toBe("120"); // 지급액은 예약 시간 그대로 — 학생 불이익 없음.

    const [type, teacherIdInWarning] = psql(
      `select type, teacher_id from teacher_qc_warnings where teacher_id = '${teacherId}' order by occurred_at desc limit 1;`
    ).split("|");
    expect(type).toBe("short_session_teacher_fault");
    expect(teacherIdInWarning).toBe(teacherId);
  });

  it("90분 이상 제공했으면 QC 경고가 생기지 않는다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(44, 120);
    const beforeCount = psql(`select count(*) from teacher_qc_warnings where teacher_id = '${teacherId}';`);
    psql(`select finalize_lesson_session('${sessionId}', 'completed', '${teacherId}', '정상 완료', 100);`);
    const afterCount = psql(`select count(*) from teacher_qc_warnings where teacher_id = '${teacherId}';`);
    expect(afterCount).toBe(beforeCount);
  });
});

describe("finalize_session_as_infra_incident() — 회사·Meet 장애 수동 최종판정", () => {
  it("미시작(제공 0분): 수업권 hold 복원, 0분 정산, 예약이 취소돼 재예약 가능", () => {
    grantRegularEntitlement();
    const { reservationId, sessionId } = bookSession(45, 120);
    psql(`select finalize_session_as_infra_incident('${sessionId}', '${ADMIN_ID}', '회사 인프라 장애로 미시작', 0);`);

    const [finalStatus, payableMinutes] = psql(`select final_status, payable_minutes from sessions where id = '${sessionId}';`).split("|");
    expect(finalStatus).toBe("company_cancelled");
    expect(payableMinutes).toBe("0");

    const reservationStatus = psql(`select status from reservations where id = '${reservationId}';`);
    expect(reservationStatus).toBe("cancelled");

    const eventType = psql(
      `select event_type from entitlement_ledger where reservation_id = '${reservationId}' and event_type in ('consume','release');`
    );
    expect(eventType).toBe("release");

    const payoutCount = psql(`select count(*) from payout_items where session_id = '${sessionId}';`);
    expect(payoutCount).toBe("0");
  });

  it("중단(제공 50분, 예약 120분): 120분 상한 내 정산 + 못 제공한 70분이 보충시간으로 이관", () => {
    grantRegularEntitlement();
    const { reservationId, sessionId } = bookSession(46, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${teacherId}');`);
    psql(`select finalize_session_as_infra_incident('${sessionId}', '${ADMIN_ID}', '수업 중 Meet 장애로 중단', 50);`);

    const [finalStatus, payableMinutes] = psql(`select final_status, payable_minutes from sessions where id = '${sessionId}';`).split("|");
    expect(finalStatus).toBe("interrupted");
    expect(payableMinutes).toBe("50");

    const eventType = psql(
      `select event_type from entitlement_ledger where reservation_id = '${reservationId}' and event_type in ('consume','release');`
    );
    expect(eventType).toBe("consume");

    const [owedMinutes, reason] = psql(
      `select owed_minutes, reason from makeup_obligations where triggering_session_id = '${sessionId}';`
    ).split("|");
    expect(owedMinutes).toBe("70");
    expect(reason).toBe("company_meet_interruption");
  });

  it("중단이어도 실제 제공 시간이 120분을 넘으면 정산은 120분에서 상한선이 걸린다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(47, 150);
    psql(`select mark_lesson_session_started('${sessionId}', '${teacherId}');`);
    psql(`select finalize_session_as_infra_incident('${sessionId}', '${ADMIN_ID}', '장시간 진행 후 중단', 140);`);

    const payableMinutes = psql(`select payable_minutes from sessions where id = '${sessionId}';`);
    expect(payableMinutes).toBe("120");
  });
});

describe("apply_makeup_time_to_booking() — 보충시간을 미래 정규 예약 뒤에 연결", () => {
  it("보충시간 적용은 entitlement_ledger에 새 소진 이벤트를 만들지 않는다", () => {
    grantRegularEntitlement();
    // 보충시간을 발생시키는 세션(지각)
    const late = bookSession(48, 120);
    psql(`select mark_lesson_session_started('${late.sessionId}', '${teacherId}');`);
    psql(`select resolve_teacher_lateness('${late.sessionId}', 30, 0, '${teacherId}', '전혀 연장 불가');`);
    const obligationId = psql(`select id from makeup_obligations where triggering_session_id = '${late.sessionId}';`);

    // 보충시간을 이어붙일 미래 정규 예약
    const future = bookSession(49, 120);
    const beforeLedgerCount = psql(`select count(*) from entitlement_ledger where reservation_id = '${future.reservationId}';`);

    psql(`select apply_makeup_time_to_booking('${future.reservationId}', '${obligationId}', 30, '${teacherId}');`);

    const afterLedgerCount = psql(`select count(*) from entitlement_ledger where reservation_id = '${future.reservationId}';`);
    expect(afterLedgerCount).toBe(beforeLedgerCount); // hold 1건 그대로 — 신규 소진 이벤트 없음.

    const [duration, makeupGenerated] = psql(
      `select scheduled_duration_minutes, makeup_minutes_generated from sessions where id = '${future.sessionId}';`
    ).split("|");
    expect(duration).toBe("150");
    expect(makeupGenerated).toBe("30");

    const remaining = psql(`select remaining_minutes from makeup_balances where obligation_id = '${obligationId}';`);
    expect(remaining).toBe("0");

    // 같은 세션에 다시 적용하면 apply_makeup_time()의 이중적용 방지 유니크 인덱스가 막는다.
    expect(() =>
      psql(`select apply_makeup_time_to_booking('${future.reservationId}', '${obligationId}', 1, '${teacherId}');`)
    ).toThrow();
  });

  it("과거 예약이거나 확정되지 않은 예약에는 보충시간을 연결할 수 없다", () => {
    grantRegularEntitlement();
    const late = bookSession(50, 120);
    psql(`select mark_lesson_session_started('${late.sessionId}', '${teacherId}');`);
    psql(`select resolve_teacher_lateness('${late.sessionId}', 15, 0, '${teacherId}', '연장 불가');`);
    const obligationId = psql(`select id from makeup_obligations where triggering_session_id = '${late.sessionId}';`);

    grantRegularEntitlement();
    const { reservationId } = bookSession(51, 60);
    psql(`update reservations set starts_at = now() - interval '1 hour', ends_at = now() - interval '10 minutes' where id = '${reservationId}';`);

    expect(() => psql(`select apply_makeup_time_to_booking('${reservationId}', '${obligationId}', 15, '${teacherId}');`)).toThrow(
      /미래 예약에만/
    );
  });

  it("2026-09-05 확정: 생성 후 30일이 지난 보충시간은 적용이 거부된다", () => {
    grantRegularEntitlement();
    const late = bookSession(52, 120);
    psql(`select mark_lesson_session_started('${late.sessionId}', '${teacherId}');`);
    psql(`select resolve_teacher_lateness('${late.sessionId}', 20, 0, '${teacherId}', '연장 불가');`);
    const obligationId = psql(`select id from makeup_obligations where triggering_session_id = '${late.sessionId}';`);
    // 트리거가 UPDATE로 expires_at 변경을 항상 막으므로(연장 방지 목적), 테스트에서 과거 만료를
    // 재현하려면 트리거를 일시적으로 끄고 직접 과거 값으로 되돌린다(트리거 자체의 동작은 아래
    // 별도 테스트가 검증한다 — 여기서는 만료 판정 로직만 검증).
    psql(`
      alter table makeup_obligations disable trigger makeup_obligations_no_expiry_extension;
      update makeup_obligations set expires_at = now() - interval '1 day' where id = '${obligationId}';
      alter table makeup_obligations enable trigger makeup_obligations_no_expiry_extension;
    `);

    grantRegularEntitlement();
    const future = bookSession(53, 120);
    expect(() =>
      psql(`select apply_makeup_time_to_booking('${future.reservationId}', '${obligationId}', 15, '${teacherId}');`)
    ).toThrow(/makeup_obligation_expired/);
  });

  it("만료일(expires_at)은 UPDATE로 연장할 수 없다", () => {
    grantRegularEntitlement();
    const late = bookSession(54, 120);
    psql(`select mark_lesson_session_started('${late.sessionId}', '${teacherId}');`);
    psql(`select resolve_teacher_lateness('${late.sessionId}', 20, 0, '${teacherId}', '연장 불가');`);
    const obligationId = psql(`select id from makeup_obligations where triggering_session_id = '${late.sessionId}';`);
    expect(() =>
      psql(`update makeup_obligations set expires_at = expires_at + interval '30 days' where id = '${obligationId}';`)
    ).toThrow(/만료일은 연장할 수 없습니다/);
  });

  it("체험수업 예약에는 보충시간을 이어붙일 수 없다(정규수업 전용)", () => {
    grantRegularEntitlement();
    const late = bookSession(55, 120);
    psql(`select mark_lesson_session_started('${late.sessionId}', '${teacherId}');`);
    psql(`select resolve_teacher_lateness('${late.sessionId}', 15, 0, '${teacherId}', '연장 불가');`);
    const obligationId = psql(`select id from makeup_obligations where triggering_session_id = '${late.sessionId}';`);

    const trialLessonTypeId = psql(`select id from lesson_types where code = 'trial';`);
    const startsAt = new Date(Date.now() + 56 * 24 * 60 * 60 * 1000).toISOString();
    const endsAt = new Date(new Date(startsAt).getTime() + 60 * 60000).toISOString();
    const trialProductId = psql(`select id from entitlement_products where code = 'trial_lesson_grant';`);
    const trialGrantId = psql(
      `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
       values ('${childId}', '${trialProductId}', null, 1, now() + interval '90 days', false) returning id;`
    );
    psql(
      `insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${trialGrantId}', 'grant', 1, 'm5b-trial-grant-${Date.now()}');`
    );
    const row = psql(
      `select reservation_id, session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${teacherId}', '${trialLessonTypeId}', '${startsAt}', '${endsAt}', 'm5b-trial-book-${Date.now()}');`
    );
    const [trialReservationId] = row.split("|");

    expect(() =>
      psql(`select apply_makeup_time_to_booking('${trialReservationId}', '${obligationId}', 15, '${teacherId}');`)
    ).toThrow(/정규 수업 예약에만/);
  });
});

describe("2026-09-05 과지급 수정 — 선생님 귀책 지각·보충시간 조합의 지급 상한(120분)", () => {
  it("(a) 연장 없이 110분 제공 + 나중에 보충 10분 제공 = 총 120분", () => {
    grantRegularEntitlement();
    const root = bookSession(5, 120);
    psql(`select mark_lesson_session_started('${root.sessionId}', '${teacherId}');`);
    psql(`select resolve_teacher_lateness('${root.sessionId}', 10, 0, '${teacherId}', '전혀 연장 불가');`);
    psql(`select finalize_lesson_session('${root.sessionId}', 'completed', '${teacherId}', '정상 완료(지각분 제외)');`);

    const rootPayable = psql(`select payable_minutes from sessions where id = '${root.sessionId}';`);
    expect(rootPayable).toBe("110"); // 예약 120분 - 지각 10분(미이행) = 실제 제공 110분만 지급.

    const obligationId = psql(`select id from makeup_obligations where triggering_session_id = '${root.sessionId}';`);
    grantRegularEntitlement();
    const future = bookSession(6, 120);
    psql(`select apply_makeup_time_to_booking('${future.reservationId}', '${obligationId}', 10, '${teacherId}');`);
    psql(`select finalize_lesson_session('${future.sessionId}', 'completed', '${teacherId}', '정상 완료(보충분 포함)');`);

    const futurePayable = psql(`select payable_minutes from sessions where id = '${future.sessionId}';`);
    expect(futurePayable).toBe("130"); // 자기 정규분 120 + 보충 10.

    // 이 지각 건 하나로 발생한 총 지급 기여분(원 세션 실제 제공분 + 보충 실제 제공분)은 120분을 넘지 않는다.
    const incidentTotal = Number(rootPayable) + (Number(futurePayable) - 120);
    expect(incidentTotal).toBe(120);
  });

  it("(b) 당일 연장으로 120분을 다 채우면 보충 채무 없이 120분 지급", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(7, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${teacherId}');`);
    psql(`select resolve_teacher_lateness('${sessionId}', 10, 10, '${teacherId}', '10분 지각, 10분 전부 연장');`);
    psql(`select finalize_lesson_session('${sessionId}', 'completed', '${teacherId}', '정상 완료');`);

    const [payable, obligationCount] = [
      psql(`select payable_minutes from sessions where id = '${sessionId}';`),
      psql(`select count(*) from makeup_obligations where triggering_session_id = '${sessionId}';`),
    ];
    expect(payable).toBe("120");
    expect(obligationCount).toBe("0");
  });

  it("(c) 부분 연장(20분 지각, 5분 연장, 15분 보충)도 조합 지급 총합이 120분을 넘지 않는다", () => {
    grantRegularEntitlement();
    const root = bookSession(8, 120);
    psql(`select mark_lesson_session_started('${root.sessionId}', '${teacherId}');`);
    psql(`select resolve_teacher_lateness('${root.sessionId}', 20, 5, '${teacherId}', '20분 지각, 5분만 연장');`);
    psql(`select finalize_lesson_session('${root.sessionId}', 'completed', '${teacherId}', '정상 완료');`);
    const rootPayable = Number(psql(`select payable_minutes from sessions where id = '${root.sessionId}';`));
    expect(rootPayable).toBe(105); // 125(연장 반영) - 20(총 지각) = 105.

    const obligationId = psql(`select id from makeup_obligations where triggering_session_id = '${root.sessionId}';`);
    grantRegularEntitlement();
    const future = bookSession(9, 120);
    psql(`select apply_makeup_time_to_booking('${future.reservationId}', '${obligationId}', 15, '${teacherId}');`);
    psql(`select finalize_lesson_session('${future.sessionId}', 'completed', '${teacherId}', '정상 완료');`);
    const futurePayable = Number(psql(`select payable_minutes from sessions where id = '${future.sessionId}';`));
    expect(futurePayable).toBe(135); // 120 + 15.

    expect(rootPayable + (futurePayable - 120)).toBe(120);
  });

  it("(d) 회사·Meet 중단(50분 제공) + 보충 70분 제공도 조합 총합이 120분을 넘지 않는다", () => {
    grantRegularEntitlement();
    const root = bookSession(10, 120);
    psql(`select mark_lesson_session_started('${root.sessionId}', '${teacherId}');`);
    psql(`select finalize_session_as_infra_incident('${root.sessionId}', '${ADMIN_ID}', '수업 중 Meet 장애로 중단', 50);`);
    const rootPayable = Number(psql(`select payable_minutes from sessions where id = '${root.sessionId}';`));
    expect(rootPayable).toBe(50);

    const obligationId = psql(
      `select id from makeup_obligations where triggering_session_id = '${root.sessionId}' and reason = 'company_meet_interruption';`
    );
    grantRegularEntitlement();
    const future = bookSession(11, 120);
    psql(`select apply_makeup_time_to_booking('${future.reservationId}', '${obligationId}', 70, '${teacherId}');`);
    psql(`select finalize_lesson_session('${future.sessionId}', 'completed', '${teacherId}', '정상 완료');`);
    const futurePayable = Number(psql(`select payable_minutes from sessions where id = '${future.sessionId}';`));
    expect(futurePayable).toBe(190); // 120 + 70.

    expect(rootPayable + (futurePayable - 120)).toBe(120);
  });

  it("(e) 보충시간을 연결만 하고 아직 완료판정하지 않으면 정산에 반영되지 않는다", () => {
    grantRegularEntitlement();
    const root = bookSession(12, 120);
    psql(`select mark_lesson_session_started('${root.sessionId}', '${teacherId}');`);
    psql(`select resolve_teacher_lateness('${root.sessionId}', 10, 0, '${teacherId}', '연장 불가');`);
    const obligationId = psql(`select id from makeup_obligations where triggering_session_id = '${root.sessionId}';`);

    grantRegularEntitlement();
    const future = bookSession(13, 120);
    psql(`select apply_makeup_time_to_booking('${future.reservationId}', '${obligationId}', 10, '${teacherId}');`);

    // 완료판정 전이므로 payable_minutes는 아직 null, 정산 항목도 아직 없다.
    const payable = psql(`select coalesce(payable_minutes::text, 'null') from sessions where id = '${future.sessionId}';`);
    expect(payable).toBe("null");
    const payoutCount = psql(`select count(*) from payout_items where session_id = '${future.sessionId}';`);
    expect(payoutCount).toBe("0");
  });
});
