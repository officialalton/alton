-- Mercury 지급 통합 3/3 — 금액·수취인 변경 시 승인 무효화 트리거, 대사용 뷰(2026-10-07).

-- 정산 항목(교사 batch) 금액 변경 → 미실행 시도 승인 무효화
create or replace function public.payout_items_invalidate_attempts()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_batch uuid;
begin
  for v_batch in
    select distinct b from unnest(array[
      case when tg_op in ('UPDATE', 'DELETE') then old.batch_id end,
      case when tg_op in ('UPDATE', 'INSERT') then new.batch_id end]) as b
    where b is not null
  loop
    if exists (
      select 1 from payout_attempts a
      where a.settlement_batch_id = v_batch and a.kind in ('normal', 'resend')
        and a.status in ('queued', 'awaiting_mercury_approval', 'processing', 'sent')
        and a.contractual_amount_minor <> coalesce((select sum(amount_minor) from payout_items where batch_id = v_batch), 0)
    ) then
      perform public.invalidate_payout_attempts(v_batch, null, null, 'Settlement amount changed after the attempt was created', 'amount_changed');
    end if;
  end loop;
  return null;
end;
$$;
drop trigger if exists payout_items_invalidate_attempts on public.payout_items;
create trigger payout_items_invalidate_attempts
  after insert or update of amount_minor, batch_id or delete on public.payout_items
  for each row execute function public.payout_items_invalidate_attempts();
revoke execute on function public.payout_items_invalidate_attempts() from public, anon, authenticated, service_role;

-- 컨설턴트 정산 금액·통화 변경
create or replace function public.consultant_period_invalidate_attempts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.amount_minor is distinct from old.amount_minor or new.currency is distinct from old.currency then
    perform public.invalidate_payout_attempts(null, new.id, null, 'Settlement amount changed after the attempt was created', 'amount_changed');
  end if;
  return null;
end;
$$;
drop trigger if exists consultant_period_invalidate_attempts on public.consultant_payout_periods;
create trigger consultant_period_invalidate_attempts
  after update of amount_minor, currency on public.consultant_payout_periods
  for each row execute function public.consultant_period_invalidate_attempts();
revoke execute on function public.consultant_period_invalidate_attempts() from public, anon, authenticated, service_role;

-- 수취 계좌 변경 → 링크 재검증 필요 + 미실행 시도 승인 무효화
create or replace function public.payout_account_changed_invalidate()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_profile uuid; v_kind text;
begin
  if tg_table_name = 'teacher_payout_accounts' then v_profile := new.teacher_id; v_kind := 'teacher';
  else v_profile := new.consultant_id; v_kind := 'consultant'; end if;
  if tg_op = 'UPDATE'
     and old.account_number_enc is not distinct from new.account_number_enc
     and old.swift_or_routing_enc is not distinct from new.swift_or_routing_enc
     and old.bank_name is not distinct from new.bank_name
     and old.account_holder_name is not distinct from new.account_holder_name
     and old.currency is not distinct from new.currency
     and old.country is not distinct from new.country then
    return null;
  end if;
  update payout_recipient_links
    set status = case when status in ('verified', 'registered') then 'reverify_required' else status end,
        bank_name = new.bank_name, account_last4 = new.account_number_last4,
        payout_currency = case when new.currency in ('USD', 'KRW') then new.currency else payout_currency end,
        payout_country = new.country, last_changed_at = now()
    where profile_id = v_profile and recipient_kind = v_kind;
  perform public.invalidate_payout_attempts(null, null, v_profile, 'Recipient bank details changed; re-verification required', 'recipient_changed');
  return null;
end;
$$;
drop trigger if exists teacher_payout_accounts_invalidate_attempts on public.teacher_payout_accounts;
create trigger teacher_payout_accounts_invalidate_attempts
  after insert or update on public.teacher_payout_accounts
  for each row execute function public.payout_account_changed_invalidate();
drop trigger if exists consultant_payout_accounts_invalidate_attempts on public.consultant_payout_accounts;
create trigger consultant_payout_accounts_invalidate_attempts
  after insert or update on public.consultant_payout_accounts
  for each row execute function public.payout_account_changed_invalidate();
revoke execute on function public.payout_account_changed_invalidate() from public, anon, authenticated, service_role;

-- 대사 행: KRW 합계와 USD 출금은 별도 열. 같은 통화(USD)일 때만 계약과 원금을 비교한다.
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
    when a.status = 'sent' then 'awaiting_receipt'
    when a.status = 'receipt_confirmed' then 'ok'
    else 'pending'
  end as reconciliation_flag,
  false as import_into_books        -- 참조 전용: 은행 피드·Stripe 연결로 이미 들어오는 거래를 다시 가져오지 않는다
from public.payout_attempts a;
comment on view public.payout_reconciliation_rows is
  '대사용 보조원장 행. import_into_books는 항상 false(참조 전용). Stripe 거래는 포함하지 않는다.';
