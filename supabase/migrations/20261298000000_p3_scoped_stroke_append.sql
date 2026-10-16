-- P3 3단계 — 제품 오너 피드백 4: 필기 권한을 저장·조회·실시간 공유에 똑같이
-- 적용한다.
--
-- 지금까지 append_stroke_events()는 범위를 받지 않아 모든 필기가 기본값
-- (teacher_shared, 모두가 보는 공용 필기)으로 들어갔다. 조회 쪽에는 범위별
-- 정책이 있는데 쓰기 쪽에 범위를 지정할 방법이 없으니, 학생 개인 교재 필기를
-- 만들 수단 자체가 없었던 셈이다.
--
-- SECURITY INVOKER를 유지한다 — 호출자 권한 그대로 실행되어 20261292000000/
-- 20261294000000의 범위별 INSERT 정책과 정합성 트리거가 매 행에 그대로 걸린다.
-- 이 함수는 정책을 우회하지 않고, 정책이 판단할 수 있도록 범위를 채워줄 뿐이다.
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

  if p_scope not in ('teacher_shared', 'student_private', 'problem_student', 'problem_teacher_feedback') then
    raise exception '알 수 없는 필기 범위입니다: %', p_scope;
  end if;

  if jsonb_typeof(p_segments) is distinct from 'array' or jsonb_array_length(p_segments) = 0 then
    raise exception 'p_segments는 비어있지 않은 jsonb 배열이어야 합니다.';
  end if;

  -- 개인 범위의 주인은 클라이언트가 정하지 못한다. student_private는 언제나
  -- 쓰는 사람 본인이 주인이고, 문제 풀이 범위의 주인은 그 풀이판의 학생이다
  -- (교사 피드백도 같은 풀이판에 붙으므로 주인은 여전히 그 학생이다).
  if p_scope = 'student_private' then
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

comment on function public.append_scoped_stroke_events(uuid, jsonb, text, uuid, uuid, uuid) is
  'P3: 범위를 지정해 필기를 append한다. SECURITY INVOKER라 범위별 INSERT 정책이 그대로 적용되고, '
  '개인 범위의 주인(owner_student_id)은 클라이언트 입력이 아니라 서버가 결정한다.';

revoke all on function public.append_scoped_stroke_events(uuid, jsonb, text, uuid, uuid, uuid) from public, anon;
grant execute on function public.append_scoped_stroke_events(uuid, jsonb, text, uuid, uuid, uuid) to authenticated;
