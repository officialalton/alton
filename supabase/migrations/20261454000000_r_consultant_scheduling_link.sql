-- 컨설턴트 Phase 2b(2026-09-22 스펙 §Consultation Lifecycle, §Scheduling after
-- Assignment) — 사용자 승인: "지금 바로 랜딩 폼도 스펙대로 고침".
--
-- 1) submit_homepage_consult_request(): p_starts_at를 nullable로 바꿔 "신청만
--    받고 슬롯은 나중에" 흐름을 허용한다. 기존 호출(슬롯 지정)도 그대로 동작
--    한다 — 다른 신청 경로(보호자 포털 재상담 등)는 이 함수를 안 쓰므로 영향 없다.
-- 2) consultation_scheduling_links — 배정된 컨설턴트 전용 서명 링크(토큰).
-- 3) list_consultant_open_slots()/redeem_consultation_scheduling_link() —
--    list_open_consult_slots()와 동일한 슬롯 계산 로직을 컨설턴트 개인
--    가능시간(consultant_id 스코프)으로 재사용.

create or replace function public.submit_homepage_consult_request(
  p_full_name text,
  p_email text,
  p_phone text,
  p_starts_at timestamptz,
  p_student_grade text,
  p_concerns text,
  p_idempotency_key text
)
returns consultations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ends_at timestamptz;
  v_prospect prospect_contacts;
  v_consultation consultations;
  v_existing consultations;
begin
  if p_idempotency_key is not null then
    select * into v_existing from consultations where idempotency_key = p_idempotency_key;
    if found then
      return v_existing;
    end if;
  end if;

  if p_starts_at is not null then
    v_ends_at := p_starts_at + interval '60 minutes';

    if p_starts_at <= now() then
      raise exception '지난 시간은 상담을 신청할 수 없습니다.';
    end if;

    if extract(minute from p_starts_at) not in (0) or extract(second from p_starts_at) <> 0 then
      raise exception '상담 슬롯은 정시 단위로만 신청할 수 있습니다.';
    end if;

    perform 1 from consultations c
    where c.starts_at is not null
      and c.status in ('requested', 'scheduled')
      and tstzrange(c.starts_at, c.ends_at) && tstzrange(p_starts_at, v_ends_at)
    for update;
    if found then
      raise exception '이미 다른 상담이 신청되었거나 확정된 시간입니다. 다른 시간을 선택해 주세요.';
    end if;
  end if;

  if exists (
    select 1 from consultations c
    where c.status = 'requested'
      and lower(trim(c.contact_email)) = lower(trim(p_email))
  ) then
    raise exception '이미 처리 대기 중인 상담 신청이 있습니다. 관리자가 확인할 때까지 기다려 주세요.';
  end if;

  insert into prospect_contacts (full_name, primary_email, primary_phone)
  values (p_full_name, p_email, p_phone)
  returning * into v_prospect;

  insert into consultations (
    prospect_contact_id, source, contact_name, contact_email, contact_phone,
    student_grade, category, concerns, status, requested_at,
    starts_at, ends_at, idempotency_key
  ) values (
    v_prospect.id, 'homepage', p_full_name, p_email, p_phone,
    p_student_grade, 'family', p_concerns, 'requested', now(),
    p_starts_at, v_ends_at, p_idempotency_key
  )
  returning * into v_consultation;

  insert into consultation_status_events (consultation_id, previous_status, new_status, reason)
  values (v_consultation.id, null, 'requested', '홈페이지 상담 신청');

  return v_consultation;
end;
$$;

comment on function public.submit_homepage_consult_request(text, text, text, timestamptz, text, text, text) is
  '2026-09-22 스펙 개정: p_starts_at가 null이면 "신청만" 접수한다(어드미션 컨설턴트 배정 후 '
  '전용 스케줄링 링크로 슬롯을 고른다 — consultation_scheduling_link 관련 함수 참고). '
  'p_starts_at가 있으면 기존 동작(즉시 슬롯 점유)을 그대로 유지한다.';

-- =========================================================================
-- 컨설턴트 전용 스케줄링 링크
-- =========================================================================
create table consultation_scheduling_links (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references consultations (id) on delete cascade,
  consultant_id uuid not null references profiles (id),
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
create index on consultation_scheduling_links (consultation_id);

comment on table consultation_scheduling_links is
  '스펙 §Scheduling after Assignment — 배정 후 고객에게 보내는 서명된 예약 링크. 토큰은 '
  'SECURITY DEFINER RPC(list_consultant_open_slots/redeem_consultation_scheduling_link) 안에서만 '
  '검증한다 — 테이블 자체에는 anon select 정책이 없다.';

alter table consultation_scheduling_links enable row level security;
create policy "관리자/본인 컨설턴트 조회" on consultation_scheduling_links for select
  using (is_admin() or consultant_id = auth.uid());
create policy "관리자/본인 컨설턴트 생성" on consultation_scheduling_links for insert
  with check (is_admin() or consultant_id = auth.uid());

create or replace function public.list_consultant_open_slots(
  p_token text,
  p_from timestamptz,
  p_to timestamptz
)
returns table (slot_starts_at timestamptz)
language plpgsql stable
security definer
set search_path = public
as $$
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
  order by cs.slot_start;
end;
$$;

comment on function public.list_consultant_open_slots(text, timestamptz, timestamptz) is
  'list_open_consult_slots()와 동일 로직을 배정된 컨설턴트 개인 가능시간(consultant_id 스코프)으로 좁혀 재사용. 토큰 검증 포함.';

grant execute on function public.list_consultant_open_slots(text, timestamptz, timestamptz) to anon, authenticated;

create or replace function public.redeem_consultation_scheduling_link(
  p_token text,
  p_starts_at timestamptz
)
returns consultations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link consultation_scheduling_links;
  v_row consultations;
  v_ends_at timestamptz := p_starts_at + interval '60 minutes';
begin
  select * into v_link from consultation_scheduling_links where token = p_token for update;
  if not found or v_link.expires_at < now() or v_link.used_at is not null then
    raise exception '유효하지 않거나 만료된 예약 링크입니다.';
  end if;

  select * into v_row from consultations where id = v_link.consultation_id for update;
  if not found then
    raise exception '상담 요청을 찾을 수 없습니다.';
  end if;
  if v_row.status <> 'requested' or v_row.starts_at is not null then
    raise exception '이미 처리된 상담 요청입니다.';
  end if;
  if v_row.admissions_consultant_id is distinct from v_link.consultant_id then
    raise exception '담당 컨설턴트가 변경되어 이 링크는 더 이상 사용할 수 없습니다.';
  end if;

  perform 1 from consultations c
  where c.starts_at is not null
    and c.status in ('requested', 'scheduled')
    and c.admissions_consultant_id = v_link.consultant_id
    and tstzrange(c.starts_at, c.ends_at) && tstzrange(p_starts_at, v_ends_at)
  for update;
  if found then
    raise exception '이미 다른 상담이 있는 시간입니다. 다른 시간을 선택해 주세요.';
  end if;

  update consultations set
    starts_at = p_starts_at,
    ends_at = v_ends_at,
    status = 'scheduled',
    scheduled_at = p_starts_at,
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  update consultation_scheduling_links set used_at = now() where id = v_link.id;

  insert into consultation_status_events (consultation_id, previous_status, new_status, reason)
  values (v_row.id, 'requested', 'scheduled', '고객 셀프 스케줄링(컨설턴트 전용 링크)');

  return v_row;
end;
$$;

comment on function public.redeem_consultation_scheduling_link(text, timestamptz) is
  '스펙 §Scheduling after Assignment 5단계 — 고객이 슬롯을 고르면 원자적으로 starts_at/ends_at을 정하고 scheduled로 전환한다. Calendar/Meet 생성은 애플리케이션 레이어(호출 직후)에서 한다.';

grant execute on function public.redeem_consultation_scheduling_link(text, timestamptz) to anon, authenticated;
