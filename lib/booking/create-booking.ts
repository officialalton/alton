import { createAdminClient } from "@/lib/supabase-admin";

// R6 6/N — 예약 생성·취소의 공통 코어. 호출부(app/parent, app/student, app/admin의
// 서버 액션)가 권한 검증(보호자·본인·관리자인지)을 이미 끝낸 뒤 이 함수들을 부른다 —
// 여기서는 다시 검증하지 않는다(purchase-actions.ts와 동일한 계층 분리: 권한은
// RLS-scoped 클라이언트로 액션 레이어에서, 실제 쓰기는 admin 클라이언트로 이 레이어에서).
//
// Google Calendar/Meet 생성은 여기서 동기 호출하지 않는다 — 예약 확정 자체를 외부
// API 지연/장애에 묶지 않기 위해서다(스펙: "Google 생성 실패 시 DB·수업권 hold가
// 어중간하게 남지 않도록"). `lib/booking/calendar-sync.ts`의
// `processPendingCalendarSyncs()`가 별도 배치/큐로 곧이어 처리한다.

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

export async function confirmLessonBooking(params: ConfirmBookingParams): Promise<ConfirmBookingResult> {
  const admin = createAdminClient();
  const endsAt = new Date(params.startsAt.getTime() + params.durationMinutes * 60_000);

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
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    occurrenceIndex: row.occurrence_index as number,
    reservationId: (row.reservation_id as string) ?? null,
    sessionId: (row.session_id as string) ?? null,
    startsAt: row.starts_at as string,
    failureReason: (row.failure_reason as string) ?? null,
  }));
}

export type CancelBookingParams = {
  reservationId: string;
  cancelledByRole: "student" | "teacher" | "company";
  cancelledById: string;
  reason: string;
};

export async function cancelLessonBooking(params: CancelBookingParams): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("cancel_lesson_booking", {
    p_reservation_id: params.reservationId,
    p_cancelled_by_role: params.cancelledByRole,
    p_cancelled_by_id: params.cancelledById,
    p_reason: params.reason,
  });
  if (error) throw new Error(error.message);
}
