// 라운드 2 패치 JSON 생성(로컬 파일만 읽고 쓴다, DB 접근 없음). readout(현재 공개본) + lib/audit-fix/r2-edits.ts → data/audit/2026-10-13-r2-patches.json (+ overrides).
//   npx tsx scripts/audit/r2-build-patches.ts [--readout data/audit/2026-10-13-r2-readout.json]
import { readFileSync, writeFileSync } from "node:fs";
import { buildPatch, EDITS } from "../../lib/audit-fix/r2-edits";
import type { Overrides, Patch, ProblemReadout } from "../../lib/audit-fix/plan";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const ro = JSON.parse(readFileSync(arg("--readout") ?? "data/audit/2026-10-13-r2-readout.json", "utf-8")) as { problems: ProblemReadout[] };
const patches: Patch[] = []; const overrides: Overrides = {};
for (const def of EDITS) {
  const pr = ro.problems.find((p) => (def.problemId ? p.problem_id === def.problemId : p.gid === def.gid));
  if (!pr?.pub) throw new Error(`${def.id}: problem not found in readout`);
  const { patch, override } = buildPatch(def, pr.pub, pr.pub.id);
  patches.push(patch); if (override) overrides[def.id] = override;
}
writeFileSync("data/audit/2026-10-13-r2-patches.json", JSON.stringify({ kind: "sat_problem_patch_list_round2", generatedBy: "scripts/audit/r2-build-patches.ts (lib/audit-fix/r2-edits.ts)", count: patches.length, patches }, null, 1) + "\n");
writeFileSync("data/audit/2026-10-13-r2-overrides.json", JSON.stringify(overrides, null, 1) + "\n");
console.log(`patches ${patches.length}, overrides ${Object.keys(overrides).length}`);
