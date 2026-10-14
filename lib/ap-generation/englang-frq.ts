// AP English Language FRQ 프롬프트 세트의 **안정 JSON 스키마**(el-frq-1)와 결정적 게이트(2026-10-14). 본문·필드 설명: docs/ap/englang-groundwork.md §7.
// AI 채점 기능(별도 에이전트)은 이 스키마의 `el_frq`(payload.el_frq)만 읽으면 된다: 과제문·소스·루브릭(데이터)·3단계 주석 샘플.
import { countWords } from "./english-text-stats";
import { bannedPhraseHits, fiveGrams, flattenSentences, longestSharedRun, quoteInPassage, textHazards } from "./englang-gates";
import { EL_BANNED_PHRASES, EL_DEVICES, EL_RUBRIC_ROWS, EL_SAMPLE_WORDS, EL_SOURCE_BOUNDS } from "./subjects/englang";

export const EL_FRQ_SCHEMA_VERSION = "el-frq-1" as const;
export type ElFrqTemplate = "q1" | "q2" | "q3";
export type ElFrqTaskType = "synthesis" | "rhetorical_analysis" | "argument";
export type ElSourceKind = "text" | "visual" | "quantitative";
export type ElFrqSource = {
  id: string; kind: ElSourceKind; title: string; attribution: string; genre?: string; body?: string; paragraphs?: string[][];
  /** kind = visual: 렌더할 차트 자료(막대그래프). kind = quantitative: body 의 마크다운 표 + 같은 수치의 구조화 표(table). */
  figure?: { chart: "bar"; title: string; categories: string[]; series: { name: string; values: number[] }[]; xTitle?: string; yTitle?: string; description: string };
  table?: { columns: string[]; rows: (string | number)[][] };
  provenance: { kind: "original"; author_alias: string; year_alias: number | string };
  stance?: string;
};
export type ElRubricRow = { row_id: "A" | "B" | "C"; name: string; max: number; descriptors: Record<string, string>; task_specific: string };
export type ElAnnotation = { quote: string; comment: string; row_id: "A" | "B" | "C" };
export type ElSample = { tier: "high" | "mid" | "low"; target_total: number; essay: string; word_count: number; rubric_scores: { A: number; B: number; C: number; total: number }; annotations: ElAnnotation[] };
export type ElFrqPayload = {
  schema_version: typeof EL_FRQ_SCHEMA_VERSION;
  task_type: ElFrqTaskType; template: ElFrqTemplate; title: string;
  prompt: { scenario: string; task: string; requirements: string[] };
  sources: ElFrqSource[];
  rubric: { total_points: 6; rows: ElRubricRow[]; scoring_notes: string[] };
  /** AI 채점기용 과제별 기대 특징(학생에게 보이지 않음). */
  expected_features: { defensible_positions?: string[]; source_uses?: { source_id: string; usable_for: string }[]; rhetorical_choices?: { device: string; paragraph: number; sentence_ids: number[]; effect: string }[]; lines_of_reasoning?: string[]; common_pitfalls: string[] };
  samples: ElSample[];
  blueprint: { stances?: string[]; devices?: { device: string; sentence_ids: number[]; function: string }[]; issue?: string; theme?: string };
  provenance: { kind: "original"; note: string };
};

const norm = (t: string) => t.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();
export const sourceText = (s: ElFrqSource): string => (s.paragraphs ? s.paragraphs.map((p) => p.join(" ")).join("\n\n") : s.body ?? "");
const wordsOf = (t: string) => (t.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []).length;

export const tableMarkdown = (t: { columns: string[]; rows: (string | number)[][] }): string => [`| ${t.columns.join(" | ")} |`, `| ${t.columns.map(() => "---").join(" | ")} |`, ...t.rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
/** 학생 화면용 소스 본문(set_intro): 종합은 Source A–F, 수사 분석은 번호 매긴 문단 지문. 시각 소스는 그림으로 따로 렌더되므로 안내 한 줄만 둔다. */
export function frqPassageDisplay(p: ElFrqPayload): string {
  const head = "ALTON original passage";
  if (p.task_type === "synthesis") {
    return [head, ...p.sources.map((s) => {
      const t = `Source ${s.id}${s.kind === "visual" ? " (chart)" : s.kind === "quantitative" ? " (table)" : ""}`;
      const meta = `${s.title}\n${s.attribution}`;
      const body = s.kind === "visual" ? "The chart for this source appears below the sources." : s.kind === "quantitative" && s.table ? `${sourceText(s)}\n\n${tableMarkdown(s.table)}` : sourceText(s);
      return `${t}\n${meta}\n\n${body}`;
    })].join("\n\n———\n\n");
  }
  if (p.task_type === "rhetorical_analysis") {
    const s = p.sources[0];
    return `${head}\n${s.title}\n${s.attribution}\n\n${(s.paragraphs ?? []).map((par, i) => `¶${i + 1} ${par.join(" ")}`).join("\n\n")}`;
  }
  return p.sources.length ? `${head}\n\n${p.sources.map((s) => `${s.title}\n${s.attribution}\n\n${sourceText(s)}`).join("\n\n———\n\n")}` : "";
}

/** 학생이 보는 과제문(파트 A 의 prompt). */
export const frqTaskText = (p: ElFrqPayload): string => [p.prompt.scenario, p.prompt.task, p.prompt.requirements.length ? `Your essay should:\n${p.prompt.requirements.map((r) => `- ${r}`).join("\n")}` : ""].filter(Boolean).join("\n\n");

// ── 숫자 일관성(종합: 표·차트·본문 사이 상충 금지) ───────────────────
const labelNum = (label: string) => norm(label).replace(/[^a-z0-9 ]/g, "").trim();
export function sourceNumberConflicts(sources: ElFrqSource[]): string[] {
  const seen = new Map<string, { v: number; src: string }>(); const out: string[] = [];
  const add = (label: string, v: number, src: string) => { const k = labelNum(label); const p = seen.get(k); if (p && Math.abs(p.v - v) > 1e-9) out.push(`conflict_${k.replace(/ /g, "_")}_${p.v}_vs_${v}_${p.src}_${src}`); else if (!p) seen.set(k, { v, src }); };
  for (const s of sources) {
    if (s.figure) s.figure.categories.forEach((c, i) => s.figure!.series.forEach((se) => add(`${c}|${se.name}`, se.values[i], s.id)));
    if (s.table) { const cols = s.table.columns; for (const r of s.table.rows) for (let j = 1; j < r.length; j++) if (typeof r[j] === "number") add(`${r[0]}|${cols[j]}`, r[j] as number, s.id); }
  }
  return out;
}

/** 샘플 에세이끼리 겹침을 볼 때 소스를 그대로 인용한 구간(6단어 이상 일치)은 정당한 인용이므로 가린다(수사 분석 에세이는 같은 지문 문장을 인용한다). */
export function maskSourceQuotes(essay: string, p: ElFrqPayload): string {
  const tok = (t: string) => t.toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(Boolean);
  const src = tok(p.sources.map(sourceText).join(" ")); const grams = new Set<string>(); for (let i = 0; i + 6 <= src.length; i++) grams.add(src.slice(i, i + 6).join(" "));
  const e = tok(essay); const masked = new Array<boolean>(e.length).fill(false);
  for (let i = 0; i + 6 <= e.length; i++) if (grams.has(e.slice(i, i + 6).join(" "))) for (let k = i; k < i + 6; k++) masked[k] = true;
  return e.map((w, i) => (masked[i] ? "▯" : w)).join(" ");
}
export function frqViolations(p: ElFrqPayload, corpus: { id: string; text: string }[] = []): string[] {
  const v: string[] = [];
  if (p.schema_version !== EL_FRQ_SCHEMA_VERSION) v.push("schema_version");
  const expectTpl: Record<ElFrqTaskType, ElFrqTemplate> = { synthesis: "q1", rhetorical_analysis: "q2", argument: "q3" };
  if (expectTpl[p.task_type] !== p.template) v.push(`template_${p.template}_not_for_${p.task_type}`);
  if (!p.title?.trim() || !p.prompt?.task?.trim() || !p.prompt?.scenario?.trim()) v.push("prompt_incomplete");
  const all = JSON.stringify(p); if (/[ㄱ-ㆎ가-힣]/.test(all)) v.push("hangul");
  const studentText = [p.title, p.prompt.scenario, p.prompt.task, ...p.prompt.requirements, ...p.sources.map(sourceText)].join("\n");
  for (const h of textHazards(studentText + "\n" + p.samples.map((x) => x.essay).join("\n"))) v.push(`text_${h}`);
  const ph = bannedPhraseHits(studentText + "\n" + p.samples.map((s) => s.essay).join("\n")); if (ph.length >= 3) v.push(`ai_cliche_phrases_${ph.join("|")}`);
  // 소스
  if (p.task_type === "synthesis") {
    if (p.sources.length !== 6) v.push(`synthesis_sources_${p.sources.length}_not_6`);
    if (p.sources.map((s) => s.id).join("") !== "ABCDEF") v.push("synthesis_source_ids_not_A_to_F");
    if (!p.sources.some((s) => s.kind === "visual")) v.push("synthesis_no_visual_source");
    if (!p.sources.some((s) => s.kind === "quantitative")) v.push("synthesis_no_quantitative_source");
    for (const s of p.sources.filter((x) => x.kind !== "visual")) { const w = wordsOf(sourceText(s)); if (s.kind === "text" && (w < EL_SOURCE_BOUNDS.minWords || w > EL_SOURCE_BOUNDS.maxWords)) v.push(`source_${s.id}_words_${w}`); if (s.kind === "quantitative" && !s.table) v.push(`source_${s.id}_missing_table`); if (s.kind === "quantitative" && w < 25) v.push(`source_${s.id}_too_short`); }
    for (const s of p.sources.filter((x) => x.kind === "visual")) { if (!s.figure) v.push(`source_${s.id}_missing_figure`); else { if (s.figure.series.some((se) => se.values.length !== s.figure!.categories.length)) v.push(`source_${s.id}_figure_series_length`); if (s.figure.categories.length < 3) v.push(`source_${s.id}_figure_categories_lt_3`); } }
    const stances = new Set(p.sources.map((s) => norm(s.stance ?? "")).filter(Boolean)); if (stances.size < 3) v.push(`synthesis_stances_${stances.size}_lt_3`);
    v.push(...sourceNumberConflicts(p.sources));
    const ids = p.sources.filter((s) => s.kind !== "visual").map((s) => s.id);
    for (const u of p.expected_features.source_uses ?? []) if (![...ids, "F"].includes(u.source_id)) v.push(`source_use_unknown_${u.source_id}`);
  } else if (p.task_type === "rhetorical_analysis") {
    const s = p.sources[0]; if (!s || p.sources.length !== 1 || !s.paragraphs?.length) v.push("rhetorical_needs_one_passage");
    else {
      const w = wordsOf(sourceText(s)); if (w < 380 || w > 720) v.push(`rhetorical_passage_words_${w}`);
      const n = flattenSentences(s.paragraphs).length;
      const devs = p.blueprint.devices ?? []; if (devs.length < 5) v.push(`rhetorical_devices_${devs.length}_lt_5`);
      for (const d of devs) { if (!(EL_DEVICES as readonly string[]).includes(d.device)) v.push(`device_not_in_inventory_${d.device}`); if (!d.sentence_ids?.length || d.sentence_ids.some((i) => i < 1 || i > n)) v.push(`device_sentence_out_of_range_${d.device}`); }
      for (const c of p.expected_features.rhetorical_choices ?? []) { if (c.paragraph < 1 || c.paragraph > s.paragraphs.length) v.push("rhetorical_choice_paragraph_out_of_range"); if (c.sentence_ids.some((i) => i < 1 || i > n)) v.push("rhetorical_choice_sentence_out_of_range"); }
      if ((p.expected_features.rhetorical_choices ?? []).length < 5) v.push("rhetorical_choices_lt_5");
    }
  } else {
    if (p.sources.some((s) => wordsOf(sourceText(s)) > 260)) v.push("argument_stimulus_too_long");
  }
  for (const s of p.sources) { if (s.provenance?.kind !== "original" || !s.provenance.author_alias) v.push(`source_${s.id}_provenance`); if (!s.attribution?.trim()) v.push(`source_${s.id}_attribution`); }
  // 루브릭
  const rows = p.rubric?.rows ?? [];
  if (p.rubric?.total_points !== 6) v.push("rubric_total_not_6");
  for (const want of EL_RUBRIC_ROWS) {
    const r = rows.find((x) => x.row_id === want.row_id);
    if (!r) { v.push(`rubric_row_${want.row_id}_missing`); continue; }
    if (r.max !== want.max) v.push(`rubric_row_${want.row_id}_max_${r.max}`);
    for (let k = 0; k <= want.max; k++) if (!String(r.descriptors?.[String(k)] ?? "").trim()) v.push(`rubric_row_${want.row_id}_descriptor_${k}_missing`);
    if (!r.task_specific?.trim()) v.push(`rubric_row_${want.row_id}_task_specific_missing`);
  }
  // 샘플
  const tiers = ["high", "mid", "low"] as const;
  for (const t of tiers) {
    const s = p.samples.find((x) => x.tier === t); if (!s) { v.push(`sample_${t}_missing`); continue; }
    const w = countWords(s.essay); const [lo, hi] = EL_SAMPLE_WORDS[t]; if (w < lo || w > hi) v.push(`sample_${t}_words_${w}_not_${lo}-${hi}`);
    if (Math.abs(w - s.word_count) > 3) v.push(`sample_${t}_word_count_field_${s.word_count}_actual_${w}`);
    const rs = s.rubric_scores; if (!rs || rs.A < 0 || rs.A > 1 || rs.B < 0 || rs.B > 4 || rs.C < 0 || rs.C > 1 || rs.A + rs.B + rs.C !== rs.total) v.push(`sample_${t}_rubric_scores_invalid`);
    else { const want = t === "high" ? [5, 6] : t === "mid" ? [3, 5] : [1, 3]; if (rs.total < want[0] || rs.total > want[1]) v.push(`sample_${t}_intended_total_${rs.total}_not_${want[0]}-${want[1]}`); if (s.target_total !== rs.total) v.push(`sample_${t}_target_total_mismatch`); }
    if (s.annotations.length < 3) v.push(`sample_${t}_annotations_lt_3`);
    for (const a of s.annotations) { if (!quoteInPassage(a.quote, s.essay)) v.push(`sample_${t}_annotation_quote_not_in_essay`); if (!a.comment?.trim()) v.push(`sample_${t}_annotation_comment_empty`); }
    const src = p.sources.map(sourceText).join("\n"); if (src && longestSharedRun(s.essay, src) > 22) v.push(`sample_${t}_copies_source_run_${longestSharedRun(s.essay, src)}`);
  }
  const hi = p.samples.find((x) => x.tier === "high"), mid = p.samples.find((x) => x.tier === "mid"), lo = p.samples.find((x) => x.tier === "low");
  if (hi && mid && lo && !(hi.rubric_scores.total > mid.rubric_scores.total && mid.rubric_scores.total > lo.rubric_scores.total)) v.push("samples_not_strictly_ordered");
  if (hi && mid && lo) for (const [a, b, n] of [[hi, mid, "high_mid"], [hi, lo, "high_low"], [mid, lo, "mid_low"]] as const) if (longestSharedRun(maskSourceQuotes(a.essay, p), maskSourceQuotes(b.essay, p)) >= 14) v.push(`samples_share_run_${n}`);
  for (const c of corpus) { const g = fiveGrams(studentText), h = fiveGrams(c.text); let hit = 0; g.forEach((x) => h.has(x) && hit++); if (g.size && hit / g.size > 0.04) v.push(`similar_to_${c.id}`); }
  void EL_BANNED_PHRASES;
  return v;
}

/** 학생 결과 화면용 참고 답안 문서(문항 해설). 루브릭 요약 + 3단계 샘플 + 주석. 공식 채점 아님. */
export function frqReferenceText(p: ElFrqPayload): string {
  const L: string[] = [];
  L.push("Scoring guide (ALTON practice rubric, not official College Board scoring). Each essay is worth 6 points.");
  for (const r of p.rubric.rows) { L.push(`${r.name} (0-${r.max}): ${r.task_specific}`); for (let k = r.max; k >= 0; k--) L.push(`   - ${k}: ${r.descriptors[String(k)]}`); }
  for (const n of p.rubric.scoring_notes) L.push(`Note: ${n}`);
  for (const tier of ["high", "mid", "low"] as const) {
    const s = p.samples.find((x) => x.tier === tier); if (!s) continue;
    L.push("", `Sample response, ${tier === "high" ? "high" : tier === "mid" ? "middle" : "low"} score (${s.rubric_scores.total}/6; Thesis ${s.rubric_scores.A}, Evidence and commentary ${s.rubric_scores.B}, Sophistication ${s.rubric_scores.C}):`, s.essay);
    for (const a of s.annotations) L.push(`   - "${a.quote}" - ${a.comment}`);
  }
  return L.join("\n");
}

/** 생성 응답 정규화(결정적): 정량 소스 본문에 모델이 쓴 마크다운 표 줄을 지우고(표는 구조화 자료로 코드가 그린다), 수사 분석의 blueprint.devices 가 비어 있으면 expected_features.rhetorical_choices 에서 만든다. */
export function normalizeFrqPayload(p: ElFrqPayload): ElFrqPayload {
  const sources = p.sources.map((s) => (s.kind === "quantitative" && s.body ? { ...s, body: s.body.split("\n").filter((l) => !/^\s*\|/.test(l)).join("\n").trim() } : s));
  for (const s of sources) if (s.figure) { // 막대그래프 가로 라벨은 짧아야 그려진다(회전 라벨 폭 96px ≈ 13자): 긴 이름은 단어를 뒤에서부터 줄이고, 전체 이름은 대체 설명에 남긴다
    const short = (c: string): string => { const w = c.split(/\s+/); while (w.length > 1 && w.join(" ").length > 13) w.pop(); return w.join(" ").length > 13 ? `${w.join(" ").slice(0, 12)}.` : w.join(" "); };
    const cats = s.figure.categories.map(short); const uniq = cats.map((c, i) => (cats.indexOf(c) === i ? c : `${c.slice(0, 11)} ${i + 1}`));
    if (uniq.some((c, i) => c !== s.figure!.categories[i])) s.figure = { ...s.figure, categories: uniq, description: `${s.figure.description} Categories: ${s.figure.categories.map((c, i) => `${uniq[i]} = ${c}`).join("; ")}.` };
  }
  const rc = p.expected_features?.rhetorical_choices ?? [];
  const blueprint = p.task_type === "rhetorical_analysis" && !(p.blueprint.devices?.length) && rc.length ? { ...p.blueprint, devices: rc.map((c) => ({ device: c.device, sentence_ids: c.sentence_ids, function: c.effect })) } : p.blueprint;
  return { ...p, sources, blueprint };
}
