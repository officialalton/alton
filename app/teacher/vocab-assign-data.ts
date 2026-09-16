import type { SupabaseClient } from "@supabase/supabase-js";
import { loadTeacherAssignments } from "./assignments-data";
import { loadLibraryBooks, type LibraryBook } from "@/app/student/vocab-library-data";

export type TeacherVocabStudent = { id: string; name: string };
export type TeacherVocabQuizRow = {
  id: string; studentId: string; studentName: string; wordCount: number;
  status: "pending" | "completed"; score: number | null; total: number | null;
  dueAt: string | null; createdAt: string; sessionId: string | null;
};

export type TeacherVocabOverview = {
  students: TeacherVocabStudent[];
  books: LibraryBook[];
  recentQuizzes: TeacherVocabQuizRow[];
};

/** 교사 포털 — 담당 학생 목록(현재 활성/예정만, 중복 제거) + 공용 단어장 권 목록 +
 * 이 교사가 낸 최근 단어 시험 발급 이력(학생별 상태). */
export async function loadTeacherVocabOverview(supabase: SupabaseClient, teacherId: string): Promise<TeacherVocabOverview> {
  const { current } = await loadTeacherAssignments(supabase, teacherId);
  const studentMap = new Map<string, string>();
  for (const a of current) studentMap.set(a.studentId, a.studentName);
  const students = [...studentMap.entries()].map(([id, name]) => ({ id, name }));

  const books = await loadLibraryBooks(supabase);

  const studentIds = students.map((s) => s.id);
  const { data: quizzes } = studentIds.length
    ? await supabase
        .from("vocab_quizzes")
        .select("id, owner_id, items, status, score, total, due_at, created_at, created_by, session_id")
        .eq("created_by", teacherId)
        .in("owner_id", studentIds)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] as never[] };

  const recentQuizzes: TeacherVocabQuizRow[] = (quizzes ?? []).map((q) => ({
    id: q.id as string,
    studentId: q.owner_id as string,
    studentName: studentMap.get(q.owner_id as string) ?? "",
    wordCount: Array.isArray(q.items) ? q.items.length : 0,
    status: q.status as "pending" | "completed",
    score: q.score as number | null,
    total: q.total as number | null,
    dueAt: q.due_at as string | null,
    createdAt: q.created_at as string,
    sessionId: q.session_id as string | null,
  }));

  return { students, books, recentQuizzes };
}
