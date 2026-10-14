// AP English Language 생성 파이프라인(2026-10-14). 정답을 코드로 확정할 수 없는 과목이라 다중 독립 풀이 3 + 적대적 검토 + 심판 + 지문 검토 + 결정적 게이트로 정답을 보증한다.
// 동결 구성 방식은 run-frozen.ts 와 같다: --freeze(해시 기록, 유료 호출 없음) → 커밋 → --check-only(해시 대조) → 유료 실행.
//   npx tsx scripts/ap-generation/englang-pipeline.ts --config config/ap-frozen/englang-p1-a.v1.json --freeze|--check-only|--plan
//   npx tsx scripts/ap-generation/englang-pipeline.ts --config <cfg> [--stages gen,check,...]       (키는 프로세스 환경 ANTHROPIC_API_KEY 로만; 파일에 쓰지 않는다)
// 산출: data/ap/sample-2027/<run>/{sets.json, solve.json, adv.json, judge.json, review.json, candidates.json} + <stage>.results.jsonl(원시 응답·비용).
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runBatch, toolInput, estimate, ledger, type BatchReq } from "../mock-exam-generation/batch-lib";
import { fileSetHash } from "../../lib/ap-generation/frozen-config";
import { ledgerTotal } from "./ledger-total";
import { planSets, planSummary } from "../../lib/ap-generation/englang-plan";
import * as P from "../../lib/ap-generation/englang-prompts";
import { balancedKeyPositions, itemViolations, keyConfidence, passageDisplay, passagePlain, placeKey, setItemSpread, setViolations, similarityViolations, keyPositionViolations, type ElItemRaw, type ElSetRaw, type CorpusDoc, type SolverVote } from "../../lib/ap-generation/englang-gates";
import { EL_FRQ_SCHEMA_VERSION, normalizeFrqPayload, frqPassageDisplay, frqTaskText, frqViolations, frqReferenceText, sourceText, type ElFrqPayload, type ElFrqSource, type ElSample } from "../../lib/ap-generation/englang-frq";
import { elTopicFor, EL_THEMES } from "../../lib/ap-generation/subjects/englang";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type ElCfg = {
  version: string; run: string; subject: string; mode: "mc" | "frq"; capUsd: number; hardStopCumulativeUsd: number; myTotalCapUsd: number; stages: string[];
  plan?: { reading?: { sets: number; seed: number; startIndex?: number; perSet?: number }; writing?: { sets: number; seed: number; startIndex?: number; perSet?: number } };
  frqPlan?: { id: string; type: "synthesis" | "rhetorical_analysis" | "argument"; theme: string; seed: number }[];
  models: { gen: string; solvers: string[]; adversary: string; judge: string; review: string; sampleHigh: string; sampleLow: string; graders: string[] };
  effort: string; genEffort?: string; gradeEffort?: string; sampleCands?: number; genModels?: { reading?: string; writing?: string }; corpusExclude?: string[]; syncStages?: string[]; minKeyConfidence: number; generatorFiles: string[]; expected: { hash: string };
};
const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const has = (n: string) => process.argv.includes(n);
const ROOT = path.resolve("data/ap/sample-2027");
const cfgPath = path.resolve(arg("--config"));
const cfg = JSON.parse(readFileSync(cfgPath, "utf-8")) as ElCfg;
const DIR = path.join(ROOT, cfg.run); mkdirSync(DIR, { recursive: true });
const SYS_CACHE = { type: "ephemeral", ttl: "1h" };
const rj = <T,>(f: string, d: T): T => (existsSync(path.join(DIR, f)) ? (JSON.parse(readFileSync(path.join(DIR, f), "utf-8")) as T) : d);
const wj = (f: string, v: unknown) => writeFileSync(path.join(DIR, f), JSON.stringify(v, null, 1));

const think = (model: string, effort: string) => ({ thinking: model.includes("sonnet") ? { type: "between_tools" } : { type: "adaptive" }, output_config: { effort } });
const mk = (id: string, model: string, sys: string, tool: Json, user: string, max: number, force = false, effort = cfg.effort): BatchReq => ({
  custom_id: id, params: { model, ...(force ? {} : think(model, effort)), max_tokens: max, system: [{ type: "text", text: sys, cache_control: SYS_CACHE }], tools: [tool], tool_choice: force ? { type: "tool", name: tool.name } : { type: "auto" }, messages: [{ role: "user", content: user }] } });

// ── 예산 ───────────────────────────────────────────────────────────
const BASE_F = path.join(ROOT, "englang-baseline.json");
const myBaseline = (): number => { if (!existsSync(BASE_F)) writeFileSync(BASE_F, JSON.stringify({ spent: ledger(DIR).spent(), at: new Date().toISOString(), note: "ledger.spent at the start of the English work (2026-10-14); my total cap is cfg.myTotalCapUsd" })); return (JSON.parse(readFileSync(BASE_F, "utf-8")) as { spent: number }).spent; };
const runBase = (): number => { const f = path.join(DIR, "baseline.json"); if (!existsSync(f)) writeFileSync(f, JSON.stringify({ spent: ledger(DIR).spent() })); return (JSON.parse(readFileSync(f, "utf-8")) as { spent: number }).spent; };
const costIn = (dir: string): number => { let c = 0; if (!existsSync(dir)) return 0; for (const f of readdirSync(dir)) if (/\.results\.jsonl$/.test(f)) for (const l of readFileSync(path.join(dir, f), "utf-8").split("\n").filter(Boolean)) { try { const j = JSON.parse(l); if (!j.cached) c += Number(j.cost ?? 0); } catch { /* skip */ } } return c; };
const spentRun = () => costIn(DIR);
const spentMine = () => readdirSync(ROOT).filter((d) => /^englang-/.test(d) && statSync(path.join(ROOT, d)).isDirectory()).reduce((a, d) => a + costIn(path.join(ROOT, d)), 0);
function guard(stage: string, est: number) {
  const t = ledgerTotal();
  const why = spentRun() + est > cfg.capUsd ? `run cap ${cfg.capUsd}` : spentMine() + est > cfg.myTotalCapUsd ? `English total cap ${cfg.myTotalCapUsd}` : t.cumulativeUsd + est >= cfg.hardStopCumulativeUsd ? `cumulative ${t.cumulativeUsd} + est >= hard stop ${cfg.hardStopCumulativeUsd}` : "";
  if (why) throw new Error(`HARD STOP before ${stage}: est $${est.toFixed(3)}; run spent $${spentRun().toFixed(3)} / ${cfg.capUsd}; English spent $${spentMine().toFixed(3)} / ${cfg.myTotalCapUsd}; cumulative $${t.cumulativeUsd}: ${why}`);
  console.log(`[${stage}] ledger before: run $${spentRun().toFixed(4)}, English total $${spentMine().toFixed(4)}, cumulative $${t.cumulativeUsd} (stop line ${t.stopLine}); est this step $${est.toFixed(3)}`);
}
async function call(stage: string, reqs: BatchReq[], estUsd: number): Promise<Map<string, Json | null>> {
  if (!reqs.length) return new Map(); guard(stage, estUsd);
  const sync = cfg.syncStages?.includes(stage) ?? false;
  const run = async (name: string, rs: BatchReq[]) => runBatch({ dir: DIR, name, requests: rs, budgetUsd: ledger(DIR).spent() + Math.max(0, cfg.capUsd - spentRun()), estimateUsd: estUsd * (rs.length / reqs.length), sync, syncConcurrency: Number(process.env.AP_SYNC_CONC ?? 8), pollMs: 20000 });
  const got = await run(stage, reqs); const out = new Map<string, Json | null>();
  for (const r of reqs) out.set(r.custom_id, got.has(r.custom_id) ? (toolInput(got.get(r.custom_id)!) as Json | null) : null);
  const missing = reqs.filter((r) => !out.get(r.custom_id));
  if (missing.length) { // 도구 호출이 없었던 요청은 도구를 강제해 한 번 더(사고 없음).
    console.log(`[${stage}] 도구 호출 없음 ${missing.length}건 → 강제 재요청`);
    const forced = missing.map((r) => ({ custom_id: r.custom_id, params: { ...r.params, thinking: undefined, output_config: undefined, tool_choice: { type: "tool", name: (r.params.tools as Json[])[0].name } } })) as BatchReq[];
    for (const f of forced) { delete (f.params as Json).thinking; delete (f.params as Json).output_config; }
    guard(`${stage}-retry`, estUsd * (missing.length / reqs.length));
    const got2 = await run(`${stage}-retry`, forced);
    for (const r of missing) if (got2.has(r.custom_id)) out.set(r.custom_id, toolInput(got2.get(r.custom_id)!) as Json | null);
  }
  console.log(`[${stage}] 완료: 응답 ${[...out.values()].filter(Boolean).length}/${reqs.length}; run $${spentRun().toFixed(4)}, English total $${spentMine().toFixed(4)}, cumulative $${ledgerTotal().cumulativeUsd}`);
  return out;
}

// ── 파싱 ───────────────────────────────────────────────────────────
const splitSentences = (t: string): string[] => t.split(/(?<=[.!?]["')”’]?)\s+/).map((s) => s.trim()).filter(Boolean);
const ints = (v: unknown): number[] => (Array.isArray(v) ? v.map(Number).filter(Number.isInteger) : []);
function parseSet(spec: P.SetSpec, inp: Json): ElSetRaw | null {
  if (!inp || !Array.isArray(inp.paragraphs) || !Array.isArray(inp.items)) return null;
  const paragraphs: string[][] = inp.paragraphs.map((p: unknown) => (Array.isArray(p) ? p.map(String) : splitSentences(String(p)))).filter((p: string[]) => p.length);
  const items: ElItemRaw[] = inp.items.map((it: Json) => ({
    skill: String(it.skill ?? ""), topic: it.topic ? String(it.topic) : undefined, cognitive: String(it.cognitive ?? ""), stem: String(it.stem ?? ""),
    options: (Array.isArray(it.options) ? it.options : []).map((o: Json) => ({ text: String(o?.text ?? ""), is_key: o?.is_key === true, label: String(o?.label ?? ""), why: String(o?.why ?? "") })),
    evidence_sentence_ids: ints(it.evidence_sentence_ids), devices_used: Array.isArray(it.devices_used) ? it.devices_used.map(String) : [], est_seconds: Number(it.est_seconds ?? 75),
  }));
  return { kind: spec.kind, blueprint: inp.blueprint ?? {}, provenance: { kind: inp.provenance?.kind ?? "original", author_alias: String(inp.provenance?.author_alias ?? ""), year_alias: inp.provenance?.year_alias ?? "", venue_alias: inp.provenance?.venue_alias, note: inp.provenance?.note }, title: String(inp.title ?? ""), paragraphs, items };
}

// ── 코퍼스(내 이전 지문·소스·샘플) ──────────────────────────────────
function corpus(excludeRun: string): CorpusDoc[] {
  const docs: CorpusDoc[] = [];
  for (const d of existsSync(ROOT) ? readdirSync(ROOT).filter((x) => /^(englang|el)-/.test(x) && x !== excludeRun && !(cfg.corpusExclude ?? []).includes(x) && statSync(path.join(ROOT, x)).isDirectory()) : []) {
    const sf = path.join(ROOT, d, "sets.json"); if (existsSync(sf)) for (const s of JSON.parse(readFileSync(sf, "utf-8")) as { spec: P.SetSpec; set: ElSetRaw | null }[]) if (s.set) docs.push({ id: `${d}:${s.spec.id}`, text: passagePlain(s.set) });
    const ff = path.join(ROOT, d, "frq.json"); if (existsSync(ff)) for (const f of JSON.parse(readFileSync(ff, "utf-8")) as { id: string; payload: ElFrqPayload | null }[]) if (f.payload) docs.push({ id: `${d}:${f.id}`, text: f.payload.sources.map(sourceText).join("\n\n") });
  }
  return docs;
}

// ── 단계: plan ─────────────────────────────────────────────────────
function specsOf(): P.SetSpec[] {
  const used = new Set<string>(); const out: P.SetSpec[] = [];
  const f = path.join(ROOT); for (const d of existsSync(f) ? readdirSync(f).filter((x) => /^(englang|el)-/.test(x) && x !== cfg.run && !(cfg.corpusExclude ?? []).includes(x) && statSync(path.join(f, x)).isDirectory()) : []) { const sf = path.join(f, d, "sets.json"); if (existsSync(sf)) for (const s of JSON.parse(readFileSync(sf, "utf-8")) as { spec: P.SetSpec }[]) used.add(s.spec.theme); }
  for (const k of ["reading", "writing"] as const) { const p = cfg.plan?.[k]; if (p?.sets) { const part = planSets({ kind: k, sets: p.sets, perSet: p.perSet, seed: p.seed, startIndex: p.startIndex, usedThemes: used }); part.forEach((s) => used.add(s.theme)); out.push(...part); } }
  return out;
}

// ── 단계: gen / check ──────────────────────────────────────────────
async function genStage() {
  const specs = specsOf(); wj("plan.json", { specs, summary: planSummary(specs) });
  const reqs = specs.map((s) => mk(`g-${s.id}`, cfg.genModels?.[s.kind] ?? cfg.models.gen, s.kind === "reading" ? P.GEN_READING_SYSTEM : P.GEN_WRITING_SYSTEM, P.setTool, P.genUser(s), 22000, false, cfg.genEffort ?? cfg.effort));
  const est = estimate(cfg.models.gen, reqs.length, 2500, 9000);
  const out = await call("gen", reqs, est); wj("gen.json", Object.fromEntries([...out.entries()]));
}
function checkStage() {
  const specs = rj<{ specs: P.SetSpec[] }>("plan.json", { specs: [] }).specs; const gen = rj<Record<string, Json | null>>("gen.json", {}); const prior = corpus(cfg.run);
  const rows: { spec: P.SetSpec; set: ElSetRaw | null; setViolations: string[]; itemViolations: string[][]; items: Json[] }[] = []; const same: CorpusDoc[] = [];
  const total = specs.reduce((a, s) => a + s.skills.length, 0); const pos = balancedKeyPositions(Math.max(total, 4), 7919 + specs.length); let pi = 0;
  for (const spec of specs) {
    const set = parseSet(spec, gen[`g-${spec.id}`] as Json); if (!set) { rows.push({ spec, set: null, setViolations: ["no_tool_output_or_unparseable"], itemViolations: [], items: [] }); continue; }
    const sv = [...setViolations(set), ...setItemSpread(set.items), ...similarityViolations(passagePlain(set), [...prior, ...same])];
    same.push({ id: `${cfg.run}:${spec.id}`, text: passagePlain(set) });
    if (set.items.length !== spec.skills.length) sv.push(`item_count_${set.items.length}_not_${spec.skills.length}`);
    const iv = set.items.map((it, i) => { const v = itemViolations(set, it); if (it.skill !== spec.skills[i]) v.push("skill_not_as_requested"); return v; });
    const items = set.items.map((it, i) => { const placed = placeKey(it.options, pos[pi++ % pos.length], 31 * (i + 1) + spec.seed); return { ...it, options: placed.options, key_index: placed.key_index, det: iv[i] }; });
    rows.push({ spec, set, setViolations: sv, itemViolations: iv, items });
  }
  wj("sets.json", rows);
  const allKeys = rows.flatMap((r) => r.items.map((i) => i.key_index as number));
  const live = rows.filter((r) => r.set && !r.setViolations.some((x) => !/^(similar_to|key_is_longest)/.test(x) || /^similar_to/.test(x)));
  console.log(`[check] 묶음 ${rows.length}: 지문·묶음 위반 없음 ${rows.filter((r) => r.set && r.setViolations.length === 0).length}, 문항 ${allKeys.length} 중 결정적 위반 없음 ${rows.reduce((a, r) => a + r.itemViolations.filter((v) => v.length === 0).length, 0)}, 키 위치 ${keyPositionViolations(allKeys).join(",") || "균형"} (${[0, 1, 2, 3].map((k) => allKeys.filter((x) => x === k).length).join("/")})`);
  for (const r of rows) console.log(`  ${r.spec.id} [${r.spec.kind}] ${r.set ? `${passagePlain(r.set).split(/\s+/).length}w` : "NO OUTPUT"} set:${r.setViolations.join(",") || "ok"} items:${r.itemViolations.map((v) => (v.length ? v.join("+") : "ok")).join(" | ")}`);
  void live;
}

// ── 단계: solve / adv / judge / review ─────────────────────────────
type CheckRow = { spec: P.SetSpec; set: ElSetRaw | null; setViolations: string[]; itemViolations: string[][]; items: (ElItemRaw & { key_index: number; det: string[] })[] };
const HARD_SET = (v: string) => !/^(key_is_longest|similar_to_)/.test(v) || /^similar_to_/.test(v);
const setAlive = (r: CheckRow) => Boolean(r.set) && !r.setViolations.some(HARD_SET);
const perm = (n: number, k: number): number[] => (k === 0 ? Array.from({ length: n }, (_, i) => i) : k === 1 ? Array.from({ length: n }, (_, i) => n - 1 - i) : Array.from({ length: n }, (_, i) => (i + 1) % n));
async function solveStage() {
  const rows = rj<CheckRow[]>("sets.json", []); const reqs: BatchReq[] = []; const meta: { id: string; setId: string; k: number; idx: number[] }[] = [];
  for (const r of rows) {
    if (!setAlive(r)) continue; const idx = r.items.map((_, i) => i).filter((i) => r.items[i].det.length === 0); if (!idx.length) continue;
    cfg.models.solvers.forEach((model, k) => {
      const shown = idx.map((i) => ({ stem: r.items[i].stem, options: perm(4, k).map((j) => r.items[i].options[j].text) }));
      reqs.push(mk(`v${k}-${r.spec.id}-${idx.join("")}`, model, P.SOLVER_SYSTEMS[k], P.SOLVER_TOOL, P.solverUser(passageDisplay(r.set!), shown), 4000)); meta.push({ id: `v${k}-${r.spec.id}-${idx.join("")}`, setId: r.spec.id, k, idx });
    });
  }
  const est = cfg.models.solvers.reduce((a, m) => a + estimate(m, reqs.length / 3, 1800, 1800), 0);
  const out = await call("solve", reqs, est); const votes: Record<string, (SolverVote | null)[][]> = {};
  for (const m of meta) {
    const row = rows.find((r) => r.spec.id === m.setId)!; const arr = (votes[m.setId] ??= row.items.map(() => [null, null, null] as (SolverVote | null)[]));
    const ans = (out.get(m.id)?.answers ?? []) as Json[]; const p = perm(4, m.k);
    for (const a of ans) { const qi = Number(a.question) - 1; const itemIdx = m.idx[qi]; if (itemIdx === undefined) continue; const shownChoice = Number(a.choice); const also = a.also_defensible === null || a.also_defensible === undefined ? null : p[Number(a.also_defensible)]; arr[itemIdx][m.k] = { choice: Number.isInteger(shownChoice) && shownChoice >= 0 && shownChoice < 4 ? p[shownChoice] : null, confidence: String(a.confidence ?? "likely"), also_defensible: also === undefined ? null : also }; }
  }
  wj("solve.json", votes);
  let a3 = 0, tot = 0; for (const r of rows) r.items.forEach((it, i) => { const v = votes[r.spec.id]?.[i]; if (!v) return; tot++; if (v.every((x) => x && x.choice === it.key_index)) a3++; }); console.log(`[solve] 3/3 일치 ${a3}/${tot}`);
}
const solved = (votes: Record<string, (SolverVote | null)[][]>, r: CheckRow, i: number) => { const v = votes[r.spec.id]?.[i]; return Boolean(v) && v!.every((x) => x && x.choice === r.items[i].key_index);};
async function advStage() {
  const rows = rj<CheckRow[]>("sets.json", []); const votes = rj<Record<string, (SolverVote | null)[][]>>("solve.json", {}); const reqs: BatchReq[] = []; const meta: { id: string; setId: string; idx: number[] }[] = [];
  for (const r of rows) {
    if (!setAlive(r)) continue; const idx = r.items.map((_, i) => i).filter((i) => solved(votes, r, i)); if (!idx.length) continue;
    const items = idx.map((i) => ({ stem: r.items[i].stem, options: r.items[i].options.map((o) => o.text), key: r.items[i].key_index, why: r.items[i].options[r.items[i].key_index].why }));
    reqs.push(mk(`a-${r.spec.id}-${idx.join("")}`, cfg.models.adversary, P.ADV_SYSTEM, P.ADV_TOOL, P.advUser(passageDisplay(r.set!), items), 6000)); meta.push({ id: `a-${r.spec.id}-${idx.join("")}`, setId: r.spec.id, idx });
  }
  const out = await call("adv", reqs, estimate(cfg.models.adversary, reqs.length, 2500, 2500));
  const adv: Record<string, (Json | null)[]> = {};
  for (const m of meta) { const row = rows.find((r) => r.spec.id === m.setId)!; const arr = (adv[m.setId] ??= row.items.map(() => null)); for (const c of (out.get(m.id)?.challenges ?? []) as Json[]) { const ii = m.idx[Number(c.question) - 1]; if (ii !== undefined) arr[ii] = c; } }
  wj("adv.json", adv);
  // 지문 검토(Sonnet): 후보 문항이 남은 묶음만.
  const rev = rows.filter((r) => setAlive(r) && (adv[r.spec.id] ?? []).some(Boolean)).map((r) => mk(`p-${r.spec.id}`, cfg.models.review, P.REVIEW_SYSTEM, P.REVIEW_TOOL, P.reviewUser(passageDisplay(r.set!), r.set!.blueprint), 3000));
  const ro = await call("review", rev, estimate(cfg.models.review, rev.length, 1800, 700)); wj("review.json", Object.fromEntries([...ro.entries()]));
}
async function judgeStage() {
  const rows = rj<CheckRow[]>("sets.json", []); const adv = rj<Record<string, (Json | null)[]>>("adv.json", {}); const reqs: BatchReq[] = []; const meta: { id: string; setId: string; idx: number[] }[] = [];
  for (const r of rows) {
    const idx = r.items.map((_, i) => i).filter((i) => adv[r.spec.id]?.[i]); if (!idx.length) continue;
    const items = idx.map((i) => { const a = adv[r.spec.id][i]!; return { stem: r.items[i].stem, options: r.items[i].options.map((o) => o.text), key: r.items[i].key_index, alt: Number.isInteger(a.alt_index) ? (a.alt_index as number) : null, argument: String(a.argument ?? "") }; });
    reqs.push(mk(`j-${r.spec.id}-${idx.join("")}`, cfg.models.judge, P.JUDGE_SYSTEM, P.JUDGE_TOOL, P.judgeUser(passageDisplay(r.set!), items), 4000)); meta.push({ id: `j-${r.spec.id}-${idx.join("")}`, setId: r.spec.id, idx });
  }
  const out = await call("judge", reqs, estimate(cfg.models.judge, reqs.length, 2800, 1500)); const jd: Record<string, (Json | null)[]> = {};
  for (const m of meta) { const row = rows.find((r) => r.spec.id === m.setId)!; const arr = (jd[m.setId] ??= row.items.map(() => null)); for (const v of (out.get(m.id)?.verdicts ?? []) as Json[]) { const ii = m.idx[Number(v.question) - 1]; if (ii !== undefined) arr[ii] = v; } }
  wj("judge.json", jd);
}

// ── 단계: finalize(MC) ─────────────────────────────────────────────
const unitOfTopic = (t: string) => (/^U(\d+)\./.exec(t)?.[1] ?? "");
function explanationOf(it: ElItemRaw & { key_index: number }): string {
  const key = it.options[it.key_index]; const lines = [`The correct answer is "${key.text}". ${key.why.trim()}`];
  it.options.forEach((o, i) => { if (i !== it.key_index) lines.push(`"${o.text}" is incorrect: ${o.why.trim()}`); });
  return lines.join("\n");
}
function finalizeStage() {
  const rows = rj<CheckRow[]>("sets.json", []); const votes = rj<Record<string, (SolverVote | null)[][]>>("solve.json", {}); const adv = rj<Record<string, (Json | null)[]>>("adv.json", {}); const jd = rj<Record<string, (Json | null)[]>>("judge.json", {}); const rv = rj<Record<string, Json | null>>("review.json", {});
  const cands: Json[] = []; const audit: Json[] = [];
  for (const r of rows) {
    const reviewOut = rv[`p-${r.spec.id}`]; const reviewBad = reviewOut ? Boolean(reviewOut.resembles_known_text) || Boolean(reviewOut.real_world_error) || !reviewOut.ok : true;
    const kept: { it: (typeof r.items)[number]; kc: ReturnType<typeof keyConfidence>; adv: Json | null; judge: Json | null }[] = []; const excluded: Json[] = [];
    r.items.forEach((it, i) => {
      const v = (votes[r.spec.id]?.[i] ?? []).filter(Boolean) as SolverVote[]; const a = adv[r.spec.id]?.[i] ?? null; const j = jd[r.spec.id]?.[i] ?? null;
      const kc = keyConfidence({ keyIndex: it.key_index, votes: v.length === cfg.models.solvers.length ? v : [], adversary: a ? { defensibility: a.defensibility, alt_index: a.alt_index } : null, judge: j ? { verdict: j.verdict } : null, detViolations: [...it.det, ...(a?.key_flaw ? [`adversary_key_flaw`] : []), ...(a?.stem_issue ? ["adversary_stem_issue"] : [])], minScore: cfg.minKeyConfidence });
      audit.push({ set: r.spec.id, i, skill: it.skill, det: it.det, solverAgree: kc.solverAgreement, adversary: a?.defensibility ?? null, judge: j?.verdict ?? null, score: kc.score, pass: kc.pass && setAlive(r) && !reviewBad, reasons: kc.reasons });
      if (kc.pass && setAlive(r) && !reviewBad) kept.push({ it, kc, adv: a, judge: j }); else excluded.push({ index: i, skill: it.skill, reasons: [...kc.reasons, ...(setAlive(r) ? [] : ["set_gate_failed"]), ...(reviewBad ? ["passage_review"] : [])] });
    });
    const base = { cellId: `ap_english_language-${r.spec.id}`, apSubjectCode: "ap_english_language", kind: "mc" as const, calculator: "na", reserve: false, wording: "generated" };
    if (!r.set || kept.length < 3) { cands.push({ ...base, candidateKey: `ap_english_language-${r.spec.id}-k0`, keywordCode: elTopicFor(r.spec.skills[0]), unitCode: unitOfTopic(elTopicFor(r.spec.skills[0])), skillPrimary: r.spec.skills[0], structure: "shared_stimulus_set", archetype: `el_${r.spec.kind}_${r.spec.id}`, reviewState: "rejected", rejectionReason: `${r.setViolations.join("; ") || (reviewBad ? "passage_review" : "fewer_than_3_items_passed")}; excluded=${JSON.stringify(excluded)}`.slice(0, 1500), difficultyProvisional: null, payload: { archetype: `el_${r.spec.kind}_${r.spec.id}`, spec: r.spec, excluded_items: excluded } }); continue; }
    const display = passageDisplay(r.set); const first = kept[0].it;
    const items = kept.map(({ it, kc, adv: a, judge: j }) => ({
      archetype: `el_${r.spec.kind}_${it.skill.replace(".", "")}`, topic: it.topic || elTopicFor(it.skill), skill: it.skill, cognitive: it.cognitive, stem: it.stem,
      options: it.options.map((o) => ({ text: o.text, why: o.why, value: null, label: o.label })), key_index: it.key_index, explanation_en: explanationOf(it), est_seconds: it.est_seconds ?? 75,
      evidence_sentence_ids: it.evidence_sentence_ids, devices_used: it.devices_used ?? [],
      key_confidence: { score: kc.score, band: kc.band, solver_agreement: kc.solverAgreement, adversary: a?.defensibility ?? null, judge: j?.verdict ?? null, solver_votes: (votes[r.spec.id]?.[r.items.indexOf(it)] ?? []).map((x) => x && { choice: x.choice, confidence: x.confidence }) },
    }));
    const diff = items.map((it) => ({ label: it.cognitive === "identify" && it.key_confidence.adversary === "none" ? "basic_learning" : it.cognitive === "evaluate" && it.key_confidence.adversary === "weak" ? "advanced_supplement" : "exam_prep" }));
    cands.push({ ...base, candidateKey: `ap_english_language-${r.spec.id}-k0`, keywordCode: items[0].topic, unitCode: unitOfTopic(items[0].topic), skillPrimary: first.skill, structure: "shared_stimulus_set", archetype: `el_${r.spec.kind}_${r.spec.id}`, reviewState: "auto_passed", rejectionReason: null, difficultyProvisional: "exam_prep", difficulty: diff,
      payload: { archetype: `el_${r.spec.kind}_${r.spec.id}`, topic: items[0].topic, skill: first.skill, calculator: "na", set_intro: display, el_passage: { kind: r.spec.kind, title: r.set.title, paragraphs: r.set.paragraphs, sentence_count: r.set.paragraphs.flat().length }, provenance: r.set.provenance, blueprint: r.set.blueprint, theme: r.spec.theme, genre: r.spec.genre, items, excluded_items: excluded, review: { passage_ok: !reviewBad, issues: reviewOut?.issues ?? [] } } });
  }
  wj("candidates.json", cands); wj("audit.json", audit);
  const itemsGen = audit.length, passed = audit.filter((a) => a.pass).length, agree = audit.filter((a) => a.solverAgree === 1).length;
  const dist = { high: audit.filter((a) => a.pass && a.score >= 0.9).length, medium: audit.filter((a) => a.pass && a.score >= 0.8 && a.score < 0.9).length };
  console.log(`[finalize] 문항 ${itemsGen}: 결정적 통과 ${audit.filter((a) => a.det.length === 0).length}, 풀이 3/3 일치 ${agree}, 최종 통과 ${passed} (첫 통과율 ${((passed / Math.max(1, itemsGen)) * 100).toFixed(1)}%), 키 신뢰도 high ${dist.high}/medium ${dist.medium}; 묶음 통과 ${cands.filter((c) => c.reviewState === "auto_passed").length}/${cands.length}`);
}

// ── FRQ ────────────────────────────────────────────────────────────
const rubricText = (p: ElFrqPayload) => p.rubric.rows.map((r) => `${r.name} (0-${r.max}): ${r.task_specific}\n${Object.entries(r.descriptors).sort().map(([k, v]) => `  ${k}: ${v}`).join("\n")}`).join("\n") + "\n" + p.rubric.scoring_notes.map((n) => `Note: ${n}`).join("\n");
function toFrqPayload(plan: NonNullable<ElCfg["frqPlan"]>[number], inp: Json): ElFrqPayload | null {
  if (!inp?.rubric || !inp?.sources) return null; const tpl = plan.type === "synthesis" ? "q1" : plan.type === "rhetorical_analysis" ? "q2" : "q3";
  const sources: ElFrqSource[] = (inp.sources as Json[]).map((s) => ({ id: String(s.id), kind: s.kind, title: String(s.title ?? ""), attribution: String(s.attribution ?? ""), genre: s.genre, body: s.body, paragraphs: Array.isArray(s.paragraphs) ? s.paragraphs.map((p: unknown) => (Array.isArray(p) ? p.map(String) : splitSentences(String(p)))) : undefined, figure: s.figure, table: s.table, stance: s.stance, provenance: { kind: "original", author_alias: String(s.author_alias ?? ""), year_alias: s.year_alias ?? "" } }));
  const rows = (inp.rubric.rows as Json[]).map((r) => ({ row_id: r.row_id, name: String(r.name), max: Number(r.max), descriptors: Object.fromEntries(Object.entries(r.descriptors ?? {}).map(([k, v]) => [String(k), String(v)])), task_specific: String(r.task_specific ?? "") }));
  return normalizeFrqPayload({ schema_version: EL_FRQ_SCHEMA_VERSION, task_type: plan.type, template: tpl, title: String(inp.title ?? ""), prompt: { scenario: String(inp.prompt?.scenario ?? ""), task: String(inp.prompt?.task ?? ""), requirements: (inp.prompt?.requirements ?? []).map(String) }, sources, rubric: { total_points: 6, rows: rows as never, scoring_notes: (inp.rubric.scoring_notes ?? []).map(String) }, expected_features: { ...(inp.expected_features ?? {}), common_pitfalls: (inp.common_pitfalls ?? []).map(String) }, samples: [], blueprint: { ...(inp.blueprint ?? {}), stances: inp.blueprint?.stances ?? sources.map((s) => s.stance).filter(Boolean) }, provenance: { kind: "original", note: "ALTON original practice material; fictional sources and attributions." } });
}
async function frqGenStage() {
  const plan = cfg.frqPlan ?? []; const sys = { synthesis: P.FRQ_SYNTH_SYSTEM, rhetorical_analysis: P.FRQ_RHET_SYSTEM, argument: P.FRQ_ARG_SYSTEM };
  const reqs = plan.map((p) => mk(`f-${p.id}`, cfg.models.gen, sys[p.type], P.frqTool(), P.frqUser(p.type, p.theme, p.seed), 24000, false, cfg.genEffort ?? cfg.effort));
  const out = await call("frq-gen", reqs, estimate(cfg.models.gen, reqs.length, 2200, 9000));
  wj("frq.json", plan.map((p) => ({ id: p.id, plan: p, payload: toFrqPayload(p, out.get(`f-${p.id}`) as Json) })));
}
async function frqSampleStage() {
  const fr = rj<{ id: string; plan: Json; payload: ElFrqPayload | null }[]>("frq.json", []).map((f) => ({ ...f, payload: f.payload ? normalizeFrqPayload(f.payload) : null })); const reqs: BatchReq[] = [];
  for (const f of fr) { if (!f.payload) continue; const pv = frqViolations(f.payload).filter((x) => !/^sample_|samples_/.test(x)); if (pv.length) { console.log(`[frq-samples] ${f.id}: 과제 위반 ${pv.join(",")} → 샘플 생성 건너뜀`); continue; }
    for (const tier of ["high", "mid", "low"] as const) for (const k of Array.from({ length: cfg.sampleCands ?? 2 }, (_, i) => i)) reqs.push(mk(`s-${f.id}-${tier}-${k}`, tier === "high" ? cfg.models.sampleHigh : cfg.models.sampleLow, P.SAMPLE_SYSTEM(tier), P.SAMPLE_TOOL, P.sampleUser(frqTaskText(f.payload), frqPassageDisplay(f.payload) + (f.payload.sources.find((s) => s.figure) ? `\n\nSource F chart data: ${JSON.stringify(f.payload.sources.find((s) => s.figure)!.figure)}` : ""), rubricText(f.payload)), 6000)); }
  const out = await call("frq-samples", reqs, estimate(cfg.models.sampleHigh, reqs.length, 3200, 1500));
  wj("frq-samples.json", Object.fromEntries([...out.entries()]));
}
async function frqGradeStage() {
  const fr = rj<{ id: string; payload: ElFrqPayload | null }[]>("frq.json", []).map((f) => ({ ...f, payload: f.payload ? normalizeFrqPayload(f.payload) : null })); const samples = rj<Record<string, Json | null>>("frq-samples.json", {}); const reqs: BatchReq[] = [];
  for (const f of fr) { if (!f.payload) continue; for (const tier of ["high", "mid", "low"]) for (const k of Array.from({ length: cfg.sampleCands ?? 2 }, (_, i) => i)) { const s = samples[`s-${f.id}-${tier}-${k}`]; if (!s?.essay) continue; cfg.models.graders.forEach((m, g) => reqs.push(mk(`r${g}-${f.id}-${tier}-${k}`, m, P.GRADE_SYSTEMS[g], P.GRADE_TOOL, P.gradeUser(frqTaskText(f.payload!), frqPassageDisplay(f.payload!), rubricText(f.payload!), String(s.essay)), 2500, false, cfg.gradeEffort ?? cfg.effort))); } }
  const out = await call("frq-grade", reqs, cfg.models.graders.reduce((a, m) => a + estimate(m, reqs.length / 3, 3600, 700), 0)); wj("frq-grades.json", Object.fromEntries([...out.entries()]));
}
const median = (a: number[]) => { const s = a.slice().sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2); };
const TARGET = { high: 6, mid: 4, low: 2 } as const;
function frqFinalizeStage() {
  const fr = rj<{ id: string; plan: Json; payload: ElFrqPayload | null }[]>("frq.json", []).map((f) => ({ ...f, payload: f.payload ? normalizeFrqPayload(f.payload) : null })); const samples = rj<Record<string, Json | null>>("frq-samples.json", {}); const grades = rj<Record<string, Json | null>>("frq-grades.json", {}); const cands: Json[] = []; const audit: Json[] = [];
  const prior = corpus(cfg.run);
  for (const f of fr) {
    const base = { cellId: `ap_english_language-${f.id}`, apSubjectCode: "ap_english_language", kind: "frq_bundle" as const, calculator: "na", reserve: false, wording: "generated", candidateKey: `ap_english_language-${f.id}-k0` };
    if (!f.payload) { cands.push({ ...base, keywordCode: "U9.3", unitCode: "9", skillPrimary: "3.B", structure: "frq_multipart", archetype: `elfrq_${f.id}`, reviewState: "rejected", rejectionReason: "no_tool_output", difficultyProvisional: null, payload: { archetype: `elfrq_${f.id}` } }); continue; }
    const p = f.payload; const chosen: ElSample[] = []; const why: string[] = [];
    for (const tier of ["high", "mid", "low"] as const) {
      const options = Array.from({ length: cfg.sampleCands ?? 2 }, (_, i) => i).map((k) => { const s = samples[`s-${f.id}-${tier}-${k}`]; if (!s?.essay) return null; const gs = cfg.models.graders.map((_, g) => grades[`r${g}-${f.id}-${tier}-${k}`]).filter(Boolean) as Json[]; if (gs.length < cfg.models.graders.length) return null;
        const sc = { A: median(gs.map((x) => Number(x.A))), B: median(gs.map((x) => Number(x.B))), C: median(gs.map((x) => Number(x.C))) }; const tot = sc.A + sc.B + sc.C; const totals = gs.map((x) => Number(x.A) + Number(x.B) + Number(x.C)); const spread = Math.max(...totals) - Math.min(...totals);
        return { k, s, sc, tot, spread, dist: Math.abs(tot - TARGET[tier]) }; }).filter(Boolean) as { k: number; s: Json; sc: { A: number; B: number; C: number }; tot: number; spread: number; dist: number }[];
      const ok = options.filter((o) => o.dist <= 1 && o.spread <= 2).sort((a, b) => a.dist - b.dist || a.spread - b.spread)[0];
      audit.push({ id: f.id, tier, options: options.map((o) => ({ k: o.k, total: o.tot, spread: o.spread })), chosen: ok?.k ?? null });
      if (!ok) { why.push(`sample_${tier}_no_consistent_candidate`); continue; }
      const text = String(ok.s.essay).trim(); chosen.push({ tier, target_total: ok.tot, essay: text, word_count: (text.match(/\S+/g) ?? []).length, rubric_scores: { ...ok.sc, total: ok.tot }, annotations: ((ok.s.annotations as Json[]) ?? []).map((a) => ({ quote: String(a.quote), comment: String(a.comment), row_id: a.row_id })) });
    }
    p.samples = chosen; const v = [...frqViolations(p, prior), ...why];
    if (v.length) { cands.push({ ...base, keywordCode: "U9.3", unitCode: "9", skillPrimary: "3.B", structure: "frq_multipart", archetype: `elfrq_${f.id}`, reviewState: "rejected", rejectionReason: v.join("; ").slice(0, 1500), difficultyProvisional: null, payload: { archetype: `elfrq_${f.id}`, el_frq: p } }); continue; }
    const fig = p.sources.find((s) => s.figure)?.figure; const skill = p.task_type === "synthesis" ? "4.B" : p.task_type === "rhetorical_analysis" ? "7.A" : "6.A";
    const hi = p.samples.find((s) => s.tier === "high")!;
    cands.push({ ...base, keywordCode: "U9.3", unitCode: "9", skillPrimary: skill, structure: "frq_multipart", archetype: `elfrq_${f.id}`, reviewState: "auto_passed", rejectionReason: null, difficultyProvisional: "exam_prep",
      payload: { archetype: `elfrq_${f.id}`, template: p.template, topic: "U9.3", extra_topics: [], skill, representative_skill: skill, calculator: "na", title: p.title, set_intro: frqPassageDisplay(p),
        ...(fig ? { stimulus: { kind: "stat_chart", description: fig.description, data: { chart: "bar", title: fig.title, data: { categories: fig.categories, series: fig.series, ...(fig.xTitle ? { xTitle: fig.xTitle } : {}), ...(fig.yTitle ? { yTitle: fig.yTitle } : {}) } } } } : {}),
        parts: [{ label: "A", prompt: frqTaskText(p), points: 6, response_mode: "essay", skill_codes: [skill], topic_codes: ["U9.3"], model_answer: hi.essay, rubric_rows: p.rubric.rows.map((r) => ({ row_id: r.row_id, points: r.max, criterion: r.task_specific, required_elements: [], optional_phrases: [], alt_solutions: [], common_errors: [], requires_row_id: null, requires_both: false, requires_numbers: false, numeric_tolerance: null, units_row: false })) }],
        reference_text: frqReferenceText(p), el_frq: p } });
  }
  wj("candidates.json", cands); wj("audit.json", audit);
  console.log(`[frq-finalize] 세트 ${cands.length}: 통과 ${cands.filter((c) => c.reviewState === "auto_passed").length}; ${cands.filter((c) => c.reviewState === "rejected").map((c) => `${c.cellId}: ${String(c.rejectionReason).slice(0, 160)}`).join(" || ")}`);
}

// ── 진입점 ─────────────────────────────────────────────────────────
const STAGES: Record<string, () => Promise<void> | void> = { gen: genStage, check: checkStage, solve: solveStage, adv: advStage, judge: judgeStage, finalize: finalizeStage, "frq-gen": frqGenStage, "frq-samples": frqSampleStage, "frq-grade": frqGradeStage, "frq-finalize": frqFinalizeStage };
async function main() {
  const hash = require("node:crypto").createHash("sha1").update(fileSetHash(cfg.generatorFiles) + JSON.stringify({ ...cfg, expected: undefined })).digest("hex").slice(0, 12);
  if (has("--plan")) { const s = specsOf(); console.log(JSON.stringify(planSummary(s), null, 1)); for (const x of s) console.log(x.id, x.kind, x.skills.join(","), "|", x.genre, "|", x.theme); console.log(`지문 주제 풀 ${EL_THEMES.length}`); return 0; }
  if (has("--freeze")) { writeFileSync(cfgPath, JSON.stringify({ ...cfg, expected: { hash } }, null, 1)); console.log(`동결 구성 기록: ${path.relative(process.cwd(), cfgPath)} hash=${hash}`); return 0; }
  if (cfg.expected.hash !== hash) { console.error(`ABORT: 동결 구성 해시 불일치 — 유료 호출 전에 중단 (기대 ${cfg.expected.hash}, 실제 ${hash})`); return 2; }
  console.log(`동결 구성 일치 hash=${hash}`); if (has("--check-only")) return 0;
  if (!process.env.ANTHROPIC_API_KEY && cfg.stages.some((s) => ["gen", "solve", "adv", "judge", "frq-gen", "frq-samples", "frq-grade"].includes(s))) { console.error("ANTHROPIC_API_KEY 환경 변수가 필요합니다(파일에 쓰지 않는다)."); return 3; }
  myBaseline(); runBase();
  const only = arg("--stages") ? arg("--stages").split(",") : cfg.stages;
  const t0 = ledgerTotal(); console.log(`시작 누적 $${t0.cumulativeUsd} / 중단선 $${t0.stopLine}; English 합계 $${spentMine().toFixed(4)} / ${cfg.myTotalCapUsd}`);
  for (const st of only) { console.log(`── ${st}`); await STAGES[st](); }
  const t1 = ledgerTotal(); console.log(`이번 실행 비용 $${spentRun().toFixed(4)} / 상한 $${cfg.capUsd}; English 합계 $${spentMine().toFixed(4)} / ${cfg.myTotalCapUsd}; 누적 $${t1.cumulativeUsd}, 중단선 여유 $${t1.headroomToStopLine}`);
  return 0;
}
if (require.main === module) main().then((c) => process.exit(c)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
