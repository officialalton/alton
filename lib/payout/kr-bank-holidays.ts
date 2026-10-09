// 한국 은행 휴일 — KRW 국제송금 일정용(2026-10-07). SQL payout_kr_bank_holidays / payout_kr_calendar_years와 같은 값이어야 한다
// (통합 테스트가 동기화를 점검). 검증된 연도 밖의 날짜는 unverified를 돌려주고, 일정 계산 결과에 unverified_calendar 플래그가 붙는다.
// 출처·검증일·임시공휴일 추가 절차: docs/2026-10-07-kr-bank-holidays.md (2026·2027 = 공식 월력요항 대조, 2028~2030 = 산출값).
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
  "2027-01-01": "New Year's Day",
  "2027-02-06": "Seollal holiday",
  "2027-02-07": "Seollal",
  "2027-02-08": "Seollal holiday",
  "2027-02-09": "Seollal (substitute)",
  "2027-03-01": "Independence Movement Day",
  "2027-05-01": "Labor Day",
  "2027-05-03": "Labor Day (substitute)",
  "2027-05-05": "Children's Day",
  "2027-05-13": "Buddha's Birthday",
  "2027-06-06": "Memorial Day",
  "2027-07-17": "Constitution Day",
  "2027-07-19": "Constitution Day (substitute)",
  "2027-08-15": "Liberation Day",
  "2027-08-16": "Liberation Day (substitute)",
  "2027-09-14": "Chuseok holiday",
  "2027-09-15": "Chuseok",
  "2027-09-16": "Chuseok holiday",
  "2027-10-03": "National Foundation Day",
  "2027-10-04": "National Foundation Day (substitute)",
  "2027-10-09": "Hangul Day",
  "2027-10-11": "Hangul Day (substitute)",
  "2027-12-25": "Christmas Day",
  "2027-12-27": "Christmas Day (substitute)",
  "2027-12-31": "Year-end bank closure",
  "2028-01-01": "New Year's Day",
  "2028-01-26": "Seollal holiday",
  "2028-01-27": "Seollal",
  "2028-01-28": "Seollal holiday",
  "2028-03-01": "Independence Movement Day",
  "2028-05-01": "Labor Day",
  "2028-05-02": "Buddha's Birthday",
  "2028-05-05": "Children's Day",
  "2028-06-06": "Memorial Day",
  "2028-07-17": "Constitution Day",
  "2028-08-15": "Liberation Day",
  "2028-10-02": "Chuseok holiday",
  "2028-10-03": "Chuseok / National Foundation Day",
  "2028-10-04": "Chuseok holiday",
  "2028-10-05": "Chuseok (substitute)",
  "2028-10-09": "Hangul Day",
  "2028-12-25": "Christmas Day",
  "2028-12-31": "Year-end bank closure",
  "2029-01-01": "New Year's Day",
  "2029-02-12": "Seollal holiday",
  "2029-02-13": "Seollal",
  "2029-02-14": "Seollal holiday",
  "2029-03-01": "Independence Movement Day",
  "2029-05-01": "Labor Day",
  "2029-05-05": "Children's Day",
  "2029-05-07": "Children's Day (substitute)",
  "2029-05-20": "Buddha's Birthday",
  "2029-05-21": "Buddha's Birthday (substitute)",
  "2029-06-06": "Memorial Day",
  "2029-07-17": "Constitution Day",
  "2029-08-15": "Liberation Day",
  "2029-09-21": "Chuseok holiday",
  "2029-09-22": "Chuseok",
  "2029-09-23": "Chuseok holiday",
  "2029-09-24": "Chuseok (substitute)",
  "2029-10-03": "National Foundation Day",
  "2029-10-09": "Hangul Day",
  "2029-12-25": "Christmas Day",
  "2029-12-31": "Year-end bank closure",
  "2030-01-01": "New Year's Day",
  "2030-02-02": "Seollal holiday",
  "2030-02-03": "Seollal",
  "2030-02-04": "Seollal holiday",
  "2030-02-05": "Seollal (substitute)",
  "2030-03-01": "Independence Movement Day",
  "2030-05-01": "Labor Day",
  "2030-05-05": "Children's Day",
  "2030-05-06": "Children's Day (substitute)",
  "2030-05-09": "Buddha's Birthday",
  "2030-06-06": "Memorial Day",
  "2030-07-17": "Constitution Day",
  "2030-08-15": "Liberation Day",
  "2030-09-11": "Chuseok holiday",
  "2030-09-12": "Chuseok",
  "2030-09-13": "Chuseok holiday",
  "2030-10-03": "National Foundation Day",
  "2030-10-09": "Hangul Day",
  "2030-12-25": "Christmas Day",
  "2030-12-31": "Year-end bank closure",
};
export const KR_CALENDAR_SOURCE: Readonly<Record<number, "official_wolryeok" | "derived">> = {
  2026: "official_wolryeok",
  2027: "official_wolryeok",
  2028: "derived",
  2029: "derived",
  2030: "derived",
};
/** 휴일표가 입력된 연도. 이 밖의 연도(2031~)는 unverified_calendar 플래그를 단다. */
export const KR_CALENDAR_VERIFIED_YEARS: readonly number[] = Object.keys(KR_CALENDAR_SOURCE).map(Number);

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
