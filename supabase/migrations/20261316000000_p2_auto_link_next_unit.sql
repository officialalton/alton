-- P2 4차 — 예약이 잡히면 다음 회차를 자동으로 연결한다.
--
-- 지금은 선생님이 준비 화면에서 수업을 골라 손으로 연결해야 한다. 정규 수업은
-- 회차를 순서대로 밟아 가므로, 새 수업이 생기면 "아직 쓰지 않은 가장 앞 회차"를
-- 붙이는 것이 기본값으로 맞다.
--
-- 지키는 것:
--   - 이미 연결된 수업은 건드리지 않는다(덮어쓰지 않는다).
--   - 다른 수업이 이미 쓴 회차는 고르지 않는다 — 한 회차가 두 수업에 겹치면
--     어느 쪽이 그 회차인지 알 수 없다.
--   - 오버레이(운영 커리큘럼)가 없으면 아무것도 하지 않는다. 없는 것을 만들지
--     않는다 — 그건 선생님의 판단이다.
--   - 자동 연결은 **연결일 뿐 고정이 아니다.** 내용 고정은 수업 시작에서만
--     일어난다(freeze_session_content_at_start). 그래서 선생님이 수업 전에
--     다른 회차로 바꾸는 것을 막지 않는다.
create or replace function public.auto_link_next_unit_to_session(p_session_id uuid)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare
  v_enrollment_id uuid;
  v_overlay_id uuid;
  v_unit_id uuid;
begin
  -- 이미 연결돼 있으면 그대로 둔다.
  if exists (select 1 from session_curriculum_units where session_id = p_session_id) then
    return null;
  end if;

  select subject_enrollment_id into v_enrollment_id from sessions where id = p_session_id;
  if v_enrollment_id is null then
    return null;
  end if;

  select id into v_overlay_id
  from student_curriculum_overlays
  where subject_enrollment_id = v_enrollment_id and status = 'active';
  if v_overlay_id is null then
    return null;
  end if;

  -- 아직 어떤 수업에도 쓰이지 않은 가장 앞 회차.
  select u.id into v_unit_id
  from curriculum_overlay_units u
  where u.overlay_id = v_overlay_id
    and not exists (
      select 1 from session_curriculum_units scu where scu.overlay_unit_id = u.id
    )
  order by u.position asc
  limit 1;

  if v_unit_id is null then
    return null;
  end if;

  insert into session_curriculum_units (session_id, overlay_unit_id, role)
  values (p_session_id, v_unit_id, 'primary')
  on conflict do nothing;

  return v_unit_id;
end;
$$;

comment on function auto_link_next_unit_to_session(uuid) is
  'P2 4차: 새 수업에 아직 쓰지 않은 가장 앞 회차를 붙인다. 이미 연결돼 있거나 '
  '남은 회차가 없으면 아무것도 하지 않는다. 연결일 뿐 고정이 아니다.';

create or replace function public.sessions_auto_link_unit()
returns trigger language plpgsql as $$
begin
  perform auto_link_next_unit_to_session(new.id);
  return null;
end;
$$;

create trigger sessions_auto_link_unit_after_insert
  after insert on sessions
  for each row execute function sessions_auto_link_unit();

revoke execute on function public.auto_link_next_unit_to_session(uuid) from public, anon, authenticated;
grant execute on function public.auto_link_next_unit_to_session(uuid) to service_role;
