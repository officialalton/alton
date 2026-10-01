// 기존 컴파일러 전 세부 패턴 시드 스윕 CLI. 실행: npx tsx scripts/mock-exam-generation/math-compiler-sweep.ts [--seeds 3000] [--skill s] [--json out.json]
import { writeFileSync } from "node:fs";
import { allSweepCells, sweepCell, type SweepResult } from "../../lib/problem-generation/math-compilers/sweep";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const seeds = Number(arg("--seeds") ?? 3000); const only = arg("--skill");
const origLog = console.log; let totalBugs = 0, runs = 0; const table: string[] = []; const all: SweepResult[] = [];
console.log = () => {};
for (const cell of allSweepCells().filter((c) => !only || c.skill === only)) {
  let r = sweepCell(cell, seeds);
  // 자료 필수 유형(확률 비복원·산점도 등)은 자료 정책 없이 전부 거절되므로 require_data 로 다시 돌린다.
  if (r.accepted === 0 && Object.keys(r.rejected).some((k) => k.includes("자료 필수"))) { cell.figurePolicy = "require_data"; r = sweepCell(cell, seeds); }
  runs += r.runs; totalBugs += r.bugs.length; all.push(r);
  table.push(`${cell.skill}/${cell.kind ?? "-"}/${cell.difficulty}${cell.figurePolicy ? "[" + cell.figurePolicy + "]" : ""}: accepted ${r.accepted}/${r.runs} bugs ${r.bugs.length}` + (r.bugs.length ? ` e.g. seed ${r.bugs[0].seed} ${r.bugs[0].what}` : ""));
}
console.log = origLog;
origLog(table.join("\n")); origLog(`TOTAL runs ${runs} bugs ${totalBugs}`);
if (arg("--json")) writeFileSync(arg("--json")!, JSON.stringify(all.map((r) => ({ ...r, bugs: r.bugs.slice(0, 5) })), null, 1));
