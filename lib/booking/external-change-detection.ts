import { createAdminClient } from "@/lib/supabase-admin";
import { listCalendarEventsIncremental } from "@/lib/google-calendar";

// R6 11/N — 선생님/관리자가 Google Calendar에서 ALTON 수업 이벤트를 직접 바꿨을 때
// 감지만 하고, 업무 상태(reservations/sessions/entitlement hold)는 절대 자동으로
// 확정하지 않는다(제품 오너 2026-09-02 확정 정책). 여기서 하는 일은 오직
// reservations.external_change_status를 세팅하는 것뿐 — 그 다음 "관리자가 ALTON에서
// 승인"하는 절차(가용성·FreeBusy·버퍼·중복예약·수업권·알림 영향 재검사)는 별도
// 관리자 액션(app/admin/schedule-actions.ts)이 담당한다.
//
// 제목·설명 변경은 애초에 이 함수가 조회하는 필드(start/end/status/meetLink)에 없으므로
// 추적 대상이 아니다. Meet 링크 변경은 감지만 하고(meet_link_changed) 자동 수용하지 않는다.

export type ReconcileTeacherResult = {
  checked: boolean;
  changesDetected: number;
  error?: string;
};

/**
 * 선생님 한 명의 Calendar를 증분 조회해 ALTON이 만든 이벤트(사견 예약)의 외부 변경을
 * 감지한다. sync token이 없거나 만료됐으면 전체 재동기화로 폴백한다. 실제 Google 호출이
 * 꺼져 있으면(CALENDAR_SYNC_ALLOW_REAL_CALLS !== "true") listCalendarEventsIncremental이
 * 예외를 던지므로, 이 함수는 그 예외를 잡아 `{checked: false, error}`로 반환한다(FreeBusy
 * 사전 확인과 동일하게, 이 대조 자체의 실패가 다른 업무를 막지 않는다).
 */
export async function reconcileTeacherCalendarChanges(teacherId: string): Promise<ReconcileTeacherResult> {
  const admin = createAdminClient();

  const { data: teacher, error: teacherError } = await admin
    .from("teachers")
    .select("workspace_email")
    .eq("id", teacherId)
    .single();
  if (teacherError) throw new Error(teacherError.message);
  if (!teacher?.workspace_email) {
    return { checked: false, changesDetected: 0, error: "workspace_email이 없습니다." };
  }

  const { data: syncState } = await admin
    .from("teacher_calendar_sync_state")
    .select("sync_token")
    .eq("teacher_id", teacherId)
    .maybeSingle();

  let result;
  try {
    result = await listCalendarEventsIncremental({
      teacherWorkspaceEmail: teacher.workspace_email as string,
      syncToken: (syncState?.sync_token as string | undefined) ?? undefined,
    });
    if (result.syncTokenExpired) {
      result = await listCalendarEventsIncremental({ teacherWorkspaceEmail: teacher.workspace_email as string });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin
      .from("teacher_calendar_sync_state")
      .upsert({ teacher_id: teacherId, last_sync_error: message.slice(0, 500) }, { onConflict: "teacher_id" });
    return { checked: false, changesDetected: 0, error: message };
  }

  let changesDetected = 0;
  for (const event of result.events) {
    // (2026-09-03 정정, Sandbox 실측으로 발견) Google은 삭제된(cancelled) 이벤트의
    // extendedProperties를 증분 동기화 응답에서 거의 항상 비운다 — altonReservationId로
    // 식별할 수 없다. 이 경우 googleEventId로 우리 DB의 예약을 직접 대조해 식별한다
    // (같은 선생님의 예약만, teacher_id는 이미 이 함수 스코프로 제한돼 있음).
    const reservationQuery = event.altonReservationId
      ? admin
          .from("reservations")
          .select("id, starts_at, ends_at, google_event_id, google_meet_link, status")
          .eq("id", event.altonReservationId)
          .maybeSingle()
      : admin
          .from("reservations")
          .select("id, starts_at, ends_at, google_event_id, google_meet_link, status")
          .eq("google_event_id", event.googleEventId)
          .eq("owner_profile_id", teacherId)
          .maybeSingle();
    const { data: reservation } = await reservationQuery;
    if (!reservation || reservation.status !== "confirmed") continue;
    if (reservation.google_event_id !== event.googleEventId) continue;

    let changeStatus: "time_changed" | "deleted" | "meet_link_changed" | null = null;
    if (event.status === "cancelled") {
      changeStatus = "deleted";
    } else if (
      event.startsAt &&
      event.endsAt &&
      (new Date(event.startsAt).getTime() !== new Date(reservation.starts_at as string).getTime() ||
        new Date(event.endsAt).getTime() !== new Date(reservation.ends_at as string).getTime())
    ) {
      changeStatus = "time_changed";
    } else if (event.meetLink && event.meetLink !== reservation.google_meet_link) {
      changeStatus = "meet_link_changed";
    }

    if (changeStatus) {
      changesDetected += 1;
      await admin
        .from("reservations")
        .update({
          external_change_status: changeStatus,
          external_change_detected_at: new Date().toISOString(),
          external_change_detail: {
            google_starts_at: event.startsAt,
            google_ends_at: event.endsAt,
            google_meet_link: event.meetLink,
            google_status: event.status,
          },
        })
        .eq("id", reservation.id)
        .eq("external_change_status", "none"); // 이미 관리자 확인 대기 중이면 덮어쓰지 않음(먼저 확인부터)
    }
  }

  await admin
    .from("teacher_calendar_sync_state")
    .upsert(
      { teacher_id: teacherId, sync_token: result.nextSyncToken, last_synced_at: new Date().toISOString(), last_sync_error: null },
      { onConflict: "teacher_id" }
    );

  return { checked: true, changesDetected };
}
