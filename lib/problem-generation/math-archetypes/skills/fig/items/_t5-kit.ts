// 묶음 T5(비선형 함수·방정식 값표) 전용 장면·헬퍼 — 이 묶음의 조합 파일 11개만 쓴다.
// 이차 값표는 '2계 차분 일정', 지수 값표는 '연속한 비 일정'을 verification_js 가 확인하고 어기면 던진다 — 칸 하나만 바뀌어도('cell' 변조) 검출된다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";

export const isInt = Number.isInteger;
export type Fig = { type: "data"; kind: "table"; columns: string[]; rows: number[][]; title?: string };
/** 추상 값표의 함수 이름(문항마다 바꿔 숫자가 가려진 문장 비교에서도 서로 다른 변형이 되게). */
export const FNS = ["f", "g", "h", "p", "q", "k", "r", "s", "w"];
export const pickFn = (rng: Rng, not: string[] = []) => rng.pick(FNS.filter((f) => !not.includes(f)));
/** 추상 문항 도입 문장(앞에 붙임) — 독립 변형 ≥30 을 위해 넓게 섞는다. */
export const LEAD = ["", "", "", "A student is studying a function in algebra class. ", "A teacher writes a function problem on the board. ", "Consider the following function data. ", "A graphing program reports several values of a function. ", "In a practice set, a function is described by a table. ", "A math club is investigating a nonlinear function. ", "Several values of a function were computed and recorded. ", "An engineer models a curve with a function. ", "During a lesson on functions, a class builds a table of values. ", "A calculator was used to evaluate a function at several inputs. ", "A puzzle gives partial information about a function. "];

// ───────── 이차 값표(열 x, f(x)) ─────────
export type Quad = { fn: string; A: number; B: number; C: number; xs: number[]; ys: number[]; fig: Fig; H: number; K: number };
export const qv = (q: { A: number; B: number; C: number }, x: number) => q.A * x * x + q.B * x + q.C;
export const xsRun = (x0: number, n: number, d = 1) => Array.from({ length: n }, (_, i) => x0 + i * d);
/** 이차 값표 — 정수 계수, 모든 값 정수·|y|≤max. 행은 5개 이상(2계 차분 검사로 칸 변조를 잡으려면 4행 이상 필요). */
export function quadTab(fn: string, A: number, B: number, C: number, xs: number[], max = 400): Quad {
  if (A === 0) throw new GenFail("A=0");
  const ys = xs.map((x) => A * x * x + B * x + C);
  if (ys.some((y) => !isInt(y) || Math.abs(y) > max)) throw new GenFail("값 범위");
  if (xs.length < 5) throw new GenFail("행 부족");
  const H = -B / (2 * A), K = C - (B * B) / (4 * A);
  return { fn, A, B, C, xs, ys, fig: { type: "data", kind: "table", columns: ["x", `${fn}(x)`], rows: xs.map((x, i) => [x, ys[i]]) }, H, K };
}
/** 꼭짓점형 a(x - h)^2 + k 로 만든다(h 는 정수 또는 .5). */
export const quadVertex = (fn: string, a: number, h: number, k: number, xs: number[], max?: number) => quadTab(fn, a, -2 * a * h, a * h * h + k, xs, max);
/** 두 근형 a(x - p)(x - q) + c. */
export const quadRoots = (fn: string, a: number, p: number, q: number, xs: number[], c = 0, max?: number) => quadTab(fn, a, -a * (p + q), a * p * q + c, xs, max);
/** FIGURE(2열 표)에서 이차식 A, B, C, 꼭짓점 H, K 를 세우는 JS — x 등간격·2계 차분 일정이 아니면 던진다. 열 j(기본 1). */
export const quadJs = (j = 1, nm = "") => `const qx${nm}=FIGURE.rows.map(r=>r[0]), qy${nm}=FIGURE.rows.map(r=>r[${j}]); const qd${nm}=qx${nm}[1]-qx${nm}[0]; if (qx${nm}.length<5||!(qd${nm}>0)) throw new Error('행 부족'); for (let i=1;i<qx${nm}.length;i++) if (Math.abs(qx${nm}[i]-qx${nm}[i-1]-qd${nm})>1e-9) throw new Error('x 간격 불규칙'); const D2${nm}=qy${nm}[2]-2*qy${nm}[1]+qy${nm}[0]; for (let i=2;i<qy${nm}.length;i++) if (Math.abs(qy${nm}[i]-2*qy${nm}[i-1]+qy${nm}[i-2]-D2${nm})>1e-9) throw new Error('이차 관계가 아님'); const A${nm}=D2${nm}/(2*qd${nm}*qd${nm}); if (A${nm}===0) throw new Error('이차 아님'); const B${nm}=(qy${nm}[1]-qy${nm}[0])/qd${nm}-A${nm}*(qx${nm}[0]+qx${nm}[1]); const C${nm}=qy${nm}[0]-A${nm}*qx${nm}[0]*qx${nm}[0]-B${nm}*qx${nm}[0]; const H${nm}=-B${nm}/(2*A${nm}), K${nm}=C${nm}-B${nm}*B${nm}/(4*A${nm}); const f${nm}=(x)=>A${nm}*x*x+B${nm}*x+C${nm};\n`;
export const QUAD_JS = quadJs();
/** 표에서 이차식을 세우는 사람의 풀이(해설 4단계). */
export function quadRead(q: Quad): [string, string][] {
  const d1 = q.ys.slice(1).map((y, i) => y - q.ys[i]); const d = q.xs[1] - q.xs[0];
  return [
    [`표에서 값을 읽는다: ${q.xs.map((x, i) => `(${x}, ${q.ys[i]})`).slice(0, 4).join(", ")} …`, "Read the values from the table."],
    [`1계 차분: ${d1.join(", ")} — 2계 차분이 ${fmtNum(d1[1] - d1[0])} 로 일정하므로 이차함수이다.`, "Second differences are constant, so the function is quadratic."],
    [`이차항 계수 a = (2계 차분) ÷ (2 × ${d}²) = ${fmtNum(q.A)} 이다.`, "The leading coefficient is half the second difference (per unit step squared)."],
    [`두 점을 대입해 b = ${fmtNum(q.B)}, c = ${fmtNum(q.C)} 를 얻는다.`, "Substitute two points to find b and c."],
  ];
}
/** 대칭(같은 값의 두 x)으로 축을 찾는 풀이 한 단계. */
export function symStep(q: Quad): [string, string] {
  for (let i = 0; i < q.xs.length; i++) for (let j = i + 1; j < q.xs.length; j++) if (q.ys[i] === q.ys[j]) return [`${q.fn}(${q.xs[i]}) = ${q.fn}(${q.xs[j]}) = ${q.ys[i]} 이므로 대칭축은 x = (${q.xs[i]} + ${q.xs[j]}) ÷ 2 = ${fmtNum(q.H)} 이다.`, "Equal outputs are symmetric about the axis of symmetry."];
  return [`꼭짓점의 x 좌표 = -b ÷ (2a) = ${fmtNum(q.H)} 이다.`, "The axis of symmetry is x = -b / (2a)."];
}
/** 표에 같은 값의 두 x 가 있는가. */
export const hasPair = (q: Quad) => q.ys.some((y, i) => q.ys.indexOf(y) !== i);
export const quadIntro = (rng: Rng, fn: string) => rng.pick(LEAD) + rng.pick([
  `The table shows several values of $x$ and the corresponding values of $${fn}(x)$ for the quadratic function $${fn}$.`,
  `For the quadratic function $${fn}$, the table shown gives $${fn}(x)$ for selected values of $x$.`,
  `The function $${fn}$ is defined by $${fn}(x) = ax^2 + bx + c$, where $a$, $b$, and $c$ are constants. The table shown gives some values of $x$ and $${fn}(x)$.`,
  `Selected values of the quadratic function $${fn}$ are shown in the table.`,
  `The graph of $y = ${fn}(x)$ in the $xy$-plane is a parabola. The table shown lists several points $(x, ${fn}(x))$ on the graph.`,
  `A quadratic function $${fn}$ takes the values given in the table for the listed values of $x$.`,
  `Some input-output pairs for a quadratic function $${fn}$ are given in the table shown.`,
]);

// ───────── 지수 값표 ─────────
/** 지수 값표: y = a·r^((x - x0)/d)…; 값은 모두 정수. */
export type Exp = { fn: string; a: number; r: number; xs: number[]; ys: number[]; fig: Fig };
/** a = f(0), r = 한 단위(x 가 1 늘 때)의 비. xs 는 등간격 정수(0 이상). 모든 값 정수·≤max. */
export function expTab(fn: string, a: number, r: number, xs: number[], cols?: [string, string], max = 999): Exp {
  const ys = xs.map((x) => a * r ** x);
  if (ys.some((y) => !isInt(Math.round(y * 1e9) / 1e9) || y > max || y < 1)) throw new GenFail("지수 값 범위");
  const yy = ys.map((y) => Math.round(y));
  if (xs.length < 4) throw new GenFail("행 부족");
  return { fn, a, r, xs, ys: yy, fig: { type: "data", kind: "table", columns: cols ?? ["x", `${fn}(x)`], rows: xs.map((x, i) => [x, yy[i]]) } };
}
/** FIGURE 에서 한 단위 비 R, f(0)=E0 를 세우는 JS — 비가 일정하지 않으면 던진다. 열 j. */
export const expJs = (j = 1) => `const ex=FIGURE.rows.map(r=>r[0]), ey=FIGURE.rows.map(r=>r[${j}]); const ed=ex[1]-ex[0]; if (ex.length<4||!(ed>0)) throw new Error('행 부족'); for (let i=1;i<ex.length;i++) if (Math.abs(ex[i]-ex[i-1]-ed)>1e-9) throw new Error('x 간격 불규칙'); const er=ey[1]/ey[0]; if (!(er>0)||Math.abs(er-1)<1e-9) throw new Error('지수 아님'); for (let i=1;i<ey.length;i++) if (Math.abs(ey[i]/ey[i-1]-er)>1e-9) throw new Error('비가 일정하지 않음'); const R=Math.pow(er,1/ed); const E0=ey[0]/Math.pow(R,ex[0]); const g=(x)=>E0*Math.pow(R,x);\n`;
export const EXP_JS = expJs();
export const expIntro = (rng: Rng, fn: string) => rng.pick(LEAD) + rng.pick([
  `The table shows several values of $x$ and the corresponding values of $${fn}(x)$ for the exponential function $${fn}$.`,
  `For the exponential function $${fn}$, the table shown gives $${fn}(x)$ for selected values of $x$.`,
  `The function $${fn}$ is defined by $${fn}(x) = a(b)^x$, where $a$ and $b$ are positive constants. The table shown gives some values of $x$ and $${fn}(x)$.`,
  `Selected values of the exponential function $${fn}$ are shown in the table.`,
  `An exponential function $${fn}$ takes the values given in the table for the listed values of $x$.`,
]);
export const expRead = (e: Exp): [string, string][] => [
  [`표에서 값을 읽는다: ${e.xs.map((x, i) => `(${x}, ${e.ys[i]})`).slice(0, 3).join(", ")} …`, "Read the values from the table."],
  [`연속한 값의 비가 ${fmtNum(e.ys[1] / e.ys[0])} 로 일정하므로 지수함수이고, x 가 1 늘 때 비 b = ${fmtNum(e.r)} 이다.`, "Consecutive outputs have a constant ratio, so the function is exponential."],
];
export const fmtR = (n: number) => fmtNum(Math.round(n * 1e6) / 1e6);

export const A_POOL = [-3, -2, -1, 1, 2, 3];
/** 꼭짓점이 표 밖(한쪽)에 있는 값표 — 같은 값의 쌍이 없어 식을 세워야 한다. half 면 h 가 .5(k 는 값이 정수가 되게 보정). */
export function quadOneSided(rng: Rng, fn: string, half = false, aPool = A_POOL): Quad {
  for (let t = 0; t < 60; t++) {
    const a = rng.pick(aPool); const h = rng.int(-6, 8) + (half ? 0.5 : 0); const k = rng.int(-30, 30) - (half ? a / 4 : 0); const n = rng.int(5, 6);
    const left = rng.chance(0.5); const gap = rng.int(1, 3); const x0 = left ? Math.ceil(h) + gap : Math.floor(h) - gap - (n - 1);
    try { const q = quadVertex(fn, a, h, k, xsRun(x0, n)); if (hasPair(q)) continue; return q; } catch { continue; }
  }
  throw new GenFail("한쪽 값표 표집 실패");
}
/** 꼭짓점을 사이에 둔(같은 값의 쌍이 있는) 값표. vIn=꼭짓점 행 포함(h 정수) / 아니면 h 가 .5. */
export function quadAround(rng: Rng, fn: string, vIn: boolean, aPool = A_POOL): Quad {
  for (let t = 0; t < 60; t++) {
    const a = rng.pick(aPool); const h = rng.int(-5, 8) + (vIn ? 0 : 0.5); const k = rng.int(-30, 30) - (vIn ? 0 : a / 4); const n = rng.int(5, 6);
    const x0 = Math.floor(h) - rng.int(1, n - 3);
    try { const q = quadVertex(fn, a, h, k, xsRun(x0, n)); if (!hasPair(q)) continue; return q; } catch { continue; }
  }
  throw new GenFail("대칭 값표 표집 실패");
}
/** 추상 지수 값표: r ∈ {2, 3, 1/2, 3/2 …}, a 는 모든 값이 정수가 되게. xs 는 x0 부터 연속 n(4~5)개. */
export function expGen(rng: Rng, fn: string, o: { x0?: number; rs?: number[]; max?: number } = {}): Exp {
  for (let t = 0; t < 80; t++) {
    const r = rng.pick(o.rs ?? [2, 2, 3, 0.5, 1.5, 4]); const n = rng.int(4, 5); const x0 = o.x0 ?? rng.int(0, 2); const xs = xsRun(x0, n);
    const den = r === 0.5 ? 2 ** (x0 + n - 1) : r === 1.5 ? 2 ** (x0 + n - 1) : 1; const a = den * rng.int(1, r === 0.5 || r === 1.5 ? 3 : 9);
    try { return expTab(fn, a, r, xs, undefined, o.max); } catch { continue; }
  }
  throw new GenFail("지수 값표 표집 실패");
}
/** 이차 값표 — 정수근 p < q 를 갖는 f(x) - c = a(x - p)(x - q), 표에는 p, q 가 없음(근을 표에서 읽을 수 없게). */
export function quadWithRoots(rng: Rng, fn: string, c = 0, aPool = A_POOL): Quad & { p: number; q: number } {
  for (let t = 0; t < 80; t++) {
    const a = rng.pick(aPool); const p = rng.int(-8, 6); const q = p + rng.int(2, 9); const n = rng.int(5, 6);
    const x0 = rng.int(p - n - 2, q + 2); const xs = xsRun(x0, n); if (xs.includes(p) || xs.includes(q)) continue;
    try { return { ...quadRoots(fn, a, p, q, xs, c), p, q }; } catch { continue; }
  }
  throw new GenFail("근 값표 표집 실패");
}
/** mx + b 수식(계수 1·-1 처리). */
export const linTex = (m: number, b: number) => `${m === 1 ? "" : m === -1 ? "-" : m}x${b === 0 ? "" : ` ${b < 0 ? "-" : "+"} ${Math.abs(b)}`}`;
/** 근의 공식 두 해(큰 해·작은 해) JS — 변수 a2, b2, c2 를 받아 hi, lo 정의. */
export const ROOTS_JS = "const disc=b2*b2-4*a2*c2; if (disc<-1e-9) throw new Error('해 없음'); const sq=Math.sqrt(Math.max(0,disc)); const hi=Math.max((-b2+sq)/(2*a2),(-b2-sq)/(2*a2)), lo=Math.min((-b2+sq)/(2*a2),(-b2-sq)/(2*a2));\n";
