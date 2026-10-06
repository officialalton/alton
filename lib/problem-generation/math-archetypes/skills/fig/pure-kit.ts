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
    const cand: number[] = []; for (let x = -R; x <= R; x++) { const y = m * x + b; if (Math.abs(y) <= R) cand.push(x); }
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
