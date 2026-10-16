// 지급 시도 오케스트레이션(2026-10-07): DB 전이 함수 + 제공자 호출. 스위치가 닫히면 아무 외부 호출도 하지 않는다.
//
// 이중 송금 방지 순서: (1) DB가 idempotency_key를 먼저 갖고 있다 (2) 이미 요청 ID가 있으면 호출하지 않는다
// (3) 응답 유실 표시(request_uncertain)가 있으면 재시도 전에 조회한다 (4) 호출 결과를 DB에 기록한다.
import { attemptMemo, ProviderDisabledError, ProviderUncertainError, ProviderUnsupportedError, type PayoutProvider } from "./providers/types";
import type { AttemptStatus } from "./attempt-state";

export type AttemptRow = {
  id: string;
  status: AttemptStatus;
  provider: "wise" | "mercury" | "manual";
  manual_execution: boolean;
  requested_amount_minor: number;
  requested_currency: "USD" | "KRW";
  idempotency_key: string;
  payout_request_id: string | null;
  provider_transaction_id: string | null;
  request_uncertain: boolean;
  recipient_provider_id: string | null;
};

export interface AttemptStore {
  getAttempt(id: string): Promise<AttemptRow | null>;
  isGateOpen(): Promise<boolean>;
  transition(id: string, to: AttemptStatus, actor: string | null, reason?: string): Promise<void>;
  recordRequest(id: string, requestId: string | null, actor: string | null, uncertain: boolean): Promise<void>;
}

export type RequestOutcome =
  | { kind: "already_requested"; requestId: string }
  | { kind: "requested"; requestId: string }
  | { kind: "recovered_existing"; requestId: string }
  | { kind: "uncertain" }
  | { kind: "manual_required"; reason: string }
  | { kind: "blocked"; reason: string };

export async function requestAttemptPayout(
  store: AttemptStore,
  provider: PayoutProvider,
  attemptId: string,
  actor: string | null
): Promise<RequestOutcome> {
  const a = await store.getAttempt(attemptId);
  if (!a) throw new Error("Payout attempt not found");

  if (a.manual_execution || a.provider === "manual") {
    return { kind: "manual_required", reason: a.requested_currency === "KRW" ? "KRW wires are created in the Mercury dashboard (no API support for KRW amounts)" : "Manual attempt" };
  }
  if (a.requested_currency !== "USD") {
    return { kind: "manual_required", reason: "Only USD can be requested through the Mercury API" };
  }
  if (a.payout_request_id) return { kind: "already_requested", requestId: a.payout_request_id };
  if (!(await store.isGateOpen())) return { kind: "blocked", reason: "Disbursement gate is closed" };
  if (!a.recipient_provider_id) return { kind: "blocked", reason: "Recipient is not linked to the provider" };

  // 응답 유실 뒤 재시도: 먼저 조회한다.
  if (a.request_uncertain) {
    try {
      const existing = await provider.findExistingRequest({ attemptId: a.id, recipientProviderId: a.recipient_provider_id, amountMinor: a.requested_amount_minor });
      if (existing) {
        await store.recordRequest(a.id, existing.requestId, actor, false);
        return { kind: "recovered_existing", requestId: existing.requestId };
      }
    } catch (e) {
      if (e instanceof ProviderDisabledError) return { kind: "blocked", reason: e.message };
      return { kind: "uncertain" }; // 조회도 실패 — 새 요청을 만들지 않는다.
    }
  }

  // 상태를 먼저 awaiting으로 옮긴다(DB가 승인·수취인 검증·게이트를 확인). 이미 그 상태면 무동작.
  if (a.status === "queued") await store.transition(a.id, "awaiting_mercury_approval", actor);

  try {
    const result = await provider.requestPayout({
      attemptId: a.id,
      idempotencyKey: a.idempotency_key,
      recipientProviderId: a.recipient_provider_id,
      amountMinor: a.requested_amount_minor,
      currency: a.requested_currency,
      memo: attemptMemo(a.id),
    });
    await store.recordRequest(a.id, result.requestId, actor, false);
    return { kind: "requested", requestId: result.requestId };
  } catch (e) {
    if (e instanceof ProviderUncertainError) {
      await store.recordRequest(a.id, null, actor, true);
      return { kind: "uncertain" };
    }
    if (e instanceof ProviderDisabledError) return { kind: "blocked", reason: e.message };
    if (e instanceof ProviderUnsupportedError) return { kind: "manual_required", reason: e.message };
    throw e;
  }
}
