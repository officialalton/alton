import type { SupabaseClient } from "@supabase/supabase-js";

export type LessonItem = {
  sessionId: string;
  enrollmentId: string;
  subjectId: string;
  subjectName: string;
  teacherName: string;
  sessionNumber: number;
  unitTitle: string | null;
  status: string;
  scheduledAt: string | null;
  durationMinutes: number;
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

export async function loadLessons(
  supabase: SupabaseClient,
  studentId: string
): Promise<{ upcoming: LessonItem[]; past: LessonItem[] }> {
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, teacher_id, subject_id, subject:subjects(name)")
    .eq("student_id", studentId)
    .eq("status", "active");

  const enrollmentIds = (enrollments ?? []).map((e) => e.id);
  const teacherIds = Array.from(
    new Set((enrollments ?? []).map((e) => e.teacher_id))
  );

  const { data: teacherProfiles } = teacherIds.length
    ? await supabase.from("profiles").select("id, name").in("id", teacherIds)
    : { data: [] as { id: string; name: string }[] };

  const enrollmentInfo = new Map(
    (enrollments ?? []).map((e) => [
      e.id,
      {
        subjectId: e.subject_id,
        subjectName: extractName(e.subject),
        teacherId: e.teacher_id,
      },
    ])
  );
  const teacherNameById = new Map(
    (teacherProfiles ?? []).map((t) => [t.id, t.name])
  );

  const { data: sessions } = enrollmentIds.length
    ? await supabase
        .from("sessions")
        .select(
          "id, enrollment_id, session_number, unit_title, status, scheduled_at, duration_minutes"
        )
        .in("enrollment_id", enrollmentIds)
    : { data: [] as never[] };

  const upcoming: LessonItem[] = [];
  const past: LessonItem[] = [];

  for (const s of sessions ?? []) {
    const info = enrollmentInfo.get(s.enrollment_id);
    const item: LessonItem = {
      sessionId: s.id,
      enrollmentId: s.enrollment_id,
      subjectId: info?.subjectId ?? "",
      subjectName: info?.subjectName ?? "",
      teacherName: info ? teacherNameById.get(info.teacherId) ?? "" : "",
      sessionNumber: s.session_number,
      unitTitle: s.unit_title,
      status: s.status,
      scheduledAt: s.scheduled_at,
      durationMinutes: s.duration_minutes,
    };
    if (s.status === "upcoming") upcoming.push(item);
    else past.push(item);
  }

  upcoming.sort(
    (a, b) =>
      new Date(a.scheduledAt ?? 0).getTime() -
      new Date(b.scheduledAt ?? 0).getTime()
  );
  past.sort(
    (a, b) =>
      new Date(b.scheduledAt ?? 0).getTime() -
      new Date(a.scheduledAt ?? 0).getTime()
  );

  return { upcoming, past };
}
