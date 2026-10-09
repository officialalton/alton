// nonlinear_functions.rational_asymptote.FN.P — 순수 유리함수 그래프(점근선 점선, 축 제목 x·y)에서 y = k + m/(x - h) 의 상수 k·분자 b·그림 밖의 값·x 절편·역산을 구한다.
import { GenFail } from "../../../types";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { pickFn } from "./_t5-kit";
import { RAT_JS, makeRat, ratIntro, ratRead } from "../rat-kit";

const FORM = (fn: string) => `The function is defined by $${fn}(x) = \\frac{ax + b}{x - h}$, where $a$, $b$, and $h$ are constants.`;
const FORM2 = (fn: string) => `The function is defined by $${fn}(x) = k + \\frac{m}{x - h}$, where $h$, $k$, and $m$ are constants.`;
const pf = (rng: import("../../../rng").Rng) => pickFn(rng, ["f", "g", "h", "k", "m", "a", "b"]);
const isI = Number.isInteger;

export const ITEM = defineItem({
  prefix: "rafp", itemId: "nonlinear_functions.rational_asymptote.FN.P",
  hard: [
    {
      op: "repr_shift", structure: "(ax + b)/(x - h) 꼴로 쓸 때 수평 점근선이 y = a 이고 분자 상수 b 는 m - a·h 임을 이용해 b 를 구함", extra: "k, h, m 을 읽은 뒤 b = m - k·h 로 바꿔야 함(m 이나 k 를 b 로 읽는 것이 함정) — medium 은 a",
      concepts: ["유리함수 그래프", "점근선", "식의 변형"],
      gen(rng) { const fn = pf(rng); const r = makeRat(rng, fn); const b = r.b; if (Math.abs(b) > 99) throw new GenFail("b");
        return figInst(rng, { stimulus: `${ratIntro(rng, fn)} ${FORM(fn)}`, question: rng.pick(["What is the value of $b$?", "What is $b$?", "Find the value of the constant $b$.", "What is the value of the constant $b$ in the equation?", "Which value of $b$ matches the graph?"]), correct: b,
          wrongs: [W(r.m, "formula_misuse", "분자 m 을 b 로 답했다."), W(r.m + r.k * r.h, "sign_error", "m - kh 의 부호를 놓쳤다."), W(r.k, "axis_misread", "수평 점근선의 값 a 를 답했다."), W(-r.h, "axis_misread", "수직 점근선의 위치를 답했다."), W(b + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== b && isI(w.v)),
          verificationJs: figJs({}, r.fig, `${RAT_JS}return pb;`), trace: [...ratRead(r), [`k + m/(x - h) = (kx + m - kh)/(x - h) 이므로 a = ${r.k}, b = m - kh 이다.`, "Combine into a single fraction."], [`b = ${r.m} - (${r.k})(${r.h}) = ${b} 이다.`, "Compute b."]], variant: "numerator_constant_b" }, r.fig); },
    },
    {
      op: "chain2", structure: "점근선·표시점으로 식을 세운 뒤 그림 밖의 x 에서의 값을 구함", extra: "h, k, m 을 구한 뒤 대입해야 함(점근선의 값을 답하거나 선형으로 이어 읽는 것이 함정) — medium 은 k",
      concepts: ["유리함수 그래프", "식 세우기", "함숫값"],
      gen(rng) { const fn = pf(rng); const r = makeRat(rng, fn); const opts = [-6, -4, -3, -2, 2, 3, 4, 6, 12].map((d) => r.h + d).filter((x) => !r.xs.includes(x) && isI(r.f(x)) && Math.abs(r.f(x)) <= 99); if (!opts.length) throw new GenFail("x0"); const x0 = rng.pick(opts); const v = r.f(x0);
        return figInst(rng, { stimulus: `${ratIntro(rng, fn)} ${FORM2(fn)}`, question: rng.pick([`What is the value of $${fn}(${x0})$?`, `What is $${fn}(${x0})$?`, `Find $${fn}(${x0})$.`, `What does the function give when $x = ${x0}$?`, `If $x = ${x0}$, what is the value of $${fn}(x)$?`]), correct: v,
          wrongs: [W(r.k, "axis_misread", "수평 점근선의 값을 답했다."), W(r.k - r.m / (x0 - r.h), "sign_error", "m 의 부호를 반대로 했다."), W(r.k + r.m / (x0 + r.h), "sign_error", "h 의 부호를 반대로 했다."), W(r.k + r.m * (x0 - r.h), "formula_misuse", "나누지 않고 곱했다."), W(v + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== v && isI(w.v)),
          verificationJs: figJs({ x0 }, r.fig, `${RAT_JS}return f(P.x0);`), trace: [...ratRead(r), [`${fn}(x) = ${r.k} + ${r.m}/(x - ${r.h}) 이다.`, "Write the equation."], [`${fn}(${x0}) = ${r.k} + ${r.m}/(${x0} - (${r.h})) = ${v} 이다.`, "Evaluate."]], variant: "value_outside" }, r.fig); },
    },
    {
      op: "compose_kind", structure: "식을 세운 뒤 x 절편(y = 0 일 때의 x) 을 구함", extra: "k + m/(x - h) = 0 을 풀어 x = h - m/k 를 구해야 함(h 를 답하는 것이 함정) — medium 은 h",
      concepts: ["유리함수 그래프", "식 세우기", "x 절편"],
      gen(rng) { const fn = pf(rng); const r = makeRat(rng, fn); const x0 = r.h - r.m / r.k; if (!isI(x0) || Math.abs(x0) > 99 || x0 === 0) throw new GenFail("x0");
        return figInst(rng, { stimulus: `${ratIntro(rng, fn)} ${FORM2(fn)}`, question: rng.pick([`For what value of $x$ is $${fn}(x) = 0$?`, `At what value of $x$ does the graph of $${fn}$ cross the $x$-axis?`, `What is the $x$-intercept of the graph of $y = ${fn}(x)$?`]), correct: x0,
          wrongs: [W(r.h, "axis_misread", "수직 점근선의 x 를 답했다."), W(r.h + r.m / r.k, "sign_error", "부호를 반대로 했다."), W(-r.m / r.k, "step_missing", "h 를 더하지 않았다."), W(r.k, "axis_misread", "수평 점근선의 값을 답했다."), W(x0 + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== x0 && isI(w.v)),
          verificationJs: figJs({}, r.fig, `${RAT_JS}return h - m / k;`), trace: [...ratRead(r), [`${r.k} + ${r.m}/(x - ${r.h}) = 0 에서 ${r.m}/(x - ${r.h}) = ${-r.k} 이다.`, "Set the function equal to 0."], [`x - ${r.h} = ${r.m / -r.k}, 즉 x = ${x0} 이다.`, "Solve for x."]], variant: "x_intercept" }, r.fig); },
    },
    {
      op: "inverse", structure: "식을 세운 뒤 f(x) = Y 가 되는 x 를 역으로 구함", extra: "Y - k = m/(x - h) 를 거꾸로 풀어 x = h + m/(Y - k) 를 구해야 함(Y 를 k 에 더하는 것이 함정) — medium 은 읽기",
      concepts: ["유리함수 그래프", "식 세우기", "역산"],
      gen(rng) { const fn = pf(rng); const r = makeRat(rng, fn); const opts = [-6, -4, -3, -2, 2, 3, 4, 6, 12].filter((d) => !r.xs.includes(r.h + d) && isI(r.f(r.h + d)) && Math.abs(r.f(r.h + d)) <= 99); if (!opts.length) throw new GenFail("Y"); const dx = rng.pick(opts); const x0 = r.h + dx; const Y = r.f(x0);
        return figInst(rng, { stimulus: `${ratIntro(rng, fn)} ${FORM2(fn)}`, question: rng.pick([`For what value of $x$ is $${fn}(x) = ${Y}$?`, `The equation $${fn}(x) = ${Y}$ is true for what value of $x$?`, `At what value of $x$ does $${fn}$ output ${Y}?`, `Which value of $x$ makes $${fn}(x)$ equal ${Y}?`]), correct: x0,
          wrongs: [W(r.h + (Y - r.k), "formula_misuse", "m 로 나누지 않고 Y - k 를 더했다."), W(r.h - dx, "sign_error", "h 에 대해 반대쪽 값을 답했다."), W(Y, "axis_misread", "Y 를 x 로 답했다."), W(r.h, "axis_misread", "수직 점근선의 x 를 답했다."), W(x0 + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== x0 && isI(w.v)),
          verificationJs: figJs({ Y }, r.fig, `${RAT_JS}return h + m / (P.Y - k);`), trace: [...ratRead(r), [`${r.k} + ${r.m}/(x - ${r.h}) = ${Y} 에서 ${r.m}/(x - ${r.h}) = ${Y - r.k} 이다.`, "Subtract k."], [`x - ${r.h} = ${r.m} ÷ ${Y - r.k} = ${dx}, 즉 x = ${x0} 이다.`, "Solve for x."]], variant: "solve_for_x" }, r.fig); },
    },
  ],
  em: [
    {
      lv: "easy", name: "read_h", structure: "점선 수직 점근선에서 h 를 읽음", extra: "easy: 수직 점근선", concepts: ["유리함수 그래프", "점근선"],
      gen(rng) { const fn = pf(rng); const r = makeRat(rng, fn); return figInst(rng, { stimulus: `${ratIntro(rng, fn)} ${FORM2(fn)}`, question: rng.pick(["What is the value of $h$?", "What is $h$?", "Find the value of the constant $h$.", "What value of $h$ does the dashed vertical line show?", "Which value of $h$ matches the vertical asymptote?", "The vertical asymptote is $x = h$. What is $h$?"]), correct: r.h, wrongs: [W(-r.h, "sign_error", "부호를 반대로 했다."), W(r.k, "axis_misread", "수평 점근선의 값을 답했다."), W(r.m, "axis_misread", "m 을 답했다.")].filter((w) => w.v !== r.h), verificationJs: figJs({}, r.fig, `${RAT_JS}return h;`), trace: [[`수직 점선은 x = ${r.h} 이다.`, "Read the vertical dashed line."], [`h = ${r.h} 이다.`, "The vertical asymptote is x = h."]], variant: "read_h" }, r.fig); },
    },
    {
      lv: "medium", name: "read_k_from_form", structure: "수평 점근선으로 k 를 읽음", extra: "medium: 수평 점근선", concepts: ["유리함수 그래프", "점근선"],
      gen(rng) { const fn = pf(rng); const r = makeRat(rng, fn); return figInst(rng, { stimulus: `${ratIntro(rng, fn)} ${FORM2(fn)}`, question: rng.pick(["What is the value of $k$?", "What is $k$?", "Find the value of the constant $k$.", "What value of $k$ does the dashed horizontal line show?", "Which value of $k$ matches the horizontal asymptote?", "The horizontal asymptote is $y = k$. What is $k$?"]), correct: r.k, wrongs: [W(-r.k, "sign_error", "부호를 반대로 했다."), W(r.h, "axis_misread", "수직 점근선의 x 를 답했다."), W(r.m, "axis_misread", "m 을 답했다.")].filter((w) => w.v !== r.k), verificationJs: figJs({}, r.fig, `${RAT_JS}return k;`), trace: [[`수평 점선은 y = ${r.k} 이다.`, "Read the horizontal dashed line."], [`그래프가 가까워지는 값이 k 이다.`, "The curve approaches y = k."], [`k = ${r.k} 이다.`, "State k."]], variant: "read_k" }, r.fig); },
    },
  ],
});
