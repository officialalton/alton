-- P3 7단계 — 제품 오너 확정(2026-09-12, 최신). 앞선 "학생만 보는 개인 교재 필기"
-- 정책을 대체한다.
--
-- 교재 위에는 **두 개의 공유 레이어**가 있다.
--   학생 필기(student_shared)   — 학생이 쓰고, 학생·담당 교사·연결된 보호자가 본다.
--   선생님 필기(teacher_shared) — 교사가 쓰고, 같은 사람들이 본다.
--
-- 없어지는 것은 "비공개"라는 구분이지 학생의 교재 필기 자체가 아니다.
-- 이미 student_private으로 쌓인 기록은 **그대로 둔다** — 자동 공개하지도, 지우지도
-- 않는다. 그 범위는 여전히 본인만 읽는다(정책 그대로). 앞으로 쓰는 학생 교재
-- 필기만 student_shared로 간다.

alter table session_annotation_events
  drop constraint if exists session_annotation_events_scope_check;
alter table session_annotation_events
  add constraint session_annotation_events_scope_check
  check (scope in (
    'teacher_shared',
    'student_shared',
    -- 보존 전용: 정책 변경 전에 쌓인 기록이 여기 남아 있다. 새로 쓰지 않는다.
    'student_private',
    'problem_student',
    'problem_teacher_feedback'
  ));

alter table session_annotation_events
  drop constraint if exists session_annotation_events_scope_shape_check;
alter table session_annotation_events
  add constraint session_annotation_events_scope_shape_check
  check (
    (scope = 'teacher_shared' and owner_student_id is null and problem_id is null and problem_work_id is null)
    -- 학생 필기는 누구의 필기인지 남긴다(한 수업에 학생이 여럿일 수 있고,
    -- 본인만 수정·삭제할 수 있어야 하기 때문이다).
    or (scope = 'student_shared' and owner_student_id is not null and problem_id is null and problem_work_id is null)
    or (scope = 'student_private' and owner_student_id is not null and problem_id is null and problem_work_id is null)
    or (scope in ('problem_student', 'problem_teacher_feedback')
        and owner_student_id is not null and problem_id is not null and problem_work_id is not null)
  );

-- =========================================================================
-- 조회 — 교재 두 레이어와 문제 풀이는 같은 사람들이 본다
-- =========================================================================
drop policy if exists "필기 범위별 조회" on session_annotation_events;
create policy "필기 범위별 조회" on session_annotation_events for select
  using (
    case scope
      when 'teacher_shared' then
        public.is_session_teacher_v3(session_id)
        or public.is_session_student_v3(session_id)
        or public.is_session_guardian_v3(session_id)
        or is_admin()
      when 'student_shared' then
        public.is_session_teacher_v3(session_id)
        or public.is_session_student_v3(session_id)
        or public.is_session_guardian_v3(session_id)
        or is_admin()
      -- 보존 전용 과거 기록 — 쓴 본인만 계속 읽는다(자동 공개하지 않는다).
      when 'student_private' then owner_student_id = auth.uid()
      when 'problem_student' then
        owner_student_id = auth.uid()
        or public.is_session_teacher_v3(session_id)
        or public.is_session_guardian_v3(session_id)
        or is_admin()
      when 'problem_teacher_feedback' then
        owner_student_id = auth.uid()
        or public.is_session_teacher_v3(session_id)
        or public.is_session_guardian_v3(session_id)
        or is_admin()
      else false
    end
  );

-- =========================================================================
-- 쓰기 — 각자 자기 레이어만
-- =========================================================================
drop policy if exists "필기 범위별 기록" on session_annotation_events;
create policy "필기 범위별 기록" on session_annotation_events for insert
  with check (
    author_id = auth.uid()
    and public.current_account_access_allowed()
    and case scope
      -- 선생님 필기: 담당 교사·관리자만.
      when 'teacher_shared' then
        public.is_session_teacher_v3(session_id) or is_admin()
      -- 학생 필기: 그 수업의 학생 본인만. 교사도 학생 레이어에 쓰지 않는다.
      when 'student_shared' then
        owner_student_id = auth.uid() and public.is_session_student_v3(session_id)
      -- 보존 전용 범위에는 더 이상 쓰지 않는다.
      when 'student_private' then false
      when 'problem_student' then owner_student_id = auth.uid() and event_type <> 'clear_all'
      when 'problem_teacher_feedback' then public.is_session_teacher_v3(session_id)
      else false
    end
  );

comment on policy "필기 범위별 기록" on session_annotation_events is
  'P3(2026-09-12 확정): 학생은 학생 필기 레이어에, 교사는 선생님 필기 레이어에만 쓴다. '
  '보호자는 어떤 범위에도 쓸 수 없다. student_private은 과거 기록 보존 전용이라 새로 쓰지 않는다.';

-- 범위를 지정해 남기는 RPC도 새 범위를 받는다.
create or replace function public.append_scoped_stroke_events(
  p_session_id uuid,
  p_segments jsonb,
  p_scope text,
  p_curriculum_doc_id uuid default null,
  p_problem_id uuid default null,
  p_problem_work_id uuid default null
)
returns setof session_annotation_events
language plpgsql
as $$
declare
  v_author uuid := auth.uid();
  v_owner uuid;
  v_seg jsonb;
  v_row session_annotation_events;
begin
  if v_author is null then
    raise exception '인증되지 않은 사용자입니다.';
  end if;

  if p_scope not in ('teacher_shared', 'student_shared', 'problem_student', 'problem_teacher_feedback') then
    raise exception '알 수 없는 필기 범위입니다: %', p_scope;
  end if;

  if jsonb_typeof(p_segments) is distinct from 'array' or jsonb_array_length(p_segments) = 0 then
    raise exception 'p_segments는 비어있지 않은 jsonb 배열이어야 합니다.';
  end if;

  -- 주인은 클라이언트가 정하지 못한다. 학생 필기의 주인은 쓰는 본인이고,
  -- 문제 풀이 범위의 주인은 그 풀이판의 학생이다(교사 피드백도 마찬가지).
  if p_scope = 'student_shared' then
    v_owner := v_author;
  elsif p_scope in ('problem_student', 'problem_teacher_feedback') then
    if p_problem_work_id is null then
      raise exception '문제 풀이 필기는 어떤 풀이판에 속하는지 지정해야 합니다.';
    end if;
    select student_id into v_owner from session_problem_work where id = p_problem_work_id;
    if v_owner is null then
      raise exception '존재하지 않는 풀이판입니다.';
    end if;
  else
    v_owner := null;
  end if;

  for v_seg in
    select value
    from jsonb_array_elements(p_segments) with ordinality as t(value, ord)
    order by ord
  loop
    if not (
      v_seg ? 'x0' and v_seg ? 'y0' and v_seg ? 'x1' and v_seg ? 'y1'
      and v_seg ? 'color' and v_seg ? 'tool'
    ) then
      raise exception 'stroke 세그먼트 payload에 필수 필드(x0,y0,x1,y1,color,tool)가 없습니다: %', v_seg;
    end if;

    insert into session_annotation_events
      (session_id, author_id, event_type, payload, scope, curriculum_doc_id, problem_id, problem_work_id, owner_student_id)
    values
      (p_session_id, v_author, 'stroke', v_seg, p_scope, p_curriculum_doc_id, p_problem_id, p_problem_work_id, v_owner)
    returning * into v_row;

    return next v_row;
  end loop;

  return;
end;
$$;
revoke all on function public.append_scoped_stroke_events(uuid, jsonb, text, uuid, uuid, uuid) from public, anon;
grant execute on function public.append_scoped_stroke_events(uuid, jsonb, text, uuid, uuid, uuid) to authenticated;
