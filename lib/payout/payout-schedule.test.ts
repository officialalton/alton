import { describe, expect, it } from "vitest";
import {
  COMPANY_TIME_ZONE,
  companyDateOf,
  isPayoutDay,
  isPeriodCloseDay,
  payoutDateForPeriodEnd,
  payoutPeriodOfDate,
  periodForPayoutDate,
  previousPayoutPeriod,
} from "./payout-schedule";

// 월 2회 정산(2026-10-06): 1~15일분 → 같은 달 20일, 16일~말일분 → 다음 달 5일. 기준은 회사 시간대 America/Los_Angeles.

describe("payoutPeriodOfDate", () => {
  it("경계: 1일·15일은 전반기, 16일은 후반기", () => {
    expect(payoutPeriodOfDate("2026-09-01")).toMatchObject({ periodKey: "2026-09-H1", periodStart: "2026-09-01", periodEnd: "2026-09-15", payoutDate: "2026-09-20" });
    expect(payoutPeriodOfDate("2026-09-15")?.periodKey).toBe("2026-09-H1");
    expect(payoutPeriodOfDate("2026-09-16")).toMatchObject({ periodKey: "2026-09-H2", periodStart: "2026-09-16", periodEnd: "2026-09-30", payoutDate: "2026-10-05" });
  });

  it("월말: 30일·31일·2월(평년·윤년)", () => {
    expect(payoutPeriodOfDate("2026-10-31")).toMatchObject({ periodEnd: "2026-10-31", payoutDate: "2026-11-05" });
    expect(payoutPeriodOfDate("2026-02-28")).toMatchObject({ periodEnd: "2026-02-28", payoutDate: "2026-03-05" });
    expect(payoutPeriodOfDate("2028-02-29")).toMatchObject({ periodStart: "2028-02-16", periodEnd: "2028-02-29", payoutDate: "2028-03-05" });
  });

  it("12월 후반기는 다음 해 1월 5일에 지급한다", () => {
    expect(payoutPeriodOfDate("2026-12-20")).toMatchObject({ periodEnd: "2026-12-31", payoutDate: "2027-01-05" });
  });

  it("ISO 시각은 LA 달력 날짜로 환산한다(UTC 아님)", () => {
    expect(COMPANY_TIME_ZONE).toBe("America/Los_Angeles");
    // 9월 16일 05:00Z = LA 9월 15일 22:00 → 전반기. 07:30Z = LA 9월 16일 00:30 → 후반기.
    expect(payoutPeriodOfDate("2026-09-16T05:00:00.000Z")?.periodKey).toBe("2026-09-H1");
    expect(payoutPeriodOfDate("2026-09-16T07:30:00.000Z")?.periodKey).toBe("2026-09-H2");
  });

  it("월말 경계: LA 9월 30일 23:59(PDT)는 9월 후반기, 10월 1일 00:00은 10월 전반기", () => {
    expect(payoutPeriodOfDate("2026-10-01T06:59:00.000Z")?.periodKey).toBe("2026-09-H2");
    expect(payoutPeriodOfDate("2026-10-01T07:00:00.000Z")?.periodKey).toBe("2026-10-H1");
  });

  it("겨울(PST, UTC-8) 월말 경계: LA 12월 31일 23:59는 12월 후반기 → 1월 5일 지급", () => {
    expect(payoutPeriodOfDate("2027-01-01T07:59:00.000Z")).toMatchObject({ periodKey: "2026-12-H2", payoutDate: "2027-01-05" });
    expect(payoutPeriodOfDate("2027-01-01T08:00:00.000Z")?.periodKey).toBe("2027-01-H1");
  });

  it("DST 전환(3월 8일 spring forward, 11월 1일 fall back)에도 날짜가 하루씩 밀리지 않는다", () => {
    expect(companyDateOf("2026-03-08T09:59:00.000Z")).toBe("2026-03-08"); // 01:59 PST
    expect(companyDateOf("2026-03-08T10:00:00.000Z")).toBe("2026-03-08"); // 03:00 PDT
    expect(companyDateOf("2026-03-09T06:59:00.000Z")).toBe("2026-03-08"); // 23:59 PDT
    expect(companyDateOf("2026-11-01T08:30:00.000Z")).toBe("2026-11-01"); // 01:30 PDT(첫 번째)
    expect(companyDateOf("2026-11-01T09:30:00.000Z")).toBe("2026-11-01"); // 01:30 PST(두 번째)
    expect(companyDateOf("2026-11-02T07:59:00.000Z")).toBe("2026-11-01"); // 23:59 PST
    expect(companyDateOf("2026-11-02T08:00:00.000Z")).toBe("2026-11-02");
  });

  it("잘못된 날짜는 null", () => {
    expect(payoutPeriodOfDate("2026-02-30")).toBeNull();
    expect(payoutPeriodOfDate("unknown")).toBeNull();
  });
});

describe("payoutDateForPeriodEnd", () => {
  it("15일 이하 종료는 같은 달 20일, 그 외(말일)는 다음 달 5일 — 기존 월 단위 묶음도 5일", () => {
    expect(payoutDateForPeriodEnd("2026-09-15")).toBe("2026-09-20");
    expect(payoutDateForPeriodEnd("2026-09-30")).toBe("2026-10-05");
    expect(payoutDateForPeriodEnd("2026-12-31")).toBe("2027-01-05");
  });
});

describe("previousPayoutPeriod", () => {
  it("LA 날짜가 1일이면 지난달 16일~말일을 마감한다", () => {
    expect(previousPayoutPeriod(new Date("2026-10-01T17:00:00.000Z"))).toEqual({ periodStart: "2026-09-16", periodEnd: "2026-09-30" });
    expect(previousPayoutPeriod(new Date("2027-01-01T17:00:00.000Z"))).toEqual({ periodStart: "2026-12-16", periodEnd: "2026-12-31" });
    expect(previousPayoutPeriod(new Date("2026-03-01T17:00:00.000Z"))).toEqual({ periodStart: "2026-02-16", periodEnd: "2026-02-28" });
    expect(previousPayoutPeriod(new Date("2028-03-01T17:00:00.000Z"))).toEqual({ periodStart: "2028-02-16", periodEnd: "2028-02-29" });
  });

  it("LA 날짜가 16일이면 이번 달 1~15일을 마감한다", () => {
    expect(previousPayoutPeriod(new Date("2026-10-16T17:00:00.000Z"))).toEqual({ periodStart: "2026-10-01", periodEnd: "2026-10-15" });
  });

  it("실행이 지연돼도 같은 기간을 가리킨다(재시도 안전)", () => {
    expect(previousPayoutPeriod(new Date("2026-10-02T23:59:00.000Z"))).toEqual(previousPayoutPeriod(new Date("2026-10-15T00:00:00.000Z")));
  });

  it("UTC가 아니라 LA 날짜로 판단한다", () => {
    // UTC로는 10월 16일 03:00이지만 LA는 아직 10월 15일 20:00 → 이번 달 1~15일이 아니라 지난달 후반기.
    expect(previousPayoutPeriod(new Date("2026-10-16T03:00:00.000Z"))).toEqual({ periodStart: "2026-09-16", periodEnd: "2026-09-30" });
    // UTC로는 10월 1일 03:00이지만 LA는 9월 30일 20:00 → 후반기가 아직 안 끝났으니 9월 전반기.
    expect(previousPayoutPeriod(new Date("2026-10-01T03:00:00.000Z"))).toEqual({ periodStart: "2026-09-01", periodEnd: "2026-09-15" });
  });
});

describe("cron day gates (LA)", () => {
  it("매일 17:00 UTC 크론에서 LA 날짜로 마감일·지급일을 가린다", () => {
    expect(isPeriodCloseDay(new Date("2026-10-01T17:00:00.000Z"))).toBe(true);
    expect(isPeriodCloseDay(new Date("2026-10-16T17:00:00.000Z"))).toBe(true);
    expect(isPeriodCloseDay(new Date("2026-10-02T17:00:00.000Z"))).toBe(false);
    expect(isPayoutDay(new Date("2026-11-05T17:00:00.000Z"))).toBe(true); // PST 09:00
    expect(isPayoutDay(new Date("2026-10-20T17:00:00.000Z"))).toBe(true); // PDT 10:00
    expect(isPayoutDay(new Date("2026-10-21T17:00:00.000Z"))).toBe(false);
    // UTC 날짜가 5일이어도 LA가 4일이면 지급일이 아니다.
    expect(isPayoutDay(new Date("2026-10-05T03:00:00.000Z"))).toBe(false);
  });
});

describe("periodForPayoutDate", () => {
  it("20일은 같은 달 1~15일분, 5일은 지난달 16일~말일분", () => {
    expect(periodForPayoutDate("2026-10-20")).toEqual({ periodStart: "2026-10-01", periodEnd: "2026-10-15" });
    expect(periodForPayoutDate("2026-03-05")).toEqual({ periodStart: "2026-02-16", periodEnd: "2026-02-28" });
    expect(periodForPayoutDate("2027-01-05")).toEqual({ periodStart: "2026-12-16", periodEnd: "2026-12-31" });
    expect(periodForPayoutDate("2026-10-10")).toBeNull();
  });
});

describe("period labels", () => {
  it("표준 반월 기간과 지급일을 'Oct 1–15, 2026 → paid Oct 20'로 표기한다", async () => {
    const { formatPeriodWithPayoutEn, formatPeriodLabelEn } = await import("./payout-schedule");
    expect(formatPeriodWithPayoutEn("2026-10-01", "2026-10-15")).toBe("Oct 1–15, 2026 → paid Oct 20");
    expect(formatPeriodWithPayoutEn("2026-10-16", "2026-10-31")).toBe("Oct 16–31, 2026 → paid Nov 5");
    expect(formatPeriodWithPayoutEn("2026-12-16", "2026-12-31")).toBe("Dec 16–31, 2026 → paid Jan 5");
    expect(formatPeriodLabelEn("2026-10-20", "2026-11-03")).toBe("Oct 20 – Nov 3, 2026");
  });
});
