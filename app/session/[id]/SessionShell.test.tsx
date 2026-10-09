import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SessionShell from "./SessionShell";
import { finalizeMyLessonSession } from "@/app/teacher/lesson-schedule-actions";

beforeEach(() => {
  vi.mocked(finalizeMyLessonSession).mockReset();
});

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
  sessionVocab: { myWords: [], books: [], quizzes: [], folders: [] },
  homeworkItems: [],
  unitTitle: "이차방정식 응용 문제 (1)",
  subjectName: "SAT Math",
  studentName: "지훈",
  sessionNumber: 7,
  backHref: "/student",
  sessionSource: "legacy" as const,
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
    expect(screen.getByText(/Preparing lesson/)).toBeInTheDocument();
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
    expect(screen.getByText(/Google Meet connected/)).toBeInTheDocument();
    expect(
      screen.getByText("Can't see your teacher? (Report no-show)")
    ).toBeInTheDocument();
    expect(screen.queryByText(/End lesson/)).not.toBeInTheDocument();
  });

  it("2026-09-10(UI/UX 정리 1차): 예정 종료 시각 이후 '수업 종료'를 누르면 확인 모달이 뜨고, 확인해야만 기존 종료 로직이 호출된다", async () => {
    vi.mocked(finalizeMyLessonSession).mockResolvedValue({ ok: true });
    render(
      <SessionShell
        {...baseProps}
        viewerRole="teacher"
        initialState="live"
        status="upcoming"
        scheduledAt={new Date(Date.now() - 40 * 60_000).toISOString()}
        durationMinutes={30}
      />
    );
    const openButton = screen.getByRole("button", { name: "End lesson" });
    expect(openButton).not.toBeDisabled();
    fireEvent.click(openButton);

    // 확인 모달에 학생명이 표시된다 — 아직 finalize는 호출되지 않는다.
    expect(screen.getByText(/End this lesson\?/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`The lesson with ${baseProps.studentName}`))).toBeInTheDocument();
    expect(finalizeMyLessonSession).not.toHaveBeenCalled();

    const confirmButtons = screen.getAllByRole("button", { name: "End lesson" });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    await waitFor(() =>
      expect(finalizeMyLessonSession).toHaveBeenCalledWith({
        sessionId: baseProps.sessionId,
        outcome: "completed",
        reason: "Ended by teacher",
      })
    );
  });

  it("2026-09-10(UI/UX 1차 리뷰 지적): 예정 종료 전 '수업 종료'를 누르면 window.confirm 없이 사유 선택 UI가 뜨고, 사유를 고르기 전에는 finalize가 호출되지 않는다", () => {
    const confirmSpy = vi.spyOn(window, "confirm");
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
    fireEvent.click(screen.getByRole("button", { name: "End lesson" }));

    expect(
      screen.getByText("It's before the scheduled end time — choose a reason for ending early")
    ).toBeInTheDocument();
    expect(screen.getByText("Student reason (left early, etc.)")).toBeInTheDocument();
    expect(screen.getByText("Teacher reason (late start, etc.)")).toBeInTheDocument();
    expect(screen.getByText("Service issue (Meet connection, etc.)")).toBeInTheDocument();
    expect(finalizeMyLessonSession).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("2026-09-10(UI/UX 1차 리뷰 지적): 조기 종료에서 '학생 사유'를 선택하고 확인하면 earlyEndReason: student_reason으로 finalize가 호출된다", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "End lesson" }));
    fireEvent.click(screen.getByText("Student reason (left early, etc.)"));

    expect(screen.getByText("End for a student reason?")).toBeInTheDocument();
    const confirmButtons = screen.getAllByRole("button", { name: "End lesson" });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() =>
      expect(finalizeMyLessonSession).toHaveBeenCalledWith({
        sessionId: baseProps.sessionId,
        outcome: "completed",
        reason: "Ended early (student reason)",
        earlyEndReason: "student_reason",
      })
    );
  });

  it("2026-09-10(UI/UX 1차 리뷰 지적): 조기 종료에서 '선생님 사유'를 선택하면 안내만 보여주고 finalize를 호출하지 않는다", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "End lesson" }));
    fireEvent.click(screen.getByText("Teacher reason (late start, etc.)"));

    expect(screen.getByText(/Same-day extension/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(finalizeMyLessonSession).not.toHaveBeenCalled();
  });

  it("2026-09-10(UI/UX 1차 리뷰 지적): 조기 종료에서 '서비스 장애'를 선택하면 안내만 보여주고 finalize를 호출하지 않는다", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "End lesson" }));
    fireEvent.click(screen.getByText("Service issue (Meet connection, etc.)"));

    expect(screen.getByText(/ask an admin/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(finalizeMyLessonSession).not.toHaveBeenCalled();
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
    expect(screen.getByText(/completed/)).toBeInTheDocument();
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
    expect(screen.queryByText("Problem Generation")).not.toBeInTheDocument();

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
    expect(screen.queryByText("Problem Generation")).not.toBeInTheDocument();
  });

  it("교재/과제/단어장 탭은 그대로고, 연습장·문제 기록 탭은 없다(2026-09-14 UAT)", () => {
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
    expect(screen.getByText("Material")).toBeInTheDocument();
    expect(screen.getAllByText("Assignments").length).toBeGreaterThan(0);
    expect(screen.getByText("Vocabulary")).toBeInTheDocument();
    expect(screen.queryByText("Practice")).not.toBeInTheDocument();
    expect(screen.queryByText("Problem History")).not.toBeInTheDocument();
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
    expect(screen.getByText("No material has been assigned to this session yet.")).toBeInTheDocument();
  });
});

// 4절 — 준비를 수업 화면 안에서 한다. 다만 **보이는 것과 적용 범위가 다르다**:
// 시작한 수업의 내용은 시작 시점에 고정됐고, 이 탭이 보여주는 것은 회차의 현재
// 구성이다. 말해주지 않으면 고정된 수업을 여기서 고치는 것처럼 보인다.
const livePrep = {
  composition: {
    layer: "student" as const,
    unitId: "u1",
    unitTitle: "이차방정식 응용 문제 (1)",
    subjectId: "sub1",
    subjectName: "SAT Math",
    scopeLabel: "지훈 학생",
    keywords: [],
    materials: [],
    subjectKeywords: [],
    hasInheritableDefaults: false,
    composed: true,
    hasUnappliedChanges: false,
    outdatedVersionCount: 0,
    parentPendingCount: 0,
    problems: [],
    goal: null,
  },
  pickable: [],
  problems: [],
};

describe("SessionShell — 수업 준비 탭", () => {
  const prep = {
    composition: {
      layer: "student" as const,
      unitId: "u1",
      unitTitle: "이차방정식 응용 문제 (1)",
      subjectId: "sub1",
      subjectName: "SAT Math",
      scopeLabel: "지훈 학생",
      keywords: [],
      materials: [],
      subjectKeywords: [],
      hasInheritableDefaults: false,
  composed: true,
  hasUnappliedChanges: false,
  outdatedVersionCount: 0,
  parentPendingCount: 0,
  problems: [],
      goal: null,
    },
    pickable: [],
    problems: [],
  };

  it("학생에게는 준비 탭이 보이지 않는다", () => {
    render(
      <SessionShell
        {...baseProps}
        viewerRole="student"
        initialState="live"
        status="in_progress"
        scheduledAt="2026-09-03T05:00:00.000Z"
        durationMinutes={30}
        prep={prep}
      />
    );
    expect(screen.queryByRole("button", { name: "Lesson Prep" })).not.toBeInTheDocument();
  });

  it("다룰 회차가 없으면 선생님에게도 빈 탭을 만들지 않는다", () => {
    render(
      <SessionShell
        {...baseProps}
        viewerRole="teacher"
        initialState="live"
        status="in_progress"
        scheduledAt="2026-09-03T05:00:00.000Z"
        durationMinutes={30}
        prep={null}
      />
    );
    expect(screen.queryByRole("button", { name: "Lesson Prep" })).not.toBeInTheDocument();
  });

  it("시작 전에는 적용 범위 안내를 덧붙이지 않는다", () => {
    render(
      <SessionShell
        {...baseProps}
        viewerRole="teacher"
        initialState="prep"
        status="upcoming"
        scheduledAt="2026-09-03T05:00:00.000Z"
        durationMinutes={30}
        prep={prep}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Lesson Prep" }));
    // 시작 전에는 '이미 고정된 수업을 여기서 고치는 것처럼 보이는' 안내를 붙이지
    // 않는다. 구성 설명 자체가 고정 시점을 말하는 것은 그것과 다른 이야기다.
    expect(screen.queryByText(/already started/)).not.toBeInTheDocument();
    expect(screen.queryByText(/not reflected in the locked content/)).not.toBeInTheDocument();
  });

  it("진행 중인 수업에서는 고정된 내용에 반영되지 않는다고 말한다", () => {
    render(
      <SessionShell
        {...baseProps}
        viewerRole="teacher"
        initialState="live"
        status="in_progress"
        scheduledAt="2026-09-03T05:00:00.000Z"
        durationMinutes={30}
        prep={prep}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Lesson Prep" }));
    expect(
      screen.getByText(/don't affect this lesson's content, notes, answers, or feedback/)
    ).toBeInTheDocument();
  });

  it("지난 수업에서는 고정돼 바뀌지 않는다고 말한다", () => {
    render(
      <SessionShell
        {...baseProps}
        viewerRole="teacher"
        initialState="completed"
        status="completed"
        scheduledAt="2026-09-03T05:00:00.000Z"
        durationMinutes={30}
        prep={prep}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Lesson Prep" }));
    // 적용 범위를 "앞으로의 수업"이 아니라 대상이 분명하게 쓴다.
    expect(
      screen.getByText(/apply to lessons on this session that haven't started yet/)
    ).toBeInTheDocument();
  });

  // 2026-09-14 UAT — 예약 시각 전에 이미 시작한 수업은 '진행 중'이고, 교사는 지금 구성으로 다시 고정할 수 있다.
  it("시작한(live) 수업은 예약 시각이 아직이어도 준비 중이 아니고, 수업 준비 탭에 '수업 구성 변경' 버튼이 있다", () => {
    render(
      <SessionShell
        {...baseProps}
        viewerRole="teacher"
        initialState="live"
        startedLive
        status="upcoming"
        scheduledAt="2099-01-01T00:00:00.000Z"
        durationMinutes={60}
        sessionSource="v3"
        prep={livePrep}
      />
    );
    expect(screen.queryByText(/Preparing lesson/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Lesson Prep"));
    expect(screen.getByTestId("repin-live")).toHaveTextContent("locked when it started");
    expect(screen.getByRole("button", { name: "Update lesson content" })).toBeInTheDocument();
  });

  it("시작 전 수업의 수업 준비 탭에는 '수업 구성 변경'이 없다", () => {
    render(
      <SessionShell
        {...baseProps}
        viewerRole="teacher"
        initialState="prep"
        status="upcoming"
        scheduledAt="2099-01-01T00:00:00.000Z"
        durationMinutes={60}
        sessionSource="v3"
        prep={livePrep}
      />
    );
    fireEvent.click(screen.getByText("Lesson Prep"));
    expect(screen.queryByTestId("repin-live")).not.toBeInTheDocument();
  });

  it("현재 활성 탭에는 aria-current가 붙고 다른 탭에는 붙지 않는다", () => {
    render(
      <SessionShell
        {...baseProps}
        viewerRole="student"
        initialTab="homework"
        initialState="prep"
        status="upcoming"
        scheduledAt={null}
        durationMinutes={30}
      />
    );
    expect(
      screen.getByRole("button", { name: "Assignments" })
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("button", { name: "Material" })
    ).not.toHaveAttribute("aria-current");
  });
});
