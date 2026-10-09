// linear_equations_two_var.intersection_y.LN.P — 한 그래프의 두 직선이 만나는 점의 y 값(공통 값)을 구한다. 교점은 그림 밖(직선을 연장해야 만남)이거나 안(격자점)이다.
import { GenFail } from "../../../types";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst, ifCont, makeLinePair, PAIR_JS, PAIR_X_JS, pairIntro, pairRead } from "../graph-kit";

export const ITEM = defineItem({
  prefix: "l2", itemId: "linear_equations_two_var.intersection_y.LN.P",
  hard: [
    {
      op: "chain2", structure: "그래프의 두 직선에서 식을 세워 같아지는 x 를 구한 뒤 그때의 공통 y 값을 구함", extra: "교점의 x 를 먼저 구하고 다시 대입해 y 를 구하는 연쇄(교점은 그림 밖) — medium 은 그림 안 교점의 y 읽기",
      concepts: ["두 일차 관계 그래프", "연립", "교점의 y"],
      gen(rng) {
        const s = makeLinePair(rng);
        return gInst(rng, {
          stimulus: pairIntro(rng, s), question: `${ifCont(rng)}, what will the ${s.t.ya}, in ${s.t.yu}, be at the moment ${s.t.A} and ${s.t.B} are equal?`, correct: s.yi,
          wrongs: [W(s.xi, "step_missing", "x 를 답했다."), W(s.m2 * s.xi + s.b1, "formula_misuse", "기울기와 처음 값을 섞었다."), W(s.yi + s.m1, "other", "한 단위 더 갔다."), W(s.m1 * s.X + s.b1, "condition_ignored", "그림 오른쪽 끝의 값을 답했다."), W(s.yi - s.m2, "other", "한 단위 덜 갔다.")],
          verificationJs: figJs({}, s.fig, `${PAIR_X_JS}return yi;`),
          trace: [...pairRead(s), [`x = ${s.xi} 이다.`, "Solve for x."], [`y = ${s.m1}·${s.xi} + ${s.b1} = ${s.yi} 이다.`, "Substitute back."], [`확인: ${s.m2}·${s.xi} + ${s.b2} = ${s.m2 * s.xi + s.b2} 이다.`, "Check with the other line."]], variant: "common_value_beyond_graph",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "한 직선은 그래프에서 읽고, 다른 직선은 기울기만 알려 주고 처음 값 k 를 모를 때 두 직선이 y = Y0 에서 만나도록 하는 k 를 역산", extra: "첫 직선으로 교점의 x 를 구한 뒤 둘째 직선의 상수항을 거슬러 구하는 역방향 사고 — medium 은 교점 y 읽기",
      concepts: ["일차 관계 그래프", "교점 조건", "상수항 역산"],
      gen(rng) {
        const s = makeLinePair(rng); const x = s.X + rng.int(1, 10); if (x === s.xi) throw new GenFail("same"); const Y0 = s.m1 * x + s.b1; const k = Y0 - s.m2 * x; if (k === s.b2 || k < 0) throw new GenFail("same");
        return gInst(rng, {
          stimulus: `${pairIntro(rng, s)} ${rng.pick([`Suppose the graph of ${s.t.B} is replaced by a line with the same rate of change but a different starting value $k$, in ${s.t.yu}, where $k$ is a constant.`, `Suppose ${s.t.B} is changed to a relationship with the same rate of change as shown, but with a starting value of $k$ ${s.t.yu}.`])}`,
          question: `For what value of $k$ will ${s.t.A} and the changed ${s.t.B} be equal to ${Y0} ${s.t.yu}?`, correct: k,
          wrongs: [W(s.b2, "condition_ignored", "원래 처음 값을 답했다."), W(k + s.m2, "other", "한 단위 어긋났다."), W(Y0 - s.m1 * x + s.b1, "formula_misuse", "다른 직선의 기울기를 썼다."), W(x, "step_missing", "교점의 x 를 답했다."), W(Y0, "step_missing", "공통 값을 답했다.")].filter((w) => w.v !== k),
          verificationJs: figJs({ Y0 }, s.fig, `${PAIR_JS}const x = (P.Y0 - b1) / m1; return P.Y0 - m2 * x;`),
          trace: [...pairRead(s).slice(0, 2), [`${s.t.A}: ${s.m1}x + ${s.b1} = ${Y0} 에서 x = ${x} 이다.`, "Find the input where the first line reaches Y0."], [`바뀐 ${s.t.B}: ${s.m2}x + k = ${Y0} 이고 x = ${x} 이다.`, "The changed line must also reach Y0 there."], [`k = ${Y0} - ${s.m2}·${x} = ${k} 이다.`, "Solve for k."]], variant: "constant_for_meeting_value",
        }, s.fig);
      },
    },
    {
      op: "constraint_select", structure: "두 직선의 교점 x 가 정수가 아닐 때, 처음으로 직선 1 의 값이 직선 2 보다 커지는 최소 정수 x 에서 직선 1 의 값을 구함", extra: "연립 해가 정수가 아니어서 올림 후 대입해야 함(내림·교점 y 를 쓰는 함정) — medium 은 교점 y 읽기",
      concepts: ["두 일차 관계 그래프", "일차부등식", "정수 조건과 대입"],
      gen(rng) {
        const s = makeLinePair(rng, { fracX: true }); const n = Math.floor(s.xi) + 1; const correct = s.m1 * n + s.b1;
        return gInst(rng, {
          stimulus: pairIntro(rng, s), question: `${ifCont(rng)}, ${s.t.A} first has a greater ${s.t.ya} than ${s.t.B} at a whole-number value of ${s.t.x}. What is the ${s.t.ya} of ${s.t.A}, in ${s.t.yu}, at that value?`, correct,
          wrongs: [W(Math.round(s.yi), "condition_ignored", "교점의 y 를 반올림해 답했다."), W(s.m1 * Math.floor(s.xi) + s.b1, "condition_ignored", "내림한 x 에서 계산했다."), W(n, "step_missing", "x 를 답했다."), W(s.m2 * n + s.b2, "formula_misuse", "다른 직선의 값을 답했다."), W(correct + s.m1, "other", "한 단위 더 갔다.")].filter((w) => w.v !== correct),
          verificationJs: figJs({}, s.fig, `${PAIR_X_JS}for (let x = 0; x <= 5000; x++) if (m1 * x + b1 > m2 * x + b2) return m1 * x + b1; throw new Error('해 없음');`),
          trace: [...pairRead(s), [`(${s.m1} - ${s.m2})x > ${s.b2 - s.b1} 에서 x > ${fmtNum(Math.round(s.xi * 100) / 100)} 이다.`, "Solve the inequality."], [`가장 작은 정수 x = ${n} 이다.`, "Least whole number."], [`${s.t.A} = ${s.m1}·${n} + ${s.b1} = ${correct} 이다.`, "Evaluate the first line."]], variant: "value_at_first_overtake",
        }, s.fig);
      },
    },
    {
      op: "compose_kind", structure: "두 직선이 만나는 순간의 값을 구한 뒤, 같은 순간 그 값에서 출발해 일정한 비율로 변하는 셋째 관계의 이후 값을 구함", extra: "교점의 y 를 새 관계의 출발 값으로 이어 쓰는 합성(앞 결과가 다른 관계의 입력) — medium 은 교점 y 읽기",
      concepts: ["두 일차 관계 그래프", "교점의 y", "합성 일차 관계"],
      gen(rng) {
        const s = makeLinePair(rng); const r = rng.int(2, 9) * (rng.chance(0.6) ? 1 : -1); const t = rng.int(2, 8); const correct = s.yi + r * t; if (correct <= 0) throw new GenFail("neg");
        const chg = r < 0 ? `decreases by ${Math.abs(r)}` : `increases by ${r}`;
        return gInst(rng, {
          stimulus: `${pairIntro(rng, s)} At the moment ${s.t.A} and ${s.t.B} are equal, a third quantity starts at that common value of the ${s.t.ya} and then ${chg} ${s.t.yu} for each 1 ${s.t.xu.replace(/s$/, "")} that passes.`,
          question: `${ifCont(rng)}, what will the third quantity be, in ${s.t.yu}, ${t} ${s.t.xu} after that moment?`, correct,
          wrongs: [W(s.yi, "step_missing", "시작 값을 답했다."), W(s.yi - r * t, "sign_error", "부호를 반대로 했다."), W(r * t, "step_missing", "변화량만 답했다."), W(s.xi + r * t, "formula_misuse", "x 를 시작 값으로 썼다."), W(correct + r, "other", "한 단위 어긋났다.")].filter((w) => w.v !== correct),
          verificationJs: figJs({ r, t }, s.fig, `${PAIR_X_JS}return yi + P.r * P.t;`),
          trace: [...pairRead(s), [`교점: x = ${s.xi}, 공통 값 y = ${s.yi} 이다.`, "Find the common value."], [`${t} 후: ${s.yi} ${r < 0 ? "-" : "+"} ${Math.abs(r)}·${t} = ${correct} 이다.`, "Apply the third relationship."]], variant: "third_quantity_from_common_value",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "read_meeting_value", structure: "그림 안에서 두 직선이 격자점에서 만날 때 그 점의 y 값을 읽음", extra: "easy: 교점의 높이 읽기", concepts: ["두 일차 관계 그래프", "교점 읽기"],
      gen(rng) {
        const s = makeLinePair(rng, { inside: true });
        return gInst(rng, { stimulus: pairIntro(rng, s), question: `According to the graph, what is the ${s.t.ya}, in ${s.t.yu}, at the point where ${s.t.A} and ${s.t.B} are equal?`, correct: s.yi, wrongs: [W(s.xi, "axis_misread", "x 를 답했다."), W(s.b1, "axis_misread", "한 직선의 처음 값을 답했다."), W(s.yi + s.S, "axis_misread", "눈금 한 칸 위를 읽었다."), W(Math.max(0, s.yi - s.S), "axis_misread", "눈금 한 칸 아래를 읽었다.")].filter((w) => w.v !== s.yi), verificationJs: figJs({}, s.fig, `${PAIR_X_JS}return yi;`), trace: [[`두 직선이 만나는 점을 찾는다.`, "Find where the lines cross."], [`그 점의 높이는 ${s.yi} 이다.`, "Read its height."]], variant: "read_intersection_height",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "value_at_end", structure: "한 직선에서 기울기·처음 값을 구해 그림 오른쪽 끝(격자선)에서의 값을 구함", extra: "medium: 식을 세워 한 번 대입", concepts: ["일차 관계 그래프", "함숫값"],
      gen(rng) {
        const s = makeLinePair(rng); const v = s.m1 * s.X + s.b1;
        return gInst(rng, { stimulus: pairIntro(rng, s), question: `According to the graph, what is the ${s.t.ya} of ${s.t.A}, in ${s.t.yu}, when ${s.t.x} is ${s.X}?`, correct: v, wrongs: [W(s.m1 * s.X, "step_missing", "처음 값을 더하지 않았다."), W(s.b1, "axis_misread", "처음 값을 답했다."), W(s.m2 * s.X + s.b2, "formula_misuse", "다른 직선의 값을 답했다."), W(v + s.S, "axis_misread", "눈금 한 칸 어긋나게 읽었다.")].filter((w) => w.v !== v), verificationJs: figJs({ X: s.X }, s.fig, `${PAIR_JS}return m1 * P.X + b1;`), trace: [...pairRead(s).slice(0, 1), [`x = ${s.X} 에서 ${s.m1}·${s.X} + ${s.b1} = ${v} 이다.`, "Evaluate."], [`그래프의 오른쪽 끝에서 ${s.t.A} 의 높이와 같다.`, "Matches the graph at the right edge."]], variant: "value_at_right_edge",
        }, s.fig);
      },
    },
  ],
});
