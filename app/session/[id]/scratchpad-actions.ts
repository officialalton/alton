"use server";

import { requireUser } from "@/lib/auth";
import type { CanvasStroke } from "./material-data";
import type { DocLink } from "./scratchpad-data";

export async function addDocLink(
  sessionId: string,
  title: string,
  externalUrl: string
): Promise<DocLink> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("session_doc_links")
    .insert({ session_id: sessionId, title, external_url: externalUrl })
    .select("id, title, external_url")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, title: data.title, externalUrl: data.external_url };
}

export async function removeDocLink(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("session_doc_links")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function saveWhiteboardStrokes(
  sessionId: string,
  strokes: CanvasStroke[]
) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("sessions")
    .update({ whiteboard_strokes: strokes })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
}
