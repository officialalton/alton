// 라운드 6 패치 JSON 생성(로컬 파일만, DB 접근 없음): readout(현재 공개본) + lib/audit-fix/r6-edits.ts.
//   npx tsx scripts/audit/r6-build-patches.ts   → data/audit/2026-10-15-r6-patches.json (+ overrides)
import { readFileSync, writeFileSync } from "node:fs";
import { buildPatch6, EDITS6, type F6 } from "../../lib/audit-fix/r6-edits";
import type { Overrides, Patch, ProblemReadout } from "../../lib/audit-fix/plan";

const ro = JSON.parse(readFileSync("data/audit/2026-10-15-r6-readout.json", "utf-8")) as { problems: ProblemReadout[] };
const byId = new Map(ro.problems.map((p) => [p.problem_id, p]));
const patches: Patch[] = [];
for (const def of EDITS6) {
  const pr = byId.get(def.problemId); if (!pr?.pub) throw new Error(`${def.id}: problem not found in readout`);
  const p = pr.pub;
  const cur: F6 = { passage: p.passage, question: p.question, options: p.options, correct_index: p.correct_index, explanation: p.explanation, explanation_en: p.explanation_en, figure: p.figure, statements: p.statements };
  patches.push(buildPatch6(def, cur, p.id));
}
const overrides: Overrides = {};
writeFileSync("data/audit/2026-10-15-r6-patches.json", JSON.stringify({ kind: "ap_problem_patch_list_round6", generatedBy: "scripts/audit/r6-build-patches.ts (lib/audit-fix/r6-edits.ts)", count: patches.length, patches }, null, 1) + "\n");
writeFileSync("data/audit/2026-10-15-r6-overrides.json", JSON.stringify(overrides, null, 1) + "\n");
console.log(`patches ${patches.length}`);
