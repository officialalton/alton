import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import HomeworkTab from "./HomeworkTab";
import { withdrawHomework } from "./homework-v3-actions";
import type { SessionProblem } from "./session-problem-data";

vi.mock("./homework-v3-actions", () => ({
  withdrawHomework: vi.fn(),
}));
// 과제 문제 패널은 수업 문제 패널 그대로다 — 여기서는 어떤 출처로 그려지는지만 본다.
vi.mock("./ProblemsPanel", () => ({
  default: ({ problems, source }: { problems: SessionProblem[]; source?: string }) => (
    <div data-testid="problems-panel" data-source={source}>
      {problems.length === 0 ? "아직 발급된 과제가 없습니다" : problems.map((p) => <div key={p.problemId}>과제 {p.number}</div>)}
    </div>
  ),
}));

const pool = [
  { problemId: "p1", label: "songbirds …", difficulty: "medium", format: "mc" },
  { problemId: "p2", label: "coral reefs …", difficulty: null, format: "essay" },
];

const homeworkProblem: SessionProblem = {
  number: 1, problemId: "p1", format: "mc", passage: "x", options: ["a", "b"], difficulty: null, correctIndex: null,
  explanation: null, attempts: 0, solved: false, graded: false, grade: null, gradeComment: null, myChoice: null,
  autoCorrect: null, latestWorkId: null, myText: null, acceptedAnswers: null, figure: null, statements: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(withdrawHomework).mockResolvedValue({ ok: true });
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload: vi.fn() } });
});

describe("HomeworkTab — 2026-09-16(발급은 교사 포털에서만, 세션뷰는 목록·회수·풀이만)", () => {
  it("교사: 발급된 목록이 위, 과제 문제 패널이 아래", () => {
    render(
      <HomeworkTab sessionId="s1" studentId="stu" initialItems={[]} viewerRole="teacher" sessionSource="v3" realViewerRole="teacher"
        pool={pool}
        issued={[{ itemId: "h1", problemId: "p1", position: 1, started: false }, { itemId: "h2", problemId: "p2", position: 2, started: true }]}
        homeworkProblems={[homeworkProblem]} />
    );
    const issue = screen.getByTestId("homework-issue");
    const panel = screen.getByTestId("problems-panel");
    expect(issue.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(panel).toHaveAttribute("data-source", "homework");
    expect(screen.getByText(/객관식 · songbirds/)).toBeInTheDocument();
    expect(screen.getByText("풀이 시작함")).toBeDisabled();
  });

  it("발급된 항목은 학생이 시작하기 전에만 회수할 수 있다", async () => {
    render(
      <HomeworkTab sessionId="s1" studentId="stu" initialItems={[]} viewerRole="teacher" sessionSource="v3" realViewerRole="teacher"
        pool={pool}
        issued={[{ itemId: "h1", problemId: "p1", position: 1, started: false }, { itemId: "h2", problemId: "p2", position: 2, started: true }]}
        homeworkProblems={[homeworkProblem]} />
    );
    fireEvent.click(screen.getByRole("button", { name: "회수" }));
    await waitFor(() => expect(withdrawHomework).toHaveBeenCalledWith("h1"));
  });

  it("발급된 항목이 없으면 목록 구역 자체가 안 보인다", () => {
    render(
      <HomeworkTab sessionId="s1" studentId="stu" initialItems={[]} viewerRole="teacher" sessionSource="v3" realViewerRole="teacher"
        pool={pool} issued={[]} homeworkProblems={[]} />
    );
    expect(screen.queryByTestId("homework-issue")).not.toBeInTheDocument();
  });

  it("학생: 발급 목록이 없고 과제 문제 패널만 있다", () => {
    render(
      <HomeworkTab sessionId="s1" studentId="stu" initialItems={[]} viewerRole="student" sessionSource="v3" realViewerRole="student"
        homeworkProblems={[homeworkProblem]} />
    );
    expect(screen.queryByTestId("homework-issue")).not.toBeInTheDocument();
    expect(screen.getByText("과제 1")).toBeInTheDocument();
  });

  it("교사가 학생 시점으로 볼 때(데모션)도 실제 역할이 교사면 발급 목록 관리 구역은 남는다", () => {
    render(
      <HomeworkTab sessionId="s1" studentId="stu" initialItems={[]} viewerRole="student" sessionSource="v3" realViewerRole="teacher"
        pool={pool} issued={[{ itemId: "h1", problemId: "p1", position: 1, started: false }]} homeworkProblems={[]} />
    );
    expect(screen.getByTestId("homework-issue")).toBeInTheDocument();
  });

  it("레거시 과제 기록은 읽기 전용으로만 보인다 — 입력·추가 버튼이 없다", () => {
    render(
      <HomeworkTab sessionId="s1" studentId="stu" viewerRole="student" sessionSource="legacy"
        initialItems={[{ id: "l1", title: "옛 과제", description: "설명", studentAnswer: "내 답" }]} />
    );
    expect(screen.getByText("옛 과제")).toBeInTheDocument();
    expect(screen.getByText("내 답")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText("+ 과제 추가")).not.toBeInTheDocument();
  });
});
