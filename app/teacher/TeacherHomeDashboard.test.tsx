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

const defaultProps = {
  currentAssignments: [],
  onShowAssignments: vi.fn(),
  onShowCurriculum: vi.fn(),
};

describe("TeacherHomeDashboard", () => {
  it("예정된 수업이 없으면 안내 문구를 보여준다", () => {
    render(<TeacherHomeDashboard data={baseData} onShowSchedule={vi.fn()} {...defaultProps} />);
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
    render(<TeacherHomeDashboard data={data} onShowSchedule={vi.fn()} {...defaultProps} />);
    expect(screen.getByText(/지훈 · SAT Math · 8회차/)).toBeInTheDocument();
    expect(screen.getByText(/지훈 · AP Statistics · 1회차/)).toBeInTheDocument();
  });

  it("전체 보기를 누르면 콜백이 호출된다", () => {
    const onShowSchedule = vi.fn();
    render(<TeacherHomeDashboard data={baseData} onShowSchedule={onShowSchedule} {...defaultProps} />);
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
    render(<TeacherHomeDashboard data={data} onShowSchedule={vi.fn()} {...defaultProps} />);
    fireEvent.click(screen.getByText("15"));
    expect(screen.getByText("지훈 · SAT Math · 8회차")).toBeInTheDocument();
  });

  it("status가 pending이면 활성화 대기 배너를 보여주고, Calendly 자기 온보딩 UI는 노출하지 않는다(R2 Task 7)", () => {
    render(
      <TeacherHomeDashboard data={{ ...baseData, status: "pending" }} onShowSchedule={vi.fn()} {...defaultProps} />
    );
    expect(screen.getByText("계정이 아직 활성화되지 않았습니다")).toBeInTheDocument();
    expect(screen.queryByText(/Calendly/)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/calendly/i)).not.toBeInTheDocument();
  });

  it("status가 active면 활성화 대기 배너가 안 보인다", () => {
    render(
      <TeacherHomeDashboard data={{ ...baseData, status: "active" }} onShowSchedule={vi.fn()} {...defaultProps} />
    );
    expect(screen.queryByText("계정이 아직 활성화되지 않았습니다")).not.toBeInTheDocument();
  });

  it("2026-09-10(UI/UX 정리 1차): 오늘 예정된 수업이 있으면 '오늘 수업' 배너와 입장하기 버튼을 보여준다", () => {
    const todayIso = new Date().toISOString();
    const data: TeacherDashboardData = {
      ...baseData,
      upcoming: [
        {
          sessionId: "today-session",
          enrollmentId: "e1",
          studentId: "st1",
          studentName: "지훈",
          subjectName: "SAT Math",
          sessionNumber: 8,
          unitTitle: null,
          scheduledAt: todayIso,
          durationMinutes: 30,
        },
      ],
    };
    render(<TeacherHomeDashboard data={data} onShowSchedule={vi.fn()} {...defaultProps} />);
    expect(screen.getByText("오늘 수업")).toBeInTheDocument();
    expect(screen.getByText("입장하기 →")).toBeInTheDocument();
  });

  it("2026-09-10(UI/UX 정리 1차): '수업 준비'/'담당 학생' 카드를 누르면 각각 콜백이 호출된다", () => {
    const onShowCurriculum = vi.fn();
    const onShowAssignments = vi.fn();
    render(
      <TeacherHomeDashboard
        data={baseData}
        onShowSchedule={vi.fn()}
        currentAssignments={[
          {
            assignmentId: "ta1",
            subjectEnrollmentId: "se1",
            studentId: "st1",
            studentName: "지훈",
            studentGrade: "11학년",
            studentPhone: null,
            subjectId: "sub1",
            subjectName: "SAT Math",
            status: "active",
            effectiveFrom: "2026-08-01T00:00:00Z",
            effectiveUntil: null,
            hasLegacyCurriculum: false,
          },
        ]}
        onShowAssignments={onShowAssignments}
        onShowCurriculum={onShowCurriculum}
      />
    );
    expect(screen.getByText("담당 학생 (1)")).toBeInTheDocument();
    expect(screen.getByText(/지훈\(SAT Math\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("수업 준비"));
    expect(onShowCurriculum).toHaveBeenCalled();
    fireEvent.click(screen.getByText("담당 학생 (1)"));
    expect(onShowAssignments).toHaveBeenCalled();
  });
});
