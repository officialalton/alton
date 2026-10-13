import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockExamAttemptDetail, MockExamAttemptItem } from "@/lib/mock-exam/attempt-data";
import { PAPER_FRQ_NOTICE } from "@/lib/ap-exam/frq-delivery";
import { strokesToSvg, type InkStroke } from "@/lib/ap-exam/frq-ink";

const inkLoad = vi.fn();
const inkSave = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/mock-exam/attempt-actions", () => ({
  saveMockExamAnswerAction: vi.fn(async () => ({ ok: true, value: undefined })),
  submitMockExamAttemptAction: vi.fn(),
  toggleMockExamFlagAction: vi.fn(async () => ({ ok: true, value: undefined })),
  toggleMockExamGuessedAction: vi.fn(async () => ({ ok: true, value: undefined })),
  toggleMockExamSavedToPracticeAction: vi.fn(async () => ({ ok: true, value: undefined })),
  recordMockExamEntryAction: vi.fn(async () => ({ ok: true, value: undefined })),
  enterApSectionAction: vi.fn(async () => ({ ok: true, value: { remaining: {} } })),
  startApSectionAction: vi.fn(),
  settleApAttemptAction: vi.fn(async () => ({ ok: true, value: { status: "in_progress", attempt: null } })),
  loadFrqHandwritingAction: (...a: unknown[]) => inkLoad(...a),
  saveFrqHandwritingAction: (...a: unknown[]) => inkSave(...a),
}));
vi.mock("@/app/session/[id]/MockExamMathTools", () => ({ default: () => null, MockExamToolButtons: () => null }));
vi.mock("@/app/components/ProblemErrorReportButton", () => ({ default: () => null }));
vi.mock("./MockExamWhiteboard", () => ({ default: () => null }));
vi.mock("@/lib/problem-error-reports/actions", () => ({ loadMyProblemErrorReportsAction: vi.fn(async () => ({ ok: true, value: {} })), submitProblemErrorReportAction: vi.fn() }));

import ApExamTakeClient from "./ApExamTakeClient";
import ApExamResultView from "./ApExamResultView";

const parts = [{ label: "a", points: 2, prompt: "Explain the result.", mode: "explain" }, { label: "b", points: 1, prompt: "Calculate the rate.", mode: "calculate" }];
const frq = (over: Partial<MockExamAttemptItem> = {}): MockExamAttemptItem => ({
  setItemId: "f1", section: "ap_frq" as "rw", position: 1, problemId: "p-f1", satDomain: "ap:1.1", skillCode: null, difficulty: "medium", format: "essay", passage: null,
  question: "FRQ question", options: null, optionCount: null, correctIndex: null, answers: null, explanation: null, figure: null, response: null, correct: null,
  flagged: false, savedToPractice: false, timeSpentSeconds: null, parts, ...over,
});
const layout = [{ key: "ap_frq", kind: "frq" as const, label: "Section II", minutes: 90, count: 1, calculator: "allowed" as const }];
const attemptOf = (subject: string, items = [frq()], over: Partial<MockExamAttemptDetail> = {}): MockExamAttemptDetail => ({
  id: "att1", examSetId: "s1", examSetName: "AP FRQ Practice", difficultyTier: "standard", studentId: "u", studentName: null, status: "in_progress",
  dueAt: null, startBy: null, maxAttempts: 1, attemptCount: 0, startedAt: null, submittedAt: null, gradedAt: null, rwTimeLimitMinutes: 0, mathTimeLimitMinutes: 0,
  mathCalculatorAllowed: false, mathReferenceSheetAllowed: false, timeRemainingSeconds: null, entryCount: 1, format: "fixed", currentModule: null, items,
  examProgram: "ap", apSubject: subject, apLabel: "frq_practice", sectionLayout: layout, ...over,
});
const S: InkStroke[] = [{ c: 0, p: [10, 10, 100, 200] }];

beforeEach(() => {
  inkLoad.mockReset(); inkSave.mockReset();
  inkLoad.mockResolvedValue({ ok: true, value: [] });
  inkSave.mockResolvedValue({ ok: true, value: undefined });
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const flushAsync = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(50); }); };

describe("종이 FRQ 과목 응시 화면", () => {
  it("Calculus AB: 안내 문구와 파트별 Handwrite 버튼, 타이핑 상자도 그대로", async () => {
    render(<ApExamTakeClient attempt={attemptOf("ap_calculus_ab")} />);
    await flushAsync();
    expect(screen.getByTestId("frq-paper-notice")).toHaveTextContent(PAPER_FRQ_NOTICE);
    expect(screen.getByTestId("frq-handwrite-a")).toHaveTextContent("Handwrite");
    expect(screen.getByTestId("frq-handwrite-b")).toBeInTheDocument();
    expect(screen.getByTestId("frq-input-a")).toBeInTheDocument();
    expect(inkLoad).toHaveBeenCalledTimes(1); // 로드는 응시당 1회
    expect(inkLoad).toHaveBeenCalledWith("att1", true);
  });
  it.each(["ap_statistics", "ap_computer_science_a", "ap_english_language"])("%s: 디지털 — 손글씨 UI·안내 문구 없음, 로드도 안 함", async (subject) => {
    render(<ApExamTakeClient attempt={attemptOf(subject)} />);
    await flushAsync();
    expect(screen.queryByTestId("frq-paper-notice")).toBeNull();
    expect(screen.queryByTestId("frq-handwrite-a")).toBeNull();
    expect(screen.queryByText(/paper booklet/)).toBeNull();
    expect(screen.getByTestId("frq-input-a")).toBeInTheDocument();
    expect(inkLoad).not.toHaveBeenCalled();
  });
  it("Handwrite 를 열어 그리면 디바운스 후 저장(획·SVG·높이), 저장 표시 갱신", async () => {
    render(<ApExamTakeClient attempt={attemptOf("ap_physics_1")} />);
    await flushAsync();
    fireEvent.click(screen.getByTestId("frq-handwrite-a"));
    const c = screen.getByTestId("frq-canvas-a");
    fireEvent.pointerDown(c, { clientX: 20, clientY: 30, pointerId: 1, pointerType: "mouse" });
    fireEvent.pointerMove(c, { clientX: 120, clientY: 90, pointerId: 1 });
    fireEvent.pointerUp(c, { pointerId: 1 });
    expect(screen.getByTestId("save-status")).toHaveTextContent("Saving…");
    expect(inkSave).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    expect(inkSave).toHaveBeenCalledTimes(1);
    const [att, item, label, strokes, svg, h] = inkSave.mock.calls[0];
    expect([att, item, label, h]).toEqual(["att1", "f1", "a", 500]);
    expect(strokes).toHaveLength(1);
    expect(svg).toBe(strokesToSvg(strokes as InkStroke[], 500));
    expect(screen.getByTestId("save-status")).toHaveTextContent("Saved");
  });
  it("보드를 키우면 크기만 저장되고(획 그대로), 새로고침 후 복원된 크기·획으로 열린다", async () => {
    inkLoad.mockResolvedValue({ ok: true, value: [{ setItemId: "f1", partLabel: "a", strokeCount: 1, previewSvg: strokesToSvg(S, 500), boardHeight: 500, strokes: S }] });
    render(<ApExamTakeClient attempt={attemptOf("ap_biology")} />);
    await flushAsync();
    // 손글씨가 있으면 자동으로 열려 있다
    expect(screen.getByTestId("frq-canvas-a")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("frq-size-a-1200"));
    await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    expect(inkSave).toHaveBeenCalledTimes(1);
    const [, , , strokes, svg, h] = inkSave.mock.calls[0];
    expect(h).toBe(1200);
    expect(strokes).toEqual(S); // 획 불변
    expect(svg).toContain('viewBox="0 0 800 1200"');
    cleanup();
    inkLoad.mockResolvedValue({ ok: true, value: [{ setItemId: "f1", partLabel: "a", strokeCount: 1, previewSvg: svg, boardHeight: 1200, strokes }] });
    render(<ApExamTakeClient attempt={attemptOf("ap_biology")} />);
    await flushAsync();
    expect((screen.getByTestId("frq-canvas-a") as HTMLCanvasElement).height).toBe(1200);
  });
  it("손글씨만 있어도 답한 것으로 센다(번호판·제출 확인), 타이핑 없이", async () => {
    inkLoad.mockResolvedValue({ ok: true, value: [{ setItemId: "f1", partLabel: "b", strokeCount: 1, previewSvg: strokesToSvg(S), boardHeight: 500, strokes: S }] });
    render(<ApExamTakeClient attempt={attemptOf("ap_chemistry")} />);
    await flushAsync();
    expect(screen.getByRole("button", { name: /Question 1, answered/ })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ap-header-submit"));
    await flushAsync();
    expect(screen.getByRole("dialog")).toHaveTextContent("You answered 1 of 1 questions.");
  });
  it("손글씨 없고 타이핑도 없으면 미답", async () => {
    render(<ApExamTakeClient attempt={attemptOf("ap_chemistry")} />);
    await flushAsync();
    expect(screen.queryByRole("button", { name: /answered/ })).toBeNull();
  });
  it("저장 실패는 오류로 표시하고 다음 flush 에서 다시 시도한다", async () => {
    inkSave.mockResolvedValueOnce({ ok: false, error: "Could not save your handwriting." });
    render(<ApExamTakeClient attempt={attemptOf("ap_microeconomics")} />);
    await flushAsync();
    fireEvent.click(screen.getByTestId("frq-handwrite-a"));
    const c = screen.getByTestId("frq-canvas-a");
    fireEvent.pointerDown(c, { clientX: 20, clientY: 30, pointerId: 1, pointerType: "mouse" });
    fireEvent.pointerMove(c, { clientX: 80, clientY: 90, pointerId: 1 });
    fireEvent.pointerUp(c, { pointerId: 1 });
    await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Could not save your handwriting."));
    expect(screen.getByTestId("save-status")).toHaveTextContent("Save failed");
    await act(async () => { fireEvent.click(screen.getByTestId("ap-header-submit")); }); // 제출 전 flush 가 미저장 획을 다시 시도
    expect(inkSave).toHaveBeenCalledTimes(2);
  });
  it("서버 시계가 만료를 알리면 섹션을 잠근다(만료 섹션에는 저장 안 됨)", async () => {
    inkSave.mockResolvedValueOnce({ ok: false, error: "Time is up for this section. Answers can no longer be changed." });
    render(<ApExamTakeClient attempt={attemptOf("ap_macroeconomics")} />);
    await flushAsync();
    fireEvent.click(screen.getByTestId("frq-handwrite-a"));
    const c = screen.getByTestId("frq-canvas-a");
    fireEvent.pointerDown(c, { clientX: 20, clientY: 30, pointerId: 1, pointerType: "mouse" });
    fireEvent.pointerMove(c, { clientX: 80, clientY: 90, pointerId: 1 });
    fireEvent.pointerUp(c, { pointerId: 1 });
    await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    await waitFor(() => expect(screen.getByTestId("ap-section-expired")).toBeInTheDocument());
  });
});

describe("결과 화면: 내 손글씨 + 참고 답안", () => {
  const graded = attemptOf("ap_calculus_ab", [frq({ explanationEn: "Reference answer text." })], { status: "graded" });
  it("미리보기 이미지가 타이핑 답과 참고 답안 사이에 보이고 보드 크기(viewBox)를 따른다", () => {
    const rows = [{ setItemId: "f1", partLabel: "a", strokeCount: 1, previewSvg: strokesToSvg(S, 1200), boardHeight: 1200 }];
    render(<ApExamResultView attempt={graded} handwriting={rows} />);
    const fig = screen.getByTestId("frq-handwriting-a");
    const img = fig.querySelector("img") as HTMLImageElement;
    expect(decodeURIComponent(img.src)).toContain('viewBox="0 0 800 1200"');
    expect(img.src.startsWith("data:image/svg+xml")).toBe(true); // <img> 로만 표시(스크립트 실행 불가)
    expect(fig).toHaveTextContent("Your handwritten answer");
    expect(screen.queryByTestId("frq-handwriting-b")).toBeNull();
    expect(screen.getByTestId("ap-explanation")).toHaveTextContent("Reference answer and scoring guide");
    expect(screen.getByTestId("ap-explanation")).toHaveTextContent("not official scoring");
  });
  it("손글씨가 없는 지난 응시·디지털 과목은 그대로(이미지 없음)", () => {
    render(<ApExamResultView attempt={graded} />);
    expect(screen.queryByTestId("frq-handwriting-a")).toBeNull();
    expect(screen.getByTestId("frq-answer-a")).toHaveTextContent("(no answer)");
  });
  it("크기만 남은 빈 행(획 0)은 이미지를 만들지 않는다", () => {
    render(<ApExamResultView attempt={graded} handwriting={[{ setItemId: "f1", partLabel: "a", strokeCount: 0, previewSvg: "", boardHeight: 800 }]} />);
    expect(screen.queryByTestId("frq-handwriting-a")).toBeNull();
  });
});
