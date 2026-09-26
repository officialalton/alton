-- P2 10차 — 학생별 구성도 최초 상속으로 완성된다.
--
-- 2026-09-13 제품 오너: "초기 셋업 후 교사가 학생마다 교재·문제를 다시 담아야 하는
-- 상태는 최종 요구를 충족하지 못합니다. 관리자 기준본 → 교사 기본 구성 → 학생별
-- 구성의 최초 상속에서 키워드·교재·문제·선택 버전·순서가 정해진 기준대로
-- 내려오도록 합니다."
--
-- 지금까지 학생 회차는 키워드와 교재만 물려받았다. 문제는 학생 층에서만 준비안
-- (curriculum_unit_prep_items)에 담기는데, 그 준비안을 만드는 일을 아무도 하지
-- 않았다 — 그래서 학생마다 교사가 문제를 다시 골라야 했다.
--
-- 준비안을 회차와 함께 만들고, 위층이 고른 문제와 **그 버전·순서**를 그대로
-- 내린다. 여기서 키워드로 다시 뽑지 않는다 — 다시 뽑으면 교사가 보고 정한 것과
-- 다른 문제가 학생에게 간다.
--
-- 중복 생성 방지: 준비안은 회차당 하나(unique)이고, 이 트리거는 회차가 만들어질 때
-- 한 번만 돈다. 앱의 "없으면 만든다" 경로(loadUnitPrep)는 이미 있는 것을 찾아
-- 그대로 쓴다. 둘이 겹치지 않는다.

create or replace function curriculum_overlay_units_inherit_defaults()
returns trigger language plpgsql as $$
declare
  v_teacher_unit_id uuid;
  v_goal text;
  v_prep_id uuid;
begin
  if new.source_unit_id is null then
    return null;
  end if;

  select tu.id into v_teacher_unit_id
  from student_curriculum_overlays o
  join subject_enrollments se on se.id = o.subject_enrollment_id
  join teacher_assignments ta
    on ta.subject_enrollment_id = o.subject_enrollment_id and ta.status = 'active'
  join teacher_curriculum_templates t
    on t.teacher_id = ta.teacher_id and t.subject_id = se.subject_id
  join teacher_curriculum_template_units tu
    on tu.template_id = t.id and tu.source_unit_id = new.source_unit_id
  where o.id = new.overlay_id
  order by ta.effective_from desc
  limit 1;

  if v_teacher_unit_id is not null then
    insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id, created_by)
    select new.id, tuk.keyword_id, auth.uid()
    from teacher_curriculum_template_unit_keywords tuk
    where tuk.unit_id = v_teacher_unit_id
    on conflict do nothing;

    insert into curriculum_overlay_unit_materials
      (overlay_unit_id, curriculum_doc_id, position, source, created_by,
       doc_version_at_pick, curriculum_doc_version_id)
    select new.id, tum.curriculum_doc_id,
           row_number() over (order by tum.position, tum.curriculum_doc_id),
           tum.source, auth.uid(), tum.doc_version_at_pick, tum.curriculum_doc_version_id
    from teacher_curriculum_template_unit_materials tum
    join curriculum_docs d on d.id = tum.curriculum_doc_id
    where tum.unit_id = v_teacher_unit_id
      and d.status = 'published'
    on conflict do nothing;

    select tu.goal into v_goal
    from teacher_curriculum_template_units tu where tu.id = v_teacher_unit_id;
  else
    insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id, created_by)
    select new.id, tuk.keyword_id, auth.uid()
    from subject_template_unit_keywords tuk
    where tuk.unit_id = new.source_unit_id
    on conflict do nothing;

    insert into curriculum_overlay_unit_materials
      (overlay_unit_id, curriculum_doc_id, position, source, created_by,
       doc_version_at_pick, curriculum_doc_version_id)
    select new.id, tum.curriculum_doc_id,
           row_number() over (order by tum.position, tum.curriculum_doc_id),
           tum.source, auth.uid(), tum.doc_version_at_pick, tum.curriculum_doc_version_id
    from subject_template_unit_materials tum
    join curriculum_docs d on d.id = tum.curriculum_doc_id
    where tum.unit_id = new.source_unit_id and d.status = 'published'
    on conflict do nothing;

    select u.goal into v_goal
    from subject_template_units u where u.id = new.source_unit_id;
  end if;

  -- 준비안을 회차와 함께 만든다. 목표가 있으면 함께 담는다.
  insert into curriculum_unit_preps (overlay_unit_id, goal, created_by)
  values (new.id, v_goal, auth.uid())
  on conflict (overlay_unit_id) do update
    set goal = coalesce(curriculum_unit_preps.goal, excluded.goal)
  returning id into v_prep_id;

  -- 위층이 고른 문제를 **그 버전·순서 그대로** 내린다. 공개된 버전이 없는 문제는
  -- 학생에게 갈 수 없으므로 여기서 빠진다(쓰기 가드가 어차피 막는다).
  if v_teacher_unit_id is not null then
    insert into curriculum_unit_prep_items
      (prep_id, content_type, content_id, position, problem_version_id)
    select v_prep_id, 'problem', tp.problem_id,
           row_number() over (order by tp.position, tp.problem_id),
           tp.problem_version_id
    from teacher_curriculum_template_unit_problems tp
    join problems p on p.id = tp.problem_id
    where tp.unit_id = v_teacher_unit_id
      and p.status = 'confirmed'
      and p.archived_at is null
      and exists (select 1 from problem_versions v
                  where v.problem_id = p.id and v.status = 'published')
    on conflict do nothing;
  else
    insert into curriculum_unit_prep_items
      (prep_id, content_type, content_id, position, problem_version_id)
    select v_prep_id, 'problem', sp.problem_id,
           row_number() over (order by sp.position, sp.problem_id),
           sp.problem_version_id
    from subject_template_unit_problems sp
    join problems p on p.id = sp.problem_id
    where sp.unit_id = new.source_unit_id
      and p.status = 'confirmed'
      and p.archived_at is null
      and exists (select 1 from problem_versions v
                  where v.problem_id = p.id and v.status = 'published')
    on conflict do nothing;
  end if;

  update curriculum_overlay_units
    set composed_at = now(), composition_dirty = false where id = new.id;

  return null;
end;
$$;

comment on function curriculum_overlay_units_inherit_defaults() is
  'P2 10차: 학생 회차가 만들어질 때 위층(교사 기본 → 없으면 관리자 기준본)에서 '
  '키워드·교재·문제·버전·순서와 목표를 그대로 내린다. 준비안도 함께 만든다 — 교사가 '
  '학생마다 다시 담지 않는다. **최초 1회만** 돌고, 이후 상위 변경은 덮어쓰지 않는다.';
