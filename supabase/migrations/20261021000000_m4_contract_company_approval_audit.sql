-- M4: 회사 측 계약 처리 방식을 "DocuSign 전자서명"에서 "인증된 관리자의
-- 전자승인 기록을 계약서에 삽입 후 발송"으로 확정(사용자 지시, 2026-09-05).
-- contract_versions.company_signed_at/company_signed_by는 기존 "발송 전
-- 승인됐는지" 게이트로 그대로 유지하고, 이 테이블은 그 승인의 세부 내용(승인자
-- 이름·직함, 계약 주체, 문서 식별값)을 변경 불가능한 감사 이력으로 별도 보존한다.
-- 발송되는 문서 HTML에 그대로 삽입되는 값이므로 사후 수정이 불가능해야 한다.

create table if not exists contract_company_approvals (
  id uuid primary key default gen_random_uuid(),
  contract_version_id uuid not null references contract_versions(id) unique,
  approved_by uuid not null references auth.users(id),
  approver_name text not null,
  approver_title text,
  company_entity_name text not null,
  document_identifier text not null,
  approved_at timestamptz not null default now()
);

alter table contract_company_approvals enable row level security;

-- 감사 이력이므로 수정·삭제를 완전히 차단한다(기존 reject_guardian_students_mutation과
-- 동일한 패턴 — 이 저장소에서 "변경 불가능"을 강제하는 표준 방식).
create or replace function reject_contract_company_approvals_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'contract_company_approvals는 수정·삭제할 수 없는 감사 이력입니다.';
end;
$$;

drop trigger if exists trg_reject_contract_company_approvals_update on contract_company_approvals;
create trigger trg_reject_contract_company_approvals_update
before update on contract_company_approvals
for each row execute function reject_contract_company_approvals_mutation();

drop trigger if exists trg_reject_contract_company_approvals_delete on contract_company_approvals;
create trigger trg_reject_contract_company_approvals_delete
before delete on contract_company_approvals
for each row execute function reject_contract_company_approvals_mutation();

-- 관리자 서버 액션(service role)만 이 테이블을 다룬다 — 일반 사용자 role에는
-- 정책을 열어주지 않는다(다른 관리자 전용 감사성 테이블과 동일한 기본값).
