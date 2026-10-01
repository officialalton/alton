// systems_linear easy/medium 원형(문장 틀 = 유사문항 그룹). easy 3 + medium 5.
import { GenFail, type Archetype } from "../types";
import { finish, lin, M, spin, withParams } from "../text";
import { near, stdEq, T, W } from "../kit-b";

const SKILL = "systems_linear";
const base = { skill: SKILL, operator: "frame" as const, mediumSteps: 0 };
const pr = (n: number) => (n < 0 ? `(${n})` : String(n));
const LEADS = ["Consider the system of equations below.", "The system of equations below has exactly one solution.", "A system of two linear equations is given below.", "Look at the following system of equations.", "The two equations below form a system.", "A student is solving the system of equations below.", "Both equations below must hold at the same time.", "Find the solution of the system of equations below."];
const SOLVE_JS = "const sols=[];\nfor(let x=-120;x<=120;x++) for(let y=-240;y<=240;y++) if(P.a1*x+P.b1*y===P.c1&&P.a2*x+P.b2*y===P.c2) sols.push([x,y]);\nif(sols.length!==1) throw new Error('유일하지 않음');\nconst [X,Y]=sols[0];\n";
const qv = (v: string) => `[[What is the value of ${v} in the solution $(x, y)$ of the system?|What is the ${v}-coordinate of the solution to the system?|The solution of the system is $(x, y)$. What is ${v}?|Find ${v} for the solution of the system.|What is ${v} when both equations are true?|Which value of ${v} satisfies both equations?]]`;

export const SL_EM_ARCHETYPES: Archetype[] = [
  // ---------- easy ----------
  {
    ...base, id: "sl.elimination_value.e_add_equations", kind: "elimination_value", difficulty: "easy",
    structure: "x + y = s, x − y = d 를 더해 x 를 구한다", extraThinking: "easy 틀", concepts: ["소거법"],
    generate(rng) {
      const x0 = rng.int(-5, 12), y0 = rng.int(-5, 12), s = x0 + y0, d = x0 - y0; if (x0 === y0 || s === 0 && d === 0) throw new GenFail("x");
      const [X, Y] = rng.pick([["x", "y"], ["m", "n"], ["a", "b"]] as const), askX = rng.chance(0.5), swap = rng.chance(0.5), e1 = M(`${X} + ${Y} = ${s}`), e2 = M(`${X} - ${Y} = ${d}`);
      const ans = askX ? x0 : y0;
      return finish(rng, {
        stimulus: `${rng.pick(LEADS)}\n\n${swap ? e2 : e1}\n${swap ? e1 : e2}`, question: spin(rng, qv(askX ? X : Y).replace(/\(x, y\)/g, `(${X}, ${Y})`)), correct: ans,
        wrongs: [W(askX ? y0 : x0, "other", "다른 변수의 값을 답했다."), W(askX ? s - d : s + d, "other", "더한 값을 그대로 답했다."), W(-ans, "sign_error", "부호를 잘못 처리했다."), W(askX ? s + d : d - s, "formula_misuse", "2 로 나누지 않았다."), ...near(ans)],
        verificationJs: withParams({ s, d, askX: askX ? 1 : 0 }, "const out=[];\nfor(let x=-200;x<=200;x++) for(let y=-200;y<=200;y++) if(x+y===P.s&&x-y===P.d) out.push(P.askX?x:y);\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T(`두 식을 더하면 $2${X} = ${s + d}$ 이므로 ${X} = ${x0} 이다.`, "Add the equations."), T(`${Y} = ${s} - ${pr(x0)} = ${y0} 이다.`, "Find the other value.")],
        variant: "add_equations",
      });
    },
  },
  {
    ...base, id: "sl.substitution_solve.e_y_equals_multiple", kind: "substitution_solve", difficulty: "easy",
    structure: "y = kx 와 x + y = s 를 대입으로 풀어 x 를 구한다", extraThinking: "easy 틀", concepts: ["대입법"],
    generate(rng) {
      const k = rng.pick([2, 3, 4, 5, -2]), x0 = rng.int(1, 9), y0 = k * x0, s = x0 + y0; if (Math.abs(s) > 60) throw new GenFail("x");
      const swap = rng.chance(0.5), e1 = M(`y = ${k === 1 ? "" : k}x`), e2 = M(`x + y = ${s}`), askX = rng.chance(0.5), ans = askX ? x0 : y0;
      return finish(rng, {
        stimulus: `${rng.pick(LEADS)}\n\n${swap ? e2 : e1}\n${swap ? e1 : e2}`, question: spin(rng, qv(askX ? "x" : "y")), correct: ans,
        wrongs: [W(askX ? y0 : x0, "other", "다른 변수의 값을 답했다."), W(s, "other", "합을 답했다."), W(askX ? s - k : s - 1, "formula_misuse", "대입 후 계수를 합치지 않았다."), W(-ans, "sign_error", "부호를 잘못 처리했다."), ...near(ans)],
        verificationJs: withParams({ k, s, askX: askX ? 1 : 0 }, "const out=[];\nfor(let x=-200;x<=200;x++){ const y=P.k*x; if(x+y===P.s) out.push(P.askX?x:y); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T(`y = ${k}x 를 x + y = ${s} 에 대입하면 $x + ${k}x = ${s}$ 이다.`, "Substitute."), T(`$${k + 1}x = ${s}$ 이므로 x = ${x0} 이다.`, "Solve for x."), T(`y = ${k}·${x0} = ${y0} 이다.`, "Find y.")],
        variant: "y_equals_multiple_of_x",
      });
    },
  },
  {
    ...base, id: "sl.word_system.e_two_numbers", kind: "word_system", difficulty: "easy",
    structure: "두 수의 합과 차에서 큰 수(또는 작은 수)를 구한다", extraThinking: "easy 틀", concepts: ["문장→연립방정식", "소거법"],
    generate(rng) {
      const x0 = rng.int(6, 40), y0 = rng.int(1, x0 - 1), S = x0 + y0, D = x0 - y0, askBig = rng.chance(0.5), ans = askBig ? x0 : y0;
      const s1 = rng.pick([`The sum of two numbers is ${S}.`, `Two numbers add up to ${S}.`, `Two numbers have a total of ${S}.`, `The total of two numbers is ${S}.`, `When two numbers are added, the result is ${S}.`]);
      const s2 = rng.pick([`Their difference is ${D}.`, `The larger number is ${D} more than the smaller number.`, `One number exceeds the other by ${D}.`, `The greater number minus the lesser number is ${D}.`, `The larger is ${D} greater than the smaller.`]);
      return finish(rng, {
        stimulus: `${s1} ${s2}`, question: spin(rng, askBig ? "[[What is the larger number?|What is the greater of the two numbers?|Find the larger number.|Which number is the larger one?|What is the value of the larger number?]]" : "[[What is the smaller number?|What is the lesser of the two numbers?|Find the smaller number.|Which number is the smaller one?|What is the value of the smaller number?]]"), correct: ans,
        wrongs: [W(askBig ? y0 : x0, "other", "다른 수를 답했다."), W(S - D, "formula_misuse", "2 로 나누지 않았다(합−차)."), W(S + D, "formula_misuse", "2 로 나누지 않았다(합+차)."), W(Math.round(S / 2), "other", "평균을 답했다."), ...near(ans)],
        verificationJs: withParams({ S, D, askBig: askBig ? 1 : 0 }, "const out=[];\nfor(let x=-300;x<=300;x++){ const y=P.S-x; if(x-y===P.D) out.push(P.askBig?x:y); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T(`큰 수 x, 작은 수 y 라 하면 $x + y = ${S}$, $x - y = ${D}$ 이다.`, "Write the system."), T(`더하면 $2x = ${S + D}$ 이므로 x = ${x0} 이다.`, "Add."), T(`y = ${S} - ${x0} = ${y0} 이다.`, "Find y.")],
        variant: "sum_and_difference",
      });
    },
  },
  // ---------- medium ----------
  {
    ...base, id: "sl.substitution_solve.m_x_solved", kind: "substitution_solve", difficulty: "medium",
    structure: "x = ay + b 꼴과 px + qy = r 을 대입해 y 를 구한다", extraThinking: "medium 틀", concepts: ["대입법", "분배"],
    generate(rng) {
      const a = rng.nz(-4, 5), b = rng.int(-8, 8), y0 = rng.nz(-6, 7), x0 = a * y0 + b, p = rng.nz(-4, 5), q = rng.nz(-4, 5), r = p * x0 + q * y0; if (p * a + q === 0 || Math.abs(r) > 70) throw new GenFail("x");
      const eq1 = `x = ${lin(a, b, "y")}`, swap = rng.chance(0.5), askY = rng.chance(0.65), ans = askY ? y0 : x0;
      return finish(rng, {
        stimulus: `${rng.pick(LEADS)}\n\n${M(swap ? stdEq(p, q, r) : eq1)}\n${M(swap ? eq1 : stdEq(p, q, r))}`, question: spin(rng, qv(askY ? "y" : "x")), correct: ans,
        wrongs: [W(askY ? x0 : y0, "other", "다른 변수의 값을 답했다."), W(-ans, "sign_error", "부호를 잘못 처리했다."), W(Math.round((r + p * b) / (p * a + q)) + (askY ? 0 : 1), "sign_error", "상수를 더해 이항했다."), W(Math.round((r - b) / (p * a + q)), "step_missing", "p 를 곱하지 않았다."), ...near(ans)],
        verificationJs: withParams({ a, b, p, q, r, askY: askY ? 1 : 0 }, "const out=[];\nfor(let y=-300;y<=300;y++){ const x=P.a*y+P.b; if(P.p*x+P.q*y===P.r) out.push(P.askY?y:x); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T(`x = ${lin(a, b, "y")} 를 둘째 식에 대입한다.`, "Substitute x."), T(`정리하면 $${p * a + q}y ${p * b >= 0 ? "+" : "-"} ${Math.abs(p * b)} = ${r}$ 이다.`, "Collect terms."), T(`y = ${y0} 이다.`, "Solve for y."), T(`x = ${a}·${pr(y0)} + ${pr(b)} = ${x0} 이다.`, "Find x.")],
        variant: "x_solved_form",
      });
    },
  },
  {
    ...base, id: "sl.elimination_value.m_scale_one", kind: "elimination_value", difficulty: "medium",
    structure: "한 식에 정수를 곱해 한 변수를 소거하는 표준형 연립에서 x 를 구한다", extraThinking: "medium 틀", concepts: ["소거법", "식에 수 곱하기"],
    generate(rng) {
      const x0 = rng.nz(-6, 7), y0 = rng.nz(-6, 7), m = rng.pick([2, 3, -2, -3]), b1 = rng.nz(-5, 6), a1 = rng.nz(-5, 6), a2 = rng.nz(-5, 6), b2 = m * b1; if (b1 === 0 || a1 * b2 - a2 * b1 === 0) throw new GenFail("x");
      const c1 = a1 * x0 + b1 * y0, c2 = a2 * x0 + b2 * y0; if (Math.abs(c1) > 60 || Math.abs(c2) > 60 || Math.abs(b2) > 15) throw new GenFail("x");
      const swap = rng.chance(0.5), e1 = M(stdEq(a1, b1, c1)), e2 = M(stdEq(a2, b2, c2));
      return finish(rng, {
        stimulus: `${rng.pick(LEADS)}\n\n${swap ? e2 : e1}\n${swap ? e1 : e2}`, question: spin(rng, qv("x")), correct: x0,
        wrongs: [W(y0, "other", "y 의 값을 답했다."), W(-x0, "sign_error", "부호를 잘못 처리했다."), W(Math.round((c2 - m * c1) / (a2 + m * a1)) + 1, "sign_error", "곱한 식을 빼지 않고 더했다."), W(Math.round((c1 + c2) / (a1 + a2)), "formula_misuse", "계수를 맞추지 않고 그대로 더했다."), ...near(x0)],
        verificationJs: withParams({ a1, b1, c1, a2, b2, c2 }, SOLVE_JS + "return X;"),
        trace: [T(`첫 식에 ${m} 을 곱하면 y 의 계수가 ${b2} 로 같아진다.`, "Scale an equation to match the y-coefficients."), T("두 식을 빼서 y 를 소거한다.", "Subtract to eliminate y."), T(`남은 식을 풀어 x = ${x0} 를 얻는다.`, "Solve for x.")],
        variant: "scale_one_equation",
      });
    },
  },
  {
    ...base, id: "sl.elimination_value.m_sum_of_solution", kind: "elimination_value", difficulty: "medium",
    structure: "표준형 연립의 해에서 x + y 를 구한다", extraThinking: "medium 틀", concepts: ["소거법", "해의 합"],
    generate(rng) {
      const x0 = rng.nz(-6, 7), y0 = rng.nz(-6, 7), a1 = rng.nz(-5, 6), b1 = rng.nz(-5, 6), a2 = rng.nz(-5, 6), b2 = rng.nz(-5, 6); if (a1 * b2 - a2 * b1 === 0 || x0 + y0 === 0) throw new GenFail("x");
      const c1 = a1 * x0 + b1 * y0, c2 = a2 * x0 + b2 * y0, S = x0 + y0; if (Math.abs(c1) > 60 || Math.abs(c2) > 60) throw new GenFail("x");
      const swap = rng.chance(0.5), e1 = M(stdEq(a1, b1, c1)), e2 = M(stdEq(a2, b2, c2));
      return finish(rng, {
        stimulus: `${rng.pick(LEADS)}\n\n${swap ? e2 : e1}\n${swap ? e1 : e2}`, question: spin(rng, "[[What is the value of $x + y$ for the solution of the system?|The solution is $(x, y)$. What is $x + y$?|What is the sum of the x-coordinate and the y-coordinate of the solution?|Find $x + y$.|What do the two coordinates of the solution add up to?|If $(x, y)$ solves the system, what is the value of $x + y$?]]"), correct: S,
        wrongs: [W(x0, "other", "x 만 답했다."), W(y0, "other", "y 만 답했다."), W(x0 - y0, "formula_misuse", "합 대신 차를 계산했다."), W(-S, "sign_error", "부호를 잘못 처리했다."), ...near(S)],
        verificationJs: withParams({ a1, b1, c1, a2, b2, c2 }, SOLVE_JS + "return X+Y;"),
        trace: [T("한 변수를 소거해 x 를 구한다.", "Eliminate to find x."), T(`x = ${x0}, y = ${y0} 를 얻는다.`, "Back-substitute for y."), T(`x + y = ${x0} + ${pr(y0)} = ${S} 이다.`, "Add.")],
        variant: "sum_of_solution",
      });
    },
  },
  {
    ...base, id: "sl.param_no_solution.m_find_k", kind: "param_no_solution", difficulty: "medium",
    structure: "kx + py = a, ux + qy = b 가 해가 없도록 하는 k = pu/q 를 구한다", extraThinking: "medium 틀", concepts: ["평행 조건", "해의 개수"],
    generate(rng) {
      const q = rng.pick([1, 2, 3, 4]), p = rng.nz(-6, 7), u = q * rng.nz(-4, 5), k = (p * u) / q, a = rng.nz(-12, 13), b = rng.nz(-12, 13); if (!Number.isInteger(k) || u === 0 || Math.abs(k) > 30 || a * q === p * b) throw new GenFail("x");
      const K = rng.pick(["k", "m", "t", "c"]), e1 = M(`${K}x ${p >= 0 ? "+" : "-"} ${Math.abs(p) === 1 ? "" : Math.abs(p)}y = ${a}`), e2 = M(`${u}x ${q >= 0 ? "+" : "-"} ${q === 1 ? "" : q}y = ${b}`), swap = rng.chance(0.5);
      return finish(rng, {
        stimulus: `${rng.pick([`In the system below, ${K} is a constant.`, `Consider the system below, where ${K} is a constant.`, `The system below has a constant ${K}.`])}\n\n${swap ? e2 : e1}\n${swap ? e1 : e2}\n\n${rng.pick(["The system has no solution.", "The graphs of the two equations never intersect.", "No ordered pair satisfies both equations."])}`, question: spin(rng, `[[What is the value of ${K}?|Find ${K}.|What must ${K} equal?|What value of ${K} makes this true?]]`), correct: k,
        wrongs: [W(-k, "sign_error", "부호를 잘못 처리했다."), W((p * q) / u, "formula_misuse", "비례식을 거꾸로 세웠다."), W(p * q, "formula_misuse", "p 와 q 를 곱했다."), W(u, "other", "x 의 계수를 답했다."), W(Math.round(p * u), "step_missing", "q 로 나누지 않았다."), ...near(k)],
        verificationJs: withParams({ p, u, q, a, b }, "const out=[];\nfor(let k=-200;k<=200;k++){ if(k*P.q-P.p*P.u!==0) continue; if(P.a*P.q-P.p*P.b!==0) out.push(k); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T("해가 없으면 두 직선이 평행하다: x 와 y 의 계수 비가 같다.", "Parallel lines have proportional coefficients."), T(`${K}/${u} = ${p}/${q} 이다.`, "Set the ratios equal."), T(`${K} = ${p}·${pr(u)}/${q} = ${k} 이다.`, "Solve.")],
        variant: "find_k_parallel",
      });
    },
  },
  {
    ...base, id: "sl.word_system.m_item_counts", kind: "word_system", difficulty: "medium",
    structure: "총 개수와 총 금액이 주어진 두 종류 물건의 개수를 구한다", extraThinking: "medium 틀", concepts: ["문장→연립방정식", "소거법"],
    generate(rng) {
      const pa = rng.int(5, 20), pb = rng.int(2, pa - 2), x0 = rng.int(5, 30), y0 = rng.int(5, 30), N = x0 + y0, Tt = pa * x0 + pb * y0; if (Tt > 700 || x0 === y0) throw new GenFail("x");
      const C = rng.pick([["notebook", "folder", "A teacher"], ["sandwich", "salad", "A cafe"], ["T-shirt", "cap", "A shop"], ["cupcake", "cookie", "A bakery"], ["pen", "marker", "A clerk"]] as const);
      const askA = rng.chance(0.5), ans = askA ? x0 : y0;
      const s1 = rng.pick([`${C[2]} bought ${N} items in all, some ${C[0]}s and the rest ${C[1]}s, for ${Tt} dollars.`, `${C[2]} spent ${Tt} dollars on ${N} items, each one a ${C[0]} or a ${C[1]}.`, `A total of ${N} items, ${C[0]}s and ${C[1]}s, were bought by ${C[2].toLowerCase()} for ${Tt} dollars.`]);
      return finish(rng, {
        stimulus: `${s1} ${rng.pick([`Each ${C[0]} costs ${pa} dollars, and each ${C[1]} costs ${pb} dollars.`, `A ${C[0]} is ${pa} dollars, and a ${C[1]} is ${pb} dollars.`, `${C[0][0].toUpperCase()}${C[0].slice(1)}s cost ${pa} dollars apiece and ${C[1]}s cost ${pb} dollars apiece.`])}`, question: spin(rng, `[[How many ${askA ? C[0] : C[1]}s were bought?|What is the number of ${askA ? C[0] : C[1]}s bought?|Find the number of ${askA ? C[0] : C[1]}s that were bought.|How many of the items were ${askA ? C[0] : C[1]}s?]]`), correct: ans,
        wrongs: [W(askA ? y0 : x0, "other", "다른 물건의 개수를 답했다."), W(Math.round(N / 2), "other", "절반씩이라고 가정했다."), W(Math.round(Tt / (askA ? pa : pb)), "step_missing", "한 종류만 샀다고 가정했다."), W(N - ans + 1, "other", "계산 실수."), ...near(ans)],
        verificationJs: withParams({ N, pa, pb, T: Tt, askA: askA ? 1 : 0 }, "const out=[];\nfor(let x=0;x<=P.N;x++){ const y=P.N-x; if(P.pa*x+P.pb*y===P.T) out.push(P.askA?x:y); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T(`${C[0]} 수 x, ${C[1]} 수 y 라 하면 $x + y = ${N}$ 이다.`, "Count equation."), T(`금액: $${pa}x + ${pb}y = ${Tt}$ 이다.`, "Cost equation."), T(`소거해 x = ${x0}, y = ${y0} 를 얻는다.`, "Solve.")],
        variant: "item_counts_and_cost",
      });
    },
  },
];
