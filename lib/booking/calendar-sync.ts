import { createAdminClient } from "@/lib/supabase-admin";
import { createCalendarEventWithMeet, deleteCalendarEvent } from "@/lib/google-calendar";
import { extractMeetingCodeFromLink, enableMeetSpaceSmartNotes } from "@/lib/google-meet";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";

// R6 2/N·10/N — 확정된 예약(reservations.status='confirmed')에 Calendar 이벤트+Meet를 붙이는
// 동기화. drive-artifacts.ts(R3)의 큐 처리 패턴(조건부 UPDATE로 낙관적 잠금, retry_count
// 초과 시 reconciliation_needed로 전환)을 그대로 재사용한다.
//
// 중요: 이 동기화가 실패해도 reservations/sessions/entitlement hold는 절대 건드리지
// 않는다 — Google 쪽 산출물(google_event_id/google_meet_link)만 재시도 대상이다(DB가
// 원본, Calendar는 실행용 사본이라는 스펙 원칙).
//
// 10/N: 단일 예약을 동기화하는 로직(syncOneReservationCalendarEvent)을 별도로 뽑아
// confirmLessonBooking() 직후(실제 서버 흐름) 즉시 호출과 processPendingCalendarSyncs()
// (배치 재처리 워커) 양쪽에서 공유한다 — 클레임 방식의 동시성 안전장치는 두 경로 모두
// 동일하게 적용된다(같은 예약을 두 경로가 동시에 건드려도 조건부 UPDATE가 하나만 통과시킴).

const MAX_RETRY_COUNT = 5;

type PendingReservationRow = {
  id: string;
  owner_profile_id: string;
  starts_at: string;
  ends_at: string;
  google_sync_retry_count: number;
};

async function resolveTeacherWorkspaceEmail(
  admin: ReturnType<typeof createAdminClient>,
  teacherId: string
): Promise<string> {
  const { data, error } = await admin
    .from("teachers")
    .select("workspace_email")
    .eq("id", teacherId)
    .single();
  if (error) throw new Error(error.message);
  if (!data?.workspace_email) {
    throw new Error(`선생님(${teacherId})의 workspace_email이 아직 없습니다 — Directory 프로비저닝 선행 필요.`);
  }
  return data.workspace_email as string;
}

/**
 * 정규수업 Meet Space의 Smart Notes 자동 생성을 켠다(가족계약 필수 조항 — 회차별 선택 없음,
 * 항상 ON). 이 호출이 실패해도 Calendar 이벤트 자체는 이미 성공한 것으로 처리한다 — 예약·
 * 세션·수업권 hold를 자동 취소하지 않고, `sessions.smart_notes_config_status`를 'failed'로
 * 남겨 관리자 재처리 대상으로 기록한다.
 */
async function applySmartNotesConfigBestEffort(params: {
  admin: ReturnType<typeof createAdminClient>;
  reservationId: string;
  teacherWorkspaceEmail: string;
  meetLink: string;
}): Promise<void> {
  const meetingCode = extractMeetingCodeFromLink(params.meetLink);
  if (!meetingCode) return;

  const attemptedAt = new Date().toISOString();
  try {
    await enableMeetSpaceSmartNotes({ teacherWorkspaceEmail: params.teacherWorkspaceEmail, meetingCode });
    await params.admin
      .from("sessions")
      .update({ smart_notes_config_status: "applied", smart_notes_config_error: null, smart_notes_config_attempted_at: attemptedAt })
      .eq("reservation_id", params.reservationId);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await params.admin
      .from("sessions")
      .update({ smart_notes_config_status: "failed", smart_notes_config_error: message.slice(0, 500), smart_notes_config_attempted_at: attemptedAt })
      .eq("reservation_id", params.reservationId);
    console.error(
      JSON.stringify({
        type: "r6_smart_notes_config_failed",
        reservationId: params.reservationId,
        meetingCode,
        error: message,
      })
    );
  }
}

async function processOnePendingReservation(
  admin: ReturnType<typeof createAdminClient>,
  row: PendingReservationRow
): Promise<{ googleEventId: string; meetLink: string; teacherWorkspaceEmail: string }> {
  const teacherWorkspaceEmail = await resolveTeacherWorkspaceEmail(admin, row.owner_profile_id);
  const { googleEventId, meetLink } = await createCalendarEventWithMeet({
    teacherWorkspaceEmail,
    reservationId: row.id,
    startsAt: new Date(row.starts_at),
    endsAt: new Date(row.ends_at),
    summary: "ALTON 정규수업",
    timezone: DEFAULT_TIMEZONE,
  });
  return { googleEventId, meetLink, teacherWorkspaceEmail };
}

export type SyncOneReservationResult =
  | { outcome: "synced"; googleEventId: string; meetLink: string }
  | { outcome: "failed" | "reconciliation_needed"; error: string }
  | { outcome: "skipped_race" | "skipped_not_pending" };

/**
 * 예약 하나를 동기화한다 — 조건부 UPDATE(status IN ('pending','failed') -> 'pending')로
 * claim한 뒤에만 실제로 처리한다(drive-artifacts와 동일한 낙관적 잠금). 이미
 * synced/reconciliation_needed거나 다른 워커가 먼저 claim했으면 스킵.
 */
export async function syncOneReservationCalendarEvent(reservationId: string): Promise<SyncOneReservationResult> {
  const admin = createAdminClient();

  const { data: row, error: fetchError } = await admin
    .from("reservations")
    .select("id, owner_profile_id, starts_at, ends_at, google_sync_retry_count, google_sync_status")
    .eq("id", reservationId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!row || !["pending", "failed"].includes(row.google_sync_status as string)) {
    return { outcome: "skipped_not_pending" };
  }

  const { data: claimed, error: claimError } = await admin
    .from("reservations")
    .update({ google_sync_status: "pending", google_sync_attempted_at: new Date().toISOString() })
    .eq("id", reservationId)
    .in("google_sync_status", ["pending", "failed"])
    .select("id");
  if (claimError) throw new Error(claimError.message);
  if (!claimed || claimed.length === 0) {
    return { outcome: "skipped_race" };
  }

  try {
    const { googleEventId, meetLink, teacherWorkspaceEmail } = await processOnePendingReservation(
      admin,
      row as PendingReservationRow
    );
    await admin
      .from("reservations")
      .update({
        google_sync_status: "synced",
        google_event_id: googleEventId,
        google_meet_link: meetLink,
        google_meeting_code: extractMeetingCodeFromLink(meetLink),
        google_sync_error: null,
      })
      .eq("id", reservationId);

    await applySmartNotesConfigBestEffort({ admin, reservationId, teacherWorkspaceEmail, meetLink });

    return { outcome: "synced", googleEventId, meetLink };
  } catch (syncError) {
    const nextRetryCount = (row.google_sync_retry_count as number) + 1;
    const exceededLimit = nextRetryCount > MAX_RETRY_COUNT;
    const message = syncError instanceof Error ? syncError.message : String(syncError);
    await admin
      .from("reservations")
      .update({
        google_sync_status: exceededLimit ? "reconciliation_needed" : "failed",
        google_sync_retry_count: nextRetryCount,
        google_sync_error: message.slice(0, 500),
      })
      .eq("id", reservationId);
    console.error(
      JSON.stringify({
        type: "r6_calendar_sync_failed",
        reservationId,
        retryCount: nextRetryCount,
        reconciliationNeeded: exceededLimit,
        error: message,
      })
    );
    return { outcome: exceededLimit ? "reconciliation_needed" : "failed", error: message };
  }
}

/**
 * `pending`/`failed` 상태(수동 개입이 필요한 `reconciliation_needed`는 제외)이고 아직
 * 시작하지 않은(과거로 넘어간 예약을 굳이 동기화하지 않음) confirmed 예약을 골라
 * syncOneReservationCalendarEvent()로 처리하는 배치 워커.
 */
export async function processPendingCalendarSyncs(): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
  reconciliationNeeded: number;
  skippedRace: number;
}> {
  const admin = createAdminClient();

  const { data: candidates, error } = await admin
    .from("reservations")
    .select("id")
    .eq("status", "confirmed")
    .in("google_sync_status", ["pending", "failed"])
    .gt("starts_at", new Date().toISOString());
  if (error) throw new Error(error.message);

  let succeeded = 0;
  let failed = 0;
  let reconciliationNeeded = 0;
  let skippedRace = 0;

  for (const row of candidates ?? []) {
    const result = await syncOneReservationCalendarEvent(row.id as string);
    if (result.outcome === "synced") succeeded += 1;
    else if (result.outcome === "failed") failed += 1;
    else if (result.outcome === "reconciliation_needed") reconciliationNeeded += 1;
    else if (result.outcome === "skipped_race") skippedRace += 1;
  }

  return { attempted: (candidates ?? []).length, succeeded, failed, reconciliationNeeded, skippedRace };
}

/**
 * 취소된 예약 중 Google 쪽에 이미 만들어진 이벤트가 남아있으면 삭제한다(4/N 취소 흐름이
 * 호출). 이벤트가 아직 없으면(google_event_id null) 조용히 스킵 — Calendar 쪽에 아무것도
 * 안 만들어졌으니 지울 것도 없다.
 */
export async function cancelSyncedCalendarEvent(params: {
  reservationId: string;
  teacherId: string;
  googleEventId: string | null;
}): Promise<void> {
  if (!params.googleEventId) return;
  const admin = createAdminClient();
  const teacherWorkspaceEmail = await resolveTeacherWorkspaceEmail(admin, params.teacherId);
  await deleteCalendarEvent({ teacherWorkspaceEmail, googleEventId: params.googleEventId });
}

export { MAX_RETRY_COUNT };
