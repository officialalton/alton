-- ops: UAT 관리자 계정(admin-uat-20260919@alton.education)에 admin role 부여
--
-- 20260917 계정이 임시 이메일이라 비밀번호 재설정이 불가능해져 새로 발급한
-- 계정. 이 계정은 Supabase 대시보드에서 non-prod(auth.users)에 직접
-- 생성되었고 profiles 행이 없다. 로컬 개발 DB에는 이 이메일의 auth.users
-- 행이 없으므로 이 마이그레이션은 로컬에서는 no-op이어야 한다(db reset이
-- 에러 없이 통과해야 함). exists 가드로 대상 사용자가 없으면 아무 것도
-- 하지 않는다.

do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where email = 'admin-uat-20260919@alton.education'
  limit 1;

  if v_user_id is null then
    raise notice 'ops_grant_uat_admin_role_20260919: no matching auth.users row, skipping (expected locally)';
    return;
  end if;

  insert into profiles (id, role, name, phone)
  values (v_user_id, 'admin', 'UAT 관리자 (20260919)', null)
  on conflict (id) do update
    set role = excluded.role,
        name = excluded.name;

  raise notice 'ops_grant_uat_admin_role_20260919: granted admin role to profiles.id=%', v_user_id;
end $$;
