// weak.ts 결과 요약: 라벨·체계별 평균 정답률, 루브릭 점수, 둘의 상관. 실행: npx tsx scripts/mock-exam-generation/weak-stats.ts --run <id>
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
const dir = path.resolve("data/mock-exam-generation", process.argv[process.argv.indexOf("--run") + 1], "weak");
type W = { gid: string; system: string; label: string; acc: number; rubric: { score: number; steps: number; concepts: number; traps: number } };
const all = readdirSync(dir).map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf-8")) as W);
const out: Record<string, unknown> = {};
for (const sys of ["sat_rw", "sat_math"]) for (const l of ["easy", "medium", "hard"]) {
  const g = all.filter((x) => x.system === sys && x.label === l);
  if (!g.length) continue;
  const mean = (f: (x: W) => number) => Math.round((g.reduce((a, x) => a + f(x), 0) / g.length) * 100) / 100;
  out[`${sys}/${l}`] = { n: g.length, meanAcc: mean((x) => x.acc), accLe40: g.filter((x) => x.acc <= 0.4).length, meanRubric: mean((x) => x.rubric.score), rubricGe8: g.filter((x) => x.rubric.score >= 8).length };
}
// 상관(피어슨): 정답률 vs 루브릭 점수
const xs = all.map((x) => x.acc), ys = all.map((x) => x.rubric.score);
const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
const cov = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0), vx = xs.reduce((a, x) => a + (x - mx) ** 2, 0), vy = ys.reduce((a, y) => a + (y - my) ** 2, 0);
out.pearson_acc_vs_rubric = Math.round((cov / Math.sqrt(vx * vy || 1)) * 100) / 100;
out.total = all.length;
console.log(JSON.stringify(out, null, 1));
