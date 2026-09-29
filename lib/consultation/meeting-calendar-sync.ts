import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase-admin";
import { createCalendarEventWithMeet, patchCalendarEventTime, deleteCalendarEvent } from "@/lib/google-calendar";
import { extractMeetingCodeFromLink } from "@/lib/google-meet";
import { resolveMeetingOrganizerEmail } from "./meeting-scheduling";

// 2026-09-29 오너 결정 — 미팅(meeting_requests)의 Google Calendar 동기화 단일 경로.
//  - 취소는 이 파일의 cancelMeetingRequestWithCalendar() 하나만 거친다(관리자·컨설턴트 공통).
//  - 동기화 실패(google_sync_status='failed')는 (1) 실패한 액션 직후 after() 즉시 재시도,
//    (2) 하루 1회 크론(/api/cron/resync-meeting-events), (3) 관리자 "Google 재동기화" 버튼으로 회수한다.
//  - 재시도는 멱등이다: 이벤트 없음→생성 / 있음→시간 PATCH / 취소됨+이벤트 있음+미삭제→삭제.
//  - 시도는 google_sync_retry_count 로 세고 5회에서 멈춘다(reconciliation_needed = 영구 실패, 관리자 확인 필요).
//  - claim 은 DB RPC(for update skip locked + 10분 임대)라 즉시 재시도와 크론이 같은 행을 동시에 만들지 못한다.
//  - 실제 Google 호출은 CALENDAR_SYNC_ALLOW_REAL_CALLS=true 일 때만(fail-closed) — 꺼져 있으면 아무것도 claim 하지 않는다.

export const MEETING_SYNC_MAX_ATTEMPTS = 5;
const MEETING_TIMEZONE = "Asia/Seoul";

export function isMeetingCalendarSyncEnabled(): boolean {
  return process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS === "true";
}

type MeetingSyncRow = {
  id: string;
  status: string;
  consultant_id: string | null;
  child_id: string | null;
  household_id: string;
  starts_at: string | null;
  ends_at: string | null;
  google_event_id: string | null;
  google_meet_link: string | null;
  google_event_deleted_at: string | null;
  google_sync_retry_count: number | null;
};

export type MeetingSyncOutcome = "synced" | "failed" | "permanent" | "skipped";

async function deleteEvent(admin: SupabaseClient, row: MeetingSyncRow, eventId: string): Promise<void> {
  if (!row.consultant_id) throw new Error("담당 컨설턴트가 없어 Calendar 이벤트를 삭제할 수 없습니다.");
  const organizerEmail = await resolveMeetingOrganizerEmail(admin, row.consultant_id);
  if (!organizerEmail) throw new Error("담당 컨설턴트의 Workspace 계정(이메일)을 찾을 수 없습니다.");
  // 404/410(이미 없음)은 deleteCalendarEvent 가 성공으로 취급한다. 참석자에게 취소 알림(sendUpdates=all).
  await deleteCalendarEvent({ teacherWorkspaceEmail: organizerEmail, googleEventId: eventId, sendUpdates: "all" });
}

async function loadAttendeeEmailAndName(
  admin: SupabaseClient,
  row: MeetingSyncRow
): Promise<{ email?: string; name: string }> {
  const { data: hh } = await admin
    .from("households")
    .select("primary_guardian_id, guardian:profiles!households_primary_guardian_id_fkey(name)")
    .eq("id", row.household_id)
    .maybeSingle();
  const guardianRel = (hh as { guardian?: { name?: string } | { name?: string }[] } | null)?.guardian;
  const guardian = Array.isArray(guardianRel) ? guardianRel[0] : guardianRel;
  const guardianId = (hh as { primary_guardian_id?: string } | null)?.primary_guardian_id;
  let email: string | undefined;
  if (guardianId) email = (await admin.auth.admin.getUserById(guardianId)).data?.user?.email ?? undefined;
  if (!email && row.child_id) email = (await admin.auth.admin.getUserById(row.child_id)).data?.user?.email ?? undefined;
  return { email, name: guardian?.name ?? "학부모" };
}

async function syncOne(admin: SupabaseClient, row: MeetingSyncRow): Promise<void> {
  const now = new Date().toISOString();
  if (row.status === "cancelled") {
    if (row.google_event_id && !row.google_event_deleted_at) {
      await deleteEvent(admin, row, row.google_event_id);
      await admin.from("meeting_requests").update({ google_event_deleted_at: now }).eq("id", row.id);
    }
    return;
  }
  if (row.status !== "scheduled" || !row.starts_at || !row.ends_at) return; // 동기화할 일정 없음
  const startsAt = new Date(row.starts_at);
  const endsAt = new Date(row.ends_at);
  if (!row.consultant_id) throw new Error("담당 컨설턴트가 없어 Calendar 이벤트를 만들 수 없습니다.");
  const organizerEmail = await resolveMeetingOrganizerEmail(admin, row.consultant_id);
  if (!organizerEmail) throw new Error("담당 컨설턴트의 Workspace 계정(이메일)을 찾을 수 없습니다.");

  if (row.google_event_id) {
    await patchCalendarEventTime({
      teacherWorkspaceEmail: organizerEmail,
      googleEventId: row.google_event_id,
      startsAt,
      endsAt,
      timezone: MEETING_TIMEZONE,
      sendUpdates: "all",
    });
    return;
  }
  const who = await loadAttendeeEmailAndName(admin, row);
  const created = await createCalendarEventWithMeet({
    teacherWorkspaceEmail: organizerEmail,
    reservationId: row.id,
    startsAt,
    endsAt,
    summary: `[Alton] 상담 — ${who.name}`,
    timezone: MEETING_TIMEZONE,
    attendeeEmail: who.email,
    sendUpdates: "all",
  });
  await admin
    .from("meeting_requests")
    .update({
      google_event_id: created.googleEventId,
      google_meet_link: created.meetLink,
      google_meeting_code: extractMeetingCodeFromLink(created.meetLink),
    })
    .eq("id", row.id);
  // 생성하는 사이 취소됐다면 방금 만든 이벤트를 바로 지운다(고아 이벤트 방지).
  const { data: fresh } = await admin.from("meeting_requests").select("status").eq("id", row.id).maybeSingle();
  if (fresh?.status === "cancelled") {
    await deleteEvent(admin, row, created.googleEventId);
    await admin.from("meeting_requests").update({ google_event_deleted_at: now }).eq("id", row.id);
  }
}

/** claim 된 행 하나를 처리하고 결과(성공/실패 횟수 증가/영구 실패)를 기록한다. 절대 throw 하지 않는다. */
async function processClaimed(admin: SupabaseClient, row: MeetingSyncRow): Promise<MeetingSyncOutcome> {
  const now = new Date().toISOString();
  try {
    await syncOne(admin, row);
    await admin
      .from("meeting_requests")
      .update({
        google_sync_status: "succeeded",
        google_sync_last_error: null,
        google_sync_last_attempt_at: now,
        google_sync_claimed_at: null,
      })
      .eq("id", row.id);
    return "synced";
  } catch (e) {
    const message = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    const attempts = (row.google_sync_retry_count ?? 0) + 1;
    const permanent = attempts >= MEETING_SYNC_MAX_ATTEMPTS;
    await admin
      .from("meeting_requests")
      .update({
        google_sync_status: permanent ? "reconciliation_needed" : "failed",
        google_sync_retry_count: attempts,
        google_sync_last_error: message,
        google_sync_last_attempt_at: now,
        google_sync_claimed_at: null,
      })
      .eq("id", row.id);
    console.error(JSON.stringify({ event: "meeting_calendar_resync_failed", meetingRequestId: row.id, attempts, permanent, error: message }));
    return permanent ? "permanent" : "failed";
  }
}

async function claim(admin: SupabaseClient, limit: number, meetingRequestId?: string): Promise<MeetingSyncRow[]> {
  const { data, error } = await admin.rpc("claim_meeting_calendar_syncs", {
    p_limit: limit,
    p_meeting_request_id: meetingRequestId ?? null,
    p_max_attempts: MEETING_SYNC_MAX_ATTEMPTS,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as MeetingSyncRow[];
}

/** 특정 미팅 하나를 지금 재시도한다(즉시 재시도·관리자 버튼). 실제 호출이 꺼져 있으면 아무것도 하지 않는다. */
export async function resyncMeetingCalendarNow(meetingRequestId: string): Promise<MeetingSyncOutcome> {
  if (!isMeetingCalendarSyncEnabled()) return "skipped";
  const admin = createAdminClient();
  const [row] = await claim(admin, 1, meetingRequestId);
  if (!row) return "skipped";
  return processClaimed(admin, row);
}

/** 일 1회 크론 본체 — 재시도 가능한 failed 행을 일괄 처리한다. */
export async function runMeetingCalendarResyncBatch(limit = 20): Promise<{ claimed: number; synced: number; failed: number; permanent: number; enabled: boolean }> {
  if (!isMeetingCalendarSyncEnabled()) return { claimed: 0, synced: 0, failed: 0, permanent: 0, enabled: false };
  const admin = createAdminClient();
  const rows = await claim(admin, limit);
  const out = { claimed: rows.length, synced: 0, failed: 0, permanent: 0, enabled: true };
  for (const row of rows) {
    const r = await processClaimed(admin, row);
    if (r === "synced") out.synced += 1;
    else if (r === "permanent") out.permanent += 1;
    else out.failed += 1;
  }
  return out;
}

/** 실패한 액션 직후 호출 — 응답을 막지 않고(after) 어떤 오류도 삼킨다. */
export function scheduleMeetingCalendarResync(meetingRequestId: string): void {
  const run = async () => {
    try {
      await resyncMeetingCalendarNow(meetingRequestId);
    } catch (e) {
      console.error(JSON.stringify({ event: "meeting_calendar_immediate_resync_failed", error: e instanceof Error ? e.message : String(e) }));
    }
  };
  try {
    if (!isMeetingCalendarSyncEnabled()) return;
    try {
      after(run);
    } catch {
      void run();
    }
  } catch (e) {
    console.error(JSON.stringify({ event: "meeting_calendar_immediate_resync_failed", error: e instanceof Error ? e.message : String(e) }));
  }
}

/** 관리자 수동 재동기화 — 영구 실패(5회)도 횟수를 0으로 되돌려 다시 시도한다. */
export async function adminForceResyncMeetingCalendar(meetingRequestId: string): Promise<MeetingSyncOutcome> {
  if (!isMeetingCalendarSyncEnabled()) {
    throw new Error("실제 Google 호출이 꺼져 있어(CALENDAR_SYNC_ALLOW_REAL_CALLS) 재동기화할 수 없습니다.");
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("meeting_requests")
    .update({ google_sync_status: "failed", google_sync_retry_count: 0, google_sync_claimed_at: null })
    .eq("id", meetingRequestId)
    .in("google_sync_status", ["failed", "reconciliation_needed"])
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("재동기화가 필요한 상태가 아닙니다.");
  return resyncMeetingCalendarNow(meetingRequestId);
}

export type CancelMeetingResult = {
  newRequestId: string | null;
  /** 'none' 이벤트 없음 / 'deleted' 삭제 완료 / 'pending' 삭제 실패·미실행 → 재시도 대기 */
  calendar: "none" | "deleted" | "pending";
};

/**
 * 미팅 취소의 단일 경로. 호출부가 권한(관리자/담당 컨설턴트)을 먼저 확인해야 한다.
 * 취소 행은 항상 남긴다(이력). rerequest=true 면 같은 가족·자녀·주제·내용의 새 'requested' 행(시간·컨설턴트·이벤트 없음)을 만든다.
 * Calendar 삭제가 실패해도 취소는 유지되고 재시도 대기(failed)로 남는다.
 */
export async function cancelMeetingRequestWithCalendar(params: {
  meetingRequestId: string;
  actorId: string;
  rerequest?: boolean;
  reason?: string;
}): Promise<CancelMeetingResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("cancel_meeting_request_core", {
    p_meeting_request_id: params.meetingRequestId,
    p_actor: params.actorId,
    p_rerequest: params.rerequest ?? false,
    p_reason: params.reason ?? null,
  });
  if (error) throw new Error(error.message);
  const res = (Array.isArray(data) ? data[0] : data) as { new_request_id: string | null; google_event_id: string | null } | undefined;
  const newRequestId = res?.new_request_id ?? null;
  if (!res?.google_event_id) return { newRequestId, calendar: "none" };

  // 트리거가 이미 'failed'(삭제 대기)로 표시했다 — 지금 바로 지워 보고, 안 되면 그대로 재시도 대기.
  let outcome: MeetingSyncOutcome = "skipped";
  try {
    outcome = await resyncMeetingCalendarNow(params.meetingRequestId);
  } catch (e) {
    console.error(JSON.stringify({ event: "meeting_cancel_calendar_delete_error", error: e instanceof Error ? e.message : String(e) }));
  }
  if (outcome === "synced") return { newRequestId, calendar: "deleted" };
  if (outcome === "skipped" && !isMeetingCalendarSyncEnabled()) {
    await admin
      .from("meeting_requests")
      .update({ google_sync_last_error: "실제 Google 호출이 꺼져 있어(CALENDAR_SYNC_ALLOW_REAL_CALLS) 이벤트 삭제를 미뤘습니다." })
      .eq("id", params.meetingRequestId);
  }
  if (outcome === "failed") scheduleMeetingCalendarResync(params.meetingRequestId);
  return { newRequestId, calendar: "pending" };
}
