// 2026-09-18 — 문제은행 전수 재검수: 스킬당 10문항(medium 7 + hard 3) 실제 생성.
//
// 관리자 서버 액션(generateBankProblemsAction)과 정확히 같은 경로를 탄다:
//  - SAT Math 19종은 결정적 컴파일러(runMathCompilerBatch, AI 호출 0회, 무료)
//  - SAT R&W 11종은 실제 생성 파이프라인(runGenerationPipeline, 실제 Anthropic 호출)
// requireAdmin()만 건너뛴다(스크립트에는 Next 쿠키 세션이 없다) — 나머지는
// createDraftVersionAction/createBankProblemAction과 동일한 RPC(save_problem_draft_version,
// set_problem_quality)를 그대로 호출한다. 기존 scripts/evidence-model-verify.ts,
// scripts/problem-quality-batch.ts와 같은 패턴(BRANCH-WORKFLOW.md 참고 문서
// docs/2026-09-18-problem-bank-full-reset-report.md 5절에 설명).
//
// 스킬 하나 끝날 때마다 진행 로그(JSONL)에 append한다 — 중단돼도 실제로 뭐가
// 끝났는지 알 수 있다. 절대 이 로그 없이 보고서 수치를 만들지 않는다.
//
// 실행: npx tsx scripts/problem-bank-full-reset-generate.ts [--skills=code1,code2] [--progress=path.jsonl]
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const MATH_COMPILER_SKILLS = new Set([
  "linear_equations_two_var", "systems_linear", "linear_inequalities", "linear_equations_one_var",
  "linear_functions", "equivalent_expressions", "nonlinear_equations_systems", "nonlinear_functions",
  "ratios_rates_units", "percentages", "one_variable_data", "two_variable_data", "probability",
  "inference_margin_error", "evaluating_statistical_claims", "area_volume", "lines_angles_triangles",
  "right_triangles_trigonometry", "circles",
]);

type ProgressRow = {
  ts: string;
  skillCode: string;
  examSystem: string;
  difficulty: "medium" | "hard";
  requested: number;
  accepted: number;
  problemIds: string[];
  versionIds: string[];
  modelCalls: number;
  regenerated: number;
  regenerationResolved: number;
  emptyResponses: number;
  candidatesEvaluated: number;
  firstPassCount: number;
  seconds: number;
  failures: { stage: string; reason: string; resolved: boolean }[];
};

async function main() {
  const { SKILL_CODES, examSystemOfDomain } = await import("../lib/problem-taxonomy");
  const { findProblemSkill } = await import("../lib/problem-skills");
  const { judgeMaterialNeed } = await import("../lib/problem-material-need");
  const { runGenerationPipeline } = await import("../lib/problem-generation/pipeline");
  const { runMathCompilerBatch } = await import("../lib/problem-generation/math-compilers/batch");
  const { createAdminClient } = await import("../lib/supabase-admin");

  const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([a-z]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "1"]; }));
  const only = args.skills ? String(args.skills).split(",") : null;
  const progressPath = String(args.progress || "docs/2026-09-18-problem-bank-full-reset-progress.jsonl");
  const skills = SKILL_CODES.filter((k) => !only || only.includes(k.code));
  if (!skills.length) { console.error("대상 스킬이 없습니다."); process.exit(1); }

  const admin = createAdminClient();

  async function ensureSubject(name: string): Promise<string> {
    const { data } = await admin.from("subjects").select("id").eq("name", name).maybeSingle();
    if (data?.id) return data.id as string;
    const { data: created, error } = await admin.from("subjects").insert({ name }).select("id").single();
    if (error) throw new Error(`과목 생성 실패(${name}): ${error.message}`);
    return created.id as string;
  }
  const mathSubjectId = await ensureSubject("SAT Math");
  const rwSubjectId = await ensureSubject("SAT Reading & Writing");

  for (const k of skills) {
    const legacy = findProblemSkill(k.legacySkill);
    const system = examSystemOfDomain(k.domain) ?? "sat_math";
    const format = (legacy?.defaultFormat === "spr" ? "spr" : "mc") as "mc" | "spr";
    const need = judgeMaterialNeed({ examSystem: system, skillCode: k.code, text: "" });
    const figurePolicy = need.level === "none" ? "none" : need.kind === "plane" ? "require_plane" : need.kind === "geometry" ? "require_geometry" : need.kind === "figure_choice" ? "require_figure_choice" : "require_data";
    const subjectId = system === "sat_rw" ? rwSubjectId : mathSubjectId;
    const subjectName = system === "sat_rw" ? "SAT Reading & Writing" : "SAT Math";
    const isCompiler = MATH_COMPILER_SKILLS.has(k.code);

    for (const [difficulty, count] of [["medium", 7], ["hard", 3]] as const) {
      const t0 = Date.now();
      process.stderr.write(`▶ ${k.code} ${difficulty} x${count} (${isCompiler ? "compiler" : "AI"}) …\n`);
      const row: ProgressRow = {
        ts: new Date().toISOString(), skillCode: k.code, examSystem: system, difficulty, requested: count,
        accepted: 0, problemIds: [], versionIds: [], modelCalls: 0, regenerated: 0, regenerationResolved: 0,
        emptyResponses: 0, candidatesEvaluated: 0, firstPassCount: 0, seconds: 0, failures: [],
      };

      async function persist(g: import("../lib/problem-generation/pipeline").GeneratedProblem, quality: import("../lib/problem-generation/review").QualityRecord) {
        const { data: prow, error: insErr } = await admin
          .from("problems")
          .insert({
            subject_id: subjectId, format: g.format ?? format, skill_type: legacy?.label ?? k.label,
            skill_code: k.code, exam_system: system, difficulty, created_via: isCompiler ? "compiler" : "ai_generated",
          })
          .select("id").single();
        if (insErr) { row.failures.push({ stage: "db_insert_problem", reason: insErr.message, resolved: false }); return; }
        const pid = prow.id as string;
        const gWithEv = g as typeof g & { evidenceTarget?: string | null; evidenceSpan?: string | null; answerRationale?: string | null; distractorErrorTypes?: string[] | null; explanationEn?: string | null };
        const { data: versionId, error: draftErr } = await admin.rpc("save_problem_draft_version", {
          p_problem_id: pid,
          p_passage: g.stimulus ?? g.passage,
          p_options: g.options ?? null,
          p_correct_index: g.correctIndex ?? null,
          p_explanation: g.explanation,
          p_difficulty: difficulty,
          p_actor_id: null,
          p_answers: g.answers ?? null,
          p_figure: g.figure ?? null,
          p_figure_checked: false,
          p_statements: g.statements ?? null,
          p_question: g.question ?? null,
          p_repair_status: "none",
          p_explanation_en: gWithEv.explanationEn ?? null,
          p_evidence_target: gWithEv.evidenceTarget ?? null,
          p_evidence_span: gWithEv.evidenceSpan ?? null,
          p_answer_rationale: gWithEv.answerRationale ?? null,
          p_distractor_error_types: gWithEv.distractorErrorTypes ?? null,
        });
        if (draftErr) {
          row.failures.push({ stage: "db_insert_draft", reason: draftErr.message, resolved: false });
          await admin.from("problems").update({ archived_at: new Date().toISOString() }).eq("id", pid);
          return;
        }
        const { error: qErr } = await admin.rpc("set_problem_quality", { p_version_id: versionId, p_quality: quality });
        if (qErr) row.failures.push({ stage: "db_set_quality", reason: qErr.message, resolved: true });
        row.accepted += 1;
        row.problemIds.push(pid);
        row.versionIds.push(versionId as string);
      }

      try {
        if (isCompiler) {
          const result = await runMathCompilerBatch({
            skillCode: k.code as never, difficulty, count, figurePolicy, format,
            onAccepted: async ({ problem: g, quality }) => { await persist(g, quality); },
          });
          row.candidatesEvaluated = result.stats.candidatesEvaluated;
          row.firstPassCount = result.stats.firstPassCount;
          row.failures.push(...result.failures.map((f) => ({ stage: f.stage, reason: f.reason.slice(0, 200), resolved: f.resolved })));
        } else {
          const result = await runGenerationPipeline({
            subjectName, skillType: legacy?.label ?? k.label, skillCode: k.code, examSystem: system,
            difficulty, format, count, figurePolicy: figurePolicy as never,
            onAccepted: async ({ problem: g, quality }) => { await persist(g, quality); },
          });
          row.candidatesEvaluated = result.stats.candidatesEvaluated;
          row.firstPassCount = result.stats.firstPassCount;
          row.modelCalls = result.stats.modelCalls;
          row.regenerated = result.stats.regenerated;
          row.regenerationResolved = result.stats.regenerationResolved;
          row.emptyResponses = result.stats.emptyResponses.length;
          row.failures.push(...result.failures.map((f) => ({ stage: f.stage, reason: f.reason.slice(0, 200), resolved: f.resolved })));
        }
      } catch (e) {
        row.failures.push({ stage: "exception", reason: e instanceof Error ? e.message : String(e), resolved: false });
      }
      row.seconds = Math.round((Date.now() - t0) / 1000);
      appendFileSync(progressPath, JSON.stringify(row) + "\n");
      process.stderr.write(`   완료: 요청 ${row.requested} · 저장 ${row.accepted} · 첫통과 ${row.firstPassCount}/${row.candidatesEvaluated} · 모델호출 ${row.modelCalls} · 재생성 ${row.regenerated}(해소 ${row.regenerationResolved}) · 빈응답 ${row.emptyResponses} · ${row.seconds}s\n`);
    }
  }
  process.stderr.write(`\n진행 로그: ${progressPath}\n`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
