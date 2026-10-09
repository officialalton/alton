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
    expect(screen.getByText(/지훈 · SAT Math · Session 8/)).toBeInTheDocument();
    expect(screen.getByText("Lesson prep")).toBeInTheDocument();
  });

  it("지난 수업 서브탭은 수업 기록 링크를 보여준다", () => {
    render(<ScheduleTab upcoming={[]} past={[pastLesson]} />);
    fireEvent.click(screen.getByText("Past"));
    expect(screen.getByText("Lesson record")).toBeInTheDocument();
  });

  it("항목 클릭 시 세션뷰로 이동한다", () => {
    render(<ScheduleTab upcoming={[upcomingLesson]} past={[]} />);
    fireEvent.click(screen.getByText("Lesson prep"));
    expect(pushMock).toHaveBeenCalledWith("/session/s1");
  });

  it("빈 목록이면 안내 문구를 보여준다", () => {
    render(<ScheduleTab upcoming={[]} past={[]} />);
    expect(screen.getByText("No upcoming lessons.")).toBeInTheDocument();
  });

  it("지난 수업에는 리뷰 미작성 시 리뷰 작성 버튼이 보인다", () => {
    render(<ScheduleTab upcoming={[]} past={[pastLesson]} reviewedSessionIds={[]} />);
    fireEvent.click(screen.getByText("Past"));
    fireEvent.click(screen.getByText("Write review"));
    expect(pushMock).toHaveBeenCalledWith("/teacher/review/s2");
  });

  it("이미 리뷰를 제출한 세션은 리뷰 수정 버튼을 보여준다", () => {
    render(<ScheduleTab upcoming={[]} past={[pastLesson]} reviewedSessionIds={["s2"]} />);
    fireEvent.click(screen.getByText("Past"));
    expect(screen.getByText("Edit review")).toBeInTheDocument();
  });

  it("예정된 수업에는 리뷰 버튼이 없다", () => {
    render(<ScheduleTab upcoming={[upcomingLesson]} past={[]} />);
    expect(screen.queryByText("Write review")).not.toBeInTheDocument();
  });

  it("onReportSessionIssue가 없으면 신고 버튼을 보여주지 않는다", () => {
    render(<ScheduleTab upcoming={[]} past={[pastLesson]} />);
    fireEvent.click(screen.getByText("Past"));
    expect(screen.queryByText("Report late / no-show")).not.toBeInTheDocument();
  });

  it("지각·노쇼 신고를 제출하면 onReportSessionIssue가 호출되고 접수됨으로 바뀐다", async () => {
    const onReportSessionIssue = vi.fn().mockResolvedValue(undefined);
    render(<ScheduleTab upcoming={[]} past={[pastLesson]} onReportSessionIssue={onReportSessionIssue} />);
    fireEvent.click(screen.getByText("Past"));
    fireEvent.click(screen.getByText("Report late / no-show"));
    fireEvent.click(screen.getByText("Submit report"));
    await screen.findByText("Report submitted");
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
    fireEvent.click(screen.getByText("Past"));
    fireEvent.click(screen.getByText("Report late / no-show"));
    fireEvent.change(screen.getByDisplayValue("Student no-show"), { target: { value: "teacher_late" } });
    expect(screen.getByText("Submit report")).toBeDisabled();
  });
});
