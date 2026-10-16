-- 오너 결정(2026-10-07) 반영: 수취 확인 단계 폐지(sent=지급 완료), 직무 분리 설정화, 한국 은행 휴일 2027~2030, KRW 선행 5영업일 확정.
-- additive: 기존 시도·이벤트 이력은 그대로 둔다(legacy receipt_confirmed 행·컬럼 유지).

-- ───────────────────────── 1) KRW 선행 5영업일 확정(기본값 이미 5 — 값만 못박는다) ─────────────────────────
update public.payout_settings set transfer_lead_business_days_krw = 5 where id and transfer_lead_business_days_krw <> 5;

-- ───────────────────────── 2) 한국 은행 휴일 2027~2030 ─────────────────────────
-- 출처·검증일은 docs/2026-10-07-kr-bank-holidays.md. 2027=공식 월력요항(우주항공청 2026-06-29 발표), 2028~2030=법정 규정+천문 자료로 산출한 값(공식 월력요항 발표 전).
alter table public.payout_kr_calendar_years add column if not exists source_level text not null default 'draft'
  check (source_level in ('official_wolryeok', 'derived', 'draft'));
insert into public.payout_kr_bank_holidays (holiday_date, name) values
  ('2027-01-01', 'New Year''s Day'),
  ('2027-02-06', 'Seollal holiday'),
  ('2027-02-07', 'Seollal'),
  ('2027-02-08', 'Seollal holiday'),
  ('2027-02-09', 'Seollal (substitute)'),
  ('2027-03-01', 'Independence Movement Day'),
  ('2027-05-01', 'Labor Day'),
  ('2027-05-03', 'Labor Day (substitute)'),
  ('2027-05-05', 'Children''s Day'),
  ('2027-05-13', 'Buddha''s Birthday'),
  ('2027-06-06', 'Memorial Day'),
  ('2027-07-17', 'Constitution Day'),
  ('2027-07-19', 'Constitution Day (substitute)'),
  ('2027-08-15', 'Liberation Day'),
  ('2027-08-16', 'Liberation Day (substitute)'),
  ('2027-09-14', 'Chuseok holiday'),
  ('2027-09-15', 'Chuseok'),
  ('2027-09-16', 'Chuseok holiday'),
  ('2027-10-03', 'National Foundation Day'),
  ('2027-10-04', 'National Foundation Day (substitute)'),
  ('2027-10-09', 'Hangul Day'),
  ('2027-10-11', 'Hangul Day (substitute)'),
  ('2027-12-25', 'Christmas Day'),
  ('2027-12-27', 'Christmas Day (substitute)'),
  ('2027-12-31', 'Year-end bank closure'),
  ('2028-01-01', 'New Year''s Day'),
  ('2028-01-26', 'Seollal holiday'),
  ('2028-01-27', 'Seollal'),
  ('2028-01-28', 'Seollal holiday'),
  ('2028-03-01', 'Independence Movement Day'),
  ('2028-05-01', 'Labor Day'),
  ('2028-05-02', 'Buddha''s Birthday'),
  ('2028-05-05', 'Children''s Day'),
  ('2028-06-06', 'Memorial Day'),
  ('2028-07-17', 'Constitution Day'),
  ('2028-08-15', 'Liberation Day'),
  ('2028-10-02', 'Chuseok holiday'),
  ('2028-10-03', 'Chuseok / National Foundation Day'),
  ('2028-10-04', 'Chuseok holiday'),
  ('2028-10-05', 'Chuseok (substitute)'),
  ('2028-10-09', 'Hangul Day'),
  ('2028-12-25', 'Christmas Day'),
  ('2028-12-31', 'Year-end bank closure'),
  ('2029-01-01', 'New Year''s Day'),
  ('2029-02-12', 'Seollal holiday'),
  ('2029-02-13', 'Seollal'),
  ('2029-02-14', 'Seollal holiday'),
  ('2029-03-01', 'Independence Movement Day'),
  ('2029-05-01', 'Labor Day'),
  ('2029-05-05', 'Children''s Day'),
  ('2029-05-07', 'Children''s Day (substitute)'),
  ('2029-05-20', 'Buddha''s Birthday'),
  ('2029-05-21', 'Buddha''s Birthday (substitute)'),
  ('2029-06-06', 'Memorial Day'),
  ('2029-07-17', 'Constitution Day'),
  ('2029-08-15', 'Liberation Day'),
  ('2029-09-21', 'Chuseok holiday'),
  ('2029-09-22', 'Chuseok'),
  ('2029-09-23', 'Chuseok holiday'),
  ('2029-09-24', 'Chuseok (substitute)'),
  ('2029-10-03', 'National Foundation Day'),
  ('2029-10-09', 'Hangul Day'),
  ('2029-12-25', 'Christmas Day'),
  ('2029-12-31', 'Year-end bank closure'),
  ('2030-01-01', 'New Year''s Day'),
  ('2030-02-02', 'Seollal holiday'),
  ('2030-02-03', 'Seollal'),
  ('2030-02-04', 'Seollal holiday'),
  ('2030-02-05', 'Seollal (substitute)'),
  ('2030-03-01', 'Independence Movement Day'),
  ('2030-05-01', 'Labor Day'),
  ('2030-05-05', 'Children''s Day'),
  ('2030-05-06', 'Children''s Day (substitute)'),
  ('2030-05-09', 'Buddha''s Birthday'),
  ('2030-06-06', 'Memorial Day'),
  ('2030-07-17', 'Constitution Day'),
  ('2030-08-15', 'Liberation Day'),
  ('2030-09-11', 'Chuseok holiday'),
  ('2030-09-12', 'Chuseok'),
  ('2030-09-13', 'Chuseok holiday'),
  ('2030-10-03', 'National Foundation Day'),
  ('2030-10-09', 'Hangul Day'),
  ('2030-12-25', 'Christmas Day'),
  ('2030-12-31', 'Year-end bank closure')
on conflict (holiday_date) do nothing;
update public.payout_kr_calendar_years set source_level = 'official_wolryeok',
  verified_note = '2026-10-07 공식 월력요항(한국천문연구원, 2025-06-30 발표)과 대조: 설 2/17·추석 9/25·관공서 공휴일 70일 일치'
  where calendar_year = 2026;
insert into public.payout_kr_calendar_years (calendar_year, verified_note, source_level) values
  (2027, '2026-10-07 공식 월력요항(우주항공청, 2026-06-29 발표; 공휴일 72일, 노동절·제헌절 포함)과 대조', 'official_wolryeok'),
  (2028, '2026-10-07 산출값(관공서 공휴일 규정+천문 자료) — 공식 월력요항은 2027-06경 발표, 발표 후 재대조 필요', 'derived'),
  (2029, '2026-10-07 산출값 — 공식 월력요항 발표 후 재대조 필요', 'derived'),
  (2030, '2026-10-07 산출값 — 공식 월력요항 발표 후 재대조 필요', 'derived')
on conflict (calendar_year) do update set verified_note = excluded.verified_note, source_level = excluded.source_level;

-- ───────────────────────── 3) 직무 분리 설정(기본 해제) ─────────────────────────
alter table public.payout_settings add column if not exists payout_dual_control_required boolean not null default false;
comment on column public.payout_settings.payout_dual_control_required is
  'true이면 정산 승인자·시도 생성자가 같은 건의 지급 승인을 할 수 없다(직무 분리). 기본 false: 마스터 1명이 둘 다 가능, 누가 무엇을 승인했는지는 시도 이벤트에 항상 기록.';

create or replace function public.set_payout_dual_control(p_required boolean, p_actor uuid)
returns void language plpgsql as $$
begin
  if not exists (select 1 from profiles where id = p_actor and role = 'admin' and admin_tier = 'master') then
    raise exception '직무 분리 설정은 마스터 관리자만 바꿀 수 있습니다.';
  end if;
  update payout_settings set payout_dual_control_required = p_required, updated_by = p_actor, updated_at = now() where id;
end;
$$;
revoke execute on function public.set_payout_dual_control(boolean, uuid) from public, anon, authenticated;

create or replace function public.approve_payout_attempt(p_attempt uuid, p_actor uuid)
returns void language plpgsql as $$
declare
  a payout_attempts%rowtype; v_settlement_actor uuid; v_dual boolean;
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
  select coalesce((select payout_dual_control_required from payout_settings where id), false) into v_dual;
  if v_dual and v_settlement_actor is not null and v_settlement_actor = p_actor then
    raise exception '직무 분리가 켜져 있어 정산을 승인한 사람은 같은 건의 지급 시도를 승인할 수 없습니다.';
  end if;
  if v_dual and a.created_by is not null and a.created_by = p_actor then
    raise exception '직무 분리가 켜져 있어 지급 시도를 만든 사람은 직접 승인할 수 없습니다.';
  end if;

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
  -- 감사: 정산 승인자·시도 생성자·지급 승인자를 이벤트에 함께 남긴다(직무 분리가 꺼져 있어도 누가 무엇을 승인했는지 추적).
  perform public.payout_attempt_log(p_attempt, 'approved', a.status, 'queued', p_actor,
    jsonb_build_object('settlement_approved_by', v_settlement_actor, 'attempt_created_by', a.created_by,
                       'payout_approved_by', p_actor, 'dual_control_required', v_dual,
                       'same_person_settlement_and_payout', v_settlement_actor is not distinct from p_actor));
end;
$$;

-- ───────────────────────── 4) 수취 확인 폐지: sent = 지급 완료 ─────────────────────────
-- Mercury 거래가 sent(completed)이면 지급 완료로 본다. 증빙·교사 확인 입력 없음. 반환이 생길 때만 반환 기록·재송금.
create or replace function public.payout_attempt_transition_allowed(p_from text, p_to text)
returns boolean language sql immutable as $$
  select (p_from, p_to) in (
    ('queued', 'awaiting_mercury_approval'), ('queued', 'cancelled'), ('queued', 'needs_review'),
    ('awaiting_mercury_approval', 'processing'), ('awaiting_mercury_approval', 'failed'),
    ('awaiting_mercury_approval', 'cancelled'), ('awaiting_mercury_approval', 'needs_review'),
    ('processing', 'sent'), ('processing', 'failed'), ('processing', 'needs_review'),
    ('sent', 'returned'), ('sent', 'failed'), ('sent', 'needs_review'),
    ('receipt_confirmed', 'returned'),   -- legacy 이력 행만(새 전이 없음)
    ('needs_review', 'queued'), ('needs_review', 'cancelled'), ('needs_review', 'sent'), ('needs_review', 'failed')
  )
$$;

-- 정산 paid 동기화: 같은 통화로 sent(및 legacy receipt_confirmed)된 시도의 요청 금액 합계가 정산 총액 이상일 때만.
create or replace function public.sync_payout_settlement_paid(p_attempt uuid, p_actor uuid)
returns text language plpgsql as $$
declare
  a payout_attempts%rowtype; b payout_batches%rowtype;
  v_total bigint; v_sent bigint;
begin
  select * into a from payout_attempts where id = p_attempt;
  if a.settlement_batch_id is null then
    perform public.payout_attempt_add_flag(p_attempt, 'settlement_not_marked_paid');
    return 'consultant_manual';
  end if;
  select * into b from payout_batches where id = a.settlement_batch_id for update;
  if b.status = 'paid' then return 'already_paid'; end if;
  select coalesce(sum(amount_minor), 0) into v_total from payout_items where batch_id = b.id;
  select coalesce(sum(requested_amount_minor), 0) into v_sent from payout_attempts
    where settlement_batch_id = b.id and status in ('sent', 'receipt_confirmed') and requested_currency = b.currency;
  if v_sent < v_total then return 'sent_less_than_settlement'; end if;
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

create or replace function public.payout_attempt_transition(
  p_attempt uuid, p_to text, p_actor uuid default null, p_reason text default null
) returns text language plpgsql as $$
declare a payout_attempts%rowtype; v_link_status text;
begin
  select * into a from payout_attempts where id = p_attempt for update;
  if a.id is null then raise exception '지급 시도를 찾을 수 없습니다.'; end if;
  if a.status = p_to then return a.status; end if;   -- 멱등
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

  if p_to = 'sent' then
    -- 기한 이후에 sent가 되면 관리자 확인 플래그.
    if (now() at time zone 'America/Los_Angeles')::date > a.payment_deadline then
      perform public.payout_attempt_add_flag(p_attempt, 'late');
    end if;
    -- 정산 paid 동기화는 실패해도 sent 기록(실제로 돈이 나간 사실)을 되돌리지 않는다.
    begin
      perform public.sync_payout_settlement_paid(p_attempt, p_actor);
    exception when others then
      perform public.payout_attempt_add_flag(p_attempt, 'settlement_not_marked_paid');
    end;
  end if;
  return p_to;
end;
$$;

-- 수취 확인 함수 폐기(호출처 없음). 과거 receipt_confirmed 행·received_* 컬럼과 이벤트는 이력으로 남는다.
drop function if exists public.confirm_payout_attempt_receipt(uuid, uuid, bigint, text, text, timestamptz);

-- 대사 뷰: sent가 완료. 'awaiting_receipt' 폐지. legacy receipt_confirmed도 ok.
create or replace view public.payout_reconciliation_rows
with (security_invoker = true) as
select
  coalesce(a.settlement_batch_id, a.settlement_consultant_period_id) as settlement_id,
  a.id as attempt_id,
  a.recipient_kind, a.recipient_profile_id,
  a.period_start, a.period_end, a.payment_deadline, a.scheduled_transfer_date,
  a.provider, a.rail, a.kind, a.attempt_no, a.original_attempt_id,
  a.contractual_amount_minor, a.contractual_currency,
  a.requested_amount_minor, a.requested_currency,
  a.status, a.provider_transaction_id, a.payout_request_id,
  a.sent_at, a.received_confirmed_at,
  a.actual_usd_principal_minor, a.actual_usd_fee_minor, a.actual_usd_total_debit_minor,
  a.quoted_fx_rate, a.final_fx_rate, a.fx_locked_at,
  a.received_amount_minor, a.received_currency,
  a.return_transaction_id, a.returned_usd_minor,
  a.needs_review_reasons,
  case when a.contractual_currency = 'USD' and a.actual_usd_principal_minor is not null
       then a.actual_usd_principal_minor = a.requested_amount_minor end as usd_principal_matches_contract,
  case
    when a.status in ('failed', 'cancelled') then 'not_paid'
    when a.status = 'returned' then
      case when a.returned_usd_minor is distinct from a.actual_usd_total_debit_minor then 'return_amount_mismatch' else 'returned' end
    when a.status = 'needs_review' then 'needs_review'
    when a.status in ('processing', 'sent', 'receipt_confirmed') and a.provider_transaction_id is null and a.provider <> 'manual' then 'missing_transaction'
    when a.status in ('sent', 'receipt_confirmed') and a.actual_usd_total_debit_minor is null then 'missing_actual_usd'
    when a.contractual_currency = 'USD' and a.actual_usd_principal_minor is not null
         and a.actual_usd_principal_minor <> a.requested_amount_minor then 'amount_mismatch'
    when a.status in ('sent', 'receipt_confirmed') then 'ok'
    else 'pending'
  end as reconciliation_flag,
  false as import_into_books
from public.payout_attempts a;

-- ───────────────────────── 5) sent=paid 뒤 반환 대응: paid 정산에도 재송금·보충 시도 허용, 반환 시 플래그 ─────────────────────────
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
    -- paid 정산에도 재송금·보충은 만들 수 있다(sent=paid 뒤 반환이 오는 경우). 새 normal 시도는 approved에서만.
    if v_batch.status <> 'approved' and not (v_batch.status = 'paid' and p_kind in ('resend', 'top_up')) then
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
  if a.settlement_batch_id is not null and (select status from payout_batches where id = a.settlement_batch_id) = 'paid' then
    -- paid 정산은 기존 가드상 되돌릴 수 없다. 시도 이력이 실제 상태의 원본이므로 플래그로 알리고 재송금(resend)을 안내한다.
    perform public.payout_attempt_add_flag(p_attempt, 'settlement_paid_but_returned');
  end if;
  perform public.payout_attempt_log(p_attempt, 'returned', a.status, 'returned', p_actor,
    jsonb_build_object('return_transaction_id', p_return_transaction_id, 'returned_usd_minor', p_returned_usd_minor, 'reason', p_reason));
end;
$$;
