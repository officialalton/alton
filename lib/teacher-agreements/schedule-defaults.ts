// Company-level Schedule A values shared by every teacher agreement (one place; per-teacher facts live in
// teacher_agreement_inputs). Owner-confirmed operating terms: paydays on the 5th and 20th (Pacific Time),
// transfer/intermediary/conversion fees borne by the Company, and a 30-day written termination notice.
export const TEACHER_SCHEDULE_DEFAULTS = {
  californiaPayrollPeriodAndPaydays: "Paydays on the 5th and 20th of each month, Pacific Time",
  transferAndConversionFeeAllocation: "Transfer, intermediary, and currency-conversion fees are borne by the Company",
  terminationNoticePeriod: "30 days' written notice",
} as const;

export const TEACHER_APPROVER = { name: "Do Kyung Kim", title: "CEO" } as const;
