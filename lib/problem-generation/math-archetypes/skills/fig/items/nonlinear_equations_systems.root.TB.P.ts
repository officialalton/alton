// nonlinear_equations_systems.root.TB.P — 이차함수 값표에서 방정식 f(x) = 0 의 해(그래프의 x 절편)를 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { A_POOL, pickFn, QUAD_JS, quadIntro, quadRead, quadRoots, quadWithRoots, ROOTS_JS, symStep, xsRun, type Quad } from "./_t5-kit";

/** 표에 근 p 가 있고 q 는 없는(또는 둘 다 있는) 값표. */
function withRootRows(rng: Rng, fn: string, both: boolean, vIn?: boolean): Quad & { p: number; q: number } {
  for (let t = 0; t < 80; t++) {
    const a = rng.pick(A_POOL); const p = rng.int(-7, 5); const q = p + 2 * rng.int(1, 4) + (vIn === undefined ? rng.int(0, 1) : vIn ? 0 : 1); const n = rng.int(5, 6);
    const x0 = rng.int(p - n + 1, p); const xs = xsRun(x0, n); if (!xs.includes(p) || xs.includes(q) !== both) continue; if (vIn && !xs.includes((p + q) / 2)) continue;
    try { return { ...quadRoots(fn, a, p, q, xs), p, q }; } catch { continue; }
  }
  throw new GenFail("근 행 값표 표집 실패");
}
const sols = (fn: string, rng: Rng) => rng.pick([`The equation $${fn}(x) = 0$ has two real solutions.`, `The graph of $y = ${fn}(x)$ crosses the $x$-axis at two points.`, `The function $${fn}$ has two zeros.`]);
const askGreater = (rng: Rng) => rng.pick(["What is the greater solution?", "What is the larger of the two values of $x$?", "What is the greatest value of $x$ that satisfies the equation?"]);

export const ITEM = defineItem({
  prefix: "nes", itemId: "nonlinear_equations_systems.root.TB.P",
  hard: [
    {
      op: "repr_shift", structure: "근이 표에 없는 이차 값표에서 식을 세워 f(x) = 0 을 인수분해해 큰 해를 구함", extra: "표에 0 인 칸이 없어 2계 차분·두 점으로 식을 세운 뒤 방정식으로 바꿔 풀어야 함 — medium 은 표의 근과 꼭짓점으로 대칭",
      concepts: ["이차식 세우기", "이차방정식 인수분해", "함수의 영점"],
      gen(rng) {
        const fn = pickFn(rng); const q = quadWithRoots(rng, fn);
        return figInst(rng, {
          stimulus: `${quadIntro(rng, fn)} The equation $${fn}(x) = 0$ has two real solutions.`, question: askGreater(rng), correct: q.q,
          wrongs: [W(q.p, "condition_ignored", "작은 해를 답했다."), W(-q.p, "sign_error", "인수의 부호를 반대로 읽었다."), W(-q.q, "sign_error", "부호를 바꿨다."), W(q.C, "axis_misread", "y 절편을 답했다."), W(q.H, "axis_misread", "대칭축을 답했다.")].filter((w) => w.v !== q.q),
          verificationJs: figJs({}, q.fig, `${QUAD_JS}const a2=A, b2=B, c2=C; ${ROOTS_JS}return hi;`),
          trace: [...quadRead(q), [`${fn}(x) = ${fmtNum(q.A)}(x - (${q.p}))(x - (${q.q})) 로 인수분해한다.`, "Factor the quadratic."], [`해는 ${q.p}, ${q.q} 이고 큰 해는 ${q.q} 이다.`, "Take the greater solution."]], variant: "zero_from_fit",
        }, q.fig);
      },
    },
    {
      op: "compose_kind", structure: "값표에서 f 의 영점을 구하고, 합성식 f(kx) = 0 의 큰 해를 구함", extra: "f 의 영점 u 를 구한 뒤 kx = u 로 되돌려 나눠야 함(u 를 그대로 답하는 것이 함정) — medium 은 f 의 영점",
      concepts: ["이차식 세우기", "함수의 영점", "함수의 합성(입력 배율)"],
      gen(rng) {
        const fn = pickFn(rng); const q = quadWithRoots(rng, fn); const k = rng.pick([2, 3, 4]); const big = Math.max(q.p / k, q.q / k); if (!Number.isInteger(big * 2) && !Number.isInteger(big * 10)) throw new GenFail("frac");
        return figInst(rng, {
          stimulus: `${quadIntro(rng, fn)} The equation $${fn}(${k}x) = 0$ has two real solutions.`, question: askGreater(rng), correct: big,
          wrongs: [W(q.q, "step_missing", "kx = u 를 되돌리지 않았다."), W(q.q * k, "formula_misuse", "k 를 곱했다."), W(Math.min(q.p / k, q.q / k), "condition_ignored", "작은 해를 답했다."), W(-big, "sign_error", "부호를 바꿨다."), W((q.p + q.q) / k, "formula_misuse", "두 해의 합을 답했다.")].filter((w) => w.v !== big),
          verificationJs: figJs({ k }, q.fig, `${QUAD_JS}const a2=A, b2=B, c2=C; ${ROOTS_JS}return Math.max(hi / P.k, lo / P.k);`),
          trace: [...quadRead(q), [`${fn}(u) = 0 의 해는 u = ${q.p}, ${q.q} 이다.`, "Find the zeros of f."], [`${k}x = u 이므로 x = ${fmtNum(q.p / k)}, ${fmtNum(q.q / k)}, 큰 해 ${fmtNum(big)} 이다.`, "Divide by k."]], variant: "zero_scaled_input",
        }, q.fig);
      },
    },
    {
      op: "chain2", structure: "값표에서 식을 세워 두 영점을 구한 뒤, 그래프의 두 x 절편 사이 거리를 구함", extra: "식 → 두 근 → 거리(차), 2단 연쇄 — medium 은 한 근",
      concepts: ["이차식 세우기", "이차방정식의 두 해", "x 절편 사이 거리"],
      gen(rng) {
        const fn = pickFn(rng); const q = quadWithRoots(rng, fn); const ans = q.q - q.p;
        return figInst(rng, {
          stimulus: `${quadIntro(rng, fn)} The graph of $y = ${fn}(x)$ in the $xy$-plane intersects the $x$-axis at two points.`, question: `What is the distance between these two points?`, correct: ans,
          wrongs: [W(q.p + q.q, "formula_misuse", "두 해의 합을 답했다."), W(Math.abs(q.p) + Math.abs(q.q) === ans ? ans + 2 : Math.abs(q.p) + Math.abs(q.q), "sign_error", "절댓값을 더했다."), W(q.q, "step_missing", "큰 해만 답했다."), W(ans / 2, "formula_misuse", "축까지 거리를 답했다."), W(q.p * q.q, "formula_misuse", "두 해의 곱을 답했다.")].filter((w) => w.v !== ans && w.v > 0),
          verificationJs: figJs({}, q.fig, `${QUAD_JS}const a2=A, b2=B, c2=C; ${ROOTS_JS}return hi - lo;`),
          trace: [...quadRead(q), [`인수분해: ${fmtNum(q.A)}(x - (${q.p}))(x - (${q.q})) = 0, 해 ${q.p}, ${q.q} 이다.`, "Find both zeros."], [`거리 = ${q.q} - (${q.p}) = ${ans} 이다.`, "Subtract the zeros."]], variant: "distance_between_zeros",
        }, q.fig);
      },
    },
    {
      op: "constraint_select", structure: "표에 영점 하나만 보이는 이차 값표에서 다른 영점(표 밖)을 대칭이나 식으로 구해 고름", extra: "표의 0 칸으로 한 해를 읽고 축을 찾아 표 밖의 해를 골라야 함(보이는 해를 답하는 것이 함정) — medium 은 꼭짓점 칸이 보이는 표",
      concepts: ["함수의 영점", "이차함수의 대칭", "해의 선택"],
      gen(rng) {
        const fn = pickFn(rng); const q = withRootRows(rng, fn, false); const sf = rng.chance(0.5);
        return figInst(rng, {
          stimulus: `${quadIntro(rng, fn)} ${sols(fn, rng)}`, question: sf ? `One solution of $${fn}(x) = 0$ can be found in the table. What is the other solution?` : `What is the value of $x$, not listed in the table, for which $${fn}(x) = 0$?`, correct: q.q,
          wrongs: [W(q.p, "condition_ignored", "표에 있는 해를 답했다."), W(-q.p, "sign_error", "부호만 바꿨다."), W(q.H, "step_missing", "축을 답했다."), W(q.q + 1, "other", "한 칸 어긋났다."), W(q.p - (q.q - q.p), "sign_error", "반대쪽으로 반사했다.")].filter((w) => w.v !== q.q),
          verificationJs: figJs({}, q.fig, `${QUAD_JS}const z=FIGURE.rows.filter(r=>r[1]===0); if (z.length!==1) throw new Error('표의 영점 개수'); return 2 * H - z[0][0];`),
          trace: [quadRead(q)[0], quadRead(q)[1], [`표에서 ${fn}(${q.p}) = 0 이다.`, "Read one zero from the table."], symStep(q), [`다른 해 = 2 × ${fmtNum(q.H)} - (${q.p}) = ${q.q} 이다.`, "Reflect across the axis."]], variant: "other_zero",
        }, q.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "zeros_in_table", structure: "두 영점이 모두 표에 있는 값표에서 큰 해를 읽음", extra: "easy: 0 인 칸 찾기", concepts: ["함수의 영점", "값표 읽기"],
      gen(rng) {
        const fn = pickFn(rng); const q = withRootRows(rng, fn, true);
        return figInst(rng, { stimulus: `${quadIntro(rng, fn)} ${sols(fn, rng)}`, question: askGreater(rng), correct: q.q, wrongs: [W(q.p, "condition_ignored", "작은 해를 답했다."), W(q.C, "axis_misread", "y 절편을 답했다."), W(-q.q, "sign_error", "부호를 바꿨다."), W(q.q + 1, "other", "옆 칸을 읽었다.")].filter((w) => w.v !== q.q), verificationJs: figJs({}, q.fig, `${QUAD_JS}const a2=A, b2=B, c2=C; ${ROOTS_JS}return hi;`), trace: [[`표에서 ${fn}(x) = 0 인 x 는 ${q.p}, ${q.q} 이다.`, "Find the zeros in the table."], [`큰 해는 ${q.q} 이다.`, "Choose the greater one."]], variant: "zeros_read",
        }, q.fig);
      },
    },
    {
      lv: "medium", name: "zero_by_vertex", structure: "영점 하나와 꼭짓점 칸이 보이는 표에서 다른 영점을 대칭으로 구함", extra: "medium: 꼭짓점 기준 반사", concepts: ["함수의 영점", "이차함수의 대칭"],
      gen(rng) {
        const fn = pickFn(rng); const q = withRootRows(rng, fn, false, true);
        return figInst(rng, { stimulus: `${quadIntro(rng, fn)} ${sols(fn, rng)}`, question: askGreater(rng), correct: q.q, wrongs: [W(q.p, "condition_ignored", "표의 해를 답했다."), W(q.H, "step_missing", "꼭짓점 x 를 답했다."), W(-q.p, "sign_error", "부호만 바꿨다."), W(q.q + 2, "other", "어긋났다.")].filter((w) => w.v !== q.q), verificationJs: figJs({}, q.fig, `${QUAD_JS}const a2=A, b2=B, c2=C; ${ROOTS_JS}return hi;`), trace: [[`표에서 ${fn}(${q.p}) = 0 이다.`, "Read one zero."], symStep(q), [`다른 해 = 2 × ${fmtNum(q.H)} - (${q.p}) = ${q.q} 이다.`, "Reflect across the axis."]], variant: "zero_reflect",
        }, q.fig);
      },
    },
  ],
});
