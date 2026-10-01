import type { SupabaseClient } from "@supabase/supabase-js";

// 2026-09-07 — 잔여 수업권/충전 데이터(students.credit_balance, credit_packages)는
// 더 이상 조회하지 않는다(CreditsTab.tsx 상단 주석 참고 — EntitlementsTab이 그
// 역할을 대체, 레거시 값은 R4 구매로 절대 갱신되지 않아 표시 자체가 오해를 유발).
// 지인 추천 코드(parents.referral_code)만 남긴다.
export type ParentCreditsData = {
  referralCode: string | null;
};

export async function loadParentCreditsData(
  supabase: SupabaseClient,
  parentId: string
): Promise<ParentCreditsData> {
  const { data: parent } = await supabase
    .from("parents")
    .select("referral_code")
    .eq("id", parentId)
    .maybeSingle();

  return {
    referralCode: parent?.referral_code ?? null,
  };
}
