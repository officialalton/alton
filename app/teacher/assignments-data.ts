import type { SupabaseClient } from "@supabase/supabase-js";

// R5 — 선생님 "내 배정 학생/과목" 화면 데이터 로더(읽기 전용).
// teacher_assignments 조회는 RLS가 teacher_id = auth.uid()로 범위를 제한한다
// (20260830080000_r1_rls_policies.sql) — 종료된(다른 선생님 소유) 배정은 노출되지 않는다.

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

export type TeacherAssignedSubject = {
  assignmentId: string;
  subjectEnrollmentId: string;
  studentId: string;
  studentName: string;
  subjectId: string;
  subjectName: string;
  status: "planned" | "active" | "ended";
  effectiveFrom: string;
  effectiveUntil: string | null;
};

export async function loadTeacherAssignments(
  supabase: SupabaseClient,
  teacherId: string
): Promise<{ current: TeacherAssignedSubject[]; past: TeacherAssignedSubject[] }> {
  const { data: assignments } = await supabase
    .from("teacher_assignments")
    .select("id, subject_enrollment_id, status, effective_from, effective_until")
    .eq("teacher_id", teacherId)
    .order("effective_from", { ascending: false });

  if (!assignments || assignments.length === 0) return { current: [], past: [] };

  const enrollmentIds = Array.from(
    new Set(assignments.map((a) => a.subject_enrollment_id))
  );
  const { data: enrollments } = await supabase
    .from("subject_enrollments")
    .select("id, child_id, subject_id, subject:subjects(name)")
    .in("id", enrollmentIds);

  const enrollmentById = new Map((enrollments ?? []).map((e) => [e.id, e]));

  const childIds = Array.from(
    new Set((enrollments ?? []).map((e) => e.child_id))
  );
  const { data: students } = childIds.length
    ? await supabase.from("profiles").select("id, name").in("id", childIds)
    : { data: [] as { id: string; name: string }[] };
  const studentNameById = new Map((students ?? []).map((s) => [s.id, s.name]));

  const rows: TeacherAssignedSubject[] = assignments.map((a) => {
    const enrollment = enrollmentById.get(a.subject_enrollment_id);
    return {
      assignmentId: a.id,
      subjectEnrollmentId: a.subject_enrollment_id,
      studentId: enrollment?.child_id ?? "",
      studentName: studentNameById.get(enrollment?.child_id ?? "") ?? "",
      subjectId: enrollment?.subject_id ?? "",
      subjectName: extractName(enrollment?.subject),
      status: a.status,
      effectiveFrom: a.effective_from,
      effectiveUntil: a.effective_until,
    };
  });

  return {
    current: rows.filter((r) => r.status === "active" || r.status === "planned"),
    past: rows.filter((r) => r.status === "ended"),
  };
}
