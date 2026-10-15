// AP English Literature 결정적 게이트(2026-10-14, 무료). 정답을 코드로 확정할 수 없는 과목이라, 형식·근거 존재·줄 번호·인용 일치·장치 형태·분류·중복·저작권 징후·키 편향을 코드로 강제하고
// 정답 자체는 다중 독립 풀이 + 적대적 검토 + 제2 모델 패널(scripts/ap-generation/englit-pipeline.ts)이 보증한다. 본문: docs/ap/englit-groundwork.md.
// 줄 번호는 모델이 쓰지 않는다: 문항은 지문 구절(ref)을 인용하고 코드가 줄 범위를 계산해 [[r1]] 자리를 "lines 7-9" 로 바꾼다(lib/ap-exam/passage-lines.ts).
import { countWords } from "./english-text-stats";
import { fiveGrams, longestSharedRun, quoteInPassage, quotedSpans, textHazards, bannedPhraseHits as _unused, type CorpusDoc } from "./englang-gates";
import { LT_BANNED_PHRASES, LT_CODE_CHECKED_DEVICES, LT_COGNITIVE, LT_DEVICES, LT_DISTRACTOR_LABELS, LT_OPTION_COUNT, LT_PASSAGE_BOUNDS, ltTopicFor, type LtForm } from "./subjects/englit";
import { countedLines, flatWithBreaks, litPassageDisplay, litPassageForModels, locateQuote, rangeText, wrapParagraph } from "../ap-exam/passage-lines";
import { englitCategoryOf, type EnglitGroup } from "../ap-exam/englit-rules";
void _unused;

export type LtOptionRaw = { text: string; is_key: boolean; label: string; why: string };
export type LtRef = { id: string; quote: string };
export type LtItemRaw = { skill: string; cognitive: string; stem: string; options: LtOptionRaw[]; refs: LtRef[]; evidence_quotes: string[]; devices_used?: string[]; est_seconds?: number };
export type LtDevice = { device: string; quote: string; function: string };
export type LtBlueprint = { speaker?: string; addressee?: string; situation?: string; central_idea?: string; complexity?: string; form_notes?: string; devices?: LtDevice[]; shifts?: { quote: string; from: string; to: string }[]; characters?: string[]; setting?: string; conflict?: string; era?: string };
export type LtProvenance = { kind: "original" | "public_domain"; author_alias: string; year_alias: number | string; note?: string };
export type LtSetRaw = { group: EnglitGroup; form: LtForm; title: string; headnote?: string; blueprint: LtBlueprint; provenance: LtProvenance; stanzas: string[][]; items: LtItemRaw[] };

const norm = (t: string) => t.replace(/[‘’‛]/g, "'").replace(/[“”„]/g, '"').replace(/—|–/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
export const passagePlain = (set: Pick<LtSetRaw, "stanzas">): string => countedLines(set.stanzas).map((l) => l.trim()).join(" ");
export const passageText = (set: Pick<LtSetRaw, "stanzas">): string => set.stanzas.map((s) => s.join("\n")).join("\n\n");
export const ltDisplay = (set: Pick<LtSetRaw, "title" | "provenance" | "stanzas" | "form"> & { headnote?: string }): string =>
  litPassageDisplay({ title: set.title, attribution: [`by ${set.provenance.author_alias}`, set.headnote?.trim() ?? ""].filter(Boolean).join("\n"), stanzas: set.stanzas });
export const ltForModels = (set: Pick<LtSetRaw, "title" | "stanzas"> & { headnote?: string }): string => { const base = litPassageForModels(set); const h = set.headnote?.trim(); return h ? base.replace(`${set.title.trim()}\n\n`, `${set.title.trim()}\n${h}\n\n`) : base; };
/** 모델이 낸 산문 문단 배열 → 줄로 접은 stanzas(문단 = 한 덩어리). */
export const proseStanzas = (paragraphs: string[]): string[][] => paragraphs.map((p) => wrapParagraph(p)).filter((l) => l.length);
export const proseParagraphs = (set: Pick<LtSetRaw, "stanzas">): string[] => set.stanzas.map((s) => s.map((l) => l.trim()).join(" "));

// ── 유사도 ─────────────────────────────────────────────────────────
export function similarityViolations(text: string, corpus: CorpusDoc[], o: { maxShare?: number; maxRun?: number } = {}): string[] {
  const maxShare = o.maxShare ?? 0.04, maxRun = o.maxRun ?? 10; const g = fiveGrams(text); const out: string[] = [];
  for (const d of corpus) { const h = fiveGrams(d.text); let hit = 0; g.forEach((x) => h.has(x) && hit++); const share = g.size ? hit / g.size : 0; if (share > maxShare) out.push(`similar_to_${d.id}_${(share * 100).toFixed(1)}pct_5gram`); else { const run = longestSharedRun(text, d.text); if (run >= maxRun) out.push(`shared_run_${run}_words_with_${d.id}`); } }
  return out;
}
// ── 지문 게이트 ────────────────────────────────────────────────────
const REAL_AUTHORS = ["shakespeare", "emily dickinson", "walt whitman", "robert frost", "langston hughes", "maya angelou", "sylvia plath", "william blake", "wordsworth", "keats", "shelley", "byron", "tennyson", "browning", "milton", "chaucer", "yeats", "eliot", "pound", "auden", "neruda", "rilke", "poe", "hemingway", "faulkner", "fitzgerald", "austen", "dickens", "bronte", "hardy", "woolf", "joyce", "kafka", "chekhov", "tolstoy", "dostoevsky", "hawthorne", "melville", "twain", "wilde", "ibsen", "beckett", "achebe", "morrison", "walker", "baldwin", "ellison", "hurston", "o'connor", "carver", "munro", "lahiri", "ishiguro", "marquez", "borges", "joseph conrad", "kate chopin", "gaskell", "elizabeth bishop", "seamus heaney", "mary oliver", "billy collins", "gwendolyn brooks", "ocean vuong", "naomi shihab nye"];
const REAL_ORGS = ["the new york times", "harvard", "oxford", "cambridge", "college board", "nobel", "the bible", "quran", "bbc", "nasa"];
const hasWord = (text: string, name: string): boolean => new RegExp(`(^|[^a-z])${name.trim().replace(/[.*+?^()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(text);
const BANNED_FORMAT = /(^|\n)\s*([-*•]\s|#{1,6}\s)|\*\*|__|```|<\/?[a-z][^>]*>/;
export const ltBannedHits = (text: string): string[] => { const t = norm(text); return LT_BANNED_PHRASES.filter((p) => t.includes(p)); };
const isAllowedAllusionName = (t: string) => t; void isAllowedAllusionName;
const STOP = new Set(["the", "a", "an", "of", "and", "to", "in", "on", "at", "for", "with", "by", "from", "as", "is", "was", "it", "its", "his", "her", "my", "your", "our", "their", "that", "this", "or", "but", "not", "no", "so", "if", "he", "she", "i", "we", "you", "they"]);
const words = (t: string) => norm(t).replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean);

/** 장치 근거 구절의 형태 검증(코드로 확인 가능한 장치만). 위반 코드 목록. */
export function deviceViolations(d: LtDevice, stanzas: string[][]): string[] {
  const out: string[] = []; const loc = locateQuote(stanzas, d.quote); const q = norm(d.quote); const w = words(d.quote);
  if (!loc.ok) { if (loc.reason === "not_found") out.push(`device_quote_not_in_passage_${d.device}`); else if (loc.reason === "too_short") out.push(`device_quote_too_short_${d.device}`); return out; }
  const lines = countedLines(stanzas);
  if (d.device === "simile" && !/(^| )(like|as|than)( |$)/.test(q)) out.push("simile_without_like_as_than");
  if (d.device === "enjambment") { const last = lines[loc.to - 1]?.trim() ?? ""; if (loc.to >= lines.length || /[.!?;:]["')”’]?$/.test(last)) out.push("enjambment_line_end_is_stopped"); }
  if (d.device === "caesura" && !/[,;:.!?—–-]/.test(d.quote.replace(/[,;:.!?]+$/g, "").replace(/^\W+/, ""))) out.push("caesura_without_midline_pause");
  if (d.device === "alliteration") { const c = w.filter((x) => !STOP.has(x)).map((x) => x[0]); const top = Math.max(0, ...[...new Set(c)].map((l) => c.filter((x) => x === l).length)); if (top < 3) out.push("alliteration_fewer_than_3_shared_initials"); }
  if (d.device === "anaphora") { const starts = lines.slice(loc.from - 1, loc.to).map((l) => words(l)[0]).filter(Boolean); if (starts.length < 2 || new Set(starts).size === starts.length) out.push("anaphora_without_repeated_line_opening"); }
  return out;
}

export function setViolations(set: LtSetRaw): string[] {
  const v: string[] = []; const b = LT_PASSAGE_BOUNDS[set.form]; const plain = passagePlain(set); const wc = countWords(plain); const lines = countedLines(set.stanzas);
  if (wc < b.minWords || wc > b.maxWords) v.push(`passage_words_${wc}_outside_${b.minWords}-${b.maxWords}`);
  if (lines.length < b.minLines || lines.length > b.maxLines) v.push(`passage_lines_${lines.length}_outside_${b.minLines}-${b.maxLines}`);
  if (set.form === "poem") { if (set.stanzas.length < 1 || set.stanzas.length > 9) v.push(`stanza_count_${set.stanzas.length}`); if (lines.some((l) => countWords(l) > 16)) v.push("poem_line_over_16_words"); }
  else { if (set.stanzas.length < 4 || set.stanzas.length > 14) v.push(`paragraph_count_${set.stanzas.length}`); const sents = plain.split(/(?<=[.!?])["')”’]?\s+/); if (sents.some((s) => countWords(s) > 80)) v.push("sentence_over_80_words"); }
  if (BANNED_FORMAT.test(passageText(set))) v.push("markdown_or_html_in_passage");
  for (const h of textHazards(passageText(set) + " " + set.title)) v.push(`passage_${h}`);
  if (/[ㄱ-ㆎ가-힣]/.test(plain + set.title)) v.push("hangul_in_passage");
  const ph = ltBannedHits(plain); if (ph.length >= 2) v.push(`ai_cliche_phrases_${ph.join("|")}`); else if (ph.length === 1 && wc < 300) v.push(`ai_cliche_phrase_${ph[0]}`);
  const t = norm(plain + " " + set.title + " " + set.provenance.author_alias); const au = REAL_AUTHORS.filter((p) => hasWord(t, p)); if (au.length) v.push(`real_author_or_title_${au.join("|")}`);
  const og = REAL_ORGS.filter((p) => hasWord(t, p)); if (og.length) v.push(`real_org_${og.join("|")}`);
  if (set.provenance?.kind !== "original") v.push("provenance_not_original"); if (!set.provenance?.author_alias?.trim()) v.push("provenance_author_alias_missing");
  const bp = set.blueprint ?? {}; const devs = bp.devices ?? [];
  if (set.form === "poem") for (const f of ["speaker", "situation", "central_idea", "complexity"] as const) { if (!String(bp[f] ?? "").trim()) v.push(`blueprint_missing_${f}`); }
  else for (const f of ["situation", "central_idea", "complexity", "setting"] as const) { if (!String(bp[f] ?? "").trim()) v.push(`blueprint_missing_${f}`); }
  if (devs.length < 5) v.push("blueprint_devices_fewer_than_5");
  for (const d of devs) { if (!(LT_DEVICES as readonly string[]).includes(d.device)) v.push(`device_not_in_inventory_${d.device}`); if (!String(d.quote ?? "").trim()) v.push("device_quote_missing"); else if ((LT_CODE_CHECKED_DEVICES as readonly string[]).includes(d.device) || true) v.push(...deviceViolations(d, set.stanzas)); }
  for (const s of bp.shifts ?? []) { const l = locateQuote(set.stanzas, s.quote); if (!l.ok && l.reason === "not_found") v.push("shift_quote_not_in_passage"); }
  if (set.items.length < 8) v.push(`items_fewer_than_8_${set.items.length}`);
  return v;
}

// ── ref 해석 ───────────────────────────────────────────────────────
const TOKEN = /\[\[\s*(r\d+)\s*\]\]/g;
export type ResolvedItem = { stem: string; options: LtOptionRaw[]; violations: string[]; refLines: Record<string, { from: number; to: number }> };
export function resolveItem(set: Pick<LtSetRaw, "stanzas">, it: LtItemRaw): ResolvedItem {
  const violations: string[] = []; const refLines: Record<string, { from: number; to: number }> = {}; const ids = new Set<string>();
  for (const r of it.refs ?? []) { if (!/^r\d+$/.test(r.id)) { violations.push("ref_id_invalid"); continue; } if (ids.has(r.id)) violations.push(`ref_duplicate_${r.id}`); ids.add(r.id); const loc = locateQuote(set.stanzas, r.quote); if (!loc.ok) violations.push(`ref_${r.id}_${loc.reason}`); else refLines[r.id] = { from: loc.from, to: loc.to }; }
  const sub = (t: string): string => t.replace(TOKEN, (_m, id: string) => { const x = refLines[id]; if (!x) { if (!ids.has(id)) violations.push(`token_${id}_has_no_ref`); return "[unresolved]"; } return rangeText(x.from, x.to); });
  const used = new Set<string>(); const all = [it.stem, ...it.options.flatMap((o) => [o.text, o.why])]; for (const t of all) for (const m of t.matchAll(TOKEN)) used.add(m[1]);
  for (const id of ids) if (!used.has(id)) violations.push(`ref_${id}_unused`);
  return { stem: sub(it.stem), options: it.options.map((o) => ({ ...o, text: sub(o.text), why: sub(o.why) })), violations, refLines };
}

// ── 문항 게이트 ────────────────────────────────────────────────────
const SHOWN = /(as shown|is shown|are shown|shown (?:below|above|in the)|in the (?:figure|graph|table|diagram)|(?:figure|diagram|table|graph) (?:above|below))/i;
const OPTION_BAD = /\b(all of the above|none of the above|both [a-d] and [a-d]|choice [a-d]\b|option [a-d]\b|\([a-d]\))/i;
const ORD = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
const HAND_LINE = /\blines?\s+\d|\bll?\.\s*\d/i;
const ALLOWED_SKILLS_BY_FORM: Record<LtForm, string[]> = { poem: [], prose: [], drama: [] }; void ALLOWED_SKILLS_BY_FORM;
const cc = (t: string) => t.replace(/\s+/g, " ").trim().length;
/** 키가 유일하게 가장 긴 선지이고 오답 평균 길이의 1.12배 이상이면 길이 단서(글자 수). */
export function lengthCueRatio(it: Pick<LtItemRaw, "options">): number {
  const k = it.options.find((o) => o.is_key); const d = it.options.filter((o) => !o.is_key); if (!k || !d.length) return 0;
  const kl = cc(k.text); const dl = d.map((o) => cc(o.text)); if (!dl.every((x) => x < kl)) return 0; return kl / (dl.reduce((a, b) => a + b, 0) / dl.length);
}
export const LENGTH_CUE_RATIO = 1.12;
export function itemViolations(set: LtSetRaw, it: LtItemRaw, resolved?: ResolvedItem): string[] {
  const v: string[] = []; const r = resolved ?? resolveItem(set, it); const plain = passagePlain(set);
  v.push(...r.violations);
  if (englitCategoryOf(it.skill) === null || it.skill === "7.E") v.push(`skill_${it.skill}_not_assessable_in_mc`);
  if (!(LT_COGNITIVE as readonly string[]).includes(it.cognitive)) v.push(`cognitive_${it.cognitive}`);
  if (it.options.length !== LT_OPTION_COUNT) v.push(`option_count_${it.options.length}`);
  const keys = it.options.filter((o) => o.is_key); if (keys.length !== 1) v.push(`key_count_${keys.length}`);
  const dis = it.options.filter((o) => !o.is_key);
  const texts = it.options.map((o) => norm(o.text)); if (new Set(texts).size !== texts.length) v.push("duplicate_option_text");
  if (it.options.some((o) => !o.text?.trim() || countWords(o.text) > 50)) v.push("option_length_out_of_range");
  if (it.options.some((o) => OPTION_BAD.test(o.text))) v.push("option_references_letters_or_all_none");
  if (it.options.some((o) => /[ㄱ-ㆎ가-힣]/.test(o.text))) v.push("hangul_in_option");
  const labels = dis.map((o) => o.label); if (labels.some((l) => !(LT_DISTRACTOR_LABELS as readonly string[]).includes(l))) v.push("distractor_label_invalid"); if (new Set(labels).size < 2) v.push("distractor_labels_not_diverse");
  if (dis.some((o) => countWords(o.why ?? "") < 6)) v.push("distractor_flaw_missing"); if (keys[0] && countWords(keys[0].why ?? "") < 8) v.push("key_rationale_missing");
  const evid = it.evidence_quotes ?? []; if (!evid.length) v.push("evidence_quote_missing"); for (const q of evid) if (!quoteInPassage(q, plain)) v.push(`evidence_quote_not_in_passage_${norm(q).slice(0, 30).replace(/\s+/g, "_")}`);
  const hazardText = [r.stem, ...r.options.flatMap((o) => [o.text, o.why])].join("\n"); for (const h of textHazards(hazardText)) v.push(`item_${h}`);
  const raw = [it.stem, ...it.options.flatMap((o) => [o.text, o.why])].join("\n"); if (HAND_LINE.test(raw)) v.push("hand_written_line_number");
  const sw = countWords(r.stem); if (sw < 5 || sw > 110) v.push(`stem_words_${sw}`); if (SHOWN.test(r.stem)) v.push("stem_refers_to_figure_that_does_not_exist"); if (/[ㄱ-ㆎ가-힣]/.test(r.stem)) v.push("hangul_in_stem");
  const spans = [...quotedSpans(r.stem), ...r.options.flatMap((o) => quotedSpans(o.text))]; for (const q of spans) if (!quoteInPassage(q, plain)) v.push(`quote_not_in_passage_${norm(q).slice(0, 40).replace(/\s+/g, "_")}`);
  // 연·문단 서수 범위
  const nUnits = set.stanzas.length; const unitWord = set.form === "poem" ? "stanza" : "paragraph";
  for (const m of r.stem.matchAll(new RegExp(`\\b(${ORD.join("|")}|last|final)\\s+${unitWord}`, "gi"))) { const o = m[1].toLowerCase(); const idx = ORD.indexOf(o); if (idx >= nUnits) v.push(`stem_${o}_${unitWord}_out_of_range`); }
  for (const m of r.stem.matchAll(new RegExp(`${unitWord}\\s+(\\d+)`, "gi"))) if (Number(m[1]) < 1 || Number(m[1]) > nUnits) v.push(`stem_${unitWord}_${m[1]}_out_of_range`);
  if (set.form === "poem" && /\bparagraph\b/i.test(r.stem)) v.push("poem_stem_says_paragraph");
  if (set.form !== "poem" && /\bstanza\b/i.test(r.stem)) v.push("prose_stem_says_stanza");
  // 장치
  const inv = new Set((set.blueprint?.devices ?? []).map((d) => d.device)); for (const d of it.devices_used ?? []) if (!inv.has(d)) v.push(`item_device_${d}_not_in_blueprint_inventory`);
  const needs: Record<string, string> = { "6.A": "simile", "6.B": "metaphor|extended_metaphor", "6.C": "personification", "6.D": "allusion" };
  if (needs[it.skill] && !(it.devices_used ?? []).some((d) => new RegExp(`^(${needs[it.skill]})$`).test(d))) v.push(`skill_${it.skill}_without_${needs[it.skill]}_device`);
  if (it.skill === "6.D") for (const d of (set.blueprint?.devices ?? []).filter((x) => x.device === "allusion")) if (/\b(president|senator|actor|singer|company|brand)\b/i.test(d.function)) v.push("allusion_to_real_person_or_brand");
  return v;
}
export const topicOf = (skill: string, group: EnglitGroup, i: number) => ltTopicFor(skill, group, i);

/** 묶음 안 문항 간 검사: 키가 가장 긴 선지인 문항 비율, 같은 stem 중복. */
export function setItemSpread(items: LtItemRaw[]): string[] {
  const v: string[] = []; if (!items.length) return v;
  const longest = items.filter((it) => lengthCueRatio(it) >= LENGTH_CUE_RATIO).length; if (items.length >= 6 && longest / items.length > 0.4) v.push(`length_cue_in_${longest}_of_${items.length}`);
  const st = items.map((i) => norm(i.stem)); if (new Set(st).size !== st.length) v.push("duplicate_stem");
  return v;
}
