import { describe, expect, it, vi } from "vitest";
import { loadStudentHomeworkV3 } from "./homework-v3-data";

// R9 corrective — loadStudentHomeworkV3()의 표시 시점 confirmed 재검증 로직을
// mocked 클라이언트로 검증한다(실제 RLS/트리거는
// homework-v3.integration.test.ts가 psql로 검증한다).

function buildMockSupabase(options: {
  items: Array<{ id: string; session_id: string; problem_id: string; position: number; composed_at: string }>;
  problems: Array<{ id: string; status: string; format: string; passage: string | null; options: unknown }>;
  attempts: Array<{ id: string; homework_item_id: string; response: unknown; submitted: boolean }>;
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
            in: () => ({
              eq: () => Promise.resolve({ data: options.attempts, error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
}

describe("loadStudentHomeworkV3 — 표시 시점 confirmed 재검증", () => {
  it("confirmed인 문제는 콘텐츠를 보여준다", async () => {
    const client = buildMockSupabase({
      items: [{ id: "i1", session_id: "s1", problem_id: "p1", position: 1, composed_at: "2026-01-01" }],
      problems: [{ id: "p1", status: "confirmed", format: "mc", passage: "문제 본문", options: null }],
      attempts: [],
    });
    const result = await loadStudentHomeworkV3(client as never, "student-1");
    expect(result).toHaveLength(1);
    expect(result[0].contentVisible).toBe(true);
    expect(result[0].problem?.passage).toBe("문제 본문");
  });

  it("발급 이후 unconfirmed가 된 문제는 콘텐츠를 숨기지만 항목 자체는 유지한다", async () => {
    const client = buildMockSupabase({
      items: [{ id: "i1", session_id: "s1", problem_id: "p1", position: 1, composed_at: "2026-01-01" }],
      problems: [{ id: "p1", status: "draft", format: "mc", passage: "문제 본문", options: null }],
      attempts: [],
    });
    const result = await loadStudentHomeworkV3(client as never, "student-1");
    expect(result).toHaveLength(1);
    expect(result[0].contentVisible).toBe(false);
    expect(result[0].problem).toBeNull();
  });

  it("본인 답안이 있으면 attempt를 함께 반환한다", async () => {
    const client = buildMockSupabase({
      items: [{ id: "i1", session_id: "s1", problem_id: "p1", position: 1, composed_at: "2026-01-01" }],
      problems: [{ id: "p1", status: "confirmed", format: "mc", passage: "문제", options: null }],
      attempts: [{ id: "a1", homework_item_id: "i1", response: "내 답", submitted: true }],
    });
    const result = await loadStudentHomeworkV3(client as never, "student-1");
    expect(result[0].attempt).toEqual({ id: "a1", response: "내 답", submitted: true });
  });

  it("배정된 과제가 없으면 빈 배열을 반환한다", async () => {
    const client = buildMockSupabase({ items: [], problems: [], attempts: [] });
    const result = await loadStudentHomeworkV3(client as never, "student-1");
    expect(result).toEqual([]);
  });
});
