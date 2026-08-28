import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadReviewedSessionIds(
  supabase: SupabaseClient,
  sessionIds: string[]
): Promise<string[]> {
  if (sessionIds.length === 0) return [];
  const { data } = await supabase
    .from("session_reviews")
    .select("session_id")
    .in("session_id", sessionIds)
    .not("submitted_at", "is", null);
  return (data ?? []).map((r) => r.session_id);
}
