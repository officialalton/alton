-- 2026-09-22(사용자 지시) — ProblemNoteCanvas(화이트보드)를 "문제" 탭(세션 문제)에도
-- 쓰기로 하면서 context='problem'이 처음 실사용된다. _problem_note_target_student가
-- 'problem'을 처리하지 않아(else null) 항상 "본인 응시·과제의 필기만 저장할 수 있습니다"
-- 로 막혔다 — target_id를 sessionId로 보고 그 세션의 학생을 찾게 확장한다.

create or replace function public._problem_note_target_student(p_context text, p_target_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select case p_context
    when 'mock_exam' then (select student_id from mock_exam_attempts where id = p_target_id)
    when 'homework' then (select student_id from homework_batches where id = p_target_id)
    when 'problem' then (
      select se.child_id from sessions s
      join subject_enrollments se on se.id = s.subject_enrollment_id
      where s.id = p_target_id
    )
    else null
  end;
$$;
