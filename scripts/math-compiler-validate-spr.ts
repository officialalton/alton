// 2026-09-17 — SPR(그리드 입력) 1차 지원 검증. 지정한 계산형 컴파일러 유형의
// medium·hard 각 10문항을 format:"spr"로 실제 저장 경로(create_bank_problem +
// save_problem_draft_version + set_problem_quality)까지 돌려 자동 통과율·부족률·
// 저장된 answers 값을 실측한다. 로컬 DB에서만 실행한다.
// 실행: npx tsx scripts/math-compiler-validate-spr.ts <skillCode>
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const SAT_MATH_SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
const SKILL_CODE = (process.argv[2] as
  | "linear_equations_one_var" | "linear_equations_two_var" | "systems_linear" | "nonlinear_equations_systems"
  | "ratios_rates_units" | "percentages" | "one_variable_data" | "two_variable_data"
  | "area_volume" | "right_triangles_trigonometry" | "circles"
) || "linear_equations_one_var";
const SKILL_LABEL: Record<string, string> = {
  linear_equations_one_var: "Linear equations in one variable",
  linear_equations_two_var: "Linear equations in two variables",
  systems_linear: "Systems of two linear equations",
  nonlinear_equations_systems: "Nonlinear equations and systems",
  ratios_rates_units: "Ratios, rates, proportional relationships, and units",
  percentages: "Percentages",
  one_variable_data: "One-variable data: distributions and measures of center and spread",
  two_variable_data: "Two-variable data: models and scatterplots",
  area_volume: "Area and volume",
  right_triangles_trigonometry: "Right triangles and trigonometry",
  circles: "Circles",
};

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

  const { data: subject } = await admin.from("subjects").select("id").eq("id", SAT_MATH_SUBJECT_ID).maybeSingle();
  if (!subject) { console.error("로컬 DB에 SAT Math 시드 과목이 없습니다."); process.exit(1); }
  const { data: adminProfile } = await admin.from("profiles").select("id").eq("role", "admin").limit(1).maybeSingle();
  const actorId = adminProfile?.id as string | undefined;
  if (!actorId) { console.error("로컬 DB에 관리자 프로필이 없습니다."); process.exit(1); }

  const { runMathCompilerBatch } = await import("../lib/problem-generation/math-compilers/batch");

  for (const difficulty of ["medium", "hard"] as const) {
    const requestStart = Date.now();
    let created = 0;
    const sampleAnswers: string[][] = [];
    const failures: string[] = [];
    const result = await runMathCompilerBatch({
      skillCode: SKILL_CODE, difficulty, count: 10, format: "spr",
      onAccepted: async ({ problem: g, quality }) => {
        const { data: problemId, error: pErr } = await admin.rpc("create_bank_problem", {
          p_subject_id: SAT_MATH_SUBJECT_ID, p_format: "spr", p_skill_type: SKILL_LABEL[SKILL_CODE],
          p_topic: "", p_skill_code: SKILL_CODE, p_exam_system: "sat_math", p_ap_subject: null,
          p_difficulty: difficulty, p_actor_id: actorId,
        });
        if (pErr || !problemId) { failures.push(`create_bank_problem: ${pErr?.message}`); return; }
        const { data: versionId, error: vErr } = await admin.rpc("save_problem_draft_version", {
          p_problem_id: problemId, p_passage: g.stimulus ?? g.passage, p_options: null, p_correct_index: null,
          p_explanation: g.explanation, p_difficulty: difficulty, p_actor_id: actorId,
          p_answers: g.answers ?? null, p_figure: g.figure ?? null, p_figure_checked: false, p_statements: null, p_question: g.question ?? null,
          p_repair_status: "none", p_explanation_en: (g as { explanationEn?: string }).explanationEn ?? null,
        });
        if (vErr || !versionId) { failures.push(`save_problem_draft_version: ${vErr?.message}`); return; }
        const { error: qErr } = await admin.rpc("set_problem_quality", { p_version_id: versionId, p_quality: quality });
        if (qErr) { failures.push(`set_problem_quality: ${qErr.message}`); return; }
        created += 1;
        if (sampleAnswers.length < 3) sampleAnswers.push(g.answers ?? []);
      },
    });
    const totalRequestMs = Date.now() - requestStart;
    console.log(`\n=== SPR ${difficulty} — 요청 10 (${SKILL_CODE}) ===`);
    console.log(`자동 통과(컴파일러) ${result.stats.accepted}/10, 실제 DB 저장 성공 ${created}/10, 부족 ${result.stats.shortfall}, 종료 사유 ${result.stats.stoppedReason}`);
    console.log(`후보 평가 수 ${result.stats.candidatesEvaluated}, 전체 벽시계 시간 ${totalRequestMs}ms`);
    console.log(`저장된 answers 표본: ${sampleAnswers.map((a) => `[${a.join(", ")}]`).join(" / ")}`);
    if (failures.length) console.log(`DB 저장 실패 사유: ${failures.join(" / ")}`);
    if (result.failures.length) console.log(`검증 실패 사유(표본): ${result.failures.slice(0, 3).map((f) => f.reason).join(" / ")}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
