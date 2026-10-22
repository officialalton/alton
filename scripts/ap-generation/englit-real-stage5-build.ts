// AP English Literature LT5 배치 `lt-real-5` 생성기(2026-10-22, 무료·DB 없음).
//   REAL_RUNS=englit-real-8 npx tsx scripts/ap-generation/englit-real-stage5-build.ts [--write]
// 입력: 실행 폴더들의 real-sample-items.json(MC 세트: 같은 세트 id 는 뒤 실행이 앞 실행을 덮어쓴다)·real-sample-frq.json(FRQ) + 등록부. 검증 통과 문항 중 시험 전체(MC 55, 세트 5, 장르 문항 수, 7범주 상·하한)를 만족하는 부분집합을 정수계획으로 고른다.
// 출력: data/ap/stock/lt-real-5-{items,pass-keys,summary}.json. 지문 첫 줄 "Public-domain source text — 저자, 작품, 판본", 지문 본문은 등록부 저장 텍스트 그대로.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Cons } from "../../lib/ap-exam/ilp";
import { solveMipHighs } from "./ilp-highs";
import { realDisplay, realSet } from "../../lib/ap-generation/englit-real";
import { keyPositionViolations } from "../../lib/ap-generation/englang-gates";
import { ltTopicFor } from "../../lib/ap-generation/subjects/englit";
import { ENGLIT_FULL_TARGET, ENGLIT_SET_SIZE, englitCategoryBounds, englitCategoryOf, englitGroupBounds } from "../../lib/ap-exam/englit-rules";
import type { Registry, SourceEntry } from "../../lib/ap-generation/englit-sources";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const SRC = path.resolve("data/ap/englit-sources"); const RUN = "lt-real-5"; const LOAD = "lt-real-5-2026-10-22"; const EXECS = (process.env.REAL_RUNS ?? "englit-real-9").split(",");
const rd = <T>(p: string): T => JSON.parse(readFileSync(p, "utf-8")) as T;
const reg = rd<Registry>(path.join(SRC, "registry.json")); const entry = (id: string): SourceEntry => reg.entries.find((e) => e.id === id)!;
const textOf = (e: SourceEntry) => readFileSync(path.join(SRC, e.text_file), "utf-8");
const SETS = ["rs32", "rs33", "rs34"]; const CAPS: Record<string, number> = Object.fromEntries((process.env.CAPS ?? "").split(",").filter(Boolean).map((x) => [x.split(":")[0], Number(x.split(":")[1])]));
const GROUP: Record<string, "poetry" | "short" | "longer"> = { rs32: "short", rs33: "poetry", rs34: "short" };

function loadSets(): Record<string, Json | undefined> {
  const out: Record<string, Json | undefined> = {};
  for (const ex of EXECS) { const f = path.resolve("data/ap/sample-2027", ex, "real-sample-items.json"); if (!existsSync(f)) continue; for (const c of rd<Json[]>(f)) { const id = String(c.cellId).split("-").pop()!; if (SETS.includes(id) && c.reviewState === "auto_passed" && (c.payload.items?.length ?? 0) > 0) out[id] = c; } }
  return out;
}
/** 시험 전체 구성을 만족하는 문항 선택(정수계획). */
export function select(sets: Record<string, Json>): { picks: Record<string, number[]>; report: Json } {
  const ids = SETS.filter((s) => sets[s]); const cb = englitCategoryBounds(); const gb = englitGroupBounds(); const cats = Object.keys(ENGLIT_FULL_TARGET.categories);
  let n = 0; const xv = new Map<string, number>(); for (const s of ids) (sets[s].payload.items as Json[]).forEach((_, i) => xv.set(`${s}|${i}`, n++));
  const dv = new Map<string, number>(); for (const c of cats) dv.set(c, n++);
  const obj = new Array<number>(n).fill(0); const cons: Cons[] = [];
  for (const d of dv.values()) obj[d] = 10;
  for (const s of ids) (sets[s].payload.items as Json[]).forEach((it, i) => { const L = (it.options as Json[]).map((o) => String(o.text).length); const longest = L[it.key_index] >= Math.max(...L) ? 1 : 0; obj[xv.get(`${s}|${i}`)!] += (1 - Number(it.key_confidence?.score ?? 0.8)) * 2 + longest * 3; });
  for (const s of ids) { const co = (sets[s].payload.items as Json[]).map((_, i) => [xv.get(`${s}|${i}`)!, 1] as [number, number]); cons.push({ coef: co, sense: ">=", rhs: ENGLIT_SET_SIZE.min }); cons.push({ coef: co, sense: "<=", rhs: ENGLIT_SET_SIZE.max }); }
  { const all = [...xv.values()].map((j) => [j, 1] as [number, number]); cons.push({ coef: all, sense: "=", rhs: 55 }); }
  for (const g of ["poetry", "short", "longer"] as const) { const co = ids.filter((s) => GROUP[s] === g).flatMap((s) => (sets[s].payload.items as Json[]).map((_, i) => [xv.get(`${s}|${i}`)!, 1] as [number, number])); cons.push({ coef: co, sense: ">=", rhs: gb[g].min }); cons.push({ coef: co, sense: "<=", rhs: gb[g].max }); }
  for (const c of cats) { const co: [number, number][] = ids.flatMap((s) => (sets[s].payload.items as Json[]).map((it, i) => [xv.get(`${s}|${i}`)!, englitCategoryOf(it.skill) === c ? 1 : 0] as [number, number])).filter(([, v]) => v > 0); const d = dv.get(c)!;
    cons.push({ coef: co, sense: ">=", rhs: cb[c].min }); cons.push({ coef: co, sense: "<=", rhs: cb[c].max }); cons.push({ coef: [...co, [d, -1]], sense: "<=", rhs: ENGLIT_FULL_TARGET.categories[c] }); cons.push({ coef: [...co.map(([j, v]) => [j, -v] as [number, number]), [d, -1]], sense: "<=", rhs: -ENGLIT_FULL_TARGET.categories[c] }); }
  const binary = new Array<boolean>(n).fill(false); for (const j of xv.values()) binary[j] = true; for (const j of xv.values()) cons.push({ coef: [[j, 1]], sense: "<=", rhs: 1 });
  const r = solveMipHighs({ n, obj, cons, integer: new Array(n).fill(true), binary }, { timeMs: 60000 }); if (!r.x.length) throw new Error("선택 불가(구성 상·하한 불만족: 후보 부족)");
  const picks: Record<string, number[]> = {}; for (const s of ids) picks[s] = (sets[s].payload.items as Json[]).map((_, i) => i).filter((i) => r.x[xv.get(`${s}|${i}`)!] > 0.5);
  const vec: Record<string, number> = {}; for (const s of ids) for (const i of picks[s]) { const c = englitCategoryOf(sets[s].payload.items[i].skill) ?? "?"; vec[c] = (vec[c] ?? 0) + 1; }
  const keyViol: Record<string, string[]> = {}; for (const s of ids) keyViol[s] = keyPositionViolations(picks[s].map((i) => sets[s].payload.items[i].key_index));
  return { picks, report: { sets: ids, candidates: ids.map((s) => sets[s].payload.items.length), categories: vec, sizes: Object.fromEntries(ids.map((s) => [s, picks[s].length])), keyPositionViolations: keyViol, bounds: Object.fromEntries(cats.map((c) => [c, [cb[c].min, cb[c].max]])) } };
}

export function build() {
  const sets = loadSets(); const missing = SETS.filter((s) => !sets[s]); if (missing.length) throw new Error(`통과 세트 없음: ${missing.join(",")}`);
  // LT4: 새 단편 묶음 하나만 보강한다(나머지 묶음은 기존 재고). 검증 통과 문항을 모두 보관(묶음 크기 8–13 상한 13)한다.
  // 항목 부분집합은 lt5-select.ts(정수계획, 7범주 상·하한)가 정한다: data/ap/stock/lt5-selection.json
  const sel = rd<{ picks: Record<string, number[]>; long: string; categories: Record<string, number> }>("data/ap/stock/lt5-selection.json"); const picks: Record<string, number[]> = sel.picks; const report: Json = { sets: SETS, candidates: SETS.map((k) => sets[k]!.payload.items.length), sizes: Object.fromEntries(SETS.map((k) => [k, picks[k].length])), longGroupChosen: sel.long, categories: sel.categories, note: "LT5 item subsets chosen by integer programming so the full exam composition (MC 55, genre counts, 7 category bounds) is met together with existing groups p06 and l02" }; void select;
  const out: Json[] = [];
  const stockFields = (c: Json, id: string, replaces: string) => ({ ...c, stockKey: `${RUN}:${c.candidateKey}`, run: RUN, pipeline: "real_text_v1", validation: "auto_passed", reviewState: "verified_by_independent_models", gateVersion: LOAD, gateOverride: LOAD, releaseTier: "candidate", expertStatus: "unreviewed", renderVerified: false, screenVerified: false, reviewEnvReady: false,
    selectedForSample: true, legacyReserve: false, family: "ap_english_literature", itemFamilyId: `fam:${RUN}:${c.candidateKey}`, canonicalKey: `${RUN}:${c.candidateKey}`, duplicateOf: null, duplicateReason: null, contentKey: `ap_english_literature:${c.keywordCode}`, sharedWith: [],
    stockCell: `ap_english_literature|${c.keywordCode}|${c.skillPrimary}|${c.structure}|na`, history: [{ run: RUN, gateVersion: LOAD, outcome: "passed", reasons: null }], stimulusOrigin: "real_public_domain_text", sourceRegistryIds: [c.registryId ?? c.payload?.real_text?.registry_id ?? c.payload?.provenance?.registry_id].filter(Boolean), replaces });
  for (const k of SETS) { const c = sets[k]!; const e = entry(c.registryId); const set = realSet(e, textOf(e)); const p = JSON.parse(JSON.stringify(c.payload)) as Json;
    const kept = picks[k].map((i) => p.items[i]); const dropped = (p.items as Json[]).filter((_, i) => !picks[k].includes(i));
    kept.forEach((it: Json, n: number) => { it.topic = ltTopicFor(it.skill, p.lt_passage.group, n); it.archetype = `lt_${p.lt_passage.group}_${String(it.skill).replace(".", "")}`; });
    p.items = kept; p.surplus_items = dropped.map((it: Json) => ({ skill: it.skill, stem: String(it.stem).slice(0, 140), reason: "verified_but_not_selected (slot size and exam category balance)" })); p.assignable_size = kept.length >= 8 && kept.length <= 13; p.set_note = "";
    p.set_intro = realDisplay(set as never, e); p.skill = kept[0].skill; p.topic = kept[0].topic; p.excluded_items_note = "Excluded and never shown: items that failed a gate, a blind solver, the adversary, the judge or the Fable panel. See excluded_items; verified surplus items not needed for the exam composition are listed in surplus_items.";
    out.push(stockFields({ ...c, payload: p, keywordCode: kept[0].topic, unitCode: (kept[0].topic.match(/^U(\d)/) ?? [])[1] ?? "", skillPrimary: kept[0].skill, archetype: p.archetype, difficulty: kept.map(() => ({ label: "exam_prep" })) }, k, "LT5 (new exam)")); }
  for (const ex of EXECS) { const ff = path.resolve("data/ap/sample-2027", ex, "real-sample-frq.json"); if (!existsSync(ff)) continue;
    for (const c of rd<Json[]>(ff)) { const id = String(c.cellId).split("-").pop()!; if (c.reviewState !== "auto_passed") { console.log(`FRQ ${id} 미통과: ${c.rejectionReason}`); continue; } const e = entry(c.payload.lit_frq.passage.provenance.registry_id); const p = JSON.parse(JSON.stringify(c.payload)) as Json;
      const q = c.payload.lit_frq.passage; p.set_intro = realDisplay({ title: q.title, headnote: q.headnote, stanzas: q.stanzas, provenance: { author_alias: q.provenance.author_alias } }, e); out.push(stockFields({ ...c, payload: p, difficulty: undefined, registryId: e.id }, id, "LT5 (new exam)")); } }
  return { out, report };
}
if (process.argv[1]?.endsWith("englit-real-stage5-build.ts")) {
  const { out, report } = build(); console.log(out.map((i) => `${i.stockKey} ${i.kind} ${i.kind === "mc" ? i.payload.items.length : ""} ${i.payload.set_intro.split("\n")[0].slice(0, 110)}`).join("\n")); console.log(JSON.stringify(report));
  if (process.argv.includes("--write")) {
    writeFileSync("data/ap/stock/lt-real-5-items.json", JSON.stringify(out, null, 1) + "\n"); writeFileSync("data/ap/stock/lt-real-5-pass-keys.json", JSON.stringify(out.map((i) => i.stockKey), null, 1) + "\n");
    writeFileSync("data/ap/stock/lt-real-5-summary.json", JSON.stringify({ run: RUN, generatedAt: "2026-10-22", executions: EXECS, passed: out.map((i) => ({ stockKey: i.stockKey, replaces: i.replaces })), selection: report }, null, 1) + "\n"); console.log("wrote lt-real-5 items/pass-keys/summary");
  }
}
