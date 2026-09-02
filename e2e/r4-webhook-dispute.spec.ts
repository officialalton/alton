import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

// R4 후속(2026-09-01) — Stripe charge.dispute.created/.updated/.closed 웹훅이
// payment_disputes(20260924000000)를 stripe_dispute_id 기준 upsert하는 경로.
// 서명 방식/psql 헬퍼는 r4-webhook-purchase-completion.spec.ts와 동일한 패턴을
// 그대로 따른다 — 실제 Stripe API 호출이 아니라 우리 자신의 웹훅 핸들러 코드를
// 검증한다.
//
// 버그 배경: 예전에는 charge.dispute.created가 purchases.status를 'disputed'로
// 직접 UPDATE했는데, purchases.status는 v3_payment_attempt_status enum을
// 재사용하고 이 enum에 'disputed' 값이 없어 UPDATE가 무효 enum 값으로 실패하고
// 그 에러를 앱 코드가 확인하지 않아 사실상 조용히 no-op됐다. 지금은 그 UPDATE
// 자체를 제거했으므로, 아래 테스트들은 "분쟁 이벤트가 와도 purchases.status가
// 절대 바뀌지 않는다"를 명시적으로 검증한다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  });
}

function psqlReturning(sql: string): string {
  return psql(sql).trim().split("\n")[0].trim();
}

function signStripeBody(rawBody: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${rawBody}`;
  const v1 = createHmac("sha256", WEBHOOK_SECRET).update(signedPayload, "utf8").digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

const runId = randomUUID();
const HOUSEHOLD_ID = randomUUID();
const CHILD_ID = randomUUID();

function setUpIsolatedHouseholdAndChild() {
  psql(`
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', '${CHILD_ID}', 'authenticated', 'authenticated',
      'r4-webhook-dispute-e2e-${runId}@example.com', crypt('alton-dev-1234', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''
    );
    insert into profiles (id, role, name, date_of_birth) values
      ('${CHILD_ID}', 'student', 'R4 분쟁 웹훅 E2E 학생', '2010-01-01');
    insert into households (id, default_timezone) values ('${HOUSEHOLD_ID}', 'America/Los_Angeles');
    insert into household_members (household_id, profile_id, role) values
      ('${HOUSEHOLD_ID}', '${CHILD_ID}', 'child');
    insert into contracts (household_id, child_id, status) values
      ('${HOUSEHOLD_ID}', '${CHILD_ID}', 'active');
  `);
}

function cleanupSafe() {
  // purchases/payment_attempts/entitlement_grants/entitlement_ledger는 지우지
  // 않는다(재무 이력, r4-webhook-purchase-completion.spec.ts와 동일한 이유).
  // payment_disputes/external_event_receipts는 이 스펙 전용 runId로만 좁혀서
  // 안전하게 정리한다.
  psql(`delete from payment_disputes where stripe_dispute_id like 'dp_e2e_${runId}%';`);
  psql(
    `delete from external_event_receipts where provider = 'stripe' and payload->'data'->'object'->>'id' like 'dp_e2e_${runId}%';`
  );
}

function seedConfirmedPurchase(): { purchaseId: string; paymentIntentId: string } {
  const contractId = psql(`select id from contracts where child_id = '${CHILD_ID}';`).trim();
  const versionRow = psql(`
    select v.id, v.unit_price_minor, v.price_minor
    from entitlement_product_versions v
    join entitlement_products p on p.id = v.entitlement_product_id
    where p.code = 'lesson_pack_1'
      and v.effective_from <= now() and (v.effective_until is null or v.effective_until > now())
      and v.discontinued_at is null
    order by v.effective_from desc limit 1;
  `).trim();
  const [productVersionId, unitPriceMinorStr, packagePriceMinorStr] = versionRow.split("|");
  const productId = psql(`select id from entitlement_products where code = 'lesson_pack_1';`).trim();
  const paymentIntentId = `pi_e2e_dispute_${runId}`;

  const purchaseId = psqlReturning(`
    insert into purchases (
      household_id, child_id, contract_id, entitlement_product_id, product_version_id,
      quantity, unit_price_minor, package_price_minor, total_minor, currency, validity_months,
      status, stripe_payment_intent_id, confirmed_at
    ) values (
      '${HOUSEHOLD_ID}', '${CHILD_ID}', '${contractId}', '${productId}', '${productVersionId}',
      1, ${unitPriceMinorStr}, ${packagePriceMinorStr}, ${packagePriceMinorStr}, 'USD', 12,
      'succeeded', '${paymentIntentId}', now()
    ) returning id;
  `);
  return { purchaseId, paymentIntentId };
}

function disputePayload(opts: {
  eventId: string;
  type: string;
  disputeId: string;
  chargeId: string;
  paymentIntentId: string | null;
  status: string;
}) {
  return {
    id: opts.eventId,
    type: opts.type,
    data: {
      object: {
        id: opts.disputeId,
        charge: opts.chargeId,
        payment_intent: opts.paymentIntentId,
        status: opts.status,
        amount: 21875,
        currency: "usd",
        reason: "fraudulent",
        created: Math.floor(Date.now() / 1000),
      },
    },
  };
}

test.describe("R4 후속 — Stripe 분쟁 웹훅(payment_disputes upsert)", () => {
  test.skip(!WEBHOOK_SECRET, "STRIPE_WEBHOOK_SECRET이 로컬 env에 없어 웹훅 서명 시뮬레이션을 할 수 없습니다.");

  test.beforeAll(() => {
    cleanupSafe();
    setUpIsolatedHouseholdAndChild();
  });
  test.afterAll(() => cleanupSafe());

  test("charge.dispute.created → payment_disputes 행 생성, purchases.status 불변, entitlement_ledger 미변경", async ({
    request,
    baseURL,
  }) => {
    test.setTimeout(60000);
    const { purchaseId, paymentIntentId } = seedConfirmedPurchase();
    const statusBefore = psql(`select status from purchases where id = '${purchaseId}';`).trim();
    const ledgerCountBefore = psql(
      `select count(*) from entitlement_ledger l join entitlement_grants g on g.id = l.grant_id where g.purchase_id_ref = '${purchaseId}';`
    ).trim();

    const disputeId = `dp_e2e_${runId}_1`;
    const chargeId = `ch_e2e_${runId}_1`;
    const payload = disputePayload({
      eventId: `evt_e2e_dispute_${runId}_1`,
      type: "charge.dispute.created",
      disputeId,
      chargeId,
      paymentIntentId,
      status: "needs_response",
    });
    const rawBody = JSON.stringify(payload);

    const res = await request.post(`${baseURL}/api/webhooks/stripe`, {
      data: rawBody,
      headers: { "stripe-signature": signStripeBody(rawBody), "Content-Type": "application/json" },
    });
    expect(res.status(), await res.text().catch(() => "")).toBe(200);

    const row = psql(
      `select purchase_id, stripe_charge_id, status, amount_minor, currency, reason from payment_disputes where stripe_dispute_id = '${disputeId}';`
    ).trim();
    const [rowPurchaseId, rowChargeId, rowStatus, rowAmount, rowCurrency, rowReason] = row.split("|");
    expect(rowPurchaseId).toBe(purchaseId);
    expect(rowChargeId).toBe(chargeId);
    expect(rowStatus).toBe("needs_response");
    expect(rowAmount).toBe("21875");
    expect(rowCurrency).toBe("USD");
    expect(rowReason).toBe("fraudulent");

    // purchases.status는 v3_payment_attempt_status를 재사용하고 'disputed' 값이
    // 없다 — 분쟁 이벤트로 절대 바뀌지 않는다(핵심 회귀 방지 검증).
    const statusAfter = psql(`select status from purchases where id = '${purchaseId}';`).trim();
    expect(statusAfter).toBe(statusBefore);
    expect(statusAfter).not.toBe("disputed");

    // 분쟁 생성만으로는 entitlement_ledger에 아무 행도 추가되지 않는다(자동
    // 회수 없음, 정책 확정).
    const ledgerCountAfter = psql(
      `select count(*) from entitlement_ledger l join entitlement_grants g on g.id = l.grant_id where g.purchase_id_ref = '${purchaseId}';`
    ).trim();
    expect(ledgerCountAfter).toBe(ledgerCountBefore);

    // 같은 이벤트 재배달 — external_event_receipts idempotency로 no-op, 행 중복 없음.
    const res2 = await request.post(`${baseURL}/api/webhooks/stripe`, {
      data: rawBody,
      headers: { "stripe-signature": signStripeBody(rawBody), "Content-Type": "application/json" },
    });
    expect(res2.status()).toBe(200);
    const body2 = (await res2.json()) as { skipped?: string };
    expect(body2.skipped).toBe("already processed");
    const countAfterDup = psql(
      `select count(*) from payment_disputes where stripe_dispute_id = '${disputeId}';`
    ).trim();
    expect(countAfterDup).toBe("1");
  });

  test("charge.dispute.updated → 같은 stripe_dispute_id 행을 갱신(신규 행 생성 아님)", async ({
    request,
    baseURL,
  }) => {
    test.setTimeout(60000);
    const { purchaseId, paymentIntentId } = seedConfirmedPurchase();
    const disputeId = `dp_e2e_${runId}_2`;
    const chargeId = `ch_e2e_${runId}_2`;

    const createdPayload = disputePayload({
      eventId: `evt_e2e_dispute_${runId}_2a`,
      type: "charge.dispute.created",
      disputeId,
      chargeId,
      paymentIntentId,
      status: "needs_response",
    });
    const createdRaw = JSON.stringify(createdPayload);
    const res1 = await request.post(`${baseURL}/api/webhooks/stripe`, {
      data: createdRaw,
      headers: { "stripe-signature": signStripeBody(createdRaw), "Content-Type": "application/json" },
    });
    expect(res1.status()).toBe(200);

    const updatedPayload = disputePayload({
      eventId: `evt_e2e_dispute_${runId}_2b`,
      type: "charge.dispute.updated",
      disputeId,
      chargeId,
      paymentIntentId,
      status: "under_review",
    });
    const updatedRaw = JSON.stringify(updatedPayload);
    const res2 = await request.post(`${baseURL}/api/webhooks/stripe`, {
      data: updatedRaw,
      headers: { "stripe-signature": signStripeBody(updatedRaw), "Content-Type": "application/json" },
    });
    expect(res2.status()).toBe(200);

    const count = psql(`select count(*) from payment_disputes where stripe_dispute_id = '${disputeId}';`).trim();
    expect(count).toBe("1");
    const status = psql(`select status from payment_disputes where stripe_dispute_id = '${disputeId}';`).trim();
    expect(status).toBe("under_review");

    const purchaseStatus = psql(`select status from purchases where id = '${purchaseId}';`).trim();
    expect(purchaseStatus).not.toBe("disputed");
  });

  test("charge.dispute.closed → closed_at 채워지고 status가 최종 상태로 갱신된다", async ({ request, baseURL }) => {
    test.setTimeout(60000);
    const { paymentIntentId } = seedConfirmedPurchase();
    const disputeId = `dp_e2e_${runId}_3`;
    const chargeId = `ch_e2e_${runId}_3`;

    const createdPayload = disputePayload({
      eventId: `evt_e2e_dispute_${runId}_3a`,
      type: "charge.dispute.created",
      disputeId,
      chargeId,
      paymentIntentId,
      status: "needs_response",
    });
    const createdRaw = JSON.stringify(createdPayload);
    await request.post(`${baseURL}/api/webhooks/stripe`, {
      data: createdRaw,
      headers: { "stripe-signature": signStripeBody(createdRaw), "Content-Type": "application/json" },
    });

    const closedPayload = disputePayload({
      eventId: `evt_e2e_dispute_${runId}_3b`,
      type: "charge.dispute.closed",
      disputeId,
      chargeId,
      paymentIntentId,
      status: "won",
    });
    const closedRaw = JSON.stringify(closedPayload);
    const res = await request.post(`${baseURL}/api/webhooks/stripe`, {
      data: closedRaw,
      headers: { "stripe-signature": signStripeBody(closedRaw), "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(200);

    const row = psql(
      `select status, closed_at is not null from payment_disputes where stripe_dispute_id = '${disputeId}';`
    ).trim();
    const [status, closedAtSet] = row.split("|");
    expect(status).toBe("won");
    expect(closedAtSet).toBe("t");
  });

  test("매칭되는 purchase가 없는 분쟁도 조용히 버리지 않고 purchase_id=null로 기록한다(대사 항목)", async ({
    request,
    baseURL,
  }) => {
    test.setTimeout(60000);
    const disputeId = `dp_e2e_${runId}_unmatched`;
    const chargeId = `ch_e2e_${runId}_unmatched`;
    const payload = disputePayload({
      eventId: `evt_e2e_dispute_${runId}_unmatched`,
      type: "charge.dispute.created",
      disputeId,
      chargeId,
      paymentIntentId: `pi_e2e_${runId}_never_existed`,
      status: "needs_response",
    });
    const rawBody = JSON.stringify(payload);

    const res = await request.post(`${baseURL}/api/webhooks/stripe`, {
      data: rawBody,
      headers: { "stripe-signature": signStripeBody(rawBody), "Content-Type": "application/json" },
    });
    expect(res.status(), await res.text().catch(() => "")).toBe(200);

    const row = psql(
      `select purchase_id is null, status from payment_disputes where stripe_dispute_id = '${disputeId}';`
    ).trim();
    const [purchaseIdIsNull, status] = row.split("|");
    expect(purchaseIdIsNull).toBe("t");
    expect(status).toBe("needs_response");
  });
});
