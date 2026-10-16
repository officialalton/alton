-- 2026-10-06 Free Accounts 4/7 — 상담 단계 파생 + 목록 RPC. 목록은 응시 이력 행을 읽지 않고 카운트만 집계한다.
create or replace function public._free_account_consult_stage(p_student_id uuid) returns table (stage text, flags text[])
language sql stable security definer set search_path = public as $$
  with s as (select member_type, converted_at from students where id = p_student_id),
  i as (
    select status from student_consult_interests where student_id = p_student_id
    order by (status not in ('cancelled', 'expired')) desc, created_at desc limit 1
  ),
  v as (select status from guardian_link_invites where student_id = p_student_id order by created_at desc limit 1),
  c as (
    select status::text status from consultations
    where child_id = p_student_id and source = 'free_member' order by created_at desc limit 1
  )
  select
    case
      when (select converted_at is not null or (member_type = 'tutoring' and exists (select 1 from c)) from s) then 'converted'
      when (select status in ('completed', 'trial_planned', 'trial_completed', 'proposed', 'contracted', 'converted') from c) then 'completed'
      when (select status = 'scheduled' from c) or (select status = 'booked' from i) then 'booked'
      when (select status in ('cancelled', 'no_show') from c) then 'booking_cancelled'
      when (select status = 'accepted' from v) or (select status in ('parent_linked', 'consultation_requested') from i) then 'parent_linked'
      when (select status = 'invite_sent' from i) or (select status in ('pending', 'manual_review') from v) then 'invitation_pending'
      when (select status = 'registered' from i) then 'requested'
      when (select status = 'closed' from c) or (select status in ('cancelled', 'expired') from i) then 'closed'
      else 'none'
    end,
    case when (select status = 'manual_review' from v) then array['invite_needs_review']::text[] else array[]::text[] end;
$$;
revoke execute on function public._free_account_consult_stage(uuid) from public, anon, authenticated;

create or replace function public.admin_free_accounts_list(
  p_search text default null,
  p_joined_from timestamptz default null, p_joined_to timestamptz default null,
  p_active_from timestamptz default null, p_active_to timestamptz default null,
  p_has_attempts boolean default null,
  p_consult_stage text default null,
  p_account_status text default null,          -- null: closed 제외 / 'any': 전부 / 상태값
  p_scope text default 'free',                 -- free | converted | all
  p_include_test boolean default false,
  p_sort text default 'joined_at', p_dir text default 'desc',
  p_limit int default 25, p_offset int default 0,
  p_cohort_ids uuid[] default null             -- 테스트·범위 한정용(관리자 전용)
) returns table (
  student_id uuid, name text, email text, joined_at timestamptz, last_active_at timestamptz,
  completed_tests int, in_progress_tests int, consult_stage text, consult_flags text[],
  account_status text, member_type text, converted_at timestamptz, is_test_account boolean, total_count bigint
) language plpgsql stable security definer set search_path = public as $$
declare v_search text := nullif(lower(btrim(coalesce(p_search, ''))), '');
begin
  if not _free_accounts_staff() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_scope not in ('free', 'converted', 'all') then raise exception 'invalid_scope'; end if;
  if p_sort not in ('joined_at', 'last_active_at', 'completed_tests', 'name', 'email', 'consult_stage') then raise exception 'invalid_sort'; end if;
  p_limit := least(greatest(coalesce(p_limit, 25), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  return query
  with base as (
    select s.id, s.joined_at, s.last_active_at, s.status::text st, s.member_type, s.converted_at, s.is_test_account
    from students s
    where (p_include_test or not s.is_test_account)
      and (p_cohort_ids is null or s.id = any (p_cohort_ids))
      and (s.member_type = 'free' or s.converted_at is not null
           or exists (select 1 from consultations c where c.child_id = s.id and c.source = 'free_member'))
      and (p_scope <> 'free' or s.member_type = 'free')
      and (p_joined_from is null or s.joined_at >= p_joined_from) and (p_joined_to is null or s.joined_at < p_joined_to)
      and (p_active_from is null or s.last_active_at >= p_active_from) and (p_active_to is null or s.last_active_at < p_active_to)
      and (case when p_account_status is null then s.status::text <> 'closed'
                when p_account_status = 'any' then true else s.status::text = p_account_status end)
  ), rich as (
    select b.*, pr.name pname, u.email uemail, cs.stage, cs.flags,
           ac.done, ac.prog
    from base b
    join profiles pr on pr.id = b.id
    left join auth.users u on u.id = b.id
    cross join lateral _free_account_consult_stage(b.id) cs
    cross join lateral (
      select (count(*) filter (where a.status = 'graded'))::int done, (count(*) filter (where a.status in ('assigned', 'in_progress', 'submitted')))::int prog
      from mock_exam_attempts a where a.student_id = b.id
    ) ac
    where (p_scope <> 'converted' or cs.stage = 'converted')
      and (p_consult_stage is null or cs.stage = p_consult_stage)
      and (p_has_attempts is null or (ac.done > 0) = p_has_attempts)
      and (v_search is null or position(v_search in lower(coalesce(pr.name, ''))) > 0 or position(v_search in lower(coalesce(u.email, ''))) > 0)
  )
  select r.id, r.pname, r.uemail, r.joined_at, r.last_active_at, r.done, r.prog, r.stage, r.flags,
         r.st, r.member_type, r.converted_at, r.is_test_account, count(*) over ()
  from rich r
  order by
    case when p_sort = 'joined_at' and p_dir = 'asc' then r.joined_at end asc,
    case when p_sort = 'joined_at' and p_dir <> 'asc' then r.joined_at end desc,
    case when p_sort = 'last_active_at' and p_dir = 'asc' then r.last_active_at end asc nulls last,
    case when p_sort = 'last_active_at' and p_dir <> 'asc' then r.last_active_at end desc nulls last,
    case when p_sort = 'completed_tests' and p_dir = 'asc' then r.done end asc,
    case when p_sort = 'completed_tests' and p_dir <> 'asc' then r.done end desc,
    case when p_sort = 'name' and p_dir = 'asc' then lower(r.pname) end asc,
    case when p_sort = 'name' and p_dir <> 'asc' then lower(r.pname) end desc,
    case when p_sort = 'email' and p_dir = 'asc' then lower(r.uemail) end asc,
    case when p_sort = 'email' and p_dir <> 'asc' then lower(r.uemail) end desc,
    case when p_sort = 'consult_stage' and p_dir = 'asc' then r.stage end asc,
    case when p_sort = 'consult_stage' and p_dir <> 'asc' then r.stage end desc,
    r.joined_at desc, r.id
  limit p_limit offset p_offset;
end $$;
revoke execute on function public.admin_free_accounts_list(text, timestamptz, timestamptz, timestamptz, timestamptz, boolean, text, text, text, boolean, text, text, int, int, uuid[]) from public, anon;
grant execute on function public.admin_free_accounts_list(text, timestamptz, timestamptz, timestamptz, timestamptz, boolean, text, text, text, boolean, text, text, int, int, uuid[]) to authenticated;
comment on function public.admin_free_accounts_list is
  '2026-10-06 Free Accounts 목록. 응시는 카운트만(이력 행 미반환), 정렬 키 화이트리스트, total_count window. 상담 단계 우선순위는 설계 §8(booking_cancelled 를 parent_linked 보다 먼저 판정).';
