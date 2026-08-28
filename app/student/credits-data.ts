import type { SupabaseClient } from "@supabase/supabase-js";

export type CreditsData = {
  balance: number;
  guardianName: string | null;
};

export async function loadCreditsData(
  supabase: SupabaseClient,
  studentId: string
): Promise<CreditsData> {
  const { data: student } = await supabase
    .from("students")
    .select("credit_balance")
    .eq("id", studentId)
    .single();

  const { data: guardian } = await supabase
    .from("guardian_students")
    .select("parent_id")
    .eq("student_id", studentId)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();

  let guardianName: string | null = null;
  if (guardian) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", guardian.parent_id)
      .single();
    guardianName = profile?.name ?? null;
  }

  return {
    balance: student?.credit_balance ?? 0,
    guardianName,
  };
}
