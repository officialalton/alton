// US History Stage F 조립기(2026-10-21, US3 FRQ 실제 자료 전환, DB 없음): 레지스트리 자료 + ush-real-f-content.ts → 재고 후보 레코드 5건(SAQ1·SAQ2·SAQ3·DBQ·LEQ 표지 정정본).
//   npx tsx scripts/ap-generation/ush-real-f-build.ts draft   # data/ap/ush-sources/real-f-draft.json (검증 전; ush-real-f-verify.ts 가 읽는다)
//   npx tsx scripts/ap-generation/ush-real-f-build.ts final   # 검증 기록(real-f-verification.json)을 반영하고 통과한 칸만 data/ap/stock/ush-real-f-items.json 에 쓴다
// 미해결 칸(사실이 불확실하거나 채점기 점수가 대역을 벗어남)은 재고에 넣지 않고 보고에 남긴다. 구 r19-f/f4 키는 삭제하지 않는다.
import { readFileSync, writeFileSync } from "node:fs";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { planConversion } from "../../lib/ap-exam/convert";
import { registryViolations, type RegistrySource } from "../../lib/ap-generation/ush-real-gates";
import { realDbqPassage, realDbqViolations, REAL_DBQ_LABEL } from "../../lib/ap-generation/ush-real-dbq";
import { KIND_FOR_SAQ, REAL_SAQ_LABEL, realSaqPassage, realSaqStimulus, realSaqViolations, saqCredit } from "../../lib/ap-generation/ush-real-saq";
import { frqReferenceText, frqTaskText, frqViolations, USH_RUBRIC_ROWS, type UshFrqPayload, type UshSample } from "../../lib/ap-generation/ushistory-frq";
import type { UshSource } from "../../lib/ap-generation/ushistory-gates";
import { descriptorsFor } from "./ush-real-b-content";
import { sourcesOf, referenceText } from "./ush-real-b-build";
import { COLD_WAR, DBQ_REQUIREMENTS, SAQ_REQUIREMENTS, SAQS_F, type SaqF } from "./ush-real-f-content";
import { LEQ_LOW } from "./ush-real-f-leq-low";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export const RUN = "ush-real-f"; export const GATE_VERSION = "ush-real-f-2026-10-21";
const rd = (p: string) => JSON.parse(readFileSync(p, "utf-8"));
export const registry: RegistrySource[] = rd("data/ap/ush-sources/registry.json").sources; export const reg = new Map(registry.map((s) => [s.id, s]));
export const LEQ_SOURCE_KEY = "ush-r19-f:ap_us_history-leq_r1-k0"; export const LEQ_CELL = "real_f_leq";

function base(cell: string, topic: string, unit: string, skill: string, archetype: string, ids: string[], replaces: string, wording = "authored_from_real_source"): Json {
  const key = `ap_us_history-${cell}-k0`; const stockKey = `${RUN}:${key}`;
  return { cellId: `ap_us_history-${cell}`, apSubjectCode: "ap_us_history", kind: "frq_bundle", calculator: "na", reserve: false, wording, candidateKey: key, keywordCode: topic, unitCode: unit, skillPrimary: skill, structure: "frq_multipart", archetype,
    reviewState: "sample_unverified", rejectionReason: null, difficultyProvisional: "exam_prep", gateOverride: GATE_VERSION, run: RUN, stockKey, pipeline: "real_source_v1", validation: "needs_review", gateVersion: GATE_VERSION, expertStatus: "unreviewed", releaseTier: "candidate",
    renderVerified: false, screenVerified: false, reviewEnvReady: false, selectedForSample: true, legacyReserve: false, family: "ap_us_history", itemFamilyId: `fam:${stockKey}`, canonicalKey: stockKey, duplicateOf: null, duplicateReason: null, contentKey: `ap_us_history:${topic}`, sharedWith: [],
    stockCell: `ap_us_history|${topic}|${skill}|frq_multipart|na`, history: [{ run: RUN, gateVersion: GATE_VERSION, outcome: "passed", reasons: null }], stimulusOrigin: ids.length ? "real_historical_source" : "prompt_only", sourceRegistryIds: ids, replaces };
}

// ── SAQ ──
export function saqSources(q: SaqF): UshSource[] {
  return q.order.map((o, i) => { const r = reg.get(o.id)!; const kind = KIND_FOR_SAQ[r.type];
    return { id: String.fromCharCode(65 + i), kind, title: r.title, attribution: saqCredit(r), body: r.excerpt_segments ? r.excerpt_segments.join(" [...] ") : (r.alt ?? ""), ...(kind === "image" ? { image: { path: r.public_path!, alt: r.alt!, credit: r.credit! } } : {}),
      source_registry_id: r.id, source_sha256: r.sha256, real_data: true, provenance: { kind: "real_historical_source" as const, real_data: true, note: `registry ${r.id}` } } as UshSource; });
}
export function saqPayload(q: SaqF, scores?: Record<string, Record<string, number>>): UshFrqPayload {
  const ids = ["a", "b", "c"];
  const samples: UshSample[] = q.samples.map((x) => {
    const target = { high: 3, mid: 2, low: 1 }[x.tier]; const sc = scores?.[x.tier] ?? Object.fromEntries(ids.map((r, i) => [r, i < target ? 1 : 0])); const total = ids.reduce((a, r) => a + (sc[r] ?? 0), 0);
    return { tier: x.tier, target_total: total, essay: x.essay, word_count: (x.essay.match(/\S+/g) ?? []).length, rubric_scores: { ...Object.fromEntries(ids.map((r) => [r, sc[r] ?? 0])), total }, annotations: x.annotations };
  });
  const rows = USH_RUBRIC_ROWS.saq.map((r) => { const part = q.parts.find((x) => x.label.toLowerCase() === r.row_id)!; return { row_id: r.row_id, name: r.name, max: r.max, descriptors: { "0": part.descriptors[0], "1": part.descriptors[1] }, task_specific: part.criterion }; });
  return { schema_version: "ush-frq-1", task_type: "saq", template: q.template, period: q.period, periods: q.periods, title: q.title,
    prompt: { scenario: q.scenario, task: q.task, requirements: SAQ_REQUIREMENTS, parts: q.parts.map((x) => ({ label: x.label, prompt: x.prompt, points: 1 as const })) }, sources: saqSources(q),
    rubric: { rubric_id: "ushistory-v1", total_points: 3, rows, scoring_notes: [...q.notes, `${REAL_SAQ_LABEL}: model scores are an ALTON estimate and no AP score is implied.`] },
    expected_features: { saq_answers: Object.fromEntries(q.parts.map((x) => [x.label.toLowerCase(), x.answers])), common_pitfalls: q.pitfalls, facts: q.facts }, samples,
    provenance: { kind: "alton_composed", note: "Prompts, rubric and sample responses are ALTON-authored practice material; the sources are real historical sources (see sources[].source_registry_id)." } } as UshFrqPayload;
}
export function saqRecord(q: SaqF, scores?: Record<string, Record<string, number>>): Json {
  const p = saqPayload(q, scores); const ids = q.order.map((o) => o.id);
  const parts = q.parts.map((x) => ({ label: x.label, prompt: x.prompt, points: 1, response_mode: "explain", skill_codes: [x.skill], topic_codes: [q.topic], model_answer: x.answers[0], rubric_rows: [{ row_id: x.label.toLowerCase(), points: 1, criterion: x.criterion, required_elements: x.answers, optional_phrases: [], alt_solutions: [], common_errors: [], requires_row_id: null, requires_both: false, requires_numbers: false, numeric_tolerance: null, units_row: false }] }));
  const stim = realSaqStimulus(q.order, reg);
  const payload = { archetype: `ushfrq_${q.cell}`, template: q.template, topic: q.topic, extra_topics: [], skill: q.parts[0].skill, representative_skill: q.parts[0].skill, calculator: "na", title: q.title, set_intro: realSaqPassage(q.order, reg), ...(stim ? { stimulus: stim } : {}), parts,
    reference_text: frqReferenceText(p), ush_frq: p, design: { source_fixed_first: true, evidence_in_source: q.designEvidence } };
  return { ...base(q.cell, q.topic, String(q.period), q.parts[0].skill, `ushfrq_${q.cell}`, ids, q.slot), payload };
}

// ── DBQ ──
export function dbqPayload(scores?: Record<string, Record<string, number>>): UshFrqPayload {
  const d = COLD_WAR; const rowsDef = USH_RUBRIC_ROWS.dbq; const desc = descriptorsFor("fear of the Soviet Union and communism in shaping American government policy and public life", "1947 to 1962");
  const target = { high: 6, mid: 4, low: 2 } as const; const ids = rowsDef.map((r) => r.row_id);
  const fallback = (tier: "high" | "mid" | "low") => { let left = target[tier]; return Object.fromEntries(rowsDef.map((r) => { const v = Math.min(r.max, left); left -= v; return [r.row_id, v]; })); };
  const samples: UshSample[] = d.samples.map((x) => { const sc = scores?.[x.tier] ?? fallback(x.tier); const total = ids.reduce((a, r) => a + (sc[r] ?? 0), 0);
    return { tier: x.tier, target_total: total, essay: x.essay, word_count: (x.essay.match(/\S+/g) ?? []).length, rubric_scores: { ...Object.fromEntries(ids.map((r) => [r, sc[r] ?? 0])), total }, annotations: x.annotations }; });
  return { schema_version: "ush-frq-1", task_type: "dbq", template: "dbq", period: d.period, periods: d.periods, title: d.title,
    prompt: { scenario: d.scenario, task: d.task, requirements: DBQ_REQUIREMENTS }, sources: sourcesOf(d),
    rubric: { rubric_id: "ushistory-v1", total_points: 7, rows: rowsDef.map((r) => ({ row_id: r.row_id, name: r.name, max: r.max, descriptors: (desc as Json)[r.row_id], task_specific: (d.rubric as Json)[r.row_id] })), scoring_notes: d.notes },
    expected_features: { defensible_theses: d.theses, contextualization_ideas: d.context_ideas, outside_evidence: d.outside, reasoning_types: d.reasoning, doc_uses: d.doc_uses.map((u) => ({ source_id: u.source_id, usable_for: u.usable_for, sourcing: u.sourcing })), evidence_map: d.evidence_map, common_pitfalls: d.pitfalls, facts: d.facts },
    samples, provenance: { kind: "alton_composed", note: "The prompt, rubric, evidence map and sample essays are ALTON-authored practice material; all seven documents are real historical sources (see sources[].source_registry_id)." } } as UshFrqPayload;
}
export function dbqRecord(scores?: Record<string, Record<string, number>>): Json {
  const d = COLD_WAR; const p = dbqPayload(scores); const imgs = p.sources.filter((s) => s.kind === "image"); const imageDocs = p.sources.flatMap((s, i) => (s.kind === "image" ? [i + 1] : []));
  const set_intro = realDbqPassage(d.order, reg, imageDocs); const first = imgs[0]; const more = imgs.slice(1);
  const stimulus = { kind: "image", description: `Documents ${imageDocs.join(" and ")}: ${imgs.map((s) => s.image!.alt).join(" ")}`, data: { path: first.image!.path, alt: first.image!.alt, credit: first.image!.credit, label: `Document ${first.id}`, more: more.map((s) => ({ path: s.image!.path, alt: s.image!.alt, credit: s.image!.credit, label: `Document ${s.id}` })) } };
  const high = d.samples.find((x) => x.tier === "high")!;
  const parts = [{ label: "A", prompt: frqTaskText(p), points: 7, response_mode: "essay", skill_codes: ["6.A"], topic_codes: [d.topic], model_answer: high.essay,
    rubric_rows: p.rubric.rows.map((r) => ({ row_id: r.row_id, points: r.max, criterion: r.task_specific, required_elements: [], optional_phrases: [], alt_solutions: [], common_errors: [], requires_row_id: null, requires_both: false, requires_numbers: false, numeric_tolerance: null, units_row: false })) }];
  const payload = { archetype: `ushfrq_${d.cell}`, template: "dbq", topic: d.topic, extra_topics: [], skill: "6.A", representative_skill: "6.A", calculator: "na", title: d.title, set_intro, stimulus, parts, reference_text: referenceText(p, d), ush_frq: p,
    design: { source_fixed_first: true, documents_chosen_before_prompt: true, thesis_space: d.theses, evidence_map: d.evidence_map } };
  return { ...base(d.cell, d.topic, d.unit, "6.A", `ushfrq_${d.cell}`, d.order.map((o) => o.id), d.slot), payload };
}

// ── LEQ: 자료가 없는 프롬프트 전용 문항. 기존 r19-f 레코드의 질문·루브릭·샘플을 그대로 두고 표지(provenance)만 '자료 없음'으로 정정한 새 키. ──
export function leqRecord(): Json {
  const all = rd("data/ap/stock/ush-r19f-items.json") as Json[]; const src = all.find((r) => r.stockKey === LEQ_SOURCE_KEY)!; const p = JSON.parse(JSON.stringify(src.payload)) as Json;
  const u = p.ush_frq as UshFrqPayload; u.provenance = { kind: "alton_composed", note: "The prompt, rubric, reference answer and sample responses are ALTON-authored practice material. The question has no source documents (prompt only), as on the AP exam." };
  p.archetype = `ushfrq_${LEQ_CELL}`;
  const lowAt = u.samples.findIndex((x) => x.tier === "low"); // 저점 샘플만 교체(독립 채점기가 대역 밖으로 매긴 답안)
  const rows = ["thesis", "evidence", "context", "analysis"];
  u.samples[lowAt] = { tier: "low", target_total: 2, essay: LEQ_LOW.essay, word_count: (LEQ_LOW.essay.match(/\S+/g) ?? []).length, rubric_scores: { thesis: 1, context: 0, evidence: 1, analysis: 0, total: 2 }, annotations: LEQ_LOW.annotations.map((a, i) => ({ ...a, row_id: rows[i] })) };
  const b = base(LEQ_CELL, src.keywordCode, src.unitCode, "6.A", `ushfrq_${LEQ_CELL}`, [], "US3 leq"); b.wording = "authored_prompt_only"; b.provenanceFix = { fromStockKey: LEQ_SOURCE_KEY, change: "provenance note corrected from 'fictional sources and attributions' to 'prompt only, no sources'" };
  return { ...b, payload: p };
}

export const draft = (): Json[] => [...SAQS_F.map((q) => saqRecord(q)), dbqRecord(), leqRecord()];

export function gates(rec: Json): string[] {
  const v: string[] = [];
  if (rec.payload.template === "dbq") v.push(...realDbqViolations(rec.payload, reg, COLD_WAR.order));
  else if (rec.payload.template === "leq") v.push(...frqViolations(rec.payload.ush_frq as UshFrqPayload).filter((x) => !/not_marked_alton_composed/.test(x)));
  else v.push(...realSaqViolations(rec.payload, reg, SAQS_F.find((q) => `ap_us_history-${q.cell}` === rec.cellId)!.order));
  const g = gateCandidate(rec as never); for (const i of g.issues.filter((x) => x.level === "error")) v.push(`figure_gate:${i.message ?? i.code ?? JSON.stringify(i)}`); if (g.status === "fail") v.push("figure_gate_status_fail");
  const plan = planConversion(rec as never); if (!plan.ok) v.push(`conversion:${JSON.stringify(plan).slice(0, 200)}`);
  return v;
}

function main() {
  const stage = process.argv[2] ?? "draft";
  const rv = registryViolations(registry); if (rv.length) { console.error("registry violations", rv); process.exit(1); }
  if (stage === "draft") {
    const recs = draft(); const bad = recs.flatMap((r) => gates(r).map((x) => `${r.cellId}: ${x}`));
    writeFileSync("data/ap/ush-sources/real-f-draft.json", JSON.stringify(recs, null, 1));
    console.log(`draft ${recs.length} records; gate violations: ${bad.length}`); for (const b of bad) console.log("  ", b);
    return;
  }
  const ver = rd("data/ap/ush-sources/real-f-verification.json") as Json; const out: Json[] = []; const unresolved: string[] = [];
  const mk = (id: string, build: (scores?: Record<string, Record<string, number>>) => Json, slot: string) => {
    const g = ver.frq?.[id]; if (!g) { unresolved.push(`${slot} (${id}: no grading record)`); return; }
    const rec = build(g.scores); let ok = g.ok === true; const v = gates(rec); if (v.length) { ok = false; console.log(id, "gate:", v); }
    (rec.payload as Json).verification = { fact_checker: ver.models.fact, graders: ver.models.graders, fact_verdicts: g.factVerdicts, flags: g.flags, sample_totals: g.totals, grader_totals: g.graderTotals, images_attached: Boolean(g.imagesAttached) };
    rec.reviewState = ok ? "verified_by_independent_models" : "has_unresolved_items"; rec.validation = ok ? "auto_passed" : "needs_review";
    if (ok) out.push(rec); else unresolved.push(`${slot} (${id})`);
  };
  for (const q of SAQS_F) mk(`ap_us_history-${q.cell}`, (s) => saqRecord(q, s), q.slot);
  mk(`ap_us_history-${COLD_WAR.cell}`, (s) => dbqRecord(s), COLD_WAR.slot);
  mk(`ap_us_history-${LEQ_CELL}`, () => { const r = leqRecord(); const u = r.payload.ush_frq as UshFrqPayload; const g = ver.frq[`ap_us_history-${LEQ_CELL}`]; for (const s of u.samples) { const sc = g.scores[s.tier]; s.rubric_scores = { ...sc, total: Object.values(sc).reduce((a: number, b) => a + Number(b), 0) }; s.target_total = s.rubric_scores.total; } return r; }, "US3 leq");
  writeFileSync("data/ap/stock/ush-real-f-items.json", JSON.stringify(out, null, 1));
  writeFileSync("data/ap/stock/ush-real-f-pass-keys.json", JSON.stringify(out.map((r) => r.stockKey), null, 1));
  writeFileSync("data/ap/stock/ush-real-f-summary.json", JSON.stringify({ run: RUN, generatedAt: new Date().toISOString().slice(0, 10), passed: out.map((r) => ({ stockKey: r.stockKey, replaces: r.replaces })), unresolved }, null, 1));
  console.log(`final: ${out.length} records written; unresolved: ${unresolved.length ? unresolved.join("; ") : "none"}`);
}
if (process.argv[1]?.endsWith("ush-real-f-build.ts")) main();
void REAL_DBQ_LABEL;
