"use server";

import { requireAdminOrCapability } from "@/lib/admin-auth";

const CAPABILITY = "manage_guardian_consent";

// R2 Task 6 — 관리자의 수동 보호자 동의 등록(예: 서면/전화로 확인된 동의를
// 사후 입력). 일반 보호자 셀프서비스 동의(app/parent/consent-actions.ts)와는
// 별도 경로다 — 증빙(verification_reference) 필수 확인은
// record_manual_guardian_consent() DB 함수가 강제한다. 이 액션을 호출하는
// 관리자 화면은 아직 없다(R12 후속 UI 항목) — 이 파일은 그 UI가 붙을 때
// 바로 쓸 수 있는 서버 액션 자체만 먼저 마련해둔 것이다.
export async function recordManualGuardianConsent(params: {
  studentId: string;
  policyVersionId: string;
  consentedBy: string;
  verificationReference: string;
}): Promise<void> {
  const { supabase } = await requireAdminOrCapability(CAPABILITY);
  if (!params.verificationReference.trim()) {
    throw new Error("수동 확인 증빙을 입력해주세요.");
  }

  const { error } = await supabase.rpc("record_manual_guardian_consent", {
    p_student_id: params.studentId,
    p_policy_version_id: params.policyVersionId,
    p_consented_by: params.consentedBy,
    p_verification_reference: params.verificationReference,
    p_notice_delivered_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}
