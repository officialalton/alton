-- M5-a — R7 판정 규칙 코어: 수업 상태 전이(scheduled→live→완료 계열), 취소·노쇼·지각의
-- 4대 규칙 최종판정, payable_minutes, 완료 시 정산 항목(payout_items) 단일 트랜잭션 적재.
--
-- 재사용 원칙(스펙 원문): 새 테이블을 최소화하고 R1/R6가 이미 만든 것을 확장한다.
-- - v3_session_final_status/v3_session_status_event_type enum은 R1에서 이미
--   'student_cancelled'/'teacher_cancelled'/'company_cancelled'/'student_no_show'/
--   'teacher_no_show'/'interrupted'/'completed'를 전부 갖고 있다 — 신규 값 불필요.
-- - sessions.payable_minutes/actual_start_at/actual_end_at/final_reason/final_actor_id는
--   R1부터 이미 컬럼으로 존재한다 — 신규 컬럼 불필요.
-- - session_access_events는 이미 세션당 다건의 meet_join/meet_leave/alton_page_open/
--   alton_page_close를 source별로 저장할 수 있다 — 스키마 변경 불필요.
-- - reopen_session()/recomplete_session()이 이미 완료 취소·재개방의 append-only
--   역이력(session_status_events)을 제공한다 — task #11은 이 함수들을 정산 재계산까지
--   포함하도록 확장하는 것으로 충분하다(재구현하지 않음).
--
-- 4대 규칙(마스터 로드맵 R7/M5-a 원문):
-- (a) 시작 24시간 전까지 일반 취소 → release, 미소진, payable_minutes=0.
-- (b) 24시간 미만 학생 취소 → consume, payable_minutes=예약 시간(생성 세션 duration).
-- (c) 시작 후 15분 학생 미접속·최종 노쇼 확인 → consume, payable_minutes=예약 시간.
-- (d) 학생 지각(결국 참석) → 예정 종료 유지, consume, payable_minutes=예약 시간,
--     보충시간 미생성 — 이는 outcome='completed'와 회계상 동일하므로 별도 분기 불필요
--     (지각 자체는 session_incident_reports에 이미 별도로 신고되고, 보충시간 로직
--     자체가 M5-b 범위라 이 함수는 아무 특별 취급도 하지 않는다).
--
-- (a)/(b)는 예약 취소(수업 시작 전, 세션이 아직 'scheduled')이므로 cancel_lesson_booking()을
-- 확장해 처리한다. (c)/(d) + 정상 완료 + 선생님 노쇼는 신규 finalize_lesson_session()으로
-- 처리한다. 두 경로 모두 "선생님 실지급 대상 정산 항목"을 payout_items에 단일 트랜잭션으로
-- 적재한다(payout_items 테이블 코멘트에 이미 "session_id는 세션 완료 트랜잭션에서 생성"이라고
-- 명시돼 있었음 — R1부터 예정된 구조, 실제 채우는 로직만 이번에 추가).
--
-- Meet 실접속시간은 정산 계산에서 절대 쓰지 않는다(session_access_events의
-- source='google_meet_api' 행은 증거 열람용일 뿐, payable_minutes 계산식 어디에도
-- 참조되지 않는다 — 아래 함수 본문과 회귀 테스트로 고정).

-- =========================================================================
-- 0) 공용 헬퍼 — item_type 판정(체험/정규 경계, 요구사항 12)
-- =========================================================================
create or replace function public.session_payout_item_type(p_lesson_type_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select case when lt.code = 'trial' then 'trial' else 'regular' end
  from lesson_types lt where lt.id = p_lesson_type_id;
$$;
revoke execute on function public.session_payout_item_type(uuid) from public, anon, authenticated;
grant execute on function public.session_payout_item_type(uuid) to service_role;

-- 세션에 대한 pending 정산 항목을 만들거나(없으면) 갱신한다(있으면, paid 이전이므로 직접
-- UPDATE 허용 — payout_items_prevent_paid_mutation 트리거가 paid 이후만 차단한다).
-- payable_minutes<=0이면 정산 항목을 만들지 않는다(선생님 귀책·회사귀책 취소는 지급 없음).
create or replace function public.upsert_session_payout_item(p_session_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_session sessions%rowtype;
  v_existing_id uuid;
  v_amount_minor bigint;
  v_item_type text;
begin
  select * into v_session from sessions where id = p_session_id;
  if v_session.id is null then
    raise exception '세션을 찾을 수 없습니다: %', p_session_id;
  end if;

  select id into v_existing_id from payout_items where session_id = p_session_id;

  if coalesce(v_session.payable_minutes, 0) <= 0 then
    -- 지급 대상이 아니게 됐다(예: 관리자가 재판정으로 무지급 사유로 바꿈) — 이미 paid된
    -- 항목은 손대지 않는다(트리거가 차단), 그 외(pending)에는 기존 정산 항목을 그냥
    -- 삭제한다(paid 전에는 이 항목이 감사상 의미 있는 확정 사실이 아니었으므로).
    if v_existing_id is not null then
      delete from payout_items where id = v_existing_id and status <> 'paid';
    end if;
    return;
  end if;

  v_item_type := public.session_payout_item_type(v_session.lesson_type_id);
  v_amount_minor := round(v_session.hourly_rate_snapshot_minor * v_session.payable_minutes / 60.0);

  if v_existing_id is not null then
    update payout_items
      set payable_minutes = v_session.payable_minutes,
          amount_minor = v_amount_minor,
          hourly_rate_snapshot_minor = v_session.hourly_rate_snapshot_minor,
          currency = v_session.hourly_rate_snapshot_currency,
          item_type = v_item_type
      where id = v_existing_id and status <> 'paid';
  else
    insert into payout_items (
      session_id, teacher_id, item_type, hourly_rate_snapshot_minor, currency, payable_minutes, amount_minor, status
    ) values (
      p_session_id, v_session.teacher_id, v_item_type, v_session.hourly_rate_snapshot_minor,
      v_session.hourly_rate_snapshot_currency, v_session.payable_minutes, v_amount_minor, 'pending'
    );
  end if;
end;
$$;
revoke execute on function public.upsert_session_payout_item(uuid) from public, anon, authenticated;
grant execute on function public.upsert_session_payout_item(uuid) to service_role;

-- =========================================================================
-- 1) 수업 시작 — draft/scheduled → live
-- =========================================================================
create or replace function public.mark_lesson_session_started(p_session_id uuid, p_actor_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_session sessions%rowtype;
  v_reservation reservations%rowtype;
begin
  select * into v_session from sessions where id = p_session_id for update;
  if v_session.id is null then
    raise exception '세션을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;
  if v_session.final_status <> 'scheduled' then
    raise exception '이미 시작됐거나 종료된 세션입니다(현재 상태: %).', v_session.final_status using errcode = 'P0001';
  end if;

  select * into v_reservation from reservations where id = v_session.reservation_id;
  if v_reservation.status <> 'confirmed' then
    raise exception '확정된 예약의 세션만 시작할 수 있습니다.' using errcode = 'P0001';
  end if;

  update sessions
    set final_status = 'live', actual_start_at = coalesce(actual_start_at, now())
    where id = p_session_id;

  -- v3_session_status_event_type에는 "시작" 전용 값이 없다(스펙상 취소/완료류 전이만
  -- 이력 대상) — 실제 시작 시각 자체가 actual_start_at 컬럼에 남으므로 별도 이벤트를
  -- 새로 만들지 않는다(불필요한 enum 확장을 피한다).
end;
$$;
revoke execute on function public.mark_lesson_session_started(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mark_lesson_session_started(uuid, uuid) to service_role;

-- =========================================================================
-- 2) 최종 판정 — 15분 노쇼 확정 / 학생 지각 후 참석 / 정상 완료 / 선생님 노쇼
--    (규칙 (c)(d) + 정상 완료 + 선생님 노쇼, 하나의 함수로 통합)
-- =========================================================================
create or replace function public.finalize_lesson_session(
  p_session_id uuid,
  p_outcome v3_session_final_status,
  p_actor_id uuid,
  p_reason text
) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_session sessions%rowtype;
  v_reservation reservations%rowtype;
  v_grant_id uuid;
  v_current_expires_at timestamptz;
  v_min_expires_at timestamptz;
begin
  if p_outcome not in ('completed', 'student_no_show', 'teacher_no_show') then
    raise exception '이 함수는 completed/student_no_show/teacher_no_show만 처리합니다(중단·장애 판정은 M5-b 범위).' using errcode = 'P0001';
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

  -- 규칙 (c)/(d)/정상 완료: 학생 귀책 없음 또는 학생 최종 노쇼 확정 — 전부 1장 소진 +
  -- 예약 시간(=scheduled_duration_minutes) 지급, 보충시간은 생성하지 않는다(M5-b 범위 밖).
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

  -- 선생님 노쇼: 학생 귀책 없음 — release + 지급 없음. 선생님 귀책 취소와 동일하게
  -- 만료 30일 미만 잔여 grant는 30일로 연장한다(cancel_lesson_booking의 기존 로직 재사용).
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

  -- 완료 시 진도·수업권·정산 항목 단일 트랜잭션(요구사항 10) — 진도 관련 필드
  -- (material_version_id 등)는 R9 범위라 손대지 않고 자리만 존중한다.
  perform public.upsert_session_payout_item(p_session_id);
end;
$$;
revoke execute on function public.finalize_lesson_session(uuid, v3_session_final_status, uuid, text) from public, anon, authenticated;
grant execute on function public.finalize_lesson_session(uuid, v3_session_final_status, uuid, text) to service_role;

-- =========================================================================
-- 3) cancel_lesson_booking() 확장 — 규칙 (a)/(b): 예약 취소 시 연결된 세션도 함께
--    최종판정한다(기존 24h release/consume 로직은 그대로 재사용, 새로 만들지 않음).
-- =========================================================================
create or replace function public.cancel_lesson_booking(
  p_reservation_id uuid,
  p_cancelled_by_role text,
  p_cancelled_by_id uuid,
  p_reason text
) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_reservation reservations%rowtype;
  v_session sessions%rowtype;
  v_hours_until numeric;
  v_grant_id uuid;
  v_current_expires_at timestamptz;
  v_min_expires_at timestamptz;
  v_disposition text;
  v_final_status v3_session_final_status;
begin
  if p_cancelled_by_role not in ('student', 'teacher', 'company') then
    raise exception '알 수 없는 취소 주체입니다: %', p_cancelled_by_role using errcode = 'P0001';
  end if;

  select * into v_reservation from reservations where id = p_reservation_id for update;
  if v_reservation.id is null then
    raise exception '예약을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;
  if v_reservation.status <> 'confirmed' then
    raise exception '확정된 예약만 취소할 수 있습니다(현재 상태: %).', v_reservation.status using errcode = 'P0001';
  end if;

  v_hours_until := extract(epoch from (v_reservation.starts_at - now())) / 3600;

  -- 예약을 먼저 cancelled로 전환(덮어쓰지 않음 — 이 행 자체가 취소 이력이 된다).
  update reservations set status = 'cancelled' where id = p_reservation_id;

  if p_cancelled_by_role = 'student' and v_hours_until < 24 then
    perform consume_entitlement(p_reservation_id);
    v_disposition := 'consumed';
    v_final_status := 'student_cancelled';
  else
    perform release_entitlement(p_reservation_id);
    v_disposition := 'released';
    v_final_status := case p_cancelled_by_role
      when 'student' then 'student_cancelled'
      when 'teacher' then 'teacher_cancelled'
      else 'company_cancelled'
    end;

    if p_cancelled_by_role in ('teacher', 'company') then
      select grant_id into v_grant_id from entitlement_ledger
        where reservation_id = p_reservation_id and event_type = 'release';
      if v_grant_id is not null then
        select expires_at into v_current_expires_at from entitlement_grants where id = v_grant_id;
        v_min_expires_at := now() + interval '30 days';
        if v_current_expires_at < v_min_expires_at then
          perform extend_entitlement(v_grant_id, v_min_expires_at, 'r6_teacher_or_company_cancel:' || p_reservation_id);
        end if;
      end if;
    end if;
  end if;

  insert into reservation_cancellations (reservation_id, cancelled_by_role, cancelled_by_id, reason, entitlement_disposition)
  values (p_reservation_id, p_cancelled_by_role, p_cancelled_by_id, p_reason, v_disposition);

  -- M5-a 신규: kind='lesson' 예약이면 연결된 세션도 최종판정한다. 세션이 아직
  -- 'scheduled'일 때만(수업이 이미 시작·완료됐으면 이 취소 경로 대상이 아니다 —
  -- 그 경우는 finalize_lesson_session()/recomplete_session()의 영역).
  if v_reservation.kind = 'lesson' then
    select * into v_session from sessions where reservation_id = p_reservation_id for update;
    if v_session.id is not null and v_session.final_status = 'scheduled' then
      update sessions
        set final_status = v_final_status,
            payable_minutes = case when v_disposition = 'consumed' then v_session.scheduled_duration_minutes else 0 end,
            final_reason = p_reason,
            final_actor_id = p_cancelled_by_id,
            finalized_at = now()
        where id = v_session.id;

      insert into session_status_events (session_id, event_type, previous_final_status, new_final_status, actor_profile_id, reason)
      values (v_session.id, v_final_status::text::v3_session_status_event_type, 'scheduled', v_final_status, p_cancelled_by_id, p_reason);

      perform public.upsert_session_payout_item(v_session.id);
    end if;
  end if;
end;
$$;

revoke execute on function public.cancel_lesson_booking(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_lesson_booking(uuid, text, uuid, text) to service_role;

-- =========================================================================
-- 4) 완료 취소/재개방(요구사항 11) — reopen_session()/recomplete_session()은 이미
--    append-only 역이력을 제공한다(R1). recomplete_session()만 재판정 시 payable_minutes/
--    정산 항목을 함께 재계산하도록 확장한다(엔타이틀먼트 원장은 reservation-tied
--    이벤트(hold/consume/release)를 예약당 1건으로 제한하는 기존 유니크 인덱스
--    설계상 자동 역전이 불가능하다 — disposition 자체가 바뀌는 재판정은 기존 R4
--    관리자 조정 화면(EntitlementLedgerTab.tsx의 "조정")으로 수동 처리한다).
-- =========================================================================
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

  -- M5-a 확장: payable_minutes를 새 최종 상태 기준으로 재계산한다(정산 항목도 함께
  -- 갱신 — paid 이전이면 upsert_session_payout_item()이 직접 UPDATE, paid 이후면
  -- 트리거가 보호하므로 변경되지 않는다).
  update sessions
    set final_status = p_new_final_status,
        finalized_at = now(),
        payable_minutes = case
          when p_new_final_status in ('completed', 'student_no_show') then v_session.scheduled_duration_minutes
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

comment on function public.finalize_lesson_session(uuid, v3_session_final_status, uuid, text) is
  'M5-a: 15분 노쇼 최종확정/학생 지각 후 참석/정상 완료/선생님 노쇼를 하나의 함수로 통합 판정. '
  'payable_minutes는 예약 시간(scheduled_duration_minutes) 기준으로만 계산되고 session_access_events의 '
  'google_meet_api 실접속시간은 절대 참조하지 않는다(정산 계산에서 Meet 실접속시간 제외 — 요구사항 8).';
comment on function public.upsert_session_payout_item(uuid) is
  'M5-a: sessions.payable_minutes/hourly_rate_snapshot_*를 정산 항목(payout_items)에 반영. '
  'session_access_events는 참조하지 않는다(접속기록≠정산근거, 요구사항 5/8).';
