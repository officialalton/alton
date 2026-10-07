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
  it("검증되지 않은 연도는 플래그를 단다", () => {
    expect(isKrCalendarVerified("2026-10-26")).toBe(true);
    expect(krwTransferDate("2027-02-26").unverifiedCalendar).toBe(true);
    expect(krwTransferDate("2026-10-26").unverifiedCalendar).toBe(false);
  });
});
