import { createAdminClient } from "@/lib/supabase-admin";
import { createCalendarEventWithMeet, deleteCalendarEvent } from "@/lib/google-calendar";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";

// R6 2/N — 확정된 예약(reservations.status='confirmed')에 Calendar 이벤트+Meet를 붙이는
// 재처리 워커. drive-artifacts.ts(R3)의 큐 처리 패턴(조건부 UPDATE로 낙관적 잠금,
// retry_count 초과 시 reconciliation_needed로 전환)을 그대로 재사용한다.
//
// 중요: 이 워커가 실패해도 reservations/sessions/entitlement hold는 절대 건드리지
// 않는다 — Google 쪽 산출물(google_event_id/google_meet_link)만 재시도 대상이다(DB가
// 원본, Calendar는 실행용 사본이라는 스펙 원칙).

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

async function processOnePendingReservation(
  admin: ReturnType<typeof createAdminClient>,
  row: PendingReservationRow
): Promise<{ googleEventId: string; meetLink: string }> {
  const teacherWorkspaceEmail = await resolveTeacherWorkspaceEmail(admin, row.owner_profile_id);
  return createCalendarEventWithMeet({
    teacherWorkspaceEmail,
    reservationId: row.id,
    startsAt: new Date(row.starts_at),
    endsAt: new Date(row.ends_at),
    summary: "ALTON 정규수업",
    timezone: DEFAULT_TIMEZONE,
  });
}

/**
 * `pending`/`failed` 상태(수동 개입이 필요한 `reconciliation_needed`는 제외)이고 아직
 * 시작하지 않은(과거로 넘어간 예약을 굳이 동기화하지 않음) confirmed 예약을 골라
 * Calendar 이벤트를 생성한다. 동시 실행 안전성은 drive-artifacts와 동일하게
 * `UPDATE ... WHERE google_sync_status IN (...)` 조건부 갱신으로 확보한다.
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
    .select("id, owner_profile_id, starts_at, ends_at, google_sync_retry_count")
    .eq("status", "confirmed")
    .in("google_sync_status", ["pending", "failed"])
    .gt("starts_at", new Date().toISOString());
  if (error) throw new Error(error.message);

  let succeeded = 0;
  let failed = 0;
  let reconciliationNeeded = 0;
  let skippedRace = 0;

  for (const row of (candidates ?? []) as PendingReservationRow[]) {
    const { data: claimed, error: claimError } = await admin
      .from("reservations")
      .update({ google_sync_status: "pending", google_sync_attempted_at: new Date().toISOString() })
      .eq("id", row.id)
      .in("google_sync_status", ["pending", "failed"])
      .select("id");
    if (claimError) throw new Error(claimError.message);
    if (!claimed || claimed.length === 0) {
      skippedRace += 1;
      continue;
    }

    try {
      const { googleEventId, meetLink } = await processOnePendingReservation(admin, row);
      await admin
        .from("reservations")
        .update({ google_sync_status: "synced", google_event_id: googleEventId, google_meet_link: meetLink, google_sync_error: null })
        .eq("id", row.id);
      succeeded += 1;
    } catch (syncError) {
      const nextRetryCount = row.google_sync_retry_count + 1;
      const exceededLimit = nextRetryCount > MAX_RETRY_COUNT;
      const message = syncError instanceof Error ? syncError.message : String(syncError);
      await admin
        .from("reservations")
        .update({
          google_sync_status: exceededLimit ? "reconciliation_needed" : "failed",
          google_sync_retry_count: nextRetryCount,
          google_sync_error: message.slice(0, 500),
        })
        .eq("id", row.id);
      if (exceededLimit) reconciliationNeeded += 1;
      else failed += 1;
      console.error(
        JSON.stringify({
          type: "r6_calendar_sync_failed",
          reservationId: row.id,
          retryCount: nextRetryCount,
          reconciliationNeeded: exceededLimit,
          error: message,
        })
      );
    }
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
