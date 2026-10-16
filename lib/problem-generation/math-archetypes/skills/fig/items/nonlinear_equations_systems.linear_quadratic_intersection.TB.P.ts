// nonlinear_equations_systems.linear_quadratic_intersection.TB.P — 값표의 이차함수와 지문의 직선(일차식)의 교점을 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { A_POOL, linTex, pickFn, QUAD_JS, quadIntro, quadRead, quadTab, ROOTS_JS, xsRun, type Quad } from "./_t5-kit";

type Sys = Quad & { m: number; n: number; p: number; q: number };
/** f(x) - (mx + n) = a(x - p)(x - q). 표에 교점 x 가 몇 개 보일지(inTab 0/1/2) 지정. */
function makeSys(rng: Rng, fn: string, inTab: 0 | 1 | 2): Sys {
  for (let t = 0; t < 100; t++) {
    const a = rng.pick(A_POOL); const p = rng.int(-6, 4); const q = p + rng.int(2, inTab === 2 ? 4 : 8); const m = rng.nz(-6, 6); const n = rng.int(-15, 15); if (Math.abs(m) < 2 || Math.abs(n) < 2) continue;
    const sz = rng.int(5, 6); const x0 = inTab === 2 ? rng.int(q - sz + 1, p) : inTab === 1 ? rng.int(p - sz + 1, p) : rng.int(p - sz - 2, q + 2); const xs = xsRun(x0, sz);
    const seen = [p, q].filter((v) => xs.includes(v)).length; if (seen !== inTab || (inTab === 1 && !xs.includes(p))) continue;
    try { const Q = quadTab(fn, a, -a * (p + q) + m, a * p * q + n, xs); return { ...Q, m, n, p, q }; } catch { continue; }
  }
  throw new GenFail("교점 장면 표집 실패");
}
const lineSent = (rng: Rng, fn: string, m: number, n: number) => rng.pick([
  `The line $y = ${linTex(m, n)}$ intersects the graph of $y = ${fn}(x)$ in the $xy$-plane at two points.`,
  `In the $xy$-plane, the graph of $y = ${fn}(x)$ and the line $y = ${linTex(m, n)}$ intersect at two points.`,
  `The system of equations $y = ${fn}(x)$ and $y = ${linTex(m, n)}$ has two solutions $(x, y)$.`,
]);
const solveStep = (s: Sys): [string, string] => [`${s.fn}(x) = ${linTex(s.m, s.n)} ⇒ ${fmtNum(s.A)}x² + (${fmtNum(s.B - s.m)})x + (${fmtNum(s.C - s.n)}) = 0 ⇒ ${fmtNum(s.A)}(x - (${s.p}))(x - (${s.q})) = 0 이다.`, "Set the expressions equal and factor."];
const SYS_JS = "const a2 = A, b2 = B - P.m, c2 = C - P.n;\n" + ROOTS_JS;

export const ITEM = defineItem({
  prefix: "nes", itemId: "nonlinear_equations_systems.linear_quadratic_intersection.TB.P",
  hard: [
    {
      op: "repr_shift", structure: "값표에서 이차식을 세우고 지문의 직선과 같게 놓아 교점의 큰 x 좌표를 구함", extra: "표 → 이차식, 직선과 연립해 하나의 이차방정식으로 바꿔 풀어야 함 — medium 은 수평선과 표의 대칭",
      concepts: ["이차식 세우기", "연립(이차 = 일차)", "이차방정식 인수분해"],
      gen(rng) {
        const fn = pickFn(rng); const s = makeSys(rng, fn, 0);
        return figInst(rng, {
          stimulus: `${quadIntro(rng, fn)} ${lineSent(rng, fn, s.m, s.n)}`, question: `What is the greater of the $x$-coordinates of the intersection points?`, correct: s.q,
          wrongs: [W(s.p, "condition_ignored", "작은 x 좌표를 답했다."), W(s.m * s.q + s.n, "axis_misread", "y 좌표를 답했다."), W(-s.p, "sign_error", "인수 부호를 반대로 읽었다."), W(s.p + s.q, "formula_misuse", "두 x 의 합을 답했다."), W(s.q + 1, "other", "어긋났다.")].filter((w) => w.v !== s.q),
          verificationJs: figJs({ m: s.m, n: s.n }, s.fig, `${QUAD_JS}${SYS_JS}return hi;`),
          trace: [...quadRead(s), solveStep(s), [`x = ${s.p}, ${s.q} 이고 큰 값은 ${s.q} 이다.`, "Take the greater x-coordinate."]], variant: "intersection_x",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "값표·직선으로 교점의 x 를 구한 뒤 직선에 대입해 그 교점의 y 좌표를 구함", extra: "x 를 풀고 그 x 로 y 를 구하는 2단 연쇄(x 를 답하는 것이 함정) — medium 은 x 좌표",
      concepts: ["이차식 세우기", "연립(이차 = 일차)", "교점의 y 좌표"],
      gen(rng) {
        const fn = pickFn(rng); const s = makeSys(rng, fn, 0); const big = rng.chance(0.5); const x = big ? s.q : s.p; const ans = s.m * x + s.n; const o = big ? s.p : s.q;
        return figInst(rng, {
          stimulus: `${quadIntro(rng, fn)} ${lineSent(rng, fn, s.m, s.n)}`, question: `What is the $y$-coordinate of the intersection point with the ${big ? "greater" : "lesser"} $x$-coordinate?`, correct: ans,
          wrongs: [W(x, "step_missing", "x 좌표를 답했다."), W(s.m * o + s.n, "condition_ignored", "다른 교점의 y 를 답했다."), W(s.m * x - s.n, "sign_error", "절편 부호를 바꿨다."), W(-ans, "sign_error", "부호를 바꿨다."), W(ans + s.m, "other", "x 를 한 칸 잘못 대입했다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ m: s.m, n: s.n, big: big ? 1 : 0 }, s.fig, `${QUAD_JS}${SYS_JS}const x = P.big ? hi : lo; return P.m * x + P.n;`),
          trace: [...quadRead(s), solveStep(s), [`${big ? "큰" : "작은"} x = ${x}, y = ${s.m}(${x}) + (${s.n}) = ${ans} 이다.`, "Substitute into the line."]], variant: "intersection_y",
        }, s.fig);
      },
    },
    {
      op: "param_condition", structure: "값표에서 이차식을 세우고, 기울기가 주어진 직선 y = mx + c 가 그래프와 한 점에서만 만나는 c 를 구함", extra: "교점 하나 ⇔ 판별식 0 으로 조건을 바꿔 c 를 구해야 함 — medium 은 교점 계산",
      concepts: ["이차식 세우기", "판별식(해의 개수)", "접선 조건"],
      gen(rng) {
        const fn = pickFn(rng); let q: Quad | null = null;
        for (let t = 0; t < 40 && !q; t++) { try { q = quadTab(fn, rng.pick(A_POOL), rng.int(-9, 9), rng.int(-20, 20), xsRun(rng.int(-4, 2), rng.int(5, 6))); } catch { /* 재표집 */ } }
        if (!q) throw new GenFail("q"); const j = rng.nz(-3, 3); const m = q.B - 2 * q.A * j; if (Math.abs(m) < 2) throw new GenFail("m"); const ans = q.C - q.A * j * j; if (ans === q.C) throw new GenFail("same");
        return figInst(rng, {
          stimulus: `${quadIntro(rng, fn)} In the $xy$-plane, the line $y = ${linTex(m, 0)} + c$, where $c$ is a constant, intersects the graph of $y = ${fn}(x)$ at exactly one point.`, question: `What is the value of $c$?`, correct: ans,
          wrongs: [W(q.C, "step_missing", "y 절편 c 를 그대로 답했다."), W(q.C + q.A * j * j, "sign_error", "판별식 부호를 반대로 했다."), W(j, "axis_misread", "접점의 x 를 답했다."), W(q.K, "formula_misuse", "꼭짓점의 y 를 답했다."), W(-ans, "sign_error", "부호를 바꿨다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ m }, q.fig, `${QUAD_JS}const b2 = B - P.m; return C - b2 * b2 / (4 * A);`),
          trace: [...quadRead(q), [`${fn}(x) = ${linTex(m, 0)} + c ⇒ ${fmtNum(q.A)}x² + (${fmtNum(q.B - m)})x + (${fmtNum(q.C)} - c) = 0 이다.`, "Set equal and collect terms."], [`판별식 (${fmtNum(q.B - m)})² - 4(${fmtNum(q.A)})(${fmtNum(q.C)} - c) = 0 ⇒ c = ${fmtNum(ans)} 이다.`, "Exactly one point means the discriminant is zero."]], variant: "tangent_line",
        }, q.fig);
      },
    },
    {
      op: "constraint_select", structure: "교점 하나가 표의 점인 상황에서, 다른 교점(표 밖)의 x 좌표를 근과 계수 관계로 구해 고름", extra: "표에서 직선 위에 있는 점을 찾고, 두 해의 합 -(b - m)/a 로 다른 해를 골라야 함(표에서 찾은 점을 답하는 것이 함정) — medium 은 두 교점이 표에 보임",
      concepts: ["연립(이차 = 일차)", "근과 계수의 관계", "해의 선택"],
      gen(rng) {
        const fn = pickFn(rng); const s = makeSys(rng, fn, 1);
        return figInst(rng, {
          stimulus: `${quadIntro(rng, fn)} ${lineSent(rng, fn, s.m, s.n)} One of the intersection points is a point $(x, ${fn}(x))$ listed in the table.`, question: `What is the $x$-coordinate of the other intersection point?`, correct: s.q,
          wrongs: [W(s.p, "condition_ignored", "표에 있는 점을 답했다."), W(-s.p, "sign_error", "부호만 바꿨다."), W(-(s.B + s.m) / s.A - s.p, "sign_error", "m 의 부호를 반대로 옮겼다."), W(s.p + s.q, "formula_misuse", "두 해의 합을 답했다."), W(s.m * s.q + s.n, "axis_misread", "y 좌표를 답했다.")].filter((w) => w.v !== s.q),
          verificationJs: figJs({ m: s.m, n: s.n }, s.fig, `${QUAD_JS}const on = FIGURE.rows.filter(r => r[1] === P.m * r[0] + P.n); if (on.length !== 1) throw new Error('표의 교점 개수'); return -(B - P.m) / A - on[0][0];`),
          trace: [quadRead(s)[0], [`표에서 ${s.fn}(${s.p}) = ${s.ys[s.xs.indexOf(s.p)]} = ${s.m}(${s.p}) + (${s.n}) 이므로 (${s.p}, ${s.ys[s.xs.indexOf(s.p)]}) 이 교점이다.`, "Find the table point on the line."], ...quadRead(s).slice(1), [`두 교점 x 의 합 = -(${fmtNum(s.B - s.m)}) ÷ ${fmtNum(s.A)} = ${s.p + s.q}, 다른 x = ${s.p + s.q} - (${s.p}) = ${s.q} 이다.`, "Use the sum of roots."]], variant: "other_intersection",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "both_in_table", structure: "두 교점의 x 가 모두 표에 있어 직선 값과 같은 칸을 찾아 큰 x 를 답함", extra: "easy: 표의 값과 직선 값 비교", concepts: ["교점", "값표 읽기"],
      gen(rng) {
        const fn = pickFn(rng); const s = makeSys(rng, fn, 2);
        return figInst(rng, { stimulus: `${quadIntro(rng, fn)} ${lineSent(rng, fn, s.m, s.n)}`, question: `What is the greater of the $x$-coordinates of the intersection points?`, correct: s.q, wrongs: [W(s.p, "condition_ignored", "작은 x 를 답했다."), W(s.m * s.q + s.n, "axis_misread", "y 를 답했다."), W(s.q + 1, "other", "옆 칸을 읽었다."), W(-s.q, "sign_error", "부호를 바꿨다.")].filter((w) => w.v !== s.q), verificationJs: figJs({ m: s.m, n: s.n }, s.fig, `${QUAD_JS}${SYS_JS}return hi;`), trace: [[`각 x 에서 직선 값 ${linTex(s.m, s.n)} 을 계산해 표의 값과 비교한다.`, "Compare table values with the line."], [`x = ${s.p}, ${s.q} 에서 같으므로 큰 값은 ${s.q} 이다.`, "The matches are the intersections."]], variant: "both_read",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "one_in_table_fit", structure: "교점 하나가 표에 있고, 다른 교점은 식을 세워 풀어 구함", extra: "medium: 표의 교점 + 인수분해", concepts: ["교점", "이차식"],
      gen(rng) {
        const fn = pickFn(rng); const s = makeSys(rng, fn, 1);
        return figInst(rng, { stimulus: `${quadIntro(rng, fn)} ${lineSent(rng, fn, s.m, s.n)}`, question: `What is the greater of the $x$-coordinates of the intersection points?`, correct: s.q, wrongs: [W(s.p, "condition_ignored", "표의 교점을 답했다."), W(s.m * s.q + s.n, "axis_misread", "y 를 답했다."), W(-s.p, "sign_error", "부호를 바꿨다."), W(s.p + s.q, "formula_misuse", "합을 답했다.")].filter((w) => w.v !== s.q), verificationJs: figJs({ m: s.m, n: s.n }, s.fig, `${QUAD_JS}${SYS_JS}return hi;`), trace: [quadRead(s)[2], solveStep(s), [`큰 x = ${s.q} 이다.`, "Take the greater one."]], variant: "one_read_fit",
        }, s.fig);
      },
    },
  ],
});
