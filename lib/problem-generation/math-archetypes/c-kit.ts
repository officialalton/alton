// C 담당(percentages·area_volume·circles·ratios/probability easy·medium) 공용 도구 — π 선지, 문장-변수 의미 일치 기계 검사.
import { fmtNum } from "./text";
import type { Instance } from "./types";
import type { Rng } from "./rng";

/** `$36\pi$` 형태의 선지 문자열(계수만). 계수는 정수여야 한다. */
export const piOpt = (v: number) => (v === 1 ? "$\\pi$" : `$${fmtNum(v)}\\pi$`);
/** `$a - b\pi$`(식형 선지). */
export const piDiff = (a: number, b: number) => `$${fmtNum(a)} ${b < 0 ? "+" : "-"} ${fmtNum(Math.abs(b))}\\pi$`;

// ---------- 문장과 변수의 의미 일치 검사 ----------
// 생성기는 지문에 인쇄한 핵심 수량마다 {v: 수, words: 그 수를 설명해야 하는 명사·수식어}를 선언한다.
// 검사: (1) 선언한 수가 지문·질문에 실제로 있고, (2) 그 수 바로 옆(같은 문장, 60자 이내)에서 가장 가까운 '수량 명사'가 선언한 words 중 하나다.
//   → '반지름 7'이라고 선언했는데 본문이 '지름 7'로 쓰였거나, 둘레 값을 넓이로 서술한 문장은 걸러진다.
// (3) 질문은 구하려는 양(ask)의 명사를 포함하고, 구하려는 양이 아닌 다른 '양'의 명사(forbid)를 포함하지 않는다.
/** 증가 방향·감소 방향 단어(퍼센트 수가 어느 방향 서술과 붙는지 검사). */
export const UP = ["increase", "increased", "increases", "rise", "rises", "rose", "raise", "raised", "grew", "grows", "growth", "markup", "higher", "added", "went up", "marked up", "goes up"];
export const DOWN = ["decrease", "decreased", "decreases", "discount", "off", "fell", "falls", "drop", "dropped", "reduced", "reduce", "shrank", "shrinks", "markdown", "lower", "drops", "went down", "marked down", "goes down"];
export const DOWNC = [...DOWN, "cut"];
export const CUE_WORDS = [
  "radius", "diameter", "circumference", "area", "perimeter", "volume", "height", "width", "length", "base", "side", "edge", "depth", "arc", "surface",
  ...UP, ...DOWN,
];
export type Bind = { v: number; words: string[]; /** true 면 'N%' 꼴만, false 면 % 가 붙지 않은 수만 대상으로 삼는다(미지정이면 둘 다). */ pct?: boolean };
export type AskSpec = { words: string[]; forbid?: string[] };

const cueRe = (w: string) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
const NUM_RE = /(?<![\d.])\d+(?:\.\d+)?/g;
const sentences = (t: string) => t.split(/(?<=[.?!])\s+|\n+/).filter(Boolean);

/** 위반이 있으면 사유 문자열 배열을 돌려준다(없으면 빈 배열). */
export function semanticIssues(stimulus: string, question: string, binds: Bind[], ask?: AskSpec): string[] {
  const issues: string[] = [];
  const all = `${stimulus}\n${question}`;
  const cues = [...new Set([...CUE_WORDS, ...binds.flatMap((b) => b.words)])];
  const sents = sentences(all);
  const cueHits = (s: string) => cues.flatMap((c) => [...s.matchAll(cueRe(c))].map((m) => ({ w: c.toLowerCase(), a: m.index!, b: m.index! + m[0].length })));
  for (const b of binds) {
    const allowed = new Set(binds.filter((x) => x.v === b.v).flatMap((x) => x.words.map((w) => w.toLowerCase())));
    let good = 0;
    for (const s of sents) {
      const hits = cueHits(s);
      for (const m of s.matchAll(NUM_RE)) {
        if (Number(m[0]) !== b.v) continue;
        const a = m.index!, e = a + m[0].length;
        if (b.pct !== undefined && (s[e] === "%") !== b.pct) continue;
        let best: { w: string; d: number } | null = null;
        for (const h of hits) { const d = h.b <= a ? a - h.b : h.a >= e ? h.a - e : 0; if (d <= 60 && (!best || d < best.d)) best = { w: h.w, d }; }
        if (!best) continue;
        if (allowed.has(best.w)) good++;
        else issues.push(`의미 불일치: ${b.v} 는 [${[...allowed].join("/")}] 여야 하는데 가장 가까운 수량 명사가 '${best.w}'`);
      }
    }
    if (good === 0) issues.push(`의미 검사: ${b.v} 가 [${b.words.join("/")}] 와 함께 지문에 나타나지 않음`);
  }
  if (ask) {
    const q = question.toLowerCase();
    const syn: Record<string, string[]> = { area: ["cover", "covers", "square", "uncovered"], volume: ["hold", "holds", "cubic", "capacity"], height: ["tall", "high"], depth: ["deep"], circumference: ["around"], radius: [], length: ["long"] };
    const askWords = [...ask.words, ...ask.words.flatMap((w) => syn[w] ?? [])];
    if (!askWords.some((w) => cueRe(w).test(q) || q.includes(w.toLowerCase()))) issues.push(`질문에 구하는 양 명사 [${ask.words.join("/")}] 가 없음`);
    for (const f of ask.forbid ?? []) if (new RegExp(`\\b${f}\\b`, "i").test(question)) issues.push(`질문에 다른 양의 명사 '${f}' 가 섞여 있음`);
  }
  return issues;
}
/** 인스턴스 생성 끝에서 호출 — 위반이면 일반 Error(=시드 스윕에서 '예외'로 집계, 테스트 실패). 점검 포인트 문자열을 인스턴스에 붙인다. */
export function sem(inst: Instance, binds: Bind[], ask?: AskSpec, note?: string): Instance {
  const issues = semanticIssues(inst.stimulus, inst.question, binds, ask);
  if (issues.length) throw new Error(`[sem] ${issues.join("; ")} :: ${inst.stimulus.slice(0, 260)} || ${inst.question.slice(0, 120)}`);
  const parts = [...binds.map((b) => `${b.v}=${b.words[0]}`), ask ? `ask=${ask.words[0]}` : ""].filter(Boolean);
  Object.assign(inst, { semNote: note ?? parts.join(", "), semBinds: binds, semAsk: ask });
  return inst;
}
export const semNoteOf = (inst: Instance) => (inst as Instance & { semNote?: string }).semNote ?? "";
export const semOf = (inst: Instance) => inst as Instance & { semBinds?: Bind[]; semAsk?: AskSpec };

/** 질문에서 구하는 양 하나만 남기는 금지어 목록: forbidExcept("area") → 넓이 외 양 명사 전부. */
const QUANT = ["area", "perimeter", "volume", "circumference", "diameter", "radius", "arc", "surface", "height", "length", "width"];
export const forbidExcept = (...keep: string[]) => QUANT.filter((q) => !keep.includes(q));

// ---------- 공용 수치 보조 ----------
export const isInt = (n: number) => Number.isInteger(n);
export const ceilDiv = (a: number, b: number) => Math.ceil(a / b);

// ---------- 문장 틀 변주용 도입 문장 은행 ----------
// 본문 유사도(숫자 마스킹 3-gram)는 내용어가 달라야 낮아진다. 수치·수량 명사가 없는 중립 도입 문장을 틀 앞에 붙여 같은 틀에서도 독립 변형 수를 늘린다.
// (의미 검사의 수량 명사(CUE_WORDS)·숫자를 포함하지 않는다.)
export const OPEN_NEUTRAL = [
  "The following scenario comes from a short practice worksheet.", "A teacher wrote the scenario below on the board for discussion.", "This situation is taken from a workbook of review exercises.",
  "Consider the scenario described in the paragraph below.", "Here is a situation of the kind often used in test practice.", "A tutor shared the scenario below with a small study group.",
  "The facts below were collected for a classroom exercise.", "Read the situation below, which is based on an everyday setting.", "A study guide includes the following everyday scenario.",
  "Students in a review session were given the description below.", "The description below was prepared for a weekly practice quiz.", "A set of review notes includes the situation described next.",
  "Think about the everyday situation described in this passage.", "This passage was written to give students practice with a common setting.", "Look carefully at the situation presented in the next few lines.",
  "A practice packet for the upcoming exam begins with this scenario.", "An instructor included the scenario below in a homework set.", "The situation described next is similar to ones students often meet.",
  "Review the facts of this ordinary scenario before answering.", "A short exercise in a math magazine describes the setting below.", "Here are the details of a realistic scenario for practice.",
  "This scenario was chosen for a class on problem solving.", "The setting below is typical of word problems in review books.", "A volunteer tutor typed the scenario below for her students.",
  "Take a moment to understand the situation described here.", "The next few lines describe a scenario used in a study session.", "A challenge problem sheet opens with the scenario shown here.",
  "This everyday scenario was drawn from a collection of practice problems.", "A student teacher prepared this scenario for a lesson.", "A review handout presents the situation described below.",
];
export const OPEN_MONEY = OPEN_NEUTRAL, OPEN_GROUP = OPEN_NEUTRAL, OPEN_SCI = OPEN_NEUTRAL, OPEN_GEO = OPEN_NEUTRAL, OPEN_GEN = OPEN_NEUTRAL;
/** 퍼센트 앞 부정관사: 8·11·18·80대는 an. */
export const aPct = (p: number) => (/^(8|11|18)/.test(String(p)) ? `an ${p}%` : `a ${p}%`);
export const TAILS = [
  "The final figure will be posted on the bulletin board for everyone to see.", "Everything described here happened within a single ordinary week.", "Nobody involved has rounded any of the reported numbers.",
  "The details were written down carefully by someone who double-checked them.", "All of these facts were confirmed by the person in charge.", "No other information about the situation is needed to answer.",
  "Everyone agreed that the numbers were recorded accurately.", "The report was shared with the whole group at the next meeting.", "Nothing else changed while these details were being collected.",
  "The people who gathered this information kept careful records.", "These are the only facts that were noted at the time.", "A short summary of these facts was printed in the newsletter.",
  "The organizers wrote these details on a large whiteboard.", "Every number given here is exact and comes from the official records.", "These details were collected on a typical day with no surprises.",
  "A volunteer typed these facts into a shared spreadsheet.", "The person asking the question has checked the facts twice.", "Assume that every statement here is accurate and complete.",
  "The facts were collected independently by two different people who agreed.", "Only the information above matters for what follows.", "These facts were all taken from the same trusted source.",
  "The data were reviewed by a supervisor before being shared.", "Please treat each reported value as exact rather than approximate.", "The situation was explained in full at a short briefing.",
  "None of the details were altered after they were first recorded.", "The notes were kept in a folder that everyone could reach.", "These are the figures that the team agreed to work with.",
  "The facts above were reported by a reliable witness.", "Everyone present at the time confirmed these details afterward.", "A copy of the facts was kept on file for future reference.",
];
/** 도입 문장(+종결 문장)을 골라 본문을 감싼다 — 같은 틀에서도 본문 유사도를 낮추는 변주. */
export const withOpen = (rng: { pick<T>(a: readonly T[]): T }, bank: readonly string[], body: string) => `${rng.pick(bank)} ${body} ${rng.pick(TAILS)}`;
/** 영어 명사 복수형(간단 규칙). */
export const plural = (n: string) => (/(s|x|ch|sh)$/.test(n) ? `${n}es` : /[^aeiou]y$/.test(n) ? `${n.slice(0, -1)}ies` : `${n}s`);

// ---------- 표현 대안(paraphrase) 층 ----------
// 같은 수학 틀의 본문을 규칙 기반 동의 표현으로 바꿔 '은행 문장 제외' 독립 변형 수를 늘린다. 수식($...$)·도입/종결 은행 문장은 건드리지 않고,
// 바꾼 뒤 수량 명사 의미 일치 검사를 다시 돌린다(어긋나면 예외). 수치·구조는 그대로다.
type PRule = [RegExp, string[]];
const PARA: PRule[] = [
  [/\b(holds|contains)\b/g, ["holds", "contains"]],
  [/(?<!normally )\bcosts\b/g, ["costs", "is priced at"]],
  [/\b(?:cut|divided|split) into\b/g, ["cut into", "divided into", "split into", "sliced into"]],
  [/\beats\b/g, ["eats", "takes"]],
  [/\b(?:chosen|picked|selected)\b/g, ["chosen", "picked", "selected"]],
  [/\b(?:drawn|taken)\b/g, ["drawn", "picked", "taken"]],
  [/\b(?:rolled|tossed)\b/g, ["rolled", "tossed"]],
  [/\b(?:Recall|Remember) that\b/g, ["Recall that", "Remember that", "Keep in mind that", "Note that"]],
  [/\b(?:constant|steady|fixed) rate\b/g, ["constant rate", "steady rate", "fixed rate"]],
  [/\ba whole number\b/g, ["a whole number", "an integer"]],
  [/\bwhole numbers\b/g, ["whole numbers", "integers"]],
  [/\bis equal to\b/g, ["is equal to", "equals", "is the same as"]],
  [/\bexactly\b/g, ["exactly", "precisely"]],
  [/\btouches\b/g, ["touches", "is tangent to"]],
  [/\bfilled to\b/g, ["filled to", "filled up to"]],
  [/\bis increased by\b/g, ["is increased by", "is raised by", "goes up by", "rises by"]],
  [/\bis decreased by\b/g, ["is decreased by", "is reduced by", "goes down by", "falls by"]],
  [/\bat random\b/g, ["at random", "randomly"]],
  [/\bmeasures\b/g, ["measures", "is"]],
  [/\bgets\b/g, ["gets", "achieves", "averages"]],
  [/\bworks at\b/g, ["works at", "operates at", "runs at"]],
  [/\bsurveyed\b/g, ["surveyed", "polled", "questioned"]],
  [/\bTogether,/g, ["Together,", "In total,", "Combined,"]],
  [/\bstarted at\b/g, ["started at", "began at"]],
  [/\bcompletely\b/g, ["completely", "entirely", "fully"]],
  [/\bAssume that\b/g, ["Assume that", "Suppose that", "Take it that"]],
  [/\bcurrently\b/g, ["currently", "right now", "at present"]],
  [/\bapproximately\b/g, ["approximately", "about"]],
  [/\bin one minute\b/g, ["in one minute", "each minute", "during one minute"]],
  [/\bidentical\b/g, ["identical", "matching", "equal-sized"]],
  [/\bmeeting\b/g, ["meeting", "gathering", "session"]],
  [/\bcircle drawn inside\b/g, ["circle drawn inside", "circle placed inside", "circle sketched inside"]],
  [/\bwithout slipping\b/g, ["without slipping", "with no slipping", "and never slips"]],
  [/\bkeeps the height the same\b/g, ["keeps the height the same", "leaves the height unchanged", "does not change the height"]],
  [/\bAll of these facts\b/g, ["All of these facts", "Every one of these facts", "Each of these facts"]],
  [/\bin real life\b/g, ["in real life", "on the ground", "in reality"]],
  [/\bon the drawing\b/g, ["on the drawing", "on the plan", "on the page"]],
  [/\bone after the other\b/g, ["one after the other", "in turn", "in sequence"]],
  [/\b(?:very )?large\b/g, ["large", "big"]],
  [/\bunits?\b(?= on both axes)/g, ["unit", "tick"]],
  [/\bIn the xy-plane,/g, ["In the xy-plane,", "In the coordinate plane,", "On the xy-coordinate plane,", "In a Cartesian coordinate system,"]],
  [/\bwith center O\b/g, ["with center O", "centered at O", "whose center is O"]],
  [/\blie on the circle\b/g, ["lie on the circle", "are on the circle", "sit on the circle"]],
  [/\bcustomer\b/g, ["customer", "shopper", "buyer"]],
  [/\bfor each\b/g, ["for each", "for every", "per"]],
  [/\bEach unit\b/g, ["Each unit", "Every unit", "One unit"]],
  [/\bper minute\b/g, ["per minute", "every minute", "each minute"]],
  [/\bthe same (?=\w)/g, ["the same ", "an identical "]],
  [/\bin the next few lines\b/g, ["in the next few lines", "just below"]],
  [/\bconsider\b/gi, ["consider", "look at"]],
  [/\bwhere D, E, and F are constants\b/g, ["where D, E, and F are constants", "with D, E, and F being constants", "for some constants D, E, and F"]],
  [/\bfor some constant\b/g, ["for some constant", "for a certain constant"]],
  [/\bat least\b/g, ["at least", "no fewer than"]],
  [/\bseparate\b/g, ["separate", "different"]],
  [/\bof the whole circle\b/g, ["of the whole circle", "of the entire circle", "of the full circle"]],
  [/\bits (entire|whole) edge\b/g, ["its entire edge", "its whole edge", "all of its edge"]],
  [/\bgoes all the way around\b/g, ["goes all the way around", "runs completely around", "surrounds"]],
  [/\bfinal\b/g, ["final", "last", "resulting"]],
  [/\bnew price\b/g, ["new price", "updated price", "current price"]],
  [/\bstore\b/g, ["store", "shop"]],
  [/\bsold\b/g, ["sold", "sells"]],
  [/\b(?:grew|increased|rose) by\b/g, ["grew by", "increased by", "rose by", "went up by"]],
  [/\b(?:decreased|fell|dropped|shrank) by\b/g, ["decreased by", "fell by", "dropped by", "went down by"]],
  [/\bis now\b/g, ["is now", "has become", "now stands at"]],
  [/\bwas raised by\b/g, ["was raised by", "was increased by", "went up by"]],
  [/\bwhich is (?=\d)/g, ["which is ", "which equals ", "which makes up "]],
  [/\btook (\d+)% off\b/g, ["took $1% off", "gave a $1% discount on", "knocked $1% off"]],
  [/\bLater,/g, ["Later,", "Afterward,", "Then,"]],
  [/\bOver the past decade,/g, ["Over the past decade,", "During the last ten years,", "Across the past decade,"]],
  [/\bhas an area of\b/g, ["has an area of", "covers an area of", "occupies an area of"]],
  [/\bis a sector of a circle\b/g, ["is a sector of a circle", "is a sector cut from a circle", "is part of a circle shaped like a sector"]],
  [/\bcircular\b(?! cylinder)/g, ["circular", "round"]],
  [/\bwhole\b(?= circle)/g, ["whole", "entire", "full"]],
  [/\bcorresponds to\b/g, ["corresponds to", "belongs to", "is cut off by"]],
  [/\bThere are (\d+) more (\w+(?: \w+)?) to go\b/g, ["There are $1 more $2 to go", "$1 $2 remain", "$1 more $2 are left"]],
  [/\bthe first (\d+)\b/g, ["the first $1", "the opening $1", "the initial $1"]],
  [/\bof the first\b/g, ["of the first", "among the first"]],
  [/\bhas (\d+) (\w+) and (\d+) (\w+)\b/g, ["has $1 $2 and $3 $4", "is made up of $1 $2 and $3 $4", "includes $1 $2 and $3 $4"]],
  [/\bwrapped around\b/g, ["wrapped around", "wound around", "looped around"]],
  [/\bin the next few lines\b/g, ["in the next few lines", "right below"]],
  [/\bbelow\b/g, ["below", "that follows"]],
  [/\bOf the (?=\d)/g, ["Of the ", "Among the ", "Out of the "]],
  [/\bOf those (?=\d)/g, ["Of those ", "Among those ", "Out of those "]],
  [/\bhas a length of (\d+) (\w+), a width of (\d+) \2, and a (height|depth) of (\d+) \2\b/g, ["has a length of $1 $2, a width of $3 $2, and a $4 of $5 $2", "has these dimensions: length $1 $2, width $3 $2, and $4 $5 $2", "is described by length $1 $2, width $3 $2, and $4 $5 $2"]],
  [/\bhas a volume of (\d+) (cubic \w+), a length of (\d+) (\w+), and a width of (\d+) \4\b/g, ["has a volume of $1 $2, a length of $3 $4, and a width of $5 $4", "has a volume of $1 $2, with length $3 $4 and width $5 $4", "holds $1 $2 and has length $3 $4 and width $5 $4"]],
  [/\bhas a volume of (\d+) (cubic \w+) and a length of\b/g, ["has a volume of $1 $2 and a length of", "has a volume of $1 $2, and its length is", "holds $1 $2 and has a length of"]],
  [/\bwith a volume of\b/g, ["with a volume of", "whose volume is", "having a volume of"]],
  [/\bwith a radius of\b/g, ["with a radius of", "whose radius is", "having a radius of"]],
  [/\bwith a diameter of\b/g, ["with a diameter of", "whose diameter is", "having a diameter of"]],
  [/\bwith a length of\b/g, ["with a length of", "whose length is", "having a length of"]],
  [/\bwith a perimeter of\b/g, ["with a perimeter of", "whose perimeter is", "having a perimeter of"]],
  [/\bThe minute hand\b/g, ["The minute hand", "The long hand"]],
  [/\bcircle in the xy-plane\b/g, ["circle in the xy-plane", "circle in the coordinate plane", "circle drawn on the xy-plane"]],
  [/\bgraph of\b/g, ["graph of", "curve given by"]],
  [/\bexpected\b/g, ["expected", "assumed", "figured"]],
  [/\bthe two discounts\b/g, ["the two discounts", "both discounts", "the pair of discounts"]],
  [/\bsells\b/g, ["sells", "offers", "stocks"]],
  [/\bwith a list price of\b/g, ["with a list price of", "whose list price is", "listed at"]],
  [/\bknew\b/g, ["knew", "got", "answered"]],
  [/\bcollected\b/g, ["collected", "gathered"]],
  [/\bin the town\b/g, ["in the town", "in the community", "in the city"]],
  [/\b(?:total|entire) number\b/g, ["total number", "entire number", "overall number"]],
  [/\bare equal in dollars\b/g, ["are equal in dollars", "match exactly in dollars", "come to the same number of dollars"]],
  [/\badd up to\b/g, ["add up to", "total", "sum to"]],
  [/\bdonates\b/g, ["donates", "gives", "contributes"]],
  [/\bsaves\b/g, ["saves", "puts away", "sets aside"]],
  [/\bAfter a tune-up\b/g, ["After a tune-up", "Following a tune-up", "Once it is tuned up"]],
  [/\bIt then makes\b/g, ["It then makes", "Afterward it makes", "Next it makes"]],
  [/\bby the same percent every (\w+)/g, ["by the same percent every $1", "by an equal percent each $1", "by the same percentage each $1"]],
  [/\bIt starts at\b/g, ["It starts at", "It begins at", "At the start it is"]],
  [/\bafter two (\w+)s\b(?! in all)/g, ["after two $1s", "once two $1s have passed", "two $1s later"]],
  [/\(Use a negative number for a decrease\.\)/g, ["(Use a negative number for a decrease.)", "(A decrease should be given as a negative number.)", "(Write a decrease as a negative number.)"]],
  [/\bmeasures (\d+) (\w+) by (\d+) \2 by (\d+) \2\b/g, ["measures $1 $2 by $3 $2 by $4 $2", "has edges of $1 $2, $3 $2, and $4 $2", "is a block $1 $2 long, $3 $2 wide, and $4 $2 tall"]],
  [/\bIt is reshaped, without any loss of material, into a solid cube\b/g, ["It is reshaped, without any loss of material, into a solid cube", "All of its material is remolded, with none lost, into a solid cube", "It is melted down and recast, with no material lost, as a solid cube"]],
  [/\bThere are 1000 cubic centimeters in 1 liter\./g, ["There are 1000 cubic centimeters in 1 liter.", "One liter is the same as 1000 cubic centimeters.", "1 liter holds exactly 1000 cubic centimeters.", "Use the fact that 1 liter = 1000 cubic centimeters."]],
  [/\bhas a radius that is (\d+) (\w+) less than the radius of the ([^.]+)\./g, ["has a radius that is $1 $2 less than the radius of the $3.", "has a radius $1 $2 shorter than the radius of the $3.", "has a radius equal to the radius of the $3 minus $1 $2."]],
  [/\bhas a radius of (\d+) (\w+) and a central angle of (\d+) degrees\b/g, ["has a radius of $1 $2 and a central angle of $3 degrees", "has radius $1 $2 and central angle $3 degrees", "has a central angle of $3 degrees and a radius of $1 $2"]],
  [/\bthe circle has a radius of (\d+)\b/g, ["the circle has a radius of $1", "the circle's radius is $1", "the radius of the circle is $1"]],
  [/\bwhere x and y are real numbers\b/g, ["where x and y are real numbers", "with x and y ranging over the real numbers", "for real values of x and y"]],
  [/\bcorrectly\b/g, ["correctly", "accurately", "without a mistake"]],
  [/\bincorrectly\b/g, ["incorrectly", "wrongly", "with a mistake"]],
  [/\bOn a set of\b/g, ["On a set of", "On a batch of", "Out of a set of"]],
  [/\bone full turn\b/g, ["one full turn", "one complete revolution", "a complete circuit"]],
  [/\bExactly (\d+) of them do neither\b/g, ["Exactly $1 of them do neither", "$1 of them belong to neither group", "Precisely $1 of them are in neither group"]],
  [/\bmeasures (\d+) centimeters by (\d+) centimeters\b/g, ["measures $1 centimeters by $2 centimeters", "has sides of $1 centimeters and $2 centimeters", "is $1 centimeters by $2 centimeters"]],
  [/\bthat measures (\d+) meters by (\d+) meters\b/g, ["that measures $1 meters by $2 meters", "with dimensions $1 meters by $2 meters", "that is $1 meters by $2 meters"]],
  [/\bturns through 360 degrees every 60 minutes\b/g, ["turns through 360 degrees every 60 minutes", "makes one 360-degree turn in each 60 minutes", "goes around 360 degrees once an hour"]],
  [/\bThe hand moves smoothly and\b/g, ["The hand moves smoothly and", "The hand glides and", "The hand sweeps around and"]],
  [/\bthe tip of the (?:minute )?hand\b/g, ["the tip of the minute hand", "the tip of the hand", "the end of the hand", "the free end of the minute hand"]],
  [/\btravel\b/g, ["travel", "move"]],
  [/\bafter t (\w+):/g, ["after t $1:", "as a function of the time t, in $1:", "at time t (in $1):"]],
  [/\bis filled to (\d+)% of its capacity\b/g, ["is filled to $1% of its capacity", "is $1% full", "has a fill level of $1% of its capacity"]],
  [/\bA slice is cut from\b/g, ["A slice is cut from", "One slice is taken from", "A wedge is cut from"]],
  [/\bFrom start to finish,/g, ["From start to finish,", "In total,", "Overall,"]],
  [/\bThe length of\b/g, ["The length of", "The running time of", "The duration of"]],
  [/\bboth intercept arc\b/g, ["both intercept arc", "both cut off arc", "both subtend arc"]],
  [/\bThe measure of angle (\w+) is\b/g, ["The measure of angle $1 is", "Angle $1 measures", "The size of angle $1 is"]],
  [/\bthe measure of angle\b/g, ["the measure of angle", "the size of angle", "angle"]],
];
const capLike = (orig: string, rep: string) => (/^[A-Z]/.test(orig) ? rep[0].toUpperCase() + rep.slice(1) : rep);
const PRON = /^(It|Its|They|Their|The two|Both|That|This|These|Those|Each|He|She|Then|Afterward|Later|Next|Of those|Of these|Within|Among|The (circle|square|rectangle|item|hand|second|first|larger|smaller|largest|smallest|same|other|answer|ratio|water|material|wrapping|fence|rate|event|sale|price|radius|height|base|cans|jars|drums|cups|tanks|gears|wheels|sector|sectors|path|central|inscribed|line|box|batch|bag|slices?)|A (larger|second|bigger|slice|customer|path|belt|crew|shop|store)|Another|One shopper|Exactly|Precisely|Water|Every|All|Nobody|Two other)\b/;
export function paraphraseText(rng: { pick<T>(a: readonly T[]): T; chance(p: number): boolean; next(): number }, text: string, question: boolean): string {
  const segs = text.split("$");
  const chosen = new Map<number, string>();
  let out = segs.map((seg, i) => {
    if (i % 2 === 1) return seg;
    let t = seg;
    PARA.forEach(([re, alts], ri) => {
      if (!re.test(t)) { re.lastIndex = 0; return; }
      re.lastIndex = 0;
      if (!chosen.has(ri)) chosen.set(ri, rng.pick(alts));
      const alt = chosen.get(ri)!;
      t = t.replace(re, (m, ...g) => { const body = alt.replace(/\$(\d)/g, (_x, d) => String(g[Number(d) - 1] ?? "")); return capLike(m, body); });
    });
    return t;
  }).join("$");
  if (question) {
    const fam: [RegExp, string[]][] = [
      [/^(?:What is|Find|Determine|Calculate|Compute) the volume of the ([^,?.]+), in (cubic \w+)[?.]$/, ["What is the volume of the $1, in $2?", "Find the volume of the $1, in $2.", "How many $2 does the $1 hold?", "Calculate the volume of the $1 in $2.", "The $1 has what volume, in $2?", "Determine how much volume, in $2, the $1 has."]],
      [/^(?:What is|Find|Determine|Calculate|Compute) the area of the ([^,?.]+), in (square \w+)[?.]$/, ["What is the area of the $1, in $2?", "Find the area of the $1, in $2.", "How many $2 does the $1 cover?", "Calculate the area of the $1 in $2.", "The $1 has what area, in $2?", "Determine the area, in $2, of the $1."]],
      [/^(?:What is|Find|Determine|Calculate|Compute) the height of the ([^,?.]+), in (\w+)[?.]$/, ["What is the height of the $1, in $2?", "Find the height of the $1, in $2.", "How tall is the $1, in $2?", "Determine the height of the $1 in $2.", "The $1 stands how many $2 high?"]],
      [/^(?:What must k equal|What is the value of k|Find the value of k)[?.]$/, ["What must k equal?", "What is the value of k?", "Find the value of k.", "Determine k.", "Which value of k makes the statement true?", "Solve for k."]],
      [/^(?:What is|Find|Determine|Calculate|Compute) the radius of the circle[?.]$/, ["What is the radius of the circle?", "Find the radius of the circle.", "How long is the radius of the circle?", "Determine the radius of this circle.", "The circle has a radius of what length?"]],
      [/^(?:What is|Find|Determine|Calculate|Compute) the circumference of the circle, in terms of π[?.]$/, ["What is the circumference of the circle, in terms of π?", "Find the circumference of the circle, in terms of π.", "How long is the circle's circumference? Give the answer in terms of π.", "Determine the circumference of this circle in terms of π.", "Express the circumference of the circle in terms of π."]],
      [/^What percent of the (.+?) did (\w+) get right\?$/, ["What percent of the $1 did $2 get right?", "What fraction of the $1, as a percent, did $2 answer correctly?", "$2 got what percent of the $1 right?", "Find the percent of the $1 that $2 got right."]],
      [/^What was (\w+)'s percent score\?$/, ["What was $1's percent score?", "Find $1's score as a percent.", "What percent score did $1 earn?", "Determine $1's percent score."]],
      [/^(?:Find|What is) the sum of the coordinates of the center of the circle[?.]$/, ["What is the sum of the x-coordinate and the y-coordinate of the center of the circle?", "Find the sum of the coordinates of the center of the circle.", "If the center is the point (a, b), what is the value of a + b?", "Add the coordinates of the circle's center. What is the sum?", "Determine a + b, where (a, b) is the center of the circle."]],
      [/^If one person is selected at random from those who (.+?), what is the probability that the person is also among those who (.+?)\?$/, ["If one person is selected at random from those who $1, what is the probability that the person is also among those who $2?", "Choose one person at random from those who $1. What is the probability that this person also is among those who $2?", "Among the people who $1, what is the chance that a randomly picked one is also among those who $2?", "Find the probability that a randomly chosen person who $1 is also among those who $2."]],
      [/^What percent of all (\d+) (.+?) (did not .+)\?$/, ["What percent of all $1 $2 $3?", "Find the percent of all $1 $2 who $3.", "Of all $1 $2, what percent $3?", "What share of all $1 $2, as a percent, $3?"]],
      [/^What is the probability that (.+)\?$/, ["What is the probability that $1?", "Find the probability that $1.", "What is the chance that $1?", "Determine the probability that $1.", "How likely is it that $1? Give the probability as a fraction."]],
      [/^(?:What was|Find|What is) the percent (increase|decrease)[?.]$/, ["What was the percent $1?", "By what percent did it $1?", "Find the percent $1.", "Determine the percent $1.", "Express the change as a percent $1."]],
    ];
    for (const [re, alts] of fam) { if (re.test(out)) { out = out.replace(re, rng.pick(alts)); break; } }
  }
  if (question) {
    const m = out.match(/^(What is|Find|Determine|Calculate|Compute|Give) the ([^?.]*)[?.]$/);
    if (m && !out.includes("$")) {
      const rest = m[2];
      out = rng.pick([`What is the ${rest}?`, `Find the ${rest}.`, `Determine the ${rest}.`, `Calculate the ${rest}.`, `Compute the ${rest}.`]);
    }
    out = out.replace(/, in terms of π(?=[?.])/g, () => rng.pick([", in terms of π", ", written in terms of π", ", expressed in terms of π"]));
  } else {
    const sents = out.split(/(?<=\.)\s+/);
    if (sents.length >= 2 && !/\bcenter(ed)?\b|\bSegments?\b/.test(out) && sents.every((s) => !PRON.test(s) && ((s.match(/\$/g) ?? []).length % 2 === 0)) && rng.chance(0.7)) {
      const arr = [...sents];
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
      out = arr.join(" ");
    }
  }
  return out;
}
/** 도입·종결 은행 문장을 떼어 본문(core)만 바꾸고 다시 붙인다. 의미 일치 검사를 재실행한다. */
export function paraphraseInst(rng: Parameters<typeof paraphraseText>[0], inst: Instance): Instance {
  let s = inst.stimulus; let open = ""; let tail = "";
  for (const o of OPEN_NEUTRAL) if (s.startsWith(o)) { open = o; s = s.slice(o.length).trim(); break; }
  for (const x of TAILS) if (s.endsWith(x)) { tail = x; s = s.slice(0, -x.length).trim(); break; }
  const stimulus = [open, paraphraseText(rng, s, false), tail].filter(Boolean).join(" ");
  const question = paraphraseText(rng, inst.question, true);
  const { semBinds, semAsk } = semOf(inst);
  if (semBinds || semAsk) { const issues = semanticIssues(stimulus, question, semBinds ?? [], semAsk); if (issues.length) throw new Error(`[para] ${issues.join("; ")} :: ${stimulus.slice(0, 260)} || ${question.slice(0, 120)}`); }
  return Object.assign(inst, { stimulus, question });
}
export const paraArch = <T extends { generate: (rng: Rng) => Instance }>(a: T): T => ({ ...a, generate: (rng: Rng) => paraphraseInst(rng, a.generate(rng)) });
