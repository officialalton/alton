-- P4-2 — 지급 예정일 도입 전 승인 묶음 보정 (2026-09-12)
--
-- 결함: scheduled_payout_date는 approve_payout_batch()가 채운다. 그 이전에 이미
-- 승인된 묶음은 값이 없어 관리자 화면에 "지급 예정일 미정"으로 남고, 자동 송금
-- 대상 조회(list_due_auto_dispatch_batches)가 `scheduled_payout_date is not null`을
-- 요구하므로 **영원히 자동 송금되지 않는다.** 누락 없이 처리해야 한다.
--
-- 보정 원칙:
--  (1) 예정일 규칙을 그 묶음의 **실제 승인 시각**에 적용한다(지금 시각이 아니라).
--      승인 시각을 모르면 생성 시각을 쓴다. 보정한 사실은 이력에 남긴다.
--  (2) **자동 송금은 켜지 않는다(2026-09-12 제품 오너 지시).** 이 묶음들은 자동
--      송금이라는 개념이 없던 시절에 승인된 건이라, 관리자가 "자동으로 보내도 된다"고
--      판단한 적이 없다. 일괄로 켜두면 Wise 게이트를 여는 순간 과거 건이 한꺼번에
--      나갈 위험이 있다. **명시적으로 제외** 상태로 두고, 관리자가 직접 포함시키거나
--      재승인할 때만 대상이 된다.

do $$
declare
  v_row record;
  v_date date;
begin
  for v_row in
    select id, approved_at, created_at
    from payout_batches
    where status = 'approved' and scheduled_payout_date is null
  loop
    v_date := public.next_scheduled_payout_date(coalesce(v_row.approved_at, v_row.created_at));

    update payout_batches
      set scheduled_payout_date = v_date,
          -- 과거 승인 건은 자동 송금에서 명시적으로 제외한다(위 보정 원칙 2).
          auto_dispatch_enabled = false
      where id = v_row.id;

    insert into payout_scheduled_date_events (batch_id, previous_date, new_date, reason, source, actor_id)
    values (v_row.id, null, v_date, '지급 예정일 도입 전 승인 건 보정(승인 시각 기준 재계산)', 'approval', null);

    insert into payout_batch_audit_log (batch_id, action, note)
    values (v_row.id, 'scheduled_date_backfilled',
            '도입 전 승인 건 — 승인 시각 기준 예정일 보정, 자동 송금은 안전을 위해 제외 상태로 둠(관리자가 포함하거나 재승인해야 대상이 됨)');
  end loop;
end;
$$;

-- =========================================================================
-- 앞으로도 누락이 생기면 관리자가 안전하게 채울 수 있는 경로
-- =========================================================================
-- 승인 상태인데 예정일이 비어 있는 경우에만 동작한다. 이미 값이 있으면 건드리지
-- 않는다(관리자가 의도적으로 바꾼 날짜를 덮어쓰지 않기 위해).
create or replace function public.ensure_payout_batch_scheduled_date(p_batch_id uuid, p_actor_id uuid)
returns date
language plpgsql
security definer set search_path = public as $$
declare
  v_batch payout_batches%rowtype;
  v_date date;
begin
  select * into v_batch from payout_batches where id = p_batch_id for update;
  if not found then
    raise exception '존재하지 않는 정산 묶음입니다.';
  end if;
  if v_batch.status <> 'approved' then
    raise exception '송금 승인된 묶음만 지급 예정일을 확정할 수 있습니다(현재: %).', v_batch.status;
  end if;
  if v_batch.scheduled_payout_date is not null then
    return v_batch.scheduled_payout_date;
  end if;

  v_date := public.next_scheduled_payout_date(coalesce(v_batch.approved_at, now()));
  update payout_batches set scheduled_payout_date = v_date where id = p_batch_id;

  insert into payout_scheduled_date_events (batch_id, previous_date, new_date, reason, source, actor_id)
  values (p_batch_id, null, v_date, '누락된 지급 예정일 확정(승인 시각 기준)', 'admin_change', p_actor_id);
  insert into payout_batch_audit_log (batch_id, action, actor_id, note)
  values (p_batch_id, 'scheduled_date_backfilled', p_actor_id, '누락된 예정일을 ' || v_date::text || '로 확정');

  return v_date;
end;
$$;

revoke execute on function public.ensure_payout_batch_scheduled_date(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ensure_payout_batch_scheduled_date(uuid, uuid) to service_role;

comment on function public.ensure_payout_batch_scheduled_date is
  'P4-2: 승인됐는데 지급 예정일이 비어 있는 묶음을 승인 시각 기준으로 채운다. 이미 값이 있으면 '
  '그대로 둔다 — 관리자가 의도적으로 바꾼 날짜를 덮어쓰지 않기 위함이다.';
