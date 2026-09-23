// 2026-09-15 — 제품 오너가 "말로만 들어서는 판단이 힘드니 실제로 웹에서 보고 싶다"고 요청.
//   실제 파이프라인(runGenerationPipeline)으로 만든 문제를 진짜 문제은행 DB에 초안으로 저장한다.
//   accepted(현재 엄격한 기준 통과)와 held(오답만 1~2개 걸려 보강 대기 — "재검사 기준을 살짝 완화하면 통과")를
//   둘 다 저장해 관리자 화면에서 나란히 비교할 수 있게 한다. 실행 후 Preview 배포가 있어야 웹에서 보인다.
// 실행: npx tsx scripts/problem-quality-seed-samples.ts
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

type Plan = { skillCode: string; difficulty: "medium" | "hard"; count: number };

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const { SKILL_CODES, examSystemOfDomain } = await import("../lib/problem-taxonomy");
  const { findProblemSkill } = await import("../lib/problem-skills");
  const { judgeMaterialNeed } = await import("../lib/problem-material-need");
  const { runGenerationPipeline } = await import("../lib/problem-generation/pipeline");

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: adminProfile, error: profileErr } = await admin.from("profiles").select("id").eq("role", "admin").limit(1).maybeSingle();
  if (profileErr || !adminProfile) throw new Error(`관리자 계정을 찾지 못했습니다: ${profileErr?.message ?? "없음"}`);
  const actorId = adminProfile.id as string;

  const { data: subjects, error: subjErr } = await admin.from("subjects").select("id, name").is("archived_at", null);
  if (subjErr || !subjects?.length) throw new Error(`과목을 찾지 못했습니다: ${subjErr?.message ?? "없음"}`);
  const findSubjectId = (nameIncludes: string) => {
    const row = subjects.find((s) => (s.name as string).includes(nameIncludes));
    if (!row) throw new Error(`"${nameIncludes}" 을 포함하는 과목이 없습니다. 있는 과목: ${subjects.map((s) => s.name).join(", ")}`);
    return row.id as string;
  };
  const subjectIdRw = findSubjectId("Reading");
  const subjectIdMath = findSubjectId("Math");

  // 대표 유형 2개(RW 1 · Math 1) — 보통·어려움 두 레이어 비교용. "쉬움"은 제외(2026-09-15 제품 오너: 불필요).
  const plans: Plan[] = [
    { skillCode: "inferences", difficulty: "medium", count: 5 },
    { skillCode: "inferences", difficulty: "hard", count: 5 },
    { skillCode: "linear_functions", difficulty: "medium", count: 5 },
    { skillCode: "linear_functions", difficulty: "hard", count: 5 },
  ];

  let totalAccepted = 0;
  const totalHeld = 0;
  for (const plan of plans) {
    const skill = SKILL_CODES.find((k) => k.code === plan.skillCode);
    if (!skill) { console.error("알 수 없는 세부 기술:", plan.skillCode); continue; }
    const legacy = findProblemSkill(skill.legacySkill);
    const examSystem = examSystemOfDomain(skill.domain) ?? "sat_math";
    const format = (legacy?.defaultFormat === "spr" ? "spr" : "mc") as "mc" | "spr";
    const need = judgeMaterialNeed({ examSystem, skillCode: skill.code, text: "" });
    const figurePolicy = need.level === "none" ? "none" : need.kind === "plane" ? "require_plane" : need.kind === "geometry" ? "require_geometry" : need.kind === "figure_choice" ? "require_figure_choice" : "require_data";
    const subjectName = examSystem === "sat_rw" ? "SAT Reading & Writing" : "SAT Math";
    const subjectId = examSystem === "sat_rw" ? subjectIdRw : subjectIdMath;

    process.stderr.write(`▶ ${plan.skillCode} · ${plan.difficulty} · ${plan.count}개 …\n`);
    const result = await runGenerationPipeline({
      subjectName, skillType: legacy?.label ?? skill.label, skillCode: skill.code, examSystem,
      difficulty: plan.difficulty, format, count: plan.count, figurePolicy: figurePolicy as never,
    });
    // 2026-09-17 — '오답 보강 대기(held)' 경로는 새 생성 파이프라인에서 없앴다
    // (제품 오너 지시: AI 생성의 정상 결과는 자동 통과 완성 후보뿐). 이 스크립트의
    // needs_distractor_repair 표본 시딩 목적은 더 이상 유효하지 않다.
    process.stderr.write(`   통과 ${result.accepted.length}\n`);

    const insertOne = async (g: (typeof result.accepted)[number]["problem"], quality: unknown, repairStatus: "none" | "needs_distractor_repair") => {
      const { data: problemId, error: pErr } = await admin.rpc("create_bank_problem", {
        p_subject_id: subjectId, p_format: format, p_skill_type: legacy?.label ?? skill.label, p_topic: "",
        p_skill_code: skill.code, p_exam_system: examSystem, p_ap_subject: null, p_difficulty: plan.difficulty, p_actor_id: actorId,
      });
      if (pErr || !problemId) { console.error("[seed] 문제 생성 실패:", pErr?.message); return false; }
      const { data: versionId, error: vErr } = await admin.rpc("save_problem_draft_version", {
        p_problem_id: problemId, p_passage: g.stimulus ?? g.passage, p_options: g.options ?? null, p_correct_index: g.correctIndex ?? null,
        p_explanation: g.explanation, p_difficulty: plan.difficulty, p_actor_id: actorId, p_answers: g.answers ?? null, p_figure: g.figure ?? null,
        p_figure_checked: true, p_statements: g.statements ?? null, p_question: g.question ?? null, p_repair_status: repairStatus,
      });
      if (vErr || !versionId) { console.error("[seed] 초안 저장 실패:", vErr?.message); await admin.from("problems").update({ archived_at: new Date().toISOString() }).eq("id", problemId); return false; }
      const { error: qErr } = await admin.rpc("set_problem_quality", { p_version_id: versionId, p_quality: quality });
      if (qErr) console.error("[seed] 품질 기록 실패:", qErr.message);
      return true;
    };

    for (const a of result.accepted) { if (await insertOne(a.problem, a.quality, "none")) totalAccepted += 1; }
  }

  process.stderr.write(`\n완료 — 통과(엄격 기준) ${totalAccepted}개, 보강 대기(완화하면 통과) ${totalHeld}개 저장.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
