"use server";

import { requireUser } from "@/lib/auth";

export async function requestParentPayment(): Promise<{ guardianName: string }> {
  const { supabase, user } = await requireUser();

  // (2026-08-30 R2 Task 3) 가족 관계 원본은 households/household_members다
  // (guardian_students는 동결).
  const { data: childMembership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", user.id)
    .eq("role", "child")
    .maybeSingle();
  if (!childMembership) throw new Error("연결된 학부모 계정이 없습니다.");

  const { data: guardian } = await supabase
    .from("household_members")
    .select("profile_id, profile:profiles(name)")
    .eq("household_id", childMembership.household_id)
    .eq("role", "guardian")
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!guardian) throw new Error("연결된 학부모 계정이 없습니다.");

  const guardianName = extractName(guardian.profile);

  const { error } = await supabase.from("parent_requests").insert({
    parent_id: guardian.profile_id,
    student_id: user.id,
    text: "수업권 충전을 요청합니다.",
  });
  if (error) throw new Error(error.message);

  return { guardianName: guardianName || "학부모" };
}

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}
