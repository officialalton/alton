"use server";

// M4 (2/N) — 선생님이 Smart Notes 원본을 검토해 고객용 체험 리뷰를 작성·확정.
// 원본 자체(Drive 링크·AI 회의록)는 이 액션이 절대 반환하지 않는다 — 검토는
// 기존 R6 Smart Notes 화면(세션뷰)에서 하고, 여기는 "그 검토 결과로 만든 고객용
// 텍스트"만 다룬다.

import { requireUser } from "@/lib/auth";

export type TrialSessionNeedingReview = {
  sessionId: string;
  subjectEnrollmentId: string;
  startsAt: string;
  finalStatus: string;
  reviewStatus: "none" | "draft" | "final";
  draftText: string | null;
};

// 완료된(final_status='completed') 체험(lesson_type.code='trial') 수업 중
// 본인이 담당한 것만 — 리뷰 작성/확정 대상 목록.
export async function listMyTrialSessionsNeedingReview(): Promise<TrialSessionNeedingReview[]> {
  const { supabase, user } = await requireUser();
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("id, subject_enrollment_id, reservation_id, final_status, lesson_type:lesson_types!inner(code)")
    .eq("teacher_id", user.id)
    .eq("final_status", "completed")
    .eq("lesson_types.code", "trial");
  if (error) throw new Error(error.message);

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const { data: reviews } = sessionIds.length
    ? await supabase.from("trial_lesson_reviews").select("session_id, status, draft_text").in("session_id", sessionIds)
    : { data: [] as { session_id: string; status: string; draft_text: string | null }[] };
  const reviewBySession = new Map((reviews ?? []).map((r) => [r.session_id, r]));

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
      draftText: review?.draft_text ?? null,
    };
  });
}

export async function saveTrialLessonReviewDraft(params: {
  sessionId: string;
  draftText: string;
}): Promise<{ reviewId: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("save_trial_lesson_review_draft", {
    p_session_id: params.sessionId,
    p_draft_text: params.draftText,
  });
  if (error) throw new Error(error.message);
  return { reviewId: data as string };
}

export async function finalizeTrialLessonReview(params: {
  sessionId: string;
  finalText: string;
}): Promise<{ reviewId: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("finalize_trial_lesson_review", {
    p_session_id: params.sessionId,
    p_final_text: params.finalText,
  });
  if (error) throw new Error(error.message);
  return { reviewId: data as string };
}
