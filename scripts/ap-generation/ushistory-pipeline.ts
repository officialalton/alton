// AP U.S. History 생성 파이프라인(2026-10-14). 정답을 코드로 확정할 수 없는 과목이라: 결정적 게이트(날짜·표 수치·길이 단서·원본성) → 블라인드 독립 풀이 2(Opus·Sonnet) → 제2 모델 패널(Fable: 블라인드 풀이 + 사실 점검) 로 보증한다.
// FRQ(SAQ 3유형·DBQ·LEQ): 생성 → 무료 게이트 → 사실 점검 패널 → 3단계 샘플 → 독립 채점기 행별 중앙값으로 점수 기록 → 샘플 사실 점검 → 확정.
// 동결 구성 방식은 englang-pipeline.ts 와 같다: --freeze(해시 기록, 유료 호출 없음) → 커밋 → --check-only(해시 대조) → 유료 실행.
//   npx tsx scripts/ap-generation/ushistory-pipeline.ts --config config/ap-frozen/ush-p1-a.v1.json --freeze|--check-only|--plan|--dry
//   npx tsx scripts/ap-generation/ushistory-pipeline.ts --config <cfg> [--stages gen,check,...]   (키는 프로세스 환경 ANTHROPIC_API_KEY 로만; 파일에 쓰지 않는다)
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runBatch, toolInput, estimate, ledger, type BatchReq } from "../mock-exam-generation/batch-lib";
import { fileSetHash } from "../../lib/ap-generation/frozen-config";
import { ledgerTotal } from "./ledger-total";
import { planUshSets, planSummaryUsh, type UshSetSpec, type PlanCfg } from "../../lib/ap-generation/ushistory-plan";
import * as P from "../../lib/ap-generation/ushistory-prompts";
import { balancedKeyPositions, placeKey, keyPositionViolations, quoteInPassage, type CorpusDoc, type SolverVote } from "../../lib/ap-generation/englang-gates";
import { itemViolations, setViolations, ushStimulusDisplay, ushPassagePlain, ushSimilarity, tableMarkdown, type UshSetRaw, type UshItemRaw, type UshSource } from "../../lib/ap-generation/ushistory-gates";
import { USH_FRQ_SCHEMA_VERSION, USH_RUBRIC_ID, USH_RUBRIC_ROWS, USH_SAMPLE_BAND, USH_SAMPLE_TARGET, taskOf, frqPassageDisplay, frqTaskText, frqViolations, frqReferenceText, sourcesText, noDollar, type UshFrqPayload, type UshSample } from "../../lib/ap-generation/ushistory-frq";
import { USH_PERIODS } from "../../lib/ap-generation/subjects/ushistory";
import { ushUnitOfTopic } from "../../lib/ap-exam/ush-rules";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type UshCfg = {
  version: string; run: string; subject: string; mode: "mc" | "frq"; capUsd: number; hardStopCumulativeUsd: number; myTotalCapUsd: number; stages: string[];
  plan?: PlanCfg; frqPlan?: P.FrqSpec[]; syncStages?: string[]; sampleCands?: number; /** 보충 후보(k≥1)를 만들 세트·단계 */ resample?: Record<string, string[]>; corpusExclude?: string[]; minPanelAgree?: number;
  models: { gen: string; solvers: string[]; panel: string; sampleHigh: string; sampleLow: string; graders: string[]; fact: string };
  effort: string; genEffort?: string; gradeEffort?: string; generatorFiles: string[]; expected: { hash: string };
};
const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const has = (n: string) => process.argv.includes(n);
const ROOT = path.resolve("data/ap/sample-2027");
const cfgPath = path.resolve(arg("--config"));
const cfg = JSON.parse(readFileSync(cfgPath, "utf-8")) as UshCfg;
const DIR = path.join(ROOT, cfg.run); mkdirSync(DIR, { recursive: true });
const SYS_CACHE = { type: "ephemeral", ttl: "1h" };
const rj = <T,>(f: string, d: T): T => (existsSync(path.join(DIR, f)) ? (JSON.parse(readFileSync(path.join(DIR, f), "utf-8")) as T) : d);
const wj = (f: string, v: unknown) => writeFileSync(path.join(DIR, f), JSON.stringify(v, null, 1));
const think = (model: string, effort: string) => ({ thinking: model.includes("sonnet") ? { type: "between_tools" } : { type: "adaptive" }, output_config: { effort } });
const mk = (id: string, model: string, sys: string, tool: Json, user: string, max: number, force = false, effort = cfg.effort): BatchReq => ({
  custom_id: id, params: { model, ...(force ? {} : think(model, effort)), max_tokens: max, system: [{ type: "text", text: sys, cache_control: SYS_CACHE }], tools: [tool], tool_choice: force ? { type: "tool", name: tool.name } : { type: "auto" }, messages: [{ role: "user", content: user }] } });

// ── 예산 ───────────────────────────────────────────────────────────
const BASE_F = path.join(ROOT, "ushistory-baseline.json");
const myBaseline = (): number => { if (!existsSync(BASE_F)) writeFileSync(BASE_F, JSON.stringify({ spent: ledger(DIR).spent(), at: new Date().toISOString(), note: "ledger.spent at the start of the US History work (2026-10-14); my total cap is cfg.myTotalCapUsd" })); return (JSON.parse(readFileSync(BASE_F, "utf-8")) as { spent: number }).spent; };
const costIn = (dir: string): number => { let c = 0; if (!existsSync(dir)) return 0; for (const f of readdirSync(dir)) if (/\.results\.jsonl$/.test(f)) for (const l of readFileSync(path.join(dir, f), "utf-8").split("\n").filter(Boolean)) { try { const j = JSON.parse(l); if (!j.cached) c += Number(j.cost ?? 0); } catch { /* skip */ } } return c; };
const spentRun = () => costIn(DIR);
const spentMine = () => readdirSync(ROOT).filter((d) => /^ush-/.test(d) && statSync(path.join(ROOT, d)).isDirectory()).reduce((a, d) => a + costIn(path.join(ROOT, d)), 0);
function guard(stage: string, est: number) {
  const t = ledgerTotal();
  const why = spentRun() + est > cfg.capUsd ? `run cap ${cfg.capUsd}` : spentMine() + est > cfg.myTotalCapUsd ? `US History total cap ${cfg.myTotalCapUsd}` : t.cumulativeUsd + est >= cfg.hardStopCumulativeUsd ? `cumulative ${t.cumulativeUsd} + est >= hard stop ${cfg.hardStopCumulativeUsd}` : "";
  if (why) throw new Error(`HARD STOP before ${stage}: est $${est.toFixed(3)}; run spent $${spentRun().toFixed(3)} / ${cfg.capUsd}; US History spent $${spentMine().toFixed(3)} / ${cfg.myTotalCapUsd}; cumulative $${t.cumulativeUsd}: ${why}`);
  console.log(`[${stage}] ledger before: run $${spentRun().toFixed(4)}, US History total $${spentMine().toFixed(4)}, cumulative $${t.cumulativeUsd} (stop line ${t.stopLine}); est this step $${est.toFixed(3)}`);
}
async function call(stage: string, reqs: BatchReq[], estUsd: number): Promise<Map<string, Json | null>> {
  if (!reqs.length) return new Map();
  { const rf = path.join(DIR, `${stage}.results.jsonl`); const done = new Set<string>(); if (existsSync(rf)) for (const l of readFileSync(rf, "utf-8").split("\n").filter(Boolean)) { try { const j = JSON.parse(l); if (j.ok) done.add(j.custom_id); } catch { /* skip */ } } const todo = reqs.filter((r) => !done.has(r.custom_id)).length; estUsd = estUsd * (todo / reqs.length); } // 이미 끝난 요청은 비용이 들지 않는다
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
  console.log(`[${stage}] 완료: 응답 ${[...out.values()].filter(Boolean).length}/${reqs.length}; run $${spentRun().toFixed(4)}, US History total $${spentMine().toFixed(4)}, cumulative $${ledgerTotal().cumulativeUsd}`);
  return out;
}

// ── 주제·코퍼스 ────────────────────────────────────────────────────
const curriculum = JSON.parse(readFileSync("data/ap/curriculum-2027/ap_us_history.json", "utf-8")) as { units: { code: string; topics: { code: string; title: string }[] }[] };
const topicsOf = (period: number) => curriculum.units.filter((u) => Math.abs(Number(u.code) - period) <= 1).flatMap((u) => u.topics.filter((t) => !/^\d\.1 /.test(`${t.code} `) || true).map((t) => ({ code: t.code, title: t.title })));
const ownTopics = (period: number) => curriculum.units.find((u) => Number(u.code) === period)!.topics.map((t) => ({ code: t.code, title: t.title }));
const allTopicCodes = new Set(curriculum.units.flatMap((u) => u.topics.map((t) => t.code)));
function corpus(excludeRun: string): CorpusDoc[] {
  const docs: CorpusDoc[] = [];
  for (const d of existsSync(ROOT) ? readdirSync(ROOT).filter((x) => /^ush-/.test(x) && x !== excludeRun && !(cfg.corpusExclude ?? []).includes(x) && statSync(path.join(ROOT, x)).isDirectory()) : []) {
    const sf = path.join(ROOT, d, "sets.json"); if (existsSync(sf)) for (const s of JSON.parse(readFileSync(sf, "utf-8")) as { spec: UshSetSpec; set: UshSetRaw | null }[]) if (s.set) docs.push({ id: `${d}:${s.spec.id}`, text: ushPassagePlain(s.set) });
    const ff = path.join(ROOT, d, "frq.json"); if (existsSync(ff)) for (const f of JSON.parse(readFileSync(ff, "utf-8")) as { id: string; payload: UshFrqPayload | null }[]) if (f.payload) docs.push({ id: `${d}:${f.id}`, text: sourcesText(f.payload) });
  }
  return docs;
}
function specsOf(): UshSetSpec[] {
  const used: string[] = [];
  for (const d of existsSync(ROOT) ? readdirSync(ROOT).filter((x) => /^ush-/.test(x) && x !== cfg.run && !(cfg.corpusExclude ?? []).includes(x) && statSync(path.join(ROOT, x)).isDirectory()) : []) { const sf = path.join(ROOT, d, "sets.json"); if (existsSync(sf)) for (const s of JSON.parse(readFileSync(sf, "utf-8")) as { spec: UshSetSpec }[]) used.push(s.spec.theme); }
  return cfg.plan ? planUshSets({ ...cfg.plan, usedThemes: [...used, ...(cfg.plan.usedThemes ?? [])] }) : [];
}

// ── 파싱 ───────────────────────────────────────────────────────────
/** 모델이 객체·배열 필드를 JSON 문자열로 돌려주는 경우(실측)를 복원한다. */
const unstring = (v: unknown): unknown => { if (typeof v !== "string") return v; const t = v.trim(); if (t.startsWith("{") || t.startsWith("[")) { try { return JSON.parse(t); } catch { return v; } } return v; };
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
function parseSource(s: Json): UshSource {
  const table = s.table && Array.isArray(s.table.columns) ? { columns: strs(s.table.columns), rows: (s.table.rows ?? []).map((r: unknown[]) => r.map((x) => (typeof x === "number" ? x : String(x)))) } : undefined;
  return { id: String(s.id), kind: s.kind, title: String(s.title ?? ""), attribution: String(s.attribution ?? ""), body: s.body === undefined ? undefined : String(s.body), table, figure: s.figure, provenance: { kind: "alton_composed", note: P.PROMPT_VERSION, ...(s.real_data_set && s.real_data_set !== "none" ? { real_data: true, dataset: s.real_data_set } : {}) } as UshSource["provenance"] };
}
function parseSet(spec: UshSetSpec, raw: Json): UshSetRaw | null {
  const inp: Json | null = raw ? { ...raw, sources: unstring(raw.sources), items: ((unstring(raw.items) as Json[]) ?? []).map?.((it: Json) => (it && typeof it === "object" ? { ...it, options: unstring(it.options), facts: unstring(it.facts), derived: unstring(it.derived) } : it)) } : raw;
  if (!inp || !Array.isArray(inp.sources) || !Array.isArray(inp.items)) return null;
  const items: UshItemRaw[] = inp.items.map((it: Json) => ({ skill: String(it.skill ?? ""), topic: String(it.topic ?? ""), stem: String(it.stem ?? ""), options: (Array.isArray(it.options) ? it.options : []).map((o: Json) => ({ text: String(o?.text ?? ""), is_key: o?.is_key === true, label: String(o?.label ?? ""), why: String(o?.why ?? "") })), facts: strs(it.facts), derived: Array.isArray(it.derived) ? it.derived.map((d: Json) => ({ desc: String(d.desc ?? ""), op: d.op, operands: (d.operands ?? []).map(Number), result: Number(d.result) })) : undefined, est_seconds: Number(it.est_seconds ?? 75) }));
  return { period: spec.period, stim_type: spec.stim, theme: spec.theme, title: String(inp.title ?? ""), sources: inp.sources.map(parseSource), items };
}
/** 실제 데이터셋 사용 시: 표·차트의 모든 값이 승인된 값과 일치해야 한다. */
function realDataViolations(set: UshSetRaw): string[] {
  const v: string[] = [];
  for (const s of set.sources) { const ds = (s.provenance as { dataset?: string }).dataset; if (!ds) continue; const ref = P.REAL_DATASETS[ds]; if (!ref) { v.push(`unknown_dataset_${ds}`); continue; }
    const pairs: [string, number][] = s.table ? s.table.rows.map((r) => [String(r[0]), Number(String(r[1]).replace(/,/g, ""))]) : s.figure ? s.figure.categories.map((c, i) => [c, s.figure!.series[0].values[i]]) : [];
    for (const [k, val] of pairs) { const key = Object.keys(ref).find((x) => k.includes(x)); if (!key) v.push(`real_data_label_${k}_not_in_dataset`); else if (Math.abs(ref[key] - val) > 1e-9) v.push(`real_data_value_${k}_${val}_vs_${ref[key]}`); } }
  return v;
}
/** 풀이기·패널용 자료 본문(표·차트도 텍스트로 보인다). */
function solverText(set: UshSetRaw): string {
  return ushStimulusDisplay(set.sources, { markdownTables: true }).replace(/The chart for this source appears below\./g, "") + set.sources.filter((s) => s.figure).map((s) => `\n\nChart data (${s.figure!.title}): ${s.figure!.categories.map((c, i) => `${c} = ${s.figure!.series.map((x) => `${x.name} ${x.values[i]}`).join(", ")}`).join("; ")}`).join("");
}
const stimulusFigure = (set: UshSetRaw) => {
  const s = set.sources.find((x) => x.table || x.figure); if (!s) return undefined;
  if (s.table) return { kind: "table", description: s.body ?? s.title, data: { columns: s.table.columns, rows: s.table.rows.map((r) => r.map(String)) } };
  const f = s.figure!; return { kind: "stat_chart", description: f.description, data: { chart: "bar", title: f.title, data: { categories: f.categories, series: f.series, ...(f.xTitle ? { xTitle: f.xTitle } : {}), ...(f.yTitle ? { yTitle: f.yTitle } : {}) } } };
};

// ── 단계: gen / check ──────────────────────────────────────────────
async function genStage() {
  const specs = specsOf(); wj("plan.json", { specs, summary: planSummaryUsh(specs) });
  const reqs = specs.map((s) => mk(`g-${s.id}`, cfg.models.gen, P.GEN_SYSTEM, P.setTool, P.genUser(s, ownTopics(s.period).concat(topicsOf(s.period).filter((t) => !ownTopics(s.period).some((o) => o.code === t.code))), s.stim === "quantitative" ? P.REAL_DATA_OFFER : ""), 14000, false, cfg.genEffort ?? cfg.effort));
  const out = await call("gen", reqs, estimate(cfg.models.gen, reqs.length, 2200, 6500));
  if (!has("--dry")) wj("gen.json", Object.fromEntries([...out.entries()]));
}
type Row = { spec: UshSetSpec; set: UshSetRaw | null; setViolations: string[]; itemViolations: string[][]; items: (UshItemRaw & { key_index: number; det: string[] })[] };
const detOf = (spec: UshSetSpec, set: UshSetRaw, it: UshItemRaw, i: number): string[] => { const v = itemViolations(set, it); if (it.skill !== spec.skills[i]) v.push("skill_not_as_requested"); if (it.topic && !allTopicCodes.has(it.topic)) v.push(`topic_${it.topic}_not_in_ced`); else if (it.topic && Math.abs(Number(ushUnitOfTopic(it.topic)) - spec.period) > 1) v.push(`topic_${it.topic}_far_from_period_${spec.period}`); return v; };
/** 길이 단서 교정: 키가 가장 긴 문항만 오답 문구를 다시 쓴다(Sonnet). 키·줄기는 그대로이고 결과는 같은 결정적 게이트로 다시 검사한다. 풀이·패널은 교정 후 문구로 돌린다. */
async function balanceStage() {
  const rows = rj<Row[]>("sets.json", []); const reqs: BatchReq[] = []; const meta: { id: string; r: number; i: number }[] = [];
  rows.forEach((r, ri) => { if (!r.set) return; r.items.forEach((it, i) => { if (it.det.includes("key_is_longest_option") && it.det.filter((d) => d !== "key_is_longest_option").length === 0) { const id = `b-${r.spec.id}-${i}`; reqs.push(mk(id, cfg.models.sampleLow, P.BALANCE_SYSTEM, P.BALANCE_TOOL, P.balanceUser(it.stem, it.options.map((o) => ({ text: o.text, is_key: o.is_key, why: o.why }))), 1500, true)); meta.push({ id, r: ri, i }); } }); });
  const out = await call("balance", reqs, estimate(cfg.models.sampleLow, reqs.length, 700, 400)); if (has("--dry")) return; let fixed = 0;
  for (const m of meta) {
    const o = out.get(m.id); const row = rows[m.r]; const it = row.items[m.i]; const opts = (o?.options ?? []) as Json[]; if (opts.length !== 4) continue;
    const next = it.options.map((old, j) => { const n = opts.find((x) => Number(x.index) === j); return n && !old.is_key ? { ...old, text: String(n.text ?? "").trim() } : old; });
    if (next.some((x, j) => !x.text) || next.some((x) => /[$\\^_<>{}|~`]/.test(x.text))) continue;
    const cand = { ...it, options: next }; const det = detOf(row.spec, row.set!, cand, m.i); row.items[m.i] = { ...cand, det }; row.itemViolations[m.i] = det; if (!det.length) fixed++;
  }
  wj("sets.json", rows); console.log(`[balance] 길이 단서 교정 ${fixed}/${meta.length}건 통과`);
}
function checkStage() {
  const specs = rj<{ specs: UshSetSpec[] }>("plan.json", { specs: [] }).specs; const gen = rj<Record<string, Json | null>>("gen.json", {}); const prior = corpus(cfg.run);
  const rows: Row[] = []; const same: CorpusDoc[] = [];
  const total = specs.reduce((a, s) => a + s.nItems, 0); const pos = balancedKeyPositions(Math.max(total, 4), 7919 + specs.length); let pi = 0;
  for (const spec of specs) {
    const set = parseSet(spec, gen[`g-${spec.id}`] as Json); if (!set) { rows.push({ spec, set: null, setViolations: ["no_tool_output_or_unparseable"], itemViolations: [], items: [] }); continue; }
    const sv = [...setViolations(set, { period: spec.period, stim: spec.stim }), ...realDataViolations(set), ...ushSimilarity(ushPassagePlain(set), [...prior, ...same])];
    same.push({ id: `${cfg.run}:${spec.id}`, text: ushPassagePlain(set) });
    if (set.items.length !== spec.nItems) sv.push(`item_count_${set.items.length}_not_${spec.nItems}`);
    const iv = set.items.map((it, i) => detOf(spec, set, it, i));
    const items = set.items.map((it, i) => { const placed = placeKey(it.options, pos[pi++ % pos.length], 31 * (i + 1) + spec.seed); return { ...it, options: placed.options, key_index: placed.key_index, det: iv[i] }; });
    rows.push({ spec, set, setViolations: sv, itemViolations: iv, items });
  }
  wj("sets.json", rows);
  const allKeys = rows.flatMap((r) => r.items.map((i) => i.key_index));
  console.log(`[check] 세트 ${rows.length}: 세트 위반 없음 ${rows.filter((r) => r.set && r.setViolations.length === 0).length}, 문항 ${allKeys.length} 중 결정적 위반 없음 ${rows.reduce((a, r) => a + r.itemViolations.filter((v) => v.length === 0).length, 0)}, 키 위치 ${keyPositionViolations(allKeys).join(",") || "균형"} (${[0, 1, 2, 3].map((k) => allKeys.filter((x) => x === k).length).join("/")})`);
  for (const r of rows) console.log(`  ${r.spec.id} p${r.spec.period} ${r.spec.stim} set:${r.setViolations.join(",") || "ok"} items:${r.itemViolations.map((v) => (v.length ? v.join("+") : "ok")).join(" | ")}`);
}
const HARD_SET = (v: string) => !/^key_is_longest_in_/.test(v) || true;
const setAlive = (r: Row) => Boolean(r.set) && !r.setViolations.some(HARD_SET);
const perm = (n: number, k: number): number[] => (k === 0 ? Array.from({ length: n }, (_, i) => i) : Array.from({ length: n }, (_, i) => n - 1 - i));
async function solveStage() {
  const rows = rj<Row[]>("sets.json", []); const reqs: BatchReq[] = []; const meta: { id: string; setId: string; k: number; idx: number[] }[] = [];
  for (const r of rows) {
    if (!setAlive(r)) continue; const idx = r.items.map((_, i) => i).filter((i) => r.items[i].det.length === 0); if (idx.length < 3) continue;
    cfg.models.solvers.forEach((model, k) => { const shown = idx.map((i) => ({ stem: r.items[i].stem, options: perm(4, k).map((j) => r.items[i].options[j].text) })); const id = `v${k}-${r.spec.id}-${idx.join("")}`; reqs.push(mk(id, model, P.SOLVER_SYSTEMS[k], P.SOLVER_TOOL, P.solverUser(solverText(r.set!), shown), 4000)); meta.push({ id, setId: r.spec.id, k, idx }); });
  }
  const est = cfg.models.solvers.reduce((a, m) => a + estimate(m, reqs.length / cfg.models.solvers.length, 1500, 1500), 0);
  const out = await call("solve", reqs, est); if (has("--dry")) return; const votes: Record<string, (SolverVote | null)[][]> = {};
  for (const m of meta) {
    const row = rows.find((r) => r.spec.id === m.setId)!; const arr = (votes[m.setId] ??= row.items.map(() => cfg.models.solvers.map(() => null) as (SolverVote | null)[]));
    const p = perm(4, m.k);
    for (const a of (out.get(m.id)?.answers ?? []) as Json[]) { const ii = m.idx[Number(a.question) - 1]; if (ii === undefined) continue; const sc = Number(a.choice); const also = a.also_defensible === null || a.also_defensible === undefined ? null : p[Number(a.also_defensible)]; arr[ii][m.k] = { choice: Number.isInteger(sc) && sc >= 0 && sc < 4 ? p[sc] : null, confidence: String(a.confidence ?? "likely"), also_defensible: also === undefined ? null : also }; }
  }
  wj("solve.json", votes);
  let ok = 0, tot = 0; for (const r of rows) r.items.forEach((it, i) => { const v = votes[r.spec.id]?.[i]; if (!v) return; tot++; if (v.every((x) => x && x.choice === it.key_index)) ok++; }); console.log(`[solve] 풀이 ${cfg.models.solvers.length} 전원 일치 ${ok}/${tot}`);
}
const solved = (votes: Record<string, (SolverVote | null)[][]>, r: Row, i: number) => { const v = votes[r.spec.id]?.[i]; return Boolean(v) && v!.every((x) => x && x.choice === r.items[i].key_index); };
async function panelStage() {
  const rows = rj<Row[]>("sets.json", []); const votes = rj<Record<string, (SolverVote | null)[][]>>("solve.json", {}); const reqs: BatchReq[] = []; const meta: { id: string; setId: string; idx: number[] }[] = [];
  for (const r of rows) { if (!setAlive(r)) continue; const idx = r.items.map((_, i) => i).filter((i) => solved(votes, r, i)); if (idx.length < 3) continue; const id = `p-${r.spec.id}-${idx.join("")}`; reqs.push(mk(id, cfg.models.panel, P.PANEL_SYSTEM, P.PANEL_TOOL, P.panelUser(solverText(r.set!), idx.map((i) => ({ stem: r.items[i].stem, options: r.items[i].options.map((o) => o.text) }))), 5000)); meta.push({ id, setId: r.spec.id, idx }); }
  const out = await call("panel", reqs, estimate(cfg.models.panel, reqs.length, 1700, 1200)); if (has("--dry")) return;
  const res: Record<string, { answers: (Json | null)[]; flags: Json[] }> = {};
  for (const m of meta) { const o = out.get(m.id); const row = rows.find((r) => r.spec.id === m.setId)!; const answers: (Json | null)[] = row.items.map(() => null); const flags: Json[] = []; if (o) { for (const a of (o.answers ?? []) as Json[]) { const ii = m.idx[Number(a.question) - 1]; if (ii !== undefined) answers[ii] = a; } for (const f of (o.flags ?? []) as Json[]) { const mm = /^q(\d)/i.exec(String(f.where)); flags.push({ ...f, item: mm ? m.idx[Number(mm[1]) - 1] ?? null : null }); } } res[m.setId] = { answers, flags }; }
  wj("panel.json", res);
}

// ── finalize(MC) ───────────────────────────────────────────────────
function explanationOf(it: UshItemRaw & { key_index: number }): string {
  const key = it.options[it.key_index]; const lines = [`The correct answer is "${key.text}". ${key.why.trim()}`];
  it.options.forEach((o, i) => { if (i !== it.key_index) lines.push(`"${o.text}" is incorrect: ${o.why.trim()}`); });
  return lines.join("\n");
}
const BAD_FLAG = /^(inaccurate|anachronism|contested|attributes_words_to_real_person|copies_known_text|unneutral)$/;
function finalizeStage() {
  const rows = rj<Row[]>("sets.json", []); const votes = rj<Record<string, (SolverVote | null)[][]>>("solve.json", {}); const panel = rj<Record<string, { answers: (Json | null)[]; flags: Json[] }>>("panel.json", {});
  const cands: Json[] = []; const audit: Json[] = [];
  for (const r of rows) {
    const pn = panel[r.spec.id]; const setFlags = (pn?.flags ?? []).filter((f) => f.item === null || f.item === undefined);
    const setBad = setFlags.some((f) => BAD_FLAG.test(String(f.kind)));
    const kept: (typeof r.items[number])[] = []; const excluded: Json[] = [];
    r.items.forEach((it, i) => {
      const reasons: string[] = [...it.det]; const v = votes[r.spec.id]?.[i]; const pa = pn?.answers?.[i] ?? null;
      if (!v || !v.every((x) => x && x.choice === it.key_index)) reasons.push("solver_disagreement_or_missing");
      else if (v.some((x) => x && x.also_defensible !== null && x.also_defensible !== undefined && x.also_defensible !== it.key_index)) reasons.push("solver_second_defensible");
      if (!pa) reasons.push("panel_missing"); else { if (Number(pa.choice) !== it.key_index) reasons.push("panel_disagrees"); if (pa.also_defensible !== null && pa.also_defensible !== undefined && Number(pa.also_defensible) !== it.key_index) reasons.push("panel_second_defensible"); }
      const mine = (pn?.flags ?? []).filter((f) => f.item === i); if (mine.some((f) => BAD_FLAG.test(String(f.kind)) || f.kind === "ambiguous_key" || f.kind === "second_defensible")) reasons.push(`panel_flag_${mine.map((f) => f.kind).join("+")}`);
      if (setBad) reasons.push("panel_set_flag"); if (!setAlive(r)) reasons.push("set_gate_failed");
      audit.push({ set: r.spec.id, i, skill: it.skill, det: it.det, reasons, pass: reasons.length === 0, solverAgree: v ? v.filter((x) => x && x.choice === it.key_index).length / v.length : 0 });
      if (reasons.length === 0) kept.push(it); else excluded.push({ index: i, skill: it.skill, reasons });
    });
    const base = { cellId: `ap_us_history-${r.spec.id}`, apSubjectCode: "ap_us_history", kind: "mc" as const, calculator: "na", reserve: false, wording: "generated", candidateKey: `ap_us_history-${r.spec.id}-k0` };
    if (!r.set || kept.length < 3) { cands.push({ ...base, keywordCode: r.spec.skills[0] ? ownTopics(r.spec.period)[0].code : "", unitCode: String(r.spec.period), skillPrimary: r.spec.skills[0], structure: "shared_stimulus_set", archetype: `ush_${r.spec.id}`, reviewState: "rejected", rejectionReason: `${r.setViolations.join("; ") || "fewer_than_3_items_passed"}; excluded=${JSON.stringify(excluded)}`.slice(0, 1500), difficultyProvisional: null, payload: { archetype: `ush_${r.spec.id}`, spec: r.spec, excluded_items: excluded } }); continue; }
    const items = kept.map((it) => ({ archetype: `ush_${r.spec.id}_${it.skill.replace(".", "")}`, topic: it.topic, skill: it.skill, stem: it.stem, options: it.options.map((o) => ({ text: o.text, why: o.why, value: null, label: o.label })), key_index: it.key_index, explanation_en: explanationOf(it), est_seconds: Math.min(150, Math.max(30, it.est_seconds || 75)), facts: it.facts, key_confidence: { solver_votes: (votes[r.spec.id]?.[r.items.indexOf(it)] ?? []).map((x) => x && { choice: x.choice, confidence: x.confidence }), panel_choice: panel[r.spec.id]?.answers?.[r.items.indexOf(it)]?.choice ?? null } }));
    const diff = items.map((it) => ({ label: /\.A$/.test(it.skill) ? "basic_learning" : "exam_prep" }));
    const fig = stimulusFigure(r.set);
    cands.push({ ...base, keywordCode: items[0].topic, unitCode: ushUnitOfTopic(items[0].topic), skillPrimary: items[0].skill, structure: "shared_stimulus_set", archetype: `ush_${r.spec.id}`, reviewState: "auto_passed", rejectionReason: null, difficultyProvisional: "exam_prep", difficulty: diff,
      payload: { archetype: `ush_${r.spec.id}`, topic: items[0].topic, skill: items[0].skill, calculator: "na", set_intro: ushStimulusDisplay(r.set.sources), ...(fig ? { stimulus: fig } : {}), ush_set: { period: r.spec.period, stim_type: r.spec.stim, theme: r.spec.theme, title: r.set.title, sources: r.set.sources.map((s) => ({ id: s.id, kind: s.kind, title: s.title, attribution: s.attribution, real_data: (s.provenance as { real_data?: boolean }).real_data === true })) }, items, excluded_items: excluded } });
  }
  wj("candidates.json", cands); wj("audit.json", audit);
  console.log(`[finalize] 문항 ${audit.length}: 결정적 통과 ${audit.filter((a) => a.det.length === 0).length}, 풀이 일치 ${audit.filter((a) => a.solverAgree === 1).length}, 최종 통과 ${audit.filter((a) => a.pass).length} (${((audit.filter((a) => a.pass).length / Math.max(1, audit.length)) * 100).toFixed(1)}%); 세트 통과 ${cands.filter((c) => c.reviewState === "auto_passed").length}/${cands.length}`);
}

// ── FRQ ────────────────────────────────────────────────────────────
const rubricText = (p: UshFrqPayload) => p.rubric.rows.map((r) => `${r.name} (0-${r.max}): ${r.task_specific}\n${Object.entries(r.descriptors).sort().map(([k, v]) => `  ${k}: ${v}`).join("\n")}`).join("\n") + "\n" + p.rubric.scoring_notes.map((n) => `Note: ${n}`).join("\n");
const frqMaterial = (p: UshFrqPayload) => (p.task_type === "leq" ? "" : p.task_type === "dbq" ? frqPassageDisplay(p) : solverTextFrq(p));
function solverTextFrq(p: UshFrqPayload): string { return p.sources.map((s) => `Source ${s.id} (${s.kind})\n${s.title}\n${s.attribution}\n${s.body ?? ""}${s.table ? "\n" + tableMarkdown(s.table) : ""}${s.figure ? `\n${s.figure.title}: ${s.figure.categories.map((c, i) => `${c} = ${s.figure!.series.map((x) => `${x.name} ${x.values[i]}`).join(", ")}`).join("; ")}` : ""}`).join("\n\n"); }
function toFrqPayload(spec: P.FrqSpec, raw: Json): UshFrqPayload | null {
  const inp: Json | null = raw ? Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, unstring(v)])) : raw; if (inp?.rubric && typeof inp.rubric === "object") inp.rubric = Object.fromEntries(Object.entries(inp.rubric as Json).map(([k, v]) => [k, unstring(v)])); if (inp?.expected_features && typeof inp.expected_features === "object") inp.expected_features = Object.fromEntries(Object.entries(inp.expected_features as Json).map(([k, v]) => [k, unstring(v)])); if (inp?.prompt && typeof inp.prompt === "object") inp.prompt = Object.fromEntries(Object.entries(inp.prompt as Json).map(([k, v]) => [k, unstring(v)]));
  if (!inp?.rubric || !inp?.prompt) return null; const task = taskOf(spec.template); const want = USH_RUBRIC_ROWS[task];
  const rows = want.map((w) => { const r = ((inp.rubric.rows ?? []) as Json[]).find((x) => String(x.row_id).toLowerCase() === w.row_id) ?? {}; return { row_id: w.row_id, name: w.name, max: w.max, descriptors: Object.fromEntries(Object.entries(r.descriptors ?? {}).map(([k, v]) => [String(k), String(v)])), task_specific: String(r.task_specific ?? "") }; });
  const af = inp.expected_features ?? {};
  return { schema_version: USH_FRQ_SCHEMA_VERSION, task_type: task, template: spec.template, period: spec.period, periods: (inp.periods ?? [spec.period]).map(Number), title: String(inp.title ?? ""),
    prompt: { scenario: String(inp.prompt.scenario ?? ""), task: String(inp.prompt.task ?? ""), requirements: strs(inp.prompt.requirements), ...(task === "saq" ? { parts: (inp.prompt.parts ?? []).map((p: Json) => ({ label: p.label, prompt: String(p.prompt), points: 1 })) } : {}) },
    sources: (inp.sources as Json[] ?? []).map(parseSource), rubric: { rubric_id: USH_RUBRIC_ID, total_points: want.reduce((a, b) => a + b.max, 0), rows, scoring_notes: strs(inp.rubric.scoring_notes) },
    expected_features: { defensible_theses: strs(af.defensible_theses), contextualization_ideas: strs(af.contextualization_ideas), outside_evidence: strs(af.outside_evidence), reasoning_types: strs(af.reasoning_types), doc_uses: af.doc_uses, saq_answers: af.saq_answers, common_pitfalls: strs(af.common_pitfalls), facts: strs(af.facts) },
    samples: [], provenance: { kind: "alton_composed", note: "ALTON-composed practice material; fictional sources and attributions." } };
}
/** 후보 번호: k=0 은 항상, 보충은 resample 에 "tier"(최대 3개) 또는 "tier:N"(최대 N개)로 지정한 세트·단계만. */
const candsFor = (id: string, tier: string): number[] => { const e = (cfg.resample?.[id] ?? []).find((x) => x === tier || x.startsWith(`${tier}:`)); const max = !e ? 1 : e.includes(":") ? Number(e.split(":")[1]) : Math.min(3, cfg.sampleCands ?? 1); return Array.from({ length: Math.min(max, cfg.sampleCands ?? 1) }, (_, k) => k); };
const loadFrq = () => rj<{ id: string; spec: P.FrqSpec; payload: UshFrqPayload | null; fact?: Json[] }[]>("frq.json", []);
async function frqGenStage() {
  const plan = cfg.frqPlan ?? []; const sys = { saq: P.FRQ_SAQ_SYSTEM, dbq: P.FRQ_DBQ_SYSTEM, leq: P.FRQ_LEQ_SYSTEM };
  const reqs = plan.map((p) => mk(`f-${p.id}`, cfg.models.gen, sys[taskOf(p.template)], P.frqTool(taskOf(p.template)), P.frqUser(p), 20000, false, cfg.genEffort ?? cfg.effort));
  const out = await call("frq-gen", reqs, estimate(cfg.models.gen, reqs.length, 2200, 9000)); if (has("--dry")) return;
  const prev = loadFrq(); // 이미 사실 점검한 세트는 점검 결과를 보존한다(같은 생성 결과일 때)
  wj("frq.json", plan.map((p) => { const payload = toFrqPayload(p, out.get(`f-${p.id}`) as Json); const old = prev.find((x) => x.id === p.id); return { id: p.id, spec: p, payload, fact: old && JSON.stringify(old.payload) === JSON.stringify(payload) ? old.fact : undefined }; }));
}
const packText = (p: UshFrqPayload) => `${frqTaskText(p)}\n\n${solverTextFrq(p)}\n\nEXPECTED FEATURES\n${JSON.stringify(p.expected_features)}\n\nRUBRIC TEXT\n${rubricText(p)}`;
async function frqFactStage() {
  const fr = loadFrq(); const reqs: BatchReq[] = [];
  for (const f of fr) { if (!f.payload) continue; if (f.fact !== undefined && !f.fact.some((x) => x.detail === "not_checked") && !(has("--recheck"))) continue; const pv = frqViolations(f.payload).filter((x) => !/^sample_|samples_|^similar_to/.test(x)); if (pv.length) { console.log(`[frq-fact] ${f.id}: 무료 게이트 위반 ${pv.join(",")} → 건너뜀`); continue; } reqs.push(mk(`fa-${f.id}`, cfg.models.fact, P.FACT_SYSTEM, P.FACT_TOOL, P.factUser(packText(f.payload)), 4000)); }
  const out = await call("frq-fact", reqs, estimate(cfg.models.fact, reqs.length, 3500, 1200)); if (has("--dry")) return;
  for (const f of fr) { if (!f.payload || !reqs.some((r) => r.custom_id === `fa-${f.id}`)) { if (f.fact === undefined) f.fact = [{ where: "pack", kind: "other", detail: "not_checked" }]; continue; } const o = out.get(`fa-${f.id}`); f.fact = o ? ((o.flags ?? []) as Json[]) : [{ where: "pack", kind: "other", detail: "not_checked" }]; }
  wj("frq.json", fr);
  for (const f of fr) console.log(`  ${f.id}: ${(f.fact ?? []).map((x) => `${x.kind}@${x.where}`).join(", ") || "clean"}`);
}
const packOk = (f: { payload: UshFrqPayload | null; fact?: Json[] }) => Boolean(f.payload) && !frqViolations(f.payload!).filter((x) => !/^sample_|samples_|^similar_to/.test(x)).length && (f.fact ?? []).every((x) => !BAD_FLAG.test(String(x.kind)) && x.kind !== "inconsistent_with_documents") && f.fact !== undefined && !(f.fact ?? []).some((x) => x.detail === "not_checked");
async function frqSampleStage() {
  const fr = loadFrq().filter(packOk); const reqs: BatchReq[] = [];
  for (const f of fr) { const p = f.payload!; const task = p.task_type; for (const tier of ["high", "mid", "low"] as const) for (const k of candsFor(f.id, tier)) reqs.push(mk(`s-${f.id}-${tier}-${k}`, tier === "high" ? cfg.models.sampleHigh : cfg.models.sampleLow, P.SAMPLE_SYSTEM(task, tier), P.SAMPLE_TOOL, P.sampleUser(frqTaskText(p), frqMaterial(p), rubricText(p)), 6000)); }
  const out = await call("frq-samples", reqs, estimate(cfg.models.sampleHigh, reqs.length, 3200, 1800)); if (has("--dry")) return;
  wj("frq-samples.json", Object.fromEntries([...out.entries()]));
}
async function frqGradeStage() {
  const fr = loadFrq().filter(packOk); const samples = rj<Record<string, Json | null>>("frq-samples.json", {}); const reqs: BatchReq[] = [];
  for (const f of fr) { const p = f.payload!; const rows = USH_RUBRIC_ROWS[p.task_type]; for (const tier of ["high", "mid", "low"]) for (const k of candsFor(f.id, tier)) { const s = samples[`s-${f.id}-${tier}-${k}`]; if (!s?.essay) continue; cfg.models.graders.forEach((m, g) => reqs.push(mk(`r${g}-${f.id}-${tier}-${k}`, m, P.GRADE_SYSTEMS[g % P.GRADE_SYSTEMS.length], P.GRADE_TOOL(rows), P.gradeUser(frqTaskText(p), frqMaterial(p), rubricText(p), noDollar(String(s.essay))), 2500, false, cfg.gradeEffort ?? cfg.effort))); } }
  const out = await call("frq-grade", reqs, cfg.models.graders.reduce((a, m) => a + estimate(m, reqs.length / cfg.models.graders.length, 3800, 700), 0)); if (has("--dry")) return;
  wj("frq-grades.json", Object.fromEntries([...out.entries()]));
}
async function frqFact2Stage() { // 높은·중간 샘플의 역사적 정확성(Fable)
  const fr = loadFrq().filter(packOk); const samples = rj<Record<string, Json | null>>("frq-samples.json", {}); const reqs: BatchReq[] = [];
  for (const f of fr) for (const tier of ["high", "mid", "low"]) for (const k of candsFor(f.id, tier)) { const s = samples[`s-${f.id}-${tier}-${k}`]; if (s?.essay) reqs.push(mk(`fs-${f.id}-${tier}-${k}`, cfg.models.fact, P.FACT_SYSTEM, P.FACT_TOOL, P.factUser(`Prompt: ${frqTaskText(f.payload!)}\n\nSTUDENT SAMPLE RESPONSE (${tier} tier; weaknesses may be vagueness but historical claims should be accurate)\n${s.essay}`), 3000)); }
  const out = await call("frq-fact2", reqs, estimate(cfg.models.fact, reqs.length, 1800, 700)); if (has("--dry")) return;
  wj("frq-fact2.json", Object.fromEntries([...out.entries()]));
}
const median = (a: number[]) => { const s = a.slice().sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2); };
function frqFinalizeStage() {
  const fr = loadFrq(); const samples = rj<Record<string, Json | null>>("frq-samples.json", {}); const grades = rj<Record<string, Json | null>>("frq-grades.json", {}); const f2 = rj<Record<string, Json | null>>("frq-fact2.json", {}); const cands: Json[] = []; const audit: Json[] = []; const prior = corpus(cfg.run);
  for (const f of fr) {
    const base = { cellId: `ap_us_history-${f.id}`, apSubjectCode: "ap_us_history", kind: "frq_bundle" as const, calculator: "na", reserve: false, wording: "generated", candidateKey: `ap_us_history-${f.id}-k0` };
    const tpl = f.spec.template; const task = taskOf(tpl); const kw = `${f.spec.period}.1`;
    if (!f.payload) { cands.push({ ...base, keywordCode: kw, unitCode: String(f.spec.period), skillPrimary: "1.B", structure: "frq_multipart", archetype: `ushfrq_${f.id}`, reviewState: "rejected", rejectionReason: "no_tool_output", difficultyProvisional: null, payload: { archetype: `ushfrq_${f.id}` } }); continue; }
    const p = f.payload; const rows = USH_RUBRIC_ROWS[task]; const chosen: UshSample[] = []; const why: string[] = [];
    for (const tier of ["high", "mid", "low"] as const) {
      const opts = candsFor(f.id, tier).map((k) => { const s = samples[`s-${f.id}-${tier}-${k}`]; if (!s?.essay) return null; const gs = cfg.models.graders.map((_, g) => grades[`r${g}-${f.id}-${tier}-${k}`]).filter(Boolean) as Json[]; if (gs.length < cfg.models.graders.length) return null;
        const sc: Record<string, number> = {}; for (const r of rows) sc[r.row_id] = Math.min(r.max, Math.max(0, median(gs.map((x) => Number(x[r.row_id]))))); const tot = Object.values(sc).reduce((a, b) => a + b, 0); const totals = gs.map((x) => rows.reduce((a, r) => a + Number(x[r.row_id] ?? 0), 0)); const spread = Math.max(...totals) - Math.min(...totals);
        const fl = ((f2[`fs-${f.id}-${tier}-${k}`]?.flags ?? []) as Json[]).filter((x) => BAD_FLAG.test(String(x.kind)));
        return { k, s, sc, tot, spread, dist: Math.abs(tot - USH_SAMPLE_TARGET[task][tier]), flagged: fl.length > 0, fl }; }).filter(Boolean) as { k: number; s: Json; sc: Record<string, number>; tot: number; spread: number; dist: number; flagged: boolean; fl: Json[] }[];
      const ok = opts.filter((o) => o.tot >= USH_SAMPLE_BAND[task][tier][0] && o.tot <= USH_SAMPLE_BAND[task][tier][1] && o.spread <= (task === "saq" ? 1 : 2) && !o.flagged).sort((a, b) => a.dist - b.dist || a.spread - b.spread)[0];
      audit.push({ id: f.id, tier, options: opts.map((o) => ({ k: o.k, total: o.tot, spread: o.spread, flagged: o.flagged, flags: o.fl })), chosen: ok?.k ?? null });
      if (!ok) { why.push(`sample_${tier}_no_consistent_candidate`); continue; }
      const text = noDollar(String(ok.s.essay)).trim();
      chosen.push({ tier, target_total: ok.tot, essay: text, word_count: (text.match(/\S+/g) ?? []).length, rubric_scores: { ...ok.sc, total: ok.tot }, annotations: ((ok.s.annotations as Json[]) ?? []).map((a) => ({ quote: noDollar(String(a.quote)), comment: noDollar(String(a.comment)), row_id: String(a.row_id).toLowerCase() })).filter((a) => quoteInPassage(a.quote, text)) });
    }
    p.samples = chosen; const v = [...frqViolations(p, prior), ...why, ...(f.fact ?? []).filter((x) => BAD_FLAG.test(String(x.kind))).map((x) => `fact_${x.kind}`)];
    if (v.length) { cands.push({ ...base, keywordCode: kw, unitCode: String(p.period), skillPrimary: "1.B", structure: "frq_multipart", archetype: `ushfrq_${f.id}`, reviewState: "rejected", rejectionReason: v.join("; ").slice(0, 1500), difficultyProvisional: null, payload: { archetype: `ushfrq_${f.id}`, ush_frq: p } }); continue; }
    const fig = p.task_type === "saq" ? stimulusFigure({ sources: p.sources } as UshSetRaw) : undefined; const skill = task === "saq" ? (tpl === "saq1" ? "3.C" : tpl === "saq2" ? "3.A" : "1.B") : "6.A"; const hi = p.samples.find((s) => s.tier === "high")!;
    const parts = task === "saq" ? (p.prompt.parts ?? []).map((x) => ({ label: x.label, prompt: x.prompt, points: 1, response_mode: "explain", skill_codes: [skill], topic_codes: [kw], model_answer: (p.expected_features.saq_answers?.[x.label.toLowerCase()] ?? [""])[0], rubric_rows: [{ row_id: x.label.toLowerCase(), points: 1, criterion: p.rubric.rows.find((r) => r.row_id === x.label.toLowerCase())?.task_specific ?? "", required_elements: p.expected_features.saq_answers?.[x.label.toLowerCase()] ?? [], optional_phrases: [], alt_solutions: [], common_errors: [], requires_row_id: null, requires_both: false, requires_numbers: false, numeric_tolerance: null, units_row: false }] }))
      : [{ label: "A", prompt: frqTaskText(p), points: p.rubric.total_points, response_mode: "essay", skill_codes: [skill], topic_codes: [kw], model_answer: hi.essay, rubric_rows: p.rubric.rows.map((r) => ({ row_id: r.row_id, points: r.max, criterion: r.task_specific, required_elements: [], optional_phrases: [], alt_solutions: [], common_errors: [], requires_row_id: null, requires_both: false, requires_numbers: false, numeric_tolerance: null, units_row: false })) }];
    cands.push({ ...base, keywordCode: kw, unitCode: String(p.period), skillPrimary: skill, structure: "frq_multipart", archetype: `ushfrq_${f.id}`, reviewState: "auto_passed", rejectionReason: null, difficultyProvisional: "exam_prep",
      payload: { archetype: `ushfrq_${f.id}`, template: tpl, topic: kw, extra_topics: [], skill, representative_skill: skill, calculator: "na", title: p.title, set_intro: frqPassageDisplay(p), ...(fig ? { stimulus: fig } : {}), parts, reference_text: frqReferenceText(p), ush_frq: p } });
  }
  wj("candidates.json", cands); wj("audit.json", audit);
  console.log(`[frq-finalize] 세트 ${cands.length}: 통과 ${cands.filter((c) => c.reviewState === "auto_passed").length}; ${cands.filter((c) => c.reviewState === "rejected").map((c) => `${c.cellId}: ${String(c.rejectionReason).slice(0, 200)}`).join(" || ")}`);
}

const STAGES: Record<string, () => Promise<void> | void> = { gen: genStage, check: checkStage, balance: balanceStage, solve: solveStage, panel: panelStage, finalize: finalizeStage, "frq-gen": frqGenStage, "frq-fact": frqFactStage, "frq-samples": frqSampleStage, "frq-grade": frqGradeStage, "frq-fact2": frqFact2Stage, "frq-finalize": frqFinalizeStage };
async function main() {
  const hash = require("node:crypto").createHash("sha1").update(fileSetHash(cfg.generatorFiles) + JSON.stringify({ ...cfg, expected: undefined })).digest("hex").slice(0, 12);
  if (has("--plan")) { const s = specsOf(); console.log(JSON.stringify(planSummaryUsh(s), null, 1)); for (const x of s) console.log(x.id, `p${x.period}`, x.stim, x.skills.join(","), "|", x.theme); return 0; }
  if (has("--freeze")) { writeFileSync(cfgPath, JSON.stringify({ ...cfg, expected: { hash } }, null, 1)); console.log(`동결 구성 기록: ${path.relative(process.cwd(), cfgPath)} hash=${hash}`); return 0; }
  if (cfg.expected.hash !== hash) { console.error(`ABORT: 동결 구성 해시 불일치 — 유료 호출 전에 중단 (기대 ${cfg.expected.hash}, 실제 ${hash})`); return 2; }
  console.log(`동결 구성 일치 hash=${hash}`); if (has("--check-only")) return 0;
  if (!process.env.ANTHROPIC_API_KEY && !has("--dry") && cfg.stages.some((s) => ["gen", "balance", "solve", "panel", "frq-gen", "frq-fact", "frq-samples", "frq-grade", "frq-fact2"].includes(s))) { console.error("ANTHROPIC_API_KEY 환경 변수가 필요합니다(파일에 쓰지 않는다)."); return 3; }
  myBaseline();
  const only = arg("--stages") ? arg("--stages").split(",") : cfg.stages;
  const t0 = ledgerTotal(); console.log(`시작 누적 $${t0.cumulativeUsd} / 중단선 $${t0.stopLine}; US History 합계 $${spentMine().toFixed(4)} / ${cfg.myTotalCapUsd}`);
  for (const st of only) { console.log(`── ${st}`); await STAGES[st](); }
  const t1 = ledgerTotal(); console.log(`이번 실행 비용 $${spentRun().toFixed(4)} / 상한 $${cfg.capUsd}; US History 합계 $${spentMine().toFixed(4)} / ${cfg.myTotalCapUsd}; 누적 $${t1.cumulativeUsd}, 중단선 여유 $${t1.headroomToStopLine}`);
  return 0;
}
if (require.main === module) main().then((c) => process.exit(c)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
