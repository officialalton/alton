import { describe, expect, it } from "vitest";
import { IN_CHUNK_SIZE, orderComparator, selectInChunks, selectInChunksParallel } from "./select-in-chunks";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `id-${i}`);
const echo = (sizes?: number[]) => async (chunk: string[]) => {
  sizes?.push(chunk.length);
  return { data: chunk.map((id) => ({ id })), error: null };
};

describe("selectInChunks", () => {
  it("빈 목록은 조회 없이 빈 결과", async () => {
    let calls = 0;
    const r = await selectInChunks<{ id: string }>([], async () => {
      calls += 1;
      return { data: [], error: null };
    });
    expect(r).toEqual({ data: [], error: null });
    expect(calls).toBe(0);
  });

  it.each([
    [1, [1]],
    [IN_CHUNK_SIZE - 1, [99]],
    [IN_CHUNK_SIZE, [100]],
    [IN_CHUNK_SIZE + 1, [100, 1]],
    [250, [100, 100, 50]],
    [600, [100, 100, 100, 100, 100, 100]],
  ])("경계 %i개 → 청크 %j", async (n, expected) => {
    const sizes: number[] = [];
    const r = await selectInChunks(ids(n), echo(sizes));
    expect(sizes).toEqual(expected);
    expect(r.data.map((x) => x.id)).toEqual(ids(n)); // 입력 순서 유지
    expect(r.error).toBeNull();
  });

  it("중복 id 는 한 번만 조회하고 첫 등장 순서를 지킨다", async () => {
    const r = await selectInChunks(["a", "b", "a", "c", "b"], echo(), 2);
    expect(r.data.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("size 를 숫자 또는 옵션으로 지정할 수 있다", async () => {
    const sizes: number[] = [];
    await selectInChunks(ids(5), echo(sizes), 2);
    await selectInChunks(ids(5), echo(sizes), { size: 3 });
    expect(sizes).toEqual([2, 2, 1, 3, 2]);
  });

  it("sort 옵션이면 청크 경계를 넘어 전체를 다시 정렬한다", async () => {
    const rows = ids(5).map((id, i) => ({ id, n: i }));
    const r = await selectInChunks(
      ids(5),
      async (chunk) => ({ data: rows.filter((x) => chunk.includes(x.id)), error: null }),
      { size: 2, sort: orderComparator(["n", false]) }
    );
    expect(r.data.map((x) => x.n)).toEqual([4, 3, 2, 1, 0]);
  });

  it("오류는 삼키지 않고 첫 오류에서 멈춘다(그때까지 행은 유지)", async () => {
    let calls = 0;
    const r = await selectInChunks<{ id: string }>(ids(5), async (chunk) => {
      calls += 1;
      if (calls === 2) return { data: null, error: { code: "X", message: "boom" } };
      return { data: chunk.map((id) => ({ id })), error: null };
    }, 2);
    expect(r.error).toEqual({ code: "X", message: "boom" });
    expect(r.data.map((x) => x.id)).toEqual(["id-0", "id-1"]);
    expect(calls).toBe(2);
  });
});

describe("selectInChunksParallel", () => {
  it("병렬로 조회해도 청크 순서대로 합친다", async () => {
    const r = await selectInChunksParallel(ids(1050), async (chunk) => {
      await new Promise((res) => setTimeout(res, chunk.length === 100 ? 5 : 0));
      return { data: chunk.map((id) => ({ id })), error: null };
    });
    expect(r.data.map((x) => x.id)).toEqual(ids(1050));
  });

  it("오류를 전파한다", async () => {
    const r = await selectInChunksParallel<{ id: string }>(ids(300), async (chunk) =>
      chunk[0] === "id-100" ? { data: null, error: { message: "bad" } } : { data: [], error: null }
    );
    expect(r.error).toEqual({ message: "bad" });
  });
});

describe("orderComparator", () => {
  it("Postgres 기본 NULL 순서(오름차순 마지막, 내림차순 처음)", () => {
    const rows = [{ a: 2 }, { a: null }, { a: 1 }];
    expect([...rows].sort(orderComparator(["a", true])).map((r) => r.a)).toEqual([1, 2, null]);
    expect([...rows].sort(orderComparator(["a", false])).map((r) => r.a)).toEqual([null, 2, 1]);
  });
  it("다중 키", () => {
    const rows = [{ a: 1, b: 1 }, { a: 1, b: 2 }, { a: 0, b: 9 }];
    expect([...rows].sort(orderComparator(["a", true], ["b", false])).map((r) => r.b)).toEqual([9, 2, 1]);
  });
});
