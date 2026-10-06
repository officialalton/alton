// linear_equations_one_var.solve.LN.P — 순수 그래프(축 제목 x·y)에 그려진 두 일차함수 f, g 로 일차방정식 f(x) = g(x) 등을 푼다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { makePureLines, PL2_JS, pl2Read } from "../pure-fn-kit";

const isI = Number.isInteger;
const LEAD = ["", "", "A student is studying linear functions in algebra class. ", "A teacher graphs two linear functions on a grid. ", "A graphing program plots two functions. ", "In a practice set, two functions are shown as graphs. "];
const intro = (rng: Rng) => rng.pick(LEAD) + rng.pick(["The graphs of the linear functions $f$ and $g$ are shown in the $xy$-plane.", "The figure shows the graphs of two linear functions, $f$ and $g$, in the $xy$-plane.", "In the $xy$-plane shown, the lines are the graphs of $y = f(x)$ and $y = g(x)$.", "Two linear functions, $f$ and $g$, are graphed in the $xy$-plane shown.", "The graph shown gives the linear functions $f$ and $g$."]);
const mk = (rng: Rng, inside = false) => makePureLines(rng, { inside, labels: ["f", "g"] });
const askX = (rng: Rng) => rng.pick(["What is $x$?", "Find $x$.", "What number is $x$?", "What is the solution $x$?"]);
const eqs = (rng: Rng, rhs: string) => rng.pick([`For some number $x$, ${rhs}.`, `There is a number $x$ for which ${rhs}.`, `A number $x$ satisfies ${rhs}.`, `Suppose ${rhs}, for a number $x$.`]);

export const ITEM = defineItem({
  prefix: "leog", itemId: "linear_equations_one_var.solve.LN.P",
  hard: [
    {
      op: "repr_shift", structure: "그림 안에서 만나지 않는 두 직선에서 f, g 의 식을 세워 방정식 f(x) = g(x) 를 풂", extra: "교점이 그림 밖이라 두 식을 세워 한 변수 방정식으로 바꿔 풀어야 함 — medium 은 그림 안의 교점",
      concepts: ["일차함수의 그래프", "식 세우기", "일차방정식 풀이"],
      gen(rng) {
        const s = mk(rng);
        return figInst(rng, { stimulus: `${intro(rng)} ${eqs(rng, "$f(x) = g(x)$")}`, question: askX(rng), correct: s.xi,
          wrongs: [W(-s.xi, "sign_error", "부호를 반대로 했다."), W(s.yi, "axis_misread", "공통 함숫값을 답했다."), W((s.b1 - s.b2) / (s.m1 - s.m2), "sign_error", "절편의 차를 거꾸로 계산했다."), W((s.b2 - s.b1) / (s.m1 + s.m2), "formula_misuse", "기울기를 더했다."), W(s.xi + 1, "other", "어긋났다.")].filter((w) => isI(w.v) && w.v !== s.xi),
          verificationJs: figJs({}, s.fig, `${PL2_JS}return xi;`),
          trace: [...pl2Read(s), [`(${s.m1} - (${s.m2}))x = ${s.b2} - (${s.b1}) 이다.`, "Collect the x terms."], [`x = ${fmtNum(s.xi)} 이다.`, "Solve for x."]], variant: "f_equals_g_outside",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "f(x) = g(x) 의 해를 구한 뒤 그때의 공통 함숫값을 구함", extra: "x 를 구한 뒤 다시 대입해 값을 구하는 2단 연쇄(x 를 답하는 것이 함정) — medium 은 읽기",
      concepts: ["일차함수의 그래프", "일차방정식 풀이", "대입"],
      gen(rng) {
        const s = mk(rng);
        return figInst(rng, { stimulus: `${intro(rng)} ${eqs(rng, "$f(x) = g(x)$")}`, question: rng.pick(["What is the common output of $f$ and $g$ at that number?", "At that number, what is $f(x)$?", "What does $f(x)$ equal for that $x$?"]), correct: s.yi,
          wrongs: [W(s.xi, "axis_misread", "x 를 답했다."), W(-s.yi, "sign_error", "부호를 반대로 했다."), W(s.m1 * s.xi - s.b1, "sign_error", "절편의 부호를 놓쳤다."), W(s.m2 * s.xi + s.b1, "formula_misuse", "다른 직선의 절편을 썼다."), W(s.yi + 1, "other", "어긋났다.")].filter((w) => isI(w.v) && w.v !== s.yi),
          verificationJs: figJs({}, s.fig, `${PL2_JS}return yi;`),
          trace: [...pl2Read(s), [`x = ${fmtNum(s.xi)} 이다.`, "Solve for x."], [`f(${fmtNum(s.xi)}) = ${s.m1} × ${fmtNum(s.xi)} + (${s.b1}) = ${fmtNum(s.yi)} 이다.`, "Substitute."]], variant: "common_value",
        }, s.fig);
      },
    },
    {
      op: "compose_kind", structure: "두 직선의 식을 세워 f(x) = g(x) + k 의 해를 구함(그림 밖의 값 이동)", extra: "g 에 상수 k 가 더해져 해가 달라짐(f(x) = g(x) 의 해를 그대로 답하는 것이 함정) — medium 은 f(x) = g(x)",
      concepts: ["일차함수의 그래프", "식 세우기", "일차방정식 풀이"],
      gen(rng) {
        const s = mk(rng); const dx = rng.nz(-4, 4); const k = (s.m1 - s.m2) * dx; if (Math.abs(k) > 40 || k === 0) throw new GenFail("k"); const ans = s.xi + dx;
        return figInst(rng, { stimulus: `${intro(rng)} ${eqs(rng, `$f(x) = g(x) + ${k < 0 ? `(${k})` : k}$`)}`, question: askX(rng), correct: ans,
          wrongs: [W(s.xi, "condition_ignored", "k 를 무시하고 f(x) = g(x) 의 해를 답했다."), W(s.xi - dx, "sign_error", "k 의 부호를 반대로 옮겼다."), W(-ans, "sign_error", "부호를 바꿨다."), W(s.yi, "axis_misread", "함숫값을 답했다."), W(ans + 1, "other", "어긋났다.")].filter((w) => isI(w.v) && w.v !== ans),
          verificationJs: figJs({ k }, s.fig, `${PL2_JS}return (b2 + P.k - b1) / (m1 - m2);`),
          trace: [...pl2Read(s), [`${s.m1}x + (${s.b1}) = ${s.m2}x + (${s.b2}) + (${k}) 로 놓는다.`, "Add k to g."], [`(${s.m1} - (${s.m2}))x = ${s.b2 + k - s.b1} 에서 x = ${ans} 이다.`, "Solve for x."]], variant: "f_equals_g_plus_k",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "f 의 식을 세워 그림 밖의 값 f(x) = c 가 되는 x 를 역산", extra: "그림 밖의 값이라 식을 세운 뒤 거꾸로 풀어야 함(c 를 그대로 답하는 것이 함정) — medium 은 읽기",
      concepts: ["일차함수의 그래프", "식 세우기", "역산"],
      gen(rng) {
        const s = mk(rng); const xv = rng.pick([-1, 1]) * rng.int(s.R + 1, s.R + 6); const c = s.m1 * xv + s.b1; if (Math.abs(c) > 80) throw new GenFail("c");
        return figInst(rng, { stimulus: `${intro(rng)} ${eqs(rng, `$f(x) = ${c < 0 ? `-${-c}` : c}$`)}`, question: askX(rng), correct: xv,
          wrongs: [W(-xv, "sign_error", "부호를 반대로 했다."), W(c - s.b1, "step_missing", "기울기로 나누지 않았다."), W((c + s.b1) / s.m1, "sign_error", "절편을 더했다."), W(c, "axis_misread", "c 를 답했다."), W(xv + 1, "other", "어긋났다.")].filter((w) => isI(w.v) && w.v !== xv),
          verificationJs: figJs({ c }, s.fig, `${PL2_JS}return (P.c - b1) / m1;`),
          trace: [...pl2Read(s), [`f(x) = ${s.m1}x + (${s.b1}) 이다.`, "Write f."], [`${s.m1}x + (${s.b1}) = ${c} 에서 x = ${xv} 이다.`, "Solve for x."]], variant: "f_equals_c_outside",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "read_crossing", structure: "그림 안의 격자점에서 만나는 두 직선에서 f(x) = g(x) 의 해를 읽음", extra: "easy: 교점의 x", concepts: ["일차함수의 그래프", "교점"],
      gen(rng) { const s = mk(rng, true); return figInst(rng, { stimulus: `${intro(rng)} ${eqs(rng, "$f(x) = g(x)$")}`, question: askX(rng), correct: s.xi, wrongs: [W(s.yi, "axis_misread", "y 좌표를 답했다."), W(-s.xi, "sign_error", "부호를 바꿨다."), W(s.xi + 1, "other", "옆 눈금을 읽었다."), W(s.xi - 1, "other", "옆 눈금을 읽었다.")].filter((w) => w.v !== s.xi), verificationJs: figJs({}, s.fig, `${PL2_JS}return xi;`), trace: [[`두 직선이 만나는 점을 찾는다.`, "Find where the lines cross."], [`교점은 (${s.xi}, ${s.yi}) 이므로 x = ${s.xi} 이다.`, "Read x."]], variant: "read_crossing_x" }, s.fig); },
    },
    {
      lv: "medium", name: "common_value_read", structure: "그림 안의 교점의 공통 함숫값을 읽음", extra: "medium: 교점의 y", concepts: ["일차함수의 그래프", "교점"],
      gen(rng) { const s = mk(rng, true); return figInst(rng, { stimulus: `${intro(rng)} ${eqs(rng, "$f(x) = g(x)$")}`, question: rng.pick(["What is the common output of $f$ and $g$ at that number?", "At that number, what is $f(x)$?", "What does $f(x)$ equal for that $x$?"]), correct: s.yi, wrongs: [W(s.xi, "axis_misread", "x 를 답했다."), W(-s.yi, "sign_error", "부호를 바꿨다."), W(s.yi + 1, "other", "어긋났다.")].filter((w) => w.v !== s.yi), verificationJs: figJs({}, s.fig, `${PL2_JS}return yi;`), trace: [[`두 직선이 만나는 점을 찾는다.`, "Find where the lines cross."], [`교점은 (${s.xi}, ${s.yi}) 이다.`, "Read the crossing point."], [`공통 함숫값은 ${s.yi} 이다.`, "The common value is y."]], variant: "read_crossing_y" }, s.fig); },
    },
  ],
});
