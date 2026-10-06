// linear_equations_two_var.intersection_x.LN.P — 한 그래프에 두 일차 관계(직선 둘)가 있고, 두 관계가 같아지는 x 를 구한다(교점은 그림 밖: 직선을 연장해야 만난다).
import { GenFail } from "../../../types";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst, ifCont, makeLinePair, PAIR_JS, PAIR_X_JS, pairIntro, pairRead } from "../graph-kit";

export const ITEM = defineItem({
  prefix: "l2", itemId: "linear_equations_two_var.intersection_x.LN.P",
  hard: [
    {
      op: "compare_scenarios", structure: "그래프의 두 관계 각각의 기울기·처음 값을 구하고, 두 관계의 값이 같아지는 x(그래프 밖)를 구함", extra: "두 직선에서 각각 식을 세워 연립해야 함(그림 안에서는 만나지 않는다) — medium 은 한 관계의 식",
      concepts: ["두 일차 관계 그래프", "식 세우기", "교점의 x"],
      gen(rng) {
        const s = makeLinePair(rng);
        return gInst(rng, {
          stimulus: pairIntro(rng, s), question: `${ifCont(rng)}, for what value of ${s.t.x} will ${s.t.A} and ${s.t.B} have the same ${s.t.ya}?`, correct: s.xi,
          wrongs: [W(Math.round((s.b2 - s.b1) / s.m1), "step_missing", "한 관계의 기울기로만 나눴다."), W(s.xi + 1, "other", "한 단위 어긋났다."), W(Math.round((s.b2 + s.b1) / (s.m1 - s.m2)), "sign_error", "처음 값을 더했다."), W(s.X, "condition_ignored", "그림 오른쪽 끝의 x 를 답했다."), W(Math.max(1, s.xi - 2), "other", "계산 중 어긋났다.")],
          verificationJs: figJs({}, s.fig, `${PAIR_X_JS}return xi;`),
          trace: [...pairRead(s), [`(${s.m1} - ${s.m2})x = ${s.b2} - ${s.b1} 이다.`, "Collect terms."], [`x = ${s.b2 - s.b1} ÷ ${s.m1 - s.m2} = ${s.xi} 이다.`, "Solve for x."]], variant: "equal_value_input",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "두 관계가 같아지는 x 를 구한 뒤, 그때의 공통 값을 구함", extra: "교점의 x 를 먼저 구하고 다시 대입해 y 를 구하는 연쇄 — medium 은 한 관계의 식",
      concepts: ["두 일차 관계 그래프", "연립", "교점의 y"],
      gen(rng) {
        const s = makeLinePair(rng); const y = s.m1 * s.xi + s.b1;
        return gInst(rng, {
          stimulus: pairIntro(rng, s), question: `${ifCont(rng)}, what will the ${s.t.ya}, in ${s.t.yu}, be at the moment ${s.t.A} and ${s.t.B} are equal?`, correct: y,
          wrongs: [W(s.xi, "step_missing", "x 를 답했다."), W(s.m2 * s.xi + s.b1, "formula_misuse", "기울기와 처음 값을 섞었다."), W(y + s.m1, "other", "한 단위 더 갔다."), W(s.m1 * s.X + s.b1, "condition_ignored", "그림 오른쪽 끝에서의 값을 답했다."), W(y - s.m2, "other", "한 단위 덜 갔다.")],
          verificationJs: figJs({}, s.fig, `${PAIR_X_JS}return m1 * xi + b1;`),
          trace: [...pairRead(s), [`x = ${s.xi} 이다.`, "Solve for x."], [`y = ${s.m1}·${s.xi} + ${s.b1} = ${y} 이다.`, "Substitute back."], [`확인: ${s.m2}·${s.xi} + ${s.b2} = ${s.m2 * s.xi + s.b2} 이다.`, "Check with the other model."]], variant: "common_value",
        }, s.fig);
      },
    },
    {
      op: "constraint_select", structure: "두 관계의 교점 x 가 정수가 아닐 때, 처음으로 관계 1 의 값이 관계 2 보다 커지는 최소 정수 x 를 구함", extra: "연립 해가 정수가 아니어서 부등식으로 바꾸고 올림해야 함(내림·반올림 함정) — medium 은 교점 x(정수)",
      concepts: ["두 일차 관계 그래프", "일차부등식", "정수 조건(올림)"],
      gen(rng) {
        const s = makeLinePair(rng, { fracX: true }); const correct = Math.floor(s.xi) + 1;
        return gInst(rng, {
          stimulus: pairIntro(rng, s), question: `${ifCont(rng)}, what is the least whole-number value of ${s.t.x} for which the ${s.t.ya} of ${s.t.A} is greater than that of ${s.t.B}?`, correct,
          wrongs: [W(Math.floor(s.xi), "condition_ignored", "내림했다."), W(correct + 1, "other", "한 단위 더 갔다."), W(Math.round((s.b2 - s.b1) / s.m1), "step_missing", "한 기울기로만 나눴다."), W(s.X + 1, "condition_ignored", "그림 오른쪽 끝 다음 값을 답했다."), W(correct + 2, "other", "계산 중 어긋났다.")],
          verificationJs: figJs({}, s.fig, `${PAIR_X_JS}for (let x = 0; x <= 5000; x++) if (m1 * x + b1 > m2 * x + b2) return x; throw new Error('해 없음');`),
          trace: [...pairRead(s), [`${s.m1 - s.m2}x > ${s.b2 - s.b1} 이다.`, "Write the inequality."], [`x > ${fmtNum(Math.round(s.xi * 100) / 100)} 이다.`, "Solve."], [`가장 작은 정수는 ${correct} 이다.`, "Least whole number above the bound."]], variant: "first_whole_overtake",
        }, s.fig);
      },
    },
    {
      op: "param_condition", structure: "관계 2 의 모든 값에 k 를 더했을 때 두 관계가 지문의 x = X 에서 같아지는 k 를 구함", extra: "두 식을 세우고, 교점 조건(x = X 에서 같음)을 만족하는 매개변수 k 를 역산해야 함 — medium 은 교점 x",
      concepts: ["두 일차 관계 그래프", "매개변수 조건", "교점 위치"],
      gen(rng) {
        const s = makeLinePair(rng); const X = s.xi + rng.nz(-4, 6); if (X <= s.X || X === s.xi) throw new GenFail("X"); const k = (s.m1 * X + s.b1) - (s.m2 * X + s.b2);
        return gInst(rng, {
          stimulus: `${pairIntro(rng, s)} ${rng.pick([`Suppose every value of the ${s.t.ya} for ${s.t.B} is changed by the same amount $k$, where $k$ is a constant.`, `Suppose the same constant $k$ is added to each ${s.t.ya} value for ${s.t.B}.`, `A change adds a constant $k$ to the ${s.t.ya} of ${s.t.B} at every value of ${s.t.x}, where $k$ is a constant.`])}`,
          question: `For what value of $k$ will ${s.t.A} and ${s.t.B} have the same ${s.t.ya} when ${s.t.x} is ${X}?`, correct: k,
          wrongs: [W(-k, "sign_error", "부호를 반대로 했다."), W(s.m1 * X + s.b1, "step_missing", "한 관계의 값만 답했다."), W((s.m1 - s.m2) * X, "step_missing", "처음 값의 차를 무시했다."), W(k + s.m1 - s.m2, "other", "한 단위 어긋났다."), W(s.b2 - s.b1, "formula_misuse", "처음 값의 차만 답했다.")].filter((w) => w.v !== k),
          verificationJs: figJs({ X }, s.fig, `${PAIR_X_JS}return (m1 * P.X + b1) - (m2 * P.X + b2);`),
          trace: [...pairRead(s).slice(0, 2), [`x = ${X} 에서 ${s.t.A} = ${s.m1 * X + s.b1} 이다.`, "Value of the first model at X."], [`x = ${X} 에서 ${s.t.B} = ${s.m2 * X + s.b2} 이다.`, "Value of the second model at X."], [`k = ${s.m1 * X + s.b1} - ${s.m2 * X + s.b2} = ${k} 이다.`, "Required shift."]], variant: "shift_to_meet_at_X",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "start_gap", structure: "두 직선의 y 절편(x = 0 에서의 값)을 그래프에서 읽어 차를 구함", extra: "easy: 두 y 절편의 차", concepts: ["두 일차 관계 그래프", "차"],
      gen(rng) {
        const s = makeLinePair(rng); const c = Math.abs(s.b2 - s.b1);
        return gInst(rng, { stimulus: pairIntro(rng, s), question: `According to the graph, when ${s.t.x} is 0, what is the positive difference between the ${s.t.ya} of ${s.t.A} and of ${s.t.B}, in ${s.t.yu}?`, correct: c, wrongs: [W(s.b1, "step_missing", "한 값만 답했다."), W(s.b2, "step_missing", "한 값만 답했다."), W(s.b1 + s.b2, "sign_error", "합을 구했다."), W(c + s.S, "axis_misread", "눈금 한 칸 어긋나게 읽었다.")].filter((w) => w.v !== c && w.v > 0), verificationJs: figJs({}, s.fig, `${PAIR_JS}return Math.abs(b2 - b1);`), trace: [[`x = 0 에서 ${s.t.A} = ${s.b1}, ${s.t.B} = ${s.b2} 이다.`, "Read both y-intercepts."], [`차 = ${c} 이다.`, "Difference."]], variant: "start_gap",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "gap_closing", structure: "두 직선의 차가 한 단위마다 얼마씩 줄어드는지(기울기의 차) 구함", extra: "medium: 두 기울기의 차", concepts: ["두 일차 관계 그래프", "변화율 비교"],
      gen(rng) {
        const s = makeLinePair(rng); const c = s.m1 - s.m2;
        return gInst(rng, { stimulus: pairIntro(rng, s), question: `As ${s.t.x} increases by 1, by how many ${s.t.yu} does the difference between the ${s.t.ya} of ${s.t.B} and of ${s.t.A} decrease?`, correct: c, wrongs: [W(s.m1, "step_missing", "한 기울기만 답했다."), W(s.m2, "step_missing", "한 기울기만 답했다."), W(s.m1 + s.m2, "sign_error", "합을 구했다."), W(c + 1, "other", "계산 중 어긋났다.")].filter((w) => w.v !== c), verificationJs: figJs({}, s.fig, `${PAIR_X_JS}return m1 - m2;`), trace: [[`${s.t.A} 의 기울기 ${s.m1}, ${s.t.B} 의 기울기 ${s.m2} 이다.`, "Two slopes."], [`x 가 1 늘 때 두 값의 차는 ${s.m1} - ${s.m2} 만큼 변한다.`, "Each unit changes the gap by the difference of slopes."], [`따라서 차는 한 단위마다 ${c} 씩 줄어든다.`, "The gap closes by that amount."]], variant: "gap_closing_rate",
        }, s.fig);
      },
    },
  ],
});
