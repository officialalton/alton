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

const dashboard: AdminDashboardData = {
  adminName: "관리자",
  pendingConsults: [],
  upcomingConsults: [],
  pendingStudents: [],
  pendingTeachers: [],
  qcWarnings: [],
};

describe("AdminShell", () => {
  it("사이드바 10개 항목을 보여주고, 기본 탭은 홈이다", () => {
    render(<AdminShell dashboard={dashboard} subjects={[]} docs={[]} />);
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
    ].forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
    expect(screen.getByText("관리자, 안녕하세요")).toBeInTheDocument();
  });

  it("다른 탭을 누르면 준비 중 문구를 보여준다", () => {
    render(<AdminShell dashboard={dashboard} subjects={[]} docs={[]} />);
    fireEvent.click(screen.getByText("사용자"));
    expect(screen.getByText("사용자 탭은 준비 중입니다.")).toBeInTheDocument();
  });

  it("계정 메뉴를 열면 홈으로/로그아웃 버튼이 보인다", () => {
    render(<AdminShell dashboard={dashboard} subjects={[]} docs={[]} />);
    fireEvent.click(screen.getByText("관리자 ▾"));
    expect(screen.getByText("홈으로")).toBeInTheDocument();
    expect(screen.getByText("로그아웃")).toBeInTheDocument();
  });

  it("다른 탭에서 홈으로를 누르면 대시보드로 돌아온다", () => {
    render(<AdminShell dashboard={dashboard} subjects={[]} docs={[]} />);
    fireEvent.click(screen.getByText("사용자"));
    fireEvent.click(screen.getByText("관리자 ▾"));
    fireEvent.click(screen.getByText("홈으로"));
    expect(screen.getByText("관리자, 안녕하세요")).toBeInTheDocument();
  });

  it("커리큘럼 탭을 누르면 과목 템플릿 서브탭이 렌더링된다", () => {
    render(<AdminShell dashboard={dashboard} subjects={[]} docs={[]} />);
    fireEvent.click(screen.getByText("커리큘럼"));
    expect(screen.getByText("+ 과목 추가")).toBeInTheDocument();
  });
});
