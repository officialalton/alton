import { tUpperTail } from "./dist";

export type ParsedList = { ok: true; values: number[] } | { ok: false; error: string };

/** 쉼표·공백·줄바꿈·세미콜론으로 구분된 숫자 목록을 읽는다. 숫자가 아닌 토큰이 있으면 오류. */
export function parseList(text: string): ParsedList {
  const tokens = text.split(/[\s,;]+/).filter((t) => t !== "");
  if (tokens.length === 0) return { ok: false, error: "Enter at least one number." };
  const values: number[] = [];
  for (const t of tokens) {
    const v = Number(t);
    if (!Number.isFinite(v)) return { ok: false, error: `"${t}" is not a number.` };
    values.push(v);
  }
  return { ok: true, values };
}

const median = (s: number[]) => { const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };

export type OneVar = {
  n: number; sum: number; sumSq: number; mean: number; sx: number | null; sigma: number;
  min: number; q1: number; median: number; q3: number; max: number; iqr: number; lowFence: number; highFence: number;
};

/** 1변수 통계. 사분위수는 TI 방식: 중앙값으로 반을 나누고(n이 홀수면 중앙값 제외) 각 반의 중앙값. */
export function oneVar(values: number[]): OneVar {
  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const ss = values.reduce((a, b) => a + (b - mean) ** 2, 0);
  const lower = sorted.slice(0, Math.floor(n / 2));
  const upper = sorted.slice(Math.ceil(n / 2));
  const q1 = lower.length ? median(lower) : sorted[0];
  const q3 = upper.length ? median(upper) : sorted[n - 1];
  const iqr = q3 - q1;
  return {
    n, sum, sumSq: values.reduce((a, b) => a + b * b, 0), mean, sx: n > 1 ? Math.sqrt(ss / (n - 1)) : null, sigma: Math.sqrt(ss / n),
    min: sorted[0], q1, median: median(sorted), q3, max: sorted[n - 1], iqr, lowFence: q1 - 1.5 * iqr, highFence: q3 + 1.5 * iqr,
  };
}

export type TwoVar = {
  n: number; xbar: number; ybar: number; sx: number; sy: number; r: number; r2: number;
  slope: number; intercept: number; s: number; seSlope: number; seIntercept: number; df: number; tSlope: number; pSlopeTwoSided: number;
};

export type TwoVarResult = { ok: true; value: TwoVar } | { ok: false; error: string };

/** 2변수 통계·최소제곱 회귀 ŷ = a + b·x. 기울기 검정은 H0: β = 0, 양측. */
export function twoVar(xs: number[], ys: number[]): TwoVarResult {
  if (xs.length !== ys.length) return { ok: false, error: `The lists have different lengths (${xs.length} and ${ys.length}).` };
  const n = xs.length;
  if (n < 3) return { ok: false, error: "At least 3 points are needed." };
  const xbar = xs.reduce((a, b) => a + b, 0) / n; const ybar = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0; let syy = 0; let sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (xs[i] - xbar) ** 2; syy += (ys[i] - ybar) ** 2; sxy += (xs[i] - xbar) * (ys[i] - ybar); }
  if (sxx === 0) return { ok: false, error: "All x values are equal; the slope is undefined." };
  if (syy === 0) return { ok: false, error: "All y values are equal; the correlation is undefined." };
  const slope = sxy / sxx; const intercept = ybar - slope * xbar;
  const r = sxy / Math.sqrt(sxx * syy);
  const sse = Math.max(0, syy - slope * sxy);
  const df = n - 2; const s = Math.sqrt(sse / df);
  const seSlope = s / Math.sqrt(sxx); const seIntercept = s * Math.sqrt(1 / n + (xbar * xbar) / sxx);
  const tSlope = seSlope === 0 ? Infinity : slope / seSlope;
  return {
    ok: true,
    value: { n, xbar, ybar, sx: Math.sqrt(sxx / (n - 1)), sy: Math.sqrt(syy / (n - 1)), r, r2: r * r, slope, intercept, s, seSlope, seIntercept, df, tSlope, pSlopeTwoSided: 2 * tUpperTail(Math.abs(tSlope), df) },
  };
}
