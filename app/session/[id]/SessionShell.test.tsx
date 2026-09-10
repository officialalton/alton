import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SessionShell from "./SessionShell";
import { finalizeMyLessonSession } from "@/app/teacher/lesson-schedule-actions";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: refreshMock }),
}));

vi.mock("@/app/teacher/lesson-schedule-actions", () => ({
  finalizeMyLessonSession: vi.fn(),
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
  docLinks: [],
  whiteboardStrokes: [],
  problemLog: [],
  sessionSource: "legacy" as const,
  initialAnnotationStrokes: [],
  currentUserId: "user-1",
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
    expect(screen.getByText(/Google Meet 연결됨/)).toBeInTheDocument();
    expect(
      screen.getByText("선생님이 안 보이시나요? (노쇼 알림)")
    ).toBeInTheDocument();
    expect(screen.queryByText(/수업 종료/)).not.toBeInTheDocument();
  });

  it("2026-09-10(UI/UX 정리 1차): live 상태에서 선생님이 '수업 종료'를 누르면 학생명·종료 시각을 보여주는 확인 모달이 뜨고, 확인해야만 기존 종료 로직이 호출된다", async () => {
    vi.mocked(finalizeMyLessonSession).mockResolvedValue({ ok: true });
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
    const openButton = screen.getByRole("button", { name: "수업 종료" });
    expect(openButton).not.toBeDisabled();
    fireEvent.click(openButton);

    // 확인 모달에 학생명이 표시된다 — 아직 finalize는 호출되지 않는다.
    expect(screen.getByText(/수업을 종료할까요\?/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${baseProps.studentName} 학생과의 수업을`))).toBeInTheDocument();
    expect(finalizeMyLessonSession).not.toHaveBeenCalled();

    const confirmButtons = screen.getAllByRole("button", { name: "수업 종료" });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    await waitFor(() =>
      expect(finalizeMyLessonSession).toHaveBeenCalledWith({
        sessionId: baseProps.sessionId,
        outcome: "completed",
        reason: "선생님 수업 종료",
      })
    );
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
  // R9(Task 4) — 세션 중 신규 문제 생성("문제 생성" 탭)은 완전히 제거됐다.
  // AI 문제 생성은 관리자 콘텐츠 에디터 전용이고(app/admin/CurriculumDocEditor.tsx),
  // 학생에게는 검수·확정된 문제만 과제/문제 기록 탭을 통해 노출된다.
  it("문제 생성 탭은 학생/선생님 어느 쪽에도 더 이상 보이지 않는다", () => {
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
    expect(screen.queryByText("문제 생성")).not.toBeInTheDocument();
  });

  it("교재/과제/단어장/연습장 탭은 역할별 노출이 그대로 유지된다", () => {
    render(
      <SessionShell
        {...baseProps}
        viewerRole="teacher"
        initialState="prep"
        status="upcoming"
        scheduledAt={null}
        durationMinutes={30}
      />
    );
    expect(screen.getByText("교재")).toBeInTheDocument();
    expect(screen.getAllByText("과제").length).toBeGreaterThan(0);
    expect(screen.getByText(`${baseProps.studentName} 학생의 단어장`)).toBeInTheDocument();
    expect(screen.getByText("연습장")).toBeInTheDocument();
  });

  it("2026-09-10(UI/UX 정리 1차): 기본 활성 탭은 교재다", () => {
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
    expect(screen.getByText("이 세션에는 아직 배정된 교재가 없습니다.")).toBeInTheDocument();
  });
});
