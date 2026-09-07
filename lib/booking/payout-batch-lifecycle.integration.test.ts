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

    // 승인까지는 정책상 허용(법인 설립 전에도 검토·승인 원장은 진행).
    psql(`select approve_payout_batch('${batchId}', '${ADMIN_ID}');`);
    expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("approved");
    expect(psql(`select status from payout_items where batch_id = '${batchId}';`)).toBe("approved");

    // 법인 설립 전 지급 경계(2026-09-07, 20261221000000 corrective migration):
    // approved -> processing/paid는 real_disbursement_enabled() 게이트가
    // false(기본값)인 동안 fail-closed로 거부된다.
    expect(() => psql(`select mark_payout_batch_processing('${batchId}');`)).toThrow(
      /법인 설립 전 지급 경계/
    );
    expect(() => psql(`select mark_payout_batch_paid('${batchId}', '${ADMIN_ID}');`)).toThrow(
      /법인 설립 전 지급 경계/
    );
    // 거부된 시도가 상태를 바꾸지 않았는지 확인.
    expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("approved");

    const auditActions = psql(
      `select string_agg(action, ',' order by created_at) from payout_batch_audit_log where batch_id = '${batchId}';`
    );
    expect(auditActions).toBe("approved");
  });

  // 게이트가 닫혀 있는 동안(fail-closed, 기본값) processing/dispatch_requested/
  // provider_pending/paid로의 모든 전이가 전부 거부되는지 전체 매트릭스를 확인한다
  // (제품 오너 리뷰: "Task A 라운드에서 일부만 검증됨 — 전체 매트릭스로 확장").
  it("게이트가 닫혀 있으면 processing/dispatch_requested/provider_pending/paid 전이가 전부 거부된다", () => {
    grantRegularEntitlement();
    const sessionId = bookAndCompleteSession(4);
    const periodStart = new Date();
    periodStart.setUTCDate(periodStart.getUTCDate() - 10);
    const ps = periodStart.toISOString().slice(0, 10);
    const pe = new Date().toISOString().slice(0, 10);

    const batchId = psql(
      `select batch_id from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`
    );
    psql(`select approve_payout_batch('${batchId}', '${ADMIN_ID}');`);
    expect(psql(`select real_disbursement_enabled();`)).toBe("f");

    expect(() => psql(`select mark_payout_batch_processing('${batchId}');`)).toThrow(
      /법인 설립 전 지급 경계/
    );
    expect(() => psql(`select dispatch_payout_batch('${batchId}', 'mercury', '${ADMIN_ID}');`)).toThrow(
      /법인 설립 전 지급 경계/
    );
    expect(() =>
      psql(`select mark_payout_batch_provider_pending('${batchId}', 'tx-should-not-work');`)
    ).toThrow(/법인 설립 전 지급 경계|dispatch_requested 상태의 batch만/);
    expect(() => psql(`select mark_payout_batch_paid('${batchId}', '${ADMIN_ID}');`)).toThrow(
      /법인 설립 전 지급 경계/
    );

    expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("approved");
    void sessionId;
  });

  // R10 corrective(요구사항 1, 2026-09-07 리뷰): 게이트가 열려 있어도 paid는
  // provider_pending 상태 + provider_transaction_id + provider_confirmed_at이
  // 전부 있어야만 성립한다. approved/processing에서 곧바로 paid로 갈 수 없고,
  // provider_pending이어도 확인 컬럼이 없으면 거부된다.
  it("게이트가 열려도 provider_pending + transaction id + 최종 확인이 모두 있어야만 paid가 된다", () => {
    grantRegularEntitlement();
    const sessionId = bookAndCompleteSession(5);
    const periodStart = new Date();
    periodStart.setUTCDate(periodStart.getUTCDate() - 10);
    const ps = periodStart.toISOString().slice(0, 10);
    const pe = new Date().toISOString().slice(0, 10);

    const batchId = psql(
      `select batch_id from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`
    );
    const itemId = psql(`select id from payout_items where session_id = '${sessionId}';`);
    psql(`select approve_payout_batch('${batchId}', '${ADMIN_ID}');`);

    psql(`update payout_disbursement_gate set real_disbursement_enabled = true where id = true;`);
    try {
      // approved에서 곧바로 paid — 여전히 거부(요구사항 1의 핵심).
      expect(() => psql(`select mark_payout_batch_paid('${batchId}', '${ADMIN_ID}');`)).toThrow(
        /provider_pending 상태의 batch만/
      );

      const key = psql(`select dispatch_payout_batch('${batchId}', 'mercury', '${ADMIN_ID}');`);
      expect(key).toMatch(/-/); // uuid
      expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe(
        "dispatch_requested"
      );

      // dispatch_requested에서도 paid 직행은 여전히 거부.
      expect(() => psql(`select mark_payout_batch_paid('${batchId}', '${ADMIN_ID}');`)).toThrow(
        /provider_pending 상태의 batch만/
      );

      psql(`select mark_payout_batch_provider_pending('${batchId}', 'mercury-tx-001');`);
      expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe(
        "provider_pending"
      );

      // provider_pending이지만 아직 최종 확인(provider_confirmed_at)이 없다 — 거부.
      expect(() => psql(`select mark_payout_batch_paid('${batchId}', '${ADMIN_ID}');`)).toThrow(
        /제공자 최종 성공 확인/
      );

      // provider_transaction_id 없이는 확인 자체도 거부(방어적 가드).
      psql(`update payout_batches set provider_transaction_id = null where id = '${batchId}';`);
      expect(() =>
        psql(`select mark_payout_batch_provider_confirmed('${batchId}', '${ADMIN_ID}');`)
      ).toThrow(/provider_transaction_id가 없는 batch/);
      psql(`update payout_batches set provider_transaction_id = 'mercury-tx-001' where id = '${batchId}';`);

      psql(`select mark_payout_batch_provider_confirmed('${batchId}', '${ADMIN_ID}');`);
      // 이제 세 조건이 모두 있으므로 paid로 전이 성공.
      psql(`select mark_payout_batch_paid('${batchId}', '${ADMIN_ID}');`);

      const [status, txId, confirmedNotNull] = psql(
        `select status, provider_transaction_id, (provider_confirmed_at is not null) from payout_batches where id = '${batchId}';`
      ).split("|");
      expect(status).toBe("paid");
      expect(txId).toBe("mercury-tx-001");
      expect(confirmedNotNull).toBe("t");

      const [itemStatus, itemTx, itemConfirmedNotNull] = psql(
        `select status, provider_transaction_id, (provider_confirmed_at is not null) from payout_items where id = '${itemId}';`
      ).split("|");
      expect(itemStatus).toBe("paid");
      expect(itemTx).toBe("mercury-tx-001");
      expect(itemConfirmedNotNull).toBe("t");

      // CHECK 제약이 구조적으로도 강제하는지: 함수를 우회해 provider_transaction_id를
      // 지우는 직접 UPDATE는 트리거(prevent_paid_item_mutation, old.status=paid)가
      // 이미 막지만, 애초에 paid로 만드는 시도 자체도 CHECK가 막는지 별도 batch로 확인.
    } finally {
      psql(`update payout_disbursement_gate set real_disbursement_enabled = false where id = true;`);
    }
  });

  // R10 corrective(요구사항 1): CHECK 제약은 함수 본문과 무관하게 구조적으로
  // paid + 확인 컬럼 누락 조합을 거부한다 — 새 batch를 만들어 직접 검증.
  // (2026-09-07 트리거 보강 이후: 트리거는 OLD.status=provider_pending일 때만
  //  paid 전이를 허용하므로, CHECK 자체를 단독으로 시험하려면 batch를 먼저
  //  provider_pending까지 올려서 트리거 검사를 통과시킨 뒤 확인 컬럼 누락 상태로
  //  paid를 시도해야 한다.)
  it("CHECK 제약이 provider_transaction_id/provider_confirmed_at 없는 paid 행을 구조적으로 거부한다", () => {
    grantRegularEntitlement();
    bookAndCompleteSession(6);
    const periodStart = new Date();
    periodStart.setUTCDate(periodStart.getUTCDate() - 10);
    const ps = periodStart.toISOString().slice(0, 10);
    const pe = new Date().toISOString().slice(0, 10);

    const batchId = psql(
      `select batch_id from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`
    );
    psql(`select approve_payout_batch('${batchId}', '${ADMIN_ID}');`);

    psql(`update payout_disbursement_gate set real_disbursement_enabled = true where id = true;`);
    try {
      psql(`select dispatch_payout_batch('${batchId}', 'mercury', '${ADMIN_ID}');`);
      psql(`select mark_payout_batch_provider_pending('${batchId}', 'mercury-tx-check-only');`);
      expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe(
        "provider_pending"
      );

      // 트리거의 OLD.status 검사는 통과(provider_pending)하지만, CHECK가
      // provider_confirmed_at(및 이번 사례는 transaction_id도) 누락을 거부해야 한다.
      expect(() =>
        psql(`update payout_batches set status = 'paid' where id = '${batchId}';`)
      ).toThrow(/payout_batches_paid_requires_confirmation/);
      expect(() =>
        psql(
          `update payout_batches set status = 'paid', provider_transaction_id = 'x' where id = '${batchId}';`
        )
      ).toThrow(/payout_batches_paid_requires_confirmation/);
    } finally {
      psql(`update payout_disbursement_gate set real_disbursement_enabled = false where id = true;`);
    }
  });

  it("reverse_payout_item은 게이트가 열려 있어도(요구사항 2) 항상 approved에서 시작하고, 정규 payout과 동일한 파이프라인을 거쳐야만 paid가 된다", () => {
    grantRegularEntitlement();
    const sessionId = bookAndCompleteSession(7);
    const periodStart = new Date();
    periodStart.setUTCDate(periodStart.getUTCDate() - 10);
    const ps = periodStart.toISOString().slice(0, 10);
    const pe = new Date().toISOString().slice(0, 10);

    const row = psql(`select batch_id from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`);
    const batchId = row.split("\n")[0];
    psql(`select approve_payout_batch('${batchId}', '${ADMIN_ID}');`);

    const itemId = psql(`select id from payout_items where session_id = '${sessionId}';`);

    // reverse_payout_item()은 paid 상태의 원본 항목만 대상으로 하므로, 이 시나리오를
    // 시험하려면 게이트를 임시로 열어 정식 파이프라인(dispatch->provider_pending->
    // confirmed->paid)으로 원본을 paid까지 만든 뒤 다시 닫는다(운영 게이트 테이블을
    // 테스트 목적으로만 직접 조작 — 실제 앱 코드 경로는 아님).
    psql(`update payout_disbursement_gate set real_disbursement_enabled = true where id = true;`);
    try {
      psql(`select dispatch_payout_batch('${batchId}', 'mercury', '${ADMIN_ID}');`);
      psql(`select mark_payout_batch_provider_pending('${batchId}', 'mercury-tx-orig');`);
      psql(`select mark_payout_batch_provider_confirmed('${batchId}', '${ADMIN_ID}');`);
      psql(`select mark_payout_batch_paid('${batchId}', '${ADMIN_ID}');`);
    } finally {
      psql(`update payout_disbursement_gate set real_disbursement_enabled = false where id = true;`);
    }
    expect(psql(`select status from payout_items where id = '${itemId}';`)).toBe("paid");

    // 직접 수정 시도는 트리거가 막는다(R1 기존 불변, 게이트와 무관).
    expect(() => psql(`update payout_items set amount_minor = 1 where id = '${itemId}';`)).toThrow();

    const [origAmount, origMinutes] = psql(
      `select amount_minor, payable_minutes from payout_items where id = '${itemId}';`
    ).split("|");

    // 게이트가 닫힌 채로(기본값) 역분개 — 새 batch/item은 paid가 아니라 approved에서 멈춰야 한다.
    const newItemId = psql(`select reverse_payout_item('${itemId}', '${RUN_ID} 판정 정정', '${ADMIN_ID}');`);
    const [revAmount, revMinutes, revType, revStatus, revBatchId] = psql(
      `select amount_minor, payable_minutes, item_type, status, batch_id from payout_items where id = '${newItemId}';`
    ).split("|");
    expect(revAmount).toBe(String(-Number(origAmount)));
    expect(revMinutes).toBe(String(-Number(origMinutes)));
    expect(revType).toBe("reversal");
    expect(revStatus).toBe("approved"); // paid가 아니다 — 법인 설립 전 경계.
    expect(psql(`select status from payout_batches where id = '${revBatchId}';`)).toBe("approved");

    // 요구사항 2의 핵심: 게이트를 다시 열어도(이미 approved인) 역분개 batch가
    // "게이트가 열려있으니" 자동으로 paid가 되지는 않는다 — 정규 payout과 동일한
    // 파이프라인(dispatch->provider_pending->confirmed->paid)을 직접 거쳐야만 한다.
    psql(`update payout_disbursement_gate set real_disbursement_enabled = true where id = true;`);
    try {
      expect(psql(`select status from payout_batches where id = '${revBatchId}';`)).toBe("approved");
      expect(() => psql(`select mark_payout_batch_paid('${revBatchId}', '${ADMIN_ID}');`)).toThrow(
        /provider_pending 상태의 batch만/
      );
      psql(`select dispatch_payout_batch('${revBatchId}', 'wise', '${ADMIN_ID}');`);
      psql(`select mark_payout_batch_provider_pending('${revBatchId}', 'wise-tx-reversal');`);
      psql(`select mark_payout_batch_provider_confirmed('${revBatchId}', '${ADMIN_ID}');`);
      psql(`select mark_payout_batch_paid('${revBatchId}', '${ADMIN_ID}');`);
      expect(psql(`select status from payout_batches where id = '${revBatchId}';`)).toBe("paid");
      expect(psql(`select status from payout_items where id = '${newItemId}';`)).toBe("paid");
    } finally {
      psql(`update payout_disbursement_gate set real_disbursement_enabled = false where id = true;`);
    }

    // 원본 항목은 그대로 불변.
    const stillOrig = psql(`select amount_minor from payout_items where id = '${itemId}';`);
    expect(stillOrig).toBe(origAmount);
  });

  // R10 corrective(요구사항 4): mark_payout_batch_failed()가 검토 단계
  // (reviewing/reviewed)에서도 실제로 동작해 PayoutBatchesTab의 버튼 노출과
  // 일치하는지 확인한다.
  it("mark_payout_batch_failed는 reviewing/reviewed 상태에서도 동작한다(UI 버튼과 DB 허용 상태 일치)", () => {
    grantRegularEntitlement();
    bookAndCompleteSession(8);
    const periodStart = new Date();
    periodStart.setUTCDate(periodStart.getUTCDate() - 10);
    const ps = periodStart.toISOString().slice(0, 10);
    const pe = new Date().toISOString().slice(0, 10);

    const batchId = psql(
      `select batch_id from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`
    );
    psql(`select submit_payout_batch_for_review('${batchId}');`);
    expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("reviewed");

    psql(`select mark_payout_batch_failed('${batchId}', '${RUN_ID} 검토 중 반려', '${ADMIN_ID}');`);
    expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("failed");
    expect(psql(`select count(*) from payout_items where batch_id = '${batchId}';`)).toBe("0");
  });

  // R10 corrective(2026-09-07, CHECK 제약 보강 — 20261225000000): CHECK 제약은
  // 행의 현재 컬럼만 볼 수 있어 OLD.status를 검사할 수 없다. 특권 직접 UPDATE가
  // approved -> paid를 한 문장으로 실행하면서 provider_transaction_id·
  // provider_confirmed_at까지 같은 문장에서 채우면 CHECK만으로는 막을 수 없었다
  // — 이 트리거(payout_batches_paid_transition_guard)가 OLD.status=provider_pending을
  // 구조적으로 강제하는지 검증한다.
  it("트리거가 direct UPDATE로 approved->paid를 확인 컬럼과 함께 한 문장에 넣어도 거부한다", () => {
    grantRegularEntitlement();
    bookAndCompleteSession(9);
    const periodStart = new Date();
    periodStart.setUTCDate(periodStart.getUTCDate() - 10);
    const ps = periodStart.toISOString().slice(0, 10);
    const pe = new Date().toISOString().slice(0, 10);

    const batchId = psql(
      `select batch_id from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`
    );
    psql(`select approve_payout_batch('${batchId}', '${ADMIN_ID}');`);
    expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("approved");

    // 게이트 상태와 무관하게(CHECK를 우회하려는 시도이지 게이트 우회 시도가
    // 아니므로 게이트는 닫힌 채로 둔다) 확인 컬럼까지 한 문장에서 채워서
    // approved -> paid 직접 UPDATE를 시도한다.
    expect(() =>
      psql(
        `update payout_batches set status = 'paid', provider_transaction_id = 'shortcut-tx', provider_confirmed_at = now() where id = '${batchId}';`
      )
    ).toThrow(/provider_pending 상태에서만 paid로 전이할 수 있습니다/);

    expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("approved");
    expect(psql(`select provider_transaction_id is null from payout_batches where id = '${batchId}';`)).toBe(
      "t"
    );
  });

  // 이전 라운드 CHECK 제약(provider_pending이지만 확인 컬럼 누락)이 새 트리거와
  // 나란히 있어도 여전히 통과하는지(둘 다 독립적으로 paid를 막는지) 재확인한다.
  it("트리거가 추가된 뒤에도 provider_pending + 확인 컬럼 누락 조합은 CHECK가 그대로 거부한다", () => {
    grantRegularEntitlement();
    bookAndCompleteSession(10);
    const periodStart = new Date();
    periodStart.setUTCDate(periodStart.getUTCDate() - 10);
    const ps = periodStart.toISOString().slice(0, 10);
    const pe = new Date().toISOString().slice(0, 10);

    const batchId = psql(
      `select batch_id from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`
    );
    psql(`select approve_payout_batch('${batchId}', '${ADMIN_ID}');`);

    psql(`update payout_disbursement_gate set real_disbursement_enabled = true where id = true;`);
    try {
      psql(`select dispatch_payout_batch('${batchId}', 'mercury', '${ADMIN_ID}');`);
      psql(`select mark_payout_batch_provider_pending('${batchId}', 'mercury-tx-partial');`);
      expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe(
        "provider_pending"
      );

      // provider_pending이므로 트리거의 OLD.status 검사는 통과하지만,
      // provider_confirmed_at이 없어 CHECK가 여전히 거부해야 한다.
      expect(() =>
        psql(`update payout_batches set status = 'paid' where id = '${batchId}';`)
      ).toThrow(/payout_batches_paid_requires_confirmation/);

      // 함수 경로로도 동일하게 거부(20261224000000의 기존 가드, 재확인).
      expect(() => psql(`select mark_payout_batch_paid('${batchId}', '${ADMIN_ID}');`)).toThrow(
        /제공자 최종 성공 확인/
      );
    } finally {
      psql(`update payout_disbursement_gate set real_disbursement_enabled = false where id = true;`);
    }
  });

  // R10 corrective(2026-09-07): 정규 파이프라인(provider_pending -> confirmed ->
  // paid)이 트리거가 추가된 뒤에도 end-to-end로 정상 동작하는지 재확인한다.
  it("정규 파이프라인(provider_pending -> provider_confirmed -> paid)은 트리거가 있어도 end-to-end로 성공한다", () => {
    grantRegularEntitlement();
    const sessionId = bookAndCompleteSession(1);
    const periodStart = new Date();
    periodStart.setUTCDate(periodStart.getUTCDate() - 10);
    const ps = periodStart.toISOString().slice(0, 10);
    const pe = new Date().toISOString().slice(0, 10);

    const batchId = psql(
      `select batch_id from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`
    );
    const itemId = psql(`select id from payout_items where session_id = '${sessionId}';`);
    psql(`select approve_payout_batch('${batchId}', '${ADMIN_ID}');`);

    psql(`update payout_disbursement_gate set real_disbursement_enabled = true where id = true;`);
    try {
      psql(`select dispatch_payout_batch('${batchId}', 'mercury', '${ADMIN_ID}');`);
      psql(`select mark_payout_batch_provider_pending('${batchId}', 'mercury-tx-e2e');`);
      psql(`select mark_payout_batch_provider_confirmed('${batchId}', '${ADMIN_ID}');`);
      psql(`select mark_payout_batch_paid('${batchId}', '${ADMIN_ID}');`);

      expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("paid");
      expect(psql(`select status from payout_items where id = '${itemId}';`)).toBe("paid");
    } finally {
      psql(`update payout_disbursement_gate set real_disbursement_enabled = false where id = true;`);
    }
  });

  // R10 corrective(2026-09-07, CHECK 제약 보강): payout_items 단독 직접 UPDATE로
  // batch와 무관하게(또는 batch가 아직 paid가 아닌 상태에서) paid로 만드는 시도가
  // 트리거(payout_items_paid_transition_guard)에 의해 거부되는지 검증한다.
  it("payout_items를 batch와 독립적으로(또는 batch가 paid이기 전에) 직접 paid로 만들면 거부된다", () => {
    grantRegularEntitlement();
    bookAndCompleteSession(2);
    const periodStart = new Date();
    periodStart.setUTCDate(periodStart.getUTCDate() - 10);
    const ps = periodStart.toISOString().slice(0, 10);
    const pe = new Date().toISOString().slice(0, 10);

    const batchId = psql(
      `select batch_id from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`
    );
    const itemId = psql(`select id from payout_items where batch_id = '${batchId}';`);
    psql(`select approve_payout_batch('${batchId}', '${ADMIN_ID}');`);
    expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe("approved");

    // batch는 여전히 approved(paid 아님) — item만 직접 paid로 바꾸려는 시도.
    expect(() =>
      psql(
        `update payout_items set status = 'paid', provider_transaction_id = 'x', provider_confirmed_at = now() where id = '${itemId}';`
      )
    ).toThrow(/부모 payout_batch가 이미 paid 상태일 때만/);
    expect(psql(`select status from payout_items where id = '${itemId}';`)).toBe("approved");

    // batch를 정규 파이프라인으로 paid까지 올려도, batch UPDATE와 별개의 트랜잭션에서
    // item만 뒤늦게 직접 paid로 바꾸려는 시도는 여전히 막혀야 한다는 것을 보여주기
    // 위해, 이번에는 batch를 provider_pending까지만 두고(아직 paid 아님) item을
    // 직접 paid로 바꿔본다 — 부모가 provider_pending일 뿐이라 여전히 거부되어야 한다.
    psql(`update payout_disbursement_gate set real_disbursement_enabled = true where id = true;`);
    try {
      psql(`select dispatch_payout_batch('${batchId}', 'mercury', '${ADMIN_ID}');`);
      psql(`select mark_payout_batch_provider_pending('${batchId}', 'mercury-tx-item-direct');`);
      expect(psql(`select status from payout_batches where id = '${batchId}';`)).toBe(
        "provider_pending"
      );

      expect(() =>
        psql(
          `update payout_items set status = 'paid', provider_transaction_id = 'x', provider_confirmed_at = now() where id = '${itemId}';`
        )
      ).toThrow(/부모 payout_batch가 이미 paid 상태일 때만/);
      // item 상태는 dispatch/provider_pending 단계에서는 그대로 approved다
      // (mark_payout_batch_paid만이 item을 paid로 올린다) — 거부된 시도가
      // 이 상태를 바꾸지 않았는지 확인.
      expect(psql(`select status from payout_items where id = '${itemId}';`)).toBe("approved");
    } finally {
      psql(`update payout_disbursement_gate set real_disbursement_enabled = false where id = true;`);
    }
  });

  // R10 corrective(2026-09-07): reverse_payout_item()이 만드는 reversal item도
  // 새 트리거가 있는 상태에서 여전히 정규 파이프라인 없이는 paid로 지름길을
  // 낼 수 없는지(INSERT 시점 및 이후 직접 UPDATE 시도 둘 다) 재확인한다.
  it("reverse_payout_item으로 만든 reversal item도 새 트리거 하에서 정규 파이프라인 없이는 paid 지름길이 없다", () => {
    grantRegularEntitlement();
    const sessionId = bookAndCompleteSession(11);
    const periodStart = new Date();
    periodStart.setUTCDate(periodStart.getUTCDate() - 11);
    const ps = periodStart.toISOString().slice(0, 10);
    const pe = new Date().toISOString().slice(0, 10);

    const batchId = psql(
      `select batch_id from generate_payout_batches('${ps}', '${pe}', '${TEACHER_ID}');`
    );
    psql(`select approve_payout_batch('${batchId}', '${ADMIN_ID}');`);
    const itemId = psql(`select id from payout_items where session_id = '${sessionId}';`);

    psql(`update payout_disbursement_gate set real_disbursement_enabled = true where id = true;`);
    try {
      psql(`select dispatch_payout_batch('${batchId}', 'mercury', '${ADMIN_ID}');`);
      psql(`select mark_payout_batch_provider_pending('${batchId}', 'mercury-tx-rev-orig');`);
      psql(`select mark_payout_batch_provider_confirmed('${batchId}', '${ADMIN_ID}');`);
      psql(`select mark_payout_batch_paid('${batchId}', '${ADMIN_ID}');`);
    } finally {
      psql(`update payout_disbursement_gate set real_disbursement_enabled = false where id = true;`);
    }

    const newItemId = psql(`select reverse_payout_item('${itemId}', '${RUN_ID} 트리거 재검증', '${ADMIN_ID}');`);
    const [revStatus, revBatchId] = psql(
      `select status, batch_id from payout_items where id = '${newItemId}';`
    ).split("|");
    expect(revStatus).toBe("approved");
    expect(psql(`select status from payout_batches where id = '${revBatchId}';`)).toBe("approved");

    // reversal item을 직접 paid로 만들려는 시도 — 부모 batch가 approved일 뿐이므로 거부.
    expect(() =>
      psql(
        `update payout_items set status = 'paid', provider_transaction_id = 'x', provider_confirmed_at = now() where id = '${newItemId}';`
      )
    ).toThrow(/부모 payout_batch가 이미 paid 상태일 때만/);

    // 부모 batch 자체도 트리거로 인해 approved -> paid 직접 지름길이 불가.
    expect(() =>
      psql(
        `update payout_batches set status = 'paid', provider_transaction_id = 'x', provider_confirmed_at = now() where id = '${revBatchId}';`
      )
    ).toThrow(/provider_pending 상태에서만 paid로 전이할 수 있습니다/);
  });
});
