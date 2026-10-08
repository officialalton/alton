import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockExamAttemptDetail, MockExamAttemptItem } from "@/lib/mock-exam/attempt-data";

const save = vi.fn();
const submit = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/mock-exam/attempt-actions", () => ({
  saveMockExamAnswerAction: (...a: unknown[]) => save(...a),
  saveMockExamSectionTimeAction: vi.fn(async () => ({ ok: true, value: undefined })),
  submitMockExamAttemptAction: (...a: unknown[]) => submit(...a),
  toggleMockExamFlagAction: vi.fn(async () => ({ ok: true, value: undefined })),
  toggleMockExamSavedToPracticeAction: vi.fn(async () => ({ ok: true, value: undefined })),
  recordMockExamEntryAction: vi.fn(async () => ({ ok: true, value: undefined })),
}));
vi.mock("@/app/session/[id]/MockExamMathTools", () => ({ default: () => null, MockExamToolButtons: () => <span data-testid="calc-buttons" /> }));
vi.mock("@/app/components/ProblemErrorReportButton", () => ({ default: () => <button type="button">Report a problem</button> }));
vi.mock("@/app/components/ProblemNoteCanvas", () => ({ default: () => null }));
vi.mock("@/lib/problem-error-reports/actions", () => ({ loadMyProblemErrorReportsAction: vi.fn(async () => ({ ok: true, value: {} })), submitProblemErrorReportAction: vi.fn() }));

import ApExamTakeClient from "./ApExamTakeClient";
import ApExamResultView from "./ApExamResultView";

const item = (id: string, section: string, over: Partial<MockExamAttemptItem> = {}): MockExamAttemptItem => ({
  setItemId: id, section: section as "rw", position: 1, problemId: `p-${id}`, satDomain: "ap:1.1", skillCode: null, difficulty: "medium", format: "mc", passage: null,
  question: `Question text ${id}`, options: ["Alpha", "Beta", "Gamma", "Delta"], optionCount: 4, correctIndex: null, answers: null, explanation: null, figure: null,
  response: null, correct: null, flagged: false, savedToPractice: false, timeSpentSeconds: null, ...over,
});
const frqParts = [{ label: "a", points: 2, prompt: "Explain the result.", mode: "explain" }, { label: "b", points: 1, prompt: "Calculate the rate.", mode: "calculate" }];
const layout = [
  { key: "ap_mc_a", kind: "mc" as const, label: "Part A (no calculator)", minutes: 62, count: 2, calculator: "not_allowed" as const, options: 4 },
  { key: "ap_mc_b", kind: "mc" as const, label: "Part B (graphing calculator)", minutes: 38, count: 1, calculator: "required" as const, options: 4 },
  { key: "ap_frq", kind: "frq" as const, label: "Section II", minutes: 90, count: 1, calculator: "allowed" as const },
];
const base = (items: MockExamAttemptItem[], over: Partial<MockExamAttemptDetail> = {}): MockExamAttemptDetail => ({
  id: "att1", examSetId: "s1", examSetName: "AP Calculus AB Full Practice 1", difficultyTier: "standard", studentId: "u", studentName: null, status: "in_progress",
  dueAt: null, startBy: null, maxAttempts: 1, attemptCount: 0, startedAt: null, submittedAt: null, gradedAt: null, rwTimeLimitMinutes: 0, mathTimeLimitMinutes: 0,
  mathCalculatorAllowed: false, mathReferenceSheetAllowed: false, timeRemainingSeconds: null, entryCount: 1, format: "fixed", currentModule: null, items,
  examProgram: "ap", apSubject: "ap_calculus_ab", apLabel: "full_practice", sectionLayout: layout, ...over,
});

beforeEach(() => { save.mockReset(); save.mockResolvedValue({ ok: true, value: undefined }); submit.mockReset(); vi.useFakeTimers({ shouldAdvanceTime: true }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("ApExamTakeClient", () => {
  const items = [item("m1", "ap_mc_a"), item("m2", "ap_mc_a"), item("m3", "ap_mc_b", { options: ["V", "W", "X", "Y", "Z"], optionCount: 5 }), item("f1", "ap_frq", { format: "essay", options: null, optionCount: null, parts: frqParts })];

  it("공식 섹션 시간·계산기 규칙·'일시정지 불가' 안내를 보여 준다", async () => {
    render(<ApExamTakeClient attempt={base(items)} />);
    expect(screen.getByTestId("ap-exam-timer")).toHaveTextContent("62:00");
    expect(screen.getByTestId("ap-section-rules")).toHaveTextContent("No calculator");
    expect(screen.getByTestId("ap-section-rules")).toHaveTextContent("cannot be paused");
    await act(async () => { fireEvent.click(screen.getByTestId("ap-section-ap_mc_b")); });
    expect(screen.getByTestId("ap-section-rules")).toHaveTextContent("Graphing calculator required");
    expect(screen.getByTestId("ap-exam-timer")).toHaveTextContent("38:00");
    expect(screen.getByTestId("calc-buttons")).toBeInTheDocument();
  });
  it("MC 선택지는 4개 또는 5개이고 선택하면 저장한다; 정답·해설 DOM 이 없다", async () => {
    render(<ApExamTakeClient attempt={base(items)} />);
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    await act(async () => { fireEvent.click(screen.getByTestId("ap-option-1")); });
    expect(save).toHaveBeenCalledWith("att1", "m1", "1", expect.anything());
    expect(screen.queryByText(/Correct answer|Explanation|Reference answer/)).toBeNull();
    await act(async () => { fireEvent.click(screen.getByTestId("ap-section-ap_mc_b")); });
    expect(screen.getAllByRole("radio")).toHaveLength(5);
  });
  it("FRQ: 파트별 타이핑 입력 + 자동 저장(디바운스), 제출 전 참고 답안 없음", async () => {
    render(<ApExamTakeClient attempt={base(items)} />);
    await act(async () => { fireEvent.click(screen.getByTestId("ap-section-ap_frq")); });
    expect(screen.getByTestId("frq-input-a")).toBeInTheDocument();
    expect(screen.getByTestId("frq-input-b")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("frq-input-a"), { target: { value: "Because the rate increases." } });
    expect(save).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1300); });
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(JSON.parse(save.mock.calls[0][2] as string)).toEqual({ a: "Because the rate increases." });
    expect(screen.queryByText(/not official scoring/)).toBeNull();
  });
  it("제출 전 확인 창에서 제출하고 결과 화면(채점된 상세)으로 바뀐다", async () => {
    const graded = base([item("m1", "ap_mc_a", { response: "1", correct: true, correctIndex: 1, explanation: "Because Beta." })], { status: "graded" });
    submit.mockResolvedValue({ ok: true, value: { attempt: graded } });
    render(<ApExamTakeClient attempt={base([item("m1", "ap_mc_a")])} />);
    await act(async () => { fireEvent.click(screen.getByTestId("ap-review-submit")); });
    await act(async () => { fireEvent.click(screen.getByTestId("ap-exam-submit")); });
    await waitFor(() => expect(screen.getByTestId("ap-exam-result")).toBeInTheDocument());
  });
});

describe("ApExamResultView", () => {
  const graded = base([
    item("m1", "ap_mc_a", { response: "1", correct: true, correctIndex: 1, explanation: "Because Beta.", satDomain: "ap:1.1" }),
    item("m2", "ap_mc_a", { response: "0", correct: false, correctIndex: 2, explanation: "Gamma is right.", satDomain: "ap:2.3" }),
    item("f1", "ap_frq", { format: "essay", options: null, parts: frqParts, response: JSON.stringify({ a: "My explanation", b: "42" }), explanation: "Reference answer and scoring notes (not official College Board scoring). (a) ..." }),
  ], { status: "graded", apLabel: "full_practice" });
  it("MC 점수·토픽별 약점, FRQ 는 점수 없이 비공식 참고 답안, AP 1–5 점수 없음", () => {
    render(<ApExamResultView attempt={graded} />);
    expect(screen.getByTestId("ap-mc-score")).toHaveTextContent("1 / 2");
    expect(screen.getByText(/AP scores \(1–5\) are not estimated/)).toBeInTheDocument();
    expect(screen.getByText("Topic 2.3")).toBeInTheDocument();
    expect(screen.getByTestId("frq-answer-a")).toHaveTextContent("My explanation");
    expect(screen.getByText("Reference answer (not official scoring)")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Report a problem" }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Full Practice Exam/)).toBeInTheDocument();
  });
  it("Missed 필터는 틀린 MC 만 보인다", () => {
    render(<ApExamResultView attempt={graded} />);
    fireEvent.click(screen.getByRole("tab", { name: "Missed" }));
    expect(screen.getAllByTestId("ap-review-item")).toHaveLength(1);
  });
});
