import type { SupabaseClient } from "@supabase/supabase-js";

export type UpcomingLesson = {
  sessionId: string;
  subjectName: string;
  teacherName: string;
  sessionNumber: number;
  unitTitle: string | null;
  scheduledAt: string;
  durationMinutes: number;
};

export type CalendarDaySession = {
  sessionId: string;
  subjectName: string;
  sessionNumber: number;
};

export type DashboardData = {
  studentName: string;
  upcoming: UpcomingLesson[];
  calendarByDay: Record<number, CalendarDaySession[]>;
  calendarYear: number;
  calendarMonth: number; // 0-based
  attendanceRate: number | null;
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

export async function loadDashboardData(
  supabase: SupabaseClient,
  studentId: string
): Promise<DashboardData> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", studentId)
    .single();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, teacher_id, subject:subjects(name)")
    .eq("student_id", studentId)
    .eq("status", "active");

  const enrollmentIds = (enrollments ?? []).map((e) => e.id);
  const teacherIds = Array.from(
    new Set((enrollments ?? []).map((e) => e.teacher_id))
  );

  const { data: teacherProfiles } = teacherIds.length
    ? await supabase.from("profiles").select("id, name").in("id", teacherIds)
    : { data: [] as { id: string; name: string }[] };

  const subjectByEnrollment = new Map(
    (enrollments ?? []).map((e) => [
      e.id,
      { subjectName: extractName(e.subject), teacherId: e.teacher_id },
    ])
  );
  const teacherNameById = new Map(
    (teacherProfiles ?? []).map((t) => [t.id, t.name])
  );

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const { data: sessions } = enrollmentIds.length
    ? await supabase
        .from("legacy_sessions")
        .select(
          "id, enrollment_id, session_number, unit_title, status, scheduled_at, duration_minutes"
        )
        .in("enrollment_id", enrollmentIds)
        .order("scheduled_at", { ascending: true })
    : { data: [] as never[] };

  const calendarByDay: Record<number, CalendarDaySession[]> = {};
  const upcoming: UpcomingLesson[] = [];
  let completedCount = 0;
  let noShowCount = 0;

  for (const s of sessions ?? []) {
    const info = subjectByEnrollment.get(s.enrollment_id);
    const subjectName = info?.subjectName ?? "";
    const teacherName = info ? teacherNameById.get(info.teacherId) ?? "" : "";

    if (s.status === "completed") completedCount++;
    if (s.status === "no_show") noShowCount++;

    if (s.scheduled_at) {
      const d = new Date(s.scheduled_at);
      if (d >= monthStart && d < monthEnd) {
        const day = d.getDate();
        const list = calendarByDay[day] ?? [];
        list.push({
          sessionId: s.id,
          subjectName,
          sessionNumber: s.session_number,
        });
        calendarByDay[day] = list;
      }
    }

    if (s.status === "upcoming") {
      upcoming.push({
        sessionId: s.id,
        subjectName,
        teacherName,
        sessionNumber: s.session_number,
        unitTitle: s.unit_title,
        scheduledAt: s.scheduled_at,
        durationMinutes: s.duration_minutes,
      });
    }
  }

  upcoming.sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );

  const attendanceDenominator = completedCount + noShowCount;
  const attendanceRate =
    attendanceDenominator > 0
      ? Math.round((completedCount / attendanceDenominator) * 100)
      : null;

  return {
    studentName: profile?.name ?? "학생",
    upcoming: upcoming.slice(0, 3),
    calendarByDay,
    calendarYear: now.getFullYear(),
    calendarMonth: now.getMonth(),
    attendanceRate,
  };
}
