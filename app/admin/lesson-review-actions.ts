"use server";

// M4(2026-09-05 통합) — 관리자가 확정된 체험/정규 리뷰를 검수·정정하는 액션.
// 확정 전 초안은 관리자도 이 화면에서 다루지 않는다(선생님만 작성) — 확정된
// 리뷰의 고객 노출 문구·카테고리별 의견만 운영상 정정 대상이다.

import { requireUser } from "@/lib/auth";

export type FinalLessonReviewForAdmin = {
  sessionId: string;
  lessonType: "trial" | "regular";
  finalText: string;
  aiSummary: string | null;
  finalizedAt: string;
  categoryNotes: { key: string; label: string; note: string | null }[];
} | null;

export async function getFinalLessonReviewForAdmin(
  subjectEnrollmentId: string
): Promise<FinalLessonReviewForAdmin> {
  const { supabase, profile } = await requireUser();
  if (profile?.role !== "admin") {
    throw new Error("관리자만 리뷰를 검수할 수 있습니다.");
  }

  const { data: review } = await supabase
    .from("lesson_reviews")
    .select("id, lesson_type, trial_session_id, regular_session_id, final_text, ai_summary, finalized_at")
    .eq("subject_enrollment_id", subjectEnrollmentId)
    .eq("status", "final")
    .order("finalized_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!review) return null;

  const { data: categories } = await supabase
    .from("review_categories")
    .select("id, key, label, display_order")
    .eq("active", true)
    .order("display_order", { ascending: true });
  const { data: notes } = await supabase
    .from("lesson_review_category_notes")
    .select("category_id, note")
    .eq("review_id", review.id);
  const noteByCategory = new Map((notes ?? []).map((n) => [n.category_id as string, n.note as string | null]));

  return {
    sessionId: (review.trial_session_id ?? review.regular_session_id) as string,
    lessonType: review.lesson_type as "trial" | "regular",
    finalText: review.final_text as string,
    aiSummary: review.ai_summary,
    finalizedAt: review.finalized_at as string,
    categoryNotes: (categories ?? []).map((c) => ({
      key: c.key as string,
      label: c.label as string,
      note: noteByCategory.get(c.id as string) ?? null,
    })),
  };
}

export async function adminEditLessonReview(params: {
  sessionId: string;
  finalText: string;
  categoryNotes: Record<string, string>;
}): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("admin_edit_lesson_review", {
    p_session_id: params.sessionId,
    p_final_text: params.finalText,
    p_category_notes: Object.entries(params.categoryNotes).map(([category_key, note]) => ({
      category_key,
      note,
    })),
  });
  if (error) throw new Error(error.message);
}
