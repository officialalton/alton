import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TeacherShell from "./TeacherShell";
import type { TeacherDashboardData } from "./dashboard-data";
import type { RosterStudent } from "./roster-data";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/app/login/actions", () => ({
  logout: vi.fn(),
}));

const dashboard: TeacherDashboardData = {
  teacherName: "박서연",
  status: "active",
  upcoming: [],
  past: [],
  calendarByDay: {},
  calendarYear: 2026,
  calendarMonth: 7,
};

const roster: RosterStudent[] = [
  {
    studentId: "st1",
    studentName: "지훈",
    grade: "11학년",
    subjects: [
      {
        enrollmentId: "e1",
        subjectId: "sub1",
        subjectName: "SAT Math",
        currentSession: 8,
        totalSessions: 12,
      },
    ],
  },
];

const baseProps = {
  dashboard,
  roster,
  mySubjects: [],
  curricula: [],
  memosByEnrollment: {},
  reviews: {},
  studentFeedback: {},
  reviewedSessionIds: [],
  currentAssignments: [],
  pastAssignments: [],
};

describe("TeacherShell", () => {
  it("사이드바 8개 항목을 보여주고, 기본 탭은 홈이다", () => {
    render(<TeacherShell {...baseProps} />);
    ["홈", "배정", "일정", "수업", "학생", "커리큘럼", "교재", "정산"].forEach((label) =>
      expect(screen.getByText(label)).toBeInTheDocument()
    );
    expect(screen.getByText("박서연 선생님, 안녕하세요")).toBeInTheDocument();
  });

  it("수업 탭을 누르면 ScheduleTab이 렌더링된다", () => {
    render(<TeacherShell {...baseProps} />);
    fireEvent.click(screen.getByText("수업"));
    expect(screen.getByText("예정된 수업이 없습니다.")).toBeInTheDocument();
  });

  it("학생 탭을 누르면 로스터가 렌더링된다", () => {
    render(<TeacherShell {...baseProps} />);
    fireEvent.click(screen.getByText("학생"));
    expect(screen.getByText("지훈")).toBeInTheDocument();
    expect(screen.getByText(/SAT Math · 8\/12회차/)).toBeInTheDocument();
  });

  it("로스터의 과목을 클릭하면 커리큘럼 탭의 학생별 뷰로 이동한다", () => {
    render(<TeacherShell {...baseProps} />);
    fireEvent.click(screen.getByText("학생"));
    fireEvent.click(screen.getByText(/SAT Math · 8\/12회차/));
    expect(screen.getByText("학생별")).toBeInTheDocument();
  });

  it("다른 탭을 누르면 준비 중 문구를 보여준다", () => {
    render(<TeacherShell {...baseProps} />);
    fireEvent.click(screen.getByText("교재"));
    expect(screen.getByText("교재 탭은 준비 중입니다.")).toBeInTheDocument();
  });

  it("계정 메뉴를 열면 로그아웃 버튼이 보인다", () => {
    render(<TeacherShell {...baseProps} />);
    fireEvent.click(screen.getByText("박서연 선생님 ▾"));
    expect(screen.getByText("로그아웃")).toBeInTheDocument();
  });
});
