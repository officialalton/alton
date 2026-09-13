-- P2 5차 — 관리자 기준본·선생님 기본 템플릿에도 문제 구성을 둔다.
--
-- 2026-09-13 제품 오너 정정: 이 두 층을 "키워드로 들어올 문제 미리보기"로 제한한
-- 것은 요구와 다르다. **예약 없는 템플릿도 미리보고 구성할 수 있어야 한다.**
-- 각 층에서 문제 구성 조건과 선택 결과를 저장하고, 직접 추가·교체·제외·정렬할 수
-- 있어야 하며, 화면을 다시 열어도 선택이 바뀌지 않아야 한다.
--
-- 교재 층(20261309·20261317·20261320)과 같은 모양으로 맞춘다. 다른 것은 후보를
-- 어디서 가져오느냐뿐이다:
--   교재  keyword_default_materials       (키워드의 대표 교재)
--   문제  problem_keywords_selectable     (확정됐고 보관되지 않은 문제의 키워드)
--
-- 지키는 규칙(교재와 동일):
--   - source='auto'  키워드·조건에서 들어온 것. 조건이 바뀌면 빠진다.
--   - source='manual' 사람이 직접 담은 것. 자동 갱신이 건드리지 않는다.
--   - 제외 기록이 있으면 자동 구성이 다시 넣지 않는다.
--   - 기존 행의 position 은 그대로 두고 새 것만 뒤에 붙인다 — 사람이 맞춘 순서를
--     자동 갱신이 흔들면 안 된다.
--
-- **문제가 모자라도 AI로 채우지 않는다.** 부족은 화면이 숫자로 보여줄 뿐이고,
-- 채우는 것은 사람이 결정한다.

-- =========================================================================
-- 1. 구성 조건 — 무엇을 어떻게 고를 것인가
-- =========================================================================
-- 키워드는 회차에 이미 붙어 있다(…_unit_keywords). 여기서 더하는 것은 형식·난이도·
-- 개수다. null 은 "제한 없음"이고 빈 배열과 다르다 — 빈 배열은 "아무것도 고르지
-- 않음"이라 후보가 0이 된다.
create table subject_template_unit_problem_criteria (
  unit_id uuid primary key references subject_template_units (id) on delete cascade,
  formats text[],
  difficulties text[],
  target_count int check (target_count is null or target_count > 0),
  updated_by uuid references profiles (id),
  updated_at timestamptz not null default now()
);

create table teacher_curriculum_template_unit_problem_criteria (
  unit_id uuid primary key references teacher_curriculum_template_units (id) on delete cascade,
  formats text[],
  difficulties text[],
  target_count int check (target_count is null or target_count > 0),
  updated_by uuid references profiles (id),
  updated_at timestamptz not null default now()
);

comment on table subject_template_unit_problem_criteria is
  'P2 5차: 관리자 기준본 회차의 문제 구성 조건. null 은 제한 없음, 빈 배열은 후보 없음.';
comment on table teacher_curriculum_template_unit_problem_criteria is
  'P2 5차: 선생님 기본 템플릿 회차의 문제 구성 조건. 관리자 기준본에서 초기 상속된다.';

-- =========================================================================
-- 2. 선택 결과와 제외 기록
-- =========================================================================
create table subject_template_unit_problems (
  unit_id uuid not null references subject_template_units (id) on delete cascade,
  problem_id uuid not null references problems (id) on delete cascade,
  position int not null,
  source text not null default 'manual' check (source in ('auto', 'manual')),
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  primary key (unit_id, problem_id)
);
create index on subject_template_unit_problems (problem_id);

create table subject_template_unit_problem_exclusions (
  unit_id uuid not null references subject_template_units (id) on delete cascade,
  problem_id uuid not null references problems (id) on delete cascade,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  primary key (unit_id, problem_id)
);

create table teacher_curriculum_template_unit_problems (
  unit_id uuid not null references teacher_curriculum_template_units (id) on delete cascade,
  problem_id uuid not null references problems (id) on delete cascade,
  position int not null,
  source text not null default 'manual' check (source in ('auto', 'manual')),
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  primary key (unit_id, problem_id)
);
create index on teacher_curriculum_template_unit_problems (problem_id);

create table teacher_curriculum_template_unit_problem_exclusions (
  unit_id uuid not null references teacher_curriculum_template_units (id) on delete cascade,
  problem_id uuid not null references problems (id) on delete cascade,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  primary key (unit_id, problem_id)
);

comment on column subject_template_unit_problems.source is
  'P2 5차: auto = 키워드·조건에서 자동으로 들어온 것. manual = 직접 담은 것(자동 갱신이 건드리지 않는다).';
comment on column teacher_curriculum_template_unit_problems.source is
  'P2 5차: auto = 키워드·조건에서 자동으로 들어온 것. manual = 직접 담은 것(자동 갱신이 건드리지 않는다).';

-- =========================================================================
-- 3. RLS — 교재 층과 같은 경계
-- =========================================================================
alter table subject_template_unit_problem_criteria enable row level security;
alter table subject_template_unit_problems enable row level security;
alter table subject_template_unit_problem_exclusions enable row level security;

create policy "인증된 사용자 전체 조회" on subject_template_unit_problem_criteria for select
  using (auth.uid() is not null);
create policy "관리자만 쓰기" on subject_template_unit_problem_criteria for all
  using (is_admin()) with check (is_admin());

create policy "인증된 사용자 전체 조회" on subject_template_unit_problems for select
  using (auth.uid() is not null);
create policy "관리자만 쓰기" on subject_template_unit_problems for all
  using (is_admin()) with check (is_admin());

create policy "인증된 사용자 전체 조회" on subject_template_unit_problem_exclusions for select
  using (auth.uid() is not null);
create policy "관리자만 쓰기" on subject_template_unit_problem_exclusions for all
  using (is_admin()) with check (is_admin());

alter table teacher_curriculum_template_unit_problem_criteria enable row level security;
alter table teacher_curriculum_template_unit_problems enable row level security;
alter table teacher_curriculum_template_unit_problem_exclusions enable row level security;

create policy "본인 선생님/관리자" on teacher_curriculum_template_unit_problem_criteria for all
  using (is_admin() or (current_account_access_allowed() and exists (
    select 1 from teacher_curriculum_template_units u
    join teacher_curriculum_templates t on t.id = u.template_id
    where u.id = teacher_curriculum_template_unit_problem_criteria.unit_id and t.teacher_id = auth.uid()
  )))
  with check (is_admin() or (current_account_access_allowed() and exists (
    select 1 from teacher_curriculum_template_units u
    join teacher_curriculum_templates t on t.id = u.template_id
    where u.id = teacher_curriculum_template_unit_problem_criteria.unit_id and t.teacher_id = auth.uid()
  )));

create policy "본인 선생님/관리자" on teacher_curriculum_template_unit_problems for all
  using (is_admin() or (current_account_access_allowed() and exists (
    select 1 from teacher_curriculum_template_units u
    join teacher_curriculum_templates t on t.id = u.template_id
    where u.id = teacher_curriculum_template_unit_problems.unit_id and t.teacher_id = auth.uid()
  )))
  with check (is_admin() or (current_account_access_allowed() and exists (
    select 1 from teacher_curriculum_template_units u
    join teacher_curriculum_templates t on t.id = u.template_id
    where u.id = teacher_curriculum_template_unit_problems.unit_id and t.teacher_id = auth.uid()
  )));

create policy "본인 선생님/관리자" on teacher_curriculum_template_unit_problem_exclusions for all
  using (is_admin() or (current_account_access_allowed() and exists (
    select 1 from teacher_curriculum_template_units u
    join teacher_curriculum_templates t on t.id = u.template_id
    where u.id = teacher_curriculum_template_unit_problem_exclusions.unit_id and t.teacher_id = auth.uid()
  )))
  with check (is_admin() or (current_account_access_allowed() and exists (
    select 1 from teacher_curriculum_template_units u
    join teacher_curriculum_templates t on t.id = u.template_id
    where u.id = teacher_curriculum_template_unit_problem_exclusions.unit_id and t.teacher_id = auth.uid()
  )));

-- =========================================================================
-- 4. 키워드·조건 → 문제 자동 구성
-- =========================================================================
-- 교재의 sync_*_auto_materials 와 같은 규칙이다. 더해지는 것은 조건(형식·난이도·
-- 개수)뿐이다.
--
--   빠진다  : source='auto' 인데 더 이상 조건에 맞지 않는 것
--   들어온다: 조건에 맞고, 아직 없고, 제외되지도 않은 것
--   안 건드린다: source='manual' — 사람이 직접 담은 것은 조건과 무관하다
--
-- 개수(target_count)는 **자동분에만** 적용한다. 사람이 직접 담은 것까지 세어
-- 잘라내면, 선생님이 고른 문제가 조건 때문에 사라지게 된다.
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

  -- 조건에 맞는 후보 전체(이미 담긴 것·제외한 것 포함). 화면이 "부족"을 보여주려면
  -- 담긴 수가 아니라 **고를 수 있는 수**를 알아야 한다.
  select count(*) into v_available
  from problem_keywords_selectable pk
  join problems p on p.id = pk.problem_id
  where pk.keyword_id in (
      select keyword_id from subject_template_unit_keywords where unit_id = p_unit_id
    )
    and (v_formats is null or p.format::text = any (v_formats))
    and (v_difficulties is null or p.difficulty::text = any (v_difficulties));

  with gone as (
    delete from subject_template_unit_problems m
    where m.unit_id = p_unit_id
      and m.source = 'auto'
      and not exists (
        select 1
        from problem_keywords_selectable pk
        join problems p on p.id = pk.problem_id
        where pk.problem_id = m.problem_id
          and pk.keyword_id in (
            select keyword_id from subject_template_unit_keywords where unit_id = p_unit_id
          )
          and (v_formats is null or p.format::text = any (v_formats))
          and (v_difficulties is null or p.difficulty::text = any (v_difficulties))
      )
    returning 1
  )
  select count(*) into v_removed from gone;

  select coalesce(max(position), 0) into v_next
  from subject_template_unit_problems where unit_id = p_unit_id;

  with candidates as (
    select distinct pk.problem_id, p.created_at
    from problem_keywords_selectable pk
    join problems p on p.id = pk.problem_id
    where pk.keyword_id in (
        select keyword_id from subject_template_unit_keywords where unit_id = p_unit_id
      )
      and (v_formats is null or p.format::text = any (v_formats))
      and (v_difficulties is null or p.difficulty::text = any (v_difficulties))
      and not exists (
        select 1 from subject_template_unit_problems e
        where e.unit_id = p_unit_id and e.problem_id = pk.problem_id
      )
      and not exists (
        select 1 from subject_template_unit_problem_exclusions x
        where x.unit_id = p_unit_id and x.problem_id = pk.problem_id
      )
  ), room as (
    -- 자동분 자리 수. 목표가 없으면 제한하지 않는다.
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

comment on function sync_catalog_unit_auto_problems(uuid) is
  'P2 5차: 관리자 기준본 회차의 키워드·조건에 맞춰 문제 자동분을 맞춘다. source=manual과 '
  '제외한 문제는 건드리지 않고, 기존 순서도 그대로 둔다. 부족해도 채우지 않고 '
  'available 로 고를 수 있는 수를 돌려준다.';

-- 선생님 층 — 같은 규칙, 테이블만 다르다.
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
  from problem_keywords_selectable pk
  join problems p on p.id = pk.problem_id
  where pk.keyword_id in (
      select keyword_id from teacher_curriculum_template_unit_keywords where unit_id = p_unit_id
    )
    and (v_formats is null or p.format::text = any (v_formats))
    and (v_difficulties is null or p.difficulty::text = any (v_difficulties));

  with gone as (
    delete from teacher_curriculum_template_unit_problems m
    where m.unit_id = p_unit_id
      and m.source = 'auto'
      and not exists (
        select 1
        from problem_keywords_selectable pk
        join problems p on p.id = pk.problem_id
        where pk.problem_id = m.problem_id
          and pk.keyword_id in (
            select keyword_id from teacher_curriculum_template_unit_keywords where unit_id = p_unit_id
          )
          and (v_formats is null or p.format::text = any (v_formats))
          and (v_difficulties is null or p.difficulty::text = any (v_difficulties))
      )
    returning 1
  )
  select count(*) into v_removed from gone;

  select coalesce(max(position), 0) into v_next
  from teacher_curriculum_template_unit_problems where unit_id = p_unit_id;

  with candidates as (
    select distinct pk.problem_id, p.created_at
    from problem_keywords_selectable pk
    join problems p on p.id = pk.problem_id
    where pk.keyword_id in (
        select keyword_id from teacher_curriculum_template_unit_keywords where unit_id = p_unit_id
      )
      and (v_formats is null or p.format::text = any (v_formats))
      and (v_difficulties is null or p.difficulty::text = any (v_difficulties))
      and not exists (
        select 1 from teacher_curriculum_template_unit_problems e
        where e.unit_id = p_unit_id and e.problem_id = pk.problem_id
      )
      and not exists (
        select 1 from teacher_curriculum_template_unit_problem_exclusions x
        where x.unit_id = p_unit_id and x.problem_id = pk.problem_id
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

comment on function sync_teacher_unit_auto_problems(uuid) is
  'P2 5차: 선생님 기본 템플릿 회차의 키워드·조건에 맞춰 문제 자동분을 맞춘다. '
  'source=manual과 뺀 문제는 건드리지 않고 기존 순서도 그대로 둔다.';

-- =========================================================================
-- 5. 키워드·조건이 바뀌면 다시 맞춘다
-- =========================================================================
create or replace function catalog_unit_problem_inputs_changed()
returns trigger language plpgsql as $$
begin
  perform sync_catalog_unit_auto_problems(coalesce(new.unit_id, old.unit_id));
  return null;
end;
$$;

create trigger subject_template_unit_keywords_sync_problems
  after insert or delete on subject_template_unit_keywords
  for each row execute function catalog_unit_problem_inputs_changed();

create trigger subject_template_unit_problem_criteria_sync
  after insert or update on subject_template_unit_problem_criteria
  for each row execute function catalog_unit_problem_inputs_changed();

create or replace function teacher_unit_problem_inputs_changed()
returns trigger language plpgsql as $$
begin
  perform sync_teacher_unit_auto_problems(coalesce(new.unit_id, old.unit_id));
  return null;
end;
$$;

create trigger teacher_curriculum_template_unit_keywords_sync_problems
  after insert or delete on teacher_curriculum_template_unit_keywords
  for each row execute function teacher_unit_problem_inputs_changed();

create trigger teacher_curriculum_template_unit_problem_criteria_sync
  after insert or update on teacher_curriculum_template_unit_problem_criteria
  for each row execute function teacher_unit_problem_inputs_changed();

-- =========================================================================
-- 6. 초기 상속 — 관리자 기준본 → 선생님 기본
-- =========================================================================
-- **최초 상속만 자동이다.** 상위(관리자 기준본)가 나중에 바뀐 것을 하위로 밀어내지
-- 않는다 — 하위에서 조정한 구성을 덮어쓰게 되기 때문이다. 나중에 반영하려면
-- 선생님이 명시적으로 부른다(inherit_teacher_unit_problem_defaults).
--
-- 회차 생성 시점의 트리거(teacher_curriculum_template_units_inherit, 20261317)는
-- 이미 키워드·교재를 내려준다. 문제는 조건과 직접 담은 것만 내려주면 된다 —
-- 자동분은 키워드·조건이 들어가는 순간 위 트리거가 다시 계산한다.
create or replace function inherit_teacher_unit_problem_defaults(p_unit_id uuid)
returns table (criteria_copied boolean, problems_added int)
language plpgsql
as $$
declare
  v_source_unit_id uuid;
  v_copied boolean := false;
  v_added int := 0;
begin
  select source_unit_id into v_source_unit_id
  from teacher_curriculum_template_units where id = p_unit_id;

  if v_source_unit_id is null then
    return query select false, 0;
    return;
  end if;

  -- 조건은 아직 없을 때만 내려받는다. 선생님이 이미 정한 조건을 덮어쓰지 않는다.
  insert into teacher_curriculum_template_unit_problem_criteria
    (unit_id, formats, difficulties, target_count, updated_by)
  select p_unit_id, c.formats, c.difficulties, c.target_count, auth.uid()
  from subject_template_unit_problem_criteria c
  where c.unit_id = v_source_unit_id
  on conflict (unit_id) do nothing;
  get diagnostics v_copied = row_count;

  -- 관리자가 직접 담아 둔 문제는 manual 로 내려온다. 자동분은 복사하지 않는다 —
  -- 선생님 층의 키워드·조건으로 다시 계산되는 것이 맞다.
  with ins as (
    insert into teacher_curriculum_template_unit_problems
      (unit_id, problem_id, position, source, created_by)
    select p_unit_id, sp.problem_id,
           coalesce((select max(position) from teacher_curriculum_template_unit_problems
                     where unit_id = p_unit_id), 0)
             + row_number() over (order by sp.position, sp.problem_id),
           'manual', auth.uid()
    from subject_template_unit_problems sp
    where sp.unit_id = v_source_unit_id
      and sp.source = 'manual'
      and not exists (
        select 1 from teacher_curriculum_template_unit_problems e
        where e.unit_id = p_unit_id and e.problem_id = sp.problem_id
      )
    on conflict do nothing
    returning 1
  )
  select count(*) into v_added from ins;

  return query select v_copied, v_added;
end;
$$;

comment on function inherit_teacher_unit_problem_defaults(uuid) is
  'P2 5차: 관리자 기준본 회차의 문제 구성 조건과 직접 담은 문제를 선생님 회차로 '
  '물려받는다. 이미 정한 조건은 덮어쓰지 않고, 없는 것만 넣으며 아무것도 지우지 '
  '않는다. 최초 상속과 상위 변경 반영을 구분하기 위해 자동 실행하지 않는다.';
