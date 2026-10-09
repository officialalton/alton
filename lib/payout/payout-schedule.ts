// 교사·컨설턴트 정산 일정 — 월 2회(2026-10-06 오너 확정).
//
// 근무(수업) 1~15일분은 같은 달 26일까지, 16일~말일분은 다음 달 10일까지 지급한다(2026-10-06 오너 변경: 종전 20일/5일 → 26일/10일; 5·20일은 폐기)
// (California semimonthly 기준). 기간·지급일 판정은 모두
// **회사 시간대(COMPANY_TIME_ZONE = America/Los_Angeles) 달력 날짜**다(오너 확정).
// 이전의 UTC 기준(reservations.starts_at::date)은 폐기됐고, DB 함수도 같은
// 시간대로 환산한다(20262100000046). 크론은 UTC로 도니 작업 안에서 LA 날짜를 계산한다.
//
// 지급일 보정(2026-10-06 오너 위임 확정): 명목 10일·26일이 주말 또는 미국 연방 은행 휴일이면
// **직전 영업일**에 지급한다(shiftToBusinessDay). 계약서에는 명목 날짜와 이 보정 문장이 함께 들어간다.
// SQL의 payout_business_day_on_or_before()와 같은 규칙이다.

/** 정산·지급 판정의 단일 시간대. SQL 함수의 'America/Los_Angeles' 리터럴과 같아야 한다. */
export const COMPANY_TIME_ZONE = "America/Los_Angeles";

import { isUsBankHoliday } from "./us-bank-holidays";

export const PAYOUT_DAY_FIRST_HALF = 26; // 1~15일분 → 같은 달 26일까지(지급 기한)
export const PAYOUT_DAY_SECOND_HALF = 10; // 16일~말일분 → 다음 달 10일까지(지급 기한)
export const PAYOUT_DAYS_OF_MONTH = [PAYOUT_DAY_SECOND_HALF, PAYOUT_DAY_FIRST_HALF] as const;

export type PayoutPeriodRange = { periodStart: string; periodEnd: string };
export type PayoutPeriodInfo = PayoutPeriodRange & {
  /** 'YYYY-MM-H1' | 'YYYY-MM-H2' */
  periodKey: string;
  /** 실제 지급일(명목일을 직전 영업일로 보정한 값) 'YYYY-MM-DD' */
  payoutDate: string;
  /** 명목 지급일(10일·26일) */
  nominalPayoutDate: string;
};

function addDays(dateOnly: string, delta: number): string {
  const p = parseDateOnly(dateOnly) as { y: number; m: number; d: number };
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + delta));
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** 주말·미국 연방 은행 휴일이면 직전 영업일로 당긴다. 잘못된 입력은 그대로 돌려준다. */
export function shiftToBusinessDay(dateOnly: string): string {
  if (!parseDateOnly(dateOnly)) return dateOnly;
  let cur = dateOnly;
  for (let i = 0; i < 10; i++) {
    const p = parseDateOnly(cur) as { y: number; m: number; d: number };
    const dow = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
    if (dow !== 0 && dow !== 6 && !isUsBankHoliday(cur)) return cur;
    cur = addDays(cur, -1);
  }
  return cur;
}

/** 송금 요청일 = 지급 기한 − N영업일. SQL payout_settings.transfer_lead_business_days 기본값과 같아야 한다(통합 테스트가 점검). */
export const PAYOUT_TRANSFER_LEAD_BUSINESS_DAYS_DEFAULT = 3;

function isBusinessDay(dateOnly: string): boolean {
  return shiftToBusinessDay(dateOnly) === dateOnly;
}

/** 기준일에서 영업일 n개 앞의 날짜(주말·미국 연방 은행 휴일 제외). */
export function businessDaysBefore(dateOnly: string, n: number): string {
  if (!parseDateOnly(dateOnly)) return dateOnly;
  let cur = dateOnly;
  let counted = 0;
  while (counted < n) {
    cur = addDays(cur, -1);
    if (isBusinessDay(cur)) counted += 1;
  }
  return cur;
}

/** 지급 기한(입금 완료 기한) → 송금 요청일. 기한이 휴일이면 먼저 직전 영업일로 보정한 뒤 센다. */
export function transferRequestDate(deadline: string, lead: number = PAYOUT_TRANSFER_LEAD_BUSINESS_DAYS_DEFAULT): string {
  return businessDaysBefore(shiftToBusinessDay(deadline), lead);
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m1: number, d: number) => `${y}-${pad(m1)}-${pad(d)}`;
const lastDayOf = (y: number, m1: number) => new Date(Date.UTC(y, m1, 0)).getUTCDate();

/** 시각(Date 또는 ISO 문자열)을 회사 시간대 달력 날짜 'YYYY-MM-DD'로. 시각 없는 'YYYY-MM-DD'는 그대로 돌려준다. */
export function companyDateOf(instant: Date | string): string | null {
  if (typeof instant === "string" && /^\d{4}-\d{2}-\d{2}$/.test(instant)) return instant;
  const d = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: COMPANY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((x) => x.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function parseDateOnly(dateOnly: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOnly);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (m < 1 || m > 12 || d < 1 || d > lastDayOf(y, m)) return null;
  return { y, m, d };
}

function nextMonth(y: number, m: number): { y: number; m: number } {
  return m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
}

/** 'YYYY-MM-DD'(회사 달력 날짜) 또는 ISO 시각(LA 날짜로 환산)이 속한 정산 기간. 잘못된 입력은 null. */
export function payoutPeriodOfDate(dateOrIso: string): PayoutPeriodInfo | null {
  const local = companyDateOf(dateOrIso);
  const p = local ? parseDateOnly(local) : null;
  if (!p) return null;
  if (p.d <= 15) {
    return {
      periodKey: `${p.y}-${pad(p.m)}-H1`,
      periodStart: ymd(p.y, p.m, 1),
      periodEnd: ymd(p.y, p.m, 15),
      payoutDate: shiftToBusinessDay(ymd(p.y, p.m, PAYOUT_DAY_FIRST_HALF)),
      nominalPayoutDate: ymd(p.y, p.m, PAYOUT_DAY_FIRST_HALF),
    };
  }
  const n = nextMonth(p.y, p.m);
  return {
    periodKey: `${p.y}-${pad(p.m)}-H2`,
    periodStart: ymd(p.y, p.m, 16),
    periodEnd: ymd(p.y, p.m, lastDayOf(p.y, p.m)),
    payoutDate: shiftToBusinessDay(ymd(n.y, n.m, PAYOUT_DAY_SECOND_HALF)),
    nominalPayoutDate: ymd(n.y, n.m, PAYOUT_DAY_SECOND_HALF),
  };
}

/** 기간 종료일 기준 명목 지급일(10일·26일, 보정 전). */
export function nominalPayoutDateForPeriodEnd(periodEnd: string): string | null {
  const p = parseDateOnly(periodEnd);
  if (!p) return null;
  if (p.d <= 15) return ymd(p.y, p.m, PAYOUT_DAY_FIRST_HALF);
  const n = nextMonth(p.y, p.m);
  return ymd(n.y, n.m, PAYOUT_DAY_SECOND_HALF);
}

/** 기간 종료일 기준 실제 지급일(SQL payout_nominal_date와 동일 — 직전 영업일 보정 포함). */
export function payoutDateForPeriodEnd(periodEnd: string): string | null {
  const nominal = nominalPayoutDateForPeriodEnd(periodEnd);
  return nominal ? shiftToBusinessDay(nominal) : null;
}

/** 주어진 시각(기본: 지금)의 회사(LA) 날짜 기준으로 "직전에 끝난" 정산 기간. 16일 이후면 1~15일, 그 전이면 지난달 16일~말일. */
export function previousPayoutPeriod(now: Date = new Date()): PayoutPeriodRange {
  const local = parseDateOnly(companyDateOf(now) as string) as { y: number; m: number; d: number };
  const { y, m } = local;
  if (local.d >= 16) {
    return { periodStart: ymd(y, m, 1), periodEnd: ymd(y, m, 15) };
  }
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  return { periodStart: ymd(prevY, prevM, 16), periodEnd: ymd(prevY, prevM, lastDayOf(prevY, prevM)) };
}

/** 'YYYY-MM-DD' 명목 지급일(10일·26일) → 한 번에 지급되는 정산 기간. */
export function periodForPayoutDate(payoutDate: string): PayoutPeriodRange | null {
  const p = parseDateOnly(payoutDate);
  if (!p) return null;
  if (p.d === PAYOUT_DAY_FIRST_HALF) return { periodStart: ymd(p.y, p.m, 1), periodEnd: ymd(p.y, p.m, 15) };
  if (p.d === PAYOUT_DAY_SECOND_HALF) {
    const prevY = p.m === 1 ? p.y - 1 : p.y;
    const prevM = p.m === 1 ? 12 : p.m - 1;
    return { periodStart: ymd(prevY, prevM, 16), periodEnd: ymd(prevY, prevM, lastDayOf(prevY, prevM)) };
  }
  return null;
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 날짜만 있는 값('YYYY-MM-DD')을 시간대 변환 없이 "Oct 20" 형태로(연도 선택). */
export function formatDateOnlyEn(dateOnly: string, withYear = false): string {
  const p = parseDateOnly(dateOnly);
  if (!p) return dateOnly;
  return `${MONTH_ABBR[p.m - 1]} ${p.d}${withYear ? `, ${p.y}` : ""}`;
}

export function weekdayEn(dateOnly: string): string {
  const p = parseDateOnly(dateOnly);
  if (!p) return "";
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()];
}

/** 정산 기간 라벨. 표준 반월 기간이면 "Oct 1–15, 2026", 아니면 "Oct 1 – Nov 3, 2026" 형태. */
export function formatPeriodLabelEn(periodStart: string, periodEnd: string): string {
  const s = parseDateOnly(periodStart);
  const e = parseDateOnly(periodEnd);
  if (!s || !e) return `${periodStart} – ${periodEnd}`;
  if (s.y === e.y && s.m === e.m) return `${MONTH_ABBR[s.m - 1]} ${s.d}–${e.d}, ${s.y}`;
  return `${formatDateOnlyEn(periodStart)} – ${formatDateOnlyEn(periodEnd, true)}`;
}

/**
 * 정산 기간 한 줄 라벨(지급 상태 반영). 지급 완료가 아니고 기한(회사 시간대 날짜)이 이미 지났으면 과거 날짜를 "paid by"로 두지 않고
 * "Was due Sep 25, 2026 — processing"으로 보여 준다. now는 테스트에서 고정할 수 있다.
 */
export function formatPeriodStatusEn(periodStart: string, periodEnd: string, paid: boolean, now: Date = new Date()): { label: string; overdue: boolean } {
  const deadline = payoutDateForPeriodEnd(periodEnd);
  const today = companyDateOf(now);
  if (!paid && deadline && today && deadline < today) {
    return { label: `${formatPeriodLabelEn(periodStart, periodEnd)} · Was due ${formatDateOnlyEn(deadline, true)} — processing`, overdue: true };
  }
  return { label: formatPeriodWithPayoutEn(periodStart, periodEnd), overdue: false };
}

/** "Oct 1–15, 2026 → paid Oct 20". 지급일은 명목 규칙(10일·26일)에서 계산한다. */
export function formatPeriodWithPayoutEn(periodStart: string, periodEnd: string, payoutDate?: string | null): string {
  const pay = payoutDate ?? payoutDateForPeriodEnd(periodEnd);
  const label = formatPeriodLabelEn(periodStart, periodEnd);
  const nominal = nominalPayoutDateForPeriodEnd(periodEnd);
  // 보정으로 날짜가 당겨진 경우에는 요일을 함께 보여 준다("paid Oct 16 (Fri)").
  const shifted = pay && nominal && pay !== nominal;
  return pay ? `${label} → paid by ${formatDateOnlyEn(pay)}${shifted ? ` (${weekdayEn(pay)})` : ""}` : label;
}

/**
 * 크론(UTC) 안에서 호출: 이 시각의 LA 날짜가 마감 창(1~3일·16~18일)이면 true.
 * 마감일(1일·16일)에 크론이 한 번 빠져도 다음 날 따라잡도록 3일 창을 둔다. 마감은 멱등이다
 * (DB의 close_payout_period가 이미 묶인 항목을 다시 담지 않는다).
 */
export function isPeriodCloseDay(now: Date = new Date()): boolean {
  const d = Number((companyDateOf(now) ?? "").slice(8, 10));
  return (d >= 1 && d <= 3) || (d >= 16 && d <= 18);
}

/** 크론(UTC) 안에서 호출: 이 시각의 LA 날짜가 (보정된) 지급일이면 true. 크론은 매일 17:00 UTC에 돈다. */
export function isPayoutDay(now: Date = new Date()): boolean {
  const today = companyDateOf(now);
  const p = today ? parseDateOnly(today) : null;
  if (!today || !p) return false;
  return [PAYOUT_DAY_SECOND_HALF, PAYOUT_DAY_FIRST_HALF].some((d) => shiftToBusinessDay(ymd(p.y, p.m, d)) === today);
}
