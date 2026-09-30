import { describe, expect, it } from "vitest";
import { estimateScore, estimateSectionRange } from "./score-estimate";

describe("estimateSectionRange", () => {
  it("범위는 200-800으로 자르고 10점 단위", () => {
    expect(estimateSectionRange(0, 27)).toEqual({ low: 200, high: 260 });
    expect(estimateSectionRange(27, 27)).toEqual({ low: 740, high: 800 });
    const mid = estimateSectionRange(13, 27)!;
    expect(mid.low % 10).toBe(0);
    expect(mid.high - mid.low).toBe(120);
  });
  it("잘못된 입력은 null", () => {
    expect(estimateSectionRange(1, 0)).toBeNull();
    expect(estimateSectionRange(5, 4)).toBeNull();
  });
});

describe("estimateScore", () => {
  it("총점은 섹션 합(400-1600)", () => {
    const e = estimateScore([
      { section: "rw", total: 54, correct: 54 },
      { section: "math", total: 44, correct: 0 },
    ])!;
    expect(e.total).toEqual({ low: 740 + 200, high: 800 + 260 });
    expect(e.total.low).toBeGreaterThanOrEqual(400);
    expect(e.total.high).toBeLessThanOrEqual(1600);
  });
  it("채점 전(correct null)이거나 한 섹션이 없으면 null", () => {
    expect(estimateScore([{ section: "rw", total: 54, correct: null }, { section: "math", total: 44, correct: 10 }])).toBeNull();
    expect(estimateScore([{ section: "rw", total: 54, correct: 10 }])).toBeNull();
  });
});
