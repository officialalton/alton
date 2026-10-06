-- 2026-10-06 Free Accounts S6 — 학습 사용 RPC를 새 이벤트 데이터에 연결(추적 시작 전은 not_tracked 유지).
-- 이벤트 추적 시작 전(전체 이벤트 0건)이면 'not_tracked', 이후엔 {opens,lastAt}.
create or replace function public._learning_usage_part(p_student_id uuid, p_kind text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not exists (select 1 from student_learning_events) then to_jsonb('not_tracked'::text)
    else jsonb_build_object('opens', (select count(*) from student_learning_events where student_id = p_student_id and kind = p_kind),
                            'lastAt', (select max(created_at) from student_learning_events where student_id = p_student_id and kind = p_kind)) end;
$$;
revoke execute on function public._learning_usage_part(uuid, text) from public, anon, authenticated;

-- 학습 사용: 저장된 데이터만. 저장되지 않는 항목은 'not_tracked' 마커(값을 추정해 채우지 않는다).
create or replace function public.admin_free_account_learning_usage(p_student_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not _free_accounts_staff() then raise exception 'not_allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'mistakeNotebook', jsonb_build_object(
      'savedCount', (select count(*) from mock_exam_answers ans join mock_exam_attempts a on a.id = ans.attempt_id
                      where a.student_id = p_student_id and ans.saved_to_practice),
      'lastUpdatedAt', (select max(ans.updated_at) from mock_exam_answers ans join mock_exam_attempts a on a.id = ans.attempt_id
                         where a.student_id = p_student_id and ans.saved_to_practice),
      'reviewed', _learning_usage_part(p_student_id, 'mistake_review_opened')),
    'vocabulary', jsonb_build_object(
      'wordsSaved', (select count(*) from vocab_words where student_id = p_student_id),
      'lastWordAt', (select max(created_at) from vocab_words where student_id = p_student_id),
      'quizzesCompleted', (select count(*) from vocab_quizzes where owner_id = p_student_id and submitted_at is not null),
      'avgQuizPct', (select round(100.0 * sum(score) / nullif(sum(total), 0)) from vocab_quizzes
                      where owner_id = p_student_id and submitted_at is not null and total > 0),
      'lastQuizAt', (select max(submitted_at) from vocab_quizzes where owner_id = p_student_id),
      'flashcardStudy', _learning_usage_part(p_student_id, 'vocab_study_opened')),
    'materials', jsonb_build_object(
      'docsOpened', (select count(*) from material_reading_positions where user_id = p_student_id),
      'lastReadAt', (select max(updated_at) from material_reading_positions where user_id = p_student_id),
      'views', _learning_usage_part(p_student_id, 'material_opened'), 'timeSpent', 'not_tracked'),
    'tracking', jsonb_build_object('learningEventsSince', (select min(created_at) from student_learning_events))
  );
end $$;
revoke execute on function public.admin_free_account_learning_usage(uuid) from public, anon;
grant execute on function public.admin_free_account_learning_usage(uuid) to authenticated;
