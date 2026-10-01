// linear_functions easy/medium 원형(문장 틀 = 유사문항 그룹). easy 3 + medium 5.
import { GenFail, type Archetype } from "../types";
import { finish, lin, M, spin, withParams } from "../text";
import { LMS, near, T, W } from "../kit-b";

const SKILL = "linear_functions";
const base = { skill: SKILL, operator: "frame" as const, mediumSteps: 0 };
const NAMES = ["f", "g", "h", "p", "q", "r", "u", "v"] as const;
const VARS = ["x", "t", "n", "m", "w"] as const;
const pr = (n: number) => (n < 0 ? `(${n})` : String(n));
const gcdN = (a: number, b: number): number => (b ? gcdN(b, a % b) : Math.abs(a));
const fq = (a: number, b: number) => (a === 1 ? "" : a === -1 ? "-" : a);

export const LF_EM_ARCHETYPES: Archetype[] = [
  // ---------- easy ----------
  {
    ...base, id: "lf.evaluate.e_plug_in", kind: "evaluate", difficulty: "easy",
    structure: "일차함수의 식이 주어졌을 때 함수값 하나를 계산", extraThinking: "easy 틀", concepts: ["함수값 계산"],
    generate(rng) {
      const a = rng.nz(-6, 7), b = rng.nz(-12, 12), k = rng.nz(-6, 9), n = rng.pick(NAMES), v = rng.pick(VARS), ans = a * k + b;
      const def = M(`${n}(${v}) = ${lin(a, b, v)}`);
      const stimulus = rng.pick([`The function ${n} is defined by ${def}.`, `Let ${def}.`, `A linear function is given by ${def}.`, `Consider the function ${def}.`, `The rule ${def} defines a function.`, `A function ${n} follows ${def}.`, `For the linear function ${def}, an input is chosen.`]);
      return finish(rng, {
        stimulus, question: spin(rng, `[[What is the value of $${n}(${k})$?|What is $${n}(${k})$?|Find $${n}(${k})$.|What does $${n}(${k})$ equal?|Evaluate $${n}(${k})$.|What is the output when the input is ${k}?]]`), correct: ans,
        wrongs: [W(a + k + b, "formula_misuse", "곱하지 않고 더했다."), W(a * k - b, "sign_error", "상수항의 부호를 바꿨다."), W(-a * k + b, "sign_error", "입력의 부호를 바꿨다."), W(a * k, "step_missing", "상수항을 더하지 않았다."), ...near(ans)],
        verificationJs: withParams({ a, b, k }, "return P.a*P.k+P.b;"),
        trace: [T(`${v} 에 ${k} 를 대입하면 $${a}\\cdot ${pr(k)} ${b >= 0 ? "+" : "-"} ${Math.abs(b)}$ 이다.`, "Substitute."), T(`계산하면 ${ans} 이다.`, "Evaluate.")],
        variant: "plug_in",
      });
    },
  },
  {
    ...base, id: "lf.find_x_for_value.e_solve_for_input", kind: "find_x_for_value", difficulty: "easy",
    structure: "함수값이 주어졌을 때 일차식을 풀어 입력 x 를 구한다", extraThinking: "easy 틀", concepts: ["일차방정식", "출력값에서 입력 역산"],
    generate(rng) {
      const a = rng.nz(-6, 7), b = rng.nz(-12, 12), x0 = rng.nz(-8, 10), n = rng.pick(NAMES), v = rng.pick(VARS), out = a * x0 + b; if (Math.abs(out) > 80) throw new GenFail("x");
      const def = M(`${n}(${v}) = ${lin(a, b, v)}`);
      const stimulus = rng.pick([`The function ${n} is defined by ${def}.`, `Let ${def}.`, `A linear function is given by ${def}.`, `Consider the function ${def}.`, `The rule ${def} defines a function.`, `A function ${n} follows ${def}.`]);
      return finish(rng, {
        stimulus, question: spin(rng, `[[For what value of ${v} does $${n}(${v}) = ${out}$?|What value of ${v} gives an output of ${out}?|If $${n}(${v}) = ${out}$, what is ${v}?|Find ${v} such that $${n}(${v}) = ${out}$.|Which input produces the output ${out}?|What input ${v} makes ${n} equal ${out}?]]`), correct: x0,
        wrongs: [W(-x0, "sign_error", "이항할 때 부호를 바꾸지 않았다."), W(out - b, "step_missing", "계수로 나누지 않았다."), W((out + b) / a, "sign_error", "상수항을 더해 이항했다."), W(out / a - b, "step_missing", "이항 전에 나눴다."), ...near(x0)],
        verificationJs: withParams({ a, b, out }, "const s=[];\nfor(let x=-300;x<=300;x++) if(P.a*x+P.b===P.out) s.push(x);\nif(s.length!==1) throw new Error('유일하지 않음');\nreturn s[0];"),
        trace: [T(`$${lin(a, b, v)} = ${out}$ 로 놓는다.`, "Set the output."), T(`상수를 이항하면 $${a}${v} = ${out - b}$ 이다.`, "Move the constant."), T(`${a} 로 나누면 ${v} = ${x0} 이다.`, "Divide.")],
        variant: "solve_for_input",
      });
    },
  },
  {
    ...base, id: "lf.slope_from_two_points.e_two_points", kind: "slope_from_two_points", difficulty: "easy",
    structure: "두 점의 좌표로 기울기(정수)를 구한다", extraThinking: "easy 틀", concepts: ["기울기 공식"],
    generate(rng) {
      const m = rng.nz(-6, 7), x1 = rng.int(-5, 3), dx = rng.int(1, 5), y1 = rng.int(-8, 8), x2 = x1 + dx, y2 = y1 + m * dx; if (Math.abs(y2) > 30) throw new GenFail("x");
      const A = M(`(${x1}, ${y1})`), B = M(`(${x2}, ${y2})`), L = rng.pick(["ℓ", "m", "k", "n", "j"]);
      const stimulus = rng.pick([`In the xy-plane, line ${L} passes through the points ${A} and ${B}.`, `Line ${L} contains the points ${A} and ${B}.`, `A line ${L} goes through ${A} and ${B}.`, `The points ${A} and ${B} lie on line ${L}.`, `Line ${L} is drawn through ${A} and ${B}.`, `Two points on line ${L} are ${A} and ${B}.`]);
      return finish(rng, {
        stimulus, question: spin(rng, `[[What is the slope of line ${L}?|Find the slope of line ${L}.|What is the slope of the line?|How steep is line ${L}? Give its slope.|What is the rate of change of line ${L}?|What slope does line ${L} have?]]`), correct: m,
        wrongs: [W(-m, "sign_error", "기울기의 부호를 반대로 구했다."), W(Math.round((x2 - x1) / (y2 - y1) * 100) / 100, "formula_misuse", "기울기를 거꾸로(Δx/Δy) 계산했다."), W(y2 - y1, "step_missing", "x 의 변화량으로 나누지 않았다."), W(y2 - y1 + (x2 - x1), "formula_misuse", "변화량을 더했다."), ...near(m)],
        verificationJs: withParams({ x1, y1, x2, y2 }, "return (P.y2-P.y1)/(P.x2-P.x1);"),
        trace: [T(`y 의 변화량은 ${y2} - ${pr(y1)} = ${y2 - y1} 이다.`, "Find the rise."), T(`x 의 변화량은 ${x2} - ${pr(x1)} = ${dx} 이다.`, "Find the run."), T(`기울기는 ${y2 - y1}/${dx} = ${m} 이다.`, "Divide.")],
        variant: "two_points",
      });
    },
  },
  // ---------- medium ----------
  {
    ...base, id: "lf.evaluate.m_expression_value", kind: "evaluate", difficulty: "medium",
    structure: "함수값을 둘 이상 계산해 f(p)+f(q), f(p)−f(q), 2f(p)+c, f(p+q) 같은 식의 값을 구한다", extraThinking: "medium 틀", concepts: ["함수값 계산", "식의 값"],
    generate(rng) {
      const a = rng.nz(-5, 6), b = rng.nz(-9, 9), p = rng.int(-4, 6), q = rng.int(-4, 6), n = rng.pick(NAMES), v = rng.pick(VARS), kind = rng.pick(["sum", "diff", "twice", "shift"] as const), c = rng.nz(-6, 7);
      const f = (x: number) => a * x + b; if (p === q) throw new GenFail("x");
      const expr = kind === "sum" ? `${n}(${p}) + ${n}(${q})` : kind === "diff" ? `${n}(${p}) - ${n}(${q})` : kind === "twice" ? `2${n}(${p}) ${c >= 0 ? "+" : "-"} ${Math.abs(c)}` : `${n}(${p} + ${q})`;
      const ans = kind === "sum" ? f(p) + f(q) : kind === "diff" ? f(p) - f(q) : kind === "twice" ? 2 * f(p) + c : f(p + q); if (Math.abs(ans) > 120) throw new GenFail("x");
      const def = M(`${n}(${v}) = ${lin(a, b, v)}`);
      return finish(rng, {
        stimulus: rng.pick([`The function ${n} is defined by ${def}.`, `Let ${def}.`, `A linear function is given by ${def}.`, `Consider the function ${def}.`, `The rule ${def} defines a function.`]), question: spin(rng, `[[What is the value of $${expr}$?|Find the value of $${expr}$.|What does $${expr}$ equal?|Evaluate $${expr}$.|What is $${expr}$?]]`), correct: ans,
        wrongs: [W(kind === "sum" ? f(p + q) : kind === "diff" ? f(p) + f(q) : kind === "twice" ? 2 * (f(p) + c) : f(p) + f(q), "formula_misuse", "함수의 선형성을 잘못 적용했다(상수항이 합·곱에서 어떻게 처리되는지 놓쳤다)."), W(kind === "twice" ? f(p) + c : kind === "shift" ? f(p) + q : f(p), "step_missing", "한 단계를 빠뜨렸다."), W(-ans, "sign_error", "부호를 잘못 처리했다."), W(kind === "diff" ? f(q) - f(p) : ans + b, "sign_error", "순서를 바꿨거나 상수항을 한 번 더 더했다."), ...near(ans)],
        verificationJs: withParams({ a, b, p, q: kind === "twice" ? 0 : q, c: kind === "twice" ? c : 0, kind }, "const f=x=>P.a*x+P.b;\nif(P.kind==='sum') return f(P.p)+f(P.q);\nif(P.kind==='diff') return f(P.p)-f(P.q);\nif(P.kind==='twice') return 2*f(P.p)+P.c;\nreturn f(P.p+P.q);"),
        trace: [T(`필요한 입력에 대한 함수값을 각각 계산한다.`, "Evaluate each needed value."), T(`$${n}(${p}) = ${f(p)}$${kind === "sum" || kind === "diff" ? `, $${n}(${q}) = ${f(q)}$` : ""} 이다.`, "Compute."), T(`식에 대입해 계산하면 ${ans} 이다.`, "Combine.")],
        variant: "expression_of_values",
      });
    },
  },
  {
    ...base, id: "lf.find_x_for_value.m_fraction_slope", kind: "find_x_for_value", difficulty: "medium",
    structure: "분수 기울기의 일차함수 f(x) = (a/b)x + c 에서 함수값으로 x 를 구한다", extraThinking: "medium 틀", concepts: ["분수 기울기", "일차방정식"],
    generate(rng) {
      const den = rng.int(2, 5), num = rng.nz(-5, 6), c = rng.nz(-9, 9), x0 = den * rng.nz(-4, 5), n = rng.pick(NAMES), v = rng.pick(VARS), out = (num * x0) / den + c; if (Math.abs(out) > 60 || gcdN(num, den) !== 1) throw new GenFail("x");
      const fr = `${num < 0 ? "-" : ""}\\frac{${Math.abs(num)}}{${den}}`; const def = M(`${n}(${v}) = ${fr}${v} ${c >= 0 ? "+" : "-"} ${Math.abs(c)}`);
      return finish(rng, {
        stimulus: rng.pick([`The function ${n} is defined by ${def}.`, `Let ${def}.`, `A linear function with a fractional slope is given by ${def}.`, `Consider the function ${def}.`, `The rule ${def} defines a function.`]), question: spin(rng, `[[For what value of ${v} does $${n}(${v}) = ${out}$?|What value of ${v} gives an output of ${out}?|If $${n}(${v}) = ${out}$, what is ${v}?|Find ${v} such that $${n}(${v}) = ${out}$.|Which input produces the output ${out}?]]`), correct: x0,
        wrongs: [W(-x0, "sign_error", "부호를 잘못 처리했다."), W((out - c) * num / den, "formula_misuse", "분수 기울기로 나누지 않고 곱했다."), W((out + c) * den / num, "sign_error", "상수항을 더해 이항했다."), W((out - c) * den, "step_missing", "분자로 나누지 않았다."), ...near(x0)],
        verificationJs: withParams({ num, den, c, out }, "const s=[];\nfor(let x=-400;x<=400;x++) if(Math.abs(P.num*x/P.den+P.c-P.out)<1e-9) s.push(x);\nif(s.length!==1) throw new Error('유일하지 않음');\nreturn s[0];"),
        trace: [T(`$${fr}${v} ${c >= 0 ? "+" : "-"} ${Math.abs(c)} = ${out}$ 로 놓는다.`, "Set the output."), T(`상수를 이항하면 $${fr}${v} = ${out - c}$ 이다.`, "Move the constant."), T(`양변에 ${den}/${num} 을 곱하면 ${v} = ${x0} 이다.`, "Multiply by the reciprocal.")],
        variant: "fraction_slope",
      });
    },
  },
  {
    ...base, id: "lf.slope_from_two_points.m_fractional_slope", kind: "slope_from_two_points", difficulty: "medium",
    structure: "두 점의 기울기가 분수(기약분수)로 나오는 경우를 구한다", extraThinking: "medium 틀", concepts: ["기울기 공식", "분수의 약분"],
    generate(rng) {
      const x1 = rng.int(-5, 3), dx = rng.int(2, 7), y1 = rng.int(-8, 8), dy = rng.nz(-9, 9), x2 = x1 + dx, y2 = y1 + dy; if (dy % dx === 0 || Math.abs(dy) > 12) throw new GenFail("x");
      const g = gcdN(dy, dx), L = rng.pick(["ℓ", "m", "k", "n", "j"]);
      const A = M(`(${x1}, ${y1})`), B = M(`(${x2}, ${y2})`);
      const val = dy / dx;
      return finish(rng, {
        stimulus: rng.pick([`Line ${L} passes through the points ${A} and ${B}.`, `In the xy-plane, line ${L} contains ${A} and ${B}.`, `A line ${L} goes through ${A} and ${B}.`, `The points ${A} and ${B} lie on line ${L}.`, `Two points of line ${L} are ${A} and ${B}.`]), question: spin(rng, `[[What is the slope of line ${L}?|Find the slope of line ${L}.|What slope does line ${L} have?|What is the rate of change of line ${L}?|What is the slope of the line, in simplest form?]]`), correct: val,
        fmt: (v: number) => { const d = dx / g, nn = dy / g; if (Math.abs(v - nn / d) < 1e-9) return `${nn}/${d}`; for (let den = 1; den <= 12; den++) { const num = Math.round(v * den); if (Math.abs(num / den - v) < 1e-9) return den === 1 ? String(num) : `${num}/${den}`; } return String(Math.round(v * 100) / 100); },
        wrongs: [W(-val, "sign_error", "부호를 잘못 처리했다."), W(dx / dy, "formula_misuse", "기울기를 거꾸로 계산했다."), W(-dx / dy, "formula_misuse", "기울기를 거꾸로 계산하고 부호도 바꿨다."), W((dy + 1) / dx, "other", "변화량을 잘못 셌다."), W(dy / (dx + 1), "other", "변화량을 잘못 셌다."), W(dy / (dx - 1), "other", "변화량을 잘못 셌다.")],
        verificationJs: withParams({ x1, y1, x2, y2 }, "return (P.y2-P.y1)/(P.x2-P.x1);"),
        trace: [T(`y 의 변화량은 ${y2} - ${pr(y1)} = ${dy} 이다.`, "Find the rise."), T(`x 의 변화량은 ${x2} - ${pr(x1)} = ${dx} 이다.`, "Find the run."), T(`기울기는 ${dy}/${dx} 를 기약분수로 나타낸 값이다.`, "Reduce the fraction.")],
        variant: "fractional_slope",
      });
    },
  },
  {
    ...base, id: "lf.interpret_slope.m_rate_context", kind: "interpret_slope", difficulty: "medium",
    structure: "맥락 속 일차 모델의 기울기가 단위 시간당 변화량임을 해석한다", extraThinking: "medium 틀", concepts: ["기울기의 의미(변화율)", "문장 해석"],
    generate(rng) {
      const c = rng.pick(LMS), m = rng.nz(-9, 10), b = rng.int(10, 90); if (m < 0 && !c.canDown) throw new GenFail("x");
      const F = rng.pick(["C", "F", "G", "H", "A", "W"]), subj = c.subj.toLowerCase();
      const model = M(`${F}(t) = ${lin(m, b, "t")}`);
      const stim = rng.pick([`The ${c.yName} of ${subj} is modeled by ${model}, where t is the number of ${c.xUnits} and ${F}(t) is measured in ${c.yUnit}.`, `Let ${model} give the ${c.yName} of ${subj}, in ${c.yUnit}, after t ${c.xUnits}.`, `With t in ${c.xUnits}, the ${c.yName} of ${subj}, in ${c.yUnit}, is ${model}.`, `After t ${c.xUnits}, the ${c.yName} of ${subj} equals ${model} ${c.yUnit}.`]);
      const dir = m > 0 ? "increase" : "decrease";
      return finish(rng, {
        stimulus: stim, question: spin(rng, `[[According to the model, by how many ${c.yUnit} does the ${c.yName} ${dir} each ${c.xUnit}?|The model says the ${c.yName} ${dir}s by how many ${c.yUnit} each ${c.xUnit}?|Each ${c.xUnit}, the ${c.yName} ${dir}s by how many ${c.yUnit} according to the model?|How many ${c.yUnit} does the model ${dir === "increase" ? "add" : "remove"} each ${c.xUnit}?]]`.replace(/(increase|decrease)s by/g, "$1s by")), correct: Math.abs(m),
        wrongs: [W(b, "other", "절편(처음 값)을 변화율로 답했다."), W(Math.abs(m) + b, "other", "기울기와 절편을 더했다."), W(Math.abs(m) * 2, "other", "기울기를 두 배로 계산했다."), W(Math.abs(m) + 1, "other", "계산 실수."), ...near(Math.abs(m))],
        verificationJs: withParams({ m, b }, "const f=t=>P.m*t+P.b;\nreturn Math.abs(f(1)-f(0));"),
        trace: [T(`t 가 1 증가하면 ${F}(t) 는 ${m} 만큼 변한다.`, "A one-unit change in t changes the output by the slope."), T(`기울기 ${m} 이 단위 시간당 ${m > 0 ? "증가" : "감소"}량이므로 크기는 ${Math.abs(m)} 이다.`, "Interpret the sign and size.")],
        variant: "rate_in_context",
      });
    },
  },
  {
    ...base, id: "lf.interpret_intercept.m_start_context", kind: "interpret_intercept", difficulty: "medium",
    structure: "맥락 속 일차 모델에서 t = 0 의 값(y 절편)이 시작값임을 해석한다", extraThinking: "medium 틀", concepts: ["y 절편의 의미(시작값)", "문장 해석"],
    generate(rng) {
      const c = rng.pick(LMS), m = rng.nz(-9, 10), b = rng.int(10, 90); if (m < 0 && !c.canDown) throw new GenFail("x");
      const F = rng.pick(["C", "F", "G", "H", "A", "W"]), subj = c.subj.toLowerCase(), model = M(`${F}(t) = ${lin(m, b, "t")}`);
      const stim = rng.pick([`The ${c.yName} of ${subj} is modeled by ${model}, where t is the number of ${c.xUnits} since tracking began and ${F}(t) is measured in ${c.yUnit}.`, `Let ${model} give the ${c.yName} of ${subj}, in ${c.yUnit}, t ${c.xUnits} after tracking began.`, `With t in ${c.xUnits} since tracking began, the ${c.yName} of ${subj}, in ${c.yUnit}, is ${model}.`, `Starting from the day tracking began, the ${c.yName} of ${subj} follows ${model}, with t in ${c.xUnits} and the result in ${c.yUnit}.`]);
      return finish(rng, {
        stimulus: stim, question: spin(rng, `[[According to the model, what was the ${c.yName}, in ${c.yUnit}, when tracking began?|What does the model give as the starting ${c.yName}, in ${c.yUnit}?|Before any ${c.xUnits} had passed, what was the ${c.yName}, in ${c.yUnit}?|What is the ${c.yName} at the moment tracking began, in ${c.yUnit}?|The model predicts what initial ${c.yName}, in ${c.yUnit}?]]`), correct: b,
        wrongs: [W(Math.abs(m), "other", "기울기(변화율)를 시작값으로 답했다."), W(b + m, "other", "t = 1 일 때의 값을 시작값으로 답했다."), W(b - m, "other", "t = −1 일 때의 값을 답했다."), W(Math.abs(m) + b, "other", "기울기와 절편을 더했다."), ...near(b)],
        verificationJs: withParams({ m, b }, "const f=t=>P.m*t+P.b;\nreturn f(0);"),
        trace: [T(`t = 0 일 때 ${F}(0) = ${b} 이다.`, "Evaluate at t = 0."), T("t = 0 은 추적을 시작한 때이므로 이 값이 시작값(y 절편)이다.", "The intercept is the starting value.")],
        variant: "start_in_context",
      });
    },
  },
];
void fq;
