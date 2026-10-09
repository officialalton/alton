// nonlinear_functions.zeros_end_behavior_polynomial.FN.P — 삼차 곡선 그래프(축 제목 x·y, y 눈금은 x 와 독립)에서 영점을 읽고 표시점으로 최고차항 계수를 구해 전개 계수·그림 밖의 값·역산을 구한다.
import { GenFail } from "../../../types";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { pickFn } from "./_t5-kit";
import { CUB_JS, cubIntro, cubRead, makeCub } from "../cubic-kit";

const FORM = (fn: string) => `The function is defined by $${fn}(x) = ax³ + bx² + cx + d$, where $a$, $b$, $c$, and $d$ are constants.`;
const pf = (rng: import("../../../rng").Rng) => pickFn(rng, ["h", "k", "a", "b", "c", "d"]);
const isI = Number.isInteger;
const sgn = (n: number) => (n < 0 ? `- ${-n}` : `+ ${n}`);

export const ITEM = defineItem({
  prefix: "zebp", itemId: "nonlinear_functions.zeros_end_behavior_polynomial.FN.P",
  hard: [
    {
      op: "repr_shift", structure: "삼차 곡선의 영점과 표시점으로 인수분해 꼴 a(x - r₁)(x - r₂)(x - r₃) 를 세우고 전개해 x² 의 계수 b 를 구함", extra: "영점의 합과 a 를 곱해 b = -a(r₁ + r₂ + r₃) 로 바꿔야 함(합을 b 로 읽는 것이 함정) — medium 은 a",
      concepts: ["삼차함수 그래프", "영점", "인수분해와 전개"],
      gen(rng) { const fn = pf(rng); const q = makeCub(rng, fn); const s1 = q.rs[0] + q.rs[1] + q.rs[2]; const b = q.B; if (b === 0 || Math.abs(b) > 99) throw new GenFail("b");
        return figInst(rng, { stimulus: `${cubIntro(rng, fn)} ${FORM(fn)}`, question: rng.pick(["What is the value of $b$?", "What is $b$?", "Find the value of the constant $b$.", "What is the coefficient of $x²$ in the expanded form?"]), correct: b,
          wrongs: [W(s1, "formula_misuse", "영점의 합을 b 로 답했다."), W(-b, "sign_error", "부호를 반대로 했다."), W(q.A, "axis_misread", "최고차항 계수를 답했다."), W(q.C, "axis_misread", "x 의 계수를 답했다."), W(b + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== b && isI(w.v)),
          verificationJs: figJs({}, q.fig, `${CUB_JS}return B;`), trace: [...cubRead(q), [`전개하면 x² 의 계수는 -a(r₁ + r₂ + r₃) = -(${q.A})(${s1}) 이다.`, "The x² coefficient is -a times the sum of the zeros."], [`b = ${b} 이다.`, "State b."]], variant: "x_squared_coefficient" }, q.fig); },
    },
    {
      op: "chain2", structure: "영점과 표시점으로 식을 세운 뒤 그림 밖의 x 에서의 값을 구함", extra: "a 를 구한 뒤 세 인수를 모두 곱해야 함(a = 1 로 두거나 인수 하나를 빠뜨리는 것이 함정) — medium 은 y 절편",
      concepts: ["삼차함수 그래프", "영점", "함숫값"],
      gen(rng) { const fn = pf(rng); const q = makeCub(rng, fn); const ks: number[] = []; for (let k = -(q.X + 3); k <= q.X + 3; k++) if (!q.rs.includes(k) && !q.xs.includes(k) && Math.abs(q.f(k)) <= 900 && Math.abs(q.f(k)) > q.Y) ks.push(k); if (!ks.length) throw new GenFail("k"); const k = rng.pick(ks); const v = q.f(k);
        return figInst(rng, { stimulus: `${cubIntro(rng, fn)} ${FORM(fn)}`, question: rng.pick([`What is the value of $${fn}(${k})$?`, `What is $${fn}(${k})$?`, `Find $${fn}(${k})$.`, `What value does the function take at $x = ${k}$?`]), correct: v,
          wrongs: [W(v / q.A, "condition_ignored", "최고차항 계수를 1 로 두었다."), W(-v, "sign_error", "부호를 반대로 했다."), W(q.A * (k - q.rs[0]) * (k - q.rs[1]), "step_missing", "인수 하나를 빠뜨렸다."), W(q.A * (k + q.rs[0]) * (k + q.rs[1]) * (k + q.rs[2]), "sign_error", "영점의 부호를 반대로 했다."), W(v + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== v && isI(w.v)),
          verificationJs: figJs({ k }, q.fig, `${CUB_JS}return f(P.k);`), trace: [...cubRead(q), [`${fn}(x) = ${q.A}(x - (${q.rs[0]}))(x - (${q.rs[1]}))(x - (${q.rs[2]})) 이다.`, "Write the factored form."], [`${fn}(${k}) = ${q.A}(${k - q.rs[0]})(${k - q.rs[1]})(${k - q.rs[2]}) = ${v} 이다.`, "Evaluate the product."]], variant: "value_outside" }, q.fig); },
    },
    {
      op: "compose_kind", structure: "영점과 표시점으로 a 를 구한 뒤 전개해 x 의 계수 c = a(r₁r₂ + r₁r₃ + r₂r₃) 를 구함", extra: "쌍별 곱의 합을 a 에 곱해야 함(합이나 곱 r₁r₂r₃ 를 쓰는 것이 함정) — medium 은 b",
      concepts: ["삼차함수 그래프", "영점", "인수분해와 전개"],
      gen(rng) { const fn = pf(rng); const q = makeCub(rng, fn); const s1 = q.rs[0] + q.rs[1] + q.rs[2], s2 = q.C / q.A, s3 = q.rs[0] * q.rs[1] * q.rs[2]; if (q.C === 0 || Math.abs(q.C) > 199) throw new GenFail("c");
        return figInst(rng, { stimulus: `${cubIntro(rng, fn)} ${FORM(fn)}`, question: rng.pick(["What is the value of $c$?", "What is $c$?", "Find the value of the constant $c$.", "What is the coefficient of $x$ in the expanded form?"]), correct: q.C,
          wrongs: [W(s2, "condition_ignored", "a 를 곱하지 않았다."), W(-q.C, "sign_error", "부호를 반대로 했다."), W(q.D, "axis_misread", "상수항을 답했다."), W(q.A * s1, "formula_misuse", "영점의 합을 썼다."), W(q.C + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== q.C && isI(w.v)),
          verificationJs: figJs({}, q.fig, `${CUB_JS}return A*s2;`), trace: [...cubRead(q), [`전개하면 x 의 계수는 a(r₁r₂ + r₁r₃ + r₂r₃) = (${q.A})(${s2}) 이다.`, "The x coefficient is a times the sum of pairwise products."], [`c = ${q.C} 이다. (참고: r₁r₂r₃ = ${s3})`, "State c."]], variant: "x_coefficient" }, q.fig); },
    },
    {
      op: "inverse", structure: "식을 세운 뒤 f(x) = V 를 만족하는 가장 큰 x(최대 영점 바깥의 한 점)를 역으로 구함", extra: "최대 영점 바깥에서 f 가 단조임을 알고 그 구간의 해를 찾아야 함(그림 안의 다른 해나 영점을 답하는 것이 함정) — medium 은 x 절편",
      concepts: ["삼차함수 그래프", "식 세우기", "역산"],
      gen(rng) { const fn = pf(rng); const q = makeCub(rng, fn); const x0 = q.rs[2] + rng.int(1, 4); const V = q.f(x0); if (Math.abs(V) > 900 || Math.abs(V) < 4) throw new GenFail("V");
        return figInst(rng, { stimulus: `${cubIntro(rng, fn)} ${FORM(fn)}`, question: rng.pick([`What is the greatest value of $x$ for which $${fn}(x) = ${V}$?`, `For the greatest value of $x$ with $${fn}(x) = ${V}$, what is $x$?`, `What is the largest $x$ that satisfies $${fn}(x) = ${V}$?`]), correct: x0,
          wrongs: [W(x0 - 1, "other", "한 칸 덜 갔다."), W(x0 + 1, "other", "한 칸 더 갔다."), W(q.rs[2], "step_missing", "가장 큰 영점을 답했다."), W(Math.round(V / q.A), "formula_misuse", "a 로 나눈 값을 답했다.")].filter((w) => w.v !== x0 && isI(w.v)),
          verificationJs: figJs({ V }, q.fig, `${CUB_JS}let best=null; for (let x=-40;x<=40;x+=0.5) if (Math.abs(f(x)-P.V)<1e-9) best=x; if (best===null||!Number.isInteger(best)) throw new Error('해 없음'); return best;`), trace: [...cubRead(q), [`${fn}(x) = ${q.A}(x - (${q.rs[0]}))(x - (${q.rs[1]}))(x - (${q.rs[2]})) 이다.`, "Write the factored form."], [`가장 큰 영점 ${q.rs[2]} 보다 큰 구간에서 값을 이어 보면 ${fn}(${x0}) = ${V} 이다.`, "Beyond the largest zero the function is monotone."], [`따라서 x = ${x0} 이다.`, "State the answer."]], variant: "greatest_solution" }, q.fig); },
    },
  ],
  em: [
    {
      lv: "easy", name: "sum_of_zeros", structure: "곡선이 x 축과 만나는 세 점을 읽어 영점의 합을 구함", extra: "easy: 영점 읽기", concepts: ["삼차함수 그래프", "영점"],
      gen(rng) { const fn = pf(rng); const q = makeCub(rng, fn); const s1 = q.rs[0] + q.rs[1] + q.rs[2]; if (s1 === 0) throw new GenFail("s1"); return figInst(rng, { stimulus: `${cubIntro(rng, fn)}${rng.pick(["", " The function has three real zeros.", " Each zero of the function is an integer."])}`, question: rng.pick([`What is the sum of the zeros of $${fn}$?`, `What is the sum of the three values of $x$ where the graph crosses the $x$-axis?`, `The zeros of $${fn}$ are added together. What is the sum?`, `Find the sum of the zeros of the function $${fn}$.`]), correct: s1, wrongs: [W(-s1, "sign_error", "부호를 반대로 했다."), W(q.rs[0] * q.rs[1] * q.rs[2], "formula_misuse", "영점의 곱을 답했다."), W(q.rs[2], "step_missing", "가장 큰 영점만 답했다."), W(s1 + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== s1), verificationJs: figJs({}, q.fig, `${CUB_JS}return s1;`), trace: [[`곡선이 x 축과 만나는 눈금을 읽으면 영점은 ${q.rs.join(", ")} 이다.`, "Read the zeros."], [`합은 ${q.rs.join(" + ")} = ${s1} 이다.`, "Add the zeros."]], variant: "sum_of_zeros" }, q.fig); },
    },
    {
      lv: "medium", name: "leading_a", structure: "영점과 표시점 하나로 최고차항 계수 a 를 구함", extra: "medium: a 구하기", concepts: ["삼차함수 그래프", "영점", "인수분해 꼴"],
      gen(rng) { const fn = pf(rng); const q = makeCub(rng, fn); return figInst(rng, { stimulus: `${cubIntro(rng, fn)} ${FORM(fn)}`, question: rng.pick(["What is the value of $a$?", "What is $a$?", "Find the value of the constant $a$."]), correct: q.A, wrongs: [W(-q.A, "sign_error", "부호를 반대로 했다."), W(q.ys[0], "axis_misread", "표시점의 y 를 답했다."), W(q.A * 2, "other", "2 배로 답했다."), W(q.A + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== q.A && w.v !== 0), verificationJs: figJs({}, q.fig, `${CUB_JS}return A;`), trace: [...cubRead(q), [`따라서 a = ${q.A} 이다.`, "State a."], [`${fn}(x) = ${q.A}(x - (${q.rs[0]}))(x - (${q.rs[1]}))(x - (${q.rs[2]})) 이다.`, "Write the equation."]], variant: "leading_coefficient" }, q.fig); },
    },
  ],
});
