# 선생님 계약 변경 적용 절차 (내부 메모, 2026-10-06)

서명된 선생님 계약은 아직 없다. 아래는 서명 후 조건이 바뀔 때의 절차 제안이다. 계약 문안은 기획 세션 소관이다.

## 원칙
- 서명된 계약 원문과 teacher_contracts.inputs_snapshot(시급·통화 포함)은 수정하지 않는다.
- 변경은 서면 합의서(addendum)로만 한다. 시급 변경 합의서 초안은 docs/contracts/teacher-rate-change-addendum-v0.1-draft.md.
- 합의서 서명 완료 전에는 시스템 값(시급, 지급일 설정)을 바꾸지 않는다. 변경은 장래 적용만 가능하며 과거 수업과 이미 확정된 정산 묶음은 바꾸지 않는다.

## 절차
1. 관리자가 변경 항목(시급·통화·지급일·해지 통지기간 등), 적용 시작일, 사유를 기록한다.
2. 합의서를 발송하고 서명을 받는다. 거부·무효 시 기존 조건이 유지된다.
3. 서명 완료 후 적용 시작일 기준으로 반영한다.
   - 시급: set_teacher_rate()로 새 이력을 만들고 agreement_contract_id에 합의서 계약 ID를 연결한다(적용 시작일은 effective_from).
   - 지급일: 지급일 규칙은 정산 설정과 지급 예정일(payout_batches.scheduled_payout_date는 묶음별 저장값)이 소유한다. 적용 시작일 이후 승인되는 묶음부터 새 규칙을 적용하고, 이미 승인된 묶음은 관리자 예정일 변경 기능(사유·감사 이력 포함)으로 개별 처리한다.
4. 합의서와 변경 전후 값은 계약 보관 폴더에 원계약과 함께 보관한다.

## 지급일이 다른 기존 서명 계약
- 새 지급일 문구(26일/10일, 태평양시, 직전 영업일)는 신규 계약부터 적용한다. 이미 서명된 계약은 합의서 없이 일방 변경하지 않는다.
- 서명 계약의 지급일이 새 기준보다 늦다면, 회사가 더 일찍 지급하는 방향은 교사에게 불리하지 않으므로 서면 통지 후 적용할 수 있다. 더 늦어지는 방향은 반드시 합의서가 필요하다.

## 코드 현황 (참고)
- 지급 요청일과 실제 지급 완료일은 구분된다. payout_batches에 dispatch_requested_at(송금 요청), provider_pending_at, provider_confirmed_at(제공자 최종 확인), paid_at, external_transfer_recorded_at(외부 송금 기록)이 있고, 상태는 approved, dispatch_requested, provider_pending, paid로 나뉜다. paid는 provider_transaction_id와 provider_confirmed_at(또는 외부 송금 기록)이 있어야만 전이된다. 즉 요청일은 dispatch_requested_at, 완료일은 paid_at 또는 provider_confirmed_at이다.
- 계약서가 말하는 "지급 기한"을 어느 시각으로 볼지(요청 시점 대 완료 시점)는 아직 정해지지 않았다. 제안: 기한 준수는 송금 요청이 아니라 지급 완료 시각으로 판단한다.
