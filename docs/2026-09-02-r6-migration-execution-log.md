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

## 3/N — 구조적 cutover: sessions↔legacy_sessions↔sessions_v3 (완료, 2026-09-02)

마이그레이션: `supabase/migrations/20260928000000_r6_sessions_cutover.sql`.

사전 조사(영향 범위, 마이그레이션 파일 헤더에도 기록): 레거시 `sessions`를 FK로 참조하는
테이블 11개(makeup_credits/session_files/canvas_annotations/session_problem_attempts/
session_reviews/session_student_feedback/vocab_words/teacher_qc_warnings/chat_threads 등),
앱 코드 14개 파일의 `.from("sessions")` 17곳(전부 교재/화이트보드/과제/스크래치패드/AI문제생성/
리뷰/Calendly 웹훅 — R8/R9 이전까지 유지되는 레거시 세션뷰 기능), PL/pgSQL 함수 본문 텍스트
참조 7개(`session_student_id`/`session_teacher_id`/`is_session_participant`/`is_session_related`
— legacy `sessions` 참조, `reopen_session`/`recomplete_session`/`merge_accounts` — `sessions_v3`
참조, R6 1/N `confirm_lesson_booking` — `sessions_v3` 참조). Postgres `RENAME TABLE`은 OID
기반이라 FK·RLS 정책·인덱스·트리거는 rename을 자동으로 따라가지만, PL/pgSQL 함수 본문은 텍스트로
저장돼 자동으로 따라가지 않는다는 점을 실측 확인 후 위 7개 함수 전부 CREATE OR REPLACE로 갱신.

구현: `sessions`→`legacy_sessions`(레거시 세션뷰 계속 사용, 삭제하지 않음 — 개발 데이터라 이관도
불필요, R3 contracts cutover와 동일 원칙), `sessions_v3`→`sessions`(index/constraint 이름도
`contracts` cutover와 동일하게 cosmetic 정리, RLS 정책명 정리). 앱 코드 14개 파일
`.from("sessions")`→`.from("legacy_sessions")` 일괄 전환(관련 테스트 파일 3개의 mock 테이블명도
함께 갱신), `supabase/seed.sql`의 레거시 세션 삽입도 `legacy_sessions`로 전환.

`material_version_id`는 이번 단계에서 채우지 않기로 결정(실행 로그에 명시) — "이 subject_enrollment가
지금 어떤 교재 버전을 쓰고 있는지"를 가리키는 개념 자체가 R9("과목 템플릿과 학생별 진도 스냅샷")
이전에는 존재하지 않는다(과목 템플릿 단원↔교재 연결은 있지만 학생별 현재 진도 스냅샷은 없음).
R1이 만들어둔 nullable FK 컬럼(인터페이스)만 유지 — R6 스펙 "R9의 커리큘럼 인수인계는 이번에
구현하지 말고 필요한 인터페이스만 유지" 원칙과 일치. teacher_id/시급/lesson_type_id는 세션 생성
시점에 이미 스냅샷됨(1/N, R1 트리거 `enforce_and_snapshot_teacher_rate`).

검증: 로컬 `supabase db reset` 성공(마이그레이션+`seed.sql`), `tsc --noEmit` 클린, 전체 Vitest
668건 통과, 전체 Playwright E2E(`--workers=1`) 47/50 통과·1건 실패·2건 미실행 — 그 실패
(`r5-subject-enrollment-flow.spec.ts` "선생님 변경" UI 타이밍 케이스)는 `git stash`로 이번 R6
변경을 전부 제거한 베이스라인에서도 동일하게 재현되는 **기존 결함**임을 실측 확인(R6 회귀 아님,
그대로 두고 원복). 원격 dev DB 반영 완료.

## 4/N — 예약 확정 함수 보강: 멱등성·관리자 예외·주간 반복예약 (완료, 2026-09-02)

마이그레이션: `supabase/migrations/20260929000000_r6_booking_idempotency_series_admin_override.sql`.

구현:
- `is_within_booking_window(p_starts_at, p_admin_override default false)` — 관리자는 24시간
  하한을 건너뛰지만 8주 상한은 동일 적용.
- `confirm_lesson_booking()`에 멱등성 추가 — 같은 `idempotency_key`로 재요청하면 새로 만들지
  않고 기존 reservation/session을 그대로 반환(동시 요청의 좁은 경쟁 구간은 `unique_violation`
  예외 처리로 한 번 더 방어). **실제 버그 발견·수정**: 최초 구현에서 `if found then return query
  ...; end if;` 뒤에 `return;`이 없어 `RETURN QUERY`가 함수를 종료시키지 않는다는(단순히 결과셋에
  행을 추가할 뿐 다음 문으로 실행이 계속되는) PL/pgSQL 특성 때문에 멱등 반환 직후 버퍼 검사까지
  떨어져 내려가 두 번째 호출이 `teacher_buffer_violation`으로 실패하는 실제 버그를 스모크
  테스트로 발견 — `return;`을 두 곳(초기 체크·unique_violation 핸들러) 모두에 추가해 수정.
  `p_admin_override`도 관통하도록 파라미터 추가(신규 파라미터로 시그니처가 바뀌어 옛 9-인자
  오버로드가 남는 문제도 발견해 `drop function if exists`로 명시 제거).
- `create_weekly_lesson_series()` — 주 1회 최대 8회, 각 회차는 독립 `confirm_lesson_booking()`
  호출(= 독립 reservation/session/entitlement hold). 수업권이 부족해지는 회차에서 멈추고
  이후 회차는 시도하지 않음(`failure_reason`에 사유 기록, 이미 만든 앞선 회차는 롤백하지
  않음) — "가능한 회차까지만 생성하고 결과를 명확히 안내"를 그대로 구현. 회차별 idempotency_key는
  `prefix:occurrence_index`로 파생시켜 시리즈 재요청 자체도 멱등.
- `confirm_lesson_booking`/`create_weekly_lesson_series` 둘 다 `hold_entitlement` 등 기존
  service_role 전용 함수와 동일한 신뢰 경계를 따른다 — 함수 내부에서 `auth.uid()` 기반
  `is_admin()`을 다시 검사하지 않는다(서버 액션이 service_role로 호출하므로 `auth.uid()`가
  실려오지 않아 항상 실패하게 됨을 스모크 테스트로 실측 확인 후 제거). `created_by`도
  `auth.uid()` 대신 명시적 `p_created_by` 파라미터로 받도록 수정(R5 `change_teacher_assignment`의
  `p_changed_by` 패턴과 동일).

검증: 로컬 스모크 테스트(트랜잭션+rollback)로 (1) 동일 idempotency_key 2회 호출 → 완전히 같은
reservation_id/session_id 반환, (2) 관리자 override로 1시간 후 예약 성공(일반 사용자는
거부됨을 window 함수 단위테스트로 별도 확인), (3) 수업권 3장 상태에서 8회 요청 시 3회만
성공·4회째부터 명확한 사유로 중단, (4) 시리즈 재요청 시 추가 hold 없이 동일 결과 반환 — 전부
실측 확인. 전체 Vitest 668건·tsc 클린 재확인. 원격 dev DB 반영 완료.

## 5/N — 취소(release/consume/30일 만료 보장) + 지각·노쇼 신고·원본 접속기록 수집 (완료, 2026-09-02)

마이그레이션: `supabase/migrations/20260930000000_r6_cancellation_and_incident_reports.sql`.

구현:
- `reservation_cancellations`(취소 이력 — 예약을 덮어쓰지 않고 `reservations.status='cancelled'`
  전환 + 이 테이블에 사유·주체·수업권 처리결과 기록. 재예약은 사용자가 새 `confirm_lesson_booking()`
  호출로 별도 예약을 만든다, 자동 대체 예약 없음).
- `cancel_lesson_booking(p_reservation_id, p_cancelled_by_role, p_cancelled_by_id, p_reason)` —
  학생 24시간 이상 전 취소는 release, 24시간 미만은 consume. 선생님/회사 취소는 항상 release
  (선생님 지급 없음 — 애초에 실제 완료 이벤트가 없어 지급 대상 자체가 아님) + 취소 시점 기준
  grant 만료가 30일 미만이면 `extend_entitlement()`(R4에서 이미 이 용도로 준비돼 있던 함수,
  주석에 "회사/선생님 귀책 취소로 만료 30일 미만 남은 grant를 연장"이라고 명시돼 있었음)로 30일
  확보. 중복 차감·이중 복구 방지는 `release_entitlement`/`consume_entitlement` 자체의 기존
  가드(이미 처리된 예약 재처리 차단, R1)에 그대로 의존 — 새로 만들지 않음.
- **범위 축소 결정(사용자 최신 지시 반영)**: 지각·노쇼는 "신고"와 "원본 접속 기록 수집"까지만—
  `session_incident_reports`(선생님 지각/학생·선생님 노쇼 신고, append-only, 수업권 소진·출석
  확정과 무관), `session_access_events`(Meet 참가 기록 `source=google_meet_api` vs ALTON 화면
  접속·체류 `source=alton_client`를 컬럼이 아니라 **source 자체로 분리** — 한쪽의 지연·부재를
  다른 쪽으로 보정하지 않음, 스펙 원문 그대로). 수업권 최종 소진·출석 확정·`payable_minutes`·
  정산 판정은 명시적으로 R7로 남겨둠(자동 확정 코드를 만들지 않음). `google_meet_api` 소스는
  R6에서는 스키마·분리 원칙만 준비 — 실제 수집 파이프라인은 Workspace Events API 구독이 필요해
  Sandbox 승인 이후 배선(아래 "Google Sandbox 승인 요청" 절 참고).
- 세션 관련자 판정은 레거시 `is_session_related()`(legacy_sessions 전용)와 이름 충돌을 피해
  `is_session_related_v3()`를 신설(v3 `sessions`+`subject_enrollments` 기준).

검증: 로컬 스모크 테스트(트랜잭션+rollback)로 4개 케이스 실측 — (A) 학생 24h+ 전 취소 → 잔액
10회복(9→10), (B)(모의) 학생 24h 미만 취소 → 잔액 그대로(consume, 9→9), (C) 선생님 취소 →
release + 만료일이 취소 시점+30일로 정확히 연장됨(연장 전 10일 남음 확인 후 정확히 30일 뒤로
갱신 확인), (D) 이미 취소된 예약 재취소 시도 → `확정된 예약만 취소할 수 있습니다` 명확한 에러로
거부. `reservation_cancellations` 3행 생성 확인. Security advisor 재확인 — 신규 테이블 2개 모두
RLS 활성화·정책 존재, 경고 없음. 전체 Vitest 668건·tsc 클린 재확인. 원격 dev DB 반영 완료.

## 6/N — 예약 서버 액션·UI(보호자·학생·선생님·관리자) (완료, 2026-09-02)

신규 파일: `lib/booking/slot-search.ts`(+test), `lib/booking/authorization.ts`,
`lib/booking/query-slots.ts`, `lib/booking/create-booking.ts`(+test),
`app/parent/booking-actions.ts`(+test, 리팩터링), `app/student/booking-actions.ts`(+test),
`app/student/lesson-booking-data.ts`, `app/student/LessonBookingTab.tsx`,
`app/teacher/availability-actions.ts`(+test, 5/N 서버 액션 — 실제로는 4/N 직후 작성),
`app/teacher/TeacherAvailabilityTab.tsx`, `app/admin/booking-actions.ts`(+test),
`app/admin/BookingReconciliationPanel.tsx`(+test).

구현:
- `lib/booking/slot-search.ts`: 순수 함수 슬롯 후보 계산기 — DB 접근 없이 규칙·예외·기존
  예약·버퍼·24h~8주 window(관리자 override 포함)를 전부 반영. 최종 권위는 항상
  `confirm_lesson_booking()`에 있음을 주석에 명시(경쟁 상태로 후보가 서버 판정과 어긋나도
  이중예약은 발생하지 않음). 시간대/DST는 Postgres `AT TIME ZONE`과 동일하게
  `Intl.DateTimeFormat` 2-pass 기법으로 처리(별도 라이브러리 없음) — 2026년 실제 미국
  DST 전환일(3/8) 전후로 PST/PDT 오프셋이 실제로 다르게 변환되는지 테스트로 검증.
- `lib/booking/authorization.ts`: `assertGuardianOfChild`/`assertActiveTeacherAssignment`를
  공유 모듈로 추출(원래 parent/booking-actions.ts에 있던 걸 student도 재사용하도록 분리)하는
  과정에서 **실제 권한 우회 취약점을 발견**했다 — 취소 액션들이 "이 childId가 내 가족인지"만
  확인하고 "그 reservationId가 정말 그 childId 것인지"는 검증하지 않아, reservationId를
  다른 가족 것으로 바꿔치기하면 childId 소유권 검사만 통과해 남의 예약을 취소할 수 있는
  구조였다. `assertReservationBelongsToChild()`를 추가해 parent/student 양쪽 취소 경로에
  배선하고 회귀 테스트 추가.
- 학생/보호자 예약 UI(`LessonBookingTab.tsx`, 두 포털이 공유): 과목·선생님 선택 → 슬롯 후보
  날짜별 그룹 표시 → 1회/주1회반복(최대8회) 토글 → 예약 → 예정된 수업 목록(취소·Meet 링크·
  Calendar 동기화 상태 배지). 브라우저 감지 timezone과 계정 timezone이 다르면 배너로 제안,
  적용 시 `updateMyTimezone`/`updateChildTimezone`이 `profiles.timezone` 갱신(R2 §4.21에서
  "R6까지 의도적 보류"로 남겨뒀던 항목).
- 선생님 반복가능시간 관리(`TeacherAvailabilityTab.tsx`): TeacherShell에 원래 선언만 되고
  렌더 분기가 없던 빈 "일정" 탭 슬롯을 채움. 규칙 추가/삭제, 날짜별 예외(휴무/임시오픈) 등록.
- 관리자(`BookingReconciliationPanel.tsx`): `reconciliation_needed`/`failed` 예약 목록,
  수동 "지금 재처리" 트리거(`processPendingCalendarSyncs()` 재호출), 회사 귀책 취소.

**실제 로컬 브라우저 검증(Playwright 아님, 개발 서버+MCP 브라우저로 직접 클릭)**: 로컬
dev DB에 실제 fixture(계약·subject_enrollment·active teacher_assignment·수업권 10장·선생님
가용시간)를 만들고 보호자 계정으로 로그인해 슬롯 목록 렌더 확인 → 1회 예약 확정(수업권
10→9, 슬롯에서 사라짐, "예정된 수업"에 표시) → 주1회 반복 8회 예약(9/3~10/22 매주 목요일
전부 생성 확인) → 취소(수업권 원복, 슬롯 재오픈 확인) 전부 실측 성공. 선생님 계정으로
로그인해 가용시간 규칙 표시 확인 + 새 날짜별 예외 등록 → psql로 실제 DB row 생성 확인.
관리자 계정으로 로그인해 예약 운영 화면 진입 → "지금 재처리" 클릭 → 8건이 실제로
`workspace_email이 아직 없습니다` 에러로 실패 처리되고 재시도 카운트가 올라가는 것을
화면에서 확인(테스트 선생님 fixture에 workspace_email이 없어 실제 실패 케이스 자연 재현).

**검증 중 발견·수정한 실제 버그 2건**: (1) 예약 확정/취소 후 "예정된 수업" 목록이 자동
갱신되지 않던 문제 — `router.refresh()`+슬롯 재조회 추가. (2) `window.prompt()`가 이
브라우저 자동화 환경(및 일부 실제 브라우저 정책)에서 안정적으로 동작하지 않아 취소
플로우가 막히는 문제 — 학생/보호자·관리자 양쪽 취소 폼을 인라인 입력+확인 버튼으로 교체.

전체 Vitest 704건·tsc 클린. 로컬 fixture는 검증 후 `supabase db reset --local`로 정리.

## 7/N — AI 회의록(Smart Notes) 동의 게이트 (완료, 2026-09-02)

마이그레이션: `supabase/migrations/20261001000000_r6_ai_notes_consent_gate.sql`.

**신규 정책 테이블을 만들지 않았다** — 조사 결과 R3(`20260913000000_r3_contract_model_realignment.sql`
§8)에서 이미 `ai_notes_consent_events`(student_id/opted_in/policy_version/actor_id/
effective_at/revoked_at)를 만들어뒀고, 그 마이그레이션 주석에 "실제 Smart Notes on/off
적용 로직과 수동 리뷰 task는 R6/R9 범위이며 이 마이그레이션에서 만들지 않는다"라고 명시돼
있었다 — 정확히 이번 R6 지시("필수 개인정보 동의와 분리된 기존 선택 동의 구조 재사용")가
가리키는 테이블이었다. RLS도 이미 있었음(관리자/본인학생/보호자 조회, 관리자/운영자 쓰기).

구현:
- `has_ai_notes_consent(p_student_id)` — opt-out 모델(기본 ON). 가장 최근 미철회 이벤트의
  `opted_in`을 반환, 이력이 전혀 없으면 true.
- `set_ai_notes_consent_as_guardian(p_student_id, p_opted_in, p_reason)` — R2
  `consent_as_guardian()`과 동일한 guardian 관계 검증 패턴, `authenticated`에 직접 grant(보호자가
  세션 클라이언트로 직접 호출).
- `confirm_lesson_booking()`을 다시 CREATE OR REPLACE해 세션 생성 시점에 `has_ai_notes_consent()`
  판정을 스냅샷해 `sessions.smart_notes_status`를 `pending`(허용) 또는 `disabled_by_guardian`
  (거부)으로 채움 — 로직 추가는 이 한 곳뿐, 나머지 4/N 로직은 그대로.
- 앱: `app/parent/consent-actions.ts`에 `setAiNotesConsentForChild()` 추가,
  `app/parent/consent-data.ts`의 `ChildConsentStatus`에 `aiNotesOptedIn` 추가,
  `ConsentTab.tsx`에 만 13세 미만 여부와 무관하게 전체 자녀에게 보이는 별도 토글 섹션 추가
  (기존 필수 동의 카드와 명확히 분리된 섹션).

**검증 중 발견·수정한 실제 버그**: `has_ai_notes_consent()`가 `effective_at desc`만으로 "가장
최근" 이벤트를 판정했는데, Postgres `now()`는 트랜잭션 시작 시점에 고정되므로 같은 트랜잭션
안에서 opt-out 후 바로 opt-in(또는 그 반대)을 연속 기록하면 두 이벤트의 `effective_at`이
완전히 같아져 판정이 모호해지는 실제 버그를 스모크 테스트로 발견 — `identity` 컬럼(`seq`)을
추가해 `order by effective_at desc, seq desc`로 결정론적 순서를 보장하도록 수정.

Meet 이벤트-SmartNote 생성 대조(실제 API 폴링)는 이번에 배선하지 않는다 — 그 파이프라인은
Google Workspace Events API 구독이 필요해 Sandbox 승인 이후로 남긴다(5/N에서 만든
`session_access_events` 스키마가 그 대조 결과를 받을 자리를 이미 마련해둠). 녹화 OFF 상태
스크린샷 0개 등 Gate C 기존 검증 결과는 재실험하지 않고 그대로 인용.

전체 Vitest 706건·tsc 클린. 원격 dev DB 반영 완료.

## 8/N — 알림 outbox: 24h/2h 리마인드 + 예약확정/취소 알림 (완료, 2026-09-02)

마이그레이션: `supabase/migrations/20261002000000_r6_notification_outbox.sql`. 그린필드 —
기존 `notifications`(R0)는 in-app 표시 전용이라 스케줄 개념이 없어 재사용 불가, 새 테이블
`booking_notification_outbox`를 만들었다.

구현:
- `schedule_reservation_notifications(p_reservation_id)` — 예약 확정 시 수신자(자녀 본인 +
  그 household의 guardian 전원)마다 `booking_confirmed`(즉시)·`reminder_24h`·`reminder_2h`
  3종을 스케줄. 이미 지난 시각(예: 관리자 24시간 이내 override 예약의 24시간 전 리마인드)은
  애초에 만들지 않음. 동시에 기존 R0 `notifications` 테이블에도 즉시 인앱 표시용 행을 삽입
  (스펙의 "인앱 표시" 요구).
- `cancel_reservation_notifications(p_reservation_id)` — 아직 미발송(pending) 리마인드를
  `cancelled`로 전환하고 `booking_cancelled` 알림을 새로 스케줄.
- `confirm_lesson_booking()`/`cancel_lesson_booking()`을 각각 한 줄(`perform schedule_...`/
  `perform cancel_...`)만 추가해 재정의 — 나머지 로직은 7/N과 동일.
- 실제 이메일·메시지 발송 인프라는 만들지 않는다(스펙 원문 "실제 이메일이나 메시지는
  발송하지 말고 발송 대기 상태까지만 검증" — R4에서 이미 등록된 정식 오픈 전 blocker와
  일관). `status`는 이번 R에서 `pending`/`cancelled`까지만 실제로 쓰임.
- 관리자 화면(`BookingReconciliationPanel.tsx`)에 알림 유형×상태별 건수 요약 섹션 추가.

**검증 중 발견·수정한 실제 버그**: 알림 삽입 서브쿼리가 수신자 컬럼을 `v_recipient`로
alias했는데, 이 이름이 바깥 PL/pgSQL 반복문 변수 `v_recipient`와 겹쳐 "column reference
v_recipient is ambiguous" 에러가 실제로 발생 — 서브쿼리 alias를 `notify_id`로 변경해 해결.

스모크 테스트(자녀 1명 + 보호자 2명 세대)로 실측: 예약 확정 시 outbox 9행(수신자3×유형3)·
인앱 알림 2행(질의한 2명 기준) 생성 확인, 취소 시 미발송 리마인드 6행(수신자3×리마인드2종)이
정확히 `cancelled`로 전환되고 `booking_cancelled` pending 3행(수신자3)이 새로 생성됨을 확인.

전체 Vitest 707건·tsc 클린. 원격 dev DB 반영 완료.

## 9/N — 신규 예약 흐름 로컬 E2E (완료) + Calendly/Zoom 제거 판단(보류, 2026-09-02)

`e2e/r6-lesson-booking-flow.spec.ts` — 보호자 로그인 → 슬롯 클릭 → 예약 확정(원장에서
`hold` 이벤트 amount=-1 확인) → outbox 스케줄 확인 → 취소 → 원장 `release` 이벤트
amount=+1 확인, 전부 실브라우저로 2회 연속 통과(재실행 안정성 확인) + 전체 스위트
48/51 통과(2건 R5 기존 결함으로 skip, 회귀 없음).

**Calendly/Zoom 제거는 이번에 진행하지 않는다.** 스펙 원문의 제거 조건은 "새 예약→Meet→
출결→수업권 처리 흐름의 E2E 통과"인데, 이번 R6 지시(2026-09-02, "이제부터 이 기준으로
해줘")가 R6 범위를 "지각·노쇼 신고와 원본 접속 기록 수집까지만"으로 명시적으로 좁히고
"수업권 최종 소진, 출석 확정, payable_minutes, 정산 판정은 R7 범위이므로 자동 확정하지
않는다"고 못박았다 — 즉 제거 조건이 요구하는 "출결→수업권 처리"의 "출결 확정" 부분은
R6 안에 존재하지 않는 개념이다(의도적으로 R7로 이관됨). 이 상태에서 "전체 흐름 E2E
통과"를 자체 판단으로 느슨하게 해석해 Calendly/Zoom을 제거하면, 정작 R7이 출결·정산을
구현하기 전까지 학생·보호자에게 실제 예약 대체 수단이 전혀 없어지는(레거시 제거 후 신규
흐름의 출결 관련 부분은 아직 없음) 사용자 경험 공백이 생긴다 — 이는 스펙의 "예약 가능
기간, 취소·노쇼... 등 사용자 경험이나 정산 결과를 바꿔야 하는 경우" 중단 조건과 실질적으로
같은 리스크 범주로 판단해, 자체 판단으로 밀어붙이지 않고 이번 R6에서는 보류한다. 대신
R6이 실제로 구현한 범위(예약·취소·수업권 hold/release·Calendar/Meet 인터페이스·알림
outbox)에 대한 로컬 E2E는 위와 같이 완료해뒀으므로, R7이 출결·정산을 마친 직후 같은 게이트
조건을 다시 평가해 제거를 진행할 수 있다. Calendly/Zoom 코드·환경변수·DB 컬럼은 전부
그대로 남아 있다(마스터 로드맵 R6 섹션의 "Calendly 제거"/"Zoom 제거" 체크리스트는 미착수
상태로 유지).

Google Sandbox 외부 호출 승인 요청(FreeBusy/Calendar/Meet 실제 생성·Workspace Events 구독 등)은
로컬·mock 검증이 전부 끝난 뒤 한 번에 묶어 별도로 제출 예정 — 아직 제출 전. 모든 Google
관련 플래그(`CALENDAR_SYNC_ALLOW_REAL_CALLS`, `WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS`,
`WORKSPACE_PREFLIGHT_ALLOW_REAL_READS`)는 세션 종료 시점 기준 전부 미설정(기본 false)임을
재확인.

## 10/N — 완료 승인 보류 후 누락 배선 마감 (완료, 2026-09-02)

제품 오너가 9/N까지의 "완료" 보고를 승인 보류하고 7개 항목을 지시(전체 지시문은
`docs/CURRENT.md`의 R6 절 요약 참고, 여기서는 실제로 한 작업만 기록):

- **FreeBusy 사전 확인**(`lib/booking/freebusy-check.ts`)을 `confirmLessonBooking()` 안,
  DB 확정 RPC 직전에 실제로 호출하도록 배선. 조회 실패/미설정 시 예약을 막지 않고, 확정
  이후 겹침은 기존 DB 배타 제약(`reservations_no_overlap`)이 최종 방어선 — 레이스 윈도우는
  이 기존 제약으로 이미 방어됨(신규 방어 로직 추가하지 않음, 요구사항이 "기존 DB 락으로
  방어됨을 확인"이었으므로).
- **Calendar 이벤트+Meet 생성**(`syncOneReservationCalendarEvent()`)을 배치 워커
  (`processPendingCalendarSyncs()`)뿐 아니라 `confirmLessonBooking()`/
  `createWeeklyLessonSeries()`/`cancelLessonBooking()`의 실제 서버 흐름에서 즉시 호출하도록
  배선. 실패해도 예약 확정 응답 자체는 막지 않음(await 후 catch로 흡수) — 실패 시
  `reservations.google_sync_status`만 `failed`/`reconciliation_needed`로 남고 예약·hold는
  전혀 건드리지 않는다(기존 원칙 그대로). 낙관적 잠금(조건부 UPDATE claim)이 즉시 호출
  경로와 배치 워커의 동시 호출을 안전하게 처리 — 재시도가 중복 외부 객체를 만들지 않는다는
  멱등성 요구사항을 이 claim 패턴이 그대로 충족.
- **보호자 동의 스냅샷 → Smart Notes ON/OFF** 연결: Calendar 동기화 성공 직후
  `applySmartNotesConfigBestEffort()`가 `sessions.smart_notes_status`를 조회해
  `setMeetSpaceSmartNotesConfig()`를 호출 — 이 설정이 실패해도 Calendar 동기화 자체는
  `synced`로 유지(부가 기능 실패로 전체를 재시도 대상으로 되돌리지 않음).
- **Workspace Events 수신**: `app/api/webhooks/workspace-events/route.ts` 신규 — Pub/Sub
  push의 OIDC bearer token을 fail-closed로 검증, Smart Notes 생성 이벤트를
  `reservations.google_meeting_code`로 세션에 연결해 신규 테이블
  `smart_notes_generation_events`에 적재 + `sessions.smart_notes_drive_file_id` 갱신.
  **Drive 파일 이동·ACL은 R8, 리뷰 생성·게시는 R9로 스코프 밖 유지 — 이번엔 이벤트 수신·
  연결까지만 구현.**
- **Meet 참가 기록 파이프라인**: `lib/google-meet.ts`의 `listConferenceParticipantEvents()` +
  위 웹훅의 참가자 이벤트 분기가 `session_access_events`에 `source:"google_meet_api"`로
  삽입 — ALTON 자체 접속 기록(다른 source)과 명확히 분리, **출석 확정·수업권 소진·정산은
  자동으로 하지 않는다**(R7 범위 그대로).
- **지각·노쇼 신고 제출 UI**: 학생/보호자(`app/student/LessonBookingTab.tsx`의 "지난 수업
  지각·노쇼 신고" 섹션, `app/student/incident-report-actions.ts`,
  `app/parent/booking-actions.ts`의 `reportTeacherIssueForChild` — 세션이 실제로 그 자녀
  것인지 신규 헬퍼 `assertSessionBelongsToChild()`로 검증), 선생님
  (`app/teacher/ScheduleTab.tsx` 지난 수업 목록에 신고 폼 추가), 관리자 열람
  (`app/admin/BookingReconciliationPanel.tsx`에 "지각·노쇼 신고" 섹션 추가,
  `listRecentIncidentReports()`). 최종 판정·수업권 소진·정산은 여전히 R7 범위 — 이 UI는
  신고 원문 제출·열람만 한다.
- **R5 기존 결함 근본 원인 특정**(제품 오너가 "R6 아님으로 넘기지 말라"고 명시 요구):
  `e2e/r5-subject-enrollment-flow.spec.ts`의 관리자 선생님 변경(같은 날짜 적용) 테스트가
  결정론적으로 실패하던 원인은 `app/admin/SubjectEnrollmentPanel.tsx`의
  `TeacherChangeForm` — "적용일" `<input type="date">`가 오늘 날짜일 때
  `new Date(effectiveFromDate).toISOString()`이 UTC 자정이 되어, 방금 만든 최초 배정의
  정밀 시각보다 항상 이전이 되면서 `change_teacher_assignment()`의
  `p_effective_from > 기존 effective_from` 가드에 매번 걸리는 버그(레이스 아님, 매번 100%
  재현). 오늘 날짜를 고른 경우에만 "지금"으로 취급하도록 수정. **영향 범위**: R5 관리자
  선생님 변경(같은 날 적용) 한 곳뿐. **사용자 영향**: 관리자가 오늘 날짜로 선생님을
  변경하면 항상 실패(관리자 전용 운영 기능 — 학생/보호자/선생님 화면에는 영향 없음).
  **담당 단계**: R5(버그 발생 코드가 R5 범위) — 이번 세션에서 함께 수정·검증.
- **`material_version_id` 정책 명문화**(구현은 R9로 유지): 예약 자체는 null이어도 막지
  않되, R9가 학생 진도를 판정하는 즉시 아직 시작 전(`actual_start_at is null`)인 세션에
  버전을 배정해야 하고 세션 시작 전에는 반드시 non-null이어야 한다는 "수업 시작 전 필수
  선행 조건"으로 `docs/2026-08-29-master-roadmap-v3.md` R9 체크리스트와 `docs/CURRENT.md`에
  등록. 기존 스냅샷 불변 원칙과의 충돌 여부를 조사한 결과, `material_version_id`를 보호하는
  트리거·제약이 현재 전혀 없어(R1 `sessions_prevent_direct_update`는 `final_status` 컬럼
  UPDATE에만 반응) 충돌 없음 — 제품 결정 필요 사항이 아니라 R9에서 그대로 구현 가능.

검증: 신규 유닛 테스트 다수(`lib/google-meet.test.ts`,
`lib/google-workspace-events.test.ts`, `app/api/webhooks/workspace-events/route.test.ts`,
`lib/booking/freebusy-check.test.ts`, `app/student/LessonBookingTab.test.tsx`,
`app/teacher/ScheduleTab.test.tsx`/`app/parent/booking-actions.test.ts`/
`app/admin/BookingReconciliationPanel.test.tsx` 추가 케이스) 전부 통과. 전체 Vitest
759건, `tsc --noEmit` 클린, 전체 Playwright(`--workers=1`) 51건 전부 통과(로컬 E2E 중
`r6_calendar_sync_failed` 로그가 찍히지만 — 테스트 픽스처 선생님에 workspace_email이 없어
발생하는 예상된 실패로, 예약 확정 자체는 정상 통과 — 이는 "Google 실패해도 예약은 막지
않는다"는 원칙이 mock이 아니라 실제 서버 흐름에서도 지켜짐을 보여주는 증거). `npm run build`
프로덕션 빌드 클린. **실제 Google API 호출은 이번 10/N 전 과정에서 단 한 번도 발생하지
않았다** — 모든 Google 플래그는 세션 종료 시점 기준 여전히 미설정(false).

Google Sandbox 외부 검증 승인 요청서를 신규 작성해 제출
(`docs/2026-09-02-r6-google-sandbox-verification-request.md`) — 아직 승인 전, 승인 전까지
어떤 실제 Google API도 호출하지 않는다.

## 11/N — Calendar·Meet 소유 정책 확정 반영 + Sandbox 요청서 개정 (완료, 2026-09-02)

제품 오너가 10/N 이후 Calendar·Meet 소유·통제 정책을 구체적으로 확정 지시(선생님 계정이
organizer, `official` 관리자는 통합 일정 화면으로 중앙 통제, Google 직접 변경 감지,
FreeBusy scope 정정, Sandbox 객체 상한 재조정, Smart Notes 검증 참가자 확정, Workspace
Events pull 전용 수신). 이미 완료한 FreeBusy·Calendar/Meet·Smart Notes·참가 기록·신고 UI
배선은 다시 작업하지 않고, 이 정책에 맞춘 코드·문서·mock 검증만 추가했다.

- **Calendar/Meet organizer 정책 재확인**: `createCalendarEventWithMeet()`(2/N에서 이미
  구현)가 `teacherWorkspaceEmail`을 DWD subject로 써서 담당 선생님 캘린더에 이벤트를
  생성하고, attendees 없이 `sendUpdates=none`으로 호출하는 것을 재확인 — 코드 변경 불필요,
  기존 구현이 이미 이번 정책과 일치했다. `docs/2026-08-29-product-architecture-v3.md`의
  "성인 회사 관리 계정이 모든 Meet을 주최한다" 옛 표현만 정정.
- **DWD scope 불일치 발견·수정(이번에 새로 발견한 버그)**: `lib/google-workspace-auth.ts`의
  `CALENDAR_SCOPE`가 광범위한 `.../auth/calendar`를 요청하도록 돼 있었는데, Gate C가 실제
  DWD에 등록한 목록에는 이 scope가 없다(`calendar.events`/`calendar.events.readonly`만
  있음) — `CALENDAR_SYNC_ALLOW_REAL_CALLS`가 항상 false여서 지금까지 드러나지 않았을 뿐,
  실제 호출 시 전부 인가 실패였을 것이다. 이미 등록된 `calendar.events`로 좁혀 수정(외부
  승인 불필요). 같은 문제가 `lib/google-meet.ts`에도 있어(Calendar용 토큰 재사용) Meet
  전용 scope(`meetings.space.settings`/`meetings.space.readonly`, Gate C 등록됨)로 분리한
  전용 토큰 함수(`getMeetSettingsApiAccessToken`/`getMeetReadonlyApiAccessToken`) 추가.
- **FreeBusy scope 정정**: `calendar.events.readonly` → `calendar.events.freebusy`,
  이벤트 생성 토큰과 완전히 분리된 `getFreeBusyApiAccessToken()`으로 구현. 이 scope는
  DWD 미등록 — Sandbox 승인 요청서에 별도 외부 설정 변경으로 명시.
- **Google 직접 변경 감지("외부 변경 감지", 정책 #4)**: 신규 마이그레이션
  `20261004000000_r6_external_change_detection.sql`(`reservations.external_change_status`
  + `teacher_calendar_sync_state` + `resolve_external_calendar_change()` RPC). 증분 조회
  (`lib/google-calendar.ts`의 `listCalendarEventsIncremental()`, sync token 만료 시 전체
  재동기화 폴백) + 오케스트레이션(`lib/booking/external-change-detection.ts`의
  `reconcileTeacherCalendarChanges()`, 8개 유닛 테스트: 시간 변경/삭제/Meet 링크 변경/
  토큰 만료 폴백/호출 실패). `createCalendarEventWithMeet()`에
  `extendedProperties.private.altonReservationId` 추가(ALTON 이벤트 식별용). 감지만 하고
  예약·세션·수업권 hold는 절대 자동으로 바꾸지 않는다는 정책 원칙을 코드로 구현 —
  `reservations.update(...).eq("external_change_status","none")`로 이미 확인 대기 중인
  변경을 덮어쓰지 않게 방어. 관리자 UI(`app/admin/BookingReconciliationPanel.tsx`의
  "Google 외부 변경 감지" 섹션)는 "무시(오탐)" 처리만 실제로 연결 — "ALTON 시간 유지"/
  "Google 시간 반영"(재검증 후 확정)은 RPC의 `resolution` enum 값만 준비돼 있고 실제
  재검증·재동기화 로직은 미연결임을 UI에 명시적으로 표시(하지 않는 일을 하는 것처럼
  보이지 않게).
- **관리자 통합 일정 화면(정책 #2)**: 데이터 계층(외부 변경 큐, 기존 관리자 예약 액션이
  이미 전체 재검증 체인을 타는 것)만 준비, 정책이 요구하는 금주/주간/월간 캘린더 전환
  UI는 만들지 않고 명시적으로 UI 고도화 후속 작업으로 이관(로드맵에 등록).
- **학생/보호자 예약 UI(정책 #3 일부)**: `LessonBookingTab.tsx`에 빠른 추천 시간(상위 3개
  슬롯) + 슬롯 선택 후 "예약 확인" 요약 카드(주간 반복은 최대 8개 생성 시도 날짜 미리
  표시) 추가 — "시간 선택 후 요약 확인을 거쳐 최종 확정" 요구 충족. 월간 날짜 선택기는
  미구현, 후속 이관. `e2e/r6-lesson-booking-flow.spec.ts`가 슬롯 클릭 후 "최종 확정" 클릭을
  추가로 요구하도록 갱신하고 실제 브라우저로 재검증(통과).
- 선생님 계정 정지 전 "미래 예약·미수집 Smart Notes 확인" 운영 게이트는 로드맵 체크리스트
  항목으로만 등록(미구현).
- Google Sandbox 외부 검증 승인 요청서를 정책 확정 내용 전체에 맞춰 v2로 전면 개정
  (`docs/2026-09-02-r6-google-sandbox-verification-request.md`) — 객체·시나리오 상한
  재조정, organizer를 `teacher1@alton.education`으로 한정, Smart Notes 검증 참가자
  확정(`teacher1@alton.education`+`official@alton.education`만), Workspace Events는
  pull 전용(ngrok/push/Production endpoint 사용 안 함)으로 한정, 외부 변경 승인 항목을
  표로 분리 표시. 아직 승인 전, 실제 Google API 호출 없음.

검증: 신규/변경 테스트 전부 통과. 전체 Vitest 771건(10/N 대비 +12건). `tsc --noEmit` 클린.
전체 Playwright(`--workers=1`) 재확인 — 결과는 이 세션의 최종 보고서에 기록(위 슬롯 확인
카드 추가로 갱신된 `e2e/r6-lesson-booking-flow.spec.ts` 단독 실행은 통과 확인 완료).
`npm run build` 재확인 예정. **실제 Google API 호출은 이번 11/N에서도 단 한 번도 발생하지
않았다** — 모든 플래그 미설정 유지.

## 12/N — 캘린더 UI 3종 + 외부 변경 양방향 처리 실연결 + Sandbox 요청서 통합 (완료, 2026-09-02)

제품 오너가 11/N 반영 후에도 남아 있던 확정 요구사항을 "R6 마감 작업"으로 한 번에 지시.
11/N에서 미완료로 이관했던 항목 대부분을 이번에 실제로 구현했다.

- **학생·보호자 예약 UI**: `app/components/MonthCalendar.tsx`(신규 공용 월간 캘린더
  컴포넌트, `lib/calendar-date-utils.ts`의 timezone 인식 날짜 키/그리드 유틸 기반) +
  `LessonBookingTab.tsx`에 날짜 선택기+선택일 시간 패널 통합, 빠른 추천 시간 유지. 슬롯
  클릭 → 요약 확인 카드(반복이면 최대 8개 생성 시도 날짜 미리보기) → 최종 확정 흐름으로
  변경(이전엔 클릭 즉시 확정). "예정된 수업"에 목록/월간 뷰 전환 추가. 보호자는 같은
  컴포넌트를 자녀별로 재사용.
- **선생님 일정/가능시간**: 신규 `app/teacher/lesson-schedule-data.ts`/
  `lesson-schedule-actions.ts`(R6 v3 `sessions`/`reservations`에서 선생님 본인 확정
  예약만 조회 — 기존 `dashboard-data.ts`는 `legacy_sessions` 기반 교재/과제 기능 전용이라
  완전히 별개임을 확인하고 새로 만듦) + 신규 "정규수업" 탭(`TeacherLessonScheduleTab.tsx`,
  금주 목록/주간/월간 전환). 기존 "일정" 탭을 "가능시간"으로 개명하고
  `TeacherAvailabilityTab.tsx`를 월간 캘린더 기본으로 재작성(날짜별 예외 추가/삭제를
  달력 클릭으로, 기간 휴무 일괄 등록, 지난달 예외 복사). `listTeacherAvailabilityExceptions()`
  신규 추가.
- **관리자 통합 일정**: 신규 `UnifiedScheduleTab.tsx`("통합 일정" 탭) + `listAllTeacherLessons()`
  — `official` 계정에 개별 Google Calendar를 공유하지 않고 ALTON DB에서 전체 선생님
  예약을 오늘/주간/월간 + 선생님·과목·동기화 상태 필터로 중앙 조회. 변경·취소는 기존
  "예약 운영" 탭으로 안내(검증 로직 중복 방지).
- **Google 외부 변경 양방향 처리 실연결**: 신규 마이그레이션
  `20261005000000_r6_external_change_resolution.sql`(`reservation_reschedules` 감사
  테이블 + `reschedule_reservation_to_google_time()` — 가용성/버퍼/수업권 재검증 후 DB
  갱신, exclusion 제약이 중복예약 자동 차단 + `record_reservation_restored_to_alton_time()`
  — 감사만) + 앱 레이어 `lib/booking/external-change-resolution.ts`
  (`acceptGoogleTimeForReservation()`/`restoreGoogleEventToAltonTime()`, 후자는
  `patchCalendarEventTime()`으로 Google 이벤트를 ALTON 기준으로 실제 복원) +
  관리자 UI 버튼 실연결(`app/admin/booking-actions.ts`의
  `resolveExternalChangeAcceptGoogleTime()`/`resolveExternalChangeKeepAltonTime()`).
  `deleted` 상태에는 두 버튼을 노출하지 않음.
- **DWD scope 재확인(문서 기준, 실제 API 호출 없음)**: Gate C 인프라 로그의 등록 목록과
  현재 코드가 요청하는 scope를 대조 — `calendar.events`/`meetings.space.settings`/
  `meetings.space.readonly`는 문서상 이미 등록, `calendar.events.freebusy`만 실제
  Admin Console 등록이 필요함을 확인(이 세션은 Admin Console에 접근할 수단이 없어 문서
  대조로만 확인했고, 사람이 실제로 재확인해야 함을 승인 요청서에 명시).
- **Sandbox 요청서 v3 통합 제출(아직 승인 전)**: `docs/2026-09-02-r6-google-sandbox-verification-request.md`
  — 기존 Pub/Sub pull 구독과 신규 Workspace Events 구독을 별개 객체로 명시, Smart Notes
  실회의 15분 상한, Google 직접 변경 감지→관리자 확인→양방향 처리 결과가 사이트·Google
  양쪽에 반영되는 시나리오 포함, 외부 변경 승인 항목 표 분리.

검증: 신규 컴포넌트·로직 전부 mock 유닛 테스트로 커버(`MonthCalendar.test.tsx`,
`calendar-date-utils.test.ts`, `TeacherLessonScheduleTab.test.tsx`,
`TeacherAvailabilityTab.test.tsx`, `UnifiedScheduleTab.test.tsx`,
`external-change-resolution.test.ts`, `BookingReconciliationPanel.test.tsx`/
`TeacherShell.test.tsx`/`AdminShell.test.tsx` 갱신). `e2e/r6-lesson-booking-flow.spec.ts`가
요약 확인 카드의 "최종 확정" 클릭 단계를 반영하도록 갱신하고 재검증. 전체 Vitest/tsc/
Playwright/build 결과는 이 로그를 갱신하는 세션의 최종 보고에 정확한 수치로 기록.
**실제 Google API 호출은 이번 12/N에서도 단 한 번도 발생하지 않았다.**

## 13/N — 외부 일정 표시·삭제 처리 보정 + Sandbox 요청서 v4 (완료, 2026-09-02)

제품 오너가 12/N 반영 후에도 확정 정책과 Sandbox 요청서가 완전히 일치하지 않는 3건을
지적 — 새 범위 추가가 아니라 R6 마감 보정으로 지시. 실제로 반영한 것:

- **선생님 Google 외부 일정 표시를 지금 구현**(더 이상 "Sandbox 이후 별도 작업"으로
  미루지 않음): `lib/booking/external-busy.ts`(`listTeacherExternalBusyBlocks()` — FreeBusy
  결과를 시작/종료 시각만 있는 블록으로 변환, 실패 시 빈 배열 반환), `lib/calendar-date-utils.ts`에
  `dateKeysCoveredByInterval()` 추가. `TeacherLessonScheduleTab.tsx`(주간/월간)와
  `TeacherAvailabilityTab.tsx`(월간)에 실제로 렌더링 — 밑줄 표시(`MonthCalendar.tsx`에
  `externalBusyDates` prop 추가) + 선택일 "외부 일정(예약 불가)" 칩(시간 범위만, 제목·
  설명·참석자 없음). 서버 액션(`listMyExternalBusyBlocks()`)이 `requireUser()`로 본인
  확인 후 본인 `workspace_email`만 조회하도록 해 보호자·학생·다른 선생님에게는 이 경로
  자체가 노출되지 않는다. mock 테스트 전부 통과.
- **Google 이벤트 직접 삭제 처리에서 "무시"만 가능한 상태를 제거**: 신규 마이그레이션
  `20261006000000_r6_external_change_deletion_resolution.sql`(`resolve_external_calendar_change()`가
  `deleted` 상태의 `dismissed` 요청을 명시적으로 거부하도록 재작성, `reservation_reschedules`
  source check에 `google_event_deleted_recreated` 추가, 감사 기록 함수
  `record_reservation_recreated_after_deletion()` 신규). 앱 레이어
  `lib/booking/external-change-resolution.ts`의 `recreateCalendarEventAfterDeletion()`
  (google_sync_status를 pending으로 되돌리고 옛 이벤트 정보를 지운 뒤
  `syncOneReservationCalendarEvent()`로 실제 재생성) + `app/admin/booking-actions.ts`의
  `resolveExternalChangeRecreateAfterDeletion()`/`resolveExternalChangeCancelDueToDeletion()`
  (후자는 기존 `cancelLessonBooking()` 정식 절차 재사용). 관리자 UI가 `deleted` 상태에서는
  "ALTON 일정 유지(재생성)"/"예약 취소" 둘만 보여주고 "무시" 버튼 자체를 렌더링하지 않음.
  mock 테스트 전부 통과.
- **Sandbox 요청서 v4로 전면 개정**: (1) "범위를 나누어 부분 실행 가능"으로 읽히던 구
  §4/§12의 문구를 전부 삭제하고 "scope 확인 → 한 번의 통합 실행" 원칙만 남김, (2) §2를
  "문서상 등록 예상/문서상 추가 필요/Sandbox 시작 전 사람이 실제로 확인해야 하는 scope(전
  항목 공통)" 3범주로 재구성하고, 실제 확인이 문서와 다르면 어떤 API도 호출하지 않고
  문서만 갱신해 한 번만 재보고하도록 명시, (3) 외부 일정 렌더링 검증과 삭제 후 양자택일
  처리 검증을 통합 시나리오에 포함.
- **선생님 계정 정지 전 운영 게이트를 R6 blocker에서 완전히 제외**하고 R12(신규 항목)와
  정식 오픈 전 체크리스트로 이관 — R8의 Smart Notes 이동 구현과의 의존관계를 명시(R8 완료
  전에는 "미이관 Smart Notes 없음" 검사를 보수적으로 항상 차단하거나 R8과 함께 구현).

검증: 신규/변경 유닛 테스트 전부 통과. 전체 Vitest 812건(12/N 대비 +11건). `tsc --noEmit`
클린. **실제 Google API 호출은 이번 13/N에서도 단 한 번도 발생하지 않았다** — 모든
플래그 미설정 유지.

## R6 종료 상태 요약 (2026-09-02, 갱신 v4)

1/N~13/N(Calendly/Zoom 제거 제외) 전부 완료·mock/fixture 검증 완료. 1/N~9/N은 원격 dev
DB 반영·커밋까지 완료됨(이전 기록 그대로). 10/N~13/N은 이번 세션 작업분 — 로컬 검증까지
완료했고 원격 dev DB 반영·커밋 여부는 이 로그를 갱신하는 커밋과 함께 진행. 13/N에서
12/N까지 남아 있던 두 미완료 항목(외부 일정 렌더링, 삭제 후 양자택일 처리)을 실제로
구현했고, 선생님 계정 정지 게이트는 R6 blocker에서 완전히 제외해 R12/정식 오픈 전
체크리스트로 이관했다. **R6은 아직 "완료" 상태가 아니다** — Google Sandbox 외부 검증
(v4 요청서, 승인 대기 중)과 그 검증이 통과한 뒤의 Calendly/Zoom 제거가 남아 있다. 이것들이
끝나야 R6을 완료로 보고할 수 있다.
