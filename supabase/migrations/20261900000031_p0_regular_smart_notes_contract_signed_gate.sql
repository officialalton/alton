-- 2026-09-28 — 정규 수업 AI 기록(Smart Notes) 게이트: 계약 서명 완료 후에만 적용
-- (docs/2026-09-28-post-signature-smart-notes-transcription-plan.md 2단계-A)
--
-- 문제: confirm_lesson_booking()의 최신 정의(20261900000017)는 체험이 아니기만
-- 하면 계약 서명 여부와 무관하게 항상 smart_notes_status='pending'으로 세션을
-- 만든다. subject_enrollments.status는 planned/active 등 여러 상태를 가질 수
-- 있고, 이 함수 자체는 subject_enrollments.status나 contracts.status를 전혀
-- 조회하지 않으므로, 계약이 아직 active(=서명 완료)가 아닌 과목 수강으로도
-- 정규 수업 예약이 들어오면 Smart Notes가 곧바로 'pending'으로 잡힌다.
--
-- 정책(2026-09-26/28 확정): 정규 수업 AI 기록은 가족계약 서명(contracts.status
-- = 'active')이 이 예약의 근거가 되므로, 서명 전에는 체험과 동일하게
-- 'not_applicable'이어야 한다. R6의 개별 opt-out 게이트(has_ai_notes_consent/
-- ai_notes_consent_events)는 20261008000000에서 이미 완전히 제거되었으므로
-- (Smart Notes가 opt-out 선택 기능에서 계약 필수 조항으로 전환됨) 이번 변경은
-- 그 자리를 대체하는 것이 아니라, "언제부터 적용 대상이 되는가"라는 새 축을
-- 추가하는 것뿐이다.

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
    -- 2026-09-28: 정규 수업 AI 기록은 가족계약 서명(contracts.status='active')이
    -- 근거이므로, 서명 전에는 체험과 동일하게 'not_applicable'로 스냅샷한다.
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
  '적용 대상이 아니다(docs/2026-09-28-post-signature-smart-notes-transcription-plan.md).';
