import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// 2026-10-21 호환성 점검: "구형 route.ts(=origin/main 의 Stripe 웹훅) + 신 스키마(20261030100000 ~ 20261031200000)".
// route 핸들러를 직접 호출하고 서명은 테스트 시크릿으로 정상 생성한다(stripe.webhooks.generateTestHeaderString).
// 실패 주입: (1) DB 트리거(zz_fault 표에 이름이 있으면 해당 INSERT/UPDATE 가 예외) = 실제 DB 오류,
//            (2) 어댑터 crash = 핸들러 도중 프로세스가 죽는 상황(예외 throw).
// 격리 스택에서만 실행한다(통합 가드). 결과는 STRIPE_COMPAT_OUT 경로에 JSON 으로 남긴다.
const DB_URL = process.env.SUPABASE_TEST_DB_URL!;
const API_URL = process.env.SUPABASE_TEST_API_URL!;
const SECRET = process.env.STRIPE_COMPAT_SECRET_KEY!; // 격리 스택 로컬 service_role 키
const OUT = process.env.STRIPE_COMPAT_OUT;
const RUN = `cmp-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const WH_SECRET = "whsec_compat_test_secret";

const crash: { table: string | null; ops: string[] } = { table: null, ops: [] };

vi.mock("@/lib/supabase-admin", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return {
    createAdminClient: () => {
      const real = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      return new Proxy(real, {
        get(target, prop, recv) {
          if (prop === "from") {
            return (table: string) => {
              const q = target.from(table);
              if (crash.table !== table) return q;
              return new Proxy(q, {
                get(qt, qp, qr) {
                  if (typeof qp === "string" && crash.ops.includes(qp)) {
                    return () => {
                      throw new Error(`simulated crash at ${table}.${qp}`);
                    };
                  }
                  const v = Reflect.get(qt, qp, qr);
                  return typeof v === "function" ? v.bind(qt) : v;
                },
              });
            };
          }
          const v = Reflect.get(target, prop, recv);
          return typeof v === "function" ? v.bind(target) : v;
        },
      });
    },
  };
});

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
const num = (sql: string) => Number(psql(sql));

let POST: (r: Request) => Promise<Response>;
let stripeLib: { webhooks: { generateTestHeaderString: (o: { payload: string; secret: string }) => string } };
let evSeq = 0;
const results: Record<string, unknown> = {};
const nid = (p: string) => `${p}_${RUN}_${++evSeq}`;

function req(event: Record<string, unknown>) {
  const payload = JSON.stringify(event);
  const sig = stripeLib.webhooks.generateTestHeaderString({ payload, secret: WH_SECRET });
  return new Request("http://localhost/api/webhooks/stripe", { method: "POST", headers: { "stripe-signature": sig }, body: payload });
}
async function send(event: Record<string, unknown>): Promise<{ status: number; body: unknown }> {
  try {
    const res = await POST(req(event));
    return { status: res.status, body: await res.json() };
  } catch (e) {
    return { status: 500, body: { thrown: (e as Error).message } }; // Next.js 는 처리되지 않은 예외를 500 으로 응답한다
  }
}
const sessionEvent = (eventId: string, session: Record<string, unknown>) => ({
  id: eventId,
  type: "checkout.session.completed",
  data: { object: session },
});

let productId = "";
let versionId = "";
let packageId = "";
let packageCredits = 0;

function makeBuyer() {
  const childId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${RUN}-${Math.random().toString(36).slice(2, 8)}@example.com', 'x', now(), '{}', '{}', now(), now()) returning id;`
  );
  psql(`insert into profiles (id, role, name, date_of_birth) values ('${childId}', 'student', '호환 테스트 학생', now() - interval '17 years');
        insert into students (id, grade, status, credit_balance) values ('${childId}', '10학년', 'active', 0);`);
  return childId;
}
function makePurchase(): { childId: string; purchaseId: string } {
  const childId = makeBuyer();
  const householdId = psql(`insert into households (primary_guardian_id) values (null) returning id;`);
  psql(`insert into household_members (household_id, profile_id, role, is_primary) values ('${householdId}', '${childId}', 'child', true);`);
  const contractId = psql(`insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', 'active') returning id;`);
  const purchaseId = psql(
    `insert into purchases (household_id, child_id, contract_id, entitlement_product_id, product_version_id, quantity, unit_price_minor, package_price_minor, total_minor, validity_months, status)
     values ('${householdId}', '${childId}', '${contractId}', '${productId}', '${versionId}', 10, 1000, 10000, 10000, 12, 'created') returning id;`
  );
  return { childId, purchaseId };
}
const fault = (name: string, on: boolean) =>
  psql(on ? `insert into zz_fault values ('${name}') on conflict do nothing;` : `delete from zz_fault where name='${name}';`);

// 구매 경로(P) 관측
const P = (purchaseId: string) => ({
  grants: num(`select count(*) from entitlement_grants where purchase_id_ref='${purchaseId}'`),
  ledgerGrantRows: num(`select count(*) from entitlement_ledger l join entitlement_grants g on g.id=l.grant_id where g.purchase_id_ref='${purchaseId}' and l.event_type='grant'`),
  attempts: num(`select count(*) from payment_attempts where purchase_id='${purchaseId}'`),
  attemptsSucceeded: num(`select count(*) from payment_attempts where purchase_id='${purchaseId}' and status='succeeded'`),
  purchaseStatus: psql(`select status from purchases where id='${purchaseId}'`),
});
// 레거시 경로(L) 관측
const L = (studentId: string) => ({
  creditPurchaseRows: num(`select count(*) from credit_purchases where student_id='${studentId}'`),
  creditTxRows: num(`select count(*) from credit_transactions where student_id='${studentId}' and type='purchase'`),
  txSum: num(`select coalesce(sum(amount),0) from credit_transactions where student_id='${studentId}' and type='purchase'`),
  balance: num(`select credit_balance from students where id='${studentId}'`),
  orphanPurchaseRows: num(`select count(*) from credit_purchases cp where student_id='${studentId}' and not exists (select 1 from credit_transactions t where t.related_purchase_id=cp.id)`),
});
const receipt = (eventId: string) => {
  const r = psql(`select count(*)||'|'||coalesce(bool_or(processed_at is not null)::text,'none') from external_event_receipts where provider='stripe' and event_id='${eventId}'`);
  const [n, processed] = r.split("|");
  return { rows: Number(n), processed };
};
const uniqueViolationsOnNewConstraints = () =>
  num(`select count(*) from payment_attempts where attempt_key is not null`) + num(`select count(*) from credit_purchases where stripe_checkout_session_id is not null`);

beforeAll(async () => {
  expect(DB_URL, "SUPABASE_TEST_DB_URL").toBeTruthy();
  process.env.NEXT_PUBLIC_SUPABASE_URL = API_URL;
  process.env.SUPABASE_SECRET_KEY = SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = WH_SECRET;
  process.env.STRIPE_SECRET_KEY = "sk_test_compat_dummy_never_called";
  const { getStripe } = await import("@/lib/stripe");
  stripeLib = getStripe() as unknown as typeof stripeLib;
  POST = (await import("./route")).POST;

  productId = psql(`select id from entitlement_products where code = 'lesson_pack_10';`);
  versionId = psql(`select id from entitlement_product_versions where entitlement_product_id='${productId}' order by version_number desc limit 1;`);
  const pkg = psql(`select id||'|'||credit_count from credit_packages order by credit_count limit 1`).split("|");
  packageId = pkg[0];
  packageCredits = Number(pkg[1]);

  psql(`create table if not exists zz_fault (name text primary key);
    create or replace function zz_maybe_fail() returns trigger language plpgsql as $f$ begin
      if exists (select 1 from zz_fault where name = tg_argv[0]) then raise exception 'zz injected fault %', tg_argv[0]; end if;
      return coalesce(new, old); end $f$;
    drop trigger if exists zz_f_grant on entitlement_grants;
    create trigger zz_f_grant before insert on entitlement_grants for each row execute function zz_maybe_fail('grant_insert');
    drop trigger if exists zz_f_ctx on credit_transactions;
    create trigger zz_f_ctx before insert on credit_transactions for each row execute function zz_maybe_fail('ctx_insert');
    drop trigger if exists zz_f_bal on students;
    create trigger zz_f_bal before update of credit_balance on students for each row when (old.credit_balance is distinct from new.credit_balance) execute function zz_maybe_fail('balance_update');
    drop trigger if exists zz_f_rcpt on external_event_receipts;
    create trigger zz_f_rcpt before update on external_event_receipts for each row execute function zz_maybe_fail('receipt_update');`);
});

afterAll(() => {
  try {
    psql(`drop trigger if exists zz_f_grant on entitlement_grants; drop trigger if exists zz_f_ctx on credit_transactions;
      drop trigger if exists zz_f_bal on students; drop trigger if exists zz_f_rcpt on external_event_receipts;
      drop function if exists zz_maybe_fail(); drop table if exists zz_fault;`);
  } catch {}
  if (OUT) writeFileSync(OUT, JSON.stringify(results, null, 2));
});

const legacySession = (studentId: string, sid: string, pi: string) => ({
  id: sid,
  payment_intent: pi,
  amount_total: 0,
  metadata: { student_id: studentId, package_id: packageId },
});
const purchaseSession = (purchaseId: string, sid: string, pi: string) => ({
  id: sid,
  payment_intent: pi,
  amount_total: 10000,
  metadata: { purchase_id: purchaseId },
});

describe("S1 구매 행 생성 후 지급 전 실패", () => {
  it("P: entitlement grant 삽입 실패 -> 500, 재시도로 복구, 시도 행 중복", async () => {
    const { purchaseId } = makePurchase();
    const e = nid("evt");
    fault("grant_insert", true);
    const r1 = await send(sessionEvent(e, purchaseSession(purchaseId, nid("cs"), nid("pi"))));
    const afterFail = { status: r1.status, ...P(purchaseId), receipt: receipt(e) };
    fault("grant_insert", false);
    const r2 = await send(sessionEvent(e, purchaseSession(purchaseId, "cs_x", "pi_x")));
    const afterRetry = { status: r2.status, ...P(purchaseId), receipt: receipt(e) };
    results["S1_P"] = { afterFail, afterRetry };
    expect(afterRetry.grants).toBe(1);
  });
  it("L: credit_purchases 삽입 후 credit_transactions 실패 -> 500, 재시도하면 고아 구매 행 생성", async () => {
    const studentId = makeBuyer();
    const e = nid("evt");
    const sess = legacySession(studentId, nid("cs"), nid("pi"));
    fault("ctx_insert", true);
    const r1 = await send(sessionEvent(e, sess));
    const afterFail = { status: r1.status, ...L(studentId), receipt: receipt(e) };
    fault("ctx_insert", false);
    const r2 = await send(sessionEvent(e, sess));
    const afterRetry = { status: r2.status, ...L(studentId), receipt: receipt(e) };
    results["S1_L"] = { afterFail, afterRetry };
    expect(afterRetry.balance).toBe(packageCredits);
  });
  it("L: 거래 기록 후 잔액 갱신 실패 -> 재시도하면 거래 이중 기록(잔액과 불일치)", async () => {
    const studentId = makeBuyer();
    const e = nid("evt");
    const sess = legacySession(studentId, nid("cs"), nid("pi"));
    fault("balance_update", true);
    const r1 = await send(sessionEvent(e, sess));
    const afterFail = { status: r1.status, ...L(studentId), receipt: receipt(e) };
    fault("balance_update", false);
    const r2 = await send(sessionEvent(e, sess));
    const afterRetry = { status: r2.status, ...L(studentId), receipt: receipt(e) };
    results["S1b_L"] = { afterFail, afterRetry };
  });
});

describe("S2 지급 후 처리 완료 기록 전 실패", () => {
  it("P: 지급 후 processed_at 갱신이 DB 오류 -> 코드가 오류를 무시하고 200", async () => {
    const { purchaseId } = makePurchase();
    const e = nid("evt");
    fault("receipt_update", true);
    const r1 = await send(sessionEvent(e, purchaseSession(purchaseId, nid("cs"), nid("pi"))));
    const afterFail = { status: r1.status, ...P(purchaseId), receipt: receipt(e) };
    fault("receipt_update", false);
    // Stripe 는 200 을 받았으므로 재전송하지 않는다. 같은 이벤트가 다시 오는 경우(수동 재전송 등)를 시험:
    const r2 = await send(sessionEvent(e, purchaseSession(purchaseId, "cs_x", "pi_x")));
    const afterRedeliver = { status: r2.status, ...P(purchaseId), receipt: receipt(e) };
    results["S2_P_dberror"] = { afterFail, afterRedeliver };
  });
  it("P: 지급 후 프로세스 중단(crash) -> 500, 재시도로 복구", async () => {
    const { purchaseId } = makePurchase();
    const e = nid("evt");
    crash.table = "external_event_receipts";
    crash.ops = ["update"];
    const r1 = await send(sessionEvent(e, purchaseSession(purchaseId, nid("cs"), nid("pi"))));
    crash.table = null;
    const afterFail = { status: r1.status, ...P(purchaseId), receipt: receipt(e) };
    const r2 = await send(sessionEvent(e, purchaseSession(purchaseId, "cs_x", "pi_x")));
    const afterRetry = { status: r2.status, ...P(purchaseId), receipt: receipt(e) };
    results["S2_P_crash"] = { afterFail, afterRetry };
    expect(afterRetry.grants).toBe(1);
  });
  it("L: 지급 후 processed_at 갱신 DB 오류 -> 200, 같은 이벤트 재전송 시 이중 지급", async () => {
    const studentId = makeBuyer();
    const e = nid("evt");
    const sess = legacySession(studentId, nid("cs"), nid("pi"));
    fault("receipt_update", true);
    const r1 = await send(sessionEvent(e, sess));
    const afterFail = { status: r1.status, ...L(studentId), receipt: receipt(e) };
    fault("receipt_update", false);
    const r2 = await send(sessionEvent(e, sess));
    const afterRedeliver = { status: r2.status, ...L(studentId), receipt: receipt(e) };
    results["S2_L_dberror"] = { afterFail, afterRedeliver };
  });
  it("L: 지급 후 프로세스 중단(crash) -> 500, 재시도하면 이중 지급", async () => {
    const studentId = makeBuyer();
    const e = nid("evt");
    const sess = legacySession(studentId, nid("cs"), nid("pi"));
    crash.table = "external_event_receipts";
    crash.ops = ["update"];
    const r1 = await send(sessionEvent(e, sess));
    crash.table = null;
    const afterFail = { status: r1.status, ...L(studentId), receipt: receipt(e) };
    const r2 = await send(sessionEvent(e, sess));
    const afterRetry = { status: r2.status, ...L(studentId), receipt: receipt(e) };
    results["S2_L_crash"] = { afterFail, afterRetry };
  });
});

describe("S3 같은 이벤트/다른 이벤트의 같은 결제 재전송", () => {
  it("P: 같은 이벤트 2회 -> 2회째 skipped; 다른 이벤트 id 같은 세션 -> 시도 행만 증가, grant 1", async () => {
    const { purchaseId } = makePurchase();
    const sid = nid("cs");
    const pi = nid("pi");
    const e1 = nid("evt");
    const a = await send(sessionEvent(e1, purchaseSession(purchaseId, sid, pi)));
    const b = await send(sessionEvent(e1, purchaseSession(purchaseId, sid, pi)));
    const c = await send(sessionEvent(nid("evt"), purchaseSession(purchaseId, sid, pi)));
    results["S3_P"] = { first: a, sameEventAgain: b, differentEventSameSession: c, state: P(purchaseId) };
    expect(P(purchaseId).grants).toBe(1);
  });
  it("L: 같은 이벤트 2회 -> skipped; 다른 이벤트 id 같은 세션 -> 이중 지급", async () => {
    const studentId = makeBuyer();
    const sess = legacySession(studentId, nid("cs"), nid("pi"));
    const e1 = nid("evt");
    const a = await send(sessionEvent(e1, sess));
    const b = await send(sessionEvent(e1, sess));
    const c = await send(sessionEvent(nid("evt"), sess));
    results["S3_L"] = { first: a, sameEventAgain: b, differentEventSameSession: c, state: L(studentId) };
  });
});

describe("S4 동시 처리", () => {
  it("P/L: 같은 새 이벤트 동시 2건(경쟁)", async () => {
    const { purchaseId } = makePurchase();
    const e = nid("evt");
    const sess = purchaseSession(purchaseId, nid("cs"), nid("pi"));
    const rs = await Promise.all([send(sessionEvent(e, sess)), send(sessionEvent(e, sess))]);
    const studentId = makeBuyer();
    const e2 = nid("evt");
    const ls = legacySession(studentId, nid("cs"), nid("pi"));
    const rl = await Promise.all([send(sessionEvent(e2, ls)), send(sessionEvent(e2, ls))]);
    results["S4a_fresh_same_event"] = { P: { responses: rs, state: P(purchaseId) }, L: { responses: rl, state: L(studentId) } };
  });
  it("P/L: 처리 안 끝난 영수증을 가진 이벤트의 재전송 동시 2건", async () => {
    const { purchaseId } = makePurchase();
    const e = nid("evt");
    const sess = purchaseSession(purchaseId, nid("cs"), nid("pi"));
    psql(`insert into external_event_receipts (provider, event_id, payload) values ('stripe','${e}','{}')`);
    const rs = await Promise.all([send(sessionEvent(e, sess)), send(sessionEvent(e, sess))]);
    const studentId = makeBuyer();
    const e2 = nid("evt");
    const ls = legacySession(studentId, nid("cs"), nid("pi"));
    psql(`insert into external_event_receipts (provider, event_id, payload) values ('stripe','${e2}','{}')`);
    const rl = await Promise.all([send(sessionEvent(e2, ls)), send(sessionEvent(e2, ls))]);
    results["S4b_unprocessed_receipt_concurrent_redelivery"] = { P: { responses: rs, state: P(purchaseId) }, L: { responses: rl, state: L(studentId) } };
  });
  it("L: 다른 이벤트 id, 같은 세션 동시 2건", async () => {
    const studentId = makeBuyer();
    const ls = legacySession(studentId, nid("cs"), nid("pi"));
    const rl = await Promise.all([send(sessionEvent(nid("evt"), ls)), send(sessionEvent(nid("evt"), ls))]);
    results["S4c_L_diff_events_same_session_concurrent"] = { responses: rl, state: L(studentId) };
  });
});

describe("S5 영구 실패(무한 500)", () => {
  it("P: 존재하지 않는 purchase_id -> 매번 500, 영수증 미처리로 남음", async () => {
    const e = nid("evt");
    const bogus = "00000000-0000-4000-8000-0000000000aa";
    const rs = [];
    for (let i = 0; i < 3; i++) rs.push(await send(sessionEvent(e, purchaseSession(bogus, "cs_b", "pi_b"))));
    results["S5_P_missing_purchase"] = { statuses: rs.map((r) => r.status), receipt: receipt(e) };
  });
  it("L: metadata 불완전 -> 매번 400(Stripe 는 비 2xx 로 재시도)", async () => {
    const e = nid("evt");
    const rs = [];
    for (let i = 0; i < 3; i++) rs.push(await send(sessionEvent(e, { id: "cs_m", payment_intent: "pi_m", metadata: { student_id: "x" } })));
    results["S5_L_missing_metadata"] = { statuses: rs.map((r) => r.status), receipt: receipt(e) };
  });
  it("신규 유일 제약은 구형 코드 경로에서 한 번도 걸리지 않는다(컬럼 미사용)", () => {
    results["new_constraint_columns_populated_by_old_code"] = uniqueViolationsOnNewConstraints();
    expect(uniqueViolationsOnNewConstraints()).toBe(0);
  });
});
