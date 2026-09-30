-- 2026-09-29: 미팅(20261914000000)과 같은 Calendar 재동기화 설계를 첫 상담(consultations)에도 적용한다.
-- 추가 전용 — 기존 행은 삭제·변경하지 않는다(로컬·원격 실측: failed/reconciliation_needed 0건).
--   1) consultations 추가 컬럼: google_sync_last_attempt_at / google_sync_claimed_at(워커 임대) / google_event_deleted_at
--      (재시도 횟수·마지막 오류는 기존 google_sync_retry_count / google_sync_last_error 재사용)
--   2) 트리거 consultations_flag_cancel_event_cleanup: status 가 cancelled 로 바뀌는데 지워지지 않은 이벤트가 있으면
--      google_sync_status='failed'(삭제 대기, 횟수 0)로 표시 — 어떤 취소 경로든 크론이 회수한다.
--   3) claim_consultation_calendar_syncs(): for update skip locked + 10분 임대, 5회 상한 초과 제외, service_role 전용.
--      failed 행 + 임대가 만료된 pending 행(처리 중 서버 크래시)만 대상 — 기본 pending(미동기화 신규)은 건드리지 않는다.
--
-- 롤백: drop trigger consultations_flag_cancel_event_cleanup on consultations;
--   drop function public.consultations_flag_cancel_event_cleanup();
--   drop function public.claim_consultation_calendar_syncs(int, uuid, int);
--   alter table consultations drop column google_sync_last_attempt_at, drop column google_sync_claimed_at, drop column google_event_deleted_at;

alter table consultations
  add column if not exists google_sync_last_attempt_at timestamptz,
  add column if not exists google_sync_claimed_at timestamptz,
  add column if not exists google_event_deleted_at timestamptz;

comment on column consultations.google_sync_claimed_at is 'Calendar 재동기화 워커 임대 시각(10분). 즉시 재시도·크론 중복 처리 방지.';
comment on column consultations.google_event_deleted_at is '취소 뒤 Google Calendar 이벤트 삭제 완료 시각. google_event_id 는 이력으로 남긴다.';

create index if not exists consultations_sync_failed_idx on consultations (google_sync_retry_count) where google_sync_status = 'failed';

create or replace function public.consultations_flag_cancel_event_cleanup()
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
drop trigger if exists consultations_flag_cancel_event_cleanup on consultations;
create trigger consultations_flag_cancel_event_cleanup
  before update of status on consultations
  for each row execute function public.consultations_flag_cancel_event_cleanup();

create or replace function public.claim_consultation_calendar_syncs(
  p_limit int default 20,
  p_consultation_id uuid default null,
  p_max_attempts int default 5
)
returns setof consultations
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  return query
  with picked as (
    select c.id from consultations c
    where (c.google_sync_status = 'failed'
           or (c.google_sync_status = 'pending' and c.google_sync_claimed_at is not null))
      and c.google_sync_retry_count < p_max_attempts
      and (p_consultation_id is null or c.id = p_consultation_id)
      and (c.google_sync_claimed_at is null or c.google_sync_claimed_at < now() - interval '10 minutes')
    order by c.updated_at
    limit greatest(p_limit, 1)
    for update skip locked
  )
  update consultations c set google_sync_claimed_at = now()
  from picked where c.id = picked.id
  returning c.*;
end;
$$;
revoke execute on function public.claim_consultation_calendar_syncs(int, uuid, int) from public, anon, authenticated;
grant execute on function public.claim_consultation_calendar_syncs(int, uuid, int) to service_role;
