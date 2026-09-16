import type { SupabaseClient } from "@supabase/supabase-js";

// 2026-09-16(제품 오너 2차 정정) — 과제는 수업(세션)과 무관하다. 발급 자체는
// lib/homework-batch-actions.ts(issueHomeworkBatchAction)가 한다. 이 파일은 교사 포털
// "과제 생성" 화면에 필요한 키워드 목록만 담당한다.

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
