import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TeacherHomeDashboard from "./TeacherHomeDashboard";
import type { TeacherDashboardData } from "./dashboard-data";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const baseData: TeacherDashboardData = {
  teacherName: "박서연",
  status: "active",
  upcoming: [],
  past: [],
  calendarByDay: {},
  calendarYear: 2026,
  calendarMonth: 7,
};

describe("TeacherHomeDashboard", () => {
  it("예정된 수업이 없으면 안내 문구를 보여준다", () => {
    render(<TeacherHomeDashboard data={baseData} onShowSchedule={vi.fn()} />);
    expect(screen.getByText("예정된 수업이 없습니다.")).toBeInTheDocument();
  });

  it("여러 학생의 예정된 수업을 학생 이름과 함께 보여준다", () => {
    const data: TeacherDashboardData = {
      ...baseData,
      upcoming: [
        {
          sessionId: "s1",
          enrollmentId: "e1",
          studentId: "st1",
          studentName: "지훈",
          subjectName: "SAT Math",
          sessionNumber: 8,
          unitTitle: "이차방정식",
          scheduledAt: "2026-09-03T05:00:00.000Z",
          durationMinutes: 30,
        },
        {
          sessionId: "s2",
          enrollmentId: "e2",
          studentId: "st1",
          studentName: "지훈",
          subjectName: "AP Statistics",
          sessionNumber: 1,
          unitTitle: null,
          scheduledAt: "2026-09-01T05:00:00.000Z",
          durationMinutes: 30,
        },
      ],
    };
    render(<TeacherHomeDashboard data={data} onShowSchedule={vi.fn()} />);
    expect(screen.getByText(/지훈 · SAT Math · 8회차/)).toBeInTheDocument();
    expect(screen.getByText(/지훈 · AP Statistics · 1회차/)).toBeInTheDocument();
  });

  it("전체 보기를 누르면 콜백이 호출된다", () => {
    const onShowSchedule = vi.fn();
    render(<TeacherHomeDashboard data={baseData} onShowSchedule={onShowSchedule} />);
    fireEvent.click(screen.getByText("전체 보기 →"));
    expect(onShowSchedule).toHaveBeenCalled();
  });

  it("캘린더에서 수업이 있는 날을 클릭하면 상세가 보인다", () => {
    const data: TeacherDashboardData = {
      ...baseData,
      calendarByDay: {
        15: [{ sessionId: "s1", studentName: "지훈", subjectName: "SAT Math", sessionNumber: 8 }],
      },
    };
    render(<TeacherHomeDashboard data={data} onShowSchedule={vi.fn()} />);
    fireEvent.click(screen.getByText("15"));
    expect(screen.getByText("지훈 · SAT Math · 8회차")).toBeInTheDocument();
  });

  it("status가 pending이면 활성화 대기 배너를 보여주고, Calendly 자기 온보딩 UI는 노출하지 않는다(R2 Task 7)", () => {
    render(
      <TeacherHomeDashboard data={{ ...baseData, status: "pending" }} onShowSchedule={vi.fn()} />
    );
    expect(screen.getByText("계정이 아직 활성화되지 않았습니다")).toBeInTheDocument();
    expect(screen.queryByText(/Calendly/)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/calendly/i)).not.toBeInTheDocument();
  });

  it("status가 active면 활성화 대기 배너가 안 보인다", () => {
    render(
      <TeacherHomeDashboard data={{ ...baseData, status: "active" }} onShowSchedule={vi.fn()} />
    );
    expect(screen.queryByText("계정이 아직 활성화되지 않았습니다")).not.toBeInTheDocument();
  });
});
