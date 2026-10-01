-- 2026-09-16(제품 오너 실사용 보고) — reschedule_reservation_to_google_time()가 reservations.status
-- (`'confirmed'`인지)만 확인하고, 그 예약에 딸린 sessions.final_status가 이미 종결
-- (completed/no_show/cancelled 등)됐는지는 확인하지 않았다. reservations.status는 세션이 끝나도
-- 계속 'confirmed'로 남기 때문에, 이미 끝난 수업의 예약을 미래 시각으로 재조정할 수 있는
-- 길이 열려 있었다 — 그 경우 이미 실제로 진행된 Calendar 이벤트/Meet 룸(과 거기 붙은 실제
-- Smart Notes)이 "아직 시작 안 한" 미래 수업인 것처럼 재사용된다(실사용 중 발견). 이미 종결된
-- 세션의 예약은 이 경로로 재조정할 수 없게 막는다.
set row_security = off;

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
  v_session_final_status v3_session_final_status;
begin
  select * into v_reservation from reservations where id = p_reservation_id for update;
  if v_reservation.id is null then
    raise exception '예약을 찾을 수 없습니다.';
  end if;
  if v_reservation.status <> 'confirmed' then
    raise exception '확정된 예약만 시간을 재조정할 수 있습니다(현재 상태: %).', v_reservation.status;
  end if;

  select final_status into v_session_final_status from sessions where reservation_id = p_reservation_id;
  if v_session_final_status is not null and v_session_final_status <> 'scheduled' and v_session_final_status <> 'live' then
    raise exception '이미 종결된 수업(상태: %)의 예약은 시간을 재조정할 수 없습니다.', v_session_final_status;
  end if;

  if not is_teacher_slot_open(v_reservation.owner_profile_id, p_new_starts_at, p_new_ends_at) then
    raise exception 'teacher_slot_not_open' using errcode = 'P0001';
  end if;
  if violates_teacher_buffer(v_reservation.owner_profile_id, p_new_starts_at, p_new_ends_at, p_reservation_id) then
    raise exception 'teacher_buffer_violation' using errcode = 'P0001';
  end if;

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

  update reservations set starts_at = p_new_starts_at, ends_at = p_new_ends_at where id = p_reservation_id;
  update sessions set scheduled_duration_minutes = extract(epoch from (p_new_ends_at - p_new_starts_at))::int / 60
    where reservation_id = p_reservation_id;
end;
$$;
