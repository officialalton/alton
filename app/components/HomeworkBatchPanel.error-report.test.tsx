import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomeworkBatchPanel from "./HomeworkBatchPanel";
import type { HomeworkBatch, HomeworkBatchItem } from "@/lib/homework-batch-data";

// 과제 묶음 화면의 문제 오류 신고 버튼·조정 안내(2026-09-30 UAT). 신고 원본·판정은 DB 통합 테스트가 본다 — 여기서는 노출 규칙만.
const mine = vi.fn();
const regrade = vi.fn();
vi.mock("@/lib/problem-error-reports/actions", () => ({
  loadMyProblemErrorReportsAction: (...a: unknown[]) => mine(...a),
  submitProblemErrorReportAction: vi.fn(),
}));
vi.mock("@/lib/homework-batch-actions", () => ({
  submitHomeworkAnswerAction: vi.fn(),
  gradeHomeworkBatchAction: vi.fn(),
  toggleHomeworkItemSavedToPracticeAction: vi.fn(),
  regradeHomeworkItemAction: (...a: unknown[]) => regrade(...a),
}));

beforeEach(() => {
  mine.mockReset();
  mine.mockResolvedValue({ ok: true, value: {} });
  regrade.mockReset();
  regrade.mockResolvedValue({ ok: true, value: undefined });
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({})) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

function mcItem(o: Partial<HomeworkBatchItem> = {}): HomeworkBatchItem {
  return {
    problemId: "p1", position: 1, format: "mc", passage: "지문", question: "값은?", options: ["1", "2", "3", "4"],
    correctIndex: 0, answers: null, explanation: "해설", statements: null, figure: null,
    response: "1", submittedAt: "2026-09-15T01:00:00Z", autoCorrect: null, graded: false, gradedAt: null, grade: null, gradeComment: null, ...o,
  };
}
const batchOf = (o: Partial<HomeworkBatchItem> = {}): HomeworkBatch => ({
  id: "b1", teacherId: "t1", teacherName: "김선생", studentId: "stu", label: "9월 15일 과제", subjectId: null, subjectName: null,
  createdAt: "2026-09-15T00:00:00Z", dueAt: null, items: [mcItem(o)],
});

describe("HomeworkBatchPanel — 문제 오류 신고 버튼", () => {
  it("학생·선생님에게 신고 버튼이 있고, 내 신고 상태를 패널당 한 번 조회한다", async () => {
    const s = render(<HomeworkBatchPanel batches={[batchOf()]} viewerRole="student" />);
    expect(screen.getByRole("button", { name: "문제 오류 신고" })).toBeInTheDocument();
    await waitFor(() => expect(mine).toHaveBeenCalledWith(["p1"]));
    s.unmount();
    render(<HomeworkBatchPanel batches={[batchOf()]} viewerRole="teacher" />);
    expect(screen.getByRole("button", { name: "문제 오류 신고" })).toBeInTheDocument();
    expect(mine).toHaveBeenCalledTimes(2);
  });

  it("학부모(읽기 전용)·관리자(reportEnabled=false)에게는 버튼도 상태 조회도 없다", () => {
    const p = render(<HomeworkBatchPanel batches={[batchOf()]} viewerRole="student" readOnly />);
    expect(screen.queryByRole("button", { name: "문제 오류 신고" })).toBeNull();
    p.unmount();
    render(<HomeworkBatchPanel batches={[batchOf()]} viewerRole="teacher" reportEnabled={false} />);
    expect(screen.queryByRole("button", { name: "문제 오류 신고" })).toBeNull();
    expect(mine).not.toHaveBeenCalled();
  });

  it("해설 오류 유형은 선생님에게만 보인다", () => {
    const s = render(<HomeworkBatchPanel batches={[batchOf()]} viewerRole="student" />);
    fireEvent.click(screen.getByRole("button", { name: "문제 오류 신고" }));
    expect(screen.getByText("정답 오류")).toBeInTheDocument();
    expect(screen.queryByText("해설 오류")).toBeNull();
    s.unmount();
    render(<HomeworkBatchPanel batches={[batchOf()]} viewerRole="teacher" />);
    fireEvent.click(screen.getByRole("button", { name: "문제 오류 신고" }));
    expect(screen.getByText("해설 오류")).toBeInTheDocument();
  });

  it("내 신고 상태가 버튼 문구로 나온다", async () => {
    mine.mockResolvedValue({ ok: true, value: { p1: "confirmed" } });
    render(<HomeworkBatchPanel batches={[batchOf()]} viewerRole="student" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /오류가 확인되어 문항이 보관됐어요/ })).toBeInTheDocument());
  });
});

describe("HomeworkBatchPanel — 오류 판정 조정 안내", () => {
  const graded = { graded: true, gradedAt: "2026-09-16T00:00:00Z", grade: "incorrect" as const, autoCorrect: true, errorAdjustedAt: "2026-09-17T00:00:00Z" };

  it("학생은 채점 뒤에만 '조정' 안내를 보고, 채점 전에는 보지 못한다", () => {
    const pre = render(<HomeworkBatchPanel batches={[batchOf({ errorAdjustedAt: "2026-09-17T00:00:00Z" })]} viewerRole="student" />);
    expect(screen.queryByTestId("problem-error-adjusted")).toBeNull();
    pre.unmount();
    render(<HomeworkBatchPanel batches={[{ ...batchOf(graded), items: [mcItem({ ...graded, grade: "correct" })] }]} viewerRole="student" />);
    fireEvent.click(screen.getByRole("button", { name: "Past" }));
    fireEvent.click(screen.getByText("9월 15일 과제"));
    expect(screen.getByTestId("problem-error-adjusted")).toHaveTextContent("The grade was adjusted because of a question error.");
  });

  it("선생님은 '조정 대상'을 보고 재채점하면 서버 액션을 부르고 표시가 사라진다", async () => {
    render(<HomeworkBatchPanel batches={[batchOf({ ...graded, errorAdjustmentPending: true })]} viewerRole="teacher" />);
    fireEvent.click(screen.getByRole("button", { name: "Past" }));
    fireEvent.click(screen.getByText("9월 15일 과제"));
    expect(screen.getByTestId("problem-error-pending")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Regrade as correct" }));
    await waitFor(() => expect(regrade).toHaveBeenCalledWith("b1", "p1", "correct"));
    await waitFor(() => expect(screen.queryByTestId("problem-error-pending")).toBeNull());
  });

  it("학생에게는 '조정 대상' 재채점 UI가 보이지 않는다", () => {
    render(<HomeworkBatchPanel batches={[batchOf({ ...graded, errorAdjustmentPending: true })]} viewerRole="student" />);
    fireEvent.click(screen.getByRole("button", { name: "Past" }));
    fireEvent.click(screen.getByText("9월 15일 과제"));
    expect(screen.queryByTestId("problem-error-pending")).toBeNull();
    expect(screen.getByTestId("problem-error-adjusted")).toHaveTextContent("your teacher is re-checking the grade.");
  });
});
