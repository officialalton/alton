# bypass GUC 보안 정리 계획 (2026-09-08, 계획 전용 — 코드/마이그레이션 변경 없음)

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
공통 결론이었다. 이번 7건은 성격이 갈린다: 몇몇은 동일하게 "분기 삭제로
충분"하지만, 최소 2건(`bypass_session_lock`, `bypass_trial_session_auto_complete`)은
정말로 같은 함수/트리거 체인 내부에서 "내가 막 쓴 행을 내가 다시 건드려야
한다"는 재진입(reentrancy) 요구가 있어 보이며, 대체재는 GUC가 아닌 다른
메커니즘(아래 항목5)이어야 한다.

## 우선순위 표 (지정된 순서: session_lock → consent → status → invite → teacher_rate)

### 1. `bypass_session_lock`

| 항목 | 내용 |
|---|---|
| 1. 보호 테이블·불변식 | `sessions`(`sessions_v3` → R6 cutover로 개명) 두 개의 서로 다른 불변식을 **같은 GUC 이름**으로 보호한다: (a) `final_status`가 `scheduled`/`live`를 벗어난 뒤에는 `reopen_session()`/`recomplete_session()`을 통해서만 바뀔 수 있다(`prevent_direct_final_status_update()`, `20260830040000_r1_reservation_session.sql`, R6 cutover 후 `20260928000000_r6_sessions_cutover.sql`에서 재정의), (b) 세션이 시작(`final_status <> 'scheduled'`)되거나 완료된 뒤에는 `material_version_id`를 재배정할 수 없다(`prevent_material_version_reassignment()`, `20261219000000_r8_material_version_lock.sql`). |
| 2. 실제 SET 호출 경로 | `reopen_session(p_session_id, p_reason)`과 `recomplete_session(...)` 내부에서만 `perform set_config('app.bypass_session_lock', 'true', true)` 호출 — 둘 다 함수 시작부에서 `if not public.is_admin() then raise exception`으로 게이트한 뒤 `final_status`를 되돌리는 UPDATE 직전에 켠다. R6 cutover(`20260928000000_r6_sessions_cutover.sql`)가 이 두 함수를 `sessions_v3`에서 `sessions`로 재정의하면서 동일 패턴을 그대로 옮겼다. 앱 서버 액션이나 cron/웹훅에서 이 GUC를 직접 SET하는 코드는 repo 전체 grep(`app/`, `lib/`)에서 발견되지 않았다 — 유일한 SET 호출자는 이 두 SECURITY DEFINER 함수 자신이다. 통합 테스트(`app/session/[id]/r8-cutover.integration.test.ts`)는 `set_config('app.bypass_session_lock', ...)`를 fixture 정리용으로 직접 psql/superuser 경로에서 쓰고 있다(정확히 우회 가능성을 이용하는 코드). |
| 3. 도달 가능성 | `authenticated`: `reopen_session`/`recomplete_session`은 `authenticated`에 GRANT돼 있지만 함수 본문의 `is_admin()` 검사가 실질 관문이라 일반 사용자는 함수를 호출해도 즉시 거부된다 — **직접 GUC를 SET할 권한 자체가 없고**(트리거 함수는 `revoke ... from public, anon, authenticated, service_role`), GUC 이름 자체에 대한 접근 제어도 없으므로 `authenticated` 세션이 임의 SQL을 실행할 수 있는 다른 취약점(예: SQL 인젝션)과 결합하면 이 GUC를 직접 SET하고 자기 세션의 UPDATE를 통과시킬 수 있다 — 트리거 자체는 role을 구분하지 않는다. 관리자(admin) 계정도 `authenticated`이므로 동일 카테고리이나 `is_admin()`을 통과하는 유일한 정상 그룹. Service role: RLS를 완전히 우회하고 커스텀 GUC 접근 제어도 없으므로, 어떤 service_role 연결(운영 스크립트, 백엔드 job)이든 `SET`만으로 `final_status`/`material_version_id` 불변식을 무력화할 수 있다 — 이것이 90d7012/6f292cc/876b30a와 동일한 핵심 위험. SECURITY DEFINER: `reopen_session`/`recomplete_session` 자신이 SECURITY DEFINER이고 이들이 이 GUC의 유일한 정상 호출자이지만, **다른 어떤 SECURITY DEFINER 함수든** 함수 소유자 권한으로 이 이름을 SET할 수 있다는 점은 동일 — GUC가 함수 경계를 특정하지 않는다. |
| 4. 깨질 정상 흐름 | `reopen_session()`은 `completed → live` 전이를 기록한 뒤 그 UPDATE를 성공시키기 위해 자기 자신의 `prevent_direct_final_status_update` 트리거를 통과해야 한다 — 이건 **진짜 재진입 요구**(자기 트랜잭션 안에서 자기가 막은 트리거를 다시 통과해야 함)다. 단순 삭제로는 안 된다: 90d7012/6f292cc/876b30a와 달리 여기서는 "우회가 필요 없었다"가 성립하지 않는다(정상 관리자 재개방/재확정 기능 자체가 그 UPDATE를 필요로 함). 또한 `bypass_session_lock`이 두 트리거(final_status 락 + material_version_id 락)에 공유되므로, `reopen_session()`이 켜는 동안에는 **의도치 않게 material_version_id 락도 함께 풀린다** — 같은 트랜잭션 안에서 다른 코드가 `material_version_id`를 바꾸는 UPDATE를 끼워 넣으면 통과해버리는 부작용 경로가 이론상 존재한다(현재 두 함수 본문에는 그런 UPDATE가 없어 실사용 피해는 없어 보이지만, GUC 재사용 자체가 설계 결함). |
| 5. 안전한 대체 | GUC 대신 "이 UPDATE가 `reopen_session`/`recomplete_session` 함수 본문 내부에서 나온 것"임을 구조적으로 위조 불가능하게 표시해야 한다. 제안: 트리거를 없애고 **UPDATE 권한 자체를 구조적으로 제한**하는 방향 — `sessions.final_status`/`material_version_id`에 대한 직접 UPDATE 권한을 아예 어떤 role에도 주지 않고(이미 RLS/grant로 사실상 막혀있다면 트리거가 불필요할 수도 있음, 확인 필요), 상태 전이는 오직 `reopen_session`/`recomplete_session`이 **트리거를 거치지 않는 내부 경로**(예: 같은 함수 안에서 `session_status_events`에만 쓰고 `sessions` 갱신은 별도의 `perform pg_advisory_xact_lock` + "이 세션이 지금 이 트랜잭션 안에서 함수 호출로 잠겨 있다"를 별도 테이블(예: `session_lock_tokens(session_id, xact_id)`)에 남기는 1회용 토큰 방식)으로 처리하게 재구성. 더 간단한 대안: 트리거 함수를 두 개로 분리하지 않고, `prevent_direct_final_status_update()`가 GUC 대신 **`pg_trigger_depth()`와 결합한 호출자 식별**은 여전히 위조 가능하므로 안전하지 않다 — 결국 "GUC를 없애고 함수 본문에서 직접 `alter table ... disable trigger`를 세션 트랜잭션 안에서 쓰는 것"도 슈퍼유저 권한이 필요해 일반 SECURITY DEFINER 함수 소유자로는 못 한다는 점을 이용해, **트리거 자체의 owner 권한을 이용한 재정의**(예: 함수 소유자만 실행 가능한 `perform pg_catalog.set_config`가 아니라, UPDATE 문 자체를 트리거가 없는 별도 unlogged/internal 테이블에 먼저 쓰고 뷰로 노출하는 구조 변경)까지 고려해야 한다 — 이 각도는 스키마 재구성 비용이 커서, **다음 라운드에서 반드시 재검토가 필요한 항목**으로 표시한다(결정 필요, 아래 참고). |
| 6. 수정 대상 / Preview 게이트 | 신규 corrective migration이 `prevent_direct_final_status_update()`, `prevent_material_version_reassignment()`, `reopen_session()`, `recomplete_session()`(R6 cutover 버전 포함) 전부를 함께 고쳐야 한다(GUC 이름 공유 때문에 분리 수정 불가). `r8-cutover.integration.test.ts`의 GUC 기반 fixture 정리 코드도 함께 손봐야 한다. **Preview/non-prod 반영 전 필수 — 세션 최종 상태 불변식은 제품 오너 지시("세션 불변식... 반드시 닫아야 한다")에 명시적으로 해당.** |

### 2. `bypass_consent_protect`

| 항목 | 내용 |
|---|---|
| 1. 보호 테이블·불변식 | `guardian_consents`. DELETE는 항상 금지. UPDATE는 철회 관련 3개 필드(`revoked_at`, `revoked_by`, `revocation_reason`)만 허용되고 나머지(동의 당시 기록 — `policy_version_id`, `consented_by`, `consented_at`, `verification_method`, `verification_reference`, `notice_delivered_at`)는 절대 불변이어야 한다("당시 무엇에 동의했는지" 사후 증명용). |
| 2. 실제 SET 호출 경로 | `revoke_guardian_consent(p_consent_id, p_reason)` 내부에서만, 철회 UPDATE 직전/직후에 켜고 끈다(`20260904000000_r2_minor_consent.sql`). 다른 SET 호출자는 repo 전체에서 발견되지 않음. |
| 3. 도달 가능성 | `authenticated`: `revoke_guardian_consent`는 호출 전 `is_admin() or (auth.uid() = consented_by and 활성 보호자)` 검사를 통과해야 하며, 함수 자체가 SECURITY DEFINER라 일반 `authenticated`는 GUC를 직접 SET할 권한이 없다(트리거 함수는 role 제한 없음 — `current_setting`은 누구나 읽을 수 있고 `set_config`도 커스텀 GUC라 REVOKE 대상이 아니므로 임의 SQL 실행 경로가 있다면 authenticated도 이론상 SET 가능). 관리자: `is_admin()`을 통과하는 유일한 정상 관리 경로. Service role: RLS 우회 + GUC 접근 제어 없음 → 동일 위험. SECURITY DEFINER: `revoke_guardian_consent` 자신 외에 다른 SECURITY DEFINER 함수가 이 이름을 재사용하면 동일 위험. |
| 4. 깨질 정상 흐름 | `revoke_guardian_consent()`는 철회 3개 필드만 갱신하는 단일 UPDATE 문 하나만 필요로 한다 — reopen_session류처럼 여러 단계 상태 전이를 거치는 재진입이 아니라 "이 함수가 스스로 만든 자기 자신의 UPDATE 한 줄"이다. 90d7012/6f292cc/876b30a 패턴과 훨씬 가깝다: 트리거가 애초에 "철회 3필드 변경은 항상 허용, 나머지 필드 변경만 차단"하도록 재작성하면 GUC 없이도 같은 보호를 유지하면서 `revoke_guardian_consent()`의 UPDATE를 그냥 통과시킬 수 있다(그 UPDATE 자체가 철회 3필드만 건드리므로). |
| 5. 안전한 대체 | GUC 분기를 완전히 삭제하고, 트리거 조건을 뒤집는다: "동의 당시 기록 8개 필드 중 하나라도 바뀌면 무조건 거부"만 남기고 "그 외(철회 3필드만 바뀌는 경우)는 무조건 통과"로 재작성 — 이러면 `revoke_guardian_consent()`가 GUC 없이도 정상 작동하고, 어떤 다른 호출자도(서비스 롤 포함) 동의 당시 기록은 여전히 못 바꾼다. 유일한 남는 구멍은 "철회 3필드를 revoke_guardian_consent()를 거치지 않고 직접 UPDATE"이지만, 이는 GUC 문제가 아니라 원래도 있던 별도 이슈(트리거가 애초에 호출자를 구분하지 않으므로) — 필요하면 철회 3필드 UPDATE도 `is_admin() or 본인 보호자` 조건을 트리거 안에 직접 넣어(`auth.uid()` 검사) GUC 없이 막을 수 있다. |
| 6. 수정 대상 / Preview 게이트 | `protect_guardian_consent()` 재작성 + `revoke_guardian_consent()`에서 `set_config` 호출 제거 + 회귀 테스트(정상 철회 통과 확인, 동의 당시 필드 직접 UPDATE 시도 거부 확인, service_role 경유 GUC 무력화 확인). **Preview/non-prod 반영 전 필수 — "동의" 항목으로 제품 오너 지시에 명시적으로 해당.** |

### 3. `bypass_status_protect`

| 항목 | 내용 |
|---|---|
| 1. 보호 테이블·불변식 | 여러 테이블의 `status` 컬럼(`students`/`account_status_apply` 대상 — `20260831011000_r2_account_status_apply.sql`) — "허용된 전이만, `transition_account_status()`를 통해서만" 규칙. `20260904000000_r2_minor_consent.sql`, `20260908000000_r2_teacher_reactivation_gate_fix.sql`, `20260903010000_r2_account_merge.sql`, `20260905000000_r2_workspace_provisioning.sql`, `20260909000000_r2_task8_capability_gates.sql`, `20260911000000_r3_contracts_cutover.sql`, `20260928000000_r6_sessions_cutover.sql` 등 다수 마이그레이션이 이 **같은 GUC 이름**을 자기 자신의 상태 전이 함수 안에서 재사용한다 — 즉 하나의 GUC가 시간이 지나며 계정/초대/계약/세션 등 서로 다른 여러 테이블·트리거를 보호하게 커졌다. |
| 2. 실제 SET 호출 경로 | 위 8개 마이그레이션 파일 전부에서 `set_config('app.bypass_status_protect', 'true'/'false', true)` 쌍이 각 상태 전이 함수(가입/재활성화/합병/프로비저닝/캐퍼빌리티/계약 cutover/세션 cutover) 내부에 흩어져 있다 — grep 결과 총 14회 SET 호출(파일 7개, 각 2회 이상). 이렇게 호출자가 많다는 것 자체가 "GUC 하나로 여러 무관한 도메인을 보호"하는 설계가 이미 관리 불가능해지고 있다는 신호. |
| 3. 도달 가능성 | `authenticated`: 트리거 함수 자체는 role을 구분하지 않고, 각 상태 전이 함수(`transition_account_status()` 등)가 개별적으로 `is_admin()`류 검사를 하는 것으로 보이나(각 함수 본문 확인 필요 — 아래 "결정 필요" 참고, 8개 파일 전부의 grant/게이트를 이번 라운드에서 전수 확인하지 못함), GUC 자체에는 어떤 접근 제어도 없다. 관리자: 정상 경로. Service role/SECURITY DEFINER: RLS 우회 + GUC 무방비로 동일 위험, 특히 8개의 서로 다른 함수가 같은 GUC를 켜고 끄므로 그중 하나라도 트랜잭션 중간에 예외 없이 끄기(`'false'`)를 실행하지 못하고 종료되면(예외/조기 return) 그 트랜잭션이 커밋될 때까지 다른 무관한 코드의 `status` UPDATE까지 우연히 통과할 위험도 있다(트랜잭션 로컬이라 커밋 후엔 사라지지만, 같은 트랜잭션 안에서는 위험). |
| 4. 깨질 정상 흐름 | 8개 파일 각각의 함수가 "자기 자신이 계산한 허용된 전이"를 그 자리에서 한 번 UPDATE해야 하는 재진입 — `bypass_consent_protect`와 같은 유형(단일 UPDATE, 다단계 아님)이지만 관여 함수가 8개로 훨씬 많다는 점이 다르다. |
| 5. 안전한 대체 | 근본적으로는 `bypass_consent_protect`와 동일한 해법(트리거를 "이 필드 조합으로 UPDATE되는 경우만 허용"으로 재작성)이 이상적이지만, 8개의 서로 다른 함수·서로 다른 허용 전이 규칙을 트리거 하나에 다 인코딩하는 것은 트리거를 지나치게 복잡하게 만든다. 더 현실적인 대안: **테이블 기반 1회용 토큰** — 각 상태 전이 함수가 UPDATE 직전에 `insert into status_transition_tokens (table_name, row_id, expected_new_status, created_in_xact) values (...)`로 자기 자신만 아는 토큰을 심고, 트리거가 GUC 대신 그 토큰 행의 존재 + `txid_current()` 일치를 확인한 뒤 즉시 그 토큰 행을 delete — 이러면 GUC처럼 "이름만 알면 아무나 켤 수 있는" 문제가 없다(토큰은 매 호출 새로 발급되는 값이라 추측 불가하고, 테이블 INSERT/DELETE 권한은 정상적으로 GRANT/REVOKE 대상이 된다). 이 방식을 `bypass_status_protect`뿐 아니라 다른 다중-호출자 GUC(`bypass_invite_protect`, `bypass_reconciliation_task_lock`)에도 공통 인프라로 재사용할 것을 제안. |
| 6. 수정 대상 / Preview 게이트 | 8개 파일에 흩어진 함수 전부 + `protect_account_status()` 트리거 + (제안대로면) 신규 `status_transition_tokens` 테이블/헬퍼 함수 + 각 전이 함수별 회귀 테스트. 범위가 가장 넓은 항목이므로 별도 하위 스파이크(어느 함수가 실제 최신 버전인지 먼저 확정 — 같은 함수가 여러 마이그레이션에서 `create or replace`로 계속 재정의됨)가 선행돼야 한다. **Preview/non-prod 반영 전 필수 — "계정 상태" 항목으로 제품 오너 지시에 명시적으로 해당.** |

### 4. `bypass_invite_protect`

| 항목 | 내용 |
|---|---|
| 1. 보호 테이블·불변식 | `account_invites.status` — "지정된 함수(create/resend/accept/finalize/revoke)를 통해서만 변경"(`20260902000000_r2_account_invites.sql`). `account_invite_events`는 append 전용 로그(직접 보호 트리거는 없으나 invites와 항상 같은 트랜잭션에서 함께 쓰임). |
| 2. 실제 SET 호출 경로 | `create_account_invite`, `resend_account_invite`, `revoke_account_invite`, `claim_account_invite`(**anon 포함 GRANT**), `finalize_account_invite`(service_role 전용), `mark_expired_invites`(`is_admin()` 게이트) — 6개 함수, `20260902000000_r2_account_invites.sql`에 5곳, `20260909000000_r2_task8_capability_gates.sql`에 추가 4곳(캐퍼빌리티 게이트가 초대 상태를 다시 건드리는 것으로 보임 — 정확한 목적은 해당 파일의 캐퍼빌리티 로직을 더 읽어야 확정 가능, 결정 필요 항목으로 아래 표시). |
| 3. 도달 가능성 | `authenticated`: `create/resend/revoke_account_invite`는 `authenticated`에 GRANT — 함수 내부 게이트(초대 발송자 본인/관리자 확인으로 추정, 각 함수 본문 전수 확인은 이번 라운드에서 생략)가 실질 방어선. anon: `claim_account_invite`가 `anon, authenticated`에 GRANT돼 있고, 이 함수는 role 기반이 아니라 **토큰 해시 검증**으로 인가한다 — 즉 "role 검사가 없는 게 아니라 다른 종류의 인가(소유 토큰 증명)"이므로 다른 6개 GUC와 위험 성격이 다르다(로그인 전 사용자가 유효한 초대 토큰을 갖고 있다는 것 자체가 인가). 관리자: `mark_expired_invites`는 `is_admin()` 게이트 확인됨. Service role: `finalize_account_invite`는 `service_role`에만 GRANT — Node 서버 액션이 Auth 사용자 생성 후 호출하는 2단계 완료 함수로 추정(파일명·주석상). RLS 우회 경로 전반에는 여전히 GUC 자체의 무방비가 동일하게 적용됨. |
| 4. 깨질 정상 흐름 | 6개 함수 각각이 자기 자신의 단일(또는 소수) `status` UPDATE를 위해 재진입한다 — `bypass_consent_protect`/`bypass_status_protect`와 같은 유형. `claim_account_invite`는 트랜잭션 안에서 최대 2번(가입 진행 중 재확인 시나리오 포함) 켜고 끄는 것이 확인됨. |
| 5. 안전한 대체 | `bypass_status_protect` 항목에서 제안한 **테이블 기반 1회용 토큰** 방식이 여기서도 그대로 적용 가능 — 각 함수가 UPDATE 직전 자기만 아는 토큰을 발급하고 트리거가 토큰 존재+트랜잭션 일치만 확인. 대안으로 더 간단한 경로: 6개 함수가 만드는 상태 전이 집합(`pending→accepted`, `pending→manual_review`, `pending→expired`, `pending→revoked` 등)이 유한하고 트리거에서 `old.status`/`new.status` 조합만으로 "이 전이가 애초에 유효한 전이인지"를 검증할 수 있다면(즉 "누가 바꿨는지"가 아니라 "이 전이 자체가 상태 기계상 합법적인지"로 규칙을 바꾸면), GUC도 토큰도 필요 없이 **트리거가 상태 기계 자체를 검증**하는 구조로 단순화할 수 있다 — 다만 이러면 "정해진 함수를 거쳤는가"가 아니라 "결과 상태 조합이 합법적인가"만 보장되므로 감사 이벤트(`account_invite_events`) insert를 빼먹고 직접 UPDATE하는 것까지는 못 막는다(별도 문제, GUC 범위 밖). |
| 6. 수정 대상 / Preview 게이트 | `protect_account_invite_status()` + 6개 함수 + `20260909000000_r2_task8_capability_gates.sql`의 추가 4개 SET 호출(먼저 그 정확한 목적 확인 필요) + 회귀 테스트(anon 토큰 경로, 관리자 경로, service_role 무력화 확인 포함). **Preview/non-prod 반영 전 필수 — "초대" 항목으로 제품 오너 지시에 명시적으로 해당.** |

### 5. `bypass_teacher_rate_protect`

| 항목 | 내용 |
|---|---|
| 1. 보호 테이블·불변식 | `teacher_rate_history` — DELETE 항상 금지. UPDATE는 오직 `set_teacher_rate()`가 기존 "현재 이력"을 종료(`effective_until` 설정)하는 단일 문장만 허용, 그 외 모든 직접 UPDATE(`effective_until` 단독 변경 포함, 관리자 포함)는 차단 — "이력은 종료+신규가 같은 트랜잭션에서 원자적으로만" 규칙. |
| 2. 실제 SET 호출 경로 | `set_teacher_rate()` 내부에서만(원본 `20260830100000_r1_teacher_rate_integrity.sql` 최초 도입 후 `20260830110000_r1_teacher_rate_integrity_fix.sql`이 게이트를 강화, `20260831000000_r2_sync_teachers_hourly_rate.sql`이 `teachers.hourly_rate_krw` 동기화를 추가하며 함수를 다시 `create or replace` — 세 버전 모두 동일한 GUC SET 위치·패턴 유지). |
| 3. 도달 가능성 | `authenticated`/`anon`: `set_teacher_rate()`는 `revoke ... from public, anon, authenticated` + `grant ... to service_role`만 — 일반 사용자·관리자 화면에서 직접 호출 불가(이미 다른 GUC들보다 좁게 잠겨 있음). 관리자: 관리자 UI가 있다면 반드시 서버 액션이 service_role 클라이언트를 통해 이 함수를 호출하는 구조로 추정(직접 확인은 안 함 — `app/admin` 쪽 호출부 확인이 결정 필요 항목). Service role: 유일한 정상 호출 경로이면서 동시에 유일한 위험 경로 — service_role 연결이면 어차피 이 함수 없이도 `teacher_rate_history`에 직접 아무 값이나 INSERT/UPDATE 시도 가능(RLS 우회), GUC 유무와 무관하게 service_role 자체가 이미 가장 강한 신뢰 경계라는 점은 다른 6개보다 상대적으로 덜 심각한 요인. SECURITY DEFINER: `set_teacher_rate` 자신 외 다른 함수가 이 GUC명을 재사용하면 위험 — grep 결과 재사용 없음(2개 마이그레이션 버전만 존재, 실질적으로 한 곳). |
| 4. 깨질 정상 흐름 | `set_teacher_rate()`는 기존 이력 종료(`effective_until` UPDATE) 후 새 이력 INSERT — 재진입은 그 UPDATE 한 줄뿐이고 함수 자신이 방금 `for update`로 잠근 정확히 그 행만 건드린다. `bypass_consent_protect`와 매우 유사한 단일-UPDATE 재진입 유형. |
| 5. 안전한 대체 | `bypass_consent_protect`와 동일한 해법 적용 가능: 트리거를 "이 UPDATE가 `effective_until`만 바꾸고 다른 보호 필드는 그대로인가"로 이미 검사하고 있으므로(코드에 이미 그 로직 존재), GUC 분기를 없애고 그 필드 검사만 무조건 적용하도록(즉 "`effective_until`만 바뀌는 UPDATE는 항상 허용, 그 외 필드가 바뀌면 항상 거부") 재작성하면 `set_teacher_rate()`가 GUC 없이 통과한다. 단, 이러면 `set_teacher_rate()`를 거치지 않고 아무나(service_role 등) `effective_until`만 직접 UPDATE하는 것도 막지 못하게 되는데, 이는 GUC를 켠 상태에서도 원래 막지 못했던 것과 동일한 노출 수준(현재도 `bypass_teacher_rate_protect`를 아는 누구나 같은 UPDATE를 할 수 있음)이므로 순보안 측면에서 후퇴가 아니다. |
| 6. 수정 대상 / Preview 게이트 | `protect_teacher_rate_history()` 재작성 + `set_teacher_rate()`(최신 버전, R2 sync 포함)에서 `set_config` 호출 제거 + 회귀 테스트. service_role 전용 함수로 이미 좁게 잠겨 있어 상대적으로 저위험이지만, 정산 관련 인접 데이터(시급)라는 점을 고려해 **Preview/non-prod 반영 전 필수로 포함할 것을 권고**(제품 오너 지시 문구가 "정산 관련 항목"을 명시하는데, 시급 자체는 정산의 입력값이므로 좁게 해석해도 해당 가능성이 높음 — 결정 필요 항목으로 아래 표시). |

## 별도 분류: settlement/trial 계열 2건

### `bypass_reconciliation_task_lock` — 위험도: 중간, 선행 조건 있음

- **보호 대상**: `session_judgment_reconciliation_tasks` — `resolve_session_reconciliation_task()`를 통해서만 UPDATE 가능(DELETE는 무조건 금지, GUC 무관).
- **호출 경로**: `20261105000000_m5b_judgment_reconciliation_tasks.sql`(원본) 외에 `20261122000000_m5c_reconciliation_task_staleness.sql`, `20261123000000_m5c_student_cancelled_reconciliation.sql`, `20261124000000_m5c_final_reconciliation_integrity_gaps.sql` 등 M5c 라운드에서 새 정산 조정 함수들이 계속 이 GUC를 재사용하며 늘어났다(grep상 총 14회 SET) — `bypass_status_protect`처럼 "여러 함수가 같은 GUC를 공유"하는 유형이라 범위가 넓다.
- **위험도 판단 근거**: 정산(판정/이의제기 처리) 도메인은 금전적 영향이 있어 원칙적으로 우선순위가 높아야 하지만, 이 태스크 테이블 자체는 "정산 최종 원장"이 아니라 "조정 작업 큐"(M5b/M5c, R10 정산 원장 이전 단계)로 보인다 — 실제 지급액에 영향을 주는 최종 원장 테이블(R10 payout 파이프라인, 아직 이 저장소에 도달하지 않은 것으로 보임 — `docs/CURRENT.md`에 R10 착수 여부 재확인 필요, 결정 필요)과의 관계를 먼저 확인해야 "정산 관련 항목" 해당 여부와 긴급도를 정확히 매길 수 있다.
- **선행 조건**: (1) M5c의 4개 파일 중 어느 것이 각 함수의 최종 버전인지 정리, (2) R10 payout 파이프라인이 이 태스크 큐를 최종 지급 계산의 입력으로 실제로 소비하는지 확인 — 소비한다면 우선순위 표의 정산 항목과 동급으로 격상해야 함.
- **잠정 권고**: R10 착수/의존관계 확인 전까지는 "정산 관련"으로 잠정 상위 5개와 함께 Preview 게이트에 포함하되(제품 오너 지시가 "정산 관련 항목"을 명시하므로 보수적으로 포함), 실제 corrective 작업 착수 순서는 위 확인 이후 재조정.

### `bypass_trial_session_auto_complete` — 위험도: 낮음, 순수 내부 시스템 캐스케이드

- **보호 대상**: `trial_sessions.status`의 직접 `completed` 전환 금지 — "실제 v3 세션이 완료됐을 때만 자동 반영".
- **호출 경로**: 유일하게 `auto_complete_linked_trial_session()` 트리거 함수(AFTER UPDATE on `sessions`, `final_status = 'completed'`) 내부 — **사람이나 서버 액션이 직접 호출하는 함수가 아니라 DB 내부 캐스케이드 트리거**다. 다른 6개는 전부 사람이 트리거하는(관리자 조작, 사용자 요청, 서버 액션) SECURITY DEFINER 함수인 반면, 이것만 순수 시스템 이벤트 반응형이라는 점이 성격상 다르다.
- **위험도 판단 근거**: 도달 가능성 측면에서 `authenticated`/anon이 이 GUC를 켤 이유·경로가 없고(그런 코드 경로 없음), service_role/SECURITY DEFINER 경로로 봐도 이 GUC 하나가 잘못 켜졌을 때 벌어지는 최악의 결과가 "체험 세션이 실제로는 안 끝났는데 완료로 표시"되는 정도로, 결제/정산/개인정보 관련 항목보다 blast radius가 작다.
- **재진입 성격**: `bypass_session_lock`과 유사하게 "함수가 자기 자신이 막은 트리거를 뚫어야 하는 진짜 재진입"이지만, 호출자가 하나뿐이고 트리거 체인이 단순(sessions AFTER UPDATE → trial_sessions UPDATE 1회)해서 대체재 설계가 `bypass_session_lock`보다 훨씬 쉽다: `reject_direct_trial_session_completion()`을 "이 UPDATE가 `sessions.final_status='completed'`인 연결된 세션 때문에 발생한 것인지"를 `pg_trigger_depth() > 0`이 아니라 **호출자가 트리거 함수인지 자체를 GUC 없이 구분할 방법이 마땅치 않다는 점은 동일**하나, 대안으로 애초에 두 트리거를 하나의 함수로 합쳐(캐스케이드를 트리거 레벨에서 처리하지 않고 `sessions` AFTER UPDATE 트리거 안에서 `trial_sessions` UPDATE 시 별도 보호 트리거 자체를 이 컬럼에 대해서는 만들지 않고, "직접 UPDATE 금지"는 GRANT를 아예 안 주는 방식(트리거 대신 컬럼 권한)으로 대체 가능한지 검토할 가치가 있다.
- **선행 조건**: 없음(다른 회차에 의존하지 않는 독립 항목) — 우선순위 상으로는 낮지만 착수 자체는 언제든 가능.
- **잠정 권고**: Preview 게이트 하드 블로커는 아니라고 판단(아래 게이트 섹션 참고, 결정 필요로 재확인 요망).

## Preview/non-prod 게이트

제품 오너 표준 지시: "세션 불변식·동의·계정 상태·초대·정산 관련 항목은 Preview나
non-prod 반영 전에 별도 보안 정리 라운드로 반드시 닫아야 한다."

| GUC | 게이트 해당 여부 | 근거 |
|---|---|---|
| `bypass_session_lock` | **하드 블로커** | "세션 불변식"에 정확히 해당 |
| `bypass_consent_protect` | **하드 블로커** | "동의"에 정확히 해당 |
| `bypass_status_protect` | **하드 블로커** | "계정 상태"에 정확히 해당 |
| `bypass_invite_protect` | **하드 블로커** | "초대"에 정확히 해당 |
| `bypass_teacher_rate_protect` | **잠정 하드 블로커(결정 필요)** | 지시문에 "시급"이 명시돼 있지 않으나 정산의 직접 입력값 — 좁게 해석하면 제외 가능, 넓게 해석하면 포함. 제품 오너 확인 전까지 보수적으로 포함 권고. |
| `bypass_reconciliation_task_lock` | **잠정 하드 블로커(결정 필요, R10 의존관계 확인 후 재조정)** | "정산 관련 항목"에 해당할 가능성이 높으나 이 태스크 큐가 R10 최종 원장의 입력인지 미확인 |
| `bypass_trial_session_auto_complete` | **하드 블로커 아님(결정 필요로 재확인 권고)** | 지시문의 5개 카테고리(세션 불변식/동의/계정 상태/초대/정산) 중 어디에도 문자 그대로는 속하지 않고, blast radius도 가장 작다고 판단 — 다만 "세션 불변식"을 넓게 해석하면(trial_sessions도 세션의 일종) 포함해야 할 수 있어 최종 판단은 제품 오너에게 넘긴다. |

## 결정 필요 (제품 오너 확인 요청)

1. **`bypass_session_lock`의 안전한 대체 구조** — 5번 항목에서 제시한 "구조적 재구성"이 비용 대비 타당한지, 아니면 더 단순한 절충(예: 트리거를 없애고 `sessions.final_status`/`material_version_id`에 대한 UPDATE grant를 아예 특정 role에만 주는 컬럼 단위 권한 접근)이 우선인지 방향 확인 필요 — 이번 라운드에서 코드 작성이 금지돼 있어 프로토타입으로 검증하지 못했다.
2. **`bypass_status_protect`가 보호하는 8개 함수의 정확한 게이트(`is_admin()` 등) 전수 확인** — 이번 라운드에서는 대표 트리거 정의만 읽었고, 8개 SET 호출부 각각의 함수 본문을 전부 읽지는 못했다(범위상 시간 제약). corrective 착수 전 재확인 필요.
3. **`20260909000000_r2_task8_capability_gates.sql`이 `bypass_invite_protect`/`bypass_status_protect`를 추가로 켜는 정확한 목적** — "캐퍼빌리티 게이트"가 초대/계정 상태와 어떻게 상호작용하는지 이번 라운드에서 깊이 읽지 못함.
4. **`bypass_teacher_rate_protect`를 Preview 게이트 하드 블로커에 포함할지** — 지시문 문구("정산 관련 항목")가 시급 자체를 포함하는지 해석 확인 필요.
5. **`bypass_reconciliation_task_lock`과 R10 payout 파이프라인의 실제 의존관계** — R10이 이 태스크 큐를 소비하는지, 아직 착수 전인지 `docs/CURRENT.md`의 최신 R10 관련 기록으로 재확인 필요(이번 라운드에서 R10 관련 섹션을 전수 검색하지 않음).
6. **`bypass_trial_session_auto_complete`를 게이트 하드 블로커에서 뺄지** — "세션 불변식"을 얼마나 넓게 해석할지에 달림, 판단을 제품 오너에게 넘김.
