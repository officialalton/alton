"use server";

// M4 (2/N) — 보호자가 확정된 체험 리뷰를 확인하고 정규 진행을 희망하는 서버
// 액션. 계약 체결/구매 확정이 아니다 — 관리자에게 "계약 발송 준비됨"으로만
// 보이게 하는 신호(confirm_regular_progress_intent, DB에서 확정 리뷰 존재를
// 다시 검증).

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendRegularContractForSubjectEnrollment } from "@/lib/regular-contract-send";

// 2026-09-06(제품 오너 정책 변경) — 승인자가 "CEO, Do Kyung Kim" 하나로
// 고정된 뒤로, 보호자가 "정규 진행 희망"을 확인하면 관리자가 매번 수동으로
// "회사 승인 및 계약 발송" 버튼을 누르지 않아도 자동으로 계약이 발송된다.
// 이 자동 발송 경로에는 직함 입력란 자체가 없다 — 시스템이 이 고정값을
// 그대로 쓴다(app/admin 쪽 수동 버튼의 기본값과 동일한 문자열).
const AUTO_APPROVER_NAME = "Do Kyung Kim";
const AUTO_APPROVER_TITLE = "CEO, Do Kyung Kim";

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
  const { supabase, user, profile } = await requireUser();
  const { data, error } = await supabase.rpc("confirm_regular_progress_intent", {
    p_subject_enrollment_id: subjectEnrollmentId,
  });
  if (error) throw new Error(error.message);
  const selectionId = data as string;

  // 2026-09-06(제품 오너 정책 변경) — 선택 레코드가 남은 직후 자동으로 계약
  // 발송을 시도한다. best-effort: 계약 발송이 실패해도(Preview DocuSign
  // 게이트, 일시적 오류 등) 보호자의 "정규 진행 희망 확인" 자체는 이미 위
  // RPC로 성공했으므로 이 함수는 절대 실패시키지 않는다 — 실패는 로그로만
  // 남기고, 관리자 화면의 "회사 승인 및 계약 발송" 수동 버튼으로 재시도할
  // 수 있게 남겨둔다.
  await tryAutoSendRegularContract({
    subjectEnrollmentId,
    guardianUserId: user.id,
    guardianName: profile?.name ?? "",
    guardianEmail: user.email ?? "",
  });

  return { selectionId };
}

async function tryAutoSendRegularContract(params: {
  subjectEnrollmentId: string;
  guardianUserId: string;
  guardianName: string;
  guardianEmail: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: enrollment, error: enrollError } = await admin
      .from("subject_enrollments")
      .select("id, child_id")
      .eq("id", params.subjectEnrollmentId)
      .single();
    if (enrollError) throw new Error(enrollError.message);
    if (!enrollment) throw new Error("과목 수강 정보를 찾을 수 없습니다.");

    const { data: childProfile, error: childError } = await admin
      .from("profiles")
      .select("name")
      .eq("id", enrollment.child_id)
      .single();
    if (childError) throw new Error(childError.message);

    const result = await sendRegularContractForSubjectEnrollment(admin, {
      childId: enrollment.child_id,
      subjectEnrollmentId: params.subjectEnrollmentId,
      guardianEmail: params.guardianEmail,
      guardianName: params.guardianName,
      childName: childProfile?.name ?? "",
      approverName: AUTO_APPROVER_NAME,
      approverTitle: AUTO_APPROVER_TITLE,
      triggeredByUserId: params.guardianUserId,
    });
    console.info(
      JSON.stringify({
        type: "auto_regular_contract_send",
        subjectEnrollmentId: params.subjectEnrollmentId,
        result,
        at: new Date().toISOString(),
      })
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(
      "정규 진행 희망 확인 후 자동 계약 발송 실패(관리자가 수동으로 재시도해야 함):",
      params.subjectEnrollmentId,
      message
    );
  }
}
