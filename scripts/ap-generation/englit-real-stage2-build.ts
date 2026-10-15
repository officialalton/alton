// AP English Literature 실제 작품 Stage 2 배치 `lt-real-2` 생성기(무료·DB 없음).
//   npx tsx scripts/ap-generation/englit-real-stage2-build.ts [--write]
// 입력: 실행 data/ap/sample-2027/englit-real-4/{real-sample-items.json(MC 4세트), real-sample-frq.json(rf3)} + 등록부. 문항 수가 슬롯 크기보다 많으면(검증 통과 > 크기) 시험 전체 범주 구성(7범주 상·하한)을 만족하면서 공식 목표에 가장 가까운 부분집합을 코드로 고른다.
// 출력: data/ap/stock/lt-real-2-{items,pass-keys,summary}.json. 지문 첫 줄 "Public-domain source text — 저자, 작품, 판본", 지문 본문은 등록부 저장 텍스트 그대로.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { realDisplay, realSet } from "../../lib/ap-generation/englit-real";
import { keyPositionViolations } from "../../lib/ap-generation/englang-gates";
import { ltTopicFor } from "../../lib/ap-generation/subjects/englit";
import { ENGLIT_FULL_TARGET, englitCategoryBounds, englitCategoryOf } from "../../lib/ap-exam/englit-rules";
import type { Registry, SourceEntry } from "../../lib/ap-generation/englit-sources";
import { loadLtPool } from "./lt-pool";
import { resultOf, type Snap } from "./lt-real-1-plans";
import { STAGE_2, stage1Slots } from "./lt-real-2-plans";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const SRC = path.resolve("data/ap/englit-sources"); const RUN = "lt-real-2"; const LOAD = "lt-real-2-2026-10-15"; const EXEC = process.env.REAL_RUN ?? "englit-real-4"; const EDIR = path.resolve("data/ap/sample-2027", EXEC);
const rd = <T>(p: string): T => JSON.parse(readFileSync(p, "utf-8")) as T;
const reg = rd<Registry>(path.join(SRC, "registry.json")); const entry = (id: string): SourceEntry => reg.entries.find((e) => e.id === id)!;
const textOf = (e: SourceEntry) => readFileSync(path.join(SRC, e.text_file), "utf-8");
/** 슬롯: 세트 id → 시험·크기·교체되는 ALTON 세트 키. */
export const SLOTS: Record<string, { exam: "LT1" | "LT2"; n: number; replaceKey: string; replaces: string }> = {
  ls3: { exam: "LT1", n: 13, replaceKey: STAGE_2.LT1.mc[0][0], replaces: "LT1 s05 (ALTON short-fiction set, 13 items)" },
  ll4: { exam: "LT1", n: 10, replaceKey: STAGE_2.LT1.mc[1][0], replaces: "LT1 l04 (ALTON longer-prose set, 10 items)" },
  ls5: { exam: "LT2", n: 13, replaceKey: STAGE_2.LT2.mc[0][0], replaces: "LT2 p05 (ALTON poetry set, 13 items)" },
  ll1: { exam: "LT2", n: 8, replaceKey: STAGE_2.LT2.mc[1][0], replaces: "LT2 l01 (ALTON drama set, 8 items)" },
};
const REPLACES_FRQ: Record<string, string> = { rf3: "LT1 FRQ Q2 fb2 (ALTON prose passage)" };
function* combos(m: number, n: number, start = 0, cur: number[] = []): Generator<number[]> { if (cur.length === n) { yield cur.slice(); return; } for (let i = start; i <= m - (n - cur.length); i++) { cur.push(i); yield* combos(m, n, i + 1, cur); cur.pop(); } }
const catVec = (skills: string[]): Record<string, number> => { const v: Record<string, number> = {}; for (const s of skills) { const c = englitCategoryOf(s) ?? "?"; v[c] = (v[c] ?? 0) + 1; } return v; };
const bounds = englitCategoryBounds(); const cats = Object.keys(ENGLIT_FULL_TARGET.categories);
const cost = (vec: Record<string, number>) => cats.reduce((a, c) => a + Math.abs((vec[c] ?? 0) - ENGLIT_FULL_TARGET.categories[c]), 0);
const feasible = (vec: Record<string, number>) => cats.every((c) => (vec[c] ?? 0) >= bounds[c].min && (vec[c] ?? 0) <= bounds[c].max);

/** 시험별로 두 세트(또는 한 세트)의 부분집합 조합을 전부 보고, 전체 범주 구성이 상·하한 안이고 키 위치가 균형인 조합 중 공식 목표에 가장 가까운(동점이면 키 신뢰도 합이 큰) 것을 고른다. */
export function selectItems(cand: Record<string, Json[]>): { picks: Record<string, number[]>; report: Json } {
  const snap = rd<Snap>("data/ap/stock/lt1-lt2-published-v1-slots.json"); const { all } = loadLtPool({ requireScreen: false }); const by = new Map(all.map((c) => [c.key, c]));
  const picks: Record<string, number[]> = {}; const report: Json = {};
  for (const exam of ["LT1", "LT2"] as const) {
    const ids = Object.keys(SLOTS).filter((k) => SLOTS[k].exam === exam && cand[k]); if (!ids.length) continue;
    const base = catVec([...resultOf(exam, stage1Slots(exam, snap, by), by).sets.flatMap((s) => s.members.map((m) => m.skill))]);
    for (const k of ids) for (const m of by.get(SLOTS[k].replaceKey)!.members) base[m.cat] = (base[m.cat] ?? 0) - 1;
    const opts = ids.map((k) => { const items = cand[k]; if (items.length < SLOTS[k].n) throw new Error(`${k}: 검증 통과 ${items.length} < 슬롯 크기 ${SLOTS[k].n}`); return [...combos(items.length, SLOTS[k].n)].filter((c) => keyPositionViolations(c.map((i) => items[i].key_index)).length === 0 && c.filter((i) => String(items[i].skill).startsWith("2.")).length <= 1); });
    opts.forEach((o, i) => { if (!o.length) throw new Error(`${ids[i]}: 키 위치 균형·설정 ≤1 을 만족하는 부분집합이 없음`); });
    let best: { sel: number[][]; cost: number; conf: number; vec: Record<string, number> } | null = null; let checked = 0;
    const rec = (i: number, sel: number[][], vec: Record<string, number>) => {
      if (i === ids.length) { checked++; if (!feasible(vec)) return; const longest = sel.reduce((a, sl, j) => a + sl.filter((idx) => { const it = cand[ids[j]][idx]; const L = it.options.map((o: Json) => String(o.text).length); return L[it.key_index] >= Math.max(...L); }).length, 0); const c = cost(vec) + 5 * longest; const conf = sel.reduce((a, s, j) => a + s.reduce((x, idx) => x + (cand[ids[j]][idx].key_confidence?.score ?? 0), 0), 0); if (!best || c < best.cost || (c === best.cost && conf > best.conf)) best = { sel: sel.map((s) => s.slice()), cost: c, conf, vec: { ...vec } }; return; }
      for (const c of opts[i]) { const v2 = { ...vec }; for (const idx of c) { const k = englitCategoryOf(cand[ids[i]][idx].skill) ?? "?"; v2[k] = (v2[k] ?? 0) + 1; } rec(i + 1, [...sel, c], v2); }
    };
    rec(0, [], base);
    if (!best) throw new Error(`${exam}: 범주 상·하한을 만족하는 부분집합 조합이 없음(후보 ${ids.map((k) => cand[k].length).join("/")})`);
    const b = best as { sel: number[][]; cost: number; conf: number; vec: Record<string, number> }; ids.forEach((k, j) => { picks[k] = b.sel[j]; }); report[exam] = { sets: ids, candidates: ids.map((k) => cand[k].length), combinationsChecked: checked, categories: b.vec, distanceToOfficialTarget: b.cost, bounds: Object.fromEntries(cats.map((c) => [c, [bounds[c].min, bounds[c].max]])) };
  }
  return { picks, report };
}

export function build() {
  const mc = rd<Json[]>(path.join(EDIR, "real-sample-items.json")); const frqFile = path.join(EDIR, "real-sample-frq.json"); const frq = existsSync(frqFile) ? rd<Json[]>(frqFile) : [];
  const out: Json[] = []; const stockFields = (c: Json, id: string, replaces: string) => ({ ...c, stockKey: `${RUN}:${c.candidateKey}`, run: RUN, pipeline: "real_text_v1", validation: "auto_passed", reviewState: "verified_by_independent_models", gateVersion: LOAD, gateOverride: LOAD, releaseTier: "candidate", expertStatus: "unreviewed", renderVerified: false, screenVerified: false, reviewEnvReady: false,
    selectedForSample: true, legacyReserve: false, family: "ap_english_literature", itemFamilyId: `fam:${RUN}:${c.candidateKey}`, canonicalKey: `${RUN}:${c.candidateKey}`, duplicateOf: null, duplicateReason: null, contentKey: `ap_english_literature:${c.keywordCode}`, sharedWith: [],
    stockCell: `ap_english_literature|${c.keywordCode}|${c.skillPrimary}|${c.structure}|na`, history: [{ run: RUN, gateVersion: LOAD, outcome: "passed", reasons: null }], stimulusOrigin: "real_public_domain_text", sourceRegistryIds: [c.registryId ?? c.payload?.real_text?.registry_id ?? c.payload?.provenance?.registry_id].filter(Boolean), replaces });
  const sets = Object.fromEntries(Object.keys(SLOTS).map((k) => [k, mc.find((x) => x.cellId.endsWith(`-${k}`) && x.reviewState === "auto_passed")])) as Record<string, Json | undefined>;
  const cand = Object.fromEntries(Object.entries(sets).filter(([, v]) => v).map(([k, v]) => [k, v!.payload.items as Json[]]));
  const { picks, report } = selectItems(cand);
  for (const k of Object.keys(SLOTS)) { const c = sets[k]; if (!c) throw new Error(`세트 ${k} 없음`); const e = entry(c.registryId); const set = realSet(e, textOf(e)); const p = JSON.parse(JSON.stringify(c.payload)) as Json;
    const kept = picks[k].map((i) => p.items[i]); const dropped = (p.items as Json[]).filter((_, i) => !picks[k].includes(i));
    kept.forEach((it: Json, n: number) => { it.topic = ltTopicFor(it.skill, p.lt_passage.group, n); it.archetype = `lt_${p.lt_passage.group}_${String(it.skill).replace(".", "")}`; });
    p.items = kept; p.surplus_items = dropped.map((it: Json) => ({ skill: it.skill, stem: String(it.stem).slice(0, 140), reason: "verified_but_not_selected (slot size and exam category balance)" })); p.assignable_size = kept.length >= 8 && kept.length <= 13; p.set_note = "";
    p.set_intro = realDisplay(set as never, e); p.skill = kept[0].skill; p.topic = kept[0].topic; p.excluded_items_note = "Excluded and never shown: items that failed a gate, a blind solver, the adversary, the judge or the Fable panel. See excluded_items; verified surplus items not needed for the slot size are listed in surplus_items.";
    out.push(stockFields({ ...c, payload: p, keywordCode: kept[0].topic, unitCode: (kept[0].topic.match(/^U(\d)/) ?? [])[1] ?? "", skillPrimary: kept[0].skill, archetype: p.archetype, difficulty: kept.map(() => ({ label: "exam_prep" })) }, k, SLOTS[k].replaces)); }
  for (const c of frq) { const id = String(c.cellId).split("-").pop()!; if (c.reviewState !== "auto_passed") throw new Error(`FRQ ${id} 가 통과하지 못함: ${c.rejectionReason}`); const e = entry(c.payload.lit_frq.passage.provenance.registry_id); const p = JSON.parse(JSON.stringify(c.payload)) as Json;
    const q = c.payload.lit_frq.passage; p.set_intro = realDisplay({ title: q.title, headnote: q.headnote, stanzas: q.stanzas, provenance: { author_alias: q.provenance.author_alias } }, e); out.push(stockFields({ ...c, payload: p, difficulty: undefined, registryId: e.id }, id, REPLACES_FRQ[id])); }
  return { out, report };
}
if (process.argv[1]?.endsWith("englit-real-stage2-build.ts")) {
  const { out, report } = build(); console.log(out.map((i) => `${i.stockKey} ${i.kind} ${i.kind === "mc" ? i.payload.items.length : ""} ${i.payload.set_intro.split("\n")[0].slice(0, 110)}`).join("\n")); console.log(JSON.stringify(report));
  if (process.argv.includes("--write")) {
    writeFileSync("data/ap/stock/lt-real-2-items.json", JSON.stringify(out, null, 1) + "\n"); writeFileSync("data/ap/stock/lt-real-2-pass-keys.json", JSON.stringify(out.map((i) => i.stockKey), null, 1) + "\n");
    writeFileSync("data/ap/stock/lt-real-2-summary.json", JSON.stringify({ run: RUN, generatedAt: "2026-10-15", execution: EXEC, passed: out.map((i) => ({ stockKey: i.stockKey, replaces: i.replaces })), selection: report, frqProcessEssay: existsSync(path.join(EDIR, "frq-processessay.json")) ? (() => { const j = rd<Json>(path.join(EDIR, "frq-processessay.json")); return { path: "production processEssay (2 runs, lower kept), rubric englit-v1, leave-one-out anchors", rows: j.rows.map((r: Json) => ({ cell: r.cell, tier: r.tier, target: r.target, got: r.got, status: r.status })), mae: j.mae, ordering: j.ordering }; })() : null, unresolved: existsSync(path.join(EDIR, "mc-unresolved.json")) ? rd<Json[]>(path.join(EDIR, "mc-unresolved.json")).map((u) => ({ set: u.set, entry: u.entry, skill: u.skill, reasons: u.reasons })) : [] }, null, 1) + "\n"); console.log("wrote lt-real-2 items/pass-keys/summary");
  }
}
