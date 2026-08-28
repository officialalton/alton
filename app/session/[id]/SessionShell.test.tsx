import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SessionShell from "./SessionShell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("./actions", () => ({
  submitMcAttempt: vi.fn(),
  submitEssayAttempt: vi.fn(),
  submitMathAttempt: vi.fn(),
}));

vi.mock("./canvas-actions", () => ({
  saveCanvasStrokes: vi.fn(),
}));

vi.mock("./vocab-actions", () => ({
  addVocabWord: vi.fn(),
  removeVocabWord: vi.fn(),
}));

vi.mock("./homework-actions", () => ({
  saveHomeworkAnswer: vi.fn(),
  addHomeworkItem: vi.fn(),
}));

vi.mock("./aigen-actions", () => ({
  generateProblems: vi.fn(),
  finalizeProblemsToHomework: vi.fn(),
}));

vi.mock("./scratchpad-actions", () => ({
  addDocLink: vi.fn(),
  removeDocLink: vi.fn(),
  saveWhiteboardStrokes: vi.fn(),
}));

vi.mock("./problemlog-actions", () => ({
  toggleSaveAttempt: vi.fn(),
  retryMcAttempt: vi.fn(),
  retryEssayAttempt: vi.fn(),
  retryMathAttempt: vi.fn(),
  saveTeacherPick: vi.fn(),
  removeTeacherPick: vi.fn(),
}));

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: function on() {
        return this;
      },
      subscribe: function subscribe() {
        return this;
      },
      send: vi.fn(),
    }),
    removeChannel: vi.fn(),
  }),
}));

const baseProps = {
  sessionId: "session-1",
  studentId: "student-1",
  material: null,
  vocabWords: [],
  homeworkItems: [],
  unitTitle: "이차방정식 응용 문제 (1)",
  subjectName: "SAT Math",
  studentName: "지훈",
  sessionNumber: 7,
  backHref: "/student",
  subjectId: "subject-1",
  unitOptions: ["이차방정식 단원"],
  docLinks: [],
  whiteboardStrokes: [],
  problemLog: [],
};

describe("SessionShell — 세션 상태바", () => {
  it("prep 상태에서는 준비중 배지와 예정 일시를 보여준다", () => {
    render(
      <SessionShell
        {...baseProps}
        viewerRole="student"
        initialState="prep"
        status="upcoming"
        scheduledAt="2026-09-03T05:00:00.000Z"
        durationMinutes={30}
      />
    );
    expect(screen.getByText(/수업 준비 중/)).toBeInTheDocument();
  });

  it("live 상태에서 학생에게는 노쇼 알림 버튼만 보인다", () => {
    render(
      <SessionShell
        {...baseProps}
        viewerRole="student"
        initialState="live"
        status="upcoming"
        scheduledAt={new Date().toISOString()}
        durationMinutes={30}
      />
    );
    expect(screen.getByText(/Zoom 연결됨/)).toBeInTheDocument();
    expect(
      screen.getByText("선생님이 안 보이시나요? (노쇼 알림)")
    ).toBeInTheDocument();
    expect(screen.queryByText("수업 종료")).not.toBeInTheDocument();
  });

  it("live 상태에서 선생님에게는 수업 종료 버튼만 보인다", () => {
    render(
      <SessionShell
        {...baseProps}
        viewerRole="teacher"
        initialState="live"
        status="upcoming"
        scheduledAt={new Date().toISOString()}
        durationMinutes={30}
      />
    );
    expect(screen.getByText("수업 종료")).toBeInTheDocument();
    expect(
      screen.queryByText("선생님이 안 보이시나요? (노쇼 알림)")
    ).not.toBeInTheDocument();
  });

  it("completed 상태에서는 완료 배지를 보여준다", () => {
    render(
      <SessionShell
        {...baseProps}
        viewerRole="parent"
        initialState="completed"
        status="completed"
        scheduledAt="2026-08-01T05:00:00.000Z"
        durationMinutes={30}
      />
    );
    expect(screen.getByText(/완료된 수업/)).toBeInTheDocument();
  });
});

describe("SessionShell — 탭 노출", () => {
  it("문제 생성 탭은 선생님에게만 보인다", () => {
    const { rerender } = render(
      <SessionShell
        {...baseProps}
        viewerRole="student"
        initialState="prep"
        status="upcoming"
        scheduledAt={null}
        durationMinutes={30}
      />
    );
    expect(screen.queryByText("문제 생성")).not.toBeInTheDocument();

    rerender(
      <SessionShell
        {...baseProps}
        viewerRole="teacher"
        initialState="prep"
        status="upcoming"
        scheduledAt={null}
        durationMinutes={30}
      />
    );
    expect(screen.getByText("문제 생성")).toBeInTheDocument();
  });

  it("기본 활성 탭은 과제다", () => {
    render(
      <SessionShell
        {...baseProps}
        viewerRole="student"
        initialState="prep"
        status="upcoming"
        scheduledAt={null}
        durationMinutes={30}
      />
    );
    expect(
      screen.getByRole("heading", { name: "과제" })
    ).toBeInTheDocument();
  });
});
