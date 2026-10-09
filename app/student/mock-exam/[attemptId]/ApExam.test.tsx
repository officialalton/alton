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
  enterApSectionAction: vi.fn(async () => ({ ok: true, value: { remaining: {} } })),
  settleApAttemptAction: vi.fn(async () => ({ ok: true, value: { status: "in_progress", attempt: null } })),
}));
vi.mock("@/app/session/[id]/MockExamMathTools", () => ({ default: () => null, MockExamToolButtons: () => <span data-testid="calc-buttons" /> }));
vi.mock("@/app/components/ProblemErrorReportButton", () => ({ default: () => <button type="button">Report a problem</button> }));
vi.mock("@/app/components/ProblemNoteCanvas", () => ({ default: () => null }));
vi.mock("@/lib/problem-error-reports/actions", () => ({ loadMyProblemErrorReportsAction: vi.fn(async () => ({ ok: true, value: {} })), submitProblemErrorReportAction: vi.fn() }));

import ApExamTakeClient from "./ApExamTakeClient";
import ApExamResultView from "./ApExamResultView";
import { RAW_TEX_TOKENS } from "@/lib/ap-exam/explanation-math";
import { AP_LAYOUTS } from "@/lib/ap-exam/layouts";

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
    // 이 테스트의 레이아웃은 공식 구성이 아니므로 label 이 full_practice 여도 "Full Practice Exam" 을 보이지 않는다.
    expect(screen.getByTestId("ap-badge")).toHaveTextContent("Practice Set");
    expect(screen.queryByText(/Full Practice Exam/)).toBeNull();
  });
  it("Missed 필터는 틀린 MC 만 보인다", () => {
    render(<ApExamResultView attempt={graded} />);
    fireEvent.click(screen.getByRole("tab", { name: "Missed" }));
    expect(screen.getAllByTestId("ap-review-item")).toHaveLength(1);
  });
});

describe("부분 연습 세트: 제목·배지·시작 안내가 같은 뜻", () => {
  const off = (keys: string[]) => AP_LAYOUTS.ap_calculus_ab.filter((x) => keys.includes(x.key));
  const part = (keys: string[], name: string, label: "mc_practice" | "frq_practice", items: MockExamAttemptItem[]) => base(items, { examSetName: name, apLabel: label, sectionLayout: off(keys) });
  it("Non-Calculator: 배지·안내(Part A, 29문항, 62분, 계산기 없음)", () => {
    render(<ApExamTakeClient attempt={part(["ap_mc_a"], "AP Calculus AB — Non-Calculator Practice", "mc_practice", [item("a1", "ap_mc_a")])} />);
    expect(screen.getByTestId("ap-badge")).toHaveTextContent("Non-Calculator Practice");
    expect(screen.getByTestId("ap-set-guidance")).toHaveTextContent("Section I, Part A: 29 multiple-choice questions in 62 minutes. No calculator is allowed.");
    expect(screen.queryByText(/Full Practice Exam/)).toBeNull();
  });
  it("Calculator: Part B, 13문항, 38분, 그래핑 계산기 필수", () => {
    render(<ApExamTakeClient attempt={part(["ap_mc_b"], "AP Calculus AB — Calculator Practice", "mc_practice", [item("b1", "ap_mc_b")])} />);
    expect(screen.getByTestId("ap-badge")).toHaveTextContent("Calculator Practice");
    expect(screen.getByTestId("ap-set-guidance")).toHaveTextContent("Section I, Part B: 13 multiple-choice questions in 38 minutes. A graphing calculator is required.");
  });
  it("Free-Response: 파트별 계산기 허용 여부와 문항 수·시간", () => {
    const frq = item("f1", "ap_frq_a", { format: "essay", options: null, parts: frqParts });
    render(<ApExamTakeClient attempt={part(["ap_frq_a", "ap_frq_b"], "AP Calculus AB — Free-Response Practice", "frq_practice", [frq])} />);
    expect(screen.getByTestId("ap-badge")).toHaveTextContent("Free-Response Practice");
    const g = screen.getAllByTestId("ap-set-guidance").map((e) => e.textContent).join(" ");
    expect(g).toContain("6 free-response questions in 90 minutes");
    expect(g).toContain("Part A (2 questions, 30 min): calculator allowed");
    expect(g).toContain("Part B (4 questions, 60 min): no calculator");
  });
  it("공식 풀 구성이 확인될 때만 Full Practice Exam", () => {
    render(<ApExamTakeClient attempt={base([item("a1", "ap_mc_a")], { sectionLayout: AP_LAYOUTS.ap_calculus_ab })} />);
    expect(screen.getByTestId("ap-badge")).toHaveTextContent("Full Practice Exam");
  });
  it("결과 화면도 같은 배지·안내", () => {
    render(<ApExamResultView attempt={part(["ap_mc_a"], "AP Calculus AB — Non-Calculator Practice", "mc_practice", [item("a1", "ap_mc_a", { response: "1", correct: true, correctIndex: 1 })])} />);
    expect(screen.getByTestId("ap-badge")).toHaveTextContent("Non-Calculator Practice");
    expect(screen.getByTestId("ap-set-guidance")).toHaveTextContent("29 multiple-choice questions in 62 minutes");
  });
});

describe("시간 소진: 마지막(단일) 섹션은 자동 제출", () => {
  it("단일 섹션이 끝나면 자동 제출 호출, 중간 섹션은 다음 섹션 버튼", async () => {
    const single = AP_LAYOUTS.ap_calculus_ab.filter((x) => x.key === "ap_mc_a");
    const att = base([item("a1", "ap_mc_a")], { sectionLayout: single, timeRemainingSeconds: { ap_mc_a: 2 } as never });
    submit.mockResolvedValue({ ok: true, value: { attempt: null } });
    render(<ApExamTakeClient attempt={att} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(3500); });
    expect(screen.getByTestId("ap-section-expired")).toBeInTheDocument();
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it("중간 섹션 소진은 자동 제출하지 않고 다음 섹션으로 가는 버튼을 보인다", async () => {
    const two = AP_LAYOUTS.ap_calculus_ab.filter((x) => x.key === "ap_mc_a" || x.key === "ap_mc_b");
    const att = base([item("a1", "ap_mc_a"), item("b1", "ap_mc_b")], { sectionLayout: two, timeRemainingSeconds: { ap_mc_a: 1, ap_mc_b: 100 } as never });
    render(<ApExamTakeClient attempt={att} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Go to next section" })).toBeInTheDocument();
  });
});

describe("결과 화면 보강", () => {
  const mcOnly = (extra: Partial<MockExamAttemptItem> = {}) => base([item("m1", "ap_mc_a", { response: "1", correct: true, correctIndex: 1, satDomain: "ap:1.4", explanation: "The correct answer is 100 \\pi. \\frac{500 \\pi}{3} is incorrect, and (4/3) pi (5)^3.", ...extra })], { status: "graded", sectionLayout: AP_LAYOUTS.ap_calculus_ab });
  it("해설의 TeX 가 본문처럼 수식으로 그려진다(원문 TeX 토큰이 화면에 없다)", () => {
    const { container } = render(<ApExamResultView attempt={mcOnly()} />);
    expect(container.querySelectorAll(".katex").length).toBeGreaterThan(0);
    expect(container.textContent ?? "").not.toMatch(RAW_TEX_TOKENS);
  });
  it("FRQ 가 없으면 Free response 탭이 없다, 있으면 보인다", () => {
    const { unmount } = render(<ApExamResultView attempt={mcOnly()} />);
    expect(screen.queryByRole("tab", { name: "Free response" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Missed" })).toBeInTheDocument();
    unmount();
    render(<ApExamResultView attempt={base([item("f1", "ap_frq", { format: "essay", options: null, parts: frqParts })], { status: "graded" })} />);
    expect(screen.getByRole("tab", { name: "Free response" })).toBeInTheDocument();
  });
  it("Topics to review 에 코드와 토픽 이름", () => {
    render(<ApExamResultView attempt={mcOnly()} topicNames={{ "1.4": "Estimating Limit Values from Tables" }} />);
    expect(screen.getByText("Topic 1.4 · Estimating Limit Values from Tables")).toBeInTheDocument();
  });
  it("재응시 후 Attempt 1 | Attempt 2 전환", () => {
    const att = { ...mcOnly(), id: "att2", attemptNo: 2, attemptTotal: 2 };
    const sum = (id: string, no: number) => ({ id, status: "graded", attemptNo: no }) as never;
    render(<ApExamResultView attempt={att} attempts={[sum("att1", 1), sum("att2", 2)]} />);
    const sw = screen.getByTestId("attempt-switcher");
    expect(sw).toHaveTextContent("Attempt 1");
    expect(sw).toHaveTextContent("Attempt 2 (latest)");
    expect(screen.getByRole("link", { name: "Attempt 1" })).toHaveAttribute("href", "/student/mock-exam/att1");
  });
});
