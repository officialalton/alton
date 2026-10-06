// linear_equations_two_var.intersection_sum — 한 그래프의 두 직선이 만나는 점의 좌표 합 x + y 를 구한다.
import { GenFail } from "../../../types";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst, ifCont, makeLinePair, PAIR_JS, PAIR_X_JS, pairIntro, pairRead } from "../graph-kit";

export const ITEM = defineItem({
  prefix: "l2", itemId: "linear_equations_two_var.intersection_sum.LN.P",
  hard: [
    {
      op: "compose_kind", structure: "그래프의 두 직선이 만나는 점(그림 밖)의 x 와 y 를 구해 합 x + y 를 계산", extra: "교점의 두 좌표를 모두 구해 결합해야 함(x 만·y 만 답하는 함정) — medium 은 그림 안 교점의 좌표 합 읽기",
      concepts: ["두 일차 관계 그래프", "연립", "좌표 합"],
      gen(rng) {
        const s = makeLinePair(rng); const sum = s.xi + s.yi;
        return gInst(rng, {
          stimulus: pairIntro(rng, s), question: `${ifCont(rng)}, ${s.t.A} and ${s.t.B} are equal when ${s.t.x} is $x$ and the ${s.t.ya} is $y$ ${s.t.yu}. What is the value of $x + y$?`, correct: sum,
          wrongs: [W(s.xi, "step_missing", "x 만 답했다."), W(s.yi, "step_missing", "y 만 답했다."), W(s.yi - s.xi, "sign_error", "차를 구했다."), W(sum + s.m1, "other", "한 단위 더 갔다."), W(s.xi + s.m1 * s.X + s.b1, "condition_ignored", "그림 오른쪽 끝에서의 값을 더했다.")].filter((w) => w.v !== sum),
          verificationJs: figJs({}, s.fig, `${PAIR_X_JS}return xi + yi;`),
          trace: [...pairRead(s), [`x = ${s.xi} 이다.`, "Solve for x."], [`y = ${s.m1}·${s.xi} + ${s.b1} = ${s.yi} 이다.`, "Substitute back."], [`x + y = ${s.xi} + ${s.yi} = ${sum} 이다.`, "Add the coordinates."]], variant: "sum_of_meeting_coordinates",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "한 직선은 그래프에서 읽고 다른 직선은 기울기만 알려 줄 때, 두 직선이 만나는 점의 좌표 합이 S 가 되도록 하는 처음 값 k 를 역산", extra: "x + y = S 로 교점을 먼저 정하고 둘째 직선의 상수항을 거슬러 구함 — medium 은 좌표 합 읽기",
      concepts: ["일차 관계 그래프", "좌표 합 조건", "상수항 역산"],
      gen(rng) {
        const s = makeLinePair(rng); const x = s.X + rng.int(1, 8); const y = s.m1 * x + s.b1; const S = x + y; const k = y - s.m2 * x; if (k === s.b2 || k < 0) throw new GenFail("same");
        return gInst(rng, {
          stimulus: `${pairIntro(rng, s)} Suppose ${s.t.B} is changed to a relationship with the same rate of change as shown, but with a starting value of $k$ ${s.t.yu}, where $k$ is a constant.`,
          question: rng.pick([`${ifCont(rng)}, ${s.t.A} and the changed ${s.t.B} are equal when ${s.t.x} is $x$ and the ${s.t.ya} is $y$ ${s.t.yu}, with $x + y = ${S}$. What is the value of $k$?`, `The two relationships are equal at the point where $x + y = ${S}$, with $x$ being ${s.t.x} and $y$ the ${s.t.ya} in ${s.t.yu}. ${ifCont(rng)}. What must $k$ be?`, `${ifCont(rng)}, there is a value of ${s.t.x}, $x$, at which ${s.t.A} and the changed ${s.t.B} give the same ${s.t.ya}, $y$, and $x + y = ${S}$. Find $k$.`]), correct: k,
          wrongs: [W(s.b2, "condition_ignored", "원래 처음 값을 답했다."), W(y, "step_missing", "공통 값을 답했다."), W(k + s.m2, "other", "한 단위 어긋났다."), W(S - s.m2 * x, "formula_misuse", "합을 y 로 보았다."), W(x, "step_missing", "교점의 x 를 답했다.")].filter((w) => w.v !== k),
          verificationJs: figJs({ S }, s.fig, `${PAIR_JS}const x = (P.S - b1) / (m1 + 1); const y = m1 * x + b1; return y - m2 * x;`),
          trace: [...pairRead(s).slice(0, 2), [`x + (${s.m1}x + ${s.b1}) = ${S} 에서 x = ${x} 이다.`, "Use the sum condition on the first line."], [`y = ${s.m1}·${x} + ${s.b1} = ${y} 이다.`, "Find y."], [`${s.m2}·${x} + k = ${y} 에서 k = ${k} 이다.`, "Solve for k."]], variant: "constant_for_given_sum",
        }, s.fig);
      },
    },
    {
      op: "constraint_select", structure: "두 직선의 교점 x 가 정수가 아닐 때, 처음으로 직선 1 의 값이 직선 2 보다 커지는 최소 정수 x 와 그때 직선 1 의 값의 합을 구함", extra: "올림한 정수 x 를 찾고 같은 x 의 값과 합해야 함(교점 좌표를 쓰는 함정) — medium 은 좌표 합 읽기",
      concepts: ["두 일차 관계 그래프", "일차부등식", "정수 조건"],
      gen(rng) {
        const s = makeLinePair(rng, { fracX: true }); const n = Math.floor(s.xi) + 1; const v = s.m1 * n + s.b1; const correct = n + v;
        return gInst(rng, {
          stimulus: pairIntro(rng, s), question: `${ifCont(rng)}, let $n$ be the least whole-number value of ${s.t.x} for which ${s.t.A} has a greater ${s.t.ya} than ${s.t.B}, and let $v$ be the ${s.t.ya} of ${s.t.A}, in ${s.t.yu}, at that value. What is the value of $n + v$?`, correct,
          wrongs: [W(Math.floor(s.xi) + s.m1 * Math.floor(s.xi) + s.b1, "condition_ignored", "내림한 x 를 썼다."), W(v, "step_missing", "v 만 답했다."), W(n, "step_missing", "n 만 답했다."), W(Math.round(s.xi + s.yi), "condition_ignored", "교점 좌표의 합을 반올림했다."), W(correct + s.m1, "other", "한 단위 더 갔다.")].filter((w) => w.v !== correct),
          verificationJs: figJs({}, s.fig, `${PAIR_X_JS}for (let x = 0; x <= 5000; x++) if (m1 * x + b1 > m2 * x + b2) return x + m1 * x + b1; throw new Error('해 없음');`),
          trace: [...pairRead(s), [`x > ${fmtNum(Math.round(s.xi * 100) / 100)} 에서 가장 작은 정수 n = ${n} 이다.`, "Least whole number."], [`v = ${s.m1}·${n} + ${s.b1} = ${v} 이다.`, "Evaluate."], [`n + v = ${correct} 이다.`, "Add."]], variant: "sum_at_first_overtake",
        }, s.fig);
      },
    },
    {
      op: "param_condition", structure: "직선 2 의 기울기를 k 로 바꿨을 때 두 직선이 그림 밖 x = X0 에서 만나도록 하는 k 를 구함", extra: "교점 조건(x = X0 에서 값이 같음)으로 기울기를 거슬러 구함 — medium 은 좌표 합 읽기",
      concepts: ["두 일차 관계 그래프", "매개변수 조건", "교점 위치"],
      gen(rng) {
        let s = makeLinePair(rng); let pick: [number, number] | null = null;
        for (let t = 0; t < 40 && !pick; t++) { s = makeLinePair(rng); const ks = []; for (let k = 1; k < s.m1; k++) { if (k === s.m2) continue; const X0 = (s.b2 - s.b1) / (s.m1 - k); if (Number.isInteger(X0) && X0 > s.X && X0 <= s.X + 12) ks.push([k, X0] as [number, number]); } if (ks.length) pick = rng.pick(ks); }
        if (!pick) throw new GenFail("no k"); const [k, X0] = pick; const v = s.m1 * X0 + s.b1;
        return gInst(rng, {
          stimulus: `${pairIntro(rng, s)} Suppose the rate of change of ${s.t.B} is changed to $k$ ${s.t.yu} per ${s.t.xu.replace(/s$/, "")}, where $k$ is a constant, while its starting value stays the same.`,
          question: rng.pick([`For what value of $k$ will ${s.t.A} and the changed ${s.t.B} have the same ${s.t.ya} when ${s.t.x} is ${X0}?`, `When ${s.t.x} is ${X0}, ${s.t.A} and the changed ${s.t.B} should be equal. What value of $k$ makes that happen?`, `${ifCont(rng)}, which value of $k$ makes ${s.t.A} and the changed ${s.t.B} meet at ${s.t.x} = ${X0}?`]), correct: k,
          wrongs: [W(s.m2, "condition_ignored", "원래 기울기를 답했다."), W(v / X0, "step_missing", "처음 값 차를 무시했다."), W(k + 1, "other", "한 단위 어긋났다."), W(Math.round((v + s.b2) / X0), "sign_error", "처음 값을 더했다."), W(s.m1, "formula_misuse", "다른 직선의 기울기를 답했다.")].filter((w) => w.v !== k && Number.isInteger(w.v)),
          verificationJs: figJs({ X0 }, s.fig, `${PAIR_JS}return ((m1 * P.X0 + b1) - b2) / P.X0;`),
          trace: [...pairRead(s).slice(0, 2), [`x = ${X0} 에서 ${s.t.A} = ${v} 이다.`, "Value of the first line."], [`k·${X0} + ${s.b2} = ${v} 로 놓는다.`, "Set the changed line equal."], [`k = (${v} - ${s.b2}) ÷ ${X0} = ${k} 이다.`, "Solve for k."]], variant: "rate_for_meeting_at_X0",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "read_meeting_point_sum", structure: "그림 안에서 두 직선이 격자점에서 만날 때 그 점의 x + y 를 읽음", extra: "easy: 교점의 두 좌표를 읽어 더하기", concepts: ["두 일차 관계 그래프", "교점 읽기"],
      gen(rng) {
        const s = makeLinePair(rng, { inside: true }); const sum = s.xi + s.yi;
        return gInst(rng, { stimulus: pairIntro(rng, s), question: `According to the graph, ${s.t.A} and ${s.t.B} are equal when ${s.t.x} is $x$ and the ${s.t.ya} is $y$ ${s.t.yu}. What is the value of $x + y$?`, correct: sum, wrongs: [W(s.xi, "step_missing", "x 만 답했다."), W(s.yi, "step_missing", "y 만 답했다."), W(sum + s.S, "axis_misread", "눈금 한 칸 어긋나게 읽었다."), W(s.yi - s.xi, "sign_error", "차를 구했다.")].filter((w) => w.v !== sum), verificationJs: figJs({}, s.fig, `${PAIR_X_JS}return xi + yi;`), trace: [[`두 직선이 만나는 점의 좌표를 읽는다: (${s.xi}, ${s.yi}).`, "Read the intersection."], [`x + y = ${sum} 이다.`, "Add."]], variant: "read_intersection_sum",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "sum_at_end", structure: "한 직선에서 식을 세워 그림 오른쪽 끝 x 와 그 값의 합을 구함", extra: "medium: 식 세우기 + 대입 + 합", concepts: ["일차 관계 그래프", "함숫값"],
      gen(rng) {
        const s = makeLinePair(rng); const v = s.m1 * s.X + s.b1; const correct = s.X + v;
        return gInst(rng, { stimulus: pairIntro(rng, s), question: `According to the graph, let $v$ be the ${s.t.ya} of ${s.t.A}, in ${s.t.yu}, when ${s.t.x} is ${s.X}. What is the value of ${s.X} + $v$?`, correct, wrongs: [W(v, "step_missing", "v 만 답했다."), W(s.X + s.m1 * s.X, "step_missing", "처음 값을 더하지 않았다."), W(s.X + s.m2 * s.X + s.b2, "formula_misuse", "다른 직선의 값을 썼다."), W(correct + s.S, "axis_misread", "눈금 한 칸 어긋나게 읽었다.")].filter((w) => w.v !== correct), verificationJs: figJs({ X: s.X }, s.fig, `${PAIR_JS}return P.X + m1 * P.X + b1;`), trace: [...pairRead(s).slice(0, 1), [`v = ${s.m1}·${s.X} + ${s.b1} = ${v} 이다.`, "Evaluate."], [`${s.X} + ${v} = ${correct} 이다.`, "Add."]], variant: "sum_at_right_edge",
        }, s.fig);
      },
    },
  ],
});
