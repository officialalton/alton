-- P2/P3 2차 잔여 — 초기 상속 자동화와 키워드 기반 교재 자동 구성.
--
-- 2026-09-12 정정: "기존 무키워드 회차에 임의 값을 채우지 않는다"를 "모든 초기
-- 상속을 수동화한다"로 읽었던 것이 틀렸다. 둘은 다른 이야기다.
--
--   초기 상속  = 관리자 기준본에서 교사 운영본을 **처음 만들 때** 자동으로 내려온다.
--   보정       = 이미 있는 회차에 나중에 값을 채우는 것. 이건 자동으로 하지 않는다.
--
-- 그래서 회차가 만들어지는 순간에는 자동으로 상속하고(아래 트리거), 이미 있는
-- 회차를 나중에 보충하는 것은 선생님이 명시적으로 부르는 보조 기능으로 남긴다
-- (inherit_unit_defaults_from_template, 20261308000000).

-- =========================================================================
-- 1. 키워드별 기본 교재의 순서
-- =========================================================================
-- 대표 키워드는 "이 교재가 어느 키워드의 기본 교재인가"를 말한다. 같은 키워드에
-- 여러 교재가 걸리면 순서가 필요하다.
alter table curriculum_docs add column primary_keyword_position int;

comment on column curriculum_docs.primary_keyword_position is
  'P2 2차: 대표 키워드 안에서의 기본 교재 순서. null이면 제목순으로 뒤에 붙는다.';

-- 키워드의 기본 교재 = 그 키워드를 대표 키워드로 가진 **공개된** 교재.
-- draft 교재는 학생에게 갈 수 없으므로 자동 구성에도 들어가지 않는다.
create view public.keyword_default_materials
with (security_invoker = true) as
select d.primary_keyword_id as keyword_id,
       d.id as curriculum_doc_id,
       d.title,
       d.subject_id,
       coalesce(d.primary_keyword_position, 1000000) as position
from curriculum_docs d
where d.primary_keyword_id is not null and d.status = 'published';

comment on view public.keyword_default_materials is
  'P2 2차: 키워드별 기본 교재. 회차에 키워드를 붙이면 여기 있는 교재가 자동으로 '
  '구성에 들어온다. published만 — draft는 학생에게 갈 수 없다.';

-- =========================================================================
-- 2. 자동으로 들어온 자료와 선생님이 고른 자료를 구분한다
-- =========================================================================
-- 구분이 없으면 키워드를 뗐을 때 무엇을 회수해야 하는지 알 수 없고, 자동 갱신이
-- 선생님의 손을 덮어쓰게 된다.
alter table curriculum_overlay_unit_materials
  add column source text not null default 'manual'
  check (source in ('auto', 'manual'));

comment on column curriculum_overlay_unit_materials.source is
  'P2 2차: auto = 회차 키워드에서 자동으로 들어온 것(키워드를 떼면 함께 빠진다). '
  'manual = 선생님이 직접 담은 것(자동 갱신이 건드리지 않는다). 기존 행은 전부 '
  'manual로 둔다 — 이미 선생님이 운영하던 구성을 자동 회수 대상으로 만들 수 없다.';

-- 선생님이 뺀 자동 자료. 이게 없으면 다음 동기화가 방금 뺀 것을 다시 넣는다.
create table curriculum_overlay_unit_material_exclusions (
  overlay_unit_id uuid not null references curriculum_overlay_units (id) on delete cascade,
  curriculum_doc_id uuid not null references curriculum_docs (id) on delete cascade,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  primary key (overlay_unit_id, curriculum_doc_id)
);

comment on table curriculum_overlay_unit_material_exclusions is
  'P2 2차: 선생님이 이 회차에서 뺀 교재. 자동 구성이 다시 넣지 않도록 기억한다. '
  '선생님이 같은 교재를 직접 다시 담으면 이 기록은 지워진다.';

alter table curriculum_overlay_unit_material_exclusions enable row level security;

create policy "담당 선생님·관리자만 제외 기록" on curriculum_overlay_unit_material_exclusions for all
  using (
    is_admin()
    or exists (
      select 1 from curriculum_overlay_units u
      join student_curriculum_overlays o on o.id = u.overlay_id
      where u.id = overlay_unit_id and is_active_teacher_for_enrollment(o.subject_enrollment_id)
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from curriculum_overlay_units u
      join student_curriculum_overlays o on o.id = u.overlay_id
      where u.id = overlay_unit_id and is_active_teacher_for_enrollment(o.subject_enrollment_id)
    )
  );

-- =========================================================================
-- 3. 키워드 → 교재 자동 구성
-- =========================================================================
-- 회차 키워드가 바뀔 때마다 자동분을 다시 맞춘다.
--
--   들어온다: 회차 키워드의 기본 교재 중, 아직 없고 제외되지도 않은 것 → source='auto'
--   빠진다  : source='auto'인데 더 이상 어떤 회차 키워드에도 걸리지 않는 것
--   안 건드린다: source='manual' — 선생님이 직접 담은 것은 키워드와 무관하다
--
-- 순서는 기존 행의 position을 그대로 두고 새 것만 뒤에 붙인다. 자동 갱신이
-- 선생님이 맞춰 둔 순서를 흔들면 안 된다.
create or replace function sync_unit_auto_materials(p_overlay_unit_id uuid)
returns table (added int, removed int)
language plpgsql
as $$
declare
  v_added int := 0;
  v_removed int := 0;
  v_next int;
begin
  with gone as (
    delete from curriculum_overlay_unit_materials m
    where m.overlay_unit_id = p_overlay_unit_id
      and m.source = 'auto'
      and not exists (
        select 1
        from curriculum_overlay_unit_keywords uk
        join keyword_default_materials kdm on kdm.keyword_id = uk.keyword_id
        where uk.overlay_unit_id = p_overlay_unit_id
          and kdm.curriculum_doc_id = m.curriculum_doc_id
      )
    returning 1
  )
  select count(*) into v_removed from gone;

  select coalesce(max(position), 0) into v_next
  from curriculum_overlay_unit_materials where overlay_unit_id = p_overlay_unit_id;

  with candidates as (
    select distinct kdm.curriculum_doc_id, min(kdm.position) as position, min(kdm.title) as title
    from curriculum_overlay_unit_keywords uk
    join keyword_default_materials kdm on kdm.keyword_id = uk.keyword_id
    where uk.overlay_unit_id = p_overlay_unit_id
      and not exists (
        select 1 from curriculum_overlay_unit_materials e
        where e.overlay_unit_id = p_overlay_unit_id and e.curriculum_doc_id = kdm.curriculum_doc_id
      )
      and not exists (
        select 1 from curriculum_overlay_unit_material_exclusions x
        where x.overlay_unit_id = p_overlay_unit_id and x.curriculum_doc_id = kdm.curriculum_doc_id
      )
    group by kdm.curriculum_doc_id
  ), ins as (
    insert into curriculum_overlay_unit_materials
      (overlay_unit_id, curriculum_doc_id, position, source, created_by)
    select p_overlay_unit_id, c.curriculum_doc_id,
           v_next + row_number() over (order by c.position, c.title),
           'auto', auth.uid()
    from candidates c
    on conflict do nothing
    returning 1
  )
  select count(*) into v_added from ins;

  return query select v_added, v_removed;
end;
$$;

comment on function sync_unit_auto_materials(uuid) is
  'P2 2차: 회차 키워드의 기본 교재를 구성에 맞춘다. source=manual과 선생님이 뺀 '
  '교재는 건드리지 않고, 기존 행의 순서도 그대로 둔다.';

-- 키워드를 붙이거나 떼면 바로 반영한다. 선생님이 따로 버튼을 누르지 않아도 된다.
create or replace function curriculum_overlay_unit_keywords_sync_materials()
returns trigger language plpgsql as $$
begin
  perform sync_unit_auto_materials(coalesce(new.overlay_unit_id, old.overlay_unit_id));
  return null;
end;
$$;

create trigger curriculum_overlay_unit_keywords_sync
  after insert or delete on curriculum_overlay_unit_keywords
  for each row execute function curriculum_overlay_unit_keywords_sync_materials();

-- =========================================================================
-- 4. 초기 상속 — 회차가 만들어지는 순간 자동으로
-- =========================================================================
-- 관리자 기준본에서 갈라져 나온 회차는 만들어질 때 기본 키워드를 받는다.
-- 키워드가 들어가면 위 트리거가 기본 교재까지 이어서 채운다.
--
-- 이미 있는 회차는 건드리지 않는다 — 이 트리거는 INSERT에서만 돈다. 기존에
-- 개별 조정된 구성은 그대로 보존된다.
create or replace function curriculum_overlay_units_inherit_defaults()
returns trigger language plpgsql as $$
begin
  if new.source_unit_id is null then
    return null;
  end if;

  insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id, created_by)
  select new.id, tuk.keyword_id, auth.uid()
  from subject_template_unit_keywords tuk
  where tuk.unit_id = new.source_unit_id
  on conflict do nothing;

  -- 관리자가 이 단원에 직접 붙여 둔 교재도 함께 내려온다. 키워드에서 오는
  -- 자동분과 달리 이건 단원에 명시적으로 매달린 것이라 manual로 둔다 —
  -- 키워드를 떼도 사라지면 안 된다.
  insert into curriculum_overlay_unit_materials
    (overlay_unit_id, curriculum_doc_id, source, created_by)
  select new.id, tum.curriculum_doc_id, 'manual', auth.uid()
  from subject_template_unit_materials tum
  join curriculum_docs d on d.id = tum.curriculum_doc_id
  where tum.unit_id = new.source_unit_id and d.status = 'published'
  on conflict do nothing;

  return null;
end;
$$;

create trigger curriculum_overlay_units_inherit
  after insert on curriculum_overlay_units
  for each row execute function curriculum_overlay_units_inherit_defaults();

-- ensure_active_curriculum_overlay()의 키워드·교재 시딩은 이제 위 트리거가
-- 한다. 같은 일을 두 곳에서 하면 중복 삽입으로 깨지므로, 함수 쪽 시딩을 걷어낸다
-- (단원 생성 자체는 그대로 — 트리거가 그 INSERT에 붙어 돈다).
create or replace function public.ensure_active_curriculum_overlay(p_subject_enrollment_id uuid)
returns uuid
language plpgsql as $$
declare
  v_overlay_id uuid;
  v_subject_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_subject_enrollment_id::text, 42));

  select id into v_overlay_id
  from student_curriculum_overlays
  where subject_enrollment_id = p_subject_enrollment_id and status = 'active';

  if v_overlay_id is not null then
    return v_overlay_id;
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

  select subject_id into v_subject_id
  from subject_enrollments
  where id = p_subject_enrollment_id;

  if v_subject_id is null then
    raise exception '존재하지 않는 subject_enrollment 입니다.';
  end if;

  -- 베이스라인 단원. 키워드·교재 상속은 curriculum_overlay_units_inherit 트리거가
  -- 이 INSERT에 이어서 처리한다.
  insert into curriculum_overlay_units
    (overlay_id, source_unit_id, position, unit_title, note, created_by)
  select v_overlay_id, u.id, u.position, u.unit_title, u.note, auth.uid()
  from subject_template_units u
  where u.subject_id = v_subject_id
  order by u.position;

  return v_overlay_id;
end;
$$;
