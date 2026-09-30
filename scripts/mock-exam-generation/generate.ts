// 모의고사용 문항 생성 실행기 (2026-09-29). DB 접근 없음 — 결과는 JSON 파일로만 남긴다.
// 실행: npx tsx scripts/mock-exam-generation/generate.ts --run <run-id> [--plan plan.json] [--only skill[,skill]] [--concurrency 4]
//   기존 파이프라인(runGenerationPipeline: 생성 → 자료 → 품질 계약 → 독립 채점)을 그대로 쓴다. 통과분만 raw/ 에 저장.
//   재실행 안전: 작업 단위(스킬·난이도·형식)마다 이미 저장된 수만큼 건너뛴다.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };

async function main() {
  const runId = arg("--run");
  if (!runId) throw new Error("--run <run-id> 필요");
  const planPath = arg("--plan") ?? "data/mock-exam-generation/plan.json";
  const only = arg("--only")?.split(",");
  const concurrency = Number(arg("--concurrency") ?? 4);
  const cells = (JSON.parse(readFileSync(planPath, "utf-8")).cells as { system: string; domain: string; skill: string; difficulty: "easy" | "medium" | "hard"; generate: number }[])
    .filter((c) => c.generate > 0 && (!only || only.includes(c.skill)));

  const { SKILL_CODES } = await import("../../lib/problem-taxonomy");
  const { findProblemSkill } = await import("../../lib/problem-skills");
  const { judgeMaterialNeed } = await import("../../lib/problem-material-need");
  const { runGenerationPipeline } = await import("../../lib/problem-generation/pipeline");

  const dir = path.resolve("data/mock-exam-generation", runId, "raw");
  mkdirSync(dir, { recursive: true });
  const countSaved = (prefix: string) => readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith(".json")).length;

  type Job = { skill: string; domain: string; system: string; difficulty: "easy" | "medium" | "hard"; format: "mc" | "spr"; want: number };
  const jobs: Job[] = [];
  for (const c of cells) {
    const sprOk = c.system === "sat_math" && !["evaluating_statistical_claims"].includes(c.skill);
    const spr = sprOk ? Math.round(c.generate * 0.25) : 0;
    if (c.generate - spr > 0) jobs.push({ ...c, format: "mc", want: c.generate - spr });
    if (spr > 0) jobs.push({ ...c, format: "spr", want: spr });
  }

  const runJob = async (job: Job) => {
    const prefix = `${job.skill}__${job.difficulty}__${job.format}__`;
    let have = countSaved(prefix);
    const skill = SKILL_CODES.find((k) => k.code === job.skill)!;
    const legacy = findProblemSkill(skill.legacySkill);
    const need = judgeMaterialNeed({ examSystem: job.system, skillCode: skill.code, text: "" });
    const figurePolicy = need.level === "none" ? "none" : need.kind === "plane" ? "require_plane" : need.kind === "geometry" ? "require_geometry" : need.kind === "figure_choice" ? "require_figure_choice" : "require_data";
    const subjectName = job.system === "sat_rw" ? "SAT Reading & Writing" : "SAT Math";
    let rounds = 0;
    let barren = 0;
    while (have < job.want && rounds < 8 && barren < 3) {
      rounds += 1;
      const n = Math.min(10, job.want - have);
      try {
        const result = await runGenerationPipeline({
          subjectName, skillType: legacy?.label ?? skill.label, skillCode: skill.code, examSystem: job.system,
          difficulty: job.difficulty, format: job.format, count: n, figurePolicy: figurePolicy as never,
        });
        for (const a of result.accepted) {
          const gid = randomUUID();
          writeFileSync(path.join(dir, `${prefix}${gid}.json`), JSON.stringify({ gid, runId, skill: job.skill, domain: job.domain, examSystem: job.system, difficulty: job.difficulty, format: job.format, problem: a.problem, quality: a.quality, generatedAt: new Date().toISOString() }));
          have += 1;
        }
        barren = result.accepted.length === 0 ? barren + 1 : 0;
        process.stderr.write(`[${job.skill}/${job.difficulty}/${job.format}] ${have}/${job.want} (라운드 ${rounds}, 통과 ${result.accepted.length}/${n}, 호출 ${result.stats.modelCalls})\n`);
      } catch (e) {
        process.stderr.write(`[${job.skill}/${job.difficulty}/${job.format}] 오류: ${e instanceof Error ? e.message : e}\n`);
        barren += 1;
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  };

  const queue = [...jobs];
  await Promise.all(Array.from({ length: concurrency }, async () => { while (queue.length) { const j = queue.shift()!; await runJob(j); } }));
  process.stderr.write("생성 완료\n");
}
main().catch((e) => { console.error(e); process.exit(1); });
