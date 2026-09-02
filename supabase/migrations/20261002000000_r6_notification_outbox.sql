-- R6 8/N — 24시간·2시간 전 리마인드 + 예약/취소 직후 알림의 스케줄·상태·outbox 적재.
-- 그린필드(선례 없음) — 기존 `notifications`(R0, in-app 표시 전용, 스케줄 개념 없음)와는
-- 다른 테이블이다. 실제 이메일·메시지 발송 인프라는 여전히 미구현(R4 정식 오픈 전 blocker로
-- 이미 등록됨, `docs/CURRENT.md` 참고) — 이 마이그레이션은 "발송 대기" 상태까지만 만들고
-- 실제 외부 발송은 절대 하지 않는다(스펙 원문).

create table booking_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations (id),
  recipient_id uuid not null references profiles (id),
  notification_type text not null check (notification_type in (
    'booking_confirmed', 'booking_cancelled', 'reminder_24h', 'reminder_2h'
  )),
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'cancelled')),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (reservation_id, recipient_id, notification_type)
);
create index on booking_notification_outbox (status, scheduled_for);
create index on booking_notification_outbox (recipient_id);

comment on table booking_notification_outbox is
  'R6: 예약 확정/취소 직후 알림 + 24h/2h 리마인드의 스케줄·상태 큐. 실제 이메일/메시지 발송은 '
  '구현하지 않음(R4에서 이미 등록된 정식 오픈 전 blocker) — status는 이번 R에서 pending/cancelled까지만 '
  '실제로 쓰이고, sent 전이는 발송 인프라가 붙는 후속 R의 몫이다.';

alter table booking_notification_outbox enable row level security;
create policy "수신자 본인/관리자 조회" on booking_notification_outbox for select
  using (recipient_id = auth.uid() or is_admin() or current_user_has_capability('예약관리권한'));
-- 쓰기는 client에서 직접 하지 않는다 — 아래 두 함수(service_role 전용 confirm/cancel
-- lesson booking이 호출)만 insert/update한다.

-- 예약 하나의 확정 시점에 수신자(자녀 본인 + 그 household guardian 전원)별 알림을
-- 스케줄한다. 이미 지난 리마인드(예: 관리자 24시간 이내 override 예약의 24시간 전 리마인드)는
-- 애초에 만들지 않는다 — 과거 시각으로 "발송 대기" 행을 남겨 혼란을 주지 않기 위함.
create or replace function public.schedule_reservation_notifications(p_reservation_id uuid)
returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_reservation reservations%rowtype;
  v_child_id uuid;
  v_recipient uuid;
begin
  select * into v_reservation from reservations where id = p_reservation_id;
  if v_reservation.id is null then
    raise exception '예약을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;

  select se.child_id into v_child_id from subject_enrollments se where se.id = v_reservation.subject_enrollment_id;

  for v_recipient in
    select v_child_id
    union
    select hm.profile_id from household_members hm
      join household_members child on child.household_id = hm.household_id and child.role = 'child' and child.profile_id = v_child_id
    where hm.role = 'guardian'
  loop
    insert into booking_notification_outbox (reservation_id, recipient_id, notification_type, scheduled_for, payload)
    values (p_reservation_id, v_recipient, 'booking_confirmed', now(), jsonb_build_object('starts_at', v_reservation.starts_at))
    on conflict (reservation_id, recipient_id, notification_type) do nothing;

    if v_reservation.starts_at - interval '24 hours' > now() then
      insert into booking_notification_outbox (reservation_id, recipient_id, notification_type, scheduled_for, payload)
      values (p_reservation_id, v_recipient, 'reminder_24h', v_reservation.starts_at - interval '24 hours', jsonb_build_object('starts_at', v_reservation.starts_at))
      on conflict (reservation_id, recipient_id, notification_type) do nothing;
    end if;

    if v_reservation.starts_at - interval '2 hours' > now() then
      insert into booking_notification_outbox (reservation_id, recipient_id, notification_type, scheduled_for, payload)
      values (p_reservation_id, v_recipient, 'reminder_2h', v_reservation.starts_at - interval '2 hours', jsonb_build_object('starts_at', v_reservation.starts_at))
      on conflict (reservation_id, recipient_id, notification_type) do nothing;
    end if;
  end loop;

  -- 인앱 표시(스펙 "인앱 표시" 요구) — 기존 R0 notifications 테이블 그대로 재사용.
  insert into notifications (recipient_id, text, link_view)
  select rec.notify_id, '정규수업이 예약되었습니다.', 'booking'
  from (
    select v_child_id as notify_id
    union
    select hm.profile_id from household_members hm
      join household_members child on child.household_id = hm.household_id and child.role = 'child' and child.profile_id = v_child_id
    where hm.role = 'guardian'
  ) rec;
end;
$$;

-- 취소 시 아직 발송되지 않은(pending) 미래 리마인드/확정 알림을 취소 처리하고, 취소 알림을
-- 새로 스케줄한다.
create or replace function public.cancel_reservation_notifications(p_reservation_id uuid)
returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_reservation reservations%rowtype;
  v_child_id uuid;
  v_recipient uuid;
begin
  select * into v_reservation from reservations where id = p_reservation_id;
  select se.child_id into v_child_id from subject_enrollments se where se.id = v_reservation.subject_enrollment_id;

  update booking_notification_outbox
  set status = 'cancelled'
  where reservation_id = p_reservation_id and status = 'pending';

  for v_recipient in
    select v_child_id
    union
    select hm.profile_id from household_members hm
      join household_members child on child.household_id = hm.household_id and child.role = 'child' and child.profile_id = v_child_id
    where hm.role = 'guardian'
  loop
    insert into booking_notification_outbox (reservation_id, recipient_id, notification_type, scheduled_for, status, payload)
    values (p_reservation_id, v_recipient, 'booking_cancelled', now(), 'pending', jsonb_build_object('starts_at', v_reservation.starts_at))
    on conflict (reservation_id, recipient_id, notification_type)
      do update set status = 'pending', scheduled_for = now();
  end loop;

  insert into notifications (recipient_id, text, link_view)
  select rec.notify_id, '예약된 정규수업이 취소되었습니다.', 'booking'
  from (
    select v_child_id as notify_id
    union
    select hm.profile_id from household_members hm
      join household_members child on child.household_id = hm.household_id and child.role = 'child' and child.profile_id = v_child_id
    where hm.role = 'guardian'
  ) rec;
end;
$$;

-- confirm_lesson_booking()/cancel_lesson_booking() 재정의: 각각 알림 스케줄링 호출을
-- 추가한다(로직 변경은 이 한 줄씩뿐).
create or replace function public.confirm_lesson_booking(
  p_child_id uuid,
  p_subject_enrollment_id uuid,
  p_teacher_id uuid,
  p_lesson_type_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_idempotency_key text,
  p_booking_series_id uuid default null,
  p_series_occurrence_index smallint default null,
  p_admin_override boolean default false
) returns table (reservation_id uuid, session_id uuid)
  language plpgsql security definer set search_path = public as $$
declare
  v_reservation_id uuid;
  v_session_id uuid;
  v_grant_id uuid;
  v_existing record;
  v_smart_notes_status text;
begin
  select r.id as rid, s.id as sid into v_existing
  from reservations r join sessions s on s.reservation_id = r.id
  where r.idempotency_key = p_idempotency_key;
  if found then
    return query select v_existing.rid, v_existing.sid;
    return;
  end if;

  if not is_within_booking_window(p_starts_at, p_admin_override) then
    raise exception 'booking_window_violation' using errcode = 'P0001';
  end if;
  if not is_teacher_slot_open(p_teacher_id, p_starts_at, p_ends_at) then
    raise exception 'teacher_slot_not_open' using errcode = 'P0001';
  end if;
  if violates_teacher_buffer(p_teacher_id, p_starts_at, p_ends_at) then
    raise exception 'teacher_buffer_violation' using errcode = 'P0001';
  end if;

  begin
    insert into reservations (
      kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status,
      idempotency_key, booking_series_id, series_occurrence_index
    ) values (
      'lesson', p_subject_enrollment_id, p_teacher_id, p_starts_at, p_ends_at, 'confirmed',
      p_idempotency_key, p_booking_series_id, p_series_occurrence_index
    )
    returning id into v_reservation_id;
  exception when unique_violation then
    select r.id as rid, s.id as sid into v_existing
    from reservations r join sessions s on s.reservation_id = r.id
    where r.idempotency_key = p_idempotency_key;
    if found then
      return query select v_existing.rid, v_existing.sid;
      return;
    end if;
    raise;
  end;

  v_smart_notes_status := case when has_ai_notes_consent(p_child_id) then 'pending' else 'disabled_by_guardian' end;

  insert into sessions (
    reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes,
    smart_notes_status
  ) values (
    v_reservation_id, p_subject_enrollment_id, p_teacher_id, p_lesson_type_id,
    extract(epoch from (p_ends_at - p_starts_at))::int / 60,
    v_smart_notes_status
  )
  returning id into v_session_id;

  v_grant_id := hold_entitlement(p_child_id, v_reservation_id, p_starts_at, 1);

  perform schedule_reservation_notifications(v_reservation_id);

  return query select v_reservation_id, v_session_id;
end;
$$;

create or replace function public.cancel_lesson_booking(
  p_reservation_id uuid,
  p_cancelled_by_role text,
  p_cancelled_by_id uuid,
  p_reason text
) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_reservation reservations%rowtype;
  v_hours_until numeric;
  v_grant_id uuid;
  v_current_expires_at timestamptz;
  v_min_expires_at timestamptz;
  v_disposition text;
begin
  if p_cancelled_by_role not in ('student', 'teacher', 'company') then
    raise exception '알 수 없는 취소 주체입니다: %', p_cancelled_by_role using errcode = 'P0001';
  end if;

  select * into v_reservation from reservations where id = p_reservation_id for update;
  if v_reservation.id is null then
    raise exception '예약을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;
  if v_reservation.status <> 'confirmed' then
    raise exception '확정된 예약만 취소할 수 있습니다(현재 상태: %).', v_reservation.status using errcode = 'P0001';
  end if;

  v_hours_until := extract(epoch from (v_reservation.starts_at - now())) / 3600;

  update reservations set status = 'cancelled' where id = p_reservation_id;

  if p_cancelled_by_role = 'student' and v_hours_until < 24 then
    perform consume_entitlement(p_reservation_id);
    v_disposition := 'consumed';
  else
    perform release_entitlement(p_reservation_id);
    v_disposition := 'released';

    if p_cancelled_by_role in ('teacher', 'company') then
      select grant_id into v_grant_id from entitlement_ledger
        where reservation_id = p_reservation_id and event_type = 'release';
      if v_grant_id is not null then
        select expires_at into v_current_expires_at from entitlement_grants where id = v_grant_id;
        v_min_expires_at := now() + interval '30 days';
        if v_current_expires_at < v_min_expires_at then
          perform extend_entitlement(v_grant_id, v_min_expires_at, 'r6_teacher_or_company_cancel:' || p_reservation_id);
        end if;
      end if;
    end if;
  end if;

  insert into reservation_cancellations (reservation_id, cancelled_by_role, cancelled_by_id, reason, entitlement_disposition)
  values (p_reservation_id, p_cancelled_by_role, p_cancelled_by_id, p_reason, v_disposition);

  perform cancel_reservation_notifications(p_reservation_id);
end;
$$;
