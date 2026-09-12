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

  it("지난 수업에는 리뷰 미작성 시 리뷰 작성 버튼이 보인다", () => {
    render(<ScheduleTab upcoming={[]} past={[pastLesson]} reviewedSessionIds={[]} />);
    fireEvent.click(screen.getByText("지난 수업"));
    fireEvent.click(screen.getByText("리뷰 작성"));
    expect(pushMock).toHaveBeenCalledWith("/teacher/review/s2");
  });

  it("이미 리뷰를 제출한 세션은 리뷰 수정 버튼을 보여준다", () => {
    render(<ScheduleTab upcoming={[]} past={[pastLesson]} reviewedSessionIds={["s2"]} />);
    fireEvent.click(screen.getByText("지난 수업"));
    expect(screen.getByText("리뷰 수정")).toBeInTheDocument();
  });

  it("예정된 수업에는 리뷰 버튼이 없다", () => {
    render(<ScheduleTab upcoming={[upcomingLesson]} past={[]} />);
    expect(screen.queryByText("리뷰 작성")).not.toBeInTheDocument();
  });

  it("onReportSessionIssue가 없으면 신고 버튼을 보여주지 않는다", () => {
    render(<ScheduleTab upcoming={[]} past={[pastLesson]} />);
    fireEvent.click(screen.getByText("지난 수업"));
    expect(screen.queryByText("지각·노쇼 신고")).not.toBeInTheDocument();
  });

  it("지각·노쇼 신고를 제출하면 onReportSessionIssue가 호출되고 접수됨으로 바뀐다", async () => {
    const onReportSessionIssue = vi.fn().mockResolvedValue(undefined);
    render(<ScheduleTab upcoming={[]} past={[pastLesson]} onReportSessionIssue={onReportSessionIssue} />);
    fireEvent.click(screen.getByText("지난 수업"));
    fireEvent.click(screen.getByText("지각·노쇼 신고"));
    fireEvent.click(screen.getByText("신고 제출"));
    await screen.findByText("신고 접수됨");
    expect(onReportSessionIssue).toHaveBeenCalledWith({
      sessionId: "s2",
      reportType: "student_no_show_reported",
      minutesLate: undefined,
      notes: undefined,
    });
  });

  it("본인 지각 신고는 지각 시간(분) 입력 전에는 제출 버튼이 비활성화된다", () => {
    const onReportSessionIssue = vi.fn().mockResolvedValue(undefined);
    render(<ScheduleTab upcoming={[]} past={[pastLesson]} onReportSessionIssue={onReportSessionIssue} />);
    fireEvent.click(screen.getByText("지난 수업"));
    fireEvent.click(screen.getByText("지각·노쇼 신고"));
    fireEvent.change(screen.getByDisplayValue("학생 노쇼"), { target: { value: "teacher_late" } });
    expect(screen.getByText("신고 제출")).toBeDisabled();
  });
});
