-- Teacher agreement send path (additive).
-- 1) teacher_agreement_inputs: the per-teacher facts the agreement forms need. Form selection uses the ACTUAL work
--    location (work_country / work_region), never nationality or account role. Admin-only.
-- 2) teacher_contracts: DocuSign envelope status, form, template version and sender snapshot for the new send path.
--    Legacy rows are untouched; `status` stays ('sent','signed') because get_teacher_activation_checklist() reads it.
create table teacher_agreement_inputs (
  teacher_id uuid primary key references teachers (id) on delete cascade,
  work_country text check (work_country is null or work_country ~ '^[A-Z]{2}$'),
  work_region text check (work_region is null or char_length(work_region) between 2 and 60),
  work_location_detail text check (work_location_detail is null or char_length(work_location_detail) between 2 and 200),
  mailing_address text check (mailing_address is null or char_length(mailing_address) between 5 and 300),
  start_date date,
  supervisor_name text check (supervisor_name is null or char_length(supervisor_name) between 2 and 120),
  prior_materials text check (prior_materials is null or char_length(prior_materials) between 2 and 2000),
  non_lesson_terms text check (non_lesson_terms is null or char_length(non_lesson_terms) between 2 and 2000),
  payment_details text check (payment_details is null or char_length(payment_details) between 2 and 500),
  updated_by uuid references profiles (id),
  updated_at timestamptz not null default now()
);
alter table teacher_agreement_inputs enable row level security;
create policy "관리자만 조회" on teacher_agreement_inputs for select using (is_admin());
create policy "관리자만 쓰기" on teacher_agreement_inputs for insert with check (is_admin());
create policy "관리자만 수정" on teacher_agreement_inputs for update using (is_admin());

alter table teacher_contracts
  add column agreement_form text check (agreement_form in ('california_employment', 'non_us_services')),
  add column template_version text,
  add column docusign_envelope_status text check (docusign_envelope_status in ('sent', 'delivered', 'completed', 'declined', 'voided')),
  add column docusign_status_updated_at timestamptz,
  add column sent_at timestamptz,
  add column sent_by uuid references profiles (id),
  add column recipient_email text,
  add column inputs_snapshot jsonb;

-- One open (unsigned, not declined/voided) agreement per teacher; a declined or voided one can be re-sent.
create unique index teacher_contracts_one_open_agreement
  on teacher_contracts (teacher_id)
  where agreement_form is not null and status = 'sent' and docusign_envelope_status in ('sent', 'delivered');
create unique index teacher_contracts_envelope_unique
  on teacher_contracts (docusign_envelope_id) where docusign_envelope_id is not null;

-- A signed agreement can never be rewritten.
create or replace function public.protect_signed_teacher_contract()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'signed' then raise exception '서명 완료된 선생님 계약 기록은 삭제할 수 없습니다.'; end if;
    return old;
  end if;
  if old.status = 'signed' and (to_jsonb(new) is distinct from to_jsonb(old)) then
    raise exception '서명 완료된 선생님 계약 기록은 수정할 수 없습니다.';
  end if;
  return new;
end;
$$;
drop trigger if exists teacher_contracts_protect_signed on teacher_contracts;
create trigger teacher_contracts_protect_signed
  before update or delete on teacher_contracts
  for each row execute function public.protect_signed_teacher_contract();
