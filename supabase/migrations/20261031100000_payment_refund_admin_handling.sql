-- 관리자 환불 처리 화면 지원 (additive, 재실행 안전). 20261030100000 이후에 적용.
-- 롤백(수동): drop function resolve_payment_refund(uuid,uuid,text,text); drop function resolve_payment_webhook_issue(uuid,uuid,text);
--   alter table payment_refunds drop column handled_by, drop column handled_at, drop column handled_action, drop column handled_note;
--   alter table payment_webhook_issues drop column resolved_by, drop column resolved_note;

alter table payment_refunds add column if not exists handled_by uuid references profiles (id);
alter table payment_refunds add column if not exists handled_at timestamptz;
alter table payment_refunds add column if not exists handled_action text check (handled_action in ('revoke', 'dismiss'));
alter table payment_refunds add column if not exists handled_note text;
alter table payment_webhook_issues add column if not exists resolved_by uuid references profiles (id);
alter table payment_webhook_issues add column if not exists resolved_note text;

-- 수동 처리: 'revoke' = 기존 refund_entitlement()(그 구매의 grant 만, 미래 hold 있으면 예외로 중단, ledger append-only)
-- 재사용, 'dismiss' = 수업권 변경 없이 확인 완료. 이미 처리된 행은 다시 처리하지 않는다(중복 방지).
-- 사유 필수. 과거 기록은 삭제·수정하지 않고 처리자·시각·사유만 채운다.
create or replace function public.resolve_payment_refund(p_refund_id uuid, p_admin uuid, p_action text, p_note text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_refund payment_refunds%rowtype;
begin
  if p_action not in ('revoke', 'dismiss') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_action');
  end if;
  if coalesce(btrim(p_note), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'note_required');
  end if;
  select * into v_refund from payment_refunds where id = p_refund_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_refund.handled_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_handled');
  end if;

  if p_action = 'revoke' then
    if v_refund.purchase_id is null then
      return jsonb_build_object('ok', false, 'reason', 'no_purchase');
    end if;
    perform public.refund_entitlement(v_refund.purchase_id, 'manual-refund:' || v_refund.purchase_id::text);
    update payment_refunds
      set handled_by = p_admin, handled_at = now(), handled_action = 'revoke', handled_note = p_note,
          needs_review = false, updated_at = now()
      where purchase_id = v_refund.purchase_id and handled_at is null;
  else
    update payment_refunds
      set handled_by = p_admin, handled_at = now(), handled_action = 'dismiss', handled_note = p_note,
          needs_review = false, updated_at = now()
      where id = p_refund_id;
  end if;
  return jsonb_build_object('ok', true, 'reason', p_action);
end;
$$;
revoke execute on function public.resolve_payment_refund(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.resolve_payment_refund(uuid, uuid, text, text) to service_role;

create or replace function public.resolve_payment_webhook_issue(p_issue_id uuid, p_admin uuid, p_note text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(btrim(p_note), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'note_required');
  end if;
  update payment_webhook_issues
    set resolved_at = now(), resolved_by = p_admin, resolved_note = p_note
    where id = p_issue_id and resolved_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found_or_already_resolved');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke execute on function public.resolve_payment_webhook_issue(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.resolve_payment_webhook_issue(uuid, uuid, text) to service_role;
