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
