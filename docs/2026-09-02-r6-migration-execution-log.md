# R6 실행 로그 (2026-09-02~)

R6 승인 스펙: `docs/2026-09-02-r6-scope-and-approval.md`(원문 그대로 확정 스펙). 이 로그는 R6 진행 중
실측 조사·구현·검증 내역을 남긴다. `docs/CURRENT.md`는 R6 종료 시 요약을 반영한다.

## 착수 전 조사 (2026-09-02)

- `sessions`(레거시)/`sessions_v3` 전체 컬럼·제약, `reservations`(R1에서 이미 구현된 겹침방지
  gist exclusion·`google_event_id`·`idempotency_key` 포함), entitlement ledger RPC
  (`hold_entitlement`/`consume_entitlement`/`release_entitlement`/`extend_entitlement` 등),
  Google 인증 체인(`lib/google-workspace-auth.ts`의 Vercel OIDC→WIF→impersonation→signJwt,
  Directory/Drive 스코프 기존 구현을 Calendar 스코프에 그대로 재사용 가능), consent 구조
  (`guardian_consents`/`consent_policy_versions`, immutable-except-revoke 패턴),
  `teacher_assignments`/`subject_enrollments`, `outbox`(존재하지 않음, 그린필드),
  `is_admin() OR current_user_has_capability(...)` 권한 패턴을 확인.
- 레거시 `sessions` 테이블은 8개 앱 코드 경로(교재/화이트보드/과제/리뷰, R8·R9 영역)가 아직
  실사용 중 — `sessions_v3`→`sessions`, `sessions`→`legacy_sessions` cutover는 이 경로들의
  테이블 참조를 전부 갱신해야 하는 별도 원자적 배치로 분리해 진행한다(스펙에서도 "앱 코드와
  함께 원자적으로" 요구).

## 1/N — 선생님 가용시간·버퍼·예약 확정 함수 (완료, 2026-09-02)

마이그레이션: `supabase/migrations/20260926000000_r6_availability_and_booking.sql`

구현:
- `teacher_availability_rules`(요일·로컬 시간·IANA timezone·유효기간), `teacher_availability_exceptions`
  (날짜별 blocked/available, 종일 또는 시간대 지정) — 둘 다 RLS(`teacher_id = auth.uid() or is_admin()
  or current_user_has_capability('manage_bookings')`).
- `booking_series`(주 1회 최대 8회 반복예약 묶음 메타데이터, RLS 활성화 — 최초 시도에서 advisor가
  RLS 누락을 잡아내 즉시 수정함). 각 회차는 독립 `reservations`/`sessions_v3`/entitlement hold로
  관리(스펙 요구사항 그대로).
- `reservations`에 `booking_series_id`/`series_occurrence_index`/`google_meet_link`/
  `google_sync_status`/`google_sync_error`/`google_sync_attempted_at` additive 컬럼.
- `sessions_v3`에 `smart_notes_status`/`smart_notes_meet_conference_record`/`late_start_minutes`/
  `makeup_minutes_generated` additive 컬럼(2/N 이후 단계에서 사용).
- 함수: `booking_buffer_minutes()`(15분 상수), `is_within_booking_window()`(24시간~8주),
  `is_teacher_slot_open()`(exception→rule 순서로 판정, `AT TIME ZONE`으로 DST 반영 로컬 요일/시각
  계산, Postgres 내장 tzdata에 위임), `violates_teacher_buffer()`(전후 15분 버퍼, 기존
  holding/confirmed 예약과 겹침만 검사 — 정확한 겹침 자체는 R1 `reservations_no_overlap` gist
  exclusion이 이미 하드 차단).
- `confirm_lesson_booking()` — SECURITY DEFINER, service_role 전용. 예약 window/open/buffer
  재검증(방어적 이중검사) → `reservations` insert(confirmed) → `sessions_v3` insert →
  `hold_entitlement()` 호출을 단일 트랜잭션으로 묶음. 실패 시 전체 롤백이라 어중간한 상태가
  남지 않음. Google Calendar/Meet 생성은 다음 단계에서 이 함수 **이후**에 붙이고, 실패해도
  예약 자체는 유효하게 유지한 채 `google_sync_status`로 재시도 추적(스펙의 "Google 생성 실패 시
  DB·수업권 hold가 어중간하게 남지 않도록" 요구를 반영한 설계).

검증(로컬 dev DB, `supabase db reset --local` 성공 확인 후 트랜잭션 스모크 테스트, rollback로 원복):
- Security advisor가 `booking_series` RLS 누락을 잡아 즉시 수정·재확인.
- `is_within_booking_window`: 24시간 이내(1시간 후) 예약 시도 → 정상 거부(`booking_window_violation`).
- `is_teacher_slot_open`: 규칙 등록 후 규칙 범위 내 슬롯 → `true`.
- `confirm_lesson_booking`: 정상 케이스 → reservation+session 생성, entitlement 10→9 hold 확인.
- 같은 선생님의 직후(10분 뒤) 슬롯 재예약 시도 → 버퍼 위반으로 정상 거부(`teacher_buffer_violation`).
- 위 세 실패 케이스 모두 함수가 예외로 롤백되어 부분 상태가 남지 않음을 확인(트랜잭션 전체 관찰).

## 2/N — Google Calendar/Meet 생성·FreeBusy·재처리 워커 (완료, 2026-09-02)

마이그레이션: `supabase/migrations/20260927000000_r6_calendar_sync_retry_count.sql`
(`reservations.google_sync_retry_count`, 1/N에서 만든 `google_sync_status` 재시도 카운트).

구현:
- `lib/google-workspace-auth.ts`: `signDelegatedAdminJwt()`에 `subjectEmailOverride` 파라미터
  추가 — Directory/Drive는 고정 `GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL`을 DWD subject로
  쓰지만, Calendar는 "그 수업을 맡은 선생님 본인"의 `teachers.workspace_email`(R2/R5에서 이미
  발급된 `@alton.education` 계정)을 subject로 삼아야 이벤트가 실제 그 선생님 캘린더에 생기고
  FreeBusy도 그 선생님 기준으로 조회된다. `getCalendarApiAccessToken(subjectEmail)`을 선생님별
  캐시(Map)로 추가.
- `lib/google-calendar.ts`(그린필드): `createCalendarEventWithMeet()`(conferenceData.createRequest.
  requestId=reservationId로 Google 쪽 자체 멱등 보장, `sendUpdates=none`·attendee 미포함 —
  실제 초대 메일 발송 없음, R6 스펙의 "실제 알림 미발송" 원칙과 일치), `patchCalendarEventTime()`
  (재예약/선생님변경용), `deleteCalendarEvent()`(404/410을 성공으로 취급해 멱등), `queryFreeBusy()`
  (DB 잠금과 "함께" 쓰는 이중 방어용 — 하드 차단은 여전히 `reservations_no_overlap`+1/N 버퍼
  검사가 담당). 전부 `CALENDAR_SYNC_ALLOW_REAL_CALLS=true`가 아니면 실제 API를 호출하지 않고
  명시 실패(R6 전용 최소권한 게이트, 기존 `WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS`/
  `DRIVE_ARTIFACTS_ALLOW_REAL_WRITES`와 동일한 안전 패턴 — 스펙이 요구한 "R6 전용 최소권한·
  기본 false 게이트 분리").
- `lib/booking/calendar-sync.ts`: `processPendingCalendarSyncs()` — R3 `processQueuedDriveArtifacts()`
  와 동일한 조건부 UPDATE 낙관적 잠금(claim) 패턴으로 `confirmed`이면서 아직 시작 전인 예약 중
  `google_sync_status IN (pending, failed)`인 건을 골라 이벤트+Meet 생성 시도. 성공 시 `synced`+
  `google_event_id`/`google_meet_link` 기록, 실패 시 재시도 카운트 증가(`failed`), 5회 초과 시
  `reconciliation_needed`로 전환(관리자 수동 개입 대상 — 6/N 운영화면에서 노출 예정). **중요:
  이 워커가 몇 번을 실패하든 `reservations`/`sessions_v3`/entitlement hold는 절대 건드리지
  않는다** — DB가 원본이므로 Calendar 쪽 산출물만 재시도 대상(스펙의 "Google 생성 실패 시 DB·
  수업권 hold가 어중간하게 남지 않도록" 요구를 그대로 구현). `cancelSyncedCalendarEvent()` —
  취소 흐름(4/N)이 호출할 삭제 헬퍼, `google_event_id`가 아직 없으면(Calendar 쪽에 아무것도
  안 만들어졌으면) 조용히 스킵.

검증: `lib/google-calendar.test.ts`(안전 게이트, requestId/sendUpdates/attendee 없음 검증, Meet
entry point 누락 에러, 404/410 멱등, FreeBusy 파싱 — 9건), `lib/booking/calendar-sync.test.ts`
(빈 후보, 성공 경로, race 스킵, retry_count 5→6 전환 시 reconciliation_needed, workspace_email
누락 처리, cancel 스킵/호출 — 8건) 신규 작성. 로컬 `supabase db reset` 성공, **전체 스위트
668건 통과**(회귀 없음), `tsc --noEmit` 클린. 원격 dev DB에 마이그레이션 반영 완료
(`npx supabase migration list --linked` local=remote 일치 확인).

## 다음 (미완료)

- 3/N: `sessions_v3`→`sessions`/`sessions`→`legacy_sessions` cutover(앱 코드 8개 파일 동시 전환) +
  `material_version_id` 채우기 로직.
- 4/N: 취소·지각·노쇼 판정 로직(consume/release/연장 30일 보장 규칙 포함), 보호자·학생 예약 UI,
  선생님·관리자 일정 관리 화면.
- 5/N: AI 회의록/Smart Notes 동의 게이트(신규 정책 테이블, `guardian_consents` 패턴 재사용) +
  Meet 대조.
- 6/N: 알림 outbox(그린필드) + 관리자 불일치 재처리 화면.
- 7/N: Calendly/Zoom 제거(신규 흐름 E2E 통과 후에만).
