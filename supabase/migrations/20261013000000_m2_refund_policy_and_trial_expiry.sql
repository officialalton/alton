-- M2 잔여 마감 — 정규상품 환불 정책(7일 이내 미사용 전액환불 + 미래 예약 해제
-- 우선순위) 실제 구현. 체험수업권 90일 유효기간(지급일 기준)은 20261012000000에서
-- 이미 `now() + interval '90 days'`로 구현·psql 실측 검증돼 있고, hold_entitlement()의
-- `expires_at > p_lesson_start_at` 필터가 "체험 실제 시작 시각이 만료 이하여야 함"을
-- 이미 강제한다(신규 grant마다, 시간 변경 시에도 reschedule_reservation_to_google_time()이
-- 동일 필터를 재검증) — 이번 마이그레이션은 그 사실을 명시적으로 확인하는 코멘트만
-- 남기고 SQL은 건드리지 않는다(아래 §3 참고, 실측 재확인은 실행 로그 §2).
--
-- 순수 additive: 기존 refund_requests/entitlement_grants/entitlement_ledger 컬럼과
-- refund_entitlement()의 INSERT-only 패턴은 건드리지 않는다(CREATE OR REPLACE로
-- 로직만 확장, 컬럼 추가만 함).

-- =========================================================================
-- 1. 미래 활성 hold 탐지 헬퍼 (요구사항: "hold·release·consume 상태가 환불 가능
--    회차와 충돌하지 않도록 명시적으로 처리" + "미래 예약 해제 우선순위")
-- =========================================================================
-- 설계 판단: 자동으로 미래 예약을 취소하지 않는다. 예약 취소는 이미
-- cancel_lesson_booking()(R6)이 Calendar 동기화·통지·정산 영향까지 포함해
-- 전담하는 별도의 완결된 흐름이고, 환불 승인이 그 전부를 몰래 트리거하면
-- 관리자가 의도치 않게 학생의 확정된 미래 수업을 취소시키는 부작용이 생긴다.
-- 대신 "미래 예약 해제가 우선"이라는 요구사항을 **명시적 차단**으로 구현한다 —
-- 아직 소진되지 않은 미래 예약(hold)이 있으면 환불 계산·승인 양쪽에서 이 사실을
-- 그대로 노출하고, 관리자가 기존 취소 흐름으로 그 예약을 먼저 해제한 뒤에만
-- 환불이 진행되도록 강제한다(release_entitlement()가 이미 그 해제를 담당).
-- 이 기술적 선택은 실행 로그에 근거와 함께 기록해뒀다 — 자동 취소가 오히려
-- 맞다고 판단되면 이 함수 하나만 교체하면 된다(refund_entitlement()/
-- calculate_purchase_refund_minor() 양쪽이 이 함수만 호출하도록 설계).
create or replace function public.purchase_has_active_future_holds(p_purchase_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from entitlement_grants g
    join entitlement_ledger h on h.grant_id = g.id and h.event_type = 'hold'
    join reservations r on r.id = h.reservation_id
    where g.purchase_id_ref = p_purchase_id
      and r.starts_at > now()
      and not exists (
        select 1 from entitlement_ledger x
        where x.reservation_id = h.reservation_id and x.event_type in ('consume', 'release')
      )
  );
$$;
revoke execute on function public.purchase_has_active_future_holds(uuid) from public, anon, authenticated;
grant execute on function public.purchase_has_active_future_holds(uuid) to service_role;

comment on function public.purchase_has_active_future_holds(uuid) is
  'M2: 이 구매로 생긴 grant에 아직 소진/해제되지 않은 미래 예약 hold가 있으면 true. calculate_purchase_refund_minor()/refund_entitlement() 양쪽이 이 함수로 환불 가능 여부를 판단한다 — 미래 예약은 기존 취소 흐름(cancel_lesson_booking)으로 먼저 해제해야 환불이 진행된다(자동 취소하지 않음, 근거는 이 마이그레이션 상단 주석).';

-- =========================================================================
-- 2. calculate_purchase_refund_minor — 7일 이내 미사용 전액환불 (요구사항 2)
-- =========================================================================
-- 스냅샷 원칙(중요, 요구사항 명시): 아래 계산은 전부 purchases 행에 구매 시점
-- 스냅샷으로 고정된 값(package_price_minor/unit_price_minor/confirmed_at)과
-- entitlement_ledger의 INSERT-only 이력만 사용한다 — entitlement_product_versions의
-- "현재" 가격은 전혀 조회하지 않는다(상품 가격이 나중에 바뀌어도 과거 구매의
-- 환불액은 절대 달라지지 않는다, 20260922000000 §1 comment와 동일 원칙).
-- 반환 타입(OUT 컬럼 구성)이 바뀌므로 CREATE OR REPLACE만으로는 안 된다
-- (Postgres는 기존 함수의 리턴 row 타입 변경을 거부한다) — 먼저 명시적으로
-- drop한다. 이 함수는 서버 액션(entitlement-actions.ts)에서만 이름으로
-- 호출되므로 drop 후 재생성 사이 순간적인 부재는 이 마이그레이션 트랜잭션
-- 내부에서만 존재해 외부에서 관측되지 않는다.
drop function if exists public.calculate_purchase_refund_minor(uuid);

create or replace function public.calculate_purchase_refund_minor(p_purchase_id uuid)
returns table (
  refund_minor bigint,
  consumed_count int,
  within_full_refund_window boolean,
  blocked_by_active_holds boolean
)
language sql stable security definer set search_path = public as $$
  select
    case
      when blocked.v then 0 -- 차단 상태에서는 금액을 계산해 보여주지 않는다(혼동 방지) — 관리자는 blocked_by_active_holds를 본다.
      when full_window.v then p.package_price_minor
      else greatest(0, p.package_price_minor - (coalesce(consumed.cnt, 0) * p.unit_price_minor))
    end as refund_minor,
    coalesce(consumed.cnt, 0)::int as consumed_count,
    full_window.v as within_full_refund_window,
    blocked.v as blocked_by_active_holds
  from purchases p
  left join lateral (
    select count(*) as cnt
    from entitlement_ledger l
    join entitlement_grants g on g.id = l.grant_id
    where g.purchase_id_ref = p.id and l.event_type = 'consume'
  ) consumed on true
  left join lateral (
    -- 요구사항: "구매 후 7일 이내 + 전혀 미사용이면 전액 환불". 기준일은
    -- 실제 결제가 확정된 시점(purchases.confirmed_at, R4부터 존재하는 스냅샷
    -- 컬럼) — created_at(체크아웃 시도 생성 시각)이 아니다. confirmed_at이
    -- 아직 없는(결제 미확정) 구매는 이 창 자체가 성립하지 않으므로 false.
    select (
      p.confirmed_at is not null
      and now() <= p.confirmed_at + interval '7 days'
      and coalesce(consumed.cnt, 0) = 0
    ) as v
  ) full_window on true
  left join lateral (
    select purchase_has_active_future_holds(p.id) as v
  ) blocked on true
  where p.id = p_purchase_id;
$$;
revoke execute on function public.calculate_purchase_refund_minor(uuid) from public, anon, authenticated;
grant execute on function public.calculate_purchase_refund_minor(uuid) to service_role;

comment on function public.calculate_purchase_refund_minor(uuid) is
  'M2: 7일 이내+전혀 미사용이면 전액(package_price_minor), 그 외는 max(0, package_price_minor - consumed_count*unit_price_minor). 미래 활성 hold가 있으면(purchase_has_active_future_holds) blocked_by_active_holds=true를 반환하고 refund_minor는 참고용으로 0을 반환한다 — 실제 차단은 refund_entitlement()가 강제한다. 전부 purchases 스냅샷 + entitlement_ledger 이력만 사용, 현재 가격표를 조회하지 않는다.';

-- =========================================================================
-- 3. refund_entitlement — 미래 hold 차단을 실제로 강제 (요구사항 2)
-- =========================================================================
create or replace function public.refund_entitlement(p_purchase_id uuid, p_business_event_id text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_grant record;
  v_remaining int;
begin
  -- 명시적 충돌 처리(요구사항): 아직 소진/해제되지 않은 미래 예약 hold가 있으면
  -- 환불 자체를 진행하지 않는다. 관리자는 이 예외 메시지를 보고 기존 취소
  -- 흐름으로 그 예약을 먼저 해제한 뒤 재시도한다 — 재시도는 그대로 안전하다
  -- (이 함수의 나머지는 기존과 동일하게 idempotent).
  if purchase_has_active_future_holds(p_purchase_id) then
    raise exception '아직 소진되지 않은 미래 예약이 있어 환불을 진행할 수 없습니다. 먼저 해당 예약을 취소해 수업권을 해제해주세요.';
  end if;

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
revoke execute on function public.refund_entitlement(uuid, text) from public, anon, authenticated;
-- service_role은 유지(기존과 동일 — 서버 액션이 service-role로 호출).

comment on function public.refund_entitlement(uuid, text) is
  'R4/M2: purchase 단위 전량 환불. M2부터 미래 활성 hold가 있으면 fail-closed로 거부(purchase_has_active_future_holds) — "미래 예약 해제 우선순위" 요구사항을 자동 취소가 아니라 명시적 차단+안내로 구현했다(근거는 이 마이그레이션 §1 주석). 체험수업권(is_paid=false, purchase_id_ref 항상 null)은 이 WHERE 조건에 애초에 걸리지 않아 환불 대상에서 자동 제외된다.';

-- =========================================================================
-- 4. refund_requests — 감사 이력에 7일 전액환불 적용 여부도 남긴다 (요구사항: 계산
--    근거를 감사 이력으로 보존)
-- =========================================================================
alter table refund_requests add column within_full_refund_window boolean not null default false;
comment on column refund_requests.within_full_refund_window is
  'M2: 요청 시점에 calculate_purchase_refund_minor()가 7일 이내+미사용 전액환불 규칙을 적용했는지 스냅샷. calculated_refund_minor/consumed_count_at_calculation과 함께 그 순간의 계산 근거를 감사 이력으로 고정한다(승인 시점에 재계산해도 이 값은 바뀌지 않음).';

-- =========================================================================
-- 5. 체험수업권 90일 유효기간 — 확인용 코멘트만(로직 변경 없음)
-- =========================================================================
-- 정책 확정(2026-09-03): 지급일로부터 90일(20261012000000 §6에서 이미
-- `now() + interval '90 days'`로 구현됨 — 이 마이그레이션은 그 값을 바꾸지
-- 않는다, 이미 정책과 일치). "예약을 90일 안에 하는 것만으로는 부족 — 체험수업
-- 실제 시작 시각이 만료 시각 이하여야 함"은 hold_entitlement()의 기존 필터
-- `g.expires_at > p_lesson_start_at`가 이미 강제한다(모든 lesson_type에 공통
-- 적용되는 필터라 체험 전용 특수 로직이 필요 없다) — 실측 재확인은 실행 로그
-- 참고. "시간 변경 시 재검증"도 이미 존재하는
-- reschedule_reservation_to_google_time()(20261005000000)이 정확히 같은
-- 필터(`v_hold_grant_expires_at <= p_new_starts_at`)로 범용 처리한다(체험
-- 전용 코드 없이 정규/체험 공통 재사용). M3(체험 예약 자체)가 아직 없어
-- 이 경로들은 정규 예약에서만 실제로 실행되지만, 체험 예약이 M3에서
-- confirm_lesson_booking()/reschedule_reservation_to_google_time()을 그대로
-- 재사용하는 순간 동일하게 적용된다 — 추가 인터페이스 설계 불필요.
comment on column entitlement_grants.expires_at is
  'Gate B/R4/M2: 정규 grant는 구매 시 validity_months로, 체험 grant(is_paid=false, source_consultation_id not null)는 grant_trial_entitlement_for_consultation()이 지급 시점 now()+90일로 채운다. hold_entitlement()의 expires_at > p_lesson_start_at 필터가 "수업 실제 시작 시각이 만료 이하"를 모든 lesson_type에 공통으로 강제 — 체험 전용 만료 검증 로직은 별도로 만들지 않는다(이미 충분).';
