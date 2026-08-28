import type { SupabaseClient } from "@supabase/supabase-js";

export type ChatMessage = {
  id: string;
  senderRole: "teacher" | "student";
  text: string;
  createdAt: string;
};

export async function ensureThreadAndLoadMessages(
  supabase: SupabaseClient,
  studentId: string,
  teacherId: string
): Promise<{ threadId: string; messages: ChatMessage[] }> {
  const { data: existing } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("student_id", studentId)
    .eq("teacher_id", teacherId)
    .maybeSingle();

  let threadId = existing?.id;
  if (!threadId) {
    const { data: created, error } = await supabase
      .from("chat_threads")
      .insert({ student_id: studentId, teacher_id: teacherId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    threadId = created.id;
  }

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, sender_role, text, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  return {
    threadId,
    messages: (messages ?? []).map((m) => ({
      id: m.id,
      senderRole: m.sender_role,
      text: m.text,
      createdAt: m.created_at,
    })),
  };
}
