// AP English Literature LT5 FRQ Q1(시 분석) 배치 `lt-real-6` 생성기(2026-10-22, 무료·DB 없음). stage3 의 FRQ 처리만 떼어 쓴다(MC 부분집합 선택 없음).
//   REAL_RUNS=englit-real-12 npx tsx scripts/ap-generation/englit-real-stage6-build.ts [--write]
// 입력: 실행 폴더들의 real-sample-frq.json + 등록부. 출력: data/ap/stock/lt-real-6-{items,pass-keys,summary}.json. 지문 본문은 등록부 저장 텍스트 그대로.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { realDisplay } from "../../lib/ap-generation/englit-real";
import type { Registry, SourceEntry } from "../../lib/ap-generation/englit-sources";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const SRC = path.resolve("data/ap/englit-sources"); const RUN = "lt-real-6"; const LOAD = "lt-real-6-2026-10-22"; const EXECS = (process.env.REAL_RUNS ?? "englit-real-12").split(",");
const rd = <T>(p: string): T => JSON.parse(readFileSync(p, "utf-8")) as T;
const reg = rd<Registry>(path.join(SRC, "registry.json")); const entry = (id: string): SourceEntry => reg.entries.find((e) => e.id === id)!;
const stockFields = (c: Json, replaces: string) => ({ ...c, stockKey: `${RUN}:${c.candidateKey}`, run: RUN, pipeline: "real_text_v1", validation: "auto_passed", reviewState: "verified_by_independent_models", gateVersion: LOAD, gateOverride: LOAD, releaseTier: "candidate", expertStatus: "unreviewed", renderVerified: false, screenVerified: false, reviewEnvReady: false,
  selectedForSample: true, legacyReserve: false, family: "ap_english_literature", itemFamilyId: `fam:${RUN}:${c.candidateKey}`, canonicalKey: `${RUN}:${c.candidateKey}`, duplicateOf: null, duplicateReason: null, contentKey: `ap_english_literature:${c.keywordCode}`, sharedWith: [],
  stockCell: `ap_english_literature|${c.keywordCode}|${c.skillPrimary}|${c.structure}|na`, history: [{ run: RUN, gateVersion: LOAD, outcome: "passed", reasons: null }], stimulusOrigin: "real_public_domain_text", sourceRegistryIds: [c.registryId ?? c.payload?.real_text?.registry_id ?? c.payload?.provenance?.registry_id].filter(Boolean), replaces });
export function build() {
  const out: Json[] = [];
  for (const ex of EXECS) { const ff = path.resolve("data/ap/sample-2027", ex, "real-sample-frq.json"); if (!existsSync(ff)) continue;
    for (const c of rd<Json[]>(ff)) { const id = String(c.cellId).split("-").pop()!; if (c.reviewState !== "auto_passed") { console.log(`FRQ ${id} 미통과: ${c.rejectionReason}`); continue; }
      const e = entry(c.payload.lit_frq.passage.provenance.registry_id); const p = JSON.parse(JSON.stringify(c.payload)) as Json; const q = c.payload.lit_frq.passage;
      p.set_intro = realDisplay({ title: q.title, headnote: q.headnote, stanzas: q.stanzas, provenance: { author_alias: q.provenance.author_alias } }, e); out.push(stockFields({ ...c, payload: p, difficulty: undefined, registryId: e.id }, "LT5 (new exam)")); } }
  return out;
}
if (process.argv[1]?.endsWith("englit-real-stage6-build.ts")) {
  const out = build(); console.log(out.map((i) => `${i.stockKey} ${i.kind}`).join("\n"));
  if (process.argv.includes("--write")) {
    writeFileSync("data/ap/stock/lt-real-6-items.json", JSON.stringify(out, null, 1) + "\n"); writeFileSync("data/ap/stock/lt-real-6-pass-keys.json", JSON.stringify(out.map((i) => i.stockKey), null, 1) + "\n");
    writeFileSync("data/ap/stock/lt-real-6-summary.json", JSON.stringify({ run: RUN, generatedAt: "2026-10-22", executions: EXECS, passed: out.map((i) => ({ stockKey: i.stockKey, replaces: i.replaces })) }, null, 1) + "\n"); console.log("wrote lt-real-6 items/pass-keys/summary");
  }
}
