// 변환 실행기 — 기존 문제은행 공개 경로(create → draft → render_check → confirm_and_publish)를 그대로 쓴다. 병렬 게시 경로를 만들지 않는다.
// service_role RPC 만 부른다. 호출하는 스크립트가 로컬 DB 인지 확인한다(비프로덕션 원격은 총괄만).
import { planConversion, type ApPurpose } from "./convert";
import type { ApCandidateLike } from "../ap-figures/gate";

export type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };
export type CandidateRow = ApCandidateLike & { difficultyProvisional?: string | null; keywordCode?: string };

async function call(db: RpcClient, fn: string, args: Record<string, unknown>) {
  const r = await db.rpc(fn, args);
  if (r.error) throw new Error(`${fn}: ${r.error.message}`);
  return r.data;
}

/** 후보 하나를 변환해 검수 환경에 게시한다. 이미 변환된 후보는 건너뛴다(멱등). */
export async function convertCandidate(db: RpcClient, cand: CandidateRow, purpose: ApPurpose, actorId: string) {
  const plan = planConversion(cand);
  if (!plan.ok) return { status: "skipped" as const, reason: plan.reason };
  for (const it of plan.items) {
    const problemId = (await call(db, "ap_create_bank_problem", {
      p_candidate_key: cand.candidateKey, p_item_index: it.index, p_purpose: purpose, p_format: it.format, p_actor_id: actorId,
      p_difficulty: it.difficulty, p_topic: it.topic, p_skill_code: null,
    })) as string;
    const versionId = (await call(db, "save_problem_draft_version", {
      p_problem_id: problemId, p_passage: it.passage, p_options: it.options, p_correct_index: it.correctIndex, p_explanation: it.explanation, p_difficulty: it.difficulty, p_actor_id: actorId,
      p_answers: null, p_figure: it.figure, p_figure_checked: false, p_statements: it.statements, p_question: it.question, p_explanation_en: it.explanationEn,
    })) as string;
    await call(db, "set_problem_render_check", { p_version_id: versionId, p_check: it.renderCheck });
    await call(db, "confirm_and_publish_problem_version", { p_version_id: versionId, p_actor_id: actorId });
  }
  const out = await call(db, "ap_finalize_conversion", { p_candidate_key: cand.candidateKey, p_actor_id: actorId });
  return { status: "converted" as const, result: out };
}
