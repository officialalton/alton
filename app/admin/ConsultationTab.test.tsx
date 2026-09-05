import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConsultationTab from "./ConsultationTab";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("./consultation-actions", () => ({
  createConsultation: vi.fn(),
  scheduleConsultation: vi.fn(),
  rescheduleConsultation: vi.fn(),
  completeConsultation: vi.fn(),
  cancelConsultation: vi.fn(),
  markConsultationNoShow: vi.fn(),
  findDuplicateConsultationCandidates: vi.fn(),
  createClassificationTag: vi.fn(),
  listClassificationTags: vi.fn().mockResolvedValue([]),
  tagConsultation: vi.fn(),
  untagConsultation: vi.fn(),
  createTrialSessionFromConsultation: vi.fn(),
  completeTrialSession: vi.fn(),
  approveTrialException: vi.fn(),
  cancelTrialSession: vi.fn(),
  markTrialNoShow: vi.fn(),
  createProposal: vi.fn(),
  sendProposal: vi.fn(),
  respondToProposal: vi.fn(),
  retryFailedDriveArtifacts: vi.fn(),
  reconcileDocusignStatus: vi.fn(),
  retryContractActivation: vi.fn(),
}));

vi.mock("./consultation-kanban-actions", () => ({
  listKanbanBoardAction: vi.fn().mockResolvedValue([
    {
      id: "c1",
      contact_name: "김민지",
      contact_email: "minji@example.com",
      contact_phone: null,
      student_grade: "10학년",
      status: "requested",
      stage: "requested",
    },
  ]),
  getConsultationCardDetailAction: vi.fn(),
  getClosureDraftAction: vi.fn(),
  closeConsultationAction: vi.fn(),
  listClosedConsultationsAction: vi.fn().mockResolvedValue({
    items: [],
    countsByType: { no_trial: 0, trial_no_convert: 0, regular_in_progress: 0, contract_signed: 0 },
  }),
  KANBAN_STAGE_ORDER: ["requested", "scheduled", "trial_requested", "trial_scheduled", "contract_sent"],
  KANBAN_STAGE_LABEL: {
    requested: "상담 신청",
    scheduled: "상담 일정 확정",
    trial_requested: "체험 신청",
    trial_scheduled: "체험 일정 확정",
    contract_sent: "계약",
  },
  CLOSURE_TYPE_LABEL: {
    no_trial: "체험 없이 종료",
    trial_no_convert: "체험 후 종료",
    regular_in_progress: "정규 진행 중 종료",
    contract_signed: "정규 계약 날인",
  },
}));

const baseProps = {
  consultations: [
    {
      id: "c1",
      contactName: "김민지",
      contactEmail: "minji@example.com",
      contactPhone: null,
      studentGrade: "10학년",
      category: "family",
      concerns: null,
      status: "requested",
      scheduledAt: null,
      completedAt: null,
      cancelledAt: null,
      noShowAt: null,
      cancellationReason: null,
      householdId: null,
      childId: null,
      duplicateOfConsultationId: null,
      createdAt: "2026-08-01T00:00:00Z",
      tagLabels: [],
    },
  ],
  trials: [],
  proposals: [],
  consentGaps: [
    { childId: "s1", childName: "지훈", hasDob: false, hasActiveConsent: false },
  ],
  completedConsents: [{ childId: "s2", childName: "이서아" }],
  driveIssues: [
    { id: "d1", contractId: "ct1", artifactType: "signed_document", syncStatus: "retryable_failed" as const },
  ],
  staleEnvelopes: [],
  contractActivationRetries: [],
  subjects: [],
  teacherCandidatesBySubject: {},
};

describe("ConsultationTab", () => {
  it("상담 현황 서브탭을 기본으로 보여준다(5단계 칸반 보드)", async () => {
    render(<ConsultationTab {...baseProps} />);
    expect(await screen.findByText("김민지", { exact: false })).toBeInTheDocument();
    expect(screen.getByTestId("consultation-kanban-board")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-column-requested")).toBeInTheDocument();
  });

  it("보호자 동의 대기 서브탭으로 전환하면 대기 목록이 기본으로 보이고, 완료 탭을 누르면 완료 목록을 보여준다(대기/완료 분리, 2026-09-05)", () => {
    render(<ConsultationTab {...baseProps} />);
    fireEvent.click(screen.getByText("보호자 동의 대기"));
    expect(screen.getByText("지훈")).toBeInTheDocument();
    expect(screen.queryByText("이서아")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("완료 (1)"));
    expect(screen.getByText("이서아")).toBeInTheDocument();
    expect(screen.queryByText("지훈")).not.toBeInTheDocument();
  });

  it("오류/재처리 현황판 서브탭에서 Drive 실패 항목을 원인별로 보여준다", () => {
    render(<ConsultationTab {...baseProps} />);
    fireEvent.click(screen.getByText("오류/재처리 현황판"));
    expect(screen.getByText("Drive 저장 실패 (재시도 가능)")).toBeInTheDocument();
    expect(screen.getByText("보호자 동의 차단 (재시도 불가 — 가족 조치 필요)")).toBeInTheDocument();
  });

  describe("계약 활성화 재처리 대기 — R3 후속(2026-09-01)", () => {
    const activationRetryProps = {
      ...baseProps,
      contractActivationRetries: [
        {
          id: "retry1",
          contractId: "ct1",
          contractVersionId: "cv1",
          envelopeId: "env-1",
          failureReason: "보호자 동의 없음",
          createdAt: "2026-09-01T00:00:00Z",
          childId: "child1",
          childName: "이서준",
        },
      ],
    };

    it("활성화 재처리 대기 항목을 학생 이름·사유와 함께 보여준다", async () => {
      render(<ConsultationTab {...activationRetryProps} />);
      fireEvent.click(screen.getByText("오류/재처리 현황판"));

      expect(screen.getByText("계약 활성화 재처리 대기 (재시도 가능)")).toBeInTheDocument();
      expect(screen.getByText("이서준", { exact: false })).toBeInTheDocument();
      expect(screen.getByText("보호자 동의 없음", { exact: false })).toBeInTheDocument();
    });

    it("활성화 재시도가 성공하면 목록에서 항목이 사라진다", async () => {
      const { retryContractActivation } = await import("./consultation-actions");
      vi.mocked(retryContractActivation).mockResolvedValue({ status: "activated" });

      render(<ConsultationTab {...activationRetryProps} />);
      fireEvent.click(screen.getByText("오류/재처리 현황판"));
      fireEvent.click(screen.getByText("활성화 재시도"));

      await screen.findByText("활성화 재처리 대기 중인 계약이 없습니다.");
      expect(retryContractActivation).toHaveBeenCalledWith("retry1");
    });

    it("여전히 실패하면 갱신된 사유를 보여주고 항목을 목록에 유지한다", async () => {
      const { retryContractActivation } = await import("./consultation-actions");
      vi.mocked(retryContractActivation).mockResolvedValue({
        status: "still_failing",
        failureReason: "여전히 동의 없음",
      });

      render(<ConsultationTab {...activationRetryProps} />);
      fireEvent.click(screen.getByText("오류/재처리 현황판"));
      fireEvent.click(screen.getByText("활성화 재시도"));

      await screen.findByText("여전히 동의 없음", { exact: false });
      expect(screen.getByText("이서준", { exact: false })).toBeInTheDocument();
    });
  });
});
