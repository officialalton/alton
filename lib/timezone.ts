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

// R6/M4 — 시간대 설정 UI에 노출할 선택지. 실제 서비스 대상 지역(한국 학생/학부모,
// 미국 거주 학생/학부모, 한국 명문대 대학원생 선생님) 기준으로 미국 전역 표준
// 시간대(동부/중부/산악/산악-서머타임 없음(애리조나)/태평양/알래스카/하와이)를
// 모두 포함하고, 한국 시간대를 더한다. 전체 IANA 타임존 목록을 그대로 나열하지는
// 않는다(과도한 설계 금지) — 미국 내 실제로 쓰이는 지역 표준시만 명시적으로 나열.
export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "Asia/Seoul", label: "서울 (Asia/Seoul)" },
  { value: "America/New_York", label: "뉴욕 — 동부(ET) (America/New_York)" },
  { value: "America/Chicago", label: "시카고 — 중부(CT) (America/Chicago)" },
  { value: "America/Denver", label: "덴버 — 산악(MT) (America/Denver)" },
  { value: "America/Phoenix", label: "피닉스 — 산악, 서머타임 없음(MST) (America/Phoenix)" },
  { value: "America/Los_Angeles", label: "로스앤젤레스 — 태평양(PT) (America/Los_Angeles)" },
  { value: "America/Anchorage", label: "앵커리지 — 알래스카(AKT) (America/Anchorage)" },
  { value: "Pacific/Honolulu", label: "호놀룰루 — 하와이(HST) (Pacific/Honolulu)" },
];

export function timezoneLabel(timezone: string): string {
  return TIMEZONE_OPTIONS.find((o) => o.value === timezone)?.label ?? timezone;
}
