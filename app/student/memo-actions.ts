"use server";

import { createClient } from "@/utils/supabase/server";
import type { Memo } from "./memo-data";

export async function addMemo(
  enrollmentId: string,
  text: string
): Promise<Memo> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const { data, error } = await supabase
    .from("session_memos")
    .insert({
      enrollment_id: enrollmentId,
      author_role: profile?.role ?? "student",
      text,
    })
    .select("id, author_role, text, created_at")
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id,
    authorRole: data.author_role,
    text: data.text,
    createdAt: data.created_at,
  };
}
