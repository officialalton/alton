-- M2 — R4 후속(체험수업권): 구매·환불·양도 불가능한 60분 전용 체험수업권을
-- 상담 결과 "체험 진행 권장"(admin_record_consultation_outcome, M1) 시점에
-- 시스템이 자동 지급한다. 실제 체험 선생님 배정·예약(M3)은 이 마이그레이션
-- 범위가 아니다 — 지급까지만 구현한다.
--
-- 순수 additive: 기존 entitlement_products/entitlement_grants/entitlement_ledger/
-- consultations 컬럼과 hold_entitlement/consume_entitlement/release_entitlement
-- 본문은 건드리지 않는다(컬럼 추가 + CREATE OR REPLACE로 시그니처 확장만).
--
-- 연결 지점: consult_outcome enum의 'trial_recommended' 값(M1에서 이미 정의)이
-- 이 지급의 트리거다. admin_record_consultation_outcome()이 그 값을 기록하는
-- 시점에 같은 트랜잭션 안에서 지급을 시도한다.

-- =========================================================================
-- 1. entitlement_types / entitlement_products — 상품 유형 구분 (요구사항 3)
-- =========================================================================
-- lesson_types에는 이미 R1부터 'trial'(60분)이 존재했지만, 이를 가리키는
-- entitlement_type/product가 지금까지 하나도 없었다(regular_lesson_use만
-- 존재) — 이번에 처음 만든다.
insert into entitlement_types (code, lesson_type_id)
  select 'trial_lesson_use', id from lesson_types where code = 'trial'
  on conflict (code) do nothing;

-- 상품이 "시스템만 지급 가능(구매 불가)"인지 구분하는 컬럼. 기존
-- entitlement_products에는 유료/무료 구분 컬럼이 없었다(R4는 그 구분을
-- entitlement_grants.is_paid에 뒀다 — grant 단위가 진짜 감사 단위라는 판단,
-- 20260922000000 §0 코멘트 참고). 하지만 "이 *상품 자체*를 보호자가 구매
-- 화면에서 선택할 수 있는지"는 grant 단위가 아니라 상품 단위 정책이라
-- entitlement_products에 별도 컬럼이 필요하다.
alter table entitlement_products add column system_only boolean not null default false;
comment on column entitlement_products.system_only is
  'M2: true면 이 상품은 보호자 구매 화면에 노출되지 않고 시스템 함수(grant_trial_entitlement_for_consultation 등)만 grant를 생성할 수 있다. entitlement_product_versions(가격)를 절대 만들지 않는 것이 1차 방어선(가격이 없으면 체크아웃이 fail-closed로 막힌다, purchase-actions.ts), 이 컬럼은 앱 레이어가 명시적으로 필터링할 수 있는 2차 방어선.';

insert into entitlement_products (code, entitlement_type_id, quantity, system_only)
  select 'trial_lesson_grant', id, 1, true from entitlement_types where code = 'trial_lesson_use'
  on conflict (code) do nothing;

comment on table entitlement_products is
  'R1/M2: entitlement_type_id → entitlement_types → lesson_types 조인이 상품의 수업 유형(정규 120분/체험 60분)을 결정한다. system_only=true(trial_lesson_grant)는 가격 버전을 만들지 않고 구매 경로에서 제외한다 — 구매·환불·양도가 전부 불가능한 체험수업권 정책(M2 요구사항 2).';

-- =========================================================================
-- 2. entitlement_grants — 상담 연결 + 중복 지급 방지 (요구사항 4)
-- =========================================================================
alter table entitlement_grants add column source_consultation_id uuid references consultations (id);
comment on column entitlement_grants.source_consultation_id is
  'M2: 이 grant가 상담 결과 지급(체험수업권)으로 생성됐으면 그 상담을 가리킨다. 구매로 생성된 grant는 항상 null(purchase_id_ref를 대신 참조) — 한 grant가 구매와 상담 양쪽에서 동시에 생기는 경우는 없다.';

-- 같은 상담으로 두 번 지급되지 않도록 하는 실제 강제 지점(요구사항 4 — idempotency).
-- 재시도(관리자 수동 재처리 포함)는 이 unique index 덕분에 grant_trial_entitlement_for_consultation()의
-- INSERT ... ON CONFLICT DO NOTHING이 안전하게 no-op된다.
create unique index entitlement_grants_source_consultation_uq
  on entitlement_grants (source_consultation_id) where (source_consultation_id is not null);

-- 조회 편의 뷰(20260923000000 purchase_receipts와 동일 패턴 — 상품→유형→수업형태 조인).
create or replace view entitlement_grant_details as
select
  g.id as grant_id,
  g.child_id,
  g.entitlement_product_id,
  ep.code as product_code,
  ep.system_only,
  lt.code as lesson_type_code,
  lt.label as lesson_type_label,
  lt.duration_minutes as lesson_duration_minutes,
  g.is_paid,
  g.purchase_id_ref,
  g.source_consultation_id,
  g.original_quantity,
  g.expires_at,
  g.created_at,
  coalesce(sum(l.amount), 0) as remaining
from entitlement_grants g
join entitlement_products ep on ep.id = g.entitlement_product_id
join entitlement_types et on et.id = ep.entitlement_type_id
join lesson_types lt on lt.id = et.lesson_type_id
left join entitlement_ledger l on l.grant_id = g.id
group by g.id, ep.code, ep.system_only, lt.code, lt.label, lt.duration_minutes;

comment on view entitlement_grant_details is
  'M2: entitlement_grants + 상품/수업유형 + 잔액을 한 번에 보여주는 조회 전용 뷰. 정규(120분)/체험(60분) grant를 lesson_type_code로 구분할 수 있어 보호자·관리자 화면이 둘을 합산해 보여주는 실수를 막는다.';

-- =========================================================================
-- 3. hold_entitlement — 수업 유형 강제 (요구사항 3, DB 레벨)
-- =========================================================================
-- 기존 시그니처는 child_id의 모든 grant를 만료일 순으로 훑어 첫 번째로 충분한
-- 것을 hold했다 — 수업 유형(정규/체험)을 전혀 구분하지 않았다. 지금까지는
-- entitlement_type이 regular_lesson_use 하나뿐이라 문제가 드러나지 않았을
-- 뿐이다. p_lesson_type_id를 추가하되 기본값 null(=기존 동작, 유형 무관하게
-- 아무 grant나 사용)로 둬 기존 호출부(app/admin/entitlement-actions.ts의
-- holdEntitlementForReservation, 수동 관리자 테스트용)를 깨지 않는다. 실제
-- 예약 흐름(confirm_lesson_booking, 아래 §4)은 이제 항상 명시적으로 넘긴다 —
-- 이 값이 "예약이 요청한 수업 시간(60분/120분)에 맞는 수업권만 사용"을
-- 강제하는 실제 DB 레벨 방어선이다.
create or replace function public.hold_entitlement(
  p_child_id uuid,
  p_reservation_id uuid,
  p_lesson_start_at timestamptz,
  p_needed int default 1,
  p_lesson_type_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_grant record;
  v_remaining int;
begin
  if p_needed <= 0 then
    raise exception 'p_needed는 0보다 커야 합니다(받은 값: %).', p_needed;
  end if;

  for v_grant in
    select g.id from entitlement_grants g
    join entitlement_products ep on ep.id = g.entitlement_product_id
    join entitlement_types et on et.id = ep.entitlement_type_id
    where g.child_id = p_child_id and g.expires_at > p_lesson_start_at
      and (p_lesson_type_id is null or et.lesson_type_id = p_lesson_type_id)
    order by g.expires_at asc, g.created_at asc
    for update of g
  loop
    select coalesce(sum(amount), 0) into v_remaining from entitlement_ledger where grant_id = v_grant.id;
    if v_remaining >= p_needed then
      insert into entitlement_ledger (grant_id, event_type, amount, reservation_id)
      values (v_grant.id, 'hold', -p_needed, p_reservation_id);
      return v_grant.id;
    end if;
  end loop;
  raise exception '사용 가능한 수업권이 없습니다.';
end;
$$;

comment on function public.hold_entitlement(uuid, uuid, timestamptz, int, uuid) is
  'M2: p_lesson_type_id(선택)로 정규/체험 수업권을 상호 오사용하지 않도록 강제. null이면 기존(R1) 동작 그대로 유형 무관 — 기존 관리자 수동 경로 호환용 기본값일 뿐, 실제 예약 흐름(confirm_lesson_booking)은 항상 값을 넘긴다.';

-- =========================================================================
-- 4. confirm_lesson_booking — hold_entitlement 호출에 lesson_type_id 전달
-- =========================================================================
-- 20261008000000의 최종본을 그대로 가져와 hold_entitlement 호출 한 줄만
-- 바꾼다(본문 나머지는 동일 — idempotency 재확인, booking window/버퍼/가용성
-- 검사, sessions insert, 알림 스케줄링).
create or replace function public.confirm_lesson_booking(
  p_child_id uuid,
  p_subject_enrollment_id uuid,
  p_teacher_id uuid,
  p_lesson_type_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_idempotency_key text,
  p_booking_series_id uuid default null,
  p_series_occurrence_index smallint default null,
  p_admin_override boolean default false
) returns table (reservation_id uuid, session_id uuid)
  language plpgsql security definer set search_path = public as $$
declare
  v_reservation_id uuid;
  v_session_id uuid;
  v_grant_id uuid;
  v_existing record;
begin
  select r.id as rid, s.id as sid into v_existing
  from reservations r join sessions s on s.reservation_id = r.id
  where r.idempotency_key = p_idempotency_key;
  if found then
    return query select v_existing.rid, v_existing.sid;
    return;
  end if;

  if not is_within_booking_window(p_starts_at, p_admin_override) then
    raise exception 'booking_window_violation' using errcode = 'P0001';
  end if;
  if not is_teacher_slot_open(p_teacher_id, p_starts_at, p_ends_at) then
    raise exception 'teacher_slot_not_open' using errcode = 'P0001';
  end if;
  if violates_teacher_buffer(p_teacher_id, p_starts_at, p_ends_at) then
    raise exception 'teacher_buffer_violation' using errcode = 'P0001';
  end if;

  begin
    insert into reservations (
      kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status,
      idempotency_key, booking_series_id, series_occurrence_index
    ) values (
      'lesson', p_subject_enrollment_id, p_teacher_id, p_starts_at, p_ends_at, 'confirmed',
      p_idempotency_key, p_booking_series_id, p_series_occurrence_index
    )
    returning id into v_reservation_id;
  exception when unique_violation then
    select r.id as rid, s.id as sid into v_existing
    from reservations r join sessions s on s.reservation_id = r.id
    where r.idempotency_key = p_idempotency_key;
    if found then
      return query select v_existing.rid, v_existing.sid;
      return;
    end if;
    raise;
  end;

  insert into sessions (
    reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes,
    smart_notes_status
  ) values (
    v_reservation_id, p_subject_enrollment_id, p_teacher_id, p_lesson_type_id,
    extract(epoch from (p_ends_at - p_starts_at))::int / 60,
    'pending'
  )
  returning id into v_session_id;

  -- M2: 체험/정규 수업권 오사용을 DB 레벨에서 막는 실제 강제 지점(요구사항 3) —
  -- 이 예약이 요구하는 lesson_type_id와 일치하는 grant만 hold 가능.
  v_grant_id := hold_entitlement(p_child_id, v_reservation_id, p_starts_at, 1, p_lesson_type_id);

  perform schedule_reservation_notifications(v_reservation_id);

  return query select v_reservation_id, v_session_id;
end;
$$;

-- =========================================================================
-- 5. consultations — 지급 상태 추적 (요구사항 7, 관리자 복구 동선)
-- =========================================================================
alter table consultations add column trial_entitlement_grant_id uuid references entitlement_grants (id);
alter table consultations add column trial_entitlement_grant_status text not null default 'not_applicable'
  check (trial_entitlement_grant_status in ('not_applicable', 'pending', 'granted', 'failed'));
alter table consultations add column trial_entitlement_grant_error text;

comment on column consultations.trial_entitlement_grant_status is
  'M2: not_applicable=outcome이 trial_recommended가 아니거나 아직 시도 안 함, pending=시도 중(현재 구현에서는 동기 처리라 사실상 즉시 granted/failed로 전이), granted=지급 완료, failed=지급 실패(관리자 재처리 대상 — 대개 child_id가 아직 없는 잠재고객 단계).';

-- =========================================================================
-- 6. grant_trial_entitlement_for_consultation — 실제 지급 함수 (요구사항 2·4)
-- =========================================================================
-- 재시도 안전성: (a) source_consultation_id unique index가 중복 grant 자체를
-- 막고, (b) entitlement_ledger_business_event_dedup(기존 R1 unique index)가
-- 같은 business_event_id의 중복 ledger 행을 막는다 — 두 재시도가 동시에 들어와도
-- 최종적으로 grant/ledger 각 1건만 남는다.
create or replace function public.grant_trial_entitlement_for_consultation(
  p_consultation_id uuid
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_child_id uuid;
  v_existing_grant_id uuid;
  v_new_grant_id uuid;
  v_trial_product_id uuid;
  v_expires_at timestamptz;
begin
  select child_id into v_child_id from consultations where id = p_consultation_id for update;
  if not found then
    raise exception '상담 신청을 찾을 수 없습니다: %', p_consultation_id;
  end if;
  if v_child_id is null then
    -- M1 구조상 homepage 신청은 child_id 없이(prospect_contact_id만) 시작할 수
    -- 있다. 정식 학생 계정 연결(M4 범위)이 되기 전에는 지급 대상 자체가 없다 —
    -- 이 예외 메시지가 consultations.trial_entitlement_grant_error에 그대로
    -- 남아 관리자가 원인을 바로 알 수 있게 한다.
    raise exception '연결된 학생 계정이 없어 체험수업권을 지급할 수 없습니다(잠재고객 단계 — 정식 학생 계정 연결 후 재시도 필요).';
  end if;

  -- idempotency: 이미 이 상담으로 지급된 grant가 있으면 그대로 반환한다(재시도 안전).
  select id into v_existing_grant_id from entitlement_grants where source_consultation_id = p_consultation_id;
  if v_existing_grant_id is not null then
    return v_existing_grant_id;
  end if;

  select id into v_trial_product_id from entitlement_products where code = 'trial_lesson_grant';
  if v_trial_product_id is null then
    raise exception '체험수업권 상품(trial_lesson_grant)이 존재하지 않습니다 — 마이그레이션 순서 문제.';
  end if;

  -- 결정 필요(docs 기록): 체험수업권 유효기간은 아직 제품 정책으로 확정되지
  -- 않았다. 상담→체험 전환에 시간이 걸릴 수 있다는 점을 고려해 기술적으로
  -- 90일을 기본값으로 둔다 — 사용자 경험에 영향을 주는 정책 결정이라 임의로
  -- 확정하지 않고 실행 로그에 "결정 필요"로 남긴다.
  v_expires_at := now() + interval '90 days';

  begin
    insert into entitlement_grants (
      child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at,
      is_paid, source_consultation_id
    ) values (
      v_child_id, v_trial_product_id, null, 1, v_expires_at, false, p_consultation_id
    )
    returning id into v_new_grant_id;
  exception when unique_violation then
    -- 동시 재시도 레이스: 다른 트랜잭션이 먼저 커밋했다 — 그 grant를 반환한다.
    select id into v_new_grant_id from entitlement_grants where source_consultation_id = p_consultation_id;
    if v_new_grant_id is not null then
      return v_new_grant_id;
    end if;
    raise;
  end;

  insert into entitlement_ledger (grant_id, event_type, amount, business_event_id)
  values (v_new_grant_id, 'grant', 1, 'trial_grant:' || p_consultation_id::text)
  on conflict do nothing;

  return v_new_grant_id;
end;
$$;

comment on function public.grant_trial_entitlement_for_consultation(uuid) is
  'M2 요구사항 2·4: 상담 1건당 정확히 1개의 60분 전용 체험수업권을 멱등하게 지급. is_paid=false로 생성되므로 기존 refund_entitlement()(is_paid 조건)/transfer_entitlement()(is_paid 아니면 예외)가 이미 이 grant를 환불·이전 대상에서 자동으로 제외한다 — 별도 방지 컬럼 불필요.';

revoke execute on function public.grant_trial_entitlement_for_consultation(uuid) from public, anon, authenticated;
-- service_role은 남겨둔다 — admin_record_consultation_outcome()과 아래
-- admin_retry_trial_entitlement_grant() 양쪽에서 SECURITY DEFINER 컨텍스트로
-- 직접 호출하는 내부 헬퍼 함수다(hold/consume/release와 동일한 설계 원칙).

-- =========================================================================
-- 7. admin_record_consultation_outcome — 지급 연결 (요구사항 2, 핵심 트리거)
-- =========================================================================
-- 20261009000000의 최종본에 "outcome=trial_recommended일 때 지급 시도" 한
-- 블록만 추가한다. 지급 실패가 상담 결과 기록 자체를 막지 않도록(요구사항 7 —
-- graceful degradation, 기존 R6/M1 전역 원칙과 동일) 예외를 잡아
-- trial_entitlement_grant_status='failed'로만 남긴다 — 이 함수가 이미
-- 강제하는 4개 완료 조건(동의/Smart Notes ON/원본 연결/검토요약)과는 완전히
-- 독립적인 관심사다.
create or replace function public.admin_record_consultation_outcome(
  p_consultation_id uuid,
  p_outcome consult_outcome,
  p_notes text,
  p_admin_review_summary text
)
returns consultations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row consultations;
  v_grant_id uuid;
begin
  if not is_admin() then
    raise exception '관리자만 상담 결과를 기록할 수 있습니다.';
  end if;

  select * into v_row from consultations where id = p_consultation_id for update;
  if not found then
    raise exception '상담 신청을 찾을 수 없습니다: %', p_consultation_id;
  end if;

  if v_row.consent_version_id is null or v_row.consent_confirmed_at is null then
    raise exception '동의 확인이 완료되지 않아 상담 결과를 기록할 수 없습니다(consent_confirmed_at 없음).';
  end if;
  if v_row.smart_notes_config_status is distinct from 'applied' then
    raise exception 'Smart Notes 활성화가 확인되지 않아 상담 결과를 기록할 수 없습니다(smart_notes_config_status: %).', v_row.smart_notes_config_status;
  end if;
  if v_row.smart_notes_drive_file_id is null then
    raise exception 'Smart Notes 원본이 아직 이 상담에 자동 연결되지 않아 상담 결과를 기록할 수 없습니다(smart_notes_drive_file_id 없음 — 관리자 재처리 대상).';
  end if;
  if p_admin_review_summary is null or btrim(p_admin_review_summary) = '' then
    raise exception '관리자 검토 요약을 작성해야 상담 결과를 기록할 수 있습니다(공백 불가).';
  end if;

  update consultations set
    status = case when status = 'scheduled' then 'completed' else status end,
    completed_at = coalesce(completed_at, now()),
    outcome = p_outcome,
    outcome_notes = coalesce(p_notes, outcome_notes),
    admin_review_summary = p_admin_review_summary,
    updated_at = now()
  where id = p_consultation_id
  returning * into v_row;

  insert into consultation_status_events (consultation_id, previous_status, new_status, actor_profile_id, reason)
  values (p_consultation_id, v_row.status, v_row.status, auth.uid(), '상담 결과 기록: ' || p_outcome::text);

  -- M2: 체험 진행 권장 시점의 지급 연결. 실패해도 위 outcome 기록은 이미
  -- 커밋 대상이라 되돌리지 않는다(같은 트랜잭션이지만 예외를 여기서 잡아
  -- 전체 롤백을 막는다) — 관리자 화면이 실패 상태를 보고 재처리한다.
  if p_outcome = 'trial_recommended' then
    update consultations set trial_entitlement_grant_status = 'pending' where id = p_consultation_id;
    begin
      v_grant_id := grant_trial_entitlement_for_consultation(p_consultation_id);
      update consultations set
        trial_entitlement_grant_id = v_grant_id,
        trial_entitlement_grant_status = 'granted',
        trial_entitlement_grant_error = null
      where id = p_consultation_id
      returning * into v_row;
    exception when others then
      update consultations set
        trial_entitlement_grant_status = 'failed',
        trial_entitlement_grant_error = sqlerrm
      where id = p_consultation_id
      returning * into v_row;
    end;
  end if;

  return v_row;
end;
$$;

-- =========================================================================
-- 8. admin_retry_trial_entitlement_grant — 관리자 복구 동선 (요구사항 7)
-- =========================================================================
create or replace function public.admin_retry_trial_entitlement_grant(
  p_consultation_id uuid
)
returns consultations
language plpgsql security definer set search_path = public as $$
declare
  v_row consultations;
  v_grant_id uuid;
begin
  if not is_admin() then
    raise exception '관리자만 체험수업권 지급을 재처리할 수 있습니다.';
  end if;

  select * into v_row from consultations where id = p_consultation_id for update;
  if not found then
    raise exception '상담 신청을 찾을 수 없습니다: %', p_consultation_id;
  end if;
  if v_row.outcome is distinct from 'trial_recommended' then
    raise exception '상담 결과가 "체험 진행 권장"이 아니면 체험수업권을 재처리할 수 없습니다(현재: %).', v_row.outcome;
  end if;
  if v_row.trial_entitlement_grant_status = 'granted' then
    -- 이미 지급됨 — 그대로 반환(멱등, 에러 아님).
    return v_row;
  end if;

  update consultations set trial_entitlement_grant_status = 'pending' where id = p_consultation_id;
  begin
    v_grant_id := grant_trial_entitlement_for_consultation(p_consultation_id);
    update consultations set
      trial_entitlement_grant_id = v_grant_id,
      trial_entitlement_grant_status = 'granted',
      trial_entitlement_grant_error = null
    where id = p_consultation_id
    returning * into v_row;
  exception when others then
    update consultations set
      trial_entitlement_grant_status = 'failed',
      trial_entitlement_grant_error = sqlerrm
    where id = p_consultation_id
    returning * into v_row;
    return v_row;
  end;

  return v_row;
end;
$$;

grant execute on function public.admin_retry_trial_entitlement_grant(uuid) to authenticated;
revoke execute on function public.admin_retry_trial_entitlement_grant(uuid) from anon;

-- =========================================================================
-- 9. 취소 시 정합성 (요구사항 4)
-- =========================================================================
-- 관리자가 상담 결과를 잘못 기록했거나(오기) 체험을 더 이상 진행하지 않기로
-- 확정한 경우, 아직 소진(hold/consume)되지 않은 체험수업권을 회수해야 한다.
-- 새 함수를 만들지 않고 기존 R4 expire_entitlement(p_grant_id, p_business_event_id)를
-- 그대로 재사용한다 — 이미 "잔량을 0으로 만드는" 범용 함수이고, entitlement_ledger
-- INSERT-only 패턴과 idempotency(business_event_id unique)도 그대로 적용된다.
-- 앱 레이어(관리자 서버 액션)가 grant_id를 이 함수에 넘기면 된다 — 신규 SQL
-- 불필요.
comment on function public.expire_entitlement(uuid, text) is
  'R4/M2 공용: 미소진 잔량을 만료 처리. M2에서 체험수업권 회수(상담 결과 정정 등)에도 그대로 재사용한다 — 이미 hold/consume 이력이 있으면 남은 잔량만 회수되고 과거 이력은 그대로 남는다(감사 보존).';

-- =========================================================================
-- 10. 권한
-- =========================================================================
-- entitlement_grant_details 뷰는 기존 entitlement_grants/entitlement_ledger RLS를
-- 그대로 상속하지 않는(view는 자체 권한 경계) — 이 저장소의 다른 조회 전용 뷰
-- (purchase_receipts 등)와 동일하게 관리자 서버 액션이 service_role로만 이
-- 뷰를 조회한다는 전제다. 보호자/학생 화면은 서버 액션이 스코프를 좁혀 반환한다.
