"use server";

import { requireUser } from "@/lib/auth";

export async function requestParentPayment(): Promise<{ guardianName: string }> {
  const { supabase, user } = await requireUser();

  const { data: guardian } = await supabase
    .from("guardian_students")
    .select("parent_id")
    .eq("student_id", user.id)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!guardian) throw new Error("연결된 학부모 계정이 없습니다.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", guardian.parent_id)
    .single();

  const { error } = await supabase.from("parent_requests").insert({
    parent_id: guardian.parent_id,
    student_id: user.id,
    text: "수업권 충전을 요청합니다.",
  });
  if (error) throw new Error(error.message);

  return { guardianName: profile?.name ?? "학부모" };
}
