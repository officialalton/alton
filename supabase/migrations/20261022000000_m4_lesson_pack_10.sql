-- M4: 10회 패키지 수업권 추가(사용자 요청, 2026-09-05) — 단건(lesson_pack_1)/
-- 20회(lesson_pack_20)와 동일한 패턴(R4 20260922000000 참고)의 additive INSERT.
-- 단건 환산가(unit_price_minor)는 기존 상품과 동일하게 21875(=$218.75)로 맞추고,
-- 10% 할인을 적용한다.
insert into entitlement_products (code, entitlement_type_id, quantity)
  select 'lesson_pack_10', id, 10 from entitlement_types where code = 'regular_lesson_use';

insert into entitlement_product_versions
  (entitlement_product_id, version_number, price_minor, unit_price_minor, currency, validity_months,
   discount_minor, discount_percent, effective_from, created_by)
  select id, 1, 196875, 21875, 'USD', 12, 21875, 10.00, now(), null
  from entitlement_products where code = 'lesson_pack_10';
