import { createAdminClient } from "@/lib/supabase-admin";
import { patchCalendarEventTime } from "@/lib/google-calendar";
import { syncOneReservationCalendarEvent } from "@/lib/booking/calendar-sync";

// R6 11/N — "ALTON 시간 유지"/"Google 시간 반영" 실제 처리. 감지(external-change-detection.ts)
// 와 분리 — 이 파일은 관리자가 확인 버튼을 눌렀을 때만 호출된다. 두 경로 모두 마지막에
// resolve_external_calendar_change RPC로 external_change_status를 정리한다(admin
// booking-actions.ts가 그 RPC 호출은 이미 담당 — 여기서는 시간 자체를 맞추는 부분만).

/**
 * "Google 시간 반영" — Google 쪽 새 시간이 실제로 저장된 external_change_detail의
 * google_starts_at/google_ends_at을 ALTON DB에 반영하기 전에 재검증한다(가용성·버퍼·
 * 중복예약·수업권). reschedule_reservation_to_google_time() RPC가 그 재검증과 UPDATE를
 * 하나의 트랜잭션으로 처리 — 검증 실패 시 이 함수가 던지는 에러를 그대로 호출부에 전달한다
 * (예약을 반쯤 바꾼 상태로 두지 않는다는 원칙).
 */
export async function acceptGoogleTimeForReservation(params: {
  reservationId: string;
  googleStartsAt: string;
  googleEndsAt: string;
  adminId: string;
  reason: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("reschedule_reservation_to_google_time", {
    p_reservation_id: params.reservationId,
    p_new_starts_at: params.googleStartsAt,
    p_new_ends_at: params.googleEndsAt,
    p_admin_id: params.adminId,
    p_reason: params.reason,
  });
  if (error) throw new Error(error.message);
}

/**
 * "ALTON 시간 유지" — ALTON DB는 그대로 두고, Google 이벤트를 ALTON 기준 시간으로
 * 되돌린다(patchCalendarEventTime). 이 시간은 confirm_lesson_booking() 통과 시점에 이미
 * 검증됐으므로 재검증하지 않는다(제품 오너 정책 — "ALTON 시간 유지 시 Google 이벤트를
 * ALTON 기준으로 복원한다"만 요구, 재검증은 Google 시간 반영 쪽에만 요구됨).
 */
export async function restoreGoogleEventToAltonTime(params: {
  reservationId: string;
  teacherWorkspaceEmail: string;
  googleEventId: string;
  altonStartsAt: string;
  altonEndsAt: string;
  timezone: string;
  adminId: string;
  reason: string;
}): Promise<void> {
  await patchCalendarEventTime({
    teacherWorkspaceEmail: params.teacherWorkspaceEmail,
    googleEventId: params.googleEventId,
    startsAt: new Date(params.altonStartsAt),
    endsAt: new Date(params.altonEndsAt),
    timezone: params.timezone,
    sendUpdates: "all",
  });

  const admin = createAdminClient();
  const { error } = await admin.rpc("record_reservation_restored_to_alton_time", {
    p_reservation_id: params.reservationId,
    p_admin_id: params.adminId,
    p_reason: params.reason,
  });
  if (error) throw new Error(error.message);
}

/**
 * "ALTON 일정 유지"(Google 이벤트 직접 삭제 케이스) — 예약·세션·수업권 hold는 그대로
 * 두고 담당 선생님 소유의 Calendar 이벤트+Meet을 다시 생성한다. `syncOneReservationCalendarEvent()`
 * 는 `google_sync_status`가 `pending`/`failed`일 때만 claim하므로, 삭제로 이미 무효가 된
 * 기존 `synced` 상태를 먼저 `pending`으로 되돌리고 옛 `google_event_id`/`google_meet_link`를
 * 지운 뒤 재호출한다(claim 방식 낙관적 잠금은 그대로 유지되어 다른 워커와 충돌하지 않음).
 * 재생성 자체가 실패하면 예외를 던지고 external_change_status는 그대로 남는다(자동
 * 확정하지 않음).
 */
export async function recreateCalendarEventAfterDeletion(params: {
  reservationId: string;
  adminId: string;
  reason: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { error: resetError } = await admin
    .from("reservations")
    .update({ google_sync_status: "pending", google_event_id: null, google_meet_link: null, google_meeting_code: null })
    .eq("id", params.reservationId);
  if (resetError) throw new Error(resetError.message);

  const result = await syncOneReservationCalendarEvent(params.reservationId);
  if (result.outcome !== "synced") {
    throw new Error(
      result.outcome === "failed" || result.outcome === "reconciliation_needed"
        ? `Calendar 이벤트 재생성 실패: ${result.error}`
        : `Calendar 이벤트 재생성이 예상과 다르게 스킵됐습니다(${result.outcome}).`
    );
  }

  const { error } = await admin.rpc("record_reservation_recreated_after_deletion", {
    p_reservation_id: params.reservationId,
    p_admin_id: params.adminId,
    p_reason: params.reason,
  });
  if (error) throw new Error(error.message);
}
