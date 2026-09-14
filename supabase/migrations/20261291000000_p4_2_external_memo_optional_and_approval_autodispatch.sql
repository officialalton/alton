-- P4-2 정정 — 외부 송금 기록의 확인 메모를 선택값으로 / 승인 시 자동 송금 대상화
-- (2026-09-12 제품 오너 지시)
--
-- 1) 은행 거래번호·이체확인증 번호는 **송금 실행에 필요한 값이 아니라 사후 대사
--    보조 정보**다. 필수로 두면 값이 없다는 이유로 이미 보낸 돈을 기록하지 못한다.
--    필수는 **송금 완료일**과 **승인된 최종 송금액 일치** 둘뿐이며, 처리 관리자와
--    시각은 시스템이 기록한다.
-- 2) 과거 승인 건은 자동 송금에서 제외된 상태로 보정된다(20261290000000).
--    관리자가 **재승인**하면 그때는 "자동으로 보내도 된다"는 판단이 있었던 것이므로
--    자동 송금 대상이 된다. 새로 승인되는 묶음도 같은 규칙으로 대상이 된다.

-- =========================================================================
-- 1. 확인 메모는 선택값
-- =========================================================================
alter table payout_external_transfers alter column bank_reference drop not null;

comment on column payout_external_transfers.bank_reference is
  'P4-2: 송금 확인 메모(선택). 이체확인증 번호·은행 거래 ID·내부 전표 번호처럼 사후 대사에 도움이 '
  '되는 값이 있을 때만 남긴다. 송금 실행에 필요한 값이 아니므로 비어 있어도 기록을 막지 않는다.';

create or replace function public.record_external_payout_transfer(
  p_batch_id uuid,
  p_transferred_on date,
  p_amount_minor bigint,
  p_currency text,
  p_bank_reference text,
  p_memo text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare
  v_batch payout_batches%rowtype;
  v_expected bigint;
  v_id uuid;
begin
  -- 필수는 완료일과 금액 일치뿐이다. 확인 메모(p_bank_reference)는 비어 있어도 된다.
  if p_transferred_on is null then
    raise exception '송금 완료일을 입력해주세요.';
  end if;
  if p_amount_minor <= 0 then
    raise exception '송금 금액은 0보다 커야 합니다.';
  end if;

  select * into v_batch from payout_batches where id = p_batch_id for update;
  if not found then
    raise exception '존재하지 않는 정산 묶음입니다.';
  end if;
  if v_batch.status <> 'approved' then
    raise exception '송금 승인된 묶음에만 외부 송금 완료를 기록할 수 있습니다(현재: %).', v_batch.status;
  end if;
  if p_currency <> v_batch.currency then
    raise exception '묶음 통화(%)와 다른 통화(%)로는 기록할 수 없습니다.', v_batch.currency, p_currency;
  end if;

  select coalesce(sum(amount_minor), 0) into v_expected from payout_items where batch_id = p_batch_id;
  if p_amount_minor <> v_expected then
    raise exception '기록 금액(%)이 승인된 최종 송금액(%)과 다릅니다. 금액을 바꿔야 하면 먼저 조정하고 재승인하세요.',
      p_amount_minor, v_expected;
  end if;

  insert into payout_external_transfers (batch_id, transferred_on, amount_minor, currency, bank_reference, memo, recorded_by)
  values (
    p_batch_id, p_transferred_on, p_amount_minor, p_currency,
    nullif(btrim(coalesce(p_bank_reference, '')), ''),
    nullif(btrim(coalesce(p_memo, '')), ''),
    p_actor_id
  )
  returning id into v_id;

  perform set_config('app.external_payout_transfer', 'on', true);
  update payout_batches
    set status = 'paid',
        paid_at = p_transferred_on::timestamptz,
        external_transfer_recorded_at = now()
    where id = p_batch_id;
  perform set_config('app.external_payout_transfer', 'off', true);

  update payout_items
    set status = 'paid', external_transfer_recorded = true
    where batch_id = p_batch_id;

  insert into payout_batch_audit_log (batch_id, action, actor_id, note)
  values (p_batch_id, 'external_transfer_recorded', p_actor_id,
          p_transferred_on::text || ' · ' || p_amount_minor::text || ' ' || p_currency
          || coalesce(' · ' || nullif(btrim(coalesce(p_bank_reference, '')), ''), '')
          || coalesce(' · ' || nullif(btrim(coalesce(p_memo, '')), ''), ''));

  return v_id;
end;
$$;

comment on function public.record_external_payout_transfer is
  'P4-2: 은행 직접 송금 완료 기록. Wise API를 호출하지 않아 real_disbursement_enabled() 게이트와 '
  '무관하다. 필수는 송금 완료일과 승인된 최종 송금액 일치 둘뿐이고, 확인 메모는 선택이다. '
  '처리자·시각은 시스템이 기록한다. 승인된 묶음만 허용하며 기록 뒤에는 지급 완료가 되고 '
  'unique(batch_id)로 재기록이 막힌다.';

-- =========================================================================
-- 2. 승인하면 자동 송금 대상이 된다
-- =========================================================================
-- 새로 승인되는 묶음의 기본값이자, 과거 승인 건(제외 상태로 보정됨)을 관리자가
-- 재승인했을 때 대상으로 만드는 경로다. 승인은 "이 금액을 지급한다"는 판단이므로
-- 그 시점에 자동 송금 대상으로 두는 것이 기본이고, 개별 제외는 승인 뒤에 언제든
-- set_payout_batch_auto_dispatch()로 다시 끌 수 있다.
create or replace function public.approve_payout_batch(p_batch_id uuid, p_approved_by uuid)
returns void
language plpgsql as $$
declare
  v_previous date;
  v_next date;
begin
  select scheduled_payout_date into v_previous from payout_batches where id = p_batch_id;
  v_next := public.next_scheduled_payout_date(now());

  update payout_batches
    set status = 'approved',
        approved_at = now(),
        scheduled_payout_date = v_next,
        auto_dispatch_enabled = true
    where id = p_batch_id and status in ('draft', 'reviewing', 'calculated', 'reviewed');
  if not found then
    raise exception 'calculated/reviewed 상태의 batch만 승인할 수 있습니다.';
  end if;

  update payout_items set status = 'approved' where batch_id = p_batch_id;

  insert into payout_batch_audit_log (batch_id, action, actor_id)
    values (p_batch_id, 'approved', p_approved_by);

  if v_previous is distinct from v_next then
    insert into payout_scheduled_date_events (batch_id, previous_date, new_date, source, actor_id, reason)
    values (p_batch_id, v_previous, v_next, 'approval', p_approved_by,
            case when v_previous is null then '승인 시 지급 예정일 확정' else '재승인으로 지급 예정일 재계산' end);
  end if;
end;
$$;
