// 날짜·시각 표시 공용 포맷터 — 항상 명시적 timeZone을 넘겨 서버(UTC)와 브라우저(사용자 로컬)가
// 같은 문자열을 만들게 한다(React hydration #418 방지). 출력 형식은 기존 ko-KR 로케일 그대로.
// 화면이 이미 사용자/선생님 시간대(`timezone` prop)를 알면 마지막 인자로 넘긴다. 모르면
// DISPLAY_TIMEZONE(서비스 운영 기준 시간대, 한국)을 쓴다.

export const DISPLAY_TIMEZONE = "Asia/Seoul";

type DateInput = Date | string | number;

const toDate = (v: DateInput) => (v instanceof Date ? v : new Date(v));

export function fmtDateTime(v: DateInput, opts?: Intl.DateTimeFormatOptions, timeZone: string = DISPLAY_TIMEZONE): string {
  return toDate(v).toLocaleString("ko-KR", { ...opts, timeZone });
}

export function fmtDate(v: DateInput, opts?: Intl.DateTimeFormatOptions, timeZone: string = DISPLAY_TIMEZONE): string {
  return toDate(v).toLocaleDateString("ko-KR", { ...opts, timeZone });
}

export function fmtTime(v: DateInput, opts?: Intl.DateTimeFormatOptions, timeZone: string = DISPLAY_TIMEZONE): string {
  return toDate(v).toLocaleTimeString("ko-KR", { ...opts, timeZone });
}

// `new Intl.DateTimeFormat("ko-KR", opts).format(v)` 대체.
export function fmtIntl(v: DateInput, opts: Intl.DateTimeFormatOptions, timeZone: string = DISPLAY_TIMEZONE): string {
  return new Intl.DateTimeFormat("ko-KR", { ...opts, timeZone }).format(toDate(v));
}

// en-CA "YYYY-MM-DD" 날짜 키(오늘/같은 날 비교용).
export function dateKey(v: DateInput, timeZone: string = DISPLAY_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(toDate(v));
}
