// probability easy/medium 원형(lite) 6개 틀 — 단순 확률(bag·dice)·조건부 확률(survey·numbers)·비복원 연속 시행(marbles·committee). hard 원형은 probability.ts.
// 표·그림 없이 서술만으로 성립하는 문항. 정답은 기약분수 문자열이며 verification_js 는 모든 경우를 열거해 센다.
import { GenFail } from "../types";
import { finish, frac, spin, withParams } from "../text";
import { sem, withOpen, OPEN_GROUP, OPEN_GEN } from "../c-kit";
import { gcd } from "../rng";
import type { LiteArchetype } from "../c-lite";
import type { DistractorKind } from "../../review";

const SKILL = "probability";
const Wf = (n: number, d: number, kind: DistractorKind, reason: string) => ({ text: frac(n, d), kind, reason });
const BAGS = [["marbles", "red", "blue", "green", "A bag"], ["beads", "gold", "silver", "bronze", "A jar"], ["cards", "yellow", "purple", "orange", "A box"], ["tickets", "pink", "white", "gray", "A raffle drum"], ["buttons", "black", "brown", "tan", "A tin"], ["candies", "cherry", "lime", "grape", "A bowl"], ["tiles", "teal", "coral", "ivory", "A pouch"], ["poker chips", "violet", "amber", "lavender", "A tray"]] as const;
const GROUPS = [["students", "play soccer", "play chess"], ["employees", "ride the train", "work from home"], ["members of a gym", "take yoga", "swim laps"], ["campers", "joined the hike", "joined the canoe trip"], ["residents of a building", "own a bicycle", "own a car"], ["volunteers", "work weekends", "speak Spanish"], ["readers of a library", "borrow novels", "borrow audiobooks"], ["musicians", "play piano", "sing in the choir"]] as const;
const rangeOpen: [number, number] = [0, 1];
const one = (it: string) => (it.endsWith("ies") ? `${it.slice(0, -3)}y` : it.endsWith("s") ? it.slice(0, -1) : it);

export const PR_LITE: LiteArchetype[] = [
  {
    id: "probability.simple.bag", skill: SKILL, kind: "simple", frame: "bag", levels: ["easy", "medium"], structure: "세 색 중 한 색을 뽑을 확률(easy) / 두 색 또는 '그 색이 아님'(medium)",
    generate(rng, level) {
      const [it, c1, c2, c3, bag] = rng.pick(BAGS); const a = rng.int(2, level === "easy" ? 8 : 10), b = rng.int(2, 9), c = rng.int(2, 9); const T = a + b + c; if (a === b || b === c || a === c) throw new GenFail("x");
      const mode = level === "easy" ? "one" : rng.pick(["two", "not"] as const); const num = mode === "one" ? a : mode === "two" ? a + b : b + c; const [nt, dn] = [num, T]; if (gcd(num, T) === T) throw new GenFail("x");
      const ev = mode === "one" ? `${c1}` : mode === "two" ? `either ${c1} or ${c2}` : `not ${c1}`;
      const stimulus = withOpen(rng, OPEN_GEN, spin(rng, `${bag} contains ${a} ${c1} ${it}, ${b} ${c2} ${it}, and ${c} ${c3} ${it}. One ${one(it)} is chosen at random.`));
      const out = finish(rng, { stimulus, question: spin(rng, `[[What is the probability that the ${one(it)} chosen is ${ev}?|Find the probability that the one chosen is ${ev}.|What is the chance that the ${one(it)} is ${ev}?]]`), range: rangeOpen, correctText: frac(nt, dn),
        wrongTexts: [Wf(a, b + c, "formula_misuse", "경우의 수를 전체가 아닌 나머지와 비교(승산)했다."), Wf(T - num, T, "opposite", "여사건의 확률을 답했다."), Wf(num, T + 1, "other", "전체를 잘못 셌다."), Wf(a, T - 1, "other", "전체에서 하나를 뺐다."), Wf(num + 1, T, "other", "해당 개수를 잘못 셌다."), Wf(Math.max(num - 1, 1), T, "other", "해당 개수를 잘못 셌다.")],
        verificationJs: withParams({ a, b, c, ev: mode === "one" ? 0 : mode === "two" ? 1 : 2 }, "const items=[]; for(let i=0;i<P.a;i++) items.push(0); for(let i=0;i<P.b;i++) items.push(1); for(let i=0;i<P.c;i++) items.push(2);\nlet hit=0; for(const x of items){ if(P.ev===0 ? x===0 : P.ev===1 ? x<=1 : x!==0) hit++; }\nreturn hit/items.length;"),
        trace: [[`전체 ${it} 는 ${a} + ${b} + ${c} = ${T} 개이다.`, "Total number of items."], [`원하는 경우는 ${num} 개이다.`, "Favorable outcomes."], [`확률 = ${num}/${T} = ${frac(nt, dn)} 이다.`, "Probability."]], variant: mode === "one" ? "single_color" : mode === "two" ? "either_color" : "not_color" });
      return sem(out, [], { words: ["probability", "chance"], forbid: [] });
    },
  },
  {
    id: "probability.simple.dice", skill: SKILL, kind: "simple", frame: "dice", levels: ["easy", "medium"], structure: "주사위 한 개(easy) / 주사위 두 개 합(medium)의 확률 — 모든 경우를 세어 계산",
    generate(rng, level) {
      if (level === "easy") {
        const s = rng.pick([6, 8, 10, 12]); const evs = [["greater than " + rng.int(2, s - 2), (x: number, k: number) => x > k], ["a multiple of 3", (x: number) => x % 3 === 0], ["an even number", (x: number) => x % 2 === 0], ["less than " + rng.int(3, s - 1), (x: number, k: number) => x < k]] as const;
        const e = rng.pick(evs); const k = Number((e[0].match(/\d+/) ?? [0])[0]); let cnt = 0; for (let x = 1; x <= s; x++) if ((e[1] as (x: number, k: number) => boolean)(x, k)) cnt++; if (cnt === 0 || cnt === s || cnt === s / 2) throw new GenFail("x");
        const kind = e[0].startsWith("greater") ? 0 : e[0].startsWith("less") ? 3 : e[0].includes("multiple") ? 1 : 2;
        const out = finish(rng, { stimulus: withOpen(rng, OPEN_GEN, spin(rng, `[[A fair ${s}-sided die has faces numbered 1 through ${s}. It is rolled once.|A single fair die with ${s} sides, numbered 1 through ${s}, is rolled.|Roll one fair ${s}-sided die whose faces show the numbers 1 to ${s}.]]`)), question: spin(rng, `[[What is the probability that the number rolled is ${e[0]}?|Find the probability of rolling ${e[0]}.|What is the chance that the result is ${e[0]}?|How likely is it that the die shows a number that is ${e[0]}? Give the probability as a fraction.]]`), range: rangeOpen, correctText: frac(cnt, s),
          wrongTexts: [Wf(s - cnt, s, "opposite", "여사건의 확률을 답했다."), Wf(cnt, s + 1, "other", "전체를 잘못 셌다."), Wf(cnt + 1, s, "other", "해당 개수를 잘못 셌다."), Wf(cnt, s - 1, "other", "전체에서 하나를 뺐다."), Wf(Math.max(cnt - 1, 1), s, "other", "해당 개수를 잘못 셌다.")],
          verificationJs: withParams({ s, k: kind === 1 || kind === 2 ? 0 : k, ev: kind }, "let hit=0; for(let x=1;x<=P.s;x++){ const ok=P.ev===0? x>P.k : P.ev===3? x<P.k : P.ev===1? x%3===0 : x%2===0; if(ok) hit++; }\nreturn hit/P.s;"),
          trace: [[`나올 수 있는 눈은 ${s} 가지이다.`, "Possible outcomes."], [`조건을 만족하는 눈은 ${cnt} 가지이다.`, "Favorable outcomes."], [`확률 = ${cnt}/${s} = ${frac(cnt, s)} 이다.`, "Probability."]], variant: "one_die" });
        return sem(out, [], { words: ["probability", "chance"], forbid: [] });
      }
      const evs = [["is 7", (a: number, b: number) => a + b === 7], ["is at least 10", (a: number, b: number) => a + b >= 10], ["is even", (a: number, b: number) => (a + b) % 2 === 0], ["is less than 5", (a: number, b: number) => a + b < 5], ["is a multiple of 4", (a: number, b: number) => (a + b) % 4 === 0], ["is exactly 8", (a: number, b: number) => a + b === 8]] as const;
      const e = rng.pick(evs); let cnt = 0; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (e[1](a, b)) cnt++; if (cnt === 0 || cnt === 36 || cnt === 18) throw new GenFail("x"); const idx = evs.findIndex((x) => x[0] === e[0]);
      const out = finish(rng, { stimulus: withOpen(rng, OPEN_GEN, spin(rng, "[[Two fair six-sided dice, each numbered 1 through 6, are rolled together.|A pair of fair six-sided dice, with faces numbered 1 to 6, is rolled at the same time.|Two ordinary dice, one red and one blue, are rolled together; each has faces numbered 1 through 6.]]")), question: spin(rng, `[[What is the probability that the sum of the two numbers ${e[0]}?|Find the probability that the sum of the numbers rolled ${e[0]}.|What is the chance that the total of the two dice ${e[0]}?|How likely is it that the two dice add up to a total that ${e[0]}? Give the probability as a fraction.]]`), range: rangeOpen, correctText: frac(cnt, 36),
        wrongTexts: [Wf(cnt, 12, "formula_misuse", "경우의 수를 36 이 아닌 12 로 나눴다(주사위 두 개의 조합을 합으로 착각)."), Wf(36 - cnt, 36, "opposite", "여사건의 확률을 답했다."), Wf(cnt + 1, 36, "other", "해당 경우를 잘못 셌다."), Wf(Math.max(cnt - 1, 1), 36, "other", "해당 경우를 잘못 셌다."), Wf(1, 11, "formula_misuse", "합이 2~12 의 11 가지가 같은 확률이라고 보았다.")],
        verificationJs: withParams({ id: idx }, "let hit=0; for(let a=1;a<=6;a++) for(let b=1;b<=6;b++){ const s=a+b; const ok=[s===7, s>=10, s%2===0, s<5, s%4===0, s===8][P.id]; if(ok) hit++; }\nreturn hit/36;"),
        trace: [["두 주사위의 결과는 6 × 6 = 36 가지이고 모두 같은 확률이다.", "36 equally likely outcomes."], [`합이 조건을 만족하는 경우를 나열해 세면 ${cnt} 가지이다.`, "Count favorable outcomes."], [`확률 = ${cnt}/36 = ${frac(cnt, 36)} 이다.`, "Probability."]], variant: "two_dice_sum" });
      return sem(out, [], { words: ["probability", "chance"], forbid: [] });
    },
  },
  {
    id: "probability.conditional.survey", skill: SKILL, kind: "conditional", frame: "survey", levels: ["easy", "medium"], structure: "A 에 속한 사람 중 B 일 확률 — easy: 개수 직접 주어짐, medium: 합집합으로 교집합을 구해야 함",
    generate(rng, level) {
      const [pop, ga, gb] = rng.pick(GROUPS); const N = rng.int(4, 12) * 10, A = rng.int(Math.ceil(N * 0.3), Math.floor(N * 0.6)), B = rng.int(Math.ceil(N * 0.25), Math.floor(N * 0.55)); const AB = level === "easy" ? rng.int(3, Math.min(A, B) - 2) : rng.int(3, Math.min(A, B) - 2); const un = A + B - AB; if (un >= N || A === B || gcd(AB, A) === A) throw new GenFail("x");
      const nA = N - un;
      const stimulus = withOpen(rng, OPEN_GROUP, spin(rng, level === "easy" ? `Of ${N} ${pop} surveyed, ${A} ${ga}. Of those ${A}, ${AB} also ${gb}.` : `Of ${N} ${pop} surveyed, ${A} ${ga} and ${B} ${gb}. Exactly ${nA} of them do neither.`));
      const out = finish(rng, { stimulus, question: spin(rng, `[[If one person is chosen at random from those who ${ga}, what is the probability that the person is also among those who ${gb}?|A person who ${ga} is chosen at random. What is the probability that this person is also one of those who ${gb}?|Among the people who ${ga}, what fraction are also among those who ${gb}?]]`), range: rangeOpen, correctText: frac(AB, A),
        wrongTexts: [Wf(AB, N, "condition_ignored", "분모를 조건(그 집단)이 아닌 전체 인원으로 잡았다."), Wf(AB, B, "condition_ignored", "분모를 다른 집단 B 로 잡았다."), Wf(A, N, "step_missing", "조건의 집단의 비율을 답했다."), Wf(AB, un, "condition_ignored", "분모를 합집합으로 잡았다."), Wf(A - AB, A, "opposite", "B 가 아닌 사람의 비율을 답했다.")],
        verificationJs: withParams(level === "easy" ? { A, AB, easy: 1, N: 1, B: 1, nA: 1 } : { A, AB: 1, easy: 0, N, B, nA }, "if(P.easy) return P.AB/P.A;\nconst union=P.N-P.nA; const both=P.A+P.B-union; return both/P.A;"),
        trace: level === "easy" ? [["조건부확률이므로 분모는 조건을 만족하는 집단의 크기 " + A + " 이다.", "The denominator is the conditioning group."], [`확률 = ${AB}/${A} = ${frac(AB, A)} 이다.`, "Probability."]] : [[`둘 중 하나 이상에 속한 사람은 ${N} − ${nA} = ${un} 명이다.`, "People in at least one group."], [`두 집단에 모두 속한 사람은 ${A} + ${B} − ${un} = ${AB} 명이다.`, "Inclusion–exclusion."], [`분모는 ${A} 이므로 확률 = ${AB}/${A} = ${frac(AB, A)} 이다.`, "Conditional probability."]], variant: level === "easy" ? "counts_given" : "union_given" });
      return sem(out, [], { words: ["probability", "fraction"], forbid: [] });
    },
  },
  {
    id: "probability.conditional.numbers", skill: SKILL, kind: "conditional", frame: "numbers", levels: ["easy", "medium"], structure: "번호 카드에서 조건 A 일 때 B 일 확률 — 경우를 열거해 |A∩B|/|A|",
    generate(rng, level) {
      const N = rng.pick([12, 15, 18, 20, 24, 30]); const k = rng.int(Math.floor(N / 3), Math.floor((2 * N) / 3));
      const events: [string, (x: number) => boolean][] = [["even", (x) => x % 2 === 0], ["odd", (x) => x % 2 === 1], ["a multiple of 3", (x) => x % 3 === 0], [`greater than ${k}`, (x) => x > k], [`at most ${k}`, (x) => x <= k], ["a multiple of 5", (x) => x % 5 === 0], ["prime", (x) => [2, 3, 5, 7, 11, 13, 17, 19, 23, 29].includes(x)]];
      const ai = rng.int(0, events.length - 1), bi = rng.int(0, events.length - 1); if (ai === bi) throw new GenFail("x"); const E = [0, 1, 2, 5]; if (level === "easy" && !(E.includes(ai) && E.includes(bi))) throw new GenFail("x"); if (level === "medium" && E.includes(ai) && E.includes(bi)) throw new GenFail("x");
      const [an, af] = events[ai], [bn, bf] = events[bi]; let cA = 0, cAB = 0; for (let x = 1; x <= N; x++) if (af(x)) { cA++; if (bf(x)) cAB++; }
      if (cA < 3 || cAB === 0 || cAB === cA || gcd(cAB, cA) === cA) throw new GenFail("x");
      const out = finish(rng, { stimulus: withOpen(rng, OPEN_GEN, spin(rng, `[[Cards numbered 1 through ${N} are placed in a box, and one card is drawn at random. It is known that the number on the card is ${an}.|A box holds ${N} cards numbered 1 through ${N}. One card is drawn at random, and you are told its number is ${an}.|One card is picked at random from cards labeled 1 to ${N}, and it turns out that the label on it is ${an}.]]`)), question: spin(rng, `[[What is the probability that the number is also ${bn}?|Given this, what is the probability that the number on the card is ${bn}?|Find the probability that the card's number is ${bn}.|Under that condition, how likely is it that the card's number is ${bn}? Give the probability as a fraction.]]`), range: rangeOpen, correctText: frac(cAB, cA),
        wrongTexts: [Wf(cAB, N, "condition_ignored", "분모를 전체 카드 수로 잡았다."), Wf(cA, N, "step_missing", "조건 사건의 확률만 답했다."), Wf(cA - cAB, cA, "opposite", "B 가 아닌 경우의 비율을 답했다."), Wf(cAB, N - cA, "condition_ignored", "분모를 조건의 여사건으로 잡았다."), Wf(cAB + 1, cA, "other", "교집합을 잘못 셌다.")],
        verificationJs: withParams({ N, k: ai === 3 || ai === 4 || bi === 3 || bi === 4 ? k : 0, pick: ai, ask: bi }, "const P_ = [x=>x%2===0, x=>x%2===1, x=>x%3===0, x=>x>P.k, x=>x<=P.k, x=>x%5===0, x=>[2,3,5,7,11,13,17,19,23,29].includes(x)];\nlet ca=0, cab=0; for(let x=1;x<=P.N;x++){ if(P_[P.pick](x)){ ca++; if(P_[P.ask](x)) cab++; } }\nreturn cab/ca;"),
        trace: [[`조건에 맞는 카드는 ${an} 인 ${cA} 장이다(분모).`, "The conditioning set is the denominator."], [`그중 ${bn} 인 카드는 ${cAB} 장이다.`, "Count the favorable cards within it."], [`확률 = ${cAB}/${cA} = ${frac(cAB, cA)} 이다.`, "Conditional probability."]], variant: level === "easy" ? "parity_multiple" : "threshold_mixed" });
      return sem(out, [], { words: ["probability", "chance", "likely"], forbid: [] });
    },
  },
  {
    id: "probability.sequential_without_replacement.marbles", skill: SKILL, kind: "sequential_without_replacement", frame: "marbles", levels: ["easy", "medium"], structure: "비복원 두 번 뽑기 — easy: 같은 색 둘, medium: 서로 다른 두 색(순서 무관)",
    generate(rng, level) {
      const [it, c1, c2, , bag] = rng.pick(BAGS); const a = rng.int(3, 9), b = rng.int(3, 9), T0 = a + b; const extra = rng.int(0, 5); const T = T0 + extra; if (a === b || T > 20) throw new GenFail("x");
      const n = (level === "easy" ? a * (a - 1) : 2 * a * b), d = T * (T - 1); if (gcd(n, d) === d) throw new GenFail("x"); const cnt = extra ? ` and ${extra} other ${it}` : "";
      const stimulus = withOpen(rng, OPEN_GEN, spin(rng, `${bag} has ${a} ${c1} ${it}, ${b} ${c2} ${it}${cnt}. Two are drawn one after the other, and the first is not put back.`));
      const out = finish(rng, { stimulus, question: spin(rng, level === "easy" ? `[[What is the probability that both ${it} drawn are ${c1}?|Find the probability that both are ${c1}.|What is the chance that the two drawn are both ${c1}?]]` : `[[What is the probability that one ${one(it)} drawn is ${c1} and the other is ${c2}, in either order?|Find the probability of getting one ${c1} and one ${c2}, in either order.]]`), range: rangeOpen, correctText: frac(n, d),
        wrongTexts: level === "easy" ? [Wf(a * a, T * T, "condition_ignored", "복원 추출로 계산했다."), Wf(a, T, "step_missing", "첫 번째 확률만 답했다."), Wf(a - 1, T - 1, "step_missing", "두 번째 확률만 답했다."), Wf(2 * a * (a - 1), d, "other", "순서를 두 번 센 것으로 계산했다."), Wf(a * (a - 1), T * T, "formula_misuse", "분모를 전체의 제곱으로 잡았다.")]
          : [Wf(a * b, d, "step_missing", "한 가지 순서만 계산했다."), Wf(2 * a * b, T * T, "condition_ignored", "복원 추출로 계산했다."), Wf(a * b, T * T, "condition_ignored", "복원 추출에 한 순서만 계산했다."), Wf(2 * a * b, T * (T + 1) , "other", "분모를 잘못 잡았다."), Wf(a + b, T, "formula_misuse", "확률을 더했다.")],
        verificationJs: withParams({ a, b, e: extra, easy: level === "easy" ? 1 : 0 }, "const items=[]; for(let i=0;i<P.a;i++) items.push(0); for(let i=0;i<P.b;i++) items.push(1); for(let i=0;i<P.e;i++) items.push(2);\nlet hit=0, tot=0; for(let i=0;i<items.length;i++) for(let j=0;j<items.length;j++){ if(i===j) continue; tot++; const x=items[i], y=items[j]; if(P.easy? (x===0&&y===0) : ((x===0&&y===1)||(x===1&&y===0))) hit++; }\nreturn hit/tot;"),
        trace: level === "easy" ? [[`첫 번째가 ${c1} 일 확률은 ${a}/${T} 이다.`, "First draw."], [`뽑은 것을 되돌리지 않으므로 두 번째는 ${a - 1}/${T - 1} 이다.`, "Second draw without replacement."], [`두 확률을 곱하면 ${n}/${d} = ${frac(n, d)} 이다.`, "Multiply."]] : [[`순서 (${c1}, ${c2}) 의 확률은 ${a}/${T} × ${b}/${T - 1} 이다.`, "One order."], [`순서 (${c2}, ${c1}) 도 같은 값이다.`, "The other order."], [`합하면 ${n}/${d} = ${frac(n, d)} 이다.`, "Add the two orders."]], variant: level === "easy" ? "same_color" : "two_colors" });
      return sem(out, [], { words: ["probability", "chance"], forbid: [] });
    },
  },
  {
    id: "probability.sequential_without_replacement.committee", skill: SKILL, kind: "sequential_without_replacement", frame: "committee", levels: ["easy", "medium"], structure: "모임에서 두 명을 순서대로 뽑기 — easy: 둘 다 여학생, medium: 적어도 한 명이 남학생(여사건)",
    generate(rng, level) {
      const g = rng.int(3, 9), b = rng.int(3, 9), T = g + b; if (g === b || T > 18) throw new GenFail("x"); const [grp, w1, w2] = rng.pick([["a debate club", "girls", "boys"], ["a chess team", "juniors", "seniors"], ["a volunteer group", "adults", "teenagers"], ["a band", "string players", "wind players"], ["a robotics team", "builders", "coders"]]);
      const bothG = g * (g - 1), d = T * (T - 1); const n = level === "easy" ? bothG : d - bothG; if (gcd(n, d) === d || n === 0) throw new GenFail("x");
      const stimulus = withOpen(rng, OPEN_GROUP, spin(rng, `[[${grp[0].toUpperCase() + grp.slice(1)} has ${g} ${w1} and ${b} ${w2}. Two members are chosen at random, one after the other, to attend a meeting, and nobody is chosen twice.|Among the members of ${grp} there are ${g} ${w1} and ${b} ${w2}. Two of them are picked in turn at random for a meeting, and no member can be picked twice.|For a meeting, ${grp} with ${g} ${w1} and ${b} ${w2} sends two members chosen one after the other at random, without repeats.]]`));
      const out = finish(rng, { stimulus, question: spin(rng, level === "easy" ? `[[What is the probability that both members chosen are ${w1}?|Find the probability that both are ${w1}.|How likely is it that the two members picked are both ${w1}? Give the probability as a fraction.]]` : `[[What is the probability that at least one of the two members chosen is a member of the ${w2}?|Find the probability that at least one of the two is among the ${w2}.|What is the chance that the pair picked includes at least one of the ${w2}?]]`), range: rangeOpen, correctText: frac(n, d),
        wrongTexts: level === "easy" ? [Wf(g * g, T * T, "condition_ignored", "복원 추출로 계산했다."), Wf(g, T, "step_missing", "첫 번째 확률만 답했다."), Wf(g - 1, T - 1, "step_missing", "두 번째 확률만 답했다."), Wf(b * (b - 1), d, "other", "다른 집단의 확률을 답했다."), Wf(g * (g - 1), T * T, "formula_misuse", "분모를 전체의 제곱으로 잡았다.")]
          : [Wf(bothG, d, "opposite", "여사건(둘 다 반대 집단)의 확률을 답했다."), Wf(b * (b - 1), d, "other", "둘 다 해당 집단일 확률만 답했다."), Wf(1, 2 , "other", "절반이라고 어림했다."), Wf(d - g * g, T * T, "condition_ignored", "복원 추출로 계산했다."), Wf(2 * b, T, "formula_misuse", "확률을 더하기만 했다.")],
        verificationJs: withParams({ g, b, easy: level === "easy" ? 1 : 0 }, "const people=[]; for(let i=0;i<P.g;i++) people.push(0); for(let i=0;i<P.b;i++) people.push(1);\nlet hit=0, tot=0; for(let i=0;i<people.length;i++) for(let j=0;j<people.length;j++){ if(i===j) continue; tot++; const x=people[i], y=people[j]; if(P.easy? (x===0&&y===0) : (x===1||y===1)) hit++; }\nreturn hit/tot;"),
        trace: level === "easy" ? [[`첫 번째가 ${w1} 일 확률은 ${g}/${T} 이다.`, "First choice."], [`한 명이 빠졌으므로 두 번째는 ${g - 1}/${T - 1} 이다.`, "Second choice."], [`곱하면 ${n}/${d} = ${frac(n, d)} 이다.`, "Multiply."]] : [[`'적어도 한 명' 의 여사건은 '두 명 모두 ${w1}' 이다.`, "Use the complement."], [`둘 다 ${w1} 일 확률은 ${g}/${T} × ${g - 1}/${T - 1} = ${frac(bothG, d)} 이다.`, "Probability of the complement."], [`1 − ${frac(bothG, d)} = ${frac(n, d)} 이다.`, "Subtract from 1."]], variant: level === "easy" ? "both_same_group" : "at_least_one" });
      return sem(out, [], { words: ["probability", "chance", "likely"], forbid: [] });
    },
  },
];
