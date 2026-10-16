// 좌표평면 선택지형(C) 공용 키트(math-A 소유) — 직선·포물선·부등식·두 직선·지수 곡선 그림 4개 중 조건에 맞는 그림 하나를 고른다.
// 모든 선택지는 같은 축(pureAxes / posAxes)을 쓰고 라벨·점이 없다. 오답은 두 조건 A·B 중 A 만 / B 만 / 둘 다 어긋난 그림(진단 규칙 이름이 서로 달라야 함).
import { GenFail } from "../../types";
import type { Rng } from "../../rng";
import { pureAxes } from "./pure-kit";
import { posAxes } from "./pure-fn-kit";
import { lineChoice, parabola } from "./ln-b-kit";

export { cInst, oneCond, poolChoices, twoCond, SPR_NO_DATA_CHOICE } from "./data-c-kit";
export const SPR_NO_PLANE_CHOICE = "선택지가 그래프 4개이고 조건에 맞는 그래프를 고르는 것이 문제의 핵심이라 선택지 없이는 성립하지 않는다";
export const C_LEADS = ["", "", "A student is studying graphs in an algebra class. ", "A teacher sketches possible graphs on a grid. ", "A graphing program draws candidate graphs for a worksheet. ", "In a practice set, students compare graphs in the $xy$-plane. ", "A designer compares curves on a coordinate grid. "];
export const C_Q = (what: string) => [`Which of the following graphs shown ${what}?`, `Which one of the four graphs shown ${what}?`, `Which graph shown ${what}?`];
export const R_SET = [6, 8, 10];

// ── 직선(기울기 m, 절편 b): 정수 m 과 ±1/2 ──
export const M_SET = [-4, -3, -2, -1, -0.5, 0.5, 1, 2, 3, 4];
export const LSTAT = "const o=c.objects.find(q=>q.kind==='line'); if(!o) throw new Error('직선 필요'); const [p,q]=o.through; const m=(q[1]-p[1])/(q[0]-p[0]); return {m, b:p[1]-m*p[0]};";
export function linePool(R: number): unknown[] { const out: unknown[] = []; for (const m of M_SET) for (let b = -(R - 1); b <= R - 1; b++) { try { out.push(lineChoice(R, m, b)); } catch { /* 격자점 부족 */ } } return out; }
/** 정답 직선: (m, b) 가 격자점 둘 이상을 갖는지 확인한 그림. */
export const lineOk = (R: number, m: number, b: number) => lineChoice(R, m, b);
export function pickLine(rng: Rng, R: number, ms = M_SET): { m: number; b: number } { for (let t = 0; t < 300; t++) { const m = rng.pick(ms), b = rng.int(-(R - 2), R - 2); if (b === 0) continue; try { lineChoice(R, m, b); return { m, b }; } catch { /* retry */ } } throw new GenFail("직선 표집 실패"); }
/** 직선 위의 정수 격자점 하나(x ≠ 0, 눈금 숫자와 겹치지 않는 자리 선호). */
export function pointOn(rng: Rng, R: number, m: number, b: number, not: number[] = []): [number, number] { const xs: number[] = []; for (let x = -R + 1; x <= R - 1; x++) { const y = m * x + b; if (x !== 0 && !not.includes(x) && Number.isInteger(y) && Math.abs(y) <= R - 1) xs.push(x); } if (!xs.length) throw new GenFail("점 없음"); const x = rng.pick(xs); return [x, m * x + b]; }

// ── 포물선 ──
export const QSTAT = "const o=c.objects.find(q=>q.kind==='function'&&q.fn==='quadratic'); if(!o) throw new Error('이차함수 필요'); const [A,B,C]=o.params; return {A,B,C,H:-B/(2*A),K:C-B*B/(4*A)};";
export function parabolaPool(R: number): unknown[] { const out: unknown[] = []; for (const A of [-2, -1, 1, 2]) for (let H = -4; H <= 4; H++) for (let K = -(R - 3); K <= R - 3; K++) { try { out.push(parabola(R, A, H, K).fig); } catch { /* 범위 밖 */ } } return out; }
export const parabolaOk = (R: number, A: number, H: number, K: number) => parabola(R, A, H, K).fig;

// ── 부등식(음영): 경계선 (m, b) + 부등호 ──
export const ISTAT = "const o=c.objects.find(q=>q.kind==='inequality'); if(!o) throw new Error('부등식 필요'); return {m:o.slope,b:o.intercept,op:o.op,above:(o.op==='>'||o.op==='>='),strict:(o.op==='>'||o.op==='<')};";
export const ineqFig = (R: number, m: number, b: number, op: string) => ({ type: "plane" as const, axes: pureAxes(R), objects: [{ id: "I1", kind: "inequality" as const, op, slope: m, intercept: b }] });
export function ineqPool(R: number): unknown[] { const out: unknown[] = []; for (const m of M_SET.filter((v) => Number.isInteger(v))) for (let b = -(R - 2); b <= R - 2; b++) { try { lineChoice(R, m, b); for (const op of ["<", "<=", ">", ">="]) out.push(ineqFig(R, m, b, op)); } catch { /* skip */ } } return out; }

// ── 두 직선(연립) ──
export const SSTAT = "const L=c.objects.filter(q=>q.kind==='line'); if(L.length!==2) throw new Error('직선 2개 필요'); const k=(o)=>{const [p,q]=o.through; const m=(q[1]-p[1])/(q[0]-p[0]); return [m,p[1]-m*p[0]];}; return {L:L.map(k)};";
export function twoLineFig(R: number, a: [number, number], b: [number, number]) { const f1 = lineChoice(R, a[0], a[1]), f2 = lineChoice(R, b[0], b[1]); return { type: "plane" as const, axes: pureAxes(R), objects: [{ ...f1.objects[0], id: "A1" }, { ...f2.objects[0], id: "B1" }] }; }
export function twoLinePool(rng: Rng, R: number, ok: [[number, number], [number, number]], n = 900): unknown[] { const out: unknown[] = []; const lp: [number, number][] = []; for (const m of M_SET.filter(Number.isInteger)) for (let b = -(R - 2); b <= R - 2; b++) { try { lineChoice(R, m, b); lp.push([m, b]); } catch { /* skip */ } } for (let i = 0; i < n; i++) { const a = rng.chance(0.4) ? ok[0] : rng.pick(lp); const c = rng.chance(0.4) ? ok[1] : rng.pick(lp); if (a[0] === c[0] && a[1] === c[1]) continue; try { out.push(twoLineFig(R, a, c)); } catch { /* skip */ } } return out; }

// ── 지수 곡선 ──
export const ESTAT = "const o=c.objects.find(q=>q.kind==='function'&&q.fn==='exponential'); if(!o) throw new Error('지수함수 필요'); return {a:o.params[0], b:o.params[1]};";
export const expFig = (X: number, Y: number, a: number, b: number) => ({ type: "plane" as const, axes: posAxes(X, Y), objects: [{ id: "F1", kind: "function" as const, fn: "exponential" as const, params: [a, b, 0] }] });
