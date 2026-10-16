// nonlinear_functions.find_x_for_value.FN.P — 순수 함수 그래프(포물선, 축 제목 x·y)에서 주어진 출력 c 가 되는 입력 x(방정식 f(x) = c 의 해)를 구한다(표 버전 .TB.P 의 그래프판).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { pickFn } from "./_t5-kit";
import { makeQuadG, pairXs, quadGIntro, quadGRead, QUADG_JS, type QuadG } from "../pure-kit";

const qv = (q: QuadG, x: number) => q.A * x * x + q.B * x + q.C;
/** 그림 밖(가로 범위 밖)의 정수 x — 두 해 중 한 해가 그림 밖이라 읽을 수 없다. */
const outX = (rng: Rng, q: QuadG) => (rng.chance(0.5) ? q.R + rng.int(1, 3) : -q.R - rng.int(1, 3));
/** f(x) = c 의 큰 해 / 작은 해(재계산: 근의 공식). */
const SOLS = (c: string) => `const a2=A, b2=B, c2=C-(${c}); const disc=b2*b2-4*a2*c2; if (disc<0) throw new Error('해 없음'); const r1=(-b2+Math.sqrt(disc))/(2*a2), r2=(-b2-Math.sqrt(disc))/(2*a2); const hi=Math.max(r1, r2), lo=Math.min(r1, r2);`;
const greater = ["What is the greater of the two solutions?", "If the two solutions are $x_1$ and $x_2$, where $x_1 < x_2$, what is the value of $x_2$?", "What is the larger solution?", "What is the greater value of $x$ that satisfies the equation?"];

export const ITEM = defineItem({
  prefix: "nfx", itemId: "nonlinear_functions.find_x_for_value.FN.P",
  hard: [
    {
      op: "repr_shift", structure: "포물선 그래프의 표시점으로 식을 세우고, 그림 밖의 출력 c 에 대해 f(x) = c 를 풀어 큰 해를 구함", extra: "해가 그림 밖이라 읽을 수 없어 식을 세운 뒤 이차방정식으로 바꿔 풀어야 함 — medium 은 표시된 같은 높이의 쌍에서 큰 해를 읽음",
      concepts: ["이차식 세우기", "이차방정식 풀이", "함숫값과 입력"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadG(rng, fn); const x1 = outX(rng, q); const c = qv(q, x1); const x2 = 2 * q.H - x1; if (x1 === x2) throw new GenFail("same");
        const hi = Math.max(x1, x2), lo = Math.min(x1, x2);
        return figInst(rng, {
          stimulus: `${quadGIntro(rng, fn)} The equation $${fn}(x) = ${c}$ has two solutions.`, question: rng.pick(greater), correct: hi,
          wrongs: [W(lo, "condition_ignored", "작은 해를 답했다."), W(-hi, "sign_error", "부호를 바꿨다."), W(-lo, "sign_error", "부호를 반대로 읽었다."), W(lo + hi, "formula_misuse", "두 해의 합을 답했다."), W(q.H, "axis_misread", "대칭축을 답했다.")].filter((w) => w.v !== hi),
          verificationJs: figJs({ c }, q.fig, `${QUADG_JS}${SOLS("P.c")}return hi;`),
          trace: [...quadGRead(q), [`${fn}(x) = ${c} 는 ${q.A}(x - (${q.H}))² + (${q.K}) = ${c} 이므로 (x - (${q.H}))² = ${(c - q.K) / q.A} 이다.`, "Set up the equation in vertex form."], [`해는 ${lo}, ${hi} 이고 큰 해는 ${hi} 이다.`, "Choose the greater solution."]], variant: "solve_for_output",
        }, q.fig);
      },
    },
    {
      op: "constraint_select", structure: "출력 c 가 표시점 한 개에서만 나오는 그래프에서, f(x) = c 의 두 해 중 표시되지 않은 해를 대칭으로 구함", extra: "표시점에서 한 해를 읽고 대칭축을 찾아 다른 해(표시 안 됨)를 골라야 함(표시된 해를 답하는 것이 함정) — medium 은 같은 높이 쌍에서 큰 해",
      concepts: ["포물선의 대칭", "f(x) = c 의 두 해", "해의 선택"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadG(rng, fn); const i = rng.int(0, 2); const x1 = q.xs[i], c = q.ys[i]; const x2 = 2 * q.H - x1; if (q.xs.includes(x2) || x2 === x1) throw new GenFail("both");
        return figInst(rng, {
          stimulus: `${quadGIntro(rng, fn)} The equation $${fn}(x) = ${c}$ has two solutions. One of them is the $x$-coordinate of a marked point.`, question: rng.pick([`What is the solution that is not the $x$-coordinate of a marked point?`, `What is the other solution?`]), correct: x2,
          wrongs: [W(x1, "condition_ignored", "표시점의 해를 답했다."), W(-x1, "sign_error", "부호만 바꿨다."), W(q.H, "step_missing", "대칭축을 답했다."), W(2 * q.H + x1, "sign_error", "2h + x 로 계산했다."), W(x2 + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== x2),
          verificationJs: figJs({ c }, q.fig, `${QUADG_JS}const hit=QS.points.filter(p=>p[1]===P.c); if (hit.length!==1) throw new Error('표시점 해 개수'); const o = 2 * H - hit[0][0]; if (QS.points.some(p=>p[0]===o)) throw new Error('둘 다 표시'); return o;`),
          trace: [...quadGRead(q), [`표시점 (${x1}, ${c}) 에서 한 해는 ${x1} 이다.`, "Read one solution from the marked point."], [`꼭짓점의 x 좌표 = ${fmtNum(q.H)} 이다.`, "Axis of symmetry."], [`다른 해 = 2 × ${fmtNum(q.H)} - (${x1}) = ${fmtNum(x2)} 이다.`, "Reflect across the axis."]], variant: "other_solution_by_symmetry",
        }, q.fig);
      },
    },
    {
      op: "chain2", structure: "그래프에서 식을 세우고, 그림 밖의 출력 c 에 대해 f(x) = c 의 두 해를 구한 뒤 두 해의 차를 구함", extra: "방정식을 풀고(2단) 큰 해 − 작은 해로 결합해야 함(합이나 한 해를 답하는 것이 함정) — medium 은 같은 높이 쌍에서 큰 해",
      concepts: ["이차식 세우기", "이차방정식 풀이", "두 해의 차"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadG(rng, fn); const x1 = outX(rng, q); const c = qv(q, x1); const x2 = 2 * q.H - x1; if (x1 === x2) throw new GenFail("same");
        const hi = Math.max(x1, x2), lo = Math.min(x1, x2); const ans = hi - lo;
        return figInst(rng, {
          stimulus: `${quadGIntro(rng, fn)} The equation $${fn}(x) = ${c}$ has two solutions.`, question: rng.pick([`What is the positive difference between the two solutions?`, `What is the distance between the two solutions on the $x$-axis?`, `What is the value of the greater solution minus the lesser solution?`]), correct: ans,
          wrongs: [W(hi + lo, "formula_misuse", "두 해의 합을 답했다."), W(hi, "step_missing", "큰 해를 답했다."), W(lo, "step_missing", "작은 해를 답했다."), W(ans / 2, "other", "반만 계산했다."), W(Math.abs(hi) - Math.abs(lo), "sign_error", "절댓값의 차를 구했다.")].filter((w) => Number.isInteger(w.v * 2) && w.v !== ans && w.v >= 0),
          verificationJs: figJs({ c }, q.fig, `${QUADG_JS}${SOLS("P.c")}return hi - lo;`),
          trace: [...quadGRead(q), [`${fn}(x) = ${c} 의 해는 ${lo}, ${hi} 이다.`, "Solve the equation."], [`차 = ${hi} - (${lo}) = ${ans} 이다.`, "Subtract the solutions."]], variant: "difference_of_solutions",
        }, q.fig);
      },
    },
    {
      op: "compose_kind", structure: "그래프에서 f 를 세우고, 합성식 f(x + s) = c 의 큰 해를 구함", extra: "f(u) = c 를 풀고 u = x + s 로 되돌려야 함(u 를 그대로 답하는 것이 함정) — medium 은 같은 높이 쌍에서 큰 해",
      concepts: ["이차식 세우기", "이차방정식 풀이", "함수의 합성(입력 이동)"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadG(rng, fn); const x1 = outX(rng, q); const c = qv(q, x1); const x2 = 2 * q.H - x1; const s = rng.nz(-6, 6); if (Math.abs(s) < 2 || x1 === x2) throw new GenFail("s");
        const hi = Math.max(x1, x2), lo = Math.min(x1, x2); const ans = hi - s; const se = s > 0 ? `x + ${s}` : `x - ${-s}`;
        return figInst(rng, {
          stimulus: `${quadGIntro(rng, fn)} The equation $${fn}(${se}) = ${c}$ has two solutions.`, question: rng.pick(greater), correct: ans,
          wrongs: [W(hi, "step_missing", "u = x + s 를 되돌리지 않았다."), W(hi + s, "sign_error", "이동 방향을 반대로 했다."), W(lo - s, "condition_ignored", "작은 해를 답했다."), W(-ans, "sign_error", "부호를 바꿨다."), W(lo + hi - 2 * s, "formula_misuse", "두 해의 합을 답했다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ c, s }, q.fig, `${QUADG_JS}${SOLS("P.c")}return hi - P.s;`),
          trace: [...quadGRead(q), [`u = ${se} 로 두면 ${fn}(u) = ${c} 의 해는 u = ${lo}, ${hi} 이다.`, "Solve for the inner input."], [`x = u - (${s}) 이므로 큰 해 x = ${hi} - (${s}) = ${ans} 이다.`, "Undo the shift."]], variant: "solve_shifted",
        }, q.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "vertex_value_input", structure: "꼭짓점이 표시된 그래프에서 최솟값(최댓값)이 되는 입력 x 를 읽음", extra: "easy: 표시된 꼭짓점의 x", concepts: ["포물선 그래프", "입력과 출력"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadG(rng, fn, { vertex: true }); const ex = q.A > 0 ? "minimum" : "maximum";
        return figInst(rng, { stimulus: quadGIntro(rng, fn), question: rng.pick([`For what value of $x$ does $${fn}(x)$ reach its ${ex} value, ${q.K}?`, `At what value of $x$ is $${fn}(x) = ${q.K}$, the ${ex} value?`]), correct: q.H, wrongs: [W(q.K, "axis_misread", "출력을 답했다."), W(-q.H, "sign_error", "부호를 바꿨다."), W(q.H + 1, "other", "한 칸 어긋났다."), W(q.H - 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== q.H), verificationJs: figJs({ k: q.K }, q.fig, `${QUADG_JS}if (Math.abs(K - P.k) > 1e-9) throw new Error('극값 불일치'); return H;`), trace: [[`꼭짓점은 (${q.H}, ${q.K}) 로 표시되어 있다.`, "The marked vertex."], [`x = ${q.H} 이다.`, "Read the input."]], variant: "read_vertex_input",
        }, q.fig);
      },
    },
    {
      lv: "medium", name: "greater_solution_marked_pair", structure: "같은 높이의 두 표시점에서 f(x) = c 의 큰 해를 읽음", extra: "medium: 쌍에서 큰 x", concepts: ["포물선의 대칭", "f(x) = c 의 해"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadG(rng, fn, { pair: true }); const pr = pairXs(q); if (pr.length !== 2) throw new GenFail("pair"); const c = q.ys[q.xs.indexOf(pr[0])]; const hi = pr[1];
        return figInst(rng, { stimulus: `${quadGIntro(rng, fn)} The equation $${fn}(x) = ${c}$ has two solutions.`, question: rng.pick(greater), correct: hi, wrongs: [W(pr[0], "condition_ignored", "작은 해를 답했다."), W(-hi, "sign_error", "부호를 바꿨다."), W(q.H, "axis_misread", "대칭축을 답했다."), W(c, "axis_misread", "출력을 답했다.")].filter((w) => w.v !== hi), verificationJs: figJs({ c }, q.fig, `${QUADG_JS}${SOLS("P.c")}return hi;`), trace: [...quadGRead(q), [`y = ${c} 인 표시점은 x = ${pr[0]}, ${pr[1]} 이므로 큰 해는 ${hi} 이다.`, "Read the two marked solutions."]], variant: "read_pair_solution",
        }, q.fig);
      },
    },
  ],
});
