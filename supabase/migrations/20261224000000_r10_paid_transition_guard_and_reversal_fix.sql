-- R10 corrective(2026-09-07, 제품 오너 리뷰 4건) — paid 전이 가드 강화,
-- reverse_payout_item() 낙관적 paid 생성 제거, mark_payout_batch_failed()를
-- 검토 단계에서도 허용해 관리자 화면 버튼과 실제 허용 전이를 일치시킨다.
--
-- 문제 1: real_disbursement_enabled()=true여도 mark_payout_batch_paid()가
-- approved/processing 상태에서 바로 paid로 전이할 수 있었다 — 실제 Mercury/Wise
-- 확인 없이 "지급 완료"로 표시 가능했던 구멍. 이제 paid는 반드시
-- provider_pending 상태 + provider_transaction_id + provider_confirmed_at(최종
-- 성공 확인 기록, 신규 컬럼) 세 가지를 모두 가진 경우에만 도달 가능하다.
-- 이 불변은 함수 본문뿐 아니라 CHECK 제약으로도 구조적으로 강제한다 — 다른
-- 코드 경로(예: 직접 UPDATE)로도 우회할 수 없다.
--
-- 문제 2: reverse_payout_item()이 게이트가 열려있으면 "지금 열려있다"는 이유만으로
-- 새 paid batch/item을 낙관적으로 만들었다. 역분개도 실제 송금 확인 없이는
-- paid에 도달하면 안 된다 — 정규 payout과 동일하게 approved에서 시작해
-- dispatch_requested -> provider_pending -> paid 파이프라인을 그대로 통과해야
-- 한다. 이 마이그레이션은 reverse_payout_item()이 항상 approved 상태의 새
-- batch/item만 만들도록 재설계한다(게이트 상태와 무관 — 우회 분기 삭제).

-- =========================================================================
-- 1. 최종 성공 확인 컬럼 — provider_transaction_id는 이미 있음(20261222).
--    provider_confirmed_at은 이번에 추가: 제공자 webhook/재조회 대사로 "최종
--    성공"이 확인된 시각. dispatch_requested/provider_pending은 아직 확인 전,
--    provider_confirmed_at이 채워진 뒤에만 paid로 전이할 수 있다.
-- =========================================================================
alter table payout_batches add column if not exists provider_confirmed_at timestamptz;
alter table payout_items add column if not exists provider_confirmed_at timestamptz;

comment on column payout_batches.provider_confirmed_at is
  'R10 corrective: Mercury/Wise의 실제 최종 성공 확인(webhook/재조회 대사) 시각. mark_payout_batch_provider_confirmed()가 provider_pending 상태 + provider_transaction_id 존재를 확인한 뒤에만 채운다. paid 전이의 필수 선행 조건(CHECK 제약으로 구조적 강제).';
comment on column payout_items.provider_confirmed_at is
  'R10 corrective: batch 확인 시 각 item에도 함께 기록(개별 재시도 시에는 item 단위로 별도로 채워질 수 있음).';

-- =========================================================================
-- 2. CHECK 제약 — paid 상태는 반드시 provider_transaction_id +
--    provider_confirmed_at을 동반해야 한다. 함수를 거치지 않은 직접 UPDATE도
--    이 제약을 통과할 수 없다(구조적 강제 — 요구사항 1).
-- =========================================================================
alter table payout_batches
  add constraint payout_batches_paid_requires_confirmation
  check (status <> 'paid' or (provider_transaction_id is not null and provider_confirmed_at is not null));

alter table payout_items
  add constraint payout_items_paid_requires_confirmation
  check (status <> 'paid' or (provider_transaction_id is not null and provider_confirmed_at is not null));

comment on constraint payout_batches_paid_requires_confirmation on payout_batches is
  'R10 corrective(요구사항 1): paid 상태는 provider_transaction_id·provider_confirmed_at이 둘 다 있어야만 성립 — DB 함수가 아니라 테이블 제약이라 다른 코드 경로로도 우회 불가.';
comment on constraint payout_items_paid_requires_confirmation on payout_items is
  'R10 corrective(요구사항 1): item 레벨에서도 동일 불변 — batch만 확인되고 item이 확인되지 않은 채로 paid가 될 수 없다.';

-- =========================================================================
-- 3. provider_pending -> (확인) 단계. dispatch_payout_batch()/
--    mark_payout_batch_provider_pending()은 기존 그대로(20261222) 유지 —
--    이 함수가 새로 추가하는 "최종 확인" 단계.
-- =========================================================================
create or replace function public.mark_payout_batch_provider_confirmed(
  p_batch_id uuid,
  p_confirmed_by uuid default null
)
returns void
language plpgsql
as $$
declare
  v_batch payout_batches%rowtype;
begin
  if not public.real_disbursement_enabled() then
    raise exception '법인 설립 전 지급 경계(2026-09-07 정책): 실제 지급이 활성화되지 않아 제공자 확인을 기록할 수 없습니다.';
  end if;

  select * into v_batch from payout_batches where id = p_batch_id;
  if not found then
    raise exception 'batch를 찾을 수 없습니다: %', p_batch_id;
  end if;
  if v_batch.status <> 'provider_pending' then
    raise exception 'provider_pending 상태의 batch만 제공자 확인을 기록할 수 있습니다. 현재 상태: %', v_batch.status;
  end if;
  if v_batch.provider_transaction_id is null then
    raise exception 'provider_transaction_id가 없는 batch는 확인 처리할 수 없습니다.';
  end if;

  update payout_batches set provider_confirmed_at = now() where id = p_batch_id;

  insert into payout_batch_audit_log (batch_id, action, actor_id, note)
    values (p_batch_id, 'provider_confirmed', p_confirmed_by,
      format('provider_transaction_id=%s', v_batch.provider_transaction_id));
end;
$$;
comment on function public.mark_payout_batch_provider_confirmed is
  'R10 corrective(요구사항 1): provider_pending 상태 + provider_transaction_id가 이미 있는 batch에 한해 "최종 성공 확인" 시각을 기록한다. 실제 구현에서는 Mercury/Wise webhook 핸들러 또는 재조회 대사 배치가 이 함수를 호출한다(이번 라운드는 그 호출부 없이 함수와 가드만). paid 전이의 필수 선행 단계.';

-- =========================================================================
-- 4. mark_payout_batch_paid() 재정의 — provider_pending + 두 확인 컬럼이
--    모두 있어야만 paid로 전이. approved/processing에서 직접 paid로 갈 수
--    있었던 기존 구멍을 막는다(요구사항 1).
-- =========================================================================
create or replace function public.mark_payout_batch_paid(p_batch_id uuid, p_paid_by uuid)
returns void
language plpgsql
as $$
declare
  v_batch payout_batches%rowtype;
begin
  if not public.real_disbursement_enabled() then
    raise exception '법인 설립 전 지급 경계(2026-09-07 정책): 실제 지급이 활성화되지 않아 batch를 paid로 전이할 수 없습니다. approved 상태로 유지하세요.';
  end if;

  select * into v_batch from payout_batches where id = p_batch_id;
  if not found then
    raise exception 'batch를 찾을 수 없습니다: %', p_batch_id;
  end if;
  if v_batch.status <> 'provider_pending' then
    raise exception 'provider_pending 상태의 batch만 지급 완료로 바꿀 수 있습니다(요구사항 1: approved/processing에서 직접 paid로 갈 수 없음). 현재 상태: %', v_batch.status;
  end if;
  if v_batch.provider_transaction_id is null then
    raise exception 'provider_transaction_id가 없는 batch는 지급 완료로 표시할 수 없습니다.';
  end if;
  if v_batch.provider_confirmed_at is null then
    raise exception '제공자 최종 성공 확인(provider_confirmed_at)이 없는 batch는 지급 완료로 표시할 수 없습니다. mark_payout_batch_provider_confirmed()를 먼저 호출하세요.';
  end if;

  update payout_batches set status = 'paid', paid_at = now() where id = p_batch_id;

  update payout_items
    set status = 'paid',
        provider_transaction_id = coalesce(provider_transaction_id, v_batch.provider_transaction_id),
        provider_confirmed_at = coalesce(provider_confirmed_at, v_batch.provider_confirmed_at)
    where batch_id = p_batch_id;

  insert into payout_batch_audit_log (batch_id, action, actor_id)
    values (p_batch_id, 'paid', p_paid_by);
end;
$$;
comment on function public.mark_payout_batch_paid is
  'R10 corrective(요구사항 1, 2026-09-07 리뷰): paid는 provider_pending 상태 + provider_transaction_id + provider_confirmed_at(최종 성공 확인)이 모두 있을 때만 허용된다. 게이트가 열려 있어도 이 세 조건이 없으면 거부 — CHECK 제약(payout_batches_paid_requires_confirmation/payout_items_paid_requires_confirmation)이 이를 구조적으로도 강제한다.';

-- mark_payout_batch_processing()은 구형(processing) 경로 — 신규 파이프라인은
-- dispatch_payout_batch()/mark_payout_batch_provider_pending()을 쓴다.
-- processing은 이제 paid로 이어지는 경로가 아니므로(위 재정의), 실수로 오래된
-- 코드가 processing을 거쳐 paid를 만들 수 없다는 점을 주석으로 명시한다.
comment on function public.mark_payout_batch_processing is
  'R10 corrective 주석(2026-09-07): 이 함수가 만드는 processing 상태에서는 더 이상 paid로 직접 전이할 수 없다(mark_payout_batch_paid가 provider_pending만 허용). 신규 파이프라인은 dispatch_payout_batch/mark_payout_batch_provider_pending/mark_payout_batch_provider_confirmed를 쓴다. 이 함수는 구형 호환용으로만 남아있고 v3 admin UI(payout-batches-actions.ts)는 호출하지 않는다.';

-- =========================================================================
-- 5. reverse_payout_item() 재설계 — 게이트 상태와 무관하게 항상 approved에서
--    시작한다. 실제 송금 확인이 필요한 paid는 정규 payout과 동일하게
--    dispatch_payout_batch() -> mark_payout_batch_provider_pending() ->
--    mark_payout_batch_provider_confirmed() -> mark_payout_batch_paid()를
--    그대로 통과해야 한다(요구사항 2 — "게이트가 열려있다"는 이유만으로
--    새 paid batch를 만드는 지름길 삭제).
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

  -- 요구사항 2: 게이트가 열려 있어도 지름길 없음 — 항상 approved에서 시작.
  -- paid_at/approved_at도 실제 지급 확인 전이므로 approved_at만 채운다.
  insert into payout_batches (teacher_id, period_start, period_end, currency, status, approved_at)
    values (v_item.teacher_id, current_date, current_date, v_item.currency, 'approved', now())
    returning id into v_new_batch_id;

  insert into payout_items (
    batch_id, session_id, teacher_id, item_type, hourly_rate_snapshot_minor, currency,
    payable_minutes, amount_minor, status
  ) values (
    v_new_batch_id, v_item.session_id, v_item.teacher_id, 'reversal', v_item.hourly_rate_snapshot_minor,
    v_item.currency, -v_item.payable_minutes, -v_item.amount_minor, 'approved'
  ) returning id into v_new_item_id;

  insert into payout_batch_audit_log (batch_id, action, actor_id, note)
    values (v_new_batch_id, 'reversal_created', p_actor_id,
      format('원본 항목 %s 역분개: %s', p_original_item_id, coalesce(p_reason, '')));

  return v_new_item_id;
end;
$$;
comment on function public.reverse_payout_item is
  'R10 corrective(요구사항 2, 2026-09-07 리뷰): 역분개 batch/item은 게이트 상태와 무관하게 항상 approved에서 시작한다. 실제 지급을 의미하는 paid까지 가려면 정규 payout과 동일한 dispatch_payout_batch -> mark_payout_batch_provider_pending -> mark_payout_batch_provider_confirmed -> mark_payout_batch_paid 파이프라인을 그대로 통과해야 한다. "게이트가 열려있으니 바로 paid"로 가는 분기는 삭제했다.';

-- =========================================================================
-- 6. mark_payout_batch_failed() — 요구사항 4: 관리자 화면(PayoutBatchesTab)은
--    reviewing/reviewed 상태에서도 "실패 처리" 버튼을 보여주는데, 기존 함수는
--    processing/approved에서만 허용해 에러가 났다. 검토 중에 잘못된 batch를
--    반려하는 것은 정상 업무 흐름이므로(검토자가 이상 항목을 발견해 batch
--    자체를 실패/반려 처리) DB 함수를 넓혀 UI가 이미 노출하는 모든 상태에서
--    실제로 동작하게 만든다 — paid 이후는 여전히 절대 불가(트리거+CHECK가
--    이미 막음).
-- =========================================================================
create or replace function public.mark_payout_batch_failed(p_batch_id uuid, p_reason text, p_actor_id uuid)
returns void language plpgsql as $$
begin
  update payout_batches set status = 'failed'
    where id = p_batch_id
      and status in ('draft', 'calculated', 'reviewing', 'reviewed', 'approved', 'processing', 'dispatch_requested', 'provider_pending');
  if not found then
    raise exception 'paid가 아닌 batch만 실패로 표시할 수 있습니다(이미 paid이거나 존재하지 않음).';
  end if;
  -- 실패 시 항목을 다시 미배치로 되돌려 다음 batch 생성에서 재시도되게 한다.
  update payout_items set batch_id = null, status = 'pending' where batch_id = p_batch_id;

  insert into payout_batch_audit_log (batch_id, action, actor_id, note)
    values (p_batch_id, 'failed', p_actor_id, p_reason);
end;
$$;
comment on function public.mark_payout_batch_failed is
  'R10 corrective(요구사항 4, 2026-09-07 리뷰): PayoutBatchesTab이 실패 처리 버튼을 노출하는 모든 상태(draft/calculated/reviewing/reviewed/approved 및 아직 도달 불가한 processing/dispatch_requested/provider_pending)에서 실제로 동작하도록 허용 상태를 넓혔다. paid는 여전히 절대 실패 처리 불가.';

grant execute on function public.mark_payout_batch_provider_confirmed(uuid, uuid) to service_role;
revoke execute on function public.mark_payout_batch_provider_confirmed(uuid, uuid) from public, anon, authenticated;

-- =========================================================================
-- 7. 요구사항 3 (레거시 teacher_payouts 쓰기 차단) — DB 레벨 방어.
--    app/admin/payouts-cron.ts를 no-op으로 고친 것과 별개로, authenticated/
--    anon 역할에는 애초에 insert/update/delete grant를 준 적이 없었다(RLS
--    정책만 있었음 — 20260827120001). 여기서는 그 grant 자체가 존재하지
--    않음을 명시적으로 다시 revoke해 문서화하고, 실수로 향후 누군가 grant를
--    추가하는 회귀를 막는 목적의 명시적 REVOKE를 남긴다. service_role은
--    Supabase 표준 구성상 항상 모든 테이블에 대해 RLS를 우회하는 관리자
--    역할이라 테이블 grant로는 막을 수 없다 — 그래서 코드 레벨(payouts-cron.ts
--    no-op화)이 실제 차단선이고, 이 REVOKE는 방어 심층화(defense-in-depth)다.
-- =========================================================================
revoke insert, update, delete on table teacher_payouts from public, anon, authenticated;
