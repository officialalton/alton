import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import MaterialAnnotationLayers from "./MaterialAnnotationLayers";
import { appendScopedStrokeEvents } from "./annotation-events-actions";

vi.mock("./annotation-events-actions", () => ({ appendScopedStrokeEvents: vi.fn() }));

const sendMock = vi.fn();
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: function on() {
        return this;
      },
      subscribe: function subscribe() {
        return this;
      },
      send: sendMock,
    }),
    removeChannel: vi.fn(),
  }),
}));

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
    globalAlpha: 1,
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

// viewerUserId를 명시적으로 비우는 경우를 구분해야 한다 — 기본값 인자에
// undefined를 넘기면 기본값이 다시 적용되므로 null을 "모름"으로 쓴다.
function renderLayers(role: "student" | "teacher" | "reader", viewerUserId: string | null = "u-1") {
  render(
    <MaterialAnnotationLayers
      sessionId="s1"
      curriculumDocId="doc-1"
      studentStrokes={[]}
      teacherStrokes={[]}
      role={role}
      viewerUserId={viewerUserId ?? undefined}
    >
      <p>본문</p>
    </MaterialAnnotationLayers>
  );
  const toggle = screen.queryByText("✏️ 필기 모드");
  if (toggle) fireEvent.click(toggle);
  return screen.getByTestId("material-annotation-canvas") as HTMLCanvasElement;
}

function drawOneSegment(canvas: HTMLCanvasElement) {
  fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
  fireEvent.pointerMove(canvas, { clientX: 40, clientY: 40 });
  fireEvent.pointerUp(canvas);
}

describe("교재 필기 — 두 레이어를 각자 켜고 끈다", () => {
  it("세 역할 모두 학생 필기·선생님 필기 토글을 갖는다", () => {
    for (const role of ["student", "teacher", "reader"] as const) {
      const { unmount } = render(
        <MaterialAnnotationLayers
          sessionId="s1"
          curriculumDocId="doc-1"
          studentStrokes={[]}
          teacherStrokes={[]}
          role={role}
          viewerUserId="u-1"
        >
          <p>본문</p>
        </MaterialAnnotationLayers>
      );
      expect(screen.getByText("학생 필기")).toBeInTheDocument();
      expect(screen.getByText("선생님 필기")).toBeInTheDocument();
      unmount();
    }
  });

  it("토글은 켜고 끌 수 있고 기본값은 둘 다 켬이다", () => {
    renderLayers("student");
    const student = screen.getByText("학생 필기");
    expect(student).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(student);
    expect(screen.getByText("학생 필기")).toHaveAttribute("aria-pressed", "false");
  });

  it("내 레이어를 끄면 필기할 수 없다(방금 그은 획이 사라진 것처럼 보이면 안 된다)", () => {
    render(
      <MaterialAnnotationLayers
        sessionId="s1"
        curriculumDocId="doc-1"
        studentStrokes={[]}
        teacherStrokes={[]}
        role="student"
        viewerUserId="u-1"
      >
        <p>본문</p>
      </MaterialAnnotationLayers>
    );
    fireEvent.click(screen.getByText("학생 필기"));
    expect(screen.getByText("✏️ 필기 모드")).toBeDisabled();
  });
});

describe("작성 권한 — 각자 자기 레이어만", () => {
  it("학생이 그리면 학생 필기 레이어로 저장된다", async () => {
    const canvas = renderLayers("student");
    expect(screen.getByText("학생 필기로 기록됩니다")).toBeInTheDocument();
    drawOneSegment(canvas);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(appendScopedStrokeEvents).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "student_shared", curriculumDocId: "doc-1" })
    );
  });

  it("교사가 그리면 선생님 필기 레이어로 저장된다", async () => {
    const canvas = renderLayers("teacher");
    expect(screen.getByText("선생님 필기로 기록됩니다")).toBeInTheDocument();
    drawOneSegment(canvas);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(appendScopedStrokeEvents).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "teacher_shared" })
    );
  });

  it("보호자는 읽기 전용이라 도구가 없고 아무것도 나가지 않는다", async () => {
    const canvas = renderLayers("reader");
    expect(screen.queryByText("✏️ 필기 모드")).not.toBeInTheDocument();
    expect(screen.getByText("보호자는 읽기 전용입니다")).toBeInTheDocument();
    drawOneSegment(canvas);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(appendScopedStrokeEvents).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("학생 필기도 실시간으로 전달된다(비공개가 아니다)", () => {
    const canvas = renderLayers("student");
    drawOneSegment(canvas);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "broadcast",
        event: "stroke",
        payload: expect.objectContaining({ scope: "student_shared" }),
      })
    );
  });
});

describe("미저장 필기 보관 — 계정·레이어별", () => {
  it("키에 보는 사람·수업·교재·레이어가 들어간다", () => {
    const canvas = renderLayers("student");
    drawOneSegment(canvas);
    expect(Array.from(store.keys())).toEqual([
      "alton:unsaved-strokes:u-1:s1:doc-1:student_shared",
    ]);
  });

  it("교사의 보관분은 학생과 다른 칸에 들어간다", () => {
    const canvas = renderLayers("teacher");
    drawOneSegment(canvas);
    expect(Array.from(store.keys())).toEqual([
      "alton:unsaved-strokes:u-1:s1:doc-1:teacher_shared",
    ]);
  });

  it("보는 사람을 모르면 브라우저에 남기지 않는다", () => {
    const canvas = renderLayers("student", null);
    drawOneSegment(canvas);
    expect(Array.from(store.keys())).toHaveLength(0);
  });

  it("다른 계정의 보관분은 복구하지도, 지우지도 않는다", async () => {
    store.set(
      "alton:unsaved-strokes:someone-else:s1:doc-1:student_shared",
      JSON.stringify([{ x0: 0, y0: 0, x1: 1, y1: 1, color: "#000", tool: "pen" }])
    );
    renderLayers("student");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(appendScopedStrokeEvents).not.toHaveBeenCalled();
    expect(store.has("alton:unsaved-strokes:someone-else:s1:doc-1:student_shared")).toBe(true);
  });

  it("저장에 실패하면 알리고, 획은 보관분에 남는다", async () => {
    (appendScopedStrokeEvents as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("네트워크"));
    const canvas = renderLayers("student");
    drawOneSegment(canvas);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(screen.getByText(/저장하지 못했습니다/)).toBeInTheDocument();
    expect(store.has("alton:unsaved-strokes:u-1:s1:doc-1:student_shared")).toBe(true);
  });
});
