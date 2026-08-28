import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HomeDashboard from "./HomeDashboard";
import type { DashboardData } from "./dashboard-data";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const baseData: DashboardData = {
  studentName: "지훈",
  upcoming: [],
  calendarByDay: {},
  calendarYear: 2026,
  calendarMonth: 7,
  attendanceRate: null,
};

describe("HomeDashboard", () => {
  it("예정된 수업이 없으면 안내 문구를 보여준다", () => {
    render(
      <HomeDashboard
        studentName="지훈"
        data={baseData}
        onShowLessons={vi.fn()}
        onShowStats={vi.fn()}
      />
    );
    expect(screen.getByText("예정된 수업이 없습니다.")).toBeInTheDocument();
  });

  it("예정된 수업이 있으면 목록에 보여준다", () => {
    const data: DashboardData = {
      ...baseData,
      upcoming: [
        {
          sessionId: "s1",
          subjectName: "SAT Math",
          teacherName: "박서연",
          sessionNumber: 8,
          unitTitle: "이차방정식",
          scheduledAt: "2026-09-03T05:00:00.000Z",
          durationMinutes: 30,
        },
      ],
    };
    render(
      <HomeDashboard
        studentName="지훈"
        data={data}
        onShowLessons={vi.fn()}
        onShowStats={vi.fn()}
      />
    );
    expect(screen.getByText(/SAT Math · 8회차/)).toBeInTheDocument();
    expect(screen.getByText("박서연")).toBeInTheDocument();
  });

  it("참여율이 있으면 퍼센트로, 없으면 대시로 보여준다", () => {
    render(
      <HomeDashboard
        studentName="지훈"
        data={{ ...baseData, attendanceRate: 92 }}
        onShowLessons={vi.fn()}
        onShowStats={vi.fn()}
      />
    );
    expect(screen.getByText("92%")).toBeInTheDocument();
  });

  it("캘린더에서 수업이 있는 날을 클릭하면 상세가 보인다", () => {
    const data: DashboardData = {
      ...baseData,
      calendarByDay: {
        15: [{ sessionId: "s1", subjectName: "SAT Math", sessionNumber: 8 }],
      },
    };
    render(
      <HomeDashboard
        studentName="지훈"
        data={data}
        onShowLessons={vi.fn()}
        onShowStats={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText("15"));
    expect(screen.getByText("SAT Math · 8회차")).toBeInTheDocument();
  });

  it("전체 보기 버튼이 콜백을 호출한다", () => {
    const onShowLessons = vi.fn();
    const onShowStats = vi.fn();
    render(
      <HomeDashboard
        studentName="지훈"
        data={baseData}
        onShowLessons={onShowLessons}
        onShowStats={onShowStats}
      />
    );
    const showAllButtons = screen.getAllByText("전체 보기 →");
    fireEvent.click(showAllButtons[0]);
    fireEvent.click(showAllButtons[1]);
    expect(onShowLessons).toHaveBeenCalled();
    expect(onShowStats).toHaveBeenCalled();
  });
});
