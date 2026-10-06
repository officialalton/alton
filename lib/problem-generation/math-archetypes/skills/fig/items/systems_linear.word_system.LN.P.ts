// systems_linear.word_system.LN.P — 상황(두 일차 관계)이 그래프로 주어진 연립방정식 문장제에서 그림 밖의 값·차·합·역산을 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst, ifCont, makeLinePair, PAIR_JS, pairIntro, pairRead, type LinePair } from "../graph-kit";
import { figInst } from "../../../figure-kit";

const isI = Number.isInteger;
void figInst;
const far = (s: LinePair) => s.X + 1 + Math.floor(Math.abs(s.xi - s.X)) + 3;
const diffAt = (s: LinePair, x: number) => (s.m1 * x + s.b1) - (s.m2 * x + s.b2);

export const ITEM = defineItem({
  prefix: "wsgg", itemId: "systems_linear.word_system.LN.P",
  hard: [
    { op: "repr_shift", structure: "두 일차 관계의 그래프에서 각각의 식을 세워 그림 밖의 x 에서 두 값의 차를 구함", extra: "두 식을 모두 세워 같은 x 에서 뺄셈해야 함(한쪽 값만 답하는 것이 함정) — medium 은 그림 안 값", concepts: ["두 일차 관계 그래프", "식 세우기", "값의 차"],
      gen(rng) { const s = makeLinePair(rng); const x = far(s); const ans = diffAt(s, x); if (ans <= 0) throw new GenFail("neg");
        return gInst(rng, { stimulus: pairIntro(rng, s), question: `${ifCont(rng)}, how much greater will the ${s.t.ya} of ${s.t.A} be than that of ${s.t.B} when ${s.t.x} is ${x}, in ${s.t.yu}?`, correct: ans,
          wrongs: [W(s.m1 * x + s.b1, "step_missing", `${s.t.A} 의 값만 답했다.`), W(s.m2 * x + s.b2, "step_missing", `${s.t.B} 의 값만 답했다.`), W((s.m1 - s.m2) * x, "step_missing", "처음 값의 차를 빠뜨렸다."), W((s.m1 - s.m2) * x + (s.b2 - s.b1), "sign_error", "처음 값의 차의 부호를 반대로 했다."), W(ans + s.m1, "other", "어긋났다.")].filter((w) => isI(w.v) && w.v !== ans && w.v >= 0),
          verificationJs: figJs({ x }, s.fig, `${PAIR_JS}return (m1 * P.x + b1) - (m2 * P.x + b2);`),
          trace: [...pairRead(s).slice(0, 2), [`${s.t.A}(${x}) = ${s.m1}·${x} + ${s.b1} = ${s.m1 * x + s.b1} 이다.`, "Evaluate the first relationship."], [`${s.t.B}(${x}) = ${s.m2}·${x} + ${s.b2} = ${s.m2 * x + s.b2} 이다.`, "Evaluate the second relationship."], [`차 = ${ans} 이다.`, "Subtract."]], variant: "difference_outside" }, s.fig); } },
    { op: "chain2", structure: "두 관계의 차가 처음으로 D 가 되는 x 를 구함(차 = (m1 - m2)x + (b1 - b2))", extra: "두 식의 차를 하나의 일차식으로 만들어 D 와 같게 풀어야 함 — medium 은 차 읽기", concepts: ["두 일차 관계 그래프", "식 세우기", "일차방정식"],
      gen(rng) { const s = makeLinePair(rng); const x = far(s); const D = diffAt(s, x); if (D <= 0) throw new GenFail("D");
        return gInst(rng, { stimulus: pairIntro(rng, s), question: `${ifCont(rng)}, for what value of ${s.t.x} will the ${s.t.ya} of ${s.t.A} be exactly ${D} ${s.t.yu} greater than that of ${s.t.B}?`, correct: x,
          wrongs: [W(s.xi, "condition_ignored", "두 값이 같아지는 x 를 답했다."), W(D, "step_missing", "D 를 답했다."), W(Math.round(D / (s.m1 - s.m2)), "step_missing", "처음 값의 차를 빠뜨렸다."), W(x + 1, "other", "한 단위 어긋났다."), W(Math.max(1, x - 2), "other", "어긋났다.")].filter((w) => isI(w.v) && w.v !== x && w.v >= 0),
          verificationJs: figJs({ D }, s.fig, `${PAIR_JS}return (P.D - (b1 - b2)) / (m1 - m2);`),
          trace: [...pairRead(s).slice(0, 2), [`차 = (${s.m1} - ${s.m2})x + (${s.b1} - ${s.b2}) 이다.`, "Write the difference."], [`${s.m1 - s.m2}x + ${s.b1 - s.b2} = ${D} 로 놓는다.`, "Set it equal to D."], [`x = ${x} 이다.`, "Solve for x."]], variant: "when_difference_is_D" }, s.fig); } },
    { op: "compose_kind", structure: "두 관계의 합(총합)을 그림 밖의 x 에서 구함", extra: "두 값을 각각 구해 더해야 함(차를 구하는 것이 함정) — medium 은 그림 안 값", concepts: ["두 일차 관계 그래프", "식 세우기", "합"],
      gen(rng) { const s = makeLinePair(rng); const x = far(s); const ans = (s.m1 * x + s.b1) + (s.m2 * x + s.b2);
        return gInst(rng, { stimulus: pairIntro(rng, s), question: `${ifCont(rng)}, what will be the combined ${s.t.ya} of ${s.t.A} and ${s.t.B} when ${s.t.x} is ${x}, in ${s.t.yu}?`, correct: ans,
          wrongs: [W(diffAt(s, x), "formula_misuse", "차를 답했다."), W(s.m1 * x + s.b1, "step_missing", `${s.t.A} 의 값만 답했다.`), W((s.m1 + s.m2) * x, "step_missing", "처음 값의 합을 빠뜨렸다."), W(ans + s.b1, "other", "어긋났다."), W(s.m2 * x + s.b2, "step_missing", `${s.t.B} 의 값만 답했다.`)].filter((w) => isI(w.v) && w.v !== ans && w.v >= 0),
          verificationJs: figJs({ x }, s.fig, `${PAIR_JS}return (m1 * P.x + b1) + (m2 * P.x + b2);`),
          trace: [...pairRead(s).slice(0, 2), [`${s.t.A}(${x}) = ${s.m1 * x + s.b1} 이다.`, "Evaluate the first relationship."], [`${s.t.B}(${x}) = ${s.m2 * x + s.b2} 이다.`, "Evaluate the second relationship."], [`합 = ${ans} 이다.`, "Add."]], variant: "combined_total" }, s.fig); } },
    { op: "inverse", structure: "한 관계가 특정 값 V 일 때의 x 를 거꾸로 구한 뒤 다른 관계의 그때 값을 구함", extra: "한 식을 거꾸로 풀고 그 x 를 다른 식에 대입하는 2단 역방향 연쇄 — medium 은 한 식 역산", concepts: ["두 일차 관계 그래프", "식 세우기", "역산과 대입"],
      gen(rng) { const s = makeLinePair(rng); const x = far(s); const V = s.m2 * x + s.b2; const ans = s.m1 * x + s.b1;
        return gInst(rng, { stimulus: pairIntro(rng, s), question: `${ifCont(rng)}, when the ${s.t.ya} of ${s.t.B} is ${V} ${s.t.yu}, what is the ${s.t.ya} of ${s.t.A}, in ${s.t.yu}?`, correct: ans,
          wrongs: [W(V, "step_missing", `${s.t.B} 의 값을 답했다.`), W(x, "step_missing", "x 를 답했다."), W(s.m1 * V + s.b1, "formula_misuse", "V 를 x 로 착각해 대입했다."), W(V - s.b2 + s.b1, "step_missing", "기울기로 나누지 않았다."), W(ans + s.m1, "other", "어긋났다.")].filter((w) => isI(w.v) && w.v !== ans && w.v >= 0),
          verificationJs: figJs({ V }, s.fig, `${PAIR_JS}const x=(P.V-b2)/m2; return m1 * x + b1;`),
          trace: [...pairRead(s).slice(0, 2), [`${s.t.B}: ${s.m2}x + ${s.b2} = ${V} 에서 x = ${x} 이다.`, "Solve for x from the second relationship."],  [`x = ${x} 를 ${s.t.A} 의 식 ${s.m1}x + ${s.b1} 에 넣는다.`, "Substitute into the first relationship."], [`${s.t.A}(${x}) = ${s.m1}·${x} + ${s.b1} = ${ans} 이다.`, "Evaluate the first relationship."]], variant: "other_value_when_B_is_V" }, s.fig); } },
  ],
  em: [
    { lv: "easy", name: "read_value", structure: "그림 안의 x 에서 한 관계의 값을 읽음", extra: "easy: 값 읽기", concepts: ["두 일차 관계 그래프"],
      gen(rng) { const s = makeLinePair(rng); const x = rng.int(1, Math.max(2, s.X - 1)); const ans = s.m1 * x + s.b1; if (ans > s.yMax) throw new GenFail("range"); return gInst(rng, { stimulus: pairIntro(rng, s), question: `What is the ${s.t.ya} of ${s.t.A} when ${s.t.x} is ${x}, in ${s.t.yu}?`, correct: ans, wrongs: [W(s.m2 * x + s.b2, "step_missing", `${s.t.B} 의 값을 답했다.`), W(x, "axis_misread", "x 를 답했다."), W(ans + s.S, "other", "눈금 하나 어긋났다."), W(Math.abs(ans - s.S), "other", "눈금 하나 어긋났다.")].filter((w) => isI(w.v) && w.v !== ans && w.v >= 0), verificationJs: figJs({ x }, s.fig, `${PAIR_JS}return m1 * P.x + b1;`), trace: [...pairRead(s).slice(0, 2), [`${s.t.A}(${x}) = ${ans} 이다.`, "Evaluate."]], variant: "read_value" }, s.fig); } },
    { lv: "medium", name: "difference_read", structure: "그림 안의 x 에서 두 값의 차를 구함", extra: "medium: 차", concepts: ["두 일차 관계 그래프"],
      gen(rng) { const s = makeLinePair(rng); const x = rng.int(1, Math.max(2, s.X - 1)); const ans = -diffAt(s, x); if (ans <= 0 || s.m2 * x + s.b2 > s.yMax) throw new GenFail("neg"); return gInst(rng, { stimulus: pairIntro(rng, s), question: `How much greater is the ${s.t.ya} of ${s.t.B} than that of ${s.t.A} when ${s.t.x} is ${x}, in ${s.t.yu}?`, correct: ans, wrongs: [W(s.m1 * x + s.b1, "step_missing", `${s.t.A} 의 값만 답했다.`), W(s.m2 * x + s.b2, "step_missing", `${s.t.B} 의 값만 답했다.`), W(ans + s.S, "other", "눈금 하나 어긋났다.")].filter((w) => isI(w.v) && w.v !== ans && w.v >= 0), verificationJs: figJs({ x }, s.fig, `${PAIR_JS}return (m2 * P.x + b2) - (m1 * P.x + b1);`), trace: [...pairRead(s).slice(0, 2), [`두 값은 ${s.m1 * x + s.b1}, ${s.m2 * x + s.b2} 이다.`, "Read both values."], [`차 = ${ans} 이다.`, "Subtract."]], variant: "difference_read" }, s.fig); } },
  ],
});
