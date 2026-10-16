-- R12(Section 2, 2026-09-24) — 자료 유형별 보존기간 자동 삭제·비식별화 배치
-- 1차 슬라이스. product-architecture-v3.md §4.13 정책의 4가지 처리 방식 중
-- 대표 테이블 하나씩을 실제로 구현한다(전체 ~250개 테이블 전수 적용은 이번
-- 슬라이스 범위 밖 — CURRENT.md에 남은 테이블 백로그 기록).
--
-- 처리 방식별 대표 테이블:
--   1) 완전 삭제(즉시/단기): notifications — 읽음 여부 무관 생성 90일 후 삭제.
--      (알림은 원본 이벤트가 아니라 파생 안내이므로 삭제해도 근거 기록이
--      남는다 — 원본은 각 도메인 테이블에 그대로 있다.)
--   2) PII 비식별화(통계·운영 목적 유지): consult_requests — 완료(completed)
--      상담 요청 중 2년 지난 것의 person_name/email/phone/concerns를 지우고
--      category/status/submitted_at 등 집계용 필드는 남긴다(consult_status
--      enum은 requested/confirmed/completed 세 값뿐 — "전환/취소"는 별도
--      컬럼(converted_student_id 등)이라 이번 슬라이스에서는 completed만
--      다룬다).
--   3) 별도 보존기간 뒤 삭제(보안·접근 감사 로그, 1년): session_access_events만
--      다룬다. document_access_events는 `document_access_events_no_update`
--      트리거로 UPDATE/DELETE가 bypass 없이 영구 차단돼 있어(계약·정산 자료
--      접근 이력이라 더 긴 보존이 필요할 수 있음) 제외했다 — 이 테이블의
--      실제 보존기간은 법무 검토 후 결정 필요(아래 "남은 정책 결정 사항"
--      참고). account_status_events/account_closure_access_events는 계정
--      생애주기 감사 기록(병합·폐쇄 이력)이라 이 1년 규칙과 별개이며 이번
--      배치가 건드리지 않는다.
--   4) 접근 차단 후 보존(계정 폐쇄): 이미 구현됨(closed 계정 +
--      record_closed_account_access() 게이트, 20261900000013~15) — 이
--      배치는 관여하지 않는다.
--
-- 실행마다 최대 BATCH_LIMIT행만 처리해 한 번에 과도한 데이터를 지우지
-- 않고, 조건이 매번 재평가되는 WHERE절이라 재실행해도 안전하다(멱등).

create table retention_batch_runs (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  category text not null,
  table_name text not null,
  action text not null,
  target_count integer not null,
  succeeded_count integer not null,
  failed boolean not null default false,
  error_message text,
  dry_run boolean not null default false
);
create index on retention_batch_runs (run_at);

create or replace function public.reject_retention_batch_runs_mutation()
returns trigger
language plpgsql as $$
begin
  raise exception 'retention_batch_runs는 INSERT-only입니다.';
end;
$$;
create trigger retention_batch_runs_no_update
  before update or delete on retention_batch_runs
  for each row execute function public.reject_retention_batch_runs_mutation();
revoke execute on function public.reject_retention_batch_runs_mutation() from public, anon, authenticated, service_role;

alter table retention_batch_runs enable row level security;
create policy "관리자만 조회" on retention_batch_runs for select
  using (is_admin());
-- insert 정책 없음(기본 거부) — 아래 SECURITY DEFINER 함수들만 기록 가능.

-- ---------------------------------------------------------------------------
-- 공통 인가 검사. is_admin()이 false이고 auth.role()이 NULL이면 `false or NULL`
-- =NULL이 되어 plpgsql이 이를 false로 취급해 게이트를 통과시키는 fail-open
-- 결함이 이전 배치(mark_expired_invites 등)에서 실제로 발견됐다 — 여기서는
-- 처음부터 coalesce로 막는다.
create or replace function public.assert_admin_or_service_role()
returns void
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  if not (is_admin() or coalesce(auth.role(), '') = 'service_role') then
    raise exception '이 작업은 관리자 또는 시스템만 할 수 있습니다.';
  end if;
end;
$$;
revoke execute on function public.assert_admin_or_service_role() from public, anon;

-- ---------------------------------------------------------------------------
-- 1) 완전 삭제: 90일 지난 알림.
create or replace function public.retention_delete_expired_notifications(p_limit integer default 500, p_dry_run boolean default false)
returns integer
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_count integer;
begin
  perform assert_admin_or_service_role();

  if p_dry_run then
    select count(*) into v_count from (
      select id from notifications where created_at < now() - interval '90 days' limit p_limit
    ) t;
  else
    with victims as (
      select id from notifications where created_at < now() - interval '90 days' limit p_limit
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
$$;
revoke execute on function public.retention_delete_expired_notifications(integer, boolean) from public, anon;

-- ---------------------------------------------------------------------------
-- 2) PII 비식별화: 2년 지난 완료/전환/취소 상담 요청의 연락처 정보.
-- status가 'pending'/'scheduled'처럼 진행 중인 요청은 대상에서 제외한다
-- (아직 살아있는 리드를 지우면 안 된다).
create or replace function public.retention_anonymize_expired_consult_requests(p_limit integer default 500, p_dry_run boolean default false)
returns integer
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_count integer;
begin
  perform assert_admin_or_service_role();

  if p_dry_run then
    select count(*) into v_count from (
      select id from consult_requests
      where status = 'completed'
        and coalesce(completed_at, submitted_at) < now() - interval '2 years'
        and person_name <> '[비식별화됨]'
      limit p_limit
    ) t;
  else
    with victims as (
      select id from consult_requests
      where status = 'completed'
        and coalesce(completed_at, submitted_at) < now() - interval '2 years'
        and person_name <> '[비식별화됨]'
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
$$;
revoke execute on function public.retention_anonymize_expired_consult_requests(integer, boolean) from public, anon;

-- ---------------------------------------------------------------------------
-- 3) 별도 보존기간(1년) 뒤 삭제: 보안·접근 감사 로그.
-- document_access_events는 이번 배치에서 제외한다 — 그 테이블은
-- `document_access_events_no_update` 트리거로 UPDATE/DELETE를 예외 없이
-- 영구 차단하도록 이미 설계돼 있고(bypass 토큰조차 없음, 계약·정산 자료
-- 접근 이력이라 session_access_events보다 더 오래 보존해야 할 가능성이
-- 있다), 이 정책이 "1년 후 삭제"와 같은 규칙인지 더 긴 별도 보존기간이어야
-- 하는지는 법무 검토가 필요한 미확정 정책이다(§4.13 목록에도 명시가 없음) —
-- 임의로 트리거를 우회하거나 정책을 추정해 삭제 경로를 뚫지 않는다.
create or replace function public.retention_delete_expired_access_logs(p_limit integer default 500, p_dry_run boolean default false)
returns integer
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_count1 integer;
begin
  perform assert_admin_or_service_role();

  if p_dry_run then
    select count(*) into v_count1 from (
      select id from session_access_events where occurred_at < now() - interval '1 year' limit p_limit
    ) t1;
  else
    with victims1 as (
      select id from session_access_events where occurred_at < now() - interval '1 year' limit p_limit
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
$$;
revoke execute on function public.retention_delete_expired_access_logs(integer, boolean) from public, anon;

-- ---------------------------------------------------------------------------
-- 4) 오케스트레이터 — cron이 부르는 진입점 하나. 개별 배치가 실패해도 나머지는
-- 계속 실행한다(한 카테고리 실패가 전체를 막지 않는다).
create or replace function public.run_data_retention_batch(p_limit integer default 500, p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_notifications integer := 0;
  v_consult integer := 0;
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
    v_access_logs := retention_delete_expired_access_logs(p_limit, p_dry_run);
  exception when others then
    v_errors := array_append(v_errors, 'access_logs: ' || sqlerrm);
  end;

  return jsonb_build_object(
    'notifications', v_notifications,
    'consultRequests', v_consult,
    'accessLogs', v_access_logs,
    'errors', v_errors
  );
end;
$$;
revoke execute on function public.run_data_retention_batch(integer, boolean) from public, anon;
