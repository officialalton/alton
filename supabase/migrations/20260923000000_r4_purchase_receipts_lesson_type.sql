-- R4 후속(2026-09-01) — 영수증 필수 필드 중 "수업형태·수업시간"이 purchase_receipts
-- 뷰에 빠져 있던 것을 보완한다(entitlement_products → entitlement_types →
-- lesson_types 조인 추가). 뷰 재정의라 데이터 마이그레이션 불필요.

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
  lt.duration_minutes as lesson_duration_minutes
from purchases p
join entitlement_products ep on ep.id = p.entitlement_product_id
join entitlement_types et on et.id = ep.entitlement_type_id
join lesson_types lt on lt.id = et.lesson_type_id
left join lateral (
  select cv2.version_number from contract_versions cv2
  where cv2.contract_id = p.contract_id
  order by cv2.version_number desc limit 1
) cv on true;

comment on view purchase_receipts is 'R4: 영수증은 purchases 스냅샷만으로 파생 — 별도 저장 테이블 없음. 수업형태·수업시간은 entitlement_products→entitlement_types→lesson_types 조인으로 보완(2026-09-01).';
