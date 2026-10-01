-- P2 10차 — 이미 만들어진 학생 회차도 같은 기준으로 물려받는다.
--
-- 2026-09-13 제품 오너: "학생 커리큘럼(키워드, 교재, 문제 미상속) 쪽이랑 수업 준비
-- 쪽은 제대로 셋업이 안 되어 있네."
--
-- 20261340000000 은 **회차가 만들어질 때** 상속을 완성한다. 그런데 지금 화면에 있는
-- 학생 회차는 그 전에 만들어진 것이라 트리거가 돌지 않았다. 소급해서 자동으로
-- 채우지는 않는다(선생님이 일부러 비워 둔 것과 구분할 수 없다) — 대신 **부를 수 있는
-- 보정 경로**가 생성 시점과 같은 기준으로 동작하게 한다.
--
-- 지금의 inherit_unit_defaults_from_template 는 두 가지가 어긋나 있다:
--   1. 관리자 기준본에서만 가져온다. 교사 기본 구성이 있으면 그쪽이 기준이어야 한다.
--   2. 문제와 버전·순서를 가져오지 않는다. 그래서 교사가 학생마다 다시 담아야 했다.

drop function if exists public.inherit_unit_defaults_from_template(uuid);

create or replace function public.inherit_unit_defaults_from_template(p_overlay_unit_id uuid)
returns table (keywords_added integer, materials_added integer, problems_added integer)
language plpgsql
as $$
declare
  v_source_unit_id uuid;
  v_overlay_id uuid;
  v_teacher_unit_id uuid;
  v_prep_id uuid;
  v_kw int := 0;
  v_mat int := 0;
  v_prob int := 0;
  v_next int;
begin
  select source_unit_id, overlay_id into v_source_unit_id, v_overlay_id
  from curriculum_overlay_units where id = p_overlay_unit_id;

  if v_source_unit_id is null then
    return query select 0, 0, 0;
    return;
  end if;

  -- 생성 시점과 같은 순서로 기준을 고른다: 교사 기본 구성이 있으면 그것, 없으면
  -- 관리자 기준본.
  select tu.id into v_teacher_unit_id
  from student_curriculum_overlays o
  join subject_enrollments se on se.id = o.subject_enrollment_id
  join teacher_assignments ta
    on ta.subject_enrollment_id = o.subject_enrollment_id and ta.status = 'active'
  join teacher_curriculum_templates t
    on t.teacher_id = ta.teacher_id and t.subject_id = se.subject_id
  join teacher_curriculum_template_units tu
    on tu.template_id = t.id and tu.source_unit_id = v_source_unit_id
  where o.id = v_overlay_id
  order by ta.effective_from desc
  limit 1;

  -- 키워드 — 이미 있는 것은 건드리지 않는다.
  with ins as (
    insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id)
    select p_overlay_unit_id, k.keyword_id
    from (
      select keyword_id from teacher_curriculum_template_unit_keywords
      where v_teacher_unit_id is not null and unit_id = v_teacher_unit_id
      union
      select keyword_id from subject_template_unit_keywords
      where v_teacher_unit_id is null and unit_id = v_source_unit_id
    ) k
    on conflict do nothing
    returning 1
  )
  select count(*) into v_kw from ins;

  select coalesce(max(position), 0) into v_next
  from curriculum_overlay_unit_materials where overlay_unit_id = p_overlay_unit_id;

  -- 교재 — 담을 때의 버전과 순서를 그대로 가져온다. 선생님이 뺀 것은 다시 넣지
  -- 않는다(제외 기록을 존중한다 — 예전 구현은 이것을 보지 않아 뺀 교재가 되살아났다).
  with src as (
    select m.curriculum_doc_id, m.position, m.source, m.doc_version_at_pick, m.curriculum_doc_version_id
    from teacher_curriculum_template_unit_materials m
    where v_teacher_unit_id is not null and m.unit_id = v_teacher_unit_id
    union all
    select m.curriculum_doc_id, m.position, m.source, m.doc_version_at_pick, m.curriculum_doc_version_id
    from subject_template_unit_materials m
    where v_teacher_unit_id is null and m.unit_id = v_source_unit_id
  ), ins as (
    insert into curriculum_overlay_unit_materials
      (overlay_unit_id, curriculum_doc_id, position, source, created_by,
       doc_version_at_pick, curriculum_doc_version_id)
    select p_overlay_unit_id, s.curriculum_doc_id,
           v_next + row_number() over (order by s.position, s.curriculum_doc_id),
           s.source, auth.uid(), s.doc_version_at_pick, s.curriculum_doc_version_id
    from src s
    join curriculum_docs d on d.id = s.curriculum_doc_id
    where d.status = 'published' and d.archived_at is null
      and not exists (
        select 1 from curriculum_overlay_unit_materials e
        where e.overlay_unit_id = p_overlay_unit_id and e.curriculum_doc_id = s.curriculum_doc_id
      )
      and not exists (
        select 1 from curriculum_overlay_unit_material_exclusions x
        where x.overlay_unit_id = p_overlay_unit_id and x.curriculum_doc_id = s.curriculum_doc_id
      )
    on conflict do nothing
    returning 1
  )
  select count(*) into v_mat from ins;

  -- 준비안 — 없으면 만든다. 문제는 여기 담긴다.
  insert into curriculum_unit_preps (overlay_unit_id, created_by)
  values (p_overlay_unit_id, auth.uid())
  on conflict (overlay_unit_id) do update set overlay_unit_id = excluded.overlay_unit_id
  returning id into v_prep_id;

  select coalesce(max(position), 0) into v_next
  from curriculum_unit_prep_items where prep_id = v_prep_id;

  with src as (
    select p.problem_id, p.position, p.problem_version_id
    from teacher_curriculum_template_unit_problems p
    where v_teacher_unit_id is not null and p.unit_id = v_teacher_unit_id
    union all
    select p.problem_id, p.position, p.problem_version_id
    from subject_template_unit_problems p
    where v_teacher_unit_id is null and p.unit_id = v_source_unit_id
  ), ins as (
    insert into curriculum_unit_prep_items
      (prep_id, content_type, content_id, position, problem_version_id)
    select v_prep_id, 'problem', s.problem_id,
           v_next + row_number() over (order by s.position, s.problem_id),
           s.problem_version_id
    from src s
    join problems pr on pr.id = s.problem_id
    where pr.status = 'confirmed' and pr.archived_at is null
      and exists (select 1 from problem_versions v
                  where v.problem_id = pr.id and v.status = 'published')
      and not exists (
        select 1 from curriculum_unit_prep_items e
        where e.prep_id = v_prep_id and e.content_type = 'problem' and e.content_id = s.problem_id
      )
    on conflict do nothing
    returning 1
  )
  select count(*) into v_prob from ins;

  -- 물려받은 순간이 이 회차의 구성 시점이다. 다시 구성 안내가 곧바로 뜨지 않게 한다.
  update curriculum_overlay_units
    set composed_at = coalesce(composed_at, now()), composition_dirty = false
  where id = p_overlay_unit_id;

  return query select v_kw, v_mat, v_prob;
end;
$$;

comment on function public.inherit_unit_defaults_from_template(uuid) is
  'P2 10차: 이미 있는 학생 회차에 위층 구성을 물려받는다. 생성 시점 상속과 **같은 기준**이다 '
  '— 교사 기본 구성이 있으면 그것을, 없으면 관리자 기준본을, 키워드·교재·문제와 각각의 '
  '버전·순서까지. 이미 담긴 것과 선생님이 뺀 것은 건드리지 않는다. 사람이 부를 때만 돈다.';

-- 교사 층도 같은 모양으로 맞춘다 — 문제와 버전·순서까지 가져오고, 뺀 것은 되살리지
-- 않는다. 두 층의 '물려받기'가 서로 다르게 동작하면 화면이 같은 버튼을 쓸 수 없다.
drop function if exists public.inherit_teacher_unit_defaults_from_template(uuid);

create or replace function public.inherit_teacher_unit_defaults_from_template(p_unit_id uuid)
returns table (keywords_added integer, materials_added integer, problems_added integer)
language plpgsql
as $$
declare
  v_source_unit_id uuid;
  v_kw int := 0;
  v_mat int := 0;
  v_prob int := 0;
  v_next int;
begin
  select source_unit_id into v_source_unit_id
  from teacher_curriculum_template_units where id = p_unit_id;

  if v_source_unit_id is null then
    return query select 0, 0, 0;
    return;
  end if;

  with ins as (
    insert into teacher_curriculum_template_unit_keywords (unit_id, keyword_id, created_by)
    select p_unit_id, k.keyword_id, auth.uid()
    from subject_template_unit_keywords k
    where k.unit_id = v_source_unit_id
    on conflict do nothing
    returning 1
  )
  select count(*) into v_kw from ins;

  select coalesce(max(position), 0) into v_next
  from teacher_curriculum_template_unit_materials where unit_id = p_unit_id;

  with ins as (
    insert into teacher_curriculum_template_unit_materials
      (unit_id, curriculum_doc_id, position, source, created_by,
       doc_version_at_pick, curriculum_doc_version_id)
    select p_unit_id, m.curriculum_doc_id,
           v_next + row_number() over (order by m.position, m.curriculum_doc_id),
           m.source, auth.uid(), m.doc_version_at_pick, m.curriculum_doc_version_id
    from subject_template_unit_materials m
    join curriculum_docs d on d.id = m.curriculum_doc_id
    where m.unit_id = v_source_unit_id
      and d.status = 'published' and d.archived_at is null
      and not exists (
        select 1 from teacher_curriculum_template_unit_materials e
        where e.unit_id = p_unit_id and e.curriculum_doc_id = m.curriculum_doc_id
      )
      and not exists (
        select 1 from teacher_curriculum_template_unit_material_exclusions x
        where x.unit_id = p_unit_id and x.curriculum_doc_id = m.curriculum_doc_id
      )
    on conflict do nothing
    returning 1
  )
  select count(*) into v_mat from ins;

  select coalesce(max(position), 0) into v_next
  from teacher_curriculum_template_unit_problems where unit_id = p_unit_id;

  with ins as (
    insert into teacher_curriculum_template_unit_problems
      (unit_id, problem_id, position, source, created_by, problem_version_id)
    select p_unit_id, sp.problem_id,
           v_next + row_number() over (order by sp.position, sp.problem_id),
           sp.source, auth.uid(), sp.problem_version_id
    from subject_template_unit_problems sp
    join problems pr on pr.id = sp.problem_id
    where sp.unit_id = v_source_unit_id
      and pr.status = 'confirmed' and pr.archived_at is null
      and exists (select 1 from problem_versions v
                  where v.problem_id = pr.id and v.status = 'published')
      and not exists (
        select 1 from teacher_curriculum_template_unit_problems e
        where e.unit_id = p_unit_id and e.problem_id = sp.problem_id
      )
      and not exists (
        select 1 from teacher_curriculum_template_unit_problem_exclusions x
        where x.unit_id = p_unit_id and x.problem_id = sp.problem_id
      )
    on conflict do nothing
    returning 1
  )
  select count(*) into v_prob from ins;

  update teacher_curriculum_template_units
    set composed_at = coalesce(composed_at, now()), composition_dirty = false
  where id = p_unit_id;

  return query select v_kw, v_mat, v_prob;
end;
$$;

comment on function public.inherit_teacher_unit_defaults_from_template(uuid) is
  'P2 10차: 교사 기본 구성에 관리자 기준본을 물려받는다. 학생 층 보정과 같은 기준 — '
  '키워드·교재·문제와 각각의 버전·순서까지, 이미 담긴 것과 뺀 것은 건드리지 않는다.';
