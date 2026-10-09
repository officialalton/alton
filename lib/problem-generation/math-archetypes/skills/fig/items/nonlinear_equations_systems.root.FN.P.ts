// nonlinear_equations_systems.root.FN.P — 순수 함수 그래프(포물선, 축 제목 x·y)에서 방정식 f(x) = 0 의 해(x 절편)를 구한다(표 버전 .TB.P 의 그래프판).
import { GenFail } from "../../../types";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { pickFn } from "./_t5-kit";
import { makeQuadRoots, QX_JS, quadMarkedIntro, quadRootsIntro, quadXRead, quadVertexIntro } from "../pure-fn-kit";

const askGreater = (rng: import("../../../rng").Rng) => rng.pick(["What is the greater solution?", "What is the larger of the two values of $x$?", "What is the greatest value of $x$ that satisfies the equation?"]);
const sols = (fn: string, rng: import("../../../rng").Rng) => rng.pick([`The equation $${fn}(x) = 0$ has two real solutions.`, `The graph of $y = ${fn}(x)$ crosses the $x$-axis at two points.`, `The function $${fn}$ has two zeros.`]);

export const ITEM = defineItem({
  prefix: "nesg", itemId: "nonlinear_equations_systems.root.FN.P",
  hard: [
    {
      op: "repr_shift", structure: "근이 표시되지 않은 포물선 그래프에서 표시점 세 개로 식을 세워 f(x) = 0 의 큰 해를 구함", extra: "표시점이 근이 아니라 식(a, b, c)을 세운 뒤 방정식으로 바꿔 풀어야 함(꼭짓점 x 를 답하는 것이 함정) — medium 은 꼭짓점·한 점으로 근을 구함",
      concepts: ["포물선 그래프", "이차식 세우기", "이차방정식의 해"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadRoots(rng, fn, { gap: [2, 3, 4, 5] });
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} ${sols(fn, rng)}`, question: askGreater(rng), correct: q.q,
          wrongs: [W(q.p, "condition_ignored", "작은 해를 답했다."), W(-q.p, "sign_error", "인수의 부호를 반대로 읽었다."), W(-q.q, "sign_error", "부호를 바꿨다."), W(q.C, "axis_misread", "y 절편을 답했다."), W(q.H, "axis_misread", "대칭축을 답했다.")].filter((w) => w.v !== q.q),
          verificationJs: figJs({}, q.fig, `${QX_JS}if (D<0) throw new Error('해 없음'); return hi;`),
          trace: [...quadXRead(q), [`${fn}(x) = ${fmtNum(q.A)}(x - (${q.p}))(x - (${q.q})) 로 인수분해한다.`, "Factor the quadratic."], [`해는 ${q.p}, ${q.q} 이고 큰 해는 ${q.q} 이다.`, "Take the greater solution."]], variant: "zero_from_marked_points",
        }, q.fig);
      },
    },
    {
      op: "compose_kind", structure: "그래프에서 f 의 영점을 구하고, 합성식 f(kx) = 0 의 큰 해를 구함", extra: "f 의 영점 u 를 구한 뒤 kx = u 로 되돌려 나눠야 함(u 를 그대로 답하는 것이 함정) — medium 은 f 의 영점",
      concepts: ["포물선 그래프", "함수의 영점", "함수의 합성(입력 배율)"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadRoots(rng, fn, { gap: [2, 4, 6] }); const k = rng.pick([2, 3, 4]); const big = Math.max(q.p / k, q.q / k); if (!Number.isInteger(big * 2) && !Number.isInteger(big * 10)) throw new GenFail("frac");
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} The equation $${fn}(${k}x) = 0$ has two real solutions.`, question: askGreater(rng), correct: big,
          wrongs: [W(q.q, "step_missing", "kx = u 를 되돌리지 않았다."), W(q.q * k, "formula_misuse", "k 를 곱했다."), W(Math.min(q.p / k, q.q / k), "condition_ignored", "작은 해를 답했다."), W(-big, "sign_error", "부호를 바꿨다."), W((q.p + q.q) / k, "formula_misuse", "두 해의 합을 답했다.")].filter((w) => w.v !== big),
          verificationJs: figJs({ k }, q.fig, `${QX_JS}if (D<0) throw new Error('해 없음'); return hi / P.k;`),
          trace: [...quadXRead(q), [`${fn}(u) = 0 의 해는 u = ${q.p}, ${q.q} 이다.`, "Find the zeros of f."], [`${k}x = u 이므로 x = ${fmtNum(q.p / k)}, ${fmtNum(q.q / k)}, 큰 해 ${fmtNum(big)} 이다.`, "Divide by k."]], variant: "zero_scaled_input",
        }, q.fig);
      },
    },
    {
      op: "chain2", structure: "그래프에서 식을 세워 두 영점을 구한 뒤, 두 x 절편 사이 거리를 구함", extra: "식 → 두 근 → 거리(차), 2단 연쇄 — medium 은 한 근",
      concepts: ["포물선 그래프", "이차방정식의 두 해", "x 절편 사이 거리"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadRoots(rng, fn); const ans = q.q - q.p;
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} The graph of $y = ${fn}(x)$ intersects the $x$-axis at two points.`, question: rng.pick([`What is the distance between these two points?`, `How far apart are the two points where the graph meets the $x$-axis?`, `What is the length of the segment joining the two $x$-intercepts?`]), correct: ans,
          wrongs: [W(q.p + q.q, "formula_misuse", "두 해의 합을 답했다."), W(Math.abs(q.p) + Math.abs(q.q) === ans ? ans + 2 : Math.abs(q.p) + Math.abs(q.q), "sign_error", "절댓값을 더했다."), W(q.q, "step_missing", "큰 해만 답했다."), W(ans / 2, "formula_misuse", "축까지 거리를 답했다."), W(q.p * q.q, "formula_misuse", "두 해의 곱을 답했다.")].filter((w) => w.v !== ans && w.v > 0),
          verificationJs: figJs({}, q.fig, `${QX_JS}if (D<0) throw new Error('해 없음'); return hi - lo;`),
          trace: [...quadXRead(q), [`인수분해: ${fmtNum(q.A)}(x - (${q.p}))(x - (${q.q})) = 0, 해 ${q.p}, ${q.q} 이다.`, "Find both zeros."], [`거리 = ${q.q} - (${q.p}) = ${ans} 이다.`, "Subtract the zeros."]], variant: "distance_between_zeros",
        }, q.fig);
      },
    },
    {
      op: "constraint_select", structure: "그래프에서 f 의 영점을 구하고, g(x) = f(x - s)(평행이동) 의 큰 영점을 구함", extra: "영점을 구한 뒤 입력 이동의 방향을 해석해야 함(s 를 빼는 방향 함정) — medium 은 f 의 영점",
      concepts: ["포물선 그래프", "함수의 영점", "함수의 평행이동"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadRoots(rng, fn); const s = rng.nz(-6, 6); if (Math.abs(s) === 1) throw new GenFail("s"); const ans = q.q + s; const se = s > 0 ? `x - ${s}` : `x + ${-s}`;
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} The equation $${fn}(${se}) = 0$ has two real solutions.`, question: askGreater(rng), correct: ans,
          wrongs: [W(q.q - s, "sign_error", "이동 방향을 반대로 했다."), W(q.q, "condition_ignored", `${fn} 의 큰 영점을 답했다.`), W(q.p + s, "condition_ignored", "작은 해를 답했다."), W(s, "step_missing", "이동량만 답했다."), W(ans + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ s }, q.fig, `${QX_JS}if (D<0) throw new Error('해 없음'); return hi + P.s;`),
          trace: [...quadXRead(q), [`${fn}(x) = 0 의 해는 ${q.p}, ${q.q} 이다.`, "Find the zeros of f."], [`${fn}(${se}) = 0 의 해는 x 방향으로 ${s} 만큼 이동한 것이므로 큰 해는 ${q.q} + (${s}) = ${ans} 이다.`, "Replacing x with x - s shifts the zeros by s."]], variant: "zero_after_shift",
        }, q.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "zeros_on_axis", structure: "곡선이 x 축과 만나는 두 눈금을 읽어 큰 해를 구함", extra: "easy: 곡선이 x 축을 지나는 눈금 읽기", concepts: ["포물선 그래프", "함수의 영점"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadRoots(rng, fn, { nPts: 0 });
        return figInst(rng, { stimulus: `${quadRootsIntro(rng, fn)} ${sols(fn, rng)}`, question: askGreater(rng), correct: q.q, wrongs: [W(q.p, "condition_ignored", "작은 해를 답했다."), W(q.C, "axis_misread", "y 절편을 답했다."), W(-q.q, "sign_error", "부호를 바꿨다."), W(q.q + 1, "other", "옆 눈금을 읽었다.")].filter((w) => w.v !== q.q), verificationJs: figJs({}, q.fig, `${QX_JS}if (D<0) throw new Error('해 없음'); return hi;`), trace: [[`곡선이 x 축과 만나는 눈금은 x = ${q.p}, ${q.q} 이다.`, "Read where the curve crosses the x-axis."], [`큰 해는 ${q.q} 이다.`, "Choose the greater one."]], variant: "zeros_read",
        }, q.fig);
      },
    },
    {
      lv: "medium", name: "zero_by_vertex_point", structure: "꼭짓점과 두 점이 표시된 포물선에서 꼭짓점형으로 식을 세워 큰 해를 구함", extra: "medium: 꼭짓점형 대입", concepts: ["포물선 그래프", "꼭짓점형", "함수의 영점"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadRoots(rng, fn, { nPts: 3, vertex: true, gap: [2, 4, 6] });
        return figInst(rng, { stimulus: `${quadVertexIntro(rng, fn)} ${sols(fn, rng)}`, question: askGreater(rng), correct: q.q, wrongs: [W(q.p, "condition_ignored", "작은 해를 답했다."), W(q.H, "step_missing", "꼭짓점 x 를 답했다."), W(-q.p, "sign_error", "부호만 바꿨다."), W(q.q + 2, "other", "어긋났다.")].filter((w) => w.v !== q.q), verificationJs: figJs({}, q.fig, `${QX_JS}if (D<0) throw new Error('해 없음'); return hi;`), trace: [[`꼭짓점 (${q.H}, ${q.K}) 을 읽는다.`, "Read the vertex and another point."], [`y = ${fmtNum(q.A)}(x - (${q.H}))² + (${q.K}) 로 놓고 y = 0 을 풀면 x = ${q.p}, ${q.q} 이다.`, "Set y = 0 in vertex form."], [`큰 해는 ${q.q} 이다.`, "Choose the greater one."]], variant: "zero_vertex_form",
        }, q.fig);
      },
    },
  ],
});
