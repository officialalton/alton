// probability hard 원형 12개(simple·conditional·sequential_without_replacement × 연산자 4종). 정답은 기약분수 문자열.
import { GenFail, type Archetype } from "../types";
import { facts, finish, frac, lin, spin, withParams } from "../text";
import { gcd } from "../rng";
import type { DistractorKind } from "../../review";

const SKILL = "probability";
const W = (n: number, d: number, kind: DistractorKind, reason: string) => ({ text: frac(n, d), kind, reason });
const isPrime = (n: number) => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };

type DiceEvent = { id: string; text: (k: number) => string; fn: (a: number, b: number, k: number) => boolean };
const DICE_EVENTS: DiceEvent[] = [
  { id: "prime", text: () => "the sum of the two numbers is a prime number", fn: (a, b) => isPrime(a + b) },
  { id: "mult3", text: () => "the sum of the two numbers is a multiple of 3", fn: (a, b) => (a + b) % 3 === 0 },
  { id: "prodeven", text: () => "the product of the two numbers is even", fn: (a, b) => (a * b) % 2 === 0 },
  { id: "diff", text: (k) => `the two numbers differ by at least ${k}`, fn: (a, b, k) => Math.abs(a - b) >= k },
  { id: "factor", text: () => "one of the two numbers is a factor of the other", fn: (a, b) => a % b === 0 || b % a === 0 },
  { id: "sumlt", text: (k) => `the sum of the two numbers is less than ${k}`, fn: (a, b, k) => a + b < k },
];
const EVENT_JS = `function ev(id,a,b,k){ switch(id){ case 'prime': { const n=a+b; if(n<2) return false; for(let i=2;i*i<=n;i++) if(n%i===0) return false; return true; } case 'mult3': return (a+b)%3===0; case 'prodeven': return (a*b)%2===0; case 'diff': return Math.abs(a-b)>=k; case 'factor': return b%a===0||a%b===0; case 'sumlt': return a+b<k; } throw new Error('event'); }`;

export const PR_ARCHETYPES: Archetype[] = [
  {
    id: "probability.simple.compose_kind", skill: SKILL, kind: "simple", operator: "compose_kind",
    structure: "면의 수가 다른 두 주사위의 표본공간(s1×s2)에서 소수·배수·인수 관계 사건의 경우의 수를 체계적으로 세어 확률을 구함",
    extraThinking: "두 대상의 합성 표본공간 구성과 사건의 수론 성질(소수·약수·배수) 분석 — medium 은 한 번의 단순 확률",
    concepts: ["합성 표본공간", "수론 성질(소수·배수·약수)", "경우의 수 세기"], mediumSteps: 2,
    generate(rng) {
      const s1 = rng.pick([4, 6, 8, 10]), s2 = rng.pick([4, 6, 8, 12]); if (s1 === s2) throw new GenFail("x"); const e = rng.pick(DICE_EVENTS); const k = e.id === "diff" ? rng.int(2, Math.min(s1, s2) - 1) : e.id === "sumlt" ? rng.int(4, Math.min(s1 + s2 - 1, 9)) : 0;
      let cnt = 0; for (let a = 1; a <= s1; a++) for (let b = 1; b <= s2; b++) if (e.fn(a, b, k)) cnt++;
      const tot = s1 * s2; if (cnt === 0 || cnt === tot || gcd(cnt, tot) === tot) throw new GenFail("x");
      const pe = e.text(k);
      const spin2 = rng.chance(0.4);
      const stimulus = spin2
        ? facts(rng, [[`Two fair spinners are spun at once: the first has ${s1} equal sectors numbered 1 through ${s1}, and the second has ${s2} equal sectors numbered 1 through ${s2}.`, `A spinner with ${s1} equal sectors (numbered from 1) and a spinner with ${s2} equal sectors (numbered from 1) are spun together.`, `In a carnival game a player spins two wheels, one with the numbers 1 to ${s1} and another with the numbers 1 to ${s2}, each number equally likely.`], [`The two results are read as a pair of numbers.`, `Each spin lands on exactly one number.`, `Every pair of results is equally likely.`]])
        : facts(rng, [[`A fair ${s1}-sided die and a fair ${s2}-sided die, each numbered from 1 up, are rolled once.`, `Two fair dice are rolled together: one has ${s1} faces and the other has ${s2} faces, both numbered starting at 1.`, `One die has ${s1} equally likely faces numbered 1 through ${s1}, and another has ${s2} equally likely faces numbered 1 through ${s2}. Both are rolled.`, `A ${s1}-sided die and a ${s2}-sided die, both fair and labeled starting at 1, are tossed at the same time.`], [`The two results are read as a pair of numbers.`, `Each die shows exactly one number.`, `Every pair of faces is equally likely.`]]);
      const pr = (x: number) => frac(x, tot);
      return finish(rng, {
        stimulus, question: spin(rng, `[[What is the probability that ${pe}?|What is the probability that, for the two results, ${pe.replace(/^the /, "the ")}?|What fraction of the possible outcomes have the property that ${pe}?|Find the probability that ${pe}.|If one pair of results is obtained, what is the chance that ${pe}?|How likely is it that ${pe}? Give the probability as a fraction.]]`),
        range: [0, 1], correctText: pr(cnt),
        wrongTexts: [W(tot - cnt, tot, "opposite", "여사건(사건이 일어나지 않을 확률)을 구했다."), W(cnt, s1 + s2, "formula_misuse", "표본공간을 s1 + s2 로 계산했다(곱 s1·s2 여야 함)."), W(cnt + 1, tot, "step_missing", "경우의 수를 하나 더 셌다."), W(cnt - 1, tot, "step_missing", "경우의 수를 하나 빠뜨렸다."), W(cnt + 2, tot, "step_missing", "경우의 수를 잘못 셌다.")],
        verificationJs: withParams({ s1, s2, id: e.id, k }, `${EVENT_JS}\nlet c=0,t=0;\nfor(let a=1;a<=P.s1;a++) for(let b=1;b<=P.s2;b++){ t++; if(ev(P.id,a,b,P.k)) c++; }\nreturn c/t;`),
        trace: [
          [`두 주사위의 나올 수 있는 결과는 ${s1} × ${s2} = ${tot} 가지이고 모두 같은 확률이다.`, "Count the equally likely outcomes."],
          [`사건은 "${pe}" 이다.`, "State the event precisely."],
          ["첫 번째 주사위의 눈 값을 차례로 고정하고 두 번째 주사위의 눈 중 조건을 만족하는 경우를 나열한다.", "Enumerate systematically by fixing the first die."],
          [`조건을 만족하는 경우는 모두 ${cnt} 가지이다.`, "Count the favorable outcomes."],
          [`확률 = ${cnt}/${tot} 이다.`, "Form the probability."],
          [`기약분수로 고치면 ${pr(cnt)} 이다.`, "Reduce."],
        ],
        variant: `dice_${e.id}`,
      });
    },
  },
  {
    id: "probability.simple.inverse", skill: SKILL, kind: "simple", operator: "inverse",
    structure: "'정확히 하나만 하는 학생 수 r'와 각 활동 인원 A, B 로부터 '둘 다 하는 학생 수' C=(A+B−r)/2 를 역산해 확률을 구함",
    extraThinking: "합집합 공식을 역방향으로 사용해 교집합을 구하는 역문제(정확히 하나 = A+B−2C) — medium 은 주어진 개수로 바로 확률 계산",
    concepts: ["벤 다이어그램 집합 관계", "교집합 역산", "확률"], mediumSteps: 2,
    generate(rng) {
      const N = rng.int(40, 120), xa = rng.int(3, 25), xb = rng.int(3, 25), C = rng.int(2, 20); const A = xa + C, B = xb + C, r = xa + xb;
      if (xa + xb + C > N - 3 || xa === xb) throw new GenFail("x");
      const [g1, g2, grp] = rng.pick([["take art", "take music", "students"], ["play chess", "are on the debate team", "students"], ["play soccer", "swim", "athletes"], ["speak Spanish", "speak French", "travelers"], ["subscribe to the newsletter", "follow the blog", "members"], ["own a bicycle", "own a scooter", "residents"]] as const);
      const stimulus = facts(rng, [[`Of ${N} ${grp}, ${A} ${g1} and ${B} ${g2}.`, `In a group of ${N} ${grp}, ${A} ${g1}, while ${B} ${g2}.`, `Among ${N} ${grp}, exactly ${A} ${g1} and exactly ${B} ${g2}.`], [`Exactly ${r} of the ${grp} do one of these two things but not both.`, `${r} of the ${grp} do exactly one of the two activities (not both).`, `The number who do one of the two but not both is ${r}.`]]);
      return finish(rng, {
        stimulus, question: spin(rng, `[[If one of the ${N} ${grp} is chosen at random, what is the probability that the chosen person does both?|What is the probability that a randomly chosen one of the ${grp} does both activities?|One of the ${grp} is selected at random. What is the probability that the person does both?]]`),
        range: [0, 1], correctText: frac(C, N),
        wrongTexts: [W(A + B - r, N, "formula_misuse", "'정확히 하나'를 A+B−C 로 착각해 2를 나누지 않았다."), W(r, N, "formula_misuse", "정확히 하나만 하는 학생의 확률을 답했다."), W(C, A, "formula_misuse", "전체가 아니라 한 활동 인원으로 나눴다."), W(A + B, N, "step_missing", "겹치는 학생을 빼지 않고 두 인원을 더했다."), W(N - C, N, "opposite", "여사건을 구했다.")],
        verificationJs: withParams({ N, A, B, r }, "const out=[];\nfor(let c=0;c<=Math.min(P.A,P.B);c++){ const onlyA=P.A-c, onlyB=P.B-c; if(onlyA+onlyB===P.r && onlyA+onlyB+c<=P.N) out.push(c/P.N); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`둘 다 하는 학생 수를 C 라 하면 정확히 하나만 하는 학생은 (${A} - C) + (${B} - C) 이다.`, "Express exactly-one in terms of the overlap C."],
          [`이것이 ${r} 이므로 ${A + B} - 2C = ${r} 이다.`, "Set it equal to the given number."],
          [`C = (${A + B} - ${r})/2 = ${C} 이다.`, "Solve for C."],
          [`합집합 ${xa + xb + C} 명이 전체 ${N} 명을 넘지 않음을 확인한다.`, "Check the counts are feasible."],
          [`확률 = ${C}/${N} 이다.`, "Form the probability."],
          [`기약분수는 ${frac(C, N)} 이다.`, "Reduce."],
        ],
        variant: "exactly_one_inverse",
      });
    },
  },
  {
    id: "probability.simple.compare_scenarios", skill: SKILL, kind: "simple", operator: "compare_scenarios",
    structure: "빨간 구슬 r개·파란 구슬 b개 주머니에 빨간 구슬을 x개 더 넣어 P(빨강)=p/q 가 되게 하는 x 를 방정식으로 구함(처음과 나중 비교)",
    extraThinking: "현재·추가 후 두 상태의 확률 비교를 미지수 방정식으로 세우는 역문제 — medium 은 주어진 구성에서 확률 계산",
    concepts: ["확률 정의", "분수 방정식", "상황 변화"], mediumSteps: 2,
    generate(rng) {
      const r = rng.int(2, 12), b = rng.int(3, 15), x = rng.int(1, 30); const n = r + b;
      const pn = r + x, pd = n + x; const g = gcd(pn, pd); const p = pn / g, q = pd / g;
      if (q > 60 || q === 1 || p >= q || q < 4) throw new GenFail("x");
      const [red, blue, obj] = rng.pick([["red", "blue", "marbles"], ["red", "green", "beads"], ["yellow", "white", "tiles"], ["black", "white", "chess pieces"], ["red", "blue", "cards"]] as const);
      const stimulus = facts(rng, [[`A bag contains ${r} ${red} ${obj} and ${b} ${blue} ${obj}.`, `In a bag there are ${r} ${red} ${obj} and ${b} ${blue} ${obj}.`, `There are ${r} ${red} and ${b} ${blue} ${obj} in a bag.`], [`Some more ${red} ${obj} are added to the bag, and then one ${obj.replace(/s$/, "")} is chosen at random.`, `After additional ${red} ${obj} are put into the bag, one ${obj.replace(/s$/, "")} is drawn at random.`, `Several extra ${red} ${obj} go into the bag; a single ${obj.replace(/s$/, "")} is then picked without looking.`], [`The probability of choosing a ${red} one is now ${frac(p, q)}.`, `This makes the chance of a ${red} draw equal to ${frac(p, q)}.`, `As a result, the probability that the pick is ${red} is ${frac(p, q)}.`]]);
      return finish(rng, {
        stimulus, question: spin(rng, `[[How many ${red} ${obj} were added?|What is the number of ${red} ${obj} that were added to the bag?|Find the number of ${red} ${obj} added.]]`),
        correct: x,
        wrongs: [{ v: r + b + x, kind: "other", reason: "추가 후의 전체 개수를 답했다." }, { v: r + x, kind: "other", reason: "추가 후의 빨간 개수를 답했다." }, { v: x + 2, kind: "other", reason: "계산 실수." }, { v: x - 1, kind: "other", reason: "계산 실수." }, { v: Math.round((p * n - q * r) / q) + 0.5, kind: "step_missing", reason: "추가 후 전체 개수에 x 를 반영하지 않았다." }, { v: b, kind: "other", reason: "파란 공의 개수를 답했다." }],
        verificationJs: withParams({ r, b, p, q }, "const out=[];\nfor(let x=0;x<=600;x++){ if((P.r+x)*P.q === P.p*(P.r+P.b+x)) out.push(x); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`처음 전체 개수는 ${r} + ${b} = ${n} 이다.`, "Current total."],
          [`${red} 을(를) x 개 넣으면 ${red} 는 ${r} + x, 전체는 ${n} + x 이다.`, "After adding x red items."],
          [`확률 조건: (${r} + x)/(${n} + x) = ${frac(p, q)} 이다.`, "Write the probability equation."],
          [`내항·외항을 곱하면 ${q}(${r} + x) = ${p}(${n} + x) 이다.`, "Cross-multiply."],
          [`정리하면 ${q - p}x = ${p * n - q * r} 이므로 x = ${x} 이다.`, "Solve for x."],
        ],
        variant: "add_to_reach_probability",
      });
    },
  },
  {
    id: "probability.simple.repr_shift", skill: SKILL, kind: "simple", operator: "repr_shift",
    structure: "원판 세 부채꼴의 중심각이 x 의 일차식일 때 합=360° 방정식으로 x 를 구해 한 부채꼴의 확률(각/360)을 구함",
    extraThinking: "기하 표현(중심각 합 360°)을 대수 방정식으로 번역한 뒤 확률로 재해석 — medium 은 주어진 각으로 바로 확률 계산",
    concepts: ["원의 중심각 합", "일차방정식", "기하학적 확률"], mediumSteps: 2,
    generate(rng) {
      const a1 = rng.int(1, 4), a2 = rng.int(1, 4), a3 = rng.int(1, 4), x = rng.int(12, 45), c2 = rng.int(-25, 30);
      const t1 = a1 * x, t2 = a2 * x + c2; const c3 = 360 - (a1 + a2 + a3) * x - c2; const t3 = a3 * x + c3;
      if (c3 === 0 || c2 === 0 || Math.abs(c3) > 60 || t1 < 15 || t2 < 15 || t3 < 15 || t1 + t2 + t3 !== 360) throw new GenFail("x");
      const pick = rng.pick([0, 1, 2]); const ang = [t1, t2, t3][pick];
      const [c1n, c2n, c3n] = rng.pick([["red", "blue", "green"], ["gold", "silver", "bronze"], ["A", "B", "C"], ["north", "east", "south"]] as const);
      const names = [c1n, c2n, c3n]; const exprs = [lin(a1, 0, "x"), lin(a2, c2, "x"), lin(a3, c3, "x")];
      const stimulus = facts(rng, [[`A circular spinner is divided into three sectors labeled ${c1n}, ${c2n}, and ${c3n}.`, `A spinner has three sectors, ${c1n}, ${c2n}, and ${c3n}, that fill the whole circle.`, `The circle of a spinner is split into sectors named ${c1n}, ${c2n}, and ${c3n}.`], [`Their central angles, in degrees, are ${exprs.map((e) => `$${e}$`).join(", ")}, respectively.`, `The central angles measure $${exprs[0]}$, $${exprs[1]}$, and $${exprs[2]}$ degrees in that order.`, `In degrees, the angles at the center are $${exprs[0]}$ for ${c1n}, $${exprs[1]}$ for ${c2n}, and $${exprs[2]}$ for ${c3n}.`]]);
      return finish(rng, {
        stimulus, question: spin(rng, `[[The spinner is spun once. What is the probability that it lands on the ${names[pick]} sector?|What is the probability that one spin of the spinner lands on ${names[pick]}?|If the spinner is spun once and every point is equally likely, what is the chance of ${names[pick]}?]]`),
        range: [0, 1], correctText: frac(ang, 360),
        wrongTexts: [W([t1, t2, t3][(pick + 1) % 3], 360, "other", "다른 부채꼴의 확률을 구했다."), W([t1, t2, t3][(pick + 2) % 3], 360, "other", "다른 부채꼴의 확률을 구했다."), W(ang, 180, "formula_misuse", "전체 각을 180° 로 착각했다."), W(ang + c2 - c3, 360, "step_missing", "x 를 구한 뒤 각을 계산할 때 상수항을 빠뜨리거나 잘못 더했다."), W(a1 + a2 + a3, 360, "step_missing", "계수의 합을 각으로 착각했다.")],
        verificationJs: withParams({ a1, a2, a3, c2, c3, pick }, "const out=[];\nfor(let x=1;x<=180;x++){ const t=[P.a1*x, P.a2*x+P.c2, P.a3*x+P.c3]; if(t[0]+t[1]+t[2]===360) out.push(t[P.pick]/360); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          ["원의 중심각의 합은 360° 이므로 세 각의 합이 360 이다.", "Central angles sum to 360 degrees."],
          [`(${exprs[0]}) + (${exprs[1]}) + (${exprs[2]}) = 360 이다.`, "Write the equation."],
          [`동류항을 정리하면 ${a1 + a2 + a3}x + ${c2 + c3} = 360 이다.`, "Combine like terms."],
          [`x = ${x} 를 얻는다.`, "Solve for x."],
          [`${names[pick]} 부채꼴의 각은 ${ang}° 이다.`, "Compute the sector angle."],
          [`확률 = ${ang}/360 = ${frac(ang, 360)} 이다.`, "Divide by 360 and reduce."],
        ],
        variant: "angles_to_probability",
      });
    },
  },
  {
    id: "probability.conditional.repr_shift", skill: SKILL, kind: "conditional", operator: "repr_shift",
    structure: "전체·한 집단 크기·전체 선호 인원·한 집단의 선호 인원이 주어진 서술형 자료에서 이원표의 빠진 칸을 채워 다른 집단의 조건부 확률을 구함",
    extraThinking: "서술된 주변합·일부 칸으로 이원표를 복원한 뒤 조건(다른 집단)의 행만 골라 조건부 확률 — medium 은 완성된 표에서 읽기",
    concepts: ["이원표 복원", "조건부 확률", "여집단 계산"], mediumSteps: 2,
    generate(rng) {
      const N = rng.int(10, 40) * 10, T1 = rng.int(3, N / 10 - 3) * 10, X1 = rng.int(20, N - 20), J = rng.int(5, Math.min(T1 - 5, X1 - 5));
      const K = X1 - J, T2 = N - T1; if (K <= 0 || K >= T2 || J >= T1) throw new GenFail("x");
      const [g1, g2, pref, other] = rng.pick([["adults", "children", "tea", "coffee"], ["members", "non-members", "the new schedule", "the old schedule"], ["seniors", "juniors", "online classes", "in-person classes"], ["residents", "visitors", "the morning tour", "the evening tour"], ["teachers", "students", "the longer break", "the shorter break"], ["drivers", "passengers", "the express route", "the local route"]] as const);
      const stimulus = facts(rng, [[`A survey of ${N} people asked each person to choose ${pref} or ${other}.`, `${N} people were surveyed and each chose either ${pref} or ${other}.`, `Each of the ${N} people in a survey picked ${pref} or ${other}.`], [`Of the people surveyed, ${T1} are ${g1}.`, `Among those surveyed, ${T1} are ${g1} and the rest are ${g2}.`, `${T1} of the respondents are ${g1}; everyone else is among the ${g2}.`], [`In all, ${X1} people chose ${pref}, including ${J} of the ${g1}.`, `A total of ${X1} people picked ${pref}; ${J} of them are ${g1}.`, `${X1} respondents overall chose ${pref}, and ${J} of those are ${g1}.`]]);
      return finish(rng, {
        stimulus, question: spin(rng, `[[A person is chosen at random from the ${g2} surveyed. What is the probability that this person chose ${pref}?|Given that the person chosen is among the ${g2}, what is the probability of having chosen ${pref}?|If one of the ${g2} surveyed is selected at random, what is the probability that the person chose ${pref}?]]`),
        range: [0, 1], correctText: frac(K, T2),
        wrongTexts: [W(J, T1, "other", `${g1} 중 ${pref} 을(를) 고른 비율을 구했다.`), W(K, N, "formula_misuse", `조건(${g2})으로 제한하지 않고 전체로 나눴다.`), W(X1, N, "formula_misuse", `조건 없이 전체에서 ${pref} 의 확률을 구했다.`), W(K, X1, "formula_misuse", `분모를 ${pref} 을(를) 고른 사람으로 잡았다(조건 방향 오류).`), W(T2 - K, T2, "opposite", `${other} 을(를) 고른 비율을 구했다.`)],
        verificationJs: withParams({ N, T1, X1, J }, "const out=[];\nfor(let K=0;K<=P.N-P.T1;K++){ if(K+P.J===P.X1) out.push(K/(P.N-P.T1)); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`${g2} 의 수는 ${N} - ${T1} = ${T2} 이다.`, "Find the size of the conditioning group."],
          [`전체 ${pref} 인원 ${X1} 에서 ${g1} 인원 ${J} 를 빼면 ${g2} 중 ${pref} 인원은 ${K} 이다.`, "Fill in the missing cell."],
          ["조건부 확률은 (조건 집단 안에서 사건이 일어난 수) ÷ (조건 집단의 크기) 이다.", "Conditional probability divides by the conditioning group."],
          [`${K}/${T2} 이다.`, "Form the ratio."],
          [`기약분수는 ${frac(K, T2)} 이다.`, "Reduce."],
        ],
        variant: "rebuild_two_way_table",
      });
    },
  },
  {
    id: "probability.conditional.chain2", skill: SKILL, kind: "conditional", operator: "chain2",
    structure: "기계 A·B 의 생산 비율과 각 불량률로 1000개 기준 불량 개수를 구한 뒤 '불량품이 A 에서 나왔을 확률'(역조건)을 계산",
    extraThinking: "정방향 확률(기계→불량)을 역방향(불량→기계)으로 뒤집는 2단계 조건부 확률 — medium 은 한 방향의 조건부 확률",
    concepts: ["조건부 확률(역방향)", "가중 평균 개수", "비율 계산"], mediumSteps: 2,
    generate(rng) {
      const pa = rng.pick([20, 30, 40, 50, 60, 70]), da = rng.int(1, 8), db = rng.int(1, 8); if (da === db) throw new GenFail("x");
      const cntA = (pa * da) / 10, cntB = ((100 - pa) * db) / 10; if (!Number.isInteger(cntA) || !Number.isInteger(cntB)) throw new GenFail("x");
      const [item, Am, Bm] = rng.pick([["bolts", "Machine A", "Machine B"], ["circuit boards", "Line 1", "Line 2"], ["bottles", "Plant A", "Plant B"], ["microchips", "Factory A", "Factory B"], ["batteries", "Shift 1", "Shift 2"]] as const);
      const stimulus = facts(rng, [[`${Am} produces ${pa}% of the ${item} at a plant, and ${Bm} produces the rest.`, `At a plant, ${Am} makes ${pa}% of all ${item} and ${Bm} makes the remaining ${100 - pa}%.`, `${pa}% of the plant's ${item} come from ${Am}; the other ${100 - pa}% come from ${Bm}.`], [`${da}% of the ${item} from ${Am} are defective, and ${db}% of the ${item} from ${Bm} are defective.`, `The defect rate is ${da}% for ${Am} and ${db}% for ${Bm}.`, `Defective ${item} make up ${da}% of ${Am}'s output and ${db}% of ${Bm}'s output.`]]);
      return finish(rng, {
        stimulus, question: spin(rng, `[[A defective item is chosen at random from all defective ${item}. What is the probability that it was produced by ${Am}?|Given that a randomly selected item is defective, what is the probability that it came from ${Am}?|One of the defective ${item} is picked at random. What is the probability it is from ${Am}?]]`),
        range: [0, 1], correctText: frac(cntA, cntA + cntB),
        wrongTexts: [W(pa, 100, "formula_misuse", `${Am} 의 생산 비율(사전 확률)을 그대로 답했다.`), W(da, da + db, "formula_misuse", "두 불량률만 비교하고 생산 비율을 무시했다."), W(cntA, 1000, "formula_misuse", `${Am} 의 불량품 개수를 전체 1000개로 나눴다(불량품 전체로 나눠야 함).`), W(cntB, cntA + cntB, "other", `${Bm} 에서 나왔을 확률을 구했다.`), W(da, 100, "formula_misuse", `${Am} 의 불량률을 그대로 답했다.`)],
        verificationJs: withParams({ pa, da, db }, "let defA=0, defB=0;\nfor(let i=0;i<1000;i++){ if(i<10*P.pa){ if((i%100)<P.da) defA++; } else { if(((i-10*P.pa)%100)<P.db) defB++; } }\nreturn defA/(defA+defB);"),
        trace: [
          ["전체 생산량을 1000 개로 가정하면 계산이 쉽다.", "Assume 1000 items."],
          [`${Am}: ${10 * pa} 개, 그중 불량 ${cntA} 개.`, "Defective items from the first source."],
          [`${Bm}: ${10 * (100 - pa)} 개, 그중 불량 ${cntB} 개.`, "Defective items from the second source."],
          [`불량품은 모두 ${cntA} + ${cntB} = ${cntA + cntB} 개이다.`, "Total defective items."],
          [`조건(불량품)이 주어졌을 때 ${Am} 의 확률 = ${cntA}/${cntA + cntB} 이다.`, "Reverse the conditioning."],
          [`기약분수는 ${frac(cntA, cntA + cntB)} 이다.`, "Reduce."],
        ],
        variant: "reverse_conditional_defects",
      });
    },
  },
  {
    id: "probability.conditional.inverse", skill: SKILL, kind: "conditional", operator: "inverse",
    structure: "P(A∩B)와 P(A|B)가 주어졌을 때 조건부확률 정의를 뒤집어 P(B)를 구한 뒤 여사건 1−P(B)를 계산",
    extraThinking: "조건부확률 정의 P(A|B)=P(A∩B)/P(B)를 역방향으로 써서 P(B)를 구하고 여사건까지 잇는 2단계 — medium 은 정의를 그대로 적용",
    concepts: ["조건부확률 정의 역산", "분수 나눗셈", "여사건"], mediumSteps: 2,
    generate(rng) {
      const d1 = rng.pick([5, 8, 10, 12, 15, 20]), n1 = rng.int(Math.ceil(0.3 * d1), Math.floor(0.9 * d1)), d2 = rng.pick([3, 4, 5, 6, 8, 9, 10]), n2 = rng.int(1, d2 - 1);
      if (gcd(n1, d1) !== 1 || gcd(n2, d2) !== 1 || n1 === d1) throw new GenFail("x");
      const xn = n1 * n2, xd = d1 * d2; const g = gcd(xn, xd); const x1 = xn / g, x2 = xd / g; if (x2 > 120 || x2 === 1) throw new GenFail("x");
      const [A, B, who] = rng.pick([["takes Spanish", "plays an instrument", "student"], ["owns a pet", "lives in an apartment", "resident"], ["reads the newsletter", "is a subscriber", "customer"], ["walks to work", "lives downtown", "employee"], ["has a library card", "visited last month", "visitor"]] as const);
      const stimulus = facts(rng, [[`For a randomly chosen ${who}, the probability that the ${who} both ${A} and ${B} is ${frac(x1, x2)}.`, `A ${who} is selected at random. The probability that the ${who} ${A} and also ${B} is ${frac(x1, x2)}.`, `Choose a ${who} at random: P(the ${who} ${A} and ${B}) = ${frac(x1, x2)}.`, `Picking a ${who} uniformly at random, the probability that the ${who} ${A} and ${B} equals ${frac(x1, x2)}.`], [`Given that the ${who} ${B}, the probability that the ${who} ${A} is ${frac(n2, d2)}.`, `When the ${who} ${B}, the probability that the ${who} ${A} is ${frac(n2, d2)}.`, `If it is known that the ${who} ${B}, then the probability that the ${who} ${A} is ${frac(n2, d2)}.`, `Restricting attention to a ${who} who ${B}, the chance that the ${who} ${A} is ${frac(n2, d2)}.`]]);
      return finish(rng, {
        stimulus, question: spin(rng, `[[What is the probability that a randomly chosen ${who} does not meet the second condition (${B})?|What is the probability that a randomly chosen ${who} fails to satisfy "${B}"?|Find the probability that the ${who} chosen does not satisfy "${B}".]]`),
        range: [0, 1], correctText: frac(d1 - n1, d1),
        wrongTexts: [W(n1, d1, "opposite", "P(B) 를 답했다(여사건을 취하지 않음)."), W(n2, d2, "other", "주어진 조건부확률을 그대로 답했다."), W(x1 * n2, x2 * d2, "formula_misuse", "곱셈으로 잘못 계산했다(조건부확률 정의 방향 오류)."), W(x2 - x1, x2, "formula_misuse", "교집합의 여사건을 구했다."), W(d2 - n2, d2, "other", "조건부확률의 여사건을 구했다.")],
        verificationJs: withParams({ x1, x2, n2, d2 }, "const vals=new Set();\nfor(let d=1;d<=60;d++) for(let n=0;n<=d;n++){ if(n*P.n2*P.x2 === P.x1*d*P.d2) vals.add(Math.round((1-n/d)*1e9)/1e9); }\nif(vals.size!==1) throw new Error('유일하지 않음');\nreturn [...vals][0];"),
        trace: [
          ["조건부확률의 정의는 P(A|B) = P(A∩B) / P(B) 이다.", "Recall the definition."],
          ["이를 P(B) 에 대해 정리하면 P(B) = P(A∩B) ÷ P(A|B) 이다.", "Solve for P(B)."],
          [`P(B) = ${frac(x1, x2)} ÷ ${frac(n2, d2)} 이다.`, "Substitute."],
          [`분수의 나눗셈은 역수를 곱하므로 P(B) = ${frac(n1, d1)} 이다.`, "Divide fractions."],
          [`구하는 것은 여사건이므로 1 - ${frac(n1, d1)} = ${frac(d1 - n1, d1)} 이다.`, "Take the complement."],
        ],
        variant: "reverse_definition_complement",
      });
    },
  },
  {
    id: "probability.conditional.compose_kind", skill: SKILL, kind: "conditional", operator: "compose_kind",
    structure: "두 주사위 표본공간에서 조건(합이 t 이상)을 만족하는 경우를 먼저 추려 그 안에서 사건의 개수를 세 조건부확률을 구함",
    extraThinking: "표본공간을 조건으로 축소한 뒤 그 안에서 사건을 세는 2단계(조건 축소→사건 계수) — medium 은 축소 없이 전체에서 한 번 계산",
    concepts: ["표본공간 축소", "조건부확률", "경우의 수 세기"], mediumSteps: 2,
    generate(rng) {
      const s1 = rng.pick([6, 6, 8, 10]), s2 = rng.pick([6, 8, 10]); if (s1 === s2) throw new GenFail("x"); const t = rng.int(Math.max(s1, s2) - 1, s1 + s2 - 2);
      const evs = [{ id: "same", text: "the two numbers are equal", fn: (a: number, b: number) => a === b }, { id: "anyeven", text: "at least one of the two numbers is even", fn: (a: number, b: number) => a % 2 === 0 || b % 2 === 0 }, { id: "firstbig", text: "the first number is larger than the second number", fn: (a: number, b: number) => a > b }];
      const e = rng.pick(evs); let cond = 0, both = 0, evt = 0; const tot = s1 * s2;
      for (let a = 1; a <= s1; a++) for (let b = 1; b <= s2; b++) { const c = a + b >= t; if (c) cond++; if (e.fn(a, b)) evt++; if (c && e.fn(a, b)) both++; }
      if (both === 0 || both === cond || cond === 0 || frac(both, cond) === frac(evt, tot)) throw new GenFail("x");
      const sp = rng.chance(0.4);
      const stimulus = sp
        ? facts(rng, [[`Two fair spinners are spun, one with ${s1} equal sectors numbered 1 through ${s1} and the other with ${s2} equal sectors numbered 1 through ${s2}, and the sum of the two numbers is recorded.`, `A player spins a wheel numbered 1 to ${s1} and a wheel numbered 1 to ${s2}, each number equally likely, and adds the two results.`, `Two wheels, with ${s1} and ${s2} equally likely numbers starting at 1, are spun together and their sum is noted.`], [`It is known that the sum is at least ${t}.`, `The sum turns out to be ${t} or more.`, `You are told only that the total is not less than ${t}.`, `The two results add up to ${t} or greater.`]])
        : facts(rng, [[`A fair ${s1}-sided die and a fair ${s2}-sided die, each numbered from 1 up, are rolled once, and the sum of the two numbers is recorded.`, `Two fair dice, with ${s1} and ${s2} faces numbered from 1, are rolled together and their sum is noted.`, `One ${s1}-sided die and one ${s2}-sided die, both fair and labeled from 1, are rolled, and the two results are added.`, `A ${s1}-sided die and a ${s2}-sided die, labeled from 1 and perfectly fair, are tossed and the total is written down.`], [`It is known that the sum is at least ${t}.`, `The sum turns out to be ${t} or more.`, `You are told only that the total is not less than ${t}.`, `The two results add up to ${t} or greater.`]]);
      return finish(rng, {
        stimulus, question: spin(rng, `[[Given this information, what is the probability that ${e.text}?|What is the probability that ${e.text}, given that the sum is at least ${t}?|Under the condition that the sum is at least ${t}, what is the probability that ${e.text}?|What is the conditional probability that ${e.text}?|Knowing the sum is at least ${t}, find the probability that ${e.text}.]]`),
        range: [0, 1], correctText: frac(both, cond),
        wrongTexts: [W(evt, tot, "formula_misuse", "조건을 무시하고 전체 표본공간에서 확률을 구했다."), W(cond, tot, "formula_misuse", "조건 자체의 확률을 답했다."), W(both, tot, "formula_misuse", "교집합 개수를 전체 표본공간으로 나눴다(조건 크기로 나눠야 함)."), W(both, evt, "formula_misuse", "조건부확률의 방향을 뒤집어 사건의 크기로 나눴다."), W(cond - both, cond, "opposite", "여사건을 구했다.")],
        verificationJs: withParams({ s1, s2, t, id: e.id }, "let c=0,b=0;\nfor(let a=1;a<=P.s1;a++) for(let d=1;d<=P.s2;d++){ if(a+d>=P.t){ c++; const e = P.id==='same'? a===d : P.id==='anyeven' ? (a%2===0||d%2===0) : a>d; if(e) b++; } }\nreturn b/c;"),
        trace: [
          [`합이 ${t} 이상인 경우만 골라 새 표본공간으로 삼는다.`, "Restrict to outcomes that meet the condition."],
          [`그런 경우는 모두 ${cond} 가지이다.`, "Count the restricted sample space."],
          [`그중 "${e.text}" 인 경우를 센다.`, "Find the favorable outcomes inside it."],
          [`해당하는 경우는 ${both} 가지이다.`, "Count them."],
          [`조건부확률 = ${both}/${cond} 이다.`, "Divide by the restricted size."],
          [`기약분수는 ${frac(both, cond)} 이다.`, "Reduce."],
        ],
        variant: `dice_given_sum_${e.id}`,
      });
    },
  },
  {
    id: "probability.sequential_without_replacement.compare_scenarios", skill: SKILL, kind: "sequential_without_replacement", operator: "compare_scenarios",
    structure: "같은 주머니에서 복원·비복원으로 두 번 뽑아 모두 빨간 공일 확률을 각각 구해 그 차이를 계산",
    extraThinking: "복원/비복원 두 시행 모델을 비교하고 분수 뺄셈으로 차이를 구함 — medium 은 한 시행의 연속 확률",
    concepts: ["복원·비복원 추출", "독립/종속 사건", "분수 뺄셈"], mediumSteps: 2,
    generate(rng) {
      const r = rng.int(2, 7), b = rng.int(2, 7); const n = r + b;
      const w = [r * r, n * n], wo = [r * (r - 1), n * (n - 1)]; const dn = w[0] * wo[1] - wo[0] * w[1], dd = w[1] * wo[1];
      if (dn <= 0) throw new GenFail("x");
      const [red, blue, obj, single] = rng.pick([["red", "blue", "marbles", "marble"], ["red", "green", "beads", "bead"], ["black", "white", "socks", "sock"], ["red", "yellow", "cards", "card"]] as const);
      const stimulus = facts(rng, [[`A bag contains ${r} ${red} ${obj} and ${b} ${blue} ${obj}.`, `In a bag there are ${r} ${red} and ${b} ${blue} ${obj}.`, `${r} ${red} ${obj} and ${b} ${blue} ${obj} are in a bag.`, `A bag is filled with ${r} ${red} ${obj} and ${b} ${blue} ${obj}.`], [`Two ${obj} are drawn one at a time. In the first scenario, the first ${single} is put back before the second is drawn; in the second scenario, it is not put back.`, `Scenario 1 draws two ${obj} with replacement, and scenario 2 draws two ${obj} without replacement.`, `A person draws two ${obj}, one after the other, once with replacement and once without replacement.`, `Two ${obj} are drawn in a row twice over: the first time each ${single} is returned before the next draw, the second time it is kept out.`]]);
      return finish(rng, {
        stimulus, question: spin(rng, `[[How much greater is the probability that both ${obj} are ${red} with replacement than without replacement?|By how much does the probability of drawing two ${red} ${obj} with replacement exceed the probability without replacement?|What is the difference between the two probabilities of drawing two ${red} ${obj}, with replacement minus without replacement?]]`),
        range: [0, 1], correctText: frac(dn, dd),
        wrongTexts: [W(w[0], w[1], "partial", "복원 추출 확률만 답했다."), W(wo[0], wo[1], "partial", "비복원 추출 확률만 답했다."), W(w[0] * wo[1] + wo[0] * w[1], dd, "sign_error", "차가 아니라 합을 구했다."), W(r * r - r * (r - 1), n * n, "formula_misuse", "분자만 빼고 분모를 통분하지 않았다."), W(r, n * (n - 1), "step_missing", "비교 없이 간단한 분수를 답했다.")],
        verificationJs: withParams({ r, b }, "const colors=[]; for(let i=0;i<P.r;i++) colors.push(1); for(let i=0;i<P.b;i++) colors.push(0);\nlet w=0,tw=0,wo=0,two=0;\nfor(let i=0;i<colors.length;i++) for(let j=0;j<colors.length;j++){ tw++; if(colors[i]&&colors[j]) w++; if(i!==j){ two++; if(colors[i]&&colors[j]) wo++; } }\nreturn w/tw - wo/two;"),
        trace: [
          [`전체 ${n} 개 중 ${red} ${r} 개이다.`, "Set up the bag."],
          [`복원 추출: 두 번 모두 ${red} 일 확률 = (${r}/${n})² = ${frac(r * r, n * n)} 이다.`, "With replacement."],
          [`비복원 추출: ${r}/${n} × ${r - 1}/${n - 1} = ${frac(r * (r - 1), n * (n - 1))} 이다.`, "Without replacement."],
          ["두 분수를 통분해 복원 확률에서 비복원 확률을 뺀다.", "Subtract over a common denominator."],
          [`차는 ${frac(dn, dd)} 이다.`, "State the difference."],
        ],
        variant: "with_vs_without_replacement",
      });
    },
  },
  {
    id: "probability.sequential_without_replacement.inverse", skill: SKILL, kind: "sequential_without_replacement", operator: "inverse",
    structure: "빨간 공 r개와 미지수 b개의 파란 공이 든 주머니에서 비복원으로 두 개를 뽑아 모두 빨간 공일 확률이 p/q 일 때 b 를 구함",
    extraThinking: "연속 비복원 확률 식 r(r−1)/(n(n−1)) 을 세워 미지수 n=r+b 를 역산(이차 관계를 대입·탐색으로 해결) — medium 은 주어진 구성에서 확률 계산",
    concepts: ["비복원 연속 확률", "미지수 역산(분수·이차 관계)", "표본공간 크기 관계"], mediumSteps: 2,
    generate(rng) {
      const r = rng.int(3, 9), b = rng.int(2, 12); const n = r + b; const pn = r * (r - 1), pd = n * (n - 1); const g = gcd(pn, pd); const p = pn / g, q = pd / g;
      if (q > 400 || p === 1 && false) throw new GenFail("x");
      const [red, blue, obj, single] = rng.pick([["red", "blue", "marbles", "marble"], ["red", "green", "tiles", "tile"], ["black", "white", "chess pieces", "piece"], ["yellow", "purple", "candies", "candy"], ["red", "blue", "cards", "card"]] as const);
      const stimulus = facts(rng, [[`A bag contains ${r} ${red} ${obj} and some ${blue} ${obj}.`, `In a bag there are ${r} ${red} ${obj} plus an unknown number of ${blue} ${obj}.`, `${r} ${red} ${obj} are in a bag together with some ${blue} ${obj}.`], [`Two ${obj} are drawn at random, one after the other, without replacement.`, `Without putting anything back, two ${obj} are picked one at a time at random.`, `Two ${obj} are taken from the bag in succession and not returned.`], [`The probability that both ${obj} are ${red} is ${frac(p, q)}.`, `The chance that the two ${obj} are both ${red} is ${frac(p, q)}.`, `Both ${obj} are ${red} with probability ${frac(p, q)}.`]], [1]);
      return finish(rng, {
        stimulus, question: spin(rng, `[[How many ${blue} ${obj} are in the bag?|What is the number of ${blue} ${obj} in the bag?|Find the number of ${blue} ${obj} in the bag.]]`),
        correct: b,
        wrongs: [{ v: n, kind: "other", reason: "전체 개수 n 을 답했다." }, { v: b + 1, kind: "other", reason: "계산 실수(한 개 많음)." }, { v: b - 1, kind: "other", reason: "계산 실수(한 개 적음)." }, { v: r, kind: "other", reason: "빨간 공의 개수를 답했다." }, { v: n - 1, kind: "step_missing", reason: "두 번째 추출의 전체 개수 n−1 을 답했다." }],
        verificationJs: withParams({ r, p, q }, "const out=[];\nfor(let b=0;b<=400;b++){ const n=P.r+P.b_unused; }\nreturn 0;".replace("const n=P.r+P.b_unused; ", "const n=P.r+b; if(P.r*(P.r-1)*P.q === P.p*n*(n-1)) out.push(b); ").replace("return 0;", "if(out.length!==1) throw new Error('유일하지 않음'); return out[0];")),
        trace: [
          [`${blue} ${obj}를 b 개라 하고 전체를 n = ${r} + b 라 한다.`, "Let the unknown count be b."],
          [`첫 번째가 ${red} 일 확률 ${r}/n, 그 뒤 두 번째가 ${red} 일 확률 ${r - 1}/(n − 1) 이다.`, "Write the two conditional probabilities."],
          [`두 공이 모두 ${red} 일 확률 = ${r}·${r - 1} / (n(n − 1)) = ${frac(p, q)} 이다.`, "Set up the equation."],
          [`정리하면 n(n − 1) = ${(r * (r - 1) * q) / p} 이다.`, "Isolate n(n-1)."],
          [`연속한 두 정수의 곱이 ${(r * (r - 1) * q) / p} 이므로 n = ${n} 이다.`, "Solve for n."],
          [`${blue} ${obj}는 ${n} − ${r} = ${b} 개이다.`, "Subtract the red count."],
        ],
        variant: "unknown_count_from_probability",
      });
    },
  },
  {
    id: "probability.sequential_without_replacement.constraint_select", skill: SKILL, kind: "sequential_without_replacement", operator: "constraint_select",
    structure: "세 색 공에서 비복원으로 세 개를 뽑을 때 '색이 모두 다름' 또는 '빨간 공이 하나 이상'의 확률(순서 경우의 수·여사건)",
    extraThinking: "순서 있는 표본공간에서 색 배치(3!)를 고려한 경우의 수 또는 여사건 전환 — medium 은 두 번 뽑기의 곱",
    concepts: ["순서 있는 비복원 추출", "경우의 수(3!)·여사건", "분수 약분"], mediumSteps: 2,
    generate(rng) {
      const r = rng.int(2, 5), b = rng.int(2, 5), w = rng.int(2, 5); const n = r + b + w; const oneEach = rng.chance(0.5);
      let fav = 0, tot = 0; const col = [...Array(r).fill(0), ...Array(b).fill(1), ...Array(w).fill(2)];
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) { if (i === j || j === k || i === k) continue; tot++; const hit = oneEach ? new Set([col[i], col[j], col[k]]).size === 3 : (col[i] === 0 || col[j] === 0 || col[k] === 0); if (hit) fav++; }
      if (fav === 0 || fav === tot) throw new GenFail("x");
      const [c1, c2, c3, obj] = rng.pick([["red", "blue", "white", "marbles"], ["red", "green", "yellow", "beads"], ["black", "gray", "white", "tiles"], ["red", "blue", "green", "cards"]] as const);
      const stimulus = facts(rng, [[`A bag contains ${r} ${c1} ${obj}, ${b} ${c2} ${obj}, and ${w} ${c3} ${obj}.`, `In a bag there are ${r} ${c1}, ${b} ${c2}, and ${w} ${c3} ${obj}.`, `${r} ${c1} ${obj}, ${b} ${c2} ${obj}, and ${w} ${c3} ${obj} are in a bag.`], [`Three ${obj} are drawn one at a time at random, without replacement.`, `Without replacement, three ${obj} are taken from the bag one after another.`, `A person draws three ${obj} in a row and does not put any back.`]], []);
      const pf = frac(fav, tot);
      const pe = oneEach ? `one ${obj.replace(/s$/, "")} of each color is drawn` : `at least one of the ${obj} drawn is ${c1}`;
      return finish(rng, {
        stimulus, question: spin(rng, `[[What is the probability that ${pe}?|Find the probability that ${pe}.|What is the chance that ${pe}?]]`),
        range: [0, 1], correctText: pf,
        wrongTexts: oneEach
          ? [W(r * b * w, n * (n - 1) * (n - 2), "step_missing", "색의 순서(3! = 6가지)를 곱하지 않았다."), W(6 * r * b * w, n * n * n, "formula_misuse", "복원 추출로 분모를 계산했다."), W(3 * r * b * w, n * (n - 1) * (n - 2), "step_missing", "색 배치 수를 3가지로만 셌다."), W(tot - fav, tot, "opposite", "여사건을 구했다."), W(fav, n * n * n, "formula_misuse", "비복원인데 분모를 n³ 으로 잡았다.")]
          : [W(tot - fav, tot, "opposite", "여사건(빨간 공이 하나도 없을 확률)을 답했다."), W(fav, n * n * n, "formula_misuse", "비복원인데 분모를 n³ 으로 잡았다."), W(3 * r, n, "formula_misuse", "세 번의 확률을 단순히 더했다."), W(fav - tot / 10 > 0 ? fav - 1 : fav + 1, tot, "step_missing", "경우의 수를 잘못 셌다."), W((n - r) * (n - r - 1) * (n - r - 2), n * (n - 1) * (n - 2), "formula_misuse", "빨간 공이 하나도 없을 확률만 구하고 1에서 빼지 않았다.")],
        verificationJs: withParams({ r, b, w, oneEach: oneEach ? 1 : 0 }, "const col=[]; for(let i=0;i<P.r;i++) col.push(0); for(let i=0;i<P.b;i++) col.push(1); for(let i=0;i<P.w;i++) col.push(2);\nconst n=col.length; let f=0,t=0;\nfor(let i=0;i<n;i++) for(let j=0;j<n;j++) for(let k=0;k<n;k++){ if(i===j||j===k||i===k) continue; t++; const hit = P.oneEach ? (new Set([col[i],col[j],col[k]]).size===3) : (col[i]===0||col[j]===0||col[k]===0); if(hit) f++; }\nreturn f/t;"),
        trace: oneEach ? [
          [`전체 ${n} 개에서 순서를 고려해 3개를 뽑는 경우는 ${n}×${n - 1}×${n - 2} = ${tot} 가지이다.`, "Count ordered draws."],
          [`세 색이 모두 다르려면 각 색에서 하나씩 뽑고, 그 순서는 3! = 6 가지이다.`, "Account for the 3! orderings of the colors."],
          [`유리한 경우의 수 = 6 × ${r} × ${b} × ${w} = ${fav} 이다.`, "Count favorable draws."],
          [`확률 = ${fav}/${tot} 이다.`, "Form the probability."],
          [`기약분수는 ${pf} 이다.`, "Reduce."],
        ] : [
          [`"빨간 공이 하나 이상"의 여사건은 "빨간 공이 하나도 없음"이다.`, "Use the complement."],
          [`빨간 공이 아닌 공은 ${n - r} 개이므로 세 번 모두 그중에서 뽑을 확률은 ${n - r}/${n} × ${n - r - 1}/${n - 1} × ${n - r - 2}/${n - 2} 이다.`, "Probability of no red."],
          [`이 값은 ${frac((n - r) * (n - r - 1) * (n - r - 2), n * (n - 1) * (n - 2))} 이다.`, "Evaluate."],
          [`1 에서 빼면 ${pf} 이다.`, "Subtract from 1."],
          ["분모·분자를 약분해 기약분수로 만든다.", "Reduce."],
        ],
        variant: oneEach ? "one_of_each_color" : "at_least_one_red",
      });
    },
  },
  {
    id: "probability.sequential_without_replacement.chain2", skill: SKILL, kind: "sequential_without_replacement", operator: "chain2",
    structure: "주머니 A 에서 공 하나를 B 로 옮긴 뒤 B 에서 뽑을 때 빨간 공일 확률: 옮긴 공의 색에 따른 두 경우의 가중합",
    extraThinking: "앞 단계(이동한 공의 색)가 뒤 단계 확률을 바꾸는 경우 분할과 가중합(전확률) — medium 은 한 주머니의 연속 추출",
    concepts: ["경우 분할·가중합(전확률)", "조건부확률", "분수 덧셈"], mediumSteps: 2,
    generate(rng) {
      const ar = rng.int(2, 6), ab = rng.int(2, 6), br = rng.int(1, 6), bb = rng.int(2, 6); const nA = ar + ab, nB = br + bb;
      let red = 0, tot = 0; const A = [...Array(ar).fill(1), ...Array(ab).fill(0)], B = [...Array(br).fill(1), ...Array(bb).fill(0)];
      for (let i = 0; i < nA; i++) { const B2 = [...B, A[i]]; for (let j = 0; j < B2.length; j++) { tot++; if (B2[j] === 1) red++; } }
      if (red === 0 || red === tot) throw new GenFail("x");
      const [cr, cb, obj, single, bagA, bagB] = rng.pick([["red", "blue", "marbles", "marble", "Bag A", "Bag B"], ["red", "green", "beads", "bead", "Box 1", "Box 2"], ["red", "white", "balls", "ball", "Urn X", "Urn Y"], ["red", "black", "tokens", "token", "Jar A", "Jar B"]] as const);
      const stimulus = facts(rng, [[`${bagA} contains ${ar} ${cr} ${obj} and ${ab} ${cb} ${obj}. ${bagB} contains ${br} ${cr} ${obj} and ${bb} ${cb} ${obj}.`, `There are ${ar} ${cr} and ${ab} ${cb} ${obj} in ${bagA}, and ${br} ${cr} and ${bb} ${cb} ${obj} in ${bagB}.`, `${bagA} holds ${ar} ${cr} ${obj} and ${ab} ${cb} ${obj}; ${bagB} holds ${br} ${cr} and ${bb} ${cb}.`, `The contents are ${ar} ${cr} and ${ab} ${cb} ${obj} for ${bagA}, versus ${br} ${cr} and ${bb} ${cb} ${obj} for ${bagB}.`], [`One ${single} is chosen at random from ${bagA} and placed in ${bagB}. Then one ${single} is chosen at random from ${bagB}.`, `A ${single} picked at random from ${bagA} is moved into ${bagB}, and afterwards a ${single} is drawn at random from ${bagB}.`, `First a random ${single} goes from ${bagA} to ${bagB}; next a ${single} is selected at random from ${bagB}.`, `Without looking, someone moves one ${single} from ${bagA} into ${bagB}, shakes ${bagB}, and draws one ${single} from it.`]]);
      const pr = frac(red, tot);
      return finish(rng, {
        stimulus, question: spin(rng, `[[What is the probability that the ${single} chosen from ${bagB} is ${cr}?|Find the probability that the final ${single} is ${cr}.|What is the chance that the ${single} drawn from ${bagB} at the end is ${cr}?]]`),
        range: [0, 1], correctText: pr,
        wrongTexts: [W(br, nB, "step_missing", "옮긴 공을 무시하고 원래 B 의 구성으로만 계산했다."), W(ar * (br + 1), nA * (nB + 1), "step_missing", "빨간 공을 옮긴 경우만 계산하고 파란 공을 옮긴 경우를 더하지 않았다."), W(ar * (br + 1) + ab * br, nA * (nB + 1) * 2, "formula_misuse", "두 경우의 확률을 더한 뒤 2로 나눠 평균을 냈다(가중합이어야 함)."), W(ar, nA, "other", "A 에서 빨간 공을 뽑을 확률만 답했다."), W(ar + br, nA + nB, "formula_misuse", "두 주머니를 합쳐서 계산했다.")],
        verificationJs: withParams({ ar, ab, br, bb }, "const A=[...Array(P.ar).fill(1),...Array(P.ab).fill(0)], B=[...Array(P.br).fill(1),...Array(P.bb).fill(0)];\nlet red=0,tot=0;\nfor(let i=0;i<A.length;i++){ const B2=[...B,A[i]]; for(let j=0;j<B2.length;j++){ tot++; if(B2[j]===1) red++; } }\nreturn red/tot;"),
        trace: [
          [`${bagA} 에서 ${cr} 를 옮길 확률은 ${ar}/${nA}, ${cb} 를 옮길 확률은 ${ab}/${nA} 이다.`, "Split by the color moved."],
          [`${cr} 를 옮기면 ${bagB} 는 ${cr} ${br + 1} 개, 전체 ${nB + 1} 개가 되어 ${cr} 를 뽑을 확률은 ${br + 1}/${nB + 1} 이다.`, "Case 1."],
          [`${cb} 를 옮기면 ${cr} 는 ${br} 개, 전체 ${nB + 1} 개이므로 확률은 ${br}/${nB + 1} 이다.`, "Case 2."],
          [`각 경우의 확률에 옮길 확률을 곱해 더한다: ${ar}/${nA} × ${br + 1}/${nB + 1} + ${ab}/${nA} × ${br}/${nB + 1}.`, "Weight and add."],
          [`계산하면 ${(ar * (br + 1) + ab * br)}/${nA * (nB + 1)} 이다.`, "Evaluate."],
          [`기약분수는 ${pr} 이다.`, "Reduce."],
        ],
        variant: "transfer_then_draw",
      });
    },
  },
];
