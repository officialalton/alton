// 지급 시도 상태 기계 — SQL payout_attempt_transition_allowed()와 같은 표(통합 테스트가 모든 쌍을 대조).
export const ATTEMPT_STATUSES = [
  "queued",
  "awaiting_mercury_approval",
  "processing",
  "sent",
  "receipt_confirmed",
  "failed",
  "returned",
  "cancelled",
  "needs_review",
] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export const ATTEMPT_TRANSITIONS: Readonly<Record<AttemptStatus, readonly AttemptStatus[]>> = {
  queued: ["awaiting_mercury_approval", "cancelled", "needs_review"],
  awaiting_mercury_approval: ["processing", "failed", "cancelled", "needs_review"],
  processing: ["sent", "failed", "needs_review"],
  sent: ["returned", "failed", "needs_review"],
  // legacy: 2026-10-07 오너 결정으로 수취 확인 단계가 폐지됐다. 과거 이력 행만 이 상태로 남고 새 전이는 없다(반환 기록만 가능).
  receipt_confirmed: ["returned"],
  failed: [],
  returned: [],
  cancelled: [],
  needs_review: ["queued", "cancelled", "sent", "failed"],
};

export function canTransition(from: AttemptStatus, to: AttemptStatus): boolean {
  return ATTEMPT_TRANSITIONS[from].includes(to);
}

/** Mercury 거래가 sent(completed)이면 지급 완료다(수취 확인 단계 폐지, 2026-10-07). 반환이 생기면 returned로 따로 기록한다. */
export function isPayoutCompleted(status: AttemptStatus): boolean {
  return status === "sent" || status === "receipt_confirmed";
}
export const ATTEMPT_STATUS_LABEL_EN: Readonly<Record<AttemptStatus, string>> = {
  queued: "Approved, not yet requested",
  awaiting_mercury_approval: "Awaiting Mercury approval",
  processing: "Processing",
  sent: "Sent (paid)",
  receipt_confirmed: "Paid (legacy receipt record)",
  failed: "Failed",
  returned: "Returned",
  cancelled: "Cancelled",
  needs_review: "Needs review",
};
