-- R9 — 레슨 준비/세션 선택 1/N: 준비된 선택(prepared selection) 스테이징 스키마
--
-- 배경(docs/superpowers/plans/2026-09-08-lesson-prep-session-selection.md Task 1,
-- v3/v4 확정): 선생님이 다가올 v3 세션의 콘텐츠를 미리 준비할 수 있는 "임시보관함"
-- 스테이징 영역. 여러 curriculum_overlay_units를 한 번에 참조할 수 있고(복습+새
-- 진도 동시 준비), 단원별로 활성 키워드 부분집합을 골라 후보를 좁힌 뒤, 그 안에서
-- 실제로 다룰 교재 조각/문제를 명시적으로 pick/exclude/reorder한다 — 키워드는
-- 후보를 좁히는 필터일 뿐, 실제로 고정(pin)되는 것은 이 명시적 콘텐츠 목록이다
-- (Task 2가 이 목록을 session_content_manifest로 얼려 넣는다 — 이 마이그레이션은
-- 그 freeze 자체를 구현하지 않는다. 여기서는 status='pinned' 전이 이후 더 이상
-- 아무 것도 못 바꾸게 잠그는 것까지만 한다).
--
-- 재사용: is_active_teacher_for_enrollment()(Task 3, 새 인가 메커니즘 없음),
-- curriculum_doc_section_keywords_selectable/problem_keywords_selectable(corrective 2,
-- "선택 가능" 판정은 관계 존재가 아니라 이 뷰), reorder_curriculum_overlay_units의
-- 원자적 재정렬 패턴, 20261219000000_r8_material_version_lock.sql의 pin-lock
-- predicate 형태(= OLD 상태를 보고 이후 변경을 거부).

create type session_prepared_selection_status as enum ('staged', 'pinned', 'archived');
create type session_prepared_selection_content_type as enum ('material_section', 'problem');

-- =========================================================================
-- 1. 준비된 선택 컨테이너 — session_id가 null이면 임시보관함(holding area)에만
-- 있는 것. attach로 특정 세션에 붙고, pin 전까지는 detach로 다시 null로 돌아갈
-- 수 있다(행 자체는 삭제되지 않는다 — Produces 참고).
-- =========================================================================

create table session_prepared_selections (
  id uuid primary key default gen_random_uuid(),
  subject_enrollment_id uuid not null references subject_enrollments (id) on delete cascade,
  teacher_id uuid not null references profiles (id),
  status session_prepared_selection_status not null default 'staged',
  session_id uuid references sessions (id) on delete set null,
  pinned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on session_prepared_selections (subject_enrollment_id);
create index on session_prepared_selections (session_id);

-- 불변(Produces): 한 session_id에는 archived가 아닌 준비된 선택이 최대 1개만
-- 붙을 수 있다. 두 번째 attach 시도는 이 유니크 인덱스가 동시성까지 포함해 막는다.
create unique index session_prepared_selections_one_active_per_session
  on session_prepared_selections (session_id)
  where (session_id is not null and status <> 'archived');

comment on table session_prepared_selections is
  'R9(레슨 준비 Task 1): 세션 콘텐츠 준비 스테이징 컨테이너. session_id가 null이면 임시보관함. status=pinned 이후에는 이 행과 하위 3개 테이블 전부 수정 불가(트리거).';

-- teacher_id는 클라이언트가 다른 사람 id를 못 넣게 auth.uid()로 스탬프한다
-- (Task 3 curriculum_overlay_units_track_status_change와 동일한 이유).
create or replace function public.session_prepared_selections_stamp_teacher()
returns trigger
language plpgsql as $$
begin
  new.teacher_id := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

create trigger session_prepared_selections_stamp_teacher
  before insert on session_prepared_selections
  for each row execute function public.session_prepared_selections_stamp_teacher();

revoke execute on function public.session_prepared_selections_stamp_teacher()
  from public, anon, authenticated, service_role;

-- attach/detach 시 대상 세션이 이 선택과 같은 subject_enrollment인지, 아직
-- scheduled인지 검증한다(다른 학생 세션에 잘못 붙는 것을 구조적으로 방지).
create or replace function public.check_prepared_selection_attach_session()
returns trigger
language plpgsql as $$
declare
  v_session_enrollment uuid;
  v_final_status v3_session_final_status;
begin
  new.updated_at := now();
  if new.session_id is distinct from old.session_id and new.session_id is not null then
    select subject_enrollment_id, final_status into v_session_enrollment, v_final_status
    from sessions where id = new.session_id;

    if v_session_enrollment is null then
      raise exception '존재하지 않는 세션입니다.';
    end if;
    if v_session_enrollment <> new.subject_enrollment_id then
      raise exception '이 세션은 다른 학생/과목의 세션입니다.';
    end if;
    if v_final_status <> 'scheduled' then
      raise exception '이미 시작/종료된 세션에는 준비된 선택을 붙일 수 없습니다.';
    end if;
  end if;
  return new;
end;
$$;

create trigger session_prepared_selections_check_attach
  before update on session_prepared_selections
  for each row execute function public.check_prepared_selection_attach_session();

revoke execute on function public.check_prepared_selection_attach_session()
  from public, anon, authenticated, service_role;

-- pin-lock(20261219000000_r8_material_version_lock.sql과 동일한 predicate 형태):
-- OLD.status = 'pinned'이면 이후의 어떤 UPDATE/DELETE도 거부한다. staged →
-- pinned로의 전이 자체는 OLD.status = 'staged'일 때 일어나므로 막히지 않는다
-- (그 전이는 Task 2의 pinSessionSelection()이 수행한다 — 이 마이그레이션 범위
-- 밖). detach(session_id → null)도 이 트리거 하나로 자동으로 막힌다(pinned된
-- 행에 대한 UPDATE이므로).
create or replace function public.check_prepared_selection_not_pinned_self()
returns trigger
language plpgsql as $$
begin
  -- 테스트/운영 정리용 bypass(20261219000000_r8_material_version_lock.sql의
  -- app.bypass_session_lock, session_annotation_events의
  -- app.bypass_annotation_lock과 동일한 관례) — 앱 코드 어떤 역할에도 이 GUC를
  -- 설정할 권한/그랜트를 주지 않는다(superuser psql로만 설정 가능).
  if coalesce(current_setting('app.bypass_prepared_selection_lock', true), 'false') = 'true' then
    return coalesce(new, old);
  end if;
  if old.status = 'pinned' then
    raise exception '핀 완료된 준비된 선택은 더 이상 수정할 수 없습니다.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger session_prepared_selections_pin_lock
  before update or delete on session_prepared_selections
  for each row execute function public.check_prepared_selection_not_pinned_self();

revoke execute on function public.check_prepared_selection_not_pinned_self()
  from public, anon, authenticated, service_role;

-- 하위 3개 테이블 공용: 소속 prepared_selection_id의 현재 status를 보고
-- 'pinned'면 예외를 던진다(트리거 함수들이 각자 자기 테이블의 prepared_selection_id를
-- 구해 이 함수를 호출한다).
create or replace function public.check_prepared_selection_not_pinned(p_prepared_selection_id uuid)
returns void
language plpgsql as $$
declare
  v_status session_prepared_selection_status;
begin
  if coalesce(current_setting('app.bypass_prepared_selection_lock', true), 'false') = 'true' then
    return;
  end if;
  select status into v_status from session_prepared_selections where id = p_prepared_selection_id;
  -- v_status가 null(부모 행이 이미 사라짐)인 경우는 두 가지뿐이다: (a) 애초에
  -- 잘못된 id가 들어왔거나(FK가 이미 막으므로 정상 경로에서는 불가능), (b)
  -- ON DELETE CASCADE로 부모(session_prepared_selections)가 먼저 지워지는 도중
  -- RI 트리거가 이 자식 행을 지우려는 것 — 이 경우는 막을 이유가 없다(부모가
  -- 이미 삭제 처리됐다는 것 자체가 그 삭제가 self-lock 트리거를 통과했다는
  -- 뜻이므로). 따라서 null이면 조용히 통과시킨다(raise하지 않음).
  if v_status = 'pinned' then
    raise exception '핀 완료된 준비된 선택은 더 이상 수정할 수 없습니다.';
  end if;
end;
$$;

-- 이 함수는 하위 3개 테이블의 잠금 트리거 함수(SECURITY INVOKER, 기본값)가
-- perform으로 직접 호출한다 — 트리거 자체는 권한 검사 없이 발동하지만, 그
-- 트리거 함수 본문 안에서 다른 함수를 호출하는 것은 호출자(대개 authenticated)의
-- EXECUTE 권한이 필요하다. public/anon에는 주지 않는다.
revoke execute on function public.check_prepared_selection_not_pinned(uuid) from public, anon;
grant execute on function public.check_prepared_selection_not_pinned(uuid) to authenticated, service_role;

-- =========================================================================
-- 2. 준비된 선택 ↔ 오버레이 단원(복수, 순서 있음)
-- =========================================================================

create table session_prepared_selection_units (
  id uuid primary key default gen_random_uuid(),
  prepared_selection_id uuid not null references session_prepared_selections (id) on delete cascade,
  overlay_unit_id uuid not null references curriculum_overlay_units (id) on delete cascade,
  position int not null,
  created_at timestamptz not null default now(),
  unique (prepared_selection_id, position),
  unique (prepared_selection_id, overlay_unit_id)
);
create index on session_prepared_selection_units (overlay_unit_id);

create or replace function public.session_prepared_selection_units_lock()
returns trigger
language plpgsql as $$
begin
  perform public.check_prepared_selection_not_pinned(coalesce(new.prepared_selection_id, old.prepared_selection_id));
  return coalesce(new, old);
end;
$$;

create trigger session_prepared_selection_units_pin_lock
  before insert or update or delete on session_prepared_selection_units
  for each row execute function public.session_prepared_selection_units_lock();

revoke execute on function public.session_prepared_selection_units_lock()
  from public, anon, authenticated, service_role;

comment on table session_prepared_selection_units is
  'R9(레슨 준비 Task 1): 한 준비된 선택이 참조하는 curriculum_overlay_units(복수, 순서 있음) — 복습+새 진도를 한 번에 준비할 수 있게 한다.';

-- =========================================================================
-- 3. 단원별 활성 키워드 부분집합 — 후보를 좁히는 필터/조합 맥락일 뿐, pin되는
-- 대상이 아니다(§4 참조). 반드시 그 단원(curriculum_overlay_units)의 기존
-- curriculum_overlay_unit_keywords의 부분집합이어야 한다.
-- =========================================================================

create table session_prepared_selection_unit_keywords (
  prepared_selection_unit_id uuid not null references session_prepared_selection_units (id) on delete cascade,
  keyword_id uuid not null references subject_keywords (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (prepared_selection_unit_id, keyword_id)
);
create index on session_prepared_selection_unit_keywords (keyword_id);

create or replace function public.check_prepared_unit_keyword_subset()
returns trigger
language plpgsql as $$
declare
  v_overlay_unit_id uuid;
  v_prepared_selection_id uuid;
  v_in_scope boolean;
begin
  select u.overlay_unit_id, u.prepared_selection_id into v_overlay_unit_id, v_prepared_selection_id
  from session_prepared_selection_units u
  where u.id = new.prepared_selection_unit_id;

  if v_overlay_unit_id is null then
    raise exception '존재하지 않는 준비된 선택 단원입니다.';
  end if;

  perform public.check_prepared_selection_not_pinned(v_prepared_selection_id);

  select exists (
    select 1 from curriculum_overlay_unit_keywords k
    where k.overlay_unit_id = v_overlay_unit_id and k.keyword_id = new.keyword_id
  ) into v_in_scope;

  if not v_in_scope then
    raise exception '이 키워드는 해당 오버레이 단원의 키워드 집합에 없습니다(부분집합 아님).';
  end if;

  return new;
end;
$$;

create trigger session_prepared_selection_unit_keywords_check_subset
  before insert on session_prepared_selection_unit_keywords
  for each row execute function public.check_prepared_unit_keyword_subset();

revoke execute on function public.check_prepared_unit_keyword_subset()
  from public, anon, authenticated, service_role;

-- DELETE(예: setSelectionActiveKeywords의 재설정 delete)도 pin-lock 통과해야 한다.
create or replace function public.session_prepared_selection_unit_keywords_lock()
returns trigger
language plpgsql as $$
declare
  v_prepared_selection_id uuid;
begin
  select u.prepared_selection_id into v_prepared_selection_id
  from session_prepared_selection_units u
  where u.id = old.prepared_selection_unit_id;
  if v_prepared_selection_id is not null then
    perform public.check_prepared_selection_not_pinned(v_prepared_selection_id);
  end if;
  return old;
end;
$$;

create trigger session_prepared_selection_unit_keywords_pin_lock
  before delete on session_prepared_selection_unit_keywords
  for each row execute function public.session_prepared_selection_unit_keywords_lock();

revoke execute on function public.session_prepared_selection_unit_keywords_lock()
  from public, anon, authenticated, service_role;

comment on table session_prepared_selection_unit_keywords is
  'R9(레슨 준비 Task 1): 준비된 선택의 단원별 활성 키워드 부분집합 — 후보 필터일 뿐 pin 대상이 아니다. curriculum_overlay_unit_keywords의 부분집합만 허용(트리거).';

-- =========================================================================
-- 4. 스테이징 콘텐츠 픽 — 실제로 pin되는 페이로드. content_id는
-- curriculum_doc_sections.id 또는 problems.id를 가리키며(다형 참조라 FK 없음),
-- INSERT 시점에 이 선택의 단원/키워드 범위 안에서 currently-selectable인지
-- 트리거가 검사한다.
-- =========================================================================

create table session_prepared_selection_content_items (
  id uuid primary key default gen_random_uuid(),
  prepared_selection_id uuid not null references session_prepared_selections (id) on delete cascade,
  content_type session_prepared_selection_content_type not null,
  content_id uuid not null,
  position int not null,
  included boolean not null default true,
  added_at timestamptz not null default now(),
  unique (prepared_selection_id, position),
  unique (prepared_selection_id, content_type, content_id)
);
create index on session_prepared_selection_content_items (prepared_selection_id);

create or replace function public.check_prepared_content_item_selectable()
returns trigger
language plpgsql as $$
declare
  v_ok boolean;
begin
  perform public.check_prepared_selection_not_pinned(new.prepared_selection_id);

  if new.content_type = 'material_section' then
    select exists (
      select 1
      from session_prepared_selection_units u
      join session_prepared_selection_unit_keywords k on k.prepared_selection_unit_id = u.id
      join curriculum_doc_section_keywords_selectable sel
        on sel.section_id = new.content_id and sel.keyword_id = k.keyword_id
      where u.prepared_selection_id = new.prepared_selection_id
    ) into v_ok;
  elsif new.content_type = 'problem' then
    select exists (
      select 1
      from session_prepared_selection_units u
      join session_prepared_selection_unit_keywords k on k.prepared_selection_unit_id = u.id
      join problem_keywords_selectable sel
        on sel.problem_id = new.content_id and sel.keyword_id = k.keyword_id
      where u.prepared_selection_id = new.prepared_selection_id
    ) into v_ok;
  else
    raise exception '알 수 없는 콘텐츠 유형입니다: %', new.content_type;
  end if;

  if not v_ok then
    raise exception '선택 가능(published/confirmed)하지 않거나 이 준비된 선택의 단원/키워드 범위 밖인 콘텐츠는 담을 수 없습니다: % %', new.content_type, new.content_id;
  end if;

  return new;
end;
$$;

create trigger session_prepared_selection_content_items_check_selectable
  before insert on session_prepared_selection_content_items
  for each row execute function public.check_prepared_content_item_selectable();

revoke execute on function public.check_prepared_content_item_selectable()
  from public, anon, authenticated, service_role;

create or replace function public.session_prepared_selection_content_items_lock()
returns trigger
language plpgsql as $$
begin
  perform public.check_prepared_selection_not_pinned(coalesce(new.prepared_selection_id, old.prepared_selection_id));
  return coalesce(new, old);
end;
$$;

create trigger session_prepared_selection_content_items_pin_lock
  before update or delete on session_prepared_selection_content_items
  for each row execute function public.session_prepared_selection_content_items_lock();

revoke execute on function public.session_prepared_selection_content_items_lock()
  from public, anon, authenticated, service_role;

comment on table session_prepared_selection_content_items is
  'R9(레슨 준비 Task 1): 선생님이 명시적으로 pick/exclude/order한 실제 교재 조각/문제 목록 — pinSessionSelection()(Task 2)이 얼려 넣는 실제 페이로드. included=false는 소프트 제외(행 유지). INSERT 시점 트리거가 selectable+범위 내인지 검사한다.';

-- =========================================================================
-- 5. RLS — 쓰기: is_active_teacher_for_enrollment() 또는 admin. 조회: 동일
-- (학생 조회 경로 없음 — 이건 선생님 준비 스테이징 영역이다).
-- =========================================================================

alter table session_prepared_selections enable row level security;
create policy "담당 선생님/관리자만 조회" on session_prepared_selections for select
  using (is_admin() or is_active_teacher_for_enrollment(subject_enrollment_id));
create policy "담당 선생님/관리자만 쓰기" on session_prepared_selections for all
  using (is_admin() or is_active_teacher_for_enrollment(subject_enrollment_id))
  with check (is_admin() or is_active_teacher_for_enrollment(subject_enrollment_id));

alter table session_prepared_selection_units enable row level security;
create policy "담당 선생님/관리자만 조회" on session_prepared_selection_units for select
  using (
    is_admin()
    or exists (
      select 1 from session_prepared_selections s
      where s.id = prepared_selection_id and is_active_teacher_for_enrollment(s.subject_enrollment_id)
    )
  );
create policy "담당 선생님/관리자만 쓰기" on session_prepared_selection_units for all
  using (
    is_admin()
    or exists (
      select 1 from session_prepared_selections s
      where s.id = prepared_selection_id and is_active_teacher_for_enrollment(s.subject_enrollment_id)
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from session_prepared_selections s
      where s.id = prepared_selection_id and is_active_teacher_for_enrollment(s.subject_enrollment_id)
    )
  );

alter table session_prepared_selection_unit_keywords enable row level security;
create policy "담당 선생님/관리자만 조회" on session_prepared_selection_unit_keywords for select
  using (
    is_admin()
    or exists (
      select 1 from session_prepared_selection_units u
      join session_prepared_selections s on s.id = u.prepared_selection_id
      where u.id = prepared_selection_unit_id and is_active_teacher_for_enrollment(s.subject_enrollment_id)
    )
  );
create policy "담당 선생님/관리자만 쓰기" on session_prepared_selection_unit_keywords for all
  using (
    is_admin()
    or exists (
      select 1 from session_prepared_selection_units u
      join session_prepared_selections s on s.id = u.prepared_selection_id
      where u.id = prepared_selection_unit_id and is_active_teacher_for_enrollment(s.subject_enrollment_id)
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from session_prepared_selection_units u
      join session_prepared_selections s on s.id = u.prepared_selection_id
      where u.id = prepared_selection_unit_id and is_active_teacher_for_enrollment(s.subject_enrollment_id)
    )
  );

alter table session_prepared_selection_content_items enable row level security;
create policy "담당 선생님/관리자만 조회" on session_prepared_selection_content_items for select
  using (
    is_admin()
    or exists (
      select 1 from session_prepared_selections s
      where s.id = prepared_selection_id and is_active_teacher_for_enrollment(s.subject_enrollment_id)
    )
  );
create policy "담당 선생님/관리자만 쓰기" on session_prepared_selection_content_items for all
  using (
    is_admin()
    or exists (
      select 1 from session_prepared_selections s
      where s.id = prepared_selection_id and is_active_teacher_for_enrollment(s.subject_enrollment_id)
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from session_prepared_selections s
      where s.id = prepared_selection_id and is_active_teacher_for_enrollment(s.subject_enrollment_id)
    )
  );

-- =========================================================================
-- 6. 재정렬 RPC — reorder_curriculum_overlay_units(Task 3)와 동일한 원자적
-- 다중 행 position 재배정 패턴(임시 음수 position → 요청 순서대로 1..N).
-- =========================================================================

create or replace function public.reorder_prepared_selection_content_items(
  p_prepared_selection_id uuid,
  p_ordered_content_item_ids uuid[]
)
returns setof session_prepared_selection_content_items
language plpgsql as $$
declare
  v_item_id uuid;
  v_ord int;
  v_count int;
  v_existing_count int;
begin
  if not (is_admin() or exists (
    select 1 from session_prepared_selections s
    where s.id = p_prepared_selection_id and is_active_teacher_for_enrollment(s.subject_enrollment_id)
  )) then
    raise exception '이 준비된 선택을 조정할 권한이 없습니다.';
  end if;

  perform public.check_prepared_selection_not_pinned(p_prepared_selection_id);

  v_count := array_length(p_ordered_content_item_ids, 1);
  select count(*) into v_existing_count
  from session_prepared_selection_content_items where prepared_selection_id = p_prepared_selection_id;
  if v_count is distinct from v_existing_count then
    raise exception '재정렬 목록이 준비된 선택의 실제 콘텐츠 항목 수와 일치하지 않습니다.';
  end if;

  update session_prepared_selection_content_items
  set position = -position - 1000000
  where prepared_selection_id = p_prepared_selection_id;

  v_ord := 1;
  foreach v_item_id in array p_ordered_content_item_ids loop
    update session_prepared_selection_content_items
    set position = v_ord
    where id = v_item_id and prepared_selection_id = p_prepared_selection_id;
    if not found then
      raise exception '이 준비된 선택에 속하지 않는 콘텐츠 항목 id가 포함되어 있습니다: %', v_item_id;
    end if;
    v_ord := v_ord + 1;
  end loop;

  return query select * from session_prepared_selection_content_items
    where prepared_selection_id = p_prepared_selection_id order by position;
end;
$$;

revoke execute on function public.reorder_prepared_selection_content_items(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_prepared_selection_content_items(uuid, uuid[]) to authenticated, service_role;

comment on function public.reorder_prepared_selection_content_items(uuid, uuid[]) is
  'R9(레슨 준비 Task 1): 스테이징 콘텐츠 항목 재정렬을 단일 RPC 호출(=단일 트랜잭션)로 원자 처리한다. 권한 검사와 pin-lock 검사를 함수 안에서 다시 한다(RLS/트리거 우회 경로가 아니다).';
