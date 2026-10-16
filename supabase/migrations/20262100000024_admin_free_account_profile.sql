-- 2026-10-06 Free Accounts 5/7 — 상세 프로필·학습 사용 RPC(지연 로드용 분리). 이름 외 연락처 PII(전화 등)는 포함하지 않는다.
create or replace function public.admin_free_account_profile(p_student_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_stage record; v_out jsonb;
begin
  if not _free_accounts_staff() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not exists (select 1 from students where id = p_student_id) then raise exception 'student_not_found'; end if;
  select * into v_stage from _free_account_consult_stage(p_student_id);
  select jsonb_build_object(
    'studentId', s.id, 'name', pr.name, 'email', u.email, 'grade', s.grade, 'schoolName', s.school_name,
    'joinedAt', s.joined_at, 'lastActiveAt', s.last_active_at, 'lastSignInAt', u.last_sign_in_at,
    'accountStatus', s.status::text, 'memberType', s.member_type, 'signupSource', s.signup_source,
    'isTestAccount', s.is_test_account, 'testAccountSource', s.test_account_source, 'convertedAt', s.converted_at,
    'featureKeys', to_jsonb(coalesce(student_feature_access(s.id), array[]::text[])),
    'hasTutoringAccess', coalesce(has_tutoring_access(s.id), false),
    'guardians', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.profile_id, 'name', gp.name, 'email', gu.email, 'linkedAt', g.created_at) order by g.created_at)
      from household_members c
      join household_members g on g.household_id = c.household_id and g.role = 'guardian'
      join profiles gp on gp.id = g.profile_id
      left join auth.users gu on gu.id = g.profile_id
      where c.profile_id = s.id and c.role = 'child'), '[]'::jsonb),
    'invite', (select jsonb_build_object('status', v.status, 'sentAt', v.last_sent_at, 'acceptedAt', v.accepted_at,
                 'needsReview', v.status = 'manual_review', 'reason', v.manual_review_reason)
               from guardian_link_invites v where v.student_id = s.id order by v.created_at desc limit 1),
    'interest', (select jsonb_build_object('status', i.status, 'entryPoint', i.entry_point, 'createdAt', i.created_at)
                 from student_consult_interests i where i.student_id = s.id
                 order by (i.status not in ('cancelled', 'expired')) desc, i.created_at desc limit 1),
    'consultations', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'status', c.status::text, 'startsAt', c.starts_at, 'completedAt', c.completed_at,
               'cancelledAt', c.cancelled_at, 'noShowAt', c.no_show_at, 'closedAt', c.closed_at,
               'consultantName', cp.name, 'createdAt', c.created_at) order by c.created_at desc)
      from consultations c left join profiles cp on cp.id = c.admissions_consultant_id
      where c.child_id = s.id and c.source = 'free_member'), '[]'::jsonb),
    'consultStage', v_stage.stage, 'consultFlags', to_jsonb(v_stage.flags),
    'statusHistory', coalesce((
      select jsonb_agg(jsonb_build_object('previous', e.previous_status, 'new', e.new_status, 'changedBy', ep.name, 'reason', e.reason, 'at', e.created_at) order by e.created_at desc)
      from account_status_events e left join profiles ep on ep.id = e.changed_by where e.profile_id = s.id), '[]'::jsonb)
  ) into v_out
  from students s join profiles pr on pr.id = s.id left join auth.users u on u.id = s.id
  where s.id = p_student_id;
  return v_out;
end $$;
revoke execute on function public.admin_free_account_profile(uuid) from public, anon;
grant execute on function public.admin_free_account_profile(uuid) to authenticated;

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
      'reviewed', 'not_tracked'),
    'vocabulary', jsonb_build_object(
      'wordsSaved', (select count(*) from vocab_words where student_id = p_student_id),
      'lastWordAt', (select max(created_at) from vocab_words where student_id = p_student_id),
      'quizzesCompleted', (select count(*) from vocab_quizzes where owner_id = p_student_id and submitted_at is not null),
      'avgQuizPct', (select round(100.0 * sum(score) / nullif(sum(total), 0)) from vocab_quizzes
                      where owner_id = p_student_id and submitted_at is not null and total > 0),
      'lastQuizAt', (select max(submitted_at) from vocab_quizzes where owner_id = p_student_id),
      'flashcardStudy', 'not_tracked'),
    'materials', jsonb_build_object(
      'docsOpened', (select count(*) from material_reading_positions where user_id = p_student_id),
      'lastReadAt', (select max(updated_at) from material_reading_positions where user_id = p_student_id),
      'views', 'not_tracked', 'timeSpent', 'not_tracked'),
    'tracking', jsonb_build_object('learningEventsSince', null)
  );
end $$;
revoke execute on function public.admin_free_account_learning_usage(uuid) from public, anon;
grant execute on function public.admin_free_account_learning_usage(uuid) to authenticated;
