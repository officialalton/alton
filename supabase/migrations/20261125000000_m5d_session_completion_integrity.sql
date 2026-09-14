-- M5-d(2026-09-06) — 수업 종료 기준 보완. 체험/정규 동일한 실제 sessions 종료 로직을
-- 강제하고, 조기 완료·미시작 완료·이른 노쇼·학생 접속기록 무시 노쇼를 서버에서 차단한다.
-- 체험 파이프라인(trial_sessions)을 실제 v3 세션 완료 상태에 연결한다.

-- =========================================================================
-- 1) finalize_lesson_session() 확장 — 상태 전이·시각·접속기록 가드 추가.
--    - completed/student_no_show는 반드시 'live'에서만 가능(scheduled에서 바로 완료 차단).
--    - teacher_no_show는 반드시 'scheduled'에서만 가능(이미 시작된 세션은 부분중단/
--      장애판정 경로를 쓰도록 유도 — 이 함수의 담당 범위가 아님을 명확히 안내).
--    - student_no_show는 예약 시작 후 15분 이상 지나야 하고, 학생의 접속기록
--      (session_access_events.actor_id=child_id, meet_join/alton_page_open)이 있으면
--      선생님이 직접 확정할 수 없다(관리자 재검토 대상 — 이 함수가 예외를 던지므로
--      세션은 확정되지 않고 그대로 listSessionsNeedingFinalJudgment()의 "미확정 목록"에
--      남는다, 별도 큐 테이블 불필요).
--    - completed를 예약 종료시각 전에(조기 종료) 확정하려면 p_early_end_reason=
--      'student_reason'이 명시적으로 필요하다 — 선생님/회사 귀책 조기종료는 이 함수가
--      아니라 resolve_teacher_partial_interruption()/finalize_session_as_infra_incident()를
--      쓰도록 강제한다(이 함수는 그 경로로 안내만 하고 처리하지 않는다).
-- =========================================================================
drop function if exists public.finalize_lesson_session(uuid, v3_session_final_status, uuid, text, int);

create or replace function public.finalize_lesson_session(
  p_session_id uuid,
  p_outcome v3_session_final_status,
  p_actor_id uuid,
  p_reason text,
  p_teacher_fault_provided_minutes int default null,
  p_early_end_reason text default null
) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_session sessions%rowtype;
  v_reservation reservations%rowtype;
  v_grant_id uuid;
  v_current_expires_at timestamptz;
  v_min_expires_at timestamptz;
  v_child_id uuid;
  v_payable int;
  v_effective_reason text;
begin
  if p_outcome not in ('completed', 'student_no_show', 'teacher_no_show') then
    raise exception '이 함수는 completed/student_no_show/teacher_no_show만 처리합니다(중단·장애 판정은 finalize_session_as_infra_incident() 사용).' using errcode = 'P0001';
  end if;

  select * into v_session from sessions where id = p_session_id for update;
  if v_session.id is null then
    raise exception '세션을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;
  if v_session.final_status not in ('scheduled', 'live') then
    raise exception '이미 확정된 세션입니다(현재 상태: %). 재판정은 reopen_session()/recomplete_session()을 사용하세요.', v_session.final_status
      using errcode = 'P0001';
  end if;

  select * into v_reservation from reservations where id = v_session.reservation_id;

  -- 2026-09-06 추가: 정상 완료/학생 노쇼는 반드시 수업이 시작(live)된 뒤에만 가능하다
  -- — 시작 전(scheduled)에 바로 완료 처리하는 경로를 서버에서 차단한다.
  if p_outcome in ('completed', 'student_no_show') and v_session.final_status <> 'live' then
    raise exception '수업이 아직 시작되지 않았습니다(현재 상태: %). mark_lesson_session_started()로 먼저 시작한 뒤에만 정상 완료·학생 노쇼를 확정할 수 있습니다.', v_session.final_status
      using errcode = 'P0001';
  end if;

  -- 2026-09-06 추가: 선생님 노쇼는 수업이 시작되지 않은 경우에만(선생님이 아예 들어오지
  -- 않아 아무도 시작하지 못한 상태) 확정할 수 있다. 이미 시작된 세션에서 선생님이 이후
  -- 사라졌다면 이는 부분중단(선생님 귀책) 또는 회사·Meet 장애 판정의 영역이다.
  if p_outcome = 'teacher_no_show' and v_session.final_status <> 'scheduled' then
    raise exception '선생님 노쇼는 수업이 시작되지 않은 경우에만 확정할 수 있습니다(현재 상태: %). 이미 시작된 세션은 resolve_teacher_partial_interruption()이나 finalize_session_as_infra_incident()를 사용하세요.', v_session.final_status
      using errcode = 'P0001';
  end if;

  if p_outcome = 'student_no_show' then
    -- 2026-09-06 추가: 예약 시작 후 15분이 지나야만 학생 노쇼를 확정할 수 있다.
    if now() < v_reservation.starts_at + interval '15 minutes' then
      raise exception '수업 시작 후 15분이 지나야 학생 노쇼를 확정할 수 있습니다(예약 시작: %).', v_reservation.starts_at
        using errcode = 'P0001';
    end if;

    -- 2026-09-06 추가: 학생의 실제 접속 기록(Meet 참가 또는 ALTON 화면 접속)이 있으면
    -- 선생님이 직접 노쇼를 확정할 수 없다 — 세션은 확정되지 않은 채로 남아 관리자의
    -- 미확정 목록(listSessionsNeedingFinalJudgment)에 그대로 노출된다.
    select child_id into v_child_id from subject_enrollments where id = v_session.subject_enrollment_id;
    if exists (
      select 1 from session_access_events
      where session_id = p_session_id
        and actor_id = v_child_id
        and event_type in ('meet_join', 'alton_page_open')
    ) then
      raise exception '학생의 접속 기록이 있어 선생님이 직접 노쇼를 확정할 수 없습니다 — 관리자 검토가 필요합니다.'
        using errcode = 'P0001';
    end if;
  end if;

  v_effective_reason := p_reason;

  if p_outcome = 'completed' and now() < v_reservation.ends_at then
    -- 2026-09-06 추가: 예약 종료시각 전 조기 완료는 사유가 명시적으로 필요하다.
    -- 선생님/회사 귀책 조기종료는 이 함수가 아니라 전용 함수를 쓰도록 강제한다.
    if p_early_end_reason is distinct from 'student_reason' then
      raise exception '예약 종료 시각 전에 정상 완료를 확정하려면 조기 종료 사유가 필요합니다 — 선생님 귀책이면 resolve_teacher_partial_interruption(), 회사·Meet 장애면 finalize_session_as_infra_incident()를 사용하고, 학생 사유라면 p_early_end_reason=''student_reason''과 함께 호출하세요.'
        using errcode = 'P0001';
    end if;
    v_effective_reason := '[학생 사유 조기종료] ' || coalesce(p_reason, '');
  end if;

  if p_outcome in ('completed', 'student_no_show') then
    perform consume_entitlement(v_session.reservation_id);
    v_payable := v_session.scheduled_duration_minutes - coalesce(v_session.late_start_minutes, 0);
    update sessions
      set final_status = p_outcome,
          actual_end_at = coalesce(actual_end_at, now()),
          payable_minutes = v_payable,
          final_reason = v_effective_reason,
          final_actor_id = p_actor_id,
          finalized_at = now()
      where id = p_session_id;

  elsif p_outcome = 'teacher_no_show' then
    perform release_entitlement(v_session.reservation_id);
    update sessions
      set final_status = p_outcome,
          actual_end_at = coalesce(actual_end_at, now()),
          payable_minutes = 0,
          final_reason = v_effective_reason,
          final_actor_id = p_actor_id,
          finalized_at = now()
      where id = p_session_id;

    select grant_id into v_grant_id from entitlement_ledger
      where reservation_id = v_session.reservation_id and event_type = 'release';
    if v_grant_id is not null then
      select expires_at into v_current_expires_at from entitlement_grants where id = v_grant_id;
      v_min_expires_at := now() + interval '30 days';
      if v_current_expires_at < v_min_expires_at then
        perform extend_entitlement(v_grant_id, v_min_expires_at, 'm5a_teacher_no_show:' || v_session.reservation_id);
      end if;
    end if;
  end if;

  insert into session_status_events (session_id, event_type, previous_final_status, new_final_status, actor_profile_id, reason)
  values (p_session_id, p_outcome::text::v3_session_status_event_type, v_session.final_status, p_outcome, p_actor_id, v_effective_reason);

  perform public.upsert_session_payout_item(p_session_id);

  if p_outcome = 'completed' and p_teacher_fault_provided_minutes is not null and p_teacher_fault_provided_minutes < 90 then
    select child_id into v_child_id from subject_enrollments where id = v_session.subject_enrollment_id;
    insert into teacher_qc_warnings (teacher_id, student_id, type, detail)
    values (
      v_session.teacher_id, v_child_id, 'short_session_teacher_fault',
      format('선생님 사유로 최종 제공 %s분(예약 %s분) — 세션 %s', p_teacher_fault_provided_minutes, v_session.scheduled_duration_minutes, p_session_id)
    );
  end if;
end;
$$;
revoke execute on function public.finalize_lesson_session(uuid, v3_session_final_status, uuid, text, int, text) from public, anon, authenticated;
grant execute on function public.finalize_lesson_session(uuid, v3_session_final_status, uuid, text, int, text) to service_role;

comment on function public.finalize_lesson_session(uuid, v3_session_final_status, uuid, text, int, text) is
  '2026-09-06 종료 기준 보완: completed/student_no_show는 live 상태에서만, teacher_no_show는
  scheduled 상태에서만 가능. student_no_show는 예약 시작 15분 경과 + 학생 접속기록 없음을
  요구(접속기록이 있으면 예외를 던져 관리자 미확정 목록에 남긴다). completed를 예약
  종료시각 전에 확정하려면 p_early_end_reason=''student_reason''이 필요(그 외 조기종료는
  전용 함수로 유도). 체험/정규 모두 동일한 이 함수를 거친다(별도 분기 없음).';

-- =========================================================================
-- 2) trial_sessions ↔ 실제 v3 세션 연결 — 관리자의 별도(레거시) 체험 계획/추적 행을
--    실제로 예약·시작·완료되는 sessions 행과 연결한다. 지금까지는 완전히 분리돼
--    있어서(관리자가 "체험 완료 처리"를 눌러도 실제 수업이 진행됐는지와 무관했다),
--    아래부터는 실제 완료가 자동으로 반영되고 그 전에는 관리자가 결과를 기록할 수 없다.
-- =========================================================================
alter table trial_sessions add column session_id uuid references sessions (id);
create index on trial_sessions (session_id);

comment on column trial_sessions.session_id is
  '2026-09-06 추가: 이 체험 계획에 실제로 연결된 v3 sessions 행(체험 예약이 confirm_lesson_booking()으로
  생성될 때 자동 연결됨). null이면 아직 실제 예약이 생성되지 않았거나 연결 대상이 없던
  과거 데이터.';

-- confirm_lesson_booking() 확장 — 체험(lesson_type code='trial') 예약이 생성되면
-- 같은 아이의 아직 연결되지 않은 scheduled trial_sessions 행을 찾아 연결한다.
-- 연결 대상이 없으면(예: 관리자 계획 없이 예외적으로 생성된 경우) 그냥 넘어간다 —
-- 예약 생성 자체를 막지 않는다.
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

  v_grant_id := hold_entitlement(p_child_id, v_reservation_id, p_starts_at, 1, p_lesson_type_id);

  perform schedule_reservation_notifications(v_reservation_id);

  -- 2026-09-06 추가: 체험 예약이면 아직 연결 안 된 이 아이의 체험 계획 행을 찾아 연결한다.
  select (code = 'trial') into v_is_trial from lesson_types where id = p_lesson_type_id;
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
revoke execute on function public.confirm_lesson_booking(uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, uuid, smallint, boolean) from public, anon, authenticated;
grant execute on function public.confirm_lesson_booking(uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, uuid, smallint, boolean) to service_role;

-- 2026-09-06 추가: trial_sessions.status는 이제 직접 'completed'로 UPDATE할 수 없다
-- (아래 자동 트리거만 예외) — 실제 v3 세션이 완료됐을 때만 자동으로 반영되도록 강제한다.
create or replace function public.reject_direct_trial_session_completion()
returns trigger language plpgsql as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed'
     and coalesce(current_setting('app.bypass_trial_session_auto_complete', true), '') <> 'true' then
    raise exception 'trial_sessions.status는 실제 v3 세션이 완료됐을 때만 자동으로 completed가 됩니다 — 직접 UPDATE할 수 없습니다.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger trial_sessions_reject_direct_completion
  before update of status on trial_sessions
  for each row execute function public.reject_direct_trial_session_completion();

-- sessions 완료 시(final_status='completed') 연결된 trial_sessions 행을 자동으로
-- completed 처리한다(정규 세션은 lesson_type code='regular'라 대상이 되지 않는다).
create or replace function public.auto_complete_linked_trial_session()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.final_status = 'completed' and old.final_status is distinct from 'completed' then
    perform set_config('app.bypass_trial_session_auto_complete', 'true', true);
    update trial_sessions
      set status = 'completed', completed_at = now()
      where session_id = new.id and status <> 'completed';
  end if;
  return new;
end;
$$;
create trigger sessions_auto_complete_linked_trial_session
  after update of final_status on sessions
  for each row execute function public.auto_complete_linked_trial_session();

comment on trigger sessions_auto_complete_linked_trial_session on sessions is
  '2026-09-06: 실제 v3 세션이 completed로 확정되면 연결된 trial_sessions(있다면)도
  자동으로 completed 처리한다 — 관리자의 "체험 결과 기록"은 이 자동 완료 이후에만
  허용된다(app 레이어에서 sessions.final_status를 재확인).';
