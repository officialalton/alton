import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LessonsTab from "./LessonsTab";
import type { LessonItem } from "./lessons-data";
import type { CurriculumData } from "./curriculum-data";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("./memo-actions", () => ({
  addMemo: vi.fn(),
}));

vi.mock("./review-actions", () => ({
  submitStudentFeedback: vi.fn(),
}));

const upcomingLesson: LessonItem = {
  sessionId: "s1",
  enrollmentId: "e1",
  subjectId: "sub1",
  subjectName: "SAT Math",
  teacherName: "박서연",
  sessionNumber: 8,
  unitTitle: "이차방정식",
  status: "upcoming",
  scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  durationMinutes: 30,
};

const pastLesson: LessonItem = {
  sessionId: "s2",
  enrollmentId: "e1",
  subjectId: "sub1",
  subjectName: "SAT Math",
  teacherName: "박서연",
  sessionNumber: 7,
  unitTitle: "이차방정식과 이차함수",
  status: "completed",
  scheduledAt: "2026-08-01T05:00:00.000Z",
  durationMinutes: 30,
};

const curriculum: CurriculumData = {
  enrollmentId: "e1",
  subjectId: "sub1",
  subjectName: "SAT Math",
  teacherName: "박서연",
  totalSessions: 12,
  currentSession: 8,
  units: [
    {
      position: 7,
      unitTitle: "이차방정식과 이차함수",
      note: null,
      teacherComment: null,
      status: "done",
      sessionId: "s2",
      scheduledAt: "2026-08-01T05:00:00.000Z",
    },
  ],
};

describe("LessonsTab", () => {
  it("기본 서브탭은 예정된 수업이고, 항목을 보여준다", () => {
    render(
      <LessonsTab
        upcoming={[upcomingLesson]}
        past={[]}
        curricula={[]}
        memosByEnrollment={{}}
        reviews={{}}
        myFeedback={{}}
      />
    );
    expect(screen.getByText(/SAT Math · 8회차/)).toBeInTheDocument();
    expect(screen.getByText("수업 준비")).toBeInTheDocument();
  });

  it("지난 수업 서브탭에서 리뷰 미작성 표시가 보인다", () => {
    render(
      <LessonsTab
        upcoming={[]}
        past={[pastLesson]}
        curricula={[]}
        memosByEnrollment={{}}
        reviews={{}}
        myFeedback={{}}
      />
    );
    fireEvent.click(screen.getByText("지난 수업"));
    expect(screen.getByText(/리뷰 보기 \(미작성\)/)).toBeInTheDocument();
  });

  it("과목 칩을 누르면 커리큘럼 뷰로 이동한다", () => {
    render(
      <LessonsTab
        upcoming={[upcomingLesson]}
        past={[]}
        curricula={[curriculum]}
        memosByEnrollment={{}}
        reviews={{}}
        myFeedback={{}}
      />
    );
    fireEvent.click(screen.getByText(/SAT Math · 8회차/));
    expect(screen.getByText("8 / 12회차")).toBeInTheDocument();
    expect(screen.getByText(/7회차 · 이차방정식과 이차함수/)).toBeInTheDocument();
  });

  it("리뷰 보기를 누르면 리뷰 패널로 이동한다", () => {
    render(
      <LessonsTab
        upcoming={[]}
        past={[pastLesson]}
        curricula={[]}
        memosByEnrollment={{}}
        reviews={{}}
        myFeedback={{}}
      />
    );
    fireEvent.click(screen.getByText("지난 수업"));
    fireEvent.click(screen.getByText(/리뷰 보기/));
    expect(
      screen.getByText("아직 선생님이 리포트를 작성하지 않았습니다.")
    ).toBeInTheDocument();
  });
});
