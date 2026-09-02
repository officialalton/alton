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
import { computeAvailableSlots, type AvailabilityRule, type AvailabilityException } from "@/lib/booking/slot-search";

async function assertGuardianOfChild(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  guardianId: string,
  childId: string
): Promise<void> {
  const { data: guardianLinks } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", guardianId)
    .eq("role", "guardian");
  const householdIds = (guardianLinks ?? []).map((l) => l.household_id as string);
  if (householdIds.length === 0) {
    throw new Error("보호자 권한이 없습니다.");
  }
  const { data: childLink } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", childId)
    .eq("role", "child")
    .in("household_id", householdIds)
    .maybeSingle();
  if (!childLink) {
    throw new Error("본인 가족 구성원이 아닌 자녀에 대해서는 예약할 수 없습니다.");
  }
}

async function assertActiveTeacherAssignment(
  admin: ReturnType<typeof createAdminClient>,
  subjectEnrollmentId: string,
  teacherId: string
): Promise<void> {
  const { data } = await admin
    .from("teacher_assignments")
    .select("id")
    .eq("subject_enrollment_id", subjectEnrollmentId)
    .eq("teacher_id", teacherId)
    .eq("status", "active")
    .maybeSingle();
  if (!data) {
    throw new Error("이 과목 수강에 현재 배정된 선생님이 아닙니다.");
  }
}

export type AvailableSlotsQuery = {
  subjectEnrollmentId: string;
  teacherId: string;
  durationMinutes: number;
  windowDays?: number; // 기본 56일(8주)
};

/** 예약 UI가 후보 슬롯을 보여주기 위한 조회 — 최종 권위는 confirm_lesson_booking()에 있다. */
export async function listAvailableSlotsForBooking(query: AvailableSlotsQuery): Promise<Date[]> {
  const { user } = await requireUser();
  const admin = createAdminClient();

  const now = new Date();
  const windowDays = query.windowDays ?? 56;

  const [{ data: rulesRows }, { data: exceptionRows }, { data: reservationRows }] = await Promise.all([
    admin
      .from("teacher_availability_rules")
      .select("day_of_week, start_time_local, end_time_local, timezone, effective_from, effective_until")
      .eq("teacher_id", query.teacherId),
    admin
      .from("teacher_availability_exceptions")
      .select("exception_date, kind, start_time_local, end_time_local, timezone")
      .eq("teacher_id", query.teacherId)
      .gte("exception_date", now.toISOString().slice(0, 10)),
    admin
      .from("reservations")
      .select("starts_at, ends_at")
      .eq("owner_profile_id", query.teacherId)
      .in("status", ["holding", "confirmed"])
      .gte("starts_at", now.toISOString()),
  ]);

  const rules: AvailabilityRule[] = (rulesRows ?? []).map((r) => ({
    dayOfWeek: r.day_of_week as number,
    startTimeLocal: r.start_time_local as string,
    endTimeLocal: r.end_time_local as string,
    timezone: r.timezone as string,
    effectiveFrom: r.effective_from as string,
    effectiveUntil: (r.effective_until as string) ?? null,
  }));
  const exceptions: AvailabilityException[] = (exceptionRows ?? []).map((e) => ({
    date: e.exception_date as string,
    kind: e.kind as "blocked" | "available",
    startTimeLocal: (e.start_time_local as string) ?? null,
    endTimeLocal: (e.end_time_local as string) ?? null,
    timezone: e.timezone as string,
  }));
  const existingReservations = (reservationRows ?? []).map((r) => ({
    startsAt: new Date(r.starts_at as string),
    endsAt: new Date(r.ends_at as string),
  }));

  void user; // requireUser()는 로그인 여부만 확인 — 슬롯 조회 자체는 특정 자녀 소유를 요구하지 않는다.

  return computeAvailableSlots({
    rules,
    exceptions,
    existingReservations,
    durationMinutes: query.durationMinutes,
    bufferMinutes: 15,
    windowStart: now,
    windowEnd: new Date(now.getTime() + windowDays * 24 * 60 * 60_000),
    now,
  });
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

export async function cancelLessonBookingForChild(params: {
  reservationId: string;
  childId: string;
  reason: string;
}): Promise<void> {
  const { user, supabase } = await requireUser();
  await assertGuardianOfChild(supabase, user.id, params.childId);
  return cancelLessonBooking({
    reservationId: params.reservationId,
    cancelledByRole: "student",
    cancelledById: user.id,
    reason: params.reason,
  });
}
