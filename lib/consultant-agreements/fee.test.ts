import { describe, expect, it } from "vitest";
import { consultantSemiMonthlyAmount, daysInMonth } from "./fee";

describe("consultantSemiMonthlyAmount", () => {
  it("allocates a full month by calendar day (15/days for the first half, balance for the second)", () => {
    expect(consultantSemiMonthlyAmount(3_000_000, "2026-11")).toEqual({ firstHalf: 1_500_000, secondHalf: 1_500_000, total: 3_000_000, serviceDays: 30, daysInMonth: 30 });
    const dec = consultantSemiMonthlyAmount(3_100_000, "2026-12");
    expect(dec.firstHalf).toBe(1_500_000);
    expect(dec.secondHalf).toBe(1_600_000);
    expect(dec.firstHalf + dec.secondHalf).toBe(3_100_000);
  });
  it("keeps the remainder in the second half so the month always sums exactly", () => {
    const r = consultantSemiMonthlyAmount(1_000_000, "2027-02");
    expect(r.firstHalf).toBe(Math.round((1_000_000 * 15) / 28));
    expect(r.firstHalf + r.secondHalf).toBe(1_000_000);
  });
  it("prorates a start month by calendar days in the service term", () => {
    const r = consultantSemiMonthlyAmount(3_000_000, "2026-11", "2026-11-11");
    expect(r.serviceDays).toBe(20);
    expect(r.total).toBe(2_000_000);
    expect(r.firstHalf).toBe(500_000); // Nov 11–15 = 5 days
    expect(r.secondHalf).toBe(1_500_000);
  });
  it("prorates an end month and handles a term that starts and ends in the same month", () => {
    expect(consultantSemiMonthlyAmount(3_000_000, "2026-11", null, "2026-11-10")).toMatchObject({ serviceDays: 10, total: 1_000_000, firstHalf: 1_000_000, secondHalf: 0 });
    expect(consultantSemiMonthlyAmount(3_000_000, "2026-11", "2026-11-20", "2026-11-25")).toMatchObject({ serviceDays: 6, total: 600_000, firstHalf: 0, secondHalf: 600_000 });
  });
  it("returns zero outside the service term and validates input", () => {
    expect(consultantSemiMonthlyAmount(3_000_000, "2026-10", "2026-11-01").total).toBe(0);
    expect(consultantSemiMonthlyAmount(3_000_000, "2026-12", null, "2026-11-30").total).toBe(0);
    expect(() => consultantSemiMonthlyAmount(1.5, "2026-11")).toThrow();
    expect(daysInMonth("2028-02")).toBe(29);
  });
});
