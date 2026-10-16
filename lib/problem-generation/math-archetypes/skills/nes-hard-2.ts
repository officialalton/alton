// nonlinear_equations_systems hard 원형 — irrational_sum/product/radical_form·linear_quadratic_intersection·parameter_discriminant (세부 패턴 5개 × 연산자 4종 = 20).
import { GenFail, type Archetype } from "../types";
import { lin, M, spin, withParams, pn } from "../text";
import type { TextWrong } from "../text";
import { fracOf, isSquare, quadStr, radStr, rectSem, finishA, W } from "./a-kit";

const SKILL = "nonlinear_equations_systems";
const finish = finishA;
const T = (ko: string, en: string): [string, string] => [ko, en];
const NS = [2, 3, 5, 6, 7, 10, 11, 13] as const; // 제곱인수 없는 n
const SC = (k: number) => (k < 0 ? `- ${-k}` : `+ ${k}`);
const quad = (b: number, c: number) => quadStr(1, b, c);
const pm = (p: number, q: number, n: number) => `${p === 0 ? "" : `${p} `}\\pm ${q === 1 ? "" : q}\\sqrt{${n}}`;
/** 근호꼴 선지(정답 + 오답 후보). 값이 같은 후보는 finish 가 제거한다. */
const rw = (t: [number, number, number], kind: TextWrong["kind"], reason: string): TextWrong => ({ text: M(radStr(...t)), kind, reason });

export const NES2_ARCHETYPES: Archetype[] = [
  // ───────────── irrational_sum_of_roots ─────────────
  {
    id: "nes.irrational_sum_of_roots.inverse", skill: SKILL, kind: "irrational_sum_of_roots", operator: "inverse",
    structure: "정수 계수 이차방정식의 해가 p ± q√n 으로 주어질 때 켤레근의 합·곱으로 b, c 를 역산해 b + c 를 구한다",
    extraThinking: "해에서 계수로 역방향 재구성(켤레근의 합 2p, 곱 p²-q²n 의 부호 처리) — medium 은 무리수 근 방정식의 근의 합 -b/a 를 읽음",
    concepts: ["켤레근", "근과 계수의 관계", "근호 제곱 계산"], mediumSteps: 3,
    generate(rng) {
      const p = rng.int(-6, 6), q = rng.int(1, 3), n = rng.pick(NS); const b = -2 * p, c = p * p - q * q * n; if (b + c === 0 || Math.abs(c) > 60) throw new GenFail("x");
      const L = rng.pick([["b", "c"], ["p", "q"], ["m", "n"]] as const); if (L[0] === "p" || L[1] === "n") throw new GenFail("skip");
      const ask = rng.pick(["sum", "diff"] as const); const ans = ask === "sum" ? b + c : c - b;
      return finish(rng, {
        stimulus: spin(rng, `[[The two solutions of the equation|The equation|Both solutions of the equation]] `) + M(`x^2 + ${L[0]}x + ${L[1]} = 0`) + spin(rng, `, where ${L[0]} and ${L[1]} are integers, [[are|are given by|can be written as]] `) + M(pm(p, q, n)) + ".",
        question: ask === "sum" ? spin(rng, `[[What is the value of ${L[0]} + ${L[1]}?|Find ${L[0]} + ${L[1]}.|What is the sum of ${L[0]} and ${L[1]}?]]`) : spin(rng, `[[What is the value of ${L[1]} - ${L[0]}?|Find ${L[1]} - ${L[0]}.|What is ${L[0]} subtracted from ${L[1]}?]]`), correct: ans,
        wrongs: ask === "sum"
          ? [{ v: -b + c, kind: "sign_error", reason: "근의 합이 -b 라는 부호를 놓쳤다." }, { v: c, kind: "step_missing", reason: "곱 c 만 구했다." }, { v: b, kind: "step_missing", reason: "합 b 만 구했다." }, { v: b + p * p + q * q * n, kind: "sign_error", reason: "곱 (p+q√n)(p-q√n) 에서 q²n 의 부호를 놓쳤다." }, { v: 2 * p + c, kind: "sign_error", reason: "b = -(근의 합) 부호를 놓쳤다." }, { v: b - c, kind: "sign_error", reason: "b - c 를 계산했다." }]
          : [{ v: -b - c, kind: "sign_error", reason: "차의 부호를 반대로 계산했다." }, { v: c + b, kind: "sign_error", reason: "c - b 대신 c + b 를 계산했다." }, { v: p * p + q * q * n + b, kind: "sign_error", reason: "곱에서 q²n 의 부호를 놓쳤다." }, { v: c, kind: "step_missing", reason: "c 만 답으로 골랐다." }, { v: -b, kind: "step_missing", reason: "b 의 부호만 바꿔 답으로 골랐다." }],
        verificationJs: withParams({ p, q, n }, "const r1=P.p+P.q*Math.sqrt(P.n), r2=P.p-P.q*Math.sqrt(P.n); const b=-(r1+r2), c=r1*r2; const rb=Math.round(b), rc=Math.round(c); if(Math.abs(b-rb)>1e-9||Math.abs(c-rc)>1e-9) throw new Error('정수 계수 아님'); return " + (ask === "sum" ? "rb+rc" : "rc-rb") + ";"),
        trace: [
          T(`계수가 정수이므로 두 해는 켤레 p ± q√n 이다: ${p} ± ${q}√${n}.`, "The solutions are a conjugate pair."),
          T(`두 해의 합은 2·(${p}) = ${2 * p} 이고 이것은 -${L[0]} 이다.`, "The sum of the solutions is minus the linear coefficient."),
          T(`${L[0]} = ${b} 이다.`, "Solve for the linear coefficient."),
          T(`두 해의 곱은 (${p})² - (${q}√${n})² = ${p * p} - ${q * q * n} = ${c} 이고 이것이 ${L[1]} 이다.`, "The product of conjugates is p² - q²n."),
          T(`${ask === "sum" ? `${L[0]} + ${L[1]} = ${b} + ${pn(c)}` : `${L[1]} - ${L[0]} = ${c} - ${pn(b)}`} = ${ans} 이다.`, "Combine."),
        ],
        variant: ask === "sum" ? "conjugate_sum" : "conjugate_diff",
      });
    },
  },
  {
    id: "nes.irrational_sum_of_roots.compose_kind", skill: SKILL, kind: "irrational_sum_of_roots", operator: "compose_kind",
    structure: "무리수 근을 갖는 이차방정식에서 근을 직접 구하지 않고 대칭식(제곱합 또는 차의 제곱)을 합과 곱으로 계산",
    extraThinking: "근과 계수의 관계에 대칭식 항등식((r+s)²-2rs, (r-s)²=(r+s)²-4rs)을 결합 — medium 은 근의 합만 읽음",
    concepts: ["근과 계수의 관계", "대칭식 항등식", "판별식으로 실근 확인"], mediumSteps: 3,
    generate(rng) {
      const b = rng.int(-9, 9), c = rng.int(-9, 9), D = b * b - 4 * c; if (D <= 0 || isSquare(D)) throw new GenFail("x");
      const sq = rng.chance(0.55); const ans = sq ? b * b - 2 * c : D;
      return finish(rng, {
        stimulus: spin(rng, `[[The equation below has two real solutions|The equation below has two different real solutions|Consider the equation below, which has two real solutions]], and neither solution is an integer.\n\n`) + M(`${quad(b, c)} = 0`),
        question: sq ? spin(rng, "[[What is the sum of the squares of the two solutions?|What is the value of the sum of the squares of the solutions?|If r and s are the solutions, what is the sum of the squares of r and s?]]") : spin(rng, "[[What is the square of the difference between the two solutions?|If r and s are the solutions, what is the square of r minus s?|What is the value of the squared difference of the two solutions?]]"), correct: ans,
        wrongs: sq
          ? [{ v: b * b, kind: "formula_misuse", reason: "(r+s)² 만 계산하고 -2rs 를 빠뜨렸다." }, { v: b * b + 2 * c, kind: "sign_error", reason: "r² + s² = (r+s)² - 2rs 에서 부호를 반대로 적용했다." }, { v: -b, kind: "step_missing", reason: "두 해의 합만 구했다." }, { v: c, kind: "step_missing", reason: "두 해의 곱만 구했다." }, { v: b * b - c, kind: "formula_misuse", reason: "2rs 대신 rs 를 뺐다." }, { v: D, kind: "formula_misuse", reason: "제곱합 대신 (r-s)² = D 를 골랐다." }]
          : [{ v: b * b - 2 * c, kind: "formula_misuse", reason: "(r-s)² 대신 r² + s² 를 구했다." }, { v: b * b - 2 * c + 0 + 4 * c, kind: "sign_error", reason: "(r-s)² = (r+s)² - 4rs 에서 부호를 반대로 적용했다." }, { v: b * b, kind: "step_missing", reason: "(r+s)² 만 구했다." }, { v: c, kind: "step_missing", reason: "곱만 구했다." }, { v: b * b - c, kind: "formula_misuse", reason: "4rs 대신 rs 를 뺐다." }],
        verificationJs: withParams({ b, c, sq: sq ? 1 : 0 }, "const D=P.b*P.b-4*P.c; if(!(D>0)) throw new Error('실근 아님'); const r=(-P.b+Math.sqrt(D))/2, s=(-P.b-Math.sqrt(D))/2; const v=P.sq? r*r+s*s : (r-s)*(r-s); const rv=Math.round(v); if(Math.abs(v-rv)>1e-9) throw new Error('정수 아님'); return rv;"),
        trace: [
          T(`판별식 ${b * b} - 4·${pn(c)} = ${D} > 0 이고 완전제곱수가 아니므로 해는 서로 다른 무리수이다.`, "Check the discriminant: two irrational real solutions."),
          T(`두 해의 합 r + s = ${-b}, 곱 rs = ${c} 이다.`, "Vieta's formulas."),
          T(sq ? "r² + s² = (r + s)² - 2rs 를 이용한다." : "(r - s)² = (r + s)² - 4rs 를 이용한다.", "Use the symmetric identity."),
          T(sq ? `${b * b} - 2·${pn(c)} 를 계산한다.` : `${b * b} - 4·${pn(c)} 를 계산한다.`, "Substitute the sum and product."),
          T(`결과는 ${ans} 이다.`, "Evaluate."),
        ],
        variant: sq ? "sum_of_squares" : "squared_difference",
      });
    },
  },
  {
    id: "nes.irrational_sum_of_roots.chain2", skill: SKILL, kind: "irrational_sum_of_roots", operator: "chain2",
    structure: "첫 방정식(무리수 근)의 근의 합 k 를 구해 둘째 방정식 x² - mx - k = 0 의 해의 제곱합을 구한다",
    extraThinking: "근을 구하지 않고 앞 단계의 합이 뒤 방정식의 상수항이 되는 2단계 연쇄, 제곱합 항등식 재사용 — medium 은 한 방정식의 합",
    concepts: ["근과 계수의 관계", "연쇄 대입", "제곱합 항등식"], mediumSteps: 3,
    generate(rng) {
      const a1 = rng.int(1, 3), k = rng.nz(-6, 7), b1 = -a1 * k, c1 = rng.int(-9, 9), D1 = b1 * b1 - 4 * a1 * c1; if (D1 <= 0 || isSquare(D1)) throw new GenFail("x");
      const m = rng.int(1, 7); if (m * m + 4 * k <= 0) throw new GenFail("x"); const ans = m * m + 2 * k;
      return finish(rng, {
        stimulus: spin(rng, `[[Let k be the sum of the solutions of the equation|Let k represent the sum of the two solutions of|Suppose k equals the sum of the solutions of]] `) + M(`${quadStr(a1, b1, c1)} = 0`) + spin(rng, `[[. A second equation is given below|. Consider the second equation below, which uses k|. Then a second equation is written with that value of k]]:\n\n`) + M(`x^2 - ${m}x - k = 0`),
        question: spin(rng, "[[What is the sum of the squares of the solutions of the second equation?|Find the sum of the squares of the two solutions of the second equation.|What is the value of the sum of the squares of the solutions of the second equation?]]"), correct: ans,
        wrongs: [{ v: m * m - 2 * k, kind: "sign_error", reason: "상수항이 -k 라는 부호를 놓쳐 곱을 k 로 계산했다." }, { v: m * m, kind: "formula_misuse", reason: "(합)² 만 계산하고 -2·(곱) 을 빠뜨렸다." }, { v: k, kind: "step_missing", reason: "첫 방정식의 합 k 만 구했다." }, { v: m, kind: "step_missing", reason: "둘째 방정식의 합 m 만 구했다." }, { v: m * m + k, kind: "formula_misuse", reason: "2rs 대신 rs 를 더했다." }, { v: -k, kind: "step_missing", reason: "둘째 방정식의 곱만 구했다." }],
        verificationJs: withParams({ a1, b1, c1, m }, "const D1=P.b1*P.b1-4*P.a1*P.c1; if(!(D1>0)) throw new Error('첫 실근 없음'); const x1=(-P.b1+Math.sqrt(D1))/(2*P.a1), x2=(-P.b1-Math.sqrt(D1))/(2*P.a1); const kk=x1+x2, k=Math.round(kk); if(Math.abs(kk-k)>1e-9) throw new Error('합이 정수 아님');\nconst D2=P.m*P.m+4*k; if(!(D2>0)) throw new Error('둘째 실근 없음'); const y1=(P.m+Math.sqrt(D2))/2, y2=(P.m-Math.sqrt(D2))/2; const v=y1*y1+y2*y2, rv=Math.round(v); if(Math.abs(v-rv)>1e-9) throw new Error('정수 아님'); return rv;"),
        trace: [
          T(`첫 방정식의 판별식 ${b1 * b1} - 4·${a1}·${pn(c1)} = ${D1} 는 완전제곱수가 아니므로 해는 무리수이다. 해를 구하지 않고 합을 쓴다.`, "The roots are irrational, so use the sum formula instead of solving."),
          T(`두 해의 합은 -(${b1})/${a1} = ${k} 이므로 k = ${k} 이다.`, "Compute k."),
          T(`둘째 방정식은 $x^2 - ${m}x ${SC(-k)} = 0$ 이므로 합 ${m}, 곱 ${-k} 이다.`, "Substitute k into the second equation."),
          T("제곱합은 (합)² - 2(곱) 이다.", "Use the sum-of-squares identity."),
          T(`${m}² - 2·(${-k}) = ${m * m} + ${pn(2 * k)} = ${ans} 이다.`, "Compute."),
        ],
        variant: "sum_then_sum_of_squares",
      });
    },
  },
  {
    id: "nes.irrational_sum_of_roots.repr_shift", skill: SKILL, kind: "irrational_sum_of_roots", operator: "repr_shift",
    structure: "직사각형의 가로 w, 세로 aw+b, 넓이 A 라는 문장을 w(aw+b)=A 로 세우고 표준형 이차방정식의 두 근의 합 -b/a 를 구한다",
    extraThinking: "문장(넓이 조건)을 식으로 모델링해 표준형으로 정리한 뒤, 도형에서는 의미 없는 근까지 포함한 근의 합을 읽음 — medium 은 이미 식으로 주어진 방정식의 합",
    concepts: ["도형 문장의 식 세우기(넓이)", "표준형 정리", "근과 계수의 관계"], mediumSteps: 3,
    generate(rng) {
      const a = rng.int(1, 4), b = rng.nz(-8, 9), A = rng.int(8, 120); const D = b * b + 4 * a * A; if (isSquare(D)) throw new GenFail("x");
      const len = `${b > 0 ? `${b} more than` : `${-b} less than`} ${a === 1 ? "the width" : a === 2 ? "twice the width" : `${a} times the width`}`;
      const sum = -b / a; const w0 = rng.int(2, 6);
      const ctx = rng.pick([["rectangular garden", "meters"], ["rectangular poster", "inches"], ["rectangular patio", "feet"], ["rectangular banner", "feet"], ["rectangular field", "yards"]] as const);
      const sem = rectSem("area", "w", `${a === 1 ? "" : a}w ${b < 0 ? "-" : "+"} ${Math.abs(b)}`.replace(/^w/, "1w"), { w: w0 });
      return finish(rng, {
        stimulus: spin(rng, `A ${ctx[0]} has a width of w ${ctx[1]}. Its length is ${len}, and its area is ${A} square ${ctx[1]}.`) + spin(rng, ` [[Writing the area condition as an equation in w gives a quadratic equation.|The area condition can be written as a quadratic equation in w.|Setting the area expression equal to the given area gives a quadratic equation in w.]]`),
        question: spin(rng, "[[What is the sum of the two solutions of this quadratic equation (including any solution that does not make sense as a width)?|What is the sum of both solutions of the equation, even a solution that could not be a width?|If both solutions of the equation are added, including one that cannot be a width, what is the sum?]]"), correct: sum,
        fmt: fracOf,
        wrongs: [{ v: b / a, kind: "sign_error", reason: "근의 합 -b/a 의 부호를 놓쳤다." }, { v: -b, kind: "step_missing", reason: "최고차 계수 a 로 나누지 않았다." }, { v: A / a, kind: "formula_misuse", reason: "합 대신 곱 A/a 의 크기를 골랐다." }, { v: -A / a, kind: "formula_misuse", reason: "합 대신 곱 -A/a 를 골랐다." }, { v: sum + 1, kind: "other", reason: "계산 오류." }, { v: -sum + 1, kind: "other", reason: "계산 오류." }],
        verificationJs: withParams({ a, b, A }, "const g=w=>w*(P.a*w+P.b)-P.A; const c0=g(0), g1=g(1), gm=g(-1); const qa=(g1+gm)/2-c0, qb=(g1-gm)/2; const D=qb*qb-4*qa*c0; if(!(D>0)) throw new Error('실근 없음'); const x1=(-qb+Math.sqrt(D))/(2*qa), x2=(-qb-Math.sqrt(D))/(2*qa); return x1+x2;"),
        trace: [
          T(`가로가 w, 세로가 ${len} 이므로 세로는 ${a === 1 ? "" : a}w ${b < 0 ? "-" : "+"} ${Math.abs(b)} 이다.`, "Write the length in terms of w."),
          T(`넓이 = 가로 × 세로 이므로 $w(${a === 1 ? "" : a}w ${b < 0 ? "-" : "+"} ${Math.abs(b)}) = ${A}$ 이다.`, "Area is width times length."),
          T(`전개해 표준형으로 정리하면 $${quadStr(a, b, -A, "w")} = 0$ 이다.`, "Expand and move everything to one side."),
          T(`판별식 ${b * b} + ${4 * a * A} = ${D} > 0 이므로 서로 다른 두 실근이 있다.`, "Two real solutions exist."),
          T(`두 근의 합은 -(${b})/${a} = ${fracOf(sum)} 이다.`, "Use -b/a."),
        ],
        variant: "area_equation_sum",
        semantics: [sem],
      });
    },
  },

  // ───────────── irrational_product_of_roots ─────────────
  {
    id: "nes.irrational_product_of_roots.inverse", skill: SKILL, kind: "irrational_product_of_roots", operator: "inverse",
    structure: "ax²+bx+c=0 의 해가 (u ± √D)/w 로 주어졌을 때 분자·분모·근호 안에서 b 와 c 를 역산한다",
    extraThinking: "근의 공식 결과에서 b = -u, 판별식 b²-4ac = D 로 c 를 거꾸로 푸는 역방향 재구성 — medium 은 무리수 근 방정식의 근의 곱 c/a 를 읽음",
    concepts: ["근의 공식", "판별식 역산", "계수 비교"], mediumSteps: 3,
    generate(rng) {
      const a = rng.int(2, 5), b = rng.nz(-9, 9), c = rng.nz(-12, 12), D = b * b - 4 * a * c; if (D <= 0 || isSquare(D) || D > 300) throw new GenFail("x");
      const L = rng.pick([["b", "c"], ["p", "q"], ["m", "k"]] as const);
      return finish(rng, {
        stimulus: spin(rng, `[[In the equation below|For the equation shown|In the given equation|In the equation given here]], ${L[0]} and ${L[1]} are integers. The solutions of the equation are `) + M(`\\frac{${-b} \\pm \\sqrt{${D}}}{${2 * a}}`) + ".\n\n" + M(`${a}x^2 + ${L[0]}x + ${L[1]} = 0`),
        question: spin(rng, `[[What is the value of ${L[1]}?|Find ${L[1]}.|What must ${L[1]} equal?]]`), correct: c,
        wrongs: [{ v: (b * b + D) / (4 * a), kind: "sign_error", reason: "D = b² - 4ac 를 c 에 대해 풀 때 D 의 부호를 반대로 적용했다." }, { v: -c, kind: "sign_error", reason: "부호를 반대로 적었다." }, { v: b * b - D, kind: "step_missing", reason: "4a 로 나누지 않았다." }, { v: (b * b - D) / (2 * a), kind: "formula_misuse", reason: "4ac 를 2ac 로 계산했다." }, { v: -b, kind: "step_missing", reason: "b 만 구했다." }, { v: c + 1, kind: "other", reason: "계산 오류." }, { v: c - 1, kind: "other", reason: "계산 오류." }],
        verificationJs: withParams({ a, u: -b, D, w: 2 * a }, "const t1=(P.u+Math.sqrt(P.D))/P.w, t2=(P.u-Math.sqrt(P.D))/P.w; const hits=[]; for(let b=-60;b<=60;b++) for(let c=-120;c<=120;c++){ const d=b*b-4*P.a*c; if(d<=0) continue; const r1=(-b+Math.sqrt(d))/(2*P.a), r2=(-b-Math.sqrt(d))/(2*P.a); const ok=(Math.abs(r1-t1)<1e-9&&Math.abs(r2-t2)<1e-9)||(Math.abs(r1-t2)<1e-9&&Math.abs(r2-t1)<1e-9); if(ok) hits.push(c); }\nif(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];"),
        trace: [
          T(`근의 공식 x = (-${L[0]} ± √(${L[0]}² - 4·${a}·${L[1]})) / ${2 * a} 와 주어진 해를 비교한다.`, "Compare with the quadratic formula."),
          T(`분모 ${2 * a} = 2·${a} 로 a = ${a} 와 일치한다.`, "The denominator matches 2a."),
          T(`분자의 -${L[0]} = ${-b} 이므로 ${L[0]} = ${b} 이다.`, "Read the linear coefficient."),
          T(`근호 안: ${L[0]}² - 4·${a}·${L[1]} = ${D}, 즉 ${b * b} - ${4 * a}${L[1]} = ${D} 이다.`, "Set the discriminant equal to the radicand."),
          T(`이를 풀면 ${L[1]} = ${c} 이다.`, "Solve for the constant."),
        ],
        variant: "formula_inverse",
      });
    },
  },
  {
    id: "nes.irrational_product_of_roots.compose_kind", skill: SKILL, kind: "irrational_product_of_roots", operator: "compose_kind",
    structure: "x² - b|x| + c = 0 에서 u = |x| 로 치환해 u 의 두 양근을 구하고 x = ±u 네 해의 곱을 구한다",
    extraThinking: "절댓값 방정식을 이차식으로 치환하고 양·음 대칭 해 4개의 곱(부호·제곱 처리)을 계산 — medium 은 이차방정식 두 해의 곱",
    concepts: ["절댓값 치환", "근과 계수의 관계", "대칭 해의 곱"], mediumSteps: 3,
    generate(rng) {
      const c = rng.int(1, 12), b = rng.int(3, 9), D = b * b - 4 * c; if (D <= 0 || isSquare(D) || b * b < 4 * c + 1) throw new GenFail("x");
      return finish(rng, {
        stimulus: spin(rng, `[[Consider the equation below|The equation below involves an absolute value|For the equation shown, x is a real number]]. `) + M(`x^2 - ${b}|x| + ${c} = 0`),
        question: spin(rng, "[[What is the product of all real solutions of the equation?|What is the product of all of the real solutions?|Find the product of every real solution of the equation.]]"), correct: c * c,
        wrongs: [{ v: c, kind: "step_missing", reason: "|x| 의 두 근의 곱 c 에서 멈췄다(x = ±u 네 해의 곱이 아님)." }, { v: -c * c, kind: "sign_error", reason: "(+u)(-u) 의 부호를 처리하다 네 해 전체의 부호를 음수로 적었다." }, { v: -c, kind: "sign_error", reason: "한 쌍의 곱 -u² 만 사용했다." }, { v: b, kind: "formula_misuse", reason: "|x| 의 두 근의 합을 답으로 골랐다." }, { v: 0, kind: "other", reason: "대칭이라 곱이 0 이라고 착각했다." }, { v: c * c + 1, kind: "other", reason: "계산 오류." }],
        verificationJs: withParams({ b, c }, "const D=P.b*P.b-4*P.c; if(!(D>0)) throw new Error('실근 없음'); const u1=(P.b+Math.sqrt(D))/2, u2=(P.b-Math.sqrt(D))/2; if(!(u1>0&&u2>0)) throw new Error('양근 아님'); const xs=[u1,-u1,u2,-u2]; const v=xs.reduce((t,x)=>t*x,1), rv=Math.round(v); if(Math.abs(v-rv)>1e-6) throw new Error('정수 아님'); return rv;"),
        trace: [
          T("|x| = u (u ≥ 0) 로 치환하면 x² = u² 이므로 $u^2 - " + b + "u + " + c + " = 0$ 이다.", "Substitute u = |x|."),
          T(`판별식 ${b * b} - ${4 * c} = ${D} > 0 이고 근의 합 ${b} > 0, 곱 ${c} > 0 이므로 두 근 u₁, u₂ 는 모두 양수이다.`, "Both roots in u are positive."),
          T("각 u 에 대해 x = ±u 이므로 실근은 네 개 u₁, -u₁, u₂, -u₂ 이다.", "Each positive u gives two real solutions."),
          T("네 해의 곱은 (u₁)(-u₁)(u₂)(-u₂) = (u₁u₂)² 이다.", "The signs cancel in pairs."),
          T(`u₁u₂ = ${c} 이므로 곱은 ${c}² = ${c * c} 이다.`, "Use the product of roots."),
        ],
        variant: "absolute_value_substitution",
      });
    },
  },
  {
    id: "nes.irrational_product_of_roots.chain2", skill: SKILL, kind: "irrational_product_of_roots", operator: "chain2",
    structure: "첫 방정식(무리수 근)의 근의 곱 k 를 구한 뒤 둘째 방정식 x² + (k+m)x + km = 0 을 인수분해해 큰 근을 구한다",
    extraThinking: "무리수 근을 풀지 않고 곱을 읽은 뒤 그 값이 인수분해 가능한 둘째 방정식의 계수가 되는 연쇄 — medium 은 한 방정식의 곱",
    concepts: ["근과 계수의 관계", "연쇄 대입", "이차방정식 인수분해"], mediumSteps: 3,
    generate(rng) {
      const a1 = rng.int(1, 3), k = rng.nz(-6, 7), c1 = a1 * k, b1 = rng.nz(-9, 9), D1 = b1 * b1 - 4 * a1 * c1; if (D1 <= 0 || isSquare(D1)) throw new GenFail("x");
      const m = rng.int(2, 7); if (m === k) throw new GenFail("x"); const ans = Math.max(-k, -m);
      return finish(rng, {
        stimulus: spin(rng, `[[Let k be the product of the solutions of the equation|Let k represent the product of the two solutions of|Suppose k equals the product of the solutions of]] `) + M(`${quadStr(a1, b1, c1)} = 0`) + spin(rng, `[[. A second equation is given below|. Consider the second equation below, which uses k|. Then a second equation is written with that value of k]]:\n\n`) + M(`x^2 + (k + ${m})x + ${m}k = 0`),
        question: spin(rng, "[[What is the larger solution of the second equation?|What is the greater solution of the second equation?|Find the larger solution of the second equation.]]"), correct: ans,
        wrongs: [{ v: Math.min(-k, -m), kind: "other", reason: "큰 근이 아니라 작은 근을 골랐다." }, { v: Math.max(k, m), kind: "sign_error", reason: "근의 부호를 반대로 적었다(인수 (x+k)(x+m) 의 근은 -k, -m)." }, { v: k, kind: "step_missing", reason: "k 만 구했다." }, { v: m, kind: "sign_error", reason: "인수 (x+m) 의 근을 m 으로 읽었다." }, { v: -k - m, kind: "formula_misuse", reason: "두 근의 합을 골랐다." }, { v: k * m, kind: "formula_misuse", reason: "두 근의 곱을 골랐다." }],
        verificationJs: withParams({ a1, b1, c1, m }, "const D1=P.b1*P.b1-4*P.a1*P.c1; if(!(D1>0)) throw new Error('첫 실근 없음'); const x1=(-P.b1+Math.sqrt(D1))/(2*P.a1), x2=(-P.b1-Math.sqrt(D1))/(2*P.a1); const kk=x1*x2, k=Math.round(kk); if(Math.abs(kk-k)>1e-9) throw new Error('곱이 정수 아님'); const r=[]; for(let x=-200;x<=200;x++) if(x*x+(k+P.m)*x+P.m*k===0) r.push(x); if(r.length!==2) throw new Error('둘째 근 2개 아님'); return Math.max(...r);"),
        trace: [
          T(`첫 방정식의 판별식 ${b1 * b1} - ${4 * a1 * c1} = ${D1} 는 완전제곱수가 아니므로 해는 무리수이다. 곱의 공식을 쓴다.`, "The roots are irrational; use the product formula."),
          T(`두 해의 곱은 ${c1}/${a1} = ${k} 이므로 k = ${k} 이다.`, "Compute k."),
          T(`둘째 방정식에 k = ${k} 를 대입하면 $x^2 + ${W(k + m)}x + ${W(m * k)} = 0$ 이다.`, "Substitute k."),
          T(`인수분해하면 $(x + ${W(k)})(x + ${m}) = 0$ 이다.`, "Factor."),
          T(`근은 ${-k} 와 ${-m} 이고 큰 근은 ${ans} 이다.`, "Pick the larger solution."),
        ],
        variant: "product_then_factor",
      });
    },
  },
  {
    id: "nes.irrational_product_of_roots.repr_shift", skill: SKILL, kind: "irrational_product_of_roots", operator: "repr_shift",
    structure: "가격 p 와 판매량 D-mp 로부터 매출 R 의 식 p(D-mp)=R 을 세워 표준형으로 정리하고 두 근의 곱 R/m 을 구한다",
    extraThinking: "문장(가격·판매량·매출)을 식으로 모델링한 뒤 표준형의 상수항과 최고차 계수의 비를 읽음 — medium 은 식으로 주어진 방정식의 곱",
    concepts: ["문장 모델링(매출=가격×판매량)", "표준형 정리", "근과 계수의 관계"], mediumSteps: 3,
    generate(rng) {
      const m = rng.int(1, 5), D = rng.int(20, 60), R = rng.int(30, Math.min(999, Math.floor((D * D) / (4 * m)) - 1)); const disc = D * D - 4 * m * R; if (disc <= 0 || isSquare(disc)) throw new GenFail("x");
      const ctx = rng.pick([["theater", "tickets", "ticket"], ["bookstore", "notebooks", "notebook"], ["bakery", "loaves of bread", "loaf"], ["museum shop", "posters", "poster"], ["school store", "water bottles", "bottle"]] as const);
      const sem = { noun: "revenue", expr: `p(${D} - ${m}p)`, parts: ["p", `${D} - ${m}p`], vars: { p: 3 } };
      return finish(rng, {
        stimulus: `A ${ctx[0]} sells ${ctx[1]} at a price of p dollars per ${ctx[2]}. At that price, it sells ${D} - ${m}p ${ctx[1]} per day, and the revenue is ${R} dollars per day.` + spin(rng, ` [[Writing the revenue condition as an equation in p gives a quadratic equation.|The revenue condition can be written as a quadratic equation in p.|Setting the revenue expression equal to the given revenue gives a quadratic equation in p.]]`),
        question: spin(rng, "[[What is the product of the two solutions of this quadratic equation?|What is the product of both solutions of the equation?|If both solutions of the equation are multiplied, what is the product?]]"), correct: R / m,
        fmt: fracOf,
        wrongs: [{ v: -R / m, kind: "sign_error", reason: "표준형 mp² - Dp + R = 0 의 상수항 부호를 잘못 읽었다." }, { v: R, kind: "step_missing", reason: "최고차 계수 m 으로 나누지 않았다." }, { v: D / m, kind: "formula_misuse", reason: "곱 대신 합 D/m 을 골랐다." }, { v: -D / m, kind: "formula_misuse", reason: "곱 대신 합의 부호를 바꾼 값을 골랐다." }, { v: R / m + 1, kind: "other", reason: "계산 오류." }, { v: (R * 4) / m, kind: "other", reason: "계산 오류." }],
        verificationJs: withParams({ m, D, R }, "const g=p=>p*(P.D-P.m*p)-P.R; const c0=g(0), g1=g(1), gm=g(-1); const qa=(g1+gm)/2-c0, qb=(g1-gm)/2; const disc=qb*qb-4*qa*c0; if(!(disc>0)) throw new Error('실근 없음'); const x1=(-qb+Math.sqrt(disc))/(2*qa), x2=(-qb-Math.sqrt(disc))/(2*qa); return x1*x2;"),
        trace: [
          T(`가격이 p 이고 판매량이 ${D} - ${m}p 이므로 매출 = 가격 × 판매량 = p(${D} - ${m}p) 이다.`, "Revenue is price times quantity."),
          T(`매출이 ${R} 이므로 $p(${D} - ${m}p) = ${R}$ 이다.`, "Set revenue equal to the given amount."),
          T(`전개해 표준형으로 정리하면 $${m}p^2 - ${D}p + ${R} = 0$ 이다.`, "Expand and move all terms to one side."),
          T(`판별식 ${D * D} - ${4 * m * R} = ${disc} > 0 이고 완전제곱수가 아니므로 해는 서로 다른 무리수이다.`, "The solutions are irrational real numbers."),
          T(`두 근의 곱은 ${R}/${m} = ${fracOf(R / m)} 이다.`, "Use c/a."),
        ],
        variant: "revenue_equation_product",
        semantics: [sem],
      });
    },
  },

  // ───────────── irrational_root_radical_form ─────────────
  {
    id: "nes.irrational_root_radical_form.inverse", skill: SKILL, kind: "irrational_root_radical_form", operator: "inverse",
    structure: "정수 계수 이차방정식의 한 해가 p ± q√n 일 때 켤레근 정리로 다른 해를 근호꼴로 적는다",
    extraThinking: "한 해에서 다른 해를 역으로 추론(켤레근 정리, 합 2p 로 확인)하고 근호꼴을 정리 — medium 은 방정식을 직접 풀어 근호꼴로 적음",
    concepts: ["켤레근 정리", "근과 계수의 관계", "근호 표기"], mediumSteps: 3,
    generate(rng) {
      const p = rng.int(-6, 6), q = rng.int(1, 3), n = rng.pick(NS); const sgn = rng.pick([1, -1]); const given = [p, sgn * q, n] as [number, number, number], other = [p, -sgn * q, n] as [number, number, number];
      if (p === 0 && false) throw new GenFail("x");
      const L = rng.pick([["b", "c"], ["m", "k"]] as const);
      return finish(rng, {
        stimulus: spin(rng, `[[In the equation below|For the equation shown|In the given equation|In the equation given here]], ${L[0]} and ${L[1]} are integers, and one solution of the equation is `) + M(radStr(...given)) + ".\n\n" + M(`x^2 + ${L[0]}x + ${L[1]} = 0`),
        question: spin(rng, "[[What is the other solution of the equation?|Which of the following is the other solution of the equation?|What is the second solution?]]"), correctText: M(radStr(...other)), evalAt: {},
        wrongTexts: [rw([-p, sgn * q, n], "sign_error", "켤레가 아니라 부호가 다른 근을 골랐다(해의 합이 2p 가 아님)."), rw([-p, -sgn * q, n], "sign_error", "전체 부호를 반대로 적었다."), rw(given, "step_missing", "주어진 해를 그대로 골랐다."), rw([p, -sgn * q * q, n], "formula_misuse", "근호 앞 계수를 제곱했다."), rw([2 * p, -sgn * q, n], "formula_misuse", "합 2p 를 상수로 사용했다.")],
        verificationJs: withParams({ p, q: sgn * q, n }, "const r0=P.p+P.q*Math.sqrt(P.n); const hits=[]; for(let b=-40;b<=40;b++) for(let c=-120;c<=120;c++){ if(Math.abs(r0*r0+b*r0+c)<1e-9) hits.push(-b-r0); } if(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];"),
        trace: [
          T(`${L[0]}, ${L[1]} 가 정수이므로 무리수 해는 켤레와 함께 나온다.`, "With integer coefficients irrational solutions come in conjugate pairs."),
          T(`한 해가 $${radStr(...given)}$ 이므로 다른 해는 켤레 $${radStr(...other)}$ 이다.`, "The other solution is the conjugate."),
          T(`두 해의 합은 2·(${p}) = ${2 * p} 이고 이것이 -${L[0]} 와 같아야 한다 (${L[0]} = ${-2 * p}).`, "Check with the sum of solutions."),
          T(`두 해의 곱은 (${p})² - (${q}√${n})² = ${p * p - q * q * n} 으로 정수이다.`, "Check the product is an integer."),
          T(`다른 해는 $${radStr(...other)}$ 이다.`, "State the other solution."),
        ],
        variant: "conjugate_other_root",
      });
    },
  },
  {
    id: "nes.irrational_root_radical_form.chain2", skill: SKILL, kind: "irrational_root_radical_form", operator: "chain2",
    structure: "x² - 2px + c = 0 의 큰 해 k 를 근호꼴로 구한 뒤 k² 을 전개해 근호꼴로 정리한다",
    extraThinking: "근의 공식 → 근호 정리 → 이항 제곱 전개 → 동류항 정리의 4단 연쇄 — medium 은 근호꼴 해를 구하는 한 단계",
    concepts: ["근의 공식·근호 정리", "이항식 제곱", "근호 동류항 정리"], mediumSteps: 3,
    generate(rng) {
      const p = rng.int(1, 6), q = rng.int(1, 3), n = rng.pick(NS); const b = -2 * p, c = p * p - q * q * n; if (Math.abs(c) > 60) throw new GenFail("x");
      const A = p * p + q * q * n, B = 2 * p * q;
      return finish(rng, {
        stimulus: spin(rng, `[[Let k be the larger solution of the equation|Let k represent the greater of the two solutions of|Suppose k is the larger solution of]] `) + M(`${quad(b, c)} = 0`) + ".",
        question: spin(rng, "[[Which of the following is equal to the square of k?|What is the value of the square of k, written in simplest radical form?|Which expression is equivalent to k squared?]]"), correctText: M(radStr(A, B, n)), evalAt: {},
        wrongTexts: [rw([A, -2 * p * q, n], "other", "큰 해가 아니라 작은 해의 제곱을 구했다."), rw([A, 0, n], "step_missing", "이항 제곱에서 중간항(2pq√n)을 빠뜨렸다."), rw([p * p, 2 * p * q, n], "formula_misuse", "(q√n)² = q²n 을 더하지 않았다."), rw([A, p * q, n], "formula_misuse", "중간항의 2 를 빠뜨렸다."), rw([A, 2 * p * q * q, n], "formula_misuse", "중간항에 q 를 두 번 곱했다."), rw([p * p + q * n, 2 * p * q, n], "formula_misuse", "(q√n)² 을 qn 으로 계산했다.")],
        verificationJs: withParams({ b, c }, "const D=P.b*P.b-4*P.c; if(!(D>0)) throw new Error('실근 없음'); const k=(-P.b+Math.sqrt(D))/2; return k*k;"),
        trace: [
          T("근의 공식으로 큰 해를 구한다.", "Use the quadratic formula."),
          T(`$k = ${p} + ${q === 1 ? "" : q}\\sqrt{${n}}$ 로 근호를 정리한다 (판별식 ${b * b - 4 * c} = ${4 * q * q * n}).`, "Simplify the radical."),
          T(`제곱한다: $k^2 = (${p})^2 + 2(${p})(${q}\\sqrt{${n}}) + (${q}\\sqrt{${n}})^2$ .`, "Square the binomial."),
          T(`$(${q}\\sqrt{${n}})^2 = ${q * q * n}$ 이므로 상수항은 ${p * p} + ${q * q * n} = ${A} 이다.`, "Evaluate the radical square."),
          T(`$k^2 = ${radStr(A, 2 * p * q, n)}$ 이다.`, "Combine like terms."),
        ],
        variant: "square_of_root",
      });
    },
  },
  {
    id: "nes.irrational_root_radical_form.constraint_select", skill: SKILL, kind: "irrational_root_radical_form", operator: "constraint_select",
    structure: "x² - 2px + c = 0 의 두 무리수 해 중 부호 조건(양수/음수)을 만족하는 해를 근호꼴로 적는다",
    extraThinking: "두 해의 부호(c<0 이면 서로 다른 부호)를 판단해 조건에 맞는 해를 고르고 근호를 정리 — medium 은 근호꼴의 두 해를 구함",
    concepts: ["근의 공식·근호 정리", "근의 부호 판단", "조건에 맞는 해 선택"], mediumSteps: 3,
    generate(rng) {
      const p = rng.int(-6, 6), q = rng.int(1, 3), n = rng.pick(NS); const b = -2 * p, c = p * p - q * q * n; if (!(c < 0) || Math.abs(c) > 60 || (p === 0)) throw new GenFail("x");
      const pos = rng.chance(0.5); const ans: [number, number, number] = pos ? [p, q, n] : [p, -q, n];
      return finish(rng, {
        stimulus: spin(rng, `[[Consider the equation below|The equation below has two real solutions, one positive and one negative|For the equation shown, x is a real number]]. `) + M(`${quad(b, c)} = 0`),
        question: pos ? spin(rng, "[[What is the positive solution of the equation?|Which of the following is the positive solution?|What is the solution of the equation that is greater than 0?]]") : spin(rng, "[[What is the negative solution of the equation?|Which of the following is the negative solution?|What is the solution of the equation that is less than 0?]]"), correctText: M(radStr(...ans)), evalAt: {},
        wrongTexts: [rw(pos ? [p, -q, n] : [p, q, n], "other", "조건(부호)에 맞지 않는 다른 해를 골랐다."), rw([-p, pos ? q : -q, n], "sign_error", "근의 공식에서 -b 의 부호를 놓쳤다."), rw([-p, pos ? -q : q, n], "sign_error", "전체 부호를 반대로 적었다."), rw([p, pos ? q * q : -q * q, n], "formula_misuse", "근호를 정리할 때 계수를 제곱했다."), rw([2 * p, pos ? q : -q, n], "formula_misuse", "2p 를 해의 상수로 사용했다(2 로 나누지 않음).")],
        verificationJs: withParams({ b, c, pos: pos ? 1 : 0 }, "const D=P.b*P.b-4*P.c; if(!(D>0)) throw new Error('실근 없음'); const x1=(-P.b+Math.sqrt(D))/2, x2=(-P.b-Math.sqrt(D))/2; const cand=[x1,x2].filter(x=>P.pos? x>0 : x<0); if(cand.length!==1) throw new Error('조건 해가 유일하지 않음'); return cand[0];"),
        trace: [
          T(`상수항 ${c} < 0 이므로 두 해의 곱이 음수여서 한 해는 양수, 한 해는 음수이다.`, "A negative constant means the solutions have opposite signs."),
          T(`근의 공식: x = (${-b} ± √${b * b - 4 * c}) / 2 이다.`, "Apply the quadratic formula."),
          T(`√${b * b - 4 * c} = ${2 * q}√${n} 로 정리하면 x = ${p} ± ${q}√${n} 이다.`.replace(`${2 * q}√${n}`, `${2 * q === 2 ? "2" : 2 * q}√${n}`), "Simplify the radical."),
          T(`${pos ? "양수" : "음수"} 해는 ${pos ? "+" : "-"} 부호를 택한 $${radStr(...ans)}$ 이다 (반대 부호 해는 $${radStr(...(pos ? [p, -q, n] : [p, q, n]) as [number, number, number])}$ 로 조건에 맞지 않는다).`, "Choose the solution matching the sign condition."),
          T(`답: $${radStr(...ans)}$.`, "State the answer."),
        ],
        variant: pos ? "positive_root" : "negative_root",
      });
    },
  },
  {
    id: "nes.irrational_root_radical_form.compose_kind", skill: SKILL, kind: "irrational_root_radical_form", operator: "compose_kind",
    structure: "차가 2e 이고 제곱의 합이 N 인 두 양수에서 이차방정식을 세워 근호꼴의 큰 수 e + q√n 을 구한다",
    extraThinking: "문장(수의 관계)을 이차방정식으로 모델링해 근의 공식과 근호 정리, 양수 조건 선택, 큰 수 계산까지 연결 — medium 은 주어진 방정식의 근호꼴 해",
    concepts: ["문장 모델링", "근의 공식·근호 정리", "양수 조건 선택"], mediumSteps: 3,
    generate(rng) {
      const e = rng.int(1, 4), q = rng.int(1, 3), n = rng.pick(NS); if (q * q * n <= e * e) throw new GenFail("x"); const d = 2 * e, N = 2 * (e * e + q * q * n); if (N > 400) throw new GenFail("x");
      return finish(rng, {
        stimulus: spin(rng, `[[Two positive numbers differ by ${d}|The difference between two positive numbers is ${d}|Two positive numbers have a difference of ${d}]], and the sum of their squares is ${N}.`),
        question: spin(rng, "[[What is the larger of the two numbers?|Which of the following is the greater of the two numbers?|What is the value of the larger number?]]"), correctText: M(radStr(e, q, n)), evalAt: {},
        wrongTexts: [rw([-e, q, n], "other", "큰 수가 아니라 작은 수를 골랐다."), rw([e, q * q, n], "formula_misuse", "근호 정리에서 계수를 제곱했다."), rw([2 * e, q, n], "formula_misuse", "근의 공식에서 2 로 나누지 않아 상수를 두 배로 썼다."), rw([-e, -q, n], "sign_error", "전체 부호를 반대로 적었다."), rw([e, 2 * q, n], "formula_misuse", "근호 안을 4 로 나누는 과정을 놓쳤다.")],
        verificationJs: withParams({ d, N }, "let lo=0, hi=60; for(let i=0;i<200;i++){ const mid=(lo+hi)/2; const f=mid*mid+(mid+P.d)*(mid+P.d)-P.N; if(f<0) lo=mid; else hi=mid; } const x=(lo+hi)/2; if(Math.abs(x*x+(x+P.d)*(x+P.d)-P.N)>1e-6) throw new Error('수렴 실패'); return x+P.d;"),
        trace: [
          T(`작은 수를 x 라 하면 큰 수는 x + ${d} 이다.`, "Let the smaller number be x."),
          T(`제곱의 합: $x^2 + (x + ${d})^2 = ${N}$ 이다.`, "Write the sum of squares."),
          T(`전개·정리하면 $x^2 + ${d}x + ${(d * d - N) / 2} = 0$ 이다.`, "Expand and simplify."),
          T(`근의 공식으로 x = ${-e} ± ${q}√${n} 이고, 양수이므로 x = $${radStr(-e, q, n)}$ 이다.`, "Choose the positive solution."),
          T(`큰 수는 x + ${d} = $${radStr(e, q, n)}$ 이다.`, "Add the difference."),
        ],
        variant: "two_numbers_sum_of_squares",
      });
    },
  },

  // ───────────── linear_quadratic_intersection ─────────────
  {
    id: "nes.linear_quadratic_intersection.param_condition", skill: SKILL, kind: "linear_quadratic_intersection", operator: "param_condition",
    structure: "포물선 y=x²+bx+c 와 직선 y=mx+k 가 한 점에서 만나는(접하는) 조건 → 판별식 0 으로 k(또는 접점의 x좌표)를 구한다",
    extraThinking: "'한 점에서 만난다'를 두 식을 같게 놓은 이차방정식의 판별식 0 으로 번역해 직선의 상수를 정함 — medium 은 교점 개수 또는 좌표를 직접 구함",
    concepts: ["이차함수와 직선의 교점", "판별식 조건", "접점"], mediumSteps: 3,
    generate(rng) {
      const h = rng.int(-7, 7), b = rng.int(-6, 6), c = rng.int(-9, 9), m = b + 2 * h, k = c - h * h; if (m === 0 || Math.abs(k) > 60 || h === 0) throw new GenFail("x");
      const askX = rng.chance(0.4);
      return finish(rng, {
        stimulus: spin(rng, `[[In the xy-plane, the graph of the parabola and the line below intersect at exactly one point|The parabola and the line given by the equations below touch at exactly one point in the xy-plane|The graphs of the two equations below meet at exactly one point in the xy-plane]]. The constant k is a real number.\n\n`) + M(`y = ${quad(b, c)}`) + "\n" + M(`y = ${lin(m, 0)} + k`),
        question: askX ? spin(rng, "[[What is the x-coordinate of the point of intersection?|What is the x-coordinate of the point where the graphs meet?|At what value of x do the graphs intersect?]]") : spin(rng, "[[What is the value of k?|Find k.|What must k equal?]]"), correct: askX ? h : k,
        wrongs: askX
          ? [{ v: -h, kind: "sign_error", reason: "중근 x = -(b-m)/2 의 부호를 놓쳤다." }, { v: b - m, kind: "step_missing", reason: "이차방정식의 x 계수만 읽었다(2 로 나누지 않음)." }, { v: m - b, kind: "step_missing", reason: "x 계수의 부호를 바꿨지만 2 로 나누지 않았다." }, { v: k, kind: "step_missing", reason: "k 만 구했다." }, { v: (m - b) / 2 + 1, kind: "other", reason: "계산 오류." }]
          : [{ v: c + h * h, kind: "sign_error", reason: "c - k = h² 에서 k 의 부호를 놓쳤다." }, { v: c, kind: "step_missing", reason: "상수항 c 를 k 로 골랐다." }, { v: h * h, kind: "step_missing", reason: "h² 만 골랐다." }, { v: -k, kind: "sign_error", reason: "부호를 반대로 적었다." }, { v: c - (b - m) * (b - m), kind: "formula_misuse", reason: "D = 0 에서 (b-m)² = 4(c-k) 의 4 를 놓쳤다." }],
        verificationJs: withParams({ b, c, m, ask: askX ? 1 : 0 }, "const hits=[]; for(let k=-200;k<=200;k++){ let mn=Infinity, ax=0; for(let x=-60;x<=60;x++){ const g=x*x+(P.b-P.m)*x+(P.c-k); if(g<mn){mn=g;ax=x;} } if(mn===0) hits.push(P.ask? ax : k); }\nif(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];"),
        trace: [
          T("교점에서 두 식의 y 가 같으므로 이차식과 직선식을 같게 놓는다.", "Set the two expressions for y equal."),
          T(`$${quad(b, c)} = ${lin(m, 0)} + k$ 를 정리하면 $${quadStr(1, b - m, c, "x")} - k = 0$ 이다.`, "Rearrange into standard form."),
          T("한 점에서 만나므로 이 방정식이 중근을 가져야 한다: 판별식 D = 0.", "One intersection point means a double root."),
          T(`(${b - m})² - 4(${c} - k) = 0 에서 k = ${c} - ${(b - m) * (b - m)}/4 = ${k} 이다.`, "Solve D = 0 for k."),
          T(`중근은 x = -(${b - m})/2 = ${h} 이다.${askX ? "" : " 묻는 값은 k 이다."}`, "The double root is the x-coordinate of the touching point."),
        ],
        variant: askX ? "tangent_x" : "tangent_k",
      });
    },
  },
  {
    id: "nes.linear_quadratic_intersection.compose_kind", skill: SKILL, kind: "linear_quadratic_intersection", operator: "compose_kind",
    structure: "직선이 지나는 두 점으로 직선의 식을 구하고 포물선과의 교점의 x(또는 y)좌표 합을 구한다",
    extraThinking: "두 점에서 직선의 식(기울기·절편)을 구하는 개념과 교점 개념을 연결 — medium 은 식이 주어진 직선과 포물선의 교점",
    concepts: ["두 점을 지나는 직선", "이차함수와 직선의 교점", "근과 계수의 관계"], mediumSteps: 3,
    generate(rng) {
      const m = rng.nz(-4, 4), n = rng.nz(-8, 8), r = rng.int(-5, 6), s = rng.int(-5, 6); if (r === s) throw new GenFail("x");
      const b = m - r - s, c = n + r * s; if (Math.abs(b) > 14 || Math.abs(c) > 40 || b === 0) throw new GenFail("x");
      const x1 = rng.int(-4, 4); let x2 = rng.int(-4, 4); if (x1 === x2) x2 = x1 + 2; const y1 = m * x1 + n, y2 = m * x2 + n;
      const ySum = rng.chance(0.4); const ans = ySum ? m * (r + s) + 2 * n : r + s;
      return finish(rng, {
        stimulus: spin(rng, `[[A line passes through the points (${x1}, ${y1}) and (${x2}, ${y2}) in the xy-plane|In the xy-plane, a line contains the points (${x1}, ${y1}) and (${x2}, ${y2})|The line in the xy-plane through (${x1}, ${y1}) and (${x2}, ${y2})]]. [[It intersects|The line crosses|The line meets]] the parabola ${M(`y = ${quad(b, c)}`)} at two points.`),
        question: ySum ? spin(rng, "[[What is the sum of the y-coordinates of the two points of intersection?|What is the sum of the y-coordinates of the intersection points?|If the two intersection points are added, what is the sum of their y-coordinates?]]") : spin(rng, "[[What is the sum of the x-coordinates of the two points of intersection?|What is the sum of the x-coordinates of the intersection points?|If the two intersection points are added, what is the sum of their x-coordinates?]]"), correct: ans,
        wrongs: ySum
          ? [{ v: r + s, kind: "step_missing", reason: "x 좌표의 합만 구했다." }, { v: m * (r + s) + n, kind: "step_missing", reason: "직선 대입 때 상수항 n 을 한 번만 더했다." }, { v: m * (r + s), kind: "step_missing", reason: "상수항의 합 2n 을 빠뜨렸다." }, { v: m * (r + s) - 2 * n, kind: "sign_error", reason: "절편의 부호를 잘못 구했다." }, { v: b - m, kind: "sign_error", reason: "근의 합 부호를 놓쳐 y 합을 계산했다." }]
          : [{ v: b - m, kind: "sign_error", reason: "두 근의 합이 -(계수) 라는 부호를 놓쳤다." }, { v: m + b, kind: "sign_error", reason: "x 계수를 옮길 때 부호를 놓쳤다." }, { v: -(r + s), kind: "sign_error", reason: "부호를 반대로 적었다." }, { v: c - n, kind: "formula_misuse", reason: "합 대신 상수항의 차를 골랐다." }, { v: m, kind: "step_missing", reason: "직선의 기울기만 구했다." }],
        verificationJs: withParams({ x1, y1, x2, y2, b, c, y: ySum ? 1 : 0 }, "const m=(P.y2-P.y1)/(P.x2-P.x1), n=P.y1-m*P.x1; const xs=[]; for(let x=-200;x<=200;x++) if(x*x+P.b*x+P.c===m*x+n) xs.push(x); if(xs.length!==2) throw new Error('교점이 2개 아님'); return P.y? xs.reduce((t,x)=>t+(m*x+n),0) : xs[0]+xs[1];"),
        trace: [
          T(`기울기 = (${y2} - ${pn(y1)}) / (${x2} - ${pn(x1)}) = ${m} 이다.`, "Compute the slope of the line."),
          T(`직선의 식은 y = ${lin(m, n)} 이다.`, "Find the intercept and write the line."),
          T(`교점에서는 y 가 같으므로 $${quad(b, c)} = ${lin(m, n)}$ 이다.`, "Set the two expressions equal."),
          T(`정리하면 $${quad(b - m, c - n)} = 0$ 이고 두 근의 합은 ${m - b} = ${r + s} 이다 (x 좌표의 합).`, "The sum of solutions gives the sum of x-coordinates."),
          ...(ySum ? [T(`y 좌표는 직선에서 나오므로 합은 ${m}·(${r + s}) + 2·(${n}) = ${ans} 이다.`, "Sum the y-coordinates through the line.")] : [T("판별식이 양수여서 서로 다른 두 교점이 있음을 확인한다.", "Check the discriminant is positive.")]),
        ],
        variant: ySum ? "points_to_line_sum_y" : "points_to_line_sum_x",
      });
    },
  },
  {
    id: "nes.linear_quadratic_intersection.repr_shift", skill: SKILL, kind: "linear_quadratic_intersection", operator: "repr_shift",
    structure: "직사각형의 넓이(가로의 이차식)가 둘레(가로의 일차식)의 p 배라는 문장을 w(w+d)=2p(2w+d) 로 세워 양의 해를 구한다",
    extraThinking: "넓이와 둘레를 혼동하지 않고 각각 올바른 식으로 모델링해 이차식=일차식의 교점 방정식을 세우고 양수 해를 선택 — medium 은 이미 식으로 주어진 교점",
    concepts: ["도형 문장의 식 세우기(넓이·둘레)", "이차식=일차식 방정식", "양수 해 선택"], mediumSteps: 3,
    generate(rng) {
      const d = rng.int(1, 20), p = rng.int(1, 8), k2 = d * d + 16 * p * p; const k = Math.round(Math.sqrt(k2)); if (k * k !== k2) throw new GenFail("x");
      const w = (4 * p - d + k) / 2; if (!Number.isInteger(w) || w <= 0 || w > 60) throw new GenFail("x");
      const ask = rng.pick(["width", "length", "area"] as const); const ans = ask === "width" ? w : ask === "length" ? w + d : w * (w + d);
      const ctx = rng.pick(["rectangular garden", "rectangular poster", "rectangular patio", "rectangular banner", "rectangular tile"] as const);
      const L = "w", Wd = `w + ${d}`;
      return finish(rng, {
        stimulus: `A ${ctx} has a width of w units. Its length is ${d} units more than its width. ${p === 1 ? "Its area, in square units, is numerically equal to its perimeter, in units." : `Its area, in square units, is numerically ${p} times its perimeter, in units.`}`,
        question: ask === "width" ? spin(rng, "[[What is the width of the rectangle, in units?|What is the value of w?|Find the width of the rectangle, in units.]]") : ask === "length" ? spin(rng, "[[What is the length of the rectangle, in units?|Find the length of the rectangle, in units.|How long is the rectangle, in units?]]") : spin(rng, "[[What is the area of the rectangle, in square units?|Find the area of the rectangle, in square units.|How many square units is the area of the rectangle?]]"), correct: ans,
        wrongs: [{ v: ask === "width" ? w + d : ask === "length" ? w : w * (w + d) / p, kind: "other", reason: "묻는 값이 아니라 다른 변(또는 다른 양)을 골랐다." }, { v: 2 * (2 * w + d), kind: "geometry_misapplied", reason: "둘레와 넓이를 혼동해 둘레 값을 골랐다." }, { v: ask === "area" ? w + d : w * (w + d), kind: "geometry_misapplied", reason: "넓이와 길이를 혼동했다." }, { v: ask === "width" ? 4 * p - d : ask === "length" ? 4 * p : w * w, kind: "formula_misuse", reason: "방정식을 세울 때 둘레를 4w 로만 계산하는 등 식 세우기가 틀렸다." }, { v: ans + 1, kind: "other", reason: "계산 오류." }, { v: Math.max(1, ans - 1), kind: "other", reason: "계산 오류." }],
        verificationJs: withParams({ d, p, ask: ask === "width" ? 0 : ask === "length" ? 1 : 2 }, "const hits=[]; for(let w=1;w<=300;w++){ const area=w*(w+P.d), per=2*(w+(w+P.d)); if(area===P.p*per) hits.push(P.ask===0? w : P.ask===1? w+P.d : area); }\nif(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];"),
        trace: [
          T(`세로(길이)는 w + ${d} 이다.`, "Express the length with w."),
          T(`넓이 = 가로 × 세로 = w(w + ${d}) 이다.`, "Area is width times length."),
          T(`둘레 = 2(가로 + 세로) = 2(2w + ${d}) = ${4}w + ${2 * d} 이다.`, "Perimeter is twice the sum of width and length."),
          T(`조건: w(w + ${d}) = ${p}(4w + ${2 * d}) 를 전개해 $w^2 + ${d - 4 * p === 0 ? "" : `${d - 4 * p}w`}${d - 4 * p === 0 ? "" : " "}- ${2 * p * d} = 0$ 으로 정리한다.`, "Set up the equation and write it in standard form."),
          T(`인수분해(또는 근의 공식)로 w = ${w} 또는 음수 해를 얻고 길이이므로 양수 w = ${w} 만 쓴다.`, "Choose the positive solution."),
          T(`묻는 값은 ${ans} 이다.`, "Answer the question asked."),
        ],
        variant: ask === "width" ? "ask_width" : ask === "length" ? "ask_length" : "ask_area",
        semantics: [rectSem("area", L, Wd, { w }), rectSem("perimeter", L, Wd, { w })],
      });
    },
  },
  {
    id: "nes.linear_quadratic_intersection.constraint_select", skill: SKILL, kind: "linear_quadratic_intersection", operator: "constraint_select",
    structure: "포물선과 직선의 두 교점 중 제1사분면(x>0, y>0)에 있는 점을 골라 y좌표를 구한다",
    extraThinking: "두 교점을 모두 구한 뒤 사분면 조건(양쪽 좌표 부호)으로 후보를 제거 — medium 은 교점의 x좌표를 구함",
    concepts: ["이차함수와 직선의 교점", "방정식 풀이", "사분면 조건 선택"], mediumSteps: 3,
    generate(rng) {
      const m = rng.nz(-4, 5), n = rng.int(-8, 10), r = rng.int(-6, 7), s = rng.int(-6, 7); if (r === s) throw new GenFail("x");
      const b = m - r - s, c = n + r * s; if (Math.abs(b) > 14 || Math.abs(c) > 40) throw new GenFail("x");
      const pts = [r, s].map((x) => [x, m * x + n] as [number, number]); const q1 = pts.filter(([x, y]) => x > 0 && y > 0); if (q1.length !== 1) throw new GenFail("x");
      const [qx, qy] = q1[0]; const other = pts.find((p) => p !== q1[0])!;
      return finish(rng, {
        stimulus: spin(rng, `[[The graphs of the two equations below intersect at two points|A parabola and a line are given by the equations below, and they cross at two points|The system of equations below graphs a parabola and a line that meet at two points]] in the xy-plane.\n\n`) + M(`y = ${quad(b, c)}`) + "\n" + M(`y = ${lin(m, n)}`),
        question: spin(rng, "[[What is the y-coordinate of the point of intersection that lies in the first quadrant?|What is the y-coordinate of the intersection point in quadrant I?|One of the two intersection points is in the first quadrant. What is its y-coordinate?]]"), correct: qy,
        wrongs: [{ v: other[1], kind: "condition_ignored", reason: "제1사분면 조건을 무시하고 다른 교점의 y 좌표를 골랐다." }, { v: qx, kind: "axis_misread", reason: "y 좌표가 아니라 x 좌표를 골랐다." }, { v: other[0], kind: "axis_misread", reason: "다른 교점의 x 좌표를 골랐다." }, { v: qx + qy, kind: "other", reason: "좌표의 합을 골랐다." }, { v: -qy, kind: "sign_error", reason: "부호를 반대로 적었다." }],
        verificationJs: withParams({ b, c, m, n }, "const hits=[]; for(let x=-200;x<=200;x++){ if(x*x+P.b*x+P.c===P.m*x+P.n){ const y=P.m*x+P.n; if(x>0&&y>0) hits.push(y); } } if(hits.length!==1) throw new Error('제1사분면 교점이 유일하지 않음'); return hits[0];"),
        trace: [
          T("교점에서 y 가 같으므로 두 식을 같게 놓는다.", "Set the expressions for y equal."),
          T(`$${quad(b - m, c - n)} = 0$ 을 만든다.`, "Rearrange to standard form."),
          T(`인수분해하면 x = ${r} 또는 x = ${s} 이다.`, "Factor to find the x-coordinates."),
          T(`직선에 대입해 두 교점 (${pts[0][0]}, ${pts[0][1]}), (${pts[1][0]}, ${pts[1][1]}) 를 구한다.`, "Find both intersection points."),
          T(`제1사분면은 x > 0 이고 y > 0 이므로 (${qx}, ${qy}) 만 해당한다.`, "Keep the point with both coordinates positive."),
          T(`y 좌표는 ${qy} 이다.`, "Read the y-coordinate."),
        ],
        variant: "first_quadrant_point",
      });
    },
  },

  // ───────────── parameter_discriminant ─────────────
  {
    id: "nes.parameter_discriminant.param_condition", skill: SKILL, kind: "parameter_discriminant", operator: "param_condition",
    structure: "x²+kx+(uk+m)=0 이 해를 하나만 갖는 k 의 값들 — 판별식 0 이 k 에 대한 이차방정식이 되어 그 근의 합·곱·큰 값을 묻는다",
    extraThinking: "해의 개수 조건이 매개변수에 대한 또 하나의 이차방정식(k²-4uk-4m=0)이 되는 이중 구조 — medium 은 계수 하나가 미지수인 판별식 부등식",
    concepts: ["판별식 조건", "매개변수 이차방정식", "근과 계수의 관계"], mediumSteps: 3,
    generate(rng) {
      const u = rng.pick([-4, -3, -2, -1, 1, 2, 3, 4]), j = rng.int(1, 6); if (j === Math.abs(u)) throw new GenFail("x"); const m = j * j - u * u; if (m === 0) throw new GenFail("x");
      const ask = rng.pick(["sum", "greater", "product"] as const); const k1 = 2 * u + 2 * j, k2 = 2 * u - 2 * j; const ans = ask === "sum" ? 4 * u : ask === "greater" ? Math.max(k1, k2) : -4 * m;
      return finish(rng, {
        stimulus: spin(rng, `[[In the equation below|For the equation shown|In the given equation|In the equation given here]], k is an integer constant. The equation has exactly one real solution.\n\n`) + M(`x^2 + kx + (${lin(u, m, "k")}) = 0`),
        question: ask === "sum" ? spin(rng, "[[What is the sum of all possible values of k?|What is the sum of every value of k for which this is true?|If all possible values of k are added, what is the sum?]]") : ask === "greater" ? spin(rng, "[[What is the greater of the two possible values of k?|What is the larger possible value of k?|Of the possible values of k, which is greater?]]") : spin(rng, "[[What is the product of all possible values of k?|What is the product of every value of k for which this is true?|If all possible values of k are multiplied, what is the product?]]"), correct: ans,
        wrongs: ask === "sum"
          ? [{ v: 2 * u, kind: "step_missing", reason: "k 의 이차방정식 근의 합 4u 를 2u 로 계산했다(2 를 빠뜨림)." }, { v: -4 * u, kind: "sign_error", reason: "근의 합 -b/a 의 부호를 놓쳤다." }, { v: -4 * m, kind: "formula_misuse", reason: "합 대신 곱 -4m 을 골랐다." }, { v: u, kind: "step_missing", reason: "계수 u 를 그대로 골랐다." }, { v: 4 * u + 1, kind: "other", reason: "계산 오류." }, { v: Math.max(k1, k2), kind: "step_missing", reason: "큰 k 하나만 골랐다." }]
          : ask === "greater"
            ? [{ v: Math.min(k1, k2), kind: "other", reason: "큰 값이 아니라 작은 값을 골랐다." }, { v: 4 * u, kind: "formula_misuse", reason: "두 값의 합을 골랐다." }, { v: 2 * u, kind: "formula_misuse", reason: "두 값의 평균을 골랐다." }, { v: 2 * u + j, kind: "formula_misuse", reason: "근의 공식에서 √ 안의 2 를 놓쳤다." }, { v: -(2 * u + 2 * j), kind: "sign_error", reason: "부호를 반대로 적었다." }, { v: Math.abs(2 * j), kind: "step_missing", reason: "근의 공식에서 2u 를 더하지 않았다." }]
            : [{ v: 4 * m, kind: "sign_error", reason: "곱 c/a 의 부호를 놓쳤다." }, { v: 4 * u, kind: "formula_misuse", reason: "곱 대신 합을 골랐다." }, { v: -m, kind: "step_missing", reason: "계수 4 를 곱하지 않았다." }, { v: m, kind: "step_missing", reason: "계수 4 를 빠뜨렸다." }, { v: -4 * m + 4 * u, kind: "other", reason: "계산 오류." }],
        verificationJs: withParams({ u, m, ask: ask === "sum" ? 0 : ask === "greater" ? 1 : 2 }, "const ks=[]; for(let k=-120;k<=120;k++){ let mn=Infinity; for(let i=-600;i<=600;i++){ const x=i/2; const f=x*x+k*x+(P.u*k+P.m); if(f<mn) mn=f; } if(mn===0) ks.push(k); }\nif(ks.length!==2) throw new Error('k 가 2개 아님'); return P.ask===0? ks[0]+ks[1] : P.ask===1? Math.max(...ks) : ks[0]*ks[1];"),
        trace: [
          T("해가 하나뿐이므로 판별식 D = 0 이다.", "One real solution means D = 0."),
          T(`D = k² - 4(${lin(u, m, "k")}) = 0 이므로 $k^2 - ${W(4 * u)}k - ${W(4 * m)} = 0$ 이다.`, "Write the condition as an equation in k."),
          T(`이 k 에 대한 이차방정식의 판별식 ${16 * u * u} + ${16 * m} = ${16 * (u * u + m)} = ${(4 * j) * (4 * j)} 는 양수이므로 k 는 두 개이다.`, "The condition in k has two solutions."),
          T(`근과 계수의 관계 또는 인수분해로 k = ${k2}, ${k1} 이다.`, "Solve for k."),
          T(`${ask === "sum" ? `합: ${k1} + ${pn(k2)} = ${ans}` : ask === "greater" ? `큰 값: ${ans}` : `곱: ${k1}·${pn(k2)} = ${ans}`} 이다.`, "Combine as requested."),
        ],
        variant: ask === "sum" ? "sum_of_k" : ask === "greater" ? "greater_k" : "product_of_k",
      });
    },
  },
  {
    id: "nes.parameter_discriminant.inverse", skill: SKILL, kind: "parameter_discriminant", operator: "inverse",
    structure: "해가 하나뿐이며 그 값이 r(또는 그래프가 x축에 (r,0)에서 접함)일 때 b, c 를 완전제곱식 (x-r)² 으로 역산해 b+c(또는 c-b)를 구한다",
    extraThinking: "중근 조건에서 이차식 자체를 (x-r)² 으로 재구성해 계수를 읽는 역방향 사고 — medium 은 판별식으로 매개변수를 구함",
    concepts: ["중근과 완전제곱식", "전개·계수 비교", "접선(꼭짓점이 x축 위)"], mediumSteps: 3,
    generate(rng) {
      const r = rng.nz(-14, 14); const b = -2 * r, c = r * r; const ask = rng.pick(["sum", "diff"] as const); const ans = ask === "sum" ? b + c : c - b; if (ans === 0 || Math.abs(r) === 1) throw new GenFail("x");
      const L = rng.pick([["b", "c"], ["p", "q"], ["m", "n"]] as const); const tang = rng.chance(0.5);
      return finish(rng, {
        stimulus: tang
          ? spin(rng, `[[In the xy-plane, the graph of the equation below touches the x-axis at exactly one point, (${r}, 0)|The graph of the function below is tangent to the x-axis at the point (${r}, 0) in the xy-plane|The parabola below has its vertex on the x-axis at the point (${r}, 0)]]. Here, ${L[0]} and ${L[1]} are constants.\n\n`) + M(`y = x^2 + ${L[0]}x + ${L[1]}`)
          : spin(rng, `[[In the equation below|For the equation shown|In the given equation|In the equation given here]], ${L[0]} and ${L[1]} are constants. The equation has exactly one real solution, x = ${r}.\n\n`) + M(`x^2 + ${L[0]}x + ${L[1]} = 0`),
        question: ask === "sum" ? spin(rng, `[[What is the value of ${L[0]} + ${L[1]}?|Find ${L[0]} + ${L[1]}.|What is the sum of ${L[0]} and ${L[1]}?]]`) : spin(rng, `[[What is the value of ${L[1]} - ${L[0]}?|Find ${L[1]} - ${L[0]}.|What is ${L[0]} subtracted from ${L[1]}?]]`), correct: ans,
        wrongs: ask === "sum"
          ? [{ v: -b + c, kind: "sign_error", reason: "(x-r)² 전개에서 x 계수 -2r 의 부호를 놓쳤다." }, { v: c, kind: "step_missing", reason: "c 만 구했다." }, { v: b, kind: "step_missing", reason: "b 만 구했다." }, { v: r + c, kind: "formula_misuse", reason: "b 를 -2r 이 아니라 r 로 계산했다." }, { v: -b - c, kind: "sign_error", reason: "전체 부호를 반대로 적었다." }, { v: b - c, kind: "sign_error", reason: "b - c 를 계산했다." }]
          : [{ v: -b - c, kind: "sign_error", reason: "차의 부호를 반대로 계산했다." }, { v: c + b, kind: "sign_error", reason: "c - b 대신 c + b 를 계산했다." }, { v: c, kind: "step_missing", reason: "c 만 구했다." }, { v: -b, kind: "step_missing", reason: "b 의 부호만 바꿨다." }, { v: c - r, kind: "formula_misuse", reason: "b 를 -2r 이 아니라 -r 로 계산했다." }],
        verificationJs: withParams({ r, ask: ask === "sum" ? 1 : 0 }, "const hits=[]; for(let b=-100;b<=100;b++) for(let c=-250;c<=250;c++){ const f=x=>x*x+b*x+c; if(f(P.r)===0 && f(P.r-1)===f(P.r+1)) hits.push(P.ask? b+c : c-b); } if(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];"),
        trace: [
          T(`해가 하나뿐이고 x = ${r} 이므로 중근이다.`, "A single solution is a double root."),
          T(`이차항의 계수가 1 이므로 식은 $(x - ${W(r)})^2$ 와 같다.`, "The quadratic must be a perfect square."),
          T(`전개하면 $x^2 - ${W(2 * r)}x + ${r * r}$ 이다.`.replace("- -", "+ "), "Expand the square."),
          T(`계수를 읽으면 ${L[0]} = ${b}, ${L[1]} = ${c} 이다.`, "Read the coefficients."),
          T(`${ask === "sum" ? `${L[0]} + ${L[1]} = ${b} + ${pn(c)}` : `${L[1]} - ${L[0]} = ${c} - ${pn(b)}`} = ${ans} 이다.`, "Combine."),
        ],
        variant: tang ? "tangent_to_axis" : "double_root_given",
      });
    },
  },
  {
    id: "nes.parameter_discriminant.constraint_select", skill: SKILL, kind: "parameter_discriminant", operator: "constraint_select",
    structure: "kx²+bx+c=0 이 서로 다른 두 실근을 갖는 0 이 아닌 정수 k(-N ≤ k ≤ N)의 개수 — 판별식 부등식과 k≠0·경계 D=0 제외",
    extraThinking: "최고차 계수가 매개변수라 k=0 제외, 음수 k 는 항상 성립, 양수 k 는 경계(D=0) 제외로 나눠 세는 제약 추적 — medium 은 부호 조건을 만족하는 k 하나를 구함",
    concepts: ["판별식 부등식", "정수 범위 세기", "k≠0 조건"], mediumSteps: 3,
    generate(rng) {
      const c = rng.int(1, 6), b = rng.nz(-9, 9), N = rng.int(4, 9); const bound = (b * b) / (4 * c); const maxPos = Math.ceil(bound) - 1; const pos = Math.min(N, Math.max(0, maxPos)); const ans = N + pos; if (Math.abs(b) < 2) throw new GenFail("x");
      const tangentIncluded = N + Math.min(N, Math.max(0, Math.floor(bound)));
      return finish(rng, {
        stimulus: spin(rng, `[[In the equation below|For the equation shown|In the given equation|In the equation given here]], k is a nonzero integer with -${N} ≤ k ≤ ${N}.\n\n`) + M(`kx^2 ${b < 0 ? "-" : "+"} ${Math.abs(b)}x + ${c} = 0`),
        question: spin(rng, "[[For how many values of k does the equation have two distinct real solutions?|How many values of k give an equation with two different real solutions?|For how many integers k are there two distinct real solutions?]]"), correct: ans,
        wrongs: [{ v: tangentIncluded, kind: "condition_ignored", reason: "D = 0(중근)인 k 도 '서로 다른 두 실근' 에 포함했다." }, { v: pos, kind: "step_missing", reason: "음수 k 가 모두 성립한다는 점을 놓쳤다." }, { v: ans + 1, kind: "condition_ignored", reason: "k = 0 (이차방정식이 아님)도 센 것이다." }, { v: N, kind: "step_missing", reason: "양수 k 를 세지 않았다." }, { v: 2 * N, kind: "condition_ignored", reason: "모든 k 가 성립한다고 가정했다." }, { v: Math.max(0, ans - 1), kind: "other", reason: "한 값을 덜 셌다." }],
        verificationJs: withParams({ b, c, N }, "let cnt=0; for(let k=-P.N;k<=P.N;k++){ if(k===0) continue; const x0=-P.b/(2*k); const f=k*x0*x0+P.b*x0+P.c; if(k*f<-1e-9) cnt++; } return cnt;"),
        trace: [
          T("k ≠ 0 이므로 이차방정식이고 판별식은 D = b² - 4kc 이다.", "The equation is quadratic since k is nonzero."),
          T(`서로 다른 두 실근이므로 D > 0, 즉 ${b * b} - ${4 * c}k > 0 이다.`, "Two distinct real solutions need D > 0."),
          T(`음수 k 는 항상 D > 0 을 만족하므로 -${N} ≤ k ≤ -1 의 ${N}개가 모두 성립한다.`, "Every negative k works."),
          T(`양수 k 는 k < ${b * b}/${4 * c} 이어야 하고 경계는 제외하므로 1 ≤ k ≤ ${Math.max(0, maxPos)} 중 ${N} 이하인 ${pos}개이다.`, "Positive k must satisfy a strict upper bound."),
          T(`전체 개수는 ${N} + ${pos} = ${ans} 이다.`, "Add the counts."),
        ],
        variant: "count_k_two_real",
      });
    },
  },
  {
    id: "nes.parameter_discriminant.chain2", skill: SKILL, kind: "parameter_discriminant", operator: "chain2",
    structure: "첫 방정식 x²+kx+c₁=0 이 해가 하나뿐이도록 하는 양수 k 를 구한 뒤 둘째 방정식 x²-kx+w=0 의 실근 개수를 판별식으로 판정",
    extraThinking: "앞 단계의 판별식 조건에서 구한 k 가 뒤 방정식의 판별식 부호를 결정하는 2단계 연쇄 — medium 은 한 방정식의 판별식 부호",
    concepts: ["판별식 조건", "양수 조건 선택", "실근 개수 판정"], mediumSteps: 3,
    generate(rng) {
      const m0 = rng.int(2, 8), c1 = m0 * m0, k = 2 * m0; const outcome = rng.int(0, 2); const j = rng.int(1, 6); const w = outcome === 1 ? m0 * m0 : outcome === 2 ? m0 * m0 - j : m0 * m0 + j; if (w === 0 || Math.abs(w) > 90) throw new GenFail("x");
      const cnt = outcome === 1 ? 1 : outcome === 2 ? 2 : 0;
      return finish(rng, {
        stimulus: spin(rng, `[[In the first equation below|For the first equation below|In the first equation given here]], k is a positive constant, and the equation has exactly one real solution.\n\n`) + `First equation: ${M(`x^2 + kx + ${c1} = 0`)}\n\nSecond equation: ${M(`x^2 - kx ${w < 0 ? "-" : "+"} ${Math.abs(w)} = 0`)}`,
        question: spin(rng, "[[How many real solutions does the second equation have for this value of k?|For the value of k from the first equation, how many real solutions does the second equation have?|Using that value of k, what is the number of real solutions of the second equation?]]"), correct: cnt,
        wrongs: [0, 1, 2, 3].filter((v) => v !== cnt).map((v) => ({ v, kind: "other" as const, reason: v === 3 ? "이차방정식의 실근은 최대 2개인데 3개로 골랐다." : "둘째 방정식의 판별식 부호를 잘못 판단했다(k 값 또는 판별식 계산 오류)." })),
        verificationJs: withParams({ c1, w }, "let kk=null; for(let k=1;k<=60;k++){ const sols=[]; for(let x=-100;x<=100;x++) if(x*x+k*x+P.c1===0) sols.push(x); if(sols.length===1 && 2*sols[0]+k===0){ if(kk!==null) throw new Error('k 유일하지 않음'); kk=k; } } if(kk===null) throw new Error('k 없음');\nlet mn=Infinity; for(let i=-400;i<=400;i++){ const x=i/2; const f=x*x-kk*x+P.w; if(f<mn) mn=f; } return mn<0?2:(mn===0?1:0);"),
        trace: [
          T("첫 방정식이 해가 하나뿐이므로 판별식 D = 0 이다.", "One solution means D = 0 for the first equation."),
          T(`k² - 4·${c1} = 0 이므로 k² = ${4 * c1} 이다.`, "Write the discriminant condition."),
          T(`k 는 양수이므로 k = ${k} 이다.`, "Choose the positive value."),
          T(`둘째 방정식에 k = ${k} 를 대입하면 $x^2 - ${k}x ${w < 0 ? "-" : "+"} ${Math.abs(w)} = 0$ 이고 판별식은 ${k * k} - 4·${pn(w)} = ${k * k - 4 * w} 이다.`, "Substitute k and compute the second discriminant."),
          T(`판별식이 ${k * k - 4 * w > 0 ? "양수" : k * k - 4 * w === 0 ? "0" : "음수"} 이므로 실근은 ${cnt} 개이다.`, "Decide the number of real solutions from its sign."),
        ],
        variant: "discriminant_then_count",
      });
    },
  },
];
