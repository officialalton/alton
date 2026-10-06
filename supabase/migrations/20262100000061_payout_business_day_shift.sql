-- 지급일 보정(2026-10-06 오너 위임 확정): 명목 5일·20일이 주말 또는 미국 연방 은행 휴일이면 직전 영업일에 지급한다.
-- 휴일 표는 lib/payout/us-bank-holidays.ts와 같은 값(2026–2030)이며 동기화 테스트가 있다. 범위 밖 연도는 주말만 보정한다.
-- additive: 함수 재정의 + 신규 표. 이미 저장된 scheduled_payout_date는 건드리지 않는다.

create table if not exists public.payout_bank_holidays (
  holiday_date date primary key
);
alter table public.payout_bank_holidays enable row level security;
insert into public.payout_bank_holidays (holiday_date) values
  ('2026-01-01'),
  ('2026-01-19'),
  ('2026-02-16'),
  ('2026-05-25'),
  ('2026-06-19'),
  ('2026-09-07'),
  ('2026-10-12'),
  ('2026-11-11'),
  ('2026-11-26'),
  ('2026-12-25'),
  ('2027-01-01'),
  ('2027-01-18'),
  ('2027-02-15'),
  ('2027-05-31'),
  ('2027-07-05'),
  ('2027-09-06'),
  ('2027-10-11'),
  ('2027-11-11'),
  ('2027-11-25'),
  ('2028-01-17'),
  ('2028-02-21'),
  ('2028-05-29'),
  ('2028-06-19'),
  ('2028-07-04'),
  ('2028-09-04'),
  ('2028-10-09'),
  ('2028-11-23'),
  ('2028-12-25'),
  ('2029-01-01'),
  ('2029-01-15'),
  ('2029-02-19'),
  ('2029-05-28'),
  ('2029-06-19'),
  ('2029-07-04'),
  ('2029-09-03'),
  ('2029-10-08'),
  ('2029-11-12'),
  ('2029-11-22'),
  ('2029-12-25'),
  ('2030-01-01'),
  ('2030-01-21'),
  ('2030-02-18'),
  ('2030-05-27'),
  ('2030-06-19'),
  ('2030-07-04'),
  ('2030-09-02'),
  ('2030-10-14'),
  ('2030-11-11'),
  ('2030-11-28'),
  ('2030-12-25')
on conflict do nothing;

create or replace function public.payout_business_day_on_or_before(p_date date)
returns date language sql stable as $$
  select max(d::date)
  from generate_series(p_date - 10, p_date, interval '1 day') d
  where extract(isodow from d) < 6
    and not exists (select 1 from public.payout_bank_holidays h where h.holiday_date = d::date);
$$;

create or replace function public.payout_nominal_date(p_period_end date)
returns date language sql stable as $$
  select public.payout_business_day_on_or_before(
    case
      when extract(day from p_period_end) <= 15 then (date_trunc('month', p_period_end)::date + 19)
      else (date_trunc('month', p_period_end)::date + interval '1 month' + interval '4 days')::date
    end);
$$;

-- 다음 지급 슬롯: 보정된 지급일의 당일 08:00(LA) 이전이면 당일, 이후면 다음 슬롯.
create or replace function public.next_scheduled_payout_date(p_now timestamptz default now())
returns date language sql stable as $$
  with la as (
    select (p_now at time zone 'America/Los_Angeles') as t
  ), slots as (
    select public.payout_business_day_on_or_before(m.d + o.o) as d
    from la,
         lateral (select (date_trunc('month', la.t)::date + (x || ' month')::interval)::date as d from generate_series(0, 1) x) m,
         (values (4), (19)) o(o)
  )
  select min(d) from slots, la where (d + interval '8 hours') > la.t;
$$;

create or replace function public.scheduled_payout_date_for_batch(p_period_end date, p_now timestamptz default now())
returns date language sql stable as $$
  select greatest(public.payout_nominal_date(p_period_end), public.next_scheduled_payout_date(p_now));
$$;

comment on function public.payout_nominal_date is '기간 종료일 기준 지급일: 명목 5일·20일을 직전 영업일(주말·미국 연방 은행 휴일 제외)로 보정.';
