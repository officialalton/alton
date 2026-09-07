-- R10 — 결제·환불·선생님 정산: payout batch 생성·검토·승인·지급·역분개 상태머신.
--
-- 선행 조건(이미 완료됨, 이 마이그레이션은 additive):
-- - R1(20260830070000)이 payout_batches/payout_items 스키마와 "batch는 단일 통화"
--   트리거(check_payout_batch_currency), "paid 이후 원본 수정 금지"트리거
--   (prevent_paid_item_mutation)를 이미 만들어뒀다.
-- - M5-a(20261030000000, finalize_lesson_session)가 세션 완료 시점에
--   sessions.payable_minutes/hourly_rate_snapshot_*를 그대로 옮겨 batch_id=null,
--   status='pending' 상태의 payout_items 행을 세션당 1건씩 이미 쌓고 있다
--   (item_type: regular/trial/makeup/adjustment).
-- - teacher_rate_history(20260830030000)가 이미 시급×통화 적용일 이력을 관리한다.
--
-- 여기서는 그 "쌓인 미배치 항목"을 실제 payout_batches로 묶어 draft→reviewing→
-- approved→processing→paid로 진행시키고, paid 이후 정정은 역분개(reversal) 항목을
-- 새 batch로 추가하는 절차만 만든다(기존 paid 항목은 절대 수정하지 않음 — 기존
-- 트리거가 이미 강제).

-- =========================================================================
-- 1. batch 생성 — 기간 내 미배치(batch_id is null, status='pending') 항목을
--    선생님×통화 단위로 묶는다(요구사항 9: 단일통화 payout batch, 통화 변경
--    전후 분리 — teacher_rate_history의 통화가 기간 중 바뀌면 세션별
--    hourly_rate_snapshot_currency도 이미 그 시점 통화를 스냅샷했으므로,
--    같은 선생님이라도 통화가 다른 항목은 자동으로 다른 batch로 분리된다).
-- =========================================================================
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
      pi.teacher_id as g_teacher_id,
      pi.currency as g_currency,
      array_agg(pi.id) as item_ids,
      count(*) as g_count,
      sum(pi.amount_minor) as g_total
    from payout_items pi
    join sessions s on s.id = pi.session_id
    join reservations r on r.id = s.reservation_id
    where pi.batch_id is null
      and pi.status = 'pending'
      and (p_teacher_id is null or pi.teacher_id = p_teacher_id)
      and r.starts_at::date between p_period_start and p_period_end
    group by pi.teacher_id, pi.currency
  loop
    insert into payout_batches (teacher_id, period_start, period_end, currency, status)
    values (v_group.g_teacher_id, p_period_start, p_period_end, v_group.g_currency, 'draft')
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
  'R10: 기간 내 미배치 payout_items(status=pending, batch_id null)를 선생님×통화로 묶어 draft batch를 만든다. 멱등: 이미 batch_id가 배정된 항목은 재조회 대상에서 자동 제외(where batch_id is null)되므로 같은 기간에 반복 호출해도 중복 batch가 생기지 않는다.';

-- =========================================================================
-- 2. 상태 전이 — draft → reviewing → approved → processing → paid
-- =========================================================================
create or replace function public.submit_payout_batch_for_review(p_batch_id uuid)
returns void language plpgsql as $$
begin
  update payout_batches set status = 'reviewing'
    where id = p_batch_id and status = 'draft';
  if not found then
    raise exception 'draft 상태의 batch만 검토 제출할 수 있습니다.';
  end if;
end;
$$;

create or replace function public.approve_payout_batch(p_batch_id uuid, p_approved_by uuid)
returns void language plpgsql as $$
begin
  update payout_batches set status = 'approved', approved_at = now()
    where id = p_batch_id and status in ('draft', 'reviewing');
  if not found then
    raise exception 'draft/reviewing 상태의 batch만 승인할 수 있습니다.';
  end if;

  update payout_items set status = 'approved' where batch_id = p_batch_id;

  insert into payout_batch_audit_log (batch_id, action, actor_id)
    values (p_batch_id, 'approved', p_approved_by);
end;
$$;

create or replace function public.mark_payout_batch_processing(p_batch_id uuid)
returns void language plpgsql as $$
begin
  update payout_batches set status = 'processing'
    where id = p_batch_id and status = 'approved';
  if not found then
    raise exception 'approved 상태의 batch만 지급 처리 중으로 바꿀 수 있습니다.';
  end if;
end;
$$;

create or replace function public.mark_payout_batch_paid(p_batch_id uuid, p_paid_by uuid)
returns void language plpgsql as $$
begin
  update payout_batches set status = 'paid', paid_at = now()
    where id = p_batch_id and status in ('approved', 'processing');
  if not found then
    raise exception 'approved/processing 상태의 batch만 지급 완료로 바꿀 수 있습니다.';
  end if;

  update payout_items set status = 'paid' where batch_id = p_batch_id;

  insert into payout_batch_audit_log (batch_id, action, actor_id)
    values (p_batch_id, 'paid', p_paid_by);
end;
$$;

create or replace function public.mark_payout_batch_failed(p_batch_id uuid, p_reason text, p_actor_id uuid)
returns void language plpgsql as $$
begin
  update payout_batches set status = 'failed'
    where id = p_batch_id and status in ('processing', 'approved');
  if not found then
    raise exception 'approved/processing 상태의 batch만 실패로 표시할 수 있습니다.';
  end if;
  -- 실패 시 항목을 다시 미배치로 되돌려 다음 batch 생성에서 재시도되게 한다.
  update payout_items set batch_id = null, status = 'pending' where batch_id = p_batch_id;

  insert into payout_batch_audit_log (batch_id, action, actor_id, note)
    values (p_batch_id, 'failed', p_actor_id, p_reason);
end;
$$;

-- =========================================================================
-- 3. 역분개(reversal) — paid batch의 항목은 기존 트리거(prevent_paid_item_mutation)가
--    수정 자체를 막는다. 정정은 새 batch에 item_type='reversal'(음수 금액) 항목을
--    추가하는 방식으로만 한다(요구사항 15).
-- =========================================================================
create or replace function public.reverse_payout_item(
  p_original_item_id uuid,
  p_reason text,
  p_actor_id uuid
)
returns uuid
language plpgsql
as $$
declare
  v_item payout_items%rowtype;
  v_new_batch_id uuid;
  v_new_item_id uuid;
begin
  select * into v_item from payout_items where id = p_original_item_id;
  if not found then
    raise exception '정산 항목을 찾을 수 없습니다.';
  end if;
  if v_item.status != 'paid' then
    raise exception 'paid 상태의 항목만 역분개할 수 있습니다. 그 외 상태는 batch에서 항목을 제거하거나 실패 처리하세요.';
  end if;

  insert into payout_batches (teacher_id, period_start, period_end, currency, status, approved_at, paid_at)
    values (v_item.teacher_id, current_date, current_date, v_item.currency, 'paid', now(), now())
    returning id into v_new_batch_id;

  insert into payout_items (
    batch_id, session_id, teacher_id, item_type, hourly_rate_snapshot_minor, currency,
    payable_minutes, amount_minor, status
  ) values (
    v_new_batch_id, v_item.session_id, v_item.teacher_id, 'reversal', v_item.hourly_rate_snapshot_minor,
    v_item.currency, -v_item.payable_minutes, -v_item.amount_minor, 'paid'
  ) returning id into v_new_item_id;

  insert into payout_batch_audit_log (batch_id, action, actor_id, note)
    values (v_new_batch_id, 'reversal_created', p_actor_id,
      format('원본 항목 %s 역분개: %s', p_original_item_id, coalesce(p_reason, '')));

  return v_new_item_id;
end;
$$;
comment on function public.reverse_payout_item is
  'R10 요구사항 15(역분개): 이미 지급된 payout_item을 직접 취소/수정하지 않는다(트리거가 막음). 같은 금액·분의 음수 항목을 새 paid batch에 추가해 순액이 0이 되도록 한다 — 회계 감사 이력 보존.';

-- =========================================================================
-- 4. 감사 로그
-- =========================================================================
create table payout_batch_audit_log (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references payout_batches (id),
  action text not null, -- approved | paid | failed | reversal_created
  actor_id uuid references profiles (id),
  note text,
  created_at timestamptz not null default now()
);
create index on payout_batch_audit_log (batch_id);

alter table payout_batch_audit_log enable row level security;
create policy "payout_batch_audit_log 조회" on payout_batch_audit_log for select
  using (
    is_admin() or current_user_has_capability('정산권한')
    or exists (select 1 from payout_batches b where b.id = payout_batch_audit_log.batch_id and b.teacher_id = auth.uid())
  );
create policy "payout_batch_audit_log 쓰기" on payout_batch_audit_log for all
  using (is_admin() or current_user_has_capability('정산권한'))
  with check (is_admin() or current_user_has_capability('정산권한'));

revoke execute on function public.generate_payout_batches(date, date, uuid) from public, anon, authenticated;
revoke execute on function public.submit_payout_batch_for_review(uuid) from public, anon, authenticated;
revoke execute on function public.approve_payout_batch(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.mark_payout_batch_processing(uuid) from public, anon, authenticated;
revoke execute on function public.mark_payout_batch_paid(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.mark_payout_batch_failed(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.reverse_payout_item(uuid, text, uuid) from public, anon, authenticated;
-- service_role(관리자 서버 액션)에서만 호출 — Gate B §7 원칙과 동일하게 admin
-- 클라이언트(createAdminClient)를 통해서만 실행되고, 각 서버 액션이 requireAdmin()으로
-- 로그인 세션 기반 권한을 먼저 확인한다.

comment on table payout_batch_audit_log is
  'R10: 승인/지급/실패/역분개 이력. payout_batches.status 자체는 현재 상태만 보여주므로 "누가 언제 승인했는지"는 이 로그로 추적.';
