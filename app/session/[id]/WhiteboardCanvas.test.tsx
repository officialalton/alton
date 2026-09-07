import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import WhiteboardCanvas from "./WhiteboardCanvas";
import * as scratchpadActions from "./scratchpad-actions";
import * as annotationActions from "./annotation-events-actions";

// R9 — WhiteboardCanvas ↔ session_annotation_events 연결 테스트.
// v3 세션: 그리기 → appendStrokeEvent 호출, replay가 저장된 이벤트로 상태를
// 재구성, clear-all은 canClearAll(교사)만 성공. 레거시 세션: 기존 legacy 저장
// 경로만 타고 새 이벤트 테이블에는 절대 쓰지 않는다.

vi.mock("./scratchpad-actions", () => ({
  saveWhiteboardStrokes: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./annotation-events-actions", async () => {
  const actual = await vi.importActual<typeof import("./annotation-events-actions")>(
    "./annotation-events-actions"
  );
  return {
    ...actual,
    appendStrokeEvent: vi.fn().mockResolvedValue(undefined),
    appendClearAllEvent: vi.fn().mockResolvedValue(undefined),
    replayAnnotationEvents: vi.fn().mockResolvedValue([]),
  };
});

let subscribeCallback: ((status: string) => void) | undefined;

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: function on() {
        return this;
      },
      subscribe: function subscribe(cb?: (status: string) => void) {
        subscribeCallback = cb;
        return this;
      },
      send: vi.fn(),
    }),
    removeChannel: vi.fn(),
  }),
}));

function drawOneSegment() {
  const canvas = document.querySelector("canvas")!;
  fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
  fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20 });
  fireEvent.pointerUp(canvas);
}

beforeEach(() => {
  vi.clearAllMocks();
  subscribeCallback = undefined;
});

describe("WhiteboardCanvas — v3 (session_annotation_events)", () => {
  it("그리기 동작은 legacy 저장이 아니라 appendStrokeEvent를 호출한다", async () => {
    render(
      <WhiteboardCanvas
        sessionId="s1"
        initialStrokes={[]}
        canDraw
        canClearAll={false}
        isV3
        initialAnnotationStrokes={[]}
        currentUserId="u1"
      />
    );
    fireEvent.click(screen.getByText("✏️ 필기 모드"));
    drawOneSegment();

    await waitFor(() => expect(annotationActions.appendStrokeEvent).toHaveBeenCalledTimes(1));
    expect(annotationActions.appendStrokeEvent).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ tool: "pen" })
    );
    expect(scratchpadActions.saveWhiteboardStrokes).not.toHaveBeenCalled();
  });

  it("마운트 시 replayAnnotationEvents로 현재 상태를 재구성한다(재접속 시 재구독에서도 다시 호출)", async () => {
    vi.mocked(annotationActions.replayAnnotationEvents).mockResolvedValue([
      {
        seq: "1",
        id: "e1",
        authorId: "teacher-1",
        eventType: "stroke",
        payload: { x0: 0.1, y0: 0.1, x1: 0.2, y1: 0.2, color: "#1A1A1A", tool: "pen" },
        createdAt: "t",
      },
    ]);

    render(
      <WhiteboardCanvas
        sessionId="s1"
        initialStrokes={[]}
        canDraw
        canClearAll
        isV3
        initialAnnotationStrokes={[]}
        currentUserId="u1"
      />
    );

    // 최초 subscribe 콜백(SUBSCRIBED)이 replayAndRedraw를 트리거한다.
    subscribeCallback?.("SUBSCRIBED");
    await waitFor(() => expect(annotationActions.replayAnnotationEvents).toHaveBeenCalledWith("s1"));

    // 재접속(채널이 다시 SUBSCRIBED 상태가 됨)을 흉내내면 다시 replay가 호출된다 —
    // 클라이언트 메모리 상태를 신뢰하지 않고 항상 서버 로그로 재동기화된다는 계약을 검증.
    vi.mocked(annotationActions.replayAnnotationEvents).mockClear();
    subscribeCallback?.("SUBSCRIBED");
    await waitFor(() => expect(annotationActions.replayAnnotationEvents).toHaveBeenCalledTimes(1));
  });

  it("canClearAll=false면 전체 지우기 버튼이 아예 노출되지 않는다(학생/보호자)", () => {
    render(
      <WhiteboardCanvas
        sessionId="s1"
        initialStrokes={[]}
        canDraw
        canClearAll={false}
        isV3
        initialAnnotationStrokes={[]}
        currentUserId="u1"
      />
    );
    fireEvent.click(screen.getByText("✏️ 필기 모드"));
    expect(screen.queryByText("전체 지우기")).not.toBeInTheDocument();
  });

  it("canClearAll=true(선생님)면 전체 지우기가 appendClearAllEvent를 호출해 성공한다", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <WhiteboardCanvas
        sessionId="s1"
        initialStrokes={[]}
        canDraw
        canClearAll
        isV3
        initialAnnotationStrokes={[]}
        currentUserId="u1"
      />
    );
    fireEvent.click(screen.getByText("✏️ 필기 모드"));
    fireEvent.click(screen.getByText("전체 지우기"));

    await waitFor(() => expect(annotationActions.appendClearAllEvent).toHaveBeenCalledWith("s1"));
    expect(scratchpadActions.saveWhiteboardStrokes).not.toHaveBeenCalled();
  });
});

describe("WhiteboardCanvas — 레거시(legacy_sessions.whiteboard_strokes)", () => {
  it("그리면 legacy debounce 저장 경로만 타고, 이벤트 로그에는 아무 것도 쓰지 않는다", async () => {
    render(
      <WhiteboardCanvas sessionId="s1" initialStrokes={[]} canDraw canClearAll={false} isV3={false} />
    );
    fireEvent.click(screen.getByText("✏️ 필기 모드"));
    drawOneSegment();

    await waitFor(() => expect(scratchpadActions.saveWhiteboardStrokes).toHaveBeenCalled(), {
      timeout: 2000,
    });
    expect(annotationActions.appendStrokeEvent).not.toHaveBeenCalled();
    expect(annotationActions.appendClearAllEvent).not.toHaveBeenCalled();
    expect(annotationActions.replayAnnotationEvents).not.toHaveBeenCalled();
  });

  it("레거시는 항상 전체 지우기 버튼이 노출된다(기존 동작 유지)", () => {
    render(
      <WhiteboardCanvas sessionId="s1" initialStrokes={[]} canDraw canClearAll={false} isV3={false} />
    );
    fireEvent.click(screen.getByText("✏️ 필기 모드"));
    expect(screen.getByText("전체 지우기")).toBeInTheDocument();
  });
});
