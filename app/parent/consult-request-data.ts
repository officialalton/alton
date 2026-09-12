import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveUserTimezone } from "@/lib/timezone";

// 2026-09-06 — 보호자 포털 "새 자녀 상담 신청" 화면의 읽기 전용 데이터 로더.
// 표시 timezone은 R2 §4.21 정책(개인 설정 → household 기본값 → America/Los_Angeles)을
// 그대로 따른다(lib/timezone.ts의 resolveUserTimezone, app/student/lesson-booking-data.ts와
// 동일 패턴).

export type RequestedChild = {
  name: string;
  grade?: string;
  subjectInterest?: string;
  concerns?: string;
};

export type GuardianConsultRequest = {
  id: string;
  status: string;
  requestedChildren: RequestedChild[];
  startsAt: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  googleMeetLink: string | null;
  adminReviewSummary: string | null;
  requestedAt: string;
};

export type GuardianConsultContext = {
  householdId: string;
  guardianId: string;
  guardianName: string;
  guardianEmail: string;
  timezone: string;
};

/** 보호자 세션에서 household_id/이름/이메일/timezone을 조회한다 — 화면에서
 * 재입력받지 않고 그대로 서버 액션에 넘기기 위한 단일 진입점. */
export async function loadGuardianConsultContext(
  supabase: SupabaseClient,
  guardianId: string,
  guardianEmail: string,
  guardianName: string
): Promise<GuardianConsultContext | null> {
  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, household:households(default_timezone)")
    .eq("profile_id", guardianId)
    .eq("role", "guardian")
    .limit(1)
    .maybeSingle();
  if (!membership) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", guardianId)
    .maybeSingle();

  const householdRel = membership.household as { default_timezone?: string } | { default_timezone?: string }[] | null;
  const household = Array.isArray(householdRel) ? householdRel[0] : householdRel;

  return {
    householdId: membership.household_id,
    guardianId,
    guardianName,
    guardianEmail,
    timezone: resolveUserTimezone({
      profileTimezone: (profile?.timezone as string) ?? null,
      householdDefaultTimezone: household?.default_timezone ?? null,
    }),
  };
}

export async function loadGuardianConsultRequests(
  supabase: SupabaseClient,
  householdId: string
): Promise<GuardianConsultRequest[]> {
  const { data, error } = await supabase.rpc("list_guardian_portal_consult_requests", {
    p_household_id: householdId,
  });
  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<{
    id: string;
    status: string;
    requested_children: RequestedChild[] | null;
    starts_at: string | null;
    scheduled_at: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
    cancellation_reason: string | null;
    google_meet_link: string | null;
    admin_review_summary: string | null;
    requested_at: string;
  }>).map((r) => ({
    id: r.id,
    status: r.status,
    requestedChildren: r.requested_children ?? [],
    startsAt: r.starts_at,
    scheduledAt: r.scheduled_at,
    completedAt: r.completed_at,
    cancelledAt: r.cancelled_at,
    cancellationReason: r.cancellation_reason,
    googleMeetLink: r.google_meet_link,
    adminReviewSummary: r.admin_review_summary,
    requestedAt: r.requested_at,
  }));
}
