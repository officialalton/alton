-- M5-c(2026-09-06, 제품 오너 조건부 승인 후속) — teacher_partial_interruption 실제 구현.
--
-- 확정 정책: 선생님 사유로 일부만 진행(예: 예정 120분 중 80분만 제공)한 경우
-- - 수업권 1장 소진(consume).
-- - 실제 제공한 시간만 지급(80분 제공→80분 지급, 미제공 40분은 지급 안 함).
-- - 미제공 시간은 makeup_obligations(reason='teacher_partial_interruption')로 이관.
-- - 실제 제공 시간이 90분 미만이면 기존 QC 경고(teacher_qc_warnings, type='short_session_teacher_fault')도 생성.
-- - resolve_teacher_lateness()가 이미 채운 세션(late_start_minutes not null)에는 적용 금지
--   (지각=당일 시작 지연, 부분중단=진행 중 어느 시점에 선생님 사유로 중단 — 서로 다른 사유라
--   같은 세션에 둘 다 적용될 이유가 없다. 중복 차감/중복 보충시간 생성 방지를 위해 명시적으로 막는다).
--
-- 재사용: finalize_session_as_infra_incident()의 "중단"(interrupted) 처리와 거의 동일한 모양이나,
-- 그 함수는 회사·Meet 장애 전용(120분 상한 있음)이라 사유가 다르다. 선생님 귀책 부분중단은
-- 120분 상한을 적용하지 않는다(과지급 방지 로직 자체가 "제공한 시간만 지급"이므로 상한이
-- 필요 없다 — 예정 시간을 초과해 제공할 수 없다는 점은 아래 검증으로 강제한다).

create or replace function public.resolve_teacher_partial_interruption(
  p_session_id uuid,
  p_actual_provided_minutes int,
  p_actor_id uuid,
  p_reason text
) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_session sessions%rowtype;
  v_reservation reservations%rowtype;
  v_missing_minutes int;
  v_child_id uuid;
begin
  if p_actual_provided_minutes < 0 then
    raise exception 'p_actual_provided_minutes는 음수일 수 없습니다.' using errcode = 'P0001';
  end if;

  select * into v_session from sessions where id = p_session_id for update;
  if v_session.id is null then
    raise exception '세션을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;
  if v_session.final_status not in ('scheduled', 'live') then
    raise exception '이미 확정된 세션입니다(현재 상태: %).', v_session.final_status using errcode = 'P0001';
  end if;

  if p_actual_provided_minutes > v_session.scheduled_duration_minutes then
    raise exception 'p_actual_provided_minutes(%)가 예정 시간(%)을 초과할 수 없습니다.',
      p_actual_provided_minutes, v_session.scheduled_duration_minutes using errcode = 'P0001';
  end if;

  -- 지각(resolve_teacher_lateness)과 부분중단(이 함수)은 서로 다른 사유다. 같은 세션에 지각
  -- 처리가 이미 있었다면(late_start_minutes가 채워짐) 이 함수를 또 적용하면 미제공 시간이
  -- 이중으로 차감/이관될 수 있으므로 명시적으로 막는다.
  if v_session.late_start_minutes is not null then
    raise exception '이 세션은 이미 지각 처리(resolve_teacher_lateness)가 적용됐습니다 — 부분중단을 중복 적용할 수 없습니다.'
      using errcode = 'P0001';
  end if;

  select * into v_reservation from reservations where id = v_session.reservation_id;

  perform consume_entitlement(v_session.reservation_id);

  v_missing_minutes := v_session.scheduled_duration_minutes - p_actual_provided_minutes;

  update sessions
    set final_status = 'interrupted',
        actual_end_at = coalesce(actual_end_at, now()),
        payable_minutes = p_actual_provided_minutes,
        final_reason = p_reason,
        final_actor_id = p_actor_id,
        finalized_at = now(),
        makeup_minutes_generated = makeup_minutes_generated + v_missing_minutes
    where id = p_session_id;

  insert into session_status_events (session_id, event_type, previous_final_status, new_final_status, actor_profile_id, reason)
  values (p_session_id, 'interrupted', v_session.final_status, 'interrupted', p_actor_id, p_reason);

  if v_missing_minutes > 0 then
    select child_id into v_child_id from subject_enrollments where id = v_session.subject_enrollment_id;
    insert into makeup_obligations (triggering_session_id, child_id, teacher_id, owed_minutes, reason)
    values (p_session_id, v_child_id, v_session.teacher_id, v_missing_minutes, 'teacher_partial_interruption');
  end if;

  if p_actual_provided_minutes < 90 then
    select child_id into v_child_id from subject_enrollments where id = v_session.subject_enrollment_id;
    insert into teacher_qc_warnings (teacher_id, student_id, type, detail)
    values (
      v_session.teacher_id, v_child_id, 'short_session_teacher_fault',
      format('선생님 사유로 부분중단, 실제 제공 %s분(예약 %s분) — 세션 %s', p_actual_provided_minutes, v_session.scheduled_duration_minutes, p_session_id)
    );
  end if;

  perform public.upsert_session_payout_item(p_session_id);
end;
$$;
revoke execute on function public.resolve_teacher_partial_interruption(uuid, int, uuid, text) from public, anon, authenticated;
grant execute on function public.resolve_teacher_partial_interruption(uuid, int, uuid, text) to service_role;

comment on function public.resolve_teacher_partial_interruption(uuid, int, uuid, text) is
  'M5-c: 선생님 사유로 일부만 제공된 세션 — 수업권 1장 소진 + 실제 제공 시간만 지급(120분 상한 없음,
  예정 시간 초과만 검증) + 미제공분은 makeup_obligations(reason=teacher_partial_interruption)로 이관 +
  90분 미만이면 QC 경고. 이미 resolve_teacher_lateness()가 적용된 세션(late_start_minutes not null)에는
  중복 적용을 금지한다(지각과 부분중단은 서로 다른 사유이나 같은 세션에 이중 차감/이중 보충 방지).';
