import { chiSf, normCdf, normInv, tCdf, tInv } from "./dist";
import { fmt } from "./format";

export type Alt = "two" | "less" | "greater";
export type Row = [label: string, value: string];
export type ResultTable = { title: string; rows: string[][] };
export type InferResult =
  | { ok: true; title: string; rows: Row[]; tables: ResultTable[]; notes: string[]; raw: Record<string, number> }
  | { ok: false; error: string };

const ALT_TEXT: Record<Alt, string> = { two: "two-sided (≠)", less: "left-tailed (<)", greater: "right-tailed (>)" };
const ALT_SYM: Record<Alt, string> = { two: "≠", less: "<", greater: ">" };

const fail = (error: string): InferResult => ({ ok: false, error });
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const confOk = (c: number) => isNum(c) && c > 0 && c < 1;

/** 대칭 분포(z·t)의 p값. cdf는 P(T ≤ stat). */
function pValue(stat: number, alt: Alt, cdf: (x: number) => number): number {
  if (alt === "less") return cdf(stat);
  if (alt === "greater") return cdf(-stat);
  return Math.min(1, 2 * cdf(-Math.abs(stat)));
}

function build(title: string, rows: Row[], raw: Record<string, number>, notes: string[] = [], tables: ResultTable[] = []): InferResult {
  return { ok: true, title, rows, tables, notes, raw };
}

// ── 평균 ───────────────────────────────────────────────
export type Mean1 = { xbar: number; n: number; mu0: number; alt: Alt; conf: number } & ({ kind: "z"; sigma: number } | { kind: "t"; s: number });

export function meanOneSample(i: Mean1): InferResult {
  if (![i.xbar, i.n, i.mu0].every(isNum) || !Number.isInteger(i.n) || i.n < (i.kind === "t" ? 2 : 1)) return fail(`Enter x̄, μ₀ and a whole-number n (n ≥ ${i.kind === "t" ? 2 : 1}).`);
  if (!confOk(i.conf)) return fail("Confidence level must be between 0 and 1 (for example 0.95).");
  const sd = i.kind === "z" ? i.sigma : i.s;
  if (!isNum(sd) || sd <= 0) return fail(i.kind === "z" ? "σ must be a positive number." : "s must be a positive number.");
  const se = sd / Math.sqrt(i.n);
  const stat = (i.xbar - i.mu0) / se;
  const rows: Row[] = [["Hypotheses", `H₀: μ = ${fmt(i.mu0)}   Hₐ: μ ${ALT_SYM[i.alt]} ${fmt(i.mu0)}`]];
  const raw: Record<string, number> = { se, stat };
  if (i.kind === "z") {
    const p = pValue(stat, i.alt, (x) => normCdf(x));
    const zc = normInv(1 - (1 - i.conf) / 2);
    rows.push(["z", fmt(stat)], ["p-value", fmt(p)], ["SE = σ/√n", fmt(se)], [`${fmt(i.conf * 100)}% interval`, `(${fmt(i.xbar - zc * se)}, ${fmt(i.xbar + zc * se)})`], ["Critical value z*", fmt(zc)]);
    Object.assign(raw, { p, lower: i.xbar - zc * se, upper: i.xbar + zc * se, crit: zc });
    return build("1-sample z (mean)", rows, raw, [`Alternative: ${ALT_TEXT[i.alt]}. The interval is always two-sided.`, "Assumes σ is known."]);
  }
  const df = i.n - 1; const p = pValue(stat, i.alt, (x) => tCdf(x, df)); const tc = tInv(1 - (1 - i.conf) / 2, df);
  rows.push(["t", fmt(stat)], ["df", String(df)], ["p-value", fmt(p)], ["SE = s/√n", fmt(se)], [`${fmt(i.conf * 100)}% interval`, `(${fmt(i.xbar - tc * se)}, ${fmt(i.xbar + tc * se)})`], ["Critical value t*", fmt(tc)]);
  Object.assign(raw, { df, p, lower: i.xbar - tc * se, upper: i.xbar + tc * se, crit: tc });
  return build("1-sample t (mean)", rows, raw, [`Alternative: ${ALT_TEXT[i.alt]}. The interval is always two-sided.`, "For paired data, enter the mean and SD of the differences."]);
}

export type Mean2 = { x1: number; n1: number; x2: number; n2: number; d0: number; alt: Alt; conf: number } & (
  { kind: "z"; sigma1: number; sigma2: number } | { kind: "t"; s1: number; s2: number; pooled: boolean }
);

export function meanTwoSample(i: Mean2): InferResult {
  if (![i.x1, i.x2, i.n1, i.n2, i.d0].every(isNum) || !Number.isInteger(i.n1) || !Number.isInteger(i.n2) || i.n1 < 2 || i.n2 < 2) return fail("Enter both sample means, hypothesized difference, and whole-number sizes n₁, n₂ ≥ 2.");
  if (!confOk(i.conf)) return fail("Confidence level must be between 0 and 1 (for example 0.95).");
  const diff = i.x1 - i.x2;
  const label = "H₀: μ₁ − μ₂ = " + fmt(i.d0) + "   Hₐ: μ₁ − μ₂ " + ALT_SYM[i.alt] + " " + fmt(i.d0);
  if (i.kind === "z") {
    if (!(i.sigma1 > 0) || !(i.sigma2 > 0)) return fail("σ₁ and σ₂ must be positive numbers.");
    const se = Math.sqrt(i.sigma1 ** 2 / i.n1 + i.sigma2 ** 2 / i.n2); const z = (diff - i.d0) / se;
    const p = pValue(z, i.alt, (x) => normCdf(x)); const zc = normInv(1 - (1 - i.conf) / 2);
    return build("2-sample z (means)", [["Hypotheses", label], ["z", fmt(z)], ["p-value", fmt(p)], ["x̄₁ − x̄₂", fmt(diff)], ["SE", fmt(se)], [`${fmt(i.conf * 100)}% interval`, `(${fmt(diff - zc * se)}, ${fmt(diff + zc * se)})`]],
      { stat: z, p, se, lower: diff - zc * se, upper: diff + zc * se }, [`Alternative: ${ALT_TEXT[i.alt]}.`, "Assumes σ₁ and σ₂ are known."]);
  }
  if (!(i.s1 > 0) || !(i.s2 > 0)) return fail("s₁ and s₂ must be positive numbers.");
  let se: number; let df: number;
  const v1 = i.s1 ** 2 / i.n1; const v2 = i.s2 ** 2 / i.n2;
  if (i.pooled) {
    df = i.n1 + i.n2 - 2;
    const sp2 = ((i.n1 - 1) * i.s1 ** 2 + (i.n2 - 1) * i.s2 ** 2) / df;
    se = Math.sqrt(sp2 * (1 / i.n1 + 1 / i.n2));
  } else {
    se = Math.sqrt(v1 + v2);
    df = (v1 + v2) ** 2 / (v1 ** 2 / (i.n1 - 1) + v2 ** 2 / (i.n2 - 1));
  }
  const t = (diff - i.d0) / se; const p = pValue(t, i.alt, (x) => tCdf(x, df)); const tc = tInv(1 - (1 - i.conf) / 2, df);
  return build(i.pooled ? "2-sample t (pooled)" : "2-sample t (unpooled)", [["Hypotheses", label], ["t", fmt(t)], ["df", i.pooled ? String(df) : fmt(df)], ["p-value", fmt(p)], ["x̄₁ − x̄₂", fmt(diff)], ["SE", fmt(se)], [`${fmt(i.conf * 100)}% interval`, `(${fmt(diff - tc * se)}, ${fmt(diff + tc * se)})`], ["Critical value t*", fmt(tc)]],
    { stat: t, df, p, se, lower: diff - tc * se, upper: diff + tc * se, crit: tc },
    [`Alternative: ${ALT_TEXT[i.alt]}.`, i.pooled ? "Pooled: assumes equal population variances; df = n₁ + n₂ − 2." : "Unpooled (Welch): df uses the Welch–Satterthwaite formula, not rounded down."]);
}

// ── 비율 ───────────────────────────────────────────────
export type Prop1 = { x: number; n: number; p0: number; alt: Alt; conf: number };

export function propOneSample(i: Prop1): InferResult {
  if (![i.x, i.n, i.p0].every(isNum) || !Number.isInteger(i.n) || i.n < 1) return fail("Enter the number of successes x, a whole-number n, and p₀.");
  if (i.x < 0 || i.x > i.n) return fail("x must be between 0 and n.");
  if (!(i.p0 > 0 && i.p0 < 1)) return fail("p₀ must be strictly between 0 and 1.");
  if (!confOk(i.conf)) return fail("Confidence level must be between 0 and 1 (for example 0.95).");
  const phat = i.x / i.n; const seTest = Math.sqrt((i.p0 * (1 - i.p0)) / i.n); const z = (phat - i.p0) / seTest;
  const p = pValue(z, i.alt, (v) => normCdf(v));
  const seCI = Math.sqrt((phat * (1 - phat)) / i.n); const zc = normInv(1 - (1 - i.conf) / 2);
  const notes = [`Alternative: ${ALT_TEXT[i.alt]}.`, "The test statistic uses p₀ in the standard error; the interval uses p̂."];
  if (i.n * i.p0 < 10 || i.n * (1 - i.p0) < 10) notes.push("Large-counts condition fails: np₀ or n(1 − p₀) is below 10.");
  return build("1-proportion z", [["Hypotheses", `H₀: p = ${fmt(i.p0)}   Hₐ: p ${ALT_SYM[i.alt]} ${fmt(i.p0)}`], ["z", fmt(z)], ["p-value", fmt(p)], ["p̂", fmt(phat)], ["SE (test, uses p₀)", fmt(seTest)], ["SE (interval, uses p̂)", fmt(seCI)], [`${fmt(i.conf * 100)}% interval`, `(${fmt(phat - zc * seCI)}, ${fmt(phat + zc * seCI)})`], ["Critical value z*", fmt(zc)]],
    { phat, stat: z, p, lower: phat - zc * seCI, upper: phat + zc * seCI, crit: zc }, notes);
}

export type Prop2 = { x1: number; n1: number; x2: number; n2: number; alt: Alt; conf: number };

export function propTwoSample(i: Prop2): InferResult {
  if (![i.x1, i.n1, i.x2, i.n2].every(isNum) || !Number.isInteger(i.n1) || !Number.isInteger(i.n2) || i.n1 < 1 || i.n2 < 1) return fail("Enter successes x₁, x₂ and whole-number sizes n₁, n₂.");
  if (i.x1 < 0 || i.x1 > i.n1 || i.x2 < 0 || i.x2 > i.n2) return fail("Each x must be between 0 and its n.");
  if (!confOk(i.conf)) return fail("Confidence level must be between 0 and 1 (for example 0.95).");
  const p1 = i.x1 / i.n1; const p2 = i.x2 / i.n2; const pc = (i.x1 + i.x2) / (i.n1 + i.n2);
  const sePool = Math.sqrt(pc * (1 - pc) * (1 / i.n1 + 1 / i.n2));
  if (sePool === 0) return fail("The pooled proportion is 0 or 1, so the z statistic is undefined.");
  const z = (p1 - p2) / sePool; const p = pValue(z, i.alt, (v) => normCdf(v));
  const seCI = Math.sqrt((p1 * (1 - p1)) / i.n1 + (p2 * (1 - p2)) / i.n2); const zc = normInv(1 - (1 - i.conf) / 2); const d = p1 - p2;
  return build("2-proportion z", [["Hypotheses", `H₀: p₁ = p₂   Hₐ: p₁ ${ALT_SYM[i.alt]} p₂`], ["z", fmt(z)], ["p-value", fmt(p)], ["p̂₁", fmt(p1)], ["p̂₂", fmt(p2)], ["Pooled p̂", fmt(pc)], ["SE (test, pooled)", fmt(sePool)], ["SE (interval, unpooled)", fmt(seCI)], [`${fmt(i.conf * 100)}% interval for p₁ − p₂`, `(${fmt(d - zc * seCI)}, ${fmt(d + zc * seCI)})`]],
    { stat: z, p, pooled: pc, lower: d - zc * seCI, upper: d + zc * seCI, crit: zc },
    [`Alternative: ${ALT_TEXT[i.alt]}.`, "The test pools the two samples (H₀: p₁ = p₂); the interval does not pool."]);
}

// ── 카이제곱 ────────────────────────────────────────────
export function chiSquareGof(observed: number[], expected: number[], mode: "counts" | "proportions"): InferResult {
  if (observed.length < 2 || observed.length !== expected.length) return fail("Enter the same number (at least 2) of observed and expected values.");
  if (observed.some((v) => v < 0 || !Number.isInteger(v))) return fail("Observed counts must be non-negative whole numbers.");
  if (expected.some((v) => !(v > 0))) return fail("Expected values must be positive.");
  const N = observed.reduce((a, b) => a + b, 0);
  let exp = expected;
  if (mode === "proportions") {
    const s = expected.reduce((a, b) => a + b, 0);
    if (Math.abs(s - 1) > 1e-6) return fail(`Expected proportions must sum to 1 (they sum to ${fmt(s)}).`);
    exp = expected.map((e) => e * N);
  } else {
    const s = expected.reduce((a, b) => a + b, 0);
    if (Math.abs(s - N) > 1e-6 * Math.max(1, N)) return fail(`Expected counts must sum to the observed total ${fmt(N)} (they sum to ${fmt(s)}).`);
  }
  const contrib = observed.map((o, k) => (o - exp[k]) ** 2 / exp[k]);
  const chi = contrib.reduce((a, b) => a + b, 0); const df = observed.length - 1; const p = chiSf(chi, df);
  const notes = ["Goodness-of-fit test; right-tailed."];
  if (exp.some((e) => e < 5)) notes.push("Some expected counts are below 5; the chi-square approximation may be unreliable.");
  return build("Chi-square goodness-of-fit", [["χ²", fmt(chi)], ["df", String(df)], ["p-value", fmt(p)]], { stat: chi, df, p }, notes,
    [{ title: "Observed, expected, (O − E)²/E", rows: [["Category", "O", "E", "(O−E)²/E"], ...observed.map((o, k) => [String(k + 1), fmt(o), fmt(exp[k]), fmt(contrib[k])])] }]);
}

export function chiSquareIndependence(matrix: number[][]): InferResult {
  const r = matrix.length; const c = matrix[0]?.length ?? 0;
  if (r < 2 || c < 2) return fail("The table needs at least 2 rows and 2 columns.");
  if (matrix.some((row) => row.length !== c)) return fail("All rows must have the same number of columns.");
  if (matrix.some((row) => row.some((v) => !(v >= 0) || !Number.isInteger(v)))) return fail("Counts must be non-negative whole numbers.");
  const rowT = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  const colT = matrix[0].map((_, j) => matrix.reduce((a, row) => a + row[j], 0));
  const N = rowT.reduce((a, b) => a + b, 0);
  if (rowT.some((t) => t === 0) || colT.some((t) => t === 0)) return fail("A row or column total is 0; remove empty rows and columns.");
  const exp = matrix.map((_, i) => colT.map((ct) => (rowT[i] * ct) / N));
  let chi = 0; const contrib = matrix.map((row, i) => row.map((o, j) => { const t = (o - exp[i][j]) ** 2 / exp[i][j]; chi += t; return t; }));
  const df = (r - 1) * (c - 1); const p = chiSf(chi, df);
  const notes = ["Test of independence / homogeneity; right-tailed. E = (row total × column total) / grand total."];
  if (exp.some((row) => row.some((e) => e < 5))) notes.push("Some expected counts are below 5; the chi-square approximation may be unreliable.");
  const head = ["", ...colT.map((_, j) => `Col ${j + 1}`)];
  return build("Chi-square independence / homogeneity", [["χ²", fmt(chi)], ["df", String(df)], ["p-value", fmt(p)]], { stat: chi, df, p },
    notes, [
      { title: "Expected counts", rows: [head, ...exp.map((row, i) => [`Row ${i + 1}`, ...row.map((e) => fmt(e))])] },
      { title: "Contributions (O − E)²/E", rows: [head, ...contrib.map((row, i) => [`Row ${i + 1}`, ...row.map((e) => fmt(e))])] },
    ]);
}

// ── 회귀 기울기 ─────────────────────────────────────────
export type Slope = { b: number; se: number; n: number; beta0: number; alt: Alt; conf: number };

export function slopeInference(i: Slope): InferResult {
  if (![i.b, i.se, i.n, i.beta0].every(isNum) || !Number.isInteger(i.n) || i.n < 3) return fail("Enter the slope b, its standard error, β₀, and a whole-number n ≥ 3.");
  if (!(i.se > 0)) return fail("The standard error must be positive.");
  if (!confOk(i.conf)) return fail("Confidence level must be between 0 and 1 (for example 0.95).");
  const df = i.n - 2; const t = (i.b - i.beta0) / i.se; const p = pValue(t, i.alt, (x) => tCdf(x, df)); const tc = tInv(1 - (1 - i.conf) / 2, df);
  return build("Regression slope t", [["Hypotheses", `H₀: β = ${fmt(i.beta0)}   Hₐ: β ${ALT_SYM[i.alt]} ${fmt(i.beta0)}`], ["t", fmt(t)], ["df", String(df)], ["p-value", fmt(p)], ["b", fmt(i.b)], ["SE of b", fmt(i.se)], [`${fmt(i.conf * 100)}% interval for β`, `(${fmt(i.b - tc * i.se)}, ${fmt(i.b + tc * i.se)})`], ["Critical value t*", fmt(tc)]],
    { stat: t, df, p, lower: i.b - tc * i.se, upper: i.b + tc * i.se, crit: tc }, [`Alternative: ${ALT_TEXT[i.alt]}.`]);
}

