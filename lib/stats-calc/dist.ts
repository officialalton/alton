import { betaIncPQ, gammaPQ, lgamma } from "./special";

/** 단조 증가 cdf의 역함수: 구간 확장 후 이분법(머신 정밀도까지). */
function invert(cdf: (x: number) => number, p: number, lo: number, hi: number): number {
  if (!(p > 0 && p < 1)) return p === 0 ? -Infinity : p === 1 ? Infinity : NaN;
  while (cdf(lo) > p) lo = lo < 0 ? lo * 2 : lo - 1;
  while (cdf(hi) < p) hi = hi > 0 ? hi * 2 : hi + 1;
  for (let i = 0; i < 400; i++) {
    const mid = (lo + hi) / 2;
    if (mid === lo || mid === hi) break;
    if (cdf(mid) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ── 정규 ───────────────────────────────────────────────
export const normPdf = (x: number, mu = 0, sd = 1) => Math.exp(-0.5 * ((x - mu) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));
/** P(X ≤ x). 꼬리는 상부 불완전 감마로 계산해 상대정밀도를 유지한다. */
export function normCdf(x: number, mu = 0, sd = 1): number {
  const z = (x - mu) / sd;
  if (z === Infinity) return 1;
  if (z === -Infinity) return 0;
  const half = 0.5 * gammaPQ(0.5, (z * z) / 2)[1];
  return z < 0 ? half : 1 - half;
}
export const normInv = (p: number, mu = 0, sd = 1) => mu + sd * (p === 0.5 ? 0 : invert((z) => normCdf(z), p, -1, 1));

// ── t ──────────────────────────────────────────────────
export function tCdf(t: number, df: number): number {
  if (t === Infinity) return 1;
  if (t === -Infinity) return 0;
  const tail = 0.5 * betaIncPQ(df / 2, 0.5, df / (df + t * t))[0];
  return t < 0 ? tail : 1 - tail;
}
export function tPdf(t: number, df: number): number {
  return Math.exp(lgamma((df + 1) / 2) - lgamma(df / 2) - 0.5 * Math.log(df * Math.PI) - ((df + 1) / 2) * Math.log1p((t * t) / df));
}
export const tInv = (p: number, df: number) => (p === 0.5 ? 0 : invert((t) => tCdf(t, df), p, -1, 1));
/** 한쪽 꼬리 확률 P(T ≥ |t|) — 큰 |t|에서도 상대정밀도 유지. */
export const tUpperTail = (t: number, df: number) => 0.5 * betaIncPQ(df / 2, 0.5, df / (df + t * t))[0];

// ── 카이제곱 ────────────────────────────────────────────
export const chiCdf = (x: number, df: number) => (x <= 0 ? 0 : gammaPQ(df / 2, x / 2)[0]);
export const chiSf = (x: number, df: number) => (x <= 0 ? 1 : gammaPQ(df / 2, x / 2)[1]);
export function chiPdf(x: number, df: number): number {
  if (x < 0) return 0;
  if (x === 0) return df === 2 ? 0.5 : df < 2 ? Infinity : 0;
  return Math.exp((df / 2 - 1) * Math.log(x) - x / 2 - (df / 2) * Math.LN2 - lgamma(df / 2));
}
export const chiInv = (p: number, df: number) => invert((x) => chiCdf(x, df), p, 0, df + 1);

// ── 이항 · 기하 ─────────────────────────────────────────
const lchoose = (n: number, k: number) => lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);
export function binomPdf(n: number, p: number, k: number): number {
  if (k < 0 || k > n || !Number.isInteger(k)) return 0;
  if (p === 0) return k === 0 ? 1 : 0;
  if (p === 1) return k === n ? 1 : 0;
  return Math.exp(lchoose(n, k) + k * Math.log(p) + (n - k) * Math.log1p(-p));
}
/** P(X ≤ k) */
export function binomCdf(n: number, p: number, k: number): number {
  k = Math.floor(k);
  if (k < 0) return 0;
  if (k >= n) return 1;
  if (p === 0) return 1;
  if (p === 1) return 0;
  return betaIncPQ(n - k, k + 1, 1 - p)[0];
}
/** 기하분포(첫 성공까지의 시행 수, k ≥ 1). */
export const geomPdf = (p: number, k: number) => (k < 1 || !Number.isInteger(k) ? 0 : p === 1 ? (k === 1 ? 1 : 0) : Math.exp((k - 1) * Math.log1p(-p)) * p);
export function geomCdf(p: number, k: number): number {
  k = Math.floor(k);
  if (k < 1) return 0;
  if (p === 1) return 1;
  return -Math.expm1(k * Math.log1p(-p));
}
