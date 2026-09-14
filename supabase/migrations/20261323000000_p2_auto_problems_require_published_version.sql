-- P2 5차 정정 — 자동 문제 구성 후보를 **공개된 문제**로 좁힌다.
--
-- 2026-09-13 제품 오너 지적: "후보의 '확정' 상태가 실제 공개 상태를 뜻하는지
-- 확인해주세요. 검수됐어도 비공개인 문제나 AI 초안이 신규 구성에 들어가서는
-- 안 됩니다."
--
-- 확인 결과 지적이 맞다. 두 축이 따로 있다:
--
--   problems.status           'draft' | 'confirmed'            (오래된 축)
--   problem_versions.status   'draft' | 'in_review' |
--                             'published' | 'archived'          (실제 검수·공개 흐름,
--                                                                20261293000000)
--
-- `problem_versions_one_published` 부분 unique 인덱스가 문제당 공개본 1개를 보장하고,
-- problem_versions 의 조회 정책도 **공개본과 고정된 버전만** 열어 준다(20261297000000).
--
-- 그런데 problem_keywords_selectable 은 `problems.status = 'confirmed'` 만 본다.
-- 그래서 공개 버전이 하나도 없는 문제 — 검수 중이거나 AI가 만든 초안 — 도 후보로
-- 잡힌다. 그런 문제는 **내용을 읽을 수조차 없으므로** 구성에 들어가면 빈 자리가 된다.
--
-- 확정 정책 "자동 공개 없음"과도 어긋난다: 사람이 공개를 누르지 않은 문제가
-- 자동 구성을 타고 학생 쪽으로 흘러가면 안 된다.
--
-- 공유 뷰(problem_keywords_selectable)는 건드리지 않는다. 다른 선택 경로들이 그것을
-- 쓰고 있어 지금 바꾸면 영향 범위가 이 작업을 넘어선다 — 별도 항목으로 남긴다.
-- 여기서는 **자동 구성이 쓰는 후보만** 좁힌다(더 엄격한 쪽으로만 바꾼다).

create or replace view public.problem_auto_composition_candidates
with (security_invoker = true) as
select pk.problem_id, pk.keyword_id, p.format, p.difficulty, p.created_at
from problem_keywords_selectable pk
join problems p on p.id = pk.problem_id
where exists (
  select 1 from problem_versions v
  where v.problem_id = pk.problem_id and v.status = 'published'
);

comment on view public.problem_auto_composition_candidates is
  'P2 5차: 자동 문제 구성의 후보. 확정·미보관에 더해 **공개된 버전이 있는 문제만**. '
  '검수 중이거나 AI가 만든 초안은 사람이 공개를 누르기 전까지 들어오지 않는다.';

-- 두 sync 함수를 새 후보 뷰로 갈아끼운다. 다른 규칙은 20261321000000 그대로다.
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
begin
  select formats, difficulties, target_count
    into v_formats, v_difficulties, v_target
  from subject_template_unit_problem_criteria where unit_id = p_unit_id;

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
    select case
      when v_target is null then null
      else greatest(
        v_target - (select count(*) from subject_template_unit_problems
                    where unit_id = p_unit_id and source = 'auto'),
        0)
    end as slots
  ), picked as (
    select c.problem_id, c.created_at
    from candidates c, room r
    where r.slots is null or r.slots > 0
    order by c.created_at, c.problem_id
    limit (select case when slots is null then 1000000 else slots end from room)
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
begin
  select formats, difficulties, target_count
    into v_formats, v_difficulties, v_target
  from teacher_curriculum_template_unit_problem_criteria where unit_id = p_unit_id;

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
    select case
      when v_target is null then null
      else greatest(
        v_target - (select count(*) from teacher_curriculum_template_unit_problems
                    where unit_id = p_unit_id and source = 'auto'),
        0)
    end as slots
  ), picked as (
    select c.problem_id, c.created_at
    from candidates c, room r
    where r.slots is null or r.slots > 0
    order by c.created_at, c.problem_id
    limit (select case when slots is null then 1000000 else slots end from room)
  ), ins as (
    insert into teacher_curriculum_template_unit_problems
      (unit_id, problem_id, position, source, created_by)
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
