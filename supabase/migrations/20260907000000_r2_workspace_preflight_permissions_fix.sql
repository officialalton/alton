-- R2 Task 7 — preflight 함수 실행 권한을 Gate B §7 최소 권한 원칙에
-- 맞춰 정리 + 쿨다운 예외 구분용 커스텀 SQLSTATE.
--
-- 원인: 이 Supabase 프로젝트는 public 스키마에 새로 생성되는 모든
-- 함수에 anon/authenticated/service_role EXECUTE를 자동으로 부여하는
-- 기본 권한 규칙(pg_default_acl)을 갖고 있다. 이전 마이그레이션의
-- `revoke ... from public`은 PUBLIC 의사 role에서만 회수했을 뿐, anon에
-- 개별적으로 걸린 기본 권한은 회수하지 않았다 — 함수 본문의
-- is_admin() 검사(이중 방어의 두 번째 층)가 실제 접근을 이미 막고
-- 있었지만, 첫 번째 층(GRANT)도 명시적으로 authenticated로만 좁힌다.
-- 이 프로젝트의 다른 기존 SECURITY DEFINER 함수 전체에 대한 동일한
-- 감사·정리는 이 마이그레이션의 범위가 아니다 — master-roadmap-v3.md
-- R12에 별도 보안 작업으로 등록한다.

-- 쿨다운 위반만 앱 레이어에서 429로 구분 매핑할 수 있도록 전용
-- SQLSTATE(ALT01)를 부여한다 — 스키마 캐시 누락 등 다른 인프라 오류와
-- 혼동되지 않게 하기 위함.
create or replace function public.begin_workspace_preflight_run()
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_last_run timestamptz;
  v_id uuid;
  v_cooldown_seconds constant integer := 300;
begin
  if not is_admin() then
    raise exception '관리자만 preflight를 실행할 수 있습니다.';
  end if;

  select max(run_at) into v_last_run from workspace_preflight_runs;
  if v_last_run is not null and v_last_run > now() - make_interval(secs => v_cooldown_seconds) then
    raise exception 'preflight는 %초에 한 번만 실행할 수 있습니다(마지막 실행: %).', v_cooldown_seconds, v_last_run
      using errcode = 'ALT01';
  end if;

  insert into workspace_preflight_runs (run_by) values (auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.begin_workspace_preflight_run() from public;
revoke execute on function public.begin_workspace_preflight_run() from anon;
grant execute on function public.begin_workspace_preflight_run() to authenticated;

revoke execute on function public.finish_workspace_preflight_run(uuid, text, jsonb, integer, text[], jsonb) from public;
revoke execute on function public.finish_workspace_preflight_run(uuid, text, jsonb, integer, text[], jsonb) from anon;
grant execute on function public.finish_workspace_preflight_run(uuid, text, jsonb, integer, text[], jsonb) to authenticated;
