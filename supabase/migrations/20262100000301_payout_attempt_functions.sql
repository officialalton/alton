-- Mercury 지급 통합 2/3 — 시도 생성·승인·전이·증빙·반환·재송금 함수(2026-10-07).
-- 전부 service_role(서버 액션)에서만 호출한다. 실제 외부 호출 없음. "현실 세계" 전이(요청·처리·송금)는
-- real_disbursement_enabled() 게이트가 열려 있어야 한다(기본 닫힘).

create or replace function public.payout_actor_can(p_actor uuid, p_capability text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_actor is not null and (
    exists (select 1 from profiles where id = p_actor and role = 'admin' and admin_tier = 'master')
    or exists (select 1 from supervisor_capabilities where profile_id = p_actor and capability = p_capability)
  )
$$;

create or replace function public.payout_attempt_log(
  p_attempt uuid, p_event text, p_from text, p_to text, p_actor uuid, p_detail jsonb default '{}'::jsonb
) returns void language sql as $$
  insert into payout_attempt_events (attempt_id, event_type, from_status, to_status, actor_id, detail)
  values (p_attempt, p_event, p_from, p_to, p_actor, coalesce(p_detail, '{}'::jsonb));
$$;

create or replace function public.payout_attempt_add_flag(p_attempt uuid, p_flag text)
returns void language sql as $$
  update payout_attempts
    set needs_review_reasons = case when p_flag = any(needs_review_reasons) then needs_review_reasons
                                    else array_append(needs_review_reasons, p_flag) end,
        updated_at = now()
    where id = p_attempt;
$$;

-- ───────────────────────── 생성 ─────────────────────────
create or replace function public.create_payout_attempt(
  p_batch_id uuid,
  p_consultant_period_id uuid,
  p_kind text default 'normal',
  p_original_attempt_id uuid default null,
  p_actor uuid default null,
  p_provider text default 'mercury',
  p_top_up_amount_minor bigint default null
) returns uuid language plpgsql as $$
declare
  v_existing uuid;
  v_recipient uuid; v_kind text; v_currency text; v_amount bigint;
  v_start date; v_end date; v_deadline date; v_transfer date;
  v_rail text; v_manual boolean; v_no int; v_id uuid; v_link uuid;
  v_orig payout_attempts%rowtype;
  v_batch payout_batches%rowtype; v_period consultant_payout_periods%rowtype;
begin
  if (p_batch_id is null) = (p_consultant_period_id is null) then
    raise exception '정산 묶음(batch) 또는 컨설턴트 기간 중 정확히 하나를 지정해야 합니다.';
  end if;
  if p_provider not in ('wise', 'mercury', 'manual') then
    raise exception 'provider는 wise|mercury|manual만 허용됩니다: %', p_provider;
  end if;
  if p_kind not in ('normal', 'resend', 'top_up') then
    raise exception 'kind는 normal|resend|top_up만 허용됩니다: %', p_kind;
  end if;
  if p_actor is not null and not public.payout_actor_can(p_actor, 'payout_request_mercury') then
    raise exception '지급 시도를 만들 권한이 없습니다(payout_request_mercury 또는 마스터 필요).';
  end if;

  if p_batch_id is not null then
    select * into v_batch from payout_batches where id = p_batch_id for update;
    if v_batch.id is null then raise exception '정산 묶음을 찾을 수 없습니다.'; end if;
    if v_batch.status <> 'approved' then
      raise exception '승인된(approved) 정산만 지급 시도를 만들 수 있습니다(현재: %).', v_batch.status;
    end if;
    v_recipient := v_batch.teacher_id; v_kind := 'teacher'; v_currency := v_batch.currency;
    v_amount := coalesce((select sum(amount_minor) from payout_items where batch_id = p_batch_id), 0);
    v_start := v_batch.period_start; v_end := v_batch.period_end;
    v_deadline := coalesce(v_batch.scheduled_payout_date, public.payout_nominal_date(v_batch.period_end));
  else
    select * into v_period from consultant_payout_periods where id = p_consultant_period_id for update;
    if v_period.id is null then raise exception '컨설턴트 정산 기간을 찾을 수 없습니다.'; end if;
    if v_period.status <> 'confirmed' then
      raise exception '확정된(confirmed) 컨설턴트 정산만 지급 시도를 만들 수 있습니다(현재: %).', v_period.status;
    end if;
    v_recipient := v_period.consultant_id; v_kind := 'consultant'; v_currency := v_period.currency;
    v_amount := v_period.amount_minor; v_start := v_period.period_start; v_end := v_period.period_end;
    v_deadline := public.payout_nominal_date(v_period.period_end);
  end if;

  if p_kind = 'normal' then
    -- 멱등: 이미 활성 normal 시도가 있으면 그것을 돌려준다(중복 클릭·재시도).
    select id into v_existing from payout_attempts
      where kind = 'normal'
        and settlement_batch_id is not distinct from p_batch_id
        and settlement_consultant_period_id is not distinct from p_consultant_period_id
        and status not in ('failed', 'returned', 'cancelled')
      limit 1;
    if v_existing is not null then return v_existing; end if;
  else
    if p_original_attempt_id is null then raise exception '재송금·보충 시도는 원 시도가 필요합니다.'; end if;
    select * into v_orig from payout_attempts where id = p_original_attempt_id;
    if v_orig.id is null then raise exception '원 시도를 찾을 수 없습니다.'; end if;
    if v_orig.settlement_batch_id is distinct from p_batch_id
       or v_orig.settlement_consultant_period_id is distinct from p_consultant_period_id then
      raise exception '원 시도가 같은 정산에 속하지 않습니다.';
    end if;
    if p_kind = 'resend' then
      if v_orig.status not in ('failed', 'returned', 'cancelled') then
        raise exception '재송금은 실패·반환·취소된 시도에 대해서만 만들 수 있습니다(원 시도 상태: %).', v_orig.status;
      end if;
      if exists (select 1 from payout_attempts where original_attempt_id = p_original_attempt_id
                   and kind = 'resend' and status not in ('failed', 'returned', 'cancelled')) then
        raise exception '이 원 시도에는 이미 진행 중인 재송금이 있습니다.';
      end if;
      -- 재송금 금액은 원 시도의 계약 금액과 같다.
    else
      if p_top_up_amount_minor is null or p_top_up_amount_minor <= 0 then
        raise exception '보충(top_up) 시도는 0보다 큰 금액이 필요합니다.';
      end if;
      v_amount := p_top_up_amount_minor;
    end if;
  end if;

  if v_amount <= 0 then raise exception '지급 금액이 0 이하입니다.'; end if;

  v_manual := (p_provider = 'manual') or (v_currency = 'KRW');
  v_rail := case when p_provider = 'manual' then 'manual' when v_currency = 'USD' then 'ach' else 'international_wire' end;
  v_transfer := case when v_currency = 'KRW' then public.payout_krw_transfer_date(v_deadline)
                     else public.payout_transfer_request_date(v_deadline) end;
  if v_transfer > v_deadline then v_transfer := v_deadline; end if;
  select coalesce(max(attempt_no), 0) + 1 into v_no from payout_attempts
    where settlement_batch_id is not distinct from p_batch_id
      and settlement_consultant_period_id is not distinct from p_consultant_period_id;
  select id into v_link from payout_recipient_links
    where provider = p_provider and recipient_kind = v_kind and profile_id = v_recipient;

  insert into payout_attempts (
    settlement_batch_id, settlement_consultant_period_id, recipient_profile_id, recipient_kind, recipient_link_id,
    period_start, period_end, provider, rail, manual_execution, kind, original_attempt_id, attempt_no,
    contractual_amount_minor, contractual_currency, requested_amount_minor, requested_currency,
    payment_deadline, scheduled_transfer_date, created_by
  ) values (
    p_batch_id, p_consultant_period_id, v_recipient, v_kind, v_link,
    v_start, v_end, p_provider, v_rail, v_manual, p_kind, p_original_attempt_id, v_no,
    case when p_kind = 'top_up' then (select contractual_amount_minor from payout_attempts where id = p_original_attempt_id) else v_amount end,
    v_currency, v_amount, v_currency,
    v_deadline, v_transfer, p_actor
  ) returning id into v_id;

  if v_currency = 'KRW' and not public.payout_kr_calendar_verified(v_deadline) then
    perform public.payout_attempt_add_flag(v_id, 'unverified_calendar');
  end if;
  if v_transfer <= (now() at time zone 'America/Los_Angeles')::date and v_transfer < v_deadline then
    perform public.payout_attempt_add_flag(v_id, 'transfer_date_already_passed');
  end if;
  perform public.payout_attempt_log(v_id, 'created', null, 'queued', p_actor,
    jsonb_build_object('kind', p_kind, 'provider', p_provider, 'rail', v_rail, 'amount_minor', v_amount, 'currency', v_currency));
  return v_id;
end;
$$;

-- ───────────────────────── 승인(직무 분리) ─────────────────────────
create or replace function public.approve_payout_attempt(p_attempt uuid, p_actor uuid)
returns void language plpgsql as $$
declare
  a payout_attempts%rowtype; v_settlement_actor uuid;
begin
  if not public.payout_actor_can(p_actor, 'payout_approve_mercury') then
    raise exception '지급 시도를 승인할 권한이 없습니다(payout_approve_mercury 또는 마스터 필요).';
  end if;
  select * into a from payout_attempts where id = p_attempt for update;
  if a.id is null then raise exception '지급 시도를 찾을 수 없습니다.'; end if;
  if a.approved_at is not null and a.approval_invalidated_at is null then return; end if; -- 멱등
  if a.status not in ('queued', 'needs_review') then
    raise exception '승인할 수 없는 상태입니다: %', a.status;
  end if;

  if a.settlement_batch_id is not null then
    select actor_id into v_settlement_actor from payout_batch_audit_log
      where batch_id = a.settlement_batch_id and action = 'approved' order by created_at desc limit 1;
  else
    select confirmed_by into v_settlement_actor from consultant_payout_periods where id = a.settlement_consultant_period_id;
  end if;
  if v_settlement_actor is not null and v_settlement_actor = p_actor then
    raise exception '정산을 승인한 사람은 같은 건의 지급 시도를 승인할 수 없습니다(직무 분리).';
  end if;
  if a.created_by is not null and a.created_by = p_actor then
    raise exception '지급 시도를 만든 사람은 직접 승인할 수 없습니다(직무 분리).';
  end if;

  -- 금액·수취인이 승인 시점에도 그대로인지 확인한다.
  if a.kind in ('normal', 'resend') then
    if (a.settlement_batch_id is not null
          and coalesce((select sum(amount_minor) from payout_items where batch_id = a.settlement_batch_id), 0) <> a.contractual_amount_minor)
       or (a.settlement_consultant_period_id is not null
          and (select amount_minor from consultant_payout_periods where id = a.settlement_consultant_period_id) <> a.contractual_amount_minor) then
      raise exception '정산 금액이 시도 생성 이후 바뀌었습니다. 새 시도를 만들어야 합니다.';
    end if;
  end if;
  if a.recipient_link_id is not null
     and (select status from payout_recipient_links where id = a.recipient_link_id) = 'reverify_required' then
    raise exception '수취인 계좌가 변경되어 재검증이 필요합니다.';
  end if;

  update payout_attempts
    set approved_by = p_actor, approved_at = now(), approval_invalidated_at = null, approval_invalidated_reason = null,
        status = 'queued',
        needs_review_reasons = array_remove(array_remove(array_remove(needs_review_reasons, 'recipient_changed'), 'amount_changed'), 'approval_invalidated'),
        updated_at = now()
    where id = p_attempt;
  perform public.payout_attempt_log(p_attempt, 'approved', a.status, 'queued', p_actor);
end;
$$;

-- ───────────────────────── 승인 무효화(금액·수취인 변경) ─────────────────────────
create or replace function public.invalidate_payout_attempts(
  p_batch_id uuid, p_consultant_period_id uuid, p_recipient uuid, p_reason text, p_flag text
) returns int language plpgsql as $$
declare r record; n int := 0;
begin
  for r in
    select id, status from payout_attempts
    where (p_batch_id is null or settlement_batch_id = p_batch_id)
      and (p_consultant_period_id is null or settlement_consultant_period_id = p_consultant_period_id)
      and (p_recipient is null or recipient_profile_id = p_recipient)
      and status in ('queued', 'awaiting_mercury_approval', 'processing', 'sent')
    for update
  loop
    if r.status in ('queued', 'awaiting_mercury_approval') then
      update payout_attempts
        set status = 'needs_review', approved_by = null, approved_at = null,
            approval_invalidated_at = now(), approval_invalidated_reason = p_reason,
            updated_at = now()
        where id = r.id;
      perform public.payout_attempt_add_flag(r.id, p_flag);
      perform public.payout_attempt_log(r.id, 'approval_invalidated', r.status, 'needs_review', null, jsonb_build_object('reason', p_reason));
    else
      -- 이미 실행 중/송금됨: 상태는 바꾸지 않고 관리자 확인 플래그만.
      perform public.payout_attempt_add_flag(r.id, p_flag || '_after_execution');
      perform public.payout_attempt_log(r.id, 'flagged_after_execution', r.status, r.status, null, jsonb_build_object('reason', p_reason));
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ───────────────────────── 상태 전이 ─────────────────────────
create or replace function public.payout_attempt_transition_allowed(p_from text, p_to text)
returns boolean language sql immutable as $$
  select (p_from, p_to) in (
    ('queued', 'awaiting_mercury_approval'), ('queued', 'cancelled'), ('queued', 'needs_review'),
    ('awaiting_mercury_approval', 'processing'), ('awaiting_mercury_approval', 'failed'),
    ('awaiting_mercury_approval', 'cancelled'), ('awaiting_mercury_approval', 'needs_review'),
    ('processing', 'sent'), ('processing', 'failed'), ('processing', 'needs_review'),
    ('sent', 'receipt_confirmed'), ('sent', 'returned'), ('sent', 'failed'), ('sent', 'needs_review'),
    ('receipt_confirmed', 'returned'),
    ('needs_review', 'queued'), ('needs_review', 'cancelled'), ('needs_review', 'sent'), ('needs_review', 'failed')
  )
$$;

create or replace function public.payout_attempt_transition(
  p_attempt uuid, p_to text, p_actor uuid default null, p_reason text default null
) returns text language plpgsql as $$
declare a payout_attempts%rowtype; v_link_status text;
begin
  select * into a from payout_attempts where id = p_attempt for update;
  if a.id is null then raise exception '지급 시도를 찾을 수 없습니다.'; end if;
  if a.status = p_to then return a.status; end if;   -- 멱등: 같은 상태 재호출은 무동작
  if not public.payout_attempt_transition_allowed(a.status, p_to) then
    raise exception '허용되지 않는 전이입니다: % -> %', a.status, p_to;
  end if;

  if p_to in ('awaiting_mercury_approval', 'processing', 'sent') and not public.real_disbursement_enabled() then
    raise exception '법인 지급 경계(real_disbursement_enabled)가 닫혀 있어 실제 지급 전이를 할 수 없습니다.';
  end if;
  if p_to = 'awaiting_mercury_approval' then
    if a.approved_at is null or a.approval_invalidated_at is not null then
      raise exception '승인되지 않았거나 승인이 무효화된 시도는 요청할 수 없습니다(재승인 필요).';
    end if;
    if a.provider = 'mercury' and not a.manual_execution then
      select status into v_link_status from payout_recipient_links where id = a.recipient_link_id;
      if v_link_status is distinct from 'verified' then
        raise exception 'Mercury 수취인이 검증(verified)되지 않았습니다.';
      end if;
    end if;
    update payout_attempts set requested_at = coalesce(requested_at, now()) where id = p_attempt;
  elsif p_to = 'sent' then
    if a.provider <> 'manual' and a.provider_transaction_id is null then
      raise exception 'sent 전이에는 provider 거래 ID가 필요합니다.';
    end if;
    update payout_attempts set sent_at = coalesce(sent_at, now()) where id = p_attempt;
  elsif p_to = 'failed' then
    if coalesce(length(btrim(p_reason)), 0) = 0 then raise exception '실패 사유가 필요합니다.'; end if;
    update payout_attempts set failed_at = now(), failure_reason = p_reason where id = p_attempt;
  elsif p_to = 'cancelled' then
    if coalesce(length(btrim(p_reason)), 0) = 0 then raise exception '취소 사유가 필요합니다.'; end if;
  end if;

  update payout_attempts set status = p_to, updated_at = now() where id = p_attempt;
  perform public.payout_attempt_log(p_attempt, 'transition', a.status, p_to, p_actor, jsonb_build_object('reason', p_reason));
  return p_to;
end;
$$;

-- ───────────────────────── 외부 식별자·실제 금액 기록 ─────────────────────────
create or replace function public.record_payout_attempt_request(
  p_attempt uuid, p_request_id text, p_actor uuid default null, p_uncertain boolean default false
) returns void language plpgsql as $$
declare a payout_attempts%rowtype;
begin
  select * into a from payout_attempts where id = p_attempt for update;
  if a.id is null then raise exception '지급 시도를 찾을 수 없습니다.'; end if;
  if p_request_id is not null and a.payout_request_id is not null and a.payout_request_id <> p_request_id then
    raise exception '이미 다른 payout_request_id가 연결되어 있습니다.';
  end if;
  update payout_attempts
    set payout_request_id = coalesce(p_request_id, payout_request_id), request_uncertain = p_uncertain, updated_at = now()
    where id = p_attempt;
  perform public.payout_attempt_log(p_attempt, 'request_recorded', a.status, a.status, p_actor,
    jsonb_build_object('request_id', p_request_id, 'uncertain', p_uncertain));
end;
$$;

create or replace function public.link_payout_attempt_transaction(
  p_attempt uuid, p_transaction_id text, p_actor uuid default null,
  p_tracking_url text default null, p_receipt_url text default null
) returns void language plpgsql as $$
declare a payout_attempts%rowtype;
begin
  if p_actor is not null and not public.payout_actor_can(p_actor, 'payout_request_mercury') then
    raise exception '거래 ID를 연결할 권한이 없습니다(payout_request_mercury 또는 마스터 필요).';
  end if;
  if coalesce(length(btrim(p_transaction_id)), 0) = 0 then raise exception '거래 ID가 필요합니다.'; end if;
  select * into a from payout_attempts where id = p_attempt for update;
  if a.id is null then raise exception '지급 시도를 찾을 수 없습니다.'; end if;
  if a.provider_transaction_id is not null and a.provider_transaction_id <> p_transaction_id then
    raise exception '이미 다른 거래 ID(%)가 연결되어 있습니다. 재송금은 새 시도로 만드세요.', a.provider_transaction_id;
  end if;
  update payout_attempts
    set provider_transaction_id = p_transaction_id,
        tracking_url = coalesce(p_tracking_url, tracking_url), receipt_url = coalesce(p_receipt_url, receipt_url),
        request_uncertain = false, updated_at = now()
    where id = p_attempt;
  perform public.payout_attempt_log(p_attempt, 'transaction_linked', a.status, a.status, p_actor,
    jsonb_build_object('transaction_id', p_transaction_id));
end;
$$;

create or replace function public.record_payout_attempt_actuals(
  p_attempt uuid, p_usd_principal bigint, p_usd_fee bigint,
  p_quoted_rate numeric default null, p_final_rate numeric default null, p_fx_locked_at timestamptz default null,
  p_actor uuid default null
) returns void language plpgsql as $$
declare a payout_attempts%rowtype;
begin
  select * into a from payout_attempts where id = p_attempt for update;
  if a.id is null then raise exception '지급 시도를 찾을 수 없습니다.'; end if;
  if p_usd_principal < 0 or p_usd_fee < 0 then raise exception '금액은 0 이상이어야 합니다.'; end if;
  update payout_attempts
    set actual_usd_principal_minor = p_usd_principal, actual_usd_fee_minor = p_usd_fee,
        actual_usd_total_debit_minor = p_usd_principal + p_usd_fee,
        quoted_fx_rate = coalesce(p_quoted_rate, quoted_fx_rate),
        final_fx_rate = coalesce(p_final_rate, final_fx_rate),
        fx_locked_at = coalesce(p_fx_locked_at, fx_locked_at), updated_at = now()
    where id = p_attempt;
  -- 같은 통화(USD)일 때만 계약 금액과 실제 원금을 비교한다. KRW 계약은 USD 출금과 직접 비교하지 않는다.
  if a.contractual_currency = 'USD' and a.requested_currency = 'USD' and p_usd_principal <> a.requested_amount_minor then
    perform public.payout_attempt_add_flag(p_attempt, 'usd_principal_differs_from_contract');
  end if;
  if p_usd_fee > 0 and a.contractual_currency = 'USD' then
    null; -- 수수료는 회사 부담: 별도 지출로 기록될 뿐 플래그 대상 아님
  end if;
  perform public.payout_attempt_log(p_attempt, 'actuals_recorded', a.status, a.status, p_actor,
    jsonb_build_object('usd_principal', p_usd_principal, 'usd_fee', p_usd_fee, 'quoted_rate', p_quoted_rate, 'final_rate', p_final_rate));
end;
$$;

-- ───────────────────────── 정산 paid 동기화(수취 확인 합계가 정산 총액 이상일 때만) ─────────────────────────
-- 기존 paid 가드(provider_transaction_id + provider_confirmed_at)를 그대로 통과시키는 방식으로만 batch를 paid로 옮긴다.
-- 게이트가 닫혀 있거나 수동(거래 ID 없음)·컨설턴트 정산이면 전이하지 않고 플래그를 남긴다(관리자가 기존 화면에서 마감).
create or replace function public.sync_payout_settlement_paid(p_attempt uuid, p_actor uuid)
returns text language plpgsql as $$
declare
  a payout_attempts%rowtype; b payout_batches%rowtype;
  v_total bigint; v_received bigint;
begin
  select * into a from payout_attempts where id = p_attempt;
  if a.settlement_batch_id is null then
    perform public.payout_attempt_add_flag(p_attempt, 'settlement_not_marked_paid');
    return 'consultant_manual';
  end if;
  select * into b from payout_batches where id = a.settlement_batch_id for update;
  if b.status = 'paid' then return 'already_paid'; end if;
  select coalesce(sum(amount_minor), 0) into v_total from payout_items where batch_id = b.id;
  select coalesce(sum(received_amount_minor), 0) into v_received from payout_attempts
    where settlement_batch_id = b.id and status = 'receipt_confirmed' and received_currency = b.currency;
  if v_received < v_total then return 'received_less_than_settlement'; end if;
  if a.provider = 'manual' or a.provider_transaction_id is null or not public.real_disbursement_enabled() then
    perform public.payout_attempt_add_flag(p_attempt, 'settlement_not_marked_paid');
    return 'not_synced';
  end if;
  if b.status = 'approved' then
    perform public.dispatch_payout_batch(b.id, case when a.provider = 'wise' then 'wise' else 'mercury' end, p_actor);
    select * into b from payout_batches where id = b.id;
  end if;
  if b.status = 'dispatch_requested' then
    perform public.mark_payout_batch_provider_pending(b.id, a.provider_transaction_id);
    b.status := 'provider_pending';
  end if;
  if b.status = 'provider_pending' then
    perform public.mark_payout_batch_provider_confirmed(b.id, p_actor);
    perform public.mark_payout_batch_paid(b.id, p_actor);
    return 'paid';
  end if;
  perform public.payout_attempt_add_flag(p_attempt, 'settlement_not_marked_paid');
  return 'not_synced';
end;
$$;

-- ───────────────────────── 수취 확인(증빙 필수) ─────────────────────────
create or replace function public.confirm_payout_attempt_receipt(
  p_attempt uuid, p_actor uuid, p_received_amount_minor bigint, p_received_currency text,
  p_evidence text, p_received_at timestamptz default now()
) returns void language plpgsql as $$
declare a payout_attempts%rowtype;
begin
  if not public.payout_actor_can(p_actor, 'payout_request_mercury')
     and not public.payout_actor_can(p_actor, 'payout_approve_mercury') then
    raise exception '수취 확인을 기록할 권한이 없습니다.';
  end if;
  if coalesce(length(btrim(p_evidence)), 0) < 5 then raise exception '수취 확인 증빙(5자 이상)이 필요합니다.'; end if;
  if p_received_currency not in ('USD', 'KRW') then raise exception '수취 통화는 USD 또는 KRW여야 합니다.'; end if;
  select * into a from payout_attempts where id = p_attempt for update;
  if a.id is null then raise exception '지급 시도를 찾을 수 없습니다.'; end if;
  if a.status = 'receipt_confirmed' then return; end if; -- 멱등
  if a.status <> 'sent' then raise exception 'sent 상태에서만 수취 확인을 기록할 수 있습니다(현재: %).', a.status; end if;

  update payout_attempts
    set status = 'receipt_confirmed', received_confirmed_at = p_received_at, received_evidence = p_evidence,
        received_amount_minor = p_received_amount_minor, received_currency = p_received_currency,
        received_confirmed_by = p_actor, updated_at = now()
    where id = p_attempt;
  if p_received_currency = a.requested_currency and p_received_amount_minor < a.requested_amount_minor then
    perform public.payout_attempt_add_flag(p_attempt, 'short_received');
  end if;
  if p_received_currency <> a.requested_currency then
    perform public.payout_attempt_add_flag(p_attempt, 'received_currency_differs');
  end if;
  if (p_received_at at time zone 'America/Los_Angeles')::date > a.payment_deadline then
    perform public.payout_attempt_add_flag(p_attempt, 'late');
  end if;
  perform public.payout_attempt_log(p_attempt, 'receipt_confirmed', 'sent', 'receipt_confirmed', p_actor,
    jsonb_build_object('received_amount_minor', p_received_amount_minor, 'currency', p_received_currency, 'evidence', p_evidence));
  if a.kind in ('normal', 'resend', 'top_up') then
    perform public.sync_payout_settlement_paid(p_attempt, p_actor);
  end if;
end;
$$;

-- ───────────────────────── 반환(별도 반환 거래로 기록, 원 거래 불변) ─────────────────────────
create or replace function public.record_payout_attempt_return(
  p_attempt uuid, p_actor uuid, p_return_transaction_id text, p_returned_usd_minor bigint, p_reason text
) returns void language plpgsql as $$
declare a payout_attempts%rowtype;
begin
  -- p_actor null = 시스템 이벤트(Mercury 웹훅의 reversed). 사람이 기록할 때는 권한을 확인한다.
  if p_actor is not null
     and not public.payout_actor_can(p_actor, 'payout_request_mercury')
     and not public.payout_actor_can(p_actor, 'payout_approve_mercury') then
    raise exception '반환을 기록할 권한이 없습니다.';
  end if;
  if coalesce(length(btrim(p_reason)), 0) = 0 then raise exception '반환 사유가 필요합니다.'; end if;
  if coalesce(length(btrim(p_return_transaction_id)), 0) = 0 then raise exception '반환 거래 ID가 필요합니다.'; end if;
  select * into a from payout_attempts where id = p_attempt for update;
  if a.id is null then raise exception '지급 시도를 찾을 수 없습니다.'; end if;
  if a.status = 'returned' then
    if a.return_transaction_id = p_return_transaction_id then return; end if; -- 멱등
    raise exception '이미 다른 반환 거래(%)로 기록되어 있습니다.', a.return_transaction_id;
  end if;
  if not public.payout_attempt_transition_allowed(a.status, 'returned') then
    raise exception '이 상태(%)에서는 반환을 기록할 수 없습니다.', a.status;
  end if;
  update payout_attempts
    set status = 'returned', returned_at = now(), return_reason = p_reason,
        return_transaction_id = p_return_transaction_id, returned_usd_minor = p_returned_usd_minor, updated_at = now()
    where id = p_attempt;
  if a.actual_usd_total_debit_minor is not null and p_returned_usd_minor is distinct from a.actual_usd_total_debit_minor then
    perform public.payout_attempt_add_flag(p_attempt, 'returned_amount_mismatch');
  end if;
  perform public.payout_attempt_log(p_attempt, 'returned', a.status, 'returned', p_actor,
    jsonb_build_object('return_transaction_id', p_return_transaction_id, 'returned_usd_minor', p_returned_usd_minor, 'reason', p_reason));
end;
$$;

-- 함수 실행 권한: 서버(service_role) 전용
do $$
declare f text;
begin
  foreach f in array array[
    'payout_attempt_log(uuid,text,text,text,uuid,jsonb)',
    'payout_attempt_add_flag(uuid,text)',
    'sync_payout_settlement_paid(uuid,uuid)',
    'create_payout_attempt(uuid,uuid,text,uuid,uuid,text,bigint)',
    'approve_payout_attempt(uuid,uuid)',
    'invalidate_payout_attempts(uuid,uuid,uuid,text,text)',
    'payout_attempt_transition(uuid,text,uuid,text)',
    'record_payout_attempt_request(uuid,text,uuid,boolean)',
    'link_payout_attempt_transaction(uuid,text,uuid,text,text)',
    'record_payout_attempt_actuals(uuid,bigint,bigint,numeric,numeric,timestamptz,uuid)',
    'confirm_payout_attempt_receipt(uuid,uuid,bigint,text,text,timestamptz)',
    'record_payout_attempt_return(uuid,uuid,text,bigint,text)',
    'payout_actor_can(uuid,text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
