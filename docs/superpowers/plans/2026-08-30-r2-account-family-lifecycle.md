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
- `households`/`household_members` cutover(Task 3)만 예외적으로 "레거시 테이블은 읽기 전용 동결, 삭제 안 함" 원칙을 따른다(§4.19 결정 3).
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

## Task 3: `households`/`household_members` cutover + 백필

**Files:**
- Create: `supabase/migrations/20260831020000_r2_household_backfill.sql`
- Modify: `app/admin/users-actions.ts`, `app/admin/users-data.ts`
- Modify: 관련 RLS 정책 파일(신규 마이그레이션)

**배경**: §4.19 결정 3 — 장기 dual-write 금지, 앱 읽기·쓰기·RLS를 신규 구조로 함께 cutover.

- [ ] **Step 1**: 백필 마이그레이션 — 기존 `parents`(1행) + `guardian_students`(1행)를 `households`+`household_members`로 변환(Gate B §6.1-6.2 매핑 그대로, R1 실행 로그 §6 백필 계획과 동일 원칙). `contracts_v3`/`subject_enrollments`/`teacher_assignments` 백필은 **이 태스크 범위 밖**(R3 계약 cutover와 묶임, 조사 문서 §6 참고).
- [ ] **Step 2**: `inviteParent`/`inviteStudent`를 `households`/`household_members`에 쓰도록 재작성. `inviteStudent`는 더 이상 `parentId`만 받지 않고, "이미 존재하는 household에 자녀 추가" 경로와 "관리자가 새 household를 만들며 부모+자녀를 함께 초대" 경로 둘 다 지원해야 한다(Task 4의 보호자-주도 초대와 인터페이스를 맞춰야 함 — Task 4와 함께 설계).
- [ ] **Step 3**: `users-data.ts`의 `loadParents`/`loadStudents`를 `households`/`household_members` 기준으로 재작성(복수 보호자 표시 가능해짐).
- [ ] **Step 4**: 레거시 `parents`/`guardian_students` 테이블은 앱에서 더 이상 쓰지 않되 DROP하지 않는다. 이 두 테이블에 남아있는 레거시 RLS 정책도 그대로 둔다(R12에서 정리).

**DoD 체크**: 6개 역할 RLS 실측 재확인(households/household_members는 R1에서 이미 검증된 정책 재사용), E2E `auth-roles.spec.ts` 통과, 관련 화면(`app/admin/UsersTab.tsx` 등) 실제 로컬 dev 서버로 smoke test, 원격 적용은 **앱 코드 배포와 같은 시점에** 수행(feature flag 없이 한 번에 — Gate B 11번 원칙).

---

## Task 4: 초대 상태 모델 + 보호자 주도 초대

**Files:**
- Create: `supabase/migrations/20260831030000_r2_account_invites.sql`
- Create: `app/admin/invite-actions.ts` 또는 기존 `users-actions.ts` 확장
- Create: `app/parent/invite-actions.ts`(신규 — 보호자가 자녀 초대)
- Create 관련 UI 컴포넌트(보호자 포털에 "자녀 초대" 화면 추가)

**배경**: §4.19 결정 1, 4.

- [ ] **Step 1**: `account_invites` 테이블(제안 스키마는 조사 문서 §4 참고) — `email`, `role`, `household_id`(nullable, 학생 초대 시 어느 household에 연결할지), `invited_by`, `status(pending|accepted|expired|revoked)`, `expires_at`, `resend_count`, `created_at`, `accepted_at`.
- [ ] **Step 2**: 재발송 로직 — 같은 이메일 pending 초대가 있으면 새 행 대신 `resend_count` 증가 + `expires_at` 갱신 + Supabase `inviteUserByEmail` 재호출(기존 링크 무효화는 Supabase의 재초대가 처리하는지, 앱에서 별도 처리가 필요한지 확인 필요 — Supabase Auth의 재초대 시 이전 토큰이 실제로 무효화되는지 로컬/Sandbox에서 검증한다).
- [ ] **Step 3**: 24시간 내 3회 재발송 제한 — `resend_count`와 최근 재발송 타임스탬프로 서버에서 강제.
- [ ] **Step 4**: 철회 — `admin.auth.admin.deleteUser()`(아직 비밀번호 미설정 상태의 `auth.users` 행 삭제) + `account_invites.status='revoked'`.
- [ ] **Step 5**: 보호자 주도 자녀 초대 — 보호자 포털에 신규 화면/액션 추가, `requireGuardian()`류 가드(신규, `requireAdmin()`과 대칭) + 자기 household에만 자녀를 추가할 수 있도록 RLS/서버 검증.
- [ ] **Step 6**: 관리자 대리 생성 — 기존 admin 흐름 유지하되, `account_invites.invited_by`가 admin이고 대상 household가 그 admin 소유가 아닐 때 감사 이력(별도 테이블 또는 기존 감사 로그 패턴 재사용)에 남긴다.

**DoD 체크**: 만료/재발송/철회/중복 각 케이스 실제 실행 검증(로컬), Supabase 자체 만료와 7일 정책의 정합성 실측(Sandbox 또는 로컬 Supabase 인증 설정으로), 역할별 RLS(보호자가 남의 household에 초대 시도 시 차단) 실측.

---

## Task 5: 계정 병합

**Files:**
- Create: `supabase/migrations/20260831040000_r2_account_merge.sql`
- Create: `app/admin/merge-actions.ts`

**배경**: §4.19 결정 5.

- [ ] **Step 1**: `account_merge_log` 테이블(`survivor_id`, `merged_id`, `merged_by`, `merged_at`, `affected_tables_summary jsonb`).
- [ ] **Step 2**: 병합 서버 액션 — 병합 대상 계정의 로그인 즉시 차단(status를 `closed` 또는 별도 플래그로), FK 재배정을 명시적 트랜잭션으로 순서대로 수행(어떤 테이블들을 재배정해야 하는지는 그 시점까지 존재하는 전체 스키마를 다시 훑어야 함 — R3~R7 스키마가 늘어날수록 이 목록도 늘어난다는 점을 코드 주석에 남긴다), 실패 시 전체 롤백.
- [ ] **Step 3**: 병합된 인증 계정 30일 후 삭제 — cron/scheduled job 필요(기존 프로젝트에 유사 스케줄러가 있는지 확인, 없으면 이 부분은 R2에서 "삭제 대상 표시까지만" 하고 실제 자동 삭제 실행은 R12(보존·삭제 자동화, 이미 GW-14 blocker로 이관돼 있음)와 합칠지 검토 — **정책 재확인까지는 아니지만 설계 판단이 필요하므로 이 서브태스크 착수 전 보고**.
- [ ] **Step 4**: 동시 병합 방지 — 같은 계정을 동시에 병합 대상으로 두 번 지정하는 경쟁 상태를 락으로 방지(R1의 `set_teacher_rate()` 패턴 재사용).

**DoD 체크**: 동시 병합 시도 실제 재현(백그라운드 세션 2개), 재배정 후 데이터 무결성(수업 이력·정산 이력 유지) 확인, 관리자 전용 RLS 확인.

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
