import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import PdfPageAnnotationLayer, { type PdfPageAnnotationHandle } from "./PdfPageAnnotationLayer";
import * as actions from "./annotation-events-actions";

// 2026-09-14 조사 문서의 재현 1·2 가 이 컴포넌트에서는 일어나지 않는지 확인한다.
// 서버 액션·Realtime·캔버스는 mock — 실제 픽셀·DB 검증이 아니다(통합 테스트가 따로 있다).

vi.mock("./annotation-events-actions", () => ({
  appendPageStrokeEvents: vi.fn(),
  loadPageStrokes: vi.fn(async () => []),
}));

const sent: unknown[] = [];
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: function on() {
        return this;
      },
      subscribe: function subscribe() {
        return this;
      },
      send: (msg: unknown) => sent.push(msg),
    }),
    removeChannel: vi.fn(),
  }),
}));

const memory = new Map<string, string>();
beforeEach(() => {
  vi.clearAllMocks();
  sent.length = 0;
  memory.clear();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => void memory.set(k, v),
      removeItem: (k: string) => void memory.delete(k),
    },
  });
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
  HTMLCanvasElement.prototype.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 600, height: 800, right: 600, bottom: 800, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
});

const target = (page: number, versionId = "v1") => ({
  sessionId: "s1",
  curriculumDocId: "d1",
  curriculumDocVersionId: versionId,
  pageNumber: page,
});

async function drawOne(x = 10) {
  const input = screen.getByTestId("pdf-input-layer");
  fireEvent.pointerDown(input, { clientX: x, clientY: 10 });
  fireEvent.pointerMove(input, { clientX: x + 5, clientY: 15 });
  fireEvent.pointerUp(input);
}

async function enableDrawing() {
  await waitFor(() => expect(actions.loadPageStrokes).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("button", { name: "✏️ 필기 시작" }));
}

describe("PDF 페이지 필기 레이어", () => {
  it("한 획은 eventId 를 달고 이 페이지의 대상으로만 저장된다", async () => {
    vi.mocked(actions.appendPageStrokeEvents).mockImplementation(async ({ segments }) => ({
      savedEventIds: segments.map((s) => s.eventId!).filter(Boolean),
    }));
    const ref = createRef<PdfPageAnnotationHandle>();
    render(<PdfPageAnnotationLayer ref={ref} target={target(2)} role="teacher" viewerUserId="t1" width={600} height={800} />);
    await enableDrawing();
    await drawOne();
    expect(ref.current?.hasUnsaved()).toBe(true);

    await act(async () => {
      expect(await ref.current!.flush()).toBe(true);
    });
    expect(actions.appendPageStrokeEvents).toHaveBeenCalledTimes(1);
    const call = vi.mocked(actions.appendPageStrokeEvents).mock.calls[0][0];
    expect(call.target).toEqual(target(2));
    expect(call.scope).toBe("teacher_shared");
    expect(call.segments[0].eventId).toMatch(/[0-9a-f-]{36}/);
    expect(ref.current?.hasUnsaved()).toBe(false);
    // 실시간으로도 같은 eventId 가 나간다 — 상대가 그리는 획과 저장되는 획이 같은 것이다.
    expect((sent[0] as { payload: { seg: { eventId: string } } }).payload.seg.eventId).toBe(call.segments[0].eventId);
  });

  it("재현 1 — 다른 페이지로 다시 마운트되면 이전 페이지의 미저장 획은 그 페이지 보관함에 남고 새 페이지 저장에 섞이지 않는다", async () => {
    vi.mocked(actions.appendPageStrokeEvents).mockImplementation(async ({ segments }) => ({
      savedEventIds: segments.map((s) => s.eventId!),
    }));
    const ref = createRef<PdfPageAnnotationHandle>();
    const { unmount } = render(
      <PdfPageAnnotationLayer ref={ref} target={target(1)} role="teacher" viewerUserId="t1" width={600} height={800} />
    );
    await enableDrawing();
    await drawOne(10);
    // 저장 전에 화면이 바뀐다(다음 페이지). 이전 인스턴스는 내려가며 보관함에 남긴다.
    unmount();
    const keyPage1 = Array.from(memory.keys()).find((k) => k.endsWith(":v1:1:teacher_shared"));
    expect(keyPage1).toBeDefined();

    const ref2 = createRef<PdfPageAnnotationHandle>();
    render(<PdfPageAnnotationLayer ref={ref2} target={target(2)} role="teacher" viewerUserId="t1" width={600} height={800} />);
    await enableDrawing();
    await drawOne(50);
    await act(async () => {
      await ref2.current!.flush();
    });
    const calls = vi.mocked(actions.appendPageStrokeEvents).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0].target.pageNumber).toBe(2);
    expect(calls[0][0].segments).toHaveLength(1);
    expect(calls[0][0].segments[0].x0).toBe(50);
    // 1쪽 획은 여전히 1쪽 보관함에 있다 — 1쪽으로 돌아오면 복구·저장된다.
    expect(memory.get(keyPage1!)).toContain('"x0":10');
  });

  it("재현 2 — 저장 응답을 기다리는 동안 그린 획도 임시 기록에 남고, 먼저 보낸 저장이 끝나도 지워지지 않는다", async () => {
    let resolveFirst: ((v: { savedEventIds: string[] }) => void) | null = null;
    vi.mocked(actions.appendPageStrokeEvents).mockImplementationOnce(
      () => new Promise((resolve) => { resolveFirst = resolve; })
    );
    const ref = createRef<PdfPageAnnotationHandle>();
    render(<PdfPageAnnotationLayer ref={ref} target={target(1)} role="student" viewerUserId="u1" width={600} height={800} />);
    await enableDrawing();
    await drawOne(10);
    let flushing: Promise<boolean>;
    act(() => {
      flushing = ref.current!.flush(); // 첫 획 전송 중
    });
    await drawOne(20); // 응답 전 두 번째 획

    const key = Array.from(memory.keys()).find((k) => k.endsWith(":v1:1:student_shared"))!;
    const kept = JSON.parse(memory.get(key)!) as { x0: number }[];
    expect(kept.map((s) => s.x0)).toEqual([10, 20]);

    const firstCall = vi.mocked(actions.appendPageStrokeEvents).mock.calls[0][0];
    await act(async () => {
      resolveFirst!({ savedEventIds: firstCall.segments.map((s) => s.eventId!) });
      await flushing!;
    });
    const after = JSON.parse(memory.get(key)!) as { x0: number }[];
    expect(after.map((s) => s.x0)).toEqual([20]);
    expect(ref.current?.hasUnsaved()).toBe(true);
  });

  it("저장 실패는 미저장 상태와 다시 시도를 보여주고 획을 잃지 않는다", async () => {
    vi.mocked(actions.appendPageStrokeEvents).mockRejectedValueOnce(new Error("network"));
    const ref = createRef<PdfPageAnnotationHandle>();
    render(<PdfPageAnnotationLayer ref={ref} target={target(1)} role="teacher" viewerUserId="t1" width={600} height={800} />);
    await enableDrawing();
    await drawOne();
    await act(async () => {
      expect(await ref.current!.flush()).toBe(false);
    });
    expect(screen.getByTestId("pdf-save-state")).toHaveTextContent("저장 안 됨");
    expect(ref.current?.hasUnsaved()).toBe(true);

    vi.mocked(actions.appendPageStrokeEvents).mockImplementationOnce(async ({ segments }) => ({
      savedEventIds: segments.map((s) => s.eventId!),
    }));
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(ref.current?.hasUnsaved()).toBe(false));
    // 재시도는 같은 eventId 를 다시 보낸다 — 서버가 중복을 막는 근거.
    const [first, second] = vi.mocked(actions.appendPageStrokeEvents).mock.calls;
    expect(second[0].segments[0].eventId).toBe(first[0].segments[0].eventId);
  });

  it("보호자(reader)는 입력 캔버스와 필기 버튼이 없다 — 두 레이어는 읽는다", async () => {
    render(<PdfPageAnnotationLayer target={target(1)} role="reader" width={600} height={800} />);
    await waitFor(() => expect(actions.loadPageStrokes).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId("pdf-input-layer")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /필기 시작/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("pdf-teacher-layer")).toBeInTheDocument();
    expect(screen.getByTestId("pdf-student-layer")).toBeInTheDocument();
  });
});
