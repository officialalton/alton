// linear_inequalities easy/medium 원형(문장 틀 = 유사문항 그룹). easy 3 + medium 5 틀, 각 틀이 하나의 그룹이다. 정답은 모두 수치.
import { GenFail, type Archetype } from "../types";
import { facts, finish, lin, M, spin, withParams } from "../text";
import { H_JS, holds, jsOp, near, OPS, pairList, SHOP, T, W, ceilDiv, floorDiv, SERVICES, type Op } from "../kit-b";

const SKILL = "linear_inequalities";
const LET = ["x", "t", "n", "m", "w"] as const;
const pm = (n: number) => (n < 0 ? `- ${-n}` : `+ ${n}`);
const base = { skill: SKILL, operator: "frame" as const, mediumSteps: 0 };

/** 한 부등식의 경계에서 가장 가까운 정수 해(최소/최대)를 닫힌 식으로 구한다. a>0 가정. */
function edgeInt(a: number, b: number, op: Op, c: number): { lower: boolean; ans: number } {
  const bound = (c - b) / a;
  switch (op) {
    case ">": return { lower: true, ans: Math.floor(bound) + 1 };
    case "\\ge": return { lower: true, ans: Math.ceil(bound) };
    case "<": return { lower: false, ans: Math.ceil(bound) - 1 };
    default: return { lower: false, ans: Math.floor(bound) };
  }
}
const leastGreatest = (rng: Parameters<Archetype["generate"]>[0], v: string, ineq: string, lower: boolean) => {
  const word = lower ? "least" : "greatest"; const alt = lower ? "smallest" : "largest";
  return spin(rng, `[[If ${ineq}, what is the ${word} integer value of ${v}?|What is the ${word} integer ${v} that satisfies ${ineq}?|Find the ${alt} integer ${v} for which ${ineq}.|Given ${ineq}, which integer is the ${alt} possible value of ${v}?|The value ${v} is an integer and ${ineq}. What is the ${word} value ${v} can have?|For integers ${v} satisfying ${ineq}, what is the ${alt} possible ${v}?]]`);
};

export const LI_EM_ARCHETYPES: Archetype[] = [
  // ---------- easy ----------
  {
    ...base, id: "li.solve_one_var.e_integer_edge", kind: "solve_one_var", difficulty: "easy",
    structure: "양수 계수의 일차부등식을 풀고 경계에서 가장 가까운 정수 해(최소·최대)를 고른다", extraThinking: "easy 틀(1~2단계)", concepts: ["일차부등식", "정수 해"],
    generate(rng) {
      const a = rng.int(1, 5), b = rng.nz(-9, 9), op = rng.pick(OPS), v = rng.pick(LET), c = a * rng.int(-4, 8) + b + rng.pick([0, 0, 1, 2]) * (a > 1 ? 1 : 0);
      const e = edgeInt(a, b, op, c); if (Math.abs(e.ans) > 30) throw new GenFail("x");
      const ineq = M(`${lin(a, b, v)} ${op} ${c}`);
      const stimulus = rng.pick(["", "Consider the inequality below.", "An inequality is given.", "Look at the inequality below.", "Here is an inequality in one variable."]);
      return finish(rng, {
        stimulus: stimulus ? `${stimulus}\n\n${ineq}` : ineq, question: spin(rng, `[[What is the ${e.lower ? "least" : "greatest"} integer value of ${v} that satisfies the inequality?|Which integer is the ${e.lower ? "smallest" : "largest"} solution of the inequality?|Find the ${e.lower ? "least" : "greatest"} integer ${v} for which the inequality is true.|What is the ${e.lower ? "smallest" : "largest"} whole-number value of ${v} that makes it true?]]`), correct: e.ans,
        wrongs: [W(e.lower ? e.ans - 1 : e.ans + 1, "condition_ignored", "경계값을 포함하는지(엄격한 부등호인지)를 잘못 판단했다."), W(e.lower ? e.ans + 1 : e.ans - 1, "condition_ignored", "경계 정수를 하나 놓쳤다."), W(Math.round((c - b) / a), "step_missing", "경계값을 정수로 반올림해 답으로 골랐다."), W(c - b, "step_missing", "계수로 나누지 않았다."), W(-e.ans, "sign_error", "이항할 때 부호를 잘못 바꿨다."), ...near(e.ans)],
        verificationJs: withParams({ a, b, c, op: jsOp(op) }, H_JS + `const xs=[];\nfor(let x=-400;x<=400;x++) if(h(P.a*x+P.b,P.op,P.c)) xs.push(x);\nreturn P.op==='>'||P.op==='>='?Math.min(...xs):Math.max(...xs);`),
        trace: [T(`상수항을 이항하면 $${a === 1 ? "" : a}${v} ${op} ${c - b}$ 이다.`, "Move the constant."), T(`${a} 로 나누면 $${v} ${op} ${(((c - b) / a)).toFixed(2).replace(/\.?0+$/, "")}$ 이다.`, "Divide."), T(`정수 조건에서 ${e.lower ? "최소" : "최대"} 정수는 ${e.ans} 이다.`, "Pick the integer.")],
        variant: "integer_edge",
      });
    },
  },
  {
    ...base, id: "li.point_in_solution.e_count_values", kind: "point_in_solution", difficulty: "easy",
    structure: "주어진 값들을 부등식에 대입해 참이 되는 값의 개수를 센다", extraThinking: "easy 틀(대입 판정)", concepts: ["대입", "부등호 판정"],
    generate(rng) {
      const a = rng.int(1, 4) * (rng.chance(0.25) ? -1 : 1), b = rng.nz(-8, 8), c = rng.int(-6, 12), op = rng.pick(OPS), v = rng.pick(LET);
      const vals = rng.shuffle([-4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6]).slice(0, rng.int(4, 6)).sort((p, q) => p - q);
      const cnt = vals.filter((x) => holds(a * x + b, op, c)).length; if (cnt < 1 || cnt >= vals.length) throw new GenFail("x");
      const list = vals.join(", ");
      const stimulus = facts(rng, [
        [`Consider the inequality ${M(`${lin(a, b, v)} ${op} ${c}`)}.`, `The inequality ${M(`${lin(a, b, v)} ${op} ${c}`)} is given.`, `A student tests values in ${M(`${lin(a, b, v)} ${op} ${c}`)}.`, `Look at ${M(`${lin(a, b, v)} ${op} ${c}`)}.`],
        [`The values to test are ${list}.`, `Each of the numbers ${list} is substituted for ${v}.`, `Try ${v} = ${list.replace(/, (?=[^,]*$)/, ", and ")}.`, `The candidates for ${v} are ${list}.`],
      ]);
      return finish(rng, {
        stimulus, question: spin(rng, "[[How many of the listed values make the inequality true?|For how many of the values is the inequality a true statement?|How many of the numbers are solutions of the inequality?|Of the listed values, how many satisfy it?]]"), correct: cnt,
        wrongs: [W(vals.length - cnt, "relation_distortion", "참인 값 대신 거짓인 값의 개수를 셌다."), W(vals.filter((x) => holds(a * x + b, op === "<" ? "\\le" : op === "\\le" ? "<" : op === ">" ? "\\ge" : ">", c)).length, "condition_ignored", "경계에서 등호 포함 여부를 반대로 판정했다."), W(cnt + 1, "other", "한 값을 잘못 판정했다."), W(Math.max(cnt - 1, 0), "other", "한 값을 잘못 판정했다."), W(vals.length, "step_missing", "판정하지 않고 값의 개수를 답했다.")],
        verificationJs: withParams({ a, b, c, op: jsOp(op), vals }, H_JS + "let n=0;\nfor(const x of P.vals) if(h(P.a*x+P.b,P.op,P.c)) n++;\nreturn n;"),
        trace: [T("각 값을 부등식의 좌변에 대입해 값을 구한다.", "Substitute each value."), T(`좌변 값과 ${c} 를 비교해 참·거짓을 정한다.`, "Compare to the right side."), T(`참인 값은 ${cnt}개이다.`, "Count.")],
        variant: "count_true_values",
      });
    },
  },
  {
    ...base, id: "li.table_verification.e_budget_items", kind: "table_verification", difficulty: "easy",
    structure: "예산과 단가의 문장을 부등식으로 옮겨 살 수 있는 최대 개수를 구한다", extraThinking: "easy 틀(한 단계 문장제)", concepts: ["문장→부등식", "내림"],
    generate(rng) {
      const s = rng.pick(SHOP), price = rng.int(2, 15), budget = rng.int(price * 3 + 1, price * 14) + rng.pick([0, 1, 2]) * (price > 2 ? 1 : 0), nm = rng.pick(["Maya", "Daniel", "Priya", "Lucas", "Hana", "Omar", "Elena", "Kenji"]);
      const ans = Math.floor(budget / price); if (ans < 2) throw new GenFail("x");
      const stimulus = facts(rng, [
        [`${nm} has ${budget} dollars to spend at ${s.seller}.`, `At ${s.seller}, ${nm} can spend at most ${budget} dollars.`, `${nm} brings ${budget} dollars to ${s.seller}.`, `${nm}'s budget for ${s.seller} is ${budget} dollars.`],
        [`Each ${s.thing} costs ${price} dollars.`, `The price of one ${s.thing} is ${price} dollars.`, `A single ${s.thing} sells for ${price} dollars.`, `${s.things[0].toUpperCase()}${s.things.slice(1)} are ${price} dollars each.`],
      ]);
      return finish(rng, {
        stimulus, question: spin(rng, `[[What is the greatest number of ${s.things} ${nm} can buy?|How many ${s.things} can ${nm} buy at most?|What is the maximum whole number of ${s.things} ${nm} can afford?|${nm} can afford at most how many ${s.things}?]]`), correct: ans,
        wrongs: [W(ans + 1, "condition_ignored", "남는 금액이 한 개 값에 못 미치는데 올림했다."), W(ans - 1, "other", "한 개를 덜 계산했다."), W(budget - price, "formula_misuse", "예산에서 단가를 뺐다."), W(Math.round(budget / price), "condition_ignored", "반올림했다."), ...near(ans)],
        verificationJs: withParams({ price, budget }, "let n=0;\nwhile(P.price*(n+1)<=P.budget) n++;\nreturn n;"),
        trace: [T(`개수를 n 이라 하면 $${price}n \\le ${budget}$ 이다.`, "Write the inequality."), T(`${price} 로 나누면 $n \\le ${(budget / price).toFixed(2).replace(/\.?0+$/, "")}$ 이다.`, "Divide."), T(`개수는 정수이므로 내림하여 ${ans} 이다.`, "Round down.")],
        variant: "budget_items",
      });
    },
  },
  // ---------- medium ----------
  {
    ...base, id: "li.solve_one_var.m_negative_coefficient", kind: "solve_one_var", difficulty: "medium",
    structure: "음수 계수의 일차부등식에서 부등호가 뒤집히는 것을 반영해 정수 끝값을 구한다", extraThinking: "medium 틀(2~3단계, 방향 반전)", concepts: ["일차부등식", "음수로 나눌 때 방향 반전"],
    generate(rng) {
      const a = -rng.int(2, 7), b = rng.nz(-12, 12), op = rng.pick(OPS), v = rng.pick(LET), c = a * rng.int(-6, 6) + b + rng.pick([0, 1, 2, -1]);
      const flipped: Op = op === "<" ? ">" : op === ">" ? "<" : op === "\\le" ? "\\ge" : "\\le"; const bound = (c - b) / a;
      const lower = flipped === ">" || flipped === "\\ge";
      const ans = flipped === ">" ? Math.floor(bound) + 1 : flipped === "\\ge" ? Math.ceil(bound) : flipped === "<" ? Math.ceil(bound) - 1 : Math.floor(bound);
      if (Math.abs(ans) > 30 || Math.abs(c) > 70) throw new GenFail("x");
      const ineq = M(`${lin(a, b, v)} ${op} ${c}`);
      return finish(rng, {
        stimulus: facts(rng, [["Consider the inequality below.", "The inequality below has a negative coefficient.", "Look at the inequality below.", "An inequality in one variable is written below.", "A student must solve the inequality below."]]) + `\n\n${ineq}`, question: spin(rng, `[[What is the ${lower ? "least" : "greatest"} integer ${v} for which the inequality holds?|Which is the ${lower ? "smallest" : "largest"} integer solution of the inequality?|Find the ${lower ? "least" : "greatest"} whole number ${v} that makes the inequality true.|What is the ${lower ? "minimum" : "maximum"} integer value of ${v} that satisfies the inequality?]]`), correct: ans,
        wrongs: [W(op === "<" || op === "\\le" ? Math.ceil(bound) : Math.floor(bound), "condition_ignored", "음수로 나눌 때 부등호 방향을 바꾸지 않았다(끝값을 반대쪽에서 골랐다)."), W(-ans, "sign_error", "부호를 잘못 바꿨다."), W(lower ? ans - 1 : ans + 1, "condition_ignored", "경계값 포함 여부를 잘못 판단했다."), W(Math.round(bound), "step_missing", "경계값을 반올림했다."), W(c - b, "step_missing", "계수로 나누지 않았다."), ...near(ans)],
        verificationJs: withParams({ a, b, c, op: jsOp(op) }, H_JS + `const xs=[];\nfor(let x=-500;x<=500;x++) if(h(P.a*x+P.b,P.op,P.c)) xs.push(x);\nif(!xs.length) throw new Error('해 없음');\nreturn P.a<0&&(P.op==='<'||P.op==='<=')||P.a>0&&(P.op==='>'||P.op==='>=')?Math.min(...xs):Math.max(...xs);`),
        trace: [T(`상수항을 이항하면 $${a}${v} ${op} ${c - b}$ 이다.`, "Move the constant."), T(`${a} 은 음수이므로 나누면 부등호 방향이 바뀐다: $${v} ${flipped} ${bound.toFixed(2).replace(/\.?0+$/, "")}$.`, "Dividing by a negative flips the sign."), T(`정수 중 ${lower ? "최소" : "최대"} 해는 ${ans} 이다.`, "Take the integer endpoint.")],
        variant: "negative_coefficient",
      });
    },
  },
  {
    ...base, id: "li.solve_one_var.m_fee_per_unit", kind: "solve_one_var", difficulty: "medium",
    structure: "고정 요금과 단위 요금의 총비용이 예산 이하가 되는 최대 단위 수를 구한다", extraThinking: "medium 틀(고정비+단위비 모델링)", concepts: ["문장→부등식", "내림"],
    generate(rng) {
      const sv = rng.pick(SERVICES), fee = rng.int(2, 18) * 5, rate = rng.int(4, 40), n = rng.int(2, 9), budget = fee + rate * n + rng.int(0, rate - 1);
      const ans = Math.floor((budget - fee) / rate); if (ans !== n) throw new GenFail("x");
      const stimulus = facts(rng, [
        [`${sv.who} charges ${fee} dollars for ${sv.job} plus ${rate} dollars for each ${sv.unit}.`, `The charge from ${sv.who.toLowerCase()} is ${rate} dollars per ${sv.unit}, plus a one-time amount of ${fee} dollars for ${sv.job}.`, `${sv.who} bills ${fee} dollars for ${sv.job} and then ${rate} dollars for every ${sv.unit}.`, `For ${sv.job}, ${sv.who.toLowerCase()} asks ${fee} dollars up front and ${rate} dollars for each ${sv.unit}.`],
        [`A customer can spend at most ${budget} dollars.`, `The customer's budget is ${budget} dollars.`, `A customer wants the total to stay within ${budget} dollars.`, `The total cost must not exceed ${budget} dollars.`],
      ]);
      return finish(rng, {
        stimulus, question: spin(rng, `[[What is the greatest whole number of ${sv.units} the customer can pay for?|What is the maximum number of ${sv.units} that fits within the budget?|How many ${sv.units} can the customer afford at most?|For at most how many whole ${sv.units} will the total stay within the budget?]]`), correct: ans,
        wrongs: [W(Math.floor(budget / rate), "step_missing", "처음 한 번만 내는 금액을 예산에서 빼지 않았다."), W(ans + 1, "condition_ignored", "남는 금액이 모자란데 올림했다."), W(ans - 1, "other", "한 단위를 덜 계산했다."), W(budget - fee, "step_missing", "단위 요금으로 나누지 않았다."), W(Math.ceil((budget - fee) / rate) + (Number.isInteger((budget - fee) / rate) ? 0 : 0), "other", "올림했다."), ...near(ans)],
        verificationJs: withParams({ fee, rate, budget }, "let k=0;\nwhile(P.fee+P.rate*(k+1)<=P.budget) k++;\nreturn k;"),
        trace: [T(`단위 수를 k 라 하면 총액은 $${fee} + ${rate}k$ 이다.`, "Write the total."), T(`예산 조건: $${fee} + ${rate}k \\le ${budget}$.`, "Write the inequality."), T(`$${rate}k \\le ${budget - fee}$ 이므로 $k \\le ${((budget - fee) / rate).toFixed(2).replace(/\.?0+$/, "")}$ 이다.`, "Solve."), T(`정수이므로 내림하여 ${ans} 이다.`, "Round down.")],
        variant: "fee_plus_rate",
      });
    },
  },
  {
    ...base, id: "li.solve_one_var.m_double_inequality", kind: "solve_one_var", difficulty: "medium",
    structure: "c < ax + b < d 꼴의 이중 부등식에서 조건을 만족하는 정수의 개수를 센다", extraThinking: "medium 틀(이중 부등식)", concepts: ["이중 부등식", "정수 개수"],
    generate(rng) {
      const a = rng.int(2, 6), b = rng.nz(-8, 8), lo = rng.int(-6, 4), hi = lo + rng.int(3, 9), v = rng.pick(LET);
      const c = a * lo + b + rng.int(0, a - 1) - (rng.chance(0.4) ? a : 0), d = a * hi + b + rng.int(0, a - 1);
      let cnt = 0; const xs: number[] = []; for (let x = -100; x <= 100; x++) if (c < a * x + b && a * x + b < d) { cnt++; xs.push(x); }
      if (cnt < 3 || cnt > 11) throw new GenFail("x");
      const ineq = M(`${c} < ${lin(a, b, v)} < ${d}`);
      return finish(rng, {
        stimulus: facts(rng, [["Consider the double inequality below.", `A value ${v} satisfies the double inequality below.`, "The expression in the middle lies strictly between two numbers, as written below.", "Look at the compound inequality below.", `The integer ${v} must make the statement below true.`]]) + `\n\n${ineq}`, question: spin(rng, `[[How many integers ${v} satisfy the inequality?|For how many integer values of ${v} is the statement true?|How many whole-number values of ${v} make it true?|What is the number of integer solutions?]]`), correct: cnt,
        wrongs: [W(cnt + 1, "condition_ignored", "경계 정수를 하나 더 셌다."), W(cnt - 1, "condition_ignored", "경계 정수를 하나 빠뜨렸다."), W(xs[xs.length - 1] - xs[0], "formula_misuse", "끝값의 차를 개수로 답했다."), W(Math.floor((d - c) / a), "step_missing", "구간 길이를 계수로 나눈 몫을 개수로 답했다."), ...near(cnt)],
        verificationJs: withParams({ a, b, c, d }, "let n=0;\nfor(let x=-400;x<=400;x++){ const e=P.a*x+P.b; if(P.c<e&&e<P.d) n++; }\nreturn n;"),
        trace: [T(`세 부분에서 ${b} 를 빼면 $${c - b} < ${a}${v} < ${d - b}$ 이다.`, "Subtract the constant."), T(`${a} 로 나누면 $${((c - b) / a).toFixed(2).replace(/\.?0+$/, "")} < ${v} < ${((d - b) / a).toFixed(2).replace(/\.?0+$/, "")}$ 이다.`, "Divide all three parts."), T(`두 끝값은 포함되지 않으므로 정수는 ${xs.join(", ")} 로 ${cnt}개이다.`, "Count the integers strictly between.")],
        variant: "double_inequality_count",
      });
    },
  },
  {
    ...base, id: "li.point_in_solution.m_least_y", kind: "point_in_solution", difficulty: "medium",
    structure: "점의 x 좌표를 대입해 y 의 조건을 구하고 정수 끝값을 고른다", extraThinking: "medium 틀(점 대입 + 정수 끝값)", concepts: ["점의 대입", "정수 끝값"],
    generate(rng) {
      const m = rng.nz(-4, 4), b = rng.nz(-8, 8), p = rng.nz(-5, 6), op = rng.pick<Op>([">", "<", "\\ge", "\\le"]), lower = op === ">" || op === "\\ge";
      const y0 = m * p + b; const ans = op === ">" ? y0 + 1 : op === "<" ? y0 - 1 : y0;
      const stimulus = facts(rng, [
        [`The inequality ${M(`y ${op} ${lin(m, b, "x")}`)} is given.`, `Consider all points $(x, y)$ with ${M(`y ${op} ${lin(m, b, "x")}`)}.`, `A point $(x, y)$ is a solution when ${M(`y ${op} ${lin(m, b, "x")}`)}.`, `The solutions of ${M(`y ${op} ${lin(m, b, "x")}`)} are graphed in the xy-plane.`.replace("are graphed in the xy-plane", "form a region of the xy-plane")],
        [`Only integer values of $y$ are allowed, and $x = ${p}$.`, `The x-coordinate is fixed at ${p}, and y must be an integer.`, `Take points of the form ${M(`(${p}, y)`)} with integer y.`, `Look at the points ${M(`(${p}, y)`)} where y is a whole number.`],
      ]);
      return finish(rng, {
        stimulus, question: spin(rng, `[[What is the ${lower ? "least" : "greatest"} integer $y$ for which $(${p}, y)$ is a solution?|Which is the ${lower ? "smallest" : "largest"} integer $y$ that makes the point a solution?|Find the ${lower ? "minimum" : "maximum"} integer $y$ so that the point is a solution.|What ${lower ? "smallest" : "largest"} whole number $y$ works?]]`), correct: ans,
        wrongs: [W(op === ">" ? y0 : op === "<" ? y0 : op === "\\ge" ? y0 + 1 : y0 - 1, "condition_ignored", "경계값의 포함 여부를 반대로 적용했다."), W(-y0, "sign_error", "부호를 잘못 계산했다."), W(m * p - b, "sign_error", "상수항의 부호를 반대로 더했다."), W(m + p + b, "formula_misuse", "곱하지 않고 더했다."), ...near(ans)],
        verificationJs: withParams({ m, b, p, op: jsOp(op), lower: lower ? 1 : 0 }, H_JS + "const ys=[];\nfor(let y=-300;y<=300;y++) if(h(y,P.op,P.m*P.p+P.b)) ys.push(y);\nreturn P.lower?Math.min(...ys.filter(y=>y>-250)):Math.max(...ys.filter(y=>y<250));"),
        trace: [T(`x = ${p} 를 대입하면 $y ${op} ${m}\\cdot ${p < 0 ? `(${p})` : p} ${pm(b)}$ 이다.`, "Substitute x."), T(`계산하면 $y ${op} ${y0}$ 이다.`, "Evaluate."), T(`${lower ? "최소" : "최대"} 정수 y 는 ${ans} 이다${op === ">" || op === "<" ? "(경계값은 제외)" : "(경계값 포함)"}.`, "Pick the integer.")],
        variant: "least_y_on_vertical_line",
      });
    },
  },
  {
    ...base, id: "li.table_verification.m_count_pairs", kind: "table_verification", difficulty: "medium",
    structure: "주어진 부등식에 순서쌍 5개를 대입해 참인 쌍의 개수를 센다", extraThinking: "medium 틀(대입 판정 5회)", concepts: ["대입", "부등호 판정"],
    generate(rng) {
      const m = rng.nz(-3, 4), b = rng.nz(-6, 6), op = rng.pick(OPS), xs = rng.shuffle([-3, -2, -1, 0, 1, 2, 3, 4]).slice(0, 5).sort((p, q) => p - q);
      const pts: [number, number][] = xs.map((x) => [x, m * x + b + rng.pick([-2, -1, 0, 0, 1, 2])]);
      const cnt = pts.filter(([x, y]) => holds(y, op, m * x + b)).length; if (cnt < 1 || cnt > 4) throw new GenFail("x");
      const stimulus = `${rng.pick(["The inequality below is checked for several ordered pairs.", "Consider the inequality below.", "A student wants to check ordered pairs against the inequality below.", "The ordered pairs in the table are tested in the inequality below.", "Several points are compared with the inequality below.", "Each point in a list is tested in the inequality below.", "A teacher gives the inequality below and a list of points."])}\n\n${M(`y ${op} ${lin(m, b, "x")}`)}\n\n${rng.pick(["The ordered pairs are", "The pairs are", "The table lists", "The points are", "The candidates are", "Test the following pairs:"])} ${pairList(pts)}${rng.pick([".", ". Each pair is written as (x, y).", ". The first number in each pair is x.", ". In every pair, x comes first."])}`;
      return finish(rng, {
        stimulus, question: spin(rng, "[[How many of the ordered pairs are solutions of the inequality?|For how many of the pairs is the inequality true?|How many of the listed points satisfy the inequality?|How many pairs make the inequality a true statement?|What is the number of pairs that are solutions?|Which number tells how many of the points satisfy the inequality?]]"), correct: cnt,
        wrongs: [W(pts.length - cnt, "relation_distortion", "참인 쌍 대신 거짓인 쌍의 개수를 셌다."), W(pts.filter(([x, y]) => holds(y, op === "<" ? "\\le" : op === "\\le" ? "<" : op === ">" ? "\\ge" : ">", m * x + b)).length, "condition_ignored", "경계 위의 점에서 등호 포함 여부를 반대로 판정했다."), W(cnt + 1, "other", "한 쌍을 잘못 판정했다."), W(Math.max(cnt - 1, 0), "other", "한 쌍을 잘못 판정했다."), W(pts.length, "step_missing", "판정하지 않고 쌍의 개수를 답했다.")],
        verificationJs: withParams({ m, b, op: jsOp(op), xs, ys: pts.map((p) => p[1]) }, H_JS + "let c=0;\nfor(let i=0;i<P.xs.length;i++) if(h(P.ys[i],P.op,P.m*P.xs[i]+P.b)) c++;\nreturn c;"),
        trace: [T("각 쌍의 x 를 우변에 대입해 경계 y 값을 구한다.", "Compute the boundary y for each x."), T("쌍의 y 와 경계값을 부등호로 비교한다.", "Compare."), T(`참인 쌍은 ${cnt}개이다.`, "Count.")],
        variant: "count_true_pairs",
      });
    },
  },
];
void ceilDiv; void floorDiv;
