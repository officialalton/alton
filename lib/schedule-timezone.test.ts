import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SCHEDULE_TIMEZONE_STORAGE_KEY,
  detectInitialScheduleTimezone,
  nearestSupportedTimezone,
  sanitizeTimezone,
  saveScheduleTimezone,
} from "./schedule-timezone";


// 이 환경의 jsdom/Node 조합은 window.localStorage 가 완전한 Storage 가 아니라서 메모리 구현으로 대체한다.
function installStorage(opts: { throws?: boolean } = {}) {
  const m = new Map<string, string>();
  const boom = () => {
    throw new Error("blocked");
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: opts.throws ? boom : (k: string) => m.get(k) ?? null,
      setItem: opts.throws ? boom : (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
      clear: () => m.clear(),
    },
  });
}

beforeEach(() => installStorage());
afterEach(() => vi.restoreAllMocks());

function mockBrowserZone(tz: string) {
  const real = Intl.DateTimeFormat;
  vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (this: unknown, ...args: ConstructorParameters<typeof Intl.DateTimeFormat>) {
    const f = new real(...args);
    if (args.length === 0) {
      const ro = f.resolvedOptions.bind(f);
      f.resolvedOptions = () => ({ ...ro(), timeZone: tz });
    }
    return f;
  } as unknown as typeof Intl.DateTimeFormat);
}

describe("schedule-timezone", () => {
  it("지원 시간대는 그대로, 미지원은 UTC 오프셋이 가장 가까운 옵션", () => {
    const winter = new Date("2026-01-15T12:00:00Z");
    expect(nearestSupportedTimezone("Asia/Seoul", winter)).toBe("Asia/Seoul");
    expect(nearestSupportedTimezone("Asia/Tokyo", winter)).toBe("Asia/Seoul");
    expect(nearestSupportedTimezone("America/Toronto", winter)).toBe("America/New_York");
    expect(nearestSupportedTimezone("America/Vancouver", winter)).toBe("America/Los_Angeles");
    expect(nearestSupportedTimezone("Not/AZone", winter)).toBe("America/Los_Angeles");
    expect(nearestSupportedTimezone(undefined)).toBe("America/Los_Angeles");
  });

  it("sanitizeTimezone: 지원 목록 밖 값은 무시", () => {
    expect(sanitizeTimezone("Asia/Seoul")).toBe("Asia/Seoul");
    expect(sanitizeTimezone("Mars/Base")).toBeUndefined();
    expect(sanitizeTimezone(42)).toBeUndefined();
  });

  it("저장값이 있으면 브라우저 감지보다 우선한다", () => {
    mockBrowserZone("Asia/Seoul");
    saveScheduleTimezone("America/Chicago");
    expect(window.localStorage.getItem(SCHEDULE_TIMEZONE_STORAGE_KEY)).toBe("America/Chicago");
    expect(detectInitialScheduleTimezone()).toBe("America/Chicago");
  });

  it("저장값이 없으면 브라우저 시간대(가까운 옵션)를 쓴다", () => {
    mockBrowserZone("America/New_York");
    expect(detectInitialScheduleTimezone()).toBe("America/New_York");
  });

  it("저장된 값이 지원 목록 밖이면 무시한다", () => {
    mockBrowserZone("Asia/Seoul");
    window.localStorage.setItem(SCHEDULE_TIMEZONE_STORAGE_KEY, "Mars/Base");
    expect(detectInitialScheduleTimezone()).toBe("Asia/Seoul");
  });

  it("localStorage 가 throw 해도 동작한다", () => {
    mockBrowserZone("Asia/Seoul");
    installStorage({ throws: true });
    expect(() => saveScheduleTimezone("Asia/Seoul")).not.toThrow();
    expect(detectInitialScheduleTimezone()).toBe("Asia/Seoul");
  });
});
