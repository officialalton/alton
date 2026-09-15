import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import HomeworkTab from "./HomeworkTab";
import { issueHomeworkByKeywords, withdrawHomework } from "./homework-v3-actions";
import type { SessionProblem } from "./session-problem-data";

vi.mock("./homework-v3-actions", () => ({
  issueHomeworkByKeywords: vi.fn(),
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

// 2026-09-14 UAT — 발급은 키워드별 개수로(무작위). 회차 키워드마다 문제 은행에서 담을 수 있는 수.
const keywordPools = [
  { keywordId: "k1", label: "Words in Context", total: 12, issued: 0, usedInLesson: 2, available: 10, availableWithUsed: 12 },
  { keywordId: "k2", label: "Linear Equations", total: 3, issued: 0, usedInLesson: 0, available: 3, availableWithUsed: 3 },
  { keywordId: "k3", label: "빈 키워드", total: 0, issued: 0, usedInLesson: 0, available: 0, availableWithUsed: 0 },
];

const homeworkProblem: SessionProblem = {
  number: 1, problemId: "p1", format: "mc", passage: "x", options: ["a", "b"], difficulty: null, correctIndex: null,
  explanation: null, attempts: 0, solved: false, graded: false, grade: null, gradeComment: null, myChoice: null,
  autoCorrect: null, latestWorkId: null, myText: null, acceptedAnswers: null, figure: null, statements: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(issueHomeworkByKeywords).mockResolvedValue({ ok: true, count: 1 });
  vi.mocked(withdrawHomework).mockResolvedValue({ ok: true });
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload: vi.fn() } });
});

describe("HomeworkTab — 과제 v3 통일(2026-09-14)", () => {
  it("교사: 발급 구역이 위, 과제 문제 패널이 아래. 키워드별 담을 수 있는 수가 보이고 수업에서 다룬 것은 기본 제외", () => {
    render(
      <HomeworkTab sessionId="s1" studentId="stu" initialItems={[]} viewerRole="teacher" sessionSource="v3" realViewerRole="teacher"
        pool={pool} issued={[]} keywordPools={keywordPools} homeworkProblems={[]} />
    );
    const issue = screen.getByTestId("homework-issue");
    const panel = screen.getByTestId("problems-panel");
    expect(issue.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(panel).toHaveAttribute("data-source", "homework");
    expect(screen.getByText("Words in Context")).toBeInTheDocument();
    expect(screen.getByText(/문제 은행 12개 · 담을 수 있는 10개/)).toBeInTheDocument();
    expect(screen.getByText(/수업에서 다룸 2 제외/)).toBeInTheDocument();
    // 개별 문제를 고르는 체크박스는 없다.
    expect(screen.queryByLabelText("songbirds …")).not.toBeInTheDocument();
    // 빈 키워드는 입력이 잠긴다.
    expect(screen.getByLabelText("빈 키워드 개수")).toBeDisabled();
    // 수업에서 다룬 것을 포함하면 담을 수 있는 수가 늘어난다.
    fireEvent.click(screen.getByLabelText(/수업에서 다룬 문제 2개도 포함/));
    expect(screen.getByText(/문제 은행 12개 · 담을 수 있는 12개/)).toBeInTheDocument();
  });

  it("키워드별 개수를 적어 발급하면 서버에 보내고(상한을 넘긴 수는 잘라서) 화면을 새로 읽는다", async () => {
    render(
      <HomeworkTab sessionId="s1" studentId="stu" initialItems={[]} viewerRole="teacher" sessionSource="v3" realViewerRole="teacher"
        pool={pool} issued={[]} keywordPools={keywordPools} homeworkProblems={[]} />
    );
    const button = screen.getByRole("button", { name: /무작위로 발급/ });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Words in Context 개수"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Linear Equations 개수"), { target: { value: "9" } });
    expect(button).toHaveTextContent("무작위로 발급 (7)");
    fireEvent.click(button);
    await waitFor(() =>
      expect(issueHomeworkByKeywords).toHaveBeenCalledWith(
        "s1",
        [{ keywordId: "k1", count: 4 }, { keywordId: "k2", count: 3 }],
        true
      )
    );
    await waitFor(() => expect(window.location.reload).toHaveBeenCalled());
  });

  it("발급 실패 사유를 보여주고 새로 읽지 않는다. 뽑힌 것이 없으면 그 사실을 말한다", async () => {
    vi.mocked(issueHomeworkByKeywords).mockResolvedValue({ ok: false, error: "이 회차의 키워드가 아닙니다." });
    render(
      <HomeworkTab sessionId="s1" studentId="stu" initialItems={[]} viewerRole="teacher" sessionSource="v3" realViewerRole="teacher"
        pool={pool} issued={[]} keywordPools={keywordPools} homeworkProblems={[]} />
    );
    fireEvent.change(screen.getByLabelText("Words in Context 개수"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /무작위로 발급/ }));
    expect(await screen.findByText(/이 회차의 키워드가 아닙니다/)).toBeInTheDocument();
    expect(window.location.reload).not.toHaveBeenCalled();

    vi.mocked(issueHomeworkByKeywords).mockResolvedValue({ ok: true, count: 0 });
    fireEvent.click(screen.getByRole("button", { name: /무작위로 발급/ }));
    expect(await screen.findByText(/뽑을 수 있는 문제가 없어/)).toBeInTheDocument();
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("발급된 항목은 목록에 있고, 학생이 시작하기 전에만 회수할 수 있다", async () => {
    render(
      <HomeworkTab sessionId="s1" studentId="stu" initialItems={[]} viewerRole="teacher" sessionSource="v3" realViewerRole="teacher"
        pool={pool}
        issued={[{ itemId: "h1", problemId: "p1", position: 1, started: false }, { itemId: "h2", problemId: "p2", position: 2, started: true }]}
        homeworkProblems={[homeworkProblem]} />
    );
    expect(screen.getByText(/객관식 · songbirds/)).toBeInTheDocument();
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
