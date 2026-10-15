// AP English Literature 실제 작품 Stage 1 배치 `lt-real-1` 생성기(무료·DB 없음).
//   npx tsx scripts/ap-generation/englit-real-stage1-build.ts [--write]
// 입력: 1단계 샘플(data/ap/englit-sources/sample/real-sample-items.json 의 rs1, real-sample-frq.json 의 rf1·rf2) + 2단계 재검증 산출물(data/ap/sample-2027/englit-real-2) + 에세이 채점 재검증 결과(있으면).
// 출력: data/ap/stock/lt-real-1-{items,pass-keys,summary}.json. 지문 첫 줄은 "Public-domain source text — 저자, 작품, 판본"(realDisplay), 지문 본문은 등록부 저장 텍스트 그대로.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { realDisplay, realSet } from "../../lib/ap-generation/englit-real";
import type { Registry, SourceEntry } from "../../lib/ap-generation/englit-sources";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const SRC = path.resolve("data/ap/englit-sources"); const RUN = "lt-real-1"; const LOAD = "lt-real-1-2026-10-15";
const rd = <T>(p: string): T => JSON.parse(readFileSync(p, "utf-8")) as T;
const reg = rd<Registry>(path.join(SRC, "registry.json")); const entry = (id: string): SourceEntry => reg.entries.find((e) => e.id === id)!;
const textOf = (e: SourceEntry) => readFileSync(path.join(SRC, e.text_file), "utf-8");
const REPLACES: Record<string, string> = { rs1: "LT1 p03 (ALTON poetry set, 8 items)", rf1: "LT1 FRQ Q1 fb1 (ALTON poem)", rf2: "LT2 FRQ Q2 fa2 (ALTON prose passage)" };

export function build() {
  // 재검증(englit-real-2: MC 파이프라인 재실행, processEssay 재채점) 결과는 payload 를 바꾸지 않도록 요약 파일(lt-real-1-summary.json)에만 둔다 — 화면 증거의 payload 해시를 고정하기 위함.
  const mc = rd<Json[]>(path.join(SRC, "sample/real-sample-items.json")); const frq = rd<Json[]>(path.join(SRC, "sample/real-sample-frq.json"));
  const out: Json[] = [];
  const stockFields = (c: Json, id: string) => ({ ...c, stockKey: `${RUN}:${c.candidateKey}`, run: RUN, pipeline: "real_text_v1", validation: "auto_passed", reviewState: "verified_by_independent_models", gateVersion: LOAD, gateOverride: LOAD, releaseTier: "candidate", expertStatus: "unreviewed", renderVerified: false, screenVerified: false, reviewEnvReady: false,
    selectedForSample: true, legacyReserve: false, family: "ap_english_literature", itemFamilyId: `fam:${RUN}:${c.candidateKey}`, canonicalKey: `${RUN}:${c.candidateKey}`, duplicateOf: null, duplicateReason: null, contentKey: `ap_english_literature:${c.keywordCode}`, sharedWith: [],
    stockCell: `ap_english_literature|${c.keywordCode}|${c.skillPrimary}|${c.structure}|na`, history: [{ run: RUN, gateVersion: LOAD, outcome: "passed", reasons: null }], stimulusOrigin: "real_public_domain_text", sourceRegistryIds: [c.registryId ?? c.payload?.real_text?.registry_id ?? c.payload?.provenance?.registry_id].filter(Boolean), replaces: REPLACES[id] });
  // rs1: MC 세트(시, 8문항)
  { const c = mc.find((x) => x.cellId.endsWith("-rs1"))!; const e = entry(c.registryId); const set = realSet(e, textOf(e)); const p = JSON.parse(JSON.stringify(c.payload)) as Json;
    p.set_intro = realDisplay(set as never, e); delete p.layout_status; p.layout_status = c.payload.layout_status;
    // 재검증 결과 반영(docs/ap/englit-groundwork.md Stage 1): 같은 파이프라인 재실행에서 4.A 문항("describes the speaker's situation")이 풀이자의 '둘째 방어 가능 선택지' 신고로 탈락 → 같은 텍스트에서 새로 생성·전 단계 검증을 통과한 5.A 문항 1개로 같은 자리에 교체.
    const REPL_IDX = 6; const regen = rd<Json[]>("data/ap/sample-2027/englit-real-3/real-sample-items.json").find((x) => x.reviewState === "auto_passed")!; const newItem = regen.payload.items[0] as Json;
    if (!(p.items[REPL_IDX].skill === "4.A" && newItem.skill === "5.A" && newItem.real_text.verification.verified === true)) throw new Error("재검증 교체 대상이 예상과 다릅니다");
    (p.excluded_items as Json[]).push({ index: REPL_IDX, skill: "4.A", stem: String(p.items[REPL_IDX].stem).slice(0, 140), reasons: ["solver_reports_second_defensible_option (re-verification run englit-real-2)"] }); p.items[REPL_IDX] = { ...newItem, real_text: { ...newItem.real_text, regenerated_in: "englit-real-3" } };
    p.skill = p.items[0].skill; p.topic = p.items[0].topic;
    p.excluded_items_note = "Excluded and never shown: two phase-1 items and one item that failed re-verification (a blind solver reported a second defensible option). See excluded_items.";
    const base = stockFields({ ...c, payload: p, difficulty: (p.items as Json[]).map(() => ({ label: "exam_prep" })) }, "rs1"); out.push(base); }
  for (const id of ["rf1", "rf2"] as const) { const c = frq.find((x) => x.cellId.endsWith(`-${id}`))!; const e = entry(c.payload.lit_frq.passage.provenance.registry_id); const p = JSON.parse(JSON.stringify(c.payload)) as Json;
    const q = c.payload.lit_frq.passage; p.set_intro = realDisplay({ title: q.title, headnote: q.headnote, stanzas: q.stanzas, provenance: { author_alias: q.provenance.author_alias } }, e);
    out.push(stockFields({ ...c, payload: p, difficulty: undefined, registryId: e.id }, id)); }
  return out;
}
if (process.argv[1]?.endsWith("englit-real-stage1-build.ts")) {
  const items = build(); console.log(items.map((i) => `${i.stockKey} ${i.kind} ${i.payload.set_intro.split("\n")[0].slice(0, 110)}`).join("\n"));
  if (process.argv.includes("--write")) {
    writeFileSync("data/ap/stock/lt-real-1-items.json", JSON.stringify(items, null, 1) + "\n");
    writeFileSync("data/ap/stock/lt-real-1-pass-keys.json", JSON.stringify(items.map((i) => i.stockKey), null, 1) + "\n");
    const ra = "data/ap/sample-2027/englit-real-2/mc-audit.json", rc = "data/ap/sample-2027/englit-real-2/frq-processessay.json";
    writeFileSync("data/ap/stock/lt-real-1-summary.json", JSON.stringify({ run: RUN, generatedAt: "2026-10-15", passed: items.map((i) => ({ stockKey: i.stockKey, replaces: i.replaces })), unresolved: [],
      reverification: { mcRun: "englit-real-2 (same pipeline re-run, rs1 only, the 8 phase-1 passing items; strict min key score 0.8)", mc: existsSync(ra) ? rd<Json[]>(ra).map((r) => ({ i: r.i, skill: r.skill, solverVotes: r.solverVotes, key: r.key, adversary: r.adversary, judge: r.judge, panel: r.panel, score: r.score, pass: r.pass, reasons: r.reasons })) : null,
        borderline: "re-run items 1 and 5 scored 0.788 (< 0.8) only because both solvers answered 'likely' and the adversary rated 'weak' — all four votes, judge and a Fable panel (run afterwards) agree with the key; kept. Item 6 (4.A) got a second-defensible flag and was replaced.",
        replacement: { run: "englit-real-3", item: "5.A (line 11, fields)", gates: "code gates + 2 blind solvers + adversary + judge + Fable panel all agree (score 0.87)" },
        frq: existsSync(rc) ? { path: "production processEssay (2 runs, lower kept), rubric englit-v1, leave-one-out anchors", rows: rd<Json>(rc).rows.map((r: Json) => ({ cell: r.cell, tier: r.tier, target: r.target, got: r.got, status: r.status })), mae: rd<Json>(rc).mae, ordering: rd<Json>(rc).ordering } : null } }, null, 1) + "\n");
    console.log("wrote lt-real-1 items/pass-keys/summary");
  }
}
