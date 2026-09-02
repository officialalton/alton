"use server";

// R6 6/N — 학생 본인이 정규수업을 예약·취소하는 서버 액션(app/parent/booking-actions.ts의
// 보호자용 버전과 동일 로직, "이 자녀가 내 가족"이 아니라 "이게 내 계정인지"만 다르다).

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  confirmLessonBooking,
  createWeeklyLessonSeries,
  cancelLessonBooking,
  type WeeklySeriesOccurrenceResult,
} from "@/lib/booking/create-booking";
import { assertActiveTeacherAssignment, assertReservationBelongsToChild } from "@/lib/booking/authorization";
import { listAvailableSlotsForBooking as queryAvailableSlots, type AvailableSlotsQuery } from "@/lib/booking/query-slots";

export type { AvailableSlotsQuery };

export async function listAvailableSlotsForBooking(query: AvailableSlotsQuery): Promise<Date[]> {
  await requireUser();
  return queryAvailableSlots(query);
}

export type CreateLessonBookingParams = {
  subjectEnrollmentId: string;
  teacherId: string;
  lessonTypeId: string;
  startsAt: Date;
  durationMinutes: number;
};

export async function createMyLessonBooking(
  params: CreateLessonBookingParams
): Promise<{ reservationId: string; sessionId: string }> {
  const { user } = await requireUser();
  const admin = createAdminClient();
  await assertActiveTeacherAssignment(admin, params.subjectEnrollmentId, params.teacherId);

  const idempotencyKey = `student-booking:${user.id}:${params.subjectEnrollmentId}:${params.startsAt.toISOString()}`;
  return confirmLessonBooking({ ...params, childId: user.id, idempotencyKey });
}

export type CreateWeeklySeriesParams = {
  subjectEnrollmentId: string;
  teacherId: string;
  lessonTypeId: string;
  firstStartsAt: Date;
  durationMinutes: number;
  occurrences: number;
  seriesTimezone: string;
};

export async function createMyWeeklyLessonSeries(
  params: CreateWeeklySeriesParams
): Promise<WeeklySeriesOccurrenceResult[]> {
  const { user } = await requireUser();
  const admin = createAdminClient();
  await assertActiveTeacherAssignment(admin, params.subjectEnrollmentId, params.teacherId);

  const idempotencyKeyPrefix = `student-series:${user.id}:${params.subjectEnrollmentId}:${params.firstStartsAt.toISOString()}`;
  return createWeeklyLessonSeries({ ...params, childId: user.id, idempotencyKeyPrefix, createdBy: user.id });
}

/** R6: 브라우저 감지 timezone 제안 UI가 "적용" 클릭 시 호출 — 본인 profiles.timezone 갱신. */
export async function updateMyTimezone(timezone: string): Promise<void> {
  const { user, supabase } = await requireUser();
  const { error } = await supabase.from("profiles").update({ timezone }).eq("id", user.id);
  if (error) throw new Error(error.message);
}

export async function cancelMyLessonBooking(params: { reservationId: string; reason: string }): Promise<void> {
  const { user } = await requireUser();
  const admin = createAdminClient();
  await assertReservationBelongsToChild(admin, params.reservationId, user.id);
  return cancelLessonBooking({
    reservationId: params.reservationId,
    cancelledByRole: "student",
    cancelledById: user.id,
    reason: params.reason,
  });
}
