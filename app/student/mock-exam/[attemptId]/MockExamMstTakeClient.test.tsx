import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MstAttemptState, MstItem, MstModuleState } from "@/lib/mock-exam/mst-actions";

const saveMock = vi.fn();
const flagMock = vi.fn();
const savedMock = vi.fn();
const guessMock = vi.fn();
const startMock = vi.fn();
const submitMock = vi.fn();
const loadMock = vi.fn();
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock("@/lib/mock-exam/attempt-actions", () => ({
  saveMockExamAnswerAction: (...a: unknown[]) => saveMock(...a),
  toggleMockExamFlagAction: (...a: unknown[]) => flagMock(...a),
  toggleMockExamSavedToPracticeAction: (...a: unknown[]) => savedMock(...a),
  toggleMockExamGuessedAction: (...a: unknown[]) => guessMock(...a),
}));
vi.mock("@/lib/mock-exam/mst-actions", () => ({
  startMstAttemptAction: (a: unknown) => startMock(a),
  submitMstModuleAction: (a: unknown, m: unknown) => submitMock(a, m),
  loadMstAttemptStateAction: (a: unknown) => loadMock(a),
}));
vi.mock("@/app/session/[id]/MockExamMathTools", () => ({
  default: ({ open }: { open: string | null }) => (open ? <div data-testid="math-tools-panel">{open}</div> : null),
  MockExamToolButtons: ({ onToggle }: { onToggle: (w: "calculator" | "reference") => void }) => (
    <button type="button" onClick={() => onToggle("calculator")}>
      Calculator
    </button>
  ),
  SprDirections: () => <div data-testid="spr-directions" />,
}));
vi.mock("@/app/session/[id]/LearningText", () => ({ default: ({ text }: { text: string }) => <span>{text}</span> }));
vi.mock("@/app/session/[id]/RwStimulusView", () => ({ default: ({ passage }: { passage: string }) => <p>{passage}</p> }));
vi.mock("@/app/session/[id]/ProblemFigure", () => ({ default: () => null }));

function mod(moduleKey: MstModuleState["moduleKey"], remainingSeconds: number | null, position = 1): MstModuleState {
  return { moduleKey, position, timeLimitSeconds: 1920, itemCount: 2, startedAt: "x", endsAt: "y", locked: false, remainingSeconds };
}
function item(id: string, seq: number, moduleKey: MstItem["moduleKey"], format: "mc" | "spr" = "mc"): MstItem {
  return {
    setItemId: id, section: moduleKey.startsWith("rw") ? "rw" : "math", position: seq, moduleKey, moduleSeq: seq, problemId: "p" + id,
    satDomain: "algebra", skillCode: null, difficulty: "medium", format, passage: null, question: `Q${seq}?`,
    options: format === "mc" ? ["A1", "B1", "C1", "D1"] : null, figure: null, correctIndex: null, answers: null, explanation: null,
    response: null, correct: null, flagged: false, savedToPractice: false, timeSpentSeconds: null,
  };
}
function state(over: Partial<MstAttemptState> = {}): MstAttemptState {
  return {
    attemptId: "att1", status: "in_progress", currentModule: "rw_m1", serverNow: new Date().toISOString(),
    modules: [mod("rw_m1", 1900), mod("rw_m2", null, 2)],
    items: [item("i1", 1, "rw_m1"), item("i2", 2, "rw_m1", "spr")],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  saveMock.mockResolvedValue({ ok: true });
  flagMock.mockResolvedValue({ ok: true });
  submitMock.mockResolvedValue({ ok: true, value: state({ currentModule: "rw_m2", modules: [ { ...mod("rw_m1", 0), locked: true }, mod("rw_m2", 1920, 2)], items: [item("i3", 1, "rw_m2")] }) });
});
afterEach(() => vi.useRealTimers());

async function renderClient(s = state()) {
  const m = await import("./MockExamMstTakeClient");
  return render(<m.default initialState={s} examSetName="세트" mathCalculatorAllowed mathReferenceSheetAllowed={false} />);
}

describe("MockExamMstTakeClient", () => {
  it("🎲 찍음 표시: 화살표 옆 버튼으로 토글하고, 실패하면 되돌린다", async () => {
    guessMock.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: "이미 제출된 모듈에는 표시를 바꿀 수 없습니다." });
    loadMock.mockResolvedValue({ ok: false, error: "x" });
    await renderClient();
    const btn = screen.getByRole("button", { name: "Mark as guess" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(guessMock).toHaveBeenCalledWith("att1", "i1", true);
    expect(btn).toHaveAttribute("aria-pressed", "true");
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(guessMock).toHaveBeenLastCalledWith("att1", "i1", false);
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("답 없이 Guessed 만 눌러 둔 채 다음 문항으로 넘어가면 표시가 자동 해제된다", async () => {
    guessMock.mockResolvedValue({ ok: true });
    await renderClient(state({ items: [{ ...item("i1", 1, "rw_m1"), guessed: true }, item("i2", 2, "rw_m1")] }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    });
    expect(guessMock).toHaveBeenCalledWith("att1", "i1", false);
  });

  it("번호 격자: 답을 고르고 Guessed 한 문항은 왼쪽 위 주황 점이 보인다", async () => {
    await renderClient(state({ items: [{ ...item("i1", 1, "rw_m1"), guessed: true, response: "0" }, { ...item("i2", 2, "rw_m1"), guessed: true }] }));
    expect(screen.getByTestId("mst-guessed-dot-i1")).toBeInTheDocument();
    expect(screen.queryByTestId("mst-guessed-dot-i2")).toBeNull();
  });

  it("서버가 준 guessed 를 초기값으로 복구한다", async () => {
    await renderClient(state({ items: [{ ...item("i1", 1, "rw_m1"), guessed: true }] }));
    expect(screen.getByRole("button", { name: "Mark as guess" })).toHaveAttribute("aria-pressed", "true");
  });

  it("시작 화면 → 시험 시작 → 첫 모듈", async () => {
    startMock.mockResolvedValue({ ok: true, value: state() });
    await renderClient(state({ status: "assigned", currentModule: null, modules: [], items: [] }));
    expect(screen.getAllByText(/27 questions/).length).toBe(2);
    await act(async () => {
      fireEvent.click(screen.getByTestId("mst-start"));
    });
    expect(startMock).toHaveBeenCalledWith("att1");
    expect(screen.getByTestId("mst-module-label")).toHaveTextContent("Reading and Writing · Module 1");
  });

  it("문항 이동·답 저장·검토 표시·번호 네비", async () => {
    await renderClient();
    expect(screen.getByText("Q1?")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: /B1/ }));
    });
    expect(saveMock).toHaveBeenCalledWith("att1", "i1", "1");
    expect(screen.getByLabelText("Question 1, answered")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mark for Review" }));
    });
    expect(flagMock).toHaveBeenCalledWith("att1", "i1", true);
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    expect(screen.getByText("Q2?")).toBeInTheDocument();
    expect(screen.getByTestId("mst-spr-input")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous question" }));
    expect(screen.getByText("Q1?")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/^Question 2/));
    expect(screen.getByText("Q2?")).toBeInTheDocument();
  });

  it("문제 저장 💾: 눌러 저장/해제하고 실패하면 되돌린다, 마지막 문항은 Submit Module 로 바뀐다", async () => {
    savedMock.mockResolvedValueOnce({ ok: true, value: undefined });
    await renderClient();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save question" }));
    });
    expect(savedMock).toHaveBeenCalledWith("att1", "i1", true);
    expect(screen.getByRole("button", { name: "Remove from saved questions" })).toHaveAttribute("aria-pressed", "true");
    savedMock.mockResolvedValueOnce({ ok: false, error: "저장 실패" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove from saved questions" }));
    });
    expect(screen.getByRole("button", { name: "Remove from saved questions" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    expect(screen.queryByRole("button", { name: "Next question" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("mst-submit-last"));
    expect(screen.getByRole("dialog")).toHaveTextContent("Submit this module?");
  });

  it("R&W에는 계산기가 없고 Math에는 있다", async () => {
    const { unmount } = await renderClient();
    expect(screen.queryByText("Calculator")).not.toBeInTheDocument();
    unmount();
    await renderClient(state({ currentModule: "math_m1", modules: [mod("math_m1", 2000, 4)], items: [item("m1", 1, "math_m1")] }));
    fireEvent.click(screen.getByText("Calculator"));
    expect(screen.getByTestId("math-tools-panel")).toHaveTextContent("calculator");
  });

  it("모듈 제출은 확인 모달을 거치고 현재 모듈 키를 서버에 보낸다", async () => {
    await renderClient();
    fireEvent.click(screen.getByTestId("mst-submit-module"));
    expect(screen.getByRole("dialog")).toHaveTextContent("0 of 2 questions answered");
    await act(async () => {
      fireEvent.click(screen.getByTestId("mst-submit-confirm"));
    });
    expect(submitMock).toHaveBeenCalledWith("att1", "rw_m1");
    expect(screen.getByTestId("mst-module-label")).toHaveTextContent("Module 2");
  });

  it("타이머가 0이 되면 한 번만 자동 제출한다", async () => {
    vi.useFakeTimers();
    await renderClient(state({ modules: [mod("rw_m1", 2)] }));
    expect(screen.getByTestId("mst-timer")).toHaveTextContent("0:02");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });
    expect(submitMock).toHaveBeenCalledTimes(1);
  });

  it("잠긴 모듈 저장 거부 시 서버 상태로 복구한다", async () => {
    saveMock.mockResolvedValue({ ok: false, error: "이미 제출된 모듈에는 답안을 저장할 수 없습니다." });
    loadMock.mockResolvedValue({ ok: true, value: state({ currentModule: "rw_m2", modules: [mod("rw_m2", 1000, 2)], items: [item("i3", 1, "rw_m2")] }) });
    await renderClient();
    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: /A1/ }));
    });
    expect(loadMock).toHaveBeenCalledWith("att1");
    expect(screen.getByTestId("mst-module-label")).toHaveTextContent("Module 2");
  });

  it("휴식 화면: 카운트다운 + 시험 재개 → break 제출; 완료(graded)면 refresh", async () => {
    submitMock.mockResolvedValue({ ok: true, value: state({ status: "graded", currentModule: "math_m2", items: [] }) });
    await renderClient(state({ currentModule: "break", modules: [mod("break", 600, 3)], items: [] }));
    expect(screen.getByTestId("mst-timer")).toHaveTextContent("10:00");
    await act(async () => {
      fireEvent.click(screen.getByTestId("mst-resume"));
    });
    expect(submitMock).toHaveBeenCalledWith("att1", "break");
    expect(refreshMock).toHaveBeenCalled();
    expect(document.body.textContent).not.toMatch(/higher|lower|고난도/i);
  });
});
