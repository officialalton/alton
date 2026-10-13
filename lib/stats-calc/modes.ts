import { binomCdf, binomPdf, chiInv, chiPdf, chiSf, geomCdf, geomPdf, normCdf, normInv, normPdf, tCdf, tInv, tPdf } from "./dist";
import { oneVar, parseList, twoVar } from "./describe";
import { fmt } from "./format";
import * as I from "./infer";
import type { InferResult, Row } from "./infer";

// 계산기 화면이 그대로 그리는 "모드" 정의(입력 필드 + 실행 함수). 화면과 분리해 단위 테스트한다.
export type FieldKind = "number" | "select" | "list" | "matrix";
export type FieldDef = { key: string; label: string; kind: FieldKind; options?: { value: string; label: string }[]; def?: string; hint?: string };
export type ModeGroup = "Distributions" | "Data" | "Tests and intervals";
export type ModeDef = { id: string; group: ModeGroup; label: string; fields: FieldDef[]; outside2027?: boolean; help?: string; run: (v: Record<string, string>) => InferResult };

class InputError extends Error {}

/** 숫자 입력: 소수, 분수(a/b), 퍼센트(95%), inf / -inf / ∞ 를 받는다. */
export function parseNum(raw: string | undefined, label: string, allowInf = false): number {
  const s = (raw ?? "").trim().replace(/−/g, "-").replace(/,/g, "");
  if (s === "") throw new InputError(`Enter a value for ${label}.`);
  const low = s.toLowerCase();
  if (["inf", "+inf", "∞", "+∞", "infinity"].includes(low)) { if (allowInf) return Infinity; throw new InputError(`${label} must be a finite number.`); }
  if (["-inf", "-∞", "-infinity"].includes(low)) { if (allowInf) return -Infinity; throw new InputError(`${label} must be a finite number.`); }
  let v: number;
  const frac = /^([+-]?\d*\.?\d+(?:e[+-]?\d+)?)\/(\d*\.?\d+(?:e[+-]?\d+)?)$/i.exec(s);
  if (frac) v = Number(frac[1]) / Number(frac[2]);
  else if (s.endsWith("%")) v = Number(s.slice(0, -1)) / 100;
  else v = Number(s);
  if (!Number.isFinite(v)) throw new InputError(`${label} is not a valid number.`);
  return v;
}
function int(raw: string | undefined, label: string, min = 0): number {
  const v = parseNum(raw, label);
  if (!Number.isInteger(v) || v < min) throw new InputError(`${label} must be a whole number${min > 0 ? ` of at least ${min}` : " (0 or more)"}.`);
  return v;
}
function positive(raw: string | undefined, label: string): number { const v = parseNum(raw, label); if (!(v > 0)) throw new InputError(`${label} must be greater than 0.`); return v; }
function prob(raw: string | undefined, label: string, open = false): number {
  const v = parseNum(raw, label);
  if (open ? !(v > 0 && v < 1) : !(v >= 0 && v <= 1)) throw new InputError(`${label} must be ${open ? "strictly between" : "between"} 0 and 1.`);
  return v;
}
function list(raw: string | undefined, label: string): number[] {
  const r = parseList(raw ?? "");
  if (!r.ok) throw new InputError(`${label}: ${r.error}`);
  return r.values;
}
function matrix(raw: string | undefined, label: string): number[][] {
  const rows = (raw ?? "").split(/\n/).map((l) => l.trim()).filter((l) => l !== "");
  if (rows.length === 0) throw new InputError(`${label}: enter at least one row.`);
  return rows.map((l) => { const r = parseList(l); if (!r.ok) throw new InputError(`${label}: ${r.error}`); return r.values; });
}
const alt = (v: Record<string, string>): I.Alt => (v.alt === "less" || v.alt === "greater" ? v.alt : "two");

const ok = (title: string, rows: Row[], notes: string[] = []): InferResult => ({ ok: true, title, rows, tables: [], notes, raw: {} });
const safe = (fn: (v: Record<string, string>) => InferResult) => (v: Record<string, string>): InferResult => {
  try { return fn(v); } catch (e) { if (e instanceof InputError) return { ok: false, error: e.message }; throw e; }
};

const ALT_FIELD: FieldDef = { key: "alt", label: "Alternative hypothesis", kind: "select", def: "two", options: [{ value: "two", label: "two-sided (≠)" }, { value: "less", label: "left-tailed (<)" }, { value: "greater", label: "right-tailed (>)" }] };
const CONF_FIELD: FieldDef = { key: "conf", label: "Confidence level (0–1)", kind: "number", def: "0.95" };
const num = (key: string, label: string, def?: string, hint?: string): FieldDef => ({ key, label, kind: "number", def, hint });
const BOUNDS_HINT = "Use -inf or inf for no bound.";

function between(lo: number, hi: number) { if (lo > hi) throw new InputError("The lower bound must not exceed the upper bound."); }
/** 일반 구간 확률 계산: 상보 꼬리를 써서 먼 꼬리에서도 상대정밀도를 유지한다. */
const sym = (cdf: (x: number) => number, lo: number, hi: number) => (lo > 0 ? cdf(-lo) - cdf(-hi) : cdf(hi) - cdf(lo));

export const STATS_MODES: ModeDef[] = [
  { id: "normalcdf", group: "Distributions", label: "normalcdf — normal probability", help: "P(lower < X < upper) for X ~ N(μ, σ).",
    fields: [num("lo", "Lower bound", undefined, BOUNDS_HINT), num("hi", "Upper bound", undefined, BOUNDS_HINT), num("mu", "Mean μ", "0"), num("sd", "Standard deviation σ", "1")],
    run: safe((v) => { const lo = parseNum(v.lo, "Lower bound", true), hi = parseNum(v.hi, "Upper bound", true), mu = parseNum(v.mu, "μ"), sd = positive(v.sd, "σ"); between(lo, hi);
      const p = sym((x) => normCdf(x, mu, sd), lo, hi); return ok("normalcdf", [["P(lower < X < upper)", fmt(p)], ["z-score of lower", fmt((lo - mu) / sd)], ["z-score of upper", fmt((hi - mu) / sd)]]); }) },
  { id: "normalpdf", group: "Distributions", label: "normalpdf — normal density", fields: [num("x", "x"), num("mu", "Mean μ", "0"), num("sd", "Standard deviation σ", "1")],
    run: safe((v) => ok("normalpdf", [["f(x)", fmt(normPdf(parseNum(v.x, "x"), parseNum(v.mu, "μ"), positive(v.sd, "σ")))]])) },
  { id: "invnorm", group: "Distributions", label: "invNorm — normal percentile", help: "The value x with the given area to its LEFT.",
    fields: [num("area", "Area to the left (0–1)"), num("mu", "Mean μ", "0"), num("sd", "Standard deviation σ", "1")],
    run: safe((v) => { const a = prob(v.area, "Area", true); const mu = parseNum(v.mu, "μ"), sd = positive(v.sd, "σ"); const x = normInv(a, mu, sd); return ok("invNorm", [["x", fmt(x)], ["z-score", fmt((x - mu) / sd)]]); }) },
  { id: "tcdf", group: "Distributions", label: "tcdf — t probability", help: "P(lower < T < upper) with df degrees of freedom.",
    fields: [num("lo", "Lower bound", undefined, BOUNDS_HINT), num("hi", "Upper bound", undefined, BOUNDS_HINT), num("df", "Degrees of freedom")],
    run: safe((v) => { const lo = parseNum(v.lo, "Lower bound", true), hi = parseNum(v.hi, "Upper bound", true), df = positive(v.df, "df"); between(lo, hi); return ok("tcdf", [["P(lower < T < upper)", fmt(sym((x) => tCdf(x, df), lo, hi))]]); }) },
  { id: "tpdf", group: "Distributions", label: "tpdf — t density", fields: [num("x", "x"), num("df", "Degrees of freedom")],
    run: safe((v) => ok("tpdf", [["f(x)", fmt(tPdf(parseNum(v.x, "x"), positive(v.df, "df")))]])) },
  { id: "invt", group: "Distributions", label: "invT — t percentile", help: "The value t* with the given area to its LEFT. For a C-level interval use area = 1 − (1 − C)/2.",
    fields: [num("area", "Area to the left (0–1)"), num("df", "Degrees of freedom")],
    run: safe((v) => ok("invT", [["t", fmt(tInv(prob(v.area, "Area", true), positive(v.df, "df")))]])) },
  { id: "chicdf", group: "Distributions", label: "χ²cdf — chi-square probability", help: "P(lower < χ² < upper). For a p-value use lower = the statistic, upper = inf.",
    fields: [num("lo", "Lower bound", undefined, BOUNDS_HINT), num("hi", "Upper bound", undefined, BOUNDS_HINT), num("df", "Degrees of freedom")],
    run: safe((v) => { const lo = parseNum(v.lo, "Lower bound", true), hi = parseNum(v.hi, "Upper bound", true), df = positive(v.df, "df"); between(lo, hi); return ok("χ²cdf", [["P(lower < χ² < upper)", fmt(chiSf(lo, df) - chiSf(hi, df))]]); }) },
  { id: "chipdf", group: "Distributions", label: "χ²pdf — chi-square density", fields: [num("x", "x (≥ 0)"), num("df", "Degrees of freedom")],
    run: safe((v) => ok("χ²pdf", [["f(x)", fmt(chiPdf(parseNum(v.x, "x"), positive(v.df, "df")))]])) },
  { id: "invchi", group: "Distributions", label: "invχ² — chi-square percentile", help: "The value with the given area to its LEFT. For a critical value at level α use area = 1 − α.",
    fields: [num("area", "Area to the left (0–1)"), num("df", "Degrees of freedom")],
    run: safe((v) => ok("invχ²", [["χ²", fmt(chiInv(prob(v.area, "Area", true), positive(v.df, "df")))]])) },
  { id: "binompdf", group: "Distributions", label: "binompdf — P(X = k)", fields: [num("n", "Number of trials n"), num("p", "Success probability p"), num("k", "k")],
    run: safe((v) => { const n = int(v.n, "n", 1), p = prob(v.p, "p"), k = int(v.k, "k"); if (k > n) throw new InputError("k cannot exceed n."); return ok("binompdf", [["P(X = k)", fmt(binomPdf(n, p, k))], ["Mean np", fmt(n * p)], ["SD √(np(1−p))", fmt(Math.sqrt(n * p * (1 - p)))]]); }) },
  { id: "binomcdf", group: "Distributions", label: "binomcdf — P(X ≤ k)", fields: [num("n", "Number of trials n"), num("p", "Success probability p"), num("k", "k")],
    run: safe((v) => { const n = int(v.n, "n", 1), p = prob(v.p, "p"), k = int(v.k, "k"); if (k > n) throw new InputError("k cannot exceed n."); const c = binomCdf(n, p, k); return ok("binomcdf", [["P(X ≤ k)", fmt(c)], ["P(X > k)", fmt(k >= n ? 0 : 1 - c)], ["P(X ≥ k)", fmt(k === 0 ? 1 : 1 - binomCdf(n, p, k - 1))]]); }) },
  { id: "geompdf", group: "Distributions", label: "geometpdf — P(X = k)", outside2027: true, help: "X = number of trials up to and including the first success.", fields: [num("p", "Success probability p"), num("k", "k (≥ 1)")],
    run: safe((v) => ok("geometpdf", [["P(X = k)", fmt(geomPdf(prob(v.p, "p", true), int(v.k, "k", 1)))]])) },
  { id: "geomcdf", group: "Distributions", label: "geometcdf — P(X ≤ k)", outside2027: true, help: "X = number of trials up to and including the first success.", fields: [num("p", "Success probability p"), num("k", "k (≥ 1)")],
    run: safe((v) => { const p = prob(v.p, "p", true), k = int(v.k, "k", 1); return ok("geometcdf", [["P(X ≤ k)", fmt(geomCdf(p, k))], ["P(X > k)", fmt((1 - p) ** k)]]); }) },

  { id: "onevar", group: "Data", label: "1-Var Stats", help: "Separate numbers with spaces, commas or new lines.", fields: [{ key: "x", label: "List", kind: "list" }],
    run: safe((v) => { const o = oneVar(list(v.x, "List")); const outliers = list(v.x, "List").filter((x) => x < o.lowFence || x > o.highFence);
      return ok("1-Var Stats", [["n", String(o.n)], ["x̄ (mean)", fmt(o.mean)], ["Σx", fmt(o.sum)], ["Σx²", fmt(o.sumSq)], ["sₓ (sample SD)", o.sx === null ? "undefined (n = 1)" : fmt(o.sx)], ["σₓ (population SD)", fmt(o.sigma)],
        ["Five-number summary", [o.min, o.q1, o.median, o.q3, o.max].map((x) => fmt(x)).join(",  ")], ["minX / Q₁ / Med / Q₃ / maxX", `${fmt(o.min)} / ${fmt(o.q1)} / ${fmt(o.median)} / ${fmt(o.q3)} / ${fmt(o.max)}`], ["IQR", fmt(o.iqr)],
        ["Outlier fences", `${fmt(o.lowFence)} and ${fmt(o.highFence)}`], ["Outliers (1.5 × IQR)", outliers.length ? outliers.map((x) => fmt(x)).join(", ") : "none"]],
        ["Quartiles: Q₁ and Q₃ are the medians of the lower and upper halves; the median is left out of both halves when n is odd (TI-84 method). Other software can differ slightly."]); }) },
  { id: "twovar", group: "Data", label: "2-Var Stats and linear regression", help: "Lists must have the same length (at least 3 points).", fields: [{ key: "x", label: "x list (explanatory)", kind: "list" }, { key: "y", label: "y list (response)", kind: "list" }],
    run: safe((v) => { const r = twoVar(list(v.x, "x list"), list(v.y, "y list")); if (!r.ok) return r; const t = r.value;
      return ok("2-Var Stats / LinReg", [["n", String(t.n)], ["x̄, ȳ", `${fmt(t.xbar)},  ${fmt(t.ybar)}`], ["sₓ, s_y", `${fmt(t.sx)},  ${fmt(t.sy)}`], ["Regression line", `ŷ = ${fmt(t.intercept)} ${t.slope < 0 ? "−" : "+"} ${fmt(Math.abs(t.slope))}·x`], ["slope b", fmt(t.slope)], ["intercept a", fmt(t.intercept)], ["r", fmt(t.r)], ["r²", fmt(t.r2)],
        ["s (SD of residuals)", fmt(t.s)], ["SE of slope", fmt(t.seSlope)], ["SE of intercept", fmt(t.seIntercept)], ["t for slope (H₀: β = 0)", fmt(t.tSlope)], ["df", String(t.df)], ["p-value (two-sided)", fmt(t.pSlopeTwoSided)]],
        ["Least-squares line ŷ = a + bx. The slope t and its SE are computer-output style values; slope inference is not part of the 2027 AP Statistics course."]); }) },

  { id: "z1", group: "Tests and intervals", label: "1-sample z — mean (σ known)", fields: [num("xbar", "Sample mean x̄"), num("sigma", "Population SD σ"), num("n", "Sample size n"), num("mu0", "Null value μ₀"), ALT_FIELD, CONF_FIELD], outside2027: true,
    run: safe((v) => I.meanOneSample({ kind: "z", xbar: parseNum(v.xbar, "x̄"), sigma: positive(v.sigma, "σ"), n: int(v.n, "n", 1), mu0: parseNum(v.mu0, "μ₀"), alt: alt(v), conf: prob(v.conf, "Confidence level", true) })) },
  { id: "t1", group: "Tests and intervals", label: "1-sample t — mean", help: "For paired data, enter the mean and SD of the differences.", fields: [num("xbar", "Sample mean x̄"), num("s", "Sample SD s"), num("n", "Sample size n"), num("mu0", "Null value μ₀"), ALT_FIELD, CONF_FIELD],
    run: safe((v) => I.meanOneSample({ kind: "t", xbar: parseNum(v.xbar, "x̄"), s: positive(v.s, "s"), n: int(v.n, "n", 2), mu0: parseNum(v.mu0, "μ₀"), alt: alt(v), conf: prob(v.conf, "Confidence level", true) })) },
  { id: "z2", group: "Tests and intervals", label: "2-sample z — means (σ known)", outside2027: true, fields: [num("x1", "x̄₁"), num("sigma1", "σ₁"), num("n1", "n₁"), num("x2", "x̄₂"), num("sigma2", "σ₂"), num("n2", "n₂"), num("d0", "Null difference μ₁ − μ₂", "0"), ALT_FIELD, CONF_FIELD],
    run: safe((v) => I.meanTwoSample({ kind: "z", x1: parseNum(v.x1, "x̄₁"), sigma1: positive(v.sigma1, "σ₁"), n1: int(v.n1, "n₁", 2), x2: parseNum(v.x2, "x̄₂"), sigma2: positive(v.sigma2, "σ₂"), n2: int(v.n2, "n₂", 2), d0: parseNum(v.d0, "Null difference"), alt: alt(v), conf: prob(v.conf, "Confidence level", true) })) },
  { id: "t2", group: "Tests and intervals", label: "2-sample t — means", fields: [num("x1", "x̄₁"), num("s1", "s₁"), num("n1", "n₁"), num("x2", "x̄₂"), num("s2", "s₂"), num("n2", "n₂"), num("d0", "Null difference μ₁ − μ₂", "0"), ALT_FIELD, CONF_FIELD,
    { key: "pooled", label: "Pooled variance?", kind: "select", def: "no", hint: "No (unpooled / Welch) is the usual choice and the AP default.", options: [{ value: "no", label: "No — unpooled (Welch)" }, { value: "yes", label: "Yes — pooled" }] }],
    run: safe((v) => I.meanTwoSample({ kind: "t", x1: parseNum(v.x1, "x̄₁"), s1: positive(v.s1, "s₁"), n1: int(v.n1, "n₁", 2), x2: parseNum(v.x2, "x̄₂"), s2: positive(v.s2, "s₂"), n2: int(v.n2, "n₂", 2), d0: parseNum(v.d0, "Null difference"), alt: alt(v), conf: prob(v.conf, "Confidence level", true), pooled: v.pooled === "yes" })) },
  { id: "p1", group: "Tests and intervals", label: "1-proportion z", fields: [num("x", "Successes x"), num("n", "Sample size n"), num("p0", "Null proportion p₀"), ALT_FIELD, CONF_FIELD],
    run: safe((v) => I.propOneSample({ x: int(v.x, "x"), n: int(v.n, "n", 1), p0: parseNum(v.p0, "p₀"), alt: alt(v), conf: prob(v.conf, "Confidence level", true) })) },
  { id: "p2", group: "Tests and intervals", label: "2-proportion z", fields: [num("x1", "Successes x₁"), num("n1", "n₁"), num("x2", "Successes x₂"), num("n2", "n₂"), ALT_FIELD, CONF_FIELD],
    run: safe((v) => I.propTwoSample({ x1: int(v.x1, "x₁"), n1: int(v.n1, "n₁", 1), x2: int(v.x2, "x₂"), n2: int(v.n2, "n₂", 1), alt: alt(v), conf: prob(v.conf, "Confidence level", true) })) },
  { id: "chi-ind", group: "Tests and intervals", label: "χ² test — independence / homogeneity", help: "One row of the table per line; separate counts with spaces or commas.", fields: [{ key: "m", label: "Observed counts (matrix)", kind: "matrix" }],
    run: safe((v) => I.chiSquareIndependence(matrix(v.m, "Matrix"))) },
  { id: "chi-gof", group: "Tests and intervals", label: "χ² goodness-of-fit", outside2027: true, fields: [{ key: "o", label: "Observed counts", kind: "list" }, { key: "e", label: "Expected values", kind: "list" },
    { key: "mode", label: "Expected values are", kind: "select", def: "proportions", options: [{ value: "proportions", label: "proportions (sum to 1)" }, { value: "counts", label: "counts (sum to the observed total)" }] }],
    run: safe((v) => I.chiSquareGof(list(v.o, "Observed"), list(v.e, "Expected"), v.mode === "counts" ? "counts" : "proportions")) },
  { id: "slope-lists", group: "Tests and intervals", label: "Regression slope t — from lists", outside2027: true, fields: [{ key: "x", label: "x list", kind: "list" }, { key: "y", label: "y list", kind: "list" }, num("beta0", "Null slope β₀", "0"), ALT_FIELD, CONF_FIELD],
    run: safe((v) => { const r = twoVar(list(v.x, "x list"), list(v.y, "y list")); if (!r.ok) return r; return I.slopeInference({ b: r.value.slope, se: r.value.seSlope, n: r.value.n, beta0: parseNum(v.beta0, "β₀"), alt: alt(v), conf: prob(v.conf, "Confidence level", true) }); }) },
  { id: "slope-summary", group: "Tests and intervals", label: "Regression slope t — from output", outside2027: true, fields: [num("b", "Slope b"), num("se", "SE of slope"), num("n", "Sample size n"), num("beta0", "Null slope β₀", "0"), ALT_FIELD, CONF_FIELD],
    run: safe((v) => I.slopeInference({ b: parseNum(v.b, "b"), se: positive(v.se, "SE"), n: int(v.n, "n", 3), beta0: parseNum(v.beta0, "β₀"), alt: alt(v), conf: prob(v.conf, "Confidence level", true) })) },
];

/** 결과를 클립보드용 일반 텍스트로 바꾼다. */
export function resultToText(r: Extract<InferResult, { ok: true }>): string {
  const lines = [r.title, ...r.rows.map(([k, val]) => `${k}: ${val}`)];
  for (const t of r.tables) lines.push("", t.title, ...t.rows.map((row) => row.join("\t")));
  if (r.notes.length) lines.push("", ...r.notes.map((n) => `Note: ${n}`));
  return lines.join("\n");
}
