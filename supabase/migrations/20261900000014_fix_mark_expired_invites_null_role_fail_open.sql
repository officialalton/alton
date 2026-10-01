-- corrective(2026-09-24) — 20261900000007에서 도입한 `is_admin() or
-- auth.role() = 'service_role'` 게이트가 fail-open이었다. auth.role()은 jwt
-- role claim이 아예 없으면 NULL을 반환하는데(예: jwt.claim.sub만 있는 일반
-- authenticated 세션), is_admin()이 false이고 auth.role()이 NULL이면
-- `false or NULL` = NULL이 되고 `not NULL`도 NULL이 되어, plpgsql이 NULL
-- 조건을 false로 취급해 게이트를 그냥 통과시켰다 — 로그인한 비관리자 누구나
-- mark_expired_invites()를 실행할 수 있었다(closure automation 작업 중
-- close_expired_pending_accounts()에서 같은 패턴을 실제 테스트로 재현해
-- 발견). coalesce로 NULL을 명시적으로 배제해 고친다. 본문은 그대로.
create or replace function public.mark_expired_invites()
returns integer
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_count int;
begin
  if not (is_admin() or coalesce(auth.role(), '') = 'service_role') then
    raise exception '관리자만 실행할 수 있습니다.';
  end if;

  -- (주의) 'expired' CTE는 반드시 'tokens'의 출력(row_id)에 의존해야 한다 —
  -- 'candidates'에만 의존하면 PostgreSQL이 'tokens' INSERT보다 'expired'
  -- UPDATE를 먼저(또는 병렬로) 실행할 수 있어(둘 다 candidates에만 의존하고
  -- 서로 데이터 의존성이 없으므로 실행 순서가 보장되지 않는다) 트리거가
  -- 아직 존재하지 않는 토큰을 찾다가 거부하는 문제가 실제로 발생했다 —
  -- 'where id in (select row_id from tokens)'로 명시적 의존성을 만들어 반드시
  -- 토큰 INSERT가 먼저 끝난 뒤에만 UPDATE가 실행되도록 강제한다.
  with candidates as (
    select id from account_invites
    where status = 'pending' and expires_at <= now()
    for update
  ),
  tokens as (
    insert into public.status_transition_tokens (table_name, row_id, action)
    select 'account_invites', id, 'invite_status_transition' from candidates
    returning row_id
  ),
  expired as (
    update account_invites
    set status = 'expired', updated_at = now()
    where id in (select row_id from tokens)
    returning id
  )
  insert into account_invite_events (invite_id, event_type)
  select id, 'expired' from expired;
  get diagnostics v_count = row_count;

  return v_count;
end;
$$;
