"use server";

// 2026-09-22(사용자 지시 — "관리자/컨설턴트가 최종 확인 후 확정") — 담당
// 컨설턴트가 본인 앞으로 온 학생 개인 일정 요청(meeting_requests.consultant_id)을
// 확인하고 확정(Calendar/Meet 생성)하거나 거절할 수 있다. 쓰기는 본인 세션
// 클라이언트로 해서 RLS(20261470000000 "담당 컨설턴트 조회"/"담당 컨설턴트
// 상태·일정 변경" — consultant_id=본인만 허용)가 안전망 역할을 하게 한다
// (app/parent/inquiry-actions.ts와 동일 원칙 — service_role 어드민 클라이언트는
// 이메일 조회 등 RLS로 대체 불가능한 곳에만 쓴다).
//
// Calendar 생성 로직은 app/admin/inquiry-and-meeting-actions.ts의
// scheduleMeetingRequest()와 같은 패턴(멱등 생성/갱신, 실패 시 DB 미변경)이지만
// organizer가 고정 CONSULT_ORGANIZER_EMAIL이 아니라 본인 워크스페이스 계정이다
// (lib/consultation/calendar-sync.ts의 resolveConsultOrganizerEmail과 동일 원칙).

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { createCalendarEventWithMeet, patchCalendarEventTime } from "@/lib/google-calendar";
import { extractMeetingCodeFromLink } from "@/lib/google-meet";

export type AssignedMeetingRequest = {
  id: string;
  studentName: string | null;
  content: string | null;
  status: "requested" | "confirming" | "scheduling" | "scheduled" | "completed" | "cancelled";
  startsAt: string | null;
  endsAt: string | null;
  googleMeetLink: string | null;
  createdAt: string;
};

async function requireConsultant() {
  const { user, profile, supabase } = await requireUser();
  if (profile?.role !== "consultant") throw new Error("컨설턴트만 접근할 수 있습니다.");
  return { userId: user.id, supabase };
}

export async function listMyAssignedMeetingRequestsAction(): Promise<AssignedMeetingRequest[]> {
  const { userId, supabase } = await requireConsultant();
  const { data, error } = await supabase
    .from("meeting_requests")
    .select("id, content, status, starts_at, ends_at, google_meet_link, created_at, child:profiles!meeting_requests_child_id_fkey(name)")
    .eq("consultant_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const rel = r.child as { name: string | null } | { name: string | null }[] | null;
    const child = Array.isArray(rel) ? rel[0] : rel;
    return {
      id: r.id,
      studentName: child?.name ?? null,
      content: r.content,
      status: r.status,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      googleMeetLink: r.google_meet_link,
      createdAt: r.created_at,
    };
  });
}

export async function cancelMyMeetingRequestAction(meetingRequestId: string): Promise<void> {
  const { userId, supabase } = await requireConsultant();
  const { error } = await supabase
    .from("meeting_requests")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", meetingRequestId)
    .eq("consultant_id", userId);
  if (error) throw new Error(error.message);
}

async function resolveOrganizerEmail(admin: ReturnType<typeof createAdminClient>, consultantId: string): Promise<string> {
  const { data } = await admin.auth.admin.getUserById(consultantId);
  return data.user?.email ?? process.env.CONSULT_ORGANIZER_EMAIL ?? "official@alton.education";
}

/** 스펙 §Scheduling — 담당 컨설턴트가 학생이 신청한 시간(또는 조정한 시간)을
 * 확정한다. 멱등: 이미 이벤트가 있으면 시간만 갱신(같은 이벤트 유지). */
export async function scheduleMyMeetingRequestAction(params: {
  meetingRequestId: string;
  startsAt: string;
  endsAt: string;
}): Promise<{ googleMeetLink: string }> {
  const { userId, supabase } = await requireConsultant();
  const admin = createAdminClient();

  const startsAtDate = new Date(params.startsAt);
  const endsAtDate = new Date(params.endsAt);
  if (Number.isNaN(startsAtDate.getTime()) || Number.isNaN(endsAtDate.getTime())) {
    throw new Error("일정 시간이 올바르지 않습니다.");
  }
  if (endsAtDate.getTime() <= startsAtDate.getTime()) {
    throw new Error("종료 시각은 시작 시각보다 뒤여야 합니다.");
  }

  const { data: row, error: loadError } = await supabase
    .from("meeting_requests")
    .select("id, consultant_id, child_id, google_event_id, google_meet_link, child:profiles!meeting_requests_child_id_fkey(name)")
    .eq("id", params.meetingRequestId)
    .eq("consultant_id", userId)
    .single();
  if (loadError) throw new Error(loadError.message);

  const childRel = row.child as { name?: string } | { name?: string }[] | null;
  const child = Array.isArray(childRel) ? childRel[0] : childRel;
  // profiles에는 email이 없다(auth.users 전용) — Admin API로만 조회(app/admin/inquiry-and-meeting-actions.ts와 동일 패턴).
  const { data: studentAuth } = await admin.auth.admin.getUserById(row.child_id as string);
  const studentEmail = studentAuth?.user?.email ?? undefined;
  const organizerEmail = await resolveOrganizerEmail(admin, userId);

  let googleEventId = row.google_event_id as string | null;
  let googleMeetLink = row.google_meet_link as string | null;

  try {
    if (googleEventId) {
      await patchCalendarEventTime({
        teacherWorkspaceEmail: organizerEmail,
        googleEventId,
        startsAt: startsAtDate,
        endsAt: endsAtDate,
        timezone: "Asia/Seoul",
        sendUpdates: "all",
      });
    } else {
      const created = await createCalendarEventWithMeet({
        teacherWorkspaceEmail: organizerEmail,
        reservationId: params.meetingRequestId,
        startsAt: startsAtDate,
        endsAt: endsAtDate,
        summary: `[Alton] 컨설팅 미팅 — ${child?.name ?? "학생"}`,
        timezone: "Asia/Seoul",
        attendeeEmail: studentEmail,
        sendUpdates: "all",
      });
      googleEventId = created.googleEventId;
      googleMeetLink = created.meetLink;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`Calendar 일정 생성/갱신에 실패했습니다: ${message}`);
  }

  const meetingCode = googleMeetLink ? extractMeetingCodeFromLink(googleMeetLink) : null;

  const { error: updateError } = await supabase
    .from("meeting_requests")
    .update({
      status: "scheduled",
      starts_at: params.startsAt,
      ends_at: params.endsAt,
      google_event_id: googleEventId,
      google_meet_link: googleMeetLink,
      google_meeting_code: meetingCode,
      google_sync_status: "succeeded",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.meetingRequestId)
    .eq("consultant_id", userId);
  if (updateError) throw new Error(updateError.message);

  return { googleMeetLink: googleMeetLink as string };
}
