-- R6 정책 단순화(2026-09-03, 제품 오너 지시) — Smart Notes를 보호자 opt-out 선택 기능에서
-- 가족 서비스 이용계약의 필수 조항으로 바꾼다. 별도 동의서·체크박스·회차별 토글을 없애고,
-- 가족계약 서명 한 번이 정규수업 전체의 사전 동의 근거가 된다. ALTON은 아직 운영 전이라
-- 기존 opt-out 데이터의 이관/하위호환을 고려하지 않는다 — 그냥 삭제한다.
--
-- 이 마이그레이션이 건드리지 않는 것(의도적):
-- - `guardian_consents`/`consent_policy_versions`(R2, 미성년자 개인정보 필수 동의) — 정책상
--   명시적으로 분리된 별도 트랙, 계속 유지.
-- - `contracts`/`contract_versions`/DocuSign 서명 흐름 — 계약 활성화 게이트
--   (`subject_enrollment_activation_ready()`, R5)는 이미 `contracts.status = 'active'`만
--   요구하고 있고, 그 자체가 "현재 계약 버전 서명 완료"를 의미한다(새 버전이 필요해지면
--   `sendContractForSignature()`가 status를 'sent'로 되돌리고 재서명 전까지 'active'가 아니게
--   만드는 기존 설계) — 이 게이트에 별도 AI 동의 조건을 추가하지 않는다(스펙 원문:
--   "별도의 AI 동의 상태를 계약 활성화 조건으로 추가하지 않습니다").
-- - `smart_notes_generation_events`/`sessions.smart_notes_drive_file_id`/Workspace Events
--   웹훅 — 동의 여부와 무관한 범용 이벤트 연결 레이어, 그대로 유지.

-- confirm_lesson_booking(): 보호자 동의 조회 없이 항상 'pending'으로 스냅샷한다(정규수업은
-- 가족계약 서명 시점에 이미 Smart Notes 조항에 동의한 상태이므로 세션별 재확인이 없다).
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

  insert into sessions (
    reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes,
    smart_notes_status
  ) values (
    v_reservation_id, p_subject_enrollment_id, p_teacher_id, p_lesson_type_id,
    extract(epoch from (p_ends_at - p_starts_at))::int / 60,
    'pending'
  )
  returning id into v_session_id;

  v_grant_id := hold_entitlement(p_child_id, v_reservation_id, p_starts_at, 1);

  perform schedule_reservation_notifications(v_reservation_id);

  return query select v_reservation_id, v_session_id;
end;
$$;

-- 이제 존재할 수 없는 값이므로 이 상태로 남은 세션이 있으면 'pending'으로 되돌린다(운영
-- 데이터 없음 — 개발/테스트 fixture만 대상, 있다면 정리).
update sessions set smart_notes_status = 'pending' where smart_notes_status = 'disabled_by_guardian';

alter table sessions drop constraint sessions_smart_notes_status_check;
alter table sessions add constraint sessions_smart_notes_status_check
  check (smart_notes_status in ('not_applicable', 'pending', 'active', 'completed', 'failed'));

-- Meet Space Smart Notes 설정 적용(ON) 자체의 성공/실패를 추적하는 컬럼 — 이건
-- smart_notes_status(문서 생성·연결 파이프라인 상태)와는 다른 축이다. 실패해도 수업·예약·
-- 수업권 hold는 자동 취소하지 않고 관리자 재처리 대상으로 남긴다(스펙 원문).
alter table sessions add column smart_notes_config_status text not null default 'pending'
  check (smart_notes_config_status in ('pending', 'applied', 'failed'));
alter table sessions add column smart_notes_config_error text;
alter table sessions add column smart_notes_config_attempted_at timestamptz;

drop function if exists public.set_ai_notes_consent_as_guardian(uuid, boolean, text);
drop function if exists public.has_ai_notes_consent(uuid);
drop table if exists ai_notes_consent_events;
