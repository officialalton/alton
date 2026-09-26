-- 2026-09-22(사용자 지시) — 모의고사 응시 중 학생이 화면을 나갔다가 다시 들어오는
-- 것을 시간 어뷰징 의심 신호로 통계화한다. 정교한 서버 권위 타이머 재설계 대신,
-- 이번엔 "몇 번 재입장했는지"만 세어 교사가 눈으로 이상 징후를 볼 수 있게 한다.

alter table mock_exam_attempts add column if not exists entry_count int not null default 0;

create or replace function public.mock_exam_record_entry(p_attempt_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_a mock_exam_attempts%rowtype;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception '본인 응시만 기록할 수 있습니다.'; end if;
  if v_a.status in ('submitted', 'graded') then return; end if;
  update mock_exam_attempts set entry_count = entry_count + 1 where id = p_attempt_id;
end $$;

-- mock_exam_attempt_summaries/detail RPC에 entryCount를 더한다(이미 적용된 버전을
-- 새 번호로 재정의 — 20261429000000에 정의된 것을 그대로 가져와 필드만 추가).
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
    where a.student_id = p_student_id
  ), '[]'::jsonb);
end $$;

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
    'entryCount', v_a.entry_count,
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
