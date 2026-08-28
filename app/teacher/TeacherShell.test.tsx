import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TeacherShell from "./TeacherShell";
import type { TeacherDashboardData } from "./dashboard-data";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/app/login/actions", () => ({
  logout: vi.fn(),
}));

const dashboard: TeacherDashboardData = {
  teacherName: "박서연 선생님",
  upcoming: [],
  past: [],
  calendarByDay: {},
  calendarYear: 2026,
  calendarMonth: 7,
};

describe("TeacherShell", () => {
  it("사이드바 7개 항목을 보여주고, 기본 탭은 홈이다", () => {
    render(<TeacherShell dashboard={dashboard} />);
    ["홈", "일정", "수업", "학생", "커리큘럼", "교재", "정산"].forEach((label) =>
      expect(screen.getByText(label)).toBeInTheDocument()
    );
    expect(screen.getByText("박서연 선생님, 안녕하세요")).toBeInTheDocument();
  });

  it("수업 탭을 누르면 ScheduleTab이 렌더링된다", () => {
    render(<TeacherShell dashboard={dashboard} />);
    fireEvent.click(screen.getByText("수업"));
    expect(screen.getByText("예정된 수업이 없습니다.")).toBeInTheDocument();
  });

  it("다른 탭을 누르면 준비 중 문구를 보여준다", () => {
    render(<TeacherShell dashboard={dashboard} />);
    fireEvent.click(screen.getByText("학생"));
    expect(screen.getByText("학생 탭은 준비 중입니다.")).toBeInTheDocument();
  });

  it("계정 메뉴를 열면 로그아웃 버튼이 보인다", () => {
    render(<TeacherShell dashboard={dashboard} />);
    fireEvent.click(screen.getByText("박서연 선생님 ▾"));
    expect(screen.getByText("로그아웃")).toBeInTheDocument();
  });
});
