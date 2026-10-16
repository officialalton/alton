// 정답 누설 오답 재작성본을 '새 초안 버전'으로 저장(기존 문제은행 경로: save_problem_draft_version → set_problem_render_check → set_problem_quality). 공개는 하지 않는다.
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... npx tsx scripts/mock-exam-generation/answer-leak-apply.ts --rewrites tmp/rw-leak/rewrites.json [--execute] --map tmp/rw-leak/version-map.json
// 기본은 드라이런(읽기 전용: 옛 버전을 읽어 저장 인자를 만들고 검사만). --execute 는 총괄이 대상 DB 환경을 지정해 실행한다. 재실행 안전: 같은 옛 버전에서 이미 만든 초안(quality.answerLeakRewrite.from)이 있으면 건너뛴다.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { checkFigure } from "../../lib/problem-figures/check";
import { checkContent } from "../../lib/problem-content-check";
import { composeProblemText } from "../../lib/problem-question";
import { validateFigureSpec } from "../../lib/problem-figures/spec";
import { draftBankGateError, answerKeyError } from "../../lib/problem-text-guards";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) for (const line of readFileSync(envPath, "utf-8").split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const arg = (n: string, d?: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const execute = process.argv.includes("--execute");

type Rewrite = { problemId: string; oldVersionId: string; correctIndex: number; options: string[]; explanation: string; explanation_en: string; ok: boolean };

/** 옛 버전 행 + 재작성본 → save_problem_draft_version 인자(순수 함수, 테스트 대상). 정답·난이도·지문·질문·자료는 옛 값 그대로. */
export function buildDraftArgs(old: Record<string, any>, rw: Pick<Rewrite, "options" | "explanation" | "explanation_en" | "correctIndex">, actorId: string) {
  if (old.correct_index !== rw.correctIndex) throw new Error("정답 자리가 옛 버전과 다릅니다");
  if (old.options[rw.correctIndex] !== rw.options[rw.correctIndex]) throw new Error("정답 선택지 문구가 옛 버전과 다릅니다");
  return {
    p_problem_id: old.problem_id, p_passage: old.passage, p_options: rw.options, p_correct_index: rw.correctIndex, p_explanation: rw.explanation,
    p_difficulty: old.difficulty, p_actor_id: actorId, p_answers: old.answers ?? null, p_figure: old.figure ?? null, p_figure_checked: !!old.figure_checked,
    p_statements: old.statements?.length ? old.statements : null, p_question: old.question?.trim() || null, p_repair_status: null, p_explanation_en: rw.explanation_en,
    p_evidence_target: old.evidence_target ?? null, p_evidence_span: old.evidence_span ?? null, p_answer_rationale: old.answer_rationale ?? null, p_distractor_error_types: old.distractor_error_types ?? null,
  };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY 가 필요합니다.");
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const rws = (JSON.parse(readFileSync(arg("--rewrites", "tmp/rw-leak/rewrites.json")!, "utf-8")) as Rewrite[]).filter((r) => r.ok);
  const { data: actorRows } = await admin.from("profiles").select("id").eq("role", "admin").order("created_at", { ascending: true }).limit(1);
  const actorId = actorRows?.[0]?.id as string; if (!actorId) throw new Error("관리자 프로필 없음");
  const mapPath = path.resolve(arg("--map", "tmp/rw-leak/version-map.json")!);
  const map: { problemId: string; oldVersionId: string; newVersionId: string | null; status: string }[] = existsSync(mapPath) ? JSON.parse(readFileSync(mapPath, "utf-8")) : [];
  const tally: Record<string, number> = {};
  for (const rw of rws) {
    const bump = (k: string) => { tally[k] = (tally[k] ?? 0) + 1; };
    if (map.some((m) => m.oldVersionId === rw.oldVersionId && m.newVersionId)) { bump("already_mapped"); continue; }
    const { data: old } = await admin.from("problem_versions").select("*").eq("id", rw.oldVersionId).maybeSingle();
    if (!old) { bump("old_version_missing"); continue; }
    const { data: prob } = await admin.from("problems").select("exam_system,usage_scope,skill_code,format").eq("id", rw.problemId).maybeSingle();
    const { data: drafts } = await admin.from("problem_versions").select("id,quality").eq("problem_id", rw.problemId).in("status", ["draft", "in_review"]);
    const existing = (drafts ?? []).find((d: any) => d.quality?.answerLeakRewrite?.from === rw.oldVersionId);
    if (existing) { map.push({ problemId: rw.problemId, oldVersionId: rw.oldVersionId, newVersionId: existing.id, status: "existing_draft" }); bump("existing_draft"); continue; }
    if (old.status !== "published") { bump("old_not_published"); continue; }
    let args; try { args = buildDraftArgs(old, rw, actorId); } catch (e) { bump("args_error"); console.error(rw.problemId, (e as Error).message); continue; }
    const gate = draftBankGateError({ examSystem: prob?.exam_system, usageScope: prob?.usage_scope, passage: old.passage, question: old.question, options: rw.options, explanationEn: rw.explanation_en }) ?? answerKeyError(rw.options, rw.correctIndex);
    if (gate) { bump("gate_rejected"); console.error(rw.problemId, gate); continue; }
    const fullText = composeProblemText(old.passage ?? "", old.question ?? null);
    const contentIssues = checkContent({ format: prob?.format ?? "mc", passage: fullText, options: rw.options, correctIndex: rw.correctIndex, explanation: rw.explanation, answers: old.answers ?? null, statements: old.statements ?? null, skillCode: prob?.skill_code ?? null, figure: old.figure ?? null });
    const figureCheck = checkFigure(old.figure ?? null, fullText, rw.options, rw.correctIndex);
    const figureToSave = old.figure == null ? null : (() => { const fv = validateFigureSpec(old.figure); return fv.ok ? fv.spec : old.figure; })();
    const check = { ...figureCheck, issues: [...figureCheck.issues, ...contentIssues], ok: figureCheck.ok && contentIssues.length === 0 };
    if (!execute) { bump(check.ok ? "dry_ok" : "dry_render_check_fail"); continue; }
    const { data: newId, error } = await admin.rpc("save_problem_draft_version", { ...args, p_figure: figureToSave });
    if (error || !newId) { bump("save_failed"); console.error(rw.problemId, error?.message); continue; }
    await admin.rpc("set_problem_render_check", { p_version_id: newId, p_check: check });
    await admin.rpc("set_problem_quality", { p_version_id: newId, p_quality: { ...(old.quality ?? {}), answerLeakRewrite: { from: rw.oldVersionId, at: new Date().toISOString(), reason: "answer_leak_2026-10-08" } } });
    map.push({ problemId: rw.problemId, oldVersionId: rw.oldVersionId, newVersionId: newId as string, status: "created_draft" });
    bump("created_draft");
    writeFileSync(mapPath, JSON.stringify(map, null, 1));
  }
  if (execute) writeFileSync(mapPath, JSON.stringify(map, null, 1));
  console.log(execute ? "EXECUTE" : "DRY-RUN", tally);
}
if (process.argv[1]?.endsWith("answer-leak-apply.ts")) main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
