import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import StudentHomeworkTab from "./StudentHomeworkTab";
import type { StudentHomeworkSet } from "./homework-v3-data";
import { refreshSessionProblems } from "@/app/session/[id]/problem-work-actions";

vi.mock("@/app/session/[id]/problem-work-actions", () => ({
  refreshSessionProblems: vi.fn(),
}));
vi.mock("@/app/session/[id]/ProblemsPanel", () => ({
  default: ({ sessionId, source, problems }: { sessionId: string; source?: string; problems: { number: number }[] }) => (
    <div data-testid="problems-panel" data-session={sessionId} data-source={source}>
      {problems.map((p) => `과제 ${p.number}`).join(",")}
    </div>
  ),
}));

const sets: StudentHomeworkSet[] = [
  { sessionId: "sess-1", subjectName: "SAT Reading", startsAt: "2026-09-15T11:30:00.000Z", total: 3, answered: 1, graded: 0, composedAt: "2026-09-14T00:00:00Z" },
  { sessionId: "sess-2", subjectName: "SAT Math", startsAt: null, total: 2, answered: 2, graded: 2, composedAt: "2026-09-13T00:00:00Z" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(refreshSessionProblems).mockImplementation(async (sessionId: string) => [
    { number: 1, problemId: `${sessionId}-p1` } as never,
  ]);
});

describe("StudentHomeworkTab — 수업별 과제 탭 + 수업 문제와 같은 패널(2026-09-14 과제 v3 통일)", () => {
  it("수업별 과제가 상단 탭으로 뜨고, 첫 탭의 과제가 수업 문제 패널로 열린다", async () => {
    render(<StudentHomeworkTab studentId="stu" homeworkSets={sets} />);
    expect(screen.getByRole("tab", { name: /SAT Reading 수업 과제/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("2문제 남음")).toBeInTheDocument();
    expect(screen.getByText("채점 완료")).toBeInTheDocument();
    await waitFor(() => expect(refreshSessionProblems).toHaveBeenCalledWith("sess-1", "homework"));
    const panel = await screen.findByTestId("problems-panel");
    expect(panel).toHaveAttribute("data-session", "sess-1");
    expect(panel).toHaveAttribute("data-source", "homework");
    expect(panel).toHaveTextContent("과제 1");
  });

  it("다른 수업 탭을 누르면 그 수업의 과제를 불러온다", async () => {
    render(<StudentHomeworkTab studentId="stu" homeworkSets={sets} />);
    await screen.findByTestId("problems-panel");
    fireEvent.click(screen.getByRole("tab", { name: /SAT Math 수업 과제/ }));
    await waitFor(() => expect(refreshSessionProblems).toHaveBeenCalledWith("sess-2", "homework"));
    await waitFor(() => expect(screen.getByTestId("problems-panel")).toHaveAttribute("data-session", "sess-2"));
  });

  it("발급된 과제가 없으면 안내만 있고 레거시 '작성 필요/작성 완료'는 없다", () => {
    render(<StudentHomeworkTab studentId="stu" homeworkSets={[]} />);
    expect(screen.getByText(/아직 발급된 과제가 없습니다/)).toBeInTheDocument();
    expect(screen.queryByText("작성 필요")).not.toBeInTheDocument();
    expect(screen.queryByText("작성 완료")).not.toBeInTheDocument();
  });
});
