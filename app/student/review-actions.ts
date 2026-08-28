"use server";

import { createClient } from "@/utils/supabase/server";

export async function submitStudentFeedback(
  sessionId: string,
  rating: number,
  comment: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { error } = await supabase.from("session_student_feedback").upsert(
    {
      session_id: sessionId,
      student_id: user.id,
      rating,
      comment: comment.trim() || null,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "session_id" }
  );
  if (error) throw new Error(error.message);
}
