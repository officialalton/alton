"use server";

import { createClient } from "@/utils/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("관리자만 사용할 수 있습니다.");
  return { supabase };
}

export async function confirmMatch(
  studentId: string,
  teacherId: string,
  subjectId: string,
  totalSessions: number
): Promise<void> {
  if (!Number.isFinite(totalSessions) || totalSessions < 1) {
    throw new Error("총 회차 수는 1 이상이어야 합니다.");
  }

  const { supabase } = await requireAdmin();

  const { error: insertError } = await supabase.from("enrollments").insert({
    student_id: studentId,
    teacher_id: teacherId,
    subject_id: subjectId,
    status: "active",
    total_sessions: totalSessions,
    current_session: 1,
  });
  if (insertError) {
    if (insertError.code === "23505") {
      throw new Error("이미 이 학생-선생님-과목 조합으로 매칭되어 있습니다.");
    }
    throw new Error(insertError.message);
  }

  const { error: updateError } = await supabase
    .from("students")
    .update({ status: "active" })
    .eq("id", studentId);
  if (updateError) throw new Error(updateError.message);
}
