-- P4-2 — 지급 예정일 저장 + 자동 송금 구조 (2026-09-12)
--
-- 확정 정책(제품 오너):
--  * 자동 송금이 기본이다. 송금 승인된 묶음은 **지정된 지급 예정일**에 자동 송금
--    대상이 된다. 자동 실행 시각은 기존 정산 기준과 같은 **UTC 매월 10일 03:00**.
--  * 승인이 그 달 10일 03:00 UTC 이전이면 그 달 10일, 이후면 다음 달 10일.
--  * 지급 예정일은 **화면 계산값이 아니라 묶음별 저장값**이다 — 규칙이 바뀌거나
--    지급이 연기돼도 과거 건의 예정일이 따라 바뀌지 않는다.
--  * 예정일 변경은 관리자만, 변경 전후 날짜·사유·처리자·시각을 감사 이력에 남긴다.
--  * 자동 송금은 전역 스위치와 묶음별 스위치 둘 다로 끌 수 있다. 둘 중 하나라도
--    꺼져 있으면 자동 송금 대상에서 건너뛴다.
--  * 실제 송금 요청 또는 외부 송금 완료 뒤에는 금액·예정일을 바꿀 수 없다.
--
-- **실제 송금은 이 마이그레이션으로도 열리지 않는다**: dispatch 경로는 기존
-- real_disbursement_enabled() 게이트(기본 false) 뒤에 그대로 있고, 금융 제공자
-- 클라이언트 코드는 레포에 없다. 자동 송금 작업은 게이트가 닫혀 있으면 상태를
-- 바꾸지도, 송금을 시도한 것처럼 기록하지도 않는다(건너뛴 사실만 남긴다).

-- =========================================================================
-- 1. payout_batches 확장
-- =========================================================================
alter table payout_batches
  add column if not exists scheduled_payout_date date,
  add column if not exists auto_dispatch_enabled boolean not null default true,
  add column if not exists external_transfer_recorded_at timestamptz;

-- 항목 단위 지급 근거 플래그. 외부 은행 송금으로 지급된 항목은 제공자 확인 값이
-- 없으므로 이 플래그가 근거가 된다(payout_items_paid_requires_confirmation 참고).
alter table payout_items
  add column if not exists external_transfer_recorded boolean not null default false;

create index if not exists payout_batches_due_auto_dispatch_idx
  on payout_batches (scheduled_payout_date)
  where status = 'approved' and auto_dispatch_enabled;

comment on column payout_batches.scheduled_payout_date is
  'P4-2: 이 묶음의 지급 예정일(저장값). 승인 시점에 정해지며 화면에서 다시 계산하지 않는다 — '
  '규칙이 바뀌어도 과거 건의 예정일이 바뀌지 않게 하기 위함이다.';
comment on column payout_batches.auto_dispatch_enabled is
  'P4-2: 이 묶음을 자동 송금 대상으로 둘지. 전역 스위치(payout_auto_dispatch_settings)와 AND 조건이다.';

-- =========================================================================
-- 2. 지급 예정일 계산 규칙
-- =========================================================================
-- 자동 실행은 매월 10일 03:00 UTC. 그 시각 전에 승인되면 그 달 10일, 뒤면 다음 달 10일.
create or replace function public.next_scheduled_payout_date(p_now timestamptz default now())
returns date
language sql immutable as $$
  select case
    when p_now < (date_trunc('month', p_now at time zone 'UTC') + interval '9 days' + interval '3 hours') at time zone 'UTC'
      then (date_trunc('month', p_now at time zone 'UTC') + interval '9 days')::date
    else (date_trunc('month', p_now at time zone 'UTC') + interval '1 month' + interval '9 days')::date
  end;
$$;

comment on function public.next_scheduled_payout_date is
  'P4-2: 승인 시각 기준 지급 예정일. 그 달 10일 03:00 UTC 이전이면 그 달 10일, 이후면 다음 달 10일. '
  '기준 시간대는 기존 정산과 같은 UTC.';

-- =========================================================================
-- 3. 지급 예정일 변경 이력 (INSERT-only)
-- =========================================================================
create table payout_scheduled_date_events (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references payout_batches (id) on delete cascade,
  previous_date date,
  new_date date not null,
  reason text,
  source text not null check (source in ('approval', 'admin_change')),
  actor_id uuid references profiles (id),
  created_at timestamptz not null default now()
);
create index on payout_scheduled_date_events (batch_id, created_at desc);

create or replace function public.reject_payout_scheduled_date_event_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'payout_scheduled_date_events는 INSERT-only입니다.';
end;
$$;
create trigger payout_scheduled_date_events_no_update
  before update or delete on payout_scheduled_date_events
  for each row execute function public.reject_payout_scheduled_date_event_mutation();
revoke execute on function public.reject_payout_scheduled_date_event_mutation() from public, anon, authenticated, service_role;

alter table payout_scheduled_date_events enable row level security;
create policy "payout_scheduled_date_events 조회" on payout_scheduled_date_events for select
  using (
    is_admin() or current_user_has_capability('정산권한')
    or exists (select 1 from payout_batches b where b.id = batch_id and b.teacher_id = auth.uid())
  );

-- =========================================================================
-- 4. 외부 송금 완료 기록 (INSERT-only)
-- =========================================================================
create table payout_external_transfers (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null unique references payout_batches (id) on delete cascade,
  transferred_on date not null,
  amount_minor bigint not null,
  currency text not null,
  bank_reference text not null,
  memo text,
  recorded_by uuid references profiles (id),
  recorded_at timestamptz not null default now()
);

comment on table payout_external_transfers is
  'P4-2: 은행에서 직접 송금한 건의 완료 기록. 금융 제공자 API를 호출하지 않고 "이미 보냈다"는 사실만 '
  '남긴다. 송금 승인된 묶음에만 허용한다.';

create or replace function public.reject_payout_external_transfer_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'payout_external_transfers는 INSERT-only입니다.';
end;
$$;
create trigger payout_external_transfers_no_update
  before update or delete on payout_external_transfers
  for each row execute function public.reject_payout_external_transfer_mutation();
revoke execute on function public.reject_payout_external_transfer_mutation() from public, anon, authenticated, service_role;

alter table payout_external_transfers enable row level security;
create policy "payout_external_transfers 조회" on payout_external_transfers for select
  using (
    is_admin() or current_user_has_capability('정산권한')
    or exists (select 1 from payout_batches b where b.id = batch_id and b.teacher_id = auth.uid())
  );

-- =========================================================================
-- 5. 자동 송금 전역 스위치 + 실행 로그
-- =========================================================================
-- 법인 설립 전 지급 경계(payout_disbursement_gate)와는 **다른 것**이다.
-- 그 게이트는 "실제 송금 자체가 가능한가"이고 여기는 "자동으로 보낼 것인가"다.
-- 둘 다 통과해야 자동 송금이 일어난다.
create table payout_auto_dispatch_settings (
  id boolean primary key default true,
  enabled boolean not null default true,
  updated_by uuid references profiles (id),
  updated_at timestamptz not null default now(),
  constraint payout_auto_dispatch_settings_singleton check (id = true)
);
insert into payout_auto_dispatch_settings (id, enabled) values (true, true);

alter table payout_auto_dispatch_settings enable row level security;
create policy "payout_auto_dispatch_settings 조회" on payout_auto_dispatch_settings for select
  using (is_admin() or current_user_has_capability('정산권한'));

create table payout_auto_dispatch_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  due_on date not null,
  eligible_count int not null default 0,
  dispatched_count int not null default 0,
  skipped_gate_closed_count int not null default 0,
  skipped_global_off boolean not null default false,
  error text
);
create index on payout_auto_dispatch_runs (ran_at desc);

comment on table payout_auto_dispatch_runs is
  'P4-2: 자동 송금 크론 실행 기록. 게이트가 닫혀 있어 아무것도 보내지 않은 실행도 남긴다 — '
  '"돌긴 돌았고 왜 안 나갔는지"를 운영이 확인할 수 있어야 하기 때문이다. 송금을 시도한 것처럼 '
  '기록하지 않는다.';

alter table payout_auto_dispatch_runs enable row level security;
create policy "payout_auto_dispatch_runs 조회" on payout_auto_dispatch_runs for select
  using (is_admin() or current_user_has_capability('정산권한'));

-- =========================================================================
-- 6. 승인 시 지급 예정일 확정
-- =========================================================================
create or replace function public.approve_payout_batch(p_batch_id uuid, p_approved_by uuid)
returns void
language plpgsql as $$
declare
  v_previous date;
  v_next date;
begin
  select scheduled_payout_date into v_previous from payout_batches where id = p_batch_id;
  v_next := public.next_scheduled_payout_date(now());

  update payout_batches
    set status = 'approved', approved_at = now(), scheduled_payout_date = v_next
    where id = p_batch_id and status in ('draft', 'reviewing', 'calculated', 'reviewed');
  if not found then
    raise exception 'calculated/reviewed 상태의 batch만 승인할 수 있습니다.';
  end if;

  update payout_items set status = 'approved' where batch_id = p_batch_id;

  insert into payout_batch_audit_log (batch_id, action, actor_id)
    values (p_batch_id, 'approved', p_approved_by);

  -- 재승인(조정 후)으로 예정일이 달라지면 그것도 이력에 남는다.
  if v_previous is distinct from v_next then
    insert into payout_scheduled_date_events (batch_id, previous_date, new_date, source, actor_id, reason)
    values (p_batch_id, v_previous, v_next, 'approval', p_approved_by,
            case when v_previous is null then '승인 시 지급 예정일 확정' else '재승인으로 지급 예정일 재계산' end);
  end if;
end;
$$;

-- =========================================================================
-- 7. 관리자의 지급 예정일 변경
-- =========================================================================
create or replace function public.set_payout_batch_scheduled_date(
  p_batch_id uuid,
  p_new_date date,
  p_reason text,
  p_actor_id uuid
)
returns void
language plpgsql
security definer set search_path = public as $$
declare
  v_batch payout_batches%rowtype;
begin
  if coalesce(btrim(p_reason), '') = '' then
    raise exception '지급 예정일 변경 사유를 입력해주세요.';
  end if;

  select * into v_batch from payout_batches where id = p_batch_id for update;
  if not found then
    raise exception '존재하지 않는 정산 묶음입니다.';
  end if;
  if v_batch.status <> 'approved' then
    raise exception '송금 승인된 묶음의 지급 예정일만 변경할 수 있습니다(현재: %).', v_batch.status;
  end if;
  if v_batch.external_transfer_recorded_at is not null then
    raise exception '외부 송금 완료가 기록된 묶음은 지급 예정일을 변경할 수 없습니다.';
  end if;

  update payout_batches set scheduled_payout_date = p_new_date where id = p_batch_id;

  insert into payout_scheduled_date_events (batch_id, previous_date, new_date, reason, source, actor_id)
  values (p_batch_id, v_batch.scheduled_payout_date, p_new_date, btrim(p_reason), 'admin_change', p_actor_id);

  insert into payout_batch_audit_log (batch_id, action, actor_id, note)
  values (p_batch_id, 'scheduled_date_changed', p_actor_id,
          coalesce(v_batch.scheduled_payout_date::text, '(없음)') || ' → ' || p_new_date::text || ' — ' || btrim(p_reason));
end;
$$;

revoke execute on function public.set_payout_batch_scheduled_date(uuid, date, text, uuid) from public, anon, authenticated;
grant execute on function public.set_payout_batch_scheduled_date(uuid, date, text, uuid) to service_role;

-- =========================================================================
-- 8. 자동 송금 스위치 (전역 / 묶음별)
-- =========================================================================
create or replace function public.set_auto_dispatch_enabled(p_enabled boolean, p_actor_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update payout_auto_dispatch_settings
    set enabled = p_enabled, updated_by = p_actor_id, updated_at = now()
    where id = true;
end;
$$;
revoke execute on function public.set_auto_dispatch_enabled(boolean, uuid) from public, anon, authenticated;
grant execute on function public.set_auto_dispatch_enabled(boolean, uuid) to service_role;

create or replace function public.set_payout_batch_auto_dispatch(p_batch_id uuid, p_enabled boolean, p_actor_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_batch payout_batches%rowtype;
begin
  select * into v_batch from payout_batches where id = p_batch_id for update;
  if not found then
    raise exception '존재하지 않는 정산 묶음입니다.';
  end if;
  if v_batch.status in ('dispatch_requested', 'provider_pending', 'processing', 'paid') then
    raise exception '이미 송금 요청되었거나 지급 완료된 묶음은 자동 송금 설정을 바꿀 수 없습니다.';
  end if;

  update payout_batches set auto_dispatch_enabled = p_enabled where id = p_batch_id;
  insert into payout_batch_audit_log (batch_id, action, actor_id, note)
  values (p_batch_id, 'auto_dispatch_toggled', p_actor_id, case when p_enabled then '자동 송금 대상 포함' else '자동 송금 대상 제외' end);
end;
$$;
revoke execute on function public.set_payout_batch_auto_dispatch(uuid, boolean, uuid) from public, anon, authenticated;
grant execute on function public.set_payout_batch_auto_dispatch(uuid, boolean, uuid) to service_role;

-- =========================================================================
-- 9. 외부 송금 완료 기록
-- =========================================================================
-- **게이트를 확인하지 않는다(의도적)**: 이 경로는 시스템이 돈을 보내는 것이 아니라
-- 사람이 은행에서 이미 보낸 사실을 기록하는 것이다. 금융 제공자 API를 호출하지 않는다.
-- 대신 송금 승인된 묶음으로만 제한하고 처리자·시각·근거를 반드시 남긴다.
create or replace function public.record_external_payout_transfer(
  p_batch_id uuid,
  p_transferred_on date,
  p_amount_minor bigint,
  p_currency text,
  p_bank_reference text,
  p_memo text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare
  v_batch payout_batches%rowtype;
  v_id uuid;
begin
  if coalesce(btrim(p_bank_reference), '') = '' then
    raise exception '은행 거래 참조값을 입력해주세요.';
  end if;
  if p_amount_minor <= 0 then
    raise exception '송금 금액은 0보다 커야 합니다.';
  end if;

  select * into v_batch from payout_batches where id = p_batch_id for update;
  if not found then
    raise exception '존재하지 않는 정산 묶음입니다.';
  end if;
  if v_batch.status <> 'approved' then
    raise exception '송금 승인된 묶음에만 외부 송금 완료를 기록할 수 있습니다(현재: %).', v_batch.status;
  end if;
  if p_currency <> v_batch.currency then
    raise exception '묶음 통화(%)와 다른 통화(%)로는 기록할 수 없습니다.', v_batch.currency, p_currency;
  end if;

  insert into payout_external_transfers (batch_id, transferred_on, amount_minor, currency, bank_reference, memo, recorded_by)
  values (p_batch_id, p_transferred_on, p_amount_minor, p_currency, btrim(p_bank_reference), nullif(btrim(coalesce(p_memo, '')), ''), p_actor_id)
  returning id into v_id;

  update payout_batches
    set status = 'paid',
        paid_at = p_transferred_on::timestamptz,
        external_transfer_recorded_at = now()
    where id = p_batch_id;
  update payout_items
    set status = 'paid', external_transfer_recorded = true
    where batch_id = p_batch_id;

  insert into payout_batch_audit_log (batch_id, action, actor_id, note)
  values (p_batch_id, 'external_transfer_recorded', p_actor_id,
          p_transferred_on::text || ' · ' || p_amount_minor::text || ' ' || p_currency || ' · 참조 ' || btrim(p_bank_reference));

  return v_id;
end;
$$;

revoke execute on function public.record_external_payout_transfer(uuid, date, bigint, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_external_payout_transfer(uuid, date, bigint, text, text, text, uuid) to service_role;

-- =========================================================================
-- 10. 자동 송금 대상 조회(읽기 전용)
-- =========================================================================
create or replace function public.list_due_auto_dispatch_batches(p_on date default (now() at time zone 'UTC')::date)
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
    and (select s.enabled from payout_auto_dispatch_settings s where s.id = true)
  order by b.scheduled_payout_date, b.id;
$$;

revoke execute on function public.list_due_auto_dispatch_batches(date) from public, anon, authenticated;
grant execute on function public.list_due_auto_dispatch_batches(date) to service_role;

comment on function public.list_due_auto_dispatch_batches is
  'P4-2: 자동 송금 대상. 송금 승인됨 + 묶음별 자동 송금 켜짐 + 전역 스위치 켜짐 + 지급 예정일 도래 + '
  '외부 송금 미기록을 모두 만족하는 것만 돌려준다. 읽기 전용이며 상태를 바꾸지 않는다.';

-- =========================================================================
-- 11. 조정 차단 범위에 외부 송금 기록 추가
-- =========================================================================
create or replace function public.add_payout_batch_adjustment(
  p_batch_id uuid,
  p_amount_minor bigint,
  p_reason text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare
  v_batch payout_batches%rowtype;
  v_item_id uuid;
  v_adjustment_id uuid;
begin
  if p_amount_minor = 0 then
    raise exception '조정 금액은 0일 수 없습니다.';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception '조정 사유를 입력해주세요.';
  end if;

  select * into v_batch from payout_batches where id = p_batch_id for update;
  if not found then
    raise exception '존재하지 않는 정산 묶음입니다.';
  end if;

  if v_batch.status in ('dispatch_requested', 'provider_pending', 'processing', 'paid') then
    raise exception '송금 요청 이후에는 금액을 변경할 수 없습니다(현재: %). 차액은 다음 정산월 조정 항목으로 처리하세요.', v_batch.status;
  end if;
  if v_batch.external_transfer_recorded_at is not null then
    raise exception '외부 송금 완료가 기록된 묶음은 금액을 변경할 수 없습니다. 차액은 다음 정산월 조정 항목으로 처리하세요.';
  end if;
  if v_batch.status = 'failed' then
    raise exception '실패 처리된 묶음은 조정할 수 없습니다.';
  end if;

  insert into payout_items (
    batch_id, session_id, teacher_id, item_type, hourly_rate_snapshot_minor,
    currency, payable_minutes, amount_minor, status, adjustment_reason
  ) values (
    p_batch_id, null, v_batch.teacher_id, 'adjustment', 0,
    v_batch.currency, 0, p_amount_minor, 'batched', btrim(p_reason)
  ) returning id into v_item_id;

  insert into payout_batch_adjustments (batch_id, payout_item_id, amount_minor, currency, reason, created_by)
  values (p_batch_id, v_item_id, p_amount_minor, v_batch.currency, btrim(p_reason), p_actor_id)
  returning id into v_adjustment_id;

  insert into payout_batch_audit_log (batch_id, action, actor_id, note)
  values (p_batch_id, 'adjusted', p_actor_id, '조정 ' || p_amount_minor::text || ' — ' || btrim(p_reason));

  if v_batch.status = 'approved' then
    update payout_batches set status = 'reviewed', approved_at = null where id = p_batch_id;
    update payout_items set status = 'batched' where batch_id = p_batch_id and status = 'approved';
    insert into payout_batch_audit_log (batch_id, action, actor_id, note)
    values (p_batch_id, 'reverted_to_review', p_actor_id, '승인 후 금액 조정 — 재승인 필요');
  end if;

  return v_adjustment_id;
end;
$$;

-- =========================================================================
-- 12. paid 전이 가드에 "외부 수기 송금" 예외를 명시적으로 뚫는다
-- =========================================================================
-- 기존 가드(R10 corrective)는 provider_pending → paid 만 허용한다. 그 취지는
-- **시스템이 제공자 확인 없이 지급 완료를 주장하지 못하게** 하는 것이다.
-- 은행에서 사람이 직접 보낸 건은 그 파이프라인을 지나지 않는다 — 대신 은행 거래
-- 참조값·처리자·시각이라는 사람의 근거가 있다. 그래서 예외는 딱 한 경로,
-- record_external_payout_transfer()가 트랜잭션 안에서 세우는 플래그가 있을 때만
-- 열리고, 그 함수는 승인된 묶음·참조값 필수·감사 기록을 이미 강제한다.
create or replace function public.guard_payout_batch_paid_transition()
returns trigger
language plpgsql as $function$
begin
  if tg_op = 'INSERT' then
    if new.status = 'paid' then
      raise exception 'payout_batch는 paid 상태로 직접 생성할 수 없습니다. approved까지만 만들고 정규 파이프라인(dispatch_payout_batch -> mark_payout_batch_provider_pending -> mark_payout_batch_provider_confirmed -> mark_payout_batch_paid)을 거치세요.';
    end if;
    return new;
  end if;

  if new.status = 'paid' and old.status is distinct from 'paid' then
    -- 외부 수기 송금 기록 경로(record_external_payout_transfer)만의 예외.
    if coalesce(current_setting('app.external_payout_transfer', true), '') = 'on'
       and old.status = 'approved' then
      return new;
    end if;
    if old.status is distinct from 'provider_pending' then
      raise exception 'payout_batch는 provider_pending 상태에서만 paid로 전이할 수 있습니다(시도한 이전 상태: %). 외부 은행 송금은 record_external_payout_transfer()로 기록하세요.', old.status;
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.record_external_payout_transfer(
  p_batch_id uuid,
  p_transferred_on date,
  p_amount_minor bigint,
  p_currency text,
  p_bank_reference text,
  p_memo text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare
  v_batch payout_batches%rowtype;
  v_id uuid;
begin
  if coalesce(btrim(p_bank_reference), '') = '' then
    raise exception '은행 거래 참조값을 입력해주세요.';
  end if;
  if p_amount_minor <= 0 then
    raise exception '송금 금액은 0보다 커야 합니다.';
  end if;

  select * into v_batch from payout_batches where id = p_batch_id for update;
  if not found then
    raise exception '존재하지 않는 정산 묶음입니다.';
  end if;
  if v_batch.status <> 'approved' then
    raise exception '송금 승인된 묶음에만 외부 송금 완료를 기록할 수 있습니다(현재: %).', v_batch.status;
  end if;
  if p_currency <> v_batch.currency then
    raise exception '묶음 통화(%)와 다른 통화(%)로는 기록할 수 없습니다.', v_batch.currency, p_currency;
  end if;

  insert into payout_external_transfers (batch_id, transferred_on, amount_minor, currency, bank_reference, memo, recorded_by)
  values (p_batch_id, p_transferred_on, p_amount_minor, p_currency, btrim(p_bank_reference), nullif(btrim(coalesce(p_memo, '')), ''), p_actor_id)
  returning id into v_id;

  perform set_config('app.external_payout_transfer', 'on', true);
  update payout_batches
    set status = 'paid',
        paid_at = p_transferred_on::timestamptz,
        external_transfer_recorded_at = now()
    where id = p_batch_id;
  perform set_config('app.external_payout_transfer', 'off', true);

  update payout_items
    set status = 'paid', external_transfer_recorded = true
    where batch_id = p_batch_id;

  insert into payout_batch_audit_log (batch_id, action, actor_id, note)
  values (p_batch_id, 'external_transfer_recorded', p_actor_id,
          p_transferred_on::text || ' · ' || p_amount_minor::text || ' ' || p_currency || ' · 참조 ' || btrim(p_bank_reference));

  return v_id;
end;
$$;

-- =========================================================================
-- 13. paid 근거를 "제공자 확인 또는 외부 송금 기록" 둘 중 하나로 넓힌다
-- =========================================================================
-- 기존 CHECK는 paid이면 provider_transaction_id/provider_confirmed_at이 반드시
-- 있어야 했다(제공자 확인 없는 낙관적 paid 방지). 은행 수기 송금에는 제공자가
-- 없으므로 그 근거를 external_transfer_recorded_at으로도 인정한다 —
-- **근거 없는 paid는 여전히 불가능하다**(둘 중 하나는 반드시 있어야 한다).
alter table payout_batches drop constraint if exists payout_batches_paid_requires_confirmation;
alter table payout_batches add constraint payout_batches_paid_requires_confirmation
  check (
    status <> 'paid'
    or (provider_transaction_id is not null and provider_confirmed_at is not null)
    or external_transfer_recorded_at is not null
  );

comment on constraint payout_batches_paid_requires_confirmation on payout_batches is
  'P4-2: 지급 완료는 근거가 있어야 한다 — 금융 제공자 확인(provider_transaction_id + provider_confirmed_at) '
  '또는 외부 은행 송금 기록(external_transfer_recorded_at) 둘 중 하나. 근거 없는 paid는 여전히 막힌다.';

-- 항목 단위에도 같은 근거 규칙을 적용한다. 외부 은행 송금으로 지급된 항목은
-- 제공자 확인 값이 없으므로, 그 묶음이 외부 송금으로 기록됐다는 사실을 근거로 인정한다.
alter table payout_items drop constraint if exists payout_items_paid_requires_confirmation;
alter table payout_items add constraint payout_items_paid_requires_confirmation
  check (
    status <> 'paid'
    or (provider_transaction_id is not null and provider_confirmed_at is not null)
    or external_transfer_recorded is true
  );
