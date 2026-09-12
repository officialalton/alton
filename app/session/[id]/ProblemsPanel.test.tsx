import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ProblemsPanel from "./ProblemsPanel";
import type { SessionProblem } from "./session-problem-data";
import {
  appendProblemWorkStrokes,
  openProblemWork,
  submitProblemWork,
  listProblemAttempts,
  loadProblemWorkBoard,
} from "./problem-work-actions";

vi.mock("./problem-work-actions", () => ({
  openProblemWork: vi.fn(),
  submitProblemWork: vi.fn(),
  listProblemAttempts: vi.fn(),
  loadProblemWorkBoard: vi.fn(),
  appendProblemWorkStrokes: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
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

  (openProblemWork as ReturnType<typeof vi.fn>).mockResolvedValue({
    workId: "w1",
    attemptNo: 1,
    submitted: false,
    submittedChoiceIndex: null,
    submittedText: null,
    submittedStrokeSeq: null,
    studentStrokes: [],
    strokesAfterSubmit: [],
    feedbackStrokes: [],
  });
  (loadProblemWorkBoard as ReturnType<typeof vi.fn>).mockResolvedValue({
    workId: "w1",
    attemptNo: 1,
    submitted: true,
    submittedChoiceIndex: 0,
    submittedText: null,
    submittedStrokeSeq: "10",
    studentStrokes: [],
    strokesAfterSubmit: [],
    feedbackStrokes: [],
  });
  (listProblemAttempts as ReturnType<typeof vi.fn>).mockResolvedValue([
    { workId: "w1", attemptNo: 1, submitted: false },
  ]);
});

const unsolved: SessionProblem = {
  number: 1,
  problemId: "p1",
  passage: "첫 번째 지문",
  options: ["가", "나"],
  difficulty: "hard",
  correctIndex: null,
  explanation: null,
  attempts: 0,
  solved: false,
};

const second: SessionProblem = {
  ...unsolved,
  number: 2,
  problemId: "p2",
  passage: "두 번째 지문",
};

function renderPanel(
  problems: SessionProblem[],
  viewerRole: "student" | "teacher" | "parent" | "admin" = "student"
) {
  return render(
    <ProblemsPanel sessionId="s1" studentId="stu1" problems={problems} viewerRole={viewerRole} />
  );
}

describe("ProblemsPanel — 문제를 보면서 풀이판을 연다", () => {
  it("고정된 문제가 없으면 빈 상태를 설명한다", () => {
    renderPanel([]);
    expect(screen.getByText("이 수업에는 문제가 없습니다")).toBeInTheDocument();
  });

  it("문제 번호·난이도·풀이 상태를 사람이 읽는 말로 보여준다", () => {
    renderPanel([unsolved]);
    expect(screen.getByText("문제 1")).toBeInTheDocument();
    expect(screen.getByText("어려움")).toBeInTheDocument();
    expect(screen.getByText("아직 풀지 않음")).toBeInTheDocument();
  });

  it("내부 id나 기술 상태값을 노출하지 않는다", () => {
    const { container } = renderPanel([unsolved]);
    expect(container.textContent).not.toContain("p1");
    expect(container.textContent).not.toContain("hard");
    expect(container.textContent).not.toContain("problem_student");
  });

  it("제출 전에는 정답·해설을 보여주지 않고, 그 이유를 알려준다", () => {
    renderPanel([unsolved]);
    expect(screen.getByText(/풀이를 제출하면 정답과 해설이 열립니다/)).toBeInTheDocument();
    expect(screen.queryByText("정답")).not.toBeInTheDocument();
  });

  it("제출한 문제는 정답과 해설을 함께 보여준다", () => {
    renderPanel([
      { ...unsolved, solved: true, attempts: 1, correctIndex: 1, explanation: "이래서 나가 정답" },
    ]);
    expect(screen.getByText("정답")).toBeInTheDocument();
    expect(screen.getByText("이래서 나가 정답")).toBeInTheDocument();
    expect(screen.getByText("제출함")).toBeInTheDocument();
  });

  it("문제마다 자기 풀이판을 연다 — 다른 문제의 풀이판을 열지 않는다", async () => {
    renderPanel([unsolved, second]);
    fireEvent.click(screen.getAllByText("✏️ 풀이판 열기")[1]);
    await waitFor(() =>
      expect(openProblemWork).toHaveBeenCalledWith(
        expect.objectContaining({ problemId: "p2", sessionId: "s1", studentId: "stu1" })
      )
    );
    expect(openProblemWork).not.toHaveBeenCalledWith(expect.objectContaining({ problemId: "p1" }));
  });

  it("학생은 다시 풀기로 새 풀이를 시작한다", async () => {
    renderPanel([unsolved]);
    fireEvent.click(screen.getByText("✏️ 풀이판 열기"));
    fireEvent.click(await screen.findByText("다시 풀기"));
    await waitFor(() =>
      expect(openProblemWork).toHaveBeenCalledWith(expect.objectContaining({ newAttempt: true }))
    );
  });

  it("이전 풀이가 여러 개면 골라서 다시 볼 수 있다", async () => {
    (listProblemAttempts as ReturnType<typeof vi.fn>).mockResolvedValue([
      { workId: "w1", attemptNo: 1, submitted: true },
      { workId: "w2", attemptNo: 2, submitted: false },
    ]);
    (loadProblemWorkBoard as ReturnType<typeof vi.fn>).mockResolvedValue({
      workId: "w1",
      attemptNo: 1,
      submitted: true,
      submittedChoiceIndex: 0,
      submittedText: null,
      submittedStrokeSeq: "5",
      studentStrokes: [],
      strokesAfterSubmit: [],
      feedbackStrokes: [],
    });
    renderPanel([unsolved]);
    fireEvent.click(screen.getByText("✏️ 풀이판 열기"));
    fireEvent.click(await screen.findByText("1번째"));
    await waitFor(() => expect(loadProblemWorkBoard).toHaveBeenCalledWith("w1"));
  });

  it("제출 전에 저장하지 못하면 제출하지 않고 이유를 알려준다", async () => {
    (appendProblemWorkStrokes as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("네트워크"));
    renderPanel([unsolved]);
    fireEvent.click(screen.getByText("✏️ 풀이판 열기"));
    const canvas = await screen.findByTestId("problem-work-canvas");
    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
    fireEvent.pointerMove(canvas, { clientX: 40, clientY: 40 });
    fireEvent.pointerUp(canvas);

    fireEvent.click(screen.getByText("가"));
    fireEvent.click(screen.getByText("풀이 제출"));
    await waitFor(() =>
      expect(screen.getByText(/필기를 저장하지 못해 제출하지 않았습니다/)).toBeInTheDocument()
    );
    expect(submitProblemWork).not.toHaveBeenCalled();
    // 제출 버튼이 그대로 남아 다시 시도할 수 있다.
    expect(screen.getByText("풀이 제출")).toBeInTheDocument();
  });

  it("제출하면 아직 저장되지 않은 필기를 먼저 저장한다", async () => {
    (appendProblemWorkStrokes as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    renderPanel([unsolved]);
    fireEvent.click(screen.getByText("✏️ 풀이판 열기"));
    const canvas = await screen.findByTestId("problem-work-canvas");
    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
    fireEvent.pointerMove(canvas, { clientX: 40, clientY: 40 });
    fireEvent.pointerUp(canvas);

    fireEvent.click(screen.getByText("가"));
    fireEvent.click(screen.getByText("풀이 제출"));
    await waitFor(() => expect(appendProblemWorkStrokes).toHaveBeenCalled());
    await waitFor(() => expect(submitProblemWork).toHaveBeenCalled());
  });

  it("학생이 풀이를 제출하면 서버에 기록한다", async () => {
    renderPanel([unsolved]);
    fireEvent.click(screen.getByText("✏️ 풀이판 열기"));
    // 객관식은 답을 고른 뒤에야 제출할 수 있다.
    fireEvent.click(await screen.findByText("가"));
    fireEvent.click(screen.getByText("풀이 제출"));
    await waitFor(() =>
      expect(submitProblemWork).toHaveBeenCalledWith("w1", { choiceIndex: 0 })
    );
  });

  it("교사가 그리면 피드백 레이어로 기록된다고 알려준다", async () => {
    renderPanel([unsolved], "teacher");
    fireEvent.click(screen.getByText("✏️ 풀이판 열기"));
    expect(await screen.findByText("피드백으로 기록됩니다")).toBeInTheDocument();
    // 교사에게는 학생용 제출·재풀이 버튼이 없다.
    expect(screen.queryByText("풀이 제출")).not.toBeInTheDocument();
    expect(screen.queryByText("다시 풀기")).not.toBeInTheDocument();
  });

  it("보호자는 읽기 전용으로 열람한다", async () => {
    renderPanel([unsolved], "parent");
    fireEvent.click(screen.getByText("✏️ 풀이판 열기"));
    expect(await screen.findByText("보호자는 읽기 전용입니다")).toBeInTheDocument();
    expect(screen.queryByText("풀이 제출")).not.toBeInTheDocument();
    expect(screen.queryByText("지우개")).not.toBeInTheDocument();
  });

  it("제출한 뒤에는 그 풀이를 고칠 수 없다고 안내한다", async () => {
    (openProblemWork as ReturnType<typeof vi.fn>).mockResolvedValue({
      workId: "w1",
      attemptNo: 1,
      submitted: true,
      submittedChoiceIndex: 1,
      submittedText: null,
      submittedStrokeSeq: "5",
      studentStrokes: [],
      strokesAfterSubmit: [],
      feedbackStrokes: [],
    });
    renderPanel([{ ...unsolved, solved: true }]);
    fireEvent.click(screen.getByText("✏️ 풀이판 열기"));
    expect(await screen.findByText(/제출한 풀이는 고칠 수 없습니다/)).toBeInTheDocument();
  });

  it("선생님 피드백은 별도 레이어로 켜고 끌 수 있다", async () => {
    (openProblemWork as ReturnType<typeof vi.fn>).mockResolvedValue({
      workId: "w1",
      attemptNo: 1,
      submitted: false,
      submittedChoiceIndex: null,
      submittedText: null,
      submittedStrokeSeq: null,
      studentStrokes: [],
      strokesAfterSubmit: [],
      feedbackStrokes: [{ x0: 0, y0: 0, x1: 1, y1: 1, color: "#000", tool: "pen" }],
    });
    renderPanel([unsolved]);
    fireEvent.click(screen.getByText("✏️ 풀이판 열기"));
    const toggle = await screen.findByText("선생님 피드백");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(toggle);
    expect(screen.getByText("선생님 피드백")).toHaveAttribute("aria-pressed", "false");
  });

  it("풀이판을 열지 못하면 사유를 보여준다", async () => {
    (openProblemWork as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("이 풀이판을 열 권한이 없습니다.")
    );
    renderPanel([unsolved]);
    fireEvent.click(screen.getByText("✏️ 풀이판 열기"));
    expect(await screen.findByText("이 풀이판을 열 권한이 없습니다.")).toBeInTheDocument();
  });
});
