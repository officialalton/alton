import type { SupabaseClient } from "@supabase/supabase-js";

export type ReviewData = {
  sessionId: string;
  teacherSummary: string | null;
  strength: string | null;
  improve: string | null;
  nextPlan: string | null;
  submittedAt: string;
  categories: { category: string; finalText: string | null }[];
};

export type StudentFeedback = {
  rating: number | null;
  comment: string | null;
};

export async function loadReviews(
  supabase: SupabaseClient,
  sessionIds: string[]
): Promise<Record<string, ReviewData>> {
  if (sessionIds.length === 0) return {};

  const { data: reviews } = await supabase
    .from("session_reviews")
    .select(
      "id, session_id, teacher_summary, strength, improve, next_plan, submitted_at"
    )
    .in("session_id", sessionIds)
    .not("submitted_at", "is", null);

  const reviewIds = (reviews ?? []).map((r) => r.id);
  const { data: categories } = reviewIds.length
    ? await supabase
        .from("session_review_categories")
        .select("review_id, category, final_text")
        .in("review_id", reviewIds)
    : { data: [] as never[] };

  const categoriesByReview = new Map<
    string,
    { category: string; finalText: string | null }[]
  >();
  for (const c of categories ?? []) {
    const list = categoriesByReview.get(c.review_id) ?? [];
    list.push({ category: c.category, finalText: c.final_text });
    categoriesByReview.set(c.review_id, list);
  }

  const result: Record<string, ReviewData> = {};
  for (const r of reviews ?? []) {
    if (!r.submitted_at) continue;
    result[r.session_id] = {
      sessionId: r.session_id,
      teacherSummary: r.teacher_summary,
      strength: r.strength,
      improve: r.improve,
      nextPlan: r.next_plan,
      submittedAt: r.submitted_at,
      categories: categoriesByReview.get(r.id) ?? [],
    };
  }
  return result;
}

export async function loadStudentFeedback(
  supabase: SupabaseClient,
  studentId: string,
  sessionIds: string[]
): Promise<Record<string, StudentFeedback>> {
  if (sessionIds.length === 0) return {};

  const { data } = await supabase
    .from("session_student_feedback")
    .select("session_id, rating, comment")
    .eq("student_id", studentId)
    .in("session_id", sessionIds);

  const result: Record<string, StudentFeedback> = {};
  for (const f of data ?? []) {
    result[f.session_id] = { rating: f.rating, comment: f.comment };
  }
  return result;
}

// 2026-09-11(제품 오너 실사용 보고 — 선생님 "학생별 커리큘럼" 진입이 매우
// 느림, Gateway Timeout까지 실측) — 선생님 포털은 담당 학생마다 개별
// 조회했다(학생 수만큼 동시 쿼리). session_id는 시스템 전역에서 유일하므로
// 여러 학생을 한 번에 조회해도 결과가 섞이지 않는다 — 쿼리 1회로 전체
// 학생의 피드백을 가져온다(호출자가 studentId별로 다시 나눌 필요가 없어
// session_id 기준 단일 맵을 그대로 반환).
export async function loadStudentFeedbackForStudents(
  supabase: SupabaseClient,
  studentIds: string[],
  sessionIds: string[]
): Promise<Record<string, StudentFeedback>> {
  if (studentIds.length === 0 || sessionIds.length === 0) return {};

  const { data } = await supabase
    .from("session_student_feedback")
    .select("session_id, rating, comment")
    .in("student_id", studentIds)
    .in("session_id", sessionIds);

  const result: Record<string, StudentFeedback> = {};
  for (const f of data ?? []) {
    result[f.session_id] = { rating: f.rating, comment: f.comment };
  }
  return result;
}
