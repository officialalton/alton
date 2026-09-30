import { DEFAULT_TIMEZONE, TIMEZONE_OPTIONS } from "@/lib/timezone";

// 예약 링크(/schedule/[token]) 고객용 표시 시간대. 비로그인이라 프로필이 없다 —
// 브라우저 감지 → 지원 목록 중 가장 가까운 값, 선택은 localStorage 에 기억한다.
// 서버 렌더는 항상 DEFAULT_TIMEZONE, 마운트 뒤(useEffect)에만 이 값들을 읽는다(hydration 안전).

export const SCHEDULE_TIMEZONE_STORAGE_KEY = "alton.schedule.timezone";

export function isSupportedTimezone(tz: unknown): tz is string {
  return typeof tz === "string" && TIMEZONE_OPTIONS.some((o) => o.value === tz);
}

/** 서버 액션 입력 검증용 — 지원 목록에 없으면 undefined(무시). */
export function sanitizeTimezone(tz: unknown): string | undefined {
  return isSupportedTimezone(tz) ? tz : undefined;
}

function offsetMinutes(tz: string, at: Date): number | null {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value;
    if (!part) return null;
    if (part === "GMT") return 0;
    const m = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(part);
    if (!m) return null;
    return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
  } catch {
    return null;
  }
}

/** 브라우저 시간대 → 지원 옵션. 정확히 일치하면 그대로, 아니면 현재 UTC 오프셋이 가장 가까운 옵션, 판단 불가면 기본값. */
export function nearestSupportedTimezone(browserTz: string | null | undefined, now: Date = new Date()): string {
  if (!browserTz) return DEFAULT_TIMEZONE;
  if (isSupportedTimezone(browserTz)) return browserTz;
  const target = offsetMinutes(browserTz, now);
  if (target === null) return DEFAULT_TIMEZONE;
  let best = DEFAULT_TIMEZONE;
  let bestDiff = Infinity;
  for (const o of TIMEZONE_OPTIONS) {
    const off = offsetMinutes(o.value, now);
    if (off === null) continue;
    const diff = Math.abs(off - target);
    if (diff < bestDiff) {
      best = o.value;
      bestDiff = diff;
    }
  }
  return best;
}

export function readSavedScheduleTimezone(): string | null {
  try {
    const v = window.localStorage.getItem(SCHEDULE_TIMEZONE_STORAGE_KEY);
    return isSupportedTimezone(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveScheduleTimezone(tz: string): void {
  try {
    window.localStorage.setItem(SCHEDULE_TIMEZONE_STORAGE_KEY, tz);
  } catch {
    /* 저장 불가 환경 — 이번 방문에만 적용 */
  }
}

/** 마운트 뒤 호출: 저장값 → 브라우저 감지(가까운 옵션) → 기본값. */
export function detectInitialScheduleTimezone(): string {
  const saved = readSavedScheduleTimezone();
  if (saved) return saved;
  let browser: string | undefined;
  try {
    browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    browser = undefined;
  }
  return nearestSupportedTimezone(browser);
}
