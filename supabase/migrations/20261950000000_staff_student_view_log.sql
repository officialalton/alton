-- 2026-09-29 — 관리자·담당 컨설턴트의 학생 오버뷰/보드/통계 열람 감사 이력(append-only).
-- 같은 열람자·학생·화면 조합은 10분 안에 1건으로 묶는다. 기록은 RPC로만 생기고
-- 관리자만 조회하며, UPDATE/DELETE는 트리거로 막는다.
create table if not exists public.staff_student_view_log (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references public.profiles(id),
  student_id uuid not null references public.profiles(id),
  view_kind text not null check (view_kind in ('overview', 'board', 'stats')),
  viewed_at timestamptz not null default now()
);
create index if not exists staff_student_view_log_dedupe_idx
  on public.staff_student_view_log (viewer_id, student_id, view_kind, viewed_at desc);
create index if not exists staff_student_view_log_student_idx
  on public.staff_student_view_log (student_id, viewed_at desc);

alter table public.staff_student_view_log enable row level security;
drop policy if exists "관리자 조회" on public.staff_student_view_log;
create policy "관리자 조회" on public.staff_student_view_log for select using (public.is_admin());
revoke all on public.staff_student_view_log from anon, authenticated;
grant select on public.staff_student_view_log to authenticated;

create or replace function public.staff_student_view_log_immutable() returns trigger
language plpgsql as $$
begin
  raise exception '열람 기록은 수정·삭제할 수 없습니다.';
end $$;
drop trigger if exists staff_student_view_log_immutable on public.staff_student_view_log;
create trigger staff_student_view_log_immutable
  before update or delete on public.staff_student_view_log
  for each row execute function public.staff_student_view_log_immutable();

create or replace function public.record_staff_student_view(p_student_id uuid, p_view_kind text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_tier text;
begin
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  if p_view_kind not in ('overview', 'board', 'stats') then raise exception '알 수 없는 화면 종류입니다.'; end if;
  select role, admin_tier into v_role, v_tier from profiles where id = v_uid;
  if v_role = 'admin' then
    if v_tier = 'supervisor' and not coalesce(current_user_has_capability('학생관리'), false) then
      raise exception '이 학생을 열람할 권한이 없습니다.';
    end if;
  elsif v_role = 'consultant' then
    if not is_assigned_consultant_of(p_student_id) then raise exception '담당 학생만 열람할 수 있습니다.'; end if;
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
