// M4 UAT #3.1/#5/#6 — 칸반/종료 유형 라벨 상수. 서버 액션 파일("use server")은
// 함수만 export 가능하므로, 클라이언트 컴포넌트에서도 바로 쓰는 상수·타입은
// 이 파일로 분리한다.

export type KanbanStage =
  | "requested" // 상담 신청
  | "scheduled" // 상담 일정 확정
  | "trial_requested" // 체험 신청
  | "trial_scheduled" // 체험 일정 확정
  | "contract_sent"; // 계약서 전달

export const KANBAN_STAGE_LABEL: Record<KanbanStage, string> = {
  requested: "상담 신청",
  scheduled: "상담 일정 확정",
  trial_requested: "체험 신청",
  trial_scheduled: "체험 일정 확정",
  contract_sent: "계약서 전달",
};

export const KANBAN_STAGE_ORDER: KanbanStage[] = [
  "requested",
  "scheduled",
  "trial_requested",
  "trial_scheduled",
  "contract_sent",
];

export type ConsultationClosureType = "no_trial" | "trial_no_convert" | "regular_in_progress" | "contract_signed";

export const CLOSURE_TYPE_LABEL: Record<ConsultationClosureType, string> = {
  no_trial: "체험 없이 종료",
  trial_no_convert: "체험 후 종료",
  regular_in_progress: "정규 진행 중 종료",
  contract_signed: "정규 계약 날인",
};
