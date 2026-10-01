// nonlinear_equations_systems.sum_of_roots.TB.P — 이차함수 값표에서 방정식의 해의 합(곱)을 구한다(해 자체는 무리수일 수 있어 대칭·근과 계수 관계를 써야 함).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { linTex, pickFn, QUAD_JS, quadAround, quadIntro, quadOneSided, quadRead, quadRoots, symStep, xsRun, A_POOL, type Quad } from "./_t5-kit";

/** 두 실근(무리수 가능)을 갖는 값표: a·k < 0. */
const realRoots = (rng: Rng, make: () => Quad): Quad => { for (let t = 0; t < 40; t++) { const q = make(); if (q.A * q.K < 0) return q; } throw new GenFail("실근 없음"); };
const sumQ = (fn: string, rng: Rng, eq: string) => rng.pick([`What is the sum of the solutions to the equation $${eq}$?`, `The equation $${eq}$ has two real solutions. What is the sum of these solutions?`, `What is the sum of all real solutions to $${eq}$?`]);
const VIETA: [string, string] = ["두 해의 합 = -b ÷ a (= 대칭축의 2배) 이다.", "The sum of the roots is -b / a, twice the axis of symmetry."];

export const ITEM = defineItem({
  prefix: "nes", itemId: "nonlinear_equations_systems.sum_of_roots.TB.P",
  hard: [
    {
      op: "repr_shift", structure: "대칭 쌍이 없는 이차 값표에서 식을 세워 f(x) = 0 의 두 해(무리수)의 합을 -b/a 로 구함", extra: "해가 무리수라 직접 풀기보다 식의 계수로 바꿔 -b/a 를 써야 함 — medium 은 대칭 쌍으로 축의 2배",
      concepts: ["이차식 세우기", "근과 계수의 관계", "이차함수의 대칭"],
      gen(rng) {
        const fn = pickFn(rng); const q = realRoots(rng, () => quadOneSided(rng, fn, rng.chance(0.3))); const ans = 2 * q.H;
        return figInst(rng, {
          stimulus: quadIntro(rng, fn), question: sumQ(fn, rng, `${fn}(x) = 0`), correct: ans,
          wrongs: [W(q.H, "step_missing", "대칭축만 답했다."), W(-ans, "sign_error", "b/a 로 부호를 놓쳤다."), W(q.C / q.A, "formula_misuse", "두 해의 곱을 답했다."), W(q.B, "formula_misuse", "a 로 나누지 않았다."), W(ans + 1, "other", "어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({}, q.fig, `${QUAD_JS}if (B*B-4*A*C<=0) throw new Error('실근 아님'); return -B / A;`),
          trace: [...quadRead(q), VIETA, [`합 = -(${fmtNum(q.B)}) ÷ ${fmtNum(q.A)} = ${fmtNum(ans)} 이다.`, "Compute -b / a."]], variant: "sum_from_fit",
        }, q.fig);
      },
    },
    {
      op: "chain2", structure: "값표에서 식을 세워 상수항 c(= f(0), 표에 없음)와 a 를 구하고 두 해의 곱 c/a 를 구함", extra: "2계 차분으로 a, 거슬러 계산으로 c, 곱 = c/a 로 이어감(표의 첫 값을 c 로 쓰는 것이 함정) — medium 은 합",
      concepts: ["이차식 세우기", "근과 계수의 관계(곱)", "상수항 = f(0)"],
      gen(rng) {
        const fn = pickFn(rng); const q = realRoots(rng, () => quadOneSided(rng, fn)); const ans = q.C / q.A; if (!Number.isInteger(ans) || q.xs.includes(0) || ans === 0) throw new GenFail("prod");
        return figInst(rng, {
          stimulus: `${quadIntro(rng, fn)} The equation $${fn}(x) = 0$ has two real solutions.`, question: `What is the product of these solutions?`, correct: ans,
          wrongs: [W(-ans, "sign_error", "-c/a 로 계산했다."), W(2 * q.H, "formula_misuse", "두 해의 합을 답했다."), W(q.C, "step_missing", "a 로 나누지 않았다."), W(q.ys[0] / q.A, "axis_misread", "표 첫 값을 상수항으로 썼다."), W(ans + 1, "other", "어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({}, q.fig, `${QUAD_JS}if (B*B-4*A*C<=0) throw new Error('실근 아님'); return C / A;`),
          trace: [...quadRead(q), ["두 해의 곱 = c ÷ a 이다.", "The product of the roots is c / a."], [`곱 = ${fmtNum(q.C)} ÷ ${fmtNum(q.A)} = ${fmtNum(ans)} 이다.`, "Compute c / a."]], variant: "product_from_fit",
        }, q.fig);
      },
    },
    {
      op: "compose_kind", structure: "값표의 대칭으로 축을 찾고, 합성식 f(x - s) = 0 의 해의 합을 구함", extra: "축으로 f 의 해의 합 2h 를 구하고, 입력 이동으로 각 해가 s 씩 옮겨 합이 2s 늘어남을 해석해야 함 — medium 은 f 의 합",
      concepts: ["이차함수의 대칭", "근과 계수의 관계", "함수의 합성(입력 이동)"],
      gen(rng) {
        const fn = pickFn(rng); const q = realRoots(rng, () => quadAround(rng, fn, rng.chance(0.5))); const s = rng.nz(-6, 6); if (Math.abs(s) < 2) throw new GenFail("s");
        const ans = 2 * q.H + 2 * s; const se = s > 0 ? `x - ${s}` : `x + ${-s}`;
        return figInst(rng, {
          stimulus: quadIntro(rng, fn), question: sumQ(fn, rng, `${fn}(${se}) = 0`), correct: ans,
          wrongs: [W(2 * q.H, "condition_ignored", "이동을 무시했다."), W(2 * q.H + s, "step_missing", "s 를 한 번만 더했다."), W(2 * q.H - 2 * s, "sign_error", "이동 방향을 반대로 했다."), W(q.H + s, "formula_misuse", "축만 옮겨 답했다."), W(-ans, "sign_error", "부호를 바꿨다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ s }, q.fig, `${QUAD_JS}if (B*B-4*A*C<=0) throw new Error('실근 아님'); return -B / A + 2 * P.s;`),
          trace: [quadRead(q)[0], quadRead(q)[1], symStep(q), [`${fn}(x) = 0 의 두 해의 합 = 2 × ${fmtNum(q.H)} = ${fmtNum(2 * q.H)} 이다.`, "Roots are symmetric about the axis."], [`${fn}(${se}) = 0 의 해는 각각 ${s} 만큼 이동하므로 합 = ${fmtNum(2 * q.H)} + 2 × (${s}) = ${fmtNum(ans)} 이다.`, "Each root shifts by s."]], variant: "sum_after_shift",
        }, q.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "값표의 이차함수 f 와 지문의 일차함수 g 에 대해 f(x) = g(x) 의 해의 합을 구함", extra: "두 함수를 같게 놓아 새 이차식 ax² + (b - m)x + (c - n) 으로 바꾼 뒤 합 -(b - m)/a 를 구해야 함 — medium 은 f(x) = 0 의 합",
      concepts: ["이차식 세우기", "두 함수의 교점 방정식", "근과 계수의 관계"],
      gen(rng) {
        const fn = pickFn(rng); const g = pickFn(rng, [fn]); const a = rng.pick(A_POOL); const n0 = rng.int(5, 6); const x0 = rng.int(-4, 2);
        const q = quadRoots(fn, a, rng.int(-6, 0), rng.int(1, 6), xsRun(x0, n0), rng.int(-10, 10)); const m = rng.nz(-8, 8), b = rng.int(-20, 20); if (Math.abs(m) < 2 || Math.abs(b) < 2) throw new GenFail("mb");
        const b2 = q.B - m, c2 = q.C - b; if (b2 * b2 - 4 * q.A * c2 <= 0) throw new GenFail("disc"); const ans = -b2 / q.A; if (!Number.isInteger(ans * 2) || ans === 2 * q.H) throw new GenFail("ans");
        return figInst(rng, {
          stimulus: `${quadIntro(rng, fn)} The function $${g}$ is defined by $${g}(x) = ${linTex(m, b)}$.`, question: sumQ(fn, rng, `${fn}(x) = ${g}(x)`), correct: ans,
          wrongs: [W(2 * q.H, "condition_ignored", "g 를 무시하고 f(x) = 0 의 합을 답했다."), W(-(q.B + m) / q.A, "sign_error", "m 을 반대 부호로 옮겼다."), W(-ans, "sign_error", "부호를 바꿨다."), W(c2 / q.A, "formula_misuse", "두 해의 곱을 답했다."), W(m - q.B, "step_missing", "a 로 나누지 않았다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ m, b }, q.fig, `${QUAD_JS}const b2 = B - P.m, c2 = C - P.b; if (b2*b2-4*A*c2<=0) throw new Error('실근 아님'); return -b2 / A;`),
          trace: [...quadRead(q), [`${fn}(x) - ${g}(x) = ${fmtNum(q.A)}x² + (${fmtNum(b2)})x + (${fmtNum(c2)}) = 0 이다.`, "Set the functions equal and collect terms."], [`해의 합 = -(${fmtNum(b2)}) ÷ ${fmtNum(q.A)} = ${fmtNum(ans)} 이다.`, "Use -b / a for the new quadratic."]], variant: "sum_of_intersections",
        }, q.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "zeros_in_table", structure: "두 영점이 표에 있는 값표에서 해의 합을 구함", extra: "easy: 0 인 칸 두 개 더하기", concepts: ["함수의 영점", "해의 합"],
      gen(rng) {
        const fn = pickFn(rng); const p = rng.int(-6, 3); const r = p + rng.int(2, 4); const x0 = rng.int(p - 2, p); const n = Math.max(5, r - x0 + 1); if (n > 7) throw new GenFail("n");
        const q = quadRoots(fn, rng.pick(A_POOL), p, r, xsRun(x0, n)); const ans = p + r;
        return figInst(rng, { stimulus: quadIntro(rng, fn), question: sumQ(fn, rng, `${fn}(x) = 0`), correct: ans, wrongs: [W(p * r, "formula_misuse", "곱했다."), W(r - p, "formula_misuse", "뺐다."), W(-ans, "sign_error", "부호를 바꿨다."), W(r, "step_missing", "하나만 답했다.")].filter((w) => w.v !== ans), verificationJs: figJs({}, q.fig, `${QUAD_JS}if (B*B-4*A*C<=0) throw new Error('실근 아님'); return -B / A;`), trace: [[`표에서 ${fn}(x) = 0 인 x 는 ${p}, ${r} 이다.`, "Find the zeros in the table."], [`합 = ${p} + (${r}) = ${ans} 이다.`, "Add them."]], variant: "sum_read",
        }, q.fig);
      },
    },
    {
      lv: "medium", name: "sum_by_symmetry", structure: "대칭 쌍이 있는 값표에서 축을 찾고 해의 합 = 축의 2배", extra: "medium: 대칭축 → 2h", concepts: ["이차함수의 대칭", "해의 합"],
      gen(rng) {
        const fn = pickFn(rng); const q = realRoots(rng, () => quadAround(rng, fn, rng.chance(0.5))); const ans = 2 * q.H;
        return figInst(rng, { stimulus: quadIntro(rng, fn), question: sumQ(fn, rng, `${fn}(x) = 0`), correct: ans, wrongs: [W(q.H, "step_missing", "축만 답했다."), W(-ans, "sign_error", "부호를 바꿨다."), W(q.K, "axis_misread", "꼭짓점 y 를 썼다."), W(ans + 2, "other", "어긋났다.")].filter((w) => w.v !== ans), verificationJs: figJs({}, q.fig, `${QUAD_JS}if (B*B-4*A*C<=0) throw new Error('실근 아님'); return -B / A;`), trace: [symStep(q), ["두 해는 축에 대해 대칭이다.", "The roots are symmetric about the axis."], [`합 = 2 × ${fmtNum(q.H)} = ${fmtNum(ans)} 이다.`, "Double the axis."]], variant: "sum_symmetry",
        }, q.fig);
      },
    },
  ],
});
