-- R3 후속(2026-09-01) — 복귀 회원 계약 처리를 위한 최소 판단 구조 준비.
--
-- 배경: 새 재가입 기능을 지금 만들지 않는다. 나중에 붙일 때 기존 계약 구조를
-- 다시 뜯지 않도록, "왜 이 버전이 생겼는지"를 기록할 필드 하나만 additive로
-- 추가한다. 기존 버전 superseded 처리·envelope 1:1 연결 구조는 그대로 재사용.

create type v3_contract_version_reason as enum (
  'initial',
  'resend',
  're_enrollment',
  'material_terms_change',
  'party_change'
);

alter table contract_versions
  add column version_reason v3_contract_version_reason not null default 'initial';

comment on column contract_versions.version_reason is
  '이 버전이 생성된 사유. initial=최초 계약, resend=서명 실패/거부 후 동일 사유로 재발송,'
  ' re_enrollment=해지·무효·만료 후 복귀 재가입, material_terms_change=계약 당사자 아닌'
  ' 중요 약관 변경, party_change=계약 당사자·회사 법적 주체 변경. 기존 행은 모두'
  ' initial로 채워진다(default 값, 별도 backfill 불필요).';
