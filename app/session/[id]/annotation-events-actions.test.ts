import { beforeEach, describe, expect, it, vi } from "vitest";
import { reconstructVisibleStrokes, type AnnotationEvent } from "./annotation-events-actions";

const { insertMock, orderMock, eqMock, selectMock, fromMock } = vi.hoisted(() => {
  const insertMock = vi.fn();
  const orderMock = vi.fn();
  const eqMock = vi.fn(() => ({ order: orderMock }));
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ insert: insertMock, select: selectMock }));
  return { insertMock, orderMock, eqMock, selectMock, fromMock };
});

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({
    supabase: { from: fromMock },
    user: { id: "u1" },
    profile: { role: "teacher", name: "선생님" },
  }),
}));

describe("annotation-events-actions (R8 follow-up, session_annotation_events)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMock.mockResolvedValue({ error: null });
    orderMock.mockResolvedValue({ data: [], error: null });
  });

  describe("appendStrokeEvent", () => {
    it("author_id는 항상 현재 로그인 사용자로 고정해서 stroke 이벤트를 append한다", async () => {
      const { appendStrokeEvent } = await import("./annotation-events-actions");
      await appendStrokeEvent("s1", { x0: 0.1, y0: 0.1, x1: 0.2, y1: 0.2, color: "#000", tool: "pen" });

      expect(fromMock).toHaveBeenCalledWith("session_annotation_events");
      expect(insertMock).toHaveBeenCalledWith({
        session_id: "s1",
        author_id: "u1",
        event_type: "stroke",
        payload: { x0: 0.1, y0: 0.1, x1: 0.2, y1: 0.2, color: "#000", tool: "pen" },
      });
    });

    it("insert 에러는 그대로 throw한다", async () => {
      insertMock.mockResolvedValue({ error: { message: "boom" } });
      const { appendStrokeEvent } = await import("./annotation-events-actions");
      await expect(
        appendStrokeEvent("s1", { x0: 0, y0: 0, x1: 0, y1: 0, color: "#000", tool: "pen" })
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
