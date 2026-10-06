// 수직선(NL) 공용 장면 키트 — linear_inequalities.{solve_one_var,compound_inequality_number_line}.NL.{P,C} · inference_margin_error.{population_estimate,margin_interval}.NL.{P,C}.
// 규칙(자료 계열 공통): 수치를 먼저 뽑고 → figure(number_line)를 만들고 → 지문은 값을 되풀이하지 않고 "the number line shown" 으로 가리킨다. 정보는 자료에만 있다.
// 검증 JS 는 FIGURE.items 의 반직선·구간만 읽고, 지문의 부등식·조건과 그림이 어긋나면 던진다(그림 변조가 곧 검출된다).
import { GenFail, type Instance } from "../../types";
import type { Rng } from "../../rng";
import { W } from "../d-kit";
import { figJs, placeChoices } from "../../figure-kit";
import { defineItem } from "./item-kit";
import { gInst } from "./graph-kit";
import { statementInst, MC_ONLY_STATEMENT } from "./item-kit";
import { choiceInst } from "../tvd-fig-choice";
import { renderNumberLine } from "@/lib/problem-figures/templates/number-line";
import { SURVEYS, sampleCounts } from "./items/_t7-kit";
import { fmtNum } from "../../text";

const f = fmtNum;
export type Op = "<" | "<=" | ">" | ">=";
const TEX: Record<Op, string> = { "<": "<", "<=": "\\le", ">": ">", ">=": "\\ge" };
const FLIP: Record<Op, Op> = { "<": ">", "<=": ">=", ">": "<", ">=": "<=" };
const STRICT: Record<Op, Op> = { "<": "<=", "<=": "<", ">": ">=", ">=": ">" };
export const linTex = (a: number, b: number) => `${a === 1 ? "" : a === -1 ? "-" : a}x${b === 0 ? "" : b > 0 ? ` + ${b}` : ` - ${-b}`}`;
const ineq = (a: number, b: number, op: Op, c: number) => `$${linTex(a, b)} ${TEX[op]} ${c}$`;

type Sol = { e: number; dir: "left" | "right"; open: boolean };
const solve = (a: number, b: number, op: Op, c: number): Sol => { const e = (c - b) / a; const o = a < 0 ? FLIP[op] : op; return { e, dir: o === ">" || o === ">=" ? "right" : "left", open: o === "<" || o === ">" }; };
const ray = (s: Sol) => ({ kind: "ray" as const, at: s.e, dir: s.dir, ...(s.open ? { open: true } : {}) });
type Axis = { axisMin: number; axisMax: number };
function axisFor(rng: Rng, pts: number[], o: { pad?: [number, number]; min?: number; max?: number } = {}): Axis {
  const [p0, p1] = o.pad ?? [2, 3]; let lo = Math.min(...pts) - rng.int(p0, p1), hi = Math.max(...pts) + rng.int(p0, p1);
  while (hi - lo < 8) { if (rng.chance(0.5)) lo--; else hi++; }
  if (o.min !== undefined) lo = o.min; if (o.max !== undefined) hi = o.max;
  if (hi - lo > 20) throw new GenFail("수직선 범위가 넓다"); return { axisMin: lo, axisMax: hi };
}
type Item = Record<string, unknown>;
const nlFig = (ax: Axis, items: Item[], extra: Record<string, unknown> = {}) => ({ type: "number_line" as const, axisMin: ax.axisMin, axisMax: ax.axisMax, step: 1, items, ...extra });
function okFig<T extends { type: "number_line" }>(fig: T): T { if (renderNumberLine(fig as never).issues.length) throw new GenFail("수직선 배치"); return fig; }

const texPlain = (t: string) => t.replace(/\$/g, "").replace(/\\le\b/g, "≤").replace(/\\ge\b/g, "≥");
/** 풀이 단계가 hard 5·medium 3 이상이 되도록 답 문장과 확인 단계를 보탠다. */
const tr5 = (t: [string, string][], ans: string, min = 5): [string, string][] => { const o: [string, string][] = [...t, [`따라서 답은 ${ans} 이다.`, "That is the answer."]]; while (o.length < min) o.splice(o.length - 1, 0, ["결과를 그림과 다시 대조해 확인한다.", "Check the result against the number line."]); return o; };

type GD = Parameters<typeof gInst>[1];
const gI = (rng: Rng, d: GD, fig: unknown): Instance => gInst(rng, { ...d, trace: tr5(d.trace, d.correct !== undefined ? f(d.correct) : "") }, fig);

export const NLEADS = [
  "Use the number line to answer the question.", "Refer to the number line when answering the question that follows.", "Answer the question using only the number line shown.", "Study the number line carefully before answering.",
  "The number line contains the information needed for this question.", "Consider the graph on the number line.", "Examine the number line and then answer the question below.", "Base your answer on what the number line shows.",
  "Notice which endpoints are filled and which are open.", "A filled dot means the value is included; an open dot means it is not.", "Pay attention to the direction of the arrow.", "Every tick mark on the number line is one unit apart.",
];

// ───────────────────────── JS(검증) 공용 ─────────────────────────
const SEG_JS = `const INF = Infinity; const itemSegs = (items) => items.map((it) => it.kind === 'interval' ? { lo: it.lo, hi: it.hi, loOpen: !!it.loOpen, hiOpen: !!it.hiOpen } : it.kind === 'ray' ? (it.dir === 'right' ? { lo: it.at, hi: INF, loOpen: !!it.open, hiOpen: true } : { lo: -INF, hi: it.at, loOpen: true, hiOpen: !!it.open }) : (() => { throw new Error('점은 해집합이 아님'); })()).sort((p, q) => p.lo - q.lo);
const inSet = (segs, x) => segs.some((s) => (s.loOpen ? x > s.lo : x >= s.lo) && (s.hiOpen ? x < s.hi : x <= s.hi));
const sameSegs = (u, v) => u.length === v.length && u.every((s, i) => s.lo === v[i].lo && s.hi === v[i].hi && s.loOpen === v[i].loOpen && s.hiOpen === v[i].hiOpen);
const FL = { '<': '>', '<=': '>=', '>': '<', '>=': '<=' };
const one = (a, b, op, c) => { const e = (c - b) / a; const o = a < 0 ? FL[op] : op; return o === '>' || o === '>=' ? { lo: e, hi: INF, loOpen: o === '>', hiOpen: true } : { lo: -INF, hi: e, loOpen: true, hiOpen: o === '<' }; };
const inter = (s, t) => { const lo = Math.max(s.lo, t.lo); const loOpen = s.lo === t.lo ? (s.loOpen || t.loOpen) : (s.lo > t.lo ? s.loOpen : t.loOpen); const hi = Math.min(s.hi, t.hi); const hiOpen = s.hi === t.hi ? (s.hiOpen || t.hiOpen) : (s.hi < t.hi ? s.hiOpen : t.hiOpen); return { lo, hi, loOpen, hiOpen }; };
const norm = (t) => t.replace(/\\$/g, '').replace(/\\\\le(q)?/g, '<=').replace(/\\\\ge(q)?/g, '>=').replace(/\\s+/g, '');
const single = (s) => { let m0 = s.match(/^(-?\\d*)\\(x([+-]\\d+)\\)(<=|>=|<|>)(-?\\d+)$/); if (m0) { const a0 = m0[1] === '' ? 1 : m0[1] === '-' ? -1 : +m0[1]; return one(a0, a0 * +m0[2], m0[3], +m0[4]); } m0 = s.match(/^(-?\\d*)x([+-]\\d+)?(<=|>=|<|>)(-?\\d*)x([+-]\\d+)$/); if (m0) { const a0 = m0[1] === '' ? 1 : m0[1] === '-' ? -1 : +m0[1]; const d0 = m0[4] === '' ? 1 : m0[4] === '-' ? -1 : +m0[4]; return one(a0 - d0, 0, m0[3], +m0[5] - (m0[2] ? +m0[2] : 0)); } const m = s.match(/^(-?\\d*)x([+-]\\d+)?(<=|>=|<|>)(-?\\d+)$/); if (!m) throw new Error('부등식 형식'); const a = m[1] === '' ? 1 : m[1] === '-' ? -1 : +m[1]; return one(a, m[2] ? +m[2] : 0, m[3], +m[4]); };
const chain = (s) => { const m = s.match(/^(-?\\d+)(<=|<)(-?\\d*)x([+-]\\d+)?(<=|<)(-?\\d+)$/); if (!m) return null; const a = m[3] === '' ? 1 : m[3] === '-' ? -1 : +m[3]; const b = m[4] ? +m[4] : 0; const lowB = one(a, b, m[2] === '<' ? '>' : '>=', +m[1]); const upB = one(a, b, m[5], +m[6]); return inter(lowB, upB); };
const parseSet = (t) => { const n = norm(t); return n.split('or').map((p) => chain(p) || single(p)).sort((p, q) => p.lo - q.lo); };
`;
const figSegs = `const segs = itemSegs(FIGURE.items);\n`;

// ───────────────────────── solve_one_var ─────────────────────────
type Lin = { a: number; b: number; op: Op; c: number; e: number; sol: Sol };
const OPS: Op[] = ["<", "<=", ">", ">="];
function linScene(rng: Rng, o: { neg?: boolean; a?: number } = {}): Lin {
  for (let t = 0; t < 80; t++) {
    const a = o.a ?? (o.neg ? -rng.int(2, 5) : rng.int(2, 6)); const b = rng.nz(-9, 9); const e = rng.int(-6, 7); const c = a * e + b; if (Math.abs(c) > 45 || c === 0) continue;
    const op = rng.pick(OPS); return { a, b, op, c, e, sol: solve(a, b, op, c) };
  }
  throw new GenFail("부등식 장면");
}
const optWrongs = (rng: Rng, s: Lin): { text: string; reason: string }[] => {
  const cand = [
    { text: ineq(s.a, s.b, FLIP[s.op], s.c), reason: "부등호 방향을 반대로 두었다(음수로 나눌 때 뒤집는 것과 혼동)." },
    { text: ineq(s.a, s.b, STRICT[s.op], s.c), reason: "경계(같음)를 포함·제외하는 것을 혼동했다." },
    { text: ineq(s.a, s.b, s.op, s.c + s.a), reason: "경계값이 1 어긋났다." },
    { text: ineq(s.a, s.b, s.op, s.c - s.a), reason: "경계값이 1 어긋났다." },
    { text: ineq(s.a, s.b, FLIP[STRICT[s.op]], s.c), reason: "방향과 경계를 모두 잘못 읽었다." },
    { text: ineq(s.a, s.b, s.op, s.c + s.b), reason: "상수항을 반대로 옮겼다." },
  ].filter((w) => { const m = w.text.replace(/\$/g, "").match(/^(.*) (\\le|\\ge|<|>) (-?\d+)$/); return !!m; });
  const pickW = rng.shuffle(cand).slice(0, 3); const correct = ineq(s.a, s.b, s.op, s.c);
  if (new Set([correct, ...pickW.map((w) => w.text)]).size !== 4) throw new GenFail("선지 중복"); return pickW;
};
const rayStim = (rng: Rng) => rng.pick(["The graph on the number line shown is the solution set of an inequality.", "The number line shown displays the solution set of a linear inequality in $x$.", "A solution set is graphed on the number line shown.", "On the number line shown, the solution set of an inequality in $x$ is graphed."]);
const MC_Q = ["Which inequality has the solution set shown on the number line?", "Which of the following inequalities is represented by the graph on the number line shown?", "Which inequality's solution set is graphed on the number line shown?"];
function stmtRay(rng: Rng, s: Lin, variant: string, extraTrace: [string, string][]): Instance {
  const pts = [s.e]; const ax = axisFor(rng, pts); const fig = okFig(nlFig(ax, [ray(s.sol)], { varName: "x" }));
  const correct = ineq(s.a, s.b, s.op, s.c); const wrongs = optWrongs(rng, s);
  return statementInst(rng, {
    stimulus: `${rayStim(rng)} ${rng.pick(NLEADS)}`, question: rng.pick(MC_Q), correct, wrongs, figure: fig, P: {},
    body: `${SEG_JS}${figSegs}const idx = P.options.map((o) => sameSegs(parseSet(o), segs)); const hit = idx.reduce((a, h, i) => (h ? [...a, i] : a), []); if (hit.length !== 1) throw new Error('맞는 부등식이 ' + hit.length + '개'); return hit[0];`,
    trace: [[`그림은 ${f(s.sol.e)} 에서 ${s.sol.dir === "right" ? "오른쪽" : "왼쪽"}으로 ${s.sol.open ? "빈" : "찬"} 점의 반직선이다.`, "Read the graph: the endpoint, its dot, and the direction."], ...extraTrace, [`정답은 ${texPlain(correct)} 이다.`, "Only this option has exactly that solution set."], ["다른 선지는 방향·경계·끝점 중 하나가 그림과 다르다.", "Each other option differs in direction, boundary, or endpoint."]],
    variant,
  });
}
function solveTrace(s: Lin): [string, string][] {
  const o = s.a < 0 ? "부등호의 방향이 바뀐다" : "방향은 그대로이다";
  return [[`${s.a}x ${s.op === "<=" ? "≤" : s.op === ">=" ? "≥" : s.op} ${s.c - s.b} 로 정리한다.`, "Subtract the constant from both sides."], [`${s.a} 로 나누면 ${o}: x ${s.sol.dir === "right" ? (s.sol.open ? ">" : "≥") : s.sol.open ? "<" : "≤"} ${f(s.e)} 이다.`, s.a < 0 ? "Dividing by a negative number reverses the inequality." : "Divide both sides by the positive coefficient."]];
}

export const solveOneVarP = () => defineItem({
  prefix: "li", itemId: "linear_inequalities.solve_one_var.NL.P",
  hard: [
    { op: "repr_shift", structure: "수직선의 반직선(끝점·점의 모양·방향)을 읽고 그 해집합을 갖는 일차부등식을 고름", extra: "그림에서 식으로 옮기는 표현 변환과, 각 선지를 풀어 해집합을 대조하는 2 단계 — medium 은 그림에서 끝점 읽기", concepts: ["수직선", "일차부등식의 해집합", "표현 변환"], sprNo: MC_ONLY_STATEMENT,
      gen(rng) { const s = linScene(rng); return stmtRay(rng, s, "graph_to_inequality_positive", [...solveTrace(s)]); } },
    { op: "constraint_select", structure: "음수 계수 때문에 부등호가 뒤집히는 부등식 중 수직선의 해집합과 같은 것을 고름", extra: "음수로 나눌 때 방향이 바뀌는 규칙을 적용해야 함 — medium 은 양수 계수", concepts: ["수직선", "일차부등식", "음수로 나누기"], sprNo: MC_ONLY_STATEMENT,
      gen(rng) { const s = linScene(rng, { neg: true }); return stmtRay(rng, s, "graph_to_inequality_negative", [...solveTrace(s)]); } },
    { op: "inverse", structure: "수직선에 그려진 해집합의 끝점으로부터 부등식 안의 상수 k 를 역으로 구함", extra: "끝점 = (k - b) ÷ a 를 거꾸로 써서 k 를 구하고, 그림의 방향·점의 모양이 부등호와 맞는지 확인 — medium 은 a = 1", concepts: ["수직선", "일차부등식", "역산"],
      gen(rng) { const s = linScene(rng); const ax = axisFor(rng, [s.e]); const fig = okFig(nlFig(ax, [ray(s.sol)], { varName: "x" })); const k = s.c;
        return gI(rng, { stimulus: `${rng.pick(["The number line shown is the graph of the solution set of", "The number line shown displays the solution set of", "A student graphs, on the number line shown, the solution set of", "The graph on the number line shown represents the solution set of"])} $${linTex(s.a, s.b)} ${TEX[s.op]} k$, where $k$ is a constant. ${rng.pick(NLEADS)}`, question: rng.pick(["What is the value of $k$?", "What is the constant $k$?", "What value of $k$ gives the solution set shown?"]), correct: k, wrongs: [W(s.e, "step_missing", "끝점을 그대로 답했다."), W(k - s.b, "step_missing", "상수항 b 를 더하지 않았다."), W(s.a * s.e - s.b, "sign_error", "상수항의 부호를 반대로 썼다."), W(s.e + s.b, "formula_misuse", "a 를 곱하지 않았다."), W(k + s.a, "other", "끝점이 1 어긋났다.")].filter((w) => w.v >= 0 || true), verificationJs: figJs({ a: s.a, b: s.b, op: s.op }, fig, `${SEG_JS}${figSegs}if (segs.length !== 1) throw new Error('해집합 하나'); const sg = segs[0]; const e = sg.lo === -INF ? sg.hi : sg.lo; const k = P.a * e + P.b; if (!sameSegs([one(P.a, P.b, P.op, k)], segs)) throw new Error('그림이 부등식의 해집합과 다름'); return k;`), trace: [[`그림: ${f(s.e)} 에서 ${s.sol.dir === "right" ? "오른쪽" : "왼쪽"}, ${s.sol.open ? "빈" : "찬"} 점이다.`, "Read the endpoint and direction."], [`부등식을 풀면 x 의 경계값은 (k - ${s.b}) ÷ ${s.a} 이다.`, "Solve the inequality for x."], [`그림의 끝점이 ${f(s.e)} 이므로 (k - ${s.b}) ÷ ${s.a} = ${f(s.e)} 이다.`, "Match the boundary value to the graph."], [`k = ${s.a} × ${f(s.e)} + ${s.b} = ${k} 이다.`, "Solve for k."]], variant: "constant_from_graph" }, fig); } },
    { op: "chain2", structure: "수직선의 해집합에 속하면서 추가 조건 x < m (또는 x > m) 도 만족하는 정수의 개수를 셈", extra: "그림의 끝점·점의 모양(경계 포함 여부)을 읽고 두 조건의 교집합 안의 정수를 세야 함 — medium 은 가장 작은 정수", concepts: ["수직선", "해집합", "정수 세기"],
      gen(rng) { for (let t = 0; t < 60; t++) { const s = linScene(rng); const m = s.sol.dir === "right" ? s.e + rng.int(3, 7) : s.e - rng.int(3, 7); const ax = axisFor(rng, [s.e, m], { pad: [1, 2] }); if (m < ax.axisMin || m > ax.axisMax) continue;
        const fig = okFig(nlFig(ax, [ray(s.sol)], { varName: "x" })); const cond: Op = s.sol.dir === "right" ? "<" : ">"; let cnt = 0; for (let x = Math.min(s.e, m) - 1; x <= Math.max(s.e, m) + 1; x++) { const inSol = s.sol.dir === "right" ? (s.sol.open ? x > s.e : x >= s.e) : s.sol.open ? x < s.e : x <= s.e; const inC = cond === "<" ? x < m : x > m; if (inSol && inC) cnt++; } if (cnt < 2 || cnt > 9) continue;
        return gI(rng, { stimulus: `${rng.pick(["The number line shown is the graph of the solution set of", "The number line shown displays the solution set of", "A student graphs, on the number line shown, the solution set of", "The graph on the number line shown represents the solution set of"])} $${linTex(s.a, s.b)} ${TEX[s.op]} k$, where $k$ is a constant. ${rng.pick(NLEADS)}`, question: rng.pick([`How many integers $x$ are in this solution set and also satisfy $x ${cond} ${m}$?`, `For how many integer values of $x$ do both the inequality and $x ${cond} ${m}$ hold?`, `How many integers in the graphed solution set are ${cond === "<" ? "less" : "greater"} than ${m}?`]), correct: cnt, wrongs: [W(cnt + 1, "condition_ignored", "경계 값을 잘못 포함했다."), W(cnt - 1, "condition_ignored", "경계 값을 잘못 제외했다."), W(Math.abs(m - s.e), "step_missing", "두 값의 차를 답했다."), W(Math.abs(m - s.e) + 1, "step_missing", "양 끝을 모두 포함해 셌다."), W(cnt + 2, "other", "개수가 어긋났다.")], verificationJs: figJs({ cond, m }, fig, `${SEG_JS}${figSegs}let c = 0; for (let x = -60; x <= 60; x++) { if (inSet(segs, x) && (P.cond === '<' ? x < P.m : x > P.m)) c++; } return c;`), trace: [[`그림: ${f(s.e)} 에서 ${s.sol.dir === "right" ? "오른쪽" : "왼쪽"}, ${s.sol.open ? "빈 점(그 값은 불포함)" : "찬 점(그 값 포함)"} 이다.`, "Read the endpoint, its dot, and the direction."], [`해집합: x ${s.sol.dir === "right" ? (s.sol.open ? ">" : "≥") : s.sol.open ? "<" : "≤"} ${f(s.e)} 이다.`, "Write the solution set."], [`추가 조건: x ${cond} ${m} 이다.`, "The extra condition."], [`두 조건을 모두 만족하는 정수는 ${cnt} 개이다.`, "Count the integers in the overlap."]], variant: "count_integers_in_overlap" }, fig); } throw new GenFail("chain2"); } },
  ],
  em: [
    { lv: "easy", name: "least_integer", structure: "수직선의 반직선(오른쪽)에서 해집합에 속하는 가장 작은 정수를 구함", extra: "easy: 끝점과 점의 모양 읽기", concepts: ["수직선", "해집합"],
      gen(rng) { for (let t = 0; t < 60; t++) { const s = linScene(rng); if (s.sol.dir !== "right") continue; const ax = axisFor(rng, [s.e]); const fig = okFig(nlFig(ax, [ray(s.sol)], { varName: "x" })); const ans = s.sol.open ? s.e + 1 : s.e;
        return gI(rng, { stimulus: `${rayStim(rng)} ${rng.pick(NLEADS)}`, question: "What is the least integer in the solution set?", correct: ans, wrongs: [W(s.sol.open ? s.e : s.e + 1, "condition_ignored", "경계 포함 여부를 반대로 읽었다."), W(s.e - 1, "other", "끝점 왼쪽 값을 답했다."), W(s.e + 2, "other", "1 어긋났다.")], verificationJs: figJs({}, fig, `${SEG_JS}${figSegs}for (let x = -60; x <= 60; x++) if (inSet(segs, x)) return x; throw new Error('정수 없음');`), trace: [[`그림은 ${f(s.e)} 에서 오른쪽, ${s.sol.open ? "빈" : "찬"} 점이다.`, "Read the graph."], [s.sol.open ? `${f(s.e)} 은 포함되지 않으므로 가장 작은 정수는 ${s.e + 1} 이다.` : `${f(s.e)} 이 포함되므로 가장 작은 정수는 ${s.e} 이다.`, "Use the dot to decide whether the endpoint counts."]], variant: "least_integer_in_ray" }, fig); } throw new GenFail("easy"); } },
    { lv: "medium", name: "constant_unit_coefficient", structure: "수직선의 해집합으로부터 x + b ◇ k 의 상수 k 를 구함", extra: "medium: 상수 역산(계수 1)", concepts: ["수직선", "일차부등식"],
      gen(rng) { const s = linScene(rng, { a: 1 }); const ax = axisFor(rng, [s.e]); const fig = okFig(nlFig(ax, [ray(s.sol)], { varName: "x" })); const k = s.c;
        return gI(rng, { stimulus: `The number line shown is the graph of the solution set of $${linTex(1, s.b)} ${TEX[s.op]} k$, where $k$ is a constant. ${rng.pick(NLEADS)}`, question: "What is the value of $k$?", correct: k, wrongs: [W(s.e, "step_missing", "끝점을 그대로 답했다."), W(s.e - s.b, "sign_error", "상수항의 부호를 반대로 썼다."), W(k + 1, "other", "1 어긋났다.")], verificationJs: figJs({ b: s.b, op: s.op }, fig, `${SEG_JS}${figSegs}if (segs.length !== 1) throw new Error('해집합 하나'); const sg = segs[0]; const e = sg.lo === -INF ? sg.hi : sg.lo; const k = e + P.b; if (!sameSegs([one(1, P.b, P.op, k)], segs)) throw new Error('그림과 부등식이 다름'); return k;`), trace: [[`그림의 끝점은 ${f(s.e)} 이다.`, "Read the endpoint."], [`x + ${s.b} = k 에 x = ${f(s.e)} 를 대입한다.`, "The boundary satisfies x + b = k."], [`k = ${f(s.e)} + ${s.b} = ${k} 이다.`, "Compute."]], variant: "constant_from_graph_unit" }, fig); } },
  ],
});

// ───────────────────────── solve_one_var.NL.C (그래프 4개 중 고르기) ─────────────────────────
const C_DIAG_JS = `${SEG_JS}
const compOf = (sg) => { if (sg.length === 1 && isFinite(sg[0].lo) && isFinite(sg[0].hi)) { const s = sg[0]; return [{ lo: -INF, hi: s.lo, loOpen: true, hiOpen: !s.loOpen }, { lo: s.hi, hi: INF, loOpen: !s.hiOpen, hiOpen: true }]; } if (sg.length === 2 && sg[0].lo === -INF && sg[1].hi === INF) { return [{ lo: sg[0].hi, hi: sg[1].lo, loOpen: !sg[0].hiOpen, hiOpen: !sg[1].loOpen }]; } if (sg.length === 1 && sg[0].lo === -INF) return [{ lo: sg[0].hi, hi: INF, loOpen: !sg[0].hiOpen, hiOpen: true }]; if (sg.length === 1 && sg[0].hi === INF) return [{ lo: -INF, hi: sg[0].lo, loOpen: true, hiOpen: !sg[0].loOpen }]; return null; };
const ends = (sg) => sg.flatMap((s) => [s.lo, s.hi]).filter(isFinite).sort((a, b) => a - b).join(',');
const opens = (sg) => sg.flatMap((s) => [s.lo, s.hi].map((v, i) => isFinite(v) ? (i === 0 ? s.loOpen : s.hiOpen) : null)).filter((v) => v !== null).join(',');
const shape = (sg) => sg.map((s) => (isFinite(s.lo) ? 'F' : 'I') + (isFinite(s.hi) ? 'F' : 'I')).join('|');
const A = itemSegs(c.items), B = itemSegs(ok.items);
if (sameSegs(A, B)) return null;
const cm = compOf(B); if (cm && sameSegs(cm.sort((p, q) => p.lo - q.lo), A)) return 'NC_complement';
if (shape(A) === shape(B) && ends(A) === ends(B)) return 'NC_boundary';
if (shape(A) === shape(B)) return 'NC_endpoint';
if (ends(A) === ends(B)) return 'NC_and_or';
return null;`;
const C_PRED_JS = (ptJs: string) => `${SEG_JS}${ptJs}; const A = itemSegs(c.items); return sameSegs(A, want);`;
function choicesFrom(rng: Rng, ax: Axis, ok: Item[], cands: { rule: string; items: Item[] | null }[], P: Record<string, number | string>, predJs: string) {
  const okF = okFig(nlFig(ax, ok, { varName: "x" })); const seen = new Set<string>([JSON.stringify(ok)]); const rules = new Set<string>(); const picked: { fig: unknown; rule: string }[] = [];
  const diagFn = new Function("c", "ok", "P", C_DIAG_JS) as (c: unknown, ok: unknown, P: unknown) => string | null; const pred = new Function("c", "i", "P", predJs) as (c: unknown, i: number, P: unknown) => boolean;
  if (!pred(okF, 0, P)) throw new GenFail("정답 그림이 조건을 만족하지 않음");
  for (const w of rng.shuffle(cands)) {
    if (picked.length >= 3) break; if (!w.items) continue;
    const pts = w.items.flatMap((it) => [it.at, it.lo, it.hi]).filter((v): v is number => typeof v === "number"); if (pts.some((v) => v < ax.axisMin || v > ax.axisMax)) continue;
    const key = JSON.stringify(w.items); if (seen.has(key)) continue; const fig = nlFig(ax, w.items, { varName: "x" }); if (pred(fig, 0, P)) continue;
    const r = diagFn(fig, okF, P); if (r !== w.rule || rules.has(r)) continue; seen.add(key); rules.add(r); picked.push({ fig, rule: r });
  }
  if (picked.length < 3) throw new GenFail("수직선 오답 후보 부족");
  return { ...placeChoices(rng, okF, picked), diag: C_DIAG_JS, pred: predJs };
}
const cQuestion = (rng: Rng) => rng.pick(["Which graph shows the solution set of the inequality?", "Which of the following graphs shows all of the solutions to the inequality?", "Which graph is the number line graph of the solution set of the inequality?"]);
const cStim = (rng: Rng, tex: string) => rng.pick([`Consider the inequality ${tex}.`, `The inequality ${tex} is given.`, `Let $x$ satisfy ${tex}.`, `A student solves the inequality ${tex}.`]);
function cRayItem(rng: Rng, s: Lin, kind: string, texOverride?: string, trace?: [string, string][]): Instance {
  const ax = axisFor(rng, [s.e - 2, s.e + 2, s.e], { pad: [1, 2] }); const ok = [ray(s.sol)];
  const o2 = (op: Op): Sol => ({ ...s.sol, dir: op === ">" || op === ">=" ? "right" : "left", open: op === "<" || op === ">" });
  void o2;
  const flipDir: Sol = { ...s.sol, dir: s.sol.dir === "right" ? "left" : "right" }, flipOpen: Sol = { ...s.sol, open: !s.sol.open };
  const cands = [
    { rule: "NC_boundary", items: [ray(flipOpen)] }, { rule: "NC_complement", items: [ray(flipDir)].map((r) => ({ ...r, ...(s.sol.open ? { open: false } : { open: true }) })) },
    { rule: "NC_endpoint", items: [ray({ ...s.sol, e: s.sol.e + (rng.chance(0.5) ? 1 : -1) * rng.int(1, 2) })] }, { rule: "NC_and_or", items: [ray({ ...flipDir })] },
  ];
  const tex = texOverride ?? ineq(s.a, s.b, s.op, s.c); const P = { tex };
  const predJs = C_PRED_JS(`const want = parseSet(P.tex)`);
  const ch = choicesFrom(rng, ax, ok, cands, P, predJs);
  return choiceInst(rng, { stimulus: `${cStim(rng, tex)} ${rng.pick(NLEADS)}`, question: cQuestion(rng), choices: ch.choices, correctIndex: ch.correctIndex, rules: ch.rules, P, predicateJs: ch.pred, diagnoseJs: ch.diag, trace: tr5(trace ?? [...solveTrace(s)], texPlain(ineq(s.a, s.b, s.op, s.c)).replace(/^/, "")), variant: kind, explainKo: "", explainEn: "" });
}
// 방향 반전 후보 정리: NC_complement(방향·경계 모두 반대)와 NC_and_or(방향만 반대) 는 반직선에서 서로 다른 규칙으로 구별된다 — 진단 JS 가 판정한다.
export const solveOneVarC = () => defineItem({
  prefix: "li", itemId: "linear_inequalities.solve_one_var.NL.C",
  hard: [
    { op: "repr_shift", structure: "일차부등식을 풀어 해집합을 구하고 그 수직선 그래프를 4개 중에서 고름(양수 계수)", extra: "부등식 풀이 → 끝점·경계·방향을 그림으로 옮기는 변환 — medium 은 계수 1", concepts: ["일차부등식", "수직선 그래프"], sprNo: "선택지가 수직선 그래프 4개이고 알맞은 그래프를 고르는 것이 문제의 핵심이라 선택지 없이는 성립하지 않는다",
      gen(rng) { return cRayItem(rng, linScene(rng), "inequality_to_graph_positive"); } },
    { op: "constraint_select", structure: "음수 계수로 나누며 부등호가 뒤집히는 부등식의 해집합 그래프를 고름", extra: "음수로 나눌 때 방향이 바뀌는 규칙과 경계 점의 모양을 함께 적용 — medium 은 양수 계수", concepts: ["일차부등식", "음수로 나누기", "수직선 그래프"], sprNo: "선택지가 수직선 그래프 4개이고 알맞은 그래프를 고르는 것이 문제의 핵심이라 선택지 없이는 성립하지 않는다",
      gen(rng) { return cRayItem(rng, linScene(rng, { neg: true }), "inequality_to_graph_negative"); } },
    { op: "chain2", structure: "괄호가 있는 부등식 a(x + p) ◇ c 를 분배해 풀고 해집합 그래프를 고름", extra: "분배법칙 → 이항 → 나누기의 연쇄 후 그림으로 옮김 — medium 은 한 단계", concepts: ["일차부등식", "분배법칙", "수직선 그래프"], sprNo: "선택지가 수직선 그래프 4개이고 알맞은 그래프를 고르는 것이 문제의 핵심이라 선택지 없이는 성립하지 않는다",
      gen(rng) { for (let t = 0; t < 60; t++) { const a = rng.pick([2, 3, 4, -2, -3]); const p = rng.nz(-5, 5); const e = rng.int(-6, 6); const c = a * (e + p); if (c === 0 || Math.abs(c) > 40) continue; const op = rng.pick(OPS); const b = a * p; const s: Lin = { a, b, op, c, e, sol: solve(a, b, op, c) };
        const tex = `$${a === 1 ? "" : a === -1 ? "-" : a}(x ${p > 0 ? "+" : "-"} ${Math.abs(p)}) ${TEX[op]} ${c}$`; return cRayItem(rng, s, "distribute_then_graph", tex, [[`분배하면 ${a}x ${b >= 0 ? "+" : "-"} ${Math.abs(b)} ${op === "<=" ? "≤" : op === ">=" ? "≥" : op} ${c} 이다.`, "Distribute."], ...solveTrace(s)]); } throw new GenFail("chain2"); } },
    { op: "compose_kind", structure: "양변에 x 가 있는 부등식 a x + b ◇ d x + c 를 정리해 해집합 그래프를 고름", extra: "x 항을 한쪽으로 모으고 계수의 부호에 따라 방향을 정해야 함 — medium 은 한 변만", concepts: ["일차부등식", "양변의 변수", "수직선 그래프"], sprNo: "선택지가 수직선 그래프 4개이고 알맞은 그래프를 고르는 것이 문제의 핵심이라 선택지 없이는 성립하지 않는다",
      gen(rng) { for (let t = 0; t < 80; t++) { const a = rng.int(-4, 6), d = rng.int(-3, 4); if (a === d || a === 0 || d === 0) continue; const net = a - d; const b = rng.nz(-8, 8), e = rng.int(-5, 6); const r = net * e + b; if (Math.abs(r) > 30 || r === 0) continue; const op = rng.pick(OPS);
        const rhs = r - b; const s: Lin = { a: net, b: 0, op, c: rhs, e, sol: solve(net, 0, op, rhs) }; const tex2 = `$${linTex(a, b)} ${TEX[op]} ${linTex(d, r)}$`; return cRayItem(rng, s, "both_sides_then_graph", tex2, [[`x 항을 모으면 ${net}x ${SYM(op)} ${rhs} 이다.`, "Collect the x terms on one side."], ...solveTrace(s)]); } throw new GenFail("compose"); } },
  ],
  em: [
    { lv: "easy", name: "unit_coefficient", structure: "x + b ◇ c 의 해집합 그래프를 4개 중에서 고름", extra: "easy: 한 단계", concepts: ["일차부등식", "수직선 그래프"],
      gen(rng) { return cRayItem(rng, linScene(rng, { a: 1 }), "inequality_to_graph_unit", undefined, [[`양변에서 상수항을 옮겨 x 의 경계를 구한다.`, "Isolate x."]]); } },
    { lv: "medium", name: "positive_two_step", structure: "a x + b ◇ c (a > 0) 의 해집합 그래프를 고름", extra: "medium: 두 단계", concepts: ["일차부등식", "수직선 그래프"],
      gen(rng) { return cRayItem(rng, linScene(rng), "inequality_to_graph_two_step"); } },
  ],
});

// ───────────────────────── compound_inequality_number_line ─────────────────────────
type Cmp = { a: number; b: number; opLo: "<" | "<="; opHi: "<" | "<="; p: number; q: number; lo: number; hi: number; loOpen: boolean; hiOpen: boolean; item: Item; tex: string };
function cmpScene(rng: Rng, o: { neg?: boolean; unit?: boolean } = {}): Cmp {
  for (let t = 0; t < 80; t++) {
    const a = o.unit ? 1 : o.neg ? -rng.int(2, 4) : rng.int(2, 4); const b = rng.nz(-8, 8); const lo = rng.int(-6, 4); const hi = lo + rng.int(2, 8); if (hi > 8) continue;
    const opLo = rng.pick(["<", "<="] as const), opHi = rng.pick(["<", "<="] as const);
    const p = a > 0 ? a * lo + b : a * hi + b, q = a > 0 ? a * hi + b : a * lo + b; if (Math.abs(p) > 40 || Math.abs(q) > 40) continue;
    const loOpen = a > 0 ? opLo === "<" : opHi === "<", hiOpen = a > 0 ? opHi === "<" : opLo === "<";
    const item = { kind: "interval", lo, hi, ...(loOpen ? { loOpen: true } : {}), ...(hiOpen ? { hiOpen: true } : {}) };
    return { a, b, opLo, opHi, p, q, lo, hi, loOpen, hiOpen, item, tex: `$${p} ${TEX[opLo]} ${linTex(a, b)} ${TEX[opHi]} ${q}$` };
  }
  throw new GenFail("복합부등식 장면");
}
type Orc = { a: number; b: number; opL: Op; opR: Op; p: number; q: number; e1: number; e2: number; items: Item[]; tex: string };
function orScene(rng: Rng, o: { neg?: boolean; unit?: boolean } = {}): Orc {
  for (let t = 0; t < 80; t++) {
    const a = o.unit ? 1 : o.neg ? -rng.int(2, 4) : rng.int(2, 4); const b = rng.nz(-8, 8); const e1 = rng.int(-6, 3); const e2 = e1 + rng.int(2, 7); if (e2 > 7) continue;
    // a>0: a x + b < p or a x + b > q (p = a e1 + b, q = a e2 + b). a<0 이면 큰 쪽 값이 왼쪽 반직선이다.
    const opL = rng.pick(["<", "<="] as Op[]), opR = rng.pick([">", ">="] as Op[]);
    const pA = a * e1 + b, qA = a * e2 + b; const first = a > 0 ? { c: pA, op: opL } : { c: qA, op: opR }; const second = a > 0 ? { c: qA, op: opR } : { c: pA, op: opL };
    if (Math.abs(pA) > 40 || Math.abs(qA) > 40) continue;
    const s1 = solve(a, b, first.op, first.c), s2 = solve(a, b, second.op, second.c); const items = [ray(s1), ray(s2)].sort((u, v) => (u.at as number) - (v.at as number));
    return { a, b, opL: first.op, opR: second.op, p: first.c, q: second.c, e1, e2, items, tex: `$${linTex(a, b)} ${TEX[first.op]} ${first.c}$ or $${linTex(a, b)} ${TEX[second.op]} ${second.c}$` };
  }
  throw new GenFail("or 복합부등식 장면");
}
const cmpIntro = (rng: Rng) => rng.pick(["The number line shown is the graph of the solution set of a compound inequality.", "A compound inequality in $x$ has the solution set graphed on the number line shown.", "The solution set of a compound inequality is graphed on the number line shown.", "On the number line shown, the graph of a compound inequality's solution set is displayed."]);
const countInts = (it: Item, lo = -80, hi = 80) => { let n = 0; for (let x = lo; x <= hi; x++) { const i = it as { lo: number; hi: number; loOpen?: boolean; hiOpen?: boolean }; if ((i.loOpen ? x > i.lo : x >= i.lo) && (i.hiOpen ? x < i.hi : x <= i.hi)) n++; } return n; };
const SYM = (op: string) => (op === "<=" ? "≤" : op === ">=" ? "≥" : op);
const cmpTrace = (c: Cmp): [string, string][] => [[`그림은 ${c.lo}(${c.loOpen ? "빈 점" : "찬 점"}) 에서 ${c.hi}(${c.hiOpen ? "빈 점" : "찬 점"}) 까지의 구간이다.`, "Read the endpoints and their dots."], [`해집합: ${c.lo} ${c.loOpen ? "<" : "≤"} x ${c.hiOpen ? "<" : "≤"} ${c.hi} 이다.`, "Write the solution set as a compound inequality."]];
const pm = (a: Cmp, kind: "and") => ({ kind, a: a.a });
void pm;

export const compoundP = () => defineItem({
  prefix: "li", itemId: "linear_inequalities.compound_inequality_number_line.NL.P",
  hard: [
    { op: "inverse", structure: "수직선의 구간으로부터 복합부등식 p ◇ ax + b ◇ q 의 상수 p, q 를 역으로 구해 p + q 를 구함", extra: "양 끝 값을 식에 대입해 상수를 역산하고, 점의 모양이 부등호와 맞는지 확인 — medium 은 구간 읽기", concepts: ["수직선", "복합부등식", "역산"],
      gen(rng) { const c = cmpScene(rng, { neg: rng.chance(0.3) }); const ax = axisFor(rng, [c.lo, c.hi]); const fig = okFig(nlFig(ax, [c.item], { varName: "x" })); const sum = c.p + c.q;
        return gI(rng, { stimulus: `${cmpIntro(rng)} The inequality is $p ${TEX[c.opLo]} ${linTex(c.a, c.b)} ${TEX[c.opHi]} q$, where $p$ and $q$ are constants. ${rng.pick(NLEADS)}`, question: rng.pick(["What is the value of $p + q$?", "What is the sum of the constants $p$ and $q$?"]), correct: sum, wrongs: [W(c.lo + c.hi, "step_missing", "끝점의 합을 그대로 답했다."), W(c.q - c.p, "scope", "차를 구했다."), W(c.a * (c.lo + c.hi), "step_missing", "상수항 b 를 더하지 않았다."), W(sum + c.b, "other", "상수항을 한 번 더 더했다."), W(c.p, "scope", "한 상수만 답했다.")], verificationJs: figJs({ a: c.a, b: c.b, opLo: c.opLo, opHi: c.opHi }, fig, `if (FIGURE.items.length !== 1 || FIGURE.items[0].kind !== 'interval') throw new Error('구간 하나'); const it = FIGURE.items[0]; const lo = it.lo, hi = it.hi; const sl = (o) => o === '<'; if (P.a > 0) { if (!!it.loOpen !== sl(P.opLo) || !!it.hiOpen !== sl(P.opHi)) throw new Error('점의 모양이 부등호와 다름'); return (P.a * lo + P.b) + (P.a * hi + P.b); } if (!!it.loOpen !== sl(P.opHi) || !!it.hiOpen !== sl(P.opLo)) throw new Error('점의 모양이 부등호와 다름'); return (P.a * hi + P.b) + (P.a * lo + P.b);`), trace: [...cmpTrace(c), [`${c.a > 0 ? "작은 끝" : "큰 끝"}값 ${c.a > 0 ? c.lo : c.hi} 을 ${linTex(c.a, c.b)} 에 대입하면 p = ${c.p} 이다.`, "Substitute the endpoint to find p."], [`${c.a > 0 ? "큰 끝" : "작은 끝"}값 ${c.a > 0 ? c.hi : c.lo} 을 대입하면 q = ${c.q} 이다.`, "Substitute the other endpoint to find q."]], variant: "constants_from_interval" }, fig); } },
    { op: "chain2", structure: "수직선의 구간(양 끝의 점의 모양 포함)에 속하는 정수의 개수를 셈", extra: "빈 점·찬 점에 따라 끝 값을 넣고 빼야 함 — medium 은 가장 작은 정수", concepts: ["수직선", "복합부등식", "정수 세기"],
      gen(rng) { const c = cmpScene(rng); const ax = axisFor(rng, [c.lo, c.hi]); const fig = okFig(nlFig(ax, [c.item], { varName: "x" })); const n = countInts(c.item);
        return gI(rng, { stimulus: `${cmpIntro(rng)} ${rng.pick(NLEADS)}`, question: rng.pick(["How many integers are in the solution set?", "How many integer values of $x$ satisfy the compound inequality?"]), correct: n, wrongs: [W(c.hi - c.lo, "condition_ignored", "끝 값의 차를 답했다."), W(c.hi - c.lo + 1, "condition_ignored", "양 끝을 모두 포함해 셌다."), W(c.hi - c.lo - 1, "condition_ignored", "양 끝을 모두 제외했다."), W(n + 1, "other", "경계를 잘못 처리했다."), W(c.hi - c.lo + 2, "other", "개수가 어긋났다.")], verificationJs: figJs({}, fig, `if (FIGURE.items.length !== 1 || FIGURE.items[0].kind !== 'interval') throw new Error('구간 하나'); const it = FIGURE.items[0]; let n = 0; for (let x = -80; x <= 80; x++) if ((it.loOpen ? x > it.lo : x >= it.lo) && (it.hiOpen ? x < it.hi : x <= it.hi)) n++; return n;`), trace: [...cmpTrace(c), [`${c.lo} 부터 ${c.hi} 까지의 정수는 ${c.hi - c.lo + 1} 개이다.`, "Count the integers from the lower to the upper endpoint."], [`빈 점인 끝은 제외한다: ${(c.loOpen ? 1 : 0) + (c.hiOpen ? 1 : 0)} 개 제외.`, "Remove each endpoint with an open dot."]], variant: "count_integers_in_interval" }, fig); } },
    { op: "constraint_select", structure: "수직선의 구간을 해집합으로 갖는 복합부등식을 4개의 문장에서 고름", extra: "각 선지의 계수·상수·부등호로 해집합을 계산해 그림과 대조 — medium 은 구간 읽기", concepts: ["수직선", "복합부등식", "표현 변환"], sprNo: MC_ONLY_STATEMENT,
      gen(rng) { const c = cmpScene(rng); const ax = axisFor(rng, [c.lo, c.hi]); const fig = okFig(nlFig(ax, [c.item], { varName: "x" }));
        const mk = (p: number, opLo: string, opHi: string, q: number, a = c.a, b = c.b) => `$${p} ${TEX[opLo as Op]} ${linTex(a, b)} ${TEX[opHi as Op]} ${q}$`;
        const tg = (o: string) => (o === "<" ? "<=" : "<");
        const wrongs = rng.shuffle([{ text: mk(c.a > 0 ? c.lo : c.hi, c.opLo, c.opHi, c.a > 0 ? c.hi : c.lo), reason: "끝 값을 식에 대입하지 않고 그대로 양 끝에 썼다." }, c.a > 0 ? { text: mk(c.p, tg(c.opLo), c.opHi, c.q), reason: "아래 끝의 경계 포함 여부를 반대로 두었다." } : { text: mk(c.p, c.opLo, tg(c.opHi), c.q), reason: "한 끝의 경계 포함 여부를 반대로 두었다." }, { text: `$${linTex(c.a, c.b)} ${TEX[c.a > 0 ? ((c.opLo === "<" ? "<" : "<=") as Op) : ((c.opHi === "<" ? "<" : "<=") as Op)]} ${c.p}$ or $${linTex(c.a, c.b)} ${TEX[c.a > 0 ? ((c.opHi === "<" ? ">" : ">=") as Op) : ((c.opLo === "<" ? ">" : ">=") as Op)]} ${c.q}$`, reason: "'그리고' 를 '또는' 으로 잘못 옮겼다." }, { text: mk(c.p + c.a, c.opLo, c.opHi, c.q), reason: "한 끝 값이 1 어긋났다." }, { text: mk(c.p, c.opLo, c.opHi, c.q - c.a), reason: "한 끝 값이 1 어긋났다." }]).slice(0, 3);
        return statementInst(rng, { stimulus: `${cmpIntro(rng)} ${rng.pick(NLEADS)}`, question: rng.pick(["Which compound inequality has the solution set shown on the number line?", "Which of the following inequalities is graphed on the number line shown?"]), correct: mk(c.p, c.opLo, c.opHi, c.q), wrongs, figure: fig, P: {}, body: `${SEG_JS}${figSegs}const idx = P.options.map((o) => sameSegs(parseSet(o), segs)); const hit = idx.reduce((a, h, i) => (h ? [...a, i] : a), []); if (hit.length !== 1) throw new Error('맞는 부등식이 ' + hit.length + '개'); return hit[0];`, trace: tr5([...cmpTrace(c), [`각 선지를 풀면 ${linTex(c.a, c.b)} 의 값 범위에서 x 의 범위가 나온다.`, "Solve each option for x."], [`${c.a > 0 ? "" : "음수 계수이므로 부등호 방향이 바뀐다. "}정답은 ${c.p} ${SYM(c.opLo)} ${linTex(c.a, c.b)} ${SYM(c.opHi)} ${c.q} 이다.`, "Only this option has exactly that solution set."]], "해당 선지") ,
          variant: "graph_to_compound_inequality" }); } },
    { op: "compare_scenarios", structure: "'또는' 복합부등식의 수직선(두 반직선)에서 해가 아닌 정수의 개수를 -8 ~ 8 범위에서 셈", extra: "두 반직선 사이 빈틈의 정수를 점의 모양에 따라 세야 함 — medium 은 구간의 정수 개수", concepts: ["수직선", "복합부등식(또는)", "정수 세기"],
      gen(rng) { const c = orScene(rng); const ax = { axisMin: -8, axisMax: 8 }; const fig = okFig(nlFig(ax, c.items, { varName: "x" })); const segsOf = c.items as { kind: string; at: number; dir: string; open?: boolean }[]; let n = 0; for (let x = -8; x <= 8; x++) { const inS = segsOf.some((r) => (r.dir === "right" ? (r.open ? x > r.at : x >= r.at) : r.open ? x < r.at : x <= r.at)); if (!inS) n++; } if (n < 1 || n > 12) throw new GenFail("n");
        return gI(rng, { stimulus: `${cmpIntro(rng)} ${rng.pick(NLEADS)}`, question: rng.pick(["How many integers from $-8$ to $8$, inclusive, are not solutions of the compound inequality?", "Among the integers from $-8$ to $8$, inclusive, how many do not satisfy the compound inequality?", "How many integers between $-8$ and $8$, inclusive, are left out of the solution set?"]), correct: n, wrongs: [W(Math.abs(c.e2 - c.e1) + 1, "condition_ignored", "양 끝을 모두 포함해 셌다."), W(Math.abs(c.e2 - c.e1) - 1, "condition_ignored", "양 끝을 모두 제외했다."), W(17 - n, "opposite", "해인 정수의 개수를 답했다."), W(n + 1, "other", "경계를 잘못 처리했다."), W(Math.abs(c.e2 - c.e1), "step_missing", "끝점의 차를 답했다.")], verificationJs: figJs({ lo: -8, hi: 8 }, fig, `${SEG_JS}${figSegs}let n = 0; for (let x = P.lo; x <= P.hi; x++) if (!inSet(segs, x)) n++; return n;`), trace: [[`그림은 두 반직선이다: 왼쪽 ${f(segsOf[0].at)}(${segsOf[0].open ? "빈 점" : "찬 점"}), 오른쪽 ${f(segsOf[1].at)}(${segsOf[1].open ? "빈 점" : "찬 점"}).`, "Read the two rays."], [`해가 아닌 수는 두 끝점 사이의 구간이다.`, "The non-solutions lie between the two endpoints."], [`${segsOf[0].at} 와 ${segsOf[1].at} 사이의 정수를 센다.`, "Count the integers in the gap."], [`빈 점인 끝은 해가 아니므로 포함해 센다.`, "An open dot means that endpoint is not a solution."]], variant: "count_non_solutions_or" }, fig); } },
  ],
  em: [
    { lv: "easy", name: "least_integer", structure: "수직선의 구간에서 해집합에 속하는 가장 작은 정수를 구함", extra: "easy: 아래 끝의 점의 모양", concepts: ["수직선", "복합부등식"],
      gen(rng) { const c = cmpScene(rng); const ax = axisFor(rng, [c.lo, c.hi]); const fig = okFig(nlFig(ax, [c.item], { varName: "x" })); const ans = c.loOpen ? c.lo + 1 : c.lo;
        return gI(rng, { stimulus: `${cmpIntro(rng)} ${rng.pick(NLEADS)}`, question: "What is the least integer in the solution set?", correct: ans, wrongs: [W(c.loOpen ? c.lo : c.lo + 1, "condition_ignored", "경계 포함 여부를 반대로 읽었다."), W(c.lo - 1, "other", "끝 왼쪽 값을 답했다."), W(c.hi, "axis_misread", "큰 끝을 답했다.")], verificationJs: figJs({}, fig, `${SEG_JS}${figSegs}for (let x = -80; x <= 80; x++) if (inSet(segs, x)) return x; throw new Error('정수 없음');`), trace: [...cmpTrace(c), [c.loOpen ? `아래 끝 ${c.lo} 은 빈 점이므로 가장 작은 정수는 ${c.lo + 1} 이다.` : `아래 끝 ${c.lo} 이 찬 점이므로 가장 작은 정수는 ${c.lo} 이다.`, "Use the dot at the lower end."]], variant: "least_integer_in_interval" }, fig); } },
    { lv: "medium", name: "greatest_integer", structure: "수직선의 구간에서 해집합에 속하는 가장 큰 정수를 구함", extra: "medium: 위 끝의 점의 모양 + 구간 읽기", concepts: ["수직선", "복합부등식"],
      gen(rng) { const c = cmpScene(rng); const ax = axisFor(rng, [c.lo, c.hi]); const fig = okFig(nlFig(ax, [c.item], { varName: "x" })); const ans = c.hiOpen ? c.hi - 1 : c.hi;
        return gI(rng, { stimulus: `${cmpIntro(rng)} ${rng.pick(NLEADS)}`, question: "What is the greatest integer in the solution set?", correct: ans, wrongs: [W(c.hiOpen ? c.hi : c.hi - 1, "condition_ignored", "경계 포함 여부를 반대로 읽었다."), W(c.hi + 1, "other", "끝 오른쪽 값을 답했다."), W(c.lo, "axis_misread", "작은 끝을 답했다.")], verificationJs: figJs({}, fig, `${SEG_JS}${figSegs}for (let x = 80; x >= -80; x--) if (inSet(segs, x)) return x; throw new Error('정수 없음');`), trace: [...cmpTrace(c), [c.hiOpen ? `위 끝 ${c.hi} 은 빈 점이므로 가장 큰 정수는 ${c.hi - 1} 이다.` : `위 끝 ${c.hi} 이 찬 점이므로 가장 큰 정수는 ${c.hi} 이다.`, "Use the dot at the upper end."]], variant: "greatest_integer_in_interval" }, fig); } },
  ],
});

// ───────────────────────── compound NL.C ─────────────────────────
const CMP_C_SPR = "선택지가 수직선 그래프 4개이고 알맞은 그래프를 고르는 것이 문제의 핵심이라 선택지 없이는 성립하지 않는다";
function cmpChoice(rng: Rng, ok: Item[], tex: string, kind: string, trace: [string, string][], min = 5): Instance {
  const pts = ok.flatMap((it) => [it.at, it.lo, it.hi]).filter((v): v is number => typeof v === "number"); const ax = axisFor(rng, [Math.min(...pts) - 1, Math.max(...pts) + 1], { pad: [1, 2] });
  const okSegs = ok; const isInterval = ok.length === 1 && ok[0].kind === "interval"; const it0 = ok[0] as { lo: number; hi: number; loOpen?: boolean; hiOpen?: boolean };
  const cands: { rule: string; items: Item[] | null }[] = [];
  const mv = (n: number) => n + (rng.chance(0.5) ? 1 : -1);
  if (isInterval) {
    cands.push({ rule: "NC_complement", items: [{ kind: "ray", at: it0.lo, dir: "left", ...(it0.loOpen ? {} : { open: true }) }, { kind: "ray", at: it0.hi, dir: "right", ...(it0.hiOpen ? {} : { open: true }) }] });
    cands.push({ rule: "NC_and_or", items: [{ kind: "ray", at: it0.lo, dir: "left", ...(it0.loOpen ? { open: true } : {}) }, { kind: "ray", at: it0.hi, dir: "right", ...(it0.hiOpen ? { open: true } : {}) }] });
    cands.push({ rule: "NC_boundary", items: [{ kind: "interval", lo: it0.lo, hi: it0.hi, ...(it0.loOpen ? {} : { loOpen: true }), ...(it0.hiOpen ? { hiOpen: true } : {}) }] });
    cands.push({ rule: "NC_boundary", items: [{ kind: "interval", lo: it0.lo, hi: it0.hi, ...(it0.loOpen ? { loOpen: true } : {}), ...(it0.hiOpen ? {} : { hiOpen: true }) }] });
    const nl = mv(it0.lo); cands.push({ rule: "NC_endpoint", items: [{ kind: "interval", lo: Math.min(nl, it0.hi - 1), hi: it0.hi, ...(it0.loOpen ? { loOpen: true } : {}), ...(it0.hiOpen ? { hiOpen: true } : {}) }] });
    const nh = mv(it0.hi); cands.push({ rule: "NC_endpoint", items: [{ kind: "interval", lo: it0.lo, hi: Math.max(nh, it0.lo + 1), ...(it0.loOpen ? { loOpen: true } : {}), ...(it0.hiOpen ? { hiOpen: true } : {}) }] });
  } else {
    const L = ok[0] as { at: number; dir: string; open?: boolean }, R = ok[1] as { at: number; dir: string; open?: boolean };
    cands.push({ rule: "NC_complement", items: [{ kind: "interval", lo: L.at, hi: R.at, ...(L.open ? {} : { loOpen: true }), ...(R.open ? {} : { hiOpen: true }) }] });
    cands.push({ rule: "NC_and_or", items: [{ kind: "interval", lo: L.at, hi: R.at, ...(L.open ? { loOpen: true } : {}), ...(R.open ? { hiOpen: true } : {}) }] });
    cands.push({ rule: "NC_boundary", items: [{ ...L, ...(L.open ? { open: undefined } : { open: true }) }, { ...R }].map((x) => JSON.parse(JSON.stringify(x))) });
    cands.push({ rule: "NC_boundary", items: [{ ...L }, { ...R, ...(R.open ? { open: undefined } : { open: true }) }].map((x) => JSON.parse(JSON.stringify(x))) });
    cands.push({ rule: "NC_endpoint", items: [{ ...L, at: Math.min(mv(L.at), R.at - 1) }, { ...R }] }); cands.push({ rule: "NC_endpoint", items: [{ ...L }, { ...R, at: Math.max(mv(R.at), L.at + 1) }] });
  }
  void okSegs;
  const P = { tex };
  const ch = choicesFrom(rng, ax, ok, cands, P, `${SEG_JS}const want = parseSet(P.tex); const A = itemSegs(c.items); return sameSegs(A, want);`);
  return choiceInst(rng, { stimulus: `${cStim(rng, tex)} ${rng.pick(NLEADS)}`, question: cQuestion(rng).replace("the inequality", "the compound inequality"), choices: ch.choices, correctIndex: ch.correctIndex, rules: ch.rules, P, predicateJs: ch.pred, diagnoseJs: ch.diag, trace: tr5(trace, texPlain(tex), min), variant: kind, explainKo: "", explainEn: "" });
}
export const compoundC = () => defineItem({
  prefix: "li", itemId: "linear_inequalities.compound_inequality_number_line.NL.C",
  hard: [
    { op: "repr_shift", structure: "p ◇ x + b ◇ q 형태의 복합부등식을 풀어 구간 그래프를 4개 중에서 고름", extra: "세 부분에서 b 를 빼는 풀이와 양 끝 점의 모양을 함께 옮김 — medium 은 한쪽만", concepts: ["복합부등식", "수직선 그래프"], sprNo: CMP_C_SPR,
      gen(rng) { const c = cmpScene(rng, { unit: true }); return cmpChoice(rng, [c.item], c.tex, "compound_to_graph_unit", [[`세 부분에서 ${c.b} 를 ${c.b > 0 ? "빼" : "더하"}면 ${c.lo} ${c.loOpen ? "<" : "≤"} x ${c.hiOpen ? "<" : "≤"} ${c.hi} 이다.`, "Isolate x in all three parts."], [`${c.lo}${c.loOpen ? "(빈 점)" : "(찬 점)"} 에서 ${c.hi}${c.hiOpen ? "(빈 점)" : "(찬 점)"} 까지의 구간이다.`, "Graph it."]]); } },
    { op: "constraint_select", structure: "p ◇ ax + b ◇ q (a > 1) 를 풀어 구간 그래프를 고름", extra: "세 부분에 같은 연산(빼기·나누기)을 하고 점의 모양을 정함 — medium 은 계수 1", concepts: ["복합부등식", "수직선 그래프"], sprNo: CMP_C_SPR,
      gen(rng) { const c = cmpScene(rng); return cmpChoice(rng, [c.item], c.tex, "compound_to_graph_positive", [[`세 부분에서 ${c.b} 를 ${c.b > 0 ? "빼" : "더하"}고 ${c.a} 로 나누면 ${c.lo} ${c.loOpen ? "<" : "≤"} x ${c.hiOpen ? "<" : "≤"} ${c.hi} 이다.`, "Isolate x in all three parts."], [`${c.lo}${c.loOpen ? "(빈 점)" : "(찬 점)"} 에서 ${c.hi}${c.hiOpen ? "(빈 점)" : "(찬 점)"} 까지의 구간이다.`, "Graph it."]]); } },
    { op: "chain2", structure: "'또는' 복합부등식 ax + b ◇ p 또는 ax + b ◇ q 를 풀어 두 반직선 그래프를 고름", extra: "두 부등식을 각각 풀어 방향이 서로 반대인 두 반직선으로 옮김 — medium 은 부등식 하나", concepts: ["복합부등식(또는)", "수직선 그래프"], sprNo: CMP_C_SPR,
      gen(rng) { const c = orScene(rng); return cmpChoice(rng, c.items, c.tex, "or_compound_to_graph", [[`각 부등식을 풀면 x ${c.items[0].dir === "left" ? "<" : ">"} … 와 x ${c.items[1].dir === "left" ? "<" : ">"} … 두 조건이 나온다.`, "Solve each inequality separately."], [`그래프는 ${c.items[0].at}(${c.items[0].open ? "빈 점" : "찬 점"}) 에서 왼쪽, ${c.items[1].at}(${c.items[1].open ? "빈 점" : "찬 점"}) 에서 오른쪽으로 뻗는 두 반직선이다.`, "Graph the two rays."]]); } },
    { op: "compose_kind", structure: "음수 계수의 복합부등식 p ◇ -ax + b ◇ q 를 풀어(부등호 방향이 바뀜) 구간 그래프를 고름", extra: "음수로 나누면 세 부분의 부등호가 모두 바뀌고 두 끝의 점의 모양이 서로 자리를 바꿈 — medium 은 양수 계수", concepts: ["복합부등식", "음수로 나누기", "수직선 그래프"], sprNo: CMP_C_SPR,
      gen(rng) { const c = cmpScene(rng, { neg: true }); return cmpChoice(rng, [c.item], c.tex, "negative_compound_to_graph", [[`세 부분에서 ${c.b} 를 ${c.b > 0 ? "빼" : "더하"}면 ${c.p - c.b} ${c.opLo === "<" ? "<" : "≤"} ${c.a}x ${c.opHi === "<" ? "<" : "≤"} ${c.q - c.b} 이다.`, "Subtract the constant from all three parts."], [`${c.a} 로 나누면 부등호가 모두 바뀌어 ${c.lo} ${c.loOpen ? "<" : "≤"} x ${c.hiOpen ? "<" : "≤"} ${c.hi} 이다.`, "Dividing by a negative number reverses the inequalities."]]); } },
  ],
  em: [
    { lv: "easy", name: "unit_two_part", structure: "x + b ◇ q 형태의 복합부등식(계수 1)의 구간 그래프를 고름", extra: "easy: 한 번의 연산", concepts: ["복합부등식", "수직선 그래프"],
      gen(rng) { const c = cmpScene(rng, { unit: true }); return cmpChoice(rng, [c.item], c.tex, "compound_unit_graph", [[`세 부분에서 ${c.b} 를 정리하면 ${c.lo} ${c.loOpen ? "<" : "≤"} x ${c.hiOpen ? "<" : "≤"} ${c.hi} 이다.`, "Isolate x."]], 2); } },
    { lv: "medium", name: "positive_three_part", structure: "p ◇ ax + b ◇ q 의 구간 그래프를 고름", extra: "medium: 두 연산", concepts: ["복합부등식", "수직선 그래프"],
      gen(rng) { const c = cmpScene(rng); return cmpChoice(rng, [c.item], c.tex, "compound_three_part_graph", [[`${c.lo} ${c.loOpen ? "<" : "≤"} x ${c.hiOpen ? "<" : "≤"} ${c.hi} 로 풀린다.`, "Solve for x."], [`양 끝의 점의 모양을 그린다.`, "Draw the dots."]], 3); } },
  ],
});

// ───────────────────────── inference_margin_error (그럴듯한 구간 수직선) ─────────────────────────
type Inf = { sv: (typeof SURVEYS)[number]; n: number; yes: number; p: number; m: number; lo: number; hi: number; ax: Axis; fig: ReturnType<typeof nlFig> };
function infScene(rng: Rng, o: { mLo?: number; mHi?: number; widen?: boolean } = {}): Inf {
  for (let t = 0; t < 60; t++) {
    const sv = rng.pick(SURVEYS); const { n, yes, p } = sampleCounts(rng, { pLo: 22, pHi: 78, nPool: [100, 200, 250, 300, 400, 500] }); const m = rng.int(o.mLo ?? 2, o.mHi ?? 5);
    const lo = p - m, hi = p + m; const w = o.widen ? 2 : 1; const ax: Axis = { axisMin: p - w * m - rng.int(2, 3), axisMax: p + w * m + rng.int(2, 3) }; if (ax.axisMax - ax.axisMin > 20) continue;
    const fig = nlFig(ax, [{ kind: "interval", lo, hi }], { title: `Plausible values for the percent of all ${sv.ent}`.slice(0, 70), varName: "%" });
    if (renderNumberLine(fig as never).issues.length) continue; return { sv, n, yes, p, m, lo, hi, ax, fig };
  }
  throw new GenFail("추론 수직선 장면");
}
const lcw = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const infIntro = (rng: Rng, s: Inf, withSample = false) => rng.pick([
  `A random sample of ${s.sv.ent} was asked whether they ${s.sv.ev}. The number line shown gives the plausible interval for the percent of all ${lcw(s.sv.popLbl)} who ${s.sv.ev}.`,
  `Researchers surveyed a random sample of ${s.sv.ent} about whether they ${s.sv.ev}. The interval graphed on the number line shown contains the plausible values for the percent of all ${lcw(s.sv.popLbl)} who ${s.sv.ev}.`,
  `In a survey about ${s.sv.topic}, a random sample of ${s.sv.ent} was selected from all ${lcw(s.sv.popLbl)}. The plausible interval for the percent of all of them who ${s.sv.ev} is shown on the number line.`,
  `The number line shown displays a plausible interval, based on a random sample, for the percent of all ${lcw(s.sv.popLbl)} who ${s.sv.ev}.`,
]) + (withSample ? ` The sample size was ${s.n}.` : "") + " The interval is the sample percent plus or minus the margin of error.";
const infRead = (s: Inf): [string, string] => [`수직선에서 구간의 두 끝을 읽는다: ${s.lo}% ~ ${s.hi}%.`, "Read the two ends of the interval."];
const INF_JS = "if (!FIGURE.items || FIGURE.items.length !== 1 || FIGURE.items[0].kind !== 'interval') throw new Error('구간 하나'); const lo = FIGURE.items[0].lo, hi = FIGURE.items[0].hi; const p = (lo + hi) / 2, m = (hi - lo) / 2;\n";
const infI = (rng: Rng, s: Inf, d: { stim?: string; withSample?: boolean; question: string | string[]; correct: number; wrongs: ReturnType<typeof W>[]; js: string; P?: Record<string, number | string>; trace: [string, string][]; variant: string }) =>
  gI(rng, { stimulus: `${infIntro(rng, s, d.withSample)}${d.stim ? ` ${d.stim}` : ""} ${rng.pick(NLEADS)}`, question: Array.isArray(d.question) ? rng.pick(d.question) : d.question, correct: d.correct, wrongs: d.wrongs.filter((w) => w.v >= 0 && Math.abs(w.v - d.correct) > 1e-9), verificationJs: figJs(d.P ?? {}, s.fig, `${INF_JS}${d.js}`), trace: d.trace, variant: d.variant }, s.fig);
const POPS = [500, 600, 700, 800, 900];

export const populationEstimateP = () => defineItem({
  prefix: "ime", itemId: "inference_margin_error.population_estimate.NL.P",
  hard: [
    { op: "chain2", structure: "수직선의 그럴듯한 구간(%)의 위 끝을 모집단 크기에 적용해 가능한 최대 인원을 구함", extra: "구간 끝 읽기 → 퍼센트를 인원으로 환산하는 연쇄(표본 크기가 아니라 모집단 크기를 써야 함) — medium 은 아래 끝", concepts: ["그럴듯한 구간", "수직선", "모집단 추정"],
      gen(rng) { const s = infScene(rng); const N = rng.pick(POPS); const ans = (N * s.hi) / 100;
        return infI(rng, s, { stim: `There are ${N} ${s.sv.ent} in the population.`, question: [`According to the interval, what is the greatest plausible number of the ${N} ${s.sv.ent} who ${s.sv.ev}?`, `Based on the number line, what is the largest plausible number of ${s.sv.ent} in the population who ${s.sv.ev}?`], correct: ans, wrongs: [W((N * s.lo) / 100, "opposite", "아래 끝을 썼다."), W((N * s.p) / 100, "step_missing", "구간의 중심을 썼다."), W((s.n * s.hi) / 100, "scope", "표본 크기로 환산했다."), W(s.hi, "unit_error", "퍼센트를 답했다."), W((N * (s.hi + s.m)) / 100, "formula_misuse", "오차범위를 두 번 더했다.")], P: { N }, js: `return P.N * hi / 100;`, trace: [infRead(s), [`위 끝은 ${s.hi}% 이다.`, "The upper end is the greatest plausible percent."], [`모집단은 ${N} 명이다.`, "Use the population size."], [`${N} × ${s.hi / 100} = ${f(ans)} 이다.`, "Convert the percent to a count."]], variant: "greatest_plausible_count" }); } },
    { op: "inverse", structure: "수직선의 구간이 '표본 % ± 오차범위' 임을 이용해 표본에서 '예' 라고 답한 사람 수를 역으로 구함", extra: "구간의 중심이 표본 % 임을 거꾸로 써서 표본 크기로 인원을 복원 — medium 은 표본 %", concepts: ["그럴듯한 구간", "수직선", "역산"],
      gen(rng) { const s = infScene(rng); const ans = (s.n * s.p) / 100;
        return infI(rng, s, { withSample: true, question: [`How many of the ${s.sv.ent} in the sample said yes?`, `How many sampled ${s.sv.ent} said they ${s.sv.ev}?`], correct: ans, wrongs: [W((s.n * s.lo) / 100, "step_missing", "구간의 아래 끝을 표본 %로 보았다."), W((s.n * s.hi) / 100, "step_missing", "구간의 위 끝을 표본 %로 보았다."), W(s.p, "unit_error", "표본 %를 사람 수로 답했다."), W((s.n * s.m) / 100, "formula_misuse", "오차범위를 사람 수로 바꿨다."), W(s.n - ans, "opposite", "'아니오' 수를 구했다.")].filter((w) => Number.isInteger(w.v)), P: { n: s.n }, js: `return P.n * p / 100;`, trace: [infRead(s), [`구간은 표본 % ± 오차범위이므로 표본 %는 구간의 중심이다.`, "The sample percent is the center."], [`표본 % = (${s.lo} + ${s.hi}) ÷ 2 = ${s.p}% 이다.`, "Center of the interval."], [`${s.n} × ${s.p / 100} = ${f(ans)} 이다.`, "Convert to a count."]], variant: "sample_count_from_interval" }); } },
    { op: "compare_scenarios", structure: "두 설문의 오차범위(그림의 구간 폭에서 읽은 것과 지문의 것)를 비교해 차를 구함", extra: "구간 폭의 절반이 오차범위임을 읽어 다른 설문과 비교 — medium 은 오차범위 읽기", concepts: ["그럴듯한 구간", "수직선", "오차범위 비교"],
      gen(rng) { const s = infScene(rng); const m2 = rng.int(1, 8); if (m2 === s.m) throw new GenFail("eq"); const d = Math.abs(m2 - s.m);
        return infI(rng, s, { stim: `A second survey of the same population has a margin of error of ${m2} percentage points.`, question: ["What is the positive difference, in percentage points, between the margins of error of the two surveys?", "By how many percentage points do the margins of error of the two surveys differ?"], correct: d, wrongs: [W(Math.abs(m2 - (s.hi - s.lo)), "formula_misuse", "구간의 폭을 오차범위로 보았다."), W(s.m, "step_missing", "첫 설문의 오차범위만 답했다."), W(m2, "step_missing", "둘째 설문의 오차범위만 답했다."), W(s.m + m2, "sign_error", "합을 구했다."), W(d + 1, "other", "1 어긋났다.")], P: { m2 }, js: `return Math.abs(m - P.m2);`, trace: [infRead(s), [`구간의 폭 = ${s.hi} - ${s.lo} = ${s.hi - s.lo} 이다.`, "Width of the interval."], [`오차범위는 폭의 절반이므로 ${s.m} 이다.`, "The margin of error is half the width."], [`둘째 설문의 오차범위는 ${m2} 이다.`, "The other margin."], [`차 = |${s.m} - ${m2}| = ${d} 이다.`, "Positive difference."]], variant: "compare_margins" }); } },
    { op: "unit_ratio", structure: "그럴듯한 구간의 폭(%)을 모집단 크기에 적용해 가능한 인원 범위의 크기를 구함", extra: "퍼센트 폭을 인원으로 환산 — medium 은 아래 끝 인원", concepts: ["그럴듯한 구간", "수직선", "단위 환산"],
      gen(rng) { const s = infScene(rng); const N = rng.pick(POPS); const ans = (N * (s.hi - s.lo)) / 100;
        return infI(rng, s, { stim: `There are ${N} ${s.sv.ent} in the population.`, question: [`By how many people do the greatest and least plausible numbers of the ${N} ${s.sv.ent} who ${s.sv.ev} differ?`, `What is the difference between the greatest and least plausible numbers of ${s.sv.ent} in the population who ${s.sv.ev}?`], correct: ans, wrongs: [W((N * s.m) / 100, "formula_misuse", "오차범위만 환산했다."), W(s.hi - s.lo, "unit_error", "퍼센트 폭을 답했다."), W((N * s.hi) / 100, "step_missing", "위 끝 인원만 답했다."), W((s.n * (s.hi - s.lo)) / 100, "scope", "표본 크기로 환산했다."), W(ans + N / 100, "other", "계산 중 어긋났다.")], P: { N }, js: `return P.N * (hi - lo) / 100;`, trace: [infRead(s), [`구간의 폭 = ${s.hi} - ${s.lo} = ${s.hi - s.lo} 퍼센트포인트이다.`, "Width in percentage points."], [`모집단은 ${N} 명이다.`, "Population size."], [`${N} × ${(s.hi - s.lo) / 100} = ${f(ans)} 이다.`, "Convert the width to a count."]], variant: "range_of_plausible_counts" }); } },
  ],
  em: [
    { lv: "easy", name: "sample_percent", structure: "수직선의 구간 중심으로 표본 %를 구함", extra: "easy: 두 끝의 평균", concepts: ["그럴듯한 구간", "수직선"],
      gen(rng) { const s = infScene(rng); return infI(rng, s, { question: "What is the sample percent?", correct: s.p, wrongs: [W(s.lo, "axis_misread", "아래 끝을 답했다."), W(s.hi, "axis_misread", "위 끝을 답했다."), W(s.m, "scope", "오차범위를 답했다."), W(s.p + 1, "other", "1 어긋났다.")], js: `return p;`, trace: [infRead(s), [`표본 % = (${s.lo} + ${s.hi}) ÷ 2 = ${s.p}% 이다.`, "Take the midpoint."]], variant: "sample_percent_from_interval" }); } },
    { lv: "medium", name: "least_count", structure: "구간의 아래 끝을 모집단 크기에 적용해 가능한 최소 인원을 구함", extra: "medium: 퍼센트 → 인원", concepts: ["그럴듯한 구간", "수직선", "모집단 추정"],
      gen(rng) { const s = infScene(rng); const N = rng.pick(POPS); const ans = (N * s.lo) / 100; return infI(rng, s, { stim: `There are ${N} ${s.sv.ent} in the population.`, question: `What is the least plausible number of the ${N} ${s.sv.ent} who ${s.sv.ev}?`, correct: ans, wrongs: [W((N * s.hi) / 100, "opposite", "위 끝을 썼다."), W(s.lo, "unit_error", "퍼센트를 답했다."), W((s.n * s.lo) / 100, "scope", "표본 크기로 환산했다."), W((N * s.p) / 100, "step_missing", "구간의 중심을 썼다.")], P: { N }, js: `return P.N * lo / 100;`, trace: [infRead(s), [`아래 끝은 ${s.lo}% 이다.`, "The lower end is the least plausible percent."], [`${N} × ${s.lo / 100} = ${f(ans)} 이다.`, "Convert to a count."]], variant: "least_plausible_count" }); } },
  ],
});

export const marginIntervalP = () => defineItem({
  prefix: "ime", itemId: "inference_margin_error.margin_interval.NL.P",
  hard: [
    { op: "inverse", structure: "수직선의 구간에서 오차범위를 읽고, 오차범위가 두 배가 될 때의 위 끝을 구함", extra: "구간 폭의 절반 = 오차범위를 거꾸로 읽은 뒤 새 구간을 만듦 — medium 은 오차범위", concepts: ["그럴듯한 구간", "수직선", "오차범위"],
      gen(rng) { const s = infScene(rng); const ans = s.p + 2 * s.m;
        return infI(rng, s, { stim: "A larger study keeps the same sample percent but doubles the margin of error.", question: ["What is the upper end, in percent, of the new plausible interval?", "What is the greatest plausible percent in the new interval?"], correct: ans, wrongs: [W(s.hi, "step_missing", "원래 위 끝을 답했다."), W(s.p + s.m * 3, "formula_misuse", "오차범위를 세 배로 했다."), W(s.hi + 2 * s.m, "formula_misuse", "위 끝에 오차범위의 두 배를 더했다."), W(2 * s.m, "scope", "새 오차범위만 답했다."), W(s.p + s.m + 1, "other", "1 어긋났다.")], js: `return p + 2 * m;`, trace: [infRead(s), [`표본 % = ${s.p}%, 오차범위 = ${s.m} 이다.`, "Center and half-width."], [`새 오차범위 = 2 × ${s.m} = ${2 * s.m} 이다.`, "Double the margin."], [`새 위 끝 = ${s.p} + ${2 * s.m} = ${ans} 이다.`, "Add it to the sample percent."]], variant: "upper_end_with_doubled_margin" }); } },
    { op: "chain2", structure: "수직선의 구간 중심으로 표본 %를 구한 뒤 표본에서 '아니오' 라고 답한 사람 수를 구함", extra: "중심 → 표본 % → 여사건 → 인원의 연쇄 — medium 은 표본 %", concepts: ["그럴듯한 구간", "수직선", "여사건"],
      gen(rng) { const s = infScene(rng); const ans = (s.n * (100 - s.p)) / 100;
        return infI(rng, s, { withSample: true, question: [`How many of the ${s.sv.ent} in the sample did not say yes?`, `How many sampled ${s.sv.ent} said no?`], correct: ans, wrongs: [W((s.n * s.p) / 100, "opposite", "'예' 수를 구했다."), W(100 - s.p, "unit_error", "퍼센트를 답했다."), W((s.n * (100 - s.hi)) / 100, "step_missing", "위 끝을 표본 %로 보았다."), W((s.n * (100 - s.lo)) / 100, "step_missing", "아래 끝을 표본 %로 보았다."), W(ans + s.n / 100, "other", "계산 중 어긋났다.")].filter((w) => Number.isInteger(w.v)), P: { n: s.n }, js: `return P.n * (100 - p) / 100;`, trace: [infRead(s), [`표본 % = ${s.p}% 이다.`, "The center is the sample percent."], [`'아니오' % = 100 - ${s.p} = ${100 - s.p}% 이다.`, "Complement."], [`${s.n} × ${(100 - s.p) / 100} = ${f(ans)} 이다.`, "Convert to a count."]], variant: "no_count_from_interval" }); } },
    { op: "constraint_select", structure: "수직선의 그럴듯한 구간 안에 드는 퍼센트를 4개 선지에서 고름", extra: "구간 안·밖 판정(경계 근처 값 포함)을 정확히 해야 함 — medium 은 구간 끝 읽기", concepts: ["그럴듯한 구간", "수직선", "주장 평가"], sprNo: MC_ONLY_STATEMENT,
      gen(rng) { const s = infScene(rng); const inside = rng.int(s.lo, s.hi); const outs = rng.shuffle([s.lo - 1, s.hi + 1, s.lo - 2 - rng.int(0, 2), s.hi + 2 + rng.int(0, 2), s.p + 2 * s.m + 3]).filter((v) => v > 0 && v < 100 && (v < s.lo || v > s.hi)); if (outs.length < 3 || new Set(outs.slice(0, 3)).size < 3) throw new GenFail("outs");
        const T = (v: number) => `${v} percent`;
        return statementInst(rng, { stimulus: `${infIntro(rng, s)} ${rng.pick(NLEADS)}`, question: `Which of the following is a plausible value for the percent of all ${lcw(s.sv.popLbl)} who ${s.sv.ev}?`, correct: T(inside), wrongs: outs.slice(0, 3).map((v) => ({ text: T(v), reason: v < s.lo ? "구간의 아래 끝보다 작은 값이다." : "구간의 위 끝보다 큰 값이다." })), figure: s.fig, P: {}, body: `${INF_JS}const idx = P.options.map((o) => { const v = parseFloat(o); return v >= lo && v <= hi; }); const hit = idx.reduce((a, h, i) => (h ? [...a, i] : a), []); if (hit.length !== 1) throw new Error('구간 안의 값이 ' + hit.length + '개'); return hit[0];`, trace: tr5([infRead(s), [`그럴듯한 값은 ${s.lo}% 이상 ${s.hi}% 이하이다.`, "A plausible value lies inside the interval."], [`선지를 하나씩 구간과 비교한다.`, "Compare each option with the interval."], [`${inside} 만 구간 안에 있다.`, "Only this value lies inside."]], `${inside} percent`), variant: "plausible_value_choice" }); } },
    { op: "compare_scenarios", structure: "다른 설문의 표본 %·오차범위로 만든 위 끝과 그림의 위 끝의 차를 구함", extra: "각 설문의 구간 위 끝을 비교 — medium 은 한 구간의 위 끝", concepts: ["그럴듯한 구간", "수직선", "두 구간 비교"],
      gen(rng) { const s = infScene(rng); const pB = rng.int(25, 75), mB = rng.int(1, 6); const hiB = pB + mB; if (hiB === s.hi) throw new GenFail("eq"); const d = Math.abs(hiB - s.hi);
        return infI(rng, s, { stim: `A second survey reports a sample percent of ${pB} percent with a margin of error of ${mB} percentage points.`, question: ["What is the positive difference between the upper ends of the plausible intervals for the two surveys?", "By how many percentage points do the upper ends of the two plausible intervals differ?"], correct: d, wrongs: [W(Math.abs(pB - s.p), "step_missing", "표본 %의 차를 답했다."), W(Math.abs(mB - s.m), "step_missing", "오차범위의 차를 답했다."), W(Math.abs(pB - mB - s.lo), "opposite", "아래 끝을 비교했다."), W(d + 1, "other", "1 어긋났다."), W(hiB, "scope", "둘째 설문의 위 끝을 답했다.")], P: { pB, mB }, js: `return Math.abs((P.pB + P.mB) - hi);`, trace: [infRead(s), [`첫째 설문의 위 끝은 ${s.hi}% 이다.`, "Upper end of the first interval."], [`둘째 설문의 위 끝 = ${pB} + ${mB} = ${hiB}% 이다.`, "Upper end of the second interval."], [`차 = |${hiB} - ${s.hi}| = ${d} 이다.`, "Positive difference."]], variant: "compare_upper_ends" }); } },
  ],
  em: [
    { lv: "easy", name: "margin_of_error", structure: "수직선의 구간 폭의 절반으로 오차범위를 구함", extra: "easy: 폭 ÷ 2", concepts: ["그럴듯한 구간", "수직선"],
      gen(rng) { const s = infScene(rng); return infI(rng, s, { question: "What is the margin of error, in percentage points?", correct: s.m, wrongs: [W(s.hi - s.lo, "formula_misuse", "구간 전체의 폭을 답했다."), W(s.p, "scope", "표본 %를 답했다."), W(s.m + 1, "other", "1 어긋났다."), W(s.hi, "axis_misread", "위 끝을 답했다.")], js: `return m;`, trace: [infRead(s), [`폭 = ${s.hi} - ${s.lo} = ${s.hi - s.lo} 이다.`, "Width."], [`오차범위 = ${s.hi - s.lo} ÷ 2 = ${s.m} 이다.`, "Half the width."]], variant: "margin_from_interval" }); } },
    { lv: "medium", name: "sample_percent_and_lower", structure: "구간의 중심(표본 %)에서 오차범위를 두 번 빼 새 아래 끝을 구함", extra: "medium: 중심 읽기 + 연산", concepts: ["그럴듯한 구간", "수직선"],
      gen(rng) { const s = infScene(rng); const ans = s.p - 2 * s.m; return infI(rng, s, { stim: "The margin of error is then doubled while the sample percent stays the same.", question: "What is the lower end of the new plausible interval?", correct: ans, wrongs: [W(s.lo, "step_missing", "원래 아래 끝을 답했다."), W(s.p - 3 * s.m, "formula_misuse", "오차범위를 세 배로 했다."), W(s.lo - 2 * s.m, "formula_misuse", "아래 끝에서 오차범위의 두 배를 뺐다."), W(ans + 1, "other", "1 어긋났다.")], js: `return p - 2 * m;`, trace: [infRead(s), [`표본 % = ${s.p}%, 오차범위 = ${s.m} 이다.`, "Center and half-width."], [`새 아래 끝 = ${s.p} - ${2 * s.m} = ${ans} 이다.`, "Subtract the doubled margin."]], variant: "lower_end_with_doubled_margin" }); } },
  ],
});

// margin_interval.NL.C — 표본 %·오차범위가 주어질 때 그럴듯한 구간 그래프를 4개 중에서 고른다
const INF_C_DIAG = `const A = c.items[0], B = ok.items[0]; if (A.kind !== 'interval') return null; if (A.lo === B.lo && A.hi === B.hi) return null; const wB = B.hi - B.lo, wA = A.hi - A.lo, cA = (A.lo + A.hi) / 2, cB = (B.lo + B.hi) / 2;
if ((A.lo === cB || A.hi === cB) && wA === wB / 2) return 'NI1_one_sided'; if (cA === cB && wA === 2 * wB) return 'NI2_double_margin'; if (wA === wB && cA !== cB) return 'NI3_shifted'; if (cA === cB && wA === wB / 2) return 'NI4_half_margin'; return null;`;
function infChoice(rng: Rng, s: Inf, o: { stim: string; trace: [string, string][]; variant: string; P: Record<string, number | string>; lohi: string }): Instance {
  const ax: Axis = { axisMin: s.p - 2 * s.m - 2, axisMax: s.p + 2 * s.m + 2 }; const mk = (lo: number, hi: number) => nlFig(ax, [{ kind: "interval", lo, hi }], { varName: "%" });
  const okF = okFig(mk(s.lo, s.hi)); const cands = [{ rule: "NI1_one_sided", lo: s.p, hi: s.p + s.m }, { rule: "NI1_one_sided", lo: s.p - s.m, hi: s.p }, { rule: "NI2_double_margin", lo: s.p - 2 * s.m, hi: s.p + 2 * s.m }, { rule: "NI3_shifted", lo: s.p, hi: s.p + 2 * s.m }, { rule: "NI3_shifted", lo: s.p - 2 * s.m, hi: s.p }];
  const diag = new Function("c", "ok", "P", INF_C_DIAG) as (c: unknown, ok: unknown, P: unknown) => string | null; const predJs = `const it = c.items[0]; ${o.lohi} return it.kind === 'interval' && it.lo === LO && it.hi === HI;`; const pred = new Function("c", "i", "P", predJs) as (c: unknown, i: number, P: unknown) => boolean;
  const P = o.P; if (!pred(okF, 0, P)) throw new GenFail("정답"); const picked: { fig: unknown; rule: string }[] = []; const used = new Set<string>();
  for (const w of rng.shuffle(cands)) { if (picked.length >= 3) break; const fig = mk(w.lo, w.hi); if (pred(fig, 0, P)) continue; const r = diag(fig, okF, P); if (r !== w.rule || used.has(r)) continue; used.add(r); picked.push({ fig, rule: r }); }
  if (picked.length < 3) throw new GenFail("후보 부족"); const ch = placeChoices(rng, okF, picked);
  return choiceInst(rng, { stimulus: `${o.stim} ${rng.pick(NLEADS)}`, question: rng.pick(["Which number line shows the plausible interval for the percent of all " + lcw(s.sv.popLbl) + " who " + s.sv.ev + "?", "Which graph represents the interval of plausible values for that percent?", "Which of the following graphs shows the plausible interval?"]), choices: ch.choices, correctIndex: ch.correctIndex, rules: ch.rules, P, predicateJs: predJs, diagnoseJs: INF_C_DIAG, trace: tr5(o.trace, `${s.lo}% ~ ${s.hi}%`, 5), variant: o.variant, explainKo: "", explainEn: "" });
}
const infC = (rng: Rng, s: Inf, extra: string) => `${rng.pick([`A random sample of ${s.sv.ent} was asked whether they ${s.sv.ev}.`, `Researchers surveyed a random sample of ${s.sv.ent} about ${s.sv.topic}.`, `In a survey about ${s.sv.topic}, a random sample of ${s.sv.ent} was selected.`])} ${extra} The plausible interval for the percent of all ${lcw(s.sv.popLbl)} who ${s.sv.ev} is the sample percent plus or minus the margin of error. The graphs are shown on number lines below.`;
const C_SPR = "선택지가 수직선 그래프 4개이고 알맞은 그래프를 고르는 것이 문제의 핵심이라 선택지 없이는 성립하지 않는다";
export const marginIntervalC = () => defineItem({
  prefix: "ime", itemId: "inference_margin_error.margin_interval.NL.C",
  hard: [
    { op: "constraint_select", structure: "표본 %와 오차범위가 주어질 때 그럴듯한 구간(표본 % ± 오차범위)의 수직선 그래프를 고름", extra: "구간이 표본 % 를 중심으로 양쪽으로 오차범위만큼 뻗는다는 구조를 적용 — medium 은 오차범위가 정수로 주어진 경우", concepts: ["그럴듯한 구간", "수직선 그래프"], sprNo: C_SPR,
      gen(rng) { const s = infScene(rng, { mLo: 2, mHi: 4 }); return infChoice(rng, s, { stim: infC(rng, s, `The sample percent was ${s.p} percent, with a margin of error of ${s.m} percentage points.`), trace: [[`표본 % = ${s.p}, 오차범위 = ${s.m} 이다.`, "Read the sample percent and margin."], [`구간 = ${s.p} ± ${s.m} = ${s.lo} ~ ${s.hi} 이다.`, "Compute both ends."]], variant: "interval_graph_from_percent_and_margin", P: { p: s.p, m: s.m }, lohi: "const LO = P.p - P.m, HI = P.p + P.m;" }); } },
    { op: "chain2", structure: "응답 수로 표본 %를 먼저 구한 뒤 오차범위를 적용한 구간의 그래프를 고름", extra: "수 → 표본 % → 구간 → 그래프의 연쇄 — medium 은 표본 %가 주어진 경우", concepts: ["표본 비율", "그럴듯한 구간", "수직선 그래프"], sprNo: C_SPR,
      gen(rng) { const s = infScene(rng, { mLo: 2, mHi: 4 }); return infChoice(rng, s, { stim: infC(rng, s, `Of the ${s.n} ${s.sv.ent} in the sample, ${s.yes} said yes. The margin of error is ${s.m} percentage points.`), trace: [[`표본 % = ${s.yes} ÷ ${s.n} = ${s.p}% 이다.`, "Compute the sample percent."], [`오차범위는 ${s.m} 이다.`, "Read the margin."], [`구간 = ${s.p} ± ${s.m} = ${s.lo} ~ ${s.hi} 이다.`, "Compute both ends."]], variant: "interval_graph_from_counts", P: { yes: s.yes, n: s.n, m: s.m }, lohi: "const p0 = P.yes * 100 / P.n; const LO = p0 - P.m, HI = p0 + P.m;" }); } },
    { op: "inverse", structure: "표본 %와 구간의 아래 끝이 주어질 때 오차범위를 역으로 구해 그래프를 고름", extra: "아래 끝 = 표본 % - 오차범위 를 거꾸로 써서 위 끝을 만들어야 함 — medium 은 오차범위가 직접 주어짐", concepts: ["그럴듯한 구간", "역산", "수직선 그래프"], sprNo: C_SPR,
      gen(rng) { const s = infScene(rng, { mLo: 2, mHi: 4 }); return infChoice(rng, s, { stim: infC(rng, s, `The sample percent was ${s.p} percent, and the lower end of the plausible interval is ${s.lo} percent.`), trace: [[`표본 % = ${s.p}, 아래 끝 = ${s.lo} 이다.`, "Read the given values."], [`오차범위 = ${s.p} - ${s.lo} = ${s.m} 이다.`, "The margin is the center minus the lower end."], [`위 끝 = ${s.p} + ${s.m} = ${s.hi} 이다.`, "Add the margin to the center."]], variant: "interval_graph_from_lower_end", P: { p: s.p, L: s.lo }, lohi: "const LO = P.L, HI = 2 * P.p - P.L;" }); } },
    { op: "unit_ratio", structure: "오차범위가 표본 %의 10% 로 주어질 때(비율 환산) 구간의 그래프를 고름", extra: "표본 %의 일정 비율로 오차범위를 계산한 뒤 구간을 만듦 — medium 은 오차범위가 직접 주어짐", concepts: ["그럴듯한 구간", "비율 환산", "수직선 그래프"], sprNo: C_SPR,
      gen(rng) { for (let t = 0; t < 60; t++) { const s = infScene(rng, { mLo: 2, mHi: 4 }); const p10 = s.m * 10; if (p10 < 20 || p10 > 80) continue; const s2: Inf = infScene(rng, { mLo: 2, mHi: 4 }); void s2; const sc = { ...s, p: p10, lo: p10 - s.m, hi: p10 + s.m, ax: { axisMin: p10 - 2 * s.m - 2, axisMax: p10 + 2 * s.m + 2 } }; const fig = nlFig(sc.ax, [{ kind: "interval", lo: sc.lo, hi: sc.hi }], { varName: "%" }); sc.fig = fig;
        return infChoice(rng, sc, { stim: infC(rng, sc, `The sample percent was ${p10} percent, and the margin of error was 10 percent of the sample percent.`), trace: [[`표본 % = ${p10} 이다.`, "Read the sample percent."], [`오차범위 = ${p10} × 0.1 = ${s.m} 이다.`, "Ten percent of the sample percent."], [`구간 = ${p10} ± ${s.m} = ${sc.lo} ~ ${sc.hi} 이다.`, "Compute both ends."]], variant: "interval_graph_from_relative_margin", P: { p: p10 }, lohi: "const LO = P.p - P.p / 10, HI = P.p + P.p / 10;" }); } throw new GenFail("unit"); } },
  ],
  em: [
    { lv: "easy", name: "direct_interval", structure: "표본 %와 오차범위가 주어질 때 구간 그래프를 고름", extra: "easy: 두 끝 계산", concepts: ["그럴듯한 구간", "수직선 그래프"],
      gen(rng) { const s = infScene(rng, { mLo: 2, mHi: 4 }); return infChoice(rng, s, { stim: infC(rng, s, `The sample percent was ${s.p} percent, with a margin of error of ${s.m} percentage points.`), trace: [[`구간 = ${s.p} ± ${s.m} = ${s.lo} ~ ${s.hi} 이다.`, "Compute both ends."]], variant: "interval_graph_direct", P: { p: s.p, m: s.m }, lohi: "const LO = P.p - P.m, HI = P.p + P.m;" }); } },
    { lv: "medium", name: "from_counts", structure: "응답 수로 표본 %를 구해 구간 그래프를 고름", extra: "medium: 수 → % → 구간", concepts: ["표본 비율", "그럴듯한 구간"],
      gen(rng) { const s = infScene(rng, { mLo: 2, mHi: 4 }); return infChoice(rng, s, { stim: infC(rng, s, `Of the ${s.n} ${s.sv.ent} in the sample, ${s.yes} said yes. The margin of error is ${s.m} percentage points.`), trace: [[`표본 % = ${s.yes} ÷ ${s.n} = ${s.p}% 이다.`, "Compute the sample percent."], [`구간 = ${s.p} ± ${s.m} = ${s.lo} ~ ${s.hi} 이다.`, "Compute both ends."]], variant: "interval_graph_counts", P: { yes: s.yes, n: s.n, m: s.m }, lohi: "const p0 = P.yes * 100 / P.n; const LO = p0 - P.m, HI = p0 + P.m;" }); } },
  ],
});
