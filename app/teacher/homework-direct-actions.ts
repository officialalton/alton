"use server";

import { requireUser } from "@/lib/auth";

// 2026-09-16(개정) — 학생·수업(세션)·키워드를 한 번에 골라 즉시 발급한다. 실제 원본은
// session_homework_items(기존 과제 흐름 그대로) — 별도 "배치 불러오기" 단계가 없다.
// docs/2026-09-16-homework-direct-issue-plan.md 참고.

type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

export async function issueHomeworkBatchAction(
  studentId: string,
  sessionId: string,
  requests: { keywordId: string; count: number }[]
): Promise<ActionResult<{ issuedCount: number }>> {
  const wanted = requests.filter((r) => Number.isFinite(r.count) && r.count > 0);
  if (wanted.length === 0) return { ok: false, error: "키워드별로 낼 개수를 적으세요." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("issue_homework_batch", {
    p_student_id: studentId, p_session_id: sessionId,
    p_requests: wanted.map((r) => ({ keyword_id: r.keywordId, count: Math.floor(r.count) })),
  });
  if (error) return { ok: false, error: error.message.replace(/^[A-Z0-9]{5}:\s*/, "") };
  return { ok: true, value: { issuedCount: (data as number | null) ?? 0 } };
}
