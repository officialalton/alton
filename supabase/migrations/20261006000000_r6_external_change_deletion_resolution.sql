-- R6 12/N(보정) — Google 이벤트 직접 삭제 감지 시 "무시"만 가능한 상태를 없애고, 관리자가
-- 다음 둘 중 하나를 명시적으로 선택하게 한다(제품 오너 확정 정책):
--   1) "ALTON 일정 유지" — 예약·세션·수업권 hold는 그대로 두고 담당 선생님 소유의 Calendar
--      이벤트+Meet을 다시 생성한다.
--   2) "예약 취소" — 기존 정식 취소 절차(cancel_lesson_booking)를 실행해 예약·세션·수업권·
--      알림·Google 상태를 함께 정리한다.
-- 자동 취소·자동 재생성은 금지 — 관리자가 선택하기 전까지는 계속 "관리자 확인 필요"
-- 상태로 남는다.

alter table reservation_reschedules drop constraint reservation_reschedules_source_check;
alter table reservation_reschedules add constraint reservation_reschedules_source_check
  check (source in (
    'google_external_change_accepted',
    'google_external_change_restored',
    'google_event_deleted_recreated'
  ));

comment on column reservation_reschedules.source is
  'google_external_change_accepted: "Google 시간 반영". google_external_change_restored: '
  '"ALTON 시간 유지"(시간 변경 감지 케이스). google_event_deleted_recreated: Google에서 '
  '이벤트가 삭제된 뒤 "ALTON 일정 유지"를 선택해 Calendar 이벤트+Meet을 재생성한 경우.';

create or replace function public.resolve_external_calendar_change(
  p_reservation_id uuid,
  p_admin_id uuid,
  p_resolution text,
  p_reason text
) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  if p_resolution not in (
    'accepted_google_time', 'kept_alton_time', 'confirmed_cancelled', 'dismissed', 'recreated_after_deletion'
  ) then
    raise exception '알 수 없는 처리 방식입니다: %', p_resolution;
  end if;

  select external_change_status into v_status from reservations where id = p_reservation_id for update;
  if v_status is null then
    raise exception '예약을 찾을 수 없습니다.';
  end if;
  if v_status = 'none' then
    raise exception '이 예약에는 처리할 외부 변경이 없습니다.';
  end if;
  -- 삭제 감지 상태에서는 "무시"를 허용하지 않는다 — 반드시 재생성 또는 취소를 선택해야 한다.
  if v_status = 'deleted' and p_resolution = 'dismissed' then
    raise exception 'Google 이벤트가 삭제된 예약은 무시할 수 없습니다 — "ALTON 일정 유지"(재생성) 또는 "예약 취소" 중 선택하세요.';
  end if;

  update reservations
  set external_change_status = 'none',
      external_change_confirmed_by = p_admin_id,
      external_change_confirmed_at = now(),
      external_change_detail = coalesce(external_change_detail, '{}'::jsonb)
        || jsonb_build_object('resolution', p_resolution, 'reason', p_reason, 'resolved_at', now())
  where id = p_reservation_id;
end;
$$;

revoke execute on function public.resolve_external_calendar_change(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.resolve_external_calendar_change(uuid, uuid, text, text) to service_role;

-- "ALTON 일정 유지"(재생성) 감사 기록 — 실제 Calendar 이벤트+Meet 재생성 자체는 앱 레이어
-- (lib/booking/external-change-resolution.ts가 reservations.google_sync_status를 'pending'으로
-- 되돌린 뒤 syncOneReservationCalendarEvent()를 재호출)가 담당하고, 이 함수는 그 성공 이후
-- 호출되는 감사 기록 단계다(record_reservation_restored_to_alton_time과 동일한 패턴).
create or replace function public.record_reservation_recreated_after_deletion(
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
    p_reservation_id, 'google_event_deleted_recreated',
    v_reservation.starts_at, v_reservation.ends_at, v_reservation.starts_at, v_reservation.ends_at, p_admin_id, p_reason
  );
end;
$$;

revoke execute on function public.record_reservation_recreated_after_deletion(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.record_reservation_recreated_after_deletion(uuid, uuid, text) to service_role;
