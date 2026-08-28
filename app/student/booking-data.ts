import type { SupabaseClient } from "@supabase/supabase-js";

export type BookableEnrollment = {
  enrollmentId: string;
  subjectName: string;
  teacherName: string;
  currentSession: number;
  totalSessions: number;
  calendlySchedulingUrl: string;
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

export async function loadBookableEnrollments(
  supabase: SupabaseClient,
  studentId: string
): Promise<BookableEnrollment[]> {
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select(
      "id, current_session, total_sessions, subject:subjects(name), teacher:teachers(calendly_scheduling_url, profile:profiles(name))"
    )
    .eq("student_id", studentId)
    .eq("status", "active");

  return (enrollments ?? [])
    .map((e) => {
      const teacher = Array.isArray(e.teacher) ? e.teacher[0] : e.teacher;
      const url = (teacher as { calendly_scheduling_url?: string | null } | null)
        ?.calendly_scheduling_url;
      if (!url) return null;

      return {
        enrollmentId: e.id,
        subjectName: extractName(e.subject),
        teacherName: extractName((teacher as { profile?: unknown } | null)?.profile),
        currentSession: e.current_session,
        totalSessions: e.total_sessions,
        calendlySchedulingUrl: url,
      };
    })
    .filter((e): e is BookableEnrollment => e !== null);
}
