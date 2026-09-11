# P4-1 사전 조사 — (A) 기존 보호자에 자녀 계정 추가 / (B) 경량 가구 아카이브·복귀

조사만 수행했다. **코드·마이그레이션·DB·외부 서비스 변경 없음.** 착수 시점은
C-1/C-2 완료 이후(`docs/2026-09-10-p-execution-roadmap.md:956`,
`docs/CURRENT.md:281`)이며, 이 문서는 그 배치의 구현 전 설계 근거다.

---

# A. 기존 보호자에 자녀 계정 추가

## A-1. 현재 직접 계정 생성 흐름(end to end)

1. 관리자 `신규 > 계정 생성` 탭(`app/admin/AccountCreationTab.tsx:15`)의
   `DirectAccountCreationForm`이 `+ 계정 생성` 버튼
   (`app/admin/DirectAccountCreationForm.tsx:63`)으로 열리고, 보호자 1명 +
   학생 1~N행을 받는다(`:79`~`:132`).
2. `sendDirectOnboardingNoticeAction()`
   (`app/admin/direct-account-actions.ts:55`) → 검증(`:31`) →
   `create_direct_onboarding_link_multi(p_guardian_email, p_guardian_name,
   p_students, p_admin_id)` 호출(`:86`). 실제 정의는
   `supabase/migrations/20261215000000_m4_direct_onboarding_link_auth_fix.sql:16`
   (20261214 버전의 3인자 시그니처는 `drop` 후 교체됨, 같은 파일 `:15`).
   이 RPC는 `trial_onboarding_links`(consultation_id=null) 1행 +
   `trial_onboarding_link_students` N행만 만든다. **Auth 계정은 만들지 않는다.**
3. 보호자에게 안내 메일 발송 → redeem 링크 →
   `lib/trial-onboarding-finalize.ts:10 createGuardianAndStudentThenRedirect()`가
   Auth 계정을 실제로 만들고 `finalize_trial_onboarding_students`를 호출
   (`lib/trial-onboarding-finalize.ts:128`).
4. `finalize_trial_onboarding_students`의 최신 정의는
   `supabase/migrations/20261272000000_p0_direct_creation_consent_entitlement_fix.sql:42`.

## A-2. 핵심 발견 — 기존 보호자 경로는 **이미 존재하고 이미 동작한다**

- `p_new_guardian`은 항상 true가 아니다. `lib/trial-onboarding-finalize.ts:27`이
  `find_auth_user_id_by_email()`로 **보호자 이메일에 이미 Auth 계정이 있으면
  `isNewGuardian=false`로 판정**하고(`:33`), 그 uid를 그대로 쓴다(`:37`).
- `finalize_trial_onboarding_students`의 `else` 분기
  (`20261272000000_...sql:81-90`)가 기존 보호자 검증(`role='parent'`) 후
  `households.primary_guardian_id`로 기존 household를 찾고, 없으면 예외
  (`:88`). 즉 **household를 새로 만들지 않는다.**
- 자녀는 그 household에 `household_members(role='child', is_primary=false)`로
  추가된다(`20261272000000_...sql:128-130`), `on conflict ... do nothing`.
  형제자매 행은 건드리지 않는다.
- 완료 후 리다이렉트도 이미 "자녀가 추가로 연결됐습니다"라는 기존 보호자 전용
  문구를 쓴다(`lib/trial-onboarding-finalize.ts:169-173`).

**따라서 `+ 자녀 추가`는 "기존 보호자 이메일 + 학생 1명"으로 지금의 직접 생성
링크를 발급하는 것과 DB 동작이 동일하다.** 새 RPC가 원리적으로는 필요 없다.

`app/consult/trial-onboarding-actions.ts:43
linkExistingGuardianToTrialOnboarding()`도 실재하지만(RPC
`link_existing_guardian_to_trial_onboarding`), 이건 **로그인한 보호자 본인이
이미 있는 자녀를 상담 링크에 연결**하는 별개 용도다(같은 파일 `:3-7` 주석).
관리자가 새 자녀를 만드는 이번 요구와는 방향이 반대이므로 재사용 대상이 아니다.
단일 학생용 `finalize_trial_onboarding_existing_guardian()`
(`supabase/migrations/20261128000000_m4_existing_guardian_reconsult.sql:29`)은
복수 자녀 통합 시 사실상 폐기됐고 테스트만 참조한다
(`lib/trial-onboarding-finalize.ts:196-202`).

## A-3. 중복 계정 위험 (현재 방어 수준 = 낮음)

- `create_direct_onboarding_link_multi`에는 **학생/보호자 이메일 중복 검사가
  전혀 없다**(`20261215000000_...sql:33-70`). 이름·이메일 공백만 본다.
  `on conflict`도 링크 테이블에는 없다.
- 서버 액션의 검증도 "같은 요청 안의 학생 이메일 중복"만 막는다
  (`app/admin/direct-account-actions.ts:41-50`).
- 실질 방어는 redeem 시점의 `admin.auth.admin.createUser()` 실패뿐이다
  (`lib/trial-onboarding-finalize.ts:94`). 이미 Auth 계정이 있는 이메일을
  자녀로 넣으면 그 학생만 조용히 건너뛰고(`:105-113`) 상태가 `pending`으로
  남는다 — **"이미 계정이 있음"이라는 안내가 관리자에게 전혀 뜨지 않는다.**
- `household_members_one_household_per_child`
  (`supabase/migrations/20260830010000_r1_household_contract.sql:29`)가
  "자녀 1명은 정확히 1 household"를 강제하므로, 기존 학생 Auth 계정을 다른
  가구에 붙이는 사고는 DB가 막는다. 다만 그 실패도 학생 단위 savepoint에
  먹혀 `status='failed'`로만 남는다(`20261272000000_...sql:152-157`).

→ 이번 배치에서 추가해야 할 최소 방어: 관리자 폼 제출 시점에
`find_auth_user_id_by_email()`로 **자녀 이메일 선점 여부를 미리 조회해 경고**
(신규 RPC 없이 기존 함수 재사용 가능).

## A-4. 다자녀 household 권한 모델

`household_members`는 N자녀를 이미 정상 지원한다
(`20260830010000_r1_household_contract.sql:15-30`: unique는
`(household_id, profile_id)`뿐이고, 자녀 유일성 제약은 "자녀당 1가구"이지
"가구당 1자녀"가 아니다). **이미 존재하는 household에 자녀 1명을 더 넣는
정확한 경로**는 `20261272000000_...sql:128-130` (finalize의 else 분기에서
찾은 `v_household_id` 재사용). 공동 보호자(`is_primary=false`)는
`20260910000000_r2_multi_guardian.sql:128-138`이 별도로 다루며 이번 범위 밖.

**주의**: else 분기는 `households.primary_guardian_id = 보호자`로만 가구를
찾는다(`:85`). 공동 보호자(비주 보호자)를 선택하면 `:88`에서 예외로 실패한다
→ `+ 자녀 추가`의 보호자 검색은 **주 보호자만 후보로 노출**하거나,
`household_members(role='guardian')` 기준으로 가구를 찾도록 else 분기를
확장해야 한다(후자는 migration 필요).

## A-5. 초대/재발송

직접 경로 전용 재발급은 이미 있다:
`reissueDirectOnboardingLinkAction()`(`app/admin/direct-account-actions.ts:147`,
consultation_id가 null인 링크만 처리 `:181`). 재발급은 기존 링크를 revoke하고
`sendDirectOnboardingNoticeInternal()`을 다시 부르며, `created`가 아닌 학생만
대상으로 삼는다(`:202`). **학생 1명짜리 링크도 N=1인 같은 모양이므로 그대로
동작한다 — 새 링크 타입·테이블 변경 불필요.** 목록은
`listDirectOnboardingLinksAction()`(`:268`) / `DirectAccountLinksList.tsx`,
학생 개별 초대 재발송은 `resendStudentSetPasswordEmail()`
(`lib/trial-onboarding-finalize.ts:268`).

## A-6. Migration 필요 여부 — **원칙적으로 불필요(조건부)**

UI + 서버 액션 추가만으로 구현 가능하다. 기존 RPC 2개
(`create_direct_onboarding_link_multi`, `finalize_trial_onboarding_students`)를
그대로 쓰고, `p_new_guardian=false` 분기는 redeem 시점에 자동으로 선택된다.

migration이 필요해지는 경우는 다음 둘뿐이다.
1. 공동 보호자(비주 보호자)에게도 자녀 추가를 허용할 때 →
   `finalize_trial_onboarding_students`의 else 분기(`:85-89`)를
   `household_members` 기준 조회로 교체.
2. "이 링크는 기존 보호자용"임을 링크 행에 남겨 관리자 목록에서 구분하고
   싶을 때 → `trial_onboarding_links`에 additive 플래그 1개
   (예: `link_kind text default 'new_guardian'`). 목록 표시용이며 로직 분기는
   아니므로 1차에서는 생략 가능.

부수 확인: 직접 경로는 `consultation_id`가 null이라 신규 보드 카드가
`_create_student_kanban_card()`로 만들어지지 않고
(`20261272000000_...sql:136-145`), 체험수업권은 `awaiting_consent`로 남았다가
`record_trial_smart_notes_consent()` 시점에 지급된다(같은 파일 주석 `:139-141`).
추가된 자녀도 같은 흐름을 그대로 탄다 — 즉 "새 자녀 단위로 동의·수업권이 새로
시작"이라는 요구가 코드상 이미 충족된다. 자녀별 동의 카드도 자녀 단위로만
뜬다(`app/parent/ConsentTab.tsx:65` — `dobKnown` 자녀만 필터).

## A-7. 관리자 UI 최소 변경안

- `DirectAccountCreationForm.tsx:63`의 라벨 `+ 계정 생성` → `+ 부모 계정 생성`
  (문구만 변경, 폼 로직 불변). 탭 헤더 문구(`AccountCreationTab.tsx:20-24`)도
  두 버튼을 설명하도록 소폭 수정.
- 같은 위치(`AccountCreationTab.tsx:25` 바로 아래/옆)에 두 번째 버튼
  `+ 자녀 추가`를 두고, 새 컴포넌트 `AddChildToGuardianForm`을 연다. 구성은
  ① 보호자 검색·선택(이름/이메일 입력 → 후보 목록; 데이터 원본은
  `loadParents()` `app/admin/users-data.ts:99`의 경량 버전 또는 신규
  `searchGuardiansAction`), ② 학생 1행(이름/이메일/학년/과목 —
  기존 학생 행 UI 재사용), ③ 발송 버튼.
- 서버 액션은 기존 `sendDirectOnboardingNoticeAction()`에 선택된 보호자의
  이메일·이름을 채워 넣는 얇은 래퍼 1개면 충분하다.
- 발송 내역은 `DirectAccountLinksList`가 consultation_id=null 링크를 모두
  보여주므로 자동으로 포함된다(`direct-account-actions.ts:275`).

## A-8. 구현 전 결정 필요한 정책 질문

1. 공동 보호자(비주 보호자)를 `+ 자녀 추가` 대상으로 허용할 것인가
   (허용 시 A-6의 migration 1이 필요).
2. 자녀 이메일이 이미 Auth에 존재할 때: 경고 후 발송 차단인가, 강행 후
   실패 상태로 남길 것인가(현재는 후자이며 안내가 없다).

---

# B. 경량 가구 아카이브·복귀

## B-1. "가구"의 실체와 현재 활성 표시

- `households`(`supabase/migrations/20260830010000_r1_household_contract.sql:8`):
  `id / primary_guardian_id / billing_currency / created_at`
  — **상태·아카이브 컬럼이 전혀 없다.**
- `household_members`(같은 파일 `:15`): `role(guardian|child)`, `is_primary`,
  `unique(household_id, profile_id)`, 자녀당 1가구 partial unique(`:29`).
- 활성 여부는 가구가 아니라 **개인 단위**로만 존재한다:
  `students.status`(pending/active …, finalize가 `pending`으로 생성
  `20261272000000_...sql:126`), 그리고 R2 계정 상태
  (`account_status_events` + `transition_account_status()`,
  `supabase/migrations/20260904000000_r2_minor_consent.sql:392-394`의 전이표
  `active→closure_pending→closed`).
- **R2의 `closure_pending`/`closed`는 재사용하면 안 된다.**
  `lib/auth.ts:37`이 이 두 상태에서 즉시 로그아웃시킨다 — 이번 라운드가 명시적으로
  범위에서 뺀 "Auth 로그인 차단"이 바로 발생한다. 따라서 **가구 단위의 별도
  경량 플래그**를 새로 두는 것이 맞다.

## B-2. 재사용할 예약 취소 경로

`cancelLessonBooking()`(`lib/booking/create-booking.ts:198`)이 정식 경로다.
- DB: `cancel_lesson_booking` RPC. 최초 정의는
  `supabase/migrations/20260930000000_r6_cancellation_and_incident_reports.sql:46`
  이지만 **현재 유효한 정의는
  `supabase/migrations/20261030000000_m5a_session_final_judgment.sql:220-307`**
  (중간 재정의 `20261002000000_r6_notification_outbox.sql:212`). 행 잠금(`:240`),
  `confirmed`만 취소 가능(`:246`), 수업권 처리(`company` 주체면
  `release_entitlement` + 만료 30일 연장 `:260-278`),
  `reservation_cancellations` 적재(`:281`), 그리고 `kind='lesson'`이면
  연결 세션 최종 판정(`sessions.final_status`, `session_status_events`,
  `upsert_session_payout_item`)까지 같은 트랜잭션에서 수행한다(`:286-303`).
  전부 in-DB이며 `service_role` 전용(`:306-307`).
- 외부: RPC 성공 후 **TypeScript에서** `cancelSyncedCalendarEvent()`로 Google
  이벤트를 지운다(`create-booking.ts:218-236`). 실패해도 취소는 유지되고
  로그만 남는다(자동 재시도 큐 없음, 같은 파일 `:226-227`).

## B-3. 재사용할 매칭 종료 경로 — **이미 존재한다(C-2 대기 아님)**

M3의 배정 종료 파이프라인이 이미 정식 경로다
(`supabase/migrations/20261014000000_m3_teacher_assignment_termination.sql`,
본체 `lib/enrollment/teacher-assignment-termination.ts`):
- 영향 미리보기: `previewTerminationImpact()`(`:24`) →
  `preview_teacher_assignment_termination_impact` RPC(`:28`).
  관리자 UI도 이미 이걸 쓴다(`app/admin/TeacherAssignmentTerminationPanel.tsx:55`).
- 처리: `processTeacherAssignmentTermination()`(`:84`) —
  요청 행을 `processing`으로 선점(`:105-119`), 예약별로
  `teacher_assignment_termination_reservation_actions`에 이미 처리 여부를
  확인하고(`:138-144`) `cancelLessonBooking()` 호출(`:166`), 마지막에
  `assert_teacher_assignment_ready_for_closure` 게이트(`:182`),
  `teacher_assignments.status='ended'` + `subject_enrollments.status='terminated'`
  (`:204-218`).
- 서버 액션 래퍼: `app/admin/teacher-assignment-termination-actions.ts:58, 83`.

**C-2는 아직 착수되지 않았다** — `git log` 최상단은 `dd4ca0d`/`0fe904c`/
`8fa1035 C-1: ...`이고 C-1의 `20261274000000_c1_...sql` 이후 migration이 없다.
C-2("매칭 종료·재매칭", `docs/2026-09-10-p-execution-roadmap.md:592`)는 이
경로를 **새로 만드는 게 아니라 손보는** 배치다(`docs/CURRENT.md:395`에서도
"매칭 종료/재매칭 수정"으로 표기). **의존성**: 아카이브는 위 함수들을 호출만
하므로, C-2가 시그니처나 resolution 값을 바꾸면 호출부만 따라가면 된다.
아카이브 구현은 C-2 완료 후 착수하되, C-2가 `end_enrollment` resolution과
`previewTerminationImpact()`의 반환 형태를 유지하는지 착수 시점에 재확인한다.

## B-4. 원자성 — **하나의 큰 plpgsql RPC는 불가능. 재시도 가능한 오케스트레이션 권장**

이유가 코드에 명확히 있다.
- `cancelLessonBooking()`은 DB RPC + **Google Calendar 삭제(HTTP)** 조합이다
  (`lib/booking/create-booking.ts:210, 218`). plpgsql 안으로 인라인하면 캘린더
  해제가 빠져 "일정 점유를 확실히 해제한다"는 요구를 정면으로 위반한다.
- 종료 파이프라인도 TypeScript 오케스트레이션이며, 그 자체가 이미
  "선점 상태 + 처리 이력 테이블 + 멱등 스킵"으로 **부분 실패 후 재실행 가능**
  하도록 설계돼 있다(`teacher-assignment-termination.ts:105-144`).

**권장안**: 같은 패턴을 한 단계 위에서 반복한다.
1. `household_archive_requests` 1행을 `processing`으로 선점(조건부 UPDATE).
2. 자녀별로: 활성 `teacher_assignments` → 기존
   `createTerminationRequest()` + `processTeacherAssignmentTermination
   (resolution: end_enrollment)` 호출(내부 멱등성 그대로 활용).
3. 남은 미래 `confirmed` 예약(배정에 딸리지 않은 건) → `cancelLessonBooking()`.
4. 전부 성공했을 때만 `households.archived_at`을 세팅. 중간 실패면 요청을
   `failed`로 남기고 같은 버튼으로 재실행 → 이미 취소/종료된 건은 건너뛴다.

즉 **"하나의 큰 RPC"가 아니라 "선점 + 항목별 멱등 처리 + 재시도"**를 택한다.
DB 단일 트랜잭션이 주는 원자성은 어차피 Google 호출 때문에 달성할 수 없고,
"부분 취소가 남지 않는다"는 요구는 재실행 가능성으로 충족하는 편이 안전하다.

## B-5. 아카이브 플래그 위치(= migration 필요, additive)

- `households`에 `archived_at timestamptz null`, `archived_by uuid references
  profiles(id)` 2컬럼 추가 + `create index ... where archived_at is null`.
- 감사·복귀 이력용 `household_archive_events`
  (`id / household_id / action('archived'|'restored') / actor_id / created_at /
  detail jsonb`) — detail에 취소된 예약 수·종료된 배정 수를 남긴다.
- 처리 진행 상태용 `household_archive_requests`
  (`id / household_id / status(requested|processing|completed|failed) /
  requested_by / error / created_at / updated_at`) — B-4의 선점·재시도용.
  1차를 더 줄이려면 이 테이블을 생략하고 events만 둘 수도 있으나, 그러면 부분
  실패 재시도가 관리자 눈에 보이지 않는다.
- RLS: 세 대상 모두 `is_admin()` 전용 쓰기.

## B-6. 필터를 추가해야 하는 화면·쿼리 전수

| 화면 | 함수 | 위치 |
|---|---|---|
| 사용자 > 학부모 | `loadParents()` | `app/admin/users-data.ts:99` (`household_members` 조인 `:117`) |
| 사용자 > 학생 | `loadStudents()` | `app/admin/users-data.ts:180` |
| 매칭 대기 목록 | `loadStudentsForMatching()` | `app/admin/matching-data.ts:32` (`household_members` 조인 `:41`) |
| 신규 보드 | `loadKanbanBoard()` | `app/admin/consultation-kanban-data.ts:205` |
| 신규 보드(계정 생성 카드) | `loadAccountCreationCards()` | `app/admin/consultation-kanban-data.ts:152` (`trial_onboarding_links` `:153`, `trial_onboarding_link_students` status='created' `:161`) — 카드 키가 `child_auth_user_id`라 아카이브 자녀도 그대로 뜬다 |
| 발송 내역 | `listDirectOnboardingLinksAction()` | `app/admin/direct-account-actions.ts:268` |

목록 진입점(래퍼)은 `app/admin/users-actions.ts:30 / :55 / :68`
(`listParentsForUsersTabAction` / `listStudentsForUsersTabAction` /
`listTeachersForUsersTabAction`)이고 SSR 호출은 `app/admin/page.tsx:103, 104, 113`.
`loadEmailById()`(`users-data.ts:77`) 등 배치 보조 로더는 위 목록이 반환한 id
집합만 따라가므로 별도 필터가 필요 없다.

`loadTeachers()`(`users-data.ts:289`)는 교사 전용이라 제외(교사 단독 아카이브는
범위 밖). 위 함수들은 모두 이미 `household_members`를 조회하거나 자녀 id를
다루므로, "archived household에 속한 profile_id 집합"을 한 번 구해 제외하는
방식이면 쿼리 수를 늘리지 않고 필터를 끼울 수 있다.

화면 위치: **사용자 탭 안에 `아카이브됨` 서브탭**을 추가하는 것을 권장한다
(`app/admin/UsersTab.tsx`의 학부모/학생/선생님 서브탭과 같은 레벨). 별도 nav
항목은 테스트 데이터 정리 용도 대비 과하다. 목록 열: 보호자명, 자녀 목록,
아카이브 시각, 처리 관리자, 취소된 예약 수·종료된 매칭 수, `복귀` 버튼.
아카이브 확인 모달의 미리보기 숫자는 `previewTerminationImpact()`
(`lib/enrollment/teacher-assignment-termination.ts:24`)와 미래 `confirmed`
예약 카운트 쿼리를 합쳐 만든다.

## B-7. 구현 전 결정 필요한 정책 질문

1. **수업권 처리**: `cancel_lesson_booking`을 `company` 주체로 부르면 보유
   수업권이 `release`되고 만료일이 최소 30일 연장된다
   (`20260930000000_...sql:82-95`). 요구사항은 "수업권 자동 취소/변경 없음"이지만,
   기존 취소 경로를 재사용하는 한 이 release는 불가피하다 — 허용으로 확정할지.
2. **매칭 종료 방식**: 기존 종료 경로는 배정 종료와 함께
   `subject_enrollments.status='terminated'`까지 바꾼다(`:216`). 수강 종료까지
   같이 일어나는 것을 아카이브의 정상 동작으로 볼지.
3. **복귀 후 상태**: 복귀 시 `subject_enrollments`가 `terminated`로 남은 채
   목록에만 다시 보이게 되는데(자동 복원 없음 방침대로), 관리자가 새로
   매칭하려면 새 `subject_enrollment`를 만들어야 하는지 기존 행을 되살리는지.
4. **진행 중 세션**: 시작 시각이 지났지만 아직 완료 처리되지 않은 예약을
   "미래 예약"에서 제외할 기준 시각(now 기준인지 당일 종료 기준인지).
