-- Mercury 웹훅 이벤트 저장소(멱등) + 거래 상세(대시보드 링크·예상 도착일·실패 시각). 가산 마이그레이션, 돈을 움직이는 경로 없음.
alter table public.payout_attempts
  add column if not exists mercury_dashboard_url text,
  add column if not exists mercury_estimated_delivery_date date,
  add column if not exists mercury_failed_at timestamptz;

alter table public.payout_attempts drop constraint if exists payout_attempts_mercury_dashboard_url_check;
alter table public.payout_attempts add constraint payout_attempts_mercury_dashboard_url_check
  check (mercury_dashboard_url is null or mercury_dashboard_url ~ '^https://([a-z0-9-]+\.)*mercury\.com(/|$)');

create table if not exists public.payout_webhook_events (
  event_id text primary key,                  -- Mercury 이벤트 id (at-least-once 배달 → 중복 제거 키)
  provider text not null default 'mercury',
  resource_type text,
  operation_type text,
  resource_id text,
  payload_sha256 text not null,               -- 원문 해시만 저장(서명·비밀 없음)
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text,                               -- applied / noop / ignored_type / ignored_unknown / ignored_no_status / flagged_mismatch / error
  attempt_id uuid references public.payout_attempts (id)
);
alter table public.payout_webhook_events enable row level security;
revoke all on public.payout_webhook_events from anon, authenticated;

create or replace function public.record_payout_attempt_mercury_details(
  p_attempt uuid, p_dashboard_url text default null, p_estimated_delivery date default null, p_failed_at timestamptz default null
) returns void language sql as $$
  update payout_attempts
    set mercury_dashboard_url = coalesce(p_dashboard_url, mercury_dashboard_url),
        mercury_estimated_delivery_date = coalesce(p_estimated_delivery, mercury_estimated_delivery_date),
        mercury_failed_at = coalesce(p_failed_at, mercury_failed_at),
        updated_at = now()
    where id = p_attempt;
$$;
revoke execute on function public.record_payout_attempt_mercury_details(uuid, text, date, timestamptz) from public, anon, authenticated;
