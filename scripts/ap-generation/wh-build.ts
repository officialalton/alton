// World History 재고 후보 레코드 조립(순수, DB 없음): 고정 계획 + 레지스트리 + 통과 문항/FRQ 재료 → ush-real 과 같은 모양의 재고 후보(stockKey, payload, 증거 필드).
import { gateCandidate } from "../../lib/ap-figures/gate";
import { planConversion } from "../../lib/ap-exam/convert";
import { WH_SOURCE_MARKER } from "../../lib/ap-generation/subjects/worldhistory";
import { loadWhRegistry, realSetIntro, realStimulus, srcEntry, whRealSetViolations, whRegistryViolations, type WhRegistrySource } from "../../lib/ap-generation/wh-real-gates";
import { WH_FRQS, WH_SETS, type WhFrqSpec, type WhSetSpec } from "../../lib/ap-generation/wh-plan";
import { whFrqIntro, whFrqSources, whFrqStimulus, whFrqViolations, whReferenceText, whFrqTaskText, type WhFrqPayload } from "../../lib/ap-generation/wh-frq";
import { whRealFrqViolations } from "./wh-real-frq-gates";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export const registry = (): Map<string, WhRegistrySource> => new Map(loadWhRegistry().map((s) => [s.id, s]));
export { whRegistryViolations, loadWhRegistry };
const SKILL_OF_TEMPLATE = (tpl: string, task: string) => (task === "saq" ? (tpl === "saq1" ? "3.C" : tpl === "saq2" ? "3.A" : "1.B") : "6.A");

function base(run: string, gate: string, cell: string, kind: "mc" | "frq_bundle", keyword: string, unit: string, skill: string, structure: string, archetype: string, sourceIds: string[], extra: Json) {
  const key = `ap_world_history-${cell}-k0`; const stockKey = `${run}:${key}`;
  return { cellId: `ap_world_history-${cell}`, apSubjectCode: "ap_world_history", kind, calculator: "na", reserve: false, wording: "designed_from_real_source", candidateKey: key, keywordCode: keyword, unitCode: unit, skillPrimary: skill, structure, archetype,
    reviewState: "sample_unverified", rejectionReason: null, difficultyProvisional: "exam_prep", ...extra, gateOverride: gate, run, stockKey, pipeline: "real_source_v1", validation: "needs_review", gateVersion: gate, expertStatus: "unreviewed", releaseTier: "candidate",
    renderVerified: false, screenVerified: false, reviewEnvReady: false, selectedForSample: true, legacyReserve: false, family: "ap_world_history", itemFamilyId: `fam:${stockKey}`, canonicalKey: stockKey, duplicateOf: null, duplicateReason: null, contentKey: `ap_world_history:${keyword}`, sharedWith: [],
    stockCell: `ap_world_history|${keyword}|${skill}|${structure}|na`, history: [{ run, gateVersion: gate, outcome: "passed", reasons: null }], stimulusOrigin: "real_historical_source", sourceRegistryIds: sourceIds };
}
export type McItem = { skill: string; topic: string; stem: string; options: { text: string; why: string; label: string }[]; key_index: number; facts: string[]; design: { key_evidence_in_source: string; evidence_quote: string }; est_seconds?: number; key_confidence?: unknown };
const explanation = (it: McItem) => { const k = it.options[it.key_index]; return [`The correct answer is "${k.text}". ${k.why.trim()}`, ...it.options.map((o, i) => (i === it.key_index ? "" : `"${o.text}" is incorrect: ${o.why.trim()}`)).filter(Boolean)].join("\n"); };

/** MC 세트 후보 레코드(통과한 문항 items 를 담는다). */
export function mcRecord(run: string, gate: string, spec: WhSetSpec, items: McItem[], reg = registry()): Json {
  const intro = realSetIntro(spec.sources, reg); const st = realStimulus(spec.sources, reg);
  const rows = items.map((it) => ({ archetype: `wh_${spec.id}_${it.skill.replace(".", "")}`, topic: it.topic, skill: it.skill, stem: it.stem, options: it.options.map((o, i) => ({ text: o.text, why: o.why, value: null, label: i === it.key_index ? "key" : o.label })), key_index: it.key_index, explanation_en: explanation(it), est_seconds: Math.min(150, Math.max(30, it.est_seconds || 75)), facts: it.facts,
    design: { source_fixed_first: true, skill: it.skill, key_evidence_in_source: it.design.key_evidence_in_source, evidence_quote: it.design.evidence_quote }, ...(it.key_confidence ? { key_confidence: it.key_confidence } : {}) }));
  const payload = { archetype: `wh_${spec.id}`, topic: items[0].topic, skill: items[0].skill, calculator: "na", set_intro: intro, ...(st ? { stimulus: st } : {}),
    wh_set: { unit: spec.unit, stim_type: spec.stim, theme: spec.theme, title: spec.theme, sources: spec.sources.map((r, i) => srcEntry(reg.get(r.id)!, spec.sources.length > 1 ? String.fromCharCode(65 + i) : "A", r.context)) }, items: rows, excluded_items: [] };
  return { ...base(run, gate, spec.id, "mc", items[0].topic, String(spec.unit), items[0].skill, "shared_stimulus_set", `wh_${spec.id}`, spec.sources.map((s) => s.id), { difficulty: items.map((it) => ({ label: it.skill.endsWith(".A") ? "basic_learning" : "exam_prep" })) }), exam: spec.exam, payload };
}

/** FRQ 후보 레코드. p 는 whap_frq(샘플·채점 반영 후). */
export function frqRecord(run: string, gate: string, spec: WhFrqSpec, p: WhFrqPayload, reg = registry()): Json {
  const task = p.task_type; const skill = SKILL_OF_TEMPLATE(spec.template, task); const kw = `${spec.units[0]}.1`;
  const hi = p.samples.find((s) => s.tier === "high")!;
  const parts = task === "saq" ? (p.prompt.parts ?? []).map((x) => ({ label: x.label, prompt: x.prompt, points: 1, response_mode: "explain", skill_codes: [skill], topic_codes: [kw], model_answer: (p.expected_features.saq_answers?.[x.label.toLowerCase()] ?? [""])[0], rubric_rows: [{ row_id: x.label.toLowerCase(), points: 1, criterion: p.rubric.rows.find((r) => r.row_id === x.label.toLowerCase())?.task_specific ?? "", required_elements: p.expected_features.saq_answers?.[x.label.toLowerCase()] ?? [], optional_phrases: [], alt_solutions: [], common_errors: [], requires_row_id: null, requires_both: false, requires_numbers: false, numeric_tolerance: null, units_row: false }] }))
    : [{ label: "A", prompt: whFrqTaskText(p), points: p.rubric.total_points, response_mode: "essay", skill_codes: [skill], topic_codes: [kw], model_answer: hi?.essay ?? "", rubric_rows: p.rubric.rows.map((r) => ({ row_id: r.row_id, points: r.max, criterion: r.task_specific, required_elements: [], optional_phrases: [], alt_solutions: [], common_errors: [], requires_row_id: null, requires_both: false, requires_numbers: false, numeric_tolerance: null, units_row: false })) }];
  const st = whFrqStimulus(spec, reg);
  const payload = { archetype: `whfrq_${spec.id}`, template: spec.template, topic: kw, extra_topics: [], skill, representative_skill: skill, calculator: "na", title: p.title, set_intro: whFrqIntro(spec, reg), ...(st ? { stimulus: st } : {}), parts, reference_text: whReferenceText(p), whap_frq: p, design: { source_fixed_first: true, documents_chosen_before_prompt: true } };
  return { ...base(run, gate, spec.id, "frq_bundle", kw, String(spec.units[0]), skill, "frq_multipart", `whfrq_${spec.id}`, spec.sources.map((s) => s.id), {}), exam: spec.exam, payload };
}

/** 레코드 게이트: 실제 자료 일치 + 그림·변환 게이트. */
export function mcGates(rec: Json, spec: WhSetSpec, reg = registry()): string[] {
  const v = whRealSetViolations(rec.payload, reg, spec);
  const g = gateCandidate(rec as never); for (const i of g.issues.filter((x) => x.level === "error")) v.push(`figure_gate:${i.message ?? i.code ?? JSON.stringify(i)}`); if (g.status === "fail") v.push("figure_gate_status_fail");
  const plan = planConversion(rec as never); if (!plan.ok) v.push(`conversion:${JSON.stringify(plan).slice(0, 200)}`);
  return v;
}
export function frqGates(rec: Json, spec: WhFrqSpec, reg = registry(), corpus: { id: string; text: string }[] = []): string[] {
  const v = [...whFrqViolations(rec.payload.whap_frq, spec, reg, corpus), ...whRealFrqViolations(rec.payload, reg, spec)];
  const g = gateCandidate(rec as never); for (const i of g.issues.filter((x) => x.level === "error")) v.push(`figure_gate:${i.message ?? i.code ?? JSON.stringify(i)}`); if (g.status === "fail") v.push("figure_gate_status_fail");
  const plan = planConversion(rec as never); if (!plan.ok) v.push(`conversion:${JSON.stringify(plan).slice(0, 200)}`);
  return v;
}
export const specOf = (id: string) => WH_SETS.find((s) => s.id === id)!; export const frqSpecOf = (id: string) => WH_FRQS.find((s) => s.id === id)!;
export { WH_SOURCE_MARKER, whFrqSources };
