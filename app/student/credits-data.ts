import type { SupabaseClient } from "@supabase/supabase-js";

export type CreditsData = {
  balance: number;
  guardianName: string | null;
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

export async function loadCreditsData(
  supabase: SupabaseClient,
  studentId: string
): Promise<CreditsData> {
  const { data: student } = await supabase
    .from("students")
    .select("credit_balance")
    .eq("id", studentId)
    .single();

  // (2026-08-30 R2 Task 3) 가족 관계 원본은 households/household_members다
  // (guardian_students는 동결).
  const { data: guardian } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", studentId)
    .eq("role", "child")
    .maybeSingle();

  let guardianName: string | null = null;
  if (guardian) {
    const { data: primaryGuardian } = await supabase
      .from("household_members")
      .select("profile:profiles(name)")
      .eq("household_id", guardian.household_id)
      .eq("role", "guardian")
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle();
    guardianName = extractName(primaryGuardian?.profile) || null;
  }

  return {
    balance: student?.credit_balance ?? 0,
    guardianName,
  };
}
