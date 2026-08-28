import type { SupabaseClient } from "@supabase/supabase-js";

export type Child = {
  studentId: string;
  name: string;
  isPrimary: boolean;
};

export async function loadChildren(
  supabase: SupabaseClient,
  parentId: string
): Promise<Child[]> {
  const { data: relations } = await supabase
    .from("guardian_students")
    .select("student_id, is_primary")
    .eq("parent_id", parentId)
    .order("is_primary", { ascending: false });

  const studentIds = (relations ?? []).map((r) => r.student_id);
  if (studentIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", studentIds);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));

  return (relations ?? []).map((r) => ({
    studentId: r.student_id,
    name: nameById.get(r.student_id) ?? "",
    isPrimary: r.is_primary,
  }));
}
