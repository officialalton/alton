import { describe, expect, it } from "vitest";
import { clampWbHeight, strokesMaxY, wbSizeProblem, WB_MAX_H, WB_MAX_SEGMENTS, WB_MIN_H, WB_TOO_LARGE } from "./whiteboard-size";

const seg = (y1: number, w: number | undefined = 640) => ({ x0: 0, y0: 0, x1: 5, y1, color: "#111111", w });

describe("whiteboard-size", () => {
  it("clamp: 최소·최대와 그린 곳 아래 하한", () => {
    expect(clampWbHeight(100)).toBe(WB_MIN_H);
    expect(clampWbHeight(99999)).toBe(WB_MAX_H);
    expect(clampWbHeight(500, [seg(700)])).toBe(710);
    expect(clampWbHeight(1200, [seg(700)])).toBe(1200);
    expect(clampWbHeight(Number.NaN)).toBe(WB_MIN_H);
  });
  it("다른 기준 폭(w)으로 저장된 선분은 640 기준으로 환산해 maxY 를 계산", () => {
    expect(strokesMaxY([seg(400, 320)])).toBe(800);
    expect(strokesMaxY([seg(100, undefined)])).toBe(100);
  });
  it("선분 수 상한", () => {
    expect(wbSizeProblem([seg(1)])).toBeNull();
    expect(wbSizeProblem(Array.from({ length: WB_MAX_SEGMENTS + 1 }, () => seg(1)))).toBe(WB_TOO_LARGE);
  });
});
