-- P2 5차 — 회차 목표를 세 계층 모두에 둔다.
--
-- 2026-09-13 지시: "목표도 관리자 기준본 → 내 기본 구성 → 학생별 구성의 상속·수정
-- 범위를 정의해 패널에 연결해주세요."
--
-- 지금 목표는 학생 층에만 있다(`curriculum_unit_preps.goal`, 20261296000000).
-- 그래서 관리자가 "이 회차에서 무엇을 달성할 것인가"를 적어 둘 자리가 없고,
-- 선생님도 학생을 배정받은 뒤에야 목표를 쓸 수 있다.
--
-- `note`(메모)와 다른 것이다. 메모는 운영 참고이고, 목표는 이 회차의 결과다 —
-- 준비·수업·복습 화면의 머리말로 쓰인다. 섞으면 둘 다 흐려진다.
--
-- 상속·수정 범위(키워드·교재와 같은 규칙):
--   초기 상속  회차가 만들어질 때 위층의 목표가 자동으로 내려온다.
--   보정       이미 있는 회차를 나중에 채우는 것은 사람이 부른다.
--   수정 범위  각 층에서 고친 목표는 그 층에만 적용된다. 상위가 나중에 바뀌어도
--              하위로 저절로 내려가지 않는다 — 하위 조정을 덮어쓰게 되기 때문이다.

alter table subject_template_units add column goal text;
alter table teacher_curriculum_template_units add column goal text;

comment on column subject_template_units.goal is
  'P2 5차: 이 회차에서 달성할 것. 메모(note)와 다르다 — 준비·수업·복습 화면의 머리말이다. '
  '선생님 기본 템플릿과 학생 운영본으로 초기 상속된다.';
comment on column teacher_curriculum_template_units.goal is
  'P2 5차: 선생님이 정한 이 회차의 목표. 관리자 기준본에서 초기 상속되고, 여기서 고친 것은 '
  '앞으로 배정받는 학생에게 내려간다.';

-- =========================================================================
-- 1. 관리자 기준본 → 선생님 기본 (회차 생성 시)
-- =========================================================================
-- 20261317000000 의 teacher_template_units_inherit_defaults 에 목표를 더한다.
-- 키워드·교재를 내려주는 그 트리거와 같은 자리다.
create or replace function teacher_template_units_inherit_defaults()
returns trigger language plpgsql as $$
declare
  v_goal text;
begin
  if new.source_unit_id is null then
    return null;
  end if;

  insert into teacher_curriculum_template_unit_keywords (unit_id, keyword_id, created_by)
  select new.id, tuk.keyword_id, auth.uid()
  from subject_template_unit_keywords tuk
  where tuk.unit_id = new.source_unit_id
  on conflict do nothing;

  insert into teacher_curriculum_template_unit_materials
    (unit_id, curriculum_doc_id, position, source, created_by)
  select new.id, tum.curriculum_doc_id,
         row_number() over (order by tum.position, tum.curriculum_doc_id),
         'manual', auth.uid()
  from subject_template_unit_materials tum
  join curriculum_docs d on d.id = tum.curriculum_doc_id
  where tum.unit_id = new.source_unit_id and d.status = 'published'
  on conflict do nothing;

  -- 문제 구성 조건과 관리자가 직접 담아 둔 문제도 **생성 시점에 자동으로** 내려온다.
  -- 20261321000000 은 수동 보정 함수만 뒀는데, 최초 상속은 자동이어야 한다는 것이
  -- 확정 정책이다(키워드·교재와 같다). 자동분은 복사하지 않는다 — 선생님 층의
  -- 키워드·조건으로 다시 계산되는 것이 맞다.
  insert into teacher_curriculum_template_unit_problem_criteria
    (unit_id, formats, difficulties, target_count, updated_by)
  select new.id, c.formats, c.difficulties, c.target_count, auth.uid()
  from subject_template_unit_problem_criteria c
  where c.unit_id = new.source_unit_id
  on conflict (unit_id) do nothing;

  insert into teacher_curriculum_template_unit_problems
    (unit_id, problem_id, position, source, created_by)
  select new.id, sp.problem_id,
         row_number() over (order by sp.position, sp.problem_id),
         'manual', auth.uid()
  from subject_template_unit_problems sp
  where sp.unit_id = new.source_unit_id and sp.source = 'manual'
  on conflict do nothing;

  -- 목표는 선생님이 이미 적어 둔 것이 있으면 건드리지 않는다(보통은 비어 있다).
  if new.goal is null then
    select u.goal into v_goal from subject_template_units u where u.id = new.source_unit_id;
    if v_goal is not null then
      update teacher_curriculum_template_units set goal = v_goal where id = new.id;
    end if;
  end if;

  return null;
end;
$$;

-- =========================================================================
-- 2. 위층 → 학생 운영본 (회차 생성 시)
-- =========================================================================
-- 20261317000000 의 curriculum_overlay_units_inherit_defaults 에 목표를 더한다.
-- 선생님 층에 연결된 회차가 있으면 그 목표를, 없으면 관리자 기준본의 목표를 쓴다 —
-- 키워드·교재와 같은 판단이다.
create or replace function curriculum_overlay_units_inherit_defaults()
returns trigger language plpgsql as $$
declare
  v_teacher_unit_id uuid;
  v_goal text;
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
      (overlay_unit_id, curriculum_doc_id, position, source, created_by)
    select new.id, tum.curriculum_doc_id,
           row_number() over (order by tum.position, tum.curriculum_doc_id),
           'manual', auth.uid()
    from teacher_curriculum_template_unit_materials tum
    join curriculum_docs d on d.id = tum.curriculum_doc_id
    where tum.unit_id = v_teacher_unit_id
      and tum.source = 'manual'
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
      (overlay_unit_id, curriculum_doc_id, position, source, created_by)
    select new.id, tum.curriculum_doc_id,
           row_number() over (order by tum.position, tum.curriculum_doc_id),
           'manual', auth.uid()
    from subject_template_unit_materials tum
    join curriculum_docs d on d.id = tum.curriculum_doc_id
    where tum.unit_id = new.source_unit_id and d.status = 'published'
    on conflict do nothing;

    select u.goal into v_goal
    from subject_template_units u where u.id = new.source_unit_id;
  end if;

  -- 목표가 있으면 이 회차의 준비를 만들어 담는다. 준비 행은 어차피 준비 화면에서
  -- 만들어지므로 미리 만드는 것이 새로운 상태를 더하지 않는다.
  if v_goal is not null then
    insert into curriculum_unit_preps (overlay_unit_id, goal, created_by)
    values (new.id, v_goal, auth.uid())
    on conflict (overlay_unit_id) do nothing;
  end if;

  return null;
end;
$$;

-- =========================================================================
-- 3. 보정 — 이미 있는 회차에 위층 목표를 가져온다
-- =========================================================================
-- 자동으로 돌지 않는다. 비어 있는 것이 상속 누락인지 사람이 지운 것인지 코드가
-- 구분할 수 없기 때문이다. 비어 있을 때만 채우고 덮어쓰지 않는다.
create or replace function inherit_teacher_unit_goal(p_unit_id uuid)
returns boolean
language plpgsql
as $$
declare
  v_source_unit_id uuid;
  v_goal text;
  v_current text;
begin
  select source_unit_id, goal into v_source_unit_id, v_current
  from teacher_curriculum_template_units where id = p_unit_id;

  if v_source_unit_id is null or v_current is not null then
    return false;
  end if;

  select goal into v_goal from subject_template_units where id = v_source_unit_id;
  if v_goal is null then
    return false;
  end if;

  update teacher_curriculum_template_units set goal = v_goal where id = p_unit_id;
  return true;
end;
$$;

comment on function inherit_teacher_unit_goal(uuid) is
  'P2 5차: 관리자 기준본 회차의 목표를 선생님 회차로 물려받는다. 비어 있을 때만 채우고 '
  '덮어쓰지 않는다. 자동 실행되지 않는다 — 사람이 부른다.';
