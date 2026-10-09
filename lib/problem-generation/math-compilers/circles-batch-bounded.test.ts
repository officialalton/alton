import { describe, expect, it, vi } from "vitest";
import { runMathCompilerBatch } from "./batch";

// compile-gap.ts 메모리 폭주(>4GB) 보고 대응 — 재현은 되지 않았으나(힙 ~140MB), circles easy 는 종류가 1개(반지름 2~20, 서로 다른 문항 19개)라
// 요청 수가 아무리 커도 배치가 후보 상한·벽시계 상한 안에서 끝나고 결과가 요청 상한(10)을 넘지 않음을 고정한다.
describe("runMathCompilerBatch(circles) — 상한", () => {
  it("easy 에서 count 가 매우 커도 후보 수·반환 수가 유한하고 힙이 폭주하지 않는다", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const before = process.memoryUsage().heapUsed;
    for (const format of ["mc", "spr"] as const) {
      const res = await runMathCompilerBatch({ skillCode: "circles" as never, difficulty: "easy", count: 100000, format });
      expect(res.accepted.length).toBeLessThanOrEqual(10);
      expect(res.stats.candidatesEvaluated).toBeLessThanOrEqual(100);
    }
    expect(process.memoryUsage().heapUsed - before).toBeLessThan(300 * 1024 * 1024);
  });
});
