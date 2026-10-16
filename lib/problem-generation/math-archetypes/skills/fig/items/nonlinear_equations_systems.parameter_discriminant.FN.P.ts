// nonlinear_equations_systems.parameter_discriminant.FN.P — 순수 포물선 그래프에서 방정식이 실근을 한 개만 갖게 하는 매개변수(판별식 = 0)를 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { pickFn } from "./_t5-kit";
import { makeQuadVertex, QX_JS, quadFig, quadMarkedIntro, quadXRead, type QuadX, quadVertexIntro } from "../pure-fn-kit";

const KQ = (rng: Rng) => rng.pick(["What is the value of $k$?", "What is $k$?", "What is the value of the constant $k$?"]);
const ONE = (rng: Rng, eq: string) => rng.pick([`The equation $${eq}$, where $k$ is a constant, has exactly one real solution.`, `For a constant $k$, the equation $${eq}$ has exactly one real solution.`, `The equation $${eq}$ has exactly one real solution, where $k$ is a constant.`]);
const vertexIntro = (rng: Rng, fn: string) => quadVertexIntro(rng, fn);
const DISC: [string, string] = ["이차방정식이 실근을 하나만 가지려면 판별식 b² - 4ac 가 0 이다.", "Exactly one real solution means the discriminant is zero."];

export const ITEM = defineItem({
  prefix: "pdsg", itemId: "nonlinear_equations_systems.parameter_discriminant.FN.P",
  hard: [
    {
      op: "param_condition", structure: "꼭짓점이 표시되지 않은 포물선 그래프에서 식을 세우고, f(x) = k 가 실근을 하나만 갖게 하는 k 를 판별식 0 으로 구함", extra: "표시점으로 식을 세운 뒤 f(x) - k = 0 의 판별식 조건으로 바꿔야 함(표시점 중 가장 낮은 값을 k 로 읽는 것이 함정) — medium 은 꼭짓점이 표시됨",
      concepts: ["포물선 그래프", "이차식 세우기", "판별식과 실근의 개수"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any" }); const near = q.A > 0 ? Math.min(...q.ys) : Math.max(...q.ys);
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} ${ONE(rng, `${fn}(x) = k`)}`, question: KQ(rng), correct: q.K,
          wrongs: [W(near, "axis_misread", "표시점 중 가장 낮은(높은) 값을 k 로 읽었다."), W(-q.K, "sign_error", "부호를 바꿨다."), W(q.H, "axis_misread", "꼭짓점의 x 를 답했다."), W(q.C, "axis_misread", "y 절편을 답했다."), W(q.K + 1, "other", "어긋났다.")].filter((w) => w.v !== q.K),
          verificationJs: figJs({}, q.fig, `${QX_JS}return C - B*B/(4*A);`),
          trace: [...quadXRead(q), [`${fmtNum(q.A)}x² + ${fmtNum(q.B)}x + (${fmtNum(q.C)} - k) = 0 이다.`, "Move k to the left side."], DISC, [`${fmtNum(q.B)}² - 4(${fmtNum(q.A)})(${fmtNum(q.C)} - k) = 0 에서 k = ${fmtNum(q.K)} 이다.`, "Solve for k."]], variant: "k_one_solution",
        }, q.fig);
      },
    },
    {
      op: "inverse", structure: "그래프에서 식을 세우고, f(x) = k 가 실근을 하나만 갖게 하는 k 를 구한 뒤 그 유일한 해 x 를 구함", extra: "k 의 판별식 조건과 중근 x = -b/(2a) 를 이어야 함(k 를 답하는 것이 함정) — medium 은 k",
      concepts: ["포물선 그래프", "판별식과 실근의 개수", "중근"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any" }); if (q.H === 0) throw new GenFail("h0");
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} ${ONE(rng, `${fn}(x) = k`)}`, question: rng.pick([`What is that solution?`, `What is the value of $x$ that satisfies the equation?`]), correct: q.H,
          wrongs: [W(q.K, "step_missing", "k 를 답했다."), W(-q.H, "sign_error", "부호를 바꿨다."), W(2 * q.H, "formula_misuse", "-b/a 로 계산했다."), W(q.C, "axis_misread", "y 절편을 답했다."), W(q.H + 1, "other", "어긋났다.")].filter((w) => w.v !== q.H),
          verificationJs: figJs({}, q.fig, `${QX_JS}return -B/(2*A);`),
          trace: [...quadXRead(q), DISC, [`k = ${fmtNum(q.K)} 일 때 중근은 x = -b ÷ (2a) = ${fmtNum(q.H)} 이다.`, "The double root is x = -b / (2a)."]], variant: "double_root_x",
        }, q.fig);
      },
    },
    {
      op: "compose_kind", structure: "그래프에서 식을 세우고, 평행이동한 f(x - s) = k 가 실근을 하나만 가질 때의 k 를 구함(수평 이동은 k 를 바꾸지 않음)", extra: "수평 이동이 꼭짓점의 높이를 바꾸지 않음을 알아야 함(이동량을 k 에 더하는 것이 함정) — medium 은 f(x) = k",
      concepts: ["포물선 그래프", "함수의 평행이동", "판별식과 실근의 개수"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any" }); const s = rng.nz(-5, 5); if (Math.abs(s) === 1) throw new GenFail("s"); const se = s > 0 ? `x - ${s}` : `x + ${-s}`;
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} ${ONE(rng, `${fn}(${se}) = k`)}`, question: KQ(rng), correct: q.K,
          wrongs: [W(q.K + s, "formula_misuse", "수평 이동량을 더했다."), W(q.K - s, "formula_misuse", "수평 이동량을 뺐다."), W(-q.K, "sign_error", "부호를 바꿨다."), W(q.H + s, "axis_misread", "이동한 축을 답했다."), W(q.K + 1, "other", "어긋났다.")].filter((w) => w.v !== q.K),
          verificationJs: figJs({ s }, q.fig, `${QX_JS}return C - B*B/(4*A);`),
          trace: [...quadXRead(q), [`꼭짓점 (${fmtNum(q.H)}, ${fmtNum(q.K)}) 이고, f(x - s) 는 옆으로만 이동해 꼭짓점의 높이는 ${fmtNum(q.K)} 로 그대로이다.`, "A horizontal shift keeps the vertex height."], DISC, [`k = ${fmtNum(q.K)} 이다.`, "k equals the vertex height."]], variant: "k_after_shift",
        }, q.fig);
      },
    },
    {
      op: "chain2", structure: "그래프에서 식을 세우고, f(x) = mx (원점을 지나는 직선)가 포물선과 한 점에서만 만나는 m 을 판별식 0 으로 구함", extra: "연립한 식의 판별식 (b - m)² - 4ac = 0 에서 두 값의 m 중 조건에 맞는 것을 골라야 함(한 값만 답하는 것이 함정) — medium 은 k",
      concepts: ["포물선 그래프", "이차식 세우기", "접선·판별식"],
      gen(rng) {
        const fn = pickFn(rng); let q: QuadX | null = null; let t = 0;
        for (let u = 0; u < 800 && !q; u++) { const R = rng.pick([6, 8, 10]); const A = rng.pick([-2, -1, 1, 2]); const tt = rng.pick([1, 2, 3]); const B = rng.int(-6, 6); const c = quadFig(rng, fn, A, B, A * tt * tt, R); if (c && Math.abs(c.C) >= 2) { q = c; t = Math.abs(A) * tt; } }
        if (!q) throw new GenFail("ac"); const hi = q.B + 2 * t, lo = q.B - 2 * t; const gr = rng.chance(0.5); const ans = gr ? hi : lo;
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} ${rng.pick([`The line $y = mx$, where $m$ is a constant, intersects the graph of $y = ${fn}(x)$ at exactly one point.`, `For a constant $m$, the line $y = mx$ touches the graph of $y = ${fn}(x)$ at exactly one point in the $xy$-plane.`, `The line with equation $y = mx$, where $m$ is a constant, and the graph of $y = ${fn}(x)$ share exactly one point.`])}`, question: rng.pick([gr ? `What is the greater possible value of $m$?` : `What is the lesser possible value of $m$?`, gr ? `What is the largest value of $m$ that satisfies this condition?` : `What is the smallest value of $m$ that satisfies this condition?`]), correct: ans,
          wrongs: [W(gr ? lo : hi, "condition_ignored", "다른 값을 답했다."), W(q.B, "step_missing", "b 만 답했다."), W(-ans, "sign_error", "부호를 바꿨다."), W(2 * t, "formula_misuse", "2√(ac) 만 답했다."), W(ans + 1, "other", "어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ gr: gr ? 1 : 0 }, q.fig, `${QX_JS}const r=Math.sqrt(A*C); if (!(r>0)||Math.abs(r*r-A*C)>1e-9||Math.abs(2*r-Math.round(2*r))>1e-9) throw new Error('판별식 조건 아님'); return B + 2*r*(P.gr?1:-1);`),
          trace: [...quadXRead(q), [`${fmtNum(q.A)}x² + (${fmtNum(q.B)} - m)x + ${fmtNum(q.C)} = 0 이 한 해만 가지려면 판별식이 0 이다.`, "Set the discriminant to zero."], [`(${fmtNum(q.B)} - m)² = 4 × ${fmtNum(q.A)} × ${fmtNum(q.C)} = ${4 * q.A * q.C} 이므로 ${fmtNum(q.B)} - m = ±${2 * t} 이다.`, "Take both square roots."], [`m = ${lo} 또는 ${hi} 이고 ${gr ? "큰" : "작은"} 값은 ${ans} 이다.`, "Choose the greater value."]], variant: "m_tangent_through_origin",
        }, q.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "vertex_marked_k", structure: "꼭짓점이 표시된 포물선에서 f(x) = k 가 실근을 하나만 갖게 하는 k(꼭짓점의 높이)를 읽음", extra: "easy: 꼭짓점의 y", concepts: ["포물선 그래프", "꼭짓점", "실근의 개수"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any", vertex: true });
        return figInst(rng, { stimulus: `${vertexIntro(rng, fn)} ${ONE(rng, `${fn}(x) = k`)}`, question: KQ(rng), correct: q.K, wrongs: [W(q.H, "axis_misread", "꼭짓점의 x 를 답했다."), W(-q.K, "sign_error", "부호를 바꿨다."), W(q.K + 1, "other", "어긋났다."), W(q.K - 1, "other", "어긋났다.")].filter((w) => w.v !== q.K), verificationJs: figJs({}, q.fig, `${QX_JS}return K;`), trace: [[`표시된 꼭짓점은 (${q.H}, ${q.K}) 이다.`, "Read the vertex."], [`수평선 y = k 가 꼭짓점에서만 만나려면 k = ${q.K} 이다.`, "The horizontal line touches the parabola at the vertex."]], variant: "k_vertex_height",
        }, q.fig);
      },
    },
    {
      lv: "medium", name: "pair_k", structure: "같은 높이의 두 표시점과 한 점으로 식을 세워 f(x) = k 가 중근을 갖는 k 를 구함", extra: "medium: 쌍으로 축을 찾아 꼭짓점 높이 계산", concepts: ["포물선의 대칭", "판별식과 실근의 개수"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any", pair: true });
        return figInst(rng, { stimulus: `${quadMarkedIntro(rng, fn)} ${ONE(rng, `${fn}(x) = k`)}`, question: KQ(rng), correct: q.K, wrongs: [W(q.H, "axis_misread", "대칭축을 답했다."), W(-q.K, "sign_error", "부호를 바꿨다."), W(q.C, "axis_misread", "y 절편을 답했다."), W(q.K + 1, "other", "어긋났다.")].filter((w) => w.v !== q.K), verificationJs: figJs({}, q.fig, `${QX_JS}return K;`), trace: [...quadXRead(q).slice(0, 1), [`같은 높이의 두 표시점으로 축은 x = ${fmtNum(q.H)} 이다.`, "Find the axis from equal-height points."], [`축에서의 높이가 꼭짓점이므로 k = ${fmtNum(q.K)} 이다.`, "k is the vertex height."]], variant: "k_from_pair",
        }, q.fig);
      },
    },
  ],
});
