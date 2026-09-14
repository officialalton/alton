-- P2 12차 — 구성의 각 행이 "상위에서 내려온 것"인지 적는다.
--
-- 2026-09-14 다음 작업 단위: 지금 '기본 구성 업데이트'는 **보충과 버전 갱신만**
-- 한다. 상위에서 빠진 항목을 아래에서도 빼거나, 상위의 순서·목표 변경을 반영하는
-- 일은 못 한다. 막힌 이유는 각 구성 행에 "이건 위에서 내려온 것"이라는 표식이
-- 없어서다 — 지금 상태에서 빼기 시작하면 선생님이 직접 담은 것까지 지운다.
--
-- 여기서는 **표식만 만든다.** 표식을 읽어 실제로 빼고 순서를 맞추는 일은
-- 20261347000000 이 한다. 두 개로 나눈 이유는, 이 파일이 남기는 것이 사실 기록
-- (누가 넣었나)이고 다음 파일이 정하는 것이 정책(그래서 어떻게 하나)이기 때문이다.
--
-- 표식은 두 가지다:
--   inherited           위층에서 내려온 행인가. false 면 사람이 직접 담았거나
--                       (manual) 이 층의 키워드에서 자동으로 들어온 것(auto)이다.
--   inherited_position  내려올 당시 **위층에서의** 순서. 사람이 순서를 바꿨는지,
--                       위층의 순서가 바뀌었는지를 이 값과 대조해 가른다.
--
-- 목표(goal)는 행이 아니라 회차의 값이라 따로 둔다: inherited_goal 은 내려올
-- 당시 위층의 목표다. 지금 목표가 이 값 그대로면 아무도 손대지 않은 것이므로
-- 위층을 따라가고, 다르면 사람이 고친 것이므로 건드리지 않는다.

-- =========================================================================
-- 1. 표식 컬럼
-- =========================================================================
-- 기준본(subject_template_*)에는 위가 없다 — 붙이지 않는다.

alter table teacher_curriculum_template_unit_keywords
  add column inherited boolean not null default false;
alter table teacher_curriculum_template_unit_materials
  add column inherited boolean not null default false,
  add column inherited_position int;
alter table teacher_curriculum_template_unit_problems
  add column inherited boolean not null default false,
  add column inherited_position int;
alter table teacher_curriculum_template_units
  add column inherited_goal text;

alter table curriculum_overlay_unit_keywords
  add column inherited boolean not null default false;
alter table curriculum_overlay_unit_materials
  add column inherited boolean not null default false,
  add column inherited_position int;
alter table curriculum_unit_prep_items
  add column inherited boolean not null default false,
  add column inherited_position int;
alter table curriculum_unit_preps
  add column inherited_goal text;

comment on column teacher_curriculum_template_unit_materials.inherited is
  'P2 12차: 관리자 기준본에서 내려온 행인가. true 인 행만 상위에서 빠졌을 때 함께 '
  '빠진다. 선생님이 직접 담은 행(false)은 상위가 무엇을 하든 남는다.';
comment on column teacher_curriculum_template_unit_materials.inherited_position is
  'P2 12차: 내려올 당시 상위에서의 순서. 사람이 순서를 바꿨는지 판정하는 기준값이다.';
comment on column teacher_curriculum_template_units.inherited_goal is
  'P2 12차: 내려올 당시 상위의 목표. 지금 목표가 이 값 그대로면 아무도 손대지 않은 '
  '것이므로 상위를 따라간다. 다르면 사람이 고친 것이라 건드리지 않는다.';
comment on column curriculum_unit_prep_items.inherited is
  'P2 12차: 위층(교사 기본 구성 또는 관리자 기준본)에서 내려온 문제인가.';

-- =========================================================================
-- 2. 이미 있는 행의 표식 — 지금 상위에 같은 것이 있으면 내려온 것으로 본다
-- =========================================================================
-- 정확히는 알 수 없다. 생성 시점·경로를 기록해 두지 않았기 때문이다. 두 선택지가
-- 있었다:
--
--   전부 false      아무것도 잘못 지우지 않는다. 대신 **지금 있는 회차는 앞으로도
--                   영원히** 상위의 삭제·순서 변경을 받지 못한다(다시 상속받는
--                   행만 표식을 얻으므로).
--   상위에 있으면 true  거의 전부 맞다(이 회차들은 상속으로 만들어졌다). 틀리는
--                   경우는 "선생님이 직접 담았는데 마침 상위에도 같은 것이 있다"
--                   뿐이고, 그때도 상위가 그것을 뺄 때만 드러나며 다시 담으면 된다.
--
-- 서비스는 오픈 전이고 운영 데이터가 없다. 뒤쪽을 택한다. **단정이 아니라 추정**
-- 이라는 사실을 여기 남긴다.

update teacher_curriculum_template_unit_keywords e
set inherited = true
from teacher_curriculum_template_units u
join subject_template_unit_keywords s on s.unit_id = u.source_unit_id
where e.unit_id = u.id and s.keyword_id = e.keyword_id;

update teacher_curriculum_template_unit_materials e
set inherited = true, inherited_position = s.position
from teacher_curriculum_template_units u
join subject_template_unit_materials s on s.unit_id = u.source_unit_id
where e.unit_id = u.id and s.curriculum_doc_id = e.curriculum_doc_id;

update teacher_curriculum_template_unit_problems e
set inherited = true, inherited_position = s.position
from teacher_curriculum_template_units u
join subject_template_unit_problems s on s.unit_id = u.source_unit_id
where e.unit_id = u.id and s.problem_id = e.problem_id;

-- 학생 층의 상위는 교사 회차가 우선이고, 없으면 관리자 기준본이다. 회차마다
-- 상위를 한 번 풀어 두고 쓴다.
--
-- 두 모양이다. 셋을 받는 쪽은 회차 행을 이미 손에 든 곳(트리거의 new)이 다시
-- 읽지 않고 쓰고, id 하나를 받는 쪽은 그 행을 읽어 넘긴다. **호출자 권한으로
-- 돈다** — 남의 회차는 읽히지 않아 "상위 없음"으로 끝나고, 있는지 없는지를
-- 흘리지 않는다(unit-defaults-inheritance 테스트가 이것을 지킨다).
create or replace function public.overlay_unit_parent(
  p_overlay_id uuid,
  p_source_unit_id uuid,
  p_source_teacher_template_unit_id uuid
)
returns table (teacher_unit_id uuid, catalog_unit_id uuid)
language sql
stable
as $$
  with resolved as (
    select coalesce(
      p_source_teacher_template_unit_id,
      (
        select tu.id
        from student_curriculum_overlays o
        join subject_enrollments se on se.id = o.subject_enrollment_id
        join teacher_assignments ta
          on ta.subject_enrollment_id = o.subject_enrollment_id and ta.status = 'active'
        join teacher_curriculum_templates t
          on t.teacher_id = ta.teacher_id and t.subject_id = se.subject_id
        join teacher_curriculum_template_units tu
          on tu.template_id = t.id and tu.source_unit_id = p_source_unit_id
        where o.id = p_overlay_id and p_source_unit_id is not null
        order by ta.effective_from desc
        limit 1
      )
    ) as teacher_unit_id
  )
  -- 교사 회차를 찾았으면 그것이 유일한 상위다. 기준본은 그 위이지, 이 회차의
  -- 상위가 아니다 — 둘을 함께 보면 같은 것을 두 번 세거나 교사가 뺀 것이 기준본
  -- 경로로 되살아난다.
  select teacher_unit_id,
         case when teacher_unit_id is null then p_source_unit_id else null end
  from resolved;
$$;

create or replace function public.overlay_unit_parent(p_overlay_unit_id uuid)
returns table (teacher_unit_id uuid, catalog_unit_id uuid)
language sql
stable
as $$
  select p.teacher_unit_id, p.catalog_unit_id
  from curriculum_overlay_units u
  cross join lateral public.overlay_unit_parent(
    u.overlay_id, u.source_unit_id, u.source_teacher_template_unit_id
  ) p
  where u.id = p_overlay_unit_id;
$$;

comment on function public.overlay_unit_parent(uuid) is
  'P2 12차: 이 학생 회차의 상위가 어디인가. 교사 회차가 있으면 그것 하나이고, '
  '없을 때만 관리자 기준본이다. 상속·물려받기·업데이트가 전부 이 함수를 본다 — '
  '상위를 고르는 규칙이 여러 벌로 갈라지지 않게 한다. 호출자 권한으로 돈다.';

grant execute on function public.overlay_unit_parent(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.overlay_unit_parent(uuid) to authenticated, service_role;

update curriculum_overlay_unit_keywords e
set inherited = true
from curriculum_overlay_units u
cross join lateral public.overlay_unit_parent(u.id) p
where e.overlay_unit_id = u.id
  and (
    exists (select 1 from teacher_curriculum_template_unit_keywords s
            where s.unit_id = p.teacher_unit_id and s.keyword_id = e.keyword_id)
    or exists (select 1 from subject_template_unit_keywords s
               where s.unit_id = p.catalog_unit_id and s.keyword_id = e.keyword_id)
  );

update curriculum_overlay_unit_materials e
set inherited = true,
    inherited_position = coalesce(
      (select s.position from teacher_curriculum_template_unit_materials s
       where s.unit_id = p.teacher_unit_id and s.curriculum_doc_id = e.curriculum_doc_id),
      (select s.position from subject_template_unit_materials s
       where s.unit_id = p.catalog_unit_id and s.curriculum_doc_id = e.curriculum_doc_id)
    )
from curriculum_overlay_units u
cross join lateral public.overlay_unit_parent(u.id) p
where e.overlay_unit_id = u.id
  and (
    exists (select 1 from teacher_curriculum_template_unit_materials s
            where s.unit_id = p.teacher_unit_id and s.curriculum_doc_id = e.curriculum_doc_id)
    or exists (select 1 from subject_template_unit_materials s
               where s.unit_id = p.catalog_unit_id and s.curriculum_doc_id = e.curriculum_doc_id)
  );

update curriculum_unit_prep_items e
set inherited = true,
    inherited_position = coalesce(
      (select s.position from teacher_curriculum_template_unit_problems s
       where s.unit_id = p.teacher_unit_id and s.problem_id = e.content_id),
      (select s.position from subject_template_unit_problems s
       where s.unit_id = p.catalog_unit_id and s.problem_id = e.content_id)
    )
from curriculum_unit_preps pp
join curriculum_overlay_units u on u.id = pp.overlay_unit_id
cross join lateral public.overlay_unit_parent(u.id) p
where e.prep_id = pp.id
  and e.content_type = 'problem'
  and (
    exists (select 1 from teacher_curriculum_template_unit_problems s
            where s.unit_id = p.teacher_unit_id and s.problem_id = e.content_id)
    or exists (select 1 from subject_template_unit_problems s
               where s.unit_id = p.catalog_unit_id and s.problem_id = e.content_id)
  );

-- 목표의 기준값 — 지금 목표가 상위와 같으면 아무도 손대지 않은 것으로 본다.
update teacher_curriculum_template_units u
set inherited_goal = s.goal
from subject_template_units s
where s.id = u.source_unit_id and u.goal is not distinct from s.goal;

update curriculum_unit_preps pp
set inherited_goal = coalesce(tu.goal, su.goal)
from curriculum_overlay_units u
cross join lateral public.overlay_unit_parent(u.id) p
left join teacher_curriculum_template_units tu on tu.id = p.teacher_unit_id
left join subject_template_units su on su.id = p.catalog_unit_id
where pp.overlay_unit_id = u.id
  and pp.goal is not distinct from coalesce(tu.goal, su.goal);

-- =========================================================================
-- 3. 상속 경로가 표식을 남긴다
-- =========================================================================
-- 네 곳이다. 회차가 만들어질 때 도는 트리거 둘, 사람이 '기본 구성 업데이트'를
-- 눌렀을 때 도는 물려받기 둘. 넷 다 같은 것을 적어야 한다 — 한 곳이라도 빠지면
-- 그 경로로 들어온 행만 상위 변경을 받지 못한다.

create or replace function teacher_template_units_inherit_defaults()
returns trigger language plpgsql as $$
declare
  v_goal text;
begin
  if new.source_unit_id is null then
    return null;
  end if;

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

  insert into teacher_curriculum_template_unit_keywords
    (unit_id, keyword_id, created_by, inherited)
  select new.id, tuk.keyword_id, auth.uid(), true
  from subject_template_unit_keywords tuk
  where tuk.unit_id = new.source_unit_id
  on conflict do nothing;

  insert into teacher_curriculum_template_unit_materials
    (unit_id, curriculum_doc_id, position, source, created_by,
     doc_version_at_pick, curriculum_doc_version_id, inherited, inherited_position)
  select new.id, tum.curriculum_doc_id,
         row_number() over (order by tum.position, tum.curriculum_doc_id),
         'manual', auth.uid(), tum.doc_version_at_pick, tum.curriculum_doc_version_id,
         true, tum.position
  from subject_template_unit_materials tum
  join curriculum_docs d on d.id = tum.curriculum_doc_id
  where tum.unit_id = new.source_unit_id and d.status = 'published'
  on conflict do nothing;

  insert into teacher_curriculum_template_unit_problem_criteria
    (unit_id, formats, difficulties, target_count, updated_by)
  select new.id, c.formats, c.difficulties, c.target_count, auth.uid()
  from subject_template_unit_problem_criteria c
  where c.unit_id = new.source_unit_id
  on conflict (unit_id) do nothing;

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

  -- 어느 쪽으로도 물려받을 상위가 없으면 학생 전용 회차다 — 빈 채로 시작한다.
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
      and d.status = 'published'
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
    where tum.unit_id = v_catalog_unit_id and d.status = 'published'
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
    insert into teacher_curriculum_template_unit_keywords
      (unit_id, keyword_id, created_by, inherited)
    select p_unit_id, k.keyword_id, auth.uid(), true
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
       doc_version_at_pick, curriculum_doc_version_id, inherited, inherited_position)
    select p_unit_id, m.curriculum_doc_id,
           v_next + row_number() over (order by m.position, m.curriculum_doc_id),
           m.source, auth.uid(), m.doc_version_at_pick, m.curriculum_doc_version_id,
           true, m.position
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
      (unit_id, problem_id, position, source, created_by, problem_version_id,
       inherited, inherited_position)
    select p_unit_id, sp.problem_id,
           v_next + row_number() over (order by sp.position, sp.problem_id),
           sp.source, auth.uid(), sp.problem_version_id, true, sp.position
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

create or replace function public.inherit_unit_defaults_from_template(p_overlay_unit_id uuid)
returns table (keywords_added integer, materials_added integer, problems_added integer)
language plpgsql
as $$
declare
  v_teacher_unit_id uuid;
  v_catalog_unit_id uuid;
  v_prep_id uuid;
  v_kw int := 0;
  v_mat int := 0;
  v_prob int := 0;
  v_next int;
begin
  select p.teacher_unit_id, p.catalog_unit_id
    into v_teacher_unit_id, v_catalog_unit_id
  from public.overlay_unit_parent(p_overlay_unit_id) p;

  if v_teacher_unit_id is null and v_catalog_unit_id is null then
    return query select 0, 0, 0;
    return;
  end if;

  with ins as (
    insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id, inherited)
    select p_overlay_unit_id, k.keyword_id, true
    from (
      select keyword_id from teacher_curriculum_template_unit_keywords
      where unit_id = v_teacher_unit_id
      union
      select keyword_id from subject_template_unit_keywords
      where unit_id = v_catalog_unit_id
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
    where m.unit_id = v_teacher_unit_id
    union all
    select m.curriculum_doc_id, m.position, m.source, m.doc_version_at_pick, m.curriculum_doc_version_id
    from subject_template_unit_materials m
    where m.unit_id = v_catalog_unit_id
  ), ins as (
    insert into curriculum_overlay_unit_materials
      (overlay_unit_id, curriculum_doc_id, position, source, created_by,
       doc_version_at_pick, curriculum_doc_version_id, inherited, inherited_position)
    select p_overlay_unit_id, s.curriculum_doc_id,
           v_next + row_number() over (order by s.position, s.curriculum_doc_id),
           s.source, auth.uid(), s.doc_version_at_pick, s.curriculum_doc_version_id,
           true, s.position
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
    where p.unit_id = v_teacher_unit_id
    union all
    select p.problem_id, p.position, p.problem_version_id
    from subject_template_unit_problems p
    where p.unit_id = v_catalog_unit_id
  ), ins as (
    insert into curriculum_unit_prep_items
      (prep_id, content_type, content_id, position, problem_version_id,
       inherited, inherited_position)
    select v_prep_id, 'problem', s.problem_id,
           v_next + row_number() over (order by s.position, s.problem_id),
           s.problem_version_id, true, s.position
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
