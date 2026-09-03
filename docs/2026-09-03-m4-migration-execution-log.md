# M4 실행 로그 — 상담→체험→정규 전환 통합 (2026-09-03)

## 0. 범위

2026-09-03 M4 착수 승인의 목표 흐름 14개 절을 3라운드에 걸쳐 로컬 구현·검증
완료했다 — 1/N(커밋 `343e1aa`, §1~5 아래), 2/N(커밋 `eef362e`, §6 이하),
3/N(커밋 `7ea992d`, §7 골든 패스 E2E). 12번(명시적 비범위)은 실제로 손대지
않았고, 13번(골든 패스 E2E + 핵심 부정 테스트)까지 통과했다. 14번(문서 동기화)은
이 로그 + `docs/CURRENT.md`/마스터 로드맵 M4 절 갱신으로 충족.

Production·원격 운영 DB·실제 Google/DocuSign/Stripe 호출·실제 이메일 발송·
`git push`는 3라운드 전체에서 전혀 하지 않았다.

## 1. DB — `supabase/migrations/20261015000000_m4_trial_onboarding_and_consent.sql`

- `trial_onboarding_links` + `trial_onboarding_link_events`: 만료형(72시간)·
  단일사용·해시 저장 온보딩 링크. `account_invites`(R2)와 다른 이유는 R2가
  "이미 가족이 있는 상태에서 시작하는 초대"인 반면 여기는 "아직 계정이 전혀
  없는 잠재고객이 스스로 시작하는 온보딩"이라 발급 주체·선행조건이 다르기
  때문. 상담당 pending 링크 최대 1개(부분 유니크 인덱스).
- `consultations.trial_intent_confirmed_at`/`_by`: 관리자의 `outcome=
  trial_recommended`(추천)와 보호자 본인의 "체험 진행 희망 확정"을 명시적으로
  구분. `confirm_trial_intent()`는 추천 상태가 아니면 확정을 막는다(관리자
  전용, 전화 등 외부 채널로 확인한 결과를 대행 입력하는 용도 — 보호자 셀프
  서비스 확정 화면은 다음 라운드).
- `create_trial_onboarding_link()`(관리자 전용 발급) / `redeem_trial_onboarding_
  link()`(anon 조회, **계정을 만들지 않음** — 클라이언트가 신규/기존 보호자
  경로를 분기하기 위한 정보만 반환).
- `finalize_trial_onboarding_new_guardian(p_link_id, p_auth_user_id,
  p_child_auth_user_id)`: 신규 보호자 경로. **실제 버그 발견**: 처음에는 학생
  프로필 id를 `gen_random_uuid()`로 SQL 안에서 임의 생성했는데,
  `profiles.id`가 `auth.users(id)` FK라 `insert or update on table "profiles"
  violates foreign key constraint "profiles_id_fkey"`로 즉시 실패했다(psql
  smoke test로 재현). R2 자녀 초대(`finalize_account_invite`)도 학생에게 실제
  Auth 계정이 있다는 동일한 전제를 쓰고 있음을 확인 — 함수 시그니처를
  `p_child_auth_user_id`를 받는 형태로 바꿔, 앱 레이어(`app/api/trial-
  onboarding/redeem/route.ts`)가 `admin.auth.admin.createUser()`로 보호자·
  학생 계정을 각각 먼저 만든 뒤 그 id를 넘기도록 수정. 이후 profiles/parents/
  households/students/household_members 생성 + `prospect_contacts.
  converted_guardian_id/_at/_by` 기록 + `consultations.child_id` 연결까지
  한 트랜잭션으로 처리하고, 링크를 즉시 `redeemed`로 소진. 이미 `redeemed`인
  링크로 재호출하면 새로 만들지 않고 기존 결과를 그대로 반환(재시도 안전).
- `link_existing_guardian_to_trial_onboarding(p_link_id,
  p_existing_child_id)`: 기존 보호자 경로. 로그인 상태에서 이 함수를 **직접
  호출하는 것 자체가 본인 확인**이라는 설계이고, `p_existing_child_id`는
  필수(본인 가족의 기존 자녀만) — 완전히 새 자녀가 필요하면 이 함수가 SQL
  안에서 임의로 새 Auth 계정을 만들지 않고 기존 R2 자녀 초대 셀프서비스
  (`create_account_invite(role='student')`)를 먼저 거치도록 문서화(중복 로직·
  중복 계정 생성 경로를 만들지 않기 위함). 이메일 문자열이 같다는 이유만으로
  자동 연결하지 않는다.
- `trial_smart_notes_consents`: 학생당 정확히 1건만 허용하는 유니크 인덱스로
  "회차마다 다시 묻지 않음"을 강제. `record_trial_smart_notes_consent()`는
  멱등(이미 동의했으면 그대로 기존 id 반환) — 로그인한 보호자가 본인 가족의
  자녀에 대해서만 기록 가능(다른 가족 시도는 psql smoke test로 거부 확인).
  법률 문구 자체는 만들지 않았다 — `policy_version`은 텍스트 키일 뿐이고,
  실제 문구 확정과 만 13세 미만 보호자 확인 방식은 여전히 기존 출시 blocker.
- `grant_trial_entitlement_for_consultation()`(M2)에 동의 게이트 추가 — 동의가
  없으면 예외를 던지고, 시그니처는 그대로 `CREATE OR REPLACE`로만 수정. 학생
  기준 중복 지급 방어도 추가(상담 재처리로 같은 학생에게 반복 지급되지 않도록
  `entitlement_grants`를 학생+상품 코드로도 조회).

## 2. DB 레벨 smoke test (psql, 로컬 개발 DB)

신규 보호자 골든 패스를 실제로 끝까지 실행했다:

1. 상담+잠재고객 시드 → `confirm_trial_intent()`(관리자 컨텍스트) → 성공.
2. `create_trial_onboarding_link()` → `link_id`/`raw_token` 발급 확인.
3. `redeem_trial_onboarding_link()`(anon 컨텍스트) → 링크 메타데이터 반환,
   계정 미생성 확인.
4. `auth.users`에 보호자·학생용 최소 행을 직접 삽입(앱 레이어의
   `admin.auth.admin.createUser()` 호출을 대신함) → `finalize_trial_
   onboarding_new_guardian()`(service_role 컨텍스트) → household/guardian/
   child id 정상 반환, `profiles`/`parents`/`households`/`students`/
   `household_members` 전부 생성 확인.
5. 동의 없이 `grant_trial_entitlement_for_consultation()` 호출 → **거부**
   확인("체험 Smart Notes 동의가 없어 체험수업권을 지급할 수 없습니다").
6. 보호자 컨텍스트로 `record_trial_smart_notes_consent()` 호출(2회, 멱등 —
   같은 id 반환) → `grant_trial_entitlement_for_consultation()` 재호출(2회) →
   **성공**, 두 호출 모두 같은 grant id 반환, `entitlement_grants`에 해당
   학생의 `trial_lesson_grant`가 정확히 1건만 존재함을 확인.
7. 다른 보호자(auth.uid()를 타 계정으로 설정) 컨텍스트로 같은 학생에게 동의
   기록 시도 → **거부** 확인("본인 가족의 자녀에 대해서만 동의를 기록할 수
   있습니다").

이후 `npx supabase db reset --local`로 smoke test 데이터를 전부 제거하고 클린
상태로 되돌린 뒤 자동화 테스트를 실행했다.

## 3. 앱 레이어

- `app/admin/trial-onboarding-actions.ts`: `confirmTrialIntentAction()`,
  `createTrialOnboardingLinkAction()` — 기존 상담 관리 액션과 동일한
  capability(`manage_consultations`) 재사용.
- `app/consult/trial-onboarding-actions.ts`: `previewTrialOnboardingLink()`
  (토큰 미리보기), `linkExistingGuardianToTrialOnboarding()`(로그인 보호자
  세션), `recordTrialSmartNotesConsent()`.
- `app/api/trial-onboarding/redeem/route.ts`: 신규 보호자 경로 — R2의
  `app/api/invite/accept/route.ts`와 동일한 신뢰 경계·구조(토큰 검증→Auth
  계정 생성→finalize→`/set-password`로 리다이렉트). 이미 로그인된 세션으로
  이 링크를 열면 자동으로 새 계정을 만들지 않고 기존 보호자 경로 화면으로
  안내(쿠키 존재 여부로 분기).

## 4. 검증

- Vitest 신규 2개 파일(`app/admin/trial-onboarding-actions.test.ts` 3건,
  `app/consult/trial-onboarding-actions.test.ts` 4건) 전부 통과.
- 전체 회귀: Vitest 145개 파일/870건 전부 통과, `npx tsc --noEmit` 클린,
  `npx next build` 성공.
- 핵심 Playwright 회귀(새 마이그레이션이 기존 흐름을 깨지 않는지 확인):
  `e2e/m1-consultation-flow.spec.ts`, `e2e/m3-teacher-assignment-termination-
  flow.spec.ts`, `e2e/r3-consultation-to-contract.spec.ts`,
  `e2e/r5-subject-enrollment-flow.spec.ts` — 4개 스펙 6건 전부 통과.
- **미완료**: 이번 라운드 신규 기능(온보딩 링크 발급→redeem→finalize→동의→
  지급) 자체를 실브라우저로 검증하는 Playwright 스펙은 아직 없음 — DB smoke
  test로만 검증했다. 다음 라운드에서 나머지 흐름(과목·선생님 배정, 체험 예약,
  리뷰, 계약 발송, 구매→활성화)까지 이어붙인 뒤 골든 패스 E2E 1개로 함께
  검증할 계획(요구사항 13번).
- 클린 `git worktree` 재현: 이번 라운드에서는 별도로 실행하지 않음(다음
  라운드가 더 진행된 시점에 한 번에 재현할 계획) — 대신 위 전체 Vitest/tsc/
  build/Playwright 4스펙을 통합 HEAD에서 그대로 재확인.

## 6. 2/N — 배정·리뷰·전환·계약 발송 (커밋 `eef362e`)

### 6.1 범위
3번(체험 전 과목 수강+선생님 배정), 7번(체험 리뷰), 8번(정규 진행 희망), 9번
(관리자 원클릭 계약 발송) 구현. 6번(체험 예약/Calendar/Meet)과 10번(서명→구매→
활성화, `teacher_assignment` 불변)은 새 코드 없이 기존 R6/M2/R4/R5/R3 인프라가
이미 generic하게 지원함을 코드 확인으로 검증했다.

### 6.2 DB — `supabase/migrations/20261016000000_m4_trial_review_and_regular_conversion.sql`
- `trial_lesson_reviews`: draft/final 2단계, 확정 전 고객 비공개. `save_trial_
  lesson_review_draft()`/`finalize_trial_lesson_review()`(선생님 전용)/
  `admin_edit_trial_lesson_review()`(관리자 운영상 정정, `finalized_at` 보존)/
  `get_trial_lesson_review_for_family()`(보호자·학생 전용, `final_text`만 반환 —
  초안·내부메모·Smart Notes 원본·Drive 링크는 애초에 SELECT 안 함).
- `trial_regular_progress_selections`: `confirm_regular_progress_intent()`는
  확정된 리뷰가 없으면 예외, `subject_enrollment`당 1건만(멱등 — 중복 선택으로
  계약이 여러 개 안 생김).
- `get_or_create_draft_contract_for_child()`: 이미 draft가 아닌(sent 이상 진행된)
  계약이 있으면 그대로 반환, 없으면 draft로 새로 생성 — proposals를 요구하지
  않는 요구사항 9번의 "①기존 계약 대조" 헬퍼.

### 6.3 앱 레이어
- `app/admin/trial-onboarding-actions.ts`에 `planTrialSubjectAndAssignTeacher
  Action()`(R5의 `planSubjectEnrollment`/`assignTeacherToSubjectEnrollment` 재사용),
  `sendRegularContractOneClickAction()`(대조→생성→선서명(`companySignOffContract
  Version`)→발송(`sendContractForSignature`)을 한 액션으로, 이미 발송된 버전이면
  재발송 없이 그대로 반환, 발송 실패는 draft 상태로 남겨 재처리 가능),
  `listTrialOnboardingCandidatesAction()`/`listRegularConversionCandidatesAction()`
  (관리자 화면 조회).
- `app/teacher/trial-review-actions.ts`, `app/parent/trial-conversion-actions.ts`
  신규.
- **실제 안전 문제 발견·수정**: `lib/docusign.ts`의 `createEnvelope()`가 지금까지
  실제 DocuSign API 호출을 막는 게이트가 전혀 없었다(Calendar의 `CALENDAR_SYNC_
  ALLOW_REAL_CALLS`와 달리) — `.env.local`에 실제 sandbox 자격증명이 있어
  로컬/E2E 실행 중 실수로 진짜 발송이 나갈 위험이 있었다. `DOCUSIGN_SANDBOX_
  ALLOW_REAL_CALLS` 게이트 신설(기본 false, 이 값이 정확히 "true"가 아니면
  `fetch` 자체를 호출하지 않음). 기존 `lib/docusign.test.ts`가 게이트 없음을
  전제로 작성돼 있어 테스트도 함께 수정, 게이트 자체의 기본-거부 회귀 테스트 추가.

### 6.4 UI
관리자 `TrialOnboardingPanel`에 과목·선생님 배정 폼 + 정규 계약 발송 대기 목록·
버튼 추가. 선생님 `TrialReviewPanel`(초안 저장/확정). 보호자 `TrialConversionPanel`
(확정 리뷰 확인 + 정규 진행 희망 버튼).

### 6.5 검증
전체 Vitest 145개 파일/872건, `tsc --noEmit`, `next build` 클린.

## 7. 3/N — 골든 패스 E2E (커밋 `7ea992d`)

### 7.1 `e2e/m4-trial-to-regular-golden-path.spec.ts`
요구사항 13번의 골든 패스를 실브라우저 11단계로 구현: ①관리자 체험 확정+온보딩
링크 발급 ②신규 보호자 계정 생성(redeem 라우트) ③관리자 과목·선생님 배정 ④보호자
Smart Notes 동의+체험수업권 자동 지급(+정규 예약 거부 부정 테스트) ⑤체험 예약(60분)
+완료 처리 ⑥선생님 리뷰 확정 ⑦보호자 정규 진행 희망 ⑧관리자 원클릭 계약 발송
(mock 실패 경로만 검증) ⑨DocuSign 웹훅 시뮬레이션으로 계약 active 전환 ⑩정규상품
구매 시뮬레이션+과목 활성화 ⑪`teacher_assignment` 불변 확인+같은 배정으로 120분
정규 예약. r5-subject-enrollment-flow.spec.ts와 동일하게 역할마다 별도 `test()`로
나눴다 — 처음엔 한 `test()` 안에서 `context.newPage()`로 admin/guardian/teacher를
오가다 admin 세션이 guardian 세션으로 덮어써지는 문제를 실제로 겪어(Playwright
`test()`는 각각 독립 브라우저 컨텍스트를 기본 제공) 이 구조로 재작성해 해결했다.

### 7.2 이 E2E를 처음 통과시키며 발견·수정한 실제 버그
- `confirm_trial_intent()`/`create_trial_onboarding_link()`/`get_or_create_draft_
  contract_for_child()`/`admin_edit_trial_lesson_review()`가 SQL 안에서
  `is_admin()`을 다시 확인 — 이 함수들은 전부 관리자 서버 액션이 `requireAdmin
  OrCapability()`로 이미 검증한 뒤 `createAdminClient()`(service_role)로 호출한다.
  service_role 세션에는 `auth.uid()`가 없어 `is_admin()`이 항상 false를 반환,
  정상 관리자 호출도 매번 "관리자만..." 예외로 실패했다. 신규 마이그레이션
  `20261017000000_m4_admin_function_auth_fix.sql`로 SQL 쪽 재확인을 제거하고,
  `auth.uid()`에 의존하던 감사 컬럼(`trial_intent_confirmed_by` 등)도 실제 관리자
  id를 파라미터로 받도록 시그니처를 바꿨다(M3 `teacher-assignment-termination-
  actions.ts` 등 기존 관리자 전용 함수와 동일한 설계로 통일).
- `app/teacher/trial-review-actions.ts`의 PostgREST 임베디드 조인 필터가
  `.eq("lesson_types.code", "trial")`처럼 실제 테이블명을 썼는데, 별칭
  (`lesson_type:lesson_types!inner(...)`)을 줬으면 필터도 별칭(`lesson_type.code`)
  으로 해야 했다 — 선생님이 완료된 체험 수업을 리뷰 대상으로 전혀 못 찾던 버그.
- E2E 자체의 시행착오(버그는 아니지만 기록): `lesson_types`/`entitlement_products`
  id가 `gen_random_uuid()` 기본값이라 `db reset`마다 바뀌는데 처음에 하드코딩했다가
  FK 위반으로 실패 — `beforeAll`에서 code 기준으로 조회하도록 수정. `date_of_birth`
  없는 신규 학생은 `is_under_13()`이 fail-closed(true)로 판정해 계약 활성화를
  막는다(기존 R3 정책, 만 13세 미만 동의 게이트는 M4 범위 밖 — r3-consultation-
  to-contract.spec.ts와 동일하게 17세로 채워 우회). 직접 삽입한 구매의
  `entitlement_grants`에 짝이 되는 `entitlement_ledger` 'grant' 이벤트를 빠뜨려
  "사용 가능한 수업권 없음"으로 잘못 실패 — 실제 구매 완료 흐름과 동일하게 두
  테이블을 함께 채우도록 수정.

### 7.3 검증
전체 Vitest 145개 파일/872건, `tsc --noEmit`, `next build` 클린. 핵심
Playwright 회귀(M1/M3/R3/R5/M4) 5스펙 17건(골든 패스 11건 포함) 전부 통과 —
동시 실행해도 데이터 충돌 없음 확인. 통합 HEAD(`7ea992d`) 기준 클린 `git
worktree`(node_modules 하드카피)에서 `next build`+전체 Vitest 재현 완료.

### 7.4 남은 미완료(당시)
90일 이후 시작 체험 예약 차단, 24시간 기준 취소 처리, 미배정·다른 선생님 예약
차단, 계약 발송 중복 클릭의 "재처리 후 성공"까지의 실증, 보호자 서명 전 구매
차단의 직접 테스트는 이 시점까지 전용 테스트가 없었다 — 4/N에서 마저 명시했다
(아래 §9).

## 8. 4/N — 인수 기준 13번 잔여 5개 항목 전용 테스트 (커밋 `0496985`)

새 기능 구현 없이 기존 R6/M2 메커니즘을 테스트로만 고정했다.

- **90일 이후 시작 체험 예약 차단 + 24시간 기준 취소(release vs 소진)** —
  `lib/booking/trial-entitlement-and-cancellation.integration.test.ts`(신규,
  `app/admin/trial-sessions-guardian-consent.integration.test.ts`와 동일한
  psql shell-out 패턴). 이미 만료된 grant만 있으면 `hold_entitlement()`이
  거부, 만료 전 grant면 성공함을 확인. `cancel_lesson_booking()`이 학생 취소
  기준 24시간 이상 전이면 release(+90일 내 재예약 가능), 24시간 미만이면
  consume, 선생님/회사 취소는 시점과 무관하게 항상 release함을 3케이스로 확인.
  **테스트 작성 중 실제로 겪은 실수(코드 버그 아님)**: (a) 여러 테스트 케이스가
  같은 상대 일자 오프셋을 재사용해 선생님 버퍼 제약 위반이 났다 — 케이스마다
  겹치지 않는 날짜로 분리. (b) "취소 시점에 24시간 미만"을 재현하려고
  `starts_at`만 UPDATE했는데 `ends_at`을 그대로 둬 tstzrange가 원래 종료
  시각까지 거대하게 남아 다른 예약과 항상 충돌했다 — `ends_at`도 함께 갱신.
  (c) `afterAll`에서 `entitlement_ledger`/그걸 참조하는 `entitlement_grants`/
  `reservations`를 지우려다 INSERT-only 트리거·FK(`ON DELETE NO ACTION`)에
  막혔다 — 다른 통합 테스트와 동일하게 그 부분은 정리하지 않고 `db reset`에
  맡기도록 수정.
- **미배정·다른 선생님 체험 예약 차단** — `lib/booking/authorization.test.ts`
  신규. `assertActiveTeacherAssignment()`(R6에서 이미 모든 예약 생성 액션이
  거치는 공통 게이트)가 미배정/다른 선생님을 거부하고 현재 배정된 선생님만
  통과시킴을 확인.
- **계약 발송 실패 후 재처리→성공** —
  `app/admin/trial-onboarding-actions.test.ts`에 추가. 1차 발송 실패(DocuSign
  게이트 비활성 등)는 draft 상태로 남고 계약 버전·회사 선서명은 1번만 생성/
  실행됨을 확인 → 2차 재처리가 같은 계약 버전을 재사용해 재선서명 없이 발송
  성공. 이미 발송 완료(envelope 있음)된 버전에 재클릭하면 발송·선서명 모두
  다시 호출하지 않고 그대로 반환함도 확인.
- **보호자 서명 전 구매 차단** — `app/parent/purchase-actions.test.ts`에 M4
  전용 케이스 추가(계약 `status='sent'`인 상태에서 구매 시도 차단) — 기존 R4
  "계약이 active가 아니면 구매를 막는다" 테스트와 같은 메커니즘임을 이름으로
  명시.

### 8.1 검증
전체 Vitest 147개 파일/883건, `tsc --noEmit`, `next build` 클린.

## 9. 커밋

- `343e1aa` — 1/N: DB 마이그레이션 + 앱 레이어 + 테스트.
- `eef362e` — 2/N: 배정 배선, 체험 리뷰, 정규 진행 희망, 원클릭 계약 발송,
  DocuSign 게이트 신설.
- `7ea992d` — 3/N: 골든 패스 E2E + service_role 호출 admin 함수 실버그 수정.
- `0496985` — 4/N: 인수 기준 13번 잔여 5개 항목 전용 테스트.
- 이 로그 + `docs/CURRENT.md`/마스터 로드맵 갱신은 별도 문서 커밋.

전부 로컬 `main` 브랜치 커밋, `git push` 없음. 실제 Google/Stripe/DocuSign 호출,
실제 이메일 발송, Production·원격 운영 DB 접근 전부 없음. **M4는 이것으로 종료.**
