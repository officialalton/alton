# bypass GUC 보안 정리 계획 (2026-09-08, 계획 전용 — 코드/마이그레이션 변경 없음)

> **개정 이력**: 이 문서는 초안(2026-09-07 작성분) 대비 아래 4가지를 개정했다 —
> (1) 7개 전부 하드 블로커로 확정(잠정/결정 필요 프레이밍 제거), (2)
> `bypass_reconciliation_task_lock`의 "R10 착수 여부 미확인" 서술이 사실과
> 달랐음을 정정(R10 payout 파이프라인은 이미 구현돼 있음 — 실제 커밋 확인
> 완료), (3) 초안에 남아 있던 "결정 필요" 3개 항목을 실제 최신 함수 본문을
> 전수 읽어 확정 결론으로 전환, (4) 7개 GUC 각각에 대해 "여러 대안 나열" 대신
> 단일 확정 방향 + 구체적 테스트 시나리오로 재작성. 이 개정 라운드에서도
> 코드/마이그레이션은 전혀 건드리지 않았다.
>
> **3차 개정**: `bypass_trial_session_auto_complete`에 `completed_at` 동시성
> 불변식을 추가 — `status='completed'`가 되는 모든 경로(캐스케이드든 예외적
> 직접 UPDATE든)에서 `completed_at`이 같은 문장으로 함께 채워지지 않으면
> 거부하도록 트리거 조건을 강화했다. 배치 1(`consent → teacher_rate →
> trial_session_auto_complete`)의 코드 구현은 이 3차 개정 반영 직후 착수한다.
>
> **2차 개정(2026-09-08, 이 라운드)**: 제품 오너가 `bypass_consent_protect`/
> `bypass_teacher_rate_protect`에 대해 "필드 조합 검사" 설계(위 개정에서 확정했던
> 방식 a)를 반려했다 — 필드 검사만으로는 "이 UPDATE가 실제로 함수를 통해 왔는가"를
> 증명하지 못하고 "이 UPDATE의 컬럼 집합이 우연히 허용 목록과 일치하는가"만
> 증명하므로, 함수를 우회해 허용된 필드만 직접 UPDATE하면 함수 본문의 나머지
> 원자적 부수효과(예: `revoke_guardian_consent()`의 `privacy_review_tasks` 행 생성,
> `set_teacher_rate()`의 새 이력 INSERT + `teachers.hourly_rate_krw` 동기화)를 통째로
> 건너뛸 수 있다는 것이 반려 사유다. 실제 함수 본문을 다시 읽어 이 우려가 코드
> 사실과 정확히 일치함을 확인했다(아래 2번/5번 항목의 "확정, 재확인" 표시 참고).
> 두 항목을 **1회용 DB 토큰 방식**(`bypass_status_protect`/`bypass_invite_protect`/
> `bypass_reconciliation_task_lock`과 같은 클래스의 메커니즘, 다만 단일 호출자용)으로
> 재설계했고, `bypass_trial_session_auto_complete`는 기존 "결과 조건 재검증" 방향은
> 그대로 유지한 채 원자성·역할 무관성을 명시적으로 검증하는 테스트 시나리오를
> 추가했다. 이 라운드도 계획/문서 개정만 — 코드/마이그레이션은 전혀 건드리지
> 않았다.

## 배경 패턴

이 저장소에는 "append-only/immutability 트리거를 SECURITY DEFINER 내부 함수가
자기 자신만 통과시키기 위해 트랜잭션 로컬 커스텀 GUC(`app.bypass_*`,
plain SQL `current_setting`/`set_config`)를 켜고 끈다"는 반복 패턴이 있다.
문제는 커스텀 GUC가 **GRANT/REVOKE 대상이 아니라는 것** — Postgres 권한
모델에 속하지 않는 순수 세션/트랜잭션 변수이므로, "앱 코드 중 어떤 role도
이 이름을 SET할 권한을 받은 적이 없다"는 것이 "아무도 SET할 수 없다"를
의미하지 않는다. RLS를 우회하는 모든 경로(SECURITY DEFINER 함수, service_role
직접 연결, 운영 스크립트, 마이그레이션, 향후 버그로 생긴 새 코드 경로)는
`SET app.bypass_xxx = 'true'`를 실행하는 데 아무 장벽이 없다.

이미 같은 취약점 클래스를 3건 닫았다 — 이번 계획은 그 세 커밋을 모델로 삼는다:

- `90d7012` — `session_prepared_selections` pin-lock의 `bypass_prepared_selection_lock` 제거
- `6f292cc` — `session_content_use_events` append-only lock의 `bypass_content_use_event_lock` 제거
- `876b30a` — `session_annotation_events` append-only lock의 `bypass_annotation_lock` 제거

세 건 모두 "레거시 GUC 우회 분기를 트리거 함수에서 완전히 삭제 + 그 GUC를
쓰던 내부 호출자가 실제로는 우회가 필요 없었다(애초에 자기 자신이 만든 행이라
막힐 이유가 없었거나, append-only라 정리 자체를 포기하는 게 맞았다)"로
귀결됐다 — **"안전한 대체재"가 아니라 "우회 분기 자체가 불필요했다"**는 것이
공통 결론이었다. 이번 7건은 성격이 갈린다: 몇몇은 동일하게 "트리거를 필드
조합 검사로 재작성하면 충분"하지만, 다중 호출자(같은 GUC를 여러 함수가
공유)이거나 진짜 재진입(자기 트랜잭션에서 자기가 막은 트리거를 다시
통과해야 함) 요구가 있는 경우는 GUC가 아닌 다른 구조적 메커니즘이 필요하다
— 이번 개정에서 7건 각각에 대해 그 메커니즘을 하나씩 확정했다(아래 각 항목의
"5. 안전한 대체").

## 실행 순서(2배치, 제품 오너 지시 반영)

제품 오너가 지시한 착수 순서: **1배치(저영향/단순군)를 먼저 독립적으로
검토·착수**하고, **이번 라운드가 수행한 최신 경로 전수 확인이 완료된 뒤에만**
**2배치(고범위군)**를 세부 스코프로 더 쪼개 진행한다.

> **2차 개정 반영**: `bypass_consent_protect`/`bypass_teacher_rate_protect`가
> 필드 검사 방식에서 1회용 DB 토큰 방식으로 바뀌면서, 배치 1도 이제 배치 2-1이
> 구축하는 것과 같은 클래스의 공유 토큰 테이블(`status_transition_tokens`,
> `action` 컬럼 확장판 — 아래 2번/5번 항목 "안전한 대체" 참고)에 의존한다.
> 즉 **토큰 테이블 인프라 자체(스키마 + GRANT/REVOKE 잠금 + 확인/소비 헬퍼)는
> 배치 1 착수 시점에 먼저 만들어야 한다** — 더 이상 "배치 2-1에서 처음 구축"이
> 아니라 "배치 1의 두 항목이 최초로 사용하고, 배치 2 세 항목이 그대로 재사용"으로
> 순서가 바뀐다. 배치 1/배치 2의 착수 순서 자체(1배치 먼저 독립 착수, 2배치는
> 그 이후 세부 스코프 분할)는 제품 오너 지시대로 유지하되, 토큰 인프라 마이그레이션
> 파일 하나는 배치 1 스코프에 포함시켜야 한다는 뜻이다.

- **배치 1 (단순 재진입, 독립적으로 먼저 착수 가능 — 단, 공유 토큰 인프라 신규 구축 포함)**
  1. `bypass_consent_protect` — 공유 토큰 테이블(`status_transition_tokens` + `action` 컬럼)을 여기서 처음 구축
  2. `bypass_teacher_rate_protect` — 배치 1-1의 토큰 인프라 재사용
  3. `bypass_trial_session_auto_complete` — 토큰 불필요, 결과 조건 재검증 방식 유지
- **배치 2 (다중 호출자·공유 토큰 인프라 재사용 또는 구조 재설계 필요, 배치 1 이후 세부
  스코프로 분할 진행)**
  1. `bypass_status_protect` — 배치 1-1의 토큰 인프라 재사용
  2. `bypass_invite_protect` — 배치 1-1의 토큰 인프라 재사용
  3. `bypass_reconciliation_task_lock` — 배치 1-1의 토큰 인프라 재사용, 정산 도메인이므로 우선순위 상향
  4. `bypass_session_lock` — 토큰 인프라와 무관한 별도 구조 재설계(두 불변식 분리, 별도 테이블)

아래 "우선순위 표"의 절 순서는 참조 편의상 기존 순서(session_lock →
consent → status → invite → teacher_rate → 정산/trial 2건)를 유지하지만,
실제 착수 순서는 위 배치 순서를 따른다.

## 우선순위 표 (문서 내 서술 순서: session_lock → consent → status → invite → teacher_rate → reconciliation → trial)

### 1. `bypass_session_lock`  — 배치 2-4

| 항목 | 내용 |
|---|---|
| 1. 보호 테이블·불변식 | `sessions`(`sessions_v3` → R6 cutover로 개명) 두 개의 서로 다른 불변식을 **같은 GUC 이름**으로 보호한다: (a) `final_status`가 `scheduled`/`live`를 벗어난 뒤에는 `reopen_session()`/`recomplete_session()`을 통해서만 바뀔 수 있다(`prevent_direct_final_status_update()`, `20260830040000_r1_reservation_session.sql`, R6 cutover 후 `20260928000000_r6_sessions_cutover.sql`에서 재정의), (b) 세션이 시작(`final_status <> 'scheduled'`)되거나 완료된 뒤에는 `material_version_id`를 재배정할 수 없다(`prevent_material_version_reassignment()`, `20261219000000_r8_material_version_lock.sql`). |
| 2. 실제 SET 호출 경로 | `reopen_session(p_session_id, p_reason)`과 `recomplete_session(...)` 내부에서만 `perform set_config('app.bypass_session_lock', 'true', true)` 호출 — 둘 다 함수 시작부에서 `if not public.is_admin() then raise exception`으로 게이트한 뒤 `final_status`를 되돌리는 UPDATE 직전에 켠다(`20260928000000_r6_sessions_cutover.sql:97-166` — 최신 버전, R6 cutover가 두 함수를 `sessions_v3`에서 `sessions`로 재정의). 앱 서버 액션이나 cron/웹훅에서 이 GUC를 직접 SET하는 코드는 repo 전체 grep(`app/`, `lib/`)에서 발견되지 않았다 — 유일한 SET 호출자는 이 두 SECURITY DEFINER 함수 자신이다. 통합 테스트(`app/session/[id]/r8-cutover.integration.test.ts`)는 `set_config('app.bypass_session_lock', ...)`를 fixture 정리용으로 직접 psql/superuser 경로에서 쓴다(정확히 우회 가능성을 이용하는 코드 — 대체 설계 시 이 테스트의 fixture 초기화 방식도 함께 손봐야 한다).|
| 3. 도달 가능성 | `authenticated`: 함수 본문의 `is_admin()` 검사가 실질 관문이라 일반 사용자는 즉시 거부된다 — 트리거 자체는 role을 구분하지 않으므로, `authenticated`가 임의 SQL을 실행할 수 있는 다른 취약점과 결합하면 GUC를 직접 SET하고 UPDATE를 통과시킬 수 있다. Service role: RLS를 완전히 우회하고 커스텀 GUC 접근 제어도 없으므로, 어떤 service_role 연결(운영 스크립트, 백엔드 job)이든 `SET`만으로 두 불변식을 무력화할 수 있다 — 90d7012/6f292cc/876b30a와 동일한 핵심 위험. SECURITY DEFINER: `reopen_session`/`recomplete_session`이 이 GUC의 유일한 정상 호출자이지만, **다른 어떤 SECURITY DEFINER 함수든** 함수 소유자 권한으로 이 이름을 SET할 수 있다 — GUC가 함수 경계를 특정하지 않는다. |
| 4. 깨질 정상 흐름 | `reopen_session()`은 `completed → live` 전이를 기록한 뒤 그 UPDATE를 성공시키기 위해 자기 자신의 `prevent_direct_final_status_update` 트리거를 통과해야 하는 **진짜 재진입**이다. 단순 삭제로는 안 된다 — 정상 관리자 재개방/재확정 기능 자체가 그 UPDATE를 필요로 한다. 또한 `bypass_session_lock`이 두 트리거(final_status 락 + material_version_id 락)에 공유되므로, `reopen_session()`이 켜는 동안에는 **의도치 않게 material_version_id 락도 함께 풀린다** — 같은 트랜잭션 안에서 다른 코드가 `material_version_id`를 바꾸는 UPDATE를 끼워 넣으면 통과해버리는 부작용 경로가 이론상 존재한다(현재 두 함수 본문에는 그런 UPDATE가 없어 실사용 피해는 없지만, GUC 재사용 자체가 설계 결함). |
| 5. 안전한 대체(확정) | **구조 재설계 — 두 불변식을 각자의 1회용 토큰으로 분리한다.** 하나의 GUC를 두 트리거가 공유하는 것 자체가 근본 결함(4번에서 확인한 material_version_id 부작용 경로)이므로, 필드 검사 재작성이 아니라 구조 변경을 택한다: 신규 테이블 `session_invariant_unlock_tokens(session_id uuid, invariant text check (invariant in ('final_status','material_version_id')), xact_id bigint, created_at timestamptz default now())`를 두고, `reopen_session()`/`recomplete_session()`이 UPDATE 직전 자신이 실제로 필요로 하는 불변식 이름만 콕 집어 `insert ... values (p_session_id, 'final_status', txid_current())`로 토큰을 심는다. `prevent_direct_final_status_update()`/`prevent_material_version_reassignment()`는 GUC 대신 "`session_invariant_unlock_tokens`에 이 `session_id`+자기 불변식 이름+`txid_current()`가 일치하는 행이 있는가"만 확인하고, 있으면 그 자리에서 해당 행을 `delete`(1회용)한 뒤 통과시킨다. 두 불변식이 각자 자기 이름의 토큰만 확인하므로 4번의 부작용(재개방 중 material_version_id도 같이 풀리는 문제)이 구조적으로 사라진다. 토큰 INSERT/DELETE 권한은 일반 GRANT/REVOKE 대상이라 GUC처럼 "이름만 알면 아무나 켤 수 있는" 문제가 없다. |
| 5-1. 테스트 시나리오 | ① `reopen_session()`/`recomplete_session()` 정상 호출 경로 통과 확인(관리자, completed→live, completed→재확정). ② 두 함수를 거치지 않고 `sessions.final_status`/`material_version_id` 직접 UPDATE 시도 시 거부 확인(트리거 여전히 작동). ③ `reopen_session()` 트랜잭션 도중 같은 트랜잭션에서 `material_version_id`를 바꾸는 별도 UPDATE를 끼워 넣었을 때 **거부**되는지 확인(현재 버그의 회귀 테스트 — 4번에서 지적한 부작용이 새 설계에서 실제로 막히는지 검증하는 핵심 케이스). ④ 토큰을 심고 UPDATE 전에 예외로 함수가 중단되는 경우 토큰이 트랜잭션 롤백과 함께 사라지는지(좀비 토큰 미잔존) 확인. ⑤ `r8-cutover.integration.test.ts`의 fixture 정리 코드를 새 토큰 테이블 방식으로 갱신 후 회귀. |
| 6. 수정 대상 / Preview 게이트 | 신규 `session_invariant_unlock_tokens` 테이블/헬퍼 + `prevent_direct_final_status_update()`, `prevent_material_version_reassignment()`, `reopen_session()`, `recomplete_session()`(R6 cutover 버전) 전부 함께 수정 + `r8-cutover.integration.test.ts` fixture 갱신. **Preview/non-prod 반영 전 필수 — 하드 블로커("세션 불변식"에 정확히 해당).** |

### 2. `bypass_consent_protect`  — 배치 1-1

| 항목 | 내용 |
|---|---|
| 1. 보호 테이블·불변식 | `guardian_consents`. DELETE는 항상 금지. UPDATE는 철회 관련 3개 필드(`revoked_at`, `revoked_by`, `revocation_reason`)만 허용되고 나머지(동의 당시 기록 — `policy_version_id`, `consented_by`, `consented_at`, `verification_method`, `verification_reference`, `notice_delivered_at`)는 절대 불변이어야 한다. **2차 개정 추가**: 이 불변식은 "허용 필드만 바뀌었는가"로 끝나지 않는다 — 정상 철회는 `revoke_guardian_consent()` 안에서 철회 UPDATE와 **원자적으로 한 트랜잭션에 묶인** `privacy_review_tasks` 행 생성(`20260904000000_r2_minor_consent.sql:289-294`, 함수 본문 재확인 완료 — `insert into privacy_review_tasks (student_id, reason, created_by) values (...)`)까지 포함해야 "완전한 철회"다. 즉 진짜 불변식은 "철회 3필드 UPDATE"가 아니라 "철회 3필드 UPDATE + `privacy_review_tasks` 행 생성이 항상 같이, 오직 함수를 통해서만 일어난다"이다. |
| 2. 실제 SET 호출 경로 | `revoke_guardian_consent(p_consent_id, p_reason)` 내부에서만, 철회 UPDATE 직전/직후에 켜고 끈다(`20260904000000_r2_minor_consent.sql:258-303`, 유일한 버전). 다른 SET 호출자는 repo 전체에서 발견되지 않음. |
| 3. 도달 가능성 | `authenticated`: `revoke_guardian_consent`는 `is_admin() or (auth.uid() = consented_by and 활성 보호자)` 검사를 통과해야 한다(`20260904000000_r2_minor_consent.sql:279`, 확인 완료). Service role/SECURITY DEFINER: GUC 자체 접근 제어 없음 → 동일 위험. |
| 4. 깨질 정상 흐름(2차 개정, 재확인) | `revoke_guardian_consent()`가 켜는 우회 구간은 철회 3개 필드만 갱신하는 단일 UPDATE 문 한 줄뿐이지만(`:283-287`), 그 UPDATE 앞뒤로 `is_admin()`/활성 보호자 검사(`:279-281`)와 `privacy_review_tasks` INSERT(`:289-294`)가 **같은 함수·같은 트랜잭션**에 있다. **1차 개정에서 택했던 필드 조합 검사(방식 a)로는 이 부분이 지켜지지 않는다** — 철회 3필드만 바뀌는 UPDATE를 함수 밖에서 직접 실행해도 트리거의 필드 검사는 통과하지만, 그 경로는 `privacy_review_tasks` 행을 만들지 않는다. 결과적으로 "동의가 철회됐는데 보관정책 재검토 태스크는 생성되지 않은" 상태가 합법적으로 만들어질 수 있다 — 이것이 제품 오너가 방식 a를 반려한 정확한 근거이며, 실제 함수 본문 재확인으로 사실임이 확정됐다. |
| 5. 안전한 대체(확정, 2차 개정 — 방식 a 폐기하고 1회용 DB 토큰으로 교체) | **`status_transition_tokens` 공용 테이블(이 항목에서 최초 구축, `action` 컬럼 포함)을 이용한 1회용 토큰.** 테이블 스키마: `status_transition_tokens(table_name text, row_id uuid, action text, xact_id bigint default txid_current(), created_at timestamptz default now())`. `revoke_guardian_consent()`는 `is_admin()`/활성 보호자 검사를 통과한 뒤, 철회 UPDATE 직전에 `insert into status_transition_tokens (table_name, row_id, action) values ('guardian_consents', p_consent_id, 'revoke_consent')`로 토큰을 심고, 철회 UPDATE와 `privacy_review_tasks` INSERT를 **모두 실행한 뒤에도 토큰을 지우지 않는다** — 토큰 소비는 트리거 쪽 책임이다. `protect_guardian_consent()` 트리거는 GUC 대신 "이 UPDATE가 정확히 철회 3필드만 바꾸는가"는 여전히 확인하되(동의 당시 8개 필드 중 하나라도 바뀌면 토큰 유무와 무관하게 무조건 거부 — 이 부분은 방식 a의 필드 검사를 그대로 유지), 철회 3필드만 바뀌는 경우에는 추가로 "`status_transition_tokens`에 `table_name='guardian_consents'`+`row_id=`이 행의 id+`action='revoke_consent'`+`xact_id=txid_current()`가 일치하는 행이 있는가"를 확인해서 **토큰이 없으면 거부**하고, 있으면 그 토큰 행을 그 자리에서 `delete`(1회용)한 뒤 통과시킨다. 이렇게 하면 "철회 3필드만 바뀌는 직접 UPDATE"가 더 이상 필드 검사만으로 통과하지 못하고, 반드시 `revoke_guardian_consent()`를 통해 토큰이 먼저 발급돼야 하므로 `privacy_review_tasks` 생성을 건너뛸 수 없다(토큰 INSERT와 실제 데이터 변경이 같은 트랜잭션 안에 있어, 함수가 중간에 실패하면 토큰도 롤백되어 좀비 토큰이 남지 않는다 — 5-1의 ④). 토큰 테이블 자체의 쓰기 권한은 GRANT/REVOKE로 구조적으로 잠근다 — `revoke insert, update, delete, truncate on status_transition_tokens from public, anon, authenticated, service_role;`로 명시 차단하고 RLS를 활성화한 채 쓰기 정책은 하나도 두지 않는다(`session_content_manifest` 잠금과 동일 패턴, `20261233000000_r9_session_content_manifest.sql:87` 참고) — SECURITY DEFINER 함수(`revoke_guardian_consent()` 등)만 테이블 소유자 권한으로 그 함수 본문 안에서 INSERT/DELETE할 수 있고, 그 권한은 함수 밖으로 새어나가지 않는다. 1차 개정의 "1. 보호하는 불변식" 절도 이 설계로 다시 참이 된다: **"철회 UPDATE만 있고 `privacy_review_tasks` 행이 없는 상태"는 이제 구조적으로 불가능**하다 — 필드 검사만으로는 이 원자성을 증명할 수 없었지만, 토큰이 함수의 나머지 로직(검사 통과 + INSERT)이 실제로 실행됐음을 증명하는 증거가 되기 때문이다. |
| 5-1. 테스트 시나리오(2차 개정 — 필드 검사 테스트 목록 폐기) | ① 정상 동의 철회 1회 호출로 철회 3필드 UPDATE와 `privacy_review_tasks` 행 생성이 **함께** 일어나는지 확인(관리자 경로, 본인 보호자 경로 각각). ② 철회 3필드만 노린 직접 UPDATE를 토큰 없이 시도 — 필드가 "허용 목록"과 정확히 일치해도 거부되는지 확인(방식 a에서는 통과했던 케이스가 이제 거부되어야 함 — 이번 개정의 핵심 회귀). ③ (참고용, 설계 검증) 예전 GUC(`app.bypass_consent_protect`)가 아직 존재한다고 가정하고 service_role이 직접 그 GUC를 SET해도 아무 효과가 없음을 확인 — 새 설계는 GUC 자체를 참조하지 않으므로 GUC 존재 여부와 무관하게 항상 거부되어야 한다(무력화할 GUC 의존성이 없음을 확인). ④ `revoke_guardian_consent()`가 철회 UPDATE는 성공했지만 `privacy_review_tasks` INSERT에서 실패하도록 강제(예: FK 위반 유도)했을 때, 트랜잭션 전체가 롤백되어 토큰도 철회 UPDATE도 남지 않는지 확인(원자성 — 토큰과 실제 데이터 변경이 생사를 같이함). |
| 6. 수정 대상 / Preview 게이트 | 신규 `status_transition_tokens` 테이블(+ GRANT/REVOKE 잠금 + 확인/소비 헬퍼) + `protect_guardian_consent()` 재작성 + `revoke_guardian_consent()`(GUC 대신 토큰 INSERT로 교체) + 회귀 테스트. **Preview/non-prod 반영 전 필수 — "동의" 항목 하드 블로커.** |

### 3. `bypass_status_protect`  — 배치 2-1

| 항목 | 내용 |
|---|---|
| 1. 보호 테이블·불변식 | `students`/`teachers`/`profiles` 등의 `status` 컬럼 — "허용된 전이만, 지정된 함수를 통해서만" 규칙. 아래 8개 파일이 이 **같은 GUC 이름**을 자기 자신의 상태 전이 함수 안에서 재사용한다. |
| 2. 실제 SET 호출 경로(확정, 8개 파일 전수 확인 완료) | `transition_account_status()` — `20260831011000_r2_account_status_apply.sql`(최초), `20260904000000_r2_minor_consent.sql`, `20260905000000_r2_workspace_provisioning.sql`, `20260908000000_r2_teacher_reactivation_gate_fix.sql`(최신 재정의, line 21-90)로 4번 `create or replace`됨 — **최신 버전은 `20260908000000_r2_teacher_reactivation_gate_fix.sql:21`**. `merge_accounts()` — `20260903010000_r2_account_merge.sql`(최초), `20260909000000_r2_task8_capability_gates.sql`(capability 게이트 추가), `20260911000000_r3_contracts_cutover.sql:190-225`(최신, teacher_contracts 재배정 추가)로 3번 재정의 — **최신 버전은 `20260911000000_r3_contracts_cutover.sql`**. `recomplete_session()` — `20260928000000_r6_sessions_cutover.sql:123-331`(유일 버전, R6 cutover). |
| 3. 도달 가능성(확정) | 8개 SET 호출부 전부의 **최신** 함수 본문을 직접 읽어 확인 — 예외 없이 전부 `is_admin()` 또는 `is_admin() OR current_user_has_capability(...)` 게이트가 함수 시작부에 있다: `transition_account_status()` 최신판(`20260908000000_r2_teacher_reactivation_gate_fix.sql:31`) `if not is_admin() then raise exception`; `merge_accounts()` 최신판(`20260911000000_r3_contracts_cutover.sql:61`) `if not (is_admin() or current_user_has_capability('manage_account_merges')) then raise exception`; `recomplete_session()`(`20260928000000_r6_sessions_cutover.sql:129`) `if not public.is_admin() then raise exception`. **"게이트 없는 SET 호출부는 없다"가 확정 결론** — 초안의 "각 함수 본문 확인 필요"는 이번 라운드에서 해소됐다. 다만 게이트가 함수 본문 안에만 있고 GUC 이름 자체는 여전히 무방비이므로(트리거는 role/게이트를 모른다), service_role 직접 연결이나 다른 SECURITY DEFINER 함수의 GUC 재사용 위험은 여전히 유효(90d7012류와 동일한 핵심 위험). |
| 3-1. `20260909000000_r2_task8_capability_gates.sql`의 목적(확정) | 이 파일은 새 도메인을 여는 파일이 아니라, **기존에 `is_admin()`만 검사하던 관리자 전용 함수들을 `is_admin() OR current_user_has_capability(...)`로 넓히는 파일**이다(파일 헤더 주석 `20260909000000_r2_task8_capability_gates.sql:1-21`에 명시: "R2 Task 8 — 권한 모델... Task 4(초대)/5(계정 병합)/6(보호자 동의)/7(Workspace 프로비저닝)에서 새로 만든 관리자 전용 함수·RLS에 적용"). `bypass_status_protect`/`bypass_invite_protect`를 이 파일이 추가로 켜는 이유는 캐퍼빌리티 로직 자체가 초대/계정 상태를 건드리기 때문이 아니라, **이 파일이 `resend_account_invite()`/`revoke_account_invite()`/`merge_accounts()` 등 원래도 이 GUC들을 쓰던 함수를 `create or replace`로 다시 정의하면서(게이트만 넓히고 본문 로직은 그대로 옮김) 기존 SET 호출 코드를 그대로 승계**했기 때문이다(`resend_account_invite()` 본문 `20260909000000_r2_task8_capability_gates.sql:26-118`을 직접 읽어 확인 — `bypass_invite_protect` SET은 `account_invites.status` UPDATE 직전/직후 위치가 기존 파일과 동일 패턴). 즉 "왜 이 GUC들을 만지는가"의 답은 "새 함수가 아니라 기존 함수의 게이트만 확장한 재정의판이라서"다 — 결정 필요 항목 아님. |
| 4. 깨질 정상 흐름 | 3개 함수(`transition_account_status`/`merge_accounts`/`recomplete_session`) 각각이 "자기 자신이 계산한 허용된 전이"를 그 자리에서 한 번(또는 소수) UPDATE해야 하는 재진입 — 단일 UPDATE 유형이지만 관여 함수·마이그레이션 파일이 여럿이라는 점이 `bypass_consent_protect`와 다르다. |
| 5. 안전한 대체(확정, 2차 개정에서 테이블 스키마 갱신) | **테이블 기반 1회용 토큰**(방식 b) — 여러 함수·여러 도메인(계정/계약/세션)이 이 GUC 하나를 공유하는 다중 호출자 구조라, 트리거 하나에 모든 전이 규칙을 인코딩하는 것은 트리거를 과도하게 복잡하게 만든다. 공용 테이블 `status_transition_tokens(table_name text, row_id uuid, action text, xact_id bigint default txid_current(), created_at timestamptz default now())`(**`action` 컬럼은 2차 개정에서 추가 — 배치 1-1 `bypass_consent_protect`가 이 테이블을 최초로 만들고, 이 항목·`bypass_invite_protect`·`bypass_reconciliation_task_lock`·`bypass_teacher_rate_protect`가 재사용한다**)를 두고, `transition_account_status()`/`merge_accounts()`/`recomplete_session()`이 UPDATE 직전 `insert into status_transition_tokens (table_name, row_id, action) values (..., 'status_transition')`로 토큰을 심는다(이 항목의 세 함수는 전이 종류가 하나뿐이라 `action` 값이 항상 고정 문자열이지만, 배치 1-1/1-2의 단일 호출자 케이스는 `'revoke_consent'`/`'close_teacher_rate'`처럼 함수별로 구분되는 값을 쓴다 — 같은 테이블, 다른 `action` 값으로 용도를 구분). `protect_account_status()` 트리거는 GUC 대신 "`status_transition_tokens`에 이 테이블명+행 id+`action`+`txid_current()`가 일치하는 행이 있는가"만 확인하고 즉시 그 토큰 행을 delete한 뒤 통과시킨다. 테이블 자체의 쓰기 권한은 **어떤 일반 role에도 GRANT하지 않는다** — `revoke insert, update, delete, truncate on status_transition_tokens from public, anon, authenticated, service_role;`로 명시적으로 전부 차단하고, RLS도 활성화한 채 쓰기 정책을 하나도 두지 않는다(`session_content_manifest`를 잠글 때 쓴 것과 동일한 패턴 — `20261233000000_r9_session_content_manifest.sql:87` `revoke insert, update, delete, truncate on session_content_manifest from public, anon, authenticated;` 참고). 실제로 이 테이블에 쓸 수 있는 것은 SECURITY DEFINER 함수들(`transition_account_status()` 등 및 배치 1-1/1-2의 `revoke_guardian_consent()`/`set_teacher_rate()`)뿐이다 — 이 함수들은 테이블 소유자(마이그레이션 실행 role, RLS를 우회하는 소유자 권한)로 실행되므로 GRANT 없이도 자기 함수 본문 안에서는 INSERT/DELETE가 가능하지만, 그 권한은 함수 밖으로 새어나가지 않는다. 이 인프라(`status_transition_tokens` 테이블 + 확인/소비 헬퍼 함수)는 배치 1-2(`bypass_teacher_rate_protect`), 배치 2-2(`bypass_invite_protect`), 배치 2-3(`bypass_reconciliation_task_lock`)에서 **그대로 재사용**한다(테이블/함수 하나로 다섯 GUC를 대체) — 이번 2차 개정에서 그 공용 설계를 여기서 다시 확정한다. |
| 5-1. 테스트 시나리오 | ① 3개 함수 각각의 정상 호출 경로 통과 확인(관리자, capability 보유자). ② 3개 테이블(`students`/`teachers`/`profiles`/`sessions` 등 실제 대상) 각각에 대해 함수를 거치지 않은 직접 UPDATE 시도 거부 확인. ③ 토큰을 심은 뒤 함수가 예외로 중단되는 경우 토큰이 트랜잭션과 함께 롤백되는지 확인(좀비 토큰 없음). ④ 같은 트랜잭션 안에서 두 함수가 연달아 같은 행에 토큰을 심는 동시 호출 시나리오에서 토큰이 서로 간섭하지 않는지(각 토큰이 `txid_current()`로 트랜잭션 범위에 묶임) 확인. ⑤ service_role이 GUC를 직접 SET하는 기존 방식이 더 이상 통하지 않는지(회귀) 확인. |
| 6. 수정 대상 / Preview 게이트 | 신규 `status_transition_tokens` 테이블/헬퍼 + `protect_account_status()` 트리거 + `transition_account_status()`(최신), `merge_accounts()`(최신), `recomplete_session()` 3개 함수 + 각 전이별 회귀 테스트. **Preview/non-prod 반영 전 필수 — 하드 블로커("계정 상태"에 정확히 해당).** |

### 4. `bypass_invite_protect`  — 배치 2-2

| 항목 | 내용 |
|---|---|
| 1. 보호 테이블·불변식 | `account_invites.status` — "지정된 함수(create/resend/accept/finalize/revoke)를 통해서만 변경"(`20260902000000_r2_account_invites.sql`). |
| 2. 실제 SET 호출 경로 | `create_account_invite`, `resend_account_invite`, `revoke_account_invite`, `claim_account_invite`(anon 포함 GRANT), `finalize_account_invite`(service_role 전용), `mark_expired_invites`(`is_admin()` 게이트) — `20260902000000_r2_account_invites.sql`에 원본, `20260909000000_r2_task8_capability_gates.sql`이 `resend_account_invite`/`revoke_account_invite` 등을 capability 게이트 추가로 재정의(3-1 항목과 동일 이유 — 새 목적 아님, 게이트 확장 재정의). |
| 3. `claim_account_invite`의 anon 토큰 인가(확정, 전체 함수 본문 직접 읽음 — `20260902000000_r2_account_invites.sql:269-323`, 유일한 버전) | **해시 비교**: 원문 토큰이 아니라 `encode(extensions.digest(p_token, 'sha256'), 'hex')`로 SHA-256 해시를 계산해 `account_invites.token_hash` 컬럼과 등호 비교(`where token_hash = v_hash`)한다 — 원문 토큰은 DB에 저장되지 않으므로 DB 유출 시에도 토큰 자체는 복구 불가. **만료 검사**: 저장된 `status`와 무관하게 항상 `expires_at <= now()`를 별도로 직접 검사(정리 배치 `mark_expired_invites()`가 아직 안 돌았어도 만료 토큰은 시간 기준으로 즉시 거부). **1회성/상태 검사**: `status = 'accepted'`면 멱등 응답(재제출 안전), `status <> 'pending'`인 모든 다른 상태(`superseded`/`revoked`/`manual_review`/`expired`)는 즉시 거부 — 토큰이 이미 소비됐거나 무효화됐으면 재사용 불가. **결론**: 이 경로의 인가는 role 검사가 아니라 "무작위 32바이트 토큰(`gen_random_bytes(32)`)을 알고 있다는 사실 자체"로 성립하며, GUC 우회 문제와는 **독립적**이다 — `bypass_invite_protect` 트리거를 어떻게 재설계하든 토큰 검증 로직 자체는 손댈 필요가 없다. 다만 `claim_account_invite`도 이 GUC를 이용해 `account_invites.status`를 UPDATE하므로, **트리거 재설계에는 반드시 포함**돼야 한다(토큰 검증과 GUC 우회는 별개 계층 — 토큰 검증은 "누가 이 함수를 호출할 자격이 있는가", GUC는 "이 함수의 UPDATE를 트리거가 어떻게 통과시키는가"). |
| 4. 깨질 정상 흐름 | 6개 함수 각각이 자기 자신의 단일(또는 소수) `status` UPDATE를 위해 재진입 — `bypass_status_protect`와 같은 다중 호출자 유형. `claim_account_invite`는 트랜잭션 안에서 최대 1번(existing-auth-user 분기 또는 정상 수락 분기 중 하나) 켜고 끈다. |
| 5. 안전한 대체(확정) | 배치 1-1(`bypass_consent_protect`)이 최초로 구축하는 **동일한 `status_transition_tokens` 공용 테이블/헬퍼(action 컬럼 포함)를 재사용**한다(방식 b) — `create_account_invite`/`resend_account_invite`/`revoke_account_invite`/`claim_account_invite`/`finalize_account_invite`/`mark_expired_invites` 6개 함수 전부가 UPDATE 직전 동일한 헬퍼로 `action = 'invite_status_transition'` 토큰을 심고 `protect_account_invite_status()`가 동일한 확인/소비 로직으로 검증한다. 별도 인프라를 새로 만들지 않는 이유: 이 GUC도 "다중 호출자가 각자의 단일 UPDATE를 위해 재진입"하는 동일 유형이라 근본적으로 같은 문제이고, 공용 테이블을 하나만 두면 관리 포인트가 줄어든다. |
| 5-1. 테스트 시나리오 | ① 6개 함수 각각의 정상 경로 통과 확인(anon 토큰 클레임 포함). ② `account_invites.status` 직접 UPDATE 시도 거부 확인. ③ 토큰 해시 불일치/만료/이미 소비된 토큰으로 `claim_account_invite` 재시도 시 기존과 동일하게 거부되는지(트리거 변경이 토큰 검증 로직에 영향 없음을 확인) 회귀. ④ `mark_expired_invites()`(cron/관리자 배치)가 다건 처리 시 각 행마다 토큰이 올바르게 발급/소비되는지(배치 UPDATE에서도 1회용 토큰이 행 단위로 정확히 매칭되는지) 확인. |
| 6. 수정 대상 / Preview 게이트 | `protect_account_invite_status()` + 6개 함수(최신 버전, capability 게이트 재정의판 포함) + 회귀 테스트. **Preview/non-prod 반영 전 필수 — 하드 블로커("초대"에 정확히 해당).** |

### 5. `bypass_teacher_rate_protect`  — 배치 1-2

| 항목 | 내용 |
|---|---|
| 1. 보호 테이블·불변식 | `teacher_rate_history` — DELETE 항상 금지. UPDATE는 오직 `set_teacher_rate()`가 기존 "현재 이력"을 종료(`effective_until` 설정)하는 단일 문장만 허용, 그 외 모든 직접 UPDATE(관리자 포함)는 차단. **2차 개정 추가**: 진짜 불변식은 "`effective_until` UPDATE 단독 허용"이 아니라 "기존 이력 종료(`effective_until` UPDATE) + 새 이력 INSERT + `teachers.hourly_rate_krw` 동기화 UPDATE, 이 3단계가 항상 한 트랜잭션에서 함께 일어난다"이다(`20260831000000_r2_sync_teachers_hourly_rate.sql:38-61`, 함수 본문 재확인 완료 — `perform set_config(...)` → `update teacher_rate_history set effective_until = ...` → `perform set_config(..., 'false', ...)` → `insert into teacher_rate_history (...)` → `update teachers set hourly_rate_krw = ...`). 이 3단계 중 하나라도 빠지면 "현재 유효한 시급이 없는 이력 공백" 또는 "`teachers.hourly_rate_krw`가 stale"인 상태가 된다. |
| 2. 실제 SET 호출 경로 | `set_teacher_rate()` 내부에서만(`20260830100000_r1_teacher_rate_integrity.sql` 최초, `20260830110000_r1_teacher_rate_integrity_fix.sql`이 게이트 강화, `20260831000000_r2_sync_teachers_hourly_rate.sql`이 최신 — `teachers.hourly_rate_krw` 동기화 추가, 동일 GUC SET 위치·패턴 유지). |
| 3. 도달 가능성 | `set_teacher_rate()`는 `revoke ... from public, anon, authenticated` + `grant ... to service_role`만 — 일반 사용자·관리자 화면에서 직접 호출 불가. Service role: 유일한 정상 호출 경로이자 유일한 위험 경로 — service_role 연결이면 어차피 이 함수 없이도 `teacher_rate_history`에 직접 INSERT/UPDATE 가능(RLS 우회)하므로, GUC 유무와 무관하게 service_role 자체가 이미 가장 강한 신뢰 경계. |
| 4. 깨질 정상 흐름(2차 개정, 재확인) | `set_teacher_rate()`가 켜는 우회 구간은 기존 이력 종료(`effective_until` UPDATE) 한 줄뿐이지만(`20260830110000_r1_teacher_rate_integrity_fix.sql:103-107`), 그 뒤로 새 이력 INSERT(`:110-112`)와 `teachers.hourly_rate_krw` 동기화 UPDATE(`20260831000000_r2_sync_teachers_hourly_rate.sql:61`)가 **같은 함수·같은 트랜잭션**에 이어진다. **1차 개정에서 택했던 필드 조합 검사(방식 a)는 "`effective_until`만 바뀌는 UPDATE는 항상 허용"이라고 재작성하는 안이었는데, 이는 정확히 이 문제를 만든다** — `effective_until`만 바꾸는 직접 UPDATE가 함수를 거치지 않고도 트리거를 통과해버리면, 기존 이력은 종료됐지만 새 이력 INSERT도 `teachers.hourly_rate_krw` 동기화도 일어나지 않아 "그 선생님에게 현재 유효한 시급이 전혀 없는" 상태가 만들어진다. 이것이 제품 오너가 방식 a를 반려한 정확한 근거이며, 실제 함수 본문 재확인으로 사실임이 확정됐다. |
| 5. 안전한 대체(확정, 2차 개정 — 방식 a 폐기하고 1회용 DB 토큰으로 교체) | **`status_transition_tokens` 공용 테이블(배치 1-1 `bypass_consent_protect`에서 구축한 것을 재사용, `action` 컬럼 활용)을 이용한 1회용 토큰.** `set_teacher_rate()`는 잠금(`for update`)과 유효성 검사를 통과한 뒤, 기존 이력 종료 UPDATE 직전에 `insert into status_transition_tokens (table_name, row_id, action) values ('teacher_rate_history', v_current.id, 'close_teacher_rate')`로 토큰을 심고, 그 UPDATE·새 이력 INSERT·`teachers.hourly_rate_krw` 동기화 UPDATE까지 **전부 실행한 뒤에도 토큰을 지우지 않는다** — 토큰 소비는 트리거 쪽 책임이다. `protect_teacher_rate_history()` 트리거는 `effective_until` 외 필드(금액·통화·teacher_id·effective_from) 보호는 기존처럼 무조건 유지하되, `effective_until`만 바뀌는 UPDATE에 대해서는 추가로 "`status_transition_tokens`에 `table_name='teacher_rate_history'`+`row_id=`이 행의 id+`action='close_teacher_rate'`+`xact_id=txid_current()`가 일치하는 행이 있는가"를 확인해서 **토큰이 없으면 거부**하고, 있으면 그 토큰 행을 즉시 `delete`한 뒤 통과시킨다. 이렇게 하면 "`effective_until`만 직접 UPDATE"가 더 이상 필드 검사만으로 통과하지 못하고, 반드시 `set_teacher_rate()`를 통해 토큰이 먼저 발급돼야 하므로 새 이력 INSERT·동기화를 건너뛴 채 기존 이력만 종료하는 공백 상태가 구조적으로 불가능해진다. 토큰 테이블의 GRANT/REVOKE 잠금은 배치 1-1과 동일(`revoke insert, update, delete, truncate on status_transition_tokens from public, anon, authenticated, service_role;`, RLS 활성 + 쓰기 정책 없음, `session_content_manifest` 패턴과 동일) — SECURITY DEFINER 함수만 테이블 소유자 권한으로 쓸 수 있고 그 권한은 함수 밖으로 새어나가지 않는다. 1차 개정의 "1. 보호하는 불변식" 절도 이 설계로 다시 참이 된다: **"기존 이력이 종료됐는데 새 이력이 없는 상태"(현재 유효 시급 없음)는 이제 구조적으로 불가능**하다. |
| 5-1. 테스트 시나리오(2차 개정 — 필드 검사 테스트 목록 폐기) | ① `set_teacher_rate()` 정상 호출 1회로 기존 이력 종료(`effective_until` 설정) + 새 이력 INSERT + `teachers.hourly_rate_krw` 동기화, 3단계가 **함께** 한 트랜잭션에서 완료되는지 확인(신규 시급 설정 시나리오). ② `effective_until`만 노린 직접 UPDATE를 토큰 없이 시도 — 거부되는지 확인(방식 a에서는 통과했던 케이스가 이제 거부되어야 함 — 이번 개정의 핵심 회귀). ③ (참고용, 설계 검증) 예전 GUC(`app.bypass_teacher_rate_protect`)를 service_role이 직접 SET해도 새 설계에는 아무 효과가 없음을 확인 — GUC 자체를 더 이상 참조하지 않으므로 무력화할 GUC 의존성이 없음을 확인. ④ `set_teacher_rate()`가 기존 이력 종료까지는 성공했지만 새 이력 INSERT 단계에서 실패하도록 강제(예: `p_amount_minor` 제약 위반을 INSERT 직전에 유도)했을 때, 트랜잭션 전체가 롤백되어 토큰도 종료 UPDATE도 남지 않는지 확인(원자성 — 기존 이력이 종료된 채 새 이력 없이 남는 상태가 생기지 않음). |
| 6. 수정 대상 / Preview 게이트 | `protect_teacher_rate_history()` 재작성 + `set_teacher_rate()`(R2 sync 포함 최신 버전, GUC 대신 토큰 INSERT로 교체) + 회귀 테스트. `status_transition_tokens` 테이블/헬퍼는 배치 1-1에서 이미 구축된 것을 재사용(신규 아님). **Preview/non-prod 반영 전 필수 — 하드 블로커(정산의 직접 입력값인 시급 이력이므로 "정산 관련 항목"에 해당).** |

### 6. `bypass_reconciliation_task_lock`  — 배치 2-3 (정정됨: 정산 도메인 하드 블로커)

> **정정 사항**: 초안은 "R10 payout 파이프라인이 아직 착수 전인지 미확인"이라는
> 전제로 이 항목의 우선순위를 유보했다. 이는 **사실과 다르다** — R10 payout
> 파이프라인은 이미 구현돼 있다(`git log --oneline --all | grep -i r10`으로
> 확인한 실제 커밋: `1072dda` "feat(r10): pre-incorporation payout gate +
> settlement pipeline schema", `a4f8d8d` "feat(r10): payout batch lifecycle
> (draft→reviewing→approved→processing→paid, reversal)", `6cb8ee6` "feat(r10):
> v3 payout_batches 관리자 화면", `ed72952`/`1519d26`/`55f9575`/`6871a3b` 등
> 다수의 R10 corrective 커밋 — 이 세션 자체가 이번 회차에서 만들고 고친
> 파이프라인이다). 아래는 그 실제 코드를 읽어 확인한 결론이다.

| 항목 | 내용 |
|---|---|
| 1. 보호 테이블·불변식 | `session_judgment_reconciliation_tasks` — `resolve_session_reconciliation_task()`/`set_reconciliation_task_student_cancelled_disposition()`를 통해서만 UPDATE 가능(DELETE는 무조건 금지, GUC 무관 — `reject_reconciliation_task_direct_mutation()`이 트리거로 항상 거부, `20261105000000_m5b_judgment_reconciliation_tasks.sql:80-99`). |
| 2. 실제 SET 호출 경로(최신 버전 확정) | `resolve_session_reconciliation_task()` — `20261105000000_m5b_judgment_reconciliation_tasks.sql`(원본) → `20261123000000_m5c_student_cancelled_reconciliation.sql` → **`20261124000000_m5c_final_reconciliation_integrity_gaps.sql:12-114`가 최신**(파일명 타임스탬프상 가장 나중, 전체 함수 본문 직접 읽음). `set_reconciliation_task_student_cancelled_disposition()` — **`20261124000000_m5c_final_reconciliation_integrity_gaps.sql:122-189`가 최신**(같은 파일, hold 금액 조회 범위를 grant 전체에서 reservation_id로 좁히는 수정). |
| 3. 정산 파이프라인과의 실제 관계(확정, 코드 추적 완료) | ① `resolve_session_reconciliation_task()`는 반영 시 두 갈래로 갈린다 — 전제(세션 상태/entitlement disposition/작업 생성 이후 adjust 이력)가 어긋나면 `needs_review`로 전환하고 아무것도 적용하지 않는다(`:49-89`, 2026-09-06 보강분). 전제가 맞으면 `public.adjust_entitlement(v_task.entitlement_grant_id, v_task.required_entitlement_adjustment_amount, ...)`를 호출해 **`entitlement_ledger`에 조정 이벤트를 직접 기록**한다(`:92-98`). ② `entitlement_ledger`는 수업권 소진/해제 원장으로, 학생 결제/수업권 도메인의 핵심 정산 근거 테이블이다. ③ **payout(강사 지급) 측 연결**: `20261105000000_m5b_judgment_reconciliation_tasks.sql:1-14`의 파일 헤더 주석이 명시하듯, "지급액 재계산(`payout_items`)은 이미 `recomplete_session()`이 처리한다"(session의 `payable_minutes` 변경 → `upsert_session_payout_item()`이 `payout_items.amount_minor`를 세션당 upsert, `20261030000000_m5a_session_final_judgment.sql:50-102`) — 즉 reconciliation task 자체가 `payable_minutes`를 바꾸는 것이 아니라 **이미 재판정(`recomplete_session()`)으로 바뀐 `payable_minutes`에 맞춰 entitlement 쪽 후속 조정이 필요한지를 계산·적용하는 후속 단계**다. ④ `payout_items`에 이미 `paid`가 찍힌 항목은 `prevent_paid_item_mutation()`이 금액 변경을 막으므로, `superseded_by_reconciliation_task_id` 컬럼(`20261105000000_m5b_judgment_reconciliation_tasks.sql:18-24`)에 "이 정산 항목이 재판정으로 대체 대상이 됐다"는 표시만 남긴다 — 이 컬럼이 신설된 이유 자체가 "재판정(reconciliation)이 실제 지급 파이프라인(`payout_items`)에 영향을 준다"는 것을 코드 차원에서 증명한다. R10 이후(`20261218000000_r10_payout_batch_lifecycle.sql`, `20261222000000_r10_settlement_pipeline_schema.sql`, `20261224000000_r10_paid_transition_guard_and_reversal_fix.sql`) 이 역분개 처리 자체가 실제로 구현됐다(원 헤더 주석의 "실제 역분개 로직 자체는 R10 범위로 남긴다"가 이후 실제 R10 라운드에서 이행됨). **결론**: `session_judgment_reconciliation_tasks`는 "정산 최종 원장 자체는 아니지만, entitlement_ledger(수업권 정산 원장)와 payout_items(강사 지급 원장) 양쪽에 직접 쓰기/표시를 남기는 정산 파이프라인의 필수 단계"다 — "정산 관련 항목"에 명확히 해당하며, R10 착수 여부와 무관하게(그리고 실제로 R10은 이미 착수·구현돼 있으므로 더더욱) 하드 블로커로 분류하는 것이 맞다. |
| 4. 깨질 정상 흐름 | `resolve_session_reconciliation_task()`/`set_reconciliation_task_student_cancelled_disposition()`가 자기 자신의 단일 UPDATE(상태 전환 또는 disposition 필드)를 위해 재진입 — `bypass_status_protect`/`bypass_invite_protect`와 동일한 다중 버전(4개 마이그레이션 파일에 걸쳐 재정의) 단일-UPDATE 재진입 유형. |
| 5. 안전한 대체(확정) | 배치 1-1(`bypass_consent_protect`)이 최초로 구축하는 **동일한 `status_transition_tokens` 공용 테이블/헬퍼(action 컬럼 포함)를 재사용**한다(방식 b, `action = 'reconciliation_task_transition'`) — 이유는 `bypass_invite_protect`와 동일: 다중 호출자(M5b/M5c에 걸쳐 여러 번 재정의된 2개 함수)가 각자의 단일 UPDATE를 위해 재진입하는 동일 유형이라, 별도 인프라를 새로 만들 필요가 없다. |
| 5-1. 테스트 시나리오 | ① `resolve_session_reconciliation_task()` 정상 반영 경로(resolved) 통과 확인. ② 전제 불일치로 `needs_review` 전환되는 경로 통과 확인(이 경로도 토큰 필요 — 4-a). ③ `set_reconciliation_task_student_cancelled_disposition()` 정상 경로 통과 확인. ④ `session_judgment_reconciliation_tasks` 직접 UPDATE/DELETE 시도 거부 확인(DELETE는 GUC 무관하게 항상 거부이므로 별도 확인). ⑤ 같은 grant에 대해 다른 대사 작업이 개입한 뒤 저장된 조정량이 무효화되는 needs_review 전환 로직(2026-09-06 보강분, `:74-90`)이 새 트리거 설계에서도 정확히 동작하는지 회귀. |
| 6. 수정 대상 / Preview 게이트 | `reconciliation_task_update_guard()` 트리거 + `resolve_session_reconciliation_task()`(최신, `20261124000000`) + `set_reconciliation_task_student_cancelled_disposition()`(최신, 같은 파일) + 회귀 테스트. **Preview/non-prod 반영 전 필수 — 하드 블로커("정산 관련 항목"에 해당, R10 payout 파이프라인 입력 경로로 확인 완료).** |

### 7. `bypass_trial_session_auto_complete`  — 배치 1-3

| 항목 | 내용 |
|---|---|
| 1. 보호 테이블·불변식(3차 개정 — `completed_at` 불변식 추가) | `trial_sessions.status`의 직접 `completed` 전환 금지 — "실제 v3 세션이 완료됐을 때만 자동 반영". **추가 불변식(제품 오너 지시)**: (a) `status`가 `'completed'`로 바뀌는 모든 경로에서 `completed_at`은 **같은 UPDATE 문 안에서** non-null로 함께 기록돼야 한다 — `status='completed'`이면서 `completed_at is null`인 행은 어떤 경로로도 존재할 수 없다. (b) 링크된 v3 세션(`sessions.final_status`)이 `completed`가 아니면 **역할과 무관하게**(관리자·service_role 포함) 거부한다. (c) 링크된 세션이 이미 `completed`라서 직접 UPDATE 자체는 허용되는 경로(호출자 미검증, 아래 5-1 ③)에서도, 그 UPDATE가 `completed_at`을 함께 채우지 않으면 거부한다 — "링크된 세션이 완료 상태다"라는 조건 하나만으로 통과시키지 않고, `completed_at` non-null 여부까지 같은 트리거가 함께 강제한다. |
| 2. 실제 SET 호출 경로 | 유일하게 `auto_complete_linked_trial_session()` 트리거 함수(AFTER UPDATE on `sessions`, `final_status = 'completed'`) 내부 — 사람이나 서버 액션이 직접 호출하는 함수가 아니라 DB 내부 캐스케이드 트리거. 다른 6개는 전부 사람이 트리거하는 SECURITY DEFINER 함수인 반면, 이것만 순수 시스템 이벤트 반응형이다. |
| 3. 도달 가능성 | `authenticated`/anon이 이 GUC를 켤 이유·경로가 없다(그런 코드 경로 없음). Service role/SECURITY DEFINER 경로로도 이 GUC 하나가 잘못 켜졌을 때 최악의 결과는 "체험 세션이 실제로는 안 끝났는데 완료로 표시"되는 정도로, blast radius는 7개 중 가장 작다 — 다만 blast radius가 작다는 것이 하드 블로커 제외 사유는 아니라고 판단한다(아래 게이트 표 참고 — "세션 불변식"을 넓게 해석해 포함). |
| 4. 깨질 정상 흐름 | `bypass_session_lock`과 유사한 재진입(함수가 자기 자신이 막은 트리거를 뚫어야 함)이지만, 호출자가 하나뿐이고 트리거 체인이 단순(sessions AFTER UPDATE → trial_sessions UPDATE 1회)하다. |
| 5. 안전한 대체(확정, 3차 개정 — `completed_at` 동시 검증 추가) | **조건 재검증 방식으로 트리거 재작성**(방식 a의 변형 — "누가 호출했는가"가 아니라 "이 UPDATE를 정당화하는 조건이 지금 실제로 참인가"로 검사 축을 바꾼다). `reject_direct_trial_session_completion()`(가칭, 실제로는 기존 가드 트리거를 재작성)이 GUC나 호출자 식별에 의존하는 대신, `trial_sessions` UPDATE가 `status → 'completed'`로 바뀌는 시도일 때 트리거 내부에서 **두 조건을 모두** 확인한다: (1) 이 trial_session에 연결된 `sessions` 행의 `final_status`가 실제로 `'completed'`인가(직접 재조회), (2) 이 UPDATE 문 자체가 `completed_at`을 **동시에 non-null로** 채우는가(`new.completed_at is not null`). 둘 다 참이어야 통과 — 하나라도 거짓이면 거부. 이렇게 하면 "누가 호출했는지"를 위조 불가능하게 증명할 필요가 없어지는 동시에(캐스케이드 트리거든 다른 어떤 경로든, 결과적으로 링크된 세션이 실제로 completed 상태일 때만 통과), "상태만 completed로 바뀌고 완료 시각은 비어 있는" 불완전한 행도 트리거 하나로 함께 막는다 — 별도 컬럼 검사 트리거를 추가하지 않고 같은 조건문에 합쳐 원자적으로 강제. 이 방식을 택한 이유: 유일 호출자·단일 캐스케이드라 토큰 인프라는 과설계이고, "결과 조건 검증"(연결 세션 상태 + 컬럼 동시성) 두 가지만으로 충분히 안전하다. |
| 5-1. 테스트 시나리오(3차 개정 — ⑤⑥⑦⑧로 재구성, ③은 새 불변식으로 대체) | ① `sessions.final_status`가 실제로 `completed`로 바뀌었을 때 연결된 `trial_sessions.status`가 자동으로 `completed`가 되고 `completed_at`도 같은 UPDATE에서 함께 채워지는 정상 캐스케이드 확인(정상 자동 완료). ② 링크된 세션이 아직 `completed`가 아닌 상태에서 `trial_sessions.status`를 직접 `completed`로 UPDATE 시도 시 거부 확인(미완료 세션 직접 완료 차단) — `authenticated`뿐 아니라 **관리자(`is_admin()` 통과 role)와 `service_role` 직접 연결로도** 각각 시도하고 전부 거부되는지 확인(역할 무관성 — 조건 재검증은 role/게이트를 보지 않고 연결 세션의 실제 상태만 보므로 관리자·service_role의 "지름길"도 예외 없이 막혀야 한다). ③ **(3차 개정으로 대체됨 — 이전 판 "완료 세션이면 completed_at 없이도 통과"는 더 이상 허용하지 않는다)** 링크된 세션이 이미 `completed`인 상태에서 `trial_sessions.status`를 `completed_at` 없이(또는 `completed_at`을 null로) 직접 UPDATE 시도 — **거부**되는지 확인(완료 세션이더라도 `completed_at` 없는 직접 완료 차단 — 조건 (1)은 참이지만 조건 (2)가 거짓이므로 트리거가 거부해야 하는 핵심 신규 케이스). ④ 링크된 세션이 이미 `completed`인 상태에서 `trial_sessions.status`와 `completed_at`을 **함께** 채우는 직접 UPDATE는 통과되는지 확인(완료 시각을 포함한 완료 처리 성공 — 호출자 자체는 여전히 미검증이므로 GUC 방식과 동일한 노출 수준임을 문서화, 회귀 아님). ⑤ 캐스케이드가 여러 trial_sessions에 연쇄적으로 걸리는 경우(있다면) 모두 정상 처리되는지 확인. |
| 6. 수정 대상 / Preview 게이트 | `auto_complete_linked_trial_session()` + trial_sessions 보호 트리거 재작성 + 회귀 테스트. **Preview/non-prod 반영 전 필수 — 하드 블로커("세션 불변식"을 trial_sessions까지 포함해 넓게 해석 — 제품 오너 지시 원문의 5개 카테고리 중 세션 불변식 범주에 속하는 것으로 확정.** |

## Preview/non-prod 게이트

제품 오너 표준 지시: "세션 불변식·동의·계정 상태·초대·정산 관련 항목은 Preview나
non-prod 반영 전에 별도 보안 정리 라운드로 반드시 닫아야 한다."

| GUC | 게이트 해당 여부 | 근거 |
|---|---|---|
| `bypass_session_lock` | **하드 블로커** | "세션 불변식"에 정확히 해당 |
| `bypass_consent_protect` | **하드 블로커** | "동의"에 정확히 해당 |
| `bypass_status_protect` | **하드 블로커** | "계정 상태"에 정확히 해당 |
| `bypass_invite_protect` | **하드 블로커** | "초대"에 정확히 해당 |
| `bypass_teacher_rate_protect` | **하드 블로커** | 시급 이력은 정산(강사 지급액)의 직접 입력값 — "정산 관련 항목"에 해당 |
| `bypass_reconciliation_task_lock` | **하드 블로커** | `entitlement_ledger`/`payout_items`(R10 payout 파이프라인, 이미 구현·가동 확인됨)에 직접 영향을 주는 정산 파이프라인 단계로 확인됨 — "정산 관련 항목"에 해당 |
| `bypass_trial_session_auto_complete` | **하드 블로커** | "세션 불변식"을 trial_sessions까지 포함해 넓게 해석 — blast radius가 작다는 것은 착수 순서(배치 1, 가장 마지막)에는 반영하되 게이트 제외 사유는 아님 |

**7개 전부 Preview/non-prod 반영 전 하드 블로커** — 잠정/조건부 분류는 없다.

## 미완료/잔여 확인 사항

이번 라운드의 목표(초안의 "결정 필요" 3개 항목을 실제 코드로 확정)는 모두
달성됐다 — `bypass_status_protect`의 8개 SET 호출부 게이트, `task8_capability_gates.sql`의
목적, `claim_account_invite`의 토큰 인가 방식 전부 실제 최신 함수 본문을 읽어
확정 결론을 냈다(위 각 절의 "확정" 표시 항목 참고). 코드 조사 관점에서 남은
모호성은 없다.

## 결정 필요 (제품 오너 확인 요청 — 순수 정책/우선순위 판단만)

이번 개정에서 투자 조사로 해소 가능한 항목은 전부 해소했으므로, 아래는
코드를 더 읽어도 답이 나오지 않는 순수 비즈니스 판단만 남긴다.

1. **`bypass_session_lock`의 구조 재설계(항목 1-5) 착수 시점** — 배치 2의
   마지막 항목으로 제안했으나, 두 불변식을 분리하는 스키마 변경(신규 테이블)
   자체가 다른 세 배치-2 항목(공용 토큰 인프라 재사용)보다 별도 설계이므로,
   배치 2 안에서 이 항목만 별도 스프린트로 분리할지 병렬 진행할지는 리소스
   배정 문제 — 제품 오너/팀 일정 판단 필요.

## 2차 개정에서 내린 판단 콜(제품 오너 메시지가 명시하지 않은 세부 설계 선택)

제품 오너의 지시("권한으로 보호되는 1회용 DB 토큰을 사용하되, 토큰에는
최소한 대상 행, 허용 작업, 트랜잭션 식별자를 묶고")는 토큰의 **형태**(대상 행 +
허용 작업 + xact id)만 못박았고, 그 토큰을 **어느 테이블에 담을지**는 이 문서의
판단에 맡겼다. 두 옵션을 저울질했다:

- **(채택) 기존 `status_transition_tokens` 테이블을 `action` 컬럼으로 확장해
  재사용** — `bypass_status_protect`/`bypass_invite_protect`/
  `bypass_reconciliation_task_lock`이 이미 이 테이블을 다중 호출자 공유 토큰
  용도로 쓸 예정이었고, 그 테이블의 스키마(`table_name`, `row_id`, `xact_id`)가
  이미 "대상 행 + 트랜잭션 식별자"를 갖추고 있었다 — `action` 컬럼 하나만
  추가하면 "허용 작업" 축도 채워져 제품 오너가 명시한 토큰 형태와 정확히
  일치한다. 관리 포인트(테이블 하나, GRANT/REVOKE 잠금 정책 하나, 확인/소비
  헬퍼 하나)가 줄고, 배치 1과 배치 2 전체 5개 GUC가 같은 인프라·같은 감사
  경로를 공유하게 된다.
- **(기각) 이 두 건 전용 별도 테이블(예: `single_caller_action_tokens`)** —
  "다중 호출자 vs 단일 호출자"라는 개념적 구분은 명확해지지만, 테이블·트리거
  헬퍼·GRANT/REVOKE 잠금 정책을 사실상 동일하게 하나 더 만들어야 해서
  관리 포인트만 늘어난다. 단일/다중 호출자 구분은 `action` 값 자체(예:
  `'revoke_consent'`는 호출자가 하나, `'status_transition'`은 여럿)로도
  충분히 드러나므로, 테이블을 나눌 실익이 없다고 판단했다.

이 선택은 순수 설계 판단이라 위 "결정 필요" 섹션에는 넣지 않았지만, 제품
오너가 반대 방향(전용 테이블)을 선호하면 스키마 변경 없이(트리거 로직만)
쉽게 되돌릴 수 있는 결정이라는 점을 밝혀둔다.
