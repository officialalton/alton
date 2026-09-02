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

## 다음 (미완료)

- 2/N: Google Calendar 인증(`getCalendarApiAccessToken()`, Directory/Drive와 동일 패턴) + 이벤트/
  Meet 생성 + FreeBusy 조회 + 실패 보상·재처리(`google_sync_status`) + 취소/재예약/선생님 변경 시
  동기화.
- 3/N: `sessions_v3`→`sessions`/`sessions`→`legacy_sessions` cutover(앱 코드 8개 파일 동시 전환) +
  `material_version_id` 채우기 로직.
- 4/N: 취소·지각·노쇼 판정 로직(consume/release/연장 30일 보장 규칙 포함), 보호자·학생 예약 UI,
  선생님·관리자 일정 관리 화면.
- 5/N: AI 회의록/Smart Notes 동의 게이트(신규 정책 테이블, `guardian_consents` 패턴 재사용) +
  Meet 대조.
- 6/N: 알림 outbox(그린필드) + 관리자 불일치 재처리 화면.
- 7/N: Calendly/Zoom 제거(신규 흐름 E2E 통과 후에만).
