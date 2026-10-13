import { describe, expect, it } from "vitest";
import golden from "./__golden__/golden.json";
import * as D from "./dist";
import { oneVar, parseList, twoVar } from "./describe";
import * as I from "./infer";
import { fmt } from "./format";
import { ABSOLUTE_FLOOR, chiTable, tTable, zTable } from "./tables";

const FN = D as unknown as Record<string, (...a: number[]) => number>;
const rel = (a: number, b: number) => (a === b ? 0 : Math.abs(a - b) / Math.max(Math.abs(b), ABSOLUTE_FLOOR));
const close = (a: number, b: number, tol = 1e-9) => expect(rel(a, b)).toBeLessThan(tol);

describe("분포 함수 vs scipy 골든값(상대오차 1e-9)", () => {
  const worst: Record<string, number> = {};
  for (const c of golden.dist) {
    const e = rel(FN[c.fn](...c.args), c.value);
    worst[c.fn] = Math.max(worst[c.fn] ?? 0, e);
  }
  for (const [fn, e] of Object.entries(worst)) {
    it(`${fn}: 최대 상대오차 ${e.toExponential(2)}`, () => { expect(e).toBeLessThan(1e-9); });
  }
  it("골든 케이스가 충분하다", () => { expect(golden.dist.length).toBeGreaterThan(400); });
});

describe("경계·오류 처리", () => {
  it("역함수 경계", () => {
    expect(D.normInv(0)).toBe(-Infinity); expect(D.normInv(1)).toBe(Infinity); expect(D.normInv(1.2)).toBeNaN();
  });
  it("normCdf 대칭", () => { close(D.normCdf(1.3) + D.normCdf(-1.3), 1, 1e-14); });
  it("이항 cdf는 pdf 누적합과 일치", () => {
    let s = 0; for (let k = 0; k <= 7; k++) s += D.binomPdf(20, 0.3, k); close(D.binomCdf(20, 0.3, 7), s, 1e-12);
  });
});

describe("기술통계", () => {
  it("parseList", () => {
    expect(parseList("1, 2\n3;4  5")).toEqual({ ok: true, values: [1, 2, 3, 4, 5] });
    expect(parseList("1, x")).toEqual({ ok: false, error: '"x" is not a number.' });
    expect(parseList("  ").ok).toBe(false);
  });
  it("oneVar: 평균·SD는 scipy/numpy 값, 사분위수는 TI 방식", () => {
    const o = oneVar(golden.describe.xs);
    close(o.mean, golden.describe.mean, 1e-12); close(o.sx!, golden.describe.sx, 1e-12); close(o.sigma, golden.describe.sigma, 1e-12);
    const odd = oneVar([1, 2, 3, 4, 5, 6, 7]);
    expect([odd.q1, odd.median, odd.q3]).toEqual([2, 4, 6]);
    const even = oneVar([1, 2, 3, 4, 5, 6]);
    expect([even.q1, even.median, even.q3]).toEqual([2, 3.5, 5]);
    expect(oneVar([5]).sx).toBeNull();
  });
  it("twoVar vs scipy.linregress", () => {
    const r = twoVar(golden.describe.xs, golden.describe.ys);
    if (!r.ok) throw new Error(r.error);
    const g = golden.describe;
    close(r.value.r, g.r, 1e-12); close(r.value.slope, g.slope, 1e-12); close(r.value.intercept, g.intercept, 1e-12);
    close(r.value.seSlope, g.seSlope, 1e-11); close(r.value.seIntercept, g.seIntercept, 1e-11); close(r.value.s, g.s, 1e-12);
    close(r.value.pSlopeTwoSided, g.p, 1e-9); close(r.value.tSlope, g.t, 1e-11);
  });
  it("twoVar 오류", () => {
    expect(twoVar([1, 2, 3], [1, 2]).ok).toBe(false);
    expect(twoVar([1, 1, 1], [1, 2, 3]).ok).toBe(false);
    expect(twoVar([1, 2], [1, 2]).ok).toBe(false);
  });
});

function raw(r: I.InferResult) { if (!r.ok) throw new Error(r.error); return r.raw; }

describe("검정·구간 vs scipy", () => {
  const g = golden.infer;
  it("1-sample t", () => {
    const [x, s, n, mu0] = g.t1.in;
    for (const [alt, key] of [["two", "p2"], ["greater", "pr"], ["less", "pl"]] as const) {
      const r = raw(I.meanOneSample({ kind: "t", xbar: x, s, n, mu0, alt, conf: 0.95 }));
      close(r.stat, g.t1.t, 1e-12); close(r.p, g.t1[key], 1e-9); close(r.lower, g.t1.lo, 1e-11); close(r.upper, g.t1.hi, 1e-11);
    }
  });
  it("2-sample t: Welch·pooled", () => {
    for (const [pooled, k] of [[false, "t2_welch"], [true, "t2_pooled"]] as const) {
      const e = g[k]; const a = e.in;
      const r = raw(I.meanTwoSample({ kind: "t", x1: a.m1, s1: a.s1, n1: a.n1, x2: a.m2, s2: a.s2, n2: a.n2, d0: 0, alt: "two", conf: 0.95, pooled }));
      close(r.stat, e.t, 1e-12); close(r.p, e.p2, 1e-9); close(r.df, e.df, 1e-12); close(r.lower, e.lo, 1e-10); close(r.upper, e.hi, 1e-10);
    }
  });
  it("1-prop z", () => {
    const [x, n, p0] = g.p1.in;
    const two = raw(I.propOneSample({ x, n, p0, alt: "two", conf: 0.95 }));
    close(two.stat, g.p1.z, 1e-12); close(two.p, g.p1.p2, 1e-9); close(two.lower, g.p1.lo, 1e-11); close(two.upper, g.p1.hi, 1e-11);
    close(raw(I.propOneSample({ x, n, p0, alt: "greater", conf: 0.95 })).p, g.p1.pr, 1e-9);
  });
  it("2-prop z", () => {
    const [x1, n1, x2, n2] = g.p2.in;
    const r = raw(I.propTwoSample({ x1, n1, x2, n2, alt: "two", conf: 0.95 }));
    close(r.stat, g.p2.z, 1e-12); close(r.p, g.p2.p2, 1e-9); close(r.lower, g.p2.lo, 1e-10); close(r.upper, g.p2.hi, 1e-10);
  });
  it("chi-square GOF / independence", () => {
    const a = raw(I.chiSquareGof(g.gof.obs, g.gof.exp, "proportions"));
    close(a.stat, g.gof.chi, 1e-12); close(a.p, g.gof.p, 1e-9); expect(a.df).toBe(g.gof.df);
    const b = raw(I.chiSquareIndependence(g.indep.m));
    close(b.stat, g.indep.chi, 1e-12); close(b.p, g.indep.p, 1e-9); expect(b.df).toBe(g.indep.df);
  });
  it("slope t (요약값)", () => {
    const [b, se, n] = g.slope.in;
    const r = raw(I.slopeInference({ b, se, n, beta0: 0, alt: "two", conf: 0.95 }));
    close(r.stat, g.slope.t, 1e-12); close(r.p, g.slope.p2, 1e-9); close(r.lower, g.slope.lo, 1e-10); close(r.upper, g.slope.hi, 1e-10);
  });
  it("z 평균 검정", () => {
    const r = raw(I.meanOneSample({ kind: "z", xbar: 103, sigma: 15, n: 36, mu0: 100, alt: "greater", conf: 0.9 }));
    close(r.stat, 1.2, 1e-12); close(r.p, 0.11506967022170822, 1e-9);
  });
  it("입력 오류는 메시지를 돌려준다", () => {
    expect(I.meanOneSample({ kind: "t", xbar: 1, s: -1, n: 10, mu0: 0, alt: "two", conf: 0.95 }).ok).toBe(false);
    expect(I.meanOneSample({ kind: "t", xbar: 1, s: 1, n: 1, mu0: 0, alt: "two", conf: 0.95 }).ok).toBe(false);
    expect(I.propOneSample({ x: 11, n: 10, p0: 0.5, alt: "two", conf: 0.95 }).ok).toBe(false);
    expect(I.propOneSample({ x: 5, n: 10, p0: 1, alt: "two", conf: 0.95 }).ok).toBe(false);
    expect(I.propTwoSample({ x1: 0, n1: 10, x2: 0, n2: 10, alt: "two", conf: 0.95 }).ok).toBe(false);
    expect(I.chiSquareGof([1, 2], [0.4, 0.4], "proportions").ok).toBe(false);
    expect(I.chiSquareIndependence([[1, 2], [0, 0]]).ok).toBe(false);
    expect(I.chiSquareIndependence([[1, 2], [3]]).ok).toBe(false);
    expect(I.slopeInference({ b: 1, se: 0, n: 10, beta0: 0, alt: "two", conf: 0.95 }).ok).toBe(false);
    expect(I.meanOneSample({ kind: "t", xbar: 1, s: 1, n: 10, mu0: 0, alt: "two", conf: 95 }).ok).toBe(false);
  });
  it("표본 크기 경고(대표본 조건)", () => {
    const r = I.propOneSample({ x: 3, n: 10, p0: 0.5, alt: "two", conf: 0.95 });
    expect(r.ok && r.notes.some((n) => n.includes("Large-counts"))).toBe(true);
  });
});

describe("fmt", () => {
  it("서식", () => {
    expect(fmt(0.1 + 0.2)).toBe("0.3"); expect(fmt(1234.56789012)).toBe("1234.568"); expect(fmt(0)).toBe("0");
    expect(fmt(1e-7)).toBe("1e-7"); expect(fmt(Infinity)).toBe("∞"); expect(fmt(NaN)).toBe("undefined");
  });
});

describe("생성된 표(골든 대비)", () => {
  it("z표: 알려진 값", () => {
    const t = zTable();
    const cell = (z: number) => {
      const a = Math.abs(z); const label = `${z < 0 ? "-" : ""}${(Math.floor(a * 10 + 1e-9) / 10).toFixed(1)}`;
      return t.rows.find((r) => r.label === label)!.cells[Math.round(a * 100) % 10];
    };
    expect(cell(1.96)).toBe("0.9750"); expect(cell(0)).toBe("0.5000"); expect(cell(-1.64)).toBe("0.0505");
  });
  it("t표: 임계값", () => {
    const t = tTable();
    const row = t.rows.find((r) => r.label === "10")!;
    expect(row.cells[t.columns.indexOf("0.025")]).toBe("2.228");
    const inf = t.rows.find((r) => r.label === "∞")!;
    expect(inf.cells[t.columns.indexOf("0.025")]).toBe("1.960");
  });
  it("χ² 표: 임계값", () => {
    const t = chiTable();
    expect(t.rows.find((r) => r.label === "1")!.cells[t.columns.indexOf("0.05")]).toBe("3.841");
    expect(t.rows.find((r) => r.label === "5")!.cells[t.columns.indexOf("0.05")]).toBe("11.070");
  });
});
