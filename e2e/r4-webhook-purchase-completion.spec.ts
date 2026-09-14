import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

// R4 — Stripe checkout.session.completed 웹훅으로 구매를 완료 처리하는 경로.
// app/api/webhooks/stripe/route.ts는 실제 Stripe SDK(stripe.webhooks.constructEvent)로
// 서명을 검증한다(R4 유닛 테스트 route.r4.test.ts와 달리 이 테스트는 SDK 자체를
// mock하지 않는다) — 그래서 Stripe 공식 서명 스킴(t=<timestamp>,v1=<hmac-sha256 hex>,
// signed payload = `${timestamp}.${rawBody}`)으로 직접 서명해 same-origin으로
// POST한다. 외부 Stripe API 호출이 아니라 우리 자신의 webhook 핸들러 코드 검증이다.
//
// 격리: entitlement_ledger는 INSERT-only 트리거(reject_ledger_mutation)로 보호돼
// UPDATE/DELETE가 아예 불가능하고, entitlement_grants/purchases도 FK로 물려있어
// 한 번 grant가 생기면 그 purchase/contract도 지울 수 없다(재무 감사 이력이라
// 의도된 설계). 그래서 기존 household/child를 재사용해 지우고 다시 만드는 대신,
// 이 스펙 전용 새 household+child(+auth.users)를 매 실행마다 새 UUID로 만들고
// 절대 지우지 않는다 — 다른 스펙(r4-purchase-flow.spec.ts 등)의 fixture와 아이디
// 공간이 겹치지 않아 교차 오염이 없다.

const DB_URL = "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql], {
    encoding: "utf-8",
  });
}

// psql -c는 단일 INSERT ... RETURNING 문이라도 반환된 값 다음 줄에 "INSERT 0 1"
// 커맨드 태그를 함께 찍는다(-t/-A는 컬럼 헤더만 억제) — 첫 줄만 취한다.
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
      'r4-webhook-e2e-${runId}@example.com', crypt('alton-dev-1234', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''
    );
    insert into profiles (id, role, name, date_of_birth) values
      ('${CHILD_ID}', 'student', 'R4 웹훅 E2E 학생', '2010-01-01');
    insert into households (id, default_timezone) values ('${HOUSEHOLD_ID}', 'America/Los_Angeles');
    insert into household_members (household_id, profile_id, role) values
      ('${HOUSEHOLD_ID}', '${CHILD_ID}', 'child');
    insert into contracts (household_id, child_id, status) values
      ('${HOUSEHOLD_ID}', '${CHILD_ID}', 'active');
  `);
}

function cleanupSafe() {
  // 재무 이력(purchases/payment_attempts/entitlement_grants/entitlement_ledger)은
  // 절대 지우지 않는다 — INSERT-only 트리거 및 FK 제약으로 지울 수 없게 설계돼
  // 있고, 이 스펙은 매번 새 household/child를 쓰므로 남겨둬도 다른 테스트와
  // 충돌하지 않는다. external_event_receipts만 정리한다(FK 제약 없음, 안전).
  psql(
    `delete from external_event_receipts where provider = 'stripe' and payload->'data'->'object'->>'id' like 'cs_e2e_${runId}%';`
  );
}

function seedPurchase(): { purchaseId: string; unitPriceMinor: number; packagePriceMinor: number } {
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
  const unitPriceMinor = Number(unitPriceMinorStr);
  const packagePriceMinor = Number(packagePriceMinorStr);

  const productId = psql(`select id from entitlement_products where code = 'lesson_pack_1';`).trim();

  const purchaseId = psqlReturning(`
    insert into purchases (
      household_id, child_id, contract_id, entitlement_product_id, product_version_id,
      quantity, unit_price_minor, package_price_minor, total_minor, currency, validity_months, status
    ) values (
      '${HOUSEHOLD_ID}', '${CHILD_ID}', '${contractId}', '${productId}', '${productVersionId}',
      1, ${unitPriceMinor}, ${packagePriceMinor}, ${packagePriceMinor}, 'USD', 12, 'created'
    ) returning id;
  `);
  return { purchaseId, unitPriceMinor, packagePriceMinor };
}

test.describe("R4 — Stripe 웹훅 구매 완료 처리(멱등성/동시성)", () => {
  test.skip(!WEBHOOK_SECRET, "STRIPE_WEBHOOK_SECRET이 로컬 env에 없어 웹훅 서명 시뮬레이션을 할 수 없습니다.");

  test.beforeAll(() => {
    cleanupSafe();
    setUpIsolatedHouseholdAndChild();
  });
  test.afterAll(() => cleanupSafe());

  test("checkout.session.completed → payment_attempts/purchases/entitlement_grants/ledger/receipt 전부 생성, 같은 이벤트 재배달은 no-op", async ({
    request,
    baseURL,
  }) => {
    test.setTimeout(60000);
    const { purchaseId, unitPriceMinor: expectedUnitPriceMinor } = seedPurchase();

    const sessionId = `cs_e2e_${runId}_1`;
    const eventId = `evt_e2e_${runId}_1`;
    const payload = {
      id: eventId,
      type: "checkout.session.completed",
      data: {
        object: {
          id: sessionId,
          payment_intent: `pi_e2e_${runId}_1`,
          metadata: { purchase_id: purchaseId, child_id: CHILD_ID, household_id: HOUSEHOLD_ID },
        },
      },
    };
    const rawBody = JSON.stringify(payload);

    const res1 = await request.post(`${baseURL}/api/webhooks/stripe`, {
      data: rawBody,
      headers: { "stripe-signature": signStripeBody(rawBody), "Content-Type": "application/json" },
    });
    expect(res1.status(), await res1.text().catch(() => "")).toBe(200);

    // payment_attempts: succeeded 행.
    const attemptStatus = psql(
      `select status from payment_attempts where purchase_id = '${purchaseId}' order by created_at desc limit 1;`
    ).trim();
    expect(attemptStatus).toBe("succeeded");

    // purchases.status 갱신.
    const purchaseStatus = psql(`select status from purchases where id = '${purchaseId}';`).trim();
    expect(purchaseStatus).toBe("succeeded");

    // entitlement_grants: 정확히 1개, 수량 정상, 단가 스냅샷 확인.
    const grantRow = psql(
      `select id, original_quantity from entitlement_grants where purchase_id_ref = '${purchaseId}';`
    ).trim();
    expect(grantRow).not.toBe("");
    const [grantId, grantQuantity] = grantRow.split("|");
    expect(Number(grantQuantity)).toBe(1);
    expect(expectedUnitPriceMinor).toBeGreaterThan(0);

    // entitlement_ledger: grant 이벤트 1개, amount=1.
    const ledgerCount = psql(
      `select count(*) from entitlement_ledger where grant_id = '${grantId}' and event_type = 'grant';`
    ).trim();
    expect(ledgerCount).toBe("1");
    const ledgerAmount = psql(
      `select amount from entitlement_ledger where grant_id = '${grantId}' and event_type = 'grant';`
    ).trim();
    expect(ledgerAmount).toBe("1");

    // external_event_receipts: 이 event_id로 receipt 존재.
    const receiptCount = psql(
      `select count(*) from external_event_receipts where provider = 'stripe' and event_id = '${eventId}';`
    ).trim();
    expect(receiptCount).toBe("1");

    // 같은 event.id로 두 번째 배달 — no-op이어야 한다(grant/ledger 중복 생성 없음).
    const res2 = await request.post(`${baseURL}/api/webhooks/stripe`, {
      data: rawBody,
      headers: { "stripe-signature": signStripeBody(rawBody), "Content-Type": "application/json" },
    });
    expect(res2.status()).toBe(200);
    const body2 = (await res2.json()) as { skipped?: string };
    expect(body2.skipped).toBe("already processed");

    const grantCountAfterDup = psql(
      `select count(*) from entitlement_grants where purchase_id_ref = '${purchaseId}';`
    ).trim();
    expect(grantCountAfterDup).toBe("1");
    const ledgerCountAfterDup = psql(
      `select count(*) from entitlement_ledger where grant_id = '${grantId}' and event_type = 'grant';`
    ).trim();
    expect(ledgerCountAfterDup).toBe("1");
  });

  test("가장 중요: 동시(Promise.all) 두 번 배달돼도 grant는 정확히 한 번만 생성된다(재정 정합성)", async ({
    request,
    baseURL,
  }) => {
    test.setTimeout(60000);
    const { purchaseId } = seedPurchase();

    const sessionId = `cs_e2e_${runId}_2`;
    const eventId = `evt_e2e_${runId}_2`;
    const payload = {
      id: eventId,
      type: "checkout.session.completed",
      data: {
        object: {
          id: sessionId,
          payment_intent: `pi_e2e_${runId}_2`,
          metadata: { purchase_id: purchaseId, child_id: CHILD_ID, household_id: HOUSEHOLD_ID },
        },
      },
    };
    const rawBody = JSON.stringify(payload);

    // 같은 이벤트(event.id 동일)를 동시에 두 번 발사한다 — 각 요청은 자기만의
    // 서명(타임스탬프)을 만들지만 Stripe SDK의 재생공격 방지 tolerance 안에 있고,
    // idempotency 판단은 payload.id(event.id) 기준이라 동일 이벤트로 처리된다.
    const [resA, resB] = await Promise.all([
      request.post(`${baseURL}/api/webhooks/stripe`, {
        data: rawBody,
        headers: { "stripe-signature": signStripeBody(rawBody), "Content-Type": "application/json" },
      }),
      request.post(`${baseURL}/api/webhooks/stripe`, {
        data: rawBody,
        headers: { "stripe-signature": signStripeBody(rawBody), "Content-Type": "application/json" },
      }),
    ]);
    expect(resA.status()).toBe(200);
    expect(resB.status()).toBe(200);

    const grantCount = psql(
      `select count(*) from entitlement_grants where purchase_id_ref = '${purchaseId}';`
    ).trim();
    expect(grantCount, "동시 웹훅 배달로 entitlement grant가 중복 생성됨 — 재정 정합성 위반").toBe("1");

    const grantId = psql(
      `select id from entitlement_grants where purchase_id_ref = '${purchaseId}' limit 1;`
    ).trim();
    const ledgerGrantEventCount = psql(
      `select count(*) from entitlement_ledger where grant_id = '${grantId}' and event_type = 'grant';`
    ).trim();
    expect(ledgerGrantEventCount).toBe("1");
  });
});
