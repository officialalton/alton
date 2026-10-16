-- 2026-09-22 — 컨설턴트 UAT 계정 이메일이 다시 cs.jiman@alton.education으로
-- 바뀌었다(20261451000000의 consultant.jiman@alton.education 대신). 같은
-- 백필을 이 이메일 대상으로 다시 수행한다.
do $$
declare
  v_user_id uuid;
begin
  select u.id into v_user_id from auth.users u where u.email = 'cs.jiman@alton.education';

  if v_user_id is null then
    return;
  end if;

  insert into profiles (id, role, name)
  values (v_user_id, 'consultant', '컨설턴트(지만)')
  on conflict (id) do update set role = 'consultant';

  insert into supervisor_capabilities (profile_id, capability, granted_by)
  values
    (v_user_id, 'manage_consultation_intake', v_user_id),
    (v_user_id, 'manage_admissions_students', v_user_id)
  on conflict (profile_id, capability) do nothing;
end $$;
