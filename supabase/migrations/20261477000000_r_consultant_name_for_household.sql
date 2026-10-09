-- R15-A(Messenger 1/N, 2026-09-23) — 보호자 메신저 안내 문구("관리자에게
-- 문의")가 실제 담당자를 반영하도록. consultant_assignments에는 보호자용
-- 조회 정책이 없다(컨설턴트 본인/관리자/학생 본인만) — 범위를 넓히지 않고
-- 이름 하나만 반환하는 함수로 우회한다.
create or replace function public.consultant_name_for_household(p_household_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select p.name
  from household_members hm
  join consultant_assignments ca on ca.student_id = hm.profile_id
  join profiles p on p.id = ca.consultant_id
  where hm.household_id = p_household_id and hm.role = 'child'
  limit 1;
$$;
revoke execute on function public.consultant_name_for_household(uuid) from public, anon;
grant execute on function public.consultant_name_for_household(uuid) to authenticated;

comment on function public.consultant_name_for_household(uuid) is
  '2026-09-23 — 이 household의 자녀 중 하나라도 담당 컨설턴트가 있으면 그 이름을
  반환한다(보호자 메신저 안내 문구용). 여러 자녀가 다른 컨설턴트를 담당하면
  임의로 하나만 반환 — 실제 라우팅에는 영향 없다(둘 다 household 메시지를
  똑같이 볼 수 있음).';
