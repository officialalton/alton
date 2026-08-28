import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ScheduleTab from "./ScheduleTab";
import type { TeacherLesson } from "./dashboard-data";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

const upcomingLesson: TeacherLesson = {
  sessionId: "s1",
  enrollmentId: "e1",
  studentId: "st1",
  studentName: "지훈",
  subjectName: "SAT Math",
  sessionNumber: 8,
  unitTitle: "이차방정식",
  scheduledAt: "2026-09-03T05:00:00.000Z",
  durationMinutes: 30,
};

const pastLesson: TeacherLesson = {
  ...upcomingLesson,
  sessionId: "s2",
  sessionNumber: 7,
  scheduledAt: "2026-08-01T05:00:00.000Z",
};

describe("ScheduleTab", () => {
  it("기본 서브탭은 예정된 수업이고, 여러 학생/과목을 보여준다", () => {
    render(<ScheduleTab upcoming={[upcomingLesson]} past={[]} />);
    expect(screen.getByText(/지훈 · SAT Math · 8회차/)).toBeInTheDocument();
    expect(screen.getByText("수업 준비")).toBeInTheDocument();
  });

  it("지난 수업 서브탭은 수업 기록 링크를 보여준다", () => {
    render(<ScheduleTab upcoming={[]} past={[pastLesson]} />);
    fireEvent.click(screen.getByText("지난 수업"));
    expect(screen.getByText("수업 기록")).toBeInTheDocument();
  });

  it("항목 클릭 시 세션뷰로 이동한다", () => {
    render(<ScheduleTab upcoming={[upcomingLesson]} past={[]} />);
    fireEvent.click(screen.getByText("수업 준비"));
    expect(pushMock).toHaveBeenCalledWith("/session/s1");
  });

  it("빈 목록이면 안내 문구를 보여준다", () => {
    render(<ScheduleTab upcoming={[]} past={[]} />);
    expect(screen.getByText("예정된 수업이 없습니다.")).toBeInTheDocument();
  });
});
