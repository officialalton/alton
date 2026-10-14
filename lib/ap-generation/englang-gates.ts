// AP English Language 결정적 게이트(2026-10-14, 무료). 정답을 코드로 확정할 수 없는 과목이라, 형식·근거 존재·분류·중복·저작권 징후·키 편향을 코드로 강제하고
// 정답 자체는 다중 독립 풀이 + 적대적 검토(scripts/ap-generation/englang-pipeline.ts)가 보증한다. 본문: docs/ap/englang-groundwork.md.
import { passageViolations, textStats, countWords } from "./english-text-stats";
import { EL_BANNED_PHRASES, EL_DEVICES, EL_DISTRACTOR_LABELS, EL_OPTION_COUNT, EL_READING_BOUNDS, EL_TOPICS_FOR_SKILL, EL_WRITING_BOUNDS, EL_COGNITIVE } from "./subjects/englang";
import { elangSectionOf } from "../ap-exam/elang-rules";

export type ElKind = "reading" | "writing";
export type ElOptionRaw = { text: string; is_key: boolean; label: string; why: string };
export type ElItemRaw = { skill: string; topic?: string; cognitive: string; stem: string; options: ElOptionRaw[]; evidence_sentence_ids: number[]; devices_used?: string[]; est_seconds?: number };
export type ElBlueprint = {
  speaker?: string; audience?: string; exigence?: string; purpose?: string; context?: string; claim?: string; line_of_reasoning?: string; evidence_types?: string[]; stances?: string[];
  devices?: { device: string; sentence_ids: number[]; function: string }[]; tone_shifts?: { sentence_id: number; from: string; to: string }[]; counterargument?: string;
  planned_flaws?: { sentence_id: number; flaw: string; repair_type: string }[]; genre?: string; theme?: string;
};
export type ElProvenance = { kind: "original" | "public_domain"; author_alias: string; year_alias: number | string; venue_alias?: string; note?: string };
export type ElSetRaw = { kind: ElKind; blueprint: ElBlueprint; provenance: ElProvenance; title: string; paragraphs: string[][]; items: ElItemRaw[] };

const norm = (t: string) => t.replace(/[‘’‛]/g, "'").replace(/[“”„]/g, '"').replace(/—|–/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
export const flattenSentences = (paragraphs: string[][]): string[] => paragraphs.flat();

/** 학생 화면용 지문 문자열. 읽기: 문단 번호 ¶N, 글쓰기: 문장 번호 [N](전체 연속). 첫 줄에 ALTON 원본 표기·제목. */
export function passageDisplay(set: Pick<ElSetRaw, "kind" | "title" | "paragraphs" | "provenance">): string {
  let n = 0;
  const body = set.paragraphs.map((p, i) => (set.kind === "reading" ? `¶${i + 1} ${p.join(" ")}` : p.map((s) => `[${++n}] ${s}`).join(" "))).join("\n\n");
  return `ALTON original passage\n${set.title.trim()}\n\n${body}`;
}
export const passagePlain = (set: Pick<ElSetRaw, "paragraphs">): string => set.paragraphs.map((p) => p.join(" ")).join("\n\n");

// ── 유사도·표절(5-gram) ────────────────────────────────────────────
const toks = (t: string): string[] => norm(t).replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(Boolean);
export const fiveGrams = (t: string): Set<string> => { const w = toks(t); const s = new Set<string>(); for (let i = 0; i + 5 <= w.length; i++) s.add(w.slice(i, i + 5).join(" ")); return s; };
export function longestSharedRun(a: string, b: string): number {
  const x = toks(a), y = toks(b); if (!x.length || !y.length) return 0;
  const pos = new Map<string, number[]>(); y.forEach((w, i) => (pos.get(w) ?? pos.set(w, []).get(w)!).push(i));
  let best = 0; let prev = new Map<number, number>();
  for (const w of x) { const cur = new Map<number, number>(); for (const j of pos.get(w) ?? []) { const l = (prev.get(j - 1) ?? 0) + 1; cur.set(j, l); if (l > best) best = l; } prev = cur; }
  return best;
}
export type CorpusDoc = { id: string; text: string };
/** 새 지문을 기존 코퍼스(내 이전 지문·소스·샘플)와 비교한다. 겹치는 5-gram 비율이 maxShare 를 넘거나 연속 일치가 maxRun 단어 이상이면 위반. */
export function similarityViolations(text: string, corpus: CorpusDoc[], o: { maxShare?: number; maxRun?: number } = {}): string[] {
  const maxShare = o.maxShare ?? 0.04, maxRun = o.maxRun ?? 12; const g = fiveGrams(text); const out: string[] = [];
  for (const d of corpus) {
    const h = fiveGrams(d.text); let hit = 0; g.forEach((x) => h.has(x) && hit++);
    const share = g.size ? hit / g.size : 0;
    if (share > maxShare) out.push(`similar_to_${d.id}_${(share * 100).toFixed(1)}pct_5gram`);
    else { const run = longestSharedRun(text, d.text); if (run >= maxRun) out.push(`shared_run_${run}_words_with_${d.id}`); }
  }
  return out;
}

// ── 지문 게이트 ────────────────────────────────────────────────────
const REAL_PEOPLE = ["abraham lincoln", "martin luther king", "winston churchill", "albert einstein", "barack obama", "donald trump", "joe biden", "john f. kennedy", "franklin roosevelt", "theodore roosevelt", "william shakespeare", "mark twain", "maya angelou", "steve jobs", "bill gates", "elon musk", "mahatma gandhi", "nelson mandela", "malala", "oprah", "jane austen", "charles dickens", "george orwell", "frederick douglass", "susan b. anthony", "rachel carson", "carl sagan", "neil armstrong", "stephen hawking", "emily dickinson", "ralph waldo emerson", "henry david thoreau", "virginia woolf", "ernest hemingway", "toni morrison", "james baldwin", "jfk", "aristotle", "plato", "socrates", "confucius", "napoleon", "darwin", "newton", "galileo", "jane goodall", "greta thunberg", "taylor swift", "lebron james"];
const REAL_ORGS = ["nasa", "the world health organization", "the cdc", "the pew research", "pew research", "gallup", "the united nations", "noaa", "the fbi", "harvard", "stanford", "mit ", "oxford", "the new york times", "the washington post", "wall street journal", "the atlantic", "national geographic", "the bbc", "unesco", "unicef", "the census bureau", "bureau of labor statistics", "college board"];
const BANNED_FORMAT = /(^|\n)\s*([-*•]\s|#{1,6}\s)|\*\*|__|```|<\/?[a-z][^>]*>/;

export function bannedPhraseHits(text: string): string[] { const t = norm(text); return EL_BANNED_PHRASES.filter((p) => t.includes(p)); }
/** 학생 화면은 `$…$` 를 수식으로, 일부 기호를 수식·HTML 로 해석한다(2026-10-13 마이크로 사고). 영어 지문·문항·소스·답안에는 이 문자를 쓰지 않는다(금액은 "12 dollars"). */
export const textHazards = (text: string): string[] => { const h: string[] = []; if (/\$/.test(text)) h.push("dollar_sign"); if (/[\\^_<>{}|~`]/.test(text)) h.push("math_or_markup_char"); return h; };
export function setViolations(set: ElSetRaw): string[] {
  const v: string[] = []; const bounds = set.kind === "reading" ? EL_READING_BOUNDS : EL_WRITING_BOUNDS; const plain = passagePlain(set); const sents = flattenSentences(set.paragraphs);
  for (const x of passageViolations(plain, bounds)) v.push(`passage_${x.replace(/\s+/g, "_")}`);
  const np = set.paragraphs.length; if (set.kind === "reading" ? np < 4 || np > 9 : np < 2 || np > 6) v.push(`paragraph_count_${np}`);
  if (sents.some((s) => !s.trim())) v.push("empty_sentence");
  if (sents.some((s) => !/[.!?]["')”’]?$/.test(s.trim()))) v.push("sentence_missing_end_punctuation");
  if (sents.some((s) => countWords(s) > 70)) v.push("sentence_over_70_words");
  if (BANNED_FORMAT.test(plain)) v.push("markdown_or_html_in_passage");
  for (const h of textHazards(plain + " " + set.title)) v.push(`passage_${h}`);
  if (/[ㄱ-ㆎ가-힣]/.test(plain + set.title)) v.push("hangul_in_passage");
  const ph = bannedPhraseHits(plain); if (ph.length >= 2) v.push(`ai_cliche_phrases_${ph.join("|")}`); else if (ph.length === 1 && textStats(plain).words < 450) v.push(`ai_cliche_phrase_${ph[0]}`);
  const t = norm(plain + " " + set.title); const ppl = REAL_PEOPLE.filter((p) => t.includes(p)); if (ppl.length) v.push(`real_person_${ppl.join("|")}`);
  const org = REAL_ORGS.filter((p) => t.includes(p)); if (org.length) v.push(`real_org_${org.map((x) => x.trim()).join("|")}`);
  const longQuote = (plain.match(/["“][^"”]{140,}["”]/g) ?? []).filter((q) => countWords(q) >= 20); if (longQuote.length) v.push("quote_over_20_words_needs_check");
  if (set.provenance?.kind !== "original") v.push("provenance_not_original");
  if (!set.provenance?.author_alias?.trim()) v.push("provenance_author_alias_missing");
  const bp = set.blueprint ?? {};
  if (set.kind === "reading") {
    for (const f of ["speaker", "audience", "exigence", "purpose", "claim", "line_of_reasoning"] as const) if (!String(bp[f] ?? "").trim()) v.push(`blueprint_missing_${f}`);
    if (!bp.devices?.length || bp.devices.length < 3) v.push("blueprint_devices_fewer_than_3");
  } else {
    for (const f of ["purpose", "audience", "claim"] as const) if (!String(bp[f] ?? "").trim()) v.push(`blueprint_missing_${f}`);
  }
  for (const d of set.kind === "reading" ? bp.devices ?? [] : []) { // 글쓰기 묶음은 수사 장치 인벤토리가 없다(수정 문항은 계획된 결함 planned_flaws 로 점검)
    if (!(EL_DEVICES as readonly string[]).includes(d.device)) v.push(`device_not_in_inventory_${d.device}`);
    if (!d.sentence_ids?.length || d.sentence_ids.some((i) => !Number.isInteger(i) || i < 1 || i > sents.length)) v.push(`device_sentence_out_of_range_${d.device}`);
  }
  for (const s of bp.tone_shifts ?? []) if (!Number.isInteger(s.sentence_id) || s.sentence_id < 1 || s.sentence_id > sents.length) v.push("tone_shift_sentence_out_of_range");
  for (const f of bp.planned_flaws ?? []) if (!Number.isInteger(f.sentence_id) || f.sentence_id < 1 || f.sentence_id > sents.length) v.push("planned_flaw_sentence_out_of_range");
  if (set.items.length < 4) v.push(`items_fewer_than_4_${set.items.length}`);
  return v;
}

// ── 문항 게이트 ────────────────────────────────────────────────────
const SHOWN = /(as shown|is shown|are shown|shown (?:below|above|in the)|in the (?:figure|graph|table|diagram)|the (?:figure|diagram|table) (?:above|below)|(?:graph|table|figure|diagram) (?:above|below)|graph shows|table shows|figure shows|diagram shows)/i;
const GOAL_CUE = /\b(wants?|wishes|intends?|hopes?|goal|aims?|purpose|in order to|so that|to (?:emphasi[sz]e|ensure|clarify|introduce|conclude|acknowledge|qualify|support|show|add|link|connect|strengthen|maintain|convey)|most effectively|best (?:accomplish|achieve|support|fit))\b/i;
const OPTION_BAD = /\b(all of the above|none of the above|both [a-d] and [a-d]|choice [a-d]\b|option [a-d]\b|\([a-d]\))/i;
export const quotedSpans = (t: string): string[] => [...t.matchAll(/["“]([^"”]{2,300})["”]/g)].map((m) => m[1]);
/** 인용 구간(…·... 으로 쪼갠 각 조각)이 지문에 그대로 있는가. */
export function quoteInPassage(span: string, passagePlainText: string): boolean {
  const p = norm(passagePlainText);
  return span.split(/…|\.\.\./).map((x) => norm(x).replace(/^[\s,;:.!?-]+|[\s,;:.!?-]+$/g, "")).filter((x) => x.length >= 2).every((x) => p.includes(x));
}
export function itemViolations(set: ElSetRaw, it: ElItemRaw): string[] {
  const v: string[] = []; const sents = flattenSentences(set.paragraphs); const np = set.paragraphs.length; const plain = passagePlain(set);
  if (elangSectionOf(it.skill) !== set.kind) v.push(`skill_${it.skill}_not_${set.kind}`);
  if (!(EL_TOPICS_FOR_SKILL[it.skill] ?? []).length) v.push("skill_unknown");
  if (it.topic && !(EL_TOPICS_FOR_SKILL[it.skill] ?? []).includes(it.topic)) v.push(`topic_${it.topic}_not_for_skill_${it.skill}`);
  if (!(EL_COGNITIVE as readonly string[]).includes(it.cognitive)) v.push(`cognitive_${it.cognitive}`);
  if (it.options.length !== EL_OPTION_COUNT) v.push(`option_count_${it.options.length}`);
  const keys = it.options.filter((o) => o.is_key); if (keys.length !== 1) v.push(`key_count_${keys.length}`);
  const dis = it.options.filter((o) => !o.is_key);
  const texts = it.options.map((o) => norm(o.text)); if (new Set(texts).size !== texts.length) v.push("duplicate_option_text");
  if (it.options.some((o) => !o.text?.trim() || countWords(o.text) > 48 || countWords(o.text) < 1)) v.push("option_length_out_of_range");
  if (it.options.some((o) => OPTION_BAD.test(o.text))) v.push("option_references_letters_or_all_none");
  if (it.options.some((o) => /[ㄱ-ㆎ가-힣]/.test(o.text))) v.push("hangul_in_option");
  const labels = dis.map((o) => o.label); if (labels.some((l) => !(EL_DISTRACTOR_LABELS as readonly string[]).includes(l))) v.push("distractor_label_invalid");
  if (new Set(labels).size < 2) v.push("distractor_labels_not_diverse");
  if (dis.some((o) => countWords(o.why ?? "") < 6)) v.push("distractor_flaw_missing");
  if (keys[0] && countWords(keys[0].why ?? "") < 8) v.push("key_rationale_missing");
  if (keys[0] && dis.length) { const kw = countWords(keys[0].text), mx = Math.max(...dis.map((o) => countWords(o.text))); if (kw > mx * 1.6 && kw - mx >= 7) v.push("key_much_longer_than_distractors"); }
  if (!it.evidence_sentence_ids?.length || it.evidence_sentence_ids.some((i) => !Number.isInteger(i) || i < 1 || i > sents.length)) v.push("evidence_sentence_missing_or_out_of_range");
  for (const h of textHazards([it.stem, ...it.options.flatMap((o) => [o.text, o.why])].join("\n"))) v.push(`item_${h}`);
  const stem = it.stem ?? ""; const sw = countWords(stem); if (sw < 5 || sw > 100) v.push(`stem_words_${sw}`);
  if (SHOWN.test(stem)) v.push("stem_refers_to_figure_that_does_not_exist");
  if (/[ㄱ-ㆎ가-힣]/.test(stem)) v.push("hangul_in_stem");
  if (set.kind === "reading") {
    for (const m of stem.matchAll(/paragraph\s+(\d+)/gi)) if (Number(m[1]) < 1 || Number(m[1]) > np) v.push(`stem_paragraph_${m[1]}_out_of_range`);
    if (/\b(sentence|line)s?\s+\d+/i.test(stem)) v.push("reading_stem_numbers_sentences_or_lines");
    for (const q of [...quotedSpans(stem), ...it.options.flatMap((o) => quotedSpans(o.text))]) if (!quoteInPassage(q, plain)) v.push(`quote_not_in_passage_${norm(q).slice(0, 40).replace(/\s+/g, "_")}`);
  } else {
    for (const m of stem.matchAll(/sentences?\s+(\d+)(?:\s*(?:,|and|-|–)\s*(\d+))?/gi)) for (const g of [m[1], m[2]]) if (g && (Number(g) < 1 || Number(g) > sents.length)) v.push(`stem_sentence_${g}_out_of_range`);
    for (const m of stem.matchAll(/paragraph\s+(\d+)/gi)) if (Number(m[1]) < 1 || Number(m[1]) > np) v.push(`stem_paragraph_${m[1]}_out_of_range`);
    if (!GOAL_CUE.test(stem)) v.push("writing_stem_has_no_explicit_goal");
    if (!/\b(sentence|paragraph|passage|draft|essay|writer|following)\b/i.test(stem)) v.push("writing_stem_not_anchored");
  }
  const inv = new Set((set.blueprint?.devices ?? []).map((d) => d.device));
  if (set.kind === "reading") for (const d of it.devices_used ?? []) if (!inv.has(d)) v.push(`item_device_${d}_not_in_blueprint_inventory`);
  return v;
}

/** 묶음 안 문항 간 검사: 선지 길이 편향(키가 가장 긴 선지인 문항 비율), 같은 스킬 중복, 같은 stem 중복. */
export function setItemSpread(items: ElItemRaw[]): string[] {
  const v: string[] = []; if (!items.length) return v;
  const longest = items.filter((it) => { const k = it.options.find((o) => o.is_key); if (!k) return false; const kw = countWords(k.text); return it.options.filter((o) => !o.is_key).every((o) => countWords(o.text) < kw); }).length;
  if (items.length >= 4 && longest / items.length > 0.6) v.push(`key_is_longest_in_${longest}_of_${items.length}`);
  const st = items.map((i) => norm(i.stem)); if (new Set(st).size !== st.length) v.push("duplicate_stem");
  return v;
}

// ── 키 위치 균형 ───────────────────────────────────────────────────
function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
/** n 문항의 키 위치(0..3)를 균등하게(각 위치 floor/ceil(n/4)) 섞어 돌려준다. 같은 위치가 3번 연속 나오지 않는다. */
export function balancedKeyPositions(n: number, seed: number): number[] {
  const r = rng(seed); const base: number[] = []; for (let i = 0; i < n; i++) base.push(i % 4);
  for (let t = 0; t < 200; t++) {
    const a = base.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    if (!a.some((x, i) => i >= 2 && x === a[i - 1] && x === a[i - 2])) return a;
  }
  return base;
}
/** 키를 지정 위치로 옮기고 나머지는 시드로 섞은 뒤 {options, key_index} 를 돌려준다. */
export function placeKey<T extends { is_key: boolean }>(options: T[], pos: number, seed: number): { options: T[]; key_index: number } {
  const key = options.find((o) => o.is_key)!; const rest = options.filter((o) => !o.is_key); const r = rng(seed);
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  const out = rest.slice(); out.splice(pos, 0, key); return { options: out, key_index: pos };
}
export function keyPositionViolations(keys: number[], maxShare = 0.4): string[] {
  if (keys.length < 8) return []; const c = [0, 0, 0, 0]; keys.forEach((k) => c[k]++); const mx = Math.max(...c) / keys.length;
  return mx > maxShare ? [`key_position_share_${(mx * 100).toFixed(0)}pct`] : [];
}

// ── 키 신뢰도(결정적 합성) ─────────────────────────────────────────
export type SolverVote = { choice: number | null; confidence: "certain" | "likely" | "unsure" | string; also_defensible?: number | null };
export type AdversaryVerdict = { defensibility: "none" | "weak" | "strong"; alt_index?: number | null };
export type JudgeVerdict = { verdict: "key_clearly_better" | "alt_equally_defensible" | "key_wrong" | string };
export type KeyConfidence = { score: number; band: "high" | "medium" | "low"; solverAgreement: number; pass: boolean; reasons: string[] };
const CONF = { certain: 1, likely: 0.85, unsure: 0.5 } as Record<string, number>;
/** 3 풀이 전원 일치 + 적대적 검토 strong 아님 + 심판 key_clearly_better 가 모두 있어야 통과. 점수는 저장용(0–1). */
export function keyConfidence(o: { keyIndex: number; votes: SolverVote[]; adversary: AdversaryVerdict | null; judge: JudgeVerdict | null; detViolations: string[]; minScore?: number }): KeyConfidence {
  const reasons: string[] = []; const n = o.votes.length;
  const agree = o.votes.filter((x) => x.choice === o.keyIndex).length;
  if (agree < n) reasons.push(`solver_disagreement_${agree}_of_${n}`);
  if (o.votes.some((x) => x.also_defensible !== null && x.also_defensible !== undefined && x.also_defensible !== o.keyIndex)) reasons.push("solver_reports_second_defensible_option");
  if (!o.adversary) reasons.push("adversary_missing"); else if (o.adversary.defensibility === "strong") reasons.push("adversary_strong_alternative");
  if (!o.judge) reasons.push("judge_missing"); else if (o.judge.verdict !== "key_clearly_better") reasons.push(`judge_${o.judge.verdict}`);
  if (o.detViolations.length) reasons.push(`deterministic_${o.detViolations.length}`);
  const solverPart = n ? (o.votes.reduce((a, x) => a + (x.choice === o.keyIndex ? (CONF[x.confidence] ?? 0.7) : 0), 0) / n) * 0.55 : 0;
  const advPart = o.adversary ? (o.adversary.defensibility === "none" ? 0.25 : o.adversary.defensibility === "weak" ? 0.12 : 0) : 0;
  const judgePart = o.judge?.verdict === "key_clearly_better" ? 0.15 : 0;
  const detPart = o.detViolations.length ? 0 : 0.05;
  const score = Number((solverPart + advPart + judgePart + detPart).toFixed(3));
  const pass = reasons.length === 0 && score >= (o.minScore ?? 0.8);
  return { score, band: score >= 0.9 ? "high" : score >= 0.8 ? "medium" : "low", solverAgreement: n ? agree / n : 0, pass, reasons };
}
