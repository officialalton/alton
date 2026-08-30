"use server";

import { requireUser } from "@/lib/auth";

export async function submitStudentFeedback(
  sessionId: string,
  rating: number,
  comment: string
) {
  const { supabase, user } = await requireUser();

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
