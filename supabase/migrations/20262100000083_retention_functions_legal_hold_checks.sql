-- 2026-10-06 보존 구현 2차 — 모든 retention_* 삭제·비식별화 경로에 legal hold 검사를 추가한다(추가 전용).
-- hold가 걸린 대상은 건너뛴다(자동 삭제 없음). 계정 병합 익명화(anonymize_merged_account)도 hold면 거부한다.
-- 롤백: 함수를 20261900000016/20261926000000/20262100000081 정의로 복원.

CREATE OR REPLACE FUNCTION public.retention_delete_expired_notifications(p_limit integer DEFAULT 500, p_dry_run boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_count integer;
begin
  perform assert_admin_or_service_role();

  if p_dry_run then
    select count(*) into v_count from (
      select id from notifications where created_at < now() - interval '90 days' and not has_active_legal_hold('profile', recipient_id) limit p_limit
    ) t;
  else
    with victims as (
      select id from notifications where created_at < now() - interval '90 days' and not has_active_legal_hold('profile', recipient_id) limit p_limit
    ),
    deleted as (
      delete from notifications where id in (select id from victims) returning id
    )
    select count(*) into v_count from deleted;
  end if;

  insert into retention_batch_runs (category, table_name, action, target_count, succeeded_count, dry_run)
  values ('notifications_90d', 'notifications', 'delete', v_count, v_count, p_dry_run);

  return v_count;
exception when others then
  insert into retention_batch_runs (category, table_name, action, target_count, succeeded_count, failed, error_message, dry_run)
  values ('notifications_90d', 'notifications', 'delete', 0, 0, true, sqlerrm, p_dry_run);
  raise;
end;
$function$;

CREATE OR REPLACE FUNCTION public.retention_anonymize_expired_consult_requests(p_limit integer DEFAULT 500, p_dry_run boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_count integer;
begin
  perform assert_admin_or_service_role();

  if p_dry_run then
    select count(*) into v_count from (
      select id from consult_requests
      where status = 'completed'
        and coalesce(completed_at, submitted_at) < now() - interval '2 years'
        and person_name <> '[비식별화됨]' and not has_active_legal_hold('consult_request', id)
      limit p_limit
    ) t;
  else
    with victims as (
      select id from consult_requests
      where status = 'completed'
        and coalesce(completed_at, submitted_at) < now() - interval '2 years'
        and person_name <> '[비식별화됨]' and not has_active_legal_hold('consult_request', id)
      limit p_limit
    ),
    updated as (
      update consult_requests
      set person_name = '[비식별화됨]', email = 'anonymized@example.invalid', phone = null, concerns = null, meeting_notes = null
      where id in (select id from victims)
      returning id
    )
    select count(*) into v_count from updated;
  end if;

  insert into retention_batch_runs (category, table_name, action, target_count, succeeded_count, dry_run)
  values ('consult_requests_2y_pii', 'consult_requests', 'anonymize', v_count, v_count, p_dry_run);

  return v_count;
exception when others then
  insert into retention_batch_runs (category, table_name, action, target_count, succeeded_count, failed, error_message, dry_run)
  values ('consult_requests_2y_pii', 'consult_requests', 'anonymize', 0, 0, true, sqlerrm, p_dry_run);
  raise;
end;
$function$;

CREATE OR REPLACE FUNCTION public.retention_anonymize_expired_consultations(p_limit integer DEFAULT 500, p_dry_run boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_count integer;
begin
  perform assert_admin_or_service_role();

  if p_dry_run then
    select count(*) into v_count from (
      select c.id from consultations c
      where c.status in ('completed', 'cancelled', 'no_show')
        and coalesce(c.completed_at, c.cancelled_at, c.no_show_at, c.updated_at) < now() - interval '2 years'
        and c.contact_name <> '[비식별화됨]' and not has_active_legal_hold('consultation', c.id) and not has_active_legal_hold('student', c.child_id) and not has_active_legal_hold('household', c.household_id)
        and not exists (select 1 from subject_enrollments se where se.child_id = c.child_id and se.status = 'active')
      limit p_limit
    ) t;
  else
    with victims as (
      select c.id from consultations c
      where c.status in ('completed', 'cancelled', 'no_show')
        and coalesce(c.completed_at, c.cancelled_at, c.no_show_at, c.updated_at) < now() - interval '2 years'
        and c.contact_name <> '[비식별화됨]' and not has_active_legal_hold('consultation', c.id) and not has_active_legal_hold('student', c.child_id) and not has_active_legal_hold('household', c.household_id)
        and not exists (select 1 from subject_enrollments se where se.child_id = c.child_id and se.status = 'active')
      limit p_limit
    ),
    updated as (
      update consultations c
      set contact_name = '[비식별화됨]', contact_email = 'anonymized@example.invalid', contact_phone = null,
          concerns = null, admin_review_summary = null, outcome_notes = null, closure_review_text = null,
          cancellation_reason = null, google_sync_last_error = null, requested_children = null
      where c.id in (select id from victims)
      returning c.id
    )
    select count(*) into v_count from updated;
  end if;

  insert into retention_batch_runs (category, table_name, action, target_count, succeeded_count, dry_run)
  values ('consultations_2y_pii', 'consultations', 'anonymize', v_count, v_count, p_dry_run);
  return v_count;
exception when others then
  insert into retention_batch_runs (category, table_name, action, target_count, succeeded_count, failed, error_message, dry_run)
  values ('consultations_2y_pii', 'consultations', 'anonymize', 0, 0, true, sqlerrm, p_dry_run);
  raise;
end;
$function$;

CREATE OR REPLACE FUNCTION public.retention_anonymize_expired_prospect_contacts(p_limit integer DEFAULT 500, p_dry_run boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_count integer;
begin
  perform assert_admin_or_service_role();

  if p_dry_run then
    select count(*) into v_count from (
      select pc.id from prospect_contacts pc
      where pc.updated_at < now() - interval '2 years'
        and pc.converted_guardian_id is null
        and pc.full_name <> '[비식별화됨]' and not has_active_legal_hold('prospect_contact', pc.id)
        and not exists (select 1 from consultations c where c.prospect_contact_id = pc.id and c.status in ('requested', 'scheduled'))
      limit p_limit
    ) t;
  else
    with victims as (
      select pc.id from prospect_contacts pc
      where pc.updated_at < now() - interval '2 years'
        and pc.converted_guardian_id is null
        and pc.full_name <> '[비식별화됨]' and not has_active_legal_hold('prospect_contact', pc.id)
        and not exists (select 1 from consultations c where c.prospect_contact_id = pc.id and c.status in ('requested', 'scheduled'))
      limit p_limit
    ),
    updated as (
      update prospect_contacts pc
      set full_name = '[비식별화됨]', primary_email = 'anonymized@example.invalid', primary_phone = null, conversion_note = null
      where pc.id in (select id from victims)
      returning pc.id
    )
    select count(*) into v_count from updated;
  end if;

  insert into retention_batch_runs (category, table_name, action, target_count, succeeded_count, dry_run)
  values ('prospect_contacts_2y_pii', 'prospect_contacts', 'anonymize', v_count, v_count, p_dry_run);
  return v_count;
exception when others then
  insert into retention_batch_runs (category, table_name, action, target_count, succeeded_count, failed, error_message, dry_run)
  values ('prospect_contacts_2y_pii', 'prospect_contacts', 'anonymize', 0, 0, true, sqlerrm, p_dry_run);
  raise;
end;
$function$;

CREATE OR REPLACE FUNCTION public.retention_delete_expired_access_logs(p_limit integer DEFAULT 500, p_dry_run boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_count1 integer;
begin
  perform assert_admin_or_service_role();

  if p_dry_run then
    select count(*) into v_count1 from (
      select id from session_access_events where occurred_at < now() - interval '1 year' and not has_active_legal_hold('session', session_id) limit p_limit
    ) t1;
  else
    with victims1 as (
      select id from session_access_events where occurred_at < now() - interval '1 year' and not has_active_legal_hold('session', session_id) limit p_limit
    ),
    deleted1 as (
      delete from session_access_events where id in (select id from victims1) returning id
    )
    select count(*) into v_count1 from deleted1;
  end if;

  insert into retention_batch_runs (category, table_name, action, target_count, succeeded_count, dry_run)
  values ('access_logs_1y', 'session_access_events', 'delete', v_count1, v_count1, p_dry_run);

  return v_count1;
exception when others then
  insert into retention_batch_runs (category, table_name, action, target_count, succeeded_count, failed, error_message, dry_run)
  values ('access_logs_1y', 'session_access_events', 'delete', 0, 0, true, sqlerrm, p_dry_run);
  raise;
end;
$function$;

CREATE OR REPLACE FUNCTION public.retention_delete_expired_subject_thread_messages(p_limit integer DEFAULT 500, p_dry_run boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_count integer;
begin
  perform assert_admin_or_service_role();
  if p_dry_run then
    select count(*) into v_count from (
      select m.id from subject_thread_messages m join subject_threads t on t.id = m.thread_id
      where t.status = 'archived' and t.archived_at < now() - interval '2 years' and not has_active_legal_hold('enrollment', t.subject_enrollment_id) limit p_limit
    ) x;
  else
    with v as (
      select m.id from subject_thread_messages m join subject_threads t on t.id = m.thread_id
      where t.status = 'archived' and t.archived_at < now() - interval '2 years' and not has_active_legal_hold('enrollment', t.subject_enrollment_id) limit p_limit
    ), d as (delete from subject_thread_messages where id in (select id from v) returning id)
    select count(*) into v_count from d;
  end if;
  insert into retention_batch_runs (category, table_name, action, target_count, succeeded_count, dry_run)
  values ('subject_thread_messages_2y', 'subject_thread_messages', 'delete', v_count, v_count, p_dry_run);
  return v_count;
exception when others then
  insert into retention_batch_runs (category, table_name, action, target_count, succeeded_count, failed, error_message, dry_run)
  values ('subject_thread_messages_2y', 'subject_thread_messages', 'delete', 0, 0, true, sqlerrm, p_dry_run);
  raise;
end;
$function$;

CREATE OR REPLACE FUNCTION public.retention_delete_expired_teacher_admin_messages(p_limit integer DEFAULT 500, p_dry_run boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_count integer;
begin
  perform assert_admin_or_service_role();
  if p_dry_run then
    select count(*) into v_count from (
      select m.id from teacher_admin_messages m join teacher_admin_inquiries i on i.id = m.inquiry_id
      where i.status = 'closed' and i.closed_at < now() - interval '2 years' and not has_active_legal_hold('profile', i.teacher_id) limit p_limit
    ) x;
  else
    with v as (
      select m.id from teacher_admin_messages m join teacher_admin_inquiries i on i.id = m.inquiry_id
      where i.status = 'closed' and i.closed_at < now() - interval '2 years' and not has_active_legal_hold('profile', i.teacher_id) limit p_limit
    ), d as (delete from teacher_admin_messages where id in (select id from v) returning id)
    select count(*) into v_count from d;
  end if;
  insert into retention_batch_runs (category, table_name, action, target_count, succeeded_count, dry_run)
  values ('teacher_admin_messages_2y', 'teacher_admin_messages', 'delete', v_count, v_count, p_dry_run);
  return v_count;
exception when others then
  insert into retention_batch_runs (category, table_name, action, target_count, succeeded_count, failed, error_message, dry_run)
  values ('teacher_admin_messages_2y', 'teacher_admin_messages', 'delete', 0, 0, true, sqlerrm, p_dry_run);
  raise;
end;
$function$;


-- notifications: has_active_legal_hold는 global hold도 true를 돌려준다.

-- 계정 병합 익명화: 기존 본문은 _core로 옮기고 같은 시그니처의 래퍼가 hold를 먼저 확인한다.
alter function public.anonymize_merged_account(uuid) rename to anonymize_merged_account_core;
revoke execute on function public.anonymize_merged_account_core(uuid) from public, anon, authenticated, service_role;
create or replace function public.anonymize_merged_account(p_profile_id uuid) returns void
language plpgsql security definer set search_path = 'public' as $$
begin
  if has_active_legal_hold('profile', p_profile_id) then
    raise exception '법적 보류(legal hold)가 걸린 계정은 익명화할 수 없습니다.';
  end if;
  perform public.anonymize_merged_account_core(p_profile_id);
end $$;
revoke execute on function public.anonymize_merged_account(uuid) from public;
grant execute on function public.anonymize_merged_account(uuid) to anon, authenticated, service_role;

-- 오케스트레이터: Smart Notes 큐 적재·정리(Drive 삭제 성공분만)와 legal hold 재검토 알림을 추가한다.
create or replace function public.run_data_retention_batch(p_limit integer default 500, p_dry_run boolean default false)
returns jsonb
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_notifications integer := 0; v_consult integer := 0; v_consultations integer := 0; v_prospects integer := 0;
  v_access_logs integer := 0; v_thread_msgs integer := 0; v_ta_msgs integer := 0;
  v_sn_enqueued integer := 0; v_sn_finalized integer := 0; v_hold_notices integer := 0;
  v_errors text[] := array[]::text[];
begin
  perform assert_admin_or_service_role();
  begin v_notifications := retention_delete_expired_notifications(p_limit, p_dry_run);
  exception when others then v_errors := array_append(v_errors, 'notifications: ' || sqlerrm); end;
  begin v_consult := retention_anonymize_expired_consult_requests(p_limit, p_dry_run);
  exception when others then v_errors := array_append(v_errors, 'consult_requests: ' || sqlerrm); end;
  begin v_consultations := retention_anonymize_expired_consultations(p_limit, p_dry_run);
  exception when others then v_errors := array_append(v_errors, 'consultations: ' || sqlerrm); end;
  begin v_prospects := retention_anonymize_expired_prospect_contacts(p_limit, p_dry_run);
  exception when others then v_errors := array_append(v_errors, 'prospect_contacts: ' || sqlerrm); end;
  begin v_access_logs := retention_delete_expired_access_logs(p_limit, p_dry_run);
  exception when others then v_errors := array_append(v_errors, 'access_logs: ' || sqlerrm); end;
  begin v_thread_msgs := retention_delete_expired_subject_thread_messages(p_limit, p_dry_run);
  exception when others then v_errors := array_append(v_errors, 'subject_thread_messages: ' || sqlerrm); end;
  begin v_ta_msgs := retention_delete_expired_teacher_admin_messages(p_limit, p_dry_run);
  exception when others then v_errors := array_append(v_errors, 'teacher_admin_messages: ' || sqlerrm); end;
  begin v_sn_enqueued := retention_enqueue_expired_smart_notes(p_limit, p_dry_run);
  exception when others then v_errors := array_append(v_errors, 'smart_notes_enqueue: ' || sqlerrm); end;
  begin v_sn_finalized := retention_finalize_deleted_smart_notes(p_limit, p_dry_run);
  exception when others then v_errors := array_append(v_errors, 'smart_notes_finalize: ' || sqlerrm); end;
  if not p_dry_run then
    begin v_hold_notices := legal_hold_notify_reviews_due();
    exception when others then v_errors := array_append(v_errors, 'legal_hold_notices: ' || sqlerrm); end;
  end if;

  return jsonb_build_object(
    'notifications', v_notifications, 'consultRequests', v_consult, 'consultations', v_consultations,
    'prospectContacts', v_prospects, 'accessLogs', v_access_logs,
    'subjectThreadMessages', v_thread_msgs, 'teacherAdminMessages', v_ta_msgs,
    'smartNotesEnqueued', v_sn_enqueued, 'smartNotesFinalized', v_sn_finalized,
    'legalHoldReviewNotices', v_hold_notices, 'errors', v_errors
  );
end;
$$;
