import type { SupabaseClient } from "@supabase/supabase-js";

export type SubjectAttendance = {
  subjectName: string;
  pct: number;
};

export type StatsData = {
  attendanceRate: number | null;
  satisfactionAvg: number | null;
  bySubject: SubjectAttendance[];
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

export async function loadStats(
  supabase: SupabaseClient,
  studentId: string
): Promise<StatsData> {
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, subject:subjects(name)")
    .eq("student_id", studentId)
    .eq("status", "active");

  const enrollmentIds = (enrollments ?? []).map((e) => e.id);
  const subjectByEnrollment = new Map(
    (enrollments ?? []).map((e) => [e.id, extractName(e.subject)])
  );

  const { data: sessions } = enrollmentIds.length
    ? await supabase
        .from("sessions")
        .select("enrollment_id, status")
        .in("enrollment_id", enrollmentIds)
    : { data: [] as never[] };

  const countsBySubject = new Map<string, { completed: number; noShow: number }>();
  let totalCompleted = 0;
  let totalNoShow = 0;

  for (const s of sessions ?? []) {
    if (s.status !== "completed" && s.status !== "no_show") continue;
    const subjectName = subjectByEnrollment.get(s.enrollment_id) ?? "";
    const counts = countsBySubject.get(subjectName) ?? { completed: 0, noShow: 0 };
    if (s.status === "completed") {
      counts.completed++;
      totalCompleted++;
    } else {
      counts.noShow++;
      totalNoShow++;
    }
    countsBySubject.set(subjectName, counts);
  }

  const attendanceDenominator = totalCompleted + totalNoShow;
  const attendanceRate =
    attendanceDenominator > 0
      ? Math.round((totalCompleted / attendanceDenominator) * 100)
      : null;

  const bySubject: SubjectAttendance[] = Array.from(countsBySubject.entries()).map(
    ([subjectName, counts]) => {
      const denom = counts.completed + counts.noShow;
      return {
        subjectName,
        pct: denom > 0 ? Math.round((counts.completed / denom) * 100) : 0,
      };
    }
  );

  const sessionIds = enrollmentIds.length
    ? (
        await supabase.from("sessions").select("id").in("enrollment_id", enrollmentIds)
      ).data?.map((s) => s.id) ?? []
    : [];

  const { data: feedback } = sessionIds.length
    ? await supabase
        .from("session_student_feedback")
        .select("rating")
        .eq("student_id", studentId)
        .in("session_id", sessionIds)
        .not("rating", "is", null)
    : { data: [] as { rating: number }[] };

  const ratings = (feedback ?? []).map((f) => f.rating).filter((r): r is number => r !== null);
  const satisfactionAvg =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;

  return { attendanceRate, satisfactionAvg, bySubject };
}
