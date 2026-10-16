-- P2 13차 정정 — 교사 템플릿이 비어 있으면 새 학생 회차는 기준본에서 온다.
--
-- 2026-09-14 Preview: 새로 만든 학생의 운영 커리큘럼이 "전체 단원 (0)". 매칭 시딩이 교사 템플릿이
-- **존재만 하면** 그 템플릿에서 회차를 복사했는데, 템플릿에 회차가 하나도 없으면 빈 커리큘럼이
-- 만들어졌다. 템플릿에 회차가 없으면 기준본으로 내려간다(ensure_active_curriculum_overlay 와 같다).

create or replace function public.seed_curriculum_overlay_for_match(
  p_subject_enrollment_id uuid,
  p_teacher_id uuid,
  p_subject_id uuid
)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare
  v_overlay_id uuid;
  v_template_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_subject_enrollment_id::text, 42));

  select t.id into v_template_id
  from teacher_curriculum_templates t
  where t.teacher_id = p_teacher_id and t.subject_id = p_subject_id
    -- 회차가 없는 템플릿은 기준으로 삼지 않는다 — 빈 커리큘럼이 만들어진다.
    and exists (select 1 from teacher_curriculum_template_units tu where tu.template_id = t.id);

  if v_template_id is null then
    return public.ensure_active_curriculum_overlay(p_subject_enrollment_id);
  end if;

  insert into student_curriculum_overlays (subject_enrollment_id, created_by)
  values (p_subject_enrollment_id, auth.uid())
  on conflict (subject_enrollment_id) where (status = 'active') do nothing
  returning id into v_overlay_id;

  if v_overlay_id is null then
    select id into v_overlay_id
    from student_curriculum_overlays
    where subject_enrollment_id = p_subject_enrollment_id and status = 'active';
    return v_overlay_id;
  end if;

  insert into curriculum_overlay_units
    (overlay_id, source_teacher_template_unit_id, source_kind,
     position, unit_title, note, created_by)
  select v_overlay_id, tu.id, 'teacher_template',
         tu.position, tu.unit_title, tu.note, auth.uid()
  from teacher_curriculum_template_units tu
  where tu.template_id = v_template_id
  order by tu.position;

  return v_overlay_id;
end;
$$;

comment on function public.seed_curriculum_overlay_for_match(uuid, uuid, uuid) is
  'P2 13차: 매칭 확정 시 학생 커리큘럼을 시딩한다. 교사 템플릿에 **회차가 있으면** 그것을, 없으면
  관리자 기준본을 복사한다(ensure_active_curriculum_overlay). 빈 템플릿으로 빈 커리큘럼을 만들지 않는다.';

-- 교사 회차가 기준본에서 갈라질 때: 교재를 **키워드보다 먼저** 복사한다.
-- 키워드를 먼저 넣으면 최초 구성 트리거가 같은 교재를 auto·inherited=false 로 먼저 만들어,
-- 기준본에서 내려온 행인데 출처 표식이 빠졌다(상위에서 빠져도 함께 빠지지 않는다).
create or replace function teacher_template_units_inherit_defaults()
returns trigger language plpgsql as $$
declare
  v_goal text;
begin
  if new.source_unit_id is null then
    return null;
  end if;

  insert into teacher_curriculum_template_unit_materials
    (unit_id, curriculum_doc_id, position, source, created_by,
     doc_version_at_pick, curriculum_doc_version_id, inherited, inherited_position)
  select new.id, tum.curriculum_doc_id,
         row_number() over (order by tum.position, tum.curriculum_doc_id),
         tum.source, auth.uid(), tum.doc_version_at_pick, tum.curriculum_doc_version_id,
         true, tum.position
  from subject_template_unit_materials tum
  join curriculum_docs d on d.id = tum.curriculum_doc_id
  where tum.unit_id = new.source_unit_id and d.status = 'published'
  on conflict do nothing;

  insert into teacher_curriculum_template_unit_problems
    (unit_id, problem_id, position, source, created_by, problem_version_id,
     inherited, inherited_position)
  select new.id, sp.problem_id, sp.position, sp.source, auth.uid(), sp.problem_version_id,
         true, sp.position
  from subject_template_unit_problems sp
  where sp.unit_id = new.source_unit_id
  on conflict do nothing;

  insert into teacher_curriculum_template_unit_problem_exclusions
    (unit_id, problem_id, created_by)
  select new.id, x.problem_id, auth.uid()
  from subject_template_unit_problem_exclusions x
  where x.unit_id = new.source_unit_id
  on conflict do nothing;

  insert into teacher_curriculum_template_unit_problem_criteria
    (unit_id, formats, difficulties, target_count, updated_by)
  select new.id, c.formats, c.difficulties, c.target_count, auth.uid()
  from subject_template_unit_problem_criteria c
  where c.unit_id = new.source_unit_id
  on conflict (unit_id) do nothing;

  insert into teacher_curriculum_template_unit_keywords
    (unit_id, keyword_id, created_by, inherited)
  select new.id, tuk.keyword_id, auth.uid(), true
  from subject_template_unit_keywords tuk
  where tuk.unit_id = new.source_unit_id
  on conflict do nothing;

  select u.goal into v_goal from subject_template_units u where u.id = new.source_unit_id;
  update teacher_curriculum_template_units
    set goal = case when new.goal is null then v_goal else new.goal end,
        inherited_goal = v_goal,
        composed_at = now(),
        composition_dirty = false
  where id = new.id;

  return null;
end;
$$;
