"use server";

import { requireUser } from "@/lib/auth";

/**
 * R2 Task 6: 보호자가 자기 household의 자녀에게 동의를 기록한다. 실제
 * 자격 검증(본인 household 자녀인지, 자기-동의가 아닌지, 정책 버전이
 * 유효한지)은 consent_as_guardian() DB 함수가 SECURITY DEFINER로 전부
 * 수행한다 — 여기서는 요청을 그대로 전달하고 에러만 표면화한다.
 */
export async function consentForChild(studentId: string, policyVersionId: string) {
  const { supabase } = await requireUser();

  const { error } = await supabase.rpc("consent_as_guardian", {
    p_student_id: studentId,
    p_policy_version_id: policyVersionId,
    p_notice_delivered_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

/**
 * 동의 철회. 권한 검증(동의를 기록한 본인 보호자이면서 여전히 활성
 * guardian인지, 또는 관리자인지)은 revoke_guardian_consent()가 수행한다.
 */
export async function revokeChildConsent(consentId: string, reason: string) {
  const { supabase } = await requireUser();

  const { error } = await supabase.rpc("revoke_guardian_consent", {
    p_consent_id: consentId,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
}

/**
 * 자녀 생년월일 설정. 학생 본인은 자가수정이 차단되어 있어(§4) 보호자·
 * 관리자만 이 경로로 설정할 수 있다 — 자격 검증은
 * set_student_date_of_birth()가 수행한다. 전담 설정 화면은 아직 없다(온보딩
 * 플로우 정비 시 함께 배치 예정) — 이 액션은 그 화면이 붙을 때 바로 쓸 수
 * 있도록 먼저 마련해둔 것이다.
 */
export async function setChildDateOfBirth(studentId: string, dateOfBirth: string) {
  const { supabase } = await requireUser();

  const { error } = await supabase.rpc("set_student_date_of_birth", {
    p_student_id: studentId,
    p_date_of_birth: dateOfBirth,
  });
  if (error) throw new Error(error.message);
}

/**
 * R6 7/N: AI 회의록(Smart Notes) 사용 여부 선택 — R2/R3의 필수 개인정보 동의(위 함수들)와
 * 명시적으로 분리된 별도 선택 동의 트랙(`ai_notes_consent_events`, R3에서 스키마만 준비,
 * 실제 판정 로직은 R6에서 배선). 기본은 ON(opt-out 모델) — 이 액션은 거부/재허용 이력만
 * 남긴다. 자격 검증(자녀의 보호자인지)은 set_ai_notes_consent_as_guardian()이 수행한다.
 */
export async function setAiNotesConsentForChild(studentId: string, optedIn: boolean, reason?: string) {
  const { supabase } = await requireUser();

  const { error } = await supabase.rpc("set_ai_notes_consent_as_guardian", {
    p_student_id: studentId,
    p_opted_in: optedIn,
    p_reason: reason ?? null,
  });
  if (error) throw new Error(error.message);
}
