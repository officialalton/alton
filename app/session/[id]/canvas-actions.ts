"use server";

import { requireUser } from "@/lib/auth";
import type { CanvasStroke } from "./material-data";

export async function saveCanvasStrokes(
  sessionId: string,
  curriculumDocId: string,
  strokes: CanvasStroke[]
) {
  const { supabase } = await requireUser();

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
