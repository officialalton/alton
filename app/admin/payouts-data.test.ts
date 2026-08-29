import { describe, expect, it, vi } from "vitest";
import {
  computePayoutAmounts,
  loadPayouts,
  previousMonthRange,
} from "./payouts-data";

describe("previousMonthRange", () => {
  it("주어진 날짜 기준 전월 1일~말일을 반환한다", () => {
    const result = previousMonthRange(new Date("2026-09-15T00:00:00Z"));
    expect(result).toEqual({ periodStart: "2026-08-01", periodEnd: "2026-08-31" });
  });

  it("1월이면 전년도 12월을 반환한다", () => {
    const result = previousMonthRange(new Date("2026-01-10T00:00:00Z"));
    expect(result).toEqual({ periodStart: "2025-12-01", periodEnd: "2025-12-31" });
  });
});

describe("computePayoutAmounts", () => {
  it("시급이 있는 선생님만 완료 세션 시간을 합산해 금액을 계산한다", async () => {
    const teachers = [
      { id: "t1", hourly_rate_krw: 30000, profile: { name: "박서연" } },
      { id: "t2", hourly_rate_krw: null, profile: { name: "이도현" } },
    ];
    const sessions = [
      { duration_minutes: 60, enrollment: { teacher_id: "t1" } },
      { duration_minutes: 90, enrollment: { teacher_id: "t1" } },
      { duration_minutes: 60, enrollment: { teacher_id: "t2" } },
    ];
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "teachers") {
          return { select: () => Promise.resolve({ data: teachers }) };
        }
        if (table === "sessions") {
          return {
            select: () => ({
              eq: () => ({
                gte: () => ({ lte: () => Promise.resolve({ data: sessions }) }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const result = await computePayoutAmounts(supabase as never, {
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
    });

    expect(result.amounts).toEqual([
      { teacherId: "t1", teacherName: "박서연", amountKrw: 75000, totalMinutes: 150 },
    ]);
    expect(result.skipped).toEqual([{ teacherId: "t2", teacherName: "이도현" }]);
  });
});

describe("loadPayouts", () => {
  it("teacher_payouts를 선생님 이름과 함께 반환한다", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "teacher_payouts") {
          return {
            select: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "p1",
                      teacher_id: "t1",
                      amount_krw: 75000,
                      period_start: "2026-08-01",
                      period_end: "2026-08-31",
                      status: "pending",
                      paid_at: null,
                    },
                  ],
                }),
            }),
          };
        }
        if (table === "profiles") {
          return {
            select: () => ({ in: () => Promise.resolve({ data: [{ id: "t1", name: "박서연" }] }) }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const result = await loadPayouts(supabase as never);
    expect(result).toEqual([
      {
        id: "p1",
        teacherId: "t1",
        teacherName: "박서연",
        amountKrw: 75000,
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
        status: "pending",
        paidAt: null,
      },
    ]);
  });
});
