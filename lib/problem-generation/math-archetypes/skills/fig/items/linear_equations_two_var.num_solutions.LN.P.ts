// linear_equations_two_var.num_solutions.LN.P — 그래프의 직선(들)에서 두 관계가 같아지는 경우의 수(해의 개수)와 그 조건을 따진다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst, makeLinePair, PAIR_JS, pairIntro } from "../graph-kit";

const rd = (s: { t: { A: string; B: string }; m1: number; b1: number; m2: number; b2: number }): [string, string][] => [
  [`${s.t.A}: y 절편 ${s.b1} 과 격자점을 읽어 기울기 ${s.m1} 을 구한다.`, `${s.t.A}: starting value and slope from the graph.`],
  [`${s.t.B}: y 절편 ${s.b2} 과 격자점을 읽어 기울기 ${s.m2} 를 구한다.`, `${s.t.B}: starting value and slope from the graph.`],
];

export const ITEM = defineItem({
  prefix: "l2", itemId: "linear_equations_two_var.num_solutions.LN.P",
  hard: [
    {
      op: "param_condition", structure: "그래프의 직선 A 와 기울기만 k 로 바꾼 직선 B 가 같아지는 순간이 없도록(해가 없도록) 하는 k 를 구함", extra: "기울기 일치 조건(평행)을 떠올려 A 의 기울기를 그래프에서 구해야 함 — medium 은 그림 속 두 직선의 공통점 개수",
      concepts: ["일차 관계 그래프", "해의 개수", "평행 조건"],
      gen(rng) {
        const s = makeLinePair(rng); const k = s.m1;
        return gInst(rng, {
          stimulus: `${pairIntro(rng, s)} Suppose the rate of change of ${s.t.B} is changed to $k$ ${s.t.yu} per ${s.t.xu.replace(/s$/, "")}, where $k$ is a constant, while its starting value (${s.b2} ${s.t.yu}) stays the same.`,
          question: rng.pick([`For what value of $k$ will ${s.t.A} and the changed ${s.t.B} never have the same ${s.t.ya}?`, `For which value of $k$ is there no value of ${s.t.x} at which ${s.t.A} and the changed ${s.t.B} are equal?`, `If ${s.t.A} and the changed ${s.t.B} are never equal at any value of ${s.t.x}, what is $k$?`]), correct: k,
          wrongs: [W(s.m2, "condition_ignored", "원래 기울기를 답했다."), W(k + 1, "other", "한 단위 어긋났다."), W(s.b1, "formula_misuse", "처음 값을 답했다."), W(k * 2, "other", "계산 중 어긋났다."), W(Math.max(1, k - 1), "other", "한 단위 어긋났다.")].filter((w) => w.v !== k),
          verificationJs: figJs({ b2: s.b2 }, s.fig, `${PAIR_JS}return m1;`),
          trace: [...rd(s), [`같아지는 순간이 없으려면 두 직선이 평행해야 하고, 처음 값은 서로 달라야 한다(${s.b1} ≠ ${s.b2}).`, "No solution means parallel, distinct lines."], [`따라서 k = ${s.t.A} 의 기울기 = ${k} 이다.`, "k equals the slope of the first line."], [`확인: k = ${k} 이면 두 직선의 기울기가 같고 처음 값(${s.b1}, ${s.b2})이 달라 평행이다.`, "Check: parallel and distinct."]], variant: "rate_for_no_solution",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "직선 A 와 B 가 겹쳐(해가 무수히 많아) 하도록 B 의 기울기 k 와 처음 값 c 를 정하고 k + c 를 구함", extra: "해가 무수히 많으려면 기울기·처음 값이 모두 같아야 함 — 두 값을 그래프에서 읽어 더해야 함 — medium 은 공통점 개수",
      concepts: ["일차 관계 그래프", "해의 개수", "동일한 직선"],
      gen(rng) {
        const s = makeLinePair(rng); const k = s.m1, c = s.b1; const sum = k + c;
        return gInst(rng, {
          stimulus: `${pairIntro(rng, s)} Suppose ${s.t.B} is changed to a relationship with a rate of change of $k$ ${s.t.yu} per ${s.t.xu.replace(/s$/, "")} and a starting value of $c$ ${s.t.yu}, where $k$ and $c$ are constants.`,
          question: rng.pick([`If ${s.t.A} and the changed ${s.t.B} are equal at every value of ${s.t.x}, what is the value of $k + c$?`, `The changed ${s.t.B} gives the same ${s.t.ya} as ${s.t.A} at every value of ${s.t.x}. What is $k + c$?`, `For ${s.t.A} and the changed ${s.t.B} to be equal for all values of ${s.t.x}, what must $k + c$ be?`]), correct: sum,
          wrongs: [W(k, "step_missing", "k 만 답했다."), W(c, "step_missing", "c 만 답했다."), W(s.m2 + s.b2, "condition_ignored", "원래 B 의 값을 더했다."), W(sum + 1, "other", "한 단위 어긋났다."), W(k * c, "formula_misuse", "곱했다.")].filter((w) => w.v !== sum),
          verificationJs: figJs({}, s.fig, `${PAIR_JS}return m1 + b1;`),
          trace: [...rd(s), [`모든 x 에서 같으려면 두 직선이 같아야 한다: k = ${k}, c = ${c}.`, "Identical lines."], [`k + c = ${sum} 이다.`, "Add."], [`확인: 기울기와 처음 값이 모두 같으면 두 직선이 완전히 겹친다.`, "Identical lines overlap everywhere."]], variant: "sum_for_infinite_solutions",
        }, s.fig);
      },
    },
    {
      op: "constraint_select", structure: "직선 A 와 기울기가 정수 k(1 ≤ k ≤ N) 인 직선 B(처음 값은 다름)가 정확히 한 번 같아지는 k 의 개수를 구함", extra: "A 의 기울기를 그래프에서 읽어 그 값만 제외(평행)함을 알아야 함 — medium 은 공통점 개수",
      concepts: ["일차 관계 그래프", "해의 개수", "정수 개수"],
      gen(rng) {
        const s = makeLinePair(rng); const N = s.m1 + rng.int(2, 9); const correct = N - 1;
        return gInst(rng, {
          stimulus: `${pairIntro(rng, s)} Suppose the starting value of ${s.t.B} stays at ${s.b2} ${s.t.yu}, but its rate of change is changed to $k$ ${s.t.yu} per ${s.t.xu.replace(/s$/, "")}, where $k$ is a whole number from 1 to ${N}, inclusive.`,
          question: rng.pick([`For how many of these values of $k$ will ${s.t.A} and the changed ${s.t.B} be equal at exactly one value of ${s.t.x}?`, `How many of the possible values of $k$ give exactly one value of ${s.t.x} at which the two relationships are equal?`, `Of the whole numbers $k$ allowed, how many make the two relationships equal at exactly one value of ${s.t.x}?`]), correct,
          wrongs: [W(N, "condition_ignored", "평행한 경우를 빼지 않았다."), W(N - 2, "other", "하나 더 뺐다."), W(1, "step_missing", "평행한 경우만 셌다."), W(N - s.m1, "formula_misuse", "기울기 차로 계산했다."), W(correct + 1, "other", "한 단위 어긋났다.")].filter((w) => w.v !== correct && w.v > 0),
          verificationJs: figJs({ N, b2: s.b2 }, s.fig, `${PAIR_JS}let c = 0; for (let k = 1; k <= P.N; k++) if (k !== m1 || b1 === P.b2) c++; return c;`),
          trace: [...rd(s), [`k = ${s.m1}(A 의 기울기)이면 두 직선은 평행(처음 값이 다름)하므로 한 번도 만나지 않는다.`, "Parallel when k equals the slope of A."], [`나머지 ${N} - 1 = ${correct} 개의 k 에서는 정확히 한 번 만난다.`, "All other values give exactly one meeting."], [`따라서 개수는 ${correct} 이다.`, "State the count."]], variant: "count_k_with_one_solution",
        }, s.fig);
      },
    },
    {
      op: "compose_kind", structure: "평행한 두 직선의 그래프에서 두 값의 차가 어떤 x 에서도 일정함을 이용해 그림 밖 x 에서의 차를 구함", extra: "평행(기울기 같음)임을 알아보고 처음 값의 차가 모든 x 에서의 차임을 써야 함 — medium 은 공통점 개수",
      concepts: ["평행한 두 일차 관계 그래프", "일정한 차", "해의 개수"],
      gen(rng) {
        const s = makeLinePair(rng, { parallel: true }); const X1 = s.X + rng.int(2, 15); const correct = s.b2 - s.b1;
        return gInst(rng, {
          stimulus: pairIntro(rng, s),
          question: rng.pick([`If the lines are extended, how many ${s.t.yu} greater is the ${s.t.ya} of ${s.t.B} than that of ${s.t.A} when ${s.t.x} is ${X1}?`, `When ${s.t.x} is ${X1}, by how many ${s.t.yu} does the ${s.t.ya} of ${s.t.B} exceed that of ${s.t.A}, assuming both relationships continue?`]), correct,
          wrongs: [W(s.b2 + s.m1 * X1, "step_missing", "B 의 값을 답했다."), W(s.b1 + s.m1 * X1, "step_missing", "A 의 값을 답했다."), W(correct + s.m1, "other", "기울기를 더했다."), W(correct * 2, "other", "계산 중 어긋났다."), W(correct - s.S, "axis_misread", "눈금 한 칸 어긋나게 읽었다.")].filter((w) => w.v !== correct && w.v > 0),
          verificationJs: figJs({ X1 }, s.fig, `${PAIR_JS}if (m1 !== m2) throw new Error('평행 아님'); return (m2 * P.X1 + b2) - (m1 * P.X1 + b1);`),
          trace: [...rd(s), [`기울기가 같아(${s.m1}) 두 직선은 평행하다.`, "Equal slopes: parallel lines."], [`평행선의 세로 간격은 모든 x 에서 ${s.b2} - ${s.b1} = ${correct} 로 같다.`, "The vertical gap is constant."], [`x = ${X1} 에서도 차는 ${correct} 이다.`, "The same gap at the requested input."]], variant: "constant_gap_parallel",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "gap_between_parallel", structure: "평행한 두 직선의 그래프에서 한 격자선 x 에서 두 값의 차를 읽음", extra: "easy: 두 직선 사이의 세로 간격 읽기", concepts: ["평행한 두 일차 관계 그래프", "차"],
      gen(rng) {
        const s = makeLinePair(rng, { parallel: true }); const x1 = s.xStep * rng.int(1, s.X / s.xStep); const correct = s.b2 - s.b1;
        return gInst(rng, { stimulus: pairIntro(rng, s), question: `According to the graph, by how many ${s.t.yu} is the ${s.t.ya} of ${s.t.B} greater than that of ${s.t.A} when ${s.t.x} is ${x1}?`, correct, wrongs: [W(s.m1 * x1 + s.b2, "axis_misread", "B 의 값을 답했다."), W(s.m1 * x1 + s.b1, "axis_misread", "A 의 값을 답했다."), W(correct + s.S, "axis_misread", "눈금 한 칸 어긋나게 읽었다."), W(Math.max(1, correct - s.S), "axis_misread", "눈금 한 칸 어긋나게 읽었다.")].filter((w) => w.v !== correct && w.v > 0), verificationJs: figJs({ x1 }, s.fig, `${PAIR_JS}return (m2 * P.x1 + b2) - (m1 * P.x1 + b1);`), trace: [[`x = ${x1} 에서 두 직선의 높이를 읽는다: ${s.m1 * x1 + s.b1}, ${s.m1 * x1 + s.b2}.`, "Read both heights."], [`차 = ${correct} 이다. 평행하므로 모든 x 에서 같다.`, "Parallel lines keep a constant gap."]], variant: "gap_between_parallel_lines",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "rate_gap", structure: "두 직선의 기울기 차를 구함(교차 속도)", extra: "medium: 두 기울기를 읽어 차 구하기", concepts: ["두 일차 관계 그래프", "기울기"],
      gen(rng) {
        const s = makeLinePair(rng); const correct = s.m1 - s.m2; if (correct <= 0) throw new GenFail("neg");
        return gInst(rng, { stimulus: pairIntro(rng, s), question: `By how many ${s.t.yu} per ${s.t.xu.replace(/s$/, "")} does the rate of change of ${s.t.A} exceed that of ${s.t.B}?`, correct, wrongs: [W(s.m1, "step_missing", "한 기울기만 답했다."), W(s.m2, "step_missing", "한 기울기만 답했다."), W(s.m1 + s.m2, "sign_error", "합을 구했다."), W(correct + 1, "other", "한 단위 어긋났다.")].filter((w) => w.v !== correct), verificationJs: figJs({}, s.fig, `${PAIR_JS}return m1 - m2;`), trace: [...rd(s), [`기울기의 차 = ${s.m1} - ${s.m2} = ${correct} 이다.`, "Difference of slopes."], [`따라서 ${correct} ${s.t.yu} 만큼 더 빠르다.`, "State the difference."]], variant: "slope_gap",
        }, s.fig);
      },
    },
  ],
});
