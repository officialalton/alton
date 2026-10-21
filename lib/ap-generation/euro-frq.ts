// AP European History FRQ 프롬프트 세트의 안정 JSON 스키마(whap-frq-1)와 결정적 게이트(2026-10-15). 채점기(lib/essay-grading, 루브릭 id whap-v1)는 payload.whap_frq 만 읽는다.
// 구성(CED effective Fall 2026 p.195-198): SAQ 3(각 3점; q1 2차 텍스트 · q2 1차 텍스트 · q3 비텍스트, 서로 다른 시대 구간), DBQ 1(7점, 문서 7개, 1450–2001), LEQ 1(6점, 필수·선택 없음, 연표의 약 절반, 자료 없음).
// US History(ushistory-frq.ts)와 달리 모든 자료는 실제 자료(레지스트리)이며 ALTON 이 쓴 것은 과제문·루브릭·기대 답안·샘플 답안뿐이다.
import { countWords } from "./english-text-stats";
import { longestSharedRun, quoteInPassage, textHazards, fiveGrams } from "./englang-gates";
import { sourceBody, tableMarkdown, type UshSource } from "./ushistory-gates";
import { frqTaskText, frqReferenceText, noDollar, USH_RUBRIC_ROWS, USH_SAMPLE_BAND, USH_SAMPLE_TARGET, taskOf, type UshFrqPayload, type UshFrqTask, type UshSample } from "./ushistory-frq";
import { EURO_BANNED_PHRASES, EURO_ERA_LABEL, EURO_SOURCE_MARKER, EURO_UNITS } from "./subjects/europeanhistory";
import { credit, realBlock, realStimulus, srcEntry, TYPE_LABEL, isImage, type EuroRegistrySource } from "./euro-real-gates";
import { euroEra } from "../ap-exam/euro-rules";
import type { EuroFrqSpec } from "./euro-plan";

export const EURO_FRQ_SCHEMA_VERSION = "whap-frq-1" as const;
export const EURO_RUBRIC_ID = "whap-v1" as const;
export const EURO_RUBRIC_ROWS = USH_RUBRIC_ROWS; export const EURO_SAMPLE_BAND = USH_SAMPLE_BAND; export const EURO_SAMPLE_TARGET = USH_SAMPLE_TARGET;
export { taskOf, noDollar, frqTaskText };
export type EuroFrqPayload = Omit<UshFrqPayload, "schema_version" | "rubric" | "period" | "periods" | "provenance"> & { schema_version: typeof EURO_FRQ_SCHEMA_VERSION; era: number; units: number[]; rubric: Omit<UshFrqPayload["rubric"], "rubric_id"> & { rubric_id: typeof EURO_RUBRIC_ID }; provenance: { kind: "alton_authored_from_real_sources"; note: string } };
export type EuroSample = UshSample;
const asUsh = (p: EuroFrqPayload) => p as unknown as UshFrqPayload;
export const euroFrqTaskText = (p: EuroFrqPayload) => frqTaskText(asUsh(p));
export const REAL_LABEL = "ALTON reference — not official AP scoring";
export function euroReferenceText(p: EuroFrqPayload): string {
  const base = frqReferenceText(asUsh(p)).split("\n"); base[0] = `Scoring guide (${REAL_LABEL}). This question is worth ${p.rubric.total_points} points.`;
  const em = p.expected_features.evidence_map ?? []; const uses = p.expected_features.doc_uses ?? [];
  if (p.task_type !== "dbq" || !em.length) return base.join("\n");
  const map = ["", "Evidence map (which documents support or complicate each line of reasoning):", ...em.map((l) => `- ${l.line}. Supports: Document ${l.supports.join(", ")}${l.complicates.length ? `. Complicates: Document ${l.complicates.join(", ")}` : ""}.`), "", "Using the documents (use and sourcing):", ...uses.map((u) => `- Document ${u.source_id}: ${u.usable_for}${u.sourcing ? ` Sourcing: ${u.sourcing}` : ""}`)];
  const at = base.findIndex((l) => l.startsWith("Sample response")); const head = at > 0 ? at - 1 : base.length; return [...base.slice(0, head), ...map, ...base.slice(head)].join("\n");
}
export const sourcesPlain = (p: Pick<EuroFrqPayload, "sources">): string => p.sources.map(sourceBody).join("\n\n");

/** DBQ 학생 화면 문안(레지스트리에서 코드로 만든다): 표지 + 안내 + 문서 7개. */
export function euroDbqPassage(refs: { id: string; context: string }[], reg: Map<string, EuroRegistrySource>): string {
  const imageDocs = refs.flatMap((r, i) => (isImage(reg.get(r.id)!) ? [i + 1] : []));
  const note = `These documents are real historical sources (excerpts are cut verbatim from the repository text; [...] marks an omission).${imageDocs.length ? ` Document${imageDocs.length > 1 ? "s" : ""} ${imageDocs.join(" and ")} ${imageDocs.length > 1 ? "are images" : "is an image"} shown below the documents.` : ""}`;
  return `${EURO_SOURCE_MARKER}\n${note}\n\n${refs.map((r, i) => realBlock(`Document ${i + 1}`, reg.get(r.id)!, r.context)).join("\n\n———\n\n")}`;
}
export const euroFrqIntro = (spec: EuroFrqSpec, reg: Map<string, EuroRegistrySource>): string => (spec.template === "leq" ? "" : spec.template === "dbq" ? euroDbqPassage(spec.sources, reg) : `${EURO_SOURCE_MARKER}\n${spec.sources.map((r, i) => realBlock(spec.sources.length > 1 ? `Source ${String.fromCharCode(65 + i)}` : null, reg.get(r.id)!, r.context)).join("\n\n———\n\n")}`);
export const euroFrqStimulus = (spec: EuroFrqSpec, reg: Map<string, EuroRegistrySource>) => (spec.template === "leq" ? undefined : realStimulus(spec.sources, reg, spec.template === "dbq" ? (i) => `Document ${i + 1}` : undefined));
/** payload.sources: 레지스트리에서 코드로 만든다(DBQ 는 id "1".."7", SAQ 는 "A"). 이미지 자료의 body 는 alt 설명(채점기가 읽는다). */
export function euroFrqSources(spec: EuroFrqSpec, reg: Map<string, EuroRegistrySource>): UshSource[] {
  return spec.sources.map((r, i) => { const s = reg.get(r.id)!; const e = srcEntry(s, spec.template === "dbq" ? String(i + 1) : spec.sources.length > 1 ? String.fromCharCode(65 + i) : "A", r.context);
    const body = s.excerpt_segments ? s.excerpt_segments.join(" [...] ") : s.table ? s.title : (s.alt ?? "");
    return { ...e, body, ...(s.table ? { table: { columns: s.table.columns, rows: s.table.rows } } : {}), ...(isImage(s) ? { image: { path: s.public_path!, alt: s.alt!, credit: s.credit! } } : {}), provenance: { kind: "real_historical_source" as const, real_data: true, note: `registry ${s.id}` } } as UshSource; });
}

const norm = (t: string) => t.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();
const SAMPLE_WORDS: Record<UshFrqTask, Record<string, [number, number]>> = { saq: { high: [40, 340], mid: [30, 300], low: [12, 240] }, dbq: { high: [480, 950], mid: [300, 650], low: [110, 380] }, leq: { high: [430, 850], mid: [270, 560], low: [90, 320] } };

/** 레지스트리 대조(실제 자료 일치) + FRQ 구성·루브릭·샘플 게이트. */
export function euroFrqViolations(p: EuroFrqPayload, spec: EuroFrqSpec, reg: Map<string, EuroRegistrySource>, corpus: { id: string; text: string }[] = []): string[] {
  const v: string[] = []; const task = p.task_type; const n = p.sources.length;
  if (p.schema_version !== EURO_FRQ_SCHEMA_VERSION) v.push("schema_version");
  if (taskOf(p.template) !== task || p.template !== spec.template) v.push(`template_${p.template}_not_for_${task}`);
  if (!p.title?.trim() || !p.prompt?.task?.trim()) v.push("prompt_incomplete");
  if (!(p.era >= 1 && p.era <= 4) || p.era !== spec.era) v.push(`era_${p.era}_not_${spec.era}`);
  if (JSON.stringify(p).match(/[ㄱ-ㆎ가-힣]/)) v.push("hangul");
  const authored = [p.title, p.prompt.scenario, p.prompt.task, ...p.prompt.requirements, ...(p.prompt.parts ?? []).map((x) => x.prompt)].join("\n");
  for (const h of textHazards(authored + "\n" + p.samples.map((x) => x.essay).join("\n"))) v.push(`text_${h}`);
  const ph = EURO_BANNED_PHRASES.filter((b) => norm(authored + p.samples.map((s) => s.essay).join(" ")).includes(b)); if (ph.length >= 2) v.push(`ai_cliche_${ph.join("|")}`);
  if (/\balton[- ]composed\b/i.test(JSON.stringify(p.sources))) v.push("source_marked_alton_composed");
  // 자료: 계획과 같고 레지스트리와 글자 그대로 같다.
  if (p.sources.map((s) => s.source_registry_id).join() !== spec.sources.map((s) => s.id).join()) v.push("sources_differ_from_plan");
  const want = euroFrqSources(spec, reg); if (JSON.stringify(p.sources) !== JSON.stringify(want)) v.push("sources_differ_from_registry");
  for (const s of p.sources) if (s.provenance?.kind !== "real_historical_source" || s.real_data !== true) v.push(`source_${s.id}_not_real`);
  const kinds = p.sources.map((s) => s.kind);
  if (task === "saq") {
    const parts = p.prompt.parts ?? []; if (parts.map((x) => x.label).join("") !== "ABC") v.push("saq_parts_not_ABC"); if (parts.some((x) => x.points !== 1 || !x.prompt.trim())) v.push("saq_part_points");
    if (!/briefly|identify|describe|explain/i.test(parts.map((x) => x.prompt).join(" "))) v.push("saq_no_task_verb");
    if (p.template === "saq1" && !(n === 1 && kinds[0] === "secondary_text")) v.push("saq1_needs_one_secondary_text");
    if (p.template === "saq2" && !(n === 1 && kinds[0] === "primary_text")) v.push("saq2_needs_one_primary_text");
    if (p.template === "saq3" && !(n === 1 && (kinds[0] === "image" || kinds[0] === "table"))) v.push("saq3_needs_non_text_source");
  } else if (task === "dbq") {
    if (n !== 7) v.push(`dbq_documents_${n}_not_7`); if (p.sources.map((s) => s.id).join("") !== "1234567") v.push("dbq_ids_not_1_to_7");
    if (new Set(p.sources.map((s) => s.source_registry_id)).size !== n) v.push("duplicate_registry_source");
    if (!kinds.includes("image")) v.push("dbq_no_visual_document"); if (kinds.filter((k) => k === "image").length > 3) v.push("dbq_too_many_images");
    if (kinds.filter((k) => k === "primary_text" || k === "image").length < 4) v.push("dbq_primary_type_lt_4");
    if (!(p.prompt.requirements ?? []).length) v.push("dbq_requirements_missing");
    const em = p.expected_features.evidence_map ?? []; if (em.length < 3) v.push("evidence_map_lt_3_lines");
    const supported = new Set(em.flatMap((l) => l.supports)); for (const s of p.sources) if (!supported.has(s.id)) v.push(`doc${s.id}:supports_no_line_of_reasoning`);
    if (!em.some((l) => l.complicates.length)) v.push("evidence_map_no_complicating_document");
    if (em.some((l) => ![...l.supports, ...l.complicates].every((x) => p.sources.some((s) => s.id === x)))) v.push("evidence_map_unknown_doc");
    if (em.some((l) => l.supports.some((x) => l.complicates.includes(x)))) v.push("evidence_map_doc_both_supports_and_complicates");
    for (const s of p.sources) { const d = (p.expected_features.doc_uses ?? []).find((x) => x.source_id === s.id); if (!d || !d.usable_for?.trim() || !d.sourcing?.trim()) v.push(`doc${s.id}:doc_use_or_sourcing_missing`); }
  } else {
    if (n !== 0) v.push("leq_has_sources"); if (!(p.prompt.requirements ?? []).length) v.push("leq_requirements_missing");
    if (new Set(p.units.map((u) => euroEra(u))).size < 2) v.push("leq_spans_fewer_than_2_eras");
    if (!/c\. ?1450|c\. ?1648|c\. ?1815|c\. ?1914|1450|1648|1789|1815|1914|present/.test(authored)) v.push("leq_prompt_without_dates");
  }
  const want2 = EURO_RUBRIC_ROWS[task]; const rows = p.rubric?.rows ?? [];
  if (p.rubric?.rubric_id !== EURO_RUBRIC_ID) v.push("rubric_id"); if (p.rubric?.total_points !== want2.reduce((a, r) => a + r.max, 0)) v.push(`rubric_total_${p.rubric?.total_points}`);
  for (const w of want2) {
    const r = rows.find((x) => x.row_id === w.row_id); if (!r) { v.push(`rubric_row_${w.row_id}_missing`); continue; }
    if (r.max !== w.max) v.push(`rubric_row_${w.row_id}_max_${r.max}`);
    for (let k = 0; k <= w.max; k++) if (!String(r.descriptors?.[String(k)] ?? "").trim()) v.push(`rubric_row_${w.row_id}_descriptor_${k}_missing`);
    if (!r.task_specific?.trim()) v.push(`rubric_row_${w.row_id}_task_specific_missing`);
  }
  if (!p.rubric.scoring_notes.some((x) => x.includes(REAL_LABEL))) v.push("rubric_label_missing");
  if (task === "saq") for (const l of ["a", "b", "c"]) if (!(p.expected_features.saq_answers?.[l] ?? []).length) v.push(`saq_answers_${l}_missing`);
  if (task !== "saq" && (p.expected_features.outside_evidence ?? []).length < 4) v.push("outside_evidence_lt_4");
  if (task !== "saq" && (p.expected_features.defensible_theses ?? []).length < 2) v.push("defensible_theses_lt_2");
  if ((p.expected_features.facts ?? []).length < 2) v.push("facts_missing");
  for (const t of ["high", "mid", "low"] as const) {
    const s = p.samples.find((x) => x.tier === t); if (!s) { v.push(`sample_${t}_missing`); continue; }
    const w = countWords(s.essay); const [lo, hi] = SAMPLE_WORDS[task][t]; if (w < lo || w > hi) v.push(`sample_${t}_words_${w}_not_${lo}-${hi}`);
    if (Math.abs(w - s.word_count) > 3) v.push(`sample_${t}_word_count_field`);
    const rs = s.rubric_scores; const sum = want2.reduce((a, r) => a + (rs?.[r.row_id] ?? 0), 0);
    if (!rs || want2.some((r) => !(rs[r.row_id] >= 0 && rs[r.row_id] <= r.max)) || sum !== rs.total) v.push(`sample_${t}_rubric_scores_invalid`);
    else if (rs.total < EURO_SAMPLE_BAND[task][t][0] || rs.total > EURO_SAMPLE_BAND[task][t][1]) v.push(`sample_${t}_total_${rs.total}_outside_band_${EURO_SAMPLE_BAND[task][t].join("-")}`);
    if (s.annotations.length < (task === "saq" ? 2 : 3)) v.push(`sample_${t}_annotations_few`);
    for (const a of s.annotations) { if (!quoteInPassage(a.quote, s.essay)) v.push(`sample_${t}_annotation_quote_not_in_essay`); if (!a.comment?.trim()) v.push(`sample_${t}_annotation_comment_empty`); }
    const src = sourcesPlain(p); if (src && longestSharedRun(s.essay, src) > 24) v.push(`sample_${t}_copies_source`);
  }
  const hi = p.samples.find((x) => x.tier === "high"), mid = p.samples.find((x) => x.tier === "mid"), lo = p.samples.find((x) => x.tier === "low");
  if (hi && mid && lo && !(hi.rubric_scores.total > mid.rubric_scores.total && mid.rubric_scores.total > lo.rubric_scores.total)) v.push("samples_not_strictly_ordered");
  for (const c of corpus) { const g = fiveGrams(authored), h = fiveGrams(c.text); let hit = 0; g.forEach((x) => h.has(x) && hit++); if (g.size && hit / g.size > 0.04) v.push(`similar_to_${c.id}`); }
  void credit; void TYPE_LABEL; void tableMarkdown; void EURO_ERA_LABEL; void EURO_UNITS;
  return v;
}
