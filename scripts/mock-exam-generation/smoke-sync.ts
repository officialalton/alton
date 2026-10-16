// 앱 동기 경로(runGenerationPipeline: 생성→계약→독립 채점) 스모크: 기본 모델(claude-sonnet-5-5)로 1건 생성·검수가 동작하는지만 확인. 비용 상한 US$0.5.
// 실행: npx tsx scripts/mock-exam-generation/smoke-sync.ts [skill] [easy|medium|hard]
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) for (const line of readFileSync(envPath, "utf-8").split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
(async () => {
  const { runGenerationPipeline } = await import("../../lib/problem-generation/pipeline");
  const { generationModel, reviewModel } = await import("../../lib/problem-generation/models");
  const skill = process.argv[2] ?? "words_in_context", diff = (process.argv[3] ?? "medium") as "medium";
  console.log("모델", generationModel(), reviewModel());
  const t = Date.now();
  const res = await runGenerationPipeline({ subjectName: "SAT Reading & Writing", skillType: "Words in Context", skillCode: skill, examSystem: "sat_rw", difficulty: diff, format: "mc", count: 1, figurePolicy: "none" });
  console.log(JSON.stringify({ accepted: res.accepted.length, failures: res.failures.map((f) => f.reason).slice(0, 3), modelCalls: res.stats.modelCalls, ms: Date.now() - t, quality: res.accepted[0] ? { est: res.accepted[0].quality.estimatedDifficulty, agrees: res.accepted[0].quality.independentReview.agrees } : null }));
})();
