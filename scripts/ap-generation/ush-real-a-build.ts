// US History Stage A 조립기(2026-10-15, DB 없음): 레지스트리 자료 + ush-real-a-content.ts → 재고 후보 레코드.
//   npx tsx scripts/ap-generation/ush-real-a-build.ts draft   # data/ap/ush-sources/real-a-draft.json (검증 전 초안; ush-real-a-verify.ts 가 읽는다)
//   npx tsx scripts/ap-generation/ush-real-a-build.ts final   # 검증 기록(data/ap/ush-sources/real-a-verification.json)을 반영하고 통과한 칸만 data/ap/stock/ush-real-a-items.json 에 쓴다
// 미해결 칸(키가 모호하거나 사실이 불확실)은 재고에 넣지 않고 보고에 남긴다.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { planConversion } from "../../lib/ap-exam/convert";
import { realFrqViolations, realSetViolations, registryViolations, type RegistrySource } from "../../lib/ap-generation/ush-real-gates";
import { frqReferenceText, USH_RUBRIC_ROWS, type UshFrqPayload, type UshSample } from "../../lib/ap-generation/ushistory-frq";
import { MC_SETS, SAQS, type McSet, type Saq } from "./ush-real-a-content";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const RUN = "ush-real-a"; const GATE_VERSION = "ush-real-a-2026-10-15"; const MARK = "Historical source (real document)";
const rd = (p: string) => JSON.parse(readFileSync(p, "utf-8"));
const registry: RegistrySource[] = rd("data/ap/ush-sources/registry.json").sources; const reg = new Map(registry.map((s) => [s.id, s]));
const credit = (s: RegistrySource) => `${s.author}, ${s.year}. ${s.repository}. Reuse: ${s.reuse_basis}. ${s.modified}.`;
const intro = (s: RegistrySource, extra: string) => `${MARK}\n(table)\n${s.title}\n${credit(s)} ${extra}\n\nThe table for this source appears below.`;
const stim = (s: RegistrySource, description: string) => ({ kind: "table", description, data: { columns: s.table!.columns, rows: s.table!.rows } });
const srcEntry = (s: RegistrySource) => ({ id: "A", kind: "table", title: s.title, attribution: credit(s), real_data: true, source_registry_id: s.id, source_sha256: s.sha256 });
const MC_TOPIC_PERIOD = (t: string) => Number(t.split(".")[0]);

function base(cell: string, kind: "mc" | "frq_bundle", keyword: string, unit: string, skill: string, structure: string, archetype: string, sourceId: string, difficulty: Json) {
  const key = `ap_us_history-${cell}-k0`; const stockKey = `${RUN}:${key}`;
  return { cellId: `ap_us_history-${cell}`, apSubjectCode: "ap_us_history", kind, calculator: "na", reserve: false, wording: "authored_from_real_source", candidateKey: key, keywordCode: keyword, unitCode: unit, skillPrimary: skill, structure, archetype,
    reviewState: "sample_unverified", rejectionReason: null, difficultyProvisional: "exam_prep", ...difficulty, gateOverride: GATE_VERSION, run: RUN, stockKey, pipeline: "real_source_v1", validation: "needs_review", gateVersion: GATE_VERSION, expertStatus: "unreviewed", releaseTier: "candidate",
    renderVerified: false, screenVerified: false, reviewEnvReady: false, selectedForSample: true, legacyReserve: false, family: "ap_us_history", itemFamilyId: `fam:${stockKey}`, canonicalKey: stockKey, duplicateOf: null, duplicateReason: null, contentKey: `ap_us_history:${keyword}`, sharedWith: [],
    stockCell: `ap_us_history|${keyword}|${skill}|${structure}|na`, history: [{ run: RUN, gateVersion: GATE_VERSION, outcome: "passed", reasons: null }], stimulusOrigin: "real_historical_source", sourceRegistryIds: [sourceId] };
}

function mcRecord(m: McSet): Json {
  const s = reg.get(m.sourceId)!;
  const items = m.items.map((it) => {
    const opts = it.options.map((x, i) => ({ text: x.text, why: x.why, value: null, label: i === it.key ? "key" : x.label }));
    const ex = [`The correct answer is "${opts[it.key].text}". ${opts[it.key].why}`, ...opts.map((x, i) => (i === it.key ? "" : `"${x.text}" is incorrect: ${x.why}`)).filter(Boolean)].join("\n");
    return { archetype: `ush_real_${it.tag}`, topic: it.topic, skill: it.skill, stem: it.stem, options: opts, key_index: it.key, explanation_en: ex, est_seconds: 75, facts: it.facts, design: { source_fixed_first: true, skill: it.skill, key_evidence_in_source: it.evidence } };
  });
  const payload = { archetype: `ush_real_${m.cell}`, topic: m.topic, skill: m.items[0].skill, calculator: "na", set_intro: intro(s, m.intro), stimulus: stim(s, m.tableDescription),
    ush_set: { period: m.period, stim_type: "quantitative", theme: m.theme, title: m.title, sources: [srcEntry(s)] }, items, excluded_items: [] };
  return { ...base(m.cell, "mc", m.topic, String(m.period), m.items[0].skill, "shared_stimulus_set", `ush_real_${m.cell}`, m.sourceId, { difficulty: m.items.map((it) => ({ label: it.skill.endsWith(".A") ? "basic_learning" : "exam_prep" })) }), replaces: m.slot, payload };
}

const rowsOf = (p: Saq) => USH_RUBRIC_ROWS.saq;
export function saqPayload(q: Saq, scores?: Record<string, Record<string, number>>): UshFrqPayload {
  const s = reg.get(q.sourceId)!; const ids = ["a", "b", "c"];
  const samples: UshSample[] = q.samples.map((x) => {
    const target = { high: 3, mid: 2, low: 1 }[x.tier]; const sc = scores?.[x.tier] ?? Object.fromEntries(ids.map((r, i) => [r, i < target ? 1 : 0]));
    const total = ids.reduce((a, r) => a + (sc[r] ?? 0), 0);
    return { tier: x.tier, target_total: total, essay: x.essay, word_count: (x.essay.match(/\S+/g) ?? []).length, rubric_scores: { ...Object.fromEntries(ids.map((r) => [r, sc[r] ?? 0])), total }, annotations: x.annotations };
  });
  const rows = USH_RUBRIC_ROWS.saq.map((r) => { const part = q.parts.find((x) => x.label.toLowerCase() === r.row_id)!; return { row_id: r.row_id, name: r.name, max: r.max, descriptors: { "0": part.descriptors[0], "1": part.descriptors[1] }, task_specific: part.criterion }; });
  return { schema_version: "ush-frq-1", task_type: "saq", template: "saq3", period: q.period, periods: q.periods, title: q.title,
    prompt: { scenario: q.scenario, task: "Using the table, answer parts A, B, and C.", requirements: ["Answer all three parts.", "Each part is worth one point.", "Use specific historical evidence for parts B and C."], parts: q.parts.map((x) => ({ label: x.label, prompt: x.prompt, points: 1 as const })) },
    sources: [{ ...srcEntry(s), kind: "table", body: q.tableDescription, table: { columns: s.table!.columns, rows: s.table!.rows }, provenance: { kind: "real_historical_source", real_data: true, note: `registry ${s.id}` } }] as never,
    rubric: { rubric_id: "ushistory-v1", total_points: 3, rows, scoring_notes: q.notes },
    expected_features: { saq_answers: Object.fromEntries(q.parts.map((x) => [x.label.toLowerCase(), x.answers])), common_pitfalls: q.pitfalls, facts: q.facts }, samples,
    provenance: { kind: "alton_composed", note: "Prompts, rubric and sample responses are ALTON-authored practice material; the table is a real Census Bureau source (see sources[0].source_registry_id)." } } as UshFrqPayload;
}
void rowsOf;
function saqRecord(q: Saq, scores?: Record<string, Record<string, number>>): Json {
  const s = reg.get(q.sourceId)!; const p = saqPayload(q, scores);
  const parts = q.parts.map((x) => ({ label: x.label, prompt: x.prompt, points: 1, response_mode: "explain", skill_codes: ["1.B"], topic_codes: [q.topic], model_answer: x.answers[0], rubric_rows: [{ row_id: x.label.toLowerCase(), points: 1, criterion: x.criterion, required_elements: x.answers, optional_phrases: [], alt_solutions: [], common_errors: [], requires_row_id: null, requires_both: false, requires_numbers: false, numeric_tolerance: null, units_row: false }] }));
  const payload = { archetype: `ushfrq_${q.cell}`, template: "saq3", topic: q.topic, extra_topics: [], skill: "1.B", representative_skill: "1.B", calculator: "na", title: q.title, set_intro: intro(s, q.intro), stimulus: stim(s, q.tableDescription), parts, reference_text: frqReferenceText(p), ush_frq: p,
    design: { source_fixed_first: true, evidence_in_source: q.designEvidence } };
  return { ...base(q.cell, "frq_bundle", q.topic, String(q.period), "1.B", "frq_multipart", `ushfrq_${q.cell}`, q.sourceId, {}), replaces: q.slot, payload };
}

export function buildDraft(): Json[] { return [...MC_SETS.map(mcRecord), ...SAQS.map((q) => saqRecord(q))]; }

function gates(rec: Json): string[] {
  const v: string[] = [];
  if (rec.kind === "mc") v.push(...realSetViolations(rec.payload, reg));
  else v.push(...realFrqViolations(rec.payload, reg));
  const g = gateCandidate(rec as never); for (const i of g.issues.filter((x) => x.level === "error")) v.push(`figure_gate:${i.message ?? i.code ?? JSON.stringify(i)}`); if (g.status === "fail") v.push("figure_gate_status_fail");
  const plan = planConversion(rec as never); if (!plan.ok) v.push(`conversion:${JSON.stringify(plan).slice(0, 200)}`);
  return v;
}

function main() {
  const stage = process.argv[2] ?? "draft";
  const rv = registryViolations(registry); if (rv.length) { console.error("registry violations", rv); process.exit(1); }
  if (stage === "draft") {
    const recs = buildDraft(); const bad = recs.flatMap((r) => gates(r).map((x) => `${r.cellId}: ${x}`));
    writeFileSync("data/ap/ush-sources/real-a-draft.json", JSON.stringify(recs, null, 1));
    console.log(`draft ${recs.length} records; gate violations: ${bad.length}`); for (const b of bad) console.log("  ", b);
    return;
  }
  const ver = rd("data/ap/ush-sources/real-a-verification.json") as Json;
  const out: Json[] = []; const unresolved: string[] = [];
  for (const m of MC_SETS) {
    const rec = mcRecord(m); const items = rec.payload.items as Json[]; let ok = true;
    items.forEach((it, i) => { const r = ver.items[`${rec.cellId}#${i + 1}`]; if (!r) { ok = false; return; }
      it.verification = { status: r.status, blind_solvers: ver.models.solvers, solver_choices: r.solverChoices, solver_confidence: r.solverConfidence, fact_checker: ver.models.fact, fact_verdict: r.factVerdict, flags: r.flags }; if (r.status !== "verified") ok = false; });
    const v = gates(rec); if (v.length) { ok = false; console.log(rec.cellId, "gate:", v); }
    rec.reviewState = ok ? "verified_by_independent_models" : "has_unresolved_items"; rec.validation = ok ? "auto_passed" : "needs_review";
    if (ok) out.push(rec); else unresolved.push(`${m.slot} (${rec.cellId})`);
  }
  for (const q of SAQS) {
    const id = `ap_us_history-${q.cell}`; const g = ver.frq?.[id]; let rec: Json;
    if (!g) { unresolved.push(`${q.slot} (${id}: no grading record)`); continue; }
    rec = saqRecord(q, g.scores); const p = rec.payload.ush_frq as UshFrqPayload; let ok = g.ok === true;
    const v = gates(rec); if (v.length) { ok = false; console.log(id, "gate:", v); }
    p.verification = undefined as never; (rec.payload as Json).verification = { fact_checker: ver.models.fact, graders: ver.models.graders, fact_verdicts: g.factVerdicts, flags: g.flags, sample_totals: g.totals, grader_totals: g.graderTotals };
    rec.reviewState = ok ? "verified_by_independent_models" : "has_unresolved_items"; rec.validation = ok ? "auto_passed" : "needs_review";
    if (ok) out.push(rec); else unresolved.push(`${q.slot} (${id})`);
  }
  writeFileSync("data/ap/stock/ush-real-a-items.json", JSON.stringify(out, null, 1));
  writeFileSync("data/ap/stock/ush-real-a-pass-keys.json", JSON.stringify(out.map((r) => r.stockKey), null, 1));
  writeFileSync("data/ap/stock/ush-real-a-summary.json", JSON.stringify({ run: RUN, generatedAt: new Date().toISOString().slice(0, 10), passed: out.map((r) => ({ stockKey: r.stockKey, replaces: r.replaces })), unresolved }, null, 1));
  console.log(`final: ${out.length} records written; unresolved: ${unresolved.length ? unresolved.join("; ") : "none"}`);
}
void MC_TOPIC_PERIOD; void existsSync;
if (process.argv[1]?.endsWith("ush-real-a-build.ts")) main();
