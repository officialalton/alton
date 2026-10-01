-- 대학 진학 정보 DB Part 9 — 정보 수집 봇(갱신 요청 큐) + 필드별 변경안 검토.
--
-- 배경: Part 6~8에서 출처 URL 레지스트리(university_source_urls)/학업 지표
-- (university_admission_metrics)/에세이 문항(university_essay_prompts)까지 정규화됐다.
-- 이 마이그레이션은 그 위에 (1) "최신 정보 확인 요청" 버튼이 쓰는 작업 큐와
-- (2) 크롤러가 만드는 변경안(사람 검토 전에는 기존 공개 데이터를 절대 건드리지 않는다)
-- 두 테이블만 추가한다. 실제 크롤러/승인 반영 로직은 lib/universities/crawler.ts,
-- lib/universities/refresh-actions.ts에 있다.
--
-- 정책(중요):
--   - 마감일/시험정책/에세이 문항·선택규칙/국제학생 요건은 이 설계 전체가 사람 검토를
--     전제로 한다 — 자동승인 로직 자체가 없다(코드에도, 여기 스키마에도 "auto_approve"
--     같은 경로를 두지 않았다).
--   - university_update_proposals에 결과를 쌓는 것과, 승인 시 실제 대상 테이블에
--     반영하는 것은 완전히 분리된 두 단계다 — 크롤러는 이 테이블에만 쓰고, 대상
--     테이블(university_admission_metrics 등) UPDATE는 관리자 승인 서버 액션에서만
--     일어난다.
--   - 학생/보호자는 이 두 테이블 중 university_update_proposals를 전혀 볼 수 없다
--     (RLS로 select 자체를 admin/consultant로 제한). university_refresh_jobs는
--     "최신 정보 확인 요청" 버튼 상태 표시에 필요해 인증 사용자 전원이 읽을 수 있다
--     (민감 정보 없음 — 상태/시각만).

create table if not exists university_refresh_jobs (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  requested_by uuid references auth.users(id),
  requested_role text,
  started_at timestamptz,
  finished_at timestamptz,
  error_summary text,
  created_at timestamptz not null default now()
);

comment on table university_refresh_jobs is
  'P9(2026-09-23): "최신 정보 확인 요청" 버튼이 쓰는 대학별 작업 큐. 대학당 진행중/최근완료
  작업은 중복 큐잉하지 않고 같은 레코드 상태를 보여준다(앱 레이어, requestUniversityRefresh).';

create index if not exists idx_university_refresh_jobs_university_status
  on university_refresh_jobs(university_id, status, created_at desc);

alter table university_refresh_jobs enable row level security;

-- 상태 표시는 민감 정보가 없으므로 로그인 사용자 전원이 읽을 수 있다.
create policy "university_refresh_jobs_select_authenticated"
  on university_refresh_jobs for select
  using (auth.role() = 'authenticated');

-- 요청 생성은 로그인 사용자 본인 명의로만(학생/보호자/컨설턴트/관리자 전부 버튼을 누를 수 있음).
create policy "university_refresh_jobs_insert_authenticated"
  on university_refresh_jobs for insert
  with check (requested_by = auth.uid());

-- 상태 전이(running/succeeded/failed 등)는 관리자(service_role, 크롤러 실행 주체)만 — 정책 없음 = 기본 거부.

create table if not exists university_update_proposals (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  refresh_job_id uuid references university_refresh_jobs(id) on delete set null,
  source_url_id uuid references university_source_urls(id) on delete set null,
  field_area text not null check (field_area in (
    'admissions', 'deadline', 'testing_policy', 'essay', 'admission_metric', 'cost_aid', 'other'
  )),
  target_table text not null check (target_table in (
    'university_admission_metrics', 'university_essay_prompts', 'university_admission_cycles', 'other'
  )),
  target_record_key jsonb not null default '{}'::jsonb,
  cycle_year integer,
  cohort text,
  current_value jsonb,
  proposed_value jsonb,
  evidence_excerpt text,
  evidence_location text,
  collected_at timestamptz not null default now(),
  result_type text not null check (result_type in (
    'no_change', 'new', 'changed', 'source_conflict', 'fetch_failed'
  )),
  status text not null default 'pending' check (status in (
    'pending', 'approved', 'approved_with_edit', 'held', 'rejected'
  )),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_reason text,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table university_update_proposals is
  'P9(2026-09-23): 크롤러가 만드는 필드별 변경안. 승인 전에는 기존 공개 데이터를
  건드리지 않는다(대상 테이블 UPDATE는 승인 서버 액션에서만). 마감일/시험정책/에세이/
  국제학생 요건은 자동승인 경로가 없다 — 전부 사람 검토.';
comment on column university_update_proposals.target_record_key is
  '대상 테이블에서 이 변경안이 가리키는 레코드의 unique key(예: {"cycle_year":2027,"cohort":"admitted","metric_key":"sat_total_25"}).';
comment on column university_update_proposals.result_type is
  'fetch_failed=접근/파싱 실패(사유는 evidence_excerpt). new=대상 테이블에 아직 값 없음.
  changed=기존 값과 다름. no_change=기존 값과 동일(그래도 최근 확인 기록으로 남김).
  source_conflict=같은 필드에 대해 서로 다른 승인된 출처가 다른 값을 보고.';

create index if not exists idx_university_update_proposals_university_status
  on university_update_proposals(university_id, status, created_at desc);
create index if not exists idx_university_update_proposals_refresh_job
  on university_update_proposals(refresh_job_id);

alter table university_update_proposals enable row level security;

-- 학생/보호자는 이 테이블을 전혀 볼 수 없다 — admin/consultant만.
create policy "university_update_proposals_select_admin_consultant"
  on university_update_proposals for select
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'consultant'))
  );

-- insert(크롤러 실행 결과 적재)/update(승인·반려·롤백)는 관리자(service_role)만 — 정책 없음 = 기본 거부.

drop trigger if exists set_updated_at_university_update_proposals on university_update_proposals;
create trigger set_updated_at_university_update_proposals
  before update on university_update_proposals
  for each row execute function set_updated_at();
