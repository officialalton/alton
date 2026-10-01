// 담당 A 원형(nonlinear_equations_systems·nonlinear_functions·equivalent_expressions easy/medium) 시드 스윕 CLI.
// 합격 기준(완화 금지): 정답 재계산 불일치 0·선지 값 겹침 0·표기 위반 0·예외 0, 본문 유사도 0.6 미만 독립 변형 30 이상, 명사-수식 매핑 위반 0.
// 실행: npx tsx scripts/mock-exam-generation/archetype-sweep-a.ts [--seeds 5000] [--id nes.root] [--json out.json]
import { writeFileSync } from "node:fs";
import { A_ARCHETYPES } from "../../lib/problem-generation/math-archetypes/skills/a-registry";
import { checkSemantics } from "../../lib/problem-generation/math-archetypes/skills/a-kit";
import { bodyShingles, generateOne, jaccard } from "../../lib/problem-generation/math-archetypes/sweep";
import { verifyInstance } from "../../lib/problem-generation/math-archetypes/verify";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const seeds = Number(arg("--seeds") ?? 3000); const prefix = arg("--id") ?? "";
type Row = { id: string; difficulty: string; seeds: number; produced: number; genFail: number; thrown: number; verifyFail: number; semanticFail: number; independent: number; distinctParams: number; variants: Record<string, number>; firstFail?: string };
const rows: Row[] = [];
for (const a of A_ARCHETYPES.filter((x) => x.id.startsWith(prefix))) {
  const r: Row = { id: a.id, difficulty: a.difficulty ?? "hard", seeds, produced: 0, genFail: 0, thrown: 0, verifyFail: 0, semanticFail: 0, independent: 0, distinctParams: 0, variants: {} };
  const keep: Set<string>[] = []; const params = new Set<string>();
  for (let s = 0; s < seeds; s++) {
    const g = generateOne(a, s);
    if (!g.ok) { if (g.why === "genfail") r.genFail++; else { r.thrown++; r.firstFail ??= `THROW ${g.msg}`; } continue; }
    const v = verifyInstance(a, g.inst); const sem = checkSemantics(g.inst);
    if (!v.ok) { r.verifyFail++; r.firstFail ??= `seed ${s}: ${v.failures.join(" | ").slice(0, 200)}`; continue; }
    if (sem.length) { r.semanticFail++; r.firstFail ??= `seed ${s}: ${sem.join(" | ")}`; continue; }
    r.produced++; r.variants[g.inst.variant] = (r.variants[g.inst.variant] ?? 0) + 1; params.add(g.inst.verificationJs.split("\n")[0]);
    if (keep.length < 400) { const sh = bodyShingles(g.inst); if (keep.every((k) => jaccard(k, sh) < 0.6)) keep.push(sh); }
  }
  r.independent = keep.length; r.distinctParams = params.size; rows.push(r);
  console.log(`${r.id.padEnd(54)} ${r.difficulty.padEnd(6)} produced ${String(r.produced).padStart(5)}/${seeds} genFail ${r.genFail} thrown ${r.thrown} verifyFail ${r.verifyFail} semFail ${r.semanticFail} independent ${r.independent} distinctParams ${r.distinctParams} variants ${JSON.stringify(r.variants)}${r.firstFail ? "\n   FIRST " + r.firstFail : ""}`);
}
const bad = rows.filter((r) => r.verifyFail || r.thrown || r.semanticFail || r.independent < 30);
console.log(`\n${rows.length} archetypes, ${bad.length} not passing${bad.length ? ": " + bad.map((b) => b.id).join(", ") : ""}`);
if (arg("--json")) writeFileSync(arg("--json")!, JSON.stringify(rows, null, 1));
