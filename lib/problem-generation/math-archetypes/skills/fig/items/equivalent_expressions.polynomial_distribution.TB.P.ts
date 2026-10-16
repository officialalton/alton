// equivalent_expressions.polynomial_distribution.TB.P — 이차 다항식의 값표에서 식을 세워 전개(분배)한 계수를 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { A_POOL, LEAD, QUAD_JS, quadRead, quadTab, xsRun, type Quad } from "./_t5-kit";

const PN = ["p", "q", "r", "s", "w", "k"];
function gen(rng: Rng, fn: string, o: { with0?: boolean; no0?: boolean } = {}): Quad {
  for (let t = 0; t < 60; t++) {
    const A = rng.pick(A_POOL), B = rng.nz(-9, 9), C = rng.nz(-20, 20); const n = rng.int(5, 6); const x0 = o.with0 ? rng.int(-n + 1, 0) : o.no0 ? rng.pick([1, 2, -n - 1, -n]) : rng.int(-4, 2);
    if (Math.abs(B) < 2 || Math.abs(C) < 2) continue;
    try { return quadTab(fn, A, B, C, xsRun(x0, n)); } catch { continue; }
  }
  throw new GenFail("다항식 값표 표집 실패");
}
const intro = (rng: Rng, fn: string) => rng.pick(LEAD) + rng.pick([
  `The table shows several values of $x$ and the corresponding values of $${fn}(x)$, where $${fn}$ is a quadratic polynomial.`,
  `For the second-degree polynomial $${fn}(x)$, the table shown gives the value of $${fn}(x)$ for selected values of $x$.`,
  `Selected values of a quadratic polynomial $${fn}(x)$ are shown in the table.`,
  `A polynomial $${fn}(x)$ of degree 2 takes the values given in the table for the listed values of $x$.`,
  `The table shown lists input-output pairs for the quadratic polynomial $${fn}(x)$.`,
  `Some values of a polynomial function $${fn}$, whose highest power of $x$ is 2, are given in the table.`,
  `In the table, each value of $x$ is paired with the value of the quadratic expression $${fn}(x)$.`,
  `A quadratic polynomial $${fn}(x)$ was evaluated at several values of $x$, and the results are recorded in the table shown.`,
]);
const stdForm = (fn: string, rng: Rng) => rng.pick([`$${fn}(x)$ is written in the form $ax^2 + bx + c$, where $a$, $b$, and $c$ are constants`, `$${fn}(x)$ is expressed as $ax^2 + bx + c$, with $a$, $b$, and $c$ constants`, `the standard form of $${fn}(x)$ is $ax^2 + bx + c$, where $a$, $b$, and $c$ are constants`]);

export const ITEM = defineItem({
  prefix: "ee", itemId: "equivalent_expressions.polynomial_distribution.TB.P",
  hard: [
    {
      op: "repr_shift", structure: "x = 0 행이 없는 값표에서 다항식을 ax² + bx + c 로 세워 일차항 계수 b 를 구함", extra: "2계 차분으로 a, 두 점으로 b 를 구해 표준형 계수로 바꿔야 함(1계 차분을 b 로 쓰는 것이 함정) — medium 은 a",
      concepts: ["이차 값표의 2계 차분", "다항식의 표준형", "계수 결정"],
      gen(rng) {
        const fn = rng.pick(PN); const q = gen(rng, fn, { no0: true });
        return figInst(rng, {
          stimulus: `${intro(rng, fn)} Suppose ${stdForm(fn, rng)}.`, question: rng.pick([`What is the value of $b$?`, `What is the coefficient of $x$?`, `Based on the table, what is $b$?`]), correct: q.B,
          wrongs: [W(q.ys[1] - q.ys[0], "formula_misuse", "1계 차분을 b 로 썼다."), W(-q.B, "sign_error", "부호를 바꿨다."), W(q.B + q.A, "other", "a 를 더했다."), W(q.C, "axis_misread", "상수항을 답했다."), W(2 * q.A, "formula_misuse", "2계 차분을 답했다.")].filter((w) => w.v !== q.B),
          verificationJs: figJs({}, q.fig, `${QUAD_JS}return B;`),
          trace: [...quadRead(q), [`따라서 b = ${q.B} 이다.`, "State b."]], variant: "linear_coefficient",
        }, q.fig);
      },
    },
    {
      op: "chain2", structure: "값표로 다항식을 세운 뒤 (x + s)·p(x) 를 분배·전개해 x² 의 계수를 구함", extra: "식 세우기 → 분배 전개에서 x² 항이 두 곳(b·x 와 s·a x²)에서 생김을 모아야 함 — medium 은 a",
      concepts: ["다항식의 표준형", "분배법칙(다항식 곱)", "동류항 정리"],
      gen(rng) {
        const fn = rng.pick(PN); const q = gen(rng, fn); const s = rng.nz(-7, 7); if (Math.abs(s) < 2) throw new GenFail("s"); const ans = q.B + q.A * s; if (ans === 0) throw new GenFail("0");
        const fac = s > 0 ? `x + ${s}` : `x - ${-s}`;
        return figInst(rng, {
          stimulus: `${intro(rng, fn)} The product $(${fac})${fn}(x)$ is expanded and written as $ax^3 + bx^2 + cx + d$, where $a$, $b$, $c$, and $d$ are constants.`, question: rng.pick([`What is the value of $b$?`, `What is the coefficient of $x^2$?`]), correct: ans,
          wrongs: [W(q.B, "step_missing", "s·a x² 항을 빠뜨렸다."), W(q.A * s, "step_missing", "x·bx 항을 빠뜨렸다."), W(q.B - q.A * s, "sign_error", "s 의 부호를 반대로 했다."), W(q.C + q.B * s, "formula_misuse", "x 의 계수를 계산했다."), W(q.A, "axis_misread", "x³ 의 계수를 답했다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ s }, q.fig, `${QUAD_JS}return B + A * P.s;`),
          trace: [...quadRead(q), [`(${fac})(${fmtNum(q.A)}x² + ${fmtNum(q.B)}x + ${fmtNum(q.C)}) 에서 x² 항: x·(${q.B}x) + (${s})·(${q.A}x²) 이다.`, "Distribute and collect the x^2 terms."], [`계수 = ${q.B} + (${q.A})(${s}) = ${ans} 이다.`, "Add the coefficients."]], variant: "product_coefficient",
        }, q.fig);
      },
    },
    {
      op: "compose_kind", structure: "값표로 p(x) 를 세운 뒤 p(x + s) 를 전개해 x 의 계수를 구함", extra: "식 세우기 → 합성 p(x + s) 에서 (x + s)² 의 분배로 생기는 2as 와 b 를 모아야 함(b 만 쓰는 것이 함정) — medium 은 a",
      concepts: ["다항식의 표준형", "합성(입력 이동)", "제곱 전개·분배"],
      gen(rng) {
        const fn = rng.pick(PN); const q = gen(rng, fn); const s = rng.nz(-6, 6); if (Math.abs(s) < 2) throw new GenFail("s"); const ans = 2 * q.A * s + q.B; if (ans === 0) throw new GenFail("0");
        const sh = s > 0 ? `x + ${s}` : `x - ${-s}`;
        return figInst(rng, {
          stimulus: `${intro(rng, fn)} The expression $${fn}(${sh})$ is expanded and written in the form $ax^2 + bx + c$, where $a$, $b$, and $c$ are constants.`, question: rng.pick([`What is the value of $b$?`, `What is the coefficient of $x$?`]), correct: ans,
          wrongs: [W(q.B, "condition_ignored", "이동을 무시했다."), W(q.A * s + q.B, "step_missing", "(x + s)² 의 2sx 에서 2 를 빠뜨렸다."), W(q.B - 2 * q.A * s, "sign_error", "s 의 부호를 반대로 했다."), W(2 * q.A * s, "step_missing", "b 를 빠뜨렸다."), W(q.A * s * s + q.B * s + q.C, "formula_misuse", "상수항을 계산했다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ s }, q.fig, `${QUAD_JS}return 2 * A * P.s + B;`),
          trace: [...quadRead(q), [`${fn}(${sh}) = ${q.A}(${sh})² + ${q.B}(${sh}) + ${q.C} 이다.`, "Substitute x + s."], [`x 의 계수 = ${q.A} × 2 × (${s}) + ${q.B} = ${ans} 이다.`, "Collect the x terms."]], variant: "shift_coefficient",
        }, q.fig);
      },
    },
    {
      op: "inverse", structure: "값표의 영점 k 로 인수 (x - k) 를 찾고, p(x) = (x - k)(ux + w) 의 w 를 역으로 구함", extra: "표에서 0 이 되는 x 로 인수를 정한 뒤 상수항 비교(-k·w = c)로 w 를 거꾸로 구해야 함 — medium 은 a",
      concepts: ["인수정리(영점과 인수)", "다항식의 표준형", "계수 비교"],
      gen(rng) {
        const fn = rng.pick(PN); let q: Quad | null = null; let k = 0, w = 0;
        for (let t = 0; t < 80 && !q; t++) {
          const A = rng.pick(A_POOL); k = rng.nz(-5, 5); w = rng.nz(-12, 12); const n = rng.int(5, 6); const x0 = rng.int(k - n + 1, k); const xs = xsRun(x0, n); const r2 = -w / A;
          if (xs.includes(r2) || Math.abs(w) < 2 || Math.abs(k) < 2) continue;
          try { q = quadTab(fn, A, w - A * k, -k * w, xs); } catch { q = null; }
        }
        if (!q) throw new GenFail("q");
        return figInst(rng, {
          stimulus: `${intro(rng, fn)} ${rng.pick([`The polynomial can be written as $${fn}(x) = (x - k)(ux + w)$, where $k$, $u$, and $w$ are constants and $k$ is one of the values of $x$ listed in the table.`, `One factor of $${fn}(x)$ is $x - k$, where $k$ is a value of $x$ in the table, so $${fn}(x) = (x - k)(ux + w)$ for some constants $k$, $u$, and $w$.`, `Using a value of $x$ from the table, $${fn}(x)$ can be factored as $(x - k)(ux + w)$, where $k$, $u$, and $w$ are constants.`])}`, question: rng.pick([`What is the value of $w$?`, `What is $w$?`, `Based on the table, what is the value of the constant $w$?`]), correct: w,
          wrongs: [W(-w, "sign_error", "부호를 바꿨다."), W(k, "axis_misread", "k 를 답했다."), W(q.C, "step_missing", "-k 로 나누지 않았다."), W(q.B - q.A * k, "sign_error", "일차항 비교에서 부호를 반대로 했다."), W(q.B, "formula_misuse", "일차항 계수를 답했다.")].filter((w2) => w2.v !== w),
          verificationJs: figJs({}, q.fig, `${QUAD_JS}const z = FIGURE.rows.filter(r => r[1] === 0); if (z.length !== 1) throw new Error('표의 영점 개수'); return C / -z[0][0];`),
          trace: [[`표에서 ${fn}(${k}) = 0 이므로 k = ${k} 이다.`, "A zero in the table gives the factor x - k."], ...quadRead(q).slice(1), [`상수항 비교: (-k)·w = c ⇒ -(${k})·w = ${q.C} 이다.`, "Compare constant terms."], [`w = ${w} 이다.`, "Solve for w."]], variant: "factor_coefficient",
        }, q.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "constant_term", structure: "x = 0 행이 있는 값표에서 상수항 c 를 읽음", extra: "easy: c = p(0)", concepts: ["다항식의 표준형", "상수항"],
      gen(rng) {
        const fn = rng.pick(PN); const q = gen(rng, fn, { with0: true });
        return figInst(rng, { stimulus: `${intro(rng, fn)} Suppose ${stdForm(fn, rng)}.`, question: `What is the value of $c$?`, correct: q.C, wrongs: [W(q.ys[0] === q.C ? q.ys[1] : q.ys[0], "axis_misread", "다른 칸을 읽었다."), W(-q.C, "sign_error", "부호를 바꿨다."), W(q.B, "formula_misuse", "b 를 답했다."), W(q.C + q.A, "other", "p(1) 쪽을 읽었다.")].filter((w) => w.v !== q.C), verificationJs: figJs({}, q.fig, `${QUAD_JS}return C;`), trace: [[`c = ${fn}(0) 이다.`, "The constant term equals p(0)."], [`표에서 ${fn}(0) = ${q.C} 이다.`, "Read p(0) from the table."]], variant: "read_constant",
        }, q.fig);
      },
    },
    {
      lv: "medium", name: "leading_coefficient", structure: "값표의 2계 차분으로 이차항 계수 a 를 구함", extra: "medium: 2계 차분 ÷ 2", concepts: ["2계 차분", "이차항 계수"],
      gen(rng) {
        const fn = rng.pick(PN); const q = gen(rng, fn);
        return figInst(rng, { stimulus: `${intro(rng, fn)} Suppose ${stdForm(fn, rng)}.`, question: `What is the value of $a$?`, correct: q.A, wrongs: [W(2 * q.A, "formula_misuse", "2계 차분을 그대로 답했다."), W(q.ys[1] - q.ys[0], "formula_misuse", "1계 차분을 답했다."), W(-q.A, "sign_error", "부호를 바꿨다."), W(q.B, "axis_misread", "b 를 답했다.")].filter((w) => w.v !== q.A), verificationJs: figJs({}, q.fig, `${QUAD_JS}return A;`), trace: [quadRead(q)[0], quadRead(q)[1], quadRead(q)[2]], variant: "leading_from_differences",
        }, q.fig);
      },
    },
  ],
});
