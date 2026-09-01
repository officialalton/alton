-- R2 Task 7 — Workspace preflight 감사 기록 + 반복 호출 제한.
--
-- 실제 Google API를 두드리기 전에(begin) 슬롯을 예약해 쿨다운을 강제하고,
-- 끝난 뒤(finish) 결과를 채운다 — 쿨다운 위반은 실제 호출이 일어나기
-- 전에 걸린다. 결과에는 토큰·임시 비밀번호·OU 전체 사용자의 이름/개인
-- 이메일/전화번호를 저장하지 않는다 — 단계별 성공/실패, 오류 코드,
-- 카운트, Google user ID의 비가역 해시만 남긴다(앱 레이어에서 해시해
-- 넘긴다).

create table workspace_preflight_runs (
  id uuid primary key default gen_random_uuid(),
  run_by uuid not null references profiles (id),
  run_at timestamptz not null default now(),
  finished_at timestamptz,
  environment text,
  stages jsonb,
  ou_user_count integer,
  ou_user_id_hashes text[],
  target_email_baseline jsonb
);
create index on workspace_preflight_runs (run_at desc);

alter table workspace_preflight_runs enable row level security;
create policy "관리자만 조회" on workspace_preflight_runs for select using (is_admin());

-- 쿨다운(초). 실제 Google API를 반복 호출하는 것을 막기 위한 최소
-- 간격이다 — 값 자체보다 "슬롯을 먼저 예약한다"는 순서가 핵심이다.
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
    raise exception 'preflight는 %초에 한 번만 실행할 수 있습니다(마지막 실행: %).', v_cooldown_seconds, v_last_run;
  end if;

  insert into workspace_preflight_runs (run_by) values (auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;
revoke execute on function public.begin_workspace_preflight_run() from public;
grant execute on function public.begin_workspace_preflight_run() to authenticated;

create or replace function public.finish_workspace_preflight_run(
  p_run_id uuid,
  p_environment text,
  p_stages jsonb,
  p_ou_user_count integer,
  p_ou_user_id_hashes text[],
  p_target_email_baseline jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception '관리자만 preflight 결과를 기록할 수 있습니다.';
  end if;

  update workspace_preflight_runs
  set finished_at = now(),
      environment = p_environment,
      stages = p_stages,
      ou_user_count = p_ou_user_count,
      ou_user_id_hashes = p_ou_user_id_hashes,
      target_email_baseline = p_target_email_baseline
  where id = p_run_id and run_by = auth.uid();

  if not found then
    raise exception '존재하지 않거나 본인이 시작하지 않은 preflight 실행입니다: %', p_run_id;
  end if;
end;
$$;
revoke execute on function public.finish_workspace_preflight_run(uuid, text, jsonb, integer, text[], jsonb) from public;
grant execute on function public.finish_workspace_preflight_run(uuid, text, jsonb, integer, text[], jsonb) to authenticated;
