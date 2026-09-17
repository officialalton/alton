// 근거 모델(Evidence Model, 2026-09-17) 실배치 검증 — 실제 Anthropic 호출 + 로컬 Supabase.
//
// generateBankProblemsAction과 똑같은 생성 경로(runGenerationPipeline → gate() 안의
// 근거 모델 결정적 검증기)를 그대로 태우고, 통과분을 실제 create_problem_draft_version
// RPC로 저장한다(createDraftVersionAction과 동일한 컬럼 매핑). requireAdmin()은 Next
// 쿠키 세션이 있어야 해서 이 독립 스크립트에서는 그 관문만 건너뛰고 나머지 로직은
// 실제 서버 액션과 동일한 함수를 그대로 호출한다(기존 scripts/problem-quality-batch.ts와 같은 패턴).
//
// 실행: npx tsx scripts/evidence-model-verify.ts --only=inferences,central_ideas_details --count=6
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const { runGenerationPipeline } = await import("../lib/problem-generation/pipeline");
  const { createAdminClient } = await import("../lib/supabase-admin");
  const { EVIDENCE_MODEL_SKILLS } = await import("../lib/problem-generation/evidence-model-check");

  const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([a-z]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "1"]; }));
  const only = args.only ? String(args.only).split(",") : ["inferences", "central_ideas_details"];
  const count = Math.max(1, Math.min(10, Number(args.count) || 6));
  const skills = EVIDENCE_MODEL_SKILLS.filter((s) => only.includes(s));

  const admin = createAdminClient();
  const { data: subject, error: subjErr } = await admin.from("subjects").select("id").eq("name", "SAT Reading & Writing").maybeSingle();
  let subjectId = subject?.id as string | undefined;
  if (!subjectId) {
    const { data: created, error: cErr } = await admin.from("subjects").insert({ name: "SAT Reading & Writing" }).select("id").single();
    if (cErr) { console.error("과목 생성 실패:", cErr.message, subjErr?.message); process.exit(1); }
    subjectId = created.id as string;
  }

  for (const skillCode of skills) {
    console.log(`\n===== ${skillCode} (count=${count}) =====`);
    const t0 = Date.now();
    const result = await runGenerationPipeline({
      subjectName: "SAT Reading & Writing",
      skillType: skillCode,
      skillCode,
      examSystem: "sat_rw",
      difficulty: "medium",
      format: "mc",
      count,
      figurePolicy: "optional",
    });
    const seconds = Math.round((Date.now() - t0) / 1000);
    console.log(`생성 결과: 요청 ${result.stats.requested} / 통과 ${result.stats.accepted} / 후보 평가 ${result.stats.candidatesEvaluated} / 재생성 ${result.stats.regenerated}(해소 ${result.stats.regenerationResolved}) / 평균 호출 ${result.stats.modelCalls} / ${seconds}초`);
    if (result.failures.length) {
      console.log("실패 사유:");
      for (const f of result.failures) console.log(`  [${f.stage}]${f.resolved ? "(해소됨)" : ""} ${f.reason.slice(0, 200)}`);
    }

    let savedCount = 0;
    for (const { problem: g, quality } of result.accepted) {
      const { data: row, error: insErr } = await admin
        .from("problems")
        .insert({ subject_id: subjectId, format: "mc", skill_type: skillCode, skill_code: skillCode, exam_system: "sat_rw", difficulty: "medium", created_via: "ai_generated" })
        .select("id")
        .single();
      if (insErr) { console.error("문제 행 생성 실패:", insErr.message); continue; }
      const pid = row.id as string;
      const gWithEv = g as typeof g & { evidenceTarget?: string | null; evidenceSpan?: string | null; answerRationale?: string | null; distractorErrorTypes?: string[] | null };
      // problems insert 트리거가 이미 draft 버전 하나를 만들어 둔다 — createDraftVersionAction과 같은
      // save_problem_draft_version(있으면 갱신, 없으면 생성)을 쓴다.
      const { data: versionId, error: draftErr } = await admin.rpc("save_problem_draft_version", {
        p_problem_id: pid,
        p_passage: g.stimulus ?? g.passage,
        p_options: g.options ?? null,
        p_correct_index: g.correctIndex ?? null,
        p_explanation: g.explanation,
        p_difficulty: "medium",
        p_actor_id: null,
        p_answers: g.answers ?? null,
        p_figure: g.figure ?? null,
        p_figure_checked: false,
        p_statements: g.statements ?? null,
        p_question: g.question ?? null,
        p_repair_status: "none",
        p_explanation_en: null,
        p_evidence_target: gWithEv.evidenceTarget ?? null,
        p_evidence_span: gWithEv.evidenceSpan ?? null,
        p_answer_rationale: gWithEv.answerRationale ?? null,
        p_distractor_error_types: gWithEv.distractorErrorTypes ?? null,
      });
      if (draftErr) { console.error("초안 저장 실패:", draftErr.message); continue; }
      await admin.rpc("set_problem_quality", { p_version_id: versionId, p_quality: quality });
      savedCount += 1;
      console.log(`\n--- 저장됨: problem=${pid} version=${versionId} ---`);
      console.log("질문:", g.question);
      console.log("정답:", g.correctIndex !== null ? String.fromCharCode(65 + (g.correctIndex ?? 0)) : "?");
      console.log("target:", gWithEv.evidenceTarget);
      console.log("evidence_span:", gWithEv.evidenceSpan);
      console.log("answer_rationale:", gWithEv.answerRationale);
      console.log("distractor_error_types:", JSON.stringify(gWithEv.distractorErrorTypes));
    }
    console.log(`${skillCode}: DB 저장 ${savedCount}/${result.accepted.length}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
