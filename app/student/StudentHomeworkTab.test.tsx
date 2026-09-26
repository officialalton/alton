import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import StudentHomeworkTab from "./StudentHomeworkTab";
import type { HomeworkBatch } from "@/lib/homework-batch-data";
import { submitHomeworkAnswerAction } from "@/lib/homework-batch-actions";

// 2026-09-16(제품 오너 2차 정정) — 과제는 수업(세션)과 무관하다. 배치는 발급 날짜로 이름 붙고,
// 학생 포털·교사 포털·세션뷰가 전부 같은 화면(HomeworkBatchPanel)을 쓴다.
vi.mock("@/lib/homework-batch-actions", () => ({
  submitHomeworkAnswerAction: vi.fn(),
  gradeHomeworkBatchAction: vi.fn(),
}));

function mcItem(problemId: string, position: number, overrides: Partial<HomeworkBatch["items"][number]> = {}): HomeworkBatch["items"][number] {
  return {
    problemId, position, format: "mc", passage: "지문", question: "값은?", options: ["1", "2", "3", "4"],
    correctIndex: 0, answers: null, explanation: "해설", statements: null, figure: null,
    response: null, submittedAt: null, autoCorrect: null, graded: false, gradedAt: null, grade: null, gradeComment: null,
    ...overrides,
  };
}

const batches: HomeworkBatch[] = [
  {
    id: "b1", teacherId: "t1", teacherName: "김선생", studentId: "stu", label: "9월 15일 수학 김선생", subjectId: null, subjectName: null,
    createdAt: "2026-09-15T00:00:00Z", dueAt: null, items: [mcItem("p1", 1), mcItem("p2", 2, { submittedAt: "2026-09-15T01:00:00Z", response: "0" })],
  },
  {
    id: "b2", teacherId: "t1", teacherName: "김선생", studentId: "stu", label: "9월 14일 수학 김선생", subjectId: null, subjectName: null,
    createdAt: "2026-09-14T00:00:00Z", dueAt: null, items: [mcItem("p3", 1, { submittedAt: "x", response: "0", graded: true, grade: "correct" })],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("StudentHomeworkTab — 배치 단위 과제(2026-09-16)", () => {
  it("배치가 발급 날짜·과목·선생님 라벨로 상단 탭에 뜨고, 첫(미채점) 배치가 목차·본문으로 열린다", () => {
    render(<StudentHomeworkTab batches={batches} />);
    expect(screen.getByRole("tab", { name: /9월 15일 수학 김선생/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("1문제 남음")).toBeInTheDocument();
    expect(screen.getByText("과제 1")).toBeInTheDocument();
    expect(screen.getByText("과제 2")).toBeInTheDocument();
    expect(screen.getByText("값은?")).toBeInTheDocument();
  });

  it("채점 완료된 배치는 지난 과제 목록에 있고, 누르면 정답 여부를 보여준다", () => {
    render(<StudentHomeworkTab batches={batches} />);
    fireEvent.click(screen.getByText("지난 과제"));
    fireEvent.click(screen.getByText("9월 14일 수학 김선생"));
    expect(screen.getByText("정답")).toBeInTheDocument();
  });

  it("객관식을 클릭하고 제출하면 답을 저장한다", async () => {
    vi.mocked(submitHomeworkAnswerAction).mockResolvedValue({ ok: true, value: undefined });
    render(<StudentHomeworkTab batches={batches} />);
    fireEvent.click(screen.getByText("2"));
    fireEvent.click(screen.getByText("답 제출"));
    await waitFor(() => expect(submitHomeworkAnswerAction).toHaveBeenCalledWith("b1", "p1", "1"));
  });

  it("배치가 없으면 안내만 보인다", () => {
    render(<StudentHomeworkTab batches={[]} />);
    expect(screen.getByText(/아직 발급된 과제가 없습니다/)).toBeInTheDocument();
  });
});
