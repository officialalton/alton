"use server";

// R6 6/N — 보호자가 자녀의 정규수업을 예약·취소하는 서버 액션. 권한 검증은
// app/parent/purchase-actions.ts(R4)와 동일한 계층 분리를 따른다: RLS-scoped
// 세션 클라이언트로 "이 자녀가 정말 내 가족 구성원인지"까지만 확인하고, 실제 예약
// 쓰기(confirm_lesson_booking 등 service_role 전용 RPC)는 lib/booking/create-booking.ts가
// admin 클라이언트로 수행한다.

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  confirmLessonBooking,
  createWeeklyLessonSeries,
  cancelLessonBooking,
  type WeeklySeriesOccurrenceResult,
} from "@/lib/booking/create-booking";
import {
  assertGuardianOfChild,
  assertActiveTeacherAssignment,
  assertReservationBelongsToChild,
  assertSessionBelongsToChild,
} from "@/lib/booking/authorization";
import { listAvailableSlotsForBooking as queryAvailableSlots, type AvailableSlotsQuery } from "@/lib/booking/query-slots";
import { submitIncidentReport, type IncidentReportType } from "@/lib/booking/incident-reports";

export type { AvailableSlotsQuery };

/** 예약 UI가 후보 슬롯을 보여주기 위한 조회 — 최종 권위는 confirm_lesson_booking()에 있다. */
export async function listAvailableSlotsForBooking(query: AvailableSlotsQuery): Promise<Date[]> {
  await requireUser();
  return queryAvailableSlots(query);
}

export type CreateLessonBookingParams = {
  childId: string;
  subjectEnrollmentId: string;
  teacherId: string;
  lessonTypeId: string;
  startsAt: Date;
  durationMinutes: number;
};

export async function createLessonBookingForChild(
  params: CreateLessonBookingParams
): Promise<{ reservationId: string; sessionId: string }> {
  const { user, supabase } = await requireUser();
  await assertGuardianOfChild(supabase, user.id, params.childId);
  const admin = createAdminClient();
  await assertActiveTeacherAssignment(admin, params.subjectEnrollmentId, params.teacherId);

  const idempotencyKey = `guardian-booking:${params.childId}:${params.subjectEnrollmentId}:${params.startsAt.toISOString()}`;
  return confirmLessonBooking({ ...params, idempotencyKey });
}

export type CreateWeeklySeriesParams = {
  childId: string;
  subjectEnrollmentId: string;
  teacherId: string;
  lessonTypeId: string;
  firstStartsAt: Date;
  durationMinutes: number;
  occurrences: number;
  seriesTimezone: string;
};

export async function createWeeklyLessonSeriesForChild(
  params: CreateWeeklySeriesParams
): Promise<WeeklySeriesOccurrenceResult[]> {
  const { user, supabase } = await requireUser();
  await assertGuardianOfChild(supabase, user.id, params.childId);
  const admin = createAdminClient();
  await assertActiveTeacherAssignment(admin, params.subjectEnrollmentId, params.teacherId);

  const idempotencyKeyPrefix = `guardian-series:${params.childId}:${params.subjectEnrollmentId}:${params.firstStartsAt.toISOString()}`;
  return createWeeklyLessonSeries({ ...params, idempotencyKeyPrefix, createdBy: user.id });
}

/** R6: 브라우저 감지 timezone 제안 UI가 "적용" 클릭 시 호출 — 자녀 profiles.timezone 갱신. */
export async function updateChildTimezone(childId: string, timezone: string): Promise<void> {
  const { user, supabase } = await requireUser();
  await assertGuardianOfChild(supabase, user.id, childId);
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ timezone }).eq("id", childId);
  if (error) throw new Error(error.message);
}

export async function cancelLessonBookingForChild(params: {
  reservationId: string;
  childId: string;
  reason: string;
}): Promise<void> {
  const { user, supabase } = await requireUser();
  await assertGuardianOfChild(supabase, user.id, params.childId);
  const admin = createAdminClient();
  await assertReservationBelongsToChild(admin, params.reservationId, params.childId);
  return cancelLessonBooking({
    reservationId: params.reservationId,
    cancelledByRole: "student",
    cancelledById: user.id,
    reason: params.reason,
  });
}

export async function reportTeacherIssueForChild(params: {
  childId: string;
  sessionId: string;
  reportType: Extract<IncidentReportType, "teacher_late" | "teacher_no_show_reported">;
  minutesLate?: number;
  notes?: string;
}): Promise<void> {
  const { user, supabase } = await requireUser();
  await assertGuardianOfChild(supabase, user.id, params.childId);
  const admin = createAdminClient();
  await assertSessionBelongsToChild(admin, params.sessionId, params.childId);
  await submitIncidentReport(supabase, params);
}
