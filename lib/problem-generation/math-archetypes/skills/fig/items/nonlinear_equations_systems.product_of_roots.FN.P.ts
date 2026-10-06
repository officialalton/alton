// nonlinear_equations_systems.product_of_roots.FN.P — 순수 포물선 그래프에서 방정식의 해의 곱을 구한다(해가 무리수일 수 있어 근과 계수 관계 c/a 를 써야 함).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { pickFn } from "./_t5-kit";
import { makeQuadRoots, makeQuadVertex, QX_JS, quadMarkedIntro, quadRootsIntro, quadXRead, quadVertexIntro } from "../pure-fn-kit";

const prodQ = (rng: Rng, eq: string) => rng.pick([`What is the product of the solutions to the equation $${eq}$?`, `The equation $${eq}$ has two real solutions. What is the product of these solutions?`, `What is the product of all real solutions to $${eq}$?`]);
const VIETA: [string, string] = ["두 해의 곱 = c ÷ a 이다.", "The product of the roots is c / a."];
const isI = Number.isInteger;

export const ITEM = defineItem({
  prefix: "nprg", itemId: "nonlinear_equations_systems.product_of_roots.FN.P",
  hard: [
    {
      op: "repr_shift", structure: "꼭짓점·대칭 쌍이 표시되지 않은 포물선 그래프에서 식을 세워 f(x) = 0 의 두 해(무리수 가능)의 곱을 c/a 로 구함", extra: "해가 무리수라 직접 풀기보다 식의 계수로 바꿔 c/a 를 써야 함(표시점의 y 를 상수항으로 쓰는 것이 함정) — medium 은 정수근을 읽어 곱함",
      concepts: ["포물선 그래프", "이차식 세우기", "근과 계수의 관계(곱)"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "pos" }); const ans = q.C / q.A; if (!isI(ans) || ans === 0) throw new GenFail("prod");
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} The equation $${fn}(x) = 0$ has two real solutions.`, question: prodQ(rng, `${fn}(x) = 0`), correct: ans,
          wrongs: [W(-ans, "sign_error", "-c/a 로 계산했다."), W(2 * q.H, "formula_misuse", "두 해의 합을 답했다."), W(q.C, "step_missing", "a 로 나누지 않았다."), W(q.ys[0] / q.A, "axis_misread", "표시점의 y 를 상수항으로 썼다."), W(ans + 1, "other", "어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({}, q.fig, `${QX_JS}if (D<=0) throw new Error('실근 아님'); return C / A;`),
          trace: [...quadXRead(q), VIETA, [`곱 = ${fmtNum(q.C)} ÷ ${fmtNum(q.A)} = ${fmtNum(ans)} 이다.`, "Compute c / a."]], variant: "product_from_marked_points",
        }, q.fig);
      },
    },
    {
      op: "chain2", structure: "그래프에서 식을 세워 f(x) = c (c ≠ 0) 의 두 해의 곱 (C - c)/a 를 구함", extra: "상수항이 C - c 로 바뀌므로 곱도 달라짐(c 를 무시하는 것이 함정) — medium 은 f(x) = 0 의 곱",
      concepts: ["포물선 그래프", "이차식 세우기", "근과 계수의 관계(곱)"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any" }); const c = rng.nz(-8, 8); if (Math.abs(c) < 2 || (c - q.K) / q.A <= 0) throw new GenFail("c"); const ans = (q.C - c) / q.A; if (!isI(ans) || ans === q.C / q.A) throw new GenFail("prod");
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} The equation $${fn}(x) = ${c}$ has two real solutions.`, question: prodQ(rng, `${fn}(x) = ${c}`), correct: ans,
          wrongs: [W(q.C / q.A, "condition_ignored", "c 를 무시하고 f(x) = 0 의 곱을 답했다."), W((q.C + c) / q.A, "sign_error", "상수항에 c 를 더했다."), W(-ans, "sign_error", "부호를 놓쳤다."), W(2 * q.H, "formula_misuse", "두 해의 합을 답했다."), W(q.C - c, "step_missing", "a 로 나누지 않았다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ c }, q.fig, `${QX_JS}if ((P.c-K)/A<=0) throw new Error('실근 아님'); return (C - P.c) / A;`),
          trace: [...quadXRead(q), [`${fn}(x) = ${c} 는 ${fmtNum(q.A)}x² + ${fmtNum(q.B)}x + (${fmtNum(q.C - c)}) = 0 이다.`, "Move the constant to the left side."], VIETA, [`곱 = ${fmtNum(q.C - c)} ÷ ${fmtNum(q.A)} = ${fmtNum(ans)} 이다.`, "Compute c / a with the new constant."]], variant: "product_shifted_equation",
        }, q.fig);
      },
    },
    {
      op: "compose_kind", structure: "그래프에서 f 의 해의 곱을 구하고, 합성식 f(kx) = 0 의 해의 곱을 구함", extra: "각 해가 k 로 나뉘므로 곱은 k² 으로 나눠야 함(k 로만 나누는 것이 함정) — medium 은 f 의 곱",
      concepts: ["포물선 그래프", "근과 계수의 관계(곱)", "함수의 합성(입력 배율)"],
      gen(rng) {
        const fn = pickFn(rng); const k = rng.pick([2, 3]); let q = makeQuadRoots(rng, fn, { gap: [2, 3, 4, 5, 6] }); for (let t = 0; t < 200 && !(q.p % k === 0 && q.q % k === 0 && q.p * q.q !== 0); t++) q = makeQuadRoots(rng, fn, { gap: [2, 3, 4, 5, 6] }); const base = q.C / q.A; const ans = base / (k * k); if (!isI(base) || !isI(ans) || ans === 0) throw new GenFail("frac");
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} The equation $${fn}(${k}x) = 0$ has two real solutions.`, question: prodQ(rng, `${fn}(${k}x) = 0`), correct: ans,
          wrongs: [W(base, "step_missing", "kx = u 를 되돌리지 않았다."), W(base / k, "formula_misuse", "k 로만 나눴다."), W(-ans, "sign_error", "부호를 바꿨다."), W(base * k * k, "formula_misuse", "k² 을 곱했다."), W(ans + 1, "other", "어긋났다.")].filter((w) => w.v !== ans && isI(w.v)),
          verificationJs: figJs({ k }, q.fig, `${QX_JS}if (D<=0) throw new Error('실근 아님'); return C / A / (P.k * P.k);`),
          trace: [...quadXRead(q), [`${fn}(u) = 0 의 두 해의 곱은 c ÷ a = ${fmtNum(base)} 이다.`, "Product of the zeros of f."], [`${k}x = u 이므로 x 의 곱은 ${fmtNum(base)} ÷ ${k}² = ${fmtNum(ans)} 이다.`, "Each zero is divided by k, so the product is divided by k squared."]], variant: "product_scaled_input",
        }, q.fig);
      },
    },
    {
      op: "constraint_select", structure: "그래프에서 f 의 해의 합·곱을 구하고, 평행이동한 f(x - s) = 0 의 해의 곱을 구함", extra: "새 해 (r1 + s)(r2 + s) = 곱 + s·합 + s² 으로 이어야 함(곱만 쓰는 것이 함정) — medium 은 f 의 곱",
      concepts: ["포물선 그래프", "근과 계수의 관계", "함수의 평행이동"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "pos" }); const s = rng.nz(-5, 5); if (Math.abs(s) === 1) throw new GenFail("s"); const prod = q.C / q.A, sum = 2 * q.H; const ans = prod + s * sum + s * s; if (!isI(prod) || ans === prod) throw new GenFail("prod"); const se = s > 0 ? `x - ${s}` : `x + ${-s}`;
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} The equation $${fn}(${se}) = 0$ has two real solutions.`, question: prodQ(rng, `${fn}(${se}) = 0`), correct: ans,
          wrongs: [W(prod, "condition_ignored", `${fn} 의 해의 곱을 그대로 답했다.`), W(prod + s * s, "step_missing", "합 항을 빠뜨렸다."), W(prod - s * sum + s * s, "sign_error", "이동 방향을 반대로 했다."), W(prod + s, "formula_misuse", "s 만 더했다."), W(ans + 1, "other", "어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ s }, q.fig, `${QX_JS}if (D<=0) throw new Error('실근 아님'); return C / A + P.s * (-B / A) + P.s * P.s;`),
          trace: [...quadXRead(q), [`${fn}(u) = 0 의 해: 합 = ${fmtNum(sum)}, 곱 = ${fmtNum(prod)} 이다.`, "Sum and product of the zeros of f."], [`새 해는 u + (${s}) 이므로 곱 = ${fmtNum(prod)} + (${s})(${fmtNum(sum)}) + (${s})² = ${fmtNum(ans)} 이다.`, "(r1 + s)(r2 + s) = r1 r2 + s(r1 + r2) + s²."]], variant: "product_after_shift",
        }, q.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "zeros_on_axis", structure: "곡선이 x 축과 만나는 두 눈금을 읽어 곱을 구함", extra: "easy: 두 영점 읽어 곱하기", concepts: ["포물선 그래프", "함수의 영점"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadRoots(rng, fn, { nPts: 0 }); const ans = q.p * q.q; if (ans === 0) throw new GenFail("zero");
        return figInst(rng, { stimulus: `${quadRootsIntro(rng, fn)} The equation $${fn}(x) = 0$ has two real solutions.`, question: prodQ(rng, `${fn}(x) = 0`), correct: ans, wrongs: [W(q.p + q.q, "formula_misuse", "합을 답했다."), W(q.q - q.p, "formula_misuse", "차를 답했다."), W(-ans, "sign_error", "부호를 바꿨다."), W(q.q, "step_missing", "큰 해만 답했다.")].filter((w) => w.v !== ans), verificationJs: figJs({}, q.fig, `${QX_JS}if (D<0) throw new Error('해 없음'); return lo * hi;`), trace: [[`곡선이 x 축과 만나는 눈금은 x = ${q.p}, ${q.q} 이다.`, "Read where the curve crosses the x-axis."], [`곱 = (${q.p})(${q.q}) = ${ans} 이다.`, "Multiply the two zeros."]], variant: "product_read_zeros",
        }, q.fig);
      },
    },
    {
      lv: "medium", name: "from_vertex_form", structure: "꼭짓점과 두 점이 표시된 포물선에서 꼭짓점형으로 식을 세워 두 해의 곱 c/a 를 구함", extra: "medium: 꼭짓점형 전개", concepts: ["포물선 그래프", "꼭짓점형", "근과 계수의 관계(곱)"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "pos", vertex: true }); const ans = q.C / q.A; if (!isI(ans) || ans === 0) throw new GenFail("prod");
        return figInst(rng, { stimulus: `${quadVertexIntro(rng, fn)} The equation $${fn}(x) = 0$ has two real solutions.`, question: prodQ(rng, `${fn}(x) = 0`), correct: ans, wrongs: [W(-ans, "sign_error", "부호를 놓쳤다."), W(2 * q.H, "formula_misuse", "합을 답했다."), W(q.C, "step_missing", "a 로 나누지 않았다."), W(q.H * q.H, "formula_misuse", "h² 만 답했다."), W(q.K, "axis_misread", "꼭짓점 y 를 답했다."), W(ans + 1, "other", "어긋났다."), W(ans - 1, "other", "어긋났다.")].filter((w) => w.v !== ans), verificationJs: figJs({}, q.fig, `${QX_JS}if (D<=0) throw new Error('실근 아님'); return C / A;`), trace: [[`꼭짓점 (${q.H}, ${q.K}) 을 읽는다.`, "Read the vertex."], [`y = ${fmtNum(q.A)}(x - (${q.H}))² + (${q.K}) 를 전개하면 상수항 c = ${fmtNum(q.C)} 이다.`, "Expand the vertex form."], [`곱 = c ÷ a = ${fmtNum(q.C)} ÷ ${fmtNum(q.A)} = ${fmtNum(ans)} 이다.`, "Compute c / a."]], variant: "product_from_vertex_form",
        }, q.fig);
      },
    },
  ],
});
