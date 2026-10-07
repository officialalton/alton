# Mercury Books 대사 절차 — 2026-10-07

전제(공개 문서 기준, 실계정 확인 전): Mercury Books는 Mercury 은행·카드·인보이스·빌페이 활동을 자동 반영하고 Stripe 등과 공식 연결을 제공한다. **ALTON→Books로 분개를 쓰는 공개 API는 확인되지 않았다**(capabilities 문서 1절). 따라서 대사는 "ALTON 대사 파일 ↔ Books 화면/리포트 대조"가 기본이고, 자동화는 읽기 방향(Mercury 거래·웹훅 → ALTON 보조원장)으로 한정한다.

## 1. 원칙
- 고객 결제(Stripe)는 **Books의 Stripe 공식 연결**로만 들어간다. ALTON은 Stripe 거래를 Books용 파일에 넣지 않는다(이중 기록 방지).
- Mercury 은행 거래는 Books가 은행 연결로 자동 수집한다. **CSV로 이미 자동 수집된 거래를 다시 가져오지 않는다.** ALTON 대사 파일의 모든 행은 `import_into_books=false`(참조용)이다.
- ALTON은 KRW 정산 원본(계약 금액·승인 정산)을, Books는 실제 USD 출금·수수료·환차손익을 가진다. 연결 키는 **정산 ID + Mercury 거래 ID**. KRW 합계를 USD 출금과 직접 비교하지 않는다.
- 회계 판단(계정과목, 인식 시점)은 회계사 검토 대상이다. 아래 매핑은 `accounting_account_map` 설정으로 두고 회계사가 이름을 바꿀 수 있다.

## 2. 계정과목 매핑(초안, 회계사 검토 필요 — 설정 키 / 의미)
| 키 | 의미 |
|---|---|
| `teacher_compensation` | 교사 보수(수업 용역) |
| `consultant_compensation` | 컨설턴트 보수 |
| `transfer_fx_fees` | 송금·환전 수수료(회사 부담) |
| `payment_processing_fees` | 결제 처리 수수료(Stripe) |
| `customer_payments` / `customer_refunds` | 고객 결제 / 환불 |
| `accrued_compensation` | 미지급 보수(정산 승인 후 미송금) |
| `deferred_revenue` / `revenue_recognized` | 선수금(수업권) / 수업 제공 시 인식 매출 |
| `fx_gain_loss` | 환차손익 |
| `intercompany_transfers` | 자기 계좌 간 이동 |

## 3. 월 대사 절차
1. 관리자: ALTON "Accounting reconciliation" CSV 다운로드(기간 선택). 열: settlement_id, attempt_id, recipient, period, contractual amount/currency, requested amount/currency, provider, Mercury transaction id, status, sent/received 시각, actual USD principal/fee/total debit, quoted/final FX rate, return transaction, flags.
2. Books에서 같은 기간 Mercury 은행 계정 거래를 연다. 거래 ID(또는 금액·날짜)로 각 ALTON 행의 USD 출금을 찾아 대조: `actual_usd_total_debit` = 원금+수수료.
3. 행별 판정(ALTON CSV의 `reconciliation_flag` 열이 1차 판정):
   - `ok`: 거래 ID 있음 + 실제 USD 금액 기록 + 수취 확인됨
   - `missing_transaction` / `missing_actual_usd` / `awaiting_receipt` / `returned` / `return_amount_mismatch` / `needs_review`
4. 수수료·환차는 Books에서 `transfer_fx_fees`, `fx_gain_loss`로 분류됐는지 확인. KRW 원본과 비교하지 않고 **환율 확정치(final_fx_rate)로 USD 원금이 설명되는지만** 본다.
5. 반환: Books에 반환 입금이 별도 거래로 있는지 확인, 원 출금과 차이는 `return_amount_mismatch`로 남기고 환차/수수료로 분류.
6. 이상 없으면 ALTON에서 해당 시도를 "reconciled" 표시(후속 구현 범위 — 현재는 CSV 대조 후 수동 기록).

## 4. 자동화 가능 / 수동
| 항목 | 상태 |
|---|---|
| Mercury 거래 → ALTON 보조원장(웹훅·조회) | 자동 가능(구현됨, 스위치 닫힘) |
| ALTON 대사 CSV 생성·다운로드 | 자동(구현됨) |
| Stripe → Books | Books 공식 연결(오너가 Books에서 설정, ALTON 코드 없음) |
| Mercury 은행 → Books | Books 자동 |
| ALTON → Books 분개 | **불가(공개 API 미확인)** — 수동/회계사 |
| 대사 판정 확정·마감 | 수동(회계사/오너) |
| 계정과목표 구성 | Books 화면 수동, ALTON은 매핑 설정만 참고용 보관 |

## 5. 실계정 확인 필요
Books 계정과목 템플릿, Stripe 연결의 수수료·정산(payout) 처리 방식(Stripe payout이 Mercury 입금으로 이중 기록되지 않는지), Mercury 거래의 `glAllocations` 노출, 다통화 거래의 Books 표기, 회계 쓰기 API 유무.
