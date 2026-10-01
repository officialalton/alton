import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MockExamResultView from "./MockExamResultView";
import type { MockExamAttemptDetail, MockExamAttemptItem } from "@/lib/mock-exam/attempt-data";

vi.mock("@/lib/mock-exam/attempt-actions", () => ({ toggleMockExamSavedToPracticeAction: vi.fn(), loadMockExamAnnotationsAction: vi.fn().mockResolvedValue({ highlights: [], eliminated: [] }) }));
vi.mock("@/lib/problem-error-reports/actions", () => ({
  loadMyProblemErrorReportsAction: vi.fn().mockResolvedValue({ ok: true, value: {} }),
  submitProblemErrorReportAction: vi.fn(),
}));
const loadStrokes = vi.fn();
vi.mock("@/lib/problem-notes-actions", () => ({
  loadProblemNoteStrokesAction: (...a: unknown[]) => loadStrokes(...a),
  saveProblemNoteStrokesAction: vi.fn(),
}));
vi.mock("@/app/session/[id]/LearningText", () => ({ default: ({ text }: { text: string }) => <span>{text}</span> }));
vi.mock("@/app/session/[id]/RwStimulusView", () => ({ default: ({ passage }: { passage: string }) => <p>{passage}</p> }));
vi.mock("@/app/session/[id]/ProblemFigure", () => ({ default: () => null }));

beforeEach(() => {
  loadStrokes.mockReset();
  loadStrokes.mockResolvedValue([]);
});

const item = (id: string, section: "rw" | "math", over: Partial<MockExamAttemptItem> = {}): MockExamAttemptItem => ({
  setItemId: id, section, position: 1, problemId: `p-${id}`, satDomain: section === "rw" ? "rw_craft_structure" : "advanced_math",
  skillCode: section === "rw" ? "words_in_context" : "nonlinear_functions", difficulty: "", format: "mc", passage: null,
  question: `Question ${id}`, options: ["a", "b"], correctIndex: 0, answers: null, explanation: "한글 해설", figure: null,
  response: "1", correct: false, flagged: false, savedToPractice: false, timeSpentSeconds: null, ...over,
});
const attempt = (items: MockExamAttemptItem[], over: Partial<MockExamAttemptDetail> = {}): MockExamAttemptDetail => ({
  id: "a1", examSetId: "s1", examSetName: "Mock", difficultyTier: "standard", studentId: "stu", studentName: null, status: "graded",
  dueAt: null, startBy: null, maxAttempts: 1, attemptCount: 1, startedAt: null, submittedAt: null, gradedAt: null, rwTimeLimitMinutes: 64,
  mathTimeLimitMinutes: 70, mathCalculatorAllowed: true, mathReferenceSheetAllowed: true, timeRemainingSeconds: null, entryCount: 1,
  format: "mst", currentModule: null, items, ...over,
});
const items = [
  item("r1", "rw", { correct: true, response: "0", explanationEn: "English explanation" }),
  item("r2", "rw", { position: 2, guessed: true }),
  item("m1", "math", { correct: true, response: "0", guessed: true }),
];

describe("MockExamResultView — 서브탭·영어 UI", () => {
  it("Summary: 영어 문구, 코드 문자열 없음, 시간 기록이 없으면 0분 대신 숨긴다", () => {
    render(<MockExamResultView attempt={attempt(items)} readOnly={false} />);
    expect(screen.getByRole("tab", { name: "Summary" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Overall Accuracy")).toBeInTheDocument();
    expect(screen.getByText(/not equivalent to an official SAT \/ College Board score/)).toBeInTheDocument();
    expect(screen.getByTestId("mock-exam-overall-meta")).not.toHaveTextContent("Total time");
    expect(screen.getByTestId("mock-exam-section-rw")).not.toHaveTextContent("Time");
    expect(document.body.textContent).not.toMatch(/advanced_math|rw_craft_structure|words_in_context|분/);
  });

  it("Summary: MST 모듈 시각으로 계산한 섹션 소요 시간을 보인다", () => {
    render(<MockExamResultView attempt={attempt(items, { sectionTimeSeconds: { rw: 1800, math: 600 } })} readOnly={false} />);
    expect(screen.getByTestId("mock-exam-overall-meta")).toHaveTextContent("Total time 40 min");
    expect(screen.getByTestId("mock-exam-section-rw")).toHaveTextContent("Time 30 min");
  });

  it("Results by Domain: R&W·Math 분리, 이름을 누르면 설명 팝업, Esc 로 닫힌다", () => {
    render(<MockExamResultView attempt={attempt(items)} readOnly={false} />);
    fireEvent.click(screen.getByRole("tab", { name: "Results by Domain" }));
    const rw = screen.getByTestId("mock-exam-domain-rw");
    const math = screen.getByTestId("mock-exam-domain-math");
    expect(within(rw).getByRole("button", { name: "Craft and Structure" })).toBeInTheDocument();
    expect(within(rw).queryByText("Advanced Math")).toBeNull();
    expect(within(math).getByRole("button", { name: "Nonlinear functions" })).toBeInTheDocument();
    fireEvent.click(within(math).getByRole("button", { name: "Advanced Math" }));
    const dialog = screen.getByRole("dialog", { name: "Advanced Math" });
    expect(dialog).toHaveTextContent(/nonlinear/i);
    expect(within(dialog).getByRole("button", { name: "Close" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Review Mistakes: 필터(All/Incorrect/Guessed)와 🎲 표시", () => {
    render(<MockExamResultView attempt={attempt(items)} readOnly={false} />);
    fireEvent.click(screen.getByRole("tab", { name: "Review Mistakes" }));
    expect(screen.getByTestId("review-guessed-r2")).toBeInTheDocument();
    expect(screen.queryByTestId("review-guessed-r1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Incorrect" }));
    expect(screen.queryByTestId("review-item-r1")).toBeNull();
    expect(screen.getByTestId("review-item-r2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guessed" }));
    expect(screen.getByTestId("review-item-m1")).toBeInTheDocument();
    expect(screen.queryByTestId("review-item-r1")).toBeNull();
    // 필터 첫 문항이 자동 선택된다
    expect(screen.getByTestId("mock-exam-item-detail")).toHaveTextContent("Question r2");
  });

  it("해설: 영어 기본 + 한국어 토글, 영어가 없으면 한글 + 안내", () => {
    render(<MockExamResultView attempt={attempt(items)} readOnly={false} />);
    fireEvent.click(screen.getByRole("tab", { name: "Review Mistakes" }));
    const panel = screen.getByTestId("mock-exam-explanation-panel");
    expect(panel).toHaveTextContent("English explanation");
    expect(within(panel).getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(panel).getByRole("button", { name: "한국어" }));
    expect(panel).toHaveTextContent("한글 해설");
    fireEvent.click(screen.getByTestId("review-item-r2"));
    expect(screen.getByTestId("mock-exam-explanation-panel")).toHaveTextContent("한글 해설");
    expect(screen.getByTestId("mock-exam-explanation-en-missing")).toHaveTextContent("English explanation not available yet");
  });

  it("필기: 결과 화면은 읽기 전용 스냅샷만 — 필기가 없으면 숨기고, 있으면 그리기·지우기 버튼 없이 보인다", async () => {
    loadStrokes.mockResolvedValueOnce([]);
    const v = render(<MockExamResultView attempt={attempt(items)} readOnly={false} />);
    fireEvent.click(screen.getByRole("tab", { name: "Review Mistakes" }));
    await waitFor(() => expect(loadStrokes).toHaveBeenCalledWith("mock_exam", "a1", "r1", undefined));
    expect(screen.queryByTestId("problem-note-snapshot")).toBeNull();
    v.unmount();
    loadStrokes.mockResolvedValue([{ x0: 0, y0: 0, x1: 5, y1: 5, color: "#000", w: 640 }]);
    render(<MockExamResultView attempt={attempt(items)} readOnly={false} />);
    fireEvent.click(screen.getByRole("tab", { name: "Review Mistakes" }));
    expect(await screen.findByTestId("problem-note-snapshot")).toHaveTextContent("My scratch work (submitted)");
    expect(screen.queryByRole("button", { name: /whiteboard|Clear|화이트보드|지우기/i })).toBeNull();
  });
});
