"use server";

import { requireUser } from "@/lib/auth";

// 2026-09-14 과제 v3 통일 — 교사가 회차 키워드 풀에서 직접 골라 발급한다. 검증(담당·확정·범위·중복)은
// DB 함수가 한다. 결과는 값으로 돌려준다(Production 은 던진 오류를 가린다).

export type HomeworkActionResult = { ok: true; count?: number } | { ok: false; error: string };

export async function issueHomework(sessionId: string, problemIds: string[]): Promise<HomeworkActionResult> {
  if (problemIds.length === 0) return { ok: false, error: "발급할 문제를 고르세요." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("issue_homework_items", { p_session_id: sessionId, p_problem_ids: problemIds });
  if (error) return { ok: false, error: error.message.replace(/^[A-Z0-9]{5}:\s*/, "") };
  return { ok: true, count: (data as number | null) ?? 0 };
}

export async function withdrawHomework(itemId: string): Promise<HomeworkActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("withdraw_homework_item", { p_item_id: itemId });
  if (error) return { ok: false, error: error.message.replace(/^[A-Z0-9]{5}:\s*/, "") };
  return { ok: true };
}
