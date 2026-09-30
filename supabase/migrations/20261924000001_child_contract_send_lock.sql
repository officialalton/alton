-- 2026-09-29 온보딩 정책 라운드 D3b — 같은 자녀에게 계약이 동시에 두 번 발송되는 창을 닫는다.
--
-- 계약 발송(lib/regular-contract-send.ts)은 "기존 envelope 조회 → 없으면 DocuSign 발송"의 check-then-act 이고,
-- 중간에 외부 HTTP 호출이 끼어 트랜잭션 하나로 묶을 수 없다. PostgREST 는 호출마다 다른 커넥션을 쓰므로
-- pg_advisory_lock(세션 락)은 호출 사이에 유지되지 않는다. 그래서 자녀 단위 배타 임대(lease)를 DB 에 둔다:
-- primary key 가 자녀 id 라 동시에 두 호출이 들어와도 정확히 한 쪽만 획득하고, 만료 시각이 지나면 죽은
-- 워커의 임대를 다음 호출이 가져간다.
--
-- 롤백: drop function try_acquire_child_contract_send_lock, release_child_contract_send_lock; drop table.

create table if not exists public.child_contract_send_locks (
  child_id uuid primary key references public.profiles(id) on delete cascade,
  lock_token uuid not null,
  locked_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.child_contract_send_locks enable row level security;
-- 정책 없음 = service_role 전용(RLS 우회).

create or replace function public.try_acquire_child_contract_send_lock(p_child_id uuid, p_ttl_seconds integer default 300)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_token uuid := gen_random_uuid();
  v_got uuid;
begin
  -- 원자적: 행이 없으면 삽입, 있으면 "만료된 경우에만" 탈취. 조건이 거짓이면 아무것도 반환하지 않는다.
  insert into child_contract_send_locks as l (child_id, lock_token, locked_at, expires_at)
  values (p_child_id, v_token, now(), now() + make_interval(secs => greatest(p_ttl_seconds, 1)))
  on conflict (child_id) do update
    set lock_token = excluded.lock_token, locked_at = excluded.locked_at, expires_at = excluded.expires_at
    where l.expires_at <= now()
  returning lock_token into v_got;
  return v_got; -- null = 다른 발송이 진행 중
end;
$$;

create or replace function public.release_child_contract_send_lock(p_child_id uuid, p_token uuid)
returns void
language sql
security definer
set search_path to 'public'
as $$
  delete from child_contract_send_locks where child_id = p_child_id and lock_token = p_token;
$$;

revoke all on function public.try_acquire_child_contract_send_lock(uuid, integer) from public, anon, authenticated;
revoke all on function public.release_child_contract_send_lock(uuid, uuid) from public, anon, authenticated;
grant execute on function public.try_acquire_child_contract_send_lock(uuid, integer) to service_role;
grant execute on function public.release_child_contract_send_lock(uuid, uuid) to service_role;
