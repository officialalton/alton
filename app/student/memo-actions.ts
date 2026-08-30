"use server";

import { requireUser } from "@/lib/auth";
import type { Memo } from "./memo-data";

export async function addMemo(
  enrollmentId: string,
  text: string
): Promise<Memo> {
  const { supabase, profile } = await requireUser();

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
