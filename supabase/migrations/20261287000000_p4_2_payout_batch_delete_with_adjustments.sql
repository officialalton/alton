-- P4-2(UAT 후속 2차) — 조정 내역이 있는 묶음도 삭제 허용 (2026-09-12)
--
-- 배경: 직전 라운드는 "조정 이력은 INSERT-only 감사 기록이라 지울 수 없다"는 이유로
-- 조정이 붙은 묶음의 삭제를 거부했다. 제품 오너 판단은 **삭제가 가능해야 한다**이다
-- (잘못 만든 묶음을 되돌릴 방법이 조정 여부에 따라 달라지면 운영이 꼬인다).
--
-- 어떻게 지키나:
--  * `payout_batch_adjustments`의 INSERT-only 성격은 **평시에 그대로 유지**한다 —
--    UPDATE는 언제나 금지고, DELETE도 기본적으로 금지다.
--  * 예외는 단 하나, `delete_payout_batch()`가 트랜잭션 안에서 세우는 플래그
--    (`app.payout_batch_delete`)가 있을 때뿐이다. 즉 "승인 전 묶음을 통째로
--    없애는 경로"에서만 그 묶음에 딸린 조정 이력이 함께 사라진다.
--    묶음이 사라지면 그 조정은 가리킬 대상이 없어지므로 감사 대상도 아니게 된다.
--  * 승인 이후(approved 이상)는 여전히 삭제할 수 없다 — 사람이 지급 대상으로
--    판단한 뒤의 기록은 어떤 경로로도 지워지지 않는다.

create or replace function public.reject_payout_batch_adjustment_mutation()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and coalesce(current_setting('app.payout_batch_delete', true), '') = 'on' then
    -- delete_payout_batch()가 승인 전 묶음을 없애는 중이다(그 함수만 이 플래그를 세운다).
    return old;
  end if;
  raise exception 'payout_batch_adjustments는 INSERT-only입니다(묶음 삭제 경로 제외).';
end;
$$;

create or replace function public.delete_payout_batch(p_batch_id uuid, p_actor_id uuid)
returns void
language plpgsql
security definer set search_path = public as $$
declare
  v_batch payout_batches%rowtype;
begin
  select * into v_batch from payout_batches where id = p_batch_id for update;
  if not found then
    raise exception '존재하지 않는 정산 묶음입니다.';
  end if;

  if v_batch.status not in ('draft', 'calculated', 'reviewing', 'reviewed') then
    raise exception '승인 전(검토 단계) 묶음만 삭제할 수 있습니다(현재: %).', v_batch.status;
  end if;

  -- 이 트랜잭션에서만 조정 이력 삭제를 허용한다(트랜잭션 종료 시 자동 해제).
  perform set_config('app.payout_batch_delete', 'on', true);

  -- 관리자 조정으로 생긴 항목은 묶음과 함께 사라진다(다음 마감으로 이월하지 않는다 —
  -- 그 조정은 이 묶음에 대한 판단이었다).
  -- 삭제 순서 주의: payout_batch_adjustments가 payout_items를 FK로 참조하므로
  -- 이력을 먼저 지우고 항목을 지운다.
  create temporary table if not exists _deleting_adjustment_items (id uuid) on commit drop;
  delete from _deleting_adjustment_items;
  insert into _deleting_adjustment_items (id)
    select payout_item_id from payout_batch_adjustments where batch_id = p_batch_id;

  delete from payout_batch_adjustments where batch_id = p_batch_id;
  delete from payout_items where id in (select id from _deleting_adjustment_items);

  -- 수업 기반 항목과 이월 조정 항목(마감 뒤 재판정 차액)은 지우지 않고 미배치로
  -- 되돌린다 — 자동 산정 근거는 어떤 경우에도 사라지지 않는다.
  update payout_items
    set batch_id = null, status = 'pending'
    where batch_id = p_batch_id;

  delete from payout_batch_audit_log where batch_id = p_batch_id;
  delete from payout_batches where id = p_batch_id;

  perform set_config('app.payout_batch_delete', 'off', true);
  perform p_actor_id; -- 호출자 식별용(묶음과 함께 감사 로그도 제거된다)
end;
$$;

comment on function public.delete_payout_batch is
  'P4-2(UAT 후속 2차): 승인 전 정산 묶음 삭제. 수업 항목과 이월 조정 항목은 지우지 않고 '
  '미배치(pending)로 되돌리고, 이 묶음에만 해당하는 관리자 조정 항목·이력은 함께 제거한다. '
  '승인 이후 묶음은 여전히 거부한다.';
