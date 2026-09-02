// R6 6/N — 예약 가능 슬롯 후보 계산(순수 함수, DB 접근 없음). 여기서 계산한 후보는
// "추천"일 뿐 최종 권위가 아니다 — 실제 예약 확정은 항상 `confirm_lesson_booking()`
// (supabase/migrations/20260926000000_r6_availability_and_booking.sql)이 서버에서
// window/가용성/버퍼를 다시 검사하므로, 이 함수의 결과와 서버 판정이 어긋나도(예:
// 경쟁 상태로 그 사이 다른 예약이 잡힘) 이중 예약은 발생하지 않는다.
//
// 시간대/DST는 Postgres의 `timestamptz AT TIME ZONE <iana 이름>`과 동일한 결과가
// 나오도록 Intl.DateTimeFormat(런타임 내장 tzdata)에 위임한다 — 별도 라이브러리나
// 수동 오프셋 표를 쓰지 않는다.

export type AvailabilityRule = {
  dayOfWeek: number; // 0=일요일 ~ 6=토요일 (Postgres extract(dow) 기준과 동일)
  startTimeLocal: string; // "HH:MM" (24h)
  endTimeLocal: string;
  timezone: string;
  effectiveFrom: string; // "YYYY-MM-DD"
  effectiveUntil: string | null;
};

export type AvailabilityException = {
  date: string; // "YYYY-MM-DD"
  kind: "blocked" | "available";
  startTimeLocal: string | null; // null = 종일
  endTimeLocal: string | null;
  timezone: string;
};

export type ExistingReservation = {
  startsAt: Date;
  endsAt: Date;
};

export type SlotSearchParams = {
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  existingReservations: ExistingReservation[];
  durationMinutes: number;
  bufferMinutes: number;
  windowStart: Date; // 보통 now(), 관리자 override면 now() 그대로(하한 무시는 아래 참고)
  windowEnd: Date; // 보통 now()+8주
  now: Date;
  adminOverride?: boolean; // true면 24시간 하한을 건너뛴다(8주 상한은 동일 적용)
  stepMinutes?: number; // 후보 슬롯 간격(기본 30분) — 규칙 시작 시각 기준 고정 격자가 아니라 임의 간격 후보를 원하면 조정
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function getZonedParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour") === "24" ? "0" : get("hour")),
    minute: Number(get("minute")),
    dayOfWeek: weekdayMap[get("weekday")] ?? 0,
    dateStr: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

/**
 * 특정 IANA timezone의 로컬 벽시계 시각(year/month/day/hour/minute)에 대응하는 UTC
 * Date를 구한다. 초기 추정(로컬 값을 그대로 UTC로 해석) 후, 그 추정 시각의 실제
 * 타임존 오프셋을 다시 읽어 한 번 보정한다(DST 경계 근처에서도 정확 — 표준 2-pass
 * 기법, 별도 라이브러리 없이 Intl만으로 구현).
 */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const guessParts = getZonedParts(guess, timeZone);
  const guessAsUtc = Date.UTC(guessParts.year, guessParts.month - 1, guessParts.day, guessParts.hour, guessParts.minute, 0);
  const offsetMs = guessAsUtc - guess.getTime();
  return new Date(guess.getTime() - offsetMs);
}

function parseHm(hm: string): { hour: number; minute: number } {
  const [h, m] = hm.split(":").map(Number);
  return { hour: h, minute: m };
}

function addDaysUtcDateOnly(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

function overlapsWithBuffer(
  candidateStart: Date,
  candidateEnd: Date,
  bufferMinutes: number,
  existing: ExistingReservation[]
): boolean {
  const bufferMs = bufferMinutes * 60_000;
  return existing.some(
    (r) =>
      candidateStart.getTime() < r.endsAt.getTime() + bufferMs &&
      candidateEnd.getTime() > r.startsAt.getTime() - bufferMs
  );
}

/**
 * 후보 슬롯 시작 시각 목록을 반환한다(오름차순, UTC Date). 각 후보는 이미 다음을
 * 전부 통과했다: 24시간~8주 window(관리자 override 시 하한 제외), 날짜별 예외
 * (blocked 전체 우선, available은 규칙 없이도 허용), 반복 가능 시간 규칙, 버퍼
 * (전후 bufferMinutes 이내 기존 예약과 겹치지 않음).
 */
export function computeAvailableSlots(params: SlotSearchParams): Date[] {
  const {
    rules,
    exceptions,
    existingReservations,
    durationMinutes,
    bufferMinutes,
    windowEnd,
    now,
    adminOverride = false,
    stepMinutes = 30,
  } = params;

  const lowerBound = adminOverride ? now : new Date(now.getTime() + 24 * 60 * 60_000);
  const upperBound = windowEnd < new Date(now.getTime() + 8 * 7 * 24 * 60 * 60_000)
    ? windowEnd
    : new Date(now.getTime() + 8 * 7 * 24 * 60 * 60_000);

  if (rules.length === 0) return [];

  const exceptionsByDate = new Map<string, AvailabilityException[]>();
  for (const e of exceptions) {
    const list = exceptionsByDate.get(e.date) ?? [];
    list.push(e);
    exceptionsByDate.set(e.date, list);
  }

  const results: Date[] = [];
  // 규칙에 등장하는 타임존 중 하나를 날짜 순회 기준으로 쓴다(전부 같은 타임존이라는
  // 전제 — 한 선생님의 가용시간 규칙은 보통 단일 타임존으로 관리된다).
  const primaryTimezone = rules[0].timezone;

  let cursorDateStr = getZonedParts(lowerBound, primaryTimezone).dateStr;
  const upperDateStr = getZonedParts(upperBound, primaryTimezone).dateStr;

  let guard = 0;
  while (cursorDateStr <= upperDateStr && guard < 8 * 7 + 2) {
    guard += 1;
    const [y, m, d] = cursorDateStr.split("-").map(Number);
    const dayOfWeek = getZonedParts(zonedTimeToUtc(y, m, d, 12, 0, primaryTimezone), primaryTimezone).dayOfWeek;

    const dayExceptions = exceptionsByDate.get(cursorDateStr) ?? [];
    const fullDayBlocked = dayExceptions.some((e) => e.kind === "blocked" && e.startTimeLocal === null);

    if (!fullDayBlocked) {
      const availableWindows: Array<{ start: string; end: string; timezone: string }> = [];

      const fullDayAvailable = dayExceptions.find((e) => e.kind === "available" && e.startTimeLocal === null);
      if (fullDayAvailable) {
        availableWindows.push({ start: "00:00", end: "23:59", timezone: fullDayAvailable.timezone });
      }
      for (const e of dayExceptions) {
        if (e.kind === "available" && e.startTimeLocal && e.endTimeLocal) {
          availableWindows.push({ start: e.startTimeLocal, end: e.endTimeLocal, timezone: e.timezone });
        }
      }
      for (const rule of rules) {
        if (rule.dayOfWeek !== dayOfWeek) continue;
        if (cursorDateStr < rule.effectiveFrom) continue;
        if (rule.effectiveUntil && cursorDateStr > rule.effectiveUntil) continue;
        availableWindows.push({ start: rule.startTimeLocal, end: rule.endTimeLocal, timezone: rule.timezone });
      }

      const partialBlocks = dayExceptions.filter((e) => e.kind === "blocked" && e.startTimeLocal && e.endTimeLocal);

      for (const win of availableWindows) {
        const { hour: startHour, minute: startMinute } = parseHm(win.start);
        const { hour: endHour, minute: endMinute } = parseHm(win.end);
        let cursor = zonedTimeToUtc(y, m, d, startHour, startMinute, win.timezone);
        const windowEndUtc = zonedTimeToUtc(y, m, d, endHour, endMinute, win.timezone);

        while (cursor.getTime() + durationMinutes * 60_000 <= windowEndUtc.getTime()) {
          const slotEnd = new Date(cursor.getTime() + durationMinutes * 60_000);

          const withinBookingWindow = cursor.getTime() >= lowerBound.getTime() && cursor.getTime() <= upperBound.getTime();
          const blockedByPartialException = partialBlocks.some((b) => {
            const { hour: bh, minute: bm } = parseHm(b.startTimeLocal!);
            const { hour: eh, minute: em } = parseHm(b.endTimeLocal!);
            const blockStart = zonedTimeToUtc(y, m, d, bh, bm, b.timezone);
            const blockEnd = zonedTimeToUtc(y, m, d, eh, em, b.timezone);
            return cursor.getTime() < blockEnd.getTime() && slotEnd.getTime() > blockStart.getTime();
          });
          const conflictsBuffer = overlapsWithBuffer(cursor, slotEnd, bufferMinutes, existingReservations);

          if (withinBookingWindow && !blockedByPartialException && !conflictsBuffer) {
            results.push(new Date(cursor));
          }

          cursor = new Date(cursor.getTime() + stepMinutes * 60_000);
        }
      }
    }

    cursorDateStr = addDaysUtcDateOnly(cursorDateStr, 1);
  }

  results.sort((a, b) => a.getTime() - b.getTime());
  // 같은 순간이 여러 available window(예외+규칙)에서 중복 생성될 수 있어 dedupe.
  const seen = new Set<number>();
  return results.filter((d) => {
    if (seen.has(d.getTime())) return false;
    seen.add(d.getTime());
    return true;
  });
}
