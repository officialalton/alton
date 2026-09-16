import type { SupabaseClient } from "@supabase/supabase-js";

// 2026-09-16 제품 오너 지시 — 과제를 회차 키워드 풀에 묶지 않고, 교사 포털에서 학생별로
// 키워드를 직접 골라 배치를 만든다. docs/2026-09-16-homework-direct-issue-plan.md 참고.

export type HomeworkKeywordOption = { id: string; label: string };

/** 이 학생이 수강 중인 과목들의 활성 키워드 — 회차와 무관하게 전부 보여준다. */
export async function loadStudentSubjectKeywords(supabase: SupabaseClient, studentId: string): Promise<HomeworkKeywordOption[]> {
  const { data: enrollments } = await supabase
    .from("subject_enrollments")
    .select("subject_id")
    .eq("child_id", studentId);
  const subjectIds = Array.from(new Set((enrollments ?? []).map((e) => e.subject_id as string)));
  if (subjectIds.length === 0) return [];
  const { data: keywords } = await supabase
    .from("subject_keywords")
    .select("id, label")
    .in("subject_id", subjectIds)
    .eq("status", "active")
    .order("label", { ascending: true });
  return (keywords ?? []).map((k) => ({ id: k.id as string, label: k.label as string }));
}

export type HomeworkDraftBatch = {
  id: string;
  createdAt: string;
  loadedAt: string | null;
  problemCount: number;
  requests: { keywordId: string; count: number; label: string }[];
};

export async function loadHomeworkDraftBatches(supabase: SupabaseClient, studentId: string): Promise<HomeworkDraftBatch[]> {
  const { data } = await supabase
    .from("homework_draft_batches")
    .select("id, created_at, loaded_at, problem_ids, source")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []).map((b) => ({
    id: b.id as string,
    createdAt: b.created_at as string,
    loadedAt: b.loaded_at as string | null,
    problemCount: Array.isArray(b.problem_ids) ? b.problem_ids.length : 0,
    requests: ((b.source as { requests?: { keywordId: string; count: number; label: string }[] } | null)?.requests) ?? [],
  }));
}
