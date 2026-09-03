"use server";

// M4 (1/N) — 체험 온보딩 링크의 "기존 보호자" 경로. 이미 로그인된 보호자가 본인
// 임을 명시적으로 확인(=로그인 상태에서 이 액션을 직접 호출)한 뒤에만 상담·잠재
// 고객을 자기 가족에 연결한다. 이메일 문자열이 같다는 이유만으로 자동 연결하지
// 않는다 — DB 함수(link_existing_guardian_to_trial_onboarding)가 auth.uid() 기준
// 소유권을 다시 검증한다.

import { requireUser } from "@/lib/auth";
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
  if (!row) throw new Error("유효하지 않은 온보딩 링크입니다.");
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

export async function linkExistingGuardianToTrialOnboarding(params: {
  linkId: string;
  existingChildId: string;
}): Promise<{ householdId: string; childId: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("link_existing_guardian_to_trial_onboarding", {
    p_link_id: params.linkId,
    p_existing_child_id: params.existingChildId,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("연결에 실패했습니다.");
  return { householdId: row.household_id, childId: row.child_id };
}

// 학생별 최초 1회 체험 Smart Notes 동의. 회차마다 다시 묻지 않는다(DB의 유니크
// 인덱스+멱등 반환이 이를 보장). 비동의 상태로 Smart Notes만 끄는 선택지는 없다
// — 이 액션 자체가 "동의"만 표현한다.
export async function recordTrialSmartNotesConsent(params: {
  childId: string;
  policyVersion: string;
}): Promise<{ consentId: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("record_trial_smart_notes_consent", {
    p_child_id: params.childId,
    p_policy_version: params.policyVersion,
  });
  if (error) throw new Error(error.message);
  return { consentId: data as string };
}
