// 오답 품질 게이트(2026-10-01): 직접 생성 테스트 탈락 사유 1위가 오답 품질(그럴듯하지 않음 31%, 길이·구체성 불균형 20%)이었다.
// 코드로 판정 가능한 신호는 AI 검수 전에 즉시 탈락시켜 검수 비용을 아끼고, '그럴듯함'은 기존 AI 판정에 맡긴다.
import { LETTERS } from "./answer-position";

export type GateInput = { options: string[]; correct_letter: string; explanation?: string; question?: string };
export type GateResult = { ok: boolean; reasons: string[]; stats: { lengths: number[]; ratio: number; correctRank: number } };

const words = (s: string) => (s.match(/\S+/g) ?? []).length;
const stripU = (s: string) => s.replace(/<\/?u>/g, "");

/** 질문이 '정확한 기술'을 묻지 않는 한 수식어 구문을 따옴표로 인용한 선택지가 둘 이상이면 복수 정답 신호로 보지 않는다 — 단순 규칙만 둔다. */
const HEDGE_ABSOLUTE = /\b(?:always|never|completely|entirely|solely|only|all|none|every|no one|nothing)\b/i;
const OVERLAP_THRESHOLD = 0.6;

const tokenSet = (s: string) => new Set(stripU(s).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2));
const jaccard = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  let i = 0;
  for (const x of a) if (b.has(x)) i++;
  return i / (a.size + b.size - i);
};

export const GATE_LIMITS = {
  /** 가장 긴 선택지 / 가장 짧은 선택지 단어 수 비율 상한(길이 불균형). */
  maxLengthRatio: 1.8,
  /** 정답이 가장 긴 선택지일 때, 2등과의 단어 수 차이가 이 값 이상이면 탈락(차이가 작으면 우연으로 본다). */
  longestCorrectMargin: 2,
  /** 한 선택지가 너무 짧거나 길다(영어 단어 수). */
  minWords: 2,
  maxWords: 40,
} as const;

/** 선택지 4개의 길이 불균형·정답 최장·복수 정답 위험 신호를 판정한다. 통과해도 AI 검수의 그럴듯함 판정은 별도로 받는다. */
export function distractorGate(input: GateInput): GateResult {
  const reasons: string[] = [];
  const opts = input.options.map(stripU);
  const lengths = opts.map(words);
  const ci = LETTERS.indexOf(input.correct_letter as never);
  const stats = { lengths, ratio: Math.max(...lengths) / Math.max(1, Math.min(...lengths)), correctRank: 0 };
  if (opts.length !== 4 || ci < 0) return { ok: false, reasons: ["형식 오류(선택지 4개·정답 글자)"], stats };
  const sorted = [...lengths].sort((a, b) => b - a);
  stats.correctRank = sorted.indexOf(lengths[ci]) + 1; // 1 이면 가장 긴 쪽(동률은 앞 순위)

  if (lengths.some((n) => n < GATE_LIMITS.minWords || n > GATE_LIMITS.maxWords)) reasons.push("선택지 단어 수 범위 밖(2~40)");
  if (stats.ratio > GATE_LIMITS.maxLengthRatio) reasons.push(`선택지 길이 불균형(최장/최단 ${stats.ratio.toFixed(2)} > ${GATE_LIMITS.maxLengthRatio})`);
  if (lengths[ci] === sorted[0] && sorted[0] - sorted[1] >= GATE_LIMITS.longestCorrectMargin) reasons.push(`정답이 가장 긴 선택지(${lengths[ci]}단어, 다음 ${sorted[1]})`);
  // 정답만 쉼표·세미콜론으로 이어진 구체 정보를 담고 오답은 단순한 경우(구체성 불균형)
  const commas = opts.map((o) => (o.match(/[,;:]/g) ?? []).length);
  if (commas[ci] >= 2 && commas.filter((_, i) => i !== ci).every((c) => c === 0)) reasons.push("정답만 구체적(쉼표·절 구분이 정답에만 있음)");

  // 정답만 단정어가 없고 오답이 절대어(always/never…)로 쉽게 소거되는 패턴
  const absolute = opts.map((o) => HEDGE_ABSOLUTE.test(o));
  const wrongAbs = absolute.filter((a, i) => a && i !== ci).length;
  if (!absolute[ci] && wrongAbs >= 2) reasons.push(`오답 ${wrongAbs}개가 절대어(always/never/only 등)로 쉽게 소거됨`);

  // 복수 정답 위험: 정답과 어휘가 거의 같은 오답, 또는 오답끼리 거의 동일
  const sets = opts.map(tokenSet);
  for (let i = 0; i < 4; i++) {
    if (i === ci) continue;
    const j = jaccard(sets[ci], sets[i]);
    if (j >= OVERLAP_THRESHOLD) reasons.push(`복수 정답 위험: 선택지 ${LETTERS[i]} 가 정답과 어휘 ${(j * 100).toFixed(0)}% 중복`);
  }
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    if (i === ci || j === ci) continue;
    if (jaccard(sets[i], sets[j]) >= OVERLAP_THRESHOLD) reasons.push(`오답 ${LETTERS[i]}·${LETTERS[j]} 가 거의 같은 문장`);
  }
  if (new Set(opts.map((o) => o.trim().toLowerCase())).size < 4) reasons.push("동일한 선택지 존재");
  // 'both A and B', 'all of the above' 류는 순열·복수 정답 위험
  if (opts.some((o) => /\b(?:both [A-D]|all of the above|none of the above|[A-D] and [A-D])\b/i.test(o))) reasons.push("선택지 간 참조·'모두/없음' 선택지(복수 정답 위험)");
  return { ok: reasons.length === 0, reasons, stats };
}

/** 배치 단위 점검: 정답이 최장인 비율이 이 값을 넘으면 경고(우연 기대치 25% 대비). */
export function longestCorrectShare(items: GateInput[]): number {
  if (!items.length) return 0;
  let n = 0;
  for (const it of items) {
    const lens = it.options.map((o) => words(stripU(o)));
    const ci = LETTERS.indexOf(it.correct_letter as never);
    if (ci >= 0 && lens[ci] === Math.max(...lens)) n++;
  }
  return n / items.length;
}

// ---- 마지막 문장 직설 재진술 게이트 -----------------------------------------------
const STOP = new Set("that this with from they their them have were been which what when where while about into over than then there also because would could should being these those other some such only more most very just like each both".split(" "));
const contentWords = (s: string) => new Set(stripU(s).toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w)));
const lastSentence = (passage: string) => {
  const parts = stripU(passage).trim().split(/(?<=[.!?]["”']?)\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? "";
};
/** 선택지의 내용어 중 마지막 문장에 나오는 비율. */
const lastOverlap = (opt: string, last: Set<string>) => {
  const w = contentWords(opt);
  if (!w.size) return 0;
  let n = 0;
  for (const x of w) if (last.has(x)) n++;
  return n / w.size;
};
/**
 * 정답이 지문 마지막 문장의 직설 재진술인지 판정한다(직접 생성 테스트의 인물 동기·요지·관계·분위기 0건 수율의 주 원인).
 * 정답의 내용어가 마지막 문장에 많이 겹치고(≥ 0.45) 오답들보다 확연히 높으면(+0.25) 탈락. 시(줄바꿈) 지문은 마지막 줄 기준.
 */
export function restatementGate(passage: string, options: string[], correct_letter: string): { ok: boolean; reason?: string; correct: number; maxWrong: number } {
  const ci = LETTERS.indexOf(correct_letter as never);
  if (ci < 0 || options.length !== 4) return { ok: false, reason: "형식 오류", correct: 0, maxWrong: 0 };
  const lastLine = passage.includes("\n") && passage.trim().split("\n").length >= 4 ? passage.trim().split("\n").pop()! : lastSentence(passage);
  const last = contentWords(lastLine);
  const ratios = options.map((o) => lastOverlap(o, last));
  const maxWrong = Math.max(...ratios.filter((_, i) => i !== ci));
  const correct = ratios[ci];
  if (correct >= 0.45 && correct - maxWrong >= 0.25) return { ok: false, reason: `정답이 마지막 문장의 재진술로 보임(겹침 ${(correct * 100).toFixed(0)}% / 오답 최대 ${(maxWrong * 100).toFixed(0)}%)`, correct, maxWrong };
  return { ok: true, correct, maxWrong };
}
