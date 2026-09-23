// 2026-09-22(사용자 지시 — "선생님이 일정 확인 후 확정하거나 변경/거절") —
// 확정된 예약(reservations)에 대한 선생님의 재조정 요청/학생·보호자 응답 공용
// 로직. RPC(request_reservation_reschedule/respond_to_reservation_reschedule,
// 20261472000000)가 소유권·상태 검증과 실제 시간 변경(exclusion 제약이 최종
// 방어선)을 담당하므로, 여기서는 수락 후 Calendar 이벤트 시간을 맞추는
// best-effort 후처리만 한다(booking 생성 때 Calendar 실패가 예약 자체를
// 막지 않는 것과 같은 원칙 — lib/booking/calendar-sync.ts).

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase-admin";
import { patchCalendarEventTime } from "@/lib/google-calendar";

export async function respondToLessonRescheduleRequest(
  supabase: SupabaseClient,
  requestId: string,
  accept: boolean
): Promise<void> {
  const { error } = await supabase.rpc("respond_to_reservation_reschedule", {
    p_request_id: requestId,
    p_accept: accept,
  });
  if (error) throw new Error(error.message);
  if (!accept) return;

  const admin = createAdminClient();
  const { data: req } = await admin
    .from("reservation_reschedule_requests")
    .select("reservation_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!req) return;

  const { data: reservation } = await admin
    .from("reservations")
    .select("owner_profile_id, starts_at, ends_at, google_event_id")
    .eq("id", req.reservation_id)
    .maybeSingle();
  if (!reservation?.google_event_id) return;

  const { data: teacher } = await admin
    .from("teachers")
    .select("workspace_email")
    .eq("id", reservation.owner_profile_id)
    .maybeSingle();
  if (!teacher?.workspace_email) return;

  try {
    await patchCalendarEventTime({
      teacherWorkspaceEmail: teacher.workspace_email as string,
      googleEventId: reservation.google_event_id as string,
      startsAt: new Date(reservation.starts_at as string),
      endsAt: new Date(reservation.ends_at as string),
      timezone: "Asia/Seoul",
      sendUpdates: "all",
    });
  } catch (e) {
    console.error(
      JSON.stringify({
        type: "reservation_reschedule_calendar_patch_failed",
        requestId,
        error: e instanceof Error ? e.message : String(e),
      })
    );
  }
}
