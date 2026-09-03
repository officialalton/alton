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

## 4. 외부 변경

Stripe/DocuSign/Google API 실호출, 실제 이메일 발송, Production/원격 DB 접근 전부
0건. 모든 외부 플래그 기본값(false/미설정) 유지. `git push` 하지 않음(로컬 커밋
`007e917`만 존재, main 브랜치).
