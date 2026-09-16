"use server";

import { requireUser } from "@/lib/auth";

// 2026-09-16 — 과제는 더 이상 회차 키워드 풀에서 직접 발급하지 않는다(교사 포털 "과제" 탭에서
// 학생별로 미리 만든 배치를 여기서 불러오기만 한다). 검증(담당·확정·중복)은 DB 함수가 한다.
// 결과는 값으로 돌려준다(Production 은 던진 오류를 가린다).

export type HomeworkActionResult = { ok: true; count?: number } | { ok: false; error: string };

/** 교사 포털에서 미리 만들어 둔 과제 배치를 이 수업에 불러와 실제 발급한다. */
export async function loadHomeworkBatchIntoSession(batchId: string, sessionId: string): Promise<HomeworkActionResult> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("load_homework_batch_into_session", { p_batch_id: batchId, p_session_id: sessionId });
  if (error) return { ok: false, error: error.message.replace(/^[A-Z0-9]{5}:\s*/, "") };
  return { ok: true, count: (data as number | null) ?? 0 };
}

export async function withdrawHomework(itemId: string): Promise<HomeworkActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("withdraw_homework_item", { p_item_id: itemId });
  if (error) return { ok: false, error: error.message.replace(/^[A-Z0-9]{5}:\s*/, "") };
  return { ok: true };
}
