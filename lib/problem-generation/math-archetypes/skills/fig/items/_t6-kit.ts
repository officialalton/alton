// 묶음 T6(부등식·연립 값표) 전용 장면·헬퍼 — 이 묶음의 조합 파일 4개만 쓴다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { lin } from "../../../text";

export type Op = "lt" | "le" | "gt" | "ge";
/** A x + B y (op) C */
export type Ineq = { A: number; B: number; C: number; op: Op; slope: boolean };
export const OPS: Op[] = ["lt", "le", "gt", "ge"];
export const TEX: Record<Op, string> = { lt: "<", le: "\\le", gt: ">", ge: "\\ge" };
export const FLIP: Record<Op, Op> = { lt: "gt", le: "ge", gt: "lt", ge: "le" };
export const STRICT_TOGGLE: Record<Op, Op> = { lt: "le", le: "lt", gt: "ge", ge: "gt" };
export const cmp = (v: number, op: Op, c: number) => (op === "lt" ? v < c : op === "le" ? v <= c : op === "gt" ? v > c : v >= c);
export const sat = (I: Ineq, x: number, y: number) => cmp(I.A * x + I.B * y, I.op, I.C);
/** 수식 표기: slope 형(B=1)이면 y (op) mx + b, 아니면 Ax + By (op) C. */
export function texIneq(I: Ineq, u = "x", v = "y"): string {
  if (I.slope) return `${v} ${TEX[I.op]} ${lin(-I.A, I.C, u)}`;
  const bt = Math.abs(I.B) === 1 ? v : `${Math.abs(I.B)}${v}`;
  const at = I.A === 1 ? u : I.A === -1 ? `-${u}` : `${I.A}${u}`;
  return `${at} ${I.B < 0 ? "-" : "+"} ${bt} ${TEX[I.op]} ${I.C}`;
}
/** 부등식 하나 표집: slope 형은 y (op) m x + b. */
export function randIneq(rng: Rng, o: { slope?: boolean; op?: Op } = {}): Ineq {
  const op = o.op ?? rng.pick(OPS); const slope = o.slope ?? rng.chance(0.5);
  if (slope) { const m = rng.nz(-4, 4); const b = rng.nz(-8, 8); return { A: -m, B: 1, C: b, op, slope: true }; }
  const A = rng.nz(-5, 5), B = rng.pick([-5, -4, -3, -2, 2, 3, 4, 5]); const C = rng.nz(-20, 20);
  return { A, B, C, op, slope: false };
}
/** P 에 넣을 부등식 상수(지문에 인쇄된 계수 그대로). */
export const ineqP = (I: Ineq, k = "") => ({ [`A${k}`]: I.A, [`B${k}`]: I.B, [`C${k}`]: I.C, [`op${k}`]: I.op });
/** verificationJs 공용: sat(k, x, y) 는 P 의 k 번째 부등식으로 판정. */
export const SAT_JS = "const sat=(k,x,y)=>{ const v=P['A'+k]*x+P['B'+k]*y, c=P['C'+k], o=P['op'+k]; return o==='lt'?v<c:o==='le'?v<=c:o==='gt'?v>c:v>=c; };\n";

// ───────── 점 표(열 Point, x, y) ─────────
export type PtTab = { labels: string[]; xs: number[]; ys: number[]; fig: { type: "data"; kind: "table"; columns: string[]; rows: (string | number)[][] } };
const LABELS = [["A", "B", "C", "D", "E", "F"], ["P", "Q", "R", "S", "T", "U"], ["J", "K", "L", "M", "N", "O"], ["F", "G", "H", "J", "K", "L"], ["R", "S", "T", "U", "V", "W"]];
export const ptFig = (labels: string[], xs: number[], ys: number[]) => ({ type: "data" as const, kind: "table" as const, columns: ["Point", "x", "y"], rows: labels.map((l, i) => [l, xs[i], ys[i]]) });
/**
 * 점 표 표집 — answer(xs, ys) 가 정답. 마지막 점의 y 를 훑어 'cell' 변조(마지막 y + 1)로 정답이 바뀌는 자리를 고른다(개수형 답의 변조 민감성).
 * ok 가 거짓이면 다시 뽑는다.
 */
export function makePts(rng: Rng, answer: (xs: number[], ys: number[]) => number, ok: (v: number, xs: number[], ys: number[]) => boolean, n = rng.int(5, 6)): PtTab & { ans: number } {
  for (let tr = 0; tr < 200; tr++) {
    const labels = rng.pick(LABELS).slice(0, n); const xs: number[] = [], ys: number[] = [];
    for (let i = 0; i < n; i++) { xs.push(rng.int(-6, 8)); ys.push(rng.int(-9, 12)); }
    const ycands = rng.shuffle(Array.from({ length: 31 }, (_, i) => i - 15));
    let found = false;
    for (const y of ycands) { ys[n - 1] = y; const a = answer(xs, ys); const ys2 = [...ys]; ys2[n - 1] = y + 1; if (a !== answer(xs, ys2)) { found = true; break; } }
    if (!found) continue;
    if (new Set(xs.map((x, i) => `${x},${ys[i]}`)).size !== n || ys.some((y) => Math.abs(y) > 15)) continue;
    const ans = answer(xs, ys); if (!ok(ans, xs, ys)) continue;
    return { labels, xs, ys, ans, fig: ptFig(labels, xs, ys) };
  }
  throw new GenFail("점 표 표집 실패");
}
export const PT_JS = "const X=FIGURE.rows.map(r=>r[1]), Y=FIGURE.rows.map(r=>r[2]); if (X.some(v=>typeof v!=='number')||Y.some(v=>typeof v!=='number')) throw new Error('좌표 오류');\n";
/** 추상 좌표 문항은 숫자를 가리면 문장이 같아지므로 도입 문장을 넓게 섞는다. */
export const PT_LEAD = ["", "", "A student is checking points against an inequality. ", "A teacher lists several points in the coordinate plane. ", "Consider the coordinate data below. ", "A graphing exercise lists some points. ", "During an algebra lesson, a class tests several points. ", "A computer program reports the coordinates of several points. ", "A map is drawn on a coordinate grid, and some landmarks are marked as points. ", "In a coordinate puzzle, several points are given. ", "A designer marks several points on graph paper. ", "An engineer records the locations of several sensors on a grid. ", "A robot's stops are recorded as points on a coordinate grid. "];
export const ptIntro = (rng: Rng) => rng.pick(PT_LEAD) + rng.pick([
  "The table shows the coordinates of several points in the $xy$-plane.",
  "Each row of the table shown gives a point $(x, y)$ in the $xy$-plane.",
  "The table gives the $x$- and $y$-coordinates of several labeled points.",
  "Several points in the $xy$-plane are listed in the table shown.",
  "The points named in the table are plotted in the $xy$-plane.",
  "The table lists some labeled points $(x, y)$.",
]);

// ───────── 좌표 값표(열 x, y) — 일차 관계 ─────────
export type XY = { xs: number[]; ys: number[]; m: number; b: number; fig: { type: "data"; kind: "table"; columns: string[]; rows: number[][] } };
export function makeXY(rng: Rng, o: { ms?: number[] } = {}): XY {
  for (let tr = 0; tr < 60; tr++) {
    const m = rng.pick(o.ms ?? [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]); const d = rng.pick([1, 2, 3]); const x0 = rng.int(-4, 3) * d; const b = rng.nz(-15, 15); const n = rng.int(4, 5);
    const xs = Array.from({ length: n }, (_, i) => x0 + i * d); const ys = xs.map((x) => m * x + b);
    if (ys.some((y) => Math.abs(y) > 90) || xs.includes(0)) continue;
    return { xs, ys, m, b, fig: { type: "data", kind: "table", columns: ["x", "y"], rows: xs.map((x, i) => [x, ys[i]]) } };
  }
  throw new GenFail("좌표 표 표집 실패");
}
export const XY_JS = "const xs=FIGURE.rows.map(r=>r[0]), ys=FIGURE.rows.map(r=>r[1]); const m=(ys[1]-ys[0])/(xs[1]-xs[0]); const b=ys[0]-m*xs[0]; for (let i=0;i<xs.length;i++) if (Math.abs(m*xs[i]+b-ys[i])>1e-9) throw new Error('한 직선 위가 아님');\n";
export const XY_LEAD = ["", "", "A student is studying a system of equations. ", "A teacher writes a system on the board, but one equation is given only as a table. ", "Consider the following information. ", "An engineer models two quantities with linear equations. ", "During an algebra lesson, a class works with a table of values. ", "A graphing program reports several points on a line. ", "Two lines are drawn in the $xy$-plane. ", "Several measurements were recorded, and they all fit one linear equation. ", "A puzzle gives one equation as a table and the other in words. ", "In a coordinate geometry problem, part of the information is in a table. "];
export const xyIntro = (rng: Rng) => rng.pick(XY_LEAD) + rng.pick([
  "The table shows several values of $x$ and their corresponding values of $y$ for a linear relationship.",
  "Each pair $(x, y)$ in the table shown satisfies the same linear equation.",
  "In the $xy$-plane, the graph of a linear equation passes through every point $(x, y)$ given in the table.",
  "The values in the table lie on a line in the $xy$-plane.",
  "The table shown gives some solutions $(x, y)$ of a linear equation.",
  "The relationship between $x$ and $y$ shown in the table is linear.",
]);
export const xyRead = (s: XY): [string, string][] => [[`표에서 두 점 (${s.xs[0]}, ${s.ys[0]}), (${s.xs[1]}, ${s.ys[1]}) 을 읽는다.`, "Read two points from the table."], [`기울기 = (${s.ys[1]} - (${s.ys[0]})) ÷ (${s.xs[1]} - (${s.xs[0]})) = ${s.m} 이다.`, "Compute the slope."], [`y 절편 = ${s.ys[0]} - (${s.m})(${s.xs[0]}) = ${s.b} 이므로 y = ${lin(s.m, s.b)} 이다.`, "Write the equation from the table."]];

/** 표집 실패(GenFail)는 같은 rng 로 다시 시도한다 — 원형 gen 이 조건 미달로 빈손이 되지 않게. */
export function retry<T>(f: () => T, n = 300): T {
  for (let i = 0; i < n; i++) { try { return f(); } catch (e) { if (!(e instanceof GenFail)) throw e; } }
  throw new GenFail("재시도 초과");
}
type G = { gen: (rng: Rng) => unknown };
export const withRetry = <D extends { hard: G[]; em: G[] }>(d: D): D => ({ ...d, hard: d.hard.map((h) => ({ ...h, gen: (rng: Rng) => retry(() => h.gen(rng)) })), em: d.em.map((e) => ({ ...e, gen: (rng: Rng) => retry(() => e.gen(rng)) })) });
