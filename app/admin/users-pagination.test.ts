import { describe, expect, it } from "vitest";
import { clampPage, pageCountFor, pageWindow, rangeLabel } from "./users-pagination";

describe("users-pagination", () => {
  it("pageCountFor는 최소 1페이지", () => {
    expect(pageCountFor(0, 10)).toBe(1);
    expect(pageCountFor(10, 10)).toBe(1);
    expect(pageCountFor(11, 10)).toBe(2);
    expect(pageCountFor(2000, 10)).toBe(200);
  });
  it("clampPage", () => {
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(9, 5)).toBe(5);
    expect(clampPage(NaN, 5)).toBe(1);
    expect(clampPage(3.7, 5)).toBe(3);
  });
  it("pageWindow는 처음·끝·현재 주변과 gap을 만든다", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 4)).toEqual([1, 2, 3, 4]);
    expect(pageWindow(1, 20)).toEqual([1, 2, "gap", 20]);
    expect(pageWindow(10, 20)).toEqual([1, "gap", 9, 10, 11, "gap", 20]);
    expect(pageWindow(20, 20)).toEqual([1, "gap", 19, 20]);
    expect(pageWindow(3, 20)).toEqual([1, 2, 3, 4, "gap", 20]);
  });
  it("rangeLabel", () => {
    expect(rangeLabel(1, 10, 0)).toEqual({ from: 0, to: 0 });
    expect(rangeLabel(2, 10, 15)).toEqual({ from: 11, to: 15 });
  });
});
