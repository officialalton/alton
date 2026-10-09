-- mock_exam_attempt_detail() 은 이미 적용된 버전이 있어 파일을 고쳐도 반영되지 않는다
-- (CLAUDE.md) — savedToPractice 필드를 더한 새 버전을 새 번호로 올린다.
-- create or replace 이므로 어느 시점 버전이 적용돼 있었든 같은 결과가 된다.

create or replace function public.mock_exam_attempt_detail(p_attempt_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_a mock_exam_attempts%rowtype; v_s mock_exam_sets%rowtype; v_visible boolean; v_name text;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null then return null; end if;
  if not _mock_exam_can_view(v_a.student_id) then
    raise exception '이 응시 기록을 볼 권한이 없습니다.';
  end if;
  select * into v_s from mock_exam_sets where id = v_a.exam_set_id;
  v_visible := _mock_exam_results_visible(v_a.student_id, v_a.status);
  select name into v_name from profiles where id = v_a.student_id;

  return jsonb_build_object(
    'id', v_a.id, 'examSetId', v_a.exam_set_id, 'examSetName', coalesce(v_s.name, '모의고사'),
    'difficultyTier', coalesce(v_s.difficulty_tier, 'standard'),
    'studentId', v_a.student_id, 'studentName', v_name, 'status', v_a.status,
    'dueAt', v_a.due_at, 'startBy', v_a.start_by, 'maxAttempts', v_a.max_attempts, 'attemptCount', v_a.attempt_count,
    'startedAt', v_a.started_at, 'submittedAt', v_a.submitted_at, 'gradedAt', v_a.graded_at,
    'rwTimeLimitMinutes', coalesce(v_s.rw_time_limit_minutes, 64),
    'mathTimeLimitMinutes', coalesce(v_s.math_time_limit_minutes, 70),
    'mathCalculatorAllowed', coalesce(v_s.math_calculator_allowed, true),
    'mathReferenceSheetAllowed', coalesce(v_s.math_reference_sheet_allowed, true),
    'timeRemainingSeconds', v_a.time_remaining_seconds,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'setItemId', i.id, 'section', i.section, 'position', i.position, 'problemId', i.problem_id,
        'satDomain', i.sat_domain, 'skillCode', i.skill_code, 'difficulty', i.difficulty,
        'format', coalesce(p.format::text, 'mc'),
        'passage', v.passage, 'question', v.question, 'options', v.options, 'figure', v.figure,
        'correctIndex', case when v_visible then v.correct_index else null end,
        'answers', case when v_visible then v.answers else null end,
        'explanation', case when v_visible then v.explanation else null end,
        'response', case when ans.response is null then null else ans.response #>> '{}' end,
        'correct', case when v_visible then ans.correct else null end,
        'flagged', coalesce(ans.flagged, false),
        'savedToPractice', coalesce(ans.saved_to_practice, false),
        'timeSpentSeconds', ans.time_spent_seconds
      ) order by i.section, i.position)
      from mock_exam_set_items i
      join problem_versions v on v.id = i.problem_version_id
      left join problems p on p.id = i.problem_id
      left join mock_exam_answers ans on ans.attempt_id = v_a.id and ans.set_item_id = i.id
      where i.exam_set_id = v_a.exam_set_id
    ), '[]'::jsonb)
  );
end $$;
