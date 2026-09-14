-- P2 10차 — 학생·보호자의 수업 전 열람(예습).
--
-- 2026-09-13 제품 오너 확정:
--   "학생은 자기 커리큘럼의 각 회차에서 교재와 문제를 수업 전에 미리 볼 수 있어야
--    합니다. 예습을 허용하는 정책입니다. 문제 지문·선택지를 보는 것과 정답·해설을
--    보는 것은 구분합니다."
--   "수업 전에는 저장된 준비안의 버전·순서를 읽습니다. 현재 최신 교재·문제를 별도로
--    조회해 섞지 않습니다."
--   "연결된 보호자도 해당 학생과 같은 범위·공개 시점으로 읽기 전용 열람이 가능해야
--    합니다."
--
-- 왜 함수 하나로 돌려주는가:
--   필요한 것이 **열 단위**로 갈린다. 문제 버전 행에서 지문·선택지는 보여주고
--   정답·해설은 빼야 하며, 교재 버전 스냅샷에서 본문은 보여주고 teaching_tip
--   (교사용 지도 노트)은 빼야 한다. RLS 는 행 단위라 이것을 할 수 없다. 테이블을
--   통째로 열고 앱에서 고르면, 앱을 거치지 않는 경로에서 그대로 새어 나간다.
--   그래서 **볼 수 있는 것만 담아서** 돌려준다.
--
-- 답안 제출·채점은 여기서 하지 않는다. 이번 결정은 열람 허용이다.

create or replace function public.unit_preview_for_viewer(p_overlay_unit_id uuid)
returns jsonb
language plpgsql
stable
security definer set search_path = public as $$
declare
  v_enrollment uuid;
  v_unit_title text;
  v_goal text;
  v_prep_id uuid;
  v_session_id uuid;
  v_frozen boolean := false;
  v_materials jsonb;
  v_problems jsonb;
begin
  select o.subject_enrollment_id, u.unit_title
    into v_enrollment, v_unit_title
  from curriculum_overlay_units u
  join student_curriculum_overlays o on o.id = u.overlay_id
  where u.id = p_overlay_unit_id;

  if v_enrollment is null then
    return null;
  end if;

  -- 학생 본인·연결된 보호자, 그리고 담당 교사·관리자. 다른 학생의 구성은 여기서
  -- 끊긴다 — 아래 조회는 전부 이 회차 하나에만 매여 있다.
  if not (
    public.is_enrollment_child_or_guardian(v_enrollment)
    or is_admin()
    or public.is_active_teacher_for_enrollment(v_enrollment)
  ) then
    return null;
  end if;

  select goal, id into v_goal, v_prep_id
  from curriculum_unit_preps where overlay_unit_id = p_overlay_unit_id;

  -- 이 회차로 이미 시작한 수업이 있으면 그 수업이 고정한 내용을 보여준다.
  -- 시작 전이면 저장된 준비안을 읽는다. 둘을 섞지 않는다.
  select s.id into v_session_id
  from session_curriculum_units scu
  join sessions s on s.id = scu.session_id
  where scu.overlay_unit_id = p_overlay_unit_id
    and s.final_status <> 'scheduled'
  order by s.actual_start_at desc nulls last
  limit 1;

  v_frozen := v_session_id is not null;

  if v_frozen then
    select coalesce(jsonb_agg(m order by m.ord), '[]'::jsonb) into v_materials
    from (
      select cm.display_position as ord,
             jsonb_build_object(
               'curriculumDocId', coalesce(v.curriculum_doc_id, cm.content_id),
               'title', coalesce(v.snapshot->>'title', d.title),
               'versionId', cm.curriculum_doc_version_id,
               'sections', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', s->>'id',
                          'title', s->>'title',
                          'body', s->>'body'))
                 from jsonb_array_elements(v.snapshot->'sections') s
               ), '[]'::jsonb)
             ) as m
      from session_content_manifest cm
      left join curriculum_doc_versions v on v.id = cm.curriculum_doc_version_id
      left join curriculum_docs d on d.id = cm.content_id
      where cm.session_id = v_session_id and cm.content_type = 'material_doc'
    ) m;

    select coalesce(jsonb_agg(p order by p.ord), '[]'::jsonb) into v_problems
    from (
      select cm.display_position as ord,
             jsonb_build_object(
               'problemId', cm.content_id,
               'versionId', cm.problem_version_id,
               'format', pr.format,
               'passage', pv.passage,
               'options', pv.options
             ) as p
      from session_content_manifest cm
      join problems pr on pr.id = cm.content_id
      left join problem_versions pv on pv.id = cm.problem_version_id
      where cm.session_id = v_session_id and cm.content_type = 'problem'
    ) p;
  else
    -- 저장된 준비안. **담을 때의 버전**을 읽는다 — 지금의 최신본을 따로 조회하지
    -- 않는다. 버전이 기록되지 않은 오래된 행은 내용을 만들어 내지 않고 비워 둔다.
    select coalesce(jsonb_agg(m order by m.ord), '[]'::jsonb) into v_materials
    from (
      select om.position as ord,
             jsonb_build_object(
               'curriculumDocId', om.curriculum_doc_id,
               'title', coalesce(v.snapshot->>'title', d.title),
               'versionId', om.curriculum_doc_version_id,
               'sections', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', s->>'id',
                          'title', s->>'title',
                          'body', s->>'body'))
                 from jsonb_array_elements(v.snapshot->'sections') s
               ), '[]'::jsonb)
             ) as m
      from curriculum_overlay_unit_materials om
      join curriculum_docs d on d.id = om.curriculum_doc_id
      left join curriculum_doc_versions v on v.id = om.curriculum_doc_version_id
      where om.overlay_unit_id = p_overlay_unit_id
        and d.status = 'published' and d.archived_at is null
    ) m;

    select coalesce(jsonb_agg(p order by p.ord), '[]'::jsonb) into v_problems
    from (
      select i.position as ord,
             jsonb_build_object(
               'problemId', i.content_id,
               'versionId', i.problem_version_id,
               'format', pr.format,
               'passage', pv.passage,
               'options', pv.options
             ) as p
      from curriculum_unit_prep_items i
      join problems pr on pr.id = i.content_id
      left join problem_versions pv on pv.id = i.problem_version_id
      where i.prep_id = v_prep_id and i.content_type = 'problem'
        and pr.status = 'confirmed' and pr.archived_at is null
    ) p;
  end if;

  return jsonb_build_object(
    'unitId', p_overlay_unit_id,
    'unitTitle', v_unit_title,
    'goal', v_goal,
    'frozen', v_frozen,
    'sessionId', v_session_id,
    'materials', coalesce(v_materials, '[]'::jsonb),
    'problems', coalesce(v_problems, '[]'::jsonb)
  );
end;
$$;

comment on function public.unit_preview_for_viewer(uuid) is
  'P2 10차: 학생·보호자의 수업 전 열람. **정답·해설(correct_index, explanation)과 교사용 '
  'teaching_tip 은 담지 않는다** — 화면이 고르는 것이 아니라 응답 자체에 없다. 시작 전에는 '
  '저장된 준비안의 버전·순서를, 시작 뒤에는 그 수업이 고정한 내용을 읽고 둘을 섞지 않는다. '
  '예약·시작 여부로 열람을 막지 않는다. 답안 제출·채점은 여기서 하지 않는다.';

revoke execute on function public.unit_preview_for_viewer(uuid) from public, anon;
grant execute on function public.unit_preview_for_viewer(uuid) to authenticated, service_role;
