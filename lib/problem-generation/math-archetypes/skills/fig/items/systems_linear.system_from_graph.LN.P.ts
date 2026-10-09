// systems_linear.system_from_graph.LN.P — 순수 그래프(축 제목 x·y)의 두 직선(연립방정식의 그래프)에서 연립의 해(교점)를 구한다.
import { GenFail } from "../../../types";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { makePureLines, PL2_JS, pl2Intro, pl2Read } from "../pure-fn-kit";

const isInt = Number.isInteger;
const SOL = ["The solution to the system is $(x, y)$.", "Let $(x, y)$ be the solution to the system.", "The system has exactly one solution, $(x, y)$.", "The ordered pair $(x, y)$ is the solution to the system.", "If $(x, y)$ is the solution to the system, consider its coordinates."];

export const ITEM = defineItem({
  prefix: "sfgg", itemId: "systems_linear.system_from_graph.LN.P",
  hard: [
    {
      op: "repr_shift", structure: "그림 안에서 만나지 않는 두 직선에서 각각의 식을 세우고, 연립해 해의 x 좌표를 구함", extra: "교점이 그림 밖이라 읽을 수 없어 두 식을 세워 연립해야 함(두 직선의 y 절편 차를 기울기 차로 나눌 때 부호 함정) — medium 은 그림 안의 교점 읽기",
      concepts: ["연립방정식의 그래프", "직선의 식 세우기", "연립방정식 풀이"],
      gen(rng) {
        const s = makePureLines(rng);
        return figInst(rng, {
          stimulus: `${pl2Intro(rng)} ${rng.pick(SOL)}`, question: rng.pick([`What is the value of $x$?`, `What is the $x$-coordinate of the solution?`, `What is $x$?`]), correct: s.xi,
          wrongs: [W(-s.xi, "sign_error", "부호를 반대로 했다."), W(s.yi, "axis_misread", "y 좌표를 답했다."), W((s.b1 - s.b2) / (s.m1 - s.m2), "sign_error", "절편의 차를 거꾸로 계산했다."), W((s.b2 - s.b1) / (s.m1 + s.m2), "formula_misuse", "기울기를 더했다."), W(s.xi + 1, "other", "어긋났다.")].filter((w) => isInt(w.v) && w.v !== s.xi),
          verificationJs: figJs({}, s.fig, `${PL2_JS}return xi;`),
          trace: [...pl2Read(s), [`(${s.m1} - (${s.m2}))x = ${s.b2} - (${s.b1}) 이다.`, "Collect the x terms."], [`x = ${fmtNum(s.b2 - s.b1)} ÷ ${fmtNum(s.m1 - s.m2)} = ${fmtNum(s.xi)} 이다.`, "Solve for x."]], variant: "solution_x_outside",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "연립해 해의 x 를 구한 뒤 한 직선의 식에 대입해 y 좌표를 구함", extra: "x 를 구한 뒤 다시 대입해 y 를 구하는 2단 연쇄(x 를 답하는 것이 함정) — medium 은 읽기",
      concepts: ["연립방정식의 그래프", "연립방정식 풀이", "대입"],
      gen(rng) {
        const s = makePureLines(rng);
        return figInst(rng, {
          stimulus: `${pl2Intro(rng)} ${rng.pick(SOL)}`, question: rng.pick([`What is the value of $y$?`, `What is the $y$-coordinate of the solution?`, `What is $y$?`]), correct: s.yi,
          wrongs: [W(s.xi, "axis_misread", "x 좌표를 답했다."), W(-s.yi, "sign_error", "부호를 반대로 했다."), W(s.m1 * s.xi - s.b1, "sign_error", "절편의 부호를 놓쳤다."), W(s.m2 * s.xi + s.b1, "formula_misuse", "다른 직선의 절편을 썼다."), W(s.yi + 1, "other", "어긋났다.")].filter((w) => isInt(w.v) && w.v !== s.yi),
          verificationJs: figJs({}, s.fig, `${PL2_JS}return yi;`),
          trace: [...pl2Read(s), [`x = ${fmtNum(s.xi)} 이다.`, "Solve for x."], [`y = ${s.m1} × ${fmtNum(s.xi)} + (${s.b1}) = ${fmtNum(s.yi)} 이다.`, "Substitute into the first equation."]], variant: "solution_y_outside",
        }, s.fig);
      },
    },
    {
      op: "compose_kind", structure: "연립의 해 (x, y) 를 구한 뒤 x + y 를 구함", extra: "x 와 y 를 모두 구해 합하는 2단 연쇄(둘 중 하나만 답하는 것이 함정) — medium 은 읽기",
      concepts: ["연립방정식의 그래프", "연립방정식 풀이", "해의 합"],
      gen(rng) {
        const s = makePureLines(rng); const ans = s.xi + s.yi; if (ans === s.xi || ans === s.yi) throw new GenFail("tie");
        return figInst(rng, {
          stimulus: `${pl2Intro(rng)} ${rng.pick(SOL)}`, question: rng.pick([`What is the value of $x + y$?`, `What is the sum of $x$ and $y$?`]), correct: ans,
          wrongs: [W(s.xi, "step_missing", "x 만 답했다."), W(s.yi, "step_missing", "y 만 답했다."), W(s.xi - s.yi, "sign_error", "y 의 부호를 반대로 더했다."), W(-ans, "sign_error", "부호를 바꿨다."), W(ans + 1, "other", "어긋났다.")].filter((w) => isInt(w.v) && w.v !== ans),
          verificationJs: figJs({}, s.fig, `${PL2_JS}return xi + yi;`),
          trace: [...pl2Read(s), [`x = ${fmtNum(s.xi)}, y = ${fmtNum(s.yi)} 이다.`, "Solve the system."], [`x + y = ${fmtNum(ans)} 이다.`, "Add."]], variant: "solution_sum",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "연립의 해를 구하고, 해를 지나는 기울기 M 의 직선 y = Mx + k 의 k 를 역산", extra: "해 (x, y) 를 먼저 구한 뒤 k = y - Mx 로 거슬러 구해야 함(해의 y 를 답하는 것이 함정) — medium 은 읽기",
      concepts: ["연립방정식의 그래프", "연립방정식 풀이", "점을 지나는 직선"],
      gen(rng) {
        const s = makePureLines(rng); const M = rng.nz(-5, 5); const k = s.yi - M * s.xi; if (Math.abs(k) > 60 || k === 0) throw new GenFail("k");
        return figInst(rng, {
          stimulus: `${pl2Intro(rng)} ${rng.pick([`The line $y = ${M === 1 ? "" : M === -1 ? "-" : M}x + k$, where $k$ is a constant, passes through the solution to the system.`, `For a constant $k$, the line $y = ${M === 1 ? "" : M === -1 ? "-" : M}x + k$ contains the point that is the solution to the system.`, `The solution to the system lies on the line $y = ${M === 1 ? "" : M === -1 ? "-" : M}x + k$, where $k$ is a constant.`])}`, question: rng.pick([`What is the value of $k$?`, `What is $k$?`, `What is the value of the constant $k$?`]), correct: k,
          wrongs: [W(s.yi, "step_missing", "해의 y 좌표를 답했다."), W(s.yi + M * s.xi, "sign_error", "부호를 반대로 했다."), W(-k, "sign_error", "부호를 바꿨다."), W(s.xi, "axis_misread", "x 좌표를 답했다."), W(k + 1, "other", "어긋났다.")].filter((w) => isInt(w.v) && w.v !== k),
          verificationJs: figJs({ M }, s.fig, `${PL2_JS}return yi - P.M * xi;`),
          trace: [...pl2Read(s), [`해는 (${fmtNum(s.xi)}, ${fmtNum(s.yi)}) 이다.`, "Solve the system."], [`k = y - Mx = ${fmtNum(s.yi)} - (${M})(${fmtNum(s.xi)}) = ${fmtNum(k)} 이다.`, "Solve for k."]], variant: "line_through_solution",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "read_intersection_x", structure: "그림 안의 격자점에서 만나는 두 직선의 교점의 x 를 읽음", extra: "easy: 교점 읽기", concepts: ["연립방정식의 그래프", "교점"],
      gen(rng) {
        const s = makePureLines(rng, { inside: true });
        return figInst(rng, { stimulus: `${pl2Intro(rng)} ${rng.pick(SOL)}`, question: rng.pick([`What is the value of $x$?`, `What is the $x$-coordinate of the solution?`]), correct: s.xi, wrongs: [W(s.yi, "axis_misread", "y 좌표를 답했다."), W(-s.xi, "sign_error", "부호를 바꿨다."), W(s.xi + 1, "other", "옆 눈금을 읽었다."), W(s.xi - 1, "other", "옆 눈금을 읽었다.")].filter((w) => w.v !== s.xi), verificationJs: figJs({}, s.fig, `${PL2_JS}return xi;`), trace: [[`두 직선이 만나는 점을 찾는다.`, "Find where the lines cross."], [`교점은 (${s.xi}, ${s.yi}) 이므로 x = ${s.xi} 이다.`, "Read the x-coordinate."]], variant: "read_intersection_x",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "read_intersection_sum", structure: "그림 안의 교점의 x + y 를 읽어 구함", extra: "medium: 교점 읽고 합", concepts: ["연립방정식의 그래프", "교점"],
      gen(rng) {
        const s = makePureLines(rng, { inside: true }); const ans = s.xi + s.yi; if (ans === s.xi || ans === s.yi) throw new GenFail("tie");
        return figInst(rng, { stimulus: `${pl2Intro(rng)} ${rng.pick(SOL)}`, question: rng.pick([`What is the value of $x + y$?`, `What is the sum of $x$ and $y$?`]), correct: ans, wrongs: [W(s.xi, "step_missing", "x 만 답했다."), W(s.yi, "step_missing", "y 만 답했다."), W(s.xi - s.yi, "sign_error", "부호를 반대로 더했다."), W(ans + 1, "other", "어긋났다.")].filter((w) => w.v !== ans), verificationJs: figJs({}, s.fig, `${PL2_JS}return xi + yi;`), trace: [[`두 직선이 만나는 점을 찾는다.`, "Find where the lines cross."], [`교점은 (${s.xi}, ${s.yi}) 이다.`, "Read the intersection."], [`x + y = ${ans} 이다.`, "Add."]], variant: "read_intersection_sum",
        }, s.fig);
      },
    },
  ],
});
