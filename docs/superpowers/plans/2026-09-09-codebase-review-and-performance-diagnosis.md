# 기반 코드 리뷰·성능 진단 실행 계획

**작성일**: 2026-09-09 (2차 수정 — 제품 오너 보완 지시 반영)
**성격**: 계획 문서 — 이 문서 작성 라운드에서는 코드/마이그레이션을 수정하지 않았다. 5개 영역에 대한
1차 탐색(Explore 에이전트 5개 병렬)으로 위험도와 근거 파일을 확보했고, 제품 오너 검토 후 4가지
보완 지시(정산 P0 설계 확정, 성능 실측 선행, 테스트 공백 우선순위 재산정, `trial_lesson_review`
현행 유지)를 반영해 2차로 수정했다.
**외부 변경**: 없음 — Preview 배포, non-prod migration 반영, 외부 API 호출, main 병합 전부 없음.

## 0. 목적과 범위

R1~R10 누적 개발 중 여러 차례 corrective 라운드(GUC bypass 7건 등)로 개별 취약점은 그때그때
막아왔지만, 오픈 전에 **전체 기반 코드를 한 번 가로질러** 다음을 확인한 적은 없다:
계정·권한·가족 분리와 RLS, 상담·예약·수업·정산 상태 전이의 DB 레벨 보장, 레거시/v3 경로 중복,
서버 액션·migration·테스트의 정합성, 페이지별 쿼리 성능. 이 문서는 그 실행 계획이다.

**범위 밖**(이번 계획에도, 후속 실행 라운드에도 포함 안 함): 신규 기능 개발, UI 폴리싱, 계약 문안.

## 1. 계정·권한·가족·학생 분리와 RLS

### 1차 탐색 결과 요약
전반적으로 성숙도가 높다 — 이미 여러 차례 자체 감사·수정 이력이 있다(GUC bypass 19건 corrective
migration, `households`/`household_members` RLS 재귀 방지용 SECURITY DEFINER 헬퍼, 크로스-household
tautology 버그를 발견 즉시 수정한 이력이 `supabase/migrations/20260830080000_r1_rls_policies.sql:34-80`
자체 코멘트에 기록됨). 계정 상태(정지/비활성) 차단도 `current_account_active()`/
`current_account_access_allowed()`로 RLS 레벨에서 일관되게 적용됨
(`supabase/migrations/20260831020000_r2_account_status_content_rls.sql`,
`20260904010000_r2_minor_consent_content_rls.sql`).

### 남은 구조적 위험 (P1)
- **관리자 service_role 경로는 RLS의 보호를 전혀 받지 않고 `requireAdmin()` 앱코드 체크에만 의존한다.**
  근거: `app/admin/user-edit-actions.ts:13-34`, `direct-account-actions.ts`, `merge-actions.ts`,
  `payout-batches-actions.ts` — 전부 `createAdminClient()`(service_role) 사용, RLS가 아예 동작하지
  않는 연결이므로 유일한 방어선은 `requireAdmin()` 호출 유무뿐이다. 신규 관리자 액션이 이 호출을
  빠뜨려도 DB 레벨에서 잡아낼 방법이 없다.

### 실행 계획
1. **P1 — `createAdminClient()` 호출부 감사 + 회귀 방지 장치**: `app/admin/**/*.ts` 전체에서
   `createAdminClient()` 호출 직전에 `requireAdmin()`(또는 동등 캡ability 체크)이 실제로 실행되는지
   62개 액션 파일 전수 확인. 정적 grep 기반 테스트(`lib/legacy-teacher-payouts-write-guard.test.ts`
   패턴 재사용)로 "새 `createAdminClient()` 호출부는 반드시 같은 함수 내에 `requireAdmin` 호출을
   포함해야 한다"는 회귀 테스트 추가.
2. **P2 — 문서화**: 이 구조(RLS 미적용 + 앱코드 단일 방어)가 의도된 설계임을 `docs/CURRENT.md`에
   명시하고, 신규 관리자 액션 작성 시 체크리스트 항목으로 CLAUDE.md 또는 온보딩 문서에 반영할지는
   후속 라운드에서 결정.

### 수정 범위 추정
파일 수: 1개 신규 테스트/lint 스크립트 + 62개 액션 파일 확인(수정은 발견된 누락 건에 한함, 현재까지
탐색에서는 누락 사례 미발견). **P0 없음.**

## 2. 상담·예약·수업·정산의 상태 전이와 DB 제약

### 1차 탐색 결과 요약
consultation/contract/account-status 쪽은 이미 enum + 불변 이벤트 테이블 + SECURITY DEFINER 전이
함수 + `FOR UPDATE` 락(2026-12-51~61 corrective 계열)으로 정비된 템플릿을 따른다. **정산(payout)
파이프라인만 이 템플릿에 편입되지 않은 상태**로 확인됐다.

### 발견된 위험

**P0 — `reverse_payout_item()`에 이중 환수 방지 장치 없음**
근거: `supabase/migrations/20261218000000_r10_payout_batch_lifecycle.sql:151-190`(및 후속
`20261224000000_r10_paid_transition_guard_and_reversal_fix.sql:~153-190`) — 원본 `payout_items`
행을 `FOR UPDATE` 없이 조회 후 `status = 'paid'`만 확인하고 무조건 음수 환수 행 생성.
`p_original_item_id` 기준 유니크 제약이나 "이미 환수됨" 플래그가 없어, 동시/재시도 호출 시 같은
항목이 두 번 환수(중복 마이너스 배치 생성)될 수 있다. 대조군인 `dispatch_payout_batch`는
`payout_batches_dispatch_idempotency_key_key` 유니크 제약으로 이미 이 패턴을 갖고 있음
(`20261222000000_r10_settlement_pipeline_schema.sql:51`). 테스트도 이 이중 호출 케이스를
검증하지 않음(`lib/booking/payout-batch-lifecycle.integration.test.ts` L424, L675는 정상 경로와
paid-shortcut 트리거만 커버).

**P1 — `generate_payout_batches()` 동시 실행 시 레이스 가능성**
근거: `20261218000000_r10_payout_batch_lifecycle.sql:25-73`(후속
`20261222000000_r10_settlement_pipeline_schema.sql:69`) — `batch_id is null and status='pending'`
조회 후 UPDATE, 명시적 advisory lock이나 `FOR UPDATE SKIP LOCKED` 없음. 순차 재실행(멱등)은
안전하지만 진짜 동시 실행(cron 중복 트리거 등)에는 취약할 수 있음.

**P1 — 정산 상태 전이 함수들(`submit_payout_batch_for_review` 등)** 자체는 `UPDATE ... WHERE
status IN (...)` 단일 문장 패턴이라 실제로는 원자적이며 안전 — 리뷰 시 오인하지 않도록 문서화만
필요.

**P1 — 대사(reconciliation) 작업의 장기 정체 시 자동 처리 경로 확인 필요**: 이번 탐색에서는
migration만 봤고 실제 cron/스윕 로직 존재 여부는 `app/admin`·`lib/booking` 코드에서 별도 확인 필요.

### `reverse_payout_item()` 확정 설계 (제품 오너 지시 반영)

**정책**: 원본 paid `payout_items` 행 하나당 전체 역분개(reversal)는 **정확히 한 번만** 허용한다.
같은 원본에 대해 이미 역분개가 존재하면, 함수는 새 음수 항목·감사 로그를 만들지 않고 **기존
역분개 항목의 ID를 그대로 반환하는 멱등 동작**으로 끝난다.

**스키마 변경**:
- `payout_items`에 `reversed_from_item_id uuid references payout_items(id)` 컬럼 추가(역분개 행에만
  채워짐, 원본 행은 NULL).
- `unique (reversed_from_item_id) where reversed_from_item_id is not null` 부분 유니크 제약 —
  같은 원본을 참조하는 역분개 행이 DB 레벨에서 두 번 생성될 수 없도록 구조적으로 차단(앱코드
  체크가 아니라 진짜 제약).

**함수 동작 순서** (`reverse_payout_item(p_original_item_id, ...)`):
1. 원본 `payout_items` 행을 `select ... for update`로 잠근다(현재는 잠금 없이 조회 — 이번에 추가).
2. 잠근 행을 기준으로 `status = 'paid'`인지 재검증(락 이전 조회 결과를 신뢰하지 않는다 — 기존
   corrective 패턴과 동일).
3. `select id from payout_items where reversed_from_item_id = p_original_item_id`로 기존 역분개
   존재 여부 확인. **존재하면 그 ID를 그대로 반환하고 종료**(신규 INSERT·감사 이벤트 없음 — 완전
   멱등).
4. 존재하지 않으면 음수 역분개 항목을 `reversed_from_item_id = p_original_item_id`로 INSERT하고,
   해당 배치 상태 갱신·감사 로그 기록을 기존과 동일하게 수행.
5. 3~4 사이의 유니크 제약이 최종 방어선 — 동시에 두 트랜잭션이 3번을 동시에 통과해도 4번의 INSERT
   중 하나는 유니크 제약 위반으로 실패하며, 그 트랜잭션은 재시도 시 3번에서 기존 ID를 정상적으로
   찾아 반환한다(에러를 리턴하지 않고 재조회 후 멱등 반환하는 재시도 루프 1회 포함).

### 필수 테스트 (계획에 명시 — 구현 라운드에서 작성)
1. **정상 경로**: paid 항목 1건 역분개 → 역분개 행 생성, `reversed_from_item_id` 정확히 설정.
2. **순차 재시도(멱등)**: 같은 `p_original_item_id`로 2회 순차 호출 → 두 번째 호출은 새 행을 만들지
   않고 첫 번째 호출이 만든 행의 ID를 그대로 반환, 감사 로그는 정확히 1건만 존재.
3. **동시 호출**: 같은 원본에 대해 두 커넥션에서 동시에 `reverse_payout_item` 호출 → 정확히 1건의
   역분개 행만 최종 존재, 유니크 제약 충돌을 겪은 쪽은 에러 없이 같은 ID로 수렴(재조회 반환 로직
   검증).
4. **중간 실패 롤백**: 4번 단계(INSERT+배치 갱신+감사 로그) 도중 강제 실패(예: 감사 로그 INSERT
   실패 트리거) 시 전체 트랜잭션 롤백 — 역분개 항목도, `reversed_from_item_id`도 남지 않아 다음
   호출이 정상적으로 새 역분개를 생성할 수 있어야 함(좀비 half-state 없음).
5. 서로 다른 원본 항목에 대한 동시 역분개 호출은 서로 간섭 없이 모두 성공(과잉 직렬화 없는지 확인).

### 실행 계획
1. **P0 최우선**: 위 확정 설계대로 migration 작성 — 컬럼/제약 추가 + `reverse_payout_item()`
   재작성(락 + 재검증 + 멱등 반환), 필수 테스트 5종 전부 추가.
2. **P1**: `generate_payout_batches()`에 advisory lock 추가 + 동시 cron 실행 시뮬레이션 테스트.
3. **P1**: 대사 작업 스윕 로직 존재 여부를 `app/admin`, `lib/booking` grep으로 확인하고, 없다면
   후속 라운드 백로그에 명시.

### 수정 범위 추정
migration 1개(P0, 컬럼+제약+함수 재작성) + 통합 테스트 5종(위 목록) + P1 대상 migration 1개·
테스트 1~2개. 정산 관련 P0이므로 이 항목은 전체 실행 순서에서 최우선.

## 3. 레거시와 v3 경로의 중복·충돌

### 1차 탐색 결과 요약
**P0 없음** — legacy/v3가 동시에 같은 엔터티에 쓰는(write) 경로는 발견되지 않았다. 세션
소스 분기(`legacy_sessions` vs `sessions`)는 v3 행에 대해 레거시 쓰기 경로를 명시적으로 비활성화하고
있고, 홈워크는 애초에 서로 다른 테이블(`session_problem_attempts`/`homework_items` vs
`session_homework_items`)을 쓰도록 설계되어 충돌 여지가 구조적으로 차단돼 있다. 정산 레거시 경로
(`app/admin/payouts-cron.ts`)는 이미 no-op + grant revoke + 정적 회귀 테스트로 완전히 봉인됨.

### 남은 항목 (P1/P2)
- **P1 — 읽기 전용 union 로직 8개 이상 파일에서 독립 재구현**: `app/student/dashboard-data.ts`,
  `stats-data.ts`, `app/teacher/dashboard-data.ts`, `lessons-data.ts`, `curriculum-data.ts`,
  `lesson-schedule-data.ts`, `app/teacher/review/[sessionId]/review-data.ts`, `review-actions.ts`,
  `app/admin/payouts-data.ts` 전부 "legacy_sessions ∪ sessions" 병합 로직을 각자 구현. 현재는
  일관되지만, 병합 우선순위 로직을 한 곳만 고치고 나머지를 놓치는 드리프트 위험이 있음.
- **P2 — 완전 죽은 코드**: `app/admin/users-actions.ts:123`의 `legacyInviteTeacherByEmail()`은
  호출자가 없음(주석은 "R2 Task 7 대체 전까지 참고용 보관"이라 하지만 대체는 이미 완료됨) — 삭제 대상.

### 실행 계획
1. **P1**: legacy∪v3 세션 병합 로직을 공용 헬퍼(`lib/session-view.ts` 또는 신규
   `lib/sessions/merge-legacy-and-v3.ts`)로 추출해 8개 파일이 재구현 대신 재사용하도록 리팩터링.
   순수 읽기 로직 통합이므로 동작 변경 없는 리팩터링 — 각 파일의 기존 테스트로 회귀 확인.
2. **P2**: `legacyInviteTeacherByEmail()` 등 확인된 죽은 코드 삭제.
3. 레거시 UI 분기(세션뷰, ClassesTab/LessonsTab, WhiteboardCanvas)는 **현행 유지** — 이미
   `docs/CURRENT.md`에 "레거시 화이트보드 백필: 읽기 호환만 유지, 백필 계획 없음"으로 의도적
   결정이 기록돼 있고, 데이터 마이그레이션 없이는 병합 불가능한 구조적 제약이므로 이번 라운드
   대상이 아님.

### 수정 범위 추정
P1 리팩터링 1건(8개 파일 호출부 교체, 신규 로직 없음) + P2 삭제 1건. 기능 변경 없음.

## 4. 서버 액션·migration·테스트의 누락 또는 중복

### 테스트 공백 4건 — 개별 영향도 재산정 (일괄 P0 확정 철회, 제품 오너 지시 반영)

1차 탐색에서 "테스트 파일 없음"만으로 4건을 일괄 P0로 묶었던 것을 철회하고, 각 액션의 실제
DB 상태 전이·권한·금전/안전 영향을 확인해 다시 매겼다.

- **`app/teacher/lesson-schedule-actions.ts` — P0(유지, 최우선)**. `startMyLessonSession()` →
  `mark_lesson_session_started` (scheduled→live, `actual_start_at` 기록), `finalizeMyLessonSession()`
  → `finalize_lesson_session`, `resolveMyLessonLateness()` → `resolve_teacher_lateness`. 세 RPC 모두
  세션 상태·정산(교사 시급 계산 기준 시각)에 직결되고, 테스트 커버리지가 0이다. 정산 영향이
  확인됐으므로 P0 유지.
- **`app/admin/direct-account-actions.ts` — P1로 하향(정정)**. 코드 확인 결과 상태 변경은
  `trial_onboarding_links.status`/`notice_delivery_status` 갱신과 이벤트 로그 INSERT뿐이고, 실제
  계정 권한이나 금전에 영향을 주는 것은 그 링크를 통해 이후 별도로 발생하는 온보딩 완료 절차 쪽이다
  (그 절차 자체는 이 파일의 범위 밖). 이 파일 자체의 실패 영향은 "안내 메일이 잘못 가거나 링크
  회수가 안 되는" 운영 불편 수준 — 금전/권한 직접 영향 아님. P1로 재분류.
- **`app/session/[id]/homework-actions.ts` — P1로 하향(정정)**. `saveHomeworkAnswer()`는 학생
  본인의 `student_answer` 텍스트 업데이트, `addHomeworkItem()`은 교사의 과제 항목 추가 — 둘 다
  현재 코드상 소유자 체크가 쿼리 조건에 있는지부터 확인이 필요하지만(이번 재산정에서는 호출부만
  확인, 권한 체크 내용 자체는 미확인), 실패해도 금전/정산에는 영향이 없고 채점 데이터 무결성
  문제로 국한된다. P1로 재분류하되, "소유자 체크가 실제로 있는지"는 구현 착수 시 가장 먼저
  확인할 것.
- **`app/student/incident-report-actions.ts` — P1로 하향, 단 학생 신뢰/안전 사유로 순번은
  이르게 유지**. 교사 문제 신고 기능 — 금전 영향은 없으나 안전/신뢰 관련 기능이므로 테스트
  공백을 방치하기엔 부담이 있다. P1이지만 4건 중 `lesson-schedule-actions.ts` 다음으로 처리.

**결론**: 이번 4건 중 실측으로 P0가 확인된 것은 `lesson-schedule-actions.ts` 하나뿐이다. 나머지
3건은 P1로 재분류하고, P1 내 순서는 안전(incident-report) > 계정운영(direct-account) > 채점무결성
(homework)으로 둔다.

### 그 외 발견된 위험 (변경 없음)

**P1**
- `app/session/[id]/canvas-actions.ts` 테스트 없음(UI 상태 저장 위주로 상대적 저위험).
- 여러 포털이 파일 하나의 공유 테스트(`booking-actions.test.ts`류)에 의존 — 포털별 권한 분기가
  실제로 각각 검증되는지 별도 확인 필요.
- 이름이 겹치는 중복/사장(死藏) RPC 계열 발견: `apply_makeup_time`(→ 대체:
  `apply_makeup_time_to_booking`), `adjust_entitlement`(미사용, 실제로는
  consume/hold/release/refund/extend/transfer_entitlement 사용).
  `retry_direct_onboarding_student_entitlement`(미사용) vs `admin_retry_trial_entitlement_grant`(사용).
  **`trial_lesson_review` 계열은 아래 별도 항목 참고 — 이번 라운드에서 삭제/연결 여부를 정하지
  않는다.**

**P2**: RPC 이름 오타/불일치는 발견되지 않음(118개 `.rpc()` 호출 전부 정의된 함수와 매칭 확인).

**탐색 한계**(에이전트 명시): 62개 액션 파일 중 고위험 22개만 표본 확인, 170개 migration의 쌍별
ALTER 충돌 전수 스캔은 예산상 생략(고빈도 변경 테이블 `bookings`/`entitlements`/`sessions` 대상
`grep -n "ALTER TABLE"` 후속 필요), 테스트 파일 "존재 여부"만 확인했고 negative-path 실제 커버리지는
미확인.

### `trial_lesson_review` RPC 계열 — 현행 유지 (삭제·이관 보류, 제품 오너 지시 반영)

정의 위치 확인: `supabase/migrations/20261016000000_m4_trial_review_and_regular_conversion.sql`
(최초 정의), `20261017000000_m4_admin_function_auth_fix.sql`(권한 수정),
`20261027000000_m4_unified_lesson_reviews.sql`("unified_lesson_reviews" — 이름상 이후 통합 리팩터가
있었음을 시사). `app/`·`lib/`의 TypeScript 코드에서 `trial_lesson_review`/
`admin_upsert_review_category` 호출부는 이번 재확인에서도 0건으로 확인됐다(1차 탐색과 동일 결과).

**이번 라운드 결정**: 삭제하지도, 새로 연결하지도 않는다 — **현행 유지로 분류**. 아래 3가지를
별도로 조사한 뒤에만 삭제 또는 이관을 결정한다(이번 계획 라운드 범위 아님, 후속 조사 항목으로만
등록):
1. **실제 호출 여부**: 위 세 migration 파일이 서로를 어떻게 대체/통합했는지 diff로 확인 —
   `20261027000000_m4_unified_lesson_reviews.sql`이 `trial_lesson_review` 계열을
   `admin_edit_lesson_review` 등으로 완전히 흡수했는지, 아니면 별개 플로우로 병존 설계됐는지.
2. **데이터 잔존 여부**: 개발 DB에 `trial_lesson_review` 관련 테이블/컬럼에 실제 행이 남아있는지
   확인(있다면 단순 미사용 함수가 아니라 과거 실행 데이터를 참조하는 경로일 수 있음).
3. **운영 사용 여부**: 관리자 포털 UI에서 이 함수들을 호출하는 버튼/화면이 실제로 존재하는지
   (호출부가 TypeScript 코드에 없다는 것은 서버 액션 경유 호출이 없다는 뜻이지 UI 자체가 없다는
   뜻은 아닐 수 있음 — 별도 확인 필요).

### 실행 계획
1. **P0 우선순위**: `lesson-schedule-actions.ts`에 대해 (a) 정상 경로(시작/종료/지각 처리),
   (b) 권한 없는 호출자 거부, (c) 잘못된 상태에서의 호출 거부(예: 이미 live인 세션 재시작 시도)
   최소 3케이스 통합 테스트 작성 — 이번 4건 중 유일한 P0이자 최우선.
2. **P1**: `incident-report-actions.ts` → `direct-account-actions.ts` → `homework-actions.ts` 순으로
   최소 정상/권한거부 테스트 추가(`homework-actions.ts`는 착수 시 소유자 체크 존재 여부부터 확인).
3. **P1**: `apply_makeup_time`/`adjust_entitlement`/`retry_direct_onboarding_student_entitlement`의
   존치/삭제 여부 — 정책 결정 필요 항목으로 분류(아래 8절), 결정 후 삭제 또는 연결.
4. **보류(이번 라운드 범위 밖)**: `trial_lesson_review` 계열은 위 3가지 후속 조사 전까지 손대지
   않는다.
5. **P1**: 공유 테스트 파일이 포털별 권한 분기를 실제로 커버하는지 3개 파일(`booking-actions.test.ts`
   계열) 직접 읽고 negative-path 보강.
6. **P2 후속(이번 라운드 범위 밖으로 명시)**: 170개 migration 쌍별 ALTER 충돌 전수 스캔은 별도
   저비용 자동화 스크립트로 처리(고빈도 테이블 4~5개 한정).

### 수정 범위 추정
신규 테스트 파일 4개(P0 1개 + P1 3개), `trial_lesson_review` 관련 코드 변경 없음(후속 조사 대기).

## 5. 페이지별 데이터 로딩, 쿼리 수, 워터폴, 클라이언트 재요청

### 구조적 관찰 (1차 탐색, 실측 아님 — 정적 분석)

**P0 후보(실측 전 미확정)**
- `app/student/curriculum-data.ts:55-110` (`loadCurricula`) — enrollment마다 순차 3개 쿼리
  (`teacher_curriculum_templates`/`teacher_curriculum_template_units`/`legacy_sessions`), N개
  enrollment면 정적으로는 3N회 순차 라운드트립으로 보인다. `.in()` 배치 쿼리 2개로 축소 가능해
  보이나, 축소 효과가 실제로 사용자 체감에 영향을 줄 규모인지는 실측 전까지 확정하지 않는다.
- `app/teacher/curriculum-data.ts:13-17` (`loadAllStudentCurricula`) — 학생별로는 병렬화돼 있지만
  내부적으로 위 N+1을 그대로 호출 — 정적으로는 학생 수 × enrollment 수만큼 곱연산.
  `app/teacher/page.tsx:47-50`에서 호출되는 교사 대시보드.

**P1 — 불필요한 순차 대기(정적으로 명확, 실측 없이도 개선 가능)**
- `app/teacher/dashboard-data.ts:41-58` — `profile`/`teacherRow`/`enrollments` 3개 쿼리가 서로
  독립인데 순차 await, `Promise.all`로 교체 가능(`app/student/dashboard-data.ts`는 이미 올바른
  패턴이므로 그대로 참고). 이 항목은 쿼리 개수/체감 지연폭이 작고 수정이 100% 안전(순서 무관 독립
  쿼리)하므로 별도 기준선 측정 없이 바로 적용해도 된다.

**P2**: `app/parent/ConsultRequestTab.tsx`/`InquiryTab.tsx`의 `useEffect` fetch는 사용자 상호작용
트리거이지 중복 재요청이 아님. 화이트보드/채팅의 `useEffect`는 실시간 데이터로 정상. 나머지 로더
(`homework-data.ts`, `homework-v3-data.ts`, `session-source-data.ts`, `lesson-schedule-data.ts`,
`review-data.ts`)는 순차이지만 각 단계가 이전 결과의 ID에 실제로 의존하는 정당한 체인 — 문제 없음.

### 성능 측정 우선 원칙 (제품 오너 지시 반영)

`loadCurricula()`/교사 대시보드의 N+1은 **P0 후보로만 유지**하고, P0 확정은 아래 실측 결과가 나온
뒤에 한다. 코드 변경 전에 반드시 기준선을 먼저 잰다.

**측정 순서**: ① 기준선 측정 → ② 배치 조회로 변경 → ③ 동일 조건으로 재측정.

**① 기준선 측정 (개발 DB, 코드 변경 전)**
- 조건 매트릭스: 학생 수 {1, 10, 30}(현실적 상한 근사) × 학생당 수강 과목(enrollment) 수 {1, 3, 5}
  최소 3~4개 조합을 UAT 실행 ID로 시딩.
- 각 조합에서 기록할 항목:
  1. `loadCurricula()` 서버 응답 시간(함수 진입~반환, `console.time` 또는 동등 계측).
  2. 실제 PostgREST/Supabase 왕복 횟수(현재 코드 경로를 그대로 실행해 로그 카운트 — 정적으로 추정한
     "3N"이 실측과 일치하는지 확인 포함).
  3. 순차 대기 구간의 실제 누적 시간(각 왕복의 개별 소요시간 합 대비 전체 함수 소요시간 — 워터폴
     여부 확인).
  4. 교사 대시보드(`loadAllStudentCurricula` 경유) 페이지 전체 TTFB/응답 시간, 같은 학생×enrollment
     조합 기준.
- 위 4개 지표를 표로 정리해 계획 문서(또는 별도 측정 기록 파일)에 남긴다.

**② P0 확정 기준**: 기준선에서 다음 중 하나라도 확인되면 P0로 확정하고 우선 수정한다 — (a) 학생
30명·enrollment 5개 조합에서 페이지 응답이 수 초 단위로 느려짐, (b) 왕복 횟수가 조합 규모에 선형
이상으로 증가함이 실측으로 확인됨, (c) 순차 대기 구간이 전체 응답 시간의 지배적 비중을 차지함.
기준선이 이 중 어느 것도 보이지 않으면 P1로 하향하고 개선은 하되 최우선순위에서는 뺀다.

**③ 배치 조회 변경 후 재측정**: `loadCurricula()`를 enrollment 목록 → `teacher_curriculum_templates`/
`_units`를 `.in(template_ids)` 1회, `legacy_sessions`를 `.in(enrollment_ids)` 1회로 재작성(정적으로는
3N→2). 같은 학생×enrollment 조합·같은 개발 DB 상태로 ①과 동일한 4개 지표를 재측정해 실제 개선폭을
숫자로 기록한다. 기존 curriculum 관련 테스트로 결과 동일성(응답 데이터 모양 불변)도 함께 회귀
확인한다.

### 실행 계획
1. **성능 기준선 측정**: 위 ① 절차를 UAT 실행 ID로 실행, 결과를 기록.
2. **P0 확정/하향 판단**: ② 기준의 실측 결과로 P0 여부를 확정.
3. **배치 조회 변경 + 재측정**: ③ 절차로 `loadCurricula()`/`loadAllStudentCurricula` 수정 후
   동일 조건 재측정, 개선폭 기록.
4. **P1**: `teacher/dashboard-data.ts`의 3개 독립 쿼리를 `Promise.all`로 교체(기준선 측정 불필요,
   즉시 적용 가능).
5. **P2**: `app/teacher/page.tsx:40`의 인라인 쿼리를 `dashboard-data.ts`로 이동(가독성, 동작 변경 없음).

### 수정 범위 추정
측정 단계는 코드 변경 없음(계측 로그 추가 후 측정 뒤 제거, 또는 임시 로컬 스크립트). 배치 조회
변경은 파일 2개(`curriculum-data.ts` 계열, `teacher/dashboard-data.ts`) — 순수 리팩터링(응답 데이터
모양 동일), 회귀 테스트 + 실측 재확인으로 검증.

## 6. P0/P1/P2 분류 기준 (전체 공통)

- **P0**: 아래 중 하나 이상 해당 — (a) 실사용자 데이터 손실/이중 처리(정산 이중 환수 등) 가능,
  (b) 권한 없는 사용자의 privilege escalation 또는 타 가족/학생 데이터 접근 가능,
  (c) **실측으로 확인된** 실서비스 트래픽 규모에서 페이지가 사실상 응답 불가할 정도로 느려지는
  스케일링 결함(N+1 등) — 정적 분석만으로는 P0 후보이지 확정이 아니다, 5절의 기준선 측정 결과가
  필요,
  (d) 정산/과금에 직결되는 상태 전이 경로에 테스트가 전혀 없고 실제 상태 변경 로직도 그 위험을
  뒷받침함(테스트 부재 자체가 아니라 "테스트 부재 + 실제 금전/권한 영향"의 조합이 기준).
  → **오픈 전 반드시 수정.**
- **P1**: 현재는 일관되게 동작하지만 (a) 동시성/레이스에 취약, (b) 앱코드에만 의존하고 DB 레벨
  백스톱이 없음, (c) 중복 구현으로 향후 드리프트 위험, (d) 저위험 경로의 테스트 공백.
  → **오픈 전 수정 권장, 일정 압박 시 오픈 직후 1순위 후속으로 이월 가능**(제품 오너 승인 필요).
- **P2**: 죽은 코드, 가독성, 문서화 공백 등 동작에 영향 없는 위생 이슈. → **여유 있을 때 처리,
  기능 개발과 함께 자연스럽게 정리해도 무방.**

## 7. 실행 순서 (제품 오너 확정)

아래 순서로 확정한다(각 라운드는 CLAUDE.md 규정대로 별도 승인):

1. **정산 P0**: `reverse_payout_item()` 확정 설계(2절 — 원본당 역분개 1회, FK+유니크 제약, 멱등
   반환) 구현 + 필수 테스트 5종. 돈이 걸린 유일한 확정 P0, 최우선.
2. **성능 기준선 및 N+1 개선**: 5절 절차대로 ① 기준선 측정 → ② P0 확정/하향 판단 → ③ 배치 조회
   변경 + 재측정. 측정 없이 코드부터 바꾸지 않는다.
3. **수업 상태변경 테스트**: `lesson-schedule-actions.ts`(시작/종료/지각 처리) 통합 테스트 —
   4절에서 재확인된 유일한 확정 P0, 정산 영향 때문에 우선순위 유지.
4. **나머지 권한·레거시 정리**: `createAdminClient()` 회귀 방지 테스트(1절), legacy∪v3 union 헬퍼
   추출 + 죽은 코드 삭제(3절), `incident-report-actions.ts`/`direct-account-actions.ts`/
   `homework-actions.ts` P1 테스트 보강과 정산 동시성(`generate_payout_batches` advisory lock)·
   대시보드 `Promise.all`·공유 테스트 negative-path 보강(2/4/5절 나머지 P1 항목)을 이 단계에서
   함께 처리.

`trial_lesson_review` 계열은 4절의 3가지 후속 조사(실제 통합 여부, 데이터 잔존, 운영 사용 여부)가
끝나기 전까지 이 실행 순서 어디에도 포함하지 않는다 — 현행 유지.

## 8. 결정 필요 (제품 오너)

1. **(해소됨)** `trial_lesson_review` RPC 계열 — 이번 지시로 "삭제·이관 보류, 현행 유지"로
   확정됐다. 4절의 3가지 후속 조사(실제 통합 여부/데이터 잔존/운영 사용 여부) 완료 후 별도로
   재논의한다.
2. **(해소됨)** 실행 순서 — 위 7절 순서(정산 P0 → 성능 기준선·N+1 → 수업 상태변경 테스트 →
   나머지 권한·레거시 정리)로 확정됐다.
3. `apply_makeup_time`/`adjust_entitlement`/`retry_direct_onboarding_student_entitlement` 미사용
   RPC 3종의 삭제 여부는 아직 미결 — 4절 실행 계획 3번 항목에서 다음 라운드 착수 시 정책 결정
   필요.

## 9. 탐색 방법론 메모 (재현/후속 확장용)

이번 1차 탐색은 Explore 서브에이전트 5개를 병렬 실행해 각 영역을 grep 기반으로 스캔 후 대표
파일을 정독하는 방식으로 진행했다(170개 migration/62개 액션 파일 전수 정독은 예산상 제외).
각 에이전트가 명시한 미탐색 영역(4절의 ALTER 충돌 전수 스캔, negative-path 테스트 내용 확인)은
실행 라운드 착수 시 해당 영역 담당자가 먼저 좁혀서 확인할 것.
