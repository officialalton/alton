// AP World History: Modern 생성 파이프라인(2026-10-15) — 실제 자료 우선(오너 정책): 자료·출처는 레지스트리에서 고정, 모델은 그 자료에서 문항·정답·오답 근거를 설계한다.
// MC: gen(세트당 n+2 문항, 이미지는 첨부) → check(결정적 게이트·키 위치) → balance → solve(블라인드 풀이 2) → panel(Fable 풀이+사실 점검, 이미지 첨부) → finalize(통과 문항 선택·재고 기록)
// FRQ: frq-gen → frq-fact(Fable) → frq-samples(3단계) → frq-grade(독립 채점 2) → frq-fact2(샘플 사실 점검) → frq-finalize
// 동결 구성: --freeze(해시 기록, 유료 호출 없음) → 커밋 → --check-only(해시 대조) → 유료 실행.
//   npx tsx scripts/ap-generation/wh-pipeline.ts --config config/ap-frozen/wh-p1.v1.json --freeze|--check-only|--plan|--dry
//   npx tsx scripts/ap-generation/wh-pipeline.ts --config <cfg> [--stages gen,check,...]   (키는 프로세스 환경 ANTHROPIC_API_KEY 로만; 파일에 쓰지 않는다)
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runBatch, toolInput, estimate, ledger, type BatchReq } from "../mock-exam-generation/batch-lib";
import { fileSetHash } from "../../lib/ap-generation/frozen-config";
import { ledgerTotal } from "./ledger-total";
import * as P from "../../lib/ap-generation/wh-prompts";
import { balancedKeyPositions, placeKey, keyPositionViolations, quoteInPassage, type SolverVote } from "../../lib/ap-generation/englang-gates";
import { WH_FRQS, WH_SETS, whPlanSummary, type WhFrqSpec, type WhSetSpec } from "../../lib/ap-generation/wh-plan";
import { WH_UNITS } from "../../lib/ap-generation/subjects/worldhistory";
import { realSetIntro, whItemViolations, rawItemOf, isImage, type WhRegistrySource } from "../../lib/ap-generation/wh-real-gates";
import { WH_FRQ_SCHEMA_VERSION, WH_RUBRIC_ID, WH_RUBRIC_ROWS, WH_SAMPLE_BAND, WH_SAMPLE_TARGET, taskOf, noDollar, whFrqIntro, whFrqSources, whFrqViolations, whFrqTaskText, REAL_LABEL, type WhFrqPayload, type WhSample } from "../../lib/ap-generation/wh-frq";
import { whRealFrqViolations } from "./wh-real-frq-gates";
import { frqGates, mcGates, mcRecord, frqRecord, registry, type McItem } from "./wh-build";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type WhCfg = {
  version: string; run: string; batch: string; subject: string; mode: "mc" | "frq"; capUsd: number; hardStopCumulativeUsd: number; myTotalCapUsd: number; stages: string[];
  sets?: string[]; frq?: string[]; extra?: number; syncStages?: string[]; sampleCands?: number; resample?: Record<string, string[]>; gate: string;
  models: { gen: string; solvers: string[]; panel: string; sampleHigh: string; sampleLow: string; graders: string[]; fact: string };
  effort: string; genEffort?: string; gradeEffort?: string; generatorFiles: string[]; expected: { hash: string };
};
const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const has = (n: string) => process.argv.includes(n);
const ROOT = path.resolve("data/ap/sample-2027");
const cfgPath = path.resolve(arg("--config"));
const cfg = JSON.parse(readFileSync(cfgPath, "utf-8")) as WhCfg;
const DIR = path.join(ROOT, cfg.run); mkdirSync(DIR, { recursive: true });
const SYS_CACHE = { type: "ephemeral", ttl: "1h" };
const rj = <T,>(f: string, d: T): T => (existsSync(path.join(DIR, f)) ? (JSON.parse(readFileSync(path.join(DIR, f), "utf-8")) as T) : d);
const wj = (f: string, v: unknown) => writeFileSync(path.join(DIR, f), JSON.stringify(v, null, 1));
const think = (model: string, effort: string) => ({ thinking: model.includes("sonnet") ? { type: "between_tools" } : { type: "adaptive" }, output_config: { effort } });
type Content = string | Json[];
const mk = (id: string, model: string, sys: string, tool: Json, user: Content, max: number, force = false, effort = cfg.effort): BatchReq => ({
  custom_id: id, params: { model, ...(force ? {} : think(model, effort)), max_tokens: max, system: [{ type: "text", text: sys, cache_control: SYS_CACHE }], tools: [tool], tool_choice: force ? { type: "tool", name: tool.name } : { type: "auto" }, messages: [{ role: "user", content: user }] } });
const REG = registry();
const imageBlock = (s: WhRegistrySource): Json => ({ type: "image", source: { type: "base64", media_type: s.public_path!.endsWith(".png") ? "image/png" : "image/jpeg", data: readFileSync(path.join("public", s.public_path!)).toString("base64") } });
/** 이미지 자료가 있으면 이미지 블록 + 텍스트, 없으면 문자열. */
const withImages = (refs: { id: string }[], text: string): Content => { const imgs = refs.map((r) => REG.get(r.id)!).filter(isImage); return imgs.length ? [...imgs.map(imageBlock), { type: "text", text }] : text; };
const imageNote = (refs: { id: string }[]) => refs.map((r, i) => ({ s: REG.get(r.id)!, i })).filter((x) => isImage(x.s)).map((x) => `\n\nIMAGE ${refs.length > 1 ? `(${x.i + 1}) ` : ""}DESCRIPTION (the image itself is attached): ${x.s.alt}`).join("");
const notesOf = (refs: { id: string }[]) => refs.map((r) => { const s = REG.get(r.id)!; return `- ${s.title}: ${s.notes ?? ""}`; }).join("\n");

// ── 예산 ───────────────────────────────────────────────────────────
const BASE_F = path.join(ROOT, "whap-baseline.json");
const myBaseline = (): number => { if (!existsSync(BASE_F)) writeFileSync(BASE_F, JSON.stringify({ spent: ledger(DIR).spent(), at: new Date().toISOString(), note: "ledger.spent at the start of the World History work (2026-10-15); my total cap is cfg.myTotalCapUsd" })); return (JSON.parse(readFileSync(BASE_F, "utf-8")) as { spent: number }).spent; };
const costIn = (dir: string): number => { let c = 0; if (!existsSync(dir)) return 0; for (const f of readdirSync(dir)) if (/\.results\.jsonl$/.test(f)) for (const l of readFileSync(path.join(dir, f), "utf-8").split("\n").filter(Boolean)) { try { const j = JSON.parse(l); if (!j.cached) c += Number(j.cost ?? 0); } catch { /* skip */ } } return c; };
const spentRun = () => costIn(DIR);
const spentMine = () => readdirSync(ROOT).filter((d) => /^wh-/.test(d) && statSync(path.join(ROOT, d)).isDirectory()).reduce((a, d) => a + costIn(path.join(ROOT, d)), 0);
function guard(stage: string, est: number) {
  const t = ledgerTotal();
  const why = spentRun() + est > cfg.capUsd ? `run cap ${cfg.capUsd}` : spentMine() + est > cfg.myTotalCapUsd ? `World History total cap ${cfg.myTotalCapUsd}` : t.cumulativeUsd + est >= cfg.hardStopCumulativeUsd ? `cumulative ${t.cumulativeUsd} + est >= hard stop ${cfg.hardStopCumulativeUsd}` : "";
  if (why) throw new Error(`HARD STOP before ${stage}: est $${est.toFixed(3)}; run spent $${spentRun().toFixed(3)} / ${cfg.capUsd}; World History spent $${spentMine().toFixed(3)} / ${cfg.myTotalCapUsd}; cumulative $${t.cumulativeUsd}: ${why}`);
  console.log(`[${stage}] ledger before: run $${spentRun().toFixed(4)}, World History total $${spentMine().toFixed(4)}, cumulative $${t.cumulativeUsd} (stop line ${t.stopLine}); est this step $${est.toFixed(3)}`);
}
async function call(stage: string, reqs: BatchReq[], estUsd: number): Promise<Map<string, Json | null>> {
  if (!reqs.length) return new Map();
  { const rf = path.join(DIR, `${stage}.results.jsonl`); const done = new Set<string>(); if (existsSync(rf)) for (const l of readFileSync(rf, "utf-8").split("\n").filter(Boolean)) { try { const j = JSON.parse(l); if (j.ok) done.add(j.custom_id); } catch { /* skip */ } } const todo = reqs.filter((r) => !done.has(r.custom_id)).length; estUsd = estUsd * (todo / reqs.length); }
  guard(stage, estUsd);
  if (has("--dry")) { console.log(`[dry] ${stage}: ${reqs.length} requests, est $${estUsd.toFixed(3)}`); return new Map(); }
  const sync = cfg.syncStages?.includes(stage) ?? false;
  const run = async (name: string, rs: BatchReq[]) => runBatch({ dir: DIR, name, requests: rs, budgetUsd: ledger(DIR).spent() + Math.max(0, cfg.capUsd - spentRun()), estimateUsd: estUsd * (rs.length / reqs.length), sync, syncConcurrency: Number(process.env.AP_SYNC_CONC ?? 8), pollMs: 20000 });
  const got = await run(stage, reqs); const out = new Map<string, Json | null>();
  for (const r of reqs) out.set(r.custom_id, got.has(r.custom_id) ? (toolInput(got.get(r.custom_id)!) as Json | null) : null);
  const missing = reqs.filter((r) => !out.get(r.custom_id));
  if (missing.length) {
    console.log(`[${stage}] 도구 호출 없음 ${missing.length}건 → 강제 재요청`);
    const forced = missing.map((r) => { const p = { ...r.params, tool_choice: { type: "tool", name: (r.params.tools as Json[])[0].name } } as Json; delete p.thinking; delete p.output_config; return { custom_id: r.custom_id, params: p } as BatchReq; });
    guard(`${stage}-retry`, estUsd * (missing.length / reqs.length));
    const got2 = await run(`${stage}-retry`, forced);
    for (const r of missing) if (got2.has(r.custom_id)) out.set(r.custom_id, toolInput(got2.get(r.custom_id)!) as Json | null);
  }
  console.log(`[${stage}] 완료: 응답 ${[...out.values()].filter(Boolean).length}/${reqs.length}; run $${spentRun().toFixed(4)}, World History total $${spentMine().toFixed(4)}, cumulative $${ledgerTotal().cumulativeUsd}`);
  return out;
}

// ── 커리큘럼·계획 ───────────────────────────────────────────────────
const curriculum = JSON.parse(readFileSync("data/ap/curriculum-2027/ap_world_history.json", "utf-8")) as { units: { code: string; topics: { code: string; title: string }[] }[] };
const unitTopics = (u: number) => curriculum.units.find((x) => Number(x.code) === u)!.topics;
const allTopicCodes = new Set(curriculum.units.flatMap((u) => u.topics.map((t) => t.code)));
const setsOf = (): WhSetSpec[] => WH_SETS.filter((s) => !cfg.sets || cfg.sets.includes(s.id));
const frqsOf = (): WhFrqSpec[] => WH_FRQS.filter((s) => !cfg.frq || cfg.frq.includes(s.id));

// ── 파싱 ───────────────────────────────────────────────────────────
const unstring = (v: unknown): unknown => { if (typeof v !== "string") return v; const t = v.trim(); if (t.startsWith("{") || t.startsWith("[")) { try { return JSON.parse(t); } catch { return v; } } return v; };
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
type RawItem = { skill: string; topic: string; stem: string; options: { text: string; is_key: boolean; label: string; why: string }[]; facts: string[]; design: { source_fixed_first: boolean; key_evidence_in_source: string; evidence_quote: string }; est_seconds: number };
function parseItems(raw: Json | null): RawItem[] | null {
  if (!raw) return null; const arr = unstring(raw.items) as Json[] | undefined; if (!Array.isArray(arr)) return null;
  return arr.map((it) => { const o = unstring(it.options) as Json[]; const d = (unstring(it.design) ?? {}) as Json; return { skill: String(it.skill ?? ""), topic: String(it.topic ?? ""), stem: String(it.stem ?? ""), options: (Array.isArray(o) ? o : []).map((x) => ({ text: String(x?.text ?? ""), is_key: x?.is_key === true, label: String(x?.label ?? ""), why: String(x?.why ?? "") })), facts: strs(unstring(it.facts)), design: { source_fixed_first: true, key_evidence_in_source: String(d.key_evidence_in_source ?? ""), evidence_quote: String(d.evidence_quote ?? "") }, est_seconds: Number(it.est_seconds ?? 75) }; });
}
const display = (spec: WhSetSpec) => realSetIntro(spec.sources, REG);
type Row = { spec: WhSetSpec; items: (RawItem & { key_index: number; det: string[]; extra: boolean })[]; setViolations: string[] };
const detOf = (spec: WhSetSpec, it: RawItem): string[] => { const v = whItemViolations(spec, REG, rawItemOf(it as never), it.design); if (it.topic && !allTopicCodes.has(it.topic)) v.push(`topic_${it.topic}_not_in_ced`); return [...new Set(v)]; };

// ── gen / check / balance ───────────────────────────────────────────
async function genStage() {
  const specs = setsOf(); wj("plan.json", { specs, summary: whPlanSummary() });
  const extra = cfg.extra ?? 2; const reqs = specs.map((s) => mk(`g-${s.id}`, cfg.models.gen, P.GEN_SYSTEM, P.itemsTool, withImages(s.sources, P.genUser(s, unitTopics(s.unit), display(s) + imageNote(s.sources), notesOf(s.sources), extra)), 16000, false, cfg.genEffort ?? cfg.effort));
  const out = await call("gen", reqs, estimate(cfg.models.gen, reqs.length, 3500, 7500)); if (has("--dry")) return;
  wj("gen.json", Object.fromEntries([...out.entries()]));
}
function checkStage() {
  const specs = rj<{ specs: WhSetSpec[] }>("plan.json", { specs: [] }).specs; const gen = rj<Record<string, Json | null>>("gen.json", {}); const rows: Row[] = [];
  const total = specs.reduce((a, s) => a + s.nItems + (cfg.extra ?? 2), 0); const pos = balancedKeyPositions(Math.max(total, 4), 7919 + specs.length); let pi = 0;
  for (const spec of specs) {
    const items = parseItems(gen[`g-${spec.id}`]); if (!items) { rows.push({ spec, items: [], setViolations: ["no_tool_output_or_unparseable"] }); continue; }
    const sv: string[] = []; if (items.length < spec.nItems) sv.push(`item_count_${items.length}_lt_${spec.nItems}`);
    const stems = items.map((i) => i.stem.toLowerCase().replace(/\s+/g, " ")); if (new Set(stems).size !== stems.length) sv.push("duplicate_stem");
    const out = items.map((it, i) => { const det = detOf(spec, it); if (i < spec.nItems && it.skill !== spec.skills[i]) det.push("skill_not_as_requested"); const placed = placeKey(it.options, pos[pi++ % pos.length], 31 * (i + 1) + spec.seed); return { ...it, options: placed.options, key_index: placed.key_index, det, extra: i >= spec.nItems }; });
    rows.push({ spec, items: out, setViolations: sv });
  }
  wj("sets.json", rows);
  const all = rows.flatMap((r) => r.items); const keys = all.map((i) => i.key_index);
  console.log(`[check] 세트 ${rows.length}: 문항 ${all.length} 중 결정적 위반 없음 ${all.filter((i) => i.det.filter((d) => d !== "skill_not_as_requested").length === 0).length}, 키 위치 ${keyPositionViolations(keys).join(",") || "균형"} (${[0, 1, 2, 3].map((k) => keys.filter((x) => x === k).length).join("/")})`);
  for (const r of rows) console.log(`  ${r.spec.id} u${r.spec.unit} ${r.spec.stim} set:${r.setViolations.join(",") || "ok"} items:${r.items.map((i) => (i.det.length ? i.det.join("+") : "ok")).join(" | ")}`);
}
async function balanceStage() {
  const rows = rj<Row[]>("sets.json", []); const reqs: BatchReq[] = []; const meta: { id: string; r: number; i: number }[] = [];
  rows.forEach((r, ri) => r.items.forEach((it, i) => { const only = it.det.filter((d) => d !== "skill_not_as_requested"); if (only.includes("key_is_longest_option") && only.length === 1) { const id = `b-${r.spec.id}-${i}`; reqs.push(mk(id, cfg.models.sampleLow, P.BALANCE_SYSTEM, P.BALANCE_TOOL, P.balanceUser(it.stem, it.options.map((o) => ({ text: o.text, is_key: o.is_key, why: o.why }))), 1500, true)); meta.push({ id, r: ri, i }); } }));
  const out = await call("balance", reqs, estimate(cfg.models.sampleLow, reqs.length, 700, 400)); if (has("--dry")) return; let fixed = 0;
  for (const m of meta) {
    const o = out.get(m.id); const row = rows[m.r]; const it = row.items[m.i]; const opts = (o?.options ?? []) as Json[]; if (opts.length !== 4) continue;
    const next = it.options.map((old, j) => { const n = opts.find((x) => Number(x.index) === j); return n && !old.is_key ? { ...old, text: String(n.text ?? "").trim() } : old; });
    if (next.some((x) => !x.text) || next.some((x) => /[$\\^_<>{}|~`]/.test(x.text))) continue;
    const cand = { ...it, options: next }; const det = detOf(row.spec, cand); if (!it.extra && cand.skill !== row.spec.skills[m.i]) det.push("skill_not_as_requested"); row.items[m.i] = { ...cand, det }; if (!det.length) fixed++;
  }
  wj("sets.json", rows); console.log(`[balance] 길이 단서 교정 ${fixed}/${meta.length}건 통과`);
}
// ── solve / panel ───────────────────────────────────────────────────
const detClean = (it: Row["items"][number]) => it.det.filter((d) => d !== "skill_not_as_requested").length === 0;
const perm = (n: number, k: number): number[] => (k === 0 ? Array.from({ length: n }, (_, i) => i) : Array.from({ length: n }, (_, i) => n - 1 - i));
const setText = (spec: WhSetSpec) => display(spec) + imageNote(spec.sources);
async function solveStage() {
  const rows = rj<Row[]>("sets.json", []); const reqs: BatchReq[] = []; const meta: { id: string; setId: string; k: number; idx: number[] }[] = [];
  for (const r of rows) {
    if (r.setViolations.length) continue; const idx = r.items.map((_, i) => i).filter((i) => detClean(r.items[i])); if (idx.length < Math.min(3, r.spec.nItems)) continue;
    cfg.models.solvers.forEach((model, k) => { const shown = idx.map((i) => ({ stem: r.items[i].stem, options: perm(4, k).map((j) => r.items[i].options[j].text) })); const id = `v${k}-${r.spec.id}-${idx.join("")}`; reqs.push(mk(id, model, P.SOLVER_SYSTEMS[k], P.SOLVER_TOOL, withImages(r.spec.sources, P.solverUser(setText(r.spec), shown)), 4000)); meta.push({ id, setId: r.spec.id, k, idx }); });
  }
  const est = cfg.models.solvers.reduce((a, m) => a + estimate(m, reqs.length / cfg.models.solvers.length, 3000, 1800), 0);
  const out = await call("solve", reqs, est); if (has("--dry")) return; const votes: Record<string, (SolverVote | null)[][]> = {};
  for (const m of meta) {
    const row = rows.find((r) => r.spec.id === m.setId)!; const arr = (votes[m.setId] ??= row.items.map(() => cfg.models.solvers.map(() => null) as (SolverVote | null)[])); const p = perm(4, m.k);
    for (const a of (out.get(m.id)?.answers ?? []) as Json[]) { const ii = m.idx[Number(a.question) - 1]; if (ii === undefined) continue; const sc = Number(a.choice); const also = a.also_defensible === null || a.also_defensible === undefined ? null : p[Number(a.also_defensible)]; arr[ii][m.k] = { choice: Number.isInteger(sc) && sc >= 0 && sc < 4 ? p[sc] : null, confidence: String(a.confidence ?? "likely"), also_defensible: also === undefined ? null : also }; }
  }
  wj("solve.json", votes);
  let ok = 0, tot = 0; for (const r of rows) r.items.forEach((it, i) => { const v = votes[r.spec.id]?.[i]; if (!v) return; tot++; if (v.every((x) => x && x.choice === it.key_index)) ok++; }); console.log(`[solve] 풀이 ${cfg.models.solvers.length} 전원 일치 ${ok}/${tot}`);
}
const solved = (votes: Record<string, (SolverVote | null)[][]>, r: Row, i: number) => { const v = votes[r.spec.id]?.[i]; return Boolean(v) && v!.every((x) => x && x.choice === r.items[i].key_index); };
async function panelStage() {
  const rows = rj<Row[]>("sets.json", []); const votes = rj<Record<string, (SolverVote | null)[][]>>("solve.json", {}); const reqs: BatchReq[] = []; const meta: { id: string; setId: string; idx: number[] }[] = [];
  for (const r of rows) { if (r.setViolations.length) continue; const idx = r.items.map((_, i) => i).filter((i) => solved(votes, r, i)); if (idx.length < Math.min(3, r.spec.nItems)) continue; const id = `p-${r.spec.id}-${idx.join("")}`; reqs.push(mk(id, cfg.models.panel, P.PANEL_SYSTEM, P.PANEL_TOOL, withImages(r.spec.sources, P.panelUser(setText(r.spec), idx.map((i) => ({ stem: r.items[i].stem, options: r.items[i].options.map((o) => o.text) })))), 5000)); meta.push({ id, setId: r.spec.id, idx }); }
  const out = await call("panel", reqs, estimate(cfg.models.panel, reqs.length, 3300, 1800)); if (has("--dry")) return;
  const res: Record<string, { answers: (Json | null)[]; flags: Json[] }> = {};
  for (const m of meta) { const o = out.get(m.id); const row = rows.find((r) => r.spec.id === m.setId)!; const answers: (Json | null)[] = row.items.map(() => null); const flags: Json[] = []; if (o) { for (const a of (o.answers ?? []) as Json[]) { const ii = m.idx[Number(a.question) - 1]; if (ii !== undefined) answers[ii] = a; } for (const f of (o.flags ?? []) as Json[]) { const mm = /^q(\d)/i.exec(String(f.where)); flags.push({ ...f, item: mm ? m.idx[Number(mm[1]) - 1] ?? null : null }); } } res[m.setId] = { answers, flags }; }
  wj("panel.json", res);
}
// ── finalize(MC) ───────────────────────────────────────────────────
const BAD_FLAG = /^(inaccurate|anachronism|contested|unneutral|misdescribes_source|ambiguous_key|second_defensible)$/;
function finalizeStage() {
  const rows = rj<Row[]>("sets.json", []); const votes = rj<Record<string, (SolverVote | null)[][]>>("solve.json", {}); const panel = rj<Record<string, { answers: (Json | null)[]; flags: Json[] }>>("panel.json", {});
  const recs: Json[] = []; const audit: Json[] = []; const summary: Json[] = [];
  for (const r of rows) {
    const pn = panel[r.spec.id]; const setFlags = (pn?.flags ?? []).filter((f) => f.item === null || f.item === undefined); const setBad = setFlags.filter((f) => BAD_FLAG.test(String(f.kind)));
    const pass: number[] = [];
    r.items.forEach((it, i) => {
      const reasons: string[] = it.det.filter((d) => d !== "skill_not_as_requested"); const v = votes[r.spec.id]?.[i]; const pa = pn?.answers?.[i] ?? null;
      if (!v || !v.every((x) => x && x.choice === it.key_index)) reasons.push("solver_disagreement_or_missing"); else if (v.some((x) => x && x.also_defensible !== null && x.also_defensible !== undefined && x.also_defensible !== it.key_index)) reasons.push("solver_second_defensible");
      if (!pa) reasons.push("panel_missing"); else { if (Number(pa.choice) !== it.key_index) reasons.push("panel_disagrees"); if (pa.also_defensible !== null && pa.also_defensible !== undefined && Number(pa.also_defensible) !== it.key_index) reasons.push("panel_second_defensible"); }
      const mine = (pn?.flags ?? []).filter((f) => f.item === i); if (mine.some((f) => BAD_FLAG.test(String(f.kind)))) reasons.push(`panel_flag_${mine.map((f) => f.kind).join("+")}`);
      if (r.setViolations.length) reasons.push("set_gate_failed");
      audit.push({ set: r.spec.id, i, skill: it.skill, extra: it.extra, reasons, pass: reasons.length === 0, solverAgree: v ? v.filter((x) => x && x.choice === it.key_index).length / v.length : 0, flags: mine.map((f) => `${f.kind}:${String(f.detail).slice(0, 160)}`) });
      if (reasons.length === 0) pass.push(i);
    });
    // 선택: 요청 스킬 순서대로 통과 문항을 고르고, 모자라면 남은 통과 문항(추가 문항 포함)으로 채운다.
    const chosen: number[] = []; for (const sk of r.spec.skills) { const k = pass.find((i) => !chosen.includes(i) && r.items[i].skill === sk); if (k !== undefined) chosen.push(k); }
    for (const i of pass) if (chosen.length < r.spec.nItems && !chosen.includes(i)) chosen.push(i);
    chosen.sort((a, b) => a - b);
    summary.push({ set: r.spec.id, requested: r.spec.nItems, passed: pass.length, chosen: chosen.length, setFlags: setBad.map((f) => `${f.kind}:${String(f.detail).slice(0, 200)}`), setViolations: r.setViolations });
    if (chosen.length < r.spec.nItems || setBad.length || r.setViolations.length) { recs.push({ __rejected: true, specId: r.spec.id, reason: `${chosen.length}/${r.spec.nItems} items; setFlags=${setBad.length}; setViolations=${r.setViolations.join(",")}` }); continue; }
    const items: McItem[] = chosen.map((i) => ({ ...r.items[i], options: r.items[i].options.map((o) => ({ text: o.text, why: o.why, label: o.label })), key_index: r.items[i].key_index, key_confidence: { solver_votes: (votes[r.spec.id]?.[i] ?? []).map((x) => x && { choice: x.choice, confidence: x.confidence }), panel_choice: pn?.answers?.[i]?.choice ?? null } }));
    const rec = mcRecord(cfg.run, cfg.gate, r.spec, items, REG); const gv = mcGates(rec, r.spec, REG);
    if (gv.length) { recs.push({ __rejected: true, specId: r.spec.id, reason: `gates: ${gv.join("; ").slice(0, 500)}` }); continue; }
    Object.assign(rec, { reviewState: "verified_by_independent_models", validation: "auto_passed" }); recs.push(rec);
  }
  const good = recs.filter((x) => !x.__rejected);
  wj("candidates.json", recs); wj("audit.json", audit); wj("summary.json", summary);
  writeFileSync(`data/ap/stock/${cfg.batch}-items.json`, JSON.stringify(good, null, 1)); writeFileSync(`data/ap/stock/${cfg.batch}-pass-keys.json`, JSON.stringify(good.map((r) => r.stockKey), null, 1));
  writeFileSync(`data/ap/stock/${cfg.batch}-summary.json`, JSON.stringify({ run: cfg.run, generatedAt: new Date().toISOString().slice(0, 10), passed: good.map((r) => r.stockKey), rejected: recs.filter((x) => x.__rejected), sets: summary, items: { generated: audit.length, passed: audit.filter((a) => a.pass).length } }, null, 1));
  console.log(`[finalize] 문항 ${audit.length}: 통과 ${audit.filter((a) => a.pass).length}; 세트 통과 ${good.length}/${recs.length}`); for (const x of recs.filter((y) => y.__rejected)) console.log(`  REJECT ${x.specId}: ${x.reason}`);
}

// ── FRQ ────────────────────────────────────────────────────────────
const median = (a: number[]) => { const s = a.slice().sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2); };
const rubricText = (p: WhFrqPayload) => p.rubric.rows.map((r) => `${r.name} (0-${r.max}): ${r.task_specific}\n${Object.entries(r.descriptors).sort().map(([k, v]) => `  ${k}: ${v}`).join("\n")}`).join("\n") + "\n" + p.rubric.scoring_notes.map((n) => `Note: ${n}`).join("\n");
const frqDisplay = (spec: WhFrqSpec) => whFrqIntro(spec, REG) + imageNote(spec.sources);
const frqMaterial = (spec: WhFrqSpec) => (spec.template === "leq" ? "" : frqDisplay(spec));
function toFrqPayload(spec: WhFrqSpec, raw: Json | null): WhFrqPayload | null {
  const inp: Json | null = raw ? Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, unstring(v)])) : raw; if (inp?.rubric && typeof inp.rubric === "object") inp.rubric = Object.fromEntries(Object.entries(inp.rubric as Json).map(([k, v]) => [k, unstring(v)])); if (inp?.expected_features && typeof inp.expected_features === "object") inp.expected_features = Object.fromEntries(Object.entries(inp.expected_features as Json).map(([k, v]) => [k, unstring(v)])); if (inp?.prompt && typeof inp.prompt === "object") inp.prompt = Object.fromEntries(Object.entries(inp.prompt as Json).map(([k, v]) => [k, unstring(v)]));
  if (!inp?.rubric || !inp?.prompt) return null; const task = taskOf(spec.template); const want = WH_RUBRIC_ROWS[task]; const af = inp.expected_features ?? {};
  const rows = want.map((w) => { const r = ((inp.rubric.rows ?? []) as Json[]).find((x) => String(x.row_id).toLowerCase() === w.row_id) ?? {}; return { row_id: w.row_id, name: w.name, max: w.max, descriptors: Object.fromEntries(Object.entries(r.descriptors ?? {}).map(([k, v]) => [String(k), String(v)])), task_specific: String(r.task_specific ?? "") }; });
  const notes = strs(inp.rubric.scoring_notes).filter((n) => !n.includes("not official AP scoring")); notes.push(REAL_LABEL);
  return { schema_version: WH_FRQ_SCHEMA_VERSION, task_type: task, template: spec.template, era: spec.era, units: spec.units, title: String(inp.title ?? ""),
    prompt: { scenario: String(inp.prompt.scenario ?? ""), task: String(inp.prompt.task ?? ""), requirements: strs(inp.prompt.requirements), ...(task === "saq" ? { parts: ((inp.prompt.parts ?? []) as Json[]).map((p) => ({ label: p.label, prompt: String(p.prompt), points: 1 as const })) } : {}) },
    sources: whFrqSources(spec, REG), rubric: { rubric_id: WH_RUBRIC_ID, total_points: want.reduce((a, b) => a + b.max, 0), rows, scoring_notes: notes },
    expected_features: { defensible_theses: strs(af.defensible_theses), contextualization_ideas: strs(af.contextualization_ideas), outside_evidence: strs(af.outside_evidence), reasoning_types: strs(af.reasoning_types), doc_uses: af.doc_uses, evidence_map: Array.isArray(af.evidence_map) ? (af.evidence_map as Json[]).map((l) => ({ line: String(l.line), supports: strs(l.supports), complicates: strs(l.complicates) })) : undefined, saq_answers: af.saq_answers, common_pitfalls: strs(af.common_pitfalls), facts: strs(af.facts) },
    samples: [], provenance: { kind: "alton_authored_from_real_sources", note: "Prompts, rubric text, expected answers and sample responses are ALTON-authored practice material; every source is a real historical document, image or dataset (see sources[].source_registry_id)." } } as WhFrqPayload;
}
const candsFor = (id: string, tier: string): number[] => { const e = (cfg.resample?.[id] ?? []).find((x) => x === tier || x.startsWith(`${tier}:`)); const max = !e ? 1 : e.includes(":") ? Number(e.split(":")[1]) : Math.min(3, cfg.sampleCands ?? 1); return Array.from({ length: Math.min(max, cfg.sampleCands ?? 1) }, (_, k) => k); };
type FrqRow = { id: string; spec: WhFrqSpec; payload: WhFrqPayload | null; fact?: Json[] };
const loadFrq = () => rj<FrqRow[]>("frq.json", []);
async function frqGenStage() {
  const plan = frqsOf(); const sys = { saq: P.FRQ_SAQ_SYSTEM, dbq: P.FRQ_DBQ_SYSTEM, leq: P.FRQ_LEQ_SYSTEM };
  const reqs = plan.map((p) => mk(`f-${p.id}`, cfg.models.gen, sys[taskOf(p.template)], P.frqTool(taskOf(p.template)), withImages(p.sources, P.frqUser(p, frqDisplay(p), notesOf(p.sources))), 20000, false, cfg.genEffort ?? cfg.effort));
  const out = await call("frq-gen", reqs, estimate(cfg.models.gen, reqs.length, 5000, 9000)); if (has("--dry")) return;
  const prev = loadFrq(); wj("frq.json", plan.map((p) => { const payload = toFrqPayload(p, out.get(`f-${p.id}`) as Json); const old = prev.find((x) => x.id === p.id); return { id: p.id, spec: p, payload, fact: old && JSON.stringify(old.payload) === JSON.stringify(payload) ? old.fact : undefined }; }));
}
const sansSample = (x: string) => !/^sample_|samples_|^similar_to/.test(x);
const packText = (r: FrqRow) => `${whFrqTaskText(r.payload!)}\n\n${frqMaterial(r.spec)}\n\nEXPECTED FEATURES\n${JSON.stringify(r.payload!.expected_features)}\n\nRUBRIC TEXT\n${rubricText(r.payload!)}`;
async function frqFactStage() {
  const fr = loadFrq(); const reqs: BatchReq[] = [];
  for (const f of fr) { if (!f.payload) continue; if (f.fact !== undefined && !f.fact.some((x) => x.detail === "not_checked") && !has("--recheck")) continue; const pv = whFrqViolations(f.payload, f.spec, REG).filter(sansSample); if (pv.length) { console.log(`[frq-fact] ${f.id}: 무료 게이트 위반 ${pv.join(",")} → 건너뜀`); continue; } reqs.push(mk(`fa-${f.id}`, cfg.models.fact, P.FACT_SYSTEM, P.FACT_TOOL, withImages(f.spec.sources, P.factUser(packText(f))), 4000)); }
  const out = await call("frq-fact", reqs, estimate(cfg.models.fact, reqs.length, 5000, 1500)); if (has("--dry")) return;
  for (const f of fr) { if (!f.payload || !reqs.some((r) => r.custom_id === `fa-${f.id}`)) { if (f.fact === undefined) f.fact = [{ where: "pack", kind: "other", detail: "not_checked" }]; continue; } const o = out.get(`fa-${f.id}`); f.fact = o ? ((o.flags ?? []) as Json[]) : [{ where: "pack", kind: "other", detail: "not_checked" }]; }
  wj("frq.json", fr); for (const f of fr) console.log(`  ${f.id}: ${(f.fact ?? []).map((x) => `${x.kind}@${x.where}: ${String(x.detail).slice(0, 140)}`).join(" || ") || "clean"}`);
}
const packOk = (f: FrqRow) => Boolean(f.payload) && !whFrqViolations(f.payload!, f.spec, REG).filter(sansSample).length && (f.fact ?? []).every((x) => !BAD_FLAG.test(String(x.kind)) && x.kind !== "inconsistent_with_documents") && f.fact !== undefined && !(f.fact ?? []).some((x) => x.detail === "not_checked");
async function frqSampleStage() {
  const fr = loadFrq().filter(packOk); const reqs: BatchReq[] = [];
  for (const f of fr) { const p = f.payload!; for (const tier of ["high", "mid", "low"] as const) for (const k of candsFor(f.id, tier)) reqs.push(mk(`s-${f.id}-${tier}-${k}`, tier === "high" ? cfg.models.sampleHigh : cfg.models.sampleLow, P.SAMPLE_SYSTEM(p.task_type, tier), P.SAMPLE_TOOL, P.sampleUser(whFrqTaskText(p), frqMaterial(f.spec), rubricText(p)), 6000)); }
  const out = await call("frq-samples", reqs, estimate(cfg.models.sampleHigh, reqs.length, 4200, 2000)); if (has("--dry")) return;
  wj("frq-samples.json", Object.fromEntries([...out.entries()]));
}
async function frqGradeStage() {
  const fr = loadFrq().filter(packOk); const samples = rj<Record<string, Json | null>>("frq-samples.json", {}); const reqs: BatchReq[] = [];
  for (const f of fr) { const p = f.payload!; const rows = WH_RUBRIC_ROWS[p.task_type]; for (const tier of ["high", "mid", "low"]) for (const k of candsFor(f.id, tier)) { const s = samples[`s-${f.id}-${tier}-${k}`]; if (!s?.essay) continue; cfg.models.graders.forEach((m, g) => reqs.push(mk(`r${g}-${f.id}-${tier}-${k}`, m, P.GRADE_SYSTEMS[g % P.GRADE_SYSTEMS.length], P.GRADE_TOOL(rows), P.gradeUser(whFrqTaskText(p), frqMaterial(f.spec), rubricText(p), noDollar(String(s.essay))), 2500, false, cfg.gradeEffort ?? cfg.effort))); } }
  const out = await call("frq-grade", reqs, cfg.models.graders.reduce((a, m) => a + estimate(m, reqs.length / cfg.models.graders.length, 4800, 800), 0)); if (has("--dry")) return;
  wj("frq-grades.json", Object.fromEntries([...out.entries()]));
}
async function frqFact2Stage() {
  const fr = loadFrq().filter(packOk); const samples = rj<Record<string, Json | null>>("frq-samples.json", {}); const reqs: BatchReq[] = [];
  for (const f of fr) for (const tier of ["high", "mid", "low"]) for (const k of candsFor(f.id, tier)) { const s = samples[`s-${f.id}-${tier}-${k}`]; if (s?.essay) reqs.push(mk(`fs-${f.id}-${tier}-${k}`, cfg.models.fact, P.FACT_SYSTEM, P.FACT_TOOL, P.factUser(`Prompt: ${whFrqTaskText(f.payload!)}\n\nSTUDENT SAMPLE RESPONSE (${tier} tier; weaknesses may be vagueness but historical claims should be accurate)\n${s.essay}`), 3000)); }
  const out = await call("frq-fact2", reqs, estimate(cfg.models.fact, reqs.length, 1800, 700)); if (has("--dry")) return;
  wj("frq-fact2.json", Object.fromEntries([...out.entries()]));
}
function frqFinalizeStage() {
  const fr = loadFrq(); const samples = rj<Record<string, Json | null>>("frq-samples.json", {}); const grades = rj<Record<string, Json | null>>("frq-grades.json", {}); const f2 = rj<Record<string, Json | null>>("frq-fact2.json", {}); const recs: Json[] = []; const audit: Json[] = [];
  for (const f of fr) {
    if (!f.payload) { recs.push({ __rejected: true, specId: f.id, reason: "no_tool_output" }); continue; }
    const p = f.payload; const task = p.task_type; const rows = WH_RUBRIC_ROWS[task]; const chosen: WhSample[] = []; const why: string[] = [];
    for (const tier of ["high", "mid", "low"] as const) {
      const opts = candsFor(f.id, tier).map((k) => { const s = samples[`s-${f.id}-${tier}-${k}`]; if (!s?.essay) return null; const gs = cfg.models.graders.map((_, g) => grades[`r${g}-${f.id}-${tier}-${k}`]).filter(Boolean) as Json[]; if (gs.length < cfg.models.graders.length) return null;
        const sc: Record<string, number> = {}; for (const r of rows) sc[r.row_id] = Math.min(r.max, Math.max(0, median(gs.map((x) => Number(x[r.row_id]))))); const tot = Object.values(sc).reduce((a, b) => a + b, 0); const totals = gs.map((x) => rows.reduce((a, r) => a + Number(x[r.row_id] ?? 0), 0)); const spread = Math.max(...totals) - Math.min(...totals);
        const fl = ((f2[`fs-${f.id}-${tier}-${k}`]?.flags ?? []) as Json[]).filter((x) => BAD_FLAG.test(String(x.kind))); return { k, s, sc, tot, spread, dist: Math.abs(tot - WH_SAMPLE_TARGET[task][tier]), flagged: fl.length > 0, fl }; }).filter(Boolean) as { k: number; s: Json; sc: Record<string, number>; tot: number; spread: number; dist: number; flagged: boolean; fl: Json[] }[];
      const ok = opts.filter((o) => o.tot >= WH_SAMPLE_BAND[task][tier][0] && o.tot <= WH_SAMPLE_BAND[task][tier][1] && o.spread <= (task === "saq" ? 1 : 2) && !o.flagged).sort((a, b) => a.dist - b.dist || a.spread - b.spread)[0];
      audit.push({ id: f.id, tier, options: opts.map((o) => ({ k: o.k, total: o.tot, spread: o.spread, flagged: o.flagged, flags: o.fl.map((x) => `${x.kind}:${String(x.detail).slice(0, 120)}`) })), chosen: ok?.k ?? null });
      if (!ok) { why.push(`sample_${tier}_no_consistent_candidate`); continue; }
      const text = noDollar(String(ok.s.essay)).trim();
      chosen.push({ tier, target_total: ok.tot, essay: text, word_count: (text.match(/\S+/g) ?? []).length, rubric_scores: { ...ok.sc, total: ok.tot }, annotations: ((ok.s.annotations as Json[]) ?? []).map((a) => ({ quote: noDollar(String(a.quote)), comment: noDollar(String(a.comment)), row_id: String(a.row_id).toLowerCase() })).filter((a) => quoteInPassage(a.quote, text)) });
    }
    p.samples = chosen; const rec = frqRecord(cfg.run, cfg.gate, f.spec, p, REG); const gv = [...frqGates(rec, f.spec, REG), ...why, ...(f.fact ?? []).filter((x) => BAD_FLAG.test(String(x.kind))).map((x) => `fact_${x.kind}`)];
    if (gv.length) { recs.push({ __rejected: true, specId: f.id, reason: gv.join("; ").slice(0, 900) }); continue; }
    (rec.payload as Json).verification = { fact_checker: cfg.models.fact, graders: cfg.models.graders, fact_flags: f.fact ?? [], sample_totals: Object.fromEntries(chosen.map((s) => [s.tier, s.rubric_scores.total])), bands: WH_SAMPLE_BAND[task] };
    Object.assign(rec, { reviewState: "verified_by_independent_models", validation: "auto_passed" }); recs.push(rec);
  }
  const good = recs.filter((x) => !x.__rejected); wj("candidates.json", recs); wj("audit.json", audit);
  writeFileSync(`data/ap/stock/${cfg.batch}-items.json`, JSON.stringify(good, null, 1)); writeFileSync(`data/ap/stock/${cfg.batch}-pass-keys.json`, JSON.stringify(good.map((r) => r.stockKey), null, 1));
  writeFileSync(`data/ap/stock/${cfg.batch}-summary.json`, JSON.stringify({ run: cfg.run, generatedAt: new Date().toISOString().slice(0, 10), passed: good.map((r) => r.stockKey), rejected: recs.filter((x) => x.__rejected), audit }, null, 1));
  console.log(`[frq-finalize] 세트 ${recs.length}: 통과 ${good.length}`); for (const x of recs.filter((y) => y.__rejected)) console.log(`  REJECT ${x.specId}: ${String(x.reason).slice(0, 400)}`);
}

const STAGES: Record<string, () => Promise<void> | void> = { gen: genStage, check: checkStage, balance: balanceStage, solve: solveStage, panel: panelStage, finalize: finalizeStage, "frq-gen": frqGenStage, "frq-fact": frqFactStage, "frq-samples": frqSampleStage, "frq-grade": frqGradeStage, "frq-fact2": frqFact2Stage, "frq-finalize": frqFinalizeStage };
async function main() {
  const hash = require("node:crypto").createHash("sha1").update(fileSetHash(cfg.generatorFiles) + JSON.stringify({ ...cfg, expected: undefined })).digest("hex").slice(0, 12);
  if (has("--plan")) { console.log(JSON.stringify(whPlanSummary(), null, 1)); for (const x of setsOf()) console.log(x.id, x.exam, `u${x.unit}`, x.stim, x.skills.join(","), "|", x.theme); for (const x of frqsOf()) console.log(x.id, x.template, `era${x.era}`, "|", x.focus); return 0; }
  if (has("--freeze")) { writeFileSync(cfgPath, JSON.stringify({ ...cfg, expected: { hash } }, null, 1)); console.log(`동결 구성 기록: ${path.relative(process.cwd(), cfgPath)} hash=${hash}`); return 0; }
  if (cfg.expected.hash !== hash) { console.error(`ABORT: 동결 구성 해시 불일치 — 유료 호출 전에 중단 (기대 ${cfg.expected.hash}, 실제 ${hash})`); return 2; }
  console.log(`동결 구성 일치 hash=${hash}`); if (has("--check-only")) return 0;
  if (!process.env.ANTHROPIC_API_KEY && !has("--dry") && cfg.stages.some((s) => ["gen", "balance", "solve", "panel", "frq-gen", "frq-fact", "frq-samples", "frq-grade", "frq-fact2"].includes(s))) { console.error("ANTHROPIC_API_KEY 환경 변수가 필요합니다(파일에 쓰지 않는다)."); return 3; }
  myBaseline(); const only = arg("--stages") ? arg("--stages").split(",") : cfg.stages;
  const t0 = ledgerTotal(); console.log(`시작 누적 $${t0.cumulativeUsd} / 중단선 $${t0.stopLine}; World History 합계 $${spentMine().toFixed(4)} / ${cfg.myTotalCapUsd}`);
  for (const st of only) { console.log(`── ${st}`); await STAGES[st](); }
  const t1 = ledgerTotal(); console.log(`이번 실행 비용 $${spentRun().toFixed(4)} / 상한 $${cfg.capUsd}; World History 합계 $${spentMine().toFixed(4)} / ${cfg.myTotalCapUsd}; 누적 $${t1.cumulativeUsd}, 중단선 여유 $${t1.headroomToStopLine}`);
  return 0;
}
void WH_UNITS; void whRealFrqViolations;
if (require.main === module) main().then((c) => process.exit(c)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
