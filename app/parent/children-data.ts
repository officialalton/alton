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
  // (2026-08-30 R2 Task 3) 가족 관계 원본은 households/household_members다
  // (guardian_students는 동결). `is_primary`는 household_members에서 guardian
  // 행은 "이 household의 주 보호자"를, child 행은 (기존 guardian_students와
  // 동일하게) "이 부모의 기본/첫 자녀" 표시 용도로 각자 독립적으로 쓴다 — 여기서는
  // 자녀 자신의 is_primary만 본다(보호자의 is_primary와 무관).
  const { data: guardianLinks } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", parentId)
    .eq("role", "guardian");
  const householdIds = (guardianLinks ?? []).map((l) => l.household_id);
  if (householdIds.length === 0) return [];

  const { data: childLinks } = await supabase
    .from("household_members")
    .select("profile_id, is_primary, profile:profiles(name)")
    .in("household_id", householdIds)
    .eq("role", "child")
    .order("is_primary", { ascending: false });

  return (childLinks ?? []).map((c) => ({
    studentId: c.profile_id,
    name: extractName(c.profile),
    isPrimary: c.is_primary,
  }));
}

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}
