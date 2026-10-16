-- 2026-09-17(제품 오너 실사용 보고) — link_unit_prep_to_session()이 이 회차의
-- curriculum_unit_preps가 아직 없으면("한 번도 상위 구성을 물려받은 적 없음")
-- 예외를 던지고 세션에 아무것도 연결하지 않았다. 그런데 회차 연결 자체는
-- session_curriculum_units/session_prepared_selection_units에 이미 기록되므로
-- "연동됐다"고 보이면서도 실제 교재·문제는 하나도 없이 빈 상태로 남는
-- 결함이었다(선생님이 "수업 준비" 화면에 들어가도 아무것도 안 보임).
--
-- inherit_unit_defaults_from_template()은 이미 NOT EXISTS/ON CONFLICT DO NOTHING
-- 가드로 멱등하게 설계돼 있어(교사 커리큘럼 상속 반복 호출용, 20261341000000),
-- 여기서도 그대로 재사용해 연결 시점에 상위(교사 템플릿→기준본) 기본 구성을
-- 자동으로 물려받게 한다. "선생님이 일부러 비워 뒀다"와 구분할 수 없다는 이유로
-- 소급 상속을 보류했던 것은 이미 준비된 회차 얘기이고, 여기는 애초에 준비 자체가
-- 없어 연결이 실패하던 경우이므로 그 우려가 적용되지 않는다.
set row_security = off;

create or replace function public.link_unit_prep_to_session(
  p_overlay_unit_id uuid,
  p_session_id uuid,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare
  v_prep curriculum_unit_preps%rowtype;
  v_enrollment uuid;
  v_session_enrollment uuid;
  v_final_status v3_session_final_status;
  v_selection_id uuid;
  v_unit_row_id uuid;
  v_existing_status text;
  v_pos int := 0;
  v_item record;
begin
  select p.* into v_prep from curriculum_unit_preps p where p.overlay_unit_id = p_overlay_unit_id;
  -- curriculum_unit_preps 행 자체가 없거나(한 번도 상속된 적 없음), 있어도 담긴
  -- 항목이 0개면(예: 상속 트리거 이전에 빈 행만 만들어진 경우) 둘 다 같은
  -- 증상(연결은 됐는데 내용이 없음)이라 같은 방식으로 처리한다.
  if not found or not exists (
    select 1 from curriculum_unit_prep_items where prep_id = v_prep.id
  ) then
    perform public.inherit_unit_defaults_from_template(p_overlay_unit_id);
    select p.* into v_prep from curriculum_unit_preps p where p.overlay_unit_id = p_overlay_unit_id;
    if not found then
      raise exception '이 회차에는 아직 준비가 없고, 물려받을 상위 구성도 없습니다.';
    end if;
  end if;

  select o.subject_enrollment_id into v_enrollment
  from curriculum_overlay_units u
  join student_curriculum_overlays o on o.id = u.overlay_id
  where u.id = p_overlay_unit_id;

  select s.subject_enrollment_id, s.final_status into v_session_enrollment, v_final_status
  from sessions s where s.id = p_session_id;
  if v_session_enrollment is null then
    raise exception '수업을 찾을 수 없습니다.';
  end if;
  if v_session_enrollment is distinct from v_enrollment then
    raise exception '다른 학생·과목의 회차는 이 수업에 연결할 수 없습니다.';
  end if;
  if v_final_status <> 'scheduled' then
    raise exception '이미 시작했거나 종료한 수업의 준비는 바꿀 수 없습니다.';
  end if;
  if not (
    exists (select 1 from profiles pr where pr.id = p_actor_id and pr.role = 'admin')
    or exists (select 1 from sessions s where s.id = p_session_id and s.teacher_id = p_actor_id)
  ) then
    raise exception '담당 수업에만 회차 준비를 연결할 수 있습니다.';
  end if;

  select s.id, s.status into v_selection_id, v_existing_status
  from session_prepared_selections s
  where s.session_id = p_session_id and s.status <> 'archived';
  if v_selection_id is not null then
    if v_existing_status = 'pinned' then
      raise exception '이미 고정된 수업입니다.';
    end if;
    return v_selection_id;
  end if;

  perform set_config('request.jwt.claim.sub', p_actor_id::text, true);

  insert into session_prepared_selections (subject_enrollment_id, teacher_id, session_id, status)
  values (v_enrollment, p_actor_id, p_session_id, 'staged')
  returning id into v_selection_id;

  insert into session_prepared_selection_units (prepared_selection_id, overlay_unit_id, position)
  values (v_selection_id, p_overlay_unit_id, 1)
  returning id into v_unit_row_id;

  insert into session_prepared_selection_unit_keywords (prepared_selection_unit_id, keyword_id)
  select v_unit_row_id, k.keyword_id
  from curriculum_overlay_unit_keywords k
  where k.overlay_unit_id = p_overlay_unit_id;

  -- 준비안의 순서와 **버전**을 그대로 옮긴다.
  for v_item in
    select content_type, content_id, problem_version_id
    from curriculum_unit_prep_items
    where prep_id = v_prep.id order by position asc
  loop
    v_pos := v_pos + 1;
    insert into session_prepared_selection_content_items
      (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position,
       problem_version_id)
    values (v_selection_id, v_unit_row_id, v_item.content_type, v_item.content_id, v_pos,
            v_item.problem_version_id);
  end loop;

  insert into session_curriculum_units (session_id, overlay_unit_id, role)
  values (p_session_id, p_overlay_unit_id, 'primary')
  on conflict (session_id, overlay_unit_id) do nothing;

  return v_selection_id;
end;
$$;
revoke execute on function public.link_unit_prep_to_session(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.link_unit_prep_to_session(uuid, uuid, uuid) to service_role;
