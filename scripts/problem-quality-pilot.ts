// 2026-09-16 — SAT Math 파일럿 배치: 승인된 소액 예산으로 실제 Anthropic API를 호출해
// 유형별 통과율·호출당 비용을 실측한다(그동안은 전부 모의 응답 검증뿐이었다). 통과한
// 문항은 실제 저장 경로(createDraftVersionAction과 동일한 검증)를 그대로 거쳐 초안으로
// 저장한다 — 자동 공개는 하지 않는다(기존 정책: 관리자가 눈으로 확인 후 공개).
// 실행: npx tsx scripts/problem-quality-pilot.ts
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const SAT_MATH_SUBJECT_ID = "eeeeeeee-0000-0000-0000-000000000001";
// 2026-09-16 2차 실행 — 1차(linear_equations_one_var/systems_linear/nonlinear_equations_systems/
// one_variable_data/lines_angles_triangles)에 이어 나머지 14개 유형을 마저 돈다(승인 예산 $30 중
// 1차 $1.55 사용 — 100문항까지 확대 승인).
const PLAN: { code: string; count: number }[] = [
  { code: "linear_functions", count: 5 },
  { code: "linear_equations_two_var", count: 5 },
  { code: "linear_inequalities", count: 5 },
  { code: "equivalent_expressions", count: 5 },
  { code: "nonlinear_functions", count: 5 },
  { code: "ratios_rates_units", count: 5 },
  { code: "percentages", count: 5 },
  { code: "two_variable_data", count: 5 },
  { code: "probability", count: 5 },
  { code: "inference_margin_error", count: 5 },
  { code: "evaluating_statistical_claims", count: 5 },
  { code: "area_volume", count: 5 },
  { code: "right_triangles_trigonometry", count: 5 },
  { code: "circles", count: 5 },
];

let totalInputTokens = 0;
let totalOutputTokens = 0;
let totalCalls = 0;

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const { SKILL_CODES, examSystemOfDomain } = await import("../lib/problem-taxonomy");
  const { findProblemSkill } = await import("../lib/problem-skills");
  const { judgeMaterialNeed, materialBlocker } = await import("../lib/problem-material-need");
  const { runGenerationPipeline } = await import("../lib/problem-generation/pipeline");
  const { checkFigure } = await import("../lib/problem-figures/check");
  const { validateFigureSpec } = await import("../lib/problem-figures/spec");
  const { checkContent } = await import("../lib/problem-content-check");
  const { composeProblemText } = await import("../lib/problem-question");
  const { resolveAnswerFromExplanationCore, getAnthropic } = await import("../lib/problem-generation/core");

  // 실제 발생한 토큰 사용량을 실측하기 위해 공용 Anthropic 클라이언트를 한 번만 감싼다 —
  // pipeline/core/math-staged/review 어디서 호출하든 같은 싱글턴을 쓰므로 이 한 곳만 감싸면 된다.
  const client = getAnthropic();
  const originalCreate = client.messages.create.bind(client.messages);
  client.messages.create = (async (...args: Parameters<typeof originalCreate>) => {
    const res = await originalCreate(...args);
    totalCalls += 1;
    const usage = (res as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
    if (usage) { totalInputTokens += usage.input_tokens ?? 0; totalOutputTokens += usage.output_tokens ?? 0; }
    return res;
  }) as typeof originalCreate;

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: adminProfile } = await admin.from("profiles").select("id").eq("role", "admin").limit(1).maybeSingle();
  if (!adminProfile) throw new Error("admin 프로필을 찾을 수 없습니다.");
  const actorId = adminProfile.id as string;

  const logPath = `docs/2026-09-16-math-pilot-batch-${Date.now()}.md`;
  appendFileSync(logPath, `# SAT Math 파일럿 배치 실행 로그\n\n실행: ${new Date().toISOString()}\n\n`);

  type Row = { code: string; requested: number; accepted: number; held: number; saved: number; saveFailed: number; avgModelCalls: number; failures: string[] };
  const rows: Row[] = [];

  for (const plan of PLAN) {
    const skill = SKILL_CODES.find((k) => k.code === plan.code);
    if (!skill) { console.error(`알 수 없는 유형: ${plan.code}`); continue; }
    const legacy = findProblemSkill(skill.legacySkill);
    const system = examSystemOfDomain(skill.domain) ?? "sat_math";
    const format = (legacy?.defaultFormat === "spr" ? "spr" : "mc") as "mc" | "spr";
    const need = judgeMaterialNeed({ examSystem: system, skillCode: skill.code, text: "" });
    const figurePolicy =
      need.level === "none" ? "none" :
      need.kind === "plane" ? "require_plane" :
      need.kind === "geometry" ? "require_geometry" :
      need.kind === "figure_choice" ? "require_figure_choice" : "require_data";

    console.log(`\n=== ${skill.code} (${legacy?.label ?? skill.label}) 시작 ===`);
    const result = await runGenerationPipeline({
      subjectName: "SAT Math", skillType: legacy?.label ?? skill.label, skillCode: skill.code, examSystem: system,
      difficulty: "medium", format, count: plan.count, figurePolicy: figurePolicy as never,
    });

    let saved = 0;
    let saveFailed = 0;
    const failures = result.failures.filter((f) => !f.resolved).map((f) => `${f.reason}`);

    for (const { problem: g, quality } of result.accepted) {
      const { data: problemId, error: createErr } = await admin.rpc("create_bank_problem", {
        p_subject_id: SAT_MATH_SUBJECT_ID, p_format: format, p_skill_type: legacy?.label ?? skill.label,
        p_topic: "", p_skill_code: skill.code, p_exam_system: system, p_ap_subject: null,
        p_difficulty: "medium", p_actor_id: actorId,
      });
      if (createErr || !problemId) { saveFailed += 1; failures.push(`문제 생성 실패: ${createErr?.message}`); continue; }

      const passage = g.stimulus ?? g.passage ?? "";
      const question = g.question ?? null;
      const options = g.options ?? null;
      const correctIndex = g.correctIndex ?? null;
      const explanation = g.explanation ?? "";
      const fullText = composeProblemText(passage, question);

      // createDraftVersionAction과 동일한 저장 시점 검증(정답-해설 대조, Math는 자동 정정 금지) — 실제
      // 저장 경로에서만 드러나는 결함까지 이 파일럿에서 그대로 잡아내기 위해 생략하지 않는다.
      if (format === "mc" && options && options.length >= 2 && correctIndex !== null && explanation.trim()) {
        try {
          const resolved = await resolveAnswerFromExplanationCore({ stimulus: fullText, question: question ?? "", options, explanation });
          if (!resolved.ok) { saveFailed += 1; failures.push("정답-해설 불일치(저장 시점)"); await admin.from("problems").update({ archived_at: new Date().toISOString() }).eq("id", problemId); continue; }
          if (resolved.concludedIndex !== correctIndex) { saveFailed += 1; failures.push("정답-해설 불일치(Math, 자동 정정 안 함)"); await admin.from("problems").update({ archived_at: new Date().toISOString() }).eq("id", problemId); continue; }
        } catch (e) {
          console.error("[pilot] 저장 시 정답-해설 대조 오류:", e instanceof Error ? e.message : e);
        }
      }

      const need2 = judgeMaterialNeed({ examSystem: system, skillCode: skill.code, text: fullText });
      const blocker = materialBlocker(need2, g.figure ?? null);
      if (blocker && fullText.trim()) { saveFailed += 1; failures.push(`자료 필수 위반: ${blocker}`); await admin.from("problems").update({ archived_at: new Date().toISOString() }).eq("id", problemId); continue; }

      const contentIssues = checkContent({ format, passage: fullText, options, correctIndex, explanation, answers: g.answers ?? null, statements: g.statements ?? null, skillCode: skill.code, figure: g.figure ?? null });
      const fatal = contentIssues.find((i) => ["math_parse", "math_unclosed", "latex_leak"].includes(i.code));
      if (fatal) { saveFailed += 1; failures.push(`수식 조판 불가: ${fatal.message}`); await admin.from("problems").update({ archived_at: new Date().toISOString() }).eq("id", problemId); continue; }

      const figureCheck = checkFigure(g.figure ?? null, fullText, options, correctIndex);
      if (figureCheck.issues.some((i) => i.code === "schema")) { saveFailed += 1; failures.push(`그림 규격 오류: ${figureCheck.issues[0].message}`); await admin.from("problems").update({ archived_at: new Date().toISOString() }).eq("id", problemId); continue; }

      const figureToSave = g.figure == null ? null : (() => { const fv = validateFigureSpec(g.figure); return fv.ok ? fv.spec : g.figure; })();
      const check = { ...figureCheck, issues: [...figureCheck.issues, ...contentIssues], ok: figureCheck.ok && contentIssues.length === 0 };

      const { data: versionId, error: draftErr } = await admin.rpc("save_problem_draft_version", {
        p_problem_id: problemId, p_passage: passage, p_options: options, p_correct_index: correctIndex,
        p_explanation: explanation, p_difficulty: "medium", p_actor_id: actorId, p_answers: g.answers ?? null,
        p_figure: figureToSave, p_figure_checked: false, p_statements: g.statements?.length ? g.statements : null,
        p_question: question?.trim() || null, p_repair_status: null,
      });
      if (draftErr || !versionId) { saveFailed += 1; failures.push(`초안 저장 실패: ${draftErr?.message}`); await admin.from("problems").update({ archived_at: new Date().toISOString() }).eq("id", problemId); continue; }

      await admin.rpc("set_problem_render_check", { p_version_id: versionId, p_check: check });
      await admin.rpc("set_problem_quality", { p_version_id: versionId, p_quality: quality });
      saved += 1;
    }

    // 2026-09-17 — '오답 보강 대기'는 새 생성 파이프라인에서 없앴다. 하위 호환으로 0 고정.
    const row: Row = { code: skill.code, requested: plan.count, accepted: result.accepted.length, held: 0, saved, saveFailed, avgModelCalls: result.stats.modelCalls, failures };
    rows.push(row);
    const summary =
      `## ${skill.code} (${legacy?.label ?? skill.label})\n` +
      `- 요청 ${row.requested} / 파이프라인 통과 ${row.accepted} / 오답 보강 대기 ${row.held} / 저장 완료(초안) ${row.saved} / 저장 시점 거부 ${row.saveFailed}\n` +
      `- 평균 모델 호출 수(파이프라인 stats): ${row.avgModelCalls}\n` +
      (row.failures.length ? `- 실패 사유: ${row.failures.slice(0, 5).join(" / ")}\n` : "") + "\n";
    console.log(summary);
    appendFileSync(logPath, summary);
  }

  const inputCost = (totalInputTokens / 1_000_000) * 2;
  const outputCost = (totalOutputTokens / 1_000_000) * 10;
  const totalCost = inputCost + outputCost;
  const totalRequested = rows.reduce((n, r) => n + r.requested, 0);
  const totalSaved = rows.reduce((n, r) => n + r.saved, 0);

  const finalSummary =
    `\n## 전체 결과\n` +
    `- 요청 ${totalRequested}문항 / 저장 완료(초안) ${totalSaved}문항 (통과율 ${Math.round((totalSaved / totalRequested) * 100)}%)\n` +
    `- 총 API 호출 ${totalCalls}회, 입력 토큰 ${totalInputTokens.toLocaleString()}, 출력 토큰 ${totalOutputTokens.toLocaleString()}\n` +
    `- 예상 비용: 입력 $${inputCost.toFixed(4)} + 출력 $${outputCost.toFixed(4)} = 총 $${totalCost.toFixed(4)} (Claude Sonnet 5 $2/$10 per MTok 기준)\n` +
    `- 문항당 평균 비용: $${(totalCost / Math.max(1, totalSaved)).toFixed(4)}\n` +
    `- **저장은 초안(draft)까지만 — 공개(published)는 관리자가 admin 문제은행에서 직접 확인 후 눌러야 한다.**\n`;
  console.log(finalSummary);
  appendFileSync(logPath, finalSummary);
  console.log("로그:", logPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
