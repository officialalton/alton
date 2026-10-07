-- Mercury 지급 통합 1/3 — 시도(attempt) 모델, 수취인 링크, 한국 은행 휴일, 회계 매핑(2026-10-07).
-- additive 전용. 기존 payout_batches / consultant_payout_periods / provider_transaction_id 기록은 건드리지 않는다.
-- 실제 송금·외부 호출 없음: 이 마이그레이션은 테이블과 달력만 만든다(전이 함수는 301, 트리거·뷰는 302).

-- ───────────────────────────── 한국 은행 휴일(달력) ─────────────────────────────
create table if not exists public.payout_kr_bank_holidays (
  holiday_date date primary key,
  name text not null
);
create table if not exists public.payout_kr_calendar_years (
  calendar_year int primary key,
  verified_note text not null
);
comment on table public.payout_kr_calendar_years is
  '한국 은행 휴일표가 검증된 연도. 이 표에 없는 연도의 날짜는 KRW 송금 일정에 unverified_calendar 플래그를 단다(월력요항 확인 후 연도 추가).';

insert into public.payout_kr_bank_holidays (holiday_date, name) values
  ('2026-01-01', 'New Year''s Day'),
  ('2026-02-16', 'Seollal holiday'),
  ('2026-02-17', 'Seollal'),
  ('2026-02-18', 'Seollal holiday'),
  ('2026-03-02', 'Independence Movement Day (substitute)'),
  ('2026-05-05', 'Children''s Day'),
  ('2026-05-25', 'Buddha''s Birthday (substitute)'),
  ('2026-06-03', 'Local election day'),
  ('2026-08-17', 'Liberation Day (substitute)'),
  ('2026-09-24', 'Chuseok holiday'),
  ('2026-09-25', 'Chuseok'),
  ('2026-09-26', 'Chuseok holiday'),
  ('2026-10-05', 'National Foundation Day (substitute)'),
  ('2026-10-09', 'Hangul Day'),
  ('2026-12-25', 'Christmas Day'),
  ('2026-12-31', 'Year-end bank closure')
on conflict (holiday_date) do nothing;
insert into public.payout_kr_calendar_years (calendar_year, verified_note) values
  (2026, '2026-10-07 초안 입력 — 공식 월력요항·은행 휴무와 대조 전(운영 체크리스트 항목)')
on conflict (calendar_year) do nothing;

alter table public.payout_settings
  add column if not exists transfer_lead_business_days_krw integer not null default 5
    check (transfer_lead_business_days_krw between 0 and 15);
comment on column public.payout_settings.transfer_lead_business_days_krw is
  'KRW 국제송금 요청일 = 도착 목표일 − N(한·미 공통 영업일). 첫 지급 실측 뒤 재조정.';

create or replace function public.payout_is_joint_business_day(p_date date)
returns boolean language sql stable as $$
  select public.payout_is_business_day(p_date)
    and not exists (select 1 from public.payout_kr_bank_holidays h where h.holiday_date = p_date)
$$;

create or replace function public.payout_joint_business_day_on_or_before(p_date date)
returns date language plpgsql stable as $$
declare d date := p_date; i int := 0;
begin
  while not public.payout_is_joint_business_day(d) and i < 20 loop
    d := d - 1; i := i + 1;
  end loop;
  return d;
end;
$$;

create or replace function public.payout_krw_transfer_date(p_deadline date, p_lead integer default null)
returns date language plpgsql stable as $$
declare
  d date := public.payout_joint_business_day_on_or_before(p_deadline);
  n int := coalesce(p_lead, (select transfer_lead_business_days_krw from public.payout_settings where id), 5);
  i int := 0;
begin
  while i < n loop
    d := d - 1;
    if public.payout_is_joint_business_day(d) then i := i + 1; end if;
  end loop;
  return d;
end;
$$;

create or replace function public.payout_kr_calendar_verified(p_date date)
returns boolean language sql stable as $$
  select exists (select 1 from public.payout_kr_calendar_years y where y.calendar_year = extract(year from p_date)::int)
$$;

-- ───────────────────────────── 수취인 링크 ─────────────────────────────
create table if not exists public.payout_recipient_links (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('wise', 'mercury', 'manual')),
  recipient_kind text not null check (recipient_kind in ('teacher', 'consultant')),
  profile_id uuid not null references public.profiles (id),
  provider_recipient_id text,            -- Mercury recipient id
  provider_invite_id text,
  contract_id uuid,                      -- 서명 계약 연결(선택, 다형 참조)
  work_country text,
  payout_country text,
  payout_currency text check (payout_currency in ('USD', 'KRW')),
  bank_name text,                        -- 표시용. 전체 번호는 저장하지 않는다
  account_last4 text check (account_last4 is null or account_last4 ~ '^[0-9A-Za-z]{1,4}$'),
  status text not null default 'not_invited'
    check (status in ('not_invited', 'invited', 'registered', 'verified', 'reverify_required', 'disabled')),
  last_changed_at timestamptz not null default now(),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, recipient_kind, profile_id)
);
create unique index if not exists payout_recipient_links_provider_recipient_uq
  on public.payout_recipient_links (provider, provider_recipient_id) where provider_recipient_id is not null;
comment on table public.payout_recipient_links is
  '수취인은 Mercury에 저장. 여기에는 연결 ID·국가·통화·은행명·끝4자리·검증 상태만(전체 계좌번호는 기존 암호화 테이블에만).';

-- ───────────────────────────── 지급 시도 ─────────────────────────────
create table if not exists public.payout_attempts (
  id uuid primary key default gen_random_uuid(),
  settlement_batch_id uuid references public.payout_batches (id),
  settlement_consultant_period_id uuid references public.consultant_payout_periods (id),
  recipient_profile_id uuid not null references public.profiles (id),
  recipient_kind text not null check (recipient_kind in ('teacher', 'consultant')),
  recipient_link_id uuid references public.payout_recipient_links (id),
  contract_id uuid,
  period_start date not null,
  period_end date not null,

  provider text not null check (provider in ('wise', 'mercury', 'manual')),
  rail text not null check (rail in ('ach', 'international_wire', 'manual')),
  manual_execution boolean not null default false,   -- KRW 등 API 불가 경로: 관리자가 Mercury 화면에서 직접 송금
  kind text not null default 'normal' check (kind in ('normal', 'resend', 'top_up')),
  original_attempt_id uuid references public.payout_attempts (id),
  attempt_no int not null default 1,

  -- 계약 원본과 실제 요청
  contractual_amount_minor bigint not null check (contractual_amount_minor > 0),
  contractual_currency text not null check (contractual_currency in ('USD', 'KRW')),
  requested_amount_minor bigint not null check (requested_amount_minor > 0),
  requested_currency text not null check (requested_currency in ('USD', 'KRW')),

  -- 실제 USD 비용(확정 전 null). KRW 금액과 직접 비교하지 않는다
  actual_usd_principal_minor bigint check (actual_usd_principal_minor is null or actual_usd_principal_minor >= 0),
  actual_usd_fee_minor bigint check (actual_usd_fee_minor is null or actual_usd_fee_minor >= 0),
  actual_usd_total_debit_minor bigint check (actual_usd_total_debit_minor is null or actual_usd_total_debit_minor >= 0),
  quoted_fx_rate numeric(18, 8),
  final_fx_rate numeric(18, 8),
  fx_locked_at timestamptz,
  received_amount_minor bigint check (received_amount_minor is null or received_amount_minor >= 0),
  received_currency text check (received_currency in ('USD', 'KRW')),

  -- 일정: 기한과 송금 예정일은 별개
  payment_deadline date not null,
  scheduled_transfer_date date not null,
  check (scheduled_transfer_date <= payment_deadline),

  -- 승인
  status text not null default 'queued'
    check (status in ('queued', 'awaiting_mercury_approval', 'processing', 'sent', 'receipt_confirmed',
                      'failed', 'returned', 'cancelled', 'needs_review')),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  approval_invalidated_at timestamptz,
  approval_invalidated_reason text,

  -- 외부 식별자
  idempotency_key uuid not null default gen_random_uuid(),
  payout_request_id text,
  provider_transaction_id text,
  request_uncertain boolean not null default false,
  tracking_url text,
  receipt_url text,

  -- 시각·결과
  requested_at timestamptz,
  sent_at timestamptz,
  received_confirmed_at timestamptz,
  received_evidence text,
  received_confirmed_by uuid references public.profiles (id),
  failed_at timestamptz,
  failure_reason text,
  returned_at timestamptz,
  return_reason text,
  returned_usd_minor bigint check (returned_usd_minor is null or returned_usd_minor >= 0),
  return_transaction_id text,
  needs_review_reasons text[] not null default '{}',

  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check ((settlement_batch_id is not null)::int + (settlement_consultant_period_id is not null)::int = 1),
  check ((recipient_kind = 'teacher') = (settlement_batch_id is not null)),
  check (kind = 'normal' or original_attempt_id is not null),
  check (actual_usd_total_debit_minor is null
         or (actual_usd_principal_minor is not null and actual_usd_fee_minor is not null
             and actual_usd_total_debit_minor = actual_usd_principal_minor + actual_usd_fee_minor)),
  check (status not in ('sent', 'receipt_confirmed') or provider = 'manual' or provider_transaction_id is not null),
  check (status <> 'receipt_confirmed' or (received_confirmed_at is not null and coalesce(length(btrim(received_evidence)), 0) > 0))
);

-- 정산당 활성 normal 시도는 1건(재송금은 kind='resend'로 원 시도를 가리킨다)
create unique index if not exists payout_attempts_one_active_normal_batch
  on public.payout_attempts (settlement_batch_id)
  where kind = 'normal' and settlement_batch_id is not null and status not in ('failed', 'returned', 'cancelled');
create unique index if not exists payout_attempts_one_active_normal_period
  on public.payout_attempts (settlement_consultant_period_id)
  where kind = 'normal' and settlement_consultant_period_id is not null and status not in ('failed', 'returned', 'cancelled');
create unique index if not exists payout_attempts_idempotency_key_uq on public.payout_attempts (idempotency_key);
create unique index if not exists payout_attempts_provider_tx_uq
  on public.payout_attempts (provider, provider_transaction_id) where provider_transaction_id is not null;
create unique index if not exists payout_attempts_provider_request_uq
  on public.payout_attempts (provider, payout_request_id) where payout_request_id is not null;
create index if not exists payout_attempts_status_idx on public.payout_attempts (status, scheduled_transfer_date);
create index if not exists payout_attempts_recipient_idx on public.payout_attempts (recipient_profile_id);

comment on table public.payout_attempts is
  '정산 보조원장: 정산 1건당 여러 시도(실패·반환·재송금·보충). sent는 지급 완료가 아니며 receipt_confirmed는 증빙이 있어야 한다.';

create table if not exists public.payout_attempt_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.payout_attempts (id),
  event_type text not null,
  from_status text,
  to_status text,
  actor_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists payout_attempt_events_attempt_idx on public.payout_attempt_events (attempt_id, created_at);

create or replace function public.reject_payout_attempt_event_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'payout_attempt_events는 INSERT 전용입니다(수정·삭제 불가).';
end;
$$;
drop trigger if exists payout_attempt_events_immutable on public.payout_attempt_events;
create trigger payout_attempt_events_immutable
  before update or delete on public.payout_attempt_events
  for each row execute function public.reject_payout_attempt_event_mutation();
revoke execute on function public.reject_payout_attempt_event_mutation() from public, anon, authenticated, service_role;

-- ───────────────────────────── 회계 매핑·원천 정책 ─────────────────────────────
create table if not exists public.accounting_account_map (
  key text primary key,
  label text not null,
  books_account_name text,                 -- 회계사가 정하는 Books 계정과목명(미정이면 null)
  account_type text not null check (account_type in ('expense', 'liability', 'revenue', 'asset', 'equity', 'other')),
  note text,
  reviewed_by_accountant boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.accounting_account_map (key, label, account_type, note) values
  ('teacher_compensation', 'Teacher compensation', 'expense', null),
  ('consultant_compensation', 'Consultant compensation', 'expense', null),
  ('transfer_fx_fees', 'Transfer and FX fees', 'expense', 'Company-borne per agreements'),
  ('payment_processing_fees', 'Payment processing fees', 'expense', 'Stripe fees via the Books Stripe connection'),
  ('customer_payments', 'Customer payments', 'asset', 'Stripe via the Books connection only'),
  ('customer_refunds', 'Customer refunds', 'other', 'Stripe via the Books connection only'),
  ('accrued_compensation', 'Accrued (unpaid) compensation', 'liability', 'Approved settlement not yet transferred'),
  ('deferred_revenue', 'Deferred revenue (lesson entitlements)', 'liability', null),
  ('revenue_recognized', 'Revenue recognized as lessons delivered', 'revenue', null),
  ('fx_gain_loss', 'FX gain/loss', 'other', null),
  ('intercompany_transfers', 'Own-account / intercompany transfers', 'other', null)
on conflict (key) do nothing;

create table if not exists public.accounting_feed_sources (
  source text primary key,
  feed_method text not null,
  import_via_alton_file boolean not null default false check (import_via_alton_file = false),
  note text
);
insert into public.accounting_feed_sources (source, feed_method, note) values
  ('stripe', 'books_official_connection', 'Customer payments/refunds/fees enter Books only through the Stripe connection; ALTON never exports them'),
  ('mercury_bank', 'books_bank_feed', 'Mercury bank transactions enter Books automatically; do not re-import by CSV'),
  ('alton_subledger', 'reference_only', 'ALTON reconciliation file is for matching, never for importing')
on conflict (source) do nothing;

-- ───────────────────────────── RLS: 관리자·capability만 읽기, 쓰기는 service_role ─────────────────────────────
alter table public.payout_kr_bank_holidays enable row level security;
alter table public.payout_kr_calendar_years enable row level security;
alter table public.payout_recipient_links enable row level security;
alter table public.payout_attempts enable row level security;
alter table public.payout_attempt_events enable row level security;
alter table public.accounting_account_map enable row level security;
alter table public.accounting_feed_sources enable row level security;

create or replace function public.payout_staff_can_view()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin' and admin_tier = 'master')
    or exists (select 1 from supervisor_capabilities
               where profile_id = auth.uid()
                 and capability in ('정산권한', 'payout_settlement_edit', 'payout_settlement_approve',
                                    'payout_request_mercury', 'payout_approve_mercury', 'accounting_reconcile'))
  )
$$;
revoke execute on function public.payout_staff_can_view() from public, anon;

create policy payout_attempts_staff_read on public.payout_attempts for select using (public.payout_staff_can_view());
create policy payout_attempt_events_staff_read on public.payout_attempt_events for select using (public.payout_staff_can_view());
create policy payout_recipient_links_staff_read on public.payout_recipient_links for select using (public.payout_staff_can_view());
create policy accounting_account_map_staff_read on public.accounting_account_map for select using (public.payout_staff_can_view());
create policy accounting_feed_sources_staff_read on public.accounting_feed_sources for select using (public.payout_staff_can_view());
create policy payout_kr_bank_holidays_staff_read on public.payout_kr_bank_holidays for select using (public.payout_staff_can_view());
create policy payout_kr_calendar_years_staff_read on public.payout_kr_calendar_years for select using (public.payout_staff_can_view());
