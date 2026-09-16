import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import HomeworkTab from "./HomeworkTab";
import { loadHomeworkBatchIntoSession, withdrawHomework } from "./homework-v3-actions";
import type { SessionProblem } from "./session-problem-data";

vi.mock("./homework-v3-actions", () => ({
  loadHomeworkBatchIntoSession: vi.fn(),
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

// 2026-09-16 — 과제는 교사 포털에서 학생별로 미리 만든 배치를 세션뷰에서 불러오는 방식으로 바뀌었다.
const batches = [
  { id: "b1", createdAt: "2026-09-15T00:00:00Z", loadedAt: null, problemCount: 4, requests: [{ keywordId: "k1", count: 4, label: "Words in Context" }] },
  { id: "b2", createdAt: "2026-09-14T00:00:00Z", loadedAt: "2026-09-14T01:00:00Z", problemCount: 2, requests: [{ keywordId: "k2", count: 2, label: "Linear Equations" }] },
];

const homeworkProblem: SessionProblem = {
  number: 1, problemId: "p1", format: "mc", passage: "x", options: ["a", "b"], difficulty: null, correctIndex: null,
  explanation: null, attempts: 0, solved: false, graded: false, grade: null, gradeComment: null, myChoice: null,
  autoCorrect: null, latestWorkId: null, myText: null, acceptedAnswers: null, figure: null, statements: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadHomeworkBatchIntoSession).mockResolvedValue({ ok: true, count: 4 });
  vi.mocked(withdrawHomework).mockResolvedValue({ ok: true });
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload: vi.fn() } });
});

describe("HomeworkTab — 과제 배치 불러오기(2026-09-16)", () => {
  it("교사: 발급 구역이 위, 과제 문제 패널이 아래. 교사 포털에서 만든 배치 목록이 보인다", () => {
    render(
      <HomeworkTab sessionId="s1" studentId="stu" initialItems={[]} viewerRole="teacher" sessionSource="v3" realViewerRole="teacher"
        pool={pool} issued={[]} batches={batches} homeworkProblems={[]} />
    );
    const issue = screen.getByTestId("homework-issue");
    const panel = screen.getByTestId("problems-panel");
    expect(issue.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(panel).toHaveAttribute("data-source", "homework");
    expect(screen.getByText(/4문항 · Words in Context 4/)).toBeInTheDocument();
    expect(screen.getByText(/2문항 · Linear Equations 2/)).toBeInTheDocument();
    expect(screen.getByText(/불러온 적 있음/)).toBeInTheDocument();
  });

  it("배치를 불러오기 하면 서버에 보내고 화면을 새로 읽는다", async () => {
    render(
      <HomeworkTab sessionId="s1" studentId="stu" initialItems={[]} viewerRole="teacher" sessionSource="v3" realViewerRole="teacher"
        pool={pool} issued={[]} batches={batches} homeworkProblems={[]} />
    );
    fireEvent.click(screen.getAllByRole("button", { name: "이 수업에 불러오기" })[0]);
    await waitFor(() => expect(loadHomeworkBatchIntoSession).toHaveBeenCalledWith("b1", "s1"));
    await waitFor(() => expect(window.location.reload).toHaveBeenCalled());
  });

  it("불러오기 실패 사유를 보여주고 새로 읽지 않는다. 이미 전부 발급됐으면 그 사실을 말한다", async () => {
    vi.mocked(loadHomeworkBatchIntoSession).mockResolvedValue({ ok: false, error: "이 수업의 학생과 과제 배치의 학생이 다릅니다." });
    render(
      <HomeworkTab sessionId="s1" studentId="stu" initialItems={[]} viewerRole="teacher" sessionSource="v3" realViewerRole="teacher"
        pool={pool} issued={[]} batches={batches} homeworkProblems={[]} />
    );
    fireEvent.click(screen.getAllByRole("button", { name: "이 수업에 불러오기" })[0]);
    expect(await screen.findByText(/이 수업의 학생과 과제 배치의 학생이 다릅니다/)).toBeInTheDocument();
    expect(window.location.reload).not.toHaveBeenCalled();

    vi.mocked(loadHomeworkBatchIntoSession).mockResolvedValue({ ok: true, count: 0 });
    fireEvent.click(screen.getAllByRole("button", { name: "이 수업에 불러오기" })[0]);
    expect(await screen.findByText(/이미 전부 발급된 배치라/)).toBeInTheDocument();
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("배치가 없으면 그 사실을 안내한다", () => {
    render(
      <HomeworkTab sessionId="s1" studentId="stu" initialItems={[]} viewerRole="teacher" sessionSource="v3" realViewerRole="teacher"
        pool={pool} issued={[]} batches={[]} homeworkProblems={[]} />
    );
    expect(screen.getByText(/아직 만든 과제 배치가 없습니다/)).toBeInTheDocument();
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
