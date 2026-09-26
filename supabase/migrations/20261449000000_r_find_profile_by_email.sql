-- 2026-09-22(컨설턴트 포지션) — 관리자가 이메일로 기존 계정을 찾아 컨설턴트로
-- 지정하거나 학생을 배정할 때 쓴다. auth.users는 PostgREST로 직접 조회되지
-- 않으므로 SECURITY DEFINER 함수로 감싼다(admin_tier 마이그레이션의
-- official@alton.education 백필과 같은 접근 — auth.users를 직접 조회).
create or replace function public.find_profile_id_by_email(p_email text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_admin() then
    raise exception '관리자만 사용할 수 있습니다.';
  end if;
  select u.id into v_id from auth.users u where u.email = p_email;
  return v_id;
end $$;

comment on function public.find_profile_id_by_email(text) is
  '2026-09-22 — 관리자가 이메일로 기존 계정(profiles.id = auth.users.id)을 찾는다. 없으면 null.';
