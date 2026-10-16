// 확정 문항 중 explanation_en 이 없는 것에 영어 해설을 새 버전으로 채운다 (2026-10-06). 기존 공개본은 그대로 두고
// 공개본 복사 초안 → explanation_en 만 추가 → 렌더 검사·품질 복사 → confirm_and_publish_problem_version 으로 새 버전을 공개한다.
// 실행: npx tsx scripts/mock-exam-generation/explanation-en-backfill.ts [--execute] [--ids a,b]   (기본 dry-run: 번역 생성·검사만, DB 쓰기 없음)
// 대상 DB = 환경변수 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY. 번역은 한국어 해설과 같은 결론·글자·수식을 유지해야 하며 검사에 걸리면 공개하지 않는다.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createToolMessage, generationModel } from "../../lib/problem-generation/models";
import { explanationEnIssues } from "./rw-level";

const envPath = path.resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const execute = process.argv.includes("--execute");
const num = /\d+(?:\.\d+)?/g;

async function main() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const client = new Anthropic();
  const { data: adminProfile } = await admin.from("profiles").select("id").eq("role", "admin").limit(1).maybeSingle();
  const actorId = adminProfile!.id as string;
  const only = arg("--ids")?.split(",");
  // 대상: 확정·미보관 문제의 공개본 중 explanation_en 이 비어 있는 것
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("problem_versions").select("id, problem_id, passage, question, options, correct_index, explanation, explanation_en, difficulty, answers, figure, figure_checked, statements, quality, render_check, evidence_target, evidence_span, answer_rationale, distractor_error_types, problems!problem_versions_problem_id_fkey!inner(status, archived_at, skill_code)").eq("status", "published").is("explanation_en", null).eq("problems.status", "confirmed").is("problems.archived_at", null).range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const targets = rows.filter((r) => !only || only.includes(r.problem_id as string));
  console.log(`대상 ${targets.length}건 (${execute ? "실행" : "dry-run"})`);
  let usd = 0; const failed: string[] = []; let done = 0;
  for (const v of targets) {
    const opts = (v.options as string[] | null) ?? [];
    const ko = v.explanation as string;
    const alreadyEnglish = !/[가-힣]/.test(ko); // 기존 해설이 이미 영어면 그대로 영어 해설로 쓴다(번역 불필요)
    const msg = alreadyEnglish ? null : await createToolMessage(client, {
      model: generationModel(), max_tokens: 3000,
      tools: [{ name: "submit", description: "영어 해설 제출", input_schema: { type: "object", properties: { explanation_en: { type: "string" } }, required: ["explanation_en"] } }],
      tool_choice: { type: "tool", name: "submit" },
      messages: [{ role: "user", content: `Translate the Korean explanation of this SAT item into natural English for a student (3-6 sentences). Keep exactly the same reasoning, conclusion, numbers, math notation and option letters (A-D) as the Korean text; do not add new claims. No Korean characters. Refer to choices by letter only. Call submit.\n\nStem:\n${v.passage ?? ""}\n${v.question ?? ""}\n${opts.map((o, i) => `${"ABCD"[i]}) ${o}`).join("\n")}\nCorrect: ${v.correct_index != null ? "ABCD"[v.correct_index as number] : JSON.stringify(v.answers)}\n\nKorean explanation:\n${ko}` }],
    } as never);
    if (msg) usd += ((msg.usage.input_tokens * 3) + (msg.usage.output_tokens * 15)) / 1e6;
    const en = alreadyEnglish ? ko.trim() : String(((msg!.content.find((c) => c.type === "tool_use") as { input: { explanation_en?: string } }).input.explanation_en) ?? "").trim();
    const issues = explanationEnIssues(en);
    const kn = (ko.match(num) ?? []); const en_n = new Set(en.match(num) ?? []);
    const absent = [...new Set(kn)].filter((n) => !en_n.has(n));
    if (absent.length > 1) issues.push(`numbers_missing:${absent.slice(0, 4).join(",")}`);
    const koLetters = new Set((ko.match(/\b[A-D]\b/g) ?? [])); const enLetters = new Set((en.match(/\b[A-D]\b/g) ?? []));
    if ([...koLetters].some((l) => !enLetters.has(l))) issues.push("letters_differ");
    if (v.correct_index != null) { const cl = "ABCD"[v.correct_index as number]; if (/\b[A-D]\b/.test(ko) && !enLetters.has(cl) && koLetters.has(cl)) issues.push("correct_letter_missing"); }
    if (issues.length) { failed.push(`${v.problem_id}: ${issues.join(",")}`); continue; }
    if (!execute) { done++; console.log(`OK ${v.problem_id}\n  ${en.slice(0, 200)}`); continue; }
    const { data: vid, error: e1 } = await admin.rpc("save_problem_draft_version", {
      p_problem_id: v.problem_id, p_passage: v.passage, p_options: v.options, p_correct_index: v.correct_index, p_explanation: ko,
      p_difficulty: v.difficulty, p_actor_id: actorId, p_answers: v.answers, p_figure: v.figure, p_figure_checked: v.figure != null ? Boolean(v.figure_checked) : false,
      p_statements: v.statements, p_question: v.question, p_repair_status: null, p_explanation_en: en,
      p_evidence_target: v.evidence_target, p_evidence_span: v.evidence_span, p_answer_rationale: v.answer_rationale, p_distractor_error_types: v.distractor_error_types,
    });
    if (e1 || !vid) { failed.push(`${v.problem_id}: 초안 ${e1?.message}`); continue; }
    if (v.render_check) { const { error } = await admin.rpc("set_problem_render_check", { p_version_id: vid, p_check: v.render_check }); if (error) { failed.push(`${v.problem_id}: 렌더검사 ${error.message}`); continue; } }
    if (v.quality) await admin.rpc("set_problem_quality", { p_version_id: vid, p_quality: v.quality });
    const { error: e2 } = await admin.rpc("confirm_and_publish_problem_version", { p_version_id: vid, p_actor_id: actorId });
    if (e2) { failed.push(`${v.problem_id}: 공개 실패(초안 ${vid} 남음) ${e2.message}`); continue; }
    done++; console.log(`published new version ${v.problem_id}`);
  }
  console.log(JSON.stringify({ done, failed: failed.length, usd: Math.round(usd * 1000) / 1000 }));
  if (failed.length) console.log(failed.join("\n"));
}
main().catch((e) => { console.error(e); process.exit(1); });
