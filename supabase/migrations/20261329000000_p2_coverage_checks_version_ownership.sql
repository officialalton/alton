-- P2 6차 정정 — 집계의 '정상' 판정에 **소속 확인**을 넣는다.
--
-- 2026-09-13 지시: "정상 판정에는 버전 존재뿐 아니라 해당 교재·문제의 버전인지도
-- 포함해야 합니다."
--
-- 20261328000000 의 prep_version_coverage 는 버전 행이 존재하는지만 봤다. 다른
-- 교재의 버전을 가리켜도 '정상'으로 셌다. 쓰기 가드가 소속을 막고 있지만, 가드가
-- 생기기 전에 들어온 행이 있을 수 있고 집계는 그런 것을 드러내야 한다.
--
-- 상태를 하나 더 둔다:
--   version_mismatch  가리키는 버전이 그 교재·문제의 것이 아니다

create or replace view public.prep_version_coverage
with (security_invoker = true) as
with material_rows as (
  select 'catalog'::text as layer, 'material'::text as kind,
         m.curriculum_doc_id as owner_id, m.curriculum_doc_version_id as version_id
  from subject_template_unit_materials m
  union all
  select 'teacher', 'material', m.curriculum_doc_id, m.curriculum_doc_version_id
  from teacher_curriculum_template_unit_materials m
  union all
  select 'student', 'material', m.curriculum_doc_id, m.curriculum_doc_version_id
  from curriculum_overlay_unit_materials m
  union all
  -- 매니페스트의 material_section 은 content_id 가 섹션이라 교재를 되짚는다.
  select 'session', 'material',
         case
           when m.content_type = 'material_doc' then m.content_id
           else (select s.curriculum_doc_id from curriculum_doc_sections s where s.id = m.content_id)
         end,
         m.curriculum_doc_version_id
  from session_content_manifest m
  where m.content_type in ('material_doc', 'material_section')
),
material_state as (
  select r.layer, r.kind,
    case
      when r.version_id is null then 'no_reference'
      when v.id is null then 'version_missing'
      when r.owner_id is null or v.curriculum_doc_id <> r.owner_id then 'version_mismatch'
      when coalesce(jsonb_array_length(v.snapshot->'sections'), 0) = 0 then 'snapshot_incomplete'
      else 'ok'
    end as state
  from material_rows r
  left join curriculum_doc_versions v on v.id = r.version_id
),
problem_rows as (
  select 'catalog'::text as layer, 'problem'::text as kind,
         p.problem_id as owner_id, p.problem_version_id as version_id
  from subject_template_unit_problems p
  union all
  select 'teacher', 'problem', p.problem_id, p.problem_version_id
  from teacher_curriculum_template_unit_problems p
  union all
  select 'student', 'problem', i.content_id, i.problem_version_id
  from curriculum_unit_prep_items i where i.content_type = 'problem'
  union all
  select 'session', 'problem', m.content_id, m.problem_version_id
  from session_content_manifest m where m.content_type = 'problem'
),
problem_state as (
  select r.layer, r.kind,
    case
      when r.version_id is null then 'no_reference'
      when v.id is null then 'version_missing'
      when v.problem_id <> r.owner_id then 'version_mismatch'
      when coalesce(v.passage, '') = '' and coalesce(v.explanation, '') = '' then 'snapshot_incomplete'
      else 'ok'
    end as state
  from problem_rows r
  left join problem_versions v on v.id = r.version_id
)
select layer, kind, state, count(*)::bigint as rows
from (select * from material_state union all select * from problem_state) s
group by layer, kind, state;

comment on view public.prep_version_coverage is
  'P2 6차: 계층별·교재/문제별로 버전이 기록됐는지. 참조 없음 / 버전 없음 / **소속 불일치** / '
  '스냅샷 불완전 / 정상을 구분한다. 집계 단위는 교재 수가 아니라 구성 행 수다.';
