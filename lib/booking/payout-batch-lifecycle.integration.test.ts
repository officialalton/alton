import { execFileSync } from "node:child_process";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

// R10(결제·환불·선생님 정산) — payout batch 생성·승인·지급·역분개 상태머신
// (supabase/migrations/20261218000000_r10_payout_batch_lifecycle.sql)을 로컬
// Postgres에 직접 psql로 검증한다. lib/booking/session-final-judgment.integration.test.ts와
// 동일한 fixture 패턴(전용 선생님/학생, UUID 재사용 없음)을 재사용해 다른 통합
// 테스트와의 teacher_availability_rules 레이스를 피한다.
//
// UAT 실행 ID: r10-batch-uat-2026-09-07 — 아래에서 만드는 auth user 이메일에
// 그대로 포함시켜 남는 흔적을 추적 가능하게 하고, afterAll에서 이 파일이 만든
// teacher_availability_rules만 정리한다(payout_items/batches/entitlement_ledger는
// INSERT-only·FK 참조라 다음 `supabase db reset --local`로 정리되는 기존 관례를 따른다).

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const RUN_ID = "r10-batch-uat-2026-09-07";
const TEACHER_ID = "77777777-0000-0000-0000-000000000002"; // 이 파일 전용(final-judgment 테스트의 ...001과 겹치지 않음)
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001"; // SAT Math (기존 통합 테스트와 공유하는 seed subject, 읽기만 함)
const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  }).trim();
}

let childId: string;
let subjectEnrollmentId: string;
let regularLessonTypeId: string;
let regularProductId: string;

function grantRegularEntitlement(): string {
  const grantId = psql(
    `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
     values ('${childId}', '${regularProductId}', null, 5, now() + interval '90 days', true) returning id;`
  );
  psql(
    `insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'grant', 5, '${RUN_ID}-grant-${grantId}');`
  );
  return grantId;
}

function bookAndCompleteSession(daysAgo: number): string {
  // confirm_lesson_booking()은 미래 시각만 허용(booking_window_violation)하므로
  // 미래로 예약한 뒤(session-final-judgment.integration.test.ts와 동일 패턴)
  // reservations.starts_at/ends_at을 과거로 되돌려 세션 조회 기간(scheduled_start_at)에
  // 걸리게 한다.
  const futureDate = new Date();
  futureDate.setUTCDate(futureDate.getUTCDate() + 40);
  futureDate.setUTCHours(17, 0, 0, 0);
  const startsAt = futureDate.toISOString();
  const endsAt = new Date(futureDate.getTime() + 120 * 60000).toISOString();
  const row = psql(
    `select reservation_id, session_id from confirm_lesson_booking('${childId}', '${subjectEnrollmentId}', '${TEACHER_ID}', '${regularLessonTypeId}', '${startsAt}', '${endsAt}', '${RUN_ID}-book-${Date.now()}-${Math.random()}');`
  );
  const [reservationId, sessionId] = row.split("|");

  const pastDate = new Date();
  pastDate.setUTCDate(pastDate.getUTCDate() - daysAgo);
  pastDate.setUTCHours(17, 0, 0, 0);
  const pastStarts = pastDate.toISOString();
  const pastEnds = new Date(pastDate.getTime() + 120 * 60000).toISOString();
  psql(`update reservations set starts_at = '${pastStarts}', ends_at = '${pastEnds}' where id = '${reservationId}';`);

  psql(`select mark_lesson_session_started('${sessionId}', '${TEACHER_ID}');`);
  psql(`select finalize_lesson_session('${sessionId}', 'completed', '${TEACHER_ID}', '${RUN_ID} 정상 완료');`);
  return sessionId;
}

beforeAll(() => {
  regularLessonTypeId = psql(`select id from lesson_types where code = 'regular';`);
  regularProductId = psql(`select id from entitlement_products where code = 'lesson_pack_10';`);

  // 이 파일 전용 선생님(77777777-...-002)은 seed에 없으므로 profiles/auth.users를 직접 만든다.
  psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', '${TEACHER_ID}', 'authenticated', 'authenticated', '${RUN_ID}-teacher-${Date.now()}@example.com', 'x', now(), '{}', '{}', now(), now())
     on conflict (id) do nothing;`
  );
  psql(`insert into profiles (id, role, name) values ('${TEACHER_ID}', 'teacher', '${RUN_ID} 선생님') on conflict (id) do nothing;`);

  const authEmail = `${RUN_ID}-${Date.now()}@example.com`;
  childId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${authEmail}', 'x', now(), '{}', '{}', now(), now())
     returning id;`
  );
  psql(`
    insert into profiles (id, role, name) values ('${childId}', 'student', '${RUN_ID} 학생');
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
  psql(`select set_teacher_rate('${TEACHER_ID}', 3000000, 'KRW', now() - interval '10 day');`);
  psql(
    `insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, source)
     values ('${subjectEnrollmentId}', '${TEACHER_ID}', 'active', now() - interval '10 day', 'app');`
  );
  psql(
    `insert into teacher_availability_rules (teacher_id, day_of_week, start_time_local, end_time_local, timezone, created_by)
     select '${TEACHER_ID}', d, '00:00', '23:59', 'America/Los_Angeles', '${ADMIN_ID}' from generate_series(0,6) d;`
  );
});

afterAll(() => {
  psql(`delete from teacher_availability_rules where teacher_id = '${TEACHER_ID}' and created_by = '${ADMIN_ID}';`);
});

describe("payout batch lifecycle (R10)", () => {
  it("generate_payout_batches가 미배치 pending 항목을 선생님×통화 단위 draft batch로 묶는다(멱등)", () => {
    grantRegularEntitlement();
    const sessionId = bookAndCompleteSession(3);

    const pendingBefore = psql(
      `select status, batch_id is null from payout_items where session_id = '${sessionId}';`
    );
    expect(pendingBefore).toBe("pending|t");

    const periodStart = new Date();
    periodStart.setUTCDate(periodStart.getUTCDate() - 10);
    const periodEnd = new Date();
    periodEnd.setUTCDate(periodEnd.getUTCDate() + 1);
    const ps = periodStart.toISOString().slice(0, 10);
    const pe = periodEnd.toISOString().slice(0, 10);

    const row = psql(
      `select batch_id, currency, item_count, total_amount_minor from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`
    );
    const [batchId, currency, itemCount] = row.split("|");
    expect(currency).toBe("KRW");
    expect(itemCount).toBe("1");

    const itemStatus = psql(`select status, batch_id from payout_items where session_id = '${sessionId}';`);
    expect(itemStatus).toBe(`batched|${batchId}`);

    // 멱등: 다시 호출해도 이미 배치된 항목은 재조회되지 않아 신규 batch가 생기지 않는다.
    const secondRun = psql(
      `select count(*) from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`
    );
    expect(secondRun).toBe("0");

    // 승인 → 지급까지 상태 전이.
    psql(`select approve_payout_batch('${batchId}', '${ADMIN_ID}');`);
    expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("approved");
    expect(psql(`select status from payout_items where batch_id = '${batchId}';`)).toBe("approved");

    psql(`select mark_payout_batch_paid('${batchId}', '${ADMIN_ID}');`);
    expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("paid");
    expect(psql(`select status from payout_items where batch_id = '${batchId}';`)).toBe("paid");

    const auditActions = psql(
      `select string_agg(action, ',' order by created_at) from payout_batch_audit_log where batch_id = '${batchId}';`
    );
    expect(auditActions).toBe("approved,paid");
  });

  it("paid 상태 batch/item은 직접 수정할 수 없고, reverse_payout_item으로 역분개해야 한다", () => {
    grantRegularEntitlement();
    const sessionId = bookAndCompleteSession(2);
    const periodStart = new Date();
    periodStart.setUTCDate(periodStart.getUTCDate() - 10);
    const ps = periodStart.toISOString().slice(0, 10);
    const pe = new Date().toISOString().slice(0, 10);

    const row = psql(`select batch_id from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`);
    const batchId = row.split("\n")[0];
    psql(`select approve_payout_batch('${batchId}', '${ADMIN_ID}');`);
    psql(`select mark_payout_batch_paid('${batchId}', '${ADMIN_ID}');`);

    const itemId = psql(`select id from payout_items where session_id = '${sessionId}';`);

    // 직접 수정 시도는 트리거가 막는다(R1 기존 불변).
    expect(() => psql(`update payout_items set amount_minor = 1 where id = '${itemId}';`)).toThrow();

    const [origAmount, origMinutes] = psql(
      `select amount_minor, payable_minutes from payout_items where id = '${itemId}';`
    ).split("|");

    const newItemId = psql(`select reverse_payout_item('${itemId}', '${RUN_ID} 판정 정정', '${ADMIN_ID}');`);
    const [revAmount, revMinutes, revType, revStatus] = psql(
      `select amount_minor, payable_minutes, item_type, status from payout_items where id = '${newItemId}';`
    ).split("|");
    expect(revAmount).toBe(String(-Number(origAmount)));
    expect(revMinutes).toBe(String(-Number(origMinutes)));
    expect(revType).toBe("reversal");
    expect(revStatus).toBe("paid");

    // 원본 항목은 그대로 불변.
    const stillOrig = psql(`select amount_minor from payout_items where id = '${itemId}';`);
    expect(stillOrig).toBe(origAmount);
  });
});
