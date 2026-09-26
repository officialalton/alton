import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import LessonPrepScreen from "./LessonPrepScreen";
import type { SessionPrepContext } from "./prep-context-data";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

// 준비 UI 자체는 UnitPrepPanel의 테스트가 이미 덮는다. 여기서 볼 것은
// "수업에서 들어와도 같은 회차 준비가 열리는가"뿐이라 패널은 대역으로 둔다.
vi.mock("@/app/teacher/UnitPrepPanel", () => ({
  default: ({ overlayUnitId, unitTitle }: { overlayUnitId: string; unitTitle: string }) => (
    <div data-testid="unit-prep-panel" data-unit={overlayUnitId}>
      {unitTitle}
    </div>
  ),
}));

const linked: SessionPrepContext = {
  sessionId: "sess-1",
  subjectEnrollmentId: "se-1",
  subjectId: "subj-1",
  studentName: "지훈",
  subjectName: "SAT Math",
  startsAt: "2026-09-14T06:00:00.000Z",
  endsAt: "2026-09-14T07:00:00.000Z",
  frozen: false,
  linkedUnitId: "unit-1",
  linkedUnitTitle: "테스트1-1",
};

beforeEach(() => vi.clearAllMocks());

describe("수업에서 들어온 준비 화면", () => {
  it("연결된 회차의 준비를 그대로 연다(회차를 다시 고르라고 하지 않는다)", () => {
    render(<LessonPrepScreen context={linked} />);
    const panel = screen.getByTestId("unit-prep-panel");
    expect(panel).toHaveAttribute("data-unit", "unit-1");
    expect(panel).toHaveTextContent("테스트1-1");
    // 예전 "세션 준비"가 묻던 회차 선택 문구가 없다.
    expect(screen.queryByText(/회차를 고르세요/)).not.toBeInTheDocument();
    expect(screen.queryByText(/새 세션 준비 시작/)).not.toBeInTheDocument();
  });

  it("어떤 수업인지 학생·과목·일시로 식별한다", () => {
    render(<LessonPrepScreen context={linked} />);
    expect(screen.getByText(/지훈 학생 · SAT Math/)).toBeInTheDocument();
  });

  it("시작 전에는 세션뷰로 건너뛰는 버튼이 없고, 시작한 수업이면 '수업 기록'으로 간다", () => {
    render(<LessonPrepScreen context={linked} />);
    expect(screen.queryByText("수업 열기")).not.toBeInTheDocument();
    expect(screen.queryByText("수업 기록 →")).not.toBeInTheDocument();
  });

  it("이미 시작한 수업은 '수업 기록'으로 세션뷰에 들어간다", () => {
    render(<LessonPrepScreen context={{ ...linked, frozen: true }} />);
    fireEvent.click(screen.getByText("수업 기록 →"));
    expect(pushMock).toHaveBeenCalledWith("/session/sess-1");
  });

  it("수동 고정 버튼을 두지 않는다", () => {
    render(<LessonPrepScreen context={linked} />);
    for (const banned of ["고정하기", "이 세션에 고정하기(이후 수정 불가)", "고정"]) {
      expect(screen.queryByText(banned)).not.toBeInTheDocument();
    }
  });

  it("이미 시작한 수업이면 고정됐다고 알려준다", () => {
    render(<LessonPrepScreen context={{ ...linked, frozen: true }} />);
    expect(screen.getByText(/시작 시점으로 고정되었습니다/)).toBeInTheDocument();
  });

  it("연결된 회차가 없으면 준비 화면 대신 안내와 이동 경로를 준다", () => {
    render(
      <LessonPrepScreen context={{ ...linked, linkedUnitId: null, linkedUnitTitle: null }} />
    );
    expect(screen.queryByTestId("unit-prep-panel")).not.toBeInTheDocument();
    expect(screen.getByText(/연결된 회차가 없습니다/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("커리큘럼으로 가기"));
    expect(pushMock).toHaveBeenCalledWith("/teacher?tab=curriculum");
  });

  it("내부 id를 화면에 노출하지 않는다", () => {
    const { container } = render(<LessonPrepScreen context={linked} />);
    screen.getByTestId("unit-prep-panel").remove();
    expect(container.textContent).not.toContain("sess-1");
    expect(container.textContent).not.toContain("unit-1");
  });
});

describe("준비 화면은 하나뿐이다", () => {
  it("옛 세션 준비 화면이 저장소에 남아 있지 않다", async () => {
    const fs = await import("node:fs");
    expect(fs.existsSync("app/teacher/SessionPrepPanel.tsx")).toBe(false);
  });

  it("수동 고정 서버 액션이 없다", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("app/teacher/session-prep-actions.ts", "utf-8");
    expect(src).not.toContain("export async function pinSessionSelection");
  });
});
