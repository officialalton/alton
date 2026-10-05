// 제품 분석 P0(2026-09-25, docs/2026-09-25-product-analytics-prd.md) — 이벤트 명세.
// 이 파일이 허용 속성의 단일 진실 소스다. 여기 없는 속성은 track()이 조용히
// 버린다(화이트리스트 — 실수로 넣은 새 필드가 기본적으로 새어나가지 않는다).

export type Surface = "landing" | "consultation" | "free_member";

export type LandingCtaClickedProps = {
  cta_name: string;
  section?: string;
};

export type ConsultationStartedProps = {
  entry_point?: string;
};

export type ConsultationSubmittedProps = {
  entry_point?: string;
  consultation_type?: string;
};

// 2026-10-05 무료 회원 S4(브리프 §5.3) — 전환 퍼널 보조 이벤트. 속성은 비식별 값(entry_point/outcome)만.
// 권위 있는 퍼널은 DB 집계(student_consult_interests → guardian_link_invites → consultations)다.
export type FreeMemberFunnelProps = {
  entry_point?: string;
};
export type GuardianInviteAcceptedProps = {
  outcome?: string; // accepted | manual_review
};

export type EventPropsMap = {
  landing_cta_clicked: LandingCtaClickedProps;
  consultation_started: ConsultationStartedProps;
  consultation_submitted: ConsultationSubmittedProps;
  consult_interest_registered: FreeMemberFunnelProps;
  guardian_invite_sent: FreeMemberFunnelProps;
  guardian_invite_accepted: GuardianInviteAcceptedProps;
  consult_booked: FreeMemberFunnelProps;
};

export type EventName = keyof EventPropsMap;

export const EVENT_SURFACE: Record<EventName, Surface> = {
  landing_cta_clicked: "landing",
  consultation_started: "consultation",
  consultation_submitted: "consultation",
  consult_interest_registered: "free_member",
  guardian_invite_sent: "free_member",
  guardian_invite_accepted: "free_member",
  consult_booked: "free_member",
};

/** 이벤트별 허용 추가 속성(공통 속성 surface/page_path/locale/referrer_domain은 track()이 자동으로 붙인다). */
export const ALLOWED_EVENT_PROPS: { [K in EventName]: readonly (keyof EventPropsMap[K])[] } = {
  landing_cta_clicked: ["cta_name", "section"],
  consultation_started: ["entry_point"],
  consultation_submitted: ["entry_point", "consultation_type"],
  consult_interest_registered: ["entry_point"],
  guardian_invite_sent: ["entry_point"],
  guardian_invite_accepted: ["outcome"],
  consult_booked: ["entry_point"],
};
