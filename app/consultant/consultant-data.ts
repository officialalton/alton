import type { SupabaseClient } from "@supabase/supabase-js";

export type ConsultantStudent = {
  id: string;
  name: string | null;
};

// 컨설턴트 포지션(2026-09-22, 가볍게 시작) — 담당 학생 목록만. RLS
// (consultant_assignments "본인 컨설턴트/관리자 조회" 정책)가 본인 배정만
// 보이게 이미 막아 준다.
export async function loadMyAssignedStudents(
  supabase: SupabaseClient,
  consultantId: string
): Promise<ConsultantStudent[]> {
  const { data, error } = await supabase
    .from("consultant_assignments")
    .select("student_id, student:profiles!consultant_assignments_student_id_fkey(id, name)")
    .eq("consultant_id", consultantId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const student = Array.isArray(row.student) ? row.student[0] : row.student;
    return { id: row.student_id as string, name: (student as { name: string | null } | null)?.name ?? null };
  });
}
