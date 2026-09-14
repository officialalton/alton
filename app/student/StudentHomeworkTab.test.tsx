import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StudentHomeworkTab from "./StudentHomeworkTab";
import * as homeworkActions from "@/app/session/[id]/homework-actions";
import * as homeworkV3Actions from "./homework-v3-actions";
import type { StudentHomeworkItem } from "./homework-data";
import type { StudentHomeworkV3Item } from "./homework-v3-data";

vi.mock("@/app/session/[id]/homework-actions", () => ({
  saveHomeworkAnswer: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./homework-v3-actions", () => ({
  saveHomeworkV3Draft: vi.fn().mockResolvedValue(undefined),
  submitHomeworkV3: vi.fn().mockResolvedValue(undefined),
}));

const todoItem: StudentHomeworkItem = {
  id: "hw1",
  sessionId: "s1",
  subjectName: "SAT Math",
  sessionNumber: 8,
  title: "이차방정식 연습",
  description: "다음 문제를 풀어보세요.",
  studentAnswer: null,
  graded: false,
  score: null,
};

describe("StudentHomeworkTab", () => {
  it("작성 필요 항목이 과목·회차로 그룹핑되어 보인다", () => {
    render(<StudentHomeworkTab initialTodo={[todoItem]} initialDone={[]} />);
    expect(screen.getByText("SAT Math · 8회차")).toBeInTheDocument();
    expect(screen.getByText("이차방정식 연습")).toBeInTheDocument();
  });

  it("답안을 작성하고 블러하면 저장되고 작성완료로 옮겨간다", async () => {
    render(<StudentHomeworkTab initialTodo={[todoItem]} initialDone={[]} />);
    fireEvent.click(screen.getByText("이차방정식 연습"));
    fireEvent.change(screen.getByPlaceholderText("답안을 작성하세요"), {
      target: { value: "x=2" },
    });
    fireEvent.blur(screen.getByPlaceholderText("답안을 작성하세요"));
    await waitFor(() =>
      expect(homeworkActions.saveHomeworkAnswer).toHaveBeenCalledWith("hw1", "x=2")
    );
    fireEvent.click(screen.getByText("작성 완료"));
    expect(screen.getByText(/이차방정식 연습 · 제출완료/)).toBeInTheDocument();
  });

  it("채점 완료된 항목은 점수를 보여준다", () => {
    const graded: StudentHomeworkItem = {
      ...todoItem,
      studentAnswer: "x=2",
      graded: true,
      score: "8/10",
    };
    render(<StudentHomeworkTab initialTodo={[]} initialDone={[graded]} />);
    fireEvent.click(screen.getByText("작성 완료"));
    fireEvent.click(screen.getByText(/제출완료 · 채점완료/));
    expect(screen.getByText("점수: 8/10")).toBeInTheDocument();
  });
});

// Gap 1 (2026-09-08) — format별 렌더링/저장 모양 검증.
describe("StudentHomeworkTab — v3 과제 format별 렌더링(Gap 1)", () => {
  const mcItem: StudentHomeworkV3Item = {
    id: "v3-mc-1",
    sessionId: "s1",
    problemId: "p1",
    position: 1,
    composedAt: "2026-01-01",
    contentVisible: true,
    problem: { passage: "다음 중 소수는?", options: ["4", "7", "9"], format: "mc" },
    attempt: null,
  };

  const essayItem: StudentHomeworkV3Item = {
    id: "v3-essay-1",
    sessionId: "s1",
    problemId: "p2",
    position: 2,
    composedAt: "2026-01-01",
    contentVisible: true,
    problem: { passage: "이 지문을 요약하시오.", options: null, format: "essay" },
    attempt: null,
  };

  it("객관식: 보기를 선택해 임시 저장 후 제출하면 { type: 'mc', selected } 모양으로 저장되고, 제출 후 읽기전용이 된다", async () => {
    render(
      <StudentHomeworkTab initialTodo={[]} initialDone={[]} initialV3Items={[mcItem]} />
    );
    fireEvent.click(screen.getByText("과제 #1"));
    fireEvent.click(screen.getByText("7"));

    fireEvent.click(screen.getByText("임시 저장"));
    await waitFor(() =>
      expect(homeworkV3Actions.saveHomeworkV3Draft).toHaveBeenCalledWith("v3-mc-1", {
        type: "mc",
        selected: 1,
      })
    );

    fireEvent.click(screen.getByText("제출하기"));
    await waitFor(() =>
      expect(homeworkV3Actions.submitHomeworkV3).toHaveBeenCalledWith("v3-mc-1", {
        type: "mc",
        selected: 1,
      })
    );

    // 제출 후: 더 이상 저장/제출 버튼이 없고(읽기전용), 라벨에 제출완료가 붙는다.
    await waitFor(() =>
      expect(screen.getByText(/과제 #1 · 제출완료/)).toBeInTheDocument()
    );
    expect(screen.queryByText("제출하기")).not.toBeInTheDocument();
    expect(screen.queryByText("임시 저장")).not.toBeInTheDocument();
  });

  it("서술형: 텍스트를 작성해 임시 저장 후 제출하면 { type: 'text', text } 모양으로 저장되고, 제출 후 읽기전용이 된다", async () => {
    render(
      <StudentHomeworkTab initialTodo={[]} initialDone={[]} initialV3Items={[essayItem]} />
    );
    fireEvent.click(screen.getByText("과제 #2"));
    const textarea = screen.getByPlaceholderText("답안을 작성하세요");
    fireEvent.change(textarea, { target: { value: "요약: ..." } });

    fireEvent.click(screen.getByText("임시 저장"));
    await waitFor(() =>
      expect(homeworkV3Actions.saveHomeworkV3Draft).toHaveBeenCalledWith("v3-essay-1", {
        type: "text",
        text: "요약: ...",
      })
    );

    fireEvent.click(screen.getByText("제출하기"));
    await waitFor(() =>
      expect(homeworkV3Actions.submitHomeworkV3).toHaveBeenCalledWith("v3-essay-1", {
        type: "text",
        text: "요약: ...",
      })
    );

    await waitFor(() =>
      expect(screen.getByText(/과제 #2 · 제출완료/)).toBeInTheDocument()
    );
    expect(
      screen.getByPlaceholderText("답안을 작성하세요")
    ).toBeDisabled();
  });

  it("이미 제출된 항목(attempt.submitted=true)은 처음부터 읽기전용으로 보이고 저장/제출 버튼이 없다", () => {
    const submittedMc: StudentHomeworkV3Item = {
      ...mcItem,
      attempt: { id: "a1", response: { type: "mc", selected: 0 }, submitted: true },
    };
    render(
      <StudentHomeworkTab initialTodo={[]} initialDone={[]} initialV3Items={[submittedMc]} />
    );
    fireEvent.click(screen.getByText(/과제 #1 · 제출완료/));
    expect(screen.queryByText("임시 저장")).not.toBeInTheDocument();
    expect(screen.queryByText("제출하기")).not.toBeInTheDocument();
  });

  it("제출 실패(이미 제출됨 등 DB 거부)를 그대로 던진다 — 액션 레이어가 DB 거부를 흡수/무시하지 않는다", async () => {
    vi.mocked(homeworkV3Actions.submitHomeworkV3).mockRejectedValueOnce(
      new Error("제출된 과제 답안은 더 이상 수정할 수 없습니다.")
    );
    render(
      <StudentHomeworkTab initialTodo={[]} initialDone={[]} initialV3Items={[essayItem]} />
    );
    fireEvent.click(screen.getByText("과제 #2"));
    fireEvent.change(screen.getByPlaceholderText("답안을 작성하세요"), {
      target: { value: "재제출 시도" },
    });
    fireEvent.click(screen.getByText("제출하기"));

    await waitFor(() =>
      expect(homeworkV3Actions.submitHomeworkV3).toHaveBeenCalled()
    );
    // 거부됐으므로 submitted 상태로 전환되지 않는다 — 저장/제출 버튼이 계속 남아있다.
    expect(screen.getByText("제출하기")).toBeInTheDocument();
  });
});
