-- 모의고사·과제·문제 풀이 중 필기(2026-09-21 사용자 지시) — "학생들이 모의고사, 과제, 문제
-- 풀 때 필기모드 켜서 필기할 수 있게 하고 나중에 볼 수 있게, 선생님도".
--
-- 기존 세션 실시간 공유 필기(session_annotation_events)는 (session_id, problem_id)로
-- 키를 잡는다 — 같은 수업 안에서 여러 참가자가 실시간으로 같이 그리는 용도다. 모의고사는
-- 같은 problem_id가 서로 다른 세트/응시에 재사용될 수 있어(assemble.ts가 부족하면 재사용을
-- 허용) 그 키로는 응시가 다르면 필기가 뒤섞인다. 또한 여기서는 실시간 동기화가 필요 없다
-- (혼자 푸는 화면 — 사용자 확인: "실시간 없이 저장/재생 방식으로") — 그래서 별도의 단순한
-- "문항당 내 필기 스냅샷 하나" 테이블로 만든다. RLS 대신 SECURITY DEFINER RPC 두 개로
-- 권한을 검사한다(이 세션에서 쓴 다른 모의고사 RPC들과 같은 패턴).

create table problem_note_strokes (
  id uuid primary key default gen_random_uuid(),
  context text not null check (context in ('mock_exam', 'homework', 'problem')),
  -- mock_exam: mock_exam_attempts.id / homework: homework_batches.id / problem: 아직 미배선(예비)
  target_id uuid not null,
  -- mock_exam: mock_exam_set_items.problem_id(=problems.id) / homework: homework 배치 안 문제 id
  item_id uuid not null,
  author_id uuid not null references profiles (id),
  strokes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (context, target_id, item_id, author_id)
);
comment on table problem_note_strokes is
  '모의고사·과제·문제 풀이 중 필기 스냅샷(실시간 공유 아님, 혼자 쓰는 용도). 문항 하나·작성자
   하나당 최신 상태 한 행만 보관한다(이벤트 로그 아님) — 이어서 그리면 그 행을 덮어쓴다.';

alter table problem_note_strokes enable row level security;
-- 이 테이블은 직접 select/insert 정책을 열지 않는다 — 아래 RPC로만 접근한다(권한 검사가
-- context마다 다른 테이블을 참조해야 해서 RLS 하나로 표현하기 어렵다).

create or replace function public._problem_note_target_student(p_context text, p_target_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select case p_context
    when 'mock_exam' then (select student_id from mock_exam_attempts where id = p_target_id)
    when 'homework' then (select student_id from homework_batches where id = p_target_id)
    else null
  end;
$$;

/** 본인 필기만 저장한다 — target(응시·과제)의 학생 본인이어야 한다. */
create or replace function public.save_problem_note_strokes(
  p_context text, p_target_id uuid, p_item_id uuid, p_strokes jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare v_student uuid;
begin
  if p_context not in ('mock_exam', 'homework', 'problem') then
    raise exception '알 수 없는 문맥입니다: %', p_context;
  end if;
  v_student := _problem_note_target_student(p_context, p_target_id);
  if v_student is null or v_student <> auth.uid() then
    raise exception '본인 응시·과제의 필기만 저장할 수 있습니다.';
  end if;
  insert into problem_note_strokes (context, target_id, item_id, author_id, strokes, updated_at)
  values (p_context, p_target_id, p_item_id, auth.uid(), coalesce(p_strokes, '[]'::jsonb), now())
  on conflict (context, target_id, item_id, author_id)
  do update set strokes = excluded.strokes, updated_at = now();
end $$;

/** 본인 필기는 항상, 남의 필기는 담당 교사·관리자·보호자만 읽을 수 있다(p_author_id 생략 시 본인). */
create or replace function public.load_problem_note_strokes(
  p_context text, p_target_id uuid, p_item_id uuid, p_author_id uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_student uuid; v_author uuid := coalesce(p_author_id, auth.uid());
begin
  if v_author <> auth.uid() then
    v_student := _problem_note_target_student(p_context, p_target_id);
    if v_student is null or not (is_admin() or teaches_student(v_student) or is_guardian_of(v_student)) then
      raise exception '이 필기를 볼 권한이 없습니다.';
    end if;
  end if;
  return coalesce(
    (select strokes from problem_note_strokes
      where context = p_context and target_id = p_target_id and item_id = p_item_id and author_id = v_author),
    '[]'::jsonb
  );
end $$;

revoke execute on function public._problem_note_target_student(text, uuid) from public, anon, authenticated;
revoke execute on function public.save_problem_note_strokes(text, uuid, uuid, jsonb) from public, anon;
revoke execute on function public.load_problem_note_strokes(text, uuid, uuid, uuid) from public, anon;
grant execute on function public.save_problem_note_strokes(text, uuid, uuid, jsonb) to authenticated;
grant execute on function public.load_problem_note_strokes(text, uuid, uuid, uuid) to authenticated;
