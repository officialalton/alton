import type { SupabaseClient } from "@supabase/supabase-js";

// R9(레슨 준비 Task 4) — 과제 구성 UI가 키워드를 고를 때 보여줄 후보 목록.
// 이 세션의 session_content_manifest(Task 2)에 찍힌 출처 오버레이 단원들의
// 활성 키워드를 모아 보여준다 — homework 후보 풀 자체(problem_keywords_selectable)
// 와는 별개로, "이 세션에서 다룬 단원들의 키워드로 좁혀서 고르게" 하는 UI
// 편의용 데이터일 뿐이다.

export type HomeworkKeywordOption = { id: string; label: string };

export async function loadSessionKeywordOptions(
  supabase: SupabaseClient,
  sessionId: string
): Promise<HomeworkKeywordOption[]> {
  const { data: manifestRows, error: manifestError } = await supabase
    .from("session_content_manifest")
    .select("source_overlay_unit_id")
    .eq("session_id", sessionId);
  if (manifestError) throw new Error(manifestError.message);

  const unitIds = Array.from(
    new Set((manifestRows ?? []).map((r) => r.source_overlay_unit_id as string | null).filter(Boolean))
  ) as string[];
  if (unitIds.length === 0) return [];

  const { data: keywordRows, error: keywordError } = await supabase
    .from("curriculum_overlay_unit_keywords")
    .select("keyword_id")
    .in("overlay_unit_id", unitIds);
  if (keywordError) throw new Error(keywordError.message);

  const keywordIds = Array.from(new Set((keywordRows ?? []).map((r) => r.keyword_id as string)));
  if (keywordIds.length === 0) return [];

  const { data: keywords, error: subjectKeywordError } = await supabase
    .from("subject_keywords")
    .select("id, label")
    .in("id", keywordIds);
  if (subjectKeywordError) throw new Error(subjectKeywordError.message);

  return (keywords ?? []).map((k) => ({ id: k.id as string, label: k.label as string }));
}
