// 순수 함수 그래프(실생활 맥락 없음) 공용 장면 키트 — 축 제목은 'x' / 'y' (오너 승인 2026-10-05, G8 이 제목은 여전히 요구하되 단위 괄호는 면제).
// 직선: 세 격자점에 점(scatter)을 찍고 검은 직선(fitLine)을 그린다 — 점은 항상 직선 위, 값은 정수.
import { GenFail } from "../../types";
import type { Rng } from "../../rng";
import type { PlaneFig } from "./graph-kit";

export { GL_JS } from "./graph-kit";
export type PureLine = { m: number; b: number; xs: number[]; ys: number[]; d: number; R: number; fig: PlaneFig };
export type PureOpts = { ms?: number[]; /** y 절편이 격자 위(점 중 하나가 x=0) */ x0?: boolean; bNonZero?: boolean };
export const pureAxes = (R: number) => { const step = R > 8 ? 2 : 1; return { x: { min: -R, max: R, step, title: "x" }, y: { min: -R, max: R, step, title: "y" } }; };
/** y = m x + b (정수), 그림 범위 [-R, R]² 안의 격자점 세 개에 점. */
export function makePureLine(rng: Rng, o: PureOpts = {}): PureLine {
  for (let tr = 0; tr < 500; tr++) {
    const R = rng.pick([6, 8, 10]); const m = rng.pick(o.ms ?? [-4, -3, -2, -1, 1, 2, 3, 4]); const b = rng.int(-(R - 1), R - 1); if (b === 0) continue;
    const cand: number[] = []; for (let x = -R; x <= R; x++) { const y = m * x + b; if (Math.abs(y) <= R && !(Math.abs(x) <= 1 && Math.abs(y) <= 1)) cand.push(x); }
    if (o.x0 && !cand.includes(0)) continue; const pool = o.x0 ? cand.filter((x) => x !== 0) : cand;
    if (pool.length < (o.x0 ? 2 : 3)) continue;
    const pick = (o.x0 ? [0, ...rng.shuffle(pool).slice(0, 2)] : rng.shuffle(pool).slice(0, 3)).sort((p, q) => p - q);
    const xs = pick, ys = xs.map((x) => m * x + b);
    if (new Set(xs).size < 3) continue; const d = xs[1] - xs[0];
    return { m, b, xs, ys, d, R, fig: { type: "plane", axes: pureAxes(R), objects: [{ id: "S1", kind: "scatter", points: xs.map((x, i) => [x, ys[i]] as [number, number]), fitLine: { slope: m, intercept: b } }] } as unknown as PlaneFig };
  }
  throw new GenFail("순수 직선 장면 표집 실패");
}
export const pureIntro = (rng: Rng) => rng.pick([
  "The graph of a line is shown in the $xy$-plane.", "A line is graphed in the $xy$-plane shown.", "The line shown in the $xy$-plane passes through the marked points.",
  "In the $xy$-plane, the graph of a line is shown.", "The figure shows a line in the $xy$-plane, with three points marked on it.", "A line and three of its points are shown in the $xy$-plane.",
  "Consider the line graphed in the $xy$-plane shown.", "The graph shows a line in the $xy$-plane.", "A student graphs a line in the $xy$-plane, as shown.", "Three points on a line are marked in the $xy$-plane shown.",
]);
export const purRead = (s: PureLine): [string, string][] => [
  [`그래프에 표시된 두 점 (${s.xs[0]}, ${s.ys[0]}) 과 (${s.xs[1]}, ${s.ys[1]}) 을 읽는다.`, "Read two marked points on the graph."],
  [`기울기 = (${s.ys[1]} - (${s.ys[0]})) ÷ (${s.xs[1]} - (${s.xs[0]})) = ${s.m} 이다.`, "Compute the slope."],
];
export const purIntercept = (s: PureLine): [string, string] => [`y 절편 b = ${s.ys[0]} - (${s.m})(${s.xs[0]}) = ${s.b} 이다.`, "Find the y-intercept."];

// ───────── 이차함수 포물선 그래프(순수, 축 제목 x·y) ─────────
export type QuadG = { fn: string; A: number; B: number; C: number; H: number; K: number; xs: number[]; ys: number[]; R: number; fig: PlaneFig };
export type QuadGOpts = { aPool?: number[]; /** 표시점이 꼭짓점을 포함 */ vertex?: boolean; /** 같은 값의 대칭 쌍을 표시점에 포함(꼭짓점은 제외) */ pair?: boolean };
/** y = A(x - H)² + K, 정수 H·K·A. 그림 범위 [-R, R]² 안의 격자점 세 개를 점으로 찍는다(기본: 꼭짓점·대칭 쌍이 없어 식을 세워야 한다). 곡선이 먼저(검정), 점이 나중. */
export function makeQuadG(rng: Rng, fn: string, o: QuadGOpts = {}): QuadG {
  for (let tr = 0; tr < 800; tr++) {
    const R = rng.pick([6, 8, 10]); const A = rng.pick(o.aPool ?? [-2, -1, 1, 2]); const H = rng.int(-3, 3); const K = A > 0 ? rng.int(-(R - 3), 0) : rng.int(0, R - 3);
    if (A > 0 && Math.abs(H + Math.sqrt((R - K) / A)) < 2.5) continue; // 곡선 오른쪽 끝이 위 가장자리를 y 축 근처에서 벗어나면 곡선 라벨이 y 축 제목과 겹친다
    const B = -2 * A * H, C = A * H * H + K; const y = (x: number) => A * x * x + B * x + C;
    const cand: number[] = []; for (let x = -R; x <= R; x++) if (Math.abs(y(x)) <= R && !(Math.abs(x) <= 1 && Math.abs(y(x)) <= 1)) cand.push(x); // 원점 라벨 O 와 겹치는 점 제외
    let xs: number[];
    if (o.vertex && Math.abs(H) <= 1 && Math.abs(K) <= 1) continue;
    if (o.vertex) { const others = rng.shuffle(cand.filter((x) => x !== H)).slice(0, 2); xs = [H, ...others]; }
    else if (o.pair) { const ds = [1, 2, 3].filter((d) => cand.includes(H - d) && cand.includes(H + d)); if (!ds.length) continue; const d = rng.pick(ds); const rest = cand.filter((x) => x !== H && Math.abs(x - H) !== d); if (!rest.length) continue; xs = [H - d, H + d, rng.pick(rest)]; }
    else { const pool = rng.shuffle(cand.filter((x) => x !== H)); xs = []; for (const x of pool) { if (xs.every((u) => y(u) !== y(x))) xs.push(x); if (xs.length === 3) break; } if (xs.length < 3) continue; }
    if (new Set(xs).size < 3) continue; xs.sort((p, q) => p - q); const ys = xs.map(y);
    if (cand.length < 4) continue;
    const fig = { type: "plane", axes: pureAxes(R), objects: [{ id: "F1", kind: "function", fn: "quadratic", params: [A, B, C], label: fn }, { id: "S1", kind: "scatter", points: xs.map((x, i) => [x, ys[i]] as [number, number]) }] } as unknown as PlaneFig;
    return { fn, A, B, C, H, K, xs, ys, R, fig };
  }
  throw new GenFail("포물선 장면 표집 실패");
}
/** FIGURE 에서 이차식 A, B, C, 꼭짓점 H, K 를 세우고 점이 곡선 위가 아니면 던진다. */
export const QUADG_JS = "const QF=FIGURE.objects.find(o=>o.kind==='function'&&o.fn==='quadratic'); const QS=FIGURE.objects.find(o=>o.kind==='scatter'); const A=QF.params[0],B=QF.params[1],C=QF.params[2]; if(!(Math.abs(A)>0)) throw new Error('A=0'); for (const p of QS.points) if (Math.abs(A*p[0]*p[0]+B*p[0]+C-p[1])>1e-9) throw new Error('점이 곡선 위에 없음'); const H=-B/(2*A), K=C-B*B/(4*A);\n";
export const quadGRead = (q: QuadG): [string, string][] => [
  [`그래프에 표시된 점을 읽는다: ${q.xs.map((x, i) => `(${x}, ${q.ys[i]})`).join(", ")}.`, "Read the marked points on the graph."],
  [`y = ax² + bx + c 에 세 점을 대입해 세 식을 만든다.`, "Substitute the three points."],
  [`연립해 풀면 a = ${q.A}, b = ${q.B}, c = ${q.C} 이다.`, "Solve for a, b, and c."],
  [`식: y = ${q.A}x² ${q.B < 0 ? "-" : "+"} ${Math.abs(q.B)}x ${q.C < 0 ? "-" : "+"} ${Math.abs(q.C)} 이다.`, "The equation of the parabola."],
];
export const quadGIntro = (rng: Rng, fn: string) => rng.pick(["", "", "A student is studying a function in algebra class. ", "A teacher draws a parabola on a grid. ", "A graphing program plots a function. ", "In a practice set, a function is shown as a graph. "]) + rng.pick([
  `The graph of the quadratic function $${fn}$ is shown in the $xy$-plane, with three points marked on it.`,
  `The figure shows the graph of $y = ${fn}(x)$, a parabola in the $xy$-plane, and three marked points on it.`,
  `For the quadratic function $${fn}$, the graph shown gives selected points $(x, ${fn}(x))$.`,
  `The parabola shown is the graph of the quadratic function $${fn}$ in the $xy$-plane. Three points on it are marked.`,
  `A quadratic function $${fn}$ is graphed in the $xy$-plane shown. Points on the graph are marked.`,
  `Three marked points lie on the graph of $y = ${fn}(x)$ shown in the $xy$-plane, where $${fn}$ is a quadratic function.`,
]);
