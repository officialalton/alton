/** 표시용 숫자 서식: 유효숫자 digits자리(기본 7), 아주 작은/큰 값은 지수 표기. */
export function fmt(x: number, digits = 7): string {
  if (Number.isNaN(x)) return "undefined";
  if (!Number.isFinite(x)) return x > 0 ? "∞" : "−∞";
  if (x === 0) return "0";
  const a = Math.abs(x);
  if (a < 1e-4 || a >= 1e10) return x.toExponential(digits - 1).replace(/\.?0+e/, "e");
  return String(Number(x.toPrecision(digits)));
}
