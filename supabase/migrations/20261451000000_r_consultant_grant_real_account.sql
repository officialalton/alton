-- 2026-09-22 — 실제 컨설턴트 UAT 계정(consultant.jiman@alton.education)이
-- jiman@alton.education 대신 별도 이메일로 생성됐다. 20261450000000의
-- do-block은 그 이메일 계정이 없어 조용히 건너뛰었으므로, 이 계정을 대상으로
-- 같은 role/capability 부여를 새 마이그레이션으로 다시 시도한다(이미 적용된
-- 파일은 고치지 않는다는 원칙).
do $$
declare
  v_user_id uuid;
begin
  select u.id into v_user_id from auth.users u where u.email = 'consultant.jiman@alton.education';

  if v_user_id is null then
    return; -- 계정이 아직 없으면 조용히 건너뛴다.
  end if;

  -- profiles는 auth.users 생성 시 트리거로 자동 생성되지 않는다(이 프로젝트는
  -- 별도 온보딩 플로우에서 명시적으로 insert한다) — 대시보드로 막 만든
  -- 계정은 profiles 행이 아직 없을 수 있으므로 없으면 만든다.
  insert into profiles (id, role, name)
  values (v_user_id, 'consultant', '컨설턴트(지만)')
  on conflict (id) do update set role = 'consultant';

  insert into supervisor_capabilities (profile_id, capability, granted_by)
  values
    (v_user_id, 'manage_consultation_intake', v_user_id),
    (v_user_id, 'manage_admissions_students', v_user_id)
  on conflict (profile_id, capability) do nothing;
end $$;
