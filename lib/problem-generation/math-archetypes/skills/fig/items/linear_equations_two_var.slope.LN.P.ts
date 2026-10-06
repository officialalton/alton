// linear_equations_two_var.slope.LN.P — 순수 함수 그래프(축 제목 x·y)로 주어진 직선의 기울기로 다른 직선·식의 계수를 구한다(표 버전 .TB.P 의 그래프판).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum, lin } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { GL_JS, makePureLine, pureIntro, purRead, purIntercept } from "../pure-kit";

const isInt = Number.isInteger;

const LEAD = ["", "", "A student is studying a line in the coordinate plane. ", "A teacher draws a line on a grid. ", "An engineer plots a straight path on a grid. ", "During a geometry lesson, a class graphs a line. ", "A graphing program draws a line. ", "A designer sketches a straight edge on graph paper. "];
const intro = (rng: Rng) => rng.pick(LEAD) + pureIntro(rng);

export const ITEM = defineItem({
  prefix: "l2g", itemId: "linear_equations_two_var.slope.LN.P",
  hard: [
    {
      op: "repr_shift", structure: "그래프의 점들로 기울기를 구하고, 직선을 표준형 ax + By = c (B 주어짐)로 쓸 때의 a 를 구함", extra: "기울기 → 표준형 계수 관계(a = −mB) 로 표현을 바꿔야 함(부호 함정) — medium 은 기울기",
      concepts: ["좌표평면 그래프", "기울기", "표준형 식의 계수"],
      gen(rng) {
        const s = makePureLine(rng); const B = rng.pick([2, 3, 4, 5, 6]); const a = -s.m * B;
        return figInst(rng, {
          stimulus: `${intro(rng)} ${rng.pick([`An equation of the line shown can be written as $ax + ${B}y = c$, where $a$ and $c$ are constants.`, `The line shown is the graph of $ax + ${B}y = c$, where $a$ and $c$ are constants.`, `The equation $ax + ${B}y = c$, where $a$ and $c$ are constants, defines the line shown.`])}`,
          question: rng.pick([`What is the value of $a$?`, `What is the value of the constant $a$?`, `Based on the graph, what is $a$?`]), correct: a,
          wrongs: [W(-a, "sign_error", "부호를 반대로 했다."), W(s.m, "step_missing", "기울기를 그대로 답했다."), W(-s.m, "step_missing", "B 를 곱하지 않았다."), W(s.m * B * 2, "other", "계산 중 어긋났다."), W(-B / s.m, "formula_misuse", "기울기를 뒤집었다.")].filter((w) => isInt(w.v) && w.v !== a),
          verificationJs: figJs({ B }, s.fig, `${GL_JS}return -m * P.B;`),
          trace: [...purRead(s), [`${B}y = -ax + c 이므로 y = (-a/${B})x + c/${B} 이다.`, "Solve the standard form for y."], [`기울기 -a/${B} = ${s.m} 이다.`, "Match slopes."], [`a = -${B} × ${s.m} = ${a} 이다.`, "Solve for a."]], variant: "standard_form_coefficient",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "그래프의 점들로 기울기를 구하고, 그 직선과 평행하며 점 (p, q) 를 지나는 직선의 y 절편을 구함", extra: "기울기 → 평행(같은 기울기) → 새 점 대입으로 절편, 2단 연쇄 — medium 은 기울기",
      concepts: ["좌표평면 그래프", "평행선의 기울기", "점-기울기로 절편"],
      gen(rng) {
        const s = makePureLine(rng); const p = rng.nz(-6, 6); const q = rng.int(-30, 30); const c = q - s.m * p; if (c === s.b) throw new GenFail("same");
        return figInst(rng, {
          stimulus: `${intro(rng)} ${rng.pick([`A second line is parallel to the line shown and passes through the point with $x$-coordinate ${p} and $y$-coordinate ${q}.`, `Another line is parallel to the line shown. When $x = ${p}$, the $y$-value on this line is ${q}.`, `A second line is drawn parallel to the line shown. It contains the point where $x = ${p}$ and $y = ${q}$.`])}`,
          question: rng.pick([`What is the $y$-coordinate of the $y$-intercept of the second line?`, `At what $y$-value does the second line cross the $y$-axis?`, `What is the $y$-intercept of the second line?`]), correct: c,
          wrongs: [W(s.b, "condition_ignored", "원래 직선의 절편을 답했다."), W(q + s.m * p, "sign_error", "부호를 반대로 했다."), W(q - p / s.m, "formula_misuse", "수직선의 기울기를 썼다."), W(q, "step_missing", "점의 y 좌표를 답했다."), W(c + s.m, "other", "한 칸 어긋났다.")].filter((w) => isInt(w.v) && w.v !== c),
          verificationJs: figJs({ p, q }, s.fig, `${GL_JS}return P.q - m * P.p;`),
          trace: [...purRead(s), [`평행선의 기울기도 ${s.m} 이다.`, "Parallel lines share the slope."], [`두 번째 직선: y = ${s.m}x + c, 점 (${p}, ${q}) 대입.`, "Substitute the point."], [`c = ${q} - (${s.m})(${p}) = ${c} 이다.`, "Solve for c."]], variant: "parallel_through_point",
        }, s.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "그래프의 점들로 기울기를 구하고, 이 직선에 수직인 직선의 기울기를 구함", extra: "기울기를 구한 뒤 수직 조건(곱 −1)으로 음의 역수를 취해야 함(역수만·부호만 바꾸는 함정) — medium 은 기울기",
      concepts: ["좌표평면 그래프", "기울기", "수직선의 기울기"],
      gen(rng) {
        const s = makePureLine(rng, { ms: [-4, -2, -1, 1, 2, 4] }); const correct = -1 / s.m;
        return figInst(rng, {
          stimulus: `${intro(rng)} ${rng.pick([`A second line is perpendicular to the line shown.`, `Another line is perpendicular to the line shown.`, `A second line is drawn perpendicular to the line shown.`])}`,
          question: rng.pick([`What is the slope of the second line?`, `What is the slope of the perpendicular line?`, `Find the slope of the second line.`]), correct, fmt: fmtNum,
          wrongs: [W(s.m, "condition_ignored", "같은 기울기를 답했다."), W(-s.m, "formula_misuse", "부호만 바꿨다."), W(1 / s.m, "sign_error", "역수만 취했다."), W(-s.m * 2, "other", "계산 중 어긋났다.")].filter((w) => Math.abs(w.v - correct) > 1e-9),
          verificationJs: figJs({}, s.fig, `${GL_JS}return -1 / m;`),
          trace: [...purRead(s), [`수직인 두 직선의 기울기 곱은 -1 이다.`, "Perpendicular slopes multiply to -1."], [`두 번째 직선의 기울기 = -1 ÷ ${s.m} 이다.`, "Take the negative reciprocal."], [`= ${fmtNum(correct)} 이다.`, "Compute."]], variant: "perpendicular_slope",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "그래프의 점들로 기울기·절편을 구하고, 그림 범위 밖에서 y 가 주어진 값이 되는 x 를 역산", extra: "그림 밖의 점이라 식을 세운 뒤 거꾸로 풀어야 함(절편 부호·나눗셈 함정) — medium 은 기울기",
      concepts: ["좌표평면 그래프", "기울기·절편", "역산"],
      gen(rng) {
        const s = makePureLine(rng); const xv = rng.pick([-1, 1]) * rng.int(s.R + 1, s.R + 7); const Y = s.m * xv + s.b;
        return figInst(rng, {
          stimulus: `${intro(rng)} ${rng.pick([`The point $(x, ${Y})$ is on the line.`, `The line contains the point $(x, ${Y})$.`, `A point on the line has coordinates $(x, ${Y})$.`])}`,
          question: rng.pick([`What is the value of $x$?`, `What is $x$?`, `Find the value of $x$.`, `For what value of $x$ does the line reach this $y$-value?`, `What $x$-value corresponds to this point?`]), correct: xv,
          wrongs: [W(-xv, "sign_error", "부호를 반대로 했다."), W(Y - s.b, "step_missing", "기울기로 나누지 않았다."), W((Y + s.b) / s.m, "sign_error", "절편을 더했다."), W(Math.round(Y / s.m), "step_missing", "절편을 빼지 않았다."), W(xv + 1, "other", "한 칸 어긋났다.")].filter((w) => isInt(w.v) && w.v !== xv),
          verificationJs: figJs({ Y }, s.fig, `${GL_JS}return (P.Y - b) / m;`),
          trace: [...purRead(s), purIntercept(s), [`y = ${lin(s.m, s.b)} 에 y = ${Y} 를 놓는다.`, "Set y to the given value."], [`x = (${Y} - (${s.b})) ÷ ${s.m} = ${xv} 이다.`, "Solve for x."]], variant: "x_for_outside_value",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "next_value_outside", structure: "그림 밖의 x 에서 y 를 구함(기울기 × 변화)", extra: "easy: 기울기와 절편을 읽어 대입", concepts: ["좌표평면 그래프", "일차식"],
      gen(rng) {
        const s = makePureLine(rng, { x0: true }); const nx = s.R + rng.int(1, 5); const ny = s.m * nx + s.b;
        return figInst(rng, { stimulus: intro(rng), question: rng.pick([`The point $(${nx}, y)$ is also on the line. What is the value of $y$?`, `The line also contains the point $(${nx}, y)$. What is $y$?`, `If $(${nx}, y)$ lies on the line, what is the value of $y$?`, `A point on the line has $x$-coordinate ${nx}. What is its $y$-coordinate?`, `What is the $y$-coordinate of the point on the line with $x$-coordinate ${nx}?`]), correct: ny, wrongs: [W(s.m * nx, "step_missing", "절편을 빠뜨렸다."), W(ny - 2 * s.m, "other", "두 칸 어긋났다."), W(nx, "axis_misread", "x 를 답했다."), W(-ny, "sign_error", "부호가 바뀌었다.")].filter((w) => w.v !== ny), verificationJs: figJs({ nx }, s.fig, `${GL_JS}return m * P.nx + b;`), trace: [...purRead(s), purIntercept(s), [`y = ${s.m} × ${nx} + (${s.b}) = ${ny} 이다.`, "Substitute."]], variant: "value_outside_graph",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "slope", structure: "그래프의 두 점으로 직선의 기울기를 구함", extra: "medium: 차의 비", concepts: ["좌표평면 그래프", "기울기"],
      gen(rng) {
        const s = makePureLine(rng); if (s.d === 1) throw new GenFail("d");
        return figInst(rng, { stimulus: intro(rng), question: rng.pick([`What is the slope of the line shown?`, `What is the slope of the line?`]), correct: s.m, wrongs: [W(s.m * s.d, "unit_error", "y 의 변화만 답했다."), W(-s.m, "sign_error", "부호를 반대로 했다."), W(s.b, "formula_misuse", "절편을 답했다."), W(s.m + s.d, "other", "어긋났다.")].filter((w) => w.v !== s.m), verificationJs: figJs({}, s.fig, `${GL_JS}return m;`), trace: [...purRead(s), [`따라서 기울기는 ${s.m} 이다.`, "State the slope."]], variant: "slope_from_points",
        }, s.fig);
      },
    },
  ],
});
