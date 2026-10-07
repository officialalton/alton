// 지급 제공자 추상화(2026-10-07). 실제 외부 호출은 mercury.ts만 하고, 스위치가 닫혀 있으면 호출하지 않는다.
export type ProviderName = "wise" | "mercury" | "manual";

export type PayoutRequestInput = {
  attemptId: string;
  idempotencyKey: string;
  recipientProviderId: string;
  amountMinor: number;
  currency: "USD" | "KRW";
  memo: string;
};
export type PayoutRequestResult = { requestId: string; status: "pending_approval" | "approved" | "rejected" | "cancelled" };

export type ProviderTransaction = {
  transactionId: string;
  status: "pending" | "sent" | "cancelled" | "failed" | "reversed" | "blocked";
  requestId?: string | null;
  amountMinorUsd?: number | null;
  feeMinorUsd?: number | null;
  fxRate?: number | null;
  trackingUrl?: string | null;
  failureReason?: string | null;
};

export interface PayoutProvider {
  readonly name: ProviderName;
  requestPayout(input: PayoutRequestInput): Promise<PayoutRequestResult>;
  /** 응답 유실 뒤 재시도 전에 호출: 같은 시도(attemptId)의 요청이 이미 있는지 조회. */
  findExistingRequest(ref: { attemptId: string; recipientProviderId: string; amountMinor: number }): Promise<PayoutRequestResult | null>;
  getTransaction(transactionId: string): Promise<ProviderTransaction | null>;
}

export class ProviderDisabledError extends Error {
  constructor(message = "Payout provider is disabled (switch closed)") {
    super(message);
    this.name = "ProviderDisabledError";
  }
}
/** 응답을 받지 못했다 — 요청이 접수됐는지 알 수 없다. 재시도 전에 findExistingRequest를 호출해야 한다. */
export class ProviderUncertainError extends Error {
  constructor(message = "Provider response lost; request may or may not exist") {
    super(message);
    this.name = "ProviderUncertainError";
  }
}
export class ProviderRejectedError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ProviderRejectedError";
  }
}
export class ProviderUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderUnsupportedError";
  }
}
export const ATTEMPT_MEMO_PREFIX = "ALTON:";
export const attemptMemo = (attemptId: string) => `${ATTEMPT_MEMO_PREFIX}${attemptId}`;
