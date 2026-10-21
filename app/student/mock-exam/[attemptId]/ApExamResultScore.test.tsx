import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MockExamAttemptDetail, MockExamAttemptItem } from "@/lib/mock-exam/attempt-data";
import type { EssayScoreView } from "@/lib/essay-grading/view";
import { AP_LAYOUTS } from "@/lib/ap-exam/layouts";

// 결과 화면의 점수 표시(2026-10-21): 미채점 FRQ ≠ 0점 · 전체 채점 전 가중 합산 점수 없음 · 부분 세트 제외 · 등급 숨김.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
const enqueue = vi.fn(async (..._a: unknown[]) => ({ ok: true }));
vi.mock("@/lib/essay-grading/actions", () => ({ enqueueEssayGradingAction: (...a: unknown[]) => enqueue(...a) }));
vi.mock("@/app/components/ProblemErrorReportButton", () => ({ default: () => null }));

import ApExamResultView from "./ApExamResultView";

const mc = (i: number, correct: boolean): MockExamAttemptItem =>
  ({ setItemId: `m${i}`, section: "ap_mc", position: i, problemId: `p${i}`, satDomain: "ap:U1.1", format: "mc", question: "Q", options: ["a", "b", "c", "d"], correctIndex: 0, response: correct ? "0" : "1", correct, parts: null, explanation: null, figure: null, passage: null } as unknown as MockExamAttemptItem);
const essay = (id: string): MockExamAttemptItem =>
  ({ setItemId: id, section: "ap_frq", position: 1, problemId: `p${id}`, satDomain: "ap:U1.1", format: "essay", question: "Write", options: null, correctIndex: null, response: "My essay text", correct: null, explanation: null, figure: null, passage: null, parts: [{ label: "a", points: 6, prompt: "Write", mode: "essay" }] } as unknown as MockExamAttemptItem);
const row = (id: string, status: EssayScoreView["status"], total: number | null): EssayScoreView =>
  ({ setItemId: id, partLabel: "a", status, rubricVersion: "englang-v2", scores: total === null ? null : { total, thesis: 1, evidence: 3, sophistication: 0 }, rationale: total === null ? null : { improve: [], thesis: "t", evidence: "e", sophistication: "s" }, lastError: null });
const attempt = (items: MockExamAttemptItem[], over: Partial<MockExamAttemptDetail> = {}): MockExamAttemptDetail => ({
  id: "att1", examSetId: "s1", examSetName: "AP English Language — Practice Exam 1", difficultyTier: "standard", studentId: "u", studentName: null, status: "graded",
  dueAt: null, startBy: null, maxAttempts: 1, attemptCount: 1, startedAt: null, submittedAt: null, gradedAt: "2026-10-21T00:00:00Z", rwTimeLimitMinutes: 0, mathTimeLimitMinutes: 0,
  mathCalculatorAllowed: false, mathReferenceSheetAllowed: false, timeRemainingSeconds: null, entryCount: 1, format: "fixed", currentModule: null, items,
  examProgram: "ap", apSubject: "ap_english_language", apLabel: "full_practice", sectionLayout: AP_LAYOUTS.ap_english_language, ...over,
} as unknown as MockExamAttemptDetail);
const full = () => [...Array.from({ length: 45 }, (_, i) => mc(i, i < 36)), essay("e1"), essay("e2"), essay("e3")];

afterEach(() => cleanup());

describe("ApExamResultView — scoring display", () => {
  it("scoring in progress: FRQ shows status not 0, no weighted total, no grade", () => {
    render(<ApExamResultView attempt={attempt(full())} essayScores={[row("e1", "done", 5), row("e2", "processing", null)]} essayAiEnabled />);
    expect(screen.getByTestId("ap-frq-summary")).toHaveTextContent("Scoring in progress");
    expect(screen.getByTestId("ap-frq-summary")).toHaveTextContent("1 of 3 answers scored so far");
    expect(screen.queryByTestId("ap-weighted-total")).toBeNull();
    expect(screen.getByTestId("ap-weighted-withheld")).toHaveTextContent("Scoring in progress");
    expect(screen.getByText(/Question 46 · Free response · 5 \/ 6 points/)).toBeInTheDocument();
    expect(screen.getByText(/Question 47 · Free response · Scoring in progress/)).toBeInTheDocument();
    expect(screen.getByText(/Question 48 · Free response · Scoring in progress/)).toBeInTheDocument(); // row missing = not scored yet, not 0
    expect(screen.getByText(/AP scores \(1–5\) are not estimated/)).toBeInTheDocument();
    expect(screen.queryByText(/Estimated AP Score/)).toBeNull();
  });
  it("all scored on a full exam: FRQ points and the weighted total with official weights", () => {
    render(<ApExamResultView attempt={attempt(full())} essayScores={[row("e1", "done", 6), row("e2", "done", 3), row("e3", "done", 3)]} essayAiEnabled />);
    expect(screen.getByTestId("ap-frq-summary")).toHaveTextContent("12 / 18 points");
    expect(screen.getByTestId("ap-weighted-total")).toHaveTextContent("72.7");
    expect(screen.getByTestId("ap-weighted-mc")).toHaveTextContent("36 / 45 · counts 45% of the exam");
    expect(screen.getByTestId("ap-weighted-frq")).toHaveTextContent("12 / 18 · counts 55% of the exam");
    expect(screen.getByTestId("ap-weighted-total")).toHaveTextContent("not an AP score");
  });
  it("AI scoring off: FRQ is 'Not scored', never 0 points, and no weighted total", () => {
    render(<ApExamResultView attempt={attempt(full())} essayAiEnabled={false} />);
    expect(screen.getByTestId("ap-frq-summary")).toHaveTextContent("not scored for this subject (18 points available)");
    expect(screen.queryByText(/0 \/ 6 points/)).toBeNull();
    expect(screen.getByText(/Question 46 · Free response · Not scored/)).toBeInTheDocument();
    expect(screen.queryByTestId("ap-weighted-total")).toBeNull();
    expect(screen.getByTestId("ap-mc-score")).toHaveTextContent("36 / 45");
  });
  it("partial practice set never gets a weighted total even if fully scored", () => {
    const items = [...Array.from({ length: 10 }, (_, i) => mc(i, true)), essay("e1")];
    const layout = [{ key: "ap_mc", kind: "mc", label: "MC", minutes: 15, count: 10, calculator: "na" }, { key: "ap_frq", kind: "frq", label: "FR", minutes: 40, count: 1, calculator: "na" }];
    render(<ApExamResultView attempt={attempt(items, { sectionLayout: layout as never, apLabel: "mc_practice" })} essayScores={[row("e1", "done", 6)]} essayAiEnabled />);
    expect(screen.queryByTestId("ap-weighted-total")).toBeNull();
    expect(screen.getByTestId("ap-weighted-withheld")).toHaveTextContent("only shown for a full practice exam");
  });
  it("MC-only result without FRQ shows no weighted-total messaging", () => {
    const items = Array.from({ length: 5 }, (_, i) => mc(i, i < 2));
    render(<ApExamResultView attempt={attempt(items, { sectionLayout: [{ key: "ap_mc", kind: "mc", label: "MC", minutes: 10, count: 5, calculator: "na" }] as never, apLabel: "mc_practice" })} />);
    expect(screen.getByTestId("ap-mc-score")).toHaveTextContent("2 / 5");
    expect(screen.queryByTestId("ap-weighted-withheld")).toBeNull();
    expect(screen.queryByTestId("ap-frq-summary")).toBeNull();
  });
  it("parent read-only view shows the same status and never starts scoring", () => {
    enqueue.mockClear();
    render(<ApExamResultView attempt={attempt(full())} essayScores={[row("e1", "done", 5)]} essayAiEnabled readOnly attemptHrefBase="/parent/mock-exam/st1/" />);
    expect(screen.getByTestId("ap-frq-summary")).toHaveTextContent("Scoring in progress");
    expect(screen.queryByTestId("ap-weighted-total")).toBeNull();
    expect(enqueue).not.toHaveBeenCalled();
  });
  it("student view starts scoring once when rows are missing", () => {
    enqueue.mockClear();
    render(<ApExamResultView attempt={attempt(full())} essayScores={[]} essayAiEnabled />);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });
  // 2026-10-21 Preview 확인: 지원 과목인데 플래그가 꺼져 있으면 저장된 점수 행을 그대로 보이고 "이 과목은 미제공"이라 하지 않는다.
  it("supported subject with the start flag off: stored rows are shown (1 done, 2 blank = real 0), weighted total computed", () => {
    enqueue.mockClear();
    const skipped = (id: string): EssayScoreView => ({ ...row(id, "skipped", null), lastError: "empty" });
    render(<ApExamResultView attempt={attempt(full())} essayScores={[row("e1", "done", 2), skipped("e2"), skipped("e3")]} essayAiEnabled={false} essayScoringSupported />);
    expect(screen.getByTestId("ap-frq-summary")).toHaveTextContent("2 / 18 points");
    expect(screen.queryByText(/not scored for this subject/)).toBeNull();
    expect(screen.getByText(/Question 46 · Free response · 2 \/ 6 points/)).toBeInTheDocument();
    expect(screen.getByText(/Question 47 · Free response · No response \(0 \/ 6\)/)).toBeInTheDocument();
    expect(screen.getByTestId("ap-weighted-total")).toBeInTheDocument();
    expect(enqueue).not.toHaveBeenCalled(); // 플래그가 꺼져 있으면 새 채점을 시작하지 않는다
  });
  it("supported subject, flag off, rows missing: 'AI scoring temporarily unavailable' (not 'not scored for this subject', not 0)", () => {
    render(<ApExamResultView attempt={attempt(full())} essayScores={[]} essayAiEnabled={false} essayScoringSupported />);
    expect(screen.getByTestId("ap-frq-summary")).toHaveTextContent("AI scoring is temporarily unavailable");
    expect(screen.queryByText(/not scored for this subject/)).toBeNull();
    expect(screen.getByText(/Question 46 · Free response · AI scoring temporarily unavailable/)).toBeInTheDocument();
    expect(screen.getByTestId("ap-weighted-withheld")).toHaveTextContent("temporarily unavailable");
    expect(screen.queryByTestId("ap-weighted-total")).toBeNull();
  });
  it("skipped for a non-empty reason is named, not shown as zero", () => {
    const tooShort = (id: string): EssayScoreView => ({ ...row(id, "skipped", null), lastError: "too_short" });
    render(<ApExamResultView attempt={attempt(full())} essayScores={[row("e1", "done", 5), tooShort("e2"), row("e3", "done", 4)]} essayAiEnabled essayScoringSupported />);
    expect(screen.getByText(/Question 47 · Free response · Not scored: response too short/)).toBeInTheDocument();
    expect(screen.queryByTestId("ap-weighted-total")).toBeNull();
  });
});
