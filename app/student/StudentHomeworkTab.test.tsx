import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StudentHomeworkTab from "./StudentHomeworkTab";
import * as homeworkActions from "@/app/session/[id]/homework-actions";
import type { StudentHomeworkItem } from "./homework-data";
import type { StudentHomeworkSet } from "./homework-v3-data";

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

// Gap 1 (2026-09-08) — format별 렌더링/저장 모양 검증.

describe("StudentHomeworkTab — 수업별 과제 묶음(2026-09-14 과제 v3 통일)", () => {
  const sets: StudentHomeworkSet[] = [
    { sessionId: "sess-1", subjectName: "SAT Reading", startsAt: "2026-09-15T11:30:00.000Z", total: 3, answered: 1, graded: 0, composedAt: "2026-09-14T00:00:00Z" },
    { sessionId: "sess-2", subjectName: "SAT Math", startsAt: null, total: 2, answered: 2, graded: 2, composedAt: "2026-09-13T00:00:00Z" },
  ];

  it("회차별 묶음 카드가 그 수업의 과제 탭으로 연결되고 진행 상태를 보여준다", () => {
    render(<StudentHomeworkTab initialTodo={[]} initialDone={[]} homeworkSets={sets} />);
    const first = screen.getByText(/SAT Reading/).closest("a");
    expect(first).toHaveAttribute("href", "/session/sess-1?tab=homework");
    expect(screen.getByText("3문제 · 푼 것 1 · 채점 0 · 열기 →")).toBeInTheDocument();
    expect(screen.getByText("풀 것 있음")).toBeInTheDocument();
    expect(screen.getByText("채점 완료")).toBeInTheDocument();
    // 여기서는 답을 쓰지 않는다 — 입력이 없다.
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("묶음이 없으면 섹션 자체가 없다", () => {
    render(<StudentHomeworkTab initialTodo={[]} initialDone={[]} homeworkSets={[]} />);
    expect(screen.queryByText("수업별 과제")).not.toBeInTheDocument();
  });
});
