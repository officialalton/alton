// US History Stage C·D 조립기(2026-10-15, DB 없음): 레지스트리 자료 + ush-real-c/d-content.ts → 재고 후보 레코드(MC 세트).
//   npx tsx scripts/ap-generation/ush-real-cd-build.ts c draft   # data/ap/ush-sources/real-c-draft.json (검증 전 초안; ush-real-cd-verify.ts 가 읽는다)
//   npx tsx scripts/ap-generation/ush-real-cd-build.ts c final   # 검증 기록(real-c-verification.json)을 반영하고 통과한 칸만 data/ap/stock/ush-real-c-items.json 에 쓴다 (d 도 같음)
// 미해결 칸(키가 모호하거나 사실이 불확실)은 재고에 넣지 않고 보고에 남긴다.
import { readFileSync, writeFileSync } from "node:fs";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { planConversion } from "../../lib/ap-exam/convert";
import { realSetViolations, registryViolations, type RegistrySource } from "../../lib/ap-generation/ush-real-gates";
import { MC_SETS_C, type McSet } from "./ush-real-c-content";
import { MC_SETS_D } from "./ush-real-d-content";
import { MC_SETS_E } from "./ush-real-e-content";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type Run = "c" | "d" | "e";
export const RUNS: Record<Run, { run: string; gate: string; sets: McSet[] }> = {
  c: { run: "ush-real-c", gate: "ush-real-c-2026-10-15", sets: MC_SETS_C },
  d: { run: "ush-real-d", gate: "ush-real-d-2026-10-15", sets: MC_SETS_D },
  e: { run: "ush-real-e", gate: "ush-real-e-2026-10-19", sets: MC_SETS_E },
};
const MARK = "Historical source (real document)";
const rd = (p: string) => JSON.parse(readFileSync(p, "utf-8"));
export const loadRegistry = (): RegistrySource[] => rd("data/ap/ush-sources/registry.json").sources;
const TYPE_LABEL: Record<string, string> = { primary_text: "primary source", political_cartoon: "political cartoon", map: "map" };
const credit = (s: RegistrySource) => `${s.author}, ${s.year}. ${s.repository}. Reuse: ${s.reuse_basis}. ${s.modified}.`;
const placeKey = <T,>(arr: T[], from: number, to: number): T[] => { const rest = arr.filter((_, i) => i !== from); rest.splice(to, 0, arr[from]); return rest; };

export function setIntro(m: McSet, s: RegistrySource): string {
  const head = `${MARK}\n(${TYPE_LABEL[s.type] ?? s.type})\n${s.title}\n${credit(s)} ${m.intro}`;
  return m.kind === "text" ? `${head}\n\n"${s.excerpt_segments!.join(" [...] ")}"` : `${head}\n\nThe image for this source appears below.`;
}

function base(run: Run, m: McSet) {
  const { run: RUN, gate } = RUNS[run]; const key = `ap_us_history-${m.cell}-k0`; const stockKey = `${RUN}:${key}`; const skill = m.items[0].skill;
  return { cellId: `ap_us_history-${m.cell}`, apSubjectCode: "ap_us_history", kind: "mc", calculator: "na", reserve: false, wording: "authored_from_real_source", candidateKey: key, keywordCode: m.topic, unitCode: String(m.period), skillPrimary: skill, structure: "shared_stimulus_set", archetype: `ush_real_${m.cell}`,
    reviewState: "sample_unverified", rejectionReason: null, difficultyProvisional: "exam_prep", difficulty: m.difficulty.map((label) => ({ label })), gateOverride: gate, run: RUN, stockKey, pipeline: "real_source_v1", validation: "needs_review", gateVersion: gate, expertStatus: "unreviewed", releaseTier: "candidate",
    renderVerified: false, screenVerified: false, reviewEnvReady: false, selectedForSample: true, legacyReserve: false, family: "ap_us_history", itemFamilyId: `fam:${stockKey}`, canonicalKey: stockKey, duplicateOf: null, duplicateReason: null, contentKey: `ap_us_history:${m.topic}`, sharedWith: [],
    stockCell: `ap_us_history|${m.topic}|${skill}|shared_stimulus_set|na`, history: [{ run: RUN, gateVersion: gate, outcome: "passed", reasons: null }], stimulusOrigin: "real_historical_source", sourceRegistryIds: [m.sourceId] };
}

export function mcRecord(run: Run, m: McSet, reg: Map<string, RegistrySource>): Json {
  const s = reg.get(m.sourceId)!;
  const items = m.items.map((it, n) => {
    const keyIdx = m.keyAt[n];
    const opts = placeKey(it.options.map((x, i) => ({ text: x.text, why: x.why, value: null, label: i === it.key ? "key" : x.label })), it.key, keyIdx);
    const ex = [`The correct answer is "${opts[keyIdx].text}". ${opts[keyIdx].why}`, ...opts.map((x, i) => (i === keyIdx ? "" : `"${x.text}" is incorrect: ${x.why}`)).filter(Boolean)].join("\n");
    return { archetype: `ush_real_${it.tag}`, topic: it.topic, skill: it.skill, stem: it.stem, options: opts, key_index: keyIdx, explanation_en: ex, est_seconds: 75, facts: it.facts, design: { source_fixed_first: true, skill: it.skill, key_evidence_in_source: it.evidence } };
  });
  const src = { id: "A", kind: m.kind === "text" ? "primary_text" : "image", title: s.title, attribution: credit(s), real_data: true, source_registry_id: s.id, source_sha256: s.sha256 };
  const stimulus = m.kind === "image" ? { kind: "image", description: m.stimDescription, data: { path: s.public_path, alt: s.alt, credit: s.credit } } : undefined;
  const payload = { archetype: `ush_real_${m.cell}`, topic: m.topic, skill: m.items[0].skill, calculator: "na", set_intro: setIntro(m, s), ...(stimulus ? { stimulus } : {}),
    ush_set: { period: m.period, stim_type: m.kind === "text" ? "primary_text" : "visual", theme: m.theme, title: m.title, sources: [src] }, items, excluded_items: [] };
  return { ...base(run, m), replaces: m.slot, payload };
}

export function gates(rec: Json, reg: Map<string, RegistrySource>): string[] {
  const v: string[] = [...realSetViolations(rec.payload, reg)];
  const g = gateCandidate(rec as never); for (const i of g.issues.filter((x) => x.level === "error")) v.push(`figure_gate:${i.message ?? i.code ?? JSON.stringify(i)}`); if (g.status === "fail") v.push("figure_gate_status_fail");
  const plan = planConversion(rec as never); if (!plan.ok) v.push(`conversion:${JSON.stringify(plan).slice(0, 200)}`);
  return v;
}
export const buildDraft = (run: Run): Json[] => { const reg = new Map(loadRegistry().map((s) => [s.id, s])); return RUNS[run].sets.map((m) => mcRecord(run, m, reg)); };

function main() {
  const run = (process.argv[2] ?? "c") as Run; const stage = process.argv[3] ?? "draft"; const { run: RUN } = RUNS[run];
  const registry = loadRegistry(); const reg = new Map(registry.map((s) => [s.id, s]));
  const rv = registryViolations(registry); if (rv.length) { console.error("registry violations", rv); process.exit(1); }
  if (stage === "draft") {
    const recs = buildDraft(run); const bad = recs.flatMap((r) => gates(r, reg).map((x) => `${r.cellId}: ${x}`));
    writeFileSync(`data/ap/ush-sources/real-${run}-draft.json`, JSON.stringify(recs, null, 1));
    console.log(`draft ${recs.length} records; gate violations: ${bad.length}`); for (const b of bad) console.log("  ", b);
    return;
  }
  const ver = rd(`data/ap/ush-sources/real-${run}-verification.json`) as Json;
  const out: Json[] = []; const unresolved: string[] = [];
  for (const m of RUNS[run].sets) {
    const rec = mcRecord(run, m, reg); const items = rec.payload.items as Json[]; let ok = true;
    items.forEach((it, i) => { const r = ver.items[`${rec.cellId}#${i + 1}`]; if (!r) { ok = false; return; }
      it.verification = { status: r.status, blind_solvers: ver.models.solvers, solver_choices: r.solverChoices, solver_confidence: r.solverConfidence, fact_checker: ver.models.fact, fact_verdict: r.factVerdict, flags: r.flags, images_attached: m.kind === "image" }; if (r.status !== "verified") ok = false; });
    const v = gates(rec, reg); if (v.length) { ok = false; console.log(rec.cellId, "gate:", v); }
    rec.reviewState = ok ? "verified_by_independent_models" : "has_unresolved_items"; rec.validation = ok ? "auto_passed" : "needs_review";
    if (ok) out.push(rec); else unresolved.push(`${m.slot} (${rec.cellId})`);
  }
  writeFileSync(`data/ap/stock/${RUN}-items.json`, JSON.stringify(out, null, 1));
  writeFileSync(`data/ap/stock/${RUN}-pass-keys.json`, JSON.stringify(out.map((r) => r.stockKey), null, 1));
  writeFileSync(`data/ap/stock/${RUN}-summary.json`, JSON.stringify({ run: RUN, generatedAt: new Date().toISOString().slice(0, 10), passed: out.map((r) => ({ stockKey: r.stockKey, replaces: r.replaces })), unresolved }, null, 1));
  console.log(`final: ${out.length} records written; unresolved: ${unresolved.length ? unresolved.join("; ") : "none"}`);
}
if (process.argv[1]?.endsWith("ush-real-cd-build.ts")) main();
