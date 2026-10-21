-- 관리자 환불·웹훅 이상 처리 화면 Preview UAT 시드. 실행 ID: refunduat-20261021
-- 한 트랜잭션: 하나라도 실패하면 전부 롤백된다. 이 실행 ID 의 행이 이미 있으면 사전 점검에서 중단(재실행 안전).
-- 적용 순서: precheck.sql(읽기) → seed.sql → verify.sql(읽기) → [Preview UAT] → cleanup.sql (cleanup 은 정리 전·후 확인 SELECT 포함).
-- rehearsal-prep.sql 은 격리 스택 전용(공유 DB 에는 같은 계정이 이미 있으므로 적용 금지).
-- 선행: migration 20261030100000·20261031100000 적용, precheck.sql 통과.
-- 주의: 예약 시나리오(B,H)는 시드 시점 기준 +9/+10일 UTC 17시 슬롯을 쓴다. 시드 후 UAT 는 H 예약이 미래인 동안(약 9일 내) 진행.
-- UAT 중 H 예약을 제품 UI 로 취소하면 취소 알림이 대기열에 쌓일 수 있다(대상은 테스트 계정) — 정리 SQL 이 대기열을 취소한다.
-- 새 계정은 만들지 않는다. 기존 테스트 가족(is_test_account=true, endasg… 자동 테스트 잔존 계정) 3개만 쓴다.
--   X: 환불 기록 시나리오 A,C,D,F,G (예약 없음)      student 458c121e-…
--   Y: 시나리오 B (실제 예약 RPC 로 1회 소비)         student 851e4c76-…
--   Z: 시나리오 H (실제 예약 RPC 로 미래 예약 점유)   student e0ca6b26-…
-- 가짜 Stripe 식별자: pi_refunduat_20261021_<키> / cs_test_refunduat_20261021_<키> / ch_… / re_… / evt_… (실제 Stripe 와 무관).
-- 모든 UUID 는 md5('refunduat-20261021:<종류>:<키>')::uuid 로 결정적 → 정리 SQL 이 같은 식으로 재계산한다.
-- 실제 고객·공식 계정(official@alton.education)·다른 구매의 grant 는 건드리지 않는다.
begin;

do $$
declare
  v_bad int;
begin
  if exists (select 1 from purchases where stripe_checkout_session_id like 'cs_test_refunduat_20261021_%')
     or exists (select 1 from payment_refunds where stripe_refund_id like 're_refunduat_20261021_%')
     or exists (select 1 from payment_webhook_issues where event_id like 'evt_refunduat_20261021_%') then
    raise exception 'refunduat-20261021: 이미 시드된 행이 있습니다(정리 후에도 취소 표시된 구매 행은 남으므로, 재시드는 파일의 실행 ID 를 새 값으로 바꿔서 하세요).';
  end if;

  select count(*) into v_bad from (values
    ('458c121e-423f-4cf3-a1db-e8b2ba25ea65'::uuid, '04a0f226-84e5-4a85-b42f-72ab567f4ec6'::uuid, 'dd80f175-ba28-4b29-989e-45bb990a36de'::uuid),
    ('851e4c76-a4f7-43b2-a64d-ac24849fbe29'::uuid, 'b57e6983-e0d8-41d5-9e83-07a2156a7324'::uuid, '2529b513-5222-4915-874e-34b9f0ecd4bf'::uuid),
    ('e0ca6b26-d2b3-4d1e-bb56-4a63cd7c1ff8'::uuid, 'e0ea0cf6-3e2a-4bbc-8d60-f9bbcd126b11'::uuid, '8cd8783f-b693-488b-878a-e05fdb60986f'::uuid)
  ) f(child, hh, contract)
  where not exists (select 1 from students s where s.id = f.child and s.is_test_account)
     or not exists (select 1 from contracts c where c.id = f.contract and c.child_id = f.child and c.household_id = f.hh and c.status::text = 'active')
     or exists (select 1 from entitlement_grants g where g.child_id = f.child)
     or exists (select 1 from purchases p where p.child_id = f.child);
  if v_bad > 0 then
    raise exception 'refunduat-20261021: 대상 테스트 가족이 전제와 다릅니다(테스트 계정·활성 계약·기존 grant/구매 없음). 사전 점검 SQL 확인.';
  end if;

  if (select count(*) from entitlement_products where code in ('lesson_pack_10', 'lesson_pack_1')) <> 2 then
    raise exception 'refunduat-20261021: 상품 lesson_pack_10 / lesson_pack_1 이 없습니다.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1) 구매 + 수업권 grant (원장 일관: grant 행마다 ledger 'grant' +수량)
-- ---------------------------------------------------------------------------
create temp table _spec (
  key text primary key, fam text, product text, purchase_status text, with_grant boolean
) on commit drop;
insert into _spec values
  ('A', 'X', 'lesson_pack_10', 'succeeded',              true),
  ('B', 'Y', 'lesson_pack_10', 'succeeded',              true),
  ('C', 'X', 'lesson_pack_1',  'succeeded',              true),
  ('D', 'X', 'lesson_pack_1',  'succeeded',              true),
  ('F', 'X', 'lesson_pack_1',  'succeeded',              true),
  ('G', 'X', 'lesson_pack_1',  'reconciliation_needed',  false),
  ('H', 'Z', 'lesson_pack_10', 'succeeded',              true);

create temp table _fam (fam text primary key, child uuid, hh uuid, contract uuid) on commit drop;
insert into _fam values
  ('X', '458c121e-423f-4cf3-a1db-e8b2ba25ea65', '04a0f226-84e5-4a85-b42f-72ab567f4ec6', 'dd80f175-ba28-4b29-989e-45bb990a36de'),
  ('Y', '851e4c76-a4f7-43b2-a64d-ac24849fbe29', 'b57e6983-e0d8-41d5-9e83-07a2156a7324', '2529b513-5222-4915-874e-34b9f0ecd4bf'),
  ('Z', 'e0ca6b26-d2b3-4d1e-bb56-4a63cd7c1ff8', 'e0ea0cf6-3e2a-4bbc-8d60-f9bbcd126b11', '8cd8783f-b693-488b-878a-e05fdb60986f');

insert into purchases (
  id, household_id, child_id, contract_id, entitlement_product_id, product_version_id, quantity,
  unit_price_minor, package_price_minor, discount_minor, discount_percent, tax_minor, total_minor, currency,
  validity_months, status, price_policy_version, expires_at,
  stripe_checkout_session_id, stripe_payment_intent_id, created_at, confirmed_at
)
select
  md5('refunduat-20261021:purchase:' || s.key)::uuid, f.hh, f.child, f.contract, ep.id, v.id, ep.quantity,
  v.unit_price_minor, v.price_minor, v.discount_minor, v.discount_percent, 0, v.price_minor, v.currency,
  v.validity_months, s.purchase_status::v3_payment_attempt_status, 'refunduat-20261021',
  case when s.purchase_status = 'succeeded' then now() + make_interval(months => v.validity_months) end,
  'cs_test_refunduat_20261021_' || s.key, 'pi_refunduat_20261021_' || s.key,
  now() - interval '3 days', case when s.purchase_status = 'succeeded' then now() - interval '3 days' end
from _spec s
join _fam f on f.fam = s.fam
join entitlement_products ep on ep.code = s.product
join lateral (
  select * from entitlement_product_versions pv
  where pv.entitlement_product_id = ep.id and pv.effective_until is null and pv.discontinued_at is null
  order by pv.version_number desc limit 1
) v on true;

insert into entitlement_grants (id, child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
select md5('refunduat-20261021:grant:' || s.key)::uuid, f.child, ep.id, md5('refunduat-20261021:purchase:' || s.key)::uuid,
       ep.quantity, now() + interval '12 months', true
from _spec s join _fam f on f.fam = s.fam join entitlement_products ep on ep.code = s.product
where s.with_grant;

insert into entitlement_ledger (grant_id, event_type, amount, business_event_id)
select g.id, 'grant', g.original_quantity, 'refunduat-20261021:grant:' || s.key
from _spec s join entitlement_grants g on g.id = md5('refunduat-20261021:grant:' || s.key)::uuid
where s.with_grant;

-- ---------------------------------------------------------------------------
-- 2) 예약 경로(B: 1회 소비, H: 미래 예약 점유) — 제품의 confirm_lesson_booking / consume_entitlement RPC 사용.
--    Y·Z 의 (종료된) 환불 UAT 전용 테스트 선생님에게 임시 가능시간 규칙과 활성 배정을 넣는다. 정리 SQL 이 되돌린다.
-- ---------------------------------------------------------------------------
insert into teacher_availability_rules (teacher_id, day_of_week, start_time_local, end_time_local, timezone, created_by)
select t, d, '00:00', '23:59', 'America/Los_Angeles', 'aaaaaaaa-0000-0000-0000-000000000001'
from (values ('bc456195-a6d5-42a4-ab3c-b1436e5b7ae6'::uuid), ('9b4b4d49-6437-47b4-8741-222cb3589423'::uuid)) tt(t),
     generate_series(0, 6) d;

insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, source)
values ('70fcee30-5714-48ec-ac0c-6b67fd313c00', 'bc456195-a6d5-42a4-ab3c-b1436e5b7ae6', 'active', now() - interval '1 day', 'app'),
       ('0e6bec49-4321-4434-be9a-15a9cc6fd703', '9b4b4d49-6437-47b4-8741-222cb3589423', 'active', now() - interval '1 day', 'app');

do $$
declare
  v_lesson_type uuid := (select id from lesson_types where code = 'regular');
  v_day0 timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  v_start timestamptz;
  v_res uuid;
begin
  -- B: 9일 뒤 UTC 17시(미국 서부 오전) 1시간 예약 후 소비
  v_start := v_day0 + interval '9 days 17 hours';
  select reservation_id into v_res from confirm_lesson_booking(
    '851e4c76-a4f7-43b2-a64d-ac24849fbe29', '70fcee30-5714-48ec-ac0c-6b67fd313c00', 'bc456195-a6d5-42a4-ab3c-b1436e5b7ae6',
    v_lesson_type, v_start, v_start + interval '1 hour', 'refunduat-20261021-B1');
  perform consume_entitlement(v_res);

  -- H: 10일 뒤 같은 시각 예약(점유 유지)
  v_start := v_day0 + interval '10 days 17 hours';
  perform reservation_id from confirm_lesson_booking(
    'e0ca6b26-d2b3-4d1e-bb56-4a63cd7c1ff8', '0e6bec49-4321-4434-be9a-15a9cc6fd703', '9b4b4d49-6437-47b4-8741-222cb3589423',
    v_lesson_type, v_start, v_start + interval '1 hour', 'refunduat-20261021-H1');
end $$;

-- 예약 RPC 가 쌓은 알림 대기열(확정·리마인더)은 같은 트랜잭션에서 즉시 취소한다 — 테스트 계정에 실제 메일이 나가지 않게.
update booking_notification_outbox
   set status = 'cancelled'
 where status = 'pending'
   and reservation_id in (select id from reservations where idempotency_key like 'refunduat-20261021-%');

-- F: 이미 수동 회수된 구매 — 실제 refund_entitlement 와 같은 형식의 환불 원장(business_event_id 'manual-refund:<구매>:<grant>')
insert into entitlement_ledger (grant_id, event_type, amount, business_event_id)
values (md5('refunduat-20261021:grant:F')::uuid, 'refund', -1,
        'manual-refund:' || md5('refunduat-20261021:purchase:F')::uuid::text || ':' || md5('refunduat-20261021:grant:F')::uuid::text);

-- ---------------------------------------------------------------------------
-- 3) 환불 기록 A~F, H  (E 는 구매 미연결)
--    자동 회수 플래그는 꺼진 상태를 가정 → auto_revoke_status 는 비워 둔다("자동 회수 꺼짐 — 관리자 확인 필요").
-- ---------------------------------------------------------------------------
insert into payment_refunds (
  purchase_id, stripe_refund_id, stripe_charge_id, stripe_payment_intent_id, amount_minor, currency, status, reason,
  needs_review, created_at, updated_at
)
select
  case when r.key = 'E' then null else p.id end,
  're_refunduat_20261021_' || r.key, 'ch_refunduat_20261021_' || r.key, 'pi_refunduat_20261021_' || r.key,
  case when r.key = 'E' then 12345 else p.total_minor end, 'USD', r.stripe_status,
  'refunduat-20261021 ' || r.key || ': ' || r.memo,
  true, now() - r.age, now() - r.age
from (values
  ('A', 'succeeded', '전액 환불 · 수업권 전부 미사용 · 수동 회수 가능', interval '6 hours'),
  ('B', 'succeeded', '전액 환불 · 1회 소비됨 · 잔량 회수 동작 확인', interval '5 hours'),
  ('C', 'pending',   'Stripe 환불 대기 · 회수 불가(확인 완료만)',       interval '4 hours'),
  ('D', 'failed',    'Stripe 환불 실패 · 회수 불가(확인 완료만)',       interval '3 hours'),
  ('E', 'succeeded', '구매 미연결 환불 · 확인 완료만 가능',              interval '2 hours'),
  ('H', 'succeeded', '전액 환불 · 미래 예약이 수업권 점유 · 회수 거부 확인', interval '1 hour')
) r(key, stripe_status, memo, age)
left join purchases p on p.stripe_checkout_session_id = 'cs_test_refunduat_20261021_' || r.key;

-- F: 이미 처리된 행(처리자·시각·사유 있음)
insert into payment_refunds (
  purchase_id, stripe_refund_id, stripe_charge_id, stripe_payment_intent_id, amount_minor, currency, status, reason,
  needs_review, handled_by, handled_at, handled_action, handled_note, created_at, updated_at
)
select p.id, 're_refunduat_20261021_F', 'ch_refunduat_20261021_F', 'pi_refunduat_20261021_F', p.total_minor, 'USD', 'succeeded',
       'refunduat-20261021 F: 이미 수동 회수 완료된 환불(UAT 시드)',
       false, 'aaaaaaaa-0000-0000-0000-000000000001', now() - interval '1 day', 'revoke',
       'refunduat-20261021 F: UAT 시드 — 수업권 수동 회수 완료', now() - interval '2 days', now() - interval '1 day'
from purchases p where p.stripe_checkout_session_id = 'cs_test_refunduat_20261021_F';

-- ---------------------------------------------------------------------------
-- 4) 웹훅 이상 G: 모드 불일치 1건 + 금액 불일치 1건(미해결)
-- ---------------------------------------------------------------------------
insert into payment_webhook_issues (event_id, kind, purchase_id, detail, created_at)
values ('evt_refunduat_20261021_G1', 'livemode_mismatch', null,
        jsonb_build_object('run_id', 'refunduat-20261021', 'scenario', 'G1', 'event_livemode', true, 'server_livemode', false,
                           'note', 'UAT 시드 — 가짜 이벤트, 실제 Stripe 와 무관'),
        now() - interval '2 hours');
insert into payment_webhook_issues (event_id, kind, purchase_id, detail, created_at)
select 'evt_refunduat_20261021_G2', 'amount_mismatch', p.id,
       jsonb_build_object('run_id', 'refunduat-20261021', 'scenario', 'G2', 'expected_minor', p.total_minor,
                          'received_minor', p.total_minor - 500, 'currency', 'usd',
                          'note', 'UAT 시드 — 가짜 이벤트, 실제 Stripe 와 무관'),
       now() - interval '1 hour'
from purchases p where p.stripe_checkout_session_id = 'cs_test_refunduat_20261021_G';

commit;
