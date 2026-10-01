import type { SupabaseClient } from "@supabase/supabase-js";

// 2026-09-29 오너 규칙 — 미팅(meeting_requests)은 배정된 컨설턴트와 고객 사이에만 존재한다.
// 관리자·컨설턴트 서버 액션이 공유하는 조회·사전 검사 모음(최종 보장은 DB 트리거
// meeting_requests_enforce_consultant, 20261912000000).

export const MEETING_NEEDS_CONSULTANT_MESSAGE = "먼저 담당 컨설턴트를 배정해 주세요.";

/** 컨설턴트 본인 Workspace(로그인) 이메일. 없으면 null — 호출부가 Calendar 없이 저장한다. */
export async function resolveMeetingOrganizerEmail(admin: SupabaseClient, consultantId: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(consultantId);
  if (error || !data.user?.email) return null;
  return data.user.email;
}

/** 실제 Google 호출이 꺼져 있어(CALENDAR_SYNC_ALLOW_REAL_CALLS) 나는 예외인지. */
export function isCalendarRealCallsDisabledError(message: string): boolean {
  return message.includes("CALENDAR_SYNC_ALLOW_REAL_CALLS");
}

/** Calendar 호출 전에 겹침을 확인해, DB가 거절하는데 Google 이벤트만 남는 일을 막는다. */
export async function assertNoConsultantMeetingOverlap(
  admin: SupabaseClient,
  params: { consultantId: string; startsAt: Date; endsAt: Date; excludeMeetingRequestId?: string }
): Promise<void> {
  const s = params.startsAt.toISOString();
  const e = params.endsAt.toISOString();
  let meetings = admin
    .from("meeting_requests")
    .select("id", { head: true, count: "exact" })
    .eq("consultant_id", params.consultantId)
    .in("status", ["requested", "confirming", "scheduling", "scheduled"])
    .lt("starts_at", e)
    .gt("ends_at", s);
  if (params.excludeMeetingRequestId) meetings = meetings.neq("id", params.excludeMeetingRequestId);
  const consultations = admin
    .from("consultations")
    .select("id", { head: true, count: "exact" })
    .eq("admissions_consultant_id", params.consultantId)
    .in("status", ["requested", "scheduled"])
    .lt("starts_at", e)
    .gt("ends_at", s);
  const [m, c] = await Promise.all([meetings, consultations]);
  if (m.error) throw new Error(m.error.message);
  if (c.error) throw new Error(c.error.message);
  if ((m.count ?? 0) > 0) throw new Error("같은 컨설턴트의 다른 미팅과 시간이 겹칩니다. 다른 시간을 선택해 주세요.");
  if ((c.count ?? 0) > 0) throw new Error("같은 컨설턴트의 상담 일정과 시간이 겹칩니다. 다른 시간을 선택해 주세요.");
}
