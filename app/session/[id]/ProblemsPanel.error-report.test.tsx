import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProblemsPanel from "./ProblemsPanel";
import type { SessionProblem } from "./session-problem-data";

vi.mock("./problem-work-actions", () => ({
  openProblemWork: vi.fn(),
  answerSprText: vi.fn(),
  answerEssayText: vi.fn(),
  submitProblemWork: vi.fn(),
  listProblemAttempts: vi.fn(async () => []),
  loadProblemWorkBoard: vi.fn(),
  appendProblemWorkStrokes: vi.fn(),
  answerMcChoice: vi.fn(),
  gradeProblemAttempt: vi.fn(),
  refreshSessionProblems: vi.fn(async () => []),
}));
vi.mock("./problem-image-actions", () => ({ getProblemImageUrlAction: vi.fn() }));
vi.mock("./PdfPageAnnotationLayer", () => ({ default: () => <div /> }));
const mine = vi.fn();
vi.mock("@/lib/problem-error-reports/actions", () => ({
  loadMyProblemErrorReportsAction: (...a: unknown[]) => mine(...a),
  submitProblemErrorReportAction: vi.fn(),
}));
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({ on() { return this; }, subscribe() { return this; }, send: vi.fn() }),
    removeChannel: vi.fn(),
  }),
}));

beforeEach(() => {
  mine.mockReset();
  mine.mockResolvedValue({ ok: true, value: {} });
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({})) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

const base: SessionProblem = {
  number: 1, problemId: "p1", format: "mc", satDomain: null, passage: "지문", options: ["가", "나"], difficulty: null,
  correctIndex: null, explanation: null, attempts: 1, solved: true, graded: false, grade: null, gradeComment: null,
  myChoice: 0, autoCorrect: null, latestWorkId: "w1", myText: null, acceptedAnswers: null, figure: null, statements: null,
};
const render_ = (p: SessionProblem, role: "student" | "teacher" | "parent" | "admin") =>
  render(<ProblemsPanel sessionId="s1" studentId="stu1" problems={[p]} viewerRole={role} source="homework" />);

describe("ProblemsPanel — 문제 오류 신고·조정 표시", () => {
  it("학생·선생님에게만 신고 버튼이 있고 학부모·관리자에게는 없다", async () => {
    const s = render_(base, "student");
    expect(screen.getByRole("button", { name: "문제 오류 신고" })).toBeInTheDocument();
    await waitFor(() => expect(mine).toHaveBeenCalledWith(["p1"]));
    s.unmount();
    const t = render_(base, "teacher");
    expect(screen.getByRole("button", { name: "문제 오류 신고" })).toBeInTheDocument();
    t.unmount();
    for (const role of ["parent", "admin"] as const) {
      const r = render_(base, role);
      expect(screen.queryByRole("button", { name: "문제 오류 신고" })).toBeNull();
      r.unmount();
    }
    expect(mine).toHaveBeenCalledTimes(2); // 학부모·관리자는 신고 상태를 조회하지도 않는다
  });

  it("내 신고 상태가 버튼 문구로 나온다", async () => {
    mine.mockResolvedValue({ ok: true, value: { p1: "not_error" } });
    render_(base, "student");
    await waitFor(() => expect(screen.getByRole("button", { name: /오류가 아닌 것으로 판단/ })).toBeInTheDocument());
  });

  it("학생·보호자는 채점 뒤에만 '조정' 안내를 본다(채점 전에는 없음)", () => {
    const adj = { ...base, errorAdjusted: true };
    const a = render_(adj, "student");
    expect(screen.queryByTestId("problem-error-adjusted")).toBeNull();
    a.unmount();
    const b = render_({ ...adj, graded: true, grade: "correct", correctIndex: 1 }, "parent");
    expect(screen.getByTestId("problem-error-adjusted")).toHaveTextContent("문항 오류로 채점이 조정되었습니다.");
    b.unmount();
    render_({ ...adj, graded: true, grade: "incorrect", correctIndex: 1, errorAdjustmentPending: true }, "student");
    expect(screen.getByTestId("problem-error-adjusted")).toHaveTextContent("선생님이 채점을 다시 확인");
  });

  it("선생님에게는 '조정 대상' 표시가 있고 학생에게는 그 배너가 없다", () => {
    const p = { ...base, graded: true, grade: "incorrect" as const, correctIndex: 1, errorAdjusted: true, errorAdjustmentPending: true };
    const t = render_(p, "teacher");
    expect(screen.getByTestId("problem-error-pending")).toHaveTextContent("조정 대상");
    expect(screen.getByRole("button", { name: "채점 다시 확인" })).toBeInTheDocument();
    t.unmount();
    render_(p, "student");
    expect(screen.queryByTestId("problem-error-pending")).toBeNull();
  });
});
