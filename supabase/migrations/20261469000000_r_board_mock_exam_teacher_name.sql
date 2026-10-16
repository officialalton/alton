-- 2026-09-22(사용자 지시 — "이거는 담당 선생님이 아니고, 선생님 누구인지가
-- 나와야지") — 보드 카드의 "작성자" 표시가 과제/모의고사는 전부 뭉뚱그려
-- "담당 선생님"이라고만 나온다. mock_exam_attempts.assigned_by(배정한 선생님)를
-- mock_exam_attempt_summaries()에 추가로 내려준다(과제는 이미
-- homework_batches_for_viewer()가 teacherName을 내려주고 있었다 — 거기 맞춘다).
create or replace function public.mock_exam_attempt_summaries(p_student_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not _mock_exam_can_view(p_student_id) then
    raise exception '이 학생의 모의고사 기록을 볼 권한이 없습니다.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'examSetId', a.exam_set_id, 'examSetName', s.name, 'difficultyTier', s.difficulty_tier,
      'studentId', a.student_id, 'studentName', pr.name, 'status', a.status,
      'assignedByName', ap.name,
      'dueAt', a.due_at, 'startBy', a.start_by, 'startedAt', a.started_at, 'submittedAt', a.submitted_at, 'gradedAt', a.graded_at,
      'entryCount', a.entry_count,
      'totalCount', (select count(*) from mock_exam_set_items i where i.exam_set_id = a.exam_set_id),
      'correctCount', case
        when _mock_exam_results_visible(a.student_id, a.status) and a.status = 'graded'
          then (select count(*) from mock_exam_answers ans where ans.attempt_id = a.id and ans.correct = true)
        else null end
    ) order by a.created_at desc)
    from mock_exam_attempts a
    join mock_exam_sets s on s.id = a.exam_set_id
    left join profiles pr on pr.id = a.student_id
    left join profiles ap on ap.id = a.assigned_by
    where a.student_id = p_student_id
  ), '[]'::jsonb);
end $$;
