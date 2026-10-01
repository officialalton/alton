"use server";

// R6 — 4개 포털 공용 시간대 설정 서버 액션. 개인 설정(profiles.timezone)은
// 기존 "본인 프로필 수정" RLS(id = auth.uid())로 이미 허용되므로 RLS-scoped
// 클라이언트로 바로 update한다. household 기본값은 주 보호자만 바꿀 수 있어야
// 해서 security definer RPC(update_household_default_timezone, 이번 migration)를
// 거친다 — 두 경우 다 admin 클라이언트를 쓰지 않는다(과도한 권한 확대 금지).

import { requireUser } from "@/lib/auth";
import { resolveUserTimezone, TIMEZONE_OPTIONS } from "@/lib/timezone";

function assertKnownTimezone(timezone: string) {
  if (!TIMEZONE_OPTIONS.some((o) => o.value === timezone)) {
    throw new Error(`지원하지 않는 시간대입니다: ${timezone}`);
  }
}

export type MyTimezoneSettings = {
  profileTimezone: string | null;
  householdId: string | null;
  householdDefaultTimezone: string | null;
  isPrimaryGuardian: boolean;
  resolvedTimezone: string;
};

/** 계정 드롭다운의 "시간대 설정" 화면이 뜰 때 현재 값을 읽어온다. */
export async function getMyTimezoneSettings(): Promise<MyTimezoneSettings> {
  const { user, supabase } = await requireUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, is_primary, role, household:households(default_timezone)")
    .eq("profile_id", user.id)
    .maybeSingle();

  const household = membership
    ? Array.isArray(membership.household)
      ? membership.household[0]
      : membership.household
    : null;

  const profileTimezone = (profile?.timezone as string | null) ?? null;
  const householdDefaultTimezone = (household as { default_timezone?: string } | null)?.default_timezone ?? null;

  return {
    profileTimezone,
    householdId: (membership?.household_id as string | null) ?? null,
    householdDefaultTimezone,
    isPrimaryGuardian: Boolean(membership?.is_primary && membership.role === "guardian"),
    resolvedTimezone: resolveUserTimezone({ profileTimezone, householdDefaultTimezone }),
  };
}

/** 개인 시간대 오버라이드 저장(null이면 household 기본값/전역 기본값으로 되돌림). */
export async function updateMyTimezone(timezone: string | null): Promise<void> {
  const { user, supabase } = await requireUser();
  if (timezone !== null) assertKnownTimezone(timezone);

  const { error } = await supabase.from("profiles").update({ timezone }).eq("id", user.id);
  if (error) throw new Error(`시간대 저장 실패: ${error.message}`);
}

/** 가족 기본 시간대 저장 — 그 household의 주 보호자만 가능(RPC 내부에서 재검증). */
export async function updateHouseholdDefaultTimezone(householdId: string, timezone: string): Promise<void> {
  const { supabase } = await requireUser();
  assertKnownTimezone(timezone);

  const { error } = await supabase.rpc("update_household_default_timezone", {
    p_household_id: householdId,
    p_timezone: timezone,
  });
  if (error) throw new Error(`가족 기본 시간대 저장 실패: ${error.message}`);
}
