import { describe, expect, it } from "vitest";
import { estimateScore, estimateSectionRange, LOWER_PATH_CAP, SCORE_MODEL_VERSION } from "./score-estimate";

describe("estimateSectionRange", () => {
  it("범위는 200-800, 10점 단위, low<=high", () => {
    for (const route of ["lower", "higher"] as const) {
      for (let c = 0; c <= 54; c++) {
        const r = estimateSectionRange(c, 54, route)!;
        expect(r.low).toBeGreaterThanOrEqual(200);
        expect(r.high).toBeLessThanOrEqual(800);
        expect(r.low).toBeLessThanOrEqual(r.high);
        expect(r.low % 10).toBe(0);
        expect(r.high % 10).toBe(0);
      }
    }
  });
  it("정답 수에 대해 단조 증가(경로별)", () => {
    for (const route of ["lower", "higher"] as const) {
      let prev = estimateSectionRange(0, 44, route)!;
      for (let c = 1; c <= 44; c++) {
        const cur = estimateSectionRange(c, 44, route)!;
        expect(cur.low).toBeGreaterThanOrEqual(prev.low);
        expect(cur.high).toBeGreaterThanOrEqual(prev.high);
        prev = cur;
      }
    }
  });
  it("lower 경로는 상한이 낮고 만점이어도 800에 도달하지 못한다", () => {
    const r = estimateSectionRange(54, 54, "lower")!;
    expect(r.high).toBeLessThanOrEqual(LOWER_PATH_CAP);
    expect(estimateSectionRange(54, 54, "higher")!.high).toBe(800);
  });
  it("같은 정답 수라도 higher 경로가 lower 이상(경로별 차이)", () => {
    for (const c of [10, 20, 27, 35, 44, 50]) {
      expect(estimateSectionRange(c, 54, "higher")!.low).toBeGreaterThanOrEqual(estimateSectionRange(c, 54, "lower")!.low);
    }
    expect(estimateSectionRange(40, 54, "higher")!.high).toBeGreaterThan(estimateSectionRange(40, 54, "lower")!.high);
  });
  it("경계 근처 범위가 중간보다 넓다", () => {
    const w = (r: { low: number; high: number }) => r.high - r.low;
    expect(w(estimateSectionRange(20, 54, "higher")!)).toBeGreaterThan(w(estimateSectionRange(45, 54, "higher")!));
  });
  it("잘못된 입력은 null", () => {
    expect(estimateSectionRange(1, 0, "lower")).toBeNull();
    expect(estimateSectionRange(5, 4, "higher")).toBeNull();
  });
});

describe("estimateScore", () => {
  it("총점은 섹션 합(400-1600)이고 모델 버전을 기록한다", () => {
    const e = estimateScore(
      [
        { section: "rw", total: 54, correct: 54 },
        { section: "math", total: 44, correct: 0 },
      ],
      { rw: "higher", math: "lower" },
    )!;
    expect(e.total).toEqual({ low: e.rw.low + e.math.low, high: e.rw.high + e.math.high });
    expect(e.total.low).toBeGreaterThanOrEqual(400);
    expect(e.total.high).toBeLessThanOrEqual(1600);
    expect(e.modelVersion).toBe(SCORE_MODEL_VERSION);
    expect(Object.keys(e).sort()).toEqual(["math", "modelVersion", "rw", "total"]);
  });
  it("채점 전·섹션 누락·경로 미확정이면 null", () => {
    const routes = { rw: "lower", math: "lower" } as const;
    expect(estimateScore([{ section: "rw", total: 54, correct: null }, { section: "math", total: 44, correct: 10 }], routes)).toBeNull();
    expect(estimateScore([{ section: "rw", total: 54, correct: 10 }], routes)).toBeNull();
    expect(estimateScore([{ section: "rw", total: 54, correct: 10 }, { section: "math", total: 44, correct: 10 }], { rw: "lower", math: null })).toBeNull();
  });
});
