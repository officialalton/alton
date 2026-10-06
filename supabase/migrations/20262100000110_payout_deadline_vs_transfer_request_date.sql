-- 지급 기한은 "입금 완료" 기준(오너 확정 2026-10-06). scheduled_payout_date는 계속 **완료 기한**(직전 영업일 보정)이고,
-- 송금 요청일 = 기한 − N영업일(주말·미국 연방 은행 휴일 제외, 기본 N=3, payout_settings 한 곳에서 변경).
-- 자동 송금은 요청일 <= 오늘(LA)인 묶음을 고른다(catch-up·멱등 유지). 승인이 너무 늦어 계획된 요청일을 못 지키면
-- '기한 위험(deadline_at_risk)'으로 기록·표시한다(조용히 늦게 나가지 않는다). 실제 송금 게이트는 건드리지 않는다.
-- 이미 저장된 scheduled_payout_date는 다시 쓰지 않는다.

create table if not exists public.payout_settings (
  id boolean primary key default true check (id),
  transfer_lead_business_days int not null default 3 check (transfer_lead_business_days between 0 and 15),
  updated_by uuid references profiles (id),
  updated_at timestamptz not null default now()
);
insert into public.payout_settings (id) values (true) on conflict do nothing;
alter table public.payout_settings enable row level security;
drop policy if exists "payout_settings 조회" on public.payout_settings;
create policy "payout_settings 조회" on public.payout_settings for select using (is_admin() or current_user_has_capability('정산권한'));
revoke insert, update, delete on public.payout_settings from anon, authenticated;
comment on table public.payout_settings is '정산 설정(단일 행). transfer_lead_business_days = 송금 요청일을 지급 기한보다 몇 영업일 앞에 둘지(기본 3).';

alter table public.payout_batches
  add column if not exists deadline_at_risk boolean not null default false,
  add column if not exists deadline_at_risk_at timestamptz;

create or replace function public.payout_lead_business_days()
returns int language sql stable as $$ select coalesce((select transfer_lead_business_days from public.payout_settings where id), 3) $$;

create or replace function public.payout_is_business_day(p_date date)
returns boolean language sql stable as $$
  select extract(isodow from p_date) < 6
    and not exists (select 1 from public.payout_bank_holidays h where h.holiday_date = p_date)
$$;

create or replace function public.payout_business_day_on_or_after(p_date date)
returns date language sql stable as $$
  select min(d::date) from generate_series(p_date, p_date + 10, interval '1 day') d where public.payout_is_business_day(d::date)
$$;

create or replace function public.payout_business_day_minus(p_date date, p_n int)
returns date language plpgsql stable as $$
declare d date := p_date; i int := 0;
begin
  while i < p_n loop
    d := d - 1;
    if public.payout_is_business_day(d) then i := i + 1; end if;
  end loop;
  return d;
end;
$$;

-- 송금 요청일 = (기한을 영업일로 보정) − N영업일
create or replace function public.payout_transfer_request_date(p_deadline date, p_lead int default null)
returns date language sql stable as $$
  select public.payout_business_day_minus(public.payout_business_day_on_or_before(p_deadline), coalesce(p_lead, public.payout_lead_business_days()))
$$;

-- 지금 승인했을 때 가능한 가장 이른 송금 요청일: 자동 송금 크론(17:00 UTC)이 08:00 LA 이전 승인분을 같은 날 처리한다.
create or replace function public.payout_earliest_request_date(p_now timestamptz default now())
returns date language sql stable as $$
  with la as (select (p_now at time zone 'America/Los_Angeles') as t)
  select case
    when public.payout_is_business_day(la.t::date) and la.t::time < time '08:00' then la.t::date
    else public.payout_business_day_on_or_after(la.t::date + 1)
  end from la
$$;

create or replace function public.payout_deadline_at_risk(p_deadline date, p_now timestamptz default now())
returns boolean language sql stable as $$
  select p_deadline is not null and public.payout_earliest_request_date(p_now) > public.payout_transfer_request_date(p_deadline)
$$;

-- 완료 기한 = 기간 기준 법정 기한(승인 시각과 무관). 종전의 "승인 후 첫 슬롯" 로직은 폐기.
create or replace function public.scheduled_payout_date_for_batch(p_period_end date, p_now timestamptz default now())
returns date language sql stable as $$ select public.payout_nominal_date(p_period_end) $$;

create or replace function public.payout_refresh_deadline_risk(p_batch_id uuid)
returns boolean language plpgsql as $$
declare v_batch payout_batches%rowtype; v_risk boolean;
begin
  select * into v_batch from payout_batches where id = p_batch_id for update;
  if not found or v_batch.status <> 'approved' then return false; end if;
  v_risk := public.payout_deadline_at_risk(v_batch.scheduled_payout_date, now());
  if v_risk is distinct from v_batch.deadline_at_risk then
    update payout_batches set deadline_at_risk = v_risk, deadline_at_risk_at = case when v_risk then now() else null end where id = p_batch_id;
    if v_risk then
      insert into payout_batch_audit_log (batch_id, action, note)
      values (p_batch_id, 'deadline_at_risk',
              '지급 기한(' || v_batch.scheduled_payout_date::text || ') 위험 — 계획된 송금 요청일('
              || public.payout_transfer_request_date(v_batch.scheduled_payout_date)::text || ')을 지키기엔 승인이 늦었습니다. 가장 이른 송금 요청일: '
              || public.payout_earliest_request_date(now())::text);
    end if;
  end if;
  return v_risk;
end;
$$;
revoke execute on function public.payout_refresh_deadline_risk(uuid) from public, anon, authenticated;

create or replace function public.approve_payout_batch(p_batch_id uuid, p_approved_by uuid)
returns void
language plpgsql as $$
declare
  v_previous date;
  v_next date;
begin
  select scheduled_payout_date into v_previous from payout_batches where id = p_batch_id;
  v_next := public.scheduled_payout_date_for_batch((select period_end from payout_batches where id = p_batch_id), now());

  update payout_batches
    set status = 'approved',
        approved_at = now(),
        scheduled_payout_date = v_next,
        auto_dispatch_enabled = true
    where id = p_batch_id and status in ('draft', 'reviewing', 'calculated', 'reviewed');
  if not found then
    raise exception 'calculated/reviewed 상태의 batch만 승인할 수 있습니다.';
  end if;

  update payout_items set status = 'approved' where batch_id = p_batch_id;

  insert into payout_batch_audit_log (batch_id, action, actor_id)
    values (p_batch_id, 'approved', p_approved_by);

  if v_previous is distinct from v_next then
    insert into payout_scheduled_date_events (batch_id, previous_date, new_date, source, actor_id, reason)
    values (p_batch_id, v_previous, v_next, 'approval', p_approved_by,
            case when v_previous is null then '승인 시 지급 기한 확정' else '재승인으로 지급 기한 재계산' end);
  end if;
  perform public.payout_refresh_deadline_risk(p_batch_id);
end;
$$;

create or replace function public.ensure_payout_batch_scheduled_date(p_batch_id uuid, p_actor_id uuid)
returns date
language plpgsql
security definer set search_path = public as $$
declare
  v_batch payout_batches%rowtype;
  v_date date;
begin
  select * into v_batch from payout_batches where id = p_batch_id for update;
  if not found then raise exception '존재하지 않는 정산 묶음입니다.'; end if;
  if v_batch.status <> 'approved' then
    raise exception '송금 승인된 묶음만 지급 예정일을 확정할 수 있습니다(현재: %).', v_batch.status;
  end if;
  if v_batch.scheduled_payout_date is not null then return v_batch.scheduled_payout_date; end if;

  v_date := public.scheduled_payout_date_for_batch(v_batch.period_end, now());
  update payout_batches set scheduled_payout_date = v_date where id = p_batch_id;
  insert into payout_scheduled_date_events (batch_id, previous_date, new_date, reason, source, actor_id)
  values (p_batch_id, null, v_date, '누락된 지급 기한 확정(기간 기준)', 'admin_change', p_actor_id);
  insert into payout_batch_audit_log (batch_id, action, actor_id, note)
  values (p_batch_id, 'scheduled_date_backfilled', p_actor_id, '누락된 지급 기한을 ' || v_date::text || '로 확정');
  perform public.payout_refresh_deadline_risk(p_batch_id);
  return v_date;
end;
$$;

-- 자동 송금 대상: 송금 요청일(기한 − N영업일) <= 오늘(LA). 기한이 지난 묶음은 요청일도 지났으므로 catch-up으로 잡힌다.
drop function if exists public.list_due_auto_dispatch_batches(date);
create or replace function public.list_due_auto_dispatch_batches(p_on date default (now() at time zone 'America/Los_Angeles')::date)
returns table (batch_id uuid, teacher_id uuid, currency text, scheduled_payout_date date, total_amount_minor bigint)
language sql stable security definer set search_path = public as $$
  select
    b.id,
    b.teacher_id,
    b.currency,
    b.scheduled_payout_date,
    coalesce((select sum(pi.amount_minor) from payout_items pi where pi.batch_id = b.id), 0)
  from payout_batches b
  where b.status = 'approved'
    and b.auto_dispatch_enabled
    and b.scheduled_payout_date is not null
    and public.payout_transfer_request_date(b.scheduled_payout_date) <= p_on
    and b.external_transfer_recorded_at is null
    and b.dispatch_idempotency_key is null
    and (select s.enabled from payout_auto_dispatch_settings s where s.id = true)
  order by b.scheduled_payout_date, b.id;
$$;
revoke execute on function public.list_due_auto_dispatch_batches(date) from public, anon, authenticated;
grant execute on function public.list_due_auto_dispatch_batches(date) to service_role;

-- 날짜 변경 공통: 변경 뒤 기한 위험 재계산, 알림 문구는 "기한(by)" 의미로.
create or replace function public.payout_apply_date_change(
  p_batch payout_batches, p_new_date date, p_reason text, p_actor_id uuid, p_source text, p_audit_action text, p_notice_kind text
) returns void
language plpgsql as $$
begin
  update payout_batches set scheduled_payout_date = p_new_date where id = p_batch.id;
  insert into payout_scheduled_date_events (batch_id, previous_date, new_date, reason, source, actor_id)
  values (p_batch.id, p_batch.scheduled_payout_date, p_new_date, btrim(p_reason), p_source, p_actor_id);
  insert into payout_batch_audit_log (batch_id, action, actor_id, note)
  values (p_batch.id, p_audit_action, p_actor_id,
          coalesce(p_batch.scheduled_payout_date::text, '(없음)') || ' → ' || p_new_date::text
          || ' (송금 요청 예정 ' || public.payout_transfer_request_date(p_new_date)::text || ') — ' || btrim(p_reason));
  insert into payout_teacher_notices (teacher_id, batch_id, kind, message)
  values (p_batch.teacher_id, p_batch.id, p_notice_kind,
          'Your payout for ' || to_char(p_batch.period_start, 'Mon FMDD') || '–' || to_char(p_batch.period_end, 'Mon FMDD, YYYY')
          || ' will now be paid by ' || to_char(p_new_date, 'Mon FMDD, YYYY')
          || coalesce(' (previously by ' || to_char(p_batch.scheduled_payout_date, 'Mon FMDD, YYYY') || ')', '')
          || '. Reason: ' || btrim(p_reason) || '.');
  perform public.payout_refresh_deadline_risk(p_batch.id);
end;
$$;
revoke execute on function public.payout_apply_date_change(payout_batches, date, text, uuid, text, text, text) from public, anon, authenticated;

-- 즉시 지급: 기한을 바꾸지 않는다(기한은 입금 완료 약속이다). 이미 기한이 지났거나 기한 위험인 묶음만,
-- 자동 송금 대상으로 두고 다음 크론에서 바로 요청되게 한다. 실제 송금 게이트는 그대로 거친다.
create or replace function public.set_payout_batch_pay_immediately(p_batch_id uuid, p_reason text, p_actor_id uuid)
returns date
language plpgsql
security definer set search_path = public as $$
declare v_batch payout_batches%rowtype;
begin
  if coalesce(btrim(p_reason), '') = '' then raise exception '즉시 지급 사유를 입력해주세요.'; end if;
  v_batch := public.payout_lock_batch_for_date_change(p_batch_id);
  if v_batch.scheduled_payout_date is null
     or (v_batch.scheduled_payout_date >= public.payout_la_today() and not v_batch.deadline_at_risk) then
    raise exception '기한이 지났거나 기한 위험으로 표시된 묶음만 즉시 지급 처리할 수 있습니다. 일반 예정일 변경을 사용하세요.';
  end if;
  update payout_batches set auto_dispatch_enabled = true where id = p_batch_id;
  insert into payout_scheduled_date_events (batch_id, previous_date, new_date, reason, source, actor_id)
  values (p_batch_id, v_batch.scheduled_payout_date, v_batch.scheduled_payout_date, btrim(p_reason), 'pay_immediately', p_actor_id);
  insert into payout_batch_audit_log (batch_id, action, actor_id, note)
  values (p_batch_id, 'pay_immediately_requested', p_actor_id, '즉시 지급 처리 — 기한 ' || v_batch.scheduled_payout_date::text || ' 유지, 다음 자동 송금 실행에서 요청 — ' || btrim(p_reason));
  insert into payout_teacher_notices (teacher_id, batch_id, kind, message)
  values (v_batch.teacher_id, p_batch_id, 'payout_date_changed',
          'Your payout for ' || to_char(v_batch.period_start, 'Mon FMDD') || '–' || to_char(v_batch.period_end, 'Mon FMDD, YYYY')
          || ' is being sent as soon as possible (original deadline: ' || to_char(v_batch.scheduled_payout_date, 'Mon FMDD, YYYY') || ').');
  return public.payout_la_today();
end;
$$;
revoke execute on function public.set_payout_batch_pay_immediately(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.set_payout_batch_pay_immediately(uuid, text, uuid) to service_role;
