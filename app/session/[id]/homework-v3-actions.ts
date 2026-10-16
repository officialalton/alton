"use server";

import { requireUser } from "@/lib/auth";

// 2026-09-16 — 과제 발급은 교사 포털 "과제" 탭에서만 한다(학생·수업·키워드를 한 번에 골라
// 즉시 발급, app/teacher/homework-direct-actions.ts). 세션뷰에는 회수만 남는다.

export type HomeworkActionResult = { ok: true; count?: number } | { ok: false; error: string };

export async function withdrawHomework(itemId: string): Promise<HomeworkActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("withdraw_homework_item", { p_item_id: itemId });
  if (error) return { ok: false, error: error.message.replace(/^[A-Z0-9]{5}:\s*/, "") };
  return { ok: true };
}
