-- R4 — 결제·환불: 상품/가격 버전, 구매(주문), 결제 시도, 환불 요청, 가격 변경 공지,
-- entitlement_ledger 신규 이벤트 함수(refund/expire/extend/transfer/adjust).
--
-- 순수 additive: entitlement_products/entitlement_types/lesson_types/entitlement_grants/
-- entitlement_ledger/hold_entitlement()/consume_entitlement()/release_entitlement()의
-- 기존 컬럼·본문은 건드리지 않는다(entitlement_grants에 컬럼 추가만 함).
-- external_event_receipts(R3, provider='stripe' 행 재사용), v3_payment_attempt_status/
-- v3_refund_status(R1에서 이미 정의)도 재사용 — 신규 enum 재정의 없음.
--
-- 가격: docs/contracts/web-planner-contract-handoff-2026-09-01.md §8-9 —
-- 단건 $218.75(21875 minor), 20회 패키지 $3,500(350000 minor, 단건 합계 $4,375 대비
-- $875/20% 할인). 유효기간 기본 12개월. 세금은 지금 항상 0(§5.6 준비 blocker, 아래 comment 참고).

-- =========================================================================
-- 0. entitlement_grants 보강 — 유료/무료 구분, purchase FK
-- =========================================================================
-- (판단 1) 유료/무료 구분은 entitlement_products가 아니라 entitlement_grants에 둔다.
-- 같은 상품(lesson_pack_20)도 실제 구매로 생긴 grant와 보상/프로모션으로 생긴 grant가
-- 섞일 수 있어(예: 사고 보상 20회권), "상품이 유료다"가 아니라 "이 grant가 유료 대가로
-- 생겼다"가 환불 대상 여부를 결정하는 진짜 단위이기 때문 — R1 코멘트가 이미
-- entitlement_grants를 감사 단위로 취급하는 것과 일관된다.
alter table entitlement_grants add column is_paid boolean not null default true;
alter table entitlement_grants add column purchase_id_ref uuid; -- 아래 3.에서 FK로 승격
comment on column entitlement_grants.is_paid is
  'R4: 환불 대상 여부의 기준. true=실제 결제로 생성된 grant(환불 가능), false=보상/프로모션 등 무상 grant(환불 대상 아님).';
comment on column entitlement_grants.purchase_id_ref is
  'R4: purchases.id 참조. R1 시절 이미 있던 purchase_id 컬럼은 FK 없이 예약돼 있었으므로(코멘트 참고) 새 컬럼으로 만들고 아래에서 FK를 건다. 기존 purchase_id 컬럼은 미사용 상태로 남겨두되 앱 코드는 이 컬럼(purchase_id_ref)만 사용한다.';

-- =========================================================================
-- 1. 상품/가격 버전
-- =========================================================================
-- 단건 상품도 실제 구매 가능한 상품이라 lesson_pack_20 옆에 새 행을 추가한다(R1 마스터
-- 데이터는 건드리지 않고 INSERT만 추가 — additive).
insert into entitlement_products (code, entitlement_type_id, quantity)
  select 'lesson_pack_1', id, 1 from entitlement_types where code = 'regular_lesson_use';

create table entitlement_product_versions (
  id uuid primary key default gen_random_uuid(),
  entitlement_product_id uuid not null references entitlement_products (id),
  version_number int not null,
  price_minor bigint not null check (price_minor >= 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0), -- 단건 환산가(환불 계산용)
  currency text not null default 'USD',
  validity_months int not null default 12 check (validity_months > 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  discount_percent numeric(5, 2) not null default 0 check (discount_percent >= 0),
  effective_from timestamptz not null,
  effective_until timestamptz,
  discontinued_at timestamptz,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  unique (entitlement_product_id, version_number)
);
create index on entitlement_product_versions (entitlement_product_id, effective_from);

-- 상품당 겹치지 않는 유효 구간(가격 버전은 시간상 겹칠 수 없다).
alter table entitlement_product_versions add constraint entitlement_product_versions_no_overlap
  exclude using gist (
    entitlement_product_id with =,
    tstzrange(effective_from, coalesce(effective_until, 'infinity'::timestamptz)) with &&
  );

insert into entitlement_product_versions
  (entitlement_product_id, version_number, price_minor, unit_price_minor, currency, validity_months,
   discount_minor, discount_percent, effective_from, created_by)
  select id, 1, 21875, 21875, 'USD', 12, 0, 0, now(), null
  from entitlement_products where code = 'lesson_pack_1';
insert into entitlement_product_versions
  (entitlement_product_id, version_number, price_minor, unit_price_minor, currency, validity_months,
   discount_minor, discount_percent, effective_from, created_by)
  select id, 1, 350000, 21875, 'USD', 12, 87500, 20.00, now(), null
  from entitlement_products where code = 'lesson_pack_20';

comment on table entitlement_product_versions is
  'R4: entitlement_products는 상품 정체성(코드/수량)만 갖고, 가격·유효기간·할인은 버전으로 분리. 신규 구매는 항상 최신 유효 버전을, 기존 purchases 행은 구매 시점 버전을 스냅샷으로 고정 참조한다(가격 변경이 과거 구매에 소급 적용되지 않음).';

-- =========================================================================
-- 2. 구매(주문)
-- =========================================================================
create table purchases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id),
  child_id uuid not null references profiles (id),
  contract_id uuid not null references contracts (id),
  entitlement_product_id uuid not null references entitlement_products (id),
  product_version_id uuid not null references entitlement_product_versions (id), -- 가격 스냅샷 FK
  quantity int not null check (quantity > 0), -- entitlement_products.quantity 스냅샷(20 또는 1)
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  package_price_minor bigint not null check (package_price_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  discount_percent numeric(5, 2) not null default 0,
  tax_minor bigint not null default 0 check (tax_minor >= 0), -- 지금은 항상 0, 아래 comment 참고
  total_minor bigint not null check (total_minor >= 0),
  currency text not null default 'USD',
  validity_months int not null,
  status v3_payment_attempt_status not null default 'created', -- 결제 attempt와 같은 상태 집합 재사용(진행 상태는 최신 attempt를 반영)
  price_policy_version text, -- entitlement_product_versions에 없는 정책 성격 필드는 텍스트 식별자로만 스냅샷
  refund_policy_version text not null default 'r4-2026-09-01',
  terms_version text,
  expires_at timestamptz, -- 결제 confirmed 시점 + validity_months, 그 전까지는 null
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
create index on purchases (household_id);
create index on purchases (child_id);
create index on purchases (contract_id);
create index on purchases (status);

alter table entitlement_grants add constraint entitlement_grants_purchase_id_ref_fkey
  foreign key (purchase_id_ref) references purchases (id);
create index on entitlement_grants (purchase_id_ref);

comment on table purchases is
  'R4: 구매 시점 가격·정책 전부를 스냅샷으로 고정(unit_price_minor 등) — product_version_id가 가리키는 가격이 이후 바뀌어도 이 행은 불변. status는 v3_payment_attempt_status 재사용(구매의 대표 상태 = 최신 payment_attempts 상태를 앱이 동기화). 부분환불/환불/분쟁 같은 파생 상태(§5.6 pending/paid/partially_refunded/refunded/disputed)는 이 테이블에 별도 컬럼을 두지 않고 refund_requests·entitlement_ledger를 조인해 계산한다 — 이중 상태 저장 방지.';
comment on column purchases.tax_minor is
  'R4: 지금은 항상 0(세금 서비스 미연동, 확정 정책). 실제 launch 전 blocker: 관할별 세율 계산기/세금 사업자 등록/영수증 세금 표기 요건 확인 필요 — 이 마이그레이션 범위 밖.';

-- =========================================================================
-- 3. 결제 시도
-- =========================================================================
create table payment_attempts (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases (id),
  status v3_payment_attempt_status not null default 'created',
  stripe_payment_intent_id text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on payment_attempts (purchase_id);
create index on payment_attempts (status);

-- =========================================================================
-- 4. 환불 요청(관리자 워크플로)
-- =========================================================================
create table refund_requests (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases (id),
  status v3_refund_status not null default 'requested',
  calculated_refund_minor bigint not null check (calculated_refund_minor >= 0),
  consumed_count_at_calculation int not null check (consumed_count_at_calculation >= 0),
  reason text,
  requested_by uuid references profiles (id),
  resolved_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index on refund_requests (purchase_id);
create index on refund_requests (status);

comment on table refund_requests is
  'R4: 환불 "요청/검토/승인" 관리자 워크플로만 추적. 승인 시 실제 entitlement 잔량 회수는 refund_entitlement()가 entitlement_ledger에 refund 이벤트로 기록 — 이 테이블 자체는 잔액에 영향을 주지 않는다.';

-- =========================================================================
-- 5. 가격 변경 공지 아웃박스(실제 발송 없음)
-- =========================================================================
create table price_change_notices (
  id uuid primary key default gen_random_uuid(),
  product_version_id uuid not null references entitlement_product_versions (id), -- 새로 공지되는 버전
  notice_required_by timestamptz not null, -- effective_from - 30일
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped')),
  recipient_note text, -- 실제 수신자 목록 대신, 관리자가 "누구에게 보내야 하는지" 메모(최소 구현)
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index on price_change_notices (status, notice_required_by);

comment on table price_change_notices is
  'R4: 실제 이메일 발송 없음(정책상 real send 금지) — 관리자가 "30일 전 공지 필요" 대상을 조회하는 아웃박스. status는 관리자가 수동으로 sent/skipped로 바꾼다.';

-- =========================================================================
-- 6. 영수증 — 별도 테이블 없음(판단 2)
-- =========================================================================
-- purchases가 이미 주문/결제ID, 아동+household(보호자는 household_members join),
-- contract_id, 상품/수량/단가/패키지가/할인/세금/총액/통화, 유효기간, 정책 버전,
-- Stripe ID, confirmed_at까지 전부 스냅샷으로 갖고 있어 영수증에 필요한 필드가
-- purchases + payment_attempts(최신 attempt의 결제 상태) 조인만으로 전부 나온다.
-- 별도 receipts 테이블은 같은 데이터를 이중 저장하는 redundant 테이블이라 만들지 않는다.
create or replace view purchase_receipts as
select
  p.id as purchase_id,
  p.household_id,
  p.child_id,
  p.contract_id,
  cv.version_number as contract_version_number,
  p.entitlement_product_id,
  ep.code as product_code,
  p.product_version_id,
  p.quantity,
  p.unit_price_minor,
  p.package_price_minor,
  p.discount_minor,
  p.discount_percent,
  p.tax_minor,
  p.total_minor,
  p.currency,
  p.validity_months,
  p.expires_at,
  p.price_policy_version,
  p.refund_policy_version,
  p.terms_version,
  p.status,
  p.stripe_checkout_session_id,
  p.stripe_payment_intent_id,
  p.created_at,
  p.confirmed_at
from purchases p
join entitlement_products ep on ep.id = p.entitlement_product_id
left join lateral (
  select cv2.version_number from contract_versions cv2
  where cv2.contract_id = p.contract_id
  order by cv2.version_number desc limit 1
) cv on true;

comment on view purchase_receipts is 'R4: 영수증은 purchases 스냅샷만으로 파생 — 별도 저장 테이블 없음.';

-- =========================================================================
-- 7. 환불액 계산 헬퍼
-- =========================================================================
-- 환불액 = 실제 패키지 결제금액 - (소진 횟수 × 구매 당시 단건 판매가), 0에서 floor.
-- 소진 횟수 = 해당 purchase에 연결된 grant들에 기록된 consume 이벤트 수(지각취소·노쇼
-- 포함 — consume_entitlement()가 호출된 모든 경우를 그대로 카운트, 이 함수 책임 밖).
create or replace function public.calculate_purchase_refund_minor(p_purchase_id uuid)
returns table (refund_minor bigint, consumed_count int)
language sql stable security definer set search_path = public as $$
  select
    greatest(0, p.package_price_minor - (coalesce(consumed.cnt, 0) * p.unit_price_minor)),
    coalesce(consumed.cnt, 0)::int
  from purchases p
  left join lateral (
    select count(*) as cnt
    from entitlement_ledger l
    join entitlement_grants g on g.id = l.grant_id
    where g.purchase_id_ref = p.id and l.event_type = 'consume'
  ) consumed on true
  where p.id = p_purchase_id;
$$;
revoke execute on function public.calculate_purchase_refund_minor(uuid) from public, anon, authenticated;
grant execute on function public.calculate_purchase_refund_minor(uuid) to service_role;

-- =========================================================================
-- 8. entitlement_ledger 신규 이벤트 함수
-- =========================================================================
-- 아래 5개 함수 모두 기존 hold_entitlement/consume_entitlement/release_entitlement와
-- 동일한 패턴을 따른다: grant를 `for update`로 먼저 잠그고, 잠금 획득 후 잔액을
-- entitlement_ledger 합산으로 재계산하고, business_event_id 기반 idempotency는
-- entitlement_ledger_business_event_dedup unique index(기존 R1)가 처리한다.

-- 8-1. refund_entitlement — purchase 단위 전량 환불(부분 패키지 환불 없음, 확정 정책).
create or replace function public.refund_entitlement(p_purchase_id uuid, p_business_event_id text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_grant record;
  v_remaining int;
begin
  for v_grant in
    select id from entitlement_grants
    where purchase_id_ref = p_purchase_id and is_paid
    order by id
    for update
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

-- 8-2. expire_entitlement — 미소진 잔량을 만료 처리.
create or replace function public.expire_entitlement(p_grant_id uuid, p_business_event_id text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_remaining int;
begin
  perform 1 from entitlement_grants where id = p_grant_id for update;
  select coalesce(sum(amount), 0) into v_remaining from entitlement_ledger where grant_id = p_grant_id;
  if v_remaining > 0 then
    insert into entitlement_ledger (grant_id, event_type, amount, business_event_id)
    values (p_grant_id, 'expire', -v_remaining, p_business_event_id)
    on conflict do nothing;
  end if;
end;
$$;

-- 8-3. extend_entitlement — 회사/선생님 귀책 취소로 만료 30일 미만 남은 grant를 연장.
-- 잔액에는 영향 없음(amount=0인 adjust 이벤트로 감사 기록만 남기고 expires_at은
-- entitlement_grants에서 직접 갱신 — expires_at은 ledger가 아니라 grant 컬럼이라
-- hold_entitlement()의 FEFO 쿼리가 그대로 새 만료일을 인식한다).
-- (판단: "만료 취소(restore)"는 별도 함수를 만들지 않고 이 함수와 adjust_entitlement로
-- 충분히 커버된다고 판단했다 — expire_entitlement가 남긴 음수 ledger 행을 되돌리려면
-- adjust_entitlement로 같은 금액을 양수로 재적립하면 되고, 별도 event_type을 추가하려면
-- v3_entitlement_event_type enum 자체를 바꿔야 해서 "기존 enum 재정의 없음" 제약과
-- 충돌한다.)
create or replace function public.extend_entitlement(p_grant_id uuid, p_new_expires_at timestamptz, p_business_event_id text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_old_expires_at timestamptz;
begin
  select expires_at into v_old_expires_at from entitlement_grants where id = p_grant_id for update;
  if v_old_expires_at is null then
    raise exception '존재하지 않는 grant입니다: %', p_grant_id;
  end if;
  if p_new_expires_at <= v_old_expires_at then
    raise exception '연장된 만료일(%)은 기존 만료일(%)보다 이후여야 합니다.', p_new_expires_at, v_old_expires_at;
  end if;

  update entitlement_grants set expires_at = p_new_expires_at where id = p_grant_id;
  insert into entitlement_ledger (grant_id, event_type, amount, business_event_id)
  values (p_grant_id, 'adjust', 0, p_business_event_id)
  on conflict do nothing;
end;
$$;

-- 8-4. transfer_entitlement — 관리자 전용, 자녀 간 미사용·미보류 grant 이전.
-- (판단: 대상 grant 설계) 원본 grant의 잔량을 줄이는 transfer 이벤트를 원본에 남기고,
-- 대상 자녀 앞으로 새 entitlement_grants 행을 만들어 그 안에서 grant 이벤트를 기록한다
-- — 기존 grant의 child_id를 UPDATE로 바꾸는 방식도 고려했으나, 그러면 원본 grant의
-- child_id 이력이 사라져 "원래 누구 것이었는지" 감사가 끊긴다. 새 grant를 만들면 원본
-- grant(child_id는 그대로, 잔액만 transfer로 줄어듦)와 신규 grant(새 child_id, 원본을
-- business_event_id/transfer_group_id로 역추적 가능) 양쪽에서 완전한 이력이 남는다.
create or replace function public.transfer_entitlement(
  p_source_grant_id uuid,
  p_destination_child_id uuid,
  p_amount int,
  p_business_event_id text
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_source entitlement_grants%rowtype;
  v_remaining int;
  v_transfer_group_id uuid := gen_random_uuid();
  v_new_grant_id uuid;
  v_has_active_contract boolean;
begin
  if p_amount <= 0 then
    raise exception 'p_amount는 0보다 커야 합니다(받은 값: %).', p_amount;
  end if;

  select * into v_source from entitlement_grants where id = p_source_grant_id for update;
  if not found then
    raise exception '존재하지 않는 grant입니다: %', p_source_grant_id;
  end if;
  if not v_source.is_paid then
    raise exception '무상(is_paid=false) grant는 이전할 수 없습니다.';
  end if;

  select coalesce(sum(amount), 0) into v_remaining from entitlement_ledger where grant_id = p_source_grant_id;
  if v_remaining < p_amount then
    raise exception '이전 가능한 잔량(%)이 요청 수량(%)보다 적습니다.', v_remaining, p_amount;
  end if;

  -- TODO(app layer): "호환 계약" 정의가 정책상 아직 "활성 계약 존재"보다 구체화되지
  -- 않았다 — 과목/플랜 일치까지 봐야 하는지는 R4 확정 정책 문서에 없어 여기서는
  -- 최소 조건(대상 자녀에게 active 계약이 있어야 함)만 강제한다.
  select exists (
    select 1 from contracts where child_id = p_destination_child_id and status = 'active'
  ) into v_has_active_contract;
  if not v_has_active_contract then
    raise exception '대상 자녀에게 활성 계약이 없어 이전할 수 없습니다.';
  end if;

  insert into entitlement_ledger (grant_id, event_type, amount, business_event_id, transfer_group_id)
  values (p_source_grant_id, 'transfer', -p_amount, p_business_event_id, v_transfer_group_id)
  on conflict do nothing;

  insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid)
  values (p_destination_child_id, v_source.entitlement_product_id, v_source.purchase_id_ref, p_amount, v_source.expires_at, v_source.is_paid)
  returning id into v_new_grant_id;

  insert into entitlement_ledger (grant_id, event_type, amount, business_event_id, transfer_group_id)
  values (v_new_grant_id, 'grant', p_amount, p_business_event_id || ':dest', v_transfer_group_id)
  on conflict do nothing;

  return v_new_grant_id;
end;
$$;

-- 8-5. adjust_entitlement — 관리자 수기 정정(양수/음수 모두 가능).
create or replace function public.adjust_entitlement(p_grant_id uuid, p_amount int, p_business_event_id text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_remaining int;
begin
  if p_amount = 0 then
    raise exception 'p_amount는 0이 될 수 없습니다.';
  end if;

  perform 1 from entitlement_grants where id = p_grant_id for update;
  select coalesce(sum(amount), 0) into v_remaining from entitlement_ledger where grant_id = p_grant_id;
  if v_remaining + p_amount < 0 then
    raise exception '정정 후 잔액이 음수가 됩니다(현재 %, 조정 %).', v_remaining, p_amount;
  end if;

  insert into entitlement_ledger (grant_id, event_type, amount, business_event_id)
  values (p_grant_id, 'adjust', p_amount, p_business_event_id)
  on conflict do nothing;
end;
$$;

revoke execute on function public.refund_entitlement(uuid, text) from public, anon, authenticated;
revoke execute on function public.expire_entitlement(uuid, text) from public, anon, authenticated;
revoke execute on function public.extend_entitlement(uuid, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.transfer_entitlement(uuid, uuid, int, text) from public, anon, authenticated;
revoke execute on function public.adjust_entitlement(uuid, int, text) from public, anon, authenticated;
-- service_role은 revoke하지 않는다 — 기존 3개 함수와 동일하게 서버 액션(service-role
-- 클라이언트)이 호출하는 경로다. transfer/adjust는 관리자 전용 흐름이라 서버 액션
-- 자체에서 is_admin() OR current_user_has_capability('manage_payments')를 검사한 뒤
-- service-role로 이 함수를 호출한다(함수 내부에는 auth.uid() 기반 권한 검사가 없음 —
-- hold/consume/release와 동일한 설계 원칙).

-- =========================================================================
-- 9. capability
-- =========================================================================
-- 결제/환불 관리자 작업 전용 새 capability 이름은 'manage_payments'로 정한다
-- (20260909000000의 manage_invites 등과 같은 자유 텍스트 패턴 — supervisor_capabilities에
-- 관리자가 직접 부여하는 값이라 여기서 테이블/함수를 새로 만들 필요는 없다. product
-- version/refund_requests/price_change_notices RLS의 admin 쓰기 정책이 아래에서
-- is_admin() OR current_user_has_capability('manage_payments')를 함께 검사한다).

-- =========================================================================
-- 10. RLS
-- =========================================================================
alter table entitlement_product_versions enable row level security;
alter table purchases enable row level security;
alter table payment_attempts enable row level security;
alter table refund_requests enable row level security;
alter table price_change_notices enable row level security;

-- 가격 버전: 로그인한 누구나 조회 가능(구매 화면에서 현재가를 봐야 함), 쓰기는 관리자.
create policy entitlement_product_versions_select on entitlement_product_versions
  for select using (auth.role() = 'authenticated' or is_admin());
create policy entitlement_product_versions_admin_write on entitlement_product_versions
  for all using (is_admin() or current_user_has_capability('manage_payments'))
  with check (is_admin() or current_user_has_capability('manage_payments'));

-- purchases/payment_attempts: 같은 household의 보호자·본인(child), 관리자.
create policy purchases_household_select on purchases
  for select using (
    is_admin()
    or child_id = auth.uid()
    or is_household_guardian_of(child_id)
  );
create policy purchases_admin_write on purchases
  for all using (is_admin() or current_user_has_capability('manage_payments'))
  with check (is_admin() or current_user_has_capability('manage_payments'));

create policy payment_attempts_household_select on payment_attempts
  for select using (
    is_admin()
    or exists (
      select 1 from purchases p
      where p.id = payment_attempts.purchase_id
        and (p.child_id = auth.uid() or is_household_guardian_of(p.child_id))
    )
  );
create policy payment_attempts_admin_write on payment_attempts
  for all using (is_admin() or current_user_has_capability('manage_payments'))
  with check (is_admin() or current_user_has_capability('manage_payments'));

-- refund_requests: household는 조회만(요청 접수는 서버 액션이 service-role로 insert),
-- 쓰기(상태 전이)는 관리자만.
create policy refund_requests_household_select on refund_requests
  for select using (
    is_admin()
    or exists (
      select 1 from purchases p
      where p.id = refund_requests.purchase_id
        and (p.child_id = auth.uid() or is_household_guardian_of(p.child_id))
    )
  );
create policy refund_requests_admin_write on refund_requests
  for all using (is_admin() or current_user_has_capability('manage_payments'))
  with check (is_admin() or current_user_has_capability('manage_payments'));

-- price_change_notices: 관리자 전용(공지 대상 조회는 운영 내부 도구).
create policy price_change_notices_admin_only on price_change_notices
  for all using (is_admin() or current_user_has_capability('manage_payments'))
  with check (is_admin() or current_user_has_capability('manage_payments'));

-- external_event_receipts는 이미 R3에서 RLS enable + service_role 전용으로 처리됨(정책
-- 없음 = service_role만 RLS 우회로 접근) — 이번 마이그레이션에서 추가 정책 없음.
