// nonlinear_equations_systems.sum_of_roots.FN.P — 순수 포물선 그래프에서 방정식의 해의 합을 구한다(해가 무리수일 수 있어 대칭축·근과 계수 관계를 써야 함).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { pickFn } from "./_t5-kit";
import { makeQuadRoots, makeQuadVertex, QX_JS, quadMarkedIntro, quadRootsIntro, quadXRead } from "../pure-fn-kit";

const sumQ = (rng: Rng, eq: string) => rng.pick([`What is the sum of the solutions to the equation $${eq}$?`, `The equation $${eq}$ has two real solutions. What is the sum of these solutions?`, `What is the sum of all real solutions to $${eq}$?`]);
const VIETA: [string, string] = ["두 해의 합 = -b ÷ a (= 대칭축의 2배) 이다.", "The sum of the roots is -b / a, twice the axis of symmetry."];

export const ITEM = defineItem({
  prefix: "nsrg", itemId: "nonlinear_equations_systems.sum_of_roots.FN.P",
  hard: [
    {
      op: "repr_shift", structure: "대칭 쌍·꼭짓점이 표시되지 않은 포물선 그래프에서 식을 세워 f(x) = 0 의 두 해(무리수 가능)의 합을 -b/a 로 구함", extra: "해가 무리수라 직접 풀기보다 식의 계수로 바꿔 -b/a 를 써야 함 — medium 은 대칭 쌍으로 축의 2배",
      concepts: ["포물선 그래프", "이차식 세우기", "근과 계수의 관계"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "pos" }); const ans = 2 * q.H;
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} The equation $${fn}(x) = 0$ has two real solutions.`, question: sumQ(rng, `${fn}(x) = 0`), correct: ans,
          wrongs: [W(q.H, "step_missing", "대칭축만 답했다."), W(-ans, "sign_error", "b/a 로 부호를 놓쳤다."), W(q.C / q.A, "formula_misuse", "두 해의 곱을 답했다."), W(q.B, "formula_misuse", "a 로 나누지 않았다."), W(ans + 1, "other", "어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({}, q.fig, `${QX_JS}if (D<=0) throw new Error('실근 아님'); return -B / A;`),
          trace: [...quadXRead(q), VIETA, [`합 = -(${fmtNum(q.B)}) ÷ ${fmtNum(q.A)} = ${fmtNum(ans)} 이다.`, "Compute -b / a."]], variant: "sum_from_marked_points",
        }, q.fig);
      },
    },
    {
      op: "chain2", structure: "그래프에서 식을 세워 f(x) = c (c ≠ 0) 의 두 해의 합을 구함 — c 와 무관하게 대칭축의 2배", extra: "상수 c 를 옮겨도 -b/a 는 그대로임을 알아야 함(c 를 섞어 계산하는 것이 함정) — medium 은 f(x) = 0 의 합",
      concepts: ["포물선 그래프", "이차식 세우기", "근과 계수의 관계"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any" }); const c = rng.nz(-8, 8); const t = (c - q.K) / q.A; if (t <= 0 || Math.abs(c) < 2) throw new GenFail("c"); const ans = 2 * q.H;
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} The equation $${fn}(x) = ${c}$ has two real solutions.`, question: sumQ(rng, `${fn}(x) = ${c}`), correct: ans,
          wrongs: [W(q.H, "step_missing", "대칭축만 답했다."), W(-ans, "sign_error", "부호를 놓쳤다."), W(ans + c, "formula_misuse", "상수 c 를 더했다."), W(ans - c, "formula_misuse", "상수 c 를 뺐다."), W(q.B, "formula_misuse", "a 로 나누지 않았다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ c }, q.fig, `${QX_JS}if ((P.c-K)/A<=0) throw new Error('실근 아님'); return -B / A;`),
          trace: [...quadXRead(q), [`${fn}(x) = ${c} 는 ${fmtNum(q.A)}x² + ${fmtNum(q.B)}x + (${fmtNum(q.C - c)}) = 0 이다.`, "Move the constant to the left side."], [`x 의 계수는 그대로이므로 합 = -(${fmtNum(q.B)}) ÷ ${fmtNum(q.A)} = ${fmtNum(ans)} 이다.`, "The sum -b / a does not depend on the constant term."]], variant: "sum_shifted_equation",
        }, q.fig);
      },
    },
    {
      op: "compose_kind", structure: "그래프에서 f 의 해의 합을 구하고, 합성식 f(kx) = 0 의 해의 합을 구함", extra: "f 의 해의 합을 구한 뒤 kx = u 로 되돌려 k 로 나눠야 함 — medium 은 f 의 합",
      concepts: ["포물선 그래프", "근과 계수의 관계", "함수의 합성(입력 배율)"],
      gen(rng) {
        const fn = pickFn(rng); const k = rng.pick([2, 3, 4]); let q = makeQuadVertex(rng, fn, { disc: "pos" }); for (let u = 0; u < 60 && !(Number.isInteger((2 * q.H) / k) && q.H !== 0); u++) q = makeQuadVertex(rng, fn, { disc: "pos" }); const ans = (2 * q.H) / k; if (!Number.isInteger(ans) || ans === 0) throw new GenFail("frac");
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} The equation $${fn}(${k}x) = 0$ has two real solutions.`, question: sumQ(rng, `${fn}(${k}x) = 0`), correct: ans,
          wrongs: [W(2 * q.H, "step_missing", "kx = u 를 되돌리지 않았다."), W(2 * q.H * k, "formula_misuse", "k 를 곱했다."), W(-ans, "sign_error", "부호를 바꿨다."), W(q.H, "step_missing", "대칭축만 답했다."), W(ans + 1, "other", "어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ k }, q.fig, `${QX_JS}if (D<=0) throw new Error('실근 아님'); return -B / A / P.k;`),
          trace: [...quadXRead(q), [`${fn}(u) = 0 의 두 해의 합은 -b ÷ a = ${fmtNum(2 * q.H)} 이다.`, "Sum of the zeros of f."], [`${k}x = u 이므로 x 의 합은 ${fmtNum(2 * q.H)} ÷ ${k} = ${fmtNum(ans)} 이다.`, "Divide by k."]], variant: "sum_scaled_input",
        }, q.fig);
      },
    },
    {
      op: "constraint_select", structure: "그래프에서 f 의 해의 합을 구하고, 평행이동한 f(x - s) = 0 의 해의 합을 구함", extra: "해마다 s 만큼 이동하므로 합은 2s 만큼 달라져야 함(s 만 더하는 것이 함정) — medium 은 f 의 합",
      concepts: ["포물선 그래프", "근과 계수의 관계", "함수의 평행이동"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "pos" }); const s = rng.nz(-6, 6); if (Math.abs(s) === 1) throw new GenFail("s"); const ans = 2 * q.H + 2 * s; const se = s > 0 ? `x - ${s}` : `x + ${-s}`;
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} The equation $${fn}(${se}) = 0$ has two real solutions.`, question: sumQ(rng, `${fn}(${se}) = 0`), correct: ans,
          wrongs: [W(2 * q.H, "condition_ignored", `${fn} 의 해의 합을 그대로 답했다.`), W(2 * q.H + s, "step_missing", "해 하나분만 이동했다."), W(2 * q.H - 2 * s, "sign_error", "이동 방향을 반대로 했다."), W(q.H + s, "step_missing", "축만 이동했다."), W(ans + 1, "other", "어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ s }, q.fig, `${QX_JS}if (D<=0) throw new Error('실근 아님'); return -B / A + 2 * P.s;`),
          trace: [...quadXRead(q), [`${fn}(u) = 0 의 해의 합은 -b ÷ a = ${fmtNum(2 * q.H)} 이다.`, "Sum of the zeros of f."], [`${fn}(${se}) = 0 의 해는 각각 u + (${s}) 이므로 합은 ${fmtNum(2 * q.H)} + 2(${s}) = ${fmtNum(ans)} 이다.`, "Each of the two zeros shifts by s."]], variant: "sum_after_shift",
        }, q.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "zeros_on_axis", structure: "곡선이 x 축과 만나는 두 눈금을 읽어 합을 구함", extra: "easy: 두 영점 읽어 더하기", concepts: ["포물선 그래프", "함수의 영점"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadRoots(rng, fn, { nPts: 0 }); const ans = q.p + q.q;
        return figInst(rng, { stimulus: `${quadRootsIntro(rng, fn)} The equation $${fn}(x) = 0$ has two real solutions.`, question: sumQ(rng, `${fn}(x) = 0`), correct: ans, wrongs: [W(q.p * q.q, "formula_misuse", "곱을 답했다."), W(q.q - q.p, "formula_misuse", "차를 답했다."), W(-ans, "sign_error", "부호를 바꿨다."), W(q.q, "step_missing", "큰 해만 답했다.")].filter((w) => w.v !== ans), verificationJs: figJs({}, q.fig, `${QX_JS}if (D<0) throw new Error('해 없음'); return lo + hi;`), trace: [[`곡선이 x 축과 만나는 눈금은 x = ${q.p}, ${q.q} 이다.`, "Read where the curve crosses the x-axis."], [`합 = ${q.p} + (${q.q}) = ${ans} 이다.`, "Add the two zeros."]], variant: "sum_read_zeros",
        }, q.fig);
      },
    },
    {
      lv: "medium", name: "axis_from_pair", structure: "같은 높이의 두 표시점으로 축을 찾아 두 해의 합(축의 2배)을 구함", extra: "medium: 쌍의 가운데 × 2", concepts: ["포물선의 대칭", "근과 계수의 관계"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "pos", pair: true }); const ans = 2 * q.H;
        return figInst(rng, { stimulus: `${quadMarkedIntro(rng, fn)} The equation $${fn}(x) = 0$ has two real solutions.`, question: sumQ(rng, `${fn}(x) = 0`), correct: ans, wrongs: [W(q.H, "step_missing", "대칭축만 답했다."), W(-ans, "sign_error", "부호를 바꿨다."), W(q.xs[0] + q.xs[1] === ans ? ans + 2 : q.xs[0] + q.xs[1], "formula_misuse", "표시점 x 의 합을 답했다."), W(ans + 1, "other", "어긋났다.")].filter((w) => w.v !== ans), verificationJs: figJs({}, q.fig, `${QX_JS}if (D<=0) throw new Error('실근 아님'); return -B / A;`), trace: [...quadXRead(q).slice(0, 1), [`같은 높이의 두 표시점 x 의 가운데로 축은 x = ${fmtNum(q.H)} 이다.`, "The axis lies midway between equal-height points."], VIETA, [`합 = 2 × ${fmtNum(q.H)} = ${fmtNum(ans)} 이다.`, "Double the axis."]], variant: "sum_from_axis",
        }, q.fig);
      },
    },
  ],
});
