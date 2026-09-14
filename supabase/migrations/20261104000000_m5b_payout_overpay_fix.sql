-- M5-b 후속(2026-09-05, 제품 오너 코드 리뷰 지시) — 선생님 귀책 지각·보충시간 조합에서
-- 정산이 120분을 초과할 수 있는 과지급 버그 수정.
--
-- 재현 확인: finalize_lesson_session()의 'completed' 분기는 payable_minutes를 항상
-- sessions.scheduled_duration_minutes 그대로 채웠다. 선생님이 지각하고 당일 연장을
-- 하지 않거나 일부만 연장한 경우(resolve_teacher_lateness), scheduled_duration_minutes는
-- 실제 제공된 시간보다 크게 유지된 채(원래 예약 길이 + 합의 연장분) 그대로 지급 기준이
-- 됐다 — 즉 선생님이 지각한 세션 자체가 이미 "실제 제공 시간"이 아니라 "예약 시간"으로
-- 과다 지급되고 있었고, 그 위에 미이행분이 makeup_obligations로 이관되어 나중에 다른
-- (미래) 세션에 이어붙여 다시 지급되므로(그 세션도 자기 scheduled_duration_minutes 전체를
-- 지급받는다) 같은 지각분이 두 번 지급되는 결과가 난다.
--   예: 원 세션 120분 예약, 선생님 10분 지각, 당일 연장 0분 → scheduled_duration_minutes는
--   120분 그대로 유지되고 finalize_lesson_session()이 120분을 그대로 지급(실제 제공 110분인데
--   120분 지급 — 이미 여기서 10분 과다). 미이행 10분은 makeup_obligations로 이관되고, 나중에
--   다른 정규 세션에 10분을 이어붙이면 그 세션도 자기 scheduled_duration_minutes(예: 120+10)
--   전체를 지급받아 총 240분(120+120)이 지급된다 — 정확한 총액은 110(원 세션 실제 제공)
--   +120(미래 세션 정상분)+10(보충 실제 제공)=240이 아니라 120+130=250도 아니고, 확정된
--   귀책별 지급 기준상 "원 세션 110분+보충 10분=120분"은 원 세션 자체의 지급액이 110분으로
--   줄어들어야 성립한다 — 기존 코드는 원 세션을 줄이지 않고 120분 그대로 지급했으므로 실제
--   과다 지급분은 세션 조합 전체가 아니라 "원 세션 하나"에서 이미 10분 발생했다.
--
-- 수정: finalize_lesson_session()/recomplete_session()의 'completed'/'student_no_show'
-- 분기에서 payable_minutes = scheduled_duration_minutes - coalesce(late_start_minutes, 0)로
-- 바꾼다. late_start_minutes는 resolve_teacher_lateness()가 채우는 컬럼으로, 당일 합의
-- 연장 후에도 여전히 남아있는 "지각으로 실제 제공되지 못한 분"이 아니라 "총 지각분"
-- 그 자체를 저장한다 — 그런데 resolve_teacher_lateness()가 이미 scheduled_duration_minutes를
-- 합의 연장분만큼 늘려놨으므로(원래 예약 길이+연장분), scheduled_duration_minutes-
-- late_start_minutes = (원래 예약 길이+연장분)-총지각분 = 원래 예약 길이-(총지각분-연장분)
-- = 원래 예약 길이-미이행분(=makeup_obligations.owed_minutes) = 실제 제공된 시간이 정확히
-- 나온다. 학생 지각(student_no_show/completed 케이스 중 학생 귀책)에는 late_start_minutes가
-- 채워지지 않으므로(테스트로 고정된 4대 규칙: 학생 지각 후 참석은 예약 시간 그대로 지급,
-- 보충시간 미생성) coalesce(...,0)로 영향받지 않는다 — 기존 M5-a 회귀 테스트와 완전히
-- 하위호환.
--
-- 회사·Meet 장애(finalize_session_as_infra_incident)는 이미 실제 제공 분을 인자로 받아
-- least(p_provided_minutes, 120)으로 직접 계산하므로 이 버그의 영향을 받지 않았다(별도
-- 확인 완료, 수정 불필요).
--
-- 부수 확인: apply_makeup_time_to_booking()이 "정규수업"이 아니라 kind='lesson'(체험 포함)
-- 예약이면 전부 받아들이고 있었다 — 확정 정책("발생시킨 선생님의 미래 정규수업에만 사용")에
-- 맞게 체험(lesson_types.code='trial') 예약은 거부하도록 함께 좁힌다.

create or replace function public.finalize_lesson_session(
  p_session_id uuid,
  p_outcome v3_session_final_status,
  p_actor_id uuid,
  p_reason text,
  p_teacher_fault_provided_minutes int default null
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

  if p_outcome in ('completed', 'student_no_show') then
    perform consume_entitlement(v_session.reservation_id);
    -- 2026-09-05 과지급 버그 수정: 선생님 지각으로 미이행분(late_start_minutes)이 남아있으면
    -- 실제 제공된 분(= 합의 연장 반영 후 scheduled_duration_minutes - late_start_minutes)만큼만
    -- 지급한다. late_start_minutes가 없으면(학생 귀책 케이스 포함) 기존과 완전히 동일하다.
    v_payable := v_session.scheduled_duration_minutes - coalesce(v_session.late_start_minutes, 0);
    update sessions
      set final_status = p_outcome,
          actual_end_at = coalesce(actual_end_at, now()),
          payable_minutes = v_payable,
          final_reason = p_reason,
          final_actor_id = p_actor_id,
          finalized_at = now()
      where id = p_session_id;

  elsif p_outcome = 'teacher_no_show' then
    perform release_entitlement(v_session.reservation_id);
    update sessions
      set final_status = p_outcome,
          actual_end_at = coalesce(actual_end_at, now()),
          payable_minutes = 0,
          final_reason = p_reason,
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
  values (p_session_id, p_outcome::text::v3_session_status_event_type, v_session.final_status, p_outcome, p_actor_id, p_reason);

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
revoke execute on function public.finalize_lesson_session(uuid, v3_session_final_status, uuid, text, int) from public, anon, authenticated;
grant execute on function public.finalize_lesson_session(uuid, v3_session_final_status, uuid, text, int) to service_role;

comment on function public.finalize_lesson_session(uuid, v3_session_final_status, uuid, text, int) is
  'M5-a 원본 + M5-b 확장 + 2026-09-05 과지급 수정: completed/student_no_show는 예약 시간에서
  선생님 지각으로 인한 미이행분(late_start_minutes)을 뺀 실제 제공 시간만 지급한다(학생 귀책
  케이스는 late_start_minutes가 없어 기존과 동일하게 예약 시간 전액 지급). 90분 미만이면
  teacher_qc_warnings 경고만 남긴다(지급액 자체는 변경하지 않음).';

-- recomplete_session()도 동일한 계산으로 맞춘다(재판정 시에도 과지급 재현 방지).
create or replace function public.recomplete_session(p_session_id uuid, p_new_final_status v3_session_final_status, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_prev v3_session_final_status;
  v_session sessions%rowtype;
begin
  if not public.is_admin() then
    raise exception '관리자만 세션을 재확정할 수 있습니다.';
  end if;

  select * into v_session from sessions where id = p_session_id for update;
  v_prev := v_session.final_status;
  if v_prev is distinct from 'live' then
    raise exception 'reopen_session() 이후에만 recomplete_session()을 호출할 수 있습니다.';
  end if;

  if p_new_final_status in ('scheduled', 'live') then
    raise exception 'recomplete_session()은 scheduled/live로 되돌릴 수 없습니다. 확정 가능한 종료 상태만 허용됩니다.';
  end if;

  update sessions
    set final_status = p_new_final_status,
        finalized_at = now(),
        payable_minutes = case
          when p_new_final_status in ('completed', 'student_no_show')
            then v_session.scheduled_duration_minutes - coalesce(v_session.late_start_minutes, 0)
          else 0
        end
    where id = p_session_id;

  insert into session_status_events (session_id, event_type, previous_final_status, new_final_status, actor_profile_id, reason)
  values (p_session_id, 'recompleted', v_prev, p_new_final_status, auth.uid(), p_reason);

  perform public.upsert_session_payout_item(p_session_id);
end;
$$;
revoke execute on function public.recomplete_session(uuid, v3_session_final_status, text) from public, anon, authenticated, service_role;
grant execute on function public.recomplete_session(uuid, v3_session_final_status, text) to authenticated;

-- apply_makeup_time_to_booking(): "정규수업"에만 적용 가능하도록 체험(trial) 예약을 거부한다.
create or replace function public.apply_makeup_time_to_booking(
  p_reservation_id uuid,
  p_obligation_id uuid,
  p_minutes int,
  p_actor_id uuid
) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_reservation reservations%rowtype;
  v_session sessions%rowtype;
  v_obligation makeup_obligations%rowtype;
  v_new_ends timestamptz;
  v_item_type text;
begin
  if p_minutes <= 0 then
    raise exception 'p_minutes는 0보다 커야 합니다.' using errcode = 'P0001';
  end if;

  select * into v_reservation from reservations where id = p_reservation_id for update;
  if v_reservation.id is null or v_reservation.kind <> 'lesson' or v_reservation.status <> 'confirmed' then
    raise exception '확정된 정규 수업 예약에만 보충시간을 이어붙일 수 있습니다.' using errcode = 'P0001';
  end if;
  if v_reservation.starts_at <= now() then
    raise exception '아직 시작하지 않은 미래 예약에만 보충시간을 연결할 수 있습니다.' using errcode = 'P0001';
  end if;

  select * into v_session from sessions where reservation_id = p_reservation_id for update;
  if v_session.id is null then
    raise exception '연결된 세션을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;

  -- 2026-09-05 확정 정책: "발생시킨 선생님의 미래 정규수업에만 사용" — 체험수업 예약은 제외.
  v_item_type := public.session_payout_item_type(v_session.lesson_type_id);
  if v_item_type = 'trial' then
    raise exception '보충시간은 정규 수업 예약에만 이어붙일 수 있습니다(체험수업 제외).' using errcode = 'P0001';
  end if;

  select * into v_obligation from makeup_obligations where id = p_obligation_id;
  if v_obligation.id is null then
    raise exception '유효하지 않은 보충시간 의무입니다.' using errcode = 'P0001';
  end if;
  if v_obligation.teacher_id <> v_reservation.owner_profile_id then
    raise exception '보충시간을 발생시킨 선생님의 예약에만 이어붙일 수 있습니다.' using errcode = 'P0001';
  end if;
  if v_obligation.expires_at <= now() then
    raise exception 'makeup_obligation_expired' using errcode = 'P0001';
  end if;

  v_new_ends := v_reservation.ends_at + (p_minutes || ' minutes')::interval;

  if not is_teacher_slot_open(v_reservation.owner_profile_id, v_reservation.starts_at, v_new_ends) then
    raise exception 'teacher_slot_not_open' using errcode = 'P0001';
  end if;
  if violates_teacher_buffer(v_reservation.owner_profile_id, v_reservation.starts_at, v_new_ends, v_reservation.id) then
    raise exception 'teacher_buffer_violation' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from reservations r2
    where r2.owner_profile_id = v_reservation.owner_profile_id
      and r2.status in ('holding', 'confirmed')
      and r2.id <> v_reservation.id
      and tstzrange(r2.starts_at, r2.ends_at) && tstzrange(v_reservation.ends_at, v_new_ends)
  ) then
    raise exception 'teacher_extension_conflict' using errcode = 'P0001';
  end if;

  update reservations set ends_at = v_new_ends where id = v_reservation.id;
  update sessions
    set scheduled_duration_minutes = scheduled_duration_minutes + p_minutes,
        makeup_minutes_generated = makeup_minutes_generated + p_minutes
    where id = v_session.id;

  perform public.apply_makeup_time(p_obligation_id, v_session.id, p_minutes);
end;
$$;
revoke execute on function public.apply_makeup_time_to_booking(uuid, uuid, int, uuid) from public, anon, authenticated;
grant execute on function public.apply_makeup_time_to_booking(uuid, uuid, int, uuid) to service_role;

comment on function public.apply_makeup_time_to_booking(uuid, uuid, int, uuid) is
  'M5-b + 만료 정책 + 2026-09-05 정규수업 전용 제한: 보충시간을 새 예약으로 만들지 않고 기존
  미래 "정규" 예약 뒤에 이어붙인다(체험수업 예약 거부). 발생 후 30일 이내에만 적용 가능,
  발생시킨 선생님의 예약에만 적용 가능. entitlement_ledger 신규 소진 이벤트 없음.';
