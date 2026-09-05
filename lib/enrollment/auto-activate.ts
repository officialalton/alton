import type { SupabaseClient } from "@supabase/supabase-js";

// M4(사용자 지시, 2026-09-05): 계약 서명이 완료되면 관리자가 매번 "활성화"
// 버튼을 눌러야 했던 수동 단계를 자동화한다. 판정은 subject_enrollment_
// activation_ready() RPC를 그대로 재사용한다("자동으로 판단"이 아니라 "자동으로
// 누른다") — 다만 그 RPC 자체가 이번에 계약 active 단일 조건으로 단순화됐다
// (결제완료 수업권 조건 제거, 20261023000000 마이그레이션 참고 — 예약 자체가
// 이미 결제완료 수업권을 요구하므로 이중 게이트가 불필요했음). 선생님 배정
// (teacher_assignments)은 이 함수가 손대지 않는다 — planned→active 전이는
// 항상 기존에 배정된 선생님을 그대로 유지한다.
//
// 현재는 DocuSign 서명완료 웹훅에서만 호출한다(계약 active 단일 조건이라
// Stripe 결제완료 시점에는 호출할 필요가 없다 — 사용자 확정).
export async function autoActivateReadySubjectEnrollments(
  admin: SupabaseClient,
  contractId: string
): Promise<void> {
  const { data: enrollments, error } = await admin
    .from("subject_enrollments")
    .select("id")
    .eq("contract_id", contractId)
    .eq("status", "planned");
  if (error) {
    console.info(
      JSON.stringify({ type: "auto_activate_subject_enrollments_lookup_failed", contractId, error: error.message })
    );
    return;
  }

  for (const enrollment of enrollments ?? []) {
    const { data: ready, error: readyError } = await admin.rpc("subject_enrollment_activation_ready", {
      p_subject_enrollment_id: enrollment.id,
    });
    if (readyError) {
      console.info(
        JSON.stringify({
          type: "auto_activate_subject_enrollment_check_failed",
          subjectEnrollmentId: enrollment.id,
          error: readyError.message,
        })
      );
      continue;
    }
    if (!ready) continue;

    const { error: updateError } = await admin
      .from("subject_enrollments")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", enrollment.id)
      .eq("status", "planned");
    if (updateError) {
      console.info(
        JSON.stringify({
          type: "auto_activate_subject_enrollment_update_failed",
          subjectEnrollmentId: enrollment.id,
          error: updateError.message,
        })
      );
      continue;
    }
    console.info(
      JSON.stringify({ type: "auto_activate_subject_enrollment_succeeded", subjectEnrollmentId: enrollment.id })
    );
  }
}
