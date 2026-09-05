// R2 §4.21 — 시간대 해석 순서: 개인 설정(profiles.timezone) → household 기본값
// (households.default_timezone) → 최종 fallback(America/Los_Angeles). 브라우저
// 감지 기반 최초 로그인 제안 UI는 아직 이 값을 실제로 표시할 화면(예약/세션
// 시간 표시)이 없어(R6 이전) 구현하지 않는다 — 여기서는 정책에 확정된 해석
// 순서만 순수 함수로 구현해 이후 R6 등에서 그대로 재사용할 수 있게 한다.

export const DEFAULT_TIMEZONE = "America/Los_Angeles";

export function resolveUserTimezone(params: {
  profileTimezone?: string | null;
  householdDefaultTimezone?: string | null;
}): string {
  return params.profileTimezone || params.householdDefaultTimezone || DEFAULT_TIMEZONE;
}

// R6 — 시간대 설정 UI에 노출할 선택지. 실제 서비스 대상 지역(한국 학생/학부모,
// 미국 거주 학생/학부모, 한국 명문대 대학원생 선생님) 기준으로 제한한다. 전체
// IANA 타임존 목록을 나열하지 않는다(과도한 설계 금지).
export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "Asia/Seoul", label: "서울 (Asia/Seoul)" },
  { value: "America/Los_Angeles", label: "로스앤젤레스 (America/Los_Angeles)" },
  { value: "America/Denver", label: "덴버 (America/Denver)" },
  { value: "America/Chicago", label: "시카고 (America/Chicago)" },
  { value: "America/New_York", label: "뉴욕 (America/New_York)" },
];

export function timezoneLabel(timezone: string): string {
  return TIMEZONE_OPTIONS.find((o) => o.value === timezone)?.label ?? timezone;
}
