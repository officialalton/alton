-- 2026-10-06 보존 감사 — "채팅·상담 기록: 종료 후 2년" 중 종료 시점이 명확한 두 경로만 추가한다(추가 전용).
--   subject_threads: 배정 종료로 archived 된 스레드(archived_at 기준)의 메시지.
--   teacher_admin_inquiries: closed 된 문의(closed_at 기준)의 메시지.
-- 스레드·문의 행 자체는 남기고(통계·접근 이력) 메시지 본문만 삭제한다. 활성/미종료 건은 대상이 아니다.
-- 배치 활성화(RETENTION_BATCH_ENABLED·cron)는 건드리지 않는다. 법적 보류(legal hold) 테이블은 아직 없어
-- 보류 예외는 미구현(별도 정책 결정 필요).
-- 롤백: 새 함수 2개 drop, run_data_retention_batch 를 20261926000000 정의로 복원.

create or replace function public.retention_delete_expired_subject_thread_messages(p_limit integer default 500, p_dry_run boolean default false)
returns integer
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_count integer;
begin
  perform assert_admin_or_service_role();
  if p_dry_run then
    select count(*) into v_count from (
      select m.id from subject_thread_messages m join subject_threads t on t.id = m.thread_id
      where t.status = 'archived' and t.archived_at < now() - interval '2 years' limit p_limit
    ) x;
  else
    with v as (
      select m.id from subject_thread_messages m join subject_threads t on t.id = m.thread_id
      where t.status = 'archived' and t.archived_at < now() - interval '2 years' limit p_limit
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
$$;

create or replace function public.retention_delete_expired_teacher_admin_messages(p_limit integer default 500, p_dry_run boolean default false)
returns integer
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_count integer;
begin
  perform assert_admin_or_service_role();
  if p_dry_run then
    select count(*) into v_count from (
      select m.id from teacher_admin_messages m join teacher_admin_inquiries i on i.id = m.inquiry_id
      where i.status = 'closed' and i.closed_at < now() - interval '2 years' limit p_limit
    ) x;
  else
    with v as (
      select m.id from teacher_admin_messages m join teacher_admin_inquiries i on i.id = m.inquiry_id
      where i.status = 'closed' and i.closed_at < now() - interval '2 years' limit p_limit
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
$$;

revoke all on function public.retention_delete_expired_subject_thread_messages(integer, boolean) from public, anon, authenticated;
revoke all on function public.retention_delete_expired_teacher_admin_messages(integer, boolean) from public, anon, authenticated;
grant execute on function public.retention_delete_expired_subject_thread_messages(integer, boolean) to service_role;
grant execute on function public.retention_delete_expired_teacher_admin_messages(integer, boolean) to service_role;

create or replace function public.run_data_retention_batch(p_limit integer default 500, p_dry_run boolean default false)
returns jsonb
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_notifications integer := 0;
  v_consult integer := 0;
  v_consultations integer := 0;
  v_prospects integer := 0;
  v_access_logs integer := 0;
  v_thread_msgs integer := 0;
  v_ta_msgs integer := 0;
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

  return jsonb_build_object(
    'notifications', v_notifications,
    'consultRequests', v_consult,
    'consultations', v_consultations,
    'prospectContacts', v_prospects,
    'accessLogs', v_access_logs,
    'subjectThreadMessages', v_thread_msgs,
    'teacherAdminMessages', v_ta_msgs,
    'errors', v_errors
  );
end;
$$;
