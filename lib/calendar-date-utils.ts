// R6 11/N — 월간/주간 캘린더 UI 공통 유틸(학생·보호자 예약, 선생님 일정·가능시간, 관리자
// 통합 일정에서 전부 재사용). 순수 함수만 — timezone 인식 날짜 키 계산과 달력 그리드 생성만
// 담당하고, 예약/가용성 데이터 자체는 각 화면이 이미 갖고 있는 것을 그대로 쓴다.

/** ISO datetime을 주어진 timezone 기준 "YYYY-MM-DD" 키로 변환한다(요일 그룹핑/달력 배지용). */
export function dateKeyInTimezone(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

export type CalendarCell = { dateKey: string; day: number; inCurrentMonth: boolean };

/**
 * year/month(0-indexed, JS Date 관례)의 월간 달력 그리드(일요일 시작, 6주 고정 42칸)를
 * 만든다. 순수하게 달력 날짜 키 생성만 — timezone은 "그 월의 1일이 어느 timezone
 * 기준인지"를 결정하는 데만 쓰인다(이미 그 timezone 기준 연/월을 받는다고 가정).
 */
export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const startWeekday = firstOfMonth.getUTCDay(); // 0=일요일
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const daysInPrevMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: CalendarCell[] = [];
  for (let i = 0; i < startWeekday; i++) {
    const day = daysInPrevMonth - startWeekday + 1 + i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    cells.push({ dateKey: toDateKey(prevYear, prevMonth, day), day, inCurrentMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ dateKey: toDateKey(year, month, day), day, inCurrentMonth: true });
  }
  while (cells.length < 42) {
    const day = cells.length - startWeekday - daysInMonth + 1;
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    cells.push({ dateKey: toDateKey(nextYear, nextMonth, day), day, inCurrentMonth: false });
  }
  return cells;
}

function toDateKey(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, "0");
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** dateKey("YYYY-MM-DD") 기준 7일치 주간 grid(일요일 시작)를 만든다. */
export function buildWeekGrid(dateKey: string): CalendarCell[] {
  const [y, m, d] = dateKey.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  const weekday = base.getUTCDay();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 7; i++) {
    const offset = i - weekday;
    const cellDate = new Date(Date.UTC(y, m - 1, d + offset));
    cells.push({
      dateKey: toDateKey(cellDate.getUTCFullYear(), cellDate.getUTCMonth(), cellDate.getUTCDate()),
      day: cellDate.getUTCDate(),
      inCurrentMonth: cellDate.getUTCMonth() === m - 1,
    });
  }
  return cells;
}

export function todayKeyInTimezone(timezone: string): string {
  return dateKeyInTimezone(new Date().toISOString(), timezone);
}

/** startsAt/endsAt 구간이 걸치는 모든 날짜 키(timezone 기준)를 집합으로 만든다. */
export function dateKeysCoveredByInterval(startsAt: string, endsAt: string, timezone: string): string[] {
  const keys: string[] = [];
  let cursor = new Date(startsAt);
  const end = new Date(endsAt);
  let guard = 0;
  while (cursor <= end && guard < 400) {
    keys.push(dateKeyInTimezone(cursor.toISOString(), timezone));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60_000);
    guard += 1;
  }
  return Array.from(new Set(keys));
}
