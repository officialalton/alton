import type { SupabaseClient } from "@supabase/supabase-js";

// M4(사용자 지시, 2026-09-05): "계약 서명 + 결제 완료" 두 선행조건이 갖춰지면
// 관리자가 매번 "활성화" 버튼을 눌러야 했던 수동 단계를 자동화한다. 이 함수는
// R5의 실제 게이트(subject_enrollment_activation_ready RPC — 계약 active +
// 결제완료 수업권 존재)를 그대로 재사용해 판정하므로, 활성화 조건 자체는 전혀
// 바뀌지 않는다("자동으로 판단"이 아니라 "자동으로 누른다"). 선생님 배정
// (teacher_assignments)은 이 함수가 손대지 않는다 — planned→active 전이는
// 항상 기존에 배정된 선생님을 그대로 유지한다.
//
// 두 이벤트(DocuSign 서명 완료 웹훅, Stripe 결제완료 웹훅) 중 어느 쪽이 나중에
// 도착하든 그 시점에 두 조건이 다 갖춰졌는지 이 함수로 재확인하면 되므로, 두
// 웹훅 모두에서 동일하게 호출한다.
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
