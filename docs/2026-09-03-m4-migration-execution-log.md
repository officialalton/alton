# M4 실행 로그 — 상담→체험→정규 전환 통합 (2026-09-03, 착수 1/N)

## 0. 범위(이번 라운드)

2026-09-03 M4 착수 승인의 목표 흐름 14개 절 중, 이번 라운드는 **2번(상담에서
체험 온보딩 전환 — 검증된 계정 연결)과 4·5번(체험 Smart Notes 동의 + 체험수업권
지급 게이트)만** 구현했다. 나머지(과목·선생님 배정 배선, 체험 예약/Calendar/Meet
배선, Smart Notes 체험 리뷰, 정규 진행 선택, 관리자 원클릭 계약 발송, 서명→구매→
활성화 연결, 역할별 화면, 골든 패스 E2E)는 이후 라운드로 이어간다 —
`docs/CURRENT.md`/`docs/2026-08-29-master-roadmap-v3.md` M4 절에 동일하게 반영.

Production·원격 운영 DB·실제 Google/DocuSign/Stripe 호출·실제 이메일 발송·
`git push`는 이번 라운드에서 전혀 하지 않았다.

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

## 5. 커밋

- `343e1aa` — DB 마이그레이션 + 앱 레이어 + 테스트(이번 라운드 전부).
- 이 로그 + `docs/CURRENT.md`/마스터 로드맵 갱신은 별도 문서 커밋.

전부 로컬 `main` 브랜치 커밋, `git push` 없음. 실제 Google/Stripe/DocuSign 호출,
실제 이메일 발송, Production·원격 운영 DB 접근 전부 없음.
