// 유리함수 순수 그래프(math-A 소유) — y = k + m / (x - h) (정수 h, k, m), 점근선은 렌더러가 점선으로 그린다. 축 제목 x·y.
import { GenFail } from "../../types";
import type { Rng } from "../../rng";
import type { PlaneFig } from "./graph-kit";
import { pureAxes } from "./pure-kit";
import { crossSafe, tickLabels } from "./pure-fn-kit";

export type RatX = { fn: string; h: number; k: number; m: number; a: number; b: number; xs: number[]; ys: number[]; R: number; fig: PlaneFig; f: (x: number) => number };
const DIV = [2, 3, 4, 6];
/** y = k + m/(x-h) = (k x + (m - k h)) / (x - h). 표시점은 정수점 세 개(두 가지 중 한쪽 가지에 2개 이하). */
export function makeRat(rng: Rng, fn: string, o: { branchOne?: boolean; mPool?: number[] } = {}): RatX {
  for (let tr = 0; tr < 2000; tr++) {
    const R = rng.pick([6, 8, 10]); const h = rng.nz(-(R - 3), R - 3); const k = rng.nz(-(R - 3), R - 3); const m = rng.pick(o.mPool ?? [-6, -4, -3, -2, 2, 3, 4, 6]);
    if (!crossSafe(h, R, true) || !crossSafe(k, R, true)) continue;
    const f = (x: number) => k + m / (x - h); const cand: number[] = [];
    for (let x = -(R - 1); x <= R - 1; x++) { if (x === h) continue; const y = f(x); if (Number.isInteger(y) && Math.abs(x) >= 2 && Math.abs(y) >= 2 && Math.abs(y) <= R - 1 && Math.abs(x - h) >= 1 && tickLabels(R).every((t) => Math.abs(Math.abs(x) - t) > 0 || Math.abs(y) >= 2)) cand.push(x); }
    const xs: number[] = []; for (const x of rng.shuffle(cand)) { if (xs.every((u) => f(u) !== f(x))) xs.push(x); if (xs.length === 3) break; }
    if (xs.length < 3) continue; if (o.branchOne ? !(xs.every((x) => x > h) || xs.every((x) => x < h)) : xs.every((x) => x > h) || xs.every((x) => x < h)) continue;
    xs.sort((p, q) => p - q); const ys = xs.map(f); const b = m - k * h;
    const fig = { type: "plane", axes: pureAxes(R), objects: [{ id: "F1", kind: "function", fn: "rational", params: [k, b, 1, -h] }, { id: "S1", kind: "scatter", points: xs.map((x, i) => [x, ys[i]] as [number, number]) }] } as unknown as PlaneFig;
    return { fn, h, k, m, a: k, b, xs, ys, R, fig, f };
  }
  throw new GenFail("유리함수 장면 표집 실패");
}
/** FIGURE 의 유리함수(k x + b)/(x - h) 와 표시점을 읽어 h, k, m, f 를 정의. 표시점이 곡선 위가 아니면 던진다. */
export const RAT_JS = "const RF=FIGURE.objects.find(o=>o.kind==='function'&&o.fn==='rational'); const RS=FIGURE.objects.find(o=>o.kind==='scatter'); const [pa,pb,pc,pd]=RF.params; if (Math.abs(pc-1)>1e-12) throw new Error('분모 x 계수 1 아님'); const h=-pd, k=pa, m=pb-pa*pd; const f=(x)=>k+m/(x-h); if (RS) for (const p of RS.points) if (Math.abs(f(p[0])-p[1])>1e-9) throw new Error('점이 곡선 위에 없음');\n";
export const ratRead = (r: RatX): [string, string][] => [
  [`그래프에 표시된 점을 읽는다: ${r.xs.map((x, i) => `(${x}, ${r.ys[i]})`).join(", ")}.`, "Read the marked points on the graph."],
  [`점선 점근선은 x = ${r.h}, y = ${r.k} 이므로 h = ${r.h}, k = ${r.k} 이다.`, "Read the dashed asymptotes: x = h and y = k."],
  [`표시점 하나를 y = k + m/(x - h) 에 대입하면 m = ${r.m} 이다.`, "Substitute a marked point to find m."],
];
export const ratIntro = (rng: Rng, fn: string) => rng.pick(["", "", "", "A student is studying a function in algebra class. ", "A teacher draws a rational curve on a grid. ", "A graphing program plots a function. ", "In a practice set, a function is shown as a graph. ", "A class explores graphs with asymptotes. ", "A designer sketches a curve with two guide lines. "]) + rng.pick([
  `The graph of the function $${fn}$ is shown in the $xy$-plane, with three points marked on it. The dashed lines are the asymptotes of the graph.`, `The figure shows the graph of $y = ${fn}(x)$ in the $xy$-plane, along with its dashed asymptotes and three marked points on the curve.`,
  `For the function $${fn}$, the graph shown has two dashed asymptotes. Three points on the curve are marked.`, `A rational function $${fn}$ is graphed in the $xy$-plane shown, with its asymptotes drawn as dashed lines and three points marked.`,
  `Three marked points lie on the graph of $y = ${fn}(x)$ shown in the $xy$-plane. The dashed lines are the asymptotes.`, `In the $xy$-plane shown, the curve is the graph of $${fn}$ and the dashed lines are its asymptotes. Three points on the curve are marked.`,
  `The graph of $y = ${fn}(x)$ is shown, with the two asymptotes drawn dashed and three points on the curve marked.`,
]);
