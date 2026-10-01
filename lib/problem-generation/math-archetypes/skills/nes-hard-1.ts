// nonlinear_equations_systems hard 원형 — root·sum_of_roots·product_of_roots·num_real_solutions (세부 패턴 4개 × 연산자 4종 = 16).
import { GenFail, type Archetype } from "../types";
import { lin, M, spin, withParams, shifted, pn } from "../text";
import { quadStr, W, finishA } from "./a-kit";
const finish = finishA;

const SKILL = "nonlinear_equations_systems";
const T = (ko: string, en: string): [string, string] => [ko, en];
const SC = (k: number) => (k < 0 ? `- ${-k}` : `+ ${k}`);
/** 정수근 r,s 인 일차계수 1 이차식 x^2 + bx + c 의 (b, c) */
const bc = (r: number, s: number) => ({ b: -(r + s), c: r * s });
const distinct = (...v: number[]) => new Set(v).size === v.length;
const quad = (b: number, c: number) => quadStr(1, b, c);

export const NES1_ARCHETYPES: Archetype[] = [
  // ───────────── root ─────────────
  {
    id: "nes.root.param_condition", skill: SKILL, kind: "root", operator: "param_condition",
    structure: "'해가 하나뿐'이라는 조건을 판별식 = 0 으로 번역해 상수를 정하고 그 중근을 구한다",
    extraThinking: "해의 개수 조건을 판별식 식으로 번역하고 부호 조건(양수 상수)으로 값을 하나로 고른 뒤 다시 방정식을 풀어야 한다 — medium 은 인수분해된 두 근 중 큰 근을 읽는 풀이",
    concepts: ["판별식 조건", "완전제곱 중근", "부호 조건 선택"], mediumSteps: 2,
    generate(rng) {
      const m = rng.int(2, 16), c = m * m, K = rng.pick(["k", "p", "b", "a"]); const askK = rng.chance(0.4);
      const stimulus = spin(rng, `[[In the equation below|For the equation shown|In the given equation|In the equation given here]], ${K} is a positive constant [[and the equation has exactly one real solution.|, and the equation has a single real solution.|such that the equation has exactly one real solution.|chosen so that the equation has only one real solution.]]\n\n`) + M(`x^2 + ${K}x + ${c} = 0`);
      return finish(rng, {
        stimulus, question: askK ? spin(rng, `[[What is the value of ${K}?|Find ${K}.|What must ${K} equal?]]`) : spin(rng, "[[What is the solution to the equation?|What is the value of x that satisfies the equation?|Find the one real solution of the equation.]]"),
        correct: askK ? 2 * m : -m,
        wrongs: askK
          ? [{ v: -2 * m, kind: "condition_ignored", reason: "상수가 양수라는 조건을 무시하고 음의 값을 골랐다." }, { v: m, kind: "formula_misuse", reason: "K² = 4c 에서 K = √c 로 계산해 2 를 빠뜨렸다." }, { v: c, kind: "formula_misuse", reason: "상수항 c 자체를 K 로 골랐다." }, { v: 4 * m, kind: "formula_misuse", reason: "K = 4√c 로 잘못 계산했다." }, { v: -m, kind: "other", reason: "중근 값을 K 로 착각했다." }]
          : [{ v: m, kind: "sign_error", reason: "중근 x = -K/2 에서 부호를 놓쳤다." }, { v: 2 * m, kind: "step_missing", reason: "K 만 구하고 중근 -K/2 를 계산하지 않았다." }, { v: -2 * m, kind: "step_missing", reason: "K 를 구한 뒤 -K 를 답으로 골랐다(2 로 나누지 않음)." }, { v: -c, kind: "formula_misuse", reason: "상수항의 부호를 바꿔 답으로 골랐다." }, { v: c, kind: "formula_misuse", reason: "상수항 자체를 답으로 골랐다." }],
        verificationJs: withParams({ c, ask: askK ? 1 : 0 }, "let out=null;\nfor(let k=1;k<=60;k++){ const sols=[]; for(let x=-100;x<=100;x++) if(x*x+k*x+P.c===0) sols.push(x); if(sols.length===1 && 2*sols[0]+k===0){ if(out!==null) throw new Error('유일하지 않음'); out = P.ask? k : sols[0]; } }\nif(out===null) throw new Error('해 없음'); return out;"),
        trace: [
          T("해가 하나뿐이므로 방정식은 중근을 갖고, 판별식 D = 0 이다.", "One solution means a double root, so D = 0."),
          T(`D = ${K}² - 4·${c} = 0 이므로 ${K}² = ${4 * c} 이다.`, "Write the discriminant condition."),
          T(`${K} 는 양수이므로 ${K} = ${2 * m} 이다.`, "Choose the positive constant."),
          T(`방정식은 $(x + ${m})^2 = 0$ 꼴이다.`, "The equation becomes a perfect square."),
          T(`따라서 해는 x = ${-m} 이다.${askK ? ` 묻는 값은 ${K} = ${2 * m} 이다.` : ""}`, "Read off the solution."),
        ],
        variant: askK ? "ask_constant" : "ask_solution",
      });
    },
  },
  {
    id: "nes.root.constraint_select", skill: SKILL, kind: "root", operator: "constraint_select",
    structure: "제곱근 방정식을 양변 제곱해 이차식으로 바꾼 뒤 두 후보 중 원식(우변 ≥ 0)을 만족하는 근만 선택",
    extraThinking: "제곱으로 생긴 외래근을 원식에 대입해 걸러내야 한다(제약 추적·후보 제거) — medium 은 인수분해로 나온 근을 그대로 답",
    concepts: ["무리방정식 제곱", "이차방정식 인수분해", "외래근 검증"], mediumSteps: 2,
    generate(rng) {
      const m = rng.int(1, 6), r2 = rng.int(m + 2, m + 7), r1 = 2 * m + 1 - r2; const n = m * m - r1 * r2;
      if (Math.abs(n) > 40 || n === 0 || !distinct(r1, r2)) throw new GenFail("x");
      const stimulus = spin(rng, `[[Consider the equation below|The equation below involves a square root|For the equation shown, x is a real number|Look at the equation below]]. `) + M(`\\sqrt{${shifted("x", n)}} = ${shifted("x", -m)}`);
      return finish(rng, {
        stimulus, question: spin(rng, "[[What is the solution of the equation?|Which value of x satisfies the equation?|What is the value of x that makes the equation true?|Find the real solution of the equation.]]"), correct: r2,
        wrongs: [{ v: r1, kind: "condition_ignored", reason: "제곱해서 얻은 두 근 중 원식에 대입하면 성립하지 않는 외래근을 골랐다." }, { v: 2 * m + 1, kind: "formula_misuse", reason: "두 근의 합을 답으로 골랐다." }, { v: r1 * r2, kind: "formula_misuse", reason: "두 근의 곱을 답으로 골랐다." }, { v: m, kind: "step_missing", reason: "우변의 상수 m 을 답으로 골랐다." }, { v: r2 + 1, kind: "other", reason: "근을 구한 뒤 1 을 더했다." }, { v: -r2, kind: "sign_error", reason: "근의 부호를 반대로 적었다." }],
        verificationJs: withParams({ n, m }, "const sols=[]; for(let x=-100;x<=100;x++){ if(x-P.m>=0 && x+P.n>=0 && Math.abs(Math.sqrt(x+P.n)-(x-P.m))<1e-9) sols.push(x); }\nif(sols.length!==1) throw new Error('해가 유일하지 않음'); return sols[0];"),
        trace: [
          T("양변을 제곱해 근호를 없앤다.", "Square both sides to remove the radical."),
          T(`$${shifted("x", n)} = (${shifted("x", -m)})^2$ 를 전개해 표준형으로 정리한다.`, "Expand and move everything to one side."),
          T(`$${quad(-(2 * m + 1), m * m - n)} = 0$ 이다.`, "Write the quadratic."),
          T(`인수분해하면 x = ${r1} 또는 x = ${r2} 이다.`, "Factor to get two candidates."),
          T(`원식의 우변 $${shifted("x", -m)}$ 은 근호 값이므로 0 이상이어야 한다. x = ${r1} 일 때 ${r1 - m} < 0 이라 제외한다.`, "The right side must be nonnegative, which rules out one candidate."),
          T(`x = ${r2} 를 원식에 대입해 성립함을 확인한다.`, "Verify the remaining candidate."),
        ],
        variant: "radical_equation",
      });
    },
  },
  {
    id: "nes.root.chain2", skill: SKILL, kind: "root", operator: "chain2",
    structure: "첫 이차방정식의 큰 근 k 를 구한 뒤, k 가 들어간 둘째 방정식 (x-k)² = m² 의 해를 구한다",
    extraThinking: "앞 단계에서 구한 값이 뒤 방정식의 계수가 되는 2단계 연쇄 — medium 은 한 방정식의 근 하나",
    concepts: ["이차방정식 인수분해", "치환·전개", "완전제곱형 방정식"], mediumSteps: 2,
    generate(rng) {
      const r = rng.int(-6, 4), s = rng.int(r + 1, 9); const { b, c } = bc(r, s); const m = rng.int(2, 7); const k = s;
      const larger = rng.chance(0.5);
      const stimulus = spin(rng, `[[Let k be the larger solution of the equation|Let k represent the greater of the two solutions of|Suppose k is the larger solution of]] `) + M(`${quad(b, c)} = 0`) + spin(rng, `[[. Now consider a second equation, written with k|. A second equation is built from k|, and then a second equation uses that value of k]]:\n\n`) + M(`x^2 - 2kx + k^2 - ${m * m} = 0`);
      return finish(rng, {
        stimulus, question: larger ? spin(rng, "[[What is the larger solution of the second equation?|What is the greater solution of the second equation?|Find the larger solution of the second equation.]]") : spin(rng, "[[What is the smaller solution of the second equation?|What is the lesser solution of the second equation?|Find the smaller solution of the second equation.]]"),
        correct: larger ? k + m : k - m,
        wrongs: [{ v: larger ? k - m : k + m, kind: "other", reason: "묻는 쪽(큰/작은 근)이 아닌 근을 골랐다." }, { v: k, kind: "step_missing", reason: "k 만 구하고 둘째 방정식을 풀지 않았다." }, { v: m, kind: "step_missing", reason: "둘째 방정식에서 m 만 읽었다." }, { v: r + m, kind: "step_missing", reason: "큰 근이 아닌 작은 근 r 을 k 로 사용했다." }, { v: larger ? s + m * m : s - m * m, kind: "formula_misuse", reason: "(x-k)² = m² 에서 m² 을 그대로 더하거나 뺐다(제곱근을 취하지 않음)." }, { v: -(k + m), kind: "sign_error", reason: "부호를 반대로 적었다." }],
        verificationJs: withParams({ b, c, m, big: larger ? 1 : 0 }, "const r1=[]; for(let x=-200;x<=200;x++) if(x*x+P.b*x+P.c===0) r1.push(x); if(r1.length!==2) throw new Error('첫 방정식 근 2개 아님'); const k=Math.max(...r1);\nconst r2=[]; for(let x=-400;x<=400;x++) if(x*x-2*k*x+k*k-P.m*P.m===0) r2.push(x); if(r2.length!==2) throw new Error('둘째 근 2개 아님'); return P.big? Math.max(...r2) : Math.min(...r2);"),
        trace: [
          T(`첫 방정식 $${quad(b, c)} = 0$ 을 인수분해한다.`, "Factor the first equation."),
          T(`근은 x = ${r} 과 x = ${s} 이므로 큰 근 k = ${s} 이다.`, "Find the two solutions and take the larger one as k."),
          T(`둘째 방정식에 k = ${k} 를 대입한다: $(x - ${W(k)})^2 = ${m * m}$ 꼴이다.`, "Substitute k."),
          T(`양변의 제곱근을 취하면 x - ${W(k)} = ±${m} 이다.`, "Take square roots."),
          T(`x = ${k - m} 또는 x = ${k + m} 이다.`, "Solve for x."),
          T(`${larger ? "큰" : "작은"} 근은 ${larger ? k + m : k - m} 이다.`, "Choose the requested solution."),
        ],
        variant: larger ? "larger" : "smaller",
      });
    },
  },
  {
    id: "nes.root.inverse", skill: SKILL, kind: "root", operator: "inverse",
    structure: "한 근과 '다른 근과의 차'를 주고 이차방정식의 계수 b, c 를 근과 계수의 관계로 역산해 합을 구한다",
    extraThinking: "근 → 계수의 역방향 재구성(두 번째 근 도출, 합·곱의 부호 처리) — medium 은 주어진 방정식의 근을 읽음",
    concepts: ["근과 계수의 관계", "근의 차 조건", "계수 역산"], mediumSteps: 2,
    generate(rng) {
      const p = rng.nz(-7, 7), e = rng.nz(-6, 6); const q = p + e; if (q === 0 || q === p) throw new GenFail("x");
      const b = -(p + q), c = p * q; if (b + c === 0 || Math.abs(c) > 60) throw new GenFail("x");
      const rel = e > 0 ? `${e} more than` : `${-e} less than`; const L = rng.pick([["b", "c"], ["p", "q"], ["m", "n"]] as const);
      const ask = rng.pick(["sum", "diff"] as const); const ans = ask === "sum" ? b + c : c - b;
      const stimulus = spin(rng, `[[In the equation below|For the equation shown|In the given equation|In the equation given here]], ${L[0]} and ${L[1]} are constants. One solution of the equation is ${p}, and the other solution is ${rel} that solution.\n\n`) + M(`x^2 + ${L[0]}x + ${L[1]} = 0`);
      return finish(rng, {
        stimulus, question: ask === "sum" ? spin(rng, `[[What is the value of ${L[0]} + ${L[1]}?|Find ${L[0]} + ${L[1]}.|What is the sum of ${L[0]} and ${L[1]}?]]`) : spin(rng, `[[What is the value of ${L[1]} - ${L[0]}?|Find ${L[1]} - ${L[0]}.|What is ${L[0]} subtracted from ${L[1]}?]]`),
        correct: ans,
        wrongs: ask === "sum"
          ? [{ v: -b + c, kind: "sign_error", reason: "근의 합이 -b 라는 부호를 놓쳐 b 의 부호를 반대로 썼다." }, { v: c, kind: "step_missing", reason: "곱 c 만 구했다." }, { v: b, kind: "step_missing", reason: "합 b 만 구했다." }, { v: b - c, kind: "sign_error", reason: "b + c 대신 b - c 를 계산했다." }, { v: p + q + c, kind: "sign_error", reason: "b 를 근의 합 그대로(부호 반대) 썼다." }, { v: -(b + c), kind: "sign_error", reason: "전체 부호를 반대로 적었다." }]
          : [{ v: -c - b, kind: "sign_error", reason: "차의 부호를 반대로 계산했다." }, { v: c + b, kind: "sign_error", reason: "c - b 대신 c + b 를 계산했다." }, { v: c, kind: "step_missing", reason: "c 만 답으로 골랐다." }, { v: -b, kind: "step_missing", reason: "b 의 부호만 바꿔 답으로 골랐다." }, { v: c + p + q, kind: "sign_error", reason: "b 를 근의 합 그대로 사용했다." }],
        verificationJs: withParams({ p, e, ask: ask === "sum" ? 1 : 0 }, "const hits=[]; for(let b=-80;b<=80;b++) for(let c=-200;c<=200;c++){ const f=x=>x*x+b*x+c; if(f(P.p)===0 && f(P.p+P.e)===0 && P.e!==0) hits.push(P.ask? b+c : c-b); }\nif(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];"),
        trace: [
          T(`한 근이 ${p} 이고 다른 근은 ${rel} 이므로 다른 근은 ${q} 이다.`, "Find the other solution."),
          T(`근의 합은 ${p} + ${pn(q)} = ${p + q} 이고 이것은 -${L[0]} 와 같다.`, "The sum of the solutions equals the negative of the linear coefficient."),
          T(`따라서 ${L[0]} = ${b} 이다.`, "Solve for the linear coefficient."),
          T(`근의 곱은 ${p}·${pn(q)} = ${c} 이고 이것은 ${L[1]} 와 같다.`, "The product equals the constant term."),
          T(`${ask === "sum" ? `${L[0]} + ${L[1]} = ${b} + ${pn(c)}` : `${L[1]} - ${L[0]} = ${c} - ${pn(b)}`} = ${ans} 이다.`, "Compute the requested combination."),
        ],
        variant: ask === "sum" ? "sum_coeffs" : "diff_coeffs",
      });
    },
  },

  // ───────────── sum_of_roots ─────────────
  {
    id: "nes.sum_of_roots.inverse", skill: SKILL, kind: "sum_of_roots", operator: "inverse",
    structure: "ax² = bx + c 꼴에서 두 근의 합과 곱을 주고 이항 후 근과 계수의 관계로 b, c 를 역산해 b + c 를 구한다",
    extraThinking: "표준형으로 이항할 때 b·c 의 부호 변화를 추적하며 합·곱 조건을 계수로 역산 — medium 은 표준형 방정식의 근의 합을 -b/a 로 읽음",
    concepts: ["표준형 정리(이항)", "근과 계수의 관계", "계수 역산"], mediumSteps: 2,
    generate(rng) {
      const a = rng.int(2, 5), r = rng.nz(-6, 7), s = rng.nz(-6, 7); if (r === s) throw new GenFail("x");
      const S = r + s, Pr = r * s; const b = a * S, c = -a * Pr; if (b + c === 0 || S === 0) throw new GenFail("x");
      const L = rng.pick([["b", "c"], ["p", "q"], ["m", "k"]] as const);
      const stimulus = spin(rng, `[[The equation below has two real solutions|The equation shown has two different real solutions|Consider the equation below, which has two real solutions]], where ${L[0]} and ${L[1]} are constants. The sum of the solutions is ${S}, and the product of the solutions is ${Pr}.\n\n`) + M(`${a}x^2 = ${L[0]}x + ${L[1]}`);
      return finish(rng, {
        stimulus, question: spin(rng, `[[What is the value of ${L[0]} + ${L[1]}?|Find ${L[0]} + ${L[1]}.|What is the sum of ${L[0]} and ${L[1]}?]]`), correct: b + c,
        wrongs: [{ v: a * (S + Pr), kind: "sign_error", reason: "이항 후 상수항의 부호(c = -a·곱)를 놓쳤다." }, { v: b, kind: "step_missing", reason: "b 만 구했다." }, { v: c, kind: "step_missing", reason: "c 만 구했다." }, { v: S - Pr, kind: "step_missing", reason: "a 를 곱하지 않았다." }, { v: -a * (S - Pr), kind: "sign_error", reason: "전체 부호를 반대로 적었다." }, { v: a * (Pr - S), kind: "sign_error", reason: "b 의 부호를 반대로 썼다." }],
        verificationJs: withParams({ a, S, Pr }, "const out=new Set(); for(let r=-40;r<=40;r++){ const s=P.S-r; if(r<s && r*s===P.Pr){ const b=P.a*(r*r-s*s)/(r-s); const c=P.a*r*r-b*r; out.add(b+c); } }\nif(out.size!==1) throw new Error('근 쌍이 유일하지 않음'); return [...out][0];"),
        trace: [
          T(`${a}x² = ${L[0]}x + ${L[1]} 를 표준형으로 이항하면 $${a}x^2 - ${L[0]}x - ${L[1]} = 0$ 이다.`, "Move every term to one side."),
          T(`두 근의 합 = ${L[0]}/${a} = ${S} 이므로 ${L[0]} = ${b} 이다.`, "Use the sum of solutions."),
          T(`두 근의 곱 = -${L[1]}/${a} = ${Pr} 이므로 ${L[1]} = ${c} 이다.`, "Use the product of solutions."),
          T(`부호에 주의해 b 와 c 를 확인한다(c 는 이항 때문에 곱의 -${a} 배).`, "Check the signs created by moving terms."),
          T(`${L[0]} + ${L[1]} = ${b} + ${pn(c)} = ${b + c} 이다.`, "Add."),
        ],
        variant: "rearranged_form",
      });
    },
  },
  {
    id: "nes.sum_of_roots.param_condition", skill: SKILL, kind: "sum_of_roots", operator: "param_condition",
    structure: "x² + (uk+v)x + (wk+z) = 0 에서 '근의 합이 S' 라는 조건으로 k 를 정하고 곱을 구한다",
    extraThinking: "근의 합 조건을 매개변수 방정식으로 번역해 k 를 정한 뒤 다른 계수에 다시 대입 — medium 은 계수가 숫자인 방정식에서 합을 읽음",
    concepts: ["근과 계수의 관계", "매개변수 일차방정식", "대입 후 곱 계산"], mediumSteps: 2,
    generate(rng) {
      const r = rng.int(-6, 7), s = rng.int(-6, 7), u = rng.pick([-3, -2, -1, 1, 2, 3]), w = rng.pick([-3, -2, -1, 1, 2, 3]), k0 = rng.nz(-5, 5);
      const S = r + s, Pr = r * s; const v = -S - u * k0, z = Pr - w * k0; // 합 = -(u k + v)
      if (Math.abs(v) > 25 || Math.abs(z) > 40 || r === s || Pr === 0) throw new GenFail("x");
      const stimulus = spin(rng, `[[In the equation below|For the equation shown|In the given equation|In the equation given here]], k is a constant. The equation has two real solutions, and the sum of the solutions is ${S}.\n\n`) + M(`x^2 + (${lin(u, v, "k")})x + (${lin(w, z, "k")}) = 0`);
      return finish(rng, {
        stimulus, question: spin(rng, "[[What is the product of the solutions of the equation?|Find the product of the two solutions.|What is the value of the product of the solutions?]]"), correct: Pr,
        wrongs: [{ v: k0, kind: "step_missing", reason: "k 만 구하고 곱을 계산하지 않았다." }, { v: -Pr, kind: "sign_error", reason: "곱의 부호를 반대로 적었다." }, { v: S, kind: "formula_misuse", reason: "합을 곱으로 착각했다." }, { v: z, kind: "step_missing", reason: "상수항에서 w·k 를 더하지 않았다." }, { v: w * k0, kind: "step_missing", reason: "상수항에서 z 를 빠뜨렸다." }, { v: Pr + k0, kind: "other", reason: "곱에 k 를 더했다." }],
        verificationJs: withParams({ u, v, w, z, S }, "const hits=new Set(); for(let k=-100;k<=100;k++){ const B=P.u*k+P.v, C=P.w*k+P.z; const roots=[]; for(let x=-300;x<=300;x++) if(x*x+B*x+C===0) roots.push(x); if(roots.length===2 && roots[0]+roots[1]===P.S) hits.add(k+':'+roots[0]*roots[1]); }\nif(hits.size!==1) throw new Error('유일하지 않음'); return Number([...hits][0].split(':')[1]);"),
        trace: [
          T("이차항의 계수가 1 이므로 두 근의 합은 x 의 계수의 부호를 바꾼 값이다.", "The sum of solutions is the negative of the linear coefficient."),
          T(`-(${lin(u, v, "k")}) = ${S} 로 놓는다.`, "Set the sum equal to the given value."),
          T(`이 일차방정식을 풀면 k = ${k0} 이다.`, "Solve for k."),
          T(`상수항에 k = ${k0} 를 대입하면 ${w}·${pn(k0)} + ${pn(z)} = ${Pr} 이다.`, "Substitute k into the constant term."),
          T(`두 근의 곱은 상수항과 같으므로 ${Pr} 이다.`, "The product equals the constant term."),
        ],
        variant: "param_sum_condition",
      });
    },
  },
  {
    id: "nes.sum_of_roots.compose_kind", skill: SKILL, kind: "sum_of_roots", operator: "compose_kind",
    structure: "포물선 y=x²+bx+c 와 직선 y=mx+n 의 교점 x(또는 y)좌표 합을 두 식을 같게 놓은 이차방정식의 근과 계수 관계로 구한다",
    extraThinking: "연립(교점) 개념과 근의 합 개념을 연결해 두 식을 같게 놓고 정리한 뒤 합을 읽는다 — medium 은 주어진 이차방정식의 근의 합",
    concepts: ["이차함수와 직선의 교점", "방정식 정리", "근과 계수의 관계"], mediumSteps: 2,
    generate(rng) {
      const r = rng.int(-6, 8), s = rng.int(-6, 8), b = rng.int(-6, 6), c = rng.int(-9, 9); if (r === s) throw new GenFail("x");
      const m = b + r + s, n = c - r * s; if (m === 0 || n === 0 || Math.abs(m) > 15 || Math.abs(n) > 40 || m === b) throw new GenFail("x");
      const ySum = rng.chance(0.4); const ans = ySum ? m * (r + s) + 2 * n : r + s;
      const stimulus = spin(rng, `[[The graphs of the two equations below intersect at two points|A parabola and a line are given by the equations below, and they cross at two points|The system of equations below graphs a parabola and a line that meet at two points]] in the xy-plane.\n\n`) + M(`y = ${quad(b, c)}`) + "\n" + M(`y = ${lin(m, n)}`);
      return finish(rng, {
        stimulus, question: ySum ? spin(rng, "[[What is the sum of the y-coordinates of the two points of intersection?|What is the sum of the y-coordinates of the intersection points?|If the two intersection points are added, what is the sum of their y-coordinates?]]") : spin(rng, "[[What is the sum of the x-coordinates of the two points of intersection?|What is the sum of the x-coordinates of the intersection points?|If the two intersection points are added, what is the sum of their x-coordinates?]]"), correct: ans,
        wrongs: ySum
          ? [{ v: r + s, kind: "step_missing", reason: "x 좌표의 합만 구하고 y 좌표를 계산하지 않았다." }, { v: m * (r + s) + n, kind: "step_missing", reason: "직선에 대입할 때 상수항 n 을 한 번만 더했다(점이 두 개)." }, { v: m * (r + s), kind: "step_missing", reason: "y 좌표의 상수항 합 2n 을 빠뜨렸다." }, { v: b - m, kind: "sign_error", reason: "근의 합의 부호를 반대로 써서 y 합을 계산했다." }, { v: -ans, kind: "sign_error", reason: "부호를 반대로 적었다." }]
          : [{ v: m + b, kind: "sign_error", reason: "x 계수를 옮길 때 부호를 놓쳐 (b - m) 대신 (b + m) 을 썼다." }, { v: b - m, kind: "sign_error", reason: "두 근의 합이 -(계수) 라는 부호를 놓쳤다." }, { v: c - n, kind: "formula_misuse", reason: "합 대신 상수항의 차(곱)를 골랐다." }, { v: r * s, kind: "formula_misuse", reason: "근의 합 대신 곱을 골랐다." }, { v: -(r + s), kind: "sign_error", reason: "부호를 반대로 적었다." }],
        verificationJs: withParams({ b, c, m, n, y: ySum ? 1 : 0 }, "const xs=[]; for(let x=-200;x<=200;x++) if(x*x+P.b*x+P.c===P.m*x+P.n) xs.push(x); if(xs.length!==2) throw new Error('교점이 2개 아님'); return P.y? xs.reduce((t,x)=>t+(P.m*x+P.n),0) : xs[0]+xs[1];"),
        trace: [
          T("교점에서는 두 식의 y 가 같으므로 두 식의 우변을 같게 놓는다.", "At an intersection the two y-values are equal."),
          T(`$${quad(b, c)} = ${lin(m, n)}$ 이다.`, "Set the right sides equal."),
          T(`모두 한쪽으로 옮기면 $${quad(b - m, c - n)} = 0$ 이다.`, "Move all terms to one side."),
          T(`두 근의 합은 -(${b - m}) = ${m - b} = ${r + s} 이다 (x 좌표의 합).`, "The sum of solutions is the negative of the linear coefficient."),
          ...(ySum ? [T(`각 점의 y 좌표는 직선 y = ${lin(m, n)} 에서 나오므로 합은 ${m}(${r + s}) + 2(${n}) = ${ans} 이다.`, "Sum the y-values through the line.")] : [T("두 교점이 서로 다른 실수임을 판별식으로 확인한다.", "Check that two distinct intersections exist.")]),
        ],
        variant: ySum ? "sum_of_y" : "sum_of_x",
      });
    },
  },
  {
    id: "nes.sum_of_roots.chain2", skill: SKILL, kind: "sum_of_roots", operator: "chain2",
    structure: "첫 방정식의 근의 합 k 를 구해 둘째 방정식 kx² - tx + w = 0 의 최고차 계수로 쓰고 그 근의 합을 구한다",
    extraThinking: "앞 단계 결과가 뒤 방정식의 최고차 계수가 되고, 근이 무리수일 수 있어 합을 근과 계수의 관계로 읽어야 한다 — medium 은 한 방정식의 합",
    concepts: ["근과 계수의 관계", "연쇄 대입", "판별식으로 실근 확인"], mediumSteps: 2,
    generate(rng) {
      const r = rng.int(-4, 9), s = rng.int(-4, 9); const k = r + s; if (Math.abs(k) < 2 || r === s) throw new GenFail("x");
      const sig = rng.nz(-6, 7), t = k * sig, w = rng.nz(-8, 8); if (t * t - 4 * k * w <= 0 || Math.abs(t) > 90) throw new GenFail("x");
      const { b, c } = bc(r, s);
      const stimulus = spin(rng, `[[Let k be the sum of the solutions of the equation|Let k represent the sum of the two solutions of|Suppose k is equal to the sum of the solutions of]] `) + M(`${quad(b, c)} = 0`) + spin(rng, `[[. A second equation is given below|. Consider the second equation below, which uses k|. Then a second equation is written using that value of k]]:\n\n`) + M(`kx^2 ${SC(-t)}x ${SC(w)} = 0`);
      return finish(rng, {
        stimulus, question: spin(rng, "[[What is the sum of the solutions of the second equation?|Find the sum of the two solutions of the second equation.|What is the sum of the real solutions of the second equation?]]"), correct: sig,
        wrongs: [{ v: k, kind: "step_missing", reason: "첫 방정식의 합 k 만 구했다." }, { v: t, kind: "step_missing", reason: "둘째 방정식에서 k 로 나누지 않고 x 계수의 부호만 바꿨다." }, { v: -sig, kind: "sign_error", reason: "근의 합 -b/a 의 부호를 놓쳤다." }, { v: t * k, kind: "formula_misuse", reason: "t/k 대신 t·k 를 계산했다." }, { v: w / k, kind: "formula_misuse", reason: "합 대신 곱 w/k 를 구했다." }, { v: k * sig + 1, kind: "other", reason: "계산 오류." }],
        verificationJs: withParams({ b, c, t, w }, "const r=[]; for(let x=-200;x<=200;x++) if(x*x+P.b*x+P.c===0) r.push(x); if(r.length!==2) throw new Error('첫 근 2개 아님'); const k=r[0]+r[1];\nconst D=P.t*P.t-4*k*P.w; if(!(D>0)) throw new Error('실근 없음'); const x1=(P.t+Math.sqrt(D))/(2*k), x2=(P.t-Math.sqrt(D))/(2*k); return x1+x2;"),
        trace: [
          T(`첫 방정식에서 두 근의 합은 -(${b}) = ${k} 이므로 k = ${k} 이다.`, "The sum of the first equation's solutions is k."),
          T(`둘째 방정식에 k = ${k} 를 대입하면 $${k}x^2 ${SC(-t)}x ${SC(w)} = 0$ 이다.`, "Substitute k."),
          T(`판별식 ${t}² - 4·${k}·${pn(w)} = ${t * t - 4 * k * w} > 0 이므로 서로 다른 두 실근이 있다.`, "Check that real solutions exist."),
          T(`두 근의 합은 -(${-t}) / ${k} 이다.`, "Use -b/a."),
          T(`${t} / ${k} = ${sig} 이다.`, "Divide."),
        ],
        variant: "sum_then_leading_coefficient",
      });
    },
  },

  // ───────────── product_of_roots ─────────────
  {
    id: "nes.product_of_roots.inverse", skill: SKILL, kind: "product_of_roots", operator: "inverse",
    structure: "kx² - bx + c = 0 에서 근의 곱을 알려 주고 미지의 최고차 계수 k 를 c/곱 으로 구한 뒤 근의 합 b/k 를 구한다",
    extraThinking: "곱 조건으로 최고차 계수를 역산한 뒤 그 계수로 합을 다시 계산 — medium 은 최고차 계수가 숫자인 방정식에서 곱을 읽음",
    concepts: ["근과 계수의 관계(곱)", "최고차 계수 역산", "근과 계수의 관계(합)"], mediumSteps: 2,
    generate(rng) {
      const k = rng.int(2, 5), r = rng.nz(-5, 8), s = rng.nz(-5, 8); const pr = r * s, S = r + s; if (r === s || S === 0) throw new GenFail("x");
      const b = k * S, c = k * pr; if (Math.abs(b) > 90 || Math.abs(c) > 200 || Math.abs(pr) < 2) throw new GenFail("x");
      const stimulus = spin(rng, `[[In the equation below|For the equation shown|In the given equation|In the equation given here]], k is a positive integer, and the equation has two real solutions whose product is ${pr}.\n\n`) + M(`kx^2 ${SC(-b)}x ${SC(c)} = 0`);
      return finish(rng, {
        stimulus, question: spin(rng, "[[What is the sum of the solutions of the equation?|Find the sum of the two solutions.|What is the value of the sum of the solutions?]]"), correct: S,
        wrongs: [{ v: b, kind: "step_missing", reason: "k 로 나누지 않고 x 계수의 크기를 합으로 골랐다." }, { v: k, kind: "step_missing", reason: "k 만 구했다." }, { v: -S, kind: "sign_error", reason: "근의 합 -b/a 의 부호를 놓쳤다." }, { v: pr, kind: "formula_misuse", reason: "합 대신 곱을 골랐다." }, { v: c, kind: "step_missing", reason: "상수항을 그대로 답으로 골랐다." }, { v: S + k, kind: "other", reason: "합에 k 를 더했다." }],
        verificationJs: withParams({ b, c, pr }, "const hits=new Set(); for(let k=1;k<=60;k++){ const roots=[]; for(let x=-200;x<=200;x++) if(k*x*x-P.b*x+P.c===0) roots.push(x); if(roots.length===2 && roots[0]*roots[1]===P.pr) hits.add(roots[0]+roots[1]); }\nif(hits.size!==1) throw new Error('유일하지 않음'); return [...hits][0];"),
        trace: [
          T(`근의 곱은 c/k = ${c}/k 이고 이것이 ${pr} 이다.`, "The product of solutions is c over the leading coefficient."),
          T(`${c}/k = ${pr} 이므로 k = ${k} 이다.`, "Solve for k."),
          T(`k = ${k} 를 대입한 방정식은 $${k}x^2 ${SC(-b)}x ${SC(c)} = 0$ 이다.`, "Write the equation with k known."),
          T(`근의 합은 -(${-b}) / ${k} 이다.`, "Use -b/a for the sum."),
          T(`${b} / ${k} = ${S} 이다.`, "Divide."),
        ],
        variant: "leading_coefficient_inverse",
      });
    },
  },
  {
    id: "nes.product_of_roots.param_condition", skill: SKILL, kind: "product_of_roots", operator: "param_condition",
    structure: "x² - (uk+v)x + (wk+z) = 0 에서 '근의 곱이 Pr' 인 k 를 정하고, 그 k 로 만든 방정식의 큰 근을 구한다",
    extraThinking: "곱 조건 → k → 계수 대입 → 인수분해의 순서로 한 방정식을 두 번 쓴다 — medium 은 계수가 숫자인 방정식의 곱",
    concepts: ["근과 계수의 관계(곱)", "매개변수 방정식", "이차방정식 풀이"], mediumSteps: 2,
    generate(rng) {
      const r = rng.int(-5, 9), s = rng.int(-5, 9), u = rng.pick([-3, -2, -1, 1, 2, 3]), w = rng.pick([-3, -2, -1, 1, 2, 3]), k0 = rng.nz(-5, 5);
      const S = r + s, Pr = r * s; const v = S - u * k0, z = Pr - w * k0; // 합 = u k + v
      if (r === s || Math.abs(v) > 25 || Math.abs(z) > 40 || Math.abs(Pr) < 2) throw new GenFail("x");
      const stimulus = spin(rng, `[[In the equation below|For the equation shown|In the given equation|In the equation given here]], k is a constant. The equation has two real solutions, and the product of the solutions is ${Pr}.\n\n`) + M(`x^2 - (${lin(u, v, "k")})x + (${lin(w, z, "k")}) = 0`);
      return finish(rng, {
        stimulus, question: spin(rng, "[[What is the larger solution of the equation?|Find the larger of the two solutions.|What is the greater solution of the equation?]]"), correct: Math.max(r, s),
        wrongs: [{ v: Math.min(r, s), kind: "other", reason: "큰 근이 아니라 작은 근을 골랐다." }, { v: k0, kind: "step_missing", reason: "k 만 구했다." }, { v: S, kind: "step_missing", reason: "근의 합을 답으로 골랐다." }, { v: -Math.max(r, s), kind: "sign_error", reason: "근의 부호를 반대로 적었다." }, { v: Pr, kind: "formula_misuse", reason: "곱을 답으로 골랐다." }],
        verificationJs: withParams({ u, v, w, z, Pr }, "const hits=new Set(); for(let k=-100;k<=100;k++){ const B=P.u*k+P.v, C=P.w*k+P.z; const roots=[]; for(let x=-300;x<=300;x++) if(x*x-B*x+C===0) roots.push(x); if(roots.length===2 && roots[0]*roots[1]===P.Pr) hits.add(Math.max(...roots)); }\nif(hits.size!==1) throw new Error('유일하지 않음'); return [...hits][0];"),
        trace: [
          T("이차항의 계수가 1 이므로 두 근의 곱은 상수항과 같다.", "The product of solutions is the constant term."),
          T(`${lin(w, z, "k")} = ${Pr} 로 놓고 풀면 k = ${k0} 이다.`, "Solve for k."),
          T(`x 의 계수에 k 를 대입하면 ${u}·${pn(k0)} + ${pn(v)} = ${S} 이다.`, "Substitute k into the linear coefficient."),
          T(`방정식은 $${quad(-S, Pr)} = 0$ 이다.`, "Write the equation with k known."),
          T(`인수분해하면 x = ${Math.min(r, s)} 또는 x = ${Math.max(r, s)} 이므로 큰 근은 ${Math.max(r, s)} 이다.`, "Factor and pick the larger solution."),
        ],
        variant: "param_product_condition",
      });
    },
  },
  {
    id: "nes.product_of_roots.compose_kind", skill: SKILL, kind: "product_of_roots", operator: "compose_kind",
    structure: "x⁴ + (e-u)x² - eu = 0 (또는 x⁴ - bx² + c) 를 x² = t 로 치환해 t 의 근을 구하고 실근 x 의 곱을 구한다",
    extraThinking: "치환(이차식 꼴 발견), t 의 근의 부호에 따른 실근 선별, x = ±√t 의 곱 계산을 연결 — medium 은 이차방정식의 근의 곱",
    concepts: ["치환(x²=t)", "근과 계수의 관계", "실근 선별(음수 제곱 제외)"], mediumSteps: 2,
    generate(rng) {
      const both = rng.chance(0.5); const p = rng.int(1, 5); let q = rng.int(1, 5); const e = rng.int(1, 8);
      let b: number, c: number, ans: number;
      if (both) { if (p === q) q = p === 5 ? 4 : p + 1; b = -(p * p + q * q); c = p * p * q * q; ans = p * p * q * q; } else { b = e - p * p; c = -e * p * p; ans = -p * p; }
      const cs = both ? `+ ${c}` : `- ${-c}`; const bs = `${b < 0 ? "-" : "+"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}`;
      const stimulus = spin(rng, `[[Consider the equation below|The equation below has at least two real solutions|For the equation shown, x is a real number]]. `) + M(`x^4 ${bs}x^2 ${cs} = 0`);
      return finish(rng, {
        stimulus, question: spin(rng, "[[What is the product of all real solutions of the equation?|What is the product of all of the real solutions?|Find the product of every real solution of the equation.]]"), correct: ans,
        wrongs: both
          ? [{ v: p * q, kind: "step_missing", reason: "x² = t 의 두 근 p², q² 가 아니라 p, q 만 곱했다." }, { v: -p * p * q * q, kind: "sign_error", reason: "x = ±√t 의 부호 곱 (+)(-)(+)(-) = + 를 놓쳤다." }, { v: b, kind: "formula_misuse", reason: "t 방정식의 x 계수를 답으로 골랐다." }, { v: p * q * (p + q), kind: "other", reason: "근을 잘못 조합했다." }, { v: 0, kind: "other", reason: "대칭이라 곱이 0 이라고 착각했다." }]
          : [{ v: c, kind: "formula_misuse", reason: "음수 근 t 도 실근으로 세어 t 의 곱 c 를 골랐다." }, { v: p * p, kind: "sign_error", reason: "실근 ±p 의 곱의 부호(-p²)를 놓쳤다." }, { v: -p, kind: "step_missing", reason: "x² = t 의 근 t 가 아니라 √t 에서 멈췄다." }, { v: 0, kind: "other", reason: "대칭이라 곱이 0 이라고 착각했다." }, { v: -e, kind: "other", reason: "음수 근 t 의 값을 골랐다." }],
        verificationJs: withParams({ b, c }, "const xs=[]; for(let x=-60;x<=60;x++) if(x**4+P.b*x*x+P.c===0) xs.push(x); if(xs.length<2) throw new Error('실근 부족'); return xs.reduce((t,x)=>t*x,1);"),
        trace: [
          T("x² = t 로 치환하면 t 에 대한 이차방정식이 된다.", "Substitute t = x²."),
          T(`$t^2 ${bs}t ${cs} = 0$ 을 인수분해해 t 의 근을 구한다.`, "Factor the quadratic in t."),
          T(both ? `t = ${p * p} 또는 t = ${q * q} 로 둘 다 양수이다.` : `t = ${p * p} 또는 t = ${-e} 이다. x² = t 가 실수이려면 t ≥ 0 이어야 하므로 t = ${p * p} 만 쓴다.`, both ? "Both roots in t are positive." : "A negative t cannot equal x², so keep only the positive root."),
          T(both ? `실근은 x = ±${p}, ±${q} 이다.` : `실근은 x = ±${p} 이다.`, "List the real solutions."),
          T(`모든 실근의 곱은 ${ans} 이다.`, "Multiply them, keeping the signs."),
        ],
        variant: both ? "two_positive_t" : "one_negative_t",
      });
    },
  },
  {
    id: "nes.product_of_roots.chain2", skill: SKILL, kind: "product_of_roots", operator: "chain2",
    structure: "첫 방정식의 근의 곱 k 를 구해 둘째 방정식 x² + (k-m)x - mk = 0 에 쓰고 두 근의 제곱의 합을 구한다",
    extraThinking: "앞 단계의 곱이 뒤 방정식의 계수가 되고, 근을 구하거나 (합)²-2(곱) 로 제곱합을 계산하는 2단계 연쇄 — medium 은 한 방정식의 곱",
    concepts: ["근과 계수의 관계", "연쇄 대입", "제곱의 합"], mediumSteps: 2,
    generate(rng) {
      const r = rng.int(-6, 7), s = rng.int(-6, 7); const k = r * s; if (r === s || Math.abs(k) < 2 || Math.abs(k) > 40) throw new GenFail("x");
      const m = rng.int(2, 7); if (m === -k) throw new GenFail("x");
      const { b, c } = bc(r, s); const ans = m * m + k * k;
      const stimulus = spin(rng, `[[Let k be the product of the solutions of the equation|Let k represent the product of the two solutions of|Suppose k equals the product of the solutions of]] `) + M(`${quad(b, c)} = 0`) + spin(rng, `[[. A second equation is given below, where k is that product|. Consider the second equation below, which uses k|. Then a second equation is written with the value of k]]:\n\n`) + M(`x^2 + (k - ${m})x - ${m}k = 0`);
      return finish(rng, {
        stimulus, question: spin(rng, "[[What is the sum of the squares of the solutions of the second equation?|Find the sum of the squares of the two solutions of the second equation.|What is the value of the sum of the squares of the solutions of the second equation?]]"), correct: ans,
        wrongs: [{ v: (m - k) * (m - k), kind: "formula_misuse", reason: "(합)² 만 계산하고 -2·(곱) 을 빠뜨렸다." }, { v: k * k, kind: "step_missing", reason: "근 하나의 제곱만 더했다." }, { v: m * m, kind: "step_missing", reason: "근 하나의 제곱만 더했다." }, { v: m - k, kind: "step_missing", reason: "근의 합만 구했다." }, { v: (m + k) * (m + k), kind: "formula_misuse", reason: "제곱합 대신 (두 근의 크기의 합)² 을 계산했다." }, { v: k, kind: "step_missing", reason: "첫 방정식의 곱 k 만 구했다." }],
        verificationJs: withParams({ b, c, m }, "const r=[]; for(let x=-200;x<=200;x++) if(x*x+P.b*x+P.c===0) r.push(x); if(r.length!==2) throw new Error('첫 근 2개 아님'); const k=r[0]*r[1];\nconst r2=[]; for(let x=-400;x<=400;x++) if(x*x+(k-P.m)*x-P.m*k===0) r2.push(x); if(r2.length!==2) throw new Error('둘째 근 2개 아님'); return r2[0]*r2[0]+r2[1]*r2[1];"),
        trace: [
          T(`첫 방정식에서 두 근의 곱은 상수항 ${c} 이므로 k = ${k} 이다.`, "The product of the first equation's solutions is k."),
          T(`둘째 방정식에 k = ${k} 를 대입하면 $x^2 + (${k - m})x ${k * -m >= 0 ? "+" : "-"} ${Math.abs(m * k)} = 0$ 이다.`, "Substitute k."),
          T(`인수분해하면 $(x - ${m})(x + ${W(k)}) = 0$ 이므로 근은 ${m} 과 ${-k} 이다.`, "Factor the second equation."),
          T(`두 근의 제곱의 합은 ${m}² + ${W(-k)}² 이다.`, "Square and add."),
          T(`${m * m} + ${k * k} = ${ans} 이다.`, "Compute."),
        ],
        variant: "product_then_sum_of_squares",
      });
    },
  },

  // ───────────── num_real_solutions ─────────────
  {
    id: "nes.num_real_solutions.param_condition", skill: SKILL, kind: "num_real_solutions", operator: "param_condition",
    structure: "x² + bx + k = 0 이 서로 다른 두 실근(또는 실근 없음)을 갖는 정수 k 의 개수를 판별식 부등식으로 센다",
    extraThinking: "판별식 부등식 D>0 (경계 D=0 제외)을 세워 범위 안의 정수 개수를 센다 — medium 은 주어진 방정식의 실근 개수(0·1·2)만 판정",
    concepts: ["판별식 부등식", "정수 개수 세기", "경계값 처리"], mediumSteps: 3,
    generate(rng) {
      const h = rng.int(3, 9), b = rng.pick([-1, 1]) * 2 * h; const none = rng.chance(0.35); const N = h * h + rng.int(3, 12);
      const stimulus = none
        ? spin(rng, `[[In the equation below|For the equation shown|In the given equation|In the equation given here]], k is an integer with 1 ≤ k ≤ ${N}.\n\n`) + M(`x^2 ${b < 0 ? "-" : "+"} ${Math.abs(b)}x + k = 0`)
        : spin(rng, `[[In the equation below|For the equation shown|In the given equation|In the equation given here]], k is a positive integer.\n\n`) + M(`x^2 ${b < 0 ? "-" : "+"} ${Math.abs(b)}x + k = 0`);
      const ans = none ? N - h * h : h * h - 1;
      return finish(rng, {
        stimulus, question: none ? spin(rng, "[[For how many values of k does the equation have no real solution?|How many values of k give an equation with no real solutions?|For how many integers k is there no real solution?]]") : spin(rng, "[[For how many values of k does the equation have two distinct real solutions?|How many values of k give an equation with two different real solutions?|For how many positive integers k are there two distinct real solutions?]]"),
        correct: ans,
        wrongs: none
          ? [{ v: N - h * h + 1, kind: "condition_ignored", reason: "D = 0(중근)인 k 도 '실근 없음' 에 포함했다." }, { v: N - h * h - 1, kind: "step_missing", reason: "경계를 하나 덜 셌다." }, { v: N, kind: "step_missing", reason: "범위의 모든 k 를 셌다." }, { v: h * h, kind: "formula_misuse", reason: "k 의 경계값 자체를 개수로 골랐다." }, { v: N - 2 * h, kind: "formula_misuse", reason: "D = 0 의 경계를 b 로 잘못 계산했다." }]
          : [{ v: h * h, kind: "condition_ignored", reason: "D = 0(중근)인 k = 경계값도 '서로 다른 두 실근' 에 포함했다." }, { v: h * h - 2, kind: "step_missing", reason: "경계를 하나 더 제외했다." }, { v: 2 * h, kind: "formula_misuse", reason: "경계 k 를 b 로 잘못 계산했다." }, { v: h, kind: "formula_misuse", reason: "경계 k 를 b/2 로 계산하고 제곱하지 않았다." }, { v: 4 * h * h - 1, kind: "formula_misuse", reason: "D = b² - 4k > 0 에서 b² 을 경계로 잘못 썼다." }],
        verificationJs: withParams(none ? { b, N } : { b }, `let cnt=0; const none=${none ? 1 : 0}; const hi=none? P.N : 400; for(let k=1;k<=hi;k++){ let mn=Infinity; for(let x=-80;x<=80;x++){ const f=x*x+P.b*x+k; if(f<mn) mn=f; } if(none? mn>0 : mn<0) cnt++; } return cnt;`),
        trace: [
          T("x² 의 계수가 1 이므로 판별식은 D = b² - 4k 이다.", "Write the discriminant."),
          T(none ? `실근이 없으려면 D < 0 이므로 ${b * b} - 4k < 0 이다.` : `서로 다른 두 실근이므로 D > 0, 즉 ${b * b} - 4k > 0 이다.`, "Translate the root condition into an inequality."),
          T(none ? `이를 풀면 k > ${h * h} 이다.` : `이를 풀면 k < ${h * h} 이다(k = ${h * h} 는 D = 0 이라 제외).`, "Solve the inequality, watching the boundary."),
          T(none ? `${h * h + 1} ≤ k ≤ ${N} 인 정수를 센다.` : `1 ≤ k ≤ ${h * h - 1} 인 정수를 센다.`, "Count the integers in the allowed range."),
          T(`개수는 ${ans} 이다.`, "State the count."),
        ],
        variant: none ? "count_no_real" : "count_two_real",
      });
    },
  },
  {
    id: "nes.num_real_solutions.constraint_select", skill: SKILL, kind: "num_real_solutions", operator: "constraint_select",
    structure: "(x²-p²)(x²-Bx+C)=0 의 서로 다른 '양의' 실근 개수를 두 인수의 근 집합에서 중복을 제거해 센다",
    extraThinking: "양의 실근만 선별하고 두 인수의 근이 겹치는 경우를 제거(제약·중복 추적) — medium 은 한 이차방정식의 실근 개수",
    concepts: ["곱의 영 인수분해", "양수 조건", "중복 해 제거"], mediumSteps: 3,
    generate(rng) {
      const p = rng.int(1, 6); const noReal = rng.chance(0.25); let r = 0, s = 0, B = 0, C = 0;
      if (noReal) { B = rng.int(-5, 5); C = Math.floor(B * B / 4) + rng.int(1, 6); } else { r = rng.int(-6, 7); s = rng.int(-6, 7); if (r === s) throw new GenFail("x"); ({ b: B, c: C } = bc(r, s)); }
      const set = new Set<number>([p, -p]); if (!noReal) { set.add(r); set.add(s); }
      const pos = [...set].filter((x) => x > 0).length, all = set.size, mult = (p > 0 ? 1 : 0) + (noReal ? 0 : [r, s].filter((x) => x > 0).length);
      const extra = [0, 1, 2, 3, 4, 5].filter((v) => v !== pos);
      return finish(rng, {
        stimulus: spin(rng, `[[Consider the equation below|The equation below is written as a product|For the equation shown, x is a real number]]. `) + M(`(x^2 - ${p * p})(${quad(B, C)}) = 0`),
        question: spin(rng, "[[How many distinct positive real solutions does the equation have?|How many different positive real numbers are solutions of the equation?|What is the number of distinct positive real solutions of the equation?]]"), correct: pos,
        wrongs: [{ v: all, kind: "condition_ignored", reason: "양수 조건을 무시하고 서로 다른 실근 전체를 셌다." }, { v: mult, kind: "step_missing", reason: "두 인수에서 겹치는 근을 중복해서 셌다." }, { v: pos + 1, kind: "other", reason: "한 근을 더 셌다." }, { v: Math.max(0, pos - 1), kind: "other", reason: "한 근을 덜 셌다." }, ...extra.map((v) => ({ v, kind: "other" as const, reason: "근의 개수를 잘못 셌다." }))],
        verificationJs: withParams({ p2: p * p, B, C }, "const set=new Set(); for(let x=-60;x<=60;x++) if((x*x-P.p2)*(x*x+P.B*x+P.C)===0 && x>0) set.add(x); return set.size;"),
        trace: [
          T("곱이 0 이므로 두 인수 중 하나가 0 이다.", "A product is zero when a factor is zero."),
          T(`x² - ${p * p} = 0 에서 x = ±${p} 이다.`, "Solve the first factor."),
          T(noReal ? `두 번째 인수는 판별식 ${B * B} - 4·${C} < 0 이라 실근이 없다.` : `$${quad(B, C)} = 0$ 을 풀면 x = ${r}, ${s} 이다.`, "Solve the second factor."),
          T("모든 실근 중 양수만 모은다.", "Keep only the positive solutions."),
          T(`겹치는 값을 한 번만 세어 서로 다른 양의 실근은 ${pos} 개이다.`, "Count distinct positive solutions once each."),
        ],
        variant: noReal ? "second_factor_no_real" : "overlap_possible",
      });
    },
  },
  {
    id: "nes.num_real_solutions.compose_kind", skill: SKILL, kind: "num_real_solutions", operator: "compose_kind",
    structure: "포물선 y=x²+bx+c 를 좌우·상하 이동한 그래프의 x절편 개수를 이동 후 최솟값의 부호(수직 이동만 영향)로 판정",
    extraThinking: "도형 이동(그래프 변환)과 실근 개수 개념을 연결하고 수평 이동은 개수에 영향을 주지 않음을 구분 — medium 은 방정식의 판별식 부호 판정",
    concepts: ["그래프 평행이동", "꼭짓점(최솟값)", "x절편과 실근 개수"], mediumSteps: 3,
    generate(rng) {
      const hh = rng.nz(-6, 6), b = rng.pick([-1, 1]) * 2 * rng.int(1, 7), c = rng.int(-10, 12); const k0 = c - (b * b) / 4;
      const outcome = rng.int(0, 2); const j = rng.int(1, 5); const dy = outcome === 1 ? -k0 : outcome === 2 ? -k0 - j : -k0 + j; // 새 최솟값 = k0 + dy
      if (dy === 0 || Math.abs(dy) > 30) throw new GenFail("x");
      const horiz = hh > 0 ? `${hh} unit${hh === 1 ? "" : "s"} to the right` : `${-hh} unit${hh === -1 ? "" : "s"} to the left`; const vert = dy > 0 ? `${dy} unit${dy === 1 ? "" : "s"} up` : `${-dy} unit${dy === -1 ? "" : "s"} down`;
      const cnt = outcome === 1 ? 1 : outcome === 2 ? 2 : 0;
      return finish(rng, {
        stimulus: spin(rng, `[[The graph of the function f is shown by the equation below|The function f is defined below|Let f be the function defined by the equation below]]:\n\n`) + M(`f(x) = ${quad(b, c)}`) + spin(rng, `\n\n[[The graph of f is translated ${horiz} and then ${vert} to form the graph of g.|The graph of g is obtained by shifting the graph of f ${horiz} and then ${vert}.|To get the graph of g, the graph of f is moved ${horiz}, and then ${vert}.]]`),
        question: spin(rng, "[[How many x-intercepts does the graph of g have?|What is the number of x-intercepts of the graph of g?|How many times does the graph of g cross or touch the x-axis?]]"), correct: cnt,
        wrongs: [0, 1, 2, 3].filter((v) => v !== cnt).map((v) => ({ v, kind: "other" as const, reason: v === 3 ? "이차함수의 x절편은 최대 2개인데 3개로 골랐다." : "이동 후 꼭짓점의 위치를 잘못 판단했다(수평 이동이 개수를 바꾼다고 착각하거나 수직 이동 방향을 반대로 적용)." })),
        verificationJs: withParams({ hh, b, c, dy }, "let mn=Infinity; for(let x=-120;x<=120;x++){ const u=x-P.hh; const g=u*u+P.b*u+P.c+P.dy; if(g<mn) mn=g; } return mn<0?2:(mn===0?1:0);"),
        trace: [
          T(`f 의 꼭짓점의 y 좌표(최솟값)는 ${c} - ${b * b}/4 = ${k0} 이다.`, "Find the minimum value of f."),
          T(`수평 이동은 x절편의 위치만 바꾸고 개수는 바꾸지 않는다.`, "A horizontal shift moves the intercepts but does not change how many there are."),
          T(`${dy > 0 ? "위" : "아래"}로 ${Math.abs(dy)} 이동하면 g 의 최솟값은 ${k0} ${dy >= 0 ? "+" : "-"} ${Math.abs(dy)} = ${k0 + dy} 이다.`, "Apply the vertical shift to the minimum."),
          T("아래로 열린 포물선이 아니라 위로 열린 포물선(최고차 계수 1 > 0)이다.", "The parabola opens upward."),
          T(`최솟값이 ${k0 + dy < 0 ? "음수" : k0 + dy === 0 ? "0" : "양수"} 이므로 x절편은 ${cnt} 개이다.`, "Decide the number of x-intercepts from the sign of the minimum."),
        ],
        variant: "translation_intercepts",
      });
    },
  },
  {
    id: "nes.num_real_solutions.compare_scenarios", skill: SKILL, kind: "num_real_solutions", operator: "compare_scenarios",
    structure: "두 이차방정식 각각의 실근 집합을 구한 뒤 합집합의 서로 다른 값의 개수를 센다(공통근 처리)",
    extraThinking: "두 경우의 해 집합을 모두 구해 비교하고 겹치는 해를 한 번만 세어야 한다 — medium 은 한 방정식의 실근 개수",
    concepts: ["이차방정식 풀이", "해 집합 비교", "합집합의 원소 수"], mediumSteps: 3,
    generate(rng) {
      const A = [rng.int(-5, 6), rng.int(-5, 6)]; if (A[0] === A[1]) throw new GenFail("x"); const kind2 = rng.pick(["quad", "square", "none"] as const);
      let B2: number[] = []; let b2 = 0, c2 = 0;
      if (kind2 === "quad") { const x = rng.pick([...A, rng.int(-5, 6)]), y = rng.int(-5, 6); if (x === y) throw new GenFail("x"); B2 = [x, y]; ({ b: b2, c: c2 } = bc(x, y)); }
      else if (kind2 === "square") { const q = rng.int(1, 6); B2 = [q, -q]; b2 = 0; c2 = -q * q; }
      else { b2 = rng.int(-4, 4); c2 = Math.floor((b2 * b2) / 4) + rng.int(1, 5); }
      const bcA = bc(A[0], A[1]); const union = new Set([...A, ...B2]).size; const total = 2 + B2.length;
      const listB = B2.length ? `${B2[0]} 와 ${B2[1]}` : "없음(실근 없음)";
      return finish(rng, {
        stimulus: spin(rng, `[[Two equations are given below|Consider the following two equations|Equation 1 and Equation 2 are listed below]]:\n\n`) + `Equation 1: ${M(`${quad(bcA.b, bcA.c)} = 0`)}\n\nEquation 2: ${M(`${quadStr(1, b2, c2)} = 0`)}`,
        question: spin(rng, "[[How many different real numbers are a solution to at least one of the two equations?|How many distinct real numbers satisfy Equation 1, Equation 2, or both?|What is the total number of distinct real solutions of the two equations combined?]]"), correct: union,
        wrongs: [{ v: total, kind: "step_missing", reason: "공통인 해를 두 번 세었다." }, { v: 2, kind: "scope", reason: "한 방정식의 해만 셌다." }, { v: B2.length, kind: "scope", reason: "두 번째 방정식의 해만 셌다." }, { v: union + 1, kind: "other", reason: "해를 하나 더 셌다." }, { v: Math.max(0, union - 1), kind: "other", reason: "해를 하나 덜 셌다." }, { v: 4, kind: "other", reason: "각 방정식에 해가 둘씩 있다고 가정했다." }, { v: 0, kind: "other", reason: "실근이 없다고 판단했다." }],
        verificationJs: withParams({ b1: bcA.b, c1: bcA.c, b2, c2 }, "const s=new Set(); for(let x=-60;x<=60;x++){ if(x*x+P.b1*x+P.c1===0 || x*x+P.b2*x+P.c2===0) s.add(x); } return s.size;"),
        trace: [
          T(`Equation 1 을 풀면 x = ${A[0]}, ${A[1]} 이다.`, "Solve Equation 1."),
          T(`Equation 2 의 판별식 ${b2 * b2} - 4·${pn(c2)} = ${b2 * b2 - 4 * c2} 의 부호를 확인한다.`, "Check the discriminant of Equation 2."),
          T(`Equation 2 의 실근: ${listB}.`, "Solve Equation 2 over the reals."),
          T("두 해 집합을 합하되 같은 값은 한 번만 센다.", "Combine the two solution sets without double counting."),
          T(`서로 다른 실수 해는 ${union} 개이다.`, "Count the distinct numbers."),
        ],
        variant: "union_of_solution_sets",
      });
    },
  },
];
