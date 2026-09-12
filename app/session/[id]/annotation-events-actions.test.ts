import { beforeEach, describe, expect, it, vi } from "vitest";
import { reconstructVisibleStrokes, type AnnotationEvent } from "./annotation-events-types";

const { insertMock, orderMock, eqMock, selectMock, fromMock, rpcMock } = vi.hoisted(() => {
  const insertMock = vi.fn();
  const orderMock = vi.fn();
  const eqMock = vi.fn(() => ({ order: orderMock }));
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ insert: insertMock, select: selectMock }));
  const rpcMock = vi.fn();
  return { insertMock, orderMock, eqMock, selectMock, fromMock, rpcMock };
});

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({
    supabase: { from: fromMock, rpc: rpcMock },
    user: { id: "u1" },
    profile: { role: "teacher", name: "선생님" },
  }),
}));

describe("annotation-events-actions (R8 follow-up, session_annotation_events)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMock.mockResolvedValue({ error: null });
    orderMock.mockResolvedValue({ data: [], error: null });
    rpcMock.mockResolvedValue({ data: [], error: null });
  });

  // R9 corrective(최종 라운드) — 세그먼트마다 개별 insert를 순차 호출하던
  // appendStrokeEvent(단수) 루프는 (1) 세그먼트 수만큼 느리고 (2) 중간 실패 시
  // 반쪽 스트로크가 남는 원자성 결함이 있어, 스트로크 전체를 단일 RPC 호출
  // (append_stroke_events, DB 트랜잭션으로 원자적 append)로 보내는
  // appendStrokeEvents(복수)로 교체됐다.
  describe("appendStrokeEvents", () => {
    it("author_id를 클라이언트가 넘기지 않고, 세그먼트 배열 전체를 단일 RPC 호출로 append한다", async () => {
      const { appendStrokeEvents } = await import("./annotation-events-actions");
      const segs = [
        { x0: 0.1, y0: 0.1, x1: 0.2, y1: 0.2, color: "#000", tool: "pen" as const },
        { x0: 0.2, y0: 0.2, x1: 0.3, y1: 0.3, color: "#000", tool: "pen" as const },
      ];
      await appendStrokeEvents("s1", segs);

      expect(rpcMock).toHaveBeenCalledTimes(1);
      expect(rpcMock).toHaveBeenCalledWith("append_stroke_events", {
        p_session_id: "s1",
        p_segments: segs,
      });
      // author_id는 DB 함수 내부에서 auth.uid()로 고정되므로 클라이언트가 넘기지 않는다.
      expect(insertMock).not.toHaveBeenCalled();
    });

    it("세그먼트가 빈 배열이면 RPC를 호출하지 않는다", async () => {
      const { appendStrokeEvents } = await import("./annotation-events-actions");
      await appendStrokeEvents("s1", []);
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it("RPC 에러는 그대로 throw한다(호출자가 잡아 replayAndRedraw로 재동기화)", async () => {
      rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
      const { appendStrokeEvents } = await import("./annotation-events-actions");
      await expect(
        appendStrokeEvents("s1", [{ x0: 0, y0: 0, x1: 0, y1: 0, color: "#000", tool: "pen" }])
      ).rejects.toThrow("boom");
    });
  });

  describe("appendClearAllEvent", () => {
    it("clear_all 이벤트를 author_id=현재 사용자로 append한다", async () => {
      const { appendClearAllEvent } = await import("./annotation-events-actions");
      await appendClearAllEvent("s1");

      expect(insertMock).toHaveBeenCalledWith({
        session_id: "s1",
        author_id: "u1",
        event_type: "clear_all",
        payload: {},
      });
    });
  });

  describe("replayAnnotationEvents", () => {
    it("seq 오름차순으로 정렬해 조회하고 camelCase로 매핑한다", async () => {
      orderMock.mockResolvedValue({
        data: [
          { seq: "1", id: "e1", author_id: "u1", event_type: "stroke", payload: { a: 1 }, created_at: "t1" },
        ],
        error: null,
      });
      const { replayAnnotationEvents } = await import("./annotation-events-actions");
      const result = await replayAnnotationEvents("s1");

      expect(eqMock).toHaveBeenCalledWith("session_id", "s1");
      expect(orderMock).toHaveBeenCalledWith("seq", { ascending: true });
      expect(result).toEqual([
        { seq: "1", id: "e1", authorId: "u1", eventType: "stroke", payload: { a: 1 }, createdAt: "t1" },
      ]);
    });
  });

  describe("reconstructVisibleStrokes (동시-편집 순서 재생, 순수 함수)", () => {
    function stroke(label: string, seq: number): AnnotationEvent {
      return {
        seq: String(seq),
        id: label,
        authorId: "u1",
        eventType: "stroke",
        payload: { label },
        createdAt: "t",
      };
    }
    function clearAll(seq: number): AnnotationEvent {
      return { seq: String(seq), id: `clear-${seq}`, authorId: "teacher", eventType: "clear_all", payload: {}, createdAt: "t" };
    }

    it("clear_all이 없으면 모든 stroke를 seq 순서 그대로 재구성한다", () => {
      const events = [stroke("a", 1), stroke("b", 2), stroke("c", 3)];
      expect(reconstructVisibleStrokes(events).map((s) => (s as unknown as { label: string }).label)).toEqual([
        "a",
        "b",
        "c",
      ]);
    });

    it("마지막 clear_all 이전의 stroke는 버리고, 이후 stroke만 남긴다", () => {
      const events = [stroke("a", 1), stroke("b", 2), clearAll(3), stroke("c", 4), stroke("d", 5)];
      expect(reconstructVisibleStrokes(events).map((s) => (s as unknown as { label: string }).label)).toEqual([
        "c",
        "d",
      ]);
    });

    it("clear_all 뒤에 아무 stroke도 없으면 빈 배열을 반환한다", () => {
      const events = [stroke("a", 1), clearAll(2)];
      expect(reconstructVisibleStrokes(events)).toEqual([]);
    });

    it("동시에 도착한 것처럼 보이는 두 사용자의 stroke도 seq 순서(도착한 실제 순서)로 재생된다", () => {
      // 클라이언트 타임스탬프가 아니라 DB가 부여한 seq만으로 순서가 정해짐을
      // reconstructVisibleStrokes 레벨에서도 보증한다 — 입력 배열이 이미 seq
      // 오름차순이라고 가정하는 replayAnnotationEvents의 계약을 그대로 신뢰한다.
      const events = [stroke("student-1", 10), stroke("teacher-1", 11), stroke("student-2", 12)];
      expect(reconstructVisibleStrokes(events).map((s) => (s as unknown as { label: string }).label)).toEqual([
        "student-1",
        "teacher-1",
        "student-2",
      ]);
    });
  });
});
