import { describe, expect, it } from "vitest";
import { DEFAULT_TIMEZONE, resolveUserTimezone, TIMEZONE_OPTIONS } from "./timezone";

describe("resolveUserTimezone", () => {
  it("개인 설정이 있으면 그걸 쓴다", () => {
    expect(
      resolveUserTimezone({ profileTimezone: "Asia/Seoul", householdDefaultTimezone: "America/New_York" })
    ).toBe("Asia/Seoul");
  });

  it("개인 설정이 없으면 household 기본값을 쓴다(학생 상속)", () => {
    expect(
      resolveUserTimezone({ profileTimezone: null, householdDefaultTimezone: "America/New_York" })
    ).toBe("America/New_York");
  });

  it("둘 다 없으면 America/Los_Angeles로 대체한다", () => {
    expect(resolveUserTimezone({ profileTimezone: null, householdDefaultTimezone: null })).toBe(
      DEFAULT_TIMEZONE
    );
    expect(resolveUserTimezone({})).toBe(DEFAULT_TIMEZONE);
  });

  it("빈 문자열은 미설정으로 취급한다", () => {
    expect(resolveUserTimezone({ profileTimezone: "", householdDefaultTimezone: "" })).toBe(
      DEFAULT_TIMEZONE
    );
  });
});

describe("TIMEZONE_OPTIONS", () => {
  // 제품 오너 지적사항 3 — 미국 전역 시간대(동부/중부/산악/산악-서머타임없음/
  // 태평양/알래스카/하와이)가 모두 선택지에 있어야 한다.
  const usValues = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Phoenix",
    "America/Los_Angeles",
    "America/Anchorage",
    "Pacific/Honolulu",
  ];

  it.each(usValues)("미국 시간대 %s가 선택지에 포함된다", (tz) => {
    expect(TIMEZONE_OPTIONS.some((o) => o.value === tz)).toBe(true);
  });

  it("모든 선택지 value가 유효한 IANA 시간대다(Intl로 파싱 가능)", () => {
    for (const option of TIMEZONE_OPTIONS) {
      expect(() => new Intl.DateTimeFormat("en-US", { timeZone: option.value })).not.toThrow();
    }
  });

  it("기본값(America/Los_Angeles)도 선택지 안에 있다", () => {
    expect(TIMEZONE_OPTIONS.some((o) => o.value === DEFAULT_TIMEZONE)).toBe(true);
  });
});
