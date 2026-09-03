"use server";

// M4 (2/N) — 보호자가 확정된 체험 리뷰를 확인하고 정규 진행을 희망하는 서버
// 액션. 계약 체결/구매 확정이 아니다 — 관리자에게 "계약 발송 준비됨"으로만
// 보이게 하는 신호(confirm_regular_progress_intent, DB에서 확정 리뷰 존재를
// 다시 검증).

import { requireUser } from "@/lib/auth";

export type TrialLessonReviewForFamily = {
  reviewId: string;
  finalText: string;
  finalizedAt: string;
} | null;

export async function getTrialLessonReviewForFamily(
  subjectEnrollmentId: string
): Promise<TrialLessonReviewForFamily> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("get_trial_lesson_review_for_family", {
    p_subject_enrollment_id: subjectEnrollmentId,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return null;
  return { reviewId: row.review_id, finalText: row.final_text, finalizedAt: row.finalized_at };
}

export async function confirmRegularProgressIntent(subjectEnrollmentId: string): Promise<{ selectionId: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("confirm_regular_progress_intent", {
    p_subject_enrollment_id: subjectEnrollmentId,
  });
  if (error) throw new Error(error.message);
  return { selectionId: data as string };
}
