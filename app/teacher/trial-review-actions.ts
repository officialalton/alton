"use server";

// M4 (2/N, 2026-09-05 통합) — 선생님이 Smart Notes 원본을 검토해 고객용 체험
// 리뷰(AI 미팅록 기반 자동 요약 자리 + 카테고리별 의견)를 작성·확정. 원본
// 자체(Drive 링크·AI 회의록)는 이 액션이 절대 반환하지 않는다 — 검토는 기존 R6
// Smart Notes 화면(세션뷰)에서 하고, 여기는 "그 검토 결과로 만든 고객용 텍스트"
// 만 다룬다. 체험/정규 공용 구조(lesson_reviews/lesson_review_category_notes) —
// R9에서 정규수업이 이 그대로 재사용한다.

import { requireUser } from "@/lib/auth";

export type ReviewCategoryOption = {
  key: string;
  label: string;
};

export type TrialSessionNeedingReview = {
  sessionId: string;
  subjectEnrollmentId: string;
  startsAt: string;
  finalStatus: string;
  reviewStatus: "none" | "draft" | "final";
  aiSummary: string | null;
  draftText: string | null;
  categoryNotes: Record<string, string | null>;
};

// 관리자가 조정 가능한 카테고리 목록(활성만, 순서대로) — 하드코딩하지 않는다.
export async function listActiveReviewCategories(): Promise<ReviewCategoryOption[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("review_categories")
    .select("key, label")
    .eq("active", true)
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({ key: c.key, label: c.label }));
}

// 완료된(final_status='completed') 체험(lesson_type.code='trial') 수업 중
// 본인이 담당한 것만 — 리뷰 작성/확정 대상 목록.
export async function listMyTrialSessionsNeedingReview(): Promise<TrialSessionNeedingReview[]> {
  const { supabase, user } = await requireUser();
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("id, subject_enrollment_id, reservation_id, final_status, lesson_type:lesson_types!inner(code)")
    .eq("teacher_id", user.id)
    .eq("final_status", "completed")
    .eq("lesson_type.code", "trial");
  if (error) throw new Error(error.message);

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const { data: reviews } = sessionIds.length
    ? await supabase
        .from("lesson_reviews")
        .select("id, trial_session_id, status, ai_summary, draft_text")
        .in("trial_session_id", sessionIds)
    : { data: [] as { id: string; trial_session_id: string; status: string; ai_summary: string | null; draft_text: string | null }[] };
  const reviewBySession = new Map((reviews ?? []).map((r) => [r.trial_session_id, r]));

  const reviewIds = (reviews ?? []).map((r) => r.id);
  const { data: notes } = reviewIds.length
    ? await supabase
        .from("lesson_review_category_notes")
        .select("review_id, note, category:review_categories(key)")
        .in("review_id", reviewIds)
    : { data: [] as { review_id: string; note: string | null; category: { key: string } | { key: string }[] | null }[] };
  const notesByReview = new Map<string, Record<string, string | null>>();
  for (const n of notes ?? []) {
    const catKey = Array.isArray(n.category) ? n.category[0]?.key : n.category?.key;
    if (!catKey) continue;
    const map = notesByReview.get(n.review_id) ?? {};
    map[catKey] = n.note;
    notesByReview.set(n.review_id, map);
  }

  const reservationIds = (sessions ?? []).map((s) => s.reservation_id);
  const { data: reservations } = reservationIds.length
    ? await supabase.from("reservations").select("id, starts_at").in("id", reservationIds)
    : { data: [] as { id: string; starts_at: string }[] };
  const startsAtByReservation = new Map((reservations ?? []).map((r) => [r.id, r.starts_at]));

  return (sessions ?? []).map((s) => {
    const review = reviewBySession.get(s.id);
    return {
      sessionId: s.id,
      subjectEnrollmentId: s.subject_enrollment_id,
      startsAt: startsAtByReservation.get(s.reservation_id) ?? "",
      finalStatus: s.final_status,
      reviewStatus: (review?.status as "draft" | "final" | undefined) ?? "none",
      aiSummary: review?.ai_summary ?? null,
      draftText: review?.draft_text ?? null,
      categoryNotes: review ? notesByReview.get(review.id) ?? {} : {},
    };
  });
}

export async function saveTrialLessonReviewDraft(params: {
  sessionId: string;
  aiSummary: string | null;
  draftText: string;
  categoryNotes: Record<string, string>;
}): Promise<{ reviewId: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("save_lesson_review_draft", {
    p_session_id: params.sessionId,
    p_ai_summary: params.aiSummary,
    p_draft_text: params.draftText,
    p_category_notes: Object.entries(params.categoryNotes).map(([category_key, note]) => ({
      category_key,
      note,
    })),
  });
  if (error) throw new Error(error.message);
  return { reviewId: data as string };
}

export async function finalizeTrialLessonReview(params: {
  sessionId: string;
  finalText: string;
}): Promise<{ reviewId: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("finalize_lesson_review", {
    p_session_id: params.sessionId,
    p_final_text: params.finalText,
  });
  if (error) throw new Error(error.message);
  return { reviewId: data as string };
}
