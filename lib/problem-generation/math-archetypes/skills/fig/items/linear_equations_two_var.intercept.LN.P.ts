// linear_equations_two_var.intercept.LN.P — 순수 함수 그래프(축 제목 x·y)로 주어진 직선의 y 절편을 바탕으로 변환·표준형·다른 직선의 값을 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { GL_JS, makePureLine, pureIntro, purRead, purIntercept } from "../pure-kit";

const isInt = Number.isInteger;
const LEAD = ["", "", "A student is studying a line in the coordinate plane. ", "A teacher draws a line on a grid. ", "An engineer plots a straight path on a grid. ", "During a geometry lesson, a class graphs a line. ", "A graphing program draws a line. ", "A designer sketches a straight edge on graph paper. "];
const intro = (rng: Rng) => rng.pick(LEAD) + pureIntro(rng);
const ICPT = [(): string => "What is the $y$-intercept of the line shown?", (): string => "At what $y$-value does the line cross the $y$-axis?", (): string => "What is the $y$-coordinate of the point where the line crosses the $y$-axis?", (): string => "What is the value of $y$ when $x = 0$ on the line?", (): string => "Find the $y$-intercept of the line."];

export const ITEM = defineItem({
  prefix: "l2i", itemId: "linear_equations_two_var.intercept.LN.P",
  hard: [
    {
      op: "repr_shift", structure: "그래프의 점들로 기울기·절편을 구하고, 직선을 표준형 Ax + By = c (A·B 주어짐)로 쓸 때의 c 를 구함", extra: "y 절편 → 표준형 상수 c = B × b 로 표현을 바꿔야 함(절편을 그대로 답하는 함정) — medium 은 y 절편",
      concepts: ["좌표평면 그래프", "y 절편", "표준형 식의 상수"],
      gen(rng) {
        const s = makePureLine(rng); const B = rng.pick([2, 3, 4, 5, 6]); const A = -s.m * B; const c = B * s.b;
        const eq = `${A < 0 ? "-" : ""}${Math.abs(A) === 1 ? "" : Math.abs(A)}x + ${B}y = c`;
        return figInst(rng, {
          stimulus: `${intro(rng)} ${rng.pick([`An equation of the line shown is $${eq}$, where $c$ is a constant.`, `The line shown is the graph of $${eq}$, where $c$ is a constant.`, `The equation $${eq}$, where $c$ is a constant, defines the line shown.`])}`,
          question: rng.pick([`What is the value of $c$?`, `What is the value of the constant $c$?`, `Based on the graph, what is $c$?`]), correct: c,
          wrongs: [W(s.b, "step_missing", "y 절편을 그대로 답했다."), W(-c, "sign_error", "부호를 반대로 했다."), W(s.b + B, "formula_misuse", "B 를 더했다."), W(s.m * B, "formula_misuse", "기울기와 B 를 곱했다."), W(c + B, "other", "어긋났다.")].filter((w) => isInt(w.v) && w.v !== c),
          verificationJs: figJs({ B }, s.fig, `${GL_JS}return P.B * b;`),
          trace: [...purRead(s), purIntercept(s), [`x = 0 을 식에 대입하면 ${B}y = c 이므로 c = ${B} × ${s.b} 이다.`, "Substitute x = 0."], [`c = ${c} 이다.`, "Compute."]], variant: "standard_form_constant",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "그래프의 점들로 기울기·절편을 구하고, 직선을 오른쪽으로 h 만큼 평행이동한 직선의 y 절편을 구함", extra: "기울기와 절편을 구한 뒤 이동 후 절편 b − m h 를 계산하는 2단 연쇄(부호 함정) — medium 은 y 절편",
      concepts: ["좌표평면 그래프", "기울기·절편", "수평 이동"],
      gen(rng) {
        const s = makePureLine(rng); const h = rng.int(2, 6); const c = s.b - s.m * h; if (c === s.b + s.m * h) throw new GenFail("sym");
        return figInst(rng, {
          stimulus: `${intro(rng)} ${rng.pick([`The line shown is shifted ${h} units to the right to form a new line.`, `A new line is formed by moving the line shown ${h} units to the right.`, `Translating the line shown ${h} units to the right produces a new line.`])}`,
          question: rng.pick([`What is the $y$-intercept of the new line?`, `At what $y$-value does the new line cross the $y$-axis?`, `What is the $y$-coordinate of the point where the new line crosses the $y$-axis?`]), correct: c,
          wrongs: [W(s.b, "condition_ignored", "원래 직선의 절편을 답했다."), W(s.b + s.m * h, "sign_error", "이동 방향을 반대로 했다."), W(s.b - h, "formula_misuse", "기울기를 곱하지 않았다."), W(s.b + h, "formula_misuse", "이동 거리를 더했다."), W(c + s.m, "other", "한 칸 어긋났다.")].filter((w) => isInt(w.v) && w.v !== c),
          verificationJs: figJs({ h }, s.fig, `${GL_JS}return b - m * P.h;`),
          trace: [...purRead(s), purIntercept(s), [`오른쪽으로 ${h} 이동하면 새 식은 y = ${s.m}(x - ${h}) + ${s.b} 이다.`, "Replace x by x - h."], [`x = 0 일 때 y = ${s.b} - (${s.m})(${h}) = ${c} 이다.`, "Evaluate at x = 0."]], variant: "shifted_intercept",
        }, s.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "그래프에서 y 절편을 구하고, 같은 y 절편에서 시작해 다른 기울기를 갖는 두 번째 직선의 x 에서의 값을 구함", extra: "절편을 공유하는 두 직선의 비교 — 두 번째 직선은 y = p x + (그림의 절편) 으로 계산해야 함(그림 직선의 기울기를 쓰는 함정) — medium 은 y 절편",
      concepts: ["좌표평면 그래프", "y 절편", "다른 직선의 값"],
      gen(rng) {
        const s = makePureLine(rng); const p = rng.pick([-5, -3, -2, 2, 3, 5].filter((v) => v !== s.m)); const X = rng.int(3, 9); const correct = s.b + p * X;
        return figInst(rng, {
          stimulus: `${intro(rng)} ${rng.pick([`A second line has the same $y$-intercept as the line shown and a slope of ${p}.`, `Another line crosses the $y$-axis at the same point as the line shown and has slope ${p}.`, `A second line shares its $y$-intercept with the line shown, and its slope is ${p}.`])}`,
          question: rng.pick([`What is the $y$-coordinate of the point on the second line with $x$-coordinate ${X}?`, `On the second line, what is the value of $y$ when $x = ${X}$?`, `What is $y$ on the second line when $x$ is ${X}?`]), correct,
          wrongs: [W(s.b + s.m * X, "condition_ignored", "그림 직선의 기울기를 썼다."), W(p * X, "step_missing", "절편을 더하지 않았다."), W(s.b - p * X, "sign_error", "기울기 항의 부호를 반대로 했다."), W(s.b + p, "step_missing", "x 를 곱하지 않았다."), W(correct + p, "other", "한 칸 어긋났다.")].filter((w) => isInt(w.v) && w.v !== correct),
          verificationJs: figJs({ p, X }, s.fig, `${GL_JS}return b + P.p * P.X;`),
          trace: [...purRead(s), purIntercept(s), [`두 번째 직선: y = ${p}x + (${s.b}) 이다.`, "Same intercept, new slope."], [`x = ${X} 일 때 y = ${p} × ${X} + (${s.b}) = ${correct} 이다.`, "Evaluate."]], variant: "second_line_same_intercept",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "그래프의 직선과 평행하고 x 절편이 주어진 두 번째 직선의 y 절편을 역으로 구함", extra: "기울기를 읽어 x 절편에서 y 절편을 거꾸로 구해야 함(y = −m·x₀, 부호 함정) — medium 은 y 절편",
      concepts: ["좌표평면 그래프", "기울기", "x 절편에서 y 절편"],
      gen(rng) {
        const s = makePureLine(rng); const x1 = rng.nz(-6, 6); const c = -s.m * x1; if (c === s.b) throw new GenFail("same");
        return figInst(rng, {
          stimulus: `${intro(rng)} ${rng.pick([`A second line is parallel to the line shown and crosses the $x$-axis at $x = ${x1}$.`, `Another line is parallel to the line shown. Its $x$-intercept is ${x1}.`, `A second line has the same slope as the line shown and has an $x$-intercept of ${x1}.`])}`,
          question: rng.pick([`What is the $y$-intercept of the second line?`, `At what $y$-value does the second line cross the $y$-axis?`, `What is the $y$-coordinate of the point where the second line crosses the $y$-axis?`]), correct: c,
          wrongs: [W(s.b, "condition_ignored", "원래 직선의 절편을 답했다."), W(-c, "sign_error", "부호를 반대로 했다."), W(x1, "step_missing", "x 절편을 답했다."), W(-x1, "step_missing", "x 절편의 부호를 바꿔 답했다."), W(Math.round(x1 / s.m) , "formula_misuse", "나눗셈을 썼다.")].filter((w) => isInt(w.v) && w.v !== c),
          verificationJs: figJs({ x1 }, s.fig, `${GL_JS}return -m * P.x1;`),
          trace: [...purRead(s), [`평행하므로 두 번째 직선의 기울기도 ${s.m} 이다.`, "Parallel lines share the slope."], [`점 (${x1}, 0) 을 지나므로 0 = ${s.m} × ${x1} + c 이다.`, "Use the x-intercept."], [`c = ${c} 이다.`, "Solve for c."]], variant: "intercept_from_x_intercept",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "marked_intercept", structure: "y 절편이 점으로 표시된 그래프에서 y 절편을 읽음", extra: "easy: x = 0 인 표시점 읽기", concepts: ["좌표평면 그래프", "y 절편"],
      gen(rng) {
        const s = makePureLine(rng, { x0: true });
        return figInst(rng, { stimulus: intro(rng), question: rng.pick(ICPT)(), correct: s.b, wrongs: [W(s.m, "formula_misuse", "기울기를 답했다."), W(-s.b, "sign_error", "부호를 반대로 했다."), W(s.ys[1], "axis_misread", "다른 점을 읽었다."), W(s.ys[2], "axis_misread", "가장 오른쪽 점을 읽었다.")].filter((w) => w.v !== s.b), verificationJs: figJs({}, s.fig, `${GL_JS}return b;`), trace: [[`x = 0 인 표시점의 y 값이 절편이다.`, "The marked point at x = 0."], [`y 절편은 ${s.b} 이다.`, "Read it."]], variant: "read_marked_intercept",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "unmarked_intercept", structure: "y 절편이 표시되지 않은 그래프에서 두 점으로 y 절편을 구함", extra: "medium: 기울기와 한 점으로 거슬러 계산", concepts: ["좌표평면 그래프", "기울기·절편"],
      gen(rng) {
        const s = makePureLine(rng); if (s.xs.includes(0) || s.d === 1) throw new GenFail("marked");
        return figInst(rng, { stimulus: intro(rng), question: rng.pick(ICPT)(), correct: s.b, wrongs: [W(s.ys[0], "axis_misread", "첫 점의 y 값을 답했다."), W(s.m, "formula_misuse", "기울기를 답했다."), W(-s.b, "sign_error", "부호를 반대로 했다."), W(s.b + s.m, "other", "한 칸 어긋났다.")].filter((w) => w.v !== s.b), verificationJs: figJs({}, s.fig, `${GL_JS}return b;`), trace: [...purRead(s), purIntercept(s)], variant: "intercept_from_points",
        }, s.fig);
      },
    },
  ],
});
