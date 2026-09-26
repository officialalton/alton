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

// Gap 2 (2026-09-08, 제품 오너 리뷰) — 담당 선생님/관리자가 이 세션에서 발급한
// v3 과제(session_homework_items)의 학생 제출 현황을 읽기 전용으로 보는 뷰.
// 쓰기 경로는 절대 추가하지 않는다(제품 오너의 명시적 지시 — 학생 답안은
// 교사/관리자가 고칠 수 없어야 한다). 인가는 이 함수를 호출하는 supabase
// 클라이언트의 RLS에 전부 위임한다 — 이 함수는 service-role/admin 클라이언트를
// 새로 만들지 않고, 호출자가 넘긴 클라이언트(항상 요청 사용자 세션으로 스코프된
// createClient() 결과)를 그대로 쓴다. 담당이 아닌 선생님이 호출하면
// session_homework_items 자체가 RLS로 안 보여 빈 배열이 돌아온다(제출물이 없는
// 것과 구분이 안 되지만, 데이터가 새는 것보다 안전 — 6번 요구사항: RLS가
// 차단했다는 사실 자체가 "빈 배열"로 정확히 반영된다. 실제 "차단 vs 없음" 구분
// 증명은 psql 직접 조회로 하는 통합 테스트가 담당한다).
export type SessionHomeworkStatusItem = {
  id: string;
  problemId: string;
  position: number;
  format: string;
  passage: string | null;
  options: unknown;
  status: "not_started" | "draft" | "submitted";
  response: unknown;
};

export async function loadSessionHomeworkStatus(
  supabase: SupabaseClient,
  sessionId: string
): Promise<SessionHomeworkStatusItem[]> {
  const { data: items, error } = await supabase
    .from("session_homework_items")
    .select("id, problem_id, position")
    .eq("session_id", sessionId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  if (!items || items.length === 0) return [];

  const problemIds = items.map((i) => i.problem_id as string);
  const { data: problems, error: problemsError } = await supabase
    .from("problems")
    .select("id, format, passage, options")
    .in("id", problemIds);
  if (problemsError) throw new Error(problemsError.message);
  const problemById = new Map((problems ?? []).map((p) => [p.id as string, p]));

  const itemIds = items.map((i) => i.id as string);
  const { data: attempts, error: attemptsError } = await supabase
    .from("session_homework_attempts")
    .select("homework_item_id, response, submitted")
    .in("homework_item_id", itemIds);
  if (attemptsError) throw new Error(attemptsError.message);
  const attemptByItemId = new Map(
    (attempts ?? []).map((a) => [a.homework_item_id as string, a])
  );

  return items.map((item) => {
    const problem = problemById.get(item.problem_id as string);
    const attempt = attemptByItemId.get(item.id as string);
    const status: SessionHomeworkStatusItem["status"] = !attempt
      ? "not_started"
      : attempt.submitted
        ? "submitted"
        : "draft";
    return {
      id: item.id as string,
      problemId: item.problem_id as string,
      position: item.position as number,
      format: (problem?.format as string) ?? "essay",
      passage: (problem?.passage as string | null) ?? null,
      options: problem?.options ?? null,
      status,
      response: attempt?.response ?? null,
    };
  });
}
