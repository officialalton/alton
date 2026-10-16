-- 2026-09-14 UAT — "채점한 적 없는 과제가 채점돼 있다."
-- 원인: 과제 답안이 수업 문제와 같은 session_problem_work 행을 썼다. 같은 문제를 수업에서도 다루고 과제로도 내면
-- 수업 채점이 과제에 그대로 보였다. 과제 답안은 수업 답안과 **따로** 둔다(source).

alter table session_problem_work
  add column if not exists source text not null default 'lesson' check (source in ('lesson', 'homework'));
comment on column session_problem_work.source is
  '이 풀이판이 수업 문제(lesson) 것인지 과제(homework) 것인지. 같은 문제라도 과제는 처음부터 다시 풀고 따로 채점한다.';

alter table session_problem_work drop constraint if exists session_problem_work_session_id_student_id_problem_id_attem_key;
alter table session_problem_work
  add constraint session_problem_work_session_student_problem_source_attempt_key
  unique (session_id, student_id, problem_id, source, attempt_no);

create or replace function public.start_problem_work(
  p_session_id uuid,
  p_student_id uuid,
  p_problem_id uuid,
  p_new_attempt boolean default false,
  p_source text default 'lesson'
)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare
  v_existing session_problem_work%rowtype;
  v_next int;
  v_version_id uuid;
  v_id uuid;
begin
  if p_source not in ('lesson', 'homework') then
    raise exception '풀이판 출처는 lesson 또는 homework 입니다: %', p_source;
  end if;
  if not exists (select 1 from sessions where id = p_session_id) then
    raise exception '존재하지 않는 수업입니다.';
  end if;
  select * into v_existing from session_problem_work
    where session_id = p_session_id and student_id = p_student_id and problem_id = p_problem_id and source = p_source
    order by attempt_no desc limit 1;
  if found and not p_new_attempt then
    return v_existing.id;
  end if;
  v_next := coalesce(v_existing.attempt_no, 0) + 1;
  -- 버전: 과제면 발급본 우선, 수업이면 고정본 우선. 없으면 현재 공개본.
  if p_source = 'homework' then
    select coalesce(
      (select h.problem_version_id from session_homework_items h
        where h.session_id = p_session_id and h.problem_id = p_problem_id and h.problem_version_id is not null limit 1),
      (select p.published_version_id from problems p where p.id = p_problem_id)
    ) into v_version_id;
  else
    select coalesce(
      (select m.problem_version_id from session_content_manifest m
        where m.session_id = p_session_id and m.content_id = p_problem_id and m.problem_version_id is not null limit 1),
      (select p.published_version_id from problems p where p.id = p_problem_id)
    ) into v_version_id;
  end if;
  insert into session_problem_work (session_id, student_id, problem_id, problem_version_id, attempt_no, source)
  values (p_session_id, p_student_id, p_problem_id, v_version_id, v_next, p_source)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.start_problem_work(uuid, uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.start_problem_work(uuid, uuid, uuid, boolean, text) to service_role;

-- 예전 4개 인수 버전은 지운다 — 남겨 두면 4개 인수 호출이 "not unique" 가 된다. 5개 인수 버전의 기본값이 대신한다.
drop function if exists public.start_problem_work(uuid, uuid, uuid, boolean);

-- 과제 회수 조건·발급 시 '이미 풀어봄' 표시는 과제 출처 기준.
create or replace function public.withdraw_homework_item(p_item_id uuid)
returns void
language plpgsql
security definer set search_path = public as $$
declare
  v_item session_homework_items%rowtype;
  v_enrollment uuid;
begin
  if auth.uid() is null then
    raise exception '인증되지 않은 사용자입니다.';
  end if;
  select * into v_item from session_homework_items where id = p_item_id;
  if not found then
    raise exception '과제 항목을 찾을 수 없습니다.';
  end if;
  select subject_enrollment_id into v_enrollment from sessions where id = v_item.session_id;
  if not (public.is_admin() or public.is_active_teacher_for_enrollment(v_enrollment)) then
    raise exception '담당 선생님만 과제를 회수할 수 있습니다.';
  end if;
  if exists (
    select 1 from session_problem_work w
    where w.session_id = v_item.session_id and w.student_id = v_item.student_id and w.problem_id = v_item.problem_id
      and w.source = 'homework'
  ) then
    raise exception '학생이 이미 풀기 시작한 과제는 회수할 수 없습니다.';
  end if;
  delete from session_homework_items where id = p_item_id;
end;
$$;

-- 문제 위 공유 필기도 수업/과제를 따로 둔다(2026-09-14 제품 오너: "같은 문제라도 개별적으로").
alter table session_annotation_events
  add column if not exists problem_context text check (problem_context in ('lesson', 'homework'));
comment on column session_annotation_events.problem_context is
  '문제 한 장 위의 공유 필기가 수업 문제 화면 것인지 과제 화면 것인지. 풀이판·PDF 필기에는 없다.';

create or replace function public.append_problem_page_stroke_events(
  p_session_id uuid,
  p_segments jsonb,
  p_scope text,
  p_problem_id uuid,
  p_context text default 'lesson'
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
  if p_context not in ('lesson', 'homework') then
    raise exception '문제 필기 문맥은 lesson 또는 homework 입니다: %', p_context;
  end if;
  if jsonb_typeof(p_segments) is distinct from 'array' or jsonb_array_length(p_segments) = 0 then
    raise exception 'p_segments는 비어있지 않은 jsonb 배열이어야 합니다.';
  end if;
  if p_context = 'lesson' and not exists (
    select 1 from session_content_manifest cm
    where cm.session_id = p_session_id and cm.content_type = 'problem' and cm.content_id = p_problem_id
  ) then
    raise exception '이 수업의 문제가 아닙니다.';
  end if;
  if p_context = 'homework' and not exists (
    select 1 from session_homework_items h where h.session_id = p_session_id and h.problem_id = p_problem_id
  ) then
    raise exception '이 수업의 과제가 아닙니다.';
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
      (session_id, author_id, event_type, payload, scope, problem_id, owner_student_id, client_event_id, problem_context)
    values
      (p_session_id, v_author, v_type, v_seg - 'eventId', p_scope, p_problem_id, v_owner, v_client_id, p_context)
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
drop function if exists public.append_problem_page_stroke_events(uuid, jsonb, text, uuid);
revoke all on function public.append_problem_page_stroke_events(uuid, jsonb, text, uuid, text) from public, anon;
grant execute on function public.append_problem_page_stroke_events(uuid, jsonb, text, uuid, text) to authenticated;
