// nonlinear_functions.exponential_model.FN.P — 순수 지수 곡선 그래프(축 제목 x·y)에서 f(x) = a·b^x 의 b, a, 그림 밖의 값, 역산을 구한다.
import { GenFail } from "../../../types";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { pickFn } from "./_t5-kit";
import { EXP_JS, expIntro, expRead, makeExp } from "../pure-fn-kit";

const FORM = (fn: string) => `The function is defined by $${fn}(x) = a \\cdot b^x$, where $a$ and $b$ are positive constants.`;
const isI = Number.isInteger;

export const ITEM = defineItem({
  prefix: "emfg", itemId: "nonlinear_functions.exponential_model.FN.P",
  hard: [
    {
      op: "repr_shift", structure: "x = 0 이 표시되지 않은 지수 곡선에서 연속한 표시점의 비로 b 를 구함", extra: "연속한 두 표시점의 값의 비가 b 임을 알아야 함(차나 첫 값을 b 로 쓰는 것이 함정) — medium 은 a",
      concepts: ["지수 그래프", "연속한 값의 비", "증가·감소 인수"],
      gen(rng) { const fn = pickFn(rng); const e = makeExp(rng, fn); return figInst(rng, { stimulus: `${expIntro(rng, fn)} ${FORM(fn)}`, question: rng.pick(["What is the value of $b$?", "What is $b$?", "Find the value of the constant $b$."]), correct: e.b, wrongs: [W(e.ys[1] - e.ys[0], "formula_misuse", "연속한 값의 차를 답했다."), W(1 / e.b, "formula_misuse", "비를 거꾸로 계산했다."), W(e.a, "axis_misread", "a 를 답했다."), W(e.b + 1, "other", "어긋났다.")].filter((w) => w.v !== e.b && w.v > 0), verificationJs: figJs({}, e.fig, `${EXP_JS}return b;`), trace: [...expRead(e), [`따라서 b = ${fmtNum(e.b)} 이다.`, "State b."], [`식은 ${fn}(x) = ${e.a} · ${fmtNum(e.b)}^x 이다.`, "The equation of the curve."]], variant: "growth_factor" }, e.fig); },
    },
    {
      op: "chain2", structure: "표시점으로 식을 세운 뒤 그림 밖의 x 에서의 값을 구함", extra: "a, b 를 구한 뒤 거듭제곱으로 그림 밖 값을 계산해야 함(선형으로 늘려 답하는 것이 함정) — medium 은 a",
      concepts: ["지수 그래프", "식 세우기", "함숫값"],
      gen(rng) { const fn = pickFn(rng); const e = makeExp(rng, fn); const x = e.X + rng.int(1, 3); const v = e.y(x); if (!isI(v) || v > 999) throw new GenFail("v"); const lin = e.ys[2] + (e.ys[2] - e.ys[1]) * (x - e.xs[2]);
        return figInst(rng, { stimulus: `${expIntro(rng, fn)} ${FORM(fn)}`, question: rng.pick([`What is the value of $${fn}(${x})$?`, `What is $${fn}(${x})$?`, `Find $${fn}(${x})$.`]), correct: v, wrongs: [W(lin, "formula_misuse", "일정한 차로 늘려 답했다."), W(e.a * e.b * x, "formula_misuse", "지수를 곱으로 계산했다."), W(Math.round(e.ys[2] * e.b), "step_missing", "한 칸만 더 갔다."), W(Math.round(v / e.b), "other", "한 칸 덜 갔다."), W(e.a * x, "step_missing", "b 를 곱하지 않았다.")].filter((w) => isI(w.v) && w.v !== v && w.v > 0), verificationJs: figJs({ x }, e.fig, `${EXP_JS}return f(P.x);`), trace: [...expRead(e), [`${fn}(x) = ${e.a} · ${fmtNum(e.b)}^x 이다.`, "Write the equation."], [`${fn}(${x}) = ${e.a} · ${fmtNum(e.b)}^${x} = ${v} 이다.`, "Evaluate."]], variant: "value_outside" }, e.fig); },
    },
    {
      op: "compose_kind", structure: "x = 0 이 표시되지 않은 곡선에서 b 를 구하고 처음 값 a = f(0) 을 구함", extra: "표시점에서 b 를 구한 뒤 거꾸로 x = 0 까지 나눠 가야 함(첫 표시점의 값을 a 로 쓰는 것이 함정) — medium 은 한 칸 뒤",
      concepts: ["지수 그래프", "연속한 값의 비", "처음 값"],
      gen(rng) { const fn = pickFn(rng); const e = makeExp(rng, fn, { startAt: rng.int(1, 3) }); if (e.xs[0] < 1) throw new GenFail("x0");
        return figInst(rng, { stimulus: `${expIntro(rng, fn)} ${FORM(fn)}`, question: rng.pick([`What is the value of $${fn}(0)$?`, `What is $a$?`, `What is the value of $a$?`]), correct: e.a, wrongs: [W(e.ys[0], "step_missing", "첫 표시점의 값을 답했다."), W(e.ys[0] - (e.ys[1] - e.ys[0]) * e.xs[0], "formula_misuse", "일정한 차로 거슬러 갔다."), W(Math.round(e.ys[0] / e.b), "step_missing", "한 칸만 거슬러 갔다."), W(Math.round(e.ys[0] * e.b ** e.xs[0]), "formula_misuse", "나누지 않고 곱했다."), W(e.a + 1, "other", "어긋났다.")].filter((w) => isI(w.v) && w.v !== e.a && w.v > 0), verificationJs: figJs({}, e.fig, `${EXP_JS}return a;`), trace: [...expRead(e), [`x = 0 까지 ${e.xs[0]} 번 b 로 나눈다.`, "Divide by b back to x = 0."], [`a = ${e.ys[0]} ÷ ${fmtNum(e.b)}^${e.xs[0]} = ${e.a} 이다.`, "Compute a."]], variant: "initial_value" }, e.fig); },
    },
    {
      op: "inverse", structure: "식을 세운 뒤 그림 밖의 값 Y 가 되는 x 를 거꾸로 구함", extra: "Y = a·b^x 를 거꾸로 풀어 x 를 찾아야 함(Y 를 b 로 나눠 보는 것이 함정) — medium 은 읽기",
      concepts: ["지수 그래프", "식 세우기", "역산"],
      gen(rng) { const fn = pickFn(rng); const e = makeExp(rng, fn); const x = e.X + rng.int(1, 3); const Y = e.y(x); if (!isI(Y) || Y > 999) throw new GenFail("Y");
        return figInst(rng, { stimulus: `${expIntro(rng, fn)} ${FORM(fn)}`, question: rng.pick([`For what value of $x$ is $${fn}(x) = ${Y}$?`, `The equation $${fn}(x) = ${Y}$ is true for what value of $x$?`]), correct: x, wrongs: [W(x - 1, "other", "한 칸 덜 갔다."), W(x + 1, "other", "한 칸 더 갔다."), W(Math.round(Y / e.a), "formula_misuse", "a 로만 나눴다."), W(e.X, "axis_misread", "그림의 끝 x 를 답했다.")].filter((w) => isI(w.v) && w.v !== x && w.v > 0), verificationJs: figJs({ Y }, e.fig, `${EXP_JS}return Math.round(Math.log(P.Y / a) / Math.log(b));`), trace: [...expRead(e), [`${fn}(x) = ${e.a} · ${fmtNum(e.b)}^x 이다.`, "Write the equation."], [`${e.a} · ${fmtNum(e.b)}^x = ${Y} 에서 ${fmtNum(e.b)}^x = ${Y / e.a} 이다.`, "Divide by a."]], variant: "solve_for_x" }, e.fig); },
    },
  ],
  em: [
    {
      lv: "easy", name: "read_ratio", structure: "x = 0 이 표시된 곡선에서 한 칸 뒤 값과 비교해 b 를 읽음", extra: "easy: 비 읽기", concepts: ["지수 그래프", "연속한 값의 비"],
      gen(rng) { const fn = pickFn(rng); const e = makeExp(rng, fn, { startAt: 0, markOrigin: true }); return figInst(rng, { stimulus: `${expIntro(rng, fn)} ${FORM(fn)}`, question: rng.pick(["What is the value of $b$?", "What is $b$?"]), correct: e.b, wrongs: [W(e.ys[1] - e.ys[0], "formula_misuse", "차를 답했다."), W(1 / e.b, "formula_misuse", "비를 거꾸로 계산했다."), W(e.a, "axis_misread", "a 를 답했다."), W(e.b + 1, "other", "어긋났다.")].filter((w) => w.v !== e.b && w.v > 0), verificationJs: figJs({}, e.fig, `${EXP_JS}return b;`), trace: [[`표시점 (0, ${e.ys[0]}), (1, ${e.ys[1]}) 을 읽는다.`, "Read two marked points."], [`b = ${e.ys[1]} ÷ ${e.ys[0]} = ${fmtNum(e.b)} 이다.`, "Divide consecutive values."]], variant: "b_from_origin" }, e.fig); },
    },
    {
      lv: "medium", name: "value_next", structure: "표시점과 b 로 다음 정수 x 의 값을 구함", extra: "medium: 한 칸 더", concepts: ["지수 그래프", "함숫값"],
      gen(rng) { const fn = pickFn(rng); const e = makeExp(rng, fn, { startAt: 1 }); const x = e.xs[2] + 1; const v = e.y(x); if (!isI(v) || x > e.X) throw new GenFail("v"); return figInst(rng, { stimulus: `${expIntro(rng, fn)} ${FORM(fn)}`, question: `What is the value of $${fn}(${x})$?`, correct: v, wrongs: [W(e.ys[2] + (e.ys[2] - e.ys[1]), "formula_misuse", "일정한 차로 늘렸다."), W(Math.round(e.ys[2] * e.b) + e.a, "other", "어긋났다."), W(e.ys[2], "step_missing", "마지막 표시점의 값을 답했다.")].filter((w) => isI(w.v) && w.v !== v && w.v > 0), verificationJs: figJs({ x }, e.fig, `${EXP_JS}return f(P.x);`), trace: [...expRead(e).slice(0, 2), [`${fn}(${x}) = ${e.ys[2]} × ${fmtNum(e.b)} = ${v} 이다.`, "Multiply the last value by b."]], variant: "next_value" }, e.fig); },
    },
  ],
});
