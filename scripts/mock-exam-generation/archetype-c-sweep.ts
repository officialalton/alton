// C 담당 원형(percentages·area_volume·circles hard + 5 skill easy/medium lite) 시드 스윕 — 실행: npx tsx scripts/mock-exam-generation/archetype-c-sweep.ts [--seeds 5000] [--shard 0/4] [--only id1,id2] [--out file.json]
import { writeFileSync } from "node:fs";
import { ARCHETYPES } from "../../lib/problem-generation/math-archetypes/registry";
import { LITE_C_ARCHETYPES } from "../../lib/problem-generation/math-archetypes/lite-c";
import { sweepArchetype } from "../../lib/problem-generation/math-archetypes/sweep";
import { sweepLite } from "../../lib/problem-generation/math-archetypes/c-lite";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const seeds = Number(arg("--seeds") ?? 5000); const [si, sn] = (arg("--shard") ?? "0/1").split("/").map(Number);
const C_SKILLS = ["percentages", "area_volume", "circles"];
type Job = { kind: "hard" | "lite"; id: string; run: () => unknown };
const jobs: Job[] = [
  ...ARCHETYPES.filter((a) => C_SKILLS.includes(a.skill)).map((a) => ({ kind: "hard" as const, id: a.id, run: () => ({ skill: a.skill, difficulty: "hard", ...sweepArchetype(a, seeds) }) })),
  ...LITE_C_ARCHETYPES.flatMap((a) => a.levels.map((lv) => ({ kind: "lite" as const, id: `${a.id}#${lv}`, run: () => ({ skill: a.skill, difficulty: lv, ...sweepLite(a, lv, seeds) }) }))),
];
const only = (arg("--only") ?? "").split(",").filter(Boolean); const mine = jobs.filter((j, i) => (only.length ? only.includes(j.id) : i % sn === si)); const rows: unknown[] = [];
for (const j of mine) { const r = j.run() as { id: string; produced: number; genFail: number; thrown: number; verifyFail: number; independent: number }; rows.push(r); console.log(`${j.id.padEnd(60)} produced ${r.produced}/${seeds} genFail ${r.genFail} thrown ${r.thrown} verifyFail ${r.verifyFail} independent ${r.independent}`); }
if (arg("--out")) writeFileSync(arg("--out")!, JSON.stringify(rows));
