import type { SupabaseClient } from "@supabase/supabase-js";

// Stripe 환불 기록·웹훅 이상 대장 — 관리자 처리 화면용 읽기 전용 로더.
// 원본 테이블: payment_refunds, payment_webhook_issues(20261030100000), 처리 컬럼(20261031100000).
export type PaymentRefundBoardItem = {
  id: string;
  purchaseId: string | null;
  stripeRefundId: string;
  amountMinor: number;
  currency: string;
  status: string | null;
  needsReview: boolean;
  autoRevokeStatus: string | null;
  handledBy: string | null;
  handledAt: string | null;
  handledAction: string | null;
  handledNote: string | null;
  createdAt: string;
  purchase: { totalMinor: number; currency: string; status: string } | null;
  /** 그 구매가 지급한 수업권 현황(ledger 합산). 구매 미연결·지급 이력 없음이면 null. */
  entitlement: { granted: number; balance: number; consumed: number; activeHolds: number; refunded: number } | null;
};

export type PaymentWebhookIssueItem = {
  id: string;
  eventId: string;
  kind: string;
  purchaseId: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
  resolvedAt: string | null;
  resolvedNote: string | null;
};

type Stat = { granted: number; balance: number; consumed: number; holds: number; released: number; refunded: number };

export async function loadPaymentRefundBoard(
  supabase: SupabaseClient
): Promise<{ refunds: PaymentRefundBoardItem[]; issues: PaymentWebhookIssueItem[] }> {
  const { data: refundRows, error: refundError } = await supabase
    .from("payment_refunds")
    .select(
      "id, purchase_id, stripe_refund_id, amount_minor, currency, status, needs_review, auto_revoke_status, handled_by, handled_at, handled_action, handled_note, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (refundError) throw new Error(refundError.message);
  const refunds = refundRows ?? [];

  const purchaseIds = [...new Set(refunds.map((r) => r.purchase_id).filter((v): v is string => Boolean(v)))];
  const purchaseById = new Map<string, { totalMinor: number; currency: string; status: string }>();
  const stats = new Map<string, Stat>();

  if (purchaseIds.length > 0) {
    const { data: purchases, error: pError } = await supabase
      .from("purchases")
      .select("id, total_minor, currency, status")
      .in("id", purchaseIds);
    if (pError) throw new Error(pError.message);
    for (const p of purchases ?? []) {
      purchaseById.set(p.id, { totalMinor: Number(p.total_minor), currency: p.currency, status: p.status });
    }

    const { data: grants, error: gError } = await supabase
      .from("entitlement_grants")
      .select("id, purchase_id_ref, original_quantity")
      .in("purchase_id_ref", purchaseIds);
    if (gError) throw new Error(gError.message);
    const grantToPurchase = new Map<string, string>();
    for (const g of grants ?? []) {
      grantToPurchase.set(g.id, g.purchase_id_ref);
      const s = stats.get(g.purchase_id_ref) ?? { granted: 0, balance: 0, consumed: 0, holds: 0, released: 0, refunded: 0 };
      s.granted += g.original_quantity;
      stats.set(g.purchase_id_ref, s);
    }
    if (grantToPurchase.size > 0) {
      const { data: ledger, error: lError } = await supabase
        .from("entitlement_ledger")
        .select("grant_id, event_type, amount")
        .in("grant_id", [...grantToPurchase.keys()]);
      if (lError) throw new Error(lError.message);
      for (const row of ledger ?? []) {
        const s = stats.get(grantToPurchase.get(row.grant_id)!)!;
        s.balance += row.amount;
        if (row.event_type === "consume") s.consumed += 1;
        if (row.event_type === "hold") s.holds += 1;
        if (row.event_type === "release") s.released += 1;
        if (row.event_type === "refund") s.refunded += -row.amount;
      }
    }
  }

  const { data: issueRows, error: iError } = await supabase
    .from("payment_webhook_issues")
    .select("id, event_id, kind, purchase_id, detail, created_at, resolved_at, resolved_note")
    .order("created_at", { ascending: false })
    .limit(100);
  if (iError) throw new Error(iError.message);

  return {
    refunds: refunds.map((r) => {
      const s = r.purchase_id ? stats.get(r.purchase_id) : undefined;
      return {
        id: r.id,
        purchaseId: r.purchase_id,
        stripeRefundId: r.stripe_refund_id,
        amountMinor: Number(r.amount_minor),
        currency: r.currency,
        status: r.status,
        needsReview: r.needs_review,
        autoRevokeStatus: r.auto_revoke_status,
        handledBy: r.handled_by,
        handledAt: r.handled_at,
        handledAction: r.handled_action,
        handledNote: r.handled_note,
        createdAt: r.created_at,
        purchase: r.purchase_id ? (purchaseById.get(r.purchase_id) ?? null) : null,
        entitlement: s
          ? {
              granted: s.granted,
              balance: s.balance,
              consumed: s.consumed,
              // 소비·해제되지 않고 남아 있는 예약 점유 수
              activeHolds: Math.max(0, s.holds - s.released - s.consumed),
              refunded: s.refunded,
            }
          : null,
      };
    }),
    issues: (issueRows ?? []).map((i) => ({
      id: i.id,
      eventId: i.event_id,
      kind: i.kind,
      purchaseId: i.purchase_id,
      detail: (i.detail ?? {}) as Record<string, unknown>,
      createdAt: i.created_at,
      resolvedAt: i.resolved_at,
      resolvedNote: i.resolved_note,
    })),
  };
}
