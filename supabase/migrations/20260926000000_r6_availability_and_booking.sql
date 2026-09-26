-- R6 1/N — 선생님 반복 가능 시간·날짜별 예외·버퍼 + 예약 확정 함수(수업권 hold 포함)
--
-- 설계 원칙:
-- - 시간대/DST는 Postgres `timestamptz AT TIME ZONE <iana 이름>`에 위임한다(tzdata 내장,
--   DST 전환을 자동 반영) — 별도 JS 시간대 라이브러리나 수동 오프셋 계산을 하지 않는다.
-- - 이중예약 하드 방지는 이미 R1의 `reservations_no_overlap` gist exclusion이 담당한다
--   (owner_profile_id 기준 holding/confirmed 겹침 차단). 이 마이그레이션은 그 위에
--   (1) 선생님이 애초에 그 시간에 열려 있는지(반복 가능시간·예외), (2) 수업 전후
--   15분 버퍼, (3) 24시간~8주 예약 가능 범위를 추가로 강제한다.
-- - `confirm_lesson_booking()`은 reservation 생성 + entitlement hold + sessions_v3 생성을
--   단일 트랜잭션(단일 SECURITY DEFINER 함수 호출)으로 묶어 어중간한 상태를 방지한다.
--   Google Calendar/Meet 생성은 별도 마이그레이션(2/N)에서 이 함수 이후 단계로 붙는다.

create table teacher_availability_rules (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles (id),
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0=일요일 ~ 6=토요일 (extract(dow) 기준)
  start_time_local time not null,
  end_time_local time not null,
  timezone text not null, -- IANA 이름, 예: 'America/Los_Angeles'
  effective_from date not null default current_date,
  effective_until date,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  check (end_time_local > start_time_local),
  check (effective_until is null or effective_until >= effective_from)
);
create index on teacher_availability_rules (teacher_id);

create table teacher_availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles (id),
  exception_date date not null,
  kind text not null check (kind in ('blocked', 'available')),
  -- start/end 둘 다 null이면 해당 날짜 종일 적용
  start_time_local time,
  end_time_local time,
  timezone text not null,
  reason text,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  check (
    (start_time_local is null and end_time_local is null)
    or (start_time_local is not null and end_time_local is not null and end_time_local > start_time_local)
  )
);
create index on teacher_availability_exceptions (teacher_id, exception_date);

alter table teacher_availability_rules enable row level security;
alter table teacher_availability_exceptions enable row level security;

create policy "본인 또는 관리자 조회" on teacher_availability_rules for select
  using (teacher_id = auth.uid() or is_admin() or current_user_has_capability('manage_bookings'));
create policy "본인 또는 관리자 쓰기" on teacher_availability_rules for all
  using (teacher_id = auth.uid() or is_admin() or current_user_has_capability('manage_bookings'))
  with check (teacher_id = auth.uid() or is_admin() or current_user_has_capability('manage_bookings'));

create policy "본인 또는 관리자 조회" on teacher_availability_exceptions for select
  using (teacher_id = auth.uid() or is_admin() or current_user_has_capability('manage_bookings'));
create policy "본인 또는 관리자 쓰기" on teacher_availability_exceptions for all
  using (teacher_id = auth.uid() or is_admin() or current_user_has_capability('manage_bookings'))
  with check (teacher_id = auth.uid() or is_admin() or current_user_has_capability('manage_bookings'));

-- 주 1회 반복예약(최대 8회) 묶음 — 각 회차는 독립 reservation/session/hold로 관리되고
-- 이 테이블은 "같은 묶음"이라는 사실과 취소 시 나머지 회차 처리 판단을 위한 메타데이터만 갖는다.
create table booking_series (
  id uuid primary key default gen_random_uuid(),
  subject_enrollment_id uuid not null references subject_enrollments (id),
  teacher_id uuid not null references profiles (id),
  lesson_type_id uuid not null references lesson_types (id),
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time_local time not null,
  timezone text not null,
  occurrences_planned smallint not null check (occurrences_planned between 1 and 8),
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

alter table booking_series enable row level security;
create policy "본인 선생님 또는 관리자 조회" on booking_series for select
  using (teacher_id = auth.uid() or is_admin() or current_user_has_capability('manage_bookings'));
create policy "service_role만 쓰기" on booking_series for insert
  with check (false);
create policy "관리자 갱신" on booking_series for update
  using (is_admin() or current_user_has_capability('manage_bookings'))
  with check (is_admin() or current_user_has_capability('manage_bookings'));

alter table reservations
  add column booking_series_id uuid references booking_series (id),
  add column series_occurrence_index smallint,
  add column google_meet_link text,
  add column google_sync_status text not null default 'pending'
    check (google_sync_status in ('pending', 'synced', 'failed', 'reconciliation_needed')),
  add column google_sync_error text,
  add column google_sync_attempted_at timestamptz;
create index on reservations (booking_series_id);

alter table sessions_v3
  add column smart_notes_status text not null default 'not_applicable'
    check (smart_notes_status in ('not_applicable', 'pending', 'disabled_by_guardian', 'active', 'completed', 'failed')),
  add column smart_notes_meet_conference_record text,
  add column late_start_minutes int,
  add column makeup_minutes_generated int not null default 0;

comment on table teacher_availability_rules is 'R6: 선생님 반복 가능 시간(요일·시간대·유효기간)';
comment on table teacher_availability_exceptions is 'R6: 날짜별 예외(휴무 blocked 또는 임시 추가 available)';
comment on table booking_series is 'R6: 주 1회 최대 8회 반복예약 묶음 메타데이터 — 실제 예약/세션/hold는 회차별로 독립';

-- 120분 수업 + 15분 버퍼가 기본이지만 lesson_types.duration_minutes가 실제 소스이므로
-- 버퍼만 상수로 둔다.
create or replace function public.booking_buffer_minutes() returns int
  language sql immutable as $$ select 15 $$;

-- 24시간 이후 ~ 8주 이내만 예약 가능
create or replace function public.is_within_booking_window(p_starts_at timestamptz) returns boolean
  language sql stable as $$
  select p_starts_at >= now() + interval '24 hours' and p_starts_at <= now() + interval '8 weeks';
$$;

-- 선생님이 해당 시간에 실제로 열려 있는지: 예외(blocked 전체 우선, available은 규칙에 없는 시간도 허용)
-- + 반복 가능 시간 규칙을 함께 판정. AT TIME ZONE이 DST를 반영한 로컬 요일/시각을 계산한다.
create or replace function public.is_teacher_slot_open(
  p_teacher_id uuid, p_starts_at timestamptz, p_ends_at timestamptz
) returns boolean
  language plpgsql stable as $$
declare
  v_blocked boolean;
  v_available_exception boolean;
  v_rule_covers boolean;
begin
  -- 자정을 넘기는 슬롯(120분 수업은 실무상 거의 없음)은 규칙 판정에서 "같은 날짜" 조건으로
  -- 보수적으로 거부한다(아래 v_rule_covers 계산 참고).
  select coalesce(bool_or(
    e.kind = 'blocked' and (
      (e.start_time_local is null) -- 종일 차단
      or (p_starts_at at time zone e.timezone)::time < e.end_time_local
         and (p_ends_at at time zone e.timezone)::time > e.start_time_local
    )
  ), false)
  into v_blocked
  from teacher_availability_exceptions e
  where e.teacher_id = p_teacher_id
    and e.exception_date = (p_starts_at at time zone e.timezone)::date;

  if v_blocked then
    return false;
  end if;

  select coalesce(bool_or(
    e.kind = 'available' and (
      e.start_time_local is null
      or ((p_starts_at at time zone e.timezone)::time >= e.start_time_local
          and (p_ends_at at time zone e.timezone)::time <= e.end_time_local)
    )
  ), false)
  into v_available_exception
  from teacher_availability_exceptions e
  where e.teacher_id = p_teacher_id
    and e.exception_date = (p_starts_at at time zone e.timezone)::date;

  if v_available_exception then
    return true;
  end if;

  select exists (
    select 1 from teacher_availability_rules r
    where r.teacher_id = p_teacher_id
      and r.day_of_week = extract(dow from (p_starts_at at time zone r.timezone))
      and (p_starts_at at time zone r.timezone)::date >= r.effective_from
      and (r.effective_until is null or (p_starts_at at time zone r.timezone)::date <= r.effective_until)
      and (p_starts_at at time zone r.timezone)::time >= r.start_time_local
      and (p_ends_at at time zone r.timezone)::time <= r.end_time_local
      -- 자정을 넘기는 수업은 시작일 요일 규칙만으로 판단하지 않도록 같은 날짜인지 확인
      and (p_starts_at at time zone r.timezone)::date = (p_ends_at at time zone r.timezone)::date
  )
  into v_rule_covers;

  return coalesce(v_rule_covers, false);
end;
$$;

-- 버퍼(전후 15분)를 포함해 이 선생님의 기존 holding/confirmed 예약과 겹치는지.
-- 정확한 겹침 자체는 reservations_no_overlap이 DB 레벨에서 이미 막으므로, 이 함수는
-- "버퍼까지 포함하면 너무 붙어있는" 케이스만 추가로 걸러낸다.
create or replace function public.violates_teacher_buffer(
  p_teacher_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_exclude_reservation_id uuid default null
) returns boolean
  language sql stable as $$
  select exists (
    select 1 from reservations r
    where r.owner_profile_id = p_teacher_id
      and r.status in ('holding', 'confirmed')
      and (p_exclude_reservation_id is null or r.id <> p_exclude_reservation_id)
      and tstzrange(r.starts_at - (booking_buffer_minutes() || ' minutes')::interval,
                    r.ends_at + (booking_buffer_minutes() || ' minutes')::interval)
          && tstzrange(p_starts_at, p_ends_at)
  );
$$;

-- 예약 확정: reservation(confirmed) + sessions_v3 + entitlement hold를 한 함수 안에서 처리.
-- 실패 시 함수 전체가 롤백되므로 어중간한 상태가 남지 않는다. Google Calendar/Meet 생성은
-- 이 함수가 끝난 뒤(reservation이 이미 확정된 뒤) 별도 단계에서 붙이고 실패해도 예약 자체는
-- 유효하게 유지한 채 재시도 큐로 넘긴다(2/N 마이그레이션에서 google_sync_status로 추적).
create or replace function public.confirm_lesson_booking(
  p_child_id uuid,
  p_subject_enrollment_id uuid,
  p_teacher_id uuid,
  p_lesson_type_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_idempotency_key text,
  p_booking_series_id uuid default null,
  p_series_occurrence_index smallint default null
) returns table (reservation_id uuid, session_id uuid)
  language plpgsql security definer set search_path = public as $$
declare
  v_reservation_id uuid;
  v_session_id uuid;
  v_grant_id uuid;
begin
  if not is_within_booking_window(p_starts_at) then
    raise exception 'booking_window_violation' using errcode = 'P0001';
  end if;
  if not is_teacher_slot_open(p_teacher_id, p_starts_at, p_ends_at) then
    raise exception 'teacher_slot_not_open' using errcode = 'P0001';
  end if;
  if violates_teacher_buffer(p_teacher_id, p_starts_at, p_ends_at) then
    raise exception 'teacher_buffer_violation' using errcode = 'P0001';
  end if;

  insert into reservations (
    kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status,
    idempotency_key, booking_series_id, series_occurrence_index
  ) values (
    'lesson', p_subject_enrollment_id, p_teacher_id, p_starts_at, p_ends_at, 'confirmed',
    p_idempotency_key, p_booking_series_id, p_series_occurrence_index
  )
  returning id into v_reservation_id;

  insert into sessions_v3 (
    reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes
  ) values (
    v_reservation_id, p_subject_enrollment_id, p_teacher_id, p_lesson_type_id,
    extract(epoch from (p_ends_at - p_starts_at))::int / 60
  )
  returning id into v_session_id;

  v_grant_id := hold_entitlement(p_child_id, v_reservation_id, p_starts_at, 1);

  return query select v_reservation_id, v_session_id;
end;
$$;

revoke execute on function public.confirm_lesson_booking(
  uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, uuid, smallint
) from public, anon, authenticated;
grant execute on function public.confirm_lesson_booking(
  uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, uuid, smallint
) to service_role;
