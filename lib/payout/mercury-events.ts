// Mercury 거래 이벤트(웹훅/조회) → 시도 상태 반영(2026-10-07). sent = 지급 완료다(수취 확인 단계 폐지, 2026-10-07). 반환(reversed)만 별도 기록한다.
import type { AttemptStatus } from "./attempt-state";
import type { ProviderTransaction } from "./providers/types";

export type EventStore = {
  findByTransactionId(txId: string): Promise<{ id: string; status: AttemptStatus; requested_currency: "USD" | "KRW" } | null>;
  findByRequestId(requestId: string): Promise<{ id: string; status: AttemptStatus; requested_currency: "USD" | "KRW" } | null>;
  linkTransaction(attemptId: string, txId: string): Promise<void>;
  applyTransition(attemptId: string, to: AttemptStatus, reason?: string): Promise<void>;
  recordActuals(attemptId: string, usdPrincipalMinor: number, usdFeeMinor: number, finalRate: number | null): Promise<void>;
  recordReturn(attemptId: string, returnTxId: string, returnedUsdMinor: number | null, reason: string): Promise<void>;
  recordDetails?(attemptId: string, d: { dashboardUrl: string | null; estimatedDeliveryDate: string | null; failedAt: string | null }): Promise<void>;
};

export type EventOutcome = "ignored_unknown" | "applied" | "noop";

/** 거래 상태 → 시도 상태. pending=processing, sent=sent, failed/cancelled/blocked=failed. reversed는 반환으로 따로 기록한다. */
export function attemptStatusForMercury(status: ProviderTransaction["status"]): AttemptStatus | "returned" {
  switch (status) {
    case "pending":
      return "processing";
    case "sent":
      return "sent";
    case "reversed":
      return "returned";
    default:
      return "failed";
  }
}

export async function applyMercuryTransaction(store: EventStore, tx: ProviderTransaction, relatedReturnTxId?: string): Promise<EventOutcome> {
  const attempt = (await store.findByTransactionId(tx.transactionId)) ?? (tx.requestId ? await store.findByRequestId(tx.requestId) : null);
  if (!attempt) return "ignored_unknown";
  await store.linkTransaction(attempt.id, tx.transactionId);
  if (store.recordDetails && (tx.dashboardUrl || tx.estimatedDeliveryDate || tx.failedAt)) {
    await store.recordDetails(attempt.id, { dashboardUrl: tx.dashboardUrl ?? null, estimatedDeliveryDate: tx.estimatedDeliveryDate ?? null, failedAt: tx.failedAt ?? null });
  }
  const target = attemptStatusForMercury(tx.status);

  if (target === "returned") {
    await store.recordReturn(attempt.id, relatedReturnTxId ?? tx.transactionId, tx.amountMinorUsd ?? null, "Reversed by Mercury");
    return "applied";
  }
  if (tx.amountMinorUsd != null && attempt.requested_currency === "USD") {
    await store.recordActuals(attempt.id, tx.amountMinorUsd, tx.feeMinorUsd ?? 0, tx.fxRate ?? null);
  }
  if (attempt.status === target) return "noop";
  // processing 이전 단계를 건너뛴 이벤트(sent가 먼저 도착)는 단계를 채워서 전이한다.
  if (target === "sent" && attempt.status === "awaiting_mercury_approval") await store.applyTransition(attempt.id, "processing");
  await store.applyTransition(attempt.id, target, tx.failureReason ?? undefined);
  return "applied";
}
