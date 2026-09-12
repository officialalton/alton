"use server";

// R6 6/N — 학생 본인이 정규수업을 예약·취소하는 서버 액션(app/parent/booking-actions.ts의
// 보호자용 버전과 동일 로직, "이 자녀가 내 가족"이 아니라 "이게 내 계정인지"만 다르다).

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  confirmLessonBooking,
  createWeeklyLessonSeries,
  cancelLessonBooking,
  toBookingActionOutcomeError,
  type WeeklySeriesOccurrenceResult,
  type BookingActionOutcome,
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
): Promise<BookingActionOutcome<{ reservationId: string; sessionId: string }>> {
  const { user } = await requireUser();
  try {
    const admin = createAdminClient();
    await assertActiveTeacherAssignment(admin, params.subjectEnrollmentId, params.teacherId);

    const idempotencyKey = `student-booking:${user.id}:${params.subjectEnrollmentId}:${params.startsAt.toISOString()}`;
    const data = await confirmLessonBooking({ ...params, childId: user.id, idempotencyKey });
    // 2026-09-11(UAT 발견) — 예약 확정 직후 클라이언트의 router.refresh()만으로는
    // "예정된 수업" 목록이 즉시 반영되지 않고 페이지를 새로 열어야만 보이는
    // 경우가 있었다(예약 실패로 오인하고 재시도할 위험). 이 액션을 성공시킨
    // 시점에 /student 경로를 서버에서 명시적으로 무효화해 확실히 반영한다.
    revalidatePath("/student");
    return { ok: true, data };
  } catch (e) {
    return { ok: false, ...toBookingActionOutcomeError(e) };
  }
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
): Promise<BookingActionOutcome<WeeklySeriesOccurrenceResult[]>> {
  const { user } = await requireUser();
  try {
    const admin = createAdminClient();
    await assertActiveTeacherAssignment(admin, params.subjectEnrollmentId, params.teacherId);

    const idempotencyKeyPrefix = `student-series:${user.id}:${params.subjectEnrollmentId}:${params.firstStartsAt.toISOString()}`;
    const data = await createWeeklyLessonSeries({ ...params, childId: user.id, idempotencyKeyPrefix, createdBy: user.id });
    revalidatePath("/student");
    return { ok: true, data };
  } catch (e) {
    return { ok: false, ...toBookingActionOutcomeError(e) };
  }
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
  await cancelLessonBooking({
    reservationId: params.reservationId,
    cancelledByRole: "student",
    cancelledById: user.id,
    reason: params.reason,
  });
  revalidatePath("/student");
}
