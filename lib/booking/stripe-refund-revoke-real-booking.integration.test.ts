import { execFile, execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupPerRunTeacher, createPerRunTeacher } from "@/test/per-run-teacher";

// 환불 자동 회수(auto_revoke_refunded_purchase) × 실제 예약 경로 검증.
// ledger 이벤트를 직접 넣지 않고 앱의 실제 RPC(confirm_lesson_booking / cancel_lesson_booking /
// consume_entitlement)로 hold·release·consume 을 만든다. 실행 ID(RUN) 전용 선생님·학생만 사용한다.
// ledger 는 append-only 라 정리되지 않으므로 격리 스택(PORT_OFFSET)에서만 실행한다.
const DB_URL = process.env.SUPABASE_TEST_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54422/postgres";
const SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const RUN = `rvk-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

function psql(sql: string): string {
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], { encoding: "utf-8" }).trim();
}
function psqlAsync(sql: string): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) =>
    execFile("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-c", sql], (e, stdout, stderr) =>
      resolve({ ok: !e, out: String(stdout) + String(stderr) })
    )
  );
}

let teacher: string;
let lessonTypeId: string;
let productId: string;
let versionId: string;
let baseMs: number;
let seq = 0;
const iso = (offsetMin: number) => new Date(baseMs + offsetMin * 60_000).toISOString();
let slot = 0;
const nextSlot = () => (slot += 2) * 60; // 매 호출 2시간씩 뒤로 — 같은 선생님 슬롯이 겹치지 않게

type Fixture = { childId: string; enrollmentId: string; purchaseId: string; grantId: string };

function makeBuyer(): Fixture {
  const childId = psql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${RUN}-${Math.random().toString(36).slice(2, 8)}@example.com', 'x', now(), '{}', '{}', now(), now()) returning id;`
  );
  psql(`insert into profiles (id, role, name, date_of_birth) values ('${childId}', 'student', '환불 테스트 학생', now() - interval '17 years');
        insert into students (id, grade, status) values ('${childId}', '10학년', 'active');`);
  const householdId = psql(`insert into households (primary_guardian_id) values (null) returning id;`);
  psql(`insert into household_members (household_id, profile_id, role, is_primary) values ('${householdId}', '${childId}', 'child', true);`);
  const contractId = psql(`insert into contracts (household_id, child_id, status) values ('${householdId}', '${childId}', 'active') returning id;`);
  const enrollmentId = psql(`insert into subject_enrollments (child_id, subject_id, contract_id, status) values ('${childId}', '${SUBJECT_ID}', '${contractId}', 'planned') returning id;`);
  psql(`insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, source)
        values ('${enrollmentId}', '${teacher}', 'active', now() - interval '1 day', 'app');`);
  const purchaseId = psql(
    `insert into purchases (household_id, child_id, contract_id, entitlement_product_id, product_version_id, quantity, unit_price_minor, package_price_minor, total_minor, validity_months, status)
     values ('${householdId}', '${childId}', '${contractId}', '${productId}', '${versionId}', 20, 1000, 21875, 21875, 12, 'succeeded') returning id;`
  );
  const grantId = psql(
    `insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
     values ('${childId}', '${productId}', '${purchaseId}', 20, now() + interval '400 days', true) returning id;`
  );
  psql(`insert into entitlement_ledger (grant_id, event_type, amount, business_event_id) values ('${grantId}', 'grant', 20, '${RUN}-${grantId}');`);
  psql(`insert into payment_refunds (purchase_id, stripe_refund_id, amount_minor, status) values ('${purchaseId}', '${RUN}-${purchaseId}', 21875, 'succeeded');`);
  return { childId, enrollmentId, purchaseId, grantId };
}

const bookSql = (f: Fixture, startOffsetMin: number) =>
  `select reservation_id from confirm_lesson_booking('${f.childId}', '${f.enrollmentId}', '${teacher}', '${lessonTypeId}', '${iso(startOffsetMin)}', '${iso(startOffsetMin + 60)}', '${RUN}-k${++seq}');`;
const book = (f: Fixture) => psql(bookSql(f, nextSlot()));
const revoke = (f: Fixture) => JSON.parse(psql(`select public.auto_revoke_refunded_purchase('${f.purchaseId}');`)) as { revoked: boolean; reason: string };
const balance = (f: Fixture) => Number(psql(`select coalesce(sum(amount),0) from entitlement_ledger where grant_id='${f.grantId}';`));
const count = (f: Fixture, type: string) =>
  Number(psql(`select count(*) from entitlement_ledger where grant_id='${f.grantId}' and event_type='${type}';`));

beforeAll(() => {
  teacher = createPerRunTeacher(psql, { emailPrefix: "rvk", availability: true });
  lessonTypeId = psql(`select id from lesson_types where code = 'regular';`);
  productId = psql(`select id from entitlement_products where code = 'lesson_pack_10';`);
  versionId = psql(`select id from entitlement_product_versions where entitlement_product_id='${productId}' order by version_number desc limit 1;`);
  const day = 3 + Math.floor(Math.random() * 20);
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  baseMs = d.getTime() + day * 86_400_000;
});
afterAll(() => cleanupPerRunTeacher(psql, teacher));

describe("실제 예약 경로 × 자동 회수", () => {
  it("confirm_lesson_booking 으로 예약된 수업권은 회수하지 않는다(hold 점유)", () => {
    const f = makeBuyer();
    book(f);
    expect(balance(f)).toBe(19);
    expect(revoke(f)).toMatchObject({ revoked: false, reason: "partially_used_or_reserved" });
    expect(balance(f)).toBe(19);
    expect(count(f, "refund")).toBe(0);
  });

  it("cancel_lesson_booking(선생님 귀책 → release) 이후에도 이력이 있어 자동 회수하지 않는다", () => {
    const f = makeBuyer();
    const rid = book(f);
    psql(`select cancel_lesson_booking('${rid}', 'teacher', '${teacher}', 'rvk test');`);
    expect(count(f, "release")).toBe(1);
    expect(revoke(f).revoked).toBe(false);
    expect(count(f, "refund")).toBe(0);
  });

  it("consume_entitlement(수업 소비) 후에는 자동 회수하지 않는다", () => {
    const f = makeBuyer();
    const rid = book(f);
    psql(`select consume_entitlement('${rid}');`);
    expect(count(f, "consume")).toBe(1);
    expect(revoke(f).revoked).toBe(false);
    expect(count(f, "refund")).toBe(0);
  });

  it("미사용 구매는 회수되고, 이후 같은 grant 로는 예약이 거부된다(잔량 0)", () => {
    const f = makeBuyer();
    expect(revoke(f)).toMatchObject({ revoked: true });
    expect(balance(f)).toBe(0);
    expect(() => book(f)).toThrow();
    expect(count(f, "hold")).toBe(0);
  });

  it("경합: 회수와 예약이 동시에 와도 '회수됨 + 예약 hold 존재'는 절대 생기지 않는다(직렬화)", async () => {
    const outcomes = { revokedFirst: 0, bookedFirst: 0 };
    for (let i = 0; i < 12; i += 1) {
      const f = makeBuyer();
      const startMin = nextSlot();
      const [b, r] = await Promise.all([
        psqlAsync(bookSql(f, startMin)),
        psqlAsync(`select public.auto_revoke_refunded_purchase('${f.purchaseId}');`),
      ]);
      expect(r.ok).toBe(true);
      const refunds = count(f, "refund");
      const holds = count(f, "hold");
      // 불변식: 회수(refund)와 hold 가 한 grant 에 공존하면 안 된다.
      expect(refunds > 0 && holds > 0).toBe(false);
      if (refunds > 0) {
        outcomes.revokedFirst += 1;
        expect(b.ok).toBe(false); // 예약은 수업권 없음으로 실패
        expect(balance(f)).toBe(0);
      } else {
        outcomes.bookedFirst += 1;
        expect(b.ok).toBe(true);
        expect(holds).toBe(1);
        expect(balance(f)).toBe(19);
        expect(r.out).toContain("partially_used_or_reserved");
      }
    }
    expect(outcomes.revokedFirst + outcomes.bookedFirst).toBe(12);
  });

  it("경합: 회수와 취소(release)·소비가 겹쳐도 잔량이 음수가 되거나 이중 반영되지 않는다", async () => {
    for (let i = 0; i < 6; i += 1) {
      const f = makeBuyer();
      const rid = book(f);
      await Promise.all([
        psqlAsync(`select public.auto_revoke_refunded_purchase('${f.purchaseId}');`),
        psqlAsync(`select consume_entitlement('${rid}');`),
        psqlAsync(`select public.auto_revoke_refunded_purchase('${f.purchaseId}');`),
      ]);
      expect(balance(f)).toBeGreaterThanOrEqual(0);
      expect(count(f, "refund")).toBe(0); // hold 가 이미 있으므로 어떤 순서여도 회수되지 않는다
      expect(count(f, "consume")).toBe(1);
    }
  });
});

describe("관리자 수동 처리 RPC(resolve_payment_refund / resolve_payment_webhook_issue)", () => {
  const ADMIN = "aaaaaaaa-0000-0000-0000-000000000001";
  const refundId = (f: Fixture) => psql(`select id from payment_refunds where purchase_id='${f.purchaseId}';`);
  const resolve = (f: Fixture, action: string, note: string) =>
    JSON.parse(psql(`select public.resolve_payment_refund('${refundId(f)}', '${ADMIN}', '${action}', '${note}');`)) as { ok: boolean; reason: string };

  it("revoke: 그 구매 grant 만 회수, 처리자·시각·사유 기록, 재처리는 거부", () => {
    const f = makeBuyer();
    const other = makeBuyer();
    expect(resolve(f, "revoke", "")).toMatchObject({ ok: false, reason: "note_required" });
    expect(resolve(f, "revoke", "오너 확인")).toMatchObject({ ok: true });
    expect(balance(f)).toBe(0);
    expect(balance(other)).toBe(20);
    expect(resolve(f, "revoke", "again")).toMatchObject({ ok: false, reason: "already_handled" });
    expect(count(f, "refund")).toBe(1);
    expect(psql(`select handled_by::text || '|' || handled_action || '|' || handled_note || '|' || needs_review::text from payment_refunds where purchase_id='${f.purchaseId}';`)).toBe(`${ADMIN}|revoke|오너 확인|false`);
  });

  it("revoke: 미래 예약(hold)이 있으면 중단되고 아무것도 처리되지 않는다(롤백)", () => {
    const f = makeBuyer();
    book(f);
    expect(() => resolve(f, "revoke", "시도")).toThrow();
    expect(count(f, "refund")).toBe(0);
    expect(psql(`select handled_at is null from payment_refunds where purchase_id='${f.purchaseId}';`)).toBe("t");
  });

  it("dismiss: 수업권 불변, 확인 완료만 기록", () => {
    const f = makeBuyer();
    expect(resolve(f, "dismiss", "이미 오프라인 정산")).toMatchObject({ ok: true });
    expect(balance(f)).toBe(20);
    expect(psql(`select needs_review from payment_refunds where purchase_id='${f.purchaseId}';`)).toBe("f");
  });

  it("이상 대장 해결은 사유 필수·1회만", () => {
    const id = psql(`insert into payment_webhook_issues (event_id, kind) values ('${RUN}-evt', 'amount_mismatch') returning id;`);
    const q = (n: string) => JSON.parse(psql(`select public.resolve_payment_webhook_issue('${id}', '${ADMIN}', '${n}');`)) as { ok: boolean };
    expect(q("").ok).toBe(false);
    expect(q("확인함").ok).toBe(true);
    expect(q("again").ok).toBe(false);
  });
});
