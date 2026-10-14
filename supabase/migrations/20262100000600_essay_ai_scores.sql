-- AI 에세이 채점(참고용 추정치) — 2026-10-14 오너 결정. 플래그(AI_ESSAY_GRADING_ENABLED) 기본 꺼짐; 이 테이블은 비어 있어도 앱이 동작한다.
--  · 쓰기: service_role(서버 액션)만. 읽기: 본인 학생 · 보호자 · 관리자. 학생이 점수를 직접 쓸 경로 없음.
--  · 멱등: (attempt_id, set_item_id, part_label, rubric_version) 유일 — 같은 에세이 재채점은 같은 행을 갱신(재시도) 한다.
--  · 에세이 원문은 저장하지 않는다(mock_exam_answers 에 이미 있음). 점수·근거·토큰·비용만.
-- 재실행 안전: if not exists / create or replace / drop policy if exists. 되돌리기: drop view + drop table (추가형).

create table if not exists public.mock_exam_essay_scores (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.mock_exam_attempts (id) on delete cascade,
  set_item_id uuid not null references public.mock_exam_set_items (id) on delete cascade,
  part_label text not null check (part_label ~ '^[A-Za-z0-9]{1,6}$'),
  student_id uuid not null references public.profiles (id),
  rubric_version text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed', 'dead', 'skipped')),
  model text,
  scores jsonb,            -- {thesis, evidence, sophistication, total, disagreement}
  rationale jsonb,         -- {thesis, evidence, sophistication, improve:[...]}
  attempts_made integer not null default 0 check (attempts_made >= 0),
  next_retry_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 200), -- 오류 분류 코드만(에세이 본문 금지)
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10, 5) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, set_item_id, part_label, rubric_version),
  check (status <> 'done' or scores is not null)
);
create index if not exists mock_exam_essay_scores_student_day_idx on public.mock_exam_essay_scores (student_id, created_at);
create index if not exists mock_exam_essay_scores_attempt_idx on public.mock_exam_essay_scores (attempt_id);
create index if not exists mock_exam_essay_scores_retry_idx on public.mock_exam_essay_scores (next_retry_at) where status in ('pending', 'failed');

alter table public.mock_exam_essay_scores enable row level security;
drop policy if exists essay_scores_read on public.mock_exam_essay_scores;
create policy essay_scores_read on public.mock_exam_essay_scores for select to authenticated
  using (student_id = auth.uid() or public.is_guardian_of(student_id) or public.is_admin());
-- insert/update/delete 정책 없음 → service_role 만 쓴다.

-- 관리자 읽기 전용 일별 비용 집계. security_invoker 로 호출자 RLS 를 따른다(관리자만 전체 행).
create or replace view public.essay_ai_cost_daily with (security_invoker = true) as
  select (created_at at time zone 'utc')::date as day, model,
         count(*) as essays, count(*) filter (where status = 'done') as done, count(*) filter (where status in ('failed', 'dead')) as failed,
         sum(input_tokens) as input_tokens, sum(output_tokens) as output_tokens, sum(cost_usd) as cost_usd
    from public.mock_exam_essay_scores group by 1, 2;
