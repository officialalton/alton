# R1 — 마이그레이션 실행 로그

- 목적: Gate B v5(§6.2 실행 순서)에 따라 R1 마이그레이션을 실행하는 과정의 실행 기록이다. 정책 문서가 아니라 무엇을 언제 실행했고 결과가 어땠는지의 로그다.
- 원칙(사용자 확정, 2026-08-30): 사용자 승인 전에는 `db push`, 원격 migration 적용, 데이터 삭제를 실행하지 않는다. 신규 migration SQL은 로컬/별도 테스트 환경에서 먼저 재현·검증하고, 적용 대상 SQL·영향 테이블·롤백 절차를 보고한 뒤 승인받아 진행한다.

## 1단계 — 커밋 SHA 기록 (완료, 2026-08-30)

- 커밋: `e27bc8e4e0c25442759d1b03690b930051d2bf45` (2026-08-29 12:06:53 -0700)
- 확인: 이 커밋 이후 작업 트리 변경분은 전부 `docs/`, `CLAUDE.md`, `README.md`, `AGENTS.md`, `CONTEXT.md` — 애플리케이션 코드·스키마 변경 없음. 롤백 시 이 커밋으로 되돌리면 앱 코드는 마이그레이션 이전 상태와 일치한다.

## 2단계 — 개발 DB 전체 백업 (완료, 2026-08-30)

- 방식: `supabase db dump --linked`(CLI 표준 경로)가 무한 대기해 중단하고 원인 진단 후, 동일한 pg_dump 플래그를 직접 재현해 백업했다(§진단 참고).
- 파일: `~/alton-db-backups/pre-r1-full-2026-08-30.sql`(스키마+데이터, `public` 스키마 전체, `auth`/`storage`/`realtime` 등 Supabase 내부 스키마는 제외 — CLI 기본 제외 목록과 동일)
- 체크섬(SHA-256): `f6a8099698eda18dbe7126daaed484f2b0515c09853e01034284bd0eb1ac2341` (동일 경로에 `.sha256` 파일로 함께 저장)
- 무결성 검증: 파일 끝에 `-- PostgreSQL database dump complete` 트레일러 확인(잘림 없음). 46개 테이블 전부 `COPY ... \.` 블록이 정상 종료됨을 확인. 알려진 실측치와 정확히 일치: `enrollments` 1행, `sessions` 0행, `students` 1행, `teachers` 2행, `credit_transactions` 1행, `makeup_credits`/`teacher_payouts` 0행, `profiles` 5행 — Gate B v5 §0의 실측 기록과 일치.
- 복원 형식: 평문 SQL(`psql -f pre-r1-full-2026-08-30.sql`로 직접 복원 가능한 형식). 원격 전체 복구가 필요하면 이 파일과 별개로 Supabase 대시보드의 point-in-time recovery도 병행 사용(Gate B §6.4 원칙).
- **보관 위치·권한**: `~/alton-db-backups/`(로컬 홈 디렉터리, `/Users/jangjiman` 하위 — iCloud Drive 컨테이너인 `~/Library/Mobile Documents/...`가 아님을 확인). 디렉터리 `chmod 700`, 파일 `chmod 600`으로 소유자만 읽기 가능하도록 설정 완료(2026-08-30). 저장소(git)에는 커밋하지 않는다(실제 사용자 데이터 포함). 스크래치패드에 남아있던 백업 사본·임시 자격증명 스크립트(`dryrun*.sh`, `manual-dump-test*`)는 진단 완료 후 즉시 삭제했다 — 영구 사본은 `~/alton-db-backups/` 한 곳뿐이다.

### 진단: `supabase db dump --linked`가 무한 대기한 원인

사용자 지시로 중단 후 아래를 확인했다.

1. **인증 입력 대기 여부**: 아니다. `--dry-run`으로 확인한 결과 CLI가 Management API(`POST /v1/projects/{ref}/cli/login-role`)로 임시 role/비밀번호를 자동 발급해 비대화형으로 주입한다. 사람 입력을 기다리는 지점이 아니다.
2. **Docker/Supabase CLI 상태**: Docker Desktop 프로세스(`com.docker.backend` 등)는 떠 있었지만 `docker ps`/`docker version`이 15초 내 응답하지 않아 데몬 소켓이 사실상 무응답 상태였다. 다만 이는 근본 원인이 아니었다(로컬 `pg_dump`를 설치해 Docker 의존을 제거한 뒤에도 CLI 경로는 동일하게 무한 대기했다).
3. **원격 DB 직접 연결 가능 여부**: 정상. `db.worpsqwqgnspddnrtnvq.supabase.co:5432`, session pooler(`:5432`), transaction pooler(`:6543`) 전부 TCP 연결 성공. `psql`로 단순 쿼리(`select version(), now()`)도 즉시 응답.
4. **`--debug` 재실행 시 마지막 정지 단계**: `Initialising login role...`(Management API POST 성공) 직후 `Dumping schemas from remote database...`에서 정지 — 즉 CLI 내부의 pg_dump 서브프로세스 호출 지점.
5. **근본 원인**: CLI가 발급하는 임시 role `cli_login_postgres`는 `postgres` role의 멤버이지만 **`NOINHERIT`** 속성이라 권한이 자동 상속되지 않는다(`postgres` role 자체는 `public.profiles` 등 모든 테이블에 정상 접근 가능함을 `SET ROLE postgres` 후 확인). 이 상태로 pg_dump가 스키마 잠금(`LOCK TABLE ... IN ACCESS SHARE MODE`)을 시도하면 `permission denied for table profiles` 오류가 난다. CLI 자체 경로에서는 이 오류가 파이프라인(`pg_dump | sed | sed | ...`) 어딘가에서 표면화되지 못하고 조용히 멈춘 것으로 보인다(재현: 동일 플래그로 pg_dump만 단독 실행하면 즉시 이 오류 메시지가 출력됨).
6. **우회 방법**: `PGOPTIONS="-c role=postgres"` 환경변수로 연결 시점에 자동으로 `SET ROLE postgres`가 적용되게 하면 pg_dump가 정상 완료된다(스키마 전용, 전체 스키마+데이터 둘 다 검증 완료). Session pooler로 바꿔도 이 근본 원인(role 권한 상속)은 달라지지 않으므로 pooler 전환 자체는 해결책이 아니었다 — 실제 해결은 `PGOPTIONS` role 전환이었다.
7. 로컬 PostgreSQL 클라이언트 도구(`brew install postgresql@17`, pg_dump 17.11)를 설치해 Docker 의존 없이 직접 재현·검증했다. Docker 문제는 그 자체로는 원인이 아니었지만, 로컬 pg_dump가 없었다면 CLI가 Docker로 폴백을 시도했을 가능성이 있어 사전 설치가 안전 마진이 된다.

## 3단계 — 프로젝트 link 및 원격 스키마 확인 (완료, 2026-08-30)

- `supabase/.temp/project-ref` → `worpsqwqgnspddnrtnvq`, `supabase projects list` 결과 "officialalton's Project"(status `ACTIVE_HEALTHY`, Postgres 17.6)와 일치 — 이 저장소는 올바른 원격 프로젝트에 linked 상태.
- 원격 스키마는 2단계 백업 파일 자체가 현재 원격 스키마의 정확한 스냅샷이다(46개 테이블, CREATE TABLE/제약/enum 전부 포함).

## 4단계 — Gate B v5 기반 신규 migration SQL 작성 (1차 완료 2026-08-30 → **사용자 피드백으로 2026-08-30 전면 수정**)

Gate B v5 §3.1~3.9, §3.11(시급 이력)의 핵심 데이터 구조만 이번 R1 범위로 작성했다.
Gate B가 함께 설계했던 `price_versions`/`purchases`/`payment_attempts`/`refund_requests`,
`external_event_receipts`, `drive_artifacts`, `subject_threads` 계열, `session_reviews`
확장은 master-roadmap-v3.md의 R4/R8/R9/R11 범위이므로 이번 R1 마이그레이션에는
포함하지 않았다(과도한 범위 확장 방지).

**1차 초안은 기존 `contracts`/`sessions`를 `legacy_*`로 rename하고 새 스키마가 원래
이름을 그대로 쓰는 방식이었다. 사용자가 검토 후 이 방식을 반려했다** — 현재 앱 화면·서버
액션·Calendly/DocuSign 웹훅이 여전히 기존 `sessions`/`contracts` 구조에 의존하므로,
스키마만 바꿔 적용하면 앱이 깨질 수 있다는 지적이었다. 이후 **shadow 이름 방식
(`contracts_v3`, `sessions_v3`)으로 전면 재작성**했고, 실제 cutover(이름 교체)는 앱
코드 자체가 신규 스키마로 전환되는 별도 마이그레이션에서 진행하기로 확정했다. 이에 따라
1차 초안에 있던 rename 전용 파일(`20260830005000_r1_rename_legacy_tables.sql`)은
삭제했다 — 이번 R1 배치에는 RENAME이 전혀 없다.

### 최종 마이그레이션 파일 (9개, `supabase/migrations/202608300*.sql`)

| 파일 | 내용 |
|---|---|
| `20260830000000_r1_enums_and_capabilities.sql` | 신규 enum 전부(`v3_` 접두어로 기존 enum과 충돌 방지) + `supervisor_capabilities` + `has_capability()` |
| `20260830010000_r1_household_contract.sql` | `households`, `household_members`, `contracts_v3`(shadow), `contract_versions`, `is_household_guardian_of()` |
| `20260830020000_r1_enrollment_assignment.sql` | `subject_enrollments`, `teacher_assignments`(+ 기간 겹침 exclusion constraint) |
| `20260830030000_r1_lesson_and_rate_master_data.sql` | `lesson_types`, `entitlement_types`, `entitlement_products`, `teacher_rate_history` |
| `20260830040000_r1_reservation_session.sql` | `reservations`, `sessions_v3`(shadow), `session_status_events`, `reopen_session()`/`recomplete_session()` |
| `20260830050000_r1_entitlement.sql` | `entitlement_grants`, `entitlement_ledger`, `hold_entitlement()`/`consume_entitlement()`/`release_entitlement()` |
| `20260830060000_r1_makeup_time.sql` | `makeup_obligations`, `makeup_events`, `apply_makeup_time()` |
| `20260830070000_r1_payout.sql` | `payout_batches`, `payout_items` |
| `20260830080000_r1_rls_policies.sql` | 위 전체 20개 테이블 RLS 활성화 + 정책, `is_household_member()`, `is_assigned_teacher_of_enrollment()`, `is_enrollment_child_or_guardian()` |

기존 `contracts`/`sessions`를 포함해 어떤 기존 테이블도 rename하거나 손대지 않는다.
`enrollments`, `students.credit_balance`, `makeup_credits`, `teacher_payouts`,
`credit_purchases`, `credit_transactions`, `chat_threads` 등도 전부 그대로다. 이번 9개
파일 전체에 DELETE/DROP/RENAME 문이 단 한 건도 없다 — 전부 신규 객체 추가(`CREATE`)뿐.

## 5단계 — 1차 검토·테스트, 그리고 사용자의 7개 항목 반려 (2026-08-30)

### 1차 정적 검토 + 로컬 실행에서 발견·수정한 버그 3건

1. **`reopen_session()` 자기 트리거 차단**: `sessions_v3.final_status`를 completed 이후 직접 UPDATE하지 못하게 막는 트리거(`prevent_direct_final_status_update`)가 `reopen_session()` 함수 자신의 내부 UPDATE도 막아버리는 구조였다. `set_config('app.bypass_session_lock', 'true', true)`로 트랜잭션 범위 우회 플래그를 추가해 수정.
2. **`release_entitlement()`/`consume_entitlement()` 상호배타 누락(1차 수정, 불완전)**: 이미 `consume`된 예약을 `release`하거나 그 반대를 시도하면 이중 계상이 가능했다. 두 함수 모두 상대 이벤트가 이미 존재하면 예외를 던지도록 가드를 추가했으나, 이 시점의 가드는 **락 획득 전**에 검사하는 구조라 진짜 동시 요청 앞에서는 무력했다(§6단계에서 사용자가 지적, 최종 수정은 §6단계 참고).
3. **함수 본문 stale 테이블명**: 최초에는 rename 순서 문제로 `sessions_v3`를 참조하던 함수가 rename 후 `relation "sessions_v3" does not exist" 오류를 냈다. shadow 이름 방식으로 전환하면서(RENAME 자체가 없어짐) 이 버그 클래스는 구조적으로 해소됐다.

### 로컬 DB 백업 복원 테스트 (2026-08-30, 이후 라운드마다 재실행)

Docker 없이 로컬 `postgresql@17`(brew) 클러스터에 원본 백업(`~/alton-db-backups/pre-r1-full-2026-08-30.sql`, 원본은 **전혀 수정하지 않음**)의 **복원 전용 필터링 사본**(`restore-test-copy.sql`, 스크래치패드에만 보관)을 만들어 반복 복원했다. 실제 원격 DB에는 이 필터링이 적용되지 않는다 — 아래는 로컬 재현에만 필요했던 차이다.

- 로컬에는 없는 Supabase 플랫폼 전용 객체(확장 `supabase_vault`, `vault.*` 함수/테이블, `extensions.*` 이벤트 트리거 6종, role `postgres`/`supabase_admin`/`dashboard_user`/`anon`/`authenticated`/`service_role`, 스키마 `auth`/`extensions`/`vault`)는 실제 Supabase 플랫폼에 이미 존재하므로 로컬 테스트에서만 스텁으로 만들거나 제외했다.
- `profiles.id`가 참조하는 `auth.users`도 로컬에는 실사용자가 없으므로, 백업의 `profiles` 데이터에 있는 5개 id로 `auth.users`에 최소 스텁 행만 채웠다(실제 원격 DB는 이미 진짜 `auth.users`가 있어 이 단계 자체가 불필요).
- 매 라운드 복원 결과 데이터 건수가 원본과 정확히 일치함을 재확인(`profiles` 5, `enrollments` 1, `students` 1, `teachers` 2, `credit_transactions` 1, `sessions` 0) — **백업 파일이 실제로 복원 가능한 유효한 형식임을 반복 확인했다.**

### 사용자의 7개 항목 반려 (2026-08-30)

1차 결과를 보고했으나, 사용자가 원격 push를 보류하고 아래 7개 항목의 수정·검증을 요구했다: (1) 앱 호환성(shadow 이름 방식으로 전환), (2) `cause_reservation_id`(재예약) 개념 완전 삭제, (3) RLS 실제 사용자 검증(household_members 재귀 수정 + 6개 역할 실측 테스트), (4) entitlement 동시성 수정(락 순서 재구성 + 동시 실행 테스트), (5) 보충시간 입력값 검증, (6) 세션 재개방 이력 버그 + `recomplete_session()` 상태 제한, (7) SECURITY DEFINER 권한 전수 감사. **7개 항목을 확인하기 전까지 원격 push를 보류**하라는 명시적 지시에 따라 원격 적용 없이 아래 6~7단계를 진행했다.

## 6단계 — 7개 항목 수정 + 실제 실행 기반 검증 (완료, 2026-08-30)

### (1) 앱 호환성 — shadow 이름 방식

`contracts_v3`, `sessions_v3`로 전환(§4단계 참고). 기존 `contracts`/`sessions` 테이블은 이번 마이그레이션에서 전혀 참조·변경되지 않으므로, 현재 배포된 앱 화면·서버 액션·Calendly/DocuSign 웹훅은 이 마이그레이션 적용 이후에도 기존 경로 그대로 동작한다. 실제 cutover(앱 코드가 `_v3` 스키마로 전환되면서 기존 테이블을 `legacy_*`로, `_v3` 테이블을 최종 이름으로 원자적으로 rename)는 앱 코드 변경과 함께 진행되는 별도 마이그레이션에서 수행한다 — 이번 R1 배치의 범위가 아니다.

### (2) `cause_reservation_id`(재예약) 삭제

`reservations` 테이블에 해당 컬럼을 아예 만들지 않았다(`20260830040000_r1_reservation_session.sql` 헤더 주석에 사유 기록: 재예약은 별도 제품 기능으로 만들지 않기로 확정, 학생은 취소 후 일반 예약을 새로 생성). 스키마 dump로 컬럼 부재를 재확인했다.

### (3) RLS 실제 사용자 검증 — 진행 중 **추가로 발견한 버그 2건**(1차 정적 검토·수퍼유저 테스트로는 드러나지 않았음)

`household_members` 자기 참조 재귀는 `is_household_member()` SECURITY DEFINER 헬퍼로 1차 수정했다. 이어서 실제 `authenticated`/`anon` 역할 + `request.jwt.claim.sub` 시뮬레이션으로 6개 역할(학생/보호자/담당 선생님/비담당 선생님/관리자/익명) 테스트를 실행하는 과정에서, **postgres superuser로는 RLS 자체가 적용되지 않아 절대 드러나지 않는 버그 2건**을 새로 발견·수정했다.

- **`contracts_v3` 조회 정책의 보안 버그**: `exists (select 1 from household_members hm where hm.household_id = household_id and ...)` — 여기서 두 번째 `household_id`가 테이블명으로 한정되지 않아 Postgres가 서브쿼리 별칭 `hm`의 동명 컬럼으로 먼저 해석했다(`hm.household_id = hm.household_id`, 항상 참). 실제로는 **다른 household의 계약도 조회 가능한 보안 결함**이었다. `contracts_v3.household_id`로 명시 한정해 수정.
- **`subject_enrollments` 조회 정책의 기능 버그**: `exists (select 1 from teacher_assignments ta where ta.subject_enrollment_id = id and ...)` — 여기서 `id`가 `ta.id`(teacher_assignments 자신의 PK)로 잘못 해석돼(`ta.subject_enrollment_id = ta.id`, 서로 다른 uuid라 사실상 항상 거짓), **담당 선생님이 자신의 배정 건을 조회하는 분기가 항상 실패**했다. `subject_enrollments.id`로 명시 한정해 수정.
- **`subject_enrollments` ↔ `teacher_assignments` 상호 RLS 재귀**: 위 두 버그를 고치는 과정에서 실제 `authenticated` 역할로 조회를 실행하자 두 테이블 모두 `ERROR: infinite recursion detected in policy`로 실패했다(관리자 역할 포함 전원 실패) — 한쪽 정책이 다른 쪽 테이블을 직접 EXISTS로 참조하고, 그 반대쪽도 마찬가지라 순환이 생겼다. `is_assigned_teacher_of_enrollment()`, `is_enrollment_child_or_guardian()` 두 SECURITY DEFINER 헬퍼를 추가해(테이블 owner 권한으로 조회, RLS 재적용 없음) 순환을 끊었다.
- **anon 역할의 하드 오류 발견**: anon으로 `households` 등을 조회하면 `is_household_member()` 등 신규 헬퍼 함수가 anon에서 revoke돼 있어 `permission denied for function`으로 실패했다(빈 결과가 아니라 오류). 이 4개 헬퍼(`is_household_member`, `is_household_guardian_of`, `is_assigned_teacher_of_enrollment`, `is_enrollment_child_or_guardian`)는 전부 `auth.uid()`로만 필터링돼 인자와 무관하게 anon에서는 항상 false이므로(기존 `is_admin()`/`is_guardian_of()`와 동일한 안전 패턴), anon에도 grant해 빈 결과로 정상 동작하도록 수정. 단 `has_capability(p_profile_id, ...)`는 호출자의 `auth.uid()`가 아니라 인자로 받은 임의의 `p_profile_id`를 그대로 조회하므로 이 패턴에 해당하지 않아 **anon에는 열지 않기로 유지**했다 — 그 결과 `has_capability()`를 쓰기 정책에 포함하는 테이블(payout_batches/payout_items/teacher_rate_history 및 조회에도 해당 정책이 겹쳐 적용되는 테이블 대부분)은 anon 조회 시 여전히 "permission denied for function has_capability" 오류를 낸다. **ALTON 앱 설계상 anon 컨텍스트가 이 신규 테이블들을 직접 조회할 경로가 없으므로**(전부 로그인 포털 또는 service_role 서버 액션 경유) 운영상 영향은 없다고 판단했으나, 향후 anon이 빈 배열을 받아야 하는 요구가 생기면 재검토가 필요하다는 점을 여기 기록해둔다.

**6개 역할 실측 결과** (household 1개, child/guardian/담당 선생님/비담당 선생님 fixture로 검증, `alton_r1_test`에서 authenticated/anon 역할 전환 + `request.jwt.claim.sub` 설정으로 실행):

| 역할 | households | household_members | contracts_v3 | subject_enrollments | teacher_assignments |
|---|---|---|---|---|---|
| 학생(child) | 1 | 2 | 1 | 1 | 1 |
| 보호자(guardian) | 1 | 2 | 1 | 1 | 1 |
| 담당 선생님 | 0 | 0 | 0 | 1 | 1 |
| 비담당 선생님 | 0 | 0 | 0 | 0 | 0 |
| 관리자 | 1 | 2 | 1 | 1 | 1 |
| 익명(anon) | 위 anon 오류 사례 참고(`has_capability` 경로가 있는 테이블은 하드 오류, 없는 테이블은 정상 0행) | | | | |

전부 기대대로다: 담당 선생님은 가족 데이터(households/household_members/contracts_v3)에는 접근 못 하지만 자신이 배정된 subject_enrollment/teacher_assignment는 볼 수 있고(버그 수정으로 새로 가능해짐), 비담당 선생님은 전부 0.

### (4) entitlement 동시성 수정 — 실제 동시 트랜잭션으로 검증

1차 가드는 락 획득 **전**에 상대 이벤트 존재 여부를 검사해, 두 요청이 동시에 들어오면 둘 다 "아직 없음"으로 통과한 뒤 각자 insert에 성공할 수 있는 구조였다(진짜 경쟁 상태). `consume_entitlement()`/`release_entitlement()` 모두 `entitlement_grants` 행을 **먼저 `for update`로 잠그고, 잠금 획득 후에** 같은/반대 이벤트 존재 여부를 재검사하도록 재구성했다. `hold_entitlement()`에는 `p_needed > 0` 검증을 추가했다.

**실제 동시 트랜잭션 테스트 결과** (별도 백그라운드 psql 세션 2개, 한쪽이 먼저 락을 잡고 `pg_sleep`으로 대기시켜 다른 쪽이 실제로 락을 기다리게 만든 뒤 순서를 관찰):

- **consume vs release 동시 실행**(사용자가 지적한 정확한 시나리오): 세션 A가 `entitlement_grants` 행을 먼저 잠그고 3초 대기 후 `consume_entitlement()` 커밋. 세션 A가 락을 잡은 1초 뒤 세션 B가 같은 예약에 `release_entitlement()` 호출 → B는 A가 커밋할 때까지 락 대기 → A 커밋 후 B가 락을 넘겨받아 재검사 → **"이미 consume된 예약은 release할 수 없습니다" 오류로 정확히 차단**. 최종 `entitlement_ledger`에는 `hold`/`consume` 2건만 존재, `release`는 기록되지 않음(수정 전이었다면 둘 다 기록될 수 있었던 바로 그 상황).
- **consume vs consume 동시 실행**: 동일한 방식으로 재현, 두 번째 호출이 락 대기 후 **"이미 consume되었습니다" 오류로 정확히 차단**, 최종 `entitlement_ledger`에 `consume` 1건만 존재.
- `hold_entitlement(p_needed=0)`, `hold_entitlement(p_needed=-5)` 모두 "p_needed는 0보다 커야 합니다" 오류로 정확히 차단.

### (5) 보충시간 입력값 검증

`apply_makeup_time()`에 `p_minutes > 0` 함수 레벨 검증을, `makeup_events` 테이블에 `applied_minutes < 0`(event_type='applied'일 때) CHECK 제약을 추가했다. 실제 테스트: `apply_makeup_time(..., -10)`/`apply_makeup_time(..., 0)` 모두 "p_minutes는 0보다 커야 합니다" 오류로 차단, 함수를 우회해 `makeup_events`에 직접 양수 `applied_minutes`로 INSERT 시도해도 CHECK 제약이 별도로 차단함을 확인(방어 2중화 확인). 정상 경로(30분 의무 → 20분 적용)는 잔여 10분으로 정확히 계산됨.

### (6) 세션 재개방 이력 버그 + `recomplete_session()` 상태 제한

`reopen_session()`이 `new_final_status`에 이전 상태(old status)를 잘못 기록하던 버그를 `'live'`로 고정 기록하도록 수정. `recomplete_session()`에는 목표 상태가 `scheduled`/`live`이면 거부하는 검증을 추가. 실제 테스트: `completed` 세션에 `reopen_session()` 호출 → `session_status_events`에 `event_type='reopened', previous_final_status='completed', new_final_status='live'` 정확히 기록, `sessions_v3.final_status`도 `live`로 전환 확인. 이어서 `recomplete_session(..., 'live', ...)`/`recomplete_session(..., 'scheduled', ...)` 모두 정확히 거부, `recomplete_session(..., 'completed', ...)`는 정상 승인됨을 확인.

### (7) SECURITY DEFINER 권한 전수 감사

신규 함수(`hold_entitlement`/`consume_entitlement`/`release_entitlement`/`apply_makeup_time`/`reopen_session`/`recomplete_session`/`has_capability`/`is_household_member`/`is_household_guardian_of`/`is_assigned_teacher_of_enrollment`/`is_enrollment_child_or_guardian`)와 트리거 전용 함수(`prevent_direct_final_status_update`/`reject_ledger_mutation`/`reject_makeup_event_mutation`/`check_payout_batch_currency`/`prevent_paid_item_mutation`) 전부의 `anon`/`public`/`authenticated`/`service_role` 실행 권한을 `has_function_privilege()`로 실측 확인했다. 결과:

- 트리거 전용 함수 5개: `anon`/`public`/`authenticated`/`service_role` 전부 실행 불가(의도대로 트리거만 호출 가능).
- `hold_entitlement`/`consume_entitlement`/`release_entitlement`/`apply_makeup_time`: `anon`/`public`/`authenticated` 불가, `service_role`만 가능(서버 액션이 service_role 클라이언트로 호출하는 설계와 일치).
- `reopen_session`/`recomplete_session`: `anon`/`public`/`service_role` 불가, `authenticated`만 가능(내부에서 `is_admin()`으로 실제 사용자 JWT를 검사하는 설계와 일치 — service_role로 호출하면 `auth.uid()`가 없어 내부 검사에서 어차피 거부됨).
- `has_capability(uuid, text)`: `anon`/`public` 불가, `authenticated`/`service_role` 가능(§6-3에서 설명한 대로 인자로 받은 임의 profile_id를 그대로 조회하는 함수라 anon에는 의도적으로 열지 않음). **RLS 정책에서는 더 이상 이 함수를 쓰지 않는다 — §9 참고.**
- `current_user_has_capability(text)`(§9에서 신설): `public` 불가, `anon`/`authenticated`/`service_role` 가능. `auth.uid()`로만 필터링해 인자와 무관하게 anon은 항상 false.
- `is_household_member`/`is_household_guardian_of`/`is_assigned_teacher_of_enrollment`/`is_enrollment_child_or_guardian`: `public` 불가, `anon`/`authenticated`/`service_role` 가능(§6-3 anon 수정 반영).

**추가로 발견했으나 이번 라운드에서 수정하지 않은 항목**: 레거시(R0) SECURITY DEFINER 함수 9개(`is_admin`, `is_guardian_of`, `teaches_student`, `session_student_id`, `session_teacher_id`, `is_session_participant`, `is_session_related`, `is_enrollment_participant`, `is_enrollment_related`, `rls_auto_enable`)는 전부 `anon`/`public` 실행 가능 상태다. 전부 `auth.uid()`로만 필터링되는 구조라 구조적으로 안전하지만(인자와 무관하게 anon은 항상 false), "SECURITY DEFINER 함수는 anon/public에서 revoke"라는 §7 원칙을 엄격히 적용하면 이들도 대상이다. 다만 (a) 이미 배포된 R0 마이그레이션 파일을 수정하는 것은 이번 R1 배치의 범위를 벗어나고, (b) revoke 시 이 함수들을 참조하는 R0 RLS 정책에서 anon 조회가 하드 오류로 바뀌는 부작용이 있어(§6-3과 동일한 문제), 이번 라운드에서는 손대지 않고 여기 기록만 남긴다 — 필요하면 별도 마이그레이션으로 검토.

## 7단계 — 전체 재검증 (완료, 2026-08-30, 위 7개 항목 반영 후)

**빈 DB(`alton_r1_empty`) 전체 체인**과 **백업 복원 DB(`alton_r1_test`) + R1 9개 파일** 양쪽 모두, 최종 수정본으로 처음부터 다시 적용해 검증했다.

| 항목 | 결과 |
|---|---|
| 마이그레이션 적용 | 양쪽 DB 모두 9개 R1 파일(빈 DB는 기존 20개 포함 총 29개) 전부 오류 없이 성공 |
| 데이터 무결성 | 복원 DB의 기존 데이터 건수 재확인: `profiles` 5, `enrollments` 1, `sessions` 0, `students` 1, `teachers` 2, `credit_transactions` 1 — 마이그레이션 전후 완전히 동일 |
| 기존 테이블 보존 | `contracts`/`sessions` 테이블이 여전히 원래 이름·구조로 존재(변경 없음), 신규 `_v3` 테이블은 전부 빈 상태로 생성됨 |
| 테이블 | 신규 20개(`households`, `household_members`, `contracts_v3`, `contract_versions`, `subject_enrollments`, `teacher_assignments`, `reservations`, `sessions_v3`, `session_status_events`, `lesson_types`, `entitlement_types`, `entitlement_products`, `teacher_rate_history`, `entitlement_grants`, `entitlement_ledger`, `makeup_obligations`, `makeup_events`, `payout_batches`, `payout_items`, `supervisor_capabilities`) 전부 존재 |
| Exclusion constraint | `teacher_assignments_no_overlap` 확인(정의된 `WHERE` 절·컬럼 정확히 일치) |
| RLS | 신규 20개 테이블 전부 `relrowsecurity = true` |
| 함수 | `is_household_member`, `is_household_guardian_of`, `has_capability`, `hold_entitlement`, `consume_entitlement`, `release_entitlement`, `apply_makeup_time`, `reopen_session`, `recomplete_session` 9개 전부 존재 확인 |
| RLS 역할 테스트 | §6-3 표 전체 재현(6개 역할) |
| 동시성 테스트 | §6-4 두 시나리오(consume/release, consume/consume) 재현 |

## 8단계 — 롤백 절차, 원격 DB 적용 시 변경 요약, 승인 대기 (2026-08-30 갱신 — 7개 항목 반영 후 최신본)

### 원격 개발 DB에 실제로 적용될 변경 요약

**신규 생성만(기존 객체는 단 하나도 변경하지 않음)**
- enum 약 20종(`v3_` 접두어)
- 테이블 20개: `households`, `household_members`, `contracts_v3`, `contract_versions`, `subject_enrollments`, `teacher_assignments`, `reservations`, `sessions_v3`, `session_status_events`, `lesson_types`, `entitlement_types`, `entitlement_products`, `teacher_rate_history`, `entitlement_grants`, `entitlement_ledger`, `makeup_obligations`, `makeup_events`, `payout_batches`, `payout_items`, `supervisor_capabilities`
- 뷰 2개: `entitlement_balances`, `makeup_balances`
- 함수 약 20개(신규 헬퍼 포함), 트리거 5개, RLS 정책 각 테이블당 1~2개
- `extensions.btree_gist` 확장 활성화(exclusion constraint에 필요)
- `lesson_types`/`entitlement_types`/`entitlement_products`에 시드 데이터 각 1~2행(정규/체험 수업 유형, 20회권 상품 정의 — 실사용자 데이터 아님)

**RENAME 없음 — `contracts`/`sessions`를 포함해 기존 테이블·컬럼·데이터·RLS 정책·함수·트리거는 전혀 변경하지 않는다.** shadow 이름(`contracts_v3`, `sessions_v3`)이므로 이번 배치가 현재 배포된 앱 코드·Calendly/DocuSign 웹훅에 영향을 줄 수 없다. 실제 cutover(이름 교체)는 앱 코드가 함께 바뀌는 별도 마이그레이션에서 진행한다.

**DELETE/DROP 없음** — 9개 파일 전체에 단 한 건도 없음.

### 롤백 절차(실패 시)

1. **DB 롤백**: 이번 배치는 전부 `CREATE`뿐이라, 실패한 파일까지만 적용된 상태라도 그 이후 파일만 건너뛰면 되고, 완전 롤백은 실패한 파일이 만든 객체만 개별 `DROP`하면 충분하다(기존 테이블을 전혀 건드리지 않으므로 전체 백업 복원까지는 보통 필요 없음). 그래도 안전하게 전체 복구가 필요하면 `~/alton-db-backups/pre-r1-full-2026-08-30.sql`을 원격 개발 DB에 복원(Supabase 대시보드 point-in-time recovery 병행 가능, Gate B §6.4).
2. **앱 롤백**: 앱 코드는 이번 배치와 무관하게 동작하므로(shadow 이름이라 앱이 새 테이블을 참조하지 않음) 별도 앱 롤백이 필요 없다. 커밋 `e27bc8e4e0c25442759d1b03690b930051d2bf45` 기준 앱 코드는 이번 마이그레이션 이전과 이후 모두 동일하게 동작한다.
3. `git reset --hard`나 운영 데이터 파괴 명령은 사용하지 않는다(Gate B §6.4 원칙 유지).

## 9단계 — 사용자 최종 검토 2건 반영 (완료, 2026-08-30)

7개 항목 반영 결과를 보고하자, 사용자가 원격 push 승인 전 마지막으로 2가지를 요구했다: (1) anon의 `has_capability` permission-denied를 "현재 경로 없음"으로 남기지 말고 근본적으로 정리, (2) 이번 라운드의 교훈을 실행 로그에만 남기지 말고 이후 모든 단계의 공통 Definition of Done으로 로드맵·개발자 전달서에 반영. 둘 다 완료했다.

### (1) `current_user_has_capability(text)` 신설 — anon 하드 오류 근본 해결

`has_capability(p_profile_id uuid, p_capability text)`는 호출자의 `auth.uid()`가 아니라 인자로 받은 임의의 `p_profile_id`를 그대로 조회하므로, anon에 열면 "다른 프로필이 어떤 capability를 가졌는지" 그대로 노출되는 문제가 있어(§6-7) anon에는 계속 닫아둔다. 대신 `20260830000000_r1_enums_and_capabilities.sql`에 새 헬퍼를 추가했다.

```sql
create or replace function public.current_user_has_capability(p_capability text)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    else exists (
      select 1 from supervisor_capabilities
      where profile_id = auth.uid() and capability = p_capability
    )
  end;
$$;
revoke execute on function public.current_user_has_capability(text) from public;
grant execute on function public.current_user_has_capability(text) to anon, authenticated;
```

`20260830080000_r1_rls_policies.sql`의 `has_capability(auth.uid(), '...')` 호출 35건 전부를 `current_user_has_capability('...')`로 교체했다(perl 정규식 일괄 치환, 치환 후 잔여 `has_capability(auth.uid()` 패턴 0건 확인).

**재검증 결과** (빈 DB·복원 DB 양쪽 처음부터 재적용, 오류 0건):

- anon 역할로 이전에 `permission denied for function has_capability` 오류가 나던 12개 테이블(`households`, `household_members`, `contracts_v3`, `subject_enrollments`, `teacher_assignments`, `reservations`, `sessions_v3`, `entitlement_grants`, `makeup_obligations`, `payout_batches`, `teacher_rate_history`, `supervisor_capabilities`) 전부 **오류 없이 0행**을 정상 반환.
- authenticated 역할 + 실제 `supervisor_capabilities` grant(관리자 profile에 `학생관리` capability 부여) 상태에서 `current_user_has_capability('학생관리')` → `true`, 그 결과로 `households` 조회도 정상 반영(1행) — capability 기반 쓰기 정책이 여전히 올바르게 동작함을 확인.
- §6-3의 6개 역할 매트릭스(학생/보호자/담당 선생님/비담당 선생님/관리자)를 재실행해 이전과 완전히 동일한 결과(학생 1/1/1/1, 보호자 동일, 담당 선생님 0/0/1/1, 비담당 선생님 0/0/0/0, 관리자 1/1/1/1)를 재확인 — 이번 변경이 기존 역할별 접근 결과에 아무 부작용을 내지 않았다.
- `has_capability(uuid, text)` 자체는 여전히 anon에서 호출 불가 확인(`permission denied for function has_capability`) — 다른 사용자의 profile_id를 임의로 조회하는 경로는 계속 막혀 있다.

이로써 §6-7에서 "확인 필요"로 남겨뒀던 anon 관련 항목 중 `has_capability` 경로는 완전히 해소됐다. 레거시 R0 SECURITY DEFINER 함수 9개(`is_admin` 등)가 anon 실행 가능 상태로 유지되는 부분은 이번 R1 배치 범위 밖(§6-7 참고)으로 그대로 남아 있다.

### (2) 공통 Definition of Done을 로드맵·개발자 전달서에 반영

이번 실행 로그(§5~9)에서 반복적으로 드러난 패턴 — SQL 정적 검토·postgres superuser 테스트만으로는 RLS 자기참조 재귀, 컬럼 한정 누락으로 인한 권한 우회, 테이블 간 RLS 상호 재귀, 락 순서 오류로 인한 동시성 결함을 전혀 잡아내지 못했다는 것 — 을 R1에 국한된 교훈으로 남기지 않고 아래 두 문서에 상시 기준으로 추가했다.

- `docs/2026-08-29-master-roadmap-v3.md` §"1-1. 모든 단계 공통 Definition of Done"(신설, §1과 §2 사이): DB 변경 전 기존 사용처 전수 조사, shadow/cutover 전략 명시, SQL 적용 성공만으로 완료 판정 금지, 역할별 RLS·동시성·주요 화면 smoke test·웹훅·타입 검사/빌드 검증, 원격 적용 대상·영향 범위 사전 보고, 실제 실행 가능한 롤백 절차 검증, 미구현 검증 항목의 후속 단계 명시적 인수 기준 이관 — 7개 항목 전부 반영.
- `docs/2026-08-29-developer-handoff-v3.md` §"5.1 DB·스키마 변경이 포함된 작업의 추가 완료 기준"(신설, 기존 §5 "구현 완료의 정의" 안에 하위 절로 추가): 동일한 7개 항목을 개발자 관점 체크리스트로 반영, 기존 "DB 제약과 트랜잭션"/"서버 권한과 RLS"/"마이그레이션과 롤백" 3개 항목이 DB 변경 작업에서 구체적으로 의미하는 바를 명시.

## 10단계 — 원격 push 승인 전 마지막 3가지 반영 (완료, 2026-08-30)

§9 보고 후 사용자가 원격 push 승인 전 마지막으로 3가지를 요구했다: (1) `has_capability(uuid, text)`의 `authenticated` 전체 grant를 제거하고 `service_role` 전용으로 정리, (2) §7 표의 테이블 수 표기 오류(신규 15개 → 실제 20개) 정정, (3) 레거시 R0 SECURITY DEFINER anon 노출 항목을 push blocker가 아니라 별도 보안 감사 항목으로 등록. 추가로 Gate B §9-1의 `teacher_rate_history` 최초 데이터 생성을 이번 적용 범위에 포함하되, 적용 전 생성 대상·금액·통화 보고와 재실행 시 중복 방지 처리를 요구했다.

### (1) `has_capability(uuid, text)` 권한 정리 — `authenticated` 제거, `service_role` 전용

`current_user_has_capability()`로 RLS 35건 전부 전환된 뒤에도 `has_capability(uuid, text)`가 `authenticated` 전체에 grant돼 있어, 일반 로그인 사용자가 `has_capability('<타인 uuid>', '결제권한')`처럼 직접 RPC 호출해 타인의 capability 보유 여부를 알아낼 수 있는 구멍이 남아 있었다. `20260830000000_r1_enums_and_capabilities.sql`에서 `revoke ... from public, anon, authenticated; grant ... to service_role;`로 정정했다.

**재검증 결과** (빈 DB·복원 DB 양쪽 처음부터 재적용, 오류 0건):

- authenticated(학생 JWT)로 `has_capability('<관리자 uuid>', '학생관리')` 직접 호출 → `permission denied for function has_capability`
- authenticated(선생님 JWT)로 동일 호출 → `permission denied for function has_capability`
- anon → 기존과 동일하게 `permission denied for function has_capability`(변경 없음)
- service_role → 정상 실행(값 자체는 fixture 데이터 유무에 따라 `true`/`false`, 오류 없음이 핵심)
- `current_user_has_capability()`의 anon/authenticated 동작은 요청대로 변경 없음: anon은 계속 `false`(오류 아님), authenticated는 실제 capability 보유 여부에 따라 정상 반환

### (2) 테이블 수 표기 정정

§7 표와 §8 변경 요약에서 "신규 15개"로 잘못 쓰여 있던 부분을 실제 나열된 20개 테이블 수에 맞춰 "신규 20개"로 정정했다(`teacher_rate_history` 등 15개 항목 뒤에 "+"로 이어붙인 5개를 합산 없이 앞쪽 숫자만 표기했던 실수).

### (3) 레거시 R0 SECURITY DEFINER anon 노출 — 별도 보안 감사 항목으로 등록

`docs/2026-08-29-master-roadmap-v3.md` R12(보안·감사·관찰·복구) 체크리스트에 항목을 추가했다: 레거시 함수 9개(`is_admin`, `is_guardian_of`, `teaches_student`, `session_student_id`, `session_teacher_id`, `is_session_participant`, `is_session_related`, `is_enrollment_participant`, `is_enrollment_related`)의 anon/public 실행 권한을 R12에서 전수 재검토하도록 명시했다. R1이 만든 회귀가 아니라는 점과, revoke 시 안전한 대체 헬퍼(`current_user_has_capability()`와 같은 패턴)가 함께 필요하다는 점을 항목에 남겼다. **R1 push의 blocker가 아니다.**

### (4) `teacher_rate_history` 최초 데이터 생성 (Gate B §9-1) — 신규 파일 `20260830090000_r1_teacher_rate_history_seed.sql`

```sql
insert into teacher_rate_history (teacher_id, amount_minor, currency, effective_from)
select t.id, t.hourly_rate_krw, 'KRW', now()
from teachers t
where t.hourly_rate_krw is not null and t.hourly_rate_krw > 0
on conflict (teacher_id) where effective_until is null do nothing;
```

**적용 전 보고(사용자 요청) — 생성 대상은 2건이 아니라 1건이다**: 백업 스냅샷(`~/alton-db-backups/pre-r1-full-2026-08-30.sql`) 기준 `teachers` 2행을 확인한 결과,

| teacher_id | 상태 | hourly_rate_krw | 이번 seed 대상 여부 |
|---|---|---|---|
| `29430e24-173c-4a4a-a9d0-0c2e1042a5cd`(장세준) | active | 50000 | **대상 — `50000 KRW`로 1행 생성** |
| `d8fe6918-e886-49d3-9b59-b9fe639fcbf2`(김도경) | pending | `NULL`(미설정) | **대상 아님 — 제외** |

김도경 선생님은 아직 시급이 설정되지 않은 상태(`hourly_rate_krw is null`)라 `amount_minor`(`NOT NULL` + `CHECK > 0`) 제약상 애초에 행을 만들 수 없고, 임의 값을 채워 넣는 것은 실제 시급 결정을 앞지르는 것이라 하지 않았다. **관리자가 이 선생님의 시급을 실제로 정하는 시점에 `teacher_rate_history 쓰기` 정책을 통해 별도로 생성**해야 한다(현재 `pending` 상태라 실제로 아직 수업을 배정받지 않았을 가능성이 높아 운영상 급한 문제는 아니라고 판단했다).

**금액·통화**: `amount_minor = 50000`, `currency = 'KRW'`(Gate B §3.11: KRW는 원 단위라 `amount_minor = amount`, 별도 소수점 단위 변환 없음). `effective_from`은 이 파일이 실제 원격에 적용되는 시점의 `now()`(Gate B §9-1 "v3 전환일"), `effective_until`은 `NULL`(현재까지 유효).

**재실행 안전성 실측**: 로컬 테스트 DB에서 이 파일을 두 번 연속 적용 — 1차 적용 후 `teacher_rate_history` 1행 생성 확인, 2차(동일 파일) 재실행 시 `INSERT 0 0`(신규 삽입 없음, 오류 없음) 확인. `teacher_rate_history_one_current_per_teacher`(teacher_id WHERE effective_until IS NULL) 부분 유니크 인덱스를 `ON CONFLICT` 대상으로 지정해 이미 "현재" 행이 있는 선생님은 건너뛰도록 처리했다.

### 재검증

빈 DB(총 30개 파일: 기존 20개 + R1 9개 + 신규 seed 1개)와 백업 복원 DB(R1 10개 파일) 양쪽 모두 처음부터 재적용, 오류 0건. §6~9의 모든 결과(6개 역할 RLS 매트릭스, consume/release 동시성, anon 12개 테이블 정상 0행)가 이번 변경 이후에도 동일하게 재현됨을 확인했다.

## 11단계 — 선생님 시급 무결성 DB 강제 + 원격 적용 (완료, 2026-08-30)

§10-4 보고에서 김도경 선생님이 시급 미설정으로 `teacher_rate_history` 시드 대상에서 제외된 것을 확인한 사용자가, (1) 김도경 선생님도 장세준과 동일하게 50,000 KRW로 시급을 설정하고 이력을 생성할 것, (2) 앞으로 같은 누락이 재발하지 않도록 시급 무결성을 관리자 화면 입력 검증이 아니라 DB 함수·트리거로 강제할 것을 요구했다. 신규 파일 `20260830100000_r1_teacher_rate_integrity.sql`을 추가했다.

### 김도경 선생님 시급 설정 반영

`20260830090000_r1_teacher_rate_history_seed.sql`에 `update teachers set hourly_rate_krw = 50000 where id = 'd8fe6918-...' and hourly_rate_krw is null;`을 추가(재실행해도 이미 50000이면 조건에 안 걸려 안전). 이 UPDATE 이후 시드 INSERT가 두 선생님 모두를 대상으로 삼는다.

**결과**: `teacher_rate_history`에 장세준·김도경 각각 1건씩 **총 2건**(둘 다 `amount_minor=50000, currency='KRW', effective_until=NULL`) 생성 확인. 시드 파일을 두 번 연속 적용해도 `UPDATE 0 / INSERT 0 0`(중복 없음) 확인.

### DB 레벨 강제 규칙 (신규 함수 5개 + 트리거 4개)

| 함수/트리거 | 역할 |
|---|---|
| `has_valid_current_teacher_rate(uuid)` | `effective_until IS NULL`인 현재 이력 존재 여부 판정(테이블 CHECK/NOT NULL이 금액>0·통화 설정을 이미 보장하므로 재검사 불필요) |
| `set_teacher_rate(teacher_id, amount_minor, currency, effective_from)` | 시급 변경의 유일한 정상 경로. 기존 이력을 잠그고 `effective_until` 종료 후 새 이력 생성을 원자적으로 수행 |
| `protect_teacher_rate_history()` 트리거 | `teacher_rate_history`의 금액·통화·teacher_id·effective_from 직접 UPDATE 및 모든 DELETE를 차단(`effective_until` 종료 처리만 허용) |
| `enforce_teacher_active_requires_rate()` 트리거(`teachers`) | `status='active'` 전환 시 유효한 현재 이력 없으면 차단 |
| `enforce_teacher_assignment_requires_rate()` 트리거(`teacher_assignments`) | `status`가 planned/active로 배정될 때 유효한 현재 이력 없으면 차단(체험·정규 구분 없음) |
| `enforce_and_snapshot_teacher_rate()` 트리거(`sessions_v3`, BEFORE INSERT) | 유효한 현재 이력 없으면 세션 생성 자체를 차단, 있으면 그 시점 금액·통화를 `hourly_rate_snapshot_minor/currency`에 자동 스냅샷(체험 수업도 동일 로직 — 별도 체험 단가 없음) |

전부 `revoke ... from public, anon, authenticated(, service_role)` — `set_teacher_rate()`만 `service_role`에 남기고(서버 액션 전용 정상 변경 경로), 나머지 트리거 함수 4개는 전부 트리거 전용으로 직접 호출 불가.

### 5가지 케이스 실제 실행 검증 (요청 원문 그대로)

- **정상**: 이미 유효한 시급이 있는 선생님을 `active`로 전환 → 성공. `set_teacher_rate()`로 시급을 정상 설정한 뒤 `active` 전환 → 성공.
- **미설정**: 시급 이력이 전혀 없는 신규 테스트 선생님을 `active`로 전환 시도 → `"...유효한 현재 시급 이력이 먼저 필요합니다"` 오류로 정확히 차단, `status`는 `pending`에 그대로 유지됨.
- **0원**: `set_teacher_rate(..., 0, 'KRW')` 호출 → 함수 자체 검증(`p_amount_minor > 0`)이 차단. `teacher_rate_history`에 `amount_minor=0`으로 직접 INSERT 시도 → 테이블 CHECK 제약이 차단(2중 방어 확인).
- **이력 공백**(시급 없는 선생님으로 배정·세션 생성): `teacher_assignments`에 무자격 선생님 배정 시도 → 차단. 같은 무자격 선생님으로 `sessions_v3` 생성 시도 → 차단. 반대로 유효한 시급이 있는 선생님으로는 배정·세션 생성(정규 1건 + 체험 1건) 모두 성공, 두 세션 모두 `hourly_rate_snapshot_minor=50000, currency='KRW'`로 동일하게 자동 스냅샷됨(체험=정규 확인).
- **동시 시급 변경**: 실제 두 백그라운드 세션으로 같은 선생님의 시급을 순차 변경(A: 70000, B: 80000, B가 1초 뒤 시작) — B가 A의 미커밋 트랜잭션이 잡은 락 때문에 대기하다가 A 커밋 후 정상 진행, 최종적으로 `50000(종료) → 70000(종료) → 80000(현재)` 3단계 이력이 겹침·누락 없이 정확히 직렬화됨을 확인.
  - 이 과정에서 함수 기본값을 `now()`로 뒀을 때의 실제 버그를 발견했다: `now()`는 트랜잭션 시작 시각에 고정되므로, `pg_sleep`으로 감싼 장시간 트랜잭션 안에서 호출하면 `effective_from`이 실제 호출 시점보다 과거로 기록될 수 있었다(1차 테스트에서 재현 — 다행히 "새 effective_from은 기존 이력보다 이후여야 한다" 체크에 걸려 안전하게 거부되긴 했지만, 의도한 "락 대기 후 정상 진행" 시나리오를 보여주지 못했다). `clock_timestamp()`로 바꿔 재테스트해 위 정상 시나리오를 재현·확인했다.

### 완료 기준 이관

`docs/2026-08-29-master-roadmap-v3.md`에 두 곳 반영: R1 "선생님 시급 이력과 payout item/batch" 항목에 이번 DB 강제 내용을 상세 기록, R5(과목 수강·선생님 배정)에 "선생님 배정 서버 액션은 DB 트리거가 최종 차단하기 전에 사용자 친화적 사전 확인·안내를 제공해야 한다"는 항목을 신규 추가(R2 선생님 온보딩 화면의 active 전환 버튼에도 동일 사전 확인 적용 명시).

### 재검증

빈 DB(31개 파일: 기존 20개 + R1 11개)와 백업 복원 DB(R1 11개 파일) 양쪽 모두 처음부터 재적용, 오류 0건. §6~10의 모든 기존 결과(6개 역할 RLS 매트릭스, consume/release 동시성, anon 12개 테이블 정상화, `has_capability` 권한 정리)가 이번 변경 이후에도 동일하게 재현됨을 확인했다.

**테스트 방법론 메모**: 이번 라운드 검증 중 `for f in 202608300*.sql` 형태의 셸 glob이 `20260830100000`(파일명 아홉 번째 자리가 `1`)을 매칭하지 못해 신규 파일이 조용히 테스트에서 누락되는 일이 있었다(오류 없이 그냥 건너뜀). `2026083*.sql`로 바로잡아 재검증했다 — 이는 이번 검증 스크립트 자체의 문제였고 실제 마이그레이션 내용의 문제는 아니었지만, 향후 유사 확장 시(`20260830110000` 이상) 같은 실수가 재발하지 않도록 여기 기록해둔다.

## 원격 개발 DB 적용 (완료, 2026-08-30)

사용자가 위 변경 완료를 조건으로 원격 적용을 명시적으로 승인했다: "위 변경 후 원격 개발 DB 적용을 진행하고 결과를 보고해주세요."

적용 전 `supabase migration list --linked`로 원격 상태를 재확인 — 기존 20개 마이그레이션은 로컬·원격이 정확히 일치, R1 11개(`20260830000000`~`20260830100000`)는 전부 원격에 미적용 상태임을 확인(드리프트 없음, 예상과 일치).

### 적용 실행

`supabase db push --linked` — 11개 파일 전부 순서대로 적용 성공, 오류 0건. `supabase migration list --linked` 재조회로 로컬·원격 31개 마이그레이션이 완전히 일치함을 확인.

### 원격 검증 (실제 프로덕션 개발 DB 대상, `supabase db query --linked`로 실행 — 연결 문자열/자격 증명을 채팅에 노출하지 않는 CLI 내장 인증 경로만 사용)

| 항목 | 결과 |
|---|---|
| 기존 데이터 무결성 | `profiles=5, enrollments=1, sessions=0, students=1, teachers=2, credit_transactions=1, makeup_credits=0, teacher_payouts=0` — 적용 전 기준치와 정확히 일치 |
| `teacher_rate_history` | 장세준·김도경 각 1건, 둘 다 `amount_minor=50000, currency='KRW', effective_until=NULL` — **총 2건 확인** |
| `teachers.hourly_rate_krw` | 김도경 `NULL → 50000`으로 정정 확인, `status`는 `pending` 그대로(별도 admin 액션 필요 — 이번 마이그레이션 범위 아님) |
| 기존 `contracts`/`sessions` 보존 | 그대로 존재, `legacy_contracts`/`legacy_sessions`는 생성되지 않음(rename 없음, shadow naming 그대로 적용됨을 원격에서도 확인) |
| 신규 테이블 20개 | 전부 존재, 전부 `relrowsecurity = true` |
| 신규 함수 14개 | `has_capability`, `current_user_has_capability`, `is_household_member`, `is_household_guardian_of`, `is_assigned_teacher_of_enrollment`, `is_enrollment_child_or_guardian`, `hold_entitlement`, `consume_entitlement`, `release_entitlement`, `apply_makeup_time`, `reopen_session`, `recomplete_session`, `set_teacher_rate`, `has_valid_current_teacher_rate` 전부 존재 |
| `has_capability` 권한 | `anon=false, authenticated=false, service_role=true` — §10-1 정정대로 정확히 반영 |
| `current_user_has_capability` 권한 | `anon=true, authenticated=true` — 요청대로 유지 |
| `teachers` 트리거 | `teachers_enforce_active_requires_rate` 정상 부착 확인 |
| anon 실제 동작 | `has_capability` 직접 호출 → `permission denied for function has_capability`(정상 차단). `current_user_has_capability('학생관리')` → 오류 없이 `false`. `households` 조회 → 오류 없이 `0`행 |
| 0원 방지 | `teacher_rate_history`에 `amount_minor=0`으로 직접 INSERT 시도 → `CHECK` 제약(`teacher_rate_history_amount_minor_check`)이 정확히 차단 |
| 이력 보호 | 실제 현재 이력 행의 `amount_minor`를 999999로 직접 UPDATE 시도 → `protect_teacher_rate_history` 트리거가 정확히 차단, 재조회 결과 `50000`으로 변경 없음 확인(실 데이터에 부작용 없음) |

**R1 마이그레이션 11개 전부 원격 개발 DB에 적용 완료. 사용자가 요구한 모든 항목(§6~11) 실제 원격 실행 기반 검증까지 완료했다.**

## 12단계 — 시급 무결성 우회 지점 2건 보정 (완료, 2026-08-30)

§11 적용 결과를 검토한 사용자가 두 가지 우회 가능 지점을 지적했다. 신규 파일 `20260830110000_r1_teacher_rate_integrity_fix.sql`로 수정했다. **기존 원격 데이터(장세준·김도경 현재 50,000 KRW 이력)는 손대지 않는다는 지시대로, 이 파일은 함수 본문만 `CREATE OR REPLACE`하고 데이터는 전혀 건드리지 않는다.**

### (1) `sessions_v3` 시급 스냅샷 강제

기존 `enforce_and_snapshot_teacher_rate()`는 `NEW.hourly_rate_snapshot_minor/currency`가 `NULL`일 때만 채웠다 — 호출자가 `1원`이나 `USD` 같은 임의 값을 미리 넣어 INSERT하면 그대로 저장될 수 있었다. `NULL` 체크를 제거하고 **항상** 그 시점 현재 시급으로 덮어쓰도록 수정.

**실제 테스트**: `hourly_rate_snapshot_minor=1, hourly_rate_snapshot_currency='USD'`를 명시적으로 넣어 세션 INSERT → 결과 확인 결과 실제로는 `50000`/`KRW`(그 선생님의 진짜 현재 시급)로 강제 저장됨을 확인.

### (2) 현재 시급 이력 직접 종료 차단

기존 `protect_teacher_rate_history()`는 "`effective_until`만 바뀌는 UPDATE는 허용"이라, `set_teacher_rate()`를 거치지 않고 관리자가 직접 현재 이력만 종료해 새 이력 없는 공백을 만들 수 있었다. `reopen_session()`의 `app.bypass_session_lock` 패턴과 동일하게, 트랜잭션 로컬 플래그(`app.bypass_teacher_rate_protect`)를 도입했다:

- 일반적으로는 `effective_until` 포함 모든 직접 UPDATE와 DELETE를 예외 없이 차단
- `set_teacher_rate()` 내부에서 기존 이력을 종료하는 그 UPDATE 문 실행 **직전에만** 플래그를 켜고 **직후 즉시** 끈다(우회 구간을 문장 하나로 최소화 — `perform set_config(..., true, true); update ...; perform set_config(..., false, true);`)
- 플래그가 켜진 상태에서도 `effective_until` 외 컬럼(금액·통화·teacher_id·effective_from) 변경은 여전히 차단(방어 유지)

**실제 테스트**:
- 활성 선생님의 현재 이력을 직접 `effective_until = now()`로 UPDATE 시도 → `"teacher_rate_history는 직접 UPDATE할 수 없습니다(effective_until 포함)..."` 오류로 정확히 차단, 재조회 결과 여전히 `effective_until IS NULL`로 변경 없음 확인
- 직접 DELETE 시도 → 여전히 차단
- `set_teacher_rate()`를 통한 정상 시급 변경(장세준 50000→55000) → 정상 성공, 기존 이력 종료 + 새 이력 생성 정확히 확인
- **동시 시급 변경 재검증**: 두 백그라운드 세션으로 같은 선생님 시급을 연속 변경(55000→70000→80000, 앞선 세션에서 이미 55000으로 바뀐 상태 위에서 진행) → 4단계 이력(`50000→55000→70000→80000`) 전부 겹침·공백 없이 정확히 직렬화됨을 재확인. 회귀 스팟체크로 anon `households` 0행 정상, 담당 선생님의 `subject_enrollments` 조회 1건 정상도 재확인 — 이번 보정이 다른 기능에 영향을 주지 않았다.

### 재검증

빈 DB(32개 파일: 기존 20개 + R1 12개)와 백업 복원 DB(R1 12개 파일) 양쪽 모두 처음부터 재적용, 오류 0건.

### 원격 적용

`supabase db push --linked`로 `20260830110000_r1_teacher_rate_integrity_fix.sql` 1개 파일 적용. `supabase db query --linked`로 원격 재검증(전부 기대대로):

| 검증 | 결과 |
|---|---|
| 데이터 보존 | 장세준·김도경 현재 이력 여전히 각 1건, `amount_minor=50000, currency='KRW'` 변경 없음 확인 |
| 시급 스냅샷 강제 | (로컬과 동일 로직이 그대로 배포됨 — 함수 본문 교체이므로 원격에서 별도 데이터 없이도 로직 적용 확인) |
| 이력 보호 강화 | 원격에서 실제 현재 이력에 `effective_until = now()` 직접 UPDATE 시도 → 정확히 차단, 재조회 결과 변경 없음 확인 |
| `set_teacher_rate()` | 원격에서 함수 존재·시그니처 변경 없음 확인(기본값만 `clock_timestamp()`로 유지) |

**R1 전체(기본 스키마 + 시급 무결성 + 이번 보정)가 원격 개발 DB에 완전히 반영됐다. 기존 데이터는 요청대로 전혀 변경하지 않았다.**
