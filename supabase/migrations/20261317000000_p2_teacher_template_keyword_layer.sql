-- P2 3차 — 관리자 기준본 → 선생님 기본 템플릿 → 학생별 운영본의 세 계층을 잇는다.
--
-- 2026-09-13 지시: "모든 계층에 회차 키워드와 기본 구성이 이어져야 한다. 선생님이
-- 같은 키워드를 다시 지정해야 하는 흐름을 없앤다."
--
-- 지금까지의 구조에서 가운데 층이 끊겨 있었다:
--
--   subject_template_units            (관리자 기준본) ─ 키워드 O, 교재 O
--   teacher_curriculum_template_units (선생님 기본)   ─ 키워드 X, 관리자와의 연결 X
--   curriculum_overlay_units          (학생별 운영본) ─ 키워드 O, 교재 O
--                                        └ source_unit_id 가 **관리자 기준본을 직접** 참조
--
-- 그래서 선생님 기본 템플릿은 제목·메모만 한 번 복사해 온 막다른 가지였고,
-- 학생 운영본은 선생님이 기본 템플릿에서 무엇을 정했든 무시한 채 관리자 기준본에서
-- 바로 시딩됐다. 선생님은 배정받은 학생마다 키워드를 다시 찍어야 했다.
--
-- 이 마이그레이션이 하는 일:
--   1. 선생님 기본 템플릿 회차에 관리자 기준본 회차로의 연결(source_unit_id)을 준다.
--   2. 선생님 층에 키워드 테이블을 신설한다.
--   3. 회차가 만들어질 때 관리자 기준본에서 자동으로 상속한다(초기 상속 = 자동).
--   4. 이미 있는 회차를 나중에 채우는 것은 선생님이 명시적으로 부른다(보정 = 수동).
--   5. 학생 운영본 시딩이 선생님 층을 거치게 한다. 선생님 층이 없으면 관리자 기준본.
--   6. 상속으로 들어오는 교재의 순서를 결정적으로 고정한다.
--
-- 6번은 이번에 드러난 기존 버그다. assign_unit_material_position 트리거가 삽입되는
-- 순서대로 position을 매기는데, 상속 INSERT ... SELECT에 ORDER BY가 없어서 회차에
-- 딸려 오는 교재의 순서가 실행할 때마다 달라졌다. 화면에 보이는 교재 차례가 학생마다
-- 뒤죽박죽이 되고, unit-defaults-inheritance 회귀 테스트도 이것 때문에 간헐적으로
-- 실패했다(같은 DB 상태에서 3회 중 1회). 기준본에 매겨진 순서를 그대로 따르게 한다.
--
-- 유지하는 확정 정책:
--   - 초기 상속은 자동, 보정은 수동 (20261309000000에서 확정)
--   - 자동 갱신이 사람 손을 덮어쓰지 않는다 — source='manual'·제외 기록·선생님이
--     맞춘 순서는 건드리지 않는다
--   - 근거 없이 기존 빈 값을 일괄로 채우지 않는다 — 아래 backfill은 "연결"만 복원하고
--     키워드·교재를 임의로 넣지 않는다

-- =========================================================================
-- 1. 선생님 기본 템플릿 회차 → 관리자 기준본 회차 연결
-- =========================================================================
alter table teacher_curriculum_template_units
  add column source_unit_id uuid references subject_template_units (id) on delete set null;

create index on teacher_curriculum_template_units (source_unit_id);

comment on column teacher_curriculum_template_units.source_unit_id is
  'P2 3차: 이 회차가 갈라져 나온 관리자 기준본 회차. null이면 선생님이 직접 추가한 '
  '보충 회차라 물려받을 기본이 없다. 학생 운영본과 같은 의미의 연결이다.';

-- 이미 있는 회차의 연결을 복원한다. createMyTemplate/assignTeacherSubject이 관리자
-- 기준본을 position 순서 그대로 복사해 왔으므로 (subject_id, position)으로 되짚을 수
-- 있다. **제목까지 같은 것만** 잇는다 — 선생님이 회차를 지우거나 순서를 바꿔 놓았다면
-- position이 밀려 엉뚱한 단원에 붙을 수 있고, 잘못 이은 연결은 그 뒤의 모든 상속을
-- 오염시킨다. 확신이 없는 행은 null로 남겨 두고 선생님이 화면에서 직접 잇게 한다.
update teacher_curriculum_template_units tu
set source_unit_id = su.id
from teacher_curriculum_templates t
join subject_template_units su on su.subject_id = t.subject_id
where tu.template_id = t.id
  and su.position = tu.position
  and su.unit_title = tu.unit_title
  and tu.source_unit_id is null;

-- =========================================================================
-- 2. 선생님 층 키워드
-- =========================================================================
create table teacher_curriculum_template_unit_keywords (
  unit_id uuid not null references teacher_curriculum_template_units (id) on delete cascade,
  keyword_id uuid not null references subject_keywords (id) on delete cascade,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  primary key (unit_id, keyword_id)
);
create index on teacher_curriculum_template_unit_keywords (keyword_id);

comment on table teacher_curriculum_template_unit_keywords is
  'P2 3차: 선생님 기본 템플릿 회차의 키워드. 관리자 기준본에서 초기 상속되고, '
  '선생님이 자기 기본 구성으로 고칠 수 있다. 학생 운영본은 여기서 시딩된다.';

-- 회차와 키워드의 과목이 어긋나면 막는다 — 관리자 층(check_unit_keyword_same_subject)과
-- 같은 보호다. 선생님 층은 과목을 templates를 거쳐 찾는다.
create or replace function public.check_teacher_unit_keyword_same_subject()
returns trigger
language plpgsql as $$
declare
  v_unit_subject uuid;
  v_keyword_subject uuid;
begin
  select t.subject_id into v_unit_subject
  from teacher_curriculum_template_units u
  join teacher_curriculum_templates t on t.id = u.template_id
  where u.id = new.unit_id;

  select subject_id into v_keyword_subject from subject_keywords where id = new.keyword_id;

  if v_unit_subject is null or v_keyword_subject is null then
    raise exception '존재하지 않는 회차 또는 키워드입니다.';
  end if;
  if v_unit_subject <> v_keyword_subject then
    raise exception '회차와 키워드는 같은 과목이어야 합니다.';
  end if;
  return new;
end;
$$;

create trigger teacher_curriculum_template_unit_keywords_check_subject
  before insert or update on teacher_curriculum_template_unit_keywords
  for each row execute function public.check_teacher_unit_keyword_same_subject();

alter table teacher_curriculum_template_unit_keywords enable row level security;

-- 교재 테이블(teacher_curriculum_template_unit_materials)의 현재 정책과 같은 모양이다
-- (20260904010000). 본인 선생님 또는 관리자, 그리고 계정 접근이 살아 있을 때만.
create policy "본인 선생님/관리자" on teacher_curriculum_template_unit_keywords for all
  using (is_admin() or (current_account_access_allowed() and exists (
    select 1 from teacher_curriculum_template_units u
    join teacher_curriculum_templates t on t.id = u.template_id
    where u.id = teacher_curriculum_template_unit_keywords.unit_id and t.teacher_id = auth.uid()
  )))
  with check (is_admin() or (current_account_access_allowed() and exists (
    select 1 from teacher_curriculum_template_units u
    join teacher_curriculum_templates t on t.id = u.template_id
    where u.id = teacher_curriculum_template_unit_keywords.unit_id and t.teacher_id = auth.uid()
  )));

-- =========================================================================
-- 3. 선생님 층 기본 구성 — 자동분과 선생님이 고른 것을 구분한다
-- =========================================================================
-- teacher_curriculum_template_unit_materials는 초기 스키마부터 있었지만 배선이
-- 없어 비어 있었다. 학생 운영본(curriculum_overlay_unit_materials)과 같은 모양으로
-- 맞춘다 — 구분이 없으면 키워드를 뗐을 때 무엇을 회수할지 알 수 없고, 자동 갱신이
-- 선생님의 손을 덮어쓰게 된다.
alter table teacher_curriculum_template_unit_materials
  add column position int,
  add column source text not null default 'manual' check (source in ('auto', 'manual')),
  add column created_by uuid references profiles (id),
  add column created_at timestamptz not null default now();

comment on column teacher_curriculum_template_unit_materials.source is
  'P2 3차: auto = 회차 키워드에서 자동으로 들어온 것(키워드를 떼면 함께 빠진다). '
  'manual = 선생님이 직접 담은 것(자동 갱신이 건드리지 않는다). 기존 행은 전부 '
  'manual로 둔다 — 이미 선생님이 쓰던 구성을 자동 회수 대상으로 만들 수 없다.';

create table teacher_curriculum_template_unit_material_exclusions (
  unit_id uuid not null references teacher_curriculum_template_units (id) on delete cascade,
  curriculum_doc_id uuid not null references curriculum_docs (id) on delete cascade,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  primary key (unit_id, curriculum_doc_id)
);

comment on table teacher_curriculum_template_unit_material_exclusions is
  'P2 3차: 선생님이 자기 기본 구성에서 뺀 교재. 자동 구성이 다시 넣지 않도록 기억한다.';

alter table teacher_curriculum_template_unit_material_exclusions enable row level security;

create policy "본인 선생님/관리자" on teacher_curriculum_template_unit_material_exclusions for all
  using (is_admin() or (current_account_access_allowed() and exists (
    select 1 from teacher_curriculum_template_units u
    join teacher_curriculum_templates t on t.id = u.template_id
    where u.id = teacher_curriculum_template_unit_material_exclusions.unit_id
      and t.teacher_id = auth.uid()
  )))
  with check (is_admin() or (current_account_access_allowed() and exists (
    select 1 from teacher_curriculum_template_units u
    join teacher_curriculum_templates t on t.id = u.template_id
    where u.id = teacher_curriculum_template_unit_material_exclusions.unit_id
      and t.teacher_id = auth.uid()
  )));

-- 키워드 → 기본 교재 자동 구성. 학생 운영본의 sync_unit_auto_materials(20261309000000)과
-- 같은 규칙이다: 들어오는 것은 키워드의 기본 교재 중 없고 제외되지도 않은 것,
-- 빠지는 것은 source='auto'인데 더 이상 어떤 키워드에도 걸리지 않는 것,
-- 안 건드리는 것은 source='manual'.
create or replace function sync_teacher_unit_auto_materials(p_unit_id uuid)
returns table (added int, removed int)
language plpgsql
as $$
declare
  v_added int := 0;
  v_removed int := 0;
  v_next int;
begin
  with gone as (
    delete from teacher_curriculum_template_unit_materials m
    where m.unit_id = p_unit_id
      and m.source = 'auto'
      and not exists (
        select 1
        from teacher_curriculum_template_unit_keywords uk
        join keyword_default_materials kdm on kdm.keyword_id = uk.keyword_id
        where uk.unit_id = p_unit_id
          and kdm.curriculum_doc_id = m.curriculum_doc_id
      )
    returning 1
  )
  select count(*) into v_removed from gone;

  select coalesce(max(position), 0) into v_next
  from teacher_curriculum_template_unit_materials where unit_id = p_unit_id;

  with candidates as (
    select kdm.curriculum_doc_id, min(kdm.position) as position, min(kdm.title) as title
    from teacher_curriculum_template_unit_keywords uk
    join keyword_default_materials kdm on kdm.keyword_id = uk.keyword_id
    where uk.unit_id = p_unit_id
      and not exists (
        select 1 from teacher_curriculum_template_unit_materials e
        where e.unit_id = p_unit_id and e.curriculum_doc_id = kdm.curriculum_doc_id
      )
      and not exists (
        select 1 from teacher_curriculum_template_unit_material_exclusions x
        where x.unit_id = p_unit_id and x.curriculum_doc_id = kdm.curriculum_doc_id
      )
    group by kdm.curriculum_doc_id
  ), ins as (
    insert into teacher_curriculum_template_unit_materials
      (unit_id, curriculum_doc_id, position, source, created_by)
    select p_unit_id, c.curriculum_doc_id,
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

comment on function sync_teacher_unit_auto_materials(uuid) is
  'P2 3차: 선생님 기본 템플릿 회차의 키워드에 맞춰 기본 교재를 맞춘다. source=manual과 '
  '선생님이 뺀 교재는 건드리지 않고, 기존 행의 순서도 그대로 둔다.';

create or replace function teacher_template_unit_keywords_sync_materials()
returns trigger language plpgsql as $$
begin
  perform sync_teacher_unit_auto_materials(coalesce(new.unit_id, old.unit_id));
  return null;
end;
$$;

create trigger teacher_curriculum_template_unit_keywords_sync
  after insert or delete on teacher_curriculum_template_unit_keywords
  for each row execute function teacher_template_unit_keywords_sync_materials();

-- =========================================================================
-- 4. 초기 상속 — 선생님 회차가 만들어지는 순간 자동으로
-- =========================================================================
-- 이미 있는 회차는 건드리지 않는다 — INSERT에서만 돈다. 선생님이 이미 조정해 둔
-- 구성을 나중에 덮어쓰는 일은 없다.
create or replace function teacher_template_units_inherit_defaults()
returns trigger language plpgsql as $$
begin
  if new.source_unit_id is null then
    return null;
  end if;

  insert into teacher_curriculum_template_unit_keywords (unit_id, keyword_id, created_by)
  select new.id, tuk.keyword_id, auth.uid()
  from subject_template_unit_keywords tuk
  where tuk.unit_id = new.source_unit_id
  on conflict do nothing;

  -- 관리자가 단원에 직접 매달아 둔 교재도 함께 내려온다. 키워드에서 오는 자동분과
  -- 달리 이건 단원에 명시적으로 붙은 것이라 manual로 둔다 — 키워드를 떼도
  -- 사라지면 안 된다. 학생 운영본의 같은 규칙(20261309000000)과 일치시킨다.
  insert into teacher_curriculum_template_unit_materials
    (unit_id, curriculum_doc_id, position, source, created_by)
  select new.id, tum.curriculum_doc_id,
         row_number() over (order by tum.position, tum.curriculum_doc_id),
         'manual', auth.uid()
  from subject_template_unit_materials tum
  join curriculum_docs d on d.id = tum.curriculum_doc_id
  where tum.unit_id = new.source_unit_id and d.status = 'published'
  on conflict do nothing;

  return null;
end;
$$;

create trigger teacher_curriculum_template_units_inherit
  after insert on teacher_curriculum_template_units
  for each row execute function teacher_template_units_inherit_defaults();

-- =========================================================================
-- 5. 보정 — 이미 있는 회차를 나중에 채우는 것은 선생님이 부른다
-- =========================================================================
-- 자동으로 돌지 않는다. 상속 누락(연결은 있는데 키워드가 비어 있음)과 선생님의
-- 의도적인 해제를 코드가 구분할 수 없기 때문이다. 없는 것만 넣고 아무것도 지우지
-- 않으므로, 선생님이 일부러 뺀 것이 돌아오면 다시 빼면 된다 — 반대(선생님 선택을
-- 덮어쓰기)는 되돌릴 수 없다.
create or replace function inherit_teacher_unit_defaults_from_template(p_unit_id uuid)
returns table (keywords_added int, materials_added int)
language plpgsql
as $$
declare
  v_source_unit_id uuid;
  v_kw int := 0;
  v_mat int := 0;
begin
  select source_unit_id into v_source_unit_id
  from teacher_curriculum_template_units where id = p_unit_id;

  if v_source_unit_id is null then
    return query select 0, 0;
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

  with ins as (
    insert into teacher_curriculum_template_unit_materials
      (unit_id, curriculum_doc_id, position, source, created_by)
    select p_unit_id, m.curriculum_doc_id,
           coalesce((select max(position) from teacher_curriculum_template_unit_materials
                     where unit_id = p_unit_id), 0)
             + row_number() over (order by m.position, m.curriculum_doc_id),
           'manual', auth.uid()
    from subject_template_unit_materials m
    join curriculum_docs d on d.id = m.curriculum_doc_id
    where m.unit_id = v_source_unit_id
      and d.status = 'published'
      and not exists (
        select 1 from teacher_curriculum_template_unit_materials e
        where e.unit_id = p_unit_id and e.curriculum_doc_id = m.curriculum_doc_id
      )
    on conflict do nothing
    returning 1
  )
  select count(*) into v_mat from ins;

  return query select v_kw, v_mat;
end;
$$;

comment on function inherit_teacher_unit_defaults_from_template(uuid) is
  'P2 3차: 관리자 기준본 회차의 키워드·교재를 선생님 기본 템플릿 회차로 물려받는다. '
  '이미 있는 것은 건드리지 않고 없는 것만 넣으며, 아무것도 지우지 않는다. '
  '자동 실행되지 않는다 — 선생님이 화면에서 명시적으로 부른다.';

-- =========================================================================
-- 6. 학생 운영본 시딩이 선생님 층을 거치게 한다
-- =========================================================================
-- 지금까지 이 트리거는 관리자 기준본에서 바로 내려받았다. 그래서 선생님이 자기 기본
-- 템플릿에서 무엇을 정해 두었든 학생 회차에는 반영되지 않았고, 배정받은 학생마다
-- 키워드를 다시 찍어야 했다 — 이번 지시가 없애라고 한 바로 그 흐름이다.
--
-- 바뀌는 규칙(회차 단위로 판단한다):
--   담당 선생님의 기본 템플릿에 **연결된 회차가 있으면** 그 회차의 구성을 쓴다.
--     선생님이 그 회차에서 키워드를 일부러 비워 뒀다면 비어 있는 채로 내려간다 —
--     사람이 뺀 것을 자동 상속이 되살리지 않는다.
--   연결된 회차가 없으면(선생님 템플릿이 아직 없거나, 그 회차를 선생님이 지웠거나,
--     연결을 복원하지 못했으면) 종전대로 관리자 기준본에서 내려받는다.
--
-- ensure_active_curriculum_overlay()는 20261309000000에서 이미 자체 시딩을 걷어냈고
-- 이 트리거가 유일한 경로다. 그래서 여기만 고치면 베이스라인 시딩과 회차 추가
-- (addCanonicalUnit) 양쪽에 같은 규칙이 적용된다.
create or replace function curriculum_overlay_units_inherit_defaults()
returns trigger language plpgsql as $$
declare
  v_teacher_unit_id uuid;
begin
  if new.source_unit_id is null then
    return null;
  end if;

  -- 이 학생·과목을 맡은 선생님의 기본 템플릿에서 같은 관리자 회차로 연결된 회차.
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

    -- 선생님이 자기 기본 구성에 직접 담아 둔 교재는 manual로 내려간다. 키워드에서
    -- 오는 자동분은 위 키워드 삽입이 curriculum_overlay_unit_keywords_sync 트리거를
    -- 깨우면서 학생 쪽에서 다시 계산된다 — 여기서 auto 행을 복사해 오지 않는다.
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

    return null;
  end if;

  -- 선생님 층에 연결된 회차가 없다 — 종전대로 관리자 기준본에서.
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

  return null;
end;
$$;
