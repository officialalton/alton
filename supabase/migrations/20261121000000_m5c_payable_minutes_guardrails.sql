-- M5-c(2026-09-06) — 음수·초과 방지 서버·DB 제약.
--
-- 1) sessions.payable_minutes에 음수 값 자체를 막는 CHECK 제약(additive). 기존 데이터에
--    위반 행이 없음을 먼저 확인했다(전체 세션 min(payable_minutes)=0, 로컬 dev 환경 기준
--    — 오픈 전이라 운영 데이터 없음). NOT VALID 없이 즉시 검증(validate)한다.
alter table sessions add constraint sessions_payable_minutes_non_negative check (payable_minutes >= 0);

-- 2) resolve_teacher_lateness()의 p_late_minutes가 원 수업시간(scheduled_duration_minutes)을
--    초과할 수 없도록 서버 검증을 추가한다(지각분이 수업 전체 시간보다 클 수 없음 — 물리적으로
--    불가능한 입력). p_agreed_extend_minutes의 0..p_late_minutes 범위 검증은 이미 있었다(그대로
--    유지) — 여기서는 late_minutes 자체의 상한만 추가한다.
create or replace function public.resolve_teacher_lateness(
  p_session_id uuid,
  p_late_minutes int,
  p_agreed_extend_minutes int,
  p_actor_id uuid,
  p_reason text
) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_session sessions%rowtype;
  v_reservation reservations%rowtype;
  v_new_ends timestamptz;
  v_child_id uuid;
  v_owed int;
  v_obligation_id uuid;
begin
  if p_late_minutes <= 0 then
    raise exception 'p_late_minutes는 0보다 커야 합니다.' using errcode = 'P0001';
  end if;
  if p_agreed_extend_minutes < 0 or p_agreed_extend_minutes > p_late_minutes then
    raise exception '합의 연장분은 0 이상, 지각분 이하여야 합니다.' using errcode = 'P0001';
  end if;

  select * into v_session from sessions where id = p_session_id for update;
  if v_session.id is null then
    raise exception '세션을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;

  -- 2026-09-06 추가: 지각분이 원 수업시간(예약된 전체 시간)을 초과할 수 없다 — 물리적으로
  -- 불가능한 입력(예: 30분짜리 세션에 지각 40분)을 서버에서 거부한다.
  if p_late_minutes > v_session.scheduled_duration_minutes then
    raise exception 'p_late_minutes(%)는 원 수업시간(%)을 초과할 수 없습니다.', p_late_minutes, v_session.scheduled_duration_minutes
      using errcode = 'P0001';
  end if;

  if v_session.final_status <> 'live' then
    raise exception '진행 중(live)인 세션만 당일 연장할 수 있습니다(현재 상태: %).', v_session.final_status
      using errcode = 'P0001';
  end if;

  select * into v_reservation from reservations where id = v_session.reservation_id for update;

  if p_agreed_extend_minutes > 0 then
    v_new_ends := v_reservation.ends_at + (p_agreed_extend_minutes || ' minutes')::interval;

    if not is_teacher_slot_open(v_session.teacher_id, v_reservation.starts_at, v_new_ends) then
      raise exception 'teacher_slot_not_open' using errcode = 'P0001';
    end if;
    if violates_teacher_buffer(v_session.teacher_id, v_reservation.starts_at, v_new_ends, v_reservation.id) then
      raise exception 'teacher_buffer_violation' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from reservations r2
      where r2.owner_profile_id = v_session.teacher_id
        and r2.status in ('holding', 'confirmed')
        and r2.id <> v_reservation.id
        and tstzrange(r2.starts_at, r2.ends_at) && tstzrange(v_reservation.ends_at, v_new_ends)
    ) then
      raise exception 'teacher_extension_conflict' using errcode = 'P0001';
    end if;

    update reservations set ends_at = v_new_ends where id = v_reservation.id;
    update sessions set scheduled_duration_minutes = scheduled_duration_minutes + p_agreed_extend_minutes
      where id = p_session_id;
  end if;

  v_owed := p_late_minutes - p_agreed_extend_minutes;
  if v_owed > 0 then
    select child_id into v_child_id from subject_enrollments where id = v_session.subject_enrollment_id;
    insert into makeup_obligations (triggering_session_id, child_id, teacher_id, owed_minutes, reason)
    values (p_session_id, v_child_id, v_session.teacher_id, v_owed, 'teacher_late')
    returning id into v_obligation_id;
  end if;

  update sessions set late_start_minutes = coalesce(late_start_minutes, 0) + p_late_minutes,
    makeup_minutes_generated = makeup_minutes_generated + v_owed
    where id = p_session_id;

  insert into session_late_extensions (
    session_id, late_minutes, agreed_extend_minutes, makeup_owed_minutes, makeup_obligation_id, actor_profile_id, reason
  ) values (
    p_session_id, p_late_minutes, p_agreed_extend_minutes, v_owed, v_obligation_id, p_actor_id, p_reason
  );
end;
$$;
revoke execute on function public.resolve_teacher_lateness(uuid, int, int, uuid, text) from public, anon, authenticated;
grant execute on function public.resolve_teacher_lateness(uuid, int, int, uuid, text) to service_role;

comment on function public.resolve_teacher_lateness(uuid, int, int, uuid, text) is
  'M5-b + 2026-09-06 가드: 선생님 지각분을 당일 합의로 예정 종료 시각 뒤로 연장(가능한 만큼)하고, 못
  채운 분은 makeup_obligations(reason=teacher_late)로 이관한다. p_late_minutes는 원 수업시간을 초과할
  수 없다(음수·초과 방지).';

comment on constraint sessions_payable_minutes_non_negative on sessions is
  '2026-09-06: payable_minutes는 절대 음수가 될 수 없다(과다 차감/계산 오류 방지의 마지막 방어선).';
