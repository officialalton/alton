-- 2026-10-06 보존 3차(추가 전용) — legal hold 설정 권한 지정자 제한 + 요청 흐름,
-- 과외 서비스 종료일 함수, 삭제 큐 7일 실패 에스컬레이션. 배치·cron·Drive 삭제 플래그는 닫힌 상태 유지.
-- 롤백: 새 함수·테이블 drop, place/extend/release_legal_hold·legal_hold_notify_reviews_due·
--       retention_mark_deletion_result·run_data_retention_batch 를 20262100000082/83 정의로 복원.

-- 1) 지정자: 기존 supervisor_capabilities('legal_hold_holder') 재사용(부여는 기존 마스터 관리자 정책 그대로).
--    현재 소유자 계정(official@alton.education)이 있으면 시드한다(없는 환경에서는 no-op).
insert into supervisor_capabilities (profile_id, capability, granted_by)
select p.id, 'legal_hold_holder', p.id
  from profiles p join auth.users u on u.id = p.id
 where p.role = 'admin' and lower(u.email) = 'official@alton.education'
on conflict do nothing;

create or replace function public.is_legal_hold_holder() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(is_admin() and current_user_has_capability('legal_hold_holder'), false);
$$;
revoke execute on function public.is_legal_hold_holder() from public, anon;
grant execute on function public.is_legal_hold_holder() to authenticated, service_role;

-- 지정자 전원에게 알림(없으면 모든 관리자 — 알림이 사라지지 않게).
create or replace function public._notify_legal_hold_holders(p_text text) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_n integer;
begin
  with targets as (
    select profile_id as id from supervisor_capabilities where capability = 'legal_hold_holder'
    union
    select p.id from profiles p where p.role = 'admin'
      and not exists (select 1 from supervisor_capabilities where capability = 'legal_hold_holder')
  ), ins as (
    insert into notifications (recipient_id, text) select id, p_text from targets returning 1)
  select count(*) into v_n from ins;
  return v_n;
end $$;
revoke all on function public._notify_legal_hold_holders(text) from public, anon, authenticated;
grant execute on function public._notify_legal_hold_holders(text) to service_role;

-- 2) 설정·연장·해제는 지정자만.
create or replace function public.place_legal_hold(p_subject_type text, p_subject_id uuid, p_scope text[], p_reason text, p_review_by date)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if not is_legal_hold_holder() then raise exception '지정된 legal hold 담당자만 보류를 설정할 수 있습니다(다른 관리자는 요청만 가능).'; end if;
  if p_review_by is null then raise exception 'review_by(재검토일)는 필수입니다 — 무기한 보류는 설정할 수 없습니다.'; end if;
  if p_review_by <= current_date or p_review_by > current_date + 366 then
    raise exception 'review_by는 내일부터 최대 12개월 이내여야 합니다(연장은 새 기록으로).';
  end if;
  insert into legal_holds (subject_type, subject_id, scope, reason, set_by, review_by)
  values (p_subject_type, p_subject_id, coalesce(p_scope, array['all']), p_reason, auth.uid(), p_review_by)
  returning id into v_id;
  insert into legal_hold_events (hold_id, event_type, actor_id, review_by, note) values (v_id, 'placed', auth.uid(), p_review_by, p_reason);
  return v_id;
end $$;

create or replace function public.extend_legal_hold(p_hold_id uuid, p_new_review_by date, p_note text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_legal_hold_holder() then raise exception '지정된 legal hold 담당자만 보류를 연장할 수 있습니다.'; end if;
  if p_note is null or length(trim(p_note)) < 10 then raise exception '연장 사유(10자 이상)가 필요합니다.'; end if;
  if p_new_review_by <= current_date or p_new_review_by > current_date + 366 then
    raise exception 'review_by는 내일부터 최대 12개월 이내여야 합니다.';
  end if;
  update legal_holds set review_by = p_new_review_by, last_review_notice_at = null
   where id = p_hold_id and released_at is null;
  if not found then raise exception '활성 legal hold가 아닙니다.'; end if;
  insert into legal_hold_events (hold_id, event_type, actor_id, review_by, note) values (p_hold_id, 'extended', auth.uid(), p_new_review_by, p_note);
end $$;

create or replace function public.release_legal_hold(p_hold_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_legal_hold_holder() then raise exception '지정된 legal hold 담당자만 보류를 해제할 수 있습니다.'; end if;
  update legal_holds set released_by = auth.uid(), released_at = now(), release_note = p_note
   where id = p_hold_id and released_at is null;
  if not found then raise exception '활성 legal hold가 아닙니다.'; end if;
  insert into legal_hold_events (hold_id, event_type, actor_id, note) values (p_hold_id, 'released', auth.uid(), p_note);
end $$;

-- 3) 요청: 일반 관리자는 요청만, 지정자가 승인(보류 생성)·반려.
create table legal_hold_requests (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in
    ('global','profile','student','household','consultation','enrollment','session','prospect_contact','consult_request')),
  subject_id uuid,
  scope text[] not null default array['all'],
  reason text not null check (length(trim(reason)) >= 10),
  requested_by uuid not null references profiles (id),
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid references profiles (id),
  decided_at timestamptz,
  decision_note text,
  hold_id uuid references legal_holds (id),
  check ((subject_type = 'global') = (subject_id is null))
);
alter table legal_hold_requests enable row level security;
create policy "관리자 조회" on legal_hold_requests for select using (is_admin());

create or replace function public.request_legal_hold(p_subject_type text, p_subject_id uuid, p_scope text[], p_reason text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if not is_admin() then raise exception '관리자만 보류를 요청할 수 있습니다.'; end if;
  insert into legal_hold_requests (subject_type, subject_id, scope, reason, requested_by)
  values (p_subject_type, p_subject_id, coalesce(p_scope, array['all']), p_reason, auth.uid()) returning id into v_id;
  perform _notify_legal_hold_holders('Legal hold request pending (' || p_subject_type || '). Review it in the admin legal hold queue.');
  return v_id;
end $$;

create or replace function public.decide_legal_hold_request(p_request_id uuid, p_approve boolean, p_note text, p_review_by date default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare r legal_hold_requests%rowtype; v_hold uuid;
begin
  if not is_legal_hold_holder() then raise exception '지정된 legal hold 담당자만 요청을 처리할 수 있습니다.'; end if;
  select * into r from legal_hold_requests where id = p_request_id and status = 'pending' for update;
  if not found then raise exception '처리할 수 있는 대기 중 요청이 아닙니다.'; end if;
  if p_approve then
    v_hold := place_legal_hold(r.subject_type, r.subject_id, r.scope, r.reason, p_review_by);
  end if;
  update legal_hold_requests set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = auth.uid(), decided_at = now(), decision_note = p_note, hold_id = v_hold where id = r.id;
  return v_hold;
end $$;
revoke execute on function public.request_legal_hold(text, uuid, text[], text) from public, anon;
revoke execute on function public.decide_legal_hold_request(uuid, boolean, text, date) from public, anon;
grant execute on function public.request_legal_hold(text, uuid, text[], text) to authenticated;
grant execute on function public.decide_legal_hold_request(uuid, boolean, text, date) to authenticated;

-- 재검토 알림: 설정자 + 지정자 전원. 자동 해제 없음.
create or replace function public.legal_hold_notify_reviews_due() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer := 0; r record;
begin
  perform assert_admin_or_service_role();
  for r in select id, set_by, review_by, subject_type from legal_holds
           where released_at is null and review_by <= current_date
             and (last_review_notice_at is null or last_review_notice_at < now() - interval '7 days') loop
    insert into notifications (recipient_id, text)
    values (r.set_by, 'Legal hold review is due (' || r.subject_type || ', review date ' || r.review_by || '). Extend or release it; it is NOT released automatically.');
    perform _notify_legal_hold_holders('Legal hold review is due (' || r.subject_type || ', review date ' || r.review_by || '). It stays active until a holder extends or releases it.');
    update legal_holds set last_review_notice_at = now() where id = r.id;
    insert into legal_hold_events (hold_id, event_type, review_by, note) values (r.id, 'review_notice', r.review_by, 'review due notice');
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- 4) 과외 서비스 종료 시점. 진행 중(planned·active·paused) 수강이 하나라도 있으면 NULL(종료 아님).
--    종료된 수강(completed·terminated)만 있으면 그중 가장 늦은 실제 종료 시각:
--    수강별 max(수업 actual_end_at, 배정 effective_until), 둘 다 없으면 수강 updated_at(상태 변경 시각 근사).
--    무료 학습 활동·재가입은 이 값을 연장하지 않는다(재가입으로 새 수강이 진행되면 NULL, 끝나면 새 종료 시각).
--    이 값은 출결·학습이력(3년) 판단용이며, 수업자료(Smart Notes 등)는 수업별 종료일 +1년을 그대로 쓴다.
create or replace function public.tutoring_service_end(p_child_id uuid) returns timestamptz
language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when exists (select 1 from subject_enrollments where child_id = p_child_id and status in ('planned','active','paused')) then null
    else (
      select max(coalesce(greatest(
        (select max(s.actual_end_at) from sessions s where s.subject_enrollment_id = se.id),
        (select max(ta.effective_until::timestamptz) from teacher_assignments ta where ta.subject_enrollment_id = se.id)
      ), se.updated_at))
      from subject_enrollments se where se.child_id = p_child_id and se.status in ('completed','terminated'))
  end;
$$;
revoke execute on function public.tutoring_service_end(uuid) from public, anon, authenticated;
grant execute on function public.tutoring_service_end(uuid) to service_role;

-- 5) 삭제 큐 7일 연속 실패 에스컬레이션: failed 유지 + file id 보존 + 담당자 알림(완료 처리 안 함).
alter table retention_deletion_targets add column first_failed_at timestamptz, add column escalated_at timestamptz;

create or replace function public.retention_mark_deletion_result(p_id uuid, p_ok boolean, p_error text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform assert_admin_or_service_role();
  if p_ok then
    update retention_deletion_targets set status = 'deleted', deleted_at = now(), last_error = null where id = p_id;
  else
    update retention_deletion_targets set status = 'failed', last_error = left(coalesce(p_error, 'unknown'), 500),
      first_failed_at = coalesce(first_failed_at, now()),
      next_attempt_at = now() + least(interval '7 days', interval '1 hour' * power(2, least(attempts, 8)))
     where id = p_id;
  end if;
end $$;

create or replace function public.retention_escalate_stuck_deletions() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer := 0; r record;
begin
  perform assert_admin_or_service_role();
  for r in select id, drive_file_id, last_error from retention_deletion_targets
           where status = 'failed' and escalated_at is null and first_failed_at < now() - interval '7 days' loop
    perform _notify_legal_hold_holders('Retention deletion has failed for 7+ days (Drive file ' || r.drive_file_id || '): ' || coalesce(left(r.last_error, 120), '') || '. It stays queued; manual follow-up needed.');
    update retention_deletion_targets set escalated_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke all on function public.retention_escalate_stuck_deletions() from public, anon, authenticated;
grant execute on function public.retention_escalate_stuck_deletions() to service_role;

create or replace function public.run_data_retention_batch(p_limit integer default 500, p_dry_run boolean default false)
returns jsonb
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_notifications integer := 0; v_consult integer := 0; v_consultations integer := 0; v_prospects integer := 0;
  v_access_logs integer := 0; v_thread_msgs integer := 0; v_ta_msgs integer := 0;
  v_sn_enqueued integer := 0; v_sn_finalized integer := 0; v_hold_notices integer := 0; v_stuck integer := 0;
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
    begin v_stuck := retention_escalate_stuck_deletions();
    exception when others then v_errors := array_append(v_errors, 'stuck_deletions: ' || sqlerrm); end;
  end if;

  return jsonb_build_object(
    'notifications', v_notifications, 'consultRequests', v_consult, 'consultations', v_consultations,
    'prospectContacts', v_prospects, 'accessLogs', v_access_logs,
    'subjectThreadMessages', v_thread_msgs, 'teacherAdminMessages', v_ta_msgs,
    'smartNotesEnqueued', v_sn_enqueued, 'smartNotesFinalized', v_sn_finalized,
    'legalHoldReviewNotices', v_hold_notices, 'stuckDeletionNotices', v_stuck, 'errors', v_errors
  );
end;
$$;
