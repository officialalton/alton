-- 2026-10-12 모의고사 새 버전 적용 3/4 — 학생·보호자 화면용 'Updated version' 정보 RPC(additive, 새 함수만).
--  · mock_exam_updated_version_overview(student): 이 학생이 같은 시험 계열(set_group_id)의 '다른 버전'을 이미 응시한 공개 세트마다
--    {examSetId, versionNo, itemTotal, sharedAnswered}. sharedAnswered = 새 세트 문항 중 이 학생이 이전 응시(같은 계열 모든 응시)에서
--    이미 답한(응답 있음) 문항 수 — 문항 identity(problem_id) 기준. 쿼리 1개, 세트별 추가 조회 없음.
--  · mock_exam_attempt_version_note(attempt): 결과 화면용. 이 응시 이전 기록 기준으로 같은 값.
-- 접근 권한은 기존 _mock_exam_can_view(학생 본인·보호자·담당 직원).

create or replace function public.mock_exam_updated_version_overview(p_student_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not _mock_exam_can_view(p_student_id) then
    raise exception 'You do not have permission to view this student''s mock exam information.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('examSetId', s.id, 'versionNo', s.version_no,
             'itemTotal', (select count(*) from mock_exam_set_items i where i.exam_set_id = s.id),
             'sharedAnswered', (
               select count(distinct i.problem_id) from mock_exam_set_items i
                where i.exam_set_id = s.id and exists (
                  select 1 from mock_exam_answers ans
                    join mock_exam_attempts a on a.id = ans.attempt_id
                    join mock_exam_set_items oi on oi.id = ans.set_item_id
                   where a.student_id = p_student_id and a.exam_set_group_id = s.set_group_id
                     and oi.problem_id = i.problem_id
                     and ans.response is not null and jsonb_typeof(ans.response) <> 'null')),
             'priorVersionNo', (select max(os.version_no) from mock_exam_attempts a join mock_exam_sets os on os.id = a.exam_set_id
                                 where a.student_id = p_student_id and a.exam_set_group_id = s.set_group_id and a.exam_set_id <> s.id)))
      from mock_exam_sets s
     where s.status = 'published' and s.archived_at is null and s.format in ('fixed', 'ap_fixed')
       and exists (select 1 from mock_exam_attempts a where a.student_id = p_student_id and a.exam_set_group_id = s.set_group_id and a.exam_set_id <> s.id)
  ), '[]'::jsonb);
end $$;
revoke execute on function public.mock_exam_updated_version_overview(uuid) from public, anon;
grant execute on function public.mock_exam_updated_version_overview(uuid) to authenticated, service_role;

create or replace function public.mock_exam_attempt_version_note(p_attempt_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_a mock_exam_attempts%rowtype; v_s mock_exam_sets%rowtype;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or not _mock_exam_can_view(v_a.student_id) then
    raise exception 'You do not have permission to view this attempt.';
  end if;
  select * into v_s from mock_exam_sets where id = v_a.exam_set_id;
  if not v_a.is_updated_version_retake then
    return jsonb_build_object('updatedVersion', false);
  end if;
  return jsonb_build_object('updatedVersion', true, 'versionNo', v_s.version_no,
    'itemTotal', (select count(*) from mock_exam_set_items i where i.exam_set_id = v_a.exam_set_id),
    'sharedAnswered', (
      select count(distinct i.problem_id) from mock_exam_set_items i
       where i.exam_set_id = v_a.exam_set_id and exists (
         select 1 from mock_exam_answers ans
           join mock_exam_attempts a on a.id = ans.attempt_id
           join mock_exam_set_items oi on oi.id = ans.set_item_id
          where a.student_id = v_a.student_id and a.exam_set_group_id = v_a.exam_set_group_id
            and (a.created_at, a.id) < (v_a.created_at, v_a.id)
            and oi.problem_id = i.problem_id
            and ans.response is not null and jsonb_typeof(ans.response) <> 'null')));
end $$;
revoke execute on function public.mock_exam_attempt_version_note(uuid) from public, anon;
grant execute on function public.mock_exam_attempt_version_note(uuid) to authenticated, service_role;
