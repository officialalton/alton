// 함수 모형 선택(일차·이차·지수) 순수 그래프 키트(math-A 소유) — 연속한 정수 x 세 점이 표시된 곡선, 1사분면 축(posAxes), 축 제목 x·y.
import { GenFail } from "../../types";
import type { Rng } from "../../rng";
import type { PlaneFig } from "./graph-kit";
import { posAxes } from "./pure-fn-kit";

export type MdlType = "linear" | "quadratic" | "exponential";
export type Mdl = { type: MdlType; fig: PlaneFig; xs: number[]; ys: number[]; X: number; Y: number; f: (x: number) => number; d: number; r: number; s: number };
const YN = [20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200];
/** 정수값 일차·이차·지수 곡선, 표시점은 연속한 정수 x 세 개(x ≥ 1). 곡선은 [0, X] 에서 y 범위 안. */
export function makeMdl(rng: Rng, type: MdlType = rng.pick(["linear", "quadratic", "exponential"] as MdlType[])): Mdl {
  for (let tr = 0; tr < 1500; tr++) {
    const X = rng.pick([6, 7, 8]); let params: number[]; let f: (x: number) => number; let fn: string;
    if (type === "linear") { const m = rng.pick([2, 3, 4, 5, 6, 8]); const b = rng.int(1, 12); fn = "linear"; params = [m, b]; f = (x) => m * x + b; }
    else if (type === "quadratic") { const A = rng.pick([1, 2, 3]); const B = rng.int(0, 4); const C = rng.int(1, 10); fn = "quadratic"; params = [A, B, C]; f = (x) => A * x * x + B * x + C; }
    else { const r = rng.pick([2, 3]); const a = rng.pick([1, 2, 3, 4, 5]); fn = "exponential"; params = [a, r, 0]; f = (x) => a * r ** x; }
    const vals = Array.from({ length: X + 1 }, (_, i) => f(i)); const top = Math.max(...vals); const Y = YN.find((v) => v >= top * 1.08); if (!Y || Y > 200 || top < Y * 0.5) continue;
    const s0 = rng.int(1, Math.max(1, X - 3)); const xs = [s0, s0 + 1, s0 + 2]; if (xs[2] > X - 1) continue; const ys = xs.map(f);
    if (ys.some((v) => v < Y * 0.05 || v > Y * 0.95) || new Set(ys).size < 3) continue; if (Y % 5 !== 0) continue;
    const d = ys[1] - ys[0], s = ys[2] - 2 * ys[1] + ys[0]; const r = ys[1] / ys[0];
    if (type !== "linear" && Math.abs(d - (ys[2] - ys[1])) < 1e-9) continue; // 이차·지수는 일정한 차가 아님
    if (type !== "exponential" && Math.abs(ys[1] / ys[0] - ys[2] / ys[1]) < 1e-6) continue; // 지수로도 읽히는 장면 제외
    const fig = { type: "plane", axes: posAxes(X, Y), objects: [{ id: "F1", kind: "function", fn, params }, { id: "S1", kind: "scatter", points: xs.map((x, i) => [x, ys[i]] as [number, number]) }] } as unknown as PlaneFig;
    return { type, fig, xs, ys, X, Y, f, d, r, s };
  }
  throw new GenFail("모형 장면 표집 실패");
}
/** FIGURE 의 곡선과 표시점을 읽어 type, ev(x), 표시점 y 를 정의한다. 점이 곡선 위가 아니면 던진다. */
export const MDL_JS = "const MF=FIGURE.objects.find(o=>o.kind==='function'); const MS=FIGURE.objects.find(o=>o.kind==='scatter'); const mp=MF.params; const ev=(x)=>MF.fn==='linear'?mp[0]*x+mp[1]:MF.fn==='quadratic'?mp[0]*x*x+mp[1]*x+mp[2]:mp[0]*Math.pow(mp[1],x)+mp[2]; if (!['linear','quadratic','exponential'].includes(MF.fn)) throw new Error('모형 곡선 아님'); for (const p of MS.points) if (Math.abs(ev(p[0])-p[1])>1e-9) throw new Error('점이 곡선 위에 없음'); const my=MS.points.map(p=>p[1]); const mx=MS.points.map(p=>p[0]);\n";
const CTX = ["", "", "", "A student is studying a trend in a science class. ", "A teacher plots a data trend on a grid. ", "A graphing program plots a function. ", "In a practice set, a function is shown as a graph. ", "A lab group graphs how a quantity changes. ", "An analyst sketches a trend for a report. ", "A club tracks a quantity and graphs it. ", "A class compares function types using a graph. "];
const BODY = [
  "The graph of a function is shown in the $xy$-plane, with three points marked on it. The $x$-values of the marked points are consecutive integers.", "The figure shows a curve in the $xy$-plane with three marked points. The marked points have consecutive integer $x$-values.",
  "In the $xy$-plane shown, three points on the graph of a function are marked, and their $x$-values are consecutive integers.", "A function is graphed in the $xy$-plane shown. Three points with consecutive integer $x$-values are marked on the graph.",
  "The graph shown models a quantity $y$ as a function of $x$. Three points whose $x$-values are consecutive integers are marked.", "The $xy$-plane shown contains the graph of a function. Three marked points on it have consecutive integer $x$-values.",
  "A function's graph is drawn in the $xy$-plane shown. Three points are marked, and their $x$-values are consecutive integers.", "The curve shown in the $xy$-plane is the graph of a function, and three points on it with consecutive integer $x$-values are marked.",
];
export const mdlIntro = (rng: Rng) => rng.pick(CTX) + rng.pick(BODY);
export const mdlRead = (m: Mdl): [string, string][] => [
  [`그래프에 표시된 점을 읽는다: ${m.xs.map((x, i) => `(${x}, ${m.ys[i]})`).join(", ")}.`, "Read the marked points."],
  [`연속한 값의 차는 ${m.ys[1] - m.ys[0]}, ${m.ys[2] - m.ys[1]} 이고 비는 ${(m.ys[1] / m.ys[0]).toFixed(2).replace(/\.?0+$/, "")}, ${(m.ys[2] / m.ys[1]).toFixed(2).replace(/\.?0+$/, "")} 이다.`, "Compare the differences and the ratios of consecutive values."],
  [m.type === "linear" ? "차가 일정하므로 일차함수이다." : m.type === "exponential" ? "비가 일정하므로 지수함수이다." : "차가 일정하게 늘어나므로 이차함수이다.", "Identify the type of function."],
];
