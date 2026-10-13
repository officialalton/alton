import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockExamAttemptDetail, MockExamAttemptItem } from "@/lib/mock-exam/attempt-data";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/mock-exam/attempt-actions", () => ({
  saveMockExamAnswerAction: vi.fn(async () => ({ ok: true, value: undefined })),
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
vi.mock("@/app/session/[id]/MockExamMathTools", async () => {
  const actual = await vi.importActual<typeof import("@/app/session/[id]/MockExamMathTools")>("@/app/session/[id]/MockExamMathTools");
  return { ...actual, GraphingCalculator: () => <div data-testid="desmos-stub" /> };
});
vi.mock("@/app/components/ProblemErrorReportButton", () => ({ default: () => <button type="button">Report a problem</button> }));
vi.mock("./MockExamWhiteboard", () => ({ default: () => <div /> }));
vi.mock("@/lib/problem-error-reports/actions", () => ({ loadMyProblemErrorReportsAction: vi.fn(async () => ({ ok: true, value: {} })), submitProblemErrorReportAction: vi.fn() }));

import ApExamTakeClient from "./ApExamTakeClient";
import { AP_LAYOUTS } from "@/lib/ap-exam/layouts";

const item = (id: string, section: string): MockExamAttemptItem => ({
  setItemId: id, section: section as "rw", position: 1, problemId: `p-${id}`, satDomain: "ap:1.1", skillCode: null, difficulty: "medium", format: "mc", passage: null,
  question: `Question ${id}`, options: ["A", "B", "C", "D"], optionCount: 4, correctIndex: null, answers: null, explanation: null, figure: null,
  response: null, correct: null, flagged: false, savedToPractice: false, timeSpentSeconds: null,
});
const attempt = (subject: string, layout: MockExamAttemptDetail["sectionLayout"], items: MockExamAttemptItem[]): MockExamAttemptDetail => ({
  id: "att1", examSetId: "s1", examSetName: "AP Practice", difficultyTier: "standard", studentId: "u", studentName: null, status: "in_progress",
  dueAt: null, startBy: null, maxAttempts: 1, attemptCount: 0, startedAt: null, submittedAt: null, gradedAt: null, rwTimeLimitMinutes: 0, mathTimeLimitMinutes: 0,
  mathCalculatorAllowed: false, mathReferenceSheetAllowed: false, timeRemainingSeconds: null, entryCount: 1, format: "fixed", currentModule: null, items,
  examProgram: "ap", apSubject: subject, apLabel: "full_practice", sectionLayout: layout,
});

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("AP 시험 화면의 과목별 도구", () => {
  it("통계: 두 섹션 모두 Calculator·Reference 버튼, 타이머·계산기 규칙 문구는 그대로", async () => {
    const layout = AP_LAYOUTS.ap_statistics;
    render(<ApExamTakeClient attempt={attempt("ap_statistics", layout, [item("m1", "ap_mc"), item("f1", "ap_frq")])} />);
    expect(screen.getByTestId("ap-exam-timer")).toHaveTextContent("90:00");
    expect(screen.getByTestId("ap-section-rules")).toHaveTextContent("Calculator allowed");
    expect(screen.getByTestId("toggle-calculator")).toHaveTextContent("Calculator");
    expect(screen.getByTestId("toggle-reference")).toHaveTextContent("Reference");
    fireEvent.click(screen.getByTestId("toggle-reference"));
    expect(screen.getByTestId("stats-reference")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("toggle-calculator"));
    expect(screen.getByTestId("stats-calculator")).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByTestId("ap-section-ap_frq")); });
    expect(screen.getByTestId("ap-exam-timer")).toHaveTextContent("90:00");
    expect(screen.getByTestId("toggle-calculator")).toBeInTheDocument();
    expect(screen.getByTestId("toggle-reference")).toBeInTheDocument();
  });
  it("미적분: 계산기 규칙 그대로 — 비계산기 파트에는 도구 없음, 계산기 파트는 Calculator만(Reference 없음)", async () => {
    const layout = AP_LAYOUTS.ap_calculus_ab;
    render(<ApExamTakeClient attempt={attempt("ap_calculus_ab", layout, [item("m1", "ap_mc_a"), item("m2", "ap_mc_b")])} />);
    expect(screen.queryByTestId("toggle-calculator")).toBeNull();
    expect(screen.queryByTestId("toggle-reference")).toBeNull();
    await act(async () => { fireEvent.click(screen.getByTestId("ap-section-ap_mc_b")); });
    expect(screen.getByTestId("toggle-calculator")).toBeInTheDocument();
    expect(screen.queryByTestId("toggle-reference")).toBeNull();
  });
});
