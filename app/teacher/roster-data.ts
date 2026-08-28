import type { SupabaseClient } from "@supabase/supabase-js";

export type RosterSubject = {
  enrollmentId: string;
  subjectId: string;
  subjectName: string;
  currentSession: number;
  totalSessions: number;
};

export type RosterStudent = {
  studentId: string;
  studentName: string;
  grade: string | null;
  subjects: RosterSubject[];
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

export async function loadRoster(
  supabase: SupabaseClient,
  teacherId: string
): Promise<RosterStudent[]> {
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select(
      "id, student_id, subject_id, current_session, total_sessions, subject:subjects(name)"
    )
    .eq("teacher_id", teacherId)
    .eq("status", "active");

  if (!enrollments || enrollments.length === 0) return [];

  const studentIds = Array.from(new Set(enrollments.map((e) => e.student_id)));
  const { data: studentRows } = await supabase
    .from("students")
    .select("id, grade, profile:profiles(name)")
    .in("id", studentIds);

  const studentById = new Map(
    (studentRows ?? []).map((s) => [
      s.id,
      { name: extractName(s.profile), grade: s.grade as string | null },
    ])
  );

  const byStudent = new Map<string, RosterStudent>();
  for (const e of enrollments) {
    const info = studentById.get(e.student_id);
    if (!info) continue;
    if (!byStudent.has(e.student_id)) {
      byStudent.set(e.student_id, {
        studentId: e.student_id,
        studentName: info.name,
        grade: info.grade,
        subjects: [],
      });
    }
    byStudent.get(e.student_id)!.subjects.push({
      enrollmentId: e.id,
      subjectId: e.subject_id,
      subjectName: extractName(e.subject),
      currentSession: e.current_session,
      totalSessions: e.total_sessions,
    });
  }

  return Array.from(byStudent.values());
}
