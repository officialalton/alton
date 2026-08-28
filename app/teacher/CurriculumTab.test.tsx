import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CurriculumTab from "./CurriculumTab";
import type { RosterStudent } from "./roster-data";
import type { TeacherCurriculumData } from "./curriculum-data";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("./mysubjects-actions", () => ({
  createMyTemplate: vi.fn(),
  addTemplateUnit: vi.fn(),
  updateTemplateUnit: vi.fn(),
  removeTemplateUnit: vi.fn(),
  moveTemplateUnit: vi.fn(),
}));

vi.mock("@/app/student/memo-actions", () => ({
  addMemo: vi.fn(),
}));

const students: RosterStudent[] = [
  {
    studentId: "st1",
    studentName: "지훈",
    grade: null,
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

const curricula: TeacherCurriculumData[] = [
  {
    enrollmentId: "e1",
    subjectId: "sub1",
    subjectName: "SAT Math",
    teacherName: "박서연",
    totalSessions: 12,
    currentSession: 8,
    studentId: "st1",
    studentName: "지훈",
    units: [
      {
        position: 1,
        unitTitle: "함수의 기초",
        note: null,
        teacherComment: null,
        status: "done",
        sessionId: "s1",
        scheduledAt: "2026-07-01T05:00:00.000Z",
      },
    ],
  },
];

const baseProps = {
  mySubjects: [],
  students,
  curricula,
  memosByEnrollment: {},
  reviews: {},
  studentFeedback: {},
  jumpTo: null,
  onJumpConsumed: vi.fn(),
};

describe("CurriculumTab", () => {
  it("기본 서브탭은 내 과목이다", () => {
    render(<CurriculumTab {...baseProps} />);
    expect(screen.getByText("담당 중인 과목이 없습니다.")).toBeInTheDocument();
  });

  it("학생별 서브탭에서 학생을 고르면 그 학생의 과목이 보인다", () => {
    render(<CurriculumTab {...baseProps} />);
    fireEvent.click(screen.getByText("학생별"));
    expect(screen.getByText("SAT Math")).toBeInTheDocument();
    expect(screen.getByText("8/12회차")).toBeInTheDocument();
  });

  it("과목을 클릭하면 커리큘럼 상세로 이동한다", () => {
    render(<CurriculumTab {...baseProps} />);
    fireEvent.click(screen.getByText("학생별"));
    fireEvent.click(screen.getByText("SAT Math"));
    expect(screen.getByText("완료")).toBeInTheDocument();
  });

  it("jumpTo가 주어지면 바로 해당 학생/과목의 커리큘럼으로 진입한다", () => {
    render(
      <CurriculumTab
        {...baseProps}
        jumpTo={{ studentId: "st1", subjectId: "sub1" }}
      />
    );
    expect(screen.getByText("완료")).toBeInTheDocument();
    expect(baseProps.onJumpConsumed).toHaveBeenCalled();
  });
});
