-- R10 — 실제 정산 파이프라인 데이터 모델(구조만, 실제 API 호출 없음).
--
-- 확정 정책(2026-08-29 로드맵 R10 "지급 인프라와 승인 정책", 2026-09-07):
-- Stripe(수납/환불) → ALTON DB가 정산 근거/승인/명세/감사의 원본 → Mercury
-- (운영비/정산 예비금/미국 강사 USD) / Mercury 정산 예비금→Wise Business→
-- 강사 계좌(한국 강사 KRW). 상태머신은
-- calculated → reviewed → approved → dispatch_requested → provider_pending → paid
-- 이며, paid는 Mercury/Wise의 실제 최종 성공 확인(webhook/재조회 대사) 후에만
-- 도달한다 — 낙관적 전이 금지.
--
-- 이 마이그레이션은 스키마/상태 어휘/멱등성·대사에 필요한 컬럼만 추가한다.
-- dispatch_requested/provider_pending/paid로의 실제 진행은
-- `20261221000000_r10_pre_incorporation_payout_gate.sql`의
-- real_disbursement_enabled() 게이트가 꺼져 있는 동안 구조적으로 막는다
-- (아래 전이 함수가 전부 그 게이트를 확인). 실제 Mercury/Wise API 클라이언트
-- 코드는 이번 마이그레이션에도, 레포 어디에도 없다.

-- =========================================================================
-- 1. 상태 어휘 확장 — 기존 draft/reviewing/approved/processing/paid/failed에
--    calculated/reviewed/dispatch_requested/provider_pending을 추가한다.
--    기존 값은 삭제하지 않는다(enum 값 제거는 Postgres에서 위험 — additive만).
--    매핑: calculated~=draft, reviewed~=reviewing(둘 다 유지, 신규 코드는
--    calculated/reviewed를 쓰고 generate_payout_batches()가 만드는 초기 상태를
--    이번 마이그레이션에서 'calculated'로 바꾼다), processing은
--    dispatch_requested/provider_pending 두 단계로 세분화된다.
-- =========================================================================
alter type v3_payout_batch_status add value if not exists 'calculated';
alter type v3_payout_batch_status add value if not exists 'reviewed';
alter type v3_payout_batch_status add value if not exists 'dispatch_requested';
alter type v3_payout_batch_status add value if not exists 'provider_pending';

comment on type v3_payout_batch_status is
  'R10: draft/reviewing은 초기(1라운드) 상태명, calculated/reviewed는 로드맵 확정 어휘 — 신규 batch는 calculated로 생성된다(아래 generate_payout_batches 재정의). approved 이후 dispatch_requested/provider_pending/paid는 real_disbursement_enabled() 게이트가 true가 되기 전까지 도달 불가(구조적으로는 값이 존재하지만 함수 레벨에서 fail-closed).';

-- =========================================================================
-- 2. 제공자 실행 레일 추적 컬럼 — Mercury/Wise는 실행 레일일 뿐 원본이
--    아니므로, 이 컬럼들은 "제공자가 뭐라고 답했는지"를 ALTON DB에 기록하는
--    용도다. batch 단위(제공자에 보내는 지급 요청 단위)와 item 단위(강사별
--    부분 실패 재시도 단위) 둘 다에 둔다 — 요구사항: 배치 단위 dispatch
--    idempotency + 강사별 부분 실패 재시도가 서로 다른 항목을 막지 않아야 함.
-- =========================================================================
alter table payout_batches
  add column if not exists dispatch_idempotency_key uuid,
  add column if not exists provider_transaction_id text,
  add column if not exists provider text, -- 'mercury' | 'wise'
  add column if not exists dispatch_requested_at timestamptz,
  add column if not exists provider_pending_at timestamptz,
  add column if not exists last_reconciliation_at timestamptz,
  add column if not exists failure_reason text;

create unique index if not exists payout_batches_dispatch_idempotency_key_key
  on payout_batches (dispatch_idempotency_key)
  where dispatch_idempotency_key is not null;
comment on column payout_batches.dispatch_idempotency_key is
  'R10: dispatch_payout_batch()가 batch당 1회만 생성(이미 값이 있으면 재사용) — 재시도로 인한 이중 지급 요청 방지. 제공자 API 호출 시 이 값을 Idempotency-Key 헤더(Mercury) / customerTransactionId(Wise)로 그대로 전달할 설계.';

alter table payout_items
  add column if not exists provider_transaction_id text,
  add column if not exists last_reconciliation_at timestamptz,
  add column if not exists failure_reason text,
  add column if not exists retry_count int not null default 0;
comment on column payout_items.provider_transaction_id is
  'R10: 강사별 부분 실패 재시도 단위. batch 하나가 dispatch_requested여도 강사 A 항목만 제공자 실패 시 이 컬럼과 failure_reason으로 A만 별도 재시도하고 나머지 항목(B, C...)의 provider_transaction_id는 그대로 유지되어 중복 재지급되지 않는다.';

-- =========================================================================
-- 3. generate_payout_batches() 초기 상태를 draft 대신 calculated로(요구사항:
--    확정 어휘 사용). 나머지 로직은 1라운드와 동일 — 재구현 아님.
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

-- submit_payout_batch_for_review()/approve_payout_batch()가 여전히 draft/reviewing
-- 상태도 허용하도록(1라운드 기존 데이터·테스트 호환) draft 대신 calculated,
-- reviewing 대신 reviewed도 받아들이게 조건을 넓힌다(additive, 기존 값 제거 없음).
create or replace function public.submit_payout_batch_for_review(p_batch_id uuid)
returns void language plpgsql as $$
begin
  update payout_batches set status = 'reviewed'
    where id = p_batch_id and status in ('draft', 'calculated');
  if not found then
    raise exception 'calculated 상태의 batch만 검토 제출할 수 있습니다.';
  end if;
end;
$$;

create or replace function public.approve_payout_batch(p_batch_id uuid, p_approved_by uuid)
returns void language plpgsql as $$
begin
  update payout_batches set status = 'approved', approved_at = now()
    where id = p_batch_id and status in ('draft', 'reviewing', 'calculated', 'reviewed');
  if not found then
    raise exception 'calculated/reviewed 상태의 batch만 승인할 수 있습니다.';
  end if;

  update payout_items set status = 'approved' where batch_id = p_batch_id;

  insert into payout_batch_audit_log (batch_id, action, actor_id)
    values (p_batch_id, 'approved', p_approved_by);
end;
$$;

-- =========================================================================
-- 4. dispatch_payout_batch() — approved → dispatch_requested. 실제 제공자
--    호출은 하지 않는다(설계상 자리만 있음, 함수는 상태 전이 + idempotency
--    key 발급만 한다). real_disbursement_enabled() 게이트로 fail-closed.
-- =========================================================================
create or replace function public.dispatch_payout_batch(p_batch_id uuid, p_provider text, p_requested_by uuid)
returns uuid
language plpgsql
as $$
declare
  v_key uuid;
begin
  if not public.real_disbursement_enabled() then
    raise exception '법인 설립 전 지급 경계(2026-09-07 정책): 실제 지급이 활성화되지 않아 batch를 dispatch할 수 없습니다.';
  end if;
  if p_provider not in ('mercury', 'wise') then
    raise exception 'provider는 mercury 또는 wise만 허용됩니다: %', p_provider;
  end if;

  select dispatch_idempotency_key into v_key from payout_batches where id = p_batch_id;
  if v_key is not null then
    -- 이미 dispatch된 batch — 같은 key를 그대로 반환(재시도 시 이중 지급 요청 방지).
    return v_key;
  end if;

  v_key := gen_random_uuid();
  update payout_batches
    set status = 'dispatch_requested',
        provider = p_provider,
        dispatch_idempotency_key = v_key,
        dispatch_requested_at = now()
    where id = p_batch_id and status = 'approved';
  if not found then
    raise exception 'approved 상태의 batch만 dispatch할 수 있습니다.';
  end if;

  insert into payout_batch_audit_log (batch_id, action, actor_id, note)
    values (p_batch_id, 'dispatch_requested', p_requested_by, format('provider=%s idempotency_key=%s', p_provider, v_key));

  return v_key;
end;
$$;
comment on function public.dispatch_payout_batch is
  'R10 실제 파이프라인 설계: approved -> dispatch_requested. 실제 Mercury/Wise API 호출은 하지 않음(코드 없음) — 법인 설립 후 이 함수 호출 뒤 실제 API 클라이언트가 dispatch_idempotency_key를 요청 헤더로 전달하도록 별도 구현 예정. real_disbursement_enabled() 게이트로 fail-closed.';

-- provider_pending으로의 전이(웹훅 수신 시작/제공자 접수 확인)와 강타별
-- 부분 실패 재조회는 실제 웹훅 핸들러가 생길 때 구현한다 — 이번 라운드는
-- 스키마와 idempotency/추적 컬럼, 그리고 fail-closed 전이 함수까지만.
create or replace function public.mark_payout_batch_provider_pending(p_batch_id uuid, p_provider_transaction_id text)
returns void language plpgsql as $$
begin
  if not public.real_disbursement_enabled() then
    raise exception '법인 설립 전 지급 경계(2026-09-07 정책): 실제 지급이 활성화되지 않아 provider_pending으로 전이할 수 없습니다.';
  end if;
  update payout_batches
    set status = 'provider_pending', provider_transaction_id = p_provider_transaction_id
    where id = p_batch_id and status = 'dispatch_requested';
  if not found then
    raise exception 'dispatch_requested 상태의 batch만 provider_pending으로 바꿀 수 있습니다.';
  end if;
end;
$$;

revoke execute on function public.dispatch_payout_batch(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.mark_payout_batch_provider_pending(uuid, text) from public, anon, authenticated;
