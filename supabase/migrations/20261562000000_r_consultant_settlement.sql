-- Phase B(5) — 컨설턴트 Settlement. 사용자 확정 정책(2026-09-23):
--  * 상담 건수·수업 수 기준 자동 계산을 하지 않는다 — 관리자가 컨설턴트별
--    대상 기간과 금액을 직접 입력·확정한다(payout_items/payout_batches의
--    교사 자동 산정 로직과 무관, 별도 테이블).
--  * 수취 계좌는 이번 슬라이스에 포함한다 — teacher_payout_accounts와
--    같은 패턴(전체 계좌번호는 서버만 다루고 always masked로 응답, 변경
--    이력은 끝 4자리만 남김).
--  * 금액 변경·지급 상태 변경은 전부 이력을 남긴다.
--  * 확정 전(draft)은 관리자만 보고, 컨설턴트에게는 confirmed부터 노출한다
--    ("확정 전후에 컨설턴트에게 보이는 상태를 구분").
--  * 실제 송금·자동 지급 로직은 이 마이그레이션 범위 밖 — 상태값 기록만.

-- =========================================================================
-- 1. 수취 계좌 — teacher_payout_accounts와 동일 패턴
-- =========================================================================
create table consultant_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null unique references profiles (id) on delete cascade,
  account_holder_name text not null,
  bank_name text not null,
  account_number text not null,
  account_number_last4 text not null,
  currency text not null default 'KRW',
  country text,
  swift_or_routing text,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  constraint consultant_payout_accounts_last4_len check (char_length(account_number_last4) between 1 and 4)
);
create index on consultant_payout_accounts (updated_at desc);

comment on table consultant_payout_accounts is
  '2026-09-23(Phase B-5) — 컨설턴트 본인이 등록·수정하는 수취 계좌. 본인과
  관리자(정산권한)만 조회, 앱은 전체 계좌번호를 절대 응답에 넣지 않는다
  (teacher_payout_accounts와 동일 원칙). 쓰기는 서버 액션(service_role)만.';

alter table consultant_payout_accounts enable row level security;
create policy "본인·관리자 조회" on consultant_payout_accounts for select
  using (consultant_id = auth.uid() or is_admin() or current_user_has_capability('정산권한'));

create table consultant_payout_account_events (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references profiles (id) on delete cascade,
  action text not null check (action in ('created', 'updated')),
  actor_id uuid references profiles (id),
  changed_fields text[] not null default '{}',
  previous_last4 text,
  new_last4 text,
  created_at timestamptz not null default now()
);
create index on consultant_payout_account_events (consultant_id, created_at desc);

create or replace function public.reject_consultant_payout_account_event_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'consultant_payout_account_events는 INSERT-only입니다.';
end;
$$;
create trigger consultant_payout_account_events_no_update
  before update or delete on consultant_payout_account_events
  for each row execute function public.reject_consultant_payout_account_event_mutation();
revoke execute on function public.reject_consultant_payout_account_event_mutation() from public, anon, authenticated, service_role;

alter table consultant_payout_account_events enable row level security;
create policy "본인·관리자 조회" on consultant_payout_account_events for select
  using (consultant_id = auth.uid() or is_admin() or current_user_has_capability('정산권한'));

-- =========================================================================
-- 2. 지급 기간·금액 — 관리자 수기 입력·확정. 자동 산정 없음.
-- =========================================================================
create type consultant_payout_status as enum ('draft', 'confirmed', 'paid');

create table consultant_payout_periods (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references profiles (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null default 'KRW',
  status consultant_payout_status not null default 'draft',
  note text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  confirmed_by uuid references profiles (id),
  confirmed_at timestamptz,
  paid_by uuid references profiles (id),
  paid_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint consultant_payout_periods_range_valid check (period_end >= period_start)
);
create index on consultant_payout_periods (consultant_id, period_start desc);

comment on table consultant_payout_periods is
  '2026-09-23(Phase B-5) — 컨설턴트 정산 기간·금액. 상담 건수·수업 수로 자동
  계산하지 않는다 — 관리자가 기간·금액을 직접 입력·확정한다. draft는 관리자만
  보이고(작성 중), confirmed부터 컨설턴트에게 "지급 예정"으로 노출, paid는
  "지급 완료"로 노출한다. 실제 송금은 이 값을 아직 읽지 않는다(상태 기록만).';

alter table consultant_payout_periods enable row level security;
create policy "본인(확정 이상)·관리자 조회" on consultant_payout_periods for select
  using (
    is_admin()
    or current_user_has_capability('정산권한')
    or (consultant_id = auth.uid() and status <> 'draft')
  );
-- 쓰기는 서버 액션(service_role, 관리자 전용)만 — 금액·상태 변경마다 이력
-- 테이블에 함께 기록해야 하므로 클라이언트 직접 쓰기 정책은 두지 않는다.

-- =========================================================================
-- 3. 지급 기간 변경 이력(INSERT-only) — 금액·상태 변경 전부 기록
-- =========================================================================
create table consultant_payout_period_events (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references consultant_payout_periods (id) on delete cascade,
  consultant_id uuid not null references profiles (id),
  actor_id uuid references profiles (id),
  event_type text not null check (event_type in ('created', 'amount_changed', 'status_changed', 'note_changed')),
  previous_value text,
  new_value text,
  created_at timestamptz not null default now()
);
create index on consultant_payout_period_events (period_id, created_at desc);

comment on table consultant_payout_period_events is
  '2026-09-23(Phase B-5) — 정산 기간 금액·상태 변경 이력(INSERT-only, 사용자
  지시: "금액 변경과 지급 상태 변경은 이력을 남기고").';

create or replace function public.reject_consultant_payout_period_event_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'consultant_payout_period_events는 INSERT-only입니다.';
end;
$$;
create trigger consultant_payout_period_events_no_update
  before update or delete on consultant_payout_period_events
  for each row execute function public.reject_consultant_payout_period_event_mutation();
revoke execute on function public.reject_consultant_payout_period_event_mutation() from public, anon, authenticated, service_role;

alter table consultant_payout_period_events enable row level security;
create policy "본인(확정 이상)·관리자 조회" on consultant_payout_period_events for select
  using (
    is_admin()
    or current_user_has_capability('정산권한')
    or (
      consultant_id = auth.uid()
      and exists (select 1 from consultant_payout_periods p where p.id = period_id and p.status <> 'draft')
    )
  );
