import type { SupabaseClient } from "@supabase/supabase-js";

export type HomeworkItem = {
  id: string;
  title: string;
  description: string | null;
  studentAnswer: string | null;
};

export async function loadHomeworkItems(
  supabase: SupabaseClient,
  sessionId: string
): Promise<HomeworkItem[]> {
  const { data } = await supabase
    .from("homework_items")
    .select("id, title, description, student_answer")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((h) => ({
    id: h.id,
    title: h.title,
    description: h.description,
    studentAnswer: h.student_answer,
  }));
}
