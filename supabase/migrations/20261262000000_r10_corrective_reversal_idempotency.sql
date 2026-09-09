-- R10 corrective(2026-09-09, 기반 안정화 계획 1단계 — 정산 P0) —
-- reverse_payout_item()에 이중 환수(같은 원본 paid item을 두 번 역분개)
-- 방지 장치가 없던 것을 닫는다.
--
-- 문제: 기존 reverse_payout_item()(20261224000000)은 원본 행을 잠금 없이
-- 조회하고 status='paid'만 확인한 뒤 무조건 새 음수 batch/item을 만들었다.
-- 같은 원본에 대해 동시 호출 또는 재시도 호출이 발생하면 역분개가 중복
-- 생성될 수 있었다(대사/회계상 실제 손실 위험) — 계획 문서
-- docs/superpowers/plans/2026-09-09-codebase-review-and-performance-diagnosis.md
-- 2절 P0.
--
-- 정책(제품 오너 확정): 원본 paid item 하나당 전체 역분개는 정확히 한 번만
-- 허용한다. 같은 원본에 대해 이미 역분개가 존재하면 새 음수 항목·감사 로그를
-- 만들지 않고 기존 역분개 항목의 ID를 그대로 반환하는 멱등 동작으로 끝난다.

-- =========================================================================
-- 1. 원본 참조 FK + 부분 유니크 제약 — 같은 원본을 참조하는 역분개 행이
--    DB 레벨에서 두 번 생성될 수 없다(앱코드 체크가 아니라 구조적 제약).
-- =========================================================================
alter table payout_items
  add column if not exists reversed_from_item_id uuid references payout_items (id);

comment on column payout_items.reversed_from_item_id is
  'R10 corrective(2026-09-09): 이 행이 역분개(item_type=''reversal'')일 때만 채워지며, 역분개 대상 원본 payout_items.id를 가리킨다. 원본 행 자체는 항상 NULL. 아래 부분 유니크 제약과 함께 "원본당 역분개 최대 1건"을 구조적으로 강제한다.';

create unique index if not exists payout_items_reversed_from_item_id_key
  on payout_items (reversed_from_item_id)
  where reversed_from_item_id is not null;

comment on index payout_items_reversed_from_item_id_key is
  'R10 corrective(2026-09-09): 같은 원본(reversed_from_item_id)에 대한 역분개 행은 최대 1건만 존재할 수 있다 — reverse_payout_item()의 이중 환수 방지 최종 방어선.';

-- =========================================================================
-- 2. reverse_payout_item() 재작성 — 원본 행 FOR UPDATE 잠금 후 재검증,
--    기존 역분개가 있으면 그 ID를 그대로 반환하는 멱등 동작, 동시 경합 시
--    유니크 제약 위반을 잡아 재조회로 수렴.
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
  v_existing_reversal_id uuid;
  v_new_batch_id uuid;
  v_new_item_id uuid;
begin
  -- 원본 행을 잠근 뒤 잠긴 행 기준으로 재검증한다 — 잠금 전 조회 결과를
  -- 신뢰하지 않는다(기존 corrective 패턴과 동일, TOCTOU 방지).
  select * into v_item from payout_items where id = p_original_item_id for update;
  if not found then
    raise exception '정산 항목을 찾을 수 없습니다.';
  end if;
  if v_item.status != 'paid' then
    raise exception 'paid 상태의 항목만 역분개할 수 있습니다. 그 외 상태는 batch에서 항목을 제거하거나 실패 처리하세요.';
  end if;

  -- 멱등 확인: 같은 원본에 대한 역분개가 이미 있으면 새로 만들지 않고
  -- 기존 ID를 그대로 반환한다(신규 INSERT·감사 이벤트 없음).
  select id into v_existing_reversal_id
    from payout_items
    where reversed_from_item_id = p_original_item_id;
  if found then
    return v_existing_reversal_id;
  end if;

  -- 요구사항 2(기존 20261224 corrective 유지): 게이트 상태와 무관하게 항상
  -- approved에서 시작 — 실제 지급 확인은 정규 payout과 동일한 파이프라인을
  -- 통과해야 한다.
  insert into payout_batches (teacher_id, period_start, period_end, currency, status, approved_at)
    values (v_item.teacher_id, current_date, current_date, v_item.currency, 'approved', now())
    returning id into v_new_batch_id;

  insert into payout_items (
    batch_id, session_id, teacher_id, item_type, hourly_rate_snapshot_minor, currency,
    payable_minutes, amount_minor, status, reversed_from_item_id
  ) values (
    v_new_batch_id, v_item.session_id, v_item.teacher_id, 'reversal', v_item.hourly_rate_snapshot_minor,
    v_item.currency, -v_item.payable_minutes, -v_item.amount_minor, 'approved', p_original_item_id
  ) returning id into v_new_item_id;

  insert into payout_batch_audit_log (batch_id, action, actor_id, note)
    values (v_new_batch_id, 'reversal_created', p_actor_id,
      format('원본 항목 %s 역분개: %s', p_original_item_id, coalesce(p_reason, '')));

  return v_new_item_id;
exception
  -- 동시 경합 방어선: 두 트랜잭션이 "기존 역분개 없음"을 동시에 확인하고
  -- 동시에 INSERT를 시도하면, 유니크 제약을 먼저 통과한 쪽만 성공하고 나머지
  -- 하나는 여기서 잡힌다 — 에러를 올리지 않고 재조회해 기존 ID로 수렴한다
  -- (완전한 멱등 반환, 재시도 루프 1회).
  when unique_violation then
    select id into v_existing_reversal_id
      from payout_items
      where reversed_from_item_id = p_original_item_id;
    if found then
      return v_existing_reversal_id;
    end if;
    raise;
end;
$$;
comment on function public.reverse_payout_item is
  'R10 corrective(2026-09-09, 기반 안정화 1단계): 원본 paid item 하나당 역분개는 정확히 한 번만 허용한다. 원본 행을 FOR UPDATE로 잠근 뒤 재검증하고, reversed_from_item_id 기준으로 기존 역분개가 있으면 그 ID를 그대로 반환하는 멱등 동작이다. payout_items_reversed_from_item_id_key 부분 유니크 제약이 동시 호출 시의 최종 방어선이며, unique_violation을 잡아 재조회로 수렴시켜 호출자에게는 항상 성공(같은 ID 반환)으로 보인다. 게이트 상태와 무관하게 항상 approved에서 시작하는 기존 정책(20261224000000)은 유지.';
