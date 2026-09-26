-- R11(문의·면담) — 실구현. 이전 라운드에서는 "문서만 등록, 구현 금지"였으나
-- 제품 오너가 실구현으로 정정했다. 상담(consultations)과는 완전히 분리된
-- 새 테이블·새 RPC만 추가한다(가산적, 기존 상담/체험 파이프라인 무영향).
--
-- 용어: "면담"(상담 아님). 기존 자녀의 면담은 신규 자녀 상담(consultations,
-- source='guardian_portal')과 절대 같은 테이블에 섞지 않는다 — 그래서 파이프라인
-- 카드(가입·체험·정규 전환)가 자동으로 생성되지 않는다(별도 테이블이므로 자연히
-- 그렇게 됨).
--
-- 구성:
--  1. household_messages — 보호자<->관리자 household 메신저(문의).
--  2. meeting_availability_rules/exceptions — 면담 전용 가용시간(상담과 슬롯
--     데이터 분리, consult_availability_rules/exceptions와 동일 패턴 재사용).
--  3. list_open_meeting_slots() — list_open_consult_slots()와 동일 계산 로직,
--     면담 전용 테이블만 바라봄(수업 예약/상담 가용시간과 절대 미혼용).
--  4. meeting_requests — 문의에서 전환되는 면담 일정 요청. 상담과 데이터 완전
--     분리(FK 없음).

-- =========================================================================
-- 1. household_messages
-- =========================================================================
create table household_messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id),
  sender_id uuid not null references profiles (id),
  sender_role text not null check (sender_role in ('guardian', 'admin')),
  body text not null check (length(trim(body)) > 0),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);
create index on household_messages (household_id, created_at);

comment on table household_messages is
  'R11: 보호자<->관리자 household 단위 문의 메신저. 비동기 메시지만으로 해결되면 status를 resolved로 닫을 수 있다(면담 생성 강제 아님).';

alter table household_messages enable row level security;
create policy "관리자 전체 조회" on household_messages for select using (is_admin());
create policy "보호자 본인 household 조회" on household_messages for select using (
  exists (
    select 1 from household_members hm
    where hm.household_id = household_messages.household_id
      and hm.profile_id = auth.uid()
      and hm.role = 'guardian'
  )
);
create policy "관리자 작성" on household_messages for insert with check (
  is_admin() and sender_role = 'admin' and sender_id = auth.uid()
);
create policy "보호자 본인 household 작성" on household_messages for insert with check (
  sender_role = 'guardian' and sender_id = auth.uid() and exists (
    select 1 from household_members hm
    where hm.household_id = household_messages.household_id
      and hm.profile_id = auth.uid()
      and hm.role = 'guardian'
  )
);
create policy "관리자만 상태 변경" on household_messages for update using (is_admin()) with check (is_admin());

-- =========================================================================
-- 2. meeting_availability_rules / meeting_availability_exceptions —
--    consult_availability_rules/exceptions와 동일 구조, 면담 전용 별도 테이블.
-- =========================================================================
create extension if not exists btree_gist;

create table meeting_availability_rules (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text not null default 'America/Los_Angeles',
  active boolean not null default true,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index on meeting_availability_rules (weekday) where active;
alter table meeting_availability_rules add constraint meeting_availability_rules_no_overlap
  exclude using gist (
    weekday with =,
    tsrange('2000-01-01'::date + start_time, '2000-01-01'::date + end_time) with &&
  ) where (active);

create table meeting_availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  exception_date date not null,
  is_closed boolean not null default true,
  start_time time,
  end_time time,
  reason text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  check (is_closed or (start_time is not null and end_time is not null and end_time > start_time))
);
create unique index on meeting_availability_exceptions (exception_date, coalesce(start_time, '00:00'::time));

comment on table meeting_availability_rules is
  'R11: 면담 전용 반복 주간 가용시간(상담 consult_availability_rules와 데이터 분리, 패턴만 동일).';
comment on table meeting_availability_exceptions is
  'R11: 면담 전용 날짜별 예외(휴무/임시 오픈).';

alter table meeting_availability_rules enable row level security;
alter table meeting_availability_exceptions enable row level security;
create policy "전체 조회" on meeting_availability_rules for select using (true);
create policy "관리자 쓰기" on meeting_availability_rules for all using (is_admin()) with check (is_admin());
create policy "전체 조회" on meeting_availability_exceptions for select using (true);
create policy "관리자 쓰기" on meeting_availability_exceptions for all using (is_admin()) with check (is_admin());

-- =========================================================================
-- 3. meeting_requests — 문의에서 전환되는 면담 일정 요청. consultations와
--    FK 관계 없음(완전 분리) — 기존 자녀 면담이 가입·체험·정규 전환 파이프라인
--    카드를 생성하지 않는다.
-- =========================================================================
create table meeting_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id),
  child_id uuid references profiles (id),
  subject text,
  requested_by uuid not null references profiles (id),
  status text not null default 'requested' check (status in ('requested', 'scheduled', 'completed', 'cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  google_meet_link text,
  source_message_id uuid references household_messages (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on meeting_requests (household_id, created_at);
create index on meeting_requests (status);

comment on table meeting_requests is
  'R11: 문의(household_messages)에서 전환되는 면담 일정 요청. consultations와 완전 분리된 별도 테이블이라 가입·체험·정규 전환 파이프라인 카드를 생성하지 않는다.';

alter table meeting_requests enable row level security;
create policy "관리자 전체 조회" on meeting_requests for select using (is_admin());
create policy "보호자 본인 household 조회" on meeting_requests for select using (
  exists (
    select 1 from household_members hm
    where hm.household_id = meeting_requests.household_id
      and hm.profile_id = auth.uid()
      and hm.role = 'guardian'
  )
);
create policy "보호자 본인 household 신청" on meeting_requests for insert with check (
  requested_by = auth.uid() and exists (
    select 1 from household_members hm
    where hm.household_id = meeting_requests.household_id
      and hm.profile_id = auth.uid()
      and hm.role = 'guardian'
  )
);
create policy "관리자만 상태·일정 변경" on meeting_requests for update using (is_admin()) with check (is_admin());

-- =========================================================================
-- 4. list_open_meeting_slots — list_open_consult_slots()와 동일 계산 로직,
--    면담 전용 가용시간/점유만 본다(상담·수업 예약과 절대 미혼용).
-- =========================================================================
create or replace function public.list_open_meeting_slots(
  p_from timestamptz,
  p_to timestamptz
)
returns table (slot_starts_at timestamptz)
language sql stable
security definer
set search_path = public
as $$
  with weekday_rules as (
    select r.weekday, r.start_time, r.end_time
    from meeting_availability_rules r
    where r.active
  ),
  days as (
    select generate_series(date_trunc('day', p_from), date_trunc('day', p_to), interval '1 day')::date as d
  ),
  candidate_slots as (
    select
      ((d.d + wr.start_time)::timestamp at time zone 'America/Los_Angeles' + (n * interval '60 minutes')) as slot_start,
      ((d.d + wr.start_time)::timestamp at time zone 'America/Los_Angeles' + ((n + 1) * interval '60 minutes')) as slot_end
    from days d
    join weekday_rules wr on wr.weekday = extract(dow from d.d)::smallint
    cross join lateral generate_series(0, (extract(epoch from (wr.end_time - wr.start_time)) / 3600)::int - 1) as n
    where not exists (
      select 1 from meeting_availability_exceptions e
      where e.exception_date = d.d and e.is_closed
    )
  )
  select distinct cs.slot_start
  from candidate_slots cs
  where cs.slot_start >= p_from
    and cs.slot_start < p_to
    and cs.slot_start > now()
    and not exists (
      select 1 from meeting_requests m
      where m.starts_at is not null
        and m.status in ('requested', 'scheduled')
        and tstzrange(m.starts_at, m.ends_at) && tstzrange(cs.slot_start, cs.slot_end)
    )
  order by cs.slot_start;
$$;

comment on function public.list_open_meeting_slots(timestamptz, timestamptz) is
  'R11: 면담 전용 반복 가용시간에서 휴무 예외를 제거하고, 이미 점유된(requested/scheduled) 면담 슬롯을 뺀 열린 60분 슬롯 후보를 반환. 상담(list_open_consult_slots)/수업 예약과 완전히 분리된 별도 원본.';

grant execute on function public.list_open_meeting_slots(timestamptz, timestamptz) to anon, authenticated;
