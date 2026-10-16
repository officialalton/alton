// 원형 샘플 출력 — 실행: npx tsx scripts/mock-exam-generation/archetype-samples.ts --id rr.chained_conversion.chain2 [--n 2] [--seed 0]
import { ARCHETYPES } from "../../lib/problem-generation/math-archetypes/registry";
import { generateOne } from "../../lib/problem-generation/math-archetypes/sweep";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const id = arg("--id") ?? ""; const n = Number(arg("--n") ?? 2); let s = Number(arg("--seed") ?? 0);
for (const a of ARCHETYPES.filter((x) => x.id.startsWith(id))) {
  let shown = 0;
  console.log(`\n=== ${a.id} ===`);
  while (shown < n && s < 10000) { const g = generateOne(a, s++); if (!g.ok) continue; shown++; const i = g.inst; console.log(`[seed ${s - 1}] ${i.stimulus}\n  Q: ${i.question}\n  ${i.options.map((o, k) => `${"ABCD"[k]}) ${o}`).join("  ")}  -> ${"ABCD"[i.correctIndex]}\n  해설: ${i.explanation}`); }
}
