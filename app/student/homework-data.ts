import type { SupabaseClient } from "@supabase/supabase-js";

export type StudentHomeworkItem = {
  id: string;
  sessionId: string;
  subjectName: string;
  sessionNumber: number;
  title: string;
  description: string | null;
  studentAnswer: string | null;
  graded: boolean;
  score: string | null;
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

export async function loadStudentHomework(
  supabase: SupabaseClient,
  studentId: string
): Promise<{ todo: StudentHomeworkItem[]; done: StudentHomeworkItem[] }> {
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
        .from("legacy_sessions")
        .select("id, enrollment_id, session_number")
        .in("enrollment_id", enrollmentIds)
    : { data: [] as never[] };

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const sessionInfo = new Map(
    (sessions ?? []).map((s) => [
      s.id,
      {
        subjectName: subjectByEnrollment.get(s.enrollment_id) ?? "",
        sessionNumber: s.session_number,
      },
    ])
  );

  const { data: items } = sessionIds.length
    ? await supabase
        .from("homework_items")
        .select(
          "id, session_id, title, description, student_answer, graded, score, created_at"
        )
        .in("session_id", sessionIds)
        .order("created_at", { ascending: false })
    : { data: [] as never[] };

  const todo: StudentHomeworkItem[] = [];
  const done: StudentHomeworkItem[] = [];

  for (const item of items ?? []) {
    const info = sessionInfo.get(item.session_id);
    const mapped: StudentHomeworkItem = {
      id: item.id,
      sessionId: item.session_id,
      subjectName: info?.subjectName ?? "",
      sessionNumber: info?.sessionNumber ?? 0,
      title: item.title,
      description: item.description,
      studentAnswer: item.student_answer,
      graded: item.graded,
      score: item.score,
    };
    if (item.student_answer && item.student_answer.trim()) done.push(mapped);
    else todo.push(mapped);
  }

  return { todo, done };
}
