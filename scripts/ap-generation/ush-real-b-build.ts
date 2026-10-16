// US History Stage B 조립기(2026-10-15, DB 없음): 레지스트리 자료 + ush-real-b-content.ts → 실제 자료 DBQ 재고 후보 레코드 2건.
//   npx tsx scripts/ap-generation/ush-real-b-build.ts draft   # data/ap/ush-sources/real-b-draft.json (검증 전; ush-real-b-verify.ts 가 읽는다)
//   npx tsx scripts/ap-generation/ush-real-b-build.ts final   # 검증 기록(real-b-verification.json)을 반영하고 통과한 칸만 data/ap/stock/ush-real-b-items.json 에 쓴다
// 미해결 칸(사실이 불확실하거나 채점기 점수가 대역을 벗어남)은 재고에 넣지 않고 보고에 남긴다.
import { readFileSync, writeFileSync } from "node:fs";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { planConversion } from "../../lib/ap-exam/convert";
import { registryViolations, type RegistrySource } from "../../lib/ap-generation/ush-real-gates";
import { realDbqPassage, realDbqViolations, REAL_DBQ_LABEL } from "../../lib/ap-generation/ush-real-dbq";
import { frqReferenceText, frqTaskText, USH_RUBRIC_ROWS, type UshFrqPayload, type UshSample } from "../../lib/ap-generation/ushistory-frq";
import type { UshSource } from "../../lib/ap-generation/ushistory-gates";
import { descriptorsFor, MARKET, REGULATION, REQUIREMENTS, type Dbq } from "./ush-real-b-content";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export const RUN = "ush-real-b"; export const GATE_VERSION = "ush-real-b-2026-10-15";
const rd = (p: string) => JSON.parse(readFileSync(p, "utf-8"));
export const registry: RegistrySource[] = rd("data/ap/ush-sources/registry.json").sources; export const reg = new Map(registry.map((s) => [s.id, s]));
export const DBQS: Dbq[] = [MARKET, REGULATION];
const credit = (s: RegistrySource) => `${s.author}, ${s.year}. ${s.repository}. Reuse: ${s.reuse_basis}. ${s.modified}.`;
const KIND: Record<string, UshSource["kind"]> = { primary_text: "primary_text", secondary_text: "secondary_text", statistic_table: "table", political_cartoon: "image", photograph: "image", map: "image", print: "image" };

export function sourcesOf(d: Dbq): UshSource[] {
  return d.order.map((o, i) => {
    const r = reg.get(o.id)!; const kind = KIND[r.type];
    const body = r.excerpt_segments ? r.excerpt_segments.join(" [...] ") : r.table ? "Census counts of the resident population by region (table)." : (r.alt ?? "");
    return { id: String(i + 1), kind, title: r.title, attribution: credit(r), body, ...(r.table ? { table: { columns: r.table.columns, rows: r.table.rows } } : {}),
      ...(kind === "image" ? { image: { path: r.public_path!, alt: r.alt!, credit: r.credit! } } : {}),
      source_registry_id: r.id, source_sha256: r.sha256, real_data: true, provenance: { kind: "real_historical_source" as const, real_data: true, note: `registry ${r.id}` } } as UshSource;
  });
}
export function frqPayload(d: Dbq, scores?: Record<string, Record<string, number>>): UshFrqPayload {
  const rowsDef = USH_RUBRIC_ROWS.dbq; const desc = descriptorsFor(d === MARKET ? "change in Americans' lives" : "federal regulation", d === MARKET ? "1815 to 1860" : "1880 to 1910");
  const target = { high: 6, mid: 4, low: 2 } as const; const ids = rowsDef.map((r) => r.row_id);
  const fallback = (tier: "high" | "mid" | "low") => { let left = target[tier]; return Object.fromEntries(rowsDef.map((r) => { const v = Math.min(r.max, left); left -= v; return [r.row_id, v]; })); };
  const samples: UshSample[] = d.samples.map((x) => {
    const sc = scores?.[x.tier] ?? fallback(x.tier); const total = ids.reduce((a, r) => a + (sc[r] ?? 0), 0);
    return { tier: x.tier, target_total: total, essay: x.essay, word_count: (x.essay.match(/\S+/g) ?? []).length, rubric_scores: { ...Object.fromEntries(ids.map((r) => [r, sc[r] ?? 0])), total }, annotations: x.annotations };
  });
  return { schema_version: "ush-frq-1", task_type: "dbq", template: "dbq", period: d.period, periods: d.periods, title: d.title,
    prompt: { scenario: d.scenario, task: d.task, requirements: REQUIREMENTS }, sources: sourcesOf(d),
    rubric: { rubric_id: "ushistory-v1", total_points: 7, rows: rowsDef.map((r) => ({ row_id: r.row_id, name: r.name, max: r.max, descriptors: (desc as Json)[r.row_id], task_specific: (d.rubric as Json)[r.row_id] })), scoring_notes: d.notes },
    expected_features: { defensible_theses: d.theses, contextualization_ideas: d.context_ideas, outside_evidence: d.outside, reasoning_types: d.reasoning, doc_uses: d.doc_uses.map((u) => ({ source_id: u.source_id, usable_for: u.usable_for, sourcing: u.sourcing })), evidence_map: d.evidence_map, common_pitfalls: d.pitfalls, facts: d.facts },
    samples, provenance: { kind: "alton_composed", note: "The prompt, rubric, evidence map and sample essays are ALTON-authored practice material; all seven documents are real historical sources (see sources[].source_registry_id)." } };
}
export const referenceText = (p: UshFrqPayload, d: Dbq): string => {
  const base = frqReferenceText(p).split("\n"); base[0] = `Scoring guide (${REAL_DBQ_LABEL}). This question is worth ${p.rubric.total_points} points.`;
  const map = ["", "Evidence map (which documents support or complicate each line of reasoning):", ...d.evidence_map.map((l) => `- ${l.line}. Supports: Document ${l.supports.join(", ")}${l.complicates.length ? `. Complicates: Document ${l.complicates.join(", ")}` : ""}.`), "", "Using the documents (use and sourcing):", ...d.doc_uses.map((u) => `- Document ${u.source_id}: ${u.usable_for} Sourcing: ${u.sourcing}`)];
  const at = base.findIndex((l) => l.startsWith("Sample response")); const head = at > 0 ? at - 1 : base.length; // 샘플 앞(빈 줄 앞)에 끼운다
  return [...base.slice(0, head), ...map, ...base.slice(head)].join("\n");
};

function baseRec(d: Dbq): Json {
  const key = `ap_us_history-${d.cell}-k0`; const stockKey = `${RUN}:${key}`;
  return { cellId: `ap_us_history-${d.cell}`, apSubjectCode: "ap_us_history", kind: "frq_bundle", calculator: "na", reserve: false, wording: "authored_from_real_source", candidateKey: key, keywordCode: d.topic, unitCode: d.unit, skillPrimary: "6.A", structure: "frq_multipart", archetype: `ushfrq_${d.cell}`,
    reviewState: "sample_unverified", rejectionReason: null, difficultyProvisional: "exam_prep", gateOverride: GATE_VERSION, run: RUN, stockKey, pipeline: "real_source_v1", validation: "needs_review", gateVersion: GATE_VERSION, expertStatus: "unreviewed", releaseTier: "candidate",
    renderVerified: false, screenVerified: false, reviewEnvReady: false, selectedForSample: true, legacyReserve: false, family: "ap_us_history", itemFamilyId: `fam:${stockKey}`, canonicalKey: stockKey, duplicateOf: null, duplicateReason: null, contentKey: `ap_us_history:${d.topic}`, sharedWith: [],
    stockCell: `ap_us_history|${d.topic}|6.A|frq_multipart|na`, history: [{ run: RUN, gateVersion: GATE_VERSION, outcome: "passed", reasons: null }], stimulusOrigin: "real_historical_source", sourceRegistryIds: d.order.map((o) => o.id), replaces: d.slot };
}
export function dbqRecord(d: Dbq, scores?: Record<string, Record<string, number>>): Json {
  const p = frqPayload(d, scores); const imgs = p.sources.filter((s) => s.kind === "image");
  const imageDocs = p.sources.flatMap((s, i) => (s.kind === "image" ? [i + 1] : []));
  const set_intro = realDbqPassage(d.order, reg, imageDocs);
  const first = imgs[0]; const more = imgs.slice(1);
  const stimulus = { kind: "image", description: `Documents ${imageDocs.join(" and ")}: ${imgs.map((s) => s.image!.alt).join(" ")}`, data: { path: first.image!.path, alt: first.image!.alt, credit: first.image!.credit, label: `Document ${first.id}`, more: more.map((s) => ({ path: s.image!.path, alt: s.image!.alt, credit: s.image!.credit, label: `Document ${s.id}` })) } };
  const high = d.samples.find((x) => x.tier === "high")!;
  const parts = [{ label: "A", prompt: frqTaskText(p), points: 7, response_mode: "essay", skill_codes: ["6.A"], topic_codes: [d.topic], model_answer: high.essay,
    rubric_rows: p.rubric.rows.map((r) => ({ row_id: r.row_id, points: r.max, criterion: r.task_specific, required_elements: [], optional_phrases: [], alt_solutions: [], common_errors: [], requires_row_id: null, requires_both: false, requires_numbers: false, numeric_tolerance: null, units_row: false })) }];
  const payload = { archetype: `ushfrq_${d.cell}`, template: "dbq", topic: d.topic, extra_topics: [], skill: "6.A", representative_skill: "6.A", calculator: "na", title: d.title, set_intro, stimulus, parts, reference_text: referenceText(p, d), ush_frq: p,
    design: { source_fixed_first: true, documents_chosen_before_prompt: true, thesis_space: d.theses, evidence_map: d.evidence_map } };
  return { ...baseRec(d), payload };
}
export const draft = (): Json[] => DBQS.map((d) => dbqRecord(d));

export function gates(rec: Json, d: Dbq): string[] {
  const v: string[] = [];
  v.push(...realDbqViolations(rec.payload, reg, d.order));
  const g = gateCandidate(rec as never); for (const i of g.issues.filter((x) => x.level === "error")) v.push(`figure_gate:${i.message ?? i.code ?? JSON.stringify(i)}`); if (g.status === "fail") v.push("figure_gate_status_fail");
  const plan = planConversion(rec as never); if (!plan.ok) v.push(`conversion:${JSON.stringify(plan).slice(0, 200)}`);
  return v;
}

function main() {
  const stage = process.argv[2] ?? "draft";
  const rv = registryViolations(registry); if (rv.length) { console.error("registry violations", rv); process.exit(1); }
  if (stage === "draft") {
    const recs = draft(); const bad = recs.flatMap((r, i) => gates(r, DBQS[i]).map((x) => `${r.cellId}: ${x}`));
    writeFileSync("data/ap/ush-sources/real-b-draft.json", JSON.stringify(recs, null, 1));
    console.log(`draft ${recs.length} records; gate violations: ${bad.length}`); for (const b of bad) console.log("  ", b);
    return;
  }
  const ver = rd("data/ap/ush-sources/real-b-verification.json") as Json; const out: Json[] = []; const unresolved: string[] = [];
  for (const d of DBQS) {
    const id = `ap_us_history-${d.cell}`; const g = ver.frq?.[id];
    if (!g) { unresolved.push(`${d.slot} (${id}: no grading record)`); continue; }
    const rec = dbqRecord(d, g.scores); let ok = g.ok === true; const v = gates(rec, d); if (v.length) { ok = false; console.log(id, "gate:", v); }
    (rec.payload as Json).verification = { fact_checker: ver.models.fact, graders: ver.models.graders, fact_verdicts: g.factVerdicts, flags: g.flags, sample_totals: g.totals, grader_totals: g.graderTotals, bands: { high: "5-7", mid: "3-5", low: "1-3" } };
    rec.reviewState = ok ? "verified_by_independent_models" : "has_unresolved_items"; rec.validation = ok ? "auto_passed" : "needs_review";
    if (ok) out.push(rec); else unresolved.push(`${d.slot} (${id})`);
  }
  writeFileSync("data/ap/stock/ush-real-b-items.json", JSON.stringify(out, null, 1));
  writeFileSync("data/ap/stock/ush-real-b-pass-keys.json", JSON.stringify(out.map((r) => r.stockKey), null, 1));
  writeFileSync("data/ap/stock/ush-real-b-summary.json", JSON.stringify({ run: RUN, generatedAt: new Date().toISOString().slice(0, 10), passed: out.map((r) => ({ stockKey: r.stockKey, replaces: r.replaces })), unresolved }, null, 1));
  console.log(`final: ${out.length} records written; unresolved: ${unresolved.length ? unresolved.join("; ") : "none"}`);
}
if (process.argv[1]?.endsWith("ush-real-b-build.ts")) main();
