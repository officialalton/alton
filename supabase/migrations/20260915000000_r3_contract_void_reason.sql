-- R3 (Step 6 후속, 신규 additive 마이그레이션) — 계약 무효화(void) 사유 저장 컬럼.
--
-- 배경: 확정 정책 "보호자 서명 거부(DocuSign declined) → contract_versions의
-- envelope 상태에 declined 기록 + contracts.status='void' + 거부 사유 저장"과
-- "무효(void): voidContractVersion(contractVersionId, reason) 관리자 액션"을
-- 구현하려면 사유를 담을 컬럼이 필요하다. 기존 스키마(20260911000000 contracts,
-- 20260913000000 contract_versions)에는 이런 컬럼이 없다(grep 결과 없음) — 진짜
-- gap이므로 순수 additive로 최소 컬럼만 추가한다. 기존 컬럼/enum 값은 건드리지
-- 않는다. v3_contract_status enum에는 새 상태를 추가하지 않는다(정책: void는
-- 기존 enum 값 재사용).

alter table contracts add column if not exists void_reason text;
alter table contracts add column if not exists voided_at timestamptz;

comment on column contracts.void_reason is
  'R3 추가(20260915): 계약이 void 상태로 전이된 사유. DocuSign declined 웹훅이 자동으로 채우거나(거부 사유), '
  '관리자의 수동 voidContractVersion() 호출이 채운다(가족 자진 철회 등 DocuSign 이벤트와 무관한 무효화).';
comment on column contracts.voided_at is
  'R3 추가(20260915): void 상태로 전이된 시각. 웹훅/수동 무효화 공통.';
