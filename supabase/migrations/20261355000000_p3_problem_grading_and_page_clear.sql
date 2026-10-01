-- 2026-09-14 제품 오너 UAT(학생 포털 문제 화면) — 문제 풀이·채점 흐름.
-- docs/2026-09-14-problem-answer-grading-and-pdf-text-notes.md
--
--   1. 객관식은 선택지 클릭이 곧 답이다. 서버가 고정 버전의 정답과 비교해 자동 채점한다.
--      채점 전에는 다른 선택지로 바꿀 수 있다(서술 답안·필기 경계는 그대로 고정).
--   2. 정답·해설은 **교사가 채점을 끝낸 뒤**에만 학생에게 열린다. 채점 기록이 그 근거다.
--   3. 서술형·풀이형은 교사가 채점한다(정답/부분/오답 + 한마디).
--   4. PDF 페이지 필기 "전체 지우기" = clear_all 이벤트(같은 RPC, tool:'clear').

alter table session_problem_work
  add column if not exists auto_correct boolean,
  add column if not exists grade text check (grade in ('correct', 'partial', 'incorrect')),
  add column if not exists grade_comment text,
  add column if not exists graded_at timestamptz,
  add column if not exists graded_by uuid references profiles (id);

comment on column session_problem_work.auto_correct is
  '객관식 자동 채점 결과(고정 버전의 correct_index 와 비교). 서술형·풀이형은 null.';
comment on column session_problem_work.grade is
  '교사 채점. 이 값이 있으면(graded_at) 학생에게 정답·해설이 열린다.';

-- 고정 트리거 완화: 채점 전이면 객관식 선택지(와 자동 채점 결과)만 바꿀 수 있다.
create or replace function public.freeze_problem_attempt_on_submit()
returns trigger language plpgsql as $$
begin
  if old.submitted_at is not null then
    if new.submitted_at is distinct from old.submitted_at
       or new.submitted_text is distinct from old.submitted_text
       or new.submitted_stroke_seq is distinct from old.submitted_stroke_seq then
      raise exception '이미 제출한 풀이입니다 — 답안과 제출 시점 필기는 바꿀 수 없습니다. 다시 풀려면 새 풀이를 시작하세요.';
    end if;
    if new.submitted_choice_index is distinct from old.submitted_choice_index
       and old.graded_at is not null then
      raise exception '채점이 끝난 문제의 답은 바꿀 수 없습니다.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.submit_problem_attempt(
  p_work_id uuid,
  p_actor_id uuid,
  p_choice_index int default null,
  p_text text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_work session_problem_work%rowtype;
  v_seq bigint;
  v_correct int;
  v_auto boolean;
begin
  select * into v_work from session_problem_work where id = p_work_id for update;
  if not found then
    raise exception '풀이판을 찾을 수 없습니다.';
  end if;
  if v_work.student_id <> p_actor_id then
    raise exception '본인 풀이만 제출할 수 있습니다.';
  end if;

  -- 자동 채점 — 이 풀이판이 고정한 버전의 정답과 비교한다. 정답이 없는 문제(서술형·풀이형)는 null.
  if p_choice_index is not null then
    select v.correct_index into v_correct from problem_versions v where v.id = v_work.problem_version_id;
    if v_correct is null then
      select v.correct_index into v_correct
      from problems p join problem_versions v on v.id = p.published_version_id
      where p.id = v_work.problem_id;
    end if;
    v_auto := case when v_correct is null then null else (v_correct = p_choice_index) end;
  end if;

  if v_work.submitted_at is not null then
    -- 객관식 재선택: 채점 전이면 답만 바꾼다(트리거가 채점 뒤를 막는다).
    if p_choice_index is not null and p_choice_index is distinct from v_work.submitted_choice_index then
      if v_work.graded_at is not null then
        raise exception '채점이 끝난 문제의 답은 바꿀 수 없습니다.';
      end if;
      update session_problem_work
        set submitted_choice_index = p_choice_index, auto_correct = v_auto
        where id = p_work_id;
    end if;
    return;
  end if;

  select max(seq) into v_seq
  from session_annotation_events
  where problem_work_id = p_work_id and scope = 'problem_student';

  update session_problem_work
  set submitted_at = now(),
      submitted_choice_index = p_choice_index,
      submitted_text = p_text,
      submitted_stroke_seq = v_seq,
      auto_correct = v_auto
  where id = p_work_id;
end;
$$;

-- 교사 채점. 담당 교사·관리자만. 다시 채점할 수 있다.
create or replace function public.grade_problem_attempt(
  p_work_id uuid,
  p_grade text,
  p_comment text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_work session_problem_work%rowtype;
  v_grade text := p_grade;
begin
  if auth.uid() is null then
    raise exception '인증되지 않은 사용자입니다.';
  end if;
  select * into v_work from session_problem_work where id = p_work_id for update;
  if not found then
    raise exception '풀이판을 찾을 수 없습니다.';
  end if;
  if not (public.is_session_teacher_v3(v_work.session_id) or is_admin()) then
    raise exception '이 수업의 담당 선생님만 채점할 수 있습니다.';
  end if;
  -- 객관식은 비워 보내면 자동 채점 결과를 그대로 확정한다.
  if v_grade is null then
    if v_work.auto_correct is null then
      raise exception '채점 결과(정답/부분/오답)를 골라 주세요.';
    end if;
    v_grade := case when v_work.auto_correct then 'correct' else 'incorrect' end;
  end if;
  if v_grade not in ('correct', 'partial', 'incorrect') then
    raise exception '채점 결과는 정답/부분/오답 중 하나입니다: %', v_grade;
  end if;
  update session_problem_work
    set grade = v_grade,
        grade_comment = nullif(btrim(coalesce(p_comment, '')), ''),
        graded_at = now(),
        graded_by = auth.uid()
    where id = p_work_id;
end;
$$;
revoke all on function public.grade_problem_attempt(uuid, text, text) from public, anon;
grant execute on function public.grade_problem_attempt(uuid, text, text) to authenticated;

-- 학생은 problems 를 직접 읽지 못한다 — 유형(객관식/서술형/풀이형)만 수업 관계자에게 준다.
create or replace function public.session_problem_formats(p_session_id uuid)
returns table (problem_id uuid, format text)
language sql stable security definer set search_path = public as $$
  select p.id, p.format::text
  from session_content_manifest cm
  join problems p on p.id = cm.content_id
  where cm.session_id = p_session_id
    and cm.content_type = 'problem'
    and (public.is_session_related_v3(p_session_id) or is_admin());
$$;
revoke all on function public.session_problem_formats(uuid) from public, anon;
grant execute on function public.session_problem_formats(uuid) to authenticated;

-- PDF 페이지 필기 — tool:'clear' 세그먼트는 clear_all 이벤트로 기록한다(자기 범위·이 페이지만).
-- tool:'text' 는 좌표·색과 함께 text·size 를 실어 온다 — 검사 조건은 stroke 와 같다.
create or replace function public.append_page_stroke_events(
  p_session_id uuid,
  p_segments jsonb,
  p_scope text,
  p_curriculum_doc_id uuid,
  p_curriculum_doc_version_id uuid,
  p_page_number int
)
returns setof session_annotation_events
language plpgsql
as $$
declare
  v_author uuid := auth.uid();
  v_owner uuid;
  v_seg jsonb;
  v_row session_annotation_events;
  v_snapshot jsonb;
  v_version_doc uuid;
  v_page_count int;
  v_client_id uuid;
  v_type text;
begin
  if v_author is null then
    raise exception '인증되지 않은 사용자입니다.';
  end if;
  if p_scope not in ('teacher_shared', 'student_shared') then
    raise exception '페이지 필기는 교사 공유·학생 공유 범위만 있습니다: %', p_scope;
  end if;
  if jsonb_typeof(p_segments) is distinct from 'array' or jsonb_array_length(p_segments) = 0 then
    raise exception 'p_segments는 비어있지 않은 jsonb 배열이어야 합니다.';
  end if;

  select v.curriculum_doc_id, v.snapshot into v_version_doc, v_snapshot
  from curriculum_doc_versions v where v.id = p_curriculum_doc_version_id;
  if v_version_doc is null or v_version_doc <> p_curriculum_doc_id then
    raise exception '이 자료의 공개 버전이 아닙니다.';
  end if;
  if coalesce(v_snapshot->>'kind', 'html') <> 'pdf' then
    raise exception 'PDF 자료에만 페이지 필기를 남길 수 있습니다.';
  end if;
  v_page_count := (v_snapshot->'asset'->>'pageCount')::int;
  if p_page_number is null or p_page_number < 1 or p_page_number > coalesce(v_page_count, 0) then
    raise exception '페이지 %는 이 자료(%쪽)에 없습니다.', p_page_number, coalesce(v_page_count, 0);
  end if;

  if not exists (
    select 1 from session_content_manifest cm
    where cm.session_id = p_session_id and cm.content_type = 'material_doc'
      and cm.content_id = p_curriculum_doc_id
  ) and not exists (
    select 1 from session_curriculum_units scu
    join curriculum_overlay_unit_materials m on m.overlay_unit_id = scu.overlay_unit_id
    where scu.session_id = p_session_id and m.curriculum_doc_id = p_curriculum_doc_id
  ) then
    raise exception '이 수업의 자료가 아닙니다.';
  end if;

  v_owner := case when p_scope = 'student_shared' then v_author else null end;

  for v_seg in
    select value from jsonb_array_elements(p_segments) with ordinality as t(value, ord) order by ord
  loop
    if v_seg->>'tool' = 'clear' then
      v_type := 'clear_all';
    else
      v_type := 'stroke';
      if not (v_seg ? 'x0' and v_seg ? 'y0' and v_seg ? 'x1' and v_seg ? 'y1'
              and v_seg ? 'color' and v_seg ? 'tool') then
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
      (session_id, author_id, event_type, payload, scope, curriculum_doc_id,
       owner_student_id, curriculum_doc_version_id, page_number, client_event_id)
    values
      (p_session_id, v_author, v_type, v_seg - 'eventId', p_scope, p_curriculum_doc_id,
       v_owner, p_curriculum_doc_version_id, p_page_number, v_client_id)
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
