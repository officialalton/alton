import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockExamAttemptDetail, MockExamAttemptItem } from "@/lib/mock-exam/attempt-data";

const ok = { ok: true, value: undefined };
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/mock-exam/attempt-actions", () => ({
  saveMockExamAnswerAction: vi.fn(async () => ok),
  saveMockExamSectionTimeAction: vi.fn(async () => ok),
  submitMockExamAttemptAction: vi.fn(),
  toggleMockExamFlagAction: vi.fn(async () => ok),
  toggleMockExamGuessedAction: vi.fn(async () => ok),
  toggleMockExamSavedToPracticeAction: vi.fn(async () => ok),
  recordMockExamEntryAction: vi.fn(async () => ok),
  enterApSectionAction: vi.fn(async () => ({ ok: true, value: { remaining: {} } })),
  startApSectionAction: vi.fn(),
  loadFrqHandwritingAction: vi.fn(async () => ({ ok: true, value: [] })),
  saveFrqHandwritingAction: vi.fn(async () => ok),
  settleApAttemptAction: vi.fn(async () => ({ ok: true, value: { status: "in_progress", attempt: null } })),
}));
vi.mock("@/app/session/[id]/MockExamMathTools", () => ({ default: () => null, MockExamToolButtons: () => <span /> }));
vi.mock("@/app/components/ProblemErrorReportButton", () => ({ default: () => <button type="button">Report a problem</button> }));
vi.mock("./MockExamWhiteboard", () => ({ default: () => <div /> }));
vi.mock("@/lib/problem-error-reports/actions", () => ({ loadMyProblemErrorReportsAction: vi.fn(async () => ({ ok: true, value: {} })), submitProblemErrorReportAction: vi.fn() }));

import ApExamTakeClient from "./ApExamTakeClient";

const item = (id: string, over: Partial<MockExamAttemptItem> = {}): MockExamAttemptItem => ({
  setItemId: id, section: "ap_mc_a" as "rw", position: 1, problemId: `p-${id}`, satDomain: "ap:1.1", skillCode: null, difficulty: "medium", format: "mc", passage: null,
  question: `Question text ${id}`, options: ["Alpha", "Beta", "Gamma", "Delta"], optionCount: 4, correctIndex: null, answers: null, explanation: null, figure: null,
  response: null, correct: null, flagged: false, savedToPractice: false, timeSpentSeconds: null, ...over,
});
const lay = [{ key: "ap_mc_a", kind: "mc" as const, label: "Section I", minutes: 90, count: 5, calculator: "allowed" as const, options: 4 }];
const base = (items: MockExamAttemptItem[]): MockExamAttemptDetail => ({
  id: "att1", examSetId: "s1", examSetName: "AP Statistics Full Practice 1", difficultyTier: "standard", studentId: "u", studentName: null, status: "in_progress",
  dueAt: null, startBy: null, maxAttempts: 1, attemptCount: 0, startedAt: null, submittedAt: null, gradedAt: null, rwTimeLimitMinutes: 0, mathTimeLimitMinutes: 0,
  mathCalculatorAllowed: false, mathReferenceSheetAllowed: false, timeRemainingSeconds: null, entryCount: 1, format: "fixed", currentModule: null, items,
  examProgram: "ap", apSubject: "ap_statistics", apLabel: "full_practice", sectionLayout: lay,
}) as MockExamAttemptDetail;

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("공유 자료 세트(Statistics 13–15 형태)", () => {
  const P = "A survey of 200 students recorded weekly study hours and quiz scores.";
  const items = [
    item("a"),
    item("b", { passage: P, question: "Which variable is the response?" }),
    item("c", { passage: `${P} `, question: "What is the typical score?" }),
    item("d", { passage: P, question: "Is the sample random?" }),
    item("e", { passage: "Another unrelated stimulus about rainfall measured daily.", question: "Pick the unit." }),
  ];
  const go = async (n: number) => { for (let i = 0; i < n; i++) await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Next question" })); }); };

  it("세트 안 어느 문항에서나 범위 머리말과 자료가 보이고 각 문항은 단독으로 답할 수 있다; 세트 밖에는 머리말이 없다", async () => {
    render(<ApExamTakeClient attempt={base(items)} />);
    expect(screen.queryByTestId("ap-shared-stimulus")).toBeNull();
    await go(1);
    expect(screen.getByTestId("ap-shared-heading")).toHaveTextContent("Questions 2–4 refer to the following information.");
    expect(screen.getByText(/weekly study hours/)).toBeVisible();
    await go(2);
    expect(screen.getByTestId("ap-shared-heading")).toHaveTextContent("Questions 2–4");
    expect(screen.getByText(/weekly study hours/)).toBeVisible();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    await go(1);
    expect(screen.queryByTestId("ap-shared-heading")).toBeNull();
    expect(screen.getByText(/rainfall/)).toBeInTheDocument();
  });
  it("접기 버튼은 aria-expanded 로 자료를 숨기고 세트 안에서 이동해도 접힘이 유지된다", async () => {
    render(<ApExamTakeClient attempt={base(items)} />);
    await go(1);
    expect(screen.getByTestId("ap-shared-toggle")).toHaveAttribute("aria-expanded", "true");
    await act(async () => { fireEvent.click(screen.getByTestId("ap-shared-toggle")); });
    expect(screen.getByTestId("ap-shared-toggle")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/weekly study hours/)).not.toBeVisible();
    await go(1);
    expect(screen.getByTestId("ap-shared-toggle")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("ap-shared-heading")).toBeVisible();
  });
});
