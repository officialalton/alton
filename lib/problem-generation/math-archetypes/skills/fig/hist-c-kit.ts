// 히스토그램 선택지형(HG.C) 공용 장면 — 네 히스토그램은 같은 구간(같은 가로 눈금)과 같은 가장 높은 막대(같은 세로 눈금·크기)를 쓴다.
import { GenFail } from "../../types";
import type { Rng } from "../../rng";
import { HG_TOPICS, histFig, type GTopic } from "./hist-kit";

export type HSc = { t: GTopic; los: number[]; M: number; zeros: boolean };
/** zeros: 양 끝 구간의 도수가 0 일 수 있다(범위 문항). */
export function hScene(rng: Rng, zeros = false): HSc { const t = rng.pick(HG_TOPICS); const k = rng.int(5, 6); const s0 = rng.pick(t.starts); return { t, los: Array.from({ length: k }, (_, i) => s0 + t.w * i), M: rng.int(5, 9), zeros }; }
export function hVec(rng: Rng, s: HSc): number[] {
  const k = s.los.length; for (let tr = 0; tr < 50; tr++) {
    const f = s.los.map(() => rng.int(s.zeros ? 0 : 1, s.M)); f[rng.int(0, k - 1)] = s.M; const nz = f.map((c, i) => (c > 0 ? i : -1)).filter((i) => i >= 0);
    if (!s.zeros || nz.length >= 3) return f;
  }
  throw new GenFail("히스토그램 도수 표집 실패");
}
export const hFig = (s: HSc, f: number[]) => histFig(s.t, s.los, f);
export const hPool = (rng: Rng, s: HSc, n = 1500) => Array.from({ length: n }, () => hFig(s, hVec(rng, s)));
/** FIGURE(히스토그램)에서 개수 N·중앙값 구간 하한 medLo(모호하면 null)·최빈 구간 하한 mode(유일할 때)·점유 구간 하한 lo·상한 hi·범위 gp·첫 구간 도수 f0·x 미만 개수 below(x) 를 읽는 stats 본문. */
export const H_STATS = "const B=c.bins; const fr=B.map(b=>b.count), L=B.map(b=>b.from); const N=fr.reduce((a,b)=>a+b,0); const at=(p)=>{let q=0;for(let i=0;i<fr.length;i++){q+=fr[i];if(p<=q)return i;}return -1;}; let mi=null; if(N%2) mi=at((N+1)/2); else {const a=at(N/2),b=at(N/2+1); mi=a===b?a:null;} const mx=Math.max(...fr); const tops=L.filter((x,i)=>fr[i]===mx); const occ=B.filter(b=>b.count>0); const lo=Math.min(...occ.map(b=>b.from)), hi=Math.max(...occ.map(b=>b.to)); return {N,medLo:mi===null?null:L[mi],mode:tops.length===1?tops[0]:null,lo,hi,gp:hi-lo,f0:fr[0],below:(x)=>B.filter(b=>b.to<=x).reduce((a,b)=>a+b.count,0)};";
export const hStat = (s: HSc, f: number[]) => { const N = f.reduce((a, b) => a + b, 0); const at = (p: number) => { let q = 0; for (let i = 0; i < f.length; i++) { q += f[i]; if (p <= q) return i; } return -1; }; let mi: number | null; if (N % 2) mi = at((N + 1) / 2); else { const a = at(N / 2), b = at(N / 2 + 1); mi = a === b ? a : null; } const mx = Math.max(...f); const tops = s.los.filter((_, i) => f[i] === mx); const occ = s.los.map((x, i) => (f[i] > 0 ? i : -1)).filter((i) => i >= 0); const lo = s.los[occ[0]], hi = s.los[occ[occ.length - 1]] + s.t.w;
  return { N, medLo: mi === null ? null : s.los[mi], mode: tops.length === 1 ? tops[0] : null, lo, hi, gp: hi - lo, f0: f[0], below: (x: number) => s.los.reduce((a, l, i) => a + (l + s.t.w <= x ? f[i] : 0), 0) }; };
export const hIntro = (s: HSc, rng: Rng) => rng.pick([
  `Four histograms are shown for the ${s.t.what} of ${s.t.ent} ${s.t.where}. All use the same intervals, and each interval includes its left endpoint but not its right endpoint.`,
  `A data set records the ${s.t.what} for ${s.t.ent} ${s.t.where}. The four histograms shown use the same intervals; a value equal to an interval's right endpoint is counted in the next interval.`,
  `The ${s.t.what} of ${s.t.ent} ${s.t.where} is summarized in one of the four histograms shown, which share the same intervals. A value on the boundary between two bars is counted in the bar to its right.`,
  `Four possible histograms of the ${s.t.what} for ${s.t.ent} ${s.t.where} are shown. The intervals are the same in every histogram, and each includes its left endpoint only.`,
]);
export const hQ = ["Which of the following histograms could show these data?", "Which histogram is consistent with the information given?", "Which of the histograms shown matches this description?"];
export const hLabel = (s: HSc, lo: number) => `${lo}–${lo + s.t.w}`;
