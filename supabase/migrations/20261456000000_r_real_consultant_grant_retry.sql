-- 2026-09-22 — jiman@alton.education 계정이 20261455000000 실행 시점엔 아직
-- 없었을 수 있다(사용자가 그 직후 만들었을 가능성). 같은 백필을 다시 시도한다
-- (이미 반영됐다면 on conflict로 아무 효과 없음).
do $$
declare
  v_jiman_id uuid;
begin
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
