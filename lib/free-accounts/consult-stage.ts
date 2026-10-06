// 상담 단계 key(DB _free_account_consult_stage) -> 영어 UI 라벨·색. 순수 매핑.
export const CONSULT_STAGES = [
  "none", "requested", "invitation_pending", "parent_linked", "booked", "booking_cancelled", "completed", "converted", "closed",
] as const;
export type ConsultStage = (typeof CONSULT_STAGES)[number];

export const CONSULT_STAGE_LABEL: Record<ConsultStage, string> = {
  none: "No consultation request",
  requested: "Consultation Requested",
  invitation_pending: "Parent Invitation Pending",
  parent_linked: "Parent Linked",
  booked: "Consultation Booked",
  booking_cancelled: "Consultation Cancelled / Unbooked",
  completed: "Consultation Completed",
  converted: "Converted to Tutoring",
  closed: "Consultation Closed",
};

export const ACCOUNT_STATUS_LABEL: Record<string, string> = {
  active: "Active",
  pending: "Pending",
  inactive: "Inactive",
  suspended: "Suspended",
  closure_pending: "Closure pending",
  closed: "Closed",
};

export function consultStageLabel(stage: string): string {
  return CONSULT_STAGE_LABEL[stage as ConsultStage] ?? stage;
}
