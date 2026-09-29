import { describe, expect, it } from "vitest";
import {
  MST_BLUEPRINT,
  MST_MODULE_LABELS,
  MST_MODULE_ORDER,
  formatMstClock,
  mstMathToolsAllowed,
  mstRemainingSecondsAt,
  nextMstModule,
} from "./mst";

describe("MST 모듈 순서·청사진", () => {
  it("R&W M1 → M2 → 휴식 → Math M1 → M2, 총 98문항 134분", () => {
    expect(MST_MODULE_ORDER).toEqual(["rw_m1", "rw_m2", "break", "math_m1", "math_m2"]);
    expect(nextMstModule("rw_m1")).toBe("rw_m2");
    expect(nextMstModule("rw_m2")).toBe("break");
    expect(nextMstModule("break")).toBe("math_m1");
    expect(nextMstModule("math_m2")).toBeNull();
    const items = MST_MODULE_ORDER.reduce((n, k) => n + MST_BLUEPRINT[k].itemCount, 0);
    const testingSeconds = MST_MODULE_ORDER.filter((k) => k !== "break").reduce((n, k) => n + MST_BLUEPRINT[k].timeLimitSeconds, 0);
    expect(items).toBe(98);
    expect(testingSeconds).toBe(134 * 60);
    expect(MST_BLUEPRINT.break.timeLimitSeconds).toBe(10 * 60);
  });

  it("라벨에 적응형 경로명이 노출되지 않는다", () => {
    for (const label of Object.values(MST_MODULE_LABELS)) expect(label).not.toMatch(/higher|lower|고난도|기본 모듈/i);
  });

  it("계산기·참조표는 Math 모듈에서만", () => {
    expect(mstMathToolsAllowed("rw_m1")).toBe(false);
    expect(mstMathToolsAllowed("rw_m2")).toBe(false);
    expect(mstMathToolsAllowed("break")).toBe(false);
    expect(mstMathToolsAllowed("math_m1")).toBe(true);
    expect(mstMathToolsAllowed("math_m2")).toBe(true);
  });
});

describe("mstRemainingSecondsAt / formatMstClock", () => {
  it("fetch 이후 경과분만 빼고 0 아래로 내려가지 않으며, 시계가 뒤로 가도 늘지 않는다", () => {
    expect(mstRemainingSecondsAt(100, 1_000, 1_000)).toBe(100);
    expect(mstRemainingSecondsAt(100, 1_000, 31_500)).toBe(69);
    expect(mstRemainingSecondsAt(10, 1_000, 999_000)).toBe(0);
    expect(mstRemainingSecondsAt(100, 10_000, 5_000)).toBe(100);
  });
  it("m:ss", () => {
    expect(formatMstClock(1920)).toBe("32:00");
    expect(formatMstClock(65)).toBe("1:05");
    expect(formatMstClock(-3)).toBe("0:00");
  });
});
