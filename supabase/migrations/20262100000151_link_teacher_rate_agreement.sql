-- teacher_rate_history rows are protected by a trigger that only lets set_teacher_rate() change them (one-time token).
-- Linking a rate row to the agreement that accepted it also needs that token; this function is the single sanctioned way.
create or replace function public.link_teacher_rate_agreement(p_history_id uuid, p_contract_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from teacher_rate_history where id = p_history_id and agreement_contract_id is not null) then
    return;
  end if;
  insert into public.status_transition_tokens (table_name, row_id, action)
  values ('teacher_rate_history', p_history_id, 'close_teacher_rate');
  update teacher_rate_history set agreement_contract_id = p_contract_id where id = p_history_id and agreement_contract_id is null;
end;
$$;
revoke execute on function public.link_teacher_rate_agreement(uuid, uuid) from public, anon, authenticated;
grant execute on function public.link_teacher_rate_agreement(uuid, uuid) to service_role;

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
  perform public.link_teacher_rate_agreement(v_hist, p_contract_id);

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
