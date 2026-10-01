// nonlinear_equations_systems easy/medium 원형 — 같은 원형 프레임워크로 문장 틀(=유사문항 그룹)을 늘린다. 원형 하나가 그룹 하나(variant 는 틀 이름 하나).
import { GenFail, type Archetype } from "../types";
import { M, spin, withParams, pn, shifted, lin } from "../text";
import { fracOf, isSquare, quadStr, rectSem, finishA, W } from "./a-kit";

const SKILL = "nonlinear_equations_systems";
const T = (ko: string, en: string): [string, string] => [ko, en];
const quad = (b: number, c: number) => quadStr(1, b, c);
const bc = (r: number, s: number) => ({ b: -(r + s), c: r * s });
const base = { skill: SKILL, operator: "frame" as const, mediumSteps: 0 };

export const NES_EM_ARCHETYPES: Archetype[] = [
  // ───────── easy ─────────
  {
    ...base, id: "nes.root.e_factored_form", kind: "root", difficulty: "easy",
    structure: "이미 인수분해된 (x-r)(x-s)=0 에서 영곱 성질로 근을 읽고 큰 근·작은 근·합을 묻는다",
    extraThinking: "(easy) 영곱 성질 한 번", concepts: ["영곱 성질"],
    generate(rng) {
      const r = rng.int(-8, 8), s = rng.int(-8, 8); if (r === s) throw new GenFail("x"); const ask = rng.pick(["larger", "smaller", "sum"] as const);
      const ans = ask === "larger" ? Math.max(r, s) : ask === "smaller" ? Math.min(r, s) : r + s;
      const f = (k: number) => `(${shifted("x", -k)})`;
      return finishA(rng, {
        stimulus: spin(rng, `[[Consider the equation below|The equation below is already factored|Look at the factored equation below]]. `) + M(`${f(r)}${f(s)} = 0`),
        question: ask === "larger" ? spin(rng, "[[What is the larger solution of the equation?|Which value is the greater solution?|What is the greatest value of x that satisfies the equation?]]") : ask === "smaller" ? spin(rng, "[[What is the smaller solution of the equation?|Which value is the lesser solution?|What is the least value of x that satisfies the equation?]]") : spin(rng, "[[What is the sum of the solutions of the equation?|If both solutions are added, what is the result?|What is the sum of the two values of x that satisfy the equation?]]"), correct: ans,
        wrongs: [{ v: -ans, kind: "sign_error", reason: "인수 (x - r) 의 근을 -r 로 읽었다." }, { v: ask === "larger" ? Math.min(r, s) : Math.max(r, s), kind: "other", reason: "묻는 쪽이 아닌 근을 골랐다." }, { v: -(r + s), kind: "sign_error", reason: "두 근의 부호를 반대로 읽었다." }, { v: r * s, kind: "formula_misuse", reason: "합 대신 곱을 골랐다." }, { v: r + s + 1, kind: "other", reason: "계산 오류." }, { v: Math.abs(r - s), kind: "other", reason: "두 근의 차를 골랐다." }],
        verificationJs: withParams({ r, s, ask: ask === "larger" ? 0 : ask === "smaller" ? 1 : 2 }, "const xs=[]; for(let x=-100;x<=100;x++) if((x-P.r)*(x-P.s)===0) xs.push(x); return P.ask===0? Math.max(...xs) : P.ask===1? Math.min(...xs) : xs[0]+xs[1];"),
        trace: [T("곱이 0 이면 두 인수 중 하나가 0 이다.", "A product is zero when a factor is zero."), T(`x - ${W(r)} = 0 또는 x - ${W(s)} = 0 이므로 x = ${r}, ${s} 이다.`, "Set each factor equal to zero."), T(`묻는 값은 ${ans} 이다.`, "Answer the question.")],
        variant: "factored_form",
      });
    },
  },
  {
    ...base, id: "nes.sum_of_roots.e_equation_sum", kind: "sum_of_roots", difficulty: "easy",
    structure: "x²+bx+c=0 (정수 근)의 두 해의 합을 묻는다", extraThinking: "(easy) 인수분해 또는 -b 로 합을 읽음", concepts: ["이차방정식 풀이"],
    generate(rng) {
      const r = rng.int(-8, 9), s = rng.int(-8, 9); const { b, c } = bc(r, s); if (r === s || b === 0 || c === 0) throw new GenFail("x");
      return finishA(rng, {
        stimulus: spin(rng, `[[The equation below has two real solutions|The quadratic equation below has two different real solutions|Consider the equation below, which has two solutions]]. `) + M(`${quad(b, c)} = 0`),
        question: spin(rng, "[[What is the sum of the solutions of the equation?|What is the sum of the two solutions?|If the two solutions are added, what is the sum?|Find the sum of the solutions.]]"), correct: r + s,
        wrongs: [{ v: -(r + s), kind: "sign_error", reason: "합이 -b 라는 부호를 놓쳤다." }, { v: r * s, kind: "formula_misuse", reason: "합 대신 곱 c 를 골랐다." }, { v: -r * s, kind: "formula_misuse", reason: "곱의 부호를 바꿔 골랐다." }, { v: Math.max(r, s), kind: "step_missing", reason: "큰 근 하나만 골랐다." }, { v: Math.abs(r - s), kind: "other", reason: "근의 차를 골랐다." }],
        verificationJs: withParams({ b, c }, "const xs=[]; for(let x=-100;x<=100;x++) if(x*x+P.b*x+P.c===0) xs.push(x); if(xs.length!==2) throw new Error('근 2개 아님'); return xs[0]+xs[1];"),
        trace: [T(`$${quad(b, c)} = 0$ 을 인수분해한다.`, "Factor the quadratic."), T(`근은 x = ${r}, ${s} 이다.`, "Find the solutions."), T(`합은 ${r} + ${pn(s)} = ${r + s} 이다.`, "Add them.")],
        variant: "equation_sum",
      });
    },
  },
  {
    ...base, id: "nes.product_of_roots.e_equation_product", kind: "product_of_roots", difficulty: "easy",
    structure: "x²+bx+c=0 (정수 근)의 두 해의 곱을 묻는다", extraThinking: "(easy) 인수분해 또는 c 로 곱을 읽음", concepts: ["이차방정식 풀이"],
    generate(rng) {
      const r = rng.int(-8, 9), s = rng.int(-8, 9); const { b, c } = bc(r, s); if (r === s || b === 0 || c === 0) throw new GenFail("x");
      return finishA(rng, {
        stimulus: spin(rng, `[[The equation below has two real solutions|The quadratic equation below has two different real solutions|Consider the equation below, which has two solutions]]. `) + M(`${quad(b, c)} = 0`),
        question: spin(rng, "[[What is the product of the solutions of the equation?|What is the product of the two solutions?|If the two solutions are multiplied, what is the result?|Find the product of the solutions.]]"), correct: r * s,
        wrongs: [{ v: -r * s, kind: "sign_error", reason: "곱의 부호를 반대로 적었다." }, { v: r + s, kind: "formula_misuse", reason: "곱 대신 합을 골랐다." }, { v: -(r + s), kind: "formula_misuse", reason: "합의 부호를 바꿔 골랐다." }, { v: Math.max(r, s), kind: "step_missing", reason: "큰 근 하나만 골랐다." }, { v: r * s + 1, kind: "other", reason: "계산 오류." }],
        verificationJs: withParams({ b, c }, "const xs=[]; for(let x=-100;x<=100;x++) if(x*x+P.b*x+P.c===0) xs.push(x); if(xs.length!==2) throw new Error('근 2개 아님'); return xs[0]*xs[1];"),
        trace: [T(`$${quad(b, c)} = 0$ 을 인수분해한다.`, "Factor the quadratic."), T(`근은 x = ${r}, ${s} 이다.`, "Find the solutions."), T(`곱은 ${r}·${pn(s)} = ${r * s} 이다.`, "Multiply them.")],
        variant: "equation_product",
      });
    },
  },
  {
    ...base, id: "nes.num_real_solutions.e_pure_square", kind: "num_real_solutions", difficulty: "easy",
    structure: "x² = k, x² - k = 0, (x-h)² = k, ax² = ak 꼴에서 실근의 개수(0·1·2)를 묻는다", extraThinking: "(easy) 제곱이 음수가 될 수 없다는 사실로 개수 판정", concepts: ["제곱근과 실근 개수"],
    generate(rng) {
      const form = rng.int(0, 3); const kind = rng.pick(["neg", "zero", "pos", "pos"] as const); const k = kind === "neg" ? -rng.int(1, 30) : kind === "zero" ? 0 : rng.int(1, 9) ** 2; const h = rng.int(-6, 6); const a = form === 3 ? rng.int(2, 4) : 1;
      const eq = form === 0 ? `x^2 = ${k}` : form === 1 ? `x^2 ${k >= 0 ? "-" : "+"} ${Math.abs(k)} = 0` : form === 2 ? `(${shifted("x", -h)})^2 = ${k}` : `${a}x^2 = ${a * k}`;
      const ans = k < 0 ? 0 : k === 0 ? 1 : 2;
      return finishA(rng, {
        stimulus: spin(rng, `[[Consider the equation below|The equation below is given|Look at the equation below]]. `) + M(eq),
        question: spin(rng, "[[How many real solutions does the equation have?|What is the number of real solutions of the equation?|How many different real numbers x satisfy the equation?]]"), correct: ans,
        wrongs: [0, 1, 2, 3].filter((v) => v !== ans).map((v) => ({ v, kind: "other" as const, reason: v === 3 ? "이차방정식의 실근은 최대 2개이다." : "제곱의 값이 음수·0·양수일 때 해의 개수를 잘못 판단했다." })),
        verificationJs: withParams({ form, num: Math.abs(form === 3 ? a * k : k), neg: k < 0 ? 1 : 0, ...(form === 2 ? { h } : {}), ...(form === 3 ? { a } : {}) }, "const k=P.neg? -P.num : P.num; const xs=new Set(); for(let x=-100;x<=100;x++){ let ok=false; if(P.form===0) ok = x*x===k; else if(P.form===1) ok = x*x-k===0; else if(P.form===2) ok = (x-P.h)*(x-P.h)===k; else ok = P.a*x*x===k; if(ok) xs.add(x); } return xs.size;"),
        trace: [T("제곱은 항상 0 이상이다.", "A square is never negative."), T(form === 2 ? `(x - ${h}) 를 한 덩어리로 보면 오른쪽 값은 ${k} 이다.` : `식을 x² = ${k} 꼴로 정리한다.`, "Isolate the square."), T(`오른쪽 값이 ${k < 0 ? "음수" : k === 0 ? "0" : "양수"} 이므로 실근은 ${ans} 개이다.`, "Decide the count from the sign.")],
        variant: "pure_square",
      });
    },
  },

  // ───────── medium ─────────
  {
    ...base, id: "nes.root.m_nonmonic_larger", kind: "root", difficulty: "medium",
    structure: "최고차 계수가 1 이 아닌 ax²+bx+c=0 (유리수 근)에서 큰 근(또는 작은 근)을 묻는다", extraThinking: "(medium) 계수가 1 이 아닌 인수분해와 분수 근", concepts: ["이차방정식 인수분해", "분수"],
    generate(rng) {
      const n = rng.int(2, 4), m = rng.nz(-9, 9), r = rng.int(-6, 7); const g = (a: number, b: number): number => (b ? g(b, a % b) : Math.abs(a)); if (g(m, n) !== 1) throw new GenFail("x");
      const a = n, b = -(n * r + m), c = m * r; if (b === 0 || c === 0 || m / n === r) throw new GenFail("x"); const roots = [m / n, r]; const ask = rng.pick(["larger", "smaller"] as const); const ans = ask === "larger" ? Math.max(...roots) : Math.min(...roots);
      return finishA(rng, {
        stimulus: spin(rng, `[[Consider the equation below|The equation below has two real solutions|For the equation shown, x is a real number]]. `) + M(`${quadStr(a, b, c)} = 0`),
        question: ask === "larger" ? spin(rng, "[[What is the larger solution of the equation?|Which value is the greater solution?|What is the greatest value of x that satisfies the equation?]]") : spin(rng, "[[What is the smaller solution of the equation?|Which value is the lesser solution?|What is the least value of x that satisfies the equation?]]"), correct: ans, fmt: fracOf,
        wrongs: [{ v: ask === "larger" ? Math.min(...roots) : Math.max(...roots), kind: "other", reason: "묻는 쪽이 아닌 근을 골랐다." }, { v: -ans, kind: "sign_error", reason: "근의 부호를 반대로 적었다." }, { v: m, kind: "step_missing", reason: "분모 n 으로 나누지 않았다." }, { v: -m / n, kind: "sign_error", reason: "분수 근의 부호를 반대로 읽었다." }, { v: n * r, kind: "formula_misuse", reason: "인수에서 계수를 잘못 곱했다." }, { v: b / a, kind: "formula_misuse", reason: "근 하나 대신 -합 b/a 를 골랐다." }],
        verificationJs: withParams({ a, b, c, big: ask === "larger" ? 1 : 0 }, "const xs=[]; for(let i=-400;i<=400;i++){ const x=i/P.a; if(Math.abs(P.a*x*x+P.b*x+P.c)<1e-9) xs.push(x); } if(xs.length!==2) throw new Error('근 2개 아님'); return P.big? Math.max(...xs) : Math.min(...xs);"),
        trace: [T(`$${quadStr(a, b, c)} = 0$ 을 인수분해한다: $(${lin(n, -m)})(${shifted("x", -r)}) = 0$.`, "Factor with a leading coefficient."), T(`근은 x = ${fracOf(m / n)} 와 x = ${r} 이다.`, "Solve each factor."), T(`${ask === "larger" ? "큰" : "작은"} 근은 ${fracOf(ans)} 이다.`, "Pick the requested solution.")],
        variant: "nonmonic_root",
      });
    },
  },
  {
    ...base, id: "nes.root.m_other_solution", kind: "root", difficulty: "medium",
    structure: "x²+bx+c=0 의 한 해를 주고 다른 해를 묻는다", extraThinking: "(medium) 근과 계수의 관계 또는 대입 후 인수분해", concepts: ["근과 계수의 관계"],
    generate(rng) {
      const p = rng.nz(-8, 8), q = rng.nz(-8, 8); if (p === q) throw new GenFail("x"); const { b, c } = bc(p, q);
      return finishA(rng, {
        stimulus: spin(rng, `[[One solution of the equation below is ${p}|The equation below has ${p} as one of its solutions|A student finds that x = ${p} is a solution of the equation below]]. `) + M(`${quad(b, c)} = 0`),
        question: spin(rng, "[[What is the other solution of the equation?|Which value is the other solution?|What is the second solution?]]"), correct: q,
        wrongs: [{ v: -q, kind: "sign_error", reason: "다른 근의 부호를 반대로 적었다." }, { v: p, kind: "step_missing", reason: "주어진 근을 그대로 골랐다." }, { v: -p, kind: "sign_error", reason: "주어진 근의 부호를 바꿔 골랐다." }, { v: b, kind: "formula_misuse", reason: "x 계수를 답으로 골랐다." }, { v: c, kind: "formula_misuse", reason: "상수항을 답으로 골랐다." }, { v: -b - q, kind: "other", reason: "계산 오류." }],
        verificationJs: withParams({ b, c, p }, "const xs=[]; for(let x=-100;x<=100;x++) if(x*x+P.b*x+P.c===0 && x!==P.p) xs.push(x); if(xs.length!==1) throw new Error('유일하지 않음'); return xs[0];"),
        trace: [T(`두 근의 합은 -(${b}) = ${-b} 이다.`, "The sum of solutions is -b."), T(`다른 근은 ${-b} - ${pn(p)} = ${q} 이다.`, "Subtract the known solution.")],
        variant: "other_solution",
      });
    },
  },
  {
    ...base, id: "nes.root.m_word_area", kind: "root", difficulty: "medium",
    structure: "직사각형 가로 w, 세로 w+d, 넓이 A 라는 문장에서 이차방정식을 세워 가로·세로·둘레를 구한다", extraThinking: "(medium) 문장 → 식 세우기(넓이) → 양수 해", concepts: ["문장 모델링(넓이)", "이차방정식 풀이"],
    generate(rng) {
      const w = rng.int(2, 14), d = rng.int(1, 9), A = w * (w + d); if (A > 300) throw new GenFail("x"); const ask = rng.pick(["width", "length", "perimeter"] as const); const ans = ask === "width" ? w : ask === "length" ? w + d : 2 * (2 * w + d);
      const ctx = rng.pick(["rectangular garden", "rectangular poster", "rectangular patio", "rectangular banner", "rectangular tile", "rectangular rug"] as const);
      const sems = [rectSem("area", "w", `w + ${d}`, { w })]; if (ask === "perimeter") sems.push(rectSem("perimeter", "w", `w + ${d}`, { w }));
      return finishA(rng, {
        stimulus: `A ${ctx} has a width of w units and a length that is ${d} unit${d === 1 ? "" : "s"} more than its width. The area of the ${ctx.replace("rectangular ", "")} is ${A} square units.`,
        question: ask === "width" ? spin(rng, "[[What is the width, in units?|What is the value of w?|Find the width, in units.]]") : ask === "length" ? spin(rng, "[[What is the length, in units?|Find the length, in units.|How long is it, in units?]]") : spin(rng, "[[What is the perimeter, in units?|Find the perimeter, in units.|How many units is the perimeter?]]"), correct: ans,
        wrongs: [{ v: ask === "width" ? w + d : ask === "length" ? w : 2 * w + d, kind: "geometry_misapplied", reason: "묻는 값이 아닌 다른 값(가로/세로/반둘레)을 골랐다." }, { v: A, kind: "geometry_misapplied", reason: "넓이를 답으로 골랐다." }, { v: 2 * (2 * w + d) + 2, kind: "other", reason: "계산 오류." }, { v: ask === "perimeter" ? A * 2 : w * 2, kind: "geometry_misapplied", reason: "둘레와 넓이를 혼동했다." }, { v: ans + 1, kind: "other", reason: "계산 오류." }, { v: Math.max(1, ans - 1), kind: "other", reason: "계산 오류." }],
        verificationJs: withParams({ d, A, ask: ask === "width" ? 0 : ask === "length" ? 1 : 2 }, "const hits=[]; for(let w=1;w<=300;w++) if(w*(w+P.d)===P.A) hits.push(P.ask===0? w : P.ask===1? w+P.d : 2*(w+(w+P.d))); if(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];"),
        trace: [T(`넓이 = 가로 × 세로 이므로 w(w + ${d}) = ${A} 이다.`, "Area equals width times length."), T(`$${quadStr(1, d, -A, "w")} = 0$ 을 인수분해하면 w = ${w} 또는 음수 해이다.`, "Solve the quadratic."), T(`길이이므로 양수 w = ${w}, 세로는 ${w + d} 이다.`, "Keep the positive solution."), T(`묻는 값은 ${ans} 이다.`, "Answer the question.")],
        variant: "word_area", semantics: sems,
      });
    },
  },
  {
    ...base, id: "nes.sum_of_roots.m_rearranged", kind: "sum_of_roots", difficulty: "medium",
    structure: "x²=Sx-P, x(x+u)=v, x²+bx=c 처럼 표준형이 아닌 식을 이항·전개해 두 해의 합을 구한다", extraThinking: "(medium) 이항·전개로 표준형 정리", concepts: ["표준형 정리", "근과 계수의 관계"],
    generate(rng) {
      const r = rng.int(-7, 9), s = rng.int(-7, 9); if (r === s) throw new GenFail("x"); const S = r + s, Pr = r * s; const form = rng.int(0, 2); if (S === 0 || Pr === 0) throw new GenFail("x");
      const eq = form === 0 ? `x^2 = ${lin(S, 0)} ${Pr > 0 ? "-" : "+"} ${Math.abs(Pr)}` : form === 1 ? `x(${shifted("x", -S)}) = ${-Pr}` : `x^2 ${S > 0 ? "-" : "+"} ${Math.abs(S)}x = ${-Pr}`;
      return finishA(rng, {
        stimulus: spin(rng, `[[The equation below has two real solutions|Consider the equation below, which has two real solutions|The equation below is not written in standard form]]. `) + M(eq),
        question: spin(rng, "[[What is the sum of the solutions of the equation?|What is the sum of the two solutions?|If the two solutions are added, what is the sum?]]"), correct: S,
        wrongs: [{ v: -S, kind: "sign_error", reason: "이항 후 x 계수의 부호를 놓쳤다." }, { v: Pr, kind: "formula_misuse", reason: "합 대신 곱을 골랐다." }, { v: -Pr, kind: "sign_error", reason: "이항을 하지 않고 상수를 합으로 골랐다." }, { v: S + 1, kind: "other", reason: "계산 오류." }, { v: Math.abs(S), kind: "sign_error", reason: "합의 부호를 무시했다." }],
        verificationJs: withParams({ S, Pr, form }, "const xs=[]; for(let x=-100;x<=100;x++){ let lhs, rhs; if(P.form===0){ lhs=x*x; rhs=P.S*x-P.Pr; } else if(P.form===1){ lhs=x*(x-P.S); rhs=-P.Pr; } else { lhs=x*x-P.S*x; rhs=-P.Pr; } if(lhs===rhs) xs.push(x); } if(xs.length!==2) throw new Error('근 2개 아님'); return xs[0]+xs[1];"),
        trace: [T("모든 항을 한쪽으로 옮겨 $x^2 + bx + c = 0$ 꼴로 정리한다.", "Move all terms to one side."), T(`정리하면 $${quad(-S, Pr)} = 0$ 이다.`, "Write the standard form."), T(`두 해의 합은 -(${-S}) = ${S} 이다.`, "Use the sum formula.")],
        variant: "rearranged_sum",
      });
    },
  },
  {
    ...base, id: "nes.product_of_roots.m_nonmonic", kind: "product_of_roots", difficulty: "medium",
    structure: "ax²+bx+c=0 (a=2~5, 정수 근)의 두 해의 곱 또는 합을 묻는다", extraThinking: "(medium) 최고차 계수로 나눈 근과 계수의 관계", concepts: ["근과 계수의 관계"],
    generate(rng) {
      const a = rng.int(2, 5), r = rng.int(-6, 7), s = rng.int(-6, 7); if (r === s) throw new GenFail("x"); const b = -a * (r + s), c = a * r * s; if (b === 0 || c === 0) throw new GenFail("x"); const prod = rng.chance(0.6);
      return finishA(rng, {
        stimulus: spin(rng, `[[The equation below has two real solutions|Consider the equation below, which has two real solutions|The quadratic equation below has two solutions]]. `) + M(`${quadStr(a, b, c)} = 0`),
        question: prod ? spin(rng, "[[What is the product of the solutions of the equation?|What is the product of the two solutions?|If the two solutions are multiplied, what is the result?]]") : spin(rng, "[[What is the sum of the solutions of the equation?|What is the sum of the two solutions?|If the two solutions are added, what is the result?]]"), correct: prod ? r * s : r + s,
        wrongs: prod
          ? [{ v: c, kind: "step_missing", reason: "최고차 계수 a 로 나누지 않았다." }, { v: -r * s, kind: "sign_error", reason: "곱의 부호를 반대로 적었다." }, { v: r + s, kind: "formula_misuse", reason: "곱 대신 합을 골랐다." }, { v: c * a, kind: "formula_misuse", reason: "c/a 대신 c·a 를 계산했다." }, { v: -c / a - 1, kind: "other", reason: "계산 오류." }]
          : [{ v: -b, kind: "step_missing", reason: "최고차 계수 a 로 나누지 않았다." }, { v: -(r + s), kind: "sign_error", reason: "합의 부호를 반대로 적었다." }, { v: r * s, kind: "formula_misuse", reason: "합 대신 곱을 골랐다." }, { v: b * a, kind: "formula_misuse", reason: "-b/a 대신 b·a 를 계산했다." }, { v: r + s + 1, kind: "other", reason: "계산 오류." }],
        verificationJs: withParams({ a, b, c, prod: prod ? 1 : 0 }, "const xs=[]; for(let x=-100;x<=100;x++) if(P.a*x*x+P.b*x+P.c===0) xs.push(x); if(xs.length!==2) throw new Error('근 2개 아님'); return P.prod? xs[0]*xs[1] : xs[0]+xs[1];"),
        trace: [T(`양변을 ${a} 로 나누면 $${quad(b / a, c / a)} = 0$ 이다.`, "Divide by the leading coefficient."), T(`근은 x = ${r}, ${s} 이다.`, "Find the solutions."), T(`${prod ? `곱 = ${r}·${pn(s)} = ${r * s}` : `합 = ${r} + ${pn(s)} = ${r + s}`} 이다.`, "Combine as requested.")],
        variant: "nonmonic_vieta",
      });
    },
  },
  {
    ...base, id: "nes.irrational_sum_of_roots.m_vieta_irrational", kind: "irrational_sum_of_roots", difficulty: "medium",
    structure: "근이 무리수인 ax²+bx+c=0 에서 근을 구하지 않고 합(-b/a) 또는 곱(c/a)을 묻는다", extraThinking: "(medium) 판별식으로 근이 무리수임을 확인하고 근과 계수의 관계 사용", concepts: ["판별식", "근과 계수의 관계"],
    generate(rng) {
      const a = rng.int(1, 4), b = rng.nz(-9, 9), c = rng.nz(-9, 9), D = b * b - 4 * a * c; if (D <= 0 || isSquare(D)) throw new GenFail("x"); const prod = rng.chance(0.5); const ans = prod ? c / a : -b / a;
      return finishA(rng, {
        stimulus: spin(rng, `[[The equation below has two real solutions that are not integers|Consider the equation below, which has two irrational real solutions|The equation below has two real solutions]]. `) + M(`${quadStr(a, b, c)} = 0`),
        question: prod ? spin(rng, "[[What is the product of the solutions of the equation?|What is the product of the two solutions?|If the two solutions are multiplied, what is the result?]]") : spin(rng, "[[What is the sum of the solutions of the equation?|What is the sum of the two solutions?|If the two solutions are added, what is the result?]]"), correct: ans, fmt: fracOf,
        wrongs: prod
          ? [{ v: -c / a, kind: "sign_error", reason: "곱 c/a 의 부호를 반대로 적었다." }, { v: c, kind: "step_missing", reason: "a 로 나누지 않았다." }, { v: -b / a, kind: "formula_misuse", reason: "곱 대신 합을 골랐다." }, { v: b / a, kind: "formula_misuse", reason: "곱 대신 합의 부호를 바꾼 값을 골랐다." }, { v: c * a, kind: "formula_misuse", reason: "c/a 대신 c·a 를 계산했다." }]
          : [{ v: b / a, kind: "sign_error", reason: "합 -b/a 의 부호를 놓쳤다." }, { v: -b, kind: "step_missing", reason: "a 로 나누지 않았다." }, { v: c / a, kind: "formula_misuse", reason: "합 대신 곱을 골랐다." }, { v: -c / a, kind: "formula_misuse", reason: "합 대신 곱의 부호를 바꾼 값을 골랐다." }, { v: -b * a, kind: "formula_misuse", reason: "-b/a 대신 -b·a 를 계산했다." }],
        verificationJs: withParams({ a, b, c, prod: prod ? 1 : 0 }, "const D=P.b*P.b-4*P.a*P.c; if(!(D>0)) throw new Error('실근 없음'); const x1=(-P.b+Math.sqrt(D))/(2*P.a), x2=(-P.b-Math.sqrt(D))/(2*P.a); return P.prod? x1*x2 : x1+x2;"),
        trace: [T(`판별식 ${b * b} - 4·${a}·${pn(c)} = ${D} 는 완전제곱수가 아니므로 근은 무리수이다.`, "The roots are irrational."), T(`근과 계수의 관계를 쓴다: 합 = -b/a, 곱 = c/a.`, "Use Vieta's formulas."), T(`${prod ? `곱 = ${c}/${a}` : `합 = -(${b})/${a}`} = ${fracOf(ans)} 이다.`, "Compute.")],
        variant: "irrational_vieta",
      });
    },
  },
  {
    ...base, id: "nes.linear_quadratic_intersection.m_intersection_x", kind: "linear_quadratic_intersection", difficulty: "medium",
    structure: "포물선과 직선의 두 교점 중 큰(작은) x좌표를 묻는다", extraThinking: "(medium) 두 식을 같게 놓고 인수분해", concepts: ["연립방정식", "이차방정식 풀이"],
    generate(rng) {
      const m = rng.nz(-4, 5), n = rng.int(-8, 10), r = rng.int(-6, 7), s = rng.int(-6, 7); if (r === s) throw new GenFail("x"); const b = m - r - s, c = n + r * s; if (Math.abs(b) > 14 || Math.abs(c) > 40) throw new GenFail("x"); const large = rng.chance(0.5); const ans = large ? Math.max(r, s) : Math.min(r, s);
      return finishA(rng, {
        stimulus: spin(rng, `[[The graphs of the two equations below intersect at two points|A parabola and a line are given by the equations below, and they cross at two points|The system of equations below describes a parabola and a line that meet at two points]] in the xy-plane.\n\n`) + M(`y = ${quad(b, c)}`) + "\n" + M(`y = ${lin(m, n)}`),
        question: large ? spin(rng, "[[What is the greater x-coordinate of the two points of intersection?|What is the larger of the two x-coordinates of the intersection points?|What is the x-coordinate of the intersection point that is farther to the right?]]") : spin(rng, "[[What is the lesser x-coordinate of the two points of intersection?|What is the smaller of the two x-coordinates of the intersection points?|What is the x-coordinate of the intersection point that is farther to the left?]]"), correct: ans,
        wrongs: [{ v: large ? Math.min(r, s) : Math.max(r, s), kind: "other", reason: "묻는 쪽이 아닌 교점의 x 좌표를 골랐다." }, { v: -ans, kind: "sign_error", reason: "이항 후 부호를 놓쳤다." }, { v: m * ans + n, kind: "axis_misread", reason: "x 좌표가 아니라 y 좌표를 골랐다." }, { v: r + s, kind: "formula_misuse", reason: "두 x 좌표의 합을 골랐다." }, { v: ans + 1, kind: "other", reason: "계산 오류." }],
        verificationJs: withParams({ b, c, m, n, big: large ? 1 : 0 }, "const xs=[]; for(let x=-200;x<=200;x++) if(x*x+P.b*x+P.c===P.m*x+P.n) xs.push(x); if(xs.length!==2) throw new Error('교점 2개 아님'); return P.big? Math.max(...xs) : Math.min(...xs);"),
        trace: [T("교점에서 y 가 같으므로 두 식을 같게 놓는다.", "Set the two y-values equal."), T(`정리하면 $${quad(b - m, c - n)} = 0$ 이다.`, "Rearrange to standard form."), T(`인수분해하면 x = ${r}, ${s} 이다.`, "Factor."), T(`${large ? "큰" : "작은"} x 좌표는 ${ans} 이다.`, "Pick the requested coordinate.")],
        variant: "intersection_x",
      });
    },
  },
  {
    ...base, id: "nes.parameter_discriminant.m_one_solution_c", kind: "parameter_discriminant", difficulty: "medium",
    structure: "해가 하나뿐이라는 조건으로 상수항 c(또는 최고차 계수 k)를 판별식 0 으로 구한다", extraThinking: "(medium) 판별식 = 0 을 한 문자에 대해 풀기", concepts: ["판별식"],
    generate(rng) {
      const h = rng.int(1, 8), b = rng.pick([-1, 1]) * 2 * h; const lead = rng.chance(0.4); let c = h * h; let k = 1;
      if (lead) { const divs = [1, 2, 3, 4, 6, 9, 12, 18, 36].filter((d) => (h * h) % d === 0 && d <= h * h); c = rng.pick(divs); k = (h * h) / c; if (k <= 0) throw new GenFail("x"); }
      const letter = rng.pick(["k", "p", "m"] as const);
      return finishA(rng, {
        stimulus: spin(rng, `[[In the equation below|For the equation shown|In the given equation|In the equation given here]], ${letter} is a positive constant, and the equation has exactly one real solution.\n\n`) + M(lead ? `${letter}x^2 ${b < 0 ? "-" : "+"} ${Math.abs(b)}x + ${c} = 0` : `x^2 ${b < 0 ? "-" : "+"} ${Math.abs(b)}x + ${letter} = 0`),
        question: spin(rng, `[[What is the value of ${letter}?|Find ${letter}.|What must ${letter} equal?]]`), correct: lead ? k : c,
        wrongs: [{ v: (lead ? k : c) + 1, kind: "other", reason: "계산 오류." }, { v: b * b, kind: "formula_misuse", reason: "판별식 b² 을 그대로 답으로 골랐다(4 로 나누지 않음)." }, { v: Math.abs(b) / 2, kind: "formula_misuse", reason: "b/2 를 답으로 골랐다(제곱하지 않음)." }, { v: -(lead ? k : c), kind: "sign_error", reason: "부호를 반대로 적었다." }, { v: Math.abs(b), kind: "step_missing", reason: "b 를 그대로 골랐다." }, { v: (b * b) / 2, kind: "formula_misuse", reason: "4 대신 2 로 나눴다." }],
        verificationJs: lead ? withParams({ b, c }, "const hits=[]; for(let k=1;k<=100;k++){ let mn=Infinity; for(let i=-400;i<=400;i++){ const x=i/(2*k); const f=k*x*x+P.b*x+P.c; if(f<mn) mn=f; } if(Math.abs(mn)<1e-9) hits.push(k); } if(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];") : withParams({ b }, "const hits=[]; for(let c=1;c<=100;c++){ let mn=Infinity; for(let x=-60;x<=60;x++){ const f=x*x+P.b*x+c; if(f<mn) mn=f; } if(mn===0) hits.push(c); } if(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];"),
        trace: [T("해가 하나뿐이므로 판별식 D = b² - 4ac = 0 이다.", "One solution means D = 0."), T(lead ? `${b * b} - 4·${letter}·${c} = 0 이므로 ${letter} = ${b * b}/${4 * c} = ${k} 이다.` : `${b * b} - 4${letter} = 0 이므로 ${letter} = ${b * b}/4 = ${c} 이다.`, "Solve for the unknown."), T(`답은 ${lead ? k : c} 이다.`, "State the answer.")],
        variant: "one_solution_constant",
      });
    },
  },
  {
    ...base, id: "nes.num_real_solutions.m_discriminant_count", kind: "num_real_solutions", difficulty: "medium",
    structure: "ax²+bx+c=0 의 판별식 부호로 실근의 개수(0·1·2)를 묻는다", extraThinking: "(medium) 판별식 계산과 부호 판정", concepts: ["판별식"],
    generate(rng) {
      const a = rng.nz(-4, 4), b = rng.int(-8, 8); const outcome = rng.int(0, 2); const j = rng.int(1, 6);
      // D = b^2 - 4ac : 0 → ac = b^2/4 (b 짝수), >0 → ac < b^2/4, <0 → ac > b^2/4
      const c = outcome === 1 ? (b % 2 === 0 ? Math.round((b * b) / 4 / a) : NaN) : outcome === 2 ? Math.floor((b * b - 4 * j) / (4 * a)) : Math.ceil((b * b + 4 * j) / (4 * a));
      if (!Number.isFinite(c) || c === 0 || Math.abs(c) > 20) throw new GenFail("x"); const D = b * b - 4 * a * c; const cnt = D > 0 ? 2 : D === 0 ? 1 : 0;
      return finishA(rng, {
        stimulus: spin(rng, `[[Consider the equation below|The equation below is given|Look at the equation below]], where x is a real number. `) + M(`${quadStr(a, b, c)} = 0`),
        question: spin(rng, "[[How many real solutions does the equation have?|What is the number of real solutions of the equation?|How many different real numbers x satisfy the equation?]]"), correct: cnt,
        wrongs: [0, 1, 2, 3].filter((v) => v !== cnt).map((v) => ({ v, kind: "other" as const, reason: v === 3 ? "이차방정식의 실근은 최대 2개이다." : "판별식의 계산 또는 부호 판정이 틀렸다." })),
        verificationJs: withParams({ a, b, c }, "const x0=-P.b/(2*P.a); const f=P.a*x0*x0+P.b*x0+P.c; if(Math.abs(f)<1e-9) return 1; return P.a*f<0 ? 2 : 0;"),
        trace: [T(`판별식 D = ${b}² - 4·${pn(a)}·${pn(c)} = ${D} 이다.`, "Compute the discriminant."), T(`D 가 ${D > 0 ? "양수" : D === 0 ? "0" : "음수"} 이므로 실근은 ${cnt} 개이다.`, "Decide by the sign.")],
        variant: "discriminant_count",
      });
    },
  },
];
