-- M5-c(2026-09-06) — student_cancelled 재판정 자동 판정 확대.
--
-- 지금까지: student_cancelled로 재판정되면 expected_entitlement_disposition=null로 두고
-- 조정 0으로 완료 처리될 수 있었다(24시간 기준 판정이 세션 판정만으로는 알 수 없어서).
--
-- 이번 확정 정책: 취소 기록(reservation_cancellations.cancelled_at)과 수업 시작 시각
-- (reservations.starts_at) 기준으로 24시간 이상 전이면 release, 24시간 미만이면 consume으로
-- 자동 계산한다(cancel_lesson_booking()의 기존 24시간 판정 로직과 동일 기준 재사용). 자동
-- 판정할 근거(취소 기록)가 없는 경우에만 관리자가 consume/release 중 하나를 명시적으로
-- 선택하고 사유를 입력해야 하며, 그 선택 전에는 대사 작업을 resolved 처리할 수 없다.

alter table session_judgment_reconciliation_tasks add column admin_disposition_reason text;
comment on column session_judgment_reconciliation_tasks.admin_disposition_reason is
  '2026-09-06: student_cancelled 재판정인데 취소 시각 기록이 없어 자동 판정이 불가능했던 경우,
  관리자가 set_reconciliation_task_student_cancelled_disposition()으로 consume/release를 직접
  선택하며 남긴 사유. 자동 판정된 경우는 null.';

-- =========================================================================
-- 1) 취소 기록 기반 자동 판정 헬퍼 — cancel_lesson_booking()의 24시간 기준과 동일.
--    취소 기록이 없으면(예: 아직 reservation_cancellations 행이 없는 상태로 재판정만 먼저
--    일어난 경우) null을 반환해 관리자 수동 선택이 필요함을 알린다.
-- =========================================================================
create or replace function public.expected_entitlement_disposition_for_student_cancelled(p_session_id uuid)
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_reservation_id uuid;
  v_starts_at timestamptz;
  v_cancelled_at timestamptz;
  v_hours_until numeric;
begin
  select reservation_id into v_reservation_id from sessions where id = p_session_id;
  if v_reservation_id is null then
    return null;
  end if;

  select starts_at into v_starts_at from reservations where id = v_reservation_id;

  select cancelled_at into v_cancelled_at from reservation_cancellations
    where reservation_id = v_reservation_id
    order by cancelled_at desc limit 1;

  if v_cancelled_at is null or v_starts_at is null then
    return null;
  end if;

  v_hours_until := extract(epoch from (v_starts_at - v_cancelled_at)) / 3600;
  if v_hours_until >= 24 then
    return 'release';
  else
    return 'consume';
  end if;
end;
$$;
revoke execute on function public.expected_entitlement_disposition_for_student_cancelled(uuid) from public, anon, authenticated;
grant execute on function public.expected_entitlement_disposition_for_student_cancelled(uuid) to service_role, authenticated;

comment on function public.expected_entitlement_disposition_for_student_cancelled(uuid) is
  '2026-09-06: student_cancelled 재판정의 entitlement disposition을 취소 기록(cancelled_at) 기준
  24시간 규칙으로 자동 계산한다(cancel_lesson_booking()과 동일 기준). 취소 기록이 없으면 null
  (관리자가 직접 선택해야 함).';

-- =========================================================================
-- 2) recomplete_session() 확장 — student_cancelled로 재판정될 때 위 자동 판정을 먼저
--    시도하고, 가능하면 그 결과로 즉시 조정량까지 계산한다(다른 outcome과 동일하게).
--    실패하면(취소 기록 없음) expected_entitlement_disposition=null로 남기고, 관리자가
--    set_reconciliation_task_student_cancelled_disposition()으로 나중에 채워야 한다.
-- =========================================================================
create or replace function public.recomplete_session(p_session_id uuid, p_new_final_status v3_session_final_status, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_prev v3_session_final_status;
  v_session sessions%rowtype;
  v_new_payable int;
  v_reservation_id uuid;
  v_current_disposition text;
  v_expected_disposition text;
  v_grant_id uuid;
  v_held_amount int;
  v_required_amount int;
  v_task_id uuid;
  v_paid_payout_item_id uuid;
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

  select previous_final_status into v_prev
    from session_status_events
    where session_id = p_session_id and event_type = 'reopened'
    order by occurred_at desc limit 1;

  v_new_payable := case
    when p_new_final_status in ('completed', 'student_no_show')
      then v_session.scheduled_duration_minutes - coalesce(v_session.late_start_minutes, 0)
    else 0
  end;

  update sessions
    set final_status = p_new_final_status,
        finalized_at = now(),
        payable_minutes = v_new_payable
    where id = p_session_id;

  insert into session_status_events (session_id, event_type, previous_final_status, new_final_status, actor_profile_id, reason)
  values (p_session_id, 'recompleted', v_prev, p_new_final_status, auth.uid(), p_reason);

  select id into v_paid_payout_item_id from payout_items where session_id = p_session_id and status = 'paid';

  perform public.upsert_session_payout_item(p_session_id);

  perform set_config('app.bypass_reconciliation_task_lock', 'true', true);
  update session_judgment_reconciliation_tasks
    set status = 'superseded'
    where session_id = p_session_id and status = 'pending';

  -- ===== entitlement 대사 작업 자동 생성 =====
  v_reservation_id := v_session.reservation_id;
  select event_type into v_current_disposition from entitlement_ledger
    where reservation_id = v_reservation_id and event_type in ('consume', 'release')
    limit 1;

  -- 2026-09-06: student_cancelled는 일반 매핑(항상 null)이 아니라 취소 기록 기반 24시간
  -- 자동 판정을 먼저 시도한다. 그 외 outcome은 기존 고정 매핑을 그대로 쓴다.
  if p_new_final_status = 'student_cancelled' then
    v_expected_disposition := public.expected_entitlement_disposition_for_student_cancelled(p_session_id);
  else
    v_expected_disposition := public.expected_entitlement_disposition_for_outcome(p_new_final_status);
  end if;

  select grant_id into v_grant_id from entitlement_ledger
    where reservation_id = v_reservation_id and event_type = 'hold';
  if v_grant_id is not null then
    select abs(amount) into v_held_amount from entitlement_ledger
      where reservation_id = v_reservation_id and event_type = 'hold';
  end if;

  v_required_amount := 0;
  if v_expected_disposition is not null and v_current_disposition is distinct from v_expected_disposition and v_grant_id is not null then
    if v_current_disposition = 'consume' and v_expected_disposition = 'release' then
      v_required_amount := v_held_amount;
    elsif v_current_disposition = 'release' and v_expected_disposition = 'consume' then
      v_required_amount := -v_held_amount;
    end if;
  end if;

  insert into session_judgment_reconciliation_tasks (
    session_id, prior_final_status, new_final_status, prior_payable_minutes, new_payable_minutes,
    current_entitlement_disposition, expected_entitlement_disposition, entitlement_grant_id,
    required_entitlement_adjustment_amount, reason
  ) values (
    p_session_id, v_prev, p_new_final_status, v_session.payable_minutes, v_new_payable,
    v_current_disposition, v_expected_disposition, v_grant_id, v_required_amount, p_reason
  ) returning id into v_task_id;

  if v_paid_payout_item_id is not null then
    update payout_items set superseded_by_reconciliation_task_id = v_task_id where id = v_paid_payout_item_id;
  end if;
end;
$$;
revoke execute on function public.recomplete_session(uuid, v3_session_final_status, text) from public, anon, authenticated, service_role;
grant execute on function public.recomplete_session(uuid, v3_session_final_status, text) to authenticated;

comment on function public.recomplete_session(uuid, v3_session_final_status, text) is
  '2026-09-06 확장: student_cancelled로 재판정될 때는 취소 기록(cancelled_at) 기준 24시간
  규칙으로 entitlement disposition을 자동 계산한다(취소 기록이 없으면 null로 남아 관리자
  수동 선택이 필요). 그 외는 기존과 동일 — 재판정 시 이전 pending 작업을 superseded로
  전환하고 새 대사 작업을 생성한다.';

-- =========================================================================
-- 3) 관리자 수동 선택 — 자동 판정 근거(취소 기록)가 없는 student_cancelled 작업에만
--    허용된다. 이미 자동 판정됐거나(expected_entitlement_disposition not null) 이미
--    resolved/superseded/needs_review인 작업에는 사용할 수 없다.
-- =========================================================================
create or replace function public.set_reconciliation_task_student_cancelled_disposition(
  p_task_id uuid,
  p_disposition text,
  p_reason text
) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_task session_judgment_reconciliation_tasks%rowtype;
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

  v_required_amount := 0;
  if v_task.entitlement_grant_id is not null then
    select abs(amount) into v_held_amount from entitlement_ledger
      where grant_id = v_task.entitlement_grant_id and event_type = 'hold';
    if v_task.current_entitlement_disposition is distinct from p_disposition then
      if v_task.current_entitlement_disposition = 'consume' and p_disposition = 'release' then
        v_required_amount := v_held_amount;
      elsif v_task.current_entitlement_disposition = 'release' and p_disposition = 'consume' then
        v_required_amount := -v_held_amount;
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
  '2026-09-06: student_cancelled 재판정인데 취소 기록이 없어 자동 판정이 불가능했던 대사 작업에,
  관리자가 consume/release를 직접 선택하고 사유를 남긴다. 이 선택 없이는
  resolve_session_reconciliation_task()가 반영을 거부한다.';

-- =========================================================================
-- 4) resolve_session_reconciliation_task() 확장 — student_cancelled 작업인데
--    expected_entitlement_disposition이 아직 null(자동 판정 불가 + 관리자 미선택)이면
--    반영을 거부한다.
-- =========================================================================
drop function if exists public.resolve_session_reconciliation_task(uuid, text);

create or replace function public.resolve_session_reconciliation_task(p_task_id uuid, p_reason text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_task session_judgment_reconciliation_tasks%rowtype;
  v_session sessions%rowtype;
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

  -- 2026-09-06: student_cancelled 작업은 관리자가 consume/release를 선택하기 전에는
  -- (자동 판정도 없고 수동 선택도 없어 expected_entitlement_disposition이 null이면) 반영할 수 없다.
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
  '2026-09-06 확장: student_cancelled 작업은 expected_entitlement_disposition이 정해지기
  전에는(자동 판정 실패 + 관리자 미선택) 반영을 거부한다. 그 외 검증(전제 재확인,
  resolved/superseded/needs_review 재반영 차단)은 기존과 동일.';
