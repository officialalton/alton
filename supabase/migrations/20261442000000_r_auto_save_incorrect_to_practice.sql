-- 2026-09-22(사용자 지시) — "문제" 탭에서 오답이었던 문제는 학생이 따로 저장 버튼을
-- 누르지 않아도 자동으로 Practice 탭에 뜨게 한다(단어장의 "오답 노트" 자동 저장과
-- 같은 발상). 채점이 확정되는 단 하나의 지점(grade_problem_attempt)에서 처리한다 —
-- 20261355000000에 이미 적용된 버전을 새 번호로 재정의한다.

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
        graded_by = auth.uid(),
        saved_to_practice = case when v_grade = 'incorrect' then true else saved_to_practice end
    where id = p_work_id;
end;
$$;
