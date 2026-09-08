import { describe, expect, it, vi } from "vitest";
import { loadSessionHomeworkStatus } from "./homework-composition-data";

// Gap 2 (2026-09-08, 제품 오너 리뷰) — loadSessionHomeworkStatus()의 상태 파생
// 로직(not_started/draft/submitted)을 mocked 클라이언트로 검증한다. 실제
// RLS(담당 아닌 선생님이 호출하면 세 테이블 모두 안 보인다)는
// homework-teacher-view.integration.test.ts가 psql로 검증한다.

function buildMockSupabase(options: {
  items: Array<{ id: string; problem_id: string; position: number }>;
  problems: Array<{ id: string; format: string; passage: string | null; options: unknown }>;
  attempts: Array<{ homework_item_id: string; response: unknown; submitted: boolean }>;
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === "session_homework_items") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: options.items, error: null }),
            }),
          }),
        };
      }
      if (table === "problems") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: options.problems, error: null }),
          }),
        };
      }
      if (table === "session_homework_attempts") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: options.attempts, error: null }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

describe("loadSessionHomeworkStatus", () => {
  it("답안이 없으면 not_started", async () => {
    const client = buildMockSupabase({
      items: [{ id: "i1", problem_id: "p1", position: 1 }],
      problems: [{ id: "p1", format: "mc", passage: "문제", options: ["A", "B"] }],
      attempts: [],
    });
    const result = await loadSessionHomeworkStatus(client as never, "s1");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("not_started");
    expect(result[0].response).toBeNull();
  });

  it("submitted=false인 답안이 있으면 draft", async () => {
    const client = buildMockSupabase({
      items: [{ id: "i1", problem_id: "p1", position: 1 }],
      problems: [{ id: "p1", format: "mc", passage: "문제", options: ["A", "B"] }],
      attempts: [{ homework_item_id: "i1", response: { type: "mc", selected: 0 }, submitted: false }],
    });
    const result = await loadSessionHomeworkStatus(client as never, "s1");
    expect(result[0].status).toBe("draft");
    expect(result[0].response).toEqual({ type: "mc", selected: 0 });
  });

  it("submitted=true인 답안이 있으면 submitted, MC 응답 그대로 반환", async () => {
    const client = buildMockSupabase({
      items: [{ id: "i1", problem_id: "p1", position: 1 }],
      problems: [{ id: "p1", format: "mc", passage: "문제", options: ["A", "B", "C"] }],
      attempts: [{ homework_item_id: "i1", response: { type: "mc", selected: 2 }, submitted: true }],
    });
    const result = await loadSessionHomeworkStatus(client as never, "s1");
    expect(result[0].status).toBe("submitted");
    expect(result[0].format).toBe("mc");
    expect(result[0].options).toEqual(["A", "B", "C"]);
    expect(result[0].response).toEqual({ type: "mc", selected: 2 });
  });

  it("서술형 제출 답안도 그대로 반환한다", async () => {
    const client = buildMockSupabase({
      items: [{ id: "i1", problem_id: "p1", position: 1 }],
      problems: [{ id: "p1", format: "essay", passage: "서술형 문제", options: null }],
      attempts: [{ homework_item_id: "i1", response: { type: "text", text: "제 답은 이렇습니다" }, submitted: true }],
    });
    const result = await loadSessionHomeworkStatus(client as never, "s1");
    expect(result[0].status).toBe("submitted");
    expect(result[0].response).toEqual({ type: "text", text: "제 답은 이렇습니다" });
  });

  it("발급된 과제가 없으면 빈 배열을 반환한다", async () => {
    const client = buildMockSupabase({ items: [], problems: [], attempts: [] });
    const result = await loadSessionHomeworkStatus(client as never, "s1");
    expect(result).toEqual([]);
  });
});
