import type { SupabaseClient } from "@supabase/supabase-js";

export type TeacherSubject = {
  subjectName: string;
  currentSession: number;
  totalSessions: number;
};

export type TeacherListItem = {
  teacherId: string;
  name: string;
  school: string | null;
  subjects: TeacherSubject[];
};

export type TeacherProfileData = {
  teacherId: string;
  name: string;
  school: string | null;
  bio: string | null;
  subjects: string[];
};

export type TeacherSessionHistoryItem = {
  sessionId: string;
  subjectName: string;
  sessionNumber: number;
  scheduledAt: string | null;
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

export async function loadTeacherList(
  supabase: SupabaseClient,
  studentId: string
): Promise<TeacherListItem[]> {
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("teacher_id, current_session, total_sessions, subject:subjects(name)")
    .eq("student_id", studentId)
    .eq("status", "active");

  const teacherIds = Array.from(new Set((enrollments ?? []).map((e) => e.teacher_id)));
  if (teacherIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", teacherIds);
  const { data: teacherRows } = await supabase
    .from("teachers")
    .select("id, school")
    .in("id", teacherIds);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));
  const schoolById = new Map((teacherRows ?? []).map((t) => [t.id, t.school]));

  const bySubjectMap = new Map<string, TeacherSubject[]>();
  for (const e of enrollments ?? []) {
    const list = bySubjectMap.get(e.teacher_id) ?? [];
    list.push({
      subjectName: extractName(e.subject),
      currentSession: e.current_session,
      totalSessions: e.total_sessions,
    });
    bySubjectMap.set(e.teacher_id, list);
  }

  return teacherIds.map((teacherId) => ({
    teacherId,
    name: nameById.get(teacherId) ?? "",
    school: schoolById.get(teacherId) ?? null,
    subjects: bySubjectMap.get(teacherId) ?? [],
  }));
}

export async function loadTeacherProfile(
  supabase: SupabaseClient,
  studentId: string,
  teacherId: string
): Promise<TeacherProfileData | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", teacherId)
    .maybeSingle();
  if (!profile) return null;

  const { data: teacherRow } = await supabase
    .from("teachers")
    .select("school, bio")
    .eq("id", teacherId)
    .maybeSingle();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("subject:subjects(name)")
    .eq("student_id", studentId)
    .eq("teacher_id", teacherId)
    .eq("status", "active");

  return {
    teacherId,
    name: profile.name,
    school: teacherRow?.school ?? null,
    bio: teacherRow?.bio ?? null,
    subjects: (enrollments ?? []).map((e) => extractName(e.subject)),
  };
}

export async function loadTeacherSessionHistory(
  supabase: SupabaseClient,
  studentId: string,
  teacherId: string
): Promise<TeacherSessionHistoryItem[]> {
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, subject:subjects(name)")
    .eq("student_id", studentId)
    .eq("teacher_id", teacherId);

  const enrollmentIds = (enrollments ?? []).map((e) => e.id);
  const subjectByEnrollment = new Map(
    (enrollments ?? []).map((e) => [e.id, extractName(e.subject)])
  );

  const { data: sessions } = enrollmentIds.length
    ? await supabase
        .from("sessions")
        .select("id, enrollment_id, session_number, scheduled_at, status")
        .in("enrollment_id", enrollmentIds)
        .in("status", ["completed", "no_show"])
        .order("scheduled_at", { ascending: false })
    : { data: [] as never[] };

  return (sessions ?? []).map((s) => ({
    sessionId: s.id,
    subjectName: subjectByEnrollment.get(s.enrollment_id) ?? "",
    sessionNumber: s.session_number,
    scheduledAt: s.scheduled_at,
  }));
}
