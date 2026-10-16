import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAlreadyUsedProblemIds } from "./used-problem-ids";

// 공개 세트가 수백 개여도 exam_set_id IN (...) 이 URI 한도를 넘지 않도록 나눠 조회하는지(2026-10-01 통합 테스트에서 "URI too long" 실제 발생).
function fakeDb(setCount: number) {
  const sets = Array.from({ length: setCount }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` }));
  const inSizes: number[] = [];
  const db = {
    from(table: string) {
      const q: Record<string, unknown> = {};
      let chunk: string[] = [];
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: (_col: string, ids: string[]) => { inSizes.push(ids.length); chunk = ids; return builder; },
        order: () => builder,
        range: async (from: number) => ({ data: from === 0 ? chunk.map((id) => ({ problem_id: `p-${id}` })) : [], error: null }),
        then: (resolve: (v: unknown) => void) => resolve({ data: table === "mock_exam_sets" ? sets : [], error: null }),
      };
      void q;
      return builder;
    },
  };
  return { db: db as unknown as SupabaseClient, inSizes, sets };
}

describe("fetchAlreadyUsedProblemIds", () => {
  it("세트 300개를 50개씩 나눠 조회하고 모든 문항 id 를 합친다", async () => {
    const { db, inSizes } = fakeDb(300);
    const ids = await fetchAlreadyUsedProblemIds(db, "standard");
    expect(Math.max(...inSizes)).toBeLessThanOrEqual(50);
    expect(inSizes.length).toBe(6);
    expect(ids.size).toBe(300);
  });
  it("공개 세트가 없으면 조회하지 않고 빈 집합", async () => {
    const { db, inSizes } = fakeDb(0);
    expect((await fetchAlreadyUsedProblemIds(db, "standard")).size).toBe(0);
    expect(inSizes).toHaveLength(0);
  });
});
