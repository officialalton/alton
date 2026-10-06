// equivalent_expressions easy/medium 원형 — 문장 틀(=유사문항 그룹)을 늘린다. hard 원형(8개)은 파일럿 완료. 원형 하나가 그룹 하나.
import { GenFail, type Archetype } from "../types";
import { M, poly, shifted, spin, withParams, lin } from "../text";
import { rectSem, finishA } from "./a-kit";

const SKILL = "equivalent_expressions";
const T = (ko: string, en: string): [string, string] => [ko, en];
const VARS = ["x", "t", "n", "z"] as const;
const base = { skill: SKILL, operator: "frame" as const, mediumSteps: 0 };
const E = (c: number[], v: string) => M(poly(c, v));
const INTRO = ["[[Consider the expression below|An expression is given below|Look at the expression below|The expression below is written in terms of VAR]]. ", "[[A student simplifies the expression below|A student is asked to rewrite the expression below|In a worksheet, the expression below appears]]. "];
const intro = (rng: { pick<T>(a: readonly T[]): T }, v: string) => spin(rng as never, rng.pick(INTRO)).replace(/VAR/g, v);
const Q_EQ = "[[Which of the following is equivalent to the expression?|Which expression is equivalent to the given expression?|Which option is equal to the expression for all values of VAR?|The given expression is equivalent to which of the following?]]";
const q = (rng: never, v: string) => spin(rng, Q_EQ).replace(/VAR/g, v);
const EV = (v: string) => ({ [v]: 3 });

export const EE_EM_ARCHETYPES: Archetype[] = [
  // ───────── easy ─────────
  {
    ...base, id: "ee.polynomial_distribution.e_distribute_single", kind: "polynomial_distribution", difficulty: "easy",
    structure: "a(x+b) 를 분배해 전개한 식을 고른다", extraThinking: "(easy) 분배법칙 한 번", concepts: ["분배법칙", "문제 조건 해석"],
    generate(rng) {
      const a = rng.pick([-5, -4, -3, -2, 2, 3, 4, 5, 6]), b = rng.nz(-7, 8), v = rng.pick(VARS);
      return finishA(rng, {
        stimulus: intro(rng, v) + M(`${a}(${shifted(v, b)})`), question: q(rng as never, v), evalAt: EV(v),
        correctText: E([a, a * b], v),
        wrongTexts: [{ text: E([a, b], v), kind: "step_missing", reason: "괄호 안의 상수에 a 를 곱하지 않았다." }, { text: E([a, a + b], v), kind: "formula_misuse", reason: "상수항에 곱 대신 합을 썼다." }, { text: E([a, -a * b], v), kind: "sign_error", reason: "상수항의 부호를 반대로 적었다." }, { text: E([a + b, 0], v), kind: "formula_misuse", reason: "a 와 b 를 더해 x 의 계수로 썼다." }, { text: E([1, a * b], v), kind: "step_missing", reason: "x 의 계수에 a 를 곱하지 않았다." }],
        verificationJs: withParams({ a, b, x: 3 }, "return P.a*(P.x+P.b);"),
        trace: [T(`$${a}$ 를 괄호 안 두 항에 각각 곱한다.`, "Distribute to both terms."), T(`$${a}·${v} = ${a}${v}$, $${a}·${b < 0 ? `(${b})` : b} = ${a * b}$ 이다.`, "Multiply each term."), T(`결과는 $${poly([a, a * b], v)}$ 이다.`, "Write the result.")],
        variant: "distribute_single",
      });
    },
  },
  {
    ...base, id: "ee.polynomial_distribution.e_combine_like_terms", kind: "polynomial_distribution", difficulty: "easy",
    structure: "(ax+b) ± (cx+d) 의 동류항을 정리한다", extraThinking: "(easy) 동류항 결합(뺄셈이면 부호 분배)", concepts: ["동류항 정리", "문제 조건 해석"],
    generate(rng) {
      const a = rng.nz(-6, 7), b = rng.nz(-8, 8), c = rng.nz(-6, 7), d = rng.nz(-8, 8), v = rng.pick(VARS), minus = rng.chance(0.5); const s = minus ? -1 : 1;
      const co = [a + s * c, b + s * d]; if (co[0] === 0 || co[1] === 0) throw new GenFail("x");
      return finishA(rng, {
        stimulus: intro(rng, v) + M(`(${lin(a, b, v)}) ${minus ? "-" : "+"} (${lin(c, d, v)})`), question: q(rng as never, v), evalAt: EV(v), correctText: E(co, v),
        wrongTexts: minus
          ? [{ text: E([a - c, b + d], v), kind: "sign_error", reason: "빼는 식의 상수항 부호를 바꾸지 않았다." }, { text: E([a + c, b - d], v), kind: "sign_error", reason: "빼는 식의 x 항 부호를 바꾸지 않았다." }, { text: E([a + c, b + d], v), kind: "sign_error", reason: "뺄셈을 덧셈으로 계산했다." }, { text: E([a - c, b - d].map((x) => -x), v), kind: "sign_error", reason: "결과의 부호를 반대로 적었다." }, { text: E([a * c, b * d], v), kind: "formula_misuse", reason: "합·차 대신 곱을 썼다." }]
          : [{ text: E([a + c, b - d], v), kind: "sign_error", reason: "상수항을 더하지 않고 뺐다." }, { text: E([a - c, b + d], v), kind: "sign_error", reason: "x 항을 더하지 않고 뺐다." }, { text: E([a * c, b * d], v), kind: "formula_misuse", reason: "합 대신 곱을 썼다." }, { text: E([a + c + b + d, 0], v), kind: "formula_misuse", reason: "상수항과 x 항을 합쳤다." }, { text: E([-(a + c), -(b + d)], v), kind: "sign_error", reason: "결과의 부호를 반대로 적었다." }],
        verificationJs: withParams({ a, b, c, d, minus: minus ? 1 : 0, x: 3 }, "const A=P.a*P.x+P.b, B=P.c*P.x+P.d; return P.minus? A-B : A+B;"),
        trace: [T(minus ? "뺄셈은 두 번째 괄호 안 모든 항의 부호를 바꾸는 것이다." : "괄호를 그대로 풀고 동류항끼리 모은다.", "Handle the parentheses."), T(`${v} 의 계수: ${a} ${minus ? "-" : "+"} (${c}) = ${co[0]}.`, "Combine the coefficients."), T(`상수항: ${b} ${minus ? "-" : "+"} (${d}) = ${co[1]}.`, "Combine the constants."), T(`결과는 $${poly(co, v)}$ 이다.`, "Write the result.")],
        variant: "combine_like_terms",
      });
    },
  },
  {
    ...base, id: "ee.polynomial_distribution.e_distribute_plus_constant", kind: "polynomial_distribution", difficulty: "easy",
    structure: "a(x+b)+c 를 분배·정리한다", extraThinking: "(easy) 분배 후 상수항 합", concepts: ["분배법칙", "동류항"],
    generate(rng) {
      const a = rng.pick([-4, -3, -2, 2, 3, 4, 5]), b = rng.nz(-6, 7), c = rng.nz(-9, 9), v = rng.pick(VARS); const k = a * b + c; if (k === 0) throw new GenFail("x");
      return finishA(rng, {
        stimulus: intro(rng, v) + M(`${a}(${shifted(v, b)}) ${c < 0 ? "-" : "+"} ${Math.abs(c)}`), question: q(rng as never, v), evalAt: EV(v), correctText: E([a, k], v),
        wrongTexts: [{ text: E([a, a * b], v), kind: "step_missing", reason: "뒤의 상수 c 를 더하지 않았다." }, { text: E([a, b + c], v), kind: "step_missing", reason: "b 에 a 를 곱하지 않았다." }, { text: E([a, a * b - c], v), kind: "sign_error", reason: "상수 c 의 부호를 바꿨다." }, { text: E([a, a + b + c], v), kind: "formula_misuse", reason: "곱 대신 합을 썼다." }, { text: E([a * (1 + 0), a * (b + c)], v), kind: "formula_misuse", reason: "c 에도 a 를 곱했다." }],
        verificationJs: withParams({ a, b, c, x: 3 }, "return P.a*(P.x+P.b)+P.c;"),
        trace: [T(`$${a}$ 를 괄호 안에 분배한다: $${poly([a, a * b], v)}$.`, "Distribute."), T(`상수항을 더한다: ${a * b} ${c < 0 ? "-" : "+"} ${Math.abs(c)} = ${k}.`, "Add the constant."), T(`결과는 $${poly([a, k], v)}$ 이다.`, "Write the result.")],
        variant: "distribute_plus_constant",
      });
    },
  },
  {
    ...base, id: "ee.polynomial_distribution.e_factor_common", kind: "polynomial_distribution", difficulty: "easy",
    structure: "ax + ab 와 같은 식을 공통인수로 묶은 꼴에서 고른다", extraThinking: "(easy) 공통인수", concepts: ["공통인수", "문제 조건 해석"],
    generate(rng) {
      const a = rng.int(2, 9), b = rng.nz(-7, 8), v = rng.pick(VARS); const f = (m: number, k: number) => M(`${m}(${shifted(v, k)})`);
      return finishA(rng, {
        stimulus: intro(rng, v) + E([a, a * b], v), question: q(rng as never, v), evalAt: EV(v), correctText: f(a, b),
        wrongTexts: [{ text: f(a, a * b), kind: "step_missing", reason: "상수항을 공통인수로 나누지 않았다." }, { text: f(a, -b), kind: "sign_error", reason: "상수항의 부호를 바꿨다." }, { text: f(a * b, 1), kind: "formula_misuse", reason: "x 항에서 공통인수를 잘못 뽑았다." }, { text: f(a + 1, b), kind: "formula_misuse", reason: "공통인수를 a+1 로 잘못 묶었다." }, { text: f(1, a * b + a - 1), kind: "other", reason: "계산 오류." }],
        verificationJs: withParams({ a, b, x: 3 }, "return P.a*P.x+P.a*P.b;"),
        trace: [T(`두 항의 공통인수는 ${a} 이다.`, "Find the common factor."), T(`${a}${v} 와 ${a * b} 를 각각 ${a} 로 나눈다.`, "Divide each term."), T(`$${a}(${shifted(v, b)})$ 이다.`, "Write the factored form.")],
        variant: "factor_common",
      });
    },
  },

  // ───────── medium ─────────
  {
    ...base, id: "ee.polynomial_distribution.m_binomial_product", kind: "polynomial_distribution", difficulty: "medium",
    structure: "(px+a)(x+b) 를 전개한다", extraThinking: "(medium) 이항식의 곱", concepts: ["이항식의 곱", "동류항"],
    generate(rng) {
      const pp = rng.pick([1, 1, 2, 3]), a = rng.nz(-7, 7), b = rng.nz(-7, 7), v = rng.pick(VARS); const co = [pp, pp * b + a, a * b]; if (co[1] === 0) throw new GenFail("x");
      return finishA(rng, {
        stimulus: intro(rng, v) + M(`(${lin(pp, a, v)})(${shifted(v, b)})`), question: q(rng as never, v), evalAt: EV(v), correctText: E(co, v),
        wrongTexts: [{ text: E([pp, a * b], v), kind: "step_missing", reason: "가운데 항(교차항)을 빠뜨렸다." }, { text: E([pp, a + b, a * b], v), kind: "formula_misuse", reason: "x 계수를 (a + b) 로만 계산했다(pp 를 곱하지 않음)." }, { text: E([pp, pp * b - a, a * b], v), kind: "sign_error", reason: "교차항의 부호를 잘못 합쳤다." }, { text: E([pp, pp * b + a, -a * b], v), kind: "sign_error", reason: "상수항의 부호를 바꿨다." }, { text: E([pp, pp * b + a, a + b], v), kind: "formula_misuse", reason: "상수항을 합으로 계산했다." }],
        verificationJs: withParams({ p: pp, a, b, x: 3 }, "return (P.p*P.x+P.a)*(P.x+P.b);"),
        trace: [T("각 항을 서로 곱한다 (FOIL).", "Multiply each pair of terms."), T(`$${pp}${v}^2 + ${pp * b}${v} + ${a}${v} + ${a * b}$ 이다.`, "Write the four products."), T(`가운데 항을 합친다: ${pp * b} + ${a} = ${pp * b + a}.`, "Combine like terms."), T(`결과는 $${poly(co, v)}$ 이다.`, "Write the result.")],
        variant: "binomial_product",
      });
    },
  },
  {
    ...base, id: "ee.polynomial_distribution.m_square_binomial", kind: "polynomial_distribution", difficulty: "medium",
    structure: "(ax+b)² 을 전개한다", extraThinking: "(medium) 완전제곱 전개(가운데 항)", concepts: ["이항식의 제곱", "문제 조건 해석"],
    generate(rng) {
      const a = rng.pick([1, 2, 3, 4]), b = rng.nz(-8, 8), v = rng.pick(VARS); const co = [a * a, 2 * a * b, b * b];
      return finishA(rng, {
        stimulus: intro(rng, v) + M(`(${lin(a, b, v)})^2`), question: q(rng as never, v), evalAt: EV(v), correctText: E(co, v),
        wrongTexts: [{ text: E([a * a, 0, b * b], v), kind: "step_missing", reason: "가운데 항 2ab 를 빠뜨렸다." }, { text: E([a * a, a * b, b * b], v), kind: "formula_misuse", reason: "가운데 항에서 2 를 빠뜨렸다." }, { text: E([a * a, -2 * a * b, b * b], v), kind: "sign_error", reason: "가운데 항의 부호를 바꿨다." }, { text: E([a * a, 2 * a * b, -b * b], v), kind: "sign_error", reason: "상수항의 부호를 바꿨다." }, { text: E([a, 2 * b, b], v), kind: "formula_misuse", reason: "각 항을 제곱하지 않고 2배만 했다." }],
        verificationJs: withParams({ a, b, x: 3 }, "return Math.pow(P.a*P.x+P.b,2);"),
        trace: [T(`$(${lin(a, b, v)})^2 = (${lin(a, b, v)})(${lin(a, b, v)})$ 이다.`, "Write the square as a product."), T(`제곱항: $${a * a}${v}^2$, 상수항: ${b * b}.`, "Square the first and last terms."), T(`가운데 항: 2·${a}·${b < 0 ? `(${b})` : b}·${v} = ${2 * a * b}${v}.`, "Find the middle term."), T(`결과는 $${poly(co, v)}$ 이다.`, "Write the result.")],
        variant: "square_binomial",
      });
    },
  },
  {
    ...base, id: "ee.polynomial_distribution.m_difference_squares", kind: "polynomial_distribution", difficulty: "medium",
    structure: "(ax-b)(ax+b) 를 전개한다(제곱의 차)", extraThinking: "(medium) 가운데 항이 사라지는 곱셈공식", concepts: ["곱셈공식(합차)", "문제 조건 해석"],
    generate(rng) {
      const a = rng.pick([1, 2, 3, 4, 5]), b = rng.int(1, 9), v = rng.pick(VARS); const co = [a * a, 0, -b * b];
      return finishA(rng, {
        stimulus: intro(rng, v) + M(`(${lin(a, -b, v)})(${lin(a, b, v)})`), question: q(rng as never, v), evalAt: EV(v), correctText: E(co, v),
        wrongTexts: [{ text: E([a * a, 0, b * b], v), kind: "sign_error", reason: "상수항의 부호를 바꿨다(두 번째 항은 -b²)." }, { text: E([a * a, -2 * a * b, b * b], v), kind: "formula_misuse", reason: "(ax - b)² 로 전개했다." }, { text: E([a, 0, -b], v), kind: "formula_misuse", reason: "각 항을 제곱하지 않았다." }, { text: E([a * a, -2 * a * b, -b * b], v), kind: "step_missing", reason: "가운데 항이 사라지지 않는다고 착각했다." }, { text: E([a * a, 2 * a * b, -b * b], v), kind: "step_missing", reason: "가운데 항이 남는다고 착각했다." }],
        verificationJs: withParams({ a, b, x: 3 }, "return (P.a*P.x-P.b)*(P.a*P.x+P.b);"),
        trace: [T("두 이항식은 합과 차의 곱 (A - B)(A + B) 꼴이다.", "Recognize the sum-and-difference pattern."), T(`A = ${a === 1 ? "" : a}${v}, B = ${b} 이다.`, "Identify A and B."), T(`(A - B)(A + B) = A² - B² 이므로 $${poly(co, v)}$ 이다.`, "Apply the identity.")],
        variant: "difference_of_squares",
      });
    },
  },
  {
    ...base, id: "ee.polynomial_distribution.m_factor_quadratic", kind: "polynomial_distribution", difficulty: "medium",
    structure: "x²+bx+c 와 같은 식을 두 이항식의 곱으로 고른다", extraThinking: "(medium) 합이 b, 곱이 c 인 두 수 찾기", concepts: ["이차식 인수분해", "문제 조건 해석"],
    generate(rng) {
      const p = rng.nz(-8, 8), r = rng.nz(-8, 8), v = rng.pick(VARS); if (p === r || p + r === 0) throw new GenFail("x"); const fct = (m: number, k: number) => M(`(${shifted(v, m)})(${shifted(v, k)})`);
      return finishA(rng, {
        stimulus: intro(rng, v) + E([1, p + r, p * r], v), question: q(rng as never, v), evalAt: EV(v), correctText: fct(p, r),
        wrongTexts: [{ text: fct(-p, -r), kind: "sign_error", reason: "두 수의 부호를 모두 반대로 적었다." }, { text: fct(p, -r), kind: "sign_error", reason: "한 수의 부호를 잘못 적었다." }, { text: fct(1, p * r), kind: "formula_misuse", reason: "곱이 c 가 되는 수 1 과 c 를 골랐다(합을 확인하지 않음)." }, { text: fct(-p, r), kind: "sign_error", reason: "한 수의 부호를 잘못 적었다." }, { text: fct(p + r, 0 + 0 === 0 ? 1 : 1), kind: "formula_misuse", reason: "합과 1 로 인수를 구성했다." }],
        verificationJs: withParams({ b: p + r, c: p * r, x: 3 }, "return P.x*P.x+P.b*P.x+P.c;"),
        trace: [T(`합이 ${p + r}, 곱이 ${p * r} 인 두 수를 찾는다.`, "Find two numbers with the given sum and product."), T(`두 수는 ${p} 와 ${r} 이다.`, "They are p and r."), T(`$(${shifted(v, p)})(${shifted(v, r)})$ 이다.`, "Write the factors.")],
        variant: "factor_quadratic",
      });
    },
  },
  {
    ...base, id: "ee.rational_equivalence.m_cancel_common_factor", kind: "rational_equivalence", difficulty: "medium",
    structure: "(x²+(a+b)x+ab)/(x+a) 를 약분한 식을 고른다(x≠-a)", extraThinking: "(medium) 분자 인수분해 후 약분", concepts: ["인수분해", "약분"],
    generate(rng) {
      const a = rng.nz(-7, 7), b = rng.nz(-7, 7), v = rng.pick(VARS); if (a === b || a + b === 0) throw new GenFail("x"); const pt = [3, 4, 5].find((p) => p !== -a && p !== -b)!; const num = poly([1, a + b, a * b], v), den = shifted(v, a);
      return finishA(rng, {
        stimulus: intro(rng, v) + M(`\\frac{${num}}{${den}}`) + `, where ${v} is not equal to ${-a}.`, question: q(rng as never, v), evalAt: { [v]: pt }, correctText: M(shifted(v, b)),
        wrongTexts: [{ text: M(shifted(v, -b)), kind: "sign_error", reason: "약분 후 남는 인수의 부호를 반대로 적었다." }, { text: M(shifted(v, a * b)), kind: "formula_misuse", reason: "분자의 상수항을 그대로 남겼다." }, { text: M(shifted(v, a + b)), kind: "formula_misuse", reason: "분자의 x 계수를 약분 결과로 골랐다." }, { text: M(shifted(v, a)), kind: "step_missing", reason: "약분한 인수(분모)를 답으로 골랐다." }, { text: M(poly([1, b - a, a * b], v)), kind: "other", reason: "분모로 약분하지 못했다." }],
        verificationJs: withParams({ a, b, x: pt }, "return (P.x*P.x+(P.a+P.b)*P.x+P.a*P.b)/(P.x+P.a);"),
        trace: [T(`분자를 인수분해한다: $${num} = (${shifted(v, a)})(${shifted(v, b)})$.`, "Factor the numerator."), T(`공통인수 $${den}$ 를 약분한다(${v} ≠ ${-a} 이므로 가능).`, "Cancel the common factor."), T(`남는 식은 $${shifted(v, b)}$ 이다.`, "State what remains.")],
        variant: "cancel_common_factor",
      });
    },
  },
  {
    ...base, id: "ee.rational_equivalence.m_add_same_denominator", kind: "rational_equivalence", difficulty: "medium",
    structure: "분모가 같은 두 분수식의 합을 하나의 분수식으로 정리한다", extraThinking: "(medium) 분자끼리 더하고 분모는 그대로", concepts: ["분수식의 덧셈", "문제 조건 해석"],
    generate(rng) {
      const a = rng.nz(-5, 6), b = rng.nz(-6, 6), c = rng.nz(-5, 6), d = rng.nz(-6, 6), k = rng.int(1, 6), v = rng.pick(VARS); const A = a + c, B = b + d; if (A === 0 || B === 0) throw new GenFail("x");
      const den = shifted(v, k); const fr = (n: string, dd: string) => M(`\\frac{${n}}{${dd}}`);
      return finishA(rng, {
        stimulus: intro(rng, v) + M(`\\frac{${lin(a, b, v)}}{${den}} + \\frac{${lin(c, d, v)}}{${den}}`), question: q(rng as never, v), evalAt: EV(v), correctText: fr(lin(A, B, v), den),
        wrongTexts: [{ text: fr(lin(A, B, v), shifted(v, 2 * k)), kind: "formula_misuse", reason: "분모도 더했다." }, { text: fr(lin(a * c, b * d, v), den), kind: "formula_misuse", reason: "분자를 더하지 않고 곱했다." }, { text: fr(lin(A, b - d, v), den), kind: "sign_error", reason: "분자의 상수항을 빼 버렸다." }, { text: fr(lin(a - c, B, v), den), kind: "sign_error", reason: "분자의 x 항을 빼 버렸다." }, { text: M(lin(A, B, v)), kind: "step_missing", reason: "분모를 빠뜨렸다." }],
        verificationJs: withParams({ a, b, c, d, k, x: 3 }, "return (P.a*P.x+P.b)/(P.x+P.k)+(P.c*P.x+P.d)/(P.x+P.k);"),
        trace: [T("두 분수의 분모가 같으므로 분자끼리 더한다.", "The denominators match, so add the numerators."), T(`분자: (${lin(a, b, v)}) + (${lin(c, d, v)}) = ${lin(A, B, v)}.`, "Add the numerators."), T(`분모는 그대로 $${den}$ 이다.`, "Keep the denominator."), T(`결과는 $\\frac{${lin(A, B, v)}}{${den}}$ 이다.`, "Write the result.")],
        variant: "add_same_denominator",
      });
    },
  },
  {
    ...base, id: "ee.polynomial_distribution.m_area_expression", kind: "polynomial_distribution", difficulty: "medium",
    structure: "직사각형의 가로 (x+a), 세로 (x+b) 로 넓이(또는 둘레)를 나타내는 식을 고른다", extraThinking: "(medium) 문장 → 식(넓이=곱, 둘레=2×합) → 전개", concepts: ["문장 모델링(넓이·둘레)", "식의 전개"],
    generate(rng) {
      const a = rng.int(1, 8), b = rng.int(1, 8), v = rng.pick(VARS); if (a === b) throw new GenFail("x"); const area = rng.chance(0.55);
      const ctx = rng.pick([["garden", "meters"], ["poster", "inches"], ["patio", "feet"], ["banner", "feet"], ["tile", "centimeters"]] as const); const noun = area ? "area" : "perimeter";
      const co = area ? [1, a + b, a * b] : [4, 2 * (a + b)];
      const L = `${v} + ${a}`, Wd = `${v} + ${b}`; const sem = rectSem(noun, L, Wd, { [v]: 3 });
      return finishA(rng, {
        stimulus: `A rectangular ${ctx[0]} has a length of ${M(L)} ${ctx[1]} and a width of ${M(Wd)} ${ctx[1]}, where ${v} is a positive number.`,
        question: spin(rng, area ? `[[Which expression represents the area of the ${ctx[0]}, in square ${ctx[1]}?|Which of the following gives the area of the ${ctx[0]}, in square ${ctx[1]}?|The area of the ${ctx[0]}, in square ${ctx[1]}, is equivalent to which expression?]]` : `[[Which expression represents the perimeter of the ${ctx[0]}, in ${ctx[1]}?|Which of the following gives the perimeter of the ${ctx[0]}, in ${ctx[1]}?|The perimeter of the ${ctx[0]}, in ${ctx[1]}, is equivalent to which expression?]]`), evalAt: EV(v), correctText: E(co, v),
        wrongTexts: area
          ? [{ text: E([1, a + b], v), kind: "step_missing", reason: "넓이를 전개할 때 상수항 ab 를 빠뜨렸다." }, { text: E([2, a + b], v), kind: "geometry_misapplied", reason: "넓이 대신 가로+세로(반둘레)를 골랐다." }, { text: E([4, 2 * (a + b)], v), kind: "geometry_misapplied", reason: "넓이와 둘레를 혼동해 둘레의 식을 골랐다." }, { text: E([1, a * b, a + b], v), kind: "formula_misuse", reason: "x 의 계수와 상수항을 서로 바꿨다." }, { text: E([1, 0, a * b], v), kind: "step_missing", reason: "가운데 항을 빠뜨렸다." }]
          : [{ text: E([4, a + b], v), kind: "step_missing", reason: "둘레 = 2(가로+세로) 에서 2 를 상수항에 곱하지 않았다." }, { text: E([2, a + b], v), kind: "geometry_misapplied", reason: "둘레 대신 가로+세로(반둘레)를 골랐다." }, { text: E([1, a + b, a * b], v), kind: "geometry_misapplied", reason: "둘레와 넓이를 혼동해 넓이의 식을 골랐다." }, { text: E([2, 2 * (a + b)], v), kind: "formula_misuse", reason: "x 의 계수를 2 로만 계산했다(가로·세로 각각 2배)." }, { text: E([4, a * b], v), kind: "formula_misuse", reason: "상수항을 곱 ab 로 계산했다." }],
        verificationJs: withParams({ a, b, area: area ? 1 : 0, x: 3 }, "const L=P.x+P.a, W=P.x+P.b; return P.area? L*W : 2*(L+W);"),
        trace: [T(`가로는 ${v} + ${a}, 세로는 ${v} + ${b} 이다.`, "Read the side lengths."), T(area ? "넓이 = 가로 × 세로 이다." : "둘레 = 2 × (가로 + 세로) 이다.", area ? "Area is length times width." : "Perimeter is twice the sum of length and width."), T(area ? `$(${L})(${Wd})$ 를 전개한다.` : `$2((${L}) + (${Wd}))$ 를 정리한다.`, "Set up the expression."), T(`결과는 $${poly(co, v)}$ 이다.`, "Write the result.")],
        variant: "rectangle_expression", semantics: [sem],
      });
    },
  },
  {
    ...base, id: "ee.polynomial_distribution.m_exponent_rules", kind: "polynomial_distribution", difficulty: "medium",
    structure: "(ax^p)(bx^q) 또는 (ax^p)^q 를 지수 법칙으로 정리한다", extraThinking: "(medium) 계수 곱과 지수 합/곱", concepts: ["지수 법칙", "문제 조건 해석"],
    generate(rng) {
      const v = rng.pick(VARS), prod = rng.chance(0.55); const a = rng.int(2, 4), p = rng.int(2, 4), b = rng.int(2, 4), qq = rng.int(2, 3);
      const mon = (c: number, e: number) => `${c === 1 ? "" : c}${v}${e === 1 ? "" : `^${e}`}`;
      const expr = prod ? `(${mon(a, p)})(${mon(b, qq)})` : `(${mon(a, p)})^${qq}`; const cf = prod ? a * b : a ** qq, ex = prod ? p + qq : p * qq; if (cf > 80) throw new GenFail("x");
      return finishA(rng, {
        stimulus: intro(rng, v) + M(expr), question: q(rng as never, v), evalAt: { [v]: 2 }, correctText: M(mon(cf, ex)),
        wrongTexts: prod
          ? [{ text: M(mon(cf, p * qq)), kind: "formula_misuse", reason: "지수를 더하지 않고 곱했다." }, { text: M(mon(a + b, ex)), kind: "formula_misuse", reason: "계수를 곱하지 않고 더했다." }, { text: M(mon(cf, ex + 1)), kind: "other", reason: "지수 계산 오류." }, { text: M(mon(cf, ex - 1)), kind: "other", reason: "지수 계산 오류." }, { text: M(mon(a * b * 2, ex)), kind: "other", reason: "계수 계산 오류." }]
          : [{ text: M(mon(a * qq, ex)), kind: "formula_misuse", reason: "계수를 거듭제곱하지 않고 곱했다." }, { text: M(mon(cf, p + qq)), kind: "formula_misuse", reason: "지수를 곱하지 않고 더했다." }, { text: M(mon(a, ex)), kind: "step_missing", reason: "계수를 거듭제곱하지 않았다." }, { text: M(mon(cf, ex + 1)), kind: "other", reason: "지수 계산 오류." }, { text: M(mon(cf + a, ex)), kind: "other", reason: "계수 계산 오류." }],
        verificationJs: prod ? withParams({ a, p, b, q: qq, x: 2 }, "return (P.a*Math.pow(P.x,P.p))*(P.b*Math.pow(P.x,P.q));") : withParams({ a, p, q: qq, x: 2 }, "return Math.pow(P.a*Math.pow(P.x,P.p),P.q);"),
        trace: [T(prod ? "계수는 곱하고, 같은 문자의 지수는 더한다." : "괄호 안의 계수와 문자에 각각 지수를 적용한다(계수는 거듭제곱, 지수는 곱).", "Apply the exponent rules."), T(prod ? `${a}·${b} = ${cf}, ${p} + ${qq} = ${ex}.` : `${a}^${qq} = ${cf}, ${p}·${qq} = ${ex}.`, "Compute the coefficient and exponent."), T(`결과는 $${mon(cf, ex)}$ 이다.`, "Write the result.")],
        variant: prod ? "exponent_product" : "exponent_power",
      });
    },
  },
];
