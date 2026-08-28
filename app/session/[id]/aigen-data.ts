import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadUnitOptions(
  supabase: SupabaseClient,
  subjectId: string
): Promise<string[]> {
  const { data } = await supabase
    .from("subject_template_units")
    .select("unit_title")
    .eq("subject_id", subjectId)
    .order("position", { ascending: true });

  return (data ?? []).map((u) => u.unit_title);
}
