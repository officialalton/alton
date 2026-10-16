# 2026-09-29 뷰어 시간대 표시 점검

- 변경: 포털 셸(학생/학부모/선생님/컨설턴트/관리자/세션뷰/수업준비 페이지)마다 서버 페이지가 뷰어 시간대를 `ViewerTimezoneProvider`로 한 번 내려주고, 화면은 `useViewerTimezone()`으로 fmt*/fmtIntl/dateKey에 넘긴다. 서버·클라이언트가 같은 prop을 받아 hydration 불일치 없음.
- 로컬 실측: dev 서버 port 3020, Playwright 브라우저 시간대 `Pacific/Auckland`(프로필 시간대와 다름), 콘솔 hydration 오류 0건.
- 시드 프로필 시간대를 임시 설정 후 NULL로 복원함(jihoon=LA, minji.kim=New_York, seoyeon=Chicago).

수업 예약 23:28 UTC(legacy_sessions 44444444-...-0008)의 /session 표시:

| 계정 | 저장 시간대 | /session 표시 | 기대값 |
|---|---|---|---|
| student jihoon | America/Los_Angeles | 오후 4:28 | 16:28 |
| parent minji.kim | America/New_York | 오후 7:28 | 19:28 |
| teacher seoyeon | America/Chicago | 오후 6:28 | 18:28 |

| 경로 | hydration 오류 |
|---|---|
| /student, /student?tab=classes (LA 시각 13:00 등 표시) | 0 |
| /parent, /parent?tab=lessons (NY 시각) | 0 |
| /teacher, /teacher?tab=lessons (Chicago 시각) | 0 |
| /session/[id] (위 3계정 모두) | 0 |

자동 테스트: `app/viewer-timezone.hydration.test.tsx`(서버 TZ=UTC renderToString → 브라우저 TZ=Asia/Seoul hydrate, 뷰어 LA; 학생 CreditsTab·학부모 ConsentTab·SessionShell), `app/components/ViewerTimezoneProvider.test.tsx`(훅 폴백/중첩, LA vs 서울 출력 차이), `lib/timezone.test.ts`(resolveViewerTimezone), 기존 `no-implicit-timezone-format.test.ts` 가드 유지.

미확인: 컨설턴트·관리자 포털 브라우저 실측(시드 컨설턴트 계정 없음, admin은 코드·타입만).
