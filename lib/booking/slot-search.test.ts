import { describe, expect, it } from "vitest";
import { computeAvailableSlots, computeOpenWindowsForDate, type AvailabilityRule, type AvailabilityException } from "./slot-search";

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

// 2026-09-06 — 선생님 가용시간 월간 뷰/일간 타임라인용 "이 날짜의 최종 오픈 시간" 계산.
// 제품 오너 요구사항: 반복 규칙으로 열린 특정 요일의 일부 시간대만 개별로 휴무 지정할 수
// 있어야 한다.
describe("computeOpenWindowsForDate", () => {
  const rules: AvailabilityRule[] = [
    { dayOfWeek: 3, startTimeLocal: "09:00", endTimeLocal: "17:00", timezone: TZ, effectiveFrom: "2026-01-01", effectiveUntil: null },
  ];

  it("예외가 없으면 반복 규칙 구간을 그대로 반환한다", () => {
    const result = computeOpenWindowsForDate("2026-10-07", 3, rules, []);
    expect(result).toEqual([{ startTimeLocal: "09:00", endTimeLocal: "17:00" }]);
  });

  it("다른 요일이면 빈 배열을 반환한다", () => {
    const result = computeOpenWindowsForDate("2026-10-08", 4, rules, []); // 목요일
    expect(result).toEqual([]);
  });

  it("종일 휴무 예외가 있으면 빈 배열을 반환한다", () => {
    const exceptions: AvailabilityException[] = [
      { date: "2026-10-07", kind: "blocked", startTimeLocal: null, endTimeLocal: null, timezone: TZ },
    ];
    const result = computeOpenWindowsForDate("2026-10-07", 3, rules, exceptions);
    expect(result).toEqual([]);
  });

  it("부분 시간 휴무 예외는 그 구간만 빼고 나머지는 그대로 열려 있다", () => {
    const exceptions: AvailabilityException[] = [
      { date: "2026-10-07", kind: "blocked", startTimeLocal: "12:00", endTimeLocal: "13:00", timezone: TZ },
    ];
    const result = computeOpenWindowsForDate("2026-10-07", 3, rules, exceptions);
    expect(result).toEqual([
      { startTimeLocal: "09:00", endTimeLocal: "12:00" },
      { startTimeLocal: "13:00", endTimeLocal: "17:00" },
    ]);
  });

  it("부분 시간 휴무 예외가 구간 시작에 걸치면 뒤쪽만 남는다", () => {
    const exceptions: AvailabilityException[] = [
      { date: "2026-10-07", kind: "blocked", startTimeLocal: "08:00", endTimeLocal: "10:00", timezone: TZ },
    ];
    const result = computeOpenWindowsForDate("2026-10-07", 3, rules, exceptions);
    expect(result).toEqual([{ startTimeLocal: "10:00", endTimeLocal: "17:00" }]);
  });

  it("부분 시간 임시 오픈 예외는 반복 규칙이 없는 요일에도 새 구간을 추가한다", () => {
    const exceptions: AvailabilityException[] = [
      { date: "2026-10-08", kind: "available", startTimeLocal: "18:00", endTimeLocal: "20:00", timezone: TZ },
    ];
    const result = computeOpenWindowsForDate("2026-10-08", 4, rules, exceptions); // 목요일, 규칙 없음
    expect(result).toEqual([{ startTimeLocal: "18:00", endTimeLocal: "20:00" }]);
  });

  it("종일 임시 오픈 예외는 00:00~24:00(하루 전체)를 연다", () => {
    const exceptions: AvailabilityException[] = [
      { date: "2026-10-08", kind: "available", startTimeLocal: null, endTimeLocal: null, timezone: TZ },
    ];
    const result = computeOpenWindowsForDate("2026-10-08", 4, [], exceptions);
    expect(result).toEqual([{ startTimeLocal: "00:00", endTimeLocal: "24:00" }]);
  });

  it("여러 부분 휴무가 하나의 구간을 여러 조각으로 쪼갤 수 있다", () => {
    const exceptions: AvailabilityException[] = [
      { date: "2026-10-07", kind: "blocked", startTimeLocal: "10:00", endTimeLocal: "11:00", timezone: TZ },
      { date: "2026-10-07", kind: "blocked", startTimeLocal: "14:00", endTimeLocal: "15:00", timezone: TZ },
    ];
    const result = computeOpenWindowsForDate("2026-10-07", 3, rules, exceptions);
    expect(result).toEqual([
      { startTimeLocal: "09:00", endTimeLocal: "10:00" },
      { startTimeLocal: "11:00", endTimeLocal: "14:00" },
      { startTimeLocal: "15:00", endTimeLocal: "17:00" },
    ]);
  });

  it("effective_from/effective_until 범위 밖 날짜는 규칙을 적용하지 않는다", () => {
    const scopedRules: AvailabilityRule[] = [
      { dayOfWeek: 3, startTimeLocal: "09:00", endTimeLocal: "17:00", timezone: TZ, effectiveFrom: "2026-11-01", effectiveUntil: null },
    ];
    const result = computeOpenWindowsForDate("2026-10-07", 3, scopedRules, []);
    expect(result).toEqual([]);
  });
});
