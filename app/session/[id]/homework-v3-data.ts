import type { SupabaseClient } from "@supabase/supabase-js";

// 2026-09-14 과제 v3 통일 — 이 수업에 발급된 과제 항목(교사 발급 구역이 쓴다). 학생이 풀이판을 열었으면
// 회수할 수 없다는 사실도 함께 준다.

export type IssuedHomeworkItem = {
  itemId: string;
  problemId: string;
  position: number;
  /** 학생이 이미 풀기 시작했다(풀이판이 있다) — 회수 불가. */
  started: boolean;
};

export async function loadIssuedHomework(supabase: SupabaseClient, sessionId: string): Promise<IssuedHomeworkItem[]> {
  const { data: items } = await supabase
    .from("session_homework_items")
    .select("id, problem_id, position, student_id")
    .eq("session_id", sessionId)
    .order("position", { ascending: true });
  if (!items?.length) return [];
  const { data: work } = await supabase
    .from("session_problem_work")
    .select("problem_id")
    .eq("session_id", sessionId)
    .in("problem_id", items.map((i) => i.problem_id as string));
  const started = new Set((work ?? []).map((w) => w.problem_id as string));
  return items.map((i) => ({
    itemId: i.id as string,
    problemId: i.problem_id as string,
    position: i.position as number,
    started: started.has(i.problem_id as string),
  }));
}
