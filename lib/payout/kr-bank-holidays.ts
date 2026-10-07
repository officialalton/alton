// 한국 은행 휴일 — KRW 국제송금 일정용(2026-10-07). SQL payout_kr_bank_holidays / payout_kr_calendar_years와 같은 값이어야 한다
// (통합 테스트가 동기화를 점검). 검증된 연도 밖의 날짜는 unverified를 돌려주고, 일정 계산 결과에 unverified_calendar 플래그가 붙는다.
// 2026년 값은 초안이다 — 공식 월력요항·은행 휴무와 대조하기 전까지 운영 체크리스트의 확인 항목이다.
import { isUsBankHoliday } from "./us-bank-holidays";

export const KR_BANK_HOLIDAYS: Readonly<Record<string, string>> = {
  "2026-01-01": "New Year's Day",
  "2026-02-16": "Seollal holiday",
  "2026-02-17": "Seollal",
  "2026-02-18": "Seollal holiday",
  "2026-03-02": "Independence Movement Day (substitute)",
  "2026-05-05": "Children's Day",
  "2026-05-25": "Buddha's Birthday (substitute)",
  "2026-06-03": "Local election day",
  "2026-08-17": "Liberation Day (substitute)",
  "2026-09-24": "Chuseok holiday",
  "2026-09-25": "Chuseok",
  "2026-09-26": "Chuseok holiday",
  "2026-10-05": "National Foundation Day (substitute)",
  "2026-10-09": "Hangul Day",
  "2026-12-25": "Christmas Day",
  "2026-12-31": "Year-end bank closure",
};
export const KR_CALENDAR_VERIFIED_YEARS: readonly number[] = [2026];

/** KRW 송금 요청일 기본 선행 영업일(한·미 공통). 첫 지급 실측 뒤 조정. SQL payout_settings.transfer_lead_business_days_krw 기본값과 같다. */
export const PAYOUT_TRANSFER_LEAD_BUSINESS_DAYS_KRW_DEFAULT = 5;

function parse(dateOnly: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return { y, m, d };
}
function addDays(dateOnly: string, delta: number): string {
  const { y, m, d } = parse(dateOnly);
  const t = new Date(Date.UTC(y, m - 1, d + delta));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}
function isWeekend(dateOnly: string): boolean {
  const { y, m, d } = parse(dateOnly);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 || dow === 6;
}

export function isKrBankHoliday(dateOnly: string): boolean {
  return dateOnly in KR_BANK_HOLIDAYS;
}
export function isKrCalendarVerified(dateOnly: string): boolean {
  return KR_CALENDAR_VERIFIED_YEARS.includes(parse(dateOnly).y);
}
/** 미국·한국 은행이 모두 영업하는 날. */
export function isJointBusinessDay(dateOnly: string): boolean {
  return !isWeekend(dateOnly) && !isUsBankHoliday(dateOnly) && !isKrBankHoliday(dateOnly);
}
export function jointBusinessDayOnOrBefore(dateOnly: string): string {
  let cur = dateOnly;
  for (let i = 0; i < 20 && !isJointBusinessDay(cur); i++) cur = addDays(cur, -1);
  return cur;
}
/** KRW 송금 예정일: 도착 목표일(기한 이전 한·미 공통 영업일) − lead 한·미 공통 영업일. */
export function krwTransferDate(deadline: string, lead: number = PAYOUT_TRANSFER_LEAD_BUSINESS_DAYS_KRW_DEFAULT): { date: string; unverifiedCalendar: boolean } {
  let cur = jointBusinessDayOnOrBefore(deadline);
  let counted = 0;
  while (counted < lead) {
    cur = addDays(cur, -1);
    if (isJointBusinessDay(cur)) counted += 1;
  }
  return { date: cur, unverifiedCalendar: !isKrCalendarVerified(deadline) };
}
