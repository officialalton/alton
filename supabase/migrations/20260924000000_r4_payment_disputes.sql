-- R4 후속(2026-09-01) — Stripe 분쟁(chargeback) 전용 소스오브트루스 테이블.
--
-- 배경(버그): app/api/webhooks/stripe/route.ts가 charge.dispute.created에서
-- purchases.status를 'disputed'로 직접 UPDATE하고 있었는데, purchases.status는
-- v3_payment_attempt_status enum(20260830000000)을 재사용하고 이 enum에는
-- 'disputed' 값이 없다 — UPDATE가 무효 enum 값으로 실패하고, 그 에러를 앱
-- 코드가 확인하지 않아 사실상 조용히 no-op됐다. 20260922000000 §6의 설계
-- 코멘트 자체가 이미 "분쟁 같은 파생 상태는 purchases에 별도 컬럼을 두지
-- 않고 다른 테이블을 조인해 계산한다"고 명시했음에도 실제 구현이 그 원칙을
-- 어긴 것 — 이번 마이그레이션은 그 원칙대로 되돌린다: purchases.status는
-- payment_attempts 상태만 반영하고, 분쟁은 이 신규 payment_disputes 테이블이
-- 단일 진실 소스가 된다.
--
-- 순수 additive: 기존 테이블/컬럼/enum을 건드리지 않는다. purchases.status에는
-- 어떤 경로로도 'disputed'를 쓰지 않는다(앱 코드도 이 마이그레이션과 같은
-- 커밋에서 수정).

create table payment_disputes (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid references purchases (id), -- nullable: 레거시 credit_purchases 플로우 또는
    -- stripe_payment_intent_id로 매칭되는 purchases 행이 없는 경우(대사 필요 항목으로
    -- null인 채 기록 — 조용히 버리지 않는다).
  stripe_dispute_id text not null,
  stripe_charge_id text not null,
  stripe_payment_intent_id text,
  status text not null, -- Stripe dispute.status 원문 그대로 저장(warning_needs_response,
    -- warning_under_review, warning_closed, needs_response, under_review,
    -- charge_refunded, won, lost 등) — 우리가 자체 enum으로 좁히지 않고 Stripe 쪽 값을
    -- 그대로 신뢰(신규 상태가 추가돼도 스키마 마이그레이션 없이 수용).
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null default 'USD',
  reason text,
  stripe_created_at timestamptz,
  stripe_updated_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stripe_dispute_id) -- upsert-safe idempotency: created/updated/closed가 전부
    -- 같은 행을 갱신하도록 강제.
);
create index on payment_disputes (purchase_id);
create index on payment_disputes (status);

comment on table payment_disputes is
  'R4 후속: Stripe 분쟁(chargeback) 전용 소스오브트루스. charge.dispute.created/'
  '.updated/.closed 웹훅이 stripe_dispute_id로 upsert한다. 분쟁 생성은 entitlement_ledger를'
  '전혀 건드리지 않는다(자동 회수 없음, 정책 확정) — 분쟁 패소로 실제 entitlement 조정이'
  '필요하면 admin이 기존 adjust_entitlement()/관리자 조정 UI를 통해 별도로 처리한다.';

alter table payment_disputes enable row level security;

-- purchases와 동일한 가시성 규칙: 같은 household의 보호자·본인(child), 관리자만 조회.
-- purchase_id가 null(레거시/미매칭)인 행은 관리자만 조회 가능.
create policy payment_disputes_household_select on payment_disputes
  for select using (
    is_admin()
    or exists (
      select 1 from purchases p
      where p.id = payment_disputes.purchase_id
        and (p.child_id = auth.uid() or is_household_guardian_of(p.child_id))
    )
  );
create policy payment_disputes_admin_write on payment_disputes
  for all using (is_admin() or current_user_has_capability('manage_payments'))
  with check (is_admin() or current_user_has_capability('manage_payments'));

-- purchase_receipts 뷰 보강 — 진행 중인(가장 최근) 분쟁 정보를 append(중간 삽입 불가
-- 제약, 20260923000000과 동일한 이유로 컬럼은 항상 끝에만 추가).
create or replace view purchase_receipts as
select
  p.id as purchase_id,
  p.household_id,
  p.child_id,
  p.contract_id,
  cv.version_number as contract_version_number,
  p.entitlement_product_id,
  ep.code as product_code,
  p.product_version_id,
  p.quantity,
  p.unit_price_minor,
  p.package_price_minor,
  p.discount_minor,
  p.discount_percent,
  p.tax_minor,
  p.total_minor,
  p.currency,
  p.validity_months,
  p.expires_at,
  p.price_policy_version,
  p.refund_policy_version,
  p.terms_version,
  p.status,
  p.stripe_checkout_session_id,
  p.stripe_payment_intent_id,
  p.created_at,
  p.confirmed_at,
  lt.label as lesson_type_label,
  lt.duration_minutes as lesson_duration_minutes,
  d.status as dispute_status,
  d.amount_minor as dispute_amount_minor,
  d.reason as dispute_reason,
  d.stripe_updated_at as dispute_updated_at
from purchases p
join entitlement_products ep on ep.id = p.entitlement_product_id
join entitlement_types et on et.id = ep.entitlement_type_id
join lesson_types lt on lt.id = et.lesson_type_id
left join lateral (
  select cv2.version_number from contract_versions cv2
  where cv2.contract_id = p.contract_id
  order by cv2.version_number desc limit 1
) cv on true
left join lateral (
  select pd.status, pd.amount_minor, pd.reason, pd.stripe_updated_at
  from payment_disputes pd
  where pd.purchase_id = p.id
  order by pd.stripe_updated_at desc nulls last, pd.created_at desc
  limit 1
) d on true;

comment on view purchase_receipts is
  'R4: 영수증은 purchases 스냅샷만으로 파생 — 별도 저장 테이블 없음. 수업형태·수업시간은'
  ' entitlement_products→entitlement_types→lesson_types 조인으로 보완(2026-09-01).'
  ' dispute_* 컬럼은 payment_disputes에서 가장 최근 분쟁 1건을 조인(2026-09-01 후속) —'
  ' purchases.status 자체는 절대 분쟁 상태를 갖지 않는다(payment_attempts 상태만 반영).';

-- purchases 테이블 설계 코멘트 정정 — "disputed 파생 상태는 refund_requests/'
-- entitlement_ledger 조인만으로 계산한다"는 원래 문구가 부정확했다(분쟁은 그 두 테이블'
-- 만으로 계산할 수 없음 — Stripe가 별도로 보내는 사실이라 payment_disputes로 저장해야'
-- 함). 실제 status 컬럼 정의는 그대로, 코멘트만 정정.
comment on table purchases is
  'R4: 구매 시점 가격·정책 전부를 스냅샷으로 고정(unit_price_minor 등) — product_version_id가'
  ' 가리키는 가격이 이후 바뀌어도 이 행은 불변. status는 v3_payment_attempt_status 재사용'
  '(구매의 대표 상태 = 최신 payment_attempts 상태를 앱이 동기화, disputed 값 없음 — 절대'
  ' 쓰지 않는다). 부분환불/환불 파생 상태는 refund_requests·entitlement_ledger를 조인해'
  ' 계산하고, 분쟁(chargeback) 파생 상태는 payment_disputes를 조인해 계산한다(2026-09-01'
  ' 정정) — 어느 쪽도 이 테이블에 별도 컬럼을 두지 않는다(이중 상태 저장 방지).';
