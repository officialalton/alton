-- P0 보안 차단(2026-09-21, 기획자 코드 리뷰 지적) — 학생이 정답·채점 결과를 직접 읽거나 조작할 수
-- 있던 두 경로를 막는다.
--
--  1) 모의고사: mock_exam_attempts 학생 본인 UPDATE(전체 컬럼)·mock_exam_answers 학생 본인 ALL 정책이
--     열려 있어 학생이 REST API로 status='graded', correct=true 를 직접 쓸 수 있었다. 또 학생 세션이
--     읽어야 하는 mock_exam_set_items 에는 관리자 SELECT 정책만 있어 실제 학생 응시 화면이 비었다(P1).
--  2) 독립 과제: homework_batches.items JSON 하나에 정답·해설·자동채점·성적이 함께 들어 있는데 학생에게
--     행 전체 SELECT/UPDATE가 열려 있었다 — UI에서 숨긴 것뿐이고 API로는 정답을 읽고 성적을 바꿀 수 있었다.
--
-- 방침: 학생·학부모의 읽기/쓰기는 전부 SECURITY DEFINER RPC 로만 통과시키고, RPC 안에서 소유·상태 전이·
-- 컬럼 범위·정답 마스킹을 강제한다. 직접 테이블 정책은 교사/관리자(신뢰 역할)만 남긴다.
-- 서버 액션은 여전히 admin 클라이언트로 우회하지 않는다(요청자 세션 → RPC).

-- =========================================================================
-- 0) 공용 — 응답 자동 채점(lib/mock-exam/grading.ts · homework-batch-actions.ts 의 규칙과 동일)
-- =========================================================================
create or replace function public._answer_auto_grade(
  p_format text, p_response text, p_correct_index int, p_answers jsonb
) returns boolean
language plpgsql immutable set search_path = public as $$
declare
  v_resp text; v_ans text; v_rn numeric; v_an numeric;
begin
  if p_format = 'mc' then
    if p_correct_index is null then return null; end if;
    return p_response = p_correct_index::text;
  end if;
  if p_format = 'spr' then
    if p_answers is null or jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) = 0 then return null; end if;
    v_resp := regexp_replace(coalesce(p_response, ''), '\s+', '', 'g');
    if v_resp = '' then return false; end if;
    for v_ans in select regexp_replace(value #>> '{}', '\s+', '', 'g') from jsonb_array_elements(p_answers) loop
      if v_ans = v_resp then return true; end if;
      begin
        v_rn := v_resp::numeric; v_an := v_ans::numeric;
        if abs(v_rn - v_an) < 1e-9 then return true; end if;
      exception when others then
        -- 숫자로 해석되지 않는 답 — 문자열 비교만 적용
        null;
      end;
    end loop;
    return false;
  end if;
  return null; -- essay/math 는 수동 채점
end $$;

-- =========================================================================
-- 1) 모의고사 — 직접 쓰기 정책 제거
-- =========================================================================
drop policy if exists "응시 기록 본인 학생 진행" on mock_exam_attempts;
drop policy if exists "답안 본인 학생" on mock_exam_answers;

-- 학생·학부모는 이제 mock_exam_answers 를 직접 읽지 않는다(정답 여부 correct 컬럼이 채점 확정 전에
-- 노출되던 경로). 교사/관리자 SELECT 정책(기존)은 그대로 둔다.

-- 서버 전용 admin 클라이언트(service_role)는 신뢰 경로라 통과시킨다(리포트·회귀 테스트 등).
create or replace function public._is_service_role() returns boolean
language sql stable as $$
  select coalesce(auth.role(), '') = 'service_role';
$$;

create or replace function public._mock_exam_can_view(p_student_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select _is_service_role() or p_student_id = auth.uid() or is_admin() or teaches_student(p_student_id) or is_guardian_of(p_student_id);
$$;

create or replace function public._mock_exam_results_visible(p_student_id uuid, p_status text) returns boolean
language sql stable security definer set search_path = public as $$
  -- 교사·관리자는 언제나, 학생·학부모는 채점 확정(graded) 뒤에만 정답·해설·정오를 본다(사양 4·7절).
  select _is_service_role() or is_admin() or teaches_student(p_student_id) or p_status = 'graded';
$$;

-- 응시 목록(학생 본인/자녀/담당 학생) — 총 문항 수·정답 수 포함(정답 수는 결과 공개 조건을 따른다).
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

-- 응시 상세 — 문항·본문·답안. 정답/해설/정오는 결과 공개 조건을 만족할 때만 채운다.
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

-- 학생 쓰기 RPC — 본인 응시, 제출 전 상태에서만. correct 는 서버가 계산한다(클라이언트 값 무시).
create or replace function public.mock_exam_save_answer(
  p_attempt_id uuid, p_set_item_id uuid, p_response text, p_time_spent_seconds int default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_a mock_exam_attempts%rowtype; v_i mock_exam_set_items%rowtype; v_v problem_versions%rowtype; v_format text; v_correct boolean;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception '본인 응시만 진행할 수 있습니다.'; end if;
  if v_a.status in ('submitted', 'graded') then raise exception '이미 제출한 시험은 답을 바꿀 수 없습니다.'; end if;
  select * into v_i from mock_exam_set_items where id = p_set_item_id and exam_set_id = v_a.exam_set_id;
  if v_i.id is null then raise exception '문항을 찾을 수 없습니다.'; end if;
  select * into v_v from problem_versions where id = v_i.problem_version_id;
  select format::text into v_format from problems where id = v_i.problem_id;
  v_correct := _answer_auto_grade(coalesce(v_format, 'mc'), p_response, v_v.correct_index, v_v.answers);

  insert into mock_exam_answers (attempt_id, set_item_id, response, correct, time_spent_seconds, updated_at)
  values (p_attempt_id, p_set_item_id, to_jsonb(p_response), v_correct, p_time_spent_seconds, now())
  on conflict (attempt_id, set_item_id) do update
    set response = excluded.response, correct = excluded.correct,
        time_spent_seconds = coalesce(excluded.time_spent_seconds, mock_exam_answers.time_spent_seconds),
        updated_at = now();

  if v_a.status = 'assigned' then
    update mock_exam_attempts set status = 'in_progress', started_at = coalesce(started_at, now()) where id = p_attempt_id;
  end if;
end $$;

create or replace function public.mock_exam_toggle_flag(p_attempt_id uuid, p_set_item_id uuid, p_flagged boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare v_a mock_exam_attempts%rowtype;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception '본인 응시만 진행할 수 있습니다.'; end if;
  if v_a.status in ('submitted', 'graded') then raise exception '이미 제출한 시험은 바꿀 수 없습니다.'; end if;
  if not exists (select 1 from mock_exam_set_items where id = p_set_item_id and exam_set_id = v_a.exam_set_id) then
    raise exception '문항을 찾을 수 없습니다.';
  end if;
  insert into mock_exam_answers (attempt_id, set_item_id, flagged, updated_at)
  values (p_attempt_id, p_set_item_id, p_flagged, now())
  on conflict (attempt_id, set_item_id) do update set flagged = excluded.flagged, updated_at = now();
end $$;

create or replace function public.mock_exam_save_section_time(p_attempt_id uuid, p_section text, p_remaining_seconds int)
returns void
language plpgsql security definer set search_path = public as $$
declare v_a mock_exam_attempts%rowtype;
begin
  if p_section not in ('rw', 'math') then raise exception '섹션은 rw 또는 math 여야 합니다.'; end if;
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception '본인 응시만 진행할 수 있습니다.'; end if;
  if v_a.status in ('submitted', 'graded') then return; end if;
  update mock_exam_attempts
    set time_remaining_seconds = coalesce(time_remaining_seconds, '{}'::jsonb) || jsonb_build_object(p_section, greatest(0, p_remaining_seconds))
    where id = p_attempt_id;
end $$;

create or replace function public.mock_exam_submit(p_attempt_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_a mock_exam_attempts%rowtype;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception '본인 응시만 제출할 수 있습니다.'; end if;
  if v_a.status not in ('assigned', 'in_progress') then raise exception '이미 제출한 시험입니다.'; end if;
  update mock_exam_attempts set status = 'submitted', submitted_at = now(), attempt_count = 1 where id = p_attempt_id;
end $$;

-- 교사 채점 확정 — 담당 교사/관리자, submitted 상태에서만.
create or replace function public.mock_exam_finalize_grading(p_attempt_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_a mock_exam_attempts%rowtype;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or not (is_admin() or teaches_student(v_a.student_id)) then
    raise exception '담당 학생의 응시만 채점할 수 있습니다.';
  end if;
  if v_a.status <> 'submitted' then raise exception '제출된 시험만 채점 확정할 수 있습니다.'; end if;
  update mock_exam_attempts set status = 'graded', graded_at = now() where id = p_attempt_id;
end $$;

-- =========================================================================
-- 2) 독립 과제 — 학생 직접 읽기/쓰기 정책 제거, RPC 로 대체
-- =========================================================================
drop policy if exists "발급 교사/학생 본인/보호자/관리자 조회" on homework_batches;
create policy "발급 교사/관리자 조회" on homework_batches for select
  using (teacher_id = auth.uid() or is_admin());

drop policy if exists "발급 교사/학생 본인 수정" on homework_batches;
create policy "발급 교사만 수정" on homework_batches for update
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

-- 학생 본인/보호자에게는 채점 확정(graded) 전까지 정답·해설·자동채점·성적을 뺀 사본만 준다.
create or replace function public._homework_item_for_viewer(p_item jsonb, p_redact boolean) returns jsonb
language sql immutable as $$
  select case
    when p_redact and coalesce((p_item->>'graded')::boolean, false) = false
      then p_item || jsonb_build_object('correctIndex', null, 'answers', null, 'explanation', null, 'autoCorrect', null, 'grade', null, 'gradeComment', null)
    else p_item
  end;
$$;

create or replace function public.homework_batches_for_viewer(p_student_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_self boolean; v_guardian boolean; v_admin boolean; v_teacher boolean;
begin
  v_self := p_student_id = auth.uid();
  v_admin := is_admin() or _is_service_role();
  v_teacher := teaches_student(p_student_id);
  v_guardian := is_guardian_of(p_student_id);
  if not (v_self or v_admin or v_teacher or v_guardian) then
    raise exception '이 학생의 과제를 볼 권한이 없습니다.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', b.id, 'teacherId', b.teacher_id, 'teacherName', tp.name,
      'studentId', b.student_id, 'label', b.label, 'subjectId', b.subject_id, 'subjectName', sj.name,
      'createdAt', b.created_at,
      'items', coalesce((
        select jsonb_agg(_homework_item_for_viewer(it, not (v_admin or b.teacher_id = auth.uid())) order by (it->>'position')::int)
        from jsonb_array_elements(b.items) it
      ), '[]'::jsonb)
    ) order by b.created_at desc)
    from (
      select * from homework_batches hb
      where hb.student_id = p_student_id
        -- 교사는 "이 교사가 낸" 배치만(다른 교사 배치 비노출 — 기존 RLS 의도 유지). 학생 본인·보호자·관리자는 전체.
        and (v_self or v_admin or v_guardian or hb.teacher_id = auth.uid())
      order by hb.created_at desc limit 50
    ) b
    left join profiles tp on tp.id = b.teacher_id
    left join subjects sj on sj.id = b.subject_id
  ), '[]'::jsonb);
end $$;

-- 학생 답 제출 — 본인 배치, 미채점 문항만, response/submittedAt/autoCorrect 세 키만 바뀐다.
create or replace function public.homework_submit_answer(p_batch_id uuid, p_problem_id uuid, p_response text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_b homework_batches%rowtype; v_items jsonb := '[]'::jsonb; v_it jsonb; v_found boolean := false; v_auto boolean;
begin
  select * into v_b from homework_batches where id = p_batch_id;
  if v_b.id is null or v_b.student_id <> auth.uid() then raise exception '본인 과제만 답할 수 있습니다.'; end if;
  for v_it in select value from jsonb_array_elements(v_b.items) loop
    if (v_it->>'problemId')::uuid = p_problem_id then
      v_found := true;
      if coalesce((v_it->>'graded')::boolean, false) then raise exception '이미 채점된 과제는 답을 바꿀 수 없습니다.'; end if;
      v_auto := _answer_auto_grade(v_it->>'format', p_response, (v_it->>'correctIndex')::int, v_it->'answers');
      v_it := v_it || jsonb_build_object('response', p_response, 'submittedAt', now(), 'autoCorrect', v_auto);
    end if;
    v_items := v_items || v_it;
  end loop;
  if not v_found then raise exception '문항을 찾을 수 없습니다.'; end if;
  update homework_batches set items = v_items where id = p_batch_id;
end $$;

comment on function public.mock_exam_attempt_detail(uuid) is 'P0(2026-09-21): 학생/학부모 응시 상세 읽기 전용 경로 — 채점 확정 전 정답·해설·정오 마스킹.';
comment on function public.homework_batches_for_viewer(uuid) is 'P0(2026-09-21): 학생/학부모 과제 읽기 전용 경로 — 채점 확정 전 정답·해설·자동채점·성적 마스킹.';
