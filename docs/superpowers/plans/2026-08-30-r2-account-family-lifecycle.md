# R2 — 계정·가족·권한 수명주기 Implementation Plan

> **문서 상태: 확정 계획, 구현 진행 중.** 정책은 `docs/2026-08-29-product-architecture-v3.md` §4.13/4.19/4.20/4.21/5.7에 확정돼 있다. 조사 근거는 `docs/2026-08-30-r2-account-family-lifecycle-investigation-and-plan.md` 참고.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** R2 범위 10개 항목(계정 초대/상태/병합/가족구조 cutover/시간대/Workspace 프로비저닝/미성년자 동의/권한모델)을 태스크 단위로 구현하고, 매 태스크마다 `master-roadmap-v3.md` "1-1. 모든 단계 공통 Definition of Done"을 만족시킨 뒤 검증 결과를 보고한다.

**Architecture 원칙 (R1에서 확립, 그대로 적용):**
- DB 변경 전 기존 코드 사용처를 먼저 확인한다(이미 조사 문서에서 대부분 완료).
- 이름이 충돌하는 기존 구조를 바꿀 때는 shadow 이름 → 앱 코드와 함께 원자적 cutover.
- SQL 적용 성공 자체는 완료가 아니다 — 역할별 RLS 실측, 동시성 실측(해당 시), 타입검사/빌드, 관련 화면 smoke test까지 끝나야 완료.
- 원격 적용 전 변경 대상·영향 범위를 요약 보고한다(정책 재확인은 이미 끝났으므로 진행 승인을 다시 구하지 않되, 무엇을 원격에 반영하는지는 매번 명시한다).
- 실행 결과는 `docs/2026-08-29-r2-migration-execution-log.md`(신규, R1의 실행 로그와 같은 형식)에 태스크별로 기록한다.

**Global Constraints:**
- 신규 테이블·enum은 기존 이름과 충돌하지 않으므로 shadow 이름이 필요 없다.
- `households`/`household_members` cutover(Task 3)에서 관계 원본 `guardian_students`는 "레거시 테이블은 읽기 전용 동결(DB 트리거로 쓰기 차단), 삭제 안 함" 원칙을 따른다(§4.19 결정 3). **(2026-08-30 정정) `parents`는 이 동결 대상이 아니다** — Task 2가 `parents.status`를 계정 상태 원본으로 계속 사용하므로, Task 3은 `parents` 테이블에 손대지 않는다.
- `teachers.status`/`students.status`/`parents` 상태 확장(Task 2)은 Postgres의 `ALTER TYPE ... ADD VALUE`가 같은 트랜잭션 내에서 바로 못 쓰이는 제약이 있어, enum 확장 마이그레이션과 그 값을 실제로 쓰는 마이그레이션을 분리한다.
- Google Workspace 실제 API 연동(Task 7)은 Gate C 수준의 실제 자격 증명 작업이 필요하다 — 이 태스크는 다른 태스크들과 별도로, 실행 전 다시 한번 "실제 계정에 대고 실행한다"는 사실을 명시적으로 알리고 진행한다(정책은 이미 확정됐지만 실제 GCP 리소스를 건드리는 첫 실행이므로).

---

## Task 1: R1 회귀 버그 수정 — 시급 이력 연동 (긴급, 정책 판단 불필요)

**Files:**
- Create: `supabase/migrations/20260831000000_r2_sync_teachers_hourly_rate.sql`
- Modify: `app/admin/users-actions.ts`
- Modify: `app/admin/users-actions.test.ts`

**배경**: `inviteTeacher()`(65-91행)와 `setTeacherHourlyRate()`(111-124행)가 `teachers.hourly_rate_krw`만 쓰고 R1의 `set_teacher_rate()` RPC를 호출하지 않아, 이후 `setTeacherStatus(id,'active')`가 R1 트리거(`teachers_enforce_active_requires_rate`)에 막힌다.

- [x] **Step 1: `inviteTeacher()`가 시급 설정 시 `set_teacher_rate()`도 함께 호출**

`teachers` insert 직후, 이미 함수 스코프에 있는 서비스-role `admin` 클라이언트로 `admin.rpc('set_teacher_rate', { p_teacher_id: userId, p_amount_minor: params.hourlyRateKrw, p_currency: 'KRW' })`를 호출한다. 실패 시 `teachers`/`profiles`/`auth.users` insert를 롤백할 방법이 없으므로(서버 액션은 단일 트랜잭션이 아님), 실패하면 명확한 에러 메시지로 관리자에게 "선생님 계정은 생성됐지만 시급 이력 생성에 실패했습니다 — `setTeacherHourlyRate`로 다시 설정해주세요"를 던진다(완전 롤백은 이번 태스크 범위 밖 — 기존 코드도 각 insert 실패 시 부분 롤백을 안 하는 것과 동일 수준).

- [x] **Step 2: `set_teacher_rate()`가 `teachers.hourly_rate_krw`도 함께 동기화하도록 DB 수정 + `setTeacherHourlyRate()`가 RPC를 쓰도록 교체**

조사 결과 `app/admin/payouts-data.ts`(63-100행, 실제 정산 금액 계산: `amountKrw = hourly_rate_krw * totalMinutes / 60`)와 `app/admin/users-data.ts`(`loadTeachers`)가 **둘 다** `teachers.hourly_rate_krw`를 직접 읽는다. `teacher_rate_history`만 진실 소스로 만들고 이 두 읽기 경로를 전부 다시 쓰는 것은 R2 범위를 넘는 정산 로직 변경이 된다(R4/R10 영역). 대신 **`set_teacher_rate()` DB 함수 자체가 `teacher_rate_history` insert와 같은 트랜잭션에서 `teachers.hourly_rate_krw`도 함께 갱신**하도록 신규 마이그레이션(`20260831000000_r2_sync_teachers_hourly_rate.sql`)을 추가한다 — 통화가 KRW가 아닌 경우의 처리는 현재 정산 로직 자체가 다중 통화를 지원하지 않으므로(기존 한계, R4/R10에서 다룰 문제) 이번에는 그대로 저장하고 주석으로 한계를 남긴다. 이렇게 하면 `users-data.ts`/`payouts-data.ts`는 전혀 수정할 필요가 없다. `app/admin/users-actions.ts`의 `setTeacherHourlyRate()`는 `supabase.from("teachers").update(...)` 대신 서비스-role 클라이언트(`createAdminClient()`, 새로 import)로 `admin.rpc('set_teacher_rate', { p_teacher_id, p_amount_minor: rateKrw, p_currency: 'KRW' })`를 호출하도록 교체한다(`set_teacher_rate()`는 `service_role` 전용이라 `requireAdmin()`의 RLS-bound 클라이언트로는 호출 불가).

- [x] **Step 3: `setTeacherStatus()`에 사전 확인 추가**

`active`로 전환하기 전에 `teacher_rate_history`에 현재 유효 이력이 있는지 먼저 확인(서비스-role 또는 `has_valid_current_teacher_rate` RPC 호출 — 이것도 `service_role`에만 grant돼 있으므로 서비스-role 클라이언트 필요)하고, 없으면 DB 트리거의 원시 오류 대신 "이 선생님은 아직 시급이 설정되지 않아 active로 전환할 수 없습니다. 먼저 시급을 설정해주세요"를 던진다. DB 트리거는 그대로 최종 방어선으로 남긴다(우회 불가능해야 한다는 R1 원칙 유지 — 앱 레벨 사전 확인은 UX용이지 유일한 방어선이 아니다).

- [x] **Step 4: 테스트**

`users-actions.test.ts`에 다음 케이스 추가: (a) `inviteTeacher` 호출 시 `set_teacher_rate` RPC가 올바른 인자로 호출되는지, (b) `setTeacherHourlyRate`가 더 이상 `teachers` 테이블에 직접 update 하지 않고 RPC를 호출하는지, (c) `setTeacherStatus('active')`를 이력 없는 선생님에게 호출하면 친화적 에러가 나는지(모킹).

**DoD 체크**:
- [x] `npx tsc --noEmit` 클린
- [x] `npm test` (vitest) 관련 파일 통과
- [x] 로컬 DB(`alton_r1_test`)에서 실제로 `inviteTeacher` → `setTeacherStatus('active')` 흐름을 서버 액션이 아니라 동일 SQL 시퀀스로 재현해 성공 확인
- [x] `docs/2026-08-29-r2-migration-execution-log.md`에 결과 기록

---

## Task 2: 계정 상태 모델 확장 (완료, 원격 적용 2026-08-30)

> **범위 확장(사용자 요청)**: 원래 초안은 스키마만 만들고 강제 로직은 후속 태스크로 미루는 안이었으나, 로그인 게이트·자기 상태 변경 차단·메시지 차단까지 이번 태스크에서 실제로 구현하도록 범위가 넓어졌다. 1차 구현 보고 후 사용자가 7가지 보완(fail-closed, 임의조회 차단, 서버 액션 전수 감사, DB 레벨 전이 강제+감사 이력, 실제 브라우저 E2E, baseline 커밋)을 요구해 전부 반영했다. 아래 Step은 최종본 기준으로 갱신했다. 상세는 `docs/2026-08-29-r2-migration-execution-log.md`의 "Task 2" 항목 참고.

**Files:**
- Create: `supabase/migrations/20260831010000_r2_account_status_enums.sql`
- Create: `supabase/migrations/20260831011000_r2_account_status_apply.sql`
- Create: `lib/auth.test.ts`
- Create: `app/account-suspended/page.tsx`
- Modify: `lib/auth.ts`, `app/login/actions.ts`, `app/post-auth/page.tsx`, `app/admin/users-actions.ts`, `app/admin/users-actions.test.ts`, `app/admin/StudentDetailPanel.tsx`, `app/admin/StudentDetailPanel.test.tsx`, `app/admin/TeacherDetailPanel.tsx`, `app/admin/UsersTab.tsx`

**배경**: `teachers.status`는 `{pending, active}` 2값뿐이고 `parents`에는 status 컬럼 자체가 없다. §5.7 확정 모델(`pending→active→suspended→closure_pending→closed`)로 통일한다.

- [x] **Step 1**: `teacher_status` enum에 `suspended`, `closure_pending`, `closed` 추가(별도 파일로 분리).
- [x] **Step 2**: `student_status`도 동일하게 확장. `inactive`는 실사용 코드가 없어(조사 확인) 데이터 마이그레이션 없이 폐기 예정 값으로만 남기고 사용 중단(앱 타입에서 제거).
- [x] **Step 3**: `parents`에 `status parent_status not null default 'active'` 컬럼 추가.
- [x] **Step 4**: `profiles`에 `timezone text`, `date_of_birth date` 컬럼 추가.
- [x] **Step 5**: `households`에 `default_timezone text not null default 'America/Los_Angeles'` 컬럼 추가.
- [x] **Step 6(확장)**: 상태 전이 강제를 이번 태스크에서 구현했다 — `protect_account_status()` 트리거(관리자 포함 전원 자기 status 직접 변경 차단), `transition_account_status()`(유일한 정상 경로, 관리자 전용, 허용된 전이만 검증, `account_status_events` 감사 이력 자동 기록), `get_account_status()`/`is_account_active()`(fail-closed, `service_role` 전용)·`current_account_status()`/`current_account_active()`(self-only, anon/authenticated 허용) 공통 판정 함수, `lib/auth.ts`의 `requireUser()`/`resolveAccountDestination()`(로그인·모든 포털 페이지 게이트 — suspended는 `/account-suspended`, closure_pending/closed/unknown은 강제 로그아웃), 세션 콘텐츠 자기서비스 쓰기 정책 26개에 상태 검사 추가(메시지 포함 전부 실증).
- [x] **Step 7(신규)**: `setStudentStatus`/`setTeacherStatus`/`setParentStatus`가 전부 `transition_account_status()` RPC 경유로 통일(직접 UPDATE는 트리거가 차단). `closure_pending`/`closed`는 의도적으로 관리자 UI에서 일반 노출하지 않음(§5.7 "closed는 일반 UI에서 복구 불가"와 대칭 — 전용 흐름은 후속 태스크).
- [x] **Step 8(신규, 서버 액션 전수 감사)**: 포크 에이전트로 `app/`·`lib/` 전체를 스캔해 `requireUser()`를 우회하던 13개 서버 액션 파일을 발견·수정(상세는 실행 로그 참고). 부수적으로 `submitCalendlyOnboarding()`의 선생님 자기 활성화 경로를 발견·제거(관리자 승인 전용으로 통일) — 사용자 승인 완료, Task 7 정책에 반영.

**DoD 체크**:
- [x] `npx tsc --noEmit` 클린
- [x] `npx vitest run`(전체 77개 파일 331개) 통과
- [x] 로컬 빈 DB + 백업 복원 DB 양쪽 적용, 기존 데이터 무결성 재확인(5명 데이터 그대로)
- [x] fail-closed, 임의조회 차단, 관리자 직접 UPDATE 차단, 허용/거부 전이 + 감사 이력, 콘텐츠 RLS 차단 각각 실제 실행 검증(로컬)
- [x] 6개 역할 RLS 회귀 확인(households 재검증, 완전 동일)
- [x] **E2E(Playwright) 실행** — Docker Desktop 무응답 문제를 해결(재시작)하고 로컬 Supabase 실 스택으로 `e2e/account-lifecycle.spec.ts`(신규 5개 시나리오) + 기존 `e2e/auth-roles.spec.ts`(6개) 전체 17개 통과.
- [x] 원격 변경 대상·영향 범위·롤백 절차 요약 보고 → 사용자 승인 완료 → `supabase db push --linked`로 원격 개발 DB 적용 완료(커밋 `8216f5d`) → 원격 재검증 7항목(migration 목록 일치, 데이터 보존, 상태별 로그인/서버 작업 차단, 관리자 전환+감사 이력, 콘텐츠 RLS, smoke test) 전부 통과. 상세는 실행 로그 "원격 적용 (2026-08-30 완료)" 참고.

---

## Task 3: `households`/`household_members` cutover + 백필 (완료, 원격 적용 2026-08-30)

> **원본 구분 정정(2026-08-30, 사용자 확정)**: 가족 구성·보호자–자녀 **관계** 원본은 `households`/`household_members`로 cutover하되, 보호자 **역할별 계정 정보와 계정 상태**(Task 2의 `pending/active/suspended/closure_pending/closed`, `transition_account_status()`, 감사 이력)는 당분간 `parents`가 계속 원본이다. `parents` 테이블 자체를 동결 대상에 넣지 않는다 — **동결 대상은 `guardian_students`뿐**(관계 원본으로서 완전히 사용 중단, 앱 읽기·쓰기 모두 제거, DB에서도 쓰기 차단). `parents`는 이 태스크에서 스키마·RLS를 건드리지 않는다.

**Files:**
- Create: `supabase/migrations/20260901000000_r2_household_backfill_and_guardian_freeze.sql`
- Modify: `app/admin/users-actions.ts`, `app/admin/users-data.ts`, `app/student/credits-data.ts`, `app/student/credits-actions.ts`, `app/parent/children-data.ts`, `app/teacher/review/[sessionId]/review-actions.ts`
- `app/parent/credits-data.ts`는 **변경 없음** — `parents.referral_code`(계정 정보) 조회만 하고 `guardian_students`는 쓰지 않는다(사전 조사에서 확인).

**배경**: §4.19 결정 3 — 장기 dual-write 금지, 앱 읽기·쓰기·RLS를 신규 구조로 함께 cutover. 단, "레거시 테이블 동결"의 대상은 관계 테이블(`guardian_students`)뿐이며 계정 정보 테이블(`parents`)은 Task 2가 현재 사용 중이므로 예외.

- [x] **Step 1**: 백필 마이그레이션(`20260901000000_r2_household_backfill_and_guardian_freeze.sql`) — 기존 `guardian_students` 전체를 connected-components(레이블 전파)로 그룹핑해 `households`/`household_members`로 변환. 재실행 멱등성·중복 방지·복수 자녀/복수 보호자 그룹핑·주 보호자 정확히 1명(unique 인덱스 + 다수결 자동 선정)을 전부 합성 픽스처로 실제 실행 검증(완료 기준 1~4). `contracts_v3`/`subject_enrollments`/`teacher_assignments` 백필은 범위 밖 유지.
- [x] **Step 2**: **레거시 RLS 함수 fan-out 수정** — `is_guardian_of()`를 `guardian_students` 확인 OR `is_household_guardian_of()`로 재정의. **로컬 E2E 실행 중 추가로 발견**: `profiles` 테이블 SELECT 정책이 `is_guardian_of()`를 거치지 않고 `guardian_students`를 직접 양방향 인라인 조회하고 있어 별도 사각지대였다 — 신규 함수 `shares_household_as_guardian_or_child()`로 같은 마이그레이션에서 함께 수정(정적 리뷰로는 못 잡고 실제 브라우저 E2E로만 발견됨).
- [x] **Step 3**: `guardian_students` 쓰기 차단 — `BEFORE INSERT OR UPDATE OR DELETE` 트리거로 무조건 차단(관리자 포함, 우회 플래그 없음), 기존 "관리자만 생성/삭제" RLS 정책 제거. `parents`의 `transition_account_status()`는 실제 실행으로 영향 없음을 재확인(완료 기준 7).
- [x] **Step 4**: `inviteParent`/`inviteStudent`(`app/admin/users-actions.ts`) — `inviteParent`는 `parents` insert 그대로 유지, `inviteStudent`는 `findOrCreateHouseholdForGuardian()`(기존 household 재사용 또는 신규 생성+주 보호자 지정)로 교체. 시그니처는 확장하지 않음(다중 보호자 초대 UX는 Task 4).
- [x] **Step 5**: `users-data.ts`의 `loadParents`/`loadStudents` — 관계 조인만 `household_members` 기반으로 교체, 계정 정보 조회는 그대로.
- [x] **Step 6**: `app/student/credits-data.ts`/`credits-actions.ts`, `app/parent/children-data.ts` — `household_members` 기반으로 재작성. `children-data.ts`의 `isPrimary`는 자녀 자신의 `household_members.is_primary` 값을 그대로 써서 기존 "자녀 전환" UI 의미(주 보호자 여부가 아니라 기본 표시 자녀)를 보존.
- [x] **Step 7**: `notifyGuardiansOfReview()` — household 내 보호자 전체 조회(자연히 중복 없음) 후 `parents.status='closed'`인 보호자 제외.
- [x] **Step 8**: `guardian_students` 활성 코드 참조 0건 확인(`grep`으로 재확인). `parents`는 계속 사용.

**DoD 체크(완료 기준 반영, 전부 로컬에서 실제 실행으로 검증)**:
- [x] 백필 재실행 멱등성 — 합성 픽스처로 2회 연속 실행, `household_members` 행 수(9행) 불변 확인
- [x] 기존 관계와 대조 후에만 신규 생성(재실행 시 중복 없음, 위와 동일 테스트로 함께 확인)
- [x] 복수 자녀·복수 보호자 픽스처(P1-S1, P1-S2, P2-S2, P2-S3 사슬)로 connected-components 정확성 검증 — 5명 전부 한 household로 병합
- [x] 주 보호자 정확히 1명 — unique 인덱스 + 다수결 자동 선정 로직 확인
- [x] `guardian_students` 활성 코드 참조 0건
- [x] `parents.status` 기반 보호자 정지→재활성화 **실제 브라우저 E2E** 통과(`account-lifecycle.spec.ts`에 추가)
- [x] `guardian_students` 직접 쓰기가 관리자 권한으로도 차단되고 동시에 `parents`의 `transition_account_status()`는 정상 동작함을 함께 확인
- [x] 리뷰 알림 — 중복 없음 + `closed` 제외를 vitest 3건으로 검증(`submitReview -> notifyGuardiansOfReview`)
- [x] 6개 역할 RLS 회귀 — `is_guardian_of()`/`profiles` 정책 수정 반영, household-only 공동보호자가 실제로 인식됨을 확인. 무관한 선생님/anon은 여전히 0행(회귀 없음)
- [x] `npx tsc --noEmit` 클린, `npx vitest run`(79개 파일 339개) 전부 통과, `npx playwright test --workers=1`(18개) 전부 통과
- [x] 원격 적용 전 변경 대상·영향 범위 요약 보고 → 사용자 승인 완료 → `supabase db push --linked`로 원격 개발 DB 적용 완료(커밋 `fe653c6`) → 로컬·원격 migration 목록 일치, 데이터 보존, 백필 관계 일치, 신규 5가지 데이터 불변조건(가족그룹 미분할/주보호자 정확히 1명/`primary_guardian_id` 일치/자녀 단일소속/중복등록 없음), `guardian_students` 관리자·service_role 쓰기 차단, `parents.status` 정지·재활성화, 실제 보호자 계정 자녀 이름 조회, 6개 역할 RLS 회귀 — 전부 원격에서 실제 실행으로 재검증 통과. 상세는 실행 로그 "원격 적용 (2026-08-30 완료, 커밋 `fe653c6`)" 참고.

---

## Task 4: 계정 초대 상태 모델 + 보호자 주도 초대 (완료, 원격 적용 2026-08-31)

> **설계 확정(2026-08-30, 2차 정정)**: Supabase 기본 초대 링크에 의존하지 않고 ALTON 자체 토큰(해시만 저장, 원문 미보관)을 쓴다. 선생님 초대는 이 태스크 범위 밖(Task 7로 완전 이관, 이번엔 비활성화만). 상세 설계·버그 발견 내역·검증 결과는 `docs/2026-08-29-r2-migration-execution-log.md`의 "Task 4" 항목 참고 — 이 절은 최종 구현 기준으로 갱신했다.

**Files:**
- Create: `supabase/migrations/20260902000000_r2_account_invites.sql`
- Create: `app/admin/invite-actions.ts`, `app/parent/invite-actions.ts`, `app/api/invite/accept/route.ts`, `app/invite/manual-review/page.tsx`, `lib/invite-email.ts`, `e2e/mailbox.ts`, `e2e/account-invites.spec.ts`
- Modify: `app/admin/users-actions.ts`(`inviteParent`/`inviteStudent` 재작성, `inviteTeacher` 비활성화), `app/admin/UsersTab.tsx`(선생님 초대 폼 제거)

**배경**: §4.19 결정 1, 4.

- [x] **Step 1**: `account_invites`(email_normalized/email_original, invitee_name, invitee_grade, role[parent|student], household_id, invited_by, status[pending/accepted/expired/revoked/superseded/failed/manual_review], token_hash, token_generation, expires_at, last_sent_at, accepted_at, revoked_at, superseded_by_id, auth_user_id, target_profile_id) + `account_invite_events`(감사 전용). 중복 방지는 `(email_normalized, role, household_id)` 부분 unique 인덱스에 `NULLS NOT DISTINCT`를 적용(household_id가 NULL인 보호자 초대도 실제로 막힘).
- [x] **Step 2**: 재발송 로직 — Supabase `inviteUserByEmail` 재호출 방식을 쓰지 않는다(자체 토큰이므로 무관). `resend_account_invite()`가 대상 행을 `FOR UPDATE`로 잠그고, 이전 행을 먼저 `superseded`로 전이한 뒤 새 `token_generation+1` 행을 생성 — 구 토큰은 `claim_account_invite()`에서 `superseded`로 명시 거부된다.
- [x] **Step 3**: 24시간 내 3회 재발송 제한 — `resend_count` 누적 컬럼이 아니라 `account_invite_events`의 `resent` 이벤트를 시각 기준으로 카운트(최초 발송 제외, 같은 이메일+역할+household lineage로 스코프). 실제 4연속 재발송 시도로 정확한 경계(3회 성공, 4번째 거부) 검증.
- [x] **Step 4**: 철회 — 기본은 `status='revoked'`만 변경, `admin.auth.admin.deleteUser()`는 호출하지 않는다. `resolve_manual_review_invite()`의 `revoke` action도 동일. 기존/이미 수락된 사용자는 애초에 `pending`/`manual_review`가 아니므로 철회 대상 자체가 될 수 없다(상태 머신으로 원천 차단).
- [x] **Step 5**: 보호자 주도 자녀 초대 — `app/parent/invite-actions.ts`의 `inviteChild()`. `requireGuardian()`을 별도로 만들지 않고 `requireUser()` + `profile.role === "parent"` 확인으로 처리(기존 `requireAdmin()`과 나란한 패턴이 굳이 필요하지 않을 만큼 로직이 짧음). household_id는 클라이언트 입력을 받지 않고 서버가 호출자 본인의 guardian 멤버십에서 조회 — 잘못된 household_id를 넘길 방법 자체가 없고, DB 함수도 다시 검증(이중 방어).
- [x] **Step 6**: 관리자 대리 생성 — 별도 감사 테이블을 새로 만들지 않고 `account_invite_events`의 `sent` 이벤트(actor_id=관리자)가 이미 모든 관리자 발송을 기록한다(대상 household 소유 여부와 무관하게 관리자는 애초에 임의 household에 자녀를 초대할 권한이 있으므로 별도 분기 불필요).
- [x] **Step 7(신규)**: 선생님 초대 비활성화 — `inviteTeacher()`는 `requireAdmin()` 통과 후 항상 명확한 오류를 던진다(기존 구현은 `legacyInviteTeacherByEmail`로 이름만 바꿔 보존, 삭제/Workspace 대체 구현은 Task 7). `UsersTab.tsx`의 선생님 초대 폼은 비활성화 안내 문구로 교체.

**DoD 체크(전부 로컬에서 실제 실행으로 검증)**:
- [x] 만료/재발송/철회/중복 각 케이스 실제 실행 검증
- [x] `household_id`가 NULL인 보호자 초대 중복 방지(`NULLS NOT DISTINCT`) 실제 검증
- [x] 구세대 토큰 거부(최신 generation만 허용), 동일 링크 중복 수락 멱등성
- [x] **수락↔재발송 동시 실행 경쟁 상태** — 두 psql 프로세스로 양방향(accept가 먼저/resend가 먼저) 모두 재현, `FOR UPDATE` 잠금으로 정확히 하나만 성공
- [x] 기존 가입 이메일 처리(`manual_review` 분기, `failed`와 구분) + 관리자의 `link`/`revoke` 처리
- [x] 철회 후 수락 불가 + 기존 Auth 사용자 미삭제
- [x] 만료시간 서버·DB 양쪽 검증(status 갱신이 배치로 지연돼도 시간 비교로 항상 차단)
- [x] 보호자가 남의 household에 초대 시도 시 서버+DB 양쪽에서 차단(무관한 선생님으로 재현) — 실제 공동 보호자는 정상 허용
- [x] 6개 역할 RLS(`account_invites`: 관리자 전체, 발송자 본인, 그 외 0행)
- [x] **실제 이메일 E2E**: 로컬 Mailpit(local_smtp)에서 실제 발송된 메일의 본문을 검색해 초대 링크를 추출하고, 그 링크로 계정 생성→`/set-password`→로그인까지 실제 브라우저로 완주(`e2e/account-invites.spec.ts`, 3건). 철회된 링크 방문 시 `/login` 안내도 실제 브라우저로 확인
- [x] `npx tsc --noEmit` 클린, `npx vitest run`(81개 파일 346개) 전부 통과, `npx playwright test --workers=1`(21개) 전부 통과
- [x] 원격 적용 전 변경 대상·영향 범위 요약 보고 → 사용자 승인(2가지 사전 확인 포함: `legacyInviteTeacherByEmail` 외부 노출 없음 확인, `mark_expired_invites()` 스케줄러는 blocker 아님으로 로드맵 등록) → 체크포인트 커밋 `5c3bbd9` → `supabase db push --linked`로 원격 적용 완료(커밋 `5121cbd`) → 로컬·원격 migration 목록 일치, 데이터 보존, pending 중복 차단, 만료/철회/superseded 토큰 거부, manual_review 처리, 보호자 타 household 차단, 감사 이벤트, 실제 파이프라인 시뮬레이션 — 전부 원격에서 실제 실행으로 재검증 통과, 테스트 데이터 정리 완료. 상세는 실행 로그 "원격 적용 (2026-08-31 완료)" 참고.

---

## Task 5: 계정 병합 (완료, 원격 적용 2026-08-31)

> **범위 확정(2026-08-31)**: 이 태스크는 **중복 계정 병합에만** 집중한다. 일반적인 서비스 중단(학생 수업 중단·계약 종료, 선생님 퇴사, 장기 미접속)에 대한 `inactive` 상태 도입, 장기 복귀 정책, `reactivate_account()`, 자료 유형별 보관·삭제 자동화, 제한 보관 접근통제, 정기 스케줄러는 이 태스크에서 구현하지 않는다 — 정책은 `product-architecture-v3.md` §4.13/§4.19에 확정 반영했고, 구현은 `master-roadmap-v3.md` R12의 인수 조건으로 이관했다. 상세 구현·검증 결과는 `docs/2026-08-29-r2-migration-execution-log.md` Task 5 참고.

**Files:**
- Create: `supabase/migrations/20260903000000_r2_inactive_enum.sql`, `supabase/migrations/20260903010000_r2_account_merge.sql`
- Create: `app/admin/merge-actions.ts`

**배경**: §4.19 계정 병합.

- [x] **Step 1**: `account_merges` 테이블 — 병합 매핑 전용 감사 테이블, 개인정보는 기록하지 않는다. `unique(merged_id)`로 재병합 방지 최종 방어선까지 포함.
- [x] **Step 2**: `merge_accounts(survivor_id, merged_id, reason)` — 관리자 전용 SECURITY DEFINER. 두 profile을 id 순서로 `FOR UPDATE` 잠금 후 소유권 필드 약 40개 컬럼(직접 profiles FK + students/teachers/parents FK 경유, 레거시 v1 테이블 포함)을 재배정. **실행 중 실제로 발견한 예외**: `teacher_rate_history.teacher_id`는 R1의 `protect_teacher_rate_history()` 트리거가 우회 플래그로도 변경을 막도록 이미 설계돼 있었다 — 검토 결과 이건 옳은 제약이라 재배정 대상에서 제외하고 감사·행위자 필드와 같은 성격("당시 이 시급이 누구 것이었는가")으로 재분류했다. 병합 원본은 즉시 `closed` 전환(우회 플래그, 사유 `merged`).
- [x] **Step 3**: `anonymize_merged_account(profile_id)` — 관리자 전용, `account_merges` 존재 확인 + 30일 경과 확인 + inactive 거부. PII 비가역 스크럽, 멱등, 실행 로그는 실행자·시각·ID만.
- [x] **Step 4**: 관리자 전용 — 비관리자 세션에서 두 함수 호출 시 거부 확인(테스트로 검증).

**DoD 체크(전부 로컬에서 실제 실행으로 검증)**:
- [x] 동시 병합 시도 실제 재현(psql 프로세스 2개) — 정확히 하나만 성공
- [x] 병합 후 생존 계정에서 이전된 데이터 조회 가능(`notifications`로 실측, 소유권 재배정 로직은 동일 패턴)
- [x] 감사·행위자 필드(`account_status_events`, `teacher_rate_history.teacher_id`/`created_by`) 불변 확인
- [x] 병합 원본으로 로그인 불가(실제 브라우저, `e2e/account-merge.spec.ts`)
- [x] 병합 재실행 시 명확한 거부(중복 재배정 방지), `anonymize_merged_account()` 재실행 멱등성(조용히 재성공) — 두 함수의 재시도 안전성을 의도적으로 다르게 설계(병합은 관리자의 실수 신호를 명확히 드러내야 하고, 익명화는 부분 실패 후 재시도가 정상 시나리오)
- [x] 병합 원본 익명화 후에도 생존 계정 데이터·PII에 영향 없음, 익명화된 원본 UUID를 참조하는 감사 이력 정상 조회
- [x] inactive 계정은 두 함수 대상이 아님을 함수 내부 검사 + 실제 실행으로 확인
- [x] 비관리자 세션에서 두 함수 호출 시 거부
- [x] `npx tsc --noEmit` 클린, `npx vitest run`(82개 파일 351개) 전부 통과, `npx playwright test --workers=1`(22개) 전부 통과
- [x] 원격 적용 전 변경 대상·영향 범위 요약 보고 → 사용자 승인(`teacher_rate_history_with_merged()` 결합 조회 추가 확정 포함) → 백업(`~/alton-db-backups/pre-r2-task5-full-2026-08-31.sql`, SHA-256 기록) → `supabase db push --linked`로 원격 적용 완료(커밋 `44aeeda`+`17d3d65`) → 로컬·원격 41개 migration 일치, 기존 데이터 보존, 소유권 재배정, 감사·행위자 불변, 결합 시급 이력 조회, 즉시 로그인 차단, 재병합/inactive/비관리자 거부, 30일 익명화, smoke test — 전부 원격에서 실제 실행으로 재검증 통과. 상세는 실행 로그 "원격 적용 (2026-08-31 완료)" 참고.

---

## Task 6: 13세 미만 보호자 동의

**Files:**
- Create: `supabase/migrations/20260831050000_r2_minor_consent.sql`
- Modify: 학생 관련 RLS(로그인 후 게이트), `app/student/*`(수업 참여/메시지 작성 차단 지점)

**배경**: §4.13 확장.

- [ ] **Step 1**: `students`에 `date_of_birth date`(Task 2에서 profiles로 뒀다면 위치 재확인 — 학생 전용이면 `students` 테이블이 더 적합, 결정 필요) + `guardian_consents` 테이블(`student_id`, `policy_version`, `consented_by`, `consented_at`, `revoked_at`, `method`).
- [ ] **Step 2**: 13세 미만 판별 함수 + 동의 없이는 로그인/수업 참여/메시지 작성을 막는 서버 가드(DB 트리거로 원천 차단할지, 서버 액션 가드로만 할지는 R1 스타일대로 **DB 트리거를 최종 방어선으로** 두는 것을 기본으로 한다).
- [ ] **Step 3**: 동의 철회 처리 — 철회 시 해당 학생을 다시 동의 대기 상태로.
- [ ] **Step 4**: 동의 UI(보호자 포털) — 문구 버전 표시, 동의/철회 버튼.

**DoD 체크**: 13세 미만 미동의 학생의 로그인 후 게이트 실제 확인, 동의 후 정상 이용 확인, 철회 후 재차단 확인, 역할별 RLS.

---

## Task 7: 선생님 Google Workspace 계정 자동 프로비저닝

> **정책 확정(2026-08-30, Task 2 승인 시 함께 확정)**: 아래 요구사항은 사용자가 명시적으로 확정한 것이며, Task 7 착수 전까지는 구현하지 않는다. Task 2에서는 선생님 자기 활성화 경로 제거(관리자 승인 전용 전환)까지만 반영했다.

**핵심 정책**: 선생님은 본인이 계정을 생성·활성화하지 않는다. 관리자가 `@alton.education` Google Workspace 계정을 발급하고, 관리자가 최종적으로 `pending→active` 전환(`transition_account_status()`)을 수행한다.

**Files:**
- Create: `app/admin/workspace-actions.ts`
- Create: `lib/google-workspace.ts`(Admin SDK Directory API 클라이언트)
- Create: `supabase/migrations/20260831060000_r2_workspace_provisioning_state.sql`

**배경**: §4.20. **이 태스크는 실제 Google Cloud/Workspace 리소스에 대고 실행된다** — 착수 전 별도로 알린다(Gate C와 동일한 수준의 실제 작업이므로).

### 선생님 활성화(`pending→active`) 선행조건 (확정)

관리자가 아래를 전부 확인해야 `active` 전환을 수행할 수 있다:
1. 관리자가 선생님 기본 정보와 개인 이메일을 등록
2. `@alton.education` Google Workspace 계정 발급 완료
3. 선생님이 발급된 Workspace 계정으로 최초 로그인
4. ALTON 인증 사용자와 사전 생성된 선생님 레코드 연결 완료
5. 시급 설정 완료(R1 `has_valid_current_teacher_rate`)
6. 필수 프로필·온보딩 정보 입력 완료
7. 선생님 계약 확인 완료(계약 자동화 전에는 관리자가 수동 확인)

과목·학생 배정은 활성화 이후 절차이므로 선행조건에 포함하지 않는다.

### 신규 데이터 필드 (확정)

- `personal_contact_email`(필수) — Workspace 계정 발급 전에 수집. 목적 2가지: (a) Google Workspace 복구 이메일, (b) ALTON 계정 발급/보안/운영 연락 알림.
- `workspace_recovery_email`(필수, 기본값 `personal_contact_email`).
- `personal_phone`(선택).

### 프로비저닝 흐름 (확정, 9단계)

1. 관리자가 ALTON에서 선생님 기본 정보를 등록
2. ALTON에 `provisioning` 상태의 선생님 레코드 생성
3. Google Admin SDK로 `@alton.education` 계정 생성
4. Google 고유 사용자 ID·Workspace 이메일·ALTON 선생님 ID 연결
5. 개인 이메일로 최초 설정 안내 발송
6. 선생님이 발급된 Workspace 계정으로 Google 로그인
7. 로그인 콜백에서 사전 등록된 계정인지 검증
8. Supabase Auth 사용자와 기존 선생님 레코드 연결
9. 관리자가 위 7가지 선행조건 확인 후 `pending→active` 전환

### 보안·정합성 제약 (확정, 반드시 준수)

- **이메일 주소만 일치한다고 선생님 레코드를 자동 생성·연결하면 안 된다** — 사전 생성된 provisioning 레코드와 Google 고유 사용자 ID를 함께 검증(이메일 일치만으로는 스푸핑 방지 불가, R1/R2의 "임의 조회·자동 연결 금지" 원칙과 동일 계열).
- 부분 실패·중복 생성 방지·재시도·취소/회수 지원 필요, 전 과정 감사 이력 필요.
- 임시 비밀번호는 ALTON DB에 평문 저장 금지, 이메일로 평문 발송 금지.

### 기존 Calendly 온보딩 처리 (확정)

기존 Calendly 온보딩 UI/코드(`app/teacher/onboarding-actions.ts`, `TeacherHomeDashboard.tsx`)는 Task 2에서 자기 활성화만 제거했고 URL 저장 기능은 유지된 상태다. **이 태스크에서 완전히 제거한다** — 9단계 프로비저닝 흐름으로 대체.

- [ ] **Step 1**: `teachers`에 `workspace_email text`, `workspace_google_user_id text`(스푸핑 방지용 고유 ID), `workspace_provisioning_status(provisioning|created|linked|active_pending|failed|revoked)` 컬럼 + `personal_contact_email`(필수)/`workspace_recovery_email`(필수, 기본값 `personal_contact_email`)/`personal_phone`(선택) 컬럼 추가. 감사 이력 테이블(`workspace_provisioning_events` 또는 기존 `account_status_events`와 유사한 패턴) 추가 — 생성/연결/실패/재시도/취소 각 이벤트 기록.
- [ ] **Step 2**: Directory API로 계정 생성/충돌 확인 로직(Gate C의 domain-wide-delegation 패턴 재사용 가능 여부 확인 — 그때 스크립트는 세션 스크래치패드에 있었고 앱에 병합되지 않았으므로 처음부터 앱 코드로 다시 만든다). 임시 비밀번호는 생성 즉시 안내 메일 발송 후 평문을 어디에도 남기지 않는 방식으로 처리(예: 발송 직후 폐기, DB에는 저장하지 않음).
- [ ] **Step 3**: 관리자 등록 → provisioning 레코드 생성 → Workspace 계정 생성 → Google 고유 사용자 ID 연결까지의 9단계 흐름을 `app/admin/workspace-actions.ts`로 구현. 로그인 콜백(단계 7)에서 이메일이 아니라 **사전 생성된 provisioning 레코드 + Google 고유 사용자 ID**로 검증 후 Supabase Auth 사용자와 연결.
- [ ] **Step 4**: 부분 실패 재처리·중복 생성 방지·취소/회수 — `workspace_provisioning_status='failed'`인 선생님을 관리자 화면에서 재시도할 수 있는 버튼 제공, 이미 생성된 계정에 재시도 시 중복 생성 대신 기존 계정 상태 확인 후 이어서 진행.
- [ ] **Step 5**: 관리자 활성화 화면에 위 7가지 선행조건 체크리스트 표시, 전부 충족 확인 후에만 `transition_account_status(..., 'active')` 호출 가능하도록 UI 가드(DB 트리거는 이미 R2에서 관리자 권한만 확인하므로, 7가지 선행조건 확인은 앱 레벨 — 최종 방어선이 필요하면 이 스텝에서 판단).
- [ ] **Step 6**: 기존 Calendly 온보딩 UI/코드 제거(`app/teacher/onboarding-actions.ts`의 `submitCalendlyOnboarding()`, `TeacherHomeDashboard.tsx`의 관련 UI). `teachers.calendly_scheduling_url` **컬럼 자체는 이 태스크에서 삭제하지 않는다** — 데이터를 보존할 가치가 있어서가 아니라(개발·테스트 데이터, `product-architecture-v3.md` §4.13 정정 참고), 학생·보호자용 Calendly 예약 코드가 R6 전까지 이 컬럼을 계속 참조하기 때문이다. 실제 컬럼 삭제는 `master-roadmap-v3.md` R6 "레거시 제거 — Calendly·Zoom 완전 삭제"에서 수행한다.

**DoD 체크**: 실제 Sandbox(또는 운영 도메인의 테스트 계정)로 생성 성공/충돌/실패 각 케이스 실제 실행 검증, 재처리·취소/회수 흐름 실제 실행 검증, 이메일 일치만으로는 연결이 안 되는지(스푸핑 방지) 실제 실행 검증, 임시 비밀번호가 DB/로그에 평문으로 남지 않는지 코드 검토+실행 검증.

---

## Task 8: 권한 모델 — `is_admin() OR capability`

**Files:**
- Modify: Task 4/5/6/7에서 새로 만든 서버 액션들
- Modify 또는 신규: 해당 RLS 정책

**배경**: §4.19 결정 10.

- [ ] Task 4(초대)/Task 5(병합)/Task 6(동의 처리)의 신규 서버 액션에 `requireAdmin()` 대신 `requireAdmin() 또는 requireCapability('필요권한')` 패턴의 신규 가드를 만들어 적용.
- [ ] 대응하는 신규 테이블의 RLS 정책도 `is_admin() OR current_user_has_capability('...')`로 작성(R1 패턴 그대로).
- [ ] 기존 `is_admin()`만 쓰는 레거시 서버 액션(`inviteParent` 등)은 **이번에 건드리지 않는다** — R12로 이관.

**DoD 체크**: 특정 capability만 가진 운영자 역할로 실제 RLS 테스트(6개 역할 매트릭스에 "capability 보유 운영자" 케이스 추가).

---

## Task 9: E2E/통합 테스트 보강

**Files:**
- Modify: `e2e/auth-roles.spec.ts`
- Create: `e2e/account-lifecycle.spec.ts`(신규)

- [ ] 초대→비밀번호 설정→로그인 전체 흐름 E2E.
- [ ] `suspended` 계정 로그인 차단 확인.
- [ ] 보호자가 자녀를 추가 초대하는 흐름.
- [ ] 중복 이메일 초대 시 안내 메시지 확인.
- [ ] 13세 미만 미동의 학생 게이트 확인.

**DoD 체크**: 전체 E2E 스위트 통과.

---

## 실행 순서와 의존성

`Task 1(즉시) → Task 2(상태 모델, 선행) → Task 3(household cutover) → Task 4(초대, Task 3에 의존) → Task 5(병합, Task 2/3에 의존) → Task 6(동의, Task 2에 의존) → Task 7(Workspace, Task 1의 active-전환 로직과 연결) → Task 8(권한, Task 4/5/6/7 전체에 걸침) → Task 9(전체 완료 후 E2E)`

각 태스크 완료 시 이 계획 문서의 체크박스를 갱신하고, `docs/2026-08-29-r2-migration-execution-log.md`에 실행 결과를 기록한다.
