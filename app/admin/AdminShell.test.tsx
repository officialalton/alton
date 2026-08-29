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
  devLogContent: "## Phase 1\n- [x] 완료된 항목\n- [ ] 남은 항목\n",
};

describe("AdminShell", () => {
  it("사이드바 11개 항목을 보여주고, 기본 탭은 홈이다", () => {
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

  it("아직 구현 안 된 탭을 누르면 준비 중 문구를 보여준다", () => {
    render(<AdminShell {...baseProps} />);
    fireEvent.click(screen.getByText("매칭"));
    expect(screen.getByText("매칭 탭은 준비 중입니다.")).toBeInTheDocument();
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
    expect(screen.getByText("발송 대기")).toBeInTheDocument();
  });
});
