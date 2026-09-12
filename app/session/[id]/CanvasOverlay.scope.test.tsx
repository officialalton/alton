import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import CanvasOverlay from "./CanvasOverlay";
import { saveCanvasStrokes } from "./canvas-actions";
import { appendScopedStrokeEvents } from "./annotation-events-actions";

vi.mock("./canvas-actions", () => ({ saveCanvasStrokes: vi.fn() }));
vi.mock("./annotation-events-actions", () => ({ appendScopedStrokeEvents: vi.fn() }));

const sendMock = vi.fn();
const channelMock = vi.fn();
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    channel: (name: string) => {
      channelMock(name);
      return {
        on: function on() {
          return this;
        },
        subscribe: function subscribe() {
          return this;
        },
        send: sendMock,
      };
    },
    removeChannel: vi.fn(),
  }),
}));

// jsdom의 canvas는 getContext를 구현하지 않는다 — 그리기 자체가 아니라
// "어디로 나가는가"만 검증하므로 최소 스텁으로 충분하다.
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    lineCap: "",
    lineWidth: 0,
    strokeStyle: "",
    globalCompositeOperation: "",
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

function drawOneSegment(canvas: HTMLCanvasElement) {
  fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
  fireEvent.pointerMove(canvas, { clientX: 30, clientY: 30 });
  fireEvent.pointerUp(canvas);
}

function renderOverlay(scope: "teacher_shared" | "student_private") {
  const { container } = render(
    <CanvasOverlay
      sessionId="s1"
      curriculumDocId="doc-1"
      initialStrokes={[]}
      canDraw
      scope={scope}
    >
      <p>본문</p>
    </CanvasOverlay>
  );
  fireEvent.click(screen.getByText("✏️ 필기 모드"));
  return container.querySelector("canvas") as HTMLCanvasElement;
}

describe("CanvasOverlay — 필기 범위가 저장·실시간 공유에 함께 적용된다", () => {
  it("학생 개인 교재 필기는 실시간 채널을 아예 열지 않는다", () => {
    renderOverlay("student_private");
    expect(channelMock).not.toHaveBeenCalled();
  });

  it("학생 개인 교재 필기는 브로드캐스트로 나가지 않는다(교사 화면에 즉시 그려지면 안 된다)", () => {
    const canvas = renderOverlay("student_private");
    drawOneSegment(canvas);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("학생 개인 교재 필기는 공용 캔버스가 아니라 범위가 붙는 경로로 저장된다", async () => {
    const canvas = renderOverlay("student_private");
    drawOneSegment(canvas);
    await vi.advanceTimersByTimeAsync(700);

    expect(saveCanvasStrokes).not.toHaveBeenCalled();
    expect(appendScopedStrokeEvents).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "s1", scope: "student_private", curriculumDocId: "doc-1" })
    );
  });

  it("공용 필기는 기존대로 브로드캐스트되고 공용 캔버스에 저장된다", async () => {
    const canvas = renderOverlay("teacher_shared");
    drawOneSegment(canvas);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "broadcast", event: "stroke" })
    );

    await vi.advanceTimersByTimeAsync(700);
    expect(saveCanvasStrokes).toHaveBeenCalled();
    expect(appendScopedStrokeEvents).not.toHaveBeenCalled();
  });

  it("개인 필기의 '전체 지우기'는 남에게 전파되지 않는다", () => {
    const canvas = renderOverlay("student_private");
    drawOneSegment(canvas);
    fireEvent.click(screen.getByText("전체 지우기"));
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("개인 필기는 나만 본다는 것을 화면에서 알 수 있다", () => {
    renderOverlay("student_private");
    expect(screen.getByText("나만 보는 필기")).toBeInTheDocument();
  });

  it("저장에 실패하면 사용자에게 알린다", async () => {
    (appendScopedStrokeEvents as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("네트워크"));
    const canvas = renderOverlay("student_private");
    drawOneSegment(canvas);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(screen.getByText(/저장하지 못했습니다/)).toBeInTheDocument();
  });
});
