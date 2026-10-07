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
  sent: ["receipt_confirmed", "returned", "failed", "needs_review"],
  receipt_confirmed: ["returned"],
  failed: [],
  returned: [],
  cancelled: [],
  needs_review: ["queued", "cancelled", "sent", "failed"],
};

export function canTransition(from: AttemptStatus, to: AttemptStatus): boolean {
  return ATTEMPT_TRANSITIONS[from].includes(to);
}

/** "sent"는 지급 완료가 아니다 — 수취 확인(receipt_confirmed)만 완료로 센다. */
export function isPayoutCompleted(status: AttemptStatus): boolean {
  return status === "receipt_confirmed";
}
export const ATTEMPT_STATUS_LABEL_EN: Readonly<Record<AttemptStatus, string>> = {
  queued: "Approved, not yet requested",
  awaiting_mercury_approval: "Awaiting Mercury approval",
  processing: "Processing",
  sent: "Sent (receipt not confirmed)",
  receipt_confirmed: "Receipt confirmed",
  failed: "Failed",
  returned: "Returned",
  cancelled: "Cancelled",
  needs_review: "Needs review",
};
