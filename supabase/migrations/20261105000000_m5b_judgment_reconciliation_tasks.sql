-- M5-b 후속(2026-09-05, 제품 오너 지시) — 잘못된 최종판정 정정(reopen_session()→
-- recomplete_session()) 시 entitlement_ledger(수업권 소진/해제) 자동 대사(reconciliation) 작업.
--
-- 지금까지: recomplete_session()은 payable_minutes/정산 항목(payout_items)은 재계산하지만
-- entitlement_ledger는 손대지 않는다(M5-a 코멘트에 이미 문서화됨 — 예약당 이벤트 타입 1건
-- 제약(entitlement_ledger_reservation_dedup)상 자동 역전이 불가능해 관리자가 EntitlementLedgerTab
-- 에서 수동으로 adjust_entitlement()를 호출해야 했다). 이번에 그 "무엇을 고쳐야 하는지"를
-- 자동으로 계산해 필수 작업으로 적재하고, 관리자가 한 번에 반영할 수 있는 함수를 추가한다
-- (여전히 entitlement_ledger 자체의 반대 이벤트를 자동 삽입하지는 않는다 — adjust_entitlement()
-- 가 이미 감사 가능한 "정정" 이벤트 타입을 갖고 있으므로 그것을 재사용한다).
--
-- 지급액 재계산(payout_items)은 이미 recomplete_session()이 처리한다. 다만 이미 paid된
-- 정산 항목은 payout_items_prevent_paid_mutation 트리거가 보호해 금액이 바뀌지 않는다 —
-- 그 경우 "역분개가 필요하다"는 표시만 남기고(superseded_by_reconciliation_task_id), 실제
-- 역분개 로직 자체는 R10 범위로 남긴다(요구사항 원문).

-- =========================================================================
-- 0) payout_items에 "이 항목이 이후 재판정으로 대체 대상이 됐다" 표시 컬럼 추가.
-- =========================================================================
alter table payout_items add column superseded_by_reconciliation_task_id uuid;

comment on column payout_items.superseded_by_reconciliation_task_id is
  '2026-09-05: 재판정으로 이 정산 항목의 금액이 더 이상 맞지 않게 됐음을 표시만 한다(이미 paid된
  항목은 즉시 덮어쓰지 않음). 실제 역분개는 R10 범위 — 이 컬럼은 그 역분개 대상 표시용.';

-- 기존 payout_items_prevent_paid_mutation 트리거는 paid 이후 어떤 컬럼 변경도 막는다 — 이
-- 표시 컬럼 하나만은 예외로 허용한다(금액/상태 등 다른 컬럼은 여전히 완전 불변).
create or replace function public.prevent_paid_item_mutation()
returns trigger
language plpgsql as $$
declare
  v_new_without_marker payout_items;
begin
  if old.status = 'paid' then
    v_new_without_marker := new;
    v_new_without_marker.superseded_by_reconciliation_task_id := old.superseded_by_reconciliation_task_id;
    if v_new_without_marker is distinct from old then
      raise exception 'paid 상태의 payout_item은 수정할 수 없습니다. adjustment/reversal item을 추가하세요.';
    end if;
  end if;
  return new;
end;
$$;
comment on function public.prevent_paid_item_mutation() is
  '2026-09-05 확장: paid 이후에도 superseded_by_reconciliation_task_id 표시 컬럼만은 예외로 UPDATE를
  허용한다(재판정으로 역분개가 필요하다는 표시일 뿐 금액 자체는 여전히 불변).';

-- =========================================================================
-- 1) 재판정 대사 작업 테이블.
-- =========================================================================
create table session_judgment_reconciliation_tasks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id),
  prior_final_status v3_session_final_status not null,
  new_final_status v3_session_final_status not null,
  prior_payable_minutes int,
  new_payable_minutes int,
  -- 현재 entitlement_ledger상 disposition('consume'|'release'|null=아직 확인 불가)과, 새 판정
  -- 기준으로 있어야 할 disposition, 필요한 조정(grant_id/조정량)을 함께 저장한다. 조정량이
  -- 필요 없으면(현재/기대가 같으면) required_amount=0.
  current_entitlement_disposition text,
  expected_entitlement_disposition text,
  entitlement_grant_id uuid references entitlement_grants (id),
  required_entitlement_adjustment_amount int not null default 0,
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles (id),
  reason text
);
create index on session_judgment_reconciliation_tasks (session_id);
create index on session_judgment_reconciliation_tasks (status);

alter table session_judgment_reconciliation_tasks enable row level security;
create policy "관리자만 조회" on session_judgment_reconciliation_tasks for select
  using (is_admin() or current_user_has_capability('예약관리권한'));
-- 직접 INSERT/UPDATE 정책 없음(기본 거부) — recomplete_session()/resolve_session_reconciliation_task()
-- SECURITY DEFINER만 기록/갱신한다.

create or replace function public.reject_reconciliation_task_direct_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'session_judgment_reconciliation_tasks는 resolve_session_reconciliation_task()를 통해서만 갱신할 수 있습니다.';
end;
$$;
-- resolve_session_reconciliation_task()가 내부에서 이 우회 설정을 켜고 UPDATE한다(reopen_session
-- 패턴과 동일한 app.bypass_* 관례 재사용).
create or replace function public.reconciliation_task_update_guard()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('app.bypass_reconciliation_task_lock', true), 'false') = 'true' then
    return new;
  end if;
  raise exception 'session_judgment_reconciliation_tasks는 resolve_session_reconciliation_task()를 통해서만 갱신할 수 있습니다.';
end;
$$;
create trigger reconciliation_tasks_no_direct_update
  before update on session_judgment_reconciliation_tasks
  for each row execute function public.reconciliation_task_update_guard();
create trigger reconciliation_tasks_no_delete
  before delete on session_judgment_reconciliation_tasks
  for each row execute function public.reject_reconciliation_task_direct_mutation();
revoke execute on function public.reconciliation_task_update_guard() from public, anon, authenticated, service_role;
revoke execute on function public.reject_reconciliation_task_direct_mutation() from public, anon, authenticated, service_role;

-- =========================================================================
-- 2) 판정별 "있어야 할" entitlement disposition 매핑(모호한 경우 null — 관리자 확인 필요).
-- =========================================================================
create or replace function public.expected_entitlement_disposition_for_outcome(p_outcome v3_session_final_status)
returns text
language sql immutable as $$
  select case p_outcome
    when 'completed' then 'consume'
    when 'student_no_show' then 'consume'
    when 'interrupted' then 'consume'
    when 'teacher_no_show' then 'release'
    when 'teacher_cancelled' then 'release'
    when 'company_cancelled' then 'release'
    -- student_cancelled는 24시간 기준에 따라 release/consume이 갈려 이 세션 판정만으로는
    -- 알 수 없다 — 관리자가 직접 확인해야 하므로 null로 남긴다.
    else null
  end;
$$;
revoke execute on function public.expected_entitlement_disposition_for_outcome(v3_session_final_status) from public, anon, authenticated;
grant execute on function public.expected_entitlement_disposition_for_outcome(v3_session_final_status) to service_role, authenticated;

-- =========================================================================
-- 3) recomplete_session() 확장 — 재판정 시 대사 작업을 자동 생성한다.
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

  -- 재판정 직전(reopen 전) 실제로 확정됐던 상태 — session_status_events의 'reopened' 이벤트가
  -- previous_final_status로 이미 기록해뒀다(reopen_session() 참고).
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

  -- paid 정산 항목은 upsert_session_payout_item()이 건드리지 않는다 — 재판정으로 금액이
  -- 실제로 달라진다면(paid 상태 그대로) 역분개 대상 표시만 남긴다(R10 범위, 요구사항 원문).
  select id into v_paid_payout_item_id from payout_items where session_id = p_session_id and status = 'paid';

  perform public.upsert_session_payout_item(p_session_id);

  -- ===== 요구사항 3: entitlement 대사 작업 자동 생성 =====
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
      -- 이미 소진 처리됐지만 실제로는 해제(release)됐어야 한다 — 수업권을 되돌려줘야 하므로 +.
      v_required_amount := v_held_amount;
    elsif v_current_disposition = 'release' and v_expected_disposition = 'consume' then
      -- 이미 해제(복원)됐지만 실제로는 소진됐어야 한다 — 다시 차감해야 하므로 -.
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
  '2026-09-05 확장: 재판정 시 payable_minutes/정산 항목 재계산에 더해
  session_judgment_reconciliation_tasks에 필수 대사 작업을 자동 생성한다(entitlement disposition이
  실제로 바뀌어야 하는 경우 required_entitlement_adjustment_amount에 조정량을 계산해 저장 — 0이면
  조정 불필요). 이미 paid된 정산 항목은 payout_items.superseded_by_reconciliation_task_id로 표시만
  한다(금액 자체는 R10 역분개 범위).';

-- =========================================================================
-- 4) 대사 작업 반영 — adjust_entitlement() 재사용, 멱등(resolved 재반영 불가).
-- =========================================================================
create or replace function public.resolve_session_reconciliation_task(p_task_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_task session_judgment_reconciliation_tasks%rowtype;
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
end;
$$;
revoke execute on function public.resolve_session_reconciliation_task(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.resolve_session_reconciliation_task(uuid, text) to authenticated;

comment on function public.resolve_session_reconciliation_task(uuid, text) is
  '2026-09-05: 관리자가 재판정 대사 작업을 한 번에 반영한다. required_entitlement_adjustment_amount가
  0이 아니면 adjust_entitlement()로 실제 entitlement_ledger 조정을 남긴다. status=resolved인 작업은
  다시 반영할 수 없다(멱등, 중복 반영 방지).';
