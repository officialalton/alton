-- 환불 수업권 회수(refund_entitlement)의 예약 경합 수정. 이미 적용된 20261013000000 은 수정하지 않고 새로 정정한다.
-- 롤백: 20261013000000 의 refund_entitlement 정의를 다시 create or replace 하면 이전 동작으로 돌아간다.
--
-- 이전 문제: "미래 예약 hold 존재" 검사를 grant 잠금 이전에 해서, 검사~잠금 사이에 새 예약(hold)이 끼어들면
-- 그 예약은 유지된 채 남은 잔량만 회수됐다.
-- 정정: (1) 그 구매의 유료 grant 를 id 오름차순으로 모두 먼저 잠그고(hold_entitlement/consume 도 grant 를 같은
-- 잠금으로 직렬화하므로 이후 예약·소비는 이 트랜잭션이 끝날 때까지 대기), (2) 잠금 이후에 예약 상태를 다시 확인한다 —
-- 미래 활성 hold 이거나, release/consume 으로 해소되지 않은 hold 가 하나라도 있으면 예외로 전체 중단(이 함수를
-- 호출한 resolve_payment_refund / approveRefund 의 회수 장부·처리 완료 표시도 같은 트랜잭션이라 함께 롤백된다).
-- (3) 통과하면 같은 트랜잭션에서 잔량을 회수한다.
-- "예약은 유지하고 남은 잔량만 회수"는 정상 동작이 아니다. 부분 회수가 필요하면 별도 관리자 작업(미구현, 문서 참고).
create or replace function public.refund_entitlement(p_purchase_id uuid, p_business_event_id text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_grant record;
  v_remaining int;
begin
  -- 1) 일정한 순서(id 오름차순)로 모두 잠금.
  perform 1 from entitlement_grants
    where purchase_id_ref = p_purchase_id and is_paid
    order by id
    for update;

  -- 2) 잠금 이후 재확인.
  if purchase_has_active_future_holds(p_purchase_id) or exists (
    select 1
    from entitlement_ledger h
    join entitlement_grants g on g.id = h.grant_id
    where g.purchase_id_ref = p_purchase_id and g.is_paid and h.event_type = 'hold'
      and not exists (
        select 1 from entitlement_ledger r
        where r.reservation_id = h.reservation_id and r.event_type in ('release', 'consume')
      )
  ) then
    raise exception '아직 소진되지 않은 예약이 있어 환불을 진행할 수 없습니다. 먼저 해당 예약을 취소해 수업권을 해제해주세요.';
  end if;

  -- 3) 같은 트랜잭션에서 회수(재실행 안전: business_event_id 유니크).
  for v_grant in
    select id from entitlement_grants
    where purchase_id_ref = p_purchase_id and is_paid
    order by id
  loop
    select coalesce(sum(amount), 0) into v_remaining from entitlement_ledger where grant_id = v_grant.id;
    if v_remaining > 0 then
      insert into entitlement_ledger (grant_id, event_type, amount, business_event_id)
      values (v_grant.id, 'refund', -v_remaining, p_business_event_id || ':' || v_grant.id::text)
      on conflict do nothing;
    end if;
  end loop;
end;
$$;
revoke execute on function public.refund_entitlement(uuid, text) from public, anon, authenticated;
grant execute on function public.refund_entitlement(uuid, text) to service_role;
