"use server";

// M4 (2/N, 2026-09-05 통합) — 선생님이 Smart Notes 원본을 검토해 고객용 리뷰
// (AI 미팅록 기반 자동 요약 자리 + 카테고리별 의견)를 작성·확정. 원본 자체
// (Drive 링크·AI 회의록)는 이 액션이 절대 반환하지 않는다 — 검토는 기존 R6
// Smart Notes 화면(세션뷰)에서 하고, 여기는 "그 검토 결과로 만든 고객용 텍스트"
// 만 다룬다. 체험/정규 공용 구조(lesson_reviews/lesson_review_category_notes).
// 2026-09-17(제품 오너 피드백) — 체험 전용으로 좁혀뒀던 것을 정규 수업까지
// 확장한다: sessions.lesson_type_id로 자동 판별하는 DB 함수는 처음부터 공용이었고,
// 이 파일의 조회 쿼리만 체험으로 필터링돼 있었다.

import { requireUser } from "@/lib/auth";

export type ReviewCategoryOption = {
  key: string;
  label: string;
};

export type SessionNeedingReview = {
  sessionId: string;
  subjectEnrollmentId: string;
  startsAt: string;
  finalStatus: string;
  reviewStatus: "none" | "draft" | "final";
  aiSummary: string | null;
  draftText: string | null;
  finalText: string | null;
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

// 완료된(final_status='completed') 수업(체험+정규) 중 본인이 담당한 것만 —
// 리뷰 작성/확정 대상 목록.
export async function listMySessionsNeedingReview(): Promise<SessionNeedingReview[]> {
  const { supabase, user } = await requireUser();
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("id, subject_enrollment_id, reservation_id, final_status, lesson_type:lesson_types!inner(code)")
    .eq("teacher_id", user.id)
    .eq("final_status", "completed")
    .in("lesson_type.code", ["trial", "regular"]);
  if (error) throw new Error(error.message);

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const { data: reviews } = sessionIds.length
    ? await supabase
        .from("lesson_reviews")
        .select("id, trial_session_id, regular_session_id, status, ai_summary, draft_text, final_text")
        .or(`trial_session_id.in.(${sessionIds.join(",")}),regular_session_id.in.(${sessionIds.join(",")})`)
    : {
        data: [] as {
          id: string;
          trial_session_id: string | null;
          regular_session_id: string | null;
          status: string;
          ai_summary: string | null;
          draft_text: string | null;
          final_text: string | null;
        }[],
      };
  const reviewBySession = new Map(
    (reviews ?? []).map((r) => [(r.trial_session_id ?? r.regular_session_id) as string, r])
  );

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
      finalText: review?.final_text ?? null,
      categoryNotes: review ? notesByReview.get(review.id) ?? {} : {},
    };
  });
}

export async function saveLessonReviewDraft(params: {
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

export async function finalizeLessonReview(params: {
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

// 확정된 리뷰를 담당 선생님이 정정 — 정정할 때마다 이전 버전이
// lesson_review_edit_history에 남는다(교재·문제·학생 답안 등 수업 자료는 이
// 함수가 손대지 않는다).
export async function teacherEditFinalizedLessonReview(params: {
  sessionId: string;
  finalText: string;
  categoryNotes: Record<string, string>;
}): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("teacher_edit_finalized_lesson_review", {
    p_session_id: params.sessionId,
    p_final_text: params.finalText,
    p_category_notes: Object.entries(params.categoryNotes).map(([category_key, note]) => ({
      category_key,
      note,
    })),
  });
  if (error) throw new Error(error.message);
}
