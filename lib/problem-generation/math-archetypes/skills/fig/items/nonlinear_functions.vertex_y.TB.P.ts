// nonlinear_functions.vertex_y.TB.P — 이차함수 값표에서 그래프 꼭짓점의 y 좌표(최솟값·최댓값)를 구한다.
import { GenFail } from "../../../types";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { pickFn, QUAD_JS, quadAround, quadIntro, quadOneSided, quadRead, symStep, type Quad } from "./_t5-kit";

const ext = (q: Quad) => (q.A > 0 ? "minimum" : "maximum");
const tabExt = (q: Quad) => (q.A > 0 ? Math.min(...q.ys) : Math.max(...q.ys));
const kStep = (q: Quad): [string, string] => [`꼭짓점의 y 좌표 = ${q.fn}(${fmtNum(q.H)}) = ${fmtNum(q.K)} 이다.`, "Evaluate the function at the axis of symmetry."];

export const ITEM = defineItem({
  prefix: "nf", itemId: "nonlinear_functions.vertex_y.TB.P",
  hard: [
    {
      op: "repr_shift", structure: "꼭짓점이 표 밖이고 같은 값의 쌍도 없는 이차 값표에서 식을 세워 최솟값(최댓값)을 구함", extra: "표에 꼭짓점·대칭 쌍이 없어 2계 차분·두 점으로 식을 세우고 꼭짓점에서 계산해야 함(표의 가장 작은 값을 답하는 것이 함정) — medium 은 대칭 쌍으로 축을 찾는 표",
      concepts: ["이차 값표의 2계 차분", "이차식 세우기", "꼭짓점의 y 좌표(극값)"],
      gen(rng) {
        const fn = pickFn(rng); const q = quadOneSided(rng, fn);
        return figInst(rng, {
          stimulus: quadIntro(rng, fn), question: `What is the ${ext(q)} value of $${fn}(x)$?`, correct: q.K,
          wrongs: [W(tabExt(q), "axis_misread", "표에서 가장 작은(큰) 값을 답했다."), W(q.H, "axis_misread", "꼭짓점의 x 좌표를 답했다."), W(q.C, "formula_misuse", "상수항 c 를 답했다."), W(-q.K, "sign_error", "부호를 바꿨다."), W(q.K + q.A, "other", "축을 한 칸 잘못 잡았다.")].filter((w) => w.v !== q.K),
          verificationJs: figJs({}, q.fig, `${QUAD_JS}return K;`),
          trace: [...quadRead(q), symStep(q), kStep(q)], variant: "extreme_from_fit",
        }, q.fig);
      },
    },
    {
      op: "chain2", structure: "값표에서 f 의 식을 세우고, g(x) = f(x) + mx 의 꼭짓점 y 좌표를 구함", extra: "f 의 식 → 일차항이 바뀐 g 의 축 → 그 축에서 g 의 값, 2단 연쇄(f 의 극값을 쓰는 것이 함정) — medium 은 f 의 극값",
      concepts: ["이차식 세우기", "일차항 변화와 대칭축", "꼭짓점의 y 좌표"],
      gen(rng) {
        const fn = pickFn(rng); const g = pickFn(rng, [fn]); const q = quadAround(rng, fn, true); const j = rng.nz(-4, 4); const m = 2 * q.A * j; if (Math.abs(m) < 2) throw new GenFail("m");
        const H2 = -(q.B + m) / (2 * q.A); const ans = q.C - ((q.B + m) ** 2) / (4 * q.A); if (!Number.isInteger(ans) || ans === q.K) throw new GenFail("ans");
        const me = m < 0 ? `- ${Math.abs(m)}x` : `+ ${m}x`;
        return figInst(rng, {
          stimulus: `${quadIntro(rng, fn)} The function $${g}$ is defined by $${g}(x) = ${fn}(x) ${me}$.`, question: `What is the $y$-coordinate of the vertex of the graph of $y = ${g}(x)$ in the $xy$-plane?`, correct: ans,
          wrongs: [W(q.K, "condition_ignored", `${fn} 의 꼭짓점 y 좌표를 답했다.`), W(q.K + m * q.H, "step_missing", `${fn} 의 축에서 ${g} 의 값을 계산했다.`), W(H2, "axis_misread", "꼭짓점의 x 좌표를 답했다."), W(q.C - ((q.B - m) ** 2) / (4 * q.A), "sign_error", "m 의 부호를 반대로 더했다."), W(-ans, "sign_error", "부호를 바꿨다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ m }, q.fig, `${QUAD_JS}const B2 = B + P.m; return C - B2 * B2 / (4 * A);`),
          trace: [...quadRead(q), [`${g}(x) = ${fmtNum(q.A)}x² + (${fmtNum(q.B + m)})x + ${fmtNum(q.C)}, 축 x = ${fmtNum(H2)} 이다.`, "Find the new axis of symmetry."], [`${g}(${fmtNum(H2)}) = ${fmtNum(ans)} 이다.`, "Evaluate g on its axis."]], variant: "extreme_after_linear_term",
        }, q.fig);
      },
    },
    {
      op: "param_condition", structure: "값표의 대칭으로 꼭짓점을 찾고, 방정식 f(x) + c = 0 이 해를 정확히 하나 갖는 c 를 구함", extra: "해가 하나 ⇔ 수평선이 꼭짓점에서 접함으로 조건을 바꾼 뒤 c = -k 를 구해야 함(부호 함정) — medium 은 극값만",
      concepts: ["이차함수의 대칭", "꼭짓점의 y 좌표", "해의 개수 조건"],
      gen(rng) {
        const fn = pickFn(rng); const q = quadAround(rng, fn, rng.chance(0.5), [-2, -1, 1, 2]); const ans = -q.K; if (!Number.isInteger(ans) || ans === 0) throw new GenFail("k");
        return figInst(rng, {
          stimulus: `${quadIntro(rng, fn)} In the equation $${fn}(x) + c = 0$, $c$ is a constant.`, question: `For what value of $c$ does the equation have exactly one real solution?`, correct: ans,
          wrongs: [W(q.K, "sign_error", "c = k 로 부호를 놓쳤다."), W(-tabExt(q), "axis_misread", "표의 극값 칸을 꼭짓점으로 읽었다."), W(-q.C, "formula_misuse", "상수항을 썼다."), W(q.H, "axis_misread", "꼭짓점의 x 좌표를 답했다."), W(ans + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({}, q.fig, `${QUAD_JS}return -K;`),
          trace: [quadRead(q)[0], quadRead(q)[1], symStep(q), [`꼭짓점 y = ${fmtNum(q.K)} (${q.fn} 의 ${ext(q)}) 이다.`, "Find the vertex value."], [`${fn}(x) = -c 가 해 하나 ⇔ -c = ${fmtNum(q.K)} 이므로 c = ${fmtNum(ans)} 이다.`, "One solution exactly when the horizontal line touches the vertex."]], variant: "tangent_horizontal",
        }, q.fig);
      },
    },
    {
      op: "compose_kind", structure: "값표에서 f 의 극값을 구하고, g(x) = d - f(x) 의 최댓값(최솟값)으로 바꿈", extra: "f 의 최솟값을 구한 뒤 부호 반전 합성으로 최대·최소가 뒤바뀜을 해석해야 함 — medium 은 f 의 극값",
      concepts: ["이차식 세우기", "꼭짓점의 y 좌표", "함수의 변환(반전·평행이동)"],
      gen(rng) {
        const fn = pickFn(rng); const g = pickFn(rng, [fn]); const q = quadOneSided(rng, fn); const d = rng.int(5, 60); const ans = d - q.K;
        const gx = q.A > 0 ? "maximum" : "minimum";
        return figInst(rng, {
          stimulus: `${quadIntro(rng, fn)} The function $${g}$ is defined by $${g}(x) = ${d} - ${fn}(x)$.`, question: `What is the ${gx} value of $${g}(x)$?`, correct: ans,
          wrongs: [W(d + q.K, "sign_error", "f 의 극값을 더했다."), W(q.K, "condition_ignored", `${fn} 의 극값을 답했다.`), W(d - tabExt(q), "axis_misread", "표의 극값 칸을 썼다."), W(-q.K, "step_missing", "d 를 빠뜨렸다."), W(ans + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ d }, q.fig, `${QUAD_JS}return P.d - K;`),
          trace: [...quadRead(q), kStep(q), [`${g}(x) = ${d} - ${fn}(x) 는 ${fn} 가 ${ext(q)} 일 때 ${gx} 가 되므로 ${d} - (${fmtNum(q.K)}) = ${fmtNum(ans)} 이다.`, "Negating f swaps minimum and maximum."]], variant: "extreme_of_reflection",
        }, q.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "vertex_in_table", structure: "꼭짓점 행이 있는 대칭 값표에서 극값을 읽음", extra: "easy: 대칭 가운데 칸의 값", concepts: ["이차함수의 대칭", "극값"],
      gen(rng) {
        const fn = pickFn(rng); const q = quadAround(rng, fn, true);
        return figInst(rng, { stimulus: quadIntro(rng, fn), question: `What is the $y$-coordinate of the vertex of the graph of $y = ${fn}(x)$ in the $xy$-plane?`, correct: q.K, wrongs: [W(q.H, "axis_misread", "x 좌표를 답했다."), W(-q.K, "sign_error", "부호를 바꿨다."), W(q.K + q.A, "other", "옆 칸 값을 읽었다."), W(q.C, "formula_misuse", "상수항을 답했다.")].filter((w) => w.v !== q.K), verificationJs: figJs({}, q.fig, `${QUAD_JS}return K;`), trace: [symStep(q), kStep(q)], variant: "vertex_value_read",
        }, q.fig);
      },
    },
    {
      lv: "medium", name: "vertex_from_pair", structure: "꼭짓점 행이 없는 표에서 같은 값의 쌍으로 축을 찾고 2계 차분으로 극값을 구함", extra: "medium: 축 + 한 번의 대입", concepts: ["이차함수의 대칭", "극값"],
      gen(rng) {
        const fn = pickFn(rng); const q = quadAround(rng, fn, false, [-4, 4]);
        return figInst(rng, { stimulus: quadIntro(rng, fn), question: `What is the ${ext(q)} value of $${fn}(x)$?`, correct: q.K, wrongs: [W(tabExt(q), "axis_misread", "표의 극값 칸을 답했다."), W(q.H, "axis_misread", "x 좌표를 답했다."), W(-q.K, "sign_error", "부호를 바꿨다."), W(q.C, "formula_misuse", "상수항을 답했다.")].filter((w) => w.v !== q.K), verificationJs: figJs({}, q.fig, `${QUAD_JS}return K;`), trace: [quadRead(q)[1], symStep(q), kStep(q)], variant: "vertex_value_half",
        }, q.fig);
      },
    },
  ],
});
