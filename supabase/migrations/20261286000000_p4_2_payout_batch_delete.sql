-- P4-2(UAT 후속) — 승인 전 정산 묶음 삭제 (2026-09-12)
--
-- 배경(제품 오너 UAT 피드백): 마감을 잘못된 기간으로 돌렸을 때 되돌릴 방법이
-- 없었다. 검토 전후(= 승인 전)에는 묶음을 없애고 항목을 다시 미배치 상태로
-- 돌릴 수 있어야 한다.
--
-- 경계:
--  * 승인 이후(approved/dispatch_requested/provider_pending/processing/paid/failed)는
--    삭제할 수 없다 — 이미 사람이 지급 대상으로 판단했거나 실행 단계다.
--  * **관리자 조정이 하나라도 있는 묶음은 삭제하지 않는다.** 조정 이력
--    (payout_batch_adjustments)은 INSERT-only 감사 기록이라 지울 수 없고,
--    묶음만 지우면 FK가 깨진다. 조정이 붙었다는 건 이미 사람이 판단을
--    시작했다는 뜻이기도 하다.
--  * 삭제 시 세션 기반 항목은 지우지 않고 **미배치(pending)로 되돌린다** —
--    다음 마감에 다시 잡힌다. 자동 산정 근거는 어떤 경우에도 사라지지 않는다.

create or replace function public.delete_payout_batch(p_batch_id uuid, p_actor_id uuid)
returns void
language plpgsql
security definer set search_path = public as $$
declare
  v_batch payout_batches%rowtype;
  v_adjustment_count int;
begin
  select * into v_batch from payout_batches where id = p_batch_id for update;
  if not found then
    raise exception '존재하지 않는 정산 묶음입니다.';
  end if;

  if v_batch.status not in ('draft', 'calculated', 'reviewing', 'reviewed') then
    raise exception '승인 전(검토 단계) 묶음만 삭제할 수 있습니다(현재: %).', v_batch.status;
  end if;

  select count(*) into v_adjustment_count from payout_batch_adjustments where batch_id = p_batch_id;
  if v_adjustment_count > 0 then
    raise exception '조정 내역이 있는 묶음은 삭제할 수 없습니다(조정 %건). 조정을 되돌리려면 반대 금액으로 다시 조정하세요.', v_adjustment_count;
  end if;

  -- 수업 기반 항목은 미배치로 되돌린다(삭제하지 않는다 — 자동 산정 근거 보존).
  update payout_items
    set batch_id = null, status = 'pending'
    where batch_id = p_batch_id and session_id is not null;

  -- 세션에 매이지 않은 항목(이월 조정 등)도 미배치로 되돌려 다음 마감에 다시 잡히게 한다.
  update payout_items
    set batch_id = null, status = 'pending'
    where batch_id = p_batch_id and session_id is null;

  -- 이 묶음은 운영상 존재한 적이 없는 것으로 취급한다(승인 전이며 조정도 없다).
  delete from payout_batch_audit_log where batch_id = p_batch_id;
  delete from payout_batches where id = p_batch_id;

  perform p_actor_id; -- 호출자 식별용(감사 로그는 묶음과 함께 제거되므로 별도 보존하지 않는다)
end;
$$;

revoke execute on function public.delete_payout_batch(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_payout_batch(uuid, uuid) to service_role;

comment on function public.delete_payout_batch is
  'P4-2(UAT 후속): 승인 전 정산 묶음 삭제. 항목은 지우지 않고 미배치(pending)로 되돌려 다음 마감에 '
  '다시 잡히게 한다. 승인 이후이거나 관리자 조정이 붙은 묶음은 거부한다.';
