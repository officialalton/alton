-- 2026-09-14 UAT — "수업 시작 뒤 수업 준비에서 교재를 바꿨는데 수업에 반영이 안 된다."
--
-- 원인: 수업 시작(final_status = live)이 그 시점 구성을 매니페스트에 고정한다(정책). 그런데 예약
-- 시각이 아직 오지 않은 수업은 화면이 시간 기준으로 '수업 준비 중'을 보여 주어, 이미 고정된
-- 수업인지 알 수 없었다. 화면은 앱에서 고친다(시작한 수업은 '진행 중').
--
-- 정책 보완(제품 오너 지시): 고정은 기본이지만, **진행 중인 수업**은 담당 선생님이 명시적으로
-- "지금 구성으로 다시 고정"할 수 있다. 종료된 수업은 불가. 준비된 선택(session_prepared_selections)
-- 은 pin-lock 으로 불변이라 건드리지 않고, 매니페스트를 회차의 **현재 구성**(교재는
-- curriculum_overlay_unit_materials, 문제는 curriculum_unit_prep_items)에서 다시 만든다.
-- 학생이 이미 사용한 항목(session_content_use_events)은 지우지 않고 구성 뒤로 보낸다 — 기록의 근거다.

create or replace function public.repin_live_session_content(p_session_id uuid, p_actor_id uuid)
returns int
language plpgsql
security definer set search_path = public as $$
declare
  v_session sessions%rowtype;
  v_unit uuid;
  v_prep uuid;
  v_pos int := 0;
  v_item record;
  v_problem problems%rowtype;
  v_version uuid;
  v_doc_updated timestamptz;
begin
  select * into v_session from sessions where id = p_session_id for update;
  if not found then
    raise exception '수업을 찾을 수 없습니다.';
  end if;
  if v_session.final_status <> 'live' then
    raise exception '진행 중인 수업만 지금 구성으로 다시 고정할 수 있습니다(현재 상태: %).', v_session.final_status;
  end if;
  if not (
    v_session.teacher_id = p_actor_id
    or exists (select 1 from profiles p where p.id = p_actor_id and p.role = 'admin')
  ) then
    raise exception '담당 선생님만 이 수업을 다시 고정할 수 있습니다.';
  end if;

  select overlay_unit_id into v_unit
  from session_curriculum_units where session_id = p_session_id and role = 'primary' limit 1;
  if v_unit is null then
    raise exception '이 수업에 연결된 회차가 없습니다.';
  end if;
  select id into v_prep from curriculum_unit_preps where overlay_unit_id = v_unit;

  drop table if exists _repin_items;
  create temp table _repin_items (
    content_type session_prepared_selection_content_type,
    content_id uuid,
    position int,
    problem_version_id uuid,
    doc_updated_at timestamptz
  ) on commit drop;

  -- 교재: 회차의 현재 구성. 공개·미보관만 — 아니면 시작과 같은 말로 거절한다.
  for v_item in
    select m.curriculum_doc_id, d.title, d.updated_at
    from curriculum_overlay_unit_materials m
    join curriculum_docs d on d.id = m.curriculum_doc_id
    where m.overlay_unit_id = v_unit
    order by m.position asc
  loop
    if not exists (select 1 from curriculum_docs_selectable s where s.curriculum_doc_id = v_item.curriculum_doc_id) then
      raise exception '다시 고정할 수 없습니다 — 구성의 교재 하나를 쓸 수 없습니다(공개돼 있지 않거나 보관됨): %. 그 교재를 빼거나 바꾼 뒤 다시 시도하세요.', v_item.title;
    end if;
    v_pos := v_pos + 1;
    insert into _repin_items values ('material_doc', v_item.curriculum_doc_id, v_pos, null, v_item.updated_at);
  end loop;

  -- 문제: 준비안. 확정·미보관·버전 확인 — 시작 때와 같은 검사.
  if v_prep is not null then
    for v_item in
      select content_type, content_id, problem_version_id
      from curriculum_unit_prep_items where prep_id = v_prep order by position asc
    loop
      v_version := null;
      v_doc_updated := null;
      if v_item.content_type = 'problem' then
        select * into v_problem from problems where id = v_item.content_id;
        if v_problem.id is null then
          raise exception '다시 고정할 수 없습니다 — 준비안의 문제를 찾을 수 없습니다.';
        elsif v_problem.archived_at is not null then
          raise exception '다시 고정할 수 없습니다 — 준비안에 보관된 문제가 있습니다.';
        elsif v_problem.status::text <> 'confirmed' then
          raise exception '다시 고정할 수 없습니다 — 준비안에 아직 공개되지 않은 문제가 있습니다.';
        end if;
        v_version := coalesce(v_item.problem_version_id, v_problem.published_version_id);
        if v_version is null or not exists (select 1 from problem_versions v where v.id = v_version and v.problem_id = v_item.content_id) then
          raise exception '다시 고정할 수 없습니다 — 준비안의 문제에 쓸 수 있는 버전이 없습니다.';
        end if;
      elsif v_item.content_type = 'material_doc' then
        if not exists (select 1 from curriculum_docs_selectable s where s.curriculum_doc_id = v_item.content_id) then
          raise exception '다시 고정할 수 없습니다 — 준비안의 교재가 공개돼 있지 않거나 보관됐습니다.';
        end if;
        select d.updated_at into v_doc_updated from curriculum_docs d where d.id = v_item.content_id;
      elsif v_item.content_type = 'material_section' then
        select d.updated_at into v_doc_updated
        from curriculum_doc_sections s join curriculum_docs d on d.id = s.curriculum_doc_id
        where s.id = v_item.content_id;
      end if;
      -- 같은 항목이 교재 구성에도 있으면 한 번만.
      if exists (select 1 from _repin_items r where r.content_type = v_item.content_type and r.content_id = v_item.content_id) then
        continue;
      end if;
      v_pos := v_pos + 1;
      insert into _repin_items values (v_item.content_type, v_item.content_id, v_pos, v_version, v_doc_updated);
    end loop;
  end if;

  if v_pos = 0 then
    raise exception '지금 구성에 담긴 교재·문제가 없습니다 — 다시 고정하지 않았습니다.';
  end if;

  -- 기존 매니페스트: 자리를 비운 뒤, 사용 기록이 없는 행은 지운다. 사용 기록이 있는 행은 남긴다.
  update session_content_manifest set display_position = display_position + 100000 where session_id = p_session_id;
  delete from session_content_manifest m
  where m.session_id = p_session_id
    and not exists (
      select 1 from session_content_use_events e
      where e.session_id = m.session_id and e.content_type = m.content_type and e.content_id = m.content_id
    );

  -- 새 구성. 남아 있던 행(사용 기록 있음)이 구성에도 있으면 자리만 바꾼다 — 그 행의 고정 버전은 그대로.
  for v_item in select * from _repin_items order by position loop
    insert into session_content_manifest
      (session_id, content_type, content_id, source_overlay_unit_id, display_position, published_doc_version_at_pin, problem_version_id)
    values (p_session_id, v_item.content_type, v_item.content_id, v_unit, v_item.position, v_item.doc_updated_at, v_item.problem_version_id)
    on conflict (session_id, content_type, content_id) do update
      set display_position = excluded.display_position;
  end loop;

  -- 구성에서 빠졌지만 사용 기록이 있어 남은 행은 구성 뒤에 이어 붙인다.
  for v_item in
    select id from session_content_manifest
    where session_id = p_session_id and display_position > 100000 order by display_position
  loop
    v_pos := v_pos + 1;
    update session_content_manifest set display_position = v_pos where id = v_item.id;
  end loop;

  return v_pos;
end;
$$;
revoke execute on function public.repin_live_session_content(uuid, uuid) from public, anon, authenticated;
grant execute on function public.repin_live_session_content(uuid, uuid) to service_role;
comment on function public.repin_live_session_content(uuid, uuid) is
  '2026-09-14: 진행 중(live) 수업의 매니페스트를 회차의 현재 구성으로 다시 고정한다. 담당 교사·관리자가 명시적으로 부를 때만. '
  '준비된 선택은 건드리지 않고(pin-lock), 사용 기록이 있는 항목은 지우지 않고 뒤로 보낸다.';
