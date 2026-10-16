import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockExamAttemptDetail, MockExamAttemptItem } from "@/lib/mock-exam/attempt-data";

// AP English Language(완전 디지털): 긴 지문·문단/문장 번호·stem 이 지문을 인용해도 지문 유지·소스 패널(set_intro)·에세이 칸(단어 수)·계산기/Reference 없음 — 2026-10-14.
const save = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/lib/mock-exam/attempt-actions", () => ({
  saveMockExamAnswerAction: (...a: unknown[]) => save(...a),
  saveMockExamSectionTimeAction: vi.fn(async () => ({ ok: true, value: undefined })),
  submitMockExamAttemptAction: vi.fn(),
  toggleMockExamFlagAction: vi.fn(async () => ({ ok: true, value: undefined })),
  toggleMockExamGuessedAction: vi.fn(async () => ({ ok: true, value: undefined })),
  toggleMockExamSavedToPracticeAction: vi.fn(async () => ({ ok: true, value: undefined })),
  recordMockExamEntryAction: vi.fn(async () => ({ ok: true, value: undefined })),
  enterApSectionAction: vi.fn(async () => ({ ok: true, value: { remaining: {} } })),
  startApSectionAction: vi.fn(),
  loadFrqHandwritingAction: vi.fn(async () => ({ ok: true, value: [] })),
  saveFrqHandwritingAction: vi.fn(async () => ({ ok: true, value: undefined })),
  settleApAttemptAction: vi.fn(async () => ({ ok: true, value: { status: "in_progress", attempt: null } })),
}));
vi.mock("@/app/session/[id]/MockExamMathTools", () => ({ default: () => null, MockExamToolButtons: (p: { calculatorAllowed: boolean; referenceSheetAllowed: boolean }) => <span data-testid="tool-buttons" data-calc={String(p.calculatorAllowed)} data-ref={String(p.referenceSheetAllowed)} /> }));
vi.mock("@/app/components/ProblemErrorReportButton", () => ({ default: () => <button type="button">Report a problem</button> }));
vi.mock("./MockExamWhiteboard", () => ({ default: () => <div data-testid="whiteboard-open" /> }));
vi.mock("@/lib/problem-error-reports/actions", () => ({ loadMyProblemErrorReportsAction: vi.fn(async () => ({ ok: true, value: {} })), submitProblemErrorReportAction: vi.fn() }));

import ApExamTakeClient from "./ApExamTakeClient";

const WRITING = "ALTON original passage\nThe Library Night\n\n[1] The library stayed open late on Fridays. [2] Nobody complained about the quiet evenings. [3] The cost was small.\n\n[4] Volunteers took turns at the desk.";
const READING = "ALTON original passage\nThe Warm Room\n\n¶1 The harbor library opened in 1931 with one stubborn stove. It cost 5 dollars to heat.\n\n¶2 By the time the stove failed, the shelves had doubled.";
const item = (id: string, section: string, over: Partial<MockExamAttemptItem> = {}): MockExamAttemptItem => ({
  setItemId: id, section: section as "rw", position: 1, problemId: `p-${id}`, satDomain: "ap:U5.4", skillCode: null, difficulty: "medium", format: "mc", passage: null,
  question: "Question text?", options: ["One option", "Another option", "Third option", "Fourth option"], optionCount: 4, correctIndex: null, answers: null, explanation: null, figure: null,
  response: null, correct: null, flagged: false, savedToPractice: false, timeSpentSeconds: null, ...over,
});
const layout = [
  { key: "ap_mc", kind: "mc" as const, label: "Section I: Multiple Choice", minutes: 60, count: 2, calculator: "na" as const, options: 4 },
  { key: "ap_frq", kind: "frq" as const, label: "Section II: Free Response (3 essays)", minutes: 135, count: 1, calculator: "na" as const },
];
const base = (items: MockExamAttemptItem[]): MockExamAttemptDetail => ({
  id: "att1", examSetId: "s1", examSetName: "AP English Language — Practice Exam 1", difficultyTier: "standard", studentId: "u", studentName: null, status: "in_progress",
  dueAt: null, startBy: null, maxAttempts: 1, attemptCount: 0, startedAt: null, submittedAt: null, gradedAt: null, rwTimeLimitMinutes: 0, mathTimeLimitMinutes: 0,
  mathCalculatorAllowed: false, mathReferenceSheetAllowed: false, timeRemainingSeconds: null, entryCount: 1, format: "fixed", currentModule: null, items,
  examProgram: "ap", apSubject: "ap_english_language", apLabel: "full_practice", sectionLayout: layout,
});

beforeEach(() => { save.mockReset(); save.mockResolvedValue({ ok: true, value: undefined }); vi.useFakeTimers({ shouldAdvanceTime: true }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("ApExamTakeClient — AP English Language", () => {
  const stemQuoting = "The Library Night: The library stayed open late on Fridays. Nobody complained about the quiet evenings. The writer wants to combine sentences 1 and 2; which choice does so most effectively?";
  const w1 = item("w1", "ap_mc", { position: 1, passage: WRITING, question: stemQuoting });
  const w2 = item("w2", "ap_mc", { position: 2, passage: WRITING, question: "The writer wants to add a transition before sentence 4. Which choice best does so?" });
  const frq = item("f1", "ap_frq", { format: "essay", options: null, optionCount: null, passage: "ALTON original passage\n\nSource A\nTitle\n\nBody of source A.", question: "Essay — answer every part.", parts: [{ label: "A", points: 6, prompt: "Write an essay that argues your position.\n\nYour essay should:\n- take a defensible position", mode: "essay" }] } as Partial<MockExamAttemptItem>);

  it("stem 이 지문을 인용해도 지문이 남고 문장 번호가 보이며 두 문항이 한 지문을 공유한다", () => {
    render(<ApExamTakeClient attempt={base([w1, w2, frq])} />);
    expect(screen.getByText(/\[1\] The library stayed open late on Fridays\./)).toBeInTheDocument();
    expect(screen.getByText(/\[4\] Volunteers took turns/)).toBeInTheDocument();
    expect(screen.getAllByText(/ALTON original passage/).length).toBeGreaterThan(0);
    expect(screen.getByText("Questions 1–2 refer to the following information.")).toBeInTheDocument();
  });
  it("읽기 지문의 문단 번호(¶)와 금액 표기가 그대로 보인다(수식으로 바뀌지 않는다)", () => {
    const r = item("r1", "ap_mc", { passage: READING, question: "In paragraph 2, the writer primarily wants to" });
    const { container } = render(<ApExamTakeClient attempt={base([r, frq])} />);
    expect(screen.getByText(/¶2 By the time the stove failed/)).toBeInTheDocument();
    expect(screen.getByText(/It cost 5 dollars to heat\./)).toBeInTheDocument();
    expect(container.querySelector(".katex")).toBeNull();
  });
  it("계산기·Reference 버튼이 없다", () => {
    render(<ApExamTakeClient attempt={base([w1, w2, frq])} />);
    expect(screen.queryByTestId("tool-buttons")).toBeNull();
  });
  it("지문과 문항은 데스크톱에서 좌우 두 패널(각각 스크롤)이고 모바일에서는 위아래로 쌓인다", () => {
    render(<ApExamTakeClient attempt={base([w1, w2, frq])} />);
    const left = screen.getByLabelText("Passage and question"); const right = screen.getByLabelText("Answer");
    expect(left.className).toContain("md:w-1/2"); expect(left.className).toContain("md:overflow-y-auto");
    expect(right.className).toContain("md:w-1/2"); expect(right.className).toContain("md:overflow-y-auto");
  });
  it("에세이 칸: 큰 입력칸·단어 수 갱신·저장·손글씨 없음·소스 지문 표시", async () => {
    render(<ApExamTakeClient attempt={base([w1, w2, frq])} />);
    await act(async () => { fireEvent.click(screen.getByTestId("ap-section-ap_frq")); });
    const ta = screen.getByTestId("frq-input-A") as HTMLTextAreaElement;
    expect(ta.rows).toBe(18);
    expect(screen.getByTestId("frq-word-count-A").textContent).toBe("0 words");
    expect(screen.getByText("Type your essay below. Your work is saved automatically.")).toBeInTheDocument();
    expect(screen.queryByTestId("frq-handwrite-A")).toBeNull();
    expect(screen.getByText(/Body of source A\./)).toBeInTheDocument();
    fireEvent.change(ta, { target: { value: "My thesis is clear and defensible." } });
    expect(screen.getByTestId("frq-word-count-A").textContent).toBe("6 words");
    await act(async () => { vi.advanceTimersByTime(1300); });
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect((JSON.parse(save.mock.calls.at(-1)![2] as string) as { A: string }).A).toBe("My thesis is clear and defensible.");
  });
});
