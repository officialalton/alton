// 빈 셀 보충용 컴파일러 생성 (2026-10-06). 난이도를 지정할 수 있는 compile.ts 변형. DB·LLM 접근 없음(결정론 계산 + 검증).
// 실행: npx tsx scripts/mock-exam-generation/compile-gap.ts --run <id> --skill s --difficulty easy|medium|hard --count N [--format mc|spr]
// 저장: data/mock-exam-generation/<run>/raw/<skill>__<diff>__<format>__gap__<gid>.json (import.ts 입력 형식은 final/passed.json 배열 — 마지막에 합쳐서 쓴다)
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
(async () => {
  const { runMathCompilerBatch } = await import("../../lib/problem-generation/math-compilers/batch");
  const { SKILL_BY_CODE } = await import("../../lib/problem-taxonomy");
  const runId = arg("--run")!, skill = arg("--skill")!, difficulty = (arg("--difficulty") ?? "hard") as "easy" | "medium" | "hard", count = Number(arg("--count") ?? 10), format = (arg("--format") ?? "mc") as "mc" | "spr";
  const fig = skill === "lines_angles_triangles" ? "require_geometry" : undefined;
  const res = await runMathCompilerBatch({ skillCode: skill as never, difficulty, count, format, figurePolicy: fig });
  const meta = SKILL_BY_CODE.get(skill)!;
  const dir = path.resolve("data/mock-exam-generation", runId, "raw"); mkdirSync(dir, { recursive: true });
  for (const a of res.accepted) {
    const gid = randomUUID();
    const g = a.problem as never as { subpattern?: string };
    writeFileSync(path.join(dir, `${skill}__${difficulty}__${format}__gap__${gid}.json`), JSON.stringify({ gid, generatedAt: new Date().toISOString(), runId, skill, domain: meta.domain, examSystem: "sat_math", difficulty, format, createdVia: "compiler", subpattern: g.subpattern ?? null, problem: a.problem, quality: a.quality }));
  }
  console.log(JSON.stringify(res.failures.slice(0, 3).map((f) => f.reason)));
  console.log(skill, difficulty, format, "accepted", res.accepted.length, "of", count, res.stats.stoppedReason);
})();
