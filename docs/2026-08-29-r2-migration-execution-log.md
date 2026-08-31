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

## Task 2 — 계정 상태 모델 확장 (완료, 원격 적용 2026-08-30)

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

### 확인 요청 (원격 적용 전, 승인 완료)

1. **선생님 자기 활성화 흐름 제거**: 기존에는 선생님이 Calendly 링크만 등록하면 즉시 active가 됐다. 이제는 관리자가 `setTeacherStatus()`로 별도 승인해야 한다 — 원격에 이미 이 흐름으로 pending 상태로 대기 중인 선생님이 있다면(현재 원격 데이터 기준으로는 없음, 로컬 확인 필요 시 재확인 가능), 운영팀에 프로세스 변경을 안내해야 한다. → 사용자 승인 완료. 선생님은 본인이 계정을 생성·활성화하지 않고, 관리자가 Google Workspace 계정을 발급한 뒤 관리자가 최종적으로 `pending→active`를 수행하는 정책으로 확정됨(§Task 7 참고).
2. 이전에 보고했던 레거시 R0 SECURITY DEFINER anon 노출(§Task 1 이전 R1 로그) 항목은 이번 라운드와 무관하게 그대로 master-roadmap-v3.md R12로 이관돼 있다 — 재확인 불필요.

### 원격 적용 (2026-08-30 완료)

커밋 `8216f5d`의 3개 마이그레이션을 `supabase db push --linked`로 원격 개발 DB에 적용. 적용 직후 `supabase migration list --linked`로 로컬·원격 마이그레이션 목록 일치 확인(총 36개, 불일치 없음).

**재검증 결과**:

| 항목 | 결과 |
|---|---|
| 로컬·원격 migration 목록 일치 | `supabase migration list --linked` — local/remote 36개 전부 동일, 불일치 없음 |
| 기존 사용자 상태·데이터 보존 | `profiles=5, enrollments=1, sessions=0, students=1, teachers=2, parents=1, credit_transactions=1` — 적용 전후 행 수 동일. 실사용자 5명 상태: 학생(장세온) `active`, 선생님(장세준) `active`(시급 50000 보존), 선생님(김도경) `pending`(시급 50000 보존), 학부모(장지만) `active` — 전부 기존 값 그대로 백필됨 |
| 함수 권한 분리(fail-closed·임의조회 차단) | `get_account_status`/`is_account_active`는 `anon`/`authenticated`에서 `has_function_privilege = false`, `service_role`만 `true`. `current_account_status`/`current_account_active`는 `anon`/`authenticated`/`service_role` 전부 `true`(self-only라 안전). `transition_account_status`는 `authenticated`만 `true`(`anon`/`service_role`은 `false`, R1 `reopen_session()`과 동일 설계) — 실제 grant 상태가 설계와 정확히 일치 |
| 감사 테이블·트리거 존재 확인 | `account_status_events`: RLS 활성화, SELECT 정책만 존재(INSERT 정책 없음 — SECURITY DEFINER 함수 경유만 가능, 설계대로). `students_protect_status`/`teachers_protect_status`/`parents_protect_status` 트리거 3개 전부 존재 확인 |
| 관리자 상태 전환 + 감사 이력(실제 원격 RPC 호출) | 실사용 선생님(장세준, `29430e24-...`)에게 실제 관리자 계정(`b2a34464-...`, 원격 실제 admin id)으로 `transition_account_status()`를 호출해 `active→suspended→active`를 왕복 실행 — 최종 상태는 원래대로 `active` 복원(가역적 검증, 실사용자 상태에 영구 변경 없음). `account_status_events`에 두 건 모두 정확히 기록(`changed_by`=관리자 id, `previous_status`/`new_status`/`reason` 정확) |
| 잘못된 전이 거부(원격 실제 호출) | 같은 계정에 `active→pending`(허용 목록 밖) 시도 → `허용되지 않는 상태 전이입니다: active → pending` 오류로 즉시 거부, 상태 변경 없음 |
| 관리자 직접 UPDATE 차단(원격 실제 호출) | 관리자 세션으로 `transition_account_status()` 없이 `teachers.status`를 직접 UPDATE 시도 → `계정 상태(status)는 transition_account_status()를 통해서만 변경할 수 있습니다` 트리거 오류로 차단 |
| 본인 상태 조회(self-only) | 선생님 본인 세션에서 `current_account_status()`/`current_account_active()` 호출 → `active`/`true` 정상 반환 |
| 임의 사용자 조회 차단(원격 실제 호출) | 선생님 세션으로 다른 사람의 `get_account_status(uuid)` 호출 시도 → `permission denied for function get_account_status`로 함수 호출 자체가 거부됨(행 단위가 아니라 함수 단위 차단, 설계대로) |
| 콘텐츠 RLS `current_account_active()` 반영 확인 | `pg_policy` 직접 조회로 `profiles`/`students`/`teachers`/`parents`/`sessions`/`session_problem_attempts`/`session_reviews`/`session_student_feedback`/`session_files`/`session_doc_links`/`canvas_annotations`/`homework_items`/`problems`/`vocab_words`/`teacher_curriculum_templates`(+units/materials)/`teacher_problem_tags` 총 26개 정책에 `current_account_active()`가 실제로 배포됐음을 확인 |
| 핵심 smoke test | `students` × `profiles` 조인, `enrollments` 조회 등 기본 쿼리 정상 동작 확인 — 스키마 변경으로 인한 조회 경로 손상 없음 |

**결론**: 7가지 재검증 항목 전부 통과. 실사용자 데이터 손상·의도치 않은 상태 변경 없음. Task 2 완료 처리.

## Task 3 — households/household_members cutover + guardian_students 동결 (완료, 원격 적용 2026-08-30)

### 배경 — 원본 구분 정정

1차 영향 범위 보고 후 사용자가 원본 구분을 확정했다: 가족 구성·보호자-자녀 **관계** 원본은 `households`/`household_members`로 cutover하되, 보호자 **역할별 계정 정보·계정 상태**(Task 2의 `pending/active/suspended/closure_pending/closed`, `transition_account_status()`, 감사 이력)는 당분간 계속 `parents`가 원본이다. **동결 대상은 `guardian_students`뿐**이며 `parents`는 이 태스크에서 스키마·데이터 어느 쪽도 건드리지 않는다.

### 마이그레이션: `20260901000000_r2_household_backfill_and_guardian_freeze.sql`

1. **`is_guardian_of()` fan-out 수정**: 이 함수는 R1 이전부터 있었고 `is_session_related()`/`is_enrollment_related()`를 포함해 `teachers`/`chat`/`curriculum_docs`/`curriculum_templates`/`session_memos`/`vocab_words` 등 다수의 레거시 RLS 정책이 경유한다. R1은 신규 테이블(`contracts_v3`, `entitlement_*` 등)에서만 `is_guardian_of() OR is_household_guardian_of()`로 수동 OR를 걸었고, 그 이전부터 있던 레거시 정책들은 여전히 `guardian_students`만 봤다 — `guardian_students`를 동결하면 이후 새로 생기는 가족 관계를 이 정책들이 영원히 인식하지 못하는 회귀가 생긴다. 개별 정책 수십 개를 고치는 대신 `is_guardian_of()` 함수 자체를 `guardian_students` 확인 OR `is_household_guardian_of()`로 재정의해 모든 호출부에 한 번에 전파했다.
2. **`profiles` SELECT 정책의 별도 사각지대(로컬 E2E로 발견)**: `is_guardian_of()`를 고친 뒤 실제 브라우저 E2E(학부모가 자녀 이름을 보는지)를 돌려보니 실패했다 — `profiles` 테이블의 "본인/관계자/관리자 조회" 정책은 `is_guardian_of()`를 거치지 않고 `guardian_students`를 양방향(보호자→학생, 학생→보호자)으로 직접 인라인 조회하고 있었다. 이건 정적 리뷰로는 못 잡고 실제 실행으로만 발견됐다(R1/R2에서 반복된 패턴). `shares_household_as_guardian_or_child(p_other_id)` 신규 함수(같은 household에서 역할이 다른 두 멤버인지 대칭적으로 확인)를 만들어 이 정책에도 추가했다.
3. **백필**: `guardian_students`(다대다 관계)를 connected-components로 그룹핑해 `households`/`household_members`로 이관하는 PL/pgSQL 블록 — 레이블 전파로 연결된 보호자·자녀를 하나의 household로 묶고, 이미 반영된 관계는 건드리지 않는 방식으로 재실행해도 안전하게 작성했다. 주 보호자는 `guardian_students.is_primary` 지정 횟수가 가장 많은 사람(동률이면 최초 가입자)으로 자동 선정한다.
4. **주 보호자 유일성 보장**: `household_members (household_id) where (role='guardian' and is_primary)` 부분 unique 인덱스로 "최대 1명"을 DB에서 강제.
5. **`guardian_students` 쓰기 차단**: 기존 "관리자만 생성/삭제" RLS 정책은 `service_role`이 우회 가능해 실질적 차단이 아니었다 — `BEFORE INSERT OR UPDATE OR DELETE` 트리거로 예외 없이(관리자 포함, 우회 플래그도 없음 — 이 테이블엔 정상적으로 써야 할 경로가 이제 전혀 없으므로) 차단.

### 로컬 검증(완료 기준 1~7 반영)

| 항목 | 결과 |
|---|---|
| 백필 connected-components 정확성 | 합성 픽스처(P1-S1, P1-S2, P2-S2, P2-S3, 즉 S2가 P1/P2를 잇고 P2가 S2/S3을 잇는 사슬)로 재현 — 5명 전부 하나의 household로 정확히 병합됨 확인 |
| 주 보호자 자동 선정 | 위 픽스처에서 P1은 `is_primary=true` 1회, P2는 2회 → P2가 주 보호자로 선정됨(다수결 로직 확인) |
| 백필 멱등성 | 같은 백필 로직을 두 번 연속 실행해도 `household_members` 행 수(9행) 불변 확인 |
| `guardian_students` 쓰기 차단 | 직접 INSERT/UPDATE/DELETE 시도 전부 트리거 오류로 거부 확인(관리자 권한으로도 동일) |
| `parents.status` 전환 무관 확인 | 같은 세션에서 관리자가 `transition_account_status()`로 실제 보호자 계정을 `active→suspended→active` 왕복 — Task 3 변경과 완전히 독립적으로 정상 동작, `account_status_events` 감사 이력도 정상 기록 |
| household-only 보호자 인식(fan-out 수정 검증) | `guardian_students`에 전혀 없는 순수 household 전용 공동보호자로 `is_guardian_of()` 호출 → `true` 반환 확인(수정 전이었다면 `false`) |
| 활성 코드 참조 0건 | `grep`으로 `app/`·`lib/` 전체에서 `.from("guardian_students")` 호출 0건 확인(주석의 역사적 언급만 남음) |
| `npx tsc --noEmit` | 클린 |
| `npx vitest run` | **79개 파일 339개 테스트 전부 통과**(신규: `inviteStudent` household 재사용/신규생성 2건, `notifyGuardiansOfReview` 중복없음/closed 제외/무관계 3건, `loadChildren` 정렬/빈결과/복수household 3건) |
| **실제 브라우저 E2E** | 로컬 Supabase 스택으로 `--workers=1` 실행, **18개 전부 통과**(기존 17 + 신규 학부모 정지→재활성화 1건). 이 라운드에서 학부모 자녀 이름 표시 검증 케이스를 추가하는 과정에서 위 `profiles` 정책 사각지대를 실제로 발견·수정함(정적 리뷰로는 못 잡았을 버그) |

### 앱 코드 변경(guardian_students → household_members)

`app/admin/users-actions.ts`(`inviteStudent`가 `household_members` 재사용/신규생성 로직으로 교체, `parents` insert는 그대로), `app/admin/users-data.ts`(`loadParents`/`loadStudents`의 관계 조인만 교체, 계정 정보 조회는 그대로), `app/student/credits-data.ts`/`credits-actions.ts`(주 보호자 조회), `app/parent/children-data.ts`(자녀 목록 — `is_primary`는 자녀 자신의 값으로 유지해 기존 "자녀 전환" UI 의미 보존), `app/teacher/review/[sessionId]/review-actions.ts`(`notifyGuardiansOfReview`가 household 내 보호자 전체에게 중복 없이 알리되 `parents.status='closed'`인 보호자는 제외). `app/parent/credits-data.ts`는 `parents.referral_code`만 조회해 변경 없음.

`supabase/seed.sql`도 함께 수정 — 로컬 개발 시드가 `guardian_students`에 직접 INSERT하던 걸 `households`/`household_members` 직접 삽입으로 교체(동결 트리거 때문에 기존 방식은 이제 실패한다). 김민지(주 보호자)-지훈·이서아(두 자녀), 지훈에게 공동 보호자 이현우를 추가해 "한 보호자가 복수 자녀", "한 자녀가 복수 보호자"를 로컬에서 상시 검증 가능하게 했다.

### 원격 적용 대상 및 영향 범위 (승인 대기)

**신규 마이그레이션 1개**: `20260901000000_r2_household_backfill_and_guardian_freeze.sql`.

**앱 코드**: 위 6개 파일 + `supabase/seed.sql`(로컬 전용, 원격 미적용).

**영향 범위**:
- 원격 실사용 데이터: `guardian_students` 1행(학부모 `b91d45f5-...`-학생 `84557af2-...`)이 `households`/`household_members`로 백필된다. `parents`/`students`/`guardian_students` 원본 행은 삭제되지 않는다(`guardian_students`는 이후 읽기 전용, 쓰기만 차단).
- **원격 적용 즉시 효력 발생하는 행동 변화**: (1) `guardian_students` 직접 UPDATE/INSERT/DELETE는 관리자 포함 전면 차단. (2) 신규 학생 초대는 이제 `household_members`에 관계를 쓴다(기존 실사용 관계는 백필로 이미 이관돼 있어 조회 결과는 동일). (3) `profiles` 조회 정책이 household 기반 관계를 추가로 인정하도록 넓어짐(기존 `guardian_students` 기반 접근은 그대로 유지, 순수 추가).
- 원격에는 현재 다중 자녀/다중 보호자 데이터가 없어(1가족 1자녀) connected-components 로직이 실제로는 자명한 케이스만 처리하지만, 로컬에서 복잡한 그래프로 이미 검증했다.

### 원격 적용 (2026-08-30 완료, 커밋 `fe653c6`)

`supabase db push --linked`로 `20260901000000_r2_household_backfill_and_guardian_freeze.sql` 1개 파일 적용 성공. `supabase migration list --linked`로 로컬·원격 37개 마이그레이션 전부 일치 확인(불일치 없음).

**재검증 결과**:

| 항목 | 결과 |
|---|---|
| 로컬·원격 migration 목록 일치 | 37개 전부 동일 |
| 기존 로그인 계정·프로필 보존 | `profiles=5, students=1, teachers=2, parents=1` 적용 전후 동일. `guardian_students`는 원본 1행 그대로 보존(삭제 안 함, 읽기 전용) |
| 백필 전후 보호자-자녀 관계 일치 | `guardian_students`의 유일한 행(부모 `b91d45f5-...`, 학생 `84557af2-...`, `is_primary=true`)이 `household_members`에 정확히 guardian+child(모두 같은 household, 자녀의 `is_primary=false`는 관계 원본과 무관한 "기본 자녀" 표시용 필드라 관계 일치 여부와는 별개)로 반영됨 확인 |
| **불변조건 1: 연결된 가족 그룹이 여러 household로 쪼개지지 않음** | `guardian_students`의 부모-자녀 쌍이 실제로 같은 `household_id`에 속하는지 조인 검사 — 위반 0건 |
| **불변조건 2: 보호자가 있는 household마다 `is_primary=true`가 정확히 1명** | `group by household_id having count(*) filter (where is_primary) <> 1` — 위반 0건(전체 household 대상) |
| **불변조건 3: `households.primary_guardian_id`와 `is_primary=true` 보호자 일치** | 불일치 0건 |
| **불변조건 4: 자녀는 정확히 1개 household에만 소속** | `role='child' group by profile_id having count(*) > 1` — 위반 0건 |
| **불변조건 5: 같은 household에 동일 profile 중복 등록 없음** | `group by household_id, profile_id having count(*) > 1` — 위반 0건 |
| `guardian_students` 관리자 권한 직접 쓰기 차단 | 관리자 인증 세션(`authenticated` + 실제 admin id)으로 INSERT 시도 → `guardian_students는 동결됐습니다` 트리거 오류로 거부 |
| `guardian_students` service_role 쓰기 차단 | `db query`(service_role/superuser 경로)로 DELETE 시도 → 동일 트리거 오류로 거부 |
| `parents.status` 정지·재활성화 정상 동작 | 실제 관리자 세션으로 `transition_account_status()`를 실제 원격 보호자 계정에 `active→suspended→active` 왕복 실행 — 정상 동작, 최종 상태 `active`로 원상복구(가역적 검증), `account_status_events`에 두 건 모두 정확히 기록 |
| 실제 보호자 계정의 자녀 이름 조회 | 실제 원격 보호자 세션(`b91d45f5-...`)으로 `household_members`+`profiles` 조인 조회 → 자녀 이름("장세온") 정상 반환 — `shares_household_as_guardian_or_child()` 수정이 원격에서도 정상 작동 확인 |
| 6개 역할 RLS 회귀 | 같은 household의 `household_members` 조회 결과: 익명 0행, 학생 본인 1행(자기 행만), 보호자 본인 2행(전체), 무관 선생님 2명 각 0행, 관리자 2행(전체) — 설계대로 정확히 분리됨, 회귀 없음 |

**결론**: 계획된 재검증 항목과 사용자가 추가 요청한 5가지 데이터 불변조건 전부 통과. 실사용자 데이터 손상·의도치 않은 상태 변경 없음. Task 3 완료 처리.

**롤백 절차**: 이 마이그레이션은 `CREATE OR REPLACE FUNCTION`/`CREATE POLICY`(DROP 후 재생성)/`INSERT`(백필)/`CREATE INDEX`/`CREATE TRIGGER`뿐이다. 실패 시 `guardian_students_freeze` 트리거와 `household_members_one_primary_guardian` 인덱스만 개별 DROP하면 되고, `is_guardian_of()`/`profiles` 정책은 이 로그에 원래 조건이 남아 있어 복원 가능하다. 백필된 `household_members` 행은 원본 `guardian_students` 데이터를 그대로 옮긴 것이라 삭제해도 정보 손실이 없다(원본이 남아있으므로).

### 확인 요청 (원격 적용 전)

원격 재검증 계획: (1) `guardian_students`→`households`/`household_members` 백필 결과가 기존 관계와 정확히 일치하는지, (2) `guardian_students` 직접 쓰기 차단, (3) `parents.status` 전환이 여전히 정상 동작하는지, (4) 학부모 실계정으로 자녀 이름이 정상 조회되는지(profiles 정책 수정 반영 확인), (5) 6개 역할 RLS 회귀. 승인 시 진행한다.

## Task 4 — 계정 초대 상태 모델 + 보호자 주도 초대 (로컬 검증 완료, 원격 적용 승인 대기)

### 배경 — 범위와 확정 설계

1차 설계 보고 후 사용자가 5가지를 최종 반영해 확정했다: (1) `household_id`가 NULL인 보호자 초대에도 실제로 작동하는 중복 방지, (2) 기존 가입 이메일은 오류(`failed`)가 아니라 `manual_review`로 분리하고 관리자가 명시적으로 확인한 계정에만 연결, (3) 만료는 수락 API가 시간으로 직접 검사(저장된 status와 무관)하고 status 컬럼 갱신은 별도 배치, (4) 재발송·수락은 각각 하나의 트랜잭션에서 대상 행을 `FOR UPDATE`로 잠가 경쟁 상태를 해소, (5) 선생님 초대는 이 태스크에서 다루지 않고 관리자 UI·서버 액션 둘 다 명확히 비활성화(Task 7에서 대체).

**범위**: 관리자→보호자 초대, 관리자/보호자→자녀 초대만. 선생님 초대(`inviteTeacher`)는 Task 7(Google Workspace 프로비저닝)로 완전히 이관 — 이번 라운드에서는 관리자 권한 확인 후 항상 명확한 오류를 던지도록 막기만 하고, 기존 구현은 `legacyInviteTeacherByEmail`로 이름만 바꿔 삭제하지 않고 보존했다(호출부 없음).

### 마이그레이션: `20260902000000_r2_account_invites.sql`

**테이블**: `account_invites`(email_normalized/email_original, invitee_name, invitee_grade, role[parent|student], household_id, invited_by, status[pending/accepted/expired/revoked/superseded/failed/manual_review], token_hash, token_generation, expires_at, last_sent_at, accepted_at, revoked_at, superseded_by_id, auth_user_id, target_profile_id), `account_invite_events`(감사 전용, invite_id/event_type/actor_id/detail/created_at).

**중복 방지**: `(email_normalized, role, household_id)` 부분 unique 인덱스에 `NULLS NOT DISTINCT`(PG15+)를 적용해 `household_id`가 NULL인 보호자 초대도 실제로 중복이 막히는지 확인.

**상태 전이(트리거로 강제)**: `(신규)→pending → {accepted | superseded | revoked | expired | failed | manual_review}`, `manual_review → {accepted | revoked}`. 그 외 전이는 `protect_account_invite_status()` 트리거가 무조건 거부(우회 플래그는 지정된 함수 내부에서만).

**함수(전부 SECURITY DEFINER)**:
- `create_account_invite(email, name, role, household_id, grade?)` — 관리자는 보호자/자녀 둘 다, 보호자는 본인 household에 자녀만(서버+DB 이중 검증). 토큰은 `gen_random_bytes(32)`를 hex로 인코딩(URL-safe), 해시(`digest(..., 'sha256')`)만 저장.
- `resend_account_invite(invite_id)` — 대상 행을 `FOR UPDATE`로 잠그고 24시간 내 3회 제한(최초 발송 제외, 같은 이메일+역할+household lineage의 `resent` 이벤트만 카운트) 확인 후, 이전 행을 먼저 `superseded`로 바꾼 뒤(그래야 부분 unique 인덱스와 충돌 없이) 새 pending 행을 생성.
- `claim_account_invite(token)` — anon도 호출 가능(로그인 전 방문자). 대상 행을 `FOR UPDATE`로 잠그고: 만료는 시간으로 직접 검사(status와 무관, 항상 우선) → 이미 `accepted`면 멱등 반환 → `pending`이 아니면 그 상태 그대로 예외 → 이메일이 이미 가입돼 있으면(`auth.users` 직접 조회) `manual_review`로 전이 후 반환 → 아니면 `accepted`로 전이 후 반환.
- `finalize_account_invite(invite_id, auth_user_id)` — service_role 전용. Node 서버가 Auth 사용자를 만든 뒤 호출, `profiles`/`parents` 또는 `students`+`household_members`(child)를 생성. `target_profile_id`가 이미 있으면 그대로 반환(멱등, 부분 실패 재시도에도 중복 생성 없음).
- `revoke_account_invite(invite_id)` — `pending`/`manual_review`만 철회 가능, 상태만 변경(Auth 계정 삭제는 하지 않음).
- `resolve_manual_review_invite(invite_id, action, target_profile_id?, auth_user_id?)` — 관리자 전용. `link`는 관리자가 명시적으로 확인한 기존 프로필에만 연결(이메일 일치만으로 자동 연결 안 함), `revoke`는 그냥 철회.
- `mark_expired_invites()` — 관리자 전용 배치. 만료된 pending 행을 일괄 `expired`로 전환 + 감사 이력 기록(수락 차단 자체는 이 배치와 무관하게 `claim_account_invite`의 시간 검사가 항상 보장).

### 로컬 검증 — 실제 실행으로 발견/수정한 버그 3건

DB 함수를 실제로 psql에서 반복 실행하며 검증하는 과정에서 설계 초안의 실제 버그를 3건 발견·수정했다(전부 정적 리뷰로는 못 잡았을 종류):

1. **재발송 순서 버그**: 새 pending 행을 먼저 INSERT하고 이전 행을 나중에 `superseded`로 바꾸려다 부분 unique 인덱스 위반(둘 다 잠깐 `pending`이 됨) — 순서를 뒤집어 이전 행을 먼저 `superseded`로 바꾼 뒤 새 행을 만들도록 수정.
2. **FK 순환 문제**: `superseded_by_id`를 새 행 INSERT 전에 미리 채우려다 참조 무결성 위반 — 새 행 INSERT 후 별도 UPDATE로 `superseded_by_id`를 채우는 2단계로 수정.
3. **롤백으로 무의미해지는 "만료 시 상태 갱신 후 예외" 패턴**: `claim_account_invite`/`resend_account_invite` 둘 다 "만료면 status를 'expired'로 갱신하고 예외를 던진다"로 초안을 짰는데, 단일 함수 호출 = 단일 트랜잭션이라 뒤이은 `RAISE EXCEPTION`이 그 UPDATE까지 롤백시켜 무의미했다 — 상태 갱신은 `mark_expired_invites()` 배치의 역할로 완전히 분리하고, 수락/재발송 시점의 만료 차단은 순수 시간 비교로만 하도록 단순화(완료 기준 3의 "서버·DB 양쪽 검증"을 시간 비교 하나로 통일).

| 항목 | 결과 |
|---|---|
| `household_id`가 NULL인 초대 중복 방지 | 같은 이메일로 보호자 초대 2회 생성 시도 → 2번째가 unique 제약 위반으로 거부 확인(`NULLS NOT DISTINCT` 실제 작동) |
| 보호자 타 household 초대 차단 | 무관한 선생님이 남의 household에 자녀 초대 시도 → 거부. 실제 공동 보호자(같은 household 멤버)는 정상 허용 — 최초 테스트에서 "무관한 사람"으로 잘못 고른 프로필이 실제로는 공동 보호자였던 걸 재확인하며 바로잡음 |
| 구세대 토큰 거부, 최신만 허용 | 재발송 후 구 토큰으로 수락 시도 → `superseded`로 거부. 최신 토큰은 정상 수락 |
| 동일 링크 중복 수락 멱등성 | 같은 토큰으로 `claim_account_invite` 2회 호출 → 동일 결과 반환(에러 없음) |
| **수락↔재발송 경쟁 상태** | 두 개의 동시 psql 프로세스로 재현: (a) accept가 `pg_sleep`으로 지연되며 커밋 → 그 사이 시도한 resend가 잠금 해제 후 "이미 accepted"로 거부. (b) resend가 먼저 커밋 → 뒤이은 accept(구 토큰)가 "superseded"로 거부. 양방향 모두 `FOR UPDATE` 잠금으로 정확히 하나만 성공 |
| 기존 가입 이메일 처리 | 이미 가입된 이메일(김민지)로 초대 생성 후 수락 시도 → `manual_review`로 전이(에러 아님), 기존 `auth_user_id` 반환 확인 |
| manual_review → link | 관리자가 기존 프로필/auth_user_id를 명시적으로 지정해 연결 → `accepted`로 전이, 기존 계정 그대로 재사용(신규 생성 없음) |
| manual_review → revoke | 정상 철회, 상태만 변경 |
| 철회 후 수락 불가 + 기존 사용자 미삭제 | 철회된 토큰 수락 시도 → 거부. `auth.users`에서 대상 계정 여전히 존재 확인 |
| 만료 서버·DB 양쪽 검증 | `expires_at`을 과거로 강제한 뒤 status가 여전히 `pending`인 상태에서 수락/재발송 시도 → 둘 다 즉시 거부(배치가 안 돌아도 시간 비교만으로 차단) |
| `mark_expired_invites()` 배치 | 만료된 pending 행을 일괄 `expired`로 전환 + 감사 이력 기록 확인 |
| grade 필드 보존 | 관리자가 학생 초대 시 입력한 학년이 수락 시 `students.grade`에 정확히 반영됨 확인(초안엔 없던 컬럼 — 기존 admin 폼이 입력받는 값을 조용히 버리지 않도록 `invitee_grade` 추가) |
| 6개 역할 RLS(`account_invites`) | 관리자 전체 조회, 발송자 본인 조회, 무관한 다른 보호자·anon은 0행 |
| `npx tsc --noEmit` | 클린 |
| `npx vitest run` | **81개 파일 346개 테스트 전부 통과**(신규: `inviteParent`/`inviteStudent`/`inviteTeacher` 재작성 반영, `app/parent/invite-actions.test.ts`, `app/admin/invite-actions.test.ts`) |
| **실제 브라우저 E2E(로컬 Mailpit 메일함 연동)** | `e2e/account-invites.spec.ts` 신규 3건 — (1) 관리자 초대 → 실제 발송된 메일에서 토큰 링크 추출 → 수락 → `/set-password` → 로그인까지 전 과정 실제 브라우저로 완주, (2) 같은 링크 중복 방문 멱등성, (3) 철회된 초대 링크 방문 시 `/login`으로 안내. 전체 스위트 **21개 전부 통과**(기존 18 + 신규 3) |

### 앱 코드 변경

- `app/admin/users-actions.ts` — `inviteParent`/`inviteStudent`가 즉시 계정 생성 대신 `create_account_invite` RPC + `sendInviteEmail`로 교체(계정·역할·household 연결은 수락 시로 이연). `inviteTeacher`는 `requireAdmin()` 통과 후 항상 비활성화 오류. 기존 구현은 `legacyInviteTeacherByEmail`로 보존(호출 없음, Task 7에서 대체).
- `app/admin/invite-actions.ts`(신규) — `listInvites`(관리자 전체 조회), `resendInvite`, `revokeInvite`, `resolveManualReviewInvite`.
- `app/parent/invite-actions.ts`(신규) — `inviteChild`. household_id는 클라이언트 입력을 받지 않고 항상 호출자 본인의 guardian 멤버십에서 조회(서버가 잘못된 household_id를 만들 방법 자체를 없앰).
- `app/api/invite/accept/route.ts`(신규) — 토큰 검증(`claim_account_invite`) → 필요 시 `admin.auth.admin.createUser()` → `finalize_account_invite` → Supabase `generateLink(type: 'recovery')`의 `hashed_token`으로 기존 `/set-password` 화면과 동일한 방식(`token_hash`+`type` 쿼리, `action_link` GET 소진 문제 회피)으로 연결.
- `app/invite/manual-review/page.tsx`(신규) — manual_review 도착 시 보여줄 정적 안내 화면(세션 없음).
- `lib/invite-email.ts`(신규) — 초대 메일 발송 공통 함수.
- `app/admin/UsersTab.tsx` — 선생님 초대 폼을 비활성화 안내 문구로 교체.
- `e2e/mailbox.ts`(신규) — 로컬 Mailpit API(`/api/v1/search`, `/api/v1/message/:id`)로 실제 발송 메일을 찾아 초대 링크를 추출하는 E2E 헬퍼.

### 원격 적용 대상 및 영향 범위 (승인 대기)

**신규 마이그레이션 1개**: `20260902000000_r2_account_invites.sql`(신규 테이블 2개 + 함수 7개, 기존 테이블/함수 변경 없음).

**앱 코드**: 위 신규 파일 8개 + `app/admin/users-actions.ts`(수정) + `app/admin/UsersTab.tsx`(수정).

**영향 범위**:
- 순수 추가(신규 테이블·함수) — 기존 데이터나 기존 함수를 변경하지 않는다. 원격 실사용 데이터에 영향 없음.
- **원격 적용 즉시 효력 발생하는 행동 변화**: (1) 관리자가 "학부모 초대"/"학생 초대"를 누르면 더 이상 즉시 계정이 생기지 않고 이메일 발송 후 수락 시 생성된다(관리자 UI 문구는 이미 "초대 이메일이 발송되었습니다"로, 사용자 인지 변경 없음). (2) 관리자 UI에서 "선생님 초대" 폼이 사라지고 비활성화 안내로 대체 — 서버 액션도 호출 시 오류. 현재 원격에 이 경로로 진행 중인 선생님 초대가 있다면 완료 처리가 안 되니 사전 확인 필요(§확인 요청).
- 새 이메일 발송 경로(`lib/invite-email.ts`)가 `SMTP_HOST` 등 기존 환경변수를 그대로 재사용 — 신규 환경변수 없음.

**롤백 절차**: 이 마이그레이션은 신규 테이블 2개 + 신규 함수 7개뿐이며 기존 객체를 변경하지 않는다. 실패 시 신규 테이블·함수·트리거만 개별 DROP하면 기존 시스템에 영향이 없다. 앱 코드는 이번 커밋 이전으로 되돌리면 `inviteParent`/`inviteStudent`/`inviteTeacher`가 즉시 기존 동작(Task 3 시점 기준)으로 복귀한다.

### 확인 요청 (원격 적용 전)

1. **선생님 초대 비활성화**: 원격에 현재 이 경로로 진행 중인(초대 발송했지만 아직 미확인) 선생님이 있는지 확인 필요 — 있다면 비활성화 후에도 기존 진행 건 자체는 영향받지 않지만(inviteTeacher는 신규 호출만 막음), 신규 선생님은 Task 7 완료 전까지 이 경로로 초대할 수 없다는 점을 운영팀에 안내해야 한다.
2. 이번 라운드는 신규 테이블·함수만 추가하므로 기존 항목 재확인은 불필요.

## Task 7 예고 — Google Workspace 선생님 프로비저닝 (정책 확정, 미구현)

Task 2 승인 시 사용자가 함께 확정한 후속 Task의 요구사항이다. **지금 구현하지 않는다** — 여기서는 R2 계획 문서(`docs/superpowers/plans/2026-08-30-r2-account-family-lifecycle.md` Task 7)에 옮기기 전 원본 정책을 실행 로그에도 남겨둔다.

### 선생님 활성화(`pending→active`) 선행조건 (확정)

관리자가 아래를 전부 확인해야 `transition_account_status(..., 'active')`를 호출할 수 있다:
1. 관리자가 선생님 기본 정보와 개인 이메일을 등록
2. `@alton.education` Google Workspace 계정 발급 완료
3. 선생님이 발급된 Workspace 계정으로 최초 로그인
4. ALTON 인증 사용자와 사전 생성된 선생님 레코드 연결 완료
5. 시급 설정 완료(R1 `has_valid_current_teacher_rate`)
6. 필수 프로필·온보딩 정보 입력 완료
7. 선생님 계약 확인 완료(계약 자동화 전에는 관리자가 수동 확인)

과목·학생 배정은 활성화 이후 절차이므로 선행조건에 포함하지 않는다.

### 신규 데이터 필드 (확정)

- `personal_contact_email`(필수) — Workspace 계정 발급 전에 수집. 목적 2가지: Workspace 복구 이메일, ALTON 계정 발급/보안/운영 연락 알림.
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

- **이메일 주소만 일치한다고 선생님 레코드를 자동 생성·연결하면 안 된다** — 사전 생성된 provisioning 레코드와 Google 고유 사용자 ID를 함께 검증(이메일 일치만으로는 스푸핑 방지 불가).
- 부분 실패·중복 생성 방지·재시도·취소/회수·감사 이력 지원 필요.
- 임시 비밀번호는 ALTON DB에 평문 저장 금지, 이메일로 평문 발송 금지.

### 기존 Calendly 온보딩 처리 (확정)

기존 Calendly 온보딩 UI/코드는 계정 활성화에 영향을 주지 않도록 현재 상태(Task 2에서 자기 활성화만 제거, URL 저장 기능은 유지)로 둔다. Google Workspace 프로비저닝 구현 단계에서 제거할 후속 작업으로 명시한다 — Task 2 범위에서 지금 제거하지 않는다.
