import { describe, expect, it } from "vitest";
import { DEFAULT_TIMEZONE, resolveUserTimezone } from "./timezone";

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
