import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MockExamResultView from "./MockExamResultView";
import type { MockExamAttemptDetail, MockExamAttemptItem } from "@/lib/mock-exam/attempt-data";
import { computeMockExamReport } from "@/lib/mock-exam/report";
import { estimateScore } from "@/lib/mock-exam/score-estimate";

vi.mock("@/lib/mock-exam/attempt-actions", () => ({ toggleMockExamSavedToPracticeAction: vi.fn() }));
const mine = vi.fn();
vi.mock("@/lib/problem-error-reports/actions", () => ({
  loadMyProblemErrorReportsAction: (...a: unknown[]) => mine(...a),
  submitProblemErrorReportAction: vi.fn(),
}));
vi.mock("@/app/components/ProblemNoteCanvas", () => ({ default: () => null }));

beforeEach(() => {
  mine.mockReset();
  mine.mockResolvedValue({ ok: true, value: {} });
});

const item = (n: number, section: "rw" | "math", over: Partial<MockExamAttemptItem> = {}): MockExamAttemptItem => ({
  setItemId: `i${section}${n}`, section, position: n, problemId: `p${section}${n}`, satDomain: "algebra", skillCode: null, difficulty: "",
  format: "mc", passage: null, question: `문항 ${section}${n}`, options: ["a", "b"], correctIndex: 0, answers: null, explanation: null,
  figure: null, response: "1", correct: false, flagged: false, savedToPractice: false, timeSpentSeconds: 10, ...over,
});
const attempt = (items: MockExamAttemptItem[], over: Partial<MockExamAttemptDetail> = {}): MockExamAttemptDetail => ({
  id: "a1", examSetId: "s1", examSetName: "모의", difficultyTier: "standard", studentId: "stu", studentName: "학생", status: "graded",
  dueAt: null, startBy: null, maxAttempts: 1, attemptCount: 1, startedAt: null, submittedAt: null, gradedAt: null, rwTimeLimitMinutes: 64,
  mathTimeLimitMinutes: 70, mathCalculatorAllowed: true, mathReferenceSheetAllowed: true, timeRemainingSeconds: null, entryCount: 1,
  format: "mst", currentModule: null, items, ...over,
});
const items = [
  item(1, "rw", { correct: true, response: "0" }),
  item(2, "rw", { correct: true, adjusted: true, originalCorrect: false }),
  item(1, "math", { correct: true, response: "0" }),
  item(2, "math", { correct: false }),
];

describe("MockExamResultView — 문항 오류 조정", () => {
  it("조정된 응시는 안내 문구를 보이고 예상 점수 범위는 조정된(correct) 기준으로 계산된다", () => {
    const routes = { rw: "higher", math: "lower" } as const;
    const adjusted = estimateScore(computeMockExamReport(items).bySection, routes)!;
    const original = estimateScore(computeMockExamReport(items.map((i) => (i.adjusted ? { ...i, correct: false } : i))).bySection, routes)!;
    render(<MockExamResultView attempt={attempt(items, { scoreAdjusted: true, scoreEstimate: adjusted })} readOnly={false} />);
    expect(screen.getByTestId("mock-exam-score-adjusted")).toHaveTextContent("문항 오류로 점수가 조정되었습니다");
    // R&W 2/2 → 조정 전(1/2)과 다른 범위
    expect(adjusted.rw.high).toBeGreaterThan(original.rw.high);
    expect(screen.getByTestId("mock-exam-score-estimate")).toHaveTextContent(`${adjusted.rw.low}-${adjusted.rw.high}`);
  });

  it("조정이 없으면 안내 문구가 없다", () => {
    render(<MockExamResultView attempt={attempt(items, { scoreAdjusted: false })} readOnly={false} />);
    expect(screen.queryByTestId("mock-exam-score-adjusted")).toBeNull();
  });

  it("학생·선생님 결과에는 신고 버튼, 학부모(읽기 전용)에는 없다", async () => {
    const s = render(<MockExamResultView attempt={attempt(items)} readOnly={false} />);
    fireEvent.click(screen.getByTestId("review-item-irw2"));
    expect(screen.getByRole("button", { name: "문제 오류 신고" })).toBeInTheDocument();
    expect(screen.getByTestId("mock-exam-item-adjusted")).toHaveTextContent("정답 처리");
    await waitFor(() => expect(mine).toHaveBeenCalled());
    s.unmount();
    mine.mockClear();
    const t = render(<MockExamResultView attempt={attempt(items)} readOnly reportRole="teacher" />);
    fireEvent.click(screen.getByTestId("review-item-irw1"));
    expect(screen.getByRole("button", { name: "문제 오류 신고" })).toBeInTheDocument();
    t.unmount();
    mine.mockClear();
    render(<MockExamResultView attempt={attempt(items)} readOnly />);
    fireEvent.click(screen.getByTestId("review-item-irw1"));
    expect(screen.queryByRole("button", { name: "문제 오류 신고" })).toBeNull();
    expect(mine).not.toHaveBeenCalled();
  });
});
