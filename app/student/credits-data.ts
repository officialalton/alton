import type { SupabaseClient } from "@supabase/supabase-js";

export type CreditsData = {
  balance: number;
  guardianName: string | null;
  regularRemaining: number;
  regularNearestExpiry: string | null;
  trialEntitlement: { remaining: number; expiresAt: string | null } | null;
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

export async function loadCreditsData(
  supabase: SupabaseClient,
  studentId: string
): Promise<CreditsData> {
  const { data: student } = await supabase
    .from("students")
    .select("credit_balance, member_type")
    .eq("id", studentId)
    .single();
  // 2026-10-05 무료 회원 S2 — 무료 학습 회원은 보호자·수업권이 구조적으로 없다(쿼리 생략, 빈 수업권).
  if (student?.member_type === "free") {
    return { balance: 0, guardianName: null, regularRemaining: 0, regularNearestExpiry: null, trialEntitlement: null };
  }

  // (2026-08-30 R2 Task 3) 가족 관계 원본은 households/household_members다
  // (guardian_students는 동결).
  const { data: guardian } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", studentId)
    .eq("role", "child")
    .maybeSingle();

  let guardianName: string | null = null;
  if (guardian) {
    const { data: primaryGuardian } = await supabase
      .from("household_members")
      .select("profile:profiles(name)")
      .eq("household_id", guardian.household_id)
      .eq("role", "guardian")
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle();
    guardianName = extractName(primaryGuardian?.profile) || null;
  }

  // 현재 실제 수업권 모델(entitlement_grants)은 위 credit_balance(레거시)와
  // 별개다 — 정규(120분)/체험(60분) grant는 절대 합산하지 않는다(부모용
  // entitlements-data.ts와 동일 원칙, entitlement_grant_details 뷰로 잔액 조회).
  const { data: grantDetails } = await supabase
    .from("entitlement_grant_details")
    .select("grant_id, expires_at, remaining, lesson_type_code")
    .eq("child_id", studentId);

  const regularGrants = (grantDetails ?? []).filter(
    (g) => g.lesson_type_code === "regular" && (g.remaining as number) > 0
  );
  const regularRemaining = regularGrants.reduce((sum, g) => sum + (g.remaining as number), 0);
  const regularNearestExpiry =
    regularGrants
      .map((g) => g.expires_at as string)
      .filter(Boolean)
      .sort()[0] ?? null;

  const trialGrant = (grantDetails ?? []).find(
    (g) => g.lesson_type_code === "trial" && (g.remaining as number) > 0
  );

  return {
    balance: student?.credit_balance ?? 0,
    guardianName,
    regularRemaining,
    regularNearestExpiry,
    trialEntitlement: trialGrant
      ? { remaining: trialGrant.remaining as number, expiresAt: (trialGrant.expires_at as string) ?? null }
      : null,
  };
}
