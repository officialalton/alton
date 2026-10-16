-- 2026-09-17(실제 브라우저 UAT 중 발견) — unit_preview_for_viewer()가 "취소된
-- 예약"까지 '고정된 수업'으로 취급해 학생을 죽은 취소 세션으로 리다이렉트했다.
--
-- 재현: 학생이 예약을 취소한 뒤 그 회차가 아직 재예약되지 않은 상태에서 "수업
-- 준비 →"를 누르면, /unit-preview/[unitId]가 이 함수를 호출해 취소된 세션의
-- session_id를 돌려받고 그 죽은 세션으로 강제 리다이렉트했다(app/unit-preview/
-- [unitId]/page.tsx의 `if (preview.sessionId) redirect(...)`). 그 세션은 실제로
-- 시작한 적이 없어(actual_start_at null) 준비된 교재도 없고, 화면은 "완료된
-- 수업입니다"로 잘못 표시했다.
--
-- apply_base_update_to_overlay_unit()/auto_link_next_unit_to_session()이 이미 쓰는
-- "취소는 실사용이 아니다" 판정과 동일하게, final_status가 취소 계열이면 '고정된
-- 세션'으로 치지 않는다 — 아직 준비 중인 회차와 똑같이 살아있는 예정 회차 기본
-- 자료(curriculum_overlay_unit_materials/curriculum_unit_prep_items)를 보여준다.
create or replace function public.unit_preview_for_viewer(p_overlay_unit_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  if not (
    public.is_enrollment_child_or_guardian(v_enrollment)
    or is_admin()
    or public.is_active_teacher_for_enrollment(v_enrollment)
  ) then
    return null;
  end if;

  select goal, id into v_goal, v_prep_id
  from curriculum_unit_preps where overlay_unit_id = p_overlay_unit_id;

  select s.id into v_session_id
  from session_curriculum_units scu
  join sessions s on s.id = scu.session_id
  where scu.overlay_unit_id = p_overlay_unit_id
    and s.final_status not in ('scheduled', 'student_cancelled', 'teacher_cancelled', 'company_cancelled')
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
               'kind', coalesce(v.snapshot->>'kind', d.kind, 'html'),
               'pageCount', (v.snapshot->'asset'->>'pageCount')::int,
               'mimeType', v.snapshot->'asset'->>'mimeType',
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
               'passage', case when nullif(btrim(pv.question), '') is null then pv.passage else pv.passage || E'\n\n' || pv.question end,
               'options', pv.options
             ) as p
      from session_content_manifest cm
      join problems pr on pr.id = cm.content_id
      left join problem_versions pv on pv.id = cm.problem_version_id
      where cm.session_id = v_session_id and cm.content_type = 'problem'
    ) p;
  else
    select coalesce(jsonb_agg(m order by m.ord), '[]'::jsonb) into v_materials
    from (
      select om.position as ord,
             jsonb_build_object(
               'curriculumDocId', om.curriculum_doc_id,
               'title', coalesce(v.snapshot->>'title', d.title),
               'versionId', om.curriculum_doc_version_id,
               'kind', coalesce(v.snapshot->>'kind', d.kind, 'html'),
               'pageCount', (v.snapshot->'asset'->>'pageCount')::int,
               'mimeType', v.snapshot->'asset'->>'mimeType',
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
               'passage', case when nullif(btrim(pv.question), '') is null then pv.passage else pv.passage || E'\n\n' || pv.question end,
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
$function$
