// 단계 실행 결과 요약(무료·읽기 전용): npx tsx scripts/ap-generation/graph-verdicts.ts <run> [<run>...]
import { readFileSync } from "node:fs";
type V = { cellId: string; passed: boolean; reasons: string[] };
for (const run of process.argv.slice(2)) {
  const dir = `data/ap/sample-2027/${run}`;
  const v = JSON.parse(readFileSync(`${dir}/verdicts.json`, "utf-8")) as V[]; const cells = new Map((JSON.parse(readFileSync(`${dir}/cells.json`, "utf-8")) as { cellId: string; archetype: string }[]).map((c) => [c.cellId, c.archetype]));
  console.log(`${run}: 통과 ${v.filter((x) => x.passed).length} / ${v.length}`);
  for (const x of v) if (!x.passed) console.log("  반려", cells.get(x.cellId), x.reasons.join(","));
}
