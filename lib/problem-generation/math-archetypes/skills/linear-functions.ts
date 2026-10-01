// linear_functions hard 원형 20개(evaluate·find_x_for_value·slope_from_two_points·interpret_slope·interpret_intercept × 연산자 4종). 정답은 모두 수치.
import { GenFail, type Archetype } from "../types";
import { facts, finish, lin, M, spin, withParams } from "../text";
import { LMS, near, SERVICES, stdEq, T, W } from "../kit-b";

const SKILL = "linear_functions";
const FN = ["f", "g", "h", "p"] as const;
const F = (n: string, a: number, b: number, v = "x") => `${n}(${v}) = ${lin(a, b, v)}`;
const m_ = (n: number) => String(n);
const pr = (n: number) => (n < 0 ? `(${n})` : String(n));
const nz = (n: number) => n.toFixed(3).replace(/\.?0+$/, "");

export const LF_ARCHETYPES: Archetype[] = [
  // ======================= evaluate =======================
  {
    id: "lf.evaluate.chain2", skill: SKILL, kind: "evaluate", operator: "chain2",
    structure: "f 와 g 를 합성해 f(g(p)) 와 g(f(q)) 를 각각 단계적으로 계산한 뒤 합(차)을 구함",
    extraThinking: "안쪽 함수값을 바깥 함수의 입력으로 넘기는 두 번의 합성과 순서(f∘g 와 g∘f)의 구분 — medium 은 함수값 하나 계산",
    concepts: ["함수값 계산", "함수의 합성", "합성 순서"], mediumSteps: 1,
    generate(rng) {
      const a = rng.nz(-4, 5), b = rng.nz(-8, 8), c = rng.nz(-4, 5), d = rng.nz(-8, 8), p = rng.int(-4, 5), q = rng.int(-4, 5), plus = rng.chance(0.5);
      const f = (x: number) => a * x + b, g = (x: number) => c * x + d;
      const v1 = f(g(p)), v2 = g(f(q)), val = plus ? v1 + v2 : v1 - v2;
      if (Math.abs(val) > 150 || Math.abs(g(p)) > 40 || Math.abs(f(q)) > 40 || v1 === v2) throw new GenFail("x");
      const sign = plus ? "+" : "-"; const [n1, n2] = rng.pick([["f", "g"], ["g", "h"], ["h", "k"], ["u", "v"], ["r", "s"]] as const);
      return finish(rng, {
        stimulus: facts(rng, [[`The functions ${n1} and ${n2} are defined by ${M(F(n1, a, b))} and ${M(F(n2, c, d))}.`, `Let ${M(F(n1, a, b))} and ${M(F(n2, c, d))}.`, `Two linear functions are given: ${M(F(n1, a, b))} and ${M(F(n2, c, d))}.`, `For the functions ${M(F(n1, a, b))} and ${M(F(n2, c, d))}, the expression below is evaluated.`, `A student studies ${M(F(n1, a, b))} together with ${M(F(n2, c, d))}.`, `The rules ${M(F(n1, a, b))} and ${M(F(n2, c, d))} define two functions.`, `Consider the pair of functions ${M(F(n1, a, b))} and ${M(F(n2, c, d))}.`]]),
        question: spin(rng, `[[What is the value of $${n1}(${n2}(${p})) ${sign} ${n2}(${n1}(${q}))$?|Find $${n1}(${n2}(${p})) ${sign} ${n2}(${n1}(${q}))$.|What does $${n1}(${n2}(${p})) ${sign} ${n2}(${n1}(${q}))$ equal?|Evaluate $${n1}(${n2}(${p})) ${sign} ${n2}(${n1}(${q}))$.|What number is $${n1}(${n2}(${p})) ${sign} ${n2}(${n1}(${q}))$?|Compute $${n1}(${n2}(${p})) ${sign} ${n2}(${n1}(${q}))$.]]`), correct: val,
        wrongs: [W(plus ? g(f(p)) + f(g(q)) : g(f(p)) - f(g(q)), "formula_misuse", "합성 순서(f 와 g 의 안팎)를 바꿔 계산했다."), W(plus ? v1 - v2 : v1 + v2, "sign_error", "두 값을 결합하는 부호를 반대로 적용했다."), W(plus ? f(p) + g(q) : f(p) - g(q), "step_missing", "합성하지 않고 각 함수값만 계산했다."), W(v1, "step_missing", "둘째 항을 계산하지 않았다."), ...near(val)],
        verificationJs: withParams({ a, b, c, d, p, q, plus: plus ? 1 : 0 }, "const f=x=>P.a*x+P.b, g=x=>P.c*x+P.d;\nconst A=f(g(P.p)), B=g(f(P.q));\nreturn P.plus?A+B:A-B;"),
        trace: [T(`$${n2}(${p}) = ${c}\\cdot ${pr(p)} ${d >= 0 ? "+" : "-"} ${Math.abs(d)} = ${g(p)}$ 이다.`, "Evaluate the inner function."), T(`$${n1}(${n2}(${p})) = ${n1}(${g(p)}) = ${v1}$ 이다.`, "Feed it into the outer function."), T(`$${n1}(${q}) = ${f(q)}$ 이다.`, "Evaluate the other inner function."), T(`$${n2}(${n1}(${q})) = ${n2}(${f(q)}) = ${v2}$ 이다.`, "Feed it into the other outer function."), T(`두 값을 ${plus ? "더하면" : "빼면"} ${val} 이다.`, "Combine.")],
        variant: "two_compositions",
      });
    },
  },
  {
    id: "lf.evaluate.compose_kind", skill: SKILL, kind: "evaluate", operator: "compose_kind",
    structure: "일차함수 f 가 f(p)=u, f(q)=v 로 주어질 때 기울기·절편을 구해 f(r) 를 계산",
    extraThinking: "함수값 두 개에서 직선의 식을 먼저 복원(기울기→절편)한 뒤 함수값을 계산 — medium 은 식이 주어진 함수값 계산",
    concepts: ["함수값 계산", "두 점으로 직선의 식 구하기"], mediumSteps: 1,
    generate(rng) {
      const m = rng.nz(-5, 6), b = rng.nz(-12, 12), p = rng.int(-5, 3), q = p + rng.int(2, 6), r = rng.int(-6, 9); if (r === p || r === q) throw new GenFail("x");
      const u = m * p + b, v = m * q + b, ans = m * r + b; if (Math.abs(ans) > 99 || Math.abs(u) > 60 || Math.abs(v) > 60) throw new GenFail("x");
      const n = rng.pick(FN);
      return finish(rng, {
        stimulus: facts(rng, [[`The linear function ${n} satisfies ${M(`${n}(${p}) = ${u}`)} and ${M(`${n}(${q}) = ${v}`)}.`, `A linear function ${n} has ${M(`${n}(${p}) = ${u}`)} and ${M(`${n}(${q}) = ${v}`)}.`, `For a linear function ${n}, the values ${M(`${n}(${p}) = ${u}`)} and ${M(`${n}(${q}) = ${v}`)} are known.`, `It is known that ${M(`${n}(${p}) = ${u}`)} and ${M(`${n}(${q}) = ${v}`)} for a linear function ${n}.`]]),
        question: spin(rng, `[[What is the value of $${n}(${r})$?|Find $${n}(${r})$.|What does $${n}(${r})$ equal?|What is $${n}(${r})$?]]`), correct: ans,
        wrongs: [W(v + (r - q), "formula_misuse", "기울기를 1 로 가정해 변화량을 더했다."), W(u + v, "formula_misuse", "두 함수값을 더했다."), W(-ans, "sign_error", "기울기나 절편의 부호를 잘못 처리했다."), W(m * r, "step_missing", "절편을 더하지 않았다."), W(b + r, "formula_misuse", "기울기를 곱하지 않았다."), ...near(ans)],
        verificationJs: withParams({ p, u, q, v, r }, "const s=(P.v-P.u)/(P.q-P.p); if(!Number.isInteger(s)) throw new Error('기울기가 정수가 아님');\nconst b=P.u-s*P.p;\nreturn s*P.r+b;"),
        trace: [T(`기울기는 $(${v} - ${pr(u)}) / (${q} - ${pr(p)}) = ${m}$ 이다.`, "Find the slope."), T(`$${n}(x) = ${m}x + b$ 로 놓는다.`, "Write the form."), T(`${p} 를 대입하면 $${u} = ${m}\\cdot ${pr(p)} + b$ 이다.`, "Substitute a known point."), T(`b = ${b} 이므로 $${n}(x) = ${lin(m, b)}$ 이다.`, "Solve for b."), T(`$${n}(${r}) = ${m}\\cdot ${pr(r)} ${b >= 0 ? "+" : "-"} ${Math.abs(b)} = ${ans}$ 이다.`, "Evaluate.")],
        variant: "restore_then_evaluate",
      });
    },
  },
  {
    id: "lf.evaluate.repr_shift", skill: SKILL, kind: "evaluate", operator: "repr_shift",
    structure: "그래프가 x 절편 (p,0) 과 y 절편 (0,b) 를 지난다는 서술에서 기울기 −b/p 를 구해 식을 세운 뒤 f(r) 를 계산",
    extraThinking: "절편 서술(그래프의 좌표 정보)을 기울기와 식으로 번역한 뒤 함수값을 계산 — medium 은 식이 주어진 함수값 계산",
    concepts: ["절편으로 직선의 식 구하기", "함수값 계산"], mediumSteps: 1,
    generate(rng) {
      const p = rng.nz(-6, 7), m = rng.nz(-5, 5), b = -m * p; if (b === 0 || Math.abs(b) > 40) throw new GenFail("x");
      const r = rng.int(-6, 9); if (r === 0 || r === p) throw new GenFail("x"); const ans = m * r + b; if (Math.abs(ans) > 99) throw new GenFail("x");
      const n = rng.pick(FN);
      return finish(rng, {
        stimulus: facts(rng, [[`The graph of the linear function ${n} in the xy-plane crosses the x-axis at ${M(`(${p}, 0)`)} and the y-axis at ${M(`(0, ${b})`)}.`, `A linear function ${n} has an x-intercept at ${M(`(${p}, 0)`)} and a y-intercept at ${M(`(0, ${b})`)}.`, `In the xy-plane, the line ${M(`y = ${n}(x)`)} meets the x-axis at ${M(`(${p}, 0)`)} and meets the y-axis at ${M(`(0, ${b})`)}.`, `The line that is the graph of ${n} passes through the x-intercept ${M(`(${p}, 0)`)} and the y-intercept ${M(`(0, ${b})`)}.`, `Only two features of the linear function ${n} are known: its graph hits the x-axis at ${M(`(${p}, 0)`)} and the y-axis at ${M(`(0, ${b})`)}.`, `The graph of ${n}, a line, cuts the axes at ${M(`(${p}, 0)`)} and ${M(`(0, ${b})`)}.`, `For a linear function ${n}, the point ${M(`(${p}, 0)`)} is on the x-axis and ${M(`(0, ${b})`)} is on the y-axis, and both lie on its graph.`]]),
        question: spin(rng, `[[What is the value of $${n}(${r})$?|Find $${n}(${r})$.|What is $${n}(${r})$?|What does the function output when the input is ${r}?|If the input is ${r}, what is the output of ${n}?|Evaluate $${n}(${r})$.]]`), correct: ans,
        wrongs: [W(-ans, "sign_error", "기울기의 부호를 반대로 구했다."), W(b + r, "formula_misuse", "기울기를 곱하지 않고 더했다."), W(m * r, "step_missing", "절편을 더하지 않았다."), W((b / p) * r + b, "sign_error", "기울기를 −b/p 가 아니라 b/p 로 계산했다."), W(Math.round(-p * r / b), "formula_misuse", "기울기를 거꾸로(−p/b) 계산했다."), ...near(ans)],
        verificationJs: withParams({ p, b, r }, "const s=-P.b/P.p;\nreturn s*P.r+P.b;"),
        trace: [T(`x 절편은 점 (${p}, 0), y 절편은 점 (0, ${b}) 이다.`, "Read the two intercept points."), T(`기울기는 $(0 - ${pr(b)}) / (${pr(p)} - 0) = ${m}$ 이다.`, "Compute the slope."), T(`y 절편이 ${b} 이므로 $${n}(x) = ${lin(m, b)}$ 이다.`, "Write the equation."), T(`$${n}(${r}) = ${m}\\cdot ${pr(r)} ${b >= 0 ? "+" : "-"} ${Math.abs(b)}$ 이다.`, "Substitute."), T(`계산하면 ${ans} 이다.`, "Evaluate.")],
        variant: "from_intercepts",
      });
    },
  },
  {
    id: "lf.evaluate.compare_scenarios", skill: SKILL, kind: "evaluate", operator: "compare_scenarios",
    structure: "두 요금제의 비용함수를 문장에서 세우고 같은 시간 k 에서 두 함수값의 차를 구함",
    extraThinking: "두 상황을 각각 함수로 모델링한 뒤 같은 입력에서 값을 비교 — medium 은 주어진 하나의 함수값 계산",
    concepts: ["문장→일차함수", "함수값 계산", "두 값의 비교"], mediumSteps: 1,
    generate(rng) {
      const sv = rng.pick(SERVICES), fa = rng.int(2, 20) * 5, ra = rng.int(8, 40), fb = rng.int(1, 8) * 5, rb = rng.int(3, 30), k = rng.int(2, 12);
      const A = fa + ra * k, B = fb + rb * k, d = A - B; if (d <= 0 || d > 400 || ra === rb) throw new GenFail("x");
      const stimulus = facts(rng, [
        [`Shop A charges ${fa} dollars for ${sv.job} plus ${ra} dollars for each ${sv.unit}.`, `At Shop A, ${sv.job} costs ${fa} dollars, and each ${sv.unit} adds ${ra} dollars.`, `Shop A bills ${fa} dollars for ${sv.job} and ${ra} dollars per ${sv.unit}.`, `The price at Shop A is ${fa} dollars for ${sv.job} plus ${ra} dollars for every ${sv.unit}.`],
        [`Shop B charges ${fb} dollars for ${sv.job} plus ${rb} dollars for each ${sv.unit}.`, `At Shop B, ${sv.job} costs ${fb} dollars, and each ${sv.unit} adds ${rb} dollars.`, `Shop B bills ${fb} dollars for ${sv.job} and ${rb} dollars per ${sv.unit}.`, `The price at Shop B is ${fb} dollars for ${sv.job} plus ${rb} dollars for every ${sv.unit}.`],
      ]);
      return finish(rng, {
        stimulus, question: spin(rng, `[[For ${k} ${sv.units}, how many more dollars does Shop A charge than Shop B?|How many dollars greater is the total at Shop A than at Shop B for ${k} ${sv.units}?|For ${k} ${sv.units}, what is the difference, in dollars, between Shop A's charge and Shop B's charge?]]`), correct: d,
        wrongs: [W(fa - fb + ra - rb, "step_missing", "시간 k 를 곱하지 않고 요금 차를 더했다."), W(B - A, "sign_error", "차의 부호가 반대(B−A)로 계산되었다."), W(A, "step_missing", "Shop A 의 요금만 계산했다."), W((ra - rb) * k, "step_missing", "처음 요금의 차를 빠뜨렸다."), W(fa - fb, "step_missing", "시작 요금의 차만 구했다."), ...near(d)],
        verificationJs: withParams({ fa, ra, fb, rb, k }, "const A=P.fa+P.ra*P.k, B=P.fb+P.rb*P.k;\nreturn A-B;"),
        trace: [T(`Shop A 의 함수는 $A(t) = ${ra}t + ${fa}$ 이다.`, "Model Shop A."), T(`Shop B 의 함수는 $B(t) = ${rb}t + ${fb}$ 이다.`, "Model Shop B."), T(`$A(${k}) = ${ra}\\cdot ${k} + ${fa} = ${A}$ 이다.`, "Evaluate A."), T(`$B(${k}) = ${rb}\\cdot ${k} + ${fb} = ${B}$ 이다.`, "Evaluate B."), T(`차는 ${A} - ${B} = ${d} 이다.`, "Subtract.")],
        variant: "two_shops_difference",
      });
    },
  },
  // ======================= find_x_for_value =======================
  {
    id: "lf.find_x_for_value.inverse", skill: SKILL, kind: "find_x_for_value", operator: "inverse",
    structure: "f(p) 와 f(q) 의 합을 정방향으로 계산한 뒤, f(x) 가 그 값이 되는 x 를 역으로 구함",
    extraThinking: "정방향으로 만든 목표값을 다시 출력값으로 두고 입력을 역산 — medium 은 주어진 출력값에서 x 를 한 번 구함",
    concepts: ["함수값 계산", "출력값에서 입력 역산"], mediumSteps: 1,
    generate(rng) {
      const a = rng.pick([2, 3, 4, 5, -2, -3]), b = rng.nz(-12, 12), p = rng.int(-5, 6), q = rng.int(-5, 6); if (p === q) throw new GenFail("x");
      const target = a * p + b + a * q + b; const x0 = (target - b) / a; if (!Number.isInteger(x0) || Math.abs(target) > 99) throw new GenFail("x");
      const n = rng.pick(FN);
      return finish(rng, {
        stimulus: `${rng.pick([`The function ${n} is defined by ${M(F(n, a, b))}.`, `Let ${M(F(n, a, b))}.`, `A linear function is given by ${M(F(n, a, b))}.`, `Consider the function ${M(F(n, a, b))}.`])} ${rng.pick([`There is a value of x for which ${M(`${n}(x) = ${n}(${p}) + ${n}(${q})`)}.`, `For one value of x, the output ${M(`${n}(x)`)} equals the sum ${M(`${n}(${p}) + ${n}(${q})`)}.`, `The equation ${M(`${n}(x) = ${n}(${p}) + ${n}(${q})`)} has exactly one solution.`])}`,
        question: spin(rng, "[[What is that value of x?|What is the value of x?|Find x.|For what value of x does the equation hold?]]"), correct: x0,
        wrongs: [W(p + q, "step_missing", "함수값의 합을 구하지 않고 입력을 더했다."), W(target, "step_missing", "목표값을 x 로 답했다."), W((target + b) / a, "sign_error", "상수항 b 를 더해 이항했다."), W(-x0, "sign_error", "부호를 잘못 처리했다."), W(p + q + b / a * 2, "formula_misuse", "상수항이 두 번 더해진 것을 놓쳤다."), ...near(x0)],
        verificationJs: withParams({ a, b, p, q }, "const f=x=>P.a*x+P.b; const t=f(P.p)+f(P.q); const s=[];\nfor(let x=-400;x<=400;x++) if(f(x)===t) s.push(x);\nif(s.length!==1) throw new Error('유일하지 않음');\nreturn s[0];"),
        trace: [T(`$${n}(${p}) = ${a}\\cdot ${pr(p)} ${b >= 0 ? "+" : "-"} ${Math.abs(b)} = ${a * p + b}$ 이다.`, "Evaluate f(p)."), T(`$${n}(${q}) = ${a * q + b}$ 이다.`, "Evaluate f(q)."), T(`합은 ${target} 이다.`, "Add the two values."), T(`$${a}x ${b >= 0 ? "+" : "-"} ${Math.abs(b)} = ${target}$ 로 놓는다.`, "Set f(x) equal to the sum."), T(`상수를 이항하면 $${a}x = ${target - b}$ 이고 x = ${x0} 이다.`, "Solve for x.")],
        variant: "equal_to_sum_of_values",
      });
    },
  },
  {
    id: "lf.find_x_for_value.chain2", skill: SKILL, kind: "find_x_for_value", operator: "chain2",
    structure: "합성함수 f(g(x)) 를 하나의 일차식으로 정리한 뒤 f(g(x)) = T 가 되는 x 를 구함",
    extraThinking: "두 함수를 합성해 식을 정리(기울기 곱·상수 합성)한 뒤 방정식으로 푸는 2단계 — medium 은 한 함수에서 x 를 구함",
    concepts: ["함수의 합성", "일차방정식", "출력값에서 입력 역산"], mediumSteps: 1,
    generate(rng) {
      const a = rng.nz(-4, 5), b = rng.nz(-9, 9), c = rng.nz(-4, 5), d = rng.nz(-9, 9), x0 = rng.int(-6, 8), T0 = a * (c * x0 + d) + b;
      if (Math.abs(T0) > 120 || a * c === 0 || Math.abs(a * c) === 1) throw new GenFail("x");
      const [n1, n2] = rng.pick([["f", "g"], ["g", "h"], ["h", "k"], ["u", "v"], ["r", "s"]] as const);
      return finish(rng, {
        stimulus: facts(rng, [[`The functions ${n1} and ${n2} are defined by ${M(F(n1, a, b))} and ${M(F(n2, c, d))}.`, `Let ${M(F(n1, a, b))} and ${M(F(n2, c, d))}.`, `Two linear functions are ${M(F(n1, a, b))} and ${M(F(n2, c, d))}.`, `Consider ${M(F(n1, a, b))} and ${M(F(n2, c, d))}.`, `A student defines ${M(F(n1, a, b))} and ${M(F(n2, c, d))}.`, `The rules ${M(F(n1, a, b))} and ${M(F(n2, c, d))} give two functions.`, `Look at the functions ${M(F(n1, a, b))} and ${M(F(n2, c, d))}.`]]),
        question: spin(rng, `[[For what value of x does $${n1}(${n2}(x)) = ${T0}$?|What value of x satisfies $${n1}(${n2}(x)) = ${T0}$?|If $${n1}(${n2}(x)) = ${T0}$, what is x?|Find x such that $${n1}(${n2}(x)) = ${T0}$.|Which x makes $${n1}(${n2}(x))$ equal to ${T0}?|The composite output is ${T0}. What is the input x of ${n2}?]]`), correct: x0,
        wrongs: [W(Math.round((T0 - d * c - b) / (a * c)), "formula_misuse", "합성을 g(f(x)) 순서로 잘못 계산했다."), W(-x0, "sign_error", "부호를 잘못 처리했다."), W((T0 - b) / a, "step_missing", "바깥 함수만 풀고 g 를 되돌리지 않았다."), W((T0 - b - d) / (a * c), "formula_misuse", "a·d 가 아닌 d 만 이항했다."), W((T0 + a * d + b) / (a * c), "sign_error", "상수를 더해 이항했다."), ...near(x0)],
        verificationJs: withParams({ a, b, c, d, T: T0 }, "const f=x=>P.a*x+P.b, g=x=>P.c*x+P.d; const s=[];\nfor(let x=-400;x<=400;x++) if(f(g(x))===P.T) s.push(x);\nif(s.length!==1) throw new Error('유일하지 않음');\nreturn s[0];"),
        trace: [T(`$${n1}(${n2}(x)) = ${a}(${lin(c, d)}) ${b >= 0 ? "+" : "-"} ${Math.abs(b)}$ 이다.`, "Substitute the inner function into the outer one."), T(`분배하면 $${lin(a * c, a * d + b)}$ 이다.`, "Simplify the composite."), T(`$${lin(a * c, a * d + b)} = ${T0}$ 로 놓는다.`, "Set it equal to the target."), T(`상수를 이항하면 $${a * c}x = ${T0 - a * d - b}$ 이다.`, "Isolate the x-term."), T(`${a * c} 로 나누면 x = ${x0} 이다.`, "Solve.")],
        variant: "composite_equals_target",
      });
    },
  },
  {
    id: "lf.find_x_for_value.compose_kind", skill: SKILL, kind: "find_x_for_value", operator: "compose_kind",
    structure: "f(p) 를 구한 뒤 그보다 r% 큰(작은) 값이 되는 x 를 구함",
    extraThinking: "퍼센트 변화를 함수의 출력값에 적용한 목표값을 만들고 그 목표값에서 입력을 역산 — medium 은 주어진 출력값에서 x 를 구함",
    concepts: ["함수값 계산", "퍼센트 증가·감소", "출력값에서 입력 역산"], mediumSteps: 1,
    generate(rng) {
      const a = rng.nz(-5, 6), b = rng.int(0, 30), p = rng.int(2, 12), r = rng.pick([10, 20, 25, 50]), up = rng.chance(0.6), v0 = a * p + b;
      const target = up ? v0 * (100 + r) / 100 : v0 * (100 - r) / 100; if (v0 <= 0 || !Number.isInteger(target)) throw new GenFail("x");
      const x0 = (target - b) / a; if (!Number.isInteger(x0) || Math.abs(x0) > 60 || x0 === p) throw new GenFail("x");
      const n = rng.pick(FN);
      return finish(rng, {
        stimulus: `${rng.pick([`The function ${n} is defined by ${M(F(n, a, b))}.`, `Let ${M(F(n, a, b))}.`, `A linear function is given by ${M(F(n, a, b))}.`])} ${rng.pick([`For one value of x, ${M(`${n}(x)`)} is ${r}% ${up ? "greater" : "less"} than ${M(`${n}(${p})`)}.`, `There is a value of x for which the output is ${r} percent ${up ? "more" : "less"} than ${M(`${n}(${p})`)}.`, `The output ${M(`${n}(x)`)} is ${r}% ${up ? "larger" : "smaller"} than ${M(`${n}(${p})`)} for exactly one x.`])}`,
        question: spin(rng, "[[What is that value of x?|What is the value of x?|Find x.|For which value of x is this true?]]"), correct: x0,
        wrongs: [W(Math.round(p * (up ? 1 + r / 100 : 1 - r / 100)), "formula_misuse", "퍼센트 변화를 입력 p 에 적용했다."), W(v0, "step_missing", "f(p) 를 x 로 답했다."), W(target, "step_missing", "목표 출력값을 x 로 답했다."), W((v0 * (up ? r : -r) / 100 - b) / a, "formula_misuse", "증가량만 출력값으로 놓았다."), W(2 * p - x0, "other", "p 에 대해 대칭인 값을 답했다."), ...near(x0)],
        verificationJs: withParams({ a, b, p, r, up: up ? 1 : 0 }, "const f=x=>P.a*x+P.b; const t=f(P.p)*(P.up?100+P.r:100-P.r)/100; const s=[];\nfor(let x=-400;x<=400;x++) if(Math.abs(f(x)-t)<1e-9) s.push(x);\nif(s.length!==1) throw new Error('유일하지 않음');\nreturn s[0];"),
        trace: [T(`$${n}(${p}) = ${a}\\cdot ${p} + ${b} = ${v0}$ 이다.`, "Evaluate f(p)."), T(`${r}% ${up ? "증가" : "감소"}한 값은 ${v0} × ${(100 + (up ? r : -r)) / 100} = ${target} 이다.`, "Apply the percent change."), T(`$${a}x ${b >= 0 ? "+" : "-"} ${Math.abs(b)} = ${target}$ 로 놓는다.`, "Set f(x) equal to the target."), T(`상수를 이항하면 $${a}x = ${target - b}$ 이다.`, "Isolate x."), T(`${a} 로 나누면 x = ${x0} 이다.`, "Solve.")],
        variant: "percent_of_value",
      });
    },
  },
  {
    id: "lf.find_x_for_value.constraint_select", skill: SKILL, kind: "find_x_for_value", operator: "constraint_select",
    structure: "L < f(x) < U 를 만족하는 정수 x 중 홀수(또는 짝수)의 개수를 센다",
    extraThinking: "출력값의 범위 조건을 입력의 구간으로 되돌리고(음수 기울기면 방향 반전) 정수·홀짝 제약으로 후보를 걸러냄 — medium 은 출력값 하나에서 x 를 구함",
    concepts: ["출력값 범위에서 입력 범위", "이중 부등식", "정수·홀짝 제약"], mediumSteps: 1,
    generate(rng) {
      const a = rng.nz(-5, 6), b = rng.nz(-10, 10), lo = rng.int(-30, 10), hi = lo + rng.int(14, 50), odd = rng.chance(0.5); const n = rng.pick(FN);
      const xs: number[] = []; for (let x = -100; x <= 100; x++) { const y = a * x + b; if (lo < y && y < hi && (((x % 2) + 2) % 2 === 1) === odd) xs.push(x); }
      let all = 0; for (let x = -100; x <= 100; x++) { const y = a * x + b; if (lo < y && y < hi) all++; }
      if (xs.length < 3 || xs.length > 12) throw new GenFail("x");
      const incl = (() => { let c = 0; for (let x = -100; x <= 100; x++) { const y = a * x + b; if (lo <= y && y <= hi && (((x % 2) + 2) % 2 === 1) === odd) c++; } return c; })();
      return finish(rng, {
        stimulus: `${rng.pick([`The function ${n} is defined by ${M(F(n, a, b))}.`, `Let ${M(F(n, a, b))}.`, `Consider the linear function ${M(F(n, a, b))}.`])} ${rng.pick([`An integer x is chosen so that ${M(`${lo} < ${n}(x) < ${hi}`)}.`, `The integer x satisfies ${M(`${lo} < ${n}(x) < ${hi}`)}.`, `Only integers x with ${M(`${lo} < ${n}(x) < ${hi}`)} are considered.`])} ${rng.pick([`Also, x is ${odd ? "odd" : "even"}.`, `In addition, x must be an ${odd ? "odd" : "even"} integer.`, `The integer x is required to be ${odd ? "odd" : "even"}.`])}`,
        question: spin(rng, "[[How many integer values of x are possible?|How many such integers x are there?|For how many integers x are all the conditions true?|What is the number of possible values of x?]]"), correct: xs.length,
        wrongs: [W(all, "condition_ignored", "홀짝 조건을 무시하고 모든 정수를 셌다."), W(incl, "condition_ignored", "부등호의 등호 포함 여부를 잘못 적용했다."), W(xs.length + 1, "other", "경계 근처의 정수를 하나 더 셌다."), W(Math.max(xs.length - 1, 0), "other", "경계 근처의 정수를 하나 빠뜨렸다."), W(Math.ceil(all / 2), "step_missing", "홀짝을 따지지 않고 절반으로 어림했다."), ...near(xs.length)],
        verificationJs: withParams({ a, b, lo, hi, odd: odd ? 1 : 0 }, "let c=0;\nfor(let x=-400;x<=400;x++){ const y=P.a*x+P.b; if(P.lo<y&&y<P.hi&&(((x%2)+2)%2===1)===(P.odd===1)) c++; }\nreturn c;"),
        trace: [T(`부등식에 f(x) = ${lin(a, b)} 를 대입한다: $${lo} < ${lin(a, b)} < ${hi}$.`, "Substitute f(x)."), T(`${b} 를 빼면 $${lo - b} < ${a}x < ${hi - b}$ 이다.`, "Subtract the constant."), T(`${a} 로 나눈다${a < 0 ? "(음수이므로 부등호 방향이 바뀐다)" : ""}.`, "Divide by the slope."), T(`x 의 범위 안 정수는 ${all}개이다.`, "Count the integers in the interval."), T(`그중 ${odd ? "홀수" : "짝수"}는 ${xs.length}개이다.`, "Keep only the parity required.")],
        variant: "range_with_parity",
      });
    },
  },
  // ======================= slope_from_two_points =======================
  {
    id: "lf.slope_from_two_points.inverse", skill: SKILL, kind: "slope_from_two_points", operator: "inverse",
    structure: "기울기가 s 인 직선이 (p,q) 와 (r,t) 를 지날 때 미지의 좌표 t(또는 r)를 기울기 공식을 역으로 써서 구함",
    extraThinking: "기울기 공식을 역방향으로 사용해 미지 좌표를 구함 — medium 은 두 점으로 기울기를 구하는 정방향",
    concepts: ["기울기 공식", "미지 좌표 역산"], mediumSteps: 1,
    generate(rng) {
      const s = rng.nz(-5, 6), p = rng.int(-5, 4), dx = rng.int(2, 6), r = p + dx, q = rng.int(-9, 9), t = q + s * dx, missingY = rng.chance(0.5);
      if (Math.abs(t) > 40) throw new GenFail("x");
      const A = `(${p}, ${q})`; const K = rng.pick(["k", "a", "c", "n", "m"]);
      const B = missingY ? `(${r}, ${K})` : `(${K}, ${t})`;
      const sl = m_(s);
      const stimulus = rng.pick([`A line has slope ${s} and passes through the points ${M(A)} and ${M(B)}.`, `A line in the xy-plane has a slope of ${s} and contains the points ${M(A)} and ${M(B)}.`, `The slope of a line is ${s}, and the line goes through ${M(A)} and ${M(B)}.`, `Two points, ${M(A)} and ${M(B)}, lie on a line whose slope is ${s}.`, `In the xy-plane, ${M(A)} and ${M(B)} are on a line with slope ${s}.`, `A line whose slope equals ${s} includes the points ${M(A)} and ${M(B)}.`, `Both ${M(A)} and ${M(B)} are points of a line that has slope ${s}.`, `For a line with slope ${s}, two of its points are ${M(A)} and ${M(B)}.`]);
      void sl;
      const ans = missingY ? t : r;
      return finish(rng, {
        stimulus, question: spin(rng, `[[What is the value of ${K}?|Find ${K}.|What must ${K} equal?|What is ${K}?|Which value of ${K} makes the statement true?|Determine ${K}.]]`), correct: ans,
        wrongs: missingY ? [W(q + s, "step_missing", "x 의 변화량을 곱하지 않았다."), W(q - s * dx, "sign_error", "변화량을 반대로 적용했다."), W(s * dx, "step_missing", "시작 y 값을 더하지 않았다."), W(q + dx, "formula_misuse", "기울기를 곱하지 않고 x 변화량을 더했다."), ...near(ans)]
          : [W(p + s, "step_missing", "y 의 변화량으로 나누지 않았다."), W(p - dx, "sign_error", "변화량을 반대로 적용했다."), W(dx, "step_missing", "시작 x 값을 더하지 않았다."), W(Math.round((t - q) * s) + p, "formula_misuse", "나누지 않고 곱했다."), ...near(ans)],
        verificationJs: withParams({ s, p, q, r, t, miss: missingY ? 1 : 0 }, "const out=[];\nfor(let k=-300;k<=300;k++){ const y2=P.miss?k:P.t, x2=P.miss?P.r:k; if(x2===P.p) continue; if((y2-P.q)===P.s*(x2-P.p)) out.push(k); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: missingY ? [T("기울기 공식 $m = (y_2 - y_1)/(x_2 - x_1)$ 을 쓴다.", "Write the slope formula."), T(`값을 대입하면 $${s} = (${K} - ${pr(q)}) / (${r} - ${pr(p)})$ 이다.`, "Substitute."), T(`분모를 계산하면 $${s} = (${K} - ${pr(q)}) / ${dx}$ 이다.`, "Simplify the denominator."), T(`양변에 ${dx} 를 곱하면 $${K} - ${pr(q)} = ${s * dx}$ 이다.`, "Multiply."), T(`${K} = ${q} + ${pr(s * dx)} = ${t} 이다.`, "Solve for k.")]
          : [T("기울기 공식 $m = (y_2 - y_1)/(x_2 - x_1)$ 을 쓴다.", "Write the slope formula."), T(`값을 대입하면 $${s} = (${pr(t)} - ${pr(q)}) / (${K} - ${pr(p)})$ 이다.`, "Substitute."), T(`분자를 계산하면 $${s} = ${t - q} / (${K} - ${pr(p)})$ 이다.`, "Simplify the numerator."), T(`$${K} - ${pr(p)} = ${t - q} / ${s} = ${dx}$ 이다.`, "Solve for the difference."), T(`${K} = ${p} + ${dx} = ${r} 이다.`, "Solve for k.")],
        variant: missingY ? "missing_y" : "missing_x",
      });
    },
  },
  {
    id: "lf.slope_from_two_points.compose_kind", skill: SKILL, kind: "slope_from_two_points", operator: "compose_kind",
    structure: "두 점으로 직선 ℓ 의 기울기를 구하고, ℓ 에 평행(또는 수직)이며 (p,q) 를 지나는 직선 m 의 y 절편을 구함",
    extraThinking: "기울기를 구한 뒤 평행·수직 관계(같은 기울기·음의 역수)를 적용하고 한 점에서 절편을 역산하는 합성 — medium 은 두 점으로 기울기만 구함",
    concepts: ["두 점으로 기울기", "평행·수직 직선의 기울기", "점과 기울기로 절편 구하기"], mediumSteps: 1,
    generate(rng) {
      const k = rng.pick([2, 3, 4, -2, -3]), perp = rng.chance(0.5), x1 = rng.int(-4, 2), dx = rng.int(1, 4), y1 = rng.int(-8, 8);
      const x2 = x1 + dx, y2 = y1 + k * dx; const j = rng.nz(-4, 4), p = perp ? k * j : rng.nz(-6, 6), q = rng.int(-9, 9);
      const ms = perp ? -1 / k : k, b = q - ms * p; if (!Number.isInteger(b) || Math.abs(b) > 40 || Math.abs(y2) > 30) throw new GenFail("x");
      const rel = perp ? rng.pick(["perpendicular to", "at right angles to", "perpendicular with"]) : rng.pick(["parallel to", "parallel with", "everywhere parallel to"]);
      const [L1, L2] = rng.pick([["ℓ", "m"], ["j", "k"], ["r", "s"], ["u", "v"]] as const); const P1 = M(`(${x1}, ${y1})`), P2 = M(`(${x2}, ${y2})`), P3 = M(`(${p}, ${q})`);
      return finish(rng, {
        stimulus: `${rng.pick([`Line ${L1} passes through the points ${P1} and ${P2}.`, `Line ${L1} contains the points ${P1} and ${P2}.`, `A line ${L1} goes through the points ${P1} and ${P2}.`, `The points ${P1} and ${P2} determine line ${L1}.`, `Line ${L1} is drawn through ${P1} and ${P2}.`, `Two points on line ${L1} are ${P1} and ${P2}.`])} ${rng.pick([`Line ${L2} is ${rel} line ${L1} and passes through ${P3}.`, `A second line, ${L2}, is ${rel} line ${L1} and contains ${P3}.`, `Another line, ${L2}, goes through ${P3} and is ${rel} line ${L1}.`, `Line ${L2} runs through ${P3}, and ${L2} is ${rel} ${L1}.`, `The point ${P3} lies on line ${L2}, which is ${rel} line ${L1}.`])}`,
        question: spin(rng, `[[What is the y-coordinate of the point where line ${L2} crosses the y-axis?|What is the y-intercept of line ${L2}?|Line ${L2} crosses the y-axis at the point $(0, y)$. What is y?|At what y-value does line ${L2} cross the y-axis?|Where does line ${L2} meet the y-axis? Give the y-coordinate.|What is the value of y at the point where line ${L2} intersects the y-axis?]]`), correct: b,
        wrongs: [W(q + (perp ? k : -k) * p, "formula_misuse", "기울기를 잘못 적용했다(수직이면 음의 역수, 평행이면 같은 값)."), W(q - ms * p * -1, "sign_error", "점에서 절편을 구할 때 부호를 반대로 적용했다."), W(q, "step_missing", "점의 y 좌표를 절편으로 답했다."), W(k, "formula_misuse", "ℓ 의 기울기를 절편으로 답했다."), W(-b, "sign_error", "절편의 부호를 반대로 구했다."), ...near(b)],
        verificationJs: withParams({ x1, y1, x2, y2, p, q, perp: perp ? 1 : 0 }, "const s=(P.y2-P.y1)/(P.x2-P.x1); const m=P.perp? -1/s : s;\nreturn P.q - m*P.p;"),
        trace: [T(`${L1} 의 기울기는 $(${y2} - ${pr(y1)}) / (${x2} - ${pr(x1)}) = ${k}$ 이다.`, "Find the first slope."), T(perp ? `수직인 직선의 기울기는 음의 역수 $-1/${pr(k)}$ 이다.` : `평행한 직선은 기울기가 같으므로 ${L2} 의 기울기는 ${k} 이다.`, "Find the second slope."), T(`${L2} 은 점 (${p}, ${q}) 를 지나므로 $${q} = ${perp ? `(-1/${pr(k)})` : k}\\cdot ${pr(p)} + b$ 이다.`, "Substitute the point."), T(`${perp ? `(-1/${pr(k)})` : k}·${pr(p)} = ${ms * p} 이다.`, "Compute the product."), T(`b = ${q} - ${pr(ms * p)} = ${b} 이다.`, "Solve for b.")],
        variant: perp ? "perpendicular_intercept" : "parallel_intercept",
      });
    },
  },
  {
    id: "lf.slope_from_two_points.repr_shift", skill: SKILL, kind: "slope_from_two_points", operator: "repr_shift",
    structure: "직선 ax + by = c 가 축과 만나는 두 점 P, Q 를 구하고 선분 PQ 의 기울기를 구함",
    extraThinking: "방정식을 축과의 교점(좌표)으로 번역한 뒤 두 점으로 기울기를 구함 — medium 은 두 점이 주어진 기울기 계산",
    concepts: ["축 절편 구하기", "두 점으로 기울기"], mediumSteps: 1,
    generate(rng) {
      const bb = rng.int(1, 4), m = rng.nz(-5, 5), a = -m * bb, t = rng.nz(-3, 4), c = a * bb * t; if (Math.abs(a) < 1 || c === 0 || Math.abs(c) > 99) throw new GenFail("x");
      const px = c / a, qy = c / bb; const eq = stdEq(a, bb, c);
      return finish(rng, {
        stimulus: `${rng.pick(["In the xy-plane, the line", "The line", "A line in the xy-plane with equation", "Consider the graph of the equation", "The graph of the equation"])} ${M(eq)} ${rng.pick(["crosses the x-axis at point P and the y-axis at point Q.", "meets the x-axis at P and the y-axis at Q.", "intersects the x-axis at a point P and the y-axis at a point Q.", "has P as its x-intercept and Q as its y-intercept.", "passes through its x-intercept P and its y-intercept Q.", "touches the x-axis at P and the y-axis at Q."])}`,
        question: spin(rng, "[[What is the slope of segment PQ?|What is the slope of the line segment from P to Q?|Find the slope of segment PQ.|What is the slope of line segment PQ?|What is the slope of the segment joining the two intercepts?|The segment between P and Q has what slope?]]"), correct: m,
        wrongs: [W(-m, "sign_error", "기울기의 부호를 반대로 구했다."), W(a, "step_missing", "x 의 계수를 기울기로 답했다."), W(Math.round(100 * (-bb / a)) / 100, "formula_misuse", "기울기를 −b/a 로 거꾸로 계산했다."), W(px - qy, "formula_misuse", "두 절편의 차를 기울기로 답했다."), W(qy / px, "sign_error", "절편의 비를 부호 없이 계산했다."), ...near(m)],
        verificationJs: withParams({ a, b: bb, c }, "const x1=P.c/P.a, y1=0, x2=0, y2=P.c/P.b;\nreturn (y2-y1)/(x2-x1);"),
        trace: [T(`y = 0 을 대입하면 P 의 x 좌표는 ${c}/${a} = ${px} 이므로 P = (${px}, 0) 이다.`, "Find the x-intercept."), T(`x = 0 을 대입하면 Q 의 y 좌표는 ${c}/${bb} = ${qy} 이므로 Q = (0, ${qy}) 이다.`, "Find the y-intercept."), T(`기울기는 $(y_Q - y_P)/(x_Q - x_P)$ 이다.`, "Write the slope formula."), T(`대입하면 $(${qy} - 0) / (0 - ${pr(px)}) = ${qy}/${pr(-px)}$ 이다.`, "Substitute."), T(`약분하면 ${m} 이다.`, "Simplify.")],
        variant: "intercepts_of_standard_form",
      });
    },
  },
  {
    id: "lf.slope_from_two_points.compare_scenarios", skill: SKILL, kind: "slope_from_two_points", operator: "compare_scenarios",
    structure: "직선 ℓ, m 의 기울기를 각각 두 점으로 구하고 ℓ 의 기울기가 m 보다 얼마나 큰지 계산",
    extraThinking: "서로 다른 두 직선의 기울기를 독립적으로 구해 비교(차) — medium 은 기울기 하나",
    concepts: ["두 점으로 기울기", "기울기 비교"], mediumSteps: 1,
    generate(rng) {
      const m1 = rng.nz(-5, 6), m2 = rng.nz(-5, 6); if (m1 <= m2) throw new GenFail("x");
      const d1 = rng.int(1, 5), d2 = rng.int(1, 5), a1 = rng.int(-6, 5), b1 = rng.int(-9, 9), a2 = rng.int(-6, 5), b2 = rng.int(-9, 9);
      const [L1, L2] = rng.pick([["ℓ", "m"], ["j", "k"], ["r", "s"], ["u", "v"]] as const);
      const P1 = [a1, b1], P2 = [a1 + d1, b1 + m1 * d1], R1 = [a2, b2], R2 = [a2 + d2, b2 + m2 * d2]; const diff = m1 - m2;
      return finish(rng, {
        stimulus: facts(rng, [[`Line ${L1} passes through ${M(`(${P1[0]}, ${P1[1]})`)} and ${M(`(${P2[0]}, ${P2[1]})`)}.`, `Line ${L1} contains the points ${M(`(${P1[0]}, ${P1[1]})`)} and ${M(`(${P2[0]}, ${P2[1]})`)}.`, `The points ${M(`(${P1[0]}, ${P1[1]})`)} and ${M(`(${P2[0]}, ${P2[1]})`)} lie on line ${L1}.`, `A line named ${L1} is drawn through ${M(`(${P1[0]}, ${P1[1]})`)} and ${M(`(${P2[0]}, ${P2[1]})`)}.`, `Two points of line ${L1} are ${M(`(${P1[0]}, ${P1[1]})`)} and ${M(`(${P2[0]}, ${P2[1]})`)}.`], [`Line ${L2} passes through ${M(`(${R1[0]}, ${R1[1]})`)} and ${M(`(${R2[0]}, ${R2[1]})`)}.`, `Line ${L2} contains the points ${M(`(${R1[0]}, ${R1[1]})`)} and ${M(`(${R2[0]}, ${R2[1]})`)}.`, `The points ${M(`(${R1[0]}, ${R1[1]})`)} and ${M(`(${R2[0]}, ${R2[1]})`)} lie on line ${L2}.`, `A second line, ${L2}, is drawn through ${M(`(${R1[0]}, ${R1[1]})`)} and ${M(`(${R2[0]}, ${R2[1]})`)}.`, `Two points of line ${L2} are ${M(`(${R1[0]}, ${R1[1]})`)} and ${M(`(${R2[0]}, ${R2[1]})`)}.`]]),
        question: spin(rng, `[[How much greater is the slope of line ${L1} than the slope of line ${L2}?|By how much does the slope of ${L1} exceed the slope of ${L2}?|What is the slope of line ${L1} minus the slope of line ${L2}?|What is the difference between the slope of ${L1} and the slope of ${L2}?|The slope of ${L1} is how much larger than the slope of ${L2}?|Subtract the slope of ${L2} from the slope of ${L1}. What is the result?]]`), correct: diff,
        wrongs: [W(m2 - m1, "sign_error", "차를 반대 순서로 계산했다."), W(m1 + m2, "formula_misuse", "차 대신 합을 구했다."), W(m1, "step_missing", "ℓ 의 기울기만 구했다."), W(m1 * m2, "formula_misuse", "기울기의 곱을 답했다."), ...near(diff)],
        verificationJs: withParams({ a1, b1, a2: P2[0], b2: P2[1], c1: R1[0], d1: R1[1], c2: R2[0], d2: R2[1] }, "const s1=(P.b2-P.b1)/(P.a2-P.a1), s2=(P.d2-P.d1)/(P.c2-P.c1);\nreturn s1-s2;"),
        trace: [T(`${L1}: $(${P2[1]} - ${pr(P1[1])}) / (${P2[0]} - ${pr(P1[0])}) = ${m1}$ 이다.`, "First slope."), T(`${L2}: $(${R2[1]} - ${pr(R1[1])}) / (${R2[0]} - ${pr(R1[0])}) = ${m2}$ 이다.`, "Second slope."), T(`${L1} 의 기울기가 더 ${m1 > m2 ? "크다" : "작다"}.`, "Compare."), T(`차는 ${m1} - ${pr(m2)} 이다.`, "Set up the difference."), T(`계산하면 ${diff} 이다.`, "Subtract.")],
        variant: "slope_difference",
      });
    },
  },
  // ======================= interpret_slope =======================
  {
    id: "lf.interpret_slope.unit_ratio", skill: SKILL, kind: "interpret_slope", operator: "unit_ratio",
    structure: "분당(초당) 변화율 a 를 시간당·다른 단위로 환산해 기울기의 의미를 다른 단위로 구함",
    extraThinking: "기울기를 변화율로 해석한 뒤 시간·양의 단위를 환산(분→시간, m→km 등) — medium 은 기울기의 의미를 같은 단위로 해석",
    concepts: ["기울기의 의미(변화율)", "단위 환산"], mediumSteps: 3,
    generate(rng) {
      type U = { fn: string; scene: string[]; what: string; unit: string; tUnit: string; event: string; ask: string[]; as: number[]; f: (a: number) => number; js: string; note: string };
      const Cs: U[] = [
        { fn: "D", scene: ["A drone flies away from its pilot.", "A delivery drone moves along a straight path."], what: "its distance from the pilot", unit: "meters", tUnit: "minutes", event: "takeoff", ask: ["By how many kilometers per hour does the distance increase?", "The distance increases by how many kilometers each hour?"], as: [50, 100, 150, 200, 250, 300], f: (a) => (a * 60) / 1000, js: "return P.a*60/1000;", note: "1시간 = 60분, 1 km = 1000 m" },
        { fn: "V", scene: ["A pump fills a tank.", "A hose fills a tank with water."], what: "the volume of water in the tank", unit: "liters", tUnit: "seconds", event: "the pump starts", ask: ["By how many liters per minute does the volume increase?", "The volume increases by how many liters each minute?"], as: [2, 3, 4, 5, 6, 8], f: (a) => a * 60, js: "return P.a*60;", note: "1분 = 60초" },
        { fn: "N", scene: ["A printer works through a job.", "A copier runs a large job."], what: "the number of pages printed", unit: "pages", tUnit: "minutes", event: "the job begins", ask: ["By how many pages per hour does the number of printed pages increase?", "The number of printed pages increases by how many pages each hour?"], as: [3, 4, 5, 6, 8, 10], f: (a) => a * 60, js: "return P.a*60;", note: "1시간 = 60분" },
        { fn: "C", scene: ["A phone plan charges by the minute.", "A calling plan bills each minute of a call."], what: "the cost of a call", unit: "cents", tUnit: "minutes", event: "the call begins", ask: ["By how many dollars per hour does the cost increase?", "The cost increases by how many dollars each hour?"], as: [5, 10, 15, 20, 25, 30], f: (a) => (a * 60) / 100, js: "return P.a*60/100;", note: "1시간 = 60분, 1 dollar = 100 cents" },
        { fn: "S", scene: ["A runner jogs along a track at a steady pace.", "A cyclist rides at a steady pace."], what: "the distance covered", unit: "meters", tUnit: "seconds", event: "the start", ask: ["By how many kilometers per hour does the distance covered increase?", "The distance covered increases by how many kilometers each hour?"], as: [5, 10, 15, 20], f: (a) => (a * 3600) / 1000, js: "return P.a*3600/1000;", note: "1시간 = 3600초, 1 km = 1000 m" },
        { fn: "B", scene: ["A conveyor belt packs boxes.", "A factory line packs boxes."], what: "the number of boxes packed", unit: "boxes", tUnit: "minutes", event: "the shift begins", ask: ["By how many boxes per hour does the number of boxes packed increase?", "The number of boxes packed increases by how many boxes each hour?"], as: [4, 5, 6, 8, 9, 12], f: (a) => a * 60, js: "return P.a*60;", note: "1시간 = 60분" },
        { fn: "W", scene: ["A leaking pipe wastes water.", "A broken valve wastes water."], what: "the amount of water wasted", unit: "gallons", tUnit: "minutes", event: "the leak starts", ask: ["By how many gallons per day does the amount of wasted water increase?", "The amount of wasted water increases by how many gallons each day?"], as: [2, 3, 4], f: (a) => a * 1440, js: "return P.a*1440;", note: "1일 = 24시간 = 1440분" },
        { fn: "R", scene: ["Snow falls steadily during a storm.", "A storm drops snow at a steady pace."], what: "the depth of snow on the ground", unit: "millimeters", tUnit: "hours", event: "the storm begins", ask: ["By how many centimeters per day does the depth of snow increase?", "The depth of snow increases by how many centimeters each day?"], as: [5, 10, 15, 20], f: (a) => (a * 24) / 10, js: "return P.a*24/10;", note: "1일 = 24시간, 1 cm = 10 mm" },
        { fn: "M", scene: ["A student saves money steadily.", "A club collects dues steadily."], what: "the total amount saved", unit: "dollars", tUnit: "weeks", event: "the first deposit", ask: ["By how many dollars per year does the total amount increase? (Use 52 weeks in a year.)", "The total amount increases by how many dollars each year? (Use 52 weeks in a year.)"], as: [3, 4, 5, 6, 8, 10], f: (a) => a * 52, js: "return P.a*52;", note: "1년 = 52주" },
      ];
      const C = rng.pick(Cs), a = rng.pick(C.as), b = rng.int(2, 40) * 5, ans = C.f(a); if (!Number.isInteger(ans)) throw new GenFail("x");
      const model = rng.pick([`The function ${M(`${C.fn}(t) = ${a}t + ${b}`)} models ${C.what}, in ${C.unit}, t ${C.tUnit} after ${C.event}.`, `Let ${M(`${C.fn}(t) = ${a}t + ${b}`)} give ${C.what}, in ${C.unit}, where t is the number of ${C.tUnit} after ${C.event}.`, `With t measured in ${C.tUnit} after ${C.event}, ${C.what} (in ${C.unit}) is modeled by ${M(`${C.fn}(t) = ${a}t + ${b}`)}.`]);
      return finish(rng, {
        stimulus: `${rng.pick(C.scene)} ${model}`, question: rng.pick(C.ask), correct: ans,
        wrongs: [W(a, "unit_error", "단위를 환산하지 않고 기울기를 그대로 답했다."), W(a * 60, "unit_error", "시간 단위만 환산하고 다른 단위 환산을 빠뜨렸다."), W(Number((a / 60).toFixed(2)), "unit_error", "환산 방향(곱할지 나눌지)을 반대로 적용했다."), W(b, "other", "절편을 변화율로 답했다."), ...near(ans)],
        verificationJs: withParams({ a }, C.js),
        trace: [T(`기울기 ${a} 는 변화율이다: t 가 1 증가할 때 함수값이 ${a} 증가한다.`, "The slope is the rate of change."), T("변화율의 단위를 읽는다(함수값 단위 / 시간 단위).", "Read the units of the rate."), T(`단위 환산 규칙을 정한다: ${C.note}.`, "Choose the conversion rules."), T("시간 단위와 양의 단위를 순서대로 환산한다.", "Convert time and quantity units."), T(`변화율은 ${ans} 이다.`, "Compute.")],
        variant: "rate_in_other_units",
      });
    },
  },
  {
    id: "lf.interpret_slope.repr_shift", skill: SKILL, kind: "interpret_slope", operator: "repr_shift",
    structure: "'x 가 p 일 때 y=u, x 가 q 일 때 y=v' 라는 선형 관계의 서술에서 변화율을 읽어 x 가 k 만큼 늘 때 y 의 변화량을 구함",
    extraThinking: "표(두 관측값)를 변화율로 번역하고 그 해석을 다른 구간에 적용 — medium 은 주어진 식에서 기울기의 의미를 읽음",
    concepts: ["표→변화율", "기울기의 의미", "변화량 = 기울기 × 증가량"], mediumSteps: 3,
    generate(rng) {
      const c = rng.pick(LMS), m = rng.nz(-7, 8), b = rng.int(10, 60); if (m < 0 && !c.canDown) throw new GenFail("x");
      const p = rng.int(1, 4), q = p + rng.int(2, 5), k = rng.int(4, 12); const u = m * p + b, v = m * q + b; if (u < 0 || v < 0) throw new GenFail("x");
      const ans = Math.abs(m) * k;
      const dirWord = m > 0 ? "increase" : "decrease";
      return finish(rng, {
        stimulus: `${c.subj} follows a linear pattern. ${rng.pick([`After ${p} ${c.xUnits}, the ${c.yName} is ${u} ${c.yUnit}, and after ${q} ${c.xUnits}, it is ${v} ${c.yUnit}.`, `The ${c.yName} is ${u} ${c.yUnit} after ${p} ${c.xUnits} and ${v} ${c.yUnit} after ${q} ${c.xUnits}.`, `Measurements show ${u} ${c.yUnit} after ${p} ${c.xUnits} and ${v} ${c.yUnit} after ${q} ${c.xUnits}.`])}`,
        question: spin(rng, `[[By how many ${c.yUnit} will the ${c.yName} ${dirWord} over ${k} ${c.xUnits}?|Over ${k} ${c.xUnits}, by how many ${c.yUnit} does the ${c.yName} ${dirWord}?|During ${k} ${c.xUnits}, the ${c.yName} will ${dirWord} by how many ${c.yUnit}?|If the pattern continues, by how many ${c.yUnit} does the ${c.yName} ${dirWord} in ${k} ${c.xUnits}?]]`), correct: ans,
        wrongs: [W(Math.abs(v - u), "step_missing", "관측 구간의 변화량을 그대로 답했다(단위 시간당으로 환산하지 않았다)."), W(Math.abs(m), "step_missing", "1 단위당 변화율만 답했다."), W(Math.abs(m) * (k + p), "formula_misuse", "증가한 구간에 시작 시점 p 를 더했다."), W(Math.abs(u) + Math.abs(m) * k, "formula_misuse", "변화량이 아니라 k 단위 뒤의 값을 구했다."), ...near(ans)],
        verificationJs: withParams({ p, u, q, v, k }, "const s=(P.v-P.u)/(P.q-P.p);\nreturn Math.abs(s*P.k);"),
        trace: [T(`x 의 변화량은 ${q} - ${p} = ${q - p} 이다.`, "Find the change in x."), T(`y 의 변화량은 ${v} - ${u} = ${v - u} 이다.`, "Find the change in y."), T(`변화율(기울기)은 ${v - u}/${q - p} = ${m} 이다.`, "Compute the rate."), T(`기울기 ${m} 은 한 단위마다 ${Math.abs(m)} ${m > 0 ? "증가" : "감소"}한다는 뜻이다.`, "Interpret the slope."), T(`${k} 단위 동안은 ${Math.abs(m)} × ${k} = ${ans} 이다.`, "Scale to the interval.")],
        variant: "rate_from_two_observations",
      });
    },
  },
  {
    id: "lf.interpret_slope.compare_scenarios", skill: SKILL, kind: "interpret_slope", operator: "compare_scenarios",
    structure: "두 맥락(A, B)의 변화율을 각각 읽고 같은 시간 h 동안 두 변화량의 차를 구함",
    extraThinking: "두 모델의 기울기를 각각 해석하고 변화량을 비교(절편은 변화량에 영향이 없음을 판단) — medium 은 모델 하나의 기울기 해석",
    concepts: ["기울기의 의미", "두 변화율 비교", "변화량 계산"], mediumSteps: 3,
    generate(rng) {
      const c = rng.pick(LMS), m1 = rng.int(4, 18), m2 = rng.int(2, m1 - 1), h = rng.int(3, 12), b1 = rng.int(5, 80), b2 = rng.int(5, 80), ans = (m1 - m2) * h;
      return finish(rng, {
        stimulus: `${rng.pick(["Two items, A and B, are tracked.", "A and B are two items that are being tracked.", "Two items called A and B are observed."])} ${rng.pick([`The ${c.yName} of A is modeled by ${M(`A(t) = ${m1}t + ${b1}`)}, and the ${c.yName} of B is modeled by ${M(`B(t) = ${m2}t + ${b2}`)}, in ${c.yUnit}, where t is the number of ${c.xUnits}.`, `With t in ${c.xUnits}, A is modeled by ${M(`A(t) = ${m1}t + ${b1}`)} and B by ${M(`B(t) = ${m2}t + ${b2}`)}, both in ${c.yUnit}.`, `Measured in ${c.yUnit}, the ${c.yName} is ${M(`A(t) = ${m1}t + ${b1}`)} for A and ${M(`B(t) = ${m2}t + ${b2}`)} for B, where t counts ${c.xUnits}.`])}`,
        question: spin(rng, `[[Over ${h} ${c.xUnits}, how many more ${c.yUnit} does A's ${c.yName} change than B's ${c.yName}?|During ${h} ${c.xUnits}, by how many more ${c.yUnit} does A's ${c.yName} change than B's?|How much greater is the change in A's ${c.yName} than the change in B's ${c.yName} over ${h} ${c.xUnits}?]]`), correct: ans,
        wrongs: [W(m1 - m2, "step_missing", "시간 h 를 곱하지 않고 기울기의 차만 답했다."), W(m1 * h, "step_missing", "B 의 변화량을 빼지 않았다."), W((m1 - m2) * h + (b1 - b2), "formula_misuse", "시작값의 차를 변화량에 더했다."), W(m1 * h + b1 - (m2 * h + b2), "formula_misuse", "변화량이 아니라 h 단위 뒤의 값의 차를 구했다."), ...near(ans)],
        verificationJs: withParams({ m1, b1, m2, b2, h }, "const A=t=>P.m1*t+P.b1, B=t=>P.m2*t+P.b2;\nconst dA=A(P.h)-A(0), dB=B(P.h)-B(0);\nreturn dA-dB;"),
        trace: [T(`A 의 기울기는 ${m1} 이므로 1 ${c.xUnit} 마다 ${m1} 씩 변한다.`, "Read A's rate."), T(`B 의 기울기는 ${m2} 이므로 1 ${c.xUnit} 마다 ${m2} 씩 변한다.`, "Read B's rate."), T(`${h} ${c.xUnits} 동안 A 는 ${m1 * h}, B 는 ${m2 * h} 변한다(절편은 변화량에 영향을 주지 않는다).`, "Scale by the time."), T("두 변화량의 차를 구한다.", "Subtract."), T(`${m1 * h} - ${m2 * h} = ${ans} 이다.`, "Compute.")],
        variant: "difference_of_changes",
      });
    },
  },
  {
    id: "lf.interpret_slope.chain2", skill: SKILL, kind: "interpret_slope", operator: "chain2",
    structure: "f 의 기울기를 읽고, g 의 기울기가 f 의 기울기의 α 배라는 관계와 g 가 지나는 점으로 g 의 식을 세워 g(r) 를 계산",
    extraThinking: "기울기 사이의 문장 관계(α 배)를 읽어 다음 단계의 입력으로 쓰는 2단계 연쇄 — medium 은 기울기의 의미를 한 번 해석",
    concepts: ["기울기 해석", "기울기 관계(문장→식)", "점과 기울기로 직선 구하기"], mediumSteps: 3,
    generate(rng) {
      const a = rng.nz(-4, 5), b = rng.int(-9, 9), al = rng.pick([2, 3, -1, -2]), gm = al * a, p = rng.int(-3, 5), qv = rng.int(-9, 12), r = rng.int(-5, 8); if (r === p || Math.abs(gm) > 14 || Math.abs(gm) === Math.abs(a)) throw new GenFail("x");
      const gb = qv - gm * p, ans = gm * r + gb; if (Math.abs(ans) > 120) throw new GenFail("x");
      const word = { 2: "twice", 3: "three times", [-1]: "the opposite of", [-2]: "twice the opposite of" }[al]!;
      const [n1, n2] = rng.pick([["f", "g"], ["h", "k"], ["u", "v"], ["r", "s"]] as const), PT = M(`(${p}, ${qv})`);
      return finish(rng, {
        stimulus: `${rng.pick([`The linear function ${n1} is defined by ${M(F(n1, a, b))}.`, `Let ${n1} be the linear function ${M(F(n1, a, b))}.`, `A linear function ${n1} is given by ${M(F(n1, a, b))}.`, `Consider the linear function ${M(F(n1, a, b))}.`, `The rule ${M(F(n1, a, b))} defines a linear function ${n1}.`])} ${rng.pick([`The graph of the linear function ${n2} has a slope equal to ${word} the slope of the graph of ${n1}, and the graph of ${n2} passes through ${PT}.`, `The slope of the graph of a linear function ${n2} is ${word} the slope of the graph of ${n1}; the graph of ${n2} goes through ${PT}.`, `A linear function ${n2} has a slope that is ${word} the slope of ${n1}, and its graph contains ${PT}.`, `The point ${PT} is on the graph of the linear function ${n2}, whose slope is ${word} the slope of ${n1}.`, `The graph of ${n2} passes through ${PT}, and its slope is ${word} that of ${n1}.`])}`,
        question: spin(rng, `[[What is the value of $${n2}(${r})$?|Find $${n2}(${r})$.|What is $${n2}(${r})$?|What does $${n2}(${r})$ equal?|Evaluate $${n2}(${r})$.|What output does ${n2} give for an input of ${r}?]]`), correct: ans,
        wrongs: [W(a * r + b, "step_missing", `${n2} 대신 ${n1} 의 함수값을 구했다.`), W(a * (r - p) + qv, "step_missing", "첫 함수의 기울기를 그대로 두 번째 함수의 기울기로 썼다."), W(-gm * (r - p) + qv, "sign_error", "기울기의 부호를 반대로 적용했다."), W(gm * r, "step_missing", "절편을 더하지 않았다."), W(gm * (r - p), "step_missing", "점의 y 값을 더하지 않았다."), ...near(ans)],
        verificationJs: withParams({ a, al, p, qv, r }, "const gm=P.al*P.a; const gb=P.qv-gm*P.p;\nreturn gm*P.r+gb;"),
        trace: [T(`${n1} 의 기울기는 ${a} 이다.`, "Read the first slope."), T(`${n2} 의 기울기는 ${word} ${a} = ${gm} 이다.`, "Translate the relation."), T(`${n2}(x) = ${gm}x + b 로 놓고 점 (${p}, ${qv}) 를 대입한다.`, "Substitute the point."), T(`b = ${qv} - ${pr(gm * p)} = ${gb} 이다.`, "Solve for b."), T(`$${n2}(${r}) = ${gm}\\cdot ${pr(r)} ${gb >= 0 ? "+" : "-"} ${Math.abs(gb)} = ${ans}$ 이다.`, "Evaluate.")],
        variant: "slope_relation_then_value",
      });
    },
  },
  {
    id: "lf.interpret_intercept.unit_ratio", skill: SKILL, kind: "interpret_intercept", operator: "unit_ratio",
    structure: "모델 T(t) = a t + b 에서 t = 0 의 값 b 가 시작값임을 읽고 다른 단위로 환산(섭씨→화씨, m→cm, km→m, 분→시간 등)",
    extraThinking: "y 절편을 '시작값'으로 해석한 뒤 단위(온도·길이·시간 등)를 환산 — medium 은 절편의 의미를 같은 단위로 해석",
    concepts: ["y 절편의 의미(시작값)", "단위 환산"], mediumSteps: 2,
    generate(rng) {
      type U = { fn: string; scene: string[]; what: string; unit: string; tUnit: string; event: string; ask: string[]; bs: number[]; f: (b: number) => number; js: string; note: string };
      const Cs: U[] = [
        { fn: "T", scene: ["A liquid is being heated.", "A sample is warmed in a lab."], what: "its temperature", unit: "degrees Celsius", tUnit: "minutes", event: "heating begins", ask: ["What was the temperature when heating began, in degrees Fahrenheit?", "Expressed in degrees Fahrenheit, what was the starting temperature?"], bs: [5, 10, 15, 20, 25, 30, 35, 40], f: (b) => (b * 9) / 5 + 32, js: "return v0*9/5+32;", note: "F = (9/5)C + 32" },
        { fn: "D", scene: ["A pond slowly rises.", "A reservoir slowly fills."], what: "its depth", unit: "meters", tUnit: "days", event: "the first measurement", ask: ["What was the depth at the first measurement, in centimeters?", "In centimeters, how deep was it at the first measurement?"], bs: [2, 3, 4, 5, 6, 7, 8], f: (b) => b * 100, js: "return v0*100;", note: "1 m = 100 cm" },
        { fn: "L", scene: ["A group is hiking.", "A class goes on a long walk."], what: "the distance walked", unit: "kilometers", tUnit: "hours", event: "noon", ask: ["How many meters had the group walked at noon?", "At noon, how far had they walked, in meters?"], bs: [2, 3, 4, 5, 6], f: (b) => b * 1000, js: "return v0*1000;", note: "1 km = 1000 m" },
        { fn: "S", scene: ["A security camera records video.", "A wildlife camera records footage."], what: "the total video recorded", unit: "minutes", tUnit: "days", event: "the camera is installed", ask: ["How many hours of video had been recorded when the camera was installed?", "In hours, how much video existed at the moment of installation?"], bs: [60, 120, 180, 240, 300], f: (b) => b / 60, js: "return v0/60;", note: "1 hour = 60 minutes" },
        { fn: "M", scene: ["A bakery tracks flour in a storage bin.", "A cafe tracks coffee beans in a bin."], what: "the mass of the supply", unit: "kilograms", tUnit: "days", event: "the first count", ask: ["What was the mass at the first count, in grams?", "In grams, how much supply was there at the first count?"], bs: [2, 3, 4, 5, 6, 7, 8], f: (b) => b * 1000, js: "return v0*1000;", note: "1 kg = 1000 g" },
        { fn: "P", scene: ["A student studies for a test.", "A student prepares for an exam."], what: "the total study time", unit: "hours", tUnit: "days", event: "the study plan starts", ask: ["How many minutes of studying had been recorded when the plan started?", "In minutes, how much study time was already recorded at the start?"], bs: [2, 3, 4, 5, 6, 8], f: (b) => b * 60, js: "return v0*60;", note: "1 hour = 60 minutes" },
        { fn: "B", scene: ["A jar collects coins.", "A fundraiser collects donations."], what: "the amount collected", unit: "dollars", tUnit: "days", event: "the first count", ask: ["How many cents were collected at the first count?", "In cents, how much had been collected at the first count?"], bs: [4, 5, 6, 8, 9, 12], f: (b) => b * 100, js: "return v0*100;", note: "1 dollar = 100 cents" },
        { fn: "H", scene: ["A rope is being let out from a ship.", "A ribbon is unrolled from a spool."], what: "the length released", unit: "feet", tUnit: "minutes", event: "the first measurement", ask: ["What was the length at the first measurement, in inches?", "In inches, what length had been released at the first measurement?"], bs: [3, 4, 5, 6, 7, 8], f: (b) => b * 12, js: "return v0*12;", note: "1 foot = 12 inches" },
      ];
      const C = rng.pick(Cs), a = rng.int(2, 9), b = rng.pick(C.bs), ans = C.f(b); if (!Number.isInteger(ans)) throw new GenFail("x");
      const model = rng.pick([`The function ${M(`${C.fn}(t) = ${a}t + ${b}`)} models ${C.what}, in ${C.unit}, t ${C.tUnit} after ${C.event}.`, `Let ${M(`${C.fn}(t) = ${a}t + ${b}`)} give ${C.what}, in ${C.unit}, where t is the number of ${C.tUnit} after ${C.event}.`, `With t measured in ${C.tUnit} after ${C.event}, ${C.what} (in ${C.unit}) is modeled by ${M(`${C.fn}(t) = ${a}t + ${b}`)}.`]);
      return finish(rng, {
        stimulus: `${rng.pick(C.scene)} ${model}`, question: rng.pick(C.ask), correct: ans,
        wrongs: [W(b, "unit_error", "단위를 환산하지 않고 절편을 그대로 답했다."), W(a, "other", "기울기를 시작값으로 답했다."), W(C.f(b + a), "other", "환산은 했지만 t = 0 이 아니라 t = 1 의 값을 썼다."), W(b + a, "other", "t = 1 일 때의 값을 시작값으로 답했다."), W(ans * 2, "unit_error", "환산 계수를 잘못 적용했다."), ...near(ans)],
        verificationJs: withParams({ a, b }, `const f=(t)=>P.a*t+P.b; const v0=f(0);\n${C.js}`),
        trace: [T("t = 0 일 때 함수값이 y 절편이므로 y 절편은 시작값이다.", "The intercept is the value at t = 0."), T(`시작값은 ${b} 이다.`, "Read the starting value."), T(`환산 규칙을 정한다: ${C.note}.`, "Choose the conversion rule."), T("규칙을 시작값에 적용한다.", "Apply the conversion."), T(`결과는 ${ans} 이다.`, "Answer.")],
        variant: "starting_value_other_units",
      });
    },
  },
  {
    id: "lf.interpret_intercept.repr_shift", skill: SKILL, kind: "interpret_intercept", operator: "repr_shift",
    structure: "두 관측값(표)에서 변화율을 구하고 거꾸로 t = 0 일 때의 값(시작값)을 구함",
    extraThinking: "표의 두 점을 직선의 식으로 번역한 뒤 t = 0 으로 외삽해 절편의 의미(시작값)를 읽음 — medium 은 식에서 절편 해석",
    concepts: ["표→직선의 식", "y 절편의 의미(시작값)"], mediumSteps: 2,
    generate(rng) {
      const c = rng.pick(LMS), m = rng.nz(-7, 8), b = rng.int(10, 80); if (m < 0 && !c.canDown) throw new GenFail("x");
      const p = rng.int(2, 5), q = p + rng.int(2, 5), u = m * p + b, v = m * q + b; if (u < 0 || v < 0) throw new GenFail("x");
      return finish(rng, {
        stimulus: `${c.subj} follows a linear pattern. ${rng.pick([`After ${p} ${c.xUnits}, the ${c.yName} is ${u} ${c.yUnit}, and after ${q} ${c.xUnits}, it is ${v} ${c.yUnit}.`, `The ${c.yName} is ${u} ${c.yUnit} after ${p} ${c.xUnits} and ${v} ${c.yUnit} after ${q} ${c.xUnits}.`, `Records show ${u} ${c.yUnit} after ${p} ${c.xUnits}, then ${v} ${c.yUnit} after ${q} ${c.xUnits}.`])}`,
        question: spin(rng, `[[What was the ${c.yName}, in ${c.yUnit}, at the very start, when 0 ${c.xUnits} had passed?|At the start, with 0 ${c.xUnits} elapsed, what was the ${c.yName}, in ${c.yUnit}?|What does the pattern say the ${c.yName} was at time 0, in ${c.yUnit}?]]`), correct: b,
        wrongs: [W(u - m, "step_missing", "한 단위만 되돌렸다."), W(u + m * p, "sign_error", "되돌릴 때 변화량의 부호를 반대로 적용했다."), W(Math.abs(m), "other", "변화율을 시작값으로 답했다."), W(u, "step_missing", "첫 관측값을 시작값으로 답했다."), W(b + m, "other", "한 단위 뒤의 값을 시작값으로 답했다."), ...near(b)],
        verificationJs: withParams({ p, u, q, v }, "const s=(P.v-P.u)/(P.q-P.p);\nreturn P.u-s*P.p;"),
        trace: [T(`변화율은 (${v} - ${u}) / (${q} - ${p}) = ${m} 이다.`, "Compute the rate."), T(`식을 y = ${m}x + b 로 놓는다.`, "Write the form."), T(`(${p}, ${u}) 를 대입하면 ${u} = ${m}·${p} + b 이다.`, "Substitute."), T(`b = ${u} - ${pr(m * p)} = ${b} 이다.`, "Solve for b."), T(`x = 0 일 때의 값 b = ${b} 이 시작값이다.`, "Interpret the intercept.")],
        variant: "extrapolate_to_start",
      });
    },
  },
  {
    id: "lf.interpret_intercept.inverse", skill: SKILL, kind: "interpret_intercept", operator: "inverse",
    structure: "변화율 m(증가·감소)과 k 단위 뒤의 값이 주어질 때 거꾸로 시작값을 구함",
    extraThinking: "정방향(시작값→현재값)을 거꾸로 되돌리는 역산에서 증가·감소 방향을 문장으로 판단 — medium 은 식에서 절편 해석",
    concepts: ["일차 모델의 시작값", "변화 방향(증가·감소) 판단", "역산"], mediumSteps: 2,
    generate(rng) {
      const c = rng.pick(LMS), m = rng.nz(-8, 9), k = rng.int(3, 12), b = rng.int(10, 90); if (m < 0 && !c.canDown) throw new GenFail("x");
      const now = b + m * k; if (now < 0) throw new GenFail("x");
      return finish(rng, {
        stimulus: `${c.subj} ${rng.pick(["changes at a constant rate", "changes steadily", "follows a steady linear trend", "changes by the same amount every " + c.xUnit])}. It ${m >= 0 ? rng.pick(c.ups)(m) : rng.pick(c.downs)(-m)}. ${rng.pick([`After ${k} ${c.xUnits}, the ${c.yName} is ${now} ${c.yUnit}.`, `Once ${k} ${c.xUnits} have passed, the ${c.yName} reads ${now} ${c.yUnit}.`, `The ${c.yName} is ${now} ${c.yUnit} after ${k} ${c.xUnits}.`])}`,
        question: spin(rng, `[[What was the ${c.yName}, in ${c.yUnit}, at the start?|At the start, what was the ${c.yName}, in ${c.yUnit}?|What was the starting ${c.yName}, in ${c.yUnit}?|How many ${c.yUnit} did the ${c.yName} equal before any ${c.xUnits} had passed?|What was the initial ${c.yName}, in ${c.yUnit}?|Working backward, what was the ${c.yName} at time 0, in ${c.yUnit}?]]`), correct: b,
        phraseBindings: [{ phrase: c.rateKey, value: Math.abs(m) }],
        wrongs: [W(now + Math.abs(m) * k * (m > 0 ? 1 : -1), "sign_error", "증가·감소 방향을 반대로 되돌렸다."), W(now, "step_missing", "k 단위 뒤의 값을 시작값으로 답했다."), W(Math.abs(m) * k, "step_missing", "변화량을 시작값으로 답했다."), W(now - Math.abs(m), "step_missing", "한 단위만 되돌렸다."), ...near(b)],
        verificationJs: withParams({ m, k, now }, "return P.now-P.m*P.k;"),
        trace: [T(`모델을 y = ${m}t + b 로 놓는다(${m >= 0 ? "증가" : "감소"}하므로 기울기는 ${m >= 0 ? "양수" : "음수"}).`, "Set up the model with the right sign."), T(`t = ${k} 일 때 값은 ${now} 이다.`, "Use the given value."), T(`${now} = ${m}·${k} + b 이다.`, "Substitute."), T(`${k} 단위 동안의 변화량은 ${m * k} 이다.`, "Compute the total change."), T(`b = ${now} - ${pr(m * k)} = ${b} 이다.`, "Solve for the start.")],
        variant: "work_backward_to_start",
      });
    },
  },
  {
    id: "lf.interpret_intercept.compare_scenarios", skill: SKILL, kind: "interpret_intercept", operator: "compare_scenarios",
    structure: "모델 A 는 식으로, 모델 B 는 두 관측값으로 주어질 때 두 모델의 시작값(절편) 차이를 구함",
    extraThinking: "서로 다른 표현(식·표)으로 주어진 두 모델에서 절편을 각각 얻어 비교 — medium 은 한 모델의 절편 해석",
    concepts: ["y 절편의 의미(시작값)", "표→직선의 식", "두 값의 비교"], mediumSteps: 2,
    generate(rng) {
      const c = rng.pick(LMS), mA = rng.int(2, 9), bA = rng.int(20, 90), mB = rng.int(2, 9), bB = rng.int(5, 60), p = rng.int(2, 4), q = p + rng.int(2, 4);
      const d = bA - bB; if (d <= 0 || mA === mB) throw new GenFail("x");
      const uB = mB * p + bB, vB = mB * q + bB;
      return finish(rng, {
        stimulus: `${rng.pick([`Two items, A and B, are tracked.`, `The ${c.yName} of two items, A and B, is tracked.`])} ${rng.pick([`For A, the ${c.yName} is modeled by ${M(`A(t) = ${mA}t + ${bA}`)}, where t is in ${c.xUnits}.`, `The model for A is ${M(`A(t) = ${mA}t + ${bA}`)}, with t measured in ${c.xUnits}.`])} ${rng.pick([`For B, the ${c.yName} is ${uB} ${c.yUnit} after ${p} ${c.xUnits} and ${vB} ${c.yUnit} after ${q} ${c.xUnits}, and B also changes at a constant rate.`, `B has a ${c.yName} of ${uB} ${c.yUnit} after ${p} ${c.xUnits} and ${vB} ${c.yUnit} after ${q} ${c.xUnits}; B changes at a constant rate.`])}`,
        question: spin(rng, `[[At the start, how many more ${c.yUnit} does A have than B?|How many more ${c.yUnit} was A's starting ${c.yName} than B's starting ${c.yName}?|What is the difference, in ${c.yUnit}, between A's starting ${c.yName} and B's?]]`), correct: d,
        wrongs: [W(bA - uB, "step_missing", "B 의 시작값이 아니라 첫 관측값과 비교했다."), W(vB - bA, "step_missing", "B 의 둘째 관측값과 비교했다."), W(bA + bB, "formula_misuse", "차 대신 합을 구했다."), W(-d, "sign_error", "차의 부호가 반대로 계산되었다."), W(mA - mB, "other", "기울기의 차를 답했다."), ...near(d)],
        verificationJs: withParams({ bA, p, uB, q, vB }, "const sB=(P.vB-P.uB)/(P.q-P.p); const bB=P.uB-sB*P.p;\nreturn P.bA-bB;"),
        trace: [T(`A 의 시작값은 y 절편 ${bA} 이다.`, "Read A's intercept."), T(`B 의 변화율은 (${vB} - ${uB}) / (${q} - ${p}) = ${mB} 이다.`, "Find B's rate."), T(`B 의 식을 y = ${mB}t + b 로 놓는다.`, "Write B's form."), T(`${uB} = ${mB}·${p} + b 에서 b = ${bB} 이다.`, "Solve for B's start."), T(`차는 ${bA} - ${bB} = ${d} 이다.`, "Subtract.")],
        variant: "equation_vs_table_start",
      });
    },
  },
];
void nz;
