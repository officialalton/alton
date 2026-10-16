import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => ({}) }));

import { selectInChunks } from "./users-data";

describe("selectInChunks", () => {
  it("id 를 100개씩 나눠 조회하고 결과를 합친다(URI too long 회피)", async () => {
    const ids = Array.from({ length: 379 }, (_, i) => `id-${i}`);
    const sizes: number[] = [];
    const { data, error } = await selectInChunks<string>(ids, async (chunk) => {
      sizes.push(chunk.length);
      return { data: chunk, error: null };
    });
    expect(sizes).toEqual([100, 100, 100, 79]);
    expect(data).toEqual(ids);
    expect(error).toBeNull();
  });

  it("빈 목록이면 조회하지 않는다", async () => {
    const run = vi.fn();
    expect(await selectInChunks<string>([], run)).toEqual({ data: [], error: null });
    expect(run).not.toHaveBeenCalled();
  });

  it("한 청크가 실패하면 그 오류를 돌려준다", async () => {
    const { error } = await selectInChunks<string>(["a", "b", "c"], async () => ({ data: null, error: { code: "X" } }), 2);
    expect(error?.code).toBe("X");
  });
});
