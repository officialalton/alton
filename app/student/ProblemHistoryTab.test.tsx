import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProblemHistoryTab from "./ProblemHistoryTab";
import type { ProblemHistoryEntry } from "./problem-history-data";

vi.mock("@/app/session/[id]/problem-image-actions", () => ({ getProblemImageUrlAction: vi.fn() }));

const base: ProblemHistoryEntry = {
  workId: "w1", sessionId: "s1", source: "lesson", subjectName: "SAT", startsAt: null, unitTitle: "1회차", format: "mc",
  passage: "Which word?", options: ["harvested", "developed"], figure: null, myChoice: 0, myText: null, submittedAt: "2026-09-14T00:00:00Z",
  graded: false, grade: null, gradeComment: null, correctIndex: null, acceptedAnswers: null, explanation: null,
};

describe("ProblemHistoryTab — 학생 포털 문제 기록(v3, 2026-09-14)", () => {
  it("비어 있으면 그렇게 말한다", () => {
    render(<ProblemHistoryTab entries={[]} />);
    expect(screen.getByText("조건에 맞는 문제 기록이 없습니다.")).toBeInTheDocument();
  });

  it("채점 전엔 정답·해설이 없고 채점 대기로, 채점 뒤엔 결과·정답·해설이 펼쳐진다", () => {
    const graded: ProblemHistoryEntry = {
      ...base, workId: "w2", source: "homework", graded: true, grade: "incorrect", gradeComment: "다시 보자", correctIndex: 1, explanation: "developed 가 맞다",
    };
    render(<ProblemHistoryTab entries={[base, graded]} />);
    // 필터 칩에도 같은 글자가 있어 목록 배지만 센다.
    expect(screen.getAllByText("채점 대기").length).toBe(2);
    expect(screen.getAllByText("오답").length).toBe(2);
    fireEvent.click(screen.getAllByRole("button", { expanded: false })[0]);
    expect(screen.getByText(/선생님이 채점하면 정답과 해설이 여기에/)).toBeInTheDocument();
    expect(screen.queryByText("developed 가 맞다")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { expanded: false })[0]);
    expect(screen.getByText("developed 가 맞다")).toBeInTheDocument();
    expect(screen.getByText(/다시 보자/)).toBeInTheDocument();
  });

  it("채점·출처 필터가 동작한다", () => {
    const graded: ProblemHistoryEntry = { ...base, workId: "w2", source: "homework", graded: true, grade: "correct", correctIndex: 0 };
    render(<ProblemHistoryTab entries={[base, graded]} />);
    fireEvent.click(screen.getByRole("button", { name: "정답" }));
    expect(screen.getAllByText("Which word?").length).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "채점 대기", pressed: false }));
    fireEvent.click(screen.getByRole("button", { name: "과제" }));
    expect(screen.getByText("조건에 맞는 문제 기록이 없습니다.")).toBeInTheDocument();
  });
});
