# M2 — R4 후속(체험수업권) 실행 로그(2026-09-03)

범위: `docs/2026-08-29-master-roadmap-v3.md` "근접 실행계획" M2 절. 구매·환불·양도
불가능한 60분 전용 체험수업권을 M1 상담 결과 기록(`admin_record_consultation_outcome`,
outcome='trial_recommended')에 연결해 시스템이 자동 지급하는 흐름까지만 구현한다.
체험 선생님 배정·예약(M3), 상담→체험→정규 전환 통합(M4)은 이번 범위가 아니다 —
코드로 착수하지 않았다.

## 1. 완료

커밋: `007e917` "M2: trial (60-min) lesson entitlement — system-granted, non-purchasable"
(main 브랜치, `git push` 없음).

### DB (`supabase/migrations/20261012000000_m2_trial_entitlement.sql`)

- **상품 유형 구분**: `entitlement_types`에 `trial_lesson_use`(lesson_types의 기존
  `trial`=60분과 연결, R1부터 존재했지만 이를 가리키는 entitlement_type이 지금까지
  하나도 없었음을 확인) 신규 추가. `entitlement_products.system_only`(신규 컬럼) +
  `trial_lesson_grant` 상품(quantity=1, system_only=true) 추가 — 가격 버전
  (`entitlement_product_versions`)을 만들지 않아 구매 체크아웃이 "가격 정보 없음"으로
  1차 fail-closed되고, `system_only` 플래그로 앱 레이어가 2차 방어(§2 참고).
- **중복 지급 방지(요구사항 4)**: `entitlement_grants.source_consultation_id` +
  `entitlement_grants_source_consultation_uq` 부분 unique index(상담당 grant 최대 1개).
  `grant_trial_entitlement_for_consultation()`이 이 unique index + 기존 R1
  `entitlement_ledger_business_event_dedup`를 함께 이용해 재시도·동시 재시도 양쪽에서
  멱등(그대로 기존 grant_id 반환, 중복 생성 없음).
- **정규/체험 오사용 방지(요구사항 3, DB 레벨 핵심)**: 실제 조사 결과 `hold_entitlement()`가
  R1부터 지금까지 child의 **모든** grant를 만료일 순으로만 훑고 수업 유형(정규 120분/체험
  60분)을 전혀 구분하지 않았다는 것을 확인했다(지금까지 entitlement_type이
  `regular_lesson_use` 하나뿐이라 드러나지 않았을 뿐). `hold_entitlement()`에
  `p_lesson_type_id`(기본값 null=기존 동작, 기존 관리자 수동 경로 호환용) 파라미터를
  추가해 값이 있으면 `entitlement_products→entitlement_types.lesson_type_id` 조인으로
  후보 grant를 좁힌다. `confirm_lesson_booking()`(20261008000000의 최종본을 그대로
  복사 후 이 한 줄만 변경)이 이제 항상 예약의 `p_lesson_type_id`를 넘긴다 —
  `create_weekly_lesson_series()`는 `confirm_lesson_booking()`에 위임하는 구조라
  별도 수정 불필요(확인 완료).
- **연결 지점(요구사항 2)**: `admin_record_consultation_outcome()`을 CREATE OR REPLACE로
  확장 — 기존 4개 완료 조건(동의/Smart Notes ON/원본 연결/검토 요약)은 그대로 두고,
  `p_outcome='trial_recommended'`일 때 같은 트랜잭션 안에서
  `grant_trial_entitlement_for_consultation()`을 호출한다. 실패해도 예외를 잡아
  `consultations.trial_entitlement_grant_status='failed'` + `_error`로만 남기고 이미
  기록된 outcome 자체는 롤백하지 않는다(요구사항 7 — 기존 R6/M1 graceful degradation
  원칙과 동일, 결제/Calendar 실패가 다른 진행을 막지 않는 패턴 재사용).
- **관리자 복구 동선(요구사항 7)**: `admin_retry_trial_entitlement_grant()` 신규 —
  이미 `granted`면 그대로 반환(멱등), 아니면 재시도. child_id가 아직 없는 잠재고객
  단계 상담은 재시도해도 여전히 실패하며 그 사유가 `trial_entitlement_grant_error`에
  그대로 남는다(관리자가 원인을 바로 안다).
- **취소 시 정합성(요구사항 4)**: 새 함수를 만들지 않고 기존 R4
  `expire_entitlement(grant_id, business_event_id)`를 그대로 재사용하도록 문서화
  (comment on function) — 이미 "미소진 잔량을 0으로" 만드는 범용 함수이고
  INSERT-only·idempotency 패턴도 동일하게 적용된다. psql로 실제 동작 확인(§3).
- **환불(요구사항 6)**: 별도 환불 로직을 만들지 않았다 — `refund_entitlement()`는
  `purchase_id_ref`가 있는 grant만 대상으로 하는데 체험 grant는 애초에
  `purchase_id_ref=null`이라 대상이 될 수 없다(구매 자체가 없으므로 "환불"이라는
  개념이 성립하지 않음 — 요구사항 2의 "환불 불가능"과 일치). 기존 확정 환불 공식
  (`calculate_purchase_refund_minor`, purchase 단위)은 체험수업권에 애초에 적용
  대상이 아니어서 일반화가 필요 없었다.
- **양도 불가(요구사항 3)**: 새 컬럼을 추가하지 않았다 — 체험 grant는
  `is_paid=false`로 생성되고, 기존 `transfer_entitlement()`가 이미
  `if not v_source.is_paid then raise exception` 가드를 갖고 있어(20260922000000
  §8-4) 자동으로 이전 불가. psql로 실제 예외 발생 확인(§3).
- **조회 뷰**: `entitlement_grant_details`(grant + 상품 + 수업유형 + 잔액 합산) 신규 —
  20260923000000의 `purchase_receipts` 뷰와 동일한 조인 패턴. 정규/체험을
  `lesson_type_code`로 구분할 수 있어 앱 레이어가 실수로 합산하는 것을 막는다.

### 앱 레이어

- `app/admin/consultation-scheduling-actions.ts`: `ConsultationListItem`에
  `trial_entitlement_grant_id/_status/_error`, `child_id` 추가(두 조회 함수의
  select 컬럼 목록에도 반영). `retryTrialEntitlementGrant()` 신규 서버 액션
  (`admin_retry_trial_entitlement_grant` RPC 래퍼).
- `app/admin/ConsultationSchedulingPanel.tsx`: outcome='trial_recommended'인 상담에
  체험수업권 지급 상태 표시(`TRIAL_GRANT_STATUS_LABEL`) + 실패 시에만 노출되는
  "체험수업권 지급 재처리" 버튼.
- `app/parent/purchase-actions.ts`: `entitlement_products.system_only`를 함께
  조회해 true면 체크아웃 자체를 명시적으로 차단(친절한 에러 메시지 — 가격 정보
  없음으로 우회 실패하는 것보다 명확).
- `app/parent/entitlements-data.ts`: `entitlement_grants`+`entitlement_ledger`
  두 테이블을 각각 조회해 직접 합산하던 것을 `entitlement_grant_details` 뷰 조회로
  교체하고 `lesson_type_code`로 정규/체험을 분리 — 이전 코드는 체험 grant가 생기는
  순간 자녀의 "정규 수업권 잔여"에 잘못 합산되는 실제 버그를 만들 뻔했다(이번
  세션에서 코드를 작성하며 발견해 애초에 배선하지 않음). `ChildEntitlementSummary`에
  `trialEntitlement: { grantId, remaining, expiresAt } | null` 추가.
- `app/parent/EntitlementsTab.tsx`: 체험수업권 보유 시 정규 수업권 카드와 별도로
  "체험수업권(60분) 1회 보유 중 · 정규수업권과 별개이며 구매·환불·양도가
  불가능합니다" 카드 표시.

## 2. 검증

- **로컬 `supabase db reset --local`**: 성공(전 마이그레이션 순서대로 재적용,
  본 마이그레이션 포함). 총 2회 실행(초기 1회 + Playwright 실행 전 재확인 1회).
- **psql 직접 검증(로컬 dev DB, `postgresql://postgres:postgres@127.0.0.1:54422/postgres`)**:
  - 상담 fixture로 `admin_record_consultation_outcome(..., 'trial_recommended', ...)`
    호출 → `trial_entitlement_grant_status='granted'`, grant 1건 생성(`is_paid=false`,
    `source_consultation_id`=상담 id) 확인.
  - `admin_retry_trial_entitlement_grant()` 재호출 + `grant_trial_entitlement_for_consultation()`
    직접 재호출(동시 재시도 시뮬레이션) → grant 개수 계속 1건 유지 확인(멱등성).
  - **정규/체험 오사용 방지 실측**: 체험 grant만 가진 child에게 `hold_entitlement(..., p_lesson_type_id=regular)`
    호출 → `사용 가능한 수업권이 없습니다.` 예외로 정확히 차단됨을 확인(PASS).
    같은 child에게 `p_lesson_type_id=trial`로 호출 → 정상적으로 hold 성공(PASS).
  - `transfer_entitlement()`를 체험 grant에 호출 → 기존 R4 `is_paid` 가드가 예외를
    던짐을 확인(PASS, 새 코드 없이 기존 불변식 재사용 검증).
  - `refund_entitlement()`를 무관한 purchase_id로 호출 → 대상 없음(no-op) 확인.
  - `expire_entitlement()`로 미소진 체험 grant를 회수 → 잔액이 정확히 0이 됨을 확인
    (취소 시 정합성).
  - `entitlement_products` 목록에서 `trial_lesson_grant.system_only=true`,
    기존 `lesson_pack_1`/`lesson_pack_20`은 `system_only=false`로 그대로 남아있음을
    확인(정규 상품 무변경).
- **`tsc --noEmit`**: 클린(변경 전/후 모두 무출력).
- **전체 Vitest**: 변경 전 841건 통과(베이스라인) → 변경 후 **846건 통과**(신규 5건:
  `app/admin/consultation-scheduling-actions.test.ts` 2건, `app/parent/purchase-actions.test.ts`
  system_only 차단 1건, `app/parent/entitlements-data.test.ts`/`EntitlementsTab.test.tsx`
  trial 분리 표시 각 1건). 기존 R4/R5/R6/M1 테스트 전부 그대로 통과 — 회귀 없음.
- **`next build`**: 성공(정적/동적 라우트 생성까지 정상, 변경 전/후 모두 확인).
- **Playwright(관련 스펙만, `--workers=1`)**: `e2e/m1-consultation-flow.spec.ts`,
  `e2e/r4-admin-entitlement-ledger.spec.ts`, `e2e/r4-purchase-flow.spec.ts`,
  `e2e/r4-webhook-dispute.spec.ts`, `e2e/r4-webhook-purchase-completion.spec.ts`,
  `e2e/r6-lesson-booking-flow.spec.ts` 총 10건 **전부 통과**(24.2s). 특히
  `r6-lesson-booking-flow`는 `hold_entitlement()`/`confirm_lesson_booking()`
  시그니처 변경이 기존 정규수업 예약(hold→취소→release)을 깨지 않았음을 실브라우저로
  확인한다. 전체 Playwright 스위트(52건 전부)는 이번 세션에서 시간 예산상 재실행하지
  않았다 — 위 6개 스펙이 이번 변경이 실제로 손댄 경로(수업권/결제/예약/상담)를
  전부 포함하며, `tsc`/`next build`/전체 Vitest가 무관한 나머지 영역의 회귀를
  잡아낸다는 판단.
- **Clean `git worktree` 재현**: `/tmp/alton-m2-worktree`(커밋 `007e917`의 HEAD,
  커밋되지 않은 파일 전혀 없음)에서 `npm ci` → `next build` 성공 → `npx vitest run`
  **846/846 통과** 재확인 완료. 저장소 무결성 확인(이번 세션은 미완성 상태로 커밋한
  적 없음).

## 3. 미완료 / 결정 필요

- **미완료(로드맵 재확인 중 발견, 착수하지 못함) — 7일 이내 미사용 전액환불 +
  미래 예약 해제 우선순위**: `docs/2026-08-29-master-roadmap-v3.md` M2 절이
  2026-09-03에 이미 이 항목을 "이 M2에서 실제 상품·원장·환불 계산·화면까지
  구현한다"고 확정해뒀다는 것을 이번 세션 마무리 단계에서 확인했다. 이번 세션은
  체험수업권 "지급" 구현에 시간을 집중했고 이 정규 상품 환불 증분(기존
  `calculate_purchase_refund_minor()`와 별개의 7일 윈도우 + 미래 예약 우선 해제
  로직)은 코드를 전혀 작성하지 못했다 — 정책이 이미 확정돼 있어 "결정 필요"
  항목은 아니고, 순수하게 다음 세션에서 이어서 구현해야 하는 미완료 작업이다.
  로드맵 문서의 해당 체크박스도 미완료로 남겨뒀다.

- **결정 필요 — 체험수업권 유효기간**: 상담→체험 전환까지 걸리는 기간에 대한 제품
  정책이 없어 `grant_trial_entitlement_for_consultation()`이 기술적 기본값으로
  90일을 하드코딩했다(마이그레이션 §6 주석에 명시). 사용자 경험에 영향을 주는
  정책 결정이라 임의로 확정하지 않았다 — **권장안**: 상담 완료 시점부터 60~90일
  (기존 정규 패키지 유효기간 12개월보다 훨씬 짧게, "빨리 체험을 잡도록 유도"하는
  방향). 확정되면 이 한 줄(`v_expires_at := now() + interval '90 days'`)만 교체하면
  된다 — 다른 로직 영향 없음.
- **범위 밖(M3/M4, 코드 착수하지 않음)**: 체험 선생님 배정·예약 자체(M3),
  `consultations.child_id`가 아직 없는(잠재고객 단계) 상담이 정식 학생 계정과
  연결되는 로직(M4 — `prospect_contacts.converted_guardian_id`). 이번 세션에서
  발견한 연결 지점: `grant_trial_entitlement_for_consultation()`이 child_id
  없으면 명확한 예외를 던지므로, M4가 계정 연결을 완료한 뒤
  `admin_retry_trial_entitlement_grant()`를 호출하면 그 시점에 지급이 자연스럽게
  이어진다(추가 인터페이스 설계 불필요, 이미 재사용 가능).
- **미완료(의도적, 시간 예산)**: 전체 Playwright 스위트(52건) 전체 재실행 —
  위 §2에서 설명한 대로 관련 스펙 10건 실행으로 대체.
- **미완료**: `EntitlementLedgerTab.tsx`(관리자 구매 상세 조회 화면)에는 체험 grant를
  위한 UI를 별도로 추가하지 않았다 — 그 화면은 `purchase_id` 기반 조회라 애초에
  구매가 없는 체험 grant를 조회할 경로가 없다(설계상 자연스러운 배제). 대신
  `ConsultationSchedulingPanel.tsx`(관리자)와 `EntitlementsTab.tsx`(보호자)에
  최소 UI를 뒀다 — 요구사항 7 충족.

## 4. 외부 변경(1라운드)

Stripe/DocuSign/Google API 실호출, 실제 이메일 발송, Production/원격 DB 접근 전부
0건. 모든 외부 플래그 기본값(false/미설정) 유지. `git push` 하지 않음(로컬 커밋
`007e917`, 문서 커밋 `de9cd26`만 존재, main 브랜치).

---

## 5. 2라운드 — M2 잔여 마감(2026-09-03, 같은 날 후속 세션)

제품 오너가 M2 잔여 항목(체험수업권 90일 유효기간 확정, 정규상품 환불 정책 구현)을
지시. 마이그레이션: `supabase/migrations/20261013000000_m2_refund_policy_and_trial_expiry.sql`.

### 5.1 완료

- **체험수업권 90일 유효기간(지급일 기준) — 정책 확정을 코드로 재확인, 신규 로직
  불필요**: 1라운드에서 이미 `grant_trial_entitlement_for_consultation()`이
  `now() + interval '90 days'`로 구현해뒀던 값이 이번에 확정된 정책과 정확히
  일치함을 확인했다. "예약을 90일 안에 하는 것만으로는 부족 — 체험수업 실제
  시작 시각이 만료 시각 이하여야 함"은 R1부터 존재하던 `hold_entitlement()`의
  `where g.expires_at > p_lesson_start_at` 필터가 이미 모든 lesson_type(정규/체험
  공통)에 적용하고 있었다 — 이 필터는 만료 이후 신규 hold를 막고, 만료 전 hold된
  예약이라도 그 예약의 시작 시각 자체가 만료 이후였다면 애초에 hold가 성립할 수
  없었다는 뜻이라 "만료 전 정상 hold됐어도 시작 시각이 만료 후면 확정 불가"도
  자동으로 성립한다. "시간 변경 시 재검증"도 기존
  `reschedule_reservation_to_google_time()`(20261005000000)이
  `v_hold_grant_expires_at <= p_new_starts_at`로 동일 원칙을 범용 적용하고 있어
  체험 전용 신규 코드가 필요 없었다(M3가 실제 체험 예약을 구현하는 순간 이
  범용 경로를 그대로 재사용하게 된다 — 인터페이스 추가 설계 불필요). timezone/DST는
  기존 `timestamptz` 비교라 R6와 동일한 방식(변경 없음). 구매·환불·양도 불가는
  1라운드에서 이미 구현된 `is_paid=false`/`system_only`를 그대로 유지(변경 없음).
  이 마이그레이션은 두 함수(`hold_entitlement`/`reschedule_reservation_to_google_time`)의
  본문을 전혀 건드리지 않았다 — 확인용 comment만 추가(마이그레이션 §5).
- **정규상품 환불 정책(단건·10회·20회) — 실제 구현**:
  - `purchase_has_active_future_holds(p_purchase_id)` 신규 헬퍼(`security definer`,
    `service_role`만 실행 가능) — 이 구매의 grant에 아직 소진/해제되지 않은 미래
    예약 hold가 있으면 true.
  - `calculate_purchase_refund_minor()`를 `drop function` 후 재생성(리턴 타입이
    바뀌어 `CREATE OR REPLACE`만으로는 안 됨 — Postgres가 OUT 컬럼 구성 변경을
    거부, 실제로 `db reset` 중 이 에러를 만나 수정) — 이제
    `within_full_refund_window`/`blocked_by_active_holds`를 추가로 반환한다.
    **7일 이내+전혀 미사용**(`purchases.confirmed_at` 기준, 소진 카운트 0)이면
    `package_price_minor` 전액, 그 외는 기존 공식
    `greatest(0, package_price_minor - consumed_count*unit_price_minor)` 그대로
    유지. 차단 상태(`blocked_by_active_holds=true`)면 `refund_minor`는 0으로
    반환해 혼동을 막는다(실제 차단은 아래 `refund_entitlement()`가 강제).
    **스냅샷 원칙**: 계산은 전부 `purchases` 행의 구매 시점 스냅샷
    (`package_price_minor`/`unit_price_minor`/`confirmed_at`)과
    `entitlement_ledger`의 INSERT-only 이력만 사용 — `entitlement_product_versions`의
    "현재" 가격은 전혀 조회하지 않는다. 상품 가격이 나중에 바뀌어도 과거 구매의
    환불액은 절대 달라지지 않는다(요구사항 명시 원칙, 20260922000000 §1과 동일
    구조라 이미 자연스럽게 성립 — 별도 스냅샷 컬럼을 추가할 필요가 없었다).
  - `refund_entitlement()`가 이제 승인 직전에
    `purchase_has_active_future_holds()`를 검사해 미래 활성 hold가 있으면
    fail-closed로 거부한다("아직 소진되지 않은 미래 예약이 있어 환불을 진행할 수
    없습니다. 먼저 해당 예약을 취소해 수업권을 해제해주세요.") — 이것이 "미래
    예약 해제 우선순위" 요구사항의 실제 구현이다. **기술적 선택(결정 필요 아님,
    근거 기록)**: 미래 예약을 자동으로 취소하지 않고 명시적으로 차단한다 —
    예약 취소는 이미 Calendar 동기화·통지까지 포함한 별도 완결 흐름
    (`cancel_lesson_booking()`, R6)이고, 환불 승인이 그 전부를 몰래 트리거하면
    학생의 확정된 미래 수업이 관리자 의도와 무관하게 취소되는 부작용이 생긴다.
    자동 취소가 맞는 정책이라고 판단되면 `purchase_has_active_future_holds()`
    하나만 다른 구현으로 교체하면 된다(두 호출부가 전부 이 함수만 참조하도록
    설계). 체험수업권은 `purchase_id_ref`가 항상 null이라 이 WHERE 조건에
    애초에 걸리지 않아 환불 대상에서 자동 제외(요구사항 그대로 충족, 신규 코드
    불필요).
  - `refund_requests.within_full_refund_window` 신규 컬럼 — 요청 접수 시점의
    계산 근거(7일 전액환불 적용 여부)를 감사 이력으로 고정 보존.
  - **동시 환불·재시도 멱등성**: 새 로직 없이 기존 구조 재사용 — grant를
    `for update`로 잠그고 `v_remaining`이 이미 0이면 재차 insert하지 않는 기존
    가드가 그대로 동시/재시도 안전성을 보장한다(신규 코드가 추가한 유일한 관문은
    "차단 검사"뿐이고, 그 검사 자체도 매 호출마다 재평가되므로 재시도 안전).
  - **앱 레이어**: `app/admin/entitlement-actions.ts`의 `requestRefund()`가
    `blocked_by_active_holds`를 즉시 확인해 요청 접수 단계에서부터 친절한 에러로
    거부(이중 방어 — 승인 시점에도 `refund_entitlement()`가 다시 막음),
    `within_full_refund_window`를 `refund_requests`에 함께 저장.
    `listPendingRefundRequests()`가 `withinFullRefundWindow`를 반환하도록 확장.
    `app/admin/EntitlementLedgerTab.tsx`가 "구매 후 7일 이내 미사용(전액 환불
    적용)" 문구를 표시 — 내부 SQL 에러 원문이나 Stripe 비밀정보는 노출하지 않고
    친화적 한국어 메시지만 통과시키는 기존 관행 유지.
  - **실제 Stripe 호출 없음**: 이 세션은 `refund_entitlement()`/`calculate_purchase_refund_minor()`만
    다뤘고, 실제 결제사 자금 이동(Stripe Refund API)은 여전히 손대지 않았다 —
    기존 R4 설계 원칙("entitlement 쪽 결과는 이 함수가 확정, 결제사 쪽 자금 이동은
    별도 관심사", `approveRefund()` 상단 주석) 그대로 유지.
- **관리자·보호자 화면에 정확한 만료일·사용 조건 표시(요구사항)**:
  - `app/admin/consultation-scheduling-actions.ts`에 `attachTrialGrantExpiry()`
    신규 — `trial_entitlement_grant_id`가 있는 행에 실제 `entitlement_grants.expires_at`를
    batch 조회로 채운다(`ConsultationListItem.trial_entitlement_grant_expires_at`
    신규 필드). `ConsultationSchedulingPanel.tsx`가 지급 완료 상태일 때 "만료:
    YYYY-MM-DD HH:mm까지 체험수업이 시작해야 사용 가능"을 표시.
  - `app/parent/EntitlementsTab.tsx`의 체험수업권 카드 문구를 "만료 {날짜}까지
    체험 수업이 시작해야 사용할 수 있습니다(그 이후로는 예약해도 사용할 수
    없습니다) · 정규수업권과 별개이며 구매·환불·양도가 불가능합니다"로 구체화.

### 5.2 검증

- **로컬 `supabase db reset --local`**: 마이그레이션 적용 중
  `calculate_purchase_refund_minor()`의 리턴 타입 변경으로 실제 `ERROR: cannot
  change return type of existing function`을 만나 `drop function if exists`를
  추가해 해결 — 실측으로 발견·수정한 실제 문제(추측 아님).
- **psql 직접 검증(로컬 dev DB)** — 5개 시나리오 전부 실제 DB로 실행해 통과:
  - **A(7일 이내 전액환불)**: 확정 2일 전, 소진 0건인 20회 패키지 구매 →
    `refund_minor=350000`(package_price 전액), `within_full_refund_window=true`,
    `blocked_by_active_holds=false` 확인. 실제 `refund_entitlement()` 호출 →
    잔액 0 확인.
  - **B(7일 밖, 소진 반영)**: 확정 30일 전, consume 3건 → `refund_minor=284375`
    (=350000−3×21875), `within_full_refund_window=false` 확인. 환불 호출 → 잔액
    0 확인(원래 잔량 17 → 0).
  - **C(미래 활성 hold 차단)**: 확정 30일 전, 5일 뒤 미래 예약에 hold 1건 →
    `blocked_by_active_holds=true` 확인. `refund_entitlement()` 직접 호출 →
    정확히 그 에러 메시지로 거부됨을 확인(PASS) → `release_entitlement()`로
    그 예약을 해제한 뒤 재시도 → 정상 환불(잔액 0) → **같은 호출을 한 번 더
    재시도(idempotent 재시도 시뮬레이션)** → 잔액 그대로 0(중복 차감 없음, PASS).
  - **D(체험 grant 자동 제외)**: `trial_recommended` outcome으로 실제 체험 grant
    지급 후, 무관한 임의 purchase id로 `refund_entitlement()` 호출 → 매칭되는
    grant가 없어 조용히 no-op(에러 없음) — 체험 grant 자체가 이 경로에 절대
    걸리지 않음을 별도로 재확인.
  - **E(90일 만료 경계)**: 방금 지급된 체험 grant의 `expires_at`을 과거로 강제
    변경 → `hold_entitlement(..., p_lesson_type_id=trial)` 호출 → "사용 가능한
    수업권이 없습니다."로 정확히 거부됨을 확인(PASS) — 만료 이후 체험 시작 시각은
    hold 자체가 성립하지 않음을 실측 확인.
- **`tsc --noEmit`**: 클린(2라운드 코드 반영 후).
- **전체 Vitest**: **849건 통과**(1라운드 846건 + 2라운드 신규 3건 —
  `requestRefund` 7일 이내 전액환불 저장 테스트, `requestRefund` 미래 hold 차단
  테스트, `EntitlementLedgerTab` 7일 이내 라벨 표시 테스트). 회귀 없음.
- **`next build`**: 성공.
- **미완료(세션 중단으로 인함)**: 2라운드 관련 Playwright 재실행
  (`r4-admin-entitlement-ledger`/`r4-purchase-flow` 등)과 별도 clean
  `git worktree` 재현은 실행하지 못했다 — 이 세션이 로컬 Supabase DB를 다른
  세션(제품 오너의 실제 Google Sandbox 재검증)과 공유하는 충돌이 발견돼 DB를
  건드리는 모든 명령(추가 `db reset --local`/psql)을 즉시 중단하라는 지시를
  받았다. 이미 실행한 psql 검증(위 A~E)은 그 지시 이전에 완료된 것이라 유효하게
  남는다. **재개 승인 후 다음을 이어서 실행해야 한다**: (1) 관련 Playwright 스펙
  재실행, (2) 커밋 후 clean worktree에서 build+Vitest 재현, (3) 최종 커밋.

### 5.3 미완료 / 결정 필요

- **결정 필요**: 없음 — 90일 유효기간, 환불 공식(7일 전액/그 외 소진 반영),
  미래 hold 차단 정책 전부 이번 지시로 확정·구현 완료.
- **미완료(세션 중단, 재개 대기)**: 2라운드 관련 Playwright 재실행, 별도 clean
  worktree 재현. 코드 자체는 이미 실제 로컬 DB(psql)로 검증 완료 — DB 재현·E2E만
  남음.
- **미완료(범위 밖, 변경 없음)**: 실제 Stripe Refund API 호출은 여전히 미연동
  (기존 R4 blocker 그대로).

### 5.4 외부 변경(2라운드)

Stripe/DocuSign/Google API 실호출, 실제 이메일 발송, Production/원격 DB 접근 전부
0건. 모든 외부 플래그 기본값(false/미설정) 유지. `git push` 하지 않음. 로컬
Supabase DB는 이 세션이 `supabase db reset --local`을 여러 번 실행했고, 그중
한 번이 같은 로컬 DB를 쓰던 다른 세션(제품 오너의 Google Sandbox 재검증)의 테스트
데이터를 지웠다 — 발견 즉시 이 세션은 추가 DB 조작을 전부 중단했다(아래 최종
보고 참고).
