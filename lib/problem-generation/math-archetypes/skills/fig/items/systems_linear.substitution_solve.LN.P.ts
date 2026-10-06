// systems_linear.substitution_solve.LN.P — 연립방정식의 한 식은 지문에 y = mx + b 로 주어지고 다른 식은 그래프(직선)로 주어진다. 대입으로 해를 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum, lin } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { makePureLines, PL2_JS, type PureLines } from "../pure-fn-kit";

const isI = Number.isInteger;
const LEAD = ["", "", "A student is solving a system of equations in algebra class. ", "A teacher shows a system of two linear equations. ", "A graphing program plots one equation of a system. "];
// 그림에는 두 직선이 모두 그려진다. 첫 직선(A1)의 식은 지문에, 두 번째 직선(B1)은 그림으로만 준다.
const intro = (s: PureLines, rng: Rng) => rng.pick(LEAD) + rng.pick([`A system of two linear equations has the equation $y = ${lin(s.m1, s.b1)}$. The graph of the other equation is also shown in the $xy$-plane, together with the graph of this one.`, `One equation of a system is $y = ${lin(s.m1, s.b1)}$. The xy-plane shown has the graphs of both equations in the system.`, `The graphs of the two equations in a system are shown in the $xy$-plane. One of the equations is $y = ${lin(s.m1, s.b1)}$.`, `In the $xy$-plane shown, the lines are the graphs of the equations in a system. The equation $y = ${lin(s.m1, s.b1)}$ is one of them.`, `Two equations form a system, and both are graphed in the $xy$-plane shown. The first equation is $y = ${lin(s.m1, s.b1)}$.`, `A system consists of $y = ${lin(s.m1, s.b1)}$ and a second linear equation. The $xy$-plane shown contains the graph of each equation.`, `The system includes the equation $y = ${lin(s.m1, s.b1)}$; the figure displays the graphs of both of its equations.`, `Both equations of a linear system are graphed in the $xy$-plane shown, and one of them can be written as $y = ${lin(s.m1, s.b1)}$.`]) + rng.pick([" The solution to the system is $(x, y)$.", " Let $(x, y)$ be the solution to the system.", " The system has one solution, $(x, y)$.", " Consider the ordered pair $(x, y)$ that solves the system."]);
const subRead = (s: PureLines): [string, string][] => [
  [`지문의 식에서 y = ${lin(s.m1, s.b1)} 이다.`, "Read the equation given in the text."],
  [`다른 직선이 지나는 격자점 (${s.xs2[0]}, ${s.ys2[0]}), (${s.xs2[1]}, ${s.ys2[1]}) 에서 기울기 ${s.m2}, y 절편 ${s.b2} 를 구한다.`, "Read the second line from two lattice points on it."],
  [`첫 식을 둘째 식 y = ${lin(s.m2, s.b2)} 에 대입한다.`, "Substitute one expression for y into the other."],
];
const gen = (rng: Rng) => makePureLines(rng);

export const ITEM = defineItem({
  prefix: "ssgg", itemId: "systems_linear.substitution_solve.LN.P",
  hard: [
    { op: "repr_shift", structure: "한 식은 지문, 다른 식은 그래프로 주어진 연립에서 대입해 해의 x 를 구함(교점은 그림 밖)", extra: "그래프에서 둘째 식을 세운 뒤 대입해 풀어야 함 — medium 은 그림 안의 교점", concepts: ["연립방정식", "대입법", "직선의 식 세우기"],
      gen(rng) { const s = gen(rng); return figInst(rng, { stimulus: intro(s, rng), question: rng.pick(["What is the value of $x$?", "What is the $x$-coordinate of the solution?", "What is $x$ at the solution?", "Find the value of $x$."]), correct: s.xi, wrongs: [W(-s.xi, "sign_error", "부호를 반대로 했다."), W(s.yi, "axis_misread", "y 를 답했다."), W((s.b1 - s.b2) / (s.m1 - s.m2), "sign_error", "절편의 차를 거꾸로 계산했다."), W(s.xi + 1, "other", "어긋났다.")].filter((w) => isI(w.v) && w.v !== s.xi), verificationJs: figJs({}, s.fig, `${PL2_JS}return xi;`), trace: [...subRead(s),  [`${s.m1}x + (${s.b1}) = ${s.m2}x + (${s.b2}) 에서 (${s.m1 - s.m2})x = ${s.b2 - s.b1} 이다.`, "Collect the x terms."], [`x = ${fmtNum(s.xi)} 이다.`, "Solve for x."]], variant: "substitute_x" }, s.fig); } },
    { op: "chain2", structure: "대입으로 x 를 구한 뒤 y 를 구함", extra: "x 를 구한 뒤 다시 대입하는 2단 연쇄 — medium 은 읽기", concepts: ["연립방정식", "대입법"],
      gen(rng) { const s = gen(rng); return figInst(rng, { stimulus: intro(s, rng), question: rng.pick(["What is the value of $y$?", "What is the $y$-coordinate of the solution?", "What is $y$ at the solution?", "Find the value of $y$."]), correct: s.yi, wrongs: [W(s.xi, "axis_misread", "x 를 답했다."), W(-s.yi, "sign_error", "부호를 반대로 했다."), W(s.m2 * s.xi - s.b2, "sign_error", "절편의 부호를 놓쳤다."), W(s.yi + 1, "other", "어긋났다.")].filter((w) => isI(w.v) && w.v !== s.yi), verificationJs: figJs({}, s.fig, `${PL2_JS}return yi;`), trace: [...subRead(s), [`x = ${fmtNum(s.xi)} 이다.`, "Solve for x."], [`y = ${s.m1} × ${fmtNum(s.xi)} + (${s.b1}) = ${fmtNum(s.yi)} 이다.`, "Substitute back."]], variant: "substitute_y" }, s.fig); } },
    { op: "compose_kind", structure: "해 (x, y) 를 구한 뒤 x + y 를 구함", extra: "둘 다 구해 합하는 2단 연쇄 — medium 은 읽기", concepts: ["연립방정식", "대입법", "해의 합"],
      gen(rng) { const s = gen(rng); const ans = s.xi + s.yi; if (ans === s.xi || ans === s.yi) throw new GenFail("tie"); return figInst(rng, { stimulus: intro(s, rng), question: rng.pick(["What is the value of $x + y$?", "Find the value of $x + y$.", "What does $x + y$ equal?"]), correct: ans, wrongs: [W(s.xi, "step_missing", "x 만 답했다."), W(s.yi, "step_missing", "y 만 답했다."), W(s.xi - s.yi, "sign_error", "y 의 부호를 반대로 더했다."), W(ans + 1, "other", "어긋났다.")].filter((w) => isI(w.v) && w.v !== ans), verificationJs: figJs({}, s.fig, `${PL2_JS}return xi + yi;`), trace: [...subRead(s), [`x = ${fmtNum(s.xi)}, y = ${fmtNum(s.yi)} 이다.`, "Solve the system."], [`x + y = ${ans} 이다.`, "Add."]], variant: "substitute_sum" }, s.fig); } },
    { op: "inverse", structure: "대입으로 해를 구한 뒤 x - y 를 구함", extra: "부호가 있는 차 x - y 를 구해야 함(순서를 바꾸는 것이 함정) — medium 은 읽기", concepts: ["연립방정식", "대입법", "해의 차"],
      gen(rng) { const s = gen(rng); const ans = s.xi - s.yi; if (ans === s.xi || ans === 0) throw new GenFail("tie"); return figInst(rng, { stimulus: intro(s, rng), question: rng.pick(["What is the value of $x - y$?", "Find the value of $x - y$.", "What does $x - y$ equal?"]), correct: ans, wrongs: [W(-ans, "sign_error", "순서를 바꿔 y - x 를 답했다."), W(s.xi + s.yi, "sign_error", "합을 답했다."), W(s.xi, "step_missing", "x 만 답했다."), W(ans + 1, "other", "어긋났다.")].filter((w) => isI(w.v) && w.v !== ans), verificationJs: figJs({}, s.fig, `${PL2_JS}return xi - yi;`), trace: [...subRead(s), [`x = ${fmtNum(s.xi)}, y = ${fmtNum(s.yi)} 이다.`, "Solve the system."], [`x - y = ${ans} 이다.`, "Subtract."]], variant: "substitute_difference" }, s.fig); } },
  ],
  em: [
    { lv: "easy", name: "read_x", structure: "그림 안의 교점의 x 를 읽음", extra: "easy: 교점 읽기", concepts: ["연립방정식", "교점"],
      gen(rng) { const s = makePureLines(rng, { inside: true }); return figInst(rng, { stimulus: intro(s, rng), question: "What is the value of $x$?", correct: s.xi, wrongs: [W(s.yi, "axis_misread", "y 를 답했다."), W(-s.xi, "sign_error", "부호를 바꿨다."), W(s.xi + 1, "other", "옆 눈금을 읽었다."), W(s.xi - 1, "other", "옆 눈금을 읽었다.")].filter((w) => w.v !== s.xi), verificationJs: figJs({}, s.fig, `${PL2_JS}return xi;`), trace: [[`두 직선이 만나는 점을 찾는다.`, "Find where the lines cross."], [`교점은 (${s.xi}, ${s.yi}) 이므로 x = ${s.xi} 이다.`, "Read x."]], variant: "read_x" }, s.fig); } },
    { lv: "medium", name: "read_sum", structure: "그림 안의 교점의 x + y 를 읽어 구함", extra: "medium: 읽고 합", concepts: ["연립방정식", "교점"],
      gen(rng) { const s = makePureLines(rng, { inside: true }); const ans = s.xi + s.yi; if (ans === s.xi || ans === s.yi) throw new GenFail("tie"); return figInst(rng, { stimulus: intro(s, rng), question: "What is the value of $x + y$?", correct: ans, wrongs: [W(s.xi, "step_missing", "x 만 답했다."), W(s.yi, "step_missing", "y 만 답했다."), W(s.xi - s.yi, "sign_error", "부호를 반대로 더했다."), W(ans + 1, "other", "어긋났다.")].filter((w) => w.v !== ans), verificationJs: figJs({}, s.fig, `${PL2_JS}return xi + yi;`), trace: [[`두 직선이 만나는 점을 찾는다.`, "Find where the lines cross."], [`교점은 (${s.xi}, ${s.yi}) 이다.`, "Read the point."], [`x + y = ${ans} 이다.`, "Add."]], variant: "read_sum" }, s.fig); } },
  ],
});
