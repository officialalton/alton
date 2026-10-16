// linear_equations_one_var hard 원형 12개(solve·word_problem_translate·literal_rearrange × 연산자 4종).
import { GenFail, type Archetype } from "../types";
import { LE1_SPR_B_ARCHETYPES } from "./linear-equations-one-var.spr-b";
import { facts, finish, lin, M, pn, spin, withParams } from "../text";

const SKILL = "linear_equations_one_var";
const VARS = ["x", "t", "n", "y", "m"] as const;
const W = (n: number) => (n < 0 ? `(${n})` : String(n));

/** 1/f = 1/u + 1/v 를 만족하는 정수 (f, u, v)(v ≤ 120, v ≠ u) — 사전 열거해 거절 표집을 피한다. */
const LENS_TRIPLES: [number, number, number][] = (() => {
  const out: [number, number, number][] = [];
  for (let f = 2; f <= 15; f++) for (let u = f + 1; u <= 60; u++) if ((u * f) % (u - f) === 0) { const v = (u * f) / (u - f); if (v <= 120 && v !== u) out.push([f, u, v]); }
  return out;
})();

export const LE_ARCHETYPES: Archetype[] = [
  {
    id: "le.solve.param_condition", skill: SKILL, kind: "solve", operator: "param_condition",
    structure: "k(x+m)+n = a(x+b)+c 에서 해가 무수히 많거나(또는 없도록) 하는 매개변수를 x 계수 일치·상수항 일치 두 조건으로 결정",
    extraThinking: "'해가 무수히 많다/없다'를 x 계수 일치 + 상수항 일치(불일치)라는 두 조건으로 번역 — medium 은 해를 하나 구하는 풀이",
    concepts: ["해의 개수 조건", "분배·동류항 정리", "항등식 계수 비교"], mediumSteps: 3,
    generate(rng) {
      const a = rng.nz(-5, 6), m = rng.nz(-6, 6), b = rng.nz(-6, 6), c = rng.nz(-9, 9);
      const k = a, n = a * b + c - a * m; if (Math.abs(n) > 40 || n === 0) throw new GenFail("x");
      const v = rng.pick(VARS); const infinite = rng.chance(0.6);
      const nShown = infinite ? "n" : String(n + rng.pick([-3, -2, 2, 3, 5]));
      if (!infinite && Number(nShown) === n) throw new GenFail("x");
      const rhs = `${a === 1 ? "" : a === -1 ? "-" : a}(${v} ${b >= 0 ? "+" : "-"} ${Math.abs(b)}) ${c >= 0 ? "+" : "-"} ${Math.abs(c)}`;
      const [LK, LN] = rng.pick([["k", "n"], ["p", "q"], ["c", "d"], ["r", "s"]] as const);
      const lhs2 = `${LK}(${v} ${m >= 0 ? "+" : "-"} ${Math.abs(m)}) ${infinite ? `+ ${LN}` : `${Number(nShown) >= 0 ? "+" : "-"} ${Math.abs(Number(nShown))}`}`;
      const cnt = infinite ? `${LK} and ${LN} are constants` : `${LK} is a constant`;
      const cond = infinite ? rng.pick(["The equation has infinitely many solutions.", "Every real number is a solution of the equation.", "The equation is true for all values of " + v + ".", "There are infinitely many values of " + v + " satisfying the equation."]) : rng.pick(["The equation has no solution.", "No real number is a solution of the equation.", "There is no value of " + v + " that satisfies the equation.", "The equation is false for every value of " + v + "."]);
      const stimulus = `${rng.pick([`In the equation below, ${cnt}.`, `For the equation below, ${cnt}.`, `Consider the equation below, where ${cnt}.`, `Let ${cnt} in the equation shown.`])} ${cond}\n\n${M(`${lhs2} = ${rhs}`)}`;
      const ans = infinite ? k + n : k;
      const nOut = infinite ? n : Number(nShown);
      return finish(rng, {
        stimulus, question: infinite ? spin(rng, `[[What is the value of ${LK} + ${LN}?|Find ${LK} + ${LN}.|What is the sum of ${LK} and ${LN}?|If both constants are chosen correctly, what is ${LK} + ${LN}?]]`) : spin(rng, `[[What is the value of ${LK}?|Find ${LK}.|What must ${LK} equal?|Which value of ${LK} makes this true?]]`), correct: ans,
        wrongs: infinite
          ? [{ v: k, kind: "step_missing", reason: "x 계수 조건으로 k 만 구하고 상수항 조건(n)을 더하지 않았다." }, { v: n, kind: "step_missing", reason: "n 만 구했다." }, { v: c - a * b + a * m + a, kind: "sign_error", reason: "분배 후 상수항을 이항할 때 부호를 바꾸지 않았다." }, { v: a * b + c + k, kind: "step_missing", reason: "좌변의 k·m 을 상수항에 반영하지 않았다." }, { v: k - n, kind: "formula_misuse", reason: "합 대신 차를 계산했다." }]
          : [{ v: -a, kind: "sign_error", reason: "두 x 계수를 같게 놓을 때 부호를 잘못 옮겼다." }, { v: nOut, kind: "formula_misuse", reason: "상수 n 을 답으로 골랐다." }, { v: a + 1, kind: "step_missing", reason: "우변 x 계수를 잘못 읽었다." }, { v: a * b, kind: "formula_misuse", reason: "우변 괄호 안 상수와 계수의 곱을 답으로 골랐다." }, { v: a - 1, kind: "step_missing", reason: "우변 x 계수를 잘못 읽었다." }],
        verificationJs: infinite
          ? withParams({ m, a, b, c }, "const sols=[];\nfor(let k=-60;k<=60;k++) for(let n=-300;n<=300;n++){ let ok=true; for(const x of [-3,2,11]) if(k*(x+P.m)+n !== P.a*(x+P.b)+P.c){ok=false;break;} if(ok) sols.push(k+n); }\nif(sols.length!==1) throw new Error('유일하지 않음');\nreturn sols[0];")
          : withParams({ m, n: nOut, a, b, c }, "const sols=[];\nfor(let k=-60;k<=60;k++){ const d=x=>k*(x+P.m)+P.n-(P.a*(x+P.b)+P.c); const slope=d(1)-d(0); if(slope===0 && d(0)!==0) sols.push(k); }\nif(sols.length!==1) throw new Error('유일하지 않음');\nreturn sols[0];"),
        trace: infinite ? [
          [`좌변을 분배하면 $${LK}${v} ${m >= 0 ? "+" : "-"} ${Math.abs(m)}${LK} + ${LN}$ 이다.`, "Distribute on the left."],
          [`우변을 분배하면 $${lin(a, a * b + c, v)}$ 이다.`, "Distribute on the right."],
          [`해가 무수히 많으려면 양변이 항등식이어야 하므로 $${v}$ 의 계수가 같아야 한다: ${LK} = ${a}.`, "Infinitely many solutions require an identity, so the coefficients must match."],
          [`상수항도 같아야 한다: ${m}${LK} + ${LN} = ${a * b + c}.`, "The constants must match too."],
          [`${LK} = ${a} 를 대입하면 ${LN} = ${a * b + c} - ${W(m * a)} = ${n} 이다.`, "Substitute to find the second constant."],
          [`${LK} + ${LN} = ${a} + ${pn(n)} = ${k + n} 이다.`, "Add."],
        ] : [
          [`좌변을 분배하면 $${LK}${v} ${m >= 0 ? "+" : "-"} ${Math.abs(m)}${LK} ${nOut >= 0 ? "+" : "-"} ${Math.abs(nOut)}$ 이다.`, "Distribute on the left."],
          [`우변을 분배하면 $${lin(a, a * b + c, v)}$ 이다.`, "Distribute on the right."],
          ["해가 없으려면 x 계수는 같고 상수항은 달라야 한다(평행한 직선).", "No solution requires equal slopes but different constants."],
          [`x 계수를 같게 놓으면 ${LK} = ${a} 이다.`, "Equal x-coefficients give the constant."],
          [`${LK} = ${a} 일 때 좌변 상수항 ${m * a + nOut} 와 우변 상수항 ${a * b + c} 가 다름을 확인한다.`, "Check that the constants differ."],
        ],
        variant: infinite ? "infinitely_many" : "no_solution",
      });
    },
  },
  {
    id: "le.solve.constraint_select", skill: SKILL, kind: "solve", operator: "constraint_select",
    structure: "유리방정식 (x+a)/(x-b) = c + d/(x-b) 를 양변에 (x-b)를 곱해 일차방정식으로 바꿔 풀고, 얻은 해가 정의역 x≠b 에 맞는지(외래근) 확인",
    extraThinking: "분모에 변수가 있는 방정식의 정의역 제약과 외래근 판별 — medium 은 분모에 변수가 없는 일차방정식",
    concepts: ["유리방정식", "정의역 제약", "외래근 판별"], mediumSteps: 3,
    generate(rng) {
      const a = rng.nz(-8, 8), b = rng.nz(-6, 6), c = rng.pick([2, 3, -1, -2, 4, 0]); if (c === 1) throw new GenFail("x");
      const countMode = rng.chance(0.5); const extraneous = countMode && rng.chance(0.5);
      let x0: number; let d: number;
      if (extraneous) { x0 = b; d = a + b; } else { x0 = rng.nz(-9, 9); if (x0 === b) throw new GenFail("x"); d = x0 * (1 - c) + c * b + a; }
      if (Math.abs(d) > 30) throw new GenFail("x");
      const v = rng.pick(VARS);
      const L = `\\frac{${lin(1, a, v)}}{${lin(1, -b, v)}}`, R = `${c === 0 ? "" : `${c} + `}\\frac{${d}}{${lin(1, -b, v)}}`;
      const stimulus = spin(rng, `[[Consider the equation below.|The equation below is defined for all real ${v} except one value.|Solve the equation below, keeping the excluded value in mind.]]\n\n${M(`${L} = ${R}`)}`);
      const count = extraneous ? 0 : 1;
      return finish(rng, {
        stimulus, question: countMode ? spin(rng, `[[How many real solutions does the equation have?|What is the number of real values of ${v} that satisfy the equation?]]`) : spin(rng, `[[What is the solution to the equation?|What value of ${v} satisfies the equation?|Find the value of ${v} that makes the equation true.]]`),
        correct: countMode ? count : x0,
        wrongs: countMode ? [{ v: 1 - count, kind: "condition_ignored", reason: extraneous ? "풀어서 나온 x = b 가 분모를 0 으로 만드는 외래근임을 확인하지 않았다." : "해가 없다고 잘못 판단했다." }, { v: 2, kind: "formula_misuse", reason: "일차방정식인데 해가 두 개라고 판단했다." }, { v: 3, kind: "other", reason: "해의 개수를 잘못 셌다." }, { v: -1, kind: "other", reason: "해의 개수를 잘못 셌다." }]
          : [{ v: -x0, kind: "sign_error", reason: "이항할 때 부호를 잘못 바꿨다." }, { v: d - a - c * b, kind: "step_missing", reason: "(1 - c) 로 나누지 않았다." }, { v: b, kind: "condition_ignored", reason: "분모를 0 으로 만드는 값을 답으로 골랐다." }, { v: (d - a + c * b) / (1 - c), kind: "sign_error", reason: "c(x-b)를 전개할 때 -cb 의 부호를 놓쳤다." }, { v: x0 + 1, kind: "other", reason: "계산 실수." }],
        verificationJs: withParams({ a, b, c, d, count: countMode ? 1 : 0 }, "const sols=[];\nfor(let x=-500;x<=500;x++){ if(x===P.b) continue; if(x+P.a === P.c*(x-P.b)+P.d) sols.push(x); }\nif(P.count) return sols.length;\nif(sols.length!==1) throw new Error('유일하지 않음');\nreturn sols[0];"),
        trace: [
          [`분모 ${v} - ${b} 가 0 이 되는 ${v} = ${b} 는 정의역에서 제외한다.`.replace("- -", "+ "), "Note the excluded value from the denominator."],
          [`양변에 $${lin(1, -b, v)}$ 를 곱한다.`, "Multiply both sides by the denominator."],
          [`${v} ${a >= 0 ? "+" : "-"} ${Math.abs(a)} = ${c}(${v} ${-b >= 0 ? "+" : "-"} ${Math.abs(b)}) + ${pn(d)} 이다.`.replace("+ (", "+ ("), "Get a linear equation."],
          [`정리하면 ${1 - c}${v} = ${d - a - c * b} 이다.`, "Collect terms."],
          [`${v} = ${(d - a - c * b) / (1 - c)} 를 얻는다.`, "Solve."],
          [extraneous ? `이 값이 제외한 ${v} = ${b} 와 같으므로 외래근이다. 해는 없다.` : `이 값은 ${v} ≠ ${b} 이므로 유효한 해이다.`, "Check against the excluded value."],
        ],
        variant: countMode ? "count_solutions" : "find_solution",
      });
    },
  },
  {
    id: "le.solve.chain2", skill: SKILL, kind: "solve", operator: "chain2",
    structure: "첫 방정식의 해 s 를 구하고 '둘째 방정식의 해 = α s + β' 관계로 둘째 해를 정한 뒤 둘째 방정식에 대입해 상수 k 를 구함",
    extraThinking: "두 방정식의 해를 문장 관계로 연결하는 2단계 연쇄 — medium 은 방정식 하나의 해",
    concepts: ["일차방정식 풀이", "해 사이의 관계(문장→식)", "대입으로 미지 상수 결정"], mediumSteps: 3,
    generate(rng) {
      const a = rng.nz(-5, 6), s = rng.nz(-8, 8), b = rng.nz(-9, 9), c = a * s + b; const d = rng.nz(-5, 6);
      const rel = rng.pick([{ al: 2, be: 0, t: "twice" }, { al: 3, be: 0, t: "three times" }, { al: 1, be: 3, t: "3 more than" }, { al: 1, be: -4, t: "4 less than" }, { al: -1, be: 0, t: "the opposite of" }, { al: 2, be: 1, t: "1 more than twice" }]);
      const y = rel.al * s + rel.be; const e = rng.nz(-30, 30); const k = e - d * y;
      if (Math.abs(k) > 60 || Math.abs(c) > 60 || k === 0) throw new GenFail("x");
      const v = rng.pick(VARS); const ctx = rng.pick([["p", "the solution to the first equation"], ["r", "the first solution"]]);
      const P0 = ctx[0];
      const stimulus = facts(rng, [
        [`Let ${P0} be the solution of the equation ${M(`${lin(a, b, v)} = ${c}`)}.`, `The equation ${M(`${lin(a, b, v)} = ${c}`)} has a solution, which is called ${P0}.`, `Solving ${M(`${lin(a, b, v)} = ${c}`)} for ${v} gives a value named ${P0}.`, `Suppose ${P0} is the value of ${v} that satisfies ${M(`${lin(a, b, v)} = ${c}`)}.`],
        [`The solution of the equation ${M(`${lin(d, 0, v)} + k = ${e}`)} is ${rel.t} ${P0}, where k is a constant.`, `For a constant k, the equation ${M(`${lin(d, 0, v)} + k = ${e}`)} has a solution equal to ${rel.t} ${P0}.`, `A second equation, ${M(`${lin(d, 0, v)} + k = ${e}`)}, has the constant k and its solution is ${rel.t} ${P0}.`, `In ${M(`${lin(d, 0, v)} + k = ${e}`)}, k is a constant chosen so that the solution is ${rel.t} ${P0}.`],
      ]);
      return finish(rng, {
        stimulus, question: spin(rng, "[[What is the value of k?|Find the value of k.|What must k equal?|Which value of k satisfies these conditions?]]"), correct: k,
        wrongs: [{ v: e - d * s, kind: "step_missing", reason: "둘째 방정식의 해를 첫 해 그대로(관계를 적용하지 않고) 사용했다." }, { v: -k, kind: "sign_error", reason: "상수를 이항할 때 부호를 바꿨다." }, { v: e + d * y, kind: "sign_error", reason: "k = e - d·y 에서 d·y 의 부호를 반대로 적용했다." }, { v: y, kind: "step_missing", reason: "둘째 해 y 만 구하고 k 를 구하지 않았다." }, { v: e - y, kind: "formula_misuse", reason: "d 를 곱하지 않고 y 를 그대로 뺐다." }],
        verificationJs: withParams({ a, b, c, d, e, al: rel.al, be: rel.be }, "let s=null;\nfor(let x=-300;x<=300;x++) if(P.a*x+P.b===P.c){ s=x; break; }\nif(s===null) throw new Error('첫 해 없음');\nconst y=P.al*s+P.be; const ks=[];\nfor(let k=-400;k<=400;k++) if(P.d*y+k===P.e) ks.push(k);\nif(ks.length!==1) throw new Error('유일하지 않음');\nreturn ks[0];"),
        trace: [
          [`첫 방정식 $${lin(a, b, v)} = ${c}$ 를 풀면 ${ctx[0]} = ${s} 이다.`, "Solve the first equation."],
          [`둘째 방정식의 해는 "${rel.t} ${ctx[0]}" 이다.`, "Translate the relation."],
          [`그 해는 ${rel.al}·${pn(s)} + ${pn(rel.be)} = ${y} 이다.`, "Compute the second solution."],
          [`둘째 방정식에 ${v} = ${y} 를 대입한다: ${d}·${pn(y)} + k = ${e}.`, "Substitute into the second equation."],
          [`k = ${e} - ${pn(d * y)} = ${k} 이다.`, "Solve for k."],
        ],
        variant: "relation_" + rel.t.replace(/\s+/g, "_"),
      });
    },
  },
  {
    id: "le.solve.compose_kind", skill: SKILL, kind: "solve", operator: "compose_kind",
    structure: "직사각형의 가로·세로가 x 의 일차식이고 둘레가 주어졌을 때 둘레식으로 x 를 구한 뒤 가로×세로로 넓이를 계산",
    extraThinking: "일차방정식을 기하 공식(둘레→변→넓이)과 합성 — medium 은 방정식의 해 x 만 구함",
    concepts: ["일차방정식", "직사각형 둘레", "직사각형 넓이"], mediumSteps: 3,
    generate(rng) {
      const x0 = rng.int(2, 12), a = rng.int(1, 5), c = rng.int(1, 5), b = rng.int(-3, 8), d = rng.int(-3, 8);
      const L = a * x0 + b, Wd = c * x0 + d; if (L < 1 || Wd < 1 || L === Wd) throw new GenFail("x");
      const P = 2 * (L + Wd), area = L * Wd; if (area > 900) throw new GenFail("x");
      const v = rng.pick(VARS); const [obj, unit] = rng.pick([["garden", "meters"], ["banner", "feet"], ["poster", "inches"], ["courtyard", "yards"], ["field", "meters"], ["tabletop", "centimeters"]] as const);
      const stimulus = spin(rng, `[[A rectangular|The rectangular]] ${obj} has a length of ${M(lin(a, b, v))} ${unit} and a width of ${M(lin(c, d, v))} ${unit}. [[Its perimeter is|The distance around it is|Its perimeter measures]] ${P} ${unit}.`);
      return finish(rng, {
        stimulus, question: spin(rng, `[[What is the area of the ${obj}, in square ${unit}?|Find the area of the ${obj} in square ${unit}.|How many square ${unit} does the ${obj} cover?]]`), correct: area,
        wrongs: [{ v: L + Wd, kind: "formula_misuse", reason: "둘레의 절반(길이+너비)을 넓이로 답했다." }, { v: x0, kind: "step_missing", reason: "x 만 구하고 넓이를 계산하지 않았다." }, { v: L * P / 2 , kind: "formula_misuse", reason: "둘레와 길이를 곱했다." }, { v: (a + c) * x0 * (b + d), kind: "formula_misuse", reason: "넓이를 (계수합 x)(상수합) 로 잘못 계산했다." }, { v: (P / 2 - b - d) / (a + c) * 2, kind: "formula_misuse", reason: "x 의 2배를 답했다." }],
        verificationJs: withParams({ a, b, c, d, P }, "const out=[];\nfor(let x=1;x<=500;x++){ const L=P.a*x+P.b, W=P.c*x+P.d; if(L>0&&W>0&&2*(L+W)===P.P) out.push(L*W); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`둘레 = 2(가로 + 세로) 이므로 $2(${lin(a, b, v)} + ${lin(c, d, v)}) = ${P}$ 이다.`, "Write the perimeter equation."],
          [`괄호 안을 정리하면 $2(${lin(a + c, b + d, v)}) = ${P}$ 이다.`, "Combine like terms."],
          [`양변을 2 로 나누면 ${lin(a + c, b + d, v)} = ${P / 2} 이다.`, "Divide by 2."],
          [`${v} = ${x0} 를 얻는다.`, "Solve."],
          [`가로 = ${L}, 세로 = ${Wd} 이다.`, "Find the dimensions."],
          [`넓이 = ${L} × ${Wd} = ${area} 이다.`, "Multiply."],
        ],
        variant: "perimeter_to_area",
      });
    },
  },
  {
    id: "le.word_problem_translate.chain2", skill: SKILL, kind: "word_problem_translate", operator: "chain2",
    structure: "연속한(짝수·홀수) 정수 k 개의 합과 가장 큰 수 사이의 관계를 식으로 번역해 가장 작은 수를 구하고, 그 결과로 가장 큰 수를 계산",
    extraThinking: "문장 관계(합 = α·최댓값 + β)를 변수 하나로 번역하는 두 겹의 식 세우기와 '묻는 수 ≠ 미지수' 재계산 — medium 은 한 번의 관계식",
    concepts: ["연속 정수 표현", "문장→방정식", "묻는 대상 재계산"], mediumSteps: 2,
    generate(rng) {
      const k = rng.int(3, 5), step = rng.pick([1, 2]), x0 = rng.int(3, 40); const al = rng.int(2, 4); if (al === k) throw new GenFail("x");
      const S = k * x0 + step * (k * (k - 1)) / 2, largest = x0 + (k - 1) * step; const be = S - al * largest;
      if (Math.abs(be) > 70 || be === 0) throw new GenFail("x");
      const kind = step === 1 ? "integers" : x0 % 2 === 0 ? "even integers" : "odd integers"; const noun = ["three", "four", "five"][k - 3];
      const rel = be > 0 ? `${be} more than ${al === 2 ? "twice" : al === 3 ? "three times" : "four times"}` : `${-be} less than ${al === 2 ? "twice" : al === 3 ? "three times" : "four times"}`;
      const stimulus = spin(rng, `[[The sum of|The total of]] ${noun} consecutive ${kind} [[is|equals]] ${rel} the largest of the ${noun}.`);
      return finish(rng, {
        stimulus, question: spin(rng, `[[What is the largest of the ${noun} ${kind}?|Find the largest of the ${noun} ${kind}.|Which value is the greatest of these ${noun} ${kind}?]]`), correct: largest,
        wrongs: [{ v: x0, kind: "step_missing", reason: "가장 작은 수를 구하고 가장 큰 수로 바꾸지 않았다." }, { v: x0 + step, kind: "other", reason: "가운데 수를 답했다." }, { v: S, kind: "formula_misuse", reason: "합을 답으로 골랐다." }, { v: largest + step, kind: "other", reason: "다음 수를 답했다." }, { v: largest - 1 + (step === 1 ? 0 : 1), kind: "other", reason: "묶음에서 하나 적은 수를 답했다." }],
        verificationJs: withParams({ k, step, al, be, par: step === 2 ? x0 % 2 : -1 }, "const out=[];\nfor(let x=-200;x<=400;x++){ if(P.par>=0 && ((x%2)+2)%2!==P.par) continue; let sum=0; for(let i=0;i<P.k;i++) sum+=x+i*P.step; const big=x+(P.k-1)*P.step; if(sum===P.al*big+P.be) out.push(big); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`가장 작은 수를 x 라 하면 연속한 수는 x, x + ${step}, ..., x + ${(k - 1) * step} 이다.`, "Let x be the smallest."],
          [`합 = ${k}x + ${step * (k * (k - 1)) / 2} 이다.`, "Sum of the terms."],
          [`가장 큰 수는 x + ${(k - 1) * step} 이다.`, "Largest in terms of x."],
          [`문장을 식으로 쓰면 ${k}x + ${step * (k * (k - 1)) / 2} = ${al}(x + ${(k - 1) * step}) ${be >= 0 ? "+" : "-"} ${Math.abs(be)} 이다.`, "Translate the relation."],
          [`풀면 x = ${x0} 이다.`, "Solve for x."],
          [`가장 큰 수는 ${x0} + ${(k - 1) * step} = ${largest} 이다.`, "Compute the requested value."],
        ],
        variant: step === 1 ? "consecutive_integers" : "consecutive_even_odd",
      });
    },
  },
  {
    id: "le.word_problem_translate.unit_ratio", skill: SKILL, kind: "word_problem_translate", operator: "unit_ratio",
    structure: "두 사람이 함께 일한 부분(h/p + h/q)을 뺀 나머지를 한 사람이 혼자 끝내는 시간을 작업률(1/p, 1/q)로 세운 방정식으로 구해 총 시간을 계산",
    extraThinking: "작업량=1 을 기준으로 한 작업률의 역수 모델링과 '함께 → 혼자' 두 구간 합성 — medium 은 한 번의 선형 관계식",
    concepts: ["작업률(역수)", "분수 방정식", "구간 합성"], mediumSteps: 2,
    generate(rng) {
      const p = rng.pick([6, 8, 10, 12, 15, 20, 24, 30]), q = rng.pick([6, 8, 10, 12, 15, 20, 24, 30]); if (p === q) throw new GenFail("x");
      const h = rng.int(1, 8); if ((h * q) % p !== 0) throw new GenFail("x");
      const r = (p * q - h * (p + q)) / p; if (!Number.isInteger(r) || r <= 0 || r > 60) throw new GenFail("x");
      const [A, B, job] = rng.pick([["Ana", "Ben", "paint a fence"], ["Rosa", "Dev", "stock a warehouse"], ["Mia", "Theo", "plant a garden"], ["Lena", "Omar", "assemble a batch of furniture"], ["Kai", "Nora", "tile a patio"]] as const);
      const stimulus = facts(rng, [
        [`${A} can ${job} in ${p} hours when working alone.`, `Working solo, ${A} needs ${p} hours to ${job}.`, `Left to do the job alone, ${A} would ${job} in ${p} hours.`, `It takes ${A} ${p} hours to ${job} alone.`],
        [`${B} can do the same job alone in ${q} hours.`, `${B}, working solo, needs ${q} hours for the same job.`, `The same job would take ${B} ${q} hours alone.`, `Alone, ${B} finishes that job in ${q} hours.`],
        [`They work together for ${h} hour${h > 1 ? "s" : ""}, and then ${A} leaves and ${B} finishes the rest of the job alone.`, `The two start together and work side by side for ${h} hour${h > 1 ? "s" : ""}; after that ${A} stops and ${B} completes the remaining work alone.`, `After ${h} hour${h > 1 ? "s" : ""} of working together, ${A} leaves and ${B} alone finishes what is left.`],
      ]);
      return finish(rng, {
        stimulus, question: spin(rng, "[[How many hours does the whole job take, from start to finish?|What is the total number of hours from the time they begin until the job is complete?|From start to finish, how many hours are spent on the job?|How long, in hours, does it take to get the whole job done?]]"), correct: h + r,
        wrongs: [{ v: r, kind: "step_missing", reason: "혼자 일한 시간만 구하고 함께 일한 시간을 더하지 않았다." }, { v: Math.round(((p * q) / (p + q)) * 100) / 100, kind: "partial", reason: "둘이 함께 끝내는 시간을 답했다." }, { v: h + (q - h), kind: "formula_misuse", reason: "B 혼자 전체를 하는 시간에서 함께 일한 시간만 뺐다." }, { v: h + r + 1, kind: "other", reason: "계산 실수." }, { v: h + Math.round((q * (1 - h / p))), kind: "step_missing", reason: "함께 일한 구간에서 B 의 기여를 빼지 않았다." }],
        verificationJs: withParams({ p, q, h }, "const out=[];\nfor(let r=0;r<=400;r++){ if(P.h*P.q + P.h*P.p + r*P.p === P.p*P.q) out.push(P.h + r); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`${A}의 작업률은 1/${p}, ${B}의 작업률은 1/${q} (전체 일 = 1) 이다.`, "Set up the work rates."],
          [`함께 ${h}시간 일한 양은 ${h}(1/${p} + 1/${q}) = ${h * (p + q)}/${p * q} 이다.`, "Work done together."],
          [`나머지 양은 1 - ${h * (p + q)}/${p * q} = ${p * q - h * (p + q)}/${p * q} 이다.`, "Remaining work."],
          [`${B}가 혼자 하는 시간 r 은 r/${q} = ${p * q - h * (p + q)}/${p * q} 이므로 r = ${r} 이다.`, "Time for the remaining work alone."],
          [`전체 시간은 ${h} + ${r} = ${h + r} 시간이다.`, "Add both phases."],
        ],
        variant: "work_then_alone",
      });
    },
  },
  {
    id: "le.word_problem_translate.constraint_select", skill: SKILL, kind: "word_problem_translate", operator: "constraint_select",
    structure: "나이 문제: 현재 배수 관계와 y년 뒤 합(또는 y년 전 배수 관계)을 식으로 세워 풀고 제약(나이 양수)에 맞는 해 선택",
    extraThinking: "시점이 다른 두 조건(현재·미래/과거)을 각각 식으로 번역하고 같은 변수로 연결 — medium 은 한 시점 관계",
    concepts: ["시점별 나이 표현", "문장→방정식", "제약 확인"], mediumSteps: 2,
    generate(rng) {
      const B = rng.int(4, 18), a = rng.int(2, 4); const past = rng.chance(0.5);
      const [P1, P2] = rng.pick([["Maya", "her brother"], ["Dev", "his cousin"], ["Lena", "her son"], ["Omar", "his niece"]] as const);
      const relWord = a === 2 ? "twice" : a === 3 ? "three times" : "four times";
      if (!past) {
        const y = rng.int(2, 10), S = (a + 1) * B + 2 * y; if (S > 120) throw new GenFail("x");
        const stimulus = facts(rng, [[`${P1} is ${relWord} as old as ${P2}.`, `Right now ${P1} is ${relWord} the age of ${P2}.`, `${P1}'s age is ${relWord} ${P2}'s age.`, `At present, ${P2}'s age times ${a} is ${P1}'s age.`], [`In ${y} years, the sum of their ages will be ${S}.`, `${y} years from now their ages will add up to ${S}.`, `The total of their ages ${y} years from today will be ${S}.`]]);
        return finish(rng, {
          stimulus, question: spin(rng, `[[How old is ${P2} now?|What is ${P2}'s age now?|Find ${P2}'s current age.]]`), correct: B,
          wrongs: [{ v: B + y, kind: "other", reason: `${y}년 뒤 나이를 답했다.` }, { v: a * B, kind: "other", reason: `${P1}의 현재 나이를 답했다.` }, { v: (S - y) / (a + 1), kind: "step_missing", reason: `${y}년 뒤 두 사람 모두 나이가 늘어난 것을 한 번만 반영했다.` }, { v: S / (a + 1), kind: "step_missing", reason: "미래 합을 현재 합으로 착각했다." }, { v: (S + 2 * y) / (a + 1), kind: "sign_error", reason: "y년 뒤의 합에서 더해야 할 2y 를 더했다(빼야 함)." }],
          verificationJs: withParams({ a, y, S }, "const out=[];\nfor(let b=1;b<=200;b++){ if((P.a*b+P.y)+(b+P.y)===P.S) out.push(b); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
          trace: [[`${P2}의 현재 나이를 x, ${P1}의 나이를 ${a}x 라 한다.`, "Define the ages."], [`${y}년 뒤 나이는 ${a}x + ${y} 와 x + ${y} 이다.`, "Future ages."], [`합 = ${a + 1}x + ${2 * y} = ${S} 이다.`, "Set up the equation."], [`${a + 1}x = ${S - 2 * y} 이므로 x = ${B} 이다.`, "Solve."], [`${P2}의 현재 나이는 ${B} 이다.`, "State the answer."]],
          variant: "future_sum",
        });
      }
      const tt = rng.int(a + 1, 6); const num = B * (tt - a); if (num % (tt - 1) !== 0) throw new GenFail("x"); const y = num / (tt - 1);
      if (y < 1 || y >= B) throw new GenFail("x");
      const tWord = tt === 3 ? "three times" : tt === 4 ? "four times" : tt === 5 ? "five times" : "six times";
      const stimulus = facts(rng, [[`${P1} is ${relWord} as old as ${P2}.`, `Right now ${P1} is ${relWord} the age of ${P2}.`, `${P1}'s age is ${relWord} ${P2}'s age.`, `At present, ${P2}'s age times ${a} is ${P1}'s age.`], [`${y} year${y > 1 ? "s" : ""} ago, ${P1} was ${tWord} as old as ${P2} was then.`, `Back then, ${y} year${y > 1 ? "s" : ""} ago, ${P1} was ${tWord} the age ${P2} was.`, `${y} year${y > 1 ? "s" : ""} earlier, ${P1}'s age was ${tWord} ${P2}'s age at that time.`]]);
      return finish(rng, {
        stimulus, question: spin(rng, `[[How old is ${P2} now?|What is ${P2}'s age now?|Find ${P2}'s current age.]]`), correct: B,
        wrongs: [{ v: B - y, kind: "other", reason: `${y}년 전 나이를 답했다.` }, { v: a * B, kind: "other", reason: `${P1}의 현재 나이를 답했다.` }, { v: y, kind: "other", reason: "나이가 아니라 경과 연수를 답했다." }, { v: B + y, kind: "sign_error", reason: "과거 시점을 미래로 계산했다." }, { v: (tt * y - y) / (tt - a), kind: "formula_misuse", reason: "과거 관계식을 잘못 정리했다." }],
        verificationJs: withParams({ a, tt, y }, "const out=[];\nfor(let b=1;b<=200;b++){ if(b-P.y<=0) continue; if(P.a*b-P.y === P.tt*(b-P.y)) out.push(b); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [[`${P2}의 현재 나이를 x, ${P1}의 나이를 ${a}x 라 한다.`, "Define the ages."], [`${y}년 전 나이는 ${a}x - ${y} 와 x - ${y} 이다.`, "Past ages."], [`그때 관계: ${a}x - ${y} = ${tt}(x - ${y}) 이다.`, "Set up the equation."], [`전개하면 ${a}x - ${y} = ${tt}x - ${tt * y} 이다.`, "Expand."], [`${tt - a}x = ${(tt - 1) * y} 이므로 x = ${B} 이다.`, "Solve."], [`${y}년 전 ${P2}의 나이 ${B - y} > 0 이므로 조건에 맞는다.`, "Check the constraint."]],
        variant: "past_multiple",
      });
    },
  },
  {
    id: "le.word_problem_translate.repr_shift", skill: SKILL, kind: "word_problem_translate", operator: "repr_shift",
    structure: "세 종류 물건의 개수 관계(C = B + q, A = m × B)와 총 가치를 식으로 번역해 B 의 개수를 구하고 묻는 종류의 개수를 계산",
    extraThinking: "여러 미지수를 하나의 변수로 줄이는 번역(개수 관계)과 가치 가중합 식 — medium 은 한 종류 관계",
    concepts: ["미지수 축소(변수 하나로 표현)", "가치 가중합", "문장→방정식"], mediumSteps: 2,
    generate(rng) {
      const ctx = rng.pick([
        { c: "A jar", verb: "contains", t: ["nickels", "dimes", "quarters"], v: [5, 10, 25], unit: "cents", tail: "(A nickel is worth 5 cents, a dime 10 cents, and a quarter 25 cents.)" },
        { c: "A piggy bank", verb: "holds", t: ["nickels", "dimes", "quarters"], v: [5, 10, 25], unit: "cents", tail: "(Nickels, dimes, and quarters are worth 5, 10, and 25 cents each.)" },
        { c: "An arcade prize box", verb: "contains", t: ["green tokens", "blue tokens", "red tokens"], v: [2, 5, 10], unit: "points", tail: "(Each green token is worth 2 points, each blue token 5 points, and each red token 10 points.)" },
        { c: "A stamp collector's folder", verb: "holds", t: ["3-cent stamps", "5-cent stamps", "12-cent stamps"], v: [3, 5, 12], unit: "cents", tail: "(The stamps are worth 3, 5, and 12 cents respectively.)" },
        { c: "A ticket drawer", verb: "contains", t: ["student tickets", "adult tickets", "senior tickets"], v: [4, 7, 9], unit: "dollars", tail: "(Student tickets cost 4 dollars, adult tickets 7 dollars, and senior tickets 9 dollars.)" },
        { c: "A bag of game chips", verb: "holds", t: ["white chips", "black chips", "gold chips"], v: [1, 3, 8], unit: "points", tail: "(A white chip is worth 1 point, a black chip 3 points, and a gold chip 8 points.)" },
      ]);
      const d = rng.int(2, 14), q = rng.int(1, 7), m = rng.pick([2, 3]); const [v1, v2, v3] = ctx.v; const V = v1 * m * d + v2 * d + v3 * (d + q);
      if (V > 990) throw new GenFail("x");
      const [n1, n2, n3] = ctx.t;
      const cl = ctx.c.charAt(0).toLowerCase() + ctx.c.slice(1); const mW = m === 2 ? "twice" : "three times";
      const stimulus = facts(rng, [
        [`${ctx.c} ${ctx.verb} only ${n1}, ${n2}, and ${n3}.`, `The only items in ${cl} are ${n1}, ${n2}, and ${n3}.`, `Three kinds of items, ${n1}, ${n2}, and ${n3}, are kept in ${cl}.`, `${ctx.c} is stocked with ${n1}, ${n2}, and ${n3} and nothing else.`],
        [`There are ${q} more ${n3} than ${n2}.`, `The ${n3} outnumber the ${n2} by ${q}.`, `The number of ${n3} exceeds the number of ${n2} by ${q}.`, `Counting the ${n3} gives ${q} more than counting the ${n2}.`],
        [`The number of ${n1} is ${mW} the number of ${n2}.`, `There are ${mW} as many ${n1} as ${n2}.`, `The ${n1} are ${mW} as numerous as the ${n2}.`, `Compared with the ${n2}, there are ${mW} as many ${n1}.`],
        [`The total value is ${V} ${ctx.unit}.`, `Altogether they are worth ${V} ${ctx.unit}.`, `Together the items add up to ${V} ${ctx.unit} in value.`, `Their combined value comes to ${V} ${ctx.unit}.`],
        [ctx.tail],
      ], [1, 2]);
      return finish(rng, {
        stimulus, question: spin(rng, `[[How many ${n3} are there?|What is the number of ${n3}?|Find the number of ${n3}.]]`), correct: d + q,
        wrongs: [{ v: d, kind: "other", reason: `${n2}의 개수를 답했다.` }, { v: m * d, kind: "other", reason: `${n1}의 개수를 답했다.` }, { v: d + q + 1, kind: "other", reason: "계산 실수." }, { v: d + m * d + d + q, kind: "formula_misuse", reason: "전체 개수를 답했다." }, { v: d + q - 1, kind: "other", reason: "계산 실수." }, { v: Math.round((V - v3 * q) / (v1 * m + v2 + v3 + 1)) + q, kind: "step_missing", reason: "가치식의 계수를 잘못 합했다." }],
        verificationJs: withParams({ q, m, V, v1, v2, v3 }, "const out=[];\nfor(let d=0;d<=300;d++){ const c3=d+P.q, c1=P.m*d; if(P.v1*c1+P.v2*d+P.v3*c3===P.V) out.push(c3); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`${n2}의 개수를 d 라 하면 ${n3}는 d + ${q}, ${n1}는 ${m}d 이다.`, `Let d be the number of ${n2}.`],
          [`가치를 더하면 ${v1}(${m}d) + ${v2}d + ${v3}(d + ${q}) = ${V} 이다.`, "Write the value equation."],
          [`전개해 동류항을 모으면 ${v1 * m + v2 + v3}d + ${v3 * q} = ${V} 이다.`, "Combine like terms."],
          [`${v1 * m + v2 + v3}d = ${V - v3 * q} 이므로 d = ${d} 이다.`, "Solve for d."],
          [`${n3}는 d + ${q} = ${d + q} 개이다.`, "Compute the quantity asked."],
        ],
        variant: "three_item_types",
      });
    },
  },
  {
    id: "le.literal_rearrange.compose_kind", skill: SKILL, kind: "literal_rearrange", operator: "compose_kind",
    structure: "A = P + P·r·t 처럼 같은 변수가 두 번 나오는 공식을 P 에 대해 묶어(인수분해) 정리하고, 주어진 수로 계산",
    extraThinking: "목표 변수가 두 항에 나오므로 공통인수로 묶어 재배열(literal equation 의 핵심 함정)한 뒤 수치 대입 — medium 은 한 항의 이항·나눗셈",
    concepts: ["리터럴 방정식 재배열", "공통인수로 묶기", "퍼센트→소수"], mediumSteps: 3,
    generate(rng) {
      const P = rng.int(2, 16) * 50, r = rng.pick([2, 4, 5, 6, 8, 10]), t = rng.int(2, 10); const A = (P * (100 + r * t)) / 100;
      if (!Number.isInteger(A) || A > 990) throw new GenFail("x");
      const [nm, acct, unit, per] = rng.pick([["principal", "savings account", "years", "annual"], ["starting balance", "certificate of deposit", "years", "annual"], ["initial deposit", "bond", "years", "annual"], ["original amount", "loan", "years", "annual"], ["opening balance", "credit union account", "years", "yearly"], ["deposit", "retirement fund", "years", "annual"]] as const);
      const stimulus = facts(rng, [
        [`The amount A, in dollars, in a ${acct} that earns simple interest is given by ${M("A = P + Prt")}.`, `For a ${acct} earning simple interest, the total amount A in dollars is ${M("A = P + Prt")}.`, `Simple interest on a ${acct} gives the amount A, in dollars, as ${M("A = P + Prt")}.`, `A ${acct} grows by simple interest according to ${M("A = P + Prt")}, where A is in dollars.`],
        [`Here P is the ${nm} in dollars, r is the ${per} interest rate as a decimal, and t is the time in ${unit}.`, `The ${nm} is P dollars, the ${per} rate is r (written as a decimal), and the time is t ${unit}.`, `In the formula, P stands for the ${nm}, r for the ${per} rate in decimal form, and t for the number of ${unit}.`],
        [`After ${t} ${unit} at ${per === "annual" ? "an annual" : "a yearly"} rate of ${r}%, the amount is ${A} dollars.`, `Over ${t} ${unit}, at a rate of ${r}% per year, the balance reaches ${A} dollars.`, `The balance is ${A} dollars once ${t} ${unit} have passed at ${r}% interest per year.`, `With ${r}% yearly interest, the account holds ${A} dollars after ${t} ${unit}.`],
      ]);
      return finish(rng, {
        stimulus, question: spin(rng, `[[What was the ${nm}, in dollars?|Find the ${nm}, in dollars.|How many dollars was the ${nm}?]]`), correct: P,
        wrongs: [{ v: A - (A * r * t) / 100, kind: "formula_misuse", reason: "이자를 최종 금액 A 에 대해 계산해 뺐다(이자는 P 에 대해 계산)." }, { v: Math.round(A / (r * t)), kind: "formula_misuse", reason: "P(1 + rt) 의 1 을 무시하고 rt 로만 나눴다." }, { v: Math.round(A / (1 + r / 100)), kind: "step_missing", reason: "기간 t 를 곱하지 않았다." }, { v: Math.round(A - r * t), kind: "unit_error", reason: "퍼센트를 소수로 바꾸지 않고 그대로 뺐다." }, { v: Math.round(A / (1 + r * t)), kind: "unit_error", reason: "퍼센트를 소수로 바꾸지 않았다." }],
        verificationJs: withParams({ A, r, t }, "const out=[];\nfor(let p=1;p<=5000;p++){ if(p*100 + p*P.r*P.t === P.A*100) out.push(p); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          ["P 가 두 항에 나오므로 P 로 묶는다: A = P(1 + rt).", "Factor P out of both terms."],
          ["P 에 대해 풀면 P = A / (1 + rt) 이다.", "Solve for P."],
          [`r = ${r}% = ${r / 100} 이므로 rt = ${r / 100} × ${t} = ${(r * t) / 100} 이다.`, "Convert the percent to a decimal."],
          [`1 + rt = ${1 + (r * t) / 100} 이다.`, "Compute the factor."],
          [`P = ${A} ÷ ${1 + (r * t) / 100} = ${P} 이다.`, "Divide."],
        ],
        variant: "factor_then_substitute",
      });
    },
  },
  {
    id: "le.literal_rearrange.inverse", skill: SKILL, kind: "literal_rearrange", operator: "inverse",
    structure: "역수 공식 1/f = 1/u + 1/v 에서 f, u 가 주어졌을 때 v 를 역산(1/v = 1/f − 1/u → 통분 → 역수)",
    extraThinking: "분수식에서 변수가 분모에 있는 공식을 역수 형태로 재배열(통분 후 다시 뒤집기) — medium 은 분모에 변수가 없는 재배열",
    concepts: ["역수 공식", "분수 통분", "리터럴 방정식 재배열"], mediumSteps: 3,
    generate(rng) {
      const [f, u, vv] = rng.pick(LENS_TRIPLES);
      const res = rng.pick(["lens", "resistor", "pipe", "work"] as const);
      const eq1 = M("\\frac{1}{f} = \\frac{1}{u} + \\frac{1}{v}"), eqR = M("\\frac{1}{R} = \\frac{1}{R_1} + \\frac{1}{R_2}"), eqT = M("\\frac{1}{T} = \\frac{1}{a} + \\frac{1}{b}");
      const stimulus = res === "resistor"
        ? facts(rng, [[`When two resistors are connected in parallel, the total resistance R satisfies ${eqR}.`, `For two resistors wired in parallel, the total resistance R is given by ${eqR}.`, `In a parallel circuit with two resistors, R, R1, and R2 are related by ${eqR}.`, `Two resistors share the same two nodes, so the total resistance R obeys ${eqR}.`], [`A circuit has a total resistance of ${f} ohms.`, `The whole circuit measures ${f} ohms.`, `The combined resistance of the circuit is ${f} ohms.`, `An ohmmeter across the pair reads ${f} ohms.`], [`One of the two resistors is ${u} ohms.`, `The first resistor has a resistance of ${u} ohms.`, `A single resistor in the circuit is rated ${u} ohms.`, `One resistor is labeled ${u} ohms.`]], [1, 2])
        : res === "pipe"
        ? facts(rng, [[`Two pipes fill the same tank.`, `A tank is filled by two pipes running at once.`, `Water enters one tank through two different pipes.`, `A storage tank has two inlet pipes.`], [`The first pipe alone fills the tank in ${u} minutes.`, `Used by itself, the first pipe needs ${u} minutes to fill the tank.`, `It takes ${u} minutes for the first pipe, working alone, to fill the tank.`, `The first pipe fills the empty tank by itself in ${u} minutes.`], [`Both pipes together fill it in ${f} minutes.`, `Running together, the pipes need only ${f} minutes.`, `With both pipes open, the tank is full after ${f} minutes.`, `Opening both pipes fills the tank in ${f} minutes.`], [`The times satisfy ${eqT}, where T is the time together and a and b are the times alone.`, `Here ${eqT} relates T (both pipes) to a and b (each pipe alone).`]], [1, 2])
        : res === "work"
        ? facts(rng, [[`Two painters share a job.`, `A crew of two works on one painting job.`, `One job is handled by a pair of painters.`, `Two painters are hired for a single job.`], [`Working together they need ${f} hours.`, `As a team, the two finish in ${f} hours.`, `The pair completes the job in ${f} hours when they work side by side.`, `Side by side, the two painters finish in ${f} hours.`], [`The first painter alone needs ${u} hours.`, `Alone, the first painter would take ${u} hours.`, `On her own, the first painter needs ${u} hours for the same job.`, `The first painter takes ${u} hours when working solo.`], [`The times satisfy ${eqT}, where T is the time together and a and b are the times alone.`, `Here ${eqT} relates the team time T to the individual times a and b.`]], [1, 2])
        : facts(rng, [[`For a thin lens, ${eq1} holds, where f is the focal length, u is the object distance, and v is the image distance, all in centimeters.`, `A thin lens satisfies ${eq1}, with f the focal length, u the object distance, and v the image distance (all in centimeters).`, `The focal length f, object distance u, and image distance v of a thin lens are related by ${eq1}; all are measured in centimeters.`, `Lens makers use ${eq1}, where f, u, and v (focal length, object distance, image distance) are in centimeters.`], [`A lens has a focal length of ${f} centimeters.`, `The lens in an experiment has a focal length of ${f} centimeters.`, `Its focal length is ${f} centimeters.`, `The lens is ground to a focal length of ${f} centimeters.`], [`The object is ${u} centimeters from the lens.`, `The object distance is ${u} centimeters.`, `An object is placed ${u} centimeters away.`, `The object sits ${u} centimeters in front of the lens.`]], [1, 2]);
      return finish(rng, {
        stimulus, question: res === "resistor" ? spin(rng, "[[What is the resistance, in ohms, of the other resistor?|Find the other resistance in ohms.]]") : res === "pipe" ? spin(rng, "[[How many minutes does the second pipe need to fill the tank alone?|Find b, in minutes.]]") : res === "work" ? spin(rng, "[[How many hours does the second painter need to do the job alone?|Find b, in hours.]]") : spin(rng, "[[What is the image distance, in centimeters?|Find v, in centimeters.]]"), correct: vv,
        wrongs: [{ v: u - f, kind: "formula_misuse", reason: "1/v = 1/f − 1/u 를 v = f − u 로 계산했다(역수를 취하지 않음)." }, { v: u + f, kind: "formula_misuse", reason: "역수 공식을 합으로 잘못 적용했다." }, { v: u * f, kind: "step_missing", reason: "분자 uf 만 구하고 (u − f) 로 나누지 않았다." }, { v: Math.round(((u * f) / (u + f)) * 100) / 100, kind: "sign_error", reason: "1/v = 1/f − 1/u 에서 뺄셈 대신 덧셈으로 통분했다." }, { v: f * 2, kind: "other", reason: "계산 실수." }],
        verificationJs: withParams({ f, u }, "const out=[];\nfor(let v=1;v<=2000;v++){ if(P.u*v === P.f*(P.u+v)) out.push(v); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`공식에 주어진 값을 넣으면 1/${f} = 1/${u} + 1/(미지수) 이다.`, "Substitute the known values."],
          ["구하려는 항을 한쪽으로 모은다: 1/미지수 = 1/" + f + " − 1/" + u + " 이다.", "Isolate the reciprocal of the unknown."],
          [`통분하면 ${u - f}/${f * u} 이다.`, "Use a common denominator."],
          ["양변의 역수를 취한다.", "Take reciprocals."],
          [`미지수 = ${f * u}/${u - f} = ${vv} 이다.`, "Evaluate."],
        ],
        variant: res === "lens" ? "thin_lens" : res === "resistor" ? "parallel_resistors" : "combined_time",
      });
    },
  },
  {
    id: "le.literal_rearrange.chain2", skill: SKILL, kind: "literal_rearrange", operator: "chain2",
    structure: "F = (9/5)C + 32 를 두 방향으로 연쇄 사용: 화씨→섭씨, 섭씨 변화량 적용, 다시 화씨",
    extraThinking: "같은 공식을 역방향→변화량 적용→정방향으로 연쇄하고 '섭씨 변화량은 화씨로 9/5 배' 단위 규모를 구분 — medium 은 공식 한 번 적용",
    concepts: ["공식 역방향 사용", "변화량과 절대값 구분", "연쇄 환산"], mediumSteps: 3,
    generate(rng) {
      const C1 = rng.int(-2, 8) * 5, delta = rng.pick([5, 10, 15, 20]) * (rng.chance(0.5) ? 1 : -1); const F1 = (9 * C1) / 5 + 32, C2 = C1 + delta, F2 = (9 * C2) / 5 + 32;
      if (F1 < -20 || F1 > 130 || F2 < -20 || F2 > 130) throw new GenFail("x");
      const [a, am, , bm, thing] = rng.pick([["City A", "City A", "City B", "City B", "temperature"], ["Lab sample X", "lab sample X", "Lab sample Y", "lab sample Y", "temperature"], ["The kitchen", "the kitchen", "The cellar", "the cellar", "temperature"], ["Greenhouse 1", "greenhouse 1", "Greenhouse 2", "greenhouse 2", "temperature"], ["The north shore", "the north shore", "The south shore", "the south shore", "water temperature"], ["The summit camp", "the summit camp", "The base camp", "the base camp", "temperature"], ["Room 12", "room 12", "Room 15", "room 15", "temperature"], ["The first tank", "the first tank", "The second tank", "the second tank", "water temperature"]] as const);
      const dir = delta > 0 ? "higher" : "lower";
      const stimulus = facts(rng, [
        [`The temperature in degrees Fahrenheit, F, is related to the temperature in degrees Celsius, C, by ${M("F = \\frac{9}{5}C + 32")}.`, `Fahrenheit (F) and Celsius (C) readings are related by ${M("F = \\frac{9}{5}C + 32")}.`, `Use the conversion formula ${M("F = \\frac{9}{5}C + 32")} between Fahrenheit and Celsius.`],
        [`${a} reads ${F1} degrees Fahrenheit.`, `${a} is at ${F1} degrees Fahrenheit.`, `A thermometer at ${am} shows ${F1} degrees Fahrenheit.`],
        [`The ${thing} at ${bm} is ${Math.abs(delta)} degrees Celsius ${dir} than the ${thing} at ${am}.`, `On the Celsius scale, ${bm} is ${Math.abs(delta)} degrees ${dir} than ${am}.`, `Measured in Celsius, the reading at ${bm} is exactly ${Math.abs(delta)} degrees ${dir} than the reading at ${am}.`],
      ]);
      return finish(rng, {
        stimulus, question: spin(rng, `[[What is the ${thing} at ${bm}, in degrees Fahrenheit?|Find the Fahrenheit ${thing} at ${bm}.]]`), correct: F2,
        wrongs: [{ v: F1 + delta, kind: "unit_error", reason: "섭씨 변화량을 화씨 값에 그대로 더했다(9/5 배를 적용하지 않음)." }, { v: (9 * delta) / 5, kind: "step_missing", reason: "변화량의 화씨 환산값만 답했다." }, { v: C2, kind: "step_missing", reason: "섭씨로 구하고 화씨로 되돌리지 않았다." }, { v: F1 + (5 * delta) / 9, kind: "formula_misuse", reason: "변화량을 5/9 배로 환산해 더했다(방향 오류)." }, { v: F1 - (9 * delta) / 5, kind: "sign_error", reason: "변화 방향을 반대로 적용했다." }],
        verificationJs: withParams({ F1, delta }, "const out=[];\nfor(let F=-100;F<=300;F++){ let C1=null; for(let c=-100;c<=200;c++) if(9*c===5*(P.F1-32)){ C1=c; break; } if(C1===null) throw new Error('C1 없음'); if((F-32)*5 === 9*(C1+P.delta)) out.push(F); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`${F1} - 32 = ${F1 - 32} 이다.`, "Subtract 32 from the Fahrenheit value."],
          [`섭씨로 바꾸면 C = (5/9)(${F1 - 32}) = ${C1} 이다.`, "Convert to Celsius."],
          [`${delta > 0 ? "높으므로" : "낮으므로"} 섭씨 값은 ${C1} ${delta > 0 ? "+" : "-"} ${Math.abs(delta)} = ${C2} 이다.`, "Apply the Celsius change."],
          [`화씨로 되돌리면 (9/5)(${C2}) = ${(9 * C2) / 5} 이다.`, "Convert back."],
          [`32 를 더하면 F = ${F2} 이다.`, "Add 32."],
        ],
        variant: delta > 0 ? "warmer" : "cooler",
      });
    },
  },
  {
    id: "le.literal_rearrange.param_condition", skill: SKILL, kind: "literal_rearrange", operator: "param_condition",
    structure: "ax + by = cx + d 를 x = my + n 으로 재배열했을 때의 계수 m, n 을 구해 m + n 계산",
    extraThinking: "x 항을 한쪽으로 모아 공통인수 (a−c)로 묶어 나누고 y 계수·상수를 각각 읽어내는 재배열 — medium 은 한 변수 이항",
    concepts: ["리터럴 방정식 재배열", "공통인수 묶기", "계수 읽기"], mediumSteps: 3,
    generate(rng) {
      const dl = rng.nz(-4, 4), a = rng.nz(-6, 7), c = a - dl; const m = rng.nz(-6, 6), n = rng.nz(-8, 8);
      const b = -m * dl, d = n * dl; if (c === 0 || b === 0 || d === 0) throw new GenFail("x");
      const vx = rng.pick(["x", "t", "u"]), vy = rng.pick(["y", "s", "w"]);
      const eq0 = M(`${lin(a, 0, vx)} ${b >= 0 ? "+" : "-"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}${vy} = ${lin(c, 0, vx)} ${d >= 0 ? "+" : "-"} ${Math.abs(d)}`); const frm = M(`${vx} = m${vy} + n`);
      const stimulus = spin(rng, `[[The equation ${eq0} can be rewritten as ${frm}, where m and n are constants.|When the equation ${eq0} is solved for ${vx}, the result has the form ${frm}, where m and n are constants.|Solving ${eq0} for ${vx} gives an equation of the form ${frm}, with m and n constants.|If ${eq0} is rearranged so that ${vx} is alone on one side, it becomes ${frm}, where m and n are constants.]]`);
      return finish(rng, {
        stimulus, question: spin(rng, "[[What is the value of m + n?|Find m + n.|What is the sum of m and n?]]"), correct: m + n,
        wrongs: [{ v: -(m + n), kind: "sign_error", reason: "이항 과정에서 모든 부호를 반대로 썼다." }, { v: m - n, kind: "formula_misuse", reason: "m + n 대신 m − n 을 계산했다." }, { v: b + d, kind: "step_missing", reason: "(a−c) 로 나누지 않고 계수 b 와 상수 d 를 그대로 더했다." }, { v: b / dl + n, kind: "sign_error", reason: "y 항을 이항하면서 부호를 바꾸지 않았다." }, { v: m, kind: "step_missing", reason: "m 만 구했다." }],
        verificationJs: withParams({ a, b, c, d }, "const out=[];\nfor(let m=-80;m<=80;m++) for(let n=-80;n<=80;n++){ let ok=true; for(const y of [0,1,2,5]){ const x=m*y+n; if(P.a*x+P.b*y !== P.c*x+P.d){ok=false;break;} } if(ok) out.push(m+n); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`${vx} 항을 왼쪽, 나머지를 오른쪽으로 모은다: ${a - c}${vx} = ${d} ${-b >= 0 ? "+" : "-"} ${Math.abs(b)}${vy} 이다.`, "Collect x terms on the left."],
          [`양변을 ${a - c} 로 나눈다.`, "Divide by the coefficient."],
          [`${vx} = (${-b}/${pn(a - c)})${vy} + ${d}/${pn(a - c)} 이다.`, "Write the quotient."],
          [`m = ${m} 이다.`, "Read m."],
          [`n = ${n} 이다.`, "Read n."],
          [`m + n = ${m + n} 이다.`, "Add."],
        ],
        variant: "collect_and_divide",
      });
    },
  },
  ...LE1_SPR_B_ARCHETYPES,
];
