# 2026-09-29 hydration(#418) 점검 — 날짜 포맷 timeZone 고정

- 원인: timeZone 없는 `toLocale*String("ko-KR")`/`Intl.DateTimeFormat("ko-KR")` -> 서버(UTC)와 브라우저(로컬) 출력 불일치.
- 조치: `lib/format-datetime.ts`(fmtDateTime/fmtDate/fmtTime/fmtIntl/dateKey, 항상 timeZone 주입, 기본 Asia/Seoul)로 교체.
- 자동 검증: `AdminHomeDashboard.hydration.test.tsx`(renderToString을 TZ=UTC/LA/Seoul로 실행, HTML 동일), `format-datetime.test.ts`, `no-implicit-timezone-format.test.ts`(재발 방지 가드).
- 로컬 실측: dev 서버 `TZ=UTC`(port 3018) + Playwright `timezoneId=America/Los_Angeles`, 콘솔 hydration 오류 0건.

| 계정 | 경로 | hydration 오류 |
|---|---|---|
| admin | /admin, ?tab=messenger, ?tab=consultants, ?tab=consult, ?tab=users | 0 |
| teacher seoyeon | /teacher | 0 |
| parent minji.kim | /parent | 0 |
| student jihoon | /student | 0 |

컨설턴트 포털은 시드 계정이 없어 미확인(코드는 변환 완료).
