// 라운드 5 패치 JSON 생성(로컬 파일만, DB 접근 없음): readout(현재 공개본) + lib/audit-fix/r5-edits.ts + RW 정리 결과(accepted 만).
//   npx tsx scripts/audit/r5-build-patches.ts   → data/audit/2026-10-14-r5-patches.json (+ overrides)
import { readFileSync, writeFileSync } from "node:fs";
import { buildPatch } from "../../lib/audit-fix/r2-edits";
import { buildTrimPatch, EDITS5 } from "../../lib/audit-fix/r5-edits";
import type { Overrides, Patch, ProblemReadout } from "../../lib/audit-fix/plan";

const ro = JSON.parse(readFileSync("data/audit/2026-10-14-r5-readout.json", "utf-8")) as { problems: ProblemReadout[] };
const byId = new Map(ro.problems.map((p) => [p.problem_id, p]));
const patches: Patch[] = []; const overrides: Overrides = {};
for (const def of EDITS5) {
  const pr = byId.get(def.problemId!); if (!pr?.pub) throw new Error(`${def.id}: problem not found in readout`);
  const { patch, override } = buildPatch(def, pr.pub, pr.pub.id); patches.push(patch); if (override) overrides[def.id] = override;
}
const trim = JSON.parse(readFileSync("data/audit/2026-10-14-r5-trim-results.json", "utf-8")) as { results: { problemId: string; versionId: string; accepted: boolean; newPassage?: string; reason: string; wordsBefore: number; wordsAfter?: number }[] };
let n = 0;
for (const r of trim.results.filter((x) => x.accepted)) {
  const pr = byId.get(r.problemId); if (!pr?.pub || pr.pub.id !== r.versionId) throw new Error(`${r.problemId}: published version changed since the trim run`);
  patches.push(buildTrimPatch(r.problemId, r.versionId, pr.pub.passage ?? "", r.newPassage!, `${r.wordsBefore} -> ${r.wordsAfter} words. ${r.reason}`)); n++;
}
writeFileSync("data/audit/2026-10-14-r5-patches.json", JSON.stringify({ kind: "sat_problem_patch_list_round5", generatedBy: "scripts/audit/r5-build-patches.ts (lib/audit-fix/r5-edits.ts + r5-trim results)", count: patches.length, patches }, null, 1) + "\n");
writeFileSync("data/audit/2026-10-14-r5-overrides.json", JSON.stringify(overrides, null, 1) + "\n");
console.log(`patches ${patches.length} (edits ${EDITS5.length}, trims ${n}), overrides ${Object.keys(overrides).length}`);
