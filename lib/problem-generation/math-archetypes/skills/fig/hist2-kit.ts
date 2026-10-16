// 히스토그램 두 개(figure_set) 장면 키트 — spread_comparison.HG 조합이 쓴다. 두 히스토그램은 같은 구간·같은 세로 눈금을 쓰고, 가장 높은 막대 높이가 같아 그림 크기가 같다.
import { GenFail } from "../../types";
import type { Rng } from "../../rng";
import { HG_TOPICS, histFig, type GTopic } from "./hist-kit";

export type Hist2 = { t: GTopic; names: [string, string]; los: number[]; freqs: [number[], number[]]; fig: { type: "figure_set"; figures: { id: string; title: string; spec: ReturnType<typeof histFig> }[] } };
/** 두 집단: 같은 구간 k(6~7)개, 집단마다 쓰는 구간 [a..b] 만 높이가 있고 나머지는 0. 최대 높이 M 은 같다(세로 눈금·그림 크기 일치). */
export function makeHist2(rng: Rng, o: { differ?: boolean } = {}): Hist2 {
  const t = rng.pick(HG_TOPICS); const k = rng.int(6, 7); const s0 = rng.pick(t.starts); const los = Array.from({ length: k }, (_, i) => s0 + t.w * i); const names: [string, string] = ["Sample A", "Sample B"]; const M = rng.int(5, 10);
  const mk = (): number[] => { const a = rng.int(0, k - 3), b = rng.int(a + 2, k - 1); const f = los.map((_, i) => (i < a || i > b ? 0 : rng.int(1, M))); f[rng.int(a, b)] = M; return f; };
  const span = (f: number[]) => { const nz = f.map((c, i) => (c > 0 ? i : -1)).filter((i) => i >= 0); return [nz[0], nz[nz.length - 1]]; };
  for (let tr = 0; tr < 80; tr++) {
    const f0 = mk(), f1 = mk(); const [a0, b0] = span(f0), [a1, b1] = span(f1); if (o.differ && b0 - a0 === b1 - a1) continue;
    const mkFig = (f: number[]) => ({ ...histFig(t, los, f), yMax: M + 1 });
    return { t, names, los, freqs: [f0, f1], fig: { type: "figure_set", figures: [{ id: "A", title: names[0], spec: mkFig(f0) }, { id: "B", title: names[1], spec: mkFig(f1) }] } };
  }
  throw new GenFail("두 히스토그램 표집 실패");
}
/** FIGURE(figure_set)에서 집단별 높이가 있는 구간만 모아 가능한 가장 큰 범위 gp(i)·가장 낮은 경계 lo(i)·가장 높은 경계 hi(i)를 읽는 JS. */
export const HIST2_JS = "const F=FIGURE.figures; if (!F||F.length!==2) throw new Error('히스토그램 둘 아님'); const D=F.map(f=>f.spec.bins.filter(b=>b.count>0)); if (D.some(d=>d.length<2)) throw new Error('막대 부족'); const lo=(i)=>Math.min(...D[i].map(b=>b.from)), hi=(i)=>Math.max(...D[i].map(b=>b.to)), gp=(i)=>hi(i)-lo(i); const nm=F.map(f=>f.title);\n";
export const hist2Intro = (rng: Rng, s: Hist2) => rng.pick([
  `The histograms shown give the ${s.t.what} for two samples of ${s.t.ent} ${s.t.where}: ${s.names[0]} and ${s.names[1]}. Each interval includes its left endpoint but not its right endpoint.`,
  `Two histograms are shown, one for ${s.names[0]} and one for ${s.names[1]}, summarizing the ${s.t.what} for ${s.t.ent} ${s.t.where}. A value on the boundary between two intervals is counted in the interval to its right.`,
  `The histograms shown compare ${s.names[0]} and ${s.names[1]} using the ${s.t.what} for ${s.t.ent} ${s.t.where}. A value equal to an interval's right endpoint belongs to the next interval.`,
]);
export const hist2Read = (s: Hist2): [string, string] => {
  const ed = (i: number) => { const nz = s.freqs[i].map((c, j) => (c > 0 ? j : -1)).filter((j) => j >= 0); return [s.los[nz[0]], s.los[nz[nz.length - 1]] + s.t.w]; };
  const [a0, a1] = ed(0), [b0, b1] = ed(1);
  return [`두 히스토그램에서 높이가 있는 첫·마지막 막대의 경계를 읽는다: ${s.names[0]} ${a0}~${a1}, ${s.names[1]} ${b0}~${b1}.`, "Read the outer edges of the occupied bars."];
};
