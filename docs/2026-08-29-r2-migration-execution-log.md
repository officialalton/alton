# R2 — 마이그레이션·구현 실행 로그

- 목적: R1 실행 로그(`2026-08-29-r1-migration-execution-log.md`)와 동일한 형식으로 R2 각 태스크의 실행 기록을 남긴다.
- 원칙: R1과 동일 — 로컬 검증 → 역할별 RLS/동시성 실측(해당 시) → 원격 변경 대상·영향 범위 요약 보고 → `supabase db push --linked` → 원격 재검증.

## Task 1 — R1 회귀 버그 수정: 시급 이력 연동 (완료, 2026-08-30)

### 배경

`app/admin/users-actions.ts`의 `inviteTeacher()`/`setTeacherHourlyRate()`가 `teachers.hourly_rate_krw`만 직접 쓰고 R1의 `set_teacher_rate()`를 호출하지 않아, R1의 `teachers_enforce_active_requires_rate` 트리거 때문에 이 경로로 처리된 선생님이 `active` 전환에서 영구히 막히는 회귀가 있었다(R2 investigation 문서 §0 참고).

### 조사 중 추가로 발견한 것

`app/admin/payouts-data.ts`(정산 금액 계산: `amountKrw = hourly_rate_krw * totalMinutes / 60`)도 `teachers.hourly_rate_krw`를 직접 읽는다. `teacher_rate_history`만 진실 소스로 만들고 이 읽기 경로를 다시 쓰는 것은 R4/R10 범위의 더 큰 변경이 되므로, 대신 `set_teacher_rate()` 자체가 `teacher_rate_history` insert와 같은 트랜잭션에서 `teachers.hourly_rate_krw`도 함께 갱신하도록 수정했다(신규 마이그레이션 `20260831000000_r2_sync_teachers_hourly_rate.sql`). 이렇게 하면 `payouts-data.ts`/`users-data.ts`는 전혀 수정할 필요가 없다.

### 변경 내역

1. **`supabase/migrations/20260831000000_r2_sync_teachers_hourly_rate.sql`**: `set_teacher_rate()`를 `CREATE OR REPLACE` — 기존 로직(락 → 기존 이력 종료 → 새 이력 생성) 그대로 유지하고, 마지막에 `update teachers set hourly_rate_krw = p_amount_minor where id = p_teacher_id;` 한 줄만 추가.
2. **`app/admin/users-actions.ts`**:
   - `inviteTeacher()`: `teachers` insert에서 `hourly_rate_krw` 직접 저장을 제거하고, insert 직후 서비스-role 클라이언트로 `admin.rpc('set_teacher_rate', {...})` 호출. 실패 시 "선생님 계정은 생성됐지만 시급 이력 생성에 실패했습니다... 다시 시도해주세요" 안내.
   - `setTeacherHourlyRate()`: `supabase.from("teachers").update(...)` 대신 서비스-role 클라이언트로 `admin.rpc('set_teacher_rate', {...})` 호출.
   - `setTeacherStatus()`: `status==='active'`일 때 먼저 서비스-role로 `has_valid_current_teacher_rate` RPC를 호출해 확인하고, 없으면 DB 트리거의 원시 오류 대신 "이 선생님은 아직 시급이 설정되지 않아 active로 전환할 수 없습니다. 먼저 시급을 설정해주세요"를 던진다. DB 트리거는 그대로 최종 방어선으로 남긴다.
3. **`app/admin/users-actions.test.ts`**: 기존 `inviteTeacher` 테스트를 새 동작에 맞게 수정하고, `set_teacher_rate` RPC 실패 케이스, `setTeacherHourlyRate`의 RPC 호출·직접 update 안 함, `setTeacherStatus`의 active 전환 시 사전 확인 성공/실패/`pending` 전환 시 미확인 등 신규 테스트 6건 추가.

### 검증

| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` | 클린 |
| `npx vitest run`(전체) | 76개 파일 320개 테스트 전부 통과 |
| `npx vitest run app/admin/users-actions.test.ts` | 8개 테스트 전부 통과(신규 6 + 기존 2) |
| 로컬 DB 실제 SQL 시퀀스 재현(신규 테스트 선생님) | `teachers insert(pending)` → `set_teacher_rate(42000,'KRW')` → `has_valid_current_teacher_rate` = `true` → `update status='active'` 성공 → `hourly_rate_krw`가 `42000`으로 동기화됨 확인 |
| 부정 케이스(시급 없는 선생님) | `has_valid_current_teacher_rate` = `false` 확인, 사전 확인을 우회해 직접 `UPDATE status='active'` 시도해도 DB 트리거가 여전히 차단(최종 방어선 살아있음) 확인 |
| `set_teacher_rate()` 동기화 로직 재확인 | 기존 테스트 선생님(김도경) 시급을 65000으로 변경 → `teachers.hourly_rate_krw`도 65000으로 동기화 확인 |

### 원격 적용

`supabase db push --linked`로 `20260831000000_r2_sync_teachers_hourly_rate.sql` 1개 파일 적용 성공. `supabase db query --linked`로 확인: 기존 두 선생님(장세준·김도경) `hourly_rate_krw=50000` 그대로 보존(함수 본문 교체만이라 기존 데이터 영향 없음), `set_teacher_rate()` 함수 본문에 신규 동기화 라인이 실제로 배포됐음을 `pg_proc.prosrc` 조회로 확인.

## Task 2 — 계정 상태 모델 확장 (로컬 검증 완료, 원격 적용 승인 대기)

### 배경

product-architecture-v3.md §5.7 확정 모델(`pending→active→suspended(재활성화 가능)→closure_pending→closed(복구 불가)`)을 스키마·서버·DB 3단으로 구현했다. 1차 구현을 보고하자 사용자가 7가지 보완을 요구했다(pending 게이트, fail-closed, 임의 사용자 조회 차단, 서버 액션 전수 감사, DB 레벨 상태 전이 강제+감사 이력, 실제 브라우저 E2E, 원격 baseline 커밋) — 이 절은 보완이 전부 반영된 최종본을 기록한다.

### 최종 마이그레이션 3개

1. `20260831010000_r2_account_status_enums.sql` — `teacher_status`/`student_status`에 `suspended`/`closure_pending`/`closed` 추가(레거시 `student_status.inactive`는 사용 중단), `parent_status`(5단계) 신규.
2. `20260831011000_r2_account_status_apply.sql`:
   - 컬럼 추가: `parents.status`(기본 `active`), `profiles.timezone`/`date_of_birth`, `households.default_timezone`.
   - `account_status_events`(신규, INSERT-only 감사 테이블): `profile_id`, `previous_status`, `new_status`, `changed_by`, `reason`, `created_at`.
   - `get_account_status(uuid)`: **fail-closed**로 재작성 — NULL/프로필 없음/역할별 상태 행 없음은 전부 `'unknown'`(예전엔 전부 `'active'`였다). 임의 프로필 조회가 가능해 `service_role` 전용으로 좁힘(anon/authenticated에서 revoke).
   - `current_account_status()`/`current_account_active()`(신규) — `auth.uid()` 고정, 인자 없음. 앱·RLS는 전부 이 두 함수만 쓴다(임의 타인 조회 불가능한 안전한 형태, `current_user_has_capability()`와 동일 패턴).
   - `protect_account_status()` 트리거(students/teachers/parents) — **관리자를 포함해** 누구도 status를 직접 UPDATE할 수 없다(1차 버전은 관리자를 예외로 허용했었다 — 그러면 아래 전이 검증·감사 이력을 그냥 우회할 수 있어서 막았다). `transition_account_status()` 내부의 트랜잭션 로컬 우회 플래그(`app.bypass_status_protect`)를 통해서만 예외적으로 허용.
   - `transition_account_status(profile_id, new_status, reason)`(신규, 유일한 정상 경로) — `is_admin()` 내부 검사(관리자 전용), 허용된 전이만 명시적으로 검증(`pending→active`, `active↔suspended`, `active/suspended→closure_pending`, `closure_pending→closed`, 그 외 전부 거부), 통과 시 우회 플래그로 실제 UPDATE 수행 후 `account_status_events`에 감사 이력 자동 기록.
3. `20260831020000_r2_account_status_content_rls.sql`(신규) — `chat_messages` 하나만이 아니라 `profiles`/`students`/`teachers`/`parents` 본인 수정, `teacher_curriculum_templates`(+units/materials), `session_memos`, `homework_items`, `session_problem_attempts`, `teacher_problem_tags`, `vocab_words`, `session_doc_links`, `session_files`, `canvas_annotations`, `sessions`(화이트보드), `session_reviews`, `session_student_feedback`, `problems` — 자기서비스 쓰기 정책 전부에 `current_account_active()`를 추가했다. 정책 조건을 base 마이그레이션만 보고 가정했다가 이후 소규모 패치들(20260828070000/080000/090000/100000/110000)이 이름·조건을 바꿔놓은 걸 놓쳐 첫 실행이 실패했고, `pg_policy`를 직접 조회해 실제 조건을 확인한 뒤 다시 작성했다.

### 앱 코드 (13개 서버 액션 파일 + UI 4개 + seed.sql)

**서버 액션 전수 감사**(포크 에이전트로 `app/`·`lib/` 전체의 `"use server"` 파일을 스캔): `requireUser()`/`requireAdmin()`을 거치지 않고 자체적으로 `auth.getUser()`만 하거나 아예 아무 인증도 없이 쓰기 작업을 하는 파일 13개를 찾아 전부 `@/lib/auth`의 `requireUser()`(또는 그걸 내부에서 쓰도록 재작성한 로컬 래퍼)로 교체했다:

| 파일 | 원래 상태 |
|---|---|
| `app/student/chat-actions.ts` | 인증 검사 전무 |
| `app/session/[id]/homework-actions.ts` | 인증 검사 전무 |
| `app/session/[id]/scratchpad-actions.ts` | 인증 검사 전무 |
| `app/session/[id]/vocab-actions.ts`(`removeVocabWord`) | 인증 검사 전무 |
| `app/session/[id]/canvas-actions.ts` | 로컬 `auth.getUser()`만 |
| `app/student/memo-actions.ts` | 로컬 `auth.getUser()`만 |
| `app/student/review-actions.ts` | 로컬 `auth.getUser()`만 |
| `app/student/credits-actions.ts` | 로컬 `auth.getUser()`만 |
| `app/session/[id]/actions.ts`(로컬 `requireStudent()`) | 로컬 `auth.getUser()`만 |
| `app/session/[id]/aigen-actions.ts`(로컬 `requireSessionTeacher()`) | 로컬 `auth.getUser()`+profile 직접 조회 |
| `app/teacher/review/[sessionId]/review-actions.ts`(로컬 `requireSessionTeacher()`) | 로컬 `auth.getUser()`+profile 직접 조회 |
| `app/teacher/mysubjects-actions.ts`(5개 함수 중 1개만) | 4개 함수 인증 검사 전무 |
| `app/session/[id]/problemlog-actions.ts`(로컬 `requireUser()` — **이름만 같고 무관**) | 로컬 `auth.getUser()`만 |

**부수 발견 — `submitCalendlyOnboarding()`의 자기 활성화 경로 제거**: 이 함수는 Calendly 링크 저장과 동시에 `teachers.status`를 직접 `'active'`로 바꿔왔다(선생님 본인이 스스로 활성화). `protect_account_status` 트리거가 이제 이 직접 UPDATE 자체를 막고, 애초에 "본인이 스스로 active 전환"은 `transition_account_status()`의 관리자 전용 원칙과도 맞지 않는다 — Calendly 링크만 저장하도록 고치고, active 전환은 관리자가 `setTeacherStatus()`(시급 이력 확인 포함)로 별도 승인하도록 바꿨다. `app/teacher/TeacherHomeDashboard.tsx`도 "등록 즉시 활성화" 문구를 "등록 접수, 관리자 확인 대기"로 갱신.

**`supabase/seed.sql` 수정**: 로컬 개발 시드가 선생님 2명을 `status='active'`로 직접 INSERT해와서, `supabase db reset` 실행 중 R1의 `teachers_enforce_active_requires_rate` 트리거에 막혀 실패했다(원격에는 이미 실제 데이터라 없는 문제지만, 로컬 개발 환경 전체가 이 시드에 의존하므로 실제로 막혀야 발견되는 문제였다) — `teachers` INSERT 앞에 `teacher_rate_history` 초기 이력을 미리 넣어 해결.

**`app/admin/users-actions.ts`**: `setStudentStatus`/`setTeacherStatus`/`setParentStatus`가 전부 `transition_account_status()` RPC를 호출하도록 교체(직접 UPDATE는 이제 트리거가 차단하므로).

### 상태별 허용/차단 기능 매트릭스 (실제 실행으로 검증)

| 계정 상태 | 로그인 후 도착지 | 세션 유지 | 예약/메시지/과제/화이트보드/커리큘럼 등 변경 작업 | 본인 status 직접 변경 | 재활성화 경로 |
|---|---|---|---|---|---|
| `pending` | `/account-pending`(정상 포털 진입 차단) | 유지 | 서버 액션(`requireUser()` 통과)·RLS(`current_account_active()`) 둘 다에서 차단 | 불가(트리거) | 관리자가 `active`로 전환(`pending→active` 허용) |
| `active` | 정상 role 홈 | 유지 | 전부 허용 | 불가(트리거, 관리자 포함) | 해당 없음 |
| `suspended` | `/account-suspended` | **유지**(재활성화 시 새로고침만으로 복귀) | 서버·RLS 둘 다 차단 | 불가(트리거) | 관리자가 `active`로 전환(`suspended→active` 허용) |
| `closure_pending` | 강제 로그아웃 후 `/login?error=...` | 종료 | 차단(로그인 자체가 안 됨) | 불가(트리거) | 없음(다음 단계는 `closed`뿐) |
| `closed` | 강제 로그아웃 후 `/login?error=...` | 종료 | 차단(로그인 자체가 안 됨) | 불가(트리거, 관리자 포함 — `transition_account_status()`도 `closed→그 무엇이든` 거부) | **일반 경로 없음**(§5.7 종착 상태) |
| 상태 조회 불가(`unknown`, 데이터 이상) | 강제 로그아웃 후 `/login?error=...` | 종료 | 차단 | 해당 없음 | 관리자가 원인 파악 후 직접 조치 필요 |

### 검증

| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` | 클린 |
| `npx vitest run`(전체) | **77개 파일 331개 테스트 전부 통과** |
| fail-closed 확인 | `get_account_status(null)` / 존재하지 않는 uuid → `'unknown'`(예전 `'active'` 버그 재현 불가 확인) |
| 임의 사용자 조회 차단 확인 | `authenticated`/`anon` 역할로 `get_account_status(다른 사람 uuid)`/`is_account_active(...)` 직접 호출 → `permission denied` 확인. `current_account_status()`(본인 전용)는 정상 동작 |
| `transition_account_status()` 허용 전이 확인 | `pending→active`, `active→suspended`, `suspended→active`, `active→closure_pending`, `closure_pending→closed` 5가지 전부 실제 실행 성공, `account_status_events`에 5건 정확히 기록(`changed_by`=관리자 id, `reason` 포함) |
| `transition_account_status()` 거부 확인 | `pending→suspended`, `pending→closure_pending`, `closed→active` 등 허용 목록 밖 전이 시도 → 전부 명시적 오류로 거부, 상태 변경 없음 확인 |
| 권한 확인 | 본인(비관리자)이 `transition_account_status()` 호출 → "관리자만 할 수 있습니다" 거부. `service_role`이 호출 → `auth.uid()` 없어 `permission denied`(애초에 grant 안 됨, `reopen_session()`과 동일 설계) |
| 관리자 직접 UPDATE 차단 확인(1차 버전에서 놓쳤던 부분) | 관리자 세션으로 `teachers`/`students`/`parents.status`를 `transition_account_status()` 없이 직접 UPDATE 시도 → 트리거가 예외 없이 차단 |
| 콘텐츠 RLS 차단 확인(실제 실행) | `vocab_words` INSERT: active 학생 → 성공, `suspended` 학생 → RLS 위반으로 차단, 재활성화 후 다시 성공 — 3단계 전부 실측 |
| 시급 무결성 트리거와의 상호작용 확인 | 시급 이력 없는 `pending` 선생님을 `transition_account_status(..., 'active')`로 전환 시도 → R1의 `teachers_enforce_active_requires_rate` 트리거가 (별개로) 정상 차단 — 두 트리거가 서로 간섭 없이 함께 작동 |
| 6개 역할 RLS 회귀(로컬 Supabase 실 스택, `alton_r1_test` 스크래치 DB 둘 다) | 익명(`unknown`, 0행)/학생(`active`, 1행)/보호자(`active`)/선생님(`active`, 1행)/관리자(`active`) — R1 때와 동일 패턴 유지 |
| 데이터 무결성 | `profiles=5, enrollments=1, sessions=0, students=1, teachers=2, parents=1` — 마이그레이션 전후 동일(로컬 Supabase는 별도 시드 계정 8명 포함) |
| **실제 브라우저 E2E(Playwright, Docker 문제 해결 후 실행)** | Docker Desktop이 무응답 상태(오래된 좀비 `docker image inspect` 프로세스 + 데몬 자체 응답 지연)였다 — 재시작으로 해결. `supabase db reset`으로 로컬 Supabase 스택에 전체 마이그레이션+시드 적용 성공. 신규 `e2e/account-lifecycle.spec.ts`(5개 시나리오: suspended 로그인 차단, suspended 세션 중 포털 직접 접근 차단, 관리자 재활성화 후 정상 로그인, closure_pending/closed 강제 로그아웃, 허용/거부 전이 종합) 전부 통과. 기존 `e2e/auth-roles.spec.ts`(6개) 포함 **전체 E2E 스위트 17개 전부 통과** — 회귀 없음 |

### 원격 적용 대상 및 영향 범위

**신규 마이그레이션 3개**: `20260831010000_r2_account_status_enums.sql`, `20260831011000_r2_account_status_apply.sql`, `20260831020000_r2_account_status_content_rls.sql`.

**앱 코드**: `lib/auth.ts`, `app/login/actions.ts`, `app/post-auth/page.tsx`, `app/account-suspended/page.tsx`(신규), `app/account-pending/page.tsx`(신규), `app/admin/users-actions.ts`, `app/admin/StudentDetailPanel.tsx`, `app/admin/TeacherDetailPanel.tsx`, `app/admin/UsersTab.tsx`, `app/teacher/onboarding-actions.ts`, `app/teacher/TeacherHomeDashboard.tsx`, `app/teacher/mysubjects-actions.ts`, `app/session/[id]/actions.ts`, `app/session/[id]/aigen-actions.ts`, `app/session/[id]/canvas-actions.ts`, `app/session/[id]/homework-actions.ts`, `app/session/[id]/scratchpad-actions.ts`, `app/session/[id]/vocab-actions.ts`, `app/session/[id]/problemlog-actions.ts`, `app/student/chat-actions.ts`, `app/student/credits-actions.ts`, `app/student/memo-actions.ts`, `app/student/review-actions.ts`, `app/teacher/review/[sessionId]/review-actions.ts`, `supabase/seed.sql`(로컬 개발 전용, 원격에는 적용 안 됨).

**테스트**: `lib/auth.test.ts`(신규), `app/admin/users-actions.test.ts`, `app/admin/StudentDetailPanel.test.tsx`, `app/teacher/onboarding-actions.test.ts`, `app/teacher/TeacherHomeDashboard.test.tsx`, `app/session/[id]/problemlog-actions.test.ts`, `e2e/account-lifecycle.spec.ts`(신규).

**영향 범위**:
- 기존 테이블에 컬럼만 추가, enum은 값 추가만(DROP/RENAME 없음). 기존 5명 실사용자 데이터는 전부 안전하게 백필(부모 active, 학생/선생님 기존 status 그대로).
- **원격 적용 즉시 효력 발생하는 행동 변화**: (1) `students`/`teachers`/`parents.status` 직접 UPDATE는 관리자 포함 전면 차단 — `transition_account_status()`만이 정상 경로. (2) 선생님이 Calendly 링크 등록만으로 자동 active 전환되던 흐름 제거 — 이후 관리자가 별도로 승인해야 함(기존 pending 선생님이 있다면 운영 프로세스 변경 필요, §7 확인 요청 참고). (3) 세션 콘텐츠(과제/단어장/커리큘럼/화이트보드/리뷰 등) 자기서비스 쓰기 전부에 계정 상태 검사 추가 — 현재 원격 실사용자 5명은 전부 active/pending이라 즉시 차단되는 사람은 없음.
- `suspended`/`closure_pending`/`closed`로의 실제 전이는 관리자가 명시적으로 호출해야만 발생 — 배포 직후 자동으로 정지되는 계정 없음.

**롤백 절차**:
1. **DB**: 3개 파일 전부 `CREATE`/`ALTER TABLE ADD COLUMN`/`ALTER TYPE ADD VALUE`/`CREATE OR REPLACE FUNCTION`/`CREATE TRIGGER`/`DROP POLICY`+`CREATE POLICY`뿐이다. 실패 시 실패한 파일이 만든 객체만 개별 `DROP`. `20260831020000`이 바꾼 정책들은 이 로그와 마이그레이션 파일에 원래 조건이 그대로 남아 있어 `CREATE POLICY`로 복원 가능. enum 추가값은 되돌릴 수 없지만(Postgres 제약) 무해하게 남는다.
2. **앱**: 이번 변경 이전 커밋으로 되돌리면 게이트·트리거 의존 코드가 사라져 즉시 기존 동작으로 복귀(DB 트리거 자체는 남아있지만 앱이 `transition_account_status()`를 호출하지 않게 되므로 기존 `setXStatus` 직접 UPDATE 경로는 다시 트리거에 막힌다 — 완전 롤백하려면 DB도 §1 절차로 되돌려야 함).
3. 데이터 삭제는 이 라운드의 어떤 파일에도 없다.

### 확인 요청 (원격 적용 승인 전)

1. **선생님 자기 활성화 흐름 제거**: 기존에는 선생님이 Calendly 링크만 등록하면 즉시 active가 됐다. 이제는 관리자가 `setTeacherStatus()`로 별도 승인해야 한다 — 원격에 이미 이 흐름으로 pending 상태로 대기 중인 선생님이 있다면(현재 원격 데이터 기준으로는 없음, 로컬 확인 필요 시 재확인 가능), 운영팀에 프로세스 변경을 안내해야 한다.
2. 이전에 보고했던 레거시 R0 SECURITY DEFINER anon 노출(§Task 1 이전 R1 로그) 항목은 이번 라운드와 무관하게 그대로 master-roadmap-v3.md R12로 이관돼 있다 — 재확인 불필요.
