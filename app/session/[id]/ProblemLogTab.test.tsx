import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProblemLogTab from "./ProblemLogTab";
import * as problemlogActions from "./problemlog-actions";
import type { ProblemLogEntry } from "./problemlog-data";

vi.mock("./problemlog-actions", () => ({
  toggleSaveAttempt: vi.fn().mockResolvedValue(undefined),
  retryMcAttempt: vi.fn(),
  retryEssayAttempt: vi.fn(),
  retryMathAttempt: vi.fn(),
  saveTeacherPick: vi.fn().mockResolvedValue(undefined),
  removeTeacherPick: vi.fn().mockResolvedValue(undefined),
}));

const mcEntry: ProblemLogEntry = {
  attemptId: "a1",
  problemId: "p1",
  format: "mc",
  passage: "다음 중 이차방정식의 해가 아닌 것은?",
  options: ["1", "2", "3", "4"],
  correctIndex: 2,
  explanation: "정답은 3입니다.",
  subjectName: "SAT Math",
  unitTitle: "이차방정식 단원",
  skillType: "개념 문제",
  response: 1,
  correct: false,
  saved: false,
  attemptedAt: "2026-08-20T05:00:00.000Z",
  teacherPick: null,
};

const essayEntry: ProblemLogEntry = {
  attemptId: "a2",
  problemId: "p2",
  format: "essay",
  passage: "다음 지문을 요약하시오.",
  options: null,
  correctIndex: null,
  explanation: "모범 답안 예시",
  subjectName: "SAT Reading & Writing",
  unitTitle: null,
  skillType: "Text Structure",
  response: "제 답안입니다",
  correct: null,
  saved: true,
  attemptedAt: "2026-08-21T05:00:00.000Z",
  teacherPick: { reasons: ["단어"], reasonText: null, taggedAt: "2026-08-21T06:00:00.000Z" },
};

describe("ProblemLogTab", () => {
  it("목록에 형식/정답여부/선생님픽 배지를 보여준다", () => {
    render(<ProblemLogTab initialEntries={[mcEntry, essayEntry]} viewerRole="student" />);
    expect(screen.getAllByText("Multiple choice").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Incorrect").length).toBeGreaterThan(0);
    expect(screen.getByText("🏷 Teacher pick")).toBeInTheDocument();
  });

  it("정답여부 필터로 오답만 볼 수 있다", () => {
    render(<ProblemLogTab initialEntries={[mcEntry, essayEntry]} viewerRole="student" />);
    fireEvent.click(screen.getByRole("button", { name: "Incorrect" }));
    expect(screen.getByText(/이차방정식의 해가 아닌 것/)).toBeInTheDocument();
    expect(screen.queryByText(/다음 지문을 요약/)).not.toBeInTheDocument();
  });

  it("저장 필터와 학생의 저장 토글이 동작한다", async () => {
    render(<ProblemLogTab initialEntries={[mcEntry, essayEntry]} viewerRole="student" />);

    fireEvent.click(screen.getByText("★ Saved only"));
    expect(screen.getByText(/다음 지문을 요약/)).toBeInTheDocument();
    expect(screen.queryByText(/이차방정식의 해가 아닌 것/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("★ Saved only"));
    fireEvent.click(screen.getByTitle("Save"));
    await waitFor(() =>
      expect(problemlogActions.toggleSaveAttempt).toHaveBeenCalledWith("a1", true)
    );
  });

  it("학생 화면에서 카드를 펼치면 다시 풀기 버튼이 보이고, 선생님 픽 버튼은 없다", () => {
    render(<ProblemLogTab initialEntries={[mcEntry]} viewerRole="student" />);
    fireEvent.click(screen.getByText(/이차방정식의 해가 아닌 것/));
    expect(screen.getByText("🔁 Try again")).toBeInTheDocument();
    expect(screen.queryByText("🏷 Teacher pick")).not.toBeInTheDocument();
  });

  it("선생님 화면에서 카드를 펼치면 선생님 픽 버튼이 보이고, 다시 풀기 버튼은 없다", () => {
    render(<ProblemLogTab initialEntries={[mcEntry]} viewerRole="teacher" />);
    fireEvent.click(screen.getByText(/이차방정식의 해가 아닌 것/));
    expect(screen.queryByText("🔁 Try again")).not.toBeInTheDocument();
    const pickButtons = screen.getAllByText("🏷 Teacher pick");
    expect(pickButtons.length).toBeGreaterThan(0);
  });

  it("선생님은 사유를 선택하고 태깅을 저장할 수 있다", async () => {
    render(<ProblemLogTab initialEntries={[mcEntry]} viewerRole="teacher" />);
    fireEvent.click(screen.getByText(/이차방정식의 해가 아닌 것/));
    fireEvent.click(screen.getAllByText("🏷 Teacher pick").at(-1)!);
    fireEvent.click(screen.getByText("Logic"));
    fireEvent.click(screen.getByText("Save tag"));
    await waitFor(() =>
      expect(problemlogActions.saveTeacherPick).toHaveBeenCalledWith("a1", ["로직"], null)
    );
  });
});
