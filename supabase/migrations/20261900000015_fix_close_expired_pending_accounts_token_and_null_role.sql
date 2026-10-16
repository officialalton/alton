-- corrective(2026-09-24) — 20261900000013이 non-prod에 먼저 적용된 뒤 두 가지
-- 결함을 로컬 테스트로 발견했다: (1) status_transition_tokens를 INSERT하지
-- 않고 바로 UPDATE해서 protect_account_status() 트리거가 항상 거부했다
-- (transition_account_status()가 하는 것과 동일한 토큰 발급이 빠져 있었음).
-- (2) `is_admin() or auth.role() = 'service_role'` 게이트가 mark_expired_invites와
-- 같은 fail-open 버그였다(auth.role()이 NULL이면 `false or NULL`=NULL이 되어
-- `not NULL`도 NULL, plpgsql이 NULL 조건을 false로 취급해 게이트를 통과시킴).
-- 이미 적용된 20261900000013 파일을 고쳐도 반영되지 않으므로 새 번호로 올린다.
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
