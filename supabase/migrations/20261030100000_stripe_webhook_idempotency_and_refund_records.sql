-- Stripe 점검 후속 (additive, create or replace / if not exists 로 재실행 안전).
-- 롤백(수동): drop function grant_legacy_credit_purchase(text,uuid,uuid,text);
--   drop table payment_webhook_issues; drop table payment_refunds;
--   drop index payment_attempts_attempt_key_uidx; alter table payment_attempts drop column attempt_key;
--   drop index credit_purchases_checkout_session_uidx; alter table credit_purchases drop column stripe_checkout_session_id;
-- 기존 행은 건드리지 않는다(새 컬럼은 nullable, unique 는 not null 행에만 적용 → 기존 중복 행이 있어도 깨지지 않음).

-- 1) payment_attempts 멱등 키: 웹훅 event.id 기반. 재시도해도 같은 키 → 1행.
alter table payment_attempts add column if not exists attempt_key text;
create unique index if not exists payment_attempts_attempt_key_uidx
  on payment_attempts (attempt_key);

-- 2) 레거시 credit 플로우: checkout session 당 1회 지급.
alter table credit_purchases add column if not exists stripe_checkout_session_id text;
create unique index if not exists credit_purchases_checkout_session_uidx
  on credit_purchases (stripe_checkout_session_id);

create or replace function grant_legacy_credit_purchase(
  p_session_id text,
  p_student_id uuid,
  p_package_id uuid,
  p_payment_intent text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pkg credit_packages%rowtype;
  v_purchase_id uuid;
begin
  select * into v_pkg from credit_packages where id = p_package_id;
  if not found then
    return jsonb_build_object('created', false, 'reason', 'unknown_package');
  end if;

  insert into credit_purchases (student_id, package_id, stripe_payment_intent_id, amount_usd, credits_purchased, stripe_checkout_session_id)
  values (p_student_id, p_package_id, p_payment_intent, v_pkg.price_usd, v_pkg.credit_count, p_session_id)
  on conflict (stripe_checkout_session_id) do nothing
  returning id into v_purchase_id;

  if v_purchase_id is null then
    return jsonb_build_object('created', false, 'reason', 'already_granted');
  end if;

  insert into credit_transactions (student_id, type, amount, related_purchase_id, reason)
  values (p_student_id, 'purchase', v_pkg.credit_count, v_purchase_id, 'Stripe 결제');

  update students set credit_balance = coalesce(credit_balance, 0) + v_pkg.credit_count where id = p_student_id;

  return jsonb_build_object('created', true, 'purchaseId', v_purchase_id);
end;
$$;
revoke all on function grant_legacy_credit_purchase(text, uuid, uuid, text) from public, anon, authenticated;
grant execute on function grant_legacy_credit_purchase(text, uuid, uuid, text) to service_role;

-- 3) 환불 기록(수업권 자동 회수 없음 — 정책 미확정). 관리자 확인 큐.
create table if not exists payment_refunds (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid references purchases (id),
  stripe_refund_id text not null,
  stripe_charge_id text,
  stripe_payment_intent_id text,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null default 'USD',
  status text,
  reason text,
  needs_review boolean not null default true,
  reviewed_by uuid references profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stripe_refund_id)
);
create index if not exists payment_refunds_purchase_id_idx on payment_refunds (purchase_id);
create index if not exists payment_refunds_needs_review_idx on payment_refunds (needs_review) where needs_review;
comment on table payment_refunds is
  'Stripe 환불 이벤트 기록. 수업권 자동 회수는 하지 않는다(오너 정책 미확정). needs_review=true 가 관리자 확인 필요 큐.';

-- 4) 웹훅 이상 대장(금액 불일치·구매 미존재 등). 부여 중단 사유의 감사 기록.
create table if not exists payment_webhook_issues (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  kind text not null,
  purchase_id uuid references purchases (id),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (event_id, kind)
);
create index if not exists payment_webhook_issues_open_idx on payment_webhook_issues (created_at) where resolved_at is null;

alter table payment_refunds enable row level security;
alter table payment_webhook_issues enable row level security;
drop policy if exists payment_refunds_admin_select on payment_refunds;
create policy payment_refunds_admin_select on payment_refunds
  for select using (is_admin() or current_user_has_capability('manage_payments'));
drop policy if exists payment_webhook_issues_admin_select on payment_webhook_issues;
create policy payment_webhook_issues_admin_select on payment_webhook_issues
  for select using (is_admin() or current_user_has_capability('manage_payments'));

-- 5) 환불 자동 회수(기능 플래그 STRIPE_AUTO_REVOKE_ON_REFUND 가 켜졌을 때만 앱이 호출, 기본 꺼짐).
-- 조건: 이 구매의 성공 환불 합계 >= 구매 총액(전액) AND 이 구매가 지급한 모든 유료 grant 가
-- 전혀 사용되지 않음(ledger 에 grant 이벤트만 있고 잔량 == original_quantity). 하나라도 어긋나면
-- 아무것도 회수하지 않고 manual 사유 반환(관리자 처리). 다른 구매의 grant/과거 수업 기록은 건드리지 않는다.
-- 반복 호출 안전: refund ledger 행은 (grant,event_type,business_event_id) unique 로 1회.
alter table payment_refunds add column if not exists auto_revoke_status text;

create or replace function public.auto_revoke_refunded_purchase(p_purchase_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_total bigint;
  v_refunded bigint;
  v_grant record;
  v_grant_count int := 0;
  v_already int := 0;
  v_remaining int;
  v_other int;
begin
  select total_minor into v_total from purchases where id = p_purchase_id for update;
  if v_total is null then
    return jsonb_build_object('revoked', false, 'reason', 'purchase_not_found');
  end if;
  select coalesce(sum(amount_minor), 0) into v_refunded
    from payment_refunds where purchase_id = p_purchase_id and status = 'succeeded';
  if v_total = 0 or v_refunded < v_total then
    return jsonb_build_object('revoked', false, 'reason', 'not_full_refund');
  end if;

  for v_grant in
    select id, original_quantity from entitlement_grants where purchase_id_ref = p_purchase_id and is_paid order by id for update
  loop
    v_grant_count := v_grant_count + 1;
    if exists (select 1 from entitlement_ledger where grant_id = v_grant.id and event_type = 'refund') then
      v_already := v_already + 1;
      continue;
    end if;
    select count(*) into v_other from entitlement_ledger
      where grant_id = v_grant.id and event_type not in ('grant');
    select coalesce(sum(amount), 0) into v_remaining from entitlement_ledger where grant_id = v_grant.id;
    if v_other > 0 or v_remaining <> v_grant.original_quantity then
      return jsonb_build_object('revoked', false, 'reason', 'partially_used_or_reserved');
    end if;
  end loop;

  if v_grant_count = 0 then
    return jsonb_build_object('revoked', false, 'reason', 'no_grant');
  end if;
  if v_already = v_grant_count then
    return jsonb_build_object('revoked', true, 'reason', 'already_revoked');
  end if;

  perform public.refund_entitlement(p_purchase_id, 'auto-refund:' || p_purchase_id::text);
  return jsonb_build_object('revoked', true, 'reason', 'revoked');
end;
$$;
revoke execute on function public.auto_revoke_refunded_purchase(uuid) from public, anon, authenticated;
grant execute on function public.auto_revoke_refunded_purchase(uuid) to service_role;
