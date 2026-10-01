-- 2026-09-29 오너 결정: 확정된 미팅의 컨설턴트 변경은 "수정"이 아니라 취소 → 재신청 → 재배정 → 재확정이다.
-- 그리고 미팅 취소는 Google Calendar 이벤트를 반드시 지운다. Calendar 동기화 실패는 자동 재시도한다.
-- 추가 전용 — 기존 행은 삭제·변경하지 않는다(로컬·원격 실측: google_sync_status='failed' 0건, 취소 행 이벤트 0건).
--
--   1) meeting_requests 추가 컬럼:
--      rescheduled_from_id      취소한 옛 미팅(재신청 시 새 행이 가리킴)
--      google_sync_last_error / google_sync_last_attempt_at   마지막 시도 결과(재시도 횟수는 기존 google_sync_retry_count)
--      google_sync_claimed_at   워커 임대(lease) 시각 — 즉시 재시도와 일 1회 크론이 같은 행을 동시에 처리하지 않게 함
--      google_event_deleted_at  취소 뒤 Google 이벤트 삭제가 끝난 시각(이벤트 ID는 이력으로 남김)
--   2) cancel_meeting_request_core(): 취소(+선택적 재신청)를 한 트랜잭션으로. service_role 전용(권한 검사는 호출 서버 액션).
--      옛 행은 삭제하지 않고 cancelled 로 남긴다. 재신청 행은 status='requested', 시간·컨설턴트·이벤트 없음.
--   3) 트리거 meeting_requests_flag_cancel_event_cleanup: status 가 cancelled 로 바뀌는데 지워지지 않은 이벤트가 있으면
--      google_sync_status='failed'(삭제 대기)로 표시 — RLS 로 직접 취소하는 옛 경로나 서버 크래시도 크론이 회수한다.
--   4) claim_meeting_calendar_syncs(): for update skip locked + 임대. 재시도 5회 상한 초과 행은 제외. service_role 전용.
--
-- 롤백: drop trigger meeting_requests_flag_cancel_event_cleanup on meeting_requests;
--   drop function public.meeting_requests_flag_cancel_event_cleanup();
--   drop function public.claim_meeting_calendar_syncs(int, uuid, int);
--   drop function public.cancel_meeting_request_core(uuid, uuid, boolean, text);
--   alter table meeting_requests drop column rescheduled_from_id, drop column google_sync_last_error,
--     drop column google_sync_last_attempt_at, drop column google_sync_claimed_at, drop column google_event_deleted_at;

alter table meeting_requests
  add column if not exists rescheduled_from_id uuid references meeting_requests (id),
  add column if not exists google_sync_last_error text,
  add column if not exists google_sync_last_attempt_at timestamptz,
  add column if not exists google_sync_claimed_at timestamptz,
  add column if not exists google_event_deleted_at timestamptz;

create index if not exists meeting_requests_rescheduled_from_idx on meeting_requests (rescheduled_from_id) where rescheduled_from_id is not null;
create index if not exists meeting_requests_sync_failed_idx on meeting_requests (google_sync_retry_count) where google_sync_status = 'failed';

comment on column meeting_requests.rescheduled_from_id is '취소 후 재신청: 이 행이 대체하는(취소된) 옛 미팅.';
comment on column meeting_requests.google_event_deleted_at is '취소 뒤 Google Calendar 이벤트 삭제 완료 시각. google_event_id 는 이력으로 남긴다.';
comment on column meeting_requests.google_sync_claimed_at is 'Calendar 재동기화 워커 임대 시각(10분). 즉시 재시도·크론 중복 처리 방지.';

-- 2) 취소(+재신청)
create or replace function public.cancel_meeting_request_core(
  p_meeting_request_id uuid,
  p_actor uuid,
  p_rerequest boolean default false,
  p_reason text default null
)
returns table (new_request_id uuid, was_already_cancelled boolean, consultant_id uuid, google_event_id text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row meeting_requests;
  v_new uuid := null;
begin
  select * into v_row from meeting_requests where id = p_meeting_request_id for update;
  if not found then
    raise exception '미팅 요청을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;
  if v_row.status = 'completed' then
    raise exception '완료된 미팅은 취소할 수 없습니다.' using errcode = 'P0001';
  end if;
  if v_row.status = 'cancelled' then
    if p_rerequest then
      raise exception '이미 취소된 미팅입니다. 재신청은 진행 중인 미팅에서만 할 수 있습니다.' using errcode = 'P0001';
    end if;
    return query select null::uuid, true, v_row.consultant_id, v_row.google_event_id;
    return;
  end if;

  update meeting_requests set status = 'cancelled', updated_at = now() where id = p_meeting_request_id;

  if p_rerequest then
    insert into meeting_requests (
      household_id, child_id, subject, content, contact_preference, preferred_contact_time,
      requested_by, source_message_id, status, rescheduled_from_id
    ) values (
      v_row.household_id, v_row.child_id, v_row.subject, v_row.content, v_row.contact_preference, v_row.preferred_contact_time,
      v_row.requested_by, v_row.source_message_id, 'requested', v_row.id
    ) returning id into v_new;

    insert into meeting_request_assignment_history (meeting_request_id, prior_consultant_id, new_consultant_id, actor_id, reason)
    values (v_row.id, v_row.consultant_id, null, p_actor, coalesce(nullif(trim(p_reason), ''), '취소 후 재신청') || ' → 새 요청 ' || v_new::text);
  end if;

  return query select v_new, false, v_row.consultant_id, v_row.google_event_id;
end;
$$;
revoke execute on function public.cancel_meeting_request_core(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.cancel_meeting_request_core(uuid, uuid, boolean, text) to service_role;

-- 3) 취소 시 남은 이벤트 삭제 대기 표시(안전망)
create or replace function public.meeting_requests_flag_cancel_event_cleanup()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled'
     and new.google_event_id is not null and new.google_event_deleted_at is null then
    new.google_sync_status := 'failed';
    new.google_sync_retry_count := 0;
    new.google_sync_last_error := '취소됨 — Calendar 이벤트 삭제 대기';
  end if;
  return new;
end;
$$;
drop trigger if exists meeting_requests_flag_cancel_event_cleanup on meeting_requests;
create trigger meeting_requests_flag_cancel_event_cleanup
  before update of status on meeting_requests
  for each row execute function public.meeting_requests_flag_cancel_event_cleanup();

-- 4) 원자적 claim
create or replace function public.claim_meeting_calendar_syncs(
  p_limit int default 20,
  p_meeting_request_id uuid default null,
  p_max_attempts int default 5
)
returns setof meeting_requests
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  return query
  with picked as (
    select m.id from meeting_requests m
    where m.google_sync_status = 'failed'
      and m.google_sync_retry_count < p_max_attempts
      and (p_meeting_request_id is null or m.id = p_meeting_request_id)
      and (m.google_sync_claimed_at is null or m.google_sync_claimed_at < now() - interval '10 minutes')
    order by m.updated_at
    limit greatest(p_limit, 1)
    for update skip locked
  )
  update meeting_requests m set google_sync_claimed_at = now()
  from picked where m.id = picked.id
  returning m.*;
end;
$$;
revoke execute on function public.claim_meeting_calendar_syncs(int, uuid, int) from public, anon, authenticated;
grant execute on function public.claim_meeting_calendar_syncs(int, uuid, int) to service_role;
