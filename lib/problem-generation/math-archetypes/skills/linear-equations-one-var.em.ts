// linear_equations_one_var easy/medium 원형(문장 틀 = 유사문항 그룹). easy 3 + medium 5.
import { GenFail, type Archetype } from "../types";
import { facts, finish, lin, M, spin, withParams } from "../text";
import { near, NAMES, SERVICES, T, W } from "../kit-b";

const SKILL = "linear_equations_one_var";
const LET = ["x", "t", "n", "m", "w", "k"] as const;
const base = { skill: SKILL, operator: "frame" as const, mediumSteps: 0 };
const num = (v: number) => v.toFixed(2).replace(/\.?0+$/, "");

export const LE_EM_ARCHETYPES: Archetype[] = [
  // ---------- easy ----------
  {
    ...base, id: "le.solve.e_two_step", kind: "solve", difficulty: "easy",
    structure: "ax + b = c 꼴을 이항과 나눗셈 두 단계로 푼다", extraThinking: "easy 틀", concepts: ["일차방정식", "역연산"],
    generate(rng) {
      const a = rng.int(2, 9), x0 = rng.nz(-9, 12), b = rng.nz(-15, 15), c = a * x0 + b, v = rng.pick(LET); if (Math.abs(c) > 99) throw new GenFail("x");
      const eq = M(`${lin(a, b, v)} = ${c}`);
      return finish(rng, {
        stimulus: `${rng.pick(["Consider the equation below.", "An equation in one variable is given.", "Look at the equation below.", "Here is a linear equation.", "The equation below has one solution."])}\n\n${eq}`,
        question: spin(rng, `[[What is the value of ${v}?|What value of ${v} makes the equation true?|Find the solution of the equation.|Solve the equation for ${v}.|Which number ${v} satisfies the equation?|What is the solution to the equation?]]`), correct: x0,
        wrongs: [W(-x0, "sign_error", "이항할 때 부호를 바꾸지 않았다."), W(c - b, "step_missing", "계수로 나누지 않았다."), W((c + b) / a, "sign_error", "상수항을 더해 이항했다."), W(c / a - b, "step_missing", "상수항을 이항하기 전에 나눴다."), W(x0 + 1, "other", "계산 실수."), ...near(x0)],
        verificationJs: withParams({ a, b, c }, "const s=[];\nfor(let x=-300;x<=300;x++) if(P.a*x+P.b===P.c) s.push(x);\nif(s.length!==1) throw new Error('유일하지 않음');\nreturn s[0];"),
        trace: [T(`상수항을 이항하면 $${a}${v} = ${c - b}$ 이다.`, "Move the constant."), T(`${a} 로 나누면 ${v} = ${x0} 이다.`, "Divide.")],
        variant: "two_step",
      });
    },
  },
  {
    ...base, id: "le.word_problem_translate.e_number_puzzle", kind: "word_problem_translate", difficulty: "easy",
    structure: "'어떤 수의 a 배에 b 를 더하면 c' 문장을 식으로 옮겨 푼다", extraThinking: "easy 틀", concepts: ["문장→방정식", "역연산"],
    generate(rng) {
      const a = rng.int(2, 7), x0 = rng.int(2, 15), b = rng.int(1, 12), plus = rng.chance(0.5), c = a * x0 + (plus ? b : -b); if (c <= 0) throw new GenFail("x");
      const times = { 2: "twice", 3: "three times", 4: "four times", 5: "five times", 6: "six times", 7: "seven times" }[a]!;
      const T1 = times[0].toUpperCase() + times.slice(1);
      const body = plus ? rng.pick([`${b} more than ${times} a number is ${c}`, `${T1} a number, increased by ${b}, equals ${c}`, `The sum of ${times} a number and ${b} is ${c}`, `Adding ${b} to ${times} a number gives ${c}`, `A number is multiplied by ${a}, and then ${b} is added. The result is ${c}`, `If ${b} is added to ${times} a number, the total is ${c}`, `${T1} a number plus ${b} is equal to ${c}`, `When ${times} a number is raised by ${b}, the result is ${c}`, `Take a number, multiply it by ${a}, and add ${b}; you get ${c}`])
        : rng.pick([`${b} less than ${times} a number is ${c}`, `${T1} a number, decreased by ${b}, equals ${c}`, `The difference of ${times} a number and ${b} is ${c}`, `Subtracting ${b} from ${times} a number gives ${c}`, `A number is multiplied by ${a}, and then ${b} is subtracted. The result is ${c}`, `If ${b} is taken away from ${times} a number, what remains is ${c}`, `${T1} a number minus ${b} is equal to ${c}`, `When ${times} a number is lowered by ${b}, the result is ${c}`, `Take a number, multiply it by ${a}, and subtract ${b}; you get ${c}`]);
      return finish(rng, {
        stimulus: `${body}.`.replace(/^(.)/, (m0) => m0.toUpperCase()), question: spin(rng, "[[What is the number?|What is the value of the number?|Which number is described?|Find the number.|What number is being described?|Which number satisfies the statement?]]"), correct: x0,
        wrongs: [W(Math.round((c + (plus ? b : -b)) / a), "sign_error", "상수의 부호를 반대로 처리했다."), W(c - (plus ? b : -b), "step_missing", "배수로 나누지 않았다."), W(a * x0, "step_missing", "배수를 곱한 값을 답했다."), W(x0 + 1, "other", "계산 실수."), ...near(x0)],
        verificationJs: withParams({ a, b, c, plus: plus ? 1 : 0 }, "const s=[];\nfor(let x=-300;x<=300;x++) if(P.a*x+(P.plus?P.b:-P.b)===P.c) s.push(x);\nif(s.length!==1) throw new Error('유일하지 않음');\nreturn s[0];"),
        trace: [T(`수를 n 이라 하면 $${a}n ${plus ? "+" : "-"} ${b} = ${c}$ 이다.`, "Translate the sentence."), T(`상수를 이항하면 $${a}n = ${c - (plus ? b : -b)}$ 이다.`, "Move the constant."), T(`${a} 로 나누면 n = ${x0} 이다.`, "Divide.")],
        variant: "number_puzzle",
      });
    },
  },
  {
    ...base, id: "le.literal_rearrange.e_product_formula", kind: "literal_rearrange", difficulty: "easy",
    structure: "곱 관계(거리=속력×시간 등)에서 두 값이 주어졌을 때 나머지 한 값을 구한다", extraThinking: "easy 틀", concepts: ["공식 대입", "역연산"],
    generate(rng) {
      type C = { P: [string, (n: number) => string]; A: [string, (n: number) => string]; B: [string, (n: number) => string]; subj: string };
      const ctxs: C[] = [
        { subj: "A car", P: ["distance", (n) => `a distance of ${n} miles`], A: ["speed", (n) => `a speed of ${n} miles per hour`], B: ["travel time", (n) => `a travel time of ${n} hours`] },
        { subj: "A shopper", P: ["total cost", (n) => `a total cost of ${n} dollars`], A: ["price per item", (n) => `a price of ${n} dollars per item`], B: ["number of items", (n) => `${n} identical items`] },
        { subj: "A poster", P: ["area", (n) => `an area of ${n} square inches`], A: ["length", (n) => `a length of ${n} inches`], B: ["width", (n) => `a width of ${n} inches`] },
        { subj: "A worker", P: ["total pay", (n) => `a total pay of ${n} dollars`], A: ["hourly wage", (n) => `a wage of ${n} dollars per hour`], B: ["number of hours worked", (n) => `${n} hours of work`] },
        { subj: "A reader", P: ["total number of pages read", (n) => `${n} pages read in total`], A: ["reading rate", (n) => `a rate of ${n} pages per day`], B: ["number of days", (n) => `${n} days of reading`] },
        { subj: "A generator", P: ["amount of fuel used", (n) => `${n} gallons of fuel used`], A: ["fuel consumption rate", (n) => `a consumption rate of ${n} gallons per hour`], B: ["running time", (n) => `a running time of ${n} hours`] },
        { subj: "A packing crew", P: ["total number of apples", (n) => `${n} apples in all`], A: ["number of apples per box", (n) => `${n} apples in each box`], B: ["number of boxes", (n) => `${n} boxes`] },
        { subj: "A fountain", P: ["volume of water used", (n) => `${n} liters of water used`], A: ["flow rate", (n) => `a flow rate of ${n} liters per minute`], B: ["running time", (n) => `a running time of ${n} minutes`] },
        { subj: "A bakery", P: ["total number of muffins", (n) => `${n} muffins in total`], A: ["number of muffins per tray", (n) => `${n} muffins on each tray`], B: ["number of trays", (n) => `${n} trays`] },
        { subj: "A hiking group", P: ["distance walked", (n) => `${n} kilometers walked`], A: ["walking pace", (n) => `a pace of ${n} kilometers per hour`], B: ["walking time", (n) => `a walking time of ${n} hours`] },
      ];
      const c = rng.pick(ctxs), x0 = rng.int(2, 12), y0 = rng.int(2, 12), p0 = x0 * y0, ask = rng.pick(["A", "B"] as const);
      const known = ask === "A" ? [c.P, c.B] : [c.P, c.A]; const knownVal = ask === "A" ? [p0, y0] : [p0, x0]; const ans = ask === "A" ? x0 : y0, other = ask === "A" ? y0 : x0;
      const rel = rng.pick([`The ${c.P[0]} equals the ${c.A[0]} times the ${c.B[0]}.`, `The ${c.P[0]} is found by multiplying the ${c.A[0]} by the ${c.B[0]}.`, `The ${c.A[0]} multiplied by the ${c.B[0]} gives the ${c.P[0]}.`, ""]);
      const given = rng.pick([`${c.subj} has ${known[0][1](knownVal[0])} and ${known[1][1](knownVal[1])}.`, `${c.subj} is described by ${known[0][1](knownVal[0])} together with ${known[1][1](knownVal[1])}.`, `For ${c.subj.toLowerCase()}, there is ${known[1][1](knownVal[1])} and ${known[0][1](knownVal[0])}.`, `Suppose ${c.subj.toLowerCase()} has ${known[1][1](knownVal[1])}, and also ${known[0][1](knownVal[0])}.`]);
      const asked = ask === "A" ? c.A[0] : c.B[0];
      return finish(rng, {
        stimulus: `${given} ${rel}`.trim(), question: spin(rng, `[[What is the ${asked}?|Find the ${asked}.|What is the value of the ${asked}?|Determine the ${asked}.|What ${asked} is implied?]]`), correct: ans,
        wrongs: [W(p0 * other, "formula_misuse", "나누지 않고 곱했다."), W(p0 - other, "formula_misuse", "나누지 않고 뺐다."), W(other, "step_missing", "알려진 다른 값을 그대로 답했다."), W(p0 + other, "formula_misuse", "나누지 않고 더했다."), ...near(ans)],
        verificationJs: withParams({ p: p0, k: other }, "const s=[];\nfor(let v=1;v<=400;v++) if(v*P.k===P.p) s.push(v);\nif(s.length!==1) throw new Error('유일하지 않음');\nreturn s[0];"),
        trace: [T(`${c.P[0]} = ${c.A[0]} × ${c.B[0]} 이다.`, "Use the product relationship."), T(`알려진 값을 대입하면 ${p0} = ${ask === "A" ? `□ × ${y0}` : `${x0} × □`} 이다.`, "Substitute."), T(`${p0} 을(를) ${other} 로 나누면 ${ans} 이다.`, "Divide.")],
        variant: "product_relationship",
      });
    },
  },
  // ---------- medium ----------
  {
    ...base, id: "le.solve.m_both_sides", kind: "solve", difficulty: "medium",
    structure: "양변에 x 가 있는 ax + b = cx + d 를 정리해 푼다", extraThinking: "medium 틀", concepts: ["일차방정식", "양변 정리"],
    generate(rng) {
      const a = rng.int(2, 9), c = rng.int(-4, 7), x0 = rng.nz(-8, 10), b = rng.nz(-12, 12); if (a === c) throw new GenFail("x");
      const d = a * x0 + b - c * x0; if (Math.abs(d) > 50) throw new GenFail("x"); const v = rng.pick(LET);
      return finish(rng, {
        stimulus: `${rng.pick(["Consider the equation below.", "The equation below has the variable on both sides.", "Look at the equation below.", "A linear equation with a variable on each side is given.", "Solve the following equation."])}\n\n${M(`${lin(a, b, v)} = ${lin(c, d, v)}`)}`, question: spin(rng, `[[What is the value of ${v}?|What value of ${v} satisfies the equation?|Find ${v}.|Which number is the solution?|What is the solution of the equation?]]`), correct: x0,
        wrongs: [W(-x0, "sign_error", "이항할 때 부호를 바꾸지 않았다."), W((d - b) / (a + c), "sign_error", "x 항을 이항할 때 부호를 바꾸지 않았다."), W(d - b, "step_missing", "계수로 나누지 않았다."), W((b - d) / (a + c), "sign_error", "계수를 더해 나눴다."), ...near(x0)],
        verificationJs: withParams({ a, b, c, d }, "const s=[];\nfor(let x=-300;x<=300;x++) if(P.a*x+P.b===P.c*x+P.d) s.push(x);\nif(s.length!==1) throw new Error('유일하지 않음');\nreturn s[0];"),
        trace: [T(`x 항을 한쪽으로 모으면 $${a - c}${v} + ${b} = ${d}$ 이다.`.replace("+ -", "- "), "Collect the variable terms."), T(`상수항을 이항하면 $${a - c}${v} = ${d - b}$ 이다.`, "Move the constant."), T(`${a - c} 로 나누면 ${v} = ${x0} 이다.`, "Divide.")],
        variant: "both_sides",
      });
    },
  },
  {
    ...base, id: "le.solve.m_parentheses", kind: "solve", difficulty: "medium",
    structure: "괄호가 있는 a(x + b) + d = e 를 분배해 푼다", extraThinking: "medium 틀", concepts: ["분배법칙", "일차방정식"],
    generate(rng) {
      const a = rng.nz(-6, 7), b = rng.nz(-8, 8), x0 = rng.nz(-8, 10), d = rng.nz(-10, 10), e = a * (x0 + b) + d, v = rng.pick(LET); if (Math.abs(a) < 2 || Math.abs(e) > 80) throw new GenFail("x");
      return finish(rng, {
        stimulus: `${rng.pick(["Consider the equation below.", "The equation below contains parentheses.", "Look at the equation below.", "Solve the following equation by first expanding the parentheses.", "An equation is written below."])}\n\n${M(`${a}(${v} ${b >= 0 ? "+" : "-"} ${Math.abs(b)}) ${d >= 0 ? "+" : "-"} ${Math.abs(d)} = ${e}`)}`, question: spin(rng, `[[What is the value of ${v}?|What value of ${v} makes the equation true?|Find the solution.|Which number ${v} satisfies the equation?|Solve for ${v}.]]`), correct: x0,
        wrongs: [W((e - d) / a + b, "sign_error", "괄호 안 상수를 반대로 처리했다."), W((e - d) / a, "step_missing", "괄호 안 상수를 이항하지 않았다."), W(-x0, "sign_error", "부호를 잘못 바꿨다."), W((e + d) / a - b, "sign_error", "상수 d 를 더해 이항했다."), ...near(x0)],
        verificationJs: withParams({ a, b, d, e }, "const s=[];\nfor(let x=-300;x<=300;x++) if(P.a*(x+P.b)+P.d===P.e) s.push(x);\nif(s.length!==1) throw new Error('유일하지 않음');\nreturn s[0];"),
        trace: [T(`분배하면 $${a}${v} ${a * b >= 0 ? "+" : "-"} ${Math.abs(a * b)} ${d >= 0 ? "+" : "-"} ${Math.abs(d)} = ${e}$ 이다.`, "Distribute."), T(`상수항을 정리하면 $${a}${v} = ${e - d - a * b}$ 이다.`, "Combine constants."), T(`${a} 로 나누면 ${v} = ${x0} 이다.`, "Divide.")],
        variant: "parentheses",
      });
    },
  },
  {
    ...base, id: "le.solve.m_fraction", kind: "solve", difficulty: "medium",
    structure: "분수 항이 있는 x/a + b = c 또는 (x + b)/a = c 를 푼다", extraThinking: "medium 틀", concepts: ["분수 방정식", "역연산"],
    generate(rng) {
      const a = rng.int(2, 8), kind = rng.pick(["split", "wrap"] as const), b = rng.nz(-9, 9), c = rng.nz(-8, 9), v = rng.pick(LET);
      const x0 = kind === "split" ? a * (c - b) : a * c - b; if (Math.abs(x0) > 90) throw new GenFail("x");
      const eq = kind === "split" ? `\\frac{${v}}{${a}} ${b >= 0 ? "+" : "-"} ${Math.abs(b)} = ${c}` : `\\frac{${v} ${b >= 0 ? "+" : "-"} ${Math.abs(b)}}{${a}} = ${c}`;
      return finish(rng, {
        stimulus: `${rng.pick(["Consider the equation below.", "The equation below contains a fraction.", "Look at the equation below.", "Solve the equation below.", "An equation with a fraction is written below."])}\n\n${M(eq)}`, question: spin(rng, `[[What is the value of ${v}?|What value of ${v} makes the equation true?|Find ${v}.|Which number is the solution of the equation?|Solve for ${v}.]]`), correct: x0,
        wrongs: kind === "split" ? [W(c - b, "step_missing", "분모를 곱하지 않았다."), W(a * (c + b), "sign_error", "상수를 더해 이항했다."), W(-x0, "sign_error", "부호를 잘못 바꿨다."), W(a * c - b, "formula_misuse", "상수 b 를 곱하지 않고 이항했다."), ...near(x0)] : [W(c - b, "step_missing", "분모를 곱하지 않았다."), W(a * c + b, "sign_error", "상수를 더해 이항했다."), W(-x0, "sign_error", "부호를 잘못 바꿨다."), W(a * (c - b), "formula_misuse", "분모를 곱하는 순서를 잘못 적용했다."), ...near(x0)],
        verificationJs: withParams({ a, b, c, kind: kind === "split" ? 1 : 0 }, "const s=[];\nfor(let x=-400;x<=400;x++){ const l=P.kind? x/P.a+P.b : (x+P.b)/P.a; if(Math.abs(l-P.c)<1e-9) s.push(x); }\nif(s.length!==1) throw new Error('유일하지 않음');\nreturn s[0];"),
        trace: kind === "split" ? [T(`상수항을 이항하면 $\\frac{${v}}{${a}} = ${c - b}$ 이다.`, "Move the constant."), T(`양변에 ${a} 를 곱하면 ${v} = ${x0} 이다.`, "Multiply by the denominator.")] : [T(`양변에 ${a} 를 곱하면 $${v} ${b >= 0 ? "+" : "-"} ${Math.abs(b)} = ${a * c}$ 이다.`, "Multiply by the denominator."), T(`상수항을 이항하면 ${v} = ${x0} 이다.`, "Move the constant.")],
        variant: "fraction_equation",
      });
    },
  },
  {
    ...base, id: "le.word_problem_translate.m_flat_plus_rate", kind: "word_problem_translate", difficulty: "medium",
    structure: "고정 요금과 단위 요금의 총액 식을 세워 단위 수를 구한다", extraThinking: "medium 틀", concepts: ["문장→방정식", "일차방정식"],
    generate(rng) {
      const sv = rng.pick(SERVICES), fee = rng.int(2, 18) * 5, rate = rng.int(4, 40), n = rng.int(2, 12), total = fee + rate * n;
      const stimulus = facts(rng, [
        [`${sv.who} charges ${fee} dollars for ${sv.job} plus ${rate} dollars for each ${sv.unit}.`, `The charge from ${sv.who.toLowerCase()} is ${rate} dollars per ${sv.unit}, plus ${fee} dollars for ${sv.job}.`, `${sv.who} bills ${fee} dollars for ${sv.job} and ${rate} dollars for every ${sv.unit}.`, `For ${sv.job}, ${sv.who.toLowerCase()} asks ${fee} dollars up front and then ${rate} dollars per ${sv.unit}.`],
        [`A customer's total bill is ${total} dollars.`, `The final bill came to ${total} dollars.`, `The customer paid ${total} dollars in all.`, `A bill of exactly ${total} dollars was issued.`],
      ]);
      return finish(rng, {
        stimulus, question: spin(rng, `[[How many ${sv.units} did the customer pay for?|For how many ${sv.units} was the customer charged?|What number of ${sv.units} does the bill cover?|The bill includes charges for how many ${sv.units}?]]`), correct: n,
        wrongs: [W(Math.round(total / rate), "step_missing", "처음 한 번 내는 금액을 빼지 않았다."), W(total - fee, "step_missing", "단위 요금으로 나누지 않았다."), W((total + fee) / rate, "sign_error", "처음 금액을 더해서 나눴다."), W(n + 1, "other", "계산 실수."), ...near(n)],
        verificationJs: withParams({ fee, rate, total }, "const s=[];\nfor(let k=0;k<=500;k++) if(P.fee+P.rate*k===P.total) s.push(k);\nif(s.length!==1) throw new Error('유일하지 않음');\nreturn s[0];"),
        trace: [T(`단위 수를 k 라 하면 $${fee} + ${rate}k = ${total}$ 이다.`, "Write the equation."), T(`상수를 이항하면 $${rate}k = ${total - fee}$ 이다.`, "Move the fee."), T(`${rate} 로 나누면 k = ${n} 이다.`, "Divide.")],
        variant: "flat_plus_rate",
      });
    },
  },
  {
    ...base, id: "le.literal_rearrange.m_formula_value", kind: "literal_rearrange", difficulty: "medium",
    structure: "Y = S + R·Z 꼴의 두 항 공식에서 나머지 값을 대입해 한 변수의 값을 구한다", extraThinking: "medium 틀", concepts: ["공식 대입", "일차방정식"],
    generate(rng) {
      type C = { y: string; s: string; r: string; z: string; fy: (n: number) => string; fs: (n: number) => string; fr: (n: number) => string; fz: (n: number) => string; subj: string };
      const ctxs: C[] = [
        { subj: "A liquid", y: "final temperature", s: "starting temperature", r: "rise per minute", z: "heating time", fy: (n) => `${n} degrees`, fs: (n) => `${n} degrees`, fr: (n) => `${n} degrees per minute`, fz: (n) => `${n} minutes` },
        { subj: "A savings account", y: "balance", s: "opening balance", r: "weekly deposit", z: "number of weeks", fy: (n) => `${n} dollars`, fs: (n) => `${n} dollars`, fr: (n) => `${n} dollars per week`, fz: (n) => `${n} weeks` },
        { subj: "A seedling", y: "height", s: "starting height", r: "growth per week", z: "number of weeks", fy: (n) => `${n} centimeters`, fs: (n) => `${n} centimeters`, fr: (n) => `${n} centimeters per week`, fz: (n) => `${n} weeks` },
        { subj: "A taxi ride", y: "fare", s: "base charge", r: "charge per mile", z: "distance traveled", fy: (n) => `${n} dollars`, fs: (n) => `${n} dollars`, fr: (n) => `${n} dollars per mile`, fz: (n) => `${n} miles` },
        { subj: "A water tank", y: "final volume", s: "starting volume", r: "fill rate", z: "filling time", fy: (n) => `${n} liters`, fs: (n) => `${n} liters`, fr: (n) => `${n} liters per minute`, fz: (n) => `${n} minutes` },
        { subj: "A cyclist", y: "final position", s: "starting position", r: "speed", z: "riding time", fy: (n) => `${n} kilometers from home`, fs: (n) => `${n} kilometers from home`, fr: (n) => `${n} kilometers per hour`, fz: (n) => `${n} hours` },
        { subj: "A reader", y: "number of pages finished", s: "number of pages already finished", r: "pages read per day", z: "number of days", fy: (n) => `${n} pages`, fs: (n) => `${n} pages`, fr: (n) => `${n} pages per day`, fz: (n) => `${n} days` },
        { subj: "A game player", y: "final score", s: "bonus score", r: "points per level", z: "number of levels cleared", fy: (n) => `${n} points`, fs: (n) => `${n} points`, fr: (n) => `${n} points per level`, fz: (n) => `${n} levels` },
      ];
      const sets = [["y", "a", "m", "x"], ["p", "c", "r", "t"], ["q", "s", "k", "n"], ["w", "b", "d", "z"], ["f", "g", "h", "u"]];
      const [Yl, Sl, Rl, Zl] = rng.pick(sets); const c = rng.pick(ctxs);
      const S0 = rng.int(2, 40), R0 = rng.int(2, 12), Z0 = rng.int(2, 15), Y0 = S0 + R0 * Z0;
      const ask = rng.pick(["z", "s", "r"] as const);
      const frame = rng.pick([0, 1, 2]);
      const vals = { y: c.fy(Y0), s: c.fs(S0), r: c.fr(R0), z: c.fz(Z0) };
      const formula = M(`${Yl} = ${Sl} + ${Rl}${Zl}`);
      const sym = { y: Yl, s: Sl, r: Rl, z: Zl };
      const legend = `${Yl} is the ${c.y}, ${Sl} is the ${c.s}, ${Rl} is the ${c.r}, and ${Zl} is the ${c.z}`;
      const keep = (["y", "s", "r", "z"] as const).filter((k) => k !== ask);
      const stated = keep.map((k) => `the ${c[k]} is ${vals[k]}`).join(", ").replace(/, ([^,]*)$/, ", and $1");
      const statedCap = stated.replace(/^t/, "T");
      const nums = { y: Y0, s: S0, r: R0, z: Z0 };
      const asked = ask === "z" ? c.z : ask === "s" ? c.s : c.r;
      const ans = ask === "z" ? Z0 : ask === "s" ? S0 : R0;
      const stimulus = frame === 0 ? `${c.subj} follows the formula ${formula}, where ${legend}. ${statedCap}.` : frame === 1 ? `In the formula ${formula}, ${legend}. For ${c.subj.toLowerCase()}, ${stated}.` : `The ${c.y} of ${c.subj.toLowerCase()} is modeled by ${formula}. Here ${legend}. It is known that ${stated}.`;
      const wrongs = ask === "z" ? [W(Y0 - S0, "step_missing", "R 로 나누지 않았다."), W((Y0 + S0) / R0, "sign_error", "S 를 더해 이항했다."), W(Y0 / R0 - S0, "step_missing", "이항 전에 나눴다."), W(Z0 + 1, "other", "계산 실수.")] : ask === "s" ? [W(Y0 + R0 * Z0, "sign_error", "곱한 값을 더했다."), W(Y0 - R0, "formula_misuse", "Z 를 곱하지 않았다."), W(Y0 - Z0, "formula_misuse", "R 를 곱하지 않았다."), W(S0 + 1, "other", "계산 실수.")] : [W(Y0 - S0, "step_missing", "Z 로 나누지 않았다."), W((Y0 + S0) / Z0, "sign_error", "S 를 더해 이항했다."), W(Y0 / Z0 - S0, "step_missing", "이항 전에 나눴다."), W(R0 + 1, "other", "계산 실수.")];
      void sym;
      return finish(rng, {
        stimulus, question: spin(rng, `[[What is the ${asked}?|Find the ${asked}.|What is the value of the ${asked}?|Determine the ${asked}.|What ${asked} does the formula give?]]`), correct: ans, wrongs: [...wrongs, ...near(ans)],
        bindings: keep.map((k) => ({ phrase: `the ${c[k]}`, value: nums[k] })),
        verificationJs: withParams({ Y: Y0, S: ask === "s" ? 0 : S0, R: ask === "r" ? 0 : R0, Z: ask === "z" ? 0 : Z0, ask }, "const s=[];\nfor(let v=0;v<=400;v++){ const S=P.ask==='s'?v:P.S, R=P.ask==='r'?v:P.R, Z=P.ask==='z'?v:P.Z; if(S+R*Z===P.Y) s.push(v); }\nif(s.length!==1) throw new Error('유일하지 않음');\nreturn s[0];"),
        trace: [T(`공식 ${Yl} = ${Sl} + ${Rl}${Zl} 에 알려진 값을 대입한다.`, "Substitute the known values."), T(`${ask === "s" ? "더해진 항" : "상수항"}을 정리해 미지항만 남긴다.`, "Isolate the unknown term."), T(`나누어(또는 계산해) ${asked} = ${ans} 를 얻는다.`, "Solve.")],
        variant: "two_term_formula",
      });
    },
  },
];
void num; void NAMES;
