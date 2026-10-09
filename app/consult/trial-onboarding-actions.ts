"use server";

// 온보딩 링크 미리보기(이메일 확인 화면용). 2026-09-29(6단계 정리) — "기존
// 보호자" 연결 액션과 체험 Smart Notes 동의 액션은 호출하는 화면이 없어 삭제했다.

import { createAdminClient } from "@/lib/supabase-admin";

export type TrialOnboardingLinkPreview = {
  linkId: string;
  consultationId: string;
  guardianEmail: string;
  guardianName: string;
  studentName: string;
  studentEmail: string;
  studentGrade: string | null;
};

// 토큰 미리보기(계정 생성 없이 정보만 확인) — 로그인 여부와 무관하게 호출 가능한
// 정보 조회이므로 admin 클라이언트로 RPC만 호출한다(redeem_trial_onboarding_link
// 자체는 anon에도 열려있지만, Server Action에서는 service_role 클라이언트로
// 일관되게 호출한다).
export async function previewTrialOnboardingLink(token: string): Promise<TrialOnboardingLinkPreview> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("redeem_trial_onboarding_link", { p_token: token });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("This onboarding link is invalid.");
  return {
    linkId: row.link_id,
    consultationId: row.consultation_id,
    guardianEmail: row.guardian_email,
    guardianName: row.guardian_name,
    studentName: row.student_name,
    studentEmail: row.student_email,
    studentGrade: row.student_grade,
  };
}
