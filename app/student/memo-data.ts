import type { SupabaseClient } from "@supabase/supabase-js";

export type Memo = {
  id: string;
  authorRole: "teacher" | "student" | "admin";
  text: string;
  createdAt: string;
};

export async function loadMemos(
  supabase: SupabaseClient,
  enrollmentId: string
): Promise<Memo[]> {
  const { data } = await supabase
    .from("session_memos")
    .select("id, author_role, text, created_at")
    .eq("enrollment_id", enrollmentId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((m) => ({
    id: m.id,
    authorRole: m.author_role,
    text: m.text,
    createdAt: m.created_at,
  }));
}
