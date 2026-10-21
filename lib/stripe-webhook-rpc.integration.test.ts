import { execFile, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

// 마이그레이션 20261030100000 — 레거시 크레딧 1회 지급 RPC, 환불 자동 회수 RPC, attempt_key unique.
// 실행 ID(RUN)가 붙은 전용 행만 만들고 afterAll 에서 지운다. FK 우회가 필요해 픽스처는 superuser(supabase_admin)로 넣는다.
const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const ADMIN_URL = DB_URL.replace("//postgres:", "//supabase_admin:");
const RUN = `stripe${Date.now()}`;

function sql(url: string, q: string): string {
  return execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", q], { encoding: "utf-8" }).trim();
}
const fixture = (q: string) => sql(ADMIN_URL, `set session_replication_role = replica; ${q}`);
const call = (q: string) => sql(DB_URL, q);

const studentId = randomUUID();
const packageId = randomUUID();
const purchases: string[] = [];
const grants: string[] = [];

fixture(`insert into credit_packages (id, name, credit_count, price_usd) values ('${packageId}', '${RUN}', 10, 100);
  insert into students (id, credit_balance) values ('${studentId}', 0);`);

function newPurchase(total = 21875): string {
  const id = randomUUID();
  purchases.push(id);
  fixture(`insert into purchases (id, household_id, child_id, contract_id, entitlement_product_id, product_version_id, quantity, unit_price_minor, package_price_minor, total_minor, validity_months, status)
    values ('${id}', '${randomUUID()}', '${randomUUID()}', '${randomUUID()}', '${randomUUID()}', '${randomUUID()}', 20, 1000, ${total}, ${total}, 6, 'succeeded');`);
  return id;
}
function newGrant(purchaseId: string, qty = 20): string {
  const id = randomUUID();
  grants.push(id);
  fixture(`insert into entitlement_grants (id, child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
    values ('${id}', '${randomUUID()}', '${randomUUID()}', '${purchaseId}', ${qty}, now() + interval '6 months', true);
    insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${id}', 'grant', ${qty}, '${RUN}:${id}');`);
  return id;
}
const addRefund = (purchaseId: string, status: string, amount: number, key: string) =>
  fixture(`insert into payment_refunds (purchase_id, stripe_refund_id, amount_minor, status) values ('${purchaseId}', '${RUN}-${key}', ${amount}, '${status}');`);
const revoke = (purchaseId: string) => JSON.parse(call(`select public.auto_revoke_refunded_purchase('${purchaseId}');`));
const balance = (grantId: string) => Number(call(`select coalesce(sum(amount),0) from entitlement_ledger where grant_id = '${grantId}';`));

afterAll(() => {
  const pg = purchases.map((i) => `'${i}'`).join(",") || "null";
  const gg = grants.map((i) => `'${i}'`).join(",") || "null";
  fixture(`delete from entitlement_ledger where grant_id in (${gg}); delete from entitlement_grants where id in (${gg});
    delete from payment_refunds where purchase_id in (${pg}); delete from payment_attempts where attempt_key like '${RUN}%';
    delete from purchases where id in (${pg});
    delete from credit_transactions where student_id = '${studentId}'; delete from credit_purchases where student_id = '${studentId}';
    delete from students where id = '${studentId}'; delete from credit_packages where id = '${packageId}';`);
});

describe("grant_legacy_credit_purchase", () => {
  const grant = (session: string) => call(`select public.grant_legacy_credit_purchase('${session}', '${studentId}', '${packageId}', 'pi_x');`);
  const state = () => ({
    balance: Number(call(`select credit_balance from students where id='${studentId}';`)),
    purchases: Number(call(`select count(*) from credit_purchases where student_id='${studentId}';`)),
    txs: Number(call(`select count(*) from credit_transactions where student_id='${studentId}';`)),
  });

  it("같은 session 을 다른 이벤트로 재처리해도 한 번만 지급한다", () => {
    expect(JSON.parse(grant(`${RUN}-s1`)).created).toBe(true);
    expect(JSON.parse(grant(`${RUN}-s1`))).toMatchObject({ created: false, reason: "already_granted" });
    expect(state()).toEqual({ balance: 10, purchases: 1, txs: 1 });
  });

  it("동시 경합 호출에서도 한 번만 지급한다", async () => {
    const q = `select public.grant_legacy_credit_purchase('${RUN}-race', '${studentId}', '${packageId}', 'pi_x');`;
    await Promise.all(
      [1, 2, 3, 4, 5, 6].map(
        () => new Promise<void>((resolve, reject) => execFile("psql", [DB_URL, "-q", "-t", "-A", "-c", q], (e) => (e ? reject(e) : resolve())))
      )
    );
    expect(state()).toEqual({ balance: 20, purchases: 2, txs: 2 });
  });

  it("중간 실패(tx insert 실패) 시 전체 롤백 — 재시도에서 정상 지급된다", () => {
    // 같은 트랜잭션 안에서 RPC 후 강제 오류 → 롤백 확인.
    try {
      sql(DB_URL, `begin; select public.grant_legacy_credit_purchase('${RUN}-fail', '${studentId}', '${packageId}', 'pi_x'); select 1/0; commit;`);
    } catch { /* expected */ }
    expect(state()).toEqual({ balance: 20, purchases: 2, txs: 2 });
    expect(JSON.parse(grant(`${RUN}-fail`)).created).toBe(true);
    expect(state()).toEqual({ balance: 30, purchases: 3, txs: 3 });
  });

  it("없는 패키지는 지급하지 않는다", () => {
    expect(JSON.parse(call(`select public.grant_legacy_credit_purchase('${RUN}-x', '${studentId}', '${randomUUID()}', 'pi');`))).toMatchObject({ created: false });
  });
});

describe("auto_revoke_refunded_purchase", () => {
  it("전액 환불 성공 + 전부 미사용이면 그 구매의 grant 만 회수하고, 반복 호출해도 중복 회수 없음", () => {
    const p = newPurchase();
    const g = newGrant(p);
    const otherP = newPurchase();
    const otherG = newGrant(otherP);
    addRefund(p, "succeeded", 21875, "full");
    expect(revoke(p)).toMatchObject({ revoked: true, reason: "revoked" });
    expect(balance(g)).toBe(0);
    expect(balance(otherG)).toBe(20);
    expect(revoke(p)).toMatchObject({ revoked: true, reason: "already_revoked" });
    expect(Number(call(`select count(*) from entitlement_ledger where grant_id='${g}' and event_type='refund';`))).toBe(1);
  });

  it("부분 환불은 회수하지 않는다", () => {
    const p = newPurchase();
    const g = newGrant(p);
    addRefund(p, "succeeded", 5000, "part");
    expect(revoke(p)).toMatchObject({ revoked: false, reason: "not_full_refund" });
    expect(balance(g)).toBe(20);
  });

  it("pending/failed/canceled 환불은 성공으로 취급하지 않는다", () => {
    const p = newPurchase();
    const g = newGrant(p);
    addRefund(p, "pending", 21875, "pend");
    addRefund(p, "failed", 21875, "fail");
    addRefund(p, "canceled", 21875, "canc");
    expect(revoke(p)).toMatchObject({ revoked: false, reason: "not_full_refund" });
    expect(balance(g)).toBe(20);
  });

  it("일부라도 사용·예약됐으면 아무것도 회수하지 않는다", () => {
    const p = newPurchase();
    const g2 = newGrant(p);
    fixture(`insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${g2}', 'adjust', -1, '${RUN}-adj-${g2}');`);
    addRefund(p, "succeeded", 21875, "used");
    expect(revoke(p)).toMatchObject({ revoked: false, reason: "partially_used_or_reserved" });
    expect(balance(g2)).toBe(19);
  });

  const ledger = (g: string, type: string, amt: number, res = false) =>
    fixture(`insert into entitlement_ledger (grant_id, event_type, amount, ${res ? "reservation_id" : "business_event_id"}) values ('${g}', '${type}', ${amt}, '${res ? randomUUID() : `${RUN}-${type}-${randomUUID()}`}');`);
  const manualCase = (name: string, setup: (g: string) => void, expectBalance: number) =>
    it(`${name} → 회수하지 않고 관리자 처리로 남는다`, () => {
      const p = newPurchase();
      const g = newGrant(p);
      setup(g);
      const other = newGrant(newPurchase());
      addRefund(p, "succeeded", 21875, `m${randomUUID()}`);
      const before = Number(call(`select count(*) from entitlement_ledger where grant_id in ('${g}','${other}');`));
      expect(revoke(p)).toMatchObject({ revoked: false, reason: "partially_used_or_reserved" });
      expect(balance(g)).toBe(expectBalance);
      expect(balance(other)).toBe(20);
      expect(Number(call(`select count(*) from entitlement_ledger where grant_id in ('${g}','${other}');`))).toBe(before);
    });
  manualCase("예약 hold 가 grant 를 점유", (g) => ledger(g, "hold", -1, true), 19);
  manualCase("소비(consume) 진행", (g) => { ledger(g, "hold", -1, true); ledger(g, "consume", 0, true); }, 19);
  manualCase("hold 후 release(예약 취소) 이력", (g) => { ledger(g, "hold", -1, true); ledger(g, "release", 1, true); }, 20);
  manualCase("일부 만료(expire)", (g) => ledger(g, "expire", -5), 15);
  manualCase("이전(transfer)된 이력", (g) => ledger(g, "transfer", -5), 15);
  manualCase("관리자 보정(adjust +) 이력(이월·연장 포함)", (g) => ledger(g, "adjust", 2), 22);

  it("환불 pending → succeeded 순서로 오면 succeeded 가 된 뒤에만 회수, 반복 호출 안전", () => {
    const p = newPurchase();
    const g = newGrant(p);
    addRefund(p, "pending", 21875, "seq");
    expect(revoke(p).revoked).toBe(false);
    fixture(`update payment_refunds set status='succeeded' where stripe_refund_id='${RUN}-seq';`);
    expect(revoke(p).revoked).toBe(true);
    expect(revoke(p).reason).toBe("already_revoked");
    expect(balance(g)).toBe(0);
  });

  it("환불 후 재결제: 새 구매의 grant 는 영향받지 않는다", () => {
    const p1 = newPurchase();
    const g1 = newGrant(p1);
    addRefund(p1, "succeeded", 21875, "re1");
    revoke(p1);
    const p2 = newPurchase();
    const g2 = newGrant(p2);
    expect(revoke(p1).reason).toBe("already_revoked");
    expect(balance(g1)).toBe(0);
    expect(balance(g2)).toBe(20);
    expect(revoke(p2)).toMatchObject({ revoked: false, reason: "not_full_refund" });
  });

  it("동시 중복 호출에서도 refund ledger 는 1행", async () => {
    const p = newPurchase();
    const g = newGrant(p);
    addRefund(p, "succeeded", 21875, "conc");
    const q = `select public.auto_revoke_refunded_purchase('${p}');`;
    await Promise.all([1, 2, 3, 4].map(() => new Promise<void>((res, rej) => execFile("psql", [DB_URL, "-q", "-t", "-A", "-c", q], (e) => (e ? rej(e) : res())))));
    expect(Number(call(`select count(*) from entitlement_ledger where grant_id='${g}' and event_type='refund';`))).toBe(1);
    expect(balance(g)).toBe(0);
  });

  it("grant 가 없는 구매는 회수 대상 없음", () => {
    const p = newPurchase();
    addRefund(p, "succeeded", 21875, "nog");
    expect(revoke(p)).toMatchObject({ revoked: false, reason: "no_grant" });
  });
});

describe("payment_attempts.attempt_key", () => {
  it("같은 attempt_key 는 1행만 허용(unique)", () => {
    const p = newPurchase();
    const ins = `insert into payment_attempts (purchase_id, status, attempt_key) values ('${p}', 'succeeded', '${RUN}-k') on conflict (attempt_key) do nothing;`;
    fixture(ins);
    fixture(ins);
    expect(Number(call(`select count(*) from payment_attempts where attempt_key='${RUN}-k';`))).toBe(1);
  });
});
