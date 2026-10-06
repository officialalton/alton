-- Consultant agreements + teacher rate-change addendum (additive).
-- 1) teacher_contracts / teacher_agreement_inputs may hold consultant profile ids (FK widened from teachers to profiles).
-- 2) agreement_form accepts us_contractor_services (already), consultant_services and teacher_rate_addendum.
-- 3) teacher_contracts.amends_contract_id links an addendum to the signed agreement it amends.
-- 4) Consultant monthly-fee inputs.
-- 5) Rate selection by lesson start time (needed for future-dated addendum rates) and apply_teacher_rate_addendum().
alter table teacher_contracts drop constraint if exists teacher_contracts_teacher_id_fkey;
alter table teacher_contracts add constraint teacher_contracts_teacher_id_fkey foreign key (teacher_id) references profiles (id);
alter table teacher_agreement_inputs drop constraint if exists teacher_agreement_inputs_teacher_id_fkey;
alter table teacher_agreement_inputs add constraint teacher_agreement_inputs_teacher_id_fkey
  foreign key (teacher_id) references profiles (id) on delete cascade;

alter table teacher_contracts drop constraint if exists teacher_contracts_agreement_form_check;
alter table teacher_contracts add constraint teacher_contracts_agreement_form_check
  check (agreement_form is null or agreement_form in
    ('california_employment', 'non_us_services', 'us_contractor_services', 'consultant_services', 'teacher_rate_addendum'));
alter table teacher_contracts add column if not exists amends_contract_id uuid references teacher_contracts (id);

alter table teacher_agreement_inputs
  add column if not exists monthly_fee_minor bigint check (monthly_fee_minor is null or monthly_fee_minor > 0),
  add column if not exists monthly_fee_currency text check (monthly_fee_currency is null or monthly_fee_currency in ('KRW', 'USD')),
  add column if not exists monthly_scope text check (monthly_scope is null or char_length(monthly_scope) between 2 and 2000);

-- Legacy caches follow the rate only once it is in effect (a future-dated addendum rate must not leak early).
create or replace function public.sync_teacher_rate_caches()
returns void language sql security definer set search_path = public, pg_temp as $$
  update teachers t
     set pay_currency = h.currency,
         hourly_rate_krw = case when h.currency = 'KRW' then h.amount_minor else null end
    from teacher_rate_history h
   where h.teacher_id = t.id and h.currency in ('KRW', 'USD')
     and h.effective_from <= clock_timestamp() and (h.effective_until is null or h.effective_until > clock_timestamp());
$$;
revoke execute on function public.sync_teacher_rate_caches() from public, anon, authenticated;
grant execute on function public.sync_teacher_rate_caches() to service_role;

create or replace function public.set_teacher_rate(
  p_teacher_id uuid, p_amount_minor bigint, p_currency text, p_effective_from timestamptz default clock_timestamp()
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
  select * into v_current from teacher_rate_history where teacher_id = p_teacher_id and effective_until is null;

  if v_current.id is not null then
    if p_effective_from <= v_current.effective_from then
      raise exception '새 effective_from(%)은 기존 현재 이력의 effective_from(%)보다 이후여야 합니다.', p_effective_from, v_current.effective_from;
    end if;
    insert into public.status_transition_tokens (table_name, row_id, action)
    values ('teacher_rate_history', v_current.id, 'close_teacher_rate');
    update teacher_rate_history set effective_until = p_effective_from where id = v_current.id;
  end if;

  insert into teacher_rate_history (teacher_id, amount_minor, currency, effective_from)
  values (p_teacher_id, p_amount_minor, p_currency, p_effective_from)
  returning id into v_new_id;

  if p_effective_from <= clock_timestamp() then
    update teachers
       set pay_currency = p_currency,
           hourly_rate_krw = case when p_currency = 'KRW' then p_amount_minor else null end
     where id = p_teacher_id;
  end if;
  return v_new_id;
end;
$$;
revoke execute on function public.set_teacher_rate(uuid, bigint, text, timestamptz) from public, anon, authenticated;
grant execute on function public.set_teacher_rate(uuid, bigint, text, timestamptz) to service_role;

-- Session rate snapshot: the rate in effect at the lesson start (not simply the newest row).
create or replace function public.enforce_and_snapshot_teacher_rate()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_rate record;
  v_at timestamptz;
begin
  select r.starts_at into v_at from reservations r where r.id = new.reservation_id;
  v_at := coalesce(v_at, now());

  select amount_minor, currency into v_rate from teacher_rate_history
   where teacher_id = new.teacher_id and effective_from <= v_at and (effective_until is null or effective_until > v_at)
   order by effective_from desc limit 1;
  if v_rate.amount_minor is null then
    select amount_minor, currency into v_rate from teacher_rate_history
     where teacher_id = new.teacher_id and effective_until is null;
  end if;
  if v_rate.amount_minor is null then
    raise exception '선생님(%)의 유효한 현재 시급 이력이 없어 세션을 생성할 수 없습니다.', new.teacher_id;
  end if;
  new.hourly_rate_snapshot_minor := v_rate.amount_minor;
  new.hourly_rate_snapshot_currency := v_rate.currency;
  return new;
end;
$$;

-- Applies a signed + company-approved rate addendum (idempotent per contract). The company approval is recorded in the
-- executed document at send time, so a completed envelope means both acceptances exist.
create or replace function public.apply_teacher_rate_addendum(p_contract_id uuid)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c record;
  v_add jsonb;
  v_from timestamptz;
  v_hist uuid;
begin
  select * into c from teacher_contracts where id = p_contract_id and agreement_form = 'teacher_rate_addendum' for update;
  if not found then raise exception '시급 변경 합의서가 아닙니다(%).', p_contract_id; end if;
  if c.status <> 'signed' then raise exception '서명이 완료되지 않은 합의서는 적용할 수 없습니다.'; end if;
  select id into v_hist from teacher_rate_history where agreement_contract_id = p_contract_id;
  if v_hist is not null then return v_hist; end if;

  v_add := c.inputs_snapshot -> 'addendum';
  v_from := greatest(((v_add ->> 'effectiveDate')::date)::timestamp at time zone 'America/Los_Angeles', clock_timestamp());
  v_hist := public.set_teacher_rate(c.teacher_id, (v_add ->> 'newAmountMinor')::bigint, v_add ->> 'newCurrency', v_from);
  update teacher_rate_history set agreement_contract_id = p_contract_id where id = v_hist;

  update sessions s
     set hourly_rate_snapshot_minor = (v_add ->> 'newAmountMinor')::bigint,
         hourly_rate_snapshot_currency = v_add ->> 'newCurrency'
    from reservations r
   where r.id = s.reservation_id and s.teacher_id = c.teacher_id
     and s.final_status in ('scheduled', 'live') and r.starts_at >= v_from;
  return v_hist;
end;
$$;
revoke execute on function public.apply_teacher_rate_addendum(uuid) from public, anon, authenticated;
grant execute on function public.apply_teacher_rate_addendum(uuid) to service_role;
