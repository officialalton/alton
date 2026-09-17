// 2026-09-17 — "Linear equations in two variables" 계산형 컴파일러의 대표 10문항 배치
// 검증(제품 오너 지시 3단계). 일반(medium)·어려움(hard) 각 10개를 실제 저장 경로로
// 만들어 자동 통과율·부족률·벽시계 시간·호출 수를 실측한다. 로컬 DB에서만 실행한다.
// 실행: npx tsx scripts/math-compiler-validate-linear-two-var.ts
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
    const t0 = Date.now();
    let created = 0;
    const failures: string[] = [];
    const result = await runMathCompilerBatch({
      skillCode: "linear_equations_two_var",
      difficulty,
      count: 10,
      onAccepted: async ({ problem: g, quality }) => {
        const { data: problemId, error: pErr } = await admin.rpc("create_bank_problem", {
          p_subject_id: SAT_MATH_SUBJECT_ID, p_format: "mc", p_skill_type: "Linear equations in two variables",
          p_topic: "", p_skill_code: "linear_equations_two_var", p_exam_system: "sat_math", p_ap_subject: null,
          p_difficulty: difficulty, p_actor_id: actorId,
        });
        if (pErr || !problemId) { failures.push(`create_bank_problem: ${pErr?.message}`); return; }
        const { data: versionId, error: vErr } = await admin.rpc("save_problem_draft_version", {
          p_problem_id: problemId, p_passage: g.stimulus ?? g.passage, p_options: g.options ?? null, p_correct_index: g.correctIndex ?? null,
          p_explanation: g.explanation, p_difficulty: difficulty, p_actor_id: actorId,
          p_answers: null, p_figure: g.figure ?? null, p_figure_checked: false, p_statements: null, p_question: g.question ?? null,
          p_repair_status: "none",
        });
        if (vErr || !versionId) { failures.push(`save_problem_draft_version: ${vErr?.message}`); return; }
        const { error: qErr } = await admin.rpc("set_problem_quality", { p_version_id: versionId, p_quality: quality });
        if (qErr) failures.push(`set_problem_quality: ${qErr.message}`);
        else created += 1;
      },
    });
    const wallMs = Date.now() - t0;
    console.log(`\n=== ${difficulty} — 요청 10 ===`);
    console.log(`자동 통과(생성 컴파일러) ${result.stats.accepted}/10, 실제 DB 저장 성공 ${created}/10, 부족 ${result.stats.shortfall}`);
    console.log(`후보 평가 수 ${result.stats.candidatesEvaluated}, 종료 사유 ${result.stats.stoppedReason}`);
    console.log(`벽시계 시간 ${wallMs}ms (문항당 평균 ${Math.round(wallMs / Math.max(1, created))}ms)`);
    if (failures.length) console.log(`DB 저장 실패 사유: ${failures.join(" / ")}`);
    if (result.failures.length) console.log(`검증 실패 사유(표본): ${result.failures.slice(0, 3).map((f) => f.reason).join(" / ")}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
