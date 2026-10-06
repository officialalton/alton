// nonlinear_equations_systems.num_real_solutions.FN.P — 순수 포물선 그래프에서 방정식 f(x) = c 의 실근 개수를 구한다(꼭짓점 높이와 c 비교).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { pickFn } from "./_t5-kit";
import { makeQuadVertex, QX_JS, quadMarkedIntro, quadRootsIntro, quadXRead, quadVertexIntro } from "../pure-fn-kit";

const count = (A: number, K: number, c: number) => { const t = (c - K) / A; return t > 0 ? 2 : t === 0 ? 1 : 0; };
const HOW = (rng: Rng, eq: string) => rng.pick([`How many real solutions does the equation $${eq}$ have?`, `How many distinct real values of $x$ satisfy the equation $${eq}$?`, `The equation $${eq}$ is solved over the real numbers. How many solutions does it have?`]);
const CNT: [string, string] = ["f(x) = c 의 실근 개수는 c 와 꼭짓점 y 좌표를 비교해 정한다(열린 방향 쪽이면 2개, 같으면 1개, 반대쪽이면 0개).", "Compare c with the vertex height and the direction of opening."];

export const ITEM = defineItem({
  prefix: "nrsg", itemId: "nonlinear_equations_systems.num_real_solutions.FN.P",
  hard: [
    {
      op: "repr_shift", structure: "꼭짓점이 표시되지 않은 포물선 그래프에서 식을 세워 꼭짓점 높이 K 를 구하고, f(x) = c 의 실근 개수를 판정", extra: "표시점만으로는 꼭짓점이 보이지 않아 식을 세운 뒤 판별식·꼭짓점으로 c 와 비교해야 함(표시점 중 가장 낮은 값을 꼭짓점으로 보는 것이 함정) — medium 은 꼭짓점이 표시됨",
      concepts: ["포물선 그래프", "이차식 세우기", "판별식·실근의 개수"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any" }); const sg = Math.sign(q.A); const c = q.K + rng.pick([-2, -1, 0, 1, 2, 3]) * sg * rng.pick([1, 1, 2]); const ans = count(q.A, q.K, c); if (Math.abs(c) >= q.R - 1) throw new GenFail("c");
        const lowest = q.A > 0 ? Math.min(...q.ys) : Math.max(...q.ys);
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)}`, question: HOW(rng, `${fn}(x) = ${c}`), correct: ans,
          wrongs: [W(count(q.A, lowest, c) === ans ? (ans + 1) % 3 : count(q.A, lowest, c), "axis_misread", "표시점 중 가장 낮은(높은) 값을 꼭짓점으로 보았다."), W(1, "formula_misuse", "항상 한 개라고 보았다."), W(2, "formula_misuse", "항상 두 개라고 보았다."), W(0, "formula_misuse", "해가 없다고 보았다."), W(3, "other", "어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ c }, q.fig, `${QX_JS}const t=(P.c-K)/A; return t>1e-9?2:Math.abs(t)<=1e-9?1:0;`),
          trace: [...quadXRead(q), [`꼭짓점 (${fmtNum(q.H)}, ${fmtNum(q.K)}) 이고 포물선은 ${q.A > 0 ? "위" : "아래"}로 열린다.`, "Find the vertex and the direction of opening."], CNT, [`c = ${c} 이므로 실근은 ${ans}개이다.`, "Count the solutions."]], variant: "count_from_fit",
        }, q.fig);
      },
    },
    {
      op: "param_condition", structure: "그래프에서 꼭짓점 높이를 구하고, f(x) = c 가 실근을 갖지 않는 가장 큰(작은) 정수 c 를 구함", extra: "꼭짓점 높이 K 를 구한 뒤 부등식으로 바꿔 경계 정수를 골라야 함(K 자체를 답하는 것이 함정) — medium 은 개수 판정",
      concepts: ["포물선 그래프", "이차식 세우기", "실근이 없을 조건"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any" }); const up = q.A > 0; const ans = up ? q.K - 1 : q.K + 1;
        return figInst(rng, {
          stimulus: quadMarkedIntro(rng, fn), question: up ? `What is the greatest integer value of $c$ for which the equation $${fn}(x) = c$ has no real solutions?` : `What is the least integer value of $c$ for which the equation $${fn}(x) = c$ has no real solutions?`, correct: ans,
          wrongs: [W(q.K, "condition_ignored", "꼭짓점 높이를 그대로 답했다(c = K 일 때는 실근이 하나 있다)."), W(up ? q.K + 1 : q.K - 1, "sign_error", "부등식 방향을 반대로 했다."), W(-ans, "sign_error", "부호를 바꿨다."), W(q.C, "axis_misread", "y 절편을 답했다."), W(ans + (up ? -1 : 1), "other", "한 칸 어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ up: up ? 1 : 0 }, q.fig, `${QX_JS}return A>0?Math.ceil(K)-1:Math.floor(K)+1;`),
          trace: [...quadXRead(q), [`꼭짓점 (${fmtNum(q.H)}, ${fmtNum(q.K)}) 이고 포물선은 ${up ? "위" : "아래"}로 열린다.`, "Find the vertex and the direction of opening."], [`f(x) = c 가 실근을 갖지 않으려면 c ${up ? "<" : ">"} ${fmtNum(q.K)} 이어야 한다.`, "The horizontal line must miss the parabola."], [`${up ? "가장 큰" : "가장 작은"} 정수는 ${ans} 이다.`, "Take the boundary integer."]], variant: up ? "greatest_c_no_solution" : "least_c_no_solution",
        }, q.fig);
      },
    },
    {
      op: "chain2", structure: "그래프에서 f(x) = c 가 서로 다른 두 실근을 갖는 정수 c 가 주어진 범위 [lo, hi] 에 몇 개인지 셈", extra: "꼭짓점 높이 K 를 구한 뒤 부등식 해의 정수를 세는 2단 연쇄(경계 포함 여부가 함정) — medium 은 개수 판정",
      concepts: ["포물선 그래프", "실근의 개수", "경계값 포함 여부"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any" }); const lo = q.K - rng.int(2, 6), hi = q.K + rng.int(2, 6); let n = 0; for (let c = lo; c <= hi; c++) if (count(q.A, q.K, c) === 2) n++; if (n === 0) throw new GenFail("n");
        return figInst(rng, {
          stimulus: quadMarkedIntro(rng, fn), question: rng.pick([`For how many integer values of $c$ with $${lo} \\le c \\le ${hi}$ does the equation $${fn}(x) = c$ have two distinct real solutions?`, `How many integers $c$ with $${lo} \\le c \\le ${hi}$ make $${fn}(x) = c$ have exactly two real solutions?`, `The equation $${fn}(x) = c$ has two different real solutions for certain integer values of $c$ from ${lo} to ${hi}, inclusive. How many such values of $c$ are there?`]), correct: n,
          wrongs: [W(n + 1, "boundary_error", "c = K 를 포함했다."), W(n - 1, "boundary_error", "끝 값을 하나 빠뜨렸다."), W(hi - lo + 1, "condition_ignored", "범위의 모든 정수를 셌다."), W(q.A > 0 ? hi - lo + 1 - n : n, "sign_error", "반대쪽 범위를 셌다."), W(n + 2, "other", "어긋났다.")].filter((w) => w.v !== n && w.v >= 0),
          verificationJs: figJs({ lo, hi }, q.fig, `${QX_JS}let n=0; for (let c=P.lo;c<=P.hi;c++) if ((c-K)/A>1e-9) n++; return n;`),
          trace: [...quadXRead(q), [`꼭짓점 (${fmtNum(q.H)}, ${fmtNum(q.K)}) 이고 포물선은 ${q.A > 0 ? "위" : "아래"}로 열린다.`, "Find the vertex and the direction of opening."], [`서로 다른 두 실근은 c ${q.A > 0 ? ">" : "<"} ${fmtNum(q.K)} 일 때이다.`, "Two solutions exactly when c is past the vertex height."], [`${lo} ≤ c ≤ ${hi} 중 조건을 만족하는 정수는 ${n}개이다.`, "Count the integers."]], variant: "count_c_values",
        }, q.fig);
      },
    },
    {
      op: "compose_kind", structure: "그래프에서 꼭짓점을 구하고, 평행이동한 f(x - s) = c 의 실근 개수를 판정(개수는 수평 이동과 무관)", extra: "수평 이동은 꼭짓점의 높이를 바꾸지 않아 개수가 f(x) = c 와 같음을 알아야 함(이동량을 c 에 섞는 것이 함정) — medium 은 f(x) = c",
      concepts: ["포물선 그래프", "함수의 평행이동", "실근의 개수"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any" }); const s = rng.nz(-6, 6); if (Math.abs(s) === 1) throw new GenFail("s"); const sg = Math.sign(q.A); const c = q.K + rng.pick([-2, -1, 0, 1, 2, 3]) * sg; const ans = count(q.A, q.K, c); const se = s > 0 ? `x - ${s}` : `x + ${-s}`;
        const alt = count(q.A, q.K, c + s); if (alt === ans) throw new GenFail("alt");
        return figInst(rng, {
          stimulus: quadMarkedIntro(rng, fn), question: HOW(rng, `${fn}(${se}) = ${c}`), correct: ans,
          wrongs: [W(alt, "condition_ignored", "이동량을 c 에 섞었다."), W(1, "formula_misuse", "항상 한 개라고 보았다."), W(2, "formula_misuse", "항상 두 개라고 보았다."), W(0, "formula_misuse", "해가 없다고 보았다."), W(3, "other", "어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ c, s }, q.fig, `${QX_JS}const t=(P.c-K)/A; return t>1e-9?2:Math.abs(t)<=1e-9?1:0;`),
          trace: [...quadXRead(q), [`꼭짓점 (${fmtNum(q.H)}, ${fmtNum(q.K)}) 이고 포물선은 ${q.A > 0 ? "위" : "아래"}로 열린다.`, "Find the vertex and the direction of opening."], [`f(x - s) 의 그래프는 옆으로만 이동하므로 꼭짓점의 높이 ${fmtNum(q.K)} 는 그대로이다.`, "A horizontal shift does not change the vertex height."], [`c = ${c} 이므로 실근은 ${ans}개이다.`, "Count the solutions."]], variant: "count_after_shift",
        }, q.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "zeros_count", structure: "곡선이 x 축과 만나는 점의 개수로 f(x) = 0 의 실근 개수를 읽음", extra: "easy: x 축과 만나는 점 세기", concepts: ["포물선 그래프", "함수의 영점"],
      gen(rng) {
        const fn = pickFn(rng); const d = rng.pick(["pos", "zero", "neg"] as const); const q = makeQuadVertex(rng, fn, { disc: d, nPts: 0 }); const ans = d === "pos" ? 2 : d === "zero" ? 1 : 0;
        return figInst(rng, { stimulus: quadRootsIntro(rng, fn), question: HOW(rng, `${fn}(x) = 0`), correct: ans, wrongs: [W(1, "formula_misuse", "접한다고 보았다."), W(2, "formula_misuse", "두 개라고 보았다."), W(0, "formula_misuse", "해가 없다고 보았다."), W(3, "other", "어긋났다.")].filter((w) => w.v !== ans), verificationJs: figJs({}, q.fig, `${QX_JS}return D>1e-9?2:Math.abs(D)<=1e-9?1:0;`), trace: [[`곡선이 x 축과 만나는 점을 찾는다.`, "Look for the x-intercepts."], [`만나는 점은 ${ans}개이므로 실근은 ${ans}개이다.`, "Count the x-intercepts."]], variant: "count_x_intercepts",
        }, q.fig);
      },
    },
    {
      lv: "medium", name: "vertex_marked_count", structure: "꼭짓점이 표시된 포물선에서 f(x) = c 의 실근 개수를 꼭짓점 높이와 비교해 구함", extra: "medium: 꼭짓점 높이와 c 비교", concepts: ["포물선 그래프", "실근의 개수"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any", vertex: true }); const sg = Math.sign(q.A); const c = q.K + rng.pick([-2, -1, 0, 1, 2, 3]) * sg; const ans = count(q.A, q.K, c);
        return figInst(rng, { stimulus: `${quadVertexIntro(rng, fn)}`, question: HOW(rng, `${fn}(x) = ${c}`), correct: ans, wrongs: [W(1, "formula_misuse", "항상 한 개라고 보았다."), W(2, "formula_misuse", "항상 두 개라고 보았다."), W(0, "formula_misuse", "해가 없다고 보았다."), W(3, "other", "어긋났다.")].filter((w) => w.v !== ans), verificationJs: figJs({ c }, q.fig, `${QX_JS}const t=(P.c-K)/A; return t>1e-9?2:Math.abs(t)<=1e-9?1:0;`), trace: [[`표시된 꼭짓점은 (${q.H}, ${q.K}) 이다.`, "Read the vertex."], [`포물선은 ${q.A > 0 ? "위" : "아래"}로 열린다.`, "Read the direction of opening."], [`c = ${c} 를 꼭짓점 높이 ${q.K} 와 비교하면 실근은 ${ans}개이다.`, "Compare c with the vertex height."]], variant: "count_vs_vertex",
        }, q.fig);
      },
    },
  ],
});
