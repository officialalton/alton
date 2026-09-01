import type { SupabaseClient } from "@supabase/supabase-js";

export type TeacherLesson = {
  sessionId: string;
  enrollmentId: string;
  studentId: string;
  studentName: string;
  subjectName: string;
  sessionNumber: number;
  unitTitle: string | null;
  scheduledAt: string | null;
  durationMinutes: number;
};

export type CalendarDaySession = {
  sessionId: string;
  studentName: string;
  subjectName: string;
  sessionNumber: number;
};

export type TeacherDashboardData = {
  teacherName: string;
  status: string;
  upcoming: TeacherLesson[];
  past: TeacherLesson[];
  calendarByDay: Record<number, CalendarDaySession[]>;
  calendarYear: number;
  calendarMonth: number;
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

export async function loadTeacherDashboard(
  supabase: SupabaseClient,
  teacherId: string
): Promise<TeacherDashboardData> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", teacherId)
    .single();

  const { data: teacherRow } = await supabase
    .from("teachers")
    .select("status")
    .eq("id", teacherId)
    .single();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, student_id, subject:subjects(name)")
    .eq("teacher_id", teacherId)
    .eq("status", "active");

  const enrollmentIds = (enrollments ?? []).map((e) => e.id);
  const studentIds = Array.from(new Set((enrollments ?? []).map((e) => e.student_id)));

  const { data: studentProfiles } = studentIds.length
    ? await supabase.from("profiles").select("id, name").in("id", studentIds)
    : { data: [] as { id: string; name: string }[] };
  const studentNameById = new Map((studentProfiles ?? []).map((p) => [p.id, p.name]));

  const enrollmentInfo = new Map(
    (enrollments ?? []).map((e) => [
      e.id,
      {
        studentId: e.student_id,
        studentName: studentNameById.get(e.student_id) ?? "",
        subjectName: extractName(e.subject),
      },
    ])
  );

  const { data: sessions } = enrollmentIds.length
    ? await supabase
        .from("sessions")
        .select(
          "id, enrollment_id, session_number, unit_title, status, scheduled_at, duration_minutes"
        )
        .in("enrollment_id", enrollmentIds)
    : { data: [] as never[] };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const calendarByDay: Record<number, CalendarDaySession[]> = {};
  const upcoming: TeacherLesson[] = [];
  const past: TeacherLesson[] = [];

  for (const s of sessions ?? []) {
    const info = enrollmentInfo.get(s.enrollment_id);
    if (!info) continue;

    if (s.scheduled_at) {
      const d = new Date(s.scheduled_at);
      if (d >= monthStart && d < monthEnd) {
        const day = d.getDate();
        const list = calendarByDay[day] ?? [];
        list.push({
          sessionId: s.id,
          studentName: info.studentName,
          subjectName: info.subjectName,
          sessionNumber: s.session_number,
        });
        calendarByDay[day] = list;
      }
    }

    const lesson: TeacherLesson = {
      sessionId: s.id,
      enrollmentId: s.enrollment_id,
      studentId: info.studentId,
      studentName: info.studentName,
      subjectName: info.subjectName,
      sessionNumber: s.session_number,
      unitTitle: s.unit_title,
      scheduledAt: s.scheduled_at,
      durationMinutes: s.duration_minutes,
    };
    if (s.status === "upcoming") upcoming.push(lesson);
    else if (s.status === "completed" || s.status === "no_show") past.push(lesson);
  }

  upcoming.sort(
    (a, b) =>
      new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime()
  );
  past.sort(
    (a, b) =>
      new Date(b.scheduledAt ?? 0).getTime() - new Date(a.scheduledAt ?? 0).getTime()
  );

  return {
    teacherName: profile?.name ?? "선생님",
    status: teacherRow?.status ?? "pending",
    upcoming,
    past,
    calendarByDay,
    calendarYear: now.getFullYear(),
    calendarMonth: now.getMonth(),
  };
}
