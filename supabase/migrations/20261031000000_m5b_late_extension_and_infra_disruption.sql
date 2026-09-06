-- M5-b — R7: 선생님 지각 당일 연장/보충시간 생성, 선생님 사유 90분 미만 QC,
-- 회사·Meet 장애 미시작/중단 최종판정, 보충시간의 미래 예약 연결.
--
-- 재사용 원칙(스펙 원문): M5-a가 만든 finalize_lesson_session()/cancel_lesson_booking()/
-- upsert_session_payout_item()을 재사용·확장한다. 신규 테이블은 최소화한다.
-- - makeup_obligations/makeup_events/apply_makeup_time()/makeup_balances 뷰는 이미
--   R1(20260830060000)에서 v3_makeup_reason('teacher_late'/'teacher_partial_interruption'/
--   'company_meet_interruption')까지 포함해 전부 준비돼 있었다 — 이번에 새로 만들지 않고
--   그대로 쓴다(요구사항 2/6/8/9의 핵심 저장소).
-- - sessions.late_start_minutes/makeup_minutes_generated 컬럼도 R6(20260926000000)에서
--   이미 추가돼 있었으나 지금까지 아무 로직도 채우지 않았다 — 이번에 실제로 채운다.
-- - teacher_qc_warnings(R0 initial_schema)를 그대로 재사용해 90분 미만 QC 경고를 적재한다
--   (관리자 홈 대시보드 "QC 경고 현황" 위젯이 이미 이 테이블을 읽고 있다).
-- - 선생님 가능시간·겹침 검사는 R6의 is_teacher_slot_open()/violates_teacher_buffer()를
--   그대로 재사용한다(신규 로직 없음).
-- - 회사·Meet 장애로 "미시작"인 경우는 cancel_lesson_booking(..., 'company', ...)을 그대로
--   호출해 release/미소진/재예약 가능 상태를 만든다(M5-a가 이미 이 경로를 완성해뒀다).
--
-- 만료 정책(makeup_obligations 만료)은 Gate B §3.7 v4 원문 그대로 "미합의"이므로 이번에도
-- 만들지 않는다(요구사항 원문에 없음, CURRENT.md에 결정 필요로 남긴다).

-- =========================================================================
-- 0) 감사 이력 — 당일 지각 연장 합의(요구사항 1/9). append-only.
-- =========================================================================
create table session_late_extensions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id),
  late_minutes int not null check (late_minutes > 0),
  agreed_extend_minutes int not null check (agreed_extend_minutes >= 0 and agreed_extend_minutes <= late_minutes),
  makeup_owed_minutes int not null check (makeup_owed_minutes >= 0),
  makeup_obligation_id uuid references makeup_obligations (id),
  actor_profile_id uuid not null references profiles (id),
  reason text,
  created_at timestamptz not null default now(),
  check (makeup_owed_minutes = late_minutes - agreed_extend_minutes)
);
create index on session_late_extensions (session_id);

create or replace function public.reject_session_late_extension_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'session_late_extensions는 INSERT-only입니다.';
end;
$$;
create trigger session_late_extensions_no_update
  before update or delete on session_late_extensions
  for each row execute function public.reject_session_late_extension_mutation();
revoke execute on function public.reject_session_late_extension_mutation() from public, anon, authenticated, service_role;

alter table session_late_extensions enable row level security;
create policy "세션 당사자/관리자 조회" on session_late_extensions for select
  using (
    is_admin() or current_user_has_capability('QC권한')
    or exists (
      select 1 from sessions s where s.id = session_id and s.teacher_id = auth.uid()
    )
    or exists (
      select 1 from sessions s join subject_enrollments se on se.id = s.subject_enrollment_id
      where s.id = session_id
        and (se.child_id = auth.uid() or is_guardian_of(se.child_id) or is_household_guardian_of(se.child_id))
    )
  );
-- 직접 INSERT/UPDATE/DELETE 정책 없음(기본 거부) — resolve_teacher_lateness() SECURITY DEFINER만 기록.

-- =========================================================================
-- 1) 선생님 지각의 당일 상호 합의 연장(요구사항 1) + 미이행분 보충시간 생성(요구사항 2)
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
  if v_session.final_status <> 'live' then
    raise exception '진행 중(live)인 세션만 당일 연장할 수 있습니다(현재 상태: %).', v_session.final_status
      using errcode = 'P0001';
  end if;

  select * into v_reservation from reservations where id = v_session.reservation_id for update;

  if p_agreed_extend_minutes > 0 then
    v_new_ends := v_reservation.ends_at + (p_agreed_extend_minutes || ' minutes')::interval;

    -- 요구사항 7: 연장 구간이 선생님 가능시간·기존 예약과 겹치지 않는지 검사(기존
    -- is_teacher_slot_open/violates_teacher_buffer 재사용, 신규 로직 없음).
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
  'M5-b: 선생님 지각분을 당일 합의로 예정 종료 시각 뒤로 연장(가능한 만큼)하고, 못 채운
  분은 makeup_obligations(reason=teacher_late)로 이관한다. 연장 구간은 선생님 가능시간·
  기존 예약과 충돌 검사를 거친다.';

-- =========================================================================
-- 2) 회사·Meet 장애 최종판정(요구사항 4/5) — 관리자 수동 선택 전용.
-- =========================================================================
create or replace function public.finalize_session_as_infra_incident(
  p_session_id uuid,
  p_actor_id uuid,
  p_reason text,
  p_provided_minutes int default 0
) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_session sessions%rowtype;
  v_reservation reservations%rowtype;
  v_missing_minutes int;
  v_child_id uuid;
begin
  if p_provided_minutes < 0 then
    raise exception 'p_provided_minutes는 음수일 수 없습니다.' using errcode = 'P0001';
  end if;

  select * into v_session from sessions where id = p_session_id for update;
  if v_session.id is null then
    raise exception '세션을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;
  if v_session.final_status not in ('scheduled', 'live') then
    raise exception '이미 확정된 세션입니다(현재 상태: %).', v_session.final_status using errcode = 'P0001';
  end if;

  select * into v_reservation from reservations where id = v_session.reservation_id for update;

  if p_provided_minutes <= 0 then
    -- 요구사항 4: 미시작 — 수업권 hold 복원, 0분 정산, 예약 자체를 취소해 신규 예약
    -- 흐름을 열어준다. cancel_lesson_booking()의 'company' 경로를 그대로 재사용한다
    -- (release + 30일 미만 잔여 grant 연장 + reservation_cancellations 기록 + 세션이
    -- 'scheduled'면 함께 최종판정까지 전부 M5-a가 이미 구현).
    if v_reservation.status <> 'confirmed' then
      raise exception '확정된 예약만 회사·Meet 장애로 취소할 수 있습니다(현재 상태: %).', v_reservation.status
        using errcode = 'P0001';
    end if;
    perform public.cancel_lesson_booking(v_session.reservation_id, 'company', p_actor_id, p_reason);

    -- cancel_lesson_booking()은 세션이 'scheduled'일 때만 함께 최종판정한다. 이미 'live'로
    -- 표시된(예: 접속 시도는 있었으나 전혀 진행되지 못한) 세션은 여기서 직접 마무리한다.
    if v_session.final_status = 'live' then
      update sessions
        set final_status = 'company_cancelled',
            payable_minutes = 0,
            actual_end_at = coalesce(actual_end_at, now()),
            final_reason = p_reason,
            final_actor_id = p_actor_id,
            finalized_at = now()
        where id = p_session_id;

      insert into session_status_events (session_id, event_type, previous_final_status, new_final_status, actor_profile_id, reason)
      values (p_session_id, 'company_cancelled', 'live', 'company_cancelled', p_actor_id, p_reason);

      perform public.upsert_session_payout_item(p_session_id);
    end if;
    return;
  end if;

  -- 요구사항 5: 중단 — 이미 일부 제공됨. 수업권은 원래대로 소진(hold→consume), 정산은
  -- 실제 제공 분 기준이되 120분 상한, 못 제공한 분(=예약 시간-제공 시간)은 보충시간으로.
  perform consume_entitlement(v_session.reservation_id);

  v_missing_minutes := greatest(v_session.scheduled_duration_minutes - p_provided_minutes, 0);

  update sessions
    set final_status = 'interrupted',
        actual_end_at = coalesce(actual_end_at, now()),
        payable_minutes = least(p_provided_minutes, 120),
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
    values (p_session_id, v_child_id, v_session.teacher_id, v_missing_minutes, 'company_meet_interruption');
  end if;

  perform public.upsert_session_payout_item(p_session_id);
end;
$$;
revoke execute on function public.finalize_session_as_infra_incident(uuid, uuid, text, int) from public, anon, authenticated;
grant execute on function public.finalize_session_as_infra_incident(uuid, uuid, text, int) to service_role;

comment on function public.finalize_session_as_infra_incident(uuid, uuid, text, int) is
  'M5-b: 회사·Meet 장애는 자동 감지하지 않는다 — 관리자가 이 함수를 수동 호출해 최종판정한다.
  p_provided_minutes<=0이면 미시작(수업권 복원·0분 정산·재예약 가능), >0이면 중단(120분 정산
  상한 + 못 제공한 분 makeup_obligations 이관).';

-- =========================================================================
-- 3) 선생님 사유 최종 제공 90분 미만 자동 QC(요구사항 3)
--    finalize_lesson_session()에 선택 파라미터를 덧붙여 확장(기존 호출 하위호환 유지).
-- =========================================================================
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
    update sessions
      set final_status = p_outcome,
          actual_end_at = coalesce(actual_end_at, now()),
          payable_minutes = v_session.scheduled_duration_minutes,
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

  -- M5-b 요구사항 3: 선생님 사유(지각 등)로 최종 제공 시간이 90분 미만이면 정산은 예약
  -- 시간 그대로 지급하되(학생은 불이익 없음), teacher_qc_warnings에 경고만 남긴다.
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
  'M5-a 원본 + M5-b 확장(p_teacher_fault_provided_minutes): 선생님 사유로 실제 제공 시간이
  90분 미만이면 teacher_qc_warnings 경고를 남긴다(지급액 자체는 변경하지 않음).';

-- =========================================================================
-- 4) 보충시간을 미래 정규 수업 뒤에 연결(요구사항 6/7/8)
-- =========================================================================
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

  select * into v_obligation from makeup_obligations where id = p_obligation_id;
  if v_obligation.id is null then
    raise exception '유효하지 않은 보충시간 의무입니다.' using errcode = 'P0001';
  end if;
  if v_obligation.teacher_id <> v_reservation.owner_profile_id then
    raise exception '보충시간을 발생시킨 선생님의 예약에만 이어붙일 수 있습니다.' using errcode = 'P0001';
  end if;

  v_new_ends := v_reservation.ends_at + (p_minutes || ' minutes')::interval;

  -- 요구사항 7: 연장 구간이 선생님 가능시간·기존 예약과 충돌하지 않는지 검사(기존 로직 재사용).
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

  -- 요구사항 8: 보충시간 소비는 entitlement_ledger에 새 소진 이벤트를 만들지 않는다 — 이미
  -- 원래 지각/장애 세션에서 발생한 채무를 상환하는 것뿐이다. apply_makeup_time()은
  -- makeup_events(append-only, 이중적용 방지 유니크 인덱스 포함)에만 기록한다(R1 재사용).
  perform public.apply_makeup_time(p_obligation_id, v_session.id, p_minutes);
end;
$$;
revoke execute on function public.apply_makeup_time_to_booking(uuid, uuid, int, uuid) from public, anon, authenticated;
grant execute on function public.apply_makeup_time_to_booking(uuid, uuid, int, uuid) to service_role;

comment on function public.apply_makeup_time_to_booking(uuid, uuid, int, uuid) is
  'M5-b: 보충시간을 새 예약으로 만들지 않고 기존 미래 정규 예약 뒤에 이어붙인다(reservations.ends_at/
  sessions.scheduled_duration_minutes 연장). entitlement_ledger 신규 소진 이벤트 없음(요구사항 8) —
  apply_makeup_time()이 makeup_events에 이미 적용 이력을 append-only로 남긴다.';
