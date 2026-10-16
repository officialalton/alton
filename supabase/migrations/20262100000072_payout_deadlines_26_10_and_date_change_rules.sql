-- (A) 지급 기한 변경(2026-10-06 오너): 1~15일분은 같은 달 26일까지, 16일~말일분은 다음 달 10일까지(종전 20일/5일 폐기).
--     주말·미국 연방 은행 휴일이면 직전 영업일. 이미 저장된 scheduled_payout_date는 다시 쓰지 않는다(함수 정의만 교체).
-- (B) 관리자 지급 예정일 변경 규칙 강화 + 선생님 알림 기록 + '즉시 지급'·'지연 지급' 별도 경로.
--     실제 송금 게이트(real_disbursement_enabled)는 건드리지 않는다 — 이 함수들은 날짜·기록만 바꾼다.

create or replace function public.payout_nominal_date(p_period_end date)
returns date language sql stable as $$
  select public.payout_business_day_on_or_before(
    case
      when extract(day from p_period_end) <= 15 then (date_trunc('month', p_period_end)::date + 25)
      else (date_trunc('month', p_period_end)::date + interval '1 month' + interval '9 days')::date
    end);
$$;

create or replace function public.next_scheduled_payout_date(p_now timestamptz default now())
returns date language sql stable as $$
  with la as (
    select (p_now at time zone 'America/Los_Angeles') as t
  ), slots as (
    select public.payout_business_day_on_or_before(m.d + o.o) as d
    from la,
         lateral (select (date_trunc('month', la.t)::date + (x || ' month')::interval)::date as d from generate_series(0, 1) x) m,
         (values (9), (25)) o(o)
  )
  select min(d) from slots, la where (d + interval '8 hours') > la.t;
$$;

comment on function public.payout_nominal_date is '기간 종료일 기준 지급 기한: 1~15일분 26일, 16일~말일분 다음 달 10일을 직전 영업일로 보정.';

-- ---------------------------------------------------------------------------
-- 선생님 인앱 알림 기록(이메일 아님 — 실제 발송 없음)
-- ---------------------------------------------------------------------------
create table if not exists public.payout_teacher_notices (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles (id) on delete cascade,
  batch_id uuid references payout_batches (id) on delete cascade,
  kind text not null,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists payout_teacher_notices_teacher_idx on public.payout_teacher_notices (teacher_id, created_at desc);
alter table public.payout_teacher_notices enable row level security;
drop policy if exists "payout_teacher_notices 조회" on public.payout_teacher_notices;
create policy "payout_teacher_notices 조회" on public.payout_teacher_notices for select
  using (teacher_id = auth.uid() or is_admin() or current_user_has_capability('정산권한'));
revoke insert, update, delete on public.payout_teacher_notices from anon, authenticated;

alter table public.payout_scheduled_date_events drop constraint if exists payout_scheduled_date_events_source_check;
alter table public.payout_scheduled_date_events
  add constraint payout_scheduled_date_events_source_check
  check (source in ('approval', 'admin_change', 'delayed_payment', 'pay_immediately'));

create or replace function public.payout_la_today()
returns date language sql stable as $$ select (now() at time zone 'America/Los_Angeles')::date $$;

-- 공통: 변경 불가 상태 점검 + 잠금
create or replace function public.payout_lock_batch_for_date_change(p_batch_id uuid)
returns payout_batches
language plpgsql as $$
declare v_batch payout_batches%rowtype;
begin
  select * into v_batch from payout_batches where id = p_batch_id for update;
  if not found then raise exception '존재하지 않는 정산 묶음입니다.'; end if;
  if v_batch.status in ('dispatch_requested', 'provider_pending', 'processing', 'paid') then
    raise exception '송금 요청·처리 중이거나 지급 완료된 묶음은 지급 예정일을 변경할 수 없습니다(현재: %).', v_batch.status;
  end if;
  if v_batch.status <> 'approved' then
    raise exception '송금 승인된 묶음의 지급 예정일만 변경할 수 있습니다(현재: %).', v_batch.status;
  end if;
  if v_batch.external_transfer_recorded_at is not null then
    raise exception '외부 송금 완료가 기록된 묶음은 지급 예정일을 변경할 수 없습니다.';
  end if;
  return v_batch;
end;
$$;
revoke execute on function public.payout_lock_batch_for_date_change(uuid) from public, anon, authenticated;

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
          coalesce(p_batch.scheduled_payout_date::text, '(없음)') || ' → ' || p_new_date::text || ' — ' || btrim(p_reason));
  insert into payout_teacher_notices (teacher_id, batch_id, kind, message)
  values (p_batch.teacher_id, p_batch.id, p_notice_kind,
          'Your payout for ' || to_char(p_batch.period_start, 'Mon FMDD') || '–' || to_char(p_batch.period_end, 'Mon FMDD, YYYY')
          || ' is now scheduled for ' || to_char(p_new_date, 'Mon FMDD, YYYY')
          || coalesce(' (previously ' || to_char(p_batch.scheduled_payout_date, 'Mon FMDD, YYYY') || ')', '')
          || '. Reason: ' || btrim(p_reason) || '.');
end;
$$;
revoke execute on function public.payout_apply_date_change(payout_batches, date, text, uuid, text, text, text) from public, anon, authenticated;

-- 일반 변경: 사유 필수 / 과거 금지 / 법정 기한 초과 금지 / 휴일·주말은 직전 영업일 제안 + 확인 필요.
drop function if exists public.set_payout_batch_scheduled_date(uuid, date, text, uuid);
create or replace function public.set_payout_batch_scheduled_date(
  p_batch_id uuid, p_new_date date, p_reason text, p_actor_id uuid, p_confirm_business_day boolean default false
)
returns date
language plpgsql
security definer set search_path = public as $$
declare
  v_batch payout_batches%rowtype;
  v_deadline date;
  v_suggested date;
  v_final date := p_new_date;
begin
  if coalesce(btrim(p_reason), '') = '' then
    raise exception '지급 예정일 변경 사유를 입력해주세요.';
  end if;
  if p_new_date is null then raise exception '변경할 날짜를 입력해주세요.'; end if;
  v_batch := public.payout_lock_batch_for_date_change(p_batch_id);

  if p_new_date < public.payout_la_today() then
    raise exception '과거 날짜로는 변경할 수 없습니다. 지연된 묶음은 "즉시 지급" 처리를 사용하세요.';
  end if;

  v_deadline := public.payout_nominal_date(v_batch.period_end);
  if p_new_date > v_deadline then
    raise exception '법정 지급 기한(%)을 넘기는 날짜는 일반 변경으로 처리할 수 없습니다. "지연 지급" 처리를 사용하세요.', v_deadline;
  end if;

  v_suggested := public.payout_business_day_on_or_before(p_new_date);
  if v_suggested <> p_new_date then
    if not p_confirm_business_day then
      raise exception 'NON_BUSINESS_DAY:%:선택한 날짜는 주말 또는 미국 연방 은행 휴일입니다. 직전 영업일(%)로 변경할까요?', v_suggested, v_suggested;
    end if;
    v_final := v_suggested;
    if v_final < public.payout_la_today() then
      raise exception '직전 영업일(%)이 과거입니다. "즉시 지급" 처리를 사용하세요.', v_final;
    end if;
  end if;

  perform public.payout_apply_date_change(v_batch, v_final, p_reason, p_actor_id, 'admin_change', 'scheduled_date_changed', 'payout_date_changed');
  return v_final;
end;
$$;
revoke execute on function public.set_payout_batch_scheduled_date(uuid, date, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_payout_batch_scheduled_date(uuid, date, text, uuid, boolean) to service_role;

-- 즉시 지급(지연된 묶음): 예정일을 오늘(LA)로 당긴다. 송금은 기존 자동 송금 게이트를 그대로 통과해야 한다.
create or replace function public.set_payout_batch_pay_immediately(p_batch_id uuid, p_reason text, p_actor_id uuid)
returns date
language plpgsql
security definer set search_path = public as $$
declare v_batch payout_batches%rowtype; v_today date := public.payout_la_today();
begin
  if coalesce(btrim(p_reason), '') = '' then raise exception '즉시 지급 사유를 입력해주세요.'; end if;
  v_batch := public.payout_lock_batch_for_date_change(p_batch_id);
  if v_batch.scheduled_payout_date is not null and v_batch.scheduled_payout_date >= v_today then
    raise exception '아직 지급 예정일이 지나지 않은 묶음입니다. 일반 예정일 변경을 사용하세요.';
  end if;
  perform public.payout_apply_date_change(v_batch, v_today, p_reason, p_actor_id, 'pay_immediately', 'pay_immediately_requested', 'payout_date_changed');
  update payout_batches set auto_dispatch_enabled = true where id = p_batch_id;
  return v_today;
end;
$$;
revoke execute on function public.set_payout_batch_pay_immediately(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.set_payout_batch_pay_immediately(uuid, text, uuid) to service_role;

-- 지연 지급: 법정 기한을 넘기는 날짜(오늘 이후). 직원 경보로 감사 로그에 'delayed_payment_alert'를 남긴다.
create or replace function public.set_payout_batch_delayed_date(p_batch_id uuid, p_new_date date, p_reason text, p_actor_id uuid)
returns date
language plpgsql
security definer set search_path = public as $$
declare v_batch payout_batches%rowtype; v_deadline date;
begin
  if coalesce(btrim(p_reason), '') = '' then raise exception '지연 지급 사유를 입력해주세요.'; end if;
  if p_new_date is null or p_new_date < public.payout_la_today() then
    raise exception '지연 지급 날짜는 오늘 이후여야 합니다.';
  end if;
  v_batch := public.payout_lock_batch_for_date_change(p_batch_id);
  v_deadline := public.payout_nominal_date(v_batch.period_end);
  if p_new_date <= v_deadline then
    raise exception '법정 지급 기한(%) 이내입니다. 일반 예정일 변경을 사용하세요.', v_deadline;
  end if;
  if p_new_date <> public.payout_business_day_on_or_before(p_new_date) then
    raise exception '주말 또는 미국 연방 은행 휴일은 지급일로 둘 수 없습니다(직전 영업일: %).', public.payout_business_day_on_or_before(p_new_date);
  end if;
  perform public.payout_apply_date_change(v_batch, p_new_date, p_reason, p_actor_id, 'delayed_payment', 'scheduled_date_changed', 'payout_delayed');
  insert into payout_batch_audit_log (batch_id, action, actor_id, note)
  values (p_batch_id, 'delayed_payment_alert', p_actor_id,
          '법정 기한(' || v_deadline::text || ') 초과 지급 — 직원 확인 필요: ' || p_new_date::text || ' — ' || btrim(p_reason));
  return p_new_date;
end;
$$;
revoke execute on function public.set_payout_batch_delayed_date(uuid, date, text, uuid) from public, anon, authenticated;
grant execute on function public.set_payout_batch_delayed_date(uuid, date, text, uuid) to service_role;
