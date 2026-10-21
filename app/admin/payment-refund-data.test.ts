import { describe, expect, it } from "vitest";
import { loadPaymentRefundBoard } from "./payment-refund-data";

// 테이블별 고정 결과를 돌려주는 최소 supabase 모의 객체. is/not(handled_at·resolved_at null 필터), order, limit, count 를 흉내 낸다.
function fakeClient(tables: Record<string, Record<string, unknown>[]>) {
  const chain = (all: Record<string, unknown>[], opts?: { count?: string }) => {
    let rows = all; let lim = Infinity; let asc: string | null = null; let desc: string | null = null;
    const c: Record<string, unknown> = {};
    c.select = () => c;
    c.is = (col: string) => { rows = rows.filter((r) => r[col] == null); return c; };
    c.not = (col: string) => { rows = rows.filter((r) => r[col] != null); return c; };
    c.order = (col: string, o: { ascending: boolean }) => { if (o.ascending) asc = col; else desc = col; return c; };
    c.limit = (n: number) => { lim = n; return c; };
    c.in = () => c;
    c.then = (resolve: (v: unknown) => unknown) => {
      let out = [...rows];
      const k = asc ?? desc;
      if (k) out.sort((x, y) => (String(x[k]) < String(y[k]) ? -1 : 1) * (asc ? 1 : -1));
      return resolve({ data: out.slice(0, lim), count: rows.length, error: null });
    };
    void opts;
    return c;
  };
  return { from: (t: string) => chain(tables[t] ?? []) } as never;
}

describe("loadPaymentRefundBoard", () => {
  it("구매별 수업권 현황(지급·잔여·소비·예약 점유·회수)을 ledger 에서 계산한다", async () => {
    const board = await loadPaymentRefundBoard(
      fakeClient({
        payment_refunds: [
          { id: "r1", purchase_id: "p1", stripe_refund_id: "re_1", amount_minor: 100, currency: "USD", status: "succeeded", needs_review: true, auto_revoke_status: null, handled_by: null, handled_at: null, handled_action: null, handled_note: null, created_at: "2026-10-01" },
          { id: "r2", purchase_id: null, stripe_refund_id: "re_2", amount_minor: 50, currency: "USD", status: "pending", needs_review: true, auto_revoke_status: null, handled_by: null, handled_at: null, handled_action: null, handled_note: null, created_at: "2026-10-02" },
        ],
        purchases: [{ id: "p1", total_minor: 100, currency: "USD", status: "succeeded" }],
        entitlement_grants: [{ id: "g1", purchase_id_ref: "p1", original_quantity: 20 }],
        entitlement_ledger: [
          { grant_id: "g1", event_type: "grant", amount: 20 },
          { grant_id: "g1", event_type: "hold", amount: -1 },
          { grant_id: "g1", event_type: "hold", amount: -1 },
          { grant_id: "g1", event_type: "consume", amount: 0 },
        ],
        payment_webhook_issues: [],
      })
    );
    expect(board.refunds[0].entitlement).toEqual({ granted: 20, balance: 18, consumed: 1, activeHolds: 1, refunded: 0 });
    expect(board.refunds[0].purchase).toEqual({ totalMinor: 100, currency: "USD", status: "succeeded" });
    expect(board.refunds[1].purchase).toBeNull();
    expect(board.refunds[1].entitlement).toBeNull();
  });

  it("웹훅 이상 대장을 함께 돌려준다", async () => {
    const board = await loadPaymentRefundBoard(
      fakeClient({
        payment_refunds: [],
        payment_webhook_issues: [{ id: "i1", event_id: "evt", kind: "amount_mismatch", purchase_id: "p", detail: { a: 1 }, created_at: "2026-10-01", resolved_at: null, resolved_note: null }],
      })
    );
    expect(board.issues).toEqual([
      { id: "i1", eventId: "evt", kind: "amount_mismatch", purchaseId: "p", detail: { a: 1 }, createdAt: "2026-10-01", resolvedAt: null, resolvedNote: null },
    ]);
  });

  it("오래된 미해결 건은 처리 완료 100건 이상이 쌓여도 항상 포함되고, 건수가 표시된다", async () => {
    const done = Array.from({ length: 150 }, (_, i) => ({ id: `d${i}`, purchase_id: null, stripe_refund_id: `re_d${i}`, amount_minor: 1, currency: "USD", status: "succeeded", needs_review: false, auto_revoke_status: null, handled_by: "a", handled_at: `2026-10-${String(10 + (i % 10)).padStart(2, "0")}`, handled_action: "dismiss", handled_note: "ok", created_at: `2026-09-${String(1 + (i % 28)).padStart(2, "0")}` }));
    const old = { id: "old", purchase_id: null, stripe_refund_id: "re_old", amount_minor: 9, currency: "USD", status: "succeeded", needs_review: true, auto_revoke_status: null, handled_by: null, handled_at: null, handled_action: null, handled_note: null, created_at: "2025-01-01" };
    const openIssue = { id: "oi", event_id: "e", kind: "amount_mismatch", purchase_id: null, detail: {}, created_at: "2025-01-02", resolved_at: null, resolved_note: null };
    const doneIssues = Array.from({ length: 120 }, (_, i) => ({ id: `di${i}`, event_id: "e", kind: "k", purchase_id: null, detail: {}, created_at: "2026-10-01", resolved_at: `2026-10-02T${String(i % 24).padStart(2, "0")}`, resolved_note: "n" }));
    const board = await loadPaymentRefundBoard(fakeClient({ payment_refunds: [...done, old], payment_webhook_issues: [openIssue, ...doneIssues] }));
    expect(board.refunds.some((r) => r.id === "old")).toBe(true);
    expect(board.refunds[0].id).toBe("old"); // 미해결이 먼저
    expect(board.counts).toMatchObject({ refundsTotal: 151, refundsPending: 1, refundsShown: 101, issuesTotal: 121, issuesOpen: 1, issuesShown: 101 });
    expect(board.issues[0].id).toBe("oi");
  });
});
