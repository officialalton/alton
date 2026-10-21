import { describe, expect, it } from "vitest";
import { loadPaymentRefundBoard } from "./payment-refund-data";

// 테이블별 고정 결과를 돌려주는 최소 supabase 모의 객체(체인: select → order/limit/in → await).
function fakeClient(tables: Record<string, unknown[]>) {
  const chain = (rows: unknown[]) => {
    const c: Record<string, unknown> = {};
    c.select = () => c;
    c.order = () => c;
    c.limit = () => c;
    c.in = () => c;
    c.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null });
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
});
