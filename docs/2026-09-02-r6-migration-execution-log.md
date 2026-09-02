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

## 다음 (미완료)

- 6/N: 예약 서버 액션 계층(`app/booking/*-actions.ts` — 위 SQL 함수들을 실제로 호출, 슬롯 조회
  알고리즘, 취소 액션), 보호자·학생 예약 UI, 선생님 반복가능시간 관리 UI, 관리자 일정·불일치
  재처리 화면. 브라우저 최초 timezone 제안 UI(`lib/timezone.ts` 재사용).
- 7/N: AI 회의록/Smart Notes 동의 게이트(신규 정책 테이블, `guardian_consents` 패턴 재사용,
  Gate C 기존 증거 인용 — 재검증하지 않음) + Meet 대조 배선(스키마는 5/N에서 이미 준비).
- 8/N: 알림 outbox(24h/2h 리마인드 + 예약/취소 직후 알림, 그린필드) + 관리자 불일치 재처리 화면.
- 9/N: Calendly/Zoom 제거(신규 흐름 로컬 E2E 통과 후에만).
- Google Sandbox 외부 호출 승인 요청(FreeBusy/Calendar/Meet 실제 생성·Workspace Events 구독 등)은
  로컬·mock 검증이 전부 끝난 뒤 한 번에 묶어 별도로 제출 예정 — 아직 제출 전.
