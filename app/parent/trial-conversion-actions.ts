"use server";

// M4 (2/N) — 보호자가 확정된 체험 리뷰를 확인하고 정규 진행을 희망하는 서버
// 액션. 계약 체결/구매 확정이 아니다 — 관리자에게 "계약 발송 준비됨"으로만
// 보이게 하는 신호(confirm_regular_progress_intent, DB에서 확정 리뷰 존재를
// 다시 검증).

import { requireUser } from "@/lib/auth";

export type TrialLessonReviewForFamily = {
  reviewId: string;
  finalText: string;
  aiSummary: string | null;
  finalizedAt: string;
  categoryNotes: { key: string; label: string; note: string }[];
} | null;

// M4(2026-09-05 통합) — 체험/정규 공용 lesson_reviews에서 확정된 리뷰만(초안·
// Smart Notes 원본은 노출하지 않음) + 카테고리별 의견을 함께 가져온다. 과목
// 수강당 여러 건(체험 1건 + 이후 정규 여러 건, R9)이 있을 수 있으나 이 화면은
// 가장 최근 확정 리뷰 1건만 보여준다.
export async function getTrialLessonReviewForFamily(
  subjectEnrollmentId: string
): Promise<TrialLessonReviewForFamily> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("get_lesson_reviews_for_family", {
    p_subject_enrollment_id: subjectEnrollmentId,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as {
    review_id: string;
    final_text: string;
    ai_summary: string | null;
    finalized_at: string;
    category_key: string | null;
    category_label: string | null;
    category_note: string | null;
  }[];
  if (rows.length === 0) return null;

  const latestReviewId = rows[rows.length - 1].review_id;
  const rowsForLatest = rows.filter((r) => r.review_id === latestReviewId);
  const first = rowsForLatest[0];
  return {
    reviewId: first.review_id,
    finalText: first.final_text,
    aiSummary: first.ai_summary,
    finalizedAt: first.finalized_at,
    categoryNotes: rowsForLatest
      .filter((r) => r.category_key && r.category_note)
      .map((r) => ({ key: r.category_key as string, label: r.category_label as string, note: r.category_note as string })),
  };
}

/** 이미 "정규 진행 희망"을 표시했는지 — 화면 새로고침(router.refresh() 등) 후에도
 * 로컬 state가 아니라 실제 저장된 상태를 기준으로 버튼/완료 문구를 보여주기 위함
 * (로컬 state만 쓰면 새로고침 시 이미 접수된 걸 잊고 버튼이 다시 나타나 보호자가
 * 중복 클릭하게 된다 — 실사용 확인, RPC 자체는 멱등이라 데이터 중복은 없었지만
 * 화면이 혼란스러웠다). */
export async function hasConfirmedRegularProgressIntent(subjectEnrollmentId: string): Promise<boolean> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("trial_regular_progress_selections")
    .select("id")
    .eq("subject_enrollment_id", subjectEnrollmentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

export async function confirmRegularProgressIntent(subjectEnrollmentId: string): Promise<{ selectionId: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("confirm_regular_progress_intent", {
    p_subject_enrollment_id: subjectEnrollmentId,
  });
  if (error) throw new Error(error.message);
  return { selectionId: data as string };
}
