// linear_equations_two_var.slope.TB.P — 표에 주어진 (x, y) 순서쌍이 한 직선 위에 있을 때, 그 직선의 기울기로 다른 직선·식의 계수를 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum, lin } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";

const isInt = Number.isInteger;
type XY = { xs: number[]; ys: number[]; m: number; b: number; fig: { type: "data"; kind: "table"; columns: string[]; rows: number[][] } };
/** 좌표 표(열 x, y): 등간격 x, y = m x + b(정수). 음수 좌표 허용. */
function makeXY(rng: Rng, o: { ms?: number[]; bInt?: boolean } = {}): XY {
  for (let tr = 0; tr < 60; tr++) {
    const m = rng.pick(o.ms ?? [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6]); const d = rng.pick([1, 2, 3]); const x0 = rng.int(-4, 3) * d; const b = rng.nz(-20, 20); const n = rng.int(4, 5);
    const xs = Array.from({ length: n }, (_, i) => x0 + i * d); const ys = xs.map((x) => m * x + b);
    if (ys.some((y) => Math.abs(y) > 90) || xs.includes(0)) continue;
    return { xs, ys, m, b, fig: { type: "data", kind: "table", columns: ["x", "y"], rows: xs.map((x, i) => [x, ys[i]]) } };
  }
  throw new GenFail("좌표 표 표집 실패");
}
const XY_JS = "const xs=FIGURE.rows.map(r=>r[0]), ys=FIGURE.rows.map(r=>r[1]); const m=(ys[1]-ys[0])/(xs[1]-xs[0]); const b=ys[0]-m*xs[0]; for (let i=0;i<xs.length;i++) if (Math.abs(m*xs[i]+b-ys[i])>1e-9) throw new Error('한 직선 위가 아님');\n";
/** 추상 좌표 문항은 숫자가 가려지면 문장이 같아지므로(독립 변형 ≥30) 도입 문장 × 표 소개 문장을 넓게 섞는다. */
const LEAD = ["", "", "A student is studying a line in the coordinate plane. ", "A teacher records some points on a line. ", "Consider the following coordinate data. ", "An engineer plots a straight path on a grid. ", "During a geometry lesson, a class lists points on one line. ", "A graphing program reports several points on a line. ", "A map uses a coordinate grid, and a straight road is drawn on it. ", "Several measurements were plotted, and they all fell on one line. ", "A designer sketches a straight edge on graph paper. ", "In a coordinate geometry puzzle, some points are given. "];
const NAMES = ["\\ell", "k", "n", "p", "r", "t", "w"];
/** 문항마다 직선 이름(ℓ·k·n…)을 바꾼다 — 숫자가 가려진 문장 비교에서도 서로 다른 변형이 되게. */
const names = (rng: Rng) => { const [a, b] = rng.shuffle([...NAMES]); return { L: a, K: b }; };
const intro = (rng: Rng, L: string) => rng.pick(LEAD) + rng.pick([
  `The table shows several ordered pairs $(x, y)$ that lie on line $${L}$ in the $xy$-plane.`,
  `Each ordered pair $(x, y)$ in the table shown is a point on line $${L}$ in the $xy$-plane.`,
  `In the $xy$-plane, line $${L}$ passes through every point $(x, y)$ given in the table.`,
  `The points listed in the table lie on a line, $${L}$, in the $xy$-plane.`,
  `Line $${L}$ is graphed in the $xy$-plane, and the table shown gives some of the points on it.`,
  `The table gives the coordinates of points that are all on line $${L}$ in the $xy$-plane.`,
]);
const readXY = (s: XY): [string, string][] => [[`표에서 두 점 (${s.xs[0]}, ${s.ys[0]}), (${s.xs[1]}, ${s.ys[1]}) 을 읽는다.`, "Read two points from the table."], [`기울기 = (${s.ys[1]} - (${s.ys[0]})) ÷ (${s.xs[1]} - (${s.xs[0]})) = ${s.m} 이다.`, "Compute the slope."]];
const bStep = (s: XY): [string, string] => [`y 절편 b = ${s.ys[0]} - (${s.m})(${s.xs[0]}) = ${s.b} 이다.`, "Find the y-intercept."];

export const ITEM = defineItem({
  prefix: "l2", itemId: "linear_equations_two_var.slope.TB.P",
  hard: [
    {
      op: "repr_shift", structure: "표의 점들로 기울기를 구하고, 직선을 표준형 ax + By = c (B 주어짐)로 쓸 때의 a 를 구함", extra: "기울기 → 표준형 계수 관계(a = −mB) 로 표현을 바꿔야 함(부호 함정) — medium 은 기울기",
      concepts: ["좌표 표", "기울기", "표준형 식의 계수"],
      gen(rng) {
        const { L } = names(rng); const s = makeXY(rng); const B = rng.pick([2, 3, 4, 5, 6]); const a = -s.m * B;
        return figInst(rng, {
          stimulus: `${intro(rng, L)} ${rng.pick([`An equation of line $${L}$ can be written as $ax + ${B}y = c$, where $a$ and $c$ are constants.`, `Line $${L}$ is the graph of $ax + ${B}y = c$, where $a$ and $c$ are constants.`, `The equation $ax + ${B}y = c$, where $a$ and $c$ are constants, defines line $${L}$.`])}`,
          question: rng.pick([`What is the value of $a$?`, `What is the value of the constant $a$?`, `Based on the table, what is $a$?`]), correct: a,
          wrongs: [W(-a, "sign_error", "부호를 반대로 했다."), W(s.m, "step_missing", "기울기를 그대로 답했다."), W(-s.m, "step_missing", "B 를 곱하지 않았다."), W(s.m * B * 2, "other", "계산 중 어긋났다."), W(-B / s.m, "formula_misuse", "기울기를 뒤집었다.")].filter((w) => isInt(w.v) && w.v !== a),
          verificationJs: figJs({ B }, s.fig, `${XY_JS}return -m * P.B;`),
          trace: [...readXY(s), [`${B}y = -ax + c 이므로 y = (-a/${B})x + c/${B} 이다.`, "Solve the standard form for y."], [`기울기 -a/${B} = ${s.m} 이다.`, "Match slopes."], [`a = -${B} × ${s.m} = ${a} 이다.`, "Solve for a."]], variant: "standard_form_coefficient",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "표의 점들로 기울기를 구하고, 그 직선과 평행하며 점 (p, q) 를 지나는 직선의 y 절편을 구함", extra: "기울기 → 평행(같은 기울기) → 새 점 대입으로 절편, 2단 연쇄 — medium 은 기울기",
      concepts: ["좌표 표", "평행선의 기울기", "점-기울기로 절편"],
      gen(rng) {
        const { L, K } = names(rng); const s = makeXY(rng); const p = rng.nz(-6, 6); const q = rng.int(-30, 30); const c = q - s.m * p; if (c === s.b) throw new GenFail("same");
        return figInst(rng, {
          stimulus: `${intro(rng, L)} Line $${K}$ is parallel to line $${L}$ and passes through the point $(${p}, ${q})$.`,
          question: `What is the $y$-coordinate of the $y$-intercept of line $${K}$?`, correct: c,
          wrongs: [W(s.b, "condition_ignored", "원래 직선의 절편을 답했다."), W(q + s.m * p, "sign_error", "부호를 반대로 했다."), W(q - p / s.m, "formula_misuse", "수직선의 기울기를 썼다."), W(q, "step_missing", "점의 y 좌표를 답했다."), W(c + s.m, "other", "한 칸 어긋났다.")].filter((w) => isInt(w.v) && w.v !== c),
          verificationJs: figJs({ p, q }, s.fig, `${XY_JS}return P.q - m * P.p;`),
          trace: [...readXY(s), [`평행선 k 의 기울기도 ${s.m} 이다.`, "Parallel lines share the slope."], [`k: y = ${s.m}x + c, 점 (${p}, ${q}) 대입.`, "Substitute the point."], [`c = ${q} - (${s.m})(${p}) = ${c} 이다.`, "Solve for c."]], variant: "parallel_through_point",
        }, s.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "표의 점들로 기울기를 구하고, 직선 ℓ 에 수직인 직선의 기울기를 구함", extra: "기울기를 구한 뒤 수직 조건(곱 −1)으로 음의 역수를 취해야 함(역수만·부호만 바꾸는 함정) — medium 은 기울기",
      concepts: ["좌표 표", "기울기", "수직선의 기울기"],
      gen(rng) {
        const { L, K } = names(rng); const s = makeXY(rng, { ms: [-5, -4, -2, -1, 1, 2, 4, 5] }); const correct = -1 / s.m;
        return figInst(rng, {
          stimulus: `${intro(rng, L)} Line $${K}$ is perpendicular to line $${L}$.`,
          question: `What is the slope of line $${K}$?`, correct, fmt: fmtNum,
          wrongs: [W(s.m, "condition_ignored", "같은 기울기를 답했다."), W(-s.m, "formula_misuse", "부호만 바꿨다."), W(1 / s.m, "sign_error", "역수만 취했다."), W(-s.m * 2, "other", "계산 중 어긋났다.")].filter((w) => Math.abs(w.v - correct) > 1e-9),
          verificationJs: figJs({}, s.fig, `${XY_JS}return -1 / m;`),
          trace: [...readXY(s), [`수직인 두 직선의 기울기 곱은 -1 이다.`, "Perpendicular slopes multiply to -1."], [`j 의 기울기 = -1 ÷ ${s.m} 이다.`, "Take the negative reciprocal."], [`= ${fmtNum(correct)} 이다.`, "Compute."]], variant: "perpendicular_slope",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "표의 점들로 기울기·절편을 구하고, 직선이 x 축과 만나는 점의 x 좌표(y = 0 이 되는 x)를 역산", extra: "표에 y = 0 인 점이 없어 식을 세운 뒤 0 이 되는 x 를 역으로 구해야 함 — medium 은 기울기",
      concepts: ["좌표 표", "기울기·절편", "x 절편 역산"],
      gen(rng) {
        const { L } = names(rng); const s = makeXY(rng); const xi = -s.b / s.m; if (!isInt(xi) || s.xs.includes(xi)) throw new GenFail("xi");
        return figInst(rng, {
          stimulus: `${intro(rng, L)}`,
          question: `What is the $x$-coordinate of the point where line $${L}$ crosses the $x$-axis?`, correct: xi,
          wrongs: [W(s.b, "formula_misuse", "y 절편을 답했다."), W(-xi, "sign_error", "부호를 반대로 했다."), W(s.b * s.m, "formula_misuse", "곱했다."), W(xi + 1, "other", "한 칸 어긋났다."), W(-s.b, "step_missing", "기울기로 나누지 않았다.")].filter((w) => isInt(w.v) && w.v !== xi),
          verificationJs: figJs({}, s.fig, `${XY_JS}return -b / m;`),
          trace: [...readXY(s), bStep(s), [`y = ${lin(s.m, s.b)} = 0 으로 놓는다.`, "Set y = 0."], [`x = ${-s.b} ÷ ${s.m} = ${xi} 이다.`, "Solve for x."]], variant: "x_intercept_from_table",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "missing_y", structure: "표의 일정한 간격으로 다음 점의 y 를 구함", extra: "easy: 같은 간격만큼 더하기", concepts: ["좌표 표", "일정한 변화"],
      gen(rng) {
        const { L } = names(rng); const s = makeXY(rng); const d = s.xs[1] - s.xs[0]; const nx = s.xs[s.xs.length - 1] + d; const ny = s.m * nx + s.b; const step = s.ys[1] - s.ys[0];
        return figInst(rng, { stimulus: intro(rng, L), question: `The point $(${nx}, y)$ is also on line $${L}$. What is the value of $y$?`, correct: ny, wrongs: [W(ny - step, "step_missing", "마지막 y 를 답했다."), W(ny + step, "other", "한 칸 더 갔다."), W(nx, "axis_misread", "x 를 답했다."), W(-ny, "sign_error", "부호가 바뀌었다.")].filter((w) => w.v !== ny), verificationJs: figJs({ nx }, s.fig, `${XY_JS}return m * P.nx + b;`), trace: [[`y 는 한 칸마다 ${step} 씩 변한다.`, "Constant change per row."], [`다음 y = ${s.ys[s.ys.length - 1]} + (${step}) = ${ny} 이다.`, "Add one more step."]], variant: "next_point",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "slope", structure: "표의 두 점으로 직선의 기울기를 구함", extra: "medium: 차의 비", concepts: ["좌표 표", "기울기"],
      gen(rng) {
        const { L } = names(rng); const s = makeXY(rng); const d = s.xs[1] - s.xs[0]; if (d === 1) throw new GenFail("d");
        return figInst(rng, { stimulus: intro(rng, L), question: `What is the slope of line $${L}$?`, correct: s.m, wrongs: [W(s.m * d, "unit_error", "y 의 변화만 답했다."), W(-s.m, "sign_error", "부호를 반대로 했다."), W(s.b, "formula_misuse", "절편을 답했다."), W(s.m + d, "other", "어긋났다.")].filter((w) => w.v !== s.m), verificationJs: figJs({}, s.fig, `${XY_JS}return m;`), trace: [...readXY(s), [`따라서 기울기는 ${s.m} 이다.`, "State the slope."]], variant: "slope_from_points",
        }, s.fig);
      },
    },
  ],
});
