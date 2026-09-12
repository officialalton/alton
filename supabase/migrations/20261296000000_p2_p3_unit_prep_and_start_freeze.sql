-- P2/P3 3단계 — 제품 오너 피드백 1·2·5 반영.
--
--   (1) 예약 없이도 회차를 준비할 수 있어야 한다. 지금까지 준비의 최소 단위는
--       "세션에 붙는 준비된 선택"이라, 예약이 있어야만 준비를 시작할 수 있었다.
--       준비의 원본을 회차(overlay unit)로 올리고, 실제 수업이 잡히면 그 회차
--       준비를 수업에 연결한다.
--   (2) 준비 저장과 수업 시작 시점의 고정을 분리한다. 지금은 준비 화면의
--       "고정하기" 버튼이 곧 스냅샷 확정이라 수업 전에 얼어붙었다. 고정은
--       수업 시작(mark_lesson_session_started)에서만 일어난다.
--   (5) 교사 준비 초안 공개를 멱등하게 만든다. 지금은 두 번 누르면 같은 필기가
--       두 번 들어갔다.
--
-- 기존 pin 경로(인가 (0a)~(0f), 재검증 루프, 매니페스트 불변성)는 그대로 둔다.

-- =========================================================================
-- 1. 회차 준비 — 예약과 무관한 준비의 원본
-- =========================================================================
create table curriculum_unit_preps (
  id uuid primary key default gen_random_uuid(),
  overlay_unit_id uuid not null references curriculum_overlay_units (id) on delete cascade,
  -- 이 회차에서 무엇을 달성할 것인가. 준비 화면의 첫 입력이자 수업·복습 화면의 머리말.
  goal text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (overlay_unit_id)
);
create index on curriculum_unit_preps (overlay_unit_id);

comment on table curriculum_unit_preps is
  'P2/P3: 회차 단위 준비의 원본. 예약이 없어도 만들 수 있고, 같은 회차가 여러 수업에 쓰이면 '
  '그 수업들이 전부 이 준비를 출발점으로 삼는다. 실제 수업에 붙는 순간의 스냅샷은 여전히 '
  'session_content_manifest이며(수업 시작 시 고정), 이 표는 언제든 수정할 수 있다.';

create table curriculum_unit_prep_items (
  id uuid primary key default gen_random_uuid(),
  prep_id uuid not null references curriculum_unit_preps (id) on delete cascade,
  content_type session_prepared_selection_content_type not null,
  content_id uuid not null,
  position int not null,
  created_at timestamptz not null default now(),
  unique (prep_id, content_type, content_id)
);
create index on curriculum_unit_prep_items (prep_id);

comment on table curriculum_unit_prep_items is
  'P2/P3: 회차 준비에서 고른 교재 조각·문제. 실제 고정(pin) 시점에 다시 검증되므로 '
  '여기 담겼다는 것만으로 학생에게 노출되지는 않는다.';

alter table curriculum_unit_preps enable row level security;
alter table curriculum_unit_prep_items enable row level security;

-- 준비는 담당 교사와 관리자의 작업 공간이다. 학생·보호자에게는 보이지 않는다
-- (학생이 보는 것은 수업에 고정된 내용뿐이다).
create policy "담당 교사·관리자만 회차 준비" on curriculum_unit_preps for all
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

create policy "담당 교사·관리자만 회차 준비 항목" on curriculum_unit_prep_items for all
  using (
    exists (
      select 1 from curriculum_unit_preps p
      join curriculum_overlay_units u on u.id = p.overlay_unit_id
      join student_curriculum_overlays o on o.id = u.overlay_id
      where p.id = prep_id and (is_admin() or is_active_teacher_for_enrollment(o.subject_enrollment_id))
    )
  )
  with check (
    exists (
      select 1 from curriculum_unit_preps p
      join curriculum_overlay_units u on u.id = p.overlay_unit_id
      join student_curriculum_overlays o on o.id = u.overlay_id
      where p.id = prep_id and (is_admin() or is_active_teacher_for_enrollment(o.subject_enrollment_id))
    )
  );

-- =========================================================================
-- 2. 회차 준비 → 실제 수업 연결
-- =========================================================================
-- 회차 준비를 실제 수업에 연결하면 기존 준비된 선택(session_prepared_selections)
-- 한 건이 그 수업에 staged로 만들어진다. 고정은 여기서 하지 않는다 — 수업
-- 시작까지는 계속 수정할 수 있어야 한다는 것이 확정 정책이다.
create or replace function public.link_unit_prep_to_session(
  p_overlay_unit_id uuid,
  p_session_id uuid,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare
  v_prep curriculum_unit_preps%rowtype;
  v_enrollment uuid;
  v_session_enrollment uuid;
  v_final_status v3_session_final_status;
  v_selection_id uuid;
  v_unit_row_id uuid;
  v_existing_status text;
  v_pos int := 0;
  v_item record;
begin
  select p.* into v_prep from curriculum_unit_preps p where p.overlay_unit_id = p_overlay_unit_id;
  if not found then
    raise exception '이 회차에는 아직 준비가 없습니다.';
  end if;

  select o.subject_enrollment_id into v_enrollment
  from curriculum_overlay_units u
  join student_curriculum_overlays o on o.id = u.overlay_id
  where u.id = p_overlay_unit_id;

  select s.subject_enrollment_id, s.final_status into v_session_enrollment, v_final_status
  from sessions s where s.id = p_session_id;
  if v_session_enrollment is null then
    raise exception '수업을 찾을 수 없습니다.';
  end if;
  if v_session_enrollment is distinct from v_enrollment then
    raise exception '다른 학생·과목의 회차는 이 수업에 연결할 수 없습니다.';
  end if;
  if v_final_status <> 'scheduled' then
    raise exception '이미 시작했거나 종료한 수업의 준비는 바꿀 수 없습니다.';
  end if;
  if not (
    exists (select 1 from profiles pr where pr.id = p_actor_id and pr.role = 'admin')
    or exists (select 1 from sessions s where s.id = p_session_id and s.teacher_id = p_actor_id)
  ) then
    raise exception '담당 수업에만 회차 준비를 연결할 수 있습니다.';
  end if;

  -- 이미 이 수업에 붙어 있는 선택이 있으면(재연결·중복 클릭) 그대로 돌려준다.
  select s.id, s.status into v_selection_id, v_existing_status
  from session_prepared_selections s
  where s.session_id = p_session_id and s.status <> 'archived';
  if v_selection_id is not null then
    if v_existing_status = 'pinned' then
      raise exception '이미 고정된 수업입니다.';
    end if;
    return v_selection_id;
  end if;

  -- session_prepared_selections.teacher_id는 BEFORE 트리거가 auth.uid()로
  -- 스탬프한다(20261232000000). service_role로 실행되는 이 함수에서는 그 값이
  -- 비어 있으므로, 인가를 이미 끝낸 행위자를 세션에 실어준다(트랜잭션 한정).
  perform set_config('request.jwt.claim.sub', p_actor_id::text, true);

  insert into session_prepared_selections (subject_enrollment_id, teacher_id, session_id, status)
  values (v_enrollment, p_actor_id, p_session_id, 'staged')
  returning id into v_selection_id;

  insert into session_prepared_selection_units (prepared_selection_id, overlay_unit_id, position)
  values (v_selection_id, p_overlay_unit_id, 1)
  returning id into v_unit_row_id;

  -- 회차에 달린 키워드를 그대로 검색 범위로 가져온다(준비 화면이 이미 그
  -- 키워드로 후보를 찾았으므로, pin 시점 재검증도 같은 범위로 통과한다).
  insert into session_prepared_selection_unit_keywords (prepared_selection_unit_id, keyword_id)
  select v_unit_row_id, k.keyword_id
  from curriculum_overlay_unit_keywords k
  where k.overlay_unit_id = p_overlay_unit_id;

  for v_item in
    select content_type, content_id from curriculum_unit_prep_items
    where prep_id = v_prep.id order by position asc
  loop
    v_pos := v_pos + 1;
    insert into session_prepared_selection_content_items
      (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
    values (v_selection_id, v_unit_row_id, v_item.content_type, v_item.content_id, v_pos);
  end loop;

  -- 연결 사실은 지금 바로 남긴다 — 준비 화면이 "이 회차가 어느 수업에 붙어
  -- 있는지"를 수업 시작 전에도 보여줘야 하기 때문이다. 고정(pin)도 같은 행을
  -- 쓰지만 on conflict do nothing이라 충돌하지 않는다.
  insert into session_curriculum_units (session_id, overlay_unit_id, role)
  values (p_session_id, p_overlay_unit_id, 'primary')
  on conflict (session_id, overlay_unit_id) do nothing;

  return v_selection_id;
end;
$$;
revoke execute on function public.link_unit_prep_to_session(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.link_unit_prep_to_session(uuid, uuid, uuid) to service_role;

comment on function public.link_unit_prep_to_session(uuid, uuid, uuid) is
  'P2/P3: 회차 준비를 실제 수업에 연결해 staged 준비된 선택을 만든다. 고정하지 않는다 — '
  '고정은 수업 시작 시 freeze_session_content_at_start()가 한다. 같은 수업에 두 번 호출해도 '
  '같은 선택을 돌려준다.';

-- =========================================================================
-- 3. 고정은 수업 시작에서만
-- =========================================================================
-- pin_session_selection()은 auth.uid() 기반 인가를 스스로 하는 "교사가 직접
-- 누르는" 경로다. 수업 시작은 service_role로 실행되고 호출자 인가를 이미
-- 끝낸 상태라 그 검사를 다시 통과할 수 없다(auth.uid()가 null). 그래서 시작
-- 시점 전용 진입점을 따로 둔다 — 검증·INSERT 본체는 pin_session_selection()을
-- 그대로 재사용한다(스냅샷 규칙이 두 벌로 갈라지지 않게).
create or replace function public.freeze_session_content_at_start(p_session_id uuid, p_actor_id uuid)
returns int
language plpgsql
security definer set search_path = public as $$
declare
  v_selection session_prepared_selections%rowtype;
  v_count int;
begin
  select * into v_selection
  from session_prepared_selections
  where session_id = p_session_id and status = 'staged';

  -- 준비가 없는 수업도 시작할 수 있어야 한다. 준비 없음은 오류가 아니다.
  if not found then
    return 0;
  end if;

  -- 포함된 콘텐츠가 하나도 없으면 고정할 것이 없다 — 이것도 시작을 막지 않는다.
  if not exists (
    select 1 from session_prepared_selection_content_items
    where prepared_selection_id = v_selection.id and included = true
  ) then
    return 0;
  end if;

  -- 시작을 누른 사람이 담당 교사·관리자라는 사실은 호출자(mark_lesson_session_started의
  -- 앱 경로)가 이미 확인했다. 여기서는 auth.uid()에 그 사람을 실어 기존 pin
  -- 함수의 인가 검사를 그대로 통과시킨다(검사를 우회하지 않고 충족시킨다).
  perform set_config('request.jwt.claim.sub', p_actor_id::text, true);
  select count(*) into v_count from public.pin_session_selection(p_session_id);
  return v_count;
end;
$$;
revoke execute on function public.freeze_session_content_at_start(uuid, uuid) from public, anon, authenticated;
grant execute on function public.freeze_session_content_at_start(uuid, uuid) to service_role;

comment on function public.freeze_session_content_at_start(uuid, uuid) is
  'P2/P3: 수업 시작 시점의 콘텐츠 고정. 준비가 없거나 비어 있으면 아무것도 하지 않고 0을 돌려준다 '
  '— 준비 없는 수업의 시작을 막지 않는다.';

-- mark_lesson_session_started가 상태를 live로 넘기기 "전에" 고정한다.
-- pin_session_selection()은 final_status='scheduled'만 허용하므로 순서가 중요하다.
-- 이 순서 덕분에 "시작은 됐는데 스냅샷이 없다"는 중간 상태도 생기지 않는다
-- (같은 트랜잭션이라 고정이 실패하면 시작도 함께 롤백된다).
create or replace function public.mark_lesson_session_started(p_session_id uuid, p_actor_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_session sessions%rowtype;
  v_reservation reservations%rowtype;
begin
  select * into v_session from sessions where id = p_session_id for update;
  if v_session.id is null then
    raise exception '세션을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;
  if v_session.final_status <> 'scheduled' then
    raise exception '이미 시작됐거나 종료된 세션입니다(현재 상태: %).', v_session.final_status using errcode = 'P0001';
  end if;

  select * into v_reservation from reservations where id = v_session.reservation_id;
  if v_reservation.status <> 'confirmed' then
    raise exception '확정된 예약의 세션만 시작할 수 있습니다.' using errcode = 'P0001';
  end if;

  -- P2/P3 3단계 — 콘텐츠와 버전은 여기서 단 한 번 고정된다.
  perform public.freeze_session_content_at_start(p_session_id, p_actor_id);

  update sessions
    set final_status = 'live', actual_start_at = coalesce(actual_start_at, now())
    where id = p_session_id;
end;
$$;
revoke execute on function public.mark_lesson_session_started(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mark_lesson_session_started(uuid, uuid) to service_role;

-- =========================================================================
-- 4. 교사 준비 초안 공개를 멱등하게
-- =========================================================================
-- 지금까지는 같은 초안을 두 번 공개하면 같은 필기가 두 벌 들어갔다
-- (session_annotation_events는 append-only라 되돌릴 수도 없다).
create table published_unit_draft_marks (
  draft_id uuid not null references curriculum_unit_annotation_drafts (id) on delete cascade,
  session_id uuid not null references sessions (id) on delete cascade,
  published_by uuid references profiles (id),
  stroke_count int not null default 0,
  published_at timestamptz not null default now(),
  primary key (draft_id, session_id)
);

comment on table published_unit_draft_marks is
  'P3: 어떤 준비 초안이 어떤 수업에 이미 공개됐는지. 중복 클릭·재시도로 같은 필기가 두 번 '
  '들어가는 것을 막는다. 공개된 필기는 복사본이므로 이후 원본 초안을 고쳐도 바뀌지 않는다.';

alter table published_unit_draft_marks enable row level security;
create policy "담당 교사·관리자 조회" on published_unit_draft_marks for select
  using (public.is_session_teacher_v3(session_id) or is_admin());
revoke insert, update, delete, truncate on published_unit_draft_marks from public, anon, authenticated;
grant select on published_unit_draft_marks to authenticated;

create or replace function public.publish_teacher_draft_to_session(
  p_draft_id uuid,
  p_session_id uuid,
  p_actor_id uuid
)
returns int
language plpgsql
security definer set search_path = public as $$
declare
  v_draft curriculum_unit_annotation_drafts%rowtype;
  v_stroke jsonb;
  v_count int := 0;
begin
  select * into v_draft from curriculum_unit_annotation_drafts where id = p_draft_id;
  if not found then
    raise exception '존재하지 않는 준비 초안입니다.';
  end if;
  if v_draft.author_id <> p_actor_id then
    raise exception '본인이 만든 준비 초안만 공개할 수 있습니다.';
  end if;
  if not exists (select 1 from sessions s where s.id = p_session_id and s.teacher_id = p_actor_id) then
    raise exception '담당 수업에만 준비 초안을 공개할 수 있습니다.';
  end if;

  -- 멱등성의 핵심 — 먼저 표식을 잡는다. 두 번째 호출은 여기서 걸려 0을
  -- 돌려주고 필기를 한 줄도 더 쓰지 않는다. 동시 클릭도 기본키가 막는다.
  begin
    insert into published_unit_draft_marks (draft_id, session_id, published_by)
    values (p_draft_id, p_session_id, p_actor_id);
  exception when unique_violation then
    return 0;
  end;

  -- 여기서 복사한다 — 원본 초안을 참조하지 않는다. 그래서 나중에 초안을
  -- 고쳐도 이미 공개한 수업 필기는 그대로 남는다.
  for v_stroke in select * from jsonb_array_elements(v_draft.strokes)
  loop
    insert into session_annotation_events (session_id, author_id, event_type, payload, scope, curriculum_doc_id)
    values (p_session_id, p_actor_id, 'stroke', v_stroke, 'teacher_shared', v_draft.curriculum_doc_id);
    v_count := v_count + 1;
  end loop;

  update published_unit_draft_marks set stroke_count = v_count
  where draft_id = p_draft_id and session_id = p_session_id;

  return v_count;
end;
$$;
revoke execute on function public.publish_teacher_draft_to_session(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.publish_teacher_draft_to_session(uuid, uuid, uuid) to service_role;
