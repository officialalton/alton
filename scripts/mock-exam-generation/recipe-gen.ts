// 2단계 B: 레시피 기반 hard 생성 (2026-09-30). DB 접근 없음.
// 실행: npx tsx scripts/mock-exam-generation/recipe-gen.ts --run <id> --skills a,b --per-recipe 2 [--tag rc1] [--recipes data/.../recipes.json]
//   레시피의 instruction 을 생성 프롬프트(extraGuidance)에 그대로 넣는다. 파이프라인 통과분을 raw/<skill>__hard__mc__<tag>__<gid>.json 으로 저장하고
//   후보 수·통과 수·모델 호출 수를 recipe-gen-stats.jsonl 에 남긴다(수율 분모 = 파이프라인이 평가한 최초 후보 전체).
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) for (const line of readFileSync(envPath, "utf-8").split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
(async () => {
  const { SKILL_CODES } = await import("../../lib/problem-taxonomy");
  const { findProblemSkill } = await import("../../lib/problem-skills");
  const { judgeMaterialNeed } = await import("../../lib/problem-material-need");
  const { runGenerationPipeline } = await import("../../lib/problem-generation/pipeline");
  const runId = arg("--run")!, tag = arg("--tag") ?? "rc1", per = Number(arg("--per-recipe") ?? 2);
  const recipes = JSON.parse(readFileSync(path.resolve(arg("--recipes") ?? "data/mock-exam-generation/recipes.json"), "utf-8")) as Record<string, { id: string; instruction: string }[]>;
  const skills = (arg("--skills") ?? "").split(",").filter(Boolean);
  const base = path.resolve("data/mock-exam-generation", runId);
  const jobs = skills.flatMap((s) => (recipes[s] ?? []).map((r) => ({ skill: s, recipe: r })));
  const q = [...jobs];
  await Promise.all(Array.from({ length: Number(arg("--concurrency") ?? 8) }, async () => {
    while (q.length) {
      const { skill, recipe } = q.shift()!;
      const meta = SKILL_CODES.find((k) => k.code === skill)!;
      const system = meta.domain.startsWith("rw_") ? "sat_rw" : "sat_math";
      const legacy = findProblemSkill(meta.legacySkill);
      const need = judgeMaterialNeed({ examSystem: system, skillCode: skill, text: "" });
      const figurePolicy = need.level === "none" ? "none" : need.kind === "plane" ? "require_plane" : need.kind === "geometry" ? "require_geometry" : need.kind === "figure_choice" ? "require_figure_choice" : "require_data";
      try {
        const res = await runGenerationPipeline({ subjectName: system === "sat_rw" ? "SAT Reading & Writing" : "SAT Math", skillType: legacy?.label ?? meta.label, skillCode: skill, examSystem: system, difficulty: "hard", format: "mc", count: per, figurePolicy: figurePolicy as never,
          extraGuidance: `hard 레시피(${recipe.id}) — 아래 지시를 따라 만든다. 긴 지문·복잡한 숫자·계산량으로 어렵게 만들지 말고, 지시한 사고 구조로만 난이도를 만든다.\n${recipe.instruction}` });
        for (const a of res.accepted) { const gid = randomUUID(); writeFileSync(path.join(base, "raw", `${skill}__hard__mc__${tag}__${gid}.json`), JSON.stringify({ gid, generatedAt: new Date().toISOString(), runId, skill, domain: meta.domain, examSystem: system, difficulty: "hard", format: "mc", recipeId: recipe.id, problem: a.problem, quality: a.quality })); }
        appendFileSync(path.join(base, "recipe-gen-stats.jsonl"), JSON.stringify({ tag, skill, recipe: recipe.id, requested: per, candidates: res.stats.candidatesEvaluated, generated: res.stats.generated, accepted: res.accepted.length, modelCallsPerItem: res.stats.modelCalls, modelCallsTotalEst: Math.round(res.stats.modelCalls * per) }) + "\n");
        process.stderr.write(`${skill}/${recipe.id}: 후보 ${res.stats.candidatesEvaluated} 통과 ${res.accepted.length}\n`);
      } catch (e) { process.stderr.write(`${skill}/${recipe.id} 오류 ${(e as Error).message.slice(0, 80)}\n`); }
    }
  }));
})();
