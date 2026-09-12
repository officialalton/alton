-- M5-c(2026-09-06) — 재판정 대사(reconciliation) 작업의 오래된 작업 적용 차단.
--
-- 문제: session_judgment_reconciliation_tasks는 세션당 여러 건이 쌓일 수 있다(재판정이
-- 여러 번 반복되면 매번 새 작업이 생긴다). 지금까지는 오래된 pending 작업이 나중에
-- 그대로 반영될 수 있었다 — 그 사이 세션이 또 재판정됐다면 이미 사실과 다른 조정을
-- entitlement_ledger에 적용하게 된다.
--
-- 해결:
-- 1) status에 'superseded'(같은 세션에 새 재판정이 생겨 자동 대체됨)/'needs_review'
--    (반영 시점에 전제가 깨져 관리자 재검토 필요)를 추가한다.
-- 2) recomplete_session()이 새 대사 작업을 만들 때, 그 세션의 기존 pending 작업을 전부
--    superseded로 전환한다.
-- 3) resolve_session_reconciliation_task()는 반영 직전 세션의 실제 현재 상태(final_status/
--    payable_minutes)가 작업 생성 시점에 전제했던 값(new_final_status/new_payable_minutes)과
--    지금도 같은지 재확인한다. 다르면 적용하지 않고 그 작업을 needs_review로 전환한 뒤
--    예외를 던진다(관리자가 반영 전에 반드시 다시 확인해야 함).
-- 4) resolved/superseded/needs_review 상태의 작업은 전부 재반영을 거부한다(중복 반영뿐
--    아니라 뒤늦은 적용도 차단).

alter table session_judgment_reconciliation_tasks drop constraint session_judgment_reconciliation_tasks_status_check;
alter table session_judgment_reconciliation_tasks add constraint session_judgment_reconciliation_tasks_status_check
  check (status in ('pending', 'resolved', 'superseded', 'needs_review'));

comment on column session_judgment_reconciliation_tasks.status is
  '2026-09-06: pending(반영 대기)/resolved(반영 완료)/superseded(같은 세션에 새 재판정이 생겨
  자동 대체됨, 더 이상 반영 불가)/needs_review(반영 시점에 전제가 깨져 관리자 재검토 필요,
  더 이상 반영 불가) — resolved/superseded/needs_review는 전부 재반영이 거부된다.';

-- =========================================================================
-- recomplete_session() 확장 — 새 대사 작업 생성 시 그 세션의 기존 pending 작업을
-- superseded로 전환한다.
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

  -- ===== 요구사항: 오래된 pending 대사 작업은 새 재판정이 생기면 전부 superseded로 전환 =====
  perform set_config('app.bypass_reconciliation_task_lock', 'true', true);
  update session_judgment_reconciliation_tasks
    set status = 'superseded'
    where session_id = p_session_id and status = 'pending';

  -- ===== entitlement 대사 작업 자동 생성 =====
  v_reservation_id := v_session.reservation_id;
  select event_type into v_current_disposition from entitlement_ledger
    where reservation_id = v_reservation_id and event_type in ('consume', 'release')
    limit 1;
  v_expected_disposition := public.expected_entitlement_disposition_for_outcome(p_new_final_status);

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
  '2026-09-06 확장: 재판정 시 그 세션의 기존 pending 대사 작업을 전부 superseded로 전환한 뒤 새
  대사 작업을 생성한다(오래된 작업이 뒤늦게 반영되는 것을 방지). payable_minutes/정산 항목
  재계산 및 entitlement 대사 작업 자동 생성은 기존과 동일.';

-- =========================================================================
-- resolve_session_reconciliation_task() 확장 — 반영 직전 세션의 실제 현재 상태가 작업
-- 생성 시점의 전제와 지금도 같은지 재확인한다. 다르면 반영을 거부하고 needs_review로
-- 전환한다. resolved/superseded/needs_review는 전부 재반영을 거부한다.
-- =========================================================================
-- 반환 타입을 void→text로 바꾼다(needs_review 전환은 예외 없이 반환값으로 알린다) —
-- CREATE OR REPLACE는 반환 타입 변경을 허용하지 않으므로 기존 시그니처를 먼저 DROP한다.
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

  select * into v_session from sessions where id = v_task.session_id for update;

  -- 작업 생성 시점에 전제했던 세션 판정·entitlement 원장 상태가 지금도 같은지 재확인한다.
  -- 세션이 그 사이 또 재판정됐다면(정상적으로는 recomplete_session()이 이 작업을 이미
  -- superseded로 전환했겠지만, 방어적으로 한 번 더 검증한다) 적용하지 않고 needs_review로
  -- 전환한 뒤 정상 반환한다(예외를 던지면 이 UPDATE 자체가 트랜잭션과 함께 롤백돼버려
  -- 상태 전환이 저장되지 않으므로, 여기서는 예외 대신 반환값으로 결과를 알린다).
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
  '2026-09-06 확장: 반영 직전 세션의 실제 현재 상태(final_status/payable_minutes)가 작업 생성
  시점의 전제(new_final_status/new_payable_minutes)와 다르면 반영을 거부하고 작업을
  needs_review로 전환한다(오래된/전제가 깨진 작업의 뒤늦은 적용 방지). pending이 아닌 작업
  (resolved/superseded/needs_review)은 전부 재반영을 거부한다(멱등, 중복·뒤늦은 반영 방지).';
