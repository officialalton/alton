// linear_inequalities.solve_one_var.LN.P — 순수 그래프(축 제목 x·y)의 일차함수 f 로 일차부등식 f(x) > c 등의 해(정수)를 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { GL_JS, makePureLine, pureIntro, purRead, type PureLine } from "../pure-kit";

type Op = ">" | ">=" | "<" | "<=";
const TEX: Record<Op, string> = { ">": ">", ">=": "\\ge", "<": "<", "<=": "\\le" };
const isI = Number.isInteger;
const LEAD = ["", "", "A student is studying a linear function in algebra class. ", "A teacher graphs a function on a grid. ", "A graphing program draws a line. ", "In a practice set, a function is shown as a graph. "];
const fLine = (rng: Rng, o: { ms?: number[] } = {}): PureLine => { let s = makePureLine(rng, o); for (let t = 0; t < 40 && Math.abs(s.m * s.R + s.b) < 3; t++) s = makePureLine(rng, o); if (Math.abs(s.m * s.R + s.b) < 3) throw new GenFail("label"); const f = JSON.parse(JSON.stringify(s.fig)); f.objects[0].fitLine.label = "f"; return { ...s, fig: f }; };
const intro = (rng: Rng) => rng.pick(LEAD) + rng.pick(["The graph of the linear function $f$ is shown in the $xy$-plane.", "The line shown is the graph of $y = f(x)$ in the $xy$-plane.", "In the $xy$-plane, the graph of the linear function $f$ is shown.", "The linear function $f$ is graphed in the $xy$-plane shown."]);
/** m x + b (op) c 의 정수해 중 경계에 가장 가까운 값(해집합이 아래로 유계면 최솟값, 위로 유계면 최댓값). */
function edge(m: number, b: number, op: Op, c: number): { v: number; least: boolean } {
  const t = (c - b) / m; const strict = op === ">" || op === "<"; const gt = (op === ">" || op === ">=") === (m > 0); // x 가 t 보다 큰 쪽이 해
  if (gt) return { v: strict ? Math.floor(t) + 1 : Math.ceil(t), least: true };
  return { v: strict ? Math.ceil(t) - 1 : Math.floor(t), least: false };
}
const word = (least: boolean) => least ? "least" : "greatest";
const QX = (rng: Rng, least: boolean) => rng.pick([`What is the ${least ? "smallest" : "largest"} integer value of $x$ that satisfies the inequality?`, `What is the ${least ? "smallest" : "largest"} integer $x$ for which the inequality is true?`, `Which is the ${least ? "smallest" : "largest"} integer solution to the inequality?`, `Find the ${least ? "smallest" : "largest"} integer $x$ that makes the inequality true.`, `Of all integers that satisfy the inequality, what is the ${least ? "smallest" : "largest"}?`, `Which ${least ? "smallest" : "largest"} integer is a solution of the inequality?`]);
const Q = (rng: Rng, least: boolean) => rng.pick([`What is the ${word(least)} integer value of $x$ that satisfies the inequality?`, `What is the ${word(least)} integer $x$ for which the inequality is true?`, `Which is the ${least ? "smallest" : "largest"} integer solution to the inequality?`]);
const pickOp = (rng: Rng): Op => rng.pick([">", ">=", "<", "<="]);
const ineqTex = (op: Op, rhs: string) => `$f(x) ${TEX[op]} ${rhs}$`;

export const ITEM = defineItem({
  prefix: "lisg", itemId: "linear_inequalities.solve_one_var.LN.P",
  hard: [
    {
      op: "repr_shift", structure: "그래프에서 f 의 식을 세워 그림 밖의 값 c 에 대한 부등식 f(x) > c 의 가장 작은(큰) 정수해를 구함", extra: "식을 세워 경계 t = (c - b)/m 를 구한 뒤 부등호 방향·경계 포함·기울기 부호로 정수를 골라야 함(경계값을 그대로 답하는 것이 함정) — medium 은 그림 안 값",
      concepts: ["일차함수의 그래프", "일차부등식", "정수해"],
      gen(rng) {
        const s = fLine(rng); const op = pickOp(rng); const c = rng.int(-40, 40); const e = edge(s.m, s.b, op, c); if (Math.abs(c) <= s.R) throw new GenFail("inside"); const t = (c - s.b) / s.m;
        return figInst(rng, { stimulus: `${intro(rng)} Consider the inequality ${ineqTex(op, String(c))}.`, question: Q(rng, e.least), correct: e.v,
          wrongs: [W(Math.round(t), "condition_ignored", "경계값을 그대로(반올림) 답했다."), W(e.least ? e.v - 1 : e.v + 1, "condition_ignored", "경계 포함 여부를 반대로 판정했다."), W(e.least ? e.v + 1 : e.v - 1, "condition_ignored", "한 칸 어긋났다."), W(-e.v, "sign_error", "부호를 바꿨다."), W(c - s.b, "step_missing", "기울기로 나누지 않았다.")].filter((w) => isI(w.v) && w.v !== e.v),
          verificationJs: figJs({ c, op }, s.fig, `${GL_JS}const t=(P.c-b)/m; const strict=P.op==='>'||P.op==='<'; const gt=(P.op==='>'||P.op==='>=')===(m>0); return gt ? (strict?Math.floor(t)+1:Math.ceil(t)) : (strict?Math.ceil(t)-1:Math.floor(t));`),
          trace: [...purRead(s), [`f(x) = ${s.m}x + (${s.b}) 이다.`, "Write f."], [`${s.m}x + (${s.b}) ${op} ${c} 에서 경계 x = ${(c - s.b) / s.m} 이다.`, "Find the boundary."], [`${e.least ? "가장 작은" : "가장 큰"} 정수해는 ${e.v} 이다.`, "Pick the integer allowed by the inequality."]], variant: "integer_solution_outside",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "식을 세워 f(x) > c 의 해집합을 구한 뒤, 주어진 범위 [lo, hi] 안의 정수해의 개수를 셈", extra: "해집합의 경계를 구한 뒤 범위와 겹치는 정수를 세는 2단 연쇄(경계 포함이 함정) — medium 은 경계",
      concepts: ["일차함수의 그래프", "일차부등식", "정수 개수 세기"],
      gen(rng) {
        const s = fLine(rng); const op = pickOp(rng); const c = rng.int(-30, 30); const lo = rng.int(-12, -1), hi = lo + rng.int(8, 16); const sat = (x: number) => { const v = s.m * x + s.b; return op === ">" ? v > c : op === ">=" ? v >= c : op === "<" ? v < c : v <= c; }; let n = 0, all = 0; for (let x = lo; x <= hi; x++) { if (sat(x)) n++; const v = s.m * x + s.b; if ((op === ">" || op === ">=") ? v >= c : v <= c) all++; } if (n === 0 || n === hi - lo + 1) throw new GenFail("n");
        return figInst(rng, { stimulus: `${intro(rng)} ${rng.pick([`Consider the inequality ${ineqTex(op, String(c))}.`, `The inequality ${ineqTex(op, String(c))} is given.`, `Let ${ineqTex(op, String(c))} be an inequality in $x$.`, `Suppose that ${ineqTex(op, String(c))}.`])}`, question: rng.pick([`For how many integers $x$ with $${lo} \\le x \\le ${hi}$ is the inequality true?`, `How many integers $x$ from ${lo} to ${hi}, inclusive, make the inequality true?`, `The inequality is true for how many integers $x$ in the interval $[${lo}, ${hi}]$?`, `Among the integers from ${lo} through ${hi}, how many satisfy the inequality?`]), correct: n,
          wrongs: [W(all === n ? n + 1 : all, "condition_ignored", "경계를 항상 포함했다."), W(hi - lo + 1 - n, "sign_error", "반대쪽 영역을 셌다."), W(n - 1, "condition_ignored", "끝 값을 하나 빠뜨렸다."), W(n + 1, "condition_ignored", "끝 값을 하나 더 포함했다."), W(hi - lo + 1, "condition_ignored", "범위의 모든 정수를 셌다.")].filter((w) => isI(w.v) && w.v !== n && w.v >= 0),
          verificationJs: figJs({ c, lo, hi, op }, s.fig, `${GL_JS}let n=0; for (let x=P.lo;x<=P.hi;x++){ const v=m*x+b; const ok=P.op==='>'?v>P.c:P.op==='>='?v>=P.c:P.op==='<'?v<P.c:v<=P.c; if(ok) n++; } return n;`),
          trace: [...purRead(s), [`f(x) = ${s.m}x + (${s.b}) 이다.`, "Write f."], [`${lo} ≤ x ≤ ${hi} 의 각 정수에서 f(x) ${op} ${c} 를 확인한다.`, "Test each integer."], [`해가 되는 정수는 ${n}개이다.`, "Count them."]], variant: "count_integers_in_range",
        }, s.fig);
      },
    },
    {
      op: "compose_kind", structure: "f(x) + k > c 꼴 부등식의 가장 작은(큰) 정수해(상수 k 이동 반영)", extra: "상수 k 를 c 쪽으로 옮겨 경계를 정해야 함(k 를 무시하는 것이 함정) — medium 은 f(x) > c",
      concepts: ["일차함수의 그래프", "일차부등식", "상수항 이동"],
      gen(rng) {
        const s = fLine(rng); const op = pickOp(rng); const c = rng.int(-30, 30); const k = rng.nz(-12, 12); const e = edge(s.m, s.b + k, op, c); const e0 = edge(s.m, s.b, op, c); if (e.v === e0.v) throw new GenFail("same"); const ks = k < 0 ? `- ${-k}` : `+ ${k}`;
        return figInst(rng, { stimulus: `${intro(rng)} Consider the inequality $f(x) ${ks} ${TEX[op]} ${c}$.`, question: Q(rng, e.least), correct: e.v,
          wrongs: [W(e0.v, "condition_ignored", "k 를 무시하고 f(x) 와 c 를 비교했다."), W(edge(s.m, s.b - k, op, c).v, "sign_error", "k 의 부호를 반대로 옮겼다."), W(-e.v, "sign_error", "부호를 바꿨다."), W(e.least ? e.v - 1 : e.v + 1, "condition_ignored", "경계 포함 여부를 반대로 판정했다."), W(e.v + 2, "other", "어긋났다.")].filter((w) => isI(w.v) && w.v !== e.v),
          verificationJs: figJs({ c, k, op }, s.fig, `${GL_JS}const t=(P.c-P.k-b)/m; const strict=P.op==='>'||P.op==='<'; const gt=(P.op==='>'||P.op==='>=')===(m>0); return gt ? (strict?Math.floor(t)+1:Math.ceil(t)) : (strict?Math.ceil(t)-1:Math.floor(t));`),
          trace: [...purRead(s), [`f(x) = ${s.m}x + (${s.b}) 이다.`, "Write f."], [`${s.m}x + (${s.b + k}) ${op} ${c} 로 정리한다.`, "Combine the constants."], [`${e.least ? "가장 작은" : "가장 큰"} 정수해는 ${e.v} 이다.`, "Pick the integer."]], variant: "integer_solution_shifted",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "f(x) > c 의 해집합이 x > p 꼴로 주어질 때, 그래프의 f 로 c 를 역산", extra: "경계 p 에서 f(p) = c 임을 이용해 거꾸로 구해야 함(p 를 답하는 것이 함정) — medium 은 f(p)",
      concepts: ["일차함수의 그래프", "일차부등식", "역산"],
      gen(rng) {
        const s = fLine(rng); const p = rng.nz(-12, 12); const c = s.m * p + s.b; const up = s.m > 0; const dir = up ? ">" : "<"; if (Math.abs(c) > 60) throw new GenFail("c");
        return figInst(rng, { stimulus: `${intro(rng)} ${rng.pick([`The solution set of the inequality $f(x) ${dir} c$, where $c$ is a constant, is all $x$ with $x ${dir} ${p}$.`, `For a constant $c$, the inequality $f(x) ${dir} c$ is true exactly when $x ${dir} ${p}$.`, `The inequality $f(x) ${dir} c$ holds for $x ${dir} ${p}$ and no other $x$, where $c$ is a constant.`])}`, question: rng.pick(["What is the value of $c$?", "What is $c$?", "Find the constant $c$.", "What constant $c$ gives this solution set?"]), correct: c,
          wrongs: [W(p, "step_missing", "경계 x 를 답했다."), W(-c, "sign_error", "부호를 바꿨다."), W(s.m * p, "step_missing", "절편을 더하지 않았다."), W(c - 2 * s.b, "sign_error", "절편의 부호를 반대로 더했다."), W(c + 1, "other", "어긋났다.")].filter((w) => isI(w.v) && w.v !== c),
          verificationJs: figJs({ p }, s.fig, `${GL_JS}return m * P.p + b;`),
          trace: [...purRead(s), [`f(x) = ${s.m}x + (${s.b}) 이다.`, "Write f."], [`해집합의 경계 x = ${p} 에서 f(${p}) = c 이다.`, "The boundary satisfies f(p) = c."], [`c = ${s.m} × ${p} + (${s.b}) = ${c} 이다.`, "Evaluate."]], variant: "constant_from_solution_set",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "inside_integer", structure: "그림 안의 값 c 에 대한 부등식 f(x) > c 의 정수해를 그래프에서 읽음", extra: "easy: 격자점 읽기", concepts: ["일차함수의 그래프", "일차부등식"],
      gen(rng) { const s = fLine(rng); const op = pickOp(rng); const xv = s.xs[1]; const c = s.ys[1]; const e = edge(s.m, s.b, op, c); return figInst(rng, { stimulus: `${intro(rng)} Consider the inequality ${ineqTex(op, String(c))}.`, question: QX(rng, e.least), correct: e.v, wrongs: [W(xv, "condition_ignored", "경계값을 그대로 답했다."), W(e.least ? e.v - 1 : e.v + 1, "condition_ignored", "경계 포함 여부를 반대로 판정했다."), W(-e.v, "sign_error", "부호를 바꿨다."), W(e.v + 2, "other", "어긋났다.")].filter((w) => w.v !== e.v), verificationJs: figJs({ c, op }, s.fig, `${GL_JS}const t=(P.c-b)/m; const strict=P.op==='>'||P.op==='<'; const gt=(P.op==='>'||P.op==='>=')===(m>0); return gt ? (strict?Math.floor(t)+1:Math.ceil(t)) : (strict?Math.ceil(t)-1:Math.floor(t));`), trace: [[`그래프에서 f(x) = ${c} 인 점은 x = ${xv} 이다.`, "Read the boundary from the graph."], [`${e.least ? "가장 작은" : "가장 큰"} 정수해는 ${e.v} 이다.`, "Apply the inequality sign."]], variant: "integer_solution_inside" }, s.fig); },
    },
    {
      lv: "medium", name: "read_f_value", structure: "그래프에서 f(p) 를 읽어 f(p) 와 c 를 비교한 부등식의 참 거짓에 따라 정수를 고름", extra: "medium: 경계 읽고 한 칸 판정", concepts: ["일차함수의 그래프", "일차부등식"],
      gen(rng) { const s = fLine(rng); const op = pickOp(rng); const c = s.ys[0] + rng.nz(-3, 3) * Math.abs(s.m); const e = edge(s.m, s.b, op, c); return figInst(rng, { stimulus: `${intro(rng)} Consider the inequality ${ineqTex(op, String(c))}.`, question: QX(rng, e.least), correct: e.v, wrongs: [W(Math.round((c - s.b) / s.m), "condition_ignored", "경계값을 그대로 답했다."), W(e.least ? e.v - 1 : e.v + 1, "condition_ignored", "경계 포함 여부를 반대로 판정했다."), W(-e.v, "sign_error", "부호를 바꿨다."), W(e.v + 2, "other", "어긋났다.")].filter((w) => w.v !== e.v), verificationJs: figJs({ c, op }, s.fig, `${GL_JS}const t=(P.c-b)/m; const strict=P.op==='>'||P.op==='<'; const gt=(P.op==='>'||P.op==='>=')===(m>0); return gt ? (strict?Math.floor(t)+1:Math.ceil(t)) : (strict?Math.ceil(t)-1:Math.floor(t));`), trace: [...purRead(s).slice(0, 1), [`그래프에서 기울기 ${s.m} 와 절편 ${s.b} 를 얻는다.`, "Read slope and intercept."], [`${s.m}x + (${s.b}) ${op} ${c} 의 경계 x = ${(c - s.b) / s.m} 이다.`, "Find the boundary."], [`${e.least ? "가장 작은" : "가장 큰"} 정수해는 ${e.v} 이다.`, "Apply the inequality sign."]], variant: "integer_solution_read" }, s.fig); },
    },
  ],
});
