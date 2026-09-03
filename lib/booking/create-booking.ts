import { createAdminClient } from "@/lib/supabase-admin";
import { checkTeacherFreeBusyBeforeBooking } from "@/lib/booking/freebusy-check";
import { syncOneReservationCalendarEvent, cancelSyncedCalendarEvent } from "@/lib/booking/calendar-sync";

// R6 6/N·10/N — 예약 생성·취소의 공통 코어. 호출부(app/parent, app/student, app/admin의
// 서버 액션)가 권한 검증(보호자·본인·관리자인지)을 이미 끝낸 뒤 이 함수들을 부른다 —
// 여기서는 다시 검증하지 않는다(purchase-actions.ts와 동일한 계층 분리: 권한은
// RLS-scoped 클라이언트로 액션 레이어에서, 실제 쓰기는 admin 클라이언트로 이 레이어에서).
//
// 10/N: FreeBusy 사전 확인과 Calendar/Meet 실제 생성을 이 함수 안에서(= 실제 서버 흐름)
// 호출하도록 배선했다 — 다만 예약 확정 자체를 외부 API 지연/장애에 절대 묶지 않는다:
// - FreeBusy 조회는 실패해도 예약을 막지 않는다(checkTeacherFreeBusyBeforeBooking 자체가
//   그렇게 설계됨 — DB 잠금이 최종 방어선, FreeBusy는 사전 경고용 이중 방어).
// - Calendar/Meet 생성은 DB 확정(RPC) *이후*에 시도하고, 실패해도 예외를 던지지 않는다
//   (reservations.google_sync_status가 'pending'/'failed'로 남아 배치 워커가 재시도) —
//   "Google 생성 실패 시 DB·수업권 hold가 어중간하게 남지 않도록" 원칙 그대로.

export type ConfirmBookingParams = {
  childId: string;
  subjectEnrollmentId: string;
  teacherId: string;
  lessonTypeId: string;
  startsAt: Date;
  durationMinutes: number;
  idempotencyKey: string;
  adminOverride?: boolean;
};

export type ConfirmBookingResult = {
  reservationId: string;
  sessionId: string;
};

function bestEffortSyncCalendarEvent(reservationId: string): void {
  // fire-and-forget이 아니라 실제로 기다리되(void 반환 함수 자체는 async), 실패가
  // confirmLessonBooking()의 성공 응답을 절대 막지 못하게 여기서 완전히 삼킨다.
  syncOneReservationCalendarEvent(reservationId).catch((e) => {
    console.error(
      JSON.stringify({
        type: "r6_calendar_sync_unexpected_error",
        reservationId,
        error: e instanceof Error ? e.message : String(e),
      })
    );
  });
}

export async function confirmLessonBooking(params: ConfirmBookingParams): Promise<ConfirmBookingResult> {
  const admin = createAdminClient();
  const endsAt = new Date(params.startsAt.getTime() + params.durationMinutes * 60_000);

  // R6 Sandbox 실측(2026-09-03)에서 발견한 실제 버그 수정: 같은 idempotencyKey로 재요청되면
  // 그 예약은 이미 첫 시도에서 Calendar에 실제로 동기화됐을 수 있다 — 이 경우 FreeBusy
  // 사전 확인이 "방금 우리가 만든 그 이벤트"를 충돌로 오탐한다(자기 자신과의 충돌).
  // 멱등 재요청은 새로운 커밋을 만들지 않으므로 FreeBusy를 다시 확인할 필요가 없다 —
  // 이미 존재하는 예약이면 사전 확인을 건너뛰고 곧바로 RPC(멱등 반환)로 진행한다.
  const { data: existingByKey } = await admin
    .from("reservations")
    .select("id")
    .eq("idempotency_key", params.idempotencyKey)
    .maybeSingle();

  if (!existingByKey) {
    const freeBusy = await checkTeacherFreeBusyBeforeBooking({
      teacherId: params.teacherId,
      startsAt: params.startsAt,
      endsAt,
    });
    if (freeBusy.checked && freeBusy.conflict) {
      throw new Error("teacher_freebusy_conflict: 선생님의 Google Calendar에 이미 겹치는 일정이 있습니다.");
    }
  }

  const { data, error } = await admin.rpc("confirm_lesson_booking", {
    p_child_id: params.childId,
    p_subject_enrollment_id: params.subjectEnrollmentId,
    p_teacher_id: params.teacherId,
    p_lesson_type_id: params.lessonTypeId,
    p_starts_at: params.startsAt.toISOString(),
    p_ends_at: endsAt.toISOString(),
    p_idempotency_key: params.idempotencyKey,
    p_admin_override: params.adminOverride ?? false,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("예약 확정 결과를 받지 못했습니다.");

  await syncOneReservationCalendarEvent(row.reservation_id as string).catch((e) => {
    console.error(
      JSON.stringify({
        type: "r6_calendar_sync_unexpected_error",
        reservationId: row.reservation_id,
        error: e instanceof Error ? e.message : String(e),
      })
    );
  });

  return { reservationId: row.reservation_id as string, sessionId: row.session_id as string };
}

export type WeeklySeriesParams = {
  childId: string;
  subjectEnrollmentId: string;
  teacherId: string;
  lessonTypeId: string;
  firstStartsAt: Date;
  durationMinutes: number;
  occurrences: number;
  seriesTimezone: string;
  idempotencyKeyPrefix: string;
  createdBy: string;
  adminOverride?: boolean;
};

export type WeeklySeriesOccurrenceResult = {
  occurrenceIndex: number;
  reservationId: string | null;
  sessionId: string | null;
  startsAt: string;
  failureReason: string | null;
};

export async function createWeeklyLessonSeries(params: WeeklySeriesParams): Promise<WeeklySeriesOccurrenceResult[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_weekly_lesson_series", {
    p_child_id: params.childId,
    p_subject_enrollment_id: params.subjectEnrollmentId,
    p_teacher_id: params.teacherId,
    p_lesson_type_id: params.lessonTypeId,
    p_first_starts_at: params.firstStartsAt.toISOString(),
    p_duration_minutes: params.durationMinutes,
    p_occurrences: params.occurrences,
    p_series_timezone: params.seriesTimezone,
    p_idempotency_key_prefix: params.idempotencyKeyPrefix,
    p_created_by: params.createdBy,
    p_admin_override: params.adminOverride ?? false,
  });
  if (error) throw new Error(error.message);
  const results = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    occurrenceIndex: row.occurrence_index as number,
    reservationId: (row.reservation_id as string) ?? null,
    sessionId: (row.session_id as string) ?? null,
    startsAt: row.starts_at as string,
    failureReason: (row.failure_reason as string) ?? null,
  }));

  for (const occurrence of results) {
    if (occurrence.reservationId) bestEffortSyncCalendarEvent(occurrence.reservationId);
  }

  return results;
}

export type CancelBookingParams = {
  reservationId: string;
  cancelledByRole: "student" | "teacher" | "company";
  cancelledById: string;
  reason: string;
};

export async function cancelLessonBooking(params: CancelBookingParams): Promise<void> {
  const admin = createAdminClient();

  // 취소 RPC가 성공하면 reservations.status가 'cancelled'로 바뀐다 — Google 이벤트를
  // 지우려면 그 전에(또는 후에도 컬럼 자체는 남으므로 상관없지만) google_event_id/
  // owner_profile_id를 미리 읽어둔다.
  const { data: reservationBeforeCancel } = await admin
    .from("reservations")
    .select("google_event_id, owner_profile_id")
    .eq("id", params.reservationId)
    .maybeSingle();

  const { error } = await admin.rpc("cancel_lesson_booking", {
    p_reservation_id: params.reservationId,
    p_cancelled_by_role: params.cancelledByRole,
    p_cancelled_by_id: params.cancelledById,
    p_reason: params.reason,
  });
  if (error) throw new Error(error.message);

  if (reservationBeforeCancel?.google_event_id) {
    await cancelSyncedCalendarEvent({
      reservationId: params.reservationId,
      teacherId: reservationBeforeCancel.owner_profile_id as string,
      googleEventId: reservationBeforeCancel.google_event_id as string,
    }).catch((e) => {
      // Google 쪽 이벤트 삭제 실패는 취소 자체를 실패시키지 않는다 — DB가 원본이고
      // 예약은 이미 정상적으로 취소됐다. 남은 Google 이벤트는 관리자가 나중에 정리할
      // 수 있도록 로그만 남긴다(자동 재시도 큐는 이번 범위에서 만들지 않음 — 취소된
      // 예약은 재시도 워커의 대상이 아니므로 별도 정리 경로가 필요하면 후속 R에서 추가).
      console.error(
        JSON.stringify({
          type: "r6_cancel_calendar_event_delete_failed",
          reservationId: params.reservationId,
          error: e instanceof Error ? e.message : String(e),
        })
      );
    });
  }
}
