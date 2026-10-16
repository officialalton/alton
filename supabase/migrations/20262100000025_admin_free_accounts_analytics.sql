-- 2026-10-06 Free Accounts 6/7 — Analytics 집계. 분모·중복 제거는 설계 §9. 테스트 계정은 기본 제외, 기간은 Asia/Seoul 일 경계.
-- 집계 숫자만 반환(개인 식별 없음). p_cohort_ids 는 관리자 전용 범위 한정(통합 테스트가 병렬 세션 데이터와 분리하는 용도).
create or replace function public.admin_free_accounts_analytics(
  p_from date, p_to date, p_include_test boolean default false, p_cohort_ids uuid[] default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_tz constant text := 'Asia/Seoul';
  v_from timestamptz; v_to timestamptz; v_out jsonb;
begin
  if not _free_accounts_staff() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_to < p_from then raise exception 'invalid_period'; end if;
  v_from := p_from::timestamp at time zone v_tz;
  v_to := (p_to + 1)::timestamp at time zone v_tz;   -- 반개구간 [from, to)

  with scope as (  -- 분석 대상: 무료 회원 + 전환 이력이 있는 학생
    select s.id, s.joined_at, s.member_type, s.status::text st, s.converted_at, s.last_active_at
    from students s
    where (p_include_test or not s.is_test_account)
      and (p_cohort_ids is null or s.id = any (p_cohort_ids))
      and (s.member_type = 'free' or s.converted_at is not null
           or exists (select 1 from consultations c where c.child_id = s.id and c.source = 'free_member'))
  ), freeacc as (select * from scope where member_type = 'free' and st <> 'closed'),
  att as (select a.* from mock_exam_attempts a join scope sc on sc.id = a.student_id),
  interest as (select i.* from student_consult_interests i join scope sc on sc.id = i.student_id),
  inv as (select v.* from guardian_link_invites v join scope sc on sc.id = v.student_id),
  cons as (select c.* from consultations c join scope sc on sc.id = c.child_id where c.source = 'free_member'),
  cohort as (select * from scope where joined_at >= v_from and joined_at < v_to),
  booked_first as (
    select e.consultation_id, min(e.created_at) at from consultation_status_events e
    join cons c on c.id = e.consultation_id where e.new_status = 'scheduled' group by e.consultation_id)
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to, 'timezone', v_tz),
    'testAccountsExcluded', case when p_include_test then 0 else (
      select count(*) from students s where s.is_test_account and (p_cohort_ids is null or s.id = any (p_cohort_ids))
        and (s.member_type = 'free' or s.converted_at is not null)) end,
    'signups', jsonb_build_object(
      'totalFreeAccounts', (select count(*) from freeacc),
      'newInPeriod', (select count(*) from cohort),
      'activeLast7Days', (select count(*) from freeacc where last_active_at >= now() - interval '7 days'),
      'activeInPeriod', (select count(distinct d.student_id) from student_activity_days d join freeacc f on f.id = d.student_id
                          where d.day between p_from and p_to),
      'convertedTotal', (select count(*) from scope where converted_at is not null)),
    'learning', jsonb_build_object(
      'testsStarted', (select count(*) from att where started_at >= v_from and started_at < v_to),
      'testsCompleted', (select count(*) from att where status = 'graded' and graded_at >= v_from and graded_at < v_to),
      'startedCohortSize', (select count(*) from att where started_at >= v_from and started_at < v_to),
      'startedCohortCompleted', (select count(*) from att where started_at >= v_from and started_at < v_to and status = 'graded'),
      'satStarted', (select count(*) from att where started_at >= v_from and started_at < v_to),
      'apStarted', 0,
      'mistakeNotebookSavedTotal', (select count(*) from mock_exam_answers ans join att a on a.id = ans.attempt_id where ans.saved_to_practice),
      'mistakeNotebookStudentsTotal', (select count(distinct a.student_id) from mock_exam_answers ans join att a on a.id = ans.attempt_id where ans.saved_to_practice),
      'vocabWordsAdded', (select count(*) from vocab_words w join scope sc on sc.id = w.student_id where w.created_at >= v_from and w.created_at < v_to),
      'vocabWordStudents', (select count(distinct w.student_id) from vocab_words w join scope sc on sc.id = w.student_id where w.created_at >= v_from and w.created_at < v_to),
      'vocabQuizzesCompleted', (select count(*) from vocab_quizzes q join scope sc on sc.id = q.owner_id where q.submitted_at >= v_from and q.submitted_at < v_to),
      'vocabQuizStudents', (select count(distinct q.owner_id) from vocab_quizzes q join scope sc on sc.id = q.owner_id where q.submitted_at >= v_from and q.submitted_at < v_to),
      'materialsDocsOpened', (select count(*) from material_reading_positions m join scope sc on sc.id = m.user_id where m.updated_at >= v_from and m.updated_at < v_to)),
    'conversion', jsonb_build_object(
      'consultRequests', (select count(*) from interest where created_at >= v_from and created_at < v_to),
      'invitesSent', (select count(*) from inv where created_at >= v_from and created_at < v_to),
      'invitesAccepted', (select count(*) from inv where created_at >= v_from and created_at < v_to and accepted_at is not null),
      'bookings', (select count(*) from booked_first where at >= v_from and at < v_to),
      'completions', (select count(*) from cons where completed_at >= v_from and completed_at < v_to),
      'tutoringConversions', (select count(*) from scope where converted_at >= v_from and converted_at < v_to),
      'cohort', jsonb_build_object(
        'size', (select count(*) from cohort),
        'requested', (select count(distinct i.student_id) from interest i join cohort c on c.id = i.student_id),
        'inviteAccepted', (select count(distinct v.student_id) from inv v join cohort c on c.id = v.student_id where v.accepted_at is not null),
        'booked', (select count(distinct c2.child_id) from booked_first b join cons c2 on c2.id = b.consultation_id join cohort c on c.id = c2.child_id),
        'completed', (select count(distinct c2.child_id) from cons c2 join cohort c on c.id = c2.child_id where c2.completed_at is not null),
        'converted', (select count(*) from cohort where converted_at is not null)))
  ) into v_out;
  return v_out;
end $$;
revoke execute on function public.admin_free_accounts_analytics(date, date, boolean, uuid[]) from public, anon;
grant execute on function public.admin_free_accounts_analytics(date, date, boolean, uuid[]) to authenticated;
