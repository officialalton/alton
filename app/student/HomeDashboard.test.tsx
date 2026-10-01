import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HomeDashboard from "./HomeDashboard";
import type { DashboardData } from "./dashboard-data";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
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
      />
    );
    fireEvent.click(screen.getByText("15"));
    expect(screen.getByText("SAT Math · 8회차")).toBeInTheDocument();
  });

  it("전체 보기 버튼(예정 수업)이 콜백을 호출한다", () => {
    // 2026-09-22(사용자 지시) — 통계 요약의 "전체 보기"(Performance 탭)는
    // 제거됐다(Home에서 이미 보이므로 별도 탭이 불필요). 예정 수업 쪽만 남는다.
    const onShowLessons = vi.fn();
    render(<HomeDashboard studentName="지훈" data={baseData} onShowLessons={onShowLessons} />);
    fireEvent.click(screen.getByText("전체 보기 →"));
    expect(onShowLessons).toHaveBeenCalled();
  });

  it("2026-09-10(UI/UX 정리 1차): 오늘 예정된 수업이 있으면 홈 최상단에 '오늘 수업' 배너와 입장하기 버튼을 보여준다", () => {
    const todayIso = new Date().toISOString();
    const data: DashboardData = {
      ...baseData,
      upcoming: [
        {
          sessionId: "today-session",
          subjectName: "SAT Math",
          teacherName: "박서연",
          sessionNumber: 8,
          unitTitle: "이차방정식",
          scheduledAt: todayIso,
          durationMinutes: 30,
        },
      ],
    };
    render(
      <HomeDashboard studentName="지훈" data={data} onShowLessons={vi.fn()} />
    );
    expect(screen.getByText("오늘 수업")).toBeInTheDocument();
    fireEvent.click(screen.getByText("입장하기 →"));
    expect(pushMock).toHaveBeenCalledWith("/session/today-session");
  });

  it("2026-09-10(UI/UX 정리 1차): 오늘 수업이 없으면 다음 수업까지 D-day를 안내한다", () => {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const data: DashboardData = {
      ...baseData,
      upcoming: [
        {
          sessionId: "future-session",
          subjectName: "SAT Math",
          teacherName: "박서연",
          sessionNumber: 8,
          unitTitle: null,
          scheduledAt: future,
          durationMinutes: 30,
        },
      ],
    };
    render(
      <HomeDashboard studentName="지훈" data={data} onShowLessons={vi.fn()} />
    );
    expect(screen.queryByText("오늘 수업")).not.toBeInTheDocument();
    expect(screen.getByText(/다음 수업까지 D-/)).toBeInTheDocument();
  });
});
