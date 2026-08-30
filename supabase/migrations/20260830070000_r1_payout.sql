-- R1 — v3 스키마 8/12: payout_items / payout_batches (Gate B §3.9)

create table payout_batches (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles (id),
  period_start date not null,
  period_end date not null,
  currency text not null,
  status v3_payout_batch_status not null default 'draft',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz,
  check (period_end >= period_start)
);
create index on payout_batches (teacher_id);

create table payout_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references payout_batches (id),
  session_id uuid references sessions_v3 (id),
  teacher_id uuid not null references profiles (id),
  item_type text not null default 'regular', -- regular | trial | makeup | adjustment | reversal
  hourly_rate_snapshot_minor bigint not null,
  currency text not null,
  payable_minutes int not null,
  amount_minor bigint not null,
  status v3_payout_item_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index on payout_items (batch_id);
create index on payout_items (teacher_id);
create index on payout_items (session_id);

-- 불변(Gate B §3.9): batch는 단일 통화만
create or replace function public.check_payout_batch_currency()
returns trigger
language plpgsql as $$
declare
  v_batch_currency text;
begin
  if new.batch_id is not null then
    select currency into v_batch_currency from payout_batches where id = new.batch_id;
    if v_batch_currency is not null and v_batch_currency != new.currency then
      raise exception 'payout_item 통화(%)가 batch 통화(%)와 다릅니다.', new.currency, v_batch_currency;
    end if;
  end if;
  return new;
end;
$$;
create trigger payout_items_check_currency
  before insert or update on payout_items
  for each row execute function public.check_payout_batch_currency();
revoke execute on function public.check_payout_batch_currency() from public, anon, authenticated, service_role;
-- 트리거 전용(직접 호출 불가) — Gate B §7 점검 원칙에 따라 명시적으로 revoke.

-- 불변: paid 이후 원본 수정 금지, adjustment/reversal item 추가만
create or replace function public.prevent_paid_item_mutation()
returns trigger
language plpgsql as $$
begin
  if old.status = 'paid' then
    raise exception 'paid 상태의 payout_item은 수정할 수 없습니다. adjustment/reversal item을 추가하세요.';
  end if;
  return new;
end;
$$;
create trigger payout_items_prevent_paid_mutation
  before update on payout_items
  for each row execute function public.prevent_paid_item_mutation();
revoke execute on function public.prevent_paid_item_mutation() from public, anon, authenticated, service_role;
-- 트리거 전용(직접 호출 불가) — Gate B §7 점검 원칙에 따라 명시적으로 revoke.

comment on table payout_batches is 'Gate B §3.9: 단일 통화 체크 제약은 트리거로 강제(payout_items_check_currency).';
comment on table payout_items is 'session_id는 세션 완료 트랜잭션에서 생성. item_type=adjustment/reversal로 paid 이후 정정.';
