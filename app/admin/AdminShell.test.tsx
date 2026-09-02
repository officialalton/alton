import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminShell from "./AdminShell";
import type { AdminDashboardData } from "./dashboard-data";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/app/login/actions", () => ({
  logout: vi.fn(),
}));

vi.mock("./curriculum-doc-actions", () => ({
  createCurriculumDoc: vi.fn(),
  updateDocTitle: vi.fn(),
  setDocPublished: vi.fn(),
  addSection: vi.fn(),
  updateSection: vi.fn(),
  removeSection: vi.fn(),
  moveSection: vi.fn(),
  generateSectionProblems: vi.fn(),
  confirmSectionProblems: vi.fn(),
  removeSectionProblem: vi.fn(),
}));

vi.mock("./users-actions", () => ({
  inviteParent: vi.fn(),
  inviteStudent: vi.fn(),
  inviteTeacher: vi.fn(),
  setStudentStatus: vi.fn(),
  setTeacherStatus: vi.fn(),
  adjustStudentCredit: vi.fn(),
  setTeacherCalendlyUrl: vi.fn(),
}));

vi.mock("./teacher-subjects-actions", () => ({
  assignTeacherSubject: vi.fn(),
  unassignTeacherSubject: vi.fn(),
}));

vi.mock("./consultation-actions", () => ({
  createConsultation: vi.fn(),
  scheduleConsultation: vi.fn(),
  rescheduleConsultation: vi.fn(),
  cancelConsultation: vi.fn(),
  markConsultationNoShow: vi.fn(),
  findDuplicateConsultationCandidates: vi.fn(),
  createClassificationTag: vi.fn(),
  listClassificationTags: vi.fn(),
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
  createContractFromProposal: vi.fn(),
  companySignOffContractVersion: vi.fn(),
  sendContractForSignature: vi.fn(),
  createNewContractVersionForResend: vi.fn(),
  voidContractVersion: vi.fn(),
}));

const dashboard: AdminDashboardData = {
  adminName: "관리자",
  pendingConsults: [],
  upcomingConsults: [],
  pendingStudents: [],
  pendingTeachers: [],
  qcWarnings: [],
};

const baseProps = {
  dashboard,
  subjects: [],
  docs: [],
  parents: [],
  students: [],
  teachers: [],
  creditHistoryByStudent: {},
  qcWarningsByTeacher: {},
  pendingConsults: [],
  familyContracts: [],
  acceptedProposalsForContract: [],
  consultations: [],
  trials: [],
  proposals: [],
  consentGaps: [],
  aiNotesEvents: [],
  driveIssues: [],
  staleEnvelopes: [],
  contractActivationRetries: [],
  devLogContent: "## Phase 1\n- [x] 완료된 항목\n- [ ] 남은 항목\n",
  payouts: [],
  teacherCandidatesBySubject: {},
  workspaceProvisionings: [],
};

describe("AdminShell", () => {
  it("사이드바 12개 항목을 보여주고, 기본 탭은 홈이다", () => {
    render(<AdminShell {...baseProps} />);
    [
      "홈",
      "사용자",
      "매칭",
      "상담",
      "커리큘럼",
      "수업권",
      "계약",
      "QC",
      "정산",
      "문서",
      "개발 로그",
    ].forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
    expect(screen.getByText("관리자, 안녕하세요")).toBeInTheDocument();
  });

  it("사용자 탭을 누르면 UsersTab이 렌더링된다", () => {
    render(<AdminShell {...baseProps} />);
    fireEvent.click(screen.getByText("사용자"));
    expect(screen.getByText("학부모")).toBeInTheDocument();
  });

  it("매칭 탭을 누르면 MatchingTab이 렌더링된다", () => {
    render(<AdminShell {...baseProps} />);
    fireEvent.click(screen.getByText("매칭"));
    expect(screen.getByText("매칭 대기 중인 학생이 없습니다.")).toBeInTheDocument();
  });

  it("계정 메뉴를 열면 홈으로/로그아웃 버튼이 보인다", () => {
    render(<AdminShell {...baseProps} />);
    fireEvent.click(screen.getByText("관리자 ▾"));
    expect(screen.getByText("홈으로")).toBeInTheDocument();
    expect(screen.getByText("로그아웃")).toBeInTheDocument();
  });

  it("다른 탭에서 홈으로를 누르면 대시보드로 돌아온다", () => {
    render(<AdminShell {...baseProps} />);
    fireEvent.click(screen.getByText("매칭"));
    fireEvent.click(screen.getByText("관리자 ▾"));
    fireEvent.click(screen.getByText("홈으로"));
    expect(screen.getByText("관리자, 안녕하세요")).toBeInTheDocument();
  });

  it("커리큘럼 탭을 누르면 과목 템플릿 서브탭이 렌더링된다", () => {
    render(<AdminShell {...baseProps} />);
    fireEvent.click(screen.getByText("커리큘럼"));
    expect(screen.getByText("+ 과목 추가")).toBeInTheDocument();
  });

  it("수업권 탭을 누르면 BillingTab이 렌더링된다", () => {
    render(<AdminShell {...baseProps} />);
    fireEvent.click(screen.getByText("수업권"));
    expect(screen.getByText("학생별 수업권 현황")).toBeInTheDocument();
  });

  it("개발 로그 탭을 누르면 DevLogTab이 tickets.md 내용을 렌더링한다", () => {
    render(<AdminShell {...baseProps} />);
    fireEvent.click(screen.getByText("개발 로그"));
    expect(screen.getByText("완료된 항목")).toBeInTheDocument();
    expect(screen.getByText("남은 항목")).toBeInTheDocument();
  });

  it("계약 탭을 누르면 ContractsTab이 렌더링된다", () => {
    render(<AdminShell {...baseProps} />);
    fireEvent.click(screen.getByText("계약"));
    expect(screen.getByText("계약 목록")).toBeInTheDocument();
  });

  it("정산 탭을 누르면 PayoutsTab이 렌더링된다", () => {
    render(<AdminShell {...baseProps} />);
    fireEvent.click(screen.getByText("정산"));
    expect(screen.getByText("정산 생성")).toBeInTheDocument();
  });
});
