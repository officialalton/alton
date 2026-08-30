-- R1 — v3 스키마 6/12: entitlement_grants / entitlement_ledger + 동시성 제어 함수
-- (Gate B §3.6, v4 개정: 이중 계산 버그 수정 — 잔액은 sum(ledger.amount)만으로 계산)

create table entitlement_grants (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references profiles (id),
  entitlement_product_id uuid not null references entitlement_products (id),
  purchase_id uuid, -- R4에서 purchases 테이블 생성 후 FK 추가 예정(현재는 참조 없음)
  original_quantity int not null check (original_quantity > 0), -- 감사용 스냅샷, 잔액 계산에 재사용 금지
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index on entitlement_grants (child_id);
create index on entitlement_grants (child_id, expires_at);

create table entitlement_ledger (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references entitlement_grants (id),
  event_type v3_entitlement_event_type not null,
  amount int not null, -- 부호 있는 델타. grant/release/adjust(+) 는 양수, hold/expire/refund/transfer-out(-)은 음수, consume은 0
  reservation_id uuid references reservations (id),
  business_event_id text,
  transfer_group_id uuid,
  created_at timestamptz not null default now(),
  check (
    (event_type in ('hold', 'consume', 'release') and reservation_id is not null and business_event_id is null)
    or
    (event_type in ('grant', 'adjust', 'expire', 'refund', 'transfer') and reservation_id is null and business_event_id is not null)
  )
);
create index on entitlement_ledger (grant_id);

-- 재전송 안전성(Gate B §3.6): 예약 연계 이벤트는 예약당 이벤트 타입 1건, 그 외는 grant+event_type+business_event_id 1건
create unique index entitlement_ledger_reservation_dedup
  on entitlement_ledger (reservation_id, event_type) where (reservation_id is not null);
create unique index entitlement_ledger_business_event_dedup
  on entitlement_ledger (grant_id, event_type, business_event_id) where (business_event_id is not null);

-- INSERT-only(Gate B §3.6)
create or replace function public.reject_ledger_mutation()
returns trigger
language plpgsql as $$
begin
  raise exception 'entitlement_ledger는 INSERT-only입니다. UPDATE/DELETE를 사용할 수 없습니다.';
end;
$$;
create trigger entitlement_ledger_no_update
  before update or delete on entitlement_ledger
  for each row execute function public.reject_ledger_mutation();
revoke execute on function public.reject_ledger_mutation() from public, anon, authenticated, service_role;
-- 트리거 전용(직접 호출 불가) — Gate B §7 점검 원칙에 따라 명시적으로 revoke.

-- 잔여 조회 뷰: quantity를 더하지 않고 ledger 합산만으로 계산(이중 계산 버그 방지)
create or replace view entitlement_balances as
select
  g.id as grant_id,
  g.child_id,
  g.expires_at,
  coalesce(sum(l.amount), 0) as remaining
from entitlement_grants g
left join entitlement_ledger l on l.grant_id = g.id
group by g.id, g.child_id, g.expires_at;

create or replace function public.hold_entitlement(p_child_id uuid, p_reservation_id uuid, p_lesson_start_at timestamptz, p_needed int default 1)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_grant record;
  v_remaining int;
begin
  if p_needed <= 0 then
    raise exception 'p_needed는 0보다 커야 합니다(받은 값: %).', p_needed;
  end if;

  for v_grant in
    select id from entitlement_grants
    where child_id = p_child_id and expires_at > p_lesson_start_at
    order by expires_at asc, created_at asc
    for update
  loop
    select coalesce(sum(amount), 0) into v_remaining from entitlement_ledger where grant_id = v_grant.id;
    if v_remaining >= p_needed then
      insert into entitlement_ledger (grant_id, event_type, amount, reservation_id)
      values (v_grant.id, 'hold', -p_needed, p_reservation_id);
      return v_grant.id;
    end if;
  end loop;
  raise exception '사용 가능한 수업권이 없습니다.';
end;
$$;

-- (2026-08-30 정정) 원래 버전은 grant를 잠그기 *전에* 반대 이벤트(consume/release)
-- 존재 여부를 검사했다. consume()과 release()가 같은 예약에 동시에 들어오면 둘 다
-- "반대 이벤트가 아직 없다"고 읽고 통과한 뒤 그제서야 grant를 잠그러 가므로, 결국
-- 둘 다 insert에 성공해 이중 기록이 될 수 있었다(락 획득 *전* 판단이라 서로를 못 봄).
-- 수정: grant를 먼저 잠그고, 잠금을 획득한 *뒤에* 같은 이벤트/반대 이벤트를 다시
-- 검사한다 — 이러면 두 트랜잭션 중 먼저 락을 잡은 쪽이 커밋할 때까지 나머지는
-- 대기하고, 락을 넘겨받은 시점에는 상대가 이미 insert한 행이 보이므로 정확히 1건만
-- 성공한다.
create or replace function public.consume_entitlement(p_reservation_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_grant_id uuid;
begin
  select grant_id into v_grant_id from entitlement_ledger
    where reservation_id = p_reservation_id and event_type = 'hold';
  if v_grant_id is null then
    raise exception '해당 예약의 hold를 찾을 수 없습니다.';
  end if;

  -- grant를 먼저 잠근다: 동시에 들어온 consume()/release() 요청이 여기서 직렬화된다.
  perform 1 from entitlement_grants where id = v_grant_id for update;

  -- 잠금 획득 *후* 재검사 — 대기하는 동안 상대 트랜잭션이 먼저 커밋했을 수 있다.
  if exists (select 1 from entitlement_ledger where reservation_id = p_reservation_id and event_type = 'consume') then
    raise exception '이미 consume되었습니다.';
  end if;
  if exists (select 1 from entitlement_ledger where reservation_id = p_reservation_id and event_type = 'release') then
    raise exception '이미 release된 예약은 consume할 수 없습니다.';
  end if;

  insert into entitlement_ledger (grant_id, event_type, amount, reservation_id)
  values (v_grant_id, 'consume', 0, p_reservation_id);
end;
$$;

create or replace function public.release_entitlement(p_reservation_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_hold record;
begin
  select grant_id, -amount as held_amount into v_hold from entitlement_ledger
    where reservation_id = p_reservation_id and event_type = 'hold';
  if v_hold.grant_id is null then
    raise exception '해당 예약의 hold를 찾을 수 없습니다.';
  end if;

  -- grant를 먼저 잠근다(consume_entitlement()와 동일한 원리 — 위 주석 참고).
  perform 1 from entitlement_grants where id = v_hold.grant_id for update;

  if exists (select 1 from entitlement_ledger where reservation_id = p_reservation_id and event_type = 'release') then
    raise exception '이미 release되었습니다.';
  end if;
  if exists (select 1 from entitlement_ledger where reservation_id = p_reservation_id and event_type = 'consume') then
    raise exception '이미 consume된 예약은 release할 수 없습니다.';
  end if;

  insert into entitlement_ledger (grant_id, event_type, amount, reservation_id)
  values (v_hold.grant_id, 'release', v_hold.held_amount, p_reservation_id);
end;
$$;

revoke execute on function public.hold_entitlement(uuid, uuid, timestamptz, int) from public, anon, authenticated;
revoke execute on function public.consume_entitlement(uuid) from public, anon, authenticated;
revoke execute on function public.release_entitlement(uuid) from public, anon, authenticated;
-- public/anon/authenticated(클라이언트가 도달 가능한 역할)에서는 전부 revoke한다.
-- service_role은 일부러 revoke하지 않는다 — 이 함수들은 Next.js 서버 액션이 Supabase
-- service-role 클라이언트로 호출하도록 설계됐고(Gate B "서버 액션(서비스 role)에서만
-- 호출"), service_role까지 막으면 애플리케이션이 이 함수들을 호출할 방법이 없어진다.
-- reopen_session()/recomplete_session()과 달리 이 세 함수는 auth.uid() 기반 is_admin()
-- 검사가 없으므로 service_role 호출이 정상 경로다.

comment on table entitlement_grants is 'Gate B §3.6: original_quantity는 감사 스냅샷일 뿐 잔액 계산(entitlement_balances 뷰)에는 사용하지 않는다.';
comment on view entitlement_balances is 'v4 개정: 이중 계산 버그 수정 — quantity를 더하지 않고 sum(ledger.amount)만으로 잔액 계산.';
