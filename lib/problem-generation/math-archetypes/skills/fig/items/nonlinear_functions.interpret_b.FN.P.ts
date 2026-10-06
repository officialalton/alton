// nonlinear_functions.interpret_b.FN.P — 순수 포물선 그래프로 y = ax² + bx + c 의 일차항 계수 b(대칭축과 a 의 관계)를 구하거나 해석한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { pickFn } from "./_t5-kit";
import { makeQuadVertex, QX_JS, quadMarkedIntro, quadXRead, quadVertexIntro } from "../pure-fn-kit";

const FORM = (fn: string) => `$${fn}(x) = ax^2 + bx + c$, where $a$, $b$, and $c$ are constants`;
const vertexIntro = (rng: Rng, fn: string) => quadVertexIntro(rng, fn);
const BQ = (rng: Rng) => rng.pick(["What is the value of $b$?", "What is $b$?", "What is the value of the constant $b$?"]);

export const ITEM = defineItem({
  prefix: "ifbg", itemId: "nonlinear_functions.interpret_b.FN.P",
  hard: [
    {
      op: "repr_shift", structure: "꼭짓점이 표시되지 않은 포물선 그래프에서 표시점 세 개로 식을 세워 일차항 계수 b 를 구함", extra: "세 점으로 a, b, c 를 연립해야 하고 b 는 축 위치와 a 에 함께 달려 있음(축 x 를 b 로 읽는 것이 함정) — medium 은 꼭짓점이 표시됨",
      concepts: ["포물선 그래프", "이차식 세우기", "일차항 계수"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any" }); if (q.B === 0) throw new GenFail("b0");
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} The function is defined by ${FORM(fn)}.`, question: BQ(rng), correct: q.B,
          wrongs: [W(-q.B, "sign_error", "부호를 바꿨다."), W(q.H, "axis_misread", "대칭축의 x 를 b 로 읽었다."), W(q.A, "formula_misuse", "이차항 계수를 답했다."), W(q.C, "axis_misread", "상수항을 답했다."), W(q.B + 1, "other", "어긋났다.")].filter((w) => w.v !== q.B),
          verificationJs: figJs({}, q.fig, `${QX_JS}return B;`),
          trace: [...quadXRead(q), [`따라서 b = ${fmtNum(q.B)} 이다.`, "Read off the linear coefficient."]], variant: "b_from_marked_points",
        }, q.fig);
      },
    },
    {
      op: "chain2", structure: "그래프에서 f 의 식을 세워, 평행이동한 g(x) = f(x - s) 를 전개했을 때의 일차항 계수 b - 2as 를 구함", extra: "f 의 a, b 를 구한 뒤 입력 이동이 일차항을 b - 2as 로 바꿈을 전개로 확인해야 함(b 를 그대로 답하는 것이 함정) — medium 은 f 의 b",
      concepts: ["포물선 그래프", "이차식 세우기", "함수의 평행이동과 전개"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any" }); const s = rng.nz(-4, 4); const ans = q.B - 2 * q.A * s; if (ans === q.B) throw new GenFail("same"); const se = s > 0 ? `x - ${s}` : `x + ${-s}`;
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} The expression $${fn}(${se})$ can be rewritten as $ax^2 + bx + c$, where $a$, $b$, and $c$ are constants; $b$ is the coefficient of $x$.`, question: BQ(rng), correct: ans,
          wrongs: [W(q.B, "condition_ignored", `${fn} 의 b 를 그대로 답했다.`), W(q.B + 2 * q.A * s, "sign_error", "이동 방향을 반대로 했다."), W(q.B - q.A * s, "formula_misuse", "2 를 빠뜨렸다."), W(-ans, "sign_error", "부호를 바꿨다."), W(ans + 1, "other", "어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ s }, q.fig, `${QX_JS}return B - 2 * A * P.s;`),
          trace: [...quadXRead(q), [`${fmtNum(q.A)}(${se})² + ${fmtNum(q.B)}(${se}) + ${fmtNum(q.C)} 를 전개한다.`, "Expand the expression."], [`x 의 계수는 ${fmtNum(q.B)} - 2(${fmtNum(q.A)})(${s}) = ${fmtNum(ans)} 이다.`, "Collect the x terms."]], variant: "b_after_shift",
        }, q.fig);
      },
    },
    {
      op: "compose_kind", structure: "그래프에서 f 의 식을 세워, g(x) = f(x) + m x 를 전개했을 때의 일차항 계수 b + m 을 구함", extra: "f 의 b 를 구한 뒤 일차항에 m 을 더함을 반영해야 함(m 만 답하는 것이 함정) — medium 은 f 의 b",
      concepts: ["포물선 그래프", "이차식 세우기", "일차항 계수"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any" }); const m = rng.nz(-6, 6); const ans = q.B + m; if (ans === 0 || Math.abs(m) < 2) throw new GenFail("m"); const me = m < 0 ? `- ${-m}x` : `+ ${m}x`;
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} The expression $${fn}(x) ${me}$ can be rewritten as $ax^2 + bx + c$, where $a$, $b$, and $c$ are constants; $b$ is the coefficient of $x$.`, question: BQ(rng), correct: ans,
          wrongs: [W(q.B, "condition_ignored", `${fn} 의 b 를 그대로 답했다.`), W(m, "step_missing", "m 만 답했다."), W(q.B - m, "sign_error", "m 의 부호를 반대로 더했다."), W(-ans, "sign_error", "부호를 바꿨다."), W(ans + 1, "other", "어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ m }, q.fig, `${QX_JS}return B + P.m;`),
          trace: [...quadXRead(q), [`${fmtNum(q.A)}x² + (${fmtNum(q.B)} + (${m}))x + ${fmtNum(q.C)} 이다.`, "Combine the linear terms."], [`b = ${fmtNum(ans)} 이다.`, "Read the linear coefficient."]], variant: "b_after_linear_term",
        }, q.fig);
      },
    },
    {
      op: "inverse", structure: "그래프에서 꼭짓점의 x(대칭축)와 a 를 구하고, b ÷ a = -2h 를 구함", extra: "b 와 a 를 각각 구하지 않고도 축으로 b/a 를 -2h 로 이어야 함(h 를 그대로 답하는 것이 함정) — medium 은 b",
      concepts: ["포물선 그래프", "대칭축 -b/(2a)", "일차항 계수"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any" }); const ans = q.B / q.A; if (ans === 0) throw new GenFail("zero");
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} The function is defined by ${FORM(fn)}.`, question: rng.pick(["What is the value of $\\frac{b}{a}$?", "What is the value of $b \\div a$?", "Find $\\frac{b}{a}$.", "What is the ratio of $b$ to $a$?"]), correct: ans,
          wrongs: [W(q.H, "step_missing", "대칭축의 x 를 답했다."), W(-ans, "sign_error", "부호를 바꿨다."), W(q.B, "formula_misuse", "b 만 답했다."), W(ans / 2, "formula_misuse", "2 를 빠뜨렸다."), W(ans + 1, "other", "어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({}, q.fig, `${QX_JS}return B / A;`),
          trace: [...quadXRead(q), [`대칭축 x = -b ÷ (2a) = ${fmtNum(q.H)} 이다.`, "The axis of symmetry is x = -b / (2a)."], [`b ÷ a = -2 × ${fmtNum(q.H)} = ${fmtNum(ans)} 이다.`, "Solve for b / a."]], variant: "b_over_a",
        }, q.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "unit_a_vertex", structure: "꼭짓점이 표시된 포물선(a = ±1)에서 b = -2ah 로 일차항 계수를 구함", extra: "easy: b = -2ah", concepts: ["포물선 그래프", "대칭축", "일차항 계수"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any", vertex: true, aPool: [-1, 1] }); if (q.B === 0) throw new GenFail("b0");
        return figInst(rng, { stimulus: `${vertexIntro(rng, fn)} The function is defined by ${FORM(fn)}.`, question: BQ(rng), correct: q.B, wrongs: [W(-q.B, "sign_error", "부호를 바꿨다."), W(q.H, "axis_misread", "꼭짓점 x 를 답했다."), W(q.K, "axis_misread", "꼭짓점 y 를 답했다."), W(q.B * 2, "formula_misuse", "두 배로 계산했다.")].filter((w) => w.v !== q.B), verificationJs: figJs({}, q.fig, `${QX_JS}return B;`), trace: [[`표시된 꼭짓점은 (${q.H}, ${q.K}) 이고 a = ${fmtNum(q.A)} 이다.`, "Read the vertex and the opening."], [`b = -2ah = -2 × ${fmtNum(q.A)} × (${q.H}) = ${fmtNum(q.B)} 이다.`, "Use b = -2ah."]], variant: "b_unit_vertex",
        }, q.fig);
      },
    },
    {
      lv: "medium", name: "vertex_form_b", structure: "꼭짓점과 두 점이 표시된 포물선에서 a 와 h 를 구해 b = -2ah 를 구함", extra: "medium: a 구하기 + b = -2ah", concepts: ["포물선 그래프", "꼭짓점형", "일차항 계수"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any", vertex: true }); if (q.B === 0) throw new GenFail("b0");
        return figInst(rng, { stimulus: `${vertexIntro(rng, fn)} The function is defined by ${FORM(fn)}.`, question: BQ(rng), correct: q.B, wrongs: [W(-q.B, "sign_error", "부호를 바꿨다."), W(q.B / q.A, "formula_misuse", "a 로 나눴다."), W(q.H, "axis_misread", "꼭짓점 x 를 답했다."), W(q.A * 2, "formula_misuse", "2a 를 답했다.")].filter((w) => w.v !== q.B), verificationJs: figJs({}, q.fig, `${QX_JS}return B;`), trace: [[`표시된 꼭짓점은 (${q.H}, ${q.K}) 이다.`, "Read the vertex."], [`다른 표시점을 y = a(x - ${q.H})² + (${q.K}) 에 대입해 a = ${fmtNum(q.A)} 를 구한다.`, "Substitute another marked point."], [`b = -2ah = ${fmtNum(q.B)} 이다.`, "Use b = -2ah."]], variant: "b_vertex_form",
        }, q.fig);
      },
    },
  ],
});
