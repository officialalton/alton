import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanvasStroke } from "./material-data";

export type DocLink = {
  id: string;
  title: string;
  externalUrl: string;
};

export async function loadDocLinks(
  supabase: SupabaseClient,
  sessionId: string
): Promise<DocLink[]> {
  const { data } = await supabase
    .from("session_doc_links")
    .select("id, title, external_url")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    externalUrl: d.external_url,
  }));
}

export function parseWhiteboardStrokes(raw: unknown): CanvasStroke[] {
  return Array.isArray(raw) ? (raw as CanvasStroke[]) : [];
}
