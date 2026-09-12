-- P2/P3 4단계 — 제품 오너 피드백 1·3·4.
--
--   (1) 보호자는 요약만 본다. 세션 관계자 판정(is_session_related_v3)에는
--       보호자가 포함되지만, 그 판정은 "취소·사고 보고" 같은 운영 정보를
--       위한 것이다. 필기 원본·교재 본문·문제·풀이판은 별도 권한으로 잠근다.
--   (3) 회차 준비를 고친 뒤 수업이 시작되면 "시작 시점의 최신 준비"가 고정돼야
--       한다. 지금은 연결 시점에 복사한 구성이 그대로 얼어붙는다.
--   (4) 시작과 고정은 함께 성공/실패한다. 준비를 불러오지 못한 상황을
--       "준비 없음"으로 오인해 빈 구성으로 시작하지 않는다.

-- =========================================================================
-- 1. 보호자 열람 범위 — 요약까지, 원본은 제외
-- =========================================================================
-- 학생이 이 수업의 학생인지 — 위 정책에서 보호자를 빼기 위해 필요하다
-- (is_session_related_v3는 보호자를 포함하므로 그대로 쓸 수 없다).
create or replace function public.is_session_student_v3(p_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sessions s
    join public.subject_enrollments se on se.id = s.subject_enrollment_id
    where s.id = p_session_id and se.child_id = auth.uid()
  );
$$;
revoke execute on function public.is_session_student_v3(uuid) from public, anon;
grant execute on function public.is_session_student_v3(uuid) to authenticated;

-- 필기 원본. teacher_shared(공용 필기)도 보호자에게는 닫는다.
drop policy if exists "필기 범위별 조회" on session_annotation_events;
create policy "필기 범위별 조회" on session_annotation_events for select
  using (
    case scope
      -- 공용 필기: 수업 당사자(교사·학생)와 관리자. **보호자는 제외** —
      -- 보호자가 보는 것은 교사가 작성한 수업 요약이지 필기 원본이 아니다.
      when 'teacher_shared' then
        public.is_session_teacher_v3(session_id)
        or public.is_session_student_v3(session_id)
        or is_admin()
      -- 학생 개인 교재 필기: 본인만. 교사·보호자·관리자 모두 제외한다.
      when 'student_private' then owner_student_id = auth.uid()
      -- 문제 풀이: 학생 본인과 담당 교사. 보호자는 제외.
      when 'problem_student' then
        owner_student_id = auth.uid() or public.is_session_teacher_v3(session_id) or is_admin()
      -- 교사 피드백 레이어: 학생 본인과 담당 교사.
      when 'problem_teacher_feedback' then
        owner_student_id = auth.uid() or public.is_session_teacher_v3(session_id) or is_admin()
      else false
    end
  );


-- 레거시 공용 캔버스(canvas_annotations)도 같은 기준으로 잠근다. 여기에는
-- 범위 개념이 없어 보호자에게 열어두면 필기 원본이 그대로 보인다.
drop policy if exists "관련자 조회" on canvas_annotations;
create policy "관련자 조회" on canvas_annotations for select
  using (
    public.is_session_teacher_v3(session_id)
    or public.is_session_student_v3(session_id)
    or is_admin()
    -- 레거시 세션(legacy_sessions)은 v3 판정 함수가 대상으로 삼지 않으므로
    -- 기존 판정을 유지하되, 보호자만 뺀다.
    or (
      public.is_session_related(session_id)
      and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'parent')
    )
  );

comment on policy "관련자 조회" on canvas_annotations is
  'P3: 보호자는 필기 원본을 보지 않는다(요약만). 교사·학생·관리자만 조회한다.';

-- =========================================================================
-- 2. 시작 시점에 "최신 준비"를 다시 맞춘 뒤 고정한다
-- =========================================================================
-- 연결(link_unit_prep_to_session)은 그 시점의 준비를 복사한다. 그 뒤 교사가
-- 준비를 더 고쳐도 복사본은 그대로였다 — 확정 정책("시작 시점의 최신 준비를
-- 고정")과 어긋난다. 그래서 고정 직전에 원본 회차 준비로 다시 맞춘다.
--
-- 같은 회차를 여러 수업에 연결한 경우에도 각 수업이 자기 시작 시점의 준비를
-- 읽으므로 자연스럽게 각각 다른 스냅샷이 된다.
create or replace function public.refresh_staged_selection_from_unit_prep(p_selection_id uuid)
returns int
language plpgsql
security definer set search_path = public as $$
declare
  v_unit_row record;
  v_prep_id uuid;
  v_pos int := 0;
  v_item record;
begin
  select id, overlay_unit_id into v_unit_row
  from session_prepared_selection_units
  where prepared_selection_id = p_selection_id
  order by position asc
  limit 1;

  if not found then
    raise exception '연결된 회차가 없습니다 — 준비 구성을 불러오지 못했습니다.';
  end if;

  select id into v_prep_id from curriculum_unit_preps where overlay_unit_id = v_unit_row.overlay_unit_id;
  -- 준비 원본을 찾지 못하면 "준비 없음"이 아니라 오류다. 빈 구성으로 조용히
  -- 시작하면 교사가 준비한 내용 없이 수업이 열린다(피드백 4).
  if v_prep_id is null then
    raise exception '이 회차의 준비 구성을 불러오지 못했습니다.';
  end if;

  -- 검색 범위(키워드)도 지금 회차 기준으로 다시 맞춘다.
  delete from session_prepared_selection_unit_keywords where prepared_selection_unit_id = v_unit_row.id;
  insert into session_prepared_selection_unit_keywords (prepared_selection_unit_id, keyword_id)
  select v_unit_row.id, k.keyword_id
  from curriculum_overlay_unit_keywords k
  where k.overlay_unit_id = v_unit_row.overlay_unit_id;

  delete from session_prepared_selection_content_items where prepared_selection_id = p_selection_id;
  for v_item in
    select content_type, content_id from curriculum_unit_prep_items
    where prep_id = v_prep_id order by position asc
  loop
    v_pos := v_pos + 1;
    insert into session_prepared_selection_content_items
      (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
    values (p_selection_id, v_unit_row.id, v_item.content_type, v_item.content_id, v_pos);
  end loop;

  return v_pos;
end;
$$;
revoke execute on function public.refresh_staged_selection_from_unit_prep(uuid) from public, anon, authenticated;
grant execute on function public.refresh_staged_selection_from_unit_prep(uuid) to service_role;

create or replace function public.freeze_session_content_at_start(p_session_id uuid, p_actor_id uuid)
returns int
language plpgsql
security definer set search_path = public as $$
declare
  v_selection session_prepared_selections%rowtype;
  v_items int;
  v_count int;
begin
  select * into v_selection
  from session_prepared_selections
  where session_id = p_session_id and status = 'staged';

  -- 연결된 준비가 아예 없는 수업은 그냥 시작한다. 이것만이 "준비 없음"이다.
  if not found then
    return 0;
  end if;

  -- 여기부터는 교사가 회차를 연결해 둔 수업이다. 준비 구성을 못 읽으면
  -- 예외를 던져 시작 자체를 함께 롤백한다(피드백 4 — 함께 성공하거나 함께 실패).
  v_items := public.refresh_staged_selection_from_unit_prep(v_selection.id);

  -- 교사가 자료를 하나도 담지 않은 회차는 빈 채로 시작할 수 있다(오류가 아니다).
  if v_items = 0 then
    return 0;
  end if;

  perform set_config('request.jwt.claim.sub', p_actor_id::text, true);
  select count(*) into v_count from public.pin_session_selection(p_session_id);
  return v_count;
end;
$$;
revoke execute on function public.freeze_session_content_at_start(uuid, uuid) from public, anon, authenticated;
grant execute on function public.freeze_session_content_at_start(uuid, uuid) to service_role;

comment on function public.freeze_session_content_at_start(uuid, uuid) is
  'P2/P3: 수업 시작 시점의 콘텐츠 고정. 연결된 준비가 없으면 그냥 시작하고, 연결된 준비가 있으면 '
  '그 시점의 최신 회차 준비로 다시 맞춘 뒤 고정한다. 준비 구성을 읽지 못하면 예외를 던져 '
  '수업 시작과 함께 롤백한다 — 빈 구성으로 시작하지 않는다.';
