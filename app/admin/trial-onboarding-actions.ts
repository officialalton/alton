"use server";

// M4 (1/N) — 관리자용 체험 온보딩 액션. 관리자의 outcome=trial_recommended(추천)와
// 보호자 본인의 "체험 진행 희망 확정"은 서로 다른 사건이라 confirmTrialIntent로
// 명시적으로 구분해 기록한다(전화 등 외부 채널로 확인한 결과를 관리자가 대행
// 입력하는 경우를 이번 라운드는 다룬다 — 보호자 셀프서비스 확정 화면은 범위 밖).
// 실제 이메일 발송은 하지 않는다 — raw_token을 관리자 화면에 그대로 노출해
// 로컬 검증(링크를 수동으로 열어보는 것)만 가능하게 한다.

import { requireAdminOrCapability } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

// 기존 상담 관리 액션(app/admin/consultation-actions.ts)과 동일한 capability를
// 재사용한다 — 새 권한 이름을 따로 만들지 않는다.
const CONSULT_CAPABILITY = "manage_consultations";

export async function confirmTrialIntentAction(consultationId: string): Promise<void> {
  await requireAdminOrCapability(CONSULT_CAPABILITY);
  const admin = createAdminClient();
  const { error } = await admin.rpc("confirm_trial_intent", { p_consultation_id: consultationId });
  if (error) throw new Error(error.message);
}

export async function createTrialOnboardingLinkAction(params: {
  consultationId: string;
  guardianEmail: string;
  guardianName: string;
  studentName: string;
  studentEmail: string;
  studentGrade?: string;
}): Promise<{ linkId: string; rawToken: string }> {
  await requireAdminOrCapability(CONSULT_CAPABILITY);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_trial_onboarding_link", {
    p_consultation_id: params.consultationId,
    p_guardian_email: params.guardianEmail,
    p_guardian_name: params.guardianName,
    p_student_name: params.studentName,
    p_student_email: params.studentEmail,
    p_student_grade: params.studentGrade ?? null,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("온보딩 링크 발급에 실패했습니다.");
  return { linkId: row.link_id, rawToken: row.raw_token };
}
