// nonlinear_functions.evaluate.FN.P — 순수 함수 그래프(포물선, 축 제목 x·y)에서 식을 세워 그림 밖 x 의 함숫값을 구한다(표 버전 .TB.P 의 그래프판).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { pickFn } from "./_t5-kit";
import { makeQuadG, quadGIntro, quadGRead, QUADG_JS, type QuadG } from "../pure-kit";

const qv = (q: QuadG, x: number) => q.A * x * x + q.B * x + q.C;
/** 그림 범위 밖의 정수 x(양쪽 중 한쪽). */
const outX = (rng: Rng, q: QuadG, lo = 1, hi = 4) => (rng.chance(0.5) ? q.R + rng.int(lo, hi) : -q.R - rng.int(lo, hi));
const vq = (fn: string, x: number, rng: Rng) => rng.pick([`What is the value of $${fn}(${x})$?`, `What is $${fn}(${x})$?`, `Find the value of $${fn}(${x})$.`, `What is the value of $y$ on the graph of $y = ${fn}(x)$ when $x = ${x}$?`]);

export const ITEM = defineItem({
  prefix: "nfe", itemId: "nonlinear_functions.evaluate.FN.P",
  hard: [
    {
      op: "repr_shift", structure: "포물선 그래프의 표시점으로 식 ax² + bx + c 를 세운 뒤 그림 밖 x 의 함숫값을 구함", extra: "그림 밖이라 읽을 수 없어 세 점으로 식을 세워 대입해야 함(마지막 두 점의 변화율로 일차로 늘이는 것이 함정) — medium 은 x = 0 의 값",
      concepts: ["포물선 그래프", "이차식 세우기", "함숫값"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadG(rng, fn); const x = outX(rng, q, 1, 3); const y = qv(q, x);
        const n = q.xs.length - 1; const slope = (q.ys[n] - q.ys[n - 1]) / (q.xs[n] - q.xs[n - 1]); const linExt = q.ys[n] + slope * (x - q.xs[n]);
        return figInst(rng, {
          stimulus: quadGIntro(rng, fn), question: vq(fn, x, rng), correct: y,
          wrongs: [W(linExt, "formula_misuse", "마지막 두 점의 변화율로 일차로 늘였다."), W(-y, "sign_error", "부호를 바꿨다."), W(qv({ ...q, B: -q.B }, x), "sign_error", "b 의 부호를 바꿨다."), W(y - q.C, "step_missing", "상수항을 빠뜨렸다."), W(qv(q, -x), "sign_error", "x 의 부호를 바꿔 대입했다.")].filter((w) => Number.isInteger(w.v) && w.v !== y),
          verificationJs: figJs({ x }, q.fig, `${QUADG_JS}return f(P.x);`),
          trace: [...quadGRead(q), [`${fn}(${x}) = ${fmtNum(q.A)}(${x})² + (${fmtNum(q.B)})(${x}) + (${fmtNum(q.C)}) = ${fmtNum(y)} 이다.`, "Substitute into the equation."]], variant: "evaluate_far",
        }, q.fig);
      },
    },
    {
      op: "compose_kind", structure: "그래프에서 f 의 식을 세우고, y = f(x + s) 의 그래프에서 x = t 일 때의 값을 구함(t + s 는 그림 밖)", extra: "합성 입력 t + s 를 먼저 계산하고 식으로 계산해야 함(f(t) 로 읽는 것이 함정) — medium 은 f 의 값",
      concepts: ["이차식 세우기", "함수의 합성(입력 이동)", "함숫값"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadG(rng, fn); const u = outX(rng, q); const s = rng.nz(-6, 6); const t = u - s; if (Math.abs(s) < 2) throw new GenFail("s");
        const y = qv(q, u); const se = s > 0 ? `x + ${s}` : `x - ${-s}`;
        return figInst(rng, {
          stimulus: `${quadGIntro(rng, fn)} ${rng.pick([`The graph of $y = ${fn}(${se})$ is also a parabola.`, `Shifting the input gives a new parabola, the graph of $y = ${fn}(${se})$.`, `A new function is formed by the rule $y = ${fn}(${se})$, and its graph is a parabola.`])}`,
          question: rng.pick([`What is the value of $y$ on the graph of $y = ${fn}(${se})$ when $x = ${t}$?`, `On the graph of $y = ${fn}(${se})$, what is the $y$-coordinate of the point with $x$-coordinate ${t}?`]), correct: y,
          wrongs: [W(qv(q, t), "condition_ignored", `${fn}(${t}) 를 계산했다.`), W(qv(q, t - s), "sign_error", "이동 방향을 반대로 했다."), W(qv(q, t) + s, "formula_misuse", "출력에 s 를 더했다."), W(-y, "sign_error", "부호를 바꿨다."), W(y + q.A, "other", "계산 중 어긋났다.")].filter((w) => Number.isInteger(w.v) && w.v !== y),
          verificationJs: figJs({ s, t }, q.fig, `${QUADG_JS}return f(P.t + P.s);`),
          trace: [...quadGRead(q), [`x = ${t} 일 때 입력은 ${t} + (${s}) = ${u} 이다.`, "Compute the inner input."], [`${fn}(${u}) = ${fmtNum(y)} 이다.`, "Evaluate f."]], variant: "evaluate_shifted",
        }, q.fig);
      },
    },
    {
      op: "chain2", structure: "그래프에서 식을 세우고, 그림 밖 두 x 사이의 평균변화율을 구함", extra: "식 → 두 함숫값 → 변화율, 2단 연쇄(표시점 한 구간의 변화율을 쓰는 것이 함정) — medium 은 한 값",
      concepts: ["이차식 세우기", "함숫값", "평균변화율"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadG(rng, fn); const p = q.R + rng.int(1, 3); const r = p + rng.int(2, 4); const yp = qv(q, p), yr = qv(q, r); const ans = (yr - yp) / (r - p);
        const m0 = (q.ys[1] - q.ys[0]) / (q.xs[1] - q.xs[0]);
        return figInst(rng, {
          stimulus: quadGIntro(rng, fn), question: rng.pick([`What is the average rate of change of $${fn}(x)$ from $x = ${p}$ to $x = ${r}$?`, `What is the average rate of change of $${fn}$ over the interval from $x = ${p}$ to $x = ${r}$?`]), correct: ans,
          wrongs: [W(yr - yp, "step_missing", "x 의 변화로 나누지 않았다."), W(m0, "axis_misread", "표시점 한 구간의 변화율을 답했다."), W(-ans, "sign_error", "순서를 바꿔 뺐다."), W((yr + yp) / (r - p), "formula_misuse", "두 값을 더했다."), W(2 * q.A * p + q.B, "formula_misuse", "한 점의 기울기를 썼다.")].filter((w) => Number.isInteger(w.v * 2) && w.v !== ans),
          verificationJs: figJs({ p, r }, q.fig, `${QUADG_JS}return (f(P.r) - f(P.p)) / (P.r - P.p);`),
          trace: [...quadGRead(q), [`${fn}(${p}) = ${yp}, ${fn}(${r}) = ${yr} 이다.`, "Evaluate at both inputs."], [`평균변화율 = (${yr} - (${yp})) ÷ (${r} - ${p}) = ${fmtNum(ans)} 이다.`, "Divide the change in output by the change in input."]], variant: "average_rate",
        }, q.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "그래프에서 식을 세우고, 그림 밖 두 x 에서의 함숫값의 차 f(p) - f(r) 를 구함", extra: "두 번 대입해 비교해야 함(하나만 계산하거나 순서를 바꾸는 것이 함정) — medium 은 f 한 값",
      concepts: ["이차식 세우기", "함숫값", "두 값의 비교"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadG(rng, fn); const p = outX(rng, q); const r = outX(rng, q); if (p === r) throw new GenFail("same");
        const yp = qv(q, p), yr = qv(q, r), ans = yp - yr;
        return figInst(rng, {
          stimulus: quadGIntro(rng, fn), question: rng.pick([`What is the value of $${fn}(${p}) - ${fn}(${r})$?`, `What is the difference $${fn}(${p}) - ${fn}(${r})$?`]), correct: ans,
          wrongs: [W(yr - yp, "sign_error", "순서를 바꿔 뺐다."), W(yp + yr, "sign_error", "두 값을 더했다."), W(yp, "step_missing", "한 값만 답했다."), W(qv(q, p - r), "formula_misuse", "입력의 차를 대입했다."), W(ans + q.A, "other", "계산 중 어긋났다.")].filter((w) => Number.isInteger(w.v) && w.v !== ans),
          verificationJs: figJs({ p, r }, q.fig, `${QUADG_JS}return f(P.p) - f(P.r);`),
          trace: [...quadGRead(q), [`${fn}(${p}) = ${yp}, ${fn}(${r}) = ${yr} 이다.`, "Evaluate at both inputs."], [`차 = ${yp} - (${yr}) = ${ans} 이다.`, "Subtract."]], variant: "difference_of_values",
        }, q.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "read_marked_value", structure: "표시된 점에서 함숫값을 읽음", extra: "easy: 표시점 읽기", concepts: ["포물선 그래프", "함숫값"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadG(rng, fn); const i = rng.int(0, 2); const x = q.xs[i]; const y = q.ys[i];
        return figInst(rng, { stimulus: quadGIntro(rng, fn), question: vq(fn, x, rng), correct: y, wrongs: [W(x, "axis_misread", "x 를 답했다."), W(-y, "sign_error", "부호를 바꿨다."), W(y + q.A, "other", "옆 칸을 읽었다."), W(q.K, "axis_misread", "꼭짓점의 y 를 답했다.")].filter((w) => w.v !== y), verificationJs: figJs({ x }, q.fig, `${QUADG_JS}return f(P.x);`), trace: [[`그래프에서 x = ${x} 인 표시점의 y 값을 읽는다.`, "Read the marked point."], [`${fn}(${x}) = ${y} 이다.`, "State the value."]], variant: "read_marked_point",
        }, q.fig);
      },
    },
    {
      lv: "medium", name: "value_at_zero", structure: "x = 0 이 표시되지 않은 그래프에서 식을 세워 f(0) 을 구함", extra: "medium: 식 세우기 후 상수항", concepts: ["이차식 세우기", "상수항"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadG(rng, fn); if (q.xs.includes(0) || q.C === q.K) throw new GenFail("x0");
        return figInst(rng, { stimulus: quadGIntro(rng, fn), question: vq(fn, 0, rng), correct: q.C, wrongs: [W(q.ys[0], "axis_misread", "첫 표시점의 y 를 답했다."), W(-q.C, "sign_error", "부호를 바꿨다."), W(q.C + q.B, "other", "f(1) 을 계산했다."), W(q.K, "axis_misread", "꼭짓점의 y 를 답했다."), W(q.A + q.C, "formula_misuse", "a 를 더했다.")].filter((w) => w.v !== q.C), verificationJs: figJs({}, q.fig, `${QUADG_JS}return f(0);`), trace: [...quadGRead(q), [`${fn}(0) = c = ${q.C} 이다.`, "The constant term is f(0)."]], variant: "constant_term",
        }, q.fig);
      },
    },
  ],
});
