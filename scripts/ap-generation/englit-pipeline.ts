// AP English Literature 생성 파이프라인(2026-10-14). 정답을 코드로 확정할 수 없는 과목이라 다중 독립 풀이 + 적대적 검토 + 심판 + 지문 검토 + 결정적 게이트(줄 번호·인용·장치 형태) + 제2 모델 패널로 정답을 보증한다.
// 동결 구성 방식은 englang-pipeline.ts / run-frozen.ts 와 같다: --freeze(해시 기록, 유료 호출 없음) → 커밋 → --check-only(해시 대조) → 유료 실행. 구성에 "batch": true 면 모든 단계를 Message Batches 로(동기 단계는 syncStages).
//   npx tsx scripts/ap-generation/englit-pipeline.ts --config config/ap-frozen/englit-p1-a.v1.json --freeze|--check-only|--plan
//   npx tsx scripts/ap-generation/englit-pipeline.ts --config <cfg> [--stages gen,check,...]       (키는 프로세스 환경 ANTHROPIC_API_KEY 로만; 파일에 쓰지 않는다)
// 산출: data/ap/sample-2027/<run>/{plan.json, gen.json, sets.json, solve.json, adv.json, judge.json, review.json, panel.json, candidates.json, audit.json} + <stage>.results.jsonl(원시 응답·비용).
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runBatch, toolInput, estimate, ledger, type BatchReq } from "../mock-exam-generation/batch-lib";
import { fileSetHash } from "../../lib/ap-generation/frozen-config";
import { ledgerTotal } from "./ledger-total";
import { planSets, planSummary } from "../../lib/ap-generation/englit-plan";
import * as P from "../../lib/ap-generation/englit-prompts";
import { balancedKeyPositions, keyConfidence, placeKey, keyPositionViolations, quoteInPassage, type CorpusDoc, type SolverVote } from "../../lib/ap-generation/englang-gates";
import { LENGTH_CUE_RATIO, cleanDevices, itemViolations, lengthCueRatio, ltDisplay, ltForModels, passagePlain, proseStanzas, resolveItem, setItemSpread, setViolations, similarityViolations, type LtItemRaw, type LtSetRaw } from "../../lib/ap-generation/englit-gates";
import { LT_FRQ_SCHEMA_VERSION, LT_FRQ_TYPE_BY_TEMPLATE, frqPassageDisplay, frqPassageText, frqReferenceText, frqTaskText, frqViolations, normalizeFrqPayload, type LtFrqPayload, type LtSample } from "../../lib/ap-generation/englit-frq";
import { LT_WORKS_LIST, ltTopicFor } from "../../lib/ap-generation/subjects/englit";
import { countedLines } from "../../lib/ap-exam/passage-lines";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type LtCfg = {
  version: string; run: string; subject: string; mode: "mc" | "frq"; batch?: boolean; capUsd: number; hardStopCumulativeUsd: number; myTotalCapUsd: number; stages: string[]; syncStages?: string[];
  plan?: { poetry?: { sets: number; seed: number; startIndex?: number }; short?: { sets: number; seed: number; startIndex?: number }; longer?: { sets: number; seed: number; startIndex?: number; dramaSets?: number } };
  frqPlan?: { id: string; type: "poetry_analysis" | "prose_analysis" | "literary_argument"; seedText: string; era: string; seed: number }[];
  models: { gen: string; solvers: string[]; adversary: string; judge: string; review: string; panel: string; rebalance: string; sampleHigh: string; sampleLow: string; graders: string[] };
  effort: string; genForce?: boolean; genEffort?: string; gradeEffort?: string; sampleCands?: number; genModels?: Partial<Record<"poetry" | "short" | "longer", string>>; corpusExclude?: string[]; minKeyConfidence: number; generatorFiles: string[]; expected: { hash: string };
};
const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const has = (n: string) => process.argv.includes(n);
const ROOT = path.resolve("data/ap/sample-2027");
const cfgPath = path.resolve(arg("--config"));
const cfg = JSON.parse(readFileSync(cfgPath, "utf-8")) as LtCfg;
const DIR = path.join(ROOT, cfg.run); mkdirSync(DIR, { recursive: true });
const SYS_CACHE = { type: "ephemeral", ttl: "1h" };
const rj = <T,>(f: string, d: T): T => (existsSync(path.join(DIR, f)) ? (JSON.parse(readFileSync(path.join(DIR, f), "utf-8")) as T) : d);
const wj = (f: string, v: unknown) => writeFileSync(path.join(DIR, f), JSON.stringify(v, null, 1));

const think = (model: string, effort: string) => ({ thinking: model.includes("sonnet") ? { type: "between_tools" } : { type: "adaptive" }, output_config: { effort } });
const mk = (id: string, model: string, sys: string, tool: Json, user: string, max: number, force = false, effort = cfg.effort): BatchReq => ({
  custom_id: id, params: { model, ...(force ? {} : think(model, effort)), max_tokens: max, system: [{ type: "text", text: sys, cache_control: SYS_CACHE }], tools: [tool], tool_choice: { type: "auto" }, messages: [{ role: "user", content: user }] } });

// ── 예산 ───────────────────────────────────────────────────────────
const BASE_F = path.join(ROOT, "englit-baseline.json");
const costIn = (dir: string): number => { let c = 0; if (!existsSync(dir)) return 0; for (const f of readdirSync(dir)) if (/\.results\.jsonl$/.test(f)) for (const l of readFileSync(path.join(dir, f), "utf-8").split("\n").filter(Boolean)) { try { const j = JSON.parse(l); if (!j.cached) c += Number(j.cost ?? 0); } catch { /* skip */ } } return c; };
const spentRun = () => costIn(DIR);
const spentMine = () => readdirSync(ROOT).filter((d) => /^englit-/.test(d) && statSync(path.join(ROOT, d)).isDirectory()).reduce((a, d) => a + costIn(path.join(ROOT, d)), 0);
const myBaseline = () => { if (!existsSync(BASE_F)) writeFileSync(BASE_F, JSON.stringify({ cumulativeAtStart: ledgerTotal().cumulativeUsd, at: new Date().toISOString(), note: "ledger cumulative at the start of the English Literature work; my total cap is cfg.myTotalCapUsd" })); };
function guard(stage: string, est: number) {
  const t = ledgerTotal();
  const why = spentRun() + est > cfg.capUsd ? `run cap ${cfg.capUsd}` : spentMine() + est > cfg.myTotalCapUsd ? `English Literature total cap ${cfg.myTotalCapUsd}` : t.cumulativeUsd + est >= cfg.hardStopCumulativeUsd ? `cumulative ${t.cumulativeUsd} + est >= hard stop ${cfg.hardStopCumulativeUsd}` : "";
  if (why) throw new Error(`HARD STOP before ${stage}: est $${est.toFixed(3)}; run spent $${spentRun().toFixed(3)} / ${cfg.capUsd}; English Literature spent $${spentMine().toFixed(3)} / ${cfg.myTotalCapUsd}; cumulative $${t.cumulativeUsd}: ${why}`);
  console.log(`[${stage}] ledger before: run $${spentRun().toFixed(4)}, Lit total $${spentMine().toFixed(4)}, cumulative $${t.cumulativeUsd} (stop line ${t.stopLine}); est this step $${est.toFixed(3)}`);
}
async function call(stage: string, reqs: BatchReq[], estUsd: number): Promise<Map<string, Json | null>> {
  if (!reqs.length) return new Map(); guard(stage, estUsd);
  const sync = !cfg.batch || (cfg.syncStages?.includes(stage) ?? false);
  const run = async (name: string, rs: BatchReq[]) => runBatch({ dir: DIR, name, requests: rs, budgetUsd: ledger(DIR).spent() + Math.max(0, cfg.capUsd - spentRun()), estimateUsd: estUsd * (rs.length / reqs.length), sync, syncConcurrency: Number(process.env.AP_SYNC_CONC ?? 8), pollMs: 20000 });
  const got = await run(stage, reqs); const out = new Map<string, Json | null>();
  for (const r of reqs) out.set(r.custom_id, got.has(r.custom_id) ? (toolInput(got.get(r.custom_id)!) as Json | null) : null);
  const missing = reqs.filter((r) => !out.get(r.custom_id));
  if (missing.length) {
    console.log(`[${stage}] 도구 호출 없음 ${missing.length}건 → 강제 재요청`);
    const forced = missing.map((r) => ({ custom_id: r.custom_id, params: { ...r.params } })) as BatchReq[];
    for (const f of forced) { delete (f.params as Json).thinking; delete (f.params as Json).output_config; }
    guard(`${stage}-retry`, estUsd * (missing.length / reqs.length));
    const got2 = await run(`${stage}-retry`, forced);
    for (const r of missing) if (got2.has(r.custom_id)) out.set(r.custom_id, toolInput(got2.get(r.custom_id)!) as Json | null);
  }
  console.log(`[${stage}] 완료: 응답 ${[...out.values()].filter(Boolean).length}/${reqs.length}; run $${spentRun().toFixed(4)}, Lit total $${spentMine().toFixed(4)}, cumulative $${ledgerTotal().cumulativeUsd}`);
  return out;
}

// ── 파싱 ───────────────────────────────────────────────────────────
const ints = (v: unknown): number[] => (Array.isArray(v) ? v.map(Number).filter(Number.isInteger) : []);
function parseSet(spec: P.SetSpec, inp: Json): LtSetRaw | null {
  if (!inp || !Array.isArray(inp.items)) return null;
  let stanzas: string[][];
  if (spec.form === "poem") { if (!Array.isArray(inp.stanzas)) return null; stanzas = inp.stanzas.map((s: unknown) => (Array.isArray(s) ? s.map((l) => String(l).replace(/\s+$/g, "")).filter((l) => l.trim()) : String(s).split("\n").filter((l) => l.trim()))).filter((s: string[]) => s.length); }
  else { if (!Array.isArray(inp.paragraphs)) return null; stanzas = proseStanzas(inp.paragraphs.map(String)); }
  const items: LtItemRaw[] = inp.items.map((it: Json) => ({
    skill: String(it.skill ?? ""), cognitive: String(it.cognitive ?? ""), stem: String(it.stem ?? ""),
    options: (Array.isArray(it.options) ? it.options : []).map((o: Json) => ({ text: String(o?.text ?? ""), is_key: o?.is_key === true, label: String(o?.label ?? ""), why: String(o?.why ?? "") })),
    refs: (Array.isArray(it.refs) ? it.refs : []).map((r: Json) => ({ id: String(r?.id ?? ""), quote: String(r?.quote ?? "") })), evidence_quotes: (Array.isArray(it.evidence_quotes) ? it.evidence_quotes : []).map(String),
    devices_used: Array.isArray(it.devices_used) ? it.devices_used.map(String) : [], est_seconds: Number(it.est_seconds ?? 70),
  }));
  return { group: spec.group, form: spec.form, title: String(inp.title ?? ""), headnote: inp.headnote ? String(inp.headnote) : undefined, blueprint: inp.blueprint ?? {}, provenance: { kind: inp.provenance?.kind ?? "original", author_alias: String(inp.provenance?.author_alias ?? ""), year_alias: inp.provenance?.year_alias ?? "", note: inp.provenance?.note }, stanzas, items };
}
const STAGE_DIRS = (): string[] => readdirSync(ROOT).filter((x) => /^englit-/.test(x) && x !== cfg.run && !(cfg.corpusExclude ?? []).includes(x) && statSync(path.join(ROOT, x)).isDirectory());
function corpus(): CorpusDoc[] {
  const docs: CorpusDoc[] = [];
  for (const d of STAGE_DIRS()) {
    const sf = path.join(ROOT, d, "sets.json"); if (existsSync(sf)) for (const s of JSON.parse(readFileSync(sf, "utf-8")) as { spec: P.SetSpec; set: LtSetRaw | null }[]) if (s.set) docs.push({ id: `${d}:${s.spec.id}`, text: passagePlain(s.set) });
    const ff = path.join(ROOT, d, "frq.json"); if (existsSync(ff)) for (const f of JSON.parse(readFileSync(ff, "utf-8")) as { id: string; payload: LtFrqPayload | null }[]) if (f.payload?.passage) docs.push({ id: `${d}:${f.id}`, text: frqPassageText(f.payload.passage) });
  }
  return docs;
}
function specsOf(): P.SetSpec[] {
  const used = new Set<string>(); for (const d of STAGE_DIRS()) { const sf = path.join(ROOT, d, "sets.json"); if (existsSync(sf)) for (const s of JSON.parse(readFileSync(sf, "utf-8")) as { spec: P.SetSpec }[]) used.add(s.spec.premise); }
  const out: P.SetSpec[] = []; for (const g of ["poetry", "short", "longer"] as const) { const p = cfg.plan?.[g]; if (p?.sets) { const part = planSets({ group: g, sets: p.sets, seed: p.seed, startIndex: p.startIndex, dramaSets: (p as { dramaSets?: number }).dramaSets, usedPremises: used }); part.forEach((s) => used.add(s.premise)); out.push(...part); } }
  return out;
}

// ── gen / check / rebalance ────────────────────────────────────────
type Row = { spec: P.SetSpec; set: LtSetRaw | null; setViolations: string[]; items: (LtItemRaw & { key_index: number; det: string[]; rebalanced?: boolean })[] };
async function genStage() {
  const specs = specsOf(); wj("plan.json", { specs, summary: planSummary(specs) });
  const reqs = specs.map((s) => mk(`g-${s.id}`, cfg.genModels?.[s.group] ?? cfg.models.gen, s.form === "poem" ? P.GEN_POEM_SYSTEM : P.GEN_PROSE_SYSTEM(s.form), P.setTool, P.genUser(s), 32000, false, cfg.genEffort ?? cfg.effort));
  const out = await call("gen", reqs, estimate(cfg.models.gen, reqs.length, 3200, 10000)); wj("gen.json", Object.fromEntries([...out.entries()]));
}
const sameSkills = (spec: P.SetSpec, items: LtItemRaw[]) => [...spec.skills].sort().join() === items.map((i) => i.skill).sort().join();
function checkStage() {
  const specs = rj<{ specs: P.SetSpec[] }>("plan.json", { specs: [] }).specs; const gen = rj<Record<string, Json | null>>("gen.json", {}); const prior = corpus(); const same: CorpusDoc[] = []; const rows: Row[] = [];
  for (const spec of specs) {
    const parsed = parseSet(spec, gen[`g-${spec.id}`] as Json); const cd = parsed ? cleanDevices(parsed) : null; const set = cd ? cd.set : null; if (!set) { rows.push({ spec, set: null, setViolations: ["no_tool_output_or_unparseable"], items: [] }); continue; }
    const sv = [...setViolations(set), ...similarityViolations(passagePlain(set), [...prior, ...same])]; same.push({ id: `${cfg.run}:${spec.id}`, text: passagePlain(set) });
    if (set.items.length !== spec.skills.length) sv.push(`item_count_${set.items.length}_not_${spec.skills.length}`);
    const items = set.items.map((it) => ({ ...it, key_index: it.options.findIndex((o) => o.is_key), det: itemViolations(set, it), cue: lengthCueRatio(it) }));
    rows.push({ spec, set, setViolations: sv, items: items as Row["items"] });
  }
  wj("sets.json", rows);
  const all = rows.flatMap((r) => r.items);
  console.log(`[check] 묶음 ${rows.length}: 지문·묶음 위반 없음 ${rows.filter((r) => r.set && r.setViolations.length === 0).length}, 문항 ${all.length} 중 결정적 위반 없음 ${all.filter((i) => i.det.length === 0).length}, 길이 단서(키가 유일 최장 ≥ ${LENGTH_CUE_RATIO}배) ${all.filter((i) => lengthCueRatio(i) >= LENGTH_CUE_RATIO).length}`);
  for (const r of rows) console.log(`  ${r.spec.id} [${r.spec.form}] ${r.set ? `${passagePlain(r.set).split(/\s+/).length}w ${countedLines(r.set.stanzas).length}lines` : "NO OUTPUT"} set:${r.setViolations.join(",") || "ok"} items: ${r.items.filter((i) => i.det.length === 0).length}/${r.items.length} ok; viol: ${[...new Set(r.items.flatMap((i) => i.det.map((x) => x.replace(/_[^_]*\d.*$/, "").slice(0, 40))))].join(",")}`);
}
const HARD_SET = (v: string) => !/^length_cue_in_/.test(v);
const setAlive = (r: Row) => Boolean(r.set) && !r.setViolations.some(HARD_SET);
async function rebalanceStage() {
  const rows = rj<Row[]>("sets.json", []); const reqs: BatchReq[] = []; const meta: { id: string; setId: string; idx: number[] }[] = [];
  for (const r of rows) {
    if (!r.set || !setAlive(r)) continue;
    const idx = r.items.map((_, i) => i).filter((i) => r.items[i].det.length === 0 && lengthCueRatio(r.items[i]) >= LENGTH_CUE_RATIO); if (!idx.length) continue;
    const items = idx.map((i) => { const it = r.items[i]; const res = resolveItem(r.set!, it); return { question: i + 1, stem: res.stem, options: res.options.map((o) => o.text), key: it.options.findIndex((o) => o.is_key), labels: it.options.map((o) => o.label), whys: it.options.map((o) => o.why) }; });
    reqs.push(mk(`b-${r.spec.id}`, cfg.models.rebalance, P.REBALANCE_SYSTEM, P.REBALANCE_TOOL, P.rebalanceUser(ltForModels(r.set), items), 8000)); meta.push({ id: `b-${r.spec.id}`, setId: r.spec.id, idx });
  }
  const out = await call("rebalance", reqs, estimate(cfg.models.rebalance, reqs.length, 2500, 2200)); let changed = 0;
  for (const m of meta) { const row = rows.find((r) => r.spec.id === m.setId)!; for (const q of (out.get(m.id)?.questions ?? []) as Json[]) { const ii = Number(q.question) - 1; const it = row.items[ii]; if (!it || !m.idx.includes(ii)) continue;
    const next = it.options.map((o) => ({ ...o })); let ok = true; for (const d of (q.distractors ?? []) as Json[]) { const j = Number(d.index); if (!Number.isInteger(j) || !next[j] || next[j].is_key) { ok = false; break; } next[j] = { ...next[j], text: String(d.text ?? next[j].text), why: String(d.why ?? next[j].why) }; }
    if (!ok) continue; const cand = { ...it, options: next }; if (lengthCueRatio(cand) < lengthCueRatio(it)) { row.items[ii] = { ...cand, rebalanced: true }; changed++; } } }
  // 재검사 + 키 위치 균형 배치(코드)
  const live = rows.flatMap((r) => r.items.map((it) => ({ r, it })));
  const pos = balancedKeyPositions(Math.max(live.length, 4), 7919 + rows.length); let pi = 0;
  for (const r of rows) { if (!r.set) continue; r.items = r.items.map((it, i) => { const det = itemViolations(r.set!, it); const placed = placeKey(it.options, pos[pi++ % pos.length], 31 * (i + 1) + r.spec.seed); return { ...it, options: placed.options, key_index: placed.key_index, det }; });
    r.setViolations = [...r.setViolations.filter((v) => !/^length_cue_in_/.test(v)), ...setItemSpread(r.items)]; }
  wj("sets.json", rows);
  const stillCue = rows.flatMap((r) => r.items).filter((i) => lengthCueRatio(i) >= LENGTH_CUE_RATIO).length;
  console.log(`[rebalance] 보정 ${changed}건; 남은 길이 단서 ${stillCue}/${live.length}; 키 위치 ${keyPositionViolations(rows.flatMap((r) => r.items.map((i) => i.key_index))).join(",") || "균형"} (${[0, 1, 2, 3].map((k) => rows.flatMap((r) => r.items).filter((x) => x.key_index === k).length).join("/")})`);
}

// ── solve / adv / judge / review / panel ───────────────────────────
const perm = (n: number, k: number): number[] => (k === 0 ? Array.from({ length: n }, (_, i) => i) : k === 1 ? Array.from({ length: n }, (_, i) => n - 1 - i) : k === 2 ? Array.from({ length: n }, (_, i) => (i + 1) % n) : Array.from({ length: n }, (_, i) => (i + 2) % n));
const shownItems = (r: Row, idx: number[], k: number) => idx.map((i) => { const res = resolveItem(r.set!, r.items[i]); return { stem: res.stem, options: perm(4, k).map((j) => res.options[j].text) }; });
async function solveStage() {
  const rows = rj<Row[]>("sets.json", []); const reqs: BatchReq[] = []; const meta: { id: string; setId: string; k: number; idx: number[] }[] = [];
  for (const r of rows) {
    if (!setAlive(r)) continue; const idx = r.items.map((_, i) => i).filter((i) => r.items[i].det.length === 0); if (!idx.length) continue;
    cfg.models.solvers.forEach((model, k) => { const id = `v${k}-${r.spec.id}-${idx.length}`; reqs.push(mk(id, model, P.SOLVER_SYSTEMS[k], P.SOLVER_TOOL, P.solverUser(ltForModels(r.set!), shownItems(r, idx, k)), 5000)); meta.push({ id, setId: r.spec.id, k, idx }); });
  }
  const est = cfg.models.solvers.reduce((a, m) => a + estimate(m, reqs.length / cfg.models.solvers.length, 3200, 2600), 0);
  const out = await call("solve", reqs, est); const votes: Record<string, (SolverVote | null)[][]> = {};
  for (const m of meta) {
    const row = rows.find((r) => r.spec.id === m.setId)!; const arr = (votes[m.setId] ??= row.items.map(() => cfg.models.solvers.map(() => null) as (SolverVote | null)[])); const p = perm(4, m.k);
    for (const a of (out.get(m.id)?.answers ?? []) as Json[]) { const itemIdx = m.idx[Number(a.question) - 1]; if (itemIdx === undefined) continue; const sc = Number(a.choice); const also = a.also_defensible === null || a.also_defensible === undefined ? null : p[Number(a.also_defensible)]; arr[itemIdx][m.k] = { choice: Number.isInteger(sc) && sc >= 0 && sc < 4 ? p[sc] : null, confidence: String(a.confidence ?? "likely"), also_defensible: also === undefined ? null : also }; }
  }
  wj("solve.json", votes);
  let a = 0, tot = 0; for (const r of rows) r.items.forEach((it, i) => { const v = votes[r.spec.id]?.[i]; if (!v) return; tot++; if (v.every((x) => x && x.choice === it.key_index)) a++; }); console.log(`[solve] 전원 일치 ${a}/${tot}`);
}
const solved = (votes: Record<string, (SolverVote | null)[][]>, r: Row, i: number) => { const v = votes[r.spec.id]?.[i]; return Boolean(v) && v!.every((x) => x && x.choice === r.items[i].key_index); };
async function advStage() {
  const rows = rj<Row[]>("sets.json", []); const votes = rj<Record<string, (SolverVote | null)[][]>>("solve.json", {}); const reqs: BatchReq[] = []; const meta: { id: string; setId: string; idx: number[] }[] = [];
  for (const r of rows) {
    if (!setAlive(r)) continue; const idx = r.items.map((_, i) => i).filter((i) => solved(votes, r, i)); if (!idx.length) continue;
    const items = idx.map((i) => { const res = resolveItem(r.set!, r.items[i]); return { stem: res.stem, options: res.options.map((o) => o.text), key: r.items[i].key_index, why: res.options[r.items[i].key_index].why }; });
    reqs.push(mk(`a-${r.spec.id}-${idx.length}`, cfg.models.adversary, P.ADV_SYSTEM, P.ADV_TOOL, P.advUser(ltForModels(r.set!), items), 7000)); meta.push({ id: `a-${r.spec.id}-${idx.length}`, setId: r.spec.id, idx });
  }
  const out = await call("adv", reqs, estimate(cfg.models.adversary, reqs.length, 3600, 3400)); const adv: Record<string, (Json | null)[]> = {};
  for (const m of meta) { const row = rows.find((r) => r.spec.id === m.setId)!; const arr = (adv[m.setId] ??= row.items.map(() => null)); for (const c of (out.get(m.id)?.challenges ?? []) as Json[]) { const ii = m.idx[Number(c.question) - 1]; if (ii !== undefined) arr[ii] = c; } }
  wj("adv.json", adv);
  const rev = rows.filter((r) => setAlive(r) && (adv[r.spec.id] ?? []).some(Boolean)).map((r) => mk(`p-${r.spec.id}`, cfg.models.review, P.REVIEW_SYSTEM, P.REVIEW_TOOL, P.reviewUser(ltForModels(r.set!), r.set!.blueprint), 3000));
  const ro = await call("review", rev, estimate(cfg.models.review, rev.length, 2200, 900)); wj("review.json", Object.fromEntries([...ro.entries()]));
}
async function judgeStage() {
  const rows = rj<Row[]>("sets.json", []); const adv = rj<Record<string, (Json | null)[]>>("adv.json", {}); const reqs: BatchReq[] = []; const meta: { id: string; setId: string; idx: number[] }[] = [];
  for (const r of rows) {
    const idx = r.items.map((_, i) => i).filter((i) => adv[r.spec.id]?.[i]); if (!idx.length) continue;
    const items = idx.map((i) => { const a = adv[r.spec.id][i]!; const res = resolveItem(r.set!, r.items[i]); return { stem: res.stem, options: res.options.map((o) => o.text), key: r.items[i].key_index, alt: Number.isInteger(a.alt_index) ? (a.alt_index as number) : null, argument: String(a.argument ?? "") }; });
    reqs.push(mk(`j-${r.spec.id}-${idx.length}`, cfg.models.judge, P.JUDGE_SYSTEM, P.JUDGE_TOOL, P.judgeUser(ltForModels(r.set!), items), 4500)); meta.push({ id: `j-${r.spec.id}-${idx.length}`, setId: r.spec.id, idx });
  }
  const out = await call("judge", reqs, estimate(cfg.models.judge, reqs.length, 3800, 1800)); const jd: Record<string, (Json | null)[]> = {};
  for (const m of meta) { const row = rows.find((r) => r.spec.id === m.setId)!; const arr = (jd[m.setId] ??= row.items.map(() => null)); for (const v of (out.get(m.id)?.verdicts ?? []) as Json[]) { const ii = m.idx[Number(v.question) - 1]; if (ii !== undefined) arr[ii] = v; } }
  wj("judge.json", jd);
}
/** 풀이·적대·심판·지문 검토를 모두 통과한 문항(패널 대상·최종 후보). */
function evalRow(r: Row) {
  const votes = rj<Record<string, (SolverVote | null)[][]>>("solve.json", {}); const adv = rj<Record<string, (Json | null)[]>>("adv.json", {}); const jd = rj<Record<string, (Json | null)[]>>("judge.json", {}); const rv = rj<Record<string, Json | null>>("review.json", {});
  const reviewOut = rv[`p-${r.spec.id}`]; const reviewBad = reviewOut ? Boolean(reviewOut.resembles_known_text) || Boolean(reviewOut.real_world_error) || !reviewOut.ok : true;
  return r.items.map((it, i) => {
    const v = (votes[r.spec.id]?.[i] ?? []).filter(Boolean) as SolverVote[]; const a = adv[r.spec.id]?.[i] ?? null; const j = jd[r.spec.id]?.[i] ?? null;
    const kc = keyConfidence({ keyIndex: it.key_index, votes: v.length === cfg.models.solvers.length ? v : [], adversary: a ? { defensibility: a.defensibility, alt_index: a.alt_index } : null, judge: j ? { verdict: j.verdict } : null, detViolations: [...it.det] /* adversary key_flaw·stem_issue 는 설명 문구 지적이 대부분이라 제외하지 않고 review_notes 로 남긴다(제외는 strong·심판) */, minScore: cfg.minKeyConfidence });
    return { it, i, kc, a, j, votes: v, reviewBad, reviewOut, pass: kc.pass && setAlive(r) && !reviewBad };
  });
}
async function panelStage() {
  const rows = rj<Row[]>("sets.json", []); const reqs: BatchReq[] = []; const meta: { id: string; setId: string; idx: number[] }[] = [];
  for (const r of rows) { if (!r.set) continue; const idx = evalRow(r).filter((e) => e.pass).map((e) => e.i); if (idx.length < 3) continue; const id = `m-${r.spec.id}-${idx.length}`; reqs.push(mk(id, cfg.models.panel, P.PANEL_SYSTEM, P.SOLVER_TOOL, P.solverUser(ltForModels(r.set), shownItems(r, idx, 3)), 6000)); meta.push({ id, setId: r.spec.id, idx }); }
  const out = await call("panel", reqs, estimate(cfg.models.panel, reqs.length, 3400, 3000)); const res: Record<string, (Json | null)[]> = {}; const p = perm(4, 3); let agree = 0, tot = 0;
  for (const m of meta) { const row = rows.find((r) => r.spec.id === m.setId)!; const arr = (res[m.setId] ??= row.items.map(() => null)); for (const a of (out.get(m.id)?.answers ?? []) as Json[]) { const ii = m.idx[Number(a.question) - 1]; if (ii === undefined) continue; const sc = Number(a.choice); const choice = Number.isInteger(sc) && sc >= 0 && sc < 4 ? p[sc] : null; const also = a.also_defensible === null || a.also_defensible === undefined ? null : p[Number(a.also_defensible)]; arr[ii] = { choice, confidence: String(a.confidence ?? ""), also_defensible: also ?? null, agree: choice === row.items[ii].key_index }; tot++; if (choice === row.items[ii].key_index) agree++; } }
  wj("panel.json", res); console.log(`[panel] ${cfg.models.panel} 일치 ${agree}/${tot}`);
}

// ── finalize(MC) ───────────────────────────────────────────────────
function explanationOf(it: { options: { text: string; why: string }[]; key_index: number }): string {
  const key = it.options[it.key_index]; const lines = [`The correct answer is "${key.text}". ${key.why.trim()}`];
  it.options.forEach((o, i) => { if (i !== it.key_index) lines.push(`"${o.text}" is incorrect: ${o.why.trim()}`); });
  return lines.join("\n");
}
function finalizeStage() {
  const rows = rj<Row[]>("sets.json", []); const panel = rj<Record<string, (Json | null)[]>>("panel.json", {}); const usePanel = Object.keys(panel).length > 0; const cands: Json[] = []; const audit: Json[] = [];
  for (const r of rows) {
    const ev = r.set ? evalRow(r) : []; const kept: typeof ev = []; const excluded: Json[] = [];
    for (const e of ev) {
      const pv = panel[r.spec.id]?.[e.i] ?? null; const panelOk = !usePanel || (pv !== null && pv.agree === true && (pv.also_defensible === null || pv.also_defensible === e.it.key_index));
      const reasons = [...e.kc.reasons, ...(setAlive(r) ? [] : ["set_gate_failed"]), ...(e.reviewBad ? ["passage_review"] : []), ...(e.pass && !panelOk ? [pv ? "panel_disagrees_or_second_defensible" : "panel_missing"] : [])];
      audit.push({ set: r.spec.id, i: e.i, skill: e.it.skill, det: e.it.det, solverAgree: e.kc.solverAgreement, adversary: e.a?.defensibility ?? null, judge: e.j?.verdict ?? null, panel: pv ? { choice: pv.choice, agree: pv.agree } : null, score: e.kc.score, pass: e.pass && panelOk, reasons, cue: Number(lengthCueRatio(e.it).toFixed(2)) });
      if (e.pass && panelOk) kept.push(e); else excluded.push({ index: e.i, skill: e.it.skill, reasons });
    }
    // 세트 안 길이 단서 비율 ≤ 40%: 넘으면 단서 비율이 큰 문항부터 뺀다.
    const cueOf = (e: (typeof ev)[number]) => lengthCueRatio(e.it); while (kept.length >= 6 && kept.filter((e) => cueOf(e) >= LENGTH_CUE_RATIO).length / kept.length > 0.4) { const worst = kept.reduce((a, b) => (cueOf(b) > cueOf(a) ? b : a)); kept.splice(kept.indexOf(worst), 1); excluded.push({ index: worst.i, skill: worst.it.skill, reasons: ["length_cue_trim"] }); }
    // 묶음 크기 상한(공식 8–13, 장편·희곡은 장르 비중상 8–10): 넘으면 키 신뢰도가 낮은(같으면 길이 단서가 큰) 문항부터 뺀다.
    const capN = r.spec.group === "longer" ? 10 : 13; while (kept.length > capN) { const worst = kept.reduce((a, b) => (b.kc.score < a.kc.score || (b.kc.score === a.kc.score && lengthCueRatio(b.it) > lengthCueRatio(a.it)) ? b : a)); kept.splice(kept.indexOf(worst), 1); excluded.push({ index: worst.i, skill: worst.it.skill, reasons: ["set_size_cap"] }); }
    const base = { cellId: `ap_english_literature-${r.spec.id}`, apSubjectCode: "ap_english_literature", kind: "mc" as const, calculator: "na", reserve: false, wording: "generated" };
    const archetype = `lt_${r.spec.group}_${r.spec.id}`; const topicFor = (skill: string, i: number) => ltTopicFor(skill, r.spec.group, i);
    if (!r.set || kept.length < 8) { cands.push({ ...base, candidateKey: `ap_english_literature-${r.spec.id}-k0`, keywordCode: topicFor(r.spec.skills[0], 0), unitCode: (topicFor(r.spec.skills[0], 0).match(/^U(\d)/) ?? [])[1] ?? "", skillPrimary: r.spec.skills[0], structure: "shared_stimulus_set", archetype, reviewState: "rejected", rejectionReason: `${r.setViolations.join("; ") || (ev[0]?.reviewBad ? "passage_review" : `fewer_than_8_items_passed_${kept.length}`)}; excluded=${JSON.stringify(excluded)}`.slice(0, 1500), difficultyProvisional: null, payload: { archetype, spec: r.spec, excluded_items: excluded, kept_count: kept.length } }); continue; }
    const set = r.set; const keptSorted = kept.slice().sort((a, b) => a.i - b.i);
    const items = keptSorted.map((e, n) => { const res = resolveItem(set, e.it); const opts = res.options.map((o) => ({ text: o.text, why: o.why, value: null, label: o.label })); const pv = panel[r.spec.id]?.[e.i] ?? null;
      return { archetype: `lt_${r.spec.group}_${e.it.skill.replace(".", "")}`, topic: topicFor(e.it.skill, n), skill: e.it.skill, cognitive: e.it.cognitive, stem: res.stem, options: opts, key_index: e.it.key_index, explanation_en: explanationOf({ options: opts, key_index: e.it.key_index }), est_seconds: e.it.est_seconds ?? 70,
        evidence_quotes: e.it.evidence_quotes, ref_lines: res.refLines, devices_used: e.it.devices_used ?? [], review_notes: { key_flaw: e.a?.key_flaw ?? null, stem_issue: e.a?.stem_issue ?? null }, key_confidence: { score: e.kc.score, band: e.kc.band, solver_agreement: e.kc.solverAgreement, adversary: e.a?.defensibility ?? null, judge: e.j?.verdict ?? null, panel: pv ? { model: cfg.models.panel, choice: pv.choice, agree: pv.agree } : null, solver_votes: e.votes.map((x) => x && { choice: x.choice, confidence: x.confidence }) } }; });
    const diff = items.map((it) => ({ label: it.cognitive === "identify" && it.key_confidence.adversary === "none" ? "basic_learning" : it.cognitive === "evaluate" && it.key_confidence.adversary === "weak" ? "advanced_supplement" : "exam_prep" }));
    const first = items[0];
    cands.push({ ...base, candidateKey: `ap_english_literature-${r.spec.id}-k0`, keywordCode: first.topic, unitCode: (first.topic.match(/^U(\d)/) ?? [])[1] ?? "", skillPrimary: first.skill, structure: "shared_stimulus_set", archetype, reviewState: "auto_passed", rejectionReason: null, difficultyProvisional: "exam_prep", difficulty: diff,
      payload: { archetype, topic: first.topic, skill: first.skill, calculator: "na", set_intro: ltDisplay(set), lt_passage: { form: set.form, group: r.spec.group, title: set.title, headnote: set.headnote ?? null, stanzas: set.stanzas, line_count: countedLines(set.stanzas).length }, provenance: set.provenance, blueprint: set.blueprint, premise: r.spec.premise, era: r.spec.era, items, excluded_items: excluded } });
  }
  wj("candidates.json", cands); wj("audit.json", audit);
  const passed = audit.filter((a) => a.pass).length; const agree = audit.filter((a) => a.solverAgree === 1).length;
  console.log(`[finalize] 문항 ${audit.length}: 결정적 통과 ${audit.filter((a) => a.det.length === 0).length}, 풀이 전원 일치 ${agree}, 최종 통과 ${passed} (${((passed / Math.max(1, audit.length)) * 100).toFixed(1)}%); 묶음 통과 ${cands.filter((c) => c.reviewState === "auto_passed").length}/${cands.length}: ${cands.map((c) => `${String(c.cellId).split("-").pop()}=${c.reviewState === "auto_passed" ? (c.payload.items as unknown[]).length : "x"}`).join(" ")}`);
}

// ── FRQ ────────────────────────────────────────────────────────────
const rubricText = (p: LtFrqPayload) => p.rubric.rows.map((r) => `${r.name} (0-${r.max}): ${r.task_specific}\n${Object.entries(r.descriptors).sort().map(([k, v]) => `  ${k}: ${v}`).join("\n")}`).join("\n") + "\n" + p.rubric.scoring_notes.map((n) => `Note: ${n}`).join("\n");
const REQS: Record<LtFrqPayload["task_type"], string[]> = {
  poetry_analysis: ["Respond to the prompt with a thesis that offers a defensible interpretation of the poem.", "Use specific evidence from the poem, and explain how that evidence supports your line of reasoning.", "Explain how multiple poetic elements and techniques contribute to the meaning you describe.", "Write clearly, with appropriate grammar and punctuation."],
  prose_analysis: ["Respond to the prompt with a thesis that offers a defensible interpretation of the passage.", "Use specific evidence from the passage, and explain how that evidence supports your line of reasoning.", "Explain how multiple literary elements and techniques contribute to the meaning you describe.", "Write clearly, with appropriate grammar and punctuation."],
  literary_argument: ["State a defensible thesis about how the idea in the prompt contributes to an interpretation of the work as a whole.", "Support the argument with specific, accurate evidence from the work you chose, and explain how that evidence supports your line of reasoning.", "Do not merely summarize the plot.", "Write clearly, with appropriate grammar and punctuation."],
};
function toFrqPayload(plan: NonNullable<LtCfg["frqPlan"]>[number], inp: Json): LtFrqPayload | null {
  if (!inp?.rubric || !inp?.expected_features) return null; const tpl = plan.type === "poetry_analysis" ? "q1" : plan.type === "prose_analysis" ? "q2" : "q3";
  let passage: LtFrqPayload["passage"]; let prompt: LtFrqPayload["prompt"]; let works: LtFrqPayload["works_list"];
  if (plan.type === "literary_argument") {
    const order = LT_WORKS_LIST.map((w, i) => ({ w, k: (i * 7919 + plan.seed) % 1009 })).sort((a, b) => a.k - b.k).map((x) => ({ title: x.w[0], author: x.w[1] })); works = order;
    prompt = { lead: String(inp.lead ?? ""), task: `Either from your own reading or from the list below, choose a work of fiction in which ${String(inp.aspect ?? "").replace(/[.\s]+$/, "")}. Then, in a well-written essay, analyze how ${String(inp.focus ?? "").replace(/[.\s]+$/, "")} contributes to an interpretation of the work as a whole. Do not merely summarize the plot.`, requirements: REQS.literary_argument };
  } else {
    const ps = inp.passage; if (!ps) return null; const stanzas: string[][] = plan.type === "poetry_analysis" ? (Array.isArray(ps.stanzas) ? ps.stanzas.map((s: unknown) => (Array.isArray(s) ? s.map((l) => String(l).replace(/\s+$/g, "")).filter((l) => l.trim()) : [])).filter((s: string[]) => s.length) : []) : proseStanzas(Array.isArray(ps.paragraphs) ? ps.paragraphs.map(String) : []);
    if (!stanzas.length) return null; const alias = String(ps.author_alias ?? "");
    passage = { form: plan.type === "poetry_analysis" ? "poem" : "prose", title: String(ps.title ?? ""), attribution: `by ${alias}`, headnote: ps.headnote ? String(ps.headnote) : undefined, stanzas, line_count: countedLines(stanzas).length, provenance: { kind: "original", author_alias: alias, year_alias: ps.year_alias ?? "" } };
    const addr = String(inp.addressed ?? "").replace(/[.\s]+$/, ""); const focus = String(inp.focus ?? "").replace(/[.\s]+$/, "");
    prompt = plan.type === "poetry_analysis"
      ? { lead: `In the poem "${passage.title}" (an original poem by ${alias}), the speaker ${addr}.`, task: `Read the poem closely. Then write an essay in which you analyze how ${alias} uses poetic elements and techniques to ${focus}.`, requirements: REQS.poetry_analysis }
      : { lead: `The following passage is an original work of fiction by ${alias}. In this passage, ${addr}.`, task: `Read the passage closely. Then write an essay in which you analyze how ${alias} uses literary elements and techniques to ${focus}.`, requirements: REQS.prose_analysis };
  }
  return normalizeFrqPayload({ schema_version: LT_FRQ_SCHEMA_VERSION, task_type: plan.type, template: tpl, title: String(inp.title ?? ""), prompt, passage, works_list: works, rubric: { total_points: 6, rows: (inp.rubric.rows as Json[]).map((r) => ({ row_id: r.row_id, name: "", max: 0, descriptors: {}, task_specific: String(r.task_specific ?? "") })) as never, scoring_notes: (inp.rubric.scoring_notes ?? []).map(String) }, expected_features: { ...(inp.expected_features ?? {}) }, samples: [], blueprint: { ...(inp.blueprint ?? {}) }, provenance: { kind: "original", note: "ALTON original practice material; fictional writers, titles and works. Q3 lists real published works for student choice." } });
}
async function frqGenStage() {
  const plan = cfg.frqPlan ?? []; const sys = { poetry_analysis: P.FRQ_POEM_SYSTEM, prose_analysis: P.FRQ_PROSE_SYSTEM, literary_argument: P.FRQ_ARG_SYSTEM };
  const reqs = plan.map((p) => mk(`f-${p.id}`, cfg.models.gen, sys[p.type], P.frqTool, P.frqUser(p.type, p.seedText, p.era, p.seed), 16000, Boolean(cfg.genForce), cfg.genEffort ?? cfg.effort));
  const out = await call("frq-gen", reqs, estimate(cfg.models.gen, reqs.length, 2200, 6500));
  wj("frq.json", plan.map((p) => ({ id: p.id, plan: p, payload: toFrqPayload(p, out.get(`f-${p.id}`) as Json) })));
}
const loadFrq = () => rj<{ id: string; plan: Json; payload: LtFrqPayload | null }[]>("frq.json", []).map((f) => ({ ...f, payload: f.payload ? normalizeFrqPayload(f.payload) : null }));
const matText = (p: LtFrqPayload) => (p.passage ? `${p.passage.title}\n${p.passage.headnote ?? ""}\n${p.passage.stanzas.map((s) => s.join("\n")).join("\n\n")}` : "");
async function frqSampleStage() {
  const fr = loadFrq(); const reqs: BatchReq[] = [];
  for (const f of fr) { if (!f.payload) continue; const pv = frqViolations(f.payload).filter((x) => !/^sample|samples_/.test(x)); if (pv.length) { console.log(`[frq-samples] ${f.id}: 과제 위반 ${pv.join(",")} → 샘플 생성 건너뜀`); continue; }
    for (const tier of ["high", "mid", "low"] as const) for (let k = 0; k < (cfg.sampleCands ?? 2); k++) reqs.push(mk(`s-${f.id}-${tier}-${k}`, tier === "high" ? cfg.models.sampleHigh : cfg.models.sampleLow, P.SAMPLE_SYSTEM(tier), P.SAMPLE_TOOL, P.sampleUser(frqTaskText(f.payload), matText(f.payload), rubricText(f.payload)), 6000)); }
  const out = await call("frq-samples", reqs, estimate(cfg.models.sampleHigh, reqs.length, 2600, 1500)); wj("frq-samples.json", Object.fromEntries([...out.entries()]));
}
async function frqGradeStage() {
  const fr = loadFrq(); const samples = rj<Record<string, Json | null>>("frq-samples.json", {}); const reqs: BatchReq[] = [];
  for (const f of fr) { if (!f.payload) continue; for (const tier of ["high", "mid", "low"]) for (let k = 0; k < (cfg.sampleCands ?? 2); k++) { const s = samples[`s-${f.id}-${tier}-${k}`]; if (!s?.essay) continue; cfg.models.graders.forEach((m, g) => reqs.push(mk(`r${g}-${f.id}-${tier}-${k}`, m, P.GRADE_SYSTEMS[g], P.GRADE_TOOL, P.gradeUser(frqTaskText(f.payload!), matText(f.payload!), rubricText(f.payload!), String(s.essay)), 3000, false, cfg.gradeEffort ?? cfg.effort))); } }
  const out = await call("frq-grade", reqs, cfg.models.graders.reduce((a, m) => a + estimate(m, reqs.length / cfg.models.graders.length, 3200, 800), 0)); wj("frq-grades.json", Object.fromEntries([...out.entries()]));
}
const median = (a: number[]) => { const s = a.slice().sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2); };
const TARGET = { high: 6, mid: 4, low: 2 } as const;
function frqFinalizeStage() {
  const fr = loadFrq(); const samples = rj<Record<string, Json | null>>("frq-samples.json", {}); const grades = rj<Record<string, Json | null>>("frq-grades.json", {}); const cands: Json[] = []; const audit: Json[] = [];
  const prior = corpus().filter((d) => !d.id.startsWith(`${cfg.run}:`));
  for (const f of fr) {
    const base = { cellId: `ap_english_literature-${f.id}`, apSubjectCode: "ap_english_literature", kind: "frq_bundle" as const, calculator: "na", reserve: false, wording: "generated", candidateKey: `ap_english_literature-${f.id}-k0` };
    if (!f.payload) { cands.push({ ...base, keywordCode: "U9.4", unitCode: "9", skillPrimary: "7.B", structure: "frq_multipart", archetype: `ltfrq_${f.id}`, reviewState: "rejected", rejectionReason: "no_tool_output", difficultyProvisional: null, payload: { archetype: `ltfrq_${f.id}` } }); continue; }
    const p = f.payload; const chosen: LtSample[] = []; const why: string[] = [];
    for (const tier of ["high", "mid", "low"] as const) {
      const options = Array.from({ length: cfg.sampleCands ?? 2 }, (_, k) => k).map((k) => { const s = samples[`s-${f.id}-${tier}-${k}`]; if (!s?.essay) return null; const gs = cfg.models.graders.map((_, g) => grades[`r${g}-${f.id}-${tier}-${k}`]).filter(Boolean) as Json[]; if (gs.length < cfg.models.graders.length) return null;
        const sc = { A: median(gs.map((x) => Number(x.A))), B: median(gs.map((x) => Number(x.B))), C: median(gs.map((x) => Number(x.C))) }; const tot = sc.A + sc.B + sc.C; const totals = gs.map((x) => Number(x.A) + Number(x.B) + Number(x.C)); const spread = Math.max(...totals) - Math.min(...totals);
        const errs = gs.filter((x) => Array.isArray(x.factual_errors) && x.factual_errors.length > 0).length; return { k, s, sc, tot, spread, dist: Math.abs(tot - TARGET[tier]), errs }; }).filter(Boolean) as { k: number; s: Json; sc: { A: number; B: number; C: number }; tot: number; spread: number; dist: number; errs: number }[];
      const okOpts = options.filter((o) => o.dist <= 1 && o.spread <= 2 && o.errs < 2);
      const ok = okOpts.sort((a, b) => a.errs - b.errs || a.dist - b.dist || a.spread - b.spread)[0];
      audit.push({ id: f.id, tier, options: options.map((o) => ({ k: o.k, total: o.tot, spread: o.spread, factualErrorGraders: o.errs })), chosen: ok?.k ?? null });
      if (!ok) { why.push(`sample_${tier}_no_consistent_candidate`); continue; }
      const noDollar = (t: string) => t.replace(/[$]\s*(\d[\d,.]*)/g, "$1 dollars").replace(/[$]/g, ""); const text = noDollar(String(ok.s.essay)).trim();
      chosen.push({ tier, target_total: ok.tot, essay: text, word_count: (text.match(/\S+/g) ?? []).length, rubric_scores: { ...ok.sc, total: ok.tot }, annotations: ((ok.s.annotations as Json[]) ?? []).map((a) => ({ quote: noDollar(String(a.quote)), comment: noDollar(String(a.comment)), row_id: a.row_id })).filter((a) => quoteInPassage(a.quote, text)), ...(ok.s.work_chosen ? { work_chosen: String(ok.s.work_chosen) } : {}) });
    }
    p.samples = chosen; const v = [...frqViolations(p, prior), ...why];
    if (v.length) { cands.push({ ...base, keywordCode: "U9.4", unitCode: "9", skillPrimary: "7.B", structure: "frq_multipart", archetype: `ltfrq_${f.id}`, reviewState: "rejected", rejectionReason: v.join("; ").slice(0, 1500), difficultyProvisional: null, payload: { archetype: `ltfrq_${f.id}`, lit_frq: p } }); continue; }
    const skill = p.task_type === "poetry_analysis" ? "6.B" : p.task_type === "prose_analysis" ? "4.C" : "7.B"; const hi = p.samples.find((s) => s.tier === "high")!; const intro = frqPassageDisplay(p);
    cands.push({ ...base, keywordCode: "U9.4", unitCode: "9", skillPrimary: skill, structure: "frq_multipart", archetype: `ltfrq_${f.id}`, reviewState: "auto_passed", rejectionReason: null, difficultyProvisional: "exam_prep",
      payload: { archetype: `ltfrq_${f.id}`, template: p.template, topic: "U9.4", extra_topics: [], skill, representative_skill: skill, calculator: "na", title: p.title, ...(intro ? { set_intro: intro } : {}),
        parts: [{ label: "A", prompt: frqTaskText(p), points: 6, response_mode: "essay", skill_codes: [skill], topic_codes: ["U9.4"], model_answer: hi.essay, rubric_rows: p.rubric.rows.map((r) => ({ row_id: r.row_id, points: r.max, criterion: r.task_specific, required_elements: [], optional_phrases: [], alt_solutions: [], common_errors: [], requires_row_id: null, requires_both: false, requires_numbers: false, numeric_tolerance: null, units_row: false })) }],
        reference_text: frqReferenceText(p), lit_frq: p } });
  }
  wj("candidates.json", cands); wj("audit.json", audit);
  console.log(`[frq-finalize] 세트 ${cands.length}: 통과 ${cands.filter((c) => c.reviewState === "auto_passed").length}; ${cands.filter((c) => c.reviewState === "rejected").map((c) => `${c.cellId}: ${String(c.rejectionReason).slice(0, 200)}`).join(" || ")}`);
  void LT_FRQ_TYPE_BY_TEMPLATE;
}

// ── 진입점 ─────────────────────────────────────────────────────────
const STAGES: Record<string, () => Promise<void> | void> = { gen: genStage, check: checkStage, rebalance: rebalanceStage, solve: solveStage, adv: advStage, judge: judgeStage, panel: panelStage, finalize: finalizeStage, "frq-gen": frqGenStage, "frq-samples": frqSampleStage, "frq-grade": frqGradeStage, "frq-finalize": frqFinalizeStage };
async function main() {
  const hash = require("node:crypto").createHash("sha1").update(fileSetHash(cfg.generatorFiles) + JSON.stringify({ ...cfg, expected: undefined })).digest("hex").slice(0, 12);
  if (has("--plan")) { const s = specsOf(); console.log(JSON.stringify(planSummary(s), null, 1)); for (const x of s) console.log(x.id, x.form, x.era, "|", x.skills.join(","), "|", x.premise); return 0; }
  if (has("--freeze")) { writeFileSync(cfgPath, JSON.stringify({ ...cfg, expected: { hash } }, null, 1)); console.log(`동결 구성 기록: ${path.relative(process.cwd(), cfgPath)} hash=${hash}`); return 0; }
  if (cfg.expected.hash !== hash) { console.error(`ABORT: 동결 구성 해시 불일치 — 유료 호출 전에 중단 (기대 ${cfg.expected.hash}, 실제 ${hash})`); return 2; }
  console.log(`동결 구성 일치 hash=${hash}`); if (has("--check-only")) return 0;
  const only = arg("--stages") ? arg("--stages").split(",") : cfg.stages; const paid = ["gen", "rebalance", "solve", "adv", "judge", "panel", "frq-gen", "frq-samples", "frq-grade"];
  if (!process.env.ANTHROPIC_API_KEY && only.some((s) => paid.includes(s))) { console.error("ANTHROPIC_API_KEY 환경 변수가 필요합니다(파일에 쓰지 않는다)."); return 3; }
  myBaseline(); const t0 = ledgerTotal(); console.log(`시작 누적 $${t0.cumulativeUsd} / 중단선 $${t0.stopLine}; Lit 합계 $${spentMine().toFixed(4)} / ${cfg.myTotalCapUsd}`);
  for (const st of only) { console.log(`── ${st}`); await STAGES[st](); }
  const t1 = ledgerTotal(); console.log(`이번 실행 비용 $${spentRun().toFixed(4)} / 상한 $${cfg.capUsd}; Lit 합계 $${spentMine().toFixed(4)} / ${cfg.myTotalCapUsd}; 누적 $${t1.cumulativeUsd}, 중단선 여유 $${t1.headroomToStopLine}`);
  return 0;
}
if (require.main === module) main().then((c) => process.exit(c)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
