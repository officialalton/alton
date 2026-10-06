// 점도표 두 개(figure_set) 장면 키트 — spread_comparison.DP 조합이 쓴다. 두 점도표는 같은 값 범위(가로 눈금)를 쓰고, 가장 높은 점 쌓임이 같아 그림 크기가 같다.
import { GenFail } from "../../types";
import type { Rng } from "../../rng";
import { DOT_TOPICS, dotFig } from "./data-kit";
import type { FqTopic } from "./table-kit";

export type Dot2 = { t: FqTopic; names: [string, string]; vals: number[]; freqs: [number[], number[]]; fig: { type: "figure_set"; figures: { id: string; title: string; spec: ReturnType<typeof dotFig> }[] } };
/** 두 집단의 점도표: 값 목록(연속 k 개)은 같고 집단마다 쓰는 구간 [a..b] 와 점 개수가 다르다(구간 밖은 점 0 개). 최대 점 개수 M 은 두 집단이 같다. */
export function makeDot2(rng: Rng, o: { /** 두 집단의 범위가 달라야 함 */ differ?: boolean } = {}): Dot2 {
  const t = rng.pick(DOT_TOPICS); const span = Math.floor((t.hi - t.lo) / t.step) + 1; const kMin = Math.max(7, Math.ceil(6 / t.step) + 1); const kMax = Math.min(span, 9, Math.floor(20 / t.step) + 1);
  if (kMin > kMax) throw new GenFail("점도표 값 범위"); const k = rng.int(kMin, kMax); const start = t.lo + t.step * rng.int(0, span - k); const vals = Array.from({ length: k }, (_, i) => start + t.step * i);
  const names: [string, string] = ["Sample A", "Sample B"]; const M = rng.int(4, 9);
  const mk = (): number[] | null => {
    const a = rng.int(0, k - 4), b = rng.int(a + 3, k - 1); const f = vals.map((_, i) => (i < a || i > b ? 0 : rng.int(1, M))); const top = rng.int(a, b); f[top] = M; return f;
  };
  for (let tr = 0; tr < 80; tr++) {
    const f0 = mk(), f1 = mk(); if (!f0 || !f1) continue; const rg = (f: number[]) => { const nz = f.map((c, i) => (c > 0 ? i : -1)).filter((i) => i >= 0); return nz[nz.length - 1] - nz[0]; };
    if (o.differ && rg(f0) === rg(f1)) continue;
    return { t, names, vals, freqs: [f0, f1], fig: { type: "figure_set", figures: [{ id: "A", title: names[0], spec: dotFig(t, vals, f0) }, { id: "B", title: names[1], spec: dotFig(t, vals, f1) }] } };
  }
  throw new GenFail("두 점도표 표집 실패");
}
/** FIGURE(figure_set)에서 집단별 점이 있는 값(D)·개수(C)·최솟값/최댓값/범위 함수를 읽는 JS. */
export const DOT2_JS = "const F=FIGURE.figures; if (!F||F.length!==2) throw new Error('점도표 둘 아님'); const D=F.map(f=>f.spec.dots.filter(d=>d.count>0)); if (D.some(d=>d.length<2)) throw new Error('점 부족'); const mn=(i)=>Math.min(...D[i].map(d=>d.value)), mx=(i)=>Math.max(...D[i].map(d=>d.value)), rg=(i)=>mx(i)-mn(i); const nm=F.map(f=>f.title);\n";
export const dot2Intro = (rng: Rng, s: Dot2) => rng.pick([
  `The dot plots shown give the ${s.t.what} for two samples of ${s.t.ent} ${s.t.where}: ${s.names[0]} and ${s.names[1]}. Each dot represents one of them.`,
  `Two dot plots are shown, one for ${s.names[0]} and one for ${s.names[1]}, summarizing the ${s.t.what} for ${s.t.ent} ${s.t.where}. Each dot stands for one of them.`,
  `The dot plots shown compare ${s.names[0]} and ${s.names[1]} using the ${s.t.what} for ${s.t.ent} ${s.t.where}; each dot is one of them.`,
]);
export const dot2Read = (s: Dot2): [string, string] => {
  const rg = (i: number) => { const nz = s.freqs[i].map((c, j) => (c > 0 ? j : -1)).filter((j) => j >= 0); return [s.vals[nz[0]], s.vals[nz[nz.length - 1]]]; };
  const [a0, a1] = rg(0), [b0, b1] = rg(1);
  return [`두 점도표에서 점이 있는 값을 읽는다: ${s.names[0]} ${a0}~${a1}, ${s.names[1]} ${b0}~${b1}.`, "Read the lowest and highest dots of each plot."];
};
