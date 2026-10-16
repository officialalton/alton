// systems_linear hard 원형 16개(substitution_solve·elimination_value·param_no_solution·word_system × 연산자 4종). 정답은 모두 수치.
// 카탈로그 밖 세부 패턴이라 kind-catalog.ts 에는 컴파일러 구현 시점에 함께 추가한다(docs/qa/2026-09-30-math-hard-archetypes.md 14절).
import { GenFail, type Archetype } from "../types";
import { SL_SPR_B_ARCHETYPES } from "./systems-linear.spr-b";
import { facts, finish, lin, M, spin, withParams } from "../text";
import { near, stdEq, T, W } from "../kit-b";

const SKILL = "systems_linear";
const pr = (n: number) => (n < 0 ? `(${n})` : String(n));
const yEq = (m: number, b: number) => `y = ${lin(m, b)}`;
const tm = (c: number, v: string) => `${c === 1 ? "" : c === -1 ? "-" : c}${v}`;
/** 표준형 연립 정수해 전수 탐색(P.a1,b1,c1,a2,b2,c2). */
const SOLVE_JS = "const sols=[];\nfor(let x=-120;x<=120;x++) for(let y=-240;y<=240;y++) if(P.a1*x+P.b1*y===P.c1&&P.a2*x+P.b2*y===P.c2) sols.push([x,y]);\nif(sols.length!==1) throw new Error('유일하지 않음');\nconst [X,Y]=sols[0];\n";
const PAIRS: { A: string; B: string; org: string; kind: string }[] = [
  { A: "adult ticket", B: "student ticket", org: "A school play", kind: "tickets" }, { A: "premium seat", B: "standard seat", org: "A concert hall", kind: "seats" },
  { A: "large pizza", B: "small pizza", org: "A fundraiser", kind: "pizzas" }, { A: "hardcover book", B: "paperback book", org: "A charity sale", kind: "books" },
  { A: "weekday pass", B: "weekend pass", org: "A museum", kind: "passes" }, { A: "family ticket", B: "single ticket", org: "A zoo", kind: "tickets" },
];
const cntW = (n: number, w: string) => `${n} ${n === 1 ? w : `${w}s`}`;

export const SL_ARCHETYPES: Archetype[] = [
  // ======================= substitution_solve =======================
  {
    id: "sl.substitution_solve.inverse", skill: SKILL, kind: "substitution_solve", operator: "inverse",
    structure: "y = ax + b 와 kx + qy = r 에서 해의 x 좌표가 주어질 때 대입으로 y 를 구하고 둘째 식에서 미지 상수 k 를 역산",
    extraThinking: "해의 일부(x 좌표)에서 대입으로 나머지를 복원한 뒤 미지 계수를 결정하는 역방향 — medium 은 두 식이 모두 주어진 대입법",
    concepts: ["대입법", "해의 의미", "미지 상수 역산"], mediumSteps: 4,
    generate(rng) {
      const a = rng.nz(-4, 5), b = rng.int(-8, 8), x0 = rng.nz(-5, 6), y0 = a * x0 + b, k = rng.nz(-5, 6), q = rng.nz(-4, 5), r = k * x0 + q * y0; if (y0 === 0 || Math.abs(r) > 80 || Math.abs(y0) > 40) throw new GenFail("x");
      const K = rng.pick(["k", "p", "c"]);
      return finish(rng, {
        stimulus: `${rng.pick([`In the system below, ${K} is a constant.`, `Consider the system below, where ${K} is a constant.`, `The system below has a constant ${K}.`, `Let ${K} be a constant in the system below.`])} ${rng.pick([`The x-coordinate of the solution to the system is ${x0}.`, `The solution $(x, y)$ of the system has ${M(`x = ${x0}`)}.`, `It is known that the system has a solution with x-coordinate ${x0}.`, `One coordinate of the solution is known: ${M(`x = ${x0}`)}.`])}\n\n${M(yEq(a, b))}\n${M(`${K}x ${q >= 0 ? "+" : "-"} ${Math.abs(q) === 1 ? "" : Math.abs(q)}y = ${r}`)}`,
        question: spin(rng, `[[What is the value of ${K}?|Find ${K}.|What must ${K} equal?|What value of ${K} gives this solution?]]`), correct: k,
        wrongs: [W(-k, "sign_error", "부호를 잘못 처리했다."), W(Math.round((r - q * x0) / x0), "formula_misuse", "y 를 구하지 않고 x 값을 y 자리에 대입했다."), W(Math.round((r + q * y0) / x0), "sign_error", "q y 항을 더해 이항했다."), W(Math.round(r / x0), "step_missing", "q y 항을 이항하지 않았다."), W(y0, "other", "y 좌표를 답했다."), ...near(k)],
        verificationJs: withParams({ a, b, q, r, x0 }, "const out=[];\nconst y=P.a*P.x0+P.b;\nfor(let k=-300;k<=300;k++) if(k*P.x0+P.q*y===P.r) out.push(k);\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T(`첫 식에 x = ${x0} 를 대입하면 y = ${a}·${pr(x0)} + ${pr(b)} = ${y0} 이다.`, "Substitute x into the first equation."), T(`해는 (${x0}, ${y0}) 이다.`, "State the solution."), T(`둘째 식에 대입하면 ${K}·${pr(x0)} + ${pr(q)}·${pr(y0)} = ${r} 이다.`, "Substitute into the second equation."), T(`${q}·${pr(y0)} = ${q * y0} 를 이항하면 ${K}·${pr(x0)} = ${r - q * y0} 이다.`, "Isolate the constant's term."), T(`${K} = ${r - q * y0}/${pr(x0)} = ${k} 이다.`, "Solve.")],
        variant: "unknown_constant_by_substitution",
      });
    },
  },
  {
    id: "sl.substitution_solve.compose_kind", skill: SKILL, kind: "substitution_solve", operator: "compose_kind",
    structure: "직사각형의 가로 x 가 세로 y 보다 d 크고 둘레가 P 일 때 대입으로 x, y 를 구하고 넓이를 계산",
    extraThinking: "문장 조건을 연립으로 세워 대입으로 풀고 기하 공식(넓이)과 합성 — medium 은 두 식이 주어진 연립에서 한 값을 구함",
    concepts: ["대입법", "직사각형 둘레", "직사각형 넓이"], mediumSteps: 4,
    generate(rng) {
      const w = rng.int(3, 14), d = rng.int(2, 9), len = w + d, P = 2 * (len + w), area = len * w; if (area > 400) throw new GenFail("x");
      const [obj, unit] = rng.pick([["garden", "meters"], ["banner", "feet"], ["poster", "inches"], ["courtyard", "yards"], ["tabletop", "centimeters"]] as const);
      return finish(rng, {
        stimulus: facts(rng, [[`A rectangular ${obj} has a length of x ${unit} and a width of y ${unit}.`, `The length of a rectangular ${obj} is x ${unit}, and its width is y ${unit}.`, `A ${obj} is a rectangle with length x ${unit} and width y ${unit}.`, `Let x and y be the length and width, in ${unit}, of a rectangular ${obj}.`], [`The length is ${d} ${unit} more than the width.`, `Its length exceeds its width by ${d} ${unit}.`, `The ${obj} is ${d} ${unit} longer than it is wide.`, `The width is ${d} ${unit} less than the length.`], [`The perimeter is ${P} ${unit}.`, `The distance around the ${obj} is ${P} ${unit}.`, `Its perimeter measures ${P} ${unit}.`, `Walking once around its edge covers ${P} ${unit}.`]]),
        question: spin(rng, `[[What is the area of the ${obj}, in square ${unit}?|Find the area of the ${obj} in square ${unit}.|How many square ${unit} does the ${obj} cover?|What is the area, in square ${unit}, of the ${obj}?]]`), correct: area,
        wrongs: [W(len + w, "formula_misuse", "둘레의 절반을 넓이로 답했다."), W(len * len, "other", "가로로 정사각형 넓이를 구했다."), W(w * w, "other", "세로로 정사각형 넓이를 구했다."), W(Math.round((P / 4) * (P / 4)), "formula_misuse", "정사각형으로 가정해 넓이를 구했다."), W(P, "step_missing", "둘레를 넓이로 답했다."), ...near(area)],
        verificationJs: withParams({ d, P }, "const out=[];\nfor(let x=1;x<=300;x++) for(let y=1;y<=300;y++) if(x-y===P.d&&2*x+2*y===P.P) out.push(x*y);\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T(`연립식: $x = y + ${d}$ 와 $2x + 2y = ${P}$ 이다.`, "Write the system."), T(`첫 식을 둘째 식에 대입하면 $2(y + ${d}) + 2y = ${P}$ 이다.`, "Substitute."), T(`정리하면 $4y + ${2 * d} = ${P}$ 이므로 y = ${w} 이다.`, "Solve for y."), T(`x = ${w} + ${d} = ${len} 이다.`, "Find x."), T(`넓이는 ${len} × ${w} = ${area} 이다.`, "Multiply.")],
        variant: "length_width_perimeter_area",
      });
    },
  },
  {
    id: "sl.substitution_solve.repr_shift", skill: SKILL, kind: "substitution_solve", operator: "repr_shift",
    structure: "'두 수의 합이 S 이고 한 수는 다른 수의 m 배보다 k 크다'는 문장을 연립으로 세워 대입으로 큰 수를 구함",
    extraThinking: "문장 관계(m 배보다 k 큼)를 식으로 정확히 번역한 뒤 대입 — medium 은 식이 주어진 대입법",
    concepts: ["문장→연립방정식", "대입법"], mediumSteps: 4,
    generate(rng) {
      const x0 = rng.int(2, 15), m = rng.int(2, 5), k = rng.int(1, 12), y0 = m * x0 + k, S = x0 + y0; if (S > 120) throw new GenFail("x");
      const mw = { 2: "twice", 3: "three times", 4: "four times", 5: "five times" }[m]!;
      const first = rng.pick([`The sum of two numbers is ${S}.`, `Two numbers add up to ${S}.`, `A pair of numbers has a sum of ${S}.`, `Two positive numbers have a total of ${S}.`, `The total of two numbers is ${S}.`, `When two numbers are added, the result is ${S}.`]);
      const second = rng.pick([`The greater number is ${k} more than ${mw} the lesser number.`, `One of them is ${k} more than ${mw} the other.`, `The larger number equals ${mw} the smaller number plus ${k}.`, `The larger is ${k} greater than ${mw} the smaller.`, `One number exceeds ${mw} the other by ${k}.`, `If the smaller number is multiplied by ${m}, adding ${k} gives the larger number.`]);
      return finish(rng, {
        stimulus: `${first} ${second}`,
        question: spin(rng, "[[What is the greater of the two numbers?|What is the larger number?|Find the greater number.|What is the value of the larger of the two numbers?|Which number is the larger of the pair?|What is the larger of these two numbers?]]"), correct: y0,
        wrongs: [W(x0, "other", "작은 수를 답했다."), W(S - k, "step_missing", "문장의 배수 관계를 반영하지 않았다."), W(m * x0, "step_missing", "상수 k 를 더하지 않았다."), W(S - m * k, "formula_misuse", "상수와 배수의 역할을 바꿨다."), W(S, "other", "합을 답했다."), ...near(y0)],
        verificationJs: withParams({ S, m, k }, "const out=[];\nfor(let x=-300;x<=300;x++){ const y=P.m*x+P.k; if(x+y===P.S) out.push(Math.max(x,y)); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T(`작은 수를 x, 큰 수를 y 라 하면 $x + y = ${S}$ 이다.`, "Define the variables and the sum equation."), T(`'${k} more than ${mw} the lesser' 는 $y = ${m}x + ${k}$ 이다.`, "Translate the relation."), T(`대입하면 $x + ${m}x + ${k} = ${S}$ 이다.`, "Substitute."), T(`$${m + 1}x = ${S - k}$ 이므로 x = ${x0} 이다.`, "Solve for x."), T(`y = ${m}·${x0} + ${k} = ${y0} 이다.`, "Find the larger number.")],
        variant: "sum_and_multiple_relation",
      });
    },
  },
  {
    id: "sl.substitution_solve.chain2", skill: SKILL, kind: "substitution_solve", operator: "chain2",
    structure: "x + y + z = T, y = x + a, z = b y 의 세 식을 연쇄 대입해 z 를 구함",
    extraThinking: "한 변수를 다른 변수로 연쇄적으로 바꿔 넣는 다단계 대입(세 변수) — medium 은 두 변수 대입법",
    concepts: ["대입법", "연쇄 대입", "세 변수 연립"], mediumSteps: 4,
    generate(rng) {
      const x0 = rng.int(1, 12), a = rng.int(1, 8), b = rng.int(2, 5), y0 = x0 + a, z0 = b * y0, T0 = x0 + y0 + z0; if (T0 > 150) throw new GenFail("x");
      const [X, Y, Z] = rng.pick([["x", "y", "z"], ["p", "q", "r"], ["u", "v", "w"], ["m", "n", "k"], ["a", "b", "c"]] as const), mult = b === 2 ? "2" : String(b);
      const eqs = rng.shuffle([M(`${X} + ${Y} + ${Z} = ${T0}`), M(`${Y} = ${X} + ${a}`), M(`${Z} = ${mult}${Y}`)]);
      const lead = rng.pick([`The numbers ${X}, ${Y}, and ${Z} satisfy the equations below.`, `Three numbers ${X}, ${Y}, and ${Z} are related by the three equations below.`, `Consider three unknowns ${X}, ${Y}, and ${Z} that make all three equations below true.`, `A system of three equations in ${X}, ${Y}, and ${Z} is given below.`, `The values ${X}, ${Y}, and ${Z} must satisfy every equation below.`, `Look at the three equations below, which involve ${X}, ${Y}, and ${Z}.`]);
      return finish(rng, {
        stimulus: `${lead}\n\n${eqs.join("\n")}`,
        question: spin(rng, `[[What is the value of ${Z}?|Find ${Z}.|What is ${Z}?|What does ${Z} equal?|Determine the value of ${Z}.|Which number is ${Z}?]]`), correct: z0,
        wrongs: [W(y0, "other", `${Y} 의 값을 답했다.`), W(x0, "other", `${X} 의 값을 답했다.`), W(b * x0, "formula_misuse", `${Z} = ${b}${X} 로 착각했다.`), W(T0 - x0 - y0 + b, "other", "계산 실수."), W(T0, "other", "합을 답했다."), ...near(z0)],
        verificationJs: withParams({ T: T0, a, b }, "const out=[];\nfor(let x=-200;x<=200;x++){ const y=x+P.a, z=P.b*y; if(x+y+z===P.T) out.push(z); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T(`둘째 식의 ${Y} = ${X} + ${a} 를 ${Z} = ${b}${Y} 에 대입하면 ${Z} = ${b}(${X} + ${a}) = ${b}${X} + ${b * a} 이다.`, "Substitute into the third equation."), T(`합의 식에 ${Y} 와 ${Z} 를 모두 ${X} 로 바꾼다: ${X} + (${X} + ${a}) + (${b}${X} + ${b * a}) = ${T0}.`, "Substitute both into the sum equation."), T(`정리하면 $${b + 2}${X} + ${a + b * a} = ${T0}$ 이다.`, "Combine like terms."), T(`${X} = ${x0} 이다.`, "Solve for the first variable."), T(`${Y} = ${y0}, ${Z} = ${b}·${y0} = ${z0} 이다.`, "Back-substitute.")],
        variant: "three_variable_chain",
      });
    },
  },
  {
    id: "sl.elimination_value.inverse", skill: SKILL, kind: "elimination_value", operator: "inverse",
    structure: "a1 x + b1 y = c1, kx + b2 y = c2 에서 해의 x 좌표가 주어질 때 첫 식으로 y 를 구하고 둘째 식에서 k 를 역산",
    extraThinking: "해의 일부에서 나머지를 복원한 뒤 미지 계수를 결정하는 역방향 — medium 은 두 식이 모두 주어진 소거법",
    concepts: ["소거법", "해의 의미", "미지 상수 역산"], mediumSteps: 4,
    generate(rng) {
      const x0 = rng.nz(-5, 6), y0 = rng.nz(-5, 6), a1 = rng.nz(-5, 6), b1 = rng.nz(-5, 6), b2 = rng.nz(-5, 6), k = rng.nz(-5, 6), c1 = a1 * x0 + b1 * y0, c2 = k * x0 + b2 * y0;
      if (Math.abs(c1) > 60 || Math.abs(c2) > 60 || Math.abs(b1) === 1 || b2 === b1) throw new GenFail("x"); const K = rng.pick(["k", "p", "c"]);
      return finish(rng, {
        stimulus: `${rng.pick([`In the system below, ${K} is a constant.`, `Consider the system below, where ${K} is a constant.`, `The system below has a constant ${K}.`])} ${rng.pick([`The x-coordinate of the solution to the system is ${x0}.`, `The solution $(x, y)$ of the system has ${M(`x = ${x0}`)}.`, `It is known that the system has a solution with x-coordinate ${x0}.`])}\n\n${M(stdEq(a1, b1, c1))}\n${M(`${K}x ${b2 >= 0 ? "+" : "-"} ${Math.abs(b2)}y = ${c2}`)}`,
        question: spin(rng, `[[What is the value of ${K}?|Find ${K}.|What must ${K} equal?|What value of ${K} gives this solution?]]`), correct: k,
        wrongs: [W(-k, "sign_error", "부호를 잘못 처리했다."), W(Math.round((c2 - b2 * x0) / x0), "formula_misuse", "y 를 구하지 않고 x 값을 y 자리에 대입했다."), W(Math.round((c2 + b2 * y0) / x0), "sign_error", "b2 y 항을 더해 이항했다."), W(y0, "other", "y 좌표를 답했다."), W(Math.round(c2 / x0), "step_missing", "b2 y 항을 이항하지 않았다."), ...near(k)],
        verificationJs: withParams({ a1, b1, c1, b2, c2, x0 }, "const out=[];\nfor(let y=-300;y<=300;y++){ if(P.a1*P.x0+P.b1*y!==P.c1) continue; for(let k=-300;k<=300;k++) if(k*P.x0+P.b2*y===P.c2) out.push(k); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T(`첫 식에 x = ${x0} 를 대입하면 $${a1}\\cdot ${pr(x0)} ${b1 >= 0 ? "+" : "-"} ${Math.abs(b1)}y = ${c1}$ 이다.`, "Substitute x into the first equation."), T(`상수를 이항하면 $${b1}y = ${c1 - a1 * x0}$ 이다.`, "Isolate the y-term."), T(`y = ${y0} 이다.`, "Solve for y."), T(`둘째 식에 대입하면 ${K}·${pr(x0)} + ${pr(b2)}·${pr(y0)} = ${c2} 이다.`, "Substitute into the second equation."), T(`${K} = (${c2} - ${pr(b2 * y0)}) / ${pr(x0)} = ${k} 이다.`, "Solve.")],
        variant: "unknown_coefficient_by_elimination",
      });
    },
  },
  {
    id: "sl.elimination_value.chain2", skill: SKILL, kind: "elimination_value", operator: "chain2",
    structure: "소거로 x 를 구하고 대입으로 y 를 구한 뒤 px + qy 의 값을 계산",
    extraThinking: "소거→대입→식의 값으로 이어지는 3단계 연쇄(묻는 값이 해가 아닌 해의 결합) — medium 은 해 하나를 구함",
    concepts: ["소거법", "대입으로 나머지 구하기", "식의 값 계산"], mediumSteps: 4,
    generate(rng) {
      const x0 = rng.nz(-6, 7), y0 = rng.nz(-6, 7), a1 = rng.pick([2, 3, 4, -2, -3]), b1 = rng.pick([2, 3, 5, -2, -3, -5]), a2 = rng.pick([1, 2, 3, -1, -2, -4]), b2 = rng.pick([1, 2, 3, -1, -4]); if (a1 * b2 - a2 * b1 === 0) throw new GenFail("x");
      const c1 = a1 * x0 + b1 * y0, c2 = a2 * x0 + b2 * y0, p = rng.pick([2, 3, -2, 4, 5]), q = rng.pick([1, -1, 2, -3, 3]), ans = p * x0 + q * y0; if (Math.abs(c1) > 70 || Math.abs(c2) > 70 || Math.abs(ans) > 90) throw new GenFail("x");
      return finish(rng, {
        stimulus: `${rng.pick(["Consider the system of equations below.", "The system of equations below has exactly one solution.", "A system of two linear equations is given below.", "Look at the following system of equations."])}\n\n${M(stdEq(a1, b1, c1))}\n${M(stdEq(a2, b2, c2))}\n\n${rng.pick(["The solution of the system is $(x, y)$.", "Let $(x, y)$ be the solution of the system.", "The ordered pair $(x, y)$ satisfies both equations."])}`,
        question: spin(rng, `[[What is the value of $${tm(p, "x")} ${q >= 0 ? "+" : "-"} ${Math.abs(q) === 1 ? "" : Math.abs(q)}y$?|Find the value of $${tm(p, "x")} ${q >= 0 ? "+" : "-"} ${Math.abs(q) === 1 ? "" : Math.abs(q)}y$.|What does $${tm(p, "x")} ${q >= 0 ? "+" : "-"} ${Math.abs(q) === 1 ? "" : Math.abs(q)}y$ equal?]]`), correct: ans,
        wrongs: [W(p * y0 + q * x0, "formula_misuse", "x 와 y 의 값을 서로 바꿔 계산했다."), W(p * x0, "step_missing", "y 항을 더하지 않았다."), W(x0 + y0, "other", "x + y 를 답했다."), W(-ans, "sign_error", "부호를 잘못 처리했다."), W(p * x0 - q * y0, "sign_error", "y 항의 부호를 바꿨다."), ...near(ans)],
        verificationJs: withParams({ a1, b1, c1, a2, b2, c2, p, q }, SOLVE_JS + "return P.p*X+P.q*Y;"),
        trace: [T("한 변수가 소거되도록 식에 적당한 수를 곱한다.", "Scale the equations."), T("두 식을 더하거나 빼 한 변수를 소거한다.", "Add or subtract to eliminate."), T(`남은 식을 풀어 x = ${x0} 를 얻는다.`, "Solve for x."), T(`x = ${x0} 를 한 식에 대입해 y = ${y0} 를 얻는다.`, "Back-substitute for y."), T(`$${p}\\cdot ${pr(x0)} ${q >= 0 ? "+" : "-"} ${Math.abs(q)}\\cdot ${pr(y0)} = ${ans}$ 이다.`, "Evaluate the requested expression.")],
        variant: "eliminate_then_evaluate_expression",
      });
    },
  },
  {
    id: "sl.elimination_value.constraint_select", skill: SKILL, kind: "elimination_value", operator: "constraint_select",
    structure: "x + y = c, kx − y = d 에서 1 ≤ k ≤ N 인 정수 k 중 해가 양의 정수가 되는 k 를 골라 합을 구함",
    extraThinking: "두 식을 더해 (k+1)x = c+d 로 만든 뒤 약수·양수 조건으로 후보 k 를 선별 — medium 은 해 하나를 구함",
    concepts: ["소거법", "약수 조건(정수 해)", "후보 선택과 합산"], mediumSteps: 4,
    generate(rng) {
      const c = rng.int(8, 30), d = rng.int(-6, 20), N = rng.int(8, 16), ks: number[] = [];
      for (let k = 1; k <= N; k++) { const sm = c + d, den = k + 1; if (sm % den === 0) { const x = sm / den, y = c - x; if (x > 0 && y > 0) ks.push(k); } }
      if (ks.length < 2 || ks.length > 6) throw new GenFail("x"); const sum = ks.reduce((p, v) => p + v, 0);
      const K = rng.pick(["k", "m", "t", "c"]), dEq = `${K}x - y = ${d}`, swap = rng.chance(0.5);
      return finish(rng, {
        stimulus: `${rng.pick([`In the system below, ${K} is an integer with 1 ≤ ${K} ≤ ${N}.`, `For the system below, ${K} is a whole number from 1 to ${N}.`, `The constant ${K} in the system below is a positive integer no larger than ${N}.`, `Let ${K} be an integer between 1 and ${N}, inclusive, in the system below.`, `The system below depends on an integer ${K} from 1 through ${N}.`])} ${rng.pick([`For some values of ${K}, the solution $(x, y)$ has two positive integer coordinates.`, `Only some values of ${K} give a solution whose coordinates are both positive integers.`, `Consider the values of ${K} for which x and y are both positive integers.`, `A value of ${K} is called good when the solution consists of two positive integers.`, `Some choices of ${K} make both x and y positive whole numbers.`])}\n\n${M(swap ? dEq : `x + y = ${c}`)}\n${M(swap ? `x + y = ${c}` : dEq)}`,
        question: spin(rng, `[[What is the sum of all such values of ${K}?|Adding every such value of ${K} gives what total?|What is the total of the good values of ${K}?|If all such values of ${K} are added together, what is the result?|What do all the possible values of ${K} add up to?|What is the sum of the values of ${K} that work?]]`), correct: sum,
        wrongs: [W(ks.length, "other", "가능한 k 의 개수를 답했다."), W(sum - ks[ks.length - 1], "condition_ignored", "마지막 후보를 빠뜨렸다."), W(sum + ks[ks.length - 1] + 1, "condition_ignored", "양수 조건을 지키지 않은 k 를 포함했다."), W(ks[ks.length - 1], "other", "가장 큰 k 만 답했다."), W(c + d, "step_missing", "(k+1) 로 나누는 조건을 쓰지 않고 합을 답했다."), ...near(sum)],
        verificationJs: withParams({ c, d, N }, "let total=0, cnt=0;\nfor(let k=1;k<=P.N;k++){ let ok=false; for(let x=1;x<=400&&!ok;x++){ const y=P.c-x; if(y>=1&&k*x-y===P.d) ok=true; } if(ok){ total+=k; cnt++; } }\nif(!cnt) throw new Error('후보 없음');\nreturn total;"),
        trace: [T(`두 식을 더하면 y 가 소거된다: $(${K} + 1)x = ${c + d}$ 이다.`, "Add the equations to eliminate y."), T(`x = ${c + d}/(${K} + 1) 이 양의 정수여야 한다.`, "x must be a positive integer."), T(`${K} + 1 은 ${c + d} 의 약수여야 한다.`, `${K} + 1 must divide the sum.`), T(`y = ${c} - x 도 양수여야 하므로 x < ${c} 이다.`, "y must also be positive."), T(`조건을 모두 만족하는 ${K} 는 ${ks.join(", ")} 이고 합은 ${sum} 이다.`, "Add the valid values.")],
        variant: "positive_integer_solutions_sum_of_k",
      });
    },
  },
  {
    id: "sl.elimination_value.compare_scenarios", skill: SKILL, kind: "elimination_value", operator: "compare_scenarios",
    structure: "두 연립 x + y = s1, x − y = d1 과 x + y = s2, x − y = d2 를 각각 소거로 풀어 x 값의 차를 구함",
    extraThinking: "서로 다른 두 연립의 해를 각각 구해 비교(차) — medium 은 연립 하나의 해",
    concepts: ["소거법", "두 해의 비교"], mediumSteps: 4,
    generate(rng) {
      const xa = rng.int(-4, 12), ya = rng.int(-4, 12), xb = rng.int(-4, 12), yb = rng.int(-4, 12); if (xa === xb) throw new GenFail("x");
      const s1 = xa + ya, d1 = xa - ya, s2 = xb + yb, d2 = xb - yb, ans = xa - xb; if (ans <= 0) throw new GenFail("x");
      const [X, Y] = rng.pick([["x", "y"], ["m", "n"], ["a", "b"], ["p", "q"]] as const), sd = (sv: number, dv: number) => `${M(`${X} + ${Y} = ${sv}`)} and ${M(`${X} - ${Y} = ${dv}`)}`;
      return finish(rng, {
        stimulus: `${rng.pick(["Two systems of equations are described below.", "Consider the two systems described below.", "System A and system B are described below.", "A student studies two different systems of equations."])} ${rng.pick([`System A consists of the equations ${sd(s1, d1)}.`, `System A is made of ${sd(s1, d1)}.`, `The equations of system A are ${sd(s1, d1)}.`])} ${rng.pick([`System B consists of the equations ${sd(s2, d2)}.`, `System B is made of ${sd(s2, d2)}.`, `The equations of system B are ${sd(s2, d2)}.`])}`,
        question: spin(rng, `[[How much greater is the ${X}-value of the solution of system A than the ${X}-value of the solution of system B?|By how much does the ${X}-value in the solution of A exceed the ${X}-value in the solution of B?|What is the ${X}-value of A's solution minus the ${X}-value of B's solution?|The ${X}-value of A's solution is how much larger than that of B's?|Subtract B's ${X}-value from A's ${X}-value. What is the result?|What is the difference between the ${X}-values of the two solutions, A minus B?]]`), correct: ans,
        wrongs: [W(-ans, "sign_error", "차를 반대 순서로 계산했다."), W(ya - yb, "other", "y 값의 차를 답했다."), W(xa + xb, "formula_misuse", "차 대신 합을 구했다."), W(xa, "step_missing", "A 의 x 만 구했다."), W(s1 - s2, "formula_misuse", "합 식의 상수항 차를 답했다."), ...near(ans)],
        verificationJs: withParams({ s1, d1, s2, d2 }, "const xA=(P.s1+P.d1)/2, xB=(P.s2+P.d2)/2;\nreturn xA-xB;"),
        trace: [T(`A 의 두 식을 더하면 $2${X} = ${s1 + d1}$ 이므로 ${X} = ${xa} 이다.`, "Solve A by adding."), T(`A 의 ${Y} 는 ${s1} - ${xa} = ${ya} 이다.`, "Find A's second value."), T(`B 의 두 식을 더하면 $2${X} = ${s2 + d2}$ 이므로 ${X} = ${xb} 이다.`, "Solve B by adding."), T("두 해의 같은 좌표(첫째 변수)를 비교한다.", "Compare the same coordinate."), T(`${xa} - ${pr(xb)} = ${ans} 이다.`, "Subtract.")],
        variant: "difference_of_two_solutions",
      });
    },
  },
  {
    id: "sl.param_no_solution.param_condition", skill: SKILL, kind: "param_no_solution", operator: "param_condition",
    structure: "kx + py = a, ux + (k + s)y = b 가 해가 없으려면 k(k + s) = pu (평행 조건), k 가 양수라는 조건으로 근을 고름",
    extraThinking: "평행 조건이 k 에 대한 이차식이 되어 두 근 중 부호 조건에 맞는 것을 선택하고 상수항의 불일치까지 확인 — medium 은 일차 조건",
    concepts: ["연립방정식의 해의 개수", "평행 조건(교차곱)", "이차방정식의 근 선택"], mediumSteps: 4,
    generate(rng) {
      const k0 = rng.int(2, 6), s = rng.int(1, 5), M0 = k0 * (k0 + s), divs: number[] = []; for (let d = 1; d <= M0; d++) if (M0 % d === 0) divs.push(d);
      const p = rng.pick(divs.filter((d) => d > 1 && d < M0)) ?? 0; if (!p) throw new GenFail("x"); const u = M0 / p, a = rng.nz(-12, 13), b = rng.nz(-12, 13); if (a * u === k0 * b) throw new GenFail("x");
      const K = rng.pick(["k", "p", "c"]).replace("p", "t"); const ans = k0;
      return finish(rng, {
        stimulus: `${rng.pick([`In the system below, ${K} is a positive constant.`, `Consider the system below, where ${K} is a positive constant.`, `The system below has a positive constant ${K}.`, `Let ${K} be a positive constant in the system below.`])}\n\n${M(`${K}x + ${p}y = ${a}`)}\n${M(`${u}x + (${K} + ${s})y = ${b}`)}\n\n${rng.pick(["The system has no solution.", "The graphs of the two equations never intersect.", "No ordered pair satisfies both equations."])}`,
        question: spin(rng, `[[What is the value of ${K}?|Find ${K}.|What must ${K} equal?|What positive value of ${K} makes this true?]]`), correct: ans,
        wrongs: [W(-(k0 + s), "condition_ignored", "다른 근(음수)을 골랐다."), W(p, "other", "계수 p 를 답했다."), W(u, "other", "계수 u 를 답했다."), W(s, "other", "상수 s 를 답했다."), W(Math.round((p * u) / (k0 + s)), "formula_misuse", "이차식을 풀지 않고 나눗셈으로 어림했다."), ...near(ans)],
        verificationJs: withParams({ p, u, s, a, b }, "const out=[];\nfor(let k=1;k<=80;k++){ const det=k*(k+P.s)-P.p*P.u; if(det!==0) continue; const incons=!(k*P.b-P.u*P.a===0&&P.p*P.b-(k+P.s)*P.a===0); if(incons) out.push(k); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T("해가 없으려면 두 직선이 평행(교차곱 = 0)하고 일치하지 않아야 한다.", "No solution means parallel and distinct lines."), T(`교차곱: $${K}(${K} + ${s}) - ${p}\\cdot ${u} = 0$ 이다.`, "Set the cross product to zero."), T(`정리하면 $${K}^2 + ${s}${K} - ${p * u} = 0$ 이다.`, "Form the quadratic."), T(`인수분해하면 (${K} - ${k0})(${K} + ${k0 + s}) = 0 이므로 ${K} = ${k0} 또는 ${K} = -${k0 + s} 이다.`, "Factor."), T(`${K} 는 양수이므로 ${K} = ${k0} 이고 상수항이 비례하지 않아 해가 없다.`, "Choose the positive root and check inconsistency.")],
        variant: "parallel_quadratic_in_k",
      });
    },
  },
  {
    id: "sl.param_no_solution.inverse", skill: SKILL, kind: "param_no_solution", operator: "inverse",
    structure: "px + qy = r 과 kx + λqy = m 이 무수히 많은 해를 가질 때 비례 관계로 k 와 m 을 구하고 k + m 을 계산",
    extraThinking: "해의 개수 조건에서 두 식의 비례 관계를 거꾸로 세워 두 미지 상수를 결정 — medium 은 해의 개수 판정",
    concepts: ["연립방정식의 해의 개수", "비례 관계", "미지 상수 역산"], mediumSteps: 4,
    generate(rng) {
      const lam = rng.pick([2, 3, 4, -2]), p = rng.nz(-5, 6), q = rng.nz(-5, 6), r = rng.nz(-9, 10), k = lam * p, m = lam * r; if (Math.abs(lam * q) > 25 || Math.abs(k) > 25 || Math.abs(m) > 60 || Math.abs(lam) === 1 || Math.abs(p) === 1 && Math.abs(q) === 1) throw new GenFail("x");
      const [K, MM] = rng.pick([["k", "m"], ["a", "b"], ["r", "s"], ["c", "d"]] as const), ans = k + m;
      return finish(rng, {
        stimulus: `${rng.pick([`In the system below, ${K} and ${MM} are constants.`, `Consider the system below, where ${K} and ${MM} are constants.`, `The system below contains the constants ${K} and ${MM}.`, `Let ${K} and ${MM} be constants in the system below.`])}\n\n${M(stdEq(p, q, r))}\n${M(`${K}x ${lam * q >= 0 ? "+" : "-"} ${Math.abs(lam * q)}y = ${MM}`)}\n\n${rng.pick(["The system has infinitely many solutions.", "The two equations have exactly the same graph.", "Every ordered pair that satisfies one equation also satisfies the other.", "The graphs of the two equations coincide."])}`,
        question: spin(rng, `[[What is the value of ${K} + ${MM}?|Find ${K} + ${MM}.|What is the sum of ${K} and ${MM}?|What does ${K} + ${MM} equal?]]`), correct: ans,
        wrongs: [W(k - m, "formula_misuse", "합 대신 차를 계산했다."), W(k, "step_missing", `${MM} 를 구하지 않았다.`), W(m, "step_missing", `${K} 를 구하지 않았다.`), W(lam, "other", "비례 상수를 답했다."), W(p + r, "other", "첫 식의 계수와 상수를 더했다."), ...near(ans)],
        verificationJs: withParams({ p, q, r, lq: lam * q }, "const out=[];\nfor(let k=-200;k<=200;k++) for(let m=-300;m<=300;m++){ const l1=[P.p,P.q,P.r], l2=[k,P.lq,m]; const det=l1[0]*l2[1]-l1[1]*l2[0]; const c1=l1[0]*l2[2]-l1[2]*l2[0], c2=l1[1]*l2[2]-l1[2]*l2[1]; if(det===0&&c1===0&&c2===0) out.push(k+m); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T("해가 무수히 많으면 두 식이 비례한다.", "Infinitely many solutions mean proportional equations."), T(`y 의 계수 비는 ${lam * q}/${q} = ${lam} 이다.`, "Find the ratio from the y-coefficients."), T(`x 의 계수도 같은 비이므로 ${K} = ${lam}·${pr(p)} = ${k} 이다.`, "Scale the x-coefficient."), T(`상수항도 같은 비이므로 ${MM} = ${lam}·${pr(r)} = ${m} 이다.`, "Scale the constant."), T(`${K} + ${MM} = ${k} + ${pr(m)} = ${ans} 이다.`, "Add.")],
        variant: "infinitely_many_proportional",
      });
    },
  },
  {
    id: "sl.param_no_solution.constraint_select", skill: SKILL, kind: "param_no_solution", operator: "constraint_select",
    structure: "ax + ky = c1, kx + by = c2 (ab = s²) 에서 k = ±s 일 때 평행해지며, 상수항이 비례하면 무수히 많고 아니면 해가 없음을 각각 판정해 해가 없는 k 들의 합을 구함",
    extraThinking: "평행한 두 후보 k 에서 상수항 비례 여부를 따로 확인해 '해 없음'과 '무수히 많음'을 구분하고 해당하는 k 만 선택 — medium 은 일차 조건",
    concepts: ["연립방정식의 해의 개수", "평행 조건", "해 없음과 무한해의 구분"], mediumSteps: 4,
    generate(rng) {
      const s = rng.int(2, 6), divs: number[] = []; for (let d = 1; d <= s * s; d++) if ((s * s) % d === 0) divs.push(d); const a = rng.pick(divs), b = (s * s) / a, N = rng.int(s, s + 5), t = rng.nz(-4, 5), mode = rng.pick(["inf_plus", "inf_minus", "none_both"] as const);
      let c1: number, c2: number; if (mode === "inf_plus") { c2 = s * t; c1 = a * t; } else if (mode === "inf_minus") { c2 = s * t; c1 = -a * t; } else { c2 = rng.nz(-9, 10); c1 = rng.nz(-12, 13); if (c1 * s === a * c2 || c1 * s === -a * c2) throw new GenFail("x"); }
      if (Math.abs(c1) > 40 || Math.abs(c2) > 40 || c1 === 0 || c2 === 0) throw new GenFail("x");
      let sum = 0; for (let k = -N; k <= N; k++) { const det = a * b - k * k; if (det !== 0) continue; const cons = a * c2 - k * c1 === 0 && b * c1 - k * c2 === 0; if (!cons) sum += k; }
      const K = rng.pick(["k", "m", "t", "c"]), e1 = M(`${a}x + ${K}y = ${c1}`), e2 = M(`${K}x + ${b}y = ${c2}`), swap = rng.chance(0.5);
      return finish(rng, {
        stimulus: `${rng.pick([`In the system below, ${K} is an integer with ${-N} ≤ ${K} ≤ ${N}.`, `For the system below, ${K} is an integer from ${-N} to ${N}, inclusive.`, `The constant ${K} in the system below is a whole number between ${-N} and ${N}, inclusive.`, `Let ${K} be any integer from ${-N} through ${N} in the system below.`, `The system below depends on an integer ${K} that is at least ${-N} and at most ${N}.`])} ${rng.pick(["Some values of the integer may make the two lines parallel.", "For certain values the two graphs are parallel lines, and then the system has either no solution or infinitely many.", "A few values make the lines parallel, which must be examined carefully.", "The number of solutions of the system depends on the integer chosen."])}\n\n${swap ? e2 : e1}\n${swap ? e1 : e2}`,
        question: spin(rng, `[[What is the sum of all values of ${K} for which the system has no solution?|Adding every value of ${K} that gives no solution results in what total?|What is the total of the values of ${K} for which the two lines never intersect?|If all values of ${K} that make the system have no solution are added, what is the sum?|What do the values of ${K} with no solution add up to?|The system has no solution for certain values of ${K}. What is their sum?]]`), correct: sum,
        wrongs: [W(0, "condition_ignored", "해가 없는 값과 무수히 많은 값을 구분하지 않고 ±k 를 모두 더했다."), W(s, "condition_ignored", "양의 값만 골랐다."), W(-s, "condition_ignored", "음의 값만 골랐다."), W(2 * s, "other", "두 값의 절댓값을 더했다."), W(a * b, "other", "곱 ab 를 답했다."), ...near(sum)].filter((w, i, arr) => arr.findIndex((x) => x.v === w.v) === i),
        verificationJs: withParams({ a, b, c1, c2, N }, "let sum=0;\nfor(let k=-P.N;k<=P.N;k++){ const det=P.a*P.b-k*k; if(det!==0) continue; const cons=(P.a*P.c2-k*P.c1===0)&&(P.b*P.c1-k*P.c2===0); if(!cons) sum+=k; }\nreturn sum;"),
        trace: [T(`평행하려면 교차곱이 0 이어야 한다: $${a}\\cdot ${b} - ${K}^2 = 0$ 이다.`, "Set the cross product to zero."), T(`${K}^2 = ${s * s} 이므로 ${K} = ${s} 또는 ${K} = -${s} 이다.`, "Find the parallel candidates."), T(`${K} = ${s} 에서 상수항이 비례하는지 확인한다.`, "Check the constants for the positive candidate."), T(`${K} = -${s} 에서 상수항이 비례하는지 확인한다.`, "Check the constants for the negative candidate."), T(`비례하지 않는 후보만 해가 없다. 그 합은 ${sum} 이다.`, "Sum the candidates with no solution.")],
        variant: "no_solution_vs_infinite_candidates",
      });
    },
  },
  {
    id: "sl.param_no_solution.compose_kind", skill: SKILL, kind: "param_no_solution", operator: "compose_kind",
    structure: "y = ax + b 와 kx + py = c 가 해가 없고 kx + py = c 가 점 (x0, y0) 을 지날 때 평행 조건으로 k 를 구하고 점 대입으로 c 를 계산",
    extraThinking: "해가 없다는 조건(평행)과 직선이 지나는 점 조건을 합성해 두 미지 상수를 차례로 결정 — medium 은 일차 조건",
    concepts: ["연립방정식의 해의 개수(평행)", "점 대입", "미지 상수 결정"], mediumSteps: 4,
    generate(rng) {
      const a = rng.nz(-4, 5), b = rng.int(-9, 9), p = rng.pick([2, 3, 4, 5, -2, -3]), k = -a * p, x0 = rng.nz(-5, 6), y0 = rng.nz(-6, 7), c = k * x0 + p * y0; if (c === p * b || Math.abs(c) > 70 || Math.abs(k) > 25) throw new GenFail("x");
      const [K, C] = rng.pick([["k", "c"], ["m", "n"], ["r", "s"]] as const);
      return finish(rng, {
        stimulus: `${rng.pick([`In the system below, ${K} and ${C} are constants.`, `Consider the system below, where ${K} and ${C} are constants.`, `The system below contains the constants ${K} and ${C}.`])}\n\n${M(yEq(a, b))}\n${M(`${K}x ${p >= 0 ? "+" : "-"} ${Math.abs(p)}y = ${C}`)}\n\n${rng.pick(["The system has no solution.", "The graphs of the two equations never intersect.", "No ordered pair satisfies both equations."])} ${rng.pick([`The graph of the second equation passes through the point ${M(`(${x0}, ${y0})`)}.`, `The point ${M(`(${x0}, ${y0})`)} lies on the graph of the second equation.`, `The second equation is satisfied by ${M(`x = ${x0}`)} and ${M(`y = ${y0}`)}.`])}`,
        question: spin(rng, `[[What is the value of ${C}?|Find ${C}.|What must ${C} equal?|What is ${C}?]]`), correct: c,
        wrongs: [W(-c, "sign_error", "부호를 잘못 처리했다."), W(a * x0 + b + p * y0, "formula_misuse", "평행 조건을 쓰지 않고 첫 식의 값을 사용했다."), W(-k * x0 + p * y0, "sign_error", "k 의 부호를 반대로 적용했다."), W(k, "other", "k 를 답했다."), W(p * y0, "step_missing", "k x0 항을 더하지 않았다."), ...near(c)],
        verificationJs: withParams({ a, b, p, x0, y0 }, "const out=[];\nfor(let k=-200;k<=200;k++){ if(Math.abs(-k/P.p-P.a)>1e-9) continue; const c=k*P.x0+P.p*P.y0; if(Math.abs(c/P.p-P.b)>1e-9) out.push(c); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T(`첫 식의 기울기는 ${a} 이다.`, "Read the first slope."), T(`해가 없으면 기울기가 같다: -${K}/${pr(p)} = ${a} 이다.`, "Equal slopes give no solution."), T(`${K} = ${k} 이다.`, "Solve for the first constant."), T(`점 (${x0}, ${y0}) 를 둘째 식에 대입하면 ${C} = ${k}·${pr(x0)} + ${pr(p)}·${pr(y0)} 이다.`, "Substitute the point."), T(`${C} = ${c} 이다(절편이 달라 해가 없다).`, "Compute the constant.")],
        variant: "parallel_then_point_constant",
      });
    },
  },
  // ======================= word_system =======================
  {
    id: "sl.word_system.repr_shift", skill: SKILL, kind: "word_system", operator: "repr_shift",
    structure: "'학생 입장권 수는 성인 입장권 수의 m 배보다 k 적다'는 관계와 총 수입으로 연립을 세워 성인 입장권 수를 구함",
    extraThinking: "문장 관계(m 배보다 k 적음)와 금액 조건을 두 식으로 번역하고 대입하는 모델링 — medium 은 총 개수와 총 수입이 직접 주어진 연립",
    concepts: ["문장→연립방정식", "대입법", "금액 식 세우기"], mediumSteps: 4,
    generate(rng) {
      const pa = rng.int(8, 25), pb = rng.int(3, pa - 3), m = rng.int(2, 4), k = rng.int(1, 9), x0 = rng.int(6, 30), y0 = m * x0 - k, Tt = pa * x0 + pb * y0; if (Tt > 990 || x0 === y0 || y0 < 1) throw new GenFail("x");
      const pair = rng.pick(PAIRS), mw = { 2: "twice", 3: "three times", 4: "four times" }[m]!, Au = pair.A[0].toUpperCase() + pair.A.slice(1);
      const ask = rng.pick(["A", "B"] as const), ans = ask === "A" ? x0 : y0;
      const s1 = rng.pick([`${pair.org} sold only ${pair.A}s and ${pair.B}s.`, `${pair.org} sold two kinds of ${pair.kind}: ${pair.A}s and ${pair.B}s.`, `At ${pair.org.toLowerCase()}, every sale was a ${pair.A} or a ${pair.B}.`]);
      const s2 = rng.pick([`The number of ${pair.B}s sold was ${k} less than ${mw} the number of ${pair.A}s sold.`, `It sold ${k} fewer ${pair.B}s than ${mw} the number of ${pair.A}s.`, `The ${pair.B}s sold numbered ${k} less than ${mw} the ${pair.A}s sold.`]);
      const s3 = rng.pick([`${Au}s cost ${pa} dollars each, and ${pair.B}s cost ${pb} dollars each. The total revenue was ${Tt} dollars.`, `Each ${pair.A} costs ${pa} dollars, and each ${pair.B} costs ${pb} dollars, and the sales brought in ${Tt} dollars.`, `${Au}s are sold at ${pa} dollars each and ${pair.B}s at ${pb} dollars each; the revenue came to ${Tt} dollars.`]);
      return finish(rng, {
        stimulus: `${s1} ${s2} ${s3}`,
        question: spin(rng, `[[How many ${ask === "A" ? pair.A : pair.B}s were sold?|What is the number of ${ask === "A" ? pair.A : pair.B}s sold?|Find the number of ${ask === "A" ? pair.A : pair.B}s that were sold.|How many ${ask === "A" ? pair.A : pair.B}s did ${pair.org.toLowerCase()} sell?]]`), correct: ans,

        phraseBindings: [{ phrase: pair.A, value: pa }, { phrase: pair.B, value: pb }],
        wrongs: [W(ask === "A" ? y0 : x0, "other", "다른 종류의 매수를 답했다."), W(Math.round(Tt / (ask === "A" ? pa : pb)), "step_missing", "한 종류만 팔았다고 가정했다."), W(Math.round((Tt - pb * k) / (pa + pb * m)), "sign_error", "'k 적다'의 부호를 반대로 번역했다."), W(Math.round((Tt + pb * k) / (pa + pb)), "formula_misuse", "배수 m 을 반영하지 않았다."), W(ans + 1, "other", "계산 실수."), ...near(ans)],
        verificationJs: withParams({ pa, pb, m, k, T: Tt, ask: ask === "A" ? 1 : 0 }, "const out=[];\nfor(let x=1;x<=300;x++){ const y=P.m*x-P.k; if(y>=1&&P.pa*x+P.pb*y===P.T) out.push(P.ask?x:y); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T(`${pair.A} 수를 x, ${pair.B} 수를 y 라 한다.`, "Define the variables."), T(`'${k} less than ${mw} the number' 는 $y = ${m}x - ${k}$ 이다.`, "Translate the relation."), T(`금액 식: $${pa}x + ${pb}y = ${Tt}$ 이다.`, "Write the revenue equation."), T(`대입하면 $${pa}x + ${pb}(${m}x - ${k}) = ${Tt}$ 이므로 $${pa + pb * m}x = ${Tt + pb * k}$ 이다.`, "Substitute and collect."), T(`x = ${x0}, y = ${m}·${x0} - ${k} = ${y0} 이다.`, "Solve and find the other count.")],
        variant: "relation_and_revenue",
      });
    },
  },
  {
    id: "sl.word_system.unit_ratio", skill: SKILL, kind: "word_system", operator: "unit_ratio",
    structure: "p1% 용액과 p2% 용액을 섞어 N 리터의 p% 용액을 만들 때 연립(부피 합·용질량 합)을 세워 한 용액의 부피를 구함",
    extraThinking: "퍼센트 농도를 소수/비율로 바꿔 용질량 식을 세우고 부피 합 식과 연립 — medium 은 식이 주어진 연립",
    concepts: ["퍼센트 농도(비율)", "문장→연립방정식", "소거법"], mediumSteps: 4,
    generate(rng) {
      const p1 = rng.pick([5, 10, 15, 20, 25, 30]), p2 = p1 + rng.pick([10, 20, 30, 40]), x0 = rng.int(2, 18), y0 = rng.int(2, 18), N = x0 + y0;
      if ((p1 * x0 + p2 * y0) % N !== 0 || N > 40 || x0 === y0) throw new GenFail("x"); const p = (p1 * x0 + p2 * y0) / N; if (p <= p1 || p >= p2) throw new GenFail("x");
      const C = rng.pick([{ what: "salt", unit: "salt water", who: "A cook" }, { what: "acid", unit: "acid solution", who: "A chemist" }, { what: "juice", unit: "juice drink", who: "A caterer" }, { what: "alcohol", unit: "alcohol solution", who: "A lab technician" }, { what: "sugar", unit: "sugar syrup", who: "A baker" }, { what: "bleach", unit: "bleach solution", who: "A custodian" }]);
      const s1 = rng.pick([`${C.who} mixes a ${p1}% ${C.unit} with a ${p2}% ${C.unit} to make ${N} liters of a ${p}% ${C.unit}.`, `${C.who} combines some ${p1}% ${C.unit} and some ${p2}% ${C.unit}, and the result is ${N} liters of ${p}% ${C.unit}.`, `To prepare ${N} liters of ${p}% ${C.unit}, ${C.who.toLowerCase()} blends ${p1}% ${C.unit} with ${p2}% ${C.unit}.`, `${C.who} has a ${p1}% ${C.unit} and a ${p2}% ${C.unit}, and pours them together into ${N} liters of a ${p}% mixture.`]);
      const s2 = rng.pick([`The amounts of ${C.what} in the two liquids add up exactly.`, `Assume that no ${C.what} is lost when the liquids are combined.`, `The total amount of ${C.what} in the mixture equals the sum of the amounts in the two parts.`]);
      return finish(rng, {
        stimulus: `${s1} ${s2}`,
        question: spin(rng, `[[How many liters of the ${p2}% ${C.unit} are used?|What volume, in liters, of the ${p2}% ${C.unit} is needed?|Find the number of liters of the stronger ${C.unit}.|How many liters of the ${p2}% ${C.unit} go into the mixture?|How much of the ${p2}% ${C.unit}, in liters, must be used?|What is the volume of the ${p2}% ${C.unit}, in liters?]]`), correct: y0,
        wrongs: [W(x0, "other", "약한 용액의 부피를 답했다."), W(Math.round(N / 2), "other", "같은 양씩 섞는다고 가정했다."), W(Math.round(N * (p - p1) / 100), "formula_misuse", "퍼센트 차를 그대로 비율로 곱했다."), W(N - y0 + 1, "other", "계산 실수."), W(N, "other", "전체 부피를 답했다."), ...near(y0)],
        verificationJs: withParams({ p1, p2, p, N }, "const out=[];\nfor(let y=0;y<=P.N;y++){ const x=P.N-y; if(P.p1*x+P.p2*y===P.p*P.N) out.push(y); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T(`약한 용액 x 리터, 강한 용액 y 리터라 하면 $x + y = ${N}$ 이다.`, "Write the volume equation."), T(`용질 양을 소수 비율로 쓰면 $${p1 / 100}x + ${p2 / 100}y = ${p / 100}\\cdot ${N}$ 이다.`, "Write the solute equation with decimal percents."), T(`양변에 100 을 곱하면 $${p1}x + ${p2}y = ${p * N}$ 이다.`, "Clear the decimals."), T(`첫 식에 ${p1} 을 곱해 빼면 $${p2 - p1}y = ${p * N - p1 * N}$ 이다.`, "Eliminate x."), T(`y = ${y0} 이다.`, "Solve.")],
        variant: "mixture_concentration",
      });
    },
  },
  {
    id: "sl.word_system.compare_scenarios", skill: SKILL, kind: "word_system", operator: "compare_scenarios",
    structure: "두 요금제 F_A + r_A n, F_B + r_B n 이 같아지는 n 을 연립으로 구하고 그때의 비용을 구함",
    extraThinking: "두 상황을 식으로 세워 같아지는 시점을 구한 뒤 다시 그 시점의 값을 계산(묻는 것이 해의 x 가 아닌 y) — medium 은 식이 주어진 연립",
    concepts: ["문장→연립방정식", "교점의 의미", "대입으로 비용 계산"], mediumSteps: 4,
    generate(rng) {
      const n0 = rng.int(3, 18), ra = rng.int(2, 9), rb = ra + rng.int(2, 8), FA = rng.int(3, 25) * 5, FB = FA + (rb - ra) * n0; if (FB > 400) throw new GenFail("x"); const cost = FA + rb * n0;
      const [biz, fee, unit] = rng.pick([["a gym", "a joining fee", "visit"], ["a car-sharing service", "an annual fee", "trip"], ["a print shop", "a setup charge", "poster"], ["a tutoring center", "a registration fee", "session"]] as const);
      return finish(rng, {
        stimulus: facts(rng, [[`Two plans are offered by ${biz}. Plan A has ${fee} of ${FA} dollars and charges ${rb} dollars per ${unit}.`, `${biz[0].toUpperCase()}${biz.slice(1)} offers Plan A with ${fee} of ${FA} dollars and ${rb} dollars for each ${unit}.`, `At ${biz}, Plan A costs ${rb} dollars per ${unit} plus ${fee} of ${FA} dollars.`], [`Plan B has ${fee} of ${FB} dollars and charges ${ra} dollars per ${unit}.`, `Plan B costs ${ra} dollars for each ${unit} plus ${fee} of ${FB} dollars.`, `Under Plan B, ${fee} of ${FB} dollars is paid and each ${unit} costs ${ra} dollars.`]]),
        question: spin(rng, `[[For the number of ${unit}s at which the two plans cost the same, what is that common cost, in dollars?|When Plan A and Plan B cost the same, how many dollars does each plan cost?|At the point where the two plans have equal totals, what is the total cost in dollars?|What is the cost, in dollars, at which the two plans are equal?]]`), correct: cost,
        wrongs: [W(n0, "other", "같아지는 횟수를 답했다."), W(FA + ra * n0, "formula_misuse", "단위당 요금을 서로 바꿔 계산했다."), W(FB, "step_missing", "Plan B 의 고정비를 답했다."), W(Math.round((FA + FB) / 2), "other", "고정비의 평균을 답했다."), W(rb * n0, "step_missing", "고정비를 더하지 않았다."), ...near(cost)],
        verificationJs: withParams({ FA, rb, FB, ra }, "const out=[];\nfor(let n=0;n<=1000;n++) if(P.FA+P.rb*n===P.FB+P.ra*n) out.push(P.FA+P.rb*n);\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T(`Plan A 의 비용은 $${rb}n + ${FA}$ 이다.`, "Model Plan A."), T(`Plan B 의 비용은 $${ra}n + ${FB}$ 이다.`, "Model Plan B."), T(`같아지면 $${rb}n + ${FA} = ${ra}n + ${FB}$ 이다.`, "Set the costs equal."), T(`$${rb - ra}n = ${FB - FA}$ 이므로 n = ${n0} 이다.`, "Solve for n."), T(`그때의 비용은 ${rb}·${n0} + ${FA} = ${cost} 이다.`, "Find the common cost.")],
        variant: "common_cost_at_crossover",
      });
    },
  },
  {
    id: "sl.word_system.chain2", skill: SKILL, kind: "word_system", operator: "chain2",
    structure: "두 번의 주문 금액으로 두 물건의 단가를 구하고, 그 단가로 셋째 주문의 금액을 계산",
    extraThinking: "연립으로 단가를 먼저 구한 뒤 그 결과를 새 주문 계산의 입력으로 쓰는 2단계 연쇄 — medium 은 단가 하나를 구함",
    concepts: ["문장→연립방정식", "소거법", "구한 단가의 재사용"], mediumSteps: 4,
    generate(rng) {
      const pa = rng.int(2, 9), pb = rng.int(2, 9), a1 = rng.int(2, 5), b1 = rng.int(2, 5), a2 = rng.int(2, 6), b2 = rng.int(2, 6), a3 = rng.int(2, 8), b3 = rng.int(2, 8); if (a1 * b2 - a2 * b1 === 0 || pa === pb) throw new GenFail("x");
      const T1 = a1 * pa + b1 * pb, T2 = a2 * pa + b2 * pb, T3 = a3 * pa + b3 * pb; const [A, B] = rng.pick([["pen", "notebook"], ["muffin", "cookie"], ["sticker", "bookmark"], ["marker", "folder"], ["apple", "pear"], ["ticket", "snack"]] as const);
      const O1 = `${cntW(a1, A)} and ${cntW(b1, B)}`, O2 = `${cntW(a2, A)} and ${cntW(b2, B)}`, O3 = `${cntW(a3, A)} and ${cntW(b3, B)}`;
      return finish(rng, {
        stimulus: `${rng.pick(["A teacher", "A store clerk", "A club treasurer", "A camp counselor", "A party planner"])} buys ${A}s and ${B}s at fixed prices. ${rng.pick([`The first order of ${O1} costs ${T1} dollars.`, `An order with ${O1} costs ${T1} dollars.`, `${O1[0].toUpperCase()}${O1.slice(1)} together cost ${T1} dollars.`, `The first purchase, ${O1}, costs ${T1} dollars.`])} ${rng.pick([`The second order of ${O2} costs ${T2} dollars.`, `Another order with ${O2} costs ${T2} dollars.`, `${O2[0].toUpperCase()}${O2.slice(1)} together cost ${T2} dollars.`, `The second purchase, ${O2}, costs ${T2} dollars.`])}`,
        question: spin(rng, `[[At the same prices, how many dollars will an order of ${O3} cost?|What is the cost, in dollars, of ${O3} at these prices?|How much will ${O3} cost, in dollars?|A new order has ${O3}. What does it cost, in dollars?|Using the same prices, what is the total cost, in dollars, of ${O3}?|What would ${O3} cost, in dollars, at the same prices?]]`), correct: T3,
        wrongs: [W(a3 * pb + b3 * pa, "formula_misuse", "두 물건의 단가를 서로 바꿨다."), W(a3 * pa, "step_missing", "둘째 물건의 값을 더하지 않았다."), W(T1 + T2, "step_missing", "단가를 구하지 않고 두 주문 금액을 더했다."), W((a3 + b3) * Math.round((pa + pb) / 2), "formula_misuse", "평균 단가를 썼다."), W(pa + pb, "other", "단가의 합을 답했다."), ...near(T3)],
        verificationJs: withParams({ a1, b1, T1, a2, b2, T2, a3, b3 }, "const out=[];\nfor(let x=1;x<=100;x++) for(let y=1;y<=100;y++) if(P.a1*x+P.b1*y===P.T1&&P.a2*x+P.b2*y===P.T2) out.push(P.a3*x+P.b3*y);\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T(`${A} 값을 x, ${B} 값을 y 라 하면 $${a1}x + ${b1}y = ${T1}$ 이다.`, "Write the first order."), T(`둘째 주문: $${a2}x + ${b2}y = ${T2}$ 이다.`, "Write the second order."), T("한 변수의 계수를 맞춰 빼서 소거한다.", "Eliminate one variable."), T(`x = ${pa}, y = ${pb} 를 얻는다.`, "Find both prices."), T(`새 주문: ${a3}·${pa} + ${b3}·${pb} = ${T3} 이다.`, "Compute the new order.")],
        variant: "prices_then_new_order",
      });
    },
  },
  ...SL_SPR_B_ARCHETYPES,
];
