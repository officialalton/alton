// 수학 hard 원형 시드 스윕 CLI — 실행: npx tsx scripts/mock-exam-generation/archetype-sweep.ts [--seeds 3000] [--id ee.] [--json out.json]
import { writeFileSync } from "node:fs";
import { ARCHETYPES } from "../../lib/problem-generation/math-archetypes/registry";
import { sweepArchetype } from "../../lib/problem-generation/math-archetypes/sweep";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const seeds = Number(arg("--seeds") ?? 3000); const prefix = arg("--id") ?? "";
const rows = ARCHETYPES.filter((a) => a.id.startsWith(prefix)).map((a) => sweepArchetype(a, seeds));
for (const r of rows) console.log(`${r.id.padEnd(46)} produced ${r.produced}/${r.seeds} genFail ${r.genFail} thrown ${r.thrown} verifyFail ${r.verifyFail} independent(<0.6) ${r.independent} variants ${JSON.stringify(r.variants)}${r.failSeeds.length ? "\n   FAIL " + JSON.stringify(r.failSeeds[0]) : ""}${r.thrownSamples.length ? "\n   THROW " + r.thrownSamples[0] : ""}`);
if (arg("--json")) writeFileSync(arg("--json")!, JSON.stringify(rows, null, 1));
