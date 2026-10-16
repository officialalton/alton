-- P2 4차 — 관리자 기준본 층도 선생님·학생 층과 같은 모양으로 맞춘다.
--
-- 2026-09-13 지시 4·5절: 세 계층이 **같은 UI를 재사용**하고, 키워드에 따라 교재가
-- 자동 구성되는 것이 기본 흐름이다. 그런데 지금은 층마다 교재 테이블의 모양이
-- 다르다:
--
--   subject_template_unit_materials            (unit_id, curriculum_doc_id, position)
--   teacher_curriculum_template_unit_materials (… + source, created_by, created_at)   ← 20261317
--   curriculum_overlay_unit_materials          (… + source, created_by, created_at)   ← 20261309
--
-- 관리자 기준본만 source가 없어서, 같은 화면이 "자동으로 들어온 것"과 "직접 담은 것"을
-- 구분해 보여줄 수 없다. 세 번째 층을 나머지 둘에 맞춘다.
--
-- 유지하는 정책은 앞의 두 층과 같다:
--   - 기존 행은 전부 manual — 이미 관리자가 붙여 둔 교재를 자동 회수 대상으로 만들지 않는다
--   - source='manual'과 제외 기록, 사람이 맞춘 순서는 자동 갱신이 건드리지 않는다

alter table subject_template_unit_materials
  add column source text not null default 'manual' check (source in ('auto', 'manual'));

comment on column subject_template_unit_materials.source is
  'P2 4차: auto = 단원 키워드에서 자동으로 들어온 것(키워드를 떼면 함께 빠진다). '
  'manual = 관리자가 직접 담은 것(자동 갱신이 건드리지 않는다).';

create table subject_template_unit_material_exclusions (
  unit_id uuid not null references subject_template_units (id) on delete cascade,
  curriculum_doc_id uuid not null references curriculum_docs (id) on delete cascade,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  primary key (unit_id, curriculum_doc_id)
);

comment on table subject_template_unit_material_exclusions is
  'P2 4차: 관리자가 이 단원에서 뺀 교재. 자동 구성이 다시 넣지 않도록 기억한다.';

alter table subject_template_unit_material_exclusions enable row level security;

-- 기준본은 관리자만 쓴다. 조회는 인증 사용자 전체에게 열어 둔다 —
-- subject_template_unit_keywords(20261228000000)와 같은 모양이다.
create policy "인증된 사용자 전체 조회" on subject_template_unit_material_exclusions for select
  using (auth.uid() is not null);
create policy "관리자만 쓰기" on subject_template_unit_material_exclusions for all
  using (is_admin()) with check (is_admin());

-- 키워드 → 기본 교재 자동 구성. 앞의 두 층과 같은 규칙이다.
create or replace function sync_catalog_unit_auto_materials(p_unit_id uuid)
returns table (added int, removed int)
language plpgsql
as $$
declare
  v_added int := 0;
  v_removed int := 0;
  v_next int;
begin
  with gone as (
    delete from subject_template_unit_materials m
    where m.unit_id = p_unit_id
      and m.source = 'auto'
      and not exists (
        select 1
        from subject_template_unit_keywords uk
        join keyword_default_materials kdm on kdm.keyword_id = uk.keyword_id
        where uk.unit_id = p_unit_id
          and kdm.curriculum_doc_id = m.curriculum_doc_id
      )
    returning 1
  )
  select count(*) into v_removed from gone;

  select coalesce(max(position), 0) into v_next
  from subject_template_unit_materials where unit_id = p_unit_id;

  with candidates as (
    select kdm.curriculum_doc_id, min(kdm.position) as position, min(kdm.title) as title
    from subject_template_unit_keywords uk
    join keyword_default_materials kdm on kdm.keyword_id = uk.keyword_id
    where uk.unit_id = p_unit_id
      and not exists (
        select 1 from subject_template_unit_materials e
        where e.unit_id = p_unit_id and e.curriculum_doc_id = kdm.curriculum_doc_id
      )
      and not exists (
        select 1 from subject_template_unit_material_exclusions x
        where x.unit_id = p_unit_id and x.curriculum_doc_id = kdm.curriculum_doc_id
      )
    group by kdm.curriculum_doc_id
  ), ins as (
    insert into subject_template_unit_materials (unit_id, curriculum_doc_id, position, source)
    select p_unit_id, c.curriculum_doc_id,
           v_next + row_number() over (order by c.position, c.title),
           'auto'
    from candidates c
    on conflict do nothing
    returning 1
  )
  select count(*) into v_added from ins;

  return query select v_added, v_removed;
end;
$$;

comment on function sync_catalog_unit_auto_materials(uuid) is
  'P2 4차: 관리자 기준본 단원의 키워드에 맞춰 기본 교재를 맞춘다. source=manual과 '
  '관리자가 뺀 교재는 건드리지 않고, 기존 행의 순서도 그대로 둔다.';

create or replace function subject_template_unit_keywords_sync_materials()
returns trigger language plpgsql as $$
begin
  perform sync_catalog_unit_auto_materials(coalesce(new.unit_id, old.unit_id));
  return null;
end;
$$;

create trigger subject_template_unit_keywords_sync
  after insert or delete on subject_template_unit_keywords
  for each row execute function subject_template_unit_keywords_sync_materials();
