-- M5-c(2026-09-06, 최종 코드 대조) — 정산·수업권 무결성 잔여 4건 보완(additive).
-- 기존 함수·마이그레이션은 재작성하지 않고 create or replace/추가 제약으로만 처리한다.

-- =========================================================================
-- 1) resolve_session_reconciliation_task() — 반영 직전에 세션 상태뿐 아니라
--    해당 예약의 "현재" entitlement disposition과, 작업 생성 이후 그 grant에
--    발생한 다른 조정(adjust) 여부도 재확인한다. 저장된 조정량을 무조건 그대로
--    적용하면, 작업 생성 이후 다른 경로(다른 대사 작업·수동 조정 등)로 이미
--    entitlement가 바뀐 경우 중복 보정이 될 수 있다 — 전제가 달라졌으면
--    needs_review로 전환하고 적용하지 않는다.
-- =========================================================================
create or replace function public.resolve_session_reconciliation_task(p_task_id uuid, p_reason text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_task session_judgment_reconciliation_tasks%rowtype;
  v_session sessions%rowtype;
  v_reservation_id uuid;
  v_actual_current_disposition text;
  v_adjust_since_created int;
begin
  if not public.is_admin() then
    raise exception '관리자만 대사 작업을 반영할 수 있습니다.';
  end if;

  select * into v_task from session_judgment_reconciliation_tasks where id = p_task_id for update;
  if v_task.id is null then
    raise exception '대사 작업을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;
  if v_task.status = 'resolved' then
    raise exception '이미 반영된 대사 작업입니다.' using errcode = 'P0001';
  end if;
  if v_task.status = 'superseded' then
    raise exception '이 대사 작업은 같은 세션의 새 재판정으로 대체(superseded)됐습니다 — 반영할 수 없습니다.'
      using errcode = 'P0001';
  end if;
  if v_task.status = 'needs_review' then
    raise exception '이 대사 작업은 반영 시점에 전제가 깨져 needs_review 상태입니다 — 관리자 재검토 없이 반영할 수 없습니다.'
      using errcode = 'P0001';
  end if;

  if v_task.new_final_status = 'student_cancelled' and v_task.expected_entitlement_disposition is null then
    raise exception '학생 취소 재판정은 관리자가 소진/해제 여부를 먼저 선택해야 합니다 — set_reconciliation_task_student_cancelled_disposition()를 먼저 호출하세요.'
      using errcode = 'P0001';
  end if;

  select * into v_session from sessions where id = v_task.session_id for update;

  if v_session.final_status is distinct from v_task.new_final_status
     or v_session.payable_minutes is distinct from v_task.new_payable_minutes then
    perform set_config('app.bypass_reconciliation_task_lock', 'true', true);
    update session_judgment_reconciliation_tasks
      set status = 'needs_review', reason = coalesce(p_reason, reason)
      where id = p_task_id;
    return 'needs_review';
  end if;

  -- 2026-09-06 추가: 세션 상태가 일치해도, 이 예약의 entitlement 처리 상태 자체가
  -- 작업 생성 시점 기록(current_entitlement_disposition)과 달라졌으면 저장된
  -- required_entitlement_adjustment_amount는 더 이상 유효하지 않다.
  v_reservation_id := v_session.reservation_id;
  select event_type into v_actual_current_disposition from entitlement_ledger
    where reservation_id = v_reservation_id and event_type in ('consume', 'release')
    limit 1;

  if v_actual_current_disposition is distinct from v_task.current_entitlement_disposition then
    perform set_config('app.bypass_reconciliation_task_lock', 'true', true);
    update session_judgment_reconciliation_tasks
      set status = 'needs_review', reason = coalesce(p_reason, reason)
      where id = p_task_id;
    return 'needs_review';
  end if;

  -- 2026-09-06 추가: 같은 grant에 작업 생성 이후 이미 적용된 adjust(예: 다른 대사
  -- 작업, 수동 조정)가 있으면 저장된 조정량이 이미 반영된 것과 중복될 수 있으므로
  -- 재검토로 전환한다. 이 작업 자신의 반영으로 생기는 adjust는 아직 없으므로(반영
  -- 전 시점) 이 검사에 걸리지 않는다.
  if v_task.entitlement_grant_id is not null then
    select coalesce(sum(amount), 0) into v_adjust_since_created from entitlement_ledger
      where grant_id = v_task.entitlement_grant_id
        and event_type = 'adjust'
        and created_at > v_task.created_at;
    if v_adjust_since_created <> 0 then
      perform set_config('app.bypass_reconciliation_task_lock', 'true', true);
      update session_judgment_reconciliation_tasks
        set status = 'needs_review', reason = coalesce(p_reason, reason)
        where id = p_task_id;
      return 'needs_review';
    end if;
  end if;

  if v_task.required_entitlement_adjustment_amount <> 0 and v_task.entitlement_grant_id is not null then
    perform public.adjust_entitlement(
      v_task.entitlement_grant_id,
      v_task.required_entitlement_adjustment_amount,
      'reconciliation_task:' || p_task_id
    );
  end if;

  perform set_config('app.bypass_reconciliation_task_lock', 'true', true);
  update session_judgment_reconciliation_tasks
    set status = 'resolved', resolved_at = now(), resolved_by = auth.uid(), reason = coalesce(p_reason, reason)
    where id = p_task_id;
  return 'resolved';
end;
$$;
revoke execute on function public.resolve_session_reconciliation_task(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.resolve_session_reconciliation_task(uuid, text) to authenticated;

comment on function public.resolve_session_reconciliation_task(uuid, text) is
  '2026-09-06 재확인 보강: 반영 직전 세션 상태(final_status/payable_minutes)뿐 아니라
  해당 예약의 실제 현재 entitlement disposition과, 작업 생성 이후 같은 grant에 적용된
  다른 adjust 존재 여부까지 재확인한다 — 전제가 달라졌으면 needs_review로 전환하고
  저장된 조정량을 적용하지 않는다(중복 보정 방지).';

-- =========================================================================
-- 2) set_reconciliation_task_student_cancelled_disposition() — hold 금액 조회를
--    grant_id 전체가 아니라 이 작업이 속한 세션의 reservation_id로 한정한다.
--    같은 grant(수업권 묶음)에 예약이 여러 건 걸려 있으면 grant_id만으로 찾은
--    hold 금액이 다른 예약의 것과 섞일 수 있었다.
-- =========================================================================
create or replace function public.set_reconciliation_task_student_cancelled_disposition(
  p_task_id uuid,
  p_disposition text,
  p_reason text
) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_task session_judgment_reconciliation_tasks%rowtype;
  v_reservation_id uuid;
  v_held_amount int;
  v_required_amount int;
begin
  if not public.is_admin() then
    raise exception '관리자만 대사 작업의 수업권 처리 방식을 선택할 수 있습니다.';
  end if;
  if p_disposition not in ('consume', 'release') then
    raise exception 'p_disposition은 consume 또는 release여야 합니다.' using errcode = 'P0001';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception '학생 취소 수업권 처리를 직접 선택할 때는 사유를 반드시 입력해야 합니다.' using errcode = 'P0001';
  end if;

  select * into v_task from session_judgment_reconciliation_tasks where id = p_task_id for update;
  if v_task.id is null then
    raise exception '대사 작업을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;
  if v_task.status <> 'pending' then
    raise exception 'pending 상태의 대사 작업에만 수업권 처리 방식을 선택할 수 있습니다(현재 상태: %).', v_task.status
      using errcode = 'P0001';
  end if;
  if v_task.new_final_status <> 'student_cancelled' then
    raise exception '이 함수는 student_cancelled 재판정 작업에만 사용할 수 있습니다.' using errcode = 'P0001';
  end if;
  if v_task.expected_entitlement_disposition is not null then
    raise exception '이미 취소 기록으로 자동 판정된 작업입니다 — 수동 선택이 필요하지 않습니다.' using errcode = 'P0001';
  end if;

  select reservation_id into v_reservation_id from sessions where id = v_task.session_id;

  v_required_amount := 0;
  if v_task.entitlement_grant_id is not null and v_reservation_id is not null then
    -- 2026-09-06 수정: grant_id 전체가 아니라 이 세션의 reservation_id로 한정한 hold만 조회.
    select abs(amount) into v_held_amount from entitlement_ledger
      where reservation_id = v_reservation_id and event_type = 'hold';
    if v_task.current_entitlement_disposition is distinct from p_disposition then
      if v_task.current_entitlement_disposition = 'consume' and p_disposition = 'release' then
        v_required_amount := coalesce(v_held_amount, 0);
      elsif v_task.current_entitlement_disposition = 'release' and p_disposition = 'consume' then
        v_required_amount := -coalesce(v_held_amount, 0);
      end if;
    end if;
  end if;

  perform set_config('app.bypass_reconciliation_task_lock', 'true', true);
  update session_judgment_reconciliation_tasks
    set expected_entitlement_disposition = p_disposition,
        required_entitlement_adjustment_amount = v_required_amount,
        admin_disposition_reason = p_reason
    where id = p_task_id;
end;
$$;
revoke execute on function public.set_reconciliation_task_student_cancelled_disposition(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.set_reconciliation_task_student_cancelled_disposition(uuid, text, text) to authenticated;

comment on function public.set_reconciliation_task_student_cancelled_disposition(uuid, text, text) is
  '2026-09-06 수정: hold 금액 조회를 grant_id 전체가 아니라 이 작업이 속한 세션의
  reservation_id로 한정한다(같은 grant에 예약이 여러 건인 경우 다른 예약의 hold와
  섞이는 것을 방지). 그 외 동작은 기존과 동일.';

-- =========================================================================
-- 3) resolve_teacher_lateness() — 같은 세션에 이미 지각 처리가 적용됐으면
--    재호출(중복 처리)을 차단한다. 이 함수는 누적이 아니라 세션당 1회만
--    허용되므로, 누적 지각분이 원 수업시간을 초과하는 문제도 자동으로
--    함께 해소된다(재호출 자체가 막히므로 late_start_minutes가 두 번 이상
--    더해질 수 없다).
-- =========================================================================
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

  if p_late_minutes > v_session.scheduled_duration_minutes then
    raise exception 'p_late_minutes(%)는 원 수업시간(%)을 초과할 수 없습니다.', p_late_minutes, v_session.scheduled_duration_minutes
      using errcode = 'P0001';
  end if;

  if v_session.final_status <> 'live' then
    raise exception '진행 중(live)인 세션만 당일 연장할 수 있습니다(현재 상태: %).', v_session.final_status
      using errcode = 'P0001';
  end if;

  -- 2026-09-06 추가: 같은 세션에 지각 처리가 이미 적용됐으면(late_start_minutes가
  -- null이 아니면) 중복 처리를 차단한다 — 이 함수는 누적이 아니라 세션당 1회만
  -- 허용된다(resolve_teacher_partial_interruption()과의 상호 배타 규칙과 동일한 원칙).
  if v_session.late_start_minutes is not null then
    raise exception '이 세션은 이미 지각 처리(resolve_teacher_lateness)가 적용됐습니다 — 중복 적용할 수 없습니다.'
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
  '2026-09-06 가드 보강: p_late_minutes는 원 수업시간을 초과할 수 없고(음수·초과 방지),
  같은 세션에 이미 적용됐으면(late_start_minutes not null) 재호출(중복 처리)을 차단한다
  — 세션당 1회만 허용되므로 누적 지각분이 원 수업시간을 초과하는 상황 자체가 생기지 않는다.';

-- =========================================================================
-- 4) GPA 음수 차단 — DB CHECK + complete_student_profile() 서버 함수. 기존
--    students_gpa_range 제약(20261026 migration)은 이후 20261106 migration에서
--    students_gpa_requires_scale/students_gpa_within_scale로 대체되면서 gpa>=0
--    검증이 함께 빠졌다(회귀). additive 제약으로 복구한다.
-- =========================================================================
alter table students add constraint students_gpa_non_negative
  check (gpa is null or gpa >= 0);

comment on constraint students_gpa_non_negative on students is
  '2026-09-06: GPA는 음수가 될 수 없다. 20261106 마이그레이션이 students_gpa_range를
  students_gpa_requires_scale/students_gpa_within_scale로 대체하면서 gpa>=0 검증이
  누락된 것을 additive 제약으로 복구.';

create or replace function public.complete_student_profile(
  p_date_of_birth date,
  p_school_name text,
  p_grade text,
  p_sat_score integer,
  p_gpa numeric,
  p_target_colleges text[],
  p_intended_majors text[],
  p_gpa_scale text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_student_id uuid := auth.uid();
  v_current_dob date;
begin
  if v_student_id is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if not exists (select 1 from profiles where id = v_student_id and role = 'student') then
    raise exception '학생 계정만 프로필을 완성할 수 있습니다.';
  end if;
  if not exists (select 1 from students where id = v_student_id) then
    raise exception '학생 데이터가 없습니다: %', v_student_id;
  end if;

  select date_of_birth into v_current_dob from profiles where id = v_student_id;
  if v_current_dob is null then
    if p_date_of_birth is null then
      raise exception '생년월일은 필수 항목입니다.';
    end if;
    update profiles set date_of_birth = p_date_of_birth where id = v_student_id;
  end if;

  if p_school_name is null or btrim(p_school_name) = '' then
    raise exception '학교명은 필수 항목입니다.';
  end if;
  if p_grade is null or btrim(p_grade) = '' then
    raise exception '학년은 필수 항목입니다.';
  end if;

  -- SAT: 입력값이 있으면 유효 범위(400~1600)만 허용.
  if p_sat_score is not null and (p_sat_score < 400 or p_sat_score > 1600) then
    raise exception 'SAT 점수는 400~1600 사이여야 합니다.';
  end if;

  -- 2026-09-06 추가: GPA는 음수일 수 없다(DB CHECK와 함께 서버에서도 명시적으로 거부).
  if p_gpa is not null and p_gpa < 0 then
    raise exception 'GPA는 0 이상이어야 합니다.';
  end if;

  -- GPA ↔ 척도: 값이 있으면 척도 필수, 척도만 있고 값이 없는 상태는 금지,
  -- 값은 선택한 척도의 만점을 초과할 수 없음(척도 텍스트 값=만점 숫자값).
  if p_gpa is not null and p_gpa_scale is null then
    raise exception 'GPA를 입력하려면 GPA 척도를 함께 선택해야 합니다.';
  end if;
  if p_gpa is null and p_gpa_scale is not null then
    raise exception 'GPA 척도만 선택하고 GPA 값이 없는 상태는 허용되지 않습니다.';
  end if;
  if p_gpa is not null and p_gpa_scale is not null and p_gpa > p_gpa_scale::numeric then
    raise exception 'GPA 값(%)이 선택한 척도(%)를 초과할 수 없습니다.', p_gpa, p_gpa_scale;
  end if;

  update students set
    school_name = btrim(p_school_name),
    grade = btrim(p_grade),
    sat_score = p_sat_score,
    gpa = p_gpa,
    gpa_scale = p_gpa_scale,
    target_colleges = coalesce(p_target_colleges, '{}'),
    intended_majors = coalesce(p_intended_majors, '{}'),
    profile_completed_at = now()
  where id = v_student_id;
end;
$$;
revoke execute on function public.complete_student_profile(date, text, text, integer, numeric, text[], text[], text) from public;
grant execute on function public.complete_student_profile(date, text, text, integer, numeric, text[], text[], text) to authenticated;
comment on function public.complete_student_profile(date, text, text, integer, numeric, text[], text[], text) is
  'M4 프로필 완성. 2026-09-06 추가 보강: GPA 음수 입력을 서버에서도 명시적으로 거부(DB
  CHECK와 이중 방어). 그 외 검증(생년월일 최초 1회, SAT 400~1600 범위, GPA↔척도 상호
  필수/배제, 척도 상한 초과 금지)은 기존과 동일.';
