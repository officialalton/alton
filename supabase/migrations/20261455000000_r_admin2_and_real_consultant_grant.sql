-- 2026-09-22 — 사용자 요청: (1) 새 관리자 계정 admin2@alton.education,
-- (2) 실제 이메일 jiman@alton.education을 컨설턴트로(일정 UAT를 진짜 메일로
-- 진행하기 위함). 두 계정 모두 Supabase 대시보드에서 이미 만들어졌다는 전제 —
-- 계정이 없으면 조용히 건너뛴다(20261450000000과 동일한 패턴).

do $$
declare
  v_admin2_id uuid;
  v_jiman_id uuid;
begin
  select u.id into v_admin2_id from auth.users u where u.email = 'admin2@alton.education';
  if v_admin2_id is not null then
    insert into profiles (id, role, name)
    values (v_admin2_id, 'admin', '관리자(admin2)')
    on conflict (id) do update set role = 'admin';
    update profiles set admin_tier = 'full' where id = v_admin2_id and admin_tier is null;
  end if;

  select u.id into v_jiman_id from auth.users u where u.email = 'jiman@alton.education';
  if v_jiman_id is not null then
    insert into profiles (id, role, name)
    values (v_jiman_id, 'consultant', '지만')
    on conflict (id) do update set role = 'consultant';

    insert into supervisor_capabilities (profile_id, capability, granted_by)
    values
      (v_jiman_id, 'manage_consultation_intake', v_jiman_id),
      (v_jiman_id, 'manage_admissions_students', v_jiman_id)
    on conflict (profile_id, capability) do nothing;
  end if;
end $$;
