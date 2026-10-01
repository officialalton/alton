"use server";

// Phase B(4, 2026-09-23) — 컨설턴트 Profile 탭. 이름·생년월일·성별·이력·
// 입사일을 조회하고, 성별·이력·시간대는 본인이 수정한다. 이름·생년월일·
// 입사일은 회사/신원 확인 기준 정보라 관리자만 바꾼다(생년월일은 기존
// protect_date_of_birth 트리거, 입사일은 신규 protect_hire_date 트리거가
// DB 레벨에서 한 번 더 막는다 — 여기 서버 액션은 그 필드를 애초에 받지
// 않는 방식으로 앱 레이어에서도 막는다).

import { requireConsultant } from "@/lib/admin-auth";

export type ConsultantProfile = {
  name: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  careerBio: string | null;
  hireDate: string | null;
  timezone: string | null;
};

export async function getMyConsultantProfileAction(): Promise<ConsultantProfile> {
  const { user, supabase } = await requireConsultant();
  const { data, error } = await supabase
    .from("profiles")
    .select("name, date_of_birth, gender, career_bio, hire_date, timezone")
    .eq("id", user.id)
    .single();
  if (error) throw new Error(error.message);
  return {
    name: data.name,
    dateOfBirth: data.date_of_birth,
    gender: data.gender,
    careerBio: data.career_bio,
    hireDate: data.hire_date,
    timezone: data.timezone,
  };
}

export async function updateMyConsultantProfileAction(params: {
  gender?: string | null;
  careerBio?: string | null;
  timezone?: string | null;
}): Promise<void> {
  const { user, supabase } = await requireConsultant();
  const patch: Record<string, unknown> = {};
  if ("gender" in params) patch.gender = params.gender;
  if ("careerBio" in params) patch.career_bio = params.careerBio;
  if ("timezone" in params) patch.timezone = params.timezone;
  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) throw new Error(error.message);
}
