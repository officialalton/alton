-- 2026-09-14 UAT — "문제 화면에도 필기를 그대로 쓰고 싶다. 좌우 여백까지 다."
--
-- 문제 한 장(수업 문제든 과제든) 위에 교사 공유·학생 공유 두 레이어를 얹는다. PDF 페이지 필기와 같은 구조로,
-- 대상만 (수업, 문제) 다. 풀이판(session_problem_work) 필기와는 다르다 — 그것은 학생 한 명의 답안이고,
-- 이것은 문제 위에 함께 그리는 판서다.
--
-- 저장 모양: scope in ('teacher_shared','student_shared') + problem_id 있음 + problem_work_id 없음 + curriculum_doc_id 없음.
-- 지금까지는 그 두 범위에 problem_id 가 있으면 안 됐다(모양 제약) — 이 조합을 허용한다.

alter table session_annotation_events
  drop constraint if exists session_annotation_events_scope_shape_check;
alter table session_annotation_events
  add constraint session_annotation_events_scope_shape_check
  check (
    (scope = 'teacher_shared' and owner_student_id is null and problem_work_id is null)
    or (scope = 'student_shared' and owner_student_id is not null and problem_work_id is null)
    or (scope = 'student_private' and owner_student_id is not null and problem_id is null and problem_work_id is null)
    or (scope in ('problem_student', 'problem_teacher_feedback')
        and owner_student_id is not null and problem_id is not null and problem_work_id is not null)
  );

create or replace function public.append_problem_page_stroke_events(
  p_session_id uuid,
  p_segments jsonb,
  p_scope text,
  p_problem_id uuid
)
returns setof session_annotation_events
language plpgsql
as $$
declare
  v_author uuid := auth.uid();
  v_owner uuid;
  v_seg jsonb;
  v_row session_annotation_events;
  v_client_id uuid;
  v_type text;
begin
  if v_author is null then
    raise exception '인증되지 않은 사용자입니다.';
  end if;
  if p_scope not in ('teacher_shared', 'student_shared') then
    raise exception '문제 필기는 교사 공유·학생 공유 범위만 있습니다: %', p_scope;
  end if;
  if jsonb_typeof(p_segments) is distinct from 'array' or jsonb_array_length(p_segments) = 0 then
    raise exception 'p_segments는 비어있지 않은 jsonb 배열이어야 합니다.';
  end if;
  -- 이 수업의 문제인가(고정본 또는 과제).
  if not exists (
    select 1 from session_content_manifest cm
    where cm.session_id = p_session_id and cm.content_type = 'problem' and cm.content_id = p_problem_id
  ) and not exists (
    select 1 from session_homework_items h where h.session_id = p_session_id and h.problem_id = p_problem_id
  ) then
    raise exception '이 수업의 문제가 아닙니다.';
  end if;

  v_owner := case when p_scope = 'student_shared' then v_author else null end;

  for v_seg in
    select value from jsonb_array_elements(p_segments) with ordinality as t(value, ord) order by ord
  loop
    if v_seg->>'tool' = 'clear' then
      v_type := 'clear_all';
    else
      v_type := 'stroke';
      if not (v_seg ? 'x0' and v_seg ? 'y0' and v_seg ? 'x1' and v_seg ? 'y1' and v_seg ? 'color' and v_seg ? 'tool') then
        raise exception 'stroke 세그먼트 payload에 필수 필드(x0,y0,x1,y1,color,tool)가 없습니다: %', v_seg;
      end if;
      if v_seg->>'tool' = 'text' and coalesce(btrim(v_seg->>'text'), '') = '' then
        raise exception '텍스트 필기에 글이 없습니다.';
      end if;
    end if;
    v_client_id := null;
    begin
      v_client_id := (v_seg->>'eventId')::uuid;
    exception when others then
      v_client_id := null;
    end;

    insert into session_annotation_events
      (session_id, author_id, event_type, payload, scope, problem_id, owner_student_id, client_event_id)
    values
      (p_session_id, v_author, v_type, v_seg - 'eventId', p_scope, p_problem_id, v_owner, v_client_id)
    on conflict (session_id, client_event_id) where client_event_id is not null do nothing
    returning * into v_row;

    if v_row.seq is not null then
      return next v_row;
    end if;
    v_row := null;
  end loop;
  return;
end;
$$;
revoke all on function public.append_problem_page_stroke_events(uuid, jsonb, text, uuid) from public, anon;
grant execute on function public.append_problem_page_stroke_events(uuid, jsonb, text, uuid) to authenticated;
comment on function public.append_problem_page_stroke_events(uuid, jsonb, text, uuid) is
  '2026-09-14: 문제 한 장 위의 교사·학생 공유 필기. PDF 페이지 필기(append_page_stroke_events)와 같은 규약(eventId 중복 방지, tool clear/text).';
