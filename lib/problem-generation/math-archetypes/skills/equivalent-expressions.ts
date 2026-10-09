// equivalent_expressions hard 원형 8개(세부 패턴 polynomial_distribution·rational_equivalence × 연산자 4종).
import { GenFail, type Archetype } from "../types";
import { finish, lin, M, pl, pn, poly, shifted, withParams } from "../text";
import { gcd } from "../rng";

const SKILL = "equivalent_expressions";
const VARS = ["x", "t", "n", "z"] as const;
const INTRO = ["Consider the expression shown.", "An expression is given below.", "The expression below is written in terms of the variable VAR.", "Let E be the expression below, where VAR can be any real number."];
const Q_EQUIV = ["Which of the following is equivalent to the expression shown?", "Which of the following is equal to the given expression for all values of VAR?", "Which of the following is the expanded and simplified form of the given expression?", "Which option must be equal to the expression for every real value of VAR?"];
const sub = (s: string, v: string) => s.replace(/VAR/g, v);

export const EE_ARCHETYPES: Archetype[] = [
  {
    id: "ee.polynomial_distribution.compose_kind", skill: SKILL, kind: "polynomial_distribution", operator: "compose_kind",
    structure: "두 이항식의 제곱을 각각 전개한 뒤 뺄셈 부호를 분배해 동류항 정리(또는 '큰 정사각형에서 작은 정사각형을 뺀 넓이' 모델링)",
    extraThinking: "제곱 전개(중간항)와 뺄셈 전체에 대한 부호 분배, 동류항 결합 — medium 은 a(x+b)+c(x+d) 선형 분배 한 번",
    concepts: ["이항식 제곱 전개", "뺄셈의 부호 분배", "동류항 정리"], mediumSteps: 3,
    generate(rng) {
      let a = 0, b = 0, c = 0, d = 0;
      do { a = rng.nz(-5, 5); b = rng.nz(-6, 6); c = rng.nz(-5, 5); d = rng.nz(-6, 6); } while (a * a === c * c || (a * b - c * d) === 0);
      const v = rng.pick(VARS); const co = [a * a - c * c, 2 * (a * b - c * d), b * b - d * d];
      const ctx = rng.pick([null, ["square patio", "square pool", "meters"], ["square poster", "square photo", "inches"], ["square lawn", "square flower bed", "feet"], ["square tile", "square cutout", "centimeters"]] as const);
      const expr = `(${lin(a, b, v)})^2 - (${lin(c, d, v)})^2`;
      const stimulus = ctx
        ? `A ${ctx[0]} has side length ${M(lin(Math.abs(a) === a ? a : -a, Math.abs(a) === a ? b : -b, v))} ${ctx[2]}, and a ${ctx[1]} with side length ${M(lin(c > 0 ? c : -c, c > 0 ? d : -d, v))} ${ctx[2]} is placed inside it, where ${v} is a positive number large enough for this to make sense.`
        : `${sub(rng.pick(INTRO), v)}\n\n${M(expr)}`;
      const areaCtx = ctx !== null;
      // 문맥형은 변 길이 부호를 양수 계수로 정규화했으므로 계수를 다시 계산한다.
      const aa = areaCtx && a < 0 ? -a : a, bb = areaCtx && a < 0 ? -b : b, cc = areaCtx && c < 0 ? -c : c, dd = areaCtx && c < 0 ? -d : d;
      const co2 = [aa * aa - cc * cc, 2 * (aa * bb - cc * dd), bb * bb - dd * dd];
      const C = areaCtx ? co2 : co;
      const A_ = areaCtx ? aa : a, B_ = areaCtx ? bb : b, C_ = areaCtx ? cc : c, D_ = areaCtx ? dd : d;
      const question = areaCtx ? `Which expression gives the area of the ${ctx![0].replace("square ", "")} not covered by the ${ctx![1].replace("square ", "")}, in square ${ctx![2]}?` : sub(rng.pick(Q_EQUIV), v);
      return finish(rng, {
        stimulus, question, evalAt: { [v]: 3 },
        correctText: M(poly(C, v)),
        wrongTexts: [
          { text: M(poly([C[0], 0, C[2]], v)), kind: "step_missing", reason: "이항식의 제곱을 전개할 때 중간항(2ab)을 빠뜨렸다." },
          { text: M(poly([C[0], C[1], B_ * B_ + D_ * D_], v)), kind: "sign_error", reason: "두 번째 제곱을 빼면서 상수항 d^2 의 부호를 바꾸지 않았다." },
          { text: M(poly([(A_ - C_) ** 2, 2 * (A_ - C_) * (B_ - D_), (B_ - D_) ** 2], v)), kind: "formula_misuse", reason: "제곱의 차를 (두 이항식의 차)^2 로 계산했다." },
          { text: M(poly([C[0], 2 * (A_ * B_ + C_ * D_), C[2]], v)), kind: "sign_error", reason: "두 번째 제곱의 중간항을 뺄 때 부호를 바꾸지 않았다." },
        ],
        verificationJs: withParams({ a: A_, b: B_, c: C_, d: D_, x: 3 }, "return (P.a*P.x+P.b)**2 - (P.c*P.x+P.d)**2;"),
        trace: [
          [`첫 번째 제곱을 전개한다: $(${lin(A_, B_, v)})^2 = ${poly([A_ * A_, 2 * A_ * B_, B_ * B_], v)}$.`, "Expand the first square."],
          [`두 번째 제곱을 전개한다: $(${lin(C_, D_, v)})^2 = ${poly([C_ * C_, 2 * C_ * D_, D_ * D_], v)}$.`, "Expand the second square."],
          ["두 번째 전개식 전체에 뺄셈을 분배해 모든 항의 부호를 바꾼다.", "Distribute the subtraction over every term of the second expansion."],
          [`$${v}^2$ 항: ${A_ * A_} - ${C_ * C_} = ${C[0]}, $${v}$ 항: ${2 * A_ * B_} - ${pn(2 * C_ * D_)} = ${C[1]}, 상수항: ${B_ * B_} - ${D_ * D_} = ${C[2]} 이다.`, "Combine like terms."],
          [`결과는 $${poly(C, v)}$ 이다.`, "Write the simplified result."],
        ],
        variant: areaCtx ? "area_context" : "abstract",
      });
    },
  },
  {
    id: "ee.polynomial_distribution.inverse", skill: SKILL, kind: "polynomial_distribution", operator: "inverse",
    structure: "곱 (ax+b)(cx+k) 를 전개해 일차항 계수 조건에서 미지 상수 k 를 구하고, 다시 상수항 C 를 계산",
    extraThinking: "결과식의 계수를 주고 입력 상수를 역추적(계수 비교 → k → 상수항) — medium 은 주어진 식을 그대로 전개만 함",
    concepts: ["다항식 곱 전개", "계수 비교(항등식)", "미지 상수 역산"], mediumSteps: 3,
    generate(rng) {
      const a = rng.nz(-4, 5), b = rng.nz(-6, 6), c = rng.nz(-4, 5), k = rng.nz(-7, 7);
      const A = a * c, B = a * k + b * c, C = b * k;
      if (A === 0 || B === 0 || C === B || k === C) throw new GenFail("x");
      const v = rng.pick(VARS); const letter = rng.pick(["C", "q", "D"]);
      const stimulus = `${rng.pick(["In the equation shown, k is a constant and the equation is true for all values of VAR.", "The equation below is true for all real values of VAR, where k is a constant.", "For the constant k, the following equation holds for every value of VAR.", "A student writes the identity below, where k is an unknown constant and VAR is any real number.", "Suppose k is a constant for which the equation below is an identity in VAR.", "The two sides of the equation below are equal for every value of VAR, and k is a constant."]).replace(/VAR/g, v)}\n\n${M(`(${lin(a, b, v)})(${lin(c, 0, v)} + k) = ${poly([A, B, 0], v)} + ${letter}`)}`;
      return finish(rng, {
        stimulus, question: rng.pick([`What is the value of ${letter}?`, `Find the value of ${letter}.`, `If the equation is an identity, what is ${letter} equal to?`, `What must ${letter} equal for the equation to hold for all ${v}?`, `The constant ${letter} is equal to what number?`]),
        correct: C,
        wrongs: [
          { v: k, kind: "step_missing", reason: "상수 k 만 구하고 상수항 b·k 를 계산하지 않았다." },
          { v: -C, kind: "sign_error", reason: "상수항의 부호를 반대로 적었다." },
          { v: b + k, kind: "formula_misuse", reason: "상수항을 b 와 k 의 곱이 아니라 합으로 계산했다." },
          { v: a * k, kind: "formula_misuse", reason: "상수항 대신 a·k(일차항의 일부)를 답으로 골랐다." },
          { v: B - b * c, kind: "step_missing", reason: "일차항 계수에서 b·c 만 빼고 a 로 나누지 않았다." },
        ],
        verificationJs: withParams({ a, b, c, B }, "const P1=k=>(P.a*1+P.b)*(P.c*1+k), Pm1=k=>(P.a*-1+P.b)*(P.c*-1+k);\nconst hits=[];\nfor(let k=-80;k<=80;k++){ if((P1(k)-Pm1(k))/2===P.B) hits.push(P.b*k); }\nif(hits.length!==1) throw new Error('k 가 유일하지 않음');\nreturn hits[0];"),
        trace: [
          [`곱을 전개하면 일차항 계수는 ${a}·k + ${pn(b)}·${pn(c)} = ${a}k + ${pn(b * c)} 이다.`, "Expand the product and collect the coefficient of the linear term."],
          [`식의 일차항 계수 ${B} 와 비교하면 ${a}k + ${pn(b * c)} = ${B} 이다.`, "Equate it to the given linear coefficient."],
          [`이 식을 풀면 k = ${k} 이다.`, "Solve for k."],
          [`상수항은 (${b})(${pn(k)}) = ${C} 이다.`, "The constant term is b times k."],
          [`이차항 계수 ${a}·${pn(c)} = ${A} 가 주어진 식과 같은지 확인한다.`, "Check the quadratic coefficient."],
        ],
        variant: "coefficient_inverse",
      });
    },
  },
  {
    id: "ee.polynomial_distribution.constraint_select", skill: SKILL, kind: "polynomial_distribution", operator: "constraint_select",
    structure: "이차식을 (mx+n)(px+q) 로 인수분해하되 m>p>0 정수 제약으로 계수 쌍을 선택하고 n+q 를 구함",
    extraThinking: "상수항의 인수쌍과 x^2 계수의 인수쌍을 시도해 중간항으로 선별하는 제약 탐색 — medium 은 전개 방향(분배) 한 번",
    concepts: ["이차식 인수분해(선행계수≠1)", "인수쌍 탐색", "제약 조건 선택"], mediumSteps: 3,
    generate(rng) {
      const m = rng.int(2, 6), p = rng.int(1, m - 1), n = rng.nz(-7, 7), q = rng.nz(-7, 7);
      const A = m * p, B = m * q + n * p, C = n * q;
      if (gcd(gcd(A, B), C) !== 1 || B === 0 || n === q) throw new GenFail("x");
      const v = rng.pick(VARS);
      const ctx = rng.pick([null, null, "banner", "garden bed", "screen", "tabletop", "flag", "floor mat", "window", "stage"] as const);
      const expr = poly([A, B, C], v);
      const stimulus = ctx
        ? rng.pick([`The area of a rectangular ${ctx}, in square units, is given by ${M(expr)}. Its length and width are each of the form ${M(`m${v} + n`)}, with integer coefficients, and the length's ${v}-coefficient is larger than the width's ${v}-coefficient, which is positive.`, `A rectangular ${ctx} has area ${M(expr)} square units. Both side lengths are linear in ${v} with integer coefficients, and the longer side has the larger positive ${v}-coefficient.`])
        : rng.pick([`The expression ${M(expr)} can be written as ${M(`(m${v} + n)(p${v} + q)`)}, where m, n, p, and q are integers and m > p > 0.`, `For integers m, n, p, and q with m > p > 0, the following equation is true for all ${v}: ${M(`${expr} = (m${v} + n)(p${v} + q)`)}.`, `Suppose ${M(expr)} is factored completely over the integers as ${M(`(m${v} + n)(p${v} + q)`)}, choosing m > p > 0.`, `The polynomial ${M(expr)} has two linear factors with integer coefficients, written ${M(`m${v} + n`)} and ${M(`p${v} + q`)}, where m is greater than p and p is positive.`]);
      const pairs: number[] = []; for (let i = 1; i <= Math.abs(C); i++) if (C % i === 0) for (const s of [1, -1]) { pairs.push(s * i + (C / (s * i))); }
      return finish(rng, {
        stimulus, question: ctx ? rng.pick(["What is the sum of the constant terms of the length and the width?", "If the two side lengths are added, what is the constant term of the sum?", "What is the total of the constant terms in the two dimensions?"]) : rng.pick(["What is the value of n + q?", "What is the sum of n and q?", "Find n + q.", "If n and q are the constant terms of the two factors, what is their sum?"]),
        correct: n + q,
        wrongs: [
          { v: -(n + q), kind: "sign_error", reason: "인수의 부호 조합을 반대로 택해 n+q 의 부호가 뒤집혔다." },
          ...pairs.map((s) => ({ v: s, kind: "step_missing" as const, reason: "상수항 C 의 인수쌍만 맞추고 중간항(일차항 계수)을 확인하지 않았다." })),
          { v: m + p, kind: "formula_misuse", reason: "상수항이 아니라 x 계수의 합 m+p 를 구했다." },
          { v: C, kind: "formula_misuse", reason: "n+q 대신 곱 n·q(상수항)를 답으로 골랐다." },
        ],
        verificationJs: withParams({ A, B, C }, "const sums=new Set();\nfor(let m=1;m<=P.A;m++){ if(P.A%m) continue; const p=P.A/m; if(!(m>p&&p>0)) continue;\n for(let n=-Math.abs(P.C);n<=Math.abs(P.C);n++){ if(n===0||P.C%n) continue; const q=P.C/n; if(m*q+n*p===P.B) sums.add(n+q);} }\nif(sums.size!==1) throw new Error('인수분해가 유일하지 않음');\nreturn [...sums][0];"),
        trace: [
          [`$${m * p}$ 의 인수쌍 중 m > p > 0 인 후보를 나열한다.`, "List the factor pairs of the leading coefficient with m > p > 0."],
          [`상수항 ${C} 의 정수 인수쌍(부호 포함)을 나열한다.`, "List integer factor pairs of the constant term, with signs."],
          ["각 조합에서 중간항 m·q + n·p 를 계산해 일차항 계수와 비교한다.", "For each combination compute mq + np and compare with the linear coefficient."],
          [`조건을 만족하는 조합은 (${m}${v} ${n >= 0 ? "+" : "-"} ${Math.abs(n)})(${p === 1 ? "" : p}${v} ${q >= 0 ? "+" : "-"} ${Math.abs(q)}) 하나뿐이다.`, "Exactly one combination works."],
          [`n + q = ${n} + ${pn(q)} = ${n + q} 이다.`, "Add the constants."],
        ],
        variant: ctx ? "rectangle_context" : "abstract",
      });
    },
  },
  {
    id: "ee.polynomial_distribution.repr_shift", skill: SKILL, kind: "polynomial_distribution", operator: "repr_shift",
    structure: "문장·도형(직사각형 둘레에 폭 w 의 길/테두리)을 바깥·안쪽 넓이식으로 세워 전개·뺄셈 후 선지 선택",
    extraThinking: "문장→식 변환(바깥 변 = 안 변 + 2w)과 모서리 정사각형 4w² 포함 여부 판단 — medium 은 주어진 식의 전개",
    concepts: ["도형의 넓이 모델링", "이항식 곱 전개", "동류항 정리"], mediumSteps: 3,
    generate(rng) {
      const a = rng.int(1, 4), b = rng.int(2, 9), c = rng.int(1, 4), d = rng.int(2, 9), w = rng.int(1, 4);
      const v = rng.pick(VARS);
      const [thing, border, unit] = rng.pick([["rectangular garden", "a walking path", "meters"], ["rectangular painting", "a frame", "inches"], ["rectangular pool", "a tile deck", "feet"], ["rectangular rug", "a fringe border", "centimeters"], ["rectangular courtyard", "a stone walkway", "yards"], ["rectangular mirror", "a wooden trim", "inches"], ["rectangular field", "a running track", "meters"], ["rectangular tablecloth", "a lace edge", "centimeters"]] as const);
      const L = lin(a, b, v), W = lin(c, d, v);
      const correct = [0, 2 * w * (a + c), 2 * w * (b + d) + 4 * w * w];
      const cap = border.charAt(0).toUpperCase() + border.slice(1), bare = thing.replace("rectangular ", "");
      const stimulus = rng.pick([`A ${thing} has length ${M(L)} ${unit} and width ${M(W)} ${unit}. ${cap} of uniform width ${pl(w, unit)} surrounds the ${bare} on all four sides.`, `${cap} ${pl(w, unit)} wide is built around all four sides of a ${thing} that measures ${M(L)} ${unit} by ${M(W)} ${unit}.`, `The dimensions of a ${thing} are ${M(L)} ${unit} and ${M(W)} ${unit}. A uniform strip of ${pl(w, unit)} (${border}) is added along every edge of the ${bare}.`]);
      return finish(rng, {
        stimulus, question: rng.pick([`Which expression represents the area of the ${border.replace(/^an? /, "")}, in square ${unit}?`, `Which expression gives the area covered by the ${border.replace(/^an? /, "")}, in square ${unit}?`, `${cap} is shaded. Which expression is its area, in square ${unit}?`]), evalAt: { [v]: 3 },
        correctText: M(lin(correct[1], correct[2], v)),
        wrongTexts: [
          { text: M(lin(correct[1], 2 * w * (b + d), v)), kind: "step_missing", reason: `네 모서리의 ${w}×${w} 정사각형(4w²)을 빠뜨렸다.` },
          { text: M(lin(w * (a + c), w * (b + d) + w * w, v)), kind: "formula_misuse", reason: "길의 폭을 양쪽(2w)이 아니라 한쪽(w)만 더했다." },
          { text: M(poly([a * c, a * d + b * c + 2 * w * (a + c), b * d + 2 * w * (b + d) + 4 * w * w], v)), kind: "step_missing", reason: "바깥 넓이만 구하고 안쪽 넓이를 빼지 않았다." },
          { text: M(lin(correct[1], correct[2] - 8 * w * w, v)), kind: "sign_error", reason: "모서리 정사각형을 더하지 않고 빼서 상수항이 달라졌다." },
        ],
        verificationJs: withParams({ a, b, c, d, w, x: 3 }, "const L=P.a*P.x+P.b, W=P.c*P.x+P.d;\nreturn (L+2*P.w)*(W+2*P.w) - L*W;"),
        trace: [
          [`바깥 직사각형의 길이는 ${L} + 2·${w}, 너비는 ${W} + 2·${w} 이다.`, "The outer dimensions are each larger by twice the width."],
          [`바깥 넓이 = $(${lin(a, b + 2 * w, v)})(${lin(c, d + 2 * w, v)})$ 를 전개한다.`, "Expand the outer area."],
          [`안쪽 넓이 = $(${L})(${W})$ 를 전개한다.`, "Expand the inner area."],
          ["바깥 넓이에서 안쪽 넓이를 빼면 $" + v + "^2$ 항이 사라진다.", "Subtract: the quadratic terms cancel."],
          [`동류항을 정리하면 $${lin(correct[1], correct[2], v)}$ 이다.`, "Combine like terms."],
        ],
        variant: "border_area",
      });
    },
  },
  {
    id: "ee.rational_equivalence.inverse", skill: SKILL, kind: "rational_equivalence", operator: "inverse",
    structure: "분자 mx+n 이 주어진 유리식을 부분분수 A/(x−p)+B/(x+q) 로 분해해 미지의 A, B 를 구한 뒤 A−B 또는 A·B 를 계산",
    extraThinking: "공통분모를 '만드는' 방향이 아니라 분해 방향(미지수 A, B 역산): 양변에 분모를 곱하고 근을 대입하거나 계수 비교 — medium 은 공통분모로 결합",
    concepts: ["유리식 공통분모", "항등식 계수 비교", "부분분수 분해"], mediumSteps: 4,
    generate(rng) {
      const [LA, LB] = rng.pick([["A", "B"], ["P", "Q"], ["C", "D"]] as const);
      const p = rng.nz(-5, 5), q = rng.nz(-5, 5), A = rng.nz(-8, 8), B = rng.nz(-8, 8);
      if (p === -q || A === B || A + B === 0) throw new GenFail("x");
      const m = A + B, n = A * q - B * p; const v = rng.pick(VARS); const prod = rng.chance(0.5);
      const f1 = shifted(v, -p), f2 = shifted(v, q);
      const stimulus = `${rng.pick(["For all values of VAR other than the two values that make a denominator zero, the equation below is true, where <A> and <B> are constants.", "In the equation below, <A> and <B> are constants, and the equation holds for every real VAR except where a denominator is zero.", "A rational expression is split into two simpler fractions with constant numerators <A> and <B>, as written, for every VAR that keeps the denominators nonzero.", "The fraction on the left can be decomposed as written, where <A> and <B> are constants and VAR avoids the zeros of the denominators.", "Constants <A> and <B> make the following equation true whenever both sides are defined.", "To integrate a fraction, a student rewrites it as the sum below for constants <A> and <B>, valid wherever the denominators are nonzero."]).replace(/VAR/g, v).replace(/<A>/g, LA).replace(/<B>/g, LB)}\n\n${M(`\\frac{${lin(m, n, v)}}{(${f1})(${f2})} = \\frac{${LA}}{${f1}} + \\frac{${LB}}{${f2}}`)}`;
      return finish(rng, {
        stimulus, question: prod ? rng.pick([`What is the value of ${LA}${LB}?`, `What is the product of ${LA} and ${LB}?`, `Find the value of ${LA} times ${LB}.`]) : rng.pick([`What is the value of ${LA} - ${LB}?`, `What is the difference ${LA} - ${LB}?`, `Find the value of ${LA} minus ${LB}.`]),
        correct: prod ? A * B : A - B,
        wrongs: prod
          ? [{ v: A + B, kind: "formula_misuse", reason: "A·B 대신 합 A+B(= 분자의 x 계수)를 답으로 골랐다." }, { v: -A * B, kind: "sign_error", reason: "A 또는 B 의 부호를 잘못 구해 곱의 부호가 뒤집혔다." }, { v: A * q * B * p, kind: "formula_misuse", reason: "분자 계수(Aq, Bp)를 A, B 로 착각해 곱했다." }, { v: n, kind: "formula_misuse", reason: "분자의 상수항 n 을 답으로 골랐다." }, { v: A * A, kind: "step_missing", reason: "A 만 구하고 B 를 구하지 않았다." }]
          : [{ v: B - A, kind: "sign_error", reason: "A−B 대신 B−A 를 계산했다." }, { v: A + B, kind: "formula_misuse", reason: "A−B 대신 A+B 를 계산했다." }, { v: A, kind: "step_missing", reason: "A 만 구하고 B 를 빼지 않았다." }, { v: n - m, kind: "formula_misuse", reason: "분자의 계수 n−m 을 답으로 골랐다." }, { v: -A - B, kind: "sign_error", reason: "두 값의 부호를 모두 반대로 계산했다." }],
        verificationJs: withParams({ m, n, p, q, prod: prod ? 1 : 0 }, "const sols=[];\nfor(let A=-90;A<=90;A++) for(let B=-90;B<=90;B++){ let ok=true; for(const x of [7,-13,19]) { if(Math.abs(A*(x+P.q)+B*(x-P.p) - (P.m*x+P.n))>1e-9){ok=false;break;} } if(ok) sols.push([A,B]); }\nif(sols.length!==1) throw new Error('A,B 가 유일하지 않음');\nreturn P.prod? sols[0][0]*sols[0][1] : sols[0][0]-sols[0][1];",
        ),
        trace: [
          ["양변에 분모 $(" + f1 + ")(" + f2 + ")$ 를 곱해 분모를 없앤다.", "Multiply both sides by the common denominator."],
          [`$${lin(m, n, v)} = ${LA}(${f2}) + ${LB}(${f1})$ 를 얻는다.`, "This gives a polynomial identity."],
          [`${v} = ${p} 를 대입하면 좌변의 분자는 ${m * p + n}, 우변은 ${LA}(${p + q}) 이므로 ${LA} = ${A} 이다.`, "Substitute the zero of the first factor to isolate A."],
          [`${v} = ${-q} 를 대입하면 좌변의 분자는 ${-m * q + n}, 우변은 ${LB}(${-q - p}) 이므로 ${LB} = ${B} 이다.`, "Substitute the zero of the second factor to isolate B."],
          [`일차항 계수 ${LA} + ${LB} = ${m} 이 분자의 계수와 같은지 확인한다.`, "Check with the linear coefficient."],
          [prod ? `${LA}${LB} = ${A}·${pn(B)} = ${A * B} 이다.` : `${LA} − ${LB} = ${A} − ${pn(B)} = ${A - B} 이다.`, "Compute the requested value."],
        ],
        variant: prod ? "product" : "difference",
      });
    },
  },
  {
    id: "ee.rational_equivalence.compose_kind", skill: SKILL, kind: "rational_equivalence", operator: "compose_kind",
    structure: "분수 두 개의 합(차)의 역수인 복합분수를 통분·역수로 단순화해 동치 선지 선택",
    extraThinking: "복합분수 구조 인식: 안쪽 분수 통분 → 분자·분모 역전 → 약분 — medium 은 두 분수의 단순 합",
    concepts: ["복합분수 단순화", "통분", "역수"], mediumSteps: 4,
    generate(rng) {
      const p = rng.int(-3, 6); let q = rng.int(-3, 6); while (q === p) q = rng.int(-3, 6);
      const diff = rng.chance(0.4); const v = rng.pick(VARS);
      const a = shifted(v, p), b = shifted(v, q);
      const sumDen = lin(2, p + q, v); const dd = q - p;
      const correct = diff ? `\\frac{(${a})(${b})}{${dd}}` : `\\frac{(${a})(${b})}{${sumDen}}`;
      const expr = `\\frac{1}{\\frac{1}{${a}} ${diff ? "-" : "+"} \\frac{1}{${b}}}`;
      return finish(rng, {
        stimulus: `${sub(rng.pick(INTRO), v)}\n\n${M(expr)}`, question: sub(rng.pick(Q_EQUIV), v), evalAt: { [v]: 7 },
        correctText: M(correct),
        wrongTexts: diff ? [
          { text: M(`\\frac{${dd}}{(${a})(${b})}`), kind: "formula_misuse", reason: "안쪽 분수의 차만 구하고 전체 역수를 취하지 않았다." },
          { text: M(`\\frac{(${a})(${b})}{${-dd}}`), kind: "sign_error", reason: "통분한 분자 (x+q)-(x+p) 의 순서를 바꿔 부호를 잘못 잡았다." },
          { text: M(`(${a}) - (${b})`), kind: "formula_misuse", reason: "역수의 차를 차의 역수처럼 계산했다." },
          { text: M(`\\frac{(${a})(${b})}{${lin(2, p + q, v)}}`), kind: "formula_misuse", reason: "뺄셈을 덧셈으로 잘못 통분했다." },
        ] : [
          { text: M(`\\frac{${sumDen}}{(${a})(${b})}`), kind: "formula_misuse", reason: "안쪽 합만 구하고 전체 역수를 취하지 않았다." },
          { text: M(`\\frac{${sumDen}}{2}`), kind: "formula_misuse", reason: "1/a + 1/b 를 2/(a+b) 로 계산한 뒤 역수를 취했다." },
          { text: M(`\\frac{(${a})(${b})}{${lin(1, p + q, v)}}`), kind: "step_missing", reason: "통분 분자 (x+q)+(x+p) 에서 x 항을 하나만 세었다." },
          { text: M(`(${a}) + (${b})`), kind: "formula_misuse", reason: "역수의 합을 합의 역수처럼 계산했다." },
        ],
        verificationJs: withParams({ p, q, diff: diff ? 1 : 0, x: 7 }, "const a=P.x+P.p, b=P.x+P.q;\nreturn 1/(1/a + (P.diff?-1:1)/b);"),
        trace: [
          [`분모의 두 분수를 통분한다: $\\frac{1}{${a}} ${diff ? "-" : "+"} \\frac{1}{${b}}$ 의 공통분모는 $(${a})(${b})$ 이다.`, "Put the inner fractions over a common denominator."],
          [`통분한 분자는 $(${b}) ${diff ? "-" : "+"} (${a}) = ${diff ? String(dd) : sumDen}$ 이다.`, "Combine the numerators."],
          ["따라서 큰 분수의 분모는 분자/(공통분모) 꼴의 하나의 분수가 된다.", "The denominator of the big fraction is a single fraction."],
          ["1 을 그 분수로 나누는 것은 역수를 곱하는 것과 같으므로 분자와 분모를 뒤집는다.", "Dividing 1 by a fraction flips it."],
          [`결과는 $${correct}$ 이다.`, "State the simplified form."],
        ],
        variant: diff ? "reciprocal_of_difference" : "reciprocal_of_sum",
      });
    },
  },
  {
    id: "ee.rational_equivalence.param_condition", skill: SKILL, kind: "rational_equivalence", operator: "param_condition",
    structure: "(x²+kx+m)/(x−r) 가 x+s 와 동치가 되기 위한 매개변수 조건: 분자가 (x−r)(x+s) 로 인수분해되어야 함",
    extraThinking: "동치가 되려면 나머지가 0(인수정리)이어야 한다는 암묵 조건 도출 후 계수 비교 — medium 은 주어진 두 유리식의 결합",
    concepts: ["유리식 동치 조건", "인수정리·다항식 나눗셈", "계수 비교"], mediumSteps: 4,
    generate(rng) {
      const [LK, LS] = rng.pick([["k", "s"], ["a", "b"], ["c", "d"]] as const);
      const r = rng.nz(-6, 6), s = rng.nz(-6, 6);
      const k = s - r, m = -r * s; if (k === 0 || m === 0) throw new GenFail("x");
      const v = rng.pick(VARS); const ask = rng.pick(["k", "s", "k+s"] as const);
      const stimulus = `${rng.pick(["The expression below is equivalent to VAR + <S> for all values of VAR except the zero of the denominator, where <K> and <S> are constants.", "In the following equation, <K> and <S> are constants, and the equation is true for every real VAR other than the zero of the denominator.", "A quotient of polynomials simplifies to a linear expression, as written, for every VAR that does not make the denominator zero; <K> and <S> are constants.", "Constants <K> and <S> are chosen so that the two sides below agree at every allowed value of VAR.", "After polynomial division with no remainder, the quotient below equals VAR + <S>. Here <K> and <S> are constants.", "The equation below is an identity in VAR whenever the denominator is nonzero, where <K> and <S> are constants."]).replace(/VAR/g, v).replace(/<K>/g, LK).replace(/<S>/g, LS)}\n\n${M(`\\frac{${v}^2 + ${LK}${v} ${m >= 0 ? "+" : "-"} ${Math.abs(m)}}{${shifted(v, -r)}} = ${v} + ${LS}`)}`;
      const ans = ask === "k" ? k : ask === "s" ? s : k + s;
      return finish(rng, {
        stimulus, question: ask === "k+s" ? rng.pick([`What is the value of ${LK} + ${LS}?`, `What is the sum of ${LK} and ${LS}?`, `Find ${LK} + ${LS}.`]) : (() => { const nm = ask === "k" ? LK : LS; return rng.pick([`What is the value of ${nm}?`, `Find ${nm}.`, `What must ${nm} equal?`]); })(),
        correct: ans,
        wrongs: [{ v: -ans, kind: "sign_error", reason: "인수 (x−r) 의 r 부호를 잘못 읽어 값의 부호가 뒤집혔다." }, { v: ask === "k" ? s : k, kind: "step_missing", reason: "요구한 상수가 아니라 다른 상수를 답으로 골랐다." }, { v: ans + r, kind: "formula_misuse", reason: "k 와 s 사이의 관계 k = s − r 을 적용하지 않았다." }, { v: m, kind: "formula_misuse", reason: "상수항 m 을 답으로 골랐다." }, { v: r, kind: "formula_misuse", reason: "분모의 상수 r 을 답으로 골랐다." }, { v: ans - r, kind: "sign_error", reason: "k = s − r 에서 r 의 부호를 반대로 썼다." }],
        verificationJs: withParams({ r, m, ask: ask === "k" ? 0 : ask === "s" ? 1 : 2 }, "const out=[];\nfor(let s=-90;s<=90;s++){ if(-P.r*s===P.m){ const k=s-P.r; out.push([k,s]); } }\nif(out.length!==1) throw new Error('유일하지 않음');\nconst [k,s]=out[0]; return P.ask===0?k:P.ask===1?s:k+s;"),
        trace: [
          ["이 식이 분모의 영점을 제외한 모든 값에서 성립하려면 분자가 분모 인수로 나누어떨어져야 한다.", "For the equality to hold, the numerator must be divisible by the denominator."],
          [`즉 분자 = $(${shifted(v, -r)})(${v} + ${LS})$ 이다.`, "So the numerator factors as (x - r)(x + s)."],
          [`우변을 전개하면 $${v}^2 + (${LS} - ${pn(r)})${v} - ${pn(r)}${LS}$ 이다.`, "Expand the right side."],
          [`상수항을 비교하면 -(${r})${LS} = ${m} 이므로 ${LS} = ${s} 이다.`, "Compare constants to find s."],
          [`일차항 계수를 비교하면 ${LK} = ${LS} - (${r}) = ${k} 이다.`, "Compare the linear coefficients to find k."],
          [`구하는 값은 ${ans} 이다.`, "Report the requested value."],
        ],
        variant: `ask_${ask === "k+s" ? "sum" : ask}`,
      });
    },
  },
  {
    id: "ee.rational_equivalence.constraint_select", skill: SKILL, kind: "rational_equivalence", operator: "constraint_select",
    structure: "전개된 분자·분모를 각각 인수분해해 공통인수를 약분하고, 약분 전 원식의 정의역 제외값(분모의 모든 영점)의 합을 구함",
    extraThinking: "약분해 사라진 인수도 원식에서는 제외값이라는 정의역 제약 추적 — medium 은 동치 결합만 요구하고 제외값을 묻지 않음",
    concepts: ["유리식 약분", "이차식 인수분해", "정의역(제외값)"], mediumSteps: 4,
    generate(rng) {
      const p = rng.nz(-6, 6), r = rng.nz(-6, 6), q = rng.nz(-6, 6);
      if (p === r || p === -q || r === -q) throw new GenFail("x");
      const v = rng.pick(VARS);
      const num = [1, q - p, -p * q], den = [1, -(p + r), p * r];
      if (num[1] === 0 || den[1] === 0) throw new GenFail("x");
      const stimulus = `${sub(rng.pick(["The expression below is equivalent to FRAC2 for all values of VAR for which the original expression is defined.", "For all values of VAR at which the expression below is defined, it equals FRAC2.", "A student cancels a common factor and reports that the expression below simplifies to FRAC2.", "The rational expression below reduces to FRAC2 wherever the original is defined.", "Simplifying the rational expression below gives FRAC2 for every allowed value of VAR.", "The expression shown can be rewritten as FRAC2 after cancelling, but the original has a larger domain restriction."]), v).replace("FRAC2", M(`\\frac{${shifted(v, q)}}{${shifted(v, -r)}}`))}\n\n${M(`\\frac{${poly(num, v)}}{${poly(den, v)}}`)}`;
      return finish(rng, {
        stimulus, question: rng.pick([`What is the sum of all values of ${v} for which the original expression is undefined?`, `What is the sum of all values of ${v} that must be excluded from the domain of the original expression?`, `For which values of ${v} is the original expression not defined? Give their sum.`, `What is the total of every value of ${v} that makes the original denominator equal to zero?`]),
        correct: p + r,
        wrongs: [{ v: r, kind: "step_missing", reason: "약분된 식의 분모 영점 r 만 제외하고, 약분으로 사라진 인수의 영점 p 를 빠뜨렸다." }, { v: -(p + r), kind: "sign_error", reason: "이차식의 근의 합을 계수 부호 그대로 (p+r 이 아니라 −(p+r)) 답했다." }, { v: p * r, kind: "formula_misuse", reason: "근의 합 대신 근의 곱 pr 을 답했다." }, { v: p, kind: "step_missing", reason: "약분으로 사라진 인수의 영점만 답했다." }, { v: p - r, kind: "formula_misuse", reason: "두 영점의 합이 아니라 차를 구했다." }],
        verificationJs: withParams({ b: den[1], c: den[2] }, "let s=0, n=0;\nfor(let x=-300;x<=300;x++){ if(x*x + P.b*x + P.c===0){ s+=x; n++; } }\nif(n<1) throw new Error('영점 없음');\nreturn s;"),
        trace: [
          [`분자를 인수분해한다: $${poly(num, v)} = (${shifted(v, -p)})(${shifted(v, q)})$.`, "Factor the numerator."],
          [`분모를 인수분해한다: $${poly(den, v)} = (${shifted(v, -p)})(${shifted(v, -r)})$.`, "Factor the denominator."],
          [`공통인수 $(${shifted(v, -p)})$ 를 약분하면 $\\frac{${shifted(v, q)}}{${shifted(v, -r)}}$ 이 된다.`, "Cancel the common factor."],
          [`원래 식의 분모가 0 이 되는 값은 ${v} = ${p} 와 ${v} = ${r} 두 개이다(약분된 인수의 영점도 포함).`, "The original denominator is zero at both roots."],
          [`두 값의 합은 ${p} + (${r}) = ${p + r} 이다.`, "Add the excluded values."],
        ],
        variant: "excluded_values_sum",
      });
    },
  },
];
