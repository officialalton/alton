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
  aiNotesEvents: [],
  driveIssues: [
    { id: "d1", contractId: "ct1", artifactType: "signed_document", syncStatus: "retryable_failed" as const },
  ],
  staleEnvelopes: [],
};

describe("ConsultationTab", () => {
  it("상담 관리 서브탭을 기본으로 보여준다", () => {
    render(<ConsultationTab {...baseProps} />);
    expect(screen.getByText("김민지", { exact: false })).toBeInTheDocument();
  });

  it("보호자 동의 대기 서브탭으로 전환하면 동의 미비 학생을 보여준다", () => {
    render(<ConsultationTab {...baseProps} />);
    fireEvent.click(screen.getByText("보호자 동의 대기"));
    expect(screen.getByText("지훈")).toBeInTheDocument();
  });

  it("오류/재처리 현황판 서브탭에서 Drive 실패 항목을 원인별로 보여준다", () => {
    render(<ConsultationTab {...baseProps} />);
    fireEvent.click(screen.getByText("오류/재처리 현황판"));
    expect(screen.getByText("Drive 저장 실패 (재시도 가능)")).toBeInTheDocument();
    expect(screen.getByText("보호자 동의 차단 (재시도 불가 — 가족 조치 필요)")).toBeInTheDocument();
  });
});
