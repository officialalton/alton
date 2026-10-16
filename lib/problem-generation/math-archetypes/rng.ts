// 시드 재현 가능한 난수(mulberry32). 기존 컴파일러는 Math.random 을 쓰지만, 원형 생성기는 (원형 ID, 시드)만으로 같은 문항을 다시 만든다.
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
export type Rng = {
  next(): number;
  /** [lo, hi] 정수 */
  int(lo: number, hi: number): number;
  /** 0 을 제외한 [lo, hi] 정수 */
  nz(lo: number, hi: number): number;
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: readonly T[]): T[];
  chance(p: number): boolean;
};
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  return {
    next,
    int,
    nz(lo, hi) { let v = 0; let guard = 0; while (v === 0 && guard++ < 100) v = int(lo, hi); return v; },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    shuffle(arr) { const o = [...arr]; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; },
    chance(p) { return next() < p; },
  };
}
export const gcd = (a: number, b: number): number => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
