-- 2026-10-08 — 관리자 "사용자" 탭 서버 페이지네이션.
-- 기존에는 학부모/학생/선생님 전체를 읽어(PostgREST 1,000행 상한에 조용히 잘리기도 함)
-- 클라이언트에서 검색·필터했다. 이 함수는 현재 탭·필터·검색에 맞는 한 페이지의 id와
-- 전체 건수만 반환한다(상세 정보는 호출 측이 그 id들에 대해서만 조회).
-- 검색: 이름·이메일(auth.users)·(학생) 보호자 이름. 아카이브된 가구의 보호자/자녀는 제외.
-- service_role 전용(requireAdmin을 통과한 서버 액션에서만 호출).

create or replace function admin_users_page(
  p_role text,
  p_search text default null,
  p_member_type text default null,
  p_limit int default 10,
  p_offset int default 0
) returns table(id uuid, total_count bigint)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_pat text := null;
  v_limit int := least(greatest(coalesce(p_limit, 10), 1), 100);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
begin
  if p_search is not null and btrim(p_search) <> '' then
    v_pat := '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  if p_role = 'parent' then
    return query
    select x.id, count(*) over () as total_count
    from parents x
    join profiles pr on pr.id = x.id
    left join auth.users u on u.id = x.id
    where (
      not exists (select 1 from household_members m where m.profile_id = x.id and m.role = 'guardian')
      or exists (
        select 1 from household_members m join households h on h.id = m.household_id
        where m.profile_id = x.id and m.role = 'guardian' and h.archived_at is null
      )
    )
    and (v_pat is null or pr.name ilike v_pat or u.email ilike v_pat)
    order by x.joined_at desc, x.id
    limit v_limit offset v_offset;
  elsif p_role = 'student' then
    return query
    select x.id, count(*) over () as total_count
    from students x
    join profiles pr on pr.id = x.id
    left join auth.users u on u.id = x.id
    where not exists (
      select 1 from household_members m join households h on h.id = m.household_id
      where m.profile_id = x.id and m.role = 'child' and h.archived_at is not null
    )
    and (p_member_type is null or p_member_type = 'all' or x.member_type = p_member_type)
    and (
      v_pat is null or pr.name ilike v_pat or u.email ilike v_pat
      or exists (
        select 1 from household_members cm
        join household_members gm on gm.household_id = cm.household_id and gm.role = 'guardian'
        join profiles gp on gp.id = gm.profile_id
        where cm.profile_id = x.id and cm.role = 'child' and gp.name ilike v_pat
      )
    )
    order by x.joined_at desc, x.id
    limit v_limit offset v_offset;
  elsif p_role = 'teacher' then
    return query
    select x.id, count(*) over () as total_count
    from teachers x
    join profiles pr on pr.id = x.id
    left join auth.users u on u.id = x.id
    where (v_pat is null or pr.name ilike v_pat or u.email ilike v_pat)
    order by x.joined_at desc, x.id
    limit v_limit offset v_offset;
  else
    raise exception 'invalid_role';
  end if;
end;
$$;

revoke all on function admin_users_page(text, text, text, int, int) from public;
revoke all on function admin_users_page(text, text, text, int, int) from anon;
revoke all on function admin_users_page(text, text, text, int, int) from authenticated;
grant execute on function admin_users_page(text, text, text, int, int) to service_role;
