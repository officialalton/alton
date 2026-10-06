-- 2026-10-06 Free Accounts 7/7 — 열람 감사 view_kind 'free_profile' 추가 + 테스트 계정 수동 표식(감사 이력 포함).
alter table staff_student_view_log drop constraint if exists staff_student_view_log_view_kind_check;
alter table staff_student_view_log add constraint staff_student_view_log_view_kind_check
  check (view_kind in ('overview', 'board', 'stats', 'free_profile'));

create or replace function public.record_staff_student_view(p_student_id uuid, p_view_kind text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_tier text;
begin
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  if p_view_kind not in ('overview', 'board', 'stats', 'free_profile') then raise exception '알 수 없는 화면 종류입니다.'; end if;
  select role, admin_tier into v_role, v_tier from profiles where id = v_uid;
  if v_role = 'admin' then
    if v_tier = 'supervisor' and not coalesce(current_user_has_capability('학생관리'), false) then
      raise exception '이 학생을 열람할 권한이 없습니다.';
    end if;
  elsif v_role = 'consultant' then
    if not is_assigned_consultant_of(p_student_id) then raise exception '담당 학생만 열람할 수 있습니다.'; end if;
  elsif v_role = 'teacher' then
    if not teaches_student(p_student_id) then raise exception '현재 담당 중인 학생만 열람할 수 있습니다.'; end if;
  else
    raise exception '이 학생을 열람할 권한이 없습니다.';
  end if;

  -- 같은 열람자·학생 조합은 직렬화해 동시 호출에도 중복 기록이 생기지 않게 한다.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || p_student_id::text || p_view_kind, 0));
  if exists (
    select 1 from staff_student_view_log
    where viewer_id = v_uid and student_id = p_student_id and view_kind = p_view_kind
      and viewed_at > now() - interval '10 minutes'
  ) then
    return false;
  end if;
  insert into staff_student_view_log (viewer_id, student_id, view_kind) values (v_uid, p_student_id, p_view_kind);
  return true;
end $$;
revoke execute on function public.record_staff_student_view(uuid, text) from public, anon;
grant execute on function public.record_staff_student_view(uuid, text) to authenticated;

create table if not exists student_flag_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  flag text not null check (flag in ('test_account')),
  previous_value boolean not null,
  new_value boolean not null,
  changed_by uuid references profiles (id),
  reason text not null,
  created_at timestamptz not null default now()
);
alter table student_flag_events enable row level security;
comment on table student_flag_events is '학생 플래그(테스트 계정 등) 변경 감사. INSERT-only, 쓰기는 RPC만.';

create or replace function public.admin_set_test_account(p_student_id uuid, p_flag boolean, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_prev boolean;
begin
  if not _free_accounts_staff() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  select is_test_account into v_prev from students where id = p_student_id for update;
  if not found then raise exception 'student_not_found'; end if;
  if v_prev is not distinct from p_flag then return; end if;
  update students set is_test_account = p_flag, test_account_source = case when p_flag then 'manual' else null end where id = p_student_id;
  insert into student_flag_events (student_id, flag, previous_value, new_value, changed_by, reason)
  values (p_student_id, 'test_account', v_prev, p_flag, auth.uid(), btrim(p_reason));
end $$;
revoke execute on function public.admin_set_test_account(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_test_account(uuid, boolean, text) to authenticated;
