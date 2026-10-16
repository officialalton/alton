// systems_linear.substitution_solve.TB.P — 표로 주어진 일차 관계(y = mx + b, 계수는 표에서 구함)와 지문의 식을 연립해 푼다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { lin } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { makeXY, xyIntro, xyRead, XY_JS, type XY, withRetry } from "./_t6-kit";

const isInt = Number.isInteger;
/** 지문 식 a x + c y = d(정수해 x0 가 나오게). */
function other(rng: Rng, s: XY) {
  for (let tr = 0; tr < 60; tr++) {
    const x0 = rng.nz(-9, 12); if (s.xs.includes(x0)) continue; const y0 = s.m * x0 + s.b; if (Math.abs(y0) > 99) continue;
    const a = rng.nz(-6, 6), c = rng.pick([-5, -4, -3, -2, 2, 3, 4, 5]); if (a + c * s.m === 0) continue; const d = a * x0 + c * y0; if (Math.abs(d) > 300 || d === 0) continue;
    return { x0, y0, a, c, d };
  }
  throw new GenFail("연립 식 표집 실패");
}
const stdTex = (a: number, c: number, d: number) => `${a === 1 ? "" : a === -1 ? "-" : a}x ${c < 0 ? "-" : "+"} ${Math.abs(c)}y = ${d}`;
const sysIntro = (rng: Rng) => rng.pick(["The system of equations consists of the equation represented by the table and", "Consider the system formed by the relationship in the table and the equation", "A system is made of the linear equation shown in the table together with", "Together with the linear equation represented in the table, a system includes"]);
const SYS_JS = `${XY_JS}const solve=(a,c,d)=>{ const den=a+c*m; if (Math.abs(den)<1e-12) throw new Error('해 없음'); const x=(d-c*b)/den; return [x, m*x+b]; };\n`;
const subSteps = (s: XY, o: { a: number; c: number; d: number; x0: number; y0: number }): [string, string][] => [[`${o.a}x + ${o.c}(${lin(s.m, s.b)}) = ${o.d} 에 대입한다.`, "Substitute the table's equation."], [`(${o.a + o.c * s.m})x = ${o.d - o.c * s.b} 이므로 x = ${o.x0} 이다.`, "Solve for x."]];

export const ITEM = defineItem(withRetry({
  prefix: "sl", itemId: "systems_linear.substitution_solve.TB.P",
  hard: [
    {
      op: "repr_shift", structure: "표에서 일차식을 세우고(표현 변환), 지문의 표준형 식에 대입해 연립의 해 x 를 구함", extra: "표 → 식으로 바꾼 뒤 대입법으로 연립해야 함(해는 표 밖) — medium 은 수평선 y = K 와의 연립",
      concepts: ["일차 관계 값표", "식 세우기", "대입법"],
      gen(rng) {
        const s = makeXY(rng); const o = other(rng, s);
        return figInst(rng, {
          stimulus: `${xyIntro(rng)} ${sysIntro(rng)} $${stdTex(o.a, o.c, o.d)}$.`,
          question: rng.pick([`If $(x, y)$ is the solution to the system, what is the value of $x$?`, `What is the $x$-coordinate of the solution $(x, y)$ to the system?`, `The system has the solution $(x, y)$. What is $x$?`]), correct: o.x0,
          wrongs: [W(o.y0, "axis_misread", "y 를 답했다."), W(-o.x0, "sign_error", "부호를 반대로 했다."), W((o.d + o.c * s.b) / (o.a + o.c * s.m), "sign_error", "절편의 부호를 바꿨다."), W(o.d / (o.a + o.c * s.m), "step_missing", "절편 항을 빠뜨렸다."), W((o.d - o.c * s.b) / (o.a - o.c * s.m), "sign_error", "기울기 부호를 바꿨다."), W(o.x0 + 1, "other", "계산 중 어긋났다.")].filter((w) => isInt(w.v) && w.v !== o.x0),
          verificationJs: figJs({ a: o.a, c: o.c, d: o.d }, s.fig, `${SYS_JS}return solve(P.a,P.c,P.d)[0];`),
          trace: [...xyRead(s), ...subSteps(s, o), [`확인: y = ${o.y0}, ${o.a}(${o.x0}) + ${o.c}(${o.y0}) = ${o.d} 이다.`, "Check the solution."]], variant: "solve_x_table_and_standard",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "표의 식과 지문의 식을 연립해 해 (x, y) 를 구한 뒤 x + y(또는 x − y)를 계산", extra: "x 를 구하고 다시 대입해 y 까지 구한 뒤 조합해야 함 — medium 은 x 만",
      concepts: ["일차 관계 값표", "대입법", "해의 조합"],
      gen(rng) {
        const s = makeXY(rng); const o = other(rng, s); const plus = rng.chance(0.5); const ans = plus ? o.x0 + o.y0 : o.x0 - o.y0;
        return figInst(rng, {
          stimulus: `${xyIntro(rng)} ${sysIntro(rng)} $${stdTex(o.a, o.c, o.d)}$. The solution to the system is $(x, y)$.`,
          question: rng.pick([`What is the value of $${plus ? "x + y" : "x - y"}$?`, `Find the value of $${plus ? "x + y" : "x - y"}$.`]), correct: ans,
          wrongs: [W(o.x0, "step_missing", "x 만 답했다."), W(o.y0, "step_missing", "y 만 답했다."), W(plus ? o.x0 - o.y0 : o.x0 + o.y0, "sign_error", "합과 차를 바꿨다."), W(ans + 1, "other", "계산 중 어긋났다."), W(-ans, "sign_error", "부호를 반대로 했다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ a: o.a, c: o.c, d: o.d, plus: plus ? 1 : 0 }, s.fig, `${SYS_JS}const [x,y]=solve(P.a,P.c,P.d); return P.plus ? x+y : x-y;`),
          trace: [...xyRead(s), ...subSteps(s, o), [`y = ${lin(s.m, s.b)} 에 대입하면 y = ${o.y0} 이다.`, "Substitute back for y."], [`${plus ? "x + y" : "x - y"} = ${ans} 이다.`, "Combine."]], variant: "solve_then_combine",
        }, s.fig);
      },
    },
    {
      op: "param_condition", structure: "표의 일차식과 지문의 식 ax + Cy = D(a 상수)가 해를 갖지 않을 조건으로 a 를 구함", extra: "해가 없다 = 평행(기울기 같고 절편 다름) 조건으로 바꿔 계수를 정해야 함 — medium 은 해 하나",
      concepts: ["일차 관계 값표", "기울기", "해가 없는 연립(평행)"],
      gen(rng) {
        const s = makeXY(rng); const c = rng.pick([2, 3, 4, 5, 6, -2, -3]); const a = -c * s.m; const d = rng.nz(-40, 40); if (d === c * s.b) throw new GenFail("same line");
        return figInst(rng, {
          stimulus: `${xyIntro(rng)} ${sysIntro(rng)} $ax ${c < 0 ? "-" : "+"} ${Math.abs(c)}y = ${d}$, where $a$ is a constant.`,
          question: rng.pick([`If the system has no solution, what is the value of $a$?`, `For what value of $a$ does the system have no solution?`]), correct: a,
          wrongs: [W(-a, "sign_error", "부호를 반대로 했다."), W(s.m, "step_missing", "기울기를 그대로 답했다."), W(-s.m, "step_missing", "계수를 곱하지 않았다."), W(c * s.b === 0 ? a + 1 : -d / s.b, "formula_misuse", "절편 조건을 썼다."), W(a * 2, "other", "계산 중 어긋났다.")].filter((w) => isInt(w.v) && w.v !== a),
          verificationJs: figJs({ c, d }, s.fig, `${XY_JS}if (Math.abs(P.c*b-P.d)<1e-9) throw new Error('같은 직선'); return -P.c*m;`),
          trace: [...xyRead(s), [`${c}y = -ax + ${d} 이므로 기울기는 -a/${c} 이다.`, "Find the slope of the second line."], [`해가 없으려면 두 직선이 평행: -a/${c} = ${s.m} 이다.`, "No solution means parallel lines."], [`a = ${a} 이고, 절편 ${d}/${c} ≠ ${s.b} 이므로 겹치지 않는다.`, "Solve and check the intercepts differ."]], variant: "no_solution_coefficient",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "연립의 해의 x 좌표가 주어질 때, 지문의 직선 y = kx + q 의 기울기 k 를 역산", extra: "해의 x 로 표의 식에서 y 를 구하고, 그 점이 다른 직선 위에 있도록 계수를 역으로 정해야 함 — medium 은 해 구하기",
      concepts: ["일차 관계 값표", "연립의 해", "계수 역산"],
      gen(rng) {
        const s = makeXY(rng); const X = rng.nz(-8, 10); if (s.xs.includes(X) || Math.abs(X) < 2) throw new GenFail("X"); const y0 = s.m * X + s.b; const q = rng.nz(-20, 20); const k = (y0 - q) / X;
        if (!isInt(k) || k === s.m || k === 0) throw new GenFail("k");
        return figInst(rng, {
          stimulus: `${xyIntro(rng)} ${sysIntro(rng)} $y = kx ${q < 0 ? "-" : "+"} ${Math.abs(q)}$, where $k$ is a constant. ${rng.pick([`The solution $(x, y)$ to the system has $x = ${X}$.`, `The two equations are both true when $x = ${X}$.`, `The graphs of the two equations intersect at a point whose $x$-coordinate is ${X}.`])}`,
          question: rng.pick([`What is the value of $k$?`, `What is the value of the constant $k$?`, `Based on the table, what is $k$?`]), correct: k,
          wrongs: [W(s.m, "condition_ignored", "표의 기울기를 답했다."), W(-k, "sign_error", "부호를 반대로 했다."), W((y0 + q) / X, "sign_error", "q 의 부호를 바꿨다."), W(y0, "step_missing", "y 를 답했다."), W(y0 / X, "step_missing", "q 를 빼지 않았다."), W(k + 1, "other", "계산 중 어긋났다.")].filter((w) => isInt(w.v) && w.v !== k),
          verificationJs: figJs({ X, q }, s.fig, `${XY_JS}const y=m*P.X+b; return (y-P.q)/P.X;`),
          trace: [...xyRead(s), [`x = ${X} 일 때 y = ${s.m}(${X}) + ${s.b} = ${y0} 이다.`, "Find y at the solution."], [`(${X}, ${y0}) 가 y = kx + ${q} 위에 있다.`, "The point lies on the second line."], [`k = (${y0} - ${q}) ÷ ${X} = ${k} 이다.`, "Solve for k."]], variant: "find_slope_from_solution",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "table_point_on_line", structure: "표의 점 중 지문의 직선 x + y = S 위에 있는 점의 x 좌표를 구함", extra: "easy: 표의 점 대입", concepts: ["값표", "연립의 해(표 안)"],
      gen(rng) {
        const s = makeXY(rng, { ms: [-5, -4, -3, -2, 2, 3, 4, 5] }); const i = rng.int(0, s.xs.length - 1); const S = s.xs[i] + s.ys[i]; if (Math.abs(S) < 2) throw new GenFail("S");
        return figInst(rng, {
          stimulus: `${xyIntro(rng)} ${rng.pick([`One of the pairs in the table is also a solution to $x + y = ${S}$.`, `Exactly one pair in the table also satisfies the equation $x + y = ${S}$.`, `The line $x + y = ${S}$ passes through one of the points listed in the table.`, `Only one of the listed pairs makes $x + y = ${S}$ true.`])}`, question: rng.pick([`What is the $x$-value of that pair?`, `What is $x$ for that pair?`]), correct: s.xs[i],
          wrongs: [W(s.ys[i], "axis_misread", "y 를 답했다."), ...s.xs.filter((_, j) => j !== i).map((x) => W(x, "condition_ignored", "다른 행을 골랐다."))],
          verificationJs: figJs({ S }, s.fig, `${XY_JS}const r=FIGURE.rows.filter(q=>q[0]+q[1]===P.S); if (r.length!==1) throw new Error('하나가 아님'); return r[0][0];`),
          trace: [[`표의 각 행에서 x + y 를 계산한다.`, "Add x and y in each row."], [`합이 ${S} 인 행은 x = ${s.xs[i]} 이다.`, "Find the matching row."]], variant: "row_on_second_line",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "horizontal_line", structure: "표의 일차식과 y = K 를 연립해 x 를 구함", extra: "medium: 식 세우고 대입", concepts: ["값표", "연립"],
      gen(rng) {
        const s = makeXY(rng); const x0 = rng.nz(-9, 12); if (s.xs.includes(x0)) throw new GenFail("x0"); const K = s.m * x0 + s.b; if (Math.abs(K) < 2) throw new GenFail("K");
        return figInst(rng, {
          stimulus: `${xyIntro(rng)} ${sysIntro(rng)} $y = ${K}$.`, question: rng.pick([`What is the $x$-coordinate of the solution to the system?`, `If $(x, y)$ is the solution, what is $x$?`]), correct: x0,
          wrongs: [W(K, "axis_misread", "y 를 답했다."), W(-x0, "sign_error", "부호를 반대로 했다."), W((K + s.b) / s.m, "sign_error", "절편 부호를 바꿨다."), W(K / s.m, "step_missing", "절편을 빼지 않았다."), W(x0 + 1, "other", "계산 중 어긋났다.")].filter((w) => isInt(w.v) && w.v !== x0),
          verificationJs: figJs({ K }, s.fig, `${XY_JS}return (P.K-b)/m;`),
          trace: [xyRead(s)[1], xyRead(s)[2], [`${lin(s.m, s.b)} = ${K} 에서 x = ${x0} 이다.`, "Solve for x."]], variant: "intersect_horizontal",
        }, s.fig);
      },
    },
  ],
}));
