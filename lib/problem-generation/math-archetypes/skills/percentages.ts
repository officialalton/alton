// percentages hard 원형 20개(세부 패턴 5 × 연산자 4). 금액은 '$' 가 수식 기호와 겹치므로 dollars 로 쓴다.
import { GenFail, type Archetype } from "../types";
import { facts, finish, spin, withParams } from "../text";
import { sem, withOpen, aPct, OPEN_MONEY, OPEN_GROUP, OPEN_SCI, OPEN_GEO, OPEN_GEN, UP, DOWN } from "../c-kit";
import { gcd, type Rng } from "../rng";
import type { LiteArchetype, Level } from "../c-lite";
import type { DistractorKind } from "../../review";

const SKILL = "percentages";
const W = (v: number, kind: DistractorKind, reason: string) => ({ v, kind, reason });
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
const PCTS = [10, 20, 25, 30, 40, 50, 60, 75, 80];

export const PCT_ARCHETYPES: Archetype[] = [
  // ───────────── percent_of ─────────────
  {
    id: "pct.percent_of.compose_kind", skill: SKILL, kind: "percent_of", operator: "compose_kind",
    structure: "p% 용액 N L 에 용매(물)만 더하거나 증발시켜 q% 로 만들 때, 용질량은 변하지 않는다는 점으로 일차방정식 Np = q(N±x) 를 세워 x 를 구함",
    extraThinking: "퍼센트 계산을 '변하지 않는 양(용질)' 보존 + 일차방정식과 합성 — medium 은 p% 의 값을 한 번 계산",
    concepts: ["퍼센트의 값", "보존량(용질) 파악", "일차방정식"], mediumSteps: 1,
    generate(rng) {
      const mode = rng.pick(["add", "evap"] as const);
      const N = rng.pick([20, 24, 30, 36, 40, 48, 50, 60, 72, 80, 90, 120, 150, 200]);
      const p = rng.int(4, 40), q = mode === "add" ? rng.int(2, p - 1) : rng.int(p + 1, 70);
      if ((N * p) % q !== 0) throw new GenFail("x");
      const x = mode === "add" ? (N * p) / q - N : N - (N * p) / q;
      if (x < 1 || x > 400) throw new GenFail("x");
      const c = rng.pick([
        { sol: "salt solution", sw: "salt", tank: "tank", unit: "liters" }, { sol: "sugar syrup", sw: "sugar", tank: "pot", unit: "liters" },
        { sol: "fruit drink", sw: "juice", tank: "jug", unit: "liters" }, { sol: "cleaning solution", sw: "bleach", tank: "bucket", unit: "liters" },
        { sol: "antifreeze mixture", sw: "antifreeze", tank: "reservoir", unit: "liters" }, { sol: "coffee concentrate", sw: "coffee", tank: "urn", unit: "liters" },
      ]);
      const stimulus = spin(rng, `[[A|One]] ${c.tank} [[holds|contains|is filled with]] ${N} ${c.unit} of ${aPct(p)} ${c.sw} [[solution|mixture]]. [[Only ${mode === "add" ? "pure water is added" : "water is removed by evaporation"}|The only change is that ${mode === "add" ? "pure water is poured in" : "some water evaporates"}]], and [[the ${c.sw} itself is not added or removed|no ${c.sw} is added or lost]].`);
      const q2 = spin(rng, mode === "add"
        ? `[[How many ${c.unit} of water must be added so that the ${c.tank} is ${q}% ${c.sw}?|After ${"adding water"}, the ${c.tank} should be ${q}% ${c.sw}. How many ${c.unit} of water are added?|What amount of water, in ${c.unit}, brings the ${c.sw} content down to ${q}%?]]`
        : `[[How many ${c.unit} of water must evaporate so that the ${c.tank} is ${q}% ${c.sw}?|Evaporation continues until the ${c.tank} is ${q}% ${c.sw}. How many ${c.unit} of water evaporate?|What amount of water, in ${c.unit}, must be lost to raise the ${c.sw} content to ${q}%?]]`);
      const total = (N * p) / q;
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_SCI, stimulus), question: q2, correct: x,
        wrongs: [W((N * Math.abs(p - q)) / 100, "formula_misuse", "농도 차이(p−q)%를 처음 양 N 에 곱했다(용질량 보존을 쓰지 않음)."), W(total, "step_missing", "구하려던 물의 양이 아니라 새 전체 용액의 양을 답했다."), W((N * p) / 100, "step_missing", "용질의 양만 구했다."),
          W(mode === "add" ? N - (N * p) / q : (N * p) / q - N, "sign_error", "더한 양과 증발한 양의 방향을 반대로 계산했다."), W(total + N, "formula_misuse", "새 전체 양에 처음 양을 더했다.")],
        verificationJs: withParams({ N, p, q, mode: mode === "add" ? 1 : 0 }, "const out=[];\nfor(let x=1;x<=2000;x++){ const t=P.mode?P.N+x:P.N-x; if(t>0 && P.N*P.p===P.q*t) out.push(x); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`용질(${c.sw})의 양은 ${N}의 ${p}% 이므로 ${(N * p) / 100} ${c.unit} 이다.`, "Compute the amount of the substance."],
          [`물만 ${mode === "add" ? "더하므로" : "증발시키므로"} 용질의 양은 변하지 않는다.`, "The substance amount is conserved."],
          [`물 x ${c.unit} 를 ${mode === "add" ? "더한" : "잃은"} 뒤 전체는 ${N} ${mode === "add" ? "+" : "−"} x 이다.`, "Express the new total."],
          [`${(N * p) / 100} = ${q}% × (${N} ${mode === "add" ? "+" : "−"} x) 로 식을 세운다.`, "Set up the equation."],
          [`새 전체는 ${total} 이므로 x = ${x} 이다.`, "Solve for x."],
        ],
        variant: mode === "add" ? "add_water" : "evaporate",
      });
      return sem(out, [{ v: p, words: [c.sw] }, { v: q, words: [c.sw] }], { words: ["water"], forbid: [] });
    },
  },
  {
    id: "pct.percent_of.chain2", skill: SKILL, kind: "percent_of", operator: "chain2",
    structure: "전체 N 의 p% → 그중 q% 는 제외(나머지 (100−q)%) → 그중 r% 로 세 단계에서 기준량이 매번 바뀌는 퍼센트의 퍼센트",
    extraThinking: "단계마다 기준량이 바뀌는 연쇄 퍼센트와 '나머지(보수)' 처리 — medium 은 한 기준량에 대한 p% 한 번",
    concepts: ["퍼센트의 값", "기준량 전환", "나머지(보수) 비율"], mediumSteps: 1,
    generate(rng) {
      const N = rng.pick([200, 240, 250, 300, 320, 400, 480, 500, 600, 640, 750, 800, 900]);
      const p = rng.pick(PCTS), q = rng.pick(PCTS), r = rng.pick(PCTS);
      const a = (N * p) / 100, b = (a * (100 - q)) / 100, d = (b * r) / 100;
      if (![a, b, d].every(Number.isInteger) || d < 2 || q === 50 && r === 50 && p === 50) throw new GenFail("x");
      const c = rng.pick([
        { pop: "students at a school", a: "are enrolled in a foreign-language course", b: "study Spanish", nb: "study a language other than Spanish", c: "are seniors", ask: "seniors who study a language other than Spanish" },
        { pop: "employees at a company", a: "work remotely at least one day a week", b: "work remotely full time", nb: "work remotely only part of the week", c: "are managers", ask: "managers who work remotely only part of the week" },
        { pop: "visitors to a museum", a: "buy a ticket for a special exhibit", b: "buy the premium ticket", nb: "buy the standard ticket", c: "are first-time visitors", ask: "first-time visitors who buy the standard exhibit ticket" },
        { pop: "households in a town", a: "own a pet", b: "own a dog", nb: "own a pet that is not a dog", c: "have a fenced yard", ask: "households with a fenced yard that own a pet other than a dog" },
        { pop: "runners in a race", a: "finish in under an hour", b: "finish in under 45 minutes", nb: "finish between 45 and 60 minutes", c: "are under 30 years old", ask: "runners under 30 who finish between 45 and 60 minutes" },
        { pop: "shoppers at a store", a: "use a coupon", b: "use a coupon for the whole order", nb: "use a coupon for a single item", c: "pay with a card", ask: "shoppers who pay with a card and use a coupon for a single item" },
      ]);
      const stimulus = facts(rng, [
        [`A survey included ${N} ${c.pop}.`, `There were ${N} ${c.pop} in a survey.`, `${N} ${c.pop} answered a survey.`],
        [`Of these, ${p}% ${c.a}.`, `${p}% of them ${c.a}.`, `Exactly ${p}% of the people surveyed ${c.a}.`],
        [`Of those who ${c.a.replace(/^are /, "are ")}, ${q}% ${c.b}.`, `${q}% of the people in that group ${c.b}; the rest of the group ${c.nb}.`, `Within that group, ${q}% ${c.b}, and the rest ${c.nb}.`],
        [`Of the people who ${c.nb}, ${r}% ${c.c}.`, `${r}% of the group that ${c.nb} ${c.c}.`, `Among those who ${c.nb}, ${r}% ${c.c}.`],
      ]);
      return finish(rng, {
        stimulus: withOpen(rng, OPEN_GROUP, stimulus), question: spin(rng, `[[How many of the ${N} ${c.pop} are ${c.ask}?|How many people surveyed are ${c.ask}?|Find the number of ${c.ask}.]]`), correct: d,
        wrongs: [W((a * q * r) / 10000, "condition_ignored", "'나머지' 집단이 아니라 q% 집단을 기준으로 계산했다."), W((a * (100 - q)) / 100, "step_missing", "마지막 r% 를 적용하지 않았다."), W((N * r) / 100, "formula_misuse", "r% 를 전체 N 에 바로 적용했다."), W((N * p * (100 - q)) / 10000, "step_missing", "마지막 단계를 빼먹었다."), W((b * (100 - r)) / 100, "condition_ignored", "r% 의 나머지를 구했다.")],
        verificationJs: withParams({ N, p, q, r }, "const num=P.N*P.p*(100-P.q)*P.r; if(num%1000000!==0) throw new Error('정수 아님'); return num/1000000;"),
        trace: [
          [`처음 집단 ${N}의 ${p}% 는 ${a} 이다.`, "Take the first percentage of the whole."],
          [`이 ${a}을(를) 새 기준량으로 삼는다.`, "Switch the base to the first result."],
          [`그중 ${q}%가 제외되므로 나머지는 ${100 - q}% 이다.`, "Use the complement for the excluded part."],
          [`${a}의 ${100 - q}% = ${b} 이다.`, "Second percentage."],
          [`다시 ${b}을(를) 기준량으로 ${r}% 를 구한다.`, "Switch the base again."],
          [`${b}의 ${r}% = ${d} 이다.`, "Third percentage."],
        ],
        variant: c.pop.split(" ")[0],
      });
    },
  },
  {
    id: "pct.percent_of.inverse", skill: SKILL, kind: "percent_of", operator: "inverse",
    structure: "'x 의 p% = y 의 q%' 이고 x+y=T 일 때 y 를 구함: 퍼센트 값의 같음을 비 x:y = q:p 로 바꾸고 전체 T 를 비례배분",
    extraThinking: "퍼센트의 값이 같다는 조건을 비율 관계로 역산해 비례배분 — medium 은 주어진 양의 p% 를 바로 계산",
    concepts: ["퍼센트의 값", "비의 역산", "비례배분"], mediumSteps: 1,
    generate(rng) {
      const p = rng.pick([10, 12, 15, 20, 25, 30, 40, 50]), q = rng.pick([10, 12, 15, 20, 25, 30, 40, 50]); if (p === q) throw new GenFail("x");
      const s = p + q, g0 = gcd(p, q), T = rng.int(2, 30) * (s / g0);
      if (T > 990 || (T * p) % s !== 0 || T < 40) throw new GenFail("x");
      const y = (T * p) / s, x = T - y;
      const [n1, n2] = rng.pick([["Dana", "Eli"], ["Priya", "Marcus"], ["Sofia", "Theo"], ["Wen", "Jamal"], ["Lena", "Omar"]]);
      const c = rng.pick([
        { s: (n1: string, n2: string) => `${n1} saves ${p}% of weekly pay, and ${n2} saves ${q}% of weekly pay. They save exactly the same number of dollars each week. Together, their weekly pay totals ${T} dollars.`, ask: (n: string) => `How many dollars is ${n}'s weekly pay?`, what: "weekly pay", noun: "pay" },
        { s: (n1: string, n2: string) => `${n1} donates ${p}% of a monthly allowance, and ${n2} donates ${q}% of a monthly allowance. The two donations are equal in dollars. The two allowances add up to ${T} dollars.`, ask: (n: string) => `What is ${n}'s monthly allowance, in dollars?`, what: "monthly allowance", noun: "allowance" },
        { s: (n1: string, n2: string) => `${n1} sets aside ${p}% of a travel budget for souvenirs, and ${n2} sets aside ${q}% of a different travel budget for souvenirs. Both spend the same number of dollars on souvenirs. The two budgets total ${T} dollars.`, ask: (n: string) => `How many dollars is ${n}'s travel budget?`, what: "travel budget", noun: "budget" },
        { s: (n1: string, n2: string) => `${n1} puts ${p}% of the weekly tips in a jar, and ${n2} puts ${q}% of the weekly tips in a jar. Their jars hold the same number of dollars. Together, they collect ${T} dollars in tips each week.`, ask: (n: string) => `How many dollars in tips does ${n} collect each week?`, what: "weekly tips", noun: "tips" },
        { s: (n1: string, n2: string) => `${n1} spends ${p}% of a monthly income on rent, and ${n2} spends ${q}% of a monthly income on rent. Their rent payments are the same in dollars. Their monthly incomes add up to ${T} dollars.`, ask: (n: string) => `What is ${n}'s monthly income, in dollars?`, what: "monthly income", noun: "income" },
      ]);
      const stimulus = c.s(n1, n2);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_MONEY, stimulus), question: c.ask(n2), correct: y,
        wrongs: [W(x, "other", `${n1}의 금액을 답했다.`), W((T * q) / s, "formula_misuse", "비 x:y = q:p 를 거꾸로(p:q) 적용했다."), W((T * p) / 100, "formula_misuse", "합계의 p% 를 구했다."), W(T / 2, "condition_ignored", "저축액이 같다는 것을 금액이 같다는 것으로 착각해 반으로 나눴다."), W(T - (T * q) / 100, "formula_misuse", "합계에서 q% 를 뺐다.")],
        verificationJs: withParams({ p, q, T }, "const out=[];\nfor(let x=1;x<P.T;x++){ const y=P.T-x; if(P.p*x===P.q*y) out.push(y); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`${n1}의 ${c.what}을 x, ${n2}의 ${c.what}을 y 라 하면 x + y = ${T} 이다.`, "Define the unknowns."],
          [`두 금액(퍼센트의 값)이 같으므로 ${p}% × x = ${q}% × y 이다.`, "Equal amounts give p·x = q·y."],
          [`따라서 x : y = ${q / g0} : ${p / g0} 이다.`, "Invert into a ratio."],
          [`전체 ${T} 를 ${s / g0} 묶음으로 나누면 한 묶음은 ${T / (s / g0)} 이다.`, "Split the total."],
          [`y 는 ${p / g0} 묶음이므로 ${y} 이다.`, "Read off y."],
        ],
        variant: c.noun,
      });
      return sem(out, [], { words: [n2] });
    },
  },
  {
    id: "pct.percent_of.compare_scenarios", skill: SKILL, kind: "percent_of", operator: "compare_scenarios",
    structure: "A점 'p% 할인' 과 B점 '정액 c 먼저 할인 후 q% 할인' 의 판매가가 같아지는 정가 x 를 방정식 x(100−p)=(x−c)(100−q) 로 구함",
    extraThinking: "정률 할인과 정액+정률 할인 두 모델을 세워 같아지는 임계점을 찾음 — medium 은 한 가게의 할인액 계산",
    concepts: ["퍼센트 할인", "두 경우 비교", "일차방정식(임계점)"], mediumSteps: 1,
    generate(rng) {
      const p = rng.int(15, 60), q = rng.int(5, p - 5), c = rng.int(5, 60); const x = (c * (100 - q)) / (p - q);
      if (!Number.isInteger(x) || x < 40 || x > 900 || x <= c) throw new GenFail("x");
      const [item, s1, s2] = rng.pick([["jacket", "Outlet", "Boutique"], ["bicycle", "Cycle World", "Pedal Shop"], ["tablet", "TechMart", "GadgetHub"], ["backpack", "Trail Co.", "Summit Gear"], ["armchair", "Home Depot Plus", "Furniture Row"]]);
      const stimulus = spin(rng, `A ${item} has the same list price at two stores. ${s1} [[advertises|offers|takes]] ${p}% off the list price. ${s2} first [[takes|subtracts|deducts]] ${c} dollars off the list price and then [[takes|applies]] ${q}% off the reduced price. [[For one particular list price, the two stores charge exactly the same amount.|There is exactly one list price at which both stores charge the same.]]`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_MONEY, stimulus), question: spin(rng, "[[What is that list price, in dollars?|What is the list price of the item, in dollars?|Find the list price in dollars.]]"), correct: x,
        wrongs: [W((100 * c) / p, "formula_misuse", "정액 할인액이 p% 에 해당하는 값으로 정가를 구했다(두 번째 가게의 q% 를 무시)."), W((100 * c) / (p - q), "formula_misuse", "정액 c 를 (p−q)% 의 값으로 놓아 정가를 구했다(남은 금액 기준 q% 를 놓침)."), W(c * (100 - q) / (p + q), "sign_error", "비교식에서 q 의 부호를 잘못 처리했다."), W((x * (100 - p)) / 100, "step_missing", "정가가 아니라 한 가게의 판매가를 답했다."), W(x + c, "other", "정액 할인 전 가격에 c 를 더했다.")],
        verificationJs: withParams({ p, q, c }, "const out=[];\nfor(let x=P.c+1;x<=3000;x++){ if(x*(100-P.p)===(x-P.c)*(100-P.q)) out.push(x); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`정가를 x 라 하면 ${s1}의 판매가는 x × ${(100 - p) / 100} 이다.`, "Model store 1."],
          [`${s2}는 먼저 ${c} 를 빼므로 (x − ${c}) 이다.`, "First step of store 2."],
          [`이어서 ${q}% 할인이므로 (x − ${c}) × ${(100 - q) / 100} 이다.`, "Second step of store 2."],
          [`두 판매가가 같으므로 ${(100 - p) / 100}x = ${(100 - q) / 100}(x − ${c}) 이다.`, "Equate the two prices."],
          [`정리하면 ${(p - q) / 100}x = ${(c * (100 - q)) / 100} 이므로 x = ${x} 이다.`, "Solve for the list price."],
        ],
        variant: "flat_plus_percent",
      });
      return sem(out, [{ v: p, words: DOWN, pct: true }, { v: q, words: DOWN, pct: true }, { v: c, words: DOWN, pct: false }], { words: ["list price"] });
    },
  },
  // ───────────── find_whole ─────────────
  {
    id: "pct.find_whole.chain2", skill: SKILL, kind: "find_whole", operator: "chain2",
    structure: "전체의 p% 를 쓰고 '남은 것의' q% 를 또 쓴 뒤 남은 R 로부터 거꾸로 전체를 구함(남은 비율 (100−p)(100−q)/100²)",
    extraThinking: "두 번의 감소가 서로 다른 기준량에 적용된 연쇄를 역순으로 풀기 — medium 은 한 번의 p% 로 전체 구하기",
    concepts: ["남은 비율(보수)", "연쇄 퍼센트", "역산"], mediumSteps: 1,
    generate(rng) {
      const p = rng.pick([10, 20, 25, 30, 40, 50]), q = rng.pick([10, 20, 25, 30, 40, 50, 60]);
      const Wt = rng.pick([100, 120, 160, 200, 240, 250, 300, 320, 400, 500, 600, 800]); const R = (Wt * (100 - p) * (100 - q)) / 10000;
      if (!Number.isInteger(R) || R < 5 || (Wt * (100 - p)) % 100 !== 0) throw new GenFail("x");
      const c = rng.pick([
        { who: "A family", what: "monthly budget", f1: "rent", f2: "groceries", unit: "dollars" }, { who: "A club", what: "annual fundraising total", f1: "equipment", f2: "travel", unit: "dollars" },
        { who: "A student", what: "summer earnings", f1: "a laptop", f2: "books", unit: "dollars" }, { who: "A bakery", what: "weekly revenue", f1: "ingredients", f2: "wages", unit: "dollars" },
        { who: "A team", what: "season prize money", f1: "travel costs", f2: "uniforms", unit: "dollars" },
      ]);
      const stimulus = spin(rng, `${c.who} [[spends|uses|sets aside]] ${p}% of its ${c.what} on ${c.f1}. [[Then it spends|It then spends|Next it spends]] ${q}% of the [[money that is left|remaining money|amount remaining]] on ${c.f2}. [[After both expenses, ${R} dollars remain.|Exactly ${R} dollars are left after the two expenses.|When both payments are made, ${R} dollars are still available.]]`);
      return finish(rng, {
        stimulus: withOpen(rng, OPEN_MONEY, stimulus), question: spin(rng, `[[What was the ${c.what}, in dollars?|What was the original ${c.what}, in dollars?|Find the ${c.what} before any spending, in dollars.]]`), correct: Wt,
        wrongs: [W((R * 100) / (100 - p - q), "formula_misuse", "두 비율을 더해(p+q)% 를 쓴 것으로 처리했다."), W((R * 100) / (100 - q), "step_missing", "첫 번째 지출을 무시했다."), W((R * 100) / (100 - p), "step_missing", "두 번째 지출을 무시했다."), W(R + (R * (p + q)) / 100, "formula_misuse", "남은 돈에 (p+q)% 를 더했다."), W((R * 100) / (100 - p) + (R * 100) / (100 - q) - R, "other", "두 단계를 따로 되돌려 합쳤다.")],
        verificationJs: withParams({ p, q, R }, "const out=[];\nfor(let w=1;w<=3000;w++){ if(w*(100-P.p)*(100-P.q)===P.R*10000) out.push(w); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`처음 금액을 x 라 하면 첫 지출 후 남는 것은 x의 ${100 - p}% 이다.`, "Remaining after the first spend."],
          [`남은 것의 ${q}% 를 또 쓰므로 그 ${100 - q}% 가 남는다.`, "Remaining after the second spend."],
          [`따라서 x × ${(100 - p) / 100} × ${(100 - q) / 100} = ${R} 이다.`, "Combine the two multipliers."],
          [`곱 ${((100 - p) * (100 - q)) / 10000} 를 구한다.`, "Multiply the multipliers."],
          [`x = ${R} ÷ ${((100 - p) * (100 - q)) / 10000} = ${Wt} 이다.`, "Divide to undo."],
        ],
        variant: "two_expenses",
      });
    },
  },
  {
    id: "pct.find_whole.inverse", skill: SKILL, kind: "find_whole", operator: "inverse",
    structure: "p% 증가한 값 B 에서 원래 값 O=100B/(100+p) 를 역산한 뒤, 같은 p% 를 '감소'로 적용한 값 O(100−p)/100 을 구함",
    extraThinking: "증가 후 값에서 원래 값을 역산하고 방향을 바꿔 다시 적용(증가·감소가 서로 상쇄되지 않음) — medium 은 원래 값 하나 역산",
    concepts: ["퍼센트 증가의 역산", "기준량 구분", "퍼센트 감소"], mediumSteps: 1,
    generate(rng) {
      const p = rng.pick([10, 20, 25, 30, 40, 50, 60, 75]); const O = rng.pick([40, 60, 80, 100, 120, 140, 160, 180, 200, 240, 280, 300, 400, 500]);
      const B = (O * (100 + p)) / 100, A2 = (O * (100 - p)) / 100; if (!Number.isInteger(B) || !Number.isInteger(A2) || B > 990) throw new GenFail("x");
      const c = rng.pick([
        { what: "price of a ticket", unit: "dollars", up: "rose", ent: "The price of a concert ticket" }, { what: "number of members in a club", unit: "members", up: "grew", ent: "A club's membership" },
        { what: "enrollment at a school", unit: "students", up: "increased", ent: "A school's enrollment" }, { what: "monthly rent", unit: "dollars", up: "went up", ent: "The monthly rent on an apartment" },
        { what: "daily visitors to a park", unit: "visitors", up: "increased", ent: "The number of daily visitors to a park" },
      ]);
      const stimulus = spin(rng, `${c.ent} ${c.up} by ${p}% [[and is now|to reach|and became]] ${B} ${c.unit}.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GROUP, stimulus), question: spin(rng, `[[If, instead, the original value had decreased by ${p}%, what would the new value be?|Suppose the original value had dropped by ${p}% instead of rising. What would the new value be?|What would the value be if the original had been reduced by ${p}% rather than increased?]]`), correct: A2,
        wrongs: [W((B * (100 - p)) / 100, "condition_ignored", "감소를 원래 값이 아니라 증가한 값 B 에 적용했다."), W(O, "step_missing", "원래 값만 구하고 감소를 적용하지 않았다."), W(B - 2 * (B - O), "other", "증가분을 두 번 뺐다."), W(O - (B - O) * 2, "other", "증가분의 두 배를 원래 값에서 뺐다."), W(B - (B * p) / 100, "formula_misuse", "증가한 값에서 p% 를 빼서 원래 값을 구한 것으로 처리했다.")],
        verificationJs: withParams({ p, B }, "const out=[];\nfor(let o=1;o<=3000;o++){ if(o*(100+P.p)===P.B*100){ const d=o*(100-P.p); if(d%100!==0) throw new Error('정수 아님'); out.push(d/100); } }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`증가한 값 ${B} 는 원래 값의 ${100 + p}% 이다.`, "The new value is (100+p)% of the original."],
          [`원래 값 = ${B} ÷ ${(100 + p) / 100} = ${O} 이다.`, "Undo the increase."],
          [`이제 같은 ${p}% 를 감소로 적용하므로 원래 값의 ${100 - p}% 를 구한다.`, "Switch to a decrease from the original."],
          [`기준량은 증가한 값 ${B} 가 아니라 원래 값 ${O} 이다.`, "The base is the original, not the increased value."],
          [`${O} × ${(100 - p) / 100} = ${A2} 이다.`, "Compute."],
        ],
        variant: "reverse_direction",
      });
      return sem(out, [{ v: p, words: [...UP, ...DOWN] }], { words: ["value"] });
    },
  },
  {
    id: "pct.find_whole.unit_ratio", skill: SKILL, kind: "find_whole", operator: "unit_ratio",
    structure: "성분이 질량의 p% 이고 그 성분이 x kg 일 때 전체 T=100x/p kg 를 구하고, 성분이 아닌 부분의 질량을 g 단위로 환산",
    extraThinking: "퍼센트 역산에 질량 단위 환산(kg→g)과 보수(성분이 아닌 부분)를 결합 — medium 은 전체값 하나 역산",
    concepts: ["전체값 역산", "보수", "단위 환산"], mediumSteps: 1,
    generate(rng) {
      const T = rng.int(3, 9), p = rng.pick([10, 20, 25, 40, 50, 60, 75, 80]); const x = (T * p) / 100; if (!Number.isInteger(x) || x < 1) throw new GenFail("x");
      const c = rng.pick([
        { mix: "trail mix", part: "nuts", rest: "everything other than nuts", pre: "A bag of trail mix" }, { mix: "garden fertilizer", part: "nitrogen", rest: "ingredients other than nitrogen", pre: "A sack of fertilizer" },
        { mix: "metal alloy", part: "copper", rest: "metal other than copper", pre: "A block of alloy" }, { mix: "breakfast cereal", part: "oats", rest: "ingredients other than oats", pre: "A box of cereal" },
        { mix: "concrete mix", part: "cement", rest: "material other than cement", pre: "A bag of concrete mix" },
      ]);
      const stimulus = spin(rng, `${c.pre} is ${p}% ${c.part} by mass. [[It contains|It holds|In all, there ${x === 1 ? "is" : "are"}]] ${x} kilogram${x === 1 ? "" : "s"} of ${c.part}.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_SCI, stimulus), question: spin(rng, `[[How many grams of ${c.rest} does it contain?|What is the mass, in grams, of ${c.rest}?|Find the mass of ${c.rest}, in grams.]]`), correct: (T - x) * 1000,
        wrongs: [W(T * 1000, "step_missing", "성분이 아닌 부분이 아니라 전체 질량을 g 으로 답했다."), W(x * 1000, "step_missing", "성분의 질량을 g 으로 답했다."), W(T - x, "unit_error", "kg 을 g 으로 환산하지 않았다."), W((T - x) * 100, "unit_error", "1 kg = 100 g 으로 환산했다."), W(((x * (100 - p)) / 100) * 1000, "formula_misuse", "성분 질량의 (100−p)% 를 구했다.")],
        verificationJs: withParams({ p, x }, "const out=[];\nfor(let t=1;t<=200;t++){ if(t*P.p===100*P.x) out.push((t-P.x)*1000); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`${c.part} ${x} kg 이 전체 질량의 ${p}% 이다.`, "The part is p% of the total."],
          [`전체 질량 = ${x} ÷ ${p / 100} = ${T} kg 이다.`, "Find the total mass."],
          [`${c.part}이(가) 아닌 부분은 ${T} − ${x} = ${T - x} kg 이다.`, "Take the complement."],
          ["1 kg = 1000 g 이다.", "Recall the unit relation."],
          [`${T - x} × 1000 = ${(T - x) * 1000} g 이다.`, "Convert to grams."],
        ],
        variant: c.part,
      });
      return sem(out, [{ v: p, words: [c.part] }, { v: x, words: [c.part] }], { words: ["grams"] });
    },
  },
  {
    id: "pct.find_whole.compare_scenarios", skill: SKILL, kind: "find_whole", operator: "compare_scenarios",
    structure: "용량이 다른 두 탱크가 각각 p%, q% 찬 상태로 같은 양을 담고 있고 용량 차가 d 일 때 용량을 구해 담긴 양을 계산",
    extraThinking: "서로 다른 기준량(용량)에 대한 퍼센트가 같은 값이라는 두 경우의 비교를 방정식으로 세움 — medium 은 한 전체값 역산",
    concepts: ["퍼센트의 값", "두 경우 비교", "연립 관계"], mediumSteps: 1,
    generate(rng) {
      const p = rng.int(40, 90), q = rng.int(10, p - 10); const Lm = lcm(q / gcd(q, p - q), 100 / gcd(100, p)); const capA = Lm * rng.int(1, Math.max(1, Math.floor(400 / Lm))); const d = (capA * (p - q)) / q;
      if (!Number.isInteger(d) || d < 4 || d > 400 || capA < 5) throw new GenFail("x");
      const capB = capA + d, liq = (capA * p) / 100; if (!Number.isInteger(liq) || liq < 2 || capB > 990) throw new GenFail("x");
      const [t1, t2, unit] = rng.pick([["Tank A", "tank B", "liters"], ["Barrel X", "barrel Y", "gallons"], ["Container P", "container Q", "liters"], ["Cistern M", "cistern N", "gallons"]]);
      const stimulus = spin(rng, `${t1} is filled to ${p}% of its capacity, and ${t2} is filled to ${q}% of its capacity. [[The two hold exactly the same amount of water|Both contain the same volume of water]]. ${t1}'s capacity is ${d} ${unit} [[less than|smaller than]] ${t2}'s capacity.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_SCI, stimulus), question: spin(rng, `[[How many ${unit} of water does ${t1} contain?|What amount of water, in ${unit}, is in ${t1}?|Find the number of ${unit} of water in ${t1}.]]`), correct: liq,
        wrongs: [W(capA, "step_missing", "물의 양이 아니라 용량을 답했다."), W((capB * q) / 100 + 1, "other", "계산 실수."), W((d * p) / 100, "formula_misuse", "용량 차 d 의 p% 를 구했다."), W((d * (p - q)) / 100, "formula_misuse", "용량 차에 퍼센트 차를 곱했다."), W(capB, "step_missing", "큰 쪽 용량을 답했다.")],
        verificationJs: withParams({ p, q, d }, "const out=[];\nfor(let a=1;a<=2000;a++){ const b=a+P.d; if(a*P.p===b*P.q){ if((a*P.p)%100!==0) throw new Error('정수 아님'); out.push(a*P.p/100); } }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`${t1} 의 용량을 a 라 하면 ${t2} 의 용량은 a + ${d} 이다.`, "Let the capacities be a and a + d."],
          [`담긴 물의 양이 같으므로 ${p}% × a = ${q}% × (a + ${d}) 이다.`, "Equal water amounts."],
          [`${p}a = ${q}a + ${q * d} 이므로 ${p - q}a = ${q * d} 이다.`, "Collect terms."],
          [`a = ${capA} 이다.`, "Solve for the capacity."],
          [`담긴 물 = ${capA}의 ${p}% = ${liq} 이다.`, "Compute the water amount."],
        ],
        variant: "equal_contents",
      });
      return sem(out, [{ v: d, words: [t1, t2] }], { words: ["water"] });
    },
  },
  // ───────────── percent_change ─────────────
  {
    id: "pct.percent_change.chain2", skill: SKILL, kind: "percent_change", operator: "chain2",
    structure: "첫 해 a→b 의 변화율 p 를 구해 '다음 해에도 같은 비율'로 b 에 다시 적용(c=b²/a)",
    extraThinking: "앞 단계에서 구한 변화율이 다음 단계의 조건이 되는 연쇄(두 번째 기준량은 b) — medium 은 두 값 사이의 변화율 하나",
    concepts: ["변화율 계산", "같은 비율 재적용", "기준량 전환"], mediumSteps: 1,
    generate(rng) {
      const a = rng.pick([16, 20, 25, 32, 36, 40, 45, 48, 50, 64, 80, 100, 125, 160, 200]); const g = rng.pick([1, -1]);
      const k = rng.int(1, 9); const b = a + g * ((a * k) / 10); if (!Number.isInteger(b) || b <= 0 || b === a) throw new GenFail("x");
      const c3 = (b * b) / a; if (!Number.isInteger(c3) || c3 > 990) throw new GenFail("x");
      const pct = (100 * Math.abs(b - a)) / a; if (!Number.isInteger(pct)) throw new GenFail("x");
      const ent = rng.pick([["A town's population", "people", "year"], ["A company's monthly sales", "units", "month"], ["The number of subscribers", "subscribers", "year"], ["A reservoir's volume", "megaliters", "month"], ["A student club's membership", "members", "year"]]);
      const up = g > 0 ? ["grew", "increase"] : ["shrank", "decrease"];
      const stimulus = spin(rng, `${ent[0]} ${up[0]} from ${a} to ${b} ${ent[1]} in one ${ent[2]}. [[It continues to change by the same percent in the next ${ent[2]}.|In the following ${ent[2]}, the percent change is the same as in the first.|The next ${ent[2]} brings a change of the same percent.]]`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GROUP, stimulus), question: spin(rng, `[[How many ${ent[1]} are there after the second ${ent[2]}?|What is the value, in ${ent[1]}, after two ${ent[2]}s in all?|Find the number of ${ent[1]} at the end of the second ${ent[2]}.]]`), correct: c3,
        wrongs: [W(b + (b - a), "formula_misuse", "같은 '양'(b−a)이 변한다고 보았다(같은 비율이 아님)."), W(a + 2 * (b - a), "formula_misuse", "두 해 동안 같은 양만큼 변했다고 계산했다(처음 값 기준)."), W(b + (100 * (b - a)) / b, "other", "변화율(%)을 값에 그대로 더했다."), W((b * b) / a - (b - a), "other", "합성 결과에서 첫 해 변화량을 한 번 더 뺐다.")],
        verificationJs: withParams({ a, b }, "const out=[];\nfor(let den=1;den<=60;den++) for(let num=1;num<=120;num++){ if(P.a*num===P.b*den){ const c=P.b*num; if(c%den===0) out.push(c/den); } }\nif(out.length<1) throw new Error('해 없음');\nreturn out[0];"),
        trace: [
          [`변화량은 |${b} − ${a}| = ${Math.abs(b - a)} 이다.`, "Find the change."],
          [`변화율은 기준량(처음 값) ${a} 에 대해 ${Math.abs(b - a)} ÷ ${a} × 100 = ${pct}% (${g > 0 ? "증가" : "감소"}) 이다.`, "Percent change relative to the original."],
          [`다음 기간에도 같은 ${pct}% 이므로 곱하는 수는 ${(100 + g * pct) / 100} 이다.`, "The second multiplier is the same."],
          [`이번에는 기준량이 ${b} 이다.`, "The base is now the new value."],
          [`${b} × ${(100 + g * pct) / 100} = ${c3} 이다.`, "Apply it."],
        ],
        variant: g > 0 ? "growth" : "decline",
      });
      return out;
    },
  },
  {
    id: "pct.percent_change.inverse", skill: SKILL, kind: "percent_change", operator: "inverse",
    structure: "p% 인상이 d 원 올린 것임을 이용해 원래 가격 O=100d/p 를 역산하고 인상가에서 q% 할인한 최종 가격을 구함",
    extraThinking: "변화량과 변화율에서 원래 값을 역산한 뒤 새 기준량에 다른 퍼센트를 적용 — medium 은 두 값에서 변화율 하나",
    concepts: ["변화율의 역산", "기준량 전환", "퍼센트 할인"], mediumSteps: 1,
    generate(rng) {
      const p = rng.pick([5, 10, 15, 20, 25, 30, 40, 50]); const q = rng.pick([10, 20, 25, 30, 40, 50]); const O = rng.pick([40, 60, 80, 100, 120, 160, 200, 240, 300, 400, 500]);
      const d = (O * p) / 100, M = O + d, F = (M * (100 - q)) / 100; if (!Number.isInteger(d) || !Number.isInteger(F) || d < 2) throw new GenFail("x");
      const item = rng.pick([["a pair of headphones", "store"], ["a textbook", "bookstore"], ["a bicycle helmet", "shop"], ["a concert ticket", "box office"], ["a monthly gym membership", "gym"]]);
      const stimulus = spin(rng, `The price of ${item[0]} at a ${item[1]} was raised by ${p}%, which added ${d} dollars to the price. [[Later, the ${item[1]} took ${q}% off the new price.|After that, the new price was reduced by ${q}%.|Then a ${q}% discount was applied to the raised price.]]`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_MONEY, stimulus), question: spin(rng, "[[What is the final price, in dollars?|What is the price after the discount, in dollars?|Find the final price in dollars.]]"), correct: F,
        wrongs: [W((O * (100 - q)) / 100, "condition_ignored", "할인을 인상 전 가격 O 에 적용했다."), W(M, "step_missing", "할인을 적용하지 않고 인상가를 답했다."), W(O, "step_missing", "원래 가격만 구했다."), W((d * (100 - q)) / 100, "formula_misuse", "인상액 d 에 할인율을 적용했다."), W(M - (d * q) / 100, "formula_misuse", "할인액을 인상액 기준으로 계산했다.")],
        verificationJs: withParams({ p, q, d }, "const out=[];\nfor(let o=1;o<=3000;o++){ if(o*P.p===100*P.d){ const m=o+P.d; if((m*(100-P.q))%100!==0) throw new Error('정수 아님'); out.push(m*(100-P.q)/100); } }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`인상액 ${d} 은 원래 가격의 ${p}% 이다.`, "The increase is p% of the original."],
          [`원래 가격 = ${d} ÷ ${p / 100} = ${O} 이다.`, "Recover the original."],
          [`인상 후 가격 = ${O} + ${d} = ${M} 이다.`, "Compute the raised price."],
          [`할인은 인상 후 가격 ${M} 의 ${q}% 이므로 ${100 - q}% 가 남는다.`, "The discount uses the new base."],
          [`${M} × ${(100 - q) / 100} = ${F} 이다.`, "Final price."],
        ],
        variant: "raise_then_discount",
      });
      return sem(out, [{ v: p, words: UP, pct: true }, { v: q, words: DOWN, pct: true }, { v: d, words: UP, pct: false }], { words: ["price"] });
    },
  },
  {
    id: "pct.percent_change.compare_scenarios", skill: SKILL, kind: "percent_change", operator: "compare_scenarios",
    structure: "A 의 증가율 p 와 B 의 감소율 q 를 각각 자기 기준량으로 구한 뒤 퍼센트포인트 차 p−q 를 구함",
    extraThinking: "서로 다른 기준량에 대한 증가율과 감소율의 비교(절대 변화량이 아닌 퍼센트포인트 차) — medium 은 한 변화율",
    concepts: ["증가율", "감소율", "퍼센트포인트 차"], mediumSteps: 1,
    generate(rng) {
      const a = rng.pick([20, 25, 40, 50, 60, 80, 100, 125, 200, 250, 400]), b = rng.pick([20, 25, 40, 50, 60, 80, 100, 125, 200, 250, 400]);
      const p = rng.pick([10, 12, 20, 24, 25, 30, 40, 50, 60, 75]), q = rng.pick([5, 8, 10, 15, 20, 25, 30, 40, 50]);
      const a2 = a + (a * p) / 100, b2 = b - (b * q) / 100;
      if (![a2, b2].every(Number.isInteger) || p <= q || a === b || a2 === b2 || a2 > 990 || (a2 - a) === (b - b2)) throw new GenFail("x");
      const [A, B, unit, yrs] = rng.pick([["City A", "City B", "thousand residents", ["2010", "2020"]], ["Plant X", "Plant Y", "workers", ["2015", "2023"]], ["School East", "School West", "students", ["2012", "2022"]], ["Town Hall's website", "the library's website", "thousand visits per month", ["2019", "2024"]]]);
      const stimulus = spin(rng, `Over the past decade, the number of ${unit} at ${A} [[rose|increased|grew]] from ${a} to ${a2}. Over the same period, the number at ${B} [[fell|decreased|dropped]] from ${b} to ${b2}.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GROUP, stimulus), question: spin(rng, `[[By how many percentage points is the percent increase at ${A} greater than the percent decrease at ${B}?|The percent increase at ${A} exceeds the percent decrease at ${B} by how many percentage points?|What is the difference, in percentage points, between the percent increase at ${A} and the percent decrease at ${B}?]]`), correct: p - q,
        wrongs: [W(a2 - a - (b - b2), "unit_error", "퍼센트포인트 차가 아니라 절대 변화량의 차를 답했다."), W(p + q, "sign_error", "감소율의 부호를 무시하고 더했다."), W(Math.round((100 * (a2 - a)) / b2) - q, "condition_ignored", "A 의 증가율을 다른 기준량으로 계산했다."), W((100 * (b - b2)) / b2 - p + 100, "other", "감소율을 새 값 기준으로 계산했다."), W(p - q + 2, "other", "계산 실수.")],
        verificationJs: withParams({ a, a2, b, b2 }, "const up=100*(P.a2-P.a)/P.a, down=100*(P.b-P.b2)/P.b; return Math.round((up-down)*1e6)/1e6;"),
        trace: [
          [`${A}의 변화량은 ${a2} − ${a} = ${a2 - a} 이다.`, "Change for A."],
          [`증가율은 기준량 ${a} 에 대해 ${a2 - a} ÷ ${a} × 100 = ${p}% 이다.`, "Percent increase for A."],
          [`${B}의 변화량은 ${b} − ${b2} = ${b - b2} 이다.`, "Change for B."],
          [`감소율은 기준량 ${b} 에 대해 ${b - b2} ÷ ${b} × 100 = ${q}% 이다.`, "Percent decrease for B."],
          [`퍼센트포인트 차는 ${p} − ${q} = ${p - q} 이다.`, "Subtract the rates, not the changes."],
        ],
        variant: "rise_vs_fall",
      });
      return sem(out, [{ v: a, words: [A, "from"] }, { v: b, words: [B, "from"] }], { words: ["percentage points"] });
    },
  },
  {
    id: "pct.percent_change.unit_ratio", skill: SKILL, kind: "percent_change", operator: "unit_ratio",
    structure: "연비(mpg)가 a→b 로 오를 때 같은 거리에 필요한 연료량은 D/a→D/b 로 줄어드는 비율을 역수 관계로 구함",
    extraThinking: "단위당 양(mpg)과 필요량(gallons)이 역수 관계임을 파악해 변화율을 구함 — medium 은 두 값의 변화율 직접 계산",
    concepts: ["변화율", "역수 관계(단위 비율)", "연료량 계산"], mediumSteps: 1,
    generate(rng) {
      const pairs = [[20, 25], [30, 40], [15, 20], [24, 30], [32, 40], [40, 50], [16, 20], [18, 24], [36, 48], [45, 60], [25, 50], [30, 50], [12, 15]];
      const [a, b] = rng.pick(pairs); const pct = (100 * (b - a)) / b; if (!Number.isInteger(pct)) throw new GenFail("x");
      const D = lcm(a, b) * rng.int(1, 4); if (D > 990) throw new GenFail("x");
      const [veh, unit, unit2] = rng.pick([["A delivery van", "miles per gallon", "gallons"], ["A hybrid sedan", "miles per gallon", "gallons"], ["A scooter", "kilometers per liter", "liters"], ["A tour bus", "kilometers per liter", "liters"]]);
      const dist = unit.startsWith("miles") ? "miles" : "kilometers";
      const stimulus = spin(rng, `${veh} gets ${a} ${unit}. After a tune-up it gets ${b} ${unit}. [[It then makes a ${D}-${dist.slice(0, -1)} delivery run|Both before and after the tune-up it makes the same ${D}-${dist.slice(0, -1)} trip|It drives the same ${D}-${dist.slice(0, -1)} route before and after]].`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_SCI, stimulus), question: spin(rng, `[[By what percent does the ${unit2} of fuel needed for the trip decrease after the tune-up?|The fuel used for the ${D}-${dist.slice(0, -1)} trip drops by what percent?|What is the percent decrease in the fuel needed for the trip?]]`), correct: pct,
        wrongs: [W((100 * (b - a)) / a, "formula_misuse", `연비의 증가율을 연료 감소율로 답했다(연료량은 연비에 반비례).`), W(100 - pct, "other", "남는 비율을 감소율로 답했다."), W((100 * (D / a - D / b)) / D, "step_missing", "연료량 차를 거리로 나눠 퍼센트를 계산했다."), W(b - a, "formula_misuse", "연비의 차를 퍼센트로 답했다."), W((100 * (b - a)) / (a + b), "other", "평균을 기준으로 계산했다.")],
        verificationJs: withParams({ a, b, D }, "const f1=P.D/P.a, f2=P.D/P.b; return Math.round(100*(f1-f2)/f1*1e6)/1e6;"),
        trace: [
          [`거리 ${D} 에 필요한 연료는 처음에 ${D} ÷ ${a} = ${D / a} ${unit2} 이다.`, "Fuel before."],
          [`정비 후에는 ${D} ÷ ${b} = ${D / b} ${unit2} 이다.`, "Fuel after."],
          [`연료 감소량은 ${D / a} − ${D / b} = ${D / a - D / b} 이다.`, "The decrease in fuel."],
          [`기준량은 처음 연료 ${D / a} 이다.`, "The base is the original fuel."],
          [`${D / a - D / b} ÷ ${D / a} × 100 = ${pct}% 이다.`, "Percent decrease."],
        ],
        variant: dist,
      });
      return sem(out, [{ v: a, words: ["gets"] }, { v: b, words: ["gets"] }], { words: ["fuel"] });
    },
  },
  // ───────────── find_percent ─────────────
  {
    id: "pct.find_percent.inverse", skill: SKILL, kind: "find_percent", operator: "inverse",
    structure: "처음 n 문제 중 x 개를 맞힌 상태에서 전체 n+m 문제의 정답률이 정확히 q% 가 되려면 남은 m 문제에서 몇 개를 맞혀야 하는지 역산",
    extraThinking: "목표 퍼센트에서 필요한 개수를 거꾸로 구하고 가능 범위(≤m)를 확인 — medium 은 부분÷전체 로 퍼센트 하나",
    concepts: ["퍼센트 계산", "목표 역산", "범위 확인"], mediumSteps: 2,
    generate(rng) {
      const n = rng.pick([10, 20, 25, 30, 40]), m = rng.pick([10, 15, 20, 25, 30, 40]); const T = n + m; const q = rng.pick([60, 65, 70, 75, 80, 85, 90]);
      if ((q * T) % 100 !== 0) throw new GenFail("x"); const need = (q * T) / 100; const x = rng.int(Math.floor(n * 0.4), Math.floor(n * 0.9)); const y = need - x;
      if (y < 1 || y > m || y === x) throw new GenFail("x");
      const [who, what, unit] = rng.pick([["Mia", "quiz questions", "correctly"], ["Noah", "practice problems", "correctly"], ["Ava", "free throws", "successfully"], ["Leo", "vocabulary words", "correctly"], ["Zoe", "puzzle pieces", "correctly"]]);
      const stimulus = spin(rng, `${who} [[answered|handled|completed]] ${x} of the first ${n} ${what} ${unit}. There are ${m} more ${what} to go.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEN, stimulus), question: spin(rng, `[[How many of the remaining ${m} ${what} must ${who} get right so that exactly ${q}% of all ${T} ${what} are right?|To end with exactly ${q}% of all ${what} correct, how many of the last ${m} must ${who} get right?|Find the number of the last ${m} ${what} that ${who} must get right so the overall rate is exactly ${q}%.]]`), correct: y,
        wrongs: [W((q * m) / 100, "condition_ignored", "남은 문제에서만 q% 를 맞히면 된다고 보았다."), W(need, "step_missing", "필요한 전체 정답 수를 답했다(이미 맞힌 수를 빼지 않음)."), W(y + 1, "other", "계산 실수."), W(need - Math.round((x * 100) / n) / 10, "other", "계산 실수."), W(m - y, "other", "틀려도 되는 개수를 답했다.")],
        verificationJs: withParams({ x, n, m, q }, "const out=[];\nfor(let y=0;y<=P.m;y++){ if(100*(P.x+y)===P.q*(P.n+P.m)) out.push(y); }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`전체 문제 수는 ${n} + ${m} = ${T} 이다.`, "Total number of questions."],
          [`목표 정답률 ${q}% 이면 정답 수는 ${T} × ${q / 100} = ${need} 이다.`, "Target number correct."],
          [`이미 ${x} 개를 맞혔으므로 더 필요한 정답은 ${need} − ${x} = ${y} 이다.`, "Subtract what is already correct."],
          [`${y} ≤ ${m} 이므로 가능하다.`, "Check feasibility."],
          [`따라서 남은 ${m} 문제 중 ${y} 개를 맞혀야 한다.`, "Conclude."],
        ],
        variant: "target_rate",
      });
      return out;
    },
  },
  {
    id: "pct.find_percent.chain2", skill: SKILL, kind: "find_percent", operator: "chain2",
    structure: "전체 N 중 A 명이 스포츠를 하고 그중 B 명이 단체 종목을 할 때, 전체에서 단체 종목을 하지 않는 학생의 퍼센트(기준량이 N 임을 유지)",
    extraThinking: "부분집합 안의 개수를 전체 기준 퍼센트로 바꾸고 보수까지 구함(기준량 혼동 방지) — medium 은 부분÷전체 한 번",
    concepts: ["부분집합 비율", "기준량 선택", "보수"], mediumSteps: 2,
    generate(rng) {
      const N = rng.pick([40, 50, 80, 100, 125, 200, 250, 400, 500]); const A = rng.int(Math.ceil(N * 0.3), Math.floor(N * 0.8)), B = rng.int(Math.ceil(A * 0.3), Math.floor(A * 0.8));
      if ((100 * B) % N !== 0 || A === B || (100 * B) / N > 70) throw new GenFail("x"); const share = (100 * B) / N;
      const c = rng.pick([
        { pop: "students in a grade", a: "played a school sport", b: "played a team sport", nb: "did not play a team sport" }, { pop: "employees at a firm", a: "joined a professional group", b: "attended its annual conference", nb: "did not attend the annual conference" },
        { pop: "residents of a building", a: "owned a vehicle", b: "owned an electric vehicle", nb: "did not own an electric vehicle" }, { pop: "members of a library", a: "borrowed a book this year", b: "borrowed an audiobook", nb: "did not borrow an audiobook" },
        { pop: "campers at a summer camp", a: "joined a water activity", b: "went kayaking", nb: "did not go kayaking" }, { pop: "customers at a cafe", a: "ordered a hot drink", b: "ordered a latte", nb: "did not order a latte" },
        { pop: "players in a chess league", a: "entered a tournament", b: "reached the final round", nb: "did not reach the final round" }, { pop: "visitors to a zoo", a: "watched an animal show", b: "stayed for the late show", nb: "did not stay for the late show" },
      ]);
      const stimulus = spin(rng, `Of the ${N} ${c.pop}, ${A} ${c.a}. Of those ${A}, ${B} ${c.b}.`);
      return finish(rng, {
        stimulus: withOpen(rng, OPEN_GROUP, stimulus), question: spin(rng, `[[What percent of all ${N} ${c.pop} ${c.nb}?|What percent of the ${N} ${c.pop} ${c.nb}?|Find the percent of all ${N} ${c.pop} who ${c.nb}.]]`), correct: 100 - share,
        wrongs: [W(share, "opposite", "'하지 않는' 비율이 아니라 하는 비율을 답했다."), W((100 * B) / A, "condition_ignored", "기준량을 전체 N 이 아니라 A 로 잡았다."), W(100 - (100 * B) / A, "condition_ignored", "A 기준 보수를 답했다."), W((100 * (A - B)) / N, "other", "A 중 하지 않는 사람의 비율만 구했다."), W((100 * A) / N, "step_missing", "A 의 비율을 답했다.")],
        verificationJs: withParams({ N, A, B }, "const done=100*P.B/P.N; return Math.round((100-done)*1e6)/1e6;"),
        trace: [
          [`단체 종목을 하는 사람은 ${B} 명이다.`, "Identify the numerator."],
          [`기준량은 전체 ${N} 명이다(${A} 명이 아님).`, "The base is the whole group."],
          [`${B} ÷ ${N} × 100 = ${share}% 이다.`, "Percent who do it."],
          [`하지 않는 사람의 비율은 100% − ${share}% 이다.`, "Take the complement."],
          [`따라서 ${100 - share}% 이다.`, "Answer."],
        ],
        variant: c.pop.split(" ")[0],
      });
    },
  },
  {
    id: "pct.find_percent.unit_ratio", skill: SKILL, kind: "find_percent", operator: "unit_ratio",
    structure: "cm 단위의 작은 직사각형과 m 단위의 큰 직사각형의 넓이 비를 단위를 맞춰(cm²↔m²) 퍼센트로 구함",
    extraThinking: "길이 단위 환산이 넓이에서는 제곱으로 적용됨을 알고 넓이 비를 퍼센트로 변환 — medium 은 같은 단위의 부분÷전체",
    concepts: ["넓이", "단위 환산(길이→넓이)", "퍼센트 역산"], mediumSteps: 2,
    generate(rng) {
      const c = rng.pick([
        { small: "rug", big: "floor", s: "A rug", b: "a floor", place: "is placed on" }, { small: "poster", big: "wall", s: "A poster", b: "a wall", place: "is hung on" },
        { small: "tablecloth", big: "tabletop", s: "A tablecloth", b: "a tabletop", place: "is laid over" }, { small: "photo", big: "display board", s: "A photo", b: "a display board", place: "is mounted on" },
        { small: "garden bed", big: "yard", s: "A garden bed", b: "a yard", place: "is built in" }, { small: "banner", big: "stage backdrop", s: "A banner", b: "a stage backdrop", place: "is attached to" },
      ]);
      const a = rng.int(5, 30) * 10, b = rng.int(5, 30) * 10, e = rng.int(2, 9), f = rng.int(2, 9);
      const area = a * b, big = e * f * 10000; const pct = (area * 100) / big;
      if (!Number.isInteger(pct) || pct < 2 || pct > 90 || a === b || e === f || Math.abs(pct - (a * b) / (e * f)) < 1) throw new GenFail("x");
      const stimulus = spin(rng, `${c.s} measures ${a} centimeters by ${b} centimeters. It ${c.place} ${c.b} that measures ${e} meters by ${f} meters.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GEO, stimulus), question: spin(rng, `[[What percent of the ${c.big}'s area does the ${c.small} cover?|The ${c.small} covers what percent of the area of the ${c.big}?|What percent of the ${c.big}'s area is covered by the ${c.small}?]]`), correct: pct,
        wrongs: [W((a * b) / (e * f), "unit_error", "cm 와 m 를 환산하지 않고 넓이를 나눴다."), W((a * b) / (e * f * 100), "unit_error", "넓이 단위를 환산한 뒤 ×100 을 빼먹었다."), W((a * b) / (e * f * 10), "unit_error", "넓이 환산을 길이 환산 계수(100)로만 한 것으로 처리했다."), W((a + b) / (e + f), "formula_misuse", "넓이 대신 길이의 합으로 비교했다."), W(pct * 10, "unit_error", "제곱 환산 계수를 틀렸다.")],
        verificationJs: withParams({ a, b, e, f }, "const small=P.a*P.b; const big=(P.e*100)*(P.f*100); return Math.round(small/big*100*1e6)/1e6;"),
        trace: [
          [`${c.small}의 넓이는 ${a} × ${b} = ${a * b} cm² 이다.`, "Area of the small rectangle in cm²."],
          [`${c.big}의 길이를 cm 로 바꾸면 ${e * 100} cm 와 ${f * 100} cm 이다.`, "Convert the big lengths to centimeters."],
          [`${c.big}의 넓이는 ${e * 100} × ${f * 100} = ${big} cm² 이다.`, "Area of the big rectangle in cm²."],
          [`단위가 같으므로 ${a * b} ÷ ${big} 를 구한다.`, "Divide with matching units."],
          [`${(a * b) / big} × 100 = ${pct}% 이다.`, "Convert to a percent."],
        ],
        variant: c.small.replace(/\s+/g, "_"),
      });
      return sem(out, [{ v: a, words: [c.small] }, { v: b, words: [c.small] }, { v: e, words: [c.big] }, { v: f, words: [c.big] }], { words: ["percent"] });
    },
  },
  {
    id: "pct.find_percent.constraint_select", skill: SKILL, kind: "find_percent", operator: "constraint_select",
    structure: "두 집단이 각각 정확히 p%, q% 이면서 인원이 정수가 되도록 하는 전체 인원 n 의 후보(기약분수 분모의 최소공배수의 배수) 중 조건 'n > L' 을 만족하는 최솟값",
    extraThinking: "퍼센트를 기약분수로 바꿔 정수 조건을 도출하고 범위 제약으로 후보를 고름 — medium 은 부분÷전체 로 퍼센트 계산",
    concepts: ["퍼센트→기약분수", "배수·최소공배수", "범위 제약"], mediumSteps: 2,
    generate(rng) {
      const ps = [4, 8, 12, 14, 16, 24, 28, 35, 36, 44, 45, 48, 55, 65, 75];
      const p = rng.pick(ps), q = rng.pick(ps); if (p === q) throw new GenFail("x");
      const d1 = 100 / gcd(p, 100), d2 = 100 / gcd(q, 100), L0 = lcm(d1, d2); if (L0 < 10 || L0 > 200 || d1 === d2) throw new GenFail("x");
      const lower = L0 * rng.int(1, 4) + rng.int(0, L0 - 1); const ans = (Math.floor(lower / L0) + 1) * L0; if (ans > 990 || lower < 30) throw new GenFail("x");
      const [pop, g1, g2] = rng.pick([["club", "seniors", "juniors"], ["orchestra", "string players", "brass players"], ["class", "left-handed students", "students with glasses"], ["choir", "tenors", "sopranos"], ["robotics team", "builders", "programmers"]]);
      const stimulus = spin(rng, `In a ${pop}, exactly ${p}% of the members are ${g1}, and exactly ${q}% are ${g2}. The number of members is a whole number greater than ${lower}, and the number of ${g1} and the number of ${g2} are also whole numbers.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_GROUP, stimulus), question: spin(rng, `[[What is the least possible number of members in the ${pop}?|What is the smallest number of members the ${pop} could have?|Find the minimum possible membership of the ${pop}.]]`), correct: ans,
        wrongs: [W(L0, "condition_ignored", "'greater than' 조건을 확인하지 않고 최소공배수를 답했다."), W(ans + L0, "other", "조건을 만족하는 첫 배수가 아니라 다음 배수를 답했다."), W(lower + 1, "condition_ignored", "퍼센트가 정수 인원이 되어야 한다는 조건을 무시했다."), W(Math.max(d1, d2) * (Math.floor(lower / Math.max(d1, d2)) + 1), "step_missing", "한 집단의 분모 조건만 사용했다."), W(d1 * d2 > 990 ? ans - L0 : d1 * d2, "formula_misuse", "두 분모를 최소공배수가 아니라 곱으로 처리했다.")],
        verificationJs: withParams({ p, q, lower }, "const out=[];\nfor(let n=P.lower+1;n<=2000;n++){ if((n*P.p)%100===0 && (n*P.q)%100===0){ out.push(n); break; } }\nif(out.length!==1) throw new Error('해 없음');\nreturn out[0];"),
        trace: [
          [`${p}% = ${p / gcd(p, 100)}/${d1} 이므로 인원이 정수이려면 전체가 ${d1} 의 배수여야 한다.`, "Reduce the first percentage."],
          [`${q}% = ${q / gcd(q, 100)}/${d2} 이므로 전체가 ${d2} 의 배수여야 한다.`, "Reduce the second percentage."],
          [`두 조건을 함께 만족하는 수는 ${d1} 과 ${d2} 의 최소공배수 ${L0} 의 배수이다.`, "Take the least common multiple."],
          [`후보는 ${L0}, ${2 * L0}, ${3 * L0}, … 이다.`, "List the candidates."],
          [`${lower} 보다 큰 첫 후보는 ${ans} 이다.`, "Apply the range constraint."],
        ],
        variant: "two_percentages",
      });
      return sem(out, [{ v: p, words: [g1] }, { v: q, words: [g2] }]);
    },
  },
  // ───────────── compound_change ─────────────
  {
    id: "pct.compound_change.inverse", skill: SKILL, kind: "compound_change", operator: "inverse",
    structure: "p% 인상 후 q% 할인된 최종 지불액 F 로부터 원래 가격 O=F·10⁴/((100+p)(100−q)) 를 역산해 할인액(인상가−F)을 구함",
    extraThinking: "연속 증감의 결과에서 거꾸로 기준량을 되돌리고 중간 값으로 할인액을 구함 — medium 은 순방향 합성 계산",
    concepts: ["연속 퍼센트 변화", "역산", "중간 단계 값"], mediumSteps: 4,
    generate(rng) {
      const p = rng.pick([10, 20, 25, 30, 40, 50]), q = rng.pick([10, 20, 25, 30, 40, 50]); const O = rng.pick([40, 80, 100, 120, 160, 200, 240, 300, 400, 500]);
      const M = (O * (100 + p)) / 100, F = (M * (100 - q)) / 100; const disc = M - F;
      if (!Number.isInteger(M) || !Number.isInteger(F) || disc < 5 || M > 990) throw new GenFail("x");
      const item = rng.pick([["a game console", "store"], ["a winter coat", "boutique"], ["a camera", "shop"], ["a desk", "showroom"], ["a pair of skis", "outfitter"]]);
      const stimulus = spin(rng, `A ${item[1]} first raised the price by ${p}% on ${item[0]} and then advertised ${q}% off the raised price. A customer paid ${F} dollars.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_MONEY, stimulus), question: spin(rng, `[[How many dollars was the discount?|What was the amount of the discount, in dollars?|By how many dollars was the raised price reduced?]]`), correct: disc,
        wrongs: [W((F * q) / 100, "condition_ignored", "할인액을 지불한 금액의 q% 로 계산했다."), W((O * q) / 100, "condition_ignored", "할인액을 원래 가격의 q% 로 계산했다."), W(M - O, "other", "인상액을 답했다."), W(O - F, "other", "원래 가격과 지불액의 차를 답했다."), W((M * q) / 100 - (M - O), "other", "계산 실수.")],
        verificationJs: withParams({ p, q, F }, "const out=[];\nfor(let o=1;o<=3000;o++){ if(o*(100+P.p)*(100-P.q)===P.F*10000){ const m=o*(100+P.p)/100; if(!Number.isInteger(m)) throw new Error('정수 아님'); out.push(m-P.F); } }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [
          [`원래 가격을 O 라 하면 인상 후 ${100 + p}%, 할인 후 ${100 - q}% 가 곱해진다.`, "Write the two multipliers."],
          [`O × ${(100 + p) / 100} × ${(100 - q) / 100} = ${F} 이다.`, "Set up the equation."],
          [`O = ${F} ÷ ${((100 + p) * (100 - q)) / 10000} = ${O} 이다.`, "Undo both changes."],
          [`인상 후 가격은 ${O} × ${(100 + p) / 100} = ${M} 이다.`, "The raised price."],
          [`할인은 인상 후 가격 기준이므로 할인액은 ${M} − ${F} = ${disc} 이다.`, "The discount is on the raised price."],
        ],
        variant: "raise_discount_amount",
      });
      return sem(out, [{ v: p, words: UP, pct: true }, { v: q, words: DOWN, pct: true }], { words: ["dollars"] });
    },
  },
  {
    id: "pct.compound_change.chain2", skill: SKILL, kind: "compound_change", operator: "chain2",
    structure: "매년 같은 비율로 변하는 값이 처음 A, 2년 뒤 B 일 때 B/A=m² 에서 연 변화 배수 m 을 구해 3년 뒤 값 A·m³ 를 계산",
    extraThinking: "복리 구조에서 연 변화율을 제곱근으로 되돌리고 한 해를 더 합성 — medium 은 주어진 두 변화율의 순방향 합성",
    concepts: ["복리(연속 퍼센트)", "제곱근 역산", "추가 합성"], mediumSteps: 4,
    generate(rng) {
      const opts = [{ n: 6, d: 5, base: 125 }, { n: 5, d: 4, base: 64 }, { n: 3, d: 2, base: 8 }, { n: 4, d: 5, base: 125 }, { n: 3, d: 4, base: 64 }, { n: 5, d: 6, base: 216 }, { n: 7, d: 5, base: 25 }];
      const o = rng.pick(opts); const A = o.base * rng.int(1, 8) * (o.d === 5 && o.n === 7 ? 5 : 1);
      const B = (A * o.n * o.n) / (o.d * o.d), C = (A * o.n ** 3) / (o.d ** 3); if (!Number.isInteger(B) || !Number.isInteger(C) || A > 990 || C > 990 || B === A) throw new GenFail("x");
      const up = o.n > o.d; const [ent, unit, per] = rng.pick([["An investment fund", "dollars", "year"], ["A bacteria culture", "thousand cells", "hour"], ["A social media account", "followers", "month"], ["A used car's value", "hundred dollars", "year"], ["A city's population", "thousand residents", "decade"]]);
      const stimulus = spin(rng, `${ent} ${up ? "grows" : "shrinks"} by the same percent every ${per}. It starts at ${A} ${unit} and is ${B} ${unit} after two ${per}s.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_MONEY, stimulus), question: spin(rng, `[[How many ${unit} will it be after three ${per}s?|What is the value, in ${unit}, after three ${per}s in all?|Find the value, in ${unit}, at the end of the third ${per}.]]`), correct: C,
        wrongs: [W(B + (B - A) / 2, "formula_misuse", "매 기간 같은 '양'만큼 변한다고 보고 선형으로 연장했다."), W(B + (B - A), "formula_misuse", "2기간 변화량을 그대로 더했다."), W((B * B) / A, "step_missing", "연 변화 배수가 아니라 2기간 배수를 한 번 더 곱했다."), W(A + 1.5 * (B - A), "formula_misuse", "3기간을 1.5 × (2기간 변화량)으로 계산했다."), W(Math.round(B * (B / A)) , "other", "2기간 배수를 한 해의 배수로 착각했다.")],
        verificationJs: withParams({ A, B }, "const out=[];\nfor(let den=1;den<=12;den++) for(let num=1;num<=24;num++){ if(P.A*num*num===P.B*den*den){ const c=P.B*num; if(c%den===0) out.push(c/den); } }\nif(out.length<1) throw new Error('해 없음');\nreturn out[0];"),
        trace: [
          [`2기간 동안의 배수는 ${B} ÷ ${A} = ${B / A} 이다.`, "Two-period multiplier."],
          [`매 기간 같은 배수 m 이므로 m² = ${B / A} 이다.`, "m squared equals the ratio."],
          [`제곱근을 취하면 m = ${o.n}/${o.d} 이다(양수).`, "Take the square root."],
          [`한 기간에 ${up ? "증가" : "감소"}하는 비율은 ${(Math.abs(o.n - o.d) * 100) / o.d}% 이다.`, "Read the percent rate."],
          [`3번째 기간 값은 ${B} × ${o.n}/${o.d} = ${C} 이다.`, "Apply one more period."],
        ],
        variant: up ? "growth" : "decay",
      });
      return out;
    },
  },
  {
    id: "pct.compound_change.compare_scenarios", skill: SKILL, kind: "compound_change", operator: "compare_scenarios",
    structure: "p% 와 q% 의 연속 할인을 (p+q)% 한 번 할인으로 착각한 예상 가격과 실제 가격의 차이를 달러로 구함",
    extraThinking: "연속 할인은 각각 새 기준량에 적용되어 단순 합과 다르다는 점을 두 가격의 비교로 확인 — medium 은 순방향 합성 한 번",
    concepts: ["연속 퍼센트 변화", "단순 합산 착오", "두 값의 비교"], mediumSteps: 4,
    generate(rng) {
      const p = rng.pick([10, 15, 20, 25, 30, 40, 50]), q = rng.pick([10, 15, 20, 25, 30, 40, 50]); const L = rng.pick([100, 120, 160, 200, 240, 250, 300, 400, 500, 600, 800]);
      const actual = (L * (100 - p) * (100 - q)) / 10000, naive = (L * (100 - p - q)) / 100; const diff = actual - naive;
      if (!Number.isInteger(actual) || !Number.isInteger(naive) || diff < 2 || p + q >= 100) throw new GenFail("x");
      const [item, st] = rng.pick([["a jacket", "A clothing store"], ["a laptop bag", "An outlet"], ["a set of dishes", "A department store"], ["a treadmill", "A sporting goods store"], ["a guitar", "A music shop"]]);
      const stimulus = spin(rng, `${st} sells ${item} with a list price of ${L} dollars. [[A customer takes a ${p}% discount and then a further ${q}% discount off the reduced price.|The price is cut by ${p}%, and the new price is cut by another ${q}%.|The item is marked down ${p}%, and then the marked-down price is reduced ${q}% more.]] The customer expected the two discounts to add up to a single ${p + q}% discount.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_MONEY, stimulus), question: spin(rng, `[[How many dollars more does the customer actually pay than expected?|The actual price is how many dollars higher than the expected price?|By how many dollars does the actual price exceed the expected price?]]`), correct: diff,
        wrongs: [W((L * (p + q)) / 100, "other", "예상 할인액을 답했다."), W(L - actual, "other", "실제 할인액을 답했다."), W(actual, "step_missing", "실제 가격을 답했다."), W(naive, "step_missing", "예상 가격을 답했다."), W((L * Math.abs(p - q)) / 100, "formula_misuse", "두 할인율의 차로 계산했다.")],
        verificationJs: withParams({ L, p, q }, "const actual=P.L*(100-P.p)*(100-P.q); const naive=P.L*(100-P.p-P.q)*100; return (actual-naive)/10000;"),
        trace: [
          [`예상 가격은 ${L} × (1 − ${(p + q) / 100}) = ${naive} 이다.`, "Expected price with one combined discount."],
          [`첫 할인 후 가격은 ${L} × ${(100 - p) / 100} = ${(L * (100 - p)) / 100} 이다.`, "After the first discount."],
          [`둘째 할인은 이 가격의 ${q}% 이므로 ${(L * (100 - p)) / 100} × ${(100 - q) / 100} 이다.`, "The second discount uses the new base."],
          [`실제 가격은 ${actual} 이다.`, "Actual price."],
          [`차이는 ${actual} − ${naive} = ${diff} 이다.`, "Compare."],
        ],
        variant: "two_discounts_vs_sum",
      });
      return sem(out, [{ v: p, words: [...DOWN, "marked"] }, { v: q, words: [...DOWN, "marked"] }, { v: p + q, words: [...DOWN, "marked"] }], { words: ["dollars"] });
    },
  },
  {
    id: "pct.compound_change.repr_shift", skill: SKILL, kind: "compound_change", operator: "repr_shift",
    structure: "지수 모델 N(t)=A·b^t 에서 한 기간 배수 b 를 읽어 k 기간 동안의 전체 변화율 (b^k − 1)×100 을 구함",
    extraThinking: "지수식의 밑을 한 기간 퍼센트 변화로 해석하고 k 기간으로 합성(단순 합 k×r 이 아님) — medium 은 두 퍼센트의 순방향 합성",
    concepts: ["지수 모델 읽기", "연속 퍼센트 변화", "배수→퍼센트 변환"], mediumSteps: 4,
    generate(rng) {
      const b = rng.pick([1.1, 1.2, 1.5, 0.9, 0.8, 0.5, 1.4, 1.3]); const k = rng.pick([2, 3]); const A = rng.pick([40, 50, 100, 120, 200, 250, 400]);
      const total = Math.round((Math.pow(b, k) - 1) * 1000) / 10; if (!Number.isFinite(total) || Math.abs(total * 10 - Math.round(total * 10)) > 1e-9 || Math.abs(total) > 300) throw new GenFail("x");
      const r = Math.round((b - 1) * 1000) / 10;
      const [fn, quantity, per, pers] = rng.pick([["N", "bacteria in a culture", "hour", "hours"], ["P", "fish in a pond", "month", "months"], ["V", "the value of a machine, in hundreds of dollars", "year", "years"], ["S", "subscribers to a newsletter", "week", "weeks"], ["C", "the concentration of a medicine, in milligrams per liter", "hour", "hours"]]);
      const stimulus = spin(rng, `[[A model gives|The model below gives|The following model describes]] ${quantity} after t ${pers}: $${fn}(t) = ${A}(${b})^t$.`);
      const out = finish(rng, {
        stimulus: withOpen(rng, OPEN_SCI, stimulus), question: spin(rng, `[[By what percent does the quantity change over the first ${k} ${pers}? (Use a negative number for a decrease.)|What is the percent change over the first ${k} ${pers}? Use a negative number for a decrease.|Over the first ${k} ${pers}, by what percent does it change? A decrease should be given as a negative number.]]`), correct: total,
        wrongs: [W(r * k, "formula_misuse", "한 기간의 변화율에 기간 수를 곱했다(복리 합성이 아님)."), W(r, "step_missing", "한 기간의 변화율만 답했다."), W(Math.round(Math.pow(b, k) * 1000) / 10, "unit_error", "최종 배수를 퍼센트 변화로 바꾸지 않았다(−100%p 를 빼먹음)."), W(-total, "sign_error", "증감 방향의 부호를 반대로 적었다."), W(Math.round((Math.pow(b, k + 1) - 1) * 1000) / 10, "other", "기간 수를 하나 더 합성했다.")],
        verificationJs: withParams({ b, k }, "let m=1; for(let i=0;i<P.k;i++) m*=P.b; return Math.round((m-1)*1000)/10;"),
        trace: [
          [`식 ${fn}(t) = ${A}(${b})^t 에서 한 ${per}당 곱해지는 수는 ${b} 이다.`, "Read the base of the exponential."],
          [`한 ${per}에 ${r >= 0 ? "" : "−"}${Math.abs(r)}% ${r >= 0 ? "증가" : "감소"}하는 것과 같다.`, "Interpret it as a percent per period."],
          [`${k}${per === "hour" ? "시간" : per === "month" ? "개월" : per === "year" ? "년" : "주"} 동안은 ${b} 를 ${k} 번 곱한다.`, "Compose over k periods."],
          [`${b}^${k} = ${Math.round(Math.pow(b, k) * 1000) / 1000} 이다.`, "Compute the multiplier."],
          [`전체 변화율 = (${Math.round(Math.pow(b, k) * 1000) / 1000} − 1) × 100 = ${total}% 이다.`, "Convert to a percent change."],
        ],
        variant: `${k}_periods`,
      });
      return out;
    },
  },
];

// ───────────────────────── easy / medium 원형(lite) — 10개 틀 ─────────────────────────
const EP = [10, 20, 25, 50, 5], MP = [15, 30, 35, 40, 60, 75, 12, 45];
const pctOf = (rng: Rng, level: Level) => rng.pick(level === "easy" ? EP : MP);
const baseOf = (rng: Rng, level: Level) => rng.int(2, level === "easy" ? 15 : 24) * 20;
type Pair = readonly [string, string, string];
const PEOPLE: Pair[] = [["students in a school", "walk to school", "do not walk to school"], ["members of a gym", "attend morning classes", "do not attend morning classes"], ["customers surveyed", "prefer online shopping", "do not prefer online shopping"],
  ["voters in a town", "supported the new park", "did not support the new park"], ["players in a league", "scored at least one goal", "did not score a goal"], ["employees at a firm", "take the train to work", "do not take the train to work"],
  ["residents of a village", "own a bicycle", "do not own a bicycle"], ["visitors to a fair", "arrived before noon", "arrived after noon"], ["campers at a lake", "joined the swim lesson", "did not join the swim lesson"], ["readers of a magazine", "subscribe to the digital edition", "do not subscribe to the digital edition"]];
const ITEMS = ["a jacket", "a pair of sneakers", "a backpack", "a desk lamp", "a set of paints", "a bicycle helmet", "a board game", "a winter hat", "a camera strap", "a water bottle", "a calculator", "a guitar case"];
const STORES = ["a sporting goods store", "an online shop", "a department store", "a neighborhood boutique", "a school supply store", "a hardware store"];

export const PCT_LITE: LiteArchetype[] = [
  {
    id: "pct.percent_of.count", skill: SKILL, kind: "percent_of", frame: "count", levels: ["easy", "medium"], structure: "집단 N 의 p% 가 속한 인원(easy) / 속하지 않는 인원(medium)",
    generate(rng, level) {
      const p = pctOf(rng, level), N = baseOf(rng, level), [pop, pos, neg] = rng.pick(PEOPLE); const k = (N * p) / 100; if (!Number.isInteger(k) || k < 2) throw new GenFail("x");
      const ans = level === "easy" ? k : N - k;
      const stimulus = withOpen(rng, OPEN_GROUP, spin(rng, `[[A survey of|A poll of|A sample of]] ${N} ${pop} [[found that|showed that|reported that]] ${p}% of them ${pos}.`));
      return finish(rng, { stimulus, question: spin(rng, level === "easy" ? `[[How many of them ${pos}?|How many of the ${N} ${pop} ${pos}?|Find the number of them who ${pos}.]]` : `[[How many of them ${neg}?|How many of the ${N} ${pop} ${neg}?|Find the number of them who ${neg}.]]`), correct: ans,
        wrongs: [W(level === "easy" ? N - k : k, "opposite", "묻는 집단의 반대 집단 수를 답했다."), W((p * N) / 10, "unit_error", "p% 를 100 이 아니라 10 으로 나눴다."), W(p * N, "unit_error", "%를 소수로 바꾸지 않고 곱했다."), W(N - p, "formula_misuse", "퍼센트 값을 인원에서 그대로 뺐다.")],
        verificationJs: withParams({ N, p, ask: level === "easy" ? 1 : 0 }, "let c=0; for(let i=1;i<=P.N;i++){ if(i*100<=P.p*P.N) c++; }\nreturn P.ask? c : P.N-c;"),
        trace: [[`${N}의 ${p}% = ${N} × ${p / 100} = ${k} 이다.`, "Take the percent of the whole."], ...(level === "easy" ? [] : [[`나머지는 ${N} − ${k} = ${N - k} 이다.`, "Subtract from the total."] as [string, string]])], variant: level === "easy" ? "group" : "complement" });
    },
  },
  {
    id: "pct.percent_of.price", skill: SKILL, kind: "percent_of", frame: "price", levels: ["easy", "medium"], structure: "정가 N 의 p% 할인액(easy) / 할인 후 판매가(medium)",
    generate(rng, level) {
      const p = pctOf(rng, level), N = baseOf(rng, level), item = rng.pick(ITEMS), st = rng.pick(STORES); const d = (N * p) / 100; if (!Number.isInteger(d) || d < 2) throw new GenFail("x");
      const ans = level === "easy" ? d : N - d;
      const stimulus = withOpen(rng, OPEN_MONEY, spin(rng, `${item[0].toUpperCase() + item.slice(1)} at ${st} [[is regularly priced at|has a regular price of|normally costs]] ${N} dollars. [[This week, the store is taking|The store is offering|There is a sale of]] ${p}% off the regular price.`));
      const out = finish(rng, { stimulus, question: spin(rng, level === "easy" ? "[[How many dollars is the discount?|What is the amount of the discount, in dollars?|By how many dollars is the price reduced?]]" : "[[What is the sale price, in dollars?|How many dollars does the item cost during the sale?|Find the price after the discount, in dollars.]]"), correct: ans,
        wrongs: [W(level === "easy" ? N - d : d, "step_missing", level === "easy" ? "할인 후 가격을 답했다." : "할인액만 구했다."), W(N * p, "unit_error", "%를 소수로 바꾸지 않았다."), W(N - p, "formula_misuse", "퍼센트 값을 달러에서 그대로 뺐다."), W((N * p) / 1000, "unit_error", "p% 를 1000 으로 나눴다.")],
        verificationJs: withParams({ N, p, ask: level === "easy" ? 1 : 0 }, "const d=P.N*P.p/100; return P.ask? d : P.N-d;"),
        trace: [[`할인액 = ${N} × ${p / 100} = ${d} 달러이다.`, "Compute the discount."], ...(level === "easy" ? [] : [[`판매가 = ${N} − ${d} = ${N - d} 달러이다.`, "Subtract the discount."] as [string, string]])], variant: level === "easy" ? "discount_amount" : "sale_price" });
      return sem(out, [{ v: p, words: DOWN, pct: true }], { words: level === "easy" ? ["discount", "reduced"] : ["price", "cost"] });
    },
  },
  {
    id: "pct.find_whole.members", skill: SKILL, kind: "find_whole", frame: "members", levels: ["easy", "medium"], structure: "p% 가 k 명 → 전체(easy) / 나머지 (100−p)% 가 k 명 → 전체(medium)",
    generate(rng, level) {
      const p = rng.pick(level === "easy" ? [10, 20, 25, 50] : [20, 25, 30, 40, 60, 75]), [pop, pos, neg] = rng.pick(PEOPLE); const Nn = baseOf(rng, level); const part = (Nn * (level === "easy" ? p : 100 - p)) / 100; if (!Number.isInteger(part) || part < 3) throw new GenFail("x");
      const stimulus = withOpen(rng, OPEN_GROUP, level === "easy" ? spin(rng, `[[Exactly|Precisely]] ${p}% of the ${pop} ${pos}. [[That is|This is|In all,]] ${part} [[people|of them]].`) : spin(rng, `[[Exactly|Precisely]] ${p}% of the ${pop} ${pos}. The other ${part} [[people|of them]] ${neg}.`));
      return finish(rng, { stimulus, question: spin(rng, `[[How many ${pop} are there in all?|What is the total number of ${pop}?|Find the total number of ${pop}.]]`), correct: Nn,
        wrongs: [W(part, "step_missing", "구한 부분 인원을 전체로 답했다."), W((part * p) / 100, "formula_misuse", "부분에 p% 를 곱했다."), W(part + p, "formula_misuse", "부분과 퍼센트를 더했다."), W((part * 100) / (level === "easy" ? 100 - p : p), "condition_ignored", "퍼센트와 반대 집단의 인원을 짝지었다.")],
        verificationJs: withParams({ p, part, easy: level === "easy" ? 1 : 0 }, "const q=P.easy?P.p:100-P.p; for(let n=1;n<=3000;n++){ if(n*q===P.part*100) return n; }\nthrow new Error('없음');"),
        trace: [[level === "easy" ? `${part} 명이 전체의 ${p}% 이다.` : `나머지 ${part} 명은 전체의 ${100 - p}% 이다.`, "Match the part with its percent."], [`전체 = ${part} ÷ ${(level === "easy" ? p : 100 - p) / 100} = ${Nn} 이다.`, "Divide by the decimal."]], variant: level === "easy" ? "part_is_p" : "part_is_rest" });
    },
  },
  {
    id: "pct.find_whole.number", skill: SKILL, kind: "find_whole", frame: "number", levels: ["easy", "medium"], structure: "k 가 p% 인 수(easy) / p% 증가해 B 가 된 원래 값(medium)",
    generate(rng, level) {
      const p = rng.pick(level === "easy" ? [10, 20, 25, 50] : [10, 20, 25, 30, 40, 50]), Wt = rng.int(2, level === "easy" ? 15 : 25) * 20; const ctx = rng.pick([["tickets were sold for a play", "the tickets available", "tickets were available"], ["pages of a novel have been read", "the pages in the novel", "pages are in the novel"], ["laps of a race have been completed", "the laps in the race", "laps are in the race"], ["seats in a hall are filled", "the seats in the hall", "seats are in the hall"], ["bottles were collected at a recycling drive", "the bottles in the town", "bottles are in the town"], ["seedlings have sprouted in a greenhouse", "the seedlings planted", "seedlings were planted"]] as const);
      const part = (Wt * p) / 100, B = (Wt * (100 + p)) / 100; if (!Number.isInteger(part) || !Number.isInteger(B) || B > 990) throw new GenFail("x");
      const [ent, unit] = rng.pick([["A town's population", "residents"], ["A club's membership", "members"], ["A school's enrollment", "students"], ["A library's collection", "books"]]);
      const stimulus = withOpen(rng, OPEN_GROUP, level === "easy" ? spin(rng, `${part} ${ctx[0]}, which is ${p}% of ${ctx[1]}.`) : spin(rng, `${ent} [[grew|rose|increased]] by ${p}% this year and is now ${B} ${unit}.`));
      return finish(rng, { stimulus, question: level === "easy" ? spin(rng, `[[How many ${ctx[2]} in all?|What is the total number of ${ctx[2].split(" ")[0]} that ${ctx[2].split(" ").slice(1).join(" ")}?|Find how many ${ctx[2]}.]]`) : spin(rng, `[[How many ${unit} were there before the increase?|What was the number of ${unit} last year?|Find the original number of ${unit}.]]`), correct: Wt,
        wrongs: level === "easy" ? [W(part * p, "formula_misuse", "부분에 퍼센트를 곱했다."), W(part + p, "formula_misuse", "부분에 퍼센트를 더했다."), W((part * p) / 100, "unit_error", "부분의 p% 를 구했다."), W(part * 10, "unit_error", "전체를 10 배로 계산했다.")]
          : [W(B - (B * p) / 100, "condition_ignored", "증가한 값에서 p% 를 빼서 원래 값을 구했다."), W(B - p, "formula_misuse", "퍼센트를 값에서 그대로 뺐다."), W((B * (100 - p)) / 100 - 1, "other", "계산 실수."), W(B / (p / 100), "formula_misuse", "증가한 값을 p% 로 나눴다.")],
        verificationJs: withParams(level === "easy" ? { part, p } : { B, p }, level === "easy" ? "for(let n=1;n<=3000;n++){ if(n*P.p===P.part*100) return n; }\nthrow new Error('없음');" : "for(let n=1;n<=3000;n++){ if(n*(100+P.p)===P.B*100) return n; }\nthrow new Error('없음');"),
        trace: level === "easy" ? [[`${part} 은 전체의 ${p}% 이다.`, "The part is p% of the total."], [`전체 = ${part} ÷ ${p / 100} = ${Wt} 이다.`, "Divide."]] : [[`현재 값은 원래 값의 ${100 + p}% 이다.`, "The new value is (100+p)% of the original."], [`원래 값 = ${B} ÷ ${(100 + p) / 100} = ${Wt} 이다.`, "Divide."]], variant: level === "easy" ? "part_of_total" : "after_increase" });
    },
  },
  {
    id: "pct.percent_change.table", skill: SKILL, kind: "percent_change", frame: "table", levels: ["easy", "medium"], structure: "a 에서 b 로 변한 증가율(easy) / 증가·감소 모두(medium)",
    generate(rng, level) {
      const a = rng.int(2, 20) * 20, p = rng.pick(level === "easy" ? EP : MP), up = level === "easy" ? true : rng.chance(0.5); const delta = (a * p) / 100; if (!Number.isInteger(delta) || delta < 2) throw new GenFail("x"); const b = up ? a + delta : a - delta;
      const [what, unit] = rng.pick([["The number of students in a club", "students"], ["A store's weekly sales", "items"], ["The attendance at a game", "fans"], ["A website's daily visitors", "visitors"], ["The enrollment in a course", "students"], ["A shop's monthly orders", "orders"]]);
      const stimulus = withOpen(rng, OPEN_GROUP, spin(rng, `${what} ${up ? "[[rose|increased|went up]]" : "[[fell|decreased|went down]]"} from ${a} to ${b} ${unit}.`));
      return finish(rng, { stimulus, question: spin(rng, `[[By what percent did it ${up ? "increase" : "decrease"}?|What was the percent ${up ? "increase" : "decrease"}?|Find the percent ${up ? "increase" : "decrease"}.]]`), correct: p,
        wrongs: [W((100 * delta) / b, "condition_ignored", "기준량을 처음 값이 아니라 나중 값으로 잡았다."), W(100 - p, "other", "남은 비율을 변화율로 답했다."), W(delta, "step_missing", "변화량을 퍼센트로 바꾸지 않았다."), W((100 * delta) / (a + b), "formula_misuse", "평균을 기준량으로 잡았다.")],
        verificationJs: withParams({ a, b }, "return Math.round(Math.abs(P.b-P.a)/P.a*100*1e6)/1e6;"),
        trace: [[`변화량은 |${b} − ${a}| = ${delta} 이다.`, "Find the change."], [`변화율 = ${delta} ÷ ${a} × 100 = ${p}% 이다.`, "Divide by the original and convert."]], variant: up ? "increase" : "decrease" });
    },
  },
  {
    id: "pct.percent_change.forward", skill: SKILL, kind: "percent_change", frame: "forward", levels: ["easy", "medium"], structure: "p% 인상 후 가격(easy) / 인상 후 쿠폰 차감 후 가격(medium)",
    generate(rng, level) {
      const p = pctOf(rng, level), a = baseOf(rng, level), item = rng.pick(ITEMS), st = rng.pick(STORES); const nw = a + (a * p) / 100; if (!Number.isInteger(nw)) throw new GenFail("x");
      const cpn = level === "easy" ? 0 : rng.pick([5, 10, 15, 20]); const ans = nw - cpn;
      const stimulus = withOpen(rng, OPEN_MONEY, spin(rng, `${st[0].toUpperCase() + st.slice(1)} [[raised|increased]] the price of ${item} by ${p}%. The old price was ${a} dollars.${level === "easy" ? "" : ` A customer then used a coupon worth ${cpn} dollars.`}`));
      const out = finish(rng, { stimulus, question: spin(rng, level === "easy" ? "[[What is the new price, in dollars?|How many dollars does the item cost now?|Find the new price in dollars.]]" : "[[How many dollars does the customer pay?|What is the final amount paid, in dollars?|Find the total the customer pays, in dollars.]]"), correct: ans,
        wrongs: [W(a - (a * p) / 100 - cpn, "sign_error", "인상을 인하로 계산했다."), W((a * p) / 100 + cpn, "step_missing", "인상액만 구했다."), W(a + p - cpn, "formula_misuse", "퍼센트를 달러로 그대로 더했다."), W(level === "easy" ? (a * p) / 100 : nw, "step_missing", level === "easy" ? "인상액만 답했다." : "쿠폰을 반영하지 않았다.")],
        verificationJs: withParams({ a, p, cpn }, "return P.a*(100+P.p)/100-P.cpn;"),
        trace: [[`인상액 = ${a} × ${p / 100} = ${(a * p) / 100} 이다.`, "Compute the increase."], [`새 가격 = ${a} + ${(a * p) / 100} = ${nw} 달러이다.`, "Add it."], ...(level === "easy" ? [] : [[`쿠폰을 빼면 ${nw} − ${cpn} = ${ans} 달러이다.`, "Subtract the coupon."] as [string, string]])], variant: level === "easy" ? "new_price" : "after_coupon" });
      return sem(out, [{ v: p, words: UP, pct: true }], { words: level === "easy" ? ["price", "cost"] : ["pay", "paid", "amount"] });
    },
  },
  {
    id: "pct.find_percent.share", skill: SKILL, kind: "find_percent", frame: "share", levels: ["easy", "medium"], structure: "k 명이 전체 N 의 몇 %(easy) / 속하지 않는 비율(medium)",
    generate(rng, level) {
      const p = rng.pick(level === "easy" ? [10, 20, 25, 50, 5] : [15, 30, 35, 40, 60, 75, 12, 45]), N = baseOf(rng, level), [pop, pos, neg] = rng.pick(PEOPLE); const k = (N * p) / 100; if (!Number.isInteger(k) || k < 2) throw new GenFail("x");
      const stimulus = withOpen(rng, OPEN_GROUP, spin(rng, `[[Of|Among]] ${N} ${pop}, ${k} ${pos}.`));
      const ans = level === "easy" ? p : 100 - p;
      return finish(rng, { stimulus, question: spin(rng, level === "easy" ? `[[What percent of the ${pop} ${pos}?|What percent of them ${pos}?|Find the percent of the ${N} ${pop} who ${pos}.]]` : `[[What percent of the ${pop} ${neg}?|What percent of them ${neg}?|Find the percent of the ${N} ${pop} who ${neg}.]]`), correct: ans,
        wrongs: [W(level === "easy" ? 100 - p : p, "opposite", "묻는 집단의 반대 비율을 답했다."), W((100 * N) / k, "formula_misuse", "전체÷부분으로 비율을 뒤집었다."), W(k / N, "unit_error", "100 을 곱하지 않았다."), W((100 * k) / (N - k), "condition_ignored", "나머지를 기준량으로 잡았다."), W(k, "step_missing", "해당 인원 수를 답했다."), W(N - k, "step_missing", "나머지 인원 수를 답했다.")],
        verificationJs: withParams({ k, N, ask: level === "easy" ? 1 : 0 }, "const p=P.k/P.N*100; return Math.round((P.ask? p : 100-p)*1e6)/1e6;"),
        trace: [[`${k} ÷ ${N} × 100 = ${p}% 이다.`, "Part over whole times 100."], ...(level === "easy" ? [] : [[`나머지는 100 − ${p} = ${100 - p}% 이다.`, "Take the complement."] as [string, string]])], variant: level === "easy" ? "share" : "complement_share" });
    },
  },
  {
    id: "pct.find_percent.score", skill: SKILL, kind: "find_percent", frame: "score", levels: ["easy", "medium"], structure: "맞힌 개수/전체(easy) / 틀린 개수가 주어진 정답률(medium)",
    generate(rng, level) {
      const n = rng.pick(level === "easy" ? [20, 25, 40, 50] : [20, 25, 40, 50, 60, 80]), p = rng.pick(level === "easy" ? [50, 60, 70, 80, 90] : [65, 72, 85, 88, 92, 95, 75, 64]); const right = (n * p) / 100; if (!Number.isInteger(right)) throw new GenFail("x");
      const [who, items, act] = rng.pick([["Mia", "quiz questions", "answered"], ["Noah", "spelling words", "spelled"], ["Ava", "practice problems", "solved"], ["Leo", "vocabulary cards", "knew"], ["Zoe", "history questions", "answered"]]);
      const stimulus = withOpen(rng, OPEN_GEN, spin(rng, level === "easy" ? `${who} ${act} ${right} of ${n} ${items} correctly.` : `On a set of ${n} ${items}, ${who} ${act} ${n - right} incorrectly and the rest correctly.`));
      return finish(rng, { stimulus, question: spin(rng, `[[What percent of the ${items} did ${who} get right?|What was ${who}'s percent score?|Find the percent of ${items} answered correctly.]]`), correct: p,
        wrongs: [W(100 - p, "opposite", "틀린 비율을 답했다."), W(level === "easy" ? (100 * right) / (n - right) : (100 * (n - right)) / right, "condition_ignored", "기준량을 전체가 아닌 다른 값으로 잡았다."), W(right / n, "unit_error", "100 을 곱하지 않았다."), W(right, "step_missing", "맞힌 개수를 퍼센트로 답했다."), W(n - right, "step_missing", "틀린 개수를 답했다.")],
        verificationJs: withParams({ n, right }, "return Math.round(P.right/P.n*100*1e6)/1e6;"),
        trace: [...(level === "easy" ? [] : [[`맞힌 개수는 ${n} − ${n - right} = ${right} 이다.`, "Find the number right."] as [string, string]]), [`${right} ÷ ${n} × 100 = ${p}% 이다.`, "Part over whole times 100."]], variant: level === "easy" ? "right_given" : "wrong_given" });
    },
  },
  {
    id: "pct.compound_change.twostep", skill: SKILL, kind: "compound_change", frame: "twostep", levels: ["easy", "medium"], structure: "p% 증가 후 q% 감소한 최종값(easy) / 전체 변화율(medium)",
    generate(rng, level) {
      const p = rng.pick([10, 20, 25, 50, 40]), q = rng.pick([10, 20, 25, 50]); const v0 = rng.pick([100, 200, 400, 500, 800, 160, 240]); const v1 = (v0 * (100 + p)) / 100, v2 = (v1 * (100 - q)) / 100;
      if (!Number.isInteger(v1) || !Number.isInteger(v2) || v2 === v0) throw new GenFail("x"); const net = ((v2 - v0) * 100) / v0; if (level === "medium" && !Number.isInteger(net)) throw new GenFail("x");
      const [ent, unit, vb] = rng.pick([["A video's views", "views", ["rose", "then fell"]], ["A town's population", "residents", ["grew", "then shrank"]], ["A stock's price", "dollars", ["went up", "then went down"]], ["A club's savings", "dollars", ["increased", "then decreased"]]] as const);
      const stimulus = withOpen(rng, OPEN_GROUP, spin(rng, `${ent} started at ${v0} ${unit}. It ${vb[0]} by ${p}% and ${vb[1]} by ${q}%.`));
      const out = finish(rng, { stimulus, question: spin(rng, level === "easy" ? "[[What is the final value?|What is the value after both changes?|Find the value at the end.]]" : "[[What is the overall percent change from the starting value? (Use a negative number for a decrease.)|By what percent did the value change overall? Use a negative number for a decrease.|Find the overall percent change, using a negative number for a decrease.]]"), correct: level === "easy" ? v2 : net,
        wrongs: level === "easy" ? [W(v0 + (v0 * (p - q)) / 100, "formula_misuse", "두 퍼센트를 더하고 빼서 한 번에 적용했다."), W(v1, "step_missing", "두 번째 변화를 적용하지 않았다."), W((v0 * (100 - q)) / 100, "condition_ignored", "두 번째 변화를 처음 값에 적용했다."), W(v0 - (v1 - v2), "other", "증가분과 감소분의 차를 잘못 적용했다.")]
          : [W(p - q, "formula_misuse", "두 퍼센트를 단순히 뺐다."), W(-net, "sign_error", "부호를 반대로 적었다."), W(q - p, "sign_error", "부호가 반대인 단순 차를 답했다."), W(p, "step_missing", "첫 변화율만 답했다.")],
        verificationJs: withParams({ v0, p, q, ask: level === "easy" ? 1 : 0 }, "const a=P.v0*(100+P.p), b=a*(100-P.q); const f=b/10000; return P.ask? f : Math.round((f-P.v0)/P.v0*100*1e6)/1e6;"),
        trace: [[`첫 변화 후: ${v0} × ${(100 + p) / 100} = ${v1} 이다.`, "After the first change."], [`둘째 변화 후: ${v1} × ${(100 - q) / 100} = ${v2} 이다.`, "After the second change."], ...(level === "easy" ? [] : [[`변화율 = (${v2} − ${v0}) ÷ ${v0} × 100 = ${net}% 이다.`, "Overall percent change."] as [string, string]])], variant: level === "easy" ? "final_value" : "overall_percent" });
      return sem(out, [{ v: p, words: UP, pct: true }, { v: q, words: DOWN, pct: true }]);
    },
  },
  {
    id: "pct.compound_change.discounts", skill: SKILL, kind: "compound_change", frame: "discounts", levels: ["easy", "medium"], structure: "연속 할인 p%, q% 후 가격(easy) / 전체 할인율(medium)",
    generate(rng, level) {
      const p = rng.pick([10, 20, 25, 30, 50]), q = rng.pick([10, 20, 25, 50]); const L = rng.pick([100, 200, 400, 500, 800, 160, 240]); const v1 = (L * (100 - p)) / 100, v2 = (v1 * (100 - q)) / 100; if (!Number.isInteger(v1) || !Number.isInteger(v2)) throw new GenFail("x");
      const tot = ((L - v2) * 100) / L; if (level === "medium" && !Number.isInteger(tot)) throw new GenFail("x");
      const item = rng.pick(ITEMS), st = rng.pick(STORES);
      const stimulus = withOpen(rng, OPEN_MONEY, spin(rng, `${item[0].toUpperCase() + item.slice(1)} at ${st} has a list price of ${L} dollars. [[It is marked down|The price is cut|A discount is taken]] ${p}%, and then the reduced price is [[marked down|cut|discounted]] another ${q}%.`));
      const out = finish(rng, { stimulus, question: spin(rng, level === "easy" ? "[[What is the final price, in dollars?|How many dollars does the item cost after both discounts?|Find the final price in dollars.]]" : "[[What is the total percent discount from the list price?|The two discounts together equal a single discount of what percent?|Find the single percent discount that matches both discounts.]]"), correct: level === "easy" ? v2 : tot,
        wrongs: level === "easy" ? [W((L * (100 - p - q)) / 100, "formula_misuse", "두 할인율을 더해 한 번에 적용했다."), W(v1, "step_missing", "두 번째 할인을 적용하지 않았다."), W((L * (100 - q)) / 100, "condition_ignored", "두 번째 할인을 정가에 적용했다."), W(L - v2 , "step_missing", "할인액을 답했다.")]
          : [W(p + q, "formula_misuse", "두 할인율을 단순히 더했다."), W(100 - tot, "opposite", "남은 비율을 답했다."), W(Math.abs(p - q), "formula_misuse", "두 할인율의 차를 답했다."), W(p, "step_missing", "첫 할인율만 답했다.")],
        verificationJs: withParams({ L, p, q, ask: level === "easy" ? 1 : 0 }, "const f=P.L*(100-P.p)*(100-P.q)/10000; return P.ask? f : Math.round((P.L-f)/P.L*100*1e6)/1e6;"),
        trace: [[`첫 할인 후: ${L} × ${(100 - p) / 100} = ${v1} 달러이다.`, "After the first discount."], [`둘째 할인은 ${v1} 의 ${q}% 이므로 ${v1} × ${(100 - q) / 100} = ${v2} 달러이다.`, "The second discount applies to the reduced price."], ...(level === "easy" ? [] : [[`전체 할인율 = (${L} − ${v2}) ÷ ${L} × 100 = ${tot}% 이다.`, "Total percent discount."] as [string, string]])], variant: level === "easy" ? "final_price" : "total_discount" });
      return sem(out, [{ v: p, words: [...DOWN, "marked"], pct: true }, { v: q, words: [...DOWN, "marked", "discounted"], pct: true }]);
    },
  },
];
