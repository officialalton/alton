-- P2 10차 정정 — 매칭으로 시딩된 학생 회차가 상속을 받지 못하고 있었다.
--
-- 2026-09-13 제품 오너: "학생 커리큘럼(키워드, 교재, 문제 미상속) 쪽이랑 수업 준비
-- 쪽은 제대로 셋업이 안 되어 있네." — 새로 만든 계정에서도 그랬다.
--
-- 학생 회차를 만드는 길이 둘인데 서로 다른 칸을 채우고 있었다:
--
--   ensure_active_curriculum_overlay        source_unit_id                 (관리자 기준본)
--   seed_curriculum_overlay_for_match       source_teacher_template_unit_id (교사 기본)
--
-- 상속 트리거는 source_unit_id 만 보고, 없으면 곧바로 빠져나간다. 그래서 **교사
-- 기본 구성이 있는 정상 매칭일수록** 학생 회차가 텅 빈 채로 만들어졌다. 화면이
-- 그 회차에 '보강' 배지를 붙이던 것도 같은 원인이다(보강 판정이 source_unit_id
-- is null 이다) — 기준본에서 갈라져 나온 회차인데 학생 전용 보강으로 보였다.
--
-- 두 가지를 고친다:
--   1. 시딩이 두 칸을 **함께** 채운다. 교사 회차가 가리키는 기준본 회차를 같이 적는다.
--   2. 상속 트리거가 교사 회차 참조만 있어도 동작한다(옛 행을 위해서도 필요하다).

-- =========================================================================
-- 1. 시딩이 출처를 온전히 남긴다
-- =========================================================================
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

  select id into v_template_id
  from teacher_curriculum_templates
  where teacher_id = p_teacher_id and subject_id = p_subject_id;

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

  -- **두 칸을 함께 채운다.** source_unit_id 가 비어 있으면 상속이 돌지 않고,
  -- 화면은 이 회차를 학생 전용 보강으로 표시한다.
  insert into curriculum_overlay_units
    (overlay_id, source_teacher_template_unit_id, source_unit_id, source_kind,
     position, unit_title, note, created_by)
  select v_overlay_id, tu.id, tu.source_unit_id, 'teacher_template',
         tu.position, tu.unit_title, tu.note, auth.uid()
  from teacher_curriculum_template_units tu
  where tu.template_id = v_template_id
  order by tu.position;

  return v_overlay_id;
end;
$$;

comment on function public.seed_curriculum_overlay_for_match(uuid, uuid, uuid) is
  'P2 10차: 매칭 확정 시 교사 기본 구성으로 학생 커리큘럼을 시딩한다. 교사 회차와 그 '
  '회차가 갈라져 나온 기준본 회차를 **둘 다** 기록한다 — 전자만 적으면 상속 트리거가 '
  '돌지 않고 화면이 보강 단원으로 잘못 표시한다.';

-- =========================================================================
-- 2. 상속은 교사 회차 참조만 있어도 돈다
-- =========================================================================
-- 위 시딩이 고쳐져도 이미 만들어진 행에는 source_unit_id 가 없다. 그리고 교사
-- 회차가 기준본에서 갈라져 나오지 않은 경우(교사가 직접 만든 회차)도 있다 —
-- 그때는 source_unit_id 가 원래 없는 것이 맞다. 두 경우 모두 교사 회차를 직접
-- 보고 물려받을 수 있어야 한다.
create or replace function curriculum_overlay_units_inherit_defaults()
returns trigger language plpgsql as $$
declare
  v_teacher_unit_id uuid;
  v_goal text;
  v_prep_id uuid;
begin
  -- 회차가 직접 가리키는 교사 회차가 있으면 그것이 기준이다.
  v_teacher_unit_id := new.source_teacher_template_unit_id;

  if v_teacher_unit_id is null and new.source_unit_id is not null then
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
  end if;

  -- 어느 쪽으로도 물려받을 상위가 없으면 학생 전용 회차다 — 빈 채로 시작한다.
  if v_teacher_unit_id is null and new.source_unit_id is null then
    return null;
  end if;

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

  insert into curriculum_unit_preps (overlay_unit_id, goal, created_by)
  values (new.id, v_goal, auth.uid())
  on conflict (overlay_unit_id) do update
    set goal = coalesce(curriculum_unit_preps.goal, excluded.goal)
  returning id into v_prep_id;

  if v_teacher_unit_id is not null then
    insert into curriculum_unit_prep_items
      (prep_id, content_type, content_id, position, problem_version_id)
    select v_prep_id, 'problem', tp.problem_id,
           row_number() over (order by tp.position, tp.problem_id),
           tp.problem_version_id
    from teacher_curriculum_template_unit_problems tp
    join problems p on p.id = tp.problem_id
    where tp.unit_id = v_teacher_unit_id
      and p.status = 'confirmed' and p.archived_at is null
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

-- =========================================================================
-- 3. 이미 만들어진 행의 출처를 채운다
-- =========================================================================
-- 값을 **덮어쓰지 않는다** — 비어 있는 source_unit_id 만, 그 회차가 이미 가리키고
-- 있는 교사 회차에서 읽어 채운다. 새로 만들어 내는 정보가 아니라 시딩이 적었어야
-- 했는데 빠뜨린 연결이다.
--
-- 구성 내용(키워드·교재·문제)은 여기서 건드리지 않는다. 그것은 '물려받기'를 눌렀을
-- 때 들어온다 — 선생님이 일부러 비워 둔 것과 구분할 수 없기 때문이다.
update curriculum_overlay_units u
set source_unit_id = tu.source_unit_id
from teacher_curriculum_template_units tu
where u.source_teacher_template_unit_id = tu.id
  and u.source_unit_id is null
  and tu.source_unit_id is not null;

-- =========================================================================
-- 4. '물려받기'도 같은 기준을 본다
-- =========================================================================
-- 교사가 기준본 없이 직접 만든 회차에서 갈라져 나온 학생 회차는 source_unit_id 가
-- 원래 없다. 그 경우에도 교사 회차를 직접 보고 물려받아야 한다.
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
  select source_unit_id, overlay_id, source_teacher_template_unit_id
    into v_source_unit_id, v_overlay_id, v_teacher_unit_id
  from curriculum_overlay_units where id = p_overlay_unit_id;

  -- 회차가 직접 가리키는 교사 회차가 우선이다. 없으면 담당 선생님의 템플릿에서
  -- 같은 기준본을 가리키는 회차를 찾는다.
  if v_teacher_unit_id is null and v_source_unit_id is not null then
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
  end if;

  if v_teacher_unit_id is null and v_source_unit_id is null then
    return query select 0, 0, 0;
    return;
  end if;

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

  update curriculum_overlay_units
    set composed_at = coalesce(composed_at, now()), composition_dirty = false
  where id = p_overlay_unit_id;

  return query select v_kw, v_mat, v_prob;
end;
$$;
