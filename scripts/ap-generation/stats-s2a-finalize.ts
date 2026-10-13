// AP Statistics S2-a 마무리(LLM·DB 없음): 세 런(<run>/candidates.json: 단독·공유 세트·FRQ)을 재고 행으로 만들어 data/ap/stock/stats-s2a-items.json 과 통과 키 파일을 쓰고,
// 구조 look-alike(기존 전체 재고 + S1 파일럿 + 이번 배치)·문항군·비용(런·단계별)을 data/ap/stock/stats-s2a-summary.json 에 남긴다.
//   npx tsx scripts/ap-generation/stats-s2a-finalize.ts [--runs stats-s2a-a,stats-s2a-b,stats-s2a-c]
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LATEST_GATE, buildStock, type RawCand } from "../../lib/ap-generation/stock";
import { generatorDefects } from "../../lib/ap-generation/generator-defects";
import { clusterLookAlikes, type LookAlikeInput } from "../../lib/ap-exam/look-alike";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
export const STATS_S2A_RUNS = arg("--runs", "stats-s2a-a,stats-s2a-b,stats-s2a-c").split(",");
const root = path.resolve("data/ap/sample-2027"), out = path.resolve("data/ap/stock");
const runs: Record<string, RawCand[]> = {};
for (const r of STATS_S2A_RUNS) { const f = path.join(root, r, "candidates.json"); if (existsSync(f)) runs[r] = (JSON.parse(readFileSync(f, "utf-8")) as RawCand[]).map((c) => ({ ...c, gateOverride: LATEST_GATE } as RawCand)); }
const items = buildStock(runs, {});
// DB 제약(ap_candidate_items.structure ∈ standalone / shared_stimulus_set / frq_multipart): 파이프라인 내보내기는 'shared_set' 으로 적었으므로 재고 행에서 정식 값으로 바꾼다(동결된 pipeline2.ts 는 건드리지 않는다).
for (const i of items) if (Array.isArray(i.payload.items)) { i.structure = "shared_stimulus_set"; i.stockCell = i.stockCell.replace("|shared_set|", "|shared_stimulus_set|"); }
writeFileSync(path.join(out, "stats-s2a-items.json"), JSON.stringify(items.map((i) => ({ ...i })), null, 0));
const pass = items.filter((i) => i.validation === "auto_passed" && !i.duplicateOf && generatorDefects(i.payload).length === 0);
writeFileSync(path.join(out, "stats-s2a-pass-keys.json"), "[\n" + pass.map((r) => JSON.stringify(r.stockKey)).join(",\n") + "\n]\n");

type Raw = { stockKey: string; apSubjectCode: string; kind: string; validation: string; keywordCode: string; itemFamilyId: string; payload: Record<string, unknown>; duplicateOf?: string | null };
const first = (r: { payload: Record<string, unknown> }) => (Array.isArray(r.payload.items) ? (r.payload.items as Record<string, unknown>[])[0] : r.payload) as { archetype?: string; stem?: string; blueprint?: { student_thinking?: string[] } };
const P = (r: { payload: Record<string, unknown> }) => r.payload as { archetype?: string; stimulus?: { kind?: string } };
const stockFiles = ["items", "s1a-items", "v1ab-items", "v45ab-items", "bc-topup-items", "stats-s1-items"];
const stock = stockFiles.filter((f) => existsSync(path.join(out, `${f}.json`))).flatMap((f) => JSON.parse(readFileSync(path.join(out, `${f}.json`), "utf-8")) as Raw[]).filter((i) => i.validation === "auto_passed" && !i.duplicateOf && i.kind === "mc");
const toIn = (i: Raw): LookAlikeInput => ({ key: i.stockKey, family: i.itemFamilyId, archetype: P(i).archetype, topic: i.keywordCode, stimKind: P(i).stimulus?.kind ?? "none", stem: String(first(i).stem ?? ""), thinking: first(i).blueprint?.student_thinking });
const mcPass = pass.filter((i) => i.kind === "mc");
const pilotIn = mcPass.map((i) => toIn(i as unknown as Raw));
const cl = clusterLookAlikes([...stock.map(toIn), ...pilotIn]);
const pilotKeys = new Set(pilotIn.map((x) => x.key));
const withPilot = cl.clusters.filter((c) => c.keys.some((k) => pilotKeys.has(k)));

// 비용: 런별·단계별(결과 파일의 cost 합)
const stageCost = (dir: string) => { const o: Record<string, number> = {}; for (const f of readdirSync(dir)) { const m = f.match(/^(.*)\.results\.jsonl$/); if (!m) continue; o[m[1]] = Number(readFileSync(path.join(dir, f), "utf-8").split("\n").filter(Boolean).reduce((a, l) => { try { return a + Number(JSON.parse(l).cost ?? 0); } catch { return a; } }, 0).toFixed(4)); } return o; };
const costs = Object.fromEntries(STATS_S2A_RUNS.filter((r) => existsSync(path.join(root, r))).map((r) => { const s = stageCost(path.join(root, r)); return [r, { byStage: s, total: Number(Object.values(s).reduce((a, b) => a + b, 0).toFixed(4)) }]; }));
const memberOf = (i: { kind: string; keywordCode: string; skillPrimary?: string; payload: Record<string, unknown> }) => (Array.isArray(i.payload.items) ? (i.payload.items as { topic: string; skill: string }[]).map((m) => ({ unit: m.topic.split(".")[0], skill: m.skill[0] })) : i.kind === "mc" ? [{ unit: i.keywordCode.split(".")[0], skill: String(i.skillPrimary ?? "0")[0] }] : []);
const tally = (f: (m: { unit: string; skill: string }) => string) => mcPass.flatMap((i) => memberOf(i as never)).reduce<Record<string, number>>((m, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {});
const byKind = (k: string) => items.filter((i) => i.kind === k);
const sets = pass.filter((i) => Array.isArray(i.payload.items));
const summary = {
  runs: STATS_S2A_RUNS.filter((r) => runs[r]), rows: items.length, passed: pass.length, rejected: items.filter((i) => i.validation === "rejected").length, exactDuplicates: items.filter((i) => i.validation === "exact_duplicate").length,
  singles: { candidates: byKind("mc").filter((i) => !Array.isArray(i.payload.items)).length, passed: mcPass.filter((i) => !Array.isArray(i.payload.items)).length },
  sets: { candidates: byKind("mc").filter((i) => Array.isArray(i.payload.items)).length, passed: sets.length, questionsInPassedSets: sets.length * 3 },
  frq: { candidates: byKind("frq_bundle").length, passed: pass.filter((i) => i.kind === "frq_bundle").length },
  uniquePassedItems: mcPass.flatMap((i) => memberOf(i as never)).length + pass.filter((i) => i.kind === "frq_bundle").length,
  structureFamilies: new Set(pass.map((i) => String(P(i).archetype))).size, itemFamilyIds: new Set(pass.map((i) => i.itemFamilyId)).size,
  perUnit: tally((m) => m.unit), perSkillCategory: tally((m) => m.skill),
  rejectionReasons: items.filter((i) => i.validation === "rejected").map((i) => ({ key: i.stockKey, reason: i.rejectionReason })),
  costs, totalUsd: Number(Object.values(costs).reduce((a, c) => a + c.total, 0).toFixed(4)),
  lookAlikeClustersContainingBatch: withPilot, lookAlikeComparedAgainst: `${stock.length} existing auto_passed MC (all subjects incl. the S1 pilot) + ${pilotIn.length} S2-a items`,
};
writeFileSync(path.join(out, "stats-s2a-summary.json"), JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ ...summary, lookAlikeClustersContainingBatch: withPilot.length, rejectionReasons: summary.rejectionReasons.length }, null, 1));
