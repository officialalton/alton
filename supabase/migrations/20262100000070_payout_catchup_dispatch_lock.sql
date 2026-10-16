-- 정산·자동 송금 감사 수정(2026-10-06). additive: 함수 재정의만, 기존 행은 건드리지 않는다.
--
--  1) close_payout_period: p_include_earlier=true(크론 경로)이면 기간 시작일 이전의 미배치 수업 항목도 이번 묶음에 쓸어 담는다.
--     크론이 하루 놓치거나 월 단위 시절 마감되지 않은 항목이 영원히 pending으로 남는 것을 막는다(이중 계산 불가: batch_id is null 항목만).
--     관리자 수동 실행(기본 false)은 종전대로 기간 안의 항목만.
--  2) dispatch_payout_batch: 행 잠금(for update)으로 동시 실행 시에도 같은 idempotency key만 돌려주고 두 번 전이하지 않는다.
--  3) list_due_auto_dispatch_batches: 기본 기준일을 UTC가 아니라 LA 날짜로.

drop function if exists public.close_payout_period(date, date);

create or replace function public.close_payout_period(
  p_period_start date,
  p_period_end date,
  p_include_earlier boolean default false
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
              and (r.starts_at at time zone 'America/Los_Angeles')::date <= p_period_end
              and ((r.starts_at at time zone 'America/Los_Angeles')::date >= p_period_start or p_include_earlier)
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

revoke execute on function public.close_payout_period(date, date, boolean) from public, anon, authenticated;
grant execute on function public.close_payout_period(date, date, boolean) to service_role;

comment on function public.close_payout_period(date, date, boolean) is
  '정산 기간 자동 마감(월 2회). LA 달력 날짜 기준. p_include_earlier=true면 기간 이전의 미배치 항목도 포함(크론 catch-up). advisory lock + SKIP LOCKED + 열린 묶음 재사용.';

create or replace function public.dispatch_payout_batch(p_batch_id uuid, p_provider text, p_requested_by uuid)
returns uuid
language plpgsql
as $$
declare
  v_key uuid;
begin
  if not public.real_disbursement_enabled() then
    raise exception '법인 설립 전 지급 경계(2026-09-07 정책): 실제 지급이 활성화되지 않아 batch를 dispatch할 수 없습니다.';
  end if;
  if p_provider not in ('mercury', 'wise') then
    raise exception 'provider는 mercury 또는 wise만 허용됩니다: %', p_provider;
  end if;

  -- 같은 묶음을 동시에 dispatch하려는 호출을 직렬화한다(뒤 호출은 앞 호출이 만든 key를 그대로 받는다).
  select dispatch_idempotency_key into v_key from payout_batches where id = p_batch_id for update;
  if v_key is not null then
    return v_key;
  end if;

  v_key := gen_random_uuid();
  update payout_batches
    set status = 'dispatch_requested',
        provider = p_provider,
        dispatch_idempotency_key = v_key,
        dispatch_requested_at = now()
    where id = p_batch_id and status = 'approved';
  if not found then
    raise exception 'approved 상태의 batch만 dispatch할 수 있습니다.';
  end if;

  insert into payout_batch_audit_log (batch_id, action, actor_id, note)
    values (p_batch_id, 'dispatch_requested', p_requested_by, format('provider=%s idempotency_key=%s', p_provider, v_key));

  return v_key;
end;
$$;

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
    and b.scheduled_payout_date <= p_on
    and b.external_transfer_recorded_at is null
    and b.dispatch_idempotency_key is null
    and (select s.enabled from payout_auto_dispatch_settings s where s.id = true)
  order by b.scheduled_payout_date, b.id;
$$;
