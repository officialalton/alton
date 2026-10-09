-- R10 corrective — 법인 설립 전 실제 지급 차단 게이트(2026-09-07 제품 정책).
--
-- 배경: `20261218000000_r10_payout_batch_lifecycle.sql`이 만든
-- mark_payout_batch_processing()/mark_payout_batch_paid()/reverse_payout_item()은
-- approved 이후 processing/paid까지 상태를 진행시킬 수 있었다. 그러나
-- 로드맵(§R10 "법인 설립 전 지급 경계", 2026-09-07 확정)은 법인명·EIN·
-- 사업 계좌·지급수단이 확정되기 전에는 **정산 원장/시뮬레이션만** 허용하고
-- 실제 송금·paid 상태 전환을 열지 않는다고 명시한다. 이 마이그레이션은
-- 기존 마이그레이션 파일을 수정하지 않고(additive) DB 레벨에서 이 경계를
-- fail-closed로 강제한다.
--
-- 실제 Mercury/Wise API 호출 코드는 현재 레포 어디에도 없음(grep 확인,
-- 2026-09-07) — 이 마이그레이션은 순수 DB 가드이며, 훗날 법인 설립 후
-- 실제 지급을 열 때는 아래 게이트 테이블의 단일 행을 갱신하는 것만으로
-- processing/paid 경로가 다시 열리게 설계했다(코드 재배포 불필요).

-- =========================================================================
-- 1. 게이트 테이블 — 앱 레이어의 DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS 패턴과
--    동일한 취지를 DB 레벨에 둔 것. 단일 행만 존재(id 고정), 기본값 false.
-- =========================================================================
create table payout_disbursement_gate (
  id boolean primary key default true,
  real_disbursement_enabled boolean not null default false,
  enabled_at timestamptz,
  enabled_by uuid references profiles (id),
  note text,
  constraint payout_disbursement_gate_singleton check (id = true)
);
insert into payout_disbursement_gate (id, real_disbursement_enabled)
  values (true, false);

comment on table payout_disbursement_gate is
  'R10 법인 설립 전 지급 경계: real_disbursement_enabled=false인 동안 payout batch는 approved까지만 도달할 수 있다(processing/dispatch_requested/provider_pending/paid는 전부 이 게이트가 true가 될 때까지 DB 함수 레벨에서 차단). 법인 설립·지급 인프라 검증 완료 후 이 단일 행을 갱신하는 것으로만 활성화한다 — 코드 배포 불필요, 감사 목적상 enabled_by/enabled_at/note를 반드시 함께 기록.';

alter table payout_disbursement_gate enable row level security;
create policy "payout_disbursement_gate 조회" on payout_disbursement_gate for select
  using (is_admin() or current_user_has_capability('정산권한'));
-- 쓰기는 정책적으로 SQL 콘솔/마이그레이션을 통한 명시적 운영 조작만 허용한다 —
-- 실수로 앱 코드가 이 게이트를 켜는 경로를 만들지 않기 위해 authenticated/anon에는
-- update 정책을 아예 부여하지 않는다(정책 없음 = RLS 기본 거부).

revoke all on payout_disbursement_gate from public, anon, authenticated;
grant select on payout_disbursement_gate to authenticated;

create or replace function public.real_disbursement_enabled()
returns boolean
language sql
stable
as $$
  select coalesce(real_disbursement_enabled, false) from payout_disbursement_gate where id = true;
$$;
comment on function public.real_disbursement_enabled is
  'R10 법인 설립 전 지급 경계 게이트 조회. false(기본값)인 동안 processing/paid 전이와 reverse_payout_item()의 paid 역분개는 fail-closed로 차단된다.';

-- =========================================================================
-- 2. processing/paid 전이 fail-closed 재정의(함수 본문만 교체, 테이블/트리거는
--    기존 그대로) — approve_payout_batch()는 이미 approved까지만 도달하므로
--    변경하지 않는다(로드맵이 approved까지는 명시적으로 허용).
-- =========================================================================
create or replace function public.mark_payout_batch_processing(p_batch_id uuid)
returns void language plpgsql as $$
begin
  if not public.real_disbursement_enabled() then
    raise exception '법인 설립 전 지급 경계(2026-09-07 정책): 실제 지급이 활성화되지 않아 batch를 processing으로 전이할 수 없습니다. approved 상태로 유지하세요.';
  end if;

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
  if not public.real_disbursement_enabled() then
    raise exception '법인 설립 전 지급 경계(2026-09-07 정책): 실제 지급이 활성화되지 않아 batch를 paid로 전이할 수 없습니다. approved 상태로 유지하세요.';
  end if;

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

-- =========================================================================
-- 3. reverse_payout_item() 재설계 — 기존 설계는 "새 paid batch"를 만들어
--    이 자체가 위 경계를 우회했다(paid 항목이 없는데 역분개용 paid batch가
--    생기는 모순도 있었음). 게이트가 꺼져 있는 동안은 역분개도 approved까지만
--    도달하고, 게이트가 켜진 뒤에는 기존 설계(즉시 paid)를 그대로 쓴다.
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
  v_gate_open boolean;
  v_batch_status v3_payout_batch_status;
  v_item_status v3_payout_item_status;
begin
  select * into v_item from payout_items where id = p_original_item_id;
  if not found then
    raise exception '정산 항목을 찾을 수 없습니다.';
  end if;
  if v_item.status != 'paid' then
    raise exception 'paid 상태의 항목만 역분개할 수 있습니다. 그 외 상태는 batch에서 항목을 제거하거나 실패 처리하세요.';
  end if;

  v_gate_open := public.real_disbursement_enabled();
  if v_gate_open then
    v_batch_status := 'paid';
    v_item_status := 'paid';
  else
    -- 법인 설립 전: 역분개도 실제 송금을 의미하지 않으므로 paid가 아니라
    -- approved에서 멈춘다 — 관리자가 이후 실제 지급 활성화 시점에 정상
    -- processing/paid 경로로 다시 진행시킨다.
    v_batch_status := 'approved';
    v_item_status := 'approved';
  end if;

  insert into payout_batches (teacher_id, period_start, period_end, currency, status, approved_at, paid_at)
    values (
      v_item.teacher_id, current_date, current_date, v_item.currency, v_batch_status,
      now(),
      case when v_gate_open then now() else null end
    )
    returning id into v_new_batch_id;

  insert into payout_items (
    batch_id, session_id, teacher_id, item_type, hourly_rate_snapshot_minor, currency,
    payable_minutes, amount_minor, status
  ) values (
    v_new_batch_id, v_item.session_id, v_item.teacher_id, 'reversal', v_item.hourly_rate_snapshot_minor,
    v_item.currency, -v_item.payable_minutes, -v_item.amount_minor, v_item_status
  ) returning id into v_new_item_id;

  insert into payout_batch_audit_log (batch_id, action, actor_id, note)
    values (
      v_new_batch_id,
      case when v_gate_open then 'reversal_created' else 'reversal_created_pending_disbursement' end,
      p_actor_id,
      format('원본 항목 %s 역분개(게이트=%s): %s', p_original_item_id, v_gate_open, coalesce(p_reason, ''))
    );

  return v_new_item_id;
end;
$$;
comment on function public.reverse_payout_item is
  'R10 요구사항 15(역분개) + 법인 설립 전 지급 경계(2026-09-07): 게이트가 꺼져 있으면(기본값) 역분개 batch/item은 approved에서 멈춘다 — paid는 실제 지급 활성화 후에만 가능. 게이트가 켜지면 기존 설계(즉시 paid)를 그대로 따른다.';

revoke execute on function public.real_disbursement_enabled() from public, anon;
grant execute on function public.real_disbursement_enabled() to authenticated;
