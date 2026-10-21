-- AI 에세이 채점 비용 원장 + 월 예산 원자적 예약 (2026-10-21, 추가형)
--  · 문제: mock_exam_essay_scores.cost_usd 는 "응답(행)별 누적"이라 월 귀속을 알 수 없다(updated_at 으로 배분하면 전월 누적이 이번 달로 이동).
--  · 해법(가장 단순한 안): 호출 실행마다 비용 이벤트 1행을 발생 시각과 함께 기록하는 별도 원장. 월/일 지출은 원장의 occurred_at 으로만 집계한다.
--    행 cost_usd(누적)는 그대로 둔다 — 응답별 누적 표시용. 원장은 추가만 하고 완료된 달의 이벤트는 고치지 않는다.
--  · 예약: 호출 전에 최악 비용(4호출)을 'reserved' 행으로 선기록(advisory lock 으로 직렬화) → 끝나면 실비로 'settled' 정산, 호출이 없으면 0 으로 정산(해제).
--    예약 만료는 호출 시작 여부로 구분한다(2026-10-21 오너 결정):
--      a) 호출을 시작하지 않은 예약(call_started_at 없음) — 30분 뒤 월 합계에서 제외(안전한 해제). 호출 시작은 start_essay_ai_call() 이 같은 advisory lock 안에서 표시하며,
--         이미 만료된 예약에는 표시가 거절되므로(false) 만료로 해제된 예산 위에서 모델이 호출되는 일이 없다.
--      b) 호출이 시작됐는데 정산이 없는 예약(call_started_at 있음) — 시간이 지나도 월 합계에 계속 포함('unsettled', 보수적). 관리자 확인 대상(essay_ai_unsettled 뷰, essay_ai_ledger_status()).
--      c) 실비가 확인된(settled) 호출 — 예약 만료와 무관하게 발생 월에 영구 반영. 늦은 정산도 reserved→settled 로 반영, 같은 예약의 중복 정산은 무시.
--  · 기존 행(비용이 이미 있는 행)은 보존: 이벤트가 없는 행의 cost_usd 는 뷰에서 updated_at 시점의 'legacy' 비용으로 간주. 일괄 backfill 은 docs/ap/essay-ai-cost-events-backfill.sql (작성만, 미실행).
-- 재실행 안전: if not exists / create or replace / drop policy if exists. 되돌리기: drop function/view/table (추가형).

create table if not exists public.essay_ai_cost_events (
  id uuid primary key default gen_random_uuid(),
  essay_score_id uuid references public.mock_exam_essay_scores (id) on delete set null,
  student_id uuid,
  state text not null check (state in ('reserved', 'settled', 'legacy')),
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10, 5) not null default 0 check (cost_usd >= 0),
  occurred_at timestamptz not null default now(), -- 월·일 귀속 기준(실행 시작 시각, 정산해도 바뀌지 않는다)
  created_at timestamptz not null default now(),
  call_started_at timestamptz -- 모델 호출 시작 직전 표시(reserved 행만 의미). 있으면 정산이 없어도 만료로 해제하지 않는다
);
create index if not exists essay_ai_cost_events_occurred_idx on public.essay_ai_cost_events (occurred_at);
create index if not exists essay_ai_cost_events_score_idx on public.essay_ai_cost_events (essay_score_id);

alter table public.essay_ai_cost_events enable row level security;
drop policy if exists essay_ai_cost_events_admin_read on public.essay_ai_cost_events;
create policy essay_ai_cost_events_admin_read on public.essay_ai_cost_events for select to authenticated using (public.is_admin());
-- insert/update/delete 정책 없음 → service_role 만 쓴다.

-- 확정 비용(settled·legacy) + 이벤트가 없는 기존 행의 누적 비용(legacy 간주, updated_at 시점).
create or replace view public.essay_ai_cost_effective with (security_invoker = true) as
  select essay_score_id, model, input_tokens, output_tokens, cost_usd, occurred_at
    from public.essay_ai_cost_events where state in ('settled', 'legacy')
  union all
  select s.id, s.model, s.input_tokens, s.output_tokens, s.cost_usd, s.updated_at
    from public.mock_exam_essay_scores s
   where s.cost_usd > 0 and not exists (select 1 from public.essay_ai_cost_events e where e.essay_score_id = s.id and e.state in ('settled', 'legacy'));

-- 이번 달(UTC) 지출 = 확정 비용(settled·legacy) + 예약(호출 시작 표시가 있거나 아직 30분 이내인 것). 호출자가 UTC 월을 고르도록 기준 시각을 받는다.
-- 정산 없이 30분이 지난 예약은 '호출을 시작하지 않은 것'만 제외한다 — 시작한 것은 unsettled 로 계속 포함.
create or replace function public.essay_ai_month_spend(p_now timestamptz) returns numeric
language sql stable as $$
  with b as (
    select (date_trunc('month', p_now at time zone 'utc') at time zone 'utc') as s,
           ((date_trunc('month', p_now at time zone 'utc') + interval '1 month') at time zone 'utc') as e
  )
  select coalesce((select sum(c.cost_usd) from public.essay_ai_cost_effective c, b where c.occurred_at >= b.s and c.occurred_at < b.e), 0)
       + coalesce((select sum(r.cost_usd) from public.essay_ai_cost_events r, b
                    where r.state = 'reserved' and r.occurred_at >= b.s and r.occurred_at < b.e
                      and (r.call_started_at is not null or r.created_at > now() - interval '30 minutes')), 0);
$$;

-- 원자적 예약: 월 지출 + p_amount 가 예산을 넘으면 null, 아니면 reserved 행을 만들고 id 반환. 전역 advisory lock 으로 동시 요청을 직렬화한다.
create or replace function public.reserve_essay_ai_budget(p_score_id uuid, p_student_id uuid, p_amount numeric, p_budget numeric, p_now timestamptz)
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('essay_ai_budget'));
  if public.essay_ai_month_spend(p_now) + p_amount > p_budget then return null; end if;
  insert into public.essay_ai_cost_events (essay_score_id, student_id, state, cost_usd, occurred_at) values (p_score_id, p_student_id, 'reserved', p_amount, p_now) returning id into v_id;
  return v_id;
end $$;

-- 호출 시작 표시: 예약이 유효(30분 이내)하거나 이미 표시된 경우에만 true. 만료된 예약이면 false → 호출하지 말고 해제한다. 예산 예약과 같은 lock 으로 직렬화한다.
create or replace function public.start_essay_ai_call(p_id uuid) returns boolean
language plpgsql as $$
declare v_n integer;
begin
  perform pg_advisory_xact_lock(hashtext('essay_ai_budget'));
  update public.essay_ai_cost_events set call_started_at = coalesce(call_started_at, now())
   where id = p_id and state = 'reserved' and (call_started_at is not null or created_at > now() - interval '30 minutes');
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;

-- 관리자 확인 대상: 호출이 시작됐지만 정산되지 않은 예약(비용 미확정). cost_usd 는 예약한 최악 금액(월 합계에 그대로 포함 중).
-- 처리: 실제 청구액을 확인해 settled 로 바꾸거나(docs/ops 런북의 쿼리), 호출이 실제로 없었음이 확인되면 비용 0 으로 정산한다. 이벤트 RLS 가 적용돼 관리자 행만 보인다.
create or replace view public.essay_ai_unsettled with (security_invoker = true) as
  select id, essay_score_id, student_id, cost_usd as reserved_usd, occurred_at, call_started_at, now() - call_started_at as age
    from public.essay_ai_cost_events where state = 'reserved' and call_started_at is not null;

-- 원장 상태 점검(런북·헬스): 한 줄 jsonb. 미적용 환경에서는 이 함수가 없으므로 호출 측(lib/essay-grading/ledger-status.ts)이 ledger_present=false 로 표시한다.
--  · row_ledger_mismatch_rows: 원장 이벤트가 있는 응답 행 중 행 누적 cost_usd 와 원장 합이 다른 행 수(구형 코드가 행을 덮어쓴 흔적 또는 중복 finish).
create or replace function public.essay_ai_ledger_status(p_now timestamptz default now()) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'ledger_present', true,
    'month_utc', to_char(p_now at time zone 'utc', 'YYYY-MM'),
    'month_spend_usd', public.essay_ai_month_spend(p_now),
    'unsettled_count', (select count(*) from public.essay_ai_unsettled),
    'unsettled_usd', (select coalesce(sum(reserved_usd), 0) from public.essay_ai_unsettled),
    'oldest_unsettled_at', (select min(call_started_at) from public.essay_ai_unsettled),
    'active_unstarted_reservations', (select count(*) from public.essay_ai_cost_events where state = 'reserved' and call_started_at is null and created_at > now() - interval '30 minutes'),
    'expired_unstarted_reservations', (select count(*) from public.essay_ai_cost_events where state = 'reserved' and call_started_at is null and created_at <= now() - interval '30 minutes'),
    'rows_cost_total_usd', (select coalesce(sum(cost_usd), 0) from public.mock_exam_essay_scores),
    'ledger_settled_legacy_total_usd', (select coalesce(sum(cost_usd), 0) from public.essay_ai_cost_effective),
    'row_ledger_mismatch_rows', (
      select count(*) from public.mock_exam_essay_scores s
       where exists (select 1 from public.essay_ai_cost_events e where e.essay_score_id = s.id and e.state in ('settled', 'legacy'))
         and abs(s.cost_usd - (select coalesce(sum(e.cost_usd), 0) from public.essay_ai_cost_events e where e.essay_score_id = s.id and e.state in ('settled', 'legacy'))) > 0.000005)
  );
$$;
revoke all on function public.essay_ai_month_spend(timestamptz) from public, anon, authenticated;
revoke all on function public.start_essay_ai_call(uuid) from public, anon, authenticated;
revoke all on function public.essay_ai_ledger_status(timestamptz) from public, anon, authenticated;
revoke all on function public.reserve_essay_ai_budget(uuid, uuid, numeric, numeric, timestamptz) from public, anon, authenticated;
grant execute on function public.essay_ai_month_spend(timestamptz) to service_role;
grant execute on function public.reserve_essay_ai_budget(uuid, uuid, numeric, numeric, timestamptz) to service_role;
grant execute on function public.start_essay_ai_call(uuid) to service_role;
grant execute on function public.essay_ai_ledger_status(timestamptz) to service_role;

-- 관리자 읽기 전용 일별 비용 집계(열 구성 동일). 건수는 행 생성일(created_at), 비용·토큰은 원장의 발생일(occurred_at) 기준.
create or replace view public.essay_ai_cost_daily with (security_invoker = true) as
  with n as (
    select (created_at at time zone 'utc')::date as day, model,
           count(*) as essays, count(*) filter (where status = 'done') as done, count(*) filter (where status in ('failed', 'dead')) as failed
      from public.mock_exam_essay_scores group by 1, 2
  ), c as (
    select (occurred_at at time zone 'utc')::date as day, model,
           sum(input_tokens) as input_tokens, sum(output_tokens) as output_tokens, sum(cost_usd) as cost_usd
      from public.essay_ai_cost_effective group by 1, 2
  )
  select coalesce(n.day, c.day) as day, coalesce(n.model, c.model) as model,
         coalesce(n.essays, 0) as essays, coalesce(n.done, 0) as done, coalesce(n.failed, 0) as failed,
         coalesce(c.input_tokens, 0) as input_tokens, coalesce(c.output_tokens, 0) as output_tokens, coalesce(c.cost_usd, 0) as cost_usd -- 비용 없는 그룹도 600 정의처럼 0(NULL 아님)
    from n full join c on n.day = c.day and n.model is not distinct from c.model;
