"use server";

import { requireUser } from "@/lib/auth";

// 2026-09-16 제품 오너 지시 — 회차 키워드 풀에 묶지 않고 학생별로 키워드를 직접 골라
// 과제 배치를 만든다. 실제 발급(session_homework_items)은 세션뷰에서 이 배치를
// "불러오기" 할 때 일어난다. docs/2026-09-16-homework-direct-issue-plan.md.

type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

export async function createHomeworkDraftBatchAction(
  studentId: string,
  requests: { keywordId: string; count: number; label: string }[]
): Promise<ActionResult<{ id: string; problemCount: number }>> {
  const wanted = requests.filter((r) => Number.isFinite(r.count) && r.count > 0);
  if (wanted.length === 0) return { ok: false, error: "키워드별로 낼 개수를 적으세요." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_homework_draft_batch", {
    p_student_id: studentId,
    p_requests: wanted.map((r) => ({ keyword_id: r.keywordId, count: Math.floor(r.count) })),
  });
  if (error) return { ok: false, error: error.message.replace(/^[A-Z0-9]{5}:\s*/, "") };
  const batchId = data as string;
  const { data: row } = await supabase.from("homework_draft_batches").select("problem_ids").eq("id", batchId).maybeSingle();
  const problemCount = Array.isArray(row?.problem_ids) ? row.problem_ids.length : 0;
  return { ok: true, value: { id: batchId, problemCount } };
}
