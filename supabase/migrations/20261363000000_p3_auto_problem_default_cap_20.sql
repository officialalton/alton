-- 2026-09-14 UAT(제품 오너): "키워드 붙으면 커리에 다 담기게 되어 있는데, 기본 캡을 두면 좋을 듯 해. 20개로."
--
-- 자동 문제 구성은 회차당 **자동분 20개**를 기본 상한으로 한다. 회차 기준(target_count)을
-- 사람이 정했으면 그 수가 상한이다(기존 그대로). 정하지 않았을 때만 20 이 적용된다.
--
--   * 상한은 자동분에만 센다 — 사람이 직접 담은 문제는 세지 않는다(20261321 정책 유지).
--   * 이미 20개를 넘게 담긴 회차는 **지우지 않는다**. 상한은 새로 들어오는 것만 막는다.
--     (기존 데이터를 줄이는 건 파괴적이라 별도 결정 사항.)
--   * 고르는 순서는 그대로 — 문제 생성 시각(created_at) 오름차순, 같으면 id.
--   * 학생 층은 부모(관리자 기준본·선생님 기본 구성) 목록을 그대로 물려받으므로 부모가
--     20개로 잡히면 학생 회차도 20개로 시작한다.
--
-- 두 함수 본문은 20261323 과 같고 room 계산에서 coalesce(v_target, 20) 만 달라진다.

create or replace function sync_catalog_unit_auto_problems(p_unit_id uuid)
returns table (added int, removed int, available int)
language plpgsql
as $$
declare
  v_added int := 0;
  v_removed int := 0;
  v_available int := 0;
  v_next int;
  v_formats text[];
  v_difficulties text[];
  v_target int;
  v_cap int;
begin
  select formats, difficulties, target_count
    into v_formats, v_difficulties, v_target
  from subject_template_unit_problem_criteria where unit_id = p_unit_id;
  v_cap := coalesce(v_target, 20);

  select count(*) into v_available
  from problem_auto_composition_candidates c
  where c.keyword_id in (
      select keyword_id from subject_template_unit_keywords where unit_id = p_unit_id
    )
    and (v_formats is null or c.format::text = any (v_formats))
    and (v_difficulties is null or c.difficulty::text = any (v_difficulties));

  with gone as (
    delete from subject_template_unit_problems m
    where m.unit_id = p_unit_id
      and m.source = 'auto'
      and not exists (
        select 1 from problem_auto_composition_candidates c
        where c.problem_id = m.problem_id
          and c.keyword_id in (
            select keyword_id from subject_template_unit_keywords where unit_id = p_unit_id
          )
          and (v_formats is null or c.format::text = any (v_formats))
          and (v_difficulties is null or c.difficulty::text = any (v_difficulties))
      )
    returning 1
  )
  select count(*) into v_removed from gone;

  select coalesce(max(position), 0) into v_next
  from subject_template_unit_problems where unit_id = p_unit_id;

  with candidates as (
    select distinct c.problem_id, c.created_at
    from problem_auto_composition_candidates c
    where c.keyword_id in (
        select keyword_id from subject_template_unit_keywords where unit_id = p_unit_id
      )
      and (v_formats is null or c.format::text = any (v_formats))
      and (v_difficulties is null or c.difficulty::text = any (v_difficulties))
      and not exists (
        select 1 from subject_template_unit_problems e
        where e.unit_id = p_unit_id and e.problem_id = c.problem_id
      )
      and not exists (
        select 1 from subject_template_unit_problem_exclusions x
        where x.unit_id = p_unit_id and x.problem_id = c.problem_id
      )
  ), room as (
    select greatest(
      v_cap - (select count(*) from subject_template_unit_problems
               where unit_id = p_unit_id and source = 'auto'),
      0) as slots
  ), picked as (
    select c.problem_id, c.created_at
    from candidates c, room r
    where r.slots > 0
    order by c.created_at, c.problem_id
    limit (select slots from room)
  ), ins as (
    insert into subject_template_unit_problems (unit_id, problem_id, position, source, created_by)
    select p_unit_id, pk.problem_id,
           v_next + row_number() over (order by pk.created_at, pk.problem_id),
           'auto', auth.uid()
    from picked pk
    on conflict do nothing
    returning 1
  )
  select count(*) into v_added from ins;

  return query select v_added, v_removed, v_available;
end;
$$;

create or replace function sync_teacher_unit_auto_problems(p_unit_id uuid)
returns table (added int, removed int, available int)
language plpgsql
as $$
declare
  v_added int := 0;
  v_removed int := 0;
  v_available int := 0;
  v_next int;
  v_formats text[];
  v_difficulties text[];
  v_target int;
  v_cap int;
begin
  select formats, difficulties, target_count
    into v_formats, v_difficulties, v_target
  from teacher_curriculum_template_unit_problem_criteria where unit_id = p_unit_id;
  v_cap := coalesce(v_target, 20);

  select count(*) into v_available
  from problem_auto_composition_candidates c
  where c.keyword_id in (
      select keyword_id from teacher_curriculum_template_unit_keywords where unit_id = p_unit_id
    )
    and (v_formats is null or c.format::text = any (v_formats))
    and (v_difficulties is null or c.difficulty::text = any (v_difficulties));

  with gone as (
    delete from teacher_curriculum_template_unit_problems m
    where m.unit_id = p_unit_id
      and m.source = 'auto'
      and not exists (
        select 1 from problem_auto_composition_candidates c
        where c.problem_id = m.problem_id
          and c.keyword_id in (
            select keyword_id from teacher_curriculum_template_unit_keywords where unit_id = p_unit_id
          )
          and (v_formats is null or c.format::text = any (v_formats))
          and (v_difficulties is null or c.difficulty::text = any (v_difficulties))
      )
    returning 1
  )
  select count(*) into v_removed from gone;

  select coalesce(max(position), 0) into v_next
  from teacher_curriculum_template_unit_problems where unit_id = p_unit_id;

  with candidates as (
    select distinct c.problem_id, c.created_at
    from problem_auto_composition_candidates c
    where c.keyword_id in (
        select keyword_id from teacher_curriculum_template_unit_keywords where unit_id = p_unit_id
      )
      and (v_formats is null or c.format::text = any (v_formats))
      and (v_difficulties is null or c.difficulty::text = any (v_difficulties))
      and not exists (
        select 1 from teacher_curriculum_template_unit_problems e
        where e.unit_id = p_unit_id and e.problem_id = c.problem_id
      )
      and not exists (
        select 1 from teacher_curriculum_template_unit_problem_exclusions x
        where x.unit_id = p_unit_id and x.problem_id = c.problem_id
      )
  ), room as (
    select greatest(
      v_cap - (select count(*) from teacher_curriculum_template_unit_problems
               where unit_id = p_unit_id and source = 'auto'),
      0) as slots
  ), picked as (
    select c.problem_id, c.created_at
    from candidates c, room r
    where r.slots > 0
    order by c.created_at, c.problem_id
    limit (select slots from room)
  ), ins as (
    insert into teacher_curriculum_template_unit_problems (unit_id, problem_id, position, source, created_by)
    select p_unit_id, pk.problem_id,
           v_next + row_number() over (order by pk.created_at, pk.problem_id),
           'auto', auth.uid()
    from picked pk
    on conflict do nothing
    returning 1
  )
  select count(*) into v_added from ins;

  return query select v_added, v_removed, v_available;
end;
$$;

comment on function sync_catalog_unit_auto_problems(uuid) is
  '키워드 자동 문제 구성(관리자 기준본). 자동분 상한 = target_count, 없으면 기본 20 (2026-09-14).';
comment on function sync_teacher_unit_auto_problems(uuid) is
  '키워드 자동 문제 구성(선생님 기본 구성). 자동분 상한 = target_count, 없으면 기본 20 (2026-09-14).';
