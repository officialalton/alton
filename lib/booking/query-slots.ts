import { createAdminClient } from "@/lib/supabase-admin";
import { computeAvailableSlots, type AvailabilityRule, type AvailabilityException } from "@/lib/booking/slot-search";

// R6 6/N — 특정 선생님의 예약 가능 슬롯 후보를 DB에서 조회해 계산한다. role-agnostic —
// 학생/보호자/관리자 화면이 전부 이 함수를 그대로 재사용한다. 최종 권위는 항상
// confirm_lesson_booking()에 있다(위 slot-search.ts 주석 참고).

export type AvailableSlotsQuery = {
  teacherId: string;
  durationMinutes: number;
  windowDays?: number; // 기본 56일(8주)
  adminOverride?: boolean;
};

export async function listAvailableSlotsForBooking(query: AvailableSlotsQuery): Promise<Date[]> {
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

  return computeAvailableSlots({
    rules,
    exceptions,
    existingReservations,
    durationMinutes: query.durationMinutes,
    bufferMinutes: 15,
    windowStart: now,
    windowEnd: new Date(now.getTime() + windowDays * 24 * 60 * 60_000),
    now,
    adminOverride: query.adminOverride ?? false,
  });
}
