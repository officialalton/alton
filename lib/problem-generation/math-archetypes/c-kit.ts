// C 담당(percentages·area_volume·circles·ratios/probability easy·medium) 공용 도구 — π 선지, 문장-변수 의미 일치 기계 검사.
import { fmtNum } from "./text";
import type { Instance } from "./types";

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
export const DOWN = ["decrease", "decreased", "decreases", "discount", "off", "fell", "falls", "drop", "dropped", "reduced", "reduce", "shrank", "shrinks", "markdown", "lower", "cut", "went down", "marked down", "goes down"];
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
    if (!ask.words.some((w) => cueRe(w).test(q) || q.includes(w.toLowerCase()))) issues.push(`질문에 구하는 양 명사 [${ask.words.join("/")}] 가 없음`);
    for (const f of ask.forbid ?? []) if (new RegExp(`\\b${f}\\b`, "i").test(question)) issues.push(`질문에 다른 양의 명사 '${f}' 가 섞여 있음`);
  }
  return issues;
}
/** 인스턴스 생성 끝에서 호출 — 위반이면 일반 Error(=시드 스윕에서 '예외'로 집계, 테스트 실패). 점검 포인트 문자열을 인스턴스에 붙인다. */
export function sem(inst: Instance, binds: Bind[], ask?: AskSpec, note?: string): Instance {
  const issues = semanticIssues(inst.stimulus, inst.question, binds, ask);
  if (issues.length) throw new Error(`[sem] ${issues.join("; ")}`);
  const parts = [...binds.map((b) => `${b.v}=${b.words[0]}`), ask ? `ask=${ask.words[0]}` : ""].filter(Boolean);
  Object.assign(inst, { semNote: note ?? parts.join(", ") });
  return inst;
}
export const semNoteOf = (inst: Instance) => (inst as Instance & { semNote?: string }).semNote ?? "";

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
