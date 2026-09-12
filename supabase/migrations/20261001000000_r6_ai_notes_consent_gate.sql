-- R6 7/N — AI 회의록(Smart Notes) 동의 게이트. "필수 개인정보 동의와 분리된 기존 선택
-- 동의 구조 재사용"(스펙 원문) — R3에서 이미 만들어둔 `ai_notes_consent_events`
-- (`20260913000000_r3_contract_model_realignment.sql` §8, 그 마이그레이션 주석에 "실제
-- Smart Notes on/off 적용 로직은 R6/R9 범위"라고 명시돼 있었음)를 그대로 쓴다 — 새 정책
-- 테이블을 만들지 않는다.
--
-- 정책: 기본은 Smart Notes ON(opt-out 모델, 스펙 원문 "기본은 Smart Notes ON"). 보호자가
-- 명시적으로 거부한 적이 있으면(가장 최근 미철회 이벤트가 opted_in=false) 그 이후 생성되는
-- 세션은 Smart Notes를 사용하지 않는다. Gate C에서 이미 검증된 "Meet API로 세션 단위 Smart
-- Notes를 개별 OFF 전환할 수 있음", "녹화 OFF 상태 스크린샷 0개" 등은 재실험하지 않고 그대로
-- 인용한다 — 이 마이그레이션은 ALTON 내부 동의 판정과 세션 연결만 다룬다.
--
-- 영상·원본 음성 녹화, 별도 Meet 전사("Transcribe the meeting")는 이번에도 별도 기능을
-- 만들지 않는다(스펙 원문 "별도 녹화 기능을 만들지 않음") — 이 마이그레이션이 건드리는
-- 대상은 오직 sessions.smart_notes_status 판정 로직뿐이다.

-- ai_notes_consent_events.effective_at은 default now()라 같은 트랜잭션 안에서 연속
-- insert하면(예: 관리자가 opt-out 후 바로 opt-in을 정정) 값이 완전히 동일해질 수 있다
-- (Postgres now()는 트랜잭션 시작 시점에 고정) — "가장 최근" 판정이 effective_at만으로는
-- 모호해지므로, insert 순서를 보장하는 단조증가 컬럼을 별도로 둔다.
alter table ai_notes_consent_events add column seq bigint generated always as identity;

create or replace function public.has_ai_notes_consent(p_student_id uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(
    (
      select opted_in from ai_notes_consent_events
      where student_id = p_student_id and revoked_at is null
      order by effective_at desc, seq desc
      limit 1
    ),
    true -- 이력이 전혀 없으면 기본 ON(opt-out 모델)
  );
$$;

-- 보호자가 자녀의 AI 회의록 사용 여부를 선택/철회하는 경로. R2 consent_as_guardian()과
-- 동일한 guardian 관계 검증 패턴.
create or replace function public.set_ai_notes_consent_as_guardian(
  p_student_id uuid,
  p_opted_in boolean,
  p_reason text default null
) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if not exists (
    select 1 from household_members hm
    join household_members child
      on child.household_id = hm.household_id and child.role = 'child' and child.profile_id = p_student_id
    where hm.role = 'guardian' and hm.profile_id = auth.uid()
  ) then
    raise exception '해당 학생의 보호자만 AI 회의록 사용 여부를 선택할 수 있습니다.';
  end if;

  insert into ai_notes_consent_events (student_id, opted_in, policy_version, actor_id, revocation_reason)
  values (p_student_id, p_opted_in, 'r6-ai-notes-v1', auth.uid(), case when not p_opted_in then p_reason else null end)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.set_ai_notes_consent_as_guardian(uuid, boolean, text) from public, anon;
grant execute on function public.set_ai_notes_consent_as_guardian(uuid, boolean, text) to authenticated;

-- confirm_lesson_booking(): 세션 생성 시점에 그 아이의 현재 AI 회의록 동의 상태를 스냅샷
-- 판정해 smart_notes_status에 반영한다(로직 변경은 이 부분만 추가, 나머지는 R6 4/N과 동일).
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

  return query select v_reservation_id, v_session_id;
end;
$$;
