// linear_equations_two_var easy/medium 원형(문장 틀 = 유사문항 그룹). easy 3 + medium 5.
import { GenFail, type Archetype } from "../types";
import { finish, lin, M, spin, withParams } from "../text";
import { near, stdEq, T, W } from "../kit-b";

const SKILL = "linear_equations_two_var";
const base = { skill: SKILL, operator: "frame" as const, mediumSteps: 0 };
const yEq = (m: number, b: number) => `y = ${lin(m, b)}`;
const pr = (n: number) => (n < 0 ? `(${n})` : String(n));
const LEADS = ["Consider the system of equations below.", "The system of equations below has exactly one solution.", "A system of two linear equations is given below.", "Look at the following system of equations.", "The two equations below form a system.", "Two lines in the xy-plane are given by the equations below.", "A student is solving the system of equations below.", "Both equations below must hold at the same time."];
const SOLVE_JS = "const sols=[];\nfor(let x=-80;x<=80;x++) for(let y=-160;y<=160;y++) if(P.a1*x+P.b1*y===P.c1&&P.a2*x+P.b2*y===P.c2) sols.push([x,y]);\nif(sols.length!==1) throw new Error('유일하지 않음');\nconst [X,Y]=sols[0];\n";
const Q_X = "[[What is the x-coordinate of the solution to the system?|What is the value of x in the solution $(x, y)$ of the system?|At what x-value do the two lines intersect?|The solution of the system is $(x, y)$. What is x?|Find x for the solution of the system.|What is the x-coordinate of the point where the lines cross?]]";
const Q_Y = "[[What is the y-coordinate of the solution to the system?|What is the value of y in the solution $(x, y)$ of the system?|At what y-value do the two lines intersect?|The solution of the system is $(x, y)$. What is y?|Find y for the solution of the system.|What is the y-coordinate of the point where the lines cross?]]";

export const L2_EM_ARCHETYPES: Archetype[] = [
  // ---------- easy ----------
  {
    ...base, id: "l2.intersection_x.e_y_form", kind: "intersection_x", difficulty: "easy",
    structure: "두 식이 y = mx + b 꼴인 연립에서 교점의 x 좌표를 구한다(작은 계수)", extraThinking: "easy 틀", concepts: ["연립방정식의 교점"],
    generate(rng) {
      const m1 = rng.nz(-3, 3), m2 = rng.nz(-3, 3), x0 = rng.int(-5, 6), b1 = rng.int(-6, 6); if (m1 === m2) throw new GenFail("x");
      const y0 = m1 * x0 + b1, b2 = y0 - m2 * x0; if (Math.abs(b2) > 15) throw new GenFail("x");
      const swap = rng.chance(0.5), e1 = M(yEq(m1, b1)), e2 = M(yEq(m2, b2));
      return finish(rng, {
        stimulus: `${rng.pick(LEADS)}\n\n${swap ? e2 : e1}\n${swap ? e1 : e2}`, question: spin(rng, Q_X), correct: x0,
        wrongs: [W(y0, "other", "교점의 y 좌표를 답했다."), W(-x0, "sign_error", "부호를 잘못 처리했다."), W(Math.round((b1 - b2) / (m1 + m2)), "sign_error", "기울기의 차 대신 합으로 나눴다."), W(b2 - b1, "step_missing", "x 의 계수 차로 나누지 않았다."), ...near(x0)],
        verificationJs: withParams({ m1, b1, m2, b2 }, "const s=[];\nfor(let x=-300;x<=300;x++) if(P.m1*x+P.b1===P.m2*x+P.b2) s.push(x);\nif(s.length!==1) throw new Error('유일하지 않음');\nreturn s[0];"),
        trace: [T(`두 식의 y 가 같으므로 $${lin(m1, b1)} = ${lin(m2, b2)}$ 이다.`, "Set the y-values equal."), T(`x 항을 모으면 $${m1 - m2}x = ${b2 - b1}$ 이다.`, "Collect the x-terms."), T(`${m1 - m2} 로 나누면 x = ${x0} 이다.`, "Solve for x.")],
        variant: "y_form_x",
      });
    },
  },
  {
    ...base, id: "l2.slope.e_slope_of_equation", kind: "slope", difficulty: "easy",
    structure: "y = mx + b 꼴의 식에서 기울기를 읽는다", extraThinking: "easy 틀", concepts: ["기울기-절편형"],
    generate(rng) {
      const m = rng.nz(-9, 10), b = rng.int(-12, 12), L = rng.pick(["ℓ", "m", "k", "n", "j", "p"]);
      return finish(rng, {
        stimulus: rng.pick([`In the xy-plane, line ${L} is the graph of ${M(yEq(m, b))}.`, `Line ${L} has the equation ${M(yEq(m, b))}.`, `A line ${L} is given by ${M(yEq(m, b))}.`, `The equation of line ${L} is ${M(yEq(m, b))}.`, `Consider the line ${L} defined by ${M(yEq(m, b))}.`, `The graph of ${M(yEq(m, b))} is line ${L}.`]), question: spin(rng, `[[What is the slope of line ${L}?|Find the slope of line ${L}.|What slope does line ${L} have?|What is the rate of change of line ${L}?|How steep is line ${L}? Give its slope.|What is the slope of the graph?]]`), correct: m,
        wrongs: [W(b, "other", "y 절편을 기울기로 답했다."), W(-m, "sign_error", "부호를 잘못 읽었다."), W(m + b, "formula_misuse", "기울기와 절편을 더했다."), W(m * b, "formula_misuse", "기울기와 절편을 곱했다."), ...near(m)],
        verificationJs: withParams({ m, b }, "const f=x=>P.m*x+P.b;\nreturn f(1)-f(0);"),
        trace: [T(`$y = mx + b$ 꼴에서 x 의 계수가 기울기이다.`, "The coefficient of x is the slope."), T(`기울기는 ${m} 이다.`, "Read it.")],
        variant: "read_slope",
      });
    },
  },
  {
    ...base, id: "l2.num_solutions.e_parallel_k", kind: "num_solutions", difficulty: "easy",
    structure: "y = ax + b 와 y = kx + d 가 해가 없으려면 기울기가 같아야 한다(k = a)", extraThinking: "easy 틀", concepts: ["평행한 직선", "해의 개수"],
    generate(rng) {
      const a = rng.nz(-8, 9), b = rng.int(-9, 9), d = rng.int(-9, 9), K = rng.pick(["k", "p", "c", "m", "a"]); if (b === d) throw new GenFail("x");
      return finish(rng, {
        stimulus: `${rng.pick([`In the system below, ${K} is a constant.`, `Consider the system below, where ${K} is a constant.`, `The system below has a constant ${K}.`, `Let ${K} be a constant in the system below.`])}\n\n${M(yEq(a, b))}\n${M(`y = ${K}x ${d >= 0 ? "+" : "-"} ${Math.abs(d)}`)}\n\n${rng.pick(["The system has no solution.", "The graphs of the two equations never intersect.", "No ordered pair satisfies both equations.", "The two lines are parallel."])}`, question: spin(rng, `[[What is the value of ${K}?|Find ${K}.|What must ${K} equal?|What value of ${K} makes this true?]]`), correct: a,
        wrongs: [W(-a, "sign_error", "부호를 잘못 처리했다."), W(b, "other", "첫 식의 절편을 답했다."), W(d, "other", "둘째 식의 절편을 답했다."), W(b - d, "formula_misuse", "절편의 차를 답했다."), ...near(a)],
        verificationJs: withParams({ a, b, d }, "const out=[];\nfor(let k=-60;k<=60;k++) if(k===P.a&&P.b!==P.d) out.push(k);\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T("해가 없으려면 두 직선이 평행해야 한다.", "No solution means parallel lines."), T(`평행하면 기울기가 같으므로 ${K} = ${a} 이다.`, "Equal slopes.")],
        variant: "parallel_k",
      });
    },
  },
  // ---------- medium ----------
  {
    ...base, id: "l2.intersection_y.m_y_form", kind: "intersection_y", difficulty: "medium",
    structure: "두 식이 y = mx + b 꼴인 연립에서 교점의 y 좌표를 구한다", extraThinking: "medium 틀", concepts: ["연립방정식의 교점", "대입"],
    generate(rng) {
      const m1 = rng.nz(-5, 6), m2 = rng.nz(-5, 6), x0 = rng.nz(-6, 7), b1 = rng.int(-9, 9); if (m1 === m2) throw new GenFail("x");
      const y0 = m1 * x0 + b1, b2 = y0 - m2 * x0; if (Math.abs(b2) > 40 || Math.abs(y0) > 60) throw new GenFail("x");
      const swap = rng.chance(0.5), e1 = M(yEq(m1, b1)), e2 = M(yEq(m2, b2));
      return finish(rng, {
        stimulus: `${rng.pick(LEADS)}\n\n${swap ? e2 : e1}\n${swap ? e1 : e2}`, question: spin(rng, Q_Y), correct: y0,
        wrongs: [W(x0, "other", "교점의 x 좌표를 답했다."), W(-y0, "sign_error", "부호를 잘못 처리했다."), W(m1 * x0, "step_missing", "절편을 더하지 않았다."), W(m1 * -x0 + b1, "sign_error", "x 의 부호를 반대로 대입했다."), ...near(y0)],
        verificationJs: withParams({ m1, b1, m2, b2 }, "const s=[];\nfor(let x=-300;x<=300;x++) if(P.m1*x+P.b1===P.m2*x+P.b2) s.push(P.m1*x+P.b1);\nif(s.length!==1) throw new Error('유일하지 않음');\nreturn s[0];"),
        trace: [T(`$${lin(m1, b1)} = ${lin(m2, b2)}$ 에서 $${m1 - m2}x = ${b2 - b1}$ 이므로 x = ${x0} 이다.`, "Solve for x."), T(`x = ${x0} 을 첫 식에 대입하면 y = ${m1}·${pr(x0)} + ${pr(b1)} = ${y0} 이다.`, "Substitute to find y.")],
        variant: "y_form_y",
      });
    },
  },
  {
    ...base, id: "l2.intersection_x.m_standard_form", kind: "intersection_x", difficulty: "medium",
    structure: "표준형 연립 ax + by = c, dx + ey = f 를 소거로 풀어 x 를 구한다", extraThinking: "medium 틀", concepts: ["연립방정식 소거", "교점"],
    generate(rng) {
      const x0 = rng.nz(-6, 7), y0 = rng.nz(-6, 7), a1 = rng.nz(-5, 6), b1 = rng.nz(-5, 6), a2 = rng.nz(-5, 6), b2 = rng.nz(-5, 6); if (a1 * b2 - a2 * b1 === 0 || Math.abs(a1) === 1 && Math.abs(b1) === 1) throw new GenFail("x");
      const c1 = a1 * x0 + b1 * y0, c2 = a2 * x0 + b2 * y0; if (Math.abs(c1) > 60 || Math.abs(c2) > 60) throw new GenFail("x");
      const swap = rng.chance(0.5), e1 = M(stdEq(a1, b1, c1)), e2 = M(stdEq(a2, b2, c2));
      return finish(rng, {
        stimulus: `${rng.pick(LEADS)}\n\n${swap ? e2 : e1}\n${swap ? e1 : e2}`, question: spin(rng, Q_X), correct: x0,
        wrongs: [W(y0, "other", "y 의 값을 답했다."), W(-x0, "sign_error", "부호를 잘못 처리했다."), W(Math.round((c1 * b2 + c2 * b1) / (a1 * b2 + a2 * b1)), "sign_error", "소거할 때 부호를 잘못 처리했다."), W(Math.round((c1 - c2) / (a1 - a2)), "formula_misuse", "두 식을 그대로 빼서 계수를 맞추지 않았다."), ...near(x0)],
        verificationJs: withParams({ a1, b1, c1, a2, b2, c2 }, SOLVE_JS + "return X;"),
        trace: [T("한 변수의 계수가 같아지도록 식에 적당한 수를 곱한다.", "Scale the equations to match a coefficient."), T("두 식을 더하거나 빼 한 변수를 소거한다.", "Add or subtract to eliminate a variable."), T(`남은 식을 풀어 x = ${x0} 를 얻는다.`, "Solve for x.")],
        variant: "standard_form_x",
      });
    },
  },
  {
    ...base, id: "l2.intercept.m_standard_form", kind: "intercept", difficulty: "medium",
    structure: "표준형 ax + by = c 의 x 절편 또는 y 절편을 구한다", extraThinking: "medium 틀", concepts: ["표준형", "절편 구하기"],
    generate(rng) {
      const a = rng.nz(-6, 7), b = rng.nz(-6, 7), t = rng.nz(-5, 6), xi = rng.chance(0.5), L = rng.pick(["ℓ", "m", "k", "n", "j"]);
      const c = (xi ? a : b) * t * (xi ? 1 : 1); if (Math.abs(c) > 70 || c === 0) throw new GenFail("x");
      const ans = xi ? c / a : c / b; if (!Number.isInteger(ans)) throw new GenFail("x");
      return finish(rng, {
        stimulus: rng.pick([`In the xy-plane, line ${L} is the graph of ${M(stdEq(a, b, c))}.`, `Line ${L} has the equation ${M(stdEq(a, b, c))}.`, `A line ${L} is given by ${M(stdEq(a, b, c))}.`, `The equation of line ${L} is ${M(stdEq(a, b, c))}.`, `Consider the line ${L} defined by ${M(stdEq(a, b, c))}.`]), question: spin(rng, xi ? `[[What is the x-intercept of line ${L}?|At what x-value does line ${L} cross the x-axis?|Line ${L} crosses the x-axis at $(x, 0)$. What is x?|What is the x-coordinate of the point where line ${L} meets the x-axis?]]` : `[[What is the y-intercept of line ${L}?|At what y-value does line ${L} cross the y-axis?|Line ${L} crosses the y-axis at $(0, y)$. What is y?|What is the y-coordinate of the point where line ${L} meets the y-axis?]]`), correct: ans,
        wrongs: [W(xi ? c / b : c / a, "other", "다른 축의 절편을 답했다."), W(-ans, "sign_error", "부호를 잘못 처리했다."), W(c, "step_missing", "계수로 나누지 않았다."), W(xi ? a : b, "other", "계수를 답했다."), ...near(ans)],
        verificationJs: withParams({ a, b, c, xi: xi ? 1 : 0 }, "const out=[];\nfor(let v=-300;v<=300;v++){ const x=P.xi?v:0, y=P.xi?0:v; if(P.a*x+P.b*y===P.c) out.push(v); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T(xi ? "x 절편은 y = 0 일 때의 x 이다." : "y 절편은 x = 0 일 때의 y 이다.", "Set the other variable to 0."), T(`${xi ? "y = 0" : "x = 0"} 을 대입하면 $${xi ? `${a}x` : `${b}y`} = ${c}$ 이다.`, "Substitute."), T(`나누면 ${ans} 이다.`, "Divide.")],
        variant: "standard_form_intercept",
      });
    },
  },
  {
    ...base, id: "l2.slope.m_standard_form", kind: "slope", difficulty: "medium",
    structure: "표준형 ax + by = c 를 y 에 대해 풀어 기울기(−a/b, 정수)를 구한다", extraThinking: "medium 틀", concepts: ["표준형", "기울기"],
    generate(rng) {
      const b = rng.pick([-4, -3, -2, 2, 3, 4, 5]), m = rng.nz(-6, 7), a = -m * b, c = b * rng.nz(-5, 6), L = rng.pick(["ℓ", "m", "k", "n", "j"]); if (Math.abs(a) > 30 || c === 0) throw new GenFail("x");
      return finish(rng, {
        stimulus: rng.pick([`In the xy-plane, line ${L} is the graph of ${M(stdEq(a, b, c))}.`, `Line ${L} has the equation ${M(stdEq(a, b, c))}.`, `A line ${L} is given by ${M(stdEq(a, b, c))}.`, `The equation of line ${L} is ${M(stdEq(a, b, c))}.`, `Consider the line ${L} defined by ${M(stdEq(a, b, c))}.`]), question: spin(rng, `[[What is the slope of line ${L}?|Find the slope of line ${L}.|What slope does line ${L} have?|What is the rate of change of line ${L}?|What is the slope of the graph?]]`), correct: m,
        wrongs: [W(-m, "sign_error", "기울기의 부호를 놓쳤다."), W(a, "other", "x 의 계수를 기울기로 답했다."), W(Math.round((-b / a) * 100) / 100, "formula_misuse", "기울기를 거꾸로(−b/a) 계산했다."), W(c / b, "other", "y 절편을 답했다."), ...near(m)],
        verificationJs: withParams({ a, b, c }, "const y=x=>(P.c-P.a*x)/P.b;\nreturn y(1)-y(0);"),
        trace: [T(`y 에 대해 풀면 $${b}y = ${c} ${a > 0 ? "-" : "+"} ${Math.abs(a)}x$ 이다.`, "Solve for y."), T(`${b} 로 나누면 x 의 계수가 기울기이다.`, "Divide by the coefficient of y."), T(`기울기는 -${pr(a)}/${pr(b)} = ${m} 이다.`, "Read the slope.")],
        variant: "standard_form_slope",
      });
    },
  },
  {
    ...base, id: "l2.intersection_sum.m_y_form_sum", kind: "intersection_sum", difficulty: "medium",
    structure: "두 식이 y = mx + b 꼴인 연립의 해에서 x + y 를 구한다", extraThinking: "medium 틀", concepts: ["연립방정식의 교점", "해의 합"],
    generate(rng) {
      const m1 = rng.nz(-5, 6), m2 = rng.nz(-5, 6), x0 = rng.nz(-6, 7), b1 = rng.int(-9, 9); if (m1 === m2) throw new GenFail("x");
      const y0 = m1 * x0 + b1, b2 = y0 - m2 * x0, S = x0 + y0; if (Math.abs(b2) > 40 || Math.abs(S) > 60 || S === 0) throw new GenFail("x");
      const swap = rng.chance(0.5), e1 = M(yEq(m1, b1)), e2 = M(yEq(m2, b2));
      return finish(rng, {
        stimulus: `${rng.pick(LEADS)}\n\n${swap ? e2 : e1}\n${swap ? e1 : e2}`, question: spin(rng, "[[What is the sum of the x-coordinate and the y-coordinate of the solution?|The solution is $(x, y)$. What is $x + y$?|What is the value of $x + y$ for the solution of the system?|Find $x + y$.|What do the coordinates of the solution add up to?|What is the sum of the two coordinates of the intersection point?]]"), correct: S,
        wrongs: [W(x0, "other", "x 좌표만 답했다."), W(y0, "other", "y 좌표만 답했다."), W(x0 - y0, "formula_misuse", "합 대신 차를 계산했다."), W(-S, "sign_error", "부호를 잘못 처리했다."), ...near(S)],
        verificationJs: withParams({ m1, b1, m2, b2 }, "const s=[];\nfor(let x=-300;x<=300;x++) if(P.m1*x+P.b1===P.m2*x+P.b2) s.push(x+P.m1*x+P.b1);\nif(s.length!==1) throw new Error('유일하지 않음');\nreturn s[0];"),
        trace: [T(`$${lin(m1, b1)} = ${lin(m2, b2)}$ 에서 x = ${x0} 이다.`, "Solve for x."), T(`y = ${m1}·${pr(x0)} + ${pr(b1)} = ${y0} 이다.`, "Find y."), T(`x + y = ${x0} + ${pr(y0)} = ${S} 이다.`, "Add.")],
        variant: "y_form_sum",
      });
    },
  },
];
