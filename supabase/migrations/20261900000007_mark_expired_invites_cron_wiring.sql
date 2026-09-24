-- 2026-09-24(Section 2 — "오픈 전 blocker: mark_expired_invites cron 연결") —
-- mark_expired_invites()는 is_admin()만 통과시킨다(auth.uid()가 admin profile을
-- 가리켜야 함). 정기 크론은 service_role 키로 호출하는데, service_role 호출은
-- auth.uid()가 null이라 is_admin()이 항상 false — 크론이 이 함수를 그대로 쓰면
-- 매번 "관리자만 실행할 수 있습니다" 예외로 실패한다. service_role(auth.role())도
-- 통과하도록 조건만 넓힌다(사람 관리자 세션 경로는 그대로 유지 — 권한 축소 아님).
create or replace function public.mark_expired_invites()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_count int;
begin
  if not (is_admin() or auth.role() = 'service_role') then
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

revoke execute on function public.mark_expired_invites() from public, anon, authenticated;
grant execute on function public.mark_expired_invites() to authenticated, service_role;
