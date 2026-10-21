import { execFile, execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
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

// ---- 수동 경로 동시성(마이그레이션 20261031200000: 잠금 → 재확인 → 같은 트랜잭션 회수) ----
// 반복 횟수는 아래 상수. 결과는 docs 에 실측으로 기록한다(횟수가 한정적이므로 "경합 없음" 단정이 아니라
// 불변식이 모든 시행에서 유지됐다는 관찰).
const ADMIN2 = "aaaaaaaa-0000-0000-0000-000000000001";
const ROUNDS = { vsBook: 25, vsConsume: 15, twoAdmins: 15 };
const outcomeLog: Record<string, Record<string, number>> = {};
const tally = (k: string, o: string) => ((outcomeLog[k] ??= {})[o] = (outcomeLog[k][o] ?? 0) + 1);
const resolveSql = (f: Fixture, admin = ADMIN2, action = "revoke") =>
  `select public.resolve_payment_refund((select id from payment_refunds where purchase_id='${f.purchaseId}'), '${admin}', '${action}', 'rvk concurrent');`;
const handled = (f: Fixture) => psql(`select handled_at is not null from payment_refunds where purchase_id='${f.purchaseId}';`) === "t";

describe("수동 회수 동시성", () => {
  it(`수동 회수 vs 신규 예약 ×${ROUNDS.vsBook}: 회수+hold 공존 없음, 중단 시 장부·완료표시 모두 미반영`, async () => {
    for (let i = 0; i < ROUNDS.vsBook; i += 1) {
      const f = makeBuyer();
      const [b, r] = await Promise.all([psqlAsync(bookSql(f, nextSlot())), psqlAsync(resolveSql(f))]);
      const refunds = count(f, "refund");
      const holds = count(f, "hold");
      expect(refunds > 0 && holds > 0).toBe(false);
      if (r.ok) {
        // 회수가 먼저: 예약은 수업권 없음으로 실패
        tally("vsBook", "revoke-first");
        expect(b.ok).toBe(false);
        expect(refunds).toBe(1);
        expect(handled(f)).toBe(true);
        expect(balance(f)).toBe(0);
      } else {
        // 예약이 먼저: 회수는 예약 때문에 중단 — 전체 롤백
        tally("vsBook", "booking-first");
        expect(b.ok).toBe(true);
        expect(refunds).toBe(0);
        expect(handled(f)).toBe(false);
        expect(balance(f)).toBe(19);
      }
    }
  });

  it(`수동 회수 vs 소비 ×${ROUNDS.vsConsume}: 소비 전엔 중단·소비 후엔 회수, 중복·이중 반영 없음`, async () => {
    for (let i = 0; i < ROUNDS.vsConsume; i += 1) {
      const f = makeBuyer();
      const rid = book(f);
      const [c, r] = await Promise.all([psqlAsync(`select consume_entitlement('${rid}');`), psqlAsync(resolveSql(f))]);
      expect(c.ok).toBe(true);
      expect(count(f, "consume")).toBe(1);
      expect(balance(f)).toBeGreaterThanOrEqual(0);
      if (r.ok) {
        tally("vsConsume", "consume-first");
        expect(count(f, "refund")).toBe(1);
        expect(balance(f)).toBe(0);
        expect(handled(f)).toBe(true);
      } else {
        tally("vsConsume", "resolve-blocked");
        expect(count(f, "refund")).toBe(0);
        expect(balance(f)).toBe(19);
        expect(handled(f)).toBe(false);
      }
    }
  });

  it(`같은 환불을 두 관리자가 동시에 처리 ×${ROUNDS.twoAdmins}: 정확히 한 번만 처리`, async () => {
    for (let i = 0; i < ROUNDS.twoAdmins; i += 1) {
      const f = makeBuyer();
      const rs = await Promise.all([psqlAsync(resolveSql(f)), psqlAsync(resolveSql(f)), psqlAsync(resolveSql(f))]);
      const oks = rs.filter((x) => x.ok && x.out.includes('"ok": true')).length;
      expect(oks).toBe(1);
      expect(rs.filter((x) => x.out.includes("already_handled")).length).toBe(2);
      expect(count(f, "refund")).toBe(1);
      expect(balance(f)).toBe(0);
      tally("twoAdmins", "exactly-once");
    }
  });

  // 위 무작위 경합은 실행 순서가 한쪽으로 쏠릴 수 있다(실측: 아래 outcomes). 그래서 잠금을 일부러 오래 쥐어
  // 두 방향의 교차를 결정적으로 만든다. 앞선 트랜잭션이 pg_sleep 동안 열려 있고, 뒤 트랜잭션이 그 사이에 시작된다.
  const delayed = (sql: string, ms: number) => new Promise<{ ok: boolean; out: string }>((res) => setTimeout(() => psqlAsync(sql).then(res), ms));

  it("결정적 교차 ① 예약 트랜잭션이 열려 있는 동안 수동 회수 시작 → 잠금 대기 후 재확인으로 중단(옛 구현이면 잔량만 회수됐을 상황)", async () => {
    for (let i = 0; i < 3; i += 1) {
      const f = makeBuyer();
      const [b, r] = await Promise.all([
        psqlAsync(`begin; ${bookSql(f, nextSlot())} select pg_sleep(2); commit;`),
        delayed(resolveSql(f), 700),
      ]);
      expect(b.ok).toBe(true);
      expect(r.ok).toBe(false); // 예약 때문에 중단
      expect(count(f, "hold")).toBe(1);
      expect(count(f, "refund")).toBe(0);
      expect(handled(f)).toBe(false);
      expect(balance(f)).toBe(19);
    }
  });

  it("결정적 교차 ② 수동 회수 트랜잭션이 열려 있는 동안 예약 시작 → 예약은 회수 후 잔량 0 으로 실패", async () => {
    for (let i = 0; i < 3; i += 1) {
      const f = makeBuyer();
      const [r, b] = await Promise.all([
        psqlAsync(`begin; ${resolveSql(f)} select pg_sleep(2); commit;`),
        delayed(bookSql(f, nextSlot()), 700),
      ]);
      expect(r.ok).toBe(true);
      expect(b.ok).toBe(false);
      expect(count(f, "hold")).toBe(0);
      expect(count(f, "refund")).toBe(1);
      expect(handled(f)).toBe(true);
    }
  });

  it("결정적 교차 ③ 소비 트랜잭션이 열려 있는 동안 수동 회수 시작 → 소비 확정 후 회수(소비 1건 유지)", async () => {
    for (let i = 0; i < 3; i += 1) {
      const f = makeBuyer();
      const rid = book(f);
      const [c, r] = await Promise.all([
        psqlAsync(`begin; select consume_entitlement('${rid}'); select pg_sleep(2); commit;`),
        delayed(resolveSql(f), 700),
      ]);
      expect(c.ok).toBe(true);
      expect(r.ok).toBe(true);
      expect(count(f, "consume")).toBe(1);
      expect(count(f, "refund")).toBe(1);
      expect(balance(f)).toBe(0);
      expect(handled(f)).toBe(true);
    }
  });

  it("실패(예약 있음) 후 예약 취소하고 재시도하면 한 번만 회수되고 완료로 표시된다", () => {
    const f = makeBuyer();
    const rid = book(f);
    expect(() => psql(resolveSql(f))).toThrow();
    expect(count(f, "refund")).toBe(0);
    expect(handled(f)).toBe(false);
    psql(`select cancel_lesson_booking('${rid}', 'teacher', '${teacher}', 'rvk retry');`);
    expect(psql(resolveSql(f))).toContain('"ok": true');
    expect(count(f, "refund")).toBe(1);
    expect(handled(f)).toBe(true);
    expect(psql(resolveSql(f))).toContain("already_handled");
    expect(count(f, "refund")).toBe(1);
  });

  it("수업 시간이 지났지만 소비·해제되지 않은 hold 도 회수를 막는다(예약 유지 + 잔량만 회수 금지)", () => {
    const f = makeBuyer();
    const rid = book(f);
    psql(`update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days' where id = '${rid}';`);
    expect(() => psql(resolveSql(f))).toThrow();
    expect(count(f, "refund")).toBe(0);
    expect(balance(f)).toBe(19);
  });
});

describe("남은 수업 경로: 24시간 이내 학생 취소 · 실제 수업 완료(finalize)", () => {
  // 제품에는 테스트 시계가 없다. 저장소 기존 테스트(session-final-judgment)와 같이 예약은 정당한 경로(confirm_lesson_booking,
  // 24시간 이상 후 슬롯)로 만들고, 예약 행의 시각만 이동한 뒤 제품 RPC(cancel_lesson_booking / mark_lesson_session_started /
  // finalize_lesson_session)를 그대로 호출한다 — RPC 의 시간·권한 검사는 우회하지 않는다.
  const sessionOf = (rid: string) => psql(`select id from sessions where reservation_id='${rid}';`);

  it("24시간 미만 학생 취소(consume 분기) 후에는 자동 회수하지 않고, 수동 회수는 소비분 제외 잔량만 처리한다", () => {
    const f = makeBuyer();
    const rid = book(f);
    const near = new Date(Date.now() + 10 * 3600_000).toISOString();
    const nearEnd = new Date(Date.now() + 11 * 3600_000).toISOString();
    psql(`update reservations set starts_at='${near}', ends_at='${nearEnd}' where id='${rid}';`);
    psql(`select cancel_lesson_booking('${rid}', 'student', '${f.childId}', '24시간 미만 취소');`);
    expect(count(f, "consume")).toBe(1);
    expect(revoke(f)).toMatchObject({ revoked: false, reason: "partially_used_or_reserved" });
    expect(psql(resolveSql(f))).toContain('"ok": true');
    expect(balance(f)).toBe(0);
    expect(count(f, "consume")).toBe(1);
  });

  it("실제 수업 완료(finalize_lesson_session completed → consume) 후에는 자동 회수하지 않는다", () => {
    const f = makeBuyer();
    const rid = book(f);
    const sid = sessionOf(rid);
    psql(`select mark_lesson_session_started('${sid}', '${teacher}');`);
    psql(`update reservations set starts_at = starts_at - interval '365 days', ends_at = ends_at - interval '365 days' where id = '${rid}';`);
    psql(`select finalize_lesson_session('${sid}', 'completed', '${teacher}', '정상 완료');`);
    expect(count(f, "consume")).toBe(1);
    expect(revoke(f)).toMatchObject({ revoked: false, reason: "partially_used_or_reserved" });
    expect(count(f, "refund")).toBe(0);
  });
});

afterAll(() => {
  // 경합 결과 분포 기록(선택): REFUND_TEST_OUTCOME_FILE 이 지정되면 거기에 JSON 으로 남긴다.
  const file = process.env.REFUND_TEST_OUTCOME_FILE;
  if (file) writeFileSync(file, JSON.stringify({ rounds: ROUNDS, outcomes: outcomeLog }));
});
