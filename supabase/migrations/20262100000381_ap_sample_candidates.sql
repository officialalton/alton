-- 2026-10-08 — AP 샘플 후보 저장소·재고 칸·생성 호출 장부(additive, 학생 비노출).
-- 후보는 problems/problem_versions(학생 노출 경로)에 넣지 않고 이 테이블에만 둔다. 전문가 검수 통과 후 별도 단계에서 공개 경로로 변환.
-- 롤백(참고): drop table ap_generation_calls, ap_candidate_items, ap_stock_cells.

create table if not exists ap_stock_cells (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  edition text not null default 'ced-2027',
  keyword_code text not null,                    -- 토픽 공식 코드(내용 축)
  skill_code text not null,                      -- 공식 스킬 코드(스킬 축)
  structure text not null check (structure in ('standalone', 'shared_stimulus_set', 'frq_multipart')),
  target int not null check (target >= 0),
  adopted int not null default 0,
  pending int not null default 0,
  note text,
  unique (subject_id, edition, keyword_code, skill_code, structure)
);
create table if not exists ap_candidate_items (
  id uuid primary key default gen_random_uuid(),
  candidate_key text not null unique,            -- 파일 기준 안정 키(예: ap_calculus_ab-mc-0007)
  run_id text not null,
  subject_id uuid references subjects(id) on delete cascade,
  ap_subject_code text not null,
  kind text not null check (kind in ('mc', 'frq_bundle')),
  keyword_code text not null,
  skill_primary text not null,
  skill_secondary text[] not null default '{}',
  structure text not null check (structure in ('standalone', 'shared_stimulus_set', 'frq_multipart')),
  response_mode text not null,
  scoring_mode text not null check (scoring_mode in ('exact', 'partial', 'argument')),
  difficulty_provisional text check (difficulty_provisional in ('basic_learning', 'exam_prep', 'advanced_supplement')),
  difficulty_rationale text,
  payload jsonb not null,                        -- 문항/번들 본문(stem, stimulus, options, parts, rubric rows 등)
  verification jsonb not null default '{}'::jsonb,
  review jsonb not null default '{}'::jsonb,
  review_state text not null default 'candidate' check (review_state in (
    'candidate', 'auto_verified', 'rejected', 'pending_expert_review', 'expert_approved', 'expert_rejected')),
  rejection_reason text,
  created_at timestamptz not null default now()
);
create index if not exists ap_candidate_items_subject_idx on ap_candidate_items (ap_subject_code, review_state);
create table if not exists ap_generation_calls (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  candidate_key text,
  role text not null check (role in ('generate', 'solve', 'review', 'difficulty', 'spot_check', 'repair')),
  model text not null,
  input_tokens int,
  output_tokens int,
  cost_usd numeric(10,5) not null,
  batch boolean not null default true,
  created_at timestamptz not null default now()
);
do $$ declare t text; begin
  foreach t in array array['ap_stock_cells', 'ap_candidate_items', 'ap_generation_calls'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "관리자만 조회·쓰기" on %I', t);
    execute format('create policy "관리자만 조회·쓰기" on %I for all using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;
