-- R1 — v3 스키마 7/12: makeup_obligations / makeup_events + apply_makeup_time()
-- (Gate B §3.7, v4 개정: expired 이벤트 없음 — 만료 정책 미합의. 발생 사유 3종만 허용)

create table makeup_obligations (
  id uuid primary key default gen_random_uuid(),
  triggering_session_id uuid not null references sessions_v3 (id),
  child_id uuid not null references profiles (id),
  teacher_id uuid not null references profiles (id),
  owed_minutes int not null check (owed_minutes > 0),
  reason v3_makeup_reason not null,
  created_at timestamptz not null default now()
);
create index on makeup_obligations (child_id);

create table makeup_events (
  id uuid primary key default gen_random_uuid(),
  obligation_id uuid not null references makeup_obligations (id),
  event_type v3_makeup_event_type not null,
  applied_minutes int not null, -- 부호 있음(적용분은 음수)
  applied_session_id uuid references sessions_v3 (id),
  created_at timestamptz not null default now(),
  check (
    (event_type = 'applied' and applied_session_id is not null and applied_minutes < 0)
    or (event_type = 'adjust' and applied_session_id is null)
  )
);
create index on makeup_events (obligation_id);
create unique index makeup_events_no_double_apply
  on makeup_events (obligation_id, applied_session_id) where (event_type = 'applied');

create or replace function public.reject_makeup_event_mutation()
returns trigger
language plpgsql as $$
begin
  raise exception 'makeup_events는 INSERT-only입니다.';
end;
$$;
create trigger makeup_events_no_update
  before update or delete on makeup_events
  for each row execute function public.reject_makeup_event_mutation();
revoke execute on function public.reject_makeup_event_mutation() from public, anon, authenticated, service_role;
-- 트리거 전용(직접 호출 불가) — Gate B §7 점검 원칙에 따라 명시적으로 revoke.

create or replace view makeup_balances as
select
  o.id as obligation_id,
  o.child_id,
  o.owed_minutes + coalesce(sum(e.applied_minutes), 0) as remaining_minutes
from makeup_obligations o
left join makeup_events e on e.obligation_id = o.id
group by o.id, o.child_id, o.owed_minutes;

create or replace function public.apply_makeup_time(p_obligation_id uuid, p_applied_session_id uuid, p_minutes int)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_owed int;
  v_remaining int;
begin
  if p_minutes <= 0 then
    raise exception 'p_minutes는 0보다 커야 합니다(받은 값: %). 음수를 허용하면 잔여 시간이 늘어나는 결과가 됩니다.', p_minutes;
  end if;

  select owed_minutes into v_owed from makeup_obligations where id = p_obligation_id for update;
  if v_owed is null then
    raise exception '유효하지 않은 보충시간 의무입니다.';
  end if;

  if exists (select 1 from makeup_events where obligation_id = p_obligation_id
             and applied_session_id = p_applied_session_id and event_type = 'applied') then
    raise exception '이미 이 수업에 적용된 보충시간입니다.';
  end if;

  select v_owed + coalesce(sum(applied_minutes), 0) into v_remaining
    from makeup_events where obligation_id = p_obligation_id;

  if v_remaining < p_minutes then
    raise exception '잔여 보충시간(%)이 요청 시간(%)보다 적습니다.', v_remaining, p_minutes;
  end if;

  insert into makeup_events (obligation_id, event_type, applied_minutes, applied_session_id)
  values (p_obligation_id, 'applied', -p_minutes, p_applied_session_id);
end;
$$;
revoke execute on function public.apply_makeup_time(uuid, uuid, int) from public, anon, authenticated;

comment on table makeup_obligations is 'Gate B §3.7 v4: reason은 teacher_late/teacher_partial_interruption/company_meet_interruption 3종만. 전체 취소는 여기 대상 아님.';
comment on view makeup_balances is '잔여 보충시간은 owed_minutes + sum(applied_minutes)로 파생, 별도 저장 컬럼 없음.';
