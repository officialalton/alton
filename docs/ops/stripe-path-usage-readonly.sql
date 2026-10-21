-- 읽기 전용(SELECT만). 오너/배포 담당이 Production(공유 worpsqwqgnspddnrtnvq) 에서 실행해 결과를 전달.
-- 경로별 최근 구매 건수: P = purchases(entitlement) 경로, L = 레거시 credit_packages 경로.
select 'P purchases total' k, count(*) from purchases
union all select 'P purchases succeeded', count(*) from purchases where status = 'succeeded'
union all select 'P purchases last 30d', count(*) from purchases where created_at > now() - interval '30 days'
union all select 'L credit_purchases total', count(*) from credit_purchases
union all select 'L credit_purchases last 30d', count(*) from credit_purchases where purchased_at > now() - interval '30 days'
union all select 'L credit_purchases with session id', count(*) from credit_purchases where stripe_checkout_session_id is not null
union all select 'P payment_attempts with attempt_key', count(*) from payment_attempts where attempt_key is not null
union all select 'stripe receipts total', count(*) from external_event_receipts where provider = 'stripe'
union all select 'stripe receipts UNPROCESSED', count(*) from external_event_receipts where provider = 'stripe' and processed_at is null
union all select 'P purchases succeeded w/o grant', count(*) from purchases p where p.status = 'succeeded' and not exists (select 1 from entitlement_grants g where g.purchase_id_ref = p.id)
union all select 'P purchases w/ >1 succeeded attempts', count(*) from (select purchase_id from payment_attempts where status = 'succeeded' group by 1 having count(*) > 1) x
union all select 'L credit_purchases w/o transaction (orphan)', count(*) from credit_purchases cp where not exists (select 1 from credit_transactions t where t.related_purchase_id = cp.id)
union all select 'L duplicate credit_purchases same payment_intent', count(*) from (select stripe_payment_intent_id from credit_purchases where stripe_payment_intent_id is not null group by 1 having count(*) > 1) y;
