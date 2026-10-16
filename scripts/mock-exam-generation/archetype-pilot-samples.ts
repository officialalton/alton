// 파일럿 원형의 Preview 육안 확인용 샘플(원형당 2건)을 import.ts 호환 passed.json 으로 만든다. DB·API 없음.
// 실행: npx tsx scripts/mock-exam-generation/archetype-pilot-samples.ts [--out data/mock-exam-generation/math-archetype-pilot] [--per 2]
// 로컬 Preview 확인: npx tsx scripts/mock-exam-generation/import.ts --file <out>/passed.json --tag math-archetype-pilot   (총괄이 대상 DB 를 지정)
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ARCHETYPES } from "../../lib/problem-generation/math-archetypes/registry";
import { produceFromArchetypes } from "../../lib/problem-generation/math-archetypes/bulk";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const out = path.resolve(arg("--out") ?? "data/mock-exam-generation/math-archetype-pilot"); const per = Number(arg("--per") ?? 2);
mkdirSync(out, { recursive: true });
const records = []; const list: string[] = [];
for (const a of ARCHETYPES) {
  const { records: rs } = produceFromArchetypes([a], { runId: "math-archetype-pilot", count: per, seedStart: 0 });
  for (const r of rs) { records.push(r); list.push(`${a.id}\tseed ${(r.quality as { mockExamGeneration: { seed: number } }).mockExamGeneration.seed}\t${r.gid}\t${r.subpattern}`); }
}
writeFileSync(path.join(out, "passed.json"), JSON.stringify(records, null, 1));
writeFileSync(path.join(out, "samples.tsv"), ["archetype\tseed\tgid\tsubpattern", ...list].join("\n") + "\n");
console.log(`records ${records.length} -> ${out}`);
