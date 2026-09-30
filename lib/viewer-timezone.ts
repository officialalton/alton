import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveViewerTimezone } from "@/lib/timezone";

// 서버 페이지가 requireUser()의 profile(role, timezone)로 뷰어 시간대를 정한다. 개인 설정이 있으면 추가
// 쿼리 없이 끝나고, 학생·학부모가 개인 설정이 없을 때만 household 기본값을 한 번 읽는다.
export async function loadViewerTimezone(
  supabase: SupabaseClient,
  userId: string,
  profile: { role?: string | null; timezone?: string | null } | null
): Promise<string> {
  let householdDefaultTimezone: string | null = null;
  if (!profile?.timezone && (profile?.role === "student" || profile?.role === "parent")) {
    const { data } = await supabase
      .from("household_members")
      .select("household:households(default_timezone)")
      .eq("profile_id", userId)
      .maybeSingle();
    const h = data ? (Array.isArray(data.household) ? data.household[0] : data.household) : null;
    householdDefaultTimezone = (h as { default_timezone?: string | null } | null)?.default_timezone ?? null;
  }
  return resolveViewerTimezone({ profileTimezone: profile?.timezone, householdDefaultTimezone, role: profile?.role });
}
