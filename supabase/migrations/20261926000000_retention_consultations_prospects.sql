-- 2026-09-29 온보딩 정책 라운드 H2 — 현재 흐름의 상담(consultations)·잠재고객(prospect_contacts) 개인정보를
-- 2년 뒤 익명화한다(기존 배치는 구 consult_requests 만 처리했다). 추가 전용. RETENTION_BATCH_ENABLED 는 켜지 않는다.
--
--  consultations: 종료된 상담(completed·cancelled·no_show)이 2년 지났고, 활성 수강이 없는 자녀에 묶이지 않은 행만.
--    이름·이메일·전화·고민·검토 메모·결과 메모·종료 검토·동기화 오류 문구·신청 자녀 정보를 지운다(행·상태·결과 유형은 통계용으로 남김).
--  prospect_contacts: 2년간 갱신이 없고 보호자 계정으로 전환되지 않았으며 진행 중(requested·scheduled) 상담이 없는 행.
--
-- 롤백: 새 함수 2개 drop, run_data_retention_batch 를 20261900000016 정의로 복원.

create or replace function public.retention_anonymize_expired_consultations(p_limit integer default 500, p_dry_run boolean default false)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_count integer;
begin
  perform assert_admin_or_service_role();

  if p_dry_run then
    select count(*) into v_count from (
      select c.id from consultations c
      where c.status in ('completed', 'cancelled', 'no_show')
        and coalesce(c.completed_at, c.cancelled_at, c.no_show_at, c.updated_at) < now() - interval '2 years'
        and c.contact_name <> '[비식별화됨]'
        and not exists (select 1 from subject_enrollments se where se.child_id = c.child_id and se.status = 'active')
      limit p_limit
    ) t;
  else
    with victims as (
      select c.id from consultations c
      where c.status in ('completed', 'cancelled', 'no_show')
        and coalesce(c.completed_at, c.cancelled_at, c.no_show_at, c.updated_at) < now() - interval '2 years'
        and c.contact_name <> '[비식별화됨]'
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
$$;

create or replace function public.retention_anonymize_expired_prospect_contacts(p_limit integer default 500, p_dry_run boolean default false)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_count integer;
begin
  perform assert_admin_or_service_role();

  if p_dry_run then
    select count(*) into v_count from (
      select pc.id from prospect_contacts pc
      where pc.updated_at < now() - interval '2 years'
        and pc.converted_guardian_id is null
        and pc.full_name <> '[비식별화됨]'
        and not exists (select 1 from consultations c where c.prospect_contact_id = pc.id and c.status in ('requested', 'scheduled'))
      limit p_limit
    ) t;
  else
    with victims as (
      select pc.id from prospect_contacts pc
      where pc.updated_at < now() - interval '2 years'
        and pc.converted_guardian_id is null
        and pc.full_name <> '[비식별화됨]'
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
$$;

revoke all on function public.retention_anonymize_expired_consultations(integer, boolean) from public, anon, authenticated;
revoke all on function public.retention_anonymize_expired_prospect_contacts(integer, boolean) from public, anon, authenticated;
grant execute on function public.retention_anonymize_expired_consultations(integer, boolean) to service_role;
grant execute on function public.retention_anonymize_expired_prospect_contacts(integer, boolean) to service_role;

create or replace function public.run_data_retention_batch(p_limit integer default 500, p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_notifications integer := 0;
  v_consult integer := 0;
  v_consultations integer := 0;
  v_prospects integer := 0;
  v_access_logs integer := 0;
  v_errors text[] := array[]::text[];
begin
  perform assert_admin_or_service_role();

  begin
    v_notifications := retention_delete_expired_notifications(p_limit, p_dry_run);
  exception when others then
    v_errors := array_append(v_errors, 'notifications: ' || sqlerrm);
  end;

  begin
    v_consult := retention_anonymize_expired_consult_requests(p_limit, p_dry_run);
  exception when others then
    v_errors := array_append(v_errors, 'consult_requests: ' || sqlerrm);
  end;

  begin
    v_consultations := retention_anonymize_expired_consultations(p_limit, p_dry_run);
  exception when others then
    v_errors := array_append(v_errors, 'consultations: ' || sqlerrm);
  end;

  begin
    v_prospects := retention_anonymize_expired_prospect_contacts(p_limit, p_dry_run);
  exception when others then
    v_errors := array_append(v_errors, 'prospect_contacts: ' || sqlerrm);
  end;

  begin
    v_access_logs := retention_delete_expired_access_logs(p_limit, p_dry_run);
  exception when others then
    v_errors := array_append(v_errors, 'access_logs: ' || sqlerrm);
  end;

  return jsonb_build_object(
    'notifications', v_notifications,
    'consultRequests', v_consult,
    'consultations', v_consultations,
    'prospectContacts', v_prospects,
    'accessLogs', v_access_logs,
    'errors', v_errors
  );
end;
$$;
