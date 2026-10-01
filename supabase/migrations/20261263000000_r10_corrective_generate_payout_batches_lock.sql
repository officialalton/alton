-- R10 corrective(2026-09-09, 기반 안정화 계획 7절 6단계 — 정산 batch 생성
-- 동시성) — generate_payout_batches()의 실제 중복 배정 재현 결과를 닫는다.
--
-- 재현: 두 트랜잭션이 같은 미배치 pending 항목 집합을 동시에 SELECT(잠금
-- 없음)하면 둘 다 그 항목을 포함하는 별개의 batch를 만들고, 이어지는
-- UPDATE payout_items ... where id = any(item_ids)에는 "batch_id가 여전히
-- null인 행만"이라는 조건이 없어 나중에 커밋하는 쪽이 먼저 커밋한 쪽의 배정을
-- 그대로 덮어쓴다. 실제로 두 번 재현했다 — 두 호출 모두 item_count=1을
-- 반환했지만(둘 다 자기가 그 항목을 배정했다고 믿음), 최종적으로 그 항목은
-- 정확히 한 batch에만 연결되고 다른 하나는 반환값과 달리 실제로는 빈 고아
-- batch가 된다(테스트:
-- lib/booking/payout-batch-lifecycle.integration.test.ts "동시 호출 시 미배치
-- 항목이 두 batch에 이중 배정되거나 유실되지 않는다").
--
-- 결과적으로 이중 지급(같은 항목이 두 batch 모두에서 실제로 지급됨)까지는
-- 아니었다(batch_id가 단일 컬럼이라 최종적으로 한 batch만 소유) — 하지만
-- item_count가 실제와 다른 고아 batch가 남아 관리자에게 잘못된 정보를 주고,
-- "두 관리자가 거의 동시에 배치 생성 버튼을 누르는" 실제 발생 가능한 시나리오라
-- 닫아야 한다.
--
-- 수정: 후보 항목을 집계(GROUP BY)하기 전에 서브쿼리에서 먼저
-- `for update skip locked`로 잠근다. 같은 항목을 두 트랜잭션이 동시에 두
-- 번 후보로 삼는 것 자체를 원천 차단한다 — 이미 다른 트랜잭션이 잠근 행은
-- "존재하지 않는 것처럼" 건너뛰므로(SKIP LOCKED), 뒤늦게 실행되는 호출은 그
-- 항목이 포함된 그룹 자체를 만들지 않는다(대기해서 나중에 다시 배정하는 것도
-- 아니고, 아예 이번 호출에서 제외 — "미배치 항목을 지금 당장 원자적으로
-- 선점"이라는 이 함수의 멱등 재시도 특성과 정확히 맞는다).

create or replace function public.generate_payout_batches(
  p_period_start date,
  p_period_end date,
  p_teacher_id uuid default null
)
returns table (batch_id uuid, out_teacher_id uuid, currency text, item_count int, total_amount_minor bigint)
language plpgsql
as $$
declare
  v_group record;
  v_batch_id uuid;
begin
  for v_group in
    select
      g_teacher_id,
      g_currency,
      array_agg(item_id) as item_ids,
      count(*) as g_count,
      sum(amount_minor) as g_total
    from (
      select
        pi.id as item_id,
        pi.teacher_id as g_teacher_id,
        pi.currency as g_currency,
        pi.amount_minor
      from payout_items pi
      join sessions s on s.id = pi.session_id
      join reservations r on r.id = s.reservation_id
      where pi.batch_id is null
        and pi.status = 'pending'
        and (p_teacher_id is null or pi.teacher_id = p_teacher_id)
        and r.starts_at::date between p_period_start and p_period_end
      order by pi.id
      for update of pi skip locked
    ) locked_candidates
    group by g_teacher_id, g_currency
  loop
    insert into payout_batches (teacher_id, period_start, period_end, currency, status)
    values (v_group.g_teacher_id, p_period_start, p_period_end, v_group.g_currency, 'calculated')
    returning id into v_batch_id;

    update payout_items
      set batch_id = v_batch_id, status = 'batched'
      where id = any (v_group.item_ids);

    batch_id := v_batch_id;
    out_teacher_id := v_group.g_teacher_id;
    currency := v_group.g_currency;
    item_count := v_group.g_count;
    total_amount_minor := v_group.g_total;
    return next;
  end loop;
end;
$$;
comment on function public.generate_payout_batches is
  'R10 corrective(2026-09-09): 후보 payout_items를 FOR UPDATE SKIP LOCKED로 먼저 잠근 뒤 집계한다 — 동시 호출이 같은 미배치 항목을 두 번 그룹핑해 서로의 batch 배정을 덮어쓰는 경합(실제 재현됨: 두 호출 모두 item_count=1을 반환하지만 한쪽은 실제로는 빈 고아 batch가 되는 현상)을 막는다. SKIP LOCKED이므로 뒤늦게 실행되는 호출은 대기하지 않고 그 항목을 이번 호출의 그룹에서 제외한다(다음 호출에서 그 항목은 이미 batch_id가 배정돼 있어 재조회되지 않음 — 기존 멱등 정책 그대로 유지).';
