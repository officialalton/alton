import { describe, expect, it } from "vitest";
import { computeAvailableSlots, type AvailabilityRule } from "./slot-search";

const TZ = "America/Los_Angeles";

function daysFromNow(now: Date, days: number): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60_000);
}

describe("computeAvailableSlots", () => {
  it("규칙이 없으면 빈 배열을 반환한다", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    const result = computeAvailableSlots({
      rules: [],
      exceptions: [],
      existingReservations: [],
      durationMinutes: 120,
      bufferMinutes: 15,
      windowStart: now,
      windowEnd: daysFromNow(now, 56),
      now,
    });
    expect(result).toEqual([]);
  });

  it("24시간 이내 슬롯은 제외하고, 8주 이후 슬롯도 제외한다", () => {
    const now = new Date("2026-10-01T12:00:00Z"); // Thursday
    const rules: AvailabilityRule[] = [
      { dayOfWeek: 4, startTimeLocal: "00:00", endTimeLocal: "23:59", timezone: TZ, effectiveFrom: "2026-01-01", effectiveUntil: null }, // Thursday
    ];
    const result = computeAvailableSlots({
      rules,
      exceptions: [],
      existingReservations: [],
      durationMinutes: 120,
      bufferMinutes: 15,
      windowStart: now,
      windowEnd: daysFromNow(now, 90),
      now,
    });
    const lowerBound = daysFromNow(now, 1).getTime();
    const upperBound = daysFromNow(now, 56).getTime();
    expect(result.every((d) => d.getTime() >= lowerBound)).toBe(true);
    expect(result.every((d) => d.getTime() <= upperBound)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("admin override면 24시간 하한을 건너뛴다(8주 상한은 유지)", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    const rules: AvailabilityRule[] = [
      { dayOfWeek: 4, startTimeLocal: "00:00", endTimeLocal: "23:59", timezone: TZ, effectiveFrom: "2026-01-01", effectiveUntil: null },
    ];
    const result = computeAvailableSlots({
      rules,
      exceptions: [],
      existingReservations: [],
      durationMinutes: 120,
      bufferMinutes: 15,
      windowStart: now,
      windowEnd: daysFromNow(now, 90),
      now,
      adminOverride: true,
    });
    expect(result.some((d) => d.getTime() < daysFromNow(now, 1).getTime() && d.getTime() >= now.getTime())).toBe(true);
  });

  it("blocked 예외(종일)는 그 날짜의 모든 슬롯을 제거한다", () => {
    const now = new Date("2026-10-01T00:00:00Z");
    const rules: AvailabilityRule[] = [
      { dayOfWeek: 5, startTimeLocal: "09:00", endTimeLocal: "17:00", timezone: TZ, effectiveFrom: "2026-01-01", effectiveUntil: null }, // Friday
    ];
    const withoutException = computeAvailableSlots({
      rules, exceptions: [], existingReservations: [], durationMinutes: 120, bufferMinutes: 15,
      windowStart: now, windowEnd: daysFromNow(now, 14), now,
    });
    expect(withoutException.length).toBeGreaterThan(0);
    const blockedDate = withoutException[0];
    const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(blockedDate); // yyyy-mm-dd

    const withException = computeAvailableSlots({
      rules,
      exceptions: [{ date: dateStr, kind: "blocked", startTimeLocal: null, endTimeLocal: null, timezone: TZ }],
      existingReservations: [], durationMinutes: 120, bufferMinutes: 15,
      windowStart: now, windowEnd: daysFromNow(now, 14), now,
    });
    expect(withException.some((d) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d) === dateStr)).toBe(false);
  });

  it("available 예외는 규칙이 없는 날짜에도 슬롯을 연다", () => {
    const now = new Date("2026-10-01T00:00:00Z");
    const rules: AvailabilityRule[] = []; // 반복 규칙 자체가 없음
    // available 예외만으로는 primaryTimezone을 못 정하므로(rules[0] 참조), 최소 규칙 하나를
    // 다른 요일에 넣어 timezone 앵커를 제공한다.
    const anchorRule: AvailabilityRule = {
      dayOfWeek: 1, startTimeLocal: "09:00", endTimeLocal: "10:00", timezone: TZ, effectiveFrom: "2026-01-01", effectiveUntil: null,
    };
    const target = daysFromNow(now, 5);
    const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(target);

    const result = computeAvailableSlots({
      rules: [anchorRule],
      exceptions: [{ date: dateStr, kind: "available", startTimeLocal: "13:00", endTimeLocal: "15:00", timezone: TZ }],
      existingReservations: [], durationMinutes: 120, bufferMinutes: 15,
      windowStart: now, windowEnd: daysFromNow(now, 30), now,
    });
    expect(result.some((d) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d) === dateStr)).toBe(true);
  });

  it("기존 예약 + 버퍼(15분)와 겹치는 슬롯은 제외한다", () => {
    const now = new Date("2026-10-01T00:00:00Z");
    const rules: AvailabilityRule[] = [
      { dayOfWeek: 5, startTimeLocal: "09:00", endTimeLocal: "17:00", timezone: TZ, effectiveFrom: "2026-01-01", effectiveUntil: null },
    ];
    const noConflict = computeAvailableSlots({
      rules, exceptions: [], existingReservations: [], durationMinutes: 120, bufferMinutes: 15,
      windowStart: now, windowEnd: daysFromNow(now, 14), now, stepMinutes: 60,
    });
    expect(noConflict.length).toBeGreaterThan(0);
    const target = noConflict[2] ?? noConflict[0];

    const withConflict = computeAvailableSlots({
      rules,
      exceptions: [],
      existingReservations: [{ startsAt: target, endsAt: new Date(target.getTime() + 120 * 60_000) }],
      durationMinutes: 120, bufferMinutes: 15,
      windowStart: now, windowEnd: daysFromNow(now, 14), now, stepMinutes: 60,
    });
    expect(withConflict.some((d) => d.getTime() === target.getTime())).toBe(false);
    // buffer 15min: 슬롯 시작 10분 전에 걸치는 슬롯도 막혀야 함
    const tenMinBefore = new Date(target.getTime() - 10 * 60_000);
    expect(withConflict.some((d) => d.getTime() === tenMinBefore.getTime())).toBe(false);
  });

  it("DST 전환 경계(America/Los_Angeles 2026년 3월 8일 spring-forward)에서도 로컬 09:00 슬롯을 정확히 UTC로 변환한다", () => {
    // 2026-03-08은 미국 서머타임 시작일(2시->3시로 건너뜀). 그 주의 금요일(3/13)과
    // 전주 금요일(3/6, 서머타임 전)의 UTC 오프셋이 실제로 다른지(PST -08:00 vs PDT -07:00)
    // Intl 기반 zonedTimeToUtc가 정확히 반영하는지 확인한다.
    const now = new Date("2026-03-01T00:00:00Z");
    const rules: AvailabilityRule[] = [
      { dayOfWeek: 5, startTimeLocal: "09:00", endTimeLocal: "09:30", timezone: TZ, effectiveFrom: "2026-01-01", effectiveUntil: null },
    ];
    const result = computeAvailableSlots({
      rules, exceptions: [], existingReservations: [], durationMinutes: 30, bufferMinutes: 0,
      windowStart: now, windowEnd: daysFromNow(now, 20), now, stepMinutes: 30,
    });
    const beforeDst = result.find((d) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d) === "2026-03-06");
    const afterDst = result.find((d) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d) === "2026-03-13");
    expect(beforeDst).toBeDefined();
    expect(afterDst).toBeDefined();
    // PST(UTC-8) 09:00 = 17:00 UTC, PDT(UTC-7) 09:00 = 16:00 UTC — 1시간 오프셋 차이가
    // 실제로 반영돼야 한다(고정 오프셋이었다면 둘 다 같은 UTC 시각이 됐을 것).
    expect(beforeDst!.getUTCHours()).toBe(17);
    expect(afterDst!.getUTCHours()).toBe(16);
  });
});
