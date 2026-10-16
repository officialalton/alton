-- R9 — 커리큘럼 콘텐츠 기반 2/N: 학생별 운영 커리큘럼 오버레이
--
-- 배경(docs/superpowers/specs/2026-09-07-curriculum-content-session-design.md §4,
-- docs/superpowers/plans/2026-09-07-curriculum-content-foundation.md Task 3):
-- 학생별 운영 커리큘럼은 기본 원본(subject_template_units)의 사본이 아니라
-- 추가·제외·재정렬·진도 상태를 담는 레이어다. 선생님은 검수·공개된 라이브러리
-- 콘텐츠로만 학생 전용 보강 단원을 조립할 수 있다(초안/미확정 콘텐츠 금지).
--
-- 권한(스펙 §7): 선생님은 "담당 학생"의 오버레이만 조정할 수 있다 — 기존
-- teacher_assignments(구독-과목별 배정 기간) 패턴을 그대로 재사용한다(새 인가
-- 메커니즘을 만들지 않는다).

create type curriculum_overlay_unit_status as enum (
  'not_started', 'in_progress', 'completed', 'reinforcement_needed', 'skipped'
);

-- =========================================================================
-- 1. 오버레이 — subject_enrollment당 활성 오버레이 1개
-- =========================================================================

create table student_curriculum_overlays (
  id uuid primary key default gen_random_uuid(),
  subject_enrollment_id uuid not null references subject_enrollments (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on student_curriculum_overlays (subject_enrollment_id);

-- 불변(Task 3 Produces): subject_enrollment당 active 오버레이는 항상 1개.
create unique index student_curriculum_overlays_one_active
  on student_curriculum_overlays (subject_enrollment_id)
  where (status = 'active');

comment on table student_curriculum_overlays is
  'R9: 학생별 운영 커리큘럼 오버레이 — subject_template_units의 사본이 아니라 그 위에 얹는 추가·제외·재정렬·진도 레이어(스펙 §4).';

-- =========================================================================
-- 2. 오버레이 단원 인스턴스 — 순서가 있는 목록. source_unit_id가 null이면
-- 선생님이 조립한 학생 전용 보강 단원(스펙 §4 "보강 단원").
-- =========================================================================

create table curriculum_overlay_units (
  id uuid primary key default gen_random_uuid(),
  overlay_id uuid not null references student_curriculum_overlays (id) on delete cascade,
  source_unit_id uuid references subject_template_units (id) on delete set null,
  position int not null,
  unit_title text not null,
  note text,
  status curriculum_overlay_unit_status not null default 'not_started',
  status_changed_by uuid references profiles (id),
  status_changed_at timestamptz,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (overlay_id, position)
);
create index on curriculum_overlay_units (overlay_id);
create index on curriculum_overlay_units (source_unit_id);

comment on table curriculum_overlay_units is
  'R9: 오버레이의 순서가 있는 단원 인스턴스. source_unit_id는 기본 원본 참조(FK on delete set null — 원본이 삭제돼도 이 학생의 이력/순서는 조용히 안 바뀌고 참조만 끊긴다), null이면 선생님이 조립한 학생 전용 보강 단원.';

-- 완료 상태 전이는 선생님 명시적 행동으로만(스펙 §4 "상태 전이는 선생님이
-- 확정한다") — status가 바뀔 때마다 누가/언제 바꿨는지 기록한다. 이 트리거는
-- app 서버 액션이 항상 auth.uid()로만 상태를 바꾸게 강제한다(클라이언트가 다른
-- 사람 id를 넣을 수 없다).
create or replace function public.curriculum_overlay_units_track_status_change()
returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_by := auth.uid();
    new.status_changed_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger curriculum_overlay_units_track_status
  before update on curriculum_overlay_units
  for each row execute function public.curriculum_overlay_units_track_status_change();

revoke execute on function public.curriculum_overlay_units_track_status_change()
  from public, anon, authenticated, service_role;

-- =========================================================================
-- 3. 오버레이 단원 ↔ 활성 키워드(선택) — 공용 키워드 사전에서만 고른다.
-- =========================================================================

create table curriculum_overlay_unit_keywords (
  overlay_unit_id uuid not null references curriculum_overlay_units (id) on delete cascade,
  keyword_id uuid not null references subject_keywords (id) on delete cascade,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  primary key (overlay_unit_id, keyword_id)
);
create index on curriculum_overlay_unit_keywords (keyword_id);

create or replace function public.check_overlay_unit_keyword_same_subject()
returns trigger
language plpgsql as $$
declare
  v_unit_subject uuid;
  v_keyword_subject uuid;
begin
  select se.subject_id into v_unit_subject
  from curriculum_overlay_units u
  join student_curriculum_overlays o on o.id = u.overlay_id
  join subject_enrollments se on se.id = o.subject_enrollment_id
  where u.id = new.overlay_unit_id;

  select subject_id into v_keyword_subject from subject_keywords where id = new.keyword_id;

  if v_unit_subject is null or v_keyword_subject is null then
    raise exception '존재하지 않는 오버레이 단원 또는 키워드입니다.';
  end if;
  if v_unit_subject <> v_keyword_subject then
    raise exception '단원과 키워드는 같은 과목이어야 합니다.';
  end if;
  new.created_by := auth.uid();
  return new;
end;
$$;

create trigger curriculum_overlay_unit_keywords_check_subject
  before insert or update on curriculum_overlay_unit_keywords
  for each row execute function public.check_overlay_unit_keyword_same_subject();

revoke execute on function public.check_overlay_unit_keyword_same_subject()
  from public, anon, authenticated, service_role;

-- =========================================================================
-- 4. 오버레이 단원 ↔ 참고 콘텐츠(교재) — 보강 단원(source_unit_id null)이라도
-- 공개(published)된 교재만 참조할 수 있다(스펙 §4 "검수된 교재·문제·키워드를
-- 조합한 학생 전용 보강 단원").
-- =========================================================================

create table curriculum_overlay_unit_materials (
  overlay_unit_id uuid not null references curriculum_overlay_units (id) on delete cascade,
  curriculum_doc_id uuid not null references curriculum_docs (id) on delete cascade,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  primary key (overlay_unit_id, curriculum_doc_id)
);
create index on curriculum_overlay_unit_materials (curriculum_doc_id);

create or replace function public.check_overlay_unit_material_published()
returns trigger
language plpgsql as $$
declare
  v_doc_status doc_status;
begin
  select status into v_doc_status from curriculum_docs where id = new.curriculum_doc_id;
  if v_doc_status is null then
    raise exception '존재하지 않는 교재입니다.';
  end if;
  if v_doc_status <> 'published' then
    raise exception '공개(published)되지 않은 교재는 학생 커리큘럼에 연결할 수 없습니다.';
  end if;
  new.created_by := auth.uid();
  return new;
end;
$$;

create trigger curriculum_overlay_unit_materials_check_published
  before insert or update on curriculum_overlay_unit_materials
  for each row execute function public.check_overlay_unit_material_published();

revoke execute on function public.check_overlay_unit_material_published()
  from public, anon, authenticated, service_role;

-- =========================================================================
-- 5. 인가 헬퍼 — "담당 선생님"인지 확인(기존 teacher_assignments 패턴 재사용,
-- 새 인가 메커니즘을 만들지 않는다).
-- =========================================================================

create or replace function public.is_active_teacher_for_enrollment(p_subject_enrollment_id uuid)
returns boolean
language sql stable as $$
  select exists (
    select 1 from teacher_assignments ta
    where ta.subject_enrollment_id = p_subject_enrollment_id
      and ta.teacher_id = auth.uid()
      and ta.status in ('planned', 'active')
  );
$$;

revoke execute on function public.is_active_teacher_for_enrollment(uuid) from public, anon;
grant execute on function public.is_active_teacher_for_enrollment(uuid) to authenticated, service_role;

create or replace function public.is_owning_student_for_enrollment(p_subject_enrollment_id uuid)
returns boolean
language sql stable as $$
  select exists (
    select 1 from subject_enrollments se
    where se.id = p_subject_enrollment_id and se.child_id = auth.uid()
  );
$$;

revoke execute on function public.is_owning_student_for_enrollment(uuid) from public, anon;
grant execute on function public.is_owning_student_for_enrollment(uuid) to authenticated, service_role;

-- =========================================================================
-- 6. RLS
-- =========================================================================

alter table student_curriculum_overlays enable row level security;
create policy "담당 선생님/본인 학생/관리자 조회" on student_curriculum_overlays for select
  using (
    is_admin()
    or is_active_teacher_for_enrollment(subject_enrollment_id)
    or is_owning_student_for_enrollment(subject_enrollment_id)
  );
create policy "담당 선생님/관리자만 쓰기" on student_curriculum_overlays for all
  using (is_admin() or is_active_teacher_for_enrollment(subject_enrollment_id))
  with check (is_admin() or is_active_teacher_for_enrollment(subject_enrollment_id));

alter table curriculum_overlay_units enable row level security;
create policy "담당 선생님/본인 학생/관리자 조회" on curriculum_overlay_units for select
  using (
    is_admin()
    or exists (
      select 1 from student_curriculum_overlays o
      where o.id = overlay_id
        and (is_active_teacher_for_enrollment(o.subject_enrollment_id)
             or is_owning_student_for_enrollment(o.subject_enrollment_id))
    )
  );
create policy "담당 선생님/관리자만 쓰기" on curriculum_overlay_units for all
  using (
    is_admin()
    or exists (
      select 1 from student_curriculum_overlays o
      where o.id = overlay_id and is_active_teacher_for_enrollment(o.subject_enrollment_id)
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from student_curriculum_overlays o
      where o.id = overlay_id and is_active_teacher_for_enrollment(o.subject_enrollment_id)
    )
  );

alter table curriculum_overlay_unit_keywords enable row level security;
create policy "담당 선생님/본인 학생/관리자 조회" on curriculum_overlay_unit_keywords for select
  using (
    is_admin()
    or exists (
      select 1 from curriculum_overlay_units u
      join student_curriculum_overlays o on o.id = u.overlay_id
      where u.id = overlay_unit_id
        and (is_active_teacher_for_enrollment(o.subject_enrollment_id)
             or is_owning_student_for_enrollment(o.subject_enrollment_id))
    )
  );
create policy "담당 선생님/관리자만 쓰기" on curriculum_overlay_unit_keywords for all
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

alter table curriculum_overlay_unit_materials enable row level security;
create policy "담당 선생님/본인 학생/관리자 조회" on curriculum_overlay_unit_materials for select
  using (
    is_admin()
    or exists (
      select 1 from curriculum_overlay_units u
      join student_curriculum_overlays o on o.id = u.overlay_id
      where u.id = overlay_unit_id
        and (is_active_teacher_for_enrollment(o.subject_enrollment_id)
             or is_owning_student_for_enrollment(o.subject_enrollment_id))
    )
  );
create policy "담당 선생님/관리자만 쓰기" on curriculum_overlay_unit_materials for all
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
-- 7. 재정렬 RPC — 여러 행의 position 변경을 한 트랜잭션으로 원자 처리
-- (app/teacher/student-curriculum-actions.ts의 moveUnit이 이 함수 하나만 호출한다.
-- 기존 subject-actions.ts moveSubjectUnit처럼 클라이언트에서 3번 순차 UPDATE하는
-- 패턴은 오버레이에서는 쓰지 않는다 — 계획서 Task 3 "reordering is atomic"
-- 요구사항 때문에 여기서는 서버 함수 호출 1번으로 강제한다.)
-- =========================================================================

create or replace function public.reorder_curriculum_overlay_units(
  p_overlay_id uuid,
  p_ordered_unit_ids uuid[]
)
returns setof curriculum_overlay_units
language plpgsql as $$
declare
  v_unit_id uuid;
  v_ord int;
  v_count int;
  v_existing_count int;
begin
  if not (is_admin() or exists (
    select 1 from student_curriculum_overlays o
    where o.id = p_overlay_id and is_active_teacher_for_enrollment(o.subject_enrollment_id)
  )) then
    raise exception '이 학생의 커리큘럼을 조정할 권한이 없습니다.';
  end if;

  v_count := array_length(p_ordered_unit_ids, 1);
  select count(*) into v_existing_count
  from curriculum_overlay_units where overlay_id = p_overlay_id;
  if v_count is distinct from v_existing_count then
    raise exception '재정렬 목록이 오버레이의 실제 단원 수와 일치하지 않습니다.';
  end if;

  -- 1단계: unique(overlay_id, position) 충돌을 피하기 위해 전부 음수 임시
  -- position으로 옮긴 뒤, 2단계에서 요청된 순서대로 1..N을 부여한다. 이
  -- 함수 호출 전체가 하나의 문장/트랜잭션이므로 중간에 실패하면 전부 롤백된다.
  update curriculum_overlay_units
  set position = -position - 1000000
  where overlay_id = p_overlay_id;

  v_ord := 1;
  foreach v_unit_id in array p_ordered_unit_ids loop
    update curriculum_overlay_units
    set position = v_ord
    where id = v_unit_id and overlay_id = p_overlay_id;
    if not found then
      raise exception '오버레이에 속하지 않는 단원 id가 포함되어 있습니다: %', v_unit_id;
    end if;
    v_ord := v_ord + 1;
  end loop;

  return query select * from curriculum_overlay_units where overlay_id = p_overlay_id order by position;
end;
$$;

revoke execute on function public.reorder_curriculum_overlay_units(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_curriculum_overlay_units(uuid, uuid[]) to authenticated, service_role;

comment on function public.reorder_curriculum_overlay_units(uuid, uuid[]) is
  'R9(Task 3): 오버레이 단원 재정렬을 단일 RPC 호출(=단일 트랜잭션)로 원자 처리한다. 권한 검사(담당 선생님/관리자)를 함수 안에서 한 번 더 하므로 RLS 우회 경로가 아니다.';
