-- DRAFT ONLY — 적용 금지. supabase/migrations 에 넣지 않았다(실수로 db push 되지 않게).
-- 구현 계획: docs/ap/grade-estimate-implementation-plan.md §6. 승인·총괄 협의 후 새 번호의 마이그레이션 파일로 옮긴다.
-- 원칙: 등급·합산 점수는 파생 데이터다. 답안·FRQ 점수·학습 기록 테이블에는 컬럼을 추가하지 않는다.

create table if not exists ap_grade_scales (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  exam_year int not null,
  scale_version int not null,
  status text not null default 'draft' check (status in ('draft', 'validated', 'active', 'retired')),
  exam_composition_version text not null,            -- 섹션 구성·비중 레지스트리 버전(section-weights.ts 해시)
  component_weights jsonb not null,                   -- [{id:'mc',pct:45},...] 합 100
  cut_points jsonb,                                   -- {"2":x,"3":y,"4":z,"5":w} 합산 점수 하한. none 이면 null
  cut_basis text not null default 'none' check (cut_basis in ('official', 'external_estimate', 'internal_provisional', 'internal_validated', 'none')),
  source_note text,
  validation_id uuid,
  range_policy jsonb not null default '{"max_width":2}'::jsonb,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  activated_by uuid references profiles (id),
  activated_at timestamptz,
  retired_at timestamptz,
  unique (subject, exam_year, scale_version),
  check (status <> 'active' or (cut_points is not null and cut_basis in ('official', 'internal_validated') and validation_id is not null and activated_by is not null))
);
create unique index if not exists ap_grade_scales_one_active on ap_grade_scales (subject, exam_year) where status = 'active';

create table if not exists ap_grade_scale_validations (
  id uuid primary key default gen_random_uuid(),
  scale_id uuid not null references ap_grade_scales (id),
  pilot_id text not null,
  sample_n int not null,
  criteria jsonb not null,                            -- 실행 전 고정한 합격 기준(결과 본 뒤 수정 금지)
  metrics jsonb not null,
  verdict text not null check (verdict in ('pass', 'fail', 'insufficient')),
  reviewed_by uuid references profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table ap_grade_scales add constraint ap_grade_scales_validation_fk foreign key (validation_id) references ap_grade_scale_validations (id) deferrable initially deferred;

create table if not exists ap_attempt_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references mock_exam_attempts (id),
  scale_id uuid references ap_grade_scales (id),      -- 환산 기준 없이 합산 점수만 기록한 그림자 행은 null
  exam_set_id uuid not null references mock_exam_sets (id),
  set_group_id uuid,
  set_version_no int,
  layout_hash text not null,
  item_version_hash text not null,
  rubric_versions jsonb not null default '[]'::jsonb,
  ai_config jsonb,                                    -- 모델·프롬프트/루브릭 해시·채점 횟수·상한
  component_scores jsonb not null,                    -- [{id,earned,max,weightPct,contribution}]
  weighted_points numeric(5, 1),
  estimate_low smallint check (estimate_low between 1 and 5),
  estimate_high smallint check (estimate_high between 1 and 5),
  display_state text not null default 'hidden' check (display_state in ('hidden', 'shown')),
  hidden_reason text,                                 -- partial_set | frq_in_progress | scale_not_active | range_too_wide | ...
  attempt_no int,
  is_retake boolean not null default false,
  prior_exposure boolean not null default false,
  is_test_account boolean not null default false,
  supersedes_id uuid references ap_attempt_score_snapshots (id),
  computed_at timestamptz not null default now(),
  check (estimate_low is null or estimate_high is null or estimate_low <= estimate_high),
  check (display_state = 'hidden' or (scale_id is not null and estimate_low is not null and estimate_high is not null))
);
create index if not exists ap_snapshots_attempt on ap_attempt_score_snapshots (attempt_id, computed_at desc);

-- 불변: 수정·삭제 거부(정정은 새 행 + supersedes_id)
create or replace function ap_snapshot_immutable() returns trigger language plpgsql as $$
begin raise exception 'ap_attempt_score_snapshots is append-only'; end $$;
drop trigger if exists ap_snapshot_no_update on ap_attempt_score_snapshots;
create trigger ap_snapshot_no_update before update or delete on ap_attempt_score_snapshots for each row execute function ap_snapshot_immutable();

create table if not exists ap_grade_scale_impacts (
  id uuid primary key default gen_random_uuid(),
  from_scale_id uuid references ap_grade_scales (id),
  to_scale_id uuid not null references ap_grade_scales (id),
  affected_attempts int not null,
  grade_changed int not null,
  range_changed int not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create table if not exists ap_official_score_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id),
  subject text not null,
  exam_year int not null,
  official_grade smallint not null check (official_grade between 1 and 5),
  verification text not null default 'self_reported' check (verification in ('self_reported', 'document')),
  submitted_at timestamptz not null default now(),
  unique (student_id, subject, exam_year)
);

alter table ap_grade_scales enable row level security;
alter table ap_grade_scale_validations enable row level security;
alter table ap_attempt_score_snapshots enable row level security;
alter table ap_grade_scale_impacts enable row level security;
alter table ap_official_score_reports enable row level security;
-- 정책(개요): 관리자 전체 읽기 / 학생·보호자는 display_state='shown' 스냅샷만 / 쓰기는 SECURITY DEFINER 함수·서비스 롤만.
-- 정책 SQL 은 기존 student_access / guardian 헬퍼 함수 이름 확인 후 M1 에서 작성(이 초안에서는 생략).
