import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import LessonPrepScreen from "./LessonPrepScreen";
import { loadStudentCurriculumPanelData } from "@/app/teacher/student-curriculum-actions";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

vi.mock("@/app/teacher/student-curriculum-actions", () => ({
  loadStudentCurriculumPanelData: vi.fn(),
}));

// 준비 UI 자체는 이미 테스트가 있는 기존 컴포넌트다. 여기서 확인할 것은
// "이 화면이 실제 sessionId를 넘겨준다"는 연결뿐이라 패널은 대역으로 바꾼다.
vi.mock("@/app/teacher/SessionPrepPanel", () => ({
  default: ({ sessionId }: { sessionId: string | null }) => (
    <div data-testid="prep-panel">{sessionId ?? "세션 없음"}</div>
  ),
}));

const context = {
  sessionId: "sess-1",
  subjectEnrollmentId: "se-1",
  subjectId: "subj-1",
  studentName: "지훈",
  subjectName: "SAT Math",
  startsAt: "2026-09-20T18:00:00.000Z",
  endsAt: "2026-09-20T19:30:00.000Z",
  pinned: false,
};

describe("LessonPrepScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (loadStudentCurriculumPanelData as ReturnType<typeof vi.fn>).mockResolvedValue({
      initial: { units: [] },
      library: { keywords: [] },
    });
  });

  it("어떤 수업인지 학생·과목·일시로 식별해 보여준다", async () => {
    render(<LessonPrepScreen context={context} />);
    expect(screen.getByText(/지훈 학생 · SAT Math/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("prep-panel")).toBeInTheDocument());
  });

  it("내부 id를 화면에 노출하지 않는다", async () => {
    const { container } = render(<LessonPrepScreen context={context} />);
    await waitFor(() => expect(screen.getByTestId("prep-panel")).toBeInTheDocument());
    // 대역 패널이 sessionId를 출력하므로 그 노드만 제외하고 검사한다.
    screen.getByTestId("prep-panel").remove();
    expect(container.textContent).not.toContain("sess-1");
    expect(container.textContent).not.toContain("se-1");
    expect(container.textContent).not.toContain("subj-1");
  });

  it("준비 패널에 실제 세션을 연결해 넘긴다(예전엔 항상 비어 있었다)", async () => {
    render(<LessonPrepScreen context={context} />);
    await waitFor(() => expect(screen.getByTestId("prep-panel")).toHaveTextContent("sess-1"));
  });

  it("이 수업의 세션뷰로 바로 이동할 수 있다(화면 진입이며 수업 시작 처리가 아니다)", async () => {
    render(<LessonPrepScreen context={context} />);
    fireEvent.click(screen.getByText("수업 열기"));
    expect(pushMock).toHaveBeenCalledWith("/session/sess-1");
  });

  it("커리큘럼을 불러오지 못하면 사유를 보여주고 준비 패널을 열지 않는다", async () => {
    (loadStudentCurriculumPanelData as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("담당 학생의 세션 준비만 조정할 수 있습니다.")
    );
    render(<LessonPrepScreen context={context} />);
    await waitFor(() =>
      expect(screen.getByText("담당 학생의 세션 준비만 조정할 수 있습니다.")).toBeInTheDocument()
    );
    expect(screen.queryByTestId("prep-panel")).not.toBeInTheDocument();
  });
});
