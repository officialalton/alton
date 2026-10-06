// linear_equations_one_var.word_problem_translate.LN.P — 맥락 일차 그래프를 y = ax + b 로 옮기고(문장 → 식) 계수·해를 구한다.
import { GenFail } from "../../../types";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst, GL_JS, glIntercept, glIntro, glRead, makeLinGraph, offXg, type LinGraph } from "../graph-kit";

const isI = Number.isInteger;
const MODEL = (s: LinGraph) => `The relationship is modeled by the equation $y = ax + b$, where $x$ is ${s.xq}, $y$ is ${s.yq}, and $a$ and $b$ are constants.`;
const mk = (rng: import("../../../rng").Rng) => { const s = makeLinGraph(rng, { mSign: 1, x0Zero: true }); if (s.b === 0) throw new GenFail("b0"); return s; };
const tr = (s: LinGraph): [string, string][] => [...glRead(s), glIntercept(s), [`y = ${fmtNum(s.m)}x + ${fmtNum(s.b)} 로 쓸 수 있다.`, "Translate the graph into an equation."]];

export const ITEM = defineItem({
  prefix: "wptg", itemId: "linear_equations_one_var.word_problem_translate.LN.P",
  hard: [
    { op: "repr_shift", structure: "그래프를 y = ax + b 로 옮기고 a + b 를 구함", extra: "기울기와 절편을 모두 구해 더해야 함(하나만 답하는 것이 함정) — medium 은 a", concepts: ["일차 관계 그래프", "문장·그래프를 식으로", "기울기·절편"],
      gen(rng) { const s = mk(rng); const ans = s.m + s.b; return gInst(rng, { stimulus: `${glIntro(rng, s)} ${MODEL(s)}`, question: rng.pick(["What is the value of $a + b$?", "What is the sum of $a$ and $b$?"]).replace("the sum of $a$ and $b$?", "the value of $a + b$?"), correct: ans, wrongs: [W(s.m, "step_missing", "a 만 답했다."), W(s.b, "step_missing", "b 만 답했다."), W(s.m - s.b, "sign_error", "b 의 부호를 반대로 더했다."), W(ans + 1, "other", "어긋났다.")].filter((w) => isI(w.v) && w.v !== ans), verificationJs: figJs({}, s.fig, `${GL_JS}return m + b;`), trace: [...tr(s), [`a + b = ${fmtNum(ans)} 이다.`, "Add."]], variant: "a_plus_b" }, s.fig); } },
    { op: "inverse", structure: "식으로 옮긴 뒤 그림 밖의 값 Y 가 되는 x 를 구함", extra: "식을 세운 뒤 y = Y 를 거꾸로 풀어야 함(절편을 빼지 않는 것이 함정) — medium 은 읽기", concepts: ["일차 관계 그래프", "식으로 옮기기", "일차방정식"],
      gen(rng) { const s = mk(rng); const x = offXg(rng, s, 1, 6); const Y = s.m * x + s.b; return gInst(rng, { stimulus: `${glIntro(rng, s)} ${MODEL(s)}`, question: `For what value of $x$ does the model give $y = ${Y}$?`, correct: x, wrongs: [W(Y / s.m, "step_missing", "절편을 빼지 않았다."), W(Y - s.b, "step_missing", "기울기로 나누지 않았다."), W(x + 1, "other", "한 단위 어긋났다."), W((Y + s.b) / s.m, "sign_error", "절편을 더했다.")].filter((w) => isI(w.v) && w.v !== x && w.v >= 0), verificationJs: figJs({ Y }, s.fig, `${GL_JS}return (P.Y - b) / m;`), trace: [...tr(s), [`${fmtNum(s.m)}x + ${fmtNum(s.b)} = ${Y} 에서 x = ${x} 이다.`, "Solve the equation."]], variant: "solve_for_x" }, s.fig); } },
    { op: "chain2", structure: "식으로 옮긴 뒤 x1 에서 x2 로 갈 때 y 의 증가량을 구함", extra: "절편이 소거되고 기울기 × 변화량임을 알아야 함(값을 각각 구하다 실수) — medium 은 a", concepts: ["일차 관계 그래프", "식으로 옮기기", "변화량"],
      gen(rng) { const s = mk(rng); const x1 = offXg(rng, s, 1, 3), x2 = x1 + rng.int(2, 7); const d = s.m * (x2 - x1); return gInst(rng, { stimulus: `${glIntro(rng, s)} ${MODEL(s)}`, question: `By how much does $y$ increase as $x$ goes from ${x1} to ${x2}?`, correct: d, wrongs: [W(s.m * x2 + s.b, "step_missing", "x2 의 값을 답했다."), W(s.m * x2, "step_missing", "절편을 무시한 x2 의 값을 답했다."), W(x2 - x1, "step_missing", "x 의 변화만 답했다."), W(d + s.b, "formula_misuse", "절편을 더했다.")].filter((w) => isI(w.v) && w.v !== d && w.v >= 0), verificationJs: figJs({ x1, x2 }, s.fig, `${GL_JS}return m * (P.x2 - P.x1);`), trace: [...tr(s), [`증가량 = ${fmtNum(s.m)} × (${x2} - ${x1}) = ${d} 이다.`, "Multiply the slope by the change in x."]], variant: "increase_between" }, s.fig); } },
    { op: "compose_kind", structure: "식으로 옮긴 뒤 y = 2 × (처음 값) 이 되는 x 를 구함", extra: "처음 값 b 의 두 배를 목표로 삼아 방정식을 세워야 함(b 를 목표로 삼는 것이 함정) — medium 은 b", concepts: ["일차 관계 그래프", "식으로 옮기기", "일차방정식"],
      gen(rng) { const s = mk(rng); if (s.b % s.m !== 0) throw new GenFail("div"); const x = s.b / s.m; if (x <= 0) throw new GenFail("x"); return gInst(rng, { stimulus: `${glIntro(rng, s)} ${MODEL(s)}`, question: "For what value of $x$ is $y$ equal to twice the value of $y$ when $x = 0$?", correct: x, wrongs: [W(0, "condition_ignored", "x = 0 을 답했다."), W(2 * x, "formula_misuse", "두 배를 한 번 더 곱했다."), W(s.b, "step_missing", "b 를 답했다."), W(x + 1, "other", "어긋났다.")].filter((w) => isI(w.v) && w.v !== x && w.v >= 0), verificationJs: figJs({}, s.fig, `${GL_JS}return b / m;`), trace: [...tr(s), [`x = 0 일 때 y = ${fmtNum(s.b)}, 그 두 배는 ${2 * s.b} 이다.`, "Twice the starting value."], [`${fmtNum(s.m)}x + ${fmtNum(s.b)} = ${2 * s.b} 에서 x = ${x} 이다.`, "Solve for x."]], variant: "twice_initial" }, s.fig); } },
  ],
  em: [
    { lv: "easy", name: "slope_a", structure: "그래프를 식으로 옮겨 a 를 구함", extra: "easy: 기울기", concepts: ["일차 관계 그래프", "기울기"],
      gen(rng) { const s = mk(rng); return gInst(rng, { stimulus: `${glIntro(rng, s)} ${MODEL(s)}`, question: "What is the value of $a$?", correct: s.m, wrongs: [W(s.b, "formula_misuse", "b 를 답했다."), W(s.m + 1, "other", "어긋났다."), W(Math.max(1, s.m - 1), "other", "어긋났다."), W(s.m * s.d, "unit_error", "y 의 변화만 답했다.")].filter((w) => w.v !== s.m && w.v >= 0), verificationJs: figJs({}, s.fig, `${GL_JS}return m;`), trace: [...glRead(s), [`a = ${fmtNum(s.m)} 이다.`, "The slope is a."]], variant: "a_slope" }, s.fig); } },
    { lv: "medium", name: "intercept_b", structure: "그래프를 식으로 옮겨 b 를 구함", extra: "medium: 절편 계산", concepts: ["일차 관계 그래프", "절편"],
      gen(rng) { const s = mk(rng); return gInst(rng, { stimulus: `${glIntro(rng, s)} ${MODEL(s)}`, question: "What is the value of $b$?", correct: s.b, wrongs: [W(s.m, "formula_misuse", "a 를 답했다."), W(s.ys[2], "axis_misread", "마지막 표시점의 값을 답했다."), W(s.b + 1, "other", "어긋났다."), W(s.b + s.m, "formula_misuse", "기울기를 더했다."), W(2 * s.b, "other", "두 배로 계산했다.")].filter((w) => w.v !== s.b && w.v >= 0), verificationJs: figJs({}, s.fig, `${GL_JS}return b;`), trace: [...glRead(s), glIntercept(s), [`b = ${fmtNum(s.b)} 이다.`, "The y-intercept is b."]], variant: "b_intercept" }, s.fig); } },
  ],
});
