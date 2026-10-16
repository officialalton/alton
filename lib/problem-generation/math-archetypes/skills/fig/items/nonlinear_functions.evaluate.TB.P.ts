// nonlinear_functions.evaluate.TB.P — 이차함수 값표에서 표 밖의 입력에 대한 함숫값을 구한다(식은 표에서 세워야 함).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { A_POOL, pickFn, QUAD_JS, quadIntro, quadRead, quadTab, qv, xsRun, type Quad } from "./_t5-kit";

/** 일반 이차 값표: 정수 a, b, c; x 는 연속 정수 5~6개(0 이 없을 수도). */
function gen(rng: Rng, fn: string, o: { no0?: boolean } = {}): Quad {
  for (let t = 0; t < 60; t++) {
    const A = rng.pick(A_POOL), B = rng.int(-9, 9), C = rng.int(-20, 20); const n = rng.int(5, 6); const x0 = o.no0 ? rng.pick([1, 2, 3, -n - 2, -n - 1]) : rng.int(-4, 2);
    try { return quadTab(fn, A, B, C, xsRun(x0, n)); } catch { continue; }
  }
  throw new GenFail("이차 값표 표집 실패");
}
const outX = (rng: Rng, q: Quad) => (rng.chance(0.5) ? q.xs[q.xs.length - 1] + rng.int(2, 4) : q.xs[0] - rng.int(2, 4));

export const ITEM = defineItem({
  prefix: "nf", itemId: "nonlinear_functions.evaluate.TB.P",
  hard: [
    {
      op: "repr_shift", structure: "이차 값표에서 식 ax² + bx + c 를 세운 뒤 표에서 멀리 떨어진 x 의 함숫값을 구함", extra: "표를 이어 쓰기 어려운 거리라 2계 차분·두 점으로 식을 세워 대입해야 함(1계 차분을 일정하다고 보고 일차로 늘이는 것이 함정) — medium 은 x = 0 의 값",
      concepts: ["이차 값표의 2계 차분", "이차식 세우기", "함숫값"],
      gen(rng) {
        const fn = pickFn(rng); const q = gen(rng, fn); const x = rng.chance(0.5) ? q.xs[q.xs.length - 1] + rng.int(3, 6) : q.xs[0] - rng.int(3, 6); const y = qv(q, x); if (Math.abs(y) > 999) throw new GenFail("big");
        const n = q.xs.length - 1; const lastD = q.ys[n] - q.ys[n - 1]; const linExt = q.ys[n] + lastD * (x - q.xs[n]);
        return figInst(rng, {
          stimulus: quadIntro(rng, fn), question: `What is the value of $${fn}(${x})$?`, correct: y,
          wrongs: [W(linExt, "formula_misuse", "마지막 변화량이 일정하다고 보고 일차로 늘였다."), W(-y, "sign_error", "부호를 바꿨다."), W(qv({ A: q.A, B: -q.B, C: q.C }, x), "sign_error", "b 의 부호를 바꿨다."), W(y - q.C, "step_missing", "상수항을 빠뜨렸다."), W(qv(q, -x), "sign_error", "x 의 부호를 바꿔 대입했다.")].filter((w) => w.v !== y),
          verificationJs: figJs({ x }, q.fig, `${QUAD_JS}return f(P.x);`),
          trace: [...quadRead(q), [`${fn}(${x}) = ${fmtNum(q.A)}(${x})² + (${fmtNum(q.B)})(${x}) + (${fmtNum(q.C)}) = ${fmtNum(y)} 이다.`, "Substitute into the equation."]], variant: "evaluate_far",
        }, q.fig);
      },
    },
    {
      op: "compose_kind", structure: "값표에서 f 의 식을 세우고, g(x) = f(x + s) 의 값 g(t) 를 구함(t + s 는 표 밖)", extra: "합성 입력 t + s 를 먼저 계산하고, 그것이 표 밖이라 식으로 계산해야 함(g(t) 를 f(t) 로 읽는 것이 함정) — medium 은 f 의 값",
      concepts: ["이차식 세우기", "함수의 합성(입력 이동)", "함숫값"],
      gen(rng) {
        const fn = pickFn(rng); const g = pickFn(rng, [fn]); const q = gen(rng, fn); const u = outX(rng, q); const s = rng.nz(-6, 6); const t = u - s; if (Math.abs(s) < 2) throw new GenFail("s");
        const y = qv(q, u); if (Math.abs(y) > 999) throw new GenFail("big"); const se = s > 0 ? `x + ${s}` : `x - ${-s}`;
        return figInst(rng, {
          stimulus: `${quadIntro(rng, fn)} The function $${g}$ is defined by $${g}(x) = ${fn}(${se})$.`, question: `What is the value of $${g}(${t})$?`, correct: y,
          wrongs: [W(qv(q, t), "condition_ignored", `${fn}(${t}) 를 계산했다.`), W(qv(q, t - s), "sign_error", "이동 방향을 반대로 했다."), W(qv(q, t) + s, "formula_misuse", "출력에 s 를 더했다."), W(-y, "sign_error", "부호를 바꿨다."), W(y + q.A, "other", "계산 중 어긋났다.")].filter((w) => w.v !== y),
          verificationJs: figJs({ s, t }, q.fig, `${QUAD_JS}return f(P.t + P.s);`),
          trace: [...quadRead(q), [`${g}(${t}) = ${fn}(${t} + (${s})) = ${fn}(${u}) 이다.`, "Compute the inner input."], [`${fn}(${u}) = ${fmtNum(y)} 이다.`, "Evaluate f."]], variant: "evaluate_shifted",
        }, q.fig);
      },
    },
    {
      op: "chain2", structure: "값표에서 식을 세우고, 표 밖 두 x 사이의 평균변화율을 구함", extra: "식 → 두 함숫값 → 변화율, 2단 연쇄(표의 한 칸 변화량을 쓰는 것이 함정) — medium 은 한 값",
      concepts: ["이차식 세우기", "함숫값", "평균변화율"],
      gen(rng) {
        const fn = pickFn(rng); const q = gen(rng, fn); const p = q.xs[q.xs.length - 1] + rng.int(1, 3); const r = p + rng.int(2, 4); const yp = qv(q, p), yr = qv(q, r); if (Math.abs(yp) > 999 || Math.abs(yr) > 999) throw new GenFail("big");
        const ans = (yr - yp) / (r - p);
        return figInst(rng, {
          stimulus: quadIntro(rng, fn), question: `What is the average rate of change of $${fn}(x)$ from $x = ${p}$ to $x = ${r}$?`, correct: ans,
          wrongs: [W(yr - yp, "step_missing", "x 의 변화로 나누지 않았다."), W(q.ys[1] - q.ys[0], "axis_misread", "표의 한 칸 변화량을 답했다."), W(-ans, "sign_error", "순서를 바꿔 뺐다."), W((yr + yp) / (r - p), "formula_misuse", "두 값을 더했다."), W(2 * q.A * p + q.B, "formula_misuse", "한 점의 기울기를 썼다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ p, r }, q.fig, `${QUAD_JS}return (f(P.r) - f(P.p)) / (P.r - P.p);`),
          trace: [...quadRead(q), [`${fn}(${p}) = ${yp}, ${fn}(${r}) = ${yr} 이다.`, "Evaluate at both inputs."], [`평균변화율 = (${yr} - (${yp})) ÷ (${r} - ${p}) = ${fmtNum(ans)} 이다.`, "Divide the change in output by the change in input."]], variant: "average_rate",
        }, q.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "값표의 이차함수 f 와 지문의 일차함수 g 를 표 밖 같은 x 에서 계산해 차 f(x) - g(x) 를 구함", extra: "표에서 f 의 식을 세워 지문 식의 값과 비교해야 함 — medium 은 f 한 값",
      concepts: ["이차식 세우기", "일차함수의 값", "두 함수 비교"],
      gen(rng) {
        const fn = pickFn(rng); const g = pickFn(rng, [fn]); const q = gen(rng, fn); const x = outX(rng, q); const m = rng.nz(-9, 9), b = rng.int(-20, 20); if (Math.abs(m) < 2 || Math.abs(b) < 2) throw new GenFail("mb");
        const fy = qv(q, x), gy = m * x + b, ans = fy - gy; if (Math.abs(fy) > 999 || Math.abs(ans) > 999) throw new GenFail("big");
        const ge = `${m}x ${b < 0 ? "-" : "+"} ${Math.abs(b)}`;
        return figInst(rng, {
          stimulus: `${quadIntro(rng, fn)} The function $${g}$ is defined by $${g}(x) = ${ge}$.`, question: `What is the value of $${fn}(${x}) - ${g}(${x})$?`, correct: ans,
          wrongs: [W(fy + gy, "sign_error", "두 값을 더했다."), W(gy - fy, "sign_error", "순서를 바꿔 뺐다."), W(fy, "step_missing", `${g} 를 빼지 않았다.`), W(fy - (m * x - b), "sign_error", "절편 부호를 바꿨다."), W(ans + q.A, "other", "계산 중 어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ x, m, b }, q.fig, `${QUAD_JS}return f(P.x) - (P.m * P.x + P.b);`),
          trace: [...quadRead(q), [`${fn}(${x}) = ${fy}, ${g}(${x}) = ${m}(${x}) + (${b}) = ${gy} 이다.`, "Evaluate both functions."], [`차 = ${fy} - (${gy}) = ${ans} 이다.`, "Subtract."]], variant: "compare_with_linear",
        }, q.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "next_value", structure: "1계 차분이 일정하게 변하는 표를 한 칸 이어서 다음 값을 구함", extra: "easy: 차분 패턴 이어 쓰기", concepts: ["이차 값표", "차분 패턴"],
      gen(rng) {
        const fn = pickFn(rng); const q = gen(rng, fn); const n = q.xs.length - 1; const x = q.xs[n] + 1; const y = qv(q, x); const d1 = q.ys[n] - q.ys[n - 1]; const d2 = 2 * q.A;
        return figInst(rng, { stimulus: quadIntro(rng, fn), question: `What is the value of $${fn}(${x})$?`, correct: y, wrongs: [W(q.ys[n] + d1, "step_missing", "1계 차분을 그대로 더했다."), W(q.ys[n], "axis_misread", "마지막 값을 답했다."), W(y + d2, "other", "차분을 한 번 더 늘렸다."), W(-y, "sign_error", "부호를 바꿨다.")].filter((w) => w.v !== y), verificationJs: figJs({ x }, q.fig, `${QUAD_JS}return f(P.x);`), trace: [quadRead(q)[1], [`다음 1계 차분 = ${d1} + ${d2} = ${d1 + d2}, 따라서 ${fn}(${x}) = ${q.ys[n]} + ${d1 + d2} = ${y} 이다.`, "Extend the differences by one step."]], variant: "next_by_differences",
        }, q.fig);
      },
    },
    {
      lv: "medium", name: "value_at_zero", structure: "x = 0 이 없는 값표에서 식을 세워 f(0) 을 구함", extra: "medium: 식 세우기 후 상수항", concepts: ["이차식 세우기", "상수항"],
      gen(rng) {
        const fn = pickFn(rng); const q = gen(rng, fn, { no0: true });
        return figInst(rng, { stimulus: quadIntro(rng, fn), question: `What is the value of $${fn}(0)$?`, correct: q.C, wrongs: [W(q.ys[0], "axis_misread", "표 첫 값을 답했다."), W(-q.C, "sign_error", "부호를 바꿨다."), W(q.C + q.B, "other", "f(1) 을 계산했다."), W(q.A + q.C, "formula_misuse", "a 를 더했다.")].filter((w) => w.v !== q.C), verificationJs: figJs({}, q.fig, `${QUAD_JS}return f(0);`), trace: [quadRead(q)[1], quadRead(q)[2], [`b, c 를 구하면 ${fn}(0) = c = ${q.C} 이다.`, "The constant term is f(0)."]], variant: "constant_term",
        }, q.fig);
      },
    },
  ],
});
