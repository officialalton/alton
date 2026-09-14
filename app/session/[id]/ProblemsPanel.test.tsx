import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ProblemsPanel from "./ProblemsPanel";
import type { SessionProblem } from "./session-problem-data";
import {
  answerMcChoice,
  gradeProblemAttempt,
  listProblemAttempts,
  loadProblemWorkBoard,
  openProblemWork,
  refreshSessionProblems,
  submitProblemWork,
} from "./problem-work-actions";

vi.mock("./problem-work-actions", () => ({
  openProblemWork: vi.fn(),
  submitProblemWork: vi.fn(),
  listProblemAttempts: vi.fn(),
  loadProblemWorkBoard: vi.fn(),
  appendProblemWorkStrokes: vi.fn(),
  answerMcChoice: vi.fn(),
  gradeProblemAttempt: vi.fn(),
  refreshSessionProblems: vi.fn(),
}));

const sent: unknown[] = [];
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: function on() {
        return this;
      },
      subscribe: function subscribe() {
        return this;
      },
      send: (msg: unknown) => sent.push(msg),
    }),
    removeChannel: vi.fn(),
  }),
}));

const emptyBoard = {
  workId: "w1",
  attemptNo: 1,
  submitted: false,
  submittedChoiceIndex: null,
  submittedText: null,
  submittedStrokeSeq: null,
  studentStrokes: [],
  strokesAfterSubmit: [],
  feedbackStrokes: [],
  autoCorrect: null,
  grade: null,
  gradeComment: null,
  gradedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  sent.length = 0;
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    lineCap: "",
    lineWidth: 0,
    strokeStyle: "",
    globalCompositeOperation: "",
    globalAlpha: 1,
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  vi.mocked(openProblemWork).mockResolvedValue(emptyBoard);
  vi.mocked(loadProblemWorkBoard).mockResolvedValue({ ...emptyBoard, submitted: true, submittedStrokeSeq: "10" });
  vi.mocked(listProblemAttempts).mockResolvedValue([{ workId: "w1", attemptNo: 1, submitted: false }]);
  vi.mocked(answerMcChoice).mockResolvedValue({ ok: true });
  vi.mocked(gradeProblemAttempt).mockResolvedValue({ ok: true });
  vi.mocked(refreshSessionProblems).mockResolvedValue([]);
});

const mc: SessionProblem = {
  number: 1,
  problemId: "p1",
  format: "mc",
  passage: "첫 번째 지문",
  options: ["가", "나"],
  difficulty: "hard",
  correctIndex: null,
  explanation: null,
  attempts: 0,
  solved: false,
  graded: false,
  grade: null,
  gradeComment: null,
  myChoice: null,
  autoCorrect: null,
  latestWorkId: null,
};

const essay: SessionProblem = { ...mc, number: 2, problemId: "p2", format: "essay", options: [], passage: "서술형 지문" };
const math: SessionProblem = { ...mc, number: 3, problemId: "p3", format: "math", options: [], passage: "풀이형 지문" };

function renderPanel(
  problems: SessionProblem[],
  viewerRole: "student" | "teacher" | "parent" | "admin" = "student"
) {
  return render(
    <ProblemsPanel sessionId="s1" studentId="stu1" problems={problems} viewerRole={viewerRole} />
  );
}

describe("ProblemsPanel — 공통", () => {
  it("고정된 문제가 없으면 빈 상태를 설명한다", () => {
    renderPanel([]);
    expect(screen.getByText("이 수업에는 문제가 없습니다")).toBeInTheDocument();
  });

  it("문제 번호·유형·난이도·상태를 사람이 읽는 말로 보여준다", () => {
    renderPanel([mc]);
    expect(screen.getByText("문제 1", { selector: "article header span" })).toBeInTheDocument();
    expect(screen.getByText("객관식")).toBeInTheDocument();
    expect(screen.getByText("어려움")).toBeInTheDocument();
    expect(screen.getByText("아직 풀지 않음")).toBeInTheDocument();
  });

  it("내부 id나 기술 상태값을 노출하지 않는다", () => {
    const { container } = renderPanel([mc]);
    expect(container.textContent).not.toContain("p1");
    expect(container.textContent).not.toContain("hard");
    expect(container.textContent).not.toContain("problem_student");
    expect(container.textContent).not.toContain("mc");
  });

  it("한 번에 한 문제만 보이고, 이전/다음과 목차로 오간다", () => {
    renderPanel([mc, essay]);
    expect(screen.getByText("첫 번째 지문")).toBeInTheDocument();
    expect(screen.queryByText("서술형 지문")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다음 문제 →" }));
    expect(screen.getByText("서술형 지문")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /문제 1/ }));
    expect(screen.getByText("첫 번째 지문")).toBeInTheDocument();
  });

  it("시작 전 미리보기는 읽기만 한다 — 선택지 클릭·풀이판·정답이 없다", () => {
    renderPanel([{ ...mc, planned: true }]);
    expect(screen.getByText("수업 전 미리보기")).toBeInTheDocument();
    expect(screen.getByText(/풀이와 제출은 수업에서 합니다/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /가/ })).toBeDisabled();
    expect(screen.queryByText(/연습장 열기/)).not.toBeInTheDocument();
    expect(screen.queryByText("정답")).not.toBeInTheDocument();
    expect(openProblemWork).not.toHaveBeenCalled();
  });
});

// 2026-09-14 UAT(학생 포털) — 객관식은 선택지 클릭이 곧 답. 풀이판·제출 없음.
describe("ProblemsPanel — 객관식", () => {
  it("학생이 선택지를 누르면 바로 저장되고 '내 답'으로 표시된다 — 제출 버튼은 없다", async () => {
    renderPanel([mc]);
    expect(screen.queryByText("풀이 제출")).not.toBeInTheDocument();
    expect(screen.queryByText(/풀이판 열기/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /나/ }));
    await waitFor(() =>
      expect(answerMcChoice).toHaveBeenCalledWith({ sessionId: "s1", studentId: "stu1", problemId: "p1", choiceIndex: 1 })
    );
    expect(screen.getByText("내 답")).toBeInTheDocument();
    expect(screen.getByText("답 저장됨 · 채점 대기")).toBeInTheDocument();
    expect(await screen.findByText(/답이 저장되었습니다/)).toBeInTheDocument();
    // 상대 화면(교사)에 알린다.
    expect(sent.length).toBeGreaterThan(0);
  });

  it("저장에 실패하면 선택을 되돌리고 사유를 보여준다", async () => {
    vi.mocked(answerMcChoice).mockResolvedValue({ ok: false, error: "이 수업의 문제가 아닙니다." });
    renderPanel([mc]);
    fireEvent.click(screen.getByRole("button", { name: /나/ }));
    expect(await screen.findByText("이 수업의 문제가 아닙니다.")).toBeInTheDocument();
    expect(screen.queryByText("내 답")).not.toBeInTheDocument();
  });

  it("채점 전에는 정답·해설이 없고 그 이유를 알려준다 — 답을 저장했어도", () => {
    renderPanel([{ ...mc, myChoice: 0, solved: true, attempts: 1, latestWorkId: "w1" }]);
    expect(screen.getByText(/선생님이 채점하면 정답과 해설이 열립니다/)).toBeInTheDocument();
    expect(screen.queryByText("정답")).not.toBeInTheDocument();
  });

  it("채점이 끝난 문제는 정답·해설·선생님 채점을 함께 보여주고 더 바꿀 수 없다", () => {
    renderPanel([
      {
        ...mc,
        myChoice: 0,
        solved: true,
        attempts: 1,
        latestWorkId: "w1",
        graded: true,
        grade: "incorrect",
        gradeComment: "다시 읽어 보자",
        correctIndex: 1,
        explanation: "이래서 나가 정답",
      },
    ]);
    expect(screen.getByText("정답")).toBeInTheDocument();
    expect(screen.getByText("이래서 나가 정답")).toBeInTheDocument();
    expect(screen.getByText("채점 완료 · 오답")).toBeInTheDocument();
    expect(screen.getByText("다시 읽어 보자")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /가/ })).toBeDisabled();
  });

  it("연습장은 선택이다 — 열면 풀이판이 연습장으로 붙고 제출은 없다", async () => {
    renderPanel([mc]);
    fireEvent.click(screen.getByRole("button", { name: /연습장 열기/ }));
    await waitFor(() => expect(openProblemWork).toHaveBeenCalled());
    expect(screen.getByText("연습장")).toBeInTheDocument();
    expect(screen.getByText("연습장에 기록됩니다")).toBeInTheDocument();
    expect(screen.queryByText("풀이 제출")).not.toBeInTheDocument();
  });
});

describe("ProblemsPanel — 서술형", () => {
  it("문제를 펼치면 연습장이 바로 열리고, 쓰는 대로 저장된다는 안내가 있다", async () => {
    renderPanel([essay]);
    await waitFor(() =>
      expect(openProblemWork).toHaveBeenCalledWith({ sessionId: "s1", studentId: "stu1", problemId: "p2", newAttempt: false })
    );
    expect(screen.getByText(/아래 연습장에 답을 쓰세요/)).toBeInTheDocument();
    expect(screen.getByText("답안")).toBeInTheDocument();
    expect(screen.queryByText("풀이 제출")).not.toBeInTheDocument();
    expect(screen.queryByText(/풀이판 열기/)).not.toBeInTheDocument();
  });
});

describe("ProblemsPanel — 풀이형", () => {
  it("풀이판을 열고 제출한다 — 제출 전 미저장 필기를 먼저 저장한다", async () => {
    vi.mocked(submitProblemWork).mockResolvedValue(undefined);
    renderPanel([math]);
    fireEvent.click(screen.getByRole("button", { name: /풀이판 열기/ }));
    await waitFor(() => expect(openProblemWork).toHaveBeenCalled());
    expect(screen.getByText("1번째 풀이")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "풀이 제출" }));
    await waitFor(() => expect(submitProblemWork).toHaveBeenCalledWith("w1", {}));
  });

  it("학생은 다시 풀기로 새 풀이를 시작한다", async () => {
    renderPanel([math]);
    fireEvent.click(screen.getByRole("button", { name: /풀이판 열기/ }));
    await waitFor(() => expect(openProblemWork).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "다시 풀기" }));
    await waitFor(() =>
      expect(openProblemWork).toHaveBeenLastCalledWith({ sessionId: "s1", studentId: "stu1", problemId: "p3", newAttempt: true })
    );
  });

  it("제출한 풀이는 채점 대기로 보이고 정답은 아직 없다", () => {
    renderPanel([{ ...math, solved: true, attempts: 1, latestWorkId: "w1" }]);
    expect(screen.getByText("제출함 · 채점 대기")).toBeInTheDocument();
    expect(screen.queryByText("정답")).not.toBeInTheDocument();
  });
});

describe("ProblemsPanel — 교사", () => {
  it("정답·해설은 기본으로 접혀 있고 문제마다 펼친다", () => {
    renderPanel([{ ...mc, correctIndex: 1, explanation: "해설" }], "teacher");
    expect(screen.queryByText("해설", { selector: ".learning-body" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "정답·해설 보기" }));
    expect(screen.getByText("정답")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "정답·해설 숨기기" })).toBeInTheDocument();
  });

  it("학생이 아직 풀지 않은 문제는 채점할 수 없다고 말한다", () => {
    renderPanel([{ ...mc, correctIndex: 1 }], "teacher");
    expect(screen.getByText("학생이 아직 이 문제를 풀지 않았습니다.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "채점 완료" })).not.toBeInTheDocument();
  });

  it("객관식은 학생 답과 자동 채점을 보고 한 번에 확정한다 — 고르지 않으면 자동 채점대로", async () => {
    renderPanel(
      [{ ...mc, correctIndex: 1, myChoice: 1, autoCorrect: true, solved: true, attempts: 1, latestWorkId: "w1" }],
      "teacher"
    );
    expect(screen.getByText(/학생 답:/)).toBeInTheDocument();
    expect(screen.getByText(/자동 채점\(정답\)대로 확정/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "채점 완료" }));
    await waitFor(() => expect(gradeProblemAttempt).toHaveBeenCalledWith({ workId: "w1", grade: null, comment: "" }));
    expect(refreshSessionProblems).toHaveBeenCalledWith("s1");
    expect(sent.length).toBeGreaterThan(0);
  });

  it("서술형·풀이형은 정답/부분/오답을 골라야 채점을 끝낼 수 있고 한마디를 붙인다", async () => {
    renderPanel([{ ...essay, attempts: 1, latestWorkId: "w2" }], "teacher");
    // 서술형은 연습장이 자동으로 열린다 — 그 사이 버튼이 잠깐 잠긴다.
    await waitFor(() => expect(openProblemWork).toHaveBeenCalled());
    const done = screen.getByRole("button", { name: "채점 완료" });
    await waitFor(() => expect(screen.getByText("답안")).toBeInTheDocument());
    expect(done).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "부분 정답" }));
    fireEvent.change(screen.getByLabelText("선생님 한마디"), { target: { value: "근거를 더" } });
    await waitFor(() => expect(done).not.toBeDisabled());
    fireEvent.click(done);
    await waitFor(() =>
      expect(gradeProblemAttempt).toHaveBeenCalledWith({ workId: "w2", grade: "partial", comment: "근거를 더" })
    );
  });

  it("채점이 끝난 문제는 결과를 보여주고 다시 채점할 수 있다", () => {
    renderPanel(
      [{ ...essay, attempts: 1, latestWorkId: "w2", graded: true, grade: "correct", gradeComment: "좋다" }],
      "teacher"
    );
    expect(screen.getByText("채점 완료 · 정답", { selector: "section span" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 채점" }));
    expect(screen.getByRole("button", { name: "채점 완료" })).toBeInTheDocument();
    expect(screen.getByLabelText("선생님 한마디")).toHaveValue("좋다");
  });

  it("채점 실패 사유를 보여준다", async () => {
    vi.mocked(gradeProblemAttempt).mockResolvedValue({ ok: false, error: "이 수업의 담당 선생님만 채점할 수 있습니다." });
    renderPanel([{ ...math, solved: true, attempts: 1, latestWorkId: "w3" }], "teacher");
    fireEvent.click(screen.getByRole("button", { name: "오답" }));
    fireEvent.click(screen.getByRole("button", { name: "채점 완료" }));
    expect(await screen.findByText("이 수업의 담당 선생님만 채점할 수 있습니다.")).toBeInTheDocument();
  });

  it("교사가 그리면 피드백 레이어로 기록된다고 알려준다", async () => {
    renderPanel([math], "teacher");
    fireEvent.click(screen.getByRole("button", { name: /풀이판 열기/ }));
    await waitFor(() => expect(openProblemWork).toHaveBeenCalled());
    expect(screen.getByText("피드백으로 기록됩니다")).toBeInTheDocument();
  });
});

describe("ProblemsPanel — 보호자", () => {
  it("읽기 전용으로 열람한다", async () => {
    renderPanel([math], "parent");
    fireEvent.click(screen.getByRole("button", { name: /풀이판 열기/ }));
    await waitFor(() => expect(openProblemWork).toHaveBeenCalled());
    expect(screen.getByText("보호자는 읽기 전용입니다")).toBeInTheDocument();
    expect(screen.queryByText("풀이 제출")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("채점 결과")).not.toBeInTheDocument();
  });
});
