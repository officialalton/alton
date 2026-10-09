// 문학 hard 레시피 v4 소규모 시험 계획(2026-10-01): 11유형 x 3 후보(장르 3종 순환) = hard 배치 1개.
//   npx tsx scripts/rw-generation/hard-pilot-plan.ts            -> data/rw-generation/plan-lit-hard-v4-pilot.json
//   npx tsx scripts/rw-generation/session-cli.ts prepare --run lit-hard-v4-pilot --plan data/rw-generation/plan-lit-hard-v4-pilot.json --batch hardv4-hard-01
import { writeFileSync, mkdirSync } from "node:fs";
import { loadRecipesAll, LITERARY_QUESTION_TYPES } from "./recipe-v3";
import { QTYPES, type PlanBatch } from "./batch-plan";

export const PILOT_BATCH_ID = "hardv4-hard-01";

export function buildHardPilotPlan(perType = 3, recipes = loadRecipesAll()): { batches: PlanBatch[] } {
  const cells: PlanBatch["cells"] = [];
  for (const t of LITERARY_QUESTION_TYPES) {
    const q = QTYPES.find((x) => x.type === t)!;
    const r = (recipes[q.skill] ?? []).find((x) => x.questionType === t && x.difficulty === "hard");
    if (!r) throw new Error(`hard 레시피 없음: ${q.skill}/${t}`);
    for (let i = 0; i < perType; i++) {
      const genre = r.genres[i % r.genres.length];
      const hit = cells.find((c) => c.skill === q.skill && c.questionType === t && c.genre === genre);
      if (hit) hit.count++; else cells.push({ skill: q.skill, questionType: t, genre, count: 1 });
    }
  }
  const n = cells.reduce((a, c) => a + c.count, 0);
  return { batches: [{ batchId: PILOT_BATCH_ID, route: "ai_passage", difficulty: "hard", candidates: n, cells, estCostSyncUsd: 0, estCostBatchUsd: 0 }] };
}

if (process.argv[1]?.endsWith("hard-pilot-plan.ts")) {
  mkdirSync("data/rw-generation", { recursive: true });
  const plan = buildHardPilotPlan(Number(process.argv[2] ?? 3));
  writeFileSync("data/rw-generation/plan-lit-hard-v4-pilot.json", JSON.stringify(plan, null, 1) + "\n");
  console.log(`hard 시험 배치 ${PILOT_BATCH_ID}: 후보 ${plan.batches[0].candidates}건`);
}
