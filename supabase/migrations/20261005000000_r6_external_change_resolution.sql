-- R6 11/N — Google 직접 변경 두 확인 경로("ALTON 시간 유지"/"Google 시간 반영") 실제 연결.
--
-- "Google 시간 반영"은 ALTON DB를 그 새 시간으로 업데이트하기 전에 반드시 재검증해야
-- 한다(가용성·버퍼·중복예약·수업권 hold가 여전히 유효한지) — 제품 오너 확정 정책.
-- "ALTON 시간 유지"는 재검증이 필요 없다(ALTON 시간은 애초에 confirm_lesson_booking()
-- 통과 시점에 이미 검증됐음) — 대신 Google 이벤트를 ALTON 기준으로 복원하는 것은
-- 앱 레이어(lib/google-calendar.ts의 patchCalendarEventTime)가 담당하고, 이 함수는
-- 감사 이력만 남긴다.

create table reservation_reschedules (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations (id),
  source text not null check (source in ('google_external_change_accepted', 'google_external_change_restored')),
  previous_starts_at timestamptz not null,
  previous_ends_at timestamptz not null,
  new_starts_at timestamptz not null,
  new_ends_at timestamptz not null,
  actor_profile_id uuid references profiles (id),
  reason text,
  created_at timestamptz not null default now()
);
create index on reservation_reschedules (reservation_id);

comment on table reservation_reschedules is
  'R6 11/N: Google 직접 변경 확인 처리(수락/복원)의 감사 이력. append-only — 예약을
  덮어쓰지 않고 별도로 기록한다(reservation_cancellations와 동일한 원칙).';

alter table reservation_reschedules enable row level security;
create policy "예약 당사자/관리자 조회" on reservation_reschedules for select
  using (
    exists (
      select 1 from reservations r
      where r.id = reservation_id
        and (
          r.owner_profile_id = auth.uid()
          or exists (
            select 1 from subject_enrollments se where se.id = r.subject_enrollment_id
              and (se.child_id = auth.uid() or is_guardian_of(se.child_id) or is_household_guardian_of(se.child_id))
          )
          or is_admin()
        )
    )
  );
revoke all on reservation_reschedules from public, anon, authenticated;
grant select on reservation_reschedules to authenticated;

-- "Google 시간 반영" — DB를 새 시간으로 업데이트하기 전 재검증(가용성·버퍼·수업권).
-- 중복예약은 reservations_no_overlap exclusion 제약이 UPDATE 시점에 자동으로 막는다.
create or replace function public.reschedule_reservation_to_google_time(
  p_reservation_id uuid,
  p_new_starts_at timestamptz,
  p_new_ends_at timestamptz,
  p_admin_id uuid,
  p_reason text
) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_reservation reservations%rowtype;
  v_hold_grant_expires_at timestamptz;
begin
  select * into v_reservation from reservations where id = p_reservation_id for update;
  if v_reservation.id is null then
    raise exception '예약을 찾을 수 없습니다.';
  end if;
  if v_reservation.status <> 'confirmed' then
    raise exception '확정된 예약만 시간을 재조정할 수 있습니다(현재 상태: %).', v_reservation.status;
  end if;

  if not is_teacher_slot_open(v_reservation.owner_profile_id, p_new_starts_at, p_new_ends_at) then
    raise exception 'teacher_slot_not_open' using errcode = 'P0001';
  end if;
  if violates_teacher_buffer(v_reservation.owner_profile_id, p_new_starts_at, p_new_ends_at, p_reservation_id) then
    raise exception 'teacher_buffer_violation' using errcode = 'P0001';
  end if;

  -- 이 예약의 hold가 걸린 grant가 새 시작 시각에도 여전히 유효한지(만료 전인지) 확인.
  select eg.expires_at into v_hold_grant_expires_at
  from entitlement_ledger el
  join entitlement_grants eg on eg.id = el.grant_id
  where el.reservation_id = p_reservation_id and el.event_type = 'hold'
  order by el.created_at desc
  limit 1;
  if v_hold_grant_expires_at is not null and v_hold_grant_expires_at <= p_new_starts_at then
    raise exception 'entitlement_grant_expired_before_new_time' using errcode = 'P0001';
  end if;

  insert into reservation_reschedules (
    reservation_id, source, previous_starts_at, previous_ends_at, new_starts_at, new_ends_at, actor_profile_id, reason
  ) values (
    p_reservation_id, 'google_external_change_accepted',
    v_reservation.starts_at, v_reservation.ends_at, p_new_starts_at, p_new_ends_at, p_admin_id, p_reason
  );

  -- reservations_no_overlap exclusion 제약이 여기서 자동으로 다른 예약과의 겹침을 막는다
  -- (통과 못 하면 이 UPDATE 자체가 예외를 던지고 트랜잭션이 롤백된다).
  update reservations set starts_at = p_new_starts_at, ends_at = p_new_ends_at where id = p_reservation_id;
  update sessions set scheduled_duration_minutes = extract(epoch from (p_new_ends_at - p_new_starts_at))::int / 60
    where reservation_id = p_reservation_id;
end;
$$;

revoke execute on function public.reschedule_reservation_to_google_time(uuid, timestamptz, timestamptz, uuid, text) from public, anon, authenticated;
grant execute on function public.reschedule_reservation_to_google_time(uuid, timestamptz, timestamptz, uuid, text) to service_role;

-- "ALTON 시간 유지" — DB는 바꾸지 않고 감사 이력만 남긴다(Google 이벤트 복원 자체는
-- 앱 레이어의 patchCalendarEventTime()이 담당, 이 함수는 그 성공 이후 호출된다).
create or replace function public.record_reservation_restored_to_alton_time(
  p_reservation_id uuid,
  p_admin_id uuid,
  p_reason text
) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_reservation reservations%rowtype;
begin
  select * into v_reservation from reservations where id = p_reservation_id;
  if v_reservation.id is null then
    raise exception '예약을 찾을 수 없습니다.';
  end if;

  insert into reservation_reschedules (
    reservation_id, source, previous_starts_at, previous_ends_at, new_starts_at, new_ends_at, actor_profile_id, reason
  ) values (
    p_reservation_id, 'google_external_change_restored',
    v_reservation.starts_at, v_reservation.ends_at, v_reservation.starts_at, v_reservation.ends_at, p_admin_id, p_reason
  );
end;
$$;

revoke execute on function public.record_reservation_restored_to_alton_time(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.record_reservation_restored_to_alton_time(uuid, uuid, text) to service_role;
