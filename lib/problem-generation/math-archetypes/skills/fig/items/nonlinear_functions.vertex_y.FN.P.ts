// nonlinear_functions.vertex_y.FN.P — 순수 함수 그래프(포물선, 축 제목 x·y)에서 꼭짓점의 y 좌표(최솟값·최댓값)를 구한다(표 버전 .TB.P 의 그래프판).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { pickFn } from "./_t5-kit";
import { makeQuadG, pairXs, quadGIntro, quadGRead, QUADG_JS, type QuadG } from "../pure-kit";

const ext = (q: QuadG) => (q.A > 0 ? "minimum" : "maximum");
const tabExt = (q: QuadG) => (q.A > 0 ? Math.min(...q.ys) : Math.max(...q.ys));
const kStep = (q: QuadG): [string, string] => [`꼭짓점의 y 좌표 = ${q.fn}(${fmtNum(q.H)}) = ${fmtNum(q.K)} 이다.`, "Evaluate the function at the axis of symmetry."];
const axisStep = (q: QuadG): [string, string] => [`꼭짓점의 x 좌표 = -b ÷ (2a) = ${fmtNum(q.H)} 이다.`, "The axis of symmetry is x = -b / (2a)."];
const vyq = (fn: string, rng: Rng) => rng.pick([`What is the $y$-coordinate of the vertex of the graph of $y = ${fn}(x)$?`, `What is the $y$-coordinate of the vertex of the parabola shown?`, `The graph of $y = ${fn}(x)$ is a parabola. What is the $y$-coordinate of its vertex?`]);
const exq = (q: QuadG, rng: Rng) => rng.pick([`What is the ${ext(q)} value of $${q.fn}(x)$?`, `What is the ${ext(q)} value of the function $${q.fn}$?`, `What is the ${ext(q)} value of $y$ on the graph of $y = ${q.fn}(x)$?`]);

export const ITEM = defineItem({
  prefix: "nfy", itemId: "nonlinear_functions.vertex_y.FN.P",
  hard: [
    {
      op: "repr_shift", structure: "꼭짓점도 같은 높이의 쌍도 표시되지 않은 포물선 그래프에서 식을 세워 최솟값(최댓값)을 구함", extra: "표시점만으로 세 점의 식을 세우고 꼭짓점에서 계산해야 함(표시점 중 가장 낮은 값을 답하는 것이 함정) — medium 은 대칭 쌍으로 축을 찾는 그래프",
      concepts: ["포물선 그래프", "이차식 세우기", "꼭짓점의 y 좌표(극값)"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadG(rng, fn);
        return figInst(rng, {
          stimulus: quadGIntro(rng, fn), question: exq(q, rng), correct: q.K,
          wrongs: [W(tabExt(q), "axis_misread", "표시점 중 가장 낮은(높은) 값을 답했다."), W(q.H, "axis_misread", "꼭짓점의 x 좌표를 답했다."), W(q.C, "formula_misuse", "상수항 c 를 답했다."), W(-q.K, "sign_error", "부호를 바꿨다."), W(q.K + q.A, "other", "축을 한 칸 잘못 잡았다.")].filter((w) => w.v !== q.K),
          verificationJs: figJs({}, q.fig, `${QUADG_JS}return K;`),
          trace: [...quadGRead(q), axisStep(q), kStep(q)], variant: "extreme_from_points",
        }, q.fig);
      },
    },
    {
      op: "chain2", structure: "그래프에서 f 의 식을 세우고, y = f(x) + mx 의 꼭짓점 y 좌표를 구함", extra: "f 의 식 → 일차항이 바뀐 새 함수의 축 → 그 축에서의 값, 2단 연쇄(f 의 극값을 쓰는 것이 함정) — medium 은 f 의 극값",
      concepts: ["이차식 세우기", "일차항 변화와 대칭축", "꼭짓점의 y 좌표"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadG(rng, fn, { pair: rng.chance(0.5) }); const j = rng.nz(-4, 4); const m = 2 * q.A * j; if (Math.abs(m) < 2) throw new GenFail("m");
        const H2 = -(q.B + m) / (2 * q.A); const ans = q.C - ((q.B + m) ** 2) / (4 * q.A); if (!Number.isInteger(ans) || ans === q.K) throw new GenFail("ans");
        const me = m < 0 ? `- ${Math.abs(m)}x` : `+ ${m}x`;
        return figInst(rng, {
          stimulus: `${quadGIntro(rng, fn)} ${rng.pick([`The graph of $y = ${fn}(x) ${me}$ is also a parabola.`, `Adding a linear term gives a new parabola, the graph of $y = ${fn}(x) ${me}$.`, `A new function is formed by the rule $y = ${fn}(x) ${me}$, and its graph is a parabola.`])}`,
          question: rng.pick([`What is the $y$-coordinate of the vertex of the graph of $y = ${fn}(x) ${me}$?`, `What is the $y$-coordinate of the vertex of this new parabola?`]), correct: ans,
          wrongs: [W(q.K, "condition_ignored", `${fn} 의 꼭짓점 y 좌표를 답했다.`), W(q.K + m * q.H, "step_missing", `${fn} 의 축에서 새 함수의 값을 계산했다.`), W(H2, "axis_misread", "꼭짓점의 x 좌표를 답했다."), W(q.C - ((q.B - m) ** 2) / (4 * q.A), "sign_error", "m 의 부호를 반대로 더했다."), W(-ans, "sign_error", "부호를 바꿨다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ m }, q.fig, `${QUADG_JS}const B2 = B + P.m; return C - B2 * B2 / (4 * A);`),
          trace: [...quadGRead(q), [`새 함수: y = ${fmtNum(q.A)}x² + (${fmtNum(q.B + m)})x + ${fmtNum(q.C)}, 축 x = ${fmtNum(H2)} 이다.`, "Find the new axis of symmetry."], [`그 축에서의 값 = ${fmtNum(ans)} 이다.`, "Evaluate on the new axis."]], variant: "extreme_after_linear_term",
        }, q.fig);
      },
    },
    {
      op: "param_condition", structure: "그래프의 대칭으로 꼭짓점을 찾고, 방정식 f(x) + c = 0 이 해를 정확히 하나 갖는 c 를 구함", extra: "해가 하나 ⇔ 수평선이 꼭짓점에서 접함으로 조건을 바꾼 뒤 c = -k 를 구해야 함(부호 함정) — medium 은 극값만",
      concepts: ["포물선의 대칭", "꼭짓점의 y 좌표", "해의 개수 조건"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadG(rng, fn, { pair: rng.chance(0.5) }); const ans = -q.K; if (ans === 0) throw new GenFail("k");
        return figInst(rng, {
          stimulus: `${quadGIntro(rng, fn)} In the equation $${fn}(x) + c = 0$, $c$ is a constant.`, question: rng.pick([`For what value of $c$ does the equation have exactly one real solution?`, `What value of $c$ gives the equation exactly one real solution?`]), correct: ans,
          wrongs: [W(q.K, "sign_error", "c = k 로 부호를 놓쳤다."), W(-tabExt(q), "axis_misread", "표시점의 극값을 꼭짓점으로 읽었다."), W(-q.C, "formula_misuse", "상수항을 썼다."), W(q.H, "axis_misread", "꼭짓점의 x 좌표를 답했다."), W(ans + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({}, q.fig, `${QUADG_JS}return -K;`),
          trace: [...quadGRead(q), axisStep(q), [`꼭짓점 y = ${fmtNum(q.K)} (${q.fn} 의 ${ext(q)}) 이다.`, "Find the vertex value."], [`${fn}(x) = -c 가 해 하나 ⇔ -c = ${fmtNum(q.K)} 이므로 c = ${fmtNum(ans)} 이다.`, "One solution exactly when the horizontal line touches the vertex."]], variant: "tangent_horizontal",
        }, q.fig);
      },
    },
    {
      op: "compose_kind", structure: "그래프에서 f 의 극값을 구하고, y = d - f(x) 의 최댓값(최솟값)으로 바꿈", extra: "f 의 최솟값을 구한 뒤 부호 반전 합성으로 최대·최소가 뒤바뀜을 해석해야 함 — medium 은 f 의 극값",
      concepts: ["이차식 세우기", "꼭짓점의 y 좌표", "함수의 변환(반전·평행이동)"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadG(rng, fn); const d = rng.int(5, 60); const ans = d - q.K; const gx = q.A > 0 ? "maximum" : "minimum";
        return figInst(rng, {
          stimulus: `${quadGIntro(rng, fn)} ${rng.pick([`The graph of $y = ${d} - ${fn}(x)$ is also a parabola.`, `Reflecting the graph and shifting it gives the parabola $y = ${d} - ${fn}(x)$.`, `A new function is formed by the rule $y = ${d} - ${fn}(x)$.`])}`,
          question: rng.pick([`What is the ${gx} value of $y = ${d} - ${fn}(x)$?`, `What is the ${gx} value of $y$ on the graph of $y = ${d} - ${fn}(x)$?`]), correct: ans,
          wrongs: [W(d + q.K, "sign_error", "f 의 극값을 더했다."), W(q.K, "condition_ignored", `${fn} 의 극값을 답했다.`), W(d - tabExt(q), "axis_misread", "표시점의 극값을 썼다."), W(-q.K, "step_missing", "d 를 빠뜨렸다."), W(ans + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ d }, q.fig, `${QUADG_JS}return P.d - K;`),
          trace: [...quadGRead(q), axisStep(q), kStep(q), [`y = ${d} - ${fn}(x) 는 ${fn} 가 ${ext(q)} 일 때 ${gx} 가 되므로 ${d} - (${fmtNum(q.K)}) = ${fmtNum(ans)} 이다.`, "Negating f swaps minimum and maximum."]], variant: "extreme_of_reflection",
        }, q.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "vertex_marked", structure: "꼭짓점이 점으로 표시된 포물선 그래프에서 꼭짓점 y 를 읽음", extra: "easy: 표시된 꼭짓점 읽기", concepts: ["포물선 그래프", "꼭짓점"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadG(rng, fn, { vertex: true });
        return figInst(rng, { stimulus: quadGIntro(rng, fn), question: vyq(fn, rng), correct: q.K, wrongs: [W(q.H, "axis_misread", "x 좌표를 답했다."), W(-q.K, "sign_error", "부호를 바꿨다."), W(q.K + q.A, "other", "옆 점의 값을 읽었다."), W(q.C, "formula_misuse", "상수항을 답했다.")].filter((w) => w.v !== q.K), verificationJs: figJs({}, q.fig, `${QUADG_JS}return K;`), trace: [[`꼭짓점은 포물선이 가장 낮은(높은) 점 (${q.H}, ${q.K}) 이다.`, "The marked vertex."], [`꼭짓점의 y 좌표는 ${q.K} 이다.`, "Read the y-coordinate."]], variant: "vertex_value_read",
        }, q.fig);
      },
    },
    {
      lv: "medium", name: "vertex_from_pair", structure: "같은 높이의 두 표시점으로 축을 찾고 식을 세워 극값을 구함", extra: "medium: 축 + 한 번의 대입", concepts: ["포물선의 대칭", "극값"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadG(rng, fn, { pair: true });
        return figInst(rng, { stimulus: quadGIntro(rng, fn), question: exq(q, rng), correct: q.K, wrongs: [W(tabExt(q), "axis_misread", "표시점의 극값을 답했다."), W(q.H, "axis_misread", "x 좌표를 답했다."), W(-q.K, "sign_error", "부호를 바꿨다."), W(q.C, "formula_misuse", "상수항을 답했다.")].filter((w) => w.v !== q.K), verificationJs: figJs({}, q.fig, `${QUADG_JS}return K;`), trace: [quadGRead(q)[0], [`같은 높이의 두 표시점 x = ${pairXs(q)[0]}, ${pairXs(q)[1]} 의 가운데로 축은 x = ${q.H} 이다.`, "Axis midway between equal-height points."], kStep(q)], variant: "vertex_value_from_pair",
        }, q.fig);
      },
    },
  ],
});
