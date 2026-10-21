import { describe, expect, it } from "vitest";
import { createSupabaseEssayStore } from "./store";

// 행 하나를 가진 최소 supabase 모의 객체: select(...).maybeSingle() 과 update(patch) 를 지원.
function fakeAdmin(row: Record<string, unknown>) {
  const q = (mode: "select" | "update", patch?: Record<string, unknown>) => {
    const c: Record<string, unknown> = {};
    c.eq = () => c;
    c.maybeSingle = async () => ({ data: row });
    c.then = (res: (v: unknown) => unknown) => { if (mode === "update") Object.assign(row, patch); return res({ data: null }); };
    return c;
  };
  return { from: () => ({ select: () => q("select"), update: (p: Record<string, unknown>) => q("update", p) }) } as never;
}
const key = { attemptId: "a", setItemId: "i", partLabel: "x", studentId: "s" };

describe("essay store finish 비용 누적", () => {
  it("재시도마다 cost·토큰이 합산되고, 비용 없는 finish(한도 대기)는 값을 건드리지 않는다", async () => {
    const row: Record<string, unknown> = { cost_usd: 0.1, input_tokens: 1000, output_tokens: 100 };
    const store = createSupabaseEssayStore(fakeAdmin(row));
    await store.finish(key, { status: "failed", costUsd: 0.05, inputTokens: 500, outputTokens: 50 });
    expect(row).toMatchObject({ cost_usd: 0.15, input_tokens: 1500, output_tokens: 150 });
    await store.finish(key, { status: "failed", lastError: "daily_cap" });
    expect(row.cost_usd).toBe(0.15);
    await store.finish(key, { status: "failed", costUsd: 0, inputTokens: 0, outputTokens: 0 });
    expect(row.cost_usd).toBe(0.15); // 호출 전 실패(0)가 과거 지출을 지우지 않는다
  });
});
