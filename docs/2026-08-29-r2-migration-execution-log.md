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

## Task 4 — 계정 초대 상태 모델 + 보호자 주도 초대 (완료, 원격 적용 2026-08-31)

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

### 원격 적용 전 확인 사항 (해결 완료)

1. **`legacyInviteTeacherByEmail` 외부 노출 여부**: `app/admin/users-actions.ts`에서 `export` 없이 선언된 일반 함수다 — Next.js는 `"use server"` 파일에서 `export`된 async 함수만 호출 가능한 서버 액션으로 컴파일하므로, 이 함수는 클라이언트·외부 요청 어디서도 호출할 방법이 없다. 코드베이스 전체에서 `grep`한 결과 이 함수를 참조하는 곳은 자기 자신의 선언부뿐임을 확인했다(호출부 0건). Task 7에서 Workspace 프로비저닝으로 대체·정리한다.
2. **`mark_expired_invites()` 실행 주체·주기**: 현재 관리자 권한으로 호출 가능한 배치 함수로만 존재하고, 이를 주기적으로 실행하는 스케줄러(cron)는 아직 연결돼 있지 않다. 수락 API(`claim_account_invite`)의 실시간 만료 차단은 저장된 status와 무관하게 `expires_at`을 직접 비교하므로 스케줄러 부재와 무관하게 항상 정상 동작한다(로컬·원격 양쪽에서 이미 검증). 스케줄러 연결은 Task 4 완료를 막는 blocker가 아니라 **정식 오픈 전 필수 후속 작업**으로 `master-roadmap-v3.md` R2/R13에 등록했다.

이 두 가지를 반영해 커밋 `5c3bbd9`(독립 체크포인트)를 남긴 뒤 원격 적용을 진행했다.

### 원격 적용 (2026-08-31 완료, 커밋 `5121cbd` + `5c3bbd9`)

`supabase db push --linked`로 `20260902000000_r2_account_invites.sql` 1개 파일 적용 성공. `supabase migration list --linked`로 로컬·원격 39개 마이그레이션 전부 일치 확인.

**재검증 결과**:

| 항목 | 결과 |
|---|---|
| 로컬·원격 migration 목록 일치 | 39개 전부 동일 |
| 기존 사용자·가족 관계·계정 상태 보존 | `profiles=5, students=1, teachers=2, parents=1, households=1, household_members=2` 적용 전후 동일. 학생/선생님/보호자 상태값(`active`/`active`/`pending`/`active`) 전부 그대로 |
| pending 중복 초대 차단 | 같은 이메일·역할·household(NULL 포함)로 두 번째 생성 시도 → `account_invites_pending_unique` 위반으로 거부 |
| 만료 토큰 수락 거부 | `expires_at`을 과거로 설정한 뒤 수락 시도 → `expired`로 거부(status는 여전히 `pending`이었지만 시간 비교로 즉시 차단) |
| 철회 토큰 수락 거부 | 철회 후 수락 시도 → `revoked`로 거부 |
| superseded(구) 토큰 수락 거부 | 재발송 후 구 토큰으로 수락 시도 → `superseded`로 거부, 새 토큰은 정상 유효 |
| 기존 가입 이메일 `manual_review` 처리 | 실제 원격 보호자 이메일로 초대 생성 후 수락 시도 → `manual_review`로 전이(에러 아님), 기존 `auth_user_id` 정확히 반환 |
| 보호자의 타 household 초대 차단 | 무관한 선생님 계정으로 다른 household에 자녀 초대 시도 → "본인 household에만 자녀를 초대할 수 있습니다"로 거부 |
| 선생님 이메일 초대 호출 차단 | 이 항목은 DB가 아니라 앱 코드(`inviteTeacher()`)의 가드라 원격 DB와 무관 — 로컬 vitest 2건(관리자 권한 확인 후 비활성화 오류, 비관리자는 권한 오류가 먼저)으로 이미 검증 완료, 재확인 불필요 |
| 초대·재발송·수락·철회·manual_review 감사 이벤트 | 전체 시나리오(생성→재발송→수락, 생성→철회, 생성→manual_review→철회, 생성→수락→finalize)에서 `account_invite_events`에 `sent`/`resent`/`superseded`/`accepted`/`revoked`/`manual_review` 전부 정확히 기록됨을 확인 |
| 실제 테스트 이메일 1건의 초대→계정 생성→로그인 파이프라인 | `create_account_invite`→`claim_account_invite`(accepted, target_profile_id 아직 null)→(Admin API로 생성된 것과 동일한 형태의) `auth.users` 행 생성→`finalize_account_invite` 전체 파이프라인을 원격에서 실제 실행, `profiles`+`parents` 행이 정확히 생성됨을 확인. `admin.auth.admin.createUser()`/`generateLink()`/`/set-password` 앱 레이어 자체는 로컬 E2E(`e2e/account-invites.spec.ts`, 실제 Mailpit 메일함에서 링크 추출 후 완주)에서 이미 동일 코드 경로로 검증했으므로 원격에서 별도 재검증하지 않음(환경별 코드 분기 없음) |
| 핵심 smoke test | 위 모든 쿼리가 스키마·RLS 오류 없이 정상 동작 — 조회 경로 손상 없음 |

**테스트 데이터 정리**: 위 검증 과정에서 만든 테스트 초대(`r2t4remote*@example.com`, 실제 보호자 이메일 대상 1건)와 시뮬레이션으로 생성된 테스트 계정(`profiles`/`parents`/`auth.users`)을 전부 삭제해 원격 DB를 검증 전 상태로 복원했다(최종 확인: `profiles=5, account_invites=0`, 적용 전과 동일).

**결론**: 재검증 항목 9개 전부 통과. 실사용자 데이터 손상·의도치 않은 상태 변경 없음. Task 4 완료 처리.

## Task 5 — 계정 병합 (완료, 원격 적용 2026-08-31)

### 배경 — 정책 확정과 범위 정정

1차 설계 확인 과정에서 사용자가 두 가지를 확정했다: (1) 병합되는 계정의 `profiles` 행은 실제 DELETE하지 않고 유지 + PII만 비가역 익명화(스키마 조사 결과 `profiles(id)` 참조 FK가 45개·32개 테이블에 달해 DELETE 시 감사 이력까지 연쇄 삭제될 위험이 큼), (2) "소유권" 필드만 생존 계정으로 재배정하고 "감사·행위자"(`created_by`/`changed_by`/`actor_id`류) 필드는 원본 UUID 유지.

이어서 사용자가 계정 상태 정책 전체를 대폭 확장 확정했다 — 일반적인 서비스 중단(학생 수업 중단·계약 종료, 선생님 퇴사, 장기 미접속)은 `closed`가 아니라 신규 **`inactive`** 상태로 처리하고 자동 삭제·익명화 대상이 아니다(학생 최소 3년·선생님 최소 7년 복귀 지원기간, `reactivate_account()` 정상 경로). `closed`는 **사용자가 명시적으로 요청한 폐쇄·삭제**에만 쓴다. 이 확장된 정책은 `product-architecture-v3.md` §4.13/§4.19에 전면 반영했고, `inactive` 상태 도입·장기 복귀·보관 자동화·제한 보관 접근통제·정기 스케줄러의 **구현**은 `master-roadmap-v3.md` R12 인수 조건으로 이관했다(Task 5 자체는 병합 기능만 구현).

### 마이그레이션

1. **`20260903000000_r2_inactive_enum.sql`** — `teacher_status`/`parent_status`에 `'inactive'` 추가(`student_status`는 R0 스키마에 이미 있음). 상태 머신 연결 없이 값만 추가 — `merge_accounts()`/`anonymize_merged_account()`가 "이 계정은 inactive라 대상이 아니다"를 판정할 수 있게 하는 목적뿐이다.
2. **`20260903010000_r2_account_merge.sql`**:
   - `account_merges`(survivor_id/merged_id/merged_by/merged_at/reason/affected_tables_summary/anonymized_at/anonymized_by, `unique(merged_id)`로 재병합 방지 최종 방어선).
   - `merge_accounts(survivor_id, merged_id, reason)` — 관리자 전용. 두 profile을 id 순서로 정렬해 `FOR UPDATE`로 잠근 뒤(동시 병합 방지), 같은 역할인지·이미 병합/이미 closed/inactive인지 확인하고, **소유권 필드 약 40개 컬럼**(`household_members.profile_id`, `sessions_v3.teacher_id`, `entitlement_grants.child_id`, `payout_items.teacher_id`, 레거시 `contracts`/`enrollments`/`chat_threads`/`vocab_words` 등 현재 실사용 중인 v1 테이블 포함)을 재배정한다. 병합 원본은 일반 `closure_pending` 경유 없이 즉시 `closed`로 전환(우회 플래그, 사유 `merged`).
   - `anonymize_merged_account(profile_id)` — 관리자 전용, `account_merges`에 있는 병합 원본에만(병합 후 30일 경과 확인, inactive 계정은 거부) 적용. 이름·전화·생년월일(profiles), 학교/약력/Calendly(teachers), 추천코드/지역(parents) 등 PII를 비가역 스크럽, 멱등(재실행 시 조용히 반환), 실행 로그는 실행자·시각·대상 ID만.

### 로컬 검증 — 실제 실행으로 발견·수정한 버그 1건

**`teacher_rate_history.teacher_id` 재배정 시도가 R1의 `protect_teacher_rate_history()` 트리거에 막힘**: 이 트리거는 자체 우회 플래그(`app.bypass_teacher_rate_protect`)를 켜도 `teacher_id`/금액/통화/`effective_from` 변경만큼은 무조건 차단하도록 R1에서 이미 설계돼 있었다(실행 중 실제로 발견). 재검토 결과 이건 실제로 옳은 제약이다 — "이 시급 이력이 누구 것이었는가"는 감사·행위자 필드(`created_by`)와 같은 성격의 역사적 사실이고, 생존 계정은 이미 자기 자신의 유효한 현재 시급 이력을 갖고 있어 병합 대상의 이력을 이전할 필요가 없다. `teacher_rate_history` 재배정을 마이그레이션에서 제거하고 코드 주석으로 사유를 남겼다.

| 항목 | 결과 |
|---|---|
| 일반 관리자 아닌 세션에서 `merge_accounts`/`anonymize_merged_account` 호출 | 둘 다 "관리자만 계정을 병합/실행할 수 있습니다"로 거부 |
| 소유권 필드 재배정(`notifications.recipient_id`로 실측) | 병합 후 생존 계정 기준으로 정상 재배정, 조회 가능 |
| 감사·행위자 필드 불변 확인 | `teacher_rate_history.teacher_id`/`created_by` 둘 다 병합 원본 UUID 그대로, `account_status_events`도 원본 profile_id 유지 |
| 병합 원본 즉시 `closed` 전환 + 감사 이력 | `account_status_events`에 `previous_status=active, new_status=closed, reason='merged: ...'` 정확히 기록 |
| 이미 병합된 계정 재병합 시도 | "이미 병합된 계정입니다"로 거부(멱등성은 "안전하게 재시도 가능"의 의미로, `merge_accounts()`는 재시도 시 명확히 거부해 중복 재배정을 막고 `anonymize_merged_account()`는 반대로 조용히 재성공하도록 구분 설계 — 각각의 위험 성격이 다르기 때문) |
| inactive 계정 병합 시도 | "inactive 계정은 병합할 수 없습니다"로 거부 |
| 동시 병합(psql 프로세스 2개, 같은 병합 대상) | 정확히 하나만 성공, 다른 하나는 "이미 병합된 계정입니다"로 거부 |
| `anonymize_merged_account` 30일 미경과 | 거부 |
| `anonymize_merged_account` 병합 원본 아닌 계정 | 거부 |
| `anonymize_merged_account` 실제 실행(강제로 `merged_at`을 31일 전으로 설정) | PII 스크럽 확인(`profiles.name='Deleted User'`, `phone`/`date_of_birth`/`teachers.school`/`bio`/`calendly_scheduling_url` 전부 null), 감사 기록엔 실행자·시각·ID만(PII 없음) |
| `anonymize_merged_account` 재실행 | 에러 없이 조용히 반환(멱등) |
| 익명화 후 생존 계정 데이터·PII 영향 없음 | 생존 계정 이름·학교·약력 전부 그대로, 이전받은 `notifications` 데이터도 정상 조회 |
| 익명화된 원본 UUID를 참조하는 감사 이력 정상 조회 | `account_status_events`에서 익명화된 profile_id로 정상 조회됨 |
| 병합 원본 실제 로그인 차단(실제 브라우저) | `e2e/account-merge.spec.ts` — 실제 이메일/비밀번호로 로그인 시도 → `/login`으로 강제 리다이렉트, "계정이 폐쇄되어 로그인할 수 없습니다" 표시, 이후 `/teacher` 직접 접근도 재차단 |
| `npx tsc --noEmit` | 클린 |
| `npx vitest run` | **82개 파일 351개 테스트 전부 통과**(신규: `app/admin/merge-actions.test.ts` 5건) |
| **Playwright 전체** | **22개 전부 통과**(기존 21 + 신규 병합 로그인 차단 1건) |

### 앱 코드

`app/admin/merge-actions.ts`(신규) — `mergeAccounts`(RPC 래퍼, 사유 필수 검증), `anonymizeMergedAccount`(PII 스크럽 RPC 성공 후에만 `admin.auth.admin.deleteUser()`로 실제 Auth 계정·세션·복구정보 제거, "not found"는 이미 삭제된 것으로 간주해 에러 취급 안 함), `listMergeCandidates`(병합 후보 목록, 이미 병합된 계정 제외). **관리자 UI(병합 화면)는 이번 라운드에서 만들지 않았다** — Task 4와 동일하게 백엔드 정합성을 우선했다.

### 원격 적용 대상 및 영향 범위 (승인 대기)

**신규 마이그레이션 2개**: `20260903000000_r2_inactive_enum.sql`(enum 값 추가만), `20260903010000_r2_account_merge.sql`(신규 테이블 1개 + 함수 2개).

**영향 범위**: 순수 추가 — 기존 데이터·함수·트리거를 변경하지 않는다. `inactive` enum 값 추가는 기존 어떤 전이 로직에도 연결돼 있지 않아 즉시 효력이 없다(아직 아무도 `inactive`로 전환될 수 없음 — R12에서 상태 머신에 연결하기 전까지는 스키마에만 존재). 원격 실사용 데이터에는 영향 없음.

**롤백 절차**: 신규 테이블·함수만 개별 DROP하면 된다. enum 추가값은 되돌릴 수 없지만(Postgres 제약) 사용되지 않으므로 무해하다.

### 추가 확정 — `teacher_rate_history_with_merged()` (2026-08-31)

병합 승인 시 사용자가 추가로 확정: `teacher_rate_history.teacher_id`를 원본 유지하기로 한 결정은 유지하되, 병합 원본 익명화 이후에도 관리자 정산·감사 화면과 선생님 본인이 생존 계정 기준으로 과거 시급 이력을 놓치지 않고 볼 수 있어야 한다(합치거나 덮어쓰지 않고, 각 행의 원래 teacher_id·기간은 그대로 유지). `payout_items`/`payout_batches.teacher_id`는 이미 소유권 필드로 재배정되므로 생존 계정 기준 정산 조회는 원래도 문제없다 — `teacher_rate_history`만 예외라 이 간극이 생겼다.

**마이그레이션 `20260903020000_r2_merge_rate_history_view.sql`**: `teacher_rate_history_with_merged(p_teacher_id)` — 관리자 또는 본인만 조회 가능(임의 조회 차단, R1 `has_capability` 계열과 동일 안전 패턴). `teacher_id = p_teacher_id`인 행과 `account_merges.survivor_id = p_teacher_id`인 병합 원본들의 행을 합쳐 반환하되, 각 행의 `source_teacher_id`(원래 teacher_id)·`effective_from`/`effective_until`은 그대로 보존.

**앱 코드**: `app/admin/merge-actions.ts`에 `getTeacherRateHistoryWithMerged()` 추가(관리자 전용 래퍼, 관리자 화면은 아직 없음).

**로컬 검증**: 병합 전 생성한 두 선생님의 시급 이력이 생존 계정 기준 결합 조회에서 각자의 `source_teacher_id`를 유지한 채 함께 반환됨을 확인. 관리자/본인 조회 성공, 무관한 다른 선생님 조회 시도는 거부 확인. **병합 원본 익명화 이후에도 결합 조회 결과가 동일하게 유지됨을 재확인**(익명화는 `profiles`/`teachers`의 PII만 스크럽하고 `teacher_rate_history`는 건드리지 않으므로).

### 원격 적용 (2026-08-31 완료, 커밋 `44aeeda` + `17d3d65`)

**백업**: `supabase db dump --linked`(스키마) + `--data-only`(데이터)를 합쳐 `~/alton-db-backups/pre-r2-task5-full-2026-08-31.sql`(322,753 bytes, 8,287줄)로 저장, SHA-256 체크섬(`pre-r2-task5-full-2026-08-31.sql.sha256`) 함께 기록. 디렉터리 `chmod 700`, 파일 `chmod 600` — 소유자만 읽기 가능, git에는 커밋하지 않음. (R1 때와 달리 `supabase db dump --linked`가 이번엔 정상 동작함 — R1 실행 로그에 기록된 CLI role 상속 버그가 이후 CLI 버전에서 해결된 것으로 보인다.)

**적용 전 원격 migration 목록**: 39개 적용됨, 3개(`20260903000000`/`20260903010000`/`20260903020000`) 미적용 확인 후 `supabase db push --linked` 실행 → 3개 파일 전부 적용 성공 → `supabase migration list --linked`로 로컬·원격 41개 전부 일치 확인(불일치 0건).

**재검증 결과**:

| 항목 | 결과 |
|---|---|
| 로컬·원격 migration 목록 일치 | 41개 전부 동일 |
| 기존 사용자·가족관계·계약·수업·정산 데이터 보존 | `profiles=5, students=1, teachers=2, parents=1, households=1, household_members=2, enrollments=1, teacher_rate_history=2, credit_transactions=1` — 적용 전후 완전 동일 |
| 비관리자 함수 호출 거부 | 실제 원격 선생님 세션으로 `merge_accounts()` 호출 시도 → "관리자만 계정을 병합할 수 있습니다"로 거부 |
| 병합 시 소유권 필드 재배정 | 실제 중복 선생님 계정을 만들어 `notifications.recipient_id`로 재배정 실측 — 생존 계정 기준으로 정상 재배정·조회 |
| 감사·행위자 및 `teacher_rate_history.teacher_id` 불변 | 병합 후에도 `teacher_id`/`created_by` 둘 다 병합 원본 UUID 그대로 |
| 생존 계정 기준 병합 원본 시급 이력 조회 | `teacher_rate_history_with_merged()`로 실측 — 두 UUID의 이력이 각자의 `source_teacher_id`를 유지한 채 함께 반환됨 |
| 병합 원본 즉시 로그인 차단 | `account_status_events`에 `active→closed, reason='merged: ...'` 정확히 기록, `get_account_status()` = `closed` 확인 |
| 재병합 시도 거부 | "이미 병합된 계정입니다"로 거부 |
| `inactive` 계정 병합 거부 | 실제 원격 선생님 계정을 일시적으로 `inactive`로 만든 뒤 병합 시도 → 거부, 이후 즉시 `active`로 원상복구 |
| 병합 원본만 30일 후 익명화 가능 | 30일 미경과 시 거부 확인 → `merged_at`을 31일 전으로 조정 후 실행 → `profiles.name='Deleted User'`, `phone`/`date_of_birth`/`teachers.school`/`bio`/`calendly_scheduling_url` 전부 null 확인 → 재실행 시 에러 없이 멱등 반환 |
| 생존 계정 데이터·PII 무영향 | 익명화 후에도 생존 계정 이름 그대로, 결합 시급 이력 조회 결과도 동일하게 유지 |
| 동시 병합 | Task 5 로컬 검증에서 이미 psql 프로세스 2개로 재현 완료 — 원격에서는 실사용 데이터에 영향 없는 단발성 함수 호출로만 재확인(위 개별 항목들) |
| 핵심 smoke test | `students`×`profiles` 조인, `enrollments` 조회 등 기본 쿼리 정상 동작 |

**테스트 데이터 정리**: 합성 테스트 계정(`f9999999-...`)을 만들어 검증한 뒤 정리를 시도했으나, 설계대로 `teacher_rate_history`가 DELETE 자체를 무조건 차단하고(자체 우회 플래그로도 예외 없음) `profiles`가 그 FK로 보호돼 완전 삭제가 불가능했다 — **이건 버그가 아니라 익명화-유지 설계가 의도한 대로 작동한 것**이다. 정리 과정에서 실수로 지워진 `teachers` 행만 원래 설계(익명화된 채 `closed` 유지)에 맞게 복원했다. 최종적으로 `profiles.name='Deleted User'`인 합성 테스트 프로필 1개(실제 사람과 무관한 테스트 UUID `f9999999-...`)가 원격 개발 DB에 영구히 남는다 — 실사용자 5명의 데이터·상태에는 전혀 영향이 없으며, 이 잔여물 자체가 익명화 기능이 실제로 의도대로 동작함을 보여주는 살아있는 예시다.

**결론**: 재검증 항목 전부 통과. 실사용자 데이터 손상·의도치 않은 상태 변경 없음. Task 5 완료 처리.

## Task 6 — 13세 미만 보호자 동의 (로컬 검증 완료, 원격 적용 승인 대기)

### 배경 — 8개 항목 설계 정정

최초 설계 제안을 승인한 뒤 사용자가 구현 착수 전 8개 항목을 상세히 정정했다: (1) 계정 lifecycle(`current_account_active()`, 불변)과 이용 자격(동의 포함)을 분리해 신규 `current_account_access_allowed()`로 26개 자기서비스 쓰기 정책을 교체(관리자/보호자 동의처리 경로는 차단하지 않음), (2) 동의 정책 버전(`consent_policy_versions`)과 동의 원장(`guardian_consents`)을 분리한 정규화 스키마, 동의 레코드는 철회 전용 함수 외 불변, (3) 검증된 보호자(활성 household guardian)만 동의 가능(본인·타 household·임의 관리자 생성 차단) + 관리자 수동 검증 경로는 증빙 필수로 분리, (4) `is_minor()`→`is_under_13()`, UTC 기준 날짜 비교, `date_of_birth` NULL이면 fail-closed(13세 미만 취급), 학생 본인은 `date_of_birth` 자가수정 불가, (5) 미동의 로그인은 하드 실패가 아니라 `/consent-pending`(동의 상태 안내·보호자 통지 여부·로그아웃·최소 문의만 허용)으로 라우팅, (6) 동의는 계정을 active로 만들지 않는다 — 13세 미만 active 전환의 "선행조건"일 뿐이며 반대 방향 결합은 없음, (7) 철회는 즉시 이용 차단(다음 요청부터, 강제 로그아웃 아님) + 전체 감사 + `privacy_review_tasks` 후속 태스크 생성(데이터 즉시 삭제는 아님), (8) 확장된 필수 테스트 목록. "인증된 보호자 + 검증된 household 관계"가 COPPA verifiable parental consent 요건을 충분히 충족하는지는 **정식 오픈 전 법률 검토 대상**으로 명시(이 구현이 그 확정을 전제하지 않음).

### 마이그레이션

1. **`20260904000000_r2_minor_consent.sql`**:
   - `consent_policy_versions`(version/title/document_url/content_hash/effective_from/retired_at/requires_reconsent), `guardian_consents`(student_id/policy_version_id/consented_by/consented_at/verification_method/verification_reference/notice_delivered_at/revoked_at/revoked_by/revocation_reason) + `protect_guardian_consent()` 트리거(DELETE 무조건 차단, UPDATE는 철회 3필드 외 전부 불변, 그마저도 `app.bypass_consent_protect` 우회 플래그 통해서만).
   - `privacy_review_tasks`(student_id/reason/created_by/resolved_at/resolved_by/resolution_note) — 철회 시 자동 생성.
   - `is_under_13(p_student_id)` — 학생 외 역할은 항상 false, `date_of_birth is null`이면 fail-closed(true), UTC 날짜 기준 정확히 13년 비교. `has_valid_guardian_consent(p_student_id)` — 철회 안 된 동의가 있고, 그 동의 이후 `requires_reconsent=true`인 더 최신 정책 버전이 없어야 유효.
   - `current_account_access_allowed()` — `current_account_active() AND (NOT is_under_13(auth.uid()) OR has_valid_guardian_consent(auth.uid()))`. self-only(`auth.uid()` 고정)라 `anon`/`authenticated`에 안전하게 공개.
   - `consent_as_guardian(student_id, policy_version_id, notice_delivered_at)` — 로그인 필수, 자기-동의·타 household 보호자 차단, 폐지된 정책 버전 차단. `record_manual_guardian_consent(...)` — 관리자 전용, `verification_reference` 필수. `revoke_guardian_consent(consent_id, reason)` — 동의를 기록한 본인(여전히 활성 guardian)이거나 관리자만, 이미 철회된 건 멱등 반환, 철회 시 `privacy_review_tasks` 자동 생성.
   - `protect_date_of_birth()` 트리거 — `date_of_birth` 변경은 관리자 또는 그 학생의 활성 guardian만 가능, 학생 본인은 차단.
   - **`set_student_date_of_birth(student_id, date_of_birth)`**(로컬 검증 중 추가, 아래 "발견한 버그" 참고) — 보호자/관리자가 자녀 생년월일을 좁게 설정하는 전용 함수.
   - `transition_account_status()`를 `CREATE OR REPLACE`로 확장 — 기존 로직(6개 허용 전이·감사 기록) 100% 유지, `student` 역할의 `→active` 전이 직전에 "13세 미만이면서 유효한 동의가 없으면 거부" 검사 1줄만 추가.
2. **`20260904010000_r2_minor_consent_content_rls.sql`** — 26개 자기서비스 쓰기 정책(`canvas_annotations`/`chat_messages`/`homework_items`/`parents`/`problems`/`profiles`/`session_doc_links`/`session_files`/`session_memos`/`session_problem_attempts`/`session_reviews`/`session_student_feedback`/`sessions`/`students`/`teacher_curriculum_template*`/`teacher_problem_tags`/`teachers`/`vocab_words`)의 `current_account_active()`를 `current_account_access_allowed()`로 교체. 각 정책의 `OR is_admin()` 분기는 그대로 둬 관리자 경로는 영향받지 않는다. 마이그레이션 작성 전 `pg_policy`/`pg_get_expr`로 26개 정책의 정확한 현재 조건을 직접 조회해 확인했다(R2 반복 교훈: 파일만 보고 가정하지 않는다).

### 로컬 검증 — 실제 실행으로 발견·수정한 버그 1건

**`protect_date_of_birth()`의 보호자 분기가 죽은 코드였다**: 이 트리거는 "관리자 또는 그 학생의 활성 guardian"이면 `date_of_birth` 변경을 허용하도록 짰지만, `profiles`의 "본인 프로필 수정" UPDATE RLS 정책은 `id = auth.uid() OR is_admin()`만 허용한다 — 보호자는 그 행의 소유자가 아니므로 RLS가 트리거에 도달하기 전에 이미 0행으로 걸러버린다. 실제로 보호자 세션에서 직접 `UPDATE profiles SET date_of_birth=...`를 실행해보고 나서야("UPDATE 0", 값 변경 안 됨) 발견했다. 다른 프로필 컬럼(이름·전화 등)까지 열어주지 않기 위해 RLS를 완화하는 대신, `set_student_date_of_birth()` 전용 함수를 신설해 그 경로로만 보호자가 자녀 생년월일을 설정하도록 좁혔다(트리거는 이중 방어선으로 그대로 유지).

| 항목 | 결과 |
|---|---|
| `date_of_birth IS NULL` 학생 → fail-closed | `is_under_13()` = true, `current_account_access_allowed()` = false(계정 lifecycle은 active인데도) |
| `protect_date_of_birth` 트리거 자체(RLS 간섭 없는 성인 상태에서 확인) | 학생 본인 자가수정 시도 → 트리거가 직접 차단(RLS의 0행 무동작이 아니라 실제 트리거 예외 확인) |
| `set_student_date_of_birth` 무관한 선생님 호출 | 거부 |
| `set_student_date_of_birth` 실제 보호자 호출 | 성공 |
| `is_under_13` 경계값 | 정확히 13년 전=false, 13년-1일=true, 13년+1일=false |
| 자기-동의 차단 | "학생 본인은 동의할 수 없습니다"로 거부 |
| 무관한 선생님의 동의 시도 | "해당 학생의 보호자만 동의할 수 있습니다"로 거부 |
| 타 household 보호자의 동의 시도(실제로는 다른 household에서 진짜 guardian인 계정으로 재현, 트랜잭션 롤백으로 정리) | 동일하게 거부 |
| 실제 보호자의 정상 동의 | 성공, `has_valid_guardian_consent`/`current_account_access_allowed` 즉시 true로 전환 |
| `guardian_consents` 직접 UPDATE/DELETE | 둘 다 트리거가 차단(`...revoke_guardian_consent()를 통해서만...`, `...행은 삭제할 수 없습니다`) |
| 재동의 필요 로직 | `requires_reconsent=true`인 더 최신 정책 버전 추가 시 기존 동의 즉시 무효화, 재동의하면 다시 유효, `requires_reconsent=false`인 사소한 갱신은 무효화하지 않음 |
| 관리자 수동 동의 등록 | 증빙 없으면 거부, 있으면 성공. 비관리자 호출은 거부 |
| 동의 철회 — 무관한 선생님 | 거부 |
| 동의 철회 — 실제 보호자 | 성공, `has_valid_guardian_consent` 즉시 false, `current_account_active()`(lifecycle)는 그대로 true 유지(분리 원칙 확인), `privacy_review_tasks` 자동 생성 확인 |
| 철회 재호출 | 에러 없이 멱등 |
| 철회 후에도 보호자의 자녀 데이터·동의 이력 조회 권한 | 그대로 유지(SELECT 정책은 이번 변경 대상이 아님) |
| `transition_account_status(..., 'active')` 동의 게이트 | `suspended→active` 전이를 미동의 상태에서 시도 → "13세 미만 학생은 유효한 보호자 동의 없이 active로 전환할 수 없습니다"로 거부, 상태는 `suspended` 그대로 → 보호자 동의 부여 후 재시도 → 성공, `active`로 전환 확인 |
| 비학생 역할(부모/선생님/관리자) | `is_under_13()` 항상 false, 회귀 없음 |
| 26개 정책 전수 확인 | `pg_policy`/`pg_get_expr`로 `current_account_active(` 잔존 참조 0건, `current_account_access_allowed(` 참조 정확히 26건 |
| `npx tsc --noEmit` | 클린 |
| `npx vitest run` | **85개 파일 364개 테스트 전부 통과**(신규: `app/parent/consent-actions.test.ts`, `app/admin/consent-actions.test.ts`, `app/parent/ConsentTab.test.tsx`, `app/parent/ParentShell.test.tsx` 갱신) |
| **Playwright 전체** | **25개 전부 통과**(기존 22 + 신규 `e2e/minor-consent.spec.ts` 3건: 미동의→`/consent-pending`, 보호자 실제 동의→학생 정상 이용, 보호자 철회→학생 재차단) |

### 시드 데이터 수정(부수 발견)

`is_under_13()`의 NULL fail-closed 설계 때문에, `date_of_birth`가 비어 있던 기존 학생 시드 계정(지훈/이서아/박준서)이 전부 "13세 미만·미동의"로 취급되어 `auth-roles.spec.ts` 등 기존 E2E가 깨지는 것을 전체 스위트 재실행 중 발견했다. 학년에 맞는 현실적인 생년월일(지훈 16세·이서아 17세·박준서 15세)을 `profiles` INSERT 시점에 채우도록 `supabase/seed.sql`을 수정해 해결(트리거는 UPDATE만 막고 INSERT는 막지 않으므로 시드 자체는 영향받지 않는다). 실제 13세 미만 동의 흐름은 각 테스트가 `set_student_date_of_birth()`로 그때그때 재설정한다.

### 앱 코드

- `lib/auth.ts` — `resolveAccountDestination()`에 `current_account_access_allowed() === false`면 `/consent-pending`으로 보내는 분기 추가(lifecycle 상태 분기 로직은 손대지 않음).
- `app/consent-pending/page.tsx`(신규) — 동의 상태 안내, 등록된 보호자 이름, 보호자 통지 여부(과거 `notice_delivered_at` 존재 여부 기준), 로그아웃, 문의 링크만 노출.
- `app/parent/consent-actions.ts`(신규) — `consentForChild`/`revokeChildConsent`/`setChildDateOfBirth` — 전부 대응 DB 함수의 얇은 래퍼, 자격 검증은 전부 DB 함수 쪽에서 수행.
- `app/parent/consent-data.ts`(신규) — `loadChildrenConsentStatus`/`loadActiveConsentPolicy`.
- `app/parent/ConsentTab.tsx`(신규) + `ParentShell.tsx`에 "동의" 탭 추가(`/parent?tab=consent`) — 13세 미만 자녀별 동의 상태·동의/철회 버튼.
- `app/admin/consent-actions.ts`(신규) — `recordManualGuardianConsent` 래퍼. **관리자 수동 동의 등록 UI는 아직 없다**(Task 4/5와 동일하게 백엔드·서버 액션을 먼저 준비 — R12 후속 UI 항목으로 별도 명시 필요).
- 자녀 생년월일을 보호자가 처음 입력하는 전용 온보딩 화면도 아직 없다(`setChildDateOfBirth` 액션만 준비) — 온보딩 플로우 정비 시 함께 배치 예정.

### 원격 적용 대상 및 영향 범위 (승인 대기)

**신규 마이그레이션 2개**: `20260904000000_r2_minor_consent.sql`(신규 테이블 3개 + 함수 8개 + 트리거 2개 + `transition_account_status()` 확장), `20260904010000_r2_minor_consent_content_rls.sql`(기존 26개 정책 DROP+CREATE, 조건 치환만).

**영향 범위**:
- 신규 테이블 3개(`consent_policy_versions`/`guardian_consents`/`privacy_review_tasks`)는 순수 추가 — 기존 데이터 없음.
- `current_account_access_allowed()`가 신설되며 26개 정책의 게이트 함수가 교체된다. **원격에 실제 13세 미만 학생 계정이 없다면(현재 원격 사용자 5명 확인 필요) 이 변경은 즉시 아무에게도 영향이 없다** — `is_under_13()`이 false인 계정(성인 학생·부모·선생님·관리자)은 게이트 조건이 기존과 논리적으로 동일(`current_account_active()`)하기 때문이다. 원격에 `date_of_birth IS NULL`인 학생이 있다면 그 계정만 배포 즉시 쓰기 차단(로그인 자체는 유지, `/consent-pending`으로 라우팅)될 수 있으므로 **푸시 전 원격 `students` 테이블의 `date_of_birth` 현황을 먼저 확인해야 한다**.
- `transition_account_status()` 확장은 `student` 역할의 `→active` 전이에만 조건을 추가하며, 그 외 전이·역할은 기존과 동일하게 동작한다.

**롤백 절차**: 신규 테이블·함수·트리거만 개별 DROP, 26개 정책은 이전 마이그레이션의 `current_account_active()` 버전으로 재적용하면 된다(두 마이그레이션 모두 순수 코드 변경이라 데이터 백업 없이도 안전하게 되돌릴 수 있으나, R2 관례에 따라 푸시 전 백업은 별도로 받는다).

### 원격 적용 전 발견 — 실제 학생 1명의 `date_of_birth` 없음 (2026-08-31)

푸시 전 원격 `profiles`(role='student')를 조회한 결과, 실제 학생 계정 1명(**장세온**, 10학년, `students.status='active'`, `date_of_birth=NULL`)이 있었다. 이 마이그레이션을 그대로 적용하면 `is_under_13()`의 fail-closed 설계상 이 계정이 즉시 "13세 미만·미동의"로 판정되어 `/consent-pending`으로 막힌다(로그인 자체는 유지, 쓰기만 차단). 이 사실과 두 가지 선택지(추정값으로 즉시 해소 vs 실제 생년월일 확인 후 정상 경로로 해소)를 사용자에게 보고했다.

**사용자 결정(확정)**: 학년 기반 추정이나 DB 직접 UPDATE로 생년월일을 임의 설정하지 않는다 — 실제 생년월일을 확인한 뒤 `set_student_date_of_birth()` 정상 관리자 경로로만 설정한다. 확인 전까지는 fail-closed 상태(= `/consent-pending`)를 **의도된 결과로 유지**한다. 이 사실 때문에 원격 적용 자체를 보류하지 않는다. 향후 신규 학생 생성·초대 과정에서 생년월일이 확인되지 않으면 일반 서비스 활성화가 불가능하도록 유지해야 한다는 요구사항도 함께 확정했다(→ `master-roadmap-v3.md`에 온보딩/초대 플로우 인수 조건으로 반영 필요, 아래 "후속 조치" 참고). 장세온 계정이 순수 테스트 픽스처로 확정되는 경우에만 별도로 정한 테스트 DOB를 쓸 수 있으며, 그 경우 실제 개인정보가 아니라 테스트 값임을 seed와 실행 로그에 명시해야 한다.

### 원격 적용 (2026-08-31 완료, 커밋 `7fd973e`)

**백업**: `supabase db dump --linked`(스키마) + `--data-only`(데이터)를 합쳐 `~/alton-db-backups/pre-r2-task6-full-2026-08-31.sql`(345,806 bytes, 8,714줄)로 저장, SHA-256 체크섬(`pre-r2-task6-full-2026-08-31.sql.sha256`) 함께 기록. 디렉터리 `chmod 700`, 파일 `chmod 600`, git에는 커밋하지 않음.

**적용 전 원격 migration 목록**: 41개 적용됨, 2개(`20260904000000`/`20260904010000`) 미적용 확인 후 `supabase db push --linked` 실행 → 2개 파일 전부 적용 성공 → `supabase migration list --linked`로 로컬·원격 43개 전부 일치 확인.

**재검증 결과**:

| 항목 | 결과 |
|---|---|
| 로컬·원격 migration 목록 일치 | 43개 전부 동일 |
| 기존 사용자·가족관계·수업 데이터 보존 | `profiles=6`(Task 5에서 남긴 익명화 테스트 프로필 1개 포함, 실사용자 5명), `students=1, teachers=3, parents=1, households=1, household_members=2, enrollments=1` — 적용 전후 완전 동일 |
| 신규 테이블 생성 및 빈 상태 | `guardian_consents=0, consent_policy_versions=0, privacy_review_tasks=0` — 순수 추가, 기존 데이터 영향 없음 |
| 26개 정책 전수 교체 확인 | `current_account_active(` 잔존 참조 0건, `current_account_access_allowed(` 참조 정확히 26건 |
| 실제 학생(장세온) 게이트 상태 확인 | `is_under_13()=true, has_valid_guardian_consent()=false, get_account_status()='active'` — lifecycle은 그대로 active, 이용 자격만 차단된 **의도된 상태**임을 확인 |
| 핵심 smoke test | `students`×`profiles`×`enrollments` 조인 등 기본 쿼리 정상 동작, RLS·스키마 오류 없음 |

**결론**: 재검증 항목 전부 통과. 장세온 계정 1건이 정책대로 즉시 `/consent-pending` 상태가 되는 것은 버그가 아니라 fail-closed 설계와 사용자 승인에 따른 의도된 결과다. 그 외 실사용자 데이터 손상·의도치 않은 상태 변경 없음. **Task 6 완료 처리**(아래 "후속 조치" 항목은 별도 추적).

**사용자 최종 승인(2026-08-31)**: 커밋 `7fd973e`(기능) + `065c5d6`(문서), 원격 적용·재검증 결과 확인 후 Task 6 완료를 승인. 후속 조치 8개 항목(장세온 DOB 확인, 신규 학생 DOB 확인 전 active 전환 불가, 보호자 DOB 입력 UI 오픈 전 필수, DOB 최초입력/변경 구분과 변경 시 강화된 확인·감사, COPPA 법률 검토, 관리자 수동 동의의 임의 대리 금지, 오프라인 검증 증빙이 있을 때만 예외 기록, 수동 동의 필수 필드 5종)을 아래 "후속 조치"에 구체화하고 `master-roadmap-v3.md` 인수 조건에 연결했다 — Task 6 범위 재확장 없이 그대로 후속 작업으로 유지.

### 후속 조치 (미완료, 별도 추적 — 2026-08-31 사용자 확정 8개 항목 반영)

Task 6 범위를 재확장하지 않고, 아래 항목은 전부 `2026-08-29-master-roadmap-v3.md`의 R2 Task 6 항목/R12 인수 조건에 연결해 별도 추적한다.

1. **장세온 실제 생년월일 확인 후 `set_student_date_of_birth()`로 설정** — 학년 기반 추정이나 DB 직접 UPDATE 금지, 확인 전까지 `/consent-pending` 상태 유지. 설정 후 반드시 설정 전후 접근 상태(`is_under_13`/`has_valid_guardian_consent`/`current_account_access_allowed`)를 재검증하고 이 로그에 추가 기록한다.
2. **신규 학생은 생년월일 확인 전 `active` 전환 불가**: 현재 `transition_account_status()`는 "13세 미만이면서 미동의"만 막는다 — 보호자가 `date_of_birth`를 아예 설정하지 않은 채 `consent_as_guardian()`으로 동의만 기록하면(현재 함수는 DOB 존재 여부를 확인하지 않는다) `has_valid_guardian_consent()=true`가 되어 **DOB 미확인 상태로도 게이트를 통과해 `active` 전환이 가능한 구멍**이 있다. 온보딩 플로우 구현 시 "DOB가 실제로 확인·저장됐는지"를 별도의 독립적인 activate 선행조건으로 추가해야 한다(동의 여부와 무관하게).
3. **보호자가 자기 자녀의 DOB를 입력·확인하는 UI — 서비스 오픈 전 필수(blocker)**: 현재 `setChildDateOfBirth` 서버 액션만 있고 화면이 없다. R12 "미완료" 목록이 아니라 정식 오픈 체크리스트(R13 또는 해당 온보딩 R 단계)의 **필수 인수 조건**으로 명시해야 한다.
4. **DOB 최초 입력과 이후 변경 구분**: 현재 `protect_date_of_birth()`/`set_student_date_of_birth()`는 최초 입력과 이후 변경을 구분하지 않고 동일한 권한(보호자/관리자)·동일한 감사 수준(트리거 차단 여부만, 별도 변경 이력 테이블 없음)으로 처리한다. 온보딩 이후의 DOB "변경"(최초 입력이 아니라 정정)은 더 강한 확인 절차(예: 관리자 재확인, 증빙 요구)와 별도 감사 로그(누가·언제·이전 값·사유)가 필요하다는 요구사항을 확정 — 구현 시 `date_of_birth`용 별도 변경 이력 테이블 또는 `account_status_events`류 감사 테이블 신설을 검토해야 한다.
5. **COPPA 동의 방식 법률 검토**: "인증된 보호자 계정 + 검증된 household 관계"가 verifiable parental consent 요건을 충족하는지는 이 구현이 전제하지 않는다 — 정식 오픈 전 법률 검토 필수(기존 확정 사항 재확인).
6. **관리자 수동 동의(`record_manual_guardian_consent`)는 "관리자가 임의로 동의를 대신하는" 기능이 되면 안 된다 — 현재 구현에 실제 하드닝 gap 있음**: 이 함수는 `is_admin()`과 `verification_reference`가 비어있지 않은지만 확인할 뿐, **`p_consented_by`(동의자로 기록되는 보호자)가 실제로 그 학생 household의 활성 guardian인지 전혀 검증하지 않는다** — 즉 현재 코드만 보면 관리자가 임의의 uuid를 "동의한 보호자"로 기록할 수 있다. 아직 이 함수를 호출하는 관리자 화면이 없어 오늘 시점 악용 경로는 없지만(관리자 신뢰 경계 안), **관리자 UI를 붙이기 전에 반드시** (a) `p_consented_by`가 실제 그 학생의 household guardian인지 검증하는 로직을 추가하거나, (b) 최소한 UI 단에서 실제 보호자 자격을 확인한 결과만 넘기도록 강제해야 한다.
7. **오프라인/별도 방식으로 보호자 자격과 동의를 검증한 증빙이 있을 때만 예외적으로 기록 가능**: 현재 `verification_reference`는 "비어있지 않은 텍스트"이기만 하면 통과한다 — 실제로 그 증빙이 유효한지(예: 첨부파일·통화 녹취 ID가 실재하는지)는 앱/운영 레벨에서 별도로 강제해야 한다는 요구사항. DB 함수 자체가 증빙의 실체를 검증할 수는 없으므로, 관리자 UI 구현 시 증빙 첨부·검토 절차를 필수 단계로 설계해야 한다.
8. **수동 동의 필수 필드 5종 재확인**: 검증방법(`verification_method`✓)·시각(`consented_at`✓)·정책버전(`policy_version_id`✓)·증빙참조(`verification_reference`✓)는 이미 스키마에 있다. 다만 **"실행자"(이 수동 동의를 실제로 입력한 관리자)는 현재 별도로 기록되지 않는다** — `consented_by`는 보호자 본인의 id이지 실행한 관리자의 id가 아니다. 관리자 UI/함수 하드닝 시 실행 관리자를 별도 컬럼(예: `recorded_by`) 또는 감사 이벤트로 반드시 남겨야 한다.

## Task 7 원안 (2026-08-30, Task 2 승인 시 확정 — 아래 "Task 7 최종 구현"에서 3라운드 정정됨)

Task 2 승인 시 사용자가 함께 확정한 후속 Task의 원본 요구사항이다. 착수 전 사용자가 3라운드에 걸쳐 상세히 정정했다(핵심 차이: `teacher_workspace_provisioning` staging 테이블 도입, Vercel OIDC→WIF 인증 체인 확정, 7개 선행조건 개별 증거·시각 추적) — 최종 설계·구현은 아래 "Task 7 — Google Workspace 선생님 프로비저닝 (로컬 구현·검증 완료, 실제 인프라 검증 대기)" 참고. 이 하위 섹션은 원안을 그대로 보존한 역사적 기록이다.

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

## Task 7 — Google Workspace 선생님 프로비저닝 (로컬 구현·검증 완료, 실제 인프라 검증 대기)

최종 설계는 위 원안을 착수 전 사용자가 3라운드에 걸쳐 정정한 것이다. 상세 설계(테이블·함수·상태 머신·OAuth 보안·운영 인증 체인)는 `docs/superpowers/plans/2026-08-30-r2-account-family-lifecycle.md` Task 7 섹션에 전부 기록했다 — 여기서는 반복하지 않고 구현·검증 결과만 남긴다.

### 마이그레이션

**`20260905000000_r2_workspace_provisioning.sql`**: `teacher_workspace_provisioning`(staging, `workspace_email`/`workspace_google_user_id`/`linked_teacher_id` 각각 값이 있을 때만 unique) + `workspace_provisioning_events`(8종 이벤트 감사) + `teachers` 확장(workspace_email/google_user_id/personal_contact_email/workspace_recovery_email/personal_phone/onboarding_completed_at, 후자는 school/bio/phone 완료 시 트리거로 자동 파생) + `get_teacher_activation_checklist()`(7개 조건을 각각 별도 증거·시각으로 반환, 관리자 화면과 `transition_account_status()`가 공유) + provisioning 시작/생성기록/실패분류/초대발송/정지/재활성화 함수 6개 + OAuth 신원 검증·연결 함수 3개(`find_teacher_provisioning_for_identity` self-only 조회, `log_workspace_link_rejected` 거부 감사, `link_teacher_workspace_identity` self-only 강제 + profiles/teachers 최초 생성) + `transition_account_status()` 확장(teacher의 `pending→active`에만 7조건 결합, `active/suspended↔inactive` 전이를 valid-transition 표에 추가 — Task 7이 필요로 하는 최소 범위이며 R12의 전체 inactive 보관·복귀 자동화와는 별개).

### 로컬 검증 — 실제 psql 실행으로 전체 흐름 확인(발견된 버그 없음, 설계 단계에서 이미 정정 반영)

| 항목 | 결과 |
|---|---|
| 관리자 아닌 세션의 provisioning 시작 | 거부 |
| 진행 중(creating) 이메일 중복 시작 | 거부 |
| 재시도 가능 실패 기록 → `retryable_failed` + `creation_failed`/`retry_scheduled` 이벤트 | 확인 |
| 재시도 시 같은 `idempotency_key` 재사용(새 행 아님) | 확인 |
| Directory API 생성 성공 기록 → `created` + google_user_id 저장 | 확인 |
| 초대 발송 처리 → `first_login_pending` | 확인 |
| 잘못된 identity(이메일만 일치)로 `find_teacher_provisioning_for_identity` 조회 | 못 찾음(정상) |
| 사전 등록 없는 임의 Google 계정의 연결 시도 | 거부, profiles 생성 안 됨 |
| self-only 강제(본인 아닌 auth_user_id로 연결 시도) | 거부 |
| 정상 연결(본인 세션 + 정확한 identity) | 성공, `teachers.status`가 반드시 `pending`으로 생성됨 확인 |
| 같은 사람 재로그인 | 예외 없이 멱등 |
| 이미 연결된 레코드에 다른 auth_user_id로 연결 시도 | 거부 |
| 활성화 체크리스트: 7개 조건이 `linked` 하나로 뭉개지지 않고 개별 확인됨 | `valid_rate`/`onboarding_complete`/`contract_signed`만 false로 정확히 열거 |
| 선행조건 미충족 상태로 `active` 전환 시도 | 거부, 메시지에 부족한 조건명 나열 |
| 시급·온보딩·계약 채운 뒤 `active` 전환 | 성공 |
| 기존 active 선생님(박서연)의 `suspended↔active` 전이 | 워크스페이스 조건과 무관하게 정상 동작(회귀 없음) |
| 신규 `inactive`/`active` 상태 전이 + `suspend_teacher_workspace`/`reactivate_teacher_workspace` 기록 | 정상 |
| `onboarding_completed_at` 자동 파생(school 지우면 다시 null) | 확인 |

### 앱 코드

- `lib/google-workspace.ts`(신규) — Directory API 클라이언트. 인증 체인은 Vercel OIDC→GCP WIF→서비스 계정 impersonation→`signJwt`(DWD)→OAuth 토큰 교환을 raw fetch로 구현(기존 `lib/docusign.ts`와 동일한 무의존성 스타일, `googleapis` 패키지 추가하지 않음). Preview 환경과 `WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS` 미설정 시 실제 호출을 원천 차단하는 가드 포함 — 로컬/CI에서는 항상 이 가드에 걸리거나(unit test로 확인) `vi.mock()`으로 대체한다.
- `app/admin/workspace-actions.ts`(신규) — 프로비저닝 시작(재시도 시 이미 생성된 google_user_id가 있으면 Directory API를 다시 호출하지 않고 이어서 진행), 정지/재활성화(재활성화는 `set_teacher_rate`가 service_role 전용이라 `createAdminClient()`로 별도 호출 — `app/admin/users-actions.ts`와 동일 패턴, 코드 리뷰 중 이 실수를 미리 잡음), 체크리스트 조회.
- `app/login/teacher-google-actions.ts` + `app/auth/teacher-callback/route.ts`(신규) — 선생님 전용 Google OAuth 로그인·콜백. 콜백은 provisioning 레코드 불일치·identity 정보 누락·DB 최종 검증 실패 각각의 경우 `admin.auth.admin.deleteUser()`로 방금 생성된 auth.users 행을 즉시 삭제해 고아 계정을 남기지 않는다.
- `app/login/page.tsx` — 선생님 전용 "Google로 로그인" 버튼 추가(학생·보호자·관리자 로그인 방식 불변).
- `app/admin/WorkspaceTab.tsx` + `workspace-data.ts`(신규, AdminShell에 "Workspace" 탭 추가) — 프로비저닝 시작 폼, 현황 목록, 7개 선행조건 체크리스트 표시(조건별 라벨+증거 시각), 정지/재활성화 버튼.
- `app/admin/TeacherDetailPanel.tsx` — 상태 변경 실패 시(신규 7조건 게이트 포함) 에러 메시지를 화면에 표시하도록 수정(기존에는 실패가 조용히 무시됨).
- 기존 Calendly 자기 온보딩 완전 제거: `app/teacher/onboarding-actions.ts`/`.test.ts` 삭제, `TeacherHomeDashboard.tsx`에서 관련 UI·상태·import 제거(대기 배너만 남김), `TeacherDashboardData`/`loadTeacherDashboard`에서 미사용 `calendlySchedulingUrl` 제거. 관리자용 `TeacherDetailPanel`의 Calendly URL 편집(선생님 자기 온보딩과 무관, 관리자가 대신 입력)과 `teachers.calendly_scheduling_url` 컬럼 자체는 R6까지 그대로 유지(학생·보호자 예약이 계속 참조).

### 발견·수정한 리그레션 1건 — 기존 E2E의 "제네릭 상태 전이" 테스트

`e2e/account-lifecycle.spec.ts`의 "정상 상태 전이(pending→active, ...)는 허용되고 그 외는 거부된다" 테스트가 teacher 역할로 `pending→active`를 직접 exercise하고 있었는데, 이 테스트의 의도는 **역할과 무관한 전이표 자체**를 검증하는 것이었다 — teacher를 쓰면 Task 7의 7개 선행조건 게이트에 걸려 의도와 다른 이유로 실패한다. parent로 바꿔 실행하도록 수정(parent는 추가 게이트가 없어 전이표만 순수하게 검증됨). 로그인 페이지에 "선생님 — Google로 로그인" 버튼을 추가하면서 `getByRole("button", { name: "로그인" })`가 부분 문자열 매칭으로 2개 요소에 걸리는 strict-mode 위반도 함께 발견해 `e2e/helpers.ts`의 `loginAs()`와 `account-lifecycle.spec.ts`/`account-merge.spec.ts`의 인라인 호출 전부에 `exact: true`를 추가했다.

### 전체 로컬 검증

| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` | 클린 |
| `npx vitest run` | **89개 파일 382개 테스트 전부 통과**(신규: `app/admin/workspace-actions.test.ts`, `lib/google-workspace.test.ts`, `app/auth/teacher-callback/route.test.ts`, `app/login/teacher-google-actions.test.ts`, `app/admin/WorkspaceTab.test.tsx`, `TeacherHomeDashboard.test.tsx` 갱신) |
| **Playwright 전체** | **25개 전부 통과**(리그레션 수정 반영, Task 7 자체의 실제 Directory API 경로는 별도 E2E로 만들지 않음 — mock 반복 테스트는 vitest로 충분히 커버, 실제 호출은 실제 인프라 준비 후 1회 검증 대상) |

### 원격 적용 (2026-09-05 완료, 커밋 `6cbbaea`) — DB 마이그레이션만, 앱 코드·실제 인프라는 별도 단계

사용자가 5단계 진행 순서를 확정했다: (1) DB 마이그레이션 적용·재검증, (2) GCP/Vercel WIF 인프라 설정(사용자 조치), (3) 앱 코드 배포, (4) 테스트 OU에서 실제 Workspace 계정 1건 생성 및 전체 E2E 검증, (5) 검증 성공 후 Task 7 완료 처리. 이 절은 1단계만 다룬다 — **실제 Google Workspace 호출은 사용자가 인프라 체크리스트를 확인·승인하기 전까지 실행하지 않는다.**

**백업**: `supabase db dump --linked`(스키마+데이터)를 합쳐 `~/alton-db-backups/pre-r2-task7-full-2026-09-05.sql`(345,806+ bytes 규모, 9,214줄)로 저장, SHA-256 체크섬 기록. `chmod 700`/`600`, git 미포함.

**적용 전 원격 migration 목록**: 43개 적용됨, 1개(`20260905000000`) 미적용 확인 → 사전 상태 스냅샷(`profiles=6, teachers=3, students=1, parents=1`) 기록 → `supabase db push --linked` 실행 → 적용 성공 → `supabase migration list --linked`로 로컬·원격 44개 전부 일치 확인.

**재검증 결과**:

| 항목 | 결과 |
|---|---|
| 로컬·원격 migration 목록 일치 | 44개 전부 동일(불일치 0건) |
| 기존 사용자·선생님 상태·데이터 보존 | `profiles=6, teachers=3, students=1, parents=1` — 적용 전후 완전 동일. 기존 선생님 3명의 `workspace_email`/`workspace_google_user_id`/`onboarding_completed_at` 전부 null(신규 컬럼, 기존 데이터 무영향) 확인 |
| 신규 staging 테이블 빈 상태 | `teacher_workspace_provisioning=0, workspace_provisioning_events=0` |
| 26개 정책 `current_account_active(` 잔존 참조 | 0건(Task 6 RLS 무변경 확인) |
| 신규 테이블 RLS 배포 확인 | `teacher_workspace_provisioning`="관리자/본인 조회", `workspace_provisioning_events`="관리자만 조회" 정확히 배포됨 |
| **기존 로그인·관리자 상태 전환 회귀** | 실제 원격 선생님(`d8fe6918-...`, active) 계정으로 `suspended→active` 실제 실행 → 정상 동작, 최종 `active` 확인(Task 7의 7조건 게이트는 `pending→active`에만 적용되므로 무관) |
| **기존 선생님의 활성화 체크리스트(신규 provisioning 없이)** | `valid_rate=true`(실제 `teacher_rate_history` 기준), 나머지 6개는 false — 실제 데이터에서 정확히 파생됨을 확인 |
| **신규 staging/state machine 전체 흐름(합성 테스트 데이터)** | provisioning 시작(`creating`) → 실패 기록(`retryable_failed`, `creation_failed`+`retry_scheduled` 이벤트) → 재시도(같은 `idempotency_key` 재사용 확인) → 생성 성공 기록(`created`) → 초대 발송(`first_login_pending`) 전부 실제 실행 확인 |
| **OAuth anti-spoofing(합성 테스트 데이터)** | 잘못된 google_user_id로 조회 → 못 찾음, self-only 강제(본인 아닌 auth_user_id로 연결 시도) → 거부, 정상 연결 → 성공하며 **`teachers.status`가 정확히 `pending`으로 생성됨** 확인 |
| **연결 직후 활성화 체크리스트** | `workspace_issued`/`first_login`/`identity_linked`/`admin_base_info` 4개가 각각 다른 정확한 증거 시각과 함께 true, `valid_rate`/`onboarding_complete`/`contract_signed`는 false — 하나로 뭉개지지 않음을 원격에서도 확인 |
| **선행조건 미충족 상태의 `active` 전환 시도** | 거부, 메시지에 정확히 `valid_rate, onboarding_complete, contract_signed` 나열 |
| 핵심 smoke test | `students`×`profiles`×`enrollments` 조인 등 기본 쿼리 정상 동작 |
| 앱 코드 미배포 상태에서 기존 서비스 영향 | 이 절 전체가 DB 함수·테이블 직접 호출만으로 검증됐고, 신규 라우트(`/auth/teacher-callback`)·서버 액션·UI는 전혀 배포되지 않아 기존 로그인·포털 어디에서도 새 코드 경로에 진입할 방법이 없다 — 스키마 변경도 순수 추가라 기존 쿼리·RLS 무영향 |

**테스트 데이터 정리**: 합성 provisioning 레코드(`b64e66cc-...`)와 합성 auth.users/profiles/teachers 행(`c1111111-...`)을 FK 순서(`workspace_provisioning_events`→`teacher_workspace_provisioning`→`teachers`→`profiles`→`auth.users`)대로 전부 삭제, 사전 스냅샷과 동일한 상태(`profiles=6, teachers=3, teacher_workspace_provisioning=0, workspace_provisioning_events=0`)로 원격 DB를 복원 확인.

**결론**: 재검증 항목 전부 통과. 실사용자 데이터 손상·의도치 않은 상태 변경 없음, 기존 로그인·관리자 상태 전환 회귀 없음. **DB 마이그레이션 단계만 완료** — Task 7 자체는 계속 "로컬 구현 완료, 실제 인프라 검증 대기" 상태로 유지한다.

### Task 7 — 인증 구현 교체 (2026-09-05, 콘솔 설정 착수 전 코드 선행 교체)

사용자가 인프라 체크리스트 검토 중 인증 구현 자체의 정확성을 재점검하도록 요청했다. Vercel 공식 GCP OIDC 문서(`https://vercel.com/docs/oidc/gcp`)를 실제로 확인한 결과, OIDC→WIF→서비스 계정 impersonation 구간은 `@vercel/oidc`의 `getVercelOidcToken()` + `google-auth-library`의 `ExternalAccountClient`(`subject_token_supplier`/`service_account_impersonation_url`)를 쓰도록 공식 권장하고 있었다 — 이전에 raw fetch로 손수 구현한 STS 토큰 교환 코드는 이 공식 경로로 완전히 교체했다(fallback으로 남기지 않음, 같은 보안 경로 두 개를 유지하는 비용이 더 크다는 판단).

**signJwt 호출 주체 분석(교체 전 확인)**: 현재 코드 흐름은 (1) WIF 원리금이 `generateAccessToken`으로 `gate-c-automation@...`를 impersonation → (2) 그 impersonated 토큰으로 **`gate-c-automation@...`가 자기 자신을 대상으로** `signJwt`를 호출. 즉 signJwt의 호출 주체와 대상이 동일한 서비스 계정이다(self-referential). 이에 따라 IAM 권한도 2단계로 분리 확정: (a) Vercel Production principal(정확한 team/project/environment로 제한, Preview는 아예 바인딩하지 않음) → `gate-c-automation@...`에 `roles/iam.workloadIdentityUser`, (b) `gate-c-automation@...` → 자기 자신에 `iam.serviceAccounts.signJwt`만 포함한 최소 custom role(전체 Token Creator 번들 아님).

**변경 파일**:
- `lib/google-workspace-auth.ts`(신규) — 인증 체인 전담. `getImpersonatedAccessToken()`(ExternalAccountClient 기반, google-auth-library가 내부적으로 만료 임박 갱신), `getDirectoryApiAccessToken()`(signJwt+DWD 토큰 교환, `lib/docusign.ts`와 동일한 모듈 스코프 만료-체크 캐싱 패턴 — 같은 실행 환경에서만 유효, 외부 저장소 없음). Preview 환경 차단 가드 포함. 에러 메시지에 Google 응답 본문을 절대 포함하지 않는다(토큰 원문 유출 경로 원천 차단).
- `lib/google-workspace-directory-readonly.ts`(신규) — Directory API **읽기 전용**(GET만): `getWorkspaceUserByEmail`, `getWorkspaceUserByGoogleId`, `listWorkspaceUsersInOrgUnit`. 별도 게이트 `WORKSPACE_PREFLIGHT_ALLOW_REAL_READS`(쓰기 플래그와 독립) + Preview 차단. 쓰기 함수를 아예 import하지 않아 구조적으로 쓰기가 불가능하다(같은 함수에서 boolean 하나로 read/write를 가르지 않는다는 요구사항 반영).
- `lib/google-workspace.ts`(재작성, 쓰기 전용) — `createWorkspaceUser`/`suspendWorkspaceUser`/`reactivateWorkspaceUser`만 남기고 옛 인증 체인 코드는 전부 제거, `lib/google-workspace-auth.ts`의 `getDirectoryApiAccessToken()`을 가져다 쓴다. 게이트는 `WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS`(읽기 플래그로는 절대 열리지 않음).
- `app/api/admin/workspace-preflight/route.ts`(신규) — 읽기 전용 preflight. 관리자 UI 버튼 없음, 배포 시 자동 실행 없음 — 관리자 세션으로 직접 호출하는 운영 점검 전용 경로. `lib/google-workspace-directory-readonly.ts`만 import(쓰기 모듈은 import 자체가 불가능한 구조). 응답에는 토큰 원문을 전혀 포함하지 않고 단계별 성공/실패, Vercel 환경, 대상 GCP 프로젝트/서비스 계정/delegated admin 이메일, 테스트 OU의 현재 계정 baseline 스냅샷(사후 비교용), 타겟 이메일(`teacher1@alton.education` 등) 사전 존재 여부, 실행 시각, 오류 메시지(응답 본문 제외)만 담는다.
- `package.json`/`package-lock.json` — `@vercel/oidc@3.8.5`, `google-auth-library@11.0.2` 추가(둘 다 Apache-2.0, 라이선스 충돌 없음). `google-auth-library`가 Node `>=22`를 요구해 `engines.node` 필드를 명시적으로 추가.
- `.env.example` — 신규 비밀 아님 식별자 6개 문서화(`GOOGLE_WORKLOAD_IDENTITY_AUDIENCE`, `GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL`, `WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS`, `WORKSPACE_PREFLIGHT_ALLOW_REAL_READS`).

**최종 인증 호출 흐름**: `getVercelOidcToken()`(Vercel OIDC 토큰) → `ExternalAccountClient`가 내부적으로 STS 교환+`generateAccessToken` 수행(impersonation, cloud-platform 범위) → `signDelegatedAdminJwt()`(`gate-c-automation@...`가 자기 자신 대상 `signJwt` 호출, DWD `sub`=delegated admin claim) → OAuth 토큰 교환(`grant_type=jwt-bearer`) → Directory API 범위 최종 토큰.

**read/write 경계**: 파일 단위 — `google-workspace-directory-readonly.ts`(GET만, `WORKSPACE_PREFLIGHT_ALLOW_REAL_READS` OR `WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS`) vs `google-workspace.ts`(POST/PATCH만, `WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS`만). 각 파일에 "반대쪽 함수를 export하지 않는다"는 unit test로 구조적 분리를 실제로 확인했다(같은 함수·같은 파일에서 플래그 하나로 read/write를 가르는 패턴이 아님).

**필요한 환경변수 최종 목록**: `GOOGLE_WORKLOAD_IDENTITY_AUDIENCE`(WIF provider 리소스명, project number 사용), `GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL`(`gate-c-automation@alton-integration-sandbox.iam.gserviceaccount.com`), `GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL`(`official@alton.education`, 1회 테스트용), `WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS`(기본 `false`, Production 승인 후에만 `true`), `WORKSPACE_PREFLIGHT_ALLOW_REAL_READS`(기본 `false`, preflight 단계에서만 `true`) — 전부 비밀 아님, Vercel Production 환경변수로 설정. Google OAuth Client Secret은 Supabase Auth 프로바이더 설정에만 저장하며 이 목록에 포함하지 않는다.

**로컬 검증**: `npx tsc --noEmit` 클린, `npx vitest run` **92개 파일 403개 테스트 전부 통과**(신규: `lib/google-workspace-auth.test.ts` 9건, `lib/google-workspace-directory-readonly.test.ts` 5건, `lib/google-workspace.test.ts` 갱신 6건, `app/api/admin/workspace-preflight/route.test.ts` 4건 — Preview 차단, 옛 STS fetch 코드가 실제로 사라졌는지(fetch 미호출로 확인), 토큰 원문이 에러/응답 어디에도 없는지, read/write export 경계 전부 실제 실행으로 확인). `npm run build` 정상 완료(신규 라우트 `/api/admin/workspace-preflight`, `/auth/teacher-callback` 정상 컴파일, Node 런타임 — Edge 아님).

**아직 하지 않은 것**: 콘솔 설정(WIF 풀·프로바이더·IAM 바인딩·OAuth Client 등)과 실제 GCP/Workspace 호출은 전혀 시작하지 않았다 — 사용자가 이 보고를 확인한 뒤 진행 승인.

### Task 7 — Preflight 하드닝 (2026-09-05, 콘솔 설정 착수 직전 추가 보완, 커밋 `4567702`)

사용자가 콘솔 설정 승인 전 preflight 응답·감사·플래그 운용을 추가로 보완하도록 요청했다.

- **응답·감사 최소화**: `workspace_preflight_runs` 감사 테이블 신설(관리자만 조회). 저장·응답 항목을 단계별 성공/실패, 오류 status(응답 본문 아님), OU 사용자 수, Google user ID의 SHA-256 해시(원문 아님), 타겟 테스트 이메일 존재 여부(boolean), 실행자·시각·환경으로 제한 — 이름·개인 이메일·전화번호·토큰 원문·임시 비밀번호·전체 Directory 응답은 어디에도 남기지 않는다. unit test로 응답 JSON에 실제 이메일/원본 google_user_id/토큰 문자열이 전혀 없음을 확인.
- **라우트 레벨 3중 확인**: 관리자 권한(`requireAdmin()`) + `VERCEL_ENV==='production'` 명시 확인(Preview/미설정 전부 차단) + `WORKSPACE_PREFLIGHT_ALLOW_REAL_READS==='true'` 명시 확인 — 셋 다 만족해야 실제 Google 호출 이전 단계까지 진행한다.
- **반복 호출 제한**: `begin_workspace_preflight_run()`이 실제 Google API 호출 **이전에** 300초 쿨다운을 DB 레벨에서 검사·예약하고(위반 시 429), `finish_workspace_preflight_run()`이 결과를 채운다 — 쿨다운 위반은 어떤 실제 API 호출도 일어나기 전에 걸림을 실제 실행으로 확인(psql 직접 테스트: 관리자 아닌 세션 차단, 정상 기록, 즉시 재실행 시 쿨다운 거부 전부 확인).
- **Hosted/로컬 Supabase OAuth 완전 분리**: `supabase/config.toml`에 로컬 전용 `[auth.external.google]` 블록 추가(로컬 콜백 `http://localhost:3010/auth/teacher-callback`만 등록, Client Secret은 `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)`로 로컬 `.env`에서만). Hosted Supabase 프로젝트의 Site URL·Additional Redirect URLs·Google Provider 설정은 이 파일과 무관하며(콘솔에서 사용자가 직접 등록), 운영 도메인·운영 OAuth Client만 등록하고 로컬 콜백은 절대 등록하지 않는다는 원칙을 콘솔 체크리스트에 반영.
- **플래그 운용 순서 확정**: 두 플래그 기본값 `false` 유지. 콘솔 1~8단계 완료 후 read flag만 `true`로 켜 preflight 실행 → 검토 후 read flag는 다시 `false`로 복귀(기본 원칙) → 실제 쓰기 테스트 직전에만 write flag를 별도 승인으로 `true` → 쓰기 검증 종료 후 다시 `false`. 장기 운영에서 계속 켜둘지는 테스트 종료 후 별도 운영 통제 정책으로 결정(지금 결정하지 않음).
- **Node 런타임 확인(사용자 조치 필요)**: `engines.node>=22`는 코드 선언일 뿐, Vercel 프로젝트의 실제 배포 Node 버전은 Vercel 대시보드(Project Settings → General → Node.js Version)에서 직접 확인해야 한다 — 이 세션에는 Vercel API/CLI 인증이 없어 원격으로 조회할 수 없다. 대신 로컬에서 확인 가능한 것들은 확인 완료: (a) 어떤 기존 라우트도 Edge 런타임을 선언하지 않음, (b) `middleware.ts`(Next.js 특성상 항상 Edge 런타임)는 신규 Workspace 모듈을 전혀 import하지 않음, (c) 신규 의존성(`google-auth-library`)을 쓰는 파일은 신규 3개 라우트/서버 액션으로만 국한되어 기존 기능에는 번들링·런타임 영향이 없음, (d) `npm run build` 정상 완료(신규 라우트 전부 Node 런타임으로 컴파일).

### Task 7 — 로컬 Google OAuth 로그인 E2E 실제 검증 (2026-09-01, GCP 콘솔 Step 1~8과 별개로 코드·로컬 인프라만으로 진행)

콘솔 Step 1~8(Vercel OIDC, GCP WIF Pool/Provider/IAM, Workspace DWD scope·테스트 OU, 로컬 OAuth Client) 진행 중 로컬 Google 로그인 전체 체인을 실제로 검증했다. Directory API 읽기·쓰기 전혀 없음, 원격 개발 DB·Vercel Production 환경 전혀 변경하지 않음 — 로컬 DB·로컬 OAuth Client·실제 브라우저 로그인만 사용.

**사전 이슈 발견·수정 2건**:
1. `npx supabase db reset`만으로는 GoTrue 컨테이너의 Auth 프로바이더 설정이 갱신되지 않는다(`GOTRUE_EXTERNAL_GOOGLE_ENABLED` 등이 반영 안 됨) — `supabase stop` + `supabase start`로 전체 재시작해야 하며, `.env.local`의 `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`이 `env()` 치환되려면 그 값이 CLI를 실행하는 셸의 실제 프로세스 환경에 export돼 있어야 한다(이 프로젝트의 `.env.local`은 여러 줄짜리 값이 섞여 있어 통째로 `source`하면 파싱 에러가 나므로, 필요한 한 줄만 추출해 export).
2. 이 진단 과정에서 `docker exec ... env`로 GoTrue 컨테이너 환경변수를 확인하다 **Client Secret 원문을 대화에 실수로 노출**했다(사용자가 앞서 스크린샷으로 공유한 것과 같은 값) — 사용자가 즉시 재발급하고 `.env.local`을 교체했고, 이후 모든 확인은 `grep -v SECRET`으로 비밀값을 제외하고 재검증했다. **교훈**: 비밀값이 들어있을 수 있는 명령 출력은 항상 필터링한 뒤에만 표시한다.

**실제 브라우저 3-라운드 검증**:

| 항목 | 결과 |
|---|---|
| Round A-1: `teacher1@alton.education`, provisioning은 있으나 `workspace_google_user_id` 미설정(NULL) 상태로 로그인 | 거부(`/login?error=등록되지 않은 계정입니다`) — NULL은 어떤 실제 ID와도 매치되지 않음을 실제 확인 |
| 실제 Google user ID 확보 방법 | Directory API 조회·추측 없이 확보 — GoTrue 감사 로그는 내부 actor_id(Supabase 자체 UUID)만 남기고 원문 sub를 남기지 않음을 실측 확인했고, 대신 콜백 라우트 코드에 **임시** 진단 로그(로컬 dev 서버 stdout에만, DB에는 전혀 기록 안 함)를 추가해 실제 sub(`111507678677650332821`)를 확보한 뒤 즉시 코드에서 제거(git diff 확인으로 원상 복구 검증) |
| Round A-2: 실제 ID로 provisioning 갱신 후 `teacher1@alton.education` 재로그인 | **성공** — `profiles`/`teachers` 생성, `role=teacher`, **`status=pending`**(OAuth 연결 자체가 활성화를 의미하지 않는다는 설계 그대로), `/account-pending`으로 정상 라우팅(관리자 승인 대기 안내) |
| Round B: `teacher2@alton.education`, provisioning은 있으나 **의도적으로 틀린** placeholder google_user_id로 로그인 | 거부 — 이메일이 일치하는 provisioning 레코드가 존재해도 Google 고유 ID가 다르면 연결되지 않음을 실제 브라우저로 확인(이메일만으로는 연결되지 않는다는 anti-spoofing 요구사항의 핵심 증거) |
| 거부 시 고아 계정 미잔존 | `profiles`/`auth.users` 카운트가 시나리오 전후 정확히 9/9로 일치(성공 케이스에서만 정확히 +1) — Round B의 orphan auth.users는 자동 삭제 확인 |
| 거부 감사 로그의 비식별화 | `workspace_provisioning_events`에 남은 3건의 `link_rejected` 사유가 전부 `email_hash=.../google_id_hash=...`(SHA-256) 형태이고 이메일·Google ID 원문은 어디에도 없음을 확인 |

**정리**: `teacher_workspace_provisioning` 2건(teacher1/teacher2), 연결 이벤트 6건, Round A에서 생성된 `profiles`/`teachers`/`auth.users`(teacher1 fixture) 1세트 전부 FK 순서(`workspace_provisioning_events`→`teacher_workspace_provisioning`→`teachers`→`profiles`→`auth.users`)대로 삭제, 최종 `profiles=9, auth.users=9, teacher_workspace_provisioning=0, workspace_provisioning_events=0`으로 시나리오 시작 전 baseline과 정확히 일치 확인. `app/auth/teacher-callback/route.ts`는 git diff 결과 커밋된 상태와 완전히 동일(임시 진단 로그 완전 제거 확인). `npx tsc --noEmit` 클린, 관련 vitest 전체 통과.

### Task 7 — 첫 R2 앱 코드 배포 발견·실행 (2026-09-01)

콘솔 Step 9 완료 후 read-only preflight를 실제 호출했더니 `404 Not Found`가 나왔다. 원인 조사 결과 **`origin/main`(GitHub `officialalton/alton`, Vercel `alton` 프로젝트가 추적하는 저장소)이 R2 전체 착수 이전 커밋(`8918594`)에 머물러 있었다** — Task 2~7(계정 상태 전환, 초대, 병합, 13세 미만 동의, Workspace 프로비저닝) 전부가 로컬 git에는 커밋됐지만 한 번도 GitHub에 push된 적이 없었다. 원격 Supabase DB는 태스크마다 재검증하며 반영해왔지만, **앱 코드 자체는 이번이 R2의 첫 배포**다. "Production 재배포"는 기존 빌드를 재배포할 뿐 새 커밋을 가져오지 않으므로 그동안 관측되지 않았다.

**push 전 상태 기록**:
- 로컬 HEAD: `31c1fb60ae757cf94bb5c0e2a660da9b44268a61`
- 기존 origin/main: `8918594135e008bb23a56ac98733ad87a95ee8be`
- push 대상 범위: `origin/main..HEAD`, 37개 커밋(가장 오래된 `5590be5`~가장 최근 `31c1fb6`, R2 Task 2~7 전체 + 그 이전 목업 갭 분석 문서 커밋들)
- `git log HEAD..origin/main` 결과 없음 + `git merge-base HEAD origin/main` = `origin/main`과 정확히 일치 → 순수 fast-forward, 충돌·분기 없음 확인
- push 직전 최종 확인: `supabase/`, `app/`, `lib/`, `e2e/`, `package.json`, `package-lock.json`, `.env.example` 전부 `git status` 변경 없음(누락된 필수 코드·마이그레이션 없음). 미추적/미커밋 항목은 이 세션 이전부터 있던 PM 문서 초안뿐(범위 밖, 원래부터 건드리지 않음).
- 사용자 승인: "R2 Tasks 2~7 전체 37개 커밋을 main에 한 번에 올리는 것으로 승인합니다", force push 금지·일반 fast-forward만 명시.

**push 실행**: 이 대화 세션의 auto-mode 분류기가 `git push origin main`을 차단해(공유 저장소 main에 대한 push라 세션 정책상 차단), 사용자가 자신의 Mac 터미널에서 직접 `git push origin main` 실행 → `8918594..b7d495b main -> main`으로 성공(문서 기록용 커밋 1개 추가로 최종 38개 push). `git fetch` 후 `origin/main` = 로컬 HEAD = `b7d495b1c573a78da569b6e8e5395ae10b9df93f` 일치 확인, `git status -sb`에 분기 없음.

**배포 확인(외부에서 확인 가능한 범위, Vercel 대시보드 접근 없이 HTTP로 검증)**:

| 항목 | 결과 |
|---|---|
| `app.alton.education` 응답 | `200`, `server: Vercel`, 정상 서빙 |
| `/api/admin/workspace-preflight` (미인증 POST) | **404 아님** — `403` + `x-matched-path: /api/admin/workspace-preflight` + 본문 `{"error":"로그인이 필요합니다."}`(정확히 `requireAdmin()`의 거부 메시지) — 실제 Google/Directory 로직에는 전혀 도달하지 않고 인증 게이트에서 막힘을 확인(요청대로 실제 preflight 미실행) |
| 핵심 smoke test — 역할별 포털(세션 없음) | `/student`, `/parent`, `/teacher`, `/admin` 전부 `307`(→`/login`), 500 없음 |
| 핵심 smoke test — 상태 제한 화면 | `/consent-pending`, `/account-pending`, `/account-suspended` 전부 `307`(→`/login`), 500 없음 |
| `/auth/teacher-callback`(코드 없이 GET) | `307` → `https://app.alton.education/login?error=Google 로그인에 실패했습니다.` — **redirect 대상이 정확히 `app.alton.education`으로 해석됨**(Vercel Production의 `NEXT_PUBLIC_SITE_URL`이 올바르게 설정돼 있음을 확인) |
| 로그인 페이지 UI | HTML에 "선생님 — Google로 로그인" 버튼 실제 존재 확인(신규 코드가 실제로 서빙되고 있음을 최종 확인) |

**미확인(사용자 조치 필요)**: Vercel 대시보드에서 Production Branch가 실제로 `main`인지(Deploy Hook 설정이 아니라 Settings → Git → Production Branch 화면 기준), 그리고 이 배포가 정확히 커밋 `b7d495b`를 빌드했는지는 이 세션에 Vercel API/대시보드 접근이 없어 직접 확인 불가 — 위 HTTP 검증 결과(신규 라우트·신규 UI가 실제로 서빙됨)로 강하게 뒷받침되지만, 최종 확인은 사용자가 Vercel 대시보드에서 직접 해야 한다.

**이 시점까지 유지된 것**: `WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS=false`, `WORKSPACE_PREFLIGHT_ALLOW_REAL_READS=false`(둘 다 변경 없음) — 실제 Directory API 호출은 이번 절 전체에서 한 번도 실행되지 않았다.

### 남은 작업 (사용자 5단계 계획 기준, 2026-09-01 갱신)

1. ~~DB 마이그레이션 적용 및 재검증~~ — 완료(위 절).
2. GCP/Vercel WIF 인프라 설정 — **콘솔 Step 1~7 완료, Step 8 절반 완료, 8 나머지는 도메인 확정 대기로 일시 중단**:
   - [x] Step 1 Vercel OIDC 활성화(Team 모드, issuer `https://oidc.vercel.com/alton7`, 실제 토큰 audience `https://vercel.com/alton7` 확인)
   - [x] Step 2 GCP API 3종(Admin SDK, IAM Service Account Credentials, Security Token Service) 활성화 확인
   - [x] Step 3 WIF Pool/Provider 생성(`vercel`/`vercel`, Allowed audiences = `https://vercel.com/alton7`, provider resource `//iam.googleapis.com/projects/590621873979/locations/global/workloadIdentityPools/vercel/providers/vercel`)
   - [x] Step 4 WIF principal(Production subject `owner:alton7:project:alton:environment:production`) → `gate-c-automation@...`에 `roles/iam.workloadIdentityUser` 바인딩(Preview 바인딩 없음 확인)
   - [x] Step 5 self-referential `iam.serviceAccounts.signJwt`만 포함한 커스텀 역할(`workspaceSignJwtOnly`) 생성 + `gate-c-automation@...`가 자기 자신에 바인딩(gcloud로 생성·바인딩, 읽기 전용 명령으로 재검증 완료)
   - [x] Step 6 기존 DWD Client(`112226937341201546024`) 7개 scope 유지 + `admin.directory.user` 추가(총 8개, 재확인 완료)
   - [x] Step 7 테스트 OU `/Alton Integration Sandbox/Teachers` 생성(사용자 0명 확인)
   - [x] Step 8 로컬 절반: 로컬 전용 OAuth Client 생성, `supabase/config.toml` 반영, **로컬 Google OAuth 로그인 E2E 실제 검증 완료(위 절, 사용자 최종 확인 2026-09-01 — 반복 불필요)**
   - [ ] Step 8 운영 절반(보류 중, 사용자 결정 대기): `alton.education`의 Vercel Production Domain 연결을 먼저 확정한 뒤 진행 — 운영 Google OAuth Client, Hosted Supabase Google Provider + Site URL/Additional Redirect URLs, Vercel Production 환경변수(비쓰기: `GOOGLE_WORKLOAD_IDENTITY_AUDIENCE`/`GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL`/`GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL`), 읽기 전용 preflight(`WORKSPACE_PREFLIGHT_ALLOW_REAL_READS`), 테스트 OU 실제 Workspace 계정 검증 순서로 진행 예정. **그 전까지 운영 OAuth 설정·실제 Directory API 호출·원격 개발 DB 반영 전부 보류**(사용자 명시 지시, 2026-09-01).
3. 앱 코드 배포(2번 전체 완료 후).
4. 테스트 OU에서 실제 Workspace 계정 1건 생성 + 전체 E2E 검증(WIF 연결, 충돌·재시도·정지·재활성화, 실제 OAuth 최초 로그인 + immutable Google user ID 연결 — `teacher1@alton.education`/`teacher2@alton.education` 기존 계정으로 조회·anti-spoofing 확인은 로컬에서 이미 실증했으므로 운영에서는 반복 없이 최소 확인만, 신규 생성은 `teacher-provisioning-test@alton.education` 전용 계정 1개로).
5. 4번 검증 성공 후에만 Task 7 완료 처리(사용자 확정: "Task 7은 mock 구현만으로 완료 처리하지 않는다").
6. 정식 오픈 전: 위임 대상을 `official@alton.education`에서 사용자 관리 권한만 가진 전용 자동화 관리자 계정으로 분리(보안 인수 조건, `master-roadmap-v3.md` R12에 등록 완료).
