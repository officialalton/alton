// nonlinear_functions easy/medium 원형 — 문장 틀(=유사문항 그룹)을 늘린다. 원형 하나가 그룹 하나(variant 는 틀 이름 하나).
import { GenFail, type Archetype } from "../types";
import { M, spin, withParams, pn } from "../text";
import { quadStr, finishA } from "./a-kit";

const SKILL = "nonlinear_functions";
const T = (ko: string, en: string): [string, string] => [ko, en];
const base = { skill: SKILL, operator: "frame" as const, mediumSteps: 0 };
const GROW = ["bacteria in a culture", "cells in a sample", "followers of an online account", "visitors to a website", "members of an online club", "yeast cells in a dish"] as const;
const TS = [["hours", "hour"], ["days", "day"], ["weeks", "week"], ["months", "month"], ["years", "year"]] as const;

export const NF_EM_ARCHETYPES: Archetype[] = [
  // ───────── easy ─────────
  {
    ...base, id: "nf.evaluate.e_quad_standard", kind: "evaluate", difficulty: "easy",
    structure: "표준형 이차함수 f(x)=ax²+bx+c 에서 작은 양의 정수 x 의 함숫값을 구한다", extraThinking: "(easy) 대입·계산", concepts: ["함숫값"],
    generate(rng) {
      const a = rng.pick([1, 1, 2, 3]), b = rng.int(-6, 6), c = rng.int(-9, 9), p = rng.int(1, 5); const v = a * p * p + b * p + c; if (Math.abs(v) > 99) throw new GenFail("x");
      return finishA(rng, {
        stimulus: spin(rng, `[[The function f is defined by the equation below|Let f be the function defined below|A quadratic function f is given below]]: `) + M(`f(x) = ${quadStr(a, b, c)}`) + ".",
        question: spin(rng, `[[What is the value of f(${p})?|What is f(${p})?|Find f(${p}).]]`), correct: v,
        wrongs: [{ v: a * p * p + b * p, kind: "step_missing", reason: "상수항 c 를 빠뜨렸다." }, { v: a * p + b * p + c, kind: "formula_misuse", reason: "x² 를 x 로 계산했다." }, { v: a * 2 * p + b * p + c, kind: "formula_misuse", reason: "x² 를 2x 로 계산했다." }, { v: (a * p + b) * p + c + a, kind: "other", reason: "계산 오류." }, { v: -v, kind: "sign_error", reason: "부호를 반대로 적었다." }, { v: v + 1, kind: "other", reason: "계산 오류." }],
        verificationJs: withParams({ a, b, c, p }, "return P.a*P.p*P.p+P.b*P.p+P.c;"),
        trace: [T(`x = ${p} 를 대입한다: ${a}·${p}² + ${pn(b)}·${p} + ${pn(c)}.`, "Substitute."), T(`제곱을 먼저 계산하고 곱·합을 한다: ${a * p * p} + ${pn(b * p)} + ${pn(c)}.`, "Square first."), T(`f(${p}) = ${v} 이다.`, "Add.")],
        variant: "quad_standard_eval",
      });
    },
  },
  {
    ...base, id: "nf.evaluate.e_exp_value", kind: "evaluate", difficulty: "easy",
    structure: "지수함수 f(t)=a·b^t 의 작은 t 에서의 값을 구한다", extraThinking: "(easy) 거듭제곱 계산", concepts: ["지수함수의 값"],
    generate(rng) {
      const a = rng.int(2, 9), b = rng.pick([2, 3, 4, 5]), t = rng.int(2, 4); const v = a * b ** t; if (v > 999) throw new GenFail("x"); const g = rng.pick(GROW); const [tu] = rng.pick(TS);
      return finishA(rng, {
        stimulus: `The number of ${g} is modeled by ${M(`N(t) = ${a} \\cdot ${b}^t`)}, where t is the number of ${tu} since the first measurement.`,
        question: spin(rng, `[[What is the value of N(${t})?|What is N(${t})?|According to the model, how many are there after ${t} ${tu}?]]`), correct: v,
        wrongs: [{ v: (a * b) ** t, kind: "formula_misuse", reason: "a·b 를 먼저 곱한 뒤 거듭제곱했다." }, { v: a * b * t, kind: "formula_misuse", reason: "거듭제곱 대신 곱셈으로 계산했다." }, { v: a * b ** (t - 1), kind: "step_missing", reason: "지수를 하나 적게 셌다." }, { v: a * b ** (t + 1), kind: "step_missing", reason: "지수를 하나 많게 셌다." }, { v: a + b ** t, kind: "formula_misuse", reason: "곱 대신 합으로 계산했다." }, { v: a * t ** b, kind: "formula_misuse", reason: "밑과 지수를 바꿔 계산했다." }],
        verificationJs: withParams({ a, b, t }, "return P.a*Math.pow(P.b,P.t);"),
        trace: [T(`t = ${t} 를 대입한다: N(${t}) = ${a}·${b}^${t}.`, "Substitute."), T(`거듭제곱을 먼저 계산한다: ${b}^${t} = ${b ** t}.`, "Evaluate the power first."), T(`${a}·${b ** t} = ${v} 이다.`, "Multiply.")],
        variant: "exp_value",
      });
    },
  },
  {
    ...base, id: "nf.vertex_x.e_standard_formula", kind: "vertex_x", difficulty: "easy",
    structure: "표준형 이차함수의 꼭짓점 x 좌표 -b/(2a) 를 구한다(정수)", extraThinking: "(easy) 꼭짓점 공식 한 번", concepts: ["꼭짓점 공식"],
    generate(rng) {
      const a = rng.pick([1, 1, 2, -1, -2]), h = rng.nz(-6, 7), b = -2 * a * h, c = rng.int(-9, 9); if (Math.abs(b) > 30) throw new GenFail("x");
      return finishA(rng, {
        stimulus: spin(rng, `[[The function f is defined by the equation below|Let f be the function defined below|A quadratic function f is given below]]: `) + M(`f(x) = ${quadStr(a, b, c)}`) + ".",
        question: spin(rng, "[[What is the x-coordinate of the vertex of the graph of f in the xy-plane?|What is the x-coordinate of the vertex of the graph of y = f(x)?|At what value of x does the graph of f have its vertex?]]"), correct: h,
        wrongs: [{ v: -h, kind: "sign_error", reason: "꼭짓점 공식 -b/(2a) 의 부호를 놓쳤다." }, { v: b / a, kind: "formula_misuse", reason: "분모의 2 를 빠뜨렸다." }, { v: -b / a, kind: "formula_misuse", reason: "분모의 2 를 빠뜨리고 부호만 바꿨다." }, { v: -b, kind: "step_missing", reason: "2a 로 나누지 않았다." }, { v: c, kind: "axis_misread", reason: "상수항(y절편)을 답으로 골랐다." }, { v: h + 1, kind: "other", reason: "계산 오류." }],
        verificationJs: withParams({ a, b, c }, "let best=null, bx=null; for(let x=-100;x<=100;x++){ const y=P.a*x*x+P.b*x+P.c; if(best===null||(P.a>0? y<best : y>best)){ best=y; bx=x; } } return bx;"),
        trace: [T("꼭짓점의 x 좌표는 -b/(2a) 이다.", "Use the vertex formula."), T(`-(${b})/(2·${pn(a)}) 를 계산한다.`, "Substitute."), T(`x = ${h} 이다.`, "Simplify.")],
        variant: "vertex_x_formula",
      });
    },
  },
  {
    ...base, id: "nf.find_x_for_value.e_exp_solve", kind: "find_x_for_value", difficulty: "easy",
    structure: "a·b^t = V 에서 거듭제곱을 맞춰 t 를 구한다", extraThinking: "(easy) 지수 방정식 한 번", concepts: ["지수 방정식"],
    generate(rng) {
      const a = rng.int(1, 9), b = rng.pick([2, 3, 4, 5]), t = rng.int(1, 4); const v = a * b ** t; if (v > 999) throw new GenFail("x"); const g = rng.pick(GROW); const [tu] = rng.pick(TS);
      return finishA(rng, {
        stimulus: `The number of ${g} is modeled by ${M(`N(t) = ${a} \\cdot ${b}^t`)}, where t is the number of ${tu} since the first measurement.`,
        question: spin(rng, `[[For what value of t is N(t) equal to ${v}?|At what time t does the model give ${v}?|Find the value of t for which N(t) = ${v}.]]`), correct: t,
        wrongs: [{ v: t + 1, kind: "other", reason: "지수를 하나 크게 셌다." }, { v: Math.max(0, t - 1), kind: "other", reason: "지수를 하나 작게 셌다." }, { v: v / a, kind: "step_missing", reason: "b^t 의 값을 t 로 골랐다." }, { v: v / (a * b), kind: "formula_misuse", reason: "a·b 로 나눈 값을 t 로 골랐다." }, { v: Math.round(v / b), kind: "formula_misuse", reason: "b 로 나눈 값을 t 로 골랐다." }, { v: b * t, kind: "formula_misuse", reason: "지수와 밑을 곱했다." }],
        verificationJs: withParams({ a, b, v }, "const hits=[]; for(let t=0;t<=40;t++) if(P.a*Math.pow(P.b,t)===P.v) hits.push(t); if(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];"),
        trace: [T(`${a}·${b}^t = ${v} 이므로 ${b}^t = ${v / a} 이다.`, "Isolate the exponential."), T(`${v / a} = ${b}^${t} 이다.`, "Write as a power."), T(`t = ${t} 이다.`, "Read the exponent.")],
        variant: "exp_solve",
      });
    },
  },

  // ───────── medium ─────────
  {
    ...base, id: "nf.evaluate.m_negative_input", kind: "evaluate", difficulty: "medium",
    structure: "음수 x 에서 ax²+bx+c 의 함숫값을 구한다(부호 처리)", extraThinking: "(medium) 음수 대입과 제곱의 부호", concepts: ["함숫값", "부호 처리"],
    generate(rng) {
      const a = rng.pick([1, 2, 3, -1, -2]), b = rng.nz(-7, 7), c = rng.int(-9, 9), p = -rng.int(1, 5); const v = a * p * p + b * p + c; if (Math.abs(v) > 120) throw new GenFail("x");
      return finishA(rng, {
        stimulus: spin(rng, `[[The function f is defined by the equation below|Let f be the function defined below|A quadratic function f is given below]]: `) + M(`f(x) = ${quadStr(a, b, c)}`) + ".",
        question: spin(rng, `[[What is the value of f(${p})?|What is f(${p})?|Find f(${p}).]]`), correct: v,
        wrongs: [{ v: -a * p * p + b * p + c, kind: "sign_error", reason: "(-p)² 를 음수로 계산했다." }, { v: a * p * p - b * p + c, kind: "sign_error", reason: "bx 항의 부호를 놓쳤다(b·(-p) 를 +b·p 로)." }, { v: a * p * p + b * p, kind: "step_missing", reason: "상수항 c 를 빠뜨렸다." }, { v: a * p + b * p + c, kind: "formula_misuse", reason: "x² 를 x 로 계산했다." }, { v: -v, kind: "sign_error", reason: "부호를 반대로 적었다." }, { v: a * -p * -p - b * p + c + 0, kind: "sign_error", reason: "부호 처리 오류." }],
        verificationJs: withParams({ a, b, c, p }, "return P.a*P.p*P.p+P.b*P.p+P.c;"),
        trace: [T(`x = ${p} 를 대입한다: ${a}·(${p})² + ${pn(b)}·(${p}) + ${pn(c)}.`, "Substitute the negative input."), T(`(${p})² = ${p * p} 이므로 ${a * p * p} + ${pn(b * p)} + ${pn(c)} 이다.`, "A negative squared is positive."), T(`f(${p}) = ${v} 이다.`, "Add.")],
        variant: "negative_input_eval",
      });
    },
  },
  {
    ...base, id: "nf.evaluate.m_function_difference", kind: "evaluate", difficulty: "medium",
    structure: "f(p) - f(q) 를 구한다(두 번의 함숫값과 뺄셈)", extraThinking: "(medium) 두 함숫값의 차", concepts: ["함숫값", "차 계산"],
    generate(rng) {
      const a = rng.pick([1, 2, 3, -1]), b = rng.int(-6, 6), c = rng.int(-9, 9), p = rng.int(2, 6), q = rng.int(-3, 1); const f = (x: number) => a * x * x + b * x + c; const v = f(p) - f(q); if (Math.abs(v) > 150 || v === 0) throw new GenFail("x");
      return finishA(rng, {
        stimulus: spin(rng, `[[The function f is defined by the equation below|Let f be the function defined below|A quadratic function f is given below]]: `) + M(`f(x) = ${quadStr(a, b, c)}`) + ".",
        question: spin(rng, `[[What is the value of f(${p}) - f(${q})?|What is f(${p}) minus f(${q})?|Find f(${p}) - f(${q}).]]`), correct: v,
        wrongs: [{ v: -v, kind: "sign_error", reason: "뺄셈의 순서를 바꿨다." }, { v: f(p) + f(q), kind: "sign_error", reason: "차 대신 합을 구했다." }, { v: f(p), kind: "step_missing", reason: "f(p) 만 구했다." }, { v: f(p - q), kind: "formula_misuse", reason: "f(p) - f(q) 를 f(p - q) 로 계산했다." }, { v: a * (p * p - q * q), kind: "step_missing", reason: "이차항만 비교했다." }, { v: v + 1, kind: "other", reason: "계산 오류." }],
        verificationJs: withParams({ a, b, c, p, q }, "const f=x=>P.a*x*x+P.b*x+P.c; return f(P.p)-f(P.q);"),
        trace: [T(`f(${p}) = ${f(p)} 이다.`, "Evaluate f at the first input."), T(`f(${q}) = ${f(q)} 이다.`, "Evaluate f at the second input."), T(`차는 ${f(p)} - ${pn(f(q))} = ${v} 이다.`, "Subtract.")],
        variant: "function_difference",
      });
    },
  },
  {
    ...base, id: "nf.vertex_x.m_symmetry_points", kind: "vertex_x", difficulty: "medium",
    structure: "포물선이 높이가 같은 두 점 (p, y₀), (q, y₀) 을 지날 때 꼭짓점의 x 좌표를 구한다", extraThinking: "(medium) 대칭축은 두 점의 중점", concepts: ["포물선의 대칭"],
    generate(rng) {
      const p = rng.int(-8, 4), q = rng.int(p + 2, 12); if ((p + q) % 2 !== 0) throw new GenFail("x"); const y0 = rng.int(-9, 9); const h = (p + q) / 2; if (Math.abs(h) < 1) throw new GenFail("x");
      return finishA(rng, {
        stimulus: spin(rng, `[[A parabola in the xy-plane passes through the points (${p}, ${y0}) and (${q}, ${y0})|The graph of a quadratic function in the xy-plane contains the points (${p}, ${y0}) and (${q}, ${y0})|Two points on the graph of a quadratic function are (${p}, ${y0}) and (${q}, ${y0})]]. `),
        question: spin(rng, "[[What is the x-coordinate of the vertex of the parabola?|What is the x-coordinate of the vertex of the graph?|At what value of x does the graph have its vertex?]]"), correct: h,
        wrongs: [{ v: p + q, kind: "formula_misuse", reason: "두 x 좌표의 합을 골랐다(2 로 나누지 않음)." }, { v: (q - p) / 2, kind: "formula_misuse", reason: "두 점 사이 거리의 절반을 골랐다." }, { v: y0, kind: "axis_misread", reason: "y 좌표를 골랐다." }, { v: -h, kind: "sign_error", reason: "부호를 반대로 적었다." }, { v: h + 1, kind: "other", reason: "계산 오류." }, { v: q - p, kind: "formula_misuse", reason: "두 점 사이 거리를 골랐다." }],
        verificationJs: withParams({ p, q, y0 }, "const hits=[]; for(let h=-60;h<=60;h++){ if(P.p-h===-(P.q-h)) hits.push(h); } if(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];"),
        trace: [T("높이가 같은 두 점은 대칭축에 대해 서로 대칭이다.", "Equal heights mean the points are symmetric."), T(`대칭축은 두 점의 중점 x = (${p} + ${pn(q)})/2 이다.`, "Take the midpoint."), T(`꼭짓점의 x 좌표는 ${h} 이다.`, "The vertex lies on the axis.")],
        variant: "symmetric_points_vertex",
      });
    },
  },
  {
    ...base, id: "nf.vertex_y.m_min_value_standard", kind: "vertex_y", difficulty: "medium",
    structure: "표준형 이차함수의 최솟값(최댓값)을 완전제곱식 또는 꼭짓점 대입으로 구한다", extraThinking: "(medium) 꼭짓점 y 값", concepts: ["꼭짓점", "완전제곱식"],
    generate(rng) {
      const a = rng.pick([1, 1, 2, -1, -2]), h = rng.nz(-6, 7), c = rng.int(-9, 9), b = -2 * a * h; if (Math.abs(b) > 30) throw new GenFail("x"); const v = c - a * h * h; if (Math.abs(v) > 200) throw new GenFail("x"); const L = a > 0 ? "minimum" : "maximum";
      return finishA(rng, {
        stimulus: spin(rng, `[[The function f is defined by the equation below|Let f be the function defined below|A quadratic function f is given below]]: `) + M(`f(x) = ${quadStr(a, b, c)}`) + ".",
        question: spin(rng, `[[What is the ${L} value of f?|What is the ${L} value of the function f?|Find the ${L} value of f.]]`), correct: v,
        wrongs: [{ v: h, kind: "axis_misread", reason: "꼭짓점의 x 좌표를 골랐다." }, { v: c, kind: "step_missing", reason: "y절편을 골랐다." }, { v: c + a * h * h, kind: "sign_error", reason: "f(h) 에서 b 항의 부호를 놓쳤다." }, { v: -v, kind: "sign_error", reason: "부호를 반대로 적었다." }, { v: c - a * h, kind: "formula_misuse", reason: "h 를 제곱하지 않았다." }, { v: c - b * b / 4, kind: "formula_misuse", reason: "a 로 나누지 않고 b²/4 를 뺐다." }],
        verificationJs: withParams({ a, b, c }, "let best=null; for(let x=-100;x<=100;x++){ const y=P.a*x*x+P.b*x+P.c; if(best===null||(P.a>0? y<best : y>best)) best=y; } return best;"),
        trace: [T(`꼭짓점의 x 좌표는 -(${b})/(2·${pn(a)}) = ${h} 이다.`, "Find the vertex x."), T(`f(${h}) = ${a}·${h * h} + ${pn(b)}·${pn(h)} + ${pn(c)} 를 계산한다.`, "Substitute into f."), T(`${a > 0 ? "최솟값" : "최댓값"}은 ${v} 이다.`, "State the extreme value.")],
        variant: "extreme_value_standard",
      });
    },
  },
  {
    ...base, id: "nf.vertex_y.m_max_projectile", kind: "vertex_y", difficulty: "medium",
    structure: "h(t) = at²+bt+c (a<0) 로 모델된 높이의 최대값을 문맥에서 구한다", extraThinking: "(medium) 꼭짓점 y 값의 문맥 해석", concepts: ["꼭짓점", "문맥 해석"],
    generate(rng) {
      const a = rng.pick([-1, -2, -3]), h = rng.int(1, 5), c = rng.int(1, 20), b = -2 * a * h; const v = c - a * h * h; if (v > 200) throw new GenFail("x");
      const ctx = rng.pick([["A ball is thrown upward from a platform", "ball", "after it is thrown"], ["A model rocket is launched from a small hill", "rocket", "after it is launched"], ["A diver jumps upward from a springboard", "diver", "after the jump begins"], ["A water balloon is launched from a rooftop", "balloon", "after it is launched"], ["A soccer ball is kicked from a raised field", "ball", "after it is kicked"]] as const);
      return finishA(rng, {
        stimulus: `${ctx[0]}. The height of the ${ctx[1]}, in feet, t seconds ${ctx[2]} is modeled by ${M(`h(t) = ${quadStr(a, b, c, "t")}`)}, for t ≥ 0 until it lands.`,
        question: spin(rng, `[[What is the maximum height, in feet, of the ${ctx[1]}?|What is the greatest height, in feet, that the ${ctx[1]} reaches?|According to the model, what is the maximum height of the ${ctx[1]}, in feet?]]`), correct: v,
        wrongs: [{ v: h, kind: "axis_misread", reason: "최대 높이가 되는 시각을 골랐다." }, { v: c, kind: "step_missing", reason: "처음 높이(y절편)를 골랐다." }, { v: c + a * h * h, kind: "sign_error", reason: "h(t) 에서 b 항의 부호를 놓쳤다." }, { v: c - a * h, kind: "formula_misuse", reason: "t 를 제곱하지 않았다." }, { v: v + b, kind: "other", reason: "계산 오류." }, { v: -v, kind: "sign_error", reason: "부호를 반대로 적었다." }],
        verificationJs: withParams({ a, b, c }, "let best=null; for(let t=0;t<=100;t++){ const y=P.a*t*t+P.b*t+P.c; if(best===null||y>best) best=y; } return best;"),
        trace: [T(`최고차 계수 ${a} < 0 이므로 꼭짓점에서 최댓값을 갖는다.`, "The parabola opens downward."), T(`꼭짓점의 시각 t = -${b}/(2·${pn(a)}) = ${h} 이다.`, "Find the time of the maximum."), T(`h(${h}) = ${a}·${h * h} + ${b}·${h} + ${c} 를 계산한다.`, "Substitute."), T(`최대 높이는 ${v} 피트이다.`, "State the answer.")],
        variant: "projectile_max_height",
      });
    },
  },
  {
    ...base, id: "nf.find_x_for_value.m_exp_double_period", kind: "find_x_for_value", difficulty: "medium",
    structure: "시작량 a 가 매 τ 단위마다 두 배가 될 때 값 V 에 도달하는 시간을 구한다", extraThinking: "(medium) 배가 횟수 × 주기", concepts: ["지수 성장", "주기"],
    generate(rng) {
      const a = rng.int(2, 15), k = rng.int(2, 6), tau = rng.int(2, 8); const V = a * 2 ** k; if (V > 999) throw new GenFail("x"); const g = rng.pick(GROW); const [tu] = rng.pick(TS); const ans = k * tau;
      return finishA(rng, {
        stimulus: `There are ${a} ${g} at the start of an experiment. The number doubles every ${tau} ${tu}.`,
        question: spin(rng, `[[After how many ${tu} will there be ${V}?|How many ${tu} does it take to reach ${V}?|At what time, in ${tu}, will the number first be ${V}?]]`), correct: ans,
        wrongs: [{ v: k, kind: "step_missing", reason: "배가 횟수만 구하고 주기를 곱하지 않았다." }, { v: V / a, kind: "step_missing", reason: "배율(2^k)을 시간으로 골랐다." }, { v: tau * (V / a), kind: "formula_misuse", reason: "배율 2^k 에 주기를 곱했다(지수로 세지 않음)." }, { v: tau * (k + 1), kind: "step_missing", reason: "배가 횟수를 하나 많게 셌다." }, { v: tau * (k - 1), kind: "step_missing", reason: "배가 횟수를 하나 적게 셌다." }, { v: tau + k, kind: "formula_misuse", reason: "곱 대신 합으로 계산했다." }],
        verificationJs: withParams({ a, tau, V }, "const hits=[]; for(let k=0;k<=30;k++) if(P.a*Math.pow(2,k)===P.V) hits.push(k*P.tau); if(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];"),
        trace: [T(`${V}/${a} = ${V / a} = 2^${k} 이므로 ${k} 번 두 배가 된다.`, "Count the doublings."), T(`한 번에 ${tau} ${tu} 이므로 ${k}·${tau} 이다.`, "Multiply by the doubling period."), T(`시간은 ${ans} ${tu} 이다.`, "State the time.")],
        variant: "doubling_time",
      });
    },
  },
  {
    ...base, id: "nf.interpret_a.m_initial_amount", kind: "interpret_a", difficulty: "medium",
    structure: "N(t)=a·b^t (b 정수)에서 n 기간 후의 값 V 로 초기값 a 를 구한다", extraThinking: "(medium) V 를 b^n 으로 나눔(초기값 해석)", concepts: ["지수함수의 초기값"],
    generate(rng) {
      const a = rng.int(2, 25), b = rng.pick([2, 3, 4]), n = rng.int(2, 4); const V = a * b ** n; if (V > 999) throw new GenFail("x"); const g = rng.pick(GROW); const [tu] = rng.pick(TS);
      return finishA(rng, {
        stimulus: `The number of ${g} is modeled by ${M(`N(t) = a \\cdot ${b}^t`)}, where a is a positive constant and t is the number of ${tu} since the first measurement. The model gives N(${n}) = ${V}.`,
        question: spin(rng, "[[What is the value of a, the number at the first measurement?|What does the model give for the number at t = 0?|What is the initial value of N?]]"), correct: a,
        wrongs: [{ v: V / n, kind: "formula_misuse", reason: "지수 b^n 대신 n 으로 나눴다." }, { v: V / b, kind: "formula_misuse", reason: "b^n 대신 b 로 나눴다." }, { v: V / b ** (n - 1), kind: "step_missing", reason: "지수를 하나 적게 셌다." }, { v: V / b ** (n + 1), kind: "step_missing", reason: "지수를 하나 많게 셌다." }, { v: V - b ** n, kind: "formula_misuse", reason: "곱 대신 합으로 계산했다." }, { v: V, kind: "step_missing", reason: "V 를 그대로 초기값으로 골랐다." }],
        verificationJs: withParams({ b, n, V }, "const hits=[]; for(let a=1;a<=400;a++) if(a*Math.pow(P.b,P.n)===P.V) hits.push(a); if(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];"),
        trace: [T(`N(${n}) = a·${b}^${n} = ${b ** n}a = ${V} 이다.`, "Use the given value."), T(`a = ${V}/${b ** n} = ${a} 이다.`, "Solve for a."), T("a 는 t = 0 일 때의 값이다.", "a is the initial value.")],
        variant: "initial_amount",
      });
    },
  },
  {
    ...base, id: "nf.interpret_b.m_growth_percent", kind: "interpret_b", difficulty: "medium",
    structure: "f(t)=a·b^t (b 는 소수 한 자리)에서 기간당 증가율·감소율(%)을 읽는다", extraThinking: "(medium) 밑 b 에서 |b-1|×100", concepts: ["성장·감소율", "퍼센트"],
    generate(rng) {
      const b = rng.pick([1.1, 1.2, 1.3, 1.5, 1.8, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4]); const a = rng.int(2, 90); const up = b > 1; const ans = Math.round(Math.abs(b - 1) * 100); const g = rng.pick(["value of an investment", "population of a town", "number of subscribers", "value of a used car", "amount of a medicine in the body"] as const); const [tu, tun] = rng.pick([["years", "year"], ["months", "month"], ["weeks", "week"], ["days", "day"]] as const);
      return finishA(rng, {
        stimulus: `The ${g} is modeled by ${M(`f(t) = ${a}(${b})^t`)}, where t is the number of ${tu} since the model starts.`,
        question: up ? spin(rng, `[[By what percent does the ${g.replace(/^(value|population|number|amount)/, "$1")} increase each ${tun}?|The model says it increases by what percent each ${tun}?|What is the percent increase per ${tun}?]]`) : spin(rng, `[[By what percent does the ${g.replace(/^(value|population|number|amount)/, "$1")} decrease each ${tun}?|The model says it decreases by what percent each ${tun}?|What is the percent decrease per ${tun}?]]`), correct: ans,
        wrongs: [{ v: Math.round(b * 100), kind: "step_missing", reason: "배율 b 의 백분율을 변화율로 골랐다(1 을 빼지 않음)." }, { v: up ? Math.round((2 - b) * 100) : Math.round((2 - b) * 100) - 100 + 100, kind: "opposite", reason: "증가/감소 방향을 반대로 해석했다." }, { v: Math.round(Math.abs(b - 1) * 10), kind: "formula_misuse", reason: "퍼센트 환산에서 100 대신 10 을 곱했다." }, { v: a, kind: "step_missing", reason: "초기값 a 를 골랐다." }, { v: ans + 10, kind: "other", reason: "계산 오류." }, { v: Math.max(1, ans - 10), kind: "other", reason: "계산 오류." }],
        verificationJs: withParams({ a, b }, "return Math.round(Math.abs(P.b-1)*100);"),
        trace: [T(`밑 b = ${b} 는 매 기간 곱해지는 배율이다.`, "b is the per-period factor."), T(`${b} ${up ? ">" : "<"} 1 이므로 ${up ? "증가" : "감소"}한다.`, "Decide increase or decrease."), T(`변화율은 |${b} - 1|·100 = ${ans}% 이다.`, "Convert to a percent.")],
        variant: "growth_percent",
      });
    },
  },
];
