// 삼차 곡선 순수 그래프 키트(math-A 소유) — x 눈금은 1 단위, y 눈금은 5·10·20 단위로 독립 스케일(cubicAxes). 렌더러 변경 없음(축 spec 의 x·y 범위·간격이 이미 독립이다).
import { GenFail } from "../../types";
import type { Rng } from "../../rng";
import type { PlaneFig } from "./graph-kit";

/** [-X, X] × [-Y, Y], x 눈금 간격 1, y 눈금 간격 sy. 눈금 숫자는 x 는 3·6(…), y 는 (간격 × 건너뛰기) 배수에 찍힌다. */
export const cubicAxes = (X: number, Y: number, sy: number) => ({ x: { min: -X, max: X, step: 1, title: "x" }, y: { min: -Y, max: Y, step: sy, title: "y" } });
/** 허용되는 (Y, 눈금 간격): 눈금 숫자가 ±Y 안쪽 배수에 깔끔히 찍히는 조합. */
export const Y_SCALES: [number, number][] = [[20, 5], [30, 5], [40, 10], [60, 10], [80, 20], [100, 20]];
/** x 눈금 숫자는 ±3, ±6 에 찍힌다 — 영점·표시점·절편은 이 위치와 겹치지 않게 한다. */
const ROOT_POOL = (X: number) => { const out: number[] = []; for (let r = -(X - 1); r <= X - 1; r++) if (r !== 0 && Math.abs(r) !== 1 && Math.abs(r) !== 3 && Math.abs(r) !== 6) out.push(r); return out; };
export type Cub = { A: number; rs: [number, number, number]; X: number; Y: number; sy: number; ext: number; f: (x: number) => number; B: number; C: number; D: number };
const coefs = (A: number, rs: number[]) => { const s1 = rs[0] + rs[1] + rs[2], s2 = rs[0] * rs[1] + rs[0] * rs[2] + rs[1] * rs[2], s3 = rs[0] * rs[1] * rs[2]; return { B: -A * s1, C: A * s2, D: -A * s3 }; };
/** 극값의 절댓값 중 큰 것(영점 사이 두 극점). */
export const cubExt = (A: number, rs: number[]) => { const { B, C } = coefs(A, rs); const a = 3 * A, b = 2 * B, c = C; const d = b * b - 4 * a * c; if (d <= 0) return 0; const f = (x: number) => A * (x - rs[0]) * (x - rs[1]) * (x - rs[2]); return Math.max(...[(-b + Math.sqrt(d)) / (2 * a), (-b - Math.sqrt(d)) / (2 * a)].map((x) => Math.abs(f(x)))); };
export const cubFn = (A: number, rs: number[]) => (x: number) => A * (x - rs[0]) * (x - rs[1]) * (x - rs[2]);
/** 극값이 그림 안에 충분히 보이도록 (Y, sy) 를 고른다. */
export function pickScale(ext: number): [number, number] | null { for (const [Y, sy] of Y_SCALES) if (Y >= ext * 1.2 && ext >= Y * 0.3) return [Y, sy]; return null; }
export function cubicFig(X: number, Y: number, sy: number, A: number, rs: number[], pts: [number, number][] | null, label?: string): PlaneFig {
  const { B, C, D } = coefs(A, rs);
  const objects: Record<string, unknown>[] = [{ id: "F1", kind: "function", fn: "cubic", params: [A, B, C, D], ...(label ? { label } : {}) }];
  if (pts) objects.push({ id: "S1", kind: "scatter", points: pts });
  return { type: "plane", axes: cubicAxes(X, Y, sy), objects } as unknown as PlaneFig;
}
/** 정수근 세 개, A ∈ ±1·±2, 표시점은 근이 아닌 정수점 n 개. */
export function makeCub(rng: Rng, fn: string | undefined, o: { aPool?: number[]; nPts?: number; X?: number } = {}): Cub & { xs: number[]; ys: number[]; fig: PlaneFig } {
  for (let tr = 0; tr < 4000; tr++) {
    const X = o.X ?? rng.pick([6, 8]); const pool = ROOT_POOL(X); const A = rng.pick(o.aPool ?? [-2, -1, 1, 2]);
    const rs = rng.shuffle(pool).slice(0, 3).sort((p, q) => p - q) as [number, number, number]; if (rs.length < 3 || rs[1] - rs[0] < 2 || rs[2] - rs[1] < 2) continue;
    const ext = cubExt(A, rs); const sc = pickScale(ext); if (!sc) continue; const [Y, sy] = sc; const f = cubFn(A, rs);
    const y0 = f(0); if (Math.abs(y0) > Y * 0.95 || Math.abs(y0) < 0.12 * Y) continue; // y 절편이 그림 안에 있고 원점·눈금 숫자와 겹치지 않는 자리
    const cand: number[] = []; for (let x = -X + 1; x <= X - 1; x++) if (!rs.includes(x) && Math.abs(x) >= 2 && Math.abs(f(x)) <= Y * 0.9 && Math.abs(f(x)) >= (x % 3 === 0 ? 0.22 : 0.12) * Y) cand.push(x); // x 눈금 숫자(±3, ±6) 아래에 점이 겹치지 않게
    const n = o.nPts ?? 3; const xs: number[] = []; for (const x of rng.shuffle(cand)) { if (xs.every((u) => f(u) !== f(x))) xs.push(x); if (xs.length === n) break; } if (xs.length < n) continue; xs.sort((p, q) => p - q);
    const ys = xs.map(f); const { B, C, D } = coefs(A, rs);
    return { A, rs, X, Y, sy, ext, f, B, C, D, xs, ys, fig: cubicFig(X, Y, sy, A, rs, n > 0 ? xs.map((x, i) => [x, ys[i]] as [number, number]) : null, fn) };
  }
  throw new GenFail("삼차 장면 표집 실패");
}
export const CUB_JS = "const CF=FIGURE.objects.find(o=>o.kind==='function'&&o.fn==='cubic'); const CS=FIGURE.objects.find(o=>o.kind==='scatter'); const [A,B,C,D]=CF.params; if(!(Math.abs(A)>0)) throw new Error('A=0'); const f=(x)=>A*x*x*x+B*x*x+C*x+D; if (CS) for (const p of CS.points) if (Math.abs(f(p[0])-p[1])>1e-9) throw new Error('점이 곡선 위에 없음'); const rs=[]; for (let x=-30;x<=30;x++) if (Math.abs(f(x))<1e-9) rs.push(x); if (rs.length!==3) throw new Error('정수근 3개 아님'); const s1=rs[0]+rs[1]+rs[2], s2=rs[0]*rs[1]+rs[0]*rs[2]+rs[1]*rs[2], s3=rs[0]*rs[1]*rs[2];\n";
export const cubIntro = (rng: Rng, fn: string) => rng.pick(["", "", "A student is studying a polynomial in algebra class. ", "A teacher draws a cubic curve on a grid. ", "A graphing program plots a polynomial function. ", "In a practice set, a polynomial is shown as a graph. "]) + rng.pick([
  `The graph of the cubic polynomial function $${fn}$ is shown in the $xy$-plane, with three points marked on it.`, `The figure shows the graph of $y = ${fn}(x)$, a cubic curve in the $xy$-plane, and three marked points on it.`, `For the cubic polynomial $${fn}$, the graph shown gives selected points $(x, ${fn}(x))$.`,
  `A cubic function $${fn}$ is graphed in the $xy$-plane shown. Three points on the graph are marked.`, `Three marked points lie on the graph of $y = ${fn}(x)$ shown in the $xy$-plane, where $${fn}$ is a cubic polynomial.`,
]);
export const cubRead = (q: { rs: number[]; xs: number[]; ys: number[]; A: number }): [string, string][] => [
  [`곡선이 x 축과 만나는 눈금을 읽으면 영점은 x = ${q.rs[0]}, ${q.rs[1]}, ${q.rs[2]} 이다. (y 눈금은 x 눈금과 간격이 다르다.)`, "Read the zeros where the curve crosses the x-axis; note that the y-axis scale differs from the x-axis scale."],
  [`표시된 점 (${q.xs[0]}, ${q.ys[0]}) 을 f(x) = a(x - (${q.rs[0]}))(x - (${q.rs[1]}))(x - (${q.rs[2]})) 에 대입한다.`, "Substitute a marked point into the factored form."],
  [`a = ${q.A} 이다.`, "Solve for the leading coefficient."],
];
