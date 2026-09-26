import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import WhiteboardCanvas from "./WhiteboardCanvas";
import * as scratchpadActions from "./scratchpad-actions";
import * as annotationActions from "./annotation-events-actions";

// R9 — WhiteboardCanvas ↔ session_annotation_events 연결 테스트.
// v3 세션: 그리기 → appendStrokeEvents(스트로크 전체를 단일 호출로) 호출, replay가
// 저장된 이벤트로 상태를 재구성, clear-all은 canClearAll(교사)만 성공. 레거시
// 세션: 기존 legacy 저장 경로만 타고 새 이벤트 테이블에는 절대 쓰지 않는다.
//
// R9 corrective(최종 라운드) — appendStrokeEvent(단수, 세그먼트 1개씩 순차 호출)
// 를 appendStrokeEvents(복수, 스트로크 전체 배열을 단일 원자적 RPC 호출)로 교체.

vi.mock("./scratchpad-actions", () => ({
  saveWhiteboardStrokes: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./annotation-events-actions", async () => {
  const actual = await vi.importActual<typeof import("./annotation-events-actions")>(
    "./annotation-events-actions"
  );
  return {
    ...actual,
    appendStrokeEvents: vi.fn().mockResolvedValue(undefined),
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

// 여러 pointer-move tick으로 이뤄진 하나의 스트로크(3개 세그먼트: 10,10→20,20→
// 30,10→15,25). 수정 전에는 currentSegRef가 마지막 세그먼트(30,10→15,25)만 들고
// 있어서 이 중 1개만 저장됐다 — 이 테스트는 3개 전부가 append됨을 검증한다.
function drawMultiSegmentStroke() {
  const canvas = document.querySelector("canvas")!;
  fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
  fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20 });
  fireEvent.pointerMove(canvas, { clientX: 30, clientY: 10 });
  fireEvent.pointerMove(canvas, { clientX: 15, clientY: 25 });
  fireEvent.pointerUp(canvas);
}

beforeEach(() => {
  vi.clearAllMocks();
  subscribeCallback = undefined;
});

describe("WhiteboardCanvas — v3 (session_annotation_events)", () => {
  it("그리기 동작은 legacy 저장이 아니라 appendStrokeEvents를 호출한다", async () => {
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

    await waitFor(() => expect(annotationActions.appendStrokeEvents).toHaveBeenCalledTimes(1));
    expect(annotationActions.appendStrokeEvents).toHaveBeenCalledWith(
      "s1",
      [expect.objectContaining({ tool: "pen" })]
    );
    expect(scratchpadActions.saveWhiteboardStrokes).not.toHaveBeenCalled();
  });

  it("여러 pointer-move tick으로 이뤄진 스트로크는 세그먼트 전부가 단일 appendStrokeEvents 호출로 한 번에 저장된다(Defect 1, R9 corrective 최종: 원자적 단일 요청)", async () => {
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
    drawMultiSegmentStroke();

    // 세그먼트마다 개별 호출(N번 왕복)이 아니라, 스트로크 전체가 단 한 번의
    // 호출로 보내진다 — 성능(왕복 횟수)과 원자성(부분 실패 방지) 둘 다 이 한
    // 번의 호출 안에서 DB 트랜잭션으로 보장된다.
    await waitFor(() => expect(annotationActions.appendStrokeEvents).toHaveBeenCalledTimes(1));
    const [, calledSegs] = vi.mocked(annotationActions.appendStrokeEvents).mock.calls[0];
    expect(calledSegs).toHaveLength(3);
    // 세그먼트 순서 그대로 3개 전부 한 배열로 저장됨 — 마지막 것만 남지 않는다. 각
    // 세그먼트의 끝점(x1)이 다음 세그먼트의 시작점(x0)과 이어져 원래 경로(10,10→
    // 20,20→30,10→15,25)가 끊김 없이 복원 가능함을 확인한다(좌표는 정규화되어
    // 저장되므로 절대값이 아니라 연결 관계로 검증한다).
    expect(calledSegs[0].x1).toBeCloseTo(calledSegs[1].x0);
    expect(calledSegs[1].x1).toBeCloseTo(calledSegs[2].x0);
    expect(calledSegs[0].x0).not.toBeCloseTo(calledSegs[2].x1);
  });

  it("스트로크 저장 실패 시 로컬에 낙관적으로 그린 스트로크를 서버 replay 기준으로 되돌린다(고스트 스트로크 방지) — 다중 세그먼트도 전부 되돌아간다", async () => {
    vi.mocked(annotationActions.appendStrokeEvents).mockRejectedValueOnce(new Error("network error"));
    vi.mocked(annotationActions.replayAnnotationEvents).mockResolvedValue([]); // 서버엔 아무 것도 저장 안 됨(원자적 실패 — 부분 저장 없음)

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
    drawMultiSegmentStroke(); // 3개 세그먼트 — 단일 호출 실패 시 전부(부분 아님) 되돌려져야 함

    // 실패하면 에러 문구가 뜨고, replayAnnotationEvents로 서버 기준(빈 상태)으로 재동기화된다.
    // appendStrokeEvents는 1번만 호출됐다(세그먼트별 재시도/부분 호출 없음) — 실패한
    // 그 한 번의 호출이 스트로크 전체(3개 세그먼트)를 대표하므로, 실패 = 전체 실패다.
    expect(annotationActions.appendStrokeEvents).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText(/network error/)).toBeInTheDocument());
    await waitFor(() => expect(annotationActions.replayAnnotationEvents).toHaveBeenCalledWith("s1"));
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
    expect(annotationActions.appendStrokeEvents).not.toHaveBeenCalled();
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
