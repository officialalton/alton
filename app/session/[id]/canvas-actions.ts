"use server";

import { createClient } from "@/utils/supabase/server";
import type { CanvasStroke } from "./material-data";

export async function saveCanvasStrokes(
  sessionId: string,
  curriculumDocId: string,
  strokes: CanvasStroke[]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { error } = await supabase.from("canvas_annotations").upsert(
    {
      session_id: sessionId,
      curriculum_doc_id: curriculumDocId,
      strokes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "session_id,curriculum_doc_id" }
  );
  if (error) throw new Error(error.message);
}
