import type { SupabaseClient } from "@supabase/supabase-js";

/** 풀이판의 자동 채점 정오. 컬럼 직접 조회는 막혀 있고(2026-09-29), 이 함수가 채점 전에는 학생·보호자에게 비워 준다. */
export async function loadAutoCorrect(supabase: SupabaseClient, workIds: string[]): Promise<Map<string, boolean | null>> {
  const out = new Map<string, boolean | null>();
  if (workIds.length === 0) return out;
  const { data } = await supabase.rpc("session_problem_auto_correct", { p_work_ids: workIds });
  for (const r of (data ?? []) as { work_id: string; auto_correct: boolean | null }[]) out.set(r.work_id, r.auto_correct ?? null);
  return out;
}
