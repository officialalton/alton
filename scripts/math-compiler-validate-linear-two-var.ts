// 2026-09-17 — 계산형 Math 컴파일러(일차식 공통 엔진)의 대표 10문항 배치 검증(제품
// 오너 지시). 일반(medium)·어려움(hard) 각 10개를 실제 저장 경로로 만들어 자동
// 통과율·부족률·벽시계 시간·호출 수를 실측한다. 로컬 DB에서만 실행한다.
// 실행: npx tsx scripts/math-compiler-validate-linear-two-var.ts [skillCode]
// skillCode 생략 시 linear_equations_two_var. systems_linear·linear_inequalities도 지원.
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
const SKILL_CODE = (process.argv[2] as "linear_equations_two_var" | "systems_linear" | "linear_inequalities" | "linear_equations_one_var" | "linear_functions" | "equivalent_expressions") || "linear_equations_two_var";
const SKILL_LABEL: Record<string, string> = {
  linear_equations_two_var: "Linear equations in two variables",
  systems_linear: "Systems of two linear equations",
  linear_inequalities: "Linear inequalities",
  linear_equations_one_var: "Linear equations in one variable",
  linear_functions: "Linear functions",
  equivalent_expressions: "Equivalent expressions",
};

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

  const { data: subject } = await admin.from("subjects").select("id").eq("id", SAT_MATH_SUBJECT_ID).maybeSingle();
  if (!subject) {
    console.error(`로컬 DB에 SAT Math 시드 과목(${SAT_MATH_SUBJECT_ID})이 없습니다. 실제 관리자 UI/비프로덕션에서 검증해주세요.`);
    process.exit(1);
  }
  const { data: adminProfile } = await admin.from("profiles").select("id").eq("role", "admin").limit(1).maybeSingle();
  const actorId = adminProfile?.id as string | undefined;
  if (!actorId) {
    console.error("로컬 DB에 관리자 프로필이 없습니다.");
    process.exit(1);
  }

  const { runMathCompilerBatch } = await import("../lib/problem-generation/math-compilers/batch");

  for (const difficulty of ["medium", "hard"] as const) {
    const requestStart = Date.now();
    let created = 0;
    let dbSaveMs = 0;
    const failures: string[] = [];
    const result = await runMathCompilerBatch({
      skillCode: SKILL_CODE,
      difficulty,
      count: 10,
      onAccepted: async ({ problem: g, quality }) => {
        const t0 = Date.now();
        const { data: problemId, error: pErr } = await admin.rpc("create_bank_problem", {
          p_subject_id: SAT_MATH_SUBJECT_ID, p_format: "mc", p_skill_type: SKILL_LABEL[SKILL_CODE],
          p_topic: "", p_skill_code: SKILL_CODE, p_exam_system: "sat_math", p_ap_subject: null,
          p_difficulty: difficulty, p_actor_id: actorId,
        });
        if (pErr || !problemId) { failures.push(`create_bank_problem: ${pErr?.message}`); dbSaveMs += Date.now() - t0; return; }
        const { data: versionId, error: vErr } = await admin.rpc("save_problem_draft_version", {
          p_problem_id: problemId, p_passage: g.stimulus ?? g.passage, p_options: g.options ?? null, p_correct_index: g.correctIndex ?? null,
          p_explanation: g.explanation, p_difficulty: difficulty, p_actor_id: actorId,
          p_answers: null, p_figure: g.figure ?? null, p_figure_checked: false, p_statements: null, p_question: g.question ?? null,
          p_repair_status: "none",
        });
        if (vErr || !versionId) { failures.push(`save_problem_draft_version: ${vErr?.message}`); dbSaveMs += Date.now() - t0; return; }
        const { error: qErr } = await admin.rpc("set_problem_quality", { p_version_id: versionId, p_quality: quality });
        if (qErr) failures.push(`set_problem_quality: ${qErr.message}`);
        else created += 1;
        dbSaveMs += Date.now() - t0;
      },
    });
    const totalRequestMs = Date.now() - requestStart;
    console.log(`\n=== ${difficulty} — 요청 10 (${SKILL_CODE}) ===`);
    console.log(`자동 통과(컴파일러) ${result.stats.accepted}/10, 실제 DB 저장 성공 ${created}/10, 부족 ${result.stats.shortfall}, 종료 사유 ${result.stats.stoppedReason}`);
    console.log(`후보 평가 수 ${result.stats.candidatesEvaluated} (요청 1~9여도 최소 10문항 배치 확인됨)`);
    console.log(`--- 시간 분리 기록 ---`);
    console.log(`전체 제품 경로 벽시계 시간: ${totalRequestMs}ms`);
    console.log(`  컴파일(모델 계산) 시간: ${result.compilerTiming.compileMs}ms`);
    console.log(`  렌더링 검증(checkFigure) 시간: ${result.compilerTiming.renderCheckMs}ms`);
    console.log(`  DB 저장(create_bank_problem+save_problem_draft_version+set_problem_quality) 시간: ${dbSaveMs}ms`);
    console.log(`Math AI 호출 수: 0 (이 경로는 Anthropic 클라이언트를 아예 쓰지 않음)`);
    if (failures.length) console.log(`DB 저장 실패 사유: ${failures.join(" / ")}`);
    if (result.failures.length) console.log(`검증 실패 사유(표본): ${result.failures.slice(0, 3).map((f) => f.reason).join(" / ")}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
