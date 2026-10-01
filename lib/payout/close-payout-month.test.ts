import { describe, expect, it } from "vitest";
import { previousUtcMonthRange } from "./close-payout-month";

// P4-2(2차) — 자동 마감이 "어느 기간을 마감할지" 계산하는 규칙.
// 기준은 기존 정산과 동일한 UTC다(reservations.starts_at::date, previousMonthRange).

describe("previousUtcMonthRange", () => {
  it("직전에 끝난 달의 첫날~마지막날을 돌려준다", () => {
    expect(previousUtcMonthRange(new Date("2026-09-01T03:00:00.000Z"))).toEqual({
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
    });
  });

  it("연초에는 전년 12월을 마감한다", () => {
    expect(previousUtcMonthRange(new Date("2027-01-01T03:00:00.000Z"))).toEqual({
      periodStart: "2026-12-01",
      periodEnd: "2026-12-31",
    });
  });

  it("윤달이 아닌 2월의 마지막 날을 정확히 잡는다", () => {
    expect(previousUtcMonthRange(new Date("2026-03-15T00:00:00.000Z"))).toEqual({
      periodStart: "2026-02-01",
      periodEnd: "2026-02-28",
    });
  });

  it("월 중 언제 실행해도(실행 지연) 같은 직전 달을 가리킨다 — 재시도가 안전한 이유", () => {
    const early = previousUtcMonthRange(new Date("2026-07-01T00:05:00.000Z"));
    const late = previousUtcMonthRange(new Date("2026-07-28T23:59:00.000Z"));
    expect(early).toEqual(late);
    expect(early).toEqual({ periodStart: "2026-06-01", periodEnd: "2026-06-30" });
  });

  it("UTC 기준이라 월 경계 직후의 현지 시각에 흔들리지 않는다", () => {
    // 2026-09-01T00:30Z 는 한국시간 09:30, 로스앤젤레스 전날 17:30이지만
    // 정산 기준은 UTC 하나뿐이라 결과가 같아야 한다.
    expect(previousUtcMonthRange(new Date("2026-09-01T00:30:00.000Z"))).toEqual({
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
    });
  });
});
