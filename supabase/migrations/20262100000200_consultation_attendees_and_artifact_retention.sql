-- 1) Additional attendees may also belong to a follow-up consultation (meeting_requests): exactly one of session_id /
--    meeting_request_id. Consultants can read attendees of their own meetings.
alter table lesson_additional_attendees alter column session_id drop not null;
alter table lesson_additional_attendees
  add column meeting_request_id uuid references meeting_requests (id) on delete cascade;
alter table lesson_additional_attendees
  add constraint lesson_additional_attendees_one_target check (num_nonnulls(session_id, meeting_request_id) = 1);
create index on lesson_additional_attendees (meeting_request_id) where meeting_request_id is not null;
create policy "담당 컨설턴트 조회" on lesson_additional_attendees for select
  using (exists (select 1 from meeting_requests m where m.id = meeting_request_id and m.consultant_id = auth.uid()));

-- 2) Consultation artifact retention: the only consultation artifact today is the first-consultation Smart Notes file
--    (consultations.smart_notes_drive_file_id). Same rule as lessons: eligible one year after the consultation end date, via
--    the existing deletion queue. The DB column is cleared ONLY after the Drive deletion succeeded (never before), and the
--    claim step re-checks legal holds for consultations. Nothing schedules the new enqueue function (batch/cron switches closed).
create or replace function public.retention_enqueue_expired_consultation_artifacts(p_limit integer default 500, p_dry_run boolean default false)
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer := 0;
begin
  perform assert_admin_or_service_role();
  create temp table if not exists _rt_cons (cid uuid, fid text, due timestamptz) on commit drop;
  truncate _rt_cons;
  insert into _rt_cons
  select c.id, c.smart_notes_drive_file_id, coalesce(c.ends_at, c.completed_at, c.scheduled_at) + interval '1 year'
    from consultations c
   where c.smart_notes_drive_file_id is not null
     and coalesce(c.ends_at, c.completed_at, c.scheduled_at) < now() - interval '1 year'
     and not has_active_legal_hold('global', null)
     and not has_active_legal_hold('consultation', c.id)
     and (c.child_id is null or not has_active_legal_hold('student', c.child_id))
     and (c.household_id is null or not has_active_legal_hold('household', c.household_id));
  if p_dry_run then
    select count(*) into v_count from (
      select 1 from _rt_cons t where not exists (select 1 from retention_deletion_targets r where r.source_table = 'consultations' and r.source_id = t.cid::text and r.drive_file_id = t.fid) limit p_limit) x;
  else
    with ins as (
      insert into retention_deletion_targets (category, source_table, source_id, session_id, drive_file_id, due_at)
      select 'lesson_ai_artifacts', 'consultations', cid::text, null, fid, due from _rt_cons limit p_limit
      on conflict do nothing returning id)
    select count(*) into v_count from ins;
  end if;
  insert into retention_batch_runs (category, table_name, action, target_count, succeeded_count, dry_run)
  values ('consultation_artifacts_1y_enqueue', 'retention_deletion_targets', 'enqueue', v_count, v_count, p_dry_run);
  return v_count;
end $$;
revoke execute on function public.retention_enqueue_expired_consultation_artifacts(integer, boolean) from public, anon, authenticated;
grant execute on function public.retention_enqueue_expired_consultation_artifacts(integer, boolean) to service_role;

create or replace function public.retention_claim_deletion_targets(p_limit integer default 50)
returns table (id uuid, drive_file_id text, attempts integer)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform assert_admin_or_service_role();
  return query
  with c as (
    select t.id from retention_deletion_targets t
    left join sessions s on s.id = t.session_id
    left join subject_enrollments se on se.id = s.subject_enrollment_id
    where t.status in ('pending','failed') and t.next_attempt_at <= now()
      and not has_active_legal_hold('global', null)
      and (t.session_id is null or (not has_active_legal_hold('session', t.session_id)
           and not has_active_legal_hold('enrollment', s.subject_enrollment_id)
           and not has_active_legal_hold('student', se.child_id)))
      and (t.source_table <> 'consultations' or not has_active_legal_hold('consultation', t.source_id::uuid))
    order by t.next_attempt_at limit p_limit for update of t skip locked)
  update retention_deletion_targets t set attempts = t.attempts + 1
    from c where t.id = c.id returning t.id, t.drive_file_id, t.attempts;
end $$;

create or replace function public.retention_finalize_deleted_smart_notes(p_limit integer default 500, p_dry_run boolean default false)
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer := 0; r record;
begin
  perform assert_admin_or_service_role();
  for r in select * from retention_deletion_targets
           where status = 'deleted' and finalized_at is null limit p_limit loop
    if not p_dry_run then
      if r.source_table = 'session_smart_notes' then
        delete from session_smart_notes where session_id = r.source_id::uuid and drive_file_id = r.drive_file_id;
      elsif r.source_table = 'consultations' then
        update consultations set smart_notes_drive_file_id = null
         where id = r.source_id::uuid and smart_notes_drive_file_id = r.drive_file_id;
      else
        update smart_notes_generation_events set raw_payload = '{}', drive_file_id = null, google_meeting_code = null,
               google_conference_record_name = null where id = r.source_id::uuid;
      end if;
      update retention_deletion_targets set finalized_at = now() where id = r.id;
    end if;
    v_count := v_count + 1;
  end loop;
  insert into retention_batch_runs (category, table_name, action, target_count, succeeded_count, dry_run)
  values ('smart_notes_1y_finalize', 'session_smart_notes', 'delete', v_count, v_count, p_dry_run);
  return v_count;
end $$;
