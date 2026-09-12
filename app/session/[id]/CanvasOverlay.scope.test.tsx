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
// 이 환경의 jsdom localStorage에는 clear()가 없다 — 실제로 쓰는 동작만 갖춘
// 최소 스텁으로 대체해, 키가 어떻게 갈라지는지를 그대로 검사한다.
const store = new Map<string, string>();
beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size;
      },
    },
  });
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

function renderOverlay(
  scope: "teacher_shared" | "student_private",
  authorRole: "teacher" | "student" | "reader" = "teacher"
) {
  const { container } = render(
    <CanvasOverlay
      sessionId="s1"
      curriculumDocId="doc-1"
      initialStrokes={[]}
      canDraw
      scope={scope}
      authorRole={authorRole}
      viewerUserId="u-1"
    >
      <p>본문</p>
    </CanvasOverlay>
  );
  const toggle = screen.queryByText("✏️ 필기 모드");
  if (toggle) fireEvent.click(toggle);
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

describe("교사 공용 필기는 교사가 작성한다(2026-09-12 확정)", () => {
  it("학생에게는 공용 레이어의 필기 도구가 보이지 않는다", () => {
    renderOverlay("teacher_shared", "student");
    expect(screen.queryByText("✏️ 필기 모드")).not.toBeInTheDocument();
    expect(screen.queryByText("전체 지우기")).not.toBeInTheDocument();
  });

  it("학생에게 어디에 쓰면 되는지 알려준다", () => {
    renderOverlay("teacher_shared", "student");
    expect(screen.getByText(/나만 보는 필기.*남겨요/)).toBeInTheDocument();
  });

  it("학생이 공용 캔버스를 건드려도 아무것도 나가지 않는다", async () => {
    const canvas = renderOverlay("teacher_shared", "student");
    drawOneSegment(canvas);
    await vi.advanceTimersByTimeAsync(700);
    expect(sendMock).not.toHaveBeenCalled();
    expect(saveCanvasStrokes).not.toHaveBeenCalled();
    expect(appendScopedStrokeEvents).not.toHaveBeenCalled();
  });

  it("학생은 자기 개인 필기에는 그대로 쓸 수 있다", async () => {
    const canvas = renderOverlay("student_private", "student");
    drawOneSegment(canvas);
    await vi.advanceTimersByTimeAsync(700);
    expect(appendScopedStrokeEvents).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "student_private" })
    );
  });

  it("교사는 공용 레이어에 쓸 수 있다", async () => {
    const canvas = renderOverlay("teacher_shared", "teacher");
    drawOneSegment(canvas);
    expect(sendMock).toHaveBeenCalled();
  });
});

describe("미저장 필기 보관은 계정·범위별로 갈라진다", () => {
  it("키에 보는 사람·수업·교재·범위가 모두 들어간다", async () => {
    const canvas = renderOverlay("student_private", "student");
    drawOneSegment(canvas);
    const keys = Array.from(store.keys()).filter((k) => k.startsWith("alton:unsaved-strokes"));
    expect(keys).toHaveLength(1);
    expect(keys[0]).toBe("alton:unsaved-strokes:u-1:s1:doc-1:student_private");
  });

  it("보는 사람을 모르면 브라우저에 남기지 않는다", () => {
    const { container } = render(
      <CanvasOverlay
        sessionId="s1"
        curriculumDocId="doc-1"
        initialStrokes={[]}
        canDraw
        scope="student_private"
        authorRole="student"
      >
        <p>본문</p>
      </CanvasOverlay>
    );
    fireEvent.click(screen.getByText("✏️ 필기 모드"));
    drawOneSegment(container.querySelector("canvas") as HTMLCanvasElement);
    expect(Array.from(store.keys()).filter((k) => k.startsWith("alton:unsaved-strokes"))).toHaveLength(0);
  });

  it("다른 계정의 보관분은 복구하지 않는다", async () => {
    store.set(
      "alton:unsaved-strokes:someone-else:s1:doc-1:student_private",
      JSON.stringify([{ x0: 0, y0: 0, x1: 1, y1: 1, color: "#000", tool: "pen" }])
    );
    renderOverlay("student_private", "student");
    await vi.advanceTimersByTimeAsync(700);
    expect(appendScopedStrokeEvents).not.toHaveBeenCalled();
    // 남의 보관분은 그대로 남아 있다(지우지도, 가져가지도 않는다).
    expect(store.has("alton:unsaved-strokes:someone-else:s1:doc-1:student_private")).toBe(true);
  });
});
