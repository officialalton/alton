-- 정리: 실행 ID refunduat-20261021 로 식별되는 행만 삭제/무효화. UAT 종료 후 실행.
-- 한 트랜잭션. 멱등(여러 번 실행해도 안전).
--
-- 방식과 한계 (사유):
--  * entitlement_ledger 는 INSERT-only(트리거)이고 grant/예약이 ledger 를 FK 로 참조한다 → grant·ledger·reservation·
--    session·purchase 행은 삭제할 수 없다. 대신 "비활성 표시"로 대체한다:
--      - 남은 잔량은 ledger 'adjust' 음수 행(business_event_id 'refunduat-20261021:cleanup:<키>')으로 0 으로 맞추고,
--      - grant.expires_at 을 과거로 당겨 예약에 다시 쓰이지 않게 하고,
--      - purchase.status 를 'cancelled' 로 바꿔 매출·구매 집계에서 빠지게 하며(식별자 cs_test_refunduat_… 와
--        price_policy_version='refunduat-20261021' 은 그대로 남아 추적 가능),
--      - 소비 완료된 예약(B)은 취소 상태 + 세션 company_cancelled(지급 0)로 표시, 미소진 hold(H)는 제품 경로
--        cancel_lesson_booking 으로 해제한다.
--  * 삭제하는 것: payment_refunds, payment_webhook_issues(이 실행 ID 행), 임시 teacher_availability_rules,
--    (시드가 만든 활성 teacher_assignments 는 세션이 참조해 삭제되지 않는다 — 리허설에서 확인 — 종료 처리 status='ended' 로 대체).
--  * 남는 것(삭제 불가, 위 비활성 표시만): 구매 7, grant 6, ledger(시드 10 + 정리 adjust 0~n), 예약 2, 세션 2,
--    예약 알림 대기열 행(status='cancelled'), reservation_cancellations 1~2. 모두 테스트 계정 3가족과 환불 UAT 전용 선생님에만 연결.
-- 공식 계정(official@alton.education)·실제 고객 행은 어떤 문장에서도 건드리지 않는다(아래 검증으로 행 수 확인).

-- ===== 정리 전 확인(읽기 전용) =====
select 'before: run purchases' as t, count(*) from purchases where stripe_checkout_session_id like 'cs_test_refunduat_20261021_%'
union all select 'before: run payment_refunds', count(*) from payment_refunds where stripe_refund_id like 're_refunduat_20261021_%'
union all select 'before: run payment_webhook_issues', count(*) from payment_webhook_issues where event_id like 'evt_refunduat_20261021_%'
union all select 'before: non-run purchases', count(*) from purchases where coalesce(stripe_checkout_session_id, '') not like 'cs_test_refunduat_20261021_%'
union all select 'before: non-run grants', count(*) from entitlement_grants where purchase_id_ref is null or purchase_id_ref not in (select id from purchases where stripe_checkout_session_id like 'cs_test_refunduat_20261021_%')
union all select 'before: non-run ledger', count(*) from entitlement_ledger where grant_id not in (select g.id from entitlement_grants g join purchases p on p.id = g.purchase_id_ref where p.stripe_checkout_session_id like 'cs_test_refunduat_20261021_%')
union all select 'before: non-run reservations', count(*) from reservations where coalesce(idempotency_key, '') not like 'refunduat-20261021-%'
union all select 'before: non-run payment_refunds', count(*) from payment_refunds where stripe_refund_id not like 're_refunduat_20261021_%'
union all select 'before: non-run payment_webhook_issues', count(*) from payment_webhook_issues where event_id not like 'evt_refunduat_20261021_%'
union all select 'before: official account rows', count(*) from auth.users where email = 'official@alton.education';

begin;

-- 1) 미소진 미래 hold(H 등)는 제품 경로로 해제. 소비 완료 예약(B)은 직접 취소 표시.
do $$
declare
  v_res record;
  v_admin uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
begin
  for v_res in
    select r.id, r.status::text as status,
           exists (select 1 from entitlement_ledger l where l.reservation_id = r.id and l.event_type = 'consume') as consumed,
           exists (select 1 from entitlement_ledger l where l.reservation_id = r.id and l.event_type = 'release') as released
    from reservations r
    where r.idempotency_key like 'refunduat-20261021-%' and r.status::text = 'confirmed'
  loop
    if not v_res.consumed and not v_res.released then
      perform cancel_lesson_booking(v_res.id, 'company', v_admin, 'refunduat-20261021 cleanup');
    else
      update reservations set status = 'cancelled' where id = v_res.id;
      insert into reservation_cancellations (reservation_id, cancelled_by_role, cancelled_by_id, reason, entitlement_disposition)
      values (v_res.id, 'company', v_admin, 'refunduat-20261021 cleanup',
              case when v_res.consumed then 'consumed' else 'released' end)
      on conflict do nothing;
      update sessions
         set final_status = 'company_cancelled', payable_minutes = 0, final_reason = 'refunduat-20261021 cleanup',
             final_actor_id = v_admin, finalized_at = now()
       where reservation_id = v_res.id and final_status in ('scheduled', 'live');
    end if;
  end loop;
end $$;

-- 2) 남은 알림 대기열 취소(제품 경로가 취소 알림을 새로 쌓았을 수 있음)
update booking_notification_outbox
   set status = 'cancelled'
 where status = 'pending'
   and reservation_id in (select id from reservations where idempotency_key like 'refunduat-20261021-%');

-- 3) 남은 수업권 잔량을 ledger 'adjust' 음수로 0 으로 맞춘다(append-only 와 호환, 멱등: 잔량 0 이면 행 없음).
insert into entitlement_ledger (grant_id, event_type, amount, business_event_id)
select g.id, 'adjust', -b.bal, 'refunduat-20261021:cleanup:' || substr(p.stripe_checkout_session_id, length('cs_test_refunduat_20261021_') + 1)
from purchases p
join entitlement_grants g on g.purchase_id_ref = p.id
join lateral (select coalesce(sum(l.amount), 0) as bal from entitlement_ledger l where l.grant_id = g.id) b on true
where p.stripe_checkout_session_id like 'cs_test_refunduat_20261021_%' and b.bal > 0
on conflict do nothing;

-- 4) grant 만료 처리 + 구매 취소 표시
update entitlement_grants g
   set expires_at = now() - interval '1 second'
  from purchases p
 where g.purchase_id_ref = p.id and p.stripe_checkout_session_id like 'cs_test_refunduat_20261021_%'
   and g.expires_at > now();
update purchases
   set status = 'cancelled'
 where stripe_checkout_session_id like 'cs_test_refunduat_20261021_%' and status::text <> 'cancelled';

-- 5) 환불 기록·웹훅 이상 삭제(이 실행 ID 의 UAT 전용 행만)
delete from payment_refunds where stripe_refund_id like 're_refunduat_20261021_%';
delete from payment_webhook_issues where event_id like 'evt_refunduat_20261021_%';

-- 6) 임시 가능시간 규칙·활성 배정 되돌리기. 시드 트랜잭션이 만든 행은 예약 행과 created_at 이 같다(같은 트랜잭션의 now()).
do $$
declare
  v_seed_ts timestamptz := (select min(created_at) from reservations where idempotency_key like 'refunduat-20261021-%');
begin
  if v_seed_ts is null then
    return; -- 이미 정리됐거나 시드가 없었음 → 건드릴 것 없음
  end if;
  delete from teacher_availability_rules
   where created_at = v_seed_ts and created_by = 'aaaaaaaa-0000-0000-0000-000000000001'
     and teacher_id in ('bc456195-a6d5-42a4-ab3c-b1436e5b7ae6', '9b4b4d49-6437-47b4-8741-222cb3589423');
  begin
    delete from teacher_assignments
     where created_at = v_seed_ts and status::text = 'active'
       and subject_enrollment_id in ('70fcee30-5714-48ec-ac0c-6b67fd313c00', '0e6bec49-4321-4434-be9a-15a9cc6fd703');
  exception when foreign_key_violation then
    update teacher_assignments
       set status = 'ended', effective_until = now()
     where created_at = v_seed_ts and status::text = 'active'
       and subject_enrollment_id in ('70fcee30-5714-48ec-ac0c-6b67fd313c00', '0e6bec49-4321-4434-be9a-15a9cc6fd703');
  end;
end $$;

commit;

-- ===== 정리 후 확인(읽기 전용) =====
-- 기대: run payment_refunds/issues 0, run purchases 7(전부 cancelled), run balance 0, 활성 배정 0, 임시 규칙 0,
--       non-run 행 수는 '정리 전 확인'과 동일, official account rows 는 이전과 동일(보통 1).
select 'after: run payment_refunds' as t, count(*) from payment_refunds where stripe_refund_id like 're_refunduat_20261021_%'
union all select 'after: run payment_webhook_issues', count(*) from payment_webhook_issues where event_id like 'evt_refunduat_20261021_%'
union all select 'after: run purchases (cancelled)', count(*) from purchases where stripe_checkout_session_id like 'cs_test_refunduat_20261021_%' and status::text = 'cancelled'
union all select 'after: run purchases (not cancelled)', count(*) from purchases where stripe_checkout_session_id like 'cs_test_refunduat_20261021_%' and status::text <> 'cancelled'
union all select 'after: run grants with balance <> 0', count(*) from (
    select g.id from entitlement_grants g join purchases p on p.id = g.purchase_id_ref join entitlement_ledger l on l.grant_id = g.id
    where p.stripe_checkout_session_id like 'cs_test_refunduat_20261021_%' group by g.id having sum(l.amount) <> 0) x
union all select 'after: run reservations still confirmed', count(*) from reservations where idempotency_key like 'refunduat-20261021-%' and status::text = 'confirmed'
union all select 'after: run outbox pending', count(*) from booking_notification_outbox where status = 'pending' and reservation_id in (select id from reservations where idempotency_key like 'refunduat-20261021-%')
union all select 'after: active assignments on Y/Z enrollments', count(*) from teacher_assignments where status::text = 'active' and subject_enrollment_id in ('70fcee30-5714-48ec-ac0c-6b67fd313c00', '0e6bec49-4321-4434-be9a-15a9cc6fd703')
union all select 'after: temp availability rules', count(*) from teacher_availability_rules where teacher_id in ('bc456195-a6d5-42a4-ab3c-b1436e5b7ae6', '9b4b4d49-6437-47b4-8741-222cb3589423')
union all select 'after: non-run purchases', count(*) from purchases where coalesce(stripe_checkout_session_id, '') not like 'cs_test_refunduat_20261021_%'
union all select 'after: non-run grants', count(*) from entitlement_grants where purchase_id_ref is null or purchase_id_ref not in (select id from purchases where stripe_checkout_session_id like 'cs_test_refunduat_20261021_%')
union all select 'after: non-run ledger', count(*) from entitlement_ledger where grant_id not in (select g.id from entitlement_grants g join purchases p on p.id = g.purchase_id_ref where p.stripe_checkout_session_id like 'cs_test_refunduat_20261021_%')
union all select 'after: non-run reservations', count(*) from reservations where coalesce(idempotency_key, '') not like 'refunduat-20261021-%'
union all select 'after: non-run payment_refunds', count(*) from payment_refunds where stripe_refund_id not like 're_refunduat_20261021_%'
union all select 'after: non-run payment_webhook_issues', count(*) from payment_webhook_issues where event_id not like 'evt_refunduat_20261021_%'
union all select 'after: official account rows', count(*) from auth.users where email = 'official@alton.education';
