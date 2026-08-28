import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StudentHomeworkTab from "./StudentHomeworkTab";
import * as homeworkActions from "@/app/session/[id]/homework-actions";
import type { StudentHomeworkItem } from "./homework-data";

vi.mock("@/app/session/[id]/homework-actions", () => ({
  saveHomeworkAnswer: vi.fn().mockResolvedValue(undefined),
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
