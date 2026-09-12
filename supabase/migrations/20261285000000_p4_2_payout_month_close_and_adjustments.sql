-- P4-2(2차) — 자동 월 마감 / 관리자 가감 조정 / 마감 뒤 차액 이월 (2026-09-12)
--
-- 착수 정리: docs/2026-09-12-p4-2-teacher-settlement-plan.md
-- 제품 오너 확정 흐름:
--   예정 → 검토 중(월 마감 시 시스템이 자동으로 묶음 생성)
--        → 송금 승인됨(송금 권한 관리자의 유일한 승인 지점)
--        → 송금 요청됨 → 금융사 처리 중 → 지급 완료(이번 범위 밖, 게이트 유지)
--
-- 이 마이그레이션이 지키는 원칙:
--  1. **자동 산정 근거를 사람이 덮어쓰지 않는다.** 관리자는 수업별 payout_items
--     금액을 고치지 못하고, 별도 가감 조정 항목만 추가한다.
--  2. **이미 송금 승인된 금액·지급 이력을 덮어쓰지 않는다.** 마감 뒤 수업 판정이
--     바뀌면 그 차액을 **미배치 조정 항목**으로 만들어 다음 마감에 실린다.
--  3. **중복 마감 금지.** 같은 항목이 두 묶음에 실리지 않고, 같은 기간을 여러 번
--     마감해도 묶음이 중복 생성되지 않는다.
--  4. 실제 송금·금융 제공자 호출·paid 전이는 열지 않는다(기존 게이트 그대로).
--
-- 날짜 기준: 기존 정산이 쓰던 **UTC**를 그대로 쓴다.
-- generate_payout_batches()가 `reservations.starts_at::date`(DB 타임존=UTC)로
-- 기간을 잘라왔고 app의 previousMonthRange()도 UTC였다. 여기서 기준을 바꾸면
-- 월 경계 수업이 다른 달로 재분류되므로 일관성을 위해 UTC를 유지한다.

-- =========================================================================
-- 1. 조정 항목을 위한 payout_items 확장 (additive)
-- =========================================================================
-- 조정 항목은 session_id가 null이다 — 그래야 "세션 1건 = payout_items 1행"이라는
-- 기존 전제(upsert_session_payout_item의 단건 조회)가 깨지지 않는다. 원본 수업과의
-- 연결은 adjusts_payout_item_id로 남긴다.
alter table payout_items
  add column if not exists adjusts_payout_item_id uuid references payout_items (id),
  add column if not exists adjustment_reason text;

create index if not exists payout_items_adjusts_idx
  on payout_items (adjusts_payout_item_id) where adjusts_payout_item_id is not null;

comment on column payout_items.adjusts_payout_item_id is
  'P4-2: 이 조정 항목이 보정하는 원본 수업 정산 항목. 마감 뒤 수업 판정이 바뀌었을 때 '
  '원본을 덮어쓰지 않고 차액만 새 조정 항목으로 만들어 다음 마감에 싣기 위한 연결이다.';

-- =========================================================================
-- 2. 관리자 가감 조정 이력
-- =========================================================================
create table payout_batch_adjustments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references payout_batches (id),
  payout_item_id uuid not null references payout_items (id),
  amount_minor bigint not null,            -- 가산(+) / 감액(-)
  currency text not null,
  reason text not null,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  constraint payout_batch_adjustments_amount_nonzero check (amount_minor <> 0)
);
create index on payout_batch_adjustments (batch_id, created_at desc);

comment on table payout_batch_adjustments is
  'P4-2: 관리자가 송금 전 최종 금액을 조정한 이력(사유·처리자·시각). 금액 자체는 짝이 되는 '
  'payout_items 조정 항목에 들어가고, 이 테이블은 "왜/누가/언제"를 남긴다. 수업별 자동 산정 '
  '항목은 이 경로로도 수정되지 않는다.';

create or replace function public.reject_payout_batch_adjustment_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'payout_batch_adjustments는 INSERT-only입니다.';
end;
$$;
create trigger payout_batch_adjustments_no_update
  before update or delete on payout_batch_adjustments
  for each row execute function public.reject_payout_batch_adjustment_mutation();
revoke execute on function public.reject_payout_batch_adjustment_mutation() from public, anon, authenticated, service_role;

alter table payout_batch_adjustments enable row level security;
-- 교사도 본인 묶음의 조정 내역을 볼 수 있어야 한다(요구사항: 교사 화면에 조정 내역 표시).
create policy "payout_batch_adjustments 조회" on payout_batch_adjustments for select
  using (
    is_admin()
    or current_user_has_capability('정산권한')
    or exists (
      select 1 from payout_batches b
      where b.id = payout_batch_adjustments.batch_id and b.teacher_id = auth.uid()
    )
  );

-- =========================================================================
-- 3. 자동 월 마감 — close_payout_period()
-- =========================================================================
-- generate_payout_batches()와의 관계: 그 함수는 관리자가 기간을 넣어 실행하는
-- **운영 보조 수단**으로 그대로 남긴다. 정상 경로는 이 함수이며, 차이는 두 가지다.
--   (a) 같은 (교사, 통화, 기간)에 열려 있는 묶음이 이미 있으면 새로 만들지 않고
--       그 묶음에 항목을 덧붙인다 → 재실행·실행 지연에도 묶음이 중복되지 않는다.
--   (b) 세션 기반 항목뿐 아니라 **미배치 조정 항목**(session_id is null)도 함께
--       싣는다 → 지난 마감 뒤 생긴 차액이 이번 달에 자동으로 반영된다.
create or replace function public.close_payout_period(
  p_period_start date,
  p_period_end date
)
returns table (batch_id uuid, out_teacher_id uuid, currency text, item_count int, total_amount_minor bigint)
language plpgsql
security definer set search_path = public as $$
declare
  v_group record;
  v_batch_id uuid;
  v_added int;
  v_total bigint;
begin
  if p_period_end < p_period_start then
    raise exception '정산 기간이 올바르지 않습니다(% ~ %).', p_period_start, p_period_end;
  end if;

  -- 같은 기간을 동시에 두 번 마감하려는 호출을 직렬화한다(크론 중복 실행·수동
  -- 재시도가 겹쳐도 한 번에 하나만 진행). 트랜잭션 종료 시 자동 해제.
  perform pg_advisory_xact_lock(hashtext('close_payout_period:' || p_period_start::text || ':' || p_period_end::text));

  for v_group in
    select g_teacher_id, g_currency, array_agg(item_id) as item_ids, count(*) as g_count, sum(amount_minor) as g_total
    from (
      -- 후보는 두 종류다. UNION은 FOR UPDATE와 함께 쓸 수 없으므로(Postgres 제약)
      -- payout_items 단일 스캔에 OR로 합친다 — 잠금 대상이 한 relation이어야 한다.
      --   (a) 이 기간에 수업이 있었던 미배치 항목
      --   (b) 지난 마감 뒤 생긴 미배치 조정 항목(세션에 매이지 않는다)
      select pi.id as item_id, pi.teacher_id as g_teacher_id, pi.currency as g_currency, pi.amount_minor
      from payout_items pi
      where pi.batch_id is null
        and pi.status = 'pending'
        and (
          exists (
            select 1
            from sessions s
            join reservations r on r.id = s.reservation_id
            where s.id = pi.session_id
              and r.starts_at::date between p_period_start and p_period_end
          )
          or (pi.session_id is null and pi.created_at::date <= p_period_end)
        )
      order by pi.id
      for update of pi skip locked
    ) locked_candidates
    group by g_teacher_id, g_currency
  loop
    -- 이미 열려 있는(아직 승인 전) 같은 기간·통화 묶음이 있으면 재사용한다.
    -- OUT 파라미터(batch_id/currency/item_count/total_amount_minor)와 테이블 컬럼이
    -- 같은 이름이라 반드시 별칭으로 한정한다(그렇지 않으면 ambiguous 오류).
    select pb.id into v_batch_id
    from payout_batches pb
    where pb.teacher_id = v_group.g_teacher_id
      and pb.currency = v_group.g_currency
      and pb.period_start = p_period_start
      and pb.period_end = p_period_end
      and pb.status in ('draft', 'calculated', 'reviewing', 'reviewed')
    order by pb.created_at asc
    limit 1
    for update;

    if v_batch_id is null then
      insert into payout_batches (teacher_id, period_start, period_end, currency, status)
      values (v_group.g_teacher_id, p_period_start, p_period_end, v_group.g_currency, 'calculated')
      returning id into v_batch_id;
      insert into payout_batch_audit_log (batch_id, action, note)
        values (v_batch_id, 'auto_closed', '자동 월 마감으로 생성됨');
    else
      insert into payout_batch_audit_log (batch_id, action, note)
        values (v_batch_id, 'auto_closed_appended', '자동 월 마감 재실행 — 새 항목만 추가됨');
    end if;

    update payout_items pi
      set batch_id = v_batch_id, status = 'batched'
      where pi.id = any (v_group.item_ids) and pi.batch_id is null;
    get diagnostics v_added = row_count;

    select coalesce(sum(pi.amount_minor), 0) into v_total from payout_items pi where pi.batch_id = v_batch_id;

    batch_id := v_batch_id;
    out_teacher_id := v_group.g_teacher_id;
    currency := v_group.g_currency;
    item_count := v_added;
    total_amount_minor := v_total;
    return next;
  end loop;
end;
$$;

revoke execute on function public.close_payout_period(date, date) from public, anon, authenticated;
grant execute on function public.close_payout_period(date, date) to service_role;

comment on function public.close_payout_period is
  'P4-2: 정산 대상 월의 자동 마감. 기간 단위 advisory lock + 후보 항목 FOR UPDATE SKIP LOCKED + '
  '"열려 있는 같은 기간 묶음 재사용"으로 중복 실행·실행 지연·월 경계 재시도에도 같은 항목을 두 번 '
  '묶지 않는다. 미배치 조정 항목(마감 뒤 차액)도 함께 실어 다음 정산월에 자동 반영한다. '
  '기간 판정 기준은 기존 정산과 동일한 UTC(reservations.starts_at::date).';

-- =========================================================================
-- 4. 관리자 가감 조정 — add_payout_batch_adjustment()
-- =========================================================================
create or replace function public.add_payout_batch_adjustment(
  p_batch_id uuid,
  p_amount_minor bigint,
  p_reason text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare
  v_batch payout_batches%rowtype;
  v_item_id uuid;
  v_adjustment_id uuid;
begin
  if p_amount_minor = 0 then
    raise exception '조정 금액은 0일 수 없습니다.';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception '조정 사유를 입력해주세요.';
  end if;

  select * into v_batch from payout_batches where id = p_batch_id for update;
  if not found then
    raise exception '존재하지 않는 정산 묶음입니다.';
  end if;

  -- 송금 요청 뒤에는 금액을 바꿀 수 없다 — 이후 발견된 차이는 다음 정산월 조정으로 처리한다.
  if v_batch.status in ('dispatch_requested', 'provider_pending', 'processing', 'paid') then
    raise exception '송금 요청 이후에는 금액을 변경할 수 없습니다(현재: %). 차액은 다음 정산월 조정 항목으로 처리하세요.', v_batch.status;
  end if;
  if v_batch.status = 'failed' then
    raise exception '실패 처리된 묶음은 조정할 수 없습니다.';
  end if;

  insert into payout_items (
    batch_id, session_id, teacher_id, item_type, hourly_rate_snapshot_minor,
    currency, payable_minutes, amount_minor, status, adjustment_reason
  ) values (
    p_batch_id, null, v_batch.teacher_id, 'adjustment', 0,
    v_batch.currency, 0, p_amount_minor, 'batched', btrim(p_reason)
  ) returning id into v_item_id;

  insert into payout_batch_adjustments (batch_id, payout_item_id, amount_minor, currency, reason, created_by)
  values (p_batch_id, v_item_id, p_amount_minor, v_batch.currency, btrim(p_reason), p_actor_id)
  returning id into v_adjustment_id;

  insert into payout_batch_audit_log (batch_id, action, actor_id, note)
  values (p_batch_id, 'adjusted', p_actor_id, '조정 ' || p_amount_minor::text || ' — ' || btrim(p_reason));

  -- 승인 뒤 송금 요청 전에 금액이 바뀌면 검토 중으로 되돌리고 재승인을 요구한다.
  if v_batch.status = 'approved' then
    update payout_batches set status = 'reviewed', approved_at = null where id = p_batch_id;
    update payout_items set status = 'batched' where batch_id = p_batch_id and status = 'approved';
    insert into payout_batch_audit_log (batch_id, action, actor_id, note)
    values (p_batch_id, 'reverted_to_review', p_actor_id, '승인 후 금액 조정 — 재승인 필요');
  end if;

  return v_adjustment_id;
end;
$$;

revoke execute on function public.add_payout_batch_adjustment(uuid, bigint, text, uuid) from public, anon, authenticated;
grant execute on function public.add_payout_batch_adjustment(uuid, bigint, text, uuid) to service_role;

comment on function public.add_payout_batch_adjustment is
  'P4-2: 송금 전 최종 금액의 가감 조정. 수업별 자동 산정 항목을 고치지 않고 별도 조정 항목을 '
  '추가한다. 검토 중에는 그대로 허용하고, 승인 뒤 송금 요청 전이면 묶음을 검토 중으로 되돌려 '
  '재승인을 요구한다. 송금 요청 이후에는 거부한다.';

-- =========================================================================
-- 5. 마감 뒤 수업 판정 변경 → 차액 이월
-- =========================================================================
-- 기존 upsert_session_payout_item()은 batched 항목도 그대로 갱신했다 — 이미 승인된
-- 묶음의 금액이 조용히 바뀔 수 있는 구멍이었다. 이제 묶음 상태에 따라 갈린다.
--   묶음 없음 / 아직 열린 묶음(검토 중) → 기존대로 제자리 갱신(검토 정확도 유지)
--   승인 이후 묶음                      → 원본 불변, 차액만 미배치 조정 항목으로 생성
create or replace function public.upsert_session_payout_item(p_session_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_session sessions%rowtype;
  v_existing payout_items%rowtype;
  v_amount_minor bigint;
  v_item_type text;
  v_batch_status text;
  v_delta bigint;
begin
  select * into v_session from sessions where id = p_session_id;
  if v_session.id is null then
    raise exception '세션을 찾을 수 없습니다: %', p_session_id;
  end if;

  select * into v_existing from payout_items where session_id = p_session_id;

  v_batch_status := null;
  if v_existing.id is not null and v_existing.batch_id is not null then
    select status::text into v_batch_status from payout_batches where id = v_existing.batch_id;
  end if;

  if coalesce(v_session.payable_minutes, 0) <= 0 then
    if v_existing.id is not null then
      if v_batch_status is not null and v_batch_status not in ('draft', 'calculated', 'reviewing', 'reviewed') then
        -- 이미 승인·지급 단계다. 원본을 지우지 않고 전액을 차감하는 조정 항목을 만든다.
        if v_existing.amount_minor <> 0 then
          insert into payout_items (
            batch_id, session_id, teacher_id, item_type, hourly_rate_snapshot_minor,
            currency, payable_minutes, amount_minor, status,
            adjusts_payout_item_id, adjustment_reason
          ) values (
            null, null, v_existing.teacher_id, 'adjustment', 0,
            v_existing.currency, 0, -v_existing.amount_minor, 'pending',
            v_existing.id, '마감 뒤 수업 무지급 판정 — 다음 정산월 차감'
          );
        end if;
      else
        delete from payout_items where id = v_existing.id and status <> 'paid';
      end if;
    end if;
    return;
  end if;

  v_item_type := public.session_payout_item_type(v_session.lesson_type_id);
  v_amount_minor := round(v_session.hourly_rate_snapshot_minor * v_session.payable_minutes / 60.0);

  if v_existing.id is not null then
    if v_batch_status is not null and v_batch_status not in ('draft', 'calculated', 'reviewing', 'reviewed') then
      -- 승인 이후 묶음: 원본 불변. 차액만 다음 마감으로 넘긴다.
      v_delta := v_amount_minor - v_existing.amount_minor;
      if v_delta <> 0 then
        insert into payout_items (
          batch_id, session_id, teacher_id, item_type, hourly_rate_snapshot_minor,
          currency, payable_minutes, amount_minor, status,
          adjusts_payout_item_id, adjustment_reason
        ) values (
          null, null, v_existing.teacher_id, 'adjustment', 0,
          v_existing.currency, 0, v_delta, 'pending',
          v_existing.id, '마감 뒤 수업 재판정 차액 — 다음 정산월 반영'
        );
      end if;
      return;
    end if;

    update payout_items
      set payable_minutes = v_session.payable_minutes,
          amount_minor = v_amount_minor,
          hourly_rate_snapshot_minor = v_session.hourly_rate_snapshot_minor,
          currency = v_session.hourly_rate_snapshot_currency,
          item_type = v_item_type
      where id = v_existing.id and status <> 'paid';
  else
    insert into payout_items (
      session_id, teacher_id, item_type, hourly_rate_snapshot_minor, currency, payable_minutes, amount_minor, status
    ) values (
      p_session_id, v_session.teacher_id, v_item_type, v_session.hourly_rate_snapshot_minor,
      v_session.hourly_rate_snapshot_currency, v_session.payable_minutes, v_amount_minor, 'pending'
    );
  end if;
end;
$$;

comment on function public.upsert_session_payout_item is
  'P4-2(2026-09-12): 마감 뒤 재판정 보호 추가. 항목이 이미 승인 이후 묶음에 실려 있으면 원본을 '
  '건드리지 않고 차액만 미배치 조정 항목(adjusts_payout_item_id로 원본 연결)으로 만들어 다음 '
  'close_payout_period()가 자동으로 싣는다. 아직 열린 묶음이거나 미배치면 기존대로 제자리 갱신.';
