-- 2026-09-29 오너 규칙 후속: 미팅(meeting_requests)에 담당 컨설턴트를 배정하는 경로 + 상담↔미팅 대칭 겹침 금지.
-- 추가 전용 — 기존 행·이력은 삭제·수정하지 않는다. 옛 데이터는 원격·로컬 실측 겹침 0건.
--
--   1) meeting_request_assignment_history: 미팅 담당 컨설턴트 배정·변경 이력(관리자만 조회).
--   2) admin_assign_meeting_consultant(): 관리자만. 확정(scheduled) 전, 종료 전 미팅에만 배정·변경 가능.
--      배정 자체는 시간·Calendar 이벤트를 만들지 않는다. 이미 시간이 있는 옛 미팅이면 기존 트리거
--      meeting_requests_enforce_consultant 가 그 컨설턴트와의 겹침을 거절한다.
--   3) consultations 트리거: 같은 컨설턴트의 활성 미팅과 겹치는 상담 시간 신규 기록 거절(맞닿음 허용,
--      취소·종료 무시, 컨설턴트가 다르면 허용). 컨설턴트별 advisory lock 키는 미팅 트리거와 동일.
--      redeem_consultation_scheduling_link / admin_reschedule_consultation / assign_consultation_owner 는
--      모두 consultations 를 UPDATE 하므로 이 트리거가 최종 방어선이다.
--   4) list_consultant_open_slots: 그 컨설턴트의 활성 미팅과 겹치는 슬롯을 숨긴다.
--
-- 롤백: drop trigger consultations_no_meeting_overlap on consultations; drop function
--   public.consultations_no_meeting_overlap(); drop function public.admin_assign_meeting_consultant(uuid,uuid,text);
--   drop table meeting_request_assignment_history; list_consultant_open_slots 는 20261908000000 이전 본문으로 복원.

create table if not exists meeting_request_assignment_history (
  id uuid primary key default gen_random_uuid(),
  meeting_request_id uuid not null references meeting_requests (id) on delete cascade,
  prior_consultant_id uuid references profiles (id),
  new_consultant_id uuid references profiles (id),
  actor_id uuid references profiles (id),
  reason text,
  changed_at timestamptz not null default now()
);
create index if not exists meeting_request_assignment_history_mr_idx
  on meeting_request_assignment_history (meeting_request_id, changed_at desc);
alter table meeting_request_assignment_history enable row level security;
drop policy if exists "관리자 조회" on meeting_request_assignment_history;
create policy "관리자 조회" on meeting_request_assignment_history for select using (is_admin());

create or replace function public.admin_assign_meeting_consultant(
  p_meeting_request_id uuid,
  p_consultant_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row meeting_requests;
begin
  if not is_admin() then
    raise exception '관리자만 미팅 담당 컨설턴트를 배정할 수 있습니다.' using errcode = 'P0001';
  end if;
  if p_consultant_id is null or not exists (select 1 from profiles where id = p_consultant_id and role = 'consultant') then
    raise exception '배정할 컨설턴트를 찾을 수 없습니다.' using errcode = 'P0001';
  end if;

  select * into v_row from meeting_requests where id = p_meeting_request_id for update;
  if not found then
    raise exception '미팅 요청을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;
  if v_row.status not in ('requested', 'confirming', 'scheduling') then
    raise exception '이미 일정이 확정되었거나 종료된 미팅은 담당 컨설턴트를 바꿀 수 없습니다.' using errcode = 'P0001';
  end if;
  if v_row.consultant_id is not distinct from p_consultant_id then
    return;
  end if;

  update meeting_requests set consultant_id = p_consultant_id, updated_at = now()
  where id = p_meeting_request_id;

  insert into meeting_request_assignment_history (meeting_request_id, prior_consultant_id, new_consultant_id, actor_id, reason)
  values (p_meeting_request_id, v_row.consultant_id, p_consultant_id, auth.uid(), p_reason);
end;
$$;
revoke execute on function public.admin_assign_meeting_consultant(uuid, uuid, text) from public, anon;
grant execute on function public.admin_assign_meeting_consultant(uuid, uuid, text) to authenticated, service_role;

-- 3) 상담 → 미팅 겹침 (미팅 트리거의 대칭)
create or replace function public.consultations_no_meeting_overlap()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.admissions_consultant_id is not null
     and new.status in ('requested', 'scheduled')
     and new.starts_at is not null and new.ends_at is not null then
    perform pg_advisory_xact_lock(hashtextextended('meeting-consultant-' || new.admissions_consultant_id::text, 0));
    if exists (
      select 1 from meeting_requests m
      where m.consultant_id = new.admissions_consultant_id
        and m.status in ('requested', 'confirming', 'scheduling', 'scheduled')
        and m.starts_at is not null and m.ends_at is not null
        and tstzrange(m.starts_at, m.ends_at) && tstzrange(new.starts_at, new.ends_at)
    ) then
      raise exception '같은 컨설턴트의 미팅 일정과 시간이 겹칩니다. 다른 시간을 선택해 주세요.' using errcode = '23P01';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists consultations_no_meeting_overlap on consultations;
create trigger consultations_no_meeting_overlap
  before insert or update of status, starts_at, ends_at, admissions_consultant_id on consultations
  for each row execute function public.consultations_no_meeting_overlap();

-- 4) 고객 셀프 스케줄링 슬롯: 컨설턴트의 활성 미팅과 겹치는 슬롯 숨김
create or replace function public.list_consultant_open_slots(p_token text, p_from timestamp with time zone, p_to timestamp with time zone)
 returns table(slot_starts_at timestamp with time zone)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_link consultation_scheduling_links;
begin
  select * into v_link from consultation_scheduling_links where token = p_token;
  if not found or v_link.expires_at < now() or v_link.used_at is not null then
    raise exception '유효하지 않거나 만료된 예약 링크입니다.';
  end if;

  return query
  with weekday_rules as (
    select r.weekday, r.start_time, r.end_time
    from consult_availability_rules r
    where r.active and r.consultant_id = v_link.consultant_id
  ),
  days as (
    select generate_series(date_trunc('day', p_from), date_trunc('day', p_to), interval '1 day')::date as d
  ),
  rule_candidate_slots as (
    select
      ((d.d + wr.start_time)::timestamp at time zone 'America/Los_Angeles' + (n * interval '60 minutes')) as slot_start,
      ((d.d + wr.start_time)::timestamp at time zone 'America/Los_Angeles' + ((n + 1) * interval '60 minutes')) as slot_end
    from days d
    join weekday_rules wr on wr.weekday = extract(dow from d.d)::smallint
    cross join lateral generate_series(0, (extract(epoch from (wr.end_time - wr.start_time)) / 3600)::int - 1) as n
  )
  select distinct cs.slot_start
  from rule_candidate_slots cs
  where cs.slot_start >= p_from
    and cs.slot_start < p_to
    and cs.slot_start > now()
    and not exists (
      select 1 from consult_availability_exceptions e
      where e.consultant_id = v_link.consultant_id
        and e.exception_date = (cs.slot_start at time zone 'America/Los_Angeles')::date
        and e.is_closed
        and (
          e.start_time is null
          or (
            (cs.slot_start at time zone 'America/Los_Angeles')::time < e.end_time
            and (cs.slot_end at time zone 'America/Los_Angeles')::time > e.start_time
          )
        )
    )
    and not exists (
      select 1 from consultations c
      where c.starts_at is not null
        and c.status in ('requested', 'scheduled')
        and c.admissions_consultant_id = v_link.consultant_id
        and tstzrange(c.starts_at, c.ends_at) && tstzrange(cs.slot_start, cs.slot_end)
    )
    and not exists (
      select 1 from meeting_requests mr
      where mr.consultant_id = v_link.consultant_id
        and mr.starts_at is not null and mr.ends_at is not null
        and mr.status in ('requested', 'confirming', 'scheduling', 'scheduled')
        and tstzrange(mr.starts_at, mr.ends_at) && tstzrange(cs.slot_start, cs.slot_end)
    )
  order by cs.slot_start;
end;
$function$;
