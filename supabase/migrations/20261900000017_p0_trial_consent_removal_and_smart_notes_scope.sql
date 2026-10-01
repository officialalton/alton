-- 2026-09-28 — 초기 고객 절차 단순화 1/3
-- (docs/2026-09-26-consent-contract-simplification-implementation-plan.md 2단계-B/C/D)
--
-- 정책(2026-09-26 확정, 2026-09-28 범위 조정): 첫 상담·체험 수업에는 AI 회의록/
-- Smart Notes/전사를 쓰지 않고, 별도 AI 처리 동의도 받지 않는다. 13세 미만
-- 보호자 동의 시스템(is_under_13/guardian_consents 등, 20260904000000)은
-- 이번 변경과 무관하게 그대로 둔다 — 여기서 없애는 것은 "체험 Smart Notes
-- 동의"(trial_smart_notes_consents)뿐이다. 과거 동의 데이터는 삭제하지 않고
-- 감사용으로 남긴다.
--
-- 이 마이그레이션이 하는 일:
--   1) grant_trial_entitlement_for_consultation / grant_trial_entitlement_for_student
--      에서 trial_smart_notes_consents 존재 확인을 제거한다.
--   2) confirm_lesson_booking()이 체험(lesson_types.code='trial')이면
--      smart_notes_status를 'pending'이 아니라 'not_applicable'로 저장한다.
--
-- (계획 문서 2단계-D "직접생성 경로의 awaiting_consent 제거"는 이 마이그레이션에
-- 포함하지 않는다 — 실제로 db push해보니 finalize_trial_onboarding_students /
-- retry_trial_onboarding_student의 최신 정의(20261481000000, R15-A 컨설턴트
-- 배정 로직 포함)는 이미 awaiting_consent 없이 계정 생성 직후 바로
-- grant_trial_entitlement_for_student()를 pending→granted/failed 패턴으로
-- 즉시 시도하고 있었다 — 계획 수립 시 참고한 조사가 더 오래된 마이그레이션
-- (20261272000000)을 최종본으로 착각한 것. 1번에서 동의 체크만 제거하면
-- 이 기존 즉시-지급 시도가 저절로 성공하게 되므로 별도 수정이 필요 없다.)

-- =========================================================================
-- 1) 체험수업권 지급 RPC — Smart Notes 동의 확인 제거
-- =========================================================================

create or replace function public.grant_trial_entitlement_for_consultation(
  p_consultation_id uuid
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_child_id uuid;
  v_existing_grant_id uuid;
  v_new_grant_id uuid;
  v_trial_product_id uuid;
  v_expires_at timestamptz;
begin
  select child_id into v_child_id from consultations where id = p_consultation_id for update;
  if not found then
    raise exception '상담 신청을 찾을 수 없습니다: %', p_consultation_id;
  end if;
  if v_child_id is null then
    raise exception '연결된 학생 계정이 없어 체험수업권을 지급할 수 없습니다(잠재고객 단계 — 정식 학생 계정 연결 후 재시도 필요).';
  end if;

  select id into v_existing_grant_id from entitlement_grants where source_consultation_id = p_consultation_id;
  if v_existing_grant_id is not null then
    return v_existing_grant_id;
  end if;

  select eg.id into v_existing_grant_id
  from entitlement_grants eg
  join entitlement_products ep on ep.id = eg.entitlement_product_id
  where eg.child_id = v_child_id and ep.code = 'trial_lesson_grant'
  limit 1;
  if v_existing_grant_id is not null then
    return v_existing_grant_id;
  end if;

  select id into v_trial_product_id from entitlement_products where code = 'trial_lesson_grant';
  if v_trial_product_id is null then
    raise exception '체험수업권 상품(trial_lesson_grant)이 존재하지 않습니다 — 마이그레이션 순서 문제.';
  end if;

  v_expires_at := now() + interval '90 days';

  begin
    insert into entitlement_grants (
      child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at,
      is_paid, source_consultation_id
    ) values (
      v_child_id, v_trial_product_id, null, 1, v_expires_at, false, p_consultation_id
    )
    returning id into v_new_grant_id;
  exception when unique_violation then
    select id into v_new_grant_id from entitlement_grants where source_consultation_id = p_consultation_id;
    if v_new_grant_id is not null then
      return v_new_grant_id;
    end if;
    raise;
  end;

  insert into entitlement_ledger (grant_id, event_type, amount, business_event_id)
  values (v_new_grant_id, 'grant', 1, 'trial_grant:' || p_consultation_id::text)
  on conflict do nothing;

  return v_new_grant_id;
end;
$$;
comment on function public.grant_trial_entitlement_for_consultation(uuid) is
  '학생당 정확히 1개만 지급. is_paid=false로 생성되므로 환불·이전 대상에서 자동 제외. '
  '2026-09-09: 관리자 생년월일 확인 게이트 제거. '
  '2026-09-28: 체험 Smart Notes 동의 게이트 제거(초기 고객 절차 단순화) — 첫 상담·체험에는 AI 기록을 쓰지 않으므로 동의 자체가 불필요해짐.';
revoke execute on function public.grant_trial_entitlement_for_consultation(uuid) from public, anon, authenticated;

create or replace function public.grant_trial_entitlement_for_student(
  p_child_id uuid
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_existing_grant_id uuid;
  v_new_grant_id uuid;
  v_trial_product_id uuid;
  v_expires_at timestamptz;
begin
  if not exists (select 1 from profiles where id = p_child_id and role = 'student') then
    raise exception '학생 계정을 찾을 수 없습니다: %', p_child_id;
  end if;

  select eg.id into v_existing_grant_id
  from entitlement_grants eg
  join entitlement_products ep on ep.id = eg.entitlement_product_id
  where eg.child_id = p_child_id and ep.code = 'trial_lesson_grant'
  limit 1;
  if v_existing_grant_id is not null then
    return v_existing_grant_id;
  end if;

  select id into v_trial_product_id from entitlement_products where code = 'trial_lesson_grant';
  if v_trial_product_id is null then
    raise exception '체험수업권 상품(trial_lesson_grant)이 존재하지 않습니다 — 마이그레이션 순서 문제.';
  end if;

  v_expires_at := now() + interval '90 days';

  insert into entitlement_grants (
    child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at,
    is_paid, source_consultation_id
  ) values (
    p_child_id, v_trial_product_id, null, 1, v_expires_at, false, null
  )
  returning id into v_new_grant_id;

  insert into entitlement_ledger (grant_id, event_type, amount, business_event_id)
  values (v_new_grant_id, 'grant', 1, 'trial_grant_direct:' || p_child_id::text)
  on conflict do nothing;

  return v_new_grant_id;
end;
$$;
revoke execute on function public.grant_trial_entitlement_for_student(uuid) from public, anon, authenticated;
grant execute on function public.grant_trial_entitlement_for_student(uuid) to service_role;

comment on function public.grant_trial_entitlement_for_student(uuid) is
  'grant_trial_entitlement_for_consultation()의 지인/추천 직접생성 경로용 — consultation 없이 '
  '학생 id만으로 체험수업권 1장을 지급한다. '
  '2026-09-28: 체험 Smart Notes 동의 게이트 제거(초기 고객 절차 단순화).';

-- =========================================================================
-- 2) confirm_lesson_booking — 체험 예약은 smart_notes_status를 'not_applicable'로
-- =========================================================================

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
  -- 2026-09-28: 첫 상담·체험 수업에는 AI 기록(Smart Notes/전사)을 쓰지 않는다 —
  -- 정규 수업만 'pending'으로 시작해 이후 Google Meet Smart Notes 파이프라인이 채운다.
  v_smart_notes_status := case when v_is_trial then 'not_applicable' else 'pending' end;

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
  '2026-09-28: 체험(lesson_types.code=''trial'') 예약은 smart_notes_status=''not_applicable''로 '
  '생성한다(초기 고객 절차 단순화 — 첫 상담·체험에는 AI 기록 없음). 정규 수업만 ''pending''으로 시작.';
revoke execute on function public.confirm_lesson_booking(uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, uuid, smallint, boolean) from public, anon, authenticated;
grant execute on function public.confirm_lesson_booking(uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, uuid, smallint, boolean) to service_role;
