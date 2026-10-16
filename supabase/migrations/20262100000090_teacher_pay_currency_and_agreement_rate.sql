-- Teacher pay currency + agreement-linked rate (additive).
-- 1) teachers.pay_currency: currency the teacher is paid in. teacher_rate_history.currency stays the source of truth for the
--    rate itself (the settlement pipeline already snapshots it per session); this column is the admin-facing mirror.
-- 2) teacher_rate_history.agreement_contract_id: the signed agreement that accepted this rate.
-- 3) set_teacher_rate(): keep pay_currency in sync, and keep the legacy KRW-only cache teachers.hourly_rate_krw
--    KRW-only (a USD amount must never land in a *_krw column; legacy payout code would pay it as won).
-- 4) agreement_form accepts the U.S. independent-contractor form.
alter table teachers
  add column pay_currency text not null default 'KRW' check (pay_currency in ('KRW', 'USD'));

alter table teacher_rate_history
  add column agreement_contract_id uuid references teacher_contracts (id);

alter table teacher_contracts drop constraint if exists teacher_contracts_agreement_form_check;
alter table teacher_contracts
  add constraint teacher_contracts_agreement_form_check
  check (agreement_form is null or agreement_form in ('california_employment', 'non_us_services', 'us_contractor_services'));

create or replace function public.set_teacher_rate(
  p_teacher_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_effective_from timestamptz default clock_timestamp()
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_current record;
  v_new_id uuid;
begin
  if p_amount_minor <= 0 then
    raise exception 'p_amount_minor는 0보다 커야 합니다(받은 값: %).', p_amount_minor;
  end if;
  if p_currency is null or p_currency not in ('KRW', 'USD') then
    raise exception 'p_currency는 KRW 또는 USD여야 합니다(받은 값: %).', p_currency;
  end if;

  perform 1 from teacher_rate_history where teacher_id = p_teacher_id for update;

  select * into v_current from teacher_rate_history
    where teacher_id = p_teacher_id and effective_until is null;

  if v_current.id is not null then
    if p_effective_from <= v_current.effective_from then
      raise exception '새 effective_from(%)은 기존 현재 이력의 effective_from(%)보다 이후여야 합니다.', p_effective_from, v_current.effective_from;
    end if;

    insert into public.status_transition_tokens (table_name, row_id, action)
    values ('teacher_rate_history', v_current.id, 'close_teacher_rate');

    update teacher_rate_history
      set effective_until = p_effective_from
      where id = v_current.id;
  end if;

  insert into teacher_rate_history (teacher_id, amount_minor, currency, effective_from)
  values (p_teacher_id, p_amount_minor, p_currency, p_effective_from)
  returning id into v_new_id;

  update teachers
    set pay_currency = p_currency,
        hourly_rate_krw = case when p_currency = 'KRW' then p_amount_minor else null end
    where id = p_teacher_id;

  return v_new_id;
end;
$$;
revoke execute on function public.set_teacher_rate(uuid, bigint, text, timestamptz) from public, anon, authenticated;
grant execute on function public.set_teacher_rate(uuid, bigint, text, timestamptz) to service_role;
