// Math 계산형 컴파일러로 hard 문항 생성 (2026-09-30 시험). 정답은 수식으로 보장된다. DB 접근 없음.
// 실행: npx tsx scripts/mock-exam-generation/compile.ts --run <id> --skill s --count N [--format mc|spr] [--tag c6]
// 저장: raw/<skill>__hard__<format>__<tag>__<gid>.json  (createdVia: "compiler", subpattern 포함 — import.ts 가 그대로 기록)
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
(async () => {
  const { runMathCompilerBatch } = await import("../../lib/problem-generation/math-compilers/batch");
  const { SKILL_BY_CODE } = await import("../../lib/problem-taxonomy");
  const runId = arg("--run")!, skill = arg("--skill")!, count = Number(arg("--count") ?? 10), format = (arg("--format") ?? "mc") as "mc" | "spr", tag = arg("--tag") ?? "c6";
  const fig = skill === "lines_angles_triangles" ? "require_geometry" : undefined;
  const res = await runMathCompilerBatch({ skillCode: skill as never, difficulty: "hard", count, format, figurePolicy: fig });
  const meta = SKILL_BY_CODE.get(skill)!;
  for (const a of res.accepted) {
    const gid = randomUUID();
    const g = a.problem as never as { passage?: string; stimulus?: string; question?: string; options?: string[]; correctIndex?: number; answers?: string[]; explanation: string; figure?: unknown; subpattern?: string };
    writeFileSync(path.resolve("data/mock-exam-generation", runId, "raw", `${skill}__hard__${format}__${tag}__${gid}.json`), JSON.stringify({ gid, generatedAt: new Date().toISOString(), runId, skill, domain: meta.domain, examSystem: "sat_math", difficulty: "hard", format, createdVia: "compiler", subpattern: g.subpattern ?? null, problem: g, quality: a.quality }));
  }
  console.log(JSON.stringify(res.failures.slice(0, 3).map((f) => f.reason)));
  console.log(skill, format, "accepted", res.accepted.length, "of", count, res.stats.stoppedReason);
})();
