import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import HomeworkTab from "./HomeworkTab";
import { issueHomework, withdrawHomework } from "./homework-v3-actions";
import type { SessionProblem } from "./session-problem-data";

vi.mock("./homework-v3-actions", () => ({
  issueHomework: vi.fn(),
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
  { problemId: "p3", label: "수업에서 다룬 것", difficulty: "hard", format: "math" },
];

const homeworkProblem: SessionProblem = {
  number: 1, problemId: "p1", format: "mc", passage: "x", options: ["a", "b"], difficulty: null, correctIndex: null,
  explanation: null, attempts: 0, solved: false, graded: false, grade: null, gradeComment: null, myChoice: null,
  autoCorrect: null, latestWorkId: null, myText: null, acceptedAnswers: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(issueHomework).mockResolvedValue({ ok: true, count: 1 });
  vi.mocked(withdrawHomework).mockResolvedValue({ ok: true });
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload: vi.fn() } });
});

describe("HomeworkTab — 과제 v3 통일(2026-09-14)", () => {
  it("교사: 발급 구역이 위, 과제 문제 패널이 아래. 수업에서 다룬 문제는 기본으로 숨긴다", () => {
    render(
      <HomeworkTab sessionId="s1" studentId="stu" initialItems={[]} viewerRole="teacher" sessionSource="v3" realViewerRole="teacher"
        pool={pool} issued={[]} usedInLessonIds={["p3"]} homeworkProblems={[]} />
    );
    const issue = screen.getByTestId("homework-issue");
    const panel = screen.getByTestId("problems-panel");
    expect(issue.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(panel).toHaveAttribute("data-source", "homework");
    expect(screen.getByLabelText("songbirds …")).toBeInTheDocument();
    expect(screen.queryByLabelText("수업에서 다룬 것")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/수업에서 다룬 문제 1개도 보기/));
    expect(screen.getByLabelText("수업에서 다룬 것")).toBeInTheDocument();
  });

  it("고른 문제를 발급하면 서버에 보내고 화면을 새로 읽는다", async () => {
    render(
      <HomeworkTab sessionId="s1" studentId="stu" initialItems={[]} viewerRole="teacher" sessionSource="v3" realViewerRole="teacher"
        pool={pool} issued={[]} homeworkProblems={[]} />
    );
    const button = screen.getByRole("button", { name: /과제로 발급/ });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByLabelText("songbirds …"));
    fireEvent.click(screen.getByLabelText("coral reefs …"));
    expect(button).toHaveTextContent("과제로 발급 (2)");
    fireEvent.click(button);
    await waitFor(() => expect(issueHomework).toHaveBeenCalledWith("s1", ["p1", "p2"]));
    await waitFor(() => expect(window.location.reload).toHaveBeenCalled());
  });

  it("발급 실패 사유를 보여주고 새로 읽지 않는다", async () => {
    vi.mocked(issueHomework).mockResolvedValue({ ok: false, error: "이 회차의 키워드 범위 밖 문제는 과제로 낼 수 없습니다." });
    render(
      <HomeworkTab sessionId="s1" studentId="stu" initialItems={[]} viewerRole="teacher" sessionSource="v3" realViewerRole="teacher"
        pool={pool} issued={[]} homeworkProblems={[]} />
    );
    fireEvent.click(screen.getByLabelText("songbirds …"));
    fireEvent.click(screen.getByRole("button", { name: /과제로 발급/ }));
    expect(await screen.findByText(/키워드 범위 밖/)).toBeInTheDocument();
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("발급된 항목은 목록에 있고, 학생이 시작하기 전에만 회수할 수 있다", async () => {
    render(
      <HomeworkTab sessionId="s1" studentId="stu" initialItems={[]} viewerRole="teacher" sessionSource="v3" realViewerRole="teacher"
        pool={pool}
        issued={[{ itemId: "h1", problemId: "p1", position: 1, started: false }, { itemId: "h2", problemId: "p2", position: 2, started: true }]}
        homeworkProblems={[homeworkProblem]} />
    );
    // 이미 발급된 문제는 고르기 목록에서 빠진다.
    fireEvent.click(screen.getByRole("button", { name: "문제 고르기" }));
    expect(screen.queryByLabelText("songbirds …")).not.toBeInTheDocument();
    expect(screen.getByText("풀이 시작함")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "회수" }));
    await waitFor(() => expect(withdrawHomework).toHaveBeenCalledWith("h1"));
  });

  it("학생: 발급 구역이 없고 과제 문제 패널만 있다", () => {
    render(
      <HomeworkTab sessionId="s1" studentId="stu" initialItems={[]} viewerRole="student" sessionSource="v3" realViewerRole="student"
        homeworkProblems={[homeworkProblem]} />
    );
    expect(screen.queryByTestId("homework-issue")).not.toBeInTheDocument();
    expect(screen.getByText("과제 1")).toBeInTheDocument();
  });

  it("교사가 학생 시점으로 볼 때(데모션)는 발급할 수 없다", () => {
    render(
      <HomeworkTab sessionId="s1" studentId="stu" initialItems={[]} viewerRole="student" sessionSource="v3" realViewerRole="teacher"
        pool={pool} homeworkProblems={[]} />
    );
    // 실제 역할이 교사면 발급 구역은 남는다 — 학생 화면을 함께 보며 낼 수 있어야 한다.
    expect(screen.getByTestId("homework-issue")).toBeInTheDocument();
    expect(screen.queryByText("+ 과제 추가")).not.toBeInTheDocument();
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
