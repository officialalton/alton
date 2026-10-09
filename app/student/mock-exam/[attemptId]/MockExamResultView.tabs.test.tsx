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
    expect(screen.getByText("Overall Performance")).toBeInTheDocument();
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

  it("Results by Domain(시각화): 영역마다 막대·상태 글자·n/m(p%) 글자, 약한 스킬은 약한 순으로 첫 행 강조 + 다음 행동 안내", () => {
    render(<MockExamResultView attempt={attempt(items)} readOnly={false} />);
    fireEvent.click(screen.getByRole("tab", { name: "Results by Domain" }));
    const rw = screen.getByTestId("mock-exam-domain-rw");
    expect(within(rw).getAllByRole("meter").length).toBeGreaterThan(0);
    expect(within(rw).getAllByText(/\d+\/\d+ \(\d+%\)/).length).toBeGreaterThan(0);
    expect(within(rw).getAllByText(/Needs work|Fair|Strong|No data/).length).toBeGreaterThan(0);
    const weak = screen.queryAllByTestId("mock-exam-weak-skills");
    for (const w of weak) { expect(within(w).getByTestId("mock-exam-weak-next-step")).toHaveTextContent("Next step: review the questions you missed"); const first = w.querySelector("li")!; expect(first.className).toMatch(/border-red/); }
  });

  it("Review Mistakes: 필터 없이 R&W 먼저 나열하고, 번호·Guessed·정오 칸이 있다", () => {
    render(<MockExamResultView attempt={attempt(items)} readOnly={false} />);
    fireEvent.click(screen.getByRole("tab", { name: "Review Mistakes" }));
    expect(screen.queryByRole("button", { name: "Incorrect" })).toBeNull();
    expect(screen.getByTestId("review-guessed-r2")).toBeInTheDocument();
    expect(screen.queryByTestId("review-guessed-r1")).toBeNull();
    const rows = screen.getAllByTestId(/^review-item-/).map((el) => el.getAttribute("data-testid"));
    expect(rows.findIndex((x) => x === "review-item-m1")).toBeGreaterThan(rows.findIndex((x) => x === "review-item-r2"));
    expect(screen.getByTestId("review-item-r1")).toHaveTextContent(/R&W 1/);
    expect(screen.getByTestId("review-mark-r1")).toHaveTextContent("O");
    expect(screen.getByTestId("review-mark-r2")).toHaveTextContent("X");
    expect(screen.getByTestId("review-item-r1")).not.toHaveTextContent("Correct");
    expect(screen.getByTestId("mock-exam-item-detail")).toHaveTextContent("Question r1");
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
    // 오른쪽 패널에서 해설보다 위에 놓인다.
    const panel = screen.getByTestId("mock-exam-explanation-panel");
    const snap = within(panel).getByTestId("problem-note-snapshot");
    const expl = within(panel).getByTestId("mock-exam-explanation");
    expect(snap.compareDocumentPosition(expl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Summary(재설계): 도넛·Section Breakdown·Performance by Domain (Preview)·Key Insights, View all 은 Results by Domain 으로 이동", () => {
    render(<MockExamResultView attempt={attempt(items)} readOnly={false} />);
    expect(screen.getByTestId("mock-exam-donut")).toBeInTheDocument();
    expect(screen.getByText("Section Breakdown")).toBeInTheDocument();
    const preview = screen.getByTestId("mock-exam-domain-preview");
    expect(preview).toHaveTextContent("Performance by Domain (Preview)");
    expect(screen.getByTestId("mock-exam-insights")).toBeInTheDocument();
    fireEvent.click(within(preview).getByRole("button", { name: "View all" }));
    expect(screen.getByRole("tab", { name: "Results by Domain" })).toHaveAttribute("aria-selected", "true");
  });

  it("응답이 임계값(80%) 미만이면 범위 자리에 정해진 문구만 보이고 결과·정오 분석은 그대로다(학생·학부모 읽기 전용 동일)", () => {
    for (const readOnly of [false, true]) {
      const { unmount } = render(<MockExamResultView attempt={attempt(items, { scoreEstimate: null, scoreEstimateNote: "insufficient_responses" })} readOnly={readOnly} />);
      const box = screen.getByTestId("mock-exam-score-estimate-insufficient");
      expect(box).toHaveTextContent("Not enough responses to estimate a score range.");
      expect(box).toHaveTextContent("Internal estimate — accuracy not verified");
      expect(screen.queryByTestId("mock-exam-score-estimate")).toBeNull();
      expect(screen.getByTestId("mock-exam-donut")).toBeInTheDocument(); // 결과·분석은 그대로
      unmount();
    }
  });
  it("고정형은 임계값 문구가 나오지 않는다(범위 자체가 없음)", () => {
    render(<MockExamResultView attempt={attempt(items, { format: "fixed", scoreEstimate: null, scoreEstimateNote: "insufficient_responses" })} readOnly={false} />);
    expect(screen.queryByTestId("mock-exam-score-estimate-insufficient")).toBeNull();
  });

  it("예상 점수: 내부 추정·비공식 문구, R&W/Math/Total 막대", () => {
    const scoreEstimate = { rw: { low: 500, high: 560 }, math: { low: 600, high: 660 }, total: { low: 1100, high: 1220 }, modelVersion: "v1-adaptive" };
    render(<MockExamResultView attempt={attempt(items, { scoreEstimate })} readOnly={false} />);
    const box = screen.getByTestId("mock-exam-score-estimate");
    expect(box).toHaveTextContent("Internal estimate — accuracy not verified; not an official College Board score");
    expect(within(box).getByTestId("mock-exam-score-total")).toHaveTextContent("1100-1220");
    expect(within(box).getByTestId("mock-exam-score-rw")).toHaveTextContent("500-560");
  });

  it("재응시: 회차가 둘 이상이면 Attempt 1 | Attempt 2 전환을 보이고 최신 표시, 다른 회차를 누르면 콜백", () => {
    const sum = (id: string, no: number, correct: number) => ({
      id, examSetId: "s1", examSetName: "Mock", difficultyTier: "standard", studentId: "stu", studentName: null, status: "graded" as const, assignedByName: null,
      dueAt: null, startBy: null, startedAt: null, submittedAt: null, gradedAt: null, totalCount: 3, correctCount: correct, entryCount: 1, attemptNo: no, attemptTotal: 2, setGroupId: "g1",
    });
    const onSelect = vi.fn();
    render(<MockExamResultView attempt={attempt(items, { id: "a2", attemptNo: 2, attemptTotal: 2 })} readOnly={false} attempts={[sum("a1", 1, 1), sum("a2", 2, 2)]} onSelectAttempt={onSelect} />);
    const sw = screen.getByTestId("attempt-switcher");
    expect(within(sw).getByText("Attempt 2 (latest)")).toHaveAttribute("aria-current", "true");
    fireEvent.click(within(sw).getByRole("button", { name: "Attempt 1" }));
    expect(onSelect).toHaveBeenCalledWith("a1");
    expect(screen.getByTestId("mock-exam-insight-progress")).toHaveTextContent("Compared with Attempt 1");
  });

  it("회차가 하나뿐이면 전환·라벨을 그리지 않는다", () => {
    render(<MockExamResultView attempt={attempt(items)} readOnly={false} />);
    expect(screen.queryByTestId("attempt-switcher")).toBeNull();
    expect(screen.queryByTestId("attempt-label")).toBeNull();
  });
});
