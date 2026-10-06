// 순수 함수 그래프(축 제목 x·y) — 이차 곡선 + 두 직선 장면 확장 키트(math-A 소유). pure-kit.ts 의 clearOfLabels·pureAxes 를 그대로 쓴다.
// 포물선: 곡선 + (선택) 표시점 세 개(검정). 표시점이 없으면 곡선이 격자 눈금을 지나는 점으로 읽는다.
import { GenFail } from "../../types";
import type { Rng } from "../../rng";
import type { PlaneFig } from "./graph-kit";
import { clearOfLabels, pureAxes } from "./pure-kit";
import { fmtNum } from "../../text";

export type QuadX = { fn: string; A: number; B: number; C: number; H: number; K: number; D: number; xs: number[]; ys: number[]; R: number; fig: PlaneFig; p?: number; q?: number };
export type QuadXOpts = { /** 표시점 개수(기본 3, 0이면 곡선만) */ nPts?: number; /** 표시점에 꼭짓점 포함 */ vertex?: boolean; /** 같은 높이 쌍 포함 */ pair?: boolean; /** 표시점은 y 값이 서로 다름(기본 true) */ distinctY?: boolean; /** 곡선 위에 직선 추가 객체 */ extra?: Record<string, unknown>[]; /** 축 절편의 라벨 겹침 검사를 생략(교점을 그림 밖에 둬야 하는 장면용) */ loose?: boolean; /** 표시점을 x ≥ 1, y ≥ 1 인 1사분면에서만 고름(상황 그래프) */ nonneg?: boolean };
/** 양의 정수 D 가 완전제곱이 아닌가. */
export const isIrr = (D: number) => D > 0 && Math.round(Math.sqrt(D)) ** 2 !== D;
/** 축 위의 교차점(x 절편·y 절편)이 원점 'O' 라벨이나 축 눈금 숫자(±R/2, ±R)와 겹치지 않는 자리인가. */
/** 눈금 숫자가 찍히는 값(그림 범위 R 에 따라: 6 → ±3, ±6 / 8·10 → ±4, ±8). */
export const tickLabels = (R: number) => (R === 10 ? [4, 8] : [3, 6]);
export const crossSafe = (v: number, R: number, lenient = false) => { const a = Math.abs(v); const m = lenient ? 0.35 : 0.45; return a >= 1.2 && tickLabels(R).every((t) => Math.abs(a - t) >= m) && Math.abs(a - R) >= m; };
/** 곡선·직선 f 가 원점 'O' 라벨, y 축 눈금 숫자(축 왼쪽), x 축 눈금 숫자(축 아래)와 겹치지 않는가. */
export const labelClear = (f: (x: number) => number, R: number) => {
  const L = tickLabels(R).flatMap((t) => [t, -t]);
  for (const x of [-1, -0.8, -0.5, -0.2, 0]) for (const l of L) if (Math.abs(f(x) - l) < 0.9) return false; // y 축 눈금 숫자
  for (const l of L) for (const dx of [-0.4, 0, 0.4]) if (Math.abs(f(l + dx) + 0.55) < 0.9) return false; // x 축 눈금 숫자
  for (const x of [-0.9, -0.7, -0.4, -0.1, 0.2, 0.4]) if (Math.abs(f(x) + 0.5) < 0.9) return false; // 원점 O
  return true;
};
const yq = (A: number, B: number, C: number) => (x: number) => A * x * x + B * x + C;

/** 정수 계수 A,B,C 의 포물선을 [-R,R]² 그림으로 만든다(표시점 규칙: 격자점·축/라벨/테두리와 한 칸 이상). 실패하면 null. */
export function quadFig(rng: Rng, fn: string, A: number, B: number, C: number, R: number, o: QuadXOpts = {}): QuadX | null {
  const y = yq(A, B, C); const H = -B / (2 * A), K = C - (B * B) / (4 * A);
  if (Math.abs(K) > R - 0.5 && !o.extra) return null; // 꼭짓점이 그림 안에 있어야 한다
  if (Math.abs(H) > R - 2) return null;
  { const dx = Math.sqrt(Math.max(0, ((A > 0 ? R : -R) - K) / A)); if (Math.abs(H + dx) < 2.5) return null; } // 곡선 오른쪽 끝이 그림 위·아래 끝을 벗어나는 자리가 y 축 눈금·제목 근처인 경우 제외(pure-kit 규칙의 아래로 열린 포물선 확장)
  if (!o.loose && !crossSafe(C, R, !!o.vertex)) return null; // y 절편이 원점·눈금 숫자와 겹침
  if (!o.loose && B * B - 4 * A * C >= 0) { const sq = Math.sqrt(B * B - 4 * A * C); if (!crossSafe((-B + sq) / (2 * A), R, !!o.vertex) || !crossSafe((-B - sq) / (2 * A), R, !!o.vertex)) return null; } // x 절편이 원점·눈금 숫자와 겹침
  const cand: number[] = []; for (let x = -R; x <= R; x++) if (o.nonneg ? (x >= 1 && x <= R - 1 && y(x) >= 1 && y(x) <= R - 1) : (Math.abs(y(x)) <= R && clearOfLabels(x, y(x), R))) cand.push(x);
  const n = o.nPts ?? 3; let xs: number[] = [];
  if (n > 0) {
    if (o.vertex) { if (!Number.isInteger(H) || !clearOfLabels(H, K, R)) return null; xs = [H, ...rng.shuffle(cand.filter((x) => x !== H)).slice(0, n - 1)]; }
    else if (o.pair) { const ds = [1, 2, 3].filter((d) => cand.includes(H - d) && cand.includes(H + d)); if (!ds.length || Math.abs(H) % 1 !== 0) return null; const d = rng.pick(ds); const rest = cand.filter((x) => x !== H && Math.abs(x - H) !== d); if (!rest.length) return null; xs = [H - d, H + d, rng.pick(rest)]; }
    else { const pool = rng.shuffle(cand.filter((x) => x !== H)); for (const x of pool) { if (xs.every((u) => y(u) !== y(x))) xs.push(x); if (xs.length === n) break; } if (xs.length < n) return null; }
    if (new Set(xs).size < n || cand.length < n + 1) return null; xs.sort((p, q) => p - q);
  }
  const ys = xs.map(y); const D = B * B - 4 * A * C;
  const objects: Record<string, unknown>[] = [{ id: "F1", kind: "function", fn: "quadratic", params: [A, B, C], label: fn }];
  if (n > 0) objects.push({ id: "S1", kind: "scatter", points: xs.map((x, i) => [x, ys[i]] as [number, number]) });
  if (o.extra) objects.push(...o.extra);
  return { fn, A, B, C, H, K, D, xs, ys, R, fig: { type: "plane", axes: pureAxes(R), objects } as unknown as PlaneFig };
}

/** 정수근 p < q 를 갖는 y = A(x - p)(x - q). 근 표시점은 찍지 않는다(근은 표시점이 아니라 식에서 구한다). */
export function makeQuadRoots(rng: Rng, fn: string, o: QuadXOpts & { aPool?: number[]; gap?: number[] } = {}): QuadX & { p: number; q: number } {
  for (let tr = 0; tr < 1500; tr++) {
    const R = rng.pick([6, 8, 10]); const A = rng.pick(o.aPool ?? [-2, -1, 1, 2]); const p = rng.int(-6, 3); const q = p + rng.pick(o.gap ?? [2, 3, 4, 5, 6]);
    const r = quadFig(rng, fn, A, -A * (p + q), A * p * q, R, o); if (!r) continue;
    return { ...r, p, q };
  }
  throw new GenFail("정수근 포물선 장면 표집 실패");
}
/** 임의 정수 계수(근이 정수가 아닐 수 있음): 꼭짓점 (H, K) 정수, A·(x-H)²+K. kSign: 위로 볼록이면 K<0(x 절편 2개), K>0(없음), 0(접함). */
export function makeQuadVertex(rng: Rng, fn: string, o: QuadXOpts & { aPool?: number[]; disc?: "pos" | "zero" | "neg" | "any"; /** 판별식이 완전제곱이 아님(무리수 근) */ irr?: boolean } = {}): QuadX {
  for (let tr = 0; tr < 1500; tr++) {
    const R = rng.pick([6, 8, 10]); const A = rng.pick(o.aPool ?? [-2, -1, 1, 2]); const H = rng.int(-3, 3);
    const kk = o.disc === "zero" ? 0 : o.disc === "neg" ? rng.int(1, R - 3) : o.disc === "pos" ? rng.int(1, R - 3) : rng.int(0, R - 3); const K = (o.disc === "neg" ? 1 : -1) * Math.sign(A) * kk * (o.disc === "any" ? (rng.chance(0.5) ? 1 : -1) : 1);
    const r = quadFig(rng, fn, A, -2 * A * H, A * H * H + K, R, o); if (!r) continue; if (o.irr && !isIrr(r.D)) continue; return r;
  }
  throw new GenFail("꼭짓점형 포물선 장면 표집 실패");
}
/** FIGURE 에서 이차 곡선(F1)·(있으면)표시점을 읽어 A,B,C,H,K,D 와 근(실근이면 lo,hi)을 정의. 표시점이 곡선 위가 아니면 던진다. */
export const QX_JS = "const QF=FIGURE.objects.find(o=>o.kind==='function'&&o.fn==='quadratic'); const QS=FIGURE.objects.find(o=>o.kind==='scatter'); const A=QF.params[0],B=QF.params[1],C=QF.params[2]; if(!(Math.abs(A)>0)) throw new Error('A=0'); if (QS) for (const p of QS.points) if (Math.abs(A*p[0]*p[0]+B*p[0]+C-p[1])>1e-9) throw new Error('점이 곡선 위에 없음'); const H=-B/(2*A), K=C-B*B/(4*A), D=B*B-4*A*C; const f=(x)=>A*x*x+B*x+C; const lo=D>=0?Math.min((-B+Math.sqrt(D))/(2*A),(-B-Math.sqrt(D))/(2*A)):NaN, hi=D>=0?Math.max((-B+Math.sqrt(D))/(2*A),(-B-Math.sqrt(D))/(2*A)):NaN;\n";
export const quadXRead = (q: QuadX): [string, string][] => q.xs.length === 3 ? [
  [`그래프에 표시된 점을 읽는다: ${q.xs.map((x, i) => `(${x}, ${q.ys[i]})`).join(", ")}.`, "Read the marked points on the graph."],
  [`y = ax² + bx + c 에 세 점을 대입해 세 식을 만든다.`, "Substitute the three points."],
  [`연립해 풀면 a = ${fmtNum(q.A)}, b = ${fmtNum(q.B)}, c = ${fmtNum(q.C)} 이다.`, "Solve for a, b, and c."],
  [`식: y = ${fmtNum(q.A)}x² ${q.B < 0 ? "-" : "+"} ${Math.abs(q.B)}x ${q.C < 0 ? "-" : "+"} ${Math.abs(q.C)} 이다.`, "The equation of the parabola."],
] : q.xs.length > 0 ? [
  [`그래프에 표시된 점을 읽는다: ${q.xs.map((x, i) => `(${x}, ${q.ys[i]})`).join(", ")}.`, "Read the marked points on the graph."],
  [`식: y = ${fmtNum(q.A)}x² ${q.B < 0 ? "-" : "+"} ${Math.abs(q.B)}x ${q.C < 0 ? "-" : "+"} ${Math.abs(q.C)} 이다.`, "Find the equation of the parabola."],
] : [[`그래프에서 곡선이 격자를 지나는 점을 읽어 식 y = ${fmtNum(q.A)}x² ${q.B < 0 ? "-" : "+"} ${Math.abs(q.B)}x ${q.C < 0 ? "-" : "+"} ${Math.abs(q.C)} 를 얻는다.`, "Read lattice points on the curve to find the equation."]];
const LEADS = ["", "", "A student is studying a function in algebra class. ", "A teacher draws a parabola on a grid. ", "A graphing program plots a function. ", "In a practice set, a function is shown as a graph. ", "During a lesson on quadratic functions, a class graphs a parabola. ", "A designer sketches a curve on graph paper. "];
export const quadRootsIntro = (rng: Rng, fn: string) => rng.pick(LEADS) + rng.pick([
  `The graph of the quadratic function $${fn}$ is shown in the $xy$-plane.`, `The figure shows the graph of $y = ${fn}(x)$, a parabola in the $xy$-plane.`, `The parabola shown is the graph of the quadratic function $${fn}$ in the $xy$-plane.`,
  `A quadratic function $${fn}$ is graphed in the $xy$-plane shown.`, `For the quadratic function $${fn}$, the graph of $y = ${fn}(x)$ is shown.`,
]);
export const quadMarkedIntro = (rng: Rng, fn: string) => rng.pick(LEADS) + rng.pick([
  `The graph of the quadratic function $${fn}$ is shown in the $xy$-plane, with three points marked on it.`, `The figure shows the graph of $y = ${fn}(x)$, a parabola in the $xy$-plane, and three marked points on it.`,
  `The parabola shown is the graph of the quadratic function $${fn}$ in the $xy$-plane. Three points on it are marked.`, `A quadratic function $${fn}$ is graphed in the $xy$-plane shown. Points on the graph are marked.`,
  `Three marked points lie on the graph of $y = ${fn}(x)$ shown in the $xy$-plane, where $${fn}$ is a quadratic function.`, `For the quadratic function $${fn}$, the graph shown gives selected points $(x, ${fn}(x))$.`, `In the $xy$-plane, the parabola shown is the graph of $y = ${fn}(x)$, and three points on it are marked.`,
]);

// ───────── 두 직선(연립) 순수 그래프(축 제목 x·y) ─────────
export type PureLines = { m1: number; b1: number; m2: number; b2: number; xs1: number[]; ys1: number[]; xs2: number[]; ys2: number[]; xi: number; yi: number; R: number; fig: PlaneFig };
const latticePts = (rng: Rng, R: number, m: number, b: number): number[] | null => {
  const cand: number[] = []; for (let x = -R; x <= R; x++) { const y = m * x + b; if (Math.abs(y) <= R && clearOfLabels(x, y, R)) cand.push(x); }
  if (cand.length < 3) return null; return rng.shuffle(cand).slice(0, 3).sort((p, q) => p - q);
};
/** 교점이 정수 (xi, yi) 인 두 직선(점은 찍지 않고 직선만 그린다 — 직선은 격자점 두 개를 지난다). inside 면 교점이 그림 안의 격자점, 아니면 x 가 그림 밖(|xi| > R). */
export function makePureLines(rng: Rng, o: { inside?: boolean; labels?: [string, string] } = {}): PureLines {
  for (let tr = 0; tr < 3000; tr++) {
    const R = rng.pick([6, 8, 10]); const m1 = rng.pick([-4, -3, -2, -1, 1, 2, 3, 4]); const m2 = rng.pick([-4, -3, -2, -1, 1, 2, 3, 4]); if (m1 === m2) continue;
    const b1 = rng.int(-(R - 2), R - 2), b2 = rng.int(-(R - 2), R - 2); if (!crossSafe(b1, R) || !crossSafe(b2, R) || b1 === b2) continue;
    if (!crossSafe(b1 / m1, R) || !crossSafe(b2 / m2, R) || !labelClear((x) => m1 * x + b1, R) || !labelClear((x) => m2 * x + b2, R)) continue;
    const xi = (b2 - b1) / (m1 - m2); if (!Number.isInteger(xi)) continue; const yi = m1 * xi + b1;
    if (o.inside ? !(clearOfLabels(xi, yi, R)) : !(Math.abs(xi) > R)) continue;
    const c1 = latticePts(rng, R, m1, b1), c2 = latticePts(rng, R, m2, b2); if (!c1 || !c2) continue;
    const xs1 = [c1[0], c1[2]], xs2 = [c2[0], c2[2]]; const ys1 = xs1.map((x) => m1 * x + b1), ys2 = xs2.map((x) => m2 * x + b2);
    const obj = (id: string, xs: number[], ys: number[], label?: string) => ({ id, kind: "line", through: [[xs[0], ys[0]], [xs[1], ys[1]]], ...(label ? { label } : {}) });
    return { m1, b1, m2, b2, xs1, ys1, xs2, ys2, xi, yi, R, fig: { type: "plane", axes: pureAxes(R), objects: [obj("A1", xs1, ys1, o.labels?.[0]), obj("B1", xs2, ys2, o.labels?.[1])] } as unknown as PlaneFig };
  }
  throw new GenFail("순수 두 직선 장면 표집 실패");
}
/** FIGURE 의 두 직선(line, through 두 점)을 읽어 m1,b1,m2,b2, 교점 xi,yi 를 정의한다. */
export const PL2_JS = "const Ls=FIGURE.objects.filter(o=>o.kind==='line'); if (Ls.length!==2) throw new Error('직선 2개 아님'); const fit=(L)=>{const p=L.through[0], q=L.through[1]; const m=(q[1]-p[1])/(q[0]-p[0]); return [m, p[1]-m*p[0]];}; const [m1,b1]=fit(Ls[0]), [m2,b2]=fit(Ls[1]); if (m1===m2) throw new Error('평행'); const xi=(b2-b1)/(m1-m2), yi=m1*xi+b1;\n";
export const pl2Read = (s: PureLines): [string, string][] => [
  [`첫 번째 직선이 지나는 격자점 (${s.xs1[0]}, ${s.ys1[0]}), (${s.xs1[1]}, ${s.ys1[1]}) 에서 기울기 ${s.m1}, y 절편 ${s.b1} 을 구한다.`, "Read the slope and intercept of the first line from two lattice points on it."],
  [`두 번째 직선이 지나는 격자점 (${s.xs2[0]}, ${s.ys2[0]}), (${s.xs2[1]}, ${s.ys2[1]}) 에서 기울기 ${s.m2}, y 절편 ${s.b2} 을 구한다.`, "Read the slope and intercept of the second line from two lattice points on it."],
  [`${s.m1}x + (${s.b1}) = ${s.m2}x + (${s.b2}) 로 놓고 연립한다.`, "Set the two expressions for y equal."],
];
export const pl2Intro = (rng: Rng) => rng.pick(["", "", "A student is studying a system of equations in algebra class. ", "A teacher graphs a system of two linear equations on a grid. ", "A graphing program plots two lines. ", "During a lesson on linear systems, a class graphs two lines. ", "An engineer compares two straight paths on a grid. ", "A designer sketches two straight edges on graph paper. "]) + rng.pick([
  "A system of two linear equations is represented by the two lines graphed in the $xy$-plane shown.", "Each of the two lines shown in the $xy$-plane is the graph of one equation in a system of two linear equations.", "The graphs of the two equations in a system of linear equations are shown in the $xy$-plane.", "The figure shows the graphs of the two linear equations in a system.",
  "In the $xy$-plane shown, the two lines are the graphs of the equations in a system of linear equations.", "Two lines, the graphs of a system of two linear equations, are shown in the $xy$-plane.",
  "The system of two linear equations is graphed in the $xy$-plane shown.",
]);

// ───────── 부등식(음영) 순수 그래프(축 제목 x·y) ─────────
export type PureIneq = { op: "<=" | "<" | ">=" | ">"; m: number; b: number; xs: number[]; ys: number[]; R: number; strict: boolean; above: boolean; fig: PlaneFig };
/** 경계선 y = m x + b(정수, 격자점 세 개 이상이 그림 안)와 음영 방향·경계(점선=엄격)를 가진 부등식 그림. 점은 찍지 않고 경계선이 지나는 격자점으로 읽는다. */
export function makePureIneq(rng: Rng, o: { ms?: number[]; op?: PureIneq["op"] } = {}): PureIneq {
  for (let tr = 0; tr < 3000; tr++) {
    const R = rng.pick([6, 8, 10]); const m = rng.pick(o.ms ?? [-4, -3, -2, -1, 1, 2, 3, 4]); const b = rng.int(-(R - 2), R - 2); if (!crossSafe(b, R) || !crossSafe(b / m, R) || !labelClear((x) => m * x + b, R)) continue;
    const cand: number[] = []; for (let x = -R; x <= R; x++) { const y = m * x + b; if (Math.abs(y) <= R && clearOfLabels(x, y, R)) cand.push(x); }
    if (cand.length < 3) continue; const xs = [cand[0], cand[cand.length - 1]]; const ys = xs.map((x) => m * x + b);
    const op = o.op ?? rng.pick(["<=", "<", ">=", ">"] as const); const strict = op === "<" || op === ">"; const above = op === ">=" || op === ">";
    return { op, m, b, xs, ys, R, strict, above, fig: { type: "plane", axes: pureAxes(R), objects: [{ id: "I1", kind: "inequality", op, slope: m, intercept: b }] } as unknown as PlaneFig };
  }
  throw new GenFail("순수 부등식 장면 표집 실패");
}
/** FIGURE 의 부등식 객체(I1)에서 op, m, b, strict(점선), above(위쪽 음영)를 읽는다. */
export const PI_JS = "const IQ=FIGURE.objects.find(o=>o.kind==='inequality'); if (!IQ) throw new Error('부등식 없음'); const m=IQ.slope, b=IQ.intercept, op=IQ.op, strict=(op==='<'||op==='>'), above=(op==='>'||op==='>=');\n";
export const piRead = (s: PureIneq): [string, string][] => [
  [`경계선이 지나는 격자점 (${s.xs[0]}, ${s.ys[0]}), (${s.xs[1]}, ${s.ys[1]}) 에서 기울기 ${s.m}, y 절편 ${s.b} 을 구한다.`, "Read the boundary line from two lattice points."],
  [`${s.strict ? "경계선이 점선이므로 경계 위의 점은 해가 아니다(<, >)" : "경계선이 실선이므로 경계 위의 점도 해이다(≤, ≥)"}.`, s.strict ? "A dashed boundary means the line itself is not included." : "A solid boundary means the line itself is included."],
  [`음영은 경계선의 ${s.above ? "위쪽" : "아래쪽"}이므로 y ${s.above ? "이상(>)" : "이하(<)"} 이다.`, `The shading is ${s.above ? "above" : "below"} the boundary line.`],
];
export const piIntro = (rng: Rng) => rng.pick(["", "", "A student is studying an inequality in algebra class. ", "A teacher graphs an inequality on a grid. ", "A graphing program shades part of a plane. ", "In a practice set, an inequality is given as a graph. ", "During a lesson on inequalities, a class draws a graph. ", "A designer sketches a boundary on graph paper and shades one side. "]) + rng.pick([
  "The graph of a linear inequality is shown in the $xy$-plane; the solutions are the points in the shaded area.", "In the $xy$-plane shown, the shaded area is the graph of a linear inequality.", "The graph shown is the solution set of a linear inequality, drawn as a shaded area of the $xy$-plane.",
  "A linear inequality is graphed in the $xy$-plane shown. The shaded area contains all of its solutions.", "The figure shows the solution set of a linear inequality as a shaded area of the $xy$-plane.", "The shaded area of the graph shown represents all $(x, y)$ that satisfy a linear inequality.",
  "Every solution of a linear inequality lies in the shaded area of the $xy$-plane graph shown.", "Consider the linear inequality whose solution set is the shaded area in the graph shown.", "A line divides the $xy$-plane shown; the shaded side, together with the boundary only if the line is solid, is the solution set of a linear inequality.",
  "The $xy$-plane graph shown has one side of a line shaded. Its points are the solutions of a linear inequality.",
]);

// ───────── 삼차 함수 순수 그래프(축 제목 x·y) ─────────
export type CubicX = { fn: string; A: number; rs: [number, number, number]; xs: number[]; ys: number[]; R: number; fig: PlaneFig; y: (x: number) => number };
/** y = A (x - r1)(x - r2)(x - r3), 정수근 r1 < r2 < r3 (x 절편이 격자·눈금 숫자와 겹치지 않는 자리), A = ±1(또는 ±2). 표시점은 근이 아닌 격자점 세 개(곡선 위). */
export function makeCubic(rng: Rng, fn: string, o: { aPool?: number[]; nPts?: number } = {}): CubicX {
  for (let tr = 0; tr < 3000; tr++) {
    const R = rng.pick([6, 8, 10]); const A = rng.pick(o.aPool ?? [-1, 1]); const pool: number[] = []; for (let r = -R + 1; r <= R - 1; r++) if (crossSafe(r, R)) pool.push(r);
    const rs = rng.shuffle(pool).slice(0, 3).sort((p, q) => p - q) as [number, number, number]; if (rs.length < 3 || rs[1] - rs[0] < 2 || rs[2] - rs[1] < 2 || Math.abs(rs[0] + rs[1] + rs[2]) > R) continue;
    const y = (x: number) => A * (x - rs[0]) * (x - rs[1]) * (x - rs[2]); if (!crossSafe(y(0), R) && Math.abs(y(0)) <= R) continue;
    const cand: number[] = []; for (let x = -R; x <= R; x++) if (!rs.includes(x) && Math.abs(y(x)) <= R && clearOfLabels(x, y(x), R)) cand.push(x); const n = o.nPts ?? 3;
    if (cand.length < n) continue; const xs = rng.shuffle(cand).slice(0, n).sort((p, q) => p - q); const ys = xs.map(y);
    const s1 = rs[0] + rs[1] + rs[2], s2 = rs[0] * rs[1] + rs[0] * rs[2] + rs[1] * rs[2], s3 = rs[0] * rs[1] * rs[2];
    const objects: Record<string, unknown>[] = [{ id: "F1", kind: "function", fn: "cubic", params: [A, -A * s1, A * s2, -A * s3], label: fn }, { id: "S1", kind: "scatter", points: xs.map((x, i) => [x, ys[i]] as [number, number]) }];
    return { fn, A, rs, xs, ys, R, y, fig: { type: "plane", axes: pureAxes(R), objects } as unknown as PlaneFig };
  }
  throw new GenFail("삼차 장면 표집 실패");
}
/** FIGURE 의 삼차 곡선(F1)·표시점을 읽어 A, 정수근 rs(정확히 3개), 합 s1, 곱 s3, f 를 정의한다. 표시점이 곡선 위가 아니면 던진다. */
export const CUB_JS = "const CF=FIGURE.objects.find(o=>o.kind==='function'&&o.fn==='cubic'); const CS=FIGURE.objects.find(o=>o.kind==='scatter'); const [A,B,C,D]=CF.params; if(!(Math.abs(A)>0)) throw new Error('A=0'); const f=(x)=>A*x*x*x+B*x*x+C*x+D; if (CS) for (const p of CS.points) if (Math.abs(f(p[0])-p[1])>1e-9) throw new Error('점이 곡선 위에 없음'); const rs=[]; for (let x=-30;x<=30;x++) if (Math.abs(f(x))<1e-9) rs.push(x); if (rs.length!==3) throw new Error('정수근 3개 아님'); const s1=rs[0]+rs[1]+rs[2], s3=rs[0]*rs[1]*rs[2];\n";
export const cubicIntro = (rng: Rng, fn: string) => rng.pick(["", "", "A student is studying a polynomial in algebra class. ", "A teacher draws a cubic curve on a grid. ", "A graphing program plots a polynomial function. "]) + rng.pick([
  `The graph of the cubic polynomial function $${fn}$ is shown in the $xy$-plane, with three points marked on it.`, `The figure shows the graph of $y = ${fn}(x)$, a cubic curve in the $xy$-plane, and three marked points on it.`, `For the cubic polynomial $${fn}$, the graph shown gives selected points $(x, ${fn}(x))$.`,
  `A cubic function $${fn}$ is graphed in the $xy$-plane shown. Three points on the graph are marked.`, `Three marked points lie on the graph of $y = ${fn}(x)$ shown in the $xy$-plane, where $${fn}$ is a cubic polynomial.`,
]);
export const cubicRead = (q: CubicX): [string, string][] => [
  [`곡선이 x 축과 만나는 눈금을 읽으면 영점은 x = ${q.rs[0]}, ${q.rs[1]}, ${q.rs[2]} 이다.`, "Read the zeros where the curve crosses the x-axis."],
  [`표시된 점 (${q.xs[0]}, ${q.ys[0]}) 을 f(x) = a(x - (${q.rs[0]}))(x - (${q.rs[1]}))(x - (${q.rs[2]})) 에 대입한다.`, "Substitute a marked point into the factored form."],
  [`a = ${q.A} 이다.`, "Solve for the leading coefficient."],
];

export const quadVertexIntro = (rng: Rng, fn: string) => rng.pick(LEADS) + rng.pick([
  `The graph of the quadratic function $${fn}$ is shown in the $xy$-plane, with its vertex and two other points marked.`, `The parabola shown is the graph of $y = ${fn}(x)$, with the vertex and two more points marked.`,
  `In the $xy$-plane, the vertex and two other points are marked on the graph of the quadratic function $${fn}$.`, `A quadratic function $${fn}$ is graphed in the $xy$-plane shown, and its vertex and two other points on the graph are marked.`,
  `The figure shows the graph of $y = ${fn}(x)$, a parabola in the $xy$-plane. The vertex and two other points on it are marked.`, `For the quadratic function $${fn}$, the graph shown has its vertex and two additional points marked.`,
]);

// ───────── 지수 곡선 순수 그래프(축 제목 x·y, 양의 y 비대칭 축 — 기존 pureAxes 는 그대로) ─────────
export const posAxes = (X: number, Y: number) => ({ x: { min: 0, max: X, step: 1, title: "x" }, y: { min: 0, max: Y, step: Y / 5, title: "y" } });
const Y_NICE = [20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300];
export type ExpX = { fn: string; a: number; p: number; q: number; b: number; xs: number[]; ys: number[]; X: number; Y: number; y: (x: number) => number; fig: PlaneFig };
/** y = a (p/q)^x, 정수값. 표시점은 연속한 정수 x 세 개(x ≥ 1, 곡선 위). 곡선은 [0, X] 에서 y 축 범위 안. */
export function makeExp(rng: Rng, fn: string, o: { ratios?: [number, number][]; startAt?: number; extra?: Record<string, unknown>[]; markOrigin?: boolean } = {}): ExpX {
  const RS = o.ratios ?? [[2, 1], [3, 1], [3, 2], [1, 2], [4, 1], [5, 4]];
  for (let tr = 0; tr < 1500; tr++) {
    const [p, q] = rng.pick(RS); const X = rng.pick([4, 5, 6]); const t = rng.int(1, 5); const a = t * q ** X; const b = p / q;
    const y = (x: number) => a * b ** x; const vals = Array.from({ length: X + 1 }, (_, i) => y(i)); if (vals.some((v) => !Number.isInteger(v) || v < 1)) continue;
    const top = Math.max(...vals); const Y = Y_NICE.find((v) => v >= top * 1.08); if (!Y || Y > 300 || top < Y * 0.45) continue;
    const s0 = o.startAt ?? rng.int(o.markOrigin ? 0 : 1, Math.max(o.markOrigin ? 0 : 1, X - 2)); const xs = [s0, s0 + 1, s0 + 2]; if (xs[2] > X) continue; const ys = xs.map(y);
    if (new Set(ys).size < 3 || ys.some((v) => v < Y * 0.06 || v > Y * 0.95)) continue;
    const objects: Record<string, unknown>[] = [{ id: "F1", kind: "function", fn: "exponential", params: [a, b, 0], label: fn }, { id: "S1", kind: "scatter", points: xs.map((x, i) => [x, ys[i]] as [number, number]) }, ...(o.extra ?? [])];
    return { fn, a, p, q, b, xs, ys, X, Y, y, fig: { type: "plane", axes: posAxes(X, Y), objects } as unknown as PlaneFig };
  }
  throw new GenFail("지수 곡선 장면 표집 실패");
}
/** FIGURE 의 지수 곡선(F1: a·b^x, 상수항 0)과 표시점을 읽어 a, b, f 를 정의한다. 표시점이 곡선 위가 아니면 던진다. */
export const EXP_JS = "const EF=FIGURE.objects.find(o=>o.kind==='function'&&o.fn==='exponential'); const ES=FIGURE.objects.find(o=>o.kind==='scatter'); const a=EF.params[0], b=EF.params[1]; if (Math.abs(EF.params[2])>1e-12||!(a>0)||!(b>0)) throw new Error('지수 곡선 형태 아님'); const f=(x)=>a*Math.pow(b,x); if (ES) for (const p of ES.points) if (Math.abs(f(p[0])-p[1])>1e-6) throw new Error('점이 곡선 위에 없음');\n";
export const expIntro = (rng: Rng, fn: string) => rng.pick(["", "", "A student is studying a function in algebra class. ", "A teacher draws an exponential curve on a grid. ", "A graphing program plots a function. ", "In a practice set, a function is shown as a graph. "]) + rng.pick([
  `The graph of the exponential function $${fn}$ is shown in the $xy$-plane, with three points marked on it.`, `The figure shows the graph of $y = ${fn}(x)$, an exponential curve in the $xy$-plane, and three marked points on it.`, `For the exponential function $${fn}$, the graph shown gives selected points $(x, ${fn}(x))$.`,
  `An exponential function $${fn}$ is graphed in the $xy$-plane shown. Three points on the graph are marked.`, `Three marked points lie on the graph of $y = ${fn}(x)$ shown in the $xy$-plane, where $${fn}$ is an exponential function.`,
]);
export const expRead = (e: ExpX): [string, string][] => [
  [`그래프에 표시된 점을 읽는다: ${e.xs.map((x, i) => `(${x}, ${e.ys[i]})`).join(", ")}.`, "Read the marked points."],
  [`x 가 1 늘 때 값이 ${e.ys[1]} ÷ ${e.ys[0]} = ${e.b} 배가 되므로 b = ${e.b} 이다.`, "The ratio of consecutive values is b."],
  [`${e.xs[0]} 에서의 값 ${e.ys[0]} = a × ${e.b}^${e.xs[0]} 이므로 a = ${e.a} 이다.`, "Solve for a."],
];
