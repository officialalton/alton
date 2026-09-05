import type { SupabaseClient } from "@supabase/supabase-js";

// M4(사용자 지시, 2026-09-05, 4번) — 계약이 실제로 서명 완료(active 전환)되는
// 순간 관리자가 매번 "상담 종료" 버튼을 눌러야 했던 수동 단계를 자동화한다.
// DocuSign 서명완료 웹훅(app/api/webhooks/docusign/route.ts)의 contracts.status
// UPDATE 직후에만 호출한다. admin_close_consultation() RPC를 그대로 재사용하고
// (20261029000000 마이그레이션이 service_role 호출을 허용하도록 완화),
// 관리자 수동 종료(closeConsultationAction)는 전혀 건드리지 않는다.
//
// 실패해도(예: 매칭되는 열린 상담을 못 찾음) 계약 활성화 자체를 절대 막지 않는다
// — lib/enrollment/auto-activate.ts와 동일한 패턴으로 실패는 구조화 로그만
// 남기고 예외를 던지지 않는다.
export async function autoCloseConsultationOnContractSigned(
  admin: SupabaseClient,
  contractId: string
): Promise<void> {
  const { data: contract, error: contractError } = await admin
    .from("contracts")
    .select("id, child_id")
    .eq("id", contractId)
    .maybeSingle();
  if (contractError || !contract?.child_id) {
    console.info(
      JSON.stringify({
        type: "auto_close_consultation_contract_lookup_failed",
        contractId,
        error: contractError?.message ?? "no child_id on contract",
      })
    );
    return;
  }

  // 이 자녀의 열려있는(closure_type is null) 체험 파이프라인 상담 중 가장 최근
  // 것을 찾는다 — 관리자 수동 종료와 동일한 개념(outcome='trial_recommended').
  const { data: consultation, error: consultationError } = await admin
    .from("consultations")
    .select("id")
    .eq("child_id", contract.child_id)
    .eq("outcome", "trial_recommended")
    .is("closure_type", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (consultationError || !consultation) {
    console.info(
      JSON.stringify({
        type: "auto_close_consultation_no_open_consultation",
        contractId,
        childId: contract.child_id,
        error: consultationError?.message ?? null,
      })
    );
    return;
  }

  // 확정된 체험 리뷰(lesson_reviews.final_text)가 있으면 그대로 재사용하고,
  // 없으면 안전한 기본 문구로 채운다(상담 종료 리뷰는 필수 non-empty 텍스트).
  let reviewText = "계약 서명 완료로 자동 종료";
  const { data: subjectEnrollments } = await admin
    .from("subject_enrollments")
    .select("id")
    .eq("contract_id", contractId);
  const enrollmentIds = (subjectEnrollments ?? []).map((e) => e.id as string);
  if (enrollmentIds.length > 0) {
    const { data: review } = await admin
      .from("lesson_reviews")
      .select("final_text")
      .in("subject_enrollment_id", enrollmentIds)
      .eq("status", "final")
      .order("finalized_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (review?.final_text) reviewText = review.final_text as string;
  }

  const { error: closeError } = await admin.rpc("admin_close_consultation", {
    p_consultation_id: consultation.id,
    p_closure_type: "contract_signed",
    p_review_text: reviewText,
  });
  if (closeError) {
    console.info(
      JSON.stringify({
        type: "auto_close_consultation_rpc_failed",
        contractId,
        consultationId: consultation.id,
        error: closeError.message,
      })
    );
    return;
  }
  console.info(
    JSON.stringify({ type: "auto_close_consultation_succeeded", contractId, consultationId: consultation.id })
  );
}
