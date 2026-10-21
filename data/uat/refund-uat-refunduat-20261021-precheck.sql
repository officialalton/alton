-- 사전 점검(읽기 전용, SELECT 만). 실행 ID: refunduat-20261021
-- 공유 DB 에 시드를 적용하기 전에 실행한다. 아래 기대값이 모두 맞아야 시드를 적용한다.
-- 선행 조건: migration 20261030100000(payment_refunds/payment_webhook_issues)·20261031100000(처리 RPC) 적용 완료.

-- 1) 테이블·RPC 존재 (4개 모두 true)
select to_regclass('public.payment_refunds') is not null                         as has_payment_refunds,
       to_regclass('public.payment_webhook_issues') is not null                  as has_payment_webhook_issues,
       exists (select 1 from pg_proc where proname = 'resolve_payment_refund')        as has_resolve_refund,
       exists (select 1 from pg_proc where proname = 'resolve_payment_webhook_issue') as has_resolve_issue;

-- 2) 이 실행 ID 의 잔존 행 (전부 0 = 아직 시드되지 않음)
select 'purchases' as t, count(*) from purchases where stripe_checkout_session_id like 'cs_test_refunduat_20261021_%'
union all select 'payment_refunds', count(*) from payment_refunds where stripe_refund_id like 're_refunduat_20261021_%'
union all select 'payment_webhook_issues', count(*) from payment_webhook_issues where event_id like 'evt_refunduat_20261021_%'
union all select 'ledger', count(*) from entitlement_ledger where business_event_id like '%refunduat-20261021%'
union all select 'reservations', count(*) from reservations where idempotency_key like 'refunduat-20261021-%';

-- 3) 사용할 기존 테스트 계정 3가족(X: 환불 시나리오 A,C,D,E,F,G / Y: B / Z: H)
--    기대: is_test_account=t, contract_status=active, in_household=t, *_must_be_0 컬럼 전부 0,
--          Y·Z 는 ended_assignment=1 (예약 시나리오용 선생님이 종료 배정 상태로 남아 있음).
with fam(label, child, hh, contract, enr, teacher) as (values
  ('X', '458c121e-423f-4cf3-a1db-e8b2ba25ea65'::uuid, '04a0f226-84e5-4a85-b42f-72ab567f4ec6'::uuid, 'dd80f175-ba28-4b29-989e-45bb990a36de'::uuid, '34377f9b-5a83-4cb8-b4fa-2f7158e7990d'::uuid, 'fe34020a-c555-4399-884d-ed62e61067d8'::uuid),
  ('Y', '851e4c76-a4f7-43b2-a64d-ac24849fbe29'::uuid, 'b57e6983-e0d8-41d5-9e83-07a2156a7324'::uuid, '2529b513-5222-4915-874e-34b9f0ecd4bf'::uuid, '70fcee30-5714-48ec-ac0c-6b67fd313c00'::uuid, 'bc456195-a6d5-42a4-ab3c-b1436e5b7ae6'::uuid),
  ('Z', 'e0ca6b26-d2b3-4d1e-bb56-4a63cd7c1ff8'::uuid, 'e0ea0cf6-3e2a-4bbc-8d60-f9bbcd126b11'::uuid, '8cd8783f-b693-488b-878a-e05fdb60986f'::uuid, '0e6bec49-4321-4434-be9a-15a9cc6fd703'::uuid, '9b4b4d49-6437-47b4-8741-222cb3589423'::uuid))
select f.label,
       (select s.is_test_account from students s where s.id = f.child)                                           as is_test_account,
       (select c.status::text from contracts c where c.id = f.contract and c.child_id = f.child and c.household_id = f.hh) as contract_status,
       exists (select 1 from household_members m where m.household_id = f.hh and m.profile_id = f.child and m.role = 'child') as in_household,
       (select count(*) from entitlement_grants g where g.child_id = f.child)                                    as grants_must_be_0,
       (select count(*) from purchases p where p.child_id = f.child)                                             as purchases_must_be_0,
       (select count(*) from teacher_assignments a where a.subject_enrollment_id = f.enr and a.teacher_id = f.teacher and a.status::text = 'ended') as ended_assignment,
       (select count(*) from teacher_assignments a where a.subject_enrollment_id = f.enr and a.status::text = 'active') as active_assignment_must_be_0,
       (select count(*) from teacher_availability_rules r where r.teacher_id = f.teacher)                        as teacher_rules_must_be_0,
       (select count(*) from teacher_assignments a where a.teacher_id = f.teacher and a.subject_enrollment_id <> f.enr) as teacher_other_enrollments_must_be_0
from fam f order by f.label;

-- 4) 상품 확인 (두 상품 각각 현재 유효 버전 1개)
select ep.code, count(*) as current_versions
from entitlement_products ep
join entitlement_product_versions v on v.entitlement_product_id = ep.id and v.effective_until is null and v.discontinued_at is null
where ep.code in ('lesson_pack_10', 'lesson_pack_1')
group by ep.code order by ep.code;

-- 5) 불변 기준선 — 시드 전 값을 기록해 두고 시드 후·정리 후 비교한다.
select 'purchases' as t, count(*) from purchases
union all select 'entitlement_grants', count(*) from entitlement_grants
union all select 'entitlement_ledger', count(*) from entitlement_ledger
union all select 'reservations', count(*) from reservations
union all select 'payment_refunds', count(*) from payment_refunds
union all select 'payment_webhook_issues', count(*) from payment_webhook_issues
union all select 'teacher_availability_rules', count(*) from teacher_availability_rules
union all select 'teacher_assignments', count(*) from teacher_assignments
union all select 'official@alton.education (auth.users)', count(*) from auth.users where email = 'official@alton.education';
