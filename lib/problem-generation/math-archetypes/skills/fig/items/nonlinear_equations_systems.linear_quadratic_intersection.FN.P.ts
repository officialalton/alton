// nonlinear_equations_systems.linear_quadratic_intersection.FN.P — 순수 포물선 그래프와 지문의 직선(식)이 만나는 점을 구한다(표 버전 .TB.P 의 그래프판).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum, lin } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { pickFn } from "./_t5-kit";
import { crossSafe, makeQuadVertex, QX_JS, quadMarkedIntro, quadRootsIntro, quadXRead, type QuadX } from "../pure-fn-kit";

/** 포물선과 정수 x = p < q 에서 만나는 직선 y = m x + n (m, n 정수). */
function scene(rng: Rng, fn: string, o: { nPts?: number; vertex?: boolean; pair?: boolean } = {}): QuadX & { p: number; q: number; m: number; n: number } {
  for (let t = 0; t < 400; t++) {
    const q0 = makeQuadVertex(rng, fn, { disc: "any", loose: true, ...o }); for (let u = 0; u < 12; u++) { const p = rng.int(-6, 4); const q = p + rng.int(1, 8); const y = (x: number) => q0.A * x * x + q0.B * x + q0.C;
    const m = q0.A * (p + q) + q0.B; const n = y(p) - m * p; if (m === 0 || Math.abs(m) > 12 || !crossSafe(n, q0.R) || Math.abs(n) > q0.R - 1) continue;
    if (Math.abs(y(p)) <= q0.R || Math.abs(y(q)) <= q0.R) continue; // 교점은 그림 밖(읽을 수 없고 식으로 풀어야 한다)
    const fig = { ...q0.fig, objects: [...q0.fig.objects, { id: "L1", kind: "line", slope: m, intercept: n }] } as QuadX["fig"];
    return { ...q0, fig, p, q, m, n }; }
  }
  throw new GenFail("직선·포물선 장면 표집 실패");
}
const LINE_JS = "const LL=FIGURE.objects.find(o=>o.kind==='line'); if(!LL||Math.abs(LL.slope-P.m)>1e-9||Math.abs(LL.intercept-P.n)>1e-9) throw new Error('직선이 지문과 다름');\n";
const lineSent = (rng: Rng, fn: string, m: number, n: number) => rng.pick([`The line $y = ${lin(m, n)}$ intersects the graph of $y = ${fn}(x)$ at two points.`, `In the $xy$-plane, the graph of $y = ${lin(m, n)}$ and the graph of $y = ${fn}(x)$ intersect at two points.`, `A line with equation $y = ${lin(m, n)}$ is drawn in the same plane. It crosses the parabola at two points.`]);
const GREATER = (rng: Rng) => rng.pick(["What is the greater of the $x$-coordinates of the intersection points?", "What is the larger $x$-coordinate of the two intersection points?"]);
const EQ: [string, string] = ["교점에서는 포물선과 직선의 y 가 같으므로 ax² + bx + c = mx + n 으로 놓는다.", "At an intersection point the two $y$-values are equal."];

export const ITEM = defineItem({
  prefix: "nlqg", itemId: "nonlinear_equations_systems.linear_quadratic_intersection.FN.P",
  hard: [
    {
      op: "repr_shift", structure: "포물선의 표시점으로 식을 세우고 지문의 직선과 같게 놓아 교점의 큰 x 좌표를 구함", extra: "그래프 → 이차식, 직선과 연립해 하나의 이차방정식으로 바꿔 풀어야 함(작은 해·y 를 답하는 것이 함정) — medium 은 수평선과 대칭",
      concepts: ["포물선 그래프", "이차식 세우기", "직선과 포물선의 교점"],
      gen(rng) {
        const fn = pickFn(rng); const s = scene(rng, fn);
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} ${lineSent(rng, fn, s.m, s.n)}`, question: GREATER(rng), correct: s.q,
          wrongs: [W(s.p, "condition_ignored", "작은 x 를 답했다."), W(s.m * s.q + s.n, "axis_misread", "y 좌표를 답했다."), W(-s.q, "sign_error", "부호를 바꿨다."), W(s.p + s.q, "formula_misuse", "두 해의 합을 답했다."), W(s.q + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== s.q),
          verificationJs: figJs({ m: s.m, n: s.n }, s.fig, `${QX_JS}${LINE_JS}const a2=A, b2=B-P.m, c2=C-P.n; const d2=b2*b2-4*a2*c2; if (d2<=0) throw new Error('교점 2개 아님'); return Math.max((-b2+Math.sqrt(d2))/(2*a2),(-b2-Math.sqrt(d2))/(2*a2));`),
          trace: [...quadXRead(s), EQ, [`정리하면 ${fmtNum(s.A)}x² + (${fmtNum(s.B - s.m)})x + (${fmtNum(s.C - s.n)}) = 0 이다.`, "Collect the terms."], [`인수분해하면 해는 x = ${s.p}, ${s.q} 이고 큰 값은 ${s.q} 이다.`, "Solve the quadratic and take the greater root."]], variant: "intersection_from_fit",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "포물선과 직선의 교점의 x 를 구한 뒤 직선에 대입해 큰 x 를 갖는 교점의 y 좌표를 구함", extra: "x 를 풀고 그 x 로 y 를 구하는 2단 연쇄(x 를 답하는 것이 함정) — medium 은 x 좌표",
      concepts: ["포물선 그래프", "직선과 포물선의 교점", "대입"],
      gen(rng) {
        const fn = pickFn(rng); const s = scene(rng, fn); const ans = s.m * s.q + s.n;
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} ${lineSent(rng, fn, s.m, s.n)}`, question: `What is the $y$-coordinate of the intersection point with the greater $x$-coordinate?`, correct: ans,
          wrongs: [W(s.q, "axis_misread", "x 좌표를 답했다."), W(s.m * s.p + s.n, "condition_ignored", "작은 x 의 교점의 y 를 답했다."), W(s.m * s.q - s.n, "sign_error", "절편의 부호를 반대로 했다."), W(-ans, "sign_error", "부호를 바꿨다."), W(ans + 1, "other", "어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ m: s.m, n: s.n }, s.fig, `${QX_JS}${LINE_JS}const a2=A, b2=B-P.m, c2=C-P.n; const d2=b2*b2-4*a2*c2; if (d2<=0) throw new Error('교점 2개 아님'); const xq=Math.max((-b2+Math.sqrt(d2))/(2*a2),(-b2-Math.sqrt(d2))/(2*a2)); return P.m*xq+P.n;`),
          trace: [...quadXRead(s), EQ, [`해는 x = ${s.p}, ${s.q} 이다.`, "Solve the quadratic."], [`큰 x = ${s.q} 를 직선에 대입: y = ${s.m} × ${s.q} + (${s.n}) = ${ans} 이다.`, "Substitute into the line."]], variant: "intersection_y",
        }, s.fig);
      },
    },
    {
      op: "param_condition", structure: "그래프에서 식을 세우고, 기울기 m 인 직선 y = mx + c 가 포물선과 한 점에서만 만나는 c 를 구함", extra: "교점 하나 ⇔ 판별식 0 으로 조건을 바꿔 c 를 구해야 함 — medium 은 교점 계산",
      concepts: ["포물선 그래프", "이차식 세우기", "접선·판별식"],
      gen(rng) {
        const fn = pickFn(rng); const q0 = makeQuadVertex(rng, fn, { disc: "any" }); const t = rng.int(-4, 4); const m = q0.B + 2 * q0.A * t; if (m === 0 || Math.abs(m) > 14) throw new GenFail("m"); const ans = q0.C - q0.A * t * t; if (Math.abs(ans) > 40) throw new GenFail("c");
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} ${rng.pick([`In the $xy$-plane, the line $y = ${lin(m, 0)} + c$, where $c$ is a constant, intersects the graph of $y = ${fn}(x)$ at exactly one point.`, `For a constant $c$, the line $y = ${lin(m, 0)} + c$ touches the graph of $y = ${fn}(x)$ at exactly one point in the $xy$-plane.`, `The line with equation $y = ${lin(m, 0)} + c$, where $c$ is a constant, and the graph of $y = ${fn}(x)$ have exactly one point in common.`])}`, question: rng.pick([`What is the value of $c$?`, `What is $c$?`, `Find the value of the constant $c$.`]), correct: ans,
          wrongs: [W(q0.C, "condition_ignored", "포물선의 y 절편을 답했다."), W(-ans, "sign_error", "부호를 바꿨다."), W(q0.C + q0.A * t * t, "sign_error", "판별식의 부호를 놓쳤다."), W(q0.K, "axis_misread", "꼭짓점의 y 를 답했다."), W(ans + 1, "other", "어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ m }, q0.fig, `${QX_JS}const b2=B-P.m; return C - b2*b2/(4*A);`),
          trace: [...quadXRead(q0), [`${fmtNum(q0.A)}x² + (${fmtNum(q0.B - m)})x + (${fmtNum(q0.C)} - c) = 0 이 한 해만 가지려면 판별식이 0 이다.`, "Exactly one intersection means the discriminant is zero."], [`(${fmtNum(q0.B - m)})² = 4 × ${fmtNum(q0.A)} × (${fmtNum(q0.C)} - c) 에서 c = ${fmtNum(ans)} 이다.`, "Solve for c."]], variant: "tangent_line_constant",
        }, q0.fig);
      },
    },
    {
      op: "inverse", structure: "직선과 포물선의 교점 하나의 x 가 주어질 때, 근과 계수의 관계 -(b - m)/a 로 다른 교점의 x 를 구함", extra: "직선과 연립한 방정식의 두 해의 합 -(b - m)/a 에서 주어진 해를 빼야 함(주어진 해를 답하는 것이 함정) — medium 은 두 교점 계산",
      concepts: ["포물선 그래프", "직선과 포물선의 교점", "근과 계수의 관계"],
      gen(rng) {
        const fn = pickFn(rng); const s = scene(rng, fn); const first = rng.chance(0.5) ? s.p : s.q; const other = first === s.p ? s.q : s.p;
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} ${lineSent(rng, fn, s.m, s.n)} One of the intersection points has $x$-coordinate ${first}.`, question: `What is the $x$-coordinate of the other intersection point?`, correct: other,
          wrongs: [W(first, "condition_ignored", "주어진 해를 답했다."), W(-other, "sign_error", "부호를 바꿨다."), W(s.p + s.q, "formula_misuse", "두 해의 합을 답했다."), W(s.H, "step_missing", "포물선의 축을 답했다."), W(other + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== other),
          verificationJs: figJs({ m: s.m, n: s.n, first }, s.fig, `${QX_JS}${LINE_JS}return -(B-P.m)/A - P.first;`),
          trace: [...quadXRead(s), EQ, [`${fmtNum(s.A)}x² + (${fmtNum(s.B - s.m)})x + (${fmtNum(s.C - s.n)}) = 0 의 두 해의 합은 -(${fmtNum(s.B - s.m)}) ÷ ${fmtNum(s.A)} = ${s.p + s.q} 이다.`, "The sum of the two x-coordinates is -b / a."], [`다른 해 = ${s.p + s.q} - (${first}) = ${other} 이다.`, "Subtract the known root."]], variant: "other_intersection",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "horizontal_line_read", structure: "수평선 y = c 와 포물선의 교점의 큰 x 를 곡선이 지나는 격자점에서 읽음", extra: "easy: 곡선 위 격자점 읽기", concepts: ["포물선 그래프", "교점"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any", nPts: 0 }); const d = rng.int(1, 3); const t = q.H + d; const c = q.A * t * t + q.B * t + q.C; if (Math.abs(c) > q.R - 1 || c === q.K) throw new GenFail("c"); const big = t;
        return figInst(rng, { stimulus: `${quadRootsIntro(rng, fn)} The line $y = ${c}$ intersects the graph of $y = ${fn}(x)$ at two points.`, question: GREATER(rng), correct: big, wrongs: [W(q.H - d, "condition_ignored", "작은 x 를 답했다."), W(c, "axis_misread", "y 를 답했다."), W(-big, "sign_error", "부호를 바꿨다."), W(big + 1, "other", "옆 눈금을 읽었다.")].filter((w) => w.v !== big), verificationJs: figJs({ c }, q.fig, `${QX_JS}const t=(P.c-K)/A; if (t<=0) throw new Error('교점 2개 아님'); return H+Math.sqrt(t);`), trace: [[`y = ${c} 인 높이에서 곡선과 만나는 두 점을 읽는다.`, "Read the two points where the curve is at the given height."], [`큰 x 좌표는 ${big} 이다.`, "Take the greater x."]], variant: "horizontal_line_read",
        }, q.fig);
      },
    },
    {
      lv: "medium", name: "horizontal_pair_axis", structure: "같은 높이의 두 표시점으로 축을 찾아, 수평선 y = c 와의 다른 교점을 대칭으로 구함", extra: "medium: 축에 대한 반사", concepts: ["포물선의 대칭", "교점"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any", pair: true }); const t = rng.int(-6, 6); const c = q.A * t * t + q.B * t + q.C; if (t === q.H || Math.abs(c) > q.R - 1 || Math.abs(t - q.H) < 2) throw new GenFail("t"); const other = 2 * q.H - t; const big = Math.max(t, other);
        return figInst(rng, { stimulus: `${quadMarkedIntro(rng, fn)} The line $y = ${c}$ intersects the graph at two points.`, question: GREATER(rng), correct: big, wrongs: [W(Math.min(t, other), "condition_ignored", "작은 x 를 답했다."), W(q.H, "step_missing", "축을 답했다."), W(-big, "sign_error", "부호를 바꿨다."), W(big + 1, "other", "어긋났다.")].filter((w) => w.v !== big), verificationJs: figJs({ c }, q.fig, `${QX_JS}const t=(P.c-K)/A; if (t<=0) throw new Error('교점 2개 아님'); return H+Math.sqrt(t);`), trace: [...quadXRead(q).slice(0, 1), [`같은 높이의 두 표시점으로 축은 x = ${fmtNum(q.H)} 이다.`, "Find the axis from equal-height points."], [`수평선이 y = ${c} 에서 만나는 한 점이 x = ${t} 이므로 다른 점은 2 × ${fmtNum(q.H)} - ${t} = ${other} 이고 큰 값은 ${big} 이다.`, "Reflect across the axis."]], variant: "horizontal_pair_axis",
        }, q.fig);
      },
    },
  ],
});
