import { describe, expect, it } from "vitest";
import { isJointBusinessDay, isKrCalendarVerified, jointBusinessDayOnOrBefore, krwTransferDate } from "./kr-bank-holidays";

describe("KRW 국제송금 일정(한·미 공통 영업일)", () => {
  it("추석 연휴는 공통 영업일이 아니다", () => {
    expect(isJointBusinessDay("2026-09-25")).toBe(false);
    expect(isJointBusinessDay("2026-09-23")).toBe(true);
  });
  it("한국 휴일만 있는 날(한글날)·미국 휴일만 있는 날(컬럼버스데이)은 모두 제외된다", () => {
    expect(isJointBusinessDay("2026-10-09")).toBe(false); // KR
    expect(isJointBusinessDay("2026-10-12")).toBe(false); // US
  });
  it("토요일 기한은 직전 공통 영업일로 당긴다", () => {
    expect(jointBusinessDayOnOrBefore("2026-10-10")).toBe("2026-10-08");
  });
  it("송금 예정일은 기한보다 앞이고 5 공통 영업일 선행이다", () => {
    expect(krwTransferDate("2026-10-26").date).toBe("2026-10-19");
    expect(krwTransferDate("2026-10-26", 3).date).toBe("2026-10-21");
  });
  it("2026~2030은 휴일표가 있고 2031 이후는 unverified_calendar 플래그를 단다", () => {
    for (const d of ["2026-10-26", "2027-02-26", "2028-10-26", "2029-02-26", "2030-12-10"]) {
      expect(isKrCalendarVerified(d), d).toBe(true);
      expect(krwTransferDate(d).unverifiedCalendar).toBe(false);
    }
    expect(krwTransferDate("2031-02-26").unverifiedCalendar).toBe(true);
  });
  it("설·추석·대체공휴일이 공통 영업일에서 빠진다(2027 설 대체 2/9, 2028 추석 대체 10/5, 2029 추석 대체 9/24, 2030 설 대체 2/5)", () => {
    for (const d of ["2027-02-09", "2027-09-15", "2028-01-27", "2028-10-05", "2029-09-24", "2030-02-05", "2030-09-12", "2027-05-03", "2027-07-19"]) {
      expect(isJointBusinessDay(d), d).toBe(false);
    }
    expect(isJointBusinessDay("2027-02-10")).toBe(true);
  });
});
