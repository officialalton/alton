// linear_equations_two_var hard 원형 24개(intersection_x·intersection_y·intersection_sum·slope·intercept·num_solutions × 연산자 4종). 정답은 모두 수치.
import { GenFail, type Archetype } from "../types";
import { L2_SPR_B_ARCHETYPES } from "./linear-equations-two-var.spr-b";
import { facts, finish, lin, M, spin, withParams } from "../text";
import { near, SERVICES, stdEq, T, W } from "../kit-b";

const SKILL = "linear_equations_two_var";
const pr = (n: number) => (n < 0 ? `(${n})` : String(n));
const yEq = (m: number, b: number) => `y = ${lin(m, b)}`;
const LEADS = ["Consider the system of equations below.", "The system of equations below has exactly one solution.", "A system of two linear equations is given below.", "Look at the following system of equations.", "The two equations below form a system.", "Two lines in the xy-plane are given by the equations below.", "A student is solving the system of equations below.", "The following two equations are to be solved together.", "Both equations below must hold at the same time."];
/** 표준형 연립 정수해를 전수 탐색하는 verificationJs 조각(P.a1,b1,c1,a2,b2,c2). */
const SOLVE_JS = "const sols=[];\nfor(let x=-80;x<=80;x++) for(let y=-160;y<=160;y++) if(P.a1*x+P.b1*y===P.c1&&P.a2*x+P.b2*y===P.c2) sols.push([x,y]);\nif(sols.length!==1) throw new Error('유일하지 않음');\nconst [X,Y]=sols[0];\n";

export const L2_ARCHETYPES: Archetype[] = [
  // ============ intersection_x ============
  {
    id: "l2.intersection_x.compose_kind", skill: SKILL, kind: "intersection_x", operator: "compose_kind",
    structure: "기울기 s 와 한 점 (p,q) 로 주어진 직선 ℓ 의 식을 먼저 세우고, 다른 직선 m 과의 교점의 x 좌표를 구함",
    extraThinking: "점-기울기 조건에서 직선의 식을 복원한 뒤 연립으로 교점을 구하는 합성 — medium 은 두 직선의 식이 모두 주어진 연립",
    concepts: ["점과 기울기로 직선의 식", "연립방정식의 교점"], mediumSteps: 4,
    generate(rng) {
      const s = rng.nz(-5, 6), m2 = rng.nz(-5, 6), b2 = rng.int(-9, 9), x0 = rng.int(-6, 7); if (s === m2) throw new GenFail("x");
      const y0 = m2 * x0 + b2, p = rng.int(-5, 6), q = y0 + s * (p - x0), b1 = q - s * p; if (Math.abs(q) > 40 || Math.abs(b1) > 40 || (p === x0)) throw new GenFail("x");
      const [L1, L2] = rng.pick([["ℓ", "m"], ["j", "k"], ["r", "s"]] as const);
      return finish(rng, {
        stimulus: `${rng.pick([`Line ${L1} has slope ${s} and passes through the point ${M(`(${p}, ${q})`)}.`, `A line ${L1} with a slope of ${s} contains the point ${M(`(${p}, ${q})`)}.`, `The point ${M(`(${p}, ${q})`)} is on line ${L1}, which has slope ${s}.`, `Line ${L1} goes through ${M(`(${p}, ${q})`)} and has a slope of ${s}.`])} ${rng.pick([`Line ${L2} is given by the equation ${M(yEq(m2, b2))}.`, `The equation of line ${L2} is ${M(yEq(m2, b2))}.`, `Line ${L2} is the graph of ${M(yEq(m2, b2))}.`, `Another line, ${L2}, satisfies ${M(yEq(m2, b2))}.`])}`,
        question: spin(rng, `[[What is the x-coordinate of the point where the two lines intersect?|At what x-value do lines ${L1} and ${L2} intersect?|The lines intersect at the point $(x, y)$. What is x?|What is the x-coordinate of the intersection of ${L1} and ${L2}?]]`), correct: x0,
        wrongs: [W(y0, "other", "교점의 y 좌표를 답했다."), W(-x0, "sign_error", "부호를 잘못 처리했다."), W(Math.round((b2 - q) / (s - m2)), "formula_misuse", "점-기울기 식에서 p 를 반영하지 않고 풀었다."), W(Math.round((b2 - b1) / (s + m2)), "sign_error", "기울기의 차 대신 합으로 나눴다."), W(Math.round((b1 - b2) / (s - m2)) * -1 + 1, "other", "계산 실수."), ...near(x0)],
        verificationJs: withParams({ s, p, q, m2, b2 }, "const out=[];\nfor(let x=-300;x<=300;x++){ const y1=P.s*(x-P.p)+P.q, y2=P.m2*x+P.b2; if(y1===y2) out.push(x); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T(`${L1} 는 점 (${p}, ${q}) 를 지나고 기울기가 ${s} 이므로 $y - ${pr(q)} = ${s}(x - ${pr(p)})$ 이다.`, "Write line 1 in point-slope form."), T(`정리하면 $${yEq(s, b1)}$ 이다.`, "Convert to slope-intercept form."), T(`교점에서 두 y 가 같으므로 $${lin(s, b1)} = ${lin(m2, b2)}$ 이다.`, "Set the two y-values equal."), T(`x 항을 모으면 $${s - m2}x = ${b2 - b1}$ 이다.`, "Collect the x-terms."), T(`${s - m2} 로 나누면 x = ${x0} 이다.`, "Solve for x.")],
        variant: "point_slope_then_intersect",
      });
    },
  },
  {
    id: "l2.intersection_x.inverse", skill: SKILL, kind: "intersection_x", operator: "inverse",
    structure: "연립방정식 y = ax + b, y = cx + k 의 해의 x 좌표가 x0 로 주어질 때 상수 k 를 역산",
    extraThinking: "해(교점의 x 좌표)에서 거꾸로 미지 상수를 결정 — medium 은 두 식이 모두 주어진 연립에서 x 를 구함",
    concepts: ["연립방정식의 해의 의미", "미지 상수 역산"], mediumSteps: 4,
    generate(rng) {
      const a = rng.nz(-5, 6), c = rng.nz(-5, 6), b = rng.int(-9, 9), x0 = rng.nz(-6, 7), k = (a - c) * x0 + b; if (a === c || Math.abs(k) > 50) throw new GenFail("x");
      const K = rng.pick(["k", "p", "c"]);
      return finish(rng, {
        stimulus: `${rng.pick(["In the system of equations below, " + K + " is a constant.", "For the system below, " + K + " is a constant.", "The system below contains a constant " + K + ".", "Let " + K + " be a constant in the system below."])} ${rng.pick([`The x-coordinate of the solution to the system is ${x0}.`, `The solution $(x, y)$ of the system has ${M(`x = ${x0}`)}.`, `It is known that the system has a solution with x-coordinate ${x0}.`, `The graphs of the two equations meet at a point whose x-coordinate is ${x0}.`])}\n\n${M(yEq(a, b))}\n${M(`y = ${lin(c, 0)} + ${K}`.replace("+ -", "- "))}`,
        question: spin(rng, `[[What is the value of ${K}?|Find ${K}.|What must ${K} equal?|What value of ${K} gives this solution?]]`), correct: k,
        wrongs: [W(-k, "sign_error", "상수의 부호를 잘못 처리했다."), W((a + c) * x0 + b, "sign_error", "x 계수의 차 대신 합을 썼다."), W(a * x0 + b, "step_missing", "y 값을 구하고 상수를 구하지 않았다."), W(c * x0, "step_missing", "둘째 식의 상수를 구하지 않았다."), W((a - c) * x0 - b, "sign_error", "상수 b 의 부호를 반대로 적용했다."), ...near(k)],
        verificationJs: withParams({ a, b, c, x0 }, "const out=[];\nfor(let k=-300;k<=300;k++){ const y1=P.a*P.x0+P.b, y2=P.c*P.x0+k; if(y1===y2) out.push(k); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T(`해의 x 좌표가 ${x0} 이므로 첫 식에서 y = ${a}·${pr(x0)} + ${pr(b)} = ${a * x0 + b} 이다.`, "Find y from the first equation."), T(`해는 (${x0}, ${a * x0 + b}) 이다.`, "State the solution point."), T(`이 점은 둘째 식도 만족한다: ${a * x0 + b} = ${c}·${pr(x0)} + K.`, "Substitute into the second equation."), T(`${c}·${pr(x0)} = ${c * x0} 이다.`, "Compute the product."), T(`K = ${a * x0 + b} - ${pr(c * x0)} = ${k} 이다.`, "Solve for the constant.")],
        variant: "unknown_constant_from_x",
      });
    },
  },
  {
    id: "l2.intersection_x.compare_scenarios", skill: SKILL, kind: "intersection_x", operator: "compare_scenarios",
    structure: "두 요금제 비용 F_A + r_A n 과 F_B + r_B n 이 같아지는 n(교점의 x 좌표)을 구함",
    extraThinking: "두 상황을 각각 식으로 세우고 같아지는 시점(교점)을 구함 — medium 은 두 식이 주어진 연립",
    concepts: ["문장→일차식", "연립방정식의 교점"], mediumSteps: 4,
    generate(rng) {
      const sv = rng.pick(SERVICES), n0 = rng.int(3, 20), ra = rng.int(2, 9), rb = ra + rng.int(2, 8);
      const FA = rng.int(5, 30) * 5, FB = FA + (rb - ra) * n0; if (FB > 400) throw new GenFail("x");
      return finish(rng, {
        stimulus: facts(rng, [
          [`Company A charges ${FA} dollars for ${sv.job} plus ${rb} dollars for each ${sv.unit}.`, `At Company A, ${sv.job} costs ${FA} dollars and each ${sv.unit} adds ${rb} dollars.`, `Company A bills ${FA} dollars for ${sv.job} and ${rb} dollars per ${sv.unit}.`, `The price at Company A is ${FA} dollars for ${sv.job} plus ${rb} dollars for every ${sv.unit}.`],
          [`Company B charges ${FB} dollars for ${sv.job} plus ${ra} dollars for each ${sv.unit}.`, `At Company B, ${sv.job} costs ${FB} dollars and each ${sv.unit} adds ${ra} dollars.`, `Company B bills ${FB} dollars for ${sv.job} and ${ra} dollars per ${sv.unit}.`, `The price at Company B is ${FB} dollars for ${sv.job} plus ${ra} dollars for every ${sv.unit}.`],
          ["A customer compares the two companies.", "The two prices depend on the number of whole " + sv.units + ".", "The graphs of the two cost equations are lines in the xy-plane.", "A customer wants to know when the two companies charge the same amount."],
        ]),
        question: spin(rng, `[[For how many ${sv.units} do the two companies charge the same total?|At what number of ${sv.units} are the two totals equal?|After how many ${sv.units} do Company A and Company B cost the same?|The two cost lines intersect at what number of ${sv.units}?]]`), correct: n0,
        wrongs: [W(FB - FA, "step_missing", "고정비 차이를 단위당 요금 차로 나누지 않았다."), W(Math.round((FB + FA) / (rb + ra)), "sign_error", "차 대신 합으로 계산했다."), W(Math.round((FB - FA) / (rb + ra)), "formula_misuse", "단위당 요금의 차 대신 합으로 나눴다."), W(n0 * ra + FB, "other", "같아지는 횟수가 아니라 그때의 비용을 답했다."), ...near(n0)],
        verificationJs: withParams({ FA, rb, FB, ra }, "const out=[];\nfor(let n=0;n<=1000;n++) if(P.FA+P.rb*n===P.FB+P.ra*n) out.push(n);\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T(`Company A 의 비용은 $${rb}n + ${FA}$ 이다.`, "Model company A."), T(`Company B 의 비용은 $${ra}n + ${FB}$ 이다.`, "Model company B."), T(`같아지려면 $${rb}n + ${FA} = ${ra}n + ${FB}$ 이다.`, "Set the totals equal."), T(`n 항을 모으면 $${rb - ra}n = ${FB - FA}$ 이다.`, "Collect the n-terms."), T(`${rb - ra} 로 나누면 n = ${n0} 이다.`, "Solve for n.")],
        variant: "equal_cost_point",
      });
    },
  },
  {
    id: "l2.intersection_x.repr_shift", skill: SKILL, kind: "intersection_x", operator: "repr_shift",
    structure: "두 직선이 각각 두 관측값(표)으로 주어질 때 식을 세워 교점의 x 좌표를 구함",
    extraThinking: "표(두 점)를 직선의 식으로 번역한 뒤 연립으로 교점을 구함 — medium 은 두 식이 주어진 연립",
    concepts: ["표→직선의 식", "연립방정식의 교점"], mediumSteps: 4,
    generate(rng) {
      const m1 = rng.nz(-5, 6), m2 = rng.nz(-5, 6), x0 = rng.int(-5, 7), b1 = rng.int(-9, 9); if (m1 === m2) throw new GenFail("x");
      const y0 = m1 * x0 + b1, b2 = y0 - m2 * x0, pa = rng.int(0, 3), pb = pa + rng.int(2, 4), pc = rng.int(0, 3), pd = pc + rng.int(2, 4);
      if (Math.abs(b2) > 40) throw new GenFail("x");
      return finish(rng, {
        stimulus: `${rng.pick(["Two lines are described by tables of values.", "Two linear relationships are recorded in two tables.", "The values of two linear functions are recorded below.", "Two lines in the xy-plane are described by their values."])} ${rng.pick([`For line A, when x = ${pa}, y = ${m1 * pa + b1}, and when x = ${pb}, y = ${m1 * pb + b1}.`, `Line A has y = ${m1 * pa + b1} at x = ${pa} and y = ${m1 * pb + b1} at x = ${pb}.`, `Line A passes through ${M(`(${pa}, ${m1 * pa + b1})`)} and ${M(`(${pb}, ${m1 * pb + b1})`)}.`])} ${rng.pick([`For line B, when x = ${pc}, y = ${m2 * pc + b2}, and when x = ${pd}, y = ${m2 * pd + b2}.`, `Line B has y = ${m2 * pc + b2} at x = ${pc} and y = ${m2 * pd + b2} at x = ${pd}.`, `Line B passes through ${M(`(${pc}, ${m2 * pc + b2})`)} and ${M(`(${pd}, ${m2 * pd + b2})`)}.`])}`,
        question: spin(rng, "[[What is the x-coordinate of the point where the two lines intersect?|At what x-value do line A and line B intersect?|The lines intersect at the point $(x, y)$. What is x?|What is the x-coordinate of the intersection of A and B?]]"), correct: x0,
        wrongs: [W(y0, "other", "교점의 y 좌표를 답했다."), W(-x0, "sign_error", "부호를 잘못 처리했다."), W(Math.round((b1 - b2) / (m1 + m2)), "sign_error", "기울기의 차 대신 합으로 나눴다."), W(Math.round((b2 - b1) / (m1 - m2)) * -1, "sign_error", "상수항 차의 부호를 반대로 했다."), ...near(x0)],
        verificationJs: withParams({ pa, ya: m1 * pa + b1, pb, yb: m1 * pb + b1, pc, yc: m2 * pc + b2, pd, yd: m2 * pd + b2 }, "const sA=(P.yb-P.ya)/(P.pb-P.pa), bA=P.ya-sA*P.pa, sB=(P.yd-P.yc)/(P.pd-P.pc), bB=P.yc-sB*P.pc;\nif(sA===sB) throw new Error('평행');\nreturn (bB-bA)/(sA-sB);"),
        trace: [T(`A 의 기울기는 ${m1}, y 절편은 ${b1} 이므로 $${yEq(m1, b1)}$ 이다.`, "Restore line A."), T(`B 의 기울기는 ${m2}, y 절편은 ${b2} 이므로 $${yEq(m2, b2)}$ 이다.`, "Restore line B."), T(`$${lin(m1, b1)} = ${lin(m2, b2)}$ 로 놓는다.`, "Set the y-values equal."), T(`x 항을 모으면 $${m1 - m2}x = ${b2 - b1}$ 이다.`, "Collect the x-terms."), T(`${m1 - m2} 로 나누면 x = ${x0} 이다.`, "Solve for x.")],
        variant: "lines_from_tables",
      });
    },
  },
  // ============ intersection_y ============
  {
    id: "l2.intersection_y.chain2", skill: SKILL, kind: "intersection_y", operator: "chain2",
    structure: "두 직선의 교점의 x 좌표를 구한 뒤, 같은 x 에서 셋째 직선의 y 값을 구함",
    extraThinking: "교점에서 얻은 x 를 다음 직선의 입력으로 쓰는 2단계 연쇄 — medium 은 교점의 y 좌표 하나",
    concepts: ["연립방정식의 교점", "일차함수의 함수값"], mediumSteps: 4,
    generate(rng) {
      const m1 = rng.nz(-4, 5), m2 = rng.nz(-4, 5), b1 = rng.int(-9, 9), x0 = rng.int(-5, 6), m3 = rng.nz(-5, 6), b3 = rng.int(-9, 9); if (m1 === m2) throw new GenFail("x");
      const b2 = m1 * x0 + b1 - m2 * x0, ans = m3 * x0 + b3; if (Math.abs(b2) > 40 || Math.abs(ans) > 80) throw new GenFail("x");
      return finish(rng, {
        stimulus: `${rng.pick(["Lines A and B are given by the equations below.", "The equations of two lines, A and B, are below.", "Line A and line B are described by the following equations.", "Two lines A and B satisfy the equations below.", "Consider lines A and B with the equations below.", "The graphs of A and B are the lines with the equations below."])}\n\n${M(`A: ${yEq(m1, b1)}`)}\n${M(`B: ${yEq(m2, b2)}`)}\n\n${rng.pick([`Line C is given by ${M(yEq(m3, b3))}.`, `A third line, C, has the equation ${M(yEq(m3, b3))}.`, `Line C is the graph of ${M(yEq(m3, b3))}.`, `Another line, C, is defined by ${M(yEq(m3, b3))}.`, `The equation of a third line, C, is ${M(yEq(m3, b3))}.`])} ${rng.pick(["A point on line C has the same x-coordinate as the intersection of A and B.", "The point on C with the same x-coordinate as the point where A and B meet is marked.", "Consider the point of C that lies directly above or below the intersection of A and B."])}`,
        question: spin(rng, "[[What is the y-coordinate of that point on line C?|What is the y-coordinate of the point on C?|Find the y-coordinate of the marked point on line C.|What is y for that point on line C?|How high is that point on line C, that is, what is its y-coordinate?|What is the value of y at that point of C?]]"), correct: ans,
        wrongs: [W(m1 * x0 + b1, "step_missing", "교점의 y 좌표(직선 A 위의 y)를 답했다."), W(m3 * (m1 * x0 + b1) + b3, "formula_misuse", "교점의 y 좌표를 C 의 입력으로 썼다."), W(x0, "other", "교점의 x 좌표를 답했다."), W(m3 * -x0 + b3, "sign_error", "x 의 부호를 반대로 대입했다."), W(b3, "step_missing", "C 의 절편을 답했다."), ...near(ans)],
        verificationJs: withParams({ m1, b1, m2, b2, m3, b3 }, "let X=null;\nfor(let x=-300;x<=300;x++) if(P.m1*x+P.b1===P.m2*x+P.b2){ X=x; break; }\nif(X===null) throw new Error('교점 없음');\nreturn P.m3*X+P.b3;"),
        trace: [T(`A 와 B 가 만나는 점에서 $${lin(m1, b1)} = ${lin(m2, b2)}$ 이다.`, "Set A equal to B."), T(`x 항을 모으면 $${m1 - m2}x = ${b2 - b1}$ 이다.`, "Collect the x-terms."), T(`x = ${x0} 이다.`, "Solve for x."), T(`C 의 같은 x 에서 $y = ${m3}\\cdot ${pr(x0)} ${b3 >= 0 ? "+" : "-"} ${Math.abs(b3)}$ 이다.`, "Substitute into C."), T(`y = ${ans} 이다.`, "Evaluate.")],
        variant: "third_line_at_intersection_x",
      });
    },
  },
  {
    id: "l2.intersection_y.inverse", skill: SKILL, kind: "intersection_y", operator: "inverse",
    structure: "해의 y 좌표가 y0 로 주어질 때 첫 식에서 x 를 역산하고 둘째 식의 상수 k 를 결정",
    extraThinking: "y 좌표에서 x 좌표를 거꾸로 구한 뒤 미지 상수를 결정하는 2단계 역산 — medium 은 두 식이 주어진 연립에서 y 를 구함",
    concepts: ["연립방정식의 해의 의미", "미지 상수 역산"], mediumSteps: 4,
    generate(rng) {
      const a = rng.pick([2, 3, 4, -2, -3]), b = rng.int(-9, 9), c = rng.nz(-4, 5), x0 = rng.nz(-5, 6), y0 = a * x0 + b, k = y0 - c * x0; if (c === a || Math.abs(k) > 40 || Math.abs(y0) > 50) throw new GenFail("x");
      const K = rng.pick(["k", "p", "c"]);
      return finish(rng, {
        stimulus: `${rng.pick([`In the system below, ${K} is a constant.`, `Consider the system below, where ${K} is a constant.`, `The system below has a constant ${K}.`])} ${rng.pick([`The y-coordinate of the solution is ${y0}.`, `The solution $(x, y)$ satisfies ${M(`y = ${y0}`)}.`, `It is known that the solution has y-coordinate ${y0}.`, `The two lines meet at a point with y-coordinate ${y0}.`])}\n\n${M(yEq(a, b))}\n${M(`y = ${lin(c, 0)} + ${K}`.replace("+ -", "- "))}`,
        question: spin(rng, `[[What is the value of ${K}?|Find ${K}.|What must ${K} equal?|What value of ${K} gives this solution?]]`), correct: k,
        wrongs: [W(-k, "sign_error", "부호를 잘못 처리했다."), W(y0 - b, "step_missing", "x 를 구하고 상수를 구하지 않았다."), W(y0 - c * (y0 - b), "formula_misuse", "x 대신 y−b 를 대입했다."), W(y0 + c * x0, "sign_error", "상수를 구할 때 부호를 반대로 적용했다."), W(x0, "other", "x 좌표를 답했다."), ...near(k)],
        verificationJs: withParams({ a, b, c, y0 }, "const out=[];\nfor(let x=-300;x<=300;x++){ if(P.a*x+P.b!==P.y0) continue; for(let k=-300;k<=300;k++) if(P.c*x+k===P.y0) out.push(k); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T(`y = ${y0} 을 첫 식에 대입하면 $${y0} = ${lin(a, b)}$ 이다.`, "Substitute y into the first equation."), T(`상수를 이항하면 $${a}x = ${y0 - b}$ 이다.`, "Isolate the x-term."), T(`x = ${x0} 이다.`, "Solve for x."), T(`해 (${x0}, ${y0}) 가 둘째 식도 만족한다: ${y0} = ${c}·${pr(x0)} + K.`, "Substitute into the second equation."), T(`K = ${y0} - ${pr(c * x0)} = ${k} 이다.`, "Solve for the constant.")],
        variant: "unknown_constant_from_y",
      });
    },
  },
  {
    id: "l2.intersection_y.constraint_select", skill: SKILL, kind: "intersection_y", operator: "constraint_select",
    structure: "y = kx + b 와 y = mx + c 에서 1 ≤ k ≤ N 인 정수 k 중 교점이 정수 좌표가 되는 k 를 골라 y 좌표의 합을 구함",
    extraThinking: "k 마다 교점의 x = (c−b)/(k−m) 이 정수가 되는지(약수 조건)를 따져 후보를 고르고 각 y 좌표를 합산 — medium 은 교점의 y 좌표 하나",
    concepts: ["연립방정식의 교점", "약수 조건(정수 해)", "후보 선택과 합산"], mediumSteps: 4,
    generate(rng) {
      const b = rng.int(-6, 6), m = rng.int(-4, -1), c = b + rng.pick([6, 8, 10, 12, 14, 15, 16, 18, 20, 24]), N = rng.int(8, 14);
      const ks: number[] = [], ys: number[] = []; for (let k = 1; k <= N; k++) { const den = k - m, num = c - b; if (num % den === 0) { const x = num / den; ks.push(k); ys.push(m * x + c); } }
      if (ks.length < 2 || ks.length > 6) throw new GenFail("x"); const sum = ys.reduce((p, v) => p + v, 0);
      return finish(rng, {
        stimulus: `${rng.pick(["In the system below, k is a positive integer with k ≤ " + N + ".", "For the system below, k is an integer with 1 ≤ k ≤ " + N + ".", "The constant k in the system below is a whole number from 1 to " + N + ".", "Let k be a positive whole number no larger than " + N + " in the system below.", "The value of k in the system below can be any integer from 1 through " + N + ".", "Consider the system below, in which k is one of the integers 1, 2, ..., " + N + "."])} ${rng.pick(["For some values of k, the solution $(x, y)$ has integer coordinates.", "Only some values of k give a solution whose coordinates are both integers.", "Consider the values of k for which the solution has integer coordinates.", "Some choices of k make both coordinates of the solution whole numbers.", "A choice of k is called good when the solution has integer x- and y-coordinates.", "Look only at the values of k for which x and y are both integers."])}\n\n${M(`y = kx ${b >= 0 ? "+" : "-"} ${Math.abs(b)}`)}\n${M(yEq(m, c))}`,
        question: spin(rng, "[[What is the sum of the y-coordinates of all such integer solutions?|Adding the y-coordinates of the solutions for all such values of k gives what sum?|What is the total of the y-coordinates, taken over every such value of k?|Over all good values of k, what do the y-coordinates add up to?|What is the sum of y over all of these solutions?|If the y-coordinate is recorded for each such k, what is the total?]]"), correct: sum,
        wrongs: [W(ks.reduce((p, v) => p + v, 0), "other", "k 의 합을 답했다."), W(ys.length, "other", "가능한 k 의 개수를 답했다."), W(sum - ys[ys.length - 1], "condition_ignored", "마지막 후보를 빠뜨렸다."), W(sum + (c - b), "other", "범위 밖 k 를 포함했다."), W(ys.reduce((p, v) => p + Math.abs(v), 0), "sign_error", "y 좌표의 절댓값을 더했다."), ...near(sum)],
        verificationJs: withParams({ b, m, c, N }, "let total=0, cnt=0;\nfor(let k=1;k<=P.N;k++){ for(let x=-300;x<=300;x++){ const y=k*x+P.b; if(y===P.m*x+P.c){ total+=y; cnt++; } } }\nif(!cnt) throw new Error('해 없음');\nreturn total;"),
        trace: [T(`두 식에서 $kx ${b >= 0 ? "+" : "-"} ${Math.abs(b)} = ${lin(m, c)}$ 이므로 $(k ${m >= 0 ? "-" : "+"} ${Math.abs(m)})x = ${c - b}$ 이다.`, "Set the equations equal."), T(`x = ${c - b}/(k - ${pr(m)}) 이 정수여야 한다.`, "x must be an integer."), T(`${c - b} 의 약수 조건에서 1 ≤ k ≤ ${N} 인 k 는 ${ks.join(", ")} 이다.`, "List the valid k."), T(`각 k 에서 y = ${m}x + ${c} 로 y 좌표는 ${ys.join(", ")} 이다.`, "Compute each y-coordinate."), T(`합은 ${sum} 이다.`, "Add.")],
        variant: "integer_solutions_sum_of_y",
      });
    },
  },
  {
    id: "l2.intersection_y.compose_kind", skill: SKILL, kind: "intersection_y", operator: "compose_kind",
    structure: "두 점으로 직선 ℓ 의 식을 세우고 직선 m 과의 교점의 y 좌표를 구함",
    extraThinking: "두 점에서 기울기·식을 복원한 뒤 연립으로 교점의 y 좌표를 구하는 합성 — medium 은 두 식이 주어진 연립에서 y 를 구함",
    concepts: ["두 점으로 직선의 식", "연립방정식의 교점"], mediumSteps: 4,
    generate(rng) {
      const s = rng.nz(-4, 5), m2 = rng.nz(-4, 5), x0 = rng.int(-5, 6), b2 = rng.int(-9, 9); if (s === m2) throw new GenFail("x");
      const y0 = m2 * x0 + b2, b1 = y0 - s * x0, p1 = rng.int(-4, 3), d = rng.int(1, 4); if (Math.abs(b1) > 40 || Math.abs(y0) > 60) throw new GenFail("x");
      const A = M(`(${p1}, ${s * p1 + b1})`), B = M(`(${p1 + d}, ${s * (p1 + d) + b1})`);
      return finish(rng, {
        stimulus: `${rng.pick([`Line ℓ passes through the points ${A} and ${B}.`, `Line ℓ contains the points ${A} and ${B}.`, `The points ${A} and ${B} lie on line ℓ.`, `A line ℓ is drawn through ${A} and ${B}.`, `Two points on line ℓ are ${A} and ${B}.`, `The graph of line ℓ contains ${A} and ${B}.`])} ${rng.pick([`Line m is given by ${M(yEq(m2, b2))}.`, `The equation of line m is ${M(yEq(m2, b2))}.`, `Line m is the graph of ${M(yEq(m2, b2))}.`, `A second line, m, satisfies ${M(yEq(m2, b2))}.`])}`,
        question: spin(rng, "[[What is the y-coordinate of the point where the two lines intersect?|At what y-value do lines ℓ and m intersect?|The lines intersect at the point $(x, y)$. What is y?|What is the y-coordinate of the intersection of ℓ and m?|Where the two lines cross, what is the value of y?|At the intersection of ℓ and m, what is the y-coordinate?]]"), correct: y0,
        wrongs: [W(x0, "other", "교점의 x 좌표를 답했다."), W(-y0, "sign_error", "부호를 잘못 처리했다."), W(b1, "other", "직선 ℓ 의 절편을 답했다."), W(m2 * (b2 - b1) / (s + m2) + b2, "sign_error", "기울기의 차 대신 합으로 나눴다."), W(s * x0, "step_missing", "절편을 더하지 않았다."), ...near(y0)],
        verificationJs: withParams({ xa: p1, ya: s * p1 + b1, xb: p1 + d, yb: s * (p1 + d) + b1, m2, b2 }, "const s=(P.yb-P.ya)/(P.xb-P.xa), b1=P.ya-s*P.xa;\nif(s===P.m2) throw new Error('평행');\nconst x=(P.b2-b1)/(s-P.m2);\nreturn P.m2*x+P.b2;"),
        trace: [T(`ℓ 의 기울기는 (${s * (p1 + d) + b1} - ${pr(s * p1 + b1)}) / (${p1 + d} - ${pr(p1)}) = ${s} 이다.`, "Find the slope of ℓ."), T(`점 (${p1}, ${s * p1 + b1}) 를 대입해 절편을 구하면 $${yEq(s, b1)}$ 이다.`, "Find the intercept."), T(`교점에서 $${lin(s, b1)} = ${lin(m2, b2)}$ 이다.`, "Set the y-values equal."), T(`x 항을 모으면 $${s - m2}x = ${b2 - b1}$ 이므로 x = ${x0} 이다.`, "Solve for x."), T(`m 에 대입하면 y = ${m2}·${pr(x0)} + ${pr(b2)} = ${y0} 이다.`, "Compute y.")],
        variant: "two_points_then_intersect_y",
      });
    },
  },
  // ============ intersection_sum ============
  {
    id: "l2.intersection_sum.param_condition", skill: SKILL, kind: "intersection_sum", operator: "param_condition",
    structure: "y = ax + b 와 y = kx + d 의 해가 직선 y = x 위에 있다는 조건(x = y)으로 x 를 구하고 k 를 결정",
    extraThinking: "'해가 y = x 위에 있다'는 암묵 조건(x = y)을 식으로 번역해 미지 계수 k 를 결정 — medium 은 두 식이 주어진 연립에서 x + y 를 구함",
    concepts: ["연립방정식의 해", "해의 조건(x = y)", "미지 계수 결정"], mediumSteps: 4,
    generate(rng) {
      const a = rng.pick([2, 3, 4, -2, -3]), x0 = rng.nz(-6, 7), b = x0 * (1 - a), k = rng.pick([2, 3, -1, -2, 4, -3]), d = x0 * (1 - k); if (Math.abs(b) > 40 || Math.abs(d) > 40 || a === k) throw new GenFail("x");
      const K = rng.pick(["k", "p", "c"]);
      return finish(rng, {
        stimulus: `${rng.pick([`In the system below, ${K} is a constant.`, `Consider the system below, where ${K} is a constant.`, `The system below has a constant ${K}.`, `Let ${K} be a constant in the system below.`])} ${rng.pick(["The solution $(x, y)$ of the system lies on the line $y = x$.", "The x-coordinate and y-coordinate of the solution are equal.", "The graphs of the two equations meet at a point where the x-value equals the y-value.", "The system has a solution $(x, y)$ with x equal to y."])}\n\n${M(yEq(a, b))}\n${M(`y = ${K}x ${d >= 0 ? "+" : "-"} ${Math.abs(d)}`)}`,
        question: spin(rng, `[[What is the value of ${K}?|Find ${K}.|What must ${K} equal?|What value of ${K} makes this true?]]`), correct: k,
        wrongs: [W(-k, "sign_error", "부호를 잘못 처리했다."), W(x0, "other", "해의 좌표를 답했다."), W((x0 + d) / x0, "sign_error", "상수항을 더해 이항했다."), W(d, "other", "상수항을 답했다."), W(k + 1, "other", "계산 실수."), ...near(k)],
        verificationJs: withParams({ a, b, d }, "const out=[];\nfor(let x=-300;x<=300;x++){ if(P.a*x+P.b!==x) continue; for(let k=-80;k<=80;k++) if(k*x+P.d===x) out.push(k); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T(`x = y 이므로 첫 식에 y 대신 x 를 넣으면 $x = ${lin(a, b)}$ 이다.`, "Use y = x in the first equation."), T(`정리하면 $${1 - a}x = ${b}$ 이다.`, "Collect the x-terms."), T(`x = ${x0}, y = ${x0} 이다.`, "Solve for the solution."), T(`둘째 식에 대입하면 ${x0} = ${K === "k" ? "k" : K}·${pr(x0)} + ${pr(d)} 이다.`, "Substitute into the second equation."), T(`K = (${x0} - ${pr(d)}) / ${pr(x0)} = ${k} 이다.`, "Solve for the constant.")],
        variant: "solution_on_y_equals_x",
      });
    },
  },
  {
    id: "l2.intersection_sum.inverse", skill: SKILL, kind: "intersection_sum", operator: "inverse",
    structure: "해의 좌표의 합 x + y = S 가 주어질 때 첫 식으로 x, y 를 구하고 둘째 식의 상수 k 를 역산",
    extraThinking: "해의 좌표 합이라는 간접 정보에서 해를 복원한 뒤 미지 상수를 결정 — medium 은 두 식이 주어진 연립에서 x + y 를 구함",
    concepts: ["연립방정식의 해", "합 조건으로 해 복원", "미지 상수 역산"], mediumSteps: 4,
    generate(rng) {
      const a = rng.pick([2, 3, 4, -2]), b = rng.int(-9, 9), c = rng.nz(-4, 5), x0 = rng.nz(-5, 6), y0 = a * x0 + b, S = x0 + y0, k = y0 - c * x0; if (c === a || Math.abs(k) > 40 || Math.abs(S) > 40 || S === 0) throw new GenFail("x");
      const K = rng.pick(["k", "p", "c"]);
      return finish(rng, {
        stimulus: `${rng.pick([`In the system below, ${K} is a constant.`, `Consider the system below, where ${K} is a constant.`, `The system below has a constant ${K}.`])} ${rng.pick([`The sum of the x-coordinate and y-coordinate of the solution is ${S}.`, `For the solution $(x, y)$, ${M(`x + y = ${S}`)}.`, `The coordinates of the solution add up to ${S}.`, `The solution has ${M(`x + y = ${S}`)}.`])}\n\n${M(yEq(a, b))}\n${M(`y = ${lin(c, 0)} + ${K}`.replace("+ -", "- "))}`,
        question: spin(rng, `[[What is the value of ${K}?|Find ${K}.|What must ${K} equal?|What value of ${K} gives this solution?]]`), correct: k,
        wrongs: [W(-k, "sign_error", "부호를 잘못 처리했다."), W(S - c * x0, "step_missing", "x + y = S 를 y 로 착각했다."), W(y0 - c * y0, "formula_misuse", "x 대신 y 를 대입했다."), W(x0, "other", "x 좌표를 답했다."), W(y0, "other", "y 좌표를 답했다."), ...near(k)],
        verificationJs: withParams({ a, b, c, S }, "const out=[];\nfor(let x=-300;x<=300;x++){ const y=P.a*x+P.b; if(x+y!==P.S) continue; for(let k=-300;k<=300;k++) if(P.c*x+k===y) out.push(k); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T(`첫 식의 y = ${lin(a, b)} 를 x + y = ${S} 에 대입한다.`, "Substitute the first equation into the sum."), T(`$x + ${lin(a, b)} = ${S}$ 이므로 $${a + 1}x = ${S - b}$ 이다.`, "Collect the x-terms."), T(`x = ${x0} 이고 y = ${y0} 이다.`, "Find the solution."), T(`둘째 식에 대입하면 ${y0} = ${c}·${pr(x0)} + K 이다.`, "Substitute into the second equation."), T(`K = ${y0} - ${pr(c * x0)} = ${k} 이다.`, "Solve for the constant.")],
        variant: "unknown_constant_from_coordinate_sum",
      });
    },
  },
  {
    id: "l2.intersection_sum.compose_kind", skill: SKILL, kind: "intersection_sum", operator: "compose_kind",
    structure: "대칭인 표준형 연립 px + qy = r1, qx + py = r2 에서 두 식을 더해 x + y 를 곧바로 구하고 소거로 검산",
    extraThinking: "두 식을 더해 (p+q)(x+y) 로 묶는 구조 발견(소거와 합의 합성) — medium 은 해를 구한 뒤 더하는 방식",
    concepts: ["연립방정식 소거", "식의 합으로 묶기", "해의 합"], mediumSteps: 4,
    generate(rng) {
      const p = rng.int(2, 7), q = rng.int(1, 6), x0 = rng.int(-6, 9), y0 = rng.int(-6, 9); if (p === q || x0 === y0 || p + q === 0) throw new GenFail("x");
      const r1 = p * x0 + q * y0, r2 = q * x0 + p * y0, S = x0 + y0; if (Math.abs(r1) > 99 || Math.abs(r2) > 99) throw new GenFail("x");
      return finish(rng, {
        stimulus: `${rng.pick(LEADS)}\n\n${M(stdEq(p, q, r1))}\n${M(stdEq(q, p, r2))}`,
        question: spin(rng, "[[What is the value of $x + y$?|The solution is $(x, y)$. What is $x + y$?|What is the sum of the x-coordinate and the y-coordinate of the solution?|Find $x + y$ for the solution of the system.|If $(x, y)$ is the solution, what does $x + y$ equal?|What is the sum of the two coordinates of the solution?]]"), correct: S,
        wrongs: [W(x0 - y0, "other", "차 x − y 를 답했다."), W(r1 + r2, "step_missing", "두 식을 더하고 x + y 의 계수로 나누지 않았다."), W(Math.round((r1 + r2) / (p - q)), "formula_misuse", "x + y 의 계수를 p − q 로 잘못 계산했다."), W(x0, "other", "x 좌표를 답했다."), W(y0, "other", "y 좌표를 답했다."), ...near(S)],
        verificationJs: withParams({ a1: p, b1: q, c1: r1, a2: q, b2: p, c2: r2 }, SOLVE_JS + "return X+Y;"),
        trace: [T(`두 식을 더하면 $${p + q}x + ${p + q}y = ${r1 + r2}$ 이다.`, "Add the equations."), T(`$${p + q}(x + y) = ${r1 + r2}$ 로 묶는다.`, "Factor out the common coefficient."), T(`${p + q} 로 나누면 x + y = ${S} 이다.`, "Divide."), T(`검산: 두 식을 빼면 $${p - q}x - ${p - q}y = ${r1 - r2}$ 이므로 x - y = ${(r1 - r2) / (p - q)} 이다.`, "Check by subtracting."), T(`x = ${x0}, y = ${y0} 이고 x + y = ${S} 이다.`, "Confirm the solution.")],
        variant: "symmetric_system_sum",
      });
    },
  },
  {
    id: "l2.intersection_sum.constraint_select", skill: SKILL, kind: "intersection_sum", operator: "constraint_select",
    structure: "y = kx + b, y = mx + c 에서 1 ≤ k ≤ N 인 정수 k 중 교점이 정수 좌표인 k 를 골라 x + y 의 합을 구함",
    extraThinking: "k 마다 x = (c−b)/(k−m) 이 정수인지 약수 조건으로 후보를 고르고 각 후보의 x + y 를 합산 — medium 은 교점의 x + y 하나",
    concepts: ["연립방정식의 교점", "약수 조건(정수 해)", "후보 선택과 합산"], mediumSteps: 4,
    generate(rng) {
      const b = rng.int(-6, 6), m = rng.int(-4, -1), c = b + rng.pick([6, 8, 10, 12, 14, 15, 16, 18, 20, 24]), N = rng.int(8, 14);
      const items: { k: number; s: number }[] = []; for (let k = 1; k <= N; k++) { const den = k - m, num = c - b; if (num % den === 0) { const x = num / den; items.push({ k, s: x + m * x + c }); } }
      if (items.length < 2 || items.length > 6) throw new GenFail("x"); const total = items.reduce((p, v) => p + v.s, 0);
      return finish(rng, {
        stimulus: `${rng.pick(["In the system below, k is an integer with 1 ≤ k ≤ " + N + ".", "For the system below, k is a whole number from 1 to " + N + ".", "The constant k in the system below is a positive integer no larger than " + N + ".", "Let k be an integer between 1 and " + N + ", inclusive, in the system below.", "The system below has a parameter k that can be 1, 2, ..., " + N + ".", "In the system below, the integer k satisfies 1 ≤ k ≤ " + N + "."])} ${rng.pick(["For some values of k, the solution $(x, y)$ has integer coordinates.", "Only some values of k give a solution whose coordinates are both integers.", "Consider the values of k for which both coordinates of the solution are integers.", "Some choices of k make both coordinates of the solution whole numbers.", "A choice of k is called good when both coordinates of the solution are integers.", "Look only at the values of k for which x and y are both integers."])}\n\n${M(`y = kx ${b >= 0 ? "+" : "-"} ${Math.abs(b)}`)}\n${M(yEq(m, c))}`,
        question: spin(rng, "[[For each such value of k, find $x + y$. What is the sum of all these values?|Adding $x + y$ for every such value of k gives what total?|What is the total of $x + y$ over all values of k that give integer solutions?|Over all good values of k, what do the sums $x + y$ add up to?|What is the sum of x + y over all of these solutions?|If x + y is recorded for each such k, what is the total?]]"), correct: total,
        wrongs: [W(items.reduce((p, v) => p + v.k, 0), "other", "k 의 합을 답했다."), W(items.length, "other", "가능한 k 의 개수를 답했다."), W(total - items[items.length - 1].s, "condition_ignored", "마지막 후보를 빠뜨렸다."), W(items.reduce((p, v) => p + Math.abs(v.s), 0), "sign_error", "절댓값을 더했다."), W(total + (c - b), "other", "범위 밖 k 를 포함했다."), ...near(total)],
        verificationJs: withParams({ b, m, c, N }, "let total=0, cnt=0;\nfor(let k=1;k<=P.N;k++){ for(let x=-300;x<=300;x++){ const y=k*x+P.b; if(y===P.m*x+P.c){ total+=x+y; cnt++; } } }\nif(!cnt) throw new Error('해 없음');\nreturn total;"),
        trace: [T(`두 식에서 $(k ${m >= 0 ? "-" : "+"} ${Math.abs(m)})x = ${c - b}$ 이다.`, "Set the equations equal."), T(`x = ${c - b}/(k - ${pr(m)}) 이 정수여야 한다.`, "x must be an integer."), T(`${c - b} 의 약수 조건에서 1 ≤ k ≤ ${N} 인 k 는 ${items.map((i) => i.k).join(", ")} 이다.`, "List the valid k."), T(`각 k 에서 x + y 는 ${items.map((i) => i.s).join(", ")} 이다.`, "Compute each x + y."), T(`합은 ${total} 이다.`, "Add.")],
        variant: "integer_solutions_sum_of_coordinates",
      });
    },
  },
  // ============ slope ============
  {
    id: "l2.slope.chain2", skill: SKILL, kind: "slope", operator: "chain2",
    structure: "두 직선의 교점 P 를 구하고, P 와 다른 점 Q 를 지나는 직선의 기울기를 구함",
    extraThinking: "교점을 먼저 구해 그 좌표를 기울기 공식에 넘기는 2단계 연쇄 — medium 은 식에서 기울기를 읽음",
    concepts: ["연립방정식의 교점", "두 점으로 기울기"], mediumSteps: 1,
    generate(rng) {
      const m1 = rng.nz(-4, 5), m2 = rng.nz(-4, 5), b1 = rng.int(-9, 9), x0 = rng.int(-5, 6); if (m1 === m2) throw new GenFail("x");
      const y0 = m1 * x0 + b1, b2 = y0 - m2 * x0, s = rng.nz(-5, 6), dx = rng.int(1, 5), qx = x0 + dx, qy = y0 + s * dx; if (Math.abs(b2) > 40 || Math.abs(qy) > 50) throw new GenFail("x");
      return finish(rng, {
        stimulus: `${rng.pick(["Lines A and B are given by the equations below.", "The equations of two lines, A and B, are below.", "Line A and line B are described by the following equations.", "Consider lines A and B with the equations below.", "Two lines, A and B, have the equations below."])}\n\n${M(`A: ${yEq(m1, b1)}`)}\n${M(`B: ${yEq(m2, b2)}`)}\n\n${rng.pick([`Line C passes through the point where A and B intersect and through the point ${M(`(${qx}, ${qy})`)}.`, `The point where A and B meet and the point ${M(`(${qx}, ${qy})`)} both lie on line C.`, `Line C is drawn through ${M(`(${qx}, ${qy})`)} and the intersection point of A and B.`, `A third line, C, goes through ${M(`(${qx}, ${qy})`)} and through the point where lines A and B cross.`, `Line C contains both the intersection of A and B and the point ${M(`(${qx}, ${qy})`)}.`])}`,
        question: spin(rng, "[[What is the slope of line C?|Find the slope of line C.|What slope does line C have?|What is the slope of C?|How steep is line C? Give its slope.|Line C has what rate of change?]]"), correct: s,
        wrongs: [W(-s, "sign_error", "기울기의 부호를 반대로 구했다."), W(m1, "step_missing", "직선 A 의 기울기를 답했다."), W(m1 + m2, "formula_misuse", "두 기울기를 더했다."), W(Math.round((qy - b1) / qx * 100) / 100, "formula_misuse", "교점 대신 A 의 절편을 썼다."), W(qy - y0, "step_missing", "x 의 변화량으로 나누지 않았다."), ...near(s)],
        verificationJs: withParams({ m1, b1, m2, b2, qx, qy }, "let X=null;\nfor(let x=-300;x<=300;x++) if(P.m1*x+P.b1===P.m2*x+P.b2){ X=x; break; }\nif(X===null) throw new Error('교점 없음');\nconst Y=P.m1*X+P.b1;\nreturn (P.qy-Y)/(P.qx-X);"),
        trace: [T(`교점에서 $${lin(m1, b1)} = ${lin(m2, b2)}$ 이다.`, "Set A equal to B."), T(`x 항을 모으면 $${m1 - m2}x = ${b2 - b1}$ 이므로 x = ${x0} 이다.`, "Solve for x."), T(`y = ${m1}·${pr(x0)} + ${pr(b1)} = ${y0} 이므로 교점은 (${x0}, ${y0}) 이다.`, "Find the intersection."), T(`C 는 (${x0}, ${y0}) 와 (${qx}, ${qy}) 를 지난다.`, "Identify the two points of C."), T(`기울기는 (${qy} - ${pr(y0)}) / (${qx} - ${pr(x0)}) = ${s} 이다.`, "Compute the slope.")],
        variant: "slope_through_intersection",
      });
    },
  },
  {
    id: "l2.slope.inverse", skill: SKILL, kind: "slope", operator: "inverse",
    structure: "y = ax + b 의 그래프와 kx + ty = c 의 그래프가 수직이라는 조건에서 k 를 역산(기울기의 곱 = −1)",
    extraThinking: "표준형에서 기울기 −k/t 를 읽고 수직 조건(기울기의 곱 −1)을 방정식으로 세워 미지 계수를 결정 — medium 은 식에서 기울기를 읽음",
    concepts: ["표준형의 기울기", "수직 조건", "미지 계수 역산"], mediumSteps: 1,
    generate(rng) {
      const a = rng.pick([2, 3, 4, -2, -3, 5]), t = a * rng.nz(-3, 4), k = t / a, b = rng.int(-9, 9), c = rng.nz(-30, 30); if (Math.abs(t) > 20 || Math.abs(k) < 1) throw new GenFail("x");
      const K = rng.pick(["k", "p", "c"]);
      return finish(rng, {
        stimulus: `${rng.pick(["In the xy-plane,", "In a coordinate plane,", "Two lines are drawn in the xy-plane.", "Consider two lines in the xy-plane.", "In the coordinate plane,"])} ${rng.pick([`the graph of ${M(yEq(a, b))} is perpendicular to the graph of ${M(`${K}x ${t >= 0 ? "+" : "-"} ${Math.abs(t)}y = ${c}`)}, where ${K} is a constant.`, `line 1 is ${M(yEq(a, b))} and line 2 is ${M(`${K}x ${t >= 0 ? "+" : "-"} ${Math.abs(t)}y = ${c}`)}; the two lines are perpendicular, and ${K} is a constant.`, `the lines ${M(yEq(a, b))} and ${M(`${K}x ${t >= 0 ? "+" : "-"} ${Math.abs(t)}y = ${c}`)} meet at a right angle, where ${K} is a constant.`, `the line ${M(yEq(a, b))} is at right angles to the line ${M(`${K}x ${t >= 0 ? "+" : "-"} ${Math.abs(t)}y = ${c}`)}, and ${K} is a constant.`, `the lines ${M(yEq(a, b))} and ${M(`${K}x ${t >= 0 ? "+" : "-"} ${Math.abs(t)}y = ${c}`)} are perpendicular to each other, for a constant ${K}.`])}`.replace(/\+ -/g, "- "),
        question: spin(rng, `[[What is the value of ${K}?|Find ${K}.|What must ${K} equal?|What value of ${K} makes the lines perpendicular?]]`), correct: k,
        wrongs: [W(-k, "sign_error", "음수 부호를 놓쳤다(기울기 −k/t 의 부호)."), W(Math.round(-t / a * 1) * -1 * -1, "formula_misuse", "수직이 아니라 평행 조건을 적용했다."), W(t * a, "formula_misuse", "기울기의 곱을 계수의 곱으로 착각했다."), W(a, "other", "첫 직선의 기울기를 답했다."), W(t, "other", "y 의 계수를 답했다."), ...near(k)],
        verificationJs: withParams({ a, t }, "const out=[];\nfor(let k=-60;k<=60;k++){ if(k===0) continue; const s2=-k/P.t; if(Math.abs(P.a*s2+1)<1e-9) out.push(k); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T(`첫 직선의 기울기는 ${a} 이다.`, "Read the first slope."), T(`둘째 직선을 y 에 대해 풀면 $y = (-${K}/${pr(t)})x + ${c}/${pr(t)}$ 이므로 기울기는 -${K}/${pr(t)} 이다.`, "Read the second slope."), T("수직이면 기울기의 곱이 -1 이다.", "Perpendicular slopes multiply to -1."), T(`$${a}\\cdot (-${K}/${pr(t)}) = -1$ 이다.`, "Set up the equation."), T(`${K} = ${t}/${pr(a)} = ${k} 이다.`, "Solve.")],
        variant: "perpendicular_condition_for_coefficient",
      });
    },
  },
  {
    id: "l2.slope.compose_kind", skill: SKILL, kind: "slope", operator: "compose_kind",
    structure: "두 직선의 교점 P 와 원점을 지나는 직선의 기울기(y0/x0)를 구함",
    extraThinking: "연립으로 교점을 구한 뒤 원점과 이은 직선의 기울기를 구하는 합성 — medium 은 식에서 기울기를 읽음",
    concepts: ["연립방정식의 교점", "원점을 지나는 직선의 기울기"], mediumSteps: 1,
    generate(rng) {
      const x0 = rng.nz(-5, 6), s = rng.nz(-4, 5), y0 = s * x0, m1 = rng.nz(-4, 5), m2 = rng.nz(-4, 5); if (m1 === m2) throw new GenFail("x");
      const b1 = y0 - m1 * x0, b2 = y0 - m2 * x0; if (Math.abs(b1) > 40 || Math.abs(b2) > 40 || b1 === 0 || b2 === 0) throw new GenFail("x");
      return finish(rng, {
        stimulus: `${rng.pick(LEADS)}\n\n${M(yEq(m1, b1))}\n${M(yEq(m2, b2))}\n\n${rng.pick(["Let P be the point where the two lines intersect, and let O be the origin.", "The two lines intersect at the point P, and O is the origin.", "Point P is the intersection of the two lines. Point O is the origin $(0, 0)$.", "The lines cross at a point P; O denotes the origin.", "Call the intersection point P and the origin O.", "Let P be the common point of the two lines, and let O be the point $(0, 0)$."])}`,
        question: spin(rng, "[[What is the slope of line segment OP?|What is the slope of the line through O and P?|Find the slope of the line passing through the origin and P.|What is the slope of segment OP?|How steep is the segment from O to P? Give its slope.|The segment OP has what slope?]]"), correct: s,
        wrongs: [W(-s, "sign_error", "부호를 잘못 처리했다."), W(y0, "other", "P 의 y 좌표를 답했다."), W(x0, "other", "P 의 x 좌표를 답했다."), W(m1 + m2, "formula_misuse", "두 기울기를 더했다."), W(Math.round((x0 / y0) * 100) / 100, "formula_misuse", "기울기를 거꾸로 계산했다."), ...near(s)],
        verificationJs: withParams({ m1, b1, m2, b2 }, "let X=null;\nfor(let x=-300;x<=300;x++) if(P.m1*x+P.b1===P.m2*x+P.b2){ X=x; break; }\nif(X===null||X===0) throw new Error('교점 없음');\nconst Y=P.m1*X+P.b1;\nreturn Y/X;"),
        trace: [T(`교점에서 $${lin(m1, b1)} = ${lin(m2, b2)}$ 이다.`, "Set the equations equal."), T(`x 항을 모으면 $${m1 - m2}x = ${b2 - b1}$ 이므로 x = ${x0} 이다.`, "Solve for x."), T(`y = ${m1}·${pr(x0)} + ${pr(b1)} = ${y0} 이므로 P = (${x0}, ${y0}) 이다.`, "Find P."), T(`O = (0, 0) 과 P 로 기울기 공식을 쓴다: (${y0} - 0)/(${x0} - 0).`, "Write the slope formula."), T(`약분하면 ${s} 이다.`, "Simplify.")],
        variant: "slope_from_origin_to_intersection",
      });
    },
  },
  {
    id: "l2.slope.repr_shift", skill: SKILL, kind: "slope", operator: "repr_shift",
    structure: "두 종류 물건의 가격 a, b 와 총 지출 T 로 ax + by = T 를 세우고 y 에 대해 풀어 기울기(−a/b)가 뜻하는 교환 비율을 구함",
    extraThinking: "문장을 표준형으로 모델링하고 y 에 대해 풀어 기울기를 '한 종류를 더 사면 다른 종류를 몇 개 덜 사는가'로 해석 — medium 은 식에서 기울기를 읽음",
    concepts: ["문장→표준형 방정식", "기울기의 의미(교환 비율)"], mediumSteps: 1,
    generate(rng) {
      const b = rng.int(2, 6), a = b * rng.int(2, 4), t = rng.int(6, 14) * a * b / gcdN(a, b); if (t > 600) throw new GenFail("x");
      const [A, B] = rng.pick([["notebook", "pen"], ["ticket", "snack"], ["book", "bookmark"], ["pizza", "drink"]] as const);
      const m = a / b;
      return finish(rng, {
        stimulus: `${rng.pick([`A student spends exactly ${t} dollars on ${A}s and ${B}s.`, `Exactly ${t} dollars are spent on ${A}s and ${B}s.`, `A club uses its whole budget of ${t} dollars to buy ${A}s and ${B}s.`])} ${rng.pick([`Each ${A} costs ${a} dollars, and each ${B} costs ${b} dollars.`, `A ${A} costs ${a} dollars, and a ${B} costs ${b} dollars.`, `The price of one ${A} is ${a} dollars, and the price of one ${B} is ${b} dollars.`])} ${rng.pick([`Let x be the number of ${A}s and y be the number of ${B}s.`, `The number of ${A}s is x, and the number of ${B}s is y.`])}`,
        question: spin(rng, `[[The graph of this relationship in the xy-plane is a line. For each additional ${A}, how many fewer ${B}s are bought?|On the line representing all possible purchases, y decreases by how many for each increase of 1 in x?|What is the absolute value of the slope of the line representing all possible purchases?]]`), correct: m,
        phraseBindings: [{ phrase: A, value: a }, { phrase: B, value: b }],
        wrongs: [W(1 / m, "formula_misuse", "기울기를 거꾸로(b/a) 계산했다."), W(a, "other", "한 개의 가격을 답했다."), W(t / b, "other", "y 절편을 답했다."), W(a + b, "formula_misuse", "가격의 합을 답했다."), W(a - b, "formula_misuse", "가격의 차를 답했다."), ...near(m)],
        verificationJs: withParams({ a, b, t }, "const y=x=>(P.t-P.a*x)/P.b;\nreturn y(0)-y(1);"),
        trace: [T(`지출 식은 $${a}x + ${b}y = ${t}$ 이다.`, "Write the budget equation."), T(`y 에 대해 풀면 $${b}y = ${t} - ${a}x$ 이다.`, "Isolate the y-term."), T(`$y = -\\frac{${a}}{${b}}x + \\frac{${t}}{${b}}$ 이다.`, "Divide by the coefficient of y."), T(`기울기는 -${a}/${b} = -${m} 이다.`, "Read the slope."), T(`x 가 1 늘 때 y 는 ${m} 줄어든다(기울기의 절댓값 ${m}).`, "Interpret it as an exchange rate.")],
        variant: "exchange_rate_from_budget",
      });
    },
  },
  // ============ intercept ============
  {
    id: "l2.intercept.inverse", skill: SKILL, kind: "intercept", operator: "inverse",
    structure: "x 절편 (p,0) 과 기울기 s 로부터 y 절편을 역으로 구함",
    extraThinking: "x 절편이라는 간접 정보를 식에 대입해 y 절편을 역산 — medium 은 식에서 y 절편을 읽음",
    concepts: ["x 절편의 의미", "y 절편 구하기"], mediumSteps: 1,
    generate(rng) {
      const s = rng.nz(-6, 7), p = rng.nz(-8, 9), b = -s * p; if (Math.abs(b) > 60) throw new GenFail("x");
      const L = rng.pick(["ℓ", "m", "k", "n"]);
      return finish(rng, {
        stimulus: `${rng.pick([`Line ${L} has a slope of ${s} and crosses the x-axis at the point ${M(`(${p}, 0)`)}.`, `The slope of line ${L} is ${s}, and its x-intercept is ${M(`(${p}, 0)`)}.`, `Line ${L} passes through the x-axis at ${M(`(${p}, 0)`)} and has slope ${s}.`, `A line ${L} with slope ${s} has the point ${M(`(${p}, 0)`)} as its x-intercept.`, `In the xy-plane, line ${L} has slope ${s} and meets the x-axis at ${M(`(${p}, 0)`)}.`, `The graph of line ${L}, whose slope is ${s}, touches the x-axis at ${M(`(${p}, 0)`)}.`, `Line ${L} rises or falls with slope ${s} and has x-intercept ${M(`(${p}, 0)`)}.`])}`,
        question: spin(rng, `[[What is the y-intercept of line ${L}?|At what y-value does line ${L} cross the y-axis?|What is the y-coordinate of the point where line ${L} crosses the y-axis?|Line ${L} crosses the y-axis at $(0, y)$. What is y?|Where does line ${L} meet the y-axis? Give the y-coordinate.|What is the value of y when x = 0 on line ${L}?]]`), correct: b,
        wrongs: [W(-b, "sign_error", "부호를 잘못 처리했다."), W(p, "other", "x 절편을 답했다."), W(s, "other", "기울기를 답했다."), W(s + p, "formula_misuse", "기울기와 x 절편을 더했다."), W(Math.round(-p / s * 100) / 100, "formula_misuse", "−p/s 를 답했다."), ...near(b)],
        verificationJs: withParams({ s, p }, "const out=[];\nfor(let b=-300;b<=300;b++) if(P.s*P.p+b===0) out.push(b);\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T(`x 절편이 (${p}, 0) 이므로 x = ${p} 일 때 y = 0 이다.`, "At the x-intercept y = 0."), T(`직선을 $y = ${s}x + b$ 로 놓는다.`, "Write the form."), T(`대입하면 $0 = ${s}\\cdot ${pr(p)} + b$ 이다.`, "Substitute."), T(`${s}·${pr(p)} = ${s * p} 이다.`, "Compute the product."), T(`b = -${pr(s * p)} = ${b} 이므로 y 절편은 ${b} 이다.`, "Solve for b.")],
        variant: "y_intercept_from_x_intercept",
      });
    },
  },
  {
    id: "l2.intercept.chain2", skill: SKILL, kind: "intercept", operator: "chain2",
    structure: "두 직선 A, B 의 교점 P 를 구하고, P 를 지나며 A 에 평행한 직선의 y 절편을 구함",
    extraThinking: "교점을 구한 뒤 그 점을 지나는 평행선의 식을 다시 세워 절편을 구하는 2단계 연쇄 — medium 은 식에서 절편을 읽음",
    concepts: ["연립방정식의 교점", "평행한 직선(같은 기울기)", "점과 기울기로 절편 구하기"], mediumSteps: 1,
    generate(rng) {
      const m1 = rng.nz(-4, 5), m2 = rng.nz(-4, 5), b1 = rng.int(-9, 9), x0 = rng.nz(-5, 6); if (m1 === m2) throw new GenFail("x");
      const y0 = m1 * x0 + b1, b2 = y0 - m2 * x0, m3 = rng.nz(-5, 6), b3 = y0 - m3 * x0; if (Math.abs(b2) > 40 || Math.abs(b3) > 50) throw new GenFail("x");
      return finish(rng, {
        stimulus: `${rng.pick(["Lines A and B are given by the equations below.", "The equations of two lines, A and B, are below.", "Line A and line B are described by the following equations.", "Consider lines A and B with the equations below.", "Two lines, A and B, have the equations below."])}\n\n${M(`A: ${yEq(m1, b1)}`)}\n${M(`B: ${yEq(m2, b2)}`)}\n\n${rng.pick([`Line C has slope ${m3} and passes through the point where A and B intersect.`, `The intersection point of A and B lies on line C, whose slope is ${m3}.`, `Line C, with a slope of ${m3}, is drawn through the point where A meets B.`, `A third line, C, has slope ${m3} and goes through the common point of A and B.`, `Line C with slope ${m3} contains the point at which lines A and B cross.`])}`,
        question: spin(rng, "[[What is the y-intercept of line C?|At what y-value does line C cross the y-axis?|What is the y-coordinate of the point where line C crosses the y-axis?|Line C crosses the y-axis at $(0, y)$. What is y?|Where does line C meet the y-axis? Give the y-coordinate.|What is the value of y when x = 0 on line C?]]"), correct: b3,
        wrongs: [W(y0, "step_missing", "교점의 y 좌표를 절편으로 답했다."), W(-b3, "sign_error", "절편의 부호를 반대로 구했다."), W(y0 + m3 * x0, "sign_error", "절편을 구할 때 부호를 반대로 적용했다."), W(b1, "other", "직선 A 의 절편을 답했다."), W(m3, "other", "기울기를 답했다."), ...near(b3)],
        verificationJs: withParams({ m1, b1, m2, b2, m3 }, "let X=null;\nfor(let x=-300;x<=300;x++) if(P.m1*x+P.b1===P.m2*x+P.b2){ X=x; break; }\nif(X===null) throw new Error('교점 없음');\nconst Y=P.m1*X+P.b1;\nreturn Y-P.m3*X;"),
        trace: [T(`교점에서 $${lin(m1, b1)} = ${lin(m2, b2)}$ 이다.`, "Set A equal to B."), T(`x 항을 모으면 $${m1 - m2}x = ${b2 - b1}$ 이므로 x = ${x0} 이다.`, "Solve for x."), T(`y = ${m1}·${pr(x0)} + ${pr(b1)} = ${y0} 이므로 교점은 (${x0}, ${y0}) 이다.`, "Find the intersection."), T(`C 는 $y = ${m3}x + b$ 이고 점 (${x0}, ${y0}) 를 지난다: ${y0} = ${m3}·${pr(x0)} + b.`, "Substitute the point into line C."), T(`b = ${y0} - ${pr(m3 * x0)} = ${b3} 이다.`, "Solve for b.")],
        variant: "line_through_intersection_intercept",
      });
    },
  },
  {
    id: "l2.intercept.repr_shift", skill: SKILL, kind: "intercept", operator: "repr_shift",
    structure: "두 종류 물건의 가격 a, b 와 총 지출 T 로 ax + by = T 를 세우고 x = 0 을 대입해 y 절편 T/b 의 의미를 구함",
    extraThinking: "문장을 표준형으로 모델링하고 절편(한 종류만 살 때의 개수)으로 해석 — medium 은 식에서 절편을 읽음",
    concepts: ["문장→표준형 방정식", "절편의 의미"], mediumSteps: 1,
    generate(rng) {
      const a = rng.int(2, 9), b = rng.int(2, 9), n = rng.int(3, 14), t = b * n; if (a === b) throw new GenFail("x");
      const [A, B] = rng.pick([["notebook", "pen"], ["ticket", "snack"], ["book", "bookmark"], ["pizza", "drink"]] as const);
      return finish(rng, {
        stimulus: `${rng.pick([`A student spends exactly ${t} dollars on ${A}s and ${B}s.`, `Exactly ${t} dollars are spent on ${A}s and ${B}s.`, `A club uses its whole budget of ${t} dollars to buy ${A}s and ${B}s.`])} ${rng.pick([`Each ${A} costs ${a} dollars, and each ${B} costs ${b} dollars.`, `A ${A} costs ${a} dollars, and a ${B} costs ${b} dollars.`, `The price of one ${A} is ${a} dollars, and the price of one ${B} is ${b} dollars.`])} ${rng.pick([`Let x be the number of ${A}s and y be the number of ${B}s, and consider the graph of the relationship in the xy-plane.`, `The number of ${A}s is x and the number of ${B}s is y; the graph of this relationship is a line.`])}`,
        question: spin(rng, `[[How many ${B}s can be bought if no ${A}s are bought?|What is the y-intercept of the line, which is the number of ${B}s bought when no ${A}s are bought?|If the club buys no ${A}s at all, how many ${B}s does it buy?|On the graph, the y-intercept shows how many ${B}s can be bought with no ${A}s. What is it?]]`), correct: n,
        phraseBindings: [{ phrase: A, value: a }, { phrase: B, value: b }],
        wrongs: [W(t / a, "other", "x 절편(펜 없이 살 수 있는 수)을 답했다."), W(t, "other", "총 지출을 답했다."), W(a + b, "formula_misuse", "가격의 합을 답했다."), W(t - a, "formula_misuse", "총 지출에서 가격을 뺐다."), W(n + 1, "other", "계산 실수."), ...near(n)],
        verificationJs: withParams({ a, b, t }, "for(let y=0;y<=2000;y++) if(P.a*0+P.b*y===P.t) return y;\nthrow new Error('없음');"),
        trace: [T(`지출 식은 $${a}x + ${b}y = ${t}$ 이다.`, "Write the budget equation."), T("y 절편은 x = 0 일 때의 y 이다.", "The y-intercept is the y-value at x = 0."), T(`x = 0 을 대입하면 $${b}y = ${t}$ 이다.`, "Substitute x = 0."), T(`y = ${t}/${b} = ${n} 이다.`, "Solve for y."), T(`뜻: ${A}을(를) 사지 않으면 ${B}을(를) ${n}개 살 수 있다.`, "Interpret.")],
        variant: "intercept_meaning_from_budget",
      });
    },
  },
  {
    id: "l2.intercept.compare_scenarios", skill: SKILL, kind: "intercept", operator: "compare_scenarios",
    structure: "직선 A 는 y = mx + b 로, 직선 B 는 표준형 px + qy = r 로 주어질 때 두 y 절편의 차를 구함",
    extraThinking: "서로 다른 형태(기울기-절편형·표준형)의 두 식에서 y 절편을 각각 구해 비교 — medium 은 식에서 y 절편 하나를 읽음",
    concepts: ["표준형의 y 절편", "기울기-절편형의 y 절편", "두 값의 비교"], mediumSteps: 1,
    generate(rng) {
      const m = rng.nz(-5, 6), b = rng.int(8, 40), q = rng.int(2, 6), p = rng.nz(-6, 7), bb = rng.int(-5, 9), r = q * bb; const d = b - bb; if (d <= 0 || Math.abs(d) > 50 || r === 0) throw new GenFail("x");
      return finish(rng, {
        stimulus: `${rng.pick(["Two lines in the xy-plane are given below.", "Lines A and B are described by the equations below.", "The equations of lines A and B are listed below.", "A student compares two lines, A and B, written below.", "Line A and line B are written in different forms below.", "Consider the two lines A and B below, which are written in different forms."])}\n\n${M(`A: ${yEq(m, b)}`)}\n${M(`B: ${stdEq(p, q, r)}`)}`,
        question: spin(rng, `[[What is the y-intercept of line A minus the y-intercept of line B?|By how much does the y-intercept of A differ from the y-intercept of B (A minus B)?|What is the difference between the y-intercepts of A and B, A minus B?|Subtract the y-intercept of B from the y-intercept of A. What is the result?|The y-intercept of A is how much greater than the y-intercept of B?|What is the y-intercept of A, minus the y-intercept of B?]]`), correct: d,
        wrongs: [W(-d, "sign_error", "차의 부호를 반대 순서로 계산했다."), W(b - r, "step_missing", "B 의 상수항 r 을 y 계수 q 로 나누지 않았다."), W(b + bb, "formula_misuse", "차 대신 합을 구했다."), W(b - p, "other", "B 의 x 계수와 비교했다."), W(b - r / p, "formula_misuse", "B 의 x 계수로 나눴다."), ...near(d)],
        verificationJs: withParams({ b, q, r }, "const yB=P.r/P.q;\nreturn P.b-yB;"),
        trace: [T(`A 는 기울기-절편형이므로 y 절편은 ${b} 이다.`, "Read A's intercept."), T(`B 는 표준형이므로 x = 0 을 대입한다: $${q}y = ${r}$.`, "Set x = 0 in B."), T(`y = ${r}/${q} = ${bb} 이므로 B 의 y 절편은 ${bb} 이다.`, "Solve for B's intercept."), T("A 의 절편에서 B 의 절편을 뺀다.", "Subtract."), T(`${b} - ${pr(bb)} = ${d} 이다.`, "Compute.")],
        variant: "intercepts_of_two_forms",
      });
    },
  },
  // ============ num_solutions ============
  {
    id: "l2.num_solutions.param_condition", skill: SKILL, kind: "num_solutions", operator: "param_condition",
    structure: "y = mx + b 와 kx + ty = c 가 해가 없도록(또는 무수히 많도록) 하는 k 를 기울기 일치 조건 −k/t = m 으로 구함",
    extraThinking: "'해가 없다/무수히 많다'를 기울기 일치와 절편의 불일치/일치 두 조건으로 번역해 계수를 결정 — medium 은 해의 개수를 판정만 함",
    concepts: ["연립방정식의 해의 개수", "기울기 일치 조건", "절편 비교"], mediumSteps: 2,
    generate(rng) {
      const m = rng.nz(-4, 5), t = rng.pick([2, 3, 4, 5]), k = -m * t, infinite = rng.chance(0.5), b = rng.int(-8, 8), cMatch = t * b; const c = infinite ? cMatch : cMatch + rng.nz(-6, 7); if (c === cMatch && !infinite) throw new GenFail("x");
      const K = rng.pick(["k", "p", "c"]);
      return finish(rng, {
        stimulus: `${rng.pick([`In the system below, ${K} is a constant.`, `Consider the system below, where ${K} is a constant.`, `The system below has a constant ${K}.`, `Let ${K} be a constant in the system below.`])}\n\n${M(yEq(m, b))}\n${M(`${K}x + ${t}y = ${c}`)}\n\n${infinite ? rng.pick(["The system has infinitely many solutions.", "Every solution of the first equation is also a solution of the second equation.", "The graphs of the two equations are the same line."]) : rng.pick(["The system has no solution.", "The graphs of the two equations never intersect.", "No ordered pair satisfies both equations."])}`,
        question: spin(rng, `[[What is the value of ${K}?|Find ${K}.|What must ${K} equal?|What value of ${K} makes this true?]]`), correct: k,
        wrongs: [W(-k, "sign_error", "기울기 −k/t 의 부호를 놓쳤다."), W(m * t, "sign_error", "부호를 반대로 처리했다."), W(m, "other", "기울기를 답했다."), W(t, "other", "y 의 계수를 답했다."), W(Math.round(m / t * 100) / 100, "formula_misuse", "t 를 곱하지 않고 나눴다."), ...near(k)],
        verificationJs: withParams({ m, b, t, c, inf: infinite ? 1 : 0 }, "const out=[];\nfor(let k=-60;k<=60;k++){ const sameSlope=Math.abs(-k/P.t-P.m)<1e-9; if(!sameSlope) continue; const sameLine=Math.abs(P.c/P.t-P.b)<1e-9; if((P.inf===1)===sameLine) out.push(k); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T(`첫 식의 기울기는 ${m} 이다.`, "Read the first slope."), T(`둘째 식을 y 에 대해 풀면 $y = (-${K}/${t})x + ${c}/${t}$ 이다.`, "Solve the second equation for y."), T(`${infinite ? "해가 무수히 많으면" : "해가 없으면"} 두 직선의 기울기가 같아야 한다: -${K}/${t} = ${m}.`, "Equal slopes are needed."), T(`${K} = ${k} 이다.`, "Solve for the constant."), T(infinite ? `절편도 같은지 확인한다: ${c}/${t} = ${b} 이므로 같은 직선이다.` : `절편이 다른지 확인한다: ${c}/${t} ≠ ${b} 이므로 평행하다.`, "Check the intercepts.")],
        variant: infinite ? "infinitely_many_condition" : "no_solution_condition",
      });
    },
  },
  {
    id: "l2.num_solutions.inverse", skill: SKILL, kind: "num_solutions", operator: "inverse",
    structure: "ax + py = q 와 ux + by = v 가 무수히 많은 해를 가질 때 계수 비가 같다는 조건으로 a 와 b 를 구하고 a + b 를 계산",
    extraThinking: "해의 개수 조건(무수히 많음)에서 계수 비례식을 거꾸로 세워 두 미지 계수를 결정 — medium 은 해의 개수를 판정만 함",
    concepts: ["연립방정식의 해의 개수", "계수 비례식", "미지 계수 역산"], mediumSteps: 2,
    generate(rng) {
      const rho = rng.int(2, 4), u = rng.nz(-5, 6), bb = rng.nz(-5, 6), v = rng.nz(-6, 7), a = rho * u, p = rho * bb, q = rho * v; if (Math.abs(a) > 30 || bb === 0 || u === 0 || v === 0 || Math.abs(u) === 1) throw new GenFail("x");
      const [A, B] = rng.pick([["a", "b"], ["m", "n"], ["r", "s"], ["j", "k"], ["c", "d"]] as const), ans = a + bb;
      const e1 = `${A}x ${p >= 0 ? "+" : "-"} ${Math.abs(p)}y = ${q}`, e2 = `${tm(u, "x")} + ${B}y = ${v}`;
      const first = rng.chance(0.5);
      return finish(rng, {
        stimulus: `${rng.pick([`In the system below, ${A} and ${B} are constants.`, `Consider the system below, where ${A} and ${B} are constants.`, `The system below contains the constants ${A} and ${B}.`, `Let ${A} and ${B} be constants in the system below.`, `Two constants, ${A} and ${B}, appear in the system below.`])}\n\n${M(first ? e1 : e2)}\n${M(first ? e2 : e1)}\n\n${rng.pick(["The system has infinitely many solutions.", "The two equations have exactly the same graph.", "Every ordered pair that satisfies one equation also satisfies the other.", "The graphs of the two equations coincide.", "There are infinitely many ordered pairs that satisfy both equations."])}`,
        question: spin(rng, `[[What is the value of ${A} + ${B}?|Find ${A} + ${B}.|What is the sum of ${A} and ${B}?|What does ${A} + ${B} equal?|If both conditions hold, what is ${A} + ${B}?|Determine the value of ${A} + ${B}.]]`), correct: ans,
        wrongs: [W(a - bb, "formula_misuse", "합 대신 차를 계산했다."), W(a, "step_missing", `${B} 를 구하지 않았다.`), W(bb, "step_missing", `${A} 를 구하지 않았다.`), W(p + u, "other", "주어진 계수를 더했다."), W(a + (q / v) * bb, "formula_misuse", "비례 상수를 잘못 곱했다."), ...near(ans)],
        verificationJs: withParams({ p, q, u, v }, "const out=[];\nfor(let a=-60;a<=60;a++) for(let b=-60;b<=60;b++){ if(b===0) continue; const l1=[a,P.p,P.q], l2=[P.u,b,P.v]; const cross=(r1,r2)=>r1[0]*r2[1]-r1[1]*r2[0]; const c1=l1[0]*l2[2]-l1[2]*l2[0], c2=l1[1]*l2[2]-l1[2]*l2[1]; if(cross(l1,l2)===0&&c1===0&&c2===0) out.push(a+b); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [T("해가 무수히 많으면 두 식이 비례한다: 각 계수의 비가 같다.", "Infinitely many solutions mean proportional equations."), T(`상수항의 비는 ${q}/${v} = ${rho} 이다.`, "Find the ratio from the constants."), T(`${p}/${B} = ${rho} 에서 ${B} = ${bb} 이다.`, "Solve for the second constant."), T(`${A}/${u} = ${rho} 에서 ${A} = ${a} 이다.`, "Solve for the first constant."), T(`${A} + ${B} = ${a} + ${pn(bb)} = ${ans} 이다.`, "Add.")],
        variant: "infinitely_many_two_unknowns",
      });
    },
  },
  {
    id: "l2.num_solutions.constraint_select", skill: SKILL, kind: "num_solutions", operator: "constraint_select",
    structure: "ax + ky = c1, kx + ay = c2 가 오직 하나의 해를 갖는 정수 k(−N ≤ k ≤ N)의 개수: k = ±a 일 때만 판별식이 0 이므로 제외",
    extraThinking: "판별식(계수의 교차곱) 0 이 되는 값을 찾아 제외하고 정수 범위에서 개수를 셈 — medium 은 해의 개수를 판정만 함",
    concepts: ["연립방정식의 해의 개수", "판별식(교차곱) 조건", "정수 범위의 개수"], mediumSteps: 2,
    generate(rng) {
      const a = rng.int(2, 6), N = rng.int(a, a + 6), c1 = rng.nz(-12, 13), c2 = rng.nz(-12, 13), K = rng.pick(["k", "m", "t", "c", "p"]); let cnt = 0; for (let k = -N; k <= N; k++) if (a * a - k * k !== 0) cnt++;
      const e1 = M(`${a}x + ${K}y = ${c1}`), e2 = M(`${K}x + ${a}y = ${c2}`), first = rng.chance(0.5);
      return finish(rng, {
        stimulus: `${rng.pick([`In the system below, ${K} is an integer with ${-N} ≤ ${K} ≤ ${N}.`, `For the system below, ${K} is an integer from ${-N} to ${N}, inclusive.`, `The constant ${K} in the system below is a whole number between ${-N} and ${N}, inclusive.`, `Let ${K} be any integer from ${-N} through ${N} in the system below.`, `The system below depends on an integer ${K} that is at least ${-N} and at most ${N}.`])} ${rng.pick(["For each such integer, the system may have one solution, no solution, or infinitely many solutions.", "Depending on the integer, the number of solutions can differ.", "The number of solutions of the system depends on the value chosen.", "A single choice of the integer decides whether the two lines cross, are parallel, or coincide."])}\n\n${first ? e1 : e2}\n${first ? e2 : e1}`,
        question: spin(rng, `[[For how many values of ${K} does the system have exactly one solution?|How many integer values of ${K} give the system exactly one solution?|For how many integers ${K} is there exactly one ordered pair that satisfies both equations?|The two lines intersect in exactly one point for how many values of ${K}?|How many choices of ${K} make the graphs cross at a single point?|Among the allowed integers, how many ${K} produce a unique solution?]]`), correct: cnt,
        wrongs: [W(2 * N + 1, "condition_ignored", "해가 하나가 아닌 값을 제외하지 않았다."), W(cnt + 1, "condition_ignored", "제외할 값을 하나만 뺐다."), W(cnt - 1, "other", "k = 0 을 제외했다."), W(2 * N - 2 * Math.floor(a / 2), "other", "범위를 잘못 셌다."), W(cnt + 2, "other", "계산 실수."), ...near(cnt)],
        verificationJs: withParams({ a, N, c1, c2 }, "let cnt=0;\nfor(let k=-P.N;k<=P.N;k++){ const det=P.a*P.a-k*k; if(det!==0) cnt++; }\nreturn cnt;"),
        trace: [T("해가 하나뿐이려면 두 직선이 평행하지 않아야 한다(계수의 교차곱 ≠ 0).", "A unique solution needs non-parallel lines."), T(`교차곱은 $${a}\\cdot ${a} - ${K}\\cdot ${K} = ${a * a} - ${K}^2$ 이다.`, "Compute the cross product."), T(`0 이 되는 값은 ${K} = ${a} 와 ${K} = -${a} 이다.`, "Find the excluded values."), T(`범위 ${-N} ≤ ${K} ≤ ${N} 의 정수는 ${2 * N + 1}개이다.`, "Count all integers."), T(`제외할 2개를 빼면 ${cnt}개이다.`, "Subtract the excluded values.")],
        variant: "unique_solution_count",
      });
    },
  },
  {
    id: "l2.num_solutions.compose_kind", skill: SKILL, kind: "num_solutions", operator: "compose_kind",
    structure: "방정식 ax + by = c 를 만족하는 양의 정수 순서쌍 (x, y) 의 개수를 y 에 대해 정리·약수·범위 조건으로 센다",
    extraThinking: "해의 개수 문제를 정수론(약수·범위)과 합성해 양의 정수해를 모두 열거 — medium 은 두 직선의 해의 개수를 판정",
    concepts: ["해의 개수", "양의 정수해(약수·범위 조건)"], mediumSteps: 2,
    generate(rng) {
      const a = rng.int(2, 7), b = rng.int(2, 9), c = rng.int(30, 90); if (a === b) throw new GenFail("x");
      const xs: number[] = []; for (let x = 1; x <= 60; x++) { const y = (c - a * x) / b; if (Number.isInteger(y) && y >= 1) xs.push(x); } const cnt = xs.length; if (cnt < 3 || cnt > 12) throw new GenFail("x");
      const [X, Y] = rng.pick([["x", "y"], ["m", "n"], ["a", "b"], ["p", "q"], ["s", "t"]] as const), eq = `${a}${X} + ${b}${Y} = ${c}`;
      return finish(rng, {
        stimulus: `${rng.pick(["Consider the equation below.", "The equation below involves two variables.", "Look at the equation below.", `Ordered pairs $(${X}, ${Y})$ are considered for the equation below.`, "A student looks for whole-number solutions of the equation below.", "The linear equation below has infinitely many real solutions."])}\n\n${M(eq)}`,
        question: spin(rng, `[[How many ordered pairs $(${X}, ${Y})$ of positive integers satisfy the equation?|For how many ordered pairs $(${X}, ${Y})$ with ${X} and ${Y} both positive integers is the equation true?|How many solutions in positive integers does the equation have?|What is the number of positive integer solutions $(${X}, ${Y})$ of the equation?|How many pairs of positive whole numbers make the equation true?|Among positive integers, how many ordered pairs $(${X}, ${Y})$ solve the equation?]]`), correct: cnt,
        wrongs: [W(Math.floor((c - b) / a), "condition_ignored", "y 가 정수인지 확인하지 않고 x 의 범위만 셌다."), W(cnt + 1, "condition_ignored", "y = 0 인 해를 포함했다."), W(cnt - 1, "other", "경계 해를 하나 빠뜨렸다."), W(Math.floor(c / (a * b)), "formula_misuse", "공식을 잘못 적용했다."), W(xs[xs.length - 1] - xs[0], "formula_misuse", "x 의 최대와 최소의 차를 답했다."), ...near(cnt)],
        verificationJs: withParams({ a, b, c }, "let n=0;\nfor(let x=1;x<=200;x++) for(let y=1;y<=200;y++) if(P.a*x+P.b*y===P.c) n++;\nreturn n;"),
        trace: [T(`${Y} 에 대해 풀면 $${Y} = (${c} - ${a}${X})/${b}$ 이다.`, `Solve for ${Y}.`), T(`${Y} 가 양의 정수이려면 ${c} - ${a}${X} 가 ${b} 의 양의 배수여야 한다.`, "The quotient must be a positive integer."), T(`${X} 의 범위는 1 ≤ ${X} < ${(c / a).toFixed(1)} 이다.`, `Bound ${X}.`), T(`조건을 만족하는 ${X} 는 ${xs.join(", ")} 이다.`, "List the valid values."), T(`개수는 ${cnt} 이다.`, "Count.")],
        variant: "positive_integer_solutions_count",
      });
    },
  },
  ...L2_SPR_B_ARCHETYPES,
];
const gcdN = (a: number, b: number): number => (b ? gcdN(b, a % b) : Math.abs(a));
const pn = pr;
const tm = (c: number, v: string) => `${c === 1 ? "" : c === -1 ? "-" : c}${v}`;