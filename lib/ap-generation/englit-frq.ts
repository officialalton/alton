// AP English Literature FRQ 프롬프트 세트의 **안정 JSON 스키마**(lit-frq-1)와 결정적 게이트(2026-10-14). 본문·필드 설명: docs/ap/englit-groundwork.md.
// AI 채점 기능(lib/essay-grading)은 payload.lit_frq 만 읽는다: 과제문·지문(시/산문, 줄 번호 모델)·루브릭(데이터)·3단계 주석 샘플. 루브릭 구조는 CED 공개 분석 루브릭(논지 0–1 · 증거와 해설 0–4 · 정교함 0–1)이며 문안은 ALTON 요약이다.
import { countWords } from "./english-text-stats";
import { fiveGrams, longestSharedRun, quoteInPassage, quotedSpans, textHazards } from "./englang-gates";
import { LT_BANNED_PHRASES, LT_FRQ_BOUNDS, LT_WORKS_LIST } from "./subjects/englit";
import { litPassageDisplay, countedLines } from "../ap-exam/passage-lines";

export const LT_FRQ_SCHEMA_VERSION = "lit-frq-1" as const;
export type LtFrqTemplate = "q1" | "q2" | "q3";
export type LtFrqTaskType = "poetry_analysis" | "prose_analysis" | "literary_argument";
export const LT_FRQ_TYPE_BY_TEMPLATE: Record<LtFrqTemplate, LtFrqTaskType> = { q1: "poetry_analysis", q2: "prose_analysis", q3: "literary_argument" };
export type LtRubricRow = { row_id: "A" | "B" | "C"; name: string; max: number; descriptors: Record<string, string>; task_specific: string };
export type LtAnnotation = { quote: string; comment: string; row_id: "A" | "B" | "C" };
export type LtSample = { tier: "high" | "mid" | "low"; target_total: number; essay: string; word_count: number; rubric_scores: { A: number; B: number; C: number; total: number }; annotations: LtAnnotation[]; work_chosen?: string };
export type LtFrqPassage = { form: "poem" | "prose"; title: string; attribution: string; headnote?: string; stanzas: string[][]; line_count: number; provenance: { kind: "original"; author_alias: string; year_alias: number | string } };
export type LtFrqPayload = {
  schema_version: typeof LT_FRQ_SCHEMA_VERSION; task_type: LtFrqTaskType; template: LtFrqTemplate; title: string;
  prompt: { lead?: string; task: string; requirements: string[] };
  passage?: LtFrqPassage; works_list?: { title: string; author: string }[];
  rubric: { total_points: 6; rows: LtRubricRow[]; scoring_notes: string[] };
  expected_features: { defensible_positions?: string[]; devices?: { device: string; quote: string; effect: string }[]; lines_of_reasoning?: string[]; common_pitfalls?: string[] };
  samples: LtSample[];
  blueprint: { central_idea?: string; complexity?: string; devices?: { device: string; quote: string; function: string }[]; concept?: string };
  provenance: { kind: "original"; note: string };
};

/** 루브릭 3행의 공통 수준 설명(ALTON 요약). 과제별 task_specific 문구는 모델이 쓴다. */
export const LT_RUBRIC_DESCRIPTORS = {
  A: { name: "Thesis", max: 1, descriptors: { "0": "No defensible thesis: the response only restates the prompt, summarizes or describes the text, makes a comment that does not answer the prompt, or never states an interpretation that needs to be defended.", "1": "The response states a defensible interpretation that answers the prompt (it may take more than one sentence and may appear anywhere in the essay)." } },
  B: { name: "Evidence and commentary", max: 4, descriptors: {
    "0": "Restates the thesis or the prompt, repeats given information, or offers irrelevant material; no usable evidence or commentary.",
    "1": "Evidence is mostly general; the response summarizes or paraphrases and does not explain how the evidence supports an argument.",
    "2": "Some specific, relevant evidence, mixed with generalities. Explains how some evidence relates to the argument, but no line of reasoning is established or it is faulty.",
    "3": "Specific evidence for the claims in a line of reasoning, and explains how some of that evidence supports the line of reasoning, including how at least one literary element or technique contributes to meaning.",
    "4": "Specific evidence supports every claim in a line of reasoning, the commentary consistently explains how the evidence supports it, and it explains how multiple literary elements or techniques contribute to meaning. Errors that interfere with communication prevent this level.",
  } },
  C: { name: "Sophistication", max: 1, descriptors: { "0": "Does not meet the criteria for the point: contextualizing is limited to sweeping generalities, other readings are only hinted at, complexity is oversimplified, or elaborate language does not advance the argument.", "1": "Shows sophistication of thought or develops a complex literary argument, sustained through the essay (not a phrase): explores tensions or complexities in the text, situates the interpretation in a broader context, accounts for alternative interpretations, or uses a consistently vivid and persuasive style." } },
} as const;
export const LT_Q3_ROW_B_NOTE = "For the literary argument question the evidence comes from the work the student chooses: it must be specific and accurate, and the commentary must explain how the named concept contributes to an interpretation of the whole work rather than summarize the plot.";

export const frqNorm = (t: string) => t.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();
export const passageWords = (p: Pick<LtFrqPassage, "stanzas">): number => countWords(countedLines(p.stanzas).join(" "));
export const frqPassageText = (p: Pick<LtFrqPassage, "stanzas">): string => countedLines(p.stanzas).map((l) => l.trim()).join(" ");

/** 학생이 보는 과제문(파트 A 의 prompt). Q3 는 작품 목록을 붙인다. */
export function frqTaskText(p: LtFrqPayload): string {
  const list = p.works_list?.length ? `Works you may choose from (or choose another work of fiction you know well):\n${p.works_list.map((w) => `- ${w.title}, ${w.author}`).join("\n")}` : "";
  return [p.prompt.lead ?? "", p.prompt.task, p.prompt.requirements.length ? `Your essay should:\n${p.prompt.requirements.map((r) => `- ${r}`).join("\n")}` : "", list].filter(Boolean).join("\n\n");
}
/** 학생 화면용 지문(set_intro): Q1·Q2 는 줄 번호 펜스, Q3 는 없음. */
export function frqPassageDisplay(p: LtFrqPayload): string {
  if (!p.passage) return "";
  return litPassageDisplay({ title: p.passage.title, attribution: [p.passage.attribution, p.passage.headnote].filter(Boolean).join("\n"), stanzas: p.passage.stanzas });
}
export function frqReferenceText(p: LtFrqPayload): string {
  const out: string[] = ["Reference answer and scoring notes (ALTON-authored; not official College Board scoring). Compare your essay with this guide; no AP score is estimated.", ""];
  out.push("Scoring guide (6 points): Thesis 0-1, Evidence and commentary 0-4, Sophistication 0-1.");
  for (const r of p.rubric.rows) out.push(`${r.name} (0-${r.max}): ${r.task_specific}`);
  for (const n of p.rubric.scoring_notes) out.push(`Note: ${n}`);
  for (const s of p.samples) { out.push("", `Sample essay (${s.tier}; scored ${s.rubric_scores.total}/6: thesis ${s.rubric_scores.A}, evidence ${s.rubric_scores.B}, sophistication ${s.rubric_scores.C})`, s.essay.trim()); for (const a of s.annotations) out.push(`- Row ${a.row_id}: "${a.quote}" - ${a.comment}`); }
  return out.join("\n");
}
export function normalizeFrqPayload(p: LtFrqPayload): LtFrqPayload {
  const rows = (["A", "B", "C"] as const).map((id) => { const given = p.rubric?.rows?.find((r) => r.row_id === id); const base = LT_RUBRIC_DESCRIPTORS[id]; return { row_id: id, name: base.name, max: base.max, descriptors: { ...base.descriptors }, task_specific: String(given?.task_specific ?? "") }; });
  return { ...p, rubric: { total_points: 6, rows, scoring_notes: [...(p.rubric?.scoring_notes ?? []), ...(p.task_type === "literary_argument" ? [LT_Q3_ROW_B_NOTE] : [])].filter((x, i, a) => a.indexOf(x) === i) } };
}

const REAL_NAMES = ["shakespeare", "dickinson", "whitman", "frost", "hughes", "angelou", "plath", "blake", "wordsworth", "keats", "shelley", "byron", "tennyson", "browning", "milton", "chaucer", "yeats", "auden", "neruda", "rilke", "poe", "hemingway", "faulkner", "austen", "dickens", "hardy", "woolf", "joyce", "kafka", "chekhov", "tolstoy", "hawthorne", "melville", "twain", "wilde", "ibsen", "morrison"];
const hasWord = (text: string, name: string) => new RegExp(`(^|[^a-z])${name}([^a-z]|$)`).test(text);
/** 샘플 답안의 줄 단위 인용(따옴표 안 3단어 이상)이 지문에 그대로 있는가 — 지문 없는 Q3 는 검사하지 않는다. */
export function sampleQuoteViolations(essay: string, passage: string): string[] {
  const out: string[] = []; for (const q of quotedSpans(essay)) { if (q.split(/\s+/).length < 3) continue; if (!quoteInPassage(q.replace(/\s*\/\s*/g, " "), passage)) out.push(`sample_quote_not_in_passage_${frqNorm(q).slice(0, 30).replace(/\s+/g, "_")}`); }
  return out;
}
export const LT_SAMPLE_WORDS = { high: [380, 800], mid: [250, 560], low: [110, 360] } as const;
export function frqViolations(p: LtFrqPayload, prior: { id: string; text: string }[] = []): string[] {
  const v: string[] = []; const t = p.template;
  if (p.schema_version !== LT_FRQ_SCHEMA_VERSION) v.push("schema_version"); if (LT_FRQ_TYPE_BY_TEMPLATE[t] !== p.task_type) v.push("template_task_type_mismatch");
  if (!p.prompt?.task?.trim()) v.push("prompt_task_missing"); if ((p.prompt?.requirements ?? []).length < 2) v.push("prompt_requirements_fewer_than_2");
  const studentText = [p.title, p.prompt?.lead ?? "", p.prompt?.task ?? "", ...(p.prompt?.requirements ?? [])].join("\n");
  for (const h of textHazards(studentText)) v.push(`prompt_${h}`);
  if (t === "q3") {
    if (p.passage) v.push("q3_has_passage"); if (!p.prompt.lead || countWords(p.prompt.lead) < 50 || countWords(p.prompt.lead) > 160) v.push("q3_lead_words_out_of_50-160");
    const wl = p.works_list ?? []; if (wl.length < 38 || wl.length > 42) v.push(`works_list_${wl.length}_not_about_40`);
    const valid = new Set(LT_WORKS_LIST.map((w) => `${w[0]}|${w[1]}`)); if (wl.some((w) => !valid.has(`${w.title}|${w.author}`))) v.push("works_list_entry_not_in_verified_list");
    if (!/do not merely summarize|do not summarize/i.test(p.prompt.task)) v.push("q3_task_missing_no_plot_summary");
  } else {
    const ps = p.passage; if (!ps) v.push("passage_missing");
    else {
      const b = ps.form === "poem" ? LT_FRQ_BOUNDS.poem : LT_FRQ_BOUNDS.prose; const w = passageWords(ps); if ((t === "q1") !== (ps.form === "poem")) v.push("passage_form_mismatch");
      if (w < b.minWords || w > b.maxWords) v.push(`passage_words_${w}_outside_${b.minWords}-${b.maxWords}`);
      const text = frqPassageText(ps); for (const h of textHazards(text + " " + ps.title)) v.push(`passage_${h}`);
      const low = frqNorm(text + " " + ps.title + " " + ps.provenance.author_alias); const real = REAL_NAMES.filter((n) => hasWord(low, n)); if (real.length) v.push(`passage_real_name_${real.join("|")}`);
      const bans = LT_BANNED_PHRASES.filter((x) => low.includes(x)); if (bans.length >= 2) v.push(`passage_ai_cliche_${bans.join("|")}`);
      if (ps.line_count !== countedLines(ps.stanzas).length) v.push("passage_line_count_mismatch");
      for (const d of prior) { const g = fiveGrams(text), h = fiveGrams(d.text); let hit = 0; g.forEach((x) => h.has(x) && hit++); if (g.size && hit / g.size > 0.04) v.push(`passage_similar_to_${d.id}`); else if (longestSharedRun(text, d.text) >= 10) v.push(`passage_shared_run_with_${d.id}`); }
    }
  }
  for (const r of p.rubric?.rows ?? []) { if (!r.task_specific?.trim() || countWords(r.task_specific) < 15) v.push(`rubric_row_${r.row_id}_task_specific_missing`); }
  if ((p.rubric?.rows ?? []).length !== 3) v.push("rubric_rows_not_3");
  if (p.samples.length !== 3 || !["high", "mid", "low"].every((x) => p.samples.some((s) => s.tier === x))) v.push("samples_not_high_mid_low");
  else {
    const by = Object.fromEntries(p.samples.map((s) => [s.tier, s])) as Record<"high" | "mid" | "low", LtSample>;
    if (!(by.high.rubric_scores.total > by.mid.rubric_scores.total && by.mid.rubric_scores.total > by.low.rubric_scores.total)) v.push("samples_score_order_violated");
    if (by.high.rubric_scores.total < 5 || by.low.rubric_scores.total > 3 || by.mid.rubric_scores.total < 3 || by.mid.rubric_scores.total > 5) v.push("samples_score_bands");
    for (const s of p.samples) {
      const [lo, hi] = LT_SAMPLE_WORDS[s.tier]; if (s.word_count < lo || s.word_count > hi) v.push(`sample_${s.tier}_words_${s.word_count}_outside_${lo}-${hi}`);
      if (s.rubric_scores.A + s.rubric_scores.B + s.rubric_scores.C !== s.rubric_scores.total) v.push(`sample_${s.tier}_total_mismatch`);
      for (const h of textHazards(s.essay)) v.push(`sample_${s.tier}_${h}`);
      if (!s.annotations.length) v.push(`sample_${s.tier}_no_annotations`); for (const a of s.annotations) if (!quoteInPassage(a.quote, s.essay)) v.push(`sample_${s.tier}_annotation_quote_not_in_essay`);
      if (p.passage) v.push(...sampleQuoteViolations(s.essay, frqPassageText(p.passage)).map((x) => `sample_${s.tier}_${x}`));
      if (/\b(ai-generated|as an ai|language model)\b/i.test(s.essay)) v.push(`sample_${s.tier}_meta_text`);
      if (t === "q3" && p.works_list && !p.works_list.some((w) => frqNorm(s.essay).includes(frqNorm(w.title)))) v.push(`sample_${s.tier}_names_no_listed_work`);
    }
  }
  return v;
}

/** 테스트가 스키마 모듈이 로드되었는지 확인하는 표지. */
export const LT_SCHEMA_CHECK = true;
