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

/** 미해결(처리 대기·확인 필요)은 오래돼도 전부(상한 PENDING_LIMIT) 먼저, 처리 완료는 최근 DONE_LIMIT건만 읽는다. */
export const DONE_LIMIT = 100;
export const PENDING_LIMIT = 1000;

export type BoardCounts = {
  refundsTotal: number;
  refundsPending: number;
  /** 서버에 있는 처리 완료 전체 건수(표시는 최근 DONE_LIMIT건 + 더 보기로 이어서) */
  refundsDone: number;
  /** 지금 불러온 처리 대기 건수 — refundsPending 보다 작으면 일부만 표시 중(PENDING_LIMIT 초과) */
  refundsPendingShown: number;
  refundsShown: number;
  issuesTotal: number;
  issuesOpen: number;
  issuesShown: number;
};

const REFUND_COLS =
  "id, purchase_id, stripe_refund_id, amount_minor, currency, status, needs_review, auto_revoke_status, handled_by, handled_at, handled_action, handled_note, created_at";
const ISSUE_COLS = "id, event_id, kind, purchase_id, detail, created_at, resolved_at, resolved_note";


/** 다음 페이지 조회용 키셋 커서. at 은 DB 가 돌려준 timestamptz 문자열 그대로(밀리초 반올림 없이). */
export type RefundCursor = { at: string; id: string };
export const PAGE_SIZE = 200;
const CURSOR_AT = /^[0-9TZ:.+\- ]{10,40}$/;
const CURSOR_ID = /^[0-9a-fA-F-]{36}$/;
export const isValidCursor = (c: unknown): c is RefundCursor =>
  !!c && typeof c === "object" && CURSOR_AT.test(String((c as RefundCursor).at)) && CURSOR_ID.test(String((c as RefundCursor).id));

async function enrichRefunds(supabase: SupabaseClient, refunds: Record<string, any>[]): Promise<PaymentRefundBoardItem[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
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

  return refunds.map((r) => {
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
    });
}

export async function loadPaymentRefundBoard(
  supabase: SupabaseClient
): Promise<{ refunds: PaymentRefundBoardItem[]; issues: PaymentWebhookIssueItem[]; counts: BoardCounts }> {
  const [pendingR, doneR, totalR, pendingCountR, doneCountR] = await Promise.all([
    supabase.from("payment_refunds").select(REFUND_COLS).is("handled_at", null).order("created_at", { ascending: true }).order("id", { ascending: true }).limit(PENDING_LIMIT),
    supabase.from("payment_refunds").select(REFUND_COLS).not("handled_at", "is", null).order("handled_at", { ascending: false }).order("id", { ascending: false }).limit(DONE_LIMIT),
    supabase.from("payment_refunds").select("id", { count: "exact", head: true }),
    supabase.from("payment_refunds").select("id", { count: "exact", head: true }).is("handled_at", null),
    supabase.from("payment_refunds").select("id", { count: "exact", head: true }).not("handled_at", "is", null),
  ]);
  for (const r of [pendingR, doneR, totalR, pendingCountR, doneCountR]) if (r.error) throw new Error(r.error.message);
  const refunds = await enrichRefunds(supabase, [...(pendingR.data ?? []), ...(doneR.data ?? [])]);

  const [openI, doneI, totalI, openCountI] = await Promise.all([
    supabase.from("payment_webhook_issues").select(ISSUE_COLS).is("resolved_at", null).order("created_at", { ascending: true }).limit(PENDING_LIMIT),
    supabase.from("payment_webhook_issues").select(ISSUE_COLS).not("resolved_at", "is", null).order("resolved_at", { ascending: false }).limit(DONE_LIMIT),
    supabase.from("payment_webhook_issues").select("id", { count: "exact", head: true }),
    supabase.from("payment_webhook_issues").select("id", { count: "exact", head: true }).is("resolved_at", null),
  ]);
  for (const r of [openI, doneI, totalI, openCountI]) if (r.error) throw new Error(r.error.message);
  const issueRows = [...(openI.data ?? []), ...(doneI.data ?? [])];

  return {
    counts: {
      refundsTotal: totalR.count ?? refunds.length,
      refundsPending: pendingCountR.count ?? (pendingR.data ?? []).length,
      refundsDone: doneCountR.count ?? (doneR.data ?? []).length,
      refundsPendingShown: (pendingR.data ?? []).length,
      refundsShown: refunds.length,
      issuesTotal: totalI.count ?? issueRows.length,
      issuesOpen: openCountI.count ?? (openI.data ?? []).length,
      issuesShown: issueRows.length,
    },
    refunds,
    issues: issueRows.map((i) => ({
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

/**
 * 대장의 다음 페이지(키셋). pending = 접수 오래된 순으로 cursor 뒤, done = 처리 최근 순으로 cursor 뒤(더 과거).
 * 처리 대기가 PENDING_LIMIT 을 넘어도, 처리 완료 이력이 DONE_LIMIT 을 넘어도 이 경로로 전부 접근할 수 있다.
 */
export async function loadPaymentRefundPage(
  supabase: SupabaseClient,
  params: { kind: "pending" | "done"; after?: RefundCursor | null }
): Promise<{ items: PaymentRefundBoardItem[]; next: RefundCursor | null }> {
  const pending = params.kind === "pending";
  const col = pending ? "created_at" : "handled_at";
  let q = supabase.from("payment_refunds").select(REFUND_COLS);
  q = pending ? q.is("handled_at", null) : q.not("handled_at", "is", null);
  if (params.after) {
    const { at, id } = params.after;
    const op = pending ? "gt" : "lt";
    q = q.or(`${col}.${op}."${at}",and(${col}.eq."${at}",id.${op}.${id})`);
  }
  const { data, error } = await q.order(col, { ascending: pending }).order("id", { ascending: pending }).limit(PAGE_SIZE + 1);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const page = rows.slice(0, PAGE_SIZE);
  const last = page[page.length - 1] as Record<string, string> | undefined;
  return { items: await enrichRefunds(supabase, page), next: rows.length > PAGE_SIZE && last ? { at: last[col], id: last.id } : null };
}
