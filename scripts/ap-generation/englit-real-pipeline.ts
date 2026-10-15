// 실제 작품 기반(source-first) AP English Literature 샘플 파이프라인(2026-10-15). 지문 = 등록부 텍스트(코드 고정) → 모델이 스킬·문항·근거 설계 → 결정적 게이트 → 맹검 독립 풀이 2 + 적대 + 심판 + 제2 모델 패널.
// DB·게시본·원격 접근 없음. 키는 프로세스 환경 ANTHROPIC_API_KEY 로만. 사용: npx tsx scripts/ap-generation/englit-real-pipeline.ts [--plan] [--stages gen,check,solve,adv,judge,panel,finalize,frq-gen,frq-samples,frq-grade,frq-finalize]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runBatch, toolInput, estimate, ledger, type BatchReq } from "../mock-exam-generation/batch-lib";
import { ledgerTotal } from "./ledger-total";
import * as P from "../../lib/ap-generation/englit-prompts";
import * as R from "../../lib/ap-generation/englit-real-prompts";
import { balancedKeyPositions, keyConfidence, placeKey, keyPositionViolations, type SolverVote } from "../../lib/ap-generation/englang-gates";
import { LENGTH_CUE_RATIO, ltForModels, setItemSpread, type LtSetRaw } from "../../lib/ap-generation/englit-gates";
import { LT_FRQ_SCHEMA_VERSION, frqPassageDisplay, frqPassageText, frqReferenceText, frqTaskText, frqViolations, normalizeFrqPayload, type LtFrqPayload, type LtSample } from "../../lib/ap-generation/englit-frq";
import { ltTopicFor } from "../../lib/ap-generation/subjects/englit";
import { countedLines } from "../../lib/ap-exam/passage-lines";
import { lengthCueRatio } from "../../lib/ap-generation/englit-gates";
import { quoteInPassage } from "../../lib/ap-generation/englang-gates";
import { RUBRIC_ROWS_ENGLIT } from "../../lib/essay-grading/rubric";
import { groupOfEntry, locate, realDisplay, realItemViolations, realSet, resolveEvidence, resolveRealItem, toBase, type RealItemRaw } from "../../lib/ap-generation/englit-real";
import type { Registry, SourceEntry } from "../../lib/ap-generation/englit-sources";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const RUN = "englit-real-1"; const ROOT = path.resolve("data/ap/sample-2027"); const DIR = path.join(ROOT, RUN); mkdirSync(DIR, { recursive: true });
const SRC = path.resolve("data/ap/englit-sources"); const OUT = path.join(SRC, "sample"); mkdirSync(OUT, { recursive: true });
const CFG = { runCapUsd: 5.8, hardStopCumulativeUsd: 222, models: { gen: "claude-opus-5-5", solvers: ["claude-opus-5-5", "claude-sonnet-5-5"], adversary: "claude-opus-5-5", judge: "claude-opus-5-5", panel: "claude-fable-5-1", sampleHigh: "claude-opus-5-5", sampleLow: "claude-sonnet-5-5", graders: ["claude-opus-5-5", "claude-sonnet-5-5"] }, effort: "medium", gradeEffort: "low", sampleCands: 2, minKeyConfidence: 0.8 };
const SETS = [{ id: "rs1", entry: "dickinson-chariot", n: 10 }, { id: "rs2", entry: "dunbar-mask", n: 9 }, { id: "rs3", entry: "chopin-silk-stockings", n: 10 }];
const FRQS = [{ id: "rf1", entry: "hopkins-grandeur", type: "poetry_analysis" as const, workTitle: "God's Grandeur" }, { id: "rf2", entry: "chekhov-lady-dog", type: "prose_analysis" as const, workTitle: "The Lady with the Dog" }];
const registry = JSON.parse(readFileSync(path.join(SRC, "registry.json"), "utf-8")) as Registry;
const entryOf = (id: string): SourceEntry => registry.entries.find((e) => e.id === id)!;
const textOf = (e: SourceEntry) => readFileSync(path.join(SRC, e.text_file), "utf-8");
const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const rj = <T,>(f: string, d: T): T => (existsSync(path.join(DIR, f)) ? (JSON.parse(readFileSync(path.join(DIR, f), "utf-8")) as T) : d);
const wj = (f: string, v: unknown) => writeFileSync(path.join(DIR, f), JSON.stringify(v, null, 1));
const SYS_CACHE = { type: "ephemeral", ttl: "1h" };
const think = (model: string, effort: string) => ({ thinking: model.includes("sonnet") ? { type: "between_tools" } : { type: "adaptive" }, output_config: { effort } });
const mk = (id: string, model: string, sys: string, tool: Json, user: string, max: number, effort = CFG.effort): BatchReq => ({ custom_id: id, params: { model, ...think(model, effort), max_tokens: max, system: [{ type: "text", text: sys, cache_control: SYS_CACHE }], tools: [tool], tool_choice: { type: "auto" }, messages: [{ role: "user", content: user }] } });

// ── 예산 ───────────────────────────────────────────────────────────
const spentRun = (): number => { let c = 0; for (const f of readdirSync(DIR)) if (/\.results\.jsonl$/.test(f)) for (const l of readFileSync(path.join(DIR, f), "utf-8").split("\n").filter(Boolean)) { try { const j = JSON.parse(l); if (!j.cached) c += Number(j.cost ?? 0); } catch { /* skip */ } } return c; };
function guard(stage: string, est: number) {
  const t = ledgerTotal(); const why = spentRun() + est > CFG.runCapUsd ? `run cap ${CFG.runCapUsd}` : t.cumulativeUsd + est >= CFG.hardStopCumulativeUsd ? `cumulative ${t.cumulativeUsd} + est >= ${CFG.hardStopCumulativeUsd}` : "";
  if (why) throw new Error(`HARD STOP before ${stage}: est $${est.toFixed(3)}; run $${spentRun().toFixed(3)}; cumulative $${t.cumulativeUsd}: ${why}`);
  console.log(`[${stage}] run $${spentRun().toFixed(4)} / ${CFG.runCapUsd}, cumulative $${t.cumulativeUsd}; est this step $${est.toFixed(3)}`);
}
async function call(stage: string, reqs: BatchReq[], estUsd: number): Promise<Map<string, Json | null>> {
  if (!reqs.length) return new Map(); guard(stage, estUsd);
  const run = async (name: string, rs: BatchReq[]) => runBatch({ dir: DIR, name, requests: rs, budgetUsd: ledger(DIR).spent() + Math.max(0, CFG.runCapUsd - spentRun()), estimateUsd: estUsd * (rs.length / reqs.length), pollMs: 20000 });
  const got = await run(stage, reqs); const out = new Map<string, Json | null>(); for (const r of reqs) out.set(r.custom_id, got.has(r.custom_id) ? (toolInput(got.get(r.custom_id)!) as Json | null) : null);
  const missing = reqs.filter((r) => !out.get(r.custom_id));
  if (missing.length) { console.log(`[${stage}] 도구 호출 없음 ${missing.length}건 → 강제 재요청`); const forced = missing.map((r) => ({ custom_id: r.custom_id, params: { ...r.params } })) as BatchReq[]; for (const f of forced) { delete (f.params as Json).thinking; delete (f.params as Json).output_config; } guard(`${stage}-retry`, estUsd * (missing.length / reqs.length)); const got2 = await run(`${stage}-retry`, forced); for (const r of missing) if (got2.has(r.custom_id)) out.set(r.custom_id, toolInput(got2.get(r.custom_id)!) as Json | null); }
  console.log(`[${stage}] 응답 ${[...out.values()].filter(Boolean).length}/${reqs.length}; run $${spentRun().toFixed(4)}, cumulative $${ledgerTotal().cumulativeUsd}`); return out;
}

// ── MC ─────────────────────────────────────────────────────────────
type Row = { id: string; entry: string; text_map: Json | null; items: (RealItemRaw & { key_index: number; det: string[] })[]; setViolations: string[] };
const setFor = (r: Row): LtSetRaw => realSet(entryOf(r.entry), textOf(entryOf(r.entry)));
const parseItems = (inp: Json): RealItemRaw[] => (Array.isArray(inp?.items) ? inp.items : []).map((it: Json) => ({ skill: String(it.skill ?? ""), cognitive: String(it.cognitive ?? ""), stem: String(it.stem ?? ""), options: (Array.isArray(it.options) ? it.options : []).map((o: Json) => ({ text: String(o?.text ?? ""), is_key: o?.is_key === true, label: String(o?.label ?? ""), why: String(o?.why ?? ""), evidence_quote: String(o?.evidence_quote ?? ""), evidence_kind: o?.evidence_kind === "absence" ? "absence" : "text" })), refs: (Array.isArray(it.refs) ? it.refs : []).map((x: Json) => ({ id: String(x?.id ?? ""), quote: String(x?.quote ?? "") })), evidence_quotes: (Array.isArray(it.evidence_quotes) ? it.evidence_quotes : []).map(String), devices_used: Array.isArray(it.devices_used) ? it.devices_used.map(String) : [], est_seconds: Number(it.est_seconds ?? 70) }));
async function genStage() {
  const reqs = SETS.map((s) => { const e = entryOf(s.entry); const set = realSet(e, textOf(e)); return mk(`g-${s.id}`, CFG.models.gen, R.REAL_SET_SYSTEM(set.form, s.n), R.realSetTool, R.realSetUser(ltForModels(set), s.n), 28000); });
  const out = await call("gen", reqs, estimate(CFG.models.gen, reqs.length, 3600, 9000)); wj("gen.json", Object.fromEntries([...out.entries()]));
}
function checkStage() {
  const gen = rj<Record<string, Json | null>>("gen.json", {}); const rows: Row[] = [];
  for (const s of SETS) {
    const e = entryOf(s.entry); const set = realSet(e, textOf(e)); const inp = gen[`g-${s.id}`]; const raw = parseItems(inp ?? {}); const sv: string[] = [];
    if (!inp) { rows.push({ id: s.id, entry: s.entry, text_map: null, items: [], setViolations: ["no_tool_output"] }); continue; }
    if (raw.length !== s.n) sv.push(`item_count_${raw.length}_not_${s.n}`);
    const withKey = raw.map((it) => ({ ...it, key_index: it.options.findIndex((o) => o.is_key), det: realItemViolations(set, it) }));
    sv.push(...setItemSpread(withKey.map(toBase)));
    // 키 위치 균형(코드): 선지 순서를 바꾸면 증거 필드도 함께 움직인다(options 객체 단위로 이동).
    const pos = balancedKeyPositions(Math.max(withKey.length, 4), 7919 + s.n); const items = withKey.map((it, i) => { const placed = placeKey(it.options, pos[i % pos.length], 31 * (i + 1) + s.n); return { ...it, options: placed.options, key_index: placed.key_index }; });
    rows.push({ id: s.id, entry: s.entry, text_map: inp.text_map ?? null, items, setViolations: sv });
  }
  wj("sets.json", rows);
  for (const r of rows) console.log(`[check] ${r.id} ${r.entry}: ${r.items.length} items, clean ${r.items.filter((i) => i.det.length === 0).length}; set: ${r.setViolations.join(",") || "ok"}; viol: ${[...new Set(r.items.flatMap((i) => i.det.map((x) => x.replace(/_[^_]*\d.*$/, "").slice(0, 44))))].join(",")}; keys ${keyPositionViolations(r.items.map((i) => i.key_index)).join(",") || "balanced"}`);
}
const perm = (n: number, k: number): number[] => (k === 0 ? Array.from({ length: n }, (_, i) => i) : k === 1 ? Array.from({ length: n }, (_, i) => n - 1 - i) : k === 2 ? Array.from({ length: n }, (_, i) => (i + 1) % n) : Array.from({ length: n }, (_, i) => (i + 2) % n));
const shown = (r: Row, idx: number[], k: number) => { const set = setFor(r); return idx.map((i) => { const res = resolveRealItem(set, r.items[i]); return { stem: res.stem, options: perm(4, k).map((j) => res.options[j].text) }; }); };
async function solveStage() {
  const rows = rj<Row[]>("sets.json", []); const reqs: BatchReq[] = []; const meta: { id: string; setId: string; k: number; idx: number[] }[] = [];
  for (const r of rows) { const idx = r.items.map((_, i) => i).filter((i) => r.items[i].det.length === 0); if (!idx.length) continue; const set = setFor(r);
    CFG.models.solvers.forEach((model, k) => { const id = `v${k}-${r.id}-${idx.length}`; reqs.push(mk(id, model, P.SOLVER_SYSTEMS[k], P.SOLVER_TOOL, P.solverUser(ltForModels(set), shown(r, idx, k)), 6000)); meta.push({ id, setId: r.id, k, idx }); }); }
  const est = CFG.models.solvers.reduce((a, m) => a + estimate(m, reqs.length / CFG.models.solvers.length, 3600, 3000), 0); const out = await call("solve", reqs, est); const votes: Record<string, (SolverVote | null)[][]> = {};
  for (const m of meta) { const row = rows.find((r) => r.id === m.setId)!; const arr = (votes[m.setId] ??= row.items.map(() => CFG.models.solvers.map(() => null) as (SolverVote | null)[])); const p = perm(4, m.k);
    for (const a of (out.get(m.id)?.answers ?? []) as Json[]) { const ii = m.idx[Number(a.question) - 1]; if (ii === undefined) continue; const sc = Number(a.choice); const also = a.also_defensible === null || a.also_defensible === undefined ? null : p[Number(a.also_defensible)]; arr[ii][m.k] = { choice: Number.isInteger(sc) && sc >= 0 && sc < 4 ? p[sc] : null, confidence: String(a.confidence ?? "likely"), also_defensible: also === undefined ? null : also }; } }
  wj("solve.json", votes); let a = 0, tot = 0; for (const r of rows) r.items.forEach((it, i) => { const v = votes[r.id]?.[i]; if (!v) return; tot++; if (v.every((x) => x && x.choice === it.key_index)) a++; }); console.log(`[solve] 전원 일치 ${a}/${tot}`);
}
const solved = (votes: Record<string, (SolverVote | null)[][]>, r: Row, i: number) => { const v = votes[r.id]?.[i]; return Boolean(v) && v!.every((x) => x && x.choice === r.items[i].key_index); };
async function advStage() {
  const rows = rj<Row[]>("sets.json", []); const votes = rj<Record<string, (SolverVote | null)[][]>>("solve.json", {}); const reqs: BatchReq[] = []; const meta: { id: string; setId: string; idx: number[] }[] = [];
  for (const r of rows) { const idx = r.items.map((_, i) => i).filter((i) => solved(votes, r, i)); if (!idx.length) continue; const set = setFor(r);
    const items = idx.map((i) => { const res = resolveRealItem(set, r.items[i]); return { stem: res.stem, options: res.options.map((o) => o.text), key: r.items[i].key_index, why: res.options[r.items[i].key_index].why }; });
    reqs.push(mk(`a-${r.id}-${idx.length}`, CFG.models.adversary, P.ADV_SYSTEM, P.ADV_TOOL, P.advUser(ltForModels(set), items), 8000)); meta.push({ id: `a-${r.id}-${idx.length}`, setId: r.id, idx }); }
  const out = await call("adv", reqs, estimate(CFG.models.adversary, reqs.length, 4200, 4000)); const adv: Record<string, (Json | null)[]> = {};
  for (const m of meta) { const row = rows.find((r) => r.id === m.setId)!; const arr = (adv[m.setId] ??= row.items.map(() => null)); for (const c of (out.get(m.id)?.challenges ?? []) as Json[]) { const ii = m.idx[Number(c.question) - 1]; if (ii !== undefined) arr[ii] = c; } }
  wj("adv.json", adv);
}
async function judgeStage() {
  const rows = rj<Row[]>("sets.json", []); const adv = rj<Record<string, (Json | null)[]>>("adv.json", {}); const reqs: BatchReq[] = []; const meta: { id: string; setId: string; idx: number[] }[] = [];
  for (const r of rows) { const idx = r.items.map((_, i) => i).filter((i) => { const a = adv[r.id]?.[i]; return a && a.defensibility && a.defensibility !== "none"; }); if (!idx.length) continue; const set = setFor(r);
    const items = idx.map((i) => { const a = adv[r.id][i]!; const res = resolveRealItem(set, r.items[i]); return { stem: res.stem, options: res.options.map((o) => o.text), key: r.items[i].key_index, alt: Number.isInteger(a.alt_index) ? (a.alt_index as number) : null, argument: String(a.argument ?? "") }; });
    reqs.push(mk(`j-${r.id}-${idx.length}`, CFG.models.judge, P.JUDGE_SYSTEM, P.JUDGE_TOOL, P.judgeUser(ltForModels(set), items), 5000)); meta.push({ id: `j-${r.id}-${idx.length}`, setId: r.id, idx }); }
  const out = await call("judge", reqs, estimate(CFG.models.judge, reqs.length, 4200, 2000)); const jd: Record<string, (Json | null)[]> = {};
  for (const m of meta) { const row = rows.find((r) => r.id === m.setId)!; const arr = (jd[m.setId] ??= row.items.map(() => null)); for (const v of (out.get(m.id)?.verdicts ?? []) as Json[]) { const ii = m.idx[Number(v.question) - 1]; if (ii !== undefined) arr[ii] = v; } }
  wj("judge.json", jd);
}
function evalRow(r: Row) {
  const votes = rj<Record<string, (SolverVote | null)[][]>>("solve.json", {}); const adv = rj<Record<string, (Json | null)[]>>("adv.json", {}); const jd = rj<Record<string, (Json | null)[]>>("judge.json", {});
  return r.items.map((it, i) => { const v = (votes[r.id]?.[i] ?? []).filter(Boolean) as SolverVote[]; const a = adv[r.id]?.[i] ?? null; const j = jd[r.id]?.[i] ?? null;
    const kc = keyConfidence({ keyIndex: it.key_index, votes: v.length === CFG.models.solvers.length ? v : [], adversary: a ? { defensibility: a.defensibility, alt_index: a.alt_index } : null, judge: j ? { verdict: j.verdict } : null, detViolations: [...it.det], minScore: CFG.minKeyConfidence });
    return { it, i, kc, a, j, votes: v, pass: kc.pass }; });
}
async function panelStage() {
  const rows = rj<Row[]>("sets.json", []); const prev = rj<Record<string, (Json | null)[]>>("panel.json", {}); const reqs: BatchReq[] = []; const meta: { id: string; setId: string; idx: number[] }[] = [];
  for (const r of rows) { const idx = evalRow(r).filter((e) => e.pass && !prev[r.id]?.[e.i]).map((e) => e.i); if (!idx.length) continue; const id = `m-${r.id}-${idx.join("_")}`; reqs.push(mk(id, CFG.models.panel, P.PANEL_SYSTEM, P.SOLVER_TOOL, P.solverUser(ltForModels(setFor(r)), shown(r, idx, 3)), 7000)); meta.push({ id, setId: r.id, idx }); }
  const out = await call("panel", reqs, estimate(CFG.models.panel, reqs.length, 3800, 3500)); const res: Record<string, (Json | null)[]> = prev; const p = perm(4, 3); let agree = 0, tot = 0;
  for (const m of meta) { const row = rows.find((r) => r.id === m.setId)!; const arr = (res[m.setId] ??= row.items.map(() => null)); for (const a of (out.get(m.id)?.answers ?? []) as Json[]) { const ii = m.idx[Number(a.question) - 1]; if (ii === undefined) continue; const sc = Number(a.choice); const choice = Number.isInteger(sc) && sc >= 0 && sc < 4 ? p[sc] : null; const also = a.also_defensible === null || a.also_defensible === undefined ? null : p[Number(a.also_defensible)]; arr[ii] = { choice, confidence: String(a.confidence ?? ""), also_defensible: also ?? null, agree: choice === row.items[ii].key_index }; tot++; if (choice === row.items[ii].key_index) agree++; } }
  wj("panel.json", res); console.log(`[panel] ${CFG.models.panel} 일치 ${agree}/${tot}`);
}
const explanationOf = (it: { options: { text: string; why: string }[]; key_index: number }): string => { const key = it.options[it.key_index]; const lines = [`The correct answer is "${key.text}". ${key.why.trim()}`]; it.options.forEach((o, i) => { if (i !== it.key_index) lines.push(`"${o.text}" is incorrect: ${o.why.trim()}`); }); return lines.join("\n"); };
function finalizeStage() {
  const rows = rj<Row[]>("sets.json", []); const panel = rj<Record<string, (Json | null)[]>>("panel.json", {}); const cands: Json[] = []; const audit: Json[] = []; const unresolved: Json[] = [];
  for (const r of rows) {
    const e = entryOf(r.entry); const set = setFor(r); const ev = evalRow(r); const kept: typeof ev = []; const excluded: Json[] = [];
    for (const x of ev) { const pv = panel[r.id]?.[x.i] ?? null; const panelOk = pv !== null && pv.agree === true && (pv.also_defensible === null || pv.also_defensible === x.it.key_index);
      const reasons = [...x.kc.reasons, ...(x.pass && !panelOk ? [pv ? "panel_disagrees_or_second_defensible" : "panel_missing"] : [])];
      audit.push({ set: r.id, i: x.i, skill: x.it.skill, det: x.it.det, solverVotes: x.votes.map((v) => v.choice), key: x.it.key_index, adversary: x.a?.defensibility ?? null, judge: x.j?.verdict ?? null, panel: pv ? { choice: pv.choice, agree: pv.agree, also: pv.also_defensible } : null, score: x.kc.score, pass: x.pass && panelOk, reasons });
      if (x.pass && panelOk) kept.push(x); else { excluded.push({ index: x.i, skill: x.it.skill, stem: x.it.stem.slice(0, 140), reasons }); unresolved.push({ set: r.id, entry: r.entry, index: x.i, skill: x.it.skill, stem: x.it.stem, reasons }); } }
    while (kept.filter((x) => x.it.skill.startsWith("2.")).length > 1) { const c2 = kept.filter((x) => x.it.skill.startsWith("2.")); const w = c2.reduce((a, b) => (b.kc.score < a.kc.score ? b : a)); kept.splice(kept.indexOf(w), 1); excluded.push({ index: w.i, skill: w.it.skill, reasons: ["setting_cap_1_per_set"] }); }
    const keptSorted = kept.slice().sort((a, b) => a.i - b.i); const group = groupOfEntry(e);
    const items = keptSorted.map((x, n) => { const res = resolveRealItem(set, x.it); const ev2 = resolveEvidence(set, x.it); const opts = res.options.map((o) => ({ text: o.text, why: o.why, value: null, label: o.label })); const pv = panel[r.id]?.[x.i] ?? null;
      return { archetype: `lt_${group}_${x.it.skill.replace(".", "")}`, topic: ltTopicFor(x.it.skill, group, n), skill: x.it.skill, cognitive: x.it.cognitive, stem: res.stem, options: opts, key_index: x.it.key_index, explanation_en: explanationOf({ options: opts, key_index: x.it.key_index }), est_seconds: x.it.est_seconds ?? 70, evidence_quotes: x.it.evidence_quotes, ref_lines: res.refLines, devices_used: x.it.devices_used ?? [],
        real_text: { registry_id: e.id, skill: x.it.skill, key_evidence: ev2.key, distractor_evidence: ev2.distractors.map((d) => ({ index: d.index, label: d.label, why: d.why, evidence_kind: d.kind, evidence: d.located })), verification: { solvers: CFG.models.solvers, solver_votes: x.votes.map((v) => v.choice), adversary: x.a?.defensibility ?? null, judge: x.j?.verdict ?? null, panel_model: CFG.models.panel, panel_choice: pv?.choice ?? null, panel_agree: pv?.agree ?? null, score: x.kc.score, band: x.kc.band, verified: true } },
        key_confidence: { score: x.kc.score, band: x.kc.band, solver_agreement: x.kc.solverAgreement, adversary: x.a?.defensibility ?? null, judge: x.j?.verdict ?? null, panel: pv ? { model: CFG.models.panel, choice: pv.choice, agree: pv.agree } : null, solver_votes: x.votes.map((v) => ({ choice: v.choice, confidence: v.confidence })) } }; });
    const base = { cellId: `ap_english_literature-real-${r.id}`, apSubjectCode: "ap_english_literature", kind: "mc" as const, calculator: "na", reserve: false, wording: "source_first_real_text", candidateKey: `ap_english_literature-real-${r.id}-k0`, structure: "shared_stimulus_set", archetype: `lt_real_${group}_${r.id}`, pipeline: "real_text_v1", releaseTier: "sample_not_loaded", expertStatus: "unreviewed", renderVerified: false, screenVerified: false, sourceKind: "real_public_domain", registryId: e.id };
    if (!items.length) { cands.push({ ...base, keywordCode: "", unitCode: "", skillPrimary: "", reviewState: "rejected", rejectionReason: "no_items_passed", payload: { archetype: base.archetype, excluded_items: excluded } }); continue; }
    cands.push({ ...base, keywordCode: items[0].topic, unitCode: (items[0].topic.match(/^U(\d)/) ?? [])[1] ?? "", skillPrimary: items[0].skill, reviewState: "auto_passed", rejectionReason: null, difficultyProvisional: "exam_prep",
      payload: { archetype: base.archetype, topic: items[0].topic, skill: items[0].skill, calculator: "na", set_intro: realDisplay(set as never, e), lt_passage: { form: set.form, group, title: set.title, headnote: set.headnote ?? null, stanzas: set.stanzas, line_count: countedLines(set.stanzas).length }, provenance: { kind: "public_domain", registry_id: e.id, author: e.author, translator: e.translator ?? null, year: e.year_first_published, repository: e.repository, url: e.url, reuse_basis: e.reuse_basis, text_sha256: e.text_sha256, excerpt: e.excerpt, modifications: e.modifications }, text_map: r.text_map, items, excluded_items: excluded, assignable_size: items.length >= 8 && items.length <= 13, set_note: items.length < 8 ? `only ${items.length} verified items: below the exam's 8-13 per set; not assignable as a full set` : "" } });
  }
  writeFileSync(path.join(OUT, "real-sample-items.json"), JSON.stringify(cands, null, 1) + "\n"); wj("mc-audit.json", audit); wj("mc-unresolved.json", unresolved);
  console.log(`[finalize] ${cands.map((c) => `${c.cellId}=${c.reviewState === "auto_passed" ? c.payload.items.length : "x"}`).join(" ")}; unresolved ${unresolved.length}`);
}

// ── FRQ ────────────────────────────────────────────────────────────
const REQS = { poetry_analysis: P_REQS("poem"), prose_analysis: P_REQS("passage") };
function P_REQS(w: string): string[] { return [`Respond to the prompt with a thesis that offers a defensible interpretation of the ${w}.`, `Use specific evidence from the ${w}, and explain how that evidence supports your line of reasoning.`, `Explain how multiple ${w === "poem" ? "poetic" : "literary"} elements and techniques contribute to the meaning you describe.`, "Write clearly, with appropriate grammar and punctuation."]; }
const frqSet = (f: (typeof FRQS)[number]) => { const e = entryOf(f.entry); const set = realSet(e, textOf(e)); return { e, set, display: ltForModels(set) }; };
const leadOf = (f: (typeof FRQS)[number], e: SourceEntry) => f.type === "poetry_analysis" ? `The following poem is "${f.workTitle}" by ${e.author} (${e.year_first_published}). In this poem, the speaker` : `The following passage is from "${f.workTitle}," a short story by ${e.author} (${e.year_first_published} in the original${e.translator ? `; English translation by ${e.translator}, ${e.year_first_published === 1899 ? 1917 : e.year_first_published}` : ""}). In this passage,`;
async function frqGenStage() {
  const reqs = FRQS.map((f) => { const { e, display } = frqSet(f); return mk(`f-${f.id}`, CFG.models.gen, R.REAL_FRQ_SYSTEM(f.type), R.realFrqTool, R.realFrqUser(f.type, display, leadOf(f, e)), 16000); });
  const out = await call("frq-gen", reqs, estimate(CFG.models.gen, reqs.length, 2600, 6000));
  const payloads = FRQS.map((f) => { const inp = out.get(`f-${f.id}`); const { e, set } = frqSet(f); if (!inp?.rubric) return { id: f.id, payload: null as LtFrqPayload | null };
    const addr = String(inp.addressed ?? "").replace(/[.\s]+$/, "").replace(/^(the speaker|in this passage,?)\s+/i, ""); const focus = String(inp.focus ?? "").replace(/[.\s]+$/, ""); const who = e.author;
    const lead = f.type === "poetry_analysis" ? `${leadOf(f, e)} ${addr}.` : `${leadOf(f, e)} ${addr}.`;
    const task = f.type === "poetry_analysis" ? `Read the poem closely. Then write an essay in which you analyze how ${who} uses poetic elements and techniques to ${focus}.` : `Read the passage closely. Then write an essay in which you analyze how ${who} uses literary elements and techniques to ${focus}.`;
    const payload = normalizeFrqPayload({ schema_version: LT_FRQ_SCHEMA_VERSION, task_type: f.type, template: f.type === "poetry_analysis" ? "q1" : "q2", title: `${f.type === "poetry_analysis" ? "Poetry Analysis" : "Prose Fiction Analysis"}: ${f.workTitle}`, prompt: { lead, task, requirements: REQS[f.type] },
      passage: { form: set.form === "poem" ? "poem" : "prose", title: f.workTitle, attribution: `by ${who}${e.translator ? `, translated by ${e.translator}` : ""}`, headnote: set.headnote, stanzas: set.stanzas, line_count: countedLines(set.stanzas).length, provenance: { kind: "public_domain", author_alias: who, year_alias: e.year_first_published, registry_id: e.id, source_url: e.url } },
      rubric: { total_points: 6, rows: (inp.rubric.rows as Json[]).map((r) => ({ row_id: r.row_id, name: "", max: 0, descriptors: {}, task_specific: String(r.task_specific ?? "") })) as never, scoring_notes: (inp.rubric.scoring_notes ?? []).map(String) }, expected_features: { ...(inp.expected_features ?? {}) }, samples: [], blueprint: { ...(inp.blueprint ?? {}) },
      provenance: { kind: "original", note: `Real public-domain text (registry ${e.id}); rubric guidance and sample essays are ALTON-authored, not official College Board material.` } } as LtFrqPayload);
    return { id: f.id, payload }; });
  wj("frq.json", payloads);
}
const loadFrq = () => rj<{ id: string; payload: LtFrqPayload | null }[]>("frq.json", []);
const matText = (p: LtFrqPayload) => (p.passage ? `${p.passage.title}\n${p.passage.headnote ?? ""}\n${p.passage.stanzas.map((s) => s.join("\n")).join("\n\n")}` : "");
/** englit-v1(채점 경로의 운영 루브릭) 행 설명 + 과제별 지침. */
const rubricV1 = (p: LtFrqPayload) => RUBRIC_ROWS_ENGLIT.map((r, i) => `${r.label} (0-${r.max}): ${r.guide}\n  Task-specific: ${p.rubric.rows[i]?.task_specific ?? ""}`).join("\n");
async function frqSampleStage() {
  const reqs: BatchReq[] = [];
  for (const f of loadFrq()) { if (!f.payload) continue; const pv = frqViolations(f.payload, [], { realText: true }).filter((x) => !/^sample|samples_/.test(x)); if (pv.length) { console.log(`[frq-samples] ${f.id}: 과제 위반 ${pv.join(",")} → 건너뜀`); continue; }
    for (const tier of ["high", "mid", "low"] as const) for (let k = 0; k < CFG.sampleCands; k++) reqs.push(mk(`s-${f.id}-${tier}-${k}`, tier === "high" ? CFG.models.sampleHigh : CFG.models.sampleLow, P.SAMPLE_SYSTEM(tier), P.SAMPLE_TOOL, P.sampleUser(frqTaskText(f.payload), matText(f.payload), rubricV1(f.payload)), 6000)); }
  const out = await call("frq-samples", reqs, estimate(CFG.models.sampleHigh, reqs.length, 2800, 1500)); wj("frq-samples.json", Object.fromEntries([...out.entries()]));
}
async function frqGradeStage() {
  const samples = rj<Record<string, Json | null>>("frq-samples.json", {}); const reqs: BatchReq[] = [];
  for (const f of loadFrq()) { if (!f.payload) continue; for (const tier of ["high", "mid", "low"]) for (let k = 0; k < CFG.sampleCands; k++) { const s = samples[`s-${f.id}-${tier}-${k}`]; if (!s?.essay) continue; CFG.models.graders.forEach((m, g) => reqs.push(mk(`r${g}-${f.id}-${tier}-${k}`, m, P.GRADE_SYSTEMS[g], P.GRADE_TOOL, P.gradeUser(frqTaskText(f.payload!), matText(f.payload!), rubricV1(f.payload!), String(s.essay)), 3000, CFG.gradeEffort))); } }
  const out = await call("frq-grade", reqs, CFG.models.graders.reduce((a, m) => a + estimate(m, reqs.length / CFG.models.graders.length, 3400, 900), 0)); wj("frq-grades.json", Object.fromEntries([...out.entries()]));
}
const TARGET = { high: 6, mid: 4, low: 2 } as const;
function frqFinalizeStage() {
  const samples = rj<Record<string, Json | null>>("frq-samples.json", {}); const grades = rj<Record<string, Json | null>>("frq-grades.json", {}); const cands: Json[] = []; const audit: Json[] = [];
  for (const f of loadFrq()) {
    const base = { cellId: `ap_english_literature-real-${f.id}`, apSubjectCode: "ap_english_literature", kind: "frq_bundle" as const, calculator: "na", reserve: false, wording: "source_first_real_text", candidateKey: `ap_english_literature-real-${f.id}-k0`, pipeline: "real_text_v1", releaseTier: "sample_not_loaded", expertStatus: "unreviewed", sourceKind: "real_public_domain" };
    if (!f.payload) { cands.push({ ...base, reviewState: "rejected", rejectionReason: "no_tool_output", payload: {} }); continue; }
    const p = f.payload; const chosen: LtSample[] = []; const why: string[] = [];
    for (const tier of ["high", "mid", "low"] as const) {
      const options = Array.from({ length: CFG.sampleCands }, (_, k) => k).map((k) => { const s = samples[`s-${f.id}-${tier}-${k}`]; if (!s?.essay) return null; const gs = CFG.models.graders.map((_, g) => grades[`r${g}-${f.id}-${tier}-${k}`]); if (gs.some((x) => !x)) return null; const G = gs as Json[]; const tots = G.map((x) => Number(x.A) + Number(x.B) + Number(x.C)); const sc = { A: Math.min(...G.map((x) => Number(x.A))), B: Math.round(G.reduce((a, x) => a + Number(x.B), 0) / G.length), C: Math.min(...G.map((x) => Number(x.C))) }; const tot = sc.A + sc.B + sc.C; return { k, s, G, sc, tot, tots, spread: Math.max(...tots) - Math.min(...tots), dist: Math.abs(tot - TARGET[tier]) }; }).filter(Boolean) as { k: number; s: Json; G: Json[]; sc: { A: number; B: number; C: number }; tot: number; tots: number[]; spread: number; dist: number }[];
      const ok = options.filter((o) => o.dist <= 1 && o.spread <= 2).sort((a, b) => a.dist - b.dist || a.spread - b.spread)[0];
      audit.push({ id: f.id, tier, options: options.map((o) => ({ k: o.k, graderTotals: o.tots, graderRows: o.G.map((x) => `${x.A}/${x.B}/${x.C}`), spread: o.spread, final: o.tot })), chosen: ok?.k ?? null });
      if (!ok) { why.push(`sample_${tier}_no_consistent_candidate`); continue; }
      const text = String(ok.s.essay).replace(/[$]\s*(\d[\d,.]*)/g, "$1 dollars").replace(/[$]/g, "").trim();
      chosen.push({ tier, target_total: ok.tot, essay: text, word_count: (text.match(/\S+/g) ?? []).length, rubric_scores: { ...ok.sc, total: ok.tot }, annotations: ((ok.s.annotations as Json[]) ?? []).map((a) => ({ quote: String(a.quote), comment: String(a.comment), row_id: a.row_id })).filter((a) => quoteInPassage(a.quote, text)) });
    }
    p.samples = chosen; const v = [...frqViolations(p, [], { realText: true }), ...why];
    if (v.length) { cands.push({ ...base, reviewState: "rejected", rejectionReason: v.join("; ").slice(0, 1500), payload: { lit_frq: p } }); continue; }
    const skill = p.task_type === "poetry_analysis" ? "6.B" : "4.C"; const hi = p.samples.find((s) => s.tier === "high")!;
    cands.push({ ...base, keywordCode: "U9.4", unitCode: "9", skillPrimary: skill, structure: "frq_multipart", archetype: `ltfrq_real_${f.id}`, reviewState: "auto_passed", rejectionReason: null, difficultyProvisional: "exam_prep",
      payload: { archetype: `ltfrq_real_${f.id}`, template: p.template, topic: "U9.4", extra_topics: [], skill, representative_skill: skill, calculator: "na", title: p.title, set_intro: realDisplay({ title: p.passage!.title, headnote: p.passage!.headnote, stanzas: p.passage!.stanzas, provenance: { author_alias: p.passage!.provenance.author_alias } }, entryOf(FRQS.find((x) => x.id === f.id)!.entry)),
        parts: [{ label: "A", prompt: frqTaskText(p), points: 6, response_mode: "essay", skill_codes: [skill], topic_codes: ["U9.4"], model_answer: hi.essay, rubric_rows: p.rubric.rows.map((r) => ({ row_id: r.row_id, points: r.max, criterion: r.task_specific, required_elements: [], optional_phrases: [], alt_solutions: [], common_errors: [], requires_row_id: null, requires_both: false, requires_numbers: false, numeric_tolerance: null, units_row: false })) }], reference_text: frqReferenceText(p), lit_frq: p, real_text: { registry_id: (p.passage!.provenance as Json).registry_id, grader_audit: audit.filter((a) => a.id === f.id) } } });
  }
  writeFileSync(path.join(OUT, "real-sample-frq.json"), JSON.stringify(cands, null, 1) + "\n"); wj("frq-audit.json", audit);
  console.log(`[frq-finalize] ${cands.map((c) => `${c.cellId}=${c.reviewState}${c.reviewState === "rejected" ? `(${String(c.rejectionReason).slice(0, 160)})` : ""}`).join(" ")}`); void lengthCueRatio; void LENGTH_CUE_RATIO; void locate; void frqPassageText; void frqPassageDisplay; void groupOfEntry;
}
const STAGES: Record<string, () => Promise<void> | void> = { gen: genStage, check: checkStage, solve: solveStage, adv: advStage, judge: judgeStage, panel: panelStage, finalize: finalizeStage, "frq-gen": frqGenStage, "frq-samples": frqSampleStage, "frq-grade": frqGradeStage, "frq-finalize": frqFinalizeStage };
async function main() {
  if (process.argv.includes("--plan")) { for (const s of SETS) { const e = entryOf(s.entry); const set = realSet(e, textOf(e)); console.log(s.id, e.id, set.form, countedLines(set.stanzas).length, "lines", s.n, "items;", R.REAL_SET_SYSTEM(set.form, s.n).length, "sys chars"); } for (const f of FRQS) console.log(f.id, f.entry, f.type); console.log(JSON.stringify(ledgerTotal())); return 0; }
  const only = arg("--stages").split(",").filter(Boolean); if (!only.length) { console.error("--stages 필요"); return 2; }
  if (!process.env.ANTHROPIC_API_KEY && only.some((s) => ["gen", "solve", "adv", "judge", "panel", "frq-gen", "frq-samples", "frq-grade"].includes(s))) { console.error("ANTHROPIC_API_KEY 환경 변수가 필요합니다(파일에 쓰지 않는다)."); return 3; }
  for (const st of only) { console.log(`── ${st}`); await STAGES[st](); }
  const t = ledgerTotal(); console.log(`이번 실행 $${spentRun().toFixed(4)} / ${CFG.runCapUsd}; 누적 $${t.cumulativeUsd}, 중단선 여유 $${t.headroomToStopLine}`); return 0;
}
main().then((c) => process.exit(c)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
