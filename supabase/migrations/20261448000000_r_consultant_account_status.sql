-- 2026-09-22(컨설턴트 포지션, 발견된 버그) — get_account_status()가
-- role='consultant'를 처리하는 분기가 없어 항상 'unknown'을 반환했다.
-- resolveAccountDestination()(lib/auth.ts)이 status='unknown'이면 즉시
-- 로그아웃시키므로, 이 상태로는 컨설턴트가 로그인 직후 바로 튕겨난다.
-- 컨설턴트는 별도 상태 테이블(students/teachers/parents 같은)이 없다 —
-- admin과 같은 직원 계정 취급으로 항상 active로 둔다(가볍게 — 정지·대기
-- 상태 관리가 필요해지면 그때 별도 테이블을 추가한다).
create or replace function public.get_account_status(p_profile_id uuid)
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_role profile_role;
  v_status text;
begin
  if p_profile_id is null then
    return 'unknown';
  end if;

  select role into v_role from profiles where id = p_profile_id;
  if v_role is null then
    return 'unknown';
  end if;

  if v_role in ('admin', 'consultant') then
    return 'active';
  elsif v_role = 'student' then
    select status::text into v_status from students where id = p_profile_id;
  elsif v_role = 'teacher' then
    select status::text into v_status from teachers where id = p_profile_id;
  elsif v_role = 'parent' then
    select status::text into v_status from parents where id = p_profile_id;
  else
    return 'unknown';
  end if;

  return coalesce(v_status, 'unknown');
end;
$$;
