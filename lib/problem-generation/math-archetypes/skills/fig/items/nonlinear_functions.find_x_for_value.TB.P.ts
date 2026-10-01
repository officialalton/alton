// nonlinear_functions.find_x_for_value.TB.P — 비선형 함수 값표에서 주어진 출력이 되는 입력 x 를 구한다(hard: 이차 / easy·medium: 지수).
import { GenFail } from "../../../types";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { EXP_JS, expGen, expIntro, expRead, pickFn, QUAD_JS, quadAround, quadIntro, quadRead, quadWithRoots, symStep } from "./_t5-kit";

/** f(x) = c 의 큰 해(재계산: 근의 공식). */
const BIG = (c: string) => `const a2=A, b2=B, c2=C-(${c}); const disc=b2*b2-4*a2*c2; if (disc<0) throw new Error('해 없음'); const r1=(-b2+Math.sqrt(disc))/(2*a2), r2=(-b2-Math.sqrt(disc))/(2*a2); return Math.max(r1, r2);`;
const greater = ["What is the greater of the two solutions?", "If the two solutions are $x_1$ and $x_2$, where $x_1 < x_2$, what is the value of $x_2$?", "What is the larger solution?"];

export const ITEM = defineItem({
  prefix: "nf", itemId: "nonlinear_functions.find_x_for_value.TB.P",
  hard: [
    {
      op: "repr_shift", structure: "이차 값표에서 식을 세우고, 표에 없는 출력 c 에 대해 f(x) = c 를 풀어 큰 해를 구함", extra: "표에 그 출력이 없어 식을 세운 뒤 이차방정식으로 바꿔 풀어야 함 — medium 은 지수 표를 늘려 읽기",
      concepts: ["이차식 세우기", "이차방정식 풀이", "함숫값과 입력"],
      gen(rng) {
        const fn = pickFn(rng); const c = rng.int(-30, 30); const q = quadWithRoots(rng, fn, c); if (q.ys.includes(c)) throw new GenFail("in table");
        return figInst(rng, {
          stimulus: `${quadIntro(rng, fn)} The equation $${fn}(x) = ${c}$ has two solutions.`, question: rng.pick(greater), correct: q.q,
          wrongs: [W(q.p, "condition_ignored", "작은 해를 답했다."), W(-q.q, "sign_error", "부호를 바꿨다."), W(-q.p, "sign_error", "인수의 부호를 반대로 읽었다."), W(q.p + q.q, "formula_misuse", "두 해의 합을 답했다."), W(q.H, "axis_misread", "대칭축을 답했다.")].filter((w) => w.v !== q.q),
          verificationJs: figJs({ c }, q.fig, `${QUAD_JS}${BIG("P.c")}`),
          trace: [...quadRead(q), [`${fn}(x) - (${c}) = ${fmtNum(q.A)}(x - (${q.p}))(x - (${q.q})) = 0 이다.`, "Set up and factor the equation."], [`해는 ${q.p}, ${q.q} 이고 큰 해는 ${q.q} 이다.`, "Choose the greater solution."]], variant: "solve_for_output",
        }, q.fig);
      },
    },
    {
      op: "constraint_select", structure: "출력 c 가 표에 한 번만 나오는 이차 값표에서, f(x) = c 의 두 해 중 표에 없는 해를 대칭으로 구함", extra: "표에서 한 해를 읽고, 대칭축을 찾아 다른 해(표 밖)를 골라야 함(표에 보이는 해를 답하는 것이 함정) — medium 은 지수 표",
      concepts: ["이차함수의 대칭", "f(x) = c 의 두 해", "해의 선택"],
      gen(rng) {
        const fn = pickFn(rng); const q = quadAround(rng, fn, rng.chance(0.5));
        const idx = q.ys.findIndex((y, i) => q.ys.indexOf(y) === i && q.ys.lastIndexOf(y) === i && y !== q.K); if (idx < 0) throw new GenFail("single");
        const x1 = q.xs[idx], c = q.ys[idx], x2 = 2 * q.H - x1; if (q.xs.includes(x2)) throw new GenFail("both");
        return figInst(rng, {
          stimulus: `${quadIntro(rng, fn)} The equation $${fn}(x) = ${c}$ has two solutions. One of them is a value of $x$ listed in the table.`, question: `What is the solution that is not listed in the table?`, correct: x2,
          wrongs: [W(x1, "condition_ignored", "표에 있는 해를 답했다."), W(-x1, "sign_error", "부호만 바꿨다."), W(q.H, "step_missing", "대칭축을 답했다."), W(2 * q.H + x1, "sign_error", "2h + x 로 계산했다."), W(x2 + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== x2),
          verificationJs: figJs({ c }, q.fig, `${QUAD_JS}const xs=FIGURE.rows.map(r=>r[0]); const hit=FIGURE.rows.filter(r=>r[1]===P.c); if (hit.length!==1) throw new Error('표의 해 개수'); const o = 2 * H - hit[0][0]; if (xs.includes(o)) throw new Error('둘 다 표에'); return o;`),
          trace: [quadRead(q)[0], quadRead(q)[1], [`표에서 ${fn}(${x1}) = ${c} 이므로 한 해는 ${x1} 이다.`, "Read one solution from the table."], symStep(q), [`다른 해 = 2 × ${fmtNum(q.H)} - ${x1} = ${fmtNum(x2)} 이다.`, "Reflect across the axis."]], variant: "other_solution_by_symmetry",
        }, q.fig);
      },
    },
    {
      op: "chain2", structure: "지문의 일차함수 값 g(t) 를 구한 뒤, 값표의 이차함수에 대해 f(x) = g(t) 를 풀어 큰 해를 구함", extra: "g(t) → 목표 출력 → 표에서 세운 f 로 방정식, 2단 연쇄 — medium 은 지수 표",
      concepts: ["일차함수의 값", "이차식 세우기", "이차방정식 풀이"],
      gen(rng) {
        const fn = pickFn(rng); const g = pickFn(rng, [fn]); const c = rng.int(-30, 30); const q = quadWithRoots(rng, fn, c); const t = rng.nz(-5, 6); const m = rng.nz(-6, 6); const b = c - m * t;
        if (Math.abs(m) < 2 || Math.abs(t) < 2 || Math.abs(b) < 2 || Math.abs(b) > 99 || q.ys.includes(c)) throw new GenFail("mb");
        const ge = `${m}x ${b < 0 ? "-" : "+"} ${Math.abs(b)}`;
        return figInst(rng, {
          stimulus: `${quadIntro(rng, fn)} The function $${g}$ is defined by $${g}(x) = ${ge}$. The equation $${fn}(x) = ${g}(${t})$ has two solutions.`, question: rng.pick(greater), correct: q.q,
          wrongs: [W(q.p, "condition_ignored", "작은 해를 답했다."), W(c, "step_missing", `${g}(${t}) 의 값을 답했다.`), W(-q.p, "sign_error", "인수의 부호를 반대로 읽었다."), W(q.p + q.q, "formula_misuse", "두 해의 합을 답했다."), W(t, "axis_misread", "t 를 답했다.")].filter((w) => w.v !== q.q),
          verificationJs: figJs({ t, m, b }, q.fig, `${QUAD_JS}${BIG("P.m * P.t + P.b")}`),
          trace: [[`${g}(${t}) = ${m}(${t}) + (${b}) = ${c} 이다.`, "Evaluate g first."], ...quadRead(q), [`${fn}(x) = ${c} ⇒ ${fmtNum(q.A)}(x - (${q.p}))(x - (${q.q})) = 0, 큰 해 ${q.q} 이다.`, "Solve and take the greater solution."]], variant: "solve_for_linear_value",
        }, q.fig);
      },
    },
    {
      op: "compose_kind", structure: "값표에서 f 를 세우고, 합성식 f(x + s) = c 의 큰 해를 구함", extra: "f(u) = c 를 풀고 u = x + s 로 되돌려야 함(u 를 그대로 답하는 것이 함정) — medium 은 지수 표",
      concepts: ["이차식 세우기", "이차방정식 풀이", "함수의 합성(입력 이동)"],
      gen(rng) {
        const fn = pickFn(rng); const c = rng.int(-30, 30); const q = quadWithRoots(rng, fn, c); const s = rng.nz(-6, 6); if (Math.abs(s) < 2 || q.ys.includes(c)) throw new GenFail("s");
        const ans = q.q - s; const se = s > 0 ? `x + ${s}` : `x - ${-s}`;
        return figInst(rng, {
          stimulus: `${quadIntro(rng, fn)} The equation $${fn}(${se}) = ${c}$ has two solutions.`, question: rng.pick(greater), correct: ans,
          wrongs: [W(q.q, "step_missing", "u = x + s 를 되돌리지 않았다."), W(q.q + s, "sign_error", "이동 방향을 반대로 했다."), W(q.p - s, "condition_ignored", "작은 해를 답했다."), W(-ans, "sign_error", "부호를 바꿨다."), W(q.p + q.q - 2 * s, "formula_misuse", "두 해의 합을 답했다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ c, s }, q.fig, `${QUAD_JS}const a2=A, b2=B, c2=C-P.c; const disc=b2*b2-4*a2*c2; if (disc<0) throw new Error('해 없음'); return Math.max((-b2+Math.sqrt(disc))/(2*a2), (-b2-Math.sqrt(disc))/(2*a2)) - P.s;`),
          trace: [...quadRead(q), [`u = ${se} 로 두면 ${fn}(u) = ${c} 의 해는 u = ${q.p}, ${q.q} 이다.`, "Solve for the inner input."], [`x = u - (${s}) 이므로 큰 해 x = ${q.q} - (${s}) = ${ans} 이다.`, "Undo the shift."]], variant: "solve_shifted",
        }, q.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "read_input", structure: "지수 값표에서 주어진 출력의 입력 x 를 읽음", extra: "easy: 표에서 찾기", concepts: ["지수 값표", "입력과 출력"],
      gen(rng) {
        const fn = pickFn(rng); const e = expGen(rng, fn); const i = rng.int(1, e.xs.length - 1); const y = e.ys[i]; const x = e.xs[i];
        return figInst(rng, { stimulus: expIntro(rng, fn), question: `For what value of $x$ is $${fn}(x) = ${y}$?`, correct: x, wrongs: [W(x + 1, "other", "옆 칸을 읽었다."), W(x - 1, "other", "옆 칸을 읽었다."), W(e.ys[0], "axis_misread", "출력을 답했다."), W(-x, "sign_error", "부호를 바꿨다.")].filter((w) => w.v !== x), verificationJs: figJs({ y }, e.fig, `${EXP_JS}const hit = FIGURE.rows.filter(r=>r[1]===P.y); if (hit.length!==1) throw new Error('없음'); return hit[0][0];`), trace: [expRead(e)[0], [`${fn}(${x}) = ${y} 이므로 x = ${x} 이다.`, "Find the matching input."]], variant: "read_input",
        }, e.fig);
      },
    },
    {
      lv: "medium", name: "extend_ratio", structure: "지수 값표의 일정한 비로 표를 늘려 출력이 되는 x 를 구함", extra: "medium: 비를 찾아 한두 칸 늘림", concepts: ["지수 값표", "일정한 비"],
      gen(rng) {
        const fn = pickFn(rng); const e = expGen(rng, fn, { rs: [2, 3], max: 400 }); const k = rng.int(1, 2); const x = e.xs[e.xs.length - 1] + k; const y = e.a * e.r ** x; if (y > 999) throw new GenFail("big");
        return figInst(rng, { stimulus: expIntro(rng, fn), question: `For what value of $x$ is $${fn}(x) = ${y}$?`, correct: x, wrongs: [W(x + 1, "other", "한 칸 더 갔다."), W(x - 1, "other", "한 칸 덜 갔다."), W(y / e.r, "axis_misread", "출력을 답했다."), W(e.xs[e.xs.length - 1], "step_missing", "표의 마지막 x 를 답했다.")].filter((w) => w.v !== x), verificationJs: figJs({ y }, e.fig, `${EXP_JS}const x = Math.log(P.y / E0) / Math.log(R); if (Math.abs(x - Math.round(x)) > 1e-9) throw new Error('정수 아님'); return Math.round(x);`), trace: [...expRead(e), [`표 마지막 값에서 ${fmtNum(e.r)} 를 ${k} 번 곱하면 ${y} 이므로 x = ${x} 이다.`, "Extend the table by the common ratio."]], variant: "extend_by_ratio",
        }, e.fig);
      },
    },
  ],
});
