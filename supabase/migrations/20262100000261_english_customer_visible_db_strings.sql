-- 2026-10-07 customer-facing English policy: customer-visible strings created by DB functions (in-app notification text, mock exam fallback name).
-- New rows only; existing notification rows are not touched. Logic and signatures unchanged.

CREATE OR REPLACE FUNCTION public.cancel_reservation_notifications(p_reservation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_reservation reservations%rowtype;
  v_child_id uuid;
  v_recipient uuid;
begin
  select * into v_reservation from reservations where id = p_reservation_id;
  select se.child_id into v_child_id from subject_enrollments se where se.id = v_reservation.subject_enrollment_id;

  update booking_notification_outbox
  set status = 'cancelled'
  where reservation_id = p_reservation_id and status = 'pending';

  for v_recipient in
    select v_child_id
    union
    select hm.profile_id from household_members hm
      join household_members child on child.household_id = hm.household_id and child.role = 'child' and child.profile_id = v_child_id
    where hm.role = 'guardian'
  loop
    insert into booking_notification_outbox (reservation_id, recipient_id, notification_type, scheduled_for, status, payload)
    values (p_reservation_id, v_recipient, 'booking_cancelled', now(), 'pending', jsonb_build_object('starts_at', v_reservation.starts_at))
    on conflict (reservation_id, recipient_id, notification_type)
      do update set status = 'pending', scheduled_for = now();
  end loop;

  insert into notifications (recipient_id, text, link_view)
  select rec.notify_id, 'Your scheduled regular lesson has been cancelled.', 'booking'
  from (
    select v_child_id as notify_id
    union
    select hm.profile_id from household_members hm
      join household_members child on child.household_id = hm.household_id and child.role = 'child' and child.profile_id = v_child_id
    where hm.role = 'guardian'
  ) rec;
end;
$function$

;

CREATE OR REPLACE FUNCTION public.schedule_reservation_notifications(p_reservation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_reservation reservations%rowtype;
  v_child_id uuid;
  v_recipient uuid;
begin
  select * into v_reservation from reservations where id = p_reservation_id;
  if v_reservation.id is null then
    raise exception 'Reservation not found.' using errcode = 'P0001';
  end if;

  select se.child_id into v_child_id from subject_enrollments se where se.id = v_reservation.subject_enrollment_id;

  for v_recipient in
    select v_child_id
    union
    select hm.profile_id from household_members hm
      join household_members child on child.household_id = hm.household_id and child.role = 'child' and child.profile_id = v_child_id
    where hm.role = 'guardian'
  loop
    insert into booking_notification_outbox (reservation_id, recipient_id, notification_type, scheduled_for, payload)
    values (p_reservation_id, v_recipient, 'booking_confirmed', now(), jsonb_build_object('starts_at', v_reservation.starts_at))
    on conflict (reservation_id, recipient_id, notification_type) do nothing;

    if v_reservation.starts_at - interval '24 hours' > now() then
      insert into booking_notification_outbox (reservation_id, recipient_id, notification_type, scheduled_for, payload)
      values (p_reservation_id, v_recipient, 'reminder_24h', v_reservation.starts_at - interval '24 hours', jsonb_build_object('starts_at', v_reservation.starts_at))
      on conflict (reservation_id, recipient_id, notification_type) do nothing;
    end if;

    if v_reservation.starts_at - interval '2 hours' > now() then
      insert into booking_notification_outbox (reservation_id, recipient_id, notification_type, scheduled_for, payload)
      values (p_reservation_id, v_recipient, 'reminder_2h', v_reservation.starts_at - interval '2 hours', jsonb_build_object('starts_at', v_reservation.starts_at))
      on conflict (reservation_id, recipient_id, notification_type) do nothing;
    end if;
  end loop;

  -- 인앱 표시(스펙 "인앱 표시" 요구) — 기존 R0 notifications 테이블 그대로 재사용.
  insert into notifications (recipient_id, text, link_view)
  select rec.notify_id, 'A regular lesson has been scheduled.', 'booking'
  from (
    select v_child_id as notify_id
    union
    select hm.profile_id from household_members hm
      join household_members child on child.household_id = hm.household_id and child.role = 'child' and child.profile_id = v_child_id
    where hm.role = 'guardian'
  ) rec;
end;
$function$

;

CREATE OR REPLACE FUNCTION public._mock_exam_attempt_detail_v1(p_attempt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_a mock_exam_attempts%rowtype; v_s mock_exam_sets%rowtype; v_visible boolean; v_name text;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null then return null; end if;
  if not _mock_exam_can_view(v_a.student_id) then
    raise exception 'You do not have permission to view this attempt.';
  end if;
  select * into v_s from mock_exam_sets where id = v_a.exam_set_id;
  v_visible := _mock_exam_results_visible(v_a.student_id, v_a.status);
  select name into v_name from profiles where id = v_a.student_id;

  return jsonb_build_object(
    'id', v_a.id, 'examSetId', v_a.exam_set_id, 'examSetName', coalesce(v_s.name, 'Mock exam'),
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
end $function$

;
