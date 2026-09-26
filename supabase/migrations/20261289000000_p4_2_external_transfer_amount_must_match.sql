-- P4-2 — 외부 송금 기록 금액은 승인된 최종 송금액과 일치해야 한다 (2026-09-12)
--
-- 제품 오너 확정: 외부 기록은 "이미 보낸 사실"의 기록이므로, 승인된 금액과 다른
-- 금액을 적어 넣을 수 있으면 원장과 실제 송금이 갈라진다. 금액을 바꿔야 한다면
-- 먼저 **조정 → 재승인**을 거치고(그 경로가 이미 이력을 남긴다) 그 다음에 기록한다.
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
  if coalesce(btrim(p_bank_reference), '') = '' then
    raise exception '은행 거래 참조값을 입력해주세요.';
  end if;
  if p_amount_minor <= 0 then
    raise exception '송금 금액은 0보다 커야 합니다.';
  end if;
  if p_transferred_on is null then
    raise exception '송금 완료일을 입력해주세요.';
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
  values (p_batch_id, p_transferred_on, p_amount_minor, p_currency, btrim(p_bank_reference), nullif(btrim(coalesce(p_memo, '')), ''), p_actor_id)
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
          p_transferred_on::text || ' · ' || p_amount_minor::text || ' ' || p_currency || ' · 참조 ' || btrim(p_bank_reference)
          || coalesce(' · ' || nullif(btrim(coalesce(p_memo, '')), ''), ''));

  return v_id;
end;
$$;

comment on function public.record_external_payout_transfer is
  'P4-2: 은행 직접 송금 완료 기록. Wise API를 호출하지 않으므로 real_disbursement_enabled() 게이트와 '
  '무관하게 동작한다(사람이 이미 보낸 사실의 기록). 대신 조건을 좁게 강제한다 — 송금 승인된 묶음만, '
  '승인된 최종 송금액과 정확히 일치, 통화 일치, 은행 거래 참조값·완료일 필수, 처리자·시각 감사 기록. '
  '기록 뒤에는 지급 완료가 되고 payout_external_transfers의 unique(batch_id)로 재기록이 막힌다.';
