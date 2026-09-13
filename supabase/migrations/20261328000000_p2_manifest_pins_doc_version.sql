-- P2 6차 — 고정된 교재가 "어느 버전이었는지"를 매니페스트에 남긴다.
--
-- 20261327000000 이 교재 내용을 버전 행에 보존하게 했지만, 과거 수업이 그 버전을
-- 가리키지 않으면 소용이 없다. 지금 매니페스트에는 published_doc_version_at_pin
-- (시각)만 있고, 화면은 살아 있는 curriculum_doc_sections 를 id 로 읽는다.
--
-- pin_session_selection 은 크고 인가·재검증이 얽혀 있어 통째로 다시 쓰지 않는다.
-- 대신 매니페스트 행이 들어올 때 준비안이 들고 있던 버전을 옮겨 적는다.
--
-- **소급 연결은 하지 않는다.** 이미 있는 매니페스트 행은 그대로 둔다 — 그때 어떤
-- 버전을 봤는지 알 수 없고, current_content_baseline 을 과거 수업에 붙이는 것은
-- 확정 기준에서 금지돼 있다.

alter table session_content_manifest
  add column curriculum_doc_version_id uuid references curriculum_doc_versions (id);

comment on column session_content_manifest.curriculum_doc_version_id is
  'P2 6차: 이 수업이 쓴 교재 버전 행. 내용이 그 행에 보존돼 있으므로 이후 교재를 '
  '고쳐도 이 수업의 화면은 바뀌지 않는다. null 은 스냅샷 제도 이전에 고정된 것이라 '
  '당시 내용을 확인할 수 없다 — 현재 내용으로 대체하지 않는다.';

-- 준비안이 들고 있던 버전을 그대로 옮긴다. 여기서 "지금의 최신본"을 새로 집지
-- 않는다 — 그러면 준비 화면에서 보던 것과 다른 내용이 고정된다.
create or replace function public.fill_manifest_doc_version()
returns trigger
language plpgsql as $$
begin
  if new.curriculum_doc_version_id is not null then
    return new;
  end if;

  if new.content_type = 'material_doc' and new.source_overlay_unit_id is not null then
    select m.curriculum_doc_version_id into new.curriculum_doc_version_id
    from curriculum_overlay_unit_materials m
    where m.overlay_unit_id = new.source_overlay_unit_id
      and m.curriculum_doc_id = new.content_id;

  elsif new.content_type = 'material_section' and new.source_overlay_unit_id is not null then
    -- 조각 단위로 고정된 과거 방식. 그 조각이 속한 교재의 버전을 찾는다.
    select m.curriculum_doc_version_id into new.curriculum_doc_version_id
    from curriculum_doc_sections s
    join curriculum_overlay_unit_materials m
      on m.curriculum_doc_id = s.curriculum_doc_id
     and m.overlay_unit_id = new.source_overlay_unit_id
    where s.id = new.content_id;
  end if;

  return new;
end;
$$;

create trigger session_content_manifest_fill_doc_version
  before insert on session_content_manifest
  for each row execute function public.fill_manifest_doc_version();

-- =========================================================================
-- 미기록 집계 — 무엇이 왜 비어 있는지 구분한다
-- =========================================================================
-- 2026-09-13 지시: "'참조 자체가 없음 / 참조한 버전이 없음 / 스냅샷 내용이
-- 불완전함'을 구분해주세요."
--
--   no_reference        버전을 가리키지 않는다(스냅샷 제도 이전에 담긴 것)
--   version_missing     가리키는 버전 행이 사라졌다
--   snapshot_incomplete 버전은 있는데 스냅샷에 섹션이 없다
--   ok                  보존돼 있다
create or replace view public.prep_version_coverage
with (security_invoker = true) as
with material_rows as (
  select 'catalog'::text as layer, 'material'::text as kind,
         m.curriculum_doc_version_id as version_id
  from subject_template_unit_materials m
  union all
  select 'teacher', 'material', m.curriculum_doc_version_id
  from teacher_curriculum_template_unit_materials m
  union all
  select 'student', 'material', m.curriculum_doc_version_id
  from curriculum_overlay_unit_materials m
  union all
  select 'session', 'material', m.curriculum_doc_version_id
  from session_content_manifest m
  where m.content_type in ('material_doc', 'material_section')
),
material_state as (
  select r.layer, r.kind,
    case
      when r.version_id is null then 'no_reference'
      when v.id is null then 'version_missing'
      when coalesce(jsonb_array_length(v.snapshot->'sections'), 0) = 0 then 'snapshot_incomplete'
      else 'ok'
    end as state
  from material_rows r
  left join curriculum_doc_versions v on v.id = r.version_id
),
problem_rows as (
  select 'catalog'::text as layer, 'problem'::text as kind, p.problem_version_id as version_id
  from subject_template_unit_problems p
  union all
  select 'teacher', 'problem', p.problem_version_id
  from teacher_curriculum_template_unit_problems p
  union all
  select 'student', 'problem', i.problem_version_id
  from curriculum_unit_prep_items i where i.content_type = 'problem'
  union all
  select 'session', 'problem', m.problem_version_id
  from session_content_manifest m where m.content_type = 'problem'
),
problem_state as (
  select r.layer, r.kind,
    case
      when r.version_id is null then 'no_reference'
      when v.id is null then 'version_missing'
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
  'P2 6차: 계층별·교재/문제별로 버전이 기록됐는지. 비어 있는 이유를 참조 없음 / 버전 '
  '없음 / 스냅샷 불완전으로 구분한다. 읽기 전용 집계다.';
