-- 시드 직후 확인(읽기 전용). 실행 ID: refunduat-20261021
-- 기대: 시나리오 표와 일치. 처리(UAT) 진행 후에는 handled_* 와 잔량이 바뀐다.

-- 1) 환불 시나리오 요약 (A~F,H) — 시드 직후 기대값은 주석 참고
select right(r.stripe_refund_id, 1)                   as scenario,
       r.status                                         as stripe_status,
       r.needs_review, r.handled_at is not null         as handled,
       p.total_minor, p.status::text                    as purchase_status,
       coalesce(sum(l.amount), 0)                       as balance,         -- A10 B9 C1 D1 E- F0 H9
       count(*) filter (where l.event_type = 'consume') as consumed,        -- B1
       count(*) filter (where l.event_type = 'hold')    as holds,           -- B1 H1
       count(*) filter (where l.event_type = 'refund')  as refunded_rows    -- F1
from payment_refunds r
left join purchases p on p.id = r.purchase_id
left join entitlement_grants g on g.purchase_id_ref = p.id
left join entitlement_ledger l on l.grant_id = g.id
where r.stripe_refund_id like 're_refunduat_20261021_%'
group by r.stripe_refund_id, r.status, r.needs_review, r.handled_at, p.total_minor, p.status
order by r.stripe_refund_id;
-- 기대 행: A succeeded/needs_review t/미처리, B succeeded(consumed 1·balance 9), C pending, D failed,
--          E succeeded(구매 없음), F handled=t(balance 0·refund 1행), H succeeded(balance 9·holds 1 → 예약 점유)

-- 2) 웹훅 이상 (기대 2행, 둘 다 resolved_at null)
select event_id, kind, purchase_id is not null as has_purchase, resolved_at is not null as resolved
from payment_webhook_issues where event_id like 'evt_refunduat_20261021_%' order by event_id;

-- 3) 예약 점유 확인 (B: consume 완료 1건, H: 미래 활성 hold 1건)
select res.idempotency_key, res.status::text, res.starts_at,
       (select string_agg(l.event_type::text, ',' order by l.created_at) from entitlement_ledger l where l.reservation_id = res.id) as ledger_events
from reservations res where res.idempotency_key like 'refunduat-20261021-%' order by 1;

-- 4) 실행 ID 행 수 요약 (기대: purchases 7, grants 6, payment_refunds 7, issues 2, reservations 2)
select 'purchases' as t, count(*) from purchases where stripe_checkout_session_id like 'cs_test_refunduat_20261021_%'
union all select 'grants', count(*) from entitlement_grants g join purchases p on p.id = g.purchase_id_ref where p.stripe_checkout_session_id like 'cs_test_refunduat_20261021_%'
union all select 'payment_refunds', count(*) from payment_refunds where stripe_refund_id like 're_refunduat_20261021_%'
union all select 'payment_webhook_issues', count(*) from payment_webhook_issues where event_id like 'evt_refunduat_20261021_%'
union all select 'reservations', count(*) from reservations where idempotency_key like 'refunduat-20261021-%';

-- 5) 다른 구매·실제 고객 행 불변 확인 — 사전 점검 5) 기준선과 비교: 시드가 더한 만큼만 증가해야 한다
--    (purchases +7, entitlement_grants +6, entitlement_ledger +10(grant 6 + hold 2 + consume 1 + F 환불 1), reservations +2,
--     payment_refunds +7, payment_webhook_issues +2, teacher_availability_rules +14, teacher_assignments +2)
select 'purchases' as t, count(*) from purchases
union all select 'entitlement_grants', count(*) from entitlement_grants
union all select 'entitlement_ledger', count(*) from entitlement_ledger
union all select 'reservations', count(*) from reservations
union all select 'payment_refunds', count(*) from payment_refunds
union all select 'payment_webhook_issues', count(*) from payment_webhook_issues
union all select 'teacher_availability_rules', count(*) from teacher_availability_rules
union all select 'teacher_assignments', count(*) from teacher_assignments
union all select 'official@alton.education (auth.users)', count(*) from auth.users where email = 'official@alton.education';
