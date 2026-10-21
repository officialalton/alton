// US History Stage G 조립기(2026-10-21, US3 MC 전환, DB 없음): 레지스트리 자료 + ush-real-g-content.ts → 재고 후보 레코드(MC 세트 14).
//   npx tsx scripts/ap-generation/ush-real-g-build.ts draft   # data/ap/ush-sources/real-g-draft.json (검증 전; ush-real-g-verify.ts 가 읽는다)
//   npx tsx scripts/ap-generation/ush-real-g-build.ts final   # 검증 기록(real-g-verification.json)을 반영하고 통과한 세트만 data/ap/stock/ush-real-g-items.json 에 쓴다
// 미해결 세트(키가 모호하거나 사실이 불확실)는 재고에 넣지 않고 보고에 남긴다. 구 p1a·p2a·p3a 키는 삭제하지 않는다.
import { readFileSync, writeFileSync } from "node:fs";
import { gateCandidate } from "../../lib/ap-figures/gate";
import { planConversion } from "../../lib/ap-exam/convert";
import { realSetViolations, registryViolations, type RegistrySource } from "../../lib/ap-generation/ush-real-gates";
import { KIND_FOR_SAQ, realSaqPassage, realSaqStimulus, saqCredit } from "../../lib/ap-generation/ush-real-saq";
import { MC_SETS_G, type McSetG } from "./ush-real-g-content";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export const RUN = "ush-real-g"; export const GATE_VERSION = "ush-real-g-2026-10-21";
const rd = (p: string) => JSON.parse(readFileSync(p, "utf-8"));
export const registry: RegistrySource[] = rd("data/ap/ush-sources/registry.json").sources; export const reg = new Map(registry.map((s) => [s.id, s]));
const placeKey = <T,>(arr: T[], from: number, to: number): T[] => { const rest = arr.filter((_, i) => i !== from); rest.splice(to, 0, arr[from]); return rest; };

function base(m: McSetG): Json {
  const key = `ap_us_history-${m.cell}-k0`; const stockKey = `${RUN}:${key}`; const skill = m.items[0].skill;
  return { cellId: `ap_us_history-${m.cell}`, apSubjectCode: "ap_us_history", kind: "mc", calculator: "na", reserve: false, wording: "authored_from_real_source", candidateKey: key, keywordCode: m.topic, unitCode: String(m.period), skillPrimary: skill, structure: "shared_stimulus_set", archetype: `ush_real_${m.cell}`,
    reviewState: "sample_unverified", rejectionReason: null, difficultyProvisional: "exam_prep", difficulty: m.difficulty.map((label) => ({ label })), gateOverride: GATE_VERSION, run: RUN, stockKey, pipeline: "real_source_v1", validation: "needs_review", gateVersion: GATE_VERSION, expertStatus: "unreviewed", releaseTier: "candidate",
    renderVerified: false, screenVerified: false, reviewEnvReady: false, selectedForSample: true, legacyReserve: false, family: "ap_us_history", itemFamilyId: `fam:${stockKey}`, canonicalKey: stockKey, duplicateOf: null, duplicateReason: null, contentKey: `ap_us_history:${m.topic}`, sharedWith: [],
    stockCell: `ap_us_history|${m.topic}|${skill}|shared_stimulus_set|na`, history: [{ run: RUN, gateVersion: GATE_VERSION, outcome: "passed", reasons: null }], stimulusOrigin: "real_historical_source", sourceRegistryIds: m.order.map((o) => o.id) };
}
export function mcRecord(m: McSetG): Json {
  const items = m.items.map((it, n) => {
    const keyIdx = m.keyAt[n]; const opts = placeKey(it.options.map((x, i) => ({ text: x.text, why: x.why, value: null, label: i === it.key ? "key" : x.label })), it.key, keyIdx);
    const ex = [`The correct answer is "${opts[keyIdx].text}". ${opts[keyIdx].why}`, ...opts.map((x, i) => (i === keyIdx ? "" : `"${x.text}" is incorrect: ${x.why}`)).filter(Boolean)].join("\n");
    return { archetype: `ush_real_${it.tag}`, topic: it.topic, skill: it.skill, stem: it.stem, options: opts, key_index: keyIdx, explanation_en: ex, est_seconds: 75, facts: it.facts, design: { source_fixed_first: true, skill: it.skill, key_evidence_in_source: it.evidence } };
  });
  const multi = m.order.length > 1;
  const sources = m.order.map((o, i) => { const s = reg.get(o.id)!; return { id: multi ? String.fromCharCode(65 + i) : "A", kind: KIND_FOR_SAQ[s.type], title: s.title, attribution: saqCredit(s), real_data: true, source_registry_id: s.id, source_sha256: s.sha256 }; });
  const stim = realSaqStimulus(m.order, reg);
  const payload = { archetype: `ush_real_${m.cell}`, topic: m.topic, skill: m.items[0].skill, calculator: "na", set_intro: realSaqPassage(m.order, reg), ...(stim ? { stimulus: stim } : {}),
    ush_set: { period: m.period, stim_type: m.stim, theme: m.theme, title: m.title, sources }, items, excluded_items: [] };
  return { ...base(m), replaces: m.slot, payload };
}
export function gates(rec: Json): string[] {
  const v: string[] = [...realSetViolations(rec.payload, reg)];
  const g = gateCandidate(rec as never); for (const i of g.issues.filter((x) => x.level === "error")) v.push(`figure_gate:${i.message ?? i.code ?? JSON.stringify(i)}`); if (g.status === "fail") v.push("figure_gate_status_fail");
  const plan = planConversion(rec as never); if (!plan.ok) v.push(`conversion:${JSON.stringify(plan).slice(0, 200)}`);
  return v;
}
export const buildDraft = (): Json[] => MC_SETS_G.map(mcRecord);

function main() {
  const stage = process.argv[2] ?? "draft";
  const rv = registryViolations(registry); if (rv.length) { console.error("registry violations", rv); process.exit(1); }
  if (stage === "draft") {
    const recs = buildDraft(); const bad = recs.flatMap((r) => gates(r).map((x) => `${r.cellId}: ${x}`));
    writeFileSync("data/ap/ush-sources/real-g-draft.json", JSON.stringify(recs, null, 1));
    console.log(`draft ${recs.length} records; gate violations: ${bad.length}`); for (const b of bad) console.log("  ", b);
    return;
  }
  const ver = rd("data/ap/ush-sources/real-g-verification.json") as Json; const out: Json[] = []; const unresolved: string[] = [];
  for (const m of MC_SETS_G) {
    const rec = mcRecord(m); const items = rec.payload.items as Json[]; let ok = true;
    items.forEach((it, i) => { const r = ver.items[`${rec.cellId}#${i + 1}`]; if (!r) { ok = false; return; }
      it.verification = { status: r.status, blind_solvers: ver.models.solvers, solver_choices: r.solverChoices, solver_confidence: r.solverConfidence, fact_checker: ver.models.fact, fact_verdict: r.factVerdict, flags: r.flags, images_attached: false }; if (r.status !== "verified") ok = false; });
    const v = gates(rec); if (v.length) { ok = false; console.log(rec.cellId, "gate:", v); }
    rec.reviewState = ok ? "verified_by_independent_models" : "has_unresolved_items"; rec.validation = ok ? "auto_passed" : "needs_review";
    if (ok) out.push(rec); else unresolved.push(`${m.slot} (${rec.cellId})`);
  }
  writeFileSync("data/ap/stock/ush-real-g-items.json", JSON.stringify(out, null, 1));
  writeFileSync("data/ap/stock/ush-real-g-pass-keys.json", JSON.stringify(out.map((r) => r.stockKey), null, 1));
  writeFileSync("data/ap/stock/ush-real-g-summary.json", JSON.stringify({ run: RUN, generatedAt: new Date().toISOString().slice(0, 10), passed: out.map((r) => ({ stockKey: r.stockKey, replaces: r.replaces })), unresolved }, null, 1));
  console.log(`final: ${out.length} records written; unresolved: ${unresolved.length ? unresolved.join("; ") : "none"}`);
}
if (process.argv[1]?.endsWith("ush-real-g-build.ts")) main();
