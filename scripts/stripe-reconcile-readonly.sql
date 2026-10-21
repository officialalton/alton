-- 읽기 전용 대조 점검: npx supabase db query --linked -f scripts/stripe-reconcile-readonly.sql -o table
-- 범위: 앱 DB 에 기록된 웹훅 receipt/구매/지급만. Stripe 계정의 실제 결제 전체와의 대조는 docs/ops/stripe-owner-checklist.md 의 내보내기 절차로 한다.
select 'receipts_stripe' k, count(*)::text v, min(processed_at)::text lo, max(processed_at)::text hi from external_event_receipts where provider='stripe'
union all select 'receipts_unprocessed', count(*)::text, null, null from external_event_receipts where provider='stripe' and processed_at is null
union all select 'receipts_livemode_true', count(*)::text, null, null from external_event_receipts where provider='stripe' and (payload->>'livemode')='true'
union all select 'purchases_by_status_'||status::text, count(*)::text, min(created_at)::text, max(created_at)::text from purchases group by status
union all select 'succeeded_purchase_without_grant', count(*)::text, null, null from purchases p where status='succeeded' and not exists (select 1 from entitlement_grants g where g.purchase_id_ref=p.id)
union all select 'grant_with_non_succeeded_purchase', count(*)::text, null, null from entitlement_grants g join purchases p on p.id=g.purchase_id_ref where p.status<>'succeeded'
union all select 'succeeded_purchase_without_attempt_succeeded', count(*)::text, null, null from purchases p where status='succeeded' and not exists (select 1 from payment_attempts a where a.purchase_id=p.id and a.status='succeeded')
union all select 'purchase_with_session_but_no_receipt', count(*)::text, null, null from purchases p where stripe_payment_intent_id is not null and not exists (select 1 from external_event_receipts r where r.provider='stripe' and r.payload::text like '%'||p.stripe_payment_intent_id||'%')
union all select 'dup_succeeded_attempts_per_purchase', count(*)::text, null, null from (select purchase_id from payment_attempts where status='succeeded' group by 1 having count(*)>1) x
union all select 'dup_attempt_rows_same_purchase_status_pi', count(*)::text, null, null from (select purchase_id,status,stripe_payment_intent_id from payment_attempts group by 1,2,3 having count(*)>1) x
union all select 'credit_purchases', count(*)::text, min(purchased_at)::text, max(purchased_at)::text from credit_purchases
union all select 'credit_purchases_dup_pi', count(*)::text, null, null from (select stripe_payment_intent_id from credit_purchases where stripe_payment_intent_id is not null group by 1 having count(*)>1) x
union all select 'credit_purchase_without_tx', count(*)::text, null, null from credit_purchases c where not exists (select 1 from credit_transactions t where t.related_purchase_id=c.id)
union all select 'refund_related_receipts', count(*)::text, null, null from external_event_receipts where provider='stripe' and payload->>'type' like 'charge.refund%'
union all select 'purchase_amount_vs_ledger_grant_mismatch', count(*)::text, null, null from purchases p join entitlement_grants g on g.purchase_id_ref=p.id where g.original_quantity<>p.quantity;
