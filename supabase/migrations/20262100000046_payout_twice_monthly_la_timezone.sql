-- 월 2회 정산(2026-10-06 오너 확정) + 회사 시간대 America/Los_Angeles 기준.
--
--  * 1~15일분은 같은 달 20일, 16일~말일분은 다음 달 5일에 지급(명목 날짜 — 주말·공휴일 보정 규칙은 미확정이라 적용하지 않음).
--  * 기간 경계는 **UTC가 아니라 America/Los_Angeles 달력 날짜**로 판정한다(수업 시작 시각·조정 항목 생성 시각을 LA 날짜로 환산).
--  * 이미 만들어진 payout_batches / scheduled_payout_date 값은 건드리지 않는다(함수 정의만 교체, additive).
--  * 레거시 예약 시점 Smart Notes 거부 함수는 20261008000000에서 이미 제거됐지만 안전하게 한 번 더 drop if exists.
--  * 적용 후 정정은 새 번호로 올릴 것(Supabase는 버전 번호로만 추적).

drop function if exists public.set_ai_notes_consent_as_guardian(uuid, boolean, text);
drop function if exists public.has_ai_notes_consent(uuid);

-- 기간 종료일 → 명목 지급일: 15일 이하면 같은 달 20일, 그 외(말일)는 다음 달 5일. 기존 월 단위 묶음(말일 종료)은 다음 달 5일이 된다.
create or replace function public.payout_nominal_date(p_period_end date)
returns date language sql immutable as $$
  select case
    when extract(day from p_period_end) <= 15
      then (date_trunc('month', p_period_end)::date + 19)
    else (date_trunc('month', p_period_end)::date + interval '1 month' + interval '4 days')::date
  end;
$$;

-- 다음 지급 슬롯(5일·20일, LA 달력). 슬롯 당일 08:00(LA) 이전이면 당일, 이후면 다음 슬롯.
-- 자동 송금 크론은 매일 17:00 UTC(= LA 09:00/10:00)에 돌며 LA 날짜가 5·20일일 때만 처리한다.
create or replace function public.next_scheduled_payout_date(p_now timestamptz default now())
returns date language sql immutable as $$
  with la as (
    select (p_now at time zone 'America/Los_Angeles') as t
  ), slots as (
    select (date_trunc('month', t)::date + 4)  as d from la
    union all select (date_trunc('month', t)::date + 19) from la
    union all select (date_trunc('month', t)::date + interval '1 month' + interval '4 days')::date from la
  )
  select min(d) from slots, la where (d + interval '8 hours') > la.t;
$$;

-- 묶음별 지급 예정일: 기간 기준 명목 지급일과 승인 시각 이후 첫 슬롯 중 늦은 쪽.
create or replace function public.scheduled_payout_date_for_batch(p_period_end date, p_now timestamptz default now())
returns date language sql immutable as $$
  select greatest(public.payout_nominal_date(p_period_end), public.next_scheduled_payout_date(p_now));
$$;

comment on function public.next_scheduled_payout_date is
  '월 2회 정산: 승인 시각(LA 시간대) 이후 첫 지급 슬롯(5일·20일). 슬롯 당일 08:00 LA 이전이면 당일.';
comment on function public.scheduled_payout_date_for_batch is
  '월 2회 정산: max(기간 명목 지급일, 승인 후 첫 슬롯). 주말·공휴일 보정은 적용하지 않는다(미확정).';

create or replace function public.close_payout_period(
  p_period_start date,
  p_period_end date
)
returns table (batch_id uuid, out_teacher_id uuid, currency text, item_count int, total_amount_minor bigint)
language plpgsql
security definer set search_path = public as $$
declare
  v_group record;
  v_batch_id uuid;
  v_added int;
  v_total bigint;
begin
  if p_period_end < p_period_start then
    raise exception '정산 기간이 올바르지 않습니다(% ~ %).', p_period_start, p_period_end;
  end if;

  -- 같은 기간을 동시에 두 번 마감하려는 호출을 직렬화한다(크론 중복 실행·수동
  -- 재시도가 겹쳐도 한 번에 하나만 진행). 트랜잭션 종료 시 자동 해제.
  perform pg_advisory_xact_lock(hashtext('close_payout_period:' || p_period_start::text || ':' || p_period_end::text));

  for v_group in
    select g_teacher_id, g_currency, array_agg(item_id) as item_ids, count(*) as g_count, sum(amount_minor) as g_total
    from (
      -- 후보는 두 종류다. UNION은 FOR UPDATE와 함께 쓸 수 없으므로(Postgres 제약)
      -- payout_items 단일 스캔에 OR로 합친다 — 잠금 대상이 한 relation이어야 한다.
      --   (a) 이 기간에 수업이 있었던 미배치 항목
      --   (b) 지난 마감 뒤 생긴 미배치 조정 항목(세션에 매이지 않는다)
      select pi.id as item_id, pi.teacher_id as g_teacher_id, pi.currency as g_currency, pi.amount_minor
      from payout_items pi
      where pi.batch_id is null
        and pi.status = 'pending'
        and (
          exists (
            select 1
            from sessions s
            join reservations r on r.id = s.reservation_id
            where s.id = pi.session_id
              and (r.starts_at at time zone 'America/Los_Angeles')::date between p_period_start and p_period_end
          )
          or (pi.session_id is null and (pi.created_at at time zone 'America/Los_Angeles')::date <= p_period_end)
        )
      order by pi.id
      for update of pi skip locked
    ) locked_candidates
    group by g_teacher_id, g_currency
  loop
    -- 이미 열려 있는(아직 승인 전) 같은 기간·통화 묶음이 있으면 재사용한다.
    -- OUT 파라미터(batch_id/currency/item_count/total_amount_minor)와 테이블 컬럼이
    -- 같은 이름이라 반드시 별칭으로 한정한다(그렇지 않으면 ambiguous 오류).
    select pb.id into v_batch_id
    from payout_batches pb
    where pb.teacher_id = v_group.g_teacher_id
      and pb.currency = v_group.g_currency
      and pb.period_start = p_period_start
      and pb.period_end = p_period_end
      and pb.status in ('draft', 'calculated', 'reviewing', 'reviewed')
    order by pb.created_at asc
    limit 1
    for update;

    if v_batch_id is null then
      insert into payout_batches (teacher_id, period_start, period_end, currency, status)
      values (v_group.g_teacher_id, p_period_start, p_period_end, v_group.g_currency, 'calculated')
      returning id into v_batch_id;
      insert into payout_batch_audit_log (batch_id, action, note)
        values (v_batch_id, 'auto_closed', '자동 월 마감으로 생성됨');
    else
      insert into payout_batch_audit_log (batch_id, action, note)
        values (v_batch_id, 'auto_closed_appended', '자동 월 마감 재실행 — 새 항목만 추가됨');
    end if;

    update payout_items pi
      set batch_id = v_batch_id, status = 'batched'
      where pi.id = any (v_group.item_ids) and pi.batch_id is null;
    get diagnostics v_added = row_count;

    select coalesce(sum(pi.amount_minor), 0) into v_total from payout_items pi where pi.batch_id = v_batch_id;

    batch_id := v_batch_id;
    out_teacher_id := v_group.g_teacher_id;
    currency := v_group.g_currency;
    item_count := v_added;
    total_amount_minor := v_total;
    return next;
  end loop;
end;
$$;

create or replace function public.generate_payout_batches(
  p_period_start date,
  p_period_end date,
  p_teacher_id uuid default null
)
returns table (batch_id uuid, out_teacher_id uuid, currency text, item_count int, total_amount_minor bigint)
language plpgsql
as $$
declare
  v_group record;
  v_batch_id uuid;
begin
  for v_group in
    select
      g_teacher_id,
      g_currency,
      array_agg(item_id) as item_ids,
      count(*) as g_count,
      sum(amount_minor) as g_total
    from (
      select
        pi.id as item_id,
        pi.teacher_id as g_teacher_id,
        pi.currency as g_currency,
        pi.amount_minor
      from payout_items pi
      join sessions s on s.id = pi.session_id
      join reservations r on r.id = s.reservation_id
      where pi.batch_id is null
        and pi.status = 'pending'
        and (p_teacher_id is null or pi.teacher_id = p_teacher_id)
        and (r.starts_at at time zone 'America/Los_Angeles')::date between p_period_start and p_period_end
      order by pi.id
      for update of pi skip locked
    ) locked_candidates
    group by g_teacher_id, g_currency
  loop
    insert into payout_batches (teacher_id, period_start, period_end, currency, status)
    values (v_group.g_teacher_id, p_period_start, p_period_end, v_group.g_currency, 'calculated')
    returning id into v_batch_id;

    update payout_items
      set batch_id = v_batch_id, status = 'batched'
      where id = any (v_group.item_ids);

    batch_id := v_batch_id;
    out_teacher_id := v_group.g_teacher_id;
    currency := v_group.g_currency;
    item_count := v_group.g_count;
    total_amount_minor := v_group.g_total;
    return next;
  end loop;
end;
$$;

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
            case when v_previous is null then '승인 시 지급 예정일 확정' else '재승인으로 지급 예정일 재계산' end);
  end if;
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
  if not found then
    raise exception '존재하지 않는 정산 묶음입니다.';
  end if;
  if v_batch.status <> 'approved' then
    raise exception '송금 승인된 묶음만 지급 예정일을 확정할 수 있습니다(현재: %).', v_batch.status;
  end if;
  if v_batch.scheduled_payout_date is not null then
    return v_batch.scheduled_payout_date;
  end if;

  v_date := public.scheduled_payout_date_for_batch(v_batch.period_end, coalesce(v_batch.approved_at, now()));
  update payout_batches set scheduled_payout_date = v_date where id = p_batch_id;

  insert into payout_scheduled_date_events (batch_id, previous_date, new_date, reason, source, actor_id)
  values (p_batch_id, null, v_date, '누락된 지급 예정일 확정(승인 시각 기준)', 'admin_change', p_actor_id);
  insert into payout_batch_audit_log (batch_id, action, actor_id, note)
  values (p_batch_id, 'scheduled_date_backfilled', p_actor_id, '누락된 예정일을 ' || v_date::text || '로 확정');

  return v_date;
end;
$$;
comment on function public.close_payout_period is
  '정산 기간 자동 마감(월 2회, 1~15일 / 16일~말일). 기간 판정은 America/Los_Angeles 달력 날짜. 기간 단위 advisory lock + FOR UPDATE SKIP LOCKED + 열린 묶음 재사용으로 중복 마감을 막는다.';
