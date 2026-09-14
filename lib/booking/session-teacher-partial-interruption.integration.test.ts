import { execFileSync } from "node:child_process";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

// M5-c(2026-09-06) — resolve_teacher_partial_interruption()을 로컬 Postgres에 직접 psql로
// 검증한다. lib/booking/session-late-and-disruption.integration.test.ts와 동일한 psql
// shell-out 패턴 재사용, 전용 선생님/학생을 매번 새로 만들어 teacher_availability_rules
// 레이스를 원천 차단한다.

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
    `insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'grant', 1, 'm5c-grant-${Date.now()}-${grantId}');`
  );
  return grantId;
}

// 2026-09-06: session-late-and-disruption.integration.test.ts와 동일한 이유로 예약
// 시각의 "시:분"을 실행 시점 실제 시계 시각에서 분리해 17:00 UTC(America/Los_Angeles
// 기준 업무시간대, 서머타임 무관)로 고정한다 — 날짜만 미래로 이동.
const FIXED_BOOKING_HOUR_UTC = 17;

function bookSession(daysFromNow: number, durationMinutes: number): { reservationId: string; sessionId: string } {
  const startsAtDate = new Date();
  startsAtDate.setUTCDate(startsAtDate.getUTCDate() + daysFromNow);
  startsAtDate.setUTCHours(FIXED_BOOKING_HOUR_UTC, 0, 0, 0);
  const startsAt = startsAtDate.toISOString();
  const endsAt = new Date(startsAtDate.getTime() + durationMinutes * 60000).toISOString();
  const row = psql(
    `select reservation_id, session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${teacherId}', '${regularLessonTypeId}', '${startsAt}', '${endsAt}', 'm5c-book-${Date.now()}-${Math.random()}');`
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
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'm5c-teacher-${now}@example.com', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`insert into profiles (id, role, name) values ('${teacherId}', 'teacher', 'M5c 통합테스트 선생님');`);
  psql(`select set_teacher_rate('${teacherId}', 3000000, 'KRW', now() - interval '1 day');`);
  psql(`insert into teachers (id, status) values ('${teacherId}', 'active');`);
  psql(
    `insert into teacher_availability_rules (teacher_id, day_of_week, start_time_local, end_time_local, timezone, created_by)
     select '${teacherId}', d, '00:00', '23:59', 'America/Los_Angeles', '${ADMIN_ID}' from generate_series(0,6) d;`
  );

  const authEmail = `m5c-integration-${now}@example.com`;
  childId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${authEmail}', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`
    insert into profiles (id, role, name) values ('${childId}', 'student', 'M5c 통합테스트 학생');
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
  // 전용 선생님/학생만 사용 — 다음 db reset --local로 정리되는 것을 전제로 한다(기존 통합
  // 테스트와 동일 원칙).
});

describe("resolve_teacher_partial_interruption() — 선생님 사유 부분중단(예: 80분만 제공)", () => {
  it("예정 120분 중 80분 제공 — 수업권 1장 소진 + 80분만 지급 + 40분 보충시간 이관 + QC 경고 없음(80>=90 아님이므로 있어야 함)", () => {
    grantRegularEntitlement();
    const { sessionId, reservationId } = bookSession(20, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${teacherId}');`);
    const beforeQc = psql(`select count(*) from teacher_qc_warnings where teacher_id = '${teacherId}';`);
    psql(`select resolve_teacher_partial_interruption('${sessionId}', 80, '${teacherId}', '선생님 사정으로 80분만 진행');`);

    const [finalStatus, payableMinutes] = psql(
      `select final_status, payable_minutes from sessions where id = '${sessionId}';`
    ).split("|");
    expect(finalStatus).toBe("interrupted");
    expect(payableMinutes).toBe("80");

    const eventType = psql(
      `select event_type from entitlement_ledger where reservation_id = '${reservationId}' and event_type in ('consume','release');`
    );
    expect(eventType).toBe("consume");

    const [owedMinutes, reason] = psql(
      `select owed_minutes, reason from makeup_obligations where triggering_session_id = '${sessionId}';`
    ).split("|");
    expect(owedMinutes).toBe("40");
    expect(reason).toBe("teacher_partial_interruption");

    // 80분 < 90분이므로 QC 경고가 하나 더 생겨야 한다.
    const afterQc = psql(`select count(*) from teacher_qc_warnings where teacher_id = '${teacherId}';`);
    expect(Number(afterQc)).toBe(Number(beforeQc) + 1);

    const payoutAmount = psql(`select payable_minutes from payout_items where session_id = '${sessionId}';`);
    expect(payoutAmount).toBe("80");
  });

  it("예정 120분 중 110분 제공 — 110분 지급 + 10분 보충시간 이관", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(21, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${teacherId}');`);
    psql(`select resolve_teacher_partial_interruption('${sessionId}', 110, '${teacherId}', '선생님 사정으로 110분만 진행');`);

    const payableMinutes = psql(`select payable_minutes from sessions where id = '${sessionId}';`);
    expect(payableMinutes).toBe("110");

    const [owedMinutes, reason] = psql(
      `select owed_minutes, reason from makeup_obligations where triggering_session_id = '${sessionId}';`
    ).split("|");
    expect(owedMinutes).toBe("10");
    expect(reason).toBe("teacher_partial_interruption");
  });

  it("90분 이상 제공했으면 QC 경고가 생기지 않는다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(22, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${teacherId}');`);
    const beforeQc = psql(`select count(*) from teacher_qc_warnings where teacher_id = '${teacherId}';`);
    psql(`select resolve_teacher_partial_interruption('${sessionId}', 100, '${teacherId}', '선생님 사정으로 100분만 진행');`);
    const afterQc = psql(`select count(*) from teacher_qc_warnings where teacher_id = '${teacherId}';`);
    expect(afterQc).toBe(beforeQc);
  });

  it("예정 시간 전부 제공(120분)했으면 보충시간 의무가 생기지 않는다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(23, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${teacherId}');`);
    psql(`select resolve_teacher_partial_interruption('${sessionId}', 120, '${teacherId}', '늦게 시작했으나 결국 전부 진행');`);

    const payableMinutes = psql(`select payable_minutes from sessions where id = '${sessionId}';`);
    expect(payableMinutes).toBe("120");
    const obligationCount = psql(`select count(*) from makeup_obligations where triggering_session_id = '${sessionId}';`);
    expect(obligationCount).toBe("0");
  });

  it("실제 제공 분이 예정 시간을 초과하면 거부한다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(24, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${teacherId}');`);
    expect(() =>
      psql(`select resolve_teacher_partial_interruption('${sessionId}', 150, '${teacherId}', '초과 입력 시도');`)
    ).toThrow(/예정 시간.*초과할 수 없습니다/);
  });

  it("실제 제공 분이 음수면 거부한다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(25, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${teacherId}');`);
    expect(() =>
      psql(`select resolve_teacher_partial_interruption('${sessionId}', -1, '${teacherId}', '음수 입력 시도');`)
    ).toThrow(/음수일 수 없습니다/);
  });

  it("이미 지각 처리(resolve_teacher_lateness)가 적용된 세션에는 중복 적용을 거부한다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(26, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${teacherId}');`);
    psql(`select resolve_teacher_lateness('${sessionId}', 10, 5, '${teacherId}', '10분 지각, 5분 연장');`);

    expect(() =>
      psql(`select resolve_teacher_partial_interruption('${sessionId}', 80, '${teacherId}', '부분중단 중복 적용 시도');`)
    ).toThrow(/이미 지각 처리.*중복 적용할 수 없습니다/);
  });

  it("이미 확정된 세션에는 다시 적용할 수 없다", () => {
    grantRegularEntitlement();
    const { sessionId } = bookSession(27, 120);
    psql(`select mark_lesson_session_started('${sessionId}', '${teacherId}');`);
    psql(`select resolve_teacher_partial_interruption('${sessionId}', 80, '${teacherId}', '1차 확정');`);
    expect(() =>
      psql(`select resolve_teacher_partial_interruption('${sessionId}', 80, '${teacherId}', '재확정 시도');`)
    ).toThrow(/이미 확정된 세션/);
  });
});
