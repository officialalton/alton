// linear_inequalities hard 원형 12개(solve_one_var·point_in_solution·table_verification × 연산자 4종). 정답은 모두 수치(개수·정수 값).
import { GenFail, type Archetype } from "../types";
import { facts, finish, lin, M, spin, withParams } from "../text";
import { flipOp, H_JS, holds, jsOp, near, OPS, pairList, T, W, floorDiv, ceilDiv, type Op } from "../kit-b";

const SKILL = "linear_inequalities";
const LET = ["x", "t", "n", "m"] as const;
const pm = (n: number) => (n < 0 ? `- ${-n}` : `+ ${n}`);
/** m x + b 형태 문자열(계수 0 이면 b). */
const mxb = (m: number, b: number, v = "x") => lin(m, b, v);
const wordsOp = (o: Op) => (o === "<" ? "less than" : o === ">" ? "greater than" : o === "\\le" ? "at most" : "at least");

export const LI_ARCHETYPES: Archetype[] = [
  {
    id: "li.solve_one_var.param_condition", skill: SKILL, kind: "solve_one_var", operator: "param_condition",
    structure: "kx + a ◇ b 의 해집합이 x ◆ s 로 주어질 때 부등호 방향이 바뀌었는지로 k 의 부호를 정하고, 경계값 (b−a)/k = s 에서 k 를 구함",
    extraThinking: "해집합의 방향이 원래 부등호와 다르면 음수로 나눴다는 뜻이므로 k<0 이라는 암묵 조건을 읽어 내고 경계값 방정식으로 k 를 결정 — medium 은 주어진 부등식을 푸는 정방향",
    concepts: ["부등식의 해집합", "음수로 나눌 때 방향 반전", "경계값 방정식"], mediumSteps: 2,
    generate(rng) {
      const k = rng.pick([-7, -6, -5, -4, -3, -2, 2, 3, 4, 5, 6, 7]), s = rng.nz(-8, 8), a = rng.nz(-12, 12), b = k * s + a;
      if (Math.abs(b) > 60 || b === a) throw new GenFail("x");
      const op = rng.pick(OPS), op2: Op = k < 0 ? flipOp(op) : op; const v = rng.pick(LET), K = rng.pick(["k", "p", "c"]);
      const stimulus = facts(rng, [
        [`In the inequality below, ${K} is a constant.`, `Consider the inequality below, where ${K} is a constant.`, `The inequality below contains a constant ${K}.`, `Let ${K} be a constant in the inequality below.`],
        [`The solution set of the inequality is all values of ${v} that satisfy ${M(`${v} ${op2} ${s}`)}.`, `Its solution set is exactly the set of ${v} with ${M(`${v} ${op2} ${s}`)}.`, `The inequality is true precisely when ${M(`${v} ${op2} ${s}`)}.`, `Solving it gives the condition ${M(`${v} ${op2} ${s}`)}.`],
      ]) + `\n\n${M(`${K}${v} ${pm(a)} ${op} ${b}`)}`;
      return finish(rng, {
        stimulus, question: spin(rng, `[[What is the value of ${K}?|Find the value of ${K}.|What must ${K} equal?|Which value of ${K} produces this solution set?]]`), correct: k,
        wrongs: [W(-k, "sign_error", "부등호 방향이 바뀐 것을 읽지 못해 k 의 부호를 반대로 정했다."), W(s, "formula_misuse", "해집합의 경계값을 k 로 답했다."), W(b - a, "step_missing", "상수항만 옮기고 s 로 나누지 않았다."), W((b + a) / s, "sign_error", "상수항을 이항할 때 부호를 바꾸지 않았다."), W(-(b - a) / s, "sign_error", "경계값 방정식의 부호를 뒤집었다."), W(k + (k > 0 ? 1 : -1), "other", "계산 실수.")],
        verificationJs: withParams({ a, b, s, op: jsOp(op), op2: jsOp(op2) }, H_JS + "const out=[];\nfor(let k=-90;k<=90;k++){ if(k===0) continue; let ok=true; for(const x of [P.s-5,P.s-0.001,P.s,P.s+0.001,P.s+5]){ if(h(k*x+P.a,P.op,P.b)!==h(x,P.op2,P.s)){ok=false;break;} } if(ok) out.push(k); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          T(`${K}${v} 항만 남기도록 상수항을 이항하면 $${K}${v} ${op} ${b - a}$ 이다.`, "Isolate the K-term."),
          T(`해집합은 $${v} ${op2} ${s}$ 로, 원래 부등호 ${wordsOp(op)} 와 방향이 ${k < 0 ? "반대" : "같다"}.`, "Compare the direction of the solution set with the original sign."),
          T(k < 0 ? `방향이 바뀌었으므로 음수로 나눈 것이다: ${K} < 0 이다.` : `방향이 같으므로 양수로 나눈 것이다: ${K} > 0 이다.`, "A flipped sign means division by a negative number."),
          T(`${K} 로 나누면 경계값은 ${b - a}/${K} 이다.`, "Divide to get the boundary value."),
          T(`경계값이 ${s} 이므로 ${b - a}/${K} = ${s} 이다.`, "Equate the boundary with the given value."),
          T(`${K} = ${b - a}/${s} = ${k} 이고 부호 조건과 맞는다.`, "Solve and check the sign condition."),
        ],
        variant: "sign_of_coefficient",
      });
    },
  },
  {
    id: "li.solve_one_var.constraint_select", skill: SKILL, kind: "solve_one_var", operator: "constraint_select",
    structure: "두 일차부등식의 해를 각각 구해 공통 구간을 만들고 그 안의 정수 조건(개수·합·최댓값·최솟값)을 선택",
    extraThinking: "서로 다른 방향의 두 제약을 하나의 구간으로 합치고 경계 포함 여부를 따져 정수 후보를 걸러냄 — medium 은 부등식 하나의 해",
    concepts: ["연립 부등식", "구간의 교집합", "정수 해 선택"], mediumSteps: 2,
    generate(rng) {
      const L = rng.int(-8, 3), U = L + rng.int(3, 9);
      const mk = (bound: number, lower: boolean) => {
        const a = rng.pick([2, 3, 4, 5]) * (rng.chance(0.5) ? 1 : -1), b = rng.nz(-9, 9), d = rng.int(-(Math.abs(a) - 1), Math.abs(a) - 1);
        const op: Op = (a > 0) === lower ? rng.pick<Op>([">", "\\ge"]) : rng.pick<Op>(["<", "\\le"]);
        return { a, b, c: a * bound + b + d, op };
      };
      const A = mk(L, true), B = mk(U, false);
      const ints: number[] = []; for (let x = -60; x <= 60; x++) if (holds(A.a * x + A.b, A.op, A.c) && holds(B.a * x + B.b, B.op, B.c)) ints.push(x);
      if (ints.length < 3 || ints.length > 9) throw new GenFail("x");
      const v = rng.pick(LET), ask = rng.pick(["count", "sum", "greatest", "least"] as const);
      const first = rng.chance(0.5) ? [A, B] : [B, A];
      const stimulus = `${rng.pick(["Consider the two inequalities below.", "A value is chosen that satisfies both inequalities below.", `The integer ${v} satisfies both of the inequalities below.`, "Both of the inequalities below must hold."])}\n\n${M(`${lin(first[0].a, first[0].b, v)} ${first[0].op} ${first[0].c}`)}\n${M(`${lin(first[1].a, first[1].b, v)} ${first[1].op} ${first[1].c}`)}`;
      const qs = { count: `[[How many integers ${v} satisfy both inequalities?|What is the number of integer values of ${v} that make both inequalities true?]]`, sum: `[[What is the sum of all integers ${v} that satisfy both inequalities?|Find the sum of every integer solution of the pair of inequalities.]]`, greatest: `[[What is the greatest integer ${v} that satisfies both inequalities?|Find the largest integer solution of both inequalities.]]`, least: `[[What is the least integer ${v} that satisfies both inequalities?|Find the smallest integer solution of both inequalities.]]` };
      const mn = ints[0], mx = ints[ints.length - 1], sum = ints.reduce((p, c) => p + c, 0);
      const correct = ask === "count" ? ints.length : ask === "sum" ? sum : ask === "greatest" ? mx : mn;
      const wrongs = ask === "count" ? [W(ints.length + 1, "condition_ignored", "경계값이 포함되는지 따지지 않고 정수를 하나 더 셌다."), W(ints.length - 1, "condition_ignored", "경계 정수를 하나 빠뜨렸다."), W(mx - mn, "formula_misuse", "끝값의 차를 개수로 답했다."), W(ints.length + 2, "other", "구간을 넓게 잡았다.")]
        : ask === "sum" ? [W(sum - mx, "condition_ignored", "가장 큰 정수를 제외했다."), W(sum + mx + 1, "condition_ignored", "경계 밖 정수를 더했다."), W(sum - mn, "condition_ignored", "가장 작은 정수를 제외했다."), W(sum + mn - 1, "condition_ignored", "경계 밖 정수를 더했다.")]
        : ask === "greatest" ? [W(mx + 1, "condition_ignored", "경계가 포함되지 않는데 포함했다."), W(mx - 1, "condition_ignored", "경계가 포함되는데 제외했다."), W(mn, "other", "가장 작은 정수를 답했다."), W(mx + 2, "other", "계산 실수.")]
        : [W(mn - 1, "condition_ignored", "경계가 포함되지 않는데 포함했다."), W(mn + 1, "condition_ignored", "경계가 포함되는데 제외했다."), W(mx, "other", "가장 큰 정수를 답했다."), W(mn - 2, "other", "계산 실수.")];
      const solveStep = (z: typeof A) => { const rhs = z.c - z.b; const o2 = z.a < 0 ? flipOp(z.op) : z.op; return `$${v} ${o2} ${(rhs / z.a).toFixed(2).replace(/\.?0+$/, "")}$`; };
      return finish(rng, {
        stimulus, question: spin(rng, qs[ask]), correct, wrongs,
        verificationJs: withParams({ a1: A.a, b1: A.b, c1: A.c, o1: jsOp(A.op), a2: B.a, b2: B.b, c2: B.c, o2: jsOp(B.op), ask }, H_JS + "const xs=[];\nfor(let x=-400;x<=400;x++) if(h(P.a1*x+P.b1,P.o1,P.c1)&&h(P.a2*x+P.b2,P.o2,P.c2)) xs.push(x);\nif(xs.length<1) throw new Error('해 없음');\nif(P.ask==='count') return xs.length;\nif(P.ask==='sum') return xs.reduce((p,c)=>p+c,0);\nif(P.ask==='greatest') return Math.max(...xs);\nreturn Math.min(...xs);"),
        trace: [
          T(`첫 부등식을 풀면 ${solveStep(A)} (음수로 나누면 부등호 방향이 바뀐다).`, "Solve the first inequality."),
          T(`둘째 부등식을 풀면 ${solveStep(B)}.`, "Solve the second inequality."),
          T("두 조건의 공통 구간(교집합)을 만든다.", "Intersect the two conditions."),
          T(`경계값이 포함되는지(≤, ≥ 인지 <, > 인지) 확인해 정수 후보를 정한다: ${ints.join(", ")}.`, "List the integers allowed by the endpoints."),
          T(ask === "count" ? `정수는 ${ints.length}개이다.` : ask === "sum" ? `합은 ${sum} 이다.` : ask === "greatest" ? `가장 큰 정수는 ${mx} 이다.` : `가장 작은 정수는 ${mn} 이다.`, "Answer the requested quantity."),
        ],
        variant: "compound_" + ask,
      });
    },
  },
  {
    id: "li.solve_one_var.chain2", skill: SKILL, kind: "solve_one_var", operator: "chain2",
    structure: "첫 부등식의 정수 해 중 최솟값 s 를 구하고, s 가 둘째 부등식 k s − d ◇ e 의 해가 되도록 하는 k 의 최댓값(최솟값)을 구함",
    extraThinking: "앞 부등식의 결과(최소 정수 해)가 뒤 부등식의 입력 값이 되는 2단계 연쇄 — medium 은 부등식 하나의 해",
    concepts: ["부등식 풀이", "최소 정수 해", "대입 후 매개변수 부등식"], mediumSteps: 2,
    generate(rng) {
      const a = rng.pick([2, 3, 4, 5, 6]), b = rng.nz(-9, 9), s = rng.int(2, 9);
      const c = a * (s - 1) + b + rng.int(0, a - 1); // x > (c-b)/a : 최소 정수 해 s
      const first = Math.floor((c - b) / a) + 1; if (first !== s) throw new GenFail("x");
      const useMax = rng.chance(0.6), d = rng.nz(-9, 9), kk = rng.int(-6, 9), e = (useMax ? kk * s + rng.int(0, s - 1) : kk * s - rng.int(0, s - 1)) - d;
      const op2: Op = useMax ? "\\le" : "\\ge"; const ans = useMax ? floorDiv(e + d, s) : ceilDiv(e + d, s);
      const v = rng.pick(LET), K = rng.pick(["k", "p", "c"]);
      const stimulus = facts(rng, [
        [`Let s be the least integer that satisfies ${M(`${lin(a, b, v)} > ${c}`)}.`, `The least integer ${v} for which ${M(`${lin(a, b, v)} > ${c}`)} is true is called s.`, `Among the integers satisfying ${M(`${lin(a, b, v)} > ${c}`)}, the smallest is named s.`, `Call the smallest integer solution of ${M(`${lin(a, b, v)} > ${c}`)} s.`],
        [`The number s is also a solution of ${M(`${K}${v} ${pm(-d)} ${op2} ${e}`)}, where ${K} is an integer.`, `For an integer ${K}, the value s satisfies ${M(`${K}${v} ${pm(-d)} ${op2} ${e}`)}.`, `The inequality ${M(`${K}${v} ${pm(-d)} ${op2} ${e}`)} is true when ${v} = s, where ${K} is an integer.`, `An integer ${K} is chosen so that ${M(`${K}${v} ${pm(-d)} ${op2} ${e}`)} holds for ${v} = s.`],
      ]);
      return finish(rng, {
        stimulus, question: useMax ? spin(rng, `[[What is the greatest possible value of ${K}?|What is the largest integer ${K} can be?|Find the greatest integer value of ${K}.]]`) : spin(rng, `[[What is the least possible value of ${K}?|What is the smallest integer ${K} can be?|Find the least integer value of ${K}.]]`), correct: ans,
        wrongs: [W(s, "step_missing", "첫 부등식의 최소 정수 해만 구하고 둘째 부등식을 풀지 않았다."), W(useMax ? ans + 1 : ans - 1, "condition_ignored", "정수 조건에서 올림·내림 방향을 반대로 적용했다."), W(useMax ? ans - 1 : ans + 1, "condition_ignored", "경계 정수를 제외했다."), W(Math.floor((c - b) / a), "condition_ignored", "첫 부등식의 경계값을 그대로 정수 해로 썼다(엄격한 부등호 무시)."), W(Math.trunc((e - d) / s), "sign_error", "상수항 d 의 부호를 반대로 이항했다.")],
        verificationJs: withParams({ a, b, c, d, e, op: jsOp(op2) }, H_JS + "let s=null;\nfor(let x=-300;x<=300;x++) if(P.a*x+P.b>P.c){ s=x; break; }\nif(s===null) throw new Error('첫 해 없음');\nconst ks=[];\nfor(let k=-400;k<=400;k++) if(h(k*s-P.d,P.op,P.e)) ks.push(k);\nif(!ks.length) throw new Error('k 없음');\nreturn P.op==='<='?Math.max(...ks):Math.min(...ks);"),
        trace: [
          T(`첫 부등식을 풀면 $${v} > ${((c - b) / a).toFixed(2).replace(/\.?0+$/, "")}$ 이다.`, "Solve the first inequality."),
          T(`부등호가 '>' 이므로 경계값은 해가 아니다. 그보다 큰 가장 작은 정수는 ${s} 이다.`, "The boundary is excluded, so take the next integer."),
          T(`둘째 부등식에 ${v} = ${s} 를 대입하면 $${K}\\cdot ${s} ${pm(-d)} ${op2} ${e}$ 이다.`, "Substitute the value."),
          T(`상수를 이항하면 $${s}${K} ${op2} ${e + d}$ 이다.`, "Isolate the K-term."),
          T(`양수 ${s} 로 나누면 $${K} ${op2} ${((e + d) / s).toFixed(2).replace(/\.?0+$/, "")}$ 이다.`, "Divide by the positive number."),
          T(useMax ? `K 는 정수이므로 가장 큰 값은 ${ans} 이다.` : `K 는 정수이므로 가장 작은 값은 ${ans} 이다.`, "Take the extreme integer."),
        ],
        variant: useMax ? "greatest_k" : "least_k",
      });
    },
  },
  {
    id: "li.solve_one_var.compose_kind", skill: SKILL, kind: "solve_one_var", operator: "compose_kind",
    structure: "직사각형의 가로 x+p, 세로 x−q 에서 둘레 상한과 세로 하한으로 정수 x 의 범위를 정하고 그 최댓값에서 넓이를 계산",
    extraThinking: "부등식을 둘레·넓이 공식과 합성하고, 넓이가 x 에 대해 증가함을 이용해 정수 구간의 끝값을 선택 — medium 은 부등식 하나의 해",
    concepts: ["일차부등식", "직사각형 둘레와 넓이", "정수 구간의 끝값"], mediumSteps: 2,
    generate(rng) {
      const p = rng.int(2, 8), qq = rng.int(1, 5), w0 = rng.int(2, 4), lo = qq + w0, xmax = lo + rng.int(2, 8);
      const per = 2 * ((xmax + p) + (xmax - qq)) + rng.int(0, 3); if (Math.floor((per - 2 * (p - qq)) / 4) !== xmax) throw new GenFail("x");
      const area = (xmax + p) * (xmax - qq); if (area > 600) throw new GenFail("x");
      const [obj, unit] = rng.pick([["garden", "meters"], ["banner", "feet"], ["poster", "inches"], ["courtyard", "yards"], ["tabletop", "centimeters"], ["mat", "feet"]] as const);
      const stimulus = facts(rng, [
        [`A rectangular ${obj} has a length of ${M(`x + ${p}`)} ${unit} and a width of ${M(`x - ${qq}`)} ${unit}, where x is an integer.`, `The length of a rectangular ${obj} is ${M(`x + ${p}`)} ${unit} and its width is ${M(`x - ${qq}`)} ${unit}, for an integer x.`, `For an integer x, a rectangular ${obj} measures ${M(`x + ${p}`)} ${unit} in length and ${M(`x - ${qq}`)} ${unit} in width.`],
        [`Its perimeter is at most ${per} ${unit}.`, `The perimeter cannot exceed ${per} ${unit}.`, `The distance around it is no more than ${per} ${unit}.`],
        [`The width must be at least ${w0} ${unit}.`, `Its width is required to be no less than ${w0} ${unit}.`, `The ${obj} must be at least ${w0} ${unit} wide.`],
      ]);
      return finish(rng, {
        stimulus, question: spin(rng, `[[What is the greatest possible area of the ${obj}, in square ${unit}?|What is the largest area, in square ${unit}, that the ${obj} can have?|Find the maximum possible area of the ${obj} in square ${unit}.]]`), correct: area,
        wrongs: [W((xmax + 1 + p) * (xmax + 1 - qq), "condition_ignored", "정수 조건 없이 올림해 x 를 하나 크게 잡았다."), W((lo + p) * (lo - qq), "condition_ignored", "x 의 최솟값에서 넓이를 구했다."), W(per, "formula_misuse", "둘레 상한을 넓이로 답했다."), W((xmax + p) + (xmax - qq), "formula_misuse", "가로+세로를 넓이로 답했다."), W((xmax - 1 + p) * (xmax - 1 - qq), "step_missing", "x 의 최댓값에서 1 을 뺐다.")],
        verificationJs: withParams({ p, q: qq, per, w0 }, "const out=[];\nfor(let x=-100;x<=200;x++){ const L=x+P.p, Wd=x-P.q; if(Wd<P.w0) continue; if(2*(L+Wd)>P.per) continue; out.push(L*Wd); }\nif(!out.length) throw new Error('해 없음');\nreturn Math.max(...out);"),
        trace: [
          T(`둘레는 $2((x + ${p}) + (x - ${qq})) = ${4} x + ${2 * (p - qq)}$ 이다.`, "Write the perimeter."),
          T(`둘레 조건 $4x + ${2 * (p - qq)} \\le ${per}$ 에서 $x \\le ${(per - 2 * (p - qq)) / 4}$ 이다.`, "Solve the perimeter inequality."),
          T(`세로 조건 $x - ${qq} \\ge ${w0}$ 에서 $x \\ge ${lo}$ 이다.`, "Solve the width inequality."),
          T(`정수 x 의 범위는 ${lo} 이상 ${xmax} 이하이다.`, "Combine into an integer range."),
          T("가로·세로가 모두 x 와 함께 커지므로 넓이는 x 가 클수록 크다.", "Area increases with x."),
          T(`x = ${xmax} 일 때 가로 ${xmax + p}, 세로 ${xmax - qq} 이고 넓이는 ${area} 이다.`, "Evaluate at the greatest x."),
        ],
        variant: "perimeter_area_bound",
      });
    },
  },
  {
    id: "li.point_in_solution.inverse", skill: SKILL, kind: "point_in_solution", operator: "inverse",
    structure: "점 (p, q) 가 y ◇ mx + b 의 해라는 조건을 대입해 미지 상수 b 의 범위를 구하고 주어진 정수 범위와 교집합의 개수를 셈",
    extraThinking: "점을 대입한 결과를 미지 상수에 대한 부등식으로 거꾸로 풀고 경계 포함 여부와 범위 제한을 함께 처리 — medium 은 점이 해인지 판정하는 정방향",
    concepts: ["점의 대입", "미지 상수에 대한 부등식", "정수 개수 세기"], mediumSteps: 2,
    generate(rng) {
      const m = rng.nz(-4, 4), p = rng.nz(-4, 5), qq = rng.nz(-9, 9), N = rng.int(5, 9), op = rng.pick(OPS);
      let cnt = 0; for (let b = -N; b <= N; b++) if (holds(qq, op, m * p + b)) cnt++;
      if (cnt < 3 || cnt > 2 * N - 2) throw new GenFail("x");
      const bound = qq - m * p; const cntWrong = (o2: Op) => { let c = 0; for (let b = -N; b <= N; b++) if (holds(qq, o2, m * p + b)) c++; return c; };
      const strictFlip: Op = op === "<" ? "\\le" : op === "\\le" ? "<" : op === ">" ? "\\ge" : ">";
      const stimulus = `${facts(rng, [
        ["In the inequality below, b is an integer.", "For the inequality below, b is an integer constant.", "Consider the inequality below, where b is an integer.", "Let b be an integer in the inequality below.", "The inequality below contains an integer constant b.", "An integer b appears in the inequality below."],
        [`The point ${M(`(${p}, ${qq})`)} is a solution to the inequality.`, `The ordered pair ${M(`(${p}, ${qq})`)} satisfies the inequality.`, `The inequality is true when ${M(`x = ${p}`)} and ${M(`y = ${qq}`)}.`, `It is known that ${M(`(${p}, ${qq})`)} lies in the solution set.`, `The coordinates ${M(`(${p}, ${qq})`)} make the inequality true.`, `Substituting ${M(`x = ${p}`)} and ${M(`y = ${qq}`)} gives a true statement.`],
      ])}\n\n${M(`y ${op} ${lin(m, 0, "x")} + b`)}`;
      return finish(rng, {
        stimulus, question: spin(rng, `[[How many integer values of b between ${-N} and ${N}, inclusive, are possible?|For how many integers b with ${M(`${-N} \\le b \\le ${N}`)} is this possible?|If ${M(`${-N} \\le b \\le ${N}`)}, how many integer values can b take?|How many possible integer values does b have if b is at least ${-N} and at most ${N}?|Among the integers from ${-N} to ${N}, inclusive, how many can be the value of b?|If b can only be an integer from ${-N} through ${N}, for how many of them is the stated condition true?]]`), correct: cnt,
        wrongs: [W(cntWrong(strictFlip), "condition_ignored", "경계값을 포함하는지(엄격한 부등호인지)를 반대로 적용했다."), W(cnt + 1, "condition_ignored", "경계 정수를 하나 더 셌다."), W(cnt - 1, "condition_ignored", "경계 정수를 하나 빠뜨렸다."), W(2 * N + 1, "step_missing", "점의 조건을 쓰지 않고 범위 안 정수를 모두 셌다."), W(Math.abs(bound), "formula_misuse", "경계값의 크기를 개수로 답했다.")],
        verificationJs: withParams({ m, p, q: qq, N, op: jsOp(op) }, H_JS + "let c=0;\nfor(let b=-P.N;b<=P.N;b++) if(h(P.q,P.op,P.m*P.p+b)) c++;\nreturn c;"),
        trace: [
          T(`점 (${p}, ${qq}) 를 대입하면 $${qq} ${op} ${m}\\cdot ${p < 0 ? `(${p})` : p} + b$ 이다.`, "Substitute the point."),
          T(`정리하면 $${qq} ${op} ${m * p} + b$ 이다.`, "Simplify."),
          T(`b 에 대해 풀면 $b ${flipOp(op)} ${bound}$ 이다.`, "Solve for b."),
          T(`경계값 ${bound} 가 ${op === "\\le" || op === "\\ge" ? "포함" : "제외"}된다.`, "Decide whether the endpoint is included."),
          T(`정수 범위 ${-N} 이상 ${N} 이하와 겹치는 정수를 센다.`, "Intersect with the allowed range."),
          T(`가능한 정수 b 는 ${cnt}개이다.`, "Count."),
        ],
        variant: "unknown_constant_count",
      });
    },
  },
  {
    id: "li.point_in_solution.constraint_select", skill: SKILL, kind: "point_in_solution", operator: "constraint_select",
    structure: "두 부등식 y > m1 x + b1 과 y ≤ m2 x + b2 를 동시에 만족하고 x 가 1 이상 N 이하인 양의 정수 순서쌍의 개수를 열별로 센다",
    extraThinking: "각 x 마다 y 의 허용 구간(포함 여부 포함)을 따로 구해 격자점을 선택·합산 — medium 은 점 하나가 해인지 판정",
    concepts: ["연립 부등식의 영역", "격자점 세기", "경계 포함 여부"], mediumSteps: 2,
    generate(rng) {
      const m1 = rng.nz(-2, 2), b1 = rng.int(-4, 3), m2 = rng.nz(-1, 2), b2 = rng.int(2, 9), N = rng.int(4, 6), o1: Op = rng.pick([">", "\\ge"]), o2: Op = rng.pick(["<", "\\le"]);
      const count = (a: Op, b: Op, pos: boolean) => { let c = 0; for (let x = 1; x <= N; x++) for (let y = pos ? 1 : -50; y <= 60; y++) if (holds(y, a, m1 * x + b1) && holds(y, b, m2 * x + b2)) c++; return c; };
      const cnt = count(o1, o2, true); if (cnt < 6 || cnt > 28) throw new GenFail("x");
      const cols: number[] = []; for (let x = 1; x <= N; x++) { let c = 0; for (let y = 1; y <= 60; y++) if (holds(y, o1, m1 * x + b1) && holds(y, o2, m2 * x + b2)) c++; cols.push(c); }
      const both = (o: Op) => (o === "<" ? "\\le" : o === "\\le" ? "<" : o === ">" ? "\\ge" : ">");
      const stimulus = `${rng.pick(["Consider the system of inequalities below.", "A point (x, y) must satisfy both inequalities below.", "The ordered pair (x, y) is a solution to both inequalities below.", "Look at the two inequalities below.", "A grid point is a solution when it makes both inequalities below true.", "Two conditions on a point (x, y) are written below."])}\n\n${M(`y ${o1} ${mxb(m1, b1)}`)}\n${M(`y ${o2} ${mxb(m2, b2)}`)}\n\n${rng.pick([`Only points whose coordinates are positive integers and whose x-coordinate is at most ${N} are counted.`, `Consider only points ${M("(x, y)")} where x and y are positive integers and x does not exceed ${N}.`, `The points being counted have positive integer coordinates, and x is no larger than ${N}.`, `Count points with positive whole-number coordinates and x from 1 to ${N}.`, `Each point being considered has integer coordinates, a positive y, and an x between 1 and ${N}, inclusive.`])}`;
      return finish(rng, {
        stimulus, question: spin(rng, "[[How many such points are solutions to both inequalities?|How many of these points satisfy the system?|How many points are counted?|How many of the points make both inequalities true?|What is the total number of points that satisfy both conditions?]]"), correct: cnt,
        wrongs: [W(count(both(o1), both(o2), true), "condition_ignored", "경계선 위 점의 포함 여부를 반대로 적용했다."), W(count(o1, o2, false), "condition_ignored", "y 가 양의 정수라는 조건을 무시하고 0 이하 정수도 셌다."), W(cnt + 1, "other", "한 열을 잘못 셌다."), W(cnt - 1, "other", "한 열을 잘못 셌다."), W(cols.reduce((a, c) => Math.max(a, c), 0) * N, "formula_misuse", "가장 큰 열의 개수에 열의 수를 곱했다.")],
        verificationJs: withParams({ m1, b1, m2, b2, N, o1: jsOp(o1), o2: jsOp(o2) }, H_JS + "let c=0;\nfor(let x=1;x<=P.N;x++) for(let y=1;y<=80;y++) if(h(y,P.o1,P.m1*x+P.b1)&&h(y,P.o2,P.m2*x+P.b2)) c++;\nreturn c;"),
        trace: [
          T("두 부등식을 각 x 에 대해 y 의 범위로 읽는다.", "Read both as bounds on y for each x."),
          ...cols.map((c, i) => T(`x = ${i + 1}: y 는 ${m1 * (i + 1) + b1} 보다 ${o1 === ">" ? "커야" : "크거나 같아야"} 하고 ${m2 * (i + 1) + b2} 보다 ${o2 === "<" ? "작아야" : "작거나 같아야"} 하며 양의 정수이므로 ${c}개이다.`, `For x = ${i + 1} count the allowed y.`)),
          T(`열별 개수를 모두 더하면 ${cols.join(" + ")} = ${cnt} 이다.`, "Add the counts."),
        ],
        variant: "lattice_between_lines",
      });
    },
  },
  {
    id: "li.point_in_solution.repr_shift", skill: SKILL, kind: "point_in_solution", operator: "repr_shift",
    structure: "두 종류 입장권의 가격과 목표 수입을 부등식 ax + by ≥ T 로 번역하고, 한 종류의 판매 수를 대입해 다른 종류의 최소 판매 수를 올림으로 구함",
    extraThinking: "문장을 두 변수 부등식으로 모델링하고 한 변수를 대입한 뒤 정수 조건(올림)을 적용 — medium 은 주어진 부등식에 점을 대입해 판정",
    concepts: ["문장→두 변수 부등식", "대입", "정수 조건과 올림"], mediumSteps: 2,
    generate(rng) {
      const a = rng.int(6, 15), b = rng.int(3, a - 2), pAmt = rng.int(8, 40), y0 = rng.int(8, 40);
      const T0 = a * pAmt + b * y0 - rng.int(0, b - 1) ; const need = ceilDiv(T0 - a * pAmt, b); if (need < 2 || need > 60 || T0 > 900) throw new GenFail("x");
      const [A, B, org] = rng.pick([["adult ticket", "student ticket", "A school play"], ["large pizza", "small pizza", "A fundraiser"], ["hardcover book", "paperback book", "A charity sale"], ["premium seat", "standard seat", "A concert hall"]] as const);
      const stimulus = facts(rng, [
        [`${org} sells ${A}s for ${a} dollars each and ${B}s for ${b} dollars each.`, `At ${org.replace(/^A /, "a ")}, each ${A} costs ${a} dollars and each ${B} costs ${b} dollars.`, `Each ${A} sold earns ${a} dollars, and each ${B} sold earns ${b} dollars.`],
        [`The goal is to earn at least ${T0} dollars in total.`, `Total sales of at least ${T0} dollars are needed.`, `It needs total sales of no less than ${T0} dollars.`],
        [`${pAmt} ${A}s are already sold.`, `So far, ${pAmt} ${A}s have been sold.`, `The number of ${A}s sold is ${pAmt}.`],
      ]);
      return finish(rng, {
        stimulus, question: spin(rng, `[[What is the least number of ${B}s that must also be sold to reach the goal?|What is the minimum number of ${B}s that still must be sold to meet the goal?|At least how many ${B}s must be sold to reach the goal?]]`), correct: need,
        wrongs: [...near(need).slice(0,0), W(need - 1, "condition_ignored", "올림하지 않고 내림해 목표에 모자란다."), W(Math.floor((T0 - a * pAmt) / b) + 2, "other", "올림 후 하나 더 더했다."), W(Math.round(T0 / b), "step_missing", "이미 판매한 입장권 수입을 빼지 않았다."), W(ceilDiv(T0 - b * pAmt, a), "formula_misuse", "두 가격을 서로 바꿔 계산했다."), W(T0 - a * pAmt, "step_missing", "남은 금액을 개수로 답했다.")],
        phraseBindings: [{ phrase: A, value: a }, { phrase: B, value: b }],
        verificationJs: withParams({ a, b, T: T0, p: pAmt }, "for(let y=0;y<=2000;y++) if(P.a*P.p+P.b*y>=P.T) return y;\nthrow new Error('없음');"),
        trace: [
          T(`${A} 수를 x, ${B} 수를 y 라 하면 수입은 $${a}x + ${b}y$ 이다.`, "Model total revenue."),
          T(`목표는 $${a}x + ${b}y \\ge ${T0}$ 이다.`, "Write the goal as an inequality."),
          T(`x = ${pAmt} 를 대입하면 $${b}y \\ge ${T0 - a * pAmt}$ 이다.`, "Substitute the known count."),
          T(`${b} 로 나누면 $y \\ge ${((T0 - a * pAmt) / b).toFixed(2).replace(/\.?0+$/, "")}$ 이다.`, "Divide."),
          T("판매 수는 정수이므로 올림한다.", "Counts are whole numbers, so round up."),
          T(`최소 판매 수는 ${need} 이다.`, "Answer."),
        ],
        variant: "revenue_goal_round_up",
      });
    },
  },
  {
    id: "li.point_in_solution.compare_scenarios", skill: SKILL, kind: "point_in_solution", operator: "compare_scenarios",
    structure: "두 요금제의 비용 F_A + r_A n 과 F_B + r_B n 을 세우고 B 가 더 싸지는 가장 작은 정수 n 을 구함",
    extraThinking: "서로 다른 고정비와 단위비용의 두 비용식을 비교하는 부등식을 세우고 임계점 직후의 정수를 선택 — medium 은 주어진 하나의 식에 대입",
    concepts: ["두 비용식 모델링", "비교 부등식", "임계점과 정수 선택"], mediumSteps: 2,
    generate(rng) {
      const fa = rng.int(0, 20) * 5, rb = rng.int(2, 9), ra = rb + rng.int(2, 6), nStar = rng.int(4, 25);
      const fb = fa + ra * nStar - rb * nStar + rng.int(1, 9); // 교차점 n* 에서 A 가 약간 싸도록 → B 가 싸지는 최소 n = floor((fb-fa)/(ra-rb))+1
      const diff = fb - fa, rate = ra - rb; if (diff <= 0) throw new GenFail("x"); const ans = Math.floor(diff / rate) + 1; if (ans < 3 || ans > 40 || fb > 400) throw new GenFail("x");
      const [subj, fee, unit] = rng.pick([["A gym", "a joining fee", "visit"], ["A car-sharing service", "an annual fee", "trip"], ["A print shop", "a setup charge", "poster"], ["A tutoring center", "a registration fee", "session"]] as const);
      const stimulus = facts(rng, [
        [`${subj} offers two plans. Plan A has ${fee} of ${fa} dollars and charges ${ra} dollars per ${unit}.`, `Two plans are offered by ${subj.replace(/^A /, "a ")}. Plan A costs ${ra} dollars for each ${unit} plus ${fee} of ${fa} dollars.`, `${subj} sells Plan A with ${fee} of ${fa} dollars and ${ra} dollars for every ${unit}.`],
        [`Plan B has ${fee} of ${fb} dollars and charges ${rb} dollars per ${unit}.`, `Plan B costs ${rb} dollars for each ${unit} plus ${fee} of ${fb} dollars.`, `Under Plan B, ${fee} of ${fb} dollars is paid and each ${unit} costs ${rb} dollars.`, `Plan B is priced with ${fee} of ${fb} dollars and ${rb} dollars for every ${unit}.`],
        ["A customer plans to compare the two plans.", "The total cost under each plan depends on the number of whole " + unit + "s.", "Only whole numbers of " + unit + "s can be purchased.", "A customer will choose whichever plan costs less.", "The customer wants to pick the cheaper plan.", "The price of each plan grows with the number of " + unit + "s."],
      ]);
      return finish(rng, {
        stimulus, question: spin(rng, `[[What is the least whole number of ${unit}s for which Plan B costs less than Plan A?|For what least whole number of ${unit}s is Plan B cheaper than Plan A?|Plan B is less expensive than Plan A starting at how many ${unit}s?|What is the smallest number of ${unit}s for which choosing Plan B saves money?|Beginning with how many ${unit}s does Plan B cost strictly less than Plan A?]]`), correct: ans,
        wrongs: [W(ans - 1, "condition_ignored", "두 요금이 같아지는 값을 'B 가 더 싸다'의 답으로 골랐다."), W(ans + 1, "other", "임계점에서 하나 더 올렸다."), W(Math.ceil(fb / rb), "step_missing", "고정비 차이가 아니라 B 의 고정비만 단위비용으로 나눴다."), W(Math.floor(fb / ra), "step_missing", "A 의 고정비를 고려하지 않았다."), W(diff, "formula_misuse", "고정비 차이를 답으로 골랐다.")],
        verificationJs: withParams({ fa, ra, fb, rb }, "for(let n=0;n<=2000;n++) if(P.fb+P.rb*n<P.fa+P.ra*n) return n;\nthrow new Error('없음');"),
        trace: [
          T(`Plan A 의 비용은 $${fa} + ${ra}n$ 이다.`, "Write Plan A's cost."),
          T(`Plan B 의 비용은 $${fb} + ${rb}n$ 이다.`, "Write Plan B's cost."),
          T(`B 가 더 싸려면 $${fb} + ${rb}n < ${fa} + ${ra}n$ 이어야 한다.`, "Write the comparison."),
          T(`n 항을 모으면 $${diff} < ${rate}n$ 이다.`, "Collect n terms."),
          T(`$n > ${(diff / rate).toFixed(2).replace(/\.?0+$/, "")}$ 이다.`, "Divide."),
          T(`경계 ${Number.isInteger(diff / rate) ? "(정수이므로 포함되지 않는다)" : ""} 다음 정수는 ${ans} 이다.`, "Take the next whole number."),
        ],
        variant: "plan_crossover",
      });
    },
  },
  {
    id: "li.table_verification.repr_shift", skill: SKILL, kind: "table_verification", operator: "repr_shift",
    structure: "'y 는 x 의 m 배보다 b 크다(작다)' 같은 문장을 부등식 y ◇ mx + b 로 번역하고 나열된 순서쌍 중 만족하는 것의 개수를 센다",
    extraThinking: "문장 서술을 부등식 기호와 방향으로 정확히 번역(m 배보다 b 큰 → mx + b)하고 경계 위 점을 포함 여부로 판정 — medium 은 식이 주어진 상태에서 검증",
    concepts: ["문장→부등식 번역", "순서쌍 대입 검증", "경계 포함 여부"], mediumSteps: 4,
    generate(rng) {
      const m = rng.pick([2, 3, 4, -1, -2, -3]), b = rng.nz(-8, 8), op = rng.pick(OPS), xs = rng.shuffle([-3, -2, -1, 0, 1, 2, 3, 4]).slice(0, 6).sort((x, y) => x - y);
      const pts: [number, number][] = xs.map((x) => [x, m * x + b + rng.pick([-3, -2, -1, 0, 0, 1, 2, 3])]);
      const cnt = pts.filter(([x, y]) => holds(y, op, m * x + b)).length; if (cnt < 2 || cnt > 4) throw new GenFail("x");
      const times = Math.abs(m) === 1 ? "" : m < 0 ? `${-m} times the opposite of` : `${m} times`;
      const bw = b === 0 ? "" : b > 0 ? `${b} more than ` : `${-b} less than `;
      const rel = op === "<" ? "less than" : op === "\\le" ? "at most" : op === ">" ? "greater than" : "at least";
      if (b === 0 || m === 1 || m === -1) throw new GenFail("x");
      const mw = m < 0 ? `${-m} times the opposite of the x-value` : `${m} times the x-value`;
      const stmt = b > 0 ? `${bw}${mw}` : `${bw}${mw}`;
      const stimulus = `${rng.pick(["In the xy-plane,", "For the ordered pairs below,", "Consider the statement below about ordered pairs (x, y):", "A statement about a point (x, y) is given."])} ${rng.pick([`the y-value is ${rel} ${stmt}.`, `y is ${rel} ${stmt}.`, `the y-coordinate must be ${rel} ${stmt}.`])} ${rng.pick(["The ordered pairs are", "The pairs to check are", "Here are the pairs"])} ${pairList(pts)}.`;
      return finish(rng, {
        stimulus, question: spin(rng, "[[For how many of the ordered pairs is the statement true?|How many of the listed pairs make the statement true?|How many of the ordered pairs satisfy the statement?]]"), correct: cnt,
        wrongs: [W(pts.filter(([x, y]) => holds(y, op === "<" ? "\\le" : op === "\\le" ? "<" : op === ">" ? "\\ge" : ">", m * x + b)).length, "condition_ignored", "경계 위의 점을 포함하는지 여부를 반대로 판정했다."), W(pts.filter(([x, y]) => holds(y, op, m * x - b)).length, "sign_error", "'b 만큼 크다/작다'의 부호를 반대로 번역했다."), W(pts.length - cnt, "relation_distortion", "부등호 방향을 반대로 읽어 만족하지 않는 쌍을 셌다."), W(cnt + 1, "other", "한 쌍을 잘못 판정했다."), W(cnt - 1, "other", "한 쌍을 잘못 판정했다.")],
        verificationJs: withParams({ m, b, op: jsOp(op), xs, ys: pts.map((p) => p[1]) }, H_JS + "let c=0;\nfor(let i=0;i<P.xs.length;i++) if(h(P.ys[i],P.op,P.m*P.xs[i]+P.b)) c++;\nreturn c;"),
        trace: [
          T(`문장을 식으로 번역한다: $y ${op} ${lin(m, b, "x")}$.`, "Translate the sentence."),
          ...pts.map(([x, y]) => T(`(${x}, ${y}): 우변 ${m * x + b}, 좌변 ${y} → ${holds(y, op, m * x + b) ? "참" : "거짓"}.`, `Test the pair (${x}, ${y}).`)),
          T(`참인 쌍은 ${cnt}개이다.`, "Count the true cases."),
        ],
        variant: "sentence_to_inequality",
      });
    },
  },
  {
    id: "li.table_verification.constraint_select", skill: SKILL, kind: "table_verification", operator: "constraint_select",
    structure: "세 순서쌍이 모두 y < kx + b 의 해이도록 하는 정수 k 의 개수: 점마다 k 에 대한 부등식(x 의 부호에 따라 방향이 바뀜)을 만들어 교집합을 센다",
    extraThinking: "x 가 양수인 점과 음수인 점에서 k 에 대한 부등식의 방향이 달라지는 것을 처리해 모든 점을 만족하는 k 의 구간을 만들고 정수를 선택 — medium 은 주어진 식에 점을 대입해 검증",
    concepts: ["점 대입 검증", "미지 계수의 부등식", "부호에 따른 방향 반전"], mediumSteps: 4,
    generate(rng) {
      const b = rng.nz(-6, 6), k0 = rng.int(-3, 4);
      const xs = rng.shuffle([-4, -3, -2, -1, 1, 2, 3, 4]).slice(0, 3); if (!(xs.some((x) => x > 0) && xs.some((x) => x < 0))) throw new GenFail("x");
      const pts: [number, number][] = xs.map((x) => [x, k0 * x + b - rng.int(1, 4) * (x > 0 ? 1 : -1) * 0 + rng.int(-4, 4)]);
      const op: Op = rng.pick(["<", ">"]); let c = 0; const ks: number[] = []; for (let k = -40; k <= 40; k++) if (pts.every(([x, y]) => holds(y, op, k * x + b))) { c++; ks.push(k); }
      if (c < 2 || c > 8) throw new GenFail("x");
      const stimulus = `${rng.pick(["The ordered pairs below are all solutions to the inequality", "Each of the ordered pairs listed below satisfies the inequality", "The three ordered pairs below make the inequality true", "Every ordered pair in the list below is a solution of the inequality", "A table of three points is given, and each point satisfies the inequality"])} ${M(`y ${op} kx ${pm(b)}`)}${rng.pick([", where k is an integer", ", and k is an integer constant", " for an integer k", ", in which k is a whole-number constant", ", where the constant k must be an integer"])}. ${rng.pick(["The pairs are", "They are", "The list is", "The points are", "The table lists"])} ${pairList(pts)}.`;
      return finish(rng, {
        stimulus, question: spin(rng, "[[How many different values of k are possible?|How many integer values of k make all three pairs solutions?|For how many integers k is this true?|How many whole-number values of k work for every pair?|How many integers k could make all three statements true at once?|What is the number of possible values of k?]]"), correct: c,
        wrongs: [W(c + 1, "condition_ignored", "경계 정수를 하나 더 셌다."), W(c - 1, "condition_ignored", "경계 정수를 하나 빠뜨렸다."), W(c + 2, "other", "구간을 넓게 잡았다."), W(Math.max(c - 2, 0), "other", "구간을 좁게 잡았다."), W(ks.length ? ks[ks.length - 1] - ks[0] : 0, "formula_misuse", "끝값의 차를 개수로 답했다.")],
        verificationJs: withParams({ b, op: jsOp(op), xs, ys: pts.map((p) => p[1]) }, H_JS + "let c=0;\nfor(let k=-400;k<=400;k++){ let ok=true; for(let i=0;i<P.xs.length;i++) if(!h(P.ys[i],P.op,k*P.xs[i]+P.b)){ok=false;break;} if(ok) c++; }\nreturn c;"),
        trace: [
          ...pts.map(([x, y]) => T(`(${x}, ${y}) 를 대입하면 $${y} ${op} ${x}k ${pm(b)}$ 이고 k 에 대해 풀면 ${x > 0 ? "부등호 방향이 그대로" : "음수로 나누므로 방향이 반대로"} ${(op === "<") === (x > 0) ? "k 의 하한" : "k 의 상한"}을 준다.`, `Substitute (${x}, ${y}) and solve for k.`)),
          T(`세 조건의 공통 범위에 속하는 정수 k 는 ${ks.join(", ")} 이다.`, "Intersect the conditions."),
          T(`개수는 ${c} 이다.`, "Count."),
        ],
        variant: "unknown_slope_all_points",
      });
    },
  },
  {
    id: "li.table_verification.inverse", skill: SKILL, kind: "table_verification", operator: "inverse",
    structure: "경계선이 지나는 두 점으로 부등식 y ◇ 경계선 을 복원한 뒤 x = p 에서 해가 아닌 정수 y 중 가장 큰(작은) 값을 구함",
    extraThinking: "두 점에서 기울기와 직선을 역으로 복원해 부등식 영역을 재구성하고, 경계값이 정수가 아닐 때 해가 아닌 정수의 끝값을 선택 — medium 은 주어진 부등식으로 검증",
    concepts: ["두 점으로 직선 복원", "부등식 영역 해석", "정수 끝값"], mediumSteps: 4,
    generate(rng) {
      const num = rng.pick([1, 2, 3, 5]) * (rng.chance(0.5) ? 1 : -1), den = rng.pick([2, 3]), dx = den * rng.int(1, 2);
      const X1 = rng.int(-4, 1), X2 = X1 + dx, Y1 = rng.int(-6, 6), Y2 = Y1 + num * (dx / den), p = rng.int(X2 + 1, X2 + 4), op: Op = rng.pick([">", "<", "\\ge", "\\le"]);
      const run = X2 - X1, rise = Y2 - Y1, numer = Y1 * run + rise * (p - X1), y0 = numer / run;
      const cand: number[] = []; for (let y = -80; y <= 80; y++) if (!holds(y * run, op, numer)) cand.push(y);
      const above = op === ">" || op === "\\ge", solid = op === "\\ge" || op === "\\le";
      const ans = above ? Math.max(...cand.filter((y) => y < 50)) : Math.min(...cand.filter((y) => y > -50));
      if (Number.isInteger(y0) || Math.abs(ans) > 40 || Math.abs(Y2) > 30) throw new GenFail("x");
      const stimulus = `${rng.pick(["The solution set of an inequality in the xy-plane is the region", "The graph of an inequality in the xy-plane is the region", "An inequality in the xy-plane is satisfied exactly by the points in the region", "In the xy-plane, the points that satisfy a certain linear inequality form the region", "Every solution of a linear inequality in the xy-plane lies in the region"])} ${above ? rng.pick(["above", "on the upper side of"]) : rng.pick(["below", "on the lower side of"])} its boundary line, and the boundary line ${solid ? rng.pick(["is included", "belongs to the solution set"]) : rng.pick(["is not included", "does not belong to the solution set"])}. ${rng.pick(["The boundary line passes through the points", "That line goes through the points", "The line that bounds the region passes through", "The boundary is the line through the points", "Two points on the boundary line are"])} ${M(`(${X1}, ${Y1})`)} and ${M(`(${X2}, ${Y2})`)}.`;
      return finish(rng, {
        stimulus, question: spin(rng, above ? `[[What is the greatest integer $y$ such that $(${p}, y)$ is NOT in the solution set?|For $x = ${p}$, what is the greatest integer value of $y$ whose point is not a solution?|What is the largest integer $y$ for which the point $(${p}, y)$ is not a solution?|Among points of the form $(${p}, y)$ with integer $y$ that are not solutions, what is the greatest $y$?|On the vertical line $x = ${p}$, what is the largest integer $y$ that is not a solution?]]` : `[[What is the least integer $y$ such that $(${p}, y)$ is NOT in the solution set?|For $x = ${p}$, what is the least integer value of $y$ whose point is not a solution?|What is the smallest integer $y$ for which the point $(${p}, y)$ is not a solution?|Among points of the form $(${p}, y)$ with integer $y$ that are not solutions, what is the least $y$?|On the vertical line $x = ${p}$, what is the smallest integer $y$ that is not a solution?]]`), correct: ans,
        wrongs: [W(above ? Math.floor(y0) + 1 : Math.ceil(y0) - 1, "condition_ignored", "경계값 근처에서 정수의 방향을 반대로 골랐다."), W(Math.round(y0), "step_missing", "경계값을 반올림해 답으로 골랐다."), W(Y2 + (p - X2), "formula_misuse", "기울기를 1 로 잘못 가정했다."), W(Math.trunc(y0), "other", "정수 부분만 취했다."), ...near(ans)],
        verificationJs: withParams({ X1, Y1, X2, Y2, p, op: jsOp(op), above: above ? 1 : 0 }, H_JS + "const run=P.X2-P.X1, rise=P.Y2-P.Y1; const numer=P.Y1*run+rise*(P.p-P.X1);\nconst c=[];\nfor(let y=-100;y<=100;y++) if(!h(y*run,P.op,numer)) c.push(y);\nif(!c.length) throw new Error('없음');\nreturn P.above? Math.max(...c.filter(y=>y<60)) : Math.min(...c.filter(y=>y>-60));"),
        trace: [
          T(`두 점으로 기울기를 구하면 ${rise}/${run} 이다.`, "Find the slope from the two points."),
          T(`경계선은 점 (${X1}, ${Y1}) 을 지나므로 $y = ${Y1} + \\frac{${rise}}{${run}}(x ${X1 < 0 ? "+" : "-"} ${Math.abs(X1)})$ 이다.`, "Write the boundary line."),
          T(`영역이 ${above ? "위쪽" : "아래쪽"}이고 경계가 ${solid ? "포함" : "제외"}되므로 해 영역은 y ${above ? "가 경계선보다 큰" : "가 경계선보다 작은"} 점들이다${solid ? "(경계 포함)" : ""}.`, "Restore the solution region."),
          T(`x = ${p} 에서 경계선의 y 값은 ${Number(y0.toFixed(3))} 이다.`, "Evaluate the boundary at x = p."),
          T(`해가 아닌 y 는 ${above ? "경계값 이하" : "경계값 이상"}${solid ? "에서 경계값 자체는 해이므로 제외" : "(경계값 포함)"}이다.`, "Find the non-solutions."),
          T(`${above ? "가장 큰" : "가장 작은"} 정수는 ${ans} 이다.`, "Choose the extreme integer."),
        ],
        variant: "rebuild_from_boundary_points",
      });
    },
  },
  {
    id: "li.table_verification.compare_scenarios", skill: SKILL, kind: "table_verification", operator: "compare_scenarios",
    structure: "두 부등식 y ◇ m1 x + b1, y ◇ m2 x + b2 를 나열된 점마다 비교해 '첫째는 만족하지만 둘째는 만족하지 않는' 점의 개수를 센다",
    extraThinking: "두 조건을 각 점에 독립적으로 적용한 뒤 '하나는 참, 다른 하나는 거짓'이라는 논리 조합을 선택 — medium 은 하나의 부등식 검증",
    concepts: ["점 대입 검증", "두 조건의 논리 조합", "경계 포함 여부"], mediumSteps: 4,
    generate(rng) {
      const m1 = rng.nz(-2, 3), b1 = rng.int(-5, 5), m2 = rng.nz(-2, 3), b2 = rng.int(-5, 5), o1: Op = rng.pick(OPS), o2: Op = rng.pick(OPS);
      if (m1 === m2 && b1 === b2) throw new GenFail("x");
      const xs = rng.shuffle([-2, -1, 0, 1, 2, 3, 4]).slice(0, 6).sort((a, b) => a - b);
      const pts: [number, number][] = xs.map((x) => [x, Math.round((m1 * x + b1 + m2 * x + b2) / 2) + rng.int(-3, 3)]);
      const c = pts.filter(([x, y]) => holds(y, o1, m1 * x + b1) && !holds(y, o2, m2 * x + b2)).length; if (c < 1 || c > 4) throw new GenFail("x");
      const nb = pts.filter(([x, y]) => holds(y, o1, m1 * x + b1) && holds(y, o2, m2 * x + b2)).length;
      const stimulus = `${rng.pick(["Consider the two inequalities below.", "Two inequalities are given below.", "Inequality 1 and inequality 2 are given below.", "The first and second inequalities are listed below.", "A pair of inequalities, called the first and the second, is written below."])}\n\n${M(`y ${o1} ${mxb(m1, b1)}`)}\n${M(`y ${o2} ${mxb(m2, b2)}`)}\n\n${rng.pick(["The ordered pairs are", "Here are six ordered pairs:", "The following pairs are given:", "A table lists the pairs", "Test these ordered pairs:"])} ${pairList(pts)}.`;
      return finish(rng, {
        stimulus, question: spin(rng, "[[How many of the ordered pairs satisfy the first inequality but do not satisfy the second inequality?|How many of the pairs are solutions to the first inequality and not solutions to the second?|For how many pairs is the first inequality true and the second false?|How many pairs make the first inequality true while making the second one false?|Which count is correct for the pairs that are solutions of the first inequality only?]]"), correct: c,
        wrongs: [W(nb, "relation_distortion", "두 부등식을 모두 만족하는 쌍을 셌다."), W(pts.filter(([x, y]) => holds(y, o2, m2 * x + b2) && !holds(y, o1, m1 * x + b1)).length, "relation_distortion", "첫째와 둘째의 역할을 바꿔 셌다."), W(pts.filter(([x, y]) => holds(y, o1, m1 * x + b1)).length, "step_missing", "둘째 부등식의 조건을 확인하지 않았다."), W(c + 1, "other", "한 쌍을 잘못 판정했다."), W(Math.max(c - 1, 0), "other", "한 쌍을 잘못 판정했다.")],
        verificationJs: withParams({ m1, b1, m2, b2, o1: jsOp(o1), o2: jsOp(o2), xs, ys: pts.map((p) => p[1]) }, H_JS + "let c=0;\nfor(let i=0;i<P.xs.length;i++){ const x=P.xs[i], y=P.ys[i]; if(h(y,P.o1,P.m1*x+P.b1)&&!h(y,P.o2,P.m2*x+P.b2)) c++; }\nreturn c;"),
        trace: [
          ...pts.map(([x, y]) => T(`(${x}, ${y}): 첫째 ${holds(y, o1, m1 * x + b1) ? "참" : "거짓"}(${y} vs ${m1 * x + b1}), 둘째 ${holds(y, o2, m2 * x + b2) ? "참" : "거짓"}(${y} vs ${m2 * x + b2}).`, `Test the pair (${x}, ${y}) in both.`)),
          T(`첫째만 참이고 둘째는 거짓인 쌍은 ${c}개이다.`, "Count the pairs that are true for the first only."),
        ],
        variant: "first_but_not_second",
      });
    },
  },
];
