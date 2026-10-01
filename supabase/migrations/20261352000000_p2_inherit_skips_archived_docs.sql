-- P2 13차 정정 — 상속은 보관된 교재를 건너뛴다.
--
-- 2026-09-14 Preview: 기준본 회차에 보관된 교재가 담겨 있으면 학생 회차 생성(불러오기·매칭 시딩)이
-- "보관된 교재는 새로 담을 수 없습니다"로 통째로 실패했다. 회차가 만들어질 때 도는 상속 트리거가
-- published 만 보고 archived_at 을 보지 않아 보관 교재까지 복사하려 했고, 쓰기 가드가 막았다.
-- 보관 정책대로 — 신규 담기에서만 빠지고 이미 담긴 회차·과거 수업은 그대로 — 상속에서 건너뛴다.
-- (사람이 부르는 물려받기 RPC 는 이미 archived_at is null 을 보고 있었다.)

create or replace function curriculum_overlay_units_inherit_defaults()
returns trigger language plpgsql as $$
declare
  v_teacher_unit_id uuid;
  v_catalog_unit_id uuid;
  v_goal text;
  v_prep_id uuid;
begin
  select p.teacher_unit_id, p.catalog_unit_id
    into v_teacher_unit_id, v_catalog_unit_id
  from public.overlay_unit_parent(
    new.overlay_id, new.source_unit_id, new.source_teacher_template_unit_id
  ) p;

  if v_teacher_unit_id is null and v_catalog_unit_id is null then
    return null;
  end if;

  if v_teacher_unit_id is not null then
    insert into curriculum_overlay_unit_keywords
      (overlay_unit_id, keyword_id, created_by, inherited)
    select new.id, tuk.keyword_id, auth.uid(), true
    from teacher_curriculum_template_unit_keywords tuk
    where tuk.unit_id = v_teacher_unit_id
    on conflict do nothing;

    insert into curriculum_overlay_unit_materials
      (overlay_unit_id, curriculum_doc_id, position, source, created_by,
       doc_version_at_pick, curriculum_doc_version_id, inherited, inherited_position)
    select new.id, tum.curriculum_doc_id,
           row_number() over (order by tum.position, tum.curriculum_doc_id),
           tum.source, auth.uid(), tum.doc_version_at_pick, tum.curriculum_doc_version_id,
           true, tum.position
    from teacher_curriculum_template_unit_materials tum
    join curriculum_docs d on d.id = tum.curriculum_doc_id
    where tum.unit_id = v_teacher_unit_id
      and d.status = 'published' and d.archived_at is null
    on conflict do nothing;

    select tu.goal into v_goal
    from teacher_curriculum_template_units tu where tu.id = v_teacher_unit_id;
  else
    insert into curriculum_overlay_unit_keywords
      (overlay_unit_id, keyword_id, created_by, inherited)
    select new.id, tuk.keyword_id, auth.uid(), true
    from subject_template_unit_keywords tuk
    where tuk.unit_id = v_catalog_unit_id
    on conflict do nothing;

    insert into curriculum_overlay_unit_materials
      (overlay_unit_id, curriculum_doc_id, position, source, created_by,
       doc_version_at_pick, curriculum_doc_version_id, inherited, inherited_position)
    select new.id, tum.curriculum_doc_id,
           row_number() over (order by tum.position, tum.curriculum_doc_id),
           tum.source, auth.uid(), tum.doc_version_at_pick, tum.curriculum_doc_version_id,
           true, tum.position
    from subject_template_unit_materials tum
    join curriculum_docs d on d.id = tum.curriculum_doc_id
    where tum.unit_id = v_catalog_unit_id
      and d.status = 'published' and d.archived_at is null
    on conflict do nothing;

    select u.goal into v_goal
    from subject_template_units u where u.id = v_catalog_unit_id;
  end if;

  insert into curriculum_unit_preps (overlay_unit_id, goal, inherited_goal, created_by)
  values (new.id, v_goal, v_goal, auth.uid())
  on conflict (overlay_unit_id) do update
    set goal = coalesce(curriculum_unit_preps.goal, excluded.goal),
        inherited_goal = excluded.inherited_goal
  returning id into v_prep_id;

  if v_teacher_unit_id is not null then
    insert into curriculum_unit_prep_items
      (prep_id, content_type, content_id, position, problem_version_id,
       inherited, inherited_position)
    select v_prep_id, 'problem', tp.problem_id,
           row_number() over (order by tp.position, tp.problem_id),
           tp.problem_version_id, true, tp.position
    from teacher_curriculum_template_unit_problems tp
    join problems p on p.id = tp.problem_id
    where tp.unit_id = v_teacher_unit_id
      and p.status = 'confirmed' and p.archived_at is null
      and exists (select 1 from problem_versions v
                  where v.problem_id = p.id and v.status = 'published')
    on conflict do nothing;
  else
    insert into curriculum_unit_prep_items
      (prep_id, content_type, content_id, position, problem_version_id,
       inherited, inherited_position)
    select v_prep_id, 'problem', sp.problem_id,
           row_number() over (order by sp.position, sp.problem_id),
           sp.problem_version_id, true, sp.position
    from subject_template_unit_problems sp
    join problems p on p.id = sp.problem_id
    where sp.unit_id = v_catalog_unit_id
      and p.status = 'confirmed' and p.archived_at is null
      and exists (select 1 from problem_versions v
                  where v.problem_id = p.id and v.status = 'published')
    on conflict do nothing;
  end if;

  update curriculum_overlay_units
    set composed_at = now(), composition_dirty = false where id = new.id;

  return null;
end;
$$;

-- 교사 회차가 기준본에서 갈라질 때도 같다. (20261351000000 판본에 archived 조건만 더한다.)
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
  where tum.unit_id = new.source_unit_id
    and d.status = 'published' and d.archived_at is null
  on conflict do nothing;

  insert into teacher_curriculum_template_unit_problems
    (unit_id, problem_id, position, source, created_by, problem_version_id,
     inherited, inherited_position)
  select new.id, sp.problem_id, sp.position, sp.source, auth.uid(), sp.problem_version_id,
         true, sp.position
  from subject_template_unit_problems sp
  join problems p on p.id = sp.problem_id
  where sp.unit_id = new.source_unit_id
    and p.archived_at is null
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
