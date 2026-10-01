-- P3 6단계 — 제품 오너 확정(2026-09-12): 문제별 풀이 공간을 별도로 운영하고,
-- 풀이 시도마다 "그때 무엇을 냈는가"를 고정한다.
--
-- 이미 있는 것: session_problem_work(수업×학생×문제×시도)와, 그 판을 참조하는
-- 학생 풀이(problem_student)·교사 피드백(problem_teacher_feedback) 필기.
-- 없던 것: **제출한 답안**과 "제출 시점에 어떤 필기까지가 평가 대상인가".
--
-- 나중에 AI 채점을 붙일 때 "채점이 무엇을 보고 판단했는가"를 되짚으려면, 제출
-- 이후에 덧그린 필기와 제출 시점까지의 필기가 구분돼야 한다. 필기는 append-only에
-- 순번(seq)이 있으므로, 제출 시점의 마지막 순번을 박아두면 그 경계가 영구히 남는다.
alter table session_problem_work
  -- 학생이 고른 보기(객관식) 또는 쓴 답(서술형). 제출 시점에 고정된다.
  add column if not exists submitted_choice_index int,
  add column if not exists submitted_text text,
  -- 제출 시점까지의 필기 경계. 이 순번 이하의 problem_student 필기가 그때 낸 풀이다.
  add column if not exists submitted_stroke_seq bigint;

comment on column session_problem_work.submitted_choice_index is
  'P3: 제출 시점에 고정된 학생의 선택(객관식). 제출 뒤에는 바뀌지 않는다.';
comment on column session_problem_work.submitted_text is
  'P3: 제출 시점에 고정된 학생의 서술 답안.';
comment on column session_problem_work.submitted_stroke_seq is
  'P3: 제출 시점까지의 학생 풀이 필기 경계(session_annotation_events.seq). 이후 덧그린 필기와 '
  '채점 대상이었던 필기를 구분할 수 있게 한다 — AI 채점을 붙일 때 "무엇을 보고 채점했는가"가 남는다.';

-- 제출은 한 번만, 그리고 제출한 뒤에는 답안·경계가 바뀌지 않는다.
create or replace function public.freeze_problem_attempt_on_submit()
returns trigger language plpgsql as $$
begin
  if old.submitted_at is not null then
    if new.submitted_at is distinct from old.submitted_at
       or new.submitted_choice_index is distinct from old.submitted_choice_index
       or new.submitted_text is distinct from old.submitted_text
       or new.submitted_stroke_seq is distinct from old.submitted_stroke_seq then
      raise exception '이미 제출한 풀이입니다 — 답안과 제출 시점 필기는 바꿀 수 없습니다. 다시 풀려면 새 풀이를 시작하세요.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists session_problem_work_submit_freeze on session_problem_work;
create trigger session_problem_work_submit_freeze
  before update on session_problem_work
  for each row execute function public.freeze_problem_attempt_on_submit();

-- 제출 처리. 답안과 필기 경계를 한 번에 박는다.
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
begin
  select * into v_work from session_problem_work where id = p_work_id for update;
  if not found then
    raise exception '풀이판을 찾을 수 없습니다.';
  end if;
  if v_work.student_id <> p_actor_id then
    raise exception '본인 풀이만 제출할 수 있습니다.';
  end if;
  if v_work.submitted_at is not null then
    -- 같은 제출을 두 번 눌러도 조용히 넘어간다(중복 클릭).
    return;
  end if;

  -- 지금까지 이 판에 쌓인 학생 풀이 필기의 마지막 순번이 곧 제출 경계다.
  select max(seq) into v_seq
  from session_annotation_events
  where problem_work_id = p_work_id and scope = 'problem_student';

  update session_problem_work
  set submitted_at = now(),
      submitted_choice_index = p_choice_index,
      submitted_text = p_text,
      submitted_stroke_seq = v_seq
  where id = p_work_id;
end;
$$;
revoke execute on function public.submit_problem_attempt(uuid, uuid, int, text) from public, anon, authenticated;
grant execute on function public.submit_problem_attempt(uuid, uuid, int, text) to service_role;

comment on function public.submit_problem_attempt(uuid, uuid, int, text) is
  'P3: 풀이 시도를 제출한다. 답안과 "제출 시점까지의 필기 경계"를 함께 고정하므로, 이후 덧그린 '
  '필기와 채점 대상이었던 풀이를 구분할 수 있다. 교사 피드백은 제출 뒤에도 계속 추가할 수 있다.';
