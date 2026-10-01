import { afterEach, describe, expect, it } from "vitest";
import { dateKey, DISPLAY_TIMEZONE, fmtDate, fmtDateTime, fmtIntl, fmtTime } from "./format-datetime";

// 같은 시각은 프로세스 TZ(서버 UTC / 브라우저 로컬)와 무관하게 같은 문자열이어야 한다.
const ZONES = ["UTC", "America/Los_Angeles", "Asia/Seoul", "Pacific/Auckland"];
const original = process.env.TZ;
afterEach(() => {
  if (original === undefined) delete process.env.TZ;
  else process.env.TZ = original;
});

function underEachZone(fn: () => string): string[] {
  return ZONES.map((z) => {
    process.env.TZ = z;
    return fn();
  });
}

describe("format-datetime", () => {
  const iso = "2026-09-29T15:04:05.000Z";

  it("프로세스 TZ가 달라도 출력이 같다", () => {
    for (const fn of [
      () => fmtDateTime(iso),
      () => fmtDateTime(iso, { dateStyle: "medium", timeStyle: "short" }),
      () => fmtDate(iso),
      () => fmtTime(iso, { hour: "2-digit", minute: "2-digit" }),
      () => fmtIntl(iso, { month: "long", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }),
      () => dateKey(iso),
    ]) {
      expect(new Set(underEachZone(fn)).size).toBe(1);
    }
  });

  it("기본 시간대는 Asia/Seoul, 명시 시간대를 넘기면 그 시간대 기준", () => {
    expect(DISPLAY_TIMEZONE).toBe("Asia/Seoul");
    expect(fmtDateTime(iso)).toBe("2026. 9. 30. 오전 12:04:05");
    expect(fmtDateTime(iso, undefined, "America/Los_Angeles")).toBe("2026. 9. 29. 오전 8:04:05");
    expect(dateKey(iso, "America/Los_Angeles")).toBe("2026-09-29");
    expect(dateKey(iso)).toBe("2026-09-30");
  });

  it("서머타임 경계(2026-03-08 미국 DST 시작)에서도 명시 시간대를 따른다", () => {
    // 2026-03-08T09:59Z = LA 01:59 PST, 10:00Z = LA 03:00 PDT
    expect(fmtTime("2026-03-08T09:59:00.000Z", { hour: "2-digit", minute: "2-digit" }, "America/Los_Angeles")).toBe("오전 01:59");
    expect(fmtTime("2026-03-08T10:00:00.000Z", { hour: "2-digit", minute: "2-digit" }, "America/Los_Angeles")).toBe("오전 03:00");
  });

  it("Date·number 입력도 받는다", () => {
    expect(fmtDate(new Date(iso))).toBe(fmtDate(Date.parse(iso)));
  });
});
