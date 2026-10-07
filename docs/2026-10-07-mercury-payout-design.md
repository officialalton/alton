# Mercury 지급 통합 설계 (내부) — 2026-10-07

Wise 계획(교사 정산 Wise 전용, 2026-09-12)을 대체한다. US=USD ACH(기본), KR=KRW 국제송금. 회계는 Mercury Books. 근거 문서: `docs/2026-10-07-mercury-capabilities.md`. ALTON은 회계 프로그램이 아니라 **정산 보조원장**(계약 금액 ↔ 실제 이체 연결)만 보유한다.

## 1. 현행 코드 조사 결과 (Phase 1)

| 영역 | 실제 위치 |
|---|---|
| 교사 시급 계산 | `upsert_session_payout_item(session_id)` (DB). `amount = round(hourly_rate_snapshot_minor × payable_minutes / 60.0)`, 시급은 `teacher_rate_history`(`lib/teacher-agreements/rate.ts`) 스냅샷, 승인 이후 변경은 `adjustment` 항목으로 다음 정산에 이월 |
| 수업 외 시간 집계 | **코드·테이블 없음**(계약서에만 "필수 비수업 업무는 시급×실제 분"). 수동 `adjustment` 항목으로만 가능 → 별도 과제 |
| 컨설턴트 월 보수 | **계산 로직 없음.** 관리자가 `consultant_payout_periods.amount_minor`를 직접 입력·확정(`app/admin/consultant-settlement-actions.ts`). 계약서 월정액(`monthlyFee`)과 연동되지 않음 |
| 정산 묶음 | `payout_batches`(교사×기간×단일통화) + `payout_items`. 상태 `draft/reviewing/calculated/reviewed/approved/dispatch_requested/provider_pending/processing/paid/failed`. 함수 `generate_payout_batches`, `submit_payout_batch_for_review`, `approve_payout_batch`, `dispatch_payout_batch`, `mark_payout_batch_provider_pending/confirmed/paid/failed/processing`, `record_external_payout_transfer`, `reverse_payout_item`, `add_payout_batch_adjustment` |
| 지급 완료 규칙 | `payout_batches_paid_requires_confirmation`: paid는 (provider_transaction_id + provider_confirmed_at) 또는 `external_transfer_recorded_at`가 있어야 함. 트리거 `guard_payout_batch_paid_transition` |
| Wise/Mercury 현황 | 클라이언트 코드 **없음**. `TEACHER_PAYOUT_PROVIDER = "wise"` 상수(`lib/payout/auto-dispatch.ts`), `dispatch_payout_batch(…, p_provider)`는 이미 `mercury|wise` 허용, `payout_batches.provider` 컬럼 존재. 관리자 화면 한국어 문구에 "Wise 송금 요청"(`PayoutBatchesTab.tsx` 671·682·762·852행) |
| 스위치 | DB `payout_disbursement_gate.real_disbursement_enabled`(기본 false), `payout_auto_dispatch_settings.enabled`, env `PAYOUT_CRON_ENABLED`(+`CRON_SECRET`), 크론 `/api/cron/close-payout-month`·`/api/cron/dispatch-approved-payouts`(매일 17:00 UTC) |
| 지급 일정 | `lib/payout/payout-schedule.ts`(26일/10일, 직전 영업일, `transferRequestDate`), `us-bank-holidays.ts`, DB `payout_bank_holidays`, `payout_settings.transfer_lead_business_days`(기본 3) |
| 수취 계좌 | `teacher_payout_accounts`, `consultant_payout_accounts`(번호·SWIFT/라우팅 `bytea` 암호화, Vault 키, last4, `entered_by_admin`), 변경 이벤트·`*_account_reveals` 감사 테이블, 사유 5자 이상 전체 번호 보기 |
| 결제/환불 | `payment_attempts`(stripe_payment_intent_id), `payment_disputes`, `refund_requests`, `entitlement_ledger`, Stripe 웹훅 `app/api/webhooks/stripe/route.ts`. **회계 내보내기(CSV) 없음** |
| 계약 문구 | Wise 전용 문구 **없음**(계약서는 "Bank transfer (wire)"). 상세는 `docs/2026-10-07-contract-wording-changes.md` |

### 변경 목록(요약)
- 신규: `payout_attempts`, `payout_recipient_links`, `payout_kr_bank_holidays`, `payout_attempt_events`, `accounting_account_map`, 뷰 `payout_reconciliation_rows`, 마이그레이션 `20262100000300`.
- 신규 코드: `lib/payout/providers/*`, `lib/payout/attempts.ts`, `lib/payout/kr-bank-holidays.ts`, `lib/payout/reconciliation-csv.ts`, 서버 액션·영어 관리자 패널·CSV 라우트.
- 수정: `TEACHER_PAYOUT_PROVIDER` 상수 폐기(provider는 기록 단위), 한국어 "Wise" 문구 → provider 중립 문구, 정책 대장 갱신.
- **보존**: 기존 `payout_batches`·`provider_transaction_id`·`external_transfer_*`·과거 Wise 기록은 그대로. 새 거래는 `payout_attempts.provider='mercury'`로 구분. 과거 batch에 provider가 null이면 읽기 시 'unknown/manual'로 표시(덮어쓰지 않음).

## 2. 데이터 모델

정산(settlement) = 기존 `payout_batches`(교사) / `consultant_payout_periods`(컨설턴트). **시도(attempt)** = 신규 `payout_attempts`. 한 정산에 여러 시도(실패·반환·재송금·부족분 보충).

`payout_attempts` 핵심 필드
- 연결: `settlement_batch_id`/`settlement_consultant_period_id`(둘 중 하나), `recipient_profile_id`, `recipient_kind`(teacher|consultant), `contract_id`(nullable, 서명 계약 연결), `period_start/end`
- 구분: `provider`(wise|mercury|manual), `rail`(ach|international_wire|manual), `kind`(normal|resend|top_up), `original_attempt_id`(재송금·보충 원 시도), `attempt_no`
- 금액: `contractual_amount_minor`+`contractual_currency`(계약 원본), `requested_amount_minor`+`requested_currency`(실제 요청 통화·금액; KRW 송금이면 KRW), `actual_usd_principal_minor`, `actual_usd_fee_minor`, `actual_usd_total_debit_minor`(**실제**, 확정 전 null), `received_amount_minor`+`received_currency`(수취 확인액)
- 환율: `quoted_fx_rate`(견적)·`final_fx_rate`(확정), `fx_locked_at` — 견적과 확정을 별도 필드로 분리
- 일정: `payment_deadline`(계약 기한 — 26일/10일 보정일)과 `scheduled_transfer_date`(송금 예정일) **별개 컬럼**, 송금일 ≤ 기한
- 승인: `approved_by/approved_at`, `approval_invalidated_at/reason`
- 외부: `payout_request_id`(Mercury request-send-money id), `provider_transaction_id`, `tracking_url`, `receipt_url`, `idempotency_key`(uuid, 정산당 normal 1건)
- 시각: `requested_at`, `sent_at`, `received_confirmed_at`, `received_evidence`, `failed_at`, `failure_reason`, `returned_at`, `return_reason`, `returned_usd_minor`, `return_transaction_id`
- 플래그: `needs_review_reasons text[]`(short_received, fee_deducted, late, returned_amount_mismatch, recipient_changed, amount_changed, unverified_calendar 등)

### 상태 (시도 단위)
정산 상태(draft→awaiting approval→settlement approved)는 기존 batch/period 상태를 그대로 사용한다. 시도 상태:
`queued`(정산 승인됨·송금 요청 전) → `awaiting_mercury_approval` → `processing` → `sent` → `receipt_confirmed`; 분기 `failed`, `returned`, `cancelled`, `needs_review`. **`sent`는 지급 완료가 아니다**: `receipt_confirmed`는 증빙(수취 확인 방식·시각·메모 필수)이 있어야 하며, 정산이 `paid`가 되는 조건에 연결한다(기존 paid 가드는 유지: provider_transaction_id + provider_confirmed_at).
전이는 DB 함수 `payout_attempt_transition()` 한 곳. 허용표 외 전이 거부, 같은 상태로의 재호출은 무동작(멱등), 모든 전이는 `payout_attempt_events`(INSERT-only)에 기록.

### 수취인 (`payout_recipient_links`)
Mercury 쪽이 은행정보 원본. ALTON은 `provider_recipient_id`, 계약 ID, 근무국가, 수취 국가·통화, 은행명, last4, 등록/검증 상태(`not_invited|invited|registered|verified|reverify_required|disabled`), `last_changed_at`만 보관한다.
**결정(권장)**: 기존 암호화 `teacher/consultant_payout_accounts`는 마이그레이션하지 않고 **등록 참조원·수동(KRW) 경로용 입력원**으로 유지한다(오너 10-06 정책: 최초 1회 입력·마스킹·감사 열람). Mercury 초대(invite)로 본인이 입력하는 경로를 우선 도입하고, 초대가 안정되면 전체 번호 저장 폐기 여부를 별도 결정한다. 계좌 변경 시 트리거가 링크를 `reverify_required`로 바꾸고 미실행 시도(queued/awaiting_mercury_approval)를 `needs_review`(recipient_changed)로 돌려 **재검증·재승인** 전에는 요청할 수 없다. 한국 계좌 필수 필드는 Mercury 실제 KRW 수취인 폼과 한국 시중은행 해외송금 수취 안내로 확정(미해결 항목 — capabilities 문서 4절).

## 3. 일정: 기한 vs 송금 예정일
- 기한: 기존 규칙(26일/10일, 주말·미국 연방 은행 휴일은 직전 영업일, LA).
- USD ACH: 송금 예정일 = 기한 − N 미국 영업일(설정 `transfer_lead_business_days`, 기본 3).
- KRW 국제송금: 도착이 기한 이내여야 하므로 **미국·한국 은행이 모두 영업하는 날만 센다**. 도착 목표일 = 기한 이전의 한·미 공통 영업일, 송금 예정일 = 목표일 − `transfer_lead_business_days_krw`(기본 5 공통 영업일: Mercury 1–3영업일 + 한국 은행 입금 여유). **첫 지급 실측 뒤 재조정.** 한국 휴일표(`payout_kr_bank_holidays`)가 해당 연도를 덮지 못하면 `unverified_calendar` 플래그를 달아 관리자 확인을 요구한다(2026년만 검증, 이후 연도는 월력요항 확인 후 추가).
- 관리자 변경·사유 필수·과거일 금지는 기존 `payout_apply_date_change` 규칙을 따른다(시도에는 복제하지 않고 기한 컬럼만 스냅샷).

## 4. 멱등성·예외
- 정산당 normal 시도는 활성 1건만(부분 유니크: kind='normal' AND status NOT IN failed/returned/cancelled). 재송금은 `kind='resend'`로 `original_attempt_id`를 가리킨다.
- 요청 전 DB가 `idempotency_key`를 먼저 확정·저장 → Mercury에는 이 키를 `idempotencyKey`로 전송. 응답 유실·타임아웃이면 `request_uncertain` 표시 후 **재시도 전에 조회**(`externalMemo`에 `ALTON:<attempt id>`를 넣고 request-send-money 목록에서 매칭)한다. Mercury는 같은 수취인·금액 24시간 내 중복을 400으로 막으므로 이중 방어가 된다.
- 승인 후 금액·수취인 변경 → 승인 무효(`approval_invalidated_*`, 상태 `needs_review`), 재승인 후에만 진행. 금액 변경 감지: `payout_items`(batch)·`consultant_payout_periods.amount_minor` 트리거.
- 반환(returned)은 **별도 반환 거래**로 기록(`return_transaction_id`, `returned_usd_minor`); 원 거래 행은 지우지 않는다. 반환 USD ≠ 원 출금 USD면 차이를 플래그(`returned_amount_mismatch`).
- 부족 수취·수수료 차감·기한 경과 도착은 `needs_review_reasons`에 기록되어 관리자 확인 대상. 부족분 보충은 `kind='top_up'` 별도 승인·원 정산 연결.
- **첫 한국 지급 전까지** 실제 수취 KRW 금액·은행 수수료·소요 시간은 미확인이다. 화면·문구 어디에서도 "전액 KRW 수령"을 단정하지 않는다(수취 확인 입력으로만 채움).

## 5. 권한 (capability 문자열, `supervisor_capabilities`)
마스터 관리자는 전부 허용. 분리 항목:
| capability | 가능 |
|---|---|
| `payout_settlement_edit` | 정산 작성·조정(기존 정산 화면) |
| `payout_settlement_approve` | 정산 승인 |
| `payout_request_mercury` | Mercury 지급 요청 생성·수취인 초대·거래 ID 연결 |
| `payout_approve_mercury` | 지급 시도 승인·승인 무효 해제(재승인) |
| `accounting_reconcile` | 대사 파일·지급 목록 다운로드, 대사 확인 표시 |
기존 `정산권한`은 조회·정산 권한으로 계속 인정(하위 호환), 은행정보 전체 번호는 기존 `payout_account_staff_allowed` 규칙 유지. **같은 사람이 정산 승인과 지급 승인을 모두 하는 것을 DB가 막는다**(approved_by 다르게). 일반 사용자에게 은행정보·타인 보수 노출 없음(`payout_attempts`·링크 RLS: 관리자/capability만, 교사는 본인 시도의 상태 요약만 볼 수 있는 뷰는 이번 범위 밖).

## 6. 관리자 화면 (영어, 이 지급/회계 영역 한정)
Payouts → "Mercury payouts" 패널: US(USD)/KR(KRW) 필터, 기간·기한·송금 예정일, 수취인별 금액·통화, 은행정보 등록 상태, 승인/송금/수취 상태, 실제 USD 출금·수수료, Mercury 거래/추적/영수증 링크, 실패·반환·미지급·대사 불일치 목록, **지급 목록 CSV**·**대사 CSV** 다운로드. KRW는 "Download Mercury input list" + 거래 ID 연결 폼. 모든 실행 버튼은 스위치가 닫혀 있으면 비활성 + 이유 표시.

## 7. 스위치 (전부 닫힘 유지)
1. `MERCURY_PAYOUTS_ENABLED`(env, 기본 미설정=false) — API 클라이언트가 실호출을 하는 조건
2. `payout_disbursement_gate.real_disbursement_enabled`(DB, 기본 false)
3. `payout_auto_dispatch_settings.enabled` / `PAYOUT_CRON_ENABLED`
4. 클라이언트는 위 1·2가 모두 열려야 요청을 보내며, 테스트는 주입된 가짜 fetch/가짜 provider만 쓴다.

## 8. Books 연계 요약
`docs/2026-10-07-mercury-books-reconciliation.md` 참조. ALTON은 KRW 정산 원본과 정산 ID·Mercury 거래 ID를 보유, Books는 USD 실거래를 보유. 두 시스템은 정산 ID + 거래 ID로만 연결하고, 합계는 통화를 섞어 비교하지 않는다.
