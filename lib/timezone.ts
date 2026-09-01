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
