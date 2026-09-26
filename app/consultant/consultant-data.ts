import type { SupabaseClient } from "@supabase/supabase-js";

export type ConsultantStudent = {
  id: string;
  name: string | null;
};

export type EndedConsultantStudent = {
  id: string;
  name: string | null;
  endedAt: string;
  reason: string | null;
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

// Phase B(1, 2026-09-23) — "배정 종료(Ended)" 탭: 본인이 과거에 담당했지만
// 지금은 다른 컨설턴트로 넘어갔거나 배정이 해제된 학생. consultant_assignment_history의
// prior_consultant_id=본인인 행(=본인이 다른 담당자로 교체되거나 해제된 시점)을
// 찾고, 그 학생의 "현재" consultant_assignments가 본인이 아니면(다시 재배정된
// 게 아니라면) 종료된 것으로 본다. 학생 하나당 가장 최근 변경 이력만 보여준다
// (여러 번 배정→해제를 반복했을 수 있음).
export async function loadMyEndedAssignedStudents(
  supabase: SupabaseClient,
  consultantId: string
): Promise<EndedConsultantStudent[]> {
  const [{ data: historyRows, error: historyError }, { data: currentRows, error: currentError }] = await Promise.all([
    supabase
      .from("consultant_assignment_history")
      .select("student_id, changed_at, reason, student:profiles!consultant_assignment_history_student_id_fkey(id, name)")
      .eq("prior_consultant_id", consultantId)
      .not("student_id", "is", null)
      .order("changed_at", { ascending: false }),
    supabase.from("consultant_assignments").select("student_id").eq("consultant_id", consultantId),
  ]);
  if (historyError) throw new Error(historyError.message);
  if (currentError) throw new Error(currentError.message);

  const currentlyMine = new Set((currentRows ?? []).map((r) => r.student_id as string));
  const seen = new Set<string>();
  const result: EndedConsultantStudent[] = [];
  for (const row of historyRows ?? []) {
    const studentId = row.student_id as string;
    if (currentlyMine.has(studentId) || seen.has(studentId)) continue;
    seen.add(studentId);
    const student = Array.isArray(row.student) ? row.student[0] : row.student;
    result.push({
      id: studentId,
      name: (student as { name: string | null } | null)?.name ?? null,
      endedAt: row.changed_at as string,
      reason: (row.reason as string | null) ?? null,
    });
  }
  return result;
}
