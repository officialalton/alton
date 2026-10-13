// AP Statistics S1 파일럿 마무리(LLM·DB 없음): 세 런(<run>-final/candidates.json)을 재고 행으로 만들어 data/ap/stock/stats-s1-items.json 과 통과 키 파일을 쓰고,
// 구조 look-alike(전체 재고 + 파일럿)와 문항군을 계산해 data/ap/stock/stats-s1-summary.json 에 남긴다.
//   npx tsx scripts/ap-generation/stats-finalize.ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LATEST_GATE, buildStock, type RawCand } from "../../lib/ap-generation/stock";
import { generatorDefects } from "../../lib/ap-generation/generator-defects";
import { clusterLookAlikes, type LookAlikeInput } from "../../lib/ap-exam/look-alike";

export const STATS_S1_RUNS = ["stats-s1-l-final", "stats-s1-m-final", "stats-s1-h-final"];
const root = path.resolve("data/ap/sample-2027"), out = path.resolve("data/ap/stock");
const runs: Record<string, RawCand[]> = {};
for (const r of STATS_S1_RUNS) { const f = path.join(root, r, "candidates.json"); if (existsSync(f)) runs[r] = (JSON.parse(readFileSync(f, "utf-8")) as RawCand[]).map((c) => ({ ...c, gateOverride: LATEST_GATE } as RawCand)); }
const items = buildStock(runs, {});
writeFileSync(path.join(out, "stats-s1-items.json"), JSON.stringify(items.map((i) => ({ ...i })), null, 0));
const pass = items.filter((i) => i.validation === "auto_passed" && !i.duplicateOf && generatorDefects(i.payload).length === 0);
writeFileSync(path.join(out, "stats-s1-pass-keys.json"), "[\n" + pass.map((r) => JSON.stringify(r.stockKey)).join(",\n") + "\n]\n");

// look-alike: 전체 기존 재고 MC + 파일럿 항목끼리
type Raw = { stockKey: string; apSubjectCode: string; kind: string; validation: string; keywordCode: string; itemFamilyId: string; payload: Record<string, unknown>; duplicateOf?: string | null };
const P = (r: { payload: Record<string, unknown> }) => r.payload as { archetype?: string; stem?: string; stimulus?: { kind?: string }; blueprint?: { student_thinking?: string[] } };
const stockFiles = ["items", "s1a-items", "v1ab-items", "v45ab-items", "bc-topup-items"];
const stock = stockFiles.flatMap((f) => JSON.parse(readFileSync(path.join(out, `${f}.json`), "utf-8")) as Raw[]).filter((i) => i.validation === "auto_passed" && !i.duplicateOf && i.kind === "mc");
const toIn = (i: Raw): LookAlikeInput => ({ key: i.stockKey, family: i.itemFamilyId, archetype: P(i).archetype, topic: i.keywordCode, stimKind: P(i).stimulus?.kind ?? "none", stem: P(i).stem ?? "", thinking: P(i).blueprint?.student_thinking });
const pilotIn = pass.map((i) => toIn(i as unknown as Raw));
const all = [...stock.map(toIn), ...pilotIn];
const cl = clusterLookAlikes(all);
const pilotKeys = new Set(pilotIn.map((x) => x.key));
const withPilot = cl.clusters.filter((c) => c.keys.some((k) => pilotKeys.has(k)));
const byArchetype = new Map<string, number>(); for (const i of pass) byArchetype.set(String(i.archetype), (byArchetype.get(String(i.archetype)) ?? 0) + 1);
const families = new Set(pass.map((i) => i.itemFamilyId));
const summary = { runs: STATS_S1_RUNS.filter((r) => runs[r]), rows: items.length, passed: pass.length, rejected: items.filter((i) => i.validation === "rejected").length, exactDuplicates: items.filter((i) => i.validation === "exact_duplicate").length,
  uniqueItems: pass.length, structureFamilies: byArchetype.size, itemFamilyIds: families.size, perUnit: pass.reduce<Record<string, number>>((m, i) => ((m[i.unitCode] = (m[i.unitCode] ?? 0) + 1), m), {}), perSkillCategory: pass.reduce<Record<string, number>>((m, i) => ((m[i.skillPrimary.split(".")[0]] = (m[i.skillPrimary.split(".")[0]] ?? 0) + 1), m), {}),
  lookAlikeClustersContainingPilot: withPilot, lookAlikeComparedAgainst: `${stock.length} existing auto_passed MC (all subjects) + ${pilotIn.length} pilot items` };
writeFileSync(path.join(out, "stats-s1-summary.json"), JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ ...summary, lookAlikeClustersContainingPilot: withPilot.length }, null, 1));
