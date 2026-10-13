import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockExamAttemptDetail, MockExamAttemptItem } from "@/lib/mock-exam/attempt-data";

// AP Computer Science A(완전 디지털): 코드 자료 렌더, 코드 답안 칸(Tab·Enter·저장), 손글씨 없음, Reference 버튼 — 2026-10-13.
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

const CODE = "int total = 0;\nfor (int i = 0; i <= 3; i++) {\n    total += i;  // $5 and my__var\n}\nSystem.out.println(total | 2);";
const item = (id: string, section: string, over: Partial<MockExamAttemptItem> = {}): MockExamAttemptItem => ({
  setItemId: id, section: section as "rw", position: 1, problemId: `p-${id}`, satDomain: "ap:2.8", skillCode: null, difficulty: "medium", format: "mc", passage: null,
  question: "What is printed as a result of executing the code segment?", options: ["`6`", "`7`", "`10`", "`11`"], optionCount: 4, correctIndex: null, answers: null, explanation: null, figure: null,
  response: null, correct: null, flagged: false, savedToPractice: false, timeSpentSeconds: null, ...over,
});
const layout = [
  { key: "ap_mc", kind: "mc" as const, label: "Section I: Multiple Choice", minutes: 90, count: 1, calculator: "na" as const, options: 4 },
  { key: "ap_frq", kind: "frq" as const, label: "Section II: Free Response", minutes: 90, count: 1, calculator: "na" as const },
];
const base = (items: MockExamAttemptItem[]): MockExamAttemptDetail => ({
  id: "att1", examSetId: "s1", examSetName: "AP Computer Science A Full Practice 1", difficultyTier: "standard", studentId: "u", studentName: null, status: "in_progress",
  dueAt: null, startBy: null, maxAttempts: 1, attemptCount: 0, startedAt: null, submittedAt: null, gradedAt: null, rwTimeLimitMinutes: 0, mathTimeLimitMinutes: 0,
  mathCalculatorAllowed: false, mathReferenceSheetAllowed: false, timeRemainingSeconds: null, entryCount: 1, format: "fixed", currentModule: null, items,
  examProgram: "ap", apSubject: "ap_computer_science_a", apLabel: "full_practice", sectionLayout: layout,
});

beforeEach(() => { save.mockReset(); save.mockResolvedValue({ ok: true, value: undefined }); vi.useFakeTimers({ shouldAdvanceTime: true }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("ApExamTakeClient — AP Computer Science A", () => {
  const mc = item("m1", "ap_mc", { passage: "```java\n" + CODE + "\n```", options: ["`6`", "`7`", "`10`", "`11`"] });
  const frq = item("f1", "ap_frq", { format: "essay", options: null, optionCount: null, parts: [{ label: "a", points: 9, prompt: "Write the complete class.\n```java\npublic class A { }\n```", mode: "code" }] } as Partial<MockExamAttemptItem>);

  it("코드 자료는 줄 번호가 있는 코드 블록으로 그려지고 $·__·| 가 수식·밑줄이 되지 않는다; 선택지 코드는 한 줄 코드", () => {
    const { container } = render(<ApExamTakeClient attempt={base([mc, frq])} />);
    const lines = screen.getAllByTestId("code-line").slice(0, 5);
    expect(lines.map((l) => l.textContent)).toEqual(CODE.split("\n").map((c, i) => `${i + 1}${c}`));
    expect(container.querySelector(".katex")).toBeNull();
    expect(screen.getAllByTestId("code-inline").map((c) => c.textContent)).toEqual(["6", "7", "10", "11"]);
  });
  it("계산기는 없고 Reference 만 있다", () => {
    render(<ApExamTakeClient attempt={base([mc, frq])} />);
    const b = screen.getByTestId("tool-buttons");
    expect(b.getAttribute("data-calc")).toBe("false");
    expect(b.getAttribute("data-ref")).toBe("true");
  });
  it("FRQ 코드 칸: 고정폭·자동 고침 끔·Tab 들여쓰기·줄바꿈 보존 저장·손글씨 버튼 없음", async () => {
    render(<ApExamTakeClient attempt={base([mc, frq])} />);
    await act(async () => { fireEvent.click(screen.getByTestId("ap-section-ap_frq")); });
    const ta = screen.getByTestId("frq-input-a") as HTMLTextAreaElement;
    expect(ta.getAttribute("spellcheck")).toBe("false");
    expect(ta.className).toContain("font-mono");
    expect(screen.queryByTestId("frq-handwrite-a")).toBeNull();
    expect(screen.queryByTestId("frq-paper-notice")).toBeNull();
    fireEvent.change(ta, { target: { value: "public int f() {" } });
    ta.setSelectionRange(ta.value.length, ta.value.length);
    fireEvent.keyDown(ta, { key: "Enter" });
    fireEvent.keyDown(ta, { key: "Tab" });
    expect(ta.value).toBe("public int f() {\n        ");
    await act(async () => { vi.advanceTimersByTime(1300); });
    await waitFor(() => expect(save).toHaveBeenCalled());
    const last = JSON.parse(save.mock.calls.at(-1)![2] as string) as { a: string };
    expect(last.a).toBe("public int f() {\n        ");
  });
  it("FRQ 파트 프롬프트의 코드 블록도 코드로 그린다", async () => {
    render(<ApExamTakeClient attempt={base([mc, frq])} />);
    await act(async () => { fireEvent.click(screen.getByTestId("ap-section-ap_frq")); });
    expect(screen.getAllByTestId("code-block").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Type your Java code below. Your work is saved automatically.")).toBeInTheDocument();
  });
});
