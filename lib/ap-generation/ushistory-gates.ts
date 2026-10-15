// AP U.S. History 결정적 게이트(2026-10-14, 무료). 정답을 코드로 확정할 수 없는 과목(English 와 같은 계열)이라 형식·근거·분류·중복·날짜 일관성·표 수치·길이 단서를 코드로 강제하고,
// 정답은 다중 독립 풀이 + 제2 모델 패널(scripts/ap-generation/ushistory-pipeline.ts)이 보증한다. 본문: docs/ap/ushistory-groundwork.md.
import { countWords } from "./english-text-stats";
import { fiveGrams, longestSharedRun, textHazards, similarityViolations, type CorpusDoc } from "./englang-gates";
import { USH_BANNED_PHRASES, USH_CANON_DATES, USH_DISTRACTOR_LABELS, USH_MC_SKILLS, USH_OPTION_COUNT, USH_PERIODS, USH_REAL_PEOPLE, USH_STIM_SKILLS, USH_TITLED_SURNAMES, USH_TITLE_WORDS } from "./subjects/ushistory";
import { US_STIMULUS_MARKER } from "../ap-exam/stimulus-display";

export type UshSourceKind = "primary_text" | "secondary_text" | "table" | "chart";
export type UshSource = {
  id: string; kind: UshSourceKind; title: string; attribution: string; body?: string;
  table?: { columns: string[]; rows: (string | number)[][] };
  figure?: { chart: "bar"; title: string; categories: string[]; series: { name: string; values: number[] }[]; xTitle?: string; yTitle?: string; description: string };
  provenance: { kind: "alton_composed"; note: string; real_data?: boolean };
};
export type UshOption = { text: string; is_key: boolean; label: string; why: string };
export type UshDerived = { desc: string; op: "sum" | "diff" | "ratio" | "pct_change" | "max" | "min"; operands: number[]; result: number };
export type UshItemRaw = { skill: string; topic: string; stem: string; options: UshOption[]; source_ref?: string; facts: string[]; derived?: UshDerived[]; est_seconds: number };
export type UshSetRaw = { period: number; stim_type: string; theme: string; title: string; sources: UshSource[]; items: UshItemRaw[] };

const norm = (t: string) => t.replace(/[‘’‛]/g, "'").replace(/[“”„]/g, '"').replace(/—|–/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
export const sourceBody = (s: UshSource): string => (s.table ? `${s.body ?? ""}\n${s.table.columns.join(" ")} ${s.table.rows.map((r) => r.join(" ")).join(" ")}` : s.figure ? `${s.body ?? ""} ${s.figure.description} ${s.figure.categories.join(" ")}` : s.body ?? "").trim();
export const tableMarkdown = (t: { columns: string[]; rows: (string | number)[][] }): string => [`| ${t.columns.join(" | ")} |`, `| ${t.columns.map(() => "---").join(" | ")} |`, ...t.rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
const KIND_LABEL: Record<UshSourceKind, string> = { primary_text: "primary source", secondary_text: "secondary source", table: "table", chart: "chart" };

/** 학생 화면용 자료(set_intro). 표·그래프는 stimulus 그림으로 따로 그려지므로 제목·출처 한 줄만 둔다. */
export function ushStimulusDisplay(sources: UshSource[], opts: { markdownTables?: boolean } = {}): string {
  const multi = sources.length > 1;
  return `${US_STIMULUS_MARKER}\n` + sources.map((s) => {
    const head = `${multi ? `Source ${s.id} ` : ""}(${KIND_LABEL[s.kind]})`;
    const body = s.kind === "table" ? [s.body, opts.markdownTables && s.table ? tableMarkdown(s.table) : "The table for this source appears below."].filter(Boolean).join("\n\n") : s.kind === "chart" ? [s.body, "The chart for this source appears below."].filter(Boolean).join("\n\n") : s.kind === "secondary_text" || s.kind === "primary_text" ? `"${(s.body ?? "").trim()}"` : s.body ?? "";
    return `${head}\n${s.title}\n${s.attribution}\n\n${body}`;
  }).join("\n\n———\n\n");
}
export const ushPassagePlain = (set: Pick<UshSetRaw, "sources">): string => set.sources.map(sourceBody).join("\n\n");

/** 출처 표기(attribution·title)에 실존 인물이 있는가: 전체 이름 또는 직함+성. */
export function realPeopleIn(text: string): string[] {
  const t = norm(text).replace(/alton-composed/g, ""); const out = USH_REAL_PEOPLE.filter((p) => hasWord(t, p));
  for (const s of USH_TITLED_SURNAMES) if (new RegExp(`(?:^|[^a-z])(?:${USH_TITLE_WORDS})\\s+${s}(?:[^a-z]|$)`).test(t)) out.push(s);
  return [...new Set(out)];
}
const hasWord = (t: string, w: string) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(t);
const BANNED_FORMAT = /(^|\n)\s*([-*•]\s|#{1,6}\s)|\*\*|__|```|<\/?[a-z][^>]*>/;
const WORDS = (t: string) => countWords(t);

/** 사건명 바로 뒤에 붙은 4자리 연도가 정설과 다른 경우("Dred Scott decision of 1858"). 허용 연도 목록은 정설 ± 널리 쓰이는 다른 기준. */
const ALLOW: Record<string, number[]> = { seven_years: [1754, 1756, 1763], emancipation: [1862, 1863], war_1812: [1812, 1815], brown: [1954, 1955], texas_annex: [1845, 1844], homestead_act: [1862], constitutional_convention: [1787], jamestown: [1607] };
export function dateConflicts(text: string): string[] {
  const out: string[] = [];
  for (const [id, re, year] of USH_CANON_DATES) {
    const m = new RegExp(`(?:${re.source})[^.;\\n]{0,24}?(?:\\(|,| of | in |, in )\\s*(?:[A-Z][a-z]+ \\d{1,2},? )?(1[4-9]\\d\\d|20[0-2]\\d)`, "gi");
    for (const x of text.matchAll(m)) { const y = Number(x[1]); if (![year, ...(ALLOW[id] ?? [])].includes(y)) out.push(`date_conflict_${id}_${y}_vs_${year}`); }
  }
  return out;
}
/** 문장 안 연도가 시대(Period) 범위에서 지나치게 벗어나는가(자료 본문의 맥락 연도는 허용: 시대 ± 120년 밖만). */
export function yearRangeViolations(text: string, period: number): string[] {
  const [a, b] = USH_PERIODS[period]?.years ?? [1491, 2025]; const out: string[] = [];
  for (const m of text.matchAll(/\b(1[4-9]\d\d|20[0-2]\d)\b/g)) { const y = Number(m[1]); if (y < a - 120 || y > b + 150) out.push(`year_${y}_far_from_period_${period}`); }
  return [...new Set(out)];
}
/** 표·그래프 수치: 자료 표의 행 합계·derived 계산을 코드로 재계산. */
export function derivedViolations(it: UshItemRaw): string[] {
  const v: string[] = [];
  for (const d of it.derived ?? []) {
    const o = d.operands; let r: number | null = null;
    if (!o.every((x) => Number.isFinite(x))) { v.push("derived_operand_not_number"); continue; }
    if (d.op === "sum") r = o.reduce((a, b) => a + b, 0); else if (d.op === "diff" && o.length === 2) r = o[0] - o[1]; else if (d.op === "ratio" && o.length === 2 && o[1] !== 0) r = o[0] / o[1]; else if (d.op === "pct_change" && o.length === 2 && o[0] !== 0) r = ((o[1] - o[0]) / o[0]) * 100; else if (d.op === "max") r = Math.max(...o); else if (d.op === "min") r = Math.min(...o);
    if (r === null) v.push(`derived_bad_op_${d.op}`); else if (Math.abs(r - d.result) > Math.max(0.51, Math.abs(r) * 0.005)) v.push(`derived_mismatch_${d.op}_${r.toFixed(2)}_vs_${d.result}`);
  }
  return v;
}
/** 자료 표의 숫자가 학생 화면 어디에도 없는 수를 쓰는 문항(발명)을 잡는다: 문항 stem·선택지의 연도 아닌 숫자는 자료·derived 결과·잘 알려진 문맥 숫자 중 하나여야 한다. */
export function tableNumberViolations(set: UshSetRaw, it: UshItemRaw): string[] {
  const src = new Set<string>(); for (const s of set.sources) for (const n of sourceBody(s).match(/\d+(?:\.\d+)?/g) ?? []) src.add(String(Number(n)));
  for (const d of it.derived ?? []) { src.add(String(Number(d.result))); d.operands.forEach((x) => src.add(String(x))); }
  const text = [it.stem, ...it.options.map((o) => o.text)].join(" ").replace(/\b(1[4-9]\d\d|20[0-2]\d)\b/g, " ");
  // 자료 숫자에서 파생 가능한 값(차·합·비·변화율, 같은 표 안 모든 쌍)은 선언 없이도 허용한다.
  const base = [...src].map(Number).filter((x) => Number.isFinite(x)); const derivedOk = (n: number): boolean => { for (const a of base) for (const b of base) { if (a === b) continue; for (const d of [a - b, a + b, b !== 0 ? a / b : NaN, b !== 0 ? ((a - b) / b) * 100 : NaN, a !== 0 ? ((b - a) / a) * 100 : NaN]) if (Number.isFinite(d) && Math.abs(Math.abs(d) - n) <= Math.max(0.51, n * 0.02)) return true; } return false; };
  const bad = (text.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) ?? []).map((n) => String(Number(n.replace(/,/g, "")))).filter((n) => Number(n) > 12 && !src.has(n) && !derivedOk(Number(n)));
  return set.sources.some((s) => s.table || s.figure) ? [...new Set(bad)].map((n) => `number_${n}_not_in_data`) : [];
}

export function setViolations(set: UshSetRaw, spec?: { period: number; stim: string }): string[] {
  const v: string[] = []; const plain = ushPassagePlain(set); const body = set.sources.map((s) => s.body ?? "").join("\n");
  if (!USH_PERIODS[set.period]) v.push(`period_${set.period}`); if (spec && set.period !== spec.period) v.push("period_not_as_requested");
  if (!set.title?.trim()) v.push("title_missing");
  if (set.items.length < 3 || set.items.length > 4) v.push(`items_${set.items.length}_not_3_or_4`);
  const kinds = set.sources.map((s) => s.kind); const n = set.sources.length;
  const st = spec?.stim ?? set.stim_type;
  if (st === "primary_text" && !(n === 1 && kinds[0] === "primary_text")) v.push("stim_not_one_primary_text");
  if (st === "secondary_text" && !(n === 1 && kinds[0] === "secondary_text")) v.push("stim_not_one_secondary_text");
  if (st === "paired_text" && !(n === 2 && kinds.every((k) => k === "primary_text" || k === "secondary_text"))) v.push("stim_not_two_texts");
  if (st === "quantitative" && !(n === 1 && (kinds[0] === "table" || kinds[0] === "chart"))) v.push("stim_not_one_table_or_chart");
  for (const [i, s] of set.sources.entries()) {
    if (n > 1 && s.id !== String.fromCharCode(65 + i)) v.push(`source_id_${s.id}`);
    if (!s.attribution?.trim() || !s.title?.trim()) v.push(`source_${s.id}_title_or_attribution_missing`);
    if (!/ALTON-composed/i.test(s.attribution ?? "")) v.push(`source_${s.id}_attribution_not_marked_alton_composed`);
    if (s.provenance?.kind !== "alton_composed") v.push(`source_${s.id}_provenance`);
    const ppl = realPeopleIn(`${s.attribution} ${s.title}`); if (ppl.length) v.push(`source_${s.id}_real_person_in_attribution_${ppl.join("|")}`);
    if (s.kind === "primary_text" || s.kind === "secondary_text") { const w = WORDS(s.body ?? ""); if (w < 50 || w > 230) v.push(`source_${s.id}_words_${w}`); }
    if (s.kind === "table") { const t = s.table; if (!t || t.columns.length < 2 || t.rows.length < 3 || t.rows.length > 10 || t.rows.some((r) => r.length !== t.columns.length)) v.push(`source_${s.id}_table_shape`); }
    if (s.kind === "chart") { const f = s.figure; if (!f || f.categories.length < 3 || f.series.some((x) => x.values.length !== f.categories.length || x.values.some((y) => !Number.isFinite(y)))) v.push(`source_${s.id}_chart_shape`); }
  }
  for (const h of textHazards(plain + " " + set.title)) v.push(`passage_${h}`);
  if (BANNED_FORMAT.test(body)) v.push("markdown_or_html_in_source");
  if (/[ㄱ-ㆎ가-힣]/.test(plain + set.title)) v.push("hangul_in_source");
  const lower = norm(plain); const ph = USH_BANNED_PHRASES.filter((p) => lower.includes(p)); if (ph.length) v.push(`ai_cliche_${ph.join("|")}`);
  if (/\b(according to (?:the )?(?:actual|real|famous)|in (?:his|her) famous (?:speech|letter))\b/i.test(plain)) v.push("presents_source_as_real_historical_text");
  v.push(...dateConflicts(plain), ...yearRangeViolations(body, set.period));
  const stems = set.items.map((i) => norm(i.stem)); if (new Set(stems).size !== stems.length) v.push("duplicate_stem");
  return v;
}
/** 키가 가장 긴 선택지(글자 수 기준, 동률 제외)면 true. 길이 단서 방지. */
export function lengthBias(it: UshItemRaw): boolean {
  const k = it.options.find((o) => o.is_key); if (!k) return false; const kl = k.text.trim().length; return it.options.filter((o) => !o.is_key).every((o) => o.text.trim().length < kl);
}
/** 슬롯(스킬)이 자료 유형에 맞는지(계획기가 요청한 스킬과 같은지는 파이프라인이 본다). */
export const skillsForStim = (stim: string): string[] => [...new Set((USH_STIM_SKILLS[stim] ?? []).flat())];

const OPTION_BAD = /\b(all of the above|none of the above|both [a-d] and [a-d]|choice [a-d]\b|option [a-d]\b|\([a-d]\))/i;
export function itemViolations(set: UshSetRaw, it: UshItemRaw): string[] {
  const v: string[] = [];
  if (!(USH_MC_SKILLS as readonly string[]).includes(it.skill)) v.push(`skill_${it.skill}_not_assessed_in_mc`);
  if (!/^[1-9]\.\d{1,2}$/.test(it.topic ?? "")) v.push(`topic_${it.topic}_bad_format`);
  if (it.options.length !== USH_OPTION_COUNT) v.push(`option_count_${it.options.length}`);
  const keys = it.options.filter((o) => o.is_key); if (keys.length !== 1) v.push(`key_count_${keys.length}`);
  const dis = it.options.filter((o) => !o.is_key);
  const texts = it.options.map((o) => norm(o.text)); if (new Set(texts).size !== texts.length) v.push("duplicate_option_text");
  if (it.options.some((o) => !o.text?.trim() || WORDS(o.text) > 40 || WORDS(o.text) < 2)) v.push("option_length_out_of_range");
  if (it.options.some((o) => OPTION_BAD.test(o.text))) v.push("option_references_letters_or_all_none");
  const labels = dis.map((o) => o.label); if (labels.some((l) => !(USH_DISTRACTOR_LABELS as readonly string[]).includes(l))) v.push("distractor_label_invalid");
  if (dis.some((o) => WORDS(o.why ?? "") < 6)) v.push("distractor_flaw_missing");
  if (keys[0] && WORDS(keys[0].why ?? "") < 8) v.push("key_rationale_missing");
  if (lengthBias(it)) v.push("key_is_longest_option");
  if (keys[0] && dis.length) { const kw = WORDS(keys[0].text), mx = Math.max(...dis.map((o) => WORDS(o.text))); if (kw > mx * 1.6 && kw - mx >= 6) v.push("key_much_longer_than_distractors"); }
  for (const h of textHazards([it.stem, ...it.options.flatMap((o) => [o.text, o.why])].join("\n"))) v.push(`item_${h}`);
  const sw = WORDS(it.stem ?? ""); if (sw < 5 || sw > 80) v.push(`stem_words_${sw}`);
  if (/[ㄱ-ㆎ가-힣]/.test(it.stem + it.options.map((o) => o.text).join(""))) v.push("hangul_in_item");
  if (set.sources.length > 1 && it.skill === "3.C" && !/(both|first|second|two|each|source a|source b|compare)/i.test(it.stem)) v.push("paired_item_not_comparative");
  const all = [it.stem, ...it.options.flatMap((o) => [o.text, o.why])].join("\n");
  v.push(...dateConflicts(all), ...derivedViolations(it), ...tableNumberViolations(set, it));
  if (!set.sources.some((x) => x.table || x.figure) && /\b(shown (?:in|below|above)|as shown|(?:in|from) the (?:figure|graph|chart|table|image|map|illustration))\b/i.test(it.stem)) v.push("stem_refers_to_figure_that_does_not_exist"); // 그림이 없는 텍스트 세트의 "shown in the …" 줄기는 렌더 게이트(figure_referenced_but_missing)에서 탈락한다
  if ((it.facts ?? []).length < 1) v.push("facts_missing");
  return [...new Set(v)];
}
export const ushSimilarity = (text: string, corpus: CorpusDoc[]) => similarityViolations(text, corpus);
export { fiveGrams, longestSharedRun };
