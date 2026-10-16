// 모의고사용 문항 생성 실행기 (2026-09-29). DB 접근 없음 — 결과는 JSON 파일로만 남긴다.
// 실행: npx tsx scripts/mock-exam-generation/generate.ts --run <run-id> [--plan plan.json] [--round N] [--only skill[,skill]] [--concurrency 4]
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
  // 라운드 태그: 1라운드 파일은 접두어만, 2라운드 이후는 `…__r<N>__<gid>.json`. 같은 작업의 저장 수는 자기 라운드 파일만 센다.
  const round = Number(arg("--round") ?? 1);
  const tag = round > 1 ? `r${round}__` : "";
  const countSaved = (prefix: string) => readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith(".json") && (round > 1 || !/__r\d+__/.test(f))).length;

  type Job = { skill: string; domain: string; system: string; difficulty: "easy" | "medium" | "hard"; format: "mc" | "spr"; want: number };
  const jobs: Job[] = [];
  for (const c of cells) {
    const sprOk = c.system === "sat_math" && !["evaluating_statistical_claims"].includes(c.skill);
    const spr = sprOk ? Math.round(c.generate * 0.25) : 0;
    if (c.generate - spr > 0) jobs.push({ ...c, format: "mc", want: c.generate - spr });
    if (spr > 0) jobs.push({ ...c, format: "spr", want: spr });
  }

  // hard 개선 프롬프트(--hard-prompt): 정의 명시 + 이미 통과한 hard 문항 few-shot(같은 skill 우선, 없으면 같은 체계).
  const hardPrompt = process.argv.includes("--hard-prompt") || process.argv.includes("--archetype");
  const passedHard: { skill: string; examSystem: string; problem: { passage?: string | null; stimulus?: string | null; question?: string | null; options?: string[] | null; correctIndex?: number | null; answers?: string[] | null; explanation: string } }[] =
    hardPrompt && existsSync(path.resolve("data/mock-exam-generation", runId, "final/passed.json"))
      ? (JSON.parse(readFileSync(path.resolve("data/mock-exam-generation", runId, "final/passed.json"), "utf-8")) as { difficulty: string; relabeled: boolean; repaired: boolean }[]).filter((x) => x.difficulty === "hard" && !x.relabeled) as never
      : [];
  // hard 원형(archetype): skill별 일반 패턴(특정 시험 문항 재현 아님)을 지침에 덧붙인다(--archetype).
  const ARCH: Record<string, string[]> = existsSync(path.resolve("data/mock-exam-generation/archetypes.json")) ? JSON.parse(readFileSync(path.resolve("data/mock-exam-generation/archetypes.json"), "utf-8")) : {};
  const archetype = process.argv.includes("--archetype");
  const hardGuidance = (skill: string, system: string) => {
    const ex = [...passedHard.filter((x) => x.skill === skill), ...passedHard.filter((x) => x.skill !== skill && x.examSystem === system)].slice(0, 2);
    const shots = ex.map((x, i) => `[통과한 hard 예시 ${i + 1} — 유형 ${x.skill}]\n${x.problem.stimulus ?? x.problem.passage ?? ""}\n질문: ${x.problem.question ?? ""}\n${(x.problem.options ?? []).map((o, j) => `${String.fromCharCode(65 + j)}) ${o}${j === x.problem.correctIndex ? " (정답)" : ""}`).join("\n")}${x.problem.answers ? `\n정답: ${x.problem.answers.join(" / ")}` : ""}`).join("\n\n");
    const pick = (ARCH[skill] ?? []).filter(() => Math.random() < 0.7);
    const arch = archetype && ARCH[skill]?.length ? `\n원형(이 중 하나 이상을 따라 만든다):\n${(pick.length ? pick : ARCH[skill]).map((x) => `- ${x}`).join("\n")}\n` : "";
    return `${arch}hard 강화 지침(독립 채점자 기준): 채점자는 (1) 풀이/추론이 3단계 이상이거나 여러 문장·조건을 종합해야 풀리고 (2) 오답 3개가 각각 서로 다른 실제 오개념·중간값·부분 일치에 기반하며 지문을 읽고도 근거를 따져야만 지워지고 (3) 지문이 군더더기 없이 적정 길이일 때 hard 로 본다. 어휘 난도·지문 길이·낯선 고유명사로 어렵게 만들지 않는다. 정답 선지는 오답보다 길거나 구체적이지 않게 한다. Math 는 모든 계산 결과를 생성 직전에 다시 검산해 해설·선지·정답이 일치해야 한다(해설 안에 '재계산' 같은 자기 수정 문구 금지).${shots ? `\n아래는 이미 모든 검수를 통과한 hard 문항이다. 수준과 오답 설계 방식만 참고하고 소재·문장·수치는 절대 재사용하지 않는다.\n${shots}` : ""}`;
  };
  const runJob = async (job: Job) => {
    const prefix = `${job.skill}__${job.difficulty}__${job.format}__${tag}`;
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
          ...(hardPrompt && job.difficulty === "hard" ? { extraGuidance: hardGuidance(job.skill, job.system) } : {}),
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
