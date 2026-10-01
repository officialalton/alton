-- 2026-09-28 — fix: 20261900000031이 confirm_lesson_booking()을 다시 쓰면서
-- 실수로 체험 세션 연결 로직에 `status = 'completed'`를 끼워 넣었다(원래
-- 20261900000017 정의에는 없던 부분 — 예약 확정 시점에 trial_sessions를 곧바로
-- completed로 만들면 reject_direct_trial_session_completion() 트리거가 "연결된
-- v3 세션이 아직 completed가 아니다"로 거부해 정규/체험 예약 자체가 실패하는
-- 회귀였다. 로컬 통합 테스트로 즉시 잡혀 db push 직후 고친다). 이 마이그레이션은
-- session_id만 연결하던 원래 동작으로 되돌리고, 20261900000031의 본래 목적(정규
-- 수업 Smart Notes는 가족계약 서명 후에만 'pending')은 그대로 유지한다.

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
  v_is_trial boolean;
  v_trial_session_id uuid;
  v_smart_notes_status text;
  v_contract_signed boolean;
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

  select (code = 'trial') into v_is_trial from lesson_types where id = p_lesson_type_id;

  if v_is_trial then
    v_smart_notes_status := 'not_applicable';
  else
    select exists (
      select 1 from subject_enrollments se
      join contracts c on c.id = se.contract_id
      where se.id = p_subject_enrollment_id and c.status = 'active'
    ) into v_contract_signed;
    -- 정규 수업 AI 기록은 가족계약 서명(contracts.status='active')이 근거이므로,
    -- 서명 전에는 체험과 동일하게 'not_applicable'로 스냅샷한다.
    v_smart_notes_status := case when v_contract_signed then 'pending' else 'not_applicable' end;
  end if;

  insert into sessions (
    reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes,
    smart_notes_status
  ) values (
    v_reservation_id, p_subject_enrollment_id, p_teacher_id, p_lesson_type_id,
    extract(epoch from (p_ends_at - p_starts_at))::int / 60,
    v_smart_notes_status
  )
  returning id into v_session_id;

  v_grant_id := hold_entitlement(p_child_id, v_reservation_id, p_starts_at, 1, p_lesson_type_id);

  perform schedule_reservation_notifications(v_reservation_id);

  if v_is_trial then
    select id into v_trial_session_id from trial_sessions
      where child_id = p_child_id and status = 'scheduled' and trial_sessions.session_id is null
      order by scheduled_at desc limit 1;
    if v_trial_session_id is not null then
      -- fix(20261900000032): session_id만 연결한다 — status='completed'는 여기서
      -- 세팅하지 않는다(실제 완료는 별도 완료 플로우/트리거가 담당).
      update trial_sessions set session_id = v_session_id where id = v_trial_session_id;
    end if;
  end if;

  return query select v_reservation_id, v_session_id;
end;
$$;
comment on function public.confirm_lesson_booking(uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, uuid, smallint, boolean) is
  '2026-09-28: 체험 예약은 항상 smart_notes_status=''not_applicable''. 정규 수업은 '
  '이 과목 수강에 연결된 가족계약(contracts.status)이 ''active''(서명 완료)일 때만 '
  '''pending''으로 시작하고, 서명 전에는 체험과 동일하게 ''not_applicable''이다 — '
  '가족계약 서명 자체가 Smart Notes 조항(제12조)에 대한 사전 동의이므로 서명 전에는 '
  '적용 대상이 아니다(docs/2026-09-28-post-signature-smart-notes-transcription-plan.md). '
  '2026-09-28 fix(20261900000032): 체험 세션 연결 시 session_id만 세팅하고 '
  'status는 건드리지 않는다(20261900000031의 실수 되돌림).';
