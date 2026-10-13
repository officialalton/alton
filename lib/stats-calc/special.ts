// 통계 계산기용 특수함수(외부 의존성 없음). 정확도 목표: 상대오차 1e-9 이하(골든 테스트로 검증).
const EPS = 1e-16;
const TINY = 1e-300;

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** ln Γ(x), x > 0 (Lanczos g=7). */
export function lgamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  const xx = x - 1;
  let a = LANCZOS[0];
  const t = xx + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (xx + i);
  return 0.5 * Math.log(2 * Math.PI) + (xx + 0.5) * Math.log(t) - t + Math.log(a);
}

/** 정규화된 하부 불완전 감마 P(a,x)와 상부 Q(a,x)를 함께 돌려준다. */
export function gammaPQ(a: number, x: number): [number, number] {
  if (x <= 0) return [0, 1];
  if (!Number.isFinite(x)) return [1, 0];
  const lg = a * Math.log(x) - x - lgamma(a);
  if (x < a + 1) {
    let ap = a; let sum = 1 / a; let del = sum;
    for (let n = 0; n < 10000; n++) { ap += 1; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * EPS) break; }
    const p = sum * Math.exp(lg);
    return [Math.min(1, p), Math.max(0, 1 - p)];
  }
  let b = x + 1 - a; let c = 1 / TINY; let d = 1 / b; let h = d;
  for (let i = 1; i < 10000; i++) {
    const an = -i * (i - a); b += 2;
    d = an * d + b; if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  const q = Math.exp(lg) * h;
  return [Math.max(0, 1 - q), Math.min(1, q)];
}

function betacf(a: number, b: number, x: number): number {
  const qab = a + b; const qap = a + 1; const qam = a - 1;
  let c = 1; let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d; let h = d;
  for (let m = 1; m < 10000; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** 정규화된 불완전 베타 I_x(a,b)와 보수 1-I를 함께 돌려준다(꼬리 정밀도 유지). */
export function betaIncPQ(a: number, b: number, x: number): [number, number] {
  if (x <= 0) return [0, 1];
  if (x >= 1) return [1, 0];
  const lbt = lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log1p(-x);
  const bt = Math.exp(lbt);
  if (x < (a + 1) / (a + b + 2)) { const p = (bt * betacf(a, b, x)) / a; return [p, 1 - p]; }
  const q = (bt * betacf(b, a, 1 - x)) / b; return [1 - q, q];
}
