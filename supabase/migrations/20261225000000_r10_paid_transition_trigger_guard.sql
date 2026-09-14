-- R10 corrective(2026-09-07, 제품 오너 리뷰 — 20261224000000의 CHECK 제약
-- 보강) — CHECK 제약은 행의 "현재" 컬럼만 볼 수 있고 UPDATE 이전(OLD) 상태를
-- 볼 수 없다는 구조적 한계가 있다. 즉 특권 직접 UPDATE 한 문장으로
-- status='approved' -> status='paid'를 쓰면서 동시에 provider_transaction_id·
-- provider_confirmed_at까지 채워 넣으면, provider_pending 단계를 완전히
-- 건너뛰고 DB 함수(mark_payout_batch_provider_confirmed/mark_payout_batch_paid)
-- 밖에서도 CHECK를 통과해버린다. OLD.status를 볼 수 있는 것은 트리거뿐이므로,
-- 이 마이그레이션은 payout_batches/payout_items에 BEFORE INSERT OR UPDATE
-- 트리거를 추가해 "paid로의 전이는 반드시 지정된 이전 상태에서만 가능하다"를
-- 구조적으로 강제한다. 20261224000000의 CHECK 제약은 그대로 유지 —
-- 트리거(전이 경로 강제)와 CHECK(행 자체의 정합성)는 서로 다른 불변을
-- 지키는 상호 보완적 방어이지 대체 관계가 아니다.

-- =========================================================================
-- 1. payout_batches — paid는 반드시 provider_pending에서만, INSERT로 곧바로
--    paid를 만들 수 없다.
-- =========================================================================
create or replace function public.guard_payout_batch_paid_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'paid' then
      raise exception 'payout_batch는 paid 상태로 직접 생성할 수 없습니다. approved까지만 만들고 정규 파이프라인(dispatch_payout_batch -> mark_payout_batch_provider_pending -> mark_payout_batch_provider_confirmed -> mark_payout_batch_paid)을 거치세요.';
    end if;
    return new;
  end if;

  -- UPDATE: paid로 "새로" 전이하는 경우에만 OLD.status를 검사한다(이미 paid인
  -- 행을 그대로 재저장하는 경우는 다른 컬럼 업데이트일 수 있으므로 제외).
  if new.status = 'paid' and old.status is distinct from 'paid' then
    if old.status is distinct from 'provider_pending' then
      raise exception 'payout_batch는 provider_pending 상태에서만 paid로 전이할 수 있습니다(시도한 이전 상태: %). CHECK 제약(provider_transaction_id/provider_confirmed_at)이 채워져 있어도 이 전이 경로 자체가 거부됩니다 — mark_payout_batch_provider_confirmed()로 확인을 기록한 뒤 mark_payout_batch_paid()를 호출하세요.', old.status;
    end if;
  end if;
  return new;
end;
$$;
comment on function public.guard_payout_batch_paid_transition is
  'R10 corrective(2026-09-07, CHECK 제약 보강): CHECK은 OLD.status를 볼 수 없어 approved->paid 직접 UPDATE(확인 컬럼을 같은 문장에서 채우는 경우 포함)를 막지 못했다. 이 트리거가 OLD.status=provider_pending을 구조적으로 강제한다.';

create trigger payout_batches_paid_transition_guard
  before insert or update on payout_batches
  for each row execute function public.guard_payout_batch_paid_transition();

-- =========================================================================
-- 2. payout_items — item의 paid 전이는 반드시 "부모 batch가 이미 paid인"
--    시점에만 허용한다. mark_payout_batch_paid()는 같은 트랜잭션 안에서
--    (1) payout_batches를 paid로 UPDATE -> (2) payout_items를 paid로 UPDATE
--    순서로 실행하므로(20261224000000 정의 그대로, 순서 변경 불필요 —
--    이미 batch 먼저), (2) 시점에 이 트리거가 조회하는 부모 batch 행은 이미
--    paid로 보인다(같은 트랜잭션 내 자신의 앞선 쓰기는 항상 보임). 따라서
--    정상 경로는 그대로 통과하고, item만 독립적으로 paid로 만드는 직접
--    UPDATE/INSERT는 거부된다.
-- =========================================================================
create or replace function public.guard_payout_item_paid_transition()
returns trigger
language plpgsql
as $$
declare
  v_batch_status text;
begin
  if tg_op = 'INSERT' then
    if new.status = 'paid' then
      raise exception 'payout_item은 paid 상태로 직접 생성할 수 없습니다. batch 완료 파이프라인(mark_payout_batch_paid)을 통해서만 paid가 될 수 있습니다.';
    end if;
    return new;
  end if;

  if new.status = 'paid' and old.status is distinct from 'paid' then
    select status into v_batch_status from payout_batches where id = new.batch_id;
    if v_batch_status is distinct from 'paid' then
      raise exception 'payout_item은 부모 payout_batch가 이미 paid 상태일 때만 paid로 전이할 수 있습니다(현재 부모 batch 상태: %). item을 batch와 독립적으로(또는 batch보다 먼저) paid로 만드는 직접 UPDATE는 거부됩니다.', coalesce(v_batch_status, 'null');
    end if;
  end if;
  return new;
end;
$$;
comment on function public.guard_payout_item_paid_transition is
  'R10 corrective(2026-09-07, CHECK 제약 보강): item이 batch와 무관하게(또는 batch가 paid로 확정되기 전에) paid로 직접 전이되는 것을 막는다. mark_payout_batch_paid()가 batch를 먼저 paid로 UPDATE한 뒤 같은 트랜잭션에서 item을 paid로 UPDATE하므로 정상 경로는 영향받지 않는다.';

create trigger payout_items_paid_transition_guard
  before insert or update on payout_items
  for each row execute function public.guard_payout_item_paid_transition();

revoke execute on function public.guard_payout_batch_paid_transition() from public, anon, authenticated, service_role;
revoke execute on function public.guard_payout_item_paid_transition() from public, anon, authenticated, service_role;
-- 트리거 전용 함수 — 직접 호출 불가(Gate B §7 점검 원칙과 동일하게 명시적 revoke).
