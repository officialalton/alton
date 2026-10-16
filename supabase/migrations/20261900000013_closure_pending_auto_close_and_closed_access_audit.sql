-- R12(Section 2, 2026-09-24) — closure_pending 30일 유예 자동 폐쇄 + closed 계정
-- 접근통제·감사. product-architecture-v3.md §4.13/§4.19 정책 구현.
--
-- 1) account_closure_access_events: closed 계정 상세를 열람할 때마다 사유와 함께
--    남기는 append-only 감사 로그(§4.13 "조회·내보내기·변경은 전부 감사 로그에
--    남긴다"). account_status_events와 동일한 INSERT-only 패턴.
create table account_closure_access_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id),
  accessed_by uuid references profiles (id),
  reason text not null,
  accessed_at timestamptz not null default now()
);
create index on account_closure_access_events (profile_id);

create or replace function public.reject_account_closure_access_event_mutation()
returns trigger
language plpgsql as $$
begin
  raise exception 'account_closure_access_events는 INSERT-only입니다.';
end;
$$;
create trigger account_closure_access_events_no_update
  before update or delete on account_closure_access_events
  for each row execute function public.reject_account_closure_access_event_mutation();
revoke execute on function public.reject_account_closure_access_event_mutation() from public, anon, authenticated, service_role;

alter table account_closure_access_events enable row level security;
create policy "관리자만 조회" on account_closure_access_events for select
  using (is_admin());
-- insert 정책 없음(기본 거부) — record_closed_account_access() SECURITY DEFINER만 기록 가능.

-- ---------------------------------------------------------------------------
-- record_closed_account_access(p_profile_id, p_reason): closed 계정 상세를 열기
-- 전에 관리자가 반드시 호출해야 하는 게이트. 사유 없이는 기록되지 않는다.
create or replace function public.record_closed_account_access(p_profile_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  if not is_admin() then
    raise exception '이 작업은 관리자만 할 수 있습니다.';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception '조회 사유를 입력해야 합니다.';
  end if;
  if get_account_status(p_profile_id) <> 'closed' then
    raise exception '폐쇄된 계정이 아닙니다.';
  end if;
  insert into account_closure_access_events (profile_id, accessed_by, reason)
  values (p_profile_id, auth.uid(), p_reason);
end;
$$;
revoke execute on function public.record_closed_account_access(uuid, text) from public, anon;

-- ---------------------------------------------------------------------------
-- close_expired_pending_accounts(): closure_pending으로 전이된 지 30일이 지난
-- 계정을 closed로 자동 전환한다. transition_account_status()는 is_admin()만
-- 허용해 cron(service_role)이 호출할 수 없으므로, 같은 잠금·기록 패턴을
-- 그대로 따르는 전용 함수를 둔다(auth.role()='service_role' 허용).
-- 30일 기준: 해당 프로필의 가장 최근 closure_pending 전이 이벤트 시각.
create or replace function public.close_expired_pending_accounts()
returns integer
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  -- auth.role()은 jwt role claim이 아예 없으면 NULL을 반환한다(일반
  -- authenticated 세션이 jwt.claim.sub만 설정한 경우 등) — is_admin()이
  -- false고 auth.role()이 NULL이면 `false or NULL` = NULL이 되어 `not NULL`도
  -- NULL이 되고, plpgsql은 NULL 조건을 false로 취급해 이 게이트를 그냥
  -- 통과시켜버린다(fail-open). coalesce로 NULL을 명시적으로 배제한다.
  if not (is_admin() or coalesce(auth.role(), '') = 'service_role') then
    raise exception '이 작업은 관리자 또는 시스템만 할 수 있습니다.';
  end if;

  for v_row in
    select distinct on (ase.profile_id) ase.profile_id, ase.created_at, p.role
    from account_status_events ase
    join profiles p on p.id = ase.profile_id
    where ase.new_status = 'closure_pending'
    order by ase.profile_id, ase.created_at desc
  loop
    -- 그 사이 철회(closure_pending -> active/suspended)됐거나 이미 closed면 건너뛴다.
    if get_account_status(v_row.profile_id) <> 'closure_pending' then
      continue;
    end if;
    if v_row.created_at > now() - interval '30 days' then
      continue;
    end if;

    if v_row.role = 'student' then
      perform 1 from students where id = v_row.profile_id for update;
      insert into public.status_transition_tokens (table_name, row_id, action) values ('students', v_row.profile_id, 'status_transition');
      update students set status = 'closed' where id = v_row.profile_id;
    elsif v_row.role = 'teacher' then
      perform 1 from teachers where id = v_row.profile_id for update;
      insert into public.status_transition_tokens (table_name, row_id, action) values ('teachers', v_row.profile_id, 'status_transition');
      update teachers set status = 'closed' where id = v_row.profile_id;
    elsif v_row.role = 'parent' then
      perform 1 from parents where id = v_row.profile_id for update;
      insert into public.status_transition_tokens (table_name, row_id, action) values ('parents', v_row.profile_id, 'status_transition');
      update parents set status = 'closed' where id = v_row.profile_id;
    else
      continue;
    end if;

    insert into account_status_events (profile_id, previous_status, new_status, changed_by, reason)
    values (v_row.profile_id, 'closure_pending', 'closed', null, '30일 철회 유예 만료로 자동 폐쇄');
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
revoke execute on function public.close_expired_pending_accounts() from public, anon;
