import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConsultationSchedulingPanel from "./ConsultationSchedulingPanel";
import * as consultActions from "./consultation-scheduling-actions";
import * as subscriptionActions from "./workspace-events-actions";

// M1/R6(2026-09-03, Sandbox v3 재검증 중 발견된 버그 2건에 대한 회귀 테스트) —
// 1) "상담 결과 기록" 버튼이 completionReadiness==='summary_missing'일 때도(즉 요약을
//    아직 안 썼을 때) 폼을 열 수 있어야 한다 — 예전엔 'ready'(=요약이 이미 있어야 함)
//    일 때만 열려서 순환 참조로 영원히 못 여는 버그였다.
// 2) Workspace Events 구독 상태 목록에 정지·삭제 버튼이 실제로 연결돼 있어야 한다.

vi.mock("./consultation-scheduling-actions", () => ({
  listConsultationsForAdmin: vi.fn(),
  listPendingConsultationRequests: vi.fn(),
  acceptConsultationRequest: vi.fn(),
  rejectConsultationRequest: vi.fn(),
  rescheduleConsultationRequest: vi.fn(),
  cancelConsultationRequest: vi.fn(),
  recordConsultationOutcome: vi.fn(),
  retryTrialEntitlementGrant: vi.fn(),
  retryFailedConsultationCalendarSyncs: vi.fn(),
  retryConsultationSmartNotesConfig: vi.fn(),
  reprocessUnlinkedConsultationSmartNotesEvents: vi.fn(),
  listConsultAvailabilityRules: vi.fn(),
  addConsultAvailabilityRule: vi.fn(),
  deactivateConsultAvailabilityRule: vi.fn(),
  listConsultAvailabilityExceptions: vi.fn(),
  addConsultAvailabilityException: vi.fn(),
  removeConsultAvailabilityException: vi.fn(),
}));

vi.mock("./workspace-events-actions", () => ({
  listWorkspaceEventsSubscriptions: vi.fn(),
  retryExpiringWorkspaceEventsSubscriptions: vi.fn(),
  runSmartNotesReconciliation: vi.fn(),
  disableWorkspaceEventsSubscriptionForOrganizer: vi.fn(),
}));

const BASE_CONSULTATION = {
  id: "consult-1",
  contact_name: "김민지",
  contact_email: "minji@example.com",
  contact_phone: null,
  student_grade: null,
  concerns: null,
  status: "scheduled",
  source: "homepage",
  starts_at: "2026-10-01T09:00:00.000Z",
  ends_at: "2026-10-01T10:00:00.000Z",
  scheduled_at: "2026-10-01T09:00:00.000Z",
  hold_expires_at: null,
  google_event_id: "evt-1",
  google_meet_link: "https://meet.google.com/abc-defg-hij",
  google_sync_status: "synced",
  google_sync_retry_count: 0,
  google_sync_last_error: null,
  smart_notes_config_status: "applied",
  smart_notes_config_error: null,
  smart_notes_drive_file_id: "drive-1",
  admin_review_summary: null,
  outcome: null,
  outcome_notes: null,
  prospect_contact_id: null,
  consent_version_id: "consent-1",
  consent_confirmed_at: "2026-09-30T00:00:00.000Z",
  child_id: null,
  trial_entitlement_grant_id: null,
  trial_entitlement_grant_status: "not_applicable" as const,
  trial_entitlement_grant_error: null,
  trial_entitlement_grant_expires_at: null,
  consultReadiness: "ready" as const,
  // 요약(admin_review_summary)이 아직 없어 completionReadiness가 'summary_missing' —
  // 이게 바로 예전 버그가 재현되던 조합이다.
  completionReadiness: "summary_missing" as const,
};

function mockBaseData() {
  vi.mocked(consultActions.listPendingConsultationRequests).mockResolvedValue([]);
  vi.mocked(consultActions.listConsultationsForAdmin).mockResolvedValue([BASE_CONSULTATION]);
  vi.mocked(consultActions.listConsultAvailabilityRules).mockResolvedValue([]);
  vi.mocked(consultActions.listConsultAvailabilityExceptions).mockResolvedValue([]);
  vi.mocked(subscriptionActions.listWorkspaceEventsSubscriptions).mockResolvedValue([
    { id: "sub-1", organizer_email: "official@alton.education", organizer_role: "consult_organizer", status: "active", expires_at: null, last_verified_at: null, last_renewed_at: null, last_error: null },
  ]);
}

describe("ConsultationSchedulingPanel — 상담 결과 기록 버튼 회귀(요약 미작성 상태에서도 폼이 열려야 함)", () => {
  it("completionReadiness가 'summary_missing'이어도 '상담 결과 기록' 버튼이 활성화되고 폼이 열린다", async () => {
    mockBaseData();
    render(<ConsultationSchedulingPanel />);

    const button = await screen.findByRole("button", { name: "상담 결과 기록" });
    expect(button).not.toBeDisabled();

    fireEvent.click(button);
    // 폼이 열렸는지는 "기록 저장" 제출 버튼의 존재로 확인한다(라벨 텍스트가 textarea와
    // 같은 <label> 안에서 텍스트 노드로 쪼개져 매칭이 불안정할 수 있어 더 안정적인
    // 쿼리를 쓴다).
    expect(await screen.findByRole("button", { name: "기록 저장" })).toBeInTheDocument();
  });

  it("아무 조건도 안 맞으면(예: Smart Notes 미연결) 버튼은 여전히 비활성화된다", async () => {
    vi.mocked(consultActions.listPendingConsultationRequests).mockResolvedValue([]);
    vi.mocked(consultActions.listConsultationsForAdmin).mockResolvedValue([
      { ...BASE_CONSULTATION, completionReadiness: "smart_notes_not_linked" },
    ]);
    vi.mocked(consultActions.listConsultAvailabilityRules).mockResolvedValue([]);
    vi.mocked(consultActions.listConsultAvailabilityExceptions).mockResolvedValue([]);
    vi.mocked(subscriptionActions.listWorkspaceEventsSubscriptions).mockResolvedValue([]);

    render(<ConsultationSchedulingPanel />);
    const button = await screen.findByRole("button", { name: "상담 결과 기록" });
    expect(button).toBeDisabled();
  });
});

describe("ConsultationSchedulingPanel — Workspace Events 구독 정지·삭제 버튼", () => {
  it("활성 구독에 정지·삭제 버튼이 있고, 사유 입력 후 제출하면 실제 액션을 호출한다", async () => {
    mockBaseData();
    vi.mocked(subscriptionActions.disableWorkspaceEventsSubscriptionForOrganizer).mockResolvedValue(undefined);
    render(<ConsultationSchedulingPanel />);

    const disableButton = await screen.findByRole("button", { name: "구독 정지·삭제" });
    fireEvent.click(disableButton);

    const input = screen.getByPlaceholderText("정지·삭제 사유");
    fireEvent.change(input, { target: { value: "테스트 정지" } });
    fireEvent.click(screen.getByRole("button", { name: "정지·삭제 확정" }));

    await waitFor(() =>
      expect(subscriptionActions.disableWorkspaceEventsSubscriptionForOrganizer).toHaveBeenCalledWith("official@alton.education", "테스트 정지")
    );
  });
});
