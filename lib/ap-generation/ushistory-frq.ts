// AP U.S. History FRQ 프롬프트 세트의 **안정 JSON 스키마**(ush-frq-1)와 결정적 게이트(2026-10-14). 채점기(lib/essay-grading, 루브릭 id ushistory-v1)는 payload.ush_frq 만 읽는다.
// 구성(CED effective Fall 2026 p.497-501, 2027 개편): SAQ 3(각 3점, 파트 A·B·C 각 1점; q1 2차 자료 2개 · q2 1차 자료 · q3 비텍스트), DBQ 1(7점, 문서 7개, 1754–1980), LEQ 1(6점, 필수·선택 없음, 자료 없음).
import { countWords } from "./english-text-stats";
import { bannedPhraseHits, longestSharedRun, quoteInPassage, textHazards, fiveGrams } from "./englang-gates";
import { realPeopleIn, sourceBody, tableMarkdown, ushStimulusDisplay, type UshSource } from "./ushistory-gates";
import { USH_BANNED_PHRASES, USH_PERIODS } from "./subjects/ushistory";

export const USH_FRQ_SCHEMA_VERSION = "ush-frq-1" as const;
export const USH_RUBRIC_ID = "ushistory-v1" as const;
export type UshFrqTemplate = "saq1" | "saq2" | "saq3" | "dbq" | "leq";
export type UshFrqTask = "saq" | "dbq" | "leq";
export const taskOf = (t: UshFrqTemplate): UshFrqTask => (t.startsWith("saq") ? "saq" : (t as "dbq" | "leq"));
export type UshRubricRow = { row_id: string; name: string; max: number; descriptors: Record<string, string>; task_specific: string };
export const USH_RUBRIC_ROWS: Record<UshFrqTask, { row_id: string; name: string; max: number }[]> = {
  saq: [{ row_id: "a", name: "Part A", max: 1 }, { row_id: "b", name: "Part B", max: 1 }, { row_id: "c", name: "Part C", max: 1 }],
  dbq: [{ row_id: "thesis", name: "Thesis/claim", max: 1 }, { row_id: "context", name: "Contextualization", max: 1 }, { row_id: "docs", name: "Evidence from the documents", max: 2 }, { row_id: "outside", name: "Evidence beyond the documents", max: 1 }, { row_id: "sourcing", name: "Sourcing (point of view, purpose, situation, audience)", max: 1 }, { row_id: "complexity", name: "Complex understanding", max: 1 }],
  leq: [{ row_id: "thesis", name: "Thesis/claim", max: 1 }, { row_id: "context", name: "Contextualization", max: 1 }, { row_id: "evidence", name: "Evidence", max: 2 }, { row_id: "analysis", name: "Analysis and reasoning", max: 2 }],
};
export const USH_FRQ_POINTS_BY_TASK: Record<UshFrqTask, number> = { saq: 3, dbq: 7, leq: 6 };
export type UshAnnotation = { quote: string; comment: string; row_id: string };
export type UshSample = { tier: "high" | "mid" | "low"; target_total: number; essay: string; word_count: number; rubric_scores: Record<string, number>; annotations: UshAnnotation[] };
export type UshFrqPayload = {
  schema_version: typeof USH_FRQ_SCHEMA_VERSION; task_type: UshFrqTask; template: UshFrqTemplate; period: number; periods: number[]; title: string;
  prompt: { scenario: string; task: string; requirements: string[]; parts?: { label: "A" | "B" | "C"; prompt: string; points: 1 }[] };
  sources: UshSource[];
  rubric: { rubric_id: typeof USH_RUBRIC_ID; total_points: number; rows: UshRubricRow[]; scoring_notes: string[] };
  expected_features: { defensible_theses?: string[]; contextualization_ideas?: string[]; outside_evidence?: string[]; reasoning_types?: string[]; doc_uses?: { source_id: string; usable_for: string; sourcing?: string }[]; saq_answers?: Record<string, string[]>; common_pitfalls: string[]; facts: string[] };
  samples: UshSample[];
  provenance: { kind: "alton_composed"; note: string };
};

const norm = (t: string) => t.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();
const SAMPLE_WORDS: Record<UshFrqTask, Record<string, [number, number]>> = {
  saq: { high: [40, 340], mid: [30, 300], low: [12, 240] },
  dbq: { high: [480, 950], mid: [300, 650], low: [110, 380] },
  leq: { high: [430, 850], mid: [270, 560], low: [90, 320] },
};
/** 샘플이 속해야 하는 점수 대역(독립 채점기 행별 중앙값의 총점). 점수 이산성이 큰 SAQ 는 정확히 3/2/1, DBQ·LEQ 는 상/중/하 대역(English 와 같은 방식). */
export const USH_SAMPLE_BAND: Record<UshFrqTask, Record<"high" | "mid" | "low", [number, number]>> = { saq: { high: [3, 3], mid: [2, 2], low: [1, 1] }, dbq: { high: [5, 7], mid: [3, 5], low: [1, 3] }, leq: { high: [5, 6], mid: [3, 5], low: [1, 3] } };
export const USH_SAMPLE_TARGET: Record<UshFrqTask, Record<"high" | "mid" | "low", number>> = { saq: { high: 3, mid: 2, low: 1 }, dbq: { high: 6, mid: 4, low: 2 }, leq: { high: 5, mid: 3, low: 1 } };
export const sourcesText = (p: Pick<UshFrqPayload, "sources">): string => p.sources.map(sourceBody).join("\n\n");

/** 학생 화면용 자료(set_intro). DBQ 는 "Document N", SAQ 는 "Source A/B". 표는 마크다운 표로 직접 싣는다(DBQ 의 표 문서), SAQ 비텍스트는 그림으로 그려진다. */
export function frqPassageDisplay(p: UshFrqPayload): string {
  if (p.task_type === "leq") return "";
  if (p.task_type === "dbq") {
    return "ALTON-composed stimulus\n" + p.sources.map((s) => {
      const body = s.kind === "table" ? [s.body, s.table ? tableMarkdown(s.table) : ""].filter(Boolean).join("\n\n") : s.kind === "chart" ? `${s.body ?? ""}\n\n${s.figure ? `${s.figure.title}\n${s.figure.categories.map((c, i) => `${c}: ${s.figure!.series.map((x) => `${x.name} ${x.values[i]}`).join(", ")}`).join("\n")}` : ""}`.trim() : `"${(s.body ?? "").trim()}"`;
      return `Document ${s.id} (${s.kind.replace("_", " ")})\n${s.title}\n${s.attribution}\n\n${body}`;
    }).join("\n\n———\n\n");
  }
  return ushStimulusDisplay(p.sources);
}
export function frqTaskText(p: UshFrqPayload): string {
  if (p.task_type === "saq") return [p.prompt.scenario, p.prompt.task, ...(p.prompt.parts ?? []).map((x) => `(${x.label}) ${x.prompt}`)].filter(Boolean).join("\n\n");
  return [p.prompt.scenario, p.prompt.task, p.prompt.requirements.length ? `In your response you should do the following:\n${p.prompt.requirements.map((r) => `- ${r}`).join("\n")}` : ""].filter(Boolean).join("\n\n");
}
export function frqReferenceText(p: UshFrqPayload): string {
  const L: string[] = [`Scoring guide (ALTON practice rubric, not official College Board scoring). This question is worth ${p.rubric.total_points} points.`];
  for (const r of p.rubric.rows) { L.push(`${r.name} (0-${r.max}): ${r.task_specific}`); for (let k = r.max; k >= 0; k--) L.push(`   - ${k}: ${r.descriptors[String(k)]}`); }
  for (const n of p.rubric.scoring_notes) L.push(`Note: ${n}`);
  if (p.task_type === "saq") for (const [k, v] of Object.entries(p.expected_features.saq_answers ?? {})) L.push(`Acceptable answers for ${k.toUpperCase()}: ${v.join(" / ")}`);
  for (const tier of ["high", "mid", "low"] as const) {
    const s = p.samples.find((x) => x.tier === tier); if (!s) continue;
    const rs = p.rubric.rows.map((r) => `${r.name} ${s.rubric_scores[r.row_id] ?? 0}`).join(", ");
    L.push("", `Sample response, ${tier === "high" ? "high" : tier === "mid" ? "middle" : "low"} score (${s.rubric_scores.total}/${p.rubric.total_points}; ${rs}):`, s.essay);
    for (const a of s.annotations) L.push(`   - "${a.quote}" - ${a.comment}`);
  }
  return L.join("\n");
}
const dollars = (t: string) => t.replace(/[$]\s*(\d[\d,.]*)/g, "$1 dollars").replace(/[$]/g, "");

export function frqViolations(p: UshFrqPayload, corpus: { id: string; text: string }[] = []): string[] {
  const v: string[] = []; const task = p.task_type;
  if (p.schema_version !== USH_FRQ_SCHEMA_VERSION) v.push("schema_version");
  if (taskOf(p.template) !== task) v.push(`template_${p.template}_not_for_${task}`);
  if (!p.title?.trim() || !p.prompt?.task?.trim()) v.push("prompt_incomplete");
  if (!USH_PERIODS[p.period]) v.push(`period_${p.period}`);
  const all = JSON.stringify(p); if (/[ㄱ-ㆎ가-힣]/.test(all)) v.push("hangul");
  const student = [p.title, p.prompt.scenario, p.prompt.task, ...p.prompt.requirements, ...(p.prompt.parts ?? []).map((x) => x.prompt), sourcesText(p)].join("\n");
  for (const h of textHazards(student + "\n" + p.samples.map((x) => x.essay).join("\n"))) v.push(`text_${h}`);
  const ph = USH_BANNED_PHRASES.filter((b) => norm(student + p.samples.map((s) => s.essay).join(" ")).includes(b)); if (ph.length >= 2) v.push(`ai_cliche_${ph.join("|")}`);
  void bannedPhraseHits;
  const n = p.sources.length; const kinds = p.sources.map((s) => s.kind);
  if (task === "saq") {
    const parts = p.prompt.parts ?? []; if (parts.map((x) => x.label).join("") !== "ABC") v.push("saq_parts_not_ABC"); if (parts.some((x) => x.points !== 1 || !x.prompt.trim())) v.push("saq_part_points");
    if (!/briefly|identify|describe|explain/i.test(parts.map((x) => x.prompt).join(" "))) v.push("saq_no_task_verb");
    if (p.template === "saq1" && !(n === 2 && kinds.every((k) => k === "secondary_text"))) v.push("saq1_needs_two_secondary_texts");
    if (p.template === "saq2" && !(n === 1 && kinds[0] === "primary_text")) v.push("saq2_needs_one_primary_text");
    if (p.template === "saq3" && !(n === 1 && (kinds[0] === "table" || kinds[0] === "chart"))) v.push("saq3_needs_non_text_source");
    if (p.period < 1 || p.period > 9) v.push("saq_period"); if (p.period === 9 && !/2001|1991|199\d|198\d/.test(student)) void 0;
  } else if (task === "dbq") {
    if (n !== 7) v.push(`dbq_documents_${n}_not_7`); if (p.sources.map((s) => s.id).join("") !== "1234567") v.push("dbq_ids_not_1_to_7");
    if (kinds.filter((k) => k === "primary_text").length < 4) v.push("dbq_primary_lt_4"); if (!kinds.includes("secondary_text")) v.push("dbq_no_secondary"); if (!kinds.some((k) => k === "table" || k === "chart")) v.push("dbq_no_quantitative");
    const lo = USH_PERIODS[p.period]?.years[0] ?? 1754; if (p.period < 3 || p.period > 8) v.push(`dbq_period_${p.period}_outside_1754_1980`);
    void lo; if (!(p.prompt.requirements ?? []).length) v.push("dbq_requirements_missing");
  } else {
    if (n !== 0) v.push("leq_has_sources"); if (!(p.prompt.requirements ?? []).length) v.push("leq_requirements_missing");
    if (p.periods.length < 3) v.push("leq_spans_fewer_than_3_periods");
  }
  for (const s of p.sources) {
    if (!/ALTON-composed/i.test(s.attribution ?? "") || s.provenance?.kind !== "alton_composed") v.push(`source_${s.id}_not_marked_alton_composed`);
    const ppl = realPeopleIn(`${s.attribution} ${s.title}`); if (ppl.length) v.push(`source_${s.id}_real_person_${ppl.join("|")}`);
    if (s.kind === "primary_text" || s.kind === "secondary_text") { const w = countWords(s.body ?? ""); const [lo, hi] = task === "dbq" ? [35, 200] : [50, 190]; if (w < lo || w > hi) v.push(`source_${s.id}_words_${w}`); }
    if (s.kind === "table" && (!s.table || s.table.rows.length < 3 || s.table.rows.some((r) => r.length !== s.table!.columns.length))) v.push(`source_${s.id}_table_shape`);
    if (s.kind === "chart" && (!s.figure || s.figure.categories.length < 3 || s.figure.series.some((x) => x.values.length !== s.figure!.categories.length))) v.push(`source_${s.id}_chart_shape`);
  }
  // 루브릭
  const want = USH_RUBRIC_ROWS[task]; const rows = p.rubric?.rows ?? [];
  if (p.rubric?.rubric_id !== USH_RUBRIC_ID) v.push("rubric_id"); if (p.rubric?.total_points !== USH_FRQ_POINTS_BY_TASK[task]) v.push(`rubric_total_${p.rubric?.total_points}`);
  for (const w of want) {
    const r = rows.find((x) => x.row_id === w.row_id); if (!r) { v.push(`rubric_row_${w.row_id}_missing`); continue; }
    if (r.max !== w.max) v.push(`rubric_row_${w.row_id}_max_${r.max}`);
    for (let k = 0; k <= w.max; k++) if (!String(r.descriptors?.[String(k)] ?? "").trim()) v.push(`rubric_row_${w.row_id}_descriptor_${k}_missing`);
    if (!r.task_specific?.trim()) v.push(`rubric_row_${w.row_id}_task_specific_missing`);
  }
  if (task === "saq") for (const l of ["a", "b", "c"]) if (!(p.expected_features.saq_answers?.[l] ?? []).length) v.push(`saq_answers_${l}_missing`);
  if (task !== "saq" && (p.expected_features.outside_evidence ?? []).length < 4) v.push("outside_evidence_lt_4");
  if (task !== "saq" && (p.expected_features.defensible_theses ?? []).length < 2) v.push("defensible_theses_lt_2");
  if (task === "dbq" && (p.expected_features.doc_uses ?? []).length < 5) v.push("doc_uses_lt_5");
  if ((p.expected_features.facts ?? []).length < 2) v.push("facts_missing");
  // 샘플
  for (const t of ["high", "mid", "low"] as const) {
    const s = p.samples.find((x) => x.tier === t); if (!s) { v.push(`sample_${t}_missing`); continue; }
    const w = countWords(s.essay); const [lo, hi] = SAMPLE_WORDS[task][t]; if (w < lo || w > hi) v.push(`sample_${t}_words_${w}_not_${lo}-${hi}`);
    if (Math.abs(w - s.word_count) > 3) v.push(`sample_${t}_word_count_field`);
    const rs = s.rubric_scores; const sum = want.reduce((a, r) => a + (rs?.[r.row_id] ?? 0), 0);
    if (!rs || want.some((r) => !(rs[r.row_id] >= 0 && rs[r.row_id] <= r.max)) || sum !== rs.total) v.push(`sample_${t}_rubric_scores_invalid`);
    else if (rs.total < USH_SAMPLE_BAND[task][t][0] || rs.total > USH_SAMPLE_BAND[task][t][1]) v.push(`sample_${t}_total_${rs.total}_outside_band_${USH_SAMPLE_BAND[task][t].join("-")}`);
    if (s.annotations.length < (task === "saq" ? 2 : 3)) v.push(`sample_${t}_annotations_few`);
    for (const a of s.annotations) { if (!quoteInPassage(a.quote, s.essay)) v.push(`sample_${t}_annotation_quote_not_in_essay`); if (!a.comment?.trim()) v.push(`sample_${t}_annotation_comment_empty`); }
    const src = sourcesText(p); if (src && longestSharedRun(s.essay, src) > 24) v.push(`sample_${t}_copies_source`);
  }
  const hi = p.samples.find((x) => x.tier === "high"), mid = p.samples.find((x) => x.tier === "mid"), lo = p.samples.find((x) => x.tier === "low");
  if (hi && mid && lo && !(hi.rubric_scores.total > mid.rubric_scores.total && mid.rubric_scores.total > lo.rubric_scores.total)) v.push("samples_not_strictly_ordered");
  for (const c of corpus) { const g = fiveGrams(student), h = fiveGrams(c.text); let hit = 0; g.forEach((x) => h.has(x) && hit++); if (g.size && hit / g.size > 0.04) v.push(`similar_to_${c.id}`); }
  return v;
}
export { dollars as noDollar };
