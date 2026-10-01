// 담당 D 원형(hard+easy/medium) 시드 스윕 — 실행: npx tsx scripts/mock-exam-generation/archetype-sweep-d.ts [--seeds 5000] [--id lat.] [--json out.json]
import { writeFileSync } from "node:fs";
import { D_ARCHETYPES } from "../../lib/problem-generation/math-archetypes/registry-d";
import { sweepLevel } from "../../lib/problem-generation/math-archetypes/levels-d";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const seeds = Number(arg("--seeds") ?? 3000); const prefix = arg("--id") ?? "";
const rows = D_ARCHETYPES.filter((a) => a.id.startsWith(prefix)).map((a) => sweepLevel(a, seeds));
for (const r of rows) console.log(`${r.id.padEnd(52)} ${r.level.padEnd(6)} produced ${r.produced}/${r.seeds} genFail ${r.genFail} thrown ${r.thrown} verifyFail ${r.verifyFail} independent ${r.independent} byVariant ${JSON.stringify(r.independentByVariant)}${r.failSeeds.length ? "\n   FAIL " + JSON.stringify(r.failSeeds[0]) : ""}${r.thrownSamples.length ? "\n   THROW " + r.thrownSamples[0] : ""}`);
if (arg("--json")) writeFileSync(arg("--json")!, JSON.stringify(rows, null, 1));
