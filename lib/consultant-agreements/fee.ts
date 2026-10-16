/**
 * Consultant monthly fee allocation as written in the consultant agreement (Section 3): the fee is allocated by calendar
 * day; the 1st–15th portion is fee × 15 / days-in-month and the balance is the 16th–end portion; a start or end month
 * is prorated by service days / days-in-month. Amounts are minor units (KRW won, USD cents), so rounding to an integer
 * follows the currency's minor unit and any remainder lands in the second half ("reconciled in the final payment").
 * Pure helper — NOT wired into settlement (consultant_payout_periods are still entered by hand).
 */
export type SemiMonthlyAmount = { firstHalf: number; secondHalf: number; total: number; serviceDays: number; daysInMonth: number };

export function daysInMonth(month: string): number {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw new Error(`Invalid month: ${month}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
}

/** `month` is YYYY-MM; `start`/`end` are inclusive YYYY-MM-DD service-term bounds (optional). */
export function consultantSemiMonthlyAmount(monthlyFeeMinor: number, month: string, start?: string | null, end?: string | null): SemiMonthlyAmount {
  if (!Number.isInteger(monthlyFeeMinor) || monthlyFeeMinor < 0) throw new Error("monthlyFeeMinor must be a non-negative integer");
  const dim = daysInMonth(month);
  const first = `${month}-01`;
  const last = `${month}-${String(dim).padStart(2, "0")}`;
  const from = start && start > first ? start : first;
  const to = end && end < last ? end : last;
  const day = (iso: string) => Number(iso.slice(8, 10));
  if (from > to || from.slice(0, 7) !== month || to.slice(0, 7) !== month) return { firstHalf: 0, secondHalf: 0, total: 0, serviceDays: 0, daysInMonth: dim };
  const serviceDays = day(to) - day(from) + 1;
  const firstHalfDays = Math.max(0, Math.min(day(to), 15) - day(from) + 1);
  if (serviceDays === dim) {
    const firstHalf = Math.round((monthlyFeeMinor * 15) / dim);
    return { firstHalf, secondHalf: monthlyFeeMinor - firstHalf, total: monthlyFeeMinor, serviceDays, daysInMonth: dim };
  }
  const total = Math.round((monthlyFeeMinor * serviceDays) / dim);
  const firstHalf = Math.min(total, Math.round((monthlyFeeMinor * firstHalfDays) / dim));
  return { firstHalf, secondHalf: total - firstHalf, total, serviceDays, daysInMonth: dim };
}
